do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Card file owners can upload objects'
  ) then
    create policy "Card file owners can upload objects"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'card-files'
      and (storage.foldername(name))[1] = 'cards'
      and (storage.foldername(name))[2] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Card file owners can delete objects'
  ) then
    create policy "Card file owners can delete objects"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'card-files'
      and (storage.foldername(name))[1] = 'cards'
      and (storage.foldername(name))[2] = auth.uid()::text
    );
  end if;
end
$$;
