export type AuthMode = 'sign-in' | 'sign-up';

export type AuthFields = {
  displayName: string;
  email: string;
  password: string;
};

export type AuthFieldErrors = Partial<Record<keyof AuthFields, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthForm(fields: AuthFields, mode: AuthMode) {
  const values: AuthFields = {
    displayName: fields.displayName.trim(),
    email: fields.email.trim().toLowerCase(),
    password: fields.password,
  };
  const errors: AuthFieldErrors = {};

  if (mode === 'sign-up' && !values.displayName) {
    errors.displayName = 'Enter your name.';
  }

  if (!emailPattern.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }

  return { values, errors };
}
