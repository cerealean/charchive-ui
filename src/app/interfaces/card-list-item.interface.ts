export interface CardListItem {
  id: string;
  title: string;
  visibility: 'private' | 'unlisted' | 'public';
  updatedAt: string;
}
