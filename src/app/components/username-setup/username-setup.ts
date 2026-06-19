import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormField,
  debounce,
  form,
  maxLength,
  minLength,
  required,
  submit as submitForm,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';

import { AuthService } from '../../services/auth';
import { ProfileService } from '../../services/profile';
import {
  USERNAME_LOOKUP_FAILED_ERROR,
  USERNAME_TAKEN_ERROR,
  UsernameStatus,
  validateUsernameAvailability,
} from '../../shared/username-validation';

@Component({
  selector: 'app-username-setup',
  imports: [FormField],
  templateUrl: './username-setup.html',
  styleUrl: './username-setup.css',
})
export class UsernameSetupComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly statusMessage = signal('');
  protected user: User | null = null;

  protected readonly usernameModel = signal({ username: '' });

  readonly usernameForm = form(this.usernameModel, (path) => {
    required(path.username, { message: 'Username is required.' });
    minLength(path.username, 3, { message: 'Username must be at least 3 characters.' });
    maxLength(path.username, 64, { message: 'Username must be 64 characters or fewer.' });
    debounce(path.username, 250);
    validateUsernameAvailability(path.username, this.profiles, () => this.user);
  });

  protected readonly usernameStatus = computed<UsernameStatus>(() => {
    const field = this.usernameForm.username();

    if (field.pending()) {
      return 'checking';
    }

    if (!field.value().trim()) {
      return 'idle';
    }

    const errors = field.errors();
    if (errors.some((error) => error.kind === USERNAME_TAKEN_ERROR || error.kind === USERNAME_LOOKUP_FAILED_ERROR)) {
      return 'taken';
    }

    return field.valid() ? 'available' : 'idle';
  });

  protected get submitDisabled(): boolean {
    return this.loading() || this.usernameForm().pending() || this.usernameForm().invalid();
  }

  async ngOnInit(): Promise<void> {
    this.user = await this.auth.getUser();

    if (!this.user) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    if (await this.profiles.userHasUsername(this.user)) {
      await this.router.navigateByUrl('/my/cards', { replaceUrl: true });
    }
  }

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.statusMessage.set('');

    if (!this.user) {
      this.errorMessage.set('No active session found. Please sign in again.');
      return;
    }

    const user = this.user;

    await submitForm(this.usernameForm, async () => {
      try {
        this.loading.set(true);
        const username = this.usernameModel().username.trim();
        const { error } = await this.profiles.updateUsername(user.id, username);

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
        this.loading.set(false);
      }
    });
  }
}
