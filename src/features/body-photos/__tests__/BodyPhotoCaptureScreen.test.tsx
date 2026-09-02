import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { BodyPhotoCaptureScreen } from '../BodyPhotoCaptureScreen';
import { BodyPhotoPicker } from '../bodyPhotoPicker';

const validAsset = {
  uri: 'file:///body.jpg',
  base64: 'a'.repeat(1_000_000),
  width: 1200,
  height: 1800,
};

function createPicker(): jest.Mocked<BodyPhotoPicker> {
  return {
    pick: jest.fn().mockResolvedValue({ status: 'selected', asset: validAsset }),
  };
}

describe('BodyPhotoCaptureScreen', () => {
  it('captures and uploads a valid private body photo', async () => {
    const picker = createPicker();
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const screen = await render(
      <BodyPhotoCaptureScreen picker={picker} onUpload={onUpload} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(screen.getByLabelText('Selected body photo')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save private photo' }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining(validAsset)));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the library and preserves cancellation as a no-op', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'cancelled' });
    const screen = await render(
      <BodyPhotoCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));

    expect(picker.pick).toHaveBeenCalledWith('library');
    expect(screen.queryByLabelText('Selected body photo')).toBeNull();
  });

  it('explains camera permission denial', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({ status: 'permission-denied' });
    const screen = await render(
      <BodyPhotoCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(screen.getByText('Camera permission is needed to take a body photo.')).toBeTruthy();
  });

  it('rejects an unsuitable photo before upload', async () => {
    const picker = createPicker();
    picker.pick.mockResolvedValue({
      status: 'selected',
      asset: { ...validAsset, width: 1800, height: 1200 },
    });
    const onUpload = jest.fn();
    const screen = await render(
      <BodyPhotoCaptureScreen picker={picker} onUpload={onUpload} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(screen.getByText('Use a portrait photo that shows you from head to toe.')).toBeTruthy();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('keeps the preview and shows upload errors', async () => {
    const picker = createPicker();
    const onUpload = jest.fn().mockRejectedValue(new Error('Photo limit reached'));
    const screen = await render(
      <BodyPhotoCaptureScreen picker={picker} onUpload={onUpload} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save private photo' }));

    expect(await screen.findByText('Photo limit reached')).toBeTruthy();
    expect(screen.getByLabelText('Selected body photo')).toBeTruthy();
  });

  it('returns to capture guidance when the selected photo is changed', async () => {
    const screen = await render(
      <BodyPhotoCaptureScreen picker={createPicker()} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Change' }));

    expect(screen.queryByLabelText('Selected body photo')).toBeNull();
    expect(screen.getByText('Show your full look.')).toBeTruthy();
  });

  it('uses a safe fallback for unexpected picker errors', async () => {
    const picker = createPicker();
    picker.pick.mockRejectedValue('unexpected');
    const screen = await render(
      <BodyPhotoCaptureScreen picker={picker} onUpload={jest.fn()} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(screen.getByText('Could not save that photo. Try again.')).toBeTruthy();
  });
});
