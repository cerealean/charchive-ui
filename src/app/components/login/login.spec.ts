import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { LoginComponent } from './login';
import { AuthService } from '../../services/auth';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let signInCalls = 0;
  let passwordCalls: { email: string; password: string }[] = [];
  let passwordError: Error | null = null;
  let signUpCalls: { email: string; password: string }[] = [];
  let resendCalls: string[] = [];
  let navigatedTo: string | null = null;
  let authService: Pick<
    AuthService,
    'signIn' | 'signInWithPassword' | 'signUp' | 'resendConfirmation'
  >;

  beforeEach(async () => {
    signInCalls = 0;
    passwordCalls = [];
    passwordError = null;
    signUpCalls = [];
    resendCalls = [];
    navigatedTo = null;

    authService = {
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
      signInWithPassword: (async (email: string, password: string) => {
        passwordCalls.push({ email, password });
        return {
          data: { user: null, session: null },
          error: passwordError,
        };
      }) as AuthService['signInWithPassword'],
      signUp: (async (email: string, password: string) => {
        signUpCalls.push({ email, password });
        return {
          data: { user: null, session: null },
          error: null,
        };
      }) as AuthService['signUp'],
      resendConfirmation: (async (email: string) => {
        resendCalls.push(email);
        return { data: {}, error: null };
      }) as AuthService['resendConfirmation'],
    };

    const routerStub = {
      navigateByUrl: async (url: string) => {
        navigatedTo = url;
        return true;
      },
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: routerStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows validation feedback when sending a magic link with an empty email', async () => {
    fixture.detectChanges();

    await component.sendMagicLink();
    fixture.detectChanges();

    const errorText = fixture.debugElement.query(By.css('#email-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Email is required.');
    expect(signInCalls).toBe(0);
  });

  it('sends a magic link when the email is valid', async () => {
    fixture.detectChanges();
    component.emailControl.setValue('user@example.com');

    await component.sendMagicLink();
    fixture.detectChanges();

    expect(signInCalls).toBe(1);
    expect(component.successMessage()).toContain('Magic link sent');
  });

  it('hides the password field until "Use password" is chosen', () => {
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#password'))).toBeNull();

    component.revealPassword();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#password'))).toBeTruthy();
  });

  it('requires a password before signing in with a password', async () => {
    fixture.detectChanges();
    component.revealPassword();
    component.emailControl.setValue('user@example.com');
    fixture.detectChanges();

    await component.signInWithPassword();
    fixture.detectChanges();

    const errorText =
      fixture.debugElement.query(By.css('#password-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Password is required.');
    expect(passwordCalls.length).toBe(0);
  });

  it('signs in and navigates home when password credentials are valid', async () => {
    fixture.detectChanges();
    component.revealPassword();
    component.emailControl.setValue('user@example.com');
    component.passwordControl.setValue('s3cret-pass');

    await component.signInWithPassword();

    expect(passwordCalls).toEqual([{ email: 'user@example.com', password: 's3cret-pass' }]);
    expect(navigatedTo).toBe('/my/cards');
  });

  it('surfaces an error message when password sign-in fails', async () => {
    passwordError = new Error('Invalid login credentials');
    fixture.detectChanges();
    component.revealPassword();
    component.emailControl.setValue('user@example.com');
    component.passwordControl.setValue('wrong-pass');

    await component.signInWithPassword();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Invalid login credentials');
    expect(navigatedTo).toBeNull();
  });

  it('switches to the registration form when "Create an account" is chosen', () => {
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#register-email'))).toBeNull();

    component.setMode('register');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#register-email'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#register-confirm-password'))).toBeTruthy();
  });

  it('does not register when the passwords do not match', async () => {
    fixture.detectChanges();
    component.setMode('register');
    component.registerEmail.setValue('new@example.com');
    component.registerPassword.setValue('s3cret-pass');
    component.registerConfirm.setValue('different-pass');
    fixture.detectChanges();

    await component.register();
    fixture.detectChanges();

    const errorText =
      fixture.debugElement.query(By.css('#register-confirm-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Passwords do not match.');
    expect(signUpCalls.length).toBe(0);
  });

  it('registers and shows a confirmation message when the form is valid', async () => {
    fixture.detectChanges();
    component.setMode('register');
    component.registerEmail.setValue('new@example.com');
    component.registerPassword.setValue('s3cret-pass');
    component.registerConfirm.setValue('s3cret-pass');

    await component.register();
    fixture.detectChanges();

    expect(signUpCalls).toEqual([{ email: 'new@example.com', password: 's3cret-pass' }]);
    expect(component.successMessage()).toContain('Check your email');
    expect(navigatedTo).toBeNull();
  });

  it('hides the form and offers a resend after a successful sign-up', async () => {
    fixture.detectChanges();
    component.setMode('register');
    component.registerEmail.setValue('new@example.com');
    component.registerPassword.setValue('s3cret-pass');
    component.registerConfirm.setValue('s3cret-pass');

    await component.register();
    fixture.detectChanges();

    expect(component.awaitingConfirmation()).toBe(true);
    expect(fixture.debugElement.query(By.css('#register-email'))).toBeNull();

    await component.resendConfirmation();

    expect(resendCalls).toEqual(['new@example.com']);
    expect(component.successMessage()).toContain('resent');
  });
});
