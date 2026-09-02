import type { TryOnCategory } from './processor.ts';

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type ProviderDependencies = {
  apiKey: string;
  costUsd: number;
  fetch: (url: string, init: Record<string, unknown>) => Promise<FetchResponse>;
  wait?: (milliseconds: number) => Promise<void>;
};

const categoryMap: Record<TryOnCategory, 'tops' | 'bottoms' | 'one-pieces' | 'auto'> = {
  top: 'tops',
  bottom: 'bottoms',
  dress: 'one-pieces',
  outerwear: 'tops',
  shoes: 'auto',
};

export class FashnProviderError extends Error {
  constructor(public readonly status: number | null, public readonly retryable: boolean) {
    super('Virtual try-on provider failed.');
    this.name = 'FashnProviderError';
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function decodeDataUri(value: unknown) {
  if (typeof value !== 'string') throw new FashnProviderError(null, false);
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new FashnProviderError(null, false);
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { bytes: bytes.buffer, contentType: match[1] as 'image/jpeg' | 'image/png' };
}

export function createFashnProvider(dependencies: ProviderDependencies) {
  if (!dependencies.apiKey || !Number.isFinite(dependencies.costUsd) || dependencies.costUsd < 0) {
    throw new Error('Virtual try-on is not configured.');
  }
  const wait = dependencies.wait ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const headers = {
    Authorization: `Bearer ${dependencies.apiKey}`,
    'Content-Type': 'application/json',
  };

  const request = async (url: string, init: Record<string, unknown>, attempts = 1) => {
    let lastError: FashnProviderError | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await dependencies.fetch(url, init);
        if (response.ok) return response.json();
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new FashnProviderError(response.status, retryable);
        if (!retryable) throw lastError;
      } catch (error) {
        lastError = error instanceof FashnProviderError ? error : new FashnProviderError(null, true);
        if (!lastError.retryable) throw lastError;
      }
      if (attempt < attempts - 1) await wait(500 * (2 ** attempt));
    }
    throw lastError ?? new FashnProviderError(null, false);
  };

  return {
    async createPrediction(input: { modelImage: string; garmentImage: string; category: TryOnCategory }) {
      const payload = record(await request('https://api.fashn.ai/v1/run', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model_name: 'tryon-v1.6',
          inputs: {
            model_image: input.modelImage,
            garment_image: input.garmentImage,
            category: categoryMap[input.category],
            garment_photo_type: 'flat-lay',
            mode: 'balanced',
            moderation_level: 'permissive',
            seed: 42,
            num_samples: 1,
            output_format: 'jpeg',
            return_base64: true,
          },
        }),
      }, 3));
      if (typeof payload.id !== 'string' || !payload.id) throw new FashnProviderError(null, false);
      return { id: payload.id, provider: 'fashn', costUsd: dependencies.costUsd };
    },

    async getPrediction(predictionId: string) {
      const payload = record(await request(`https://api.fashn.ai/v1/status/${encodeURIComponent(predictionId)}`, {
        headers: { Authorization: `Bearer ${dependencies.apiKey}` },
      }));
      if (payload.status === 'failed') return { state: 'failed' as const };
      if (payload.status === 'starting' || payload.status === 'in_queue' || payload.status === 'processing') {
        return { state: 'processing' as const };
      }
      if (payload.status === 'completed') {
        const output = Array.isArray(payload.output) ? payload.output[0] : undefined;
        return { state: 'completed' as const, ...decodeDataUri(output) };
      }
      throw new FashnProviderError(null, false);
    },
  };
}
