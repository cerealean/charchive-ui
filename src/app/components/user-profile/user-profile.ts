import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CardListViewModel } from '../../interfaces/card-list-view-model.interface';
import { PublicProfile } from '../../interfaces/public-profile.interface';
import { CardService, ProfileCardRecord } from '../../services/card';
import { ProfileService } from '../../services/profile';
import { formatRelativeTime } from '../../shared/relative-time';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { CardPreviewCardComponent } from '../card-preview-card/card-preview-card';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
  imports: [CardPreviewCardComponent, MarkdownPipe],
})
export class UserProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly profiles = inject(ProfileService);
  private readonly cardsService = inject(CardService);
  private readonly dom = inject(DomSanitizer);

  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly profile = signal<PublicProfile | null>(null);
  protected readonly avatarImageUrl = signal<SafeResourceUrl | null>(null);
  protected readonly cards = signal<readonly CardListViewModel[]>([]);

  private avatarObjectUrl: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      void this.loadProfile(params.get('username') ?? '');
    });

    this.destroyRef.onDestroy(() => this.revokeAvatarObjectUrl());
  }

  protected viewCard(cardId: string): void {
    void this.router.navigate(['/cards', cardId]);
  }

  private async loadProfile(username: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.errorMessage.set('');
    this.profile.set(null);
    this.cards.set([]);
    this.clearAvatar();

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    try {
      const { data: profile, error } = await this.profiles.profileByUsername(trimmedUsername);

      if (error) {
        throw error;
      }

      if (!profile) {
        this.notFound.set(true);
        return;
      }

      this.profile.set(profile);
      void this.loadAvatar(profile.avatar_url);
      await this.loadCards(profile);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to load this profile.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCards(profile: PublicProfile): Promise<void> {
    const { data, error } = await this.cardsService.publicCardsByOwner(profile.id);

    if (error) {
      throw error;
    }

    const records = data ?? [];
    const imageUrlByCardId = await this.resolveCardImageUrls(records);
    const uploader = profile.username?.trim() || 'Unknown uploader';

    this.cards.set(
      records.map((card) => ({
        id: card.id,
        name: card.current_version?.character_name?.trim() || card.title,
        tagline: card.tagline?.trim() || 'No tagline provided.',
        uploader,
        createdAtIso: card.created_at,
        createdAgo: formatRelativeTime(card.created_at),
        likeCount: card.like_count ?? 0,
        liked: false,
        commentCount: card.comment_count ?? 0,
        imageUrl: imageUrlByCardId.get(card.id) ?? null,
        tags: card.tags
          .map((entry) => entry.tag)
          .filter((tag): tag is { name: string; slug: string } => tag !== null)
          .map((tag) => ({ slug: tag.slug, name: tag.name })),
      })),
    );
  }

  private async resolveCardImageUrls(
    cards: readonly ProfileCardRecord[],
  ): Promise<Map<string, string>> {
    const entries = await Promise.all(
      cards.map(async (card) => {
        const storagePath = card.avatar_file?.storage_path;

        if (!storagePath) {
          return [card.id, null] as const;
        }

        const { data, error } = await this.cardsService.createCardFileSignedUrl(storagePath, 3600);

        if (error || !data?.signedUrl) {
          return [card.id, null] as const;
        }

        return [card.id, data.signedUrl] as const;
      }),
    );

    return new Map(
      entries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
    );
  }

  private async loadAvatar(path: string | null): Promise<void> {
    if (!path) {
      this.clearAvatar();
      return;
    }

    try {
      const { data } = await this.profiles.downloadImage(path);

      if (data instanceof Blob) {
        this.revokeAvatarObjectUrl();
        this.avatarObjectUrl = URL.createObjectURL(data);
        this.avatarImageUrl.set(this.dom.bypassSecurityTrustResourceUrl(this.avatarObjectUrl));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error downloading avatar: ', error.message);
      }
    }
  }

  private clearAvatar(): void {
    this.revokeAvatarObjectUrl();
    this.avatarImageUrl.set(null);
  }

  private revokeAvatarObjectUrl(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }
}
