import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(__dirname, '../20261016020000_service_role_admin_grants.sql'),
  'utf8',
).toLowerCase();

describe('service-role administration grants migration', () => {
  it('restores server-only public schema, table, and sequence privileges', () => {
    expect(sql).toContain('grant usage on schema public to service_role');
    expect(sql).toContain('grant all privileges on all tables in schema public to service_role');
    expect(sql).toContain('grant all privileges on all sequences in schema public to service_role');
  });

  it('does not widen anonymous or authenticated grants', () => {
    expect(sql).not.toMatch(/grant[\s\S]*\bto\s+(?:anon|authenticated)\b/);
  });
});
