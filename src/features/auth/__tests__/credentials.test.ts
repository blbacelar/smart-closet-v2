import { validateAuthForm } from '../credentials';

describe('validateAuthForm', () => {
  it('normalizes valid sign-in credentials', () => {
    expect(
      validateAuthForm(
        { displayName: '', email: '  BRUNO@Example.com ', password: 'password123' },
        'sign-in',
      ),
    ).toEqual({
      values: {
        displayName: '',
        email: 'bruno@example.com',
        password: 'password123',
      },
      errors: {},
    });
  });

  it('reports invalid email and a short password', () => {
    expect(
      validateAuthForm(
        { displayName: '', email: 'not-an-email', password: 'short' },
        'sign-in',
      ).errors,
    ).toEqual({
      email: 'Enter a valid email address.',
      password: 'Use at least 8 characters.',
    });
  });

  it('requires a display name only when creating an account', () => {
    const fields = { displayName: ' ', email: 'bruno@example.com', password: 'password123' };

    expect(validateAuthForm(fields, 'sign-in').errors.displayName).toBeUndefined();
    expect(validateAuthForm(fields, 'sign-up').errors.displayName).toBe('Enter your name.');
  });
});
