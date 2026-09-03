import { createTryOnRealtime } from '../tryonRealtime';

describe('try-on Realtime', () => {
  it('subscribes only to updates for the authenticated member jobs', () => {
    const callback = jest.fn();
    const channel = { on: jest.fn(), subscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = {
      channel: jest.fn().mockReturnValue(channel),
      removeChannel: jest.fn().mockResolvedValue('ok'),
    };
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
    const channel = { on: jest.fn(), subscribe: jest.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = {
      channel: jest.fn().mockReturnValue(channel),
      removeChannel: jest.fn().mockResolvedValue('ok'),
    };
    const realtime = createTryOnRealtime(client as never);

    const unsubscribe = realtime.subscribe('user-1', jest.fn());
    unsubscribe();

    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
