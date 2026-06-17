import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, from, map, of, switchMap } from 'rxjs';

import { TagSuggestion } from '../../interfaces/tag-suggestion.interface';
import { CardService } from '../../services/card';

let uniqueInstanceCount = 0;

@Component({
  selector: 'app-tag-search-input',
  imports: [ReactiveFormsModule],
  templateUrl: './tag-search-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagSearchInputComponent {
  private readonly cards = inject(CardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly placeholder = input('Search tags');
  readonly selected = input<readonly TagSuggestion[]>([]);
  readonly unavailableIds = input<readonly string[]>([]);

  readonly tagSelected = output<TagSuggestion>();
  readonly tagRemoved = output<TagSuggestion>();

  private readonly instanceId = (uniqueInstanceCount += 1);
  protected readonly inputId = `tag-search-input-${this.instanceId}`;
  protected readonly listboxId = `tag-search-listbox-${this.instanceId}`;

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly loading = signal(false);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  private readonly suggestions = signal<readonly TagSuggestion[]>([]);

  private readonly excludedIds = computed(
    () => new Set<string>([...this.selected().map((tag) => tag.id), ...this.unavailableIds()]),
  );
  protected readonly visibleSuggestions = computed(() =>
    this.suggestions().filter((tag) => !this.excludedIds().has(tag.id)),
  );
  protected readonly activeDescendant = computed(() => {
    const index = this.activeIndex();

    if (!this.open() || index < 0 || index >= this.visibleSuggestions().length) {
      return null;
    }

    return this.optionId(index);
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(250),
        map((term) => term.trim()),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.length === 0) {
            return of({ term, tags: [] as TagSuggestion[] });
          }

          this.loading.set(true);

          return from(Promise.resolve(this.cards.searchTags(term))).pipe(
            map((result) => ({ term, tags: result.data ?? [] })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ term, tags }) => {
        this.loading.set(false);
        this.suggestions.set(tags);
        this.activeIndex.set(-1);
        this.open.set(term.length > 0);
      });
  }

  protected optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  protected onFocus(): void {
    if (this.searchControl.value.trim().length > 0) {
      this.open.set(true);
    }
  }

  protected onBlur(): void {
    this.open.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.visibleSuggestions();

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!this.open()) {
        this.open.set(this.searchControl.value.trim().length > 0);
        return;
      }

      this.activeIndex.update((index) => Math.min(index + 1, items.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const index = this.activeIndex();

      if (this.open() && index >= 0 && index < items.length) {
        event.preventDefault();
        this.selectTag(items[index]);
      }

      return;
    }

    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected selectTag(tag: TagSuggestion): void {
    this.tagSelected.emit(tag);
    this.searchControl.setValue('', { emitEvent: false });
    this.suggestions.set([]);
    this.activeIndex.set(-1);
    this.open.set(false);
  }

  protected removeTag(tag: TagSuggestion): void {
    this.tagRemoved.emit(tag);
  }
}
