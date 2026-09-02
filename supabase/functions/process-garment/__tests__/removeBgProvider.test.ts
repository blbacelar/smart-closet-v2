import { RemoveBgError, createRemoveBgProvider } from '../removeBgProvider';

function response(status: number, bytes = new ArrayBuffer(8)) {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: jest.fn().mockResolvedValue(bytes),
  };
}

describe('remove.bg provider adapter', () => {
  it('sends the image as multipart data and returns a PNG result', async () => {
    const fetch = jest.fn().mockResolvedValue(response(200));
    const provider = createRemoveBgProvider({ apiKey: 'private-key', costUsd: 0.08, fetch });

    await expect(provider.remove(new ArrayBuffer(4))).resolves.toEqual({
      bytes: expect.any(ArrayBuffer),
      provider: 'remove-bg',
      costUsd: 0.08,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.remove.bg/v1.0/removebg',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Api-Key': 'private-key' },
        body: expect.any(FormData),
      }),
    );
  });

  it('retries rate limits and provider outages with bounded backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    const wait = jest.fn().mockResolvedValue(undefined);
    const provider = createRemoveBgProvider({ apiKey: 'private-key', costUsd: 0.08, fetch, wait });

    await provider.remove(new ArrayBuffer(4));

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 500);
    expect(wait).toHaveBeenNthCalledWith(2, 1000);
  });

  it('does not retry permanent request errors', async () => {
    const fetch = jest.fn().mockResolvedValue(response(400));
    const wait = jest.fn();
    const provider = createRemoveBgProvider({ apiKey: 'private-key', costUsd: 0.08, fetch, wait });

    await expect(provider.remove(new ArrayBuffer(4))).rejects.toEqual(
      expect.objectContaining<Partial<RemoveBgError>>({ status: 400, retryable: false }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('requires server-side provider configuration', () => {
    expect(() => createRemoveBgProvider({ apiKey: '', costUsd: Number.NaN, fetch: jest.fn() })).toThrow(
      'Background removal is not configured.',
    );
  });
});
