import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { AuthComponent } from './auth';
import { SupabaseService } from '../services/supabase';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;
  let signInCalls = 0;
  let supabaseService: Pick<SupabaseService, 'signIn'>;

  beforeEach(async () => {
    signInCalls = 0;
    supabaseService = {
      signIn: async () => {
        signInCalls += 1;
        return {
          data: {
            user: null,
            session: null,
          },
          error: null,
        };
      },
    };

    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [{ provide: SupabaseService, useValue: supabaseService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows validation feedback after submitting an empty form', () => {
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    const errorText = fixture.debugElement.query(By.css('#email-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Email is required.');
    expect(signInCalls).toBe(0);
  });
});
