import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { catchError, from, map, merge, of, startWith, switchMap, timer } from 'rxjs';

import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-username-setup',
  imports: [ReactiveFormsModule],
  templateUrl: './username-setup.html',
  styleUrl: './username-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsernameSetupComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly statusMessage = signal('');
  protected user: User | null = null;

  readonly usernameForm = this.formBuilder.nonNullable.group({
    username: this.formBuilder.nonNullable.control('', {
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(64)],
      asyncValidators: [this.usernameAvailabilityValidator.bind(this)],
    }),
  });

  private readonly usernameControlChanges = toSignal(
    merge(this.usernameControl.valueChanges, this.usernameControl.statusChanges).pipe(
      startWith(null),
    ),
  );

  private readonly usernameFormChanges = toSignal(
    merge(this.usernameForm.valueChanges, this.usernameForm.statusChanges).pipe(startWith(null)),
  );

  protected readonly usernameStatus = computed(() => {
    this.usernameControlChanges();

    const control = this.usernameControl;
    const value = control.getRawValue().trim();

    if (!value || control.pending) {
      return control.pending ? 'checking' : 'idle';
    }

    if (control.hasError('usernameTaken') || control.hasError('usernameLookupFailed')) {
      return 'taken';
    }

    if (control.valid) {
      return 'available';
    }

    return 'idle';
  });

  protected readonly submitDisabled = computed(() => {
    this.usernameFormChanges();

    return this.loading() || this.usernameForm.pending || this.usernameForm.invalid;
  });

  get usernameControl() {
    return this.usernameForm.controls.username;
  }

  async ngOnInit(): Promise<void> {
    this.user = await this.supabase.getUser();

    if (!this.user) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    if (await this.supabase.userHasUsername(this.user)) {
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
      const { error } = await this.supabase.updateUsername(this.user.id, username);

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

  private usernameAvailabilityValidator(control: AbstractControl<string>) {
    const username = control.getRawValue().trim();

    if (!username || username.length < 3 || !this.user) {
      return of(null);
    }

    return timer(250).pipe(
      switchMap(() => from(this.supabase.isUsernameAvailable(username, this.user?.id))),
      map((isAvailable): ValidationErrors | null => (isAvailable ? null : { usernameTaken: true })),
      catchError(() => of({ usernameLookupFailed: true })),
    );
  }
}
