import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthGateway,
  AuthIdentity,
  supabaseAuthGateway,
} from '../features/auth/authGateway';

type AuthContextValue = {
  identity: AuthIdentity | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  gateway?: AuthGateway;
}>;

export function AuthProvider({ children, gateway = supabaseAuthGateway }: AuthProviderProps) {
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
      .catch(() => {
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
  }, [gateway]);

  const value = useMemo<AuthContextValue>(
    () => ({
      identity,
      isLoading,
      signOut: async () => {
        await gateway.signOut();
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
