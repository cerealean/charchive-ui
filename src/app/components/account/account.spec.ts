import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '@supabase/supabase-js';
import { vi } from 'vitest';

import { AccountComponent } from './account';
import { AuthService } from '../../services/auth';
import { ProfileService } from '../../services/profile';

describe('AccountComponent', () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;

  const authServiceMock = {
    getUser: async () => null,
    signOut: async () => ({ error: null }),
  } as unknown as AuthService;

  const profileServiceMock = {
    isUsernameAvailable: vi.fn(async () => true),
    profile: async () => ({
      data: {
        username: 'Demo User',
        website: 'https://example.com',
        avatar_url: '',
      },
      error: null,
      status: 200,
      statusText: 'OK',
      count: null,
    }),
    updateProfile: async () => ({
      data: null,
      error: null,
      status: 200,
      statusText: 'OK',
      count: null,
    }),
    downloadImage: async () => ({ data: null, error: null }),
    uploadAvatar: async () => ({ data: null, error: null }),
  } as unknown as ProfileService;

  const mockUser = {
    id: 'user-id',
    email: 'demo@example.com',
  } as User;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    component.user = mockUser;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not show username availability feedback before editing username', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).not.toContain('That username is available.');
  });

  it('marks the current username as available after profile load', async () => {
    vi.useFakeTimers();

    try {
      component.usernameControl.setValue('Demo User Updated');
      component.usernameControl.markAsDirty();
      component.usernameControl.markAsTouched();
      component.usernameControl.updateValueAndValidity();

      await vi.advanceTimersByTimeAsync(300);
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.textContent).toContain('That username is available.');
    } finally {
      vi.useRealTimers();
    }
  });
});
