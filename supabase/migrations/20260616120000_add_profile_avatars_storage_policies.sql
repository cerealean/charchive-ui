-- The original avatar storage policies targeted a bucket named "avatars", but the
-- avatar bucket is actually "profile-avatars" (see create-profile-avatars-storage-bucket).
-- As a result there were no RLS policies for the bucket the app uses, so uploads and
-- downloads against the private "profile-avatars" bucket were silently blocked.
--
-- Writes are scoped to a per-user folder ("<auth.uid()>/<file>") so a user can only
-- create, replace, or delete their own avatar objects. Reads stay public so avatars
-- can be displayed anywhere in the app.

drop policy if exists "Anyone can upload an avatar." on storage.objects;
drop policy if exists "Avatar images are publicly accessible." on storage.objects;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatar owners can upload profile avatars'
  ) then
    create policy "Avatar owners can upload profile avatars"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'profile-avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatar owners can update profile avatars'
  ) then
    create policy "Avatar owners can update profile avatars"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'profile-avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'profile-avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatar owners can delete profile avatars'
  ) then
    create policy "Avatar owners can delete profile avatars"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'profile-avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile avatars are readable'
  ) then
    create policy "Profile avatars are readable"
    on storage.objects
    for select
    to public
    using (bucket_id = 'profile-avatars');
  end if;
end
$$;
