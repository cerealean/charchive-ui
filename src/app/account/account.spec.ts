import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '@supabase/supabase-js';

import { AccountComponent } from './account';
import { SupabaseService } from '../services/supabase';

describe('AccountComponent', () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;

  const supabaseServiceMock = {
    getUser: async () => null,
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
    signOut: async () => ({ error: null }),
    downLoadImage: async () => ({ data: null, error: null }),
    uploadAvatar: async () => ({ data: null, error: null }),
  } as unknown as SupabaseService;

  const mockUser = {
    id: 'user-id',
    email: 'demo@example.com',
  } as User;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [{ provide: SupabaseService, useValue: supabaseServiceMock }],
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
});
