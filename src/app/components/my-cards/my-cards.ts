import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardPreviewCardComponent } from '../card-preview-card/card-preview-card';
import { CardListViewModel } from '../../interfaces/card-list-view-model.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';

@Component({
  selector: 'app-my-cards',
  imports: [CardPreviewCardComponent],
  templateUrl: './my-cards.html',
  styleUrl: './my-cards.css',
})
export class MyCardsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly cardsService = inject(CardService);
  private readonly relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  protected readonly cards = signal<readonly CardListViewModel[]>([]);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly uploadErrorMessage = signal('');

  protected readonly uploadStatus = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.loadMyCards();
  }

  protected viewCard(cardId: string): void {
    void this.router.navigate(['/cards', cardId]);
  }

  protected async handleUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.uploadStatus.set('');
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set('');
    this.uploadErrorMessage.set('');
    this.uploadStatus.set(`Uploading ${file.name}...`);

    try {
      const user = await this.auth.getUser();

      if (!user) {
        throw new Error('Sign in to upload a card.');
      }

      const creatorName = user.user_metadata['user_name'] ?? user.email ?? null;

      const result = await this.cardsService.uploadCardFromFile(user.id, file, creatorName);
      this.uploadStatus.set(`Uploaded ${result.title}.`);
      await this.loadMyCards();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to upload this file.';
      this.uploadErrorMessage.set(message);
      this.uploadStatus.set('');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  private async loadMyCards(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const user = await this.auth.getUser();

      if (!user) {
        this.cards.set([]);
        this.errorMessage.set('Sign in to view your cards.');
        return;
      }

      const { data, error } = await this.cardsService.cardsOwnedByUser(user.id);

      if (error) {
        throw error;
      }

      const imageUrlByCardId = await this.resolveCardImageUrls(data ?? []);

      const cards = (data ?? []).map((card) => ({
        id: card.id,
        name: card.title,
        tagline: `Visibility: ${this.formatVisibility(card.visibility)}`,
        uploader: 'You',
        createdAtIso: card.updated_at,
        createdAgo: `Updated ${this.formatRelativeTime(card.updated_at)}`,
        likeCount: card.like_count ?? 0,
        liked: false,
        commentCount: card.comment_count ?? 0,
        imageUrl: imageUrlByCardId.get(card.id) ?? null,
        tags: [
          {
            slug: card.visibility,
            name: this.formatVisibility(card.visibility),
          },
        ],
      }));

      this.cards.set(cards);
    } catch (error) {
      this.cards.set([]);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load your cards.');
    } finally {
      this.loading.set(false);
    }
  }

  private async resolveCardImageUrls(
    cards: Awaited<ReturnType<CardService['cardsOwnedByUser']>>['data'] extends infer T
      ? NonNullable<T>
      : never,
  ): Promise<Map<string, string>> {
    const entries = await Promise.all(
      cards.map(async (card) => {
        const storagePath = card.avatar_file?.storage_path;

        if (!storagePath) {
          return [card.id, null] as const;
        }

        const { data, error } = await this.cardsService.createCardFileSignedUrl(storagePath, 3600);

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

  private formatVisibility(visibility: 'private' | 'unlisted' | 'public'): string {
    return visibility.charAt(0).toUpperCase() + visibility.slice(1);
  }
}
