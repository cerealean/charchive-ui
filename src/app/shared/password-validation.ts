import { PathKind, SchemaPath, SchemaPathRules, validate } from '@angular/forms/signals';

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_STRENGTH_ERROR = 'passwordStrength';
export const PASSWORD_MISMATCH_ERROR = 'passwordMismatch';

export interface PasswordChecks {
  minLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

export function evaluatePassword(value: string): PasswordChecks {
  return {
    minLength: value.length >= MIN_PASSWORD_LENGTH,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

export function isStrongPassword(value: string): boolean {
  return Object.values(evaluatePassword(value)).every(Boolean);
}

export function passwordRequirements(value: string): { met: boolean; label: string }[] {
  const checks = evaluatePassword(value ?? '');
  return [
    { met: checks.minLength, label: `At least ${MIN_PASSWORD_LENGTH} characters` },
    { met: checks.lowercase, label: 'One lowercase letter' },
    { met: checks.uppercase, label: 'One uppercase letter' },
    { met: checks.number, label: 'One number' },
    { met: checks.symbol, label: 'One symbol' },
  ];
}

// Signal Forms validator: marks the field invalid until the password satisfies
// every strength requirement. The requirement checklist (passwordRequirements)
// is what surfaces the specifics to the user.
export function validatePasswordStrength<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
): void {
  validate(path, ({ value }) =>
    isStrongPassword(value())
      ? undefined
      : { kind: PASSWORD_STRENGTH_ERROR, message: 'Password does not meet the requirements below.' },
  );
}

// Signal Forms cross-field validator: flags the confirmation field when it does
// not match the password field it is paired with.
export function validatePasswordsMatch<TPathKind extends PathKind = PathKind.Root>(
  confirmPath: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  passwordPath: SchemaPath<string, SchemaPathRules>,
): void {
  validate(confirmPath, ({ value, valueOf }) =>
    value() === valueOf(passwordPath)
      ? undefined
      : { kind: PASSWORD_MISMATCH_ERROR, message: 'Passwords do not match.' },
  );
}
