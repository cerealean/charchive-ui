-- Adds a per-user "like" capability for card comments and replies. Each
-- (comment_id, user_id) pair can exist at most once, so a given user can like a
-- given comment only one time. Un-liking deletes the row; liking again
-- re-inserts it. The denormalized card_comments.like_count column is kept in
-- sync by the triggers below and also enables sorting comments by popularity.

alter table public.card_comments
	add column if not exists like_count integer not null default 0
		check (like_count >= 0);

create table if not exists public.card_comment_likes (
	comment_id uuid not null
		references public.card_comments (id)
		on delete cascade,

	user_id uuid not null
		references auth.users (id)
		on delete cascade,

	created_at timestamp with time zone not null default now(),

	primary key (comment_id, user_id)
);

create index if not exists card_comment_likes_user_id_idx
	on public.card_comment_likes (user_id);

alter table public.card_comment_likes enable row level security;

-- Keeps card_comments.like_count accurate as likes are added and removed.
-- SECURITY DEFINER is required because the liker is usually not the comment
-- author, and the card_comments UPDATE privilege is restricted to the body
-- column for authors only. The function only ever adjusts the counter for the
-- directly affected comment, so it cannot tamper with any other column or row.
create or replace function public.sync_card_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (tg_op = 'INSERT') then
		update public.card_comments
			set like_count = like_count + 1
			where id = new.comment_id;
		return new;
	elsif (tg_op = 'DELETE') then
		update public.card_comments
			set like_count = greatest(like_count - 1, 0)
			where id = old.comment_id;
		return old;
	end if;

	return null;
end;
$$;

drop trigger if exists card_comment_likes_sync_count_insert on public.card_comment_likes;
create trigger card_comment_likes_sync_count_insert
	after insert on public.card_comment_likes
	for each row
	execute function public.sync_card_comment_like_count();

drop trigger if exists card_comment_likes_sync_count_delete on public.card_comment_likes;
create trigger card_comment_likes_sync_count_delete
	after delete on public.card_comment_likes
	for each row
	execute function public.sync_card_comment_like_count();

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comment_likes'
			and policyname = 'Users can read their own comment likes'
	) then
		create policy "Users can read their own comment likes"
		on public.card_comment_likes
		for select
		to authenticated
		using (
			user_id = (select auth.uid())
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comment_likes'
			and policyname = 'Users can like comments they can read'
	) then
		create policy "Users can like comments they can read"
		on public.card_comment_likes
		for insert
		to authenticated
		with check (
			user_id = (select auth.uid())
			and exists (
				select 1
				from public.card_comments cc
				join public.cards c on c.id = cc.card_id
				where cc.id = card_comment_likes.comment_id
					and cc.deleted_at is null
					and (
						c.visibility in ('public', 'unlisted')
						or c.owner_id = (select auth.uid())
					)
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_comment_likes'
			and policyname = 'Users can remove their own comment likes'
	) then
		create policy "Users can remove their own comment likes"
		on public.card_comment_likes
		for delete
		to authenticated
		using (
			user_id = (select auth.uid())
		);
	end if;
end;
$$;

-- RLS controls which rows are visible; PostgREST still needs table-level
-- privileges to issue the query at all. Comment likes are an authenticated-only
-- action.
grant select, insert, delete on public.card_comment_likes to authenticated;

comment on table public.card_comment_likes is
	'One row per (comment, user) like. The primary key enforces a single like per user per comment; triggers keep card_comments.like_count in sync.';
