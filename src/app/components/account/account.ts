import { Component, OnInit, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '@supabase/supabase-js';
import { merge, startWith } from 'rxjs';

import { Profile } from '../../interfaces/profile.interface';
import { AuthService } from '../../services/auth';
import { ProfileService } from '../../services/profile';
import {
  createUsernameAvailabilityValidator,
  getUsernameStatus,
  usernameSyncValidators,
} from '../../shared/username-validation';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { AvatarComponent } from '../avatar/avatar';
import { ChangePasswordComponent } from '../change-password/change-password';

const ABOUT_ME_MAX_LENGTH = 2000;

@Component({
  selector: 'app-account',
  templateUrl: './account.html',
  styleUrls: ['./account.css'],
  imports: [ReactiveFormsModule, AvatarComponent, ChangePasswordComponent, MarkdownPipe],
})
export class AccountComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfileService);
  private readonly formBuilder = inject(FormBuilder);

  readonly user = input<User | null>(null);
  protected readonly currentUser = linkedSignal(() => this.user());

  readonly loading = signal(false);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly hasPassword = signal(false);
  private readonly profile = signal<Profile | undefined>(undefined);

  readonly updateProfileForm = this.formBuilder.nonNullable.group({
    username: this.formBuilder.nonNullable.control('', {
      validators: usernameSyncValidators,
      asyncValidators: [createUsernameAvailabilityValidator(this.profiles, () => this.currentUser())],
    }),
    website: ['', [Validators.pattern(/^$|^https?:\/\/\S+$/i)]],
    avatar_url: [''],
    about_me: ['', [Validators.maxLength(ABOUT_ME_MAX_LENGTH)]],
  });

  protected readonly aboutMeMaxLength = ABOUT_ME_MAX_LENGTH;

  private readonly usernameControlChanges = toSignal(
    merge(this.usernameControl.valueChanges, this.usernameControl.statusChanges).pipe(
      startWith(null),
    ),
  );

  private readonly updateProfileFormChanges = toSignal(
    merge(this.updateProfileForm.valueChanges, this.updateProfileForm.statusChanges).pipe(
      startWith(null),
    ),
  );

  protected readonly usernameStatus = computed(() => {
    this.usernameControlChanges();

    return getUsernameStatus(this.usernameControl);
  });

  protected readonly showUsernameAvailabilityFeedback = computed(() => {
    this.usernameControlChanges();

    return this.usernameControl.dirty;
  });

  get avatarUrl() {
    return this.updateProfileForm.controls.avatar_url.getRawValue();
  }

  get websiteControl() {
    return this.updateProfileForm.controls.website;
  }

  get aboutMeControl() {
    return this.updateProfileForm.controls.about_me;
  }

  protected readonly aboutMeValue = toSignal(this.aboutMeControl.valueChanges, {
    initialValue: '',
  });

  get usernameControl() {
    return this.updateProfileForm.controls.username;
  }

  protected get saveDisabled() {
    this.updateProfileFormChanges();

    return this.loading() || this.updateProfileForm.pending || this.updateProfileForm.invalid;
  }

  async updateAvatar(event: string): Promise<void> {
    this.statusMessage.set('');
    this.errorMessage.set('');

    this.updateProfileForm.patchValue({
      avatar_url: event,
    });

    await this.updateProfile();
  }

  async ngOnInit(): Promise<void> {
    if (!this.currentUser()) {
      this.currentUser.set(await this.auth.getUser());
    }

    if (!this.currentUser()) {
      this.errorMessage.set('No active session found. Please sign in again.');
      return;
    }

    this.hasPassword.set(await this.auth.hasPassword());

    await this.getProfile();

    const profile = this.profile();
    if (!profile) {
      return;
    }

    const { username, website, avatar_url, about_me } = profile;
    this.updateProfileForm.patchValue({
      username: username ?? '',
      website: website ?? '',
      avatar_url: avatar_url ?? '',
      about_me: about_me ?? '',
    });
    this.usernameControl.updateValueAndValidity();
  }

  async getProfile() {
    this.errorMessage.set('');

    try {
      this.loading.set(true);
      const user = this.currentUser();
      if (!user) {
        throw new Error('No active user is available for profile loading.');
      }

      const { data: profile, error, status } = await this.profiles.profile(user);

      if (error && status !== 406) {
        throw error;
      }

      if (profile) {
        this.profile.set(profile);
      }
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load your profile.');
    } finally {
      this.loading.set(false);
    }
  }

  async updateProfile(): Promise<void> {
    this.statusMessage.set('');
    this.errorMessage.set('');

    if (this.updateProfileForm.invalid) {
      this.updateProfileForm.markAllAsTouched();
      return;
    }

    try {
      this.loading.set(true);

      const user = this.currentUser();
      if (!user) {
        throw new Error('No active user is available for profile updates.');
      }

      const username = this.updateProfileForm.controls.username.getRawValue().trim();
      const website = this.updateProfileForm.controls.website.getRawValue()?.trim();
      const avatar_url = this.updateProfileForm.controls.avatar_url.getRawValue()?.trim();
      const about_me = this.updateProfileForm.controls.about_me.getRawValue()?.trim() || null;

      const { error } = await this.profiles.updateProfile({
        id: user.id,
        username,
        website,
        avatar_url,
        about_me,
      });

      if (error) {
        throw error;
      }

      this.statusMessage.set('Profile saved successfully.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to save your profile.');
    } finally {
      this.loading.set(false);
    }
  }

  onPasswordSaved(created: boolean): void {
    this.statusMessage.set(
      created ? 'Password created successfully.' : 'Password updated successfully.',
    );
    this.errorMessage.set('');
    this.hasPassword.set(true);
  }
}
