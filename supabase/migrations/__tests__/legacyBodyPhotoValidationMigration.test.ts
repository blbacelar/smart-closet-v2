import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260921213100_grandfather_legacy_body_photos.sql',
);

describe('legacy body-photo validation data migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('grandfathers only photos pending before automated validation launched', () => {
    expect(sql).toContain('update public.body_photos');
    expect(sql).toContain("set status = 'approved'");
    expect(sql).toContain("where status = 'pending'");
    expect(sql).toContain("created_at < '2026-09-21 21:31:00+00'::timestamptz");
  });

  it('marks administrative completion without inventing provider spend', () => {
    expect(sql).toContain('validation_completed_at = now()');
    expect(sql).not.toContain('ai_cost_ledger');
  });
});
