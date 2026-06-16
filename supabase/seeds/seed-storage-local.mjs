import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const imagesDir = path.join(repoRoot, 'supabase', 'seeds', 'images');

function runSupabase(args, label) {
  const result = spawnSync('supabase', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    const details = stderr || stdout;
    throw new Error(`${label} failed: ${details}`);
  }

  return result.stdout ?? '';
}

function extractJson(mixedOutput, open, close) {
  const start = mixedOutput.indexOf(open);
  const end = mixedOutput.lastIndexOf(close);

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(mixedOutput.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Resolve the local Storage endpoint and key. Uploading via the Storage REST API
// with the local service_role key works entirely offline; unlike
// `supabase storage cp`, it does not require a cloud access token / login.
function localStorageConfig() {
  const apiUrl = process.env.SUPABASE_API_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (apiUrl && serviceKey) {
    return { apiUrl, serviceKey };
  }

  const status = extractJson(
    runSupabase(['status', '-o', 'json'], 'Read Supabase status'),
    '{',
    '}',
  );

  return {
    apiUrl: apiUrl || status?.API_URL,
    serviceKey: serviceKey || status?.SERVICE_ROLE_KEY,
  };
}

function loadCardFileRows() {
  const output = runSupabase(
    [
      'db',
      'query',
      '--local',
      '--output-format',
      'json',
      "select bucket_id, storage_path, original_filename, mime_type from public.card_files where bucket_id = 'card-files' and original_filename is not null order by created_at;",
    ],
    'Load card file rows',
  );

  return extractJson(output, '[', ']') ?? [];
}

async function uploadFiles(rows, config) {
  let uploaded = 0;
  let skipped = 0;

  for (const row of rows) {
    const {
      original_filename: originalFileName,
      storage_path: storagePath,
      bucket_id: bucketId,
    } = row;

    if (!originalFileName || !storagePath || !bucketId) {
      continue;
    }

    const sourcePath = path.join(imagesDir, originalFileName);

    if (!existsSync(sourcePath)) {
      skipped += 1;
      continue;
    }

    const response = await fetch(`${config.apiUrl}/storage/v1/object/${bucketId}/${storagePath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': row.mime_type || 'application/octet-stream',
        // Overwrite if the object already exists so the script is re-runnable.
        'x-upsert': 'true',
      },
      body: readFileSync(sourcePath),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`Upload ${storagePath} failed: HTTP ${response.status} ${details}`);
    }

    uploaded += 1;
  }

  return { uploaded, skipped };
}

async function main() {
  const config = localStorageConfig();

  if (!config.apiUrl || !config.serviceKey) {
    throw new Error(
      'Could not determine the local Supabase API URL / service role key. Is `supabase start` running?',
    );
  }

  const rows = loadCardFileRows();
  const { uploaded, skipped } = await uploadFiles(rows, config);

  const skippedNote =
    skipped > 0 ? ` (skipped ${skipped} row(s) with no matching source image)` : '';
  console.log(`Seeded storage bucket card-files with ${uploaded} object(s)${skippedNote}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
