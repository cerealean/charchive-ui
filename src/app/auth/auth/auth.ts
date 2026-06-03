import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { SupabaseService } from '../services/supabase';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.html',
  styleUrls: ['./auth.css'],
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly formBuilder = inject(FormBuilder);

  loading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';
  readonly signInForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get emailControl() {
    return this.signInForm.controls.email;
  }

  get showEmailError(): boolean {
    return (this.submitted || this.emailControl.touched) && this.emailControl.invalid;
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';

    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    try {
      this.loading = true;
      const email = this.emailControl.getRawValue().trim();
      const { error } = await this.supabase.signIn(email);
      if (error) {
        throw error;
      }

      this.successMessage = 'Magic link sent. Check your inbox to finish signing in.';
      this.signInForm.reset({ email: '' });
      this.submitted = false;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to send the magic link.';
    } finally {
      this.loading = false;
    }
  }
}
