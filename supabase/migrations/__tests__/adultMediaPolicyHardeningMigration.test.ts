import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261015120000_adult_media_policy_hardening.sql',
);

describe('adult media policy hardening migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
  const policySql = (policyName: string) => {
    const start = sql.indexOf(`create policy "${policyName}"`);
    const next = sql.indexOf('create policy "', start + 1);
    return sql.slice(start, next === -1 ? undefined : next);
  };

  it('removes the broad policies that could bypass operation-specific checks', () => {
    expect(sql).toContain('drop policy if exists "body_photos_own_all"');
    expect(sql).toContain('drop policy if exists "garments_own_all"');
  });

  it.each([
    'body_photos_insert_own_pending',
    'garments_insert_own_processing',
    'private_source_image_insert',
  ])('requires confirmed adulthood in the %s policy', (policyName) => {
    const policy = policySql(policyName);
    expect(policy).toContain(`create policy "${policyName}"`);
    expect(policy).toContain('public.profiles.adult_confirmed_at is not null');
  });

  it('retains state and ownership restrictions for new private media', () => {
    expect(sql).toContain("and status = 'pending'");
    expect(sql).toContain("and status = 'processing'");
    expect(sql).toContain("bucket_id in ('body', 'garments')");
    expect(sql).toContain('(storage.foldername(name))[1] = (select auth.uid())::text');
  });
});
