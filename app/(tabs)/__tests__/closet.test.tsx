import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import ClosetScreen from '../closet';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('../../../src/providers/AuthProvider', () => ({
  useAuth: () => ({ identity: { id: 'user-1' } }),
}));

jest.mock('../../../src/features/garments/useGarments', () => ({
  useGarments: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useProcessGarment: () => ({
    isPending: false,
    variables: undefined,
    mutate: jest.fn(),
  }),
}));

describe('ClosetScreen', () => {
  it('gives the horizontal filter rail enough height to hide its scroll indicator', async () => {
    const screen = await render(<ClosetScreen />);
    let filterList = screen.getByText('All').parent;

    while (filterList && !filterList.props.horizontal) {
      filterList = filterList.parent;
    }

    expect(filterList).toBeTruthy();
    expect(filterList).toHaveProp('showsHorizontalScrollIndicator', false);

    const railStyle = StyleSheet.flatten(filterList?.props.style);
    const contentStyle = StyleSheet.flatten(filterList?.props.contentContainerStyle);

    expect(railStyle.height).toBeGreaterThanOrEqual(44);
    expect(contentStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(contentStyle.alignItems).toBe('center');
  });
});
