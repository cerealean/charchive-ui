-- Adds a per-user "like" capability for cards. Each (card_id, user_id) pair can
-- exist at most once, so a given user can like a given card only one time.
-- Un-liking deletes the row; liking again re-inserts it. The denormalized
-- cards.like_count column is kept in sync by the triggers below.

create table if not exists public.card_likes (
	card_id uuid not null
		references public.cards (id)
		on delete cascade,

	user_id uuid not null
		references auth.users (id)
		on delete cascade,

	created_at timestamp with time zone not null default now(),

	primary key (card_id, user_id)
);

create index if not exists card_likes_user_id_idx on public.card_likes (user_id);

alter table public.card_likes enable row level security;

-- Keeps cards.like_count accurate as likes are added and removed.
-- SECURITY DEFINER is required because the liker is usually not the card owner,
-- and the cards UPDATE policy only permits owners. The function only ever
-- adjusts the counter for the directly affected card, so it cannot tamper with
-- any other column or row.
create or replace function public.sync_card_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if (tg_op = 'INSERT') then
		update public.cards
			set like_count = like_count + 1
			where id = new.card_id;
		return new;
	elsif (tg_op = 'DELETE') then
		update public.cards
			set like_count = greatest(like_count - 1, 0)
			where id = old.card_id;
		return old;
	end if;

	return null;
end;
$$;

drop trigger if exists card_likes_sync_count_insert on public.card_likes;
create trigger card_likes_sync_count_insert
	after insert on public.card_likes
	for each row
	execute function public.sync_card_like_count();

drop trigger if exists card_likes_sync_count_delete on public.card_likes;
create trigger card_likes_sync_count_delete
	after delete on public.card_likes
	for each row
	execute function public.sync_card_like_count();

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_likes'
			and policyname = 'Users can read their own card likes'
	) then
		create policy "Users can read their own card likes"
		on public.card_likes
		for select
		using (
			user_id = auth.uid()
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_likes'
			and policyname = 'Users can like cards they can read'
	) then
		create policy "Users can like cards they can read"
		on public.card_likes
		for insert
		with check (
			user_id = auth.uid()
			and exists (
				select 1
				from public.cards c
				where c.id = card_likes.card_id
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
			and tablename = 'card_likes'
			and policyname = 'Users can remove their own card likes'
	) then
		create policy "Users can remove their own card likes"
		on public.card_likes
		for delete
		using (
			user_id = auth.uid()
		);
	end if;
end;
$$;

-- RLS controls which rows are visible; PostgREST still needs table-level
-- privileges to issue the query at all. Likes are an authenticated-only action.
grant select, insert, delete on public.card_likes to authenticated;

comment on table public.card_likes is
	'One row per (card, user) like. The primary key enforces a single like per user per card; triggers keep cards.like_count in sync.';
