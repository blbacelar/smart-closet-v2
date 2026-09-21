import { handleValidateBodyPhotoRequest } from '../handler';

const photoId = '35b5a4be-2607-4e3b-a5ad-c458434e5e1e';

function request(input: { method?: string; authorization?: string; body?: unknown; throws?: boolean } = {}) {
  return {
    method: input.method ?? 'POST',
    authorization: input.authorization ?? 'Bearer session',
    json: input.throws
      ? jest.fn().mockRejectedValue(new Error('bad json'))
      : jest.fn().mockResolvedValue(input.body ?? { photoId }),
  };
}

function dependencies() {
  return {
    authenticate: jest.fn().mockResolvedValue('user-1'),
    isConfigured: jest.fn().mockReturnValue(true),
    process: jest.fn().mockResolvedValue({ state: 'approved', photoId, rejectReason: null }),
  };
}

describe('validate-body-photo handler', () => {
  it('rejects unauthenticated callers before processing', async () => {
    const deps = dependencies();

    await expect(handleValidateBodyPhotoRequest(request({ authorization: '' }), deps)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.process).not.toHaveBeenCalled();
  });

  it.each([
    request({ method: 'GET' }),
    request({ body: { photoId: 'not-a-uuid' } }),
    request({ body: { photoId, userId: 'attacker-controlled' } }),
    request({ throws: true }),
  ])('rejects an invalid method or exact request payload', async (input) => {
    const deps = dependencies();
    const result = await handleValidateBodyPhotoRequest(input, deps);

    expect([400, 405]).toContain(result.status);
    expect(deps.process).not.toHaveBeenCalled();
  });

  it('derives ownership from the authenticated session', async () => {
    const deps = dependencies();

    await expect(handleValidateBodyPhotoRequest(request(), deps)).resolves.toEqual({
      status: 200,
      body: { state: 'approved', photoId, rejectReason: null },
    });
    expect(deps.authenticate).toHaveBeenCalledWith('Bearer session');
    expect(deps.process).toHaveBeenCalledWith({ photoId, userId: 'user-1' });
  });

  it('fails safely before provider spend when moderation is not configured', async () => {
    const deps = dependencies();
    deps.isConfigured.mockReturnValue(false);

    await expect(handleValidateBodyPhotoRequest(request(), deps)).resolves.toEqual({
      status: 503,
      body: { code: 'validation_unavailable', message: 'Photo validation is temporarily unavailable. Try again.' },
    });
    expect(deps.process).not.toHaveBeenCalled();
  });

  it.each([
    ['busy', 202],
    ['exhausted', 422],
    ['not-found', 404],
  ] as const)('maps the %s state to HTTP %s', async (state, status) => {
    const deps = dependencies();
    deps.process.mockResolvedValue({ state } as never);

    await expect(handleValidateBodyPhotoRequest(request(), deps)).resolves.toEqual({
      status,
      body: { state },
    });
  });

  it('returns a generic provider failure response', async () => {
    const deps = dependencies();
    deps.process.mockRejectedValue(new Error('private provider response'));

    await expect(handleValidateBodyPhotoRequest(request(), deps)).resolves.toEqual({
      status: 502,
      body: { code: 'validation_failed', message: 'Photo validation is temporarily unavailable. Try again.' },
    });
  });
});
