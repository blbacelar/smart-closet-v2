-- Restore the standard server-only administration boundary after explicit
-- client grants removed Data API privileges inherited by `service_role`.
-- The service-role key must remain server-side; RLS still governs anon and
-- authenticated members.
-- Rollback: revoke these grants from service_role in a forward migration only
-- after every server worker and staging seed has moved behind security-definer
-- functions with equivalent access.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
