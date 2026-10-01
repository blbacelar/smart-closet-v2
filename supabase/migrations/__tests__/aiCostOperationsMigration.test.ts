import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  __dirname,
  '../20260930110000_ai_cost_operations.sql',
);

describe('AI cost operations migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('provides a bounded service-role cost dashboard', () => {
    expect(sql).toContain('public.get_ai_cost_dashboard');
    expect(sql).toContain('p_days between 1 and 365');
    expect(sql).toContain('count(*) as request_count');
    expect(sql).toContain('sum(cost_usd) as cost_usd');
    expect(sql).toContain('grant execute on function public.get_ai_cost_dashboard(integer) to service_role');
    expect(sql).not.toContain('to authenticated');
  });

  it('stores warning and critical alerts behind RLS', () => {
    expect(sql).toContain('create table if not exists public.ai_cost_alerts');
    expect(sql).toContain("level text not null check (level in ('warning', 'critical'))");
    expect(sql).toContain('alter table public.ai_cost_alerts enable row level security');
    expect(sql).toContain('unique (day, level)');
  });

  it('evaluates spend hourly without sending private member data', () => {
    expect(sql).toContain('private.evaluate_ai_cost_alerts');
    expect(sql).toContain("cron.schedule(");
    expect(sql).toContain("'15 * * * *'");
    expect(sql).not.toContain('user_id, level');
  });
});
