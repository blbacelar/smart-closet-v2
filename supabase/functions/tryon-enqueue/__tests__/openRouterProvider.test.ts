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
    fallbackCostUsd: 0.1,
    timeoutMs: 90_000,
    fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
      created: 1_780_000_000,
      data: [{ b64_json: 'YWJjZA==', media_type: 'image/png' }],
      usage: { cost: 0.0412 },
    })),
    createRequestId: jest.fn().mockReturnValue('request-1'),
    ...overrides,
  };
}

const input = {
  modelImage: 'data:image/jpeg;base64,Ym9keQ==',
  garmentImage: 'data:image/png;base64,Z2FybWVudA==',
  category: 'dress' as const,
};

describe('OpenRouter provider adapter', () => {
  it('sends the private person and garment references through the pinned image endpoint', async () => {
    const deps = dependencies();

    await expect(createOpenRouterProvider(deps).generateTryOn(input)).resolves.toEqual({
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
        { type: 'image_url', image_url: { url: input.modelImage } },
        { type: 'image_url', image_url: { url: input.garmentImage } },
      ],
      n: 1,
      resolution: '1K',
      aspect_ratio: '2:3',
      provider: {
        only: ['google-vertex/global'],
        allow_fallbacks: false,
        data_collection: 'deny',
        zdr: true,
        require_parameters: true,
      },
    });
  });

  it('uses the configured fallback cost when OpenRouter omits usage cost', async () => {
    const deps = dependencies({
      fallbackCostUsd: 0.05,
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        data: [{ b64_json: 'YWJjZA==', media_type: 'image/jpeg' }],
      })),
    });

    await expect(createOpenRouterProvider(deps).generateTryOn(input)).resolves.toEqual(
      expect.objectContaining({ costUsd: 0.05, contentType: 'image/jpeg' }),
    );
  });

  it('never retries a paid generation when the outcome is ambiguous', async () => {
    const fetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('connection closed'))
      .mockResolvedValueOnce(jsonResponse(200, {
        data: [{ b64_json: 'YWJjZA==', media_type: 'image/png' }],
        usage: { cost: 0.03 },
      }));
    const deps = dependencies({ fetch });

    await expect(
      createOpenRouterProvider(deps).generateTryOn({ ...input, category: 'bottom' }),
    ).rejects.toEqual(expect.objectContaining({ costUsd: 0.1 }));

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry permanent API errors', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(400, {}));
    const deps = dependencies({ fetch });

    await expect(createOpenRouterProvider(deps).generateTryOn(input)).rejects.toEqual(
      expect.objectContaining({ status: 400, retryable: false }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung request and reports a billable timeout without retrying', async () => {
    const fetch = jest.fn((_url: string, init: Record<string, unknown>) => new Promise((_, reject) => {
      const signal = init.signal as AbortSignal;
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const deps = dependencies({ fetch, timeoutMs: 1 });

    await expect(createOpenRouterProvider(deps).generateTryOn(input)).rejects.toEqual(
      expect.objectContaining({ code: 'timeout', costUsd: 0.1 }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the timeout active while reading a successful response body', async () => {
    const fetch = jest.fn((_url: string, init: Record<string, unknown>) => {
      const signal = init.signal as AbortSignal;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      });
    });
    const deps = dependencies({ fetch, timeoutMs: 1 });
    const outcome = Promise.race([
      createOpenRouterProvider(deps).generateTryOn(input).catch((error) => error),
      new Promise((resolve) => setTimeout(() => resolve('response-body-hung'), 25)),
    ]);

    await expect(outcome).resolves.toEqual(expect.objectContaining({
      code: 'timeout',
      costUsd: 0.1,
    }));
  });

  it('preserves known usage cost when a successful response contains an invalid image', async () => {
    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        data: [],
        usage: { cost: 0.073 },
      })),
    });

    await expect(createOpenRouterProvider(deps).generateTryOn(input)).rejects.toEqual(
      expect.objectContaining({ costUsd: 0.073 }),
    );
  });

  it('requires complete server-side configuration', () => {
    expect(() => createOpenRouterProvider(dependencies({ apiKey: '' }))).toThrow(
      'Virtual try-on is not configured.',
    );
    expect(() => createOpenRouterProvider(dependencies({ model: '' }))).toThrow(
      'Virtual try-on is not configured.',
    );
    expect(() => createOpenRouterProvider(dependencies({ provider: '' }))).toThrow(
      'Virtual try-on is not configured.',
    );
    expect(() => createOpenRouterProvider(dependencies({ fallbackCostUsd: 0 }))).toThrow(
      'Virtual try-on is not configured.',
    );
    expect(() => createOpenRouterProvider(dependencies({ timeoutMs: 0 }))).toThrow(
      'Virtual try-on is not configured.',
    );
  });

  it('rejects malformed private inputs before making a provider request', async () => {
    const deps = dependencies();

    await expect(createOpenRouterProvider(deps).generateTryOn({
      ...input,
      garmentImage: 'https://example.com/public-garment.jpg',
    })).rejects.toBeInstanceOf(OpenRouterProviderError);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [{ data: [{ b64_json: 'not base64', media_type: 'image/png' }] }],
    [{ data: [{ b64_json: 'YWJjZA==', media_type: 'image/gif' }] }],
    [{ data: [{ b64_json: '', media_type: 'image/png' }] }],
    [{ data: [] }],
  ])('rejects malformed generated image payload %#', async (body) => {
    const deps = dependencies({ fetch: jest.fn().mockResolvedValue(jsonResponse(200, body)) });

    await expect(createOpenRouterProvider(deps).generateTryOn(input)).rejects.toBeInstanceOf(
      OpenRouterProviderError,
    );
  });
});
