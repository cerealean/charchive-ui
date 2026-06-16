-- Raises the maximum comment reply nesting from 3 to 6 levels. Updates both the
-- depth check constraint and the depth-deriving trigger function.

alter table public.card_comments
	drop constraint if exists card_comments_depth_check;

alter table public.card_comments
	add constraint card_comments_depth_check check (depth between 1 and 6);

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

	if new.depth > 6 then
		raise exception 'Replies can only be nested up to 6 levels deep.'
			using errcode = 'check_violation';
	end if;

	return new;
end;
$$;
