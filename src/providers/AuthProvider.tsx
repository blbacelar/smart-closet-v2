import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthGateway,
  AuthIdentity,
  supabaseAuthGateway,
} from '../features/auth/authGateway';
import { observability, ObservabilityClient } from '../lib/observability';

type AuthContextValue = {
  identity: AuthIdentity | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  gateway?: AuthGateway;
  observabilityClient?: ObservabilityClient;
}>;

export function AuthProvider({
  children,
  gateway = supabaseAuthGateway,
  observabilityClient = observability,
}: AuthProviderProps) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let receivedAuthEvent = false;
    const unsubscribe = gateway.subscribe((nextIdentity) => {
      receivedAuthEvent = true;
      if (isMounted) {
        setIdentity(nextIdentity);
        setIsLoading(false);
      }
    });

    gateway
      .getCurrentIdentity()
      .then((nextIdentity) => {
        if (isMounted && !receivedAuthEvent) {
          setIdentity(nextIdentity);
        }
      })
      .catch((error) => {
        observabilityClient.captureError(error, {
          operation: 'auth_session_restore',
          code: 'session_restore_failed',
          fatal: false,
        });
        if (isMounted && !receivedAuthEvent) {
          setIdentity(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [gateway, observabilityClient]);

  useEffect(() => {
    observabilityClient.setUser(identity?.id ?? null);
  }, [identity?.id, observabilityClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      identity,
      isLoading,
      signOut: async () => {
        await gateway.signOut();
        setIdentity(null);
      },
      deleteAccount: async () => {
        await gateway.deleteAccount();
        setIdentity(null);
      },
    }),
    [gateway, identity, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
