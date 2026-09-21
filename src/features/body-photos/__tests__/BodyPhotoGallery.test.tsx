import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { BodyPhotoGallery } from '../BodyPhotoGallery';

const photo = {
  id: 'photo-1',
  storagePath: 'user-1/photo-1.jpg',
  status: 'approved' as const,
  rejectReason: null,
  validationAttempts: 1,
  validationError: null,
  createdAt: '2026-09-02T20:00:00Z',
  signedUrl: 'https://signed.example/photo-1',
};

describe('BodyPhotoGallery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('explains photo visibility and offers an accessible delete action', async () => {
    const screen = await render(
      <BodyPhotoGallery
        photos={[photo]}
        onAdd={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Only you can see these')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByLabelText('Private body photo 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete body photo 1' })).toBeTruthy();
  });

  it('shows safe rejection guidance without exposing provider details', async () => {
    const screen = await render(
      <BodyPhotoGallery
        photos={[{
          ...photo,
          status: 'rejected',
          rejectReason: 'not_full_body',
          validationError: 'Gemini internal provider detail',
        }]}
        onAdd={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Needs a new photo')).toBeTruthy();
    expect(screen.getByText('Make sure your full body is visible from head to toe.')).toBeTruthy();
    expect(screen.queryByText('Gemini internal provider detail')).toBeNull();
  });

  it('offers a retry for a temporarily paused check below the attempt limit', async () => {
    const onRetryValidation = jest.fn().mockResolvedValue(undefined);
    const pendingPhoto = {
      ...photo,
      status: 'pending' as const,
      validationAttempts: 2,
      validationError: 'private provider detail',
    };
    const screen = await render(
      <BodyPhotoGallery
        photos={[pendingPhoto]}
        onAdd={jest.fn()}
        onDelete={jest.fn()}
        onRetryValidation={onRetryValidation}
      />,
    );

    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.getByText('Photo check paused.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry photo check' }));
    await waitFor(() => expect(onRetryValidation).toHaveBeenCalledWith(pendingPhoto));
    expect(screen.queryByText('private provider detail')).toBeNull();
  });

  it('asks for a replacement after all validation attempts are used', async () => {
    const onRetryValidation = jest.fn();
    const screen = await render(
      <BodyPhotoGallery
        photos={[{
          ...photo,
          status: 'pending',
          validationAttempts: 3,
          validationError: 'private provider detail',
        }]}
        onAdd={jest.fn()}
        onDelete={jest.fn()}
        onRetryValidation={onRetryValidation}
      />,
    );

    expect(screen.getByText('Delete this photo and add a clearer one.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry photo check' })).toBeNull();
  });

  it('opens a privacy sheet explaining processing and deletion', async () => {
    const screen = await render(
      <BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Only you can see these' }));
    expect(screen.getByText('Your body photos are private.')).toBeTruthy();
    expect(screen.getByText(/sent privately to Google Gemini/)).toBeTruthy();
    expect(screen.getByText(/delete a photo and its generated try-on results/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close privacy information' }));
    expect(screen.queryByText('Your body photos are private.')).toBeNull();
  });

  it('removes a photo optimistically and restores it when Undo is pressed', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={onDelete} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Delete body photo 1' }));
    expect(screen.queryByLabelText('Private body photo 1')).toBeNull();
    expect(screen.getByText('Body photo removed')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo body photo deletion' }));
    expect(screen.getByLabelText('Private body photo 1')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('commits deletion after the undo window', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={onDelete} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Delete body photo 1' }));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(photo));
    expect(screen.queryByLabelText('Private body photo 1')).toBeNull();
  });

  it('restores the photo and shows a safe retry message when deletion fails', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('storage internals'));
    const screen = await render(
      <BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={onDelete} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Delete body photo 1' }));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete that photo. Try again.');
    expect(screen.getByLabelText('Private body photo 1')).toBeTruthy();
  });
});
