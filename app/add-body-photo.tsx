import { router } from 'expo-router';
import { BodyPhotoCaptureScreen } from '../src/features/body-photos/BodyPhotoCaptureScreen';
import { ValidatedBodyPhotoAsset } from '../src/features/body-photos/bodyPhotoValidation';
import { useUploadBodyPhoto } from '../src/features/body-photos/useBodyPhotos';
import { useAuth } from '../src/providers/AuthProvider';

export default function AddBodyPhotoRoute() {
  const { identity } = useAuth();
  const upload = useUploadBodyPhoto(identity?.id ?? 'signed-out');

  if (!identity) {
    return null;
  }

  const handleUpload = async (asset: ValidatedBodyPhotoAsset) => {
    await upload.mutateAsync(asset);
  };

  return <BodyPhotoCaptureScreen onClose={() => router.back()} onUpload={handleUpload} />;
}
