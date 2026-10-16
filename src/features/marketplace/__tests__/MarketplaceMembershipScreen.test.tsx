import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { MarketplaceSummary } from '../marketplaceRepository';
import { MarketplaceMembershipScreen } from '../MarketplaceMembershipScreen';

const summary: MarketplaceSummary = {
  annualPriceCents: 10000,
  currencyCode: 'CAD',
  firstYearCreditGrant: 500,
  renewalCreditGrant: 250,
  billingMode: 'development',
  membershipStatus: 'none',
  membershipStartsAt: null,
  membershipExpiresAt: null,
  availableCredits: 0,
  reservedCredits: 0,
};

describe('MarketplaceMembershipScreen', () => {
  it('explains the pilot membership and activates or closes it', async () => {
    const onActivate = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <MarketplaceMembershipScreen
        summary={summary}
        isActivating={false}
        message="Pilot membership is ready."
        onActivate={onActivate}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('$100')).toBeTruthy();
    expect(screen.getByText('500 credits when you first join')).toBeTruthy();
    expect(screen.getByText('Pilot membership is ready.')).toBeTruthy();
    expect(screen.getByText(/Development mode/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Activate annual marketplace membership'));
    await fireEvent.press(screen.getByLabelText('Close membership'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('prevents duplicate activation while the request is in flight', async () => {
    const onActivate = jest.fn();
    const screen = await render(
      <MarketplaceMembershipScreen
        summary={summary}
        isActivating
        onActivate={onActivate}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Activating…')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Activate annual marketplace membership'));
    expect(onActivate).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('shows the balance and store disclosure for an active member', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <MarketplaceMembershipScreen
        summary={{ ...summary, membershipStatus: 'active', billingMode: 'store', availableCredits: 425 }}
        isActivating={false}
        onActivate={jest.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('425 credits')).toBeTruthy();
    expect(screen.getByText('available now')).toBeTruthy();
    expect(screen.getByText(/Payment, renewal, cancellation/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Explore marketplace'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
});
