-- This fixture is loaded only after resetting to 20261016030000, immediately
-- before the marketplace-party migration exists. It intentionally uses only
-- the legacy profile-backed columns.

insert into auth.users (id, email)
values
  ('91000000-0000-4000-8000-000000000001', 'legacy-seller@example.com'),
  ('91000000-0000-4000-8000-000000000002', 'legacy-buyer@example.com');

insert into public.garments (
  id, user_id, original_path, clean_path, image_hash, name, category, status
) values
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001/seller-original.jpg',
    '91000000-0000-4000-8000-000000000001/seller-clean.png',
    'legacy-seller-hash',
    'Legacy seller garment',
    'outerwear',
    'ready'
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002/buyer-original.jpg',
    '91000000-0000-4000-8000-000000000002/buyer-clean.png',
    'legacy-buyer-hash',
    'Legacy buyer garment',
    'top',
    'ready'
  );

insert into public.marketplace_memberships (user_id, expires_at)
values
  ('91000000-0000-4000-8000-000000000001', now() + interval '1 year'),
  ('91000000-0000-4000-8000-000000000002', now() + interval '1 year');

insert into public.marketplace_credit_accounts (
  user_id, available_balance, reserved_balance
) values
  ('91000000-0000-4000-8000-000000000001', 125, 0),
  ('91000000-0000-4000-8000-000000000002', 250, 25);

insert into public.marketplace_listings (
  id, garment_id, seller_id, accepts_credits, accepts_swap, is_giveaway,
  credit_price, pickup_area
) values
  (
    '93000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    true, false, false, 25, 'Legacy seller area'
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002',
    false, true, false, null, 'Legacy buyer area'
  );

insert into public.marketplace_offers (
  id, listing_id, buyer_id, seller_id, mode, credit_amount, status
) values (
  '94000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000001',
  'credits',
  25,
  'accepted'
);

insert into public.marketplace_transactions (
  id, offer_id, listing_id, seller_id, buyer_id, mode, credit_amount
) values (
  '95000000-0000-4000-8000-000000000001',
  '94000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000002',
  'credits',
  25
);

insert into public.marketplace_credit_ledger (
  id, user_id, kind, delta_available, delta_reserved, idempotency_key,
  description
) values
  (
    '96000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'membership_grant',
    125,
    0,
    'legacy-seller-grant',
    'Legacy seller opening grant'
  ),
  (
    '96000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002',
    'offer_reserve',
    -25,
    25,
    'legacy-buyer-reserve',
    'Legacy buyer reservation'
  );
