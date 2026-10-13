import { validateMarketplaceListing } from '../marketplaceValidation';

describe('validateMarketplaceListing', () => {
  it('accepts a listing that supports credits, swaps, and give-aways', () => {
    expect(validateMarketplaceListing({
      modes: ['credits', 'swap', 'giveaway'],
      creditPrice: '125',
      pickupArea: 'Burnaby Heights',
    })).toEqual({
      ok: true,
      listing: {
        acceptsCredits: true,
        acceptsSwap: true,
        isGiveaway: true,
        creditPrice: 125,
        pickupArea: 'Burnaby Heights',
      },
    });
  });

  it('does not require a credit price when credits are disabled', () => {
    expect(validateMarketplaceListing({
      modes: ['swap'],
      creditPrice: '',
      pickupArea: 'New Westminster',
    })).toMatchObject({ ok: true, listing: { creditPrice: null } });
  });

  it.each([
    [{ modes: [], creditPrice: '', pickupArea: 'Burnaby' }, 'Choose at least one way to exchange this piece.'],
    [{ modes: ['credits'], creditPrice: '', pickupArea: 'Burnaby' }, 'Enter a whole-number credit price.'],
    [{ modes: ['credits'], creditPrice: '0', pickupArea: 'Burnaby' }, 'Credit price must be between 1 and 10,000.'],
    [{ modes: ['giveaway'], creditPrice: '', pickupArea: '' }, 'Add a general pickup area.'],
  ] as const)('rejects invalid listing input', (input, message) => {
    expect(validateMarketplaceListing(input)).toEqual({ ok: false, message });
  });
});
