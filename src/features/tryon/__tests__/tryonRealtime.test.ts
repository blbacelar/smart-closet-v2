let mockSupabase: any;

jest.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

import { createTryOnRealtime, supabaseTryOnRealtime } from '../tryonRealtime';

function createClient() {
  const channel = { on: jest.fn(), subscribe: jest.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  const client = {
    channel: jest.fn().mockReturnValue(channel),
    removeChannel: jest.fn().mockResolvedValue('ok'),
  };
  return { channel, client };
}

describe('try-on Realtime', () => {
  it('subscribes only to updates for the authenticated member jobs', () => {
    const callback = jest.fn();
    const { channel, client } = createClient();
    const realtime = createTryOnRealtime(client as never);

    realtime.subscribe('user-1', callback);

    expect(client.channel).toHaveBeenCalledWith('tryon-jobs:user-1');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tryon_jobs',
        filter: 'user_id=eq.user-1',
      },
      callback,
    );
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it('removes the private channel when the screen unmounts', () => {
    const { channel, client } = createClient();
    const realtime = createTryOnRealtime(client as never);

    const unsubscribe = realtime.subscribe('user-1', jest.fn());
    unsubscribe();

    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('stays inert when Supabase is not configured', () => {
    mockSupabase = null;

    const unsubscribe = supabaseTryOnRealtime.subscribe('user-1', jest.fn());

    expect(unsubscribe()).toBeUndefined();
  });

  it('uses the configured shared Supabase client', () => {
    const { channel, client } = createClient();
    mockSupabase = client;

    const unsubscribe = supabaseTryOnRealtime.subscribe('user-1', jest.fn());
    unsubscribe();

    expect(client.channel).toHaveBeenCalledWith('tryon-jobs:user-1');
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
