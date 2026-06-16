import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

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

function extractJsonArray(mixedOutput) {
  const start = mixedOutput.indexOf('[');
  const end = mixedOutput.lastIndexOf(']');

  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const candidate = mixedOutput.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCardFileRows() {
  const output = runSupabase(
    [
      'db',
      'query',
      '--local',
      '--output-format',
      'json',
      "select bucket_id, storage_path, original_filename from public.card_files where bucket_id = 'card-files' and mime_type = 'image/png' and original_filename is not null order by created_at;",
    ],
    'Load card file rows',
  );

  return extractJsonArray(output);
}

function uploadFiles(rows) {
  let uploaded = 0;

  for (const row of rows) {
    const originalFileName = row.original_filename;
    const storagePath = row.storage_path;
    const bucketId = row.bucket_id;

    if (!originalFileName || !storagePath || !bucketId) {
      continue;
    }

    const sourcePath = path.join(imagesDir, originalFileName);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const relativeSourcePath = path.relative(repoRoot, sourcePath).split(path.sep).join('/');

    runSupabase(
      [
        '--experimental',
        'storage',
        'cp',
        '--local',
        '--content-type',
        'image/png',
        relativeSourcePath,
        `ss:///${bucketId}/${storagePath}`,
      ],
      `Upload ${originalFileName}`,
    );
    uploaded += 1;
  }

  return uploaded;
}

function main() {
  const rows = loadCardFileRows();
  const uploaded = uploadFiles(rows);
  console.log(`Seeded storage bucket card-files with ${uploaded} object(s).`);
}

main();
