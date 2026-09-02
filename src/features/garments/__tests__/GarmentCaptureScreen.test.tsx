import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
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
  it('keeps the form and save action usable while the keyboard is open', async () => {
    const screen = await render(
      <GarmentCaptureScreen picker={createPicker()} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId('garment-keyboard-avoider')).toBeTruthy();
    expect(screen.getByTestId('garment-form-scroll')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled',
    );
    expect(screen.getByTestId('garment-form-scroll')).toHaveProp(
      'keyboardDismissMode',
      Platform.OS === 'ios' ? 'interactive' : 'on-drag',
    );
  });

  it('captures details and uploads a valid garment', async () => {
    const picker = createPicker();
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const screen = await render(
      <GarmentCaptureScreen picker={picker} onUpload={onUpload} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    await screen.findByLabelText('Selected garment photo');
    await fireEvent.changeText(screen.getByLabelText('Garment name'), '  Linen shirt  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Bottoms category' }));
    await fireEvent.changeText(screen.getByLabelText('Garment size'), ' M ');
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
    const screen = await render(
      <GarmentCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));

    expect(await screen.findByText('Camera permission is needed to photograph a garment.')).toBeTruthy();
  });

  it('rejects an unsuitable image before upload', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'selected', asset: { ...validAsset, width: 500 } });
    const screen = await render(
      <GarmentCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Choose garment photo' }));

    expect(await screen.findByText('Choose a photo that is at least 600 × 600 pixels.')).toBeTruthy();
    expect(screen.queryByLabelText('Selected garment photo')).toBeNull();
  });

  it('requires a name before upload', async () => {
    const onUpload = jest.fn();
    const screen = await render(
      <GarmentCaptureScreen picker={createPicker()} onUpload={onUpload} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    await screen.findByLabelText('Selected garment photo');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));

    expect(await screen.findByText('Give this piece a name.')).toBeTruthy();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('keeps the form available after an upload error', async () => {
    const onUpload = jest.fn().mockRejectedValue(new Error('Garment limit reached'));
    const screen = await render(
      <GarmentCaptureScreen picker={createPicker()} onUpload={onUpload} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    await screen.findByLabelText('Selected garment photo');
    await fireEvent.changeText(screen.getByLabelText('Garment name'), 'Shirt');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));

    expect(await screen.findByText('Garment limit reached')).toBeTruthy();
    expect(screen.getByLabelText('Selected garment photo')).toBeTruthy();
  });
});
