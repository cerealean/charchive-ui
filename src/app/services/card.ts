import { Injectable, inject } from '@angular/core';

import { CardDetailRecord } from '../interfaces/card-detail-record.interface';
import { CardListRecord } from '../interfaces/card-list-record.interface';
import { SupabaseService } from './supabase';

interface OwnedCardListRecord {
  id: string;
  title: string;
  visibility: 'private' | 'unlisted' | 'public';
  updated_at: string;
}

interface UploadedCardRecord {
  id: string;
}

interface UploadedCardVersionRecord {
  id: string;
}

interface UploadedCardFileRecord {
  id: string;
}

interface ParsedUploadPayload {
  title: string;
  characterName: string;
  creatorNotes: string | null;
  sourceFormat: 'chara_card_v2' | 'unknown';
  sourceApp: 'chub' | 'sillytavern' | 'novelai' | 'unknown';
  spec: string | null;
  specVersion: string | null;
  rawJson: Record<string, unknown>;
  canonicalJson: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private readonly supabase = inject(SupabaseService);

  cardsOwnedByUser(ownerId: string) {
    return this.supabase.client
      .from('cards')
      .select(
        `
          id,
          title,
          visibility,
          updated_at
        `,
      )
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
      .returns<OwnedCardListRecord[]>();
  }

  cardById(cardId: string) {
    return this.supabase.client
      .from('cards')
      .select(
        `
          id,
          owner_id,
          title,
          created_at,
          current_version:card_versions!cards_current_version_id_fkey(
            character_name,
            creator_name,
            creator_notes,
            source_format
          ),
          avatar_file:card_files!cards_avatar_file_id_fkey(
            storage_path
          ),
          tags:card_tags(
            tag:tags(
              name,
              slug
            )
          )
        `,
      )
      .eq('id', cardId)
      .maybeSingle<CardDetailRecord>();
  }

  publicCardsPage(page: number, pageSize: number) {
    const safePage = Math.max(1, Math.trunc(page));
    const safePageSize = Math.max(1, Math.trunc(pageSize));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    return this.supabase.client
      .from('cards')
      .select(
        `
          id,
          owner_id,
          title,
          tagline,
          created_at,
          current_version:card_versions!cards_current_version_id_fkey(
            character_name
          ),
          avatar_file:card_files!cards_avatar_file_id_fkey(
            storage_path
          ),
          tags:card_tags(
            tag:tags(
              name,
              slug
            )
          )
        `,
        { count: 'exact' },
      )
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<CardListRecord[]>();
  }

  async createCardFileSignedUrl(path: string, expiresInSeconds = 3600) {
    const storage = this.supabase.client.storage.from('card-files');
    const candidates = this.buildCardFilePathCandidates(path);
    type SignedUrlResult = Awaited<ReturnType<typeof storage.createSignedUrl>>;
    let lastResult: SignedUrlResult | null = null;

    for (const candidate of candidates) {
      const result = await storage.createSignedUrl(candidate, expiresInSeconds);

      if (!result.error && result.data?.signedUrl) {
        return result;
      }

      lastResult = result;
    }

    return (
      lastResult ?? storage.createSignedUrl(this.normalizeCardFilePath(path), expiresInSeconds)
    );
  }

  async uploadCardFromFile(ownerId: string, file: File, creatorName?: string | null) {
    const parsed = await this.parseUploadPayload(file);
    const slug = this.generateCardSlug(parsed.title);
    let cardId: string | null = null;
    let uploadedStoragePath: string | null = null;

    try {
      const { data: createdCard, error: cardInsertError } = await this.supabase.client
        .from('cards')
        .insert({
          owner_id: ownerId,
          slug,
          title: parsed.title,
        })
        .select('id')
        .single<UploadedCardRecord>();

      if (cardInsertError) {
        throw cardInsertError;
      }

      cardId = createdCard.id;

      const { data: createdVersion, error: versionInsertError } = await this.supabase.client
        .from('card_versions')
        .insert({
          card_id: cardId,
          version_number: 1,
          source_format: parsed.sourceFormat,
          source_app: parsed.sourceApp,
          spec: parsed.spec,
          spec_version: parsed.specVersion,
          character_name: parsed.characterName,
          creator_name: creatorName ?? null,
          creator_notes: parsed.creatorNotes,
          raw_json: parsed.rawJson,
          canonical_json: parsed.canonicalJson,
          created_by: ownerId,
        })
        .select('id')
        .single<UploadedCardVersionRecord>();

      if (versionInsertError) {
        throw versionInsertError;
      }

      const versionId = createdVersion.id;
      const extension = this.getFileExtension(file);
      const storagePath = `cards/${ownerId}/${cardId}/original/${versionId}.${extension}`;
      uploadedStoragePath = storagePath;

      const { error: uploadError } = await this.supabase.client.storage
        .from('card-files')
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: createdFile, error: fileInsertError } = await this.supabase.client
        .from('card_files')
        .insert({
          card_id: cardId,
          version_id: versionId,
          uploaded_by: ownerId,
          role: 'original_upload',
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select('id')
        .single<UploadedCardFileRecord>();

      if (fileInsertError) {
        throw fileInsertError;
      }

      const cardUpdate: {
        current_version_id: string;
        updated_at: string;
        avatar_file_id?: string;
      } = {
        current_version_id: versionId,
        updated_at: new Date().toISOString(),
      };

      if (file.type.startsWith('image/')) {
        cardUpdate.avatar_file_id = createdFile.id;
      }

      const { error: cardUpdateError } = await this.supabase.client
        .from('cards')
        .update(cardUpdate)
        .eq('id', cardId);

      if (cardUpdateError) {
        throw cardUpdateError;
      }

      return {
        cardId,
        title: parsed.title,
      };
    } catch (error) {
      await this.rollbackCardUpload(cardId, uploadedStoragePath);
      throw error;
    }
  }

  private normalizeCardFilePath(path: string): string {
    const trimmed = path.trim().replace(/^\/+/, '');

    if (trimmed.startsWith('card-files/')) {
      return trimmed.slice('card-files/'.length);
    }

    return trimmed;
  }

  private buildCardFilePathCandidates(path: string): string[] {
    const normalized = this.normalizeCardFilePath(path);
    const withoutCardsPrefix = normalized.startsWith('cards/')
      ? normalized.slice('cards/'.length)
      : normalized;
    const withCardsPrefix = normalized.startsWith('cards/') ? normalized : `cards/${normalized}`;

    return Array.from(new Set([normalized, withoutCardsPrefix, withCardsPrefix]));
  }

  private async rollbackCardUpload(
    cardId: string | null,
    storagePath: string | null,
  ): Promise<void> {
    if (storagePath) {
      await this.supabase.client.storage.from('card-files').remove([storagePath]);
    }

    if (cardId) {
      await this.supabase.client.from('cards').delete().eq('id', cardId);
    }
  }

  private async parseUploadPayload(file: File): Promise<ParsedUploadPayload> {
    if (this.isJsonFile(file)) {
      return this.parseJsonUpload(file);
    }

    if (this.isPngFile(file)) {
      const pngPayload = await this.parsePngUpload(file);

      if (pngPayload) {
        return pngPayload;
      }
    }

    if (file.type.startsWith('image/')) {
      return this.parseImageUpload(file);
    }

    throw new Error('Only JSON and image uploads are currently supported.');
  }

  private async parseJsonUpload(file: File): Promise<ParsedUploadPayload> {
    let payload: unknown;

    try {
      payload = JSON.parse(await file.text()) as unknown;
    } catch {
      throw new Error('The selected JSON file is not valid JSON.');
    }

    const payloadRecord = this.asRecord(payload);

    if (!payloadRecord) {
      throw new Error('The selected JSON file must contain a JSON object at the root.');
    }

    return this.buildParsedPayloadFromRecord(payloadRecord, this.fileBaseName(file.name));
  }

  private async parsePngUpload(file: File): Promise<ParsedUploadPayload | null> {
    const payloadRecords = await this.extractPngCharacterPayloads(file);

    if (payloadRecords.length === 0) {
      return null;
    }

    const preferredPayload =
      payloadRecords.find((record) => this.detectSourceFormat(record) === 'chara_card_v2') ??
      payloadRecords[0];

    return this.buildParsedPayloadFromRecord(preferredPayload, this.fileBaseName(file.name));
  }

  private buildParsedPayloadFromRecord(
    payloadRecord: Record<string, unknown>,
    fallbackCharacterName: string,
  ): ParsedUploadPayload {
    const dataRecord = this.asRecord(payloadRecord['data']);
    const characterName =
      this.readTrimmedString(dataRecord?.['name']) ??
      this.readTrimmedString(payloadRecord['character_name']) ??
      fallbackCharacterName;

    const title = characterName;
    const creatorNotes =
      this.readTrimmedString(dataRecord?.['creator_notes']) ??
      this.readTrimmedString(payloadRecord['creator_notes']) ??
      null;

    const sourceFormat = this.detectSourceFormat(payloadRecord);
    const sourceApp = this.detectSourceApp(payloadRecord);
    const spec = this.readTrimmedString(payloadRecord['spec']) ?? null;
    const specVersion = this.readTrimmedString(payloadRecord['spec_version']) ?? null;

    return {
      title,
      characterName,
      creatorNotes,
      sourceFormat,
      sourceApp,
      spec,
      specVersion,
      rawJson: payloadRecord,
      canonicalJson: this.buildCanonicalJson(payloadRecord, characterName, creatorNotes, sourceApp),
    };
  }

  private async extractPngCharacterPayloads(file: File): Promise<Record<string, unknown>[]> {
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!this.hasPngSignature(bytes)) {
      return [];
    }

    const payloads: Record<string, unknown>[] = [];
    let offset = 8;

    while (offset + 12 <= bytes.length) {
      const length = this.readUint32BigEndian(bytes, offset);
      const type = this.readAscii(bytes, offset + 4, 4);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;

      if (dataEnd + 4 > bytes.length) {
        break;
      }

      if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
        const textEntries = await this.extractPngTextEntries(
          type,
          bytes.subarray(dataStart, dataEnd),
        );

        for (const entry of textEntries) {
          if (entry.keyword.toLowerCase() !== 'chara') {
            continue;
          }

          const decodedPayload = this.decodeEmbeddedCardPayload(entry.value);

          if (decodedPayload) {
            payloads.push(decodedPayload);
          }
        }
      }

      offset = dataEnd + 4;

      if (type === 'IEND') {
        break;
      }
    }

    return payloads;
  }

  private hasPngSignature(bytes: Uint8Array): boolean {
    const expected = [137, 80, 78, 71, 13, 10, 26, 10];

    if (bytes.length < expected.length) {
      return false;
    }

    return expected.every((value, index) => bytes[index] === value);
  }

  private readUint32BigEndian(bytes: Uint8Array, offset: number): number {
    return (
      ((bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]) >>>
      0
    );
  }

  private readAscii(bytes: Uint8Array, start: number, length: number): string {
    let output = '';

    for (let index = 0; index < length; index += 1) {
      output += String.fromCharCode(bytes[start + index]);
    }

    return output;
  }

  private async extractPngTextEntries(
    chunkType: 'tEXt' | 'iTXt' | 'zTXt',
    chunkData: Uint8Array,
  ): Promise<Array<{ keyword: string; value: string }>> {
    if (chunkType === 'tEXt') {
      const separator = chunkData.indexOf(0);

      if (separator <= 0) {
        return [];
      }

      return [
        {
          keyword: this.decodeLatin1(chunkData.subarray(0, separator)),
          value: this.decodeLatin1(chunkData.subarray(separator + 1)),
        },
      ];
    }

    if (chunkType === 'zTXt') {
      const separator = chunkData.indexOf(0);

      if (separator <= 0 || separator + 2 > chunkData.length) {
        return [];
      }

      const keyword = this.decodeLatin1(chunkData.subarray(0, separator));
      const compressionMethod = chunkData[separator + 1];

      if (compressionMethod !== 0) {
        return [];
      }

      const compressed = chunkData.subarray(separator + 2);
      const value = await this.inflateToUtf8(compressed);

      if (value === null) {
        return [];
      }

      return [{ keyword, value }];
    }

    let cursor = chunkData.indexOf(0);

    if (cursor <= 0 || cursor + 5 > chunkData.length) {
      return [];
    }

    const keyword = this.decodeLatin1(chunkData.subarray(0, cursor));
    const compressionFlag = chunkData[cursor + 1];
    const compressionMethod = chunkData[cursor + 2];
    cursor += 3;

    const languageEnd = chunkData.indexOf(0, cursor);

    if (languageEnd < 0) {
      return [];
    }

    cursor = languageEnd + 1;

    const translatedEnd = chunkData.indexOf(0, cursor);

    if (translatedEnd < 0) {
      return [];
    }

    cursor = translatedEnd + 1;
    const remaining = chunkData.subarray(cursor);

    if (compressionFlag === 0) {
      return [{ keyword, value: this.decodeUtf8(remaining) }];
    }

    if (compressionFlag === 1 && compressionMethod === 0) {
      const value = await this.inflateToUtf8(remaining);

      if (value !== null) {
        return [{ keyword, value }];
      }
    }

    return [];
  }

  private decodeEmbeddedCardPayload(value: string): Record<string, unknown> | null {
    const candidates = [value.trim()];
    const base64Decoded = this.decodeBase64Utf8(value.trim());

    if (base64Decoded) {
      candidates.push(base64Decoded);
    }

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        const parsed = JSON.parse(candidate) as unknown;
        const asObject = this.asRecord(parsed);

        if (asObject) {
          return asObject;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private decodeBase64Utf8(value: string): string | null {
    const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');

    if (!normalized) {
      return null;
    }

    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    try {
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return this.decodeUtf8(bytes);
    } catch {
      return null;
    }
  }

  private decodeLatin1(bytes: Uint8Array): string {
    let output = '';

    for (const value of bytes) {
      output += String.fromCharCode(value);
    }

    return output;
  }

  private decodeUtf8(bytes: Uint8Array): string {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  private async inflateToUtf8(compressedBytes: Uint8Array): Promise<string | null> {
    if (typeof DecompressionStream === 'undefined') {
      return null;
    }

    try {
      const copied = new Uint8Array(compressedBytes.byteLength);
      copied.set(compressedBytes);
      const stream = new Blob([copied.buffer])
        .stream()
        .pipeThrough(new DecompressionStream('deflate'));
      const decompressedBuffer = await new Response(stream).arrayBuffer();
      return this.decodeUtf8(new Uint8Array(decompressedBuffer));
    } catch {
      return null;
    }
  }

  private parseImageUpload(file: File): ParsedUploadPayload {
    const baseName = this.fileBaseName(file.name);
    const uploadedAt = new Date().toISOString();

    return {
      title: baseName,
      characterName: baseName,
      creatorNotes: null,
      sourceFormat: 'unknown',
      sourceApp: 'unknown',
      spec: null,
      specVersion: null,
      rawJson: {
        upload: {
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_at: uploadedAt,
        },
      },
      canonicalJson: {
        schema: 'charchive_card',
        schema_version: 1,
        character: {
          name: baseName,
          description: '',
          personality: '',
          scenario: '',
          first_message: '',
          alternate_greetings: [],
          example_messages: '',
          system_prompt: '',
          post_history_instructions: '',
          creator_notes: '',
        },
        creator: {
          name: '',
          notes: '',
        },
        tags: [],
        character_book: null,
        extensions: {},
        source: {
          format: 'unknown',
          app: 'unknown',
          spec: null,
          spec_version: null,
        },
      },
    };
  }

  private buildCanonicalJson(
    rawPayload: Record<string, unknown>,
    characterName: string,
    creatorNotes: string | null,
    sourceApp: 'chub' | 'sillytavern' | 'novelai' | 'unknown',
  ): Record<string, unknown> {
    const dataRecord = this.asRecord(rawPayload['data']);

    return {
      schema: 'charchive_card',
      schema_version: 1,
      character: {
        name: characterName,
        description: this.readTrimmedString(dataRecord?.['description']) ?? '',
        personality: this.readTrimmedString(dataRecord?.['personality']) ?? '',
        scenario: this.readTrimmedString(dataRecord?.['scenario']) ?? '',
        first_message: this.readTrimmedString(dataRecord?.['first_mes']) ?? '',
        alternate_greetings: this.readStringArray(dataRecord?.['alternate_greetings']),
        example_messages: this.readTrimmedString(dataRecord?.['mes_example']) ?? '',
        system_prompt: this.readTrimmedString(dataRecord?.['system_prompt']) ?? '',
        post_history_instructions:
          this.readTrimmedString(dataRecord?.['post_history_instructions']) ?? '',
        creator_notes: creatorNotes ?? '',
      },
      creator: {
        name: this.readTrimmedString(dataRecord?.['creator']) ?? '',
        notes: creatorNotes ?? '',
      },
      tags: [],
      character_book: null,
      extensions: this.asRecord(dataRecord?.['extensions']) ?? {},
      source: {
        format: this.detectSourceFormat(rawPayload),
        app: sourceApp,
        spec: this.readTrimmedString(rawPayload['spec']) ?? null,
        spec_version: this.readTrimmedString(rawPayload['spec_version']) ?? null,
      },
    };
  }

  private detectSourceFormat(payload: Record<string, unknown>): 'chara_card_v2' | 'unknown' {
    const spec = this.readTrimmedString(payload['spec']);
    const hasDataNode = this.asRecord(payload['data']) !== null;

    if (spec === 'chara_card_v2' || hasDataNode) {
      return 'chara_card_v2';
    }

    return 'unknown';
  }

  private detectSourceApp(
    payload: Record<string, unknown>,
  ): 'chub' | 'sillytavern' | 'novelai' | 'unknown' {
    const extensions = this.asRecord(this.asRecord(payload['data'])?.['extensions']);

    if (extensions && this.asRecord(extensions['chub'])) {
      return 'chub';
    }

    return 'unknown';
  }

  private generateCardSlug(title: string): string {
    const base = this.slugify(title);
    const suffix = crypto.randomUUID().slice(0, 8);
    return `${base}-${suffix}`;
  }

  private slugify(value: string): string {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'card';
  }

  private fileBaseName(filename: string): string {
    const sanitized = filename.trim();

    if (!sanitized) {
      return 'Untitled card';
    }

    const dotIndex = sanitized.lastIndexOf('.');
    const withoutExtension = dotIndex > 0 ? sanitized.slice(0, dotIndex) : sanitized;
    const collapsed = withoutExtension.replace(/[_-]+/g, ' ').trim();

    return collapsed || 'Untitled card';
  }

  private isJsonFile(file: File): boolean {
    if (file.type === 'application/json') {
      return true;
    }

    return file.name.toLowerCase().endsWith('.json');
  }

  private isPngFile(file: File): boolean {
    if (file.type === 'image/png') {
      return true;
    }

    return file.name.toLowerCase().endsWith('.png');
  }

  private getFileExtension(file: File): string {
    const fromName = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];

    if (fromName) {
      return fromName;
    }

    if (file.type === 'application/json') {
      return 'json';
    }

    if (file.type === 'image/png') {
      return 'png';
    }

    if (file.type === 'image/jpeg') {
      return 'jpg';
    }

    if (file.type === 'image/webp') {
      return 'webp';
    }

    if (file.type === 'image/gif') {
      return 'gif';
    }

    return 'bin';
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
}
