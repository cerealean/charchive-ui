import { TestBed } from '@angular/core/testing';
import { User } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth';

describe('App', () => {
  const signOutMock = vi.fn(async () => ({ error: null }));
  let currentUser: User | null = null;

  beforeEach(async () => {
    signOutMock.mockClear();
    const authServiceMock = {
      getUser: async () => currentUser,
      signOut: signOutMock,
      authChanges: () => ({
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      }),
    } as unknown as AuthService;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();
  });

  afterEach(() => {
    currentUser = null;
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the app shell header and router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('header')?.textContent).toContain('Charchive');
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('shows a sign out button in the navbar and signs out when clicked', async () => {
    currentUser = { id: 'user-id', email: 'demo@example.com' } as User;

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('header button'),
    );
    const signOutButton = buttons.find((button) => button.textContent?.trim() === 'Sign out');

    expect(signOutButton).toBeTruthy();

    signOutButton!.click();
    await fixture.whenStable();

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
