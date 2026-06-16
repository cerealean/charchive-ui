-- Adds plain-text comments on cards. Any signed-in user who can read a card may
-- comment on it (max 1000 characters), and may delete their own comments.
-- Comments are text-only: a BEFORE trigger rejects HTML/markup and any URL so
-- the row is never saved. The denormalized cards.comment_count column is kept in
-- sync by the count triggers below, mirroring the card_likes design.

create table if not exists public.card_comments (
	id uuid primary key default gen_random_uuid(),

	card_id uuid not null
		references public.cards (id)
		on delete cascade,

	author_id uuid not null
		references auth.users (id)
		on delete cascade,

	body text not null,

	created_at timestamp with time zone not null default now(),

	constraint card_comments_body_length check (
		char_length(body) between 1 and 1000
	)
);

create index if not exists card_comments_card_id_created_at_idx
	on public.card_comments (card_id, created_at desc);
create index if not exists card_comments_author_id_idx
	on public.card_comments (author_id);

alter table public.card_comments enable row level security;

-- Rejects comments that are not plain text. The rules here MUST stay in sync with
-- the client-side validator in src/app/shared/comment-validation.ts:
--   * no angle brackets (blocks HTML tags / markup / scripts)
--   * no scheme URLs (http://, https://, ftp://, ...), no dangerous schemes
--     (javascript:, data:, vbscript:), no "www." prefixes
--   * no bare domains ending in a common website TLD (example.com, evil.io/path)
-- Leading/trailing whitespace is trimmed before validation so a blank body is
-- caught by the body-length check.
create or replace function public.validate_card_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.body := btrim(new.body);

	if new.body ~ '[<>]' then
		raise exception 'Comments must be plain text and cannot contain HTML, markup, or scripts.'
			using errcode = 'check_violation';
	end if;

	if
		new.body ~* '[a-z][a-z0-9+.-]*://'
		or new.body ~* '(javascript|data|vbscript)[[:space:]]*:'
		or new.body ~* '\ywww\.'
		or new.body ~* '\y[a-z0-9]([a-z0-9-]*[a-z0-9])?\.(com|net|org|io|co|dev|app|ai|gg|xyz|info|biz|me|tv|news|blog|site|online|shop|store|link|click|live|fun|top|ru|cn|uk|de|fr|jp|br|in|ca|au|us|eu|nl|es|it|kr|mx|gov|edu)\y'
	then
		raise exception 'Comments cannot contain links or website addresses.'
			using errcode = 'check_violation';
	end if;

	return new;
end;
$$;

drop trigger if exists card_comments_validate on public.card_comments;
create trigger card_comments_validate
	before insert or update of body on public.card_comments
	for each row
	execute function public.validate_card_comment();

-- Keeps cards.comment_count accurate as comments are added and removed.
-- SECURITY DEFINER is required because the commenter is usually not the card
-- owner, and the cards UPDATE policy only permits owners. The function only ever
-- adjusts the counter for the directly affected card.
create or replace function public.sync_card_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (tg_op = 'INSERT') then
		update public.cards
			set comment_count = comment_count + 1
			where id = new.card_id;
		return new;
	elsif (tg_op = 'DELETE') then
		update public.cards
			set comment_count = greatest(comment_count - 1, 0)
			where id = old.card_id;
		return old;
	end if;

	return null;
end;
$$;

drop trigger if exists card_comments_sync_count_insert on public.card_comments;
create trigger card_comments_sync_count_insert
	after insert on public.card_comments
	for each row
	execute function public.sync_card_comment_count();

drop trigger if exists card_comments_sync_count_delete on public.card_comments;
create trigger card_comments_sync_count_delete
	after delete on public.card_comments
	for each row
	execute function public.sync_card_comment_count();

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comments'
			and policyname = 'Comments are readable when the card is readable'
	) then
		create policy "Comments are readable when the card is readable"
		on public.card_comments
		for select
		using (
			exists (
				select 1
				from public.cards c
				where c.id = card_comments.card_id
					and (
						c.visibility in ('public', 'unlisted')
						or c.owner_id = auth.uid()
					)
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comments'
			and policyname = 'Users can comment on cards they can read'
	) then
		create policy "Users can comment on cards they can read"
		on public.card_comments
		for insert
		with check (
			author_id = auth.uid()
			and exists (
				select 1
				from public.cards c
				where c.id = card_comments.card_id
					and (
						c.visibility in ('public', 'unlisted')
						or c.owner_id = auth.uid()
					)
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comments'
			and policyname = 'Users can delete their own comments'
	) then
		create policy "Users can delete their own comments"
		on public.card_comments
		for delete
		using (
			author_id = auth.uid()
		);
	end if;
end;
$$;

-- RLS controls which rows are visible; PostgREST still needs table-level
-- privileges to issue the query at all. Anyone may read comments on cards they
-- can see; only authenticated users may write or remove them.
grant select on public.card_comments to anon, authenticated;
grant insert, delete on public.card_comments to authenticated;

comment on table public.card_comments is
	'One row per card comment. Plain-text only (enforced by validate_card_comment); triggers keep cards.comment_count in sync.';
