import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260930090000_profile_onboarding.sql',
);

describe('profile onboarding migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('adds a persisted onboarding completion timestamp', () => {
    expect(sql).toContain('onboarding_completed_at timestamptz');
  });

  it('allows authenticated members to update only approved profile fields', () => {
    expect(sql).toContain('revoke update on table public.profiles from authenticated');
    expect(sql).toContain('grant update(display_name, region, onboarding_completed_at)');
    expect(sql).not.toContain('grant update(tier');
  });
});
