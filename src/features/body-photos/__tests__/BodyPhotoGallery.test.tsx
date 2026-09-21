import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { BodyPhotoGallery } from '../BodyPhotoGallery';

const photo = {
  id: 'photo-1',
  storagePath: 'user-1/photo-1.jpg',
  status: 'approved' as const,
  rejectReason: null,
  createdAt: '2026-09-02T20:00:00Z',
  signedUrl: 'https://signed.example/photo-1',
};

describe('BodyPhotoGallery', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('explains photo visibility and offers an accessible delete action', () => {
    render(
      <BodyPhotoGallery
        photos={[photo]}
        onAdd={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Only you can see these')).toBeTruthy();
    expect(screen.getByLabelText('Private body photo 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete body photo 1' })).toBeTruthy();
  });

  it('removes a photo optimistically and restores it when Undo is pressed', () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={onDelete} />);

    fireEvent.press(screen.getByRole('button', { name: 'Delete body photo 1' }));
    expect(screen.queryByLabelText('Private body photo 1')).toBeNull();
    expect(screen.getByText('Body photo removed')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo body photo deletion' }));
    expect(screen.getByLabelText('Private body photo 1')).toBeTruthy();

    act(() => jest.advanceTimersByTime(5_000));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('commits deletion after the undo window', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    render(<BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={onDelete} />);

    fireEvent.press(screen.getByRole('button', { name: 'Delete body photo 1' }));
    await act(async () => jest.advanceTimersByTime(5_000));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(photo));
    expect(screen.queryByLabelText('Private body photo 1')).toBeNull();
  });

  it('restores the photo and shows a safe retry message when deletion fails', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('storage internals'));
    render(<BodyPhotoGallery photos={[photo]} onAdd={jest.fn()} onDelete={onDelete} />);

    fireEvent.press(screen.getByRole('button', { name: 'Delete body photo 1' }));
    await act(async () => jest.advanceTimersByTime(5_000));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete that photo. Try again.');
    expect(screen.getByLabelText('Private body photo 1')).toBeTruthy();
  });
});
