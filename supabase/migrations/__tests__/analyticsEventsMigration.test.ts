import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20261001160000_analytics_events.sql',
);

describe('analytics events migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('allows only the product funnel taxonomy and bounded properties', () => {
    expect(sql).toContain('create table if not exists public.analytics_events');
    expect(sql).toContain("'onboarding_completed'");
    expect(sql).toContain("'tryon_completed'");
    expect(sql).toContain("'paywall_viewed'");
    expect(sql).toContain("jsonb_typeof(properties) = 'object'");
    expect(sql).toContain('pg_column_size(properties) <= 4096');
  });

  it('lets authenticated members insert only their own events without reading them', () => {
    expect(sql).toContain('alter table public.analytics_events enable row level security');
    expect(sql).toContain('user_id = (select auth.uid())');
    expect(sql).toContain('grant insert(user_id, event_name, properties)');
    expect(sql).not.toMatch(/grant select[^;]+to authenticated/);
  });

  it('purges events after 90 days', () => {
    expect(sql).toContain('private.purge_expired_analytics_events');
    expect(sql).toContain("interval '90 days'");
    expect(sql).toContain("'fitly-analytics-retention'");
  });

  it('provides only aggregate funnel counts to the service role', () => {
    expect(sql).toContain('public.get_analytics_funnel');
    expect(sql).toContain('count(*) as event_count');
    expect(sql).toContain('count(distinct events.user_id) as unique_members');
    expect(sql).toContain('p_to - p_from > interval \'366 days\'');
    expect(sql).toContain('grant execute on function public.get_analytics_funnel(timestamptz, timestamptz) to service_role');
    expect(sql).not.toMatch(/grant execute on function public\.get_analytics_funnel[^;]+to authenticated/);
  });
});
