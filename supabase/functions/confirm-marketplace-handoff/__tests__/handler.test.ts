import { handleConfirmMarketplaceHandoff } from '../handler';

function request(input: {
  method?: string;
  authorization?: string;
  body?: unknown;
  throws?: boolean;
} = {}) {
  return {
    method: input.method ?? 'POST',
    authorization: input.authorization ?? 'Bearer session',
    json: input.throws
      ? jest.fn().mockRejectedValue(new Error('bad json'))
      : jest.fn().mockResolvedValue(input.body ?? {
          transactionId: '88888888-8888-4888-8888-888888888888',
        }),
  };
}

function dependencies() {
  return {
    authenticate: jest.fn().mockResolvedValue('user-1'),
    settle: jest.fn().mockResolvedValue('completed' as const),
  };
}

describe('confirm-marketplace-handoff handler', () => {
  it('rejects unsupported methods, missing auth, and malformed transaction ids', async () => {
    const deps = dependencies();

    await expect(handleConfirmMarketplaceHandoff(request({ method: 'GET' }), deps))
      .resolves.toEqual({ status: 405, body: { code: 'method_not_allowed' } });
    await expect(handleConfirmMarketplaceHandoff(request({ authorization: '' }), deps))
      .resolves.toEqual({ status: 401, body: { code: 'unauthorized' } });
    await expect(handleConfirmMarketplaceHandoff(request({ body: { transactionId: 'bad' } }), deps))
      .resolves.toEqual({ status: 400, body: { code: 'invalid_transaction' } });
    expect(deps.settle).not.toHaveBeenCalled();
  });

  it('settles only as the authenticated participant', async () => {
    const deps = dependencies();
    const transactionId = '88888888-8888-4888-8888-888888888888';

    await expect(handleConfirmMarketplaceHandoff(request({ body: { transactionId } }), deps))
      .resolves.toEqual({ status: 200, body: { state: 'completed' } });
    expect(deps.settle).toHaveBeenCalledWith(transactionId, 'user-1');
  });

  it('returns generic retryable copy errors without leaking paths', async () => {
    const deps = dependencies();
    deps.settle.mockRejectedValue(new Error('seller/private/path and SQL details'));

    await expect(handleConfirmMarketplaceHandoff(request(), deps)).resolves.toEqual({
      status: 500,
      body: {
        code: 'settlement_failed',
        message: "We couldn't finish that handoff. Please try again.",
      },
    });
  });
});
