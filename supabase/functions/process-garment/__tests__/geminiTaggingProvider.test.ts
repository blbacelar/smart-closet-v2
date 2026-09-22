import {
  createGeminiTaggingProvider,
  GeminiTaggingProviderError,
} from '../geminiTaggingProvider';

function response(input: { ok: boolean; status: number; body?: unknown }) {
  return {
    ok: input.ok,
    status: input.status,
    json: jest.fn().mockResolvedValue(input.body ?? {}),
  };
}

function provider(overrides: Record<string, unknown> = {}) {
  return createGeminiTaggingProvider({
    apiKey: 'server-key',
    model: 'gemini-3.8-flash',
    fallbackCostUsd: 0.001,
    fetch: jest.fn().mockResolvedValue(response({
      ok: true,
      status: 200,
      body: { id: 'interaction-1', output_text: JSON.stringify({ category: 'outerwear' }) },
    })),
    wait: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

describe('Gemini garment tagging provider', () => {
  it('classifies a private image into the supported category schema', async () => {
    const fetch = jest.fn().mockResolvedValue(response({
      ok: true,
      status: 200,
      body: { id: 'interaction-1', output_text: JSON.stringify({ category: 'outerwear' }) },
    }));
    const tagging = provider({ fetch });

    await expect(tagging.detect({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      contentType: 'image/jpeg',
    })).resolves.toEqual({ category: 'outerwear', provider: 'gemini', costUsd: 0.001 });

    const [url, init] = fetch.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(init.headers).toEqual(expect.objectContaining({ 'x-goog-api-key': 'server-key' }));
    expect(body.input[1]).toEqual({ type: 'image', mime_type: 'image/jpeg', data: 'AQID' });
    expect(body.response_format).toEqual(expect.objectContaining({
      type: 'text',
      mime_type: 'application/json',
      schema: expect.objectContaining({
        properties: expect.objectContaining({
          category: expect.objectContaining({ enum: ['top', 'bottom', 'dress', 'outerwear', 'shoes'] }),
        }),
      }),
    }));
    expect(body.store).toBe(false);
  });

  it('retries temporary provider failures with bounded backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(response({ ok: false, status: 429 }))
      .mockResolvedValueOnce(response({
        ok: true,
        status: 200,
        body: { id: 'interaction-2', output_text: JSON.stringify({ category: 'dress' }) },
      }));
    const wait = jest.fn().mockResolvedValue(undefined);
    const tagging = provider({ fetch, wait });

    await expect(tagging.detect({
      bytes: new ArrayBuffer(2),
      contentType: 'image/jpeg',
    })).resolves.toEqual({ category: 'dress', provider: 'gemini', costUsd: 0.001 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(500);
  });

  it.each([
    { id: 'interaction-1', output_text: '{not-json' },
    { id: 'interaction-1', output_text: JSON.stringify({ category: 'accessory' }) },
    { output_text: JSON.stringify({ category: 'top' }) },
  ])('rejects malformed or unsupported classifications', async (body) => {
    const fetch = jest.fn().mockResolvedValue(response({ ok: true, status: 200, body }));
    const tagging = provider({ fetch });

    await expect(tagging.detect({
      bytes: new ArrayBuffer(2),
      contentType: 'image/jpeg',
    })).rejects.toEqual(expect.objectContaining<Partial<GeminiTaggingProviderError>>({ retryable: false }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects missing or unsafe configuration before spending', () => {
    expect(() => provider({ apiKey: '' })).toThrow('Garment tagging is not configured.');
    expect(() => provider({ fallbackCostUsd: -1 })).toThrow('Garment tagging is not configured.');
  });
});
