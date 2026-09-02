import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import { AuthGateway, AuthIdentity } from '../../features/auth/authGateway';
import { AuthProvider, useAuth } from '../AuthProvider';

const bruno: AuthIdentity = {
  id: 'user-1',
  email: 'bruno@example.com',
  displayName: 'Bruno',
};

function createGateway(initialIdentity: AuthIdentity | null = bruno) {
  let listener: (identity: AuthIdentity | null) => void = () => undefined;
  const unsubscribe = jest.fn();
  const gateway: AuthGateway = {
    getCurrentIdentity: jest.fn().mockResolvedValue(initialIdentity),
    subscribe: jest.fn((nextListener) => {
      listener = nextListener;
      return unsubscribe;
    }),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  };

  return { gateway, emit: (identity: AuthIdentity | null) => listener(identity), unsubscribe };
}

describe('AuthProvider', () => {
  it('restores the existing identity and tracks auth changes', async () => {
    const { gateway, emit, unsubscribe } = createGateway();
    let resolveIdentity: (identity: AuthIdentity | null) => void = () => undefined;
    gateway.getCurrentIdentity = jest.fn(
      () => new Promise<AuthIdentity | null>((resolve) => {
        resolveIdentity = resolve;
      }),
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
    );
    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await act(() => resolveIdentity(bruno));
    await waitFor(() => expect(result.current.identity).toEqual(bruno));
    expect(result.current.isLoading).toBe(false);

    await act(() => emit(null));
    expect(result.current.identity).toBeNull();

    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('signs out the current device and clears the local identity', async () => {
    const { gateway } = createGateway();
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.signOut());

    expect(gateway.signOut).toHaveBeenCalledTimes(1);
    expect(result.current.identity).toBeNull();
  });

  it('keeps a newer auth event when initial session restoration finishes later', async () => {
    const { gateway, emit } = createGateway(null);
    let resolveIdentity: (identity: AuthIdentity | null) => void = () => undefined;
    gateway.getCurrentIdentity = jest.fn(
      () => new Promise<AuthIdentity | null>((resolve) => {
        resolveIdentity = resolve;
      }),
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await act(() => emit(bruno));
    await act(() => resolveIdentity(null));

    expect(result.current.identity).toEqual(bruno);
    expect(result.current.isLoading).toBe(false);
  });

  it('settles as signed out when session restoration fails', async () => {
    const { gateway } = createGateway();
    gateway.getCurrentIdentity = jest.fn().mockRejectedValue(new Error('Storage unavailable'));
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.identity).toBeNull();
  });
});
