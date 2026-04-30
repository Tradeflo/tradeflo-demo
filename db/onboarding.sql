-- Tradeflo AI — onboarding + work logs (SRS §4.12, §4.5 — Milestone 2)
-- Apply after db/user_info.sql.
-- AI rate limits (SRS §4.7): db/quote_ai_rate_limit.sql
-- Creates private Storage bucket "work-logs" (run in Supabase SQL Editor as postgres if needed).

-- ---- user_info: onboarding fields -------------------------------------------

alter table public.user_info
  add column if not exists hst_number text;

alter table public.user_info
  add column if not exists onboarding_skip_work_logs boolean not null default false;

alter table public.user_info
  add column if not exists onboarding_completed boolean not null default false;

alter table public.user_info
  add column if not exists onboarding_completed_at timestamptz;

alter table public.user_info
  add column if not exists work_logs_uploaded boolean not null default false;

comment on column public.user_info.hst_number is 'Business / HST from onboarding; optional.';
comment on column public.user_info.onboarding_skip_work_logs is 'User skipped work-history step; SRS allows skip.';
comment on column public.user_info.onboarding_completed is 'User finished onboarding flow.';
comment on column public.user_info.work_logs_uploaded is 'True once at least one work log file was stored (SRS §4.5).';

-- ---- work_logs: uploaded files + extracted text -----------------------------

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size_bytes int not null,
  file_type text,
  processing_status text not null default 'pending'
    constraint work_logs_processing_status_check
      check (processing_status in ('pending', 'processing', 'complete', 'failed')),
  raw_text text,
  processing_error text,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists work_logs_user_id_uploaded_at_idx
  on public.work_logs (user_id, uploaded_at desc);

comment on table public.work_logs is 'SRS §4.5 — work history extracted text for AI input; user-scoped.';

alter table public.work_logs enable row level security;

drop policy if exists "Users read own work_logs" on public.work_logs;
create policy "Users read own work_logs"
  on public.work_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own work_logs" on public.work_logs;
create policy "Users insert own work_logs"
  on public.work_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own work_logs" on public.work_logs;
create policy "Users update own work_logs"
  on public.work_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own work_logs" on public.work_logs;
create policy "Users delete own work_logs"
  on public.work_logs for delete
  using (auth.uid() = user_id);

-- ---- Storage bucket (private) ----------------------------------------------

insert into storage.buckets (id, name, public)
values ('work-logs', 'work-logs', false)
on conflict (id) do nothing;

drop policy if exists "work_logs_storage_insert_own" on storage.objects;
create policy "work_logs_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'work-logs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "work_logs_storage_select_own" on storage.objects;
create policy "work_logs_storage_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'work-logs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "work_logs_storage_update_own" on storage.objects;
create policy "work_logs_storage_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'work-logs'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'work-logs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "work_logs_storage_delete_own" on storage.objects;
create policy "work_logs_storage_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'work-logs'
    and split_part(name, '/', 1) = auth.uid()::text
  );
