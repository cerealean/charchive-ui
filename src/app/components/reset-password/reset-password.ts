import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AbstractControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  FormBuilder,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

type ResetMode = 'request' | 'update';

const AUTHENTICATED_HOME_PATH = '/my/cards';
const RESET_PASSWORD_PATH = '/reset-password';
const MIN_PASSWORD_LENGTH = 6;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.html',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly mode = signal<ResetMode>('request');
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly requestForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly updateForm = this.formBuilder.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
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

  get requestEmail() {
    return this.requestForm.controls.email;
  }

  get newPassword() {
    return this.updateForm.controls.password;
  }

  get confirmPassword() {
    return this.updateForm.controls.confirmPassword;
  }

  get showRequestEmailError(): boolean {
    return (this.submitted() || this.requestEmail.touched) && this.requestEmail.invalid;
  }

  get showNewPasswordError(): boolean {
    return (this.submitted() || this.newPassword.touched) && this.newPassword.invalid;
  }

  get showConfirmError(): boolean {
    if (!(this.submitted() || this.confirmPassword.touched)) {
      return false;
    }

    return this.confirmPassword.invalid || this.hasPasswordMismatch;
  }

  get hasPasswordMismatch(): boolean {
    return this.updateForm.hasError('passwordMismatch') && this.newPassword.valid;
  }

  async requestReset(): Promise<void> {
    this.submitted.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.requestEmail.markAsTouched();

    if (this.requestForm.invalid) {
      return;
    }

    try {
      this.loading.set(true);
      const email = this.requestEmail.getRawValue().trim();
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
      this.requestForm.reset({ email: '' });
      this.submitted.set(false);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to send the reset link.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async updatePassword(): Promise<void> {
    this.submitted.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.updateForm.markAllAsTouched();

    if (this.updateForm.invalid) {
      return;
    }

    try {
      this.loading.set(true);
      const password = this.newPassword.getRawValue();
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
  }

  private recoveryInUrl(): boolean {
    const { hash, search } = window.location;
    return (hash ?? '').includes('type=recovery') || (search ?? '').includes('type=recovery');
  }
}
