import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MarketplaceRepository,
  supabaseMarketplaceRepository,
} from './marketplaceRepository';
import type { MarketplaceMode, ValidatedMarketplaceListing } from './marketplaceValidation';

export const marketplaceKeys = {
  all: ['marketplace'] as const,
  summary: (userId: string) => [...marketplaceKeys.all, 'summary', userId] as const,
  listings: (userId: string) => [...marketplaceKeys.all, 'listings', userId] as const,
  offers: (userId: string) => [...marketplaceKeys.all, 'offers', userId] as const,
  transactions: (userId: string) => [...marketplaceKeys.all, 'transactions', userId] as const,
  messages: (userId: string, offerId: string) => [...marketplaceKeys.all, 'messages', userId, offerId] as const,
};

function invalidateMarketplace(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
}

export function useMarketplaceSummary(
  userId: string | undefined,
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  return useQuery({
    queryKey: marketplaceKeys.summary(userId ?? 'signed-out'),
    queryFn: repository.getSummary,
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useMarketplaceListings(
  userId: string | undefined,
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  return useQuery({
    queryKey: marketplaceKeys.listings(userId ?? 'signed-out'),
    queryFn: repository.listListings,
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useMarketplaceOffers(
  userId: string | undefined,
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  return useQuery({
    queryKey: marketplaceKeys.offers(userId ?? 'signed-out'),
    queryFn: repository.listOffers,
    enabled: Boolean(userId),
    refetchInterval: 10_000,
  });
}

export function useMarketplaceTransactions(
  userId: string | undefined,
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  return useQuery({
    queryKey: marketplaceKeys.transactions(userId ?? 'signed-out'),
    queryFn: repository.listTransactions,
    enabled: Boolean(userId),
    refetchInterval: (query) => query.state.data?.some((item) => item.status === 'awaiting_handoff') ? 10_000 : false,
  });
}

export function useMarketplaceMessages(
  userId: string | undefined,
  offerId: string | undefined,
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  return useQuery({
    queryKey: marketplaceKeys.messages(userId ?? 'signed-out', offerId ?? 'missing-offer'),
    queryFn: () => repository.listMessages(offerId!),
    enabled: Boolean(userId && offerId),
    refetchInterval: 5_000,
  });
}

export function useActivateMarketplaceMembership(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: repository.activateMembership,
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function usePublishMarketplaceListing(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ValidatedMarketplaceListing & { garmentId: string }) => repository.publishListing(input),
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useWithdrawMarketplaceListing(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: repository.withdrawListing,
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useCreateMarketplaceOffer(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      listingId: string;
      mode: MarketplaceMode;
      swapListingId?: string | null;
      message?: string | null;
    }) => repository.createOffer(input),
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useRespondToMarketplaceOffer(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, accept }: { offerId: string; accept: boolean }) =>
      repository.respondToOffer(offerId, accept),
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useWithdrawMarketplaceOffer(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: repository.withdrawOffer,
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useConfirmMarketplaceHandoff(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: repository.confirmHandoff,
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useCancelMarketplaceTransaction(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: repository.cancelTransaction,
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useSendMarketplaceMessage(
  repository: MarketplaceRepository = supabaseMarketplaceRepository,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, body }: { offerId: string; body: string }) =>
      repository.sendMessage(offerId, body),
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}
