import { createSupabaseObservabilityAdapter } from '../supabaseObservabilityAdapter';

describe('Supabase observability adapter', () => {
  it('does not write until an opaque member id is set', () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const client = { from: jest.fn(() => ({ insert })) };
    const adapter = createSupabaseObservabilityAdapter(client as never);

    adapter.track('app_opened', { source: 'launch' });

    expect(insert).not.toHaveBeenCalled();
  });

  it('writes allowlisted events and safe errors for the current member', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const client = { from: jest.fn(() => ({ insert })) };
    const adapter = createSupabaseObservabilityAdapter(client as never);
    adapter.setUser({ id: 'user-1' });

    adapter.track('tryon_requested', { cached: false });
    adapter.captureError({
      name: 'Error',
      operation: 'render',
      code: 'unexpected',
      fatal: false,
    });
    await Promise.resolve();

    expect(client.from).toHaveBeenCalledWith('analytics_events');
    expect(insert).toHaveBeenNthCalledWith(1, {
      user_id: 'user-1',
      event_name: 'tryon_requested',
      properties: { cached: false },
    });
    expect(insert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      user_id: 'user-1',
      event_name: 'app_error',
    }));
  });

  it('swallows an unavailable analytics backend', async () => {
    const client = {
      from: jest.fn(() => ({ insert: jest.fn().mockRejectedValue(new Error('offline')) })),
    } as never;
    const adapter = createSupabaseObservabilityAdapter(client);
    adapter.setUser({ id: 'user-1' });

    expect(() => adapter.track('app_opened', {})).not.toThrow();
    await Promise.resolve();
  });
});
