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
4. Both participants can use the offer's private chat to agree on a safe public pickup plan. The owner accepts or declines from **Market → Activity**. Accepting atomically reserves the garment or both swap garments and releases competing offers.
5. At the in-person handoff, both members confirm. Only the second confirmation completes the transaction and transfers reserved credits to the seller.
6. Before either member confirms, either participant can cancel; credits are released exactly once and the listing can receive another offer.

## Server-authoritative state contract

The database, rather than the mobile client, owns all marketplace transitions:

- Offers start as `pending` and may become `accepted`, `rejected`, `withdrawn`, `superseded`, or `expired`. Every terminal transition is one-way.
- Transactions start as `awaiting_handoff` and may become `completed`, `cancelled`, `disputed`, or `expired`. Disputed transactions remain frozen until the dispute-resolution slice defines and tests the approved outcomes.
- Offers and handoffs carry server-generated deadlines. The configured durations are bounded to 30 days; clients cannot extend them or invent terminal timestamps.
- Accepting an offer locks the affected listings before the offer. Competing acceptances therefore have one winner, while all losing offers are superseded and their reservations are released once.
- A private, immutable terms record captures the accepted listing, mode, credit amount, participant parties, and swap listing. It deliberately excludes messages, media, and precise pickup information.
- Repeating an accepted response returns the original transaction. Repeating rejection or cancellation is a safe no-op, so network retries cannot duplicate value movement.

The database expiry worker enforces offer and handoff deadlines in bounded batches. Overlapping cron runs return immediately, while each candidate uses nonblocking marketplace/deletion gates and row locks. A busy or malformed item receives private retry backoff without rolling back healthy items later in the batch. Pending offers release reservations once. An overdue handoff with no confirmation expires and reopens its listing set; a handoff with either participant already confirmed becomes `disputed` and keeps credits/listings frozen for the future dispute resolver. Acquired-garment copies remain a separate completion slice.

## Operational switches

Marketplace configuration exposes independent server-side switches for grants, new offers, acceptance, and settlement. The master `transactions_enabled` switch also blocks every value-creating path. Disabling a switch never silently abandons existing state:

- withdrawals, rejections, cancellations, history, and reconciliation remain available;
- a settlement pause freezes an accepted physical handoff instead of releasing its credits or garment;
- grants, offer creation, offer acceptance, and confirmations fail closed at the database boundary when their corresponding switch is off.

## Safety and accounting guarantees

- The app client cannot write membership, balance, ledger, offer status, or transaction status tables directly.
- Available and reserved balances cannot be negative.
- Membership and transfer grants use unique idempotency keys.
- Only authenticated members can discover listings, and only offer/transaction participants can read their offers, private messages, and handoffs.
- Marketplace photos reuse the existing private garment bucket and are exposed only through short-lived signed URLs.
- Exact addresses are intentionally not collected; listings use a general pickup area.
- Accepted terms contain no chat text, media path, or exact pickup data and survive account deletion only through pseudonymous party identifiers.

## Production gates

Real billing is not implemented because the final annual price, renewal/refund behavior, storefront rail, legal classification, tax treatment, and account-retention policy are not approved. Push notifications, disputes, reports/blocks, ratings, and operator tooling also remain production gates. See [ADR 0001](./adr/0001-marketplace-membership-and-exchange-credits.md).
