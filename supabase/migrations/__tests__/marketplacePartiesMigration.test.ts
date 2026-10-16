import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261016040000_marketplace_parties.sql',
);

describe('marketplace party migration', () => {
  it('creates a private, pseudonymous party map that clients cannot read', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create table private.marketplace_parties');
    expect(sql).toContain('user_id uuid unique');
    expect(sql).toContain('on delete set null');
    expect(sql).toContain('revoke all on private.marketplace_parties from public, anon, authenticated');
  });

  it('backfills every durable marketplace participant and record', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('insert into private.marketplace_parties (user_id)');
    expect(sql).toContain('on conflict (user_id) do nothing');
    for (const column of [
      'party_id',
      'seller_party_id',
      'buyer_party_id',
    ]) {
      expect(sql).toContain(column);
    }
    expect(sql).toContain('alter column party_id set not null');
    expect(sql).toContain('alter column seller_party_id set not null');
    expect(sql).toContain('alter column buyer_party_id set not null');
  });

  it('moves durable foreign keys to parties while keeping nullable legacy ids', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    for (const table of [
      'marketplace_memberships',
      'marketplace_credit_accounts',
      'marketplace_listings',
      'marketplace_offers',
      'marketplace_transactions',
      'marketplace_credit_ledger',
    ]) {
      expect(sql).toContain(`alter table public.${table}`);
    }
    expect(sql).toContain('references private.marketplace_parties(id) on delete restrict');
    expect(sql).toContain('alter column user_id drop not null');
    expect(sql).toContain('alter column seller_id drop not null');
    expect(sql).toContain('alter column buyer_id drop not null');
  });

  it('keeps legacy server writes synchronized during the compatibility window', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create or replace function private.marketplace_ensure_party');
    expect(sql).toContain('create trigger marketplace_sync_single_party');
    expect(sql).toContain('create trigger marketplace_sync_seller_party');
    expect(sql).toContain('create trigger marketplace_sync_participant_parties');
  });

  it('authorizes retained rows through a boolean party match without exposing ids', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create or replace function public.marketplace_party_matches');
    expect(sql).toContain('returns boolean');
    expect(sql).toContain('security definer');
    expect(sql).toContain('public.marketplace_party_matches(party_id)');
    expect(sql).toContain('public.marketplace_party_matches(seller_party_id)');
    expect(sql).toContain('public.marketplace_party_matches(buyer_party_id)');
    expect(sql).toContain('revoke all on function public.marketplace_party_matches(uuid) from public, anon');
    expect(sql).toContain('grant execute on function public.marketplace_party_matches(uuid) to authenticated');
  });
});
