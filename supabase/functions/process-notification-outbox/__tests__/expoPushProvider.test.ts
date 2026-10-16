import { ExpoPushProviderError, createExpoPushProvider } from '../expoPushProvider';

function response(ok: boolean, status: number, payload: unknown) {
  return { ok, status, json: jest.fn().mockResolvedValue(payload) };
}

describe('Expo push provider adapter', () => {
  it('sends generic copy and only schema-validated route data', async () => {
    const fetch = jest.fn().mockResolvedValue(response(true, 200, {
      data: [{ status: 'ok', id: 'ticket-1' }],
    }));
    const provider = createExpoPushProvider({ accessToken: 'credential', fetch });

    await expect(provider.send([{
      deliveryId: 'delivery-1',
      token: 'ExpoPushToken[token-1]',
      kind: 'marketplace_update',
      route: { kind: 'marketplace_inbox' },
    }])).resolves.toEqual([{
      deliveryId: 'delivery-1',
      state: 'ticketed',
      ticketId: 'ticket-1',
    }]);

    const request = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(request).toEqual([expect.objectContaining({
      to: 'ExpoPushToken[token-1]',
      title: 'Fitly update',
      body: 'Open Fitly to see what changed.',
      data: { route: 'marketplace_inbox' },
    })]);
    expect(JSON.stringify(request)).not.toContain('garment');
  });

  it('classifies permanent token failures separately from transient provider failures', async () => {
    const fetch = jest.fn().mockResolvedValue(response(true, 200, {
      data: [
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'MessageRateExceeded' } },
      ],
    }));
    const provider = createExpoPushProvider({ accessToken: '', fetch });

    await expect(provider.send([
      { deliveryId: 'one', token: 'ExpoPushToken[one]', kind: 'account_update', route: null },
      { deliveryId: 'two', token: 'ExpoPushToken[two]', kind: 'account_update', route: null },
    ])).resolves.toEqual([
      { deliveryId: 'one', state: 'permanent-failure', code: 'DeviceNotRegistered' },
      { deliveryId: 'two', state: 'transient-failure', code: 'MessageRateExceeded' },
    ]);
  });

  it('rejects malformed routes before contacting the provider', async () => {
    const fetch = jest.fn();
    const provider = createExpoPushProvider({ accessToken: '', fetch });

    await expect(provider.send([{
      deliveryId: 'delivery-1',
      token: 'ExpoPushToken[token-1]',
      kind: 'marketplace_update',
      route: { kind: 'transaction', id: 'not-a-uuid', secret: 'leak' } as never,
    }])).rejects.toBeInstanceOf(ExpoPushProviderError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches receipts and preserves per-ticket permanent/transient semantics', async () => {
    const fetch = jest.fn().mockResolvedValue(response(true, 200, {
      data: {
        'ticket-ok': { status: 'ok' },
        'ticket-gone': { status: 'error', details: { error: 'DeviceNotRegistered' } },
      },
    }));
    const provider = createExpoPushProvider({ accessToken: '', fetch });

    await expect(provider.receipts(['ticket-ok', 'ticket-gone'])).resolves.toEqual([
      { ticketId: 'ticket-ok', state: 'delivered' },
      { ticketId: 'ticket-gone', state: 'permanent-failure', code: 'DeviceNotRegistered' },
    ]);
  });
});
