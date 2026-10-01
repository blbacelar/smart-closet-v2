import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AuthScreen } from '../AuthScreen';
import { AuthGateway } from '../authGateway';
import { ObservabilityClient } from '../../../lib/observability';

function createGateway(): jest.Mocked<AuthGateway> {
  return {
    getCurrentIdentity: jest.fn(),
    subscribe: jest.fn(),
    signIn: jest.fn().mockResolvedValue(undefined),
    signInWithProvider: jest.fn().mockResolvedValue({ completed: true }),
    signUp: jest.fn().mockResolvedValue({ requiresEmailConfirmation: false }),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  };
}

function createTelemetry(): jest.Mocked<ObservabilityClient> {
  return {
    setUser: jest.fn(),
    track: jest.fn(),
    captureError: jest.fn(),
  };
}

describe('AuthScreen', () => {
  it('validates before sending sign-in credentials', async () => {
    const gateway = createGateway();
    const screen = await render(<AuthScreen gateway={gateway} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(gateway.signIn).not.toHaveBeenCalled();
  });

  it('normalizes credentials and signs in', async () => {
    const gateway = createGateway();
    const screen = await render(<AuthScreen gateway={gateway} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), ' BRUNO@Example.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(gateway.signIn).toHaveBeenCalledWith({
        email: 'bruno@example.com',
        password: 'password123',
      }),
    );
  });

  it('tracks successful email and provider authentication without identifiers', async () => {
    const gateway = createGateway();
    const telemetry = createTelemetry();
    const screen = await render(
      <AuthScreen gateway={gateway} observabilityClient={telemetry} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Email'), 'bruno@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(telemetry.track).toHaveBeenCalledWith('auth_signed_in', {
      method: 'email',
    }));

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(telemetry.track).toHaveBeenCalledWith('auth_signed_in', {
      method: 'google',
    }));
  });

  it.each([
    ['Google', 'google'],
    ['Apple', 'apple'],
  ] as const)('starts %s sign-in without requiring email fields', async (label, provider) => {
    const gateway = createGateway();
    const screen = await render(<AuthScreen gateway={gateway} />);

    await fireEvent.press(screen.getByRole('button', { name: `Continue with ${label}` }));

    await waitFor(() => expect(gateway.signInWithProvider).toHaveBeenCalledWith(provider));
    expect(gateway.signIn).not.toHaveBeenCalled();
  });

  it('creates an account and explains when email confirmation is required', async () => {
    const gateway = createGateway();
    gateway.signUp.mockResolvedValue({ requiresEmailConfirmation: true });
    const screen = await render(<AuthScreen gateway={gateway} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), ' Bruno ');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'bruno@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(gateway.signUp).toHaveBeenCalledWith({
        displayName: 'Bruno',
        email: 'bruno@example.com',
        password: 'password123',
      }),
    );
    expect(screen.getByText('Check your email to confirm your account.')).toBeTruthy();
  });

  it('exposes stable native identifiers for keyboard-driven authentication', async () => {
    const screen = await render(<AuthScreen gateway={createGateway()} />);

    expect(screen.getByTestId('auth-scroll')).toHaveProp('keyboardDismissMode', 'on-drag');
    expect(screen.getByTestId('auth-email-input')).toHaveProp('returnKeyType', 'next');
    expect(screen.getByTestId('auth-password-input')).toHaveProp('returnKeyType', 'done');

    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByTestId('auth-name-input')).toHaveProp('returnKeyType', 'next');
  });

  it('submits sign-in from the password keyboard action', async () => {
    const gateway = createGateway();
    const screen = await render(<AuthScreen gateway={gateway} />);

    await fireEvent.changeText(screen.getByTestId('auth-email-input'), 'bruno@example.com');
    await fireEvent.changeText(screen.getByTestId('auth-password-input'), 'password123');
    await fireEvent(screen.getByTestId('auth-password-input'), 'submitEditing');

    await waitFor(() => expect(gateway.signIn).toHaveBeenCalled());
  });

  it('shows authentication errors without losing the form', async () => {
    const gateway = createGateway();
    gateway.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    const screen = await render(<AuthScreen gateway={gateway} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'bruno@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
    expect(screen.getByDisplayValue('bruno@example.com')).toBeTruthy();
  });
});
