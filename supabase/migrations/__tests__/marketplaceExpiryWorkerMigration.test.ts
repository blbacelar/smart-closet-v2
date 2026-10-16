import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261016080000_marketplace_expiry_worker.sql',
);

describe('marketplace expiry worker migration', () => {
  it('defines bounded expiry scans and supporting indexes', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('marketplace_pending_offer_expiry_idx');
    expect(sql).toContain('marketplace_open_handoff_expiry_idx');
    expect(sql).toContain('public.marketplace_expire_stale');
    expect(sql).toContain('p_limit');
    expect(sql).toContain('expired_at');
  });

  it('uses the marketplace lock hierarchy before row locks', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    const body = sql.match(
      /create or replace function public\.marketplace_expire_stale\([\s\S]*?\n\$\$;/,
    )?.[0];

    expect(body).toBeDefined();
    expect(body).toMatch(
      /marketplace_lock_listings[\s\S]*?account_deletion_lock_subjects[\s\S]*?for update/,
    );
    expect(body).toContain('skip locked');
  });

  it('keeps partial confirmations frozen and releases unconfirmed work once', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain("status = 'disputed'");
    expect(sql).toContain("'expiration_release'");
    expect(sql).toContain("'transaction:' || v_tx.id::text || ':expire'");
    expect(sql).toContain('on conflict (idempotency_key) do nothing');
  });

  it('restricts execution to the service role and schedules the worker', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain(
      'revoke all on function public.marketplace_expire_stale(timestamptz, integer) from public, anon, authenticated',
    );
    expect(sql).toContain(
      'grant execute on function public.marketplace_expire_stale(timestamptz, integer) to service_role',
    );
    expect(sql).toContain("'fitly-marketplace-expiry'");
    expect(sql).toContain('cron.schedule');
  });
});
