import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  __dirname,
  '../20261016060000_account_deletion_tombstone.sql',
);

describe('marketplace-aware account deletion migration', () => {
  const migration = () => fs.readFileSync(migrationPath, 'utf8');

  it('creates a restricted tombstone and durable purge checkpoints', () => {
    const sql = migration();

    expect(sql).toContain('create table private.account_deletion_requests');
    expect(sql).toContain('create table private.account_deletion_checkpoints');
    expect(sql).toMatch(/revoke all on private\.account_deletion_requests from public, anon, authenticated/i);
    expect(sql).toContain("'deletion-v1-gate-b-pending'");
  });

  it('blocks personal and marketplace writes after deletion starts', () => {
    const sql = migration();

    expect(sql).toContain('private.account_deletion_reject_write');
    expect(sql).toContain('Account deletion in progress');
    expect(sql).toMatch(/create trigger account_deletion_write_barrier[\s\S]*public\.garments/i);
    expect(sql).toMatch(/create trigger account_deletion_write_barrier[\s\S]*private\.marketplace_ledger_journals/i);
    expect(sql).toMatch(/create trigger account_deletion_storage_write_barrier[\s\S]*storage\.objects/i);
    expect(sql).toMatch(/create policy "private_source_image_insert"[\s\S]*account_deletion_write_allowed/i);
    expect(sql).toMatch(/marketplace_can_read_garment_object[\s\S]*account_deletion_active_request/i);
    expect(sql).toContain('private.account_deletion_lock_subjects');
    expect(sql).toMatch(/create trigger account_deletion_write_barrier[\s\S]*public\.analytics_events/i);
  });

  it('exposes only service-role orchestration and completes from auth deletion', () => {
    const sql = migration();

    expect(sql).toContain('public.account_deletion_start');
    expect(sql).toContain('public.account_deletion_mark_storage_step');
    expect(sql).toContain('public.account_deletion_purge_database');
    expect(sql).toContain('private.complete_account_deletion_after_auth_delete');
    expect(sql).toContain('private.guard_account_deletion_before_auth_delete');
    expect(sql).toMatch(/create trigger guard_account_deletion_before_auth_delete[\s\S]*before delete on auth\.users/i);
    expect(sql).toMatch(/guard_account_deletion_before_auth_delete[\s\S]*set_config\('app\.account_deletion_request_id'/i);
    expect(sql).toMatch(/guard_account_deletion_before_auth_delete[\s\S]*set_config\('app\.account_deletion_internal_cleanup'/i);
    expect(sql).toMatch(/grant execute on function public\.account_deletion_start\(uuid\) to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.account_deletion_start\(uuid\) from public, anon, authenticated/i);
  });

  it('detaches retained records while removing discoverable personal content', () => {
    const sql = migration();

    expect(sql).toMatch(/alter table public\.marketplace_listings[\s\S]*alter column garment_id drop not null/i);
    expect(sql).toContain("pickup_area = 'Deleted account'");
    expect(sql).toContain('delete from public.marketplace_messages');
    expect(sql).toContain('delete from public.tryon_jobs');
    expect(sql).toContain('delete from public.body_photos');
    expect(sql).toContain('delete from public.garments');
    expect(sql).toContain('delete from public.analytics_events');
    expect(sql).toMatch(/marketplace_my_transactions[\s\S]*left join public\.garments/i);
    expect(sql).toMatch(/marketplace_my_transactions[\s\S]*marketplace_party_matches/i);
    expect(sql).toContain('app.account_deletion_internal_cleanup');
  });
});
