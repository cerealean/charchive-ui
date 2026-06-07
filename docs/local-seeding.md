# Local Seeding

This document explains how card seed data and Storage objects are generated for local development.

## Overview

Local seeding for Charchive has two parts:
- SQL seed data for cards, versions, tags, and file metadata
- Storage object uploads for the binary card assets referenced by those rows

The two pieces must stay in sync.

## Relevant Files

- `supabase/config.toml`
- `supabase/seed.sql`
- `supabase/seeds/generate-cards-seed.mjs`
- `supabase/migrations/20260607003339_create-card-files-storage-bucket.sql`
- `supabase/card-files/`

## SQL Seed Generation

The generator script:
- uses Faker to produce randomized card content
- reads the example JSON files in `temp/`
- extracts embedded `chara` metadata from the example PNGs
- generates `supabase/seed.sql`

Row volume is controlled by `SEED_COUNT` in `supabase/seeds/generate-cards-seed.mjs`.

## Storage Object Seeding

Binary files are staged into:
- `supabase/card-files/cards/...`

When `storage.buckets.<bucket>.objects_path` is not configured, `supabase db reset --local` does not import staged files automatically.

In that setup, run the explicit storage seed script after reset:

```bash
npm run seed:storage:local
```

Only files matching the bucket restrictions are staged and uploaded.

## Local Flow

1. Run the generator script.
2. The script writes `supabase/seed.sql`.
3. The script stages PNG files under `supabase/card-files/cards/...`.
4. Run `supabase db reset --local`.
5. Run `npm run seed:storage:local`.
6. Supabase applies migrations, runs SQL seeds, then the storage seed script uploads staged objects.

## Commands

Generate seed SQL and stage storage objects:

```bash
npm run seed:cards:generate
```

When you change `SEED_COUNT`, run this command again before `supabase db reset --local` so `supabase/seed.sql` is regenerated with the new row count.

Run the full local refresh flow:

```bash
npm run seed:cards:refresh
```

Verify object counts:

```sql
select bucket_id, count(*) as object_count
from storage.objects
group by bucket_id
order by bucket_id;
```

## Notes

- `public.card_files` only stores metadata and object paths.
- The actual binary file must exist in Storage under the same `storage_path`.
- Keep the generated object tree and the SQL metadata in sync.
- The `card-files` bucket is restricted to JSON and image MIME types, with a 50 MB file limit.
