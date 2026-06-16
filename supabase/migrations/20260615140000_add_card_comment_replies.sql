-- Adds threaded replies to comments. A comment may reply to another comment on
-- the same card; replies nest at most 3 levels deep (top-level = 1). The depth is
-- computed and capped by a trigger so clients cannot forge it, and deleting a
-- comment cascades to its replies (which keeps cards.comment_count accurate via
-- the existing per-row count triggers).

alter table public.card_comments
	add column if not exists parent_comment_id uuid null
		references public.card_comments (id)
		on delete cascade,
	add column if not exists depth integer not null default 1
		check (depth between 1 and 3);

create index if not exists card_comments_parent_comment_id_idx
	on public.card_comments (parent_comment_id);

-- Derives and validates depth from the parent on insert. SECURITY DEFINER so the
-- parent lookup is unaffected by the caller's RLS visibility; it only reads the
-- parent's depth and card_id and never writes another row.
create or replace function public.set_card_comment_depth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	parent_depth integer;
	parent_card uuid;
begin
	if new.parent_comment_id is null then
		new.depth := 1;
		return new;
	end if;

	select depth, card_id into parent_depth, parent_card
		from public.card_comments
		where id = new.parent_comment_id;

	if parent_depth is null then
		raise exception 'The comment being replied to no longer exists.'
			using errcode = 'foreign_key_violation';
	end if;

	if parent_card <> new.card_id then
		raise exception 'A reply must belong to the same card as the comment it replies to.'
			using errcode = 'check_violation';
	end if;

	new.depth := parent_depth + 1;

	if new.depth > 3 then
		raise exception 'Replies can only be nested up to 3 levels deep.'
			using errcode = 'check_violation';
	end if;

	return new;
end;
$$;

drop trigger if exists card_comments_set_depth on public.card_comments;
create trigger card_comments_set_depth
	before insert on public.card_comments
	for each row
	execute function public.set_card_comment_depth();

-- Restrict client updates to the body column only, so an author cannot re-parent a
-- comment or tamper with its computed depth through PostgREST. The set_updated_at
-- trigger still maintains updated_at regardless of column-level privileges.
revoke update on public.card_comments from authenticated;
grant update (body) on public.card_comments to authenticated;
