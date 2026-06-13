import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { passwordRequirements, passwordStrengthValidator, passwordsMatch } from '../../shared/password-validation';

type AuthMode = 'sign-in' | 'register';

const AUTHENTICATED_HOME_PATH = '/my/cards';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly mode = signal<AuthMode>('sign-in');
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly awaitingConfirmation = signal(false);
  readonly pendingEmail = signal('');

  readonly signInForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
  });

  readonly registerForm = this.formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  get emailControl() {
    return this.signInForm.controls.email;
  }

  get passwordControl() {
    return this.signInForm.controls.password;
  }

  get registerEmail() {
    return this.registerForm.controls.email;
  }

  get registerPassword() {
    return this.registerForm.controls.password;
  }

  get registerConfirm() {
    return this.registerForm.controls.confirmPassword;
  }

  get registerPasswordRequirements(): { met: boolean; label: string }[] {
    return passwordRequirements(this.registerPassword.value);
  }

  get isRegisterMode(): boolean {
    return this.mode() === 'register';
  }

  get showEmailError(): boolean {
    return (this.submitted() || this.emailControl.touched) && this.emailControl.invalid;
  }

  get showPasswordError(): boolean {
    return (
      this.showPassword() &&
      (this.submitted() || this.passwordControl.touched) &&
      this.passwordControl.invalid
    );
  }

  get showRegisterEmailError(): boolean {
    return (this.submitted() || this.registerEmail.touched) && this.registerEmail.invalid;
  }

  get showRegisterPasswordError(): boolean {
    return (this.submitted() || this.registerPassword.touched) && this.registerPassword.invalid;
  }

  get showConfirmError(): boolean {
    if (!(this.submitted() || this.registerConfirm.touched)) {
      return false;
    }

    return this.registerConfirm.invalid || this.hasPasswordMismatch;
  }

  get hasPasswordMismatch(): boolean {
    return this.registerForm.hasError('passwordMismatch') && this.registerPassword.valid;
  }

  setMode(mode: AuthMode): void {
    if (mode === this.mode()) {
      return;
    }

    const email = this.isRegisterMode
      ? this.registerEmail.getRawValue()
      : this.emailControl.getRawValue();

    this.mode.set(mode);
    this.submitted.set(false);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.awaitingConfirmation.set(false);

    if (mode === 'register') {
      this.registerForm.reset({ email, password: '', confirmPassword: '' });
    } else {
      this.showPassword.set(false);
      this.passwordControl.clearValidators();
      this.passwordControl.updateValueAndValidity();
      this.signInForm.reset({ email, password: '' });
    }
  }

  revealPassword(): void {
    this.showPassword.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.passwordControl.setValidators([Validators.required]);
    this.passwordControl.updateValueAndValidity();
  }

  onSubmit(): Promise<void> {
    if (this.isRegisterMode) {
      return this.register();
    }

    return this.showPassword() ? this.signInWithPassword() : this.sendMagicLink();
  }

  async sendMagicLink(): Promise<void> {
    this.submitted.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.emailControl.markAsTouched();

    if (this.emailControl.invalid) {
      return;
    }

    try {
      this.loading.set(true);
      const email = this.emailControl.getRawValue().trim();
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
    this.submitted.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.signInForm.markAllAsTouched();

    if (this.emailControl.invalid || this.passwordControl.invalid) {
      return;
    }

    try {
      this.loading.set(true);
      const email = this.emailControl.getRawValue().trim();
      const password = this.passwordControl.getRawValue();
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
  }

  async register(): Promise<void> {
    this.submitted.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.registerForm.markAllAsTouched();

    if (this.registerForm.invalid) {
      return;
    }

    try {
      this.loading.set(true);
      const email = this.registerEmail.getRawValue().trim();
      const password = this.registerPassword.getRawValue();
      const { error } = await this.auth.signUp(email, password);
      if (error) {
        throw error;
      }

      this.pendingEmail.set(email);
      this.awaitingConfirmation.set(true);
      this.successMessage.set(
        'Account created. Check your email to confirm your address before signing in.',
      );
      this.registerForm.reset({ email: '', password: '', confirmPassword: '' });
      this.submitted.set(false);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to create your account.',
      );
    } finally {
      this.loading.set(false);
    }
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
    this.submitted.set(false);
    this.passwordControl.clearValidators();
    this.signInForm.reset({ email: '', password: '' });
  }
}
