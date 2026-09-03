export type TryOnCategory = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes';

type ClaimResult =
  | {
      state: 'claimed';
      job: {
        id: string;
        userId: string;
        bodyPath: string;
        garmentPath: string;
        category: TryOnCategory;
      };
    }
  | { state: 'running' | 'done' | 'failed' | 'not-found' };

type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

function storedInputContentType(path: string): 'image/jpeg' | 'image/png' {
  return path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

export type TryOnProcessingDependencies = {
  claim: (input: { jobId: string; userId: string }) => Promise<ClaimResult>;
  downloadInput: (bucket: 'body' | 'garments', path: string, contentType: 'image/jpeg' | 'image/png') => Promise<string>;
  generateTryOn: (input: {
    modelImage: string;
    garmentImage: string;
    category: TryOnCategory;
  }) => Promise<{
    id: string;
    provider: string;
    costUsd: number;
    bytes: ArrayBuffer;
    contentType: ImageContentType;
  }>;
  setProviderJob: (input: {
    jobId: string;
    userId: string;
    provider: string;
    providerJobId: string;
  }) => Promise<void>;
  uploadResult: (path: string, bytes: ArrayBuffer, contentType: ImageContentType) => Promise<void>;
  complete: (input: {
    jobId: string;
    userId: string;
    resultPath: string;
    provider: string;
    costUsd: number;
    latencyMs: number;
  }) => Promise<void>;
  fail: (input: {
    jobId: string;
    userId: string;
    failureCode: string;
    provider: string;
    costUsd: number;
  }) => Promise<void>;
  removeResult: (path: string) => Promise<void>;
  now?: () => number;
};

export class TryOnProcessingFailure extends Error {
  constructor(public readonly code: 'generation_failed' | 'timeout') {
    super('Virtual try-on failed. Try again.');
    this.name = 'TryOnProcessingFailure';
  }
}

export async function processTryOn(
  input: { jobId: string; userId: string },
  dependencies: TryOnProcessingDependencies,
) {
  const claim = await dependencies.claim(input);
  if (claim.state !== 'claimed') return { state: claim.state };

  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  let provider = 'openrouter';
  let costUsd = 0;
  let providerCompleted = false;
  let resultUploaded = false;
  let resultPath = '';

  try {
    const [modelImage, garmentImage] = await Promise.all([
      dependencies.downloadInput(
        'body',
        claim.job.bodyPath,
        storedInputContentType(claim.job.bodyPath),
      ),
      dependencies.downloadInput(
        'garments',
        claim.job.garmentPath,
        storedInputContentType(claim.job.garmentPath),
      ),
    ]);
    const generation = await dependencies.generateTryOn({
      modelImage,
      garmentImage,
      category: claim.job.category,
    });
    provider = generation.provider;
    costUsd = generation.costUsd;
    providerCompleted = true;
    await dependencies.setProviderJob({
      jobId: input.jobId,
      userId: input.userId,
      provider,
      providerJobId: generation.id,
    });

    const extension = generation.contentType === 'image/png'
      ? 'png'
      : generation.contentType === 'image/webp' ? 'webp' : 'jpg';
    resultPath = `${input.userId}/${input.jobId}.${extension}`;
    await dependencies.uploadResult(resultPath, generation.bytes, generation.contentType);
    resultUploaded = true;
    await dependencies.complete({
      jobId: input.jobId,
      userId: input.userId,
      resultPath,
      provider,
      costUsd,
      latencyMs: Math.max(0, now() - startedAt),
    });
    return { state: 'done' as const, jobId: input.jobId, resultPath };
  } catch (error) {
    if (resultUploaded && resultPath) {
      await dependencies.removeResult(resultPath).catch(() => undefined);
    }
    const failure = error instanceof TryOnProcessingFailure
      ? error
      : new TryOnProcessingFailure('generation_failed');
    await dependencies.fail({
      jobId: input.jobId,
      userId: input.userId,
      failureCode: failure.code,
      provider,
      costUsd: providerCompleted ? costUsd : 0,
    }).catch(() => undefined);
    throw failure;
  }
}
