import {
  approvedBodyPhotos,
  bodyPhotoGuidance,
  bodyPhotoStatusLabel,
} from '../bodyPhotoPresentation';
import type { BodyPhoto } from '../bodyPhotoRepository';

const photo: BodyPhoto = {
  id: 'photo-1',
  storagePath: 'user-1/photo-1.jpg',
  status: 'approved',
  rejectReason: null,
  validationAttempts: 1,
  validationError: null,
  createdAt: '2026-09-02T20:00:00Z',
  signedUrl: 'https://signed.example/photo-1',
};

describe('body photo presentation', () => {
  it.each([
    ['approved', 'Ready'],
    ['pending', 'Checking'],
    ['rejected', 'Needs a new photo'],
  ] as const)('labels %s photos safely', (status, label) => {
    expect(bodyPhotoStatusLabel(status)).toBe(label);
  });

  it.each([
    ['adult_content', 'Choose a photo without nudity or sexual content.'],
    ['age_not_confirmed', 'Fitly could not confirm adult eligibility. Choose a clear photo of yourself.'],
    ['no_single_person', 'Use a photo with one real person only.'],
    ['not_full_body', 'Make sure your full body is visible from head to toe.'],
    ['poor_quality', 'Use a sharp, well-lit photo without heavy obstruction.'],
  ] as const)('maps %s to fixed user guidance', (reason, message) => {
    expect(bodyPhotoGuidance(reason)).toBe(message);
  });

  it('uses fixed fallback guidance for an unknown reason', () => {
    expect(bodyPhotoGuidance('raw provider output' as never)).toBe(
      'Choose a clear, well-lit full-body photo of yourself.',
    );
  });

  it('allows only approved photos into the Studio', () => {
    expect(approvedBodyPhotos([
      photo,
      { ...photo, id: 'photo-2', status: 'pending' },
      { ...photo, id: 'photo-3', status: 'rejected' },
    ])).toEqual([photo]);
  });
});
