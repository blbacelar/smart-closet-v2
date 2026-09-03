import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260903010000_tryon_realtime_recovery.sql',
);

describe('try-on reliability migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('idempotently publishes try-on jobs to Supabase Realtime', () => {
    expect(sql).toContain('supabase_realtime');
    expect(sql).toContain('pg_publication_tables');
    expect(sql).toMatch(/alter\s+publication\s+supabase_realtime\s+add\s+table\s+public\.tryon_jobs/);
  });

  it('locks only stale queued or running jobs and reuses the atomic failure refund', () => {
    expect(sql).toContain("status in ('queued', 'running')");
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain('public.fail_tryon_job');
    expect(sql).toContain("'timeout'");
  });

  it('keeps reconciliation privileged and schedules it every five minutes', () => {
    expect(sql).toContain('revoke all on function public.reconcile_stuck_tryon_jobs');
    expect(sql).toContain("cron.schedule(");
    expect(sql).toContain("'fitly-reconcile-stuck-tryon-jobs'");
    expect(sql).toContain("'*/5 * * * *'");
  });
});
