import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SupabaseService } from './services/supabase';

describe('App', () => {
  beforeEach(async () => {
    const supabaseServiceMock = {
      getUser: async () => null,
      authChanges: () => ({
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      }),
      userHasUsername: async () => false,
    } as unknown as SupabaseService;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SupabaseService, useValue: supabaseServiceMock }],
    }).compileComponents();
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
});
