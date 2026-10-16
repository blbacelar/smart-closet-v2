import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import type { MarketplaceMode, ValidatedMarketplaceListing } from './marketplaceValidation';

const membershipStatusSchema = z.enum(['none', 'active', 'expired', 'cancelled']);
const summaryRowSchema = z.object({
  annual_price_cents: z.number().int().positive(),
  currency_code: z.string().length(3),
  first_year_credit_grant: z.number().int().nonnegative(),
  renewal_credit_grant: z.number().int().nonnegative(),
  billing_mode: z.enum(['development', 'store']),
  membership_status: membershipStatusSchema,
  membership_starts_at: z.string().nullable(),
  membership_expires_at: z.string().nullable(),
  available_credits: z.number().int().nonnegative(),
  reserved_credits: z.number().int().nonnegative(),
});

const listingRowSchema = z.object({
  id: z.string().uuid(),
  garment_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  seller_name: z.string().min(1),
  status: z.enum(['active', 'reserved', 'completed', 'withdrawn']),
  accepts_credits: z.boolean(),
  accepts_swap: z.boolean(),
  is_giveaway: z.boolean(),
  credit_price: z.number().int().positive().nullable(),
  pickup_area: z.string().min(1),
  garment_name: z.string().min(1),
  category: z.string().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  image_path: z.string().min(1),
  created_at: z.string().min(1),
});

const offerRowSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid(),
  listing_name: z.string().min(1),
  image_path: z.string().min(1),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  mode: z.enum(['credits', 'swap', 'giveaway']),
  credit_amount: z.number().int().positive().nullable(),
  swap_listing_id: z.string().uuid().nullable(),
  swap_listing_name: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn', 'superseded']),
  created_at: z.string().min(1),
});

const transactionRowSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid(),
  listing_name: z.string().min(1),
  image_path: z.string().min(1),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  mode: z.enum(['credits', 'swap', 'giveaway']),
  credit_amount: z.number().int().positive().nullable(),
  swap_listing_id: z.string().uuid().nullable(),
  swap_listing_name: z.string().nullable(),
  status: z.enum(['awaiting_handoff', 'completed', 'cancelled', 'disputed']),
  buyer_confirmed_at: z.string().nullable(),
  seller_confirmed_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string().min(1),
});

const messageRowSchema = z.object({
  id: z.string().uuid(),
  offer_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  body: z.string().min(1).max(1000),
  created_at: z.string().min(1),
});

export type MarketplaceSummary = {
  annualPriceCents: number;
  currencyCode: string;
  firstYearCreditGrant: number;
  renewalCreditGrant: number;
  billingMode: 'development' | 'store';
  membershipStatus: z.infer<typeof membershipStatusSchema>;
  membershipStartsAt: string | null;
  membershipExpiresAt: string | null;
  availableCredits: number;
  reservedCredits: number;
};

export type MarketplaceListing = {
  id: string;
  garmentId: string;
  sellerId: string;
  sellerName: string;
  status: 'active' | 'reserved' | 'completed' | 'withdrawn';
  acceptsCredits: boolean;
  acceptsSwap: boolean;
  isGiveaway: boolean;
  creditPrice: number | null;
  pickupArea: string;
  garmentName: string;
  category: string | null;
  color: string | null;
  size: string | null;
  imagePath: string;
  imageUrl: string;
  createdAt: string;
};

export type MarketplaceOffer = {
  id: string;
  listingId: string;
  listingName: string;
  imageUrl: string;
  buyerId: string;
  sellerId: string;
  mode: MarketplaceMode;
  creditAmount: number | null;
  swapListingId: string | null;
  swapListingName: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'superseded';
  createdAt: string;
};

export type MarketplaceTransaction = {
  id: string;
  listingId: string;
  listingName: string;
  imageUrl: string;
  buyerId: string;
  sellerId: string;
  mode: MarketplaceMode;
  creditAmount: number | null;
  swapListingId: string | null;
  swapListingName: string | null;
  status: 'awaiting_handoff' | 'completed' | 'cancelled' | 'disputed';
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type MarketplaceMessage = {
  id: string;
  offerId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type MarketplaceRepository = {
  getSummary: () => Promise<MarketplaceSummary>;
  activateMembership: () => Promise<{ creditsGranted: number }>;
  listListings: () => Promise<MarketplaceListing[]>;
  publishListing: (input: ValidatedMarketplaceListing & { garmentId: string }) => Promise<string>;
  withdrawListing: (listingId: string) => Promise<void>;
  createOffer: (input: {
    listingId: string;
    mode: MarketplaceMode;
    swapListingId?: string | null;
    message?: string | null;
  }) => Promise<string>;
  listOffers: () => Promise<MarketplaceOffer[]>;
  respondToOffer: (offerId: string, accept: boolean) => Promise<string | null>;
  withdrawOffer: (offerId: string) => Promise<void>;
  listTransactions: () => Promise<MarketplaceTransaction[]>;
  confirmHandoff: (transactionId: string) => Promise<
    'awaiting_handoff' | 'settlement_pending' | 'completed'
  >;
  cancelTransaction: (transactionId: string) => Promise<void>;
  listMessages: (offerId: string) => Promise<MarketplaceMessage[]>;
  sendMessage: (offerId: string, body: string) => Promise<string>;
};

function throwIfError(error: unknown): asserts error is null | undefined {
  if (error) throw error;
}

function mapSummary(input: unknown): MarketplaceSummary {
  const row = summaryRowSchema.parse(input);
  return {
    annualPriceCents: row.annual_price_cents,
    currencyCode: row.currency_code,
    firstYearCreditGrant: row.first_year_credit_grant,
    renewalCreditGrant: row.renewal_credit_grant,
    billingMode: row.billing_mode,
    membershipStatus: row.membership_status,
    membershipStartsAt: row.membership_starts_at,
    membershipExpiresAt: row.membership_expires_at,
    availableCredits: row.available_credits,
    reservedCredits: row.reserved_credits,
  };
}

export function createMarketplaceRepository(client: SupabaseClient): MarketplaceRepository {
  const bucket = client.storage.from('garments');
  const signImage = async (path: string) => {
    const { data, error } = await bucket.createSignedUrl(path, 3600);
    throwIfError(error);
    return data.signedUrl;
  };

  return {
    async getSummary() {
      const { data, error } = await client.rpc('marketplace_my_summary');
      throwIfError(error);
      return mapSummary(z.array(summaryRowSchema).min(1).parse(data)[0]);
    },

    async activateMembership() {
      const { data, error } = await client.rpc('marketplace_activate_membership');
      throwIfError(error);
      const row = z.array(z.object({ credits_granted: z.number().int().nonnegative() })).min(1).parse(data)[0];
      return { creditsGranted: row.credits_granted };
    },

    async listListings() {
      const { data, error } = await client.rpc('marketplace_discover_listings');
      throwIfError(error);
      return Promise.all(z.array(listingRowSchema).parse(data ?? []).map(async (row) => ({
        id: row.id,
        garmentId: row.garment_id,
        sellerId: row.seller_id,
        sellerName: row.seller_name,
        status: row.status,
        acceptsCredits: row.accepts_credits,
        acceptsSwap: row.accepts_swap,
        isGiveaway: row.is_giveaway,
        creditPrice: row.credit_price,
        pickupArea: row.pickup_area,
        garmentName: row.garment_name,
        category: row.category,
        color: row.color,
        size: row.size,
        imagePath: row.image_path,
        imageUrl: await signImage(row.image_path),
        createdAt: row.created_at,
      })));
    },

    async publishListing(input) {
      const { data, error } = await client.rpc('marketplace_publish_listing', {
        p_garment_id: input.garmentId,
        p_accepts_credits: input.acceptsCredits,
        p_accepts_swap: input.acceptsSwap,
        p_is_giveaway: input.isGiveaway,
        p_credit_price: input.creditPrice,
        p_pickup_area: input.pickupArea,
      });
      throwIfError(error);
      return z.string().uuid().parse(data);
    },

    async withdrawListing(listingId) {
      const { error } = await client.rpc('marketplace_withdraw_listing', { p_listing_id: listingId });
      throwIfError(error);
    },

    async createOffer(input) {
      const { data, error } = await client.rpc('marketplace_create_offer', {
        p_listing_id: input.listingId,
        p_mode: input.mode,
        p_swap_listing_id: input.swapListingId ?? null,
        p_message: input.message ?? null,
      });
      throwIfError(error);
      return z.string().uuid().parse(data);
    },

    async listOffers() {
      const { data, error } = await client.rpc('marketplace_my_offers');
      throwIfError(error);
      return Promise.all(z.array(offerRowSchema).parse(data ?? []).map(async (row) => ({
        id: row.id,
        listingId: row.listing_id,
        listingName: row.listing_name,
        imageUrl: await signImage(row.image_path),
        buyerId: row.buyer_id,
        sellerId: row.seller_id,
        mode: row.mode,
        creditAmount: row.credit_amount,
        swapListingId: row.swap_listing_id,
        swapListingName: row.swap_listing_name,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
      })));
    },

    async respondToOffer(offerId, accept) {
      const { data, error } = await client.rpc('marketplace_respond_to_offer', {
        p_offer_id: offerId,
        p_accept: accept,
      });
      throwIfError(error);
      return data === null ? null : z.string().uuid().parse(data);
    },

    async withdrawOffer(offerId) {
      const { error } = await client.rpc('marketplace_withdraw_offer', { p_offer_id: offerId });
      throwIfError(error);
    },

    async listTransactions() {
      const { data, error } = await client.rpc('marketplace_my_transactions');
      throwIfError(error);
      return Promise.all(z.array(transactionRowSchema).parse(data ?? []).map(async (row) => ({
        id: row.id,
        listingId: row.listing_id,
        listingName: row.listing_name,
        imageUrl: await signImage(row.image_path),
        buyerId: row.buyer_id,
        sellerId: row.seller_id,
        mode: row.mode,
        creditAmount: row.credit_amount,
        swapListingId: row.swap_listing_id,
        swapListingName: row.swap_listing_name,
        status: row.status,
        buyerConfirmedAt: row.buyer_confirmed_at,
        sellerConfirmedAt: row.seller_confirmed_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      })));
    },

    async confirmHandoff(transactionId) {
      const { data, error } = await client.functions.invoke('confirm-marketplace-handoff', {
        body: { transactionId },
      });
      throwIfError(error);
      return z.object({
        state: z.enum(['awaiting_handoff', 'settlement_pending', 'completed']),
      }).parse(data).state;
    },

    async cancelTransaction(transactionId) {
      const { error } = await client.rpc('marketplace_cancel_transaction', {
        p_transaction_id: transactionId,
      });
      throwIfError(error);
    },

    async listMessages(offerId) {
      const { data, error } = await client.rpc('marketplace_my_messages', {
        p_offer_id: offerId,
      });
      throwIfError(error);
      return z.array(messageRowSchema).parse(data ?? []).map((row) => ({
        id: row.id,
        offerId: row.offer_id,
        senderId: row.sender_id,
        body: row.body,
        createdAt: row.created_at,
      }));
    },

    async sendMessage(offerId, body) {
      const { data, error } = await client.rpc('marketplace_send_message', {
        p_offer_id: offerId,
        p_body: body.trim(),
      });
      throwIfError(error);
      return z.string().uuid().parse(data);
    },
  };
}

function requireRepository() {
  if (!supabase) throw new Error('Supabase is not configured. Add the public URL and key to .env.local.');
  return createMarketplaceRepository(supabase);
}

export const supabaseMarketplaceRepository: MarketplaceRepository = {
  getSummary: () => requireRepository().getSummary(),
  activateMembership: () => requireRepository().activateMembership(),
  listListings: () => requireRepository().listListings(),
  publishListing: (input) => requireRepository().publishListing(input),
  withdrawListing: (listingId) => requireRepository().withdrawListing(listingId),
  createOffer: (input) => requireRepository().createOffer(input),
  listOffers: () => requireRepository().listOffers(),
  respondToOffer: (offerId, accept) => requireRepository().respondToOffer(offerId, accept),
  withdrawOffer: (offerId) => requireRepository().withdrawOffer(offerId),
  listTransactions: () => requireRepository().listTransactions(),
  confirmHandoff: (transactionId) => requireRepository().confirmHandoff(transactionId),
  cancelTransaction: (transactionId) => requireRepository().cancelTransaction(transactionId),
  listMessages: (offerId) => requireRepository().listMessages(offerId),
  sendMessage: (offerId, body) => requireRepository().sendMessage(offerId, body),
};
