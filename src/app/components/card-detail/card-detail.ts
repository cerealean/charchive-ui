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

import { CardDetailRecord, SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-card-detail',
  templateUrl: './card-detail.html',
  styleUrl: './card-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
})
export class CardDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly supabase = inject(SupabaseService);

  protected readonly card = signal<CardDetailRecord | null>(null);
  protected readonly uploadedBy = signal<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly hasResolved = signal(false);
  protected readonly imageResolved = signal(false);
  protected readonly errorMessage = signal('');

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

      const { data: card, error: cardError } = await this.supabase.cardById(cardId);

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

      const imageUrlPromise = this.resolveCardImageUrl(card.avatar_file?.storage_path);

      const { data: uploaderProfile, error: uploaderError } = await this.supabase.profileById(
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

  private async resolveCardImageUrl(storagePath: string | undefined): Promise<string | null> {
    if (!storagePath) {
      return null;
    }

    const { data, error } = await this.supabase.createCardFileSignedUrl(storagePath, 3600);

    if (error) {
      return null;
    }

    return data?.signedUrl ?? null;
  }
}
