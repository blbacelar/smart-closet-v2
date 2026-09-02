import { OpenRouterProviderError, createOpenRouterProvider } from '../openRouterProvider';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'private-key',
    model: 'google/gemini-3.1-flash-image',
    provider: 'google-vertex/global',
    fallbackCostUsd: 0.05,
    fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
      created: 1_780_000_000,
      data: [{ b64_json: 'YWJjZA==', media_type: 'image/png' }],
      usage: { cost: 0.0412 },
    })),
    wait: jest.fn().mockResolvedValue(undefined),
    createRequestId: jest.fn().mockReturnValue('request-1'),
    ...overrides,
  };
}

describe('OpenRouter provider adapter', () => {
  it('generates a private virtual try-on from the person and garment references', async () => {
    const deps = dependencies();
    const provider = createOpenRouterProvider(deps);

    await expect(provider.generateTryOn({
      modelImage: 'data:image/jpeg;base64,Ym9keQ==',
      garmentImage: 'data:image/png;base64,Z2FybWVudA==',
      category: 'dress',
    })).resolves.toEqual({
      id: 'request-1',
      provider: 'openrouter',
      costUsd: 0.0412,
      bytes: expect.any(ArrayBuffer),
      contentType: 'image/png',
    });

    expect(deps.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/images',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer private-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const requestBody = JSON.parse((deps.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody).toEqual({
      model: 'google/gemini-3.1-flash-image',
      prompt: expect.stringMatching(/second reference image.*dress/i),
      input_references: [
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,Ym9keQ==' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,Z2FybWVudA==' } },
      ],
      n: 1,
      resolution: '1K',
      aspect_ratio: '2:3',
      provider: {
        only: ['google-vertex/global'],
        allow_fallbacks: false,
      },
    });
  });

  it('uses the configured fallback cost when OpenRouter omits usage cost', async () => {
    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        data: [{ b64_json: 'YWJjZA==', media_type: 'image/jpeg' }],
      })),
    });

    await expect(createOpenRouterProvider(deps).generateTryOn({
      modelImage: 'body',
      garmentImage: 'garment',
      category: 'top',
    })).resolves.toEqual(expect.objectContaining({ costUsd: 0.05, contentType: 'image/jpeg' }));
  });

  it('retries transient failures with bounded backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(502, {}))
      .mockResolvedValueOnce(jsonResponse(200, {
        data: [{ b64_json: 'YWJjZA==', media_type: 'image/png' }],
        usage: { cost: 0.03 },
      }));
    const deps = dependencies({ fetch });

    await createOpenRouterProvider(deps).generateTryOn({
      modelImage: 'body',
      garmentImage: 'garment',
      category: 'bottom',
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(deps.wait).toHaveBeenNthCalledWith(1, 500);
    expect(deps.wait).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('does not retry permanent API errors', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(400, {}));
    const deps = dependencies({ fetch });

    await expect(createOpenRouterProvider(deps).generateTryOn({
      modelImage: 'body',
      garmentImage: 'garment',
      category: 'shoes',
    })).rejects.toEqual(expect.objectContaining({ status: 400, retryable: false }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(deps.wait).not.toHaveBeenCalled();
  });

  it('requires server-side configuration and rejects malformed output', async () => {
    expect(() => createOpenRouterProvider(dependencies({ apiKey: '' }))).toThrow(
      'Virtual try-on is not configured.',
    );
    expect(() => createOpenRouterProvider(dependencies({ provider: '' }))).toThrow(
      'Virtual try-on is not configured.',
    );

    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        data: [{ b64_json: 'not base64', media_type: 'image/gif' }],
      })),
    });
    await expect(createOpenRouterProvider(deps).generateTryOn({
      modelImage: 'body',
      garmentImage: 'garment',
      category: 'outerwear',
    })).rejects.toBeInstanceOf(OpenRouterProviderError);
  });

  it('rejects an empty generated image', async () => {
    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        data: [{ b64_json: '', media_type: 'image/png' }],
      })),
    });

    await expect(createOpenRouterProvider(deps).generateTryOn({
      modelImage: 'body',
      garmentImage: 'garment',
      category: 'top',
    })).rejects.toBeInstanceOf(OpenRouterProviderError);
  });
});
