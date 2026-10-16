import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(__dirname, '../20261016110000_marketplace_nearby_discovery.sql');

describe('marketplace nearby discovery migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('keeps coarse member and listing geography private', () => {
    expect(sql).toContain('create extension if not exists postgis');
    expect(sql).toContain('create table private.marketplace_member_locations');
    expect(sql).toContain('create table private.marketplace_listing_locations');
    expect(sql).toContain('geography(point, 4326)');
    expect(sql).toContain('revoke all on private.marketplace_member_locations');
    expect(sql).toContain('revoke all on private.marketplace_listing_locations');
  });

  it('quantizes coordinates before storage and removes them with the profile', () => {
    expect(sql).toContain('round(p_latitude::numeric, 2)');
    expect(sql).toContain('round(p_longitude::numeric, 2)');
    expect(sql).toMatch(/marketplace_member_locations[\s\S]*user_id uuid[\s\S]*on delete cascade/);
    expect(sql).toMatch(/marketplace_listing_locations[\s\S]*seller_user_id uuid[\s\S]*on delete cascade/);
  });

  it('exposes authenticated lifecycle and nearby RPCs without raw coordinates', () => {
    expect(sql).toContain('public.marketplace_set_discovery_location');
    expect(sql).toContain('public.marketplace_clear_discovery_location');
    expect(sql).toContain('public.marketplace_listings_nearby');
    expect(sql).toContain('extensions.st_dwithin');
    expect(sql).toContain("interval '90 days'");
    expect(sql).toMatch(/grant execute on function public\.marketplace_listings_nearby[\s\S]*to authenticated/);
    expect(sql).not.toMatch(/returns table \([\s\S]*latitude/);
    expect(sql).not.toMatch(/returns table \([\s\S]*longitude/);
  });
});
