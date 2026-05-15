-- Tradeflo AI — contractor labour defaults + per-quote audit (M3)
-- Labour line items live in quote_versions.payload.lines JSON with kind="labor".
-- Apply after db/milestone3_user_info.sql.

alter table public.user_info
  add column if not exists default_labour_rate numeric(12, 2);

alter table public.user_info
  add column if not exists default_labour_rate_unit text;

alter table public.user_info drop constraint if exists user_info_default_labour_rate_nonneg;
alter table public.user_info add constraint user_info_default_labour_rate_nonneg
  check (default_labour_rate is null or default_labour_rate >= 0);

alter table public.user_info drop constraint if exists user_info_default_labour_rate_unit_check;
alter table public.user_info add constraint user_info_default_labour_rate_unit_check
  check (
    default_labour_rate_unit is null
    or default_labour_rate_unit in ('hour', 'day', 'flat')
  );

comment on column public.user_info.default_labour_rate is
  'Contractor default labour rate (CAD); onboarding capture; used for labour line pricing.';
comment on column public.user_info.default_labour_rate_unit is
  'Unit for default_labour_rate: hour | day | flat. Null until contractor saves profile.';

alter table public.quote_versions
  add column if not exists labour_rate_applied numeric(12, 2);

alter table public.quote_versions
  add column if not exists labour_rate_unit text;

alter table public.quote_versions drop constraint if exists quote_versions_labour_rate_nonneg;
alter table public.quote_versions add constraint quote_versions_labour_rate_nonneg
  check (labour_rate_applied is null or labour_rate_applied >= 0);

alter table public.quote_versions drop constraint if exists quote_versions_labour_rate_unit_check;
alter table public.quote_versions add constraint quote_versions_labour_rate_unit_check
  check (
    labour_rate_unit is null
    or labour_rate_unit in ('hour', 'day', 'flat')
  );

comment on column public.quote_versions.labour_rate_applied is
  'Audit: labour rate snapshot applied when this version was finalized/generated.';
comment on column public.quote_versions.labour_rate_unit is
  'Audit: labour_rate_applied unit (hour | day | flat).';
