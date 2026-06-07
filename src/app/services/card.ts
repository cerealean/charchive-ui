import { Injectable, inject } from '@angular/core';

import { CardDetailRecord } from '../interfaces/card-detail-record.interface';
import { CardListRecord } from '../interfaces/card-list-record.interface';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private readonly supabase = inject(SupabaseService);

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
}
