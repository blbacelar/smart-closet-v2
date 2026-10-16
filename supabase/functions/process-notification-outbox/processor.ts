import type { PushDelivery, ReceiptResult, TicketResult } from './expoPushProvider.ts';

type ClaimedOutbox = { id: string };
type ClaimedReceipt = { deliveryId: string; ticketId: string };

export type NotificationProcessorDependencies = {
  claim: (workerId: string) => Promise<ClaimedOutbox[]>;
  prepare: (outboxId: string) => Promise<PushDelivery[]>;
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
    try {
      const deliveries = await dependencies.prepare(item.id);
      const results = await dependencies.send(deliveries);
      await dependencies.recordTickets(item.id, results);
      attempted += deliveries.length;
    } catch {
      await dependencies.recordTickets(item.id, [{
        deliveryId: null,
        state: 'transient-failure',
        code: 'worker_failure',
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
