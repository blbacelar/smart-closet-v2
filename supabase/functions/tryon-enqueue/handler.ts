export type EnqueueTryOnResult = {
  state: 'queued' | 'cached' | 'in-progress' | 'quota-exceeded' | 'body-photo-unavailable' | 'garment-not-ready' | 'not-found';
  jobId?: string;
  status?: 'queued' | 'running' | 'done';
  limit?: number;
  remaining?: number;
};

type HandlerRequest = {
  method: string;
  authorization: string;
  json: () => Promise<unknown>;
};

type HandlerDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  isConfigured: () => boolean;
  reserve: (input: { bodyPhotoId: string; garmentId: string; userId: string }) => Promise<EnqueueTryOnResult>;
  schedule: (input: { jobId: string; userId: string }) => void;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleTryOnEnqueueRequest(
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

  let bodyPhotoId = '';
  let garmentId = '';
  try {
    const body = await request.json();
    if (typeof body === 'object' && body !== null) {
      bodyPhotoId = 'bodyPhotoId' in body ? String(body.bodyPhotoId) : '';
      garmentId = 'garmentId' in body ? String(body.garmentId) : '';
    }
  } catch {
    return { status: 400, body: { code: 'invalid_request' } };
  }
  if (!uuidPattern.test(bodyPhotoId) || !uuidPattern.test(garmentId)) {
    return { status: 400, body: { code: 'invalid_request' } };
  }

  if (!dependencies.isConfigured()) {
    return {
      status: 503,
      body: { code: 'provider_unavailable', message: 'Virtual try-on is not configured yet.' },
    };
  }

  try {
    const result = await dependencies.reserve({ bodyPhotoId, garmentId, userId });
    if (result.state === 'queued' && result.jobId) {
      dependencies.schedule({ jobId: result.jobId, userId });
    }

    const status = result.state === 'queued'
      ? 202
      : result.state === 'quota-exceeded'
        ? 429
        : result.state === 'body-photo-unavailable' || result.state === 'garment-not-ready'
          ? 422
          : result.state === 'not-found'
            ? 404
            : 200;
    return { status, body: result };
  } catch {
    return {
      status: 500,
      body: { code: 'internal_error', message: 'Could not start the try-on. Try again.' },
    };
  }
}
