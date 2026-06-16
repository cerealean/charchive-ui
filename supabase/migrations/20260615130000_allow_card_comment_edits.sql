-- Lets users edit their own comments. Adds an updated_at column (bumped by a
-- trigger on every row update) and an UPDATE policy restricted to the author.
-- The existing validate_card_comment trigger already runs on UPDATE OF body, so
-- edited comments are re-validated as plain text exactly like new ones.

alter table public.card_comments
	add column if not exists updated_at timestamp with time zone not null default now();

create or replace function public.set_card_comment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at := now();
	return new;
end;
$$;

drop trigger if exists card_comments_set_updated_at on public.card_comments;
create trigger card_comments_set_updated_at
	before update on public.card_comments
	for each row
	execute function public.set_card_comment_updated_at();

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comments'
			and policyname = 'Users can edit their own comments'
	) then
		create policy "Users can edit their own comments"
		on public.card_comments
		for update
		using (
			author_id = auth.uid()
		)
		with check (
			author_id = auth.uid()
		);
	end if;
end;
$$;

-- PostgREST needs the table-level UPDATE privilege in addition to the RLS policy.
grant update on public.card_comments to authenticated;
