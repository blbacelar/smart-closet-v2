import { handleDeleteBodyPhotoRequest } from '../handler';

const photoId = '10000000-0000-4000-8000-000000000001';

function request(input: { method?: string; authorization?: string; body?: unknown; throws?: boolean } = {}) {
  return {
    method: input.method ?? 'POST',
    authorization: input.authorization ?? 'Bearer session',
    json: input.throws
      ? jest.fn().mockRejectedValue(new Error('bad json'))
      : jest.fn().mockResolvedValue(
          Object.prototype.hasOwnProperty.call(input, 'body') ? input.body : { photoId },
        ),
  };
}

function dependencies() {
  return {
    authenticate: jest.fn().mockResolvedValue('user-1'),
    deletePhoto: jest.fn().mockResolvedValue(undefined),
  };
}

describe('delete-body-photo handler', () => {
  it('rejects unsupported methods and missing authentication before parsing input', async () => {
    const deps = dependencies();

    await expect(handleDeleteBodyPhotoRequest(request({ method: 'GET' }), deps)).resolves.toEqual({
      status: 405,
      body: { code: 'method_not_allowed' },
    });
    await expect(handleDeleteBodyPhotoRequest(request({ authorization: '' }), deps)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.deletePhoto).not.toHaveBeenCalled();
  });

  it('rejects invalid sessions and non-minimal UUID payloads', async () => {
    const invalidSession = dependencies();
    invalidSession.authenticate.mockResolvedValue(null);
    await expect(handleDeleteBodyPhotoRequest(request(), invalidSession)).resolves.toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });

    for (const input of [
      request({ body: { photoId: 'not-a-uuid' } }),
      request({ body: { photoId, userId: 'someone-else' } }),
      request({ body: null }),
      request({ throws: true }),
    ]) {
      const deps = dependencies();
      await expect(handleDeleteBodyPhotoRequest(input, deps)).resolves.toEqual({
        status: 400,
        body: { code: 'invalid_request' },
      });
      expect(deps.deletePhoto).not.toHaveBeenCalled();
    }
  });

  it('deletes only for the identity derived from the authenticated session', async () => {
    const deps = dependencies();

    await expect(handleDeleteBodyPhotoRequest(request(), deps)).resolves.toEqual({
      status: 200,
      body: { deleted: true },
    });
    expect(deps.deletePhoto).toHaveBeenCalledWith({ userId: 'user-1', photoId });
  });

  it('returns a generic retryable error without exposing cleanup details', async () => {
    const deps = dependencies();
    deps.deletePhoto.mockRejectedValue(new Error('private storage path and SQL details'));

    await expect(handleDeleteBodyPhotoRequest(request(), deps)).resolves.toEqual({
      status: 500,
      body: {
        code: 'deletion_failed',
        message: 'Could not delete that photo. Try again.',
      },
    });
  });
});
