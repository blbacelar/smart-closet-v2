import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260903120000_account_deletion_storage_guard.sql',
);

describe('account deletion storage guard migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it.each(['insert', 'select', 'update', 'delete'])('%s access requires a live Fitly profile', (operation) => {
    expect(sql).toContain(`drop policy if exists "private_image_${operation}"`);
    expect(sql).toContain(`create policy "private_image_${operation}"`);
  });

  it('blocks a deleted user stale JWT from accessing storage', () => {
    expect(sql.match(/exists\s*\(\s*select 1\s+from public\.profiles/gi)).toHaveLength(5);
    expect(sql).toContain('public.profiles.id = (select auth.uid())');
  });

  it('documents a forward rollback for the deployed policy replacement', () => {
    expect(sql).toContain('-- rollback: create a new forward migration');
  });
});
