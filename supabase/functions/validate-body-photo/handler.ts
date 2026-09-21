import type { ValidationResult } from './processor.ts';

type HandlerRequest = {
  method: string;
  authorization: string;
  json: () => Promise<unknown>;
};

type HandlerDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  isConfigured: () => boolean;
  process: (input: { photoId: string; userId: string }) => Promise<ValidationResult>;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

const safeFailureMessage = 'Photo validation is temporarily unavailable. Try again.';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function photoIdFrom(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'photoId') return null;
  const photoId = (body as Record<string, unknown>).photoId;
  return typeof photoId === 'string' && uuidPattern.test(photoId) ? photoId : null;
}

export async function handleValidateBodyPhotoRequest(
  request: HandlerRequest,
  dependencies: HandlerDependencies,
): Promise<HandlerResponse> {
  if (request.method !== 'POST') {
    return { status: 405, body: { code: 'method_not_allowed' } };
  }
  if (!request.authorization) {
    return { status: 401, body: { code: 'unauthorized' } };
  }

  let userId: string | null;
  try {
    userId = await dependencies.authenticate(request.authorization);
  } catch {
    userId = null;
  }
  if (!userId) return { status: 401, body: { code: 'unauthorized' } };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { code: 'invalid_request' } };
  }
  const photoId = photoIdFrom(body);
  if (!photoId) return { status: 400, body: { code: 'invalid_request' } };

  if (!dependencies.isConfigured()) {
    return {
      status: 503,
      body: { code: 'validation_unavailable', message: safeFailureMessage },
    };
  }

  try {
    const result = await dependencies.process({ photoId, userId });
    const status = result.state === 'busy'
      ? 202
      : result.state === 'exhausted'
        ? 422
        : result.state === 'not-found'
          ? 404
          : 200;
    return { status, body: result };
  } catch {
    return {
      status: 502,
      body: { code: 'validation_failed', message: safeFailureMessage },
    };
  }
}
