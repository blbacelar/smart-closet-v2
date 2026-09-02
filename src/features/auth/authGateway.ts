import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type AuthIdentity = {
  id: string;
  email: string;
  displayName: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type SignUpInput = SignInInput & {
  displayName: string;
};

export type AuthGateway = {
  getCurrentIdentity: () => Promise<AuthIdentity | null>;
  subscribe: (listener: (identity: AuthIdentity | null) => void) => () => void;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add the public URL and key to .env.local.');
  }

  return supabase;
}

function toIdentity(user: User | null): AuthIdentity | null {
  if (!user) {
    return null;
  }

  const email = user.email ?? '';
  const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.full_name;

  return {
    id: user.id,
    email,
    displayName:
      typeof metadataName === 'string' && metadataName.trim()
        ? metadataName.trim()
        : email.split('@')[0] || 'Fitly member',
  };
}

export const supabaseAuthGateway: AuthGateway = {
  async getCurrentIdentity() {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return toIdentity(data.session?.user ?? null);
  },

  subscribe(listener) {
    if (!supabase) {
      return () => undefined;
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      listener(toIdentity(session?.user ?? null));
    });

    return () => data.subscription.unsubscribe();
  },

  async signIn(input) {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword(input);
    if (error) {
      throw error;
    }
  },

  async signUp({ displayName, email, password }) {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) {
      throw error;
    }

    return { requiresEmailConfirmation: !data.session };
  },

  async signOut() {
    const client = requireClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      throw error;
    }
  },
};
