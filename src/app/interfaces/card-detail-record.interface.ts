export interface CardDetailRecord {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  like_count: number;
  current_version: {
    character_name: string;
    creator_name: string | null;
    creator_notes: string | null;
    source_format: string;
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
