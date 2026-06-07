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

    const dataRecord = this.asRecord(payloadRecord['data']);
    const characterName =
      this.readTrimmedString(dataRecord?.['name']) ??
      this.readTrimmedString(payloadRecord['character_name']) ??
      this.fileBaseName(file.name);

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
