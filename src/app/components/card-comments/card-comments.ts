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
import { NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CardCommentRecord } from '../../interfaces/card-comment-record.interface';
import { CardCommentViewModel } from '../../interfaces/card-comment-view-model.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';
import { ProfileService } from '../../services/profile';
import { MAX_COMMENT_LENGTH, commentContentValidator } from '../../shared/comment-validation';

type CommentNode = CardCommentViewModel & { canReply: boolean; children: CommentNode[] };

@Component({
  selector: 'app-card-comments',
  templateUrl: './card-comments.html',
  styleUrl: './card-comments.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgTemplateOutlet],
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
  protected readonly maxReplyDepth = 6;

  protected readonly comments = signal<readonly CardCommentViewModel[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly postError = signal('');
  protected readonly posting = signal(false);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly bodyLength = signal(0);
  protected readonly clientError = signal('');

  protected readonly editingId = signal<string | null>(null);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal('');

  protected readonly replyingToId = signal<string | null>(null);
  protected readonly replySaving = signal(false);
  protected readonly replyError = signal('');

  private readonly currentUserId = signal<string | null>(null);
  private readonly currentUserAvatarUrl = signal<string | null>(null);
  private avatarObjectUrls: string[] = [];

  protected readonly commentCount = computed(() => this.comments().length);
  protected readonly canComment = computed(() => this.currentUserId() !== null);
  protected readonly remainingChars = computed(() => this.maxLength - this.bodyLength());

  // Builds the comment tree: top-level comments newest first, replies oldest first
  // beneath their parent. `canReply` depends on the current user and depth, so it
  // is derived here where the signal is read.
  protected readonly thread = computed<CommentNode[]>(() => {
    const loggedIn = this.currentUserId() !== null;
    const childrenByParent = new Map<string | null, CardCommentViewModel[]>();

    for (const comment of this.comments()) {
      const siblings = childrenByParent.get(comment.parentId) ?? [];
      siblings.push(comment);
      childrenByParent.set(comment.parentId, siblings);
    }

    const build = (parentId: string | null, newestFirst: boolean): CommentNode[] =>
      [...(childrenByParent.get(parentId) ?? [])]
        .sort((a, b) =>
          newestFirst
            ? b.createdAtIso.localeCompare(a.createdAtIso)
            : a.createdAtIso.localeCompare(b.createdAtIso),
        )
        .map((comment) => ({
          ...comment,
          canReply: loggedIn && comment.depth < this.maxReplyDepth,
          children: build(comment.id, false),
        }));

    return build(null, true);
  });

  protected readonly body = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(MAX_COMMENT_LENGTH),
      commentContentValidator,
    ],
  });

  protected readonly form = new FormGroup({ body: this.body });

  protected readonly editBody = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(MAX_COMMENT_LENGTH),
      commentContentValidator,
    ],
  });

  protected readonly editForm = new FormGroup({ body: this.editBody });

  protected readonly replyBody = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(MAX_COMMENT_LENGTH),
      commentContentValidator,
    ],
  });

  protected readonly replyForm = new FormGroup({ body: this.replyBody });

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeAvatarObjectUrls());

    effect(() => {
      const cardId = this.cardId();
      untracked(() => void this.loadComments(cardId));
    });

    this.body.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.bodyLength.set(value.length);
      this.postError.set('');
      this.clientError.set(this.body.dirty ? this.describeControlError(this.body) : '');
    });

    this.editBody.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.editError.set(this.editBody.dirty ? this.describeControlError(this.editBody) : '');
    });

    this.replyBody.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.replyError.set(this.replyBody.dirty ? this.describeControlError(this.replyBody) : '');
    });
  }

  protected async submit(): Promise<void> {
    const userId = this.currentUserId();
    const cardId = this.cardId();

    if (!userId || this.posting()) {
      return;
    }

    this.body.markAsDirty();

    if (this.form.invalid) {
      this.clientError.set(this.describeControlError(this.body));
      return;
    }

    this.posting.set(true);
    this.postError.set('');

    try {
      const record = await this.cardsService.addComment(cardId, userId, this.body.value);
      this.comments.update((current) => [
        ...current,
        this.toViewModel(record, 'You', this.currentUserAvatarUrl(), true),
      ]);
      this.form.reset();
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
      // The database cascades the delete to replies; mirror that in the UI so the
      // count and thread stay accurate.
      const removed = this.collectCommentAndDescendantIds(commentId);
      this.comments.update((current) => current.filter((comment) => !removed.has(comment.id)));

      if (this.replyingToId() && removed.has(this.replyingToId() as string)) {
        this.cancelReply();
      }
    }

    this.deletingId.set(null);
  }

  protected startReply(comment: CardCommentViewModel): void {
    this.replyingToId.set(comment.id);
    this.replyError.set('');
    this.replyBody.reset('');
  }

  protected cancelReply(): void {
    this.replyingToId.set(null);
    this.replyError.set('');
    this.replyBody.reset('');
  }

  protected async submitReply(parent: CardCommentViewModel): Promise<void> {
    const userId = this.currentUserId();
    const cardId = this.cardId();

    if (!userId || this.replySaving()) {
      return;
    }

    this.replyBody.markAsDirty();

    if (this.replyForm.invalid) {
      this.replyError.set(this.describeControlError(this.replyBody));
      return;
    }

    this.replySaving.set(true);
    this.replyError.set('');

    try {
      const record = await this.cardsService.addComment(
        cardId,
        userId,
        this.replyBody.value,
        parent.id,
      );
      this.comments.update((current) => [
        ...current,
        this.toViewModel(record, 'You', this.currentUserAvatarUrl(), true),
      ]);
      this.cancelReply();
    } catch (error) {
      this.replyError.set(
        error instanceof Error ? error.message : 'Unable to post your reply. Please try again.',
      );
    } finally {
      this.replySaving.set(false);
    }
  }

  private collectCommentAndDescendantIds(rootId: string): Set<string> {
    const childrenByParent = new Map<string | null, string[]>();

    for (const comment of this.comments()) {
      const siblings = childrenByParent.get(comment.parentId) ?? [];
      siblings.push(comment.id);
      childrenByParent.set(comment.parentId, siblings);
    }

    const removed = new Set<string>();
    const stack = [rootId];

    while (stack.length > 0) {
      const id = stack.pop() as string;

      if (removed.has(id)) {
        continue;
      }

      removed.add(id);
      stack.push(...(childrenByParent.get(id) ?? []));
    }

    return removed;
  }

  protected startEdit(comment: CardCommentViewModel): void {
    this.editingId.set(comment.id);
    this.editError.set('');
    this.editBody.reset(comment.body);
    this.editBody.markAsPristine();
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set('');
    this.editBody.reset('');
  }

  protected async saveEdit(comment: CardCommentViewModel): Promise<void> {
    if (this.editSaving()) {
      return;
    }

    this.editBody.markAsDirty();

    if (this.editForm.invalid) {
      this.editError.set(this.describeControlError(this.editBody));
      return;
    }

    const nextBody = this.editBody.value.trim();

    if (nextBody === comment.body) {
      this.cancelEdit();
      return;
    }

    this.editSaving.set(true);
    this.editError.set('');

    try {
      const record = await this.cardsService.updateComment(comment.id, nextBody);
      this.comments.update((current) =>
        current.map((existing) =>
          existing.id === comment.id
            ? { ...existing, body: record.body, edited: record.updated_at !== record.created_at }
            : existing,
        ),
      );
      this.cancelEdit();
    } catch (error) {
      this.editError.set(
        error instanceof Error ? error.message : 'Unable to save your changes. Please try again.',
      );
    } finally {
      this.editSaving.set(false);
    }
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
    this.form.reset();
    this.bodyLength.set(0);
    this.clientError.set('');
    this.editingId.set(null);
    this.replyingToId.set(null);
    this.revokeAvatarObjectUrls();
    this.currentUserAvatarUrl.set(null);

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
      const authors = await this.resolveAuthorProfiles(rows, user?.id ?? null);

      this.currentUserAvatarUrl.set(user ? (authors.avatarById.get(user.id) ?? null) : null);

      this.comments.set(
        rows.map((row) =>
          this.toViewModel(
            row,
            authors.nameById.get(row.author_id) ?? 'Unknown user',
            authors.avatarById.get(row.author_id) ?? null,
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

  private async resolveAuthorProfiles(
    rows: readonly CardCommentRecord[],
    currentUserId: string | null,
  ): Promise<{ nameById: Map<string, string>; avatarById: Map<string, string> }> {
    const authorIds = new Set(rows.map((row) => row.author_id));

    if (currentUserId) {
      authorIds.add(currentUserId);
    }

    const nameById = new Map<string, string>();
    const avatarById = new Map<string, string>();

    if (authorIds.size === 0) {
      return { nameById, avatarById };
    }

    const { data: profiles, error } = await this.profiles.profilesByIds([...authorIds]);

    if (error) {
      return { nameById, avatarById };
    }

    const resolved = await Promise.all(
      (profiles ?? []).map(async (profile) => ({
        id: profile.id,
        name: profile.username?.trim() || 'Unknown user',
        avatarUrl: await this.resolveAvatarObjectUrl(profile.avatar_url),
      })),
    );

    for (const profile of resolved) {
      nameById.set(profile.id, profile.name);

      if (profile.avatarUrl) {
        avatarById.set(profile.id, profile.avatarUrl);
      }
    }

    return { nameById, avatarById };
  }

  private async resolveAvatarObjectUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) {
      return null;
    }

    try {
      const { data } = await this.profiles.downloadImage(path);

      if (data instanceof Blob) {
        const objectUrl = URL.createObjectURL(data);
        this.avatarObjectUrls.push(objectUrl);
        return objectUrl;
      }
    } catch {
      // Avatar is optional; fall back to the placeholder on any download failure.
    }

    return null;
  }

  private revokeAvatarObjectUrls(): void {
    for (const objectUrl of this.avatarObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }

    this.avatarObjectUrls = [];
  }

  private toViewModel(
    record: CardCommentRecord,
    authorName: string,
    avatarUrl: string | null,
    isOwn: boolean,
  ): CardCommentViewModel {
    return {
      id: record.id,
      parentId: record.parent_comment_id,
      depth: record.depth,
      authorName,
      avatarUrl,
      body: record.body,
      createdAtIso: record.created_at,
      createdAgo: this.formatRelativeTime(record.created_at),
      edited: record.updated_at !== record.created_at,
      isOwn,
    };
  }

  private describeControlError(control: FormControl<string>): string {
    const errors = control.errors;

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
