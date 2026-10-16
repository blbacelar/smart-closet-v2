import { createMarketplaceRepository } from '../marketplaceRepository';

const summaryRow = {
  annual_price_cents: 10000,
  currency_code: 'CAD',
  first_year_credit_grant: 500,
  renewal_credit_grant: 250,
  billing_mode: 'development',
  membership_status: 'active',
  membership_starts_at: '2026-10-13T10:00:00Z',
  membership_expires_at: '2027-10-13T10:00:00Z',
  available_credits: 425,
  reserved_credits: 75,
};

const listingRow = {
  id: '11111111-1111-4111-8111-111111111111',
  garment_id: '22222222-2222-4222-8222-222222222222',
  seller_id: '33333333-3333-4333-8333-333333333333',
  seller_name: 'Taylor',
  status: 'active',
  accepts_credits: true,
  accepts_swap: true,
  is_giveaway: false,
  credit_price: 75,
  pickup_area: 'Burnaby Heights',
  garment_name: 'Denim jacket',
  category: 'outerwear',
  color: 'Blue',
  size: 'M',
  image_path: 'seller/jacket-clean.png',
  created_at: '2026-10-13T10:00:00Z',
};

const messageRow = {
  id: '66666666-6666-4666-8666-666666666666',
  offer_id: '44444444-4444-4444-8444-444444444444',
  sender_id: '33333333-3333-4333-8333-333333333333',
  body: 'Meet at the community centre?',
  created_at: '2026-10-13T10:05:00Z',
};

const offerRow = {
  id: '44444444-4444-4444-8444-444444444444',
  listing_id: listingRow.id,
  listing_name: listingRow.garment_name,
  image_path: listingRow.image_path,
  buyer_id: '77777777-7777-4777-8777-777777777777',
  seller_id: listingRow.seller_id,
  mode: 'swap',
  credit_amount: null,
  swap_listing_id: '55555555-5555-4555-8555-555555555555',
  swap_listing_name: 'Wool coat',
  message: 'Would you like to swap?',
  status: 'pending',
  created_at: '2026-10-13T10:02:00Z',
};

const transactionRow = {
  id: '88888888-8888-4888-8888-888888888888',
  listing_id: listingRow.id,
  listing_name: listingRow.garment_name,
  image_path: listingRow.image_path,
  buyer_id: offerRow.buyer_id,
  seller_id: listingRow.seller_id,
  mode: 'credits',
  credit_amount: 75,
  swap_listing_id: null,
  swap_listing_name: null,
  status: 'awaiting_handoff',
  buyer_confirmed_at: null,
  seller_confirmed_at: '2026-10-13T11:00:00Z',
  completed_at: null,
  created_at: '2026-10-13T10:10:00Z',
};

function createClient() {
  const rpc: jest.Mock = jest.fn(async (name: string) => {
    if (name === 'marketplace_my_summary') return { data: [summaryRow], error: null };
    if (name === 'marketplace_discover_listings') return { data: [listingRow], error: null };
    if (name === 'marketplace_activate_membership') {
      return { data: [{ ...summaryRow, credits_granted: 500 }], error: null };
    }
    if (name === 'marketplace_publish_listing') {
      return { data: listingRow.id, error: null };
    }
    if (name === 'marketplace_create_offer') {
      return { data: offerRow.id, error: null };
    }
    if (name === 'marketplace_my_offers') return { data: [offerRow], error: null };
    if (name === 'marketplace_respond_to_offer') return { data: transactionRow.id, error: null };
    if (name === 'marketplace_my_transactions') return { data: [transactionRow], error: null };
    if (name === 'marketplace_my_messages') return { data: [messageRow], error: null };
    if (name === 'marketplace_send_message') return { data: messageRow.id, error: null };
    return { data: null, error: null };
  });
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/jacket' },
    error: null,
  });
  const invoke = jest.fn().mockResolvedValue({
    data: { state: 'completed' },
    error: null,
  });
  return {
    client: {
      rpc,
      functions: { invoke },
      storage: { from: jest.fn(() => ({ createSignedUrl })) },
    },
    rpc,
    invoke,
    createSignedUrl,
  };
}

describe('marketplaceRepository', () => {
  it('loads the active membership and authoritative credit balances', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.getSummary()).resolves.toMatchObject({
      membershipStatus: 'active',
      availableCredits: 425,
      reservedCredits: 75,
      firstYearCreditGrant: 500,
    });
  });

  it('loads real discovery listings and signs their private garment images', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listListings()).resolves.toEqual([
      expect.objectContaining({
        id: listingRow.id,
        garmentName: 'Denim jacket',
        creditPrice: 75,
        imageUrl: 'https://signed.example/jacket',
      }),
    ]);
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('seller/jacket-clean.png', 3600);
  });

  it('publishes a closet garment using only validated listing fields', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.publishListing({
      garmentId: listingRow.garment_id,
      acceptsCredits: true,
      acceptsSwap: true,
      isGiveaway: false,
      creditPrice: 75,
      pickupArea: 'Burnaby Heights',
    })).resolves.toBe(listingRow.id);
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_publish_listing', {
      p_garment_id: listingRow.garment_id,
      p_accepts_credits: true,
      p_accepts_swap: true,
      p_is_giveaway: false,
      p_credit_price: 75,
      p_pickup_area: 'Burnaby Heights',
    });
  });

  it('sends a typed swap offer with the offered listing id', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await repository.createOffer({
      listingId: listingRow.id,
      mode: 'swap',
      swapListingId: '55555555-5555-4555-8555-555555555555',
      message: 'Would you like to swap?',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_create_offer', {
      p_listing_id: listingRow.id,
      p_mode: 'swap',
      p_swap_listing_id: '55555555-5555-4555-8555-555555555555',
      p_message: 'Would you like to swap?',
    });
  });

  it('normalizes omitted optional offer fields to null', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await repository.createOffer({ listingId: listingRow.id, mode: 'credits' });
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_create_offer', {
      p_listing_id: listingRow.id,
      p_mode: 'credits',
      p_swap_listing_id: null,
      p_message: null,
    });
  });

  it('loads offers and supports accepting or withdrawing them', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listOffers()).resolves.toEqual([
      expect.objectContaining({
        id: offerRow.id,
        listingName: 'Denim jacket',
        mode: 'swap',
        swapListingName: 'Wool coat',
        imageUrl: 'https://signed.example/jacket',
      }),
    ]);
    await expect(repository.respondToOffer(offerRow.id, true)).resolves.toBe(transactionRow.id);
    await expect(repository.withdrawOffer(offerRow.id)).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_respond_to_offer', {
      p_offer_id: offerRow.id,
      p_accept: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_withdraw_offer', {
      p_offer_id: offerRow.id,
    });
  });

  it('maps transactions and completes or cancels their handoff', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listTransactions()).resolves.toEqual([
      expect.objectContaining({
        id: transactionRow.id,
        listingName: 'Denim jacket',
        mode: 'credits',
        creditAmount: 75,
        status: 'awaiting_handoff',
        sellerConfirmedAt: '2026-10-13T11:00:00Z',
      }),
    ]);
    await expect(repository.confirmHandoff(transactionRow.id)).resolves.toBe('completed');
    await expect(repository.cancelTransaction(transactionRow.id)).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith('confirm-marketplace-handoff', {
      body: { transactionId: transactionRow.id },
    });
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_cancel_transaction', {
      p_transaction_id: transactionRow.id,
    });
  });

  it('activates membership and withdraws a published listing', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.activateMembership()).resolves.toEqual({ creditsGranted: 500 });
    await expect(repository.withdrawListing(listingRow.id)).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_withdraw_listing', {
      p_listing_id: listingRow.id,
    });
  });

  it('returns a null transaction when an offer is rejected', async () => {
    const mocks = createClient();
    mocks.rpc.mockImplementation(async (name: string) => (
      name === 'marketplace_respond_to_offer'
        ? { data: null, error: null }
        : { data: null, error: null }
    ));
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.respondToOffer(offerRow.id, false)).resolves.toBeNull();
  });

  it('loads and sends private messages scoped to an offer', async () => {
    const mocks = createClient();
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listMessages(messageRow.offer_id)).resolves.toEqual([
      {
        id: messageRow.id,
        offerId: messageRow.offer_id,
        senderId: messageRow.sender_id,
        body: messageRow.body,
        createdAt: messageRow.created_at,
      },
    ]);
    await expect(repository.sendMessage(messageRow.offer_id, '  Sounds good.  ')).resolves.toBe(messageRow.id);
    expect(mocks.rpc).toHaveBeenCalledWith('marketplace_send_message', {
      p_offer_id: messageRow.offer_id,
      p_body: 'Sounds good.',
    });
  });

  it('treats null collection responses as empty marketplace collections', async () => {
    const mocks = createClient();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listListings()).resolves.toEqual([]);
    await expect(repository.listOffers()).resolves.toEqual([]);
    await expect(repository.listTransactions()).resolves.toEqual([]);
    await expect(repository.listMessages(offerRow.id)).resolves.toEqual([]);
  });

  it('rejects discovery when a private image cannot be signed', async () => {
    const mocks = createClient();
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('Storage unavailable') });
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listListings()).rejects.toThrow('Storage unavailable');
  });

  it('propagates server errors instead of showing fake marketplace data', async () => {
    const mocks = createClient();
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('Membership required') });
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listListings()).rejects.toThrow('Membership required');
  });
});
