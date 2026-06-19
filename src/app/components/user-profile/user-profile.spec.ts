import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { UserProfileComponent } from './user-profile';
import { ProfileCardRecord } from '../../services/card';
import { CardService } from '../../services/card';
import { ProfileService } from '../../services/profile';
import { PublicProfile } from '../../interfaces/public-profile.interface';

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;
  let profile: PublicProfile | null;
  let cards: ProfileCardRecord[];

  const profileServiceMock = {
    profileByUsername: async () => ({ data: profile, error: null }),
    downloadImage: async () => ({ data: null, error: null }),
  } as unknown as ProfileService;

  const cardServiceMock = {
    publicCardsByOwner: async () => ({ data: cards, error: null }),
    createCardFileSignedUrl: async (path: string) => ({
      data: { signedUrl: `https://signed/${path}` },
      error: null,
    }),
  } as unknown as CardService;

  const routerMock = { navigate: () => Promise.resolve(true) } as unknown as Router;

  const activatedRouteMock = {
    paramMap: of(convertToParamMap({ username: 'demo' })),
  } as unknown as ActivatedRoute;

  function buildCard(overrides: Partial<ProfileCardRecord> = {}): ProfileCardRecord {
    return {
      id: 'card-1',
      title: 'Knight',
      tagline: 'A brave knight',
      created_at: '2026-01-01T00:00:00.000Z',
      like_count: 2,
      comment_count: 1,
      current_version: { character_name: 'Sir Knight' },
      avatar_file: null,
      tags: [{ tag: { name: 'Hero', slug: 'hero' } }],
      ...overrides,
    };
  }

  beforeEach(async () => {
    profile = {
      id: 'owner-1',
      username: 'demo',
      avatar_url: null,
      about_me: 'Hello **world**',
    };
    cards = [buildCard()];

    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: CardService, useValue: cardServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    }).compileComponents();
  });

  async function flush(): Promise<void> {
    fixture = TestBed.createComponent(UserProfileComponent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('renders the username, about me markdown, and the user\'s cards', async () => {
    await flush();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('demo');
    expect(text).toContain('Sir Knight');

    const aboutMe = (fixture.nativeElement as HTMLElement).querySelector('.prose');
    expect(aboutMe?.innerHTML).toContain('<strong>world</strong>');
  });

  it('shows a not-found message when the profile does not exist', async () => {
    profile = null;

    await flush();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Profile not found');
  });
});
