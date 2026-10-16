import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../20261016050000_double_entry_credit_ledger.sql',
);

describe('double-entry marketplace credit ledger migration', () => {
  const migration = () => fs.readFileSync(migrationPath, 'utf8');

  it('creates restricted accounts, journals, postings, and grant cohorts', () => {
    const sql = migration();

    expect(sql).toContain('create table private.marketplace_ledger_accounts');
    expect(sql).toContain('create table private.marketplace_ledger_journals');
    expect(sql).toContain('create table private.marketplace_ledger_postings');
    expect(sql).toContain('create table private.marketplace_grant_cohorts');
    expect(sql).toMatch(/revoke all on private\.marketplace_ledger_accounts from public, anon, authenticated/i);
  });

  it('enforces balanced, immutable, idempotent journals', () => {
    const sql = migration();

    expect(sql).toMatch(/unique\s*\(idempotency_key\)/i);
    expect(sql).toMatch(/unique\s*\(external_event_key\)/i);
    expect(sql).toContain('marketplace_assert_balanced_journal');
    expect(sql).toMatch(/constraint trigger marketplace_ledger_balance_check[\s\S]*deferrable initially deferred/i);
    expect(sql).toContain('marketplace_reject_ledger_mutation');
    expect(sql).toContain('marketplace_reverse_credit_journal');
    expect(sql).toContain('request_party_id uuid not null');
    expect(sql).toContain('request_units bigint not null');
    expect(sql).toContain('marketplace_validate_existing_credit_journal');
    expect(sql).toMatch(/unique index marketplace_ledger_grant_cohort_issuance_idx/i);
  });

  it('backfills and mirrors the compatibility ledger without exposing platform accounts', () => {
    const sql = migration();

    expect(sql).toContain('marketplace_mirror_legacy_credit_entry');
    expect(sql).toContain('marketplace_post_legacy_adjustment');
    expect(sql).toContain('marketplace_credit_ledger_double_entry');
    expect(sql).toContain("'legacy:' ||");
    expect(sql).toContain('marketplace_reconcile_credit_ledger');
    expect(sql).toContain('marketplace_my_credit_history');
    expect(sql).toMatch(/revoke all on function public\.marketplace_reconcile_credit_ledger\(\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.marketplace_reconcile_credit_ledger\(\) to service_role/i);
    expect(sql).toContain('posting_available');
    expect(sql).toContain('posting_held');
  });

  it('keeps sensitive functions on an empty search path and restricts mutation entry points', () => {
    const sql = migration();
    const securityDefinerCount = (sql.match(/security definer/gi) ?? []).length;
    const emptySearchPathCount = (sql.match(/set search_path = ''/gi) ?? []).length;

    expect(securityDefinerCount).toBeGreaterThanOrEqual(6);
    expect(emptySearchPathCount).toBeGreaterThanOrEqual(securityDefinerCount);
    expect(sql).toMatch(/grant execute on function private\.marketplace_post_credit_operation[\s\S]*to service_role/i);
    expect(sql).toMatch(/revoke all on function private\.marketplace_post_credit_operation[\s\S]*from public, anon, authenticated/i);
  });
});
