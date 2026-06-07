do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Visible card files are readable'
  ) then
    create policy "Visible card files are readable"
    on storage.objects
    for select
    using (
      bucket_id = 'card-files'
      and exists (
        select 1
        from public.card_files cf
        join public.cards c
          on c.id = cf.card_id
        where cf.bucket_id = storage.objects.bucket_id
          and cf.storage_path = storage.objects.name
          and (
            c.visibility in ('public', 'unlisted')
            or c.owner_id = auth.uid()
          )
      )
    );
  end if;
end
$$;