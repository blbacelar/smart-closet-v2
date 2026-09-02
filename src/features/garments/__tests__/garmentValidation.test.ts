import { validateGarmentAsset, validateGarmentDetails } from '../garmentValidation';

describe('garmentValidation', () => {
  it('accepts a readable garment photo and reports its decoded size', () => {
    expect(
      validateGarmentAsset({
        uri: 'file:///shirt.jpg',
        base64: 'YWJjZA==',
        width: 1200,
        height: 1600,
      }),
    ).toEqual({
      ok: true,
      asset: {
        uri: 'file:///shirt.jpg',
        base64: 'YWJjZA==',
        width: 1200,
        height: 1600,
        contentType: 'image/jpeg',
        byteLength: 4,
      },
    });
  });

  it.each([
    [{ uri: 'file:///shirt.jpg', base64: null, width: 1200, height: 1600 }, 'Fitly could not read that photo. Choose a different image.'],
    [{ uri: 'file:///shirt.jpg', base64: 'a'.repeat(8_000_004), width: 1200, height: 1600 }, 'Choose a photo smaller than 6 MB.'],
    [{ uri: 'file:///shirt.jpg', base64: 'YWJjZA==', width: 599, height: 900 }, 'Choose a photo that is at least 600 × 600 pixels.'],
  ])('rejects an unsuitable garment photo', (asset, message) => {
    expect(validateGarmentAsset(asset)).toEqual({ ok: false, message });
  });

  it('normalizes garment details before upload', () => {
    expect(
      validateGarmentDetails({
        name: '  Vintage denim jacket  ',
        category: 'outerwear',
        color: '  Blue ',
        size: ' M ',
        season: ' All year ',
      }),
    ).toEqual({
      ok: true,
      details: {
        name: 'Vintage denim jacket',
        category: 'outerwear',
        color: 'Blue',
        size: 'M',
        season: 'All year',
      },
    });
  });

  it('requires a name and a supported category', () => {
    expect(
      validateGarmentDetails({ name: '  ', category: 'top', color: '', size: '', season: '' }),
    ).toEqual({ ok: false, message: 'Give this piece a name.' });
    expect(
      validateGarmentDetails({
        name: 'Shirt',
        category: 'accessory' as never,
        color: '',
        size: '',
        season: '',
      }),
    ).toEqual({ ok: false, message: 'Choose a valid garment category.' });
  });
});
