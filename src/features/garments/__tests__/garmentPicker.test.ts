import { createGarmentPicker } from '../garmentPicker';

function createImagePicker() {
  return {
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
  };
}

const selectedResult = {
  canceled: false as const,
  assets: [{ uri: 'file:///shirt.jpg', base64: 'encoded', width: 1200, height: 1600 }],
};

describe('garmentPicker', () => {
  it('requests camera permission and captures uploadable JPEG data', async () => {
    const imagePicker = createImagePicker();
    imagePicker.launchCameraAsync.mockResolvedValue(selectedResult);

    await expect(createGarmentPicker(imagePicker).pick('camera')).resolves.toEqual({
      status: 'selected',
      asset: selectedResult.assets[0],
    });
    expect(imagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(imagePicker.launchCameraAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.8,
    });
  });

  it('does not open the camera after permission is denied', async () => {
    const imagePicker = createImagePicker();
    imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(createGarmentPicker(imagePicker).pick('camera')).resolves.toEqual({
      status: 'permission-denied',
    });
    expect(imagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('opens the library without requesting camera permission', async () => {
    const imagePicker = createImagePicker();
    imagePicker.launchImageLibraryAsync.mockResolvedValue(selectedResult);

    await expect(createGarmentPicker(imagePicker).pick('library')).resolves.toMatchObject({
      status: 'selected',
    });
    expect(imagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it('preserves cancellation', async () => {
    const imagePicker = createImagePicker();
    imagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(createGarmentPicker(imagePicker).pick('library')).resolves.toEqual({
      status: 'cancelled',
    });
  });
});
