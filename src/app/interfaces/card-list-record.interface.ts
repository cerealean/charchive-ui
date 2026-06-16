export interface CardListRecord {
  id: string;
  owner_id: string;
  title: string;
  tagline: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  current_version: {
    character_name: string;
  } | null;
  avatar_file: {
    storage_path: string;
  } | null;
  tags: Array<{
    tag: {
      name: string;
      slug: string;
    } | null;
  }>;
}
