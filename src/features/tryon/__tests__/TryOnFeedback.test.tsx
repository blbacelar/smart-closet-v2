import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { TryOnFeedback } from '../TryOnFeedback';

describe('TryOnFeedback', () => {
  it('announces the saved choice and lets the member change it', async () => {
    const onChange = jest.fn();
    const view = await render(<TryOnFeedback value={1} onChange={onChange} pending={false} />);

    expect(view.getByRole('button', { name: 'Good fit', selected: true })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Poor fit', selected: false })).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Poor fit' }));
    expect(onChange).toHaveBeenCalledWith(-1);
  });

  it('prevents duplicate changes while feedback is saving', async () => {
    const onChange = jest.fn();
    const view = await render(<TryOnFeedback value={null} onChange={onChange} pending />);

    await fireEvent.press(view.getByRole('button', { name: 'Good fit', disabled: true }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
