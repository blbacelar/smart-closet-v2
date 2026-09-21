export const bodyPhotoRejectReasons = [
  'adult_content',
  'age_not_confirmed',
  'no_single_person',
  'not_full_body',
  'poor_quality',
] as const;

export type BodyPhotoRejectReason = typeof bodyPhotoRejectReasons[number];

type ModerationResult =
  | { decision: 'approved'; reason: null; provider: 'gemini'; costUsd: number }
  | { decision: 'rejected'; reason: BodyPhotoRejectReason; provider: 'gemini'; costUsd: number };

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

export class GeminiModerationProviderError extends Error {
  constructor(public readonly status: number | null, public readonly retryable: boolean) {
    super('Body-photo validation provider failed.');
    this.name = 'GeminiModerationProviderError';
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

function moderationPrompt() {
  return [
    'Review this private full-body photo for adult eligibility and image quality.',
    'Approve only when it contains exactly one real person who clearly appears to be an adult, shown head to toe in a front or near-front pose.',
    'Reject explicit sexual nudity or adult content as adult_content.',
    'Do not estimate an exact age. If adult status cannot be established confidently, reject as age_not_confirmed.',
    'Reject zero people, multiple people, illustrations, mannequins, or an unusable subject as no_single_person.',
    'Reject cropped or substantially occluded bodies as not_full_body.',
    'Reject images that are too dark, blurry, distorted, or otherwise unsuitable for virtual try-on as poor_quality.',
    'Return only the required structured decision and reason. Never include a description of the person or image.',
  ].join(' ');
}

function parseModeration(payload: unknown, costUsd: number): ModerationResult {
  const response = record(payload);
  if (typeof response.id !== 'string' || response.id.length === 0 || typeof response.output_text !== 'string') {
    throw new GeminiModerationProviderError(null, false);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = record(JSON.parse(response.output_text));
  } catch {
    throw new GeminiModerationProviderError(null, false);
  }
  if (Object.keys(parsed).length !== 2 || !('decision' in parsed) || !('reason' in parsed)) {
    throw new GeminiModerationProviderError(null, false);
  }
  if (parsed.decision === 'approved' && parsed.reason === 'none') {
    return { decision: 'approved', reason: null, provider: 'gemini', costUsd };
  }
  if (
    parsed.decision === 'rejected'
    && typeof parsed.reason === 'string'
    && bodyPhotoRejectReasons.includes(parsed.reason as BodyPhotoRejectReason)
  ) {
    return {
      decision: 'rejected',
      reason: parsed.reason as BodyPhotoRejectReason,
      provider: 'gemini',
      costUsd,
    };
  }
  throw new GeminiModerationProviderError(null, false);
}

export function createGeminiModerationProvider(dependencies: ProviderDependencies) {
  if (
    !dependencies.apiKey
    || !dependencies.model
    || !Number.isFinite(dependencies.fallbackCostUsd)
    || dependencies.fallbackCostUsd < 0
  ) {
    throw new Error('Body-photo validation is not configured.');
  }

  const wait = dependencies.wait
    ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const schema = {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['approved', 'rejected'] },
      reason: { type: 'string', enum: ['none', ...bodyPhotoRejectReasons] },
    },
    required: ['decision', 'reason'],
    additionalProperties: false,
  };

  return {
    async moderate(input: { bytes: ArrayBuffer; contentType: 'image/jpeg' }): Promise<ModerationResult> {
      let lastError: GeminiModerationProviderError | null = null;
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
                  { type: 'text', text: moderationPrompt() },
                  { type: 'image', mime_type: input.contentType, data: base64(input.bytes) },
                ],
                response_format: {
                  type: 'text',
                  mime_type: 'application/json',
                  schema,
                },
                generation_config: { max_output_tokens: 128 },
                store: false,
              }),
            },
          );
          if (response.ok) {
            return parseModeration(await response.json(), dependencies.fallbackCostUsd);
          }
          const retryable = response.status === 429 || response.status >= 500;
          lastError = new GeminiModerationProviderError(response.status, retryable);
          if (!retryable) throw lastError;
        } catch (error) {
          lastError = error instanceof GeminiModerationProviderError
            ? error
            : new GeminiModerationProviderError(null, true);
          if (!lastError.retryable) throw lastError;
        }
        if (attempt < 2) await wait(500 * (2 ** attempt));
      }
      throw lastError ?? new GeminiModerationProviderError(null, false);
    },
  };
}
