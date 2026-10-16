import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(__dirname, '../20261016120000_operational_health.sql');
const configPath = resolve(__dirname, '../../config.toml');

describe('operational health migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
  const config = readFileSync(configPath, 'utf8');

  it('delegates edge authentication to the independent monitor-token handler', () => {
    expect(config).toMatch(/\[functions\.operations-health\]\s+verify_jwt = false/);
  });

  it('stores only private aggregate snapshots', () => {
    expect(sql).toContain('create table private.operational_health_snapshots');
    expect(sql).toContain('metrics jsonb');
    expect(sql).toContain('revoke all on private.operational_health_snapshots');
    expect(sql).not.toMatch(/operational_health_snapshots[\s\S]*user_id/);
  });

  it('checks ledger, expiry, try-on, and notification health without row identities', () => {
    expect(sql).toContain('public.operational_health_check');
    expect(sql).toContain('public.marketplace_reconcile_credit_ledger()');
    expect(sql).toContain('private.marketplace_expiry_failures');
    expect(sql).toContain('public.tryon_jobs');
    expect(sql).toContain('private.notification_outbox');
    expect(sql).not.toMatch(/returns table \([\s\S]*user_id/);
  });

  it('is service-only and validates environment-owned thresholds', () => {
    expect(sql).toMatch(/revoke all on function public\.operational_health_check[\s\S]*authenticated/);
    expect(sql).toMatch(/grant execute on function public\.operational_health_check[\s\S]*service_role/);
    expect(sql).toContain('invalid operational health thresholds');
  });

  it('captures aggregate snapshots on a bounded schedule', () => {
    expect(sql).toContain('create table private.operational_health_config');
    expect(sql).toContain('public.configure_operational_health');
    expect(sql).toContain('from private.operational_health_config');
    expect(sql).toContain('private.capture_operational_health');
    expect(sql).toContain("'fitly-operational-health'");
    expect(sql).toContain("'*/5 * * * *'");
  });
});
