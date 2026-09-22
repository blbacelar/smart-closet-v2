import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260922030000_garment_category_detection.sql',
);

describe('garment category detection migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('allows an authenticated owner to create a processing garment for automatic detection', () => {
    expect(sql).toContain('garments_insert_own_processing');
    expect(sql).toContain('category is null');
    expect(sql).toContain("status = 'processing'");
  });

  it('returns the existing category in the privileged processing claim', () => {
    expect(sql).toContain('public.claim_garment_processing');
    expect(sql).toContain("'category', garment.category");
  });

  it('atomically fills only a missing category and records tagging cost', () => {
    expect(sql).toContain('public.complete_garment_processing');
    expect(sql).toContain('category = coalesce(category, p_category)');
    expect(sql).toContain("values (p_user_id, 'garment_tagging', p_category_provider, p_category_cost_usd)");
    expect(sql).toContain("p_category not in ('top', 'bottom', 'dress', 'outerwear', 'shoes')");
  });

  it('keeps processing mutations restricted to the service role', () => {
    expect(sql).toContain('revoke all on function public.claim_garment_processing');
    expect(sql).toContain('revoke all on function public.complete_garment_processing');
    expect(sql).toContain('to service_role');
  });
});
