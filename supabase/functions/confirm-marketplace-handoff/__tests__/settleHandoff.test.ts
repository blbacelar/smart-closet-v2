import { settleHandoff, type AcquisitionManifestItem } from '../settleHandoff';

const originalOnly: AcquisitionManifestItem = {
  acquiredGarmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sourceMarketplacePath: 'seller/original.jpg',
  destinationPath: 'buyer/acquired/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/asset',
};

function dependencies() {
  return {
    recordConfirmation: jest.fn().mockResolvedValue('settlement_pending' as const),
    getManifest: jest.fn().mockResolvedValue([originalOnly]),
    objectExists: jest.fn().mockResolvedValue(false),
    copyObject: jest.fn().mockResolvedValue(undefined),
    finalize: jest.fn().mockResolvedValue('completed' as const),
  };
}

describe('settleHandoff', () => {
  it('does not copy or finalize after the first participant confirmation', async () => {
    const deps = dependencies();
    deps.recordConfirmation.mockResolvedValue('awaiting_handoff');

    await expect(settleHandoff('transaction-1', 'user-1', deps)).resolves.toBe(
      'awaiting_handoff',
    );
    expect(deps.getManifest).not.toHaveBeenCalled();
    expect(deps.copyObject).not.toHaveBeenCalled();
    expect(deps.finalize).not.toHaveBeenCalled();
  });

  it('copies exactly one marketplace-safe asset per acquired garment', async () => {
    const deps = dependencies();
    deps.getManifest.mockResolvedValue([
      originalOnly,
      {
        acquiredGarmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        sourceMarketplacePath: 'other/clean.png',
        destinationPath: 'seller/acquired/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/asset',
      },
    ]);

    await expect(settleHandoff('transaction-1', 'user-1', deps)).resolves.toBe(
      'completed',
    );
    expect(deps.copyObject.mock.calls).toEqual([
      ['seller/original.jpg', 'buyer/acquired/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/asset'],
      ['other/clean.png', 'seller/acquired/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/asset'],
    ]);
    expect(deps.finalize).toHaveBeenCalledWith('transaction-1');
    expect(deps.copyObject.mock.invocationCallOrder.at(-1)).toBeLessThan(
      deps.finalize.mock.invocationCallOrder[0],
    );
  });

  it('reuses deterministic copies on retry instead of overwriting them', async () => {
    const deps = dependencies();
    deps.objectExists.mockResolvedValue(true);

    await settleHandoff('transaction-1', 'user-1', deps);

    expect(deps.copyObject).not.toHaveBeenCalled();
    expect(deps.finalize).toHaveBeenCalledTimes(1);
  });

  it('never finalizes after a storage copy failure', async () => {
    const deps = dependencies();
    deps.copyObject.mockRejectedValue(new Error('storage unavailable'));

    await expect(settleHandoff('transaction-1', 'user-1', deps)).rejects.toThrow(
      'storage unavailable',
    );
    expect(deps.finalize).not.toHaveBeenCalled();
  });

  it('rejects a manifest that could overwrite the source object', async () => {
    const deps = dependencies();
    deps.getManifest.mockResolvedValue([
      { ...originalOnly, destinationPath: originalOnly.sourceMarketplacePath },
    ]);

    await expect(settleHandoff('transaction-1', 'user-1', deps)).rejects.toThrow(
      'Unsafe acquired garment path',
    );
    expect(deps.copyObject).not.toHaveBeenCalled();
    expect(deps.finalize).not.toHaveBeenCalled();
  });
});
