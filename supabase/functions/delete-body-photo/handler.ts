type HandlerRequest = {
  method: string;
  authorization: string;
  json: () => Promise<unknown>;
};

type HandlerDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  deletePhoto: (input: { userId: string; photoId: string }) => Promise<void>;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function photoIdFrom(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'photoId') return null;
  const photoId = (body as Record<string, unknown>).photoId;
  return typeof photoId === 'string' && uuidPattern.test(photoId) ? photoId : null;
}

export async function handleDeleteBodyPhotoRequest(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { code: 'invalid_request' } };
  }
  const photoId = photoIdFrom(body);
  if (!photoId) {
    return { status: 400, body: { code: 'invalid_request' } };
  }

  try {
    await dependencies.deletePhoto({ userId, photoId });
    return { status: 200, body: { deleted: true } };
  } catch {
    return {
      status: 500,
      body: {
        code: 'deletion_failed',
        message: 'Could not delete that photo. Try again.',
      },
    };
  }
}
