export interface CardCommentRecord {
  id: string;
  author_id: string;
  parent_comment_id: string | null;
  depth: number;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
