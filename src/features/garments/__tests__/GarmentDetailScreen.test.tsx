import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import { GarmentDetailScreen } from '../GarmentDetailScreen';
import type { Garment } from '../garmentRepository';

const garment: Garment = {
  id: 'garment-1',
  originalPath: 'user-1/original.jpg',
  cleanPath: 'user-1/clean.png',
  name: 'Vintage jacket',
  category: 'outerwear',
  color: 'Blue',
  size: 'M',
  season: 'All year',
  status: 'ready',
  processingAttempts: 1,
  processingError: null,
  processingStartedAt: '2026-09-02T20:00:01Z',
  processingCompletedAt: '2026-09-02T20:00:03Z',
  createdAt: '2026-09-02T20:00:00Z',
  imageUrl: 'https://signed.example/garment-1',
};

describe('GarmentDetailScreen', () => {
  it('shows the private garment details and opens the editing half-sheet', async () => {
    const screen = await render(
      <GarmentDetailScreen garment={garment} onBack={jest.fn()} onSave={jest.fn()} />,
    );

    expect(screen.getByLabelText('Vintage jacket garment photo')).toBeTruthy();
    expect(screen.getByText('Outerwear')).toBeTruthy();
    expect(screen.getByText('Blue')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByText('All year')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Edit garment details' }));
    expect(screen.getByText('Edit details')).toBeTruthy();
    expect(screen.getByTestId('garment-detail-keyboard-avoider')).toBeTruthy();
    expect(screen.getByTestId('garment-detail-form-scroll')).toHaveProp(
      'keyboardShouldPersistTaps',
      'handled',
    );
    expect(screen.getByTestId('garment-detail-form-scroll')).toHaveProp(
      'keyboardDismissMode',
      Platform.OS === 'ios' ? 'interactive' : 'on-drag',
    );
  });

  it('validates, trims, and saves every editable detail', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <GarmentDetailScreen garment={garment} onBack={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Edit garment details' }));
    await fireEvent.changeText(screen.getByLabelText('Garment name'), '  Rain jacket  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Tops category' }));
    await fireEvent.changeText(screen.getByLabelText('Garment color'), '  Green  ');
    await fireEvent.changeText(screen.getByLabelText('Garment size'), ' L ');
    await fireEvent.changeText(screen.getByLabelText('Garment season'), ' Fall ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save garment details' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'Rain jacket',
      category: 'top',
      color: 'Green',
      size: 'L',
      season: 'Fall',
    }));
    expect(screen.queryByText('Edit details')).toBeNull();
  });

  it('keeps invalid edits local and explains how to fix them', async () => {
    const onSave = jest.fn();
    const screen = await render(
      <GarmentDetailScreen garment={garment} onBack={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Edit garment details' }));
    await fireEvent.changeText(screen.getByLabelText('Garment name'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save garment details' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Give this piece a name.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the sheet open with safe feedback after a save failure', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('database policy internals'));
    const screen = await render(
      <GarmentDetailScreen garment={garment} onBack={jest.fn()} onSave={onSave} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Edit garment details' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save garment details' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save those details. Try again.',
    );
    expect(screen.getByText('Edit details')).toBeTruthy();
    expect(screen.queryByText('database policy internals')).toBeNull();
  });

  it('supports accessible back and close actions', async () => {
    const onBack = jest.fn();
    const screen = await render(
      <GarmentDetailScreen garment={garment} onBack={onBack} onSave={jest.fn()} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Back to closet' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit garment details' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close garment editor' }));
    expect(screen.queryByText('Edit details')).toBeNull();
  });
});
