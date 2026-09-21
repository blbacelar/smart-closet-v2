import type {
  BodyPhoto,
  BodyPhotoRejectReason,
} from './bodyPhotoRepository';

const guidanceByReason: Record<BodyPhotoRejectReason, string> = {
  adult_content: 'Choose a photo without nudity or sexual content.',
  age_not_confirmed: 'Fitly could not confirm adult eligibility. Choose a clear photo of yourself.',
  no_single_person: 'Use a photo with one real person only.',
  not_full_body: 'Make sure your full body is visible from head to toe.',
  poor_quality: 'Use a sharp, well-lit photo without heavy obstruction.',
};

const statusLabels: Record<BodyPhoto['status'], string> = {
  approved: 'Ready',
  pending: 'Checking',
  rejected: 'Needs a new photo',
};

export function bodyPhotoStatusLabel(status: BodyPhoto['status']) {
  return statusLabels[status];
}

export function bodyPhotoGuidance(reason: BodyPhotoRejectReason | string | null) {
  if (reason && reason in guidanceByReason) {
    return guidanceByReason[reason as BodyPhotoRejectReason];
  }
  return 'Choose a clear, well-lit full-body photo of yourself.';
}

export function approvedBodyPhotos(photos: BodyPhoto[]) {
  return photos.filter((photo) => photo.status === 'approved');
}
