import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

const AUTHENTICATED_HOME_PATH = '/my/cards';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  readonly signInForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
  });

  get emailControl() {
    return this.signInForm.controls.email;
  }

  get passwordControl() {
    return this.signInForm.controls.password;
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

  revealPassword(): void {
    this.showPassword.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');
    this.passwordControl.setValidators([Validators.required]);
    this.passwordControl.updateValueAndValidity();
  }

  onSubmit(): Promise<void> {
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
      this.resetForm();
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

  private resetForm(): void {
    this.showPassword.set(false);
    this.submitted.set(false);
    this.passwordControl.clearValidators();
    this.signInForm.reset({ email: '', password: '' });
  }
}
