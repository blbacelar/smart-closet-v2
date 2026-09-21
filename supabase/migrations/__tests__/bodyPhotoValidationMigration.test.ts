import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260921213000_body_photo_validation_pipeline.sql',
);

describe('body-photo validation migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('adds bounded retry and timing metadata without exposing provider output', () => {
    expect(sql).toContain('validation_attempts integer not null default 0');
    expect(sql).toContain('validation_started_at timestamptz');
    expect(sql).toContain('validation_completed_at timestamptz');
    expect(sql).toContain('validation_error text');
  });

  it('claims pending owner photos once with stale-attempt recovery', () => {
    expect(sql).toContain('public.claim_body_photo_validation');
    expect(sql).toContain('for update');
    expect(sql).toContain("now() - interval '2 minutes'");
    expect(sql).toContain('validation_attempts = validation_attempts + 1');
  });

  it('atomically completes status and one moderation ledger entry', () => {
    expect(sql).toContain('public.complete_body_photo_validation');
    expect(sql).toContain("status = p_decision");
    expect(sql).toContain("values (p_user_id, 'moderation', p_provider, p_cost_usd)");
    expect(sql).toContain("'age_not_confirmed'");
    expect(sql).toContain("'poor_quality'");
  });

  it('keeps all validation mutations service-role only', () => {
    expect(sql).toContain('revoke all on function public.claim_body_photo_validation');
    expect(sql).toContain('revoke all on function public.complete_body_photo_validation');
    expect(sql).toContain('revoke all on function public.fail_body_photo_validation');
    expect(sql).toContain('to service_role');
  });
});
