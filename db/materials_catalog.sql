-- Tradeflo AI — reference table public.materials_catalog (Milestone 3)

create table if not exists public.materials_catalog (
  id uuid primary key default gen_random_uuid(),
  trade text not null,
  material_key text not null,
  display_name text not null,
  description text,
  unit text,
  base_retail_price numeric(12, 2) not null,
  currency text not null default 'CAD',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_catalog_base_price_check check (base_retail_price >= 0),
  constraint materials_catalog_trade_material_key unique (trade, material_key)
);

comment on table public.materials_catalog is
  'SRS M3: maintained reference retail prices per trade; lookup + contractor markup in quote generation.';

create index if not exists materials_catalog_trade_active_idx
  on public.materials_catalog (trade)
  where is_active = true;

create or replace function public.materials_catalog_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists materials_catalog_set_updated_at on public.materials_catalog;
create trigger materials_catalog_set_updated_at
  before update on public.materials_catalog
  for each row
  execute function public.materials_catalog_touch_updated_at();

alter table public.materials_catalog enable row level security;

drop policy if exists "Authenticated read active materials_catalog"
  on public.materials_catalog;
create policy "Authenticated read active materials_catalog"
  on public.materials_catalog for select
  to authenticated
  using (is_active = true);


