import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import {
  passwordRequirements as buildPasswordRequirements,
  validatePasswordStrength,
  validatePasswordsMatch,
} from '../../shared/password-validation';

type ResetMode = 'request' | 'update';

const AUTHENTICATED_HOME_PATH = '/my/cards';
const RESET_PASSWORD_PATH = '/reset-password';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.html',
  imports: [FormField, RouterLink],
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly mode = signal<ResetMode>('request');
  readonly loading = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly requestModel = signal({ email: '' });
  readonly updateModel = signal({ password: '', confirmPassword: '' });

  readonly requestForm = form(this.requestModel, (path) => {
    required(path.email, { message: 'Email is required.' });
    email(path.email, { message: 'Enter a valid email address.' });
  });

  readonly updateForm = form(this.updateModel, (path) => {
    required(path.password, { message: 'Password is required.' });
    validatePasswordStrength(path.password);
    required(path.confirmPassword, { message: 'Please confirm your password.' });
    validatePasswordsMatch(path.confirmPassword, path.password);
  });

  readonly passwordRequirements = computed(() =>
    buildPasswordRequirements(this.updateForm.password().value()),
  );

  constructor() {
    if (this.isBrowser && this.recoveryInUrl()) {
      this.mode.set('update');
    }

    const { data } = this.auth.authChanges((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.mode.set('update');
      }
    });

    this.destroyRef.onDestroy(() => data.subscription.unsubscribe());
  }

  get isUpdateMode(): boolean {
    return this.mode() === 'update';
  }

  async requestReset(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    await submit(this.requestForm, async () => {
      try {
        this.loading.set(true);
        const email = this.requestModel().email.trim();
        const redirectTo = this.isBrowser
          ? `${window.location.origin}${RESET_PASSWORD_PATH}`
          : undefined;
        const { error } = await this.auth.resetPassword(email, redirectTo);
        if (error) {
          throw error;
        }

        this.successMessage.set(
          'If an account exists for that email, we sent a password reset link. Check your inbox.',
        );
        this.requestModel.set({ email: '' });
        this.requestForm().reset();
      } catch (error) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Unable to send the reset link.',
        );
      } finally {
        this.loading.set(false);
      }
    });
  }

  async updatePassword(): Promise<void> {
    this.successMessage.set('');
    this.errorMessage.set('');

    await submit(this.updateForm, async () => {
      try {
        this.loading.set(true);
        const password = this.updateModel().password;
        const { error } = await this.auth.updatePassword(password);
        if (error) {
          throw error;
        }

        this.successMessage.set('Password updated. Taking you to your cards...');
        await this.router.navigateByUrl(AUTHENTICATED_HOME_PATH);
      } catch (error) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Unable to update your password.',
        );
      } finally {
        this.loading.set(false);
      }
    });
  }

  private recoveryInUrl(): boolean {
    const { hash, search } = window.location;
    return (hash ?? '').includes('type=recovery') || (search ?? '').includes('type=recovery');
  }
}
