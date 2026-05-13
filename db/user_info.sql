-- Tradeflo AI — user info storage (SRS §4.1 Authentication & User Management)
-- Apply in Supabase SQL Editor or via migration tooling.
-- Fields: name, business name, phone, email, location, trade — scoped by user id + RLS.

create table if not exists public.user_info (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  business_name text,
  phone text,
  email text,
  location text,
  trade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_info is 'SRS §4.1 user profile; one row per auth user.';

create index if not exists user_info_email_idx on public.user_info (email)
  where email is not null;

-- updated_at (scoped name to avoid clashing with other tables’ triggers)
create or replace function public.user_info_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_info_set_updated_at on public.user_info;
create trigger user_info_set_updated_at
  before update on public.user_info
  for each row
  execute function public.user_info_touch_updated_at();

-- Row-Level Security (SRS: all data scoped by user_id)
alter table public.user_info enable row level security;

drop policy if exists "Users can read own user_info" on public.user_info;
create policy "Users can read own user_info"
  on public.user_info for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own user_info" on public.user_info;
create policy "Users can insert own user_info"
  on public.user_info for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own user_info" on public.user_info;
create policy "Users can update own user_info"
  on public.user_info for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Optional: seed row on signup (id + email from auth; other columns null until UI collects them)
-- Milestone 2 onboarding + work_logs: db/onboarding.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_info (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
