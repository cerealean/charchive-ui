export interface CardCommentViewModel {
  id: string;
  authorName: string;
  body: string;
  createdAtIso: string;
  createdAgo: string;
  isOwn: boolean;
}
