import {
  betaSubscriptionDisclosure,
  buildSubscriptionDisclosure,
} from '../subscriptionDisclosure';

describe('subscription disclosures', () => {
  it('places price, duration, renewal, and cancellation in one disclosure', () => {
    const disclosure = buildSubscriptionDisclosure({
      productName: 'Fitly Pro',
      localizedPrice: '$59 CAD',
      billingPeriod: 'year',
    });

    expect(disclosure).toContain('Fitly Pro costs $59 CAD per year');
    expect(disclosure).toContain('automatically renews');
    expect(disclosure).toContain('unless cancelled before renewal');
    expect(disclosure).toContain('subscription settings');
  });

  it('refuses to construct checkout copy without store product data', () => {
    expect(() => buildSubscriptionDisclosure({
      productName: 'Fitly Pro',
      localizedPrice: ' ',
      billingPeriod: 'month',
    })).toThrow('requires store product details');
  });

  it('makes the beta screen unambiguously non-transactional', () => {
    expect(betaSubscriptionDisclosure).toContain('no purchase will be made');
    expect(betaSubscriptionDisclosure).toContain('beside the purchase button');
  });
});
