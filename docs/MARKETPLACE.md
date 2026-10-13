# Fitly Marketplace

## Development model

The development marketplace adapts the parts of HomeExchange's GuestPoints model that fit peer-to-peer clothing exchange:

- A first annual membership grants 500 Fitly Credits.
- A later annual renewal grants 250 Fitly Credits.
- A member can earn credits when another member receives their garment.
- A direct reciprocal clothing swap can complete with zero credits.
- A garment can be offered as a free peer give-away.

The grant values are server configuration, not client constants. The current CAD 100 annual amount is a visible pilot placeholder based on the founder's example; development activation never charges the member. Fitly Credits have no cash value, cannot be bought separately, and move only through a completed garment handoff.

Official HomeExchange references used for the adaptation:

- [How GuestPoints work for reciprocal exchanges](https://help.homeexchange.com/hc/en-us/articles/360000621958-How-do-GuestPoints-work-for-reciprocal-exchange)
- [How members obtain GuestPoints](https://help.homeexchange.com/hc/en-us/articles/360000631317-How-can-I-obtain-GuestPoints)
- [Membership benefits and annual grants](https://help.homeexchange.com/hc/en-us/articles/360000610118-The-benefits-of-a-HomeExchange-membership)
- [How reciprocal exchanges are finalized](https://help.homeexchange.com/hc/en-us/articles/360000609998-How-do-I-finalize-reciprocal-exchanges)

## Member flow

1. Open **Market** and activate the no-charge development membership.
2. Open a ready garment in **Closet**, choose **List in marketplace**, select credits, swap, and/or give-away, then provide a general pickup area.
3. A second member opens the listing and sends exactly one type of offer. Credit offers reserve the listing price immediately; swap offers identify one active swap listing owned by the buyer.
4. The owner accepts or declines from **Market → Activity**. Accepting atomically reserves the garment or both swap garments and releases competing offers.
5. At the in-person handoff, both members confirm. Only the second confirmation completes the transaction and transfers reserved credits to the seller.
6. Before either member confirms, either participant can cancel; credits are released exactly once and the listing can receive another offer.

## Safety and accounting guarantees

- The app client cannot write membership, balance, ledger, offer status, or transaction status tables directly.
- Available and reserved balances cannot be negative.
- Membership and transfer grants use unique idempotency keys.
- Only authenticated members can discover listings, and only transaction participants can read their offers and handoffs.
- Marketplace photos reuse the existing private garment bucket and are exposed only through short-lived signed URLs.
- Exact addresses are intentionally not collected; listings use a general pickup area.

## Production gates

Real billing is not implemented because the final annual price, renewal/refund behavior, storefront rail, legal classification, tax treatment, and account-retention policy are not approved. Chat, push notifications, disputes, reports/blocks, ratings, and operator tooling also remain production gates. See [ADR 0001](./adr/0001-marketplace-membership-and-exchange-credits.md).

