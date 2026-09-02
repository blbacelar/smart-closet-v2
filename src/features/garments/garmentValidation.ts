export const garmentCategories = ['top', 'bottom', 'dress', 'outerwear', 'shoes'] as const;

export type GarmentCategory = (typeof garmentCategories)[number];

export type GarmentAsset = {
  uri: string;
  base64: string | null | undefined;
  width: number;
  height: number;
};

export type ValidatedGarmentAsset = GarmentAsset & {
  base64: string;
  contentType: 'image/jpeg';
  byteLength: number;
};

export type GarmentDetailsInput = {
  name: string;
  category: GarmentCategory;
  color: string;
  size: string;
  season: string;
};

export type GarmentDetails = GarmentDetailsInput;

type AssetValidationResult =
  | { ok: true; asset: ValidatedGarmentAsset }
  | { ok: false; message: string };

type DetailsValidationResult =
  | { ok: true; details: GarmentDetails }
  | { ok: false; message: string };

const maxUploadBytes = 6_000_000;

function decodedByteLength(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function validateGarmentAsset(asset: GarmentAsset): AssetValidationResult {
  if (!asset.base64) {
    return { ok: false, message: 'Fitly could not read that photo. Choose a different image.' };
  }

  const byteLength = decodedByteLength(asset.base64);
  if (byteLength > maxUploadBytes) {
    return { ok: false, message: 'Choose a photo smaller than 6 MB.' };
  }

  if (asset.width < 600 || asset.height < 600) {
    return { ok: false, message: 'Choose a photo that is at least 600 × 600 pixels.' };
  }

  return {
    ok: true,
    asset: { ...asset, base64: asset.base64, contentType: 'image/jpeg', byteLength },
  };
}

export function validateGarmentDetails(input: GarmentDetailsInput): DetailsValidationResult {
  const details = {
    name: input.name.trim(),
    category: input.category,
    color: input.color.trim(),
    size: input.size.trim(),
    season: input.season.trim(),
  };

  if (!details.name) {
    return { ok: false, message: 'Give this piece a name.' };
  }
  if (details.name.length > 80) {
    return { ok: false, message: 'Keep the garment name under 80 characters.' };
  }
  if (!garmentCategories.includes(details.category)) {
    return { ok: false, message: 'Choose a valid garment category.' };
  }
  if ([details.color, details.size, details.season].some((value) => value.length > 40)) {
    return { ok: false, message: 'Keep garment details under 40 characters.' };
  }

  return { ok: true, details };
}
