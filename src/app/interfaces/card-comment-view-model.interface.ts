export interface CardCommentViewModel {
  id: string;
  parentId: string | null;
  depth: number;
  authorName: string;
  avatarUrl: string | null;
  body: string;
  createdAtIso: string;
  createdAgo: string;
  edited: boolean;
  isOwn: boolean;
}
