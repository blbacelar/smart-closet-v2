import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import MarketScreen from '../market';

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('../../../src/store', () => ({
  useFitlyStore: (selector: (state: { garments: never[] }) => unknown) => selector({ garments: [] }),
}));

describe('MarketScreen', () => {
  it('keeps the filter rail horizontal without a draggable vertical indicator', async () => {
    const screen = await render(<MarketScreen />);
    let filterScroll = screen.getByText('25 km').parent;

    while (filterScroll && !filterScroll.props.horizontal) {
      filterScroll = filterScroll.parent;
    }

    expect(filterScroll).toBeTruthy();
    expect(filterScroll).toHaveProp('showsHorizontalScrollIndicator', false);
    expect(filterScroll).toHaveProp('showsVerticalScrollIndicator', false);
    expect(filterScroll).toHaveProp('alwaysBounceVertical', false);
    expect(filterScroll).toHaveProp('directionalLockEnabled', true);
    expect(filterScroll).toHaveProp('bounces', false);

    const railStyle = StyleSheet.flatten(filterScroll?.props.style);
    const contentStyle = StyleSheet.flatten(filterScroll?.props.contentContainerStyle);

    expect(railStyle.height).toBeGreaterThanOrEqual(44);
    expect(contentStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(contentStyle.alignItems).toBe('center');
  });
});
