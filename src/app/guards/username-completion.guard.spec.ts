import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter, UrlTree } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { Mock, vi } from 'vitest';

import { AuthService } from '../services/auth';
import { ProfileService } from '../services/profile';
import { enforceUsernameCompletion } from './username-completion.guard';

describe('enforceUsernameCompletion', () => {
  let getUser: Mock<() => Promise<User | null>>;
  let userHasUsername: Mock<(user: User) => Promise<boolean>>;
  let router: Router;

  beforeEach(() => {
    getUser = vi.fn();
    userHasUsername = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getUser,
          },
        },
        {
          provide: ProfileService,
          useValue: {
            userHasUsername,
          },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('allows anonymous users to continue on public routes', async () => {
    getUser.mockResolvedValue(null);

    const result = await TestBed.runInInjectionContext(() =>
      enforceUsernameCompletion({} as never, { url: '/cards/123' } as never),
    );

    expect(result).toBe(true);
  });

  it('redirects logged in users without a username to setup', async () => {
    getUser.mockResolvedValue({ id: '123' } as User);
    userHasUsername.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      enforceUsernameCompletion({} as never, { url: '/my/cards' } as never),
    );

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/my/username');
  });

  it('allows the setup page when the username is still missing', async () => {
    getUser.mockResolvedValue({ id: '123' } as User);
    userHasUsername.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      enforceUsernameCompletion({} as never, { url: '/my/username' } as never),
    );

    expect(result).toBe(true);
  });

  it('redirects away from setup after the username has been set', async () => {
    getUser.mockResolvedValue({ id: '123' } as User);
    userHasUsername.mockResolvedValue(true);

    const result = await TestBed.runInInjectionContext(() =>
      enforceUsernameCompletion({} as never, { url: '/my/username' } as never),
    );

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/my/cards');
  });
});
