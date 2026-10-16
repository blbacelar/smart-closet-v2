import type { HandoffState } from './settleHandoff.ts';

type HandlerRequest = {
  method: string;
  authorization: string;
  json: () => Promise<unknown>;
};

type HandlerDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  settle: (transactionId: string, userId: string) => Promise<HandoffState>;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleConfirmMarketplaceHandoff(
  request: HandlerRequest,
  dependencies: HandlerDependencies,
): Promise<HandlerResponse> {
  if (request.method !== 'POST') {
    return { status: 405, body: { code: 'method_not_allowed' } };
  }
  if (!request.authorization) {
    return { status: 401, body: { code: 'unauthorized' } };
  }

  let userId: string | null = null;
  try {
    userId = await dependencies.authenticate(request.authorization);
  } catch {
    userId = null;
  }
  if (!userId) return { status: 401, body: { code: 'unauthorized' } };

  let transactionId = '';
  try {
    const body = await request.json();
    const keys = typeof body === 'object' && body !== null && !Array.isArray(body)
      ? Object.keys(body)
      : [];
    transactionId = keys.length === 1 && keys[0] === 'transactionId'
      ? String((body as Record<string, unknown>).transactionId)
      : '';
  } catch {
    return { status: 400, body: { code: 'invalid_transaction' } };
  }
  if (!uuidPattern.test(transactionId)) {
    return { status: 400, body: { code: 'invalid_transaction' } };
  }

  try {
    const state = await dependencies.settle(transactionId, userId);
    return { status: state === 'settlement_pending' ? 202 : 200, body: { state } };
  } catch {
    return {
      status: 500,
      body: {
        code: 'settlement_failed',
        message: "We couldn't finish that handoff. Please try again.",
      },
    };
  }
}
