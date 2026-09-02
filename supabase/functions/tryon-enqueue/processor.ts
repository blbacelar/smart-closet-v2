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

type PredictionStatus =
  | { state: 'processing' }
  | { state: 'failed' }
  | { state: 'completed'; bytes: ArrayBuffer; contentType: 'image/jpeg' | 'image/png' };

export type TryOnProcessingDependencies = {
  claim: (input: { jobId: string; userId: string }) => Promise<ClaimResult>;
  downloadInput: (bucket: 'body' | 'garments', path: string, contentType: 'image/jpeg' | 'image/png') => Promise<string>;
  createPrediction: (input: {
    modelImage: string;
    garmentImage: string;
    category: TryOnCategory;
  }) => Promise<{ id: string; provider: string; costUsd: number }>;
  setProviderJob: (input: {
    jobId: string;
    userId: string;
    provider: string;
    providerJobId: string;
  }) => Promise<void>;
  getPrediction: (predictionId: string) => Promise<PredictionStatus>;
  wait: (milliseconds: number) => Promise<void>;
  uploadResult: (path: string, bytes: ArrayBuffer, contentType: 'image/jpeg' | 'image/png') => Promise<void>;
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
  maxPolls?: number;
  pollIntervalMs?: number;
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
  const maxPolls = dependencies.maxPolls ?? 30;
  const pollIntervalMs = dependencies.pollIntervalMs ?? 3_000;
  const startedAt = now();
  let provider = 'fashn';
  let costUsd = 0;
  let providerCompleted = false;
  let resultUploaded = false;
  let resultPath = '';

  try {
    const [modelImage, garmentImage] = await Promise.all([
      dependencies.downloadInput('body', claim.job.bodyPath, 'image/jpeg'),
      dependencies.downloadInput('garments', claim.job.garmentPath, 'image/png'),
    ]);
    const prediction = await dependencies.createPrediction({
      modelImage,
      garmentImage,
      category: claim.job.category,
    });
    provider = prediction.provider;
    costUsd = prediction.costUsd;
    await dependencies.setProviderJob({
      jobId: input.jobId,
      userId: input.userId,
      provider,
      providerJobId: prediction.id,
    });

    for (let attempt = 0; attempt < maxPolls; attempt += 1) {
      const status = await dependencies.getPrediction(prediction.id);
      if (status.state === 'failed') throw new TryOnProcessingFailure('generation_failed');
      if (status.state === 'completed') {
        providerCompleted = true;
        const extension = status.contentType === 'image/png' ? 'png' : 'jpg';
        resultPath = `${input.userId}/${input.jobId}.${extension}`;
        await dependencies.uploadResult(resultPath, status.bytes, status.contentType);
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
      }
      if (attempt < maxPolls - 1) await dependencies.wait(pollIntervalMs);
    }

    throw new TryOnProcessingFailure('timeout');
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
