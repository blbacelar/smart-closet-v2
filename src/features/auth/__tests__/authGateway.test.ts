let mockSupabase: any;

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

import { supabaseAuthGateway } from '../authGateway';

function createClient() {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: { deleted: true }, error: null }),
    },
  };
}

const user = {
  id: 'user-1',
  email: 'bruno@example.com',
  user_metadata: { display_name: '  Bruno Bacelar  ' },
};

describe('supabaseAuthGateway', () => {
  beforeEach(() => {
    mockSupabase = createClient();
  });

  it('maps the persisted Supabase user into an app identity', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user } },
      error: null,
    });

    await expect(supabaseAuthGateway.getCurrentIdentity()).resolves.toEqual({
      id: 'user-1',
      email: 'bruno@example.com',
      displayName: 'Bruno Bacelar',
    });
  });

  it('uses the email prefix when profile metadata has no name', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { ...user, user_metadata: {} } } },
      error: null,
    });

    await expect(supabaseAuthGateway.getCurrentIdentity()).resolves.toMatchObject({
      displayName: 'bruno',
    });
  });

  it('accepts the legacy full_name metadata key', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { ...user, user_metadata: { full_name: 'Legacy Name' } },
        },
      },
      error: null,
    });

    await expect(supabaseAuthGateway.getCurrentIdentity()).resolves.toMatchObject({
      displayName: 'Legacy Name',
    });
  });

  it('returns no identity when there is no session or client', async () => {
    await expect(supabaseAuthGateway.getCurrentIdentity()).resolves.toBeNull();
    mockSupabase = null;
    await expect(supabaseAuthGateway.getCurrentIdentity()).resolves.toBeNull();
  });

  it('propagates a session restoration error', async () => {
    const error = new Error('Storage unavailable');
    mockSupabase.auth.getSession.mockResolvedValue({ data: {}, error });

    await expect(supabaseAuthGateway.getCurrentIdentity()).rejects.toBe(error);
  });

  it('subscribes to auth changes and releases the subscription', () => {
    let authListener: (_event: string, session: unknown) => void = () => undefined;
    const unsubscribe = jest.fn();
    mockSupabase.auth.onAuthStateChange.mockImplementation((listener: typeof authListener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe } } };
    });
    const listener = jest.fn();

    const release = supabaseAuthGateway.subscribe(listener);
    authListener('SIGNED_IN', { user });
    authListener('SIGNED_OUT', null);
    release();

    expect(listener).toHaveBeenNthCalledWith(1, {
      id: 'user-1',
      email: 'bruno@example.com',
      displayName: 'Bruno Bacelar',
    });
    expect(listener).toHaveBeenNthCalledWith(2, null);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns a harmless subscription release when unconfigured', () => {
    mockSupabase = null;
    const listener = jest.fn();

    expect(supabaseAuthGateway.subscribe(listener)()).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it('signs in with a password and propagates provider errors', async () => {
    const input = { email: 'bruno@example.com', password: 'password123' };

    await supabaseAuthGateway.signIn(input);
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith(input);

    const error = new Error('Invalid login credentials');
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ error });
    await expect(supabaseAuthGateway.signIn(input)).rejects.toBe(error);
  });

  it('creates an account with profile metadata and reports confirmation state', async () => {
    const input = {
      displayName: 'Bruno',
      email: 'bruno@example.com',
      password: 'password123',
    };

    await expect(supabaseAuthGateway.signUp(input)).resolves.toEqual({
      requiresEmailConfirmation: true,
    });
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName } },
    });

    mockSupabase.auth.signUp.mockResolvedValue({ data: { session: { user } }, error: null });
    await expect(supabaseAuthGateway.signUp(input)).resolves.toEqual({
      requiresEmailConfirmation: false,
    });
  });

  it('propagates sign-up errors', async () => {
    const error = new Error('Email already registered');
    mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error });

    await expect(
      supabaseAuthGateway.signUp({
        displayName: 'Bruno',
        email: 'bruno@example.com',
        password: 'password123',
      }),
    ).rejects.toBe(error);
  });

  it('signs out only the current device and propagates provider errors', async () => {
    await supabaseAuthGateway.signOut();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    const error = new Error('Network unavailable');
    mockSupabase.auth.signOut.mockResolvedValue({ error });
    await expect(supabaseAuthGateway.signOut()).rejects.toBe(error);
  });

  it('permanently deletes the authenticated account and clears the local session', async () => {
    await supabaseAuthGateway.deleteAccount();

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('delete-account', {
      body: { confirmation: 'DELETE' },
    });
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not expose provider details or sign out when account deletion fails', async () => {
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error('service_role database detail'),
    });

    await expect(supabaseAuthGateway.deleteAccount()).rejects.toThrow(
      "We couldn't delete your account. Please try again.",
    );
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('treats server deletion as successful even if local sign-out reports an error', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: new Error('session already removed') });

    await expect(supabaseAuthGateway.deleteAccount()).resolves.toBeUndefined();
  });

  it('explains missing Supabase configuration for mutations', async () => {
    mockSupabase = null;

    await expect(
      supabaseAuthGateway.signIn({ email: 'bruno@example.com', password: 'password123' }),
    ).rejects.toThrow('Supabase is not configured');
  });
});
