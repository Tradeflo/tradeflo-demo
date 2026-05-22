-- Tradeflo AI — SRS M4 / privacy policy §8: 90-day retention after subscription cancel.
-- Apply in Supabase after db/milestone3_user_info.sql (or any user_info chain).
-- Cron job calls `/api/cron/data-retention-purge` with secret to purge due users.

alter table public.user_info
  add column if not exists data_retention_purge_after_at timestamptz;

comment on column public.user_info.data_retention_purge_after_at is
  'When Stripe ends the subscription (`customer.subscription.deleted`), set to now()+90 days. '
  'Secured purge job removes AI/work-log + quote payloads: materials_catalog_gaps, work_logs, '
  'work-logs storage, quotes (quote_versions cascade); clears this deadline & work_logs_uploaded '
  '(see src/lib/data-retention/purge-cancelled-contractors.ts).';

create index if not exists user_info_data_retention_purge_after_idx
  on public.user_info (data_retention_purge_after_at asc)
  where data_retention_purge_after_at is not null;
