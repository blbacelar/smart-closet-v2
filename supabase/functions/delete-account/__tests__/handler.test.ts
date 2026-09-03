import { handleDeleteAccountRequest } from '../handler';

function request(input: { method?: string; authorization?: string; body?: unknown; throws?: boolean } = {}) {
  return {
    method: input.method ?? 'POST',
    authorization: input.authorization ?? 'Bearer session',
    json: input.throws
      ? jest.fn().mockRejectedValue(new Error('bad json'))
      : jest.fn().mockResolvedValue(
          Object.prototype.hasOwnProperty.call(input, 'body')
            ? input.body
            : { confirmation: 'DELETE' },
        ),
  };
}

function dependencies() {
  return {
    authenticate: jest.fn().mockResolvedValue('user-1'),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
  };
}

describe('delete-account handler', () => {
  it('rejects unsupported methods and missing authentication before parsing input', async () => {
    const deps = dependencies();

    await expect(handleDeleteAccountRequest(request({ method: 'GET' }), deps)).resolves.toEqual({
      status: 405,
      body: { code: 'method_not_allowed' },
    });
    await expect(handleDeleteAccountRequest(request({ authorization: '' }), deps)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.authenticate).not.toHaveBeenCalled();
    expect(deps.deleteAccount).not.toHaveBeenCalled();
  });

  it('rejects invalid sessions', async () => {
    const deps = dependencies();
    deps.authenticate.mockResolvedValue(null);

    await expect(handleDeleteAccountRequest(request(), deps)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.deleteAccount).not.toHaveBeenCalled();
  });

  it.each([
    request({ body: { confirmation: 'delete' } }),
    request({ body: { confirmation: 'DELETE', userId: 'someone-else' } }),
    request({ body: null }),
    request({ throws: true }),
  ])('requires an exact, minimal confirmation payload', async (input) => {
    const deps = dependencies();

    await expect(handleDeleteAccountRequest(input, deps)).resolves.toEqual({
      status: 400,
      body: { code: 'invalid_confirmation' },
    });
    expect(deps.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes only the user derived from the authenticated session', async () => {
    const deps = dependencies();

    await expect(handleDeleteAccountRequest(request(), deps)).resolves.toEqual({
      status: 200,
      body: { deleted: true },
    });
    expect(deps.authenticate).toHaveBeenCalledWith('Bearer session');
    expect(deps.deleteAccount).toHaveBeenCalledWith('user-1');
  });

  it('returns a generic retryable error without leaking internal details', async () => {
    const deps = dependencies();
    deps.deleteAccount.mockRejectedValue(new Error('service role secret and SQL detail'));

    await expect(handleDeleteAccountRequest(request(), deps)).resolves.toEqual({
      status: 500,
      body: {
        code: 'deletion_failed',
        message: "We couldn't delete your account. Please try again.",
      },
    });
  });
});
