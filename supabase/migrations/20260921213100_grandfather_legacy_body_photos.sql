begin;

-- Existing photos were accepted before automated moderation existed. Preserve
-- those users' working try-on inputs without fabricating a provider cost. Every
-- photo uploaded after this one-time statement enters through the validation
-- function added by the preceding schema migration.
update public.body_photos
set status = 'approved',
    reject_reason = null,
    validation_started_at = null,
    validation_completed_at = now(),
    validation_error = null
where status = 'pending'
  and created_at < transaction_timestamp();

commit;
