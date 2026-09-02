import { FashnProviderError, createFashnProvider } from '../fashnProvider';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('FASHN provider adapter', () => {
  it('creates a privacy-focused v1.6 prediction with server-side authorization', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(200, { id: 'prediction-1', error: null }));
    const provider = createFashnProvider({ apiKey: 'private-key', costUsd: 0.075, fetch });

    await expect(provider.createPrediction({
      modelImage: 'data:image/jpeg;base64,Ym9keQ==',
      garmentImage: 'data:image/png;base64,Z2FybWVudA==',
      category: 'dress',
    })).resolves.toEqual({ id: 'prediction-1', provider: 'fashn', costUsd: 0.075 });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.fashn.ai/v1/run',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer private-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      model_name: 'tryon-v1.6',
      inputs: expect.objectContaining({
        model_image: 'data:image/jpeg;base64,Ym9keQ==',
        garment_image: 'data:image/png;base64,Z2FybWVudA==',
        category: 'one-pieces',
        mode: 'balanced',
        output_format: 'jpeg',
        return_base64: true,
      }),
    });
  });

  it('returns processing state while a prediction is active', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(200, { id: 'prediction-1', status: 'processing' }));
    const provider = createFashnProvider({ apiKey: 'private-key', costUsd: 0.075, fetch });

    await expect(provider.getPrediction('prediction-1')).resolves.toEqual({ state: 'processing' });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.fashn.ai/v1/status/prediction-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer private-key' } }),
    );
  });

  it('decodes a completed base64 result without persisting provider URLs', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(200, {
      id: 'prediction-1',
      status: 'completed',
      output: ['data:image/jpeg;base64,YWJjZA=='],
    }));
    const provider = createFashnProvider({ apiKey: 'private-key', costUsd: 0.075, fetch });

    const result = await provider.getPrediction('prediction-1');

    expect(result).toEqual({
      state: 'completed',
      bytes: expect.any(ArrayBuffer),
      contentType: 'image/jpeg',
    });
    expect((result as { bytes: ArrayBuffer }).bytes.byteLength).toBe(4);
  });

  it('maps provider failures to a safe terminal state', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(200, {
      id: 'prediction-1',
      status: 'failed',
      error: { message: 'private provider detail' },
    }));
    const provider = createFashnProvider({ apiKey: 'private-key', costUsd: 0.075, fetch });

    await expect(provider.getPrediction('prediction-1')).resolves.toEqual({ state: 'failed' });
  });

  it('retries transient creation failures with bounded backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'prediction-1' }));
    const wait = jest.fn().mockResolvedValue(undefined);
    const provider = createFashnProvider({ apiKey: 'private-key', costUsd: 0.075, fetch, wait });

    await provider.createPrediction({ modelImage: 'body', garmentImage: 'garment', category: 'top' });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 500);
    expect(wait).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('requires valid server-side configuration and rejects malformed output', async () => {
    expect(() => createFashnProvider({ apiKey: '', costUsd: Number.NaN, fetch: jest.fn() })).toThrow(
      'Virtual try-on is not configured.',
    );

    const provider = createFashnProvider({
      apiKey: 'private-key',
      costUsd: 0.075,
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        id: 'prediction-1',
        status: 'completed',
        output: ['https://provider.example/result.jpg'],
      })),
    });
    await expect(provider.getPrediction('prediction-1')).rejects.toBeInstanceOf(FashnProviderError);
  });
});
