-- Moves the pg_trgm extension out of the public schema and into the dedicated
-- `extensions` schema (Supabase best practice, flagged by the 0014 linter).
--
-- `extensions` is already on the database search_path, so unqualified trigram
-- calls continue to resolve. Existing indexes reference operator classes by OID
-- rather than by name, so nothing needs to be rebuilt.

alter extension pg_trgm set schema extensions;
