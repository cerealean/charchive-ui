import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter, UrlTree } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { Mock, vi } from 'vitest';

import { SupabaseService } from '../services/supabase';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let getUser: Mock<() => Promise<User | null>>;
  let router: Router;

  beforeEach(() => {
    getUser = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: {
            getUser,
          },
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('allows navigation when a user is logged in', async () => {
    getUser.mockResolvedValue({ id: '123' } as User);

    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects to the landing page when there is no logged in user', async () => {
    getUser.mockResolvedValue(null);

    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});
