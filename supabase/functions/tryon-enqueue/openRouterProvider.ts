import type { TryOnCategory } from './processor.ts';

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type ProviderDependencies = {
  apiKey: string;
  model: string;
  provider: string;
  fallbackCostUsd: number;
  fetch: (url: string, init: Record<string, unknown>) => Promise<FetchResponse>;
  wait?: (milliseconds: number) => Promise<void>;
  createRequestId?: () => string;
};

type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

const categoryDescription: Record<TryOnCategory, string> = {
  top: 'top',
  bottom: 'bottom',
  dress: 'dress',
  outerwear: 'outerwear garment',
  shoes: 'pair of shoes',
};

export class OpenRouterProviderError extends Error {
  constructor(public readonly status: number | null, public readonly retryable: boolean) {
    super('Virtual try-on provider failed.');
    this.name = 'OpenRouterProviderError';
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function validBase64(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function privateImageReference(dataUrl: string) {
  const match = /^data:image\/(?:jpeg|png);base64,(.+)$/.exec(dataUrl);
  if (!match || !validBase64(match[1])) {
    throw new OpenRouterProviderError(null, false);
  }

  return { type: 'image_url', image_url: { url: dataUrl } };
}

function decodeImage(payload: Record<string, unknown>) {
  const data = Array.isArray(payload.data) ? record(payload.data[0]) : {};
  const encoded = data.b64_json;
  const contentType = data.media_type;
  if (
    !validBase64(encoded)
    || !['image/jpeg', 'image/png', 'image/webp'].includes(String(contentType))
  ) {
    throw new OpenRouterProviderError(null, false);
  }

  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes: bytes.buffer, contentType: contentType as ImageContentType };
  } catch {
    throw new OpenRouterProviderError(null, false);
  }
}

function tryOnPrompt(category: TryOnCategory) {
  return [
    'Create one photorealistic virtual try-on image.',
    'Use the first reference image as the person and the second reference image as the garment.',
    `Dress the same person in the exact ${categoryDescription[category]} shown in the second reference image.`,
    'Preserve the person’s face, identity, body proportions, pose, skin tone, hair, hands, and background.',
    'Preserve the garment’s exact color, pattern, texture, logos, cut, length, and construction.',
    'Change only the clothing needed for the try-on. Do not add accessories, text, watermarks, or extra people.',
    'Return a natural full-body fashion photograph with realistic fit, folds, lighting, and shadows.',
  ].join(' ');
}

export function createOpenRouterProvider(dependencies: ProviderDependencies) {
  if (
    !dependencies.apiKey
    || !dependencies.model
    || !dependencies.provider
    || !Number.isFinite(dependencies.fallbackCostUsd)
    || dependencies.fallbackCostUsd < 0
  ) {
    throw new Error('Virtual try-on is not configured.');
  }

  const wait = dependencies.wait
    ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const createRequestId = dependencies.createRequestId ?? (() => crypto.randomUUID());
  const headers = {
    Authorization: `Bearer ${dependencies.apiKey}`,
    'Content-Type': 'application/json',
  };

  const request = async (init: Record<string, unknown>, attempts = 3) => {
    let lastError: OpenRouterProviderError | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await dependencies.fetch('https://openrouter.ai/api/v1/images', init);
        if (response.ok) return record(await response.json());
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new OpenRouterProviderError(response.status, retryable);
        if (!retryable) throw lastError;
      } catch (error) {
        lastError = error instanceof OpenRouterProviderError
          ? error
          : new OpenRouterProviderError(null, true);
        if (!lastError.retryable) throw lastError;
      }
      if (attempt < attempts - 1) await wait(500 * (2 ** attempt));
    }
    throw lastError ?? new OpenRouterProviderError(null, false);
  };

  return {
    async generateTryOn(input: {
      modelImage: string;
      garmentImage: string;
      category: TryOnCategory;
    }) {
      const inputReferences = [
        privateImageReference(input.modelImage),
        privateImageReference(input.garmentImage),
      ];
      const payload = await request({
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: dependencies.model,
          prompt: tryOnPrompt(input.category),
          input_references: inputReferences,
          n: 1,
          resolution: '1K',
          aspect_ratio: '2:3',
          provider: {
            only: [dependencies.provider],
            allow_fallbacks: false,
            data_collection: 'deny',
            zdr: true,
            require_parameters: true,
          },
        }),
      });
      const usageCost = record(payload.usage).cost;
      const costUsd = typeof usageCost === 'number' && Number.isFinite(usageCost) && usageCost >= 0
        ? usageCost
        : dependencies.fallbackCostUsd;

      return {
        id: createRequestId(),
        provider: 'openrouter',
        costUsd,
        ...decodeImage(payload),
      };
    },
  };
}
