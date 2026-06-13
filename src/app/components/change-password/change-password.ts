import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';

import { AuthService } from '../../services/auth';
import {
  passwordRequirements,
  passwordStrengthValidator,
  passwordsMatch,
} from '../../shared/password-validation';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  readonly hasPassword = input<boolean>(false);
  readonly email = input<string>('');
  readonly saved = output<boolean>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.formBuilder.nonNullable.group(
    {
      currentPassword: [''],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  get currentPasswordControl() {
    return this.form.controls.currentPassword;
  }

  get passwordControl() {
    return this.form.controls.password;
  }

  get confirmControl() {
    return this.form.controls.confirmPassword;
  }

  get requirements(): { met: boolean; label: string }[] {
    return passwordRequirements(this.passwordControl.value);
  }

  get showCurrentPasswordError(): boolean {
    return (
      this.hasPassword() &&
      (this.submitted() || this.currentPasswordControl.touched) &&
      this.currentPasswordControl.invalid
    );
  }

  get showPasswordError(): boolean {
    return (this.submitted() || this.passwordControl.touched) && this.passwordControl.invalid;
  }

  get showConfirmError(): boolean {
    if (!(this.submitted() || this.confirmControl.touched)) {
      return false;
    }

    return this.confirmControl.invalid || this.hasPasswordMismatch;
  }

  get hasPasswordMismatch(): boolean {
    return this.form.hasError('passwordMismatch') && this.passwordControl.valid;
  }

  open(): void {
    this.submitted.set(false);
    this.errorMessage.set('');
    this.form.reset({ currentPassword: '', password: '', confirmPassword: '' });

    if (this.hasPassword()) {
      this.currentPasswordControl.setValidators([Validators.required]);
    } else {
      this.currentPasswordControl.clearValidators();
    }
    this.currentPasswordControl.updateValueAndValidity();

    this.dialog()?.nativeElement.showModal();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.errorMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    try {
      this.loading.set(true);
      const password = this.passwordControl.getRawValue();

      if (this.hasPassword()) {
        const currentPassword = this.currentPasswordControl.getRawValue();
        const verified = await this.auth.verifyPassword(this.email(), currentPassword);
        if (!verified) {
          this.errorMessage.set('Your current password is incorrect.');
          return;
        }
      }

      const { error } = await this.auth.updatePassword(password);
      if (error) {
        throw error;
      }

      const created = !this.hasPassword();
      this.close();
      this.saved.emit(created);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to update your password.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
