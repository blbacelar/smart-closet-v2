import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { OnboardingIntro } from '../OnboardingIntro';

describe('OnboardingIntro', () => {
  it('explains the private closet journey and starts setup', async () => {
    const onComplete = jest.fn();
    const screen = await render(<OnboardingIntro onComplete={onComplete} />);

    expect(screen.getByText('Your closet, on you.')).toBeTruthy();
    expect(screen.getByText('1. Add a private body photo')).toBeTruthy();
    expect(screen.getByText('2. Build your digital closet')).toBeTruthy();
    expect(screen.getByText('3. Try pieces on with AI')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Start my closet' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('disables duplicate completion while saving and reports a safe error', async () => {
    const onComplete = jest.fn();
    const screen = await render(
      <OnboardingIntro
        error="Could not save your setup. Try again."
        isCompleting
        onComplete={onComplete}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save your setup. Try again.');
    await fireEvent.press(screen.getByRole('button', { name: 'Saving setup' }));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
