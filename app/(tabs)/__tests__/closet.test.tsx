import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { Garment } from '../../../src/features/garments/garmentRepository';
import ClosetScreen from '../closet';

const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockProcess = jest.fn();
let mockGarmentQuery: {
  data: Garment[];
  isLoading: boolean;
  isError: boolean;
  refetch: jest.Mock;
};

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('../../../src/providers/AuthProvider', () => ({
  useAuth: () => ({ identity: { id: 'user-1' } }),
}));

jest.mock('../../../src/features/garments/useGarments', () => ({
  useGarments: () => mockGarmentQuery,
  useProcessGarment: () => ({
    isPending: false,
    variables: undefined,
    mutate: mockProcess,
  }),
}));

function garment(overrides: Partial<Garment>): Garment {
  return {
    id: 'garment-1',
    originalPath: 'user-1/garment-1-original.jpg',
    cleanPath: null,
    name: 'Linen shirt',
    category: 'top',
    color: 'Cream',
    size: 'M',
    season: 'Summer',
    status: 'ready',
    processingAttempts: 1,
    processingError: null,
    processingStartedAt: null,
    processingCompletedAt: '2026-09-30T00:00:00.000Z',
    createdAt: '2026-09-30T00:00:00.000Z',
    imageUrl: 'https://example.com/garment-1.jpg',
    ...overrides,
  };
}

describe('ClosetScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRefetch.mockReset();
    mockProcess.mockReset();
    mockGarmentQuery = {
      data: [],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
  });

  it('keeps the filter rail horizontal without a draggable vertical indicator', async () => {
    const screen = await render(<ClosetScreen />);
    let filterList = screen.getByText('All').parent;

    while (filterList && !filterList.props.horizontal) {
      filterList = filterList.parent;
    }

    expect(filterList).toBeTruthy();
    expect(filterList).toHaveProp('showsHorizontalScrollIndicator', false);
    expect(filterList).toHaveProp('showsVerticalScrollIndicator', false);
    expect(filterList).toHaveProp('alwaysBounceVertical', false);
    expect(filterList).toHaveProp('directionalLockEnabled', true);
    expect(filterList).toHaveProp('bounces', false);

    const railStyle = StyleSheet.flatten(filterList?.props.style);
    const contentStyle = StyleSheet.flatten(filterList?.props.contentContainerStyle);

    expect(railStyle.height).toBeGreaterThanOrEqual(44);
    expect(contentStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(contentStyle.alignItems).toBe('center');
  });

  it('renders persisted garment cards and opens their detail', async () => {
    mockGarmentQuery.data = [
      garment({}),
      garment({ id: 'garment-2', name: 'Sunday dress', category: 'dress' }),
    ];
    const screen = await render(<ClosetScreen />);

    expect(screen.getByText('2 pieces')).toBeTruthy();
    expect(screen.getByText('Linen shirt')).toBeTruthy();
    expect(screen.getByText('Sunday dress')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Linen shirt' }));
    expect(mockPush).toHaveBeenCalledWith('/garment/garment-1');
  });

  it('filters garments by category and exposes the selected filter', async () => {
    mockGarmentQuery.data = [
      garment({}),
      garment({ id: 'garment-2', name: 'Sunday dress', category: 'dress' }),
    ];
    const screen = await render(<ClosetScreen />);

    const dresses = screen.getByRole('button', { name: 'Dresses' });
    await fireEvent.press(dresses);

    expect(screen.queryByText('Linen shirt')).toBeNull();
    expect(screen.getByText('Sunday dress')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dresses' })).toHaveProp(
      'accessibilityState',
      { selected: true },
    );
  });

  it('offers garment capture from the empty closet state', async () => {
    const screen = await render(<ClosetScreen />);

    expect(screen.getByText('Your closet is ready for its first piece.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a garment' }));

    expect(mockPush).toHaveBeenCalledWith('/add-garment');
  });

  it('lets the member retry when the closet cannot load', async () => {
    mockGarmentQuery.isError = true;
    const screen = await render(<ClosetScreen />);

    expect(screen.getByText('Could not load your closet.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
