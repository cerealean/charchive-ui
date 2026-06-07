import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CardListViewModel } from '../../../interfaces/card-list-view-model.interface';

@Component({
  selector: 'app-card-list-card',
  templateUrl: './card-list-card.html',
  styleUrl: './card-list-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-full',
  },
})
export class CardListCardComponent {
  readonly card = input.required<CardListViewModel>();
  readonly viewCard = output<string>();

  protected onViewCard(): void {
    this.viewCard.emit(this.card().id);
  }
}
