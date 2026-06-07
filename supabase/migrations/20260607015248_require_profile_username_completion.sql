alter table public.profiles
drop constraint if exists username_length;

alter table public.profiles
add constraint username_length
check (
  username is null
  or char_length(btrim(username)) >= 3
);

drop policy if exists "Users can update own profile."
on public.profiles;

create policy "Users can update own profile."
on public.profiles
as permissive
for update
to public
using (((select auth.uid() as uid) = id))
with check (((select auth.uid() as uid) = id));