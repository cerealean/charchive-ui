import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CardDetailRecord } from '../../interfaces/card-detail-record.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';
import { ProfileService } from '../../services/profile';
import { CardCommentsComponent } from '../card-comments/card-comments';

@Component({
  selector: 'app-card-detail',
  templateUrl: './card-detail.html',
  styleUrl: './card-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, CardCommentsComponent],
})
export class CardDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cardsService = inject(CardService);
  private readonly profiles = inject(ProfileService);
  private readonly auth = inject(AuthService);

  protected readonly card = signal<CardDetailRecord | null>(null);
  protected readonly uploadedBy = signal<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly hasResolved = signal(false);
  protected readonly imageResolved = signal(false);
  protected readonly errorMessage = signal('');

  private readonly currentUserId = signal<string | null>(null);
  protected readonly likeCount = signal(0);
  protected readonly liked = signal(false);
  protected readonly likePending = signal(false);

  protected readonly canLike = computed(() => this.currentUserId() !== null);

  private readonly routeCardId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  protected readonly cardId = computed(() => this.routeCardId());
  protected readonly cardImageUrl = signal<string | null>(null);

  protected readonly cardName = computed(
    () => this.card()?.current_version?.character_name ?? this.card()?.title ?? 'Untitled card',
  );

  protected readonly cardTags = computed(() => {
    const tags = this.card()?.tags ?? [];

    return tags
      .map((entry) => entry.tag)
      .filter((tag): tag is { name: string; slug: string } => tag !== null);
  });

  protected readonly compatibility = computed(() => {
    const sourceFormat = this.card()?.current_version?.source_format;

    if (!sourceFormat) {
      return 'Unknown';
    }

    return sourceFormat.replaceAll('_', ' ').toUpperCase();
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextId = params.get('id') ?? '';
      this.routeCardId.set(nextId);
      void this.loadCard(nextId);
    });

    void this.loadCard(this.routeCardId());
  }

  protected backToMyCards(): void {
    void this.router.navigateByUrl('/my/cards');
  }

  private async loadCard(cardId: string): Promise<void> {
    this.hasResolved.set(false);
    this.imageResolved.set(false);
    this.errorMessage.set('');
    this.likeCount.set(0);
    this.liked.set(false);
    this.likePending.set(false);

    if (!cardId) {
      this.card.set(null);
      this.uploadedBy.set(null);
      this.cardImageUrl.set(null);
      this.errorMessage.set('No card id was provided in the URL.');
      this.hasResolved.set(true);
      this.imageResolved.set(true);
      return;
    }

    try {
      this.loading.set(true);

      const { data: card, error: cardError } = await this.cardsService.cardById(cardId);

      if (cardError) {
        throw cardError;
      }

      if (!card) {
        this.card.set(null);
        this.uploadedBy.set(null);
        this.cardImageUrl.set(null);
        this.errorMessage.set('Card not found or you do not have access to view it.');
        this.imageResolved.set(true);
        return;
      }

      this.card.set(card);
      this.uploadedBy.set(card.current_version?.creator_name ?? 'Unknown');
      this.likeCount.set(card.like_count);

      const imageUrlPromise = this.resolveCardImageUrl(card.avatar_file?.storage_path);

      await this.loadLikeState(card.id);

      const { data: uploaderProfile, error: uploaderError } = await this.profiles.profileById(
        card.owner_id,
      );

      if (uploaderError) {
        throw uploaderError;
      }

      this.uploadedBy.set(
        uploaderProfile?.username ?? card.current_version?.creator_name ?? 'Unknown',
      );
      this.hasResolved.set(true);

      const imageUrl = await imageUrlPromise;
      this.cardImageUrl.set(imageUrl);
      this.imageResolved.set(true);
    } catch (error) {
      this.card.set(null);
      this.uploadedBy.set(null);
      this.cardImageUrl.set(null);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load this card.');
      this.imageResolved.set(true);
    } finally {
      this.loading.set(false);
      if (!this.hasResolved()) {
        this.hasResolved.set(true);
      }
    }
  }

  private async loadLikeState(cardId: string): Promise<void> {
    const user = await this.auth.getUser();
    this.currentUserId.set(user?.id ?? null);

    if (!user) {
      this.liked.set(false);
      return;
    }

    try {
      this.liked.set(await this.cardsService.userLikedCard(cardId, user.id));
    } catch {
      this.liked.set(false);
    }
  }

  protected async toggleLike(): Promise<void> {
    const cardId = this.card()?.id;
    const userId = this.currentUserId();

    if (!cardId || !userId || this.likePending()) {
      return;
    }

    const wasLiked = this.liked();
    this.likePending.set(true);
    this.liked.set(!wasLiked);
    this.likeCount.update((count) => (wasLiked ? Math.max(0, count - 1) : count + 1));

    const { error } = wasLiked
      ? await this.cardsService.unlikeCard(cardId, userId)
      : await this.cardsService.likeCard(cardId, userId);

    if (error) {
      this.liked.set(wasLiked);
      this.likeCount.update((count) => (wasLiked ? count + 1 : Math.max(0, count - 1)));
    }

    this.likePending.set(false);
  }

  protected goToLogin(): void {
    void this.router.navigate(['/login'], {
      queryParams: { redirectTo: `/cards/${this.cardId()}` },
    });
  }

  private async resolveCardImageUrl(storagePath: string | undefined): Promise<string | null> {
    if (!storagePath) {
      return null;
    }

    const { data, error } = await this.cardsService.createCardFileSignedUrl(storagePath, 3600);

    if (error) {
      return null;
    }

    return data?.signedUrl ?? null;
  }
}
