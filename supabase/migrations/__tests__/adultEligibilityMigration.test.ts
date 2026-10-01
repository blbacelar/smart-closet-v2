import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261001120000_adult_account_eligibility.sql',
);

describe('adult account eligibility migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('records an eligibility confirmation without storing a birth date', () => {
    expect(sql).toContain('adult_confirmed_at timestamptz');
    expect(sql).not.toContain('date_of_birth');
    expect(sql).not.toContain('birth_date');
  });

  it('exposes only a scoped confirmation function to authenticated members', () => {
    expect(sql).toContain('function public.confirm_adult_status()');
    expect(sql).toContain('where id = (select auth.uid())');
    expect(sql).toContain('grant execute on function public.confirm_adult_status() to authenticated');
    expect(sql).toContain('revoke all on function public.confirm_adult_status() from public, anon');
  });

  it('requires a confirmed profile before private source uploads are inserted', () => {
    expect(sql).toContain('public.profiles.adult_confirmed_at is not null');
    expect(sql).toContain('create policy "private_source_image_insert"');
  });
});
