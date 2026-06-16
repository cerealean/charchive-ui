export interface CardCommentViewModel {
  id: string;
  authorName: string;
  avatarUrl: string | null;
  body: string;
  createdAtIso: string;
  createdAgo: string;
  edited: boolean;
  isOwn: boolean;
}
