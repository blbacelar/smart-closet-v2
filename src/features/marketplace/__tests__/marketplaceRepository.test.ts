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
      return { data: '44444444-4444-4444-8444-444444444444', error: null };
    }
    if (name === 'marketplace_my_messages') return { data: [messageRow], error: null };
    if (name === 'marketplace_send_message') return { data: messageRow.id, error: null };
    return { data: null, error: null };
  });
  const createSignedUrl = jest.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/jacket' },
    error: null,
  });
  return {
    client: {
      rpc,
      storage: { from: jest.fn(() => ({ createSignedUrl })) },
    },
    rpc,
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

  it('propagates server errors instead of showing fake marketplace data', async () => {
    const mocks = createClient();
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('Membership required') });
    const repository = createMarketplaceRepository(mocks.client as never);

    await expect(repository.listListings()).rejects.toThrow('Membership required');
  });
});
