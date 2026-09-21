import type { BodyPhotoRejectReason } from './geminiModerationProvider.ts';

type ValidationState = 'approved' | 'rejected' | 'busy' | 'exhausted' | 'not-found';

export type ValidationResult =
  | { state: 'approved'; photoId: string; rejectReason: null }
  | { state: 'rejected'; photoId: string; rejectReason: BodyPhotoRejectReason }
  | { state: 'busy' | 'exhausted' | 'not-found' };

type ClaimedPhoto = {
  id: string;
  userId: string;
  storagePath: string;
  attempt: number;
};

export type BodyPhotoValidationDependencies = {
  claim: (input: { photoId: string; userId: string }) => Promise<
    | { state: 'claimed'; photo: ClaimedPhoto }
    | { state: ValidationState }
  >;
  download: (storagePath: string) => Promise<{
    bytes: ArrayBuffer;
    contentType: 'image/jpeg';
  }>;
  moderate: (input: { bytes: ArrayBuffer; contentType: 'image/jpeg' }) => Promise<
    | { decision: 'approved'; reason: null; provider: string; costUsd: number }
    | { decision: 'rejected'; reason: BodyPhotoRejectReason; provider: string; costUsd: number }
  >;
  complete: (input: {
    photoId: string;
    userId: string;
    attempt: number;
    decision: 'approved' | 'rejected';
    rejectReason: BodyPhotoRejectReason | null;
    provider: string;
    costUsd: number;
  }) => Promise<void>;
  fail: (input: {
    photoId: string;
    userId: string;
    attempt: number;
    message: string;
  }) => Promise<void>;
};

const safeFailureMessage = 'Photo validation is temporarily unavailable. Try again.';

export class BodyPhotoValidationFailure extends Error {
  readonly code = 'validation_failed';

  constructor() {
    super(safeFailureMessage);
    this.name = 'BodyPhotoValidationFailure';
  }
}

export async function validateBodyPhoto(
  input: { photoId: string; userId: string },
  dependencies: BodyPhotoValidationDependencies,
): Promise<ValidationResult> {
  const claim = await dependencies.claim(input);
  if (claim.state !== 'claimed') return { state: claim.state };

  const { photo } = claim;
  try {
    const image = await dependencies.download(photo.storagePath);
    const moderation = await dependencies.moderate(image);
    await dependencies.complete({
      photoId: photo.id,
      userId: photo.userId,
      attempt: photo.attempt,
      decision: moderation.decision,
      rejectReason: moderation.reason,
      provider: moderation.provider,
      costUsd: moderation.costUsd,
    });
    return moderation.decision === 'approved'
      ? { state: 'approved', photoId: photo.id, rejectReason: null }
      : { state: 'rejected', photoId: photo.id, rejectReason: moderation.reason };
  } catch {
    await dependencies.fail({
      photoId: photo.id,
      userId: photo.userId,
      attempt: photo.attempt,
      message: safeFailureMessage,
    }).catch(() => undefined);
    throw new BodyPhotoValidationFailure();
  }
}
