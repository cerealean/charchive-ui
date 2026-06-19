import { Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, required, submit as submitForm } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import {
  passwordRequirements as buildPasswordRequirements,
  validatePasswordStrength,
  validatePasswordsMatch,
} from '../../shared/password-validation';

type AuthMode = 'sign-in' | 'register';

const AUTHENTICATED_HOME_PATH = '/my/cards';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [FormField, RouterLink],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<AuthMode>('sign-in');
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly awaitingConfirmation = signal(false);
  readonly pendingEmail = signal('');

  readonly signInModel = signal({ email: '', password: '' });
  readonly registerModel = signal({ email: '', password: '', confirmPassword: '' });

  readonly signInForm = form(this.signInModel, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.password, { message: 'Password is required.', when: () => this.showPassword() });
  });

  readonly registerForm = form(this.registerModel, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.password, { message: 'Password is required.' });
    validatePasswordStrength(path.password);
    required(path.confirmPassword, { message: 'Please confirm your password.' });
    validatePasswordsMatch(path.confirmPassword, path.password);
  });

  readonly registerPasswordRequirements = computed(() =>
    buildPasswordRequirements(this.registerForm.password().value()),
  );

  get isRegisterMode(): boolean {
    return this.mode() === 'register';
  }

  setMode(mode: AuthMode): void {
    if (mode === this.mode()) {
      return;
    }

    const email = this.isRegisterMode ? this.registerModel().email : this.signInModel().email;

    this.mode.set(mode);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.awaitingConfirmation.set(false);

    if (mode === 'register') {
      this.registerModel.set({ email, password: '', confirmPassword: '' });
      this.registerForm().reset();
    } else {
      this.showPassword.set(false);
      this.signInModel.set({ email, password: '' });
      this.signInForm().reset();
    }
  }

  revealPassword(): void {
    this.showPassword.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  onSubmit(): Promise<void> {
    if (this.isRegisterMode) {
      return this.register();
    }

    return this.showPassword() ? this.signInWithPassword() : this.sendMagicLink();
  }

  async sendMagicLink(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');
    this.signInForm.email().markAsTouched();

    if (this.signInForm.email().invalid()) {
      return;
    }

    try {
      this.loading.set(true);
      const email = this.signInModel().email.trim();
      const { error } = await this.auth.signIn(email);
      if (error) {
        throw error;
      }

      this.successMessage.set('Magic link sent. Check your inbox to finish signing in.');
      this.resetSignInForm();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to send the magic link.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithPassword(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    await submitForm(this.signInForm, async () => {
      try {
        this.loading.set(true);
        const email = this.signInModel().email.trim();
        const password = this.signInModel().password;
        const { error } = await this.auth.signInWithPassword(email, password);
        if (error) {
          throw error;
        }

        await this.router.navigateByUrl(AUTHENTICATED_HOME_PATH);
      } catch (error) {
        this.errorMessage.set(
          error instanceof Error
            ? error.message
            : 'Unable to sign in. Check your email and password.',
        );
      } finally {
        this.loading.set(false);
      }
    });
  }

  async register(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    await submitForm(this.registerForm, async () => {
      try {
        this.loading.set(true);
        const email = this.registerModel().email.trim();
        const password = this.registerModel().password;
        const { error } = await this.auth.signUp(email, password);
        if (error) {
          throw error;
        }

        this.pendingEmail.set(email);
        this.awaitingConfirmation.set(true);
        this.successMessage.set(
          'Account created. Check your email to confirm your address before signing in.',
        );
        this.registerModel.set({ email: '', password: '', confirmPassword: '' });
        this.registerForm().reset();
      } catch (error) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Unable to create your account.',
        );
      } finally {
        this.loading.set(false);
      }
    });
  }

  async resendConfirmation(): Promise<void> {
    const email = this.pendingEmail();
    if (!email) {
      return;
    }

    this.successMessage.set('');
    this.errorMessage.set('');

    try {
      this.loading.set(true);
      const { error } = await this.auth.resendConfirmation(email);
      if (error) {
        throw error;
      }

      this.successMessage.set(`Confirmation email resent to ${email}.`);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to resend the confirmation email.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  private resetSignInForm(): void {
    this.showPassword.set(false);
    this.signInModel.set({ email: '', password: '' });
    this.signInForm().reset();
  }
}
