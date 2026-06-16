export interface CardListViewModel {
  id: string;
  name: string;
  tagline: string;
  uploader: string;
  createdAtIso: string;
  createdAgo: string;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  imageUrl: string | null;
  tags: Array<{
    slug: string;
    name: string;
  }>;
}
