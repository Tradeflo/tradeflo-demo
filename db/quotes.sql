-- Tradeflo AI — quotes + draft versions (SRS §6 Milestone 1)
-- Draft create/read/update only; sent/immutable versioning is Milestone 2.
-- Apply after db/user_info.sql (same Supabase project).

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft'
    constraint quotes_status_check
      check (status in ('draft', 'sent', 'approved', 'changes_requested')),
  title text,
  current_version int not null default 1
    constraint quotes_current_version_positive check (current_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.quotes is 'M1: per-user quotes; only draft rows are API-mutable in this milestone.';

create index if not exists quotes_user_id_updated_at_idx
  on public.quotes (user_id, updated_at desc);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  version_number int not null
    constraint quote_versions_version_positive check (version_number >= 1),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_versions_quote_version_unique unique (quote_id, version_number)
);

comment on table public.quote_versions is 'M1: draft payload per quote version; JSON for quote-builder state.';

create index if not exists quote_versions_quote_id_idx
  on public.quote_versions (quote_id);

-- updated_at
create or replace function public.quotes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row
  execute function public.quotes_touch_updated_at();

create or replace function public.quote_versions_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quote_versions_set_updated_at on public.quote_versions;
create trigger quote_versions_set_updated_at
  before update on public.quote_versions
  for each row
  execute function public.quote_versions_touch_updated_at();

-- Keep quotes.updated_at in sync when draft payload changes
create or replace function public.quote_versions_bump_parent_quotes_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.quotes set updated_at = now() where id = new.quote_id;
  return new;
end;
$$;

drop trigger if exists quote_versions_bump_quotes_updated_at on public.quote_versions;
create trigger quote_versions_bump_quotes_updated_at
  after insert or update on public.quote_versions
  for each row
  execute function public.quote_versions_bump_parent_quotes_updated_at();

-- Row-Level Security
alter table public.quotes enable row level security;
alter table public.quote_versions enable row level security;

drop policy if exists "Users can read own quotes" on public.quotes;
create policy "Users can read own quotes"
  on public.quotes for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own quotes" on public.quotes;
create policy "Users can insert own quotes"
  on public.quotes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own quotes" on public.quotes;
create policy "Users can update own quotes"
  on public.quotes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read quote_versions for own quotes" on public.quote_versions;
create policy "Users can read quote_versions for own quotes"
  on public.quote_versions for select
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_versions.quote_id and q.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert quote_versions for own quotes" on public.quote_versions;
create policy "Users can insert quote_versions for own quotes"
  on public.quote_versions for insert
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_versions.quote_id and q.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update quote_versions for own quotes" on public.quote_versions;
create policy "Users can update quote_versions for own quotes"
  on public.quote_versions for update
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_versions.quote_id and q.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_versions.quote_id and q.user_id = auth.uid()
    )
  );
