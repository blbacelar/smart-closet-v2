import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import MarketScreen from '../market';

const mockPush = jest.fn();

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('../../../src/providers/AuthProvider', () => ({
  useAuth: () => ({ identity: { id: '11111111-1111-4111-8111-111111111111' } }),
}));

const mockListings = [
  {
    id: 'listing-1', garmentId: 'garment-1', sellerId: 'seller-1', sellerName: 'Alex', status: 'active',
    acceptsCredits: true, acceptsSwap: true, isGiveaway: false, creditPrice: 75, pickupArea: 'Riverside',
    garmentName: 'Denim jacket', category: 'outerwear', color: 'Blue', size: 'M', imagePath: 'one.jpg', imageUrl: 'one.jpg', createdAt: 'now',
  },
  {
    id: 'listing-2', garmentId: 'garment-2', sellerId: 'seller-2', sellerName: 'Sam', status: 'active',
    acceptsCredits: false, acceptsSwap: false, isGiveaway: true, creditPrice: null, pickupArea: 'Northgate',
    garmentName: 'Cotton tee', category: 'top', color: 'White', size: 'S', imagePath: 'two.jpg', imageUrl: 'two.jpg', createdAt: 'now',
  },
];

jest.mock('../../../src/features/marketplace/useMarketplace', () => ({
  useMarketplaceListings: () => ({ data: mockListings, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() }),
  useMarketplaceSummary: () => ({
    data: { membershipStatus: 'active', availableCredits: 425, reservedCredits: 75 },
    isRefetching: false,
    refetch: jest.fn(),
  }),
}));

describe('MarketScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it('keeps the filter rail horizontal without a draggable vertical indicator', async () => {
    const screen = await render(<MarketScreen />);
    let filterScroll = screen.getByText('Local pickup').parent;

    while (filterScroll && !filterScroll.props.horizontal) filterScroll = filterScroll.parent;

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
    const chipStyle = StyleSheet.flatten(screen.getByText('Local pickup').parent?.props.style);
    expect(railStyle.height).toBeGreaterThanOrEqual(56);
    expect(railStyle.flexShrink).toBe(0);
    expect(contentStyle.height).toBe(railStyle.height);
    expect(contentStyle.alignItems).toBe('center');
    expect(railStyle.height - chipStyle.height).toBeGreaterThanOrEqual(20);
  });

  it('filters real listings and exposes selected filter state', async () => {
    const screen = await render(<MarketScreen />);
    const giveawayFilter = screen.getByRole('button', { name: 'Give away filter' });

    expect(giveawayFilter.props.accessibilityState).toEqual({ selected: false });
    await fireEvent.press(giveawayFilter);

    expect(screen.getByRole('button', { name: 'Give away filter' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('Cotton tee')).toBeTruthy();
    expect(screen.queryByText('Denim jacket')).toBeNull();
  });

  it('opens a persisted marketplace listing instead of a preview alert', async () => {
    const screen = await render(<MarketScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open Denim jacket listing' }));

    expect(mockPush).toHaveBeenCalledWith('/marketplace/listing-1');
  });

  it('exposes the available credit balance to assistive technology', async () => {
    const screen = await render(<MarketScreen />);

    expect(screen.getByRole('button', {
      name: '425 Fitly credits available; view marketplace membership',
    })).toBeTruthy();
  });
});
