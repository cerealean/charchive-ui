-- The card tables enable RLS and define policies, but were created without any
-- table-level GRANTs. RLS only decides which rows are visible; PostgREST still
-- requires table privileges to issue the query at all, so every read returned a
-- 403 ("permission denied for table ..."). Grant privileges to anon and
-- authenticated, scoped to match the existing RLS policies.

-- Public reads (anon + authenticated)
grant select on public.cards to anon, authenticated;
grant select on public.card_versions to anon, authenticated;
grant select on public.card_files to anon, authenticated;
grant select on public.card_tags to anon, authenticated;
grant select on public.tags to anon, authenticated;

-- Owner writes (authenticated only); matches the insert/update/delete policies
grant insert, update, delete on public.cards to authenticated;
grant insert on public.card_versions to authenticated;
grant insert on public.card_files to authenticated;
grant insert, delete on public.card_tags to authenticated;
