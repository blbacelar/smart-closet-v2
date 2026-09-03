import { GeminiProviderError, createGeminiProvider } from '../geminiProvider';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function successfulPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'interaction-1',
    status: 'completed',
    steps: [{
      type: 'model_output',
      content: [{ type: 'image', data: 'YWJjZA==', mime_type: 'image/jpeg' }],
    }],
    usage: { total_input_tokens: 500, total_output_tokens: 1_120 },
    ...overrides,
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'private-google-key',
    model: 'gemini-3.1-flash-image',
    fallbackCostUsd: 0.07,
    fetch: jest.fn().mockResolvedValue(jsonResponse(200, successfulPayload())),
    wait: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const input = {
  modelImage: 'data:image/jpeg;base64,Ym9keQ==',
  garmentImage: 'data:image/png;base64,Z2FybWVudA==',
  category: 'dress' as const,
};

describe('direct Gemini image provider adapter', () => {
  it('generates a stateless private try-on from two inline images', async () => {
    const deps = dependencies();
    const provider = createGeminiProvider(deps);

    await expect(provider.generateTryOn(input)).resolves.toEqual({
      id: 'interaction-1',
      provider: 'gemini',
      costUsd: 0.07,
      bytes: expect.any(ArrayBuffer),
      contentType: 'image/jpeg',
    });

    expect(deps.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'x-goog-api-key': 'private-google-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const requestBody = JSON.parse((deps.fetch as jest.Mock).mock.calls[0][1].body);
    expect(requestBody).toEqual({
      model: 'gemini-3.1-flash-image',
      input: [
        { type: 'text', text: expect.stringMatching(/second reference image.*dress/i) },
        { type: 'image', mime_type: 'image/jpeg', data: 'Ym9keQ==' },
        { type: 'image', mime_type: 'image/png', data: 'Z2FybWVudA==' },
      ],
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg',
        aspect_ratio: '2:3',
        image_size: '1K',
      },
      store: false,
    });
  });

  it('supports the output_image convenience response', async () => {
    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, successfulPayload({
        output_image: { type: 'image', data: 'YWJjZA==', mime_type: 'image/png' },
        steps: [],
      }))),
    });

    await expect(createGeminiProvider(deps).generateTryOn(input)).resolves.toEqual(
      expect.objectContaining({ contentType: 'image/png' }),
    );
  });

  it('retries rate limits and server failures with bounded backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, successfulPayload()));
    const deps = dependencies({ fetch });

    await createGeminiProvider(deps).generateTryOn(input);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(deps.wait).toHaveBeenNthCalledWith(1, 500);
    expect(deps.wait).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('does not retry permanent API errors', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(400, {}));
    const deps = dependencies({ fetch });

    await expect(createGeminiProvider(deps).generateTryOn(input)).rejects.toEqual(
      expect.objectContaining<Partial<GeminiProviderError>>({ status: 400, retryable: false }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(deps.wait).not.toHaveBeenCalled();
  });

  it('requires server-side configuration and rejects malformed output', async () => {
    expect(() => createGeminiProvider(dependencies({ apiKey: '' }))).toThrow(
      'Virtual try-on is not configured.',
    );

    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, successfulPayload({
        steps: [{
          type: 'model_output',
          content: [{ type: 'image', data: 'not base64', mime_type: 'image/gif' }],
        }],
      }))),
    });
    await expect(createGeminiProvider(deps).generateTryOn(input)).rejects.toBeInstanceOf(
      GeminiProviderError,
    );
  });

  it('rejects malformed private image data before making a provider request', async () => {
    const deps = dependencies();

    await expect(createGeminiProvider(deps).generateTryOn({
      ...input,
      garmentImage: 'https://example.com/public-garment.jpg',
    })).rejects.toBeInstanceOf(GeminiProviderError);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});
