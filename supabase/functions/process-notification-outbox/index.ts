import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createExpoPushProvider, type PushDelivery } from './expoPushProvider.ts';
import {
  processNotificationBatch,
  processNotificationReceipts,
  type NotificationProcessorDependencies,
} from './processor.ts';

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function secretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = JSON.parse(requiredEnvironment('SUPABASE_SECRET_KEYS')) as Record<string, string>;
  if (!keys.default) throw new Error('Default Supabase secret key is not configured.');
  return keys.default;
}

const serviceKey = secretKey();
const admin = createClient(requiredEnvironment('SUPABASE_URL'), serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ code: 'method_not_allowed' }, { status: 405 });
  }
  if (request.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return Response.json({ code: 'unauthorized' }, { status: 401 });
  }

  const workerId = crypto.randomUUID();
  const providerConfigured = Deno.env.get('EXPO_PUSH_ENABLED') === 'true';
  const provider = createExpoPushProvider({
    accessToken: Deno.env.get('EXPO_ACCESS_TOKEN') ?? '',
    fetch: (url, init) => fetch(url, init as RequestInit),
  });
  const dependencies: NotificationProcessorDependencies = {
    async claim(id) {
      const { data, error } = await admin.rpc('notification_claim_outbox', {
        p_worker_id: id, p_limit: 25, p_lease: '2 minutes',
      });
      throwIfError(error);
      return (data ?? []).map((value: unknown) => ({ id: String(record(value).id) }));
    },
    async prepare(outboxId) {
      const { data, error } = await admin.rpc('notification_prepare_deliveries', {
        p_outbox_id: outboxId,
      });
      throwIfError(error);
      return (data ?? []).map((value: unknown) => {
        const row = record(value);
        return {
          deliveryId: String(row.delivery_id), token: String(row.expo_token),
          kind: row.kind, route: row.route,
        } as PushDelivery;
      });
    },
    async authorize(outboxId, deliveries) {
      if (deliveries.length === 0) return [];
      const { data, error } = await admin.rpc('notification_authorize_deliveries', {
        p_outbox_id: outboxId,
        p_worker_id: workerId,
        p_delivery_ids: deliveries.map((delivery) => delivery.deliveryId),
      });
      throwIfError(error);
      const authorized = new Set(
        (data ?? []).map((value: unknown) => String(record(value).delivery_id)),
      );
      return deliveries.filter((delivery) => authorized.has(delivery.deliveryId));
    },
    send: (deliveries) => provider.send(deliveries),
    async recordTickets(outboxId, results) {
      const { error } = await admin.rpc('notification_record_tickets', {
        p_outbox_id: outboxId, p_worker_id: workerId, p_results: results,
      });
      throwIfError(error);
    },
    async deferWithoutProvider(outboxId, id) {
      const { error } = await admin.rpc('notification_defer_without_provider', {
        p_outbox_id: outboxId, p_worker_id: id,
      });
      throwIfError(error);
    },
    async claimReceipts() {
      const { data, error } = await admin.rpc('notification_claim_receipts', {
        p_worker_id: workerId, p_limit: 100, p_lease: '2 minutes',
      });
      throwIfError(error);
      return (data ?? []).map((value: unknown) => {
        const row = record(value);
        return { deliveryId: String(row.delivery_id), ticketId: String(row.ticket_id) };
      });
    },
    receipts: (ids) => provider.receipts(ids),
    async recordReceipts(results) {
      const { error } = await admin.rpc('notification_record_receipts', {
        p_worker_id: workerId, p_results: results,
      });
      throwIfError(error);
    },
  };

  try {
    const dispatch = await processNotificationBatch({ workerId, providerConfigured }, dependencies);
    const receipts = providerConfigured
      ? await processNotificationReceipts(dependencies)
      : { checked: 0 };
    return Response.json({ dispatch, receipts, providerConfigured });
  } catch {
    return Response.json({ code: 'notification_worker_failed' }, { status: 500 });
  }
});
