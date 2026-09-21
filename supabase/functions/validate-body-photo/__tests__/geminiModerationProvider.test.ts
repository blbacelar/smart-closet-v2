import {
  GeminiModerationProviderError,
  createGeminiModerationProvider,
} from '../geminiModerationProvider';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'private-google-key',
    model: 'gemini-3.8-flash',
    fallbackCostUsd: 0.001,
    fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
      id: 'interaction-1',
      output_text: JSON.stringify({ decision: 'approved', reason: 'none' }),
    })),
    wait: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Gemini body-photo moderation provider', () => {
  it('classifies a private image with a strict stateless response schema', async () => {
    const deps = dependencies();
    const provider = createGeminiModerationProvider(deps);

    await expect(provider.moderate({
      bytes: Uint8Array.from([97, 98, 99, 100]).buffer,
      contentType: 'image/jpeg',
    })).resolves.toEqual({
      decision: 'approved',
      reason: null,
      provider: 'gemini',
      costUsd: 0.001,
    });

    const [url, request] = (deps.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        'x-goog-api-key': 'private-google-key',
        'Content-Type': 'application/json',
      },
    });
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      model: 'gemini-3.8-flash',
      input: [
        { type: 'text', text: expect.stringMatching(/full-body.*adult.*quality/i) },
        { type: 'image', mime_type: 'image/jpeg', data: 'YWJjZA==' },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: expect.objectContaining({ type: 'object' }),
      },
      store: false,
    });
  });

  it.each([
    'adult_content',
    'age_not_confirmed',
    'no_single_person',
    'not_full_body',
    'poor_quality',
  ] as const)('accepts the allowlisted rejection reason %s', async (reason) => {
    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        id: 'interaction-1',
        output_text: JSON.stringify({ decision: 'rejected', reason }),
      })),
    });

    await expect(createGeminiModerationProvider(deps).moderate({
      bytes: new ArrayBuffer(2),
      contentType: 'image/jpeg',
    })).resolves.toEqual({ decision: 'rejected', reason, provider: 'gemini', costUsd: 0.001 });
  });

  it('retries transient provider failures with bounded backoff', async () => {
    const fetch = jest.fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, {
        id: 'interaction-1',
        output_text: JSON.stringify({ decision: 'approved', reason: 'none' }),
      }));
    const deps = dependencies({ fetch });

    await createGeminiModerationProvider(deps).moderate({
      bytes: new ArrayBuffer(2),
      contentType: 'image/jpeg',
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(deps.wait).toHaveBeenNthCalledWith(1, 500);
    expect(deps.wait).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('rejects malformed or unsafe provider output', async () => {
    const deps = dependencies({
      fetch: jest.fn().mockResolvedValue(jsonResponse(200, {
        id: 'interaction-1',
        output_text: JSON.stringify({ decision: 'rejected', reason: 'raw provider explanation' }),
      })),
    });

    await expect(createGeminiModerationProvider(deps).moderate({
      bytes: new ArrayBuffer(2),
      contentType: 'image/jpeg',
    })).rejects.toBeInstanceOf(GeminiModerationProviderError);
  });

  it('requires complete server-only configuration', () => {
    expect(() => createGeminiModerationProvider(dependencies({ apiKey: '' }))).toThrow(
      'Body-photo validation is not configured.',
    );
    expect(() => createGeminiModerationProvider(dependencies({ fallbackCostUsd: -1 }))).toThrow(
      'Body-photo validation is not configured.',
    );
  });
});
