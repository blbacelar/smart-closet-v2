import { router } from 'expo-router';
import { GarmentCaptureScreen } from '../src/features/garments/GarmentCaptureScreen';
import { GarmentDetails, ValidatedGarmentAsset } from '../src/features/garments/garmentValidation';
import { useUploadGarment } from '../src/features/garments/useGarments';
import { useAuth } from '../src/providers/AuthProvider';
import { observability } from '../src/lib/observability';

export default function AddGarmentRoute() {
  const { identity } = useAuth();
  const upload = useUploadGarment(identity?.id ?? 'signed-out');

  if (!identity) {
    return null;
  }

  const handleUpload = async (input: {
    asset: ValidatedGarmentAsset;
    details: GarmentDetails;
  }) => {
    await upload.mutateAsync(input);
    observability.track('garment_uploaded', {
      categoryMode: input.details.category ? 'manual' : 'automatic',
    });
  };

  return <GarmentCaptureScreen onClose={() => router.back()} onUpload={handleUpload} />;
}
