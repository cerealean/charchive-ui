import { faker } from '@faker-js/faker';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const tempDir = path.join(repoRoot, 'temp');
const outputSqlPath = path.join(repoRoot, 'supabase', 'seed.sql');

const SEED_COUNT = 10;
const FAKER_SEED = 20260606;

const OWNER_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'seed-owner-1@charchive.local',
    displayName: 'Seed Owner One',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'seed-owner-2@charchive.local',
    displayName: 'Seed Owner Two',
  },
];

const CARD_VISIBILITY = ['private', 'unlisted', 'public'];
const CARD_RATING = ['unknown', 'sfw', 'nsfw'];
const SOURCE_APPS = ['charchive', 'chub', 'sillytavern', 'novelai', 'other'];

const FALLBACK_TAGS = [
  'Fantasy',
  'Sci-Fi',
  'Assistant',
  'Tool',
  'Adventure',
  'Mystery',
  'Roleplay',
  'English',
  'SFW',
  'Story',
];

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableString(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  return sqlString(value);
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function makeSlug(input, usedSlugs) {
  const base = faker.helpers
    .slugify(input)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  const normalized = base.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 52);
  let slug = normalized || 'seed-card';

  while (usedSlugs.has(slug)) {
    slug = `${normalized}-${faker.string.alphanumeric(4).toLowerCase()}`;
  }

  usedSlugs.add(slug);
  return slug;
}

function hashSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseTextChunk(data) {
  const separator = data.indexOf(0x00);
  if (separator < 0) {
    return null;
  }

  const key = data.subarray(0, separator).toString('latin1');
  const text = data.subarray(separator + 1).toString('latin1');
  return { key, text };
}

function parseCompressedTextChunk(data) {
  const separator = data.indexOf(0x00);
  if (separator < 0 || separator + 2 >= data.length) {
    return null;
  }

  const key = data.subarray(0, separator).toString('latin1');
  const compressionMethod = data[separator + 1];
  if (compressionMethod !== 0) {
    return null;
  }

  const compressedText = data.subarray(separator + 2);
  const text = inflateSync(compressedText).toString('latin1');
  return { key, text };
}

function parseInternationalTextChunk(data) {
  let offset = 0;
  const keywordSeparator = data.indexOf(0x00, offset);
  if (keywordSeparator < 0) {
    return null;
  }

  const key = data.subarray(offset, keywordSeparator).toString('latin1');
  offset = keywordSeparator + 1;

  if (offset + 1 >= data.length) {
    return null;
  }

  const compressionFlag = data[offset];
  const compressionMethod = data[offset + 1];
  offset += 2;

  const languageSeparator = data.indexOf(0x00, offset);
  if (languageSeparator < 0) {
    return null;
  }
  offset = languageSeparator + 1;

  const translatedSeparator = data.indexOf(0x00, offset);
  if (translatedSeparator < 0) {
    return null;
  }
  offset = translatedSeparator + 1;

  const textBytes = data.subarray(offset);
  const decoded =
    compressionFlag === 1 && compressionMethod === 0
      ? inflateSync(textBytes).toString('utf8')
      : textBytes.toString('utf8');

  return { key, text: decoded };
}

function parseJsonCandidate(candidate) {
  if (!candidate) {
    return null;
  }

  const raw = candidate.trim();
  if (!raw) {
    return null;
  }

  const attempts = [raw];

  try {
    const decodedUtf8 = Buffer.from(raw, 'base64').toString('utf8');
    attempts.push(decodedUtf8);
  } catch {
    // noop
  }

  try {
    const decodedLatin1 = Buffer.from(raw, 'base64').toString('latin1');
    attempts.push(decodedLatin1);
  } catch {
    // noop
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // continue
    }

    try {
      return JSON.parse(decodeURIComponent(attempt));
    } catch {
      // continue
    }
  }

  return null;
}

function parseCharaMetadataFromPng(buffer) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    return null;
  }

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buffer.length) {
      return null;
    }

    const data = buffer.subarray(dataStart, dataEnd);

    let parsed = null;
    if (type === 'tEXt') {
      parsed = parseTextChunk(data);
    } else if (type === 'zTXt') {
      parsed = parseCompressedTextChunk(data);
    } else if (type === 'iTXt') {
      parsed = parseInternationalTextChunk(data);
    }

    if (parsed?.key === 'chara') {
      const metadata = parseJsonCandidate(parsed.text);
      if (metadata) {
        return metadata;
      }
    }

    offset = dataEnd + 4;
  }

  return null;
}

function createRawCardPayload(hints, imageAvatarUrl) {
  const characterName = faker.person.fullName();
  const creator = faker.internet.username().slice(0, 20);
  const tags = faker.helpers.arrayElements(hints.tags, faker.number.int({ min: 2, max: 4 }));

  const description = `${faker.lorem.paragraph()}\n\n${faker.lorem.sentences(2)}`;
  const scenario = faker.lorem.sentences({ min: 1, max: 3 });
  const firstMes = faker.lorem.paragraphs({ min: 1, max: 2 }, '\n\n');

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: characterName,
      description,
      personality: faker.helpers.arrayElements(hints.personalityHints, 6).join(', '),
      first_mes: firstMes,
      avatar: imageAvatarUrl ?? '',
      mes_example: faker.lorem.sentences({ min: 2, max: 4 }),
      scenario,
      creator_notes: faker.lorem.paragraph(),
      system_prompt: faker.lorem.sentences({ min: 1, max: 3 }),
      post_history_instructions: faker.lorem.sentence(),
      alternate_greetings: [faker.lorem.sentence(), faker.lorem.sentence()],
      tags,
      creator,
      character_version: 'main',
      extensions: {
        chub: {
          id: faker.number.int({ min: 100000, max: 9999999 }),
          preset: null,
          full_path: `${creator}/${faker.helpers.slugify(characterName).toLowerCase()}`,
          custom_css: null,
          extensions: [],
          expressions: null,
          alt_expressions: {},
          background_image: '',
          related_lorebooks: [],
        },
        depth_prompt: {
          depth: faker.number.int({ min: 0, max: 2 }),
          prompt: '',
        },
      },
      character_book: null,
    },
  };
}

function createCanonicalPayload(raw, sourceApp) {
  const data = raw.data;

  return {
    schema: 'charchive_card',
    schema_version: 1,
    character: {
      name: data.name,
      description: data.description,
      personality: data.personality,
      scenario: data.scenario,
      first_message: data.first_mes,
      alternate_greetings: Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [],
      example_messages: data.mes_example,
      system_prompt: data.system_prompt,
      post_history_instructions: data.post_history_instructions,
      creator_notes: data.creator_notes,
    },
    creator: {
      name: data.creator,
      notes: data.creator_notes,
    },
    tags: Array.isArray(data.tags) ? data.tags : [],
    character_book: data.character_book ?? null,
    extensions: data.extensions ?? {},
    source: {
      format: 'chara_card_v2',
      app: sourceApp,
      spec: raw.spec,
      spec_version: raw.spec_version,
    },
  };
}

async function loadExampleAssets() {
  const files = await fs.readdir(tempDir);
  const pngFiles = files.filter((file) => file.endsWith('.png'));
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  const templates = [];

  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(tempDir, jsonFile);
    const raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    templates.push(raw);
  }

  const imageAssets = [];
  for (const pngFile of pngFiles) {
    const pngPath = path.join(tempDir, pngFile);
    const buffer = await fs.readFile(pngPath);
    const stat = await fs.stat(pngPath);
    const metadata = parseCharaMetadataFromPng(buffer);
    imageAssets.push({
      fileName: pngFile,
      absolutePath: pngPath,
      sizeBytes: stat.size,
      sha256: hashSha256(buffer),
      metadata,
    });

    if (metadata) {
      templates.push(metadata);
    }
  }

  if (templates.length === 0) {
    throw new Error('No JSON templates were found in /temp to build seeded card data.');
  }

  return { templates, imageAssets };
}

function templateHints(template) {
  const inputTags = Array.isArray(template?.data?.tags) ? template.data.tags : [];

  return {
    tags: inputTags.length > 0 ? [...new Set([...inputTags, ...FALLBACK_TAGS])] : FALLBACK_TAGS,
    personalityHints: [
      'curious',
      'thoughtful',
      'dramatic',
      'precise',
      'friendly',
      'mysterious',
      'confident',
      'gentle',
      'witty',
      'pragmatic',
    ],
  };
}

function buildSeedRows(templates, imageAssets) {
  faker.seed(FAKER_SEED);

  const usedSlugs = new Set();
  const cards = [];
  const versions = [];
  const files = [];
  const cardTags = [];
  const tagSet = new Set();

  for (let i = 0; i < SEED_COUNT; i += 1) {
    const owner = OWNER_USERS[i % OWNER_USERS.length];
    const template = faker.helpers.arrayElement(templates);
    const hints = templateHints(template);

    const cardId = faker.string.uuid();
    const versionId = faker.string.uuid();
    const sourceApp = faker.helpers.arrayElement(SOURCE_APPS);

    const visibility = faker.helpers.arrayElement(CARD_VISIBILITY);
    const rating = faker.helpers.arrayElement(CARD_RATING);

    const hasImage = imageAssets.length > 0 && faker.datatype.boolean({ probability: 0.6 });
    const imageAsset = hasImage ? faker.helpers.arrayElement(imageAssets) : null;

    const rawPayload = createRawCardPayload(
      hints,
      imageAsset ? `seed://${imageAsset.fileName}` : null,
    );
    const canonicalPayload = createCanonicalPayload(rawPayload, sourceApp);

    const title = `${rawPayload.data.name} ${faker.word.noun()}`;
    const slug = makeSlug(`${rawPayload.data.name}-${faker.word.adjective()}`, usedSlugs);

    const createdAt = faker.date.between({
      from: new Date('2025-01-01T00:00:00.000Z'),
      to: new Date('2026-06-01T00:00:00.000Z'),
    });

    const updatedAt = faker.date.between({
      from: createdAt,
      to: new Date('2026-06-06T00:00:00.000Z'),
    });

    const publishedAt =
      visibility === 'private' ? null : faker.date.between({ from: createdAt, to: updatedAt });

    let avatarFileId = null;

    if (imageAsset) {
      const fileId = faker.string.uuid();
      avatarFileId = faker.datatype.boolean({ probability: 0.75 }) ? fileId : null;

      files.push({
        id: fileId,
        card_id: cardId,
        version_id: versionId,
        uploaded_by: owner.id,
        role: 'original_upload',
        bucket_id: 'card-files',
        storage_path: `cards/${owner.id}/${cardId}/original/${versionId}.png`,
        original_filename: imageAsset.fileName,
        mime_type: 'image/png',
        size_bytes: imageAsset.sizeBytes,
        sha256: imageAsset.sha256,
        metadata: {
          source: 'temp/examples',
          embedded_payload_detected: Boolean(imageAsset.metadata),
          embedded_spec: imageAsset.metadata?.spec ?? null,
          embedded_name: imageAsset.metadata?.data?.name ?? null,
        },
        created_at: createdAt.toISOString(),
      });
    }

    cards.push({
      id: cardId,
      owner_id: owner.id,
      slug,
      title,
      tagline: faker.company.catchPhrase(),
      summary: faker.lorem.sentences({ min: 1, max: 3 }),
      visibility,
      rating,
      avatar_file_id: null,
      desired_avatar_file_id: avatarFileId,
      current_version_id: null,
      like_count: faker.number.int({ min: 0, max: 200 }),
      comment_count: faker.number.int({ min: 0, max: 40 }),
      download_count: faker.number.int({ min: 0, max: 400 }),
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      published_at: publishedAt ? publishedAt.toISOString() : null,
    });

    versions.push({
      id: versionId,
      card_id: cardId,
      version_number: 1,
      source_format: 'chara_card_v2',
      source_app: sourceApp,
      spec: rawPayload.spec,
      spec_version: rawPayload.spec_version,
      canonical_schema_version: 1,
      character_name: rawPayload.data.name,
      creator_name: rawPayload.data.creator,
      character_version: rawPayload.data.character_version,
      description: rawPayload.data.description,
      personality: rawPayload.data.personality,
      scenario: rawPayload.data.scenario,
      first_message: rawPayload.data.first_mes,
      example_messages: rawPayload.data.mes_example,
      system_prompt: rawPayload.data.system_prompt,
      post_history_instructions: rawPayload.data.post_history_instructions,
      creator_notes: rawPayload.data.creator_notes,
      raw_json: rawPayload,
      canonical_json: canonicalPayload,
      import_warnings: [],
      created_by: owner.id,
      created_at: createdAt.toISOString(),
    });

    const cardTagNames = faker.helpers.arrayElements(
      rawPayload.data.tags,
      faker.number.int({ min: 2, max: 4 }),
    );
    for (const tagName of cardTagNames) {
      const cleanedName = String(tagName).trim();
      if (!cleanedName) {
        continue;
      }
      const slugTag = faker.helpers
        .slugify(cleanedName)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      tagSet.add(`${slugTag}|${cleanedName}`);
      cardTags.push({ card_id: cardId, tag_slug: slugTag });
    }
  }

  const tags = [...tagSet].map((entry) => {
    const [slug, name] = entry.split('|');
    return { id: faker.string.uuid(), slug, name };
  });

  return { cards, versions, files, tags, cardTags };
}

function renderUserInsertSql() {
  const now = new Date().toISOString();

  const blocks = OWNER_USERS.map(
    (user) => `
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
values (
  ${sqlString(user.id)},
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  ${sqlString(user.email)},
  crypt('seed-password-unsafe', gen_salt('bf')),
  ${sqlString(now)}::timestamptz,
  ${sqlJson({ provider: 'email', providers: ['email'] })},
  ${sqlJson({ display_name: user.displayName, seeded: true })},
  ${sqlString(now)}::timestamptz,
  ${sqlString(now)}::timestamptz,
  false
)
on conflict (id) do nothing;`,
  ).join('\n');

  return blocks;
}

function renderInsert(tableName, columns, rows, mapper) {
  if (rows.length === 0) {
    return `-- No rows generated for ${tableName}.`;
  }

  const values = rows.map((row) => `(${mapper(row).join(', ')})`).join(',\n');

  return `insert into ${tableName} (${columns.join(', ')})\nvalues\n${values};`;
}

function buildSeedSql(rows) {
  const tagsBySlug = new Map(rows.tags.map((tag) => [tag.slug, tag]));
  const avatarAssignments = rows.cards
    .filter((card) => Boolean(card.desired_avatar_file_id))
    .map((card) => ({ card_id: card.id, file_id: card.desired_avatar_file_id }));

  const cardsSql = renderInsert(
    'public.cards',
    [
      'id',
      'owner_id',
      'slug',
      'title',
      'tagline',
      'summary',
      'visibility',
      'rating',
      'avatar_file_id',
      'current_version_id',
      'like_count',
      'comment_count',
      'download_count',
      'created_at',
      'updated_at',
      'published_at',
    ],
    rows.cards,
    (row) => [
      sqlString(row.id),
      sqlString(row.owner_id),
      sqlString(row.slug),
      sqlString(row.title),
      sqlNullableString(row.tagline),
      sqlNullableString(row.summary),
      sqlString(row.visibility),
      sqlString(row.rating),
      sqlNullableString(row.avatar_file_id),
      sqlNullableString(row.current_version_id),
      row.like_count,
      row.comment_count,
      row.download_count,
      `${sqlString(row.created_at)}::timestamptz`,
      `${sqlString(row.updated_at)}::timestamptz`,
      row.published_at ? `${sqlString(row.published_at)}::timestamptz` : 'null',
    ],
  );

  const versionsSql = renderInsert(
    'public.card_versions',
    [
      'id',
      'card_id',
      'version_number',
      'source_format',
      'source_app',
      'spec',
      'spec_version',
      'canonical_schema_version',
      'character_name',
      'creator_name',
      'character_version',
      'description',
      'personality',
      'scenario',
      'first_message',
      'example_messages',
      'system_prompt',
      'post_history_instructions',
      'creator_notes',
      'raw_json',
      'canonical_json',
      'import_warnings',
      'created_by',
      'created_at',
    ],
    rows.versions,
    (row) => [
      sqlString(row.id),
      sqlString(row.card_id),
      row.version_number,
      sqlString(row.source_format),
      sqlString(row.source_app),
      sqlNullableString(row.spec),
      sqlNullableString(row.spec_version),
      row.canonical_schema_version,
      sqlString(row.character_name),
      sqlNullableString(row.creator_name),
      sqlNullableString(row.character_version),
      sqlNullableString(row.description),
      sqlNullableString(row.personality),
      sqlNullableString(row.scenario),
      sqlNullableString(row.first_message),
      sqlNullableString(row.example_messages),
      sqlNullableString(row.system_prompt),
      sqlNullableString(row.post_history_instructions),
      sqlNullableString(row.creator_notes),
      sqlJson(row.raw_json),
      sqlJson(row.canonical_json),
      sqlJson(row.import_warnings),
      sqlString(row.created_by),
      `${sqlString(row.created_at)}::timestamptz`,
    ],
  );

  const filesSql = renderInsert(
    'public.card_files',
    [
      'id',
      'card_id',
      'version_id',
      'uploaded_by',
      'role',
      'bucket_id',
      'storage_path',
      'original_filename',
      'mime_type',
      'size_bytes',
      'sha256',
      'metadata',
      'created_at',
    ],
    rows.files,
    (row) => [
      sqlString(row.id),
      sqlString(row.card_id),
      sqlNullableString(row.version_id),
      sqlString(row.uploaded_by),
      sqlString(row.role),
      sqlString(row.bucket_id),
      sqlString(row.storage_path),
      sqlNullableString(row.original_filename),
      sqlNullableString(row.mime_type),
      row.size_bytes ?? 'null',
      sqlNullableString(row.sha256),
      sqlJson(row.metadata),
      `${sqlString(row.created_at)}::timestamptz`,
    ],
  );

  const tagsSql = renderInsert('public.tags', ['id', 'slug', 'name'], rows.tags, (row) => [
    sqlString(row.id),
    sqlString(row.slug),
    sqlString(row.name),
  ]);

  const cardTagsRows = rows.cardTags
    .map((row) => {
      const tag = tagsBySlug.get(row.tag_slug);
      if (!tag) {
        return null;
      }
      return { card_id: row.card_id, tag_id: tag.id };
    })
    .filter(Boolean);

  const cardTagsSql = renderInsert(
    'public.card_tags',
    ['card_id', 'tag_id'],
    cardTagsRows,
    (row) => [sqlString(row.card_id), sqlString(row.tag_id)],
  );

  const currentVersionSql = `
update public.cards c
set current_version_id = v.id
from public.card_versions v
where v.card_id = c.id
  and v.version_number = 1;`;

  const avatarUpdateSql =
    avatarAssignments.length === 0
      ? '-- No avatar assignments generated.'
      : `
update public.cards c
set avatar_file_id = src.file_id::uuid
from (
  values
  ${avatarAssignments
    .map((row) => `(${sqlString(row.card_id)}::uuid, ${sqlString(row.file_id)}::uuid)`)
    .join(',\n  ')}
) as src(card_id, file_id)
where c.id = src.card_id;`;

  return `-- Auto-generated by supabase/seeds/generate-cards-seed.mjs
-- Uses Faker to produce deterministic but realistic card seed data.

begin;

${renderUserInsertSql()}

truncate table public.card_tags, public.card_files, public.card_versions, public.cards, public.tags restart identity cascade;

${tagsSql}

${cardsSql}

${versionsSql}

${filesSql}

${currentVersionSql}

${avatarUpdateSql}

${cardTagsSql}

commit;
`;
}

async function main() {
  const { templates, imageAssets } = await loadExampleAssets();
  const rows = buildSeedRows(templates, imageAssets);
  const sql = buildSeedSql(rows);

  await fs.writeFile(outputSqlPath, sql, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Generated ${SEED_COUNT} seeded cards to ${outputSqlPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
