import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { CardListRecord, SupabaseService } from '../../services/supabase';

interface CardListViewModel {
  id: string;
  name: string;
  tagline: string;
  uploader: string;
  createdAtIso: string;
  createdAgo: string;
  imageUrl: string | null;
  tags: Array<{
    slug: string;
    name: string;
  }>;
}

@Component({
  selector: 'app-cards',
  templateUrl: './cards.html',
  styleUrl: './cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly cards = signal<readonly CardListViewModel[]>([]);

  protected readonly hasCards = computed(() => this.cards().length > 0);

  async ngOnInit(): Promise<void> {
    await this.loadCards();
  }

  protected openCard(cardId: string): void {
    void this.router.navigate(['/cards', cardId]);
  }

  private async loadCards(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const { data: cards, error: cardsError } = await this.supabase.publicCards(48);

      if (cardsError) {
        throw cardsError;
      }

      const cardRows = cards ?? [];

      if (cardRows.length === 0) {
        this.cards.set([]);
        return;
      }

      const ownerIds = Array.from(new Set(cardRows.map((card) => card.owner_id)));
      const { data: profiles, error: profilesError } = await this.supabase.profilesByIds(ownerIds);

      if (profilesError) {
        throw profilesError;
      }

      const usernameById = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.username?.trim() || 'Unknown uploader',
        ]),
      );

      const imageUrlByCardId = await this.resolveCardImageUrls(cardRows);

      const viewModels: CardListViewModel[] = cardRows.map((card) => {
        const name = card.current_version?.character_name?.trim() || card.title;

        return {
          id: card.id,
          name,
          tagline: card.tagline?.trim() || 'No tagline provided.',
          uploader: usernameById.get(card.owner_id) || 'Unknown uploader',
          createdAtIso: card.created_at,
          createdAgo: this.formatRelativeTime(card.created_at),
          imageUrl: imageUrlByCardId.get(card.id) ?? null,
          tags: card.tags
            .map((tagRecord) => tagRecord.tag)
            .filter((tag): tag is { slug: string; name: string } => tag !== null),
        };
      });

      this.cards.set(viewModels);
    } catch (error) {
      this.cards.set([]);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load cards.');
    } finally {
      this.loading.set(false);
    }
  }

  private async resolveCardImageUrls(
    cards: readonly CardListRecord[],
  ): Promise<Map<string, string>> {
    const entries = await Promise.all(
      cards.map(async (card) => {
        const storagePath = card.avatar_file?.storage_path;

        if (!storagePath) {
          return [card.id, null] as const;
        }

        const { data, error } = await this.supabase.createCardFileSignedUrl(storagePath, 3600);

        if (error) {
          return [card.id, null] as const;
        }

        return [card.id, data?.signedUrl ?? null] as const;
      }),
    );

    return new Map(
      entries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
    );
  }

  private formatRelativeTime(isoDate: string): string {
    const now = Date.now();
    const timestamp = new Date(isoDate).getTime();

    if (Number.isNaN(timestamp)) {
      return 'recently';
    }

    const elapsedMs = timestamp - now;
    const minutes = Math.round(elapsedMs / 60000);
    const hours = Math.round(elapsedMs / 3600000);
    const days = Math.round(elapsedMs / 86400000);
    const weeks = Math.round(elapsedMs / 604800000);
    const months = Math.round(elapsedMs / 2629800000);
    const years = Math.round(elapsedMs / 31557600000);

    if (Math.abs(minutes) < 60) {
      return this.relativeTimeFormatter.format(minutes, 'minute');
    }

    if (Math.abs(hours) < 24) {
      return this.relativeTimeFormatter.format(hours, 'hour');
    }

    if (Math.abs(days) < 7) {
      return this.relativeTimeFormatter.format(days, 'day');
    }

    if (Math.abs(weeks) < 5) {
      return this.relativeTimeFormatter.format(weeks, 'week');
    }

    if (Math.abs(months) < 12) {
      return this.relativeTimeFormatter.format(months, 'month');
    }

    return this.relativeTimeFormatter.format(years, 'year');
  }
}
