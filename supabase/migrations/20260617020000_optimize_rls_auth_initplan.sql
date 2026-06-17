-- Resolves the Supabase "Auth RLS Initialization Plan" performance warnings.
-- Bare auth.uid() inside an RLS expression is re-evaluated for every candidate
-- row; wrapping it as (select auth.uid()) lets Postgres evaluate it once per
-- statement (an InitPlan) and reuse the result, which is materially faster at
-- scale. The recreated policies are byte-for-byte equivalent in behavior — only
-- the auth.uid() calls are wrapped. The newer card_comment_likes policies
-- already use this pattern and need no change.

-- cards -----------------------------------------------------------------------
drop policy if exists "Public and unlisted cards are readable" on public.cards;
create policy "Public and unlisted cards are readable"
on public.cards
for select
using (
	visibility in ('public', 'unlisted')
	or owner_id = (select auth.uid())
);

drop policy if exists "Users can create their own cards" on public.cards;
create policy "Users can create their own cards"
on public.cards
for insert
with check (
	owner_id = (select auth.uid())
);

drop policy if exists "Users can update their own cards" on public.cards;
create policy "Users can update their own cards"
on public.cards
for update
using (
	owner_id = (select auth.uid())
)
with check (
	owner_id = (select auth.uid())
);

drop policy if exists "Users can delete their own cards" on public.cards;
create policy "Users can delete their own cards"
on public.cards
for delete
using (
	owner_id = (select auth.uid())
);

-- card_versions ---------------------------------------------------------------
drop policy if exists "Readable versions follow card visibility" on public.card_versions;
create policy "Readable versions follow card visibility"
on public.card_versions
for select
using (
	exists (
		select 1
		from public.cards c
		where c.id = card_versions.card_id
			and (
				c.visibility in ('public', 'unlisted')
				or c.owner_id = (select auth.uid())
			)
	)
);

drop policy if exists "Users can create versions for their own cards" on public.card_versions;
create policy "Users can create versions for their own cards"
on public.card_versions
for insert
with check (
	created_by = (select auth.uid())
	and exists (
		select 1
		from public.cards c
		where c.id = card_versions.card_id
			and c.owner_id = (select auth.uid())
	)
);

-- card_files ------------------------------------------------------------------
drop policy if exists "Readable files follow card visibility" on public.card_files;
create policy "Readable files follow card visibility"
on public.card_files
for select
using (
	exists (
		select 1
		from public.cards c
		where c.id = card_files.card_id
			and (
				c.visibility in ('public', 'unlisted')
				or c.owner_id = (select auth.uid())
			)
	)
);

drop policy if exists "Users can create files for their own cards" on public.card_files;
create policy "Users can create files for their own cards"
on public.card_files
for insert
with check (
	uploaded_by = (select auth.uid())
	and exists (
		select 1
		from public.cards c
		where c.id = card_files.card_id
			and c.owner_id = (select auth.uid())
	)
);

-- card_tags -------------------------------------------------------------------
drop policy if exists "Card tags are readable when card is readable" on public.card_tags;
create policy "Card tags are readable when card is readable"
on public.card_tags
for select
using (
	exists (
		select 1
		from public.cards c
		where c.id = card_tags.card_id
			and (
				c.visibility in ('public', 'unlisted')
				or c.owner_id = (select auth.uid())
			)
	)
);

drop policy if exists "Users can tag their own cards" on public.card_tags;
create policy "Users can tag their own cards"
on public.card_tags
for insert
with check (
	exists (
		select 1
		from public.cards c
		where c.id = card_tags.card_id
			and c.owner_id = (select auth.uid())
	)
);

drop policy if exists "Users can untag their own cards" on public.card_tags;
create policy "Users can untag their own cards"
on public.card_tags
for delete
using (
	exists (
		select 1
		from public.cards c
		where c.id = card_tags.card_id
			and c.owner_id = (select auth.uid())
	)
);

-- card_likes ------------------------------------------------------------------
drop policy if exists "Users can read their own card likes" on public.card_likes;
create policy "Users can read their own card likes"
on public.card_likes
for select
using (
	user_id = (select auth.uid())
);

drop policy if exists "Users can like cards they can read" on public.card_likes;
create policy "Users can like cards they can read"
on public.card_likes
for insert
with check (
	user_id = (select auth.uid())
	and exists (
		select 1
		from public.cards c
		where c.id = card_likes.card_id
			and (
				c.visibility in ('public', 'unlisted')
				or c.owner_id = (select auth.uid())
			)
	)
);

drop policy if exists "Users can remove their own card likes" on public.card_likes;
create policy "Users can remove their own card likes"
on public.card_likes
for delete
using (
	user_id = (select auth.uid())
);

-- card_comments ---------------------------------------------------------------
drop policy if exists "Comments are readable when the card is readable" on public.card_comments;
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
				or c.owner_id = (select auth.uid())
			)
	)
);

drop policy if exists "Users can comment on cards they can read" on public.card_comments;
create policy "Users can comment on cards they can read"
on public.card_comments
for insert
with check (
	author_id = (select auth.uid())
	and exists (
		select 1
		from public.cards c
		where c.id = card_comments.card_id
			and (
				c.visibility in ('public', 'unlisted')
				or c.owner_id = (select auth.uid())
			)
	)
);

drop policy if exists "Users can edit their own comments" on public.card_comments;
create policy "Users can edit their own comments"
on public.card_comments
for update
using (
	author_id = (select auth.uid())
)
with check (
	author_id = (select auth.uid())
);

-- Unindexed foreign keys ------------------------------------------------------
-- Covering indexes for the foreign keys flagged by the linter. These speed up
-- reverse lookups and the cascade/set-null work Postgres performs when a
-- referenced row (a user, a card_file, or a card_version) is deleted.
create index if not exists card_files_uploaded_by_idx
	on public.card_files (uploaded_by);
create index if not exists card_versions_created_by_idx
	on public.card_versions (created_by);
create index if not exists cards_avatar_file_id_idx
	on public.cards (avatar_file_id);
create index if not exists cards_current_version_id_idx
	on public.cards (current_version_id);
