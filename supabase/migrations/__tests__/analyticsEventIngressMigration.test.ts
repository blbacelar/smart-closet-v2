import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(__dirname, '../20261016121000_analytics_event_ingress.sql');

describe('analytics event ingress migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('removes direct member writes and exposes only a validating RPC', () => {
    expect(sql).toContain('revoke insert on public.analytics_events from authenticated');
    expect(sql).toContain('drop policy if exists "members_insert_own_analytics_events"');
    expect(sql).toContain('public.record_analytics_event');
    expect(sql).toContain('private.analytics_properties_valid');
    expect(sql).toContain('grant execute on function public.record_analytics_event');
  });

  it('uses exact per-event property and value allowlists', () => {
    expect(sql).toContain("p_event_name = 'app_opened'");
    expect(sql).toContain("p_properties ->> 'source' in ('launch', 'resume')");
    expect(sql).toContain("p_event_name = 'app_error'");
    expect(sql).toContain("p_properties ->> 'operation' in");
    expect(sql).toContain("p_properties ->> 'code' in");
    expect(sql).toContain("jsonb_typeof(p_properties -> 'fatal') = 'boolean'");
  });
});
