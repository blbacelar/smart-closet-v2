-- Persist first-run onboarding across devices without granting members access to
-- subscription tier or other server-managed profile fields.
-- Rollback: create a forward migration that removes onboarding_completed_at and
-- restores the previous display_name/region column grant.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

revoke update on table public.profiles from authenticated;
grant update(display_name, region, onboarding_completed_at)
  on table public.profiles to authenticated;
