import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import MarketplaceChatRoute from '../[offerId]';

const mockSend = jest.fn().mockResolvedValue('message-id');

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ offerId: '44444444-4444-4444-8444-444444444444' }),
}));
jest.mock('../../../src/providers/AuthProvider', () => ({
  useAuth: () => ({ identity: { id: '11111111-1111-4111-8111-111111111111' } }),
}));
jest.mock('../../../src/features/marketplace/useMarketplace', () => ({
  useMarketplaceOffers: () => ({
    data: [{
      id: '44444444-4444-4444-8444-444444444444',
      listingName: 'Denim jacket',
      status: 'pending',
    }],
    isLoading: false,
    refetch: jest.fn(),
  }),
  useMarketplaceMessages: () => ({
    data: [{
      id: 'message-1',
      senderId: '22222222-2222-4222-8222-222222222222',
      body: 'Meet at the community centre?',
      createdAt: '2026-10-13T10:05:00Z',
    }],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useSendMarketplaceMessage: () => ({ mutateAsync: mockSend, isPending: false }),
}));

describe('MarketplaceChatRoute', () => {
  beforeEach(() => mockSend.mockClear());

  it('shows the private conversation and sends a trimmed reply', async () => {
    const screen = await render(<MarketplaceChatRoute />);

    expect(screen.getByText('Denim jacket')).toBeTruthy();
    expect(screen.getByText('Meet at the community centre?')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Marketplace message'), '  Sounds good.  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send marketplace message' }));

    await waitFor(() => expect(mockSend).toHaveBeenCalledWith({
      offerId: '44444444-4444-4444-8444-444444444444',
      body: 'Sounds good.',
    }));
    expect(screen.getByLabelText('Marketplace message')).toHaveProp('value', '');
  });
});
