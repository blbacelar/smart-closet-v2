-- Analytics events are accepted only through a server-validated RPC. This
-- prevents a modified client from bypassing the mobile privacy allowlist.

create or replace function private.analytics_properties_valid(
  p_event_name text,
  p_properties jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_properties) = 'object'
    and pg_column_size(p_properties) <= 4096
    and case
      when p_event_name = 'app_opened' then
        (p_properties - 'source') = '{}'::jsonb
        and (
          not (p_properties ? 'source')
          or p_properties ->> 'source' in ('launch', 'resume')
        )
      when p_event_name in ('auth_signed_in', 'auth_signed_up') then
        (p_properties - 'method') = '{}'::jsonb
        and p_properties ->> 'method' in ('email', 'apple', 'google')
      when p_event_name = 'body_photo_uploaded' then
        p_properties = '{"source":"capture_flow"}'::jsonb
      when p_event_name = 'garment_uploaded' then
        (p_properties - 'categoryMode') = '{}'::jsonb
        and p_properties ->> 'categoryMode' in ('manual', 'automatic')
      when p_event_name = 'tryon_requested' then
        (p_properties - 'cached') = '{}'::jsonb
        and jsonb_typeof(p_properties -> 'cached') = 'boolean'
      when p_event_name = 'tryon_completed' then
        (p_properties - 'provider') = '{}'::jsonb
        and p_properties ->> 'provider' in ('gemini', 'unknown')
      when p_event_name = 'paywall_viewed' then
        (p_properties - 'source') = '{}'::jsonb
        and p_properties ->> 'source' in ('quota', 'profile', 'unknown')
      when p_event_name in (
        'onboarding_completed', 'subscription_purchase_started', 'account_deleted'
      ) then p_properties = '{}'::jsonb
      when p_event_name = 'app_error' then
        (p_properties - 'name' - 'operation' - 'code' - 'fatal') = '{}'::jsonb
        and p_properties ->> 'name' in (
          'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'UnknownError'
        )
        and p_properties ->> 'operation' in (
          'react_render', 'auth_session_restore', 'tryon_enqueue',
          'notification_registration_refresh', 'render'
        )
        and p_properties ->> 'code' in (
          'unexpected_render_error', 'session_restore_failed',
          'notification_registration_refresh_failed', 'request_failed', 'unexpected'
        )
        and jsonb_typeof(p_properties -> 'fatal') = 'boolean'
      else false
    end;
$$;

create or replace function public.record_analytics_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_properties jsonb := coalesce(p_properties, '{}'::jsonb);
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if private.analytics_properties_valid(p_event_name, v_properties) is not true then
    raise invalid_parameter_value using message = 'Invalid analytics event properties';
  end if;
  insert into public.analytics_events (user_id, event_name, properties)
  values (v_user_id, p_event_name, v_properties);
end;
$$;

drop policy if exists "members_insert_own_analytics_events" on public.analytics_events;
revoke insert(user_id, event_name, properties) on public.analytics_events from authenticated;
revoke insert on public.analytics_events from authenticated;
revoke all on function private.analytics_properties_valid(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_analytics_event(text, jsonb)
  from public, anon;
grant execute on function public.record_analytics_event(text, jsonb) to authenticated;

comment on function public.record_analytics_event(text, jsonb) is
  'Consent-gated client ingress with exact event/property/value allowlists.';
