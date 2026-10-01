export type SubscriptionTerms = {
  localizedPrice: string;
  billingPeriod: 'month' | 'year';
  productName: string;
};

export function buildSubscriptionDisclosure(terms: SubscriptionTerms) {
  const price = terms.localizedPrice.trim();
  const productName = terms.productName.trim();
  if (!price || !productName) {
    throw new Error('Subscription disclosure requires store product details.');
  }

  return `${productName} costs ${price} per ${terms.billingPeriod}. Payment is charged through your app store account. It automatically renews for the same billing period at the displayed price unless cancelled before renewal. Manage or cancel in your app store subscription settings.`;
}

export const betaSubscriptionDisclosure =
  'Beta preview only — no purchase will be made. Before paid checkout opens, Fitly will show the exact price, billing period, automatic-renewal terms, and cancellation instructions beside the purchase button.';
