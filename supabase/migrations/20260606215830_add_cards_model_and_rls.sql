create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$
begin
	if not exists (
		select 1
		from pg_type t
		join pg_namespace n on n.oid = t.typnamespace
		where n.nspname = 'public'
			and t.typname = 'card_visibility'
	) then
		create type public.card_visibility as enum (
			'private',
			'unlisted',
			'public'
		);
	end if;
end;
$$;

do $$
begin
	if not exists (
		select 1
		from pg_type t
		join pg_namespace n on n.oid = t.typnamespace
		where n.nspname = 'public'
			and t.typname = 'card_rating'
	) then
		create type public.card_rating as enum (
			'unknown',
			'sfw',
			'nsfw'
		);
	end if;
end;
$$;

do $$
begin
	if not exists (
		select 1
		from pg_type t
		join pg_namespace n on n.oid = t.typnamespace
		where n.nspname = 'public'
			and t.typname = 'card_format'
	) then
		create type public.card_format as enum (
			'chara_card_v2',
			'novelai',
			'chub',
			'sillytavern',
			'unknown'
		);
	end if;
end;
$$;

do $$
begin
	if not exists (
		select 1
		from pg_type t
		join pg_namespace n on n.oid = t.typnamespace
		where n.nspname = 'public'
			and t.typname = 'card_source_app'
	) then
		create type public.card_source_app as enum (
			'charchive',
			'chub',
			'sillytavern',
			'novelai',
			'tavernai',
			'other',
			'unknown'
		);
	end if;
end;
$$;

do $$
begin
	if not exists (
		select 1
		from pg_type t
		join pg_namespace n on n.oid = t.typnamespace
		where n.nspname = 'public'
			and t.typname = 'card_file_role'
	) then
		create type public.card_file_role as enum (
			'original_upload',
			'avatar',
			'preview',
			'generated_export'
		);
	end if;
end;
$$;

create table if not exists public.cards (
	id uuid primary key default gen_random_uuid(),

	owner_id uuid not null
		references auth.users (id)
		on delete cascade,

	slug text not null unique,
	title text not null,
	tagline text null,
	summary text null,

	visibility public.card_visibility not null default 'private',
	rating public.card_rating not null default 'unknown',

	avatar_file_id uuid null,
	current_version_id uuid null,

	like_count integer not null default 0 check (like_count >= 0),
	comment_count integer not null default 0 check (comment_count >= 0),
	download_count integer not null default 0 check (download_count >= 0),

	created_at timestamp with time zone not null default now(),
	updated_at timestamp with time zone not null default now(),
	published_at timestamp with time zone null,

	constraint cards_slug_format check (
		slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
	)
);

create table if not exists public.card_versions (
	id uuid primary key default gen_random_uuid(),

	card_id uuid not null
		references public.cards (id)
		on delete cascade,

	version_number integer not null check (version_number >= 1),

	source_format public.card_format not null default 'unknown',
	source_app public.card_source_app not null default 'unknown',

	spec text null,
	spec_version text null,

	canonical_schema_version integer not null default 1,

	character_name text not null,
	creator_name text null,
	character_version text null,

	description text null,
	personality text null,
	scenario text null,
	first_message text null,
	example_messages text null,
	system_prompt text null,
	post_history_instructions text null,
	creator_notes text null,

	raw_json jsonb not null,
	canonical_json jsonb not null,
	import_warnings jsonb not null default '[]'::jsonb,

	created_by uuid not null
		references auth.users (id)
		on delete cascade,

	created_at timestamp with time zone not null default now(),

	constraint card_versions_unique_version unique (card_id, version_number),

	constraint card_versions_raw_json_is_object check (
		jsonb_typeof(raw_json) = 'object'
	),

	constraint card_versions_canonical_json_is_object check (
		jsonb_typeof(canonical_json) = 'object'
	),

	constraint card_versions_import_warnings_is_array check (
		jsonb_typeof(import_warnings) = 'array'
	)
);

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'cards_current_version_id_fkey'
			and conrelid = 'public.cards'::regclass
	) then
		alter table public.cards
			add constraint cards_current_version_id_fkey
			foreign key (current_version_id)
			references public.card_versions (id)
			on delete set null;
	end if;
end;
$$;

create table if not exists public.card_files (
	id uuid primary key default gen_random_uuid(),

	card_id uuid not null
		references public.cards (id)
		on delete cascade,

	version_id uuid null
		references public.card_versions (id)
		on delete cascade,

	uploaded_by uuid not null
		references auth.users (id)
		on delete cascade,

	role public.card_file_role not null,

	bucket_id text not null default 'card-files',
	storage_path text not null unique,

	original_filename text null,
	mime_type text null,
	size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
	sha256 text null,

	metadata jsonb not null default '{}'::jsonb,

	created_at timestamp with time zone not null default now(),

	constraint card_files_metadata_is_object check (
		jsonb_typeof(metadata) = 'object'
	)
);

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'cards_avatar_file_id_fkey'
			and conrelid = 'public.cards'::regclass
	) then
		alter table public.cards
			add constraint cards_avatar_file_id_fkey
			foreign key (avatar_file_id)
			references public.card_files (id)
			on delete set null;
	end if;
end;
$$;

create table if not exists public.tags (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,
	name text not null unique,

	created_at timestamp with time zone not null default now(),

	constraint tags_slug_format check (
		slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
	)
);

create table if not exists public.card_tags (
	card_id uuid not null
		references public.cards (id)
		on delete cascade,

	tag_id uuid not null
		references public.tags (id)
		on delete cascade,

	created_at timestamp with time zone not null default now(),

	primary key (card_id, tag_id)
);

create index if not exists cards_owner_id_idx on public.cards (owner_id);
create index if not exists cards_visibility_idx on public.cards (visibility);
create index if not exists cards_rating_idx on public.cards (rating);
create index if not exists cards_created_at_idx on public.cards (created_at desc);
create index if not exists cards_published_at_idx on public.cards (published_at desc);

create index if not exists card_versions_card_id_idx on public.card_versions (card_id);
create index if not exists card_versions_source_format_idx on public.card_versions (source_format);
create index if not exists card_versions_raw_json_gin_idx on public.card_versions using gin (raw_json);
create index if not exists card_versions_canonical_json_gin_idx on public.card_versions using gin (canonical_json);

create index if not exists card_files_card_id_idx on public.card_files (card_id);
create index if not exists card_files_version_id_idx on public.card_files (version_id);
create index if not exists card_tags_tag_id_idx on public.card_tags (tag_id);

alter table public.cards enable row level security;
alter table public.card_versions enable row level security;
alter table public.card_files enable row level security;
alter table public.tags enable row level security;
alter table public.card_tags enable row level security;

do $$
begin
	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'cards'
			and policyname = 'Public and unlisted cards are readable'
	) then
		create policy "Public and unlisted cards are readable"
		on public.cards
		for select
		using (
			visibility in ('public', 'unlisted')
			or owner_id = auth.uid()
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'cards'
			and policyname = 'Users can create their own cards'
	) then
		create policy "Users can create their own cards"
		on public.cards
		for insert
		with check (
			owner_id = auth.uid()
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'cards'
			and policyname = 'Users can update their own cards'
	) then
		create policy "Users can update their own cards"
		on public.cards
		for update
		using (
			owner_id = auth.uid()
		)
		with check (
			owner_id = auth.uid()
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'cards'
			and policyname = 'Users can delete their own cards'
	) then
		create policy "Users can delete their own cards"
		on public.cards
		for delete
		using (
			owner_id = auth.uid()
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_versions'
			and policyname = 'Readable versions follow card visibility'
	) then
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
						or c.owner_id = auth.uid()
					)
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_versions'
			and policyname = 'Users can create versions for their own cards'
	) then
		create policy "Users can create versions for their own cards"
		on public.card_versions
		for insert
		with check (
			created_by = auth.uid()
			and exists (
				select 1
				from public.cards c
				where c.id = card_versions.card_id
					and c.owner_id = auth.uid()
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_files'
			and policyname = 'Readable files follow card visibility'
	) then
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
						or c.owner_id = auth.uid()
					)
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_files'
			and policyname = 'Users can create files for their own cards'
	) then
		create policy "Users can create files for their own cards"
		on public.card_files
		for insert
		with check (
			uploaded_by = auth.uid()
			and exists (
				select 1
				from public.cards c
				where c.id = card_files.card_id
					and c.owner_id = auth.uid()
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'tags'
			and policyname = 'Tags are readable by everyone'
	) then
		create policy "Tags are readable by everyone"
		on public.tags
		for select
		using (true);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_tags'
			and policyname = 'Card tags are readable when card is readable'
	) then
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
						or c.owner_id = auth.uid()
					)
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_tags'
			and policyname = 'Users can tag their own cards'
	) then
		create policy "Users can tag their own cards"
		on public.card_tags
		for insert
		with check (
			exists (
				select 1
				from public.cards c
				where c.id = card_tags.card_id
					and c.owner_id = auth.uid()
			)
		);
	end if;

	if not exists (
		select 1 from pg_policies
		where schemaname = 'public'
			and tablename = 'card_tags'
			and policyname = 'Users can untag their own cards'
	) then
		create policy "Users can untag their own cards"
		on public.card_tags
		for delete
		using (
			exists (
				select 1
				from public.cards c
				where c.id = card_tags.card_id
					and c.owner_id = auth.uid()
			)
		);
	end if;
end;
$$;

comment on table public.cards is
	'Public card listing identity and counters. current_version_id points to the active card_versions row.';

comment on table public.card_versions is
	'Versioned content snapshots. Preserves imported source(s) JSON and stores normalized canonical Charchive JSON.';

comment on column public.card_versions.canonical_json is
$$Canonical Charchive JSON shape:
{
	"schema": "charchive_card",
	"schema_version": 1,
	"character": {
		"name": "Example Character",
		"description": "",
		"personality": "",
		"scenario": "",
		"first_message": "",
		"alternate_greetings": [],
		"example_messages": "",
		"system_prompt": "",
		"post_history_instructions": "",
		"creator_notes": ""
	},
	"creator": {
		"name": "",
		"notes": ""
	},
	"tags": [],
	"character_book": null,
	"extensions": {},
	"source": {
		"format": "chara_card_v2",
		"app": "sillytavern",
		"spec": "chara_card_v2",
		"spec_version": "2.0"
	}
}$$;

comment on table public.card_files is
$$Storage reference records for source uploads, avatars, previews, and generated exports.

Recommended storage convention (bucket: card-files):
- cards/{owner_id}/{card_id}/original/{version_id}.png
- cards/{owner_id}/{card_id}/original/{version_id}.json
- cards/{owner_id}/{card_id}/avatar/{file_id}.webp
- cards/{owner_id}/{card_id}/exports/{version_id}/chara_card_v2.json
- cards/{owner_id}/{card_id}/exports/{version_id}/sillytavern.png$$;

comment on column public.card_versions.source_format is
$$Mapping guidance:
- Plain chara_card_v2 import: source_format = 'chara_card_v2', source_app = 'unknown' unless detected.
- SillyTavern PNG containing Character Card V2 JSON: source_format = 'chara_card_v2', source_app = 'sillytavern'; store the original PNG in card_files.role = 'original_upload'.
- CHUB export: if payload validates as chara_card_v2 -> source_format = 'chara_card_v2' and source_app = 'chub'. If payload is CHUB-specific -> source_format = 'chub' and source_app = 'chub'. Preserve CHUB-specific fields in raw_json and/or canonical_json.extensions.chub.
- NovelAI import: source_format = 'novelai' and source_app = 'novelai'. Preserve story/lorebook/memory/author note fields in raw_json and/or canonical_json.extensions.novelai.$$;
