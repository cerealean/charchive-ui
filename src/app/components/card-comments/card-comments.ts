import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CardCommentRecord } from '../../interfaces/card-comment-record.interface';
import { CardCommentViewModel } from '../../interfaces/card-comment-view-model.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';
import { ProfileService } from '../../services/profile';
import { MAX_COMMENT_LENGTH, commentContentValidator } from '../../shared/comment-validation';

@Component({
  selector: 'app-card-comments',
  templateUrl: './card-comments.html',
  styleUrl: './card-comments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class CardCommentsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cardsService = inject(CardService);
  private readonly profiles = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  readonly cardId = input.required<string>();

  protected readonly maxLength = MAX_COMMENT_LENGTH;

  protected readonly comments = signal<readonly CardCommentViewModel[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly postError = signal('');
  protected readonly posting = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly bodyLength = signal(0);
  protected readonly clientError = signal('');

  private readonly currentUserId = signal<string | null>(null);

  protected readonly commentCount = computed(() => this.comments().length);
  protected readonly canComment = computed(() => this.currentUserId() !== null);
  protected readonly remainingChars = computed(() => this.maxLength - this.bodyLength());

  protected readonly form = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(MAX_COMMENT_LENGTH),
      commentContentValidator,
    ],
  });

  constructor() {
    effect(() => {
      const cardId = this.cardId();
      untracked(() => void this.loadComments(cardId));
    });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.bodyLength.set(value.length);
      this.postError.set('');
      this.clientError.set(this.form.dirty ? this.describeControlError() : '');
    });
  }

  protected async submit(): Promise<void> {
    const userId = this.currentUserId();
    const cardId = this.cardId();

    if (!userId || this.posting()) {
      return;
    }

    this.form.markAsDirty();

    if (this.form.invalid) {
      this.clientError.set(this.describeControlError());
      return;
    }

    this.posting.set(true);
    this.postError.set('');

    try {
      const record = await this.cardsService.addComment(cardId, userId, this.form.value);
      this.comments.update((current) => [this.toViewModel(record, 'You', true), ...current]);
      this.form.reset('');
      this.bodyLength.set(0);
      this.clientError.set('');
    } catch (error) {
      this.postError.set(
        error instanceof Error ? error.message : 'Unable to post this comment. Please try again.',
      );
    } finally {
      this.posting.set(false);
    }
  }

  protected async deleteComment(commentId: string): Promise<void> {
    if (this.deletingId()) {
      return;
    }

    this.deletingId.set(commentId);
    this.postError.set('');

    const { error } = await this.cardsService.deleteComment(commentId);

    if (error) {
      this.postError.set('Unable to delete this comment. Please try again.');
    } else {
      this.comments.update((current) => current.filter((comment) => comment.id !== commentId));
    }

    this.deletingId.set(null);
  }

  protected goToLogin(): void {
    void this.router.navigate(['/login'], {
      queryParams: { redirectTo: `/cards/${this.cardId()}` },
    });
  }

  private async loadComments(cardId: string): Promise<void> {
    this.comments.set([]);
    this.loadError.set('');
    this.postError.set('');
    this.form.reset('');
    this.bodyLength.set(0);
    this.clientError.set('');

    if (!cardId) {
      return;
    }

    this.loading.set(true);

    try {
      const user = await this.auth.getUser();
      this.currentUserId.set(user?.id ?? null);

      const { data: comments, error } = await this.cardsService.commentsForCard(cardId);

      if (error) {
        throw error;
      }

      const rows = comments ?? [];
      const usernameById = await this.resolveAuthorNames(rows);

      this.comments.set(
        rows.map((row) =>
          this.toViewModel(
            row,
            usernameById.get(row.author_id) ?? 'Unknown user',
            row.author_id === user?.id,
          ),
        ),
      );
    } catch (error) {
      this.comments.set([]);
      this.loadError.set(
        error instanceof Error ? error.message : 'Unable to load comments for this card.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async resolveAuthorNames(
    rows: readonly CardCommentRecord[],
  ): Promise<Map<string, string>> {
    const authorIds = Array.from(new Set(rows.map((row) => row.author_id)));

    if (authorIds.length === 0) {
      return new Map();
    }

    const { data: profiles, error } = await this.profiles.profilesByIds(authorIds);

    if (error) {
      return new Map();
    }

    return new Map(
      (profiles ?? []).map((profile) => [profile.id, profile.username?.trim() || 'Unknown user']),
    );
  }

  private toViewModel(
    record: CardCommentRecord,
    authorName: string,
    isOwn: boolean,
  ): CardCommentViewModel {
    return {
      id: record.id,
      authorName,
      body: record.body,
      createdAtIso: record.created_at,
      createdAgo: this.formatRelativeTime(record.created_at),
      isOwn,
    };
  }

  private describeControlError(): string {
    const errors = this.form.errors;

    if (!errors) {
      return '';
    }

    if (errors['commentContent']) {
      return errors['commentContent'].message as string;
    }

    if (errors['maxlength']) {
      return `Comments must be ${this.maxLength} characters or fewer.`;
    }

    if (errors['required']) {
      return 'Enter a comment before posting.';
    }

    return '';
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
