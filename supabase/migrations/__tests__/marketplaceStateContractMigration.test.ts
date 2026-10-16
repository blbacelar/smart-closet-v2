import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261016070000_marketplace_state_contract.sql',
);

describe('marketplace state contract migration', () => {
  it('adds independent server-side controls and configurable deadlines', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    for (const control of [
      'grants_enabled',
      'offers_enabled',
      'acceptance_enabled',
      'settlement_enabled',
      'offer_ttl',
      'handoff_ttl',
    ]) {
      expect(sql).toContain(control);
    }
    expect(sql).toContain('transactions_enabled');
    expect(sql).toContain('private.marketplace_feature_enabled');
  });

  it('defines guarded offer and transaction transitions', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('private.marketplace_guard_offer_state');
    expect(sql).toContain('private.marketplace_guard_transaction_state');
    expect(sql).toContain("'expired'");
    expect(sql).toContain('expires_at');
    expect(sql).toContain('handoff_deadline');
    expect(sql).not.toContain(
      "old.status = 'disputed' and new.status in ('completed', 'cancelled')",
    );
  });

  it('captures immutable typed terms without personal content', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create table private.marketplace_transaction_terms');
    expect(sql).toContain('private.marketplace_capture_transaction_terms');
    expect(sql).toContain('private.marketplace_reject_immutable_change');
    const termsTable = sql.match(
      /create table private\.marketplace_transaction_terms \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(termsTable).toBeDefined();
    expect(termsTable).not.toMatch(/\b(image|message|pickup_area)\b/);
  });

  it('keeps safe recovery available while controls are paused', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('public.marketplace_respond_to_offer');
    expect(sql).toContain('public.marketplace_cancel_transaction');
    expect(sql).toContain('if not p_accept');
    expect(sql).toContain("if v_tx.status = 'cancelled' then return");
  });

  it('serializes offer release before moving reserved credits', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toMatch(
      /function private\.marketplace_release_offer[\s\S]*?from public\.marketplace_offers[\s\S]*?where id = p_offer_id\s+for update;[\s\S]*?insert into public\.marketplace_credit_ledger/,
    );
  });

  it('uses deterministic lock ordering and rejects divergent retries', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toMatch(
      /function public\.marketplace_create_offer[\s\S]*?marketplace_lock_listings[\s\S]*?account_deletion_lock_subjects[\s\S]*?order by id\s+for update;[\s\S]*?pending offer payload conflicts with existing offer/,
    );
    expect(sql).toMatch(
      /function public\.marketplace_respond_to_offer[\s\S]*?marketplace_lock_listings[\s\S]*?account_deletion_lock_subjects[\s\S]*?order by id\s+for update;/,
    );
  });

  it('fences legacy marketplace writers before taking row locks', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    for (const functionName of [
      'marketplace_publish_listing',
      'marketplace_withdraw_listing',
      'marketplace_withdraw_offer',
    ]) {
      const body = sql.match(
        new RegExp(
          `create or replace function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`,
        ),
      )?.[0];
      expect(body).toBeDefined();
      expect(body).toMatch(/account_deletion_lock_subjects[\s\S]*?for update;/);
    }

    const withdrawal = sql.match(
      /create or replace function public\.marketplace_withdraw_listing\([\s\S]*?\n\$\$;/,
    )?.[0];
    expect(withdrawal).toMatch(
      /marketplace_lock_listings[\s\S]*?account_deletion_lock_subjects[\s\S]*?for update;/,
    );
    expect(withdrawal).toContain('offer.swap_listing_id = p_listing_id');
  });

  it('fences settlement and forbids cancellation after confirmation', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toMatch(
      /function public\.marketplace_confirm_handoff[\s\S]*?account_deletion_lock_subjects[\s\S]*?for update;/,
    );
    expect(sql).toContain('a confirmed handoff cannot be cancelled');
  });
});
