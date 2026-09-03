import type { TryOnCategory } from './processor.ts';

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type ProviderDependencies = {
  apiKey: string;
  model: string;
  fallbackCostUsd: number;
  fetch: (url: string, init: Record<string, unknown>) => Promise<FetchResponse>;
  wait?: (milliseconds: number) => Promise<void>;
};

type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

const categoryDescription: Record<TryOnCategory, string> = {
  top: 'top',
  bottom: 'bottom',
  dress: 'dress',
  outerwear: 'outerwear garment',
  shoes: 'pair of shoes',
};

export class GeminiProviderError extends Error {
  constructor(public readonly status: number | null, public readonly retryable: boolean) {
    super('Virtual try-on provider failed.');
    this.name = 'GeminiProviderError';
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

function inlineImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!match || !validBase64(match[2])) {
    throw new GeminiProviderError(null, false);
  }
  return { type: 'image', mime_type: match[1], data: match[2] };
}

function imageBlock(payload: Record<string, unknown>) {
  const direct = record(payload.output_image);
  if (direct.type === 'image') return direct;

  const steps = Array.isArray(payload.steps) ? [...payload.steps].reverse() : [];
  for (const stepValue of steps) {
    const step = record(stepValue);
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const content = [...step.content].reverse();
    for (const contentValue of content) {
      const block = record(contentValue);
      if (block.type === 'image') return block;
    }
  }
  return {};
}

function decodeImage(payload: Record<string, unknown>) {
  const block = imageBlock(payload);
  const contentType = block.mime_type;
  if (
    !validBase64(block.data)
    || !['image/jpeg', 'image/png', 'image/webp'].includes(String(contentType))
  ) {
    throw new GeminiProviderError(null, false);
  }

  try {
    const binary = atob(block.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes: bytes.buffer, contentType: contentType as ImageContentType };
  } catch {
    throw new GeminiProviderError(null, false);
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

export function createGeminiProvider(dependencies: ProviderDependencies) {
  if (
    !dependencies.apiKey
    || !dependencies.model
    || !Number.isFinite(dependencies.fallbackCostUsd)
    || dependencies.fallbackCostUsd < 0
  ) {
    throw new Error('Virtual try-on is not configured.');
  }

  const wait = dependencies.wait
    ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const headers = {
    'x-goog-api-key': dependencies.apiKey,
    'Content-Type': 'application/json',
  };

  const request = async (init: Record<string, unknown>, attempts = 3) => {
    let lastError: GeminiProviderError | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await dependencies.fetch(
          'https://generativelanguage.googleapis.com/v1beta/interactions',
          init,
        );
        if (response.ok) return record(await response.json());
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new GeminiProviderError(response.status, retryable);
        if (!retryable) throw lastError;
      } catch (error) {
        lastError = error instanceof GeminiProviderError
          ? error
          : new GeminiProviderError(null, true);
        if (!lastError.retryable) throw lastError;
      }
      if (attempt < attempts - 1) await wait(500 * (2 ** attempt));
    }
    throw lastError ?? new GeminiProviderError(null, false);
  };

  return {
    async generateTryOn(input: {
      modelImage: string;
      garmentImage: string;
      category: TryOnCategory;
    }) {
      const modelImage = inlineImage(input.modelImage);
      const garmentImage = inlineImage(input.garmentImage);
      const payload = await request({
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: dependencies.model,
          input: [
            { type: 'text', text: tryOnPrompt(input.category) },
            modelImage,
            garmentImage,
          ],
          response_format: {
            type: 'image',
            mime_type: 'image/jpeg',
            aspect_ratio: '2:3',
            image_size: '1K',
          },
          store: false,
        }),
      });
      const id = payload.id;
      if (typeof id !== 'string' || id.length === 0) {
        throw new GeminiProviderError(null, false);
      }

      return {
        id,
        provider: 'gemini',
        costUsd: dependencies.fallbackCostUsd,
        ...decodeImage(payload),
      };
    },
  };
}
