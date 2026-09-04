import type { GarmentImageContentType } from './removeBgProvider.ts';

export type ProcessingState = 'ready' | 'busy' | 'exhausted' | 'not-found';

export type ProcessingResult =
  | { state: 'ready'; garmentId?: string; cleanPath?: string }
  | { state: 'busy' | 'exhausted' | 'not-found' };

export type ClaimedGarment = {
  id: string;
  userId: string;
  originalPath: string;
  attempt: number;
};

export type ProcessingDependencies = {
  claim: (input: { garmentId: string; userId: string }) => Promise<
    | { state: 'claimed'; garment: ClaimedGarment }
    | { state: ProcessingState }
  >;
  downloadOriginal: (storagePath: string) => Promise<ArrayBuffer>;
  removeBackground: (bytes: ArrayBuffer) => Promise<{
    bytes: ArrayBuffer;
    provider: string;
    costUsd: number;
    contentType: GarmentImageContentType;
  }>;
  hash: (bytes: ArrayBuffer) => Promise<string>;
  uploadClean: (
    storagePath: string,
    bytes: ArrayBuffer,
    contentType: GarmentImageContentType,
  ) => Promise<void>;
  complete: (input: {
    garmentId: string;
    userId: string;
    cleanPath: string;
    imageHash: string;
    provider: string;
    costUsd: number;
  }) => Promise<void>;
  fail: (input: { garmentId: string; userId: string; message: string }) => Promise<void>;
  removeClean: (storagePath: string) => Promise<void>;
};

export class ProcessingFailure extends Error {
  readonly code = 'processing_failed';

  constructor() {
    super('Background removal failed. Try again.');
    this.name = 'ProcessingFailure';
  }
}

export async function processGarment(
  input: { garmentId: string; userId: string },
  dependencies: ProcessingDependencies,
): Promise<ProcessingResult> {
  const claim = await dependencies.claim(input);
  if (claim.state !== 'claimed') {
    return { state: claim.state };
  }

  const { garment } = claim;
  let cleanPath: string | undefined;
  let cleanWasUploaded = false;

  try {
    const original = await dependencies.downloadOriginal(garment.originalPath);
    const cleaned = await dependencies.removeBackground(original);
    const extension = cleaned.contentType === 'image/png' ? 'png' : 'jpg';
    cleanPath = `${garment.userId}/${garment.id}-clean.${extension}`;
    const imageHash = await dependencies.hash(cleaned.bytes);
    await dependencies.uploadClean(cleanPath, cleaned.bytes, cleaned.contentType);
    cleanWasUploaded = true;
    await dependencies.complete({
      garmentId: garment.id,
      userId: garment.userId,
      cleanPath,
      imageHash,
      provider: cleaned.provider,
      costUsd: cleaned.costUsd,
    });

    return { state: 'ready', garmentId: garment.id, cleanPath };
  } catch {
    if (cleanWasUploaded && cleanPath) {
      await dependencies.removeClean(cleanPath).catch(() => undefined);
    }
    await dependencies
      .fail({
        garmentId: garment.id,
        userId: garment.userId,
        message: 'Background removal failed. Try again.',
      })
      .catch(() => undefined);
    throw new ProcessingFailure();
  }
}
