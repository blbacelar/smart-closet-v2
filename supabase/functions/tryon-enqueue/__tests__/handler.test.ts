import { handleTryOnEnqueueRequest } from '../handler';

const bodyPhotoId = '11111111-1111-4111-8111-111111111111';
const garmentId = '22222222-2222-4222-8222-222222222222';

function request(input: { method?: string; authorization?: string; body?: unknown; throws?: boolean } = {}) {
  return {
    method: input.method ?? 'POST',
    authorization: input.authorization ?? 'Bearer session',
    json: input.throws
      ? jest.fn().mockRejectedValue(new Error('bad json'))
      : jest.fn().mockResolvedValue(
          Object.prototype.hasOwnProperty.call(input, 'body')
            ? input.body
            : { bodyPhotoId, garmentId },
        ),
  };
}

function dependencies() {
  return {
    authenticate: jest.fn().mockResolvedValue('user-1'),
    isConfigured: jest.fn().mockReturnValue(true),
    reserve: jest.fn().mockResolvedValue({
      state: 'queued' as const,
      jobId: 'job-1',
      status: 'queued' as const,
      limit: 3,
      remaining: 2,
    }),
    schedule: jest.fn(),
  };
}

describe('tryon-enqueue handler', () => {
  it('rejects unsupported methods and unauthenticated callers before reservation', async () => {
    const deps = dependencies();

    await expect(handleTryOnEnqueueRequest(request({ method: 'GET' }), deps)).resolves.toEqual({
      status: 405,
      body: { code: 'method_not_allowed' },
    });
    await expect(handleTryOnEnqueueRequest(request({ authorization: '' }), deps)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it('rejects an invalid session returned by authentication', async () => {
    const deps = dependencies();
    deps.authenticate.mockResolvedValue(null);

    await expect(handleTryOnEnqueueRequest(request(), deps)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it.each([
    request({ body: { bodyPhotoId: 'bad', garmentId } }),
    request({ body: { bodyPhotoId, garmentId: 'bad' } }),
    request({ body: null }),
    request({ throws: true }),
  ])('rejects malformed input', async (input) => {
    await expect(handleTryOnEnqueueRequest(input, dependencies())).resolves.toEqual({
      status: 400,
      body: { code: 'invalid_request' },
    });
  });

  it('refuses unavailable provider configuration without reserving quota', async () => {
    const deps = dependencies();
    deps.isConfigured.mockReturnValue(false);

    await expect(handleTryOnEnqueueRequest(request(), deps)).resolves.toEqual({
      status: 503,
      body: {
        code: 'provider_unavailable',
        message: 'Virtual try-on is not configured yet.',
      },
    });
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it('reserves quota and schedules only a newly queued job', async () => {
    const deps = dependencies();

    await expect(handleTryOnEnqueueRequest(request(), deps)).resolves.toEqual({
      status: 202,
      body: expect.objectContaining({ state: 'queued', jobId: 'job-1', remaining: 2 }),
    });
    expect(deps.reserve).toHaveBeenCalledWith({ bodyPhotoId, garmentId, userId: 'user-1' });
    expect(deps.schedule).toHaveBeenCalledWith({ jobId: 'job-1', userId: 'user-1' });
  });

  it.each([
    ['cached', 200],
    ['in-progress', 200],
    ['quota-exceeded', 429],
    ['body-photo-unavailable', 422],
    ['garment-not-ready', 422],
    ['not-found', 404],
  ] as const)('maps %s reservations to HTTP %s without duplicate processing', async (state, status) => {
    const deps = dependencies();
    deps.reserve.mockResolvedValue({ state } as never);

    await expect(handleTryOnEnqueueRequest(request(), deps)).resolves.toEqual({
      status,
      body: { state },
    });
    expect(deps.schedule).not.toHaveBeenCalled();
  });

  it('does not expose internal failures', async () => {
    const deps = dependencies();
    deps.reserve.mockRejectedValue(new Error('database secret'));

    await expect(handleTryOnEnqueueRequest(request(), deps)).resolves.toEqual({
      status: 500,
      body: { code: 'internal_error', message: 'Could not start the try-on. Try again.' },
    });
  });
});
