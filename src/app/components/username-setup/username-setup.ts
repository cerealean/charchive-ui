import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';

import { AuthService } from '../../services/auth';
import { ProfileService } from '../../services/profile';
import {
  createUsernameAvailabilityValidator,
  getUsernameStatus,
  usernameSyncValidators,
} from '../../shared/username-validation';

@Component({
  selector: 'app-username-setup',
  imports: [ReactiveFormsModule],
  templateUrl: './username-setup.html',
  styleUrl: './username-setup.css',
})
export class UsernameSetupComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly statusMessage = signal('');
  protected user: User | null = null;

  readonly usernameForm = this.formBuilder.nonNullable.group({
    username: this.formBuilder.nonNullable.control('', {
      validators: usernameSyncValidators,
      asyncValidators: [createUsernameAvailabilityValidator(this.profiles, () => this.user)],
    }),
  });

  get usernameControl() {
    return this.usernameForm.controls.username;
  }

  protected get usernameStatus() {
    return getUsernameStatus(this.usernameControl);
  }

  protected get submitDisabled() {
    return this.loading() || this.usernameForm.pending || this.usernameForm.invalid;
  }

  async ngOnInit(): Promise<void> {
    this.user = await this.auth.getUser();

    if (!this.user) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    if (await this.profiles.userHasUsername(this.user)) {
      await this.router.navigateByUrl('/my/cards', { replaceUrl: true });
      return;
    }

    this.usernameControl.updateValueAndValidity();
  }

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.statusMessage.set('');

    if (!this.user) {
      this.errorMessage.set('No active session found. Please sign in again.');
      return;
    }

    if (this.usernameForm.pending) {
      return;
    }

    if (this.usernameForm.invalid) {
      this.usernameForm.markAllAsTouched();
      return;
    }

    try {
      this.loading.set(true);

      const username = this.usernameControl.getRawValue().trim();
      const { error } = await this.profiles.updateUsername(this.user.id, username);

      if (error) {
        throw error;
      }

      this.statusMessage.set('Username saved. Redirecting to your cards...');
      await this.router.navigateByUrl('/my/cards', { replaceUrl: true });
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to save your username.',
      );
    } finally {
      if (!this.destroyRef.destroyed) {
        this.loading.set(false);
      }
    }
  }
}
