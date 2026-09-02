import { handleProcessGarmentRequest } from '../handler';

function request(input: { method?: string; authorization?: string; body?: unknown; throws?: boolean } = {}) {
  return {
    method: input.method ?? 'POST',
    authorization: input.authorization ?? 'Bearer session',
    json: input.throws
      ? jest.fn().mockRejectedValue(new Error('bad json'))
      : jest.fn().mockResolvedValue(input.body ?? { garmentId: '35b5a4be-2607-4e3b-a5ad-c458434e5e1e' }),
  };
}

function dependencies() {
  return {
    authenticate: jest.fn().mockResolvedValue('user-1'),
    process: jest.fn().mockResolvedValue({ state: 'ready', garmentId: 'garment-1', cleanPath: 'user-1/clean.png' }),
  };
}

describe('process-garment handler', () => {
  it('rejects unauthenticated callers before processing', async () => {
    const deps = dependencies();
    const result = await handleProcessGarmentRequest(request({ authorization: '' }), deps);

    expect(result).toEqual({ status: 401, body: { code: 'unauthorized' } });
    expect(deps.process).not.toHaveBeenCalled();
  });

  it.each([
    request({ body: { garmentId: 'not-a-uuid' } }),
    request({ throws: true }),
  ])('rejects invalid request data', async (input) => {
    const deps = dependencies();
    await expect(handleProcessGarmentRequest(input, deps)).resolves.toEqual({
      status: 400,
      body: { code: 'invalid_request' },
    });
  });

  it('authenticates ownership and starts processing', async () => {
    const deps = dependencies();
    const input = request();

    await expect(handleProcessGarmentRequest(input, deps)).resolves.toEqual({
      status: 200,
      body: { state: 'ready', garmentId: 'garment-1', cleanPath: 'user-1/clean.png' },
    });
    expect(deps.authenticate).toHaveBeenCalledWith('Bearer session');
    expect(deps.process).toHaveBeenCalledWith({
      garmentId: '35b5a4be-2607-4e3b-a5ad-c458434e5e1e',
      userId: 'user-1',
    });
  });

  it.each([
    ['busy', 202],
    ['exhausted', 422],
    ['not-found', 404],
  ] as const)('maps the %s state to HTTP %s', async (state, status) => {
    const deps = dependencies();
    deps.process.mockResolvedValue({ state } as never);

    await expect(handleProcessGarmentRequest(request(), deps)).resolves.toEqual({
      status,
      body: { state },
    });
  });

  it('returns a safe provider failure response', async () => {
    const deps = dependencies();
    deps.process.mockRejectedValue(new Error('secret provider payload'));

    await expect(handleProcessGarmentRequest(request(), deps)).resolves.toEqual({
      status: 502,
      body: { code: 'processing_failed', message: 'Background removal failed. Try again.' },
    });
  });
});
