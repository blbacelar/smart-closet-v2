import type { PushDelivery, ReceiptResult, TicketResult } from './expoPushProvider.ts';

type ClaimedOutbox = { id: string };
type ClaimedReceipt = { deliveryId: string; ticketId: string };

export type NotificationProcessorDependencies = {
  claim: (workerId: string) => Promise<ClaimedOutbox[]>;
  prepare: (outboxId: string) => Promise<PushDelivery[]>;
  authorize: (outboxId: string, deliveries: PushDelivery[]) => Promise<PushDelivery[]>;
  send: (deliveries: PushDelivery[]) => Promise<TicketResult[]>;
  recordTickets: (
    outboxId: string,
    results: Array<TicketResult | {
      deliveryId: null;
      state: 'transient-failure';
      code: 'worker_failure';
    }>,
  ) => Promise<void>;
  deferWithoutProvider: (outboxId: string, workerId: string) => Promise<void>;
  claimReceipts: () => Promise<ClaimedReceipt[]>;
  receipts: (ticketIds: string[]) => Promise<ReceiptResult[]>;
  recordReceipts: (results: ReceiptResult[]) => Promise<void>;
};

export async function processNotificationBatch(
  input: { workerId: string; providerConfigured: boolean },
  dependencies: NotificationProcessorDependencies,
) {
  const claimed = await dependencies.claim(input.workerId);
  let attempted = 0;
  for (const item of claimed) {
    if (!input.providerConfigured) {
      await dependencies.deferWithoutProvider(item.id, input.workerId);
      continue;
    }
    let deliveries: PushDelivery[] = [];
    try {
      deliveries = await dependencies.prepare(item.id);
      const authorized = await dependencies.authorize(item.id, deliveries);
      const results = authorized.length > 0 ? await dependencies.send(authorized) : [];
      await dependencies.recordTickets(item.id, results);
      attempted += authorized.length;
    } catch {
      await dependencies.recordTickets(item.id, deliveries.length > 0
        ? deliveries.map((delivery) => ({
            deliveryId: delivery.deliveryId,
            state: 'ambiguous-failure' as const,
            code: 'worker_failure',
          }))
        : [{
            deliveryId: null,
            state: 'transient-failure' as const,
            code: 'worker_failure' as const,
          }]);
    }
  }
  return { claimed: claimed.length, attempted };
}

export async function processNotificationReceipts(
  dependencies: NotificationProcessorDependencies,
) {
  const claimed = await dependencies.claimReceipts();
  if (claimed.length === 0) return { checked: 0 };
  const results = await dependencies.receipts(claimed.map((item) => item.ticketId));
  await dependencies.recordReceipts(results);
  return { checked: claimed.length };
}
