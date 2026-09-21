import { BodyPhotoValidationFailure, validateBodyPhoto } from '../processor';

function dependencies() {
  return {
    claim: jest.fn().mockResolvedValue({
      state: 'claimed' as const,
      photo: {
        id: 'photo-1',
        userId: 'user-1',
        storagePath: 'user-1/photo-1.jpg',
        attempt: 1,
      },
    }),
    download: jest.fn().mockResolvedValue({
      bytes: new ArrayBuffer(4),
      contentType: 'image/jpeg' as const,
    }),
    moderate: jest.fn().mockResolvedValue({
      decision: 'approved' as const,
      reason: null,
      provider: 'gemini',
      costUsd: 0.001,
    }),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
  };
}

describe('validateBodyPhoto', () => {
  it('approves a claimed owner photo and atomically records moderation cost', async () => {
    const deps = dependencies();

    await expect(validateBodyPhoto({ photoId: 'photo-1', userId: 'user-1' }, deps)).resolves.toEqual({
      state: 'approved',
      photoId: 'photo-1',
      rejectReason: null,
    });
    expect(deps.download).toHaveBeenCalledWith('user-1/photo-1.jpg');
    expect(deps.complete).toHaveBeenCalledWith({
      photoId: 'photo-1',
      userId: 'user-1',
      decision: 'approved',
      rejectReason: null,
      provider: 'gemini',
      costUsd: 0.001,
    });
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it('persists only the safe rejection reason code', async () => {
    const deps = dependencies();
    deps.moderate.mockResolvedValue({
      decision: 'rejected',
      reason: 'not_full_body',
      provider: 'gemini',
      costUsd: 0.001,
    });

    await expect(validateBodyPhoto({ photoId: 'photo-1', userId: 'user-1' }, deps)).resolves.toEqual({
      state: 'rejected',
      photoId: 'photo-1',
      rejectReason: 'not_full_body',
    });
  });

  it.each(['approved', 'rejected', 'busy', 'exhausted', 'not-found'] as const)(
    'returns the database claim state %s without provider spend',
    async (state) => {
      const deps = dependencies();
      deps.claim.mockResolvedValue({ state } as never);

      await expect(validateBodyPhoto({ photoId: 'photo-1', userId: 'user-1' }, deps)).resolves.toEqual({ state });
      expect(deps.moderate).not.toHaveBeenCalled();
    },
  );

  it('records a generic retryable failure without leaking provider details', async () => {
    const deps = dependencies();
    deps.moderate.mockRejectedValue(new Error('provider response with private detail'));

    await expect(validateBodyPhoto({ photoId: 'photo-1', userId: 'user-1' }, deps)).rejects.toEqual(
      expect.objectContaining<Partial<BodyPhotoValidationFailure>>({ code: 'validation_failed' }),
    );
    expect(deps.fail).toHaveBeenCalledWith({
      photoId: 'photo-1',
      userId: 'user-1',
      message: 'Photo validation is temporarily unavailable. Try again.',
    });
  });
});
