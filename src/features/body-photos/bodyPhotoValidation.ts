export type BodyPhotoAsset = {
  uri: string;
  base64: string | null | undefined;
  width: number;
  height: number;
};

export type ValidatedBodyPhotoAsset = BodyPhotoAsset & {
  base64: string;
  contentType: 'image/jpeg';
  byteLength: number;
};

type BodyPhotoValidationResult =
  | { ok: true; asset: ValidatedBodyPhotoAsset }
  | { ok: false; message: string };

const maxUploadBytes = 6_000_000;

function decodedByteLength(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function validateBodyPhotoAsset(asset: BodyPhotoAsset): BodyPhotoValidationResult {
  if (!asset.base64) {
    return { ok: false, message: 'Fitly could not read that photo. Choose a different image.' };
  }

  const byteLength = decodedByteLength(asset.base64);
  if (byteLength > maxUploadBytes) {
    return { ok: false, message: 'Choose a photo smaller than 6 MB.' };
  }

  if (asset.width < 600 || asset.height < 800) {
    return { ok: false, message: 'Choose a photo that is at least 600 × 800 pixels.' };
  }

  if (asset.height <= asset.width) {
    return { ok: false, message: 'Use a portrait photo that shows you from head to toe.' };
  }

  return {
    ok: true,
    asset: { ...asset, base64: asset.base64, contentType: 'image/jpeg', byteLength },
  };
}
