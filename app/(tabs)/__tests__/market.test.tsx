import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import MarketScreen from '../market';

jest.mock('expo-image', () => ({
  Image: () => null,
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
    expect(filterScroll).toHaveProp('automaticallyAdjustContentInsets', false);
    expect(filterScroll).toHaveProp('contentInsetAdjustmentBehavior', 'never');
    expect(filterScroll).toHaveProp('automaticallyAdjustsScrollIndicatorInsets', false);

    const railStyle = StyleSheet.flatten(filterScroll?.props.style);
    const contentStyle = StyleSheet.flatten(filterScroll?.props.contentContainerStyle);

    const chipStyle = StyleSheet.flatten(screen.getByText('25 km').parent?.props.style);

    expect(railStyle.height).toBeGreaterThanOrEqual(56);
    expect(railStyle.flexShrink).toBe(0);
    expect(contentStyle.height).toBe(railStyle.height);
    expect(contentStyle.alignItems).toBe('center');
    expect(railStyle.height - chipStyle.height).toBeGreaterThanOrEqual(20);
  });

  it('filters the preview feed and exposes selected filter state', async () => {
    const screen = await render(<MarketScreen />);
    const donationFilter = screen.getByRole('button', { name: 'Donation filter' });

    expect(donationFilter).toHaveAccessibilityState({ selected: false });
    await fireEvent.press(donationFilter);

    expect(donationFilter).toHaveAccessibilityState({ selected: true });
    expect(screen.getAllByText('Donation')).toHaveLength(2);
    expect(screen.queryByText('$24')).toBeNull();
  });

  it('explains that marketplace try-on is not active instead of using a dead button', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = await render(<MarketScreen />);

    await fireEvent.press(screen.getAllByRole('button', { name: 'See this listing on you' })[0]);

    expect(alert).toHaveBeenCalledWith(
      'Marketplace preview',
      'Marketplace fittings will unlock when the regional marketplace launches.',
    );
  });
});
