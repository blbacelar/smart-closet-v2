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
  });

  it('captures immutable typed terms without personal content', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('create table private.marketplace_transaction_terms');
    expect(sql).toContain('private.marketplace_capture_transaction_terms');
    expect(sql).toContain('private.marketplace_reject_immutable_change');
    expect(sql).not.toMatch(/marketplace_transaction_terms[\s\S]*\b(image|message|pickup_area)\b/);
  });

  it('keeps safe recovery available while controls are paused', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('public.marketplace_respond_to_offer');
    expect(sql).toContain('public.marketplace_cancel_transaction');
    expect(sql).toContain('if not p_accept');
    expect(sql).toContain("if v_tx.status = 'cancelled' then return");
  });
});
