import { createBodyPhotoPicker } from '../bodyPhotoPicker';

function createImagePicker() {
  return {
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
  };
}

const selectedResult = {
  canceled: false as const,
  assets: [{ uri: 'file:///body.jpg', base64: 'encoded', width: 1200, height: 1800 }],
};

describe('bodyPhotoPicker', () => {
  it('requests camera permission and captures JPEG data', async () => {
    const imagePicker = createImagePicker();
    imagePicker.launchCameraAsync.mockResolvedValue(selectedResult);
    const picker = createBodyPhotoPicker(imagePicker);

    await expect(picker.pick('camera')).resolves.toEqual({
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
    const picker = createBodyPhotoPicker(imagePicker);

    await expect(picker.pick('camera')).resolves.toEqual({ status: 'permission-denied' });
    expect(imagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('opens the image library without requesting camera permission', async () => {
    const imagePicker = createImagePicker();
    imagePicker.launchImageLibraryAsync.mockResolvedValue(selectedResult);
    const picker = createBodyPhotoPicker(imagePicker);

    await expect(picker.pick('library')).resolves.toMatchObject({ status: 'selected' });
    expect(imagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  });

  it('reports picker cancellation', async () => {
    const imagePicker = createImagePicker();
    imagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    const picker = createBodyPhotoPicker(imagePicker);

    await expect(picker.pick('library')).resolves.toEqual({ status: 'cancelled' });
  });
});
