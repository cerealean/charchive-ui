export interface CardSearchRecord {
  id: string;
  owner_id: string;
  title: string;
  tagline: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  character_name: string | null;
  storage_path: string | null;
  tags: Array<{
    name: string;
    slug: string;
  }>;
  total_count: number;
}
