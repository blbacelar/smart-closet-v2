import { ProcessingResult } from './processor';

type HandlerRequest = {
  method: string;
  authorization: string;
  json: () => Promise<unknown>;
};

type HandlerDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  process: (input: { garmentId: string; userId: string }) => Promise<ProcessingResult>;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleProcessGarmentRequest(
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
  if (!userId) {
    return { status: 401, body: { code: 'unauthorized' } };
  }

  let garmentId = '';
  try {
    const body = await request.json();
    garmentId =
      typeof body === 'object' && body !== null && 'garmentId' in body
        ? String(body.garmentId)
        : '';
  } catch {
    return { status: 400, body: { code: 'invalid_request' } };
  }
  if (!uuidPattern.test(garmentId)) {
    return { status: 400, body: { code: 'invalid_request' } };
  }

  try {
    const result = await dependencies.process({ garmentId, userId });
    const status = result.state === 'busy' ? 202 : result.state === 'exhausted' ? 422 : result.state === 'not-found' ? 404 : 200;
    return { status, body: result };
  } catch {
    return {
      status: 502,
      body: { code: 'processing_failed', message: 'Background removal failed. Try again.' },
    };
  }
}
