import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

import { CardPreviewCardComponent } from '../card-preview-card/card-preview-card';
import { CardListRecord } from '../../interfaces/card-list-record.interface';
import { CardListViewModel } from '../../interfaces/card-list-view-model.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';
import { ProfileService } from '../../services/profile';

const PAGE_SIZE_STORAGE_KEY = 'cards.pageSize';
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
const MAX_VISIBLE_PAGE_BUTTONS = 7;

@Component({
  selector: 'app-cards',
  imports: [CardPreviewCardComponent],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsComponent implements OnInit, AfterViewInit {
  private readonly cardsService = inject(CardService);
  private readonly profiles = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly cards = signal<readonly CardListViewModel[]>([]);
  protected readonly pageSize = signal<number>(DEFAULT_PAGE_SIZE);
  protected readonly currentPage = signal(1);
  protected readonly totalCards = signal(0);
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly hasCards = computed(() => this.cards().length > 0);
  protected readonly totalPages = computed(() => {
    const total = this.totalCards();

    if (total === 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(total / this.pageSize()));
  });
  protected readonly canGoPrevious = computed(() => this.currentPage() > 1);
  protected readonly canGoNext = computed(() => this.currentPage() < this.totalPages());
  protected readonly visiblePageNumbers = computed(() => {
    const totalPages = this.totalPages();

    if (totalPages <= MAX_VISIBLE_PAGE_BUTTONS) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const currentPage = this.currentPage();
    const halfWindow = Math.floor(MAX_VISIBLE_PAGE_BUTTONS / 2);

    let startPage = Math.max(1, currentPage - halfWindow);
    let endPage = startPage + MAX_VISIBLE_PAGE_BUTTONS - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = endPage - MAX_VISIBLE_PAGE_BUTTONS + 1;
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  });

  async ngOnInit(): Promise<void> {
    this.initializePageSizePreference();
    await this.loadCards();
  }

  ngAfterViewInit(): void {
    void this.syncPageSizePreferenceFromBrowser();
  }

  protected openCard(cardId: string): void {
    void this.router.navigate(['/cards', cardId]);
  }

  protected async onPageSizeChanged(event: Event): Promise<void> {
    const selectElement = event.target;

    if (!(selectElement instanceof HTMLSelectElement)) {
      return;
    }

    const parsedPageSize = Number.parseInt(selectElement.value, 10);

    if (!PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])) {
      return;
    }

    this.pageSize.set(parsedPageSize);
    this.currentPage.set(1);
    this.persistPageSizePreference(parsedPageSize);
    await this.loadCards();
  }

  protected async goToPreviousPage(): Promise<void> {
    if (!this.canGoPrevious()) {
      return;
    }

    this.currentPage.update((value) => value - 1);
    await this.loadCards();
  }

  protected async goToNextPage(): Promise<void> {
    if (!this.canGoNext()) {
      return;
    }

    this.currentPage.update((value) => value + 1);
    await this.loadCards();
  }

  protected async goToPage(pageNumber: number): Promise<void> {
    if (pageNumber === this.currentPage()) {
      return;
    }

    if (pageNumber < 1 || pageNumber > this.totalPages()) {
      return;
    }

    this.currentPage.set(pageNumber);
    await this.loadCards();
  }

  private async loadCards(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const {
        data: cards,
        error: cardsError,
        count,
      } = await this.cardsService.publicCardsPage(this.currentPage(), this.pageSize());

      if (cardsError) {
        throw cardsError;
      }

      const totalCount = count ?? 0;
      this.totalCards.set(totalCount);

      const totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize()));

      if (totalCount > 0 && this.currentPage() > totalPages) {
        this.currentPage.set(totalPages);
        await this.loadCards();
        return;
      }

      const cardRows = cards ?? [];

      if (cardRows.length === 0) {
        this.cards.set([]);
        return;
      }

      const ownerIds = Array.from(new Set(cardRows.map((card) => card.owner_id)));
      const { data: profiles, error: profilesError } = await this.profiles.profilesByIds(ownerIds);

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
      const likedCardIds = await this.resolveLikedCardIds(cardRows);

      const viewModels: CardListViewModel[] = cardRows.map((card) => {
        const name = card.current_version?.character_name?.trim() || card.title;

        return {
          id: card.id,
          name,
          tagline: card.tagline?.trim() || 'No tagline provided.',
          uploader: usernameById.get(card.owner_id) || 'Unknown uploader',
          createdAtIso: card.created_at,
          createdAgo: this.formatRelativeTime(card.created_at),
          likeCount: card.like_count ?? 0,
          liked: likedCardIds.has(card.id),
          commentCount: card.comment_count ?? 0,
          imageUrl: imageUrlByCardId.get(card.id) ?? null,
          tags: card.tags
            .map((tagRecord) => tagRecord.tag)
            .filter((tag): tag is { slug: string; name: string } => tag !== null),
        };
      });

      this.cards.set(viewModels);
    } catch (error) {
      this.cards.set([]);
      this.totalCards.set(0);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load cards.');
    } finally {
      this.loading.set(false);
    }
  }

  private initializePageSizePreference(): void {
    const savedPageSize = this.readSavedPageSizePreference();

    if (savedPageSize !== null) {
      this.pageSize.set(savedPageSize);
    }
  }

  private async syncPageSizePreferenceFromBrowser(): Promise<void> {
    const savedPageSize = this.readSavedPageSizePreference();

    if (savedPageSize === null || savedPageSize === this.pageSize()) {
      return;
    }

    this.pageSize.set(savedPageSize);
    this.currentPage.set(1);
    await this.loadCards();
  }

  private readSavedPageSizePreference(): number | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const savedPageSize = globalThis.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);

      if (savedPageSize === null) {
        return null;
      }

      const parsedPageSize = Number.parseInt(savedPageSize, 10);

      if (PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])) {
        return parsedPageSize;
      }

      return null;
    } catch {
      // Ignore storage errors and keep default page size.
      return null;
    }
  }

  private persistPageSizePreference(pageSize: number): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      globalThis.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    } catch {
      // Ignore storage errors; pagination still works for this session.
    }
  }

  private async resolveLikedCardIds(cards: readonly CardListRecord[]): Promise<Set<string>> {
    const user = await this.auth.getUser();

    if (!user || cards.length === 0) {
      return new Set();
    }

    try {
      return await this.cardsService.likedCardIds(
        cards.map((card) => card.id),
        user.id,
      );
    } catch {
      return new Set();
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
}
