import type { User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type AuthIdentity = {
  id: string;
  email: string;
  displayName: string;
  adultConfirmed: boolean;
};

type SignInInput = {
  email: string;
  password: string;
  adultConfirmed: true;
};

type SignUpInput = SignInInput & {
  displayName: string;
};

export type SocialAuthProvider = 'apple' | 'google';

export type AuthGateway = {
  getCurrentIdentity: () => Promise<AuthIdentity | null>;
  subscribe: (listener: (identity: AuthIdentity | null) => void) => () => void;
  signIn: (input: SignInInput) => Promise<void>;
  signInWithProvider: (
    provider: SocialAuthProvider,
    input: { adultConfirmed: true },
  ) => Promise<{ completed: boolean }>;
  signUp: (input: SignUpInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  confirmAdultStatus: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const deletionFailureMessage = "We couldn't delete your account. Please try again.";
const socialAuthFailureMessage = 'Could not complete social sign-in. Try again.';
const adultConfirmationFailureMessage = 'Could not confirm account eligibility. Try again.';

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
    adultConfirmed: user.user_metadata?.adult_confirmed === true,
  };
}

function readOAuthTokens(callbackUrl: string) {
  const fragment = callbackUrl.split('#')[1] ?? '';
  const query = callbackUrl.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(fragment || query);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    throw new Error(socialAuthFailureMessage);
  }

  return { access_token: accessToken, refresh_token: refreshToken };
}

async function confirmAdultStatus(client: ReturnType<typeof requireClient>) {
  const { error } = await client.rpc('confirm_adult_status');
  if (error) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error(adultConfirmationFailureMessage);
  }

  const { error: metadataError } = await client.auth.updateUser({
    data: { adult_confirmed: true },
  });
  if (metadataError) {
    throw new Error(adultConfirmationFailureMessage);
  }
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

  async signIn({ email, password, adultConfirmed }) {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    if (adultConfirmed) {
      await confirmAdultStatus(client);
    }
  },

  async signInWithProvider(provider, { adultConfirmed }) {
    const client = requireClient();
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      throw new Error(socialAuthFailureMessage);
    }

    const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      preferEphemeralSession: true,
    });
    if (browserResult.type !== 'success') {
      return { completed: false };
    }

    const { error: sessionError } = await client.auth.setSession(readOAuthTokens(browserResult.url));
    if (sessionError) {
      throw new Error(socialAuthFailureMessage);
    }
    if (adultConfirmed) {
      await confirmAdultStatus(client);
    }
    return { completed: true };
  },

  async signUp({ displayName, email, password, adultConfirmed }) {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, adult_confirmed: adultConfirmed } },
    });
    if (error) {
      throw error;
    }

    return { requiresEmailConfirmation: !data.session };
  },

  async confirmAdultStatus() {
    await confirmAdultStatus(requireClient());
  },

  async signOut() {
    const client = requireClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) {
      throw error;
    }
  },

  async deleteAccount() {
    const client = requireClient();
    const { data, error } = await client.functions.invoke('delete-account', {
      body: { confirmation: 'DELETE' },
    });
    if (
      error
      || typeof data !== 'object'
      || data === null
      || !('deleted' in data)
      || data.deleted !== true
    ) {
      throw new Error(deletionFailureMessage);
    }

    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      // The server deletion already revoked refresh access. The provider clears
      // its in-memory identity even if the local SDK reports an expired session.
    }
  },
};
