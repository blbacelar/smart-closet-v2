type FetchResponse = {
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type FetchLike = (url: string, init: RequestInit) => Promise<FetchResponse>;
type Wait = (milliseconds: number) => Promise<void>;

export class RemoveBgError extends Error {
  constructor(
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super('Background removal provider request failed.');
    this.name = 'RemoveBgError';
  }
}

const defaultWait: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createRemoveBgProvider(input: {
  apiKey: string;
  costUsd: number;
  fetch: FetchLike;
  wait?: Wait;
}) {
  if (!input.apiKey || !Number.isFinite(input.costUsd) || input.costUsd < 0) {
    throw new Error('Background removal is not configured.');
  }

  const wait = input.wait ?? defaultWait;

  return {
    async remove(bytes: ArrayBuffer) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const form = new FormData();
          form.append('size', 'auto');
          form.append('format', 'png');
          form.append('image_file', new Blob([bytes], { type: 'image/jpeg' }), 'garment.jpg');

          const response = await input.fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: { 'X-Api-Key': input.apiKey },
            body: form,
          });

          if (response.ok) {
            return {
              bytes: await response.arrayBuffer(),
              provider: 'remove-bg',
              costUsd: input.costUsd,
            };
          }

          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable || attempt === 2) {
            throw new RemoveBgError(response.status, retryable);
          }
        } catch (error) {
          if (error instanceof RemoveBgError && !error.retryable) {
            throw error;
          }
          if (attempt === 2) {
            throw error instanceof RemoveBgError ? error : new RemoveBgError(0, true);
          }
        }

        await wait(500 * 2 ** attempt);
      }

      throw new RemoveBgError(0, true);
    },
  };
}
