import { createSupabaseObservabilityAdapter } from '../supabaseObservabilityAdapter';

describe('Supabase observability adapter', () => {
  it('does not write until an opaque member id is set', () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const client = { rpc };
    const adapter = createSupabaseObservabilityAdapter(client as never);

    adapter.track('app_opened', { source: 'launch' });

    expect(rpc).not.toHaveBeenCalled();
  });

  it('writes allowlisted events and safe errors for the current member', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    const client = { rpc };
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

    expect(rpc).toHaveBeenNthCalledWith(1, 'record_analytics_event', {
      p_event_name: 'tryon_requested',
      p_properties: { cached: false },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'record_analytics_event', expect.objectContaining({
      p_event_name: 'app_error',
    }));
  });

  it('swallows an unavailable analytics backend', async () => {
    const client = {
      rpc: jest.fn().mockRejectedValue(new Error('offline')),
    } as never;
    const adapter = createSupabaseObservabilityAdapter(client);
    adapter.setUser({ id: 'user-1' });

    expect(() => adapter.track('app_opened', {})).not.toThrow();
    await Promise.resolve();
  });
});
