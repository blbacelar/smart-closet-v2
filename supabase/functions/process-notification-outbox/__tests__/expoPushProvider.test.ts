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

  it('does not retry permanent Expo payload or credential errors', async () => {
    const fetch = jest.fn().mockResolvedValue(response(true, 200, {
      data: [
        { status: 'error', details: { error: 'MessageTooBig' } },
        { status: 'error', details: { error: 'MismatchSenderId' } },
      ],
    }));
    const provider = createExpoPushProvider({ accessToken: '', fetch });

    await expect(provider.send([
      { deliveryId: 'large', token: 'ExpoPushToken[large]', kind: 'account_update', route: null },
      { deliveryId: 'mismatch', token: 'ExpoPushToken[mismatch]', kind: 'account_update', route: null },
    ])).resolves.toEqual([
      { deliveryId: 'large', state: 'permanent-failure', code: 'MessageTooBig' },
      { deliveryId: 'mismatch', state: 'permanent-failure', code: 'MismatchSenderId' },
    ]);
  });

  it.each([
    [400, 'permanent-failure'],
    [403, 'permanent-failure'],
    [429, 'transient-failure'],
    [503, 'transient-failure'],
  ] as const)('classifies HTTP %s without retrying permanent requests', async (status, state) => {
    const provider = createExpoPushProvider({
      accessToken: '',
      fetch: jest.fn().mockResolvedValue(response(false, status, {})),
    });

    await expect(provider.send([{
      deliveryId: 'delivery-1', token: 'ExpoPushToken[token-1]', kind: 'account_update', route: null,
    }])).resolves.toEqual([{
      deliveryId: 'delivery-1', state, code: `provider_http_${status}`,
    }]);
  });

  it('marks a lost POST response as ambiguous so the delivery is never resent', async () => {
    const provider = createExpoPushProvider({
      accessToken: '',
      fetch: jest.fn().mockRejectedValue(new Error('response lost after POST')),
    });

    await expect(provider.send([{
      deliveryId: 'delivery-1', token: 'ExpoPushToken[token-1]', kind: 'account_update', route: null,
    }])).resolves.toEqual([{
      deliveryId: 'delivery-1', state: 'ambiguous-failure', code: 'provider_transport_error',
    }]);
  });

  it.each([
    [{ status: 'ok' }],
    [{}],
    [{ status: 'error', details: { error: 'UnknownExpoError' } }],
  ])('treats an unproven per-item result as ambiguous instead of retrying it', async (data) => {
    const provider = createExpoPushProvider({
      accessToken: '',
      fetch: jest.fn().mockResolvedValue(response(true, 200, { data: [data] })),
    });

    const expectedCode = (data as { details?: { error?: string } }).details?.error ?? 'provider_error';
    await expect(provider.send([{
      deliveryId: 'delivery-1', token: 'ExpoPushToken[token-1]', kind: 'account_update', route: null,
    }])).resolves.toEqual([{
      deliveryId: 'delivery-1', state: 'ambiguous-failure', code: expectedCode,
    }]);
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

  it.each([
    [new Error('offline'), 'transient-failure', 'receipt_transport_error'],
    [response(false, 400, {}), 'permanent-failure', 'receipt_http_400'],
    [response(false, 429, {}), 'transient-failure', 'receipt_http_429'],
  ] as const)('turns a receipt request failure into bounded per-ticket results', async (outcome, state, code) => {
    const fetch = outcome instanceof Error
      ? jest.fn().mockRejectedValue(outcome)
      : jest.fn().mockResolvedValue(outcome);
    const provider = createExpoPushProvider({ accessToken: '', fetch });

    await expect(provider.receipts(['ticket-one', 'ticket-two'])).resolves.toEqual([
      { ticketId: 'ticket-one', state, code },
      { ticketId: 'ticket-two', state, code },
    ]);
  });

  it('chunks dispatches at the Expo API maximum without reordering delivery results', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(response(true, 200, {
        data: Array.from({ length: 100 }, (_, index) => ({ status: 'ok', id: `ticket-${index}` })),
      }))
      .mockResolvedValueOnce(response(true, 200, {
        data: [{ status: 'ok', id: 'ticket-100' }],
      }));
    const provider = createExpoPushProvider({ accessToken: '', fetch });
    const deliveries = Array.from({ length: 101 }, (_, index) => ({
      deliveryId: `delivery-${index}`,
      token: `ExpoPushToken[token-${index}]`,
      kind: 'account_update' as const,
      route: null,
    }));

    const results = await provider.send(deliveries);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toHaveLength(100);
    expect(JSON.parse(String(fetch.mock.calls[1][1].body))).toHaveLength(1);
    expect(results).toHaveLength(101);
    expect(results[100]).toEqual({
      deliveryId: 'delivery-100', state: 'ticketed', ticketId: 'ticket-100',
    });
  });

  it('preserves accepted earlier chunks when a later provider call is uncertain', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(response(true, 200, {
        data: Array.from({ length: 100 }, (_, index) => ({ status: 'ok', id: `ticket-${index}` })),
      }))
      .mockRejectedValueOnce(new Error('network interrupted'));
    const provider = createExpoPushProvider({ accessToken: '', fetch });
    const deliveries = Array.from({ length: 101 }, (_, index) => ({
      deliveryId: `delivery-${index}`,
      token: `ExpoPushToken[token-${index}]`,
      kind: 'account_update' as const,
      route: null,
    }));

    await expect(provider.send(deliveries)).resolves.toEqual([
      ...Array.from({ length: 100 }, (_, index) => ({
        deliveryId: `delivery-${index}`,
        state: 'ticketed',
        ticketId: `ticket-${index}`,
      })),
      {
        deliveryId: 'delivery-100',
        state: 'ambiguous-failure',
        code: 'provider_transport_error',
      },
    ]);
  });
});
