import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-card-detail',
  templateUrl: './card-detail.html',
  styleUrl: './card-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly routeCardId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  protected readonly cardId = computed(() => this.routeCardId());

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.routeCardId.set(params.get('id') ?? '');
    });
  }

  protected backToMyCards(): void {
    void this.router.navigateByUrl('/my/cards');
  }
}
