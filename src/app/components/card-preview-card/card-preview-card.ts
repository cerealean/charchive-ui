import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CardListViewModel } from '../../interfaces/card-list-view-model.interface';

@Component({
  selector: 'app-card-preview-card',
  templateUrl: './card-preview-card.html',
  styleUrl: './card-preview-card.css',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-full',
  },
})
export class CardPreviewCardComponent {
  readonly card = input.required<CardListViewModel>();
  readonly viewCard = output<string>();

  protected onViewCard(): void {
    this.viewCard.emit(this.card().id);
  }
}
