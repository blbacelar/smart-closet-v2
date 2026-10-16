import { processNotificationBatch, processNotificationReceipts } from '../processor';

function dependencies() {
  return {
    claim: jest.fn().mockResolvedValue([{ id: 'outbox-1' }]),
    prepare: jest.fn().mockResolvedValue([{
      deliveryId: 'delivery-1',
      token: 'ExpoPushToken[token-1]',
      kind: 'marketplace_update' as const,
      route: { kind: 'marketplace_inbox' as const },
    }]),
    authorize: jest.fn(async (_outboxId, deliveries) => deliveries),
    send: jest.fn().mockResolvedValue([{
      deliveryId: 'delivery-1',
      state: 'ticketed' as const,
      ticketId: 'ticket-1',
    }]),
    recordTickets: jest.fn().mockResolvedValue(undefined),
    deferWithoutProvider: jest.fn().mockResolvedValue(undefined),
    claimReceipts: jest.fn().mockResolvedValue([{ deliveryId: 'delivery-1', ticketId: 'ticket-1' }]),
    receipts: jest.fn().mockResolvedValue([{ ticketId: 'ticket-1', state: 'delivered' as const }]),
    recordReceipts: jest.fn().mockResolvedValue(undefined),
  };
}

describe('notification outbox processor', () => {
  it('claims leased work and records provider tickets once per prepared delivery', async () => {
    const deps = dependencies();

    await expect(processNotificationBatch({ workerId: 'worker-1', providerConfigured: true }, deps))
      .resolves.toEqual({ claimed: 1, attempted: 1 });
    expect(deps.claim).toHaveBeenCalledWith('worker-1');
    expect(deps.prepare).toHaveBeenCalledWith('outbox-1');
    expect(deps.authorize).toHaveBeenCalledWith('outbox-1', expect.any(Array));
    expect(deps.recordTickets).toHaveBeenCalledWith('outbox-1', expect.any(Array));
  });

  it('does not POST a delivery invalidated between prepare and send', async () => {
    const deps = dependencies();
    deps.authorize.mockResolvedValue([]);

    await expect(processNotificationBatch({ workerId: 'worker-1', providerConfigured: true }, deps))
      .resolves.toEqual({ claimed: 1, attempted: 0 });
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.recordTickets).toHaveBeenCalledWith('outbox-1', []);
  });

  it('uses a safe no-credential mode without consuming retry attempts', async () => {
    const deps = dependencies();

    await expect(processNotificationBatch({ workerId: 'worker-1', providerConfigured: false }, deps))
      .resolves.toEqual({ claimed: 1, attempted: 0 });
    expect(deps.deferWithoutProvider).toHaveBeenCalledWith('outbox-1', 'worker-1');
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('isolates a poison item and continues the rest of the batch', async () => {
    const deps = dependencies();
    deps.claim.mockResolvedValue([{ id: 'poison' }, { id: 'healthy' }]);
    deps.prepare
      .mockRejectedValueOnce(new Error('invalid item'))
      .mockResolvedValueOnce([{
        deliveryId: 'delivery-2',
        token: 'ExpoPushToken[token-2]',
        kind: 'account_update',
        route: null,
      }]);

    await expect(processNotificationBatch({ workerId: 'worker-1', providerConfigured: true }, deps))
      .resolves.toEqual({ claimed: 2, attempted: 1 });
    expect(deps.recordTickets).toHaveBeenCalledTimes(2);
    expect(deps.recordTickets).toHaveBeenNthCalledWith(1, 'poison', [{
      deliveryId: null,
      state: 'transient-failure',
      code: 'worker_failure',
    }]);
  });

  it('polls tickets separately and records receipt outcomes', async () => {
    const deps = dependencies();

    await expect(processNotificationReceipts(deps)).resolves.toEqual({ checked: 1 });
    expect(deps.receipts).toHaveBeenCalledWith(['ticket-1']);
    expect(deps.recordReceipts).toHaveBeenCalledWith(expect.any(Array));
  });
});
