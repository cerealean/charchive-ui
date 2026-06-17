import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { CardsComponent } from './cards';
import { TagSearchInputComponent } from '../tag-search-input/tag-search-input';
import { CardSearchRecord } from '../../interfaces/card-search-record.interface';
import { CardSearchParams } from '../../services/card';
import { TagSuggestion } from '../../interfaces/tag-suggestion.interface';
import { AuthService } from '../../services/auth';
import { CardService } from '../../services/card';
import { ProfileService } from '../../services/profile';

describe('CardsComponent', () => {
  let fixture: ComponentFixture<CardsComponent>;
  let searchCalls: CardSearchParams[];
  let searchResult: CardSearchRecord[];
  let signCalls: string[];

  const cardServiceMock = {
    searchPublicCardsPage: (params: CardSearchParams) => {
      searchCalls.push(params);
      return Promise.resolve({ data: searchResult, error: null });
    },
    searchTags: () => ({ data: [], error: null }),
    likedCardIds: async () => new Set<string>(),
    createCardFileSignedUrl: async (path: string) => {
      signCalls.push(path);
      return { data: { signedUrl: `https://signed/${path}` }, error: null };
    },
  } as unknown as CardService;

  const profileServiceMock = {
    profilesByIds: async () => ({ data: [], error: null }),
  } as unknown as ProfileService;

  const authServiceMock = {
    getUser: async () => null,
  } as unknown as AuthService;

  const routerMock = { navigate: () => Promise.resolve(true) } as unknown as Router;

  function buildCard(overrides: Partial<CardSearchRecord> = {}): CardSearchRecord {
    return {
      id: 'card-1',
      owner_id: 'owner-1',
      title: 'Knight',
      tagline: null,
      created_at: '2026-01-01T00:00:00.000Z',
      like_count: 0,
      comment_count: 0,
      character_name: 'Sir Knight',
      storage_path: null,
      tags: [],
      total_count: 1,
      ...overrides,
    };
  }

  beforeEach(async () => {
    searchCalls = [];
    searchResult = [];
    signCalls = [];

    await TestBed.configureTestingModule({
      imports: [CardsComponent],
      providers: [
        { provide: CardService, useValue: cardServiceMock },
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CardsComponent);
  });

  async function flushLoad(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('loads the first page with empty filters on init', async () => {
    searchResult = [buildCard({ total_count: 3 })];

    fixture.detectChanges();
    await flushLoad();

    const firstCall = searchCalls[0];
    expect(firstCall.page).toBe(1);
    expect(firstCall.search).toBe('');
    expect(firstCall.includeTagIds).toEqual([]);
    expect(firstCall.excludeTagIds).toEqual([]);
  });

  it('derives the total card count from total_count on the returned rows', async () => {
    searchResult = [buildCard({ total_count: 42 })];

    fixture.detectChanges();
    await flushLoad();

    const pageInfo = fixture.nativeElement.textContent as string;
    expect(pageInfo).toContain('Page 1 of 5');
  });

  it('selecting an include tag resets to page 1 and re-queries with the tag id', async () => {
    searchResult = [buildCard()];
    fixture.detectChanges();
    await flushLoad();

    const includeInput = fixture.debugElement.queryAll(By.directive(TagSearchInputComponent))[0]
      .componentInstance as TagSearchInputComponent;
    const tag: TagSuggestion = { id: 'tag-1', name: 'Hero', slug: 'hero', public_card_count: 5 };

    includeInput.tagSelected.emit(tag);
    await flushLoad();

    const lastCall = searchCalls[searchCalls.length - 1];
    expect(lastCall.page).toBe(1);
    expect(lastCall.includeTagIds).toEqual(['tag-1']);
  });

  it('reuses a cached signed image URL across reloads to avoid image flicker', async () => {
    searchResult = [buildCard({ storage_path: 'cards/owner-1/card-1.png' })];
    fixture.detectChanges();
    await flushLoad();

    const includeInput = fixture.debugElement.queryAll(By.directive(TagSearchInputComponent))[0]
      .componentInstance as TagSearchInputComponent;
    includeInput.tagSelected.emit({ id: 'tag-1', name: 'Hero', slug: 'hero', public_card_count: 5 });
    await flushLoad();

    expect(signCalls.filter((path) => path === 'cards/owner-1/card-1.png').length).toBe(1);
  });
});
