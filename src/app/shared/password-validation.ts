import { AbstractControl, ValidationErrors } from '@angular/forms';

export const MIN_PASSWORD_LENGTH = 8;

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

export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value ?? '';
  const checks = evaluatePassword(value);
  return isStrongPassword(value) ? null : { passwordStrength: checks };
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

export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}
