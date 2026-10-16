import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(__dirname, '../20261016100000_notification_infrastructure.sql');

describe('notification infrastructure migration', () => {
  const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

  it('keeps tokens, payloads and provider state private', () => {
    expect(sql).toContain('create table private.notification_push_tokens');
    expect(sql).toContain('create table private.notification_outbox');
    expect(sql).toContain('create table private.notification_deliveries');
    expect(sql).toContain('revoke all on private.notification_push_tokens');
    expect(sql).toContain('revoke all on private.notification_outbox');
  });

  it('exposes owner-only lifecycle functions and service-only worker functions', () => {
    expect(sql).toContain('public.register_push_token');
    expect(sql).toContain('public.disable_push_installation');
    expect(sql).toMatch(/grant execute on function public\.register_push_token[\s\S]*to authenticated/);
    expect(sql).toMatch(/grant execute on function public\.notification_claim_outbox[\s\S]*to service_role/);
    expect(sql).toMatch(/revoke all on function public\.notification_claim_outbox[\s\S]*from public, anon, authenticated/);
  });

  it('owns idempotency, lease recovery, bounded retries and immutable event payloads', () => {
    expect(sql).toContain('event_key text not null unique');
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain('lease_until');
    expect(sql).toContain('attempts >= 0 and attempts <= 5');
    expect(sql).toContain('notification_outbox_immutable_event');
    expect(sql).toContain('unique (outbox_id, token_id)');
  });

  it('disables tokens as soon as account deletion starts', () => {
    expect(sql).toContain('notification_disable_for_account_deletion');
    expect(sql).toContain('account_deletion_requests');
    expect(sql).toMatch(/notification_enqueue[\s\S]*account_deletion_lock_subjects/);
  });
});
