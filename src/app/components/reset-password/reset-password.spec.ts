import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { ResetPasswordComponent } from './reset-password';
import { AuthService } from '../../services/auth';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let resetCalls: { email: string; redirectTo?: string }[] = [];
  let updateCalls: string[] = [];
  let navigatedTo: string | null = null;
  let authService: Pick<AuthService, 'authChanges' | 'resetPassword' | 'updatePassword'>;

  beforeEach(async () => {
    resetCalls = [];
    updateCalls = [];
    navigatedTo = null;

    authService = {
      authChanges: (() => ({
        data: { subscription: { unsubscribe: () => undefined } },
      })) as unknown as AuthService['authChanges'],
      resetPassword: (async (email: string, redirectTo?: string) => {
        resetCalls.push({ email, redirectTo });
        return { data: {}, error: null };
      }) as unknown as AuthService['resetPassword'],
      updatePassword: (async (password: string) => {
        updateCalls.push(password);
        return { data: { user: null }, error: null };
      }) as unknown as AuthService['updatePassword'],
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockImplementation(async (url) => {
      navigatedTo = url.toString();
      return true;
    });

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in request mode and shows the email field', () => {
    fixture.detectChanges();

    expect(component.isUpdateMode).toBe(false);
    expect(fixture.debugElement.query(By.css('#reset-email'))).toBeTruthy();
  });

  it('validates the email before requesting a reset', async () => {
    fixture.detectChanges();

    await component.requestReset();
    fixture.detectChanges();

    const errorText =
      fixture.debugElement.query(By.css('#reset-email-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Email is required.');
    expect(resetCalls.length).toBe(0);
  });

  it('sends a reset link for a valid email', async () => {
    fixture.detectChanges();
    component.requestEmail.setValue('user@example.com');

    await component.requestReset();
    fixture.detectChanges();

    expect(resetCalls.length).toBe(1);
    expect(resetCalls[0].email).toBe('user@example.com');
    expect(component.successMessage()).toContain('reset link');
  });

  it('does not update when the new passwords do not match', async () => {
    component.mode.set('update');
    fixture.detectChanges();
    component.newPassword.setValue('s3cret-pass');
    component.confirmPassword.setValue('different-pass');
    fixture.detectChanges();

    await component.updatePassword();
    fixture.detectChanges();

    const errorText =
      fixture.debugElement.query(By.css('#confirm-password-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Passwords do not match.');
    expect(updateCalls.length).toBe(0);
  });

  it('updates the password and navigates home when valid', async () => {
    component.mode.set('update');
    fixture.detectChanges();
    component.newPassword.setValue('s3cret-pass');
    component.confirmPassword.setValue('s3cret-pass');

    await component.updatePassword();

    expect(updateCalls).toEqual(['s3cret-pass']);
    expect(navigatedTo).toBe('/my/cards');
  });
});
