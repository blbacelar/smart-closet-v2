export type NotificationKind = 'marketplace_update' | 'account_update';
export type NotificationRoute =
  | { kind: 'marketplace_inbox' }
  | { kind: 'transaction' | 'listing'; id: string };

export type PushDelivery = {
  deliveryId: string;
  token: string;
  kind: NotificationKind;
  route: NotificationRoute | null;
};

export type TicketResult =
  | { deliveryId: string; state: 'ticketed'; ticketId: string }
  | {
      deliveryId: string;
      state: 'permanent-failure' | 'transient-failure' | 'ambiguous-failure';
      code: string;
    };

export type ReceiptResult =
  | { ticketId: string; state: 'delivered' }
  | { ticketId: string; state: 'permanent-failure' | 'transient-failure'; code: string };

type ProviderResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
type ProviderDependencies = {
  accessToken: string;
  fetch: (url: string, init: Record<string, unknown>) => Promise<ProviderResponse>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const permanentCodes = new Set([
  'DeviceNotRegistered',
  'InvalidCredentials',
  'MessageTooBig',
  'MismatchSenderId',
]);
const transientCodes = new Set(['MessageRateExceeded']);

export class ExpoPushProviderError extends Error {
  constructor(public readonly retryable: boolean) {
    super('Push notification provider failed.');
    this.name = 'ExpoPushProviderError';
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function routeData(route: NotificationRoute | null) {
  if (route === null) return {};
  const keys = Object.keys(route).sort();
  if (route.kind === 'marketplace_inbox' && keys.join(',') === 'kind') {
    return { route: 'marketplace_inbox' };
  }
  if (
    (route.kind === 'transaction' || route.kind === 'listing')
    && keys.join(',') === 'id,kind'
    && uuidPattern.test(route.id)
  ) {
    return { route: route.kind, id: route.id };
  }
  throw new ExpoPushProviderError(false);
}

function errorCode(value: unknown) {
  const code = record(record(value).details).error;
  return typeof code === 'string' && code.length > 0 ? code : 'provider_error';
}

function failureState(code: string) {
  if (permanentCodes.has(code)) return 'permanent-failure' as const;
  if (transientCodes.has(code)) return 'transient-failure' as const;
  return 'ambiguous-failure' as const;
}

function receiptFailureState(code: string) {
  return transientCodes.has(code) || code === 'receipt_not_ready'
    ? 'transient-failure' as const
    : 'permanent-failure' as const;
}

function appendUnattempted(results: TicketResult[], deliveries: PushDelivery[]) {
  results.push(...deliveries.map((delivery) => ({
    deliveryId: delivery.deliveryId,
    state: 'transient-failure' as const,
    code: 'dispatch_not_attempted',
  })));
}

function headers(accessToken: string) {
  return {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export function createExpoPushProvider(dependencies: ProviderDependencies) {
  return {
    async send(deliveries: PushDelivery[]): Promise<TicketResult[]> {
      if (deliveries.length === 0) return [];
      const results: TicketResult[] = [];
      for (let offset = 0; offset < deliveries.length; offset += 100) {
        const batch = deliveries.slice(offset, offset + 100);
        const messages = batch.map((delivery) => ({
          to: delivery.token,
          title: 'Fitly update',
          body: 'Open Fitly to see what changed.',
          sound: 'default',
          data: routeData(delivery.route),
        }));
        let response: ProviderResponse;
        try {
          response = await dependencies.fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: headers(dependencies.accessToken),
            body: JSON.stringify(messages),
          });
        } catch {
          results.push(...batch.map((delivery) => ({
            deliveryId: delivery.deliveryId,
            state: 'ambiguous-failure' as const,
            code: 'provider_transport_error',
          })));
          appendUnattempted(results, deliveries.slice(offset + batch.length));
          break;
        }
        if (!response.ok) {
          const state = response.status === 408 || response.status === 429 || response.status >= 500
            ? 'transient-failure' as const
            : 'permanent-failure' as const;
          results.push(...batch.map((delivery) => ({
            deliveryId: delivery.deliveryId,
            state,
            code: `provider_http_${response.status}`,
          })));
          appendUnattempted(results, deliveries.slice(offset + batch.length));
          break;
        }
        let data: unknown;
        try {
          data = record(await response.json()).data;
        } catch {
          data = null;
        }
        if (!Array.isArray(data) || data.length !== batch.length) {
          results.push(...batch.map((delivery) => ({
            deliveryId: delivery.deliveryId,
            state: 'ambiguous-failure' as const,
            code: 'provider_malformed_response',
          })));
          appendUnattempted(results, deliveries.slice(offset + batch.length));
          break;
        }
        results.push(...data.map((ticket, index) => {
          const row = record(ticket);
          if (row.status === 'ok' && typeof row.id === 'string' && row.id) {
            return { deliveryId: batch[index].deliveryId, state: 'ticketed' as const, ticketId: row.id };
          }
          const code = errorCode(row);
          return { deliveryId: batch[index].deliveryId, state: failureState(code), code };
        }));
      }
      return results;
    },

    async receipts(ticketIds: string[]): Promise<ReceiptResult[]> {
      if (ticketIds.length === 0) return [];
      let response: ProviderResponse;
      try {
        response = await dependencies.fetch('https://exp.host/--/api/v2/push/getReceipts', {
          method: 'POST',
          headers: headers(dependencies.accessToken),
          body: JSON.stringify({ ids: ticketIds }),
        });
      } catch {
        return ticketIds.map((ticketId) => ({
          ticketId,
          state: 'transient-failure' as const,
          code: 'receipt_transport_error',
        }));
      }
      if (!response.ok) {
        const state = response.status === 408 || response.status === 429 || response.status >= 500
          ? 'transient-failure' as const
          : 'permanent-failure' as const;
        return ticketIds.map((ticketId) => ({
          ticketId,
          state,
          code: `receipt_http_${response.status}`,
        }));
      }
      const data = record(record(await response.json()).data);
      return ticketIds.map((ticketId) => {
        const receipt = record(data[ticketId]);
        if (receipt.status === 'ok') return { ticketId, state: 'delivered' };
        const code = Object.keys(receipt).length === 0 ? 'receipt_not_ready' : errorCode(receipt);
        return { ticketId, state: receiptFailureState(code), code };
      });
    },
  };
}
