type HandlerRequest = {
  method: string;
  authorization: string;
  json: () => Promise<unknown>;
};

type HandlerDependencies = {
  authenticate: (authorization: string) => Promise<string | null>;
  deleteAccount: (userId: string) => Promise<void>;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

function isExactConfirmation(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === 1
    && keys[0] === 'confirmation'
    && (body as Record<string, unknown>).confirmation === 'DELETE';
}

export async function handleDeleteAccountRequest(
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
    return { status: 400, body: { code: 'invalid_confirmation' } };
  }
  if (!isExactConfirmation(body)) {
    return { status: 400, body: { code: 'invalid_confirmation' } };
  }

  try {
    await dependencies.deleteAccount(userId);
    return { status: 200, body: { deleted: true } };
  } catch {
    return {
      status: 500,
      body: {
        code: 'deletion_failed',
        message: "We couldn't delete your account. Please try again.",
      },
    };
  }
}
