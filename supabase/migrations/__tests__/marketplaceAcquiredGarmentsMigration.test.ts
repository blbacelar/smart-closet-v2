import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261016090000_marketplace_acquired_garments.sql',
);

describe('marketplace acquired garments migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('owns immutable, private and idempotent acquisition provenance', () => {
    expect(sql).toContain('create table private.marketplace_acquisitions');
    expect(sql).toContain('primary key (transaction_id, source_listing_id)');
    expect(sql).toContain('unique (acquired_garment_id)');
    expect(sql).toContain('revoke all on private.marketplace_acquisitions');
    expect(sql).toContain('marketplace_acquisition_guard');
  });

  it('separates participant confirmation from service-role finalization', () => {
    expect(sql).toContain('marketplace_record_handoff_confirmation');
    expect(sql).toContain("return 'settlement_pending'");
    expect(sql).toContain('marketplace_acquisition_manifest');
    expect(sql).toContain('marketplace_finalize_handoff');
    expect(sql).toMatch(
      /revoke all on function public\.marketplace_finalize_handoff\(uuid\)[\s\S]*?grant execute on function public\.marketplace_finalize_handoff\(uuid\) to service_role/,
    );
  });

  it('requires recipient-owned storage copies before inserting sanitized garments', () => {
    expect(sql).toContain("bucket_id = 'garments'");
    expect(sql).toContain('storage.objects');
    expect(sql).toContain("'/acquired/'");
    expect(sql).toContain('image_hash, processing_attempts, processing_error');
    expect(sql).toMatch(/null, 0, null/);
    expect(sql).not.toMatch(/update public\.garments[\s\S]{0,200}set user_id/);
  });

  it('creates one recipient copy per listing and two for swaps', () => {
    expect(sql).toContain('v_tx.listing_id, v_tx.buyer_party_id');
    expect(sql).toContain('v_tx.swap_listing_id, v_tx.seller_party_id');
    expect(sql).toContain('on conflict (transaction_id, source_listing_id) do nothing');
  });
});
