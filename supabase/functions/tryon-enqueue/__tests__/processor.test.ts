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
    createPrediction: jest.fn().mockResolvedValue({
      id: 'prediction-1',
      provider: 'fashn',
      costUsd: 0.075,
    }),
    setProviderJob: jest.fn().mockResolvedValue(undefined),
    getPrediction: jest.fn()
      .mockResolvedValueOnce({ state: 'processing' as const })
      .mockResolvedValueOnce({
        state: 'completed' as const,
        bytes: new ArrayBuffer(8),
        contentType: 'image/jpeg' as const,
      }),
    wait: jest.fn().mockResolvedValue(undefined),
    uploadResult: jest.fn().mockResolvedValue(undefined),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
    removeResult: jest.fn().mockResolvedValue(undefined),
    now: jest.fn().mockReturnValueOnce(1_000).mockReturnValue(9_000),
    maxPolls: 3,
    pollIntervalMs: 3_000,
  };
}

describe('processTryOn', () => {
  it('downloads private inputs, polls the provider, stores the result, and completes atomically', async () => {
    const deps = dependencies();

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).resolves.toEqual({
      state: 'done',
      jobId: 'job-1',
      resultPath: 'user-1/job-1.jpg',
    });
    expect(deps.downloadInput).toHaveBeenNthCalledWith(1, 'body', 'user-1/body.jpg', 'image/jpeg');
    expect(deps.downloadInput).toHaveBeenNthCalledWith(2, 'garments', 'user-1/garment.png', 'image/png');
    expect(deps.createPrediction).toHaveBeenCalledWith(expect.objectContaining({ category: 'top' }));
    expect(deps.setProviderJob).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      provider: 'fashn',
      providerJobId: 'prediction-1',
    });
    expect(deps.wait).toHaveBeenCalledWith(3_000);
    expect(deps.uploadResult).toHaveBeenCalledWith('user-1/job-1.jpg', expect.any(ArrayBuffer), 'image/jpeg');
    expect(deps.complete).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      resultPath: 'user-1/job-1.jpg',
      provider: 'fashn',
      costUsd: 0.075,
      latencyMs: 8_000,
    });
  });

  it.each(['running', 'done', 'failed', 'not-found'] as const)('does not spend for claim state %s', async (state) => {
    const deps = dependencies();
    deps.claim.mockResolvedValue({ state } as never);

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).resolves.toEqual({ state });
    expect(deps.createPrediction).not.toHaveBeenCalled();
  });

  it('refunds quota with a safe failure when the provider rejects generation', async () => {
    const deps = dependencies();
    deps.getPrediction.mockReset().mockResolvedValue({ state: 'failed' });

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).rejects.toBeInstanceOf(
      TryOnProcessingFailure,
    );
    expect(deps.fail).toHaveBeenCalledWith({
      jobId: 'job-1',
      userId: 'user-1',
      failureCode: 'generation_failed',
      provider: 'fashn',
      costUsd: 0,
    });
  });

  it('times out with a refund instead of leaving the job running forever', async () => {
    const deps = dependencies();
    deps.getPrediction.mockReset().mockResolvedValue({ state: 'processing' });

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).rejects.toEqual(
      expect.objectContaining({ code: 'timeout' }),
    );
    expect(deps.getPrediction).toHaveBeenCalledTimes(3);
    expect(deps.fail).toHaveBeenCalledWith(expect.objectContaining({ failureCode: 'timeout' }));
  });

  it('removes an uploaded result and records incurred cost if completion fails', async () => {
    const deps = dependencies();
    deps.getPrediction.mockReset().mockResolvedValue({
      state: 'completed',
      bytes: new ArrayBuffer(8),
      contentType: 'image/jpeg',
    });
    deps.complete.mockRejectedValue(new Error('database unavailable'));

    await expect(processTryOn({ jobId: 'job-1', userId: 'user-1' }, deps)).rejects.toBeInstanceOf(
      TryOnProcessingFailure,
    );
    expect(deps.removeResult).toHaveBeenCalledWith('user-1/job-1.jpg');
    expect(deps.fail).toHaveBeenCalledWith(expect.objectContaining({ costUsd: 0.075 }));
  });
});
