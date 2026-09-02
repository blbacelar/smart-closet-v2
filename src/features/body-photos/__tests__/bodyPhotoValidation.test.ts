import { validateBodyPhotoAsset } from '../bodyPhotoValidation';

const validAsset = {
  uri: 'file:///body.jpg',
  base64: 'a'.repeat(1_000_000),
  width: 1200,
  height: 1800,
};

describe('validateBodyPhotoAsset', () => {
  it('accepts a clear portrait image and reports its decoded size', () => {
    expect(validateBodyPhotoAsset(validAsset)).toEqual({
      ok: true,
      asset: { ...validAsset, contentType: 'image/jpeg', byteLength: 750_000 },
    });
  });

  it('requires encoded image data', () => {
    expect(validateBodyPhotoAsset({ ...validAsset, base64: null })).toEqual({
      ok: false,
      message: 'Fitly could not read that photo. Choose a different image.',
    });
  });

  it('rejects images larger than the standard upload limit', () => {
    expect(validateBodyPhotoAsset({ ...validAsset, base64: 'a'.repeat(8_000_004) })).toEqual({
      ok: false,
      message: 'Choose a photo smaller than 6 MB.',
    });
  });

  it('rejects images that are too small for a useful try-on', () => {
    expect(validateBodyPhotoAsset({ ...validAsset, width: 500, height: 700 })).toEqual({
      ok: false,
      message: 'Choose a photo that is at least 600 × 800 pixels.',
    });
  });

  it('requires a portrait image', () => {
    expect(validateBodyPhotoAsset({ ...validAsset, width: 1800, height: 1200 })).toEqual({
      ok: false,
      message: 'Use a portrait photo that shows you from head to toe.',
    });
  });
});
