import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261013140000_marketplace_economy.sql',
);
const relistingMigrationPath = resolve(
  __dirname,
  '../20261013160000_marketplace_relisting_safety.sql',
);
const messagingMigrationPath = resolve(
  __dirname,
  '../20261013170000_marketplace_private_messages.sql',
);

describe('marketplace economy migration', () => {
  it('defines membership, credits, listings, offers, and transactions', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    for (const table of [
      'marketplace_config',
      'marketplace_memberships',
      'marketplace_credit_accounts',
      'marketplace_credit_ledger',
      'marketplace_listings',
      'marketplace_offers',
      'marketplace_transactions',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('keeps balances and state transitions server-authored', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('revoke insert, update, delete on public.marketplace_credit_accounts');
    expect(sql).toContain('revoke insert, update, delete on public.marketplace_credit_ledger');
    expect(sql).toContain('create or replace function public.marketplace_activate_membership');
    expect(sql).toContain('create or replace function public.marketplace_publish_listing');
    expect(sql).toContain('create or replace function public.marketplace_create_offer');
    expect(sql).toContain('create or replace function public.marketplace_respond_to_offer');
    expect(sql).toContain('create or replace function public.marketplace_withdraw_offer');
    expect(sql).toContain('create or replace function public.marketplace_confirm_handoff');
    expect(sql).toContain('create or replace function public.marketplace_cancel_transaction');
    expect(sql).toContain('security definer');
  });

  it('prevents duplicate active listings, offers, and membership grants', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('marketplace_one_open_listing_per_garment');
    expect(sql).toContain('marketplace_one_pending_offer_per_buyer');
    expect(sql).toContain('idempotency_key text not null unique');
  });

  it('allows a cancelled listing to receive a new transaction safely', () => {
    expect(existsSync(relistingMigrationPath)).toBe(true);
    const sql = readFileSync(relistingMigrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('drop constraint if exists marketplace_transactions_listing_id_key');
    expect(sql).toContain('marketplace_one_non_cancelled_transaction_per_listing');
    expect(sql).toContain("where status in ('awaiting_handoff', 'completed', 'disputed')");
  });

  it('releases every pending offer that depends on an accepted or withdrawn swap piece', () => {
    const sql = readFileSync(relistingMigrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('or swap_listing_id = p_listing_id');
    expect(sql).toContain('or swap_listing_id = v_offer.swap_listing_id');
  });

  it('keeps offer conversations private and server-authored', () => {
    expect(existsSync(messagingMigrationPath)).toBe(true);
    const sql = readFileSync(messagingMigrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create table public.marketplace_messages');
    expect(sql).toContain('alter table public.marketplace_messages enable row level security');
    expect(sql).toContain('create or replace function public.marketplace_my_messages');
    expect(sql).toContain('create or replace function public.marketplace_send_message');
    expect(sql).toContain('revoke insert, update, delete on public.marketplace_messages');
  });
});
