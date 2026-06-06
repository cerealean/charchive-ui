import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

type CardVisibility = 'private' | 'unlisted' | 'public';

interface CardListItem {
  id: string;
  title: string;
  visibility: CardVisibility;
  updatedAt: string;
}

@Component({
  selector: 'app-my-cards',
  templateUrl: './my-cards.html',
  styleUrl: './my-cards.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyCardsComponent {
  private readonly router = inject(Router);

  protected readonly cards = signal<readonly CardListItem[]>([
    {
      id: 'demo-card-1',
      title: 'Captain Aria',
      visibility: 'private',
      updatedAt: 'just now',
    },
    {
      id: 'demo-card-2',
      title: 'Archivist Nox',
      visibility: 'unlisted',
      updatedAt: '2 days ago',
    },
  ]);

  protected readonly uploadStatus = signal<string>('');

  protected viewCard(cardId: string): void {
    void this.router.navigate(['/cards', cardId]);
  }

  protected handleUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.uploadStatus.set('');
      return;
    }

    this.uploadStatus.set(`Selected ${file.name}. Upload flow will be wired in the next step.`);
    input.value = '';
  }
}
