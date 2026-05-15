create table if not exists public.materials_catalog_gaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  contractor_trade text,
  job_type text,
  line_description text not null,
  catalog_category text,
  created_at timestamptz not null default now(),
  constraint materials_catalog_gaps_line_len check (
    length(line_description) between 1 and 2000
  )
);

comment on table public.materials_catalog_gaps is
  'Rows inserted when AI returns a material line with source=estimated; used for catalog expansion (admin-only reads via service role).';

create index if not exists materials_catalog_gaps_created_at_idx
  on public.materials_catalog_gaps (created_at desc);

create index if not exists materials_catalog_gaps_trade_desc_idx
  on public.materials_catalog_gaps (
    contractor_trade,
    lower(line_description)
  );

alter table public.materials_catalog_gaps enable row level security;
