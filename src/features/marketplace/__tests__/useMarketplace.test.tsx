import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React, { PropsWithChildren } from 'react';
import type { MarketplaceRepository } from '../marketplaceRepository';
import {
  marketplaceKeys,
  useActivateMarketplaceMembership,
  useCancelMarketplaceTransaction,
  useConfirmMarketplaceHandoff,
  useCreateMarketplaceOffer,
  useMarketplaceListings,
  useMarketplaceMessages,
  useMarketplaceOffers,
  useMarketplaceSummary,
  useMarketplaceTransactions,
  usePublishMarketplaceListing,
  useRespondToMarketplaceOffer,
  useSendMarketplaceMessage,
  useWithdrawMarketplaceListing,
  useWithdrawMarketplaceOffer,
} from '../useMarketplace';

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const repository: jest.Mocked<MarketplaceRepository> = {
    getSummary: jest.fn().mockResolvedValue({ membershipStatus: 'active' }),
    activateMembership: jest.fn().mockResolvedValue({ creditsGranted: 500 }),
    listListings: jest.fn().mockResolvedValue([]),
    publishListing: jest.fn().mockResolvedValue('listing-1'),
    withdrawListing: jest.fn().mockResolvedValue(undefined),
    createOffer: jest.fn().mockResolvedValue('offer-1'),
    listOffers: jest.fn().mockResolvedValue([]),
    respondToOffer: jest.fn().mockResolvedValue('transaction-1'),
    withdrawOffer: jest.fn().mockResolvedValue(undefined),
    listTransactions: jest.fn().mockResolvedValue([]),
    confirmHandoff: jest.fn().mockResolvedValue('completed'),
    cancelTransaction: jest.fn().mockResolvedValue(undefined),
    listMessages: jest.fn().mockResolvedValue([]),
    sendMessage: jest.fn().mockResolvedValue('message-1'),
  } as never;
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, repository, wrapper };
}

describe('marketplace query hooks', () => {
  it('keeps every marketplace query disabled while signed out', async () => {
    const { client, repository, wrapper } = setup();
    const hooks = [
      await renderHook(() => useMarketplaceSummary(undefined, repository), { wrapper }),
      await renderHook(() => useMarketplaceListings(undefined, repository), { wrapper }),
      await renderHook(() => useMarketplaceOffers(undefined, repository), { wrapper }),
      await renderHook(() => useMarketplaceTransactions(undefined, repository), { wrapper }),
      await renderHook(() => useMarketplaceMessages(undefined, undefined, repository), { wrapper }),
    ];

    expect(repository.getSummary).not.toHaveBeenCalled();
    expect(repository.listListings).not.toHaveBeenCalled();
    expect(repository.listOffers).not.toHaveBeenCalled();
    expect(repository.listTransactions).not.toHaveBeenCalled();
    expect(repository.listMessages).not.toHaveBeenCalled();

    for (const { unmount } of hooks) await unmount();
    client.clear();
  });

  it('loads summary, listings, offers, transactions, and offer messages', async () => {
    const { client, repository, wrapper } = setup();
    const hooks = [
      await renderHook(() => useMarketplaceSummary('user-1', repository), { wrapper }),
      await renderHook(() => useMarketplaceListings('user-1', repository), { wrapper }),
      await renderHook(() => useMarketplaceOffers('user-1', repository), { wrapper }),
      await renderHook(() => useMarketplaceTransactions('user-1', repository), { wrapper }),
      await renderHook(() => useMarketplaceMessages('user-1', 'offer-1', repository), { wrapper }),
    ];

    await waitFor(() => {
      expect(repository.getSummary).toHaveBeenCalledTimes(1);
      expect(repository.listListings).toHaveBeenCalledTimes(1);
      expect(repository.listOffers).toHaveBeenCalledTimes(1);
      expect(repository.listTransactions).toHaveBeenCalledTimes(1);
      expect(repository.listMessages).toHaveBeenCalledWith('offer-1');
    });

    for (const { unmount } of hooks) await unmount();
    client.clear();
  });
});

describe('marketplace mutation hooks', () => {
  it('delegates every marketplace action and invalidates marketplace data', async () => {
    const { client, repository, wrapper } = setup();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const activate = await renderHook(() => useActivateMarketplaceMembership(repository), { wrapper });
    const publish = await renderHook(() => usePublishMarketplaceListing(repository), { wrapper });
    const withdrawListing = await renderHook(() => useWithdrawMarketplaceListing(repository), { wrapper });
    const createOffer = await renderHook(() => useCreateMarketplaceOffer(repository), { wrapper });
    const respond = await renderHook(() => useRespondToMarketplaceOffer(repository), { wrapper });
    const withdrawOffer = await renderHook(() => useWithdrawMarketplaceOffer(repository), { wrapper });
    const confirm = await renderHook(() => useConfirmMarketplaceHandoff(repository), { wrapper });
    const cancel = await renderHook(() => useCancelMarketplaceTransaction(repository), { wrapper });
    const send = await renderHook(() => useSendMarketplaceMessage(repository), { wrapper });

    const listing = {
      garmentId: 'garment-1',
      acceptsCredits: true,
      acceptsSwap: false,
      isGiveaway: false,
      creditPrice: 80,
      pickupArea: 'Northgate',
    };
    const offer = {
      listingId: 'listing-1',
      mode: 'swap' as const,
      swapListingId: 'listing-2',
      message: 'Swap?',
    };

    await act(async () => {
      await activate.result.current.mutateAsync();
      await publish.result.current.mutateAsync(listing);
      await withdrawListing.result.current.mutateAsync('listing-1');
      await createOffer.result.current.mutateAsync(offer);
      await respond.result.current.mutateAsync({ offerId: 'offer-1', accept: true });
      await withdrawOffer.result.current.mutateAsync('offer-2');
      await confirm.result.current.mutateAsync('transaction-1');
      await cancel.result.current.mutateAsync('transaction-2');
      await send.result.current.mutateAsync({ offerId: 'offer-1', body: 'Meet tomorrow?' });
    });

    expect(repository.activateMembership).toHaveBeenCalledTimes(1);
    expect(repository.publishListing).toHaveBeenCalledWith(listing);
    expect(repository.withdrawListing.mock.calls[0][0]).toBe('listing-1');
    expect(repository.createOffer).toHaveBeenCalledWith(offer);
    expect(repository.respondToOffer).toHaveBeenCalledWith('offer-1', true);
    expect(repository.withdrawOffer.mock.calls[0][0]).toBe('offer-2');
    expect(repository.confirmHandoff.mock.calls[0][0]).toBe('transaction-1');
    expect(repository.cancelTransaction.mock.calls[0][0]).toBe('transaction-2');
    expect(repository.sendMessage).toHaveBeenCalledWith('offer-1', 'Meet tomorrow?');
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(9));
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: marketplaceKeys.all });

    for (const { unmount } of [activate, publish, withdrawListing, createOffer, respond, withdrawOffer, confirm, cancel, send]) {
      await unmount();
    }
    client.clear();
  });
});
