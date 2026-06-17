import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagSearchInputComponent } from './tag-search-input';
import { TagSuggestion } from '../../interfaces/tag-suggestion.interface';
import { CardService } from '../../services/card';

describe('TagSearchInputComponent', () => {
  let fixture: ComponentFixture<TagSearchInputComponent>;
  let element: HTMLElement;
  let searchTerms: string[];
  let suggestions: TagSuggestion[];

  const tagA: TagSuggestion = { id: 'a', name: 'Adventure', slug: 'adventure', public_card_count: 9 };
  const tagB: TagSuggestion = { id: 'b', name: 'Action', slug: 'action', public_card_count: 4 };

  const cardServiceMock = {
    searchTags: (term: string) => {
      searchTerms.push(term);
      return { data: suggestions, error: null };
    },
  } as unknown as CardService;

  beforeEach(async () => {
    searchTerms = [];
    suggestions = [tagA, tagB];

    await TestBed.configureTestingModule({
      imports: [TagSearchInputComponent],
      providers: [{ provide: CardService, useValue: cardServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(TagSearchInputComponent);
    fixture.componentRef.setInput('label', 'Include tags');
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function typeQuery(value: string): void {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function flushDebounce(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the most popular tags on focus before anything is typed', async () => {
    const input = element.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(searchTerms).toEqual(['']);
    expect(element.querySelectorAll('[role="option"]').length).toBe(2);
  });

  it('reuses cached suggestions on refocus without re-querying', async () => {
    const input = element.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(searchTerms).toEqual(['']);
    expect(element.querySelectorAll('[role="option"]').length).toBe(2);
  });

  it('debounces input, queries searchTags, and renders suggestions', async () => {
    typeQuery('a');
    expect(searchTerms).toEqual([]);

    await flushDebounce();

    expect(searchTerms).toEqual(['a']);
    const options = element.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Adventure');
  });

  it('emits tagSelected, clears the query, and keeps the list open for more picks', async () => {
    const selected: TagSuggestion[] = [];
    fixture.componentInstance.tagSelected.subscribe((tag) => selected.push(tag));

    typeQuery('a');
    await flushDebounce();

    const firstOption = element.querySelector('[role="option"]') as HTMLElement;
    firstOption.dispatchEvent(new MouseEvent('mousedown'));
    firstOption.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(selected).toEqual([tagA]);
    const input = element.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(element.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
  });

  it('does not suggest tags already selected or unavailable', async () => {
    fixture.componentRef.setInput('selected', [tagA]);
    fixture.componentRef.setInput('unavailableIds', [tagB.id]);
    fixture.detectChanges();

    typeQuery('a');
    await flushDebounce();

    expect(element.querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('selects the active option with arrow + enter keyboard navigation', async () => {
    const selected: TagSuggestion[] = [];
    fixture.componentInstance.tagSelected.subscribe((tag) => selected.push(tag));

    typeQuery('a');
    await flushDebounce();

    const input = element.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(selected).toEqual([tagA]);
  });

  it('emits tagRemoved when a selected chip remove button is clicked', () => {
    const removed: TagSuggestion[] = [];
    fixture.componentInstance.tagRemoved.subscribe((tag) => removed.push(tag));

    fixture.componentRef.setInput('selected', [tagA]);
    fixture.detectChanges();

    const removeButton = element.querySelector(
      'button[aria-label="Remove Adventure"]',
    ) as HTMLButtonElement;
    removeButton.click();

    expect(removed).toEqual([tagA]);
  });
});
