import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormField, form, required, submit as submitForm } from '@angular/forms/signals';

import { AuthService } from '../../services/auth';
import {
  passwordRequirements as buildPasswordRequirements,
  validatePasswordStrength,
  validatePasswordsMatch,
} from '../../shared/password-validation';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.html',
  imports: [FormField],
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);

  readonly hasPassword = input<boolean>(false);
  readonly email = input<string>('');
  readonly saved = output<boolean>();

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly model = signal({ currentPassword: '', password: '', confirmPassword: '' });

  readonly form = form(this.model, (path) => {
    required(path.currentPassword, {
      message: 'Current password is required.',
      when: () => this.hasPassword(),
    });
    required(path.password, { message: 'Password is required.' });
    validatePasswordStrength(path.password);
    required(path.confirmPassword, { message: 'Please confirm your password.' });
    validatePasswordsMatch(path.confirmPassword, path.password);
  });

  readonly requirements = computed(() => buildPasswordRequirements(this.form.password().value()));

  open(): void {
    this.errorMessage.set('');
    this.model.set({ currentPassword: '', password: '', confirmPassword: '' });
    this.form().reset();
    this.dialog()?.nativeElement.showModal();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  async submit(): Promise<void> {
    this.errorMessage.set('');

    await submitForm(this.form, async () => {
      try {
        this.loading.set(true);
        const password = this.model().password;

        if (this.hasPassword()) {
          const currentPassword = this.model().currentPassword;
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
    });
  }
}
