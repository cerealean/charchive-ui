import { FormControl } from '@angular/forms';

import {
  evaluatePassword,
  isStrongPassword,
  passwordStrengthValidator,
} from './password-validation';

describe('password-validation', () => {
  it('reports each unmet requirement', () => {
    const checks = evaluatePassword('abc');

    expect(checks).toEqual({
      minLength: false,
      lowercase: true,
      uppercase: false,
      number: false,
      symbol: false,
    });
  });

  it('accepts a password meeting every requirement', () => {
    expect(isStrongPassword('Str0ng!Pass')).toBe(true);
    expect(evaluatePassword('Str0ng!Pass')).toEqual({
      minLength: true,
      lowercase: true,
      uppercase: true,
      number: true,
      symbol: true,
    });
  });

  it('rejects a password missing a symbol or number', () => {
    expect(isStrongPassword('Strongpass')).toBe(false);
    expect(isStrongPassword('Strongpass1')).toBe(false);
  });

  it('validator returns the failing checks for a weak password', () => {
    const error = passwordStrengthValidator(new FormControl('weak'));

    expect(error?.['passwordStrength']).toMatchObject({ minLength: false, uppercase: false });
  });

  it('validator returns null for a strong password', () => {
    expect(passwordStrengthValidator(new FormControl('Str0ng!Pass'))).toBeNull();
  });
});
