import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '@supabase/supabase-js';
import { Profile, SupabaseService } from '../services/supabase';
import { AvatarComponent } from '../avatar/avatar';

@Component({
  selector: 'app-account',
  templateUrl: './account.html',
  styleUrls: ['./account.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AvatarComponent],
})
export class AccountComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  loading = false;
  statusMessage = '';
  errorMessage = '';
  profile?: Profile;
  readonly updateProfileForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.maxLength(64)]],
    website: ['', [Validators.pattern(/^$|^https?:\/\/\S+$/i)]],
    avatar_url: [''],
  });

  @Input()
  user: User | null = null;

  get avatarUrl() {
    return this.updateProfileForm.controls.avatar_url.getRawValue();
  }

  get websiteControl() {
    return this.updateProfileForm.controls.website;
  }

  async updateAvatar(event: string): Promise<void> {
    this.statusMessage = '';
    this.errorMessage = '';

    this.updateProfileForm.patchValue({
      avatar_url: event,
    });

    await this.updateProfile();
  }

  async ngOnInit(): Promise<void> {
    if (!this.user) {
      this.user = await this.supabase.getUser();
    }

    if (!this.user) {
      this.errorMessage = 'No active session found. Please sign in again.';
      return;
    }

    await this.getProfile();

    if (!this.profile) {
      this.detectChangesSafely();
      return;
    }

    const { username, website, avatar_url } = this.profile;
    this.updateProfileForm.patchValue({
      username,
      website,
      avatar_url,
    });

    this.detectChangesSafely();
  }

  async getProfile() {
    this.errorMessage = '';

    try {
      this.loading = true;
      if (!this.user) {
        throw new Error('No active user is available for profile loading.');
      }

      const { data: profile, error, status } = await this.supabase.profile(this.user);

      if (error && status !== 406) {
        throw error;
      }

      if (profile) {
        this.profile = profile;
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to load your profile.';
    } finally {
      this.loading = false;
      this.detectChangesSafely();
    }
  }

  async updateProfile(): Promise<void> {
    this.statusMessage = '';
    this.errorMessage = '';

    if (this.updateProfileForm.invalid) {
      this.updateProfileForm.markAllAsTouched();
      return;
    }

    try {
      this.loading = true;

      if (!this.user) {
        throw new Error('No active user is available for profile updates.');
      }

      const username = this.updateProfileForm.controls.username.getRawValue()?.trim();
      const website = this.updateProfileForm.controls.website.getRawValue()?.trim();
      const avatar_url = this.updateProfileForm.controls.avatar_url.getRawValue()?.trim();

      const { error } = await this.supabase.updateProfile({
        id: this.user.id,
        username,
        website,
        avatar_url,
      });

      if (error) {
        throw error;
      }

      this.statusMessage = 'Profile saved successfully.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to save your profile.';
    } finally {
      this.loading = false;
      this.detectChangesSafely();
    }
  }

  async signOut() {
    this.statusMessage = '';
    this.errorMessage = '';

    try {
      this.loading = true;
      await this.supabase.signOut();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to sign out.';
    } finally {
      this.loading = false;
      this.detectChangesSafely();
    }
  }

  private detectChangesSafely(): void {
    if (!this.destroyRef.destroyed) {
      this.cdr.detectChanges();
    }
  }
}
