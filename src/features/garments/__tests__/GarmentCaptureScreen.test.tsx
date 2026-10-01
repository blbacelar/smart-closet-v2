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
const secondAsset = {
  uri: 'file:///pants.jpg',
  base64: 'ZWZnaA==',
  width: 1400,
  height: 1800,
};

function createPicker(): jest.Mocked<GarmentPicker> {
  return { pick: jest.fn().mockResolvedValue({ status: 'selected', assets: [validAsset] }) };
}

describe('GarmentCaptureScreen', () => {
  it('defaults new pieces to private automatic category detection', async () => {
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <GarmentCaptureScreen picker={createPicker()} onUpload={onUpload} onClose={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Auto-detect category' })).toBeTruthy();
    expect(screen.getByText('Fitly will suggest a category after processing. You can edit it anytime.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Take garment photo' }));
    await fireEvent.changeText(screen.getByLabelText('Garment name'), 'Linen shirt');
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.objectContaining({ category: null }),
    })));
  });

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
    picker.pick.mockResolvedValue({ status: 'selected', assets: [{ ...validAsset, width: 500 }] });
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

  it('edits and uploads each selected library photo as its own garment', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'selected', assets: [validAsset, secondAsset] });
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const screen = await render(
      <GarmentCaptureScreen picker={picker} onUpload={onUpload} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Choose garment photos' }));
    expect(await screen.findByText('2 pieces selected')).toBeTruthy();
    expect(screen.getByText('Piece 1 of 2')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Garment name'), 'Linen shirt');
    await fireEvent.press(screen.getByRole('button', { name: 'Bottoms category' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit piece 2' }));
    expect(screen.getByText('Piece 2 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Garment name')).toHaveProp('value', '');
    await fireEvent.changeText(screen.getByLabelText('Garment name'), 'Wide-leg pants');

    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 pieces to my closet' }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
    expect(onUpload).toHaveBeenNthCalledWith(1, {
      asset: expect.objectContaining({ ...validAsset, contentType: 'image/jpeg' }),
      details: expect.objectContaining({ name: 'Linen shirt', category: 'bottom' }),
    });
    expect(onUpload).toHaveBeenNthCalledWith(2, {
      asset: expect.objectContaining({ ...secondAsset, contentType: 'image/jpeg' }),
      details: expect.objectContaining({ name: 'Wide-leg pants', category: null }),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps only unsaved pieces after a partial batch failure', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'selected', assets: [validAsset, secondAsset] });
    const onUpload = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(undefined);
    const onClose = jest.fn();
    const screen = await render(
      <GarmentCaptureScreen picker={picker} onUpload={onUpload} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Choose garment photos' }));
    await fireEvent.changeText(screen.getByLabelText('Garment name'), 'Shirt');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit piece 2' }));
    await fireEvent.changeText(screen.getByLabelText('Garment name'), 'Pants');
    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 pieces to my closet' }));

    expect(await screen.findByText('Saved 1 of 2. Network unavailable')).toBeTruthy();
    expect(screen.getByText('1 piece selected')).toBeTruthy();
    expect(screen.getByLabelText('Garment name')).toHaveProp('value', 'Pants');
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Add to my closet' }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(3));
    expect(onUpload.mock.calls[2][0].details.name).toBe('Pants');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps valid photos and identifies rejected photos in a mixed batch', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({
      status: 'selected',
      assets: [validAsset, { ...secondAsset, width: 500 }],
    });
    const screen = await render(
      <GarmentCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Choose garment photos' }));

    expect(await screen.findByText(
      'Photo 2 was skipped: Choose a photo that is at least 600 × 600 pixels.',
    )).toBeTruthy();
    expect(screen.getByText('1 piece selected')).toBeTruthy();
  });
});
