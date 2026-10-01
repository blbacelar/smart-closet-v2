import { shareTryOnResult } from '../shareTryOnResult';

function dependencies() {
  return {
    capture: jest.fn().mockResolvedValue('file:///fitly-result.jpg'),
    isAvailable: jest.fn().mockResolvedValue(true),
    share: jest.fn().mockResolvedValue(undefined),
  };
}

describe('shareTryOnResult', () => {
  it('captures the rendered result so the visible Free watermark is included', async () => {
    const deps = dependencies();
    const resultView = { current: 'result-view' } as never;

    await shareTryOnResult(resultView, deps);

    expect(deps.capture).toHaveBeenCalledWith('result-view', {
      format: 'jpg',
      quality: 0.95,
      result: 'tmpfile',
    });
    expect(deps.share).toHaveBeenCalledWith('file:///fitly-result.jpg', {
      dialogTitle: 'Share your Fitly fitting',
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
    });
  });

  it('fails safely when native sharing is unavailable', async () => {
    const deps = dependencies();
    deps.isAvailable.mockResolvedValue(false);

    await expect(shareTryOnResult({ current: 'result-view' } as never, deps)).rejects.toThrow(
      'Sharing is not available on this device.',
    );
    expect(deps.capture).not.toHaveBeenCalled();
  });

  it('does not expose capture or share internals', async () => {
    const deps = dependencies();
    deps.capture.mockRejectedValue(new Error('private signed url leaked here'));

    await expect(shareTryOnResult({ current: 'result-view' } as never, deps)).rejects.toThrow(
      'Could not share that fitting. Try again.',
    );
  });
});
