-- The original avatar storage policies targeted a bucket named "avatars", but the
-- avatar bucket is actually "profile-avatars" (see create-profile-avatars-storage-bucket).
-- As a result there were no RLS policies for the bucket the app uses, so uploads and
-- downloads against the private "profile-avatars" bucket were silently blocked.

drop policy if exists "Anyone can upload an avatar." on storage.objects;
drop policy if exists "Avatar images are publicly accessible." on storage.objects;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload profile avatars'
  ) then
    create policy "Authenticated users can upload profile avatars"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'profile-avatars');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can update profile avatars'
  ) then
    create policy "Authenticated users can update profile avatars"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'profile-avatars')
    with check (bucket_id = 'profile-avatars');
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
