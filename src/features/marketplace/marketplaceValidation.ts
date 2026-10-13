export type MarketplaceMode = 'credits' | 'swap' | 'giveaway';

type MarketplaceListingInput = {
  modes: readonly MarketplaceMode[];
  creditPrice: string;
  pickupArea: string;
};

export type ValidatedMarketplaceListing = {
  acceptsCredits: boolean;
  acceptsSwap: boolean;
  isGiveaway: boolean;
  creditPrice: number | null;
  pickupArea: string;
};

export type MarketplaceListingValidation =
  | { ok: true; listing: ValidatedMarketplaceListing }
  | { ok: false; message: string };

export function validateMarketplaceListing(
  input: MarketplaceListingInput,
): MarketplaceListingValidation {
  if (input.modes.length === 0) {
    return { ok: false, message: 'Choose at least one way to exchange this piece.' };
  }

  const acceptsCredits = input.modes.includes('credits');
  const parsedPrice = Number(input.creditPrice);
  if (acceptsCredits && (!/^\d+$/.test(input.creditPrice) || !Number.isInteger(parsedPrice))) {
    return { ok: false, message: 'Enter a whole-number credit price.' };
  }
  if (acceptsCredits && (parsedPrice < 1 || parsedPrice > 10_000)) {
    return { ok: false, message: 'Credit price must be between 1 and 10,000.' };
  }

  const pickupArea = input.pickupArea.trim();
  if (pickupArea.length < 2) {
    return { ok: false, message: 'Add a general pickup area.' };
  }
  if (pickupArea.length > 80) {
    return { ok: false, message: 'Pickup area must be 80 characters or fewer.' };
  }

  return {
    ok: true,
    listing: {
      acceptsCredits,
      acceptsSwap: input.modes.includes('swap'),
      isGiveaway: input.modes.includes('giveaway'),
      creditPrice: acceptsCredits ? parsedPrice : null,
      pickupArea,
    },
  };
}
