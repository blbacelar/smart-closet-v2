import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { GarmentCaptureScreen } from '../GarmentCaptureScreen';
import { GarmentPicker } from '../garmentPicker';

const validAsset = {
  uri: 'file:///shirt.jpg',
  base64: 'YWJjZA==',
  width: 1200,
  height: 1600,
};

function createPicker(): jest.Mocked<GarmentPicker> {
  return { pick: jest.fn().mockResolvedValue({ status: 'selected', asset: validAsset }) };
}

describe('GarmentCaptureScreen', () => {
  it('captures details and uploads a valid garment', async () => {
    const picker = createPicker();
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const screen = render(
      <GarmentCaptureScreen picker={picker} onUpload={onUpload} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    fireEvent.changeText(screen.getByLabelText('Garment name'), '  Linen shirt  ');
    fireEvent.press(screen.getByRole('button', { name: 'Bottoms category' }));
    fireEvent.changeText(screen.getByLabelText('Garment size'), ' M ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));

    await waitFor(() =>
      expect(onUpload).toHaveBeenCalledWith({
        asset: expect.objectContaining({ ...validAsset, contentType: 'image/jpeg' }),
        details: {
          name: 'Linen shirt',
          category: 'bottom',
          color: 'Cream',
          size: 'M',
          season: 'All year',
        },
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explains camera permission denial', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'permission-denied' });
    const screen = render(
      <GarmentCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));

    expect(screen.getByText('Camera permission is needed to photograph a garment.')).toBeTruthy();
  });

  it('rejects an unsuitable image before upload', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'selected', asset: { ...validAsset, width: 500 } });
    const screen = render(
      <GarmentCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Choose garment photo' }));

    expect(screen.getByText('Choose a photo that is at least 600 × 600 pixels.')).toBeTruthy();
    expect(screen.queryByLabelText('Selected garment photo')).toBeNull();
  });

  it('requires a name before upload', async () => {
    const onUpload = jest.fn();
    const screen = render(
      <GarmentCaptureScreen picker={createPicker()} onUpload={onUpload} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));

    expect(screen.getByText('Give this piece a name.')).toBeTruthy();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('keeps the form available after an upload error', async () => {
    const onUpload = jest.fn().mockRejectedValue(new Error('Garment limit reached'));
    const screen = render(
      <GarmentCaptureScreen picker={createPicker()} onUpload={onUpload} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    fireEvent.changeText(screen.getByLabelText('Garment name'), 'Shirt');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));

    expect(await screen.findByText('Garment limit reached')).toBeTruthy();
    expect(screen.getByLabelText('Selected garment photo')).toBeTruthy();
  });
});
