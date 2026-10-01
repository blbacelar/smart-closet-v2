import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { getRevealTransition, TryOnReveal } from '../TryOnReveal';

describe('TryOnReveal', () => {
  it('uses the signature fade-and-scale transition', () => {
    expect(getRevealTransition(false)).toEqual({
      duration: 400,
      initialOpacity: 0,
      initialScale: 1.035,
    });
  });

  it('shows the result immediately when reduced motion is enabled', () => {
    expect(getRevealTransition(true)).toEqual({
      duration: 0,
      initialOpacity: 1,
      initialScale: 1,
    });
  });

  it('exposes the revealed fitting as one accessible image group', async () => {
    const screen = await render(
      <TryOnReveal reduceMotion>
        <Text>Result image</Text>
      </TryOnReveal>,
    );

    expect(screen.getByLabelText('Your Fitly fitting is ready')).toBeTruthy();
    expect(screen.getByText('Result image')).toBeTruthy();
  });
});
