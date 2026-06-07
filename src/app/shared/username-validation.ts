import { AbstractControl, AsyncValidatorFn, ValidationErrors, Validators } from '@angular/forms';
import { User } from '@supabase/supabase-js';
import { catchError, from, map, of, switchMap, timer } from 'rxjs';

import { SupabaseService } from '../services/supabase';

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export const usernameSyncValidators = [
  Validators.required,
  Validators.minLength(3),
  Validators.maxLength(64),
];

export function createUsernameAvailabilityValidator(
  supabase: SupabaseService,
  getUser: () => User | null,
): AsyncValidatorFn {
  return (control: AbstractControl<string>) => {
    const username = control.getRawValue().trim();
    const user = getUser();

    if (!username || username.length < 3 || !user) {
      return of(null);
    }

    return timer(250).pipe(
      switchMap(() => from(supabase.isUsernameAvailable(username, user.id))),
      map((isAvailable): ValidationErrors | null => (isAvailable ? null : { usernameTaken: true })),
      catchError(() => of({ usernameLookupFailed: true })),
    );
  };
}

export function getUsernameStatus(control: AbstractControl<string>): UsernameStatus {
  const value = control.getRawValue().trim();

  if (!value || control.pending) {
    return control.pending ? 'checking' : 'idle';
  }

  if (control.hasError('usernameTaken') || control.hasError('usernameLookupFailed')) {
    return 'taken';
  }

  return control.valid ? 'available' : 'idle';
}
