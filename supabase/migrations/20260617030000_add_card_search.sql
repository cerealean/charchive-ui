-- Adds search and filtering for the public "Browse Cards" page:
--   * a denormalized tags.public_card_count so tag suggestions can be sorted by
--     popularity (most public cards first), kept in sync by triggers the same
--     way cards.like_count / cards.comment_count are;
--   * a trigram index on cards.title for fast case-insensitive substring search;
--   * a search_public_cards() RPC that filters public cards by title, by tags a
--     card must have ALL of, and by tags a card must have NONE of.

-- 1. Popularity counter ------------------------------------------------------

alter table public.tags
	add column if not exists public_card_count integer not null default 0;

create index if not exists tags_public_card_count_idx
	on public.tags (public_card_count desc);

-- 2. Keep public_card_count in sync ------------------------------------------

-- Fires when a tag is attached to / removed from a card. SECURITY DEFINER is
-- required because the tagger is the card owner, not necessarily able to update
-- the shared tags table; the function only ever nudges the counter for the one
-- affected tag.
create or replace function public.sync_tag_count_on_card_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (tg_op = 'INSERT') then
		if exists (
			select 1 from public.cards
			where id = new.card_id and visibility = 'public'
		) then
			update public.tags
				set public_card_count = public_card_count + 1
				where id = new.tag_id;
		end if;
		return new;
	elsif (tg_op = 'DELETE') then
		-- During a card cascade-delete the parent row is already gone, so this
		-- check is false and we skip the decrement -- the card-delete trigger
		-- below owns that case, preventing a double count.
		if exists (
			select 1 from public.cards
			where id = old.card_id and visibility = 'public'
		) then
			update public.tags
				set public_card_count = greatest(public_card_count - 1, 0)
				where id = old.tag_id;
		end if;
		return old;
	end if;

	return null;
end;
$$;

-- Fires when a card's visibility flips to/from public, or when a public card is
-- deleted. Adjusts the counter for every tag currently on the card in one pass.
create or replace function public.sync_tag_count_on_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (tg_op = 'UPDATE') then
		if (new.visibility = 'public' and old.visibility is distinct from 'public') then
			update public.tags t
				set public_card_count = public_card_count + 1
				from public.card_tags ct
				where ct.tag_id = t.id and ct.card_id = new.id;
		elsif (old.visibility = 'public' and new.visibility is distinct from 'public') then
			update public.tags t
				set public_card_count = greatest(public_card_count - 1, 0)
				from public.card_tags ct
				where ct.tag_id = t.id and ct.card_id = new.id;
		end if;
		return new;
	elsif (tg_op = 'DELETE') then
		-- BEFORE DELETE, so the card_tags rows still exist to be counted.
		if (old.visibility = 'public') then
			update public.tags t
				set public_card_count = greatest(public_card_count - 1, 0)
				from public.card_tags ct
				where ct.tag_id = t.id and ct.card_id = old.id;
		end if;
		return old;
	end if;

	return null;
end;
$$;

drop trigger if exists card_tags_sync_tag_count_insert on public.card_tags;
create trigger card_tags_sync_tag_count_insert
	after insert on public.card_tags
	for each row
	execute function public.sync_tag_count_on_card_tag();

drop trigger if exists card_tags_sync_tag_count_delete on public.card_tags;
create trigger card_tags_sync_tag_count_delete
	after delete on public.card_tags
	for each row
	execute function public.sync_tag_count_on_card_tag();

drop trigger if exists cards_sync_tag_count_visibility on public.cards;
create trigger cards_sync_tag_count_visibility
	after update of visibility on public.cards
	for each row
	execute function public.sync_tag_count_on_card();

drop trigger if exists cards_sync_tag_count_delete on public.cards;
create trigger cards_sync_tag_count_delete
	before delete on public.cards
	for each row
	execute function public.sync_tag_count_on_card();

-- These functions only ever run from triggers; close the unused RPC surface
-- (matches the 0028/0029 linter handling for the other trigger functions).
revoke execute on function public.sync_tag_count_on_card_tag() from public, anon, authenticated;
revoke execute on function public.sync_tag_count_on_card() from public, anon, authenticated;

-- 3. Backfill existing counts ------------------------------------------------

update public.tags t
set public_card_count = sub.cnt
from (
	select ct.tag_id, count(*) as cnt
	from public.card_tags ct
	join public.cards c on c.id = ct.card_id
	where c.visibility = 'public'
	group by ct.tag_id
) sub
where sub.tag_id = t.id;

-- 4. Title search index ------------------------------------------------------

-- pg_trgm lives in the extensions schema; a trigram GIN index keeps
-- ILIKE '%term%' fast despite the leading wildcard.
create index if not exists cards_title_trgm_idx
	on public.cards using gin (title extensions.gin_trgm_ops);

-- 5. Search RPC --------------------------------------------------------------

-- Filters public cards by title substring, by tags the card must have ALL of,
-- and by tags the card must have NONE of, newest first. PostgREST cannot
-- express "has ALL of N tags" cleanly, so the logic lives here. SECURITY
-- INVOKER is safe: we only read public cards, which RLS already exposes to
-- everyone (including anon). total_count is the full filtered count, repeated
-- on every row via a window so the client can paginate without a second query.
create or replace function public.search_public_cards(
	p_search text default null,
	p_include_tag_ids uuid[] default '{}',
	p_exclude_tag_ids uuid[] default '{}',
	p_limit integer default 10,
	p_offset integer default 0
)
returns table (
	id uuid,
	owner_id uuid,
	title text,
	tagline text,
	created_at timestamptz,
	like_count integer,
	comment_count integer,
	character_name text,
	storage_path text,
	tags jsonb,
	total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
	select
		c.id,
		c.owner_id,
		c.title,
		c.tagline,
		c.created_at,
		c.like_count,
		c.comment_count,
		cv.character_name,
		cf.storage_path,
		coalesce(
			(
				select jsonb_agg(
					jsonb_build_object('name', t.name, 'slug', t.slug)
					order by t.name
				)
				from public.card_tags ct
				join public.tags t on t.id = ct.tag_id
				where ct.card_id = c.id
			),
			'[]'::jsonb
		) as tags,
		count(*) over () as total_count
	from public.cards c
	left join public.card_versions cv on cv.id = c.current_version_id
	left join public.card_files cf on cf.id = c.avatar_file_id
	where c.visibility = 'public'
		and (
			p_search is null
			or c.title ilike '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
		)
		and (
			cardinality(p_include_tag_ids) = 0
			or (
				select count(distinct ct.tag_id)
				from public.card_tags ct
				where ct.card_id = c.id
					and ct.tag_id = any (p_include_tag_ids)
			) = cardinality(p_include_tag_ids)
		)
		and not exists (
			select 1
			from public.card_tags ct
			where ct.card_id = c.id
				and ct.tag_id = any (p_exclude_tag_ids)
		)
	order by c.created_at desc
	limit p_limit
	offset p_offset;
$$;

grant execute on function public.search_public_cards(text, uuid[], uuid[], integer, integer)
	to anon, authenticated;

comment on column public.tags.public_card_count is
	'Number of public cards carrying this tag. Maintained by triggers; used to rank tag suggestions by popularity.';
comment on function public.search_public_cards(text, uuid[], uuid[], integer, integer) is
	'Browse-page search: public cards filtered by title substring, tags they must all have, and tags they must not have. total_count is the full filtered count repeated per row.';
