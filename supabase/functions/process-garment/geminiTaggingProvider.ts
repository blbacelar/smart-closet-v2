export const garmentCategories = ['top', 'bottom', 'dress', 'outerwear', 'shoes'] as const;

export type GarmentCategory = typeof garmentCategories[number];

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

export class GeminiTaggingProviderError extends Error {
  constructor(public readonly status: number | null, public readonly retryable: boolean) {
    super('Garment tagging provider failed.');
    this.name = 'GeminiTaggingProviderError';
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function taggingPrompt() {
  return [
    'Classify the primary garment in this private image into exactly one Fitly category.',
    'Use top for shirts, blouses, sweaters, hoodies, and similar upper-body garments.',
    'Use bottom for pants, jeans, shorts, and skirts.',
    'Use dress for dresses and one-piece garments primarily worn as a dress.',
    'Use outerwear for jackets, coats, blazers, and similar layering garments.',
    'Use shoes for footwear.',
    'Choose the closest supported category when the garment is ambiguous.',
    'Return only the required structured category. Do not describe the image.',
  ].join(' ');
}

function parseCategory(payload: unknown, costUsd: number) {
  const response = record(payload);
  if (typeof response.id !== 'string' || response.id.length === 0 || typeof response.output_text !== 'string') {
    throw new GeminiTaggingProviderError(null, false);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = record(JSON.parse(response.output_text));
  } catch {
    throw new GeminiTaggingProviderError(null, false);
  }
  if (
    Object.keys(parsed).length !== 1
    || typeof parsed.category !== 'string'
    || !garmentCategories.includes(parsed.category as GarmentCategory)
  ) {
    throw new GeminiTaggingProviderError(null, false);
  }

  return {
    category: parsed.category as GarmentCategory,
    provider: 'gemini' as const,
    costUsd,
  };
}

export function createGeminiTaggingProvider(dependencies: ProviderDependencies) {
  if (
    !dependencies.apiKey
    || !dependencies.model
    || !Number.isFinite(dependencies.fallbackCostUsd)
    || dependencies.fallbackCostUsd < 0
  ) {
    throw new Error('Garment tagging is not configured.');
  }

  const wait = dependencies.wait
    ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const schema = {
    type: 'object',
    properties: {
      category: { type: 'string', enum: garmentCategories },
    },
    required: ['category'],
    additionalProperties: false,
  };

  return {
    async detect(input: { bytes: ArrayBuffer; contentType: 'image/jpeg' }) {
      let lastError: GeminiTaggingProviderError | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await dependencies.fetch(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {
              method: 'POST',
              headers: {
                'x-goog-api-key': dependencies.apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: dependencies.model,
                input: [
                  { type: 'text', text: taggingPrompt() },
                  { type: 'image', mime_type: input.contentType, data: base64(input.bytes) },
                ],
                response_format: {
                  type: 'text',
                  mime_type: 'application/json',
                  schema,
                },
                generation_config: { max_output_tokens: 64, thinking_level: 'minimal' },
                store: false,
              }),
            },
          );
          if (response.ok) {
            return parseCategory(await response.json(), dependencies.fallbackCostUsd);
          }
          const retryable = response.status === 429 || response.status >= 500;
          lastError = new GeminiTaggingProviderError(response.status, retryable);
          if (!retryable) throw lastError;
        } catch (error) {
          lastError = error instanceof GeminiTaggingProviderError
            ? error
            : new GeminiTaggingProviderError(null, true);
          if (!lastError.retryable) throw lastError;
        }
        if (attempt < 2) await wait(500 * (2 ** attempt));
      }
      throw lastError ?? new GeminiTaggingProviderError(null, false);
    },
  };
}
