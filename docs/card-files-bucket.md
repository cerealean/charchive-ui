# Card Files Bucket

This document explains the purpose and structure of the `card-files` Storage bucket used by Charchive.

## Overview

The `card-files` bucket stores binary file assets associated with cards and card versions.

Typical examples:
- Original uploaded PNG cards
- Original uploaded JSON card exports
- Card avatars
- Preview images
- Generated export files

Database metadata for each stored file lives in `public.card_files`.

## Where It Is Defined

Bucket creation and constraints are managed through SQL migration:
- `supabase/migrations/20260607003339_create-card-files-storage-bucket.sql`

This migration creates or updates the bucket and applies restrictions.

## Bucket Restrictions

Current restrictions for `card-files`:
- Public access: `false`
- File size limit: 50 MB (`52428800` bytes)
- Allowed MIME types:
  - `application/json`
  - `image/*`

These are bucket-level protections and are separate from row-level security in database tables.

## What the Bucket Stores

The file object key path is stored in:
- `public.card_files.storage_path`

The bucket name is stored in:
- `public.card_files.bucket_id` (defaults to `card-files`)

Each row in `public.card_files` references a single stored object.

Key columns in `public.card_files`:
- `id`: file record ID
- `card_id`: owning card
- `version_id`: optional associated card version
- `role`: semantic role (`original_upload`, `avatar`, `preview`, `generated_export`)
- `storage_path`: path inside the bucket
- `mime_type`, `size_bytes`, `sha256`: file metadata

## Directory Structure Inside the Bucket

Recommended object key layout:

- `cards/{owner_id}/{card_id}/original/{version_id}.png`
- `cards/{owner_id}/{card_id}/original/{version_id}.json`
- `cards/{owner_id}/{card_id}/avatar/{file_id}.webp`
- `cards/{owner_id}/{card_id}/exports/{version_id}/chara_card_v2.json`
- `cards/{owner_id}/{card_id}/exports/{version_id}/sillytavern.png`

Meaning of path segments:
- `owner_id`: owner of the card
- `card_id`: logical card identity
- `version_id`: specific version payload identity
- `file_id`: unique file record identity

This path design supports:
- Predictable grouping by owner and card
- Versioned imports/exports
- Easy cleanup per card or version

For local seeding details, see [Local Seeding](local-seeding.md).

## Notes for Development

- Database rows in `public.card_files` do not automatically upload binaries.
- Binaries must exist in Storage under keys matching `storage_path`.
- Keep `storage_path` and actual object keys synchronized.
- If adding new file formats, update:
  - bucket MIME restrictions in migration
  - upload/import logic
  - any client-side validation rules

## Quick Verification Queries

Check bucket exists:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'card-files';
```

Check object counts by bucket:

```sql
select bucket_id, count(*) as object_count
from storage.objects
group by bucket_id
order by bucket_id;
```

Check file metadata rows:

```sql
select bucket_id, storage_path, mime_type, size_bytes
from public.card_files
order by created_at desc
limit 20;
```
