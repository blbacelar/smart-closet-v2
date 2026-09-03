import { TryOnProcessingFailure, processTryOn } from '../processor';

function dependencies() {
  return {
    claim: jest.fn().mockResolvedValue({
      state: 'claimed' as const,
      job: {
        id: 'job-1',
        userId: 'user-1',
        bodyPath: 'user-1/body.jpg',
        garmentPath: 'user-1/garment.png',
        category: 'top',
      },
    }),
    downloadInput: jest.fn()
      .mockResolvedValueOnce('data:image/jpeg;base64,Ym9keQ==')
      .mockResolvedValueOnce('data:image/png;base64,Z2FybWVudA=='),
    generateTryOn: jest.fn().mockResolvedValue({
      id: 'request-1',
      provider: 'gemini',
      costUsd: 0.0412,
      bytes: new ArrayBuffer(8),
      contentType: 'image/png' as const,
    }),
    setProviderJob: jest.fn().mockResolvedValue(undefined),
    uploadResult: jest.fn().mockResolvedValue(undefined),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
    removeResult: jest.fn().mockResolvedValue(undefined),
    now: jest.fn().mockReturnValueOnce(1_000).mockReturnValue(9_000),
  };
}

describe('processTryOn', () => {
  it('downloads private inputs, generates, stores the result, and completes atomically', async () => {
    const deps = dependencies();

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).resolves.toEqual({
      state: 'done',
      jobId: 'job-1',
      resultPath: 'user-1/job-1.png',
    });
    expect(deps.downloadInput).toHaveBeenNthCalledWith(1, 'body', 'user-1/body.jpg', 'image/jpeg');
    expect(deps.downloadInput).toHaveBeenNthCalledWith(2, 'garments', 'user-1/garment.png', 'image/png');
    expect(deps.generateTryOn).toHaveBeenCalledWith(expect.objectContaining({ category: 'top' }));
    expect(deps.setProviderJob).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      provider: 'gemini',
      providerJobId: 'request-1',
    });
    expect(deps.uploadResult).toHaveBeenCalledWith('user-1/job-1.png', expect.any(ArrayBuffer), 'image/png');
    expect(deps.complete).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      resultPath: 'user-1/job-1.png',
      provider: 'gemini',
      costUsd: 0.0412,
      latencyMs: 8_000,
    });
  });

  it('labels an original-image garment fallback as JPEG', async () => {
    const deps = dependencies();
    deps.claim.mockResolvedValue({
      state: 'claimed',
      job: {
        id: 'job-1',
        userId: 'user-1',
        bodyPath: 'user-1/body.jpg',
        garmentPath: 'user-1/garment-clean.jpg',
        category: 'top',
      },
    });

    await processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps);

    expect(deps.downloadInput).toHaveBeenNthCalledWith(
      2,
      'garments',
      'user-1/garment-clean.jpg',
      'image/jpeg',
    );
  });

  it.each(['running', 'done', 'failed', 'not-found'] as const)('does not spend for claim state %s', async (state) => {
    const deps = dependencies();
    deps.claim.mockResolvedValue({ state } as never);

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).resolves.toEqual({ state });
    expect(deps.generateTryOn).not.toHaveBeenCalled();
  });

  it('refunds quota with a safe failure when the provider rejects generation', async () => {
    const deps = dependencies();
    deps.generateTryOn.mockRejectedValue(new Error('private provider detail'));

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).rejects.toBeInstanceOf(
      TryOnProcessingFailure,
    );
    expect(deps.fail).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      failureCode: 'generation_failed',
      provider: 'gemini',
      costUsd: 0,
    });
  });

  it('refunds quota when the provider reports a generation timeout', async () => {
    const deps = dependencies();
    deps.generateTryOn.mockRejectedValue(new TryOnProcessingFailure('timeout'));

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).rejects.toEqual(
      expect.objectContaining({ code: 'timeout' }),
    );
    expect(deps.fail).toHaveBeenCalledWith(expect.objectContaining({ failureCode: 'timeout' }));
  });

  it('removes an uploaded result and records incurred cost if completion fails', async () => {
    const deps = dependencies();
    deps.complete.mockRejectedValue(new Error('database unavailable'));

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).rejects.toBeInstanceOf(
      TryOnProcessingFailure,
    );
    expect(deps.removeResult).toHaveBeenCalledWith('user-1/job-1.png');
    expect(deps.fail).toHaveBeenCalledWith(expect.objectContaining({ costUsd: 0.0412 }));
  });
});
