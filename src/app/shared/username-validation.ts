import { resource } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors, Validators } from '@angular/forms';
import { SchemaPath, SchemaPathRules, validateAsync } from '@angular/forms/signals';
import { User } from '@supabase/supabase-js';
import { catchError, from, map, of, switchMap, timer } from 'rxjs';

import { ProfileService } from '../services/profile';

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

export const USERNAME_TAKEN_ERROR = 'usernameTaken';
export const USERNAME_LOOKUP_FAILED_ERROR = 'usernameLookupFailed';

export const usernameSyncValidators = [
  Validators.required,
  Validators.minLength(3),
  Validators.maxLength(64),
];

export function createUsernameAvailabilityValidator(
  profiles: ProfileService,
  getUser: () => User | null,
): AsyncValidatorFn {
  return (control: AbstractControl<string>) => {
    const username = control.getRawValue().trim();
    const user = getUser();

    if (!username || username.length < 3 || !user) {
      return of(null);
    }

    return timer(250).pipe(
      switchMap(() => from(profiles.isUsernameAvailable(username, user.id))),
      map((isAvailable): ValidationErrors | null => (isAvailable ? null : { usernameTaken: true })),
      catchError(() => of({ usernameLookupFailed: true })),
    );
  };
}

// Signal Forms async validator that mirrors createUsernameAvailabilityValidator:
// it only queries once a candidate (>= 3 chars) and an active user are present,
// and reports availability lookups that come back taken or fail outright.
export function validateUsernameAvailability(
  path: SchemaPath<string, SchemaPathRules.Supported>,
  profiles: ProfileService,
  getUser: () => User | null,
): void {
  validateAsync(path, {
    params: ({ value }) => {
      const username = value().trim();
      const user = getUser();
      return username.length >= 3 && user ? { username, userId: user.id } : undefined;
    },
    factory: (params) =>
      resource({
        params,
        loader: async ({ params: lookup }) =>
          lookup ? profiles.isUsernameAvailable(lookup.username, lookup.userId) : true,
      }),
    onSuccess: (isAvailable) =>
      isAvailable ? undefined : { kind: USERNAME_TAKEN_ERROR, message: 'That username is already taken.' },
    onError: () => ({
      kind: USERNAME_LOOKUP_FAILED_ERROR,
      message: 'We could not verify that username right now.',
    }),
  });
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
