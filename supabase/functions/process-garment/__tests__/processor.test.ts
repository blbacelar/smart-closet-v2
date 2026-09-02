import { ProcessingFailure, processGarment } from '../processor';

function createDependencies() {
  return {
    claim: jest.fn().mockResolvedValue({
      state: 'claimed' as const,
      garment: {
        id: 'garment-1',
        userId: 'user-1',
        originalPath: 'user-1/original.jpg',
        attempt: 1,
      },
    }),
    downloadOriginal: jest.fn().mockResolvedValue(new ArrayBuffer(4)),
    removeBackground: jest.fn().mockResolvedValue({
      bytes: new ArrayBuffer(8),
      provider: 'remove-bg',
      costUsd: 0.08,
    }),
    hash: jest.fn().mockResolvedValue('clean-sha256'),
    uploadClean: jest.fn().mockResolvedValue(undefined),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
    removeClean: jest.fn().mockResolvedValue(undefined),
  };
}

describe('processGarment', () => {
  it('processes a claimed garment and atomically completes its ledger entry', async () => {
    const dependencies = createDependencies();

    await expect(processGarment({ garmentId: 'garment-1', userId: 'user-1' }, dependencies)).resolves.toEqual({
      state: 'ready',
      garmentId: 'garment-1',
      cleanPath: 'user-1/garment-1-clean.png',
    });
    expect(dependencies.downloadOriginal).toHaveBeenCalledWith('user-1/original.jpg');
    expect(dependencies.uploadClean).toHaveBeenCalledWith(
      'user-1/garment-1-clean.png',
      expect.any(ArrayBuffer),
    );
    expect(dependencies.complete).toHaveBeenCalledWith({
      garmentId: 'garment-1',
      userId: 'user-1',
      cleanPath: 'user-1/garment-1-clean.png',
      imageHash: 'clean-sha256',
      provider: 'remove-bg',
      costUsd: 0.08,
    });
    expect(dependencies.fail).not.toHaveBeenCalled();
  });

  it.each(['ready', 'busy', 'exhausted'] as const)('returns the database claim state %s without spending', async (state) => {
    const dependencies = createDependencies();
    dependencies.claim.mockResolvedValue({ state } as never);

    await expect(processGarment({ garmentId: 'garment-1', userId: 'user-1' }, dependencies)).resolves.toEqual({ state });
    expect(dependencies.removeBackground).not.toHaveBeenCalled();
  });

  it('reports a safe failure without exposing provider details', async () => {
    const dependencies = createDependencies();
    dependencies.removeBackground.mockRejectedValue(new Error('provider response contained secret details'));

    await expect(processGarment({ garmentId: 'garment-1', userId: 'user-1' }, dependencies)).rejects.toEqual(
      expect.objectContaining<Partial<ProcessingFailure>>({ code: 'processing_failed' }),
    );
    expect(dependencies.fail).toHaveBeenCalledWith({
      garmentId: 'garment-1',
      userId: 'user-1',
      message: 'Background removal failed. Try again.',
    });
  });

  it('removes a clean object when atomic completion fails', async () => {
    const dependencies = createDependencies();
    dependencies.complete.mockRejectedValue(new Error('database unavailable'));

    await expect(processGarment({ garmentId: 'garment-1', userId: 'user-1' }, dependencies)).rejects.toBeInstanceOf(ProcessingFailure);
    expect(dependencies.removeClean).toHaveBeenCalledWith('user-1/garment-1-clean.png');
    expect(dependencies.fail).toHaveBeenCalled();
  });
});
