import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardListItem } from '../../interfaces/card-list-item.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';

@Component({
  selector: 'app-my-cards',
  templateUrl: './my-cards.html',
  styleUrl: './my-cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyCardsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly cardsService = inject(CardService);
  private readonly relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  protected readonly cards = signal<readonly CardListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly uploadStatus = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.loadMyCards();
  }

  protected viewCard(cardId: string): void {
    void this.router.navigate(['/cards', cardId]);
  }

  protected handleUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.uploadStatus.set('');
      return;
    }

    this.uploadStatus.set(`Selected ${file.name}. Upload flow will be wired in the next step.`);
    input.value = '';
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

      const cards = (data ?? []).map((card) => ({
        id: card.id,
        title: card.title,
        visibility: card.visibility,
        updatedAt: this.formatRelativeTime(card.updated_at),
      }));

      this.cards.set(cards);
    } catch (error) {
      this.cards.set([]);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load your cards.');
    } finally {
      this.loading.set(false);
    }
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
