-- Tradeflo AI — Milestone 3 extensions to public.user_info
-- Apply after db/onboarding.sql (db/user_info.sql chain).
-- SRS §4.9 Stripe; M3 contractor markup % + billing/grace/read-only flags.

-- Materials markup %
alter table public.user_info
  add column if not exists materials_markup_percent numeric(6, 2);

comment on column public.user_info.materials_markup_percent is
  'Default materials markup % applied to reference DB prices; onboarding capture (M3). Null = use app default until set.';

alter table public.user_info drop constraint if exists user_info_materials_markup_percent_check;
alter table public.user_info add constraint user_info_materials_markup_percent_check
  check (
    materials_markup_percent is null
    or (materials_markup_percent >= 0 and materials_markup_percent <= 500)
  );

-- Billing / subscription (Stripe + grace + read-only)
alter table public.user_info
  add column if not exists stripe_customer_id text;

alter table public.user_info
  add column if not exists stripe_subscription_id text;

alter table public.user_info
  add column if not exists billing_subscription_status text not null default 'none';

alter table public.user_info drop constraint if exists user_info_billing_subscription_status_check;
alter table public.user_info add constraint user_info_billing_subscription_status_check
  check (
    billing_subscription_status in (
      'none',
      'active',
      'trialing',
      'past_due',
      'unpaid',
      'canceled',
      'incomplete',
      'incomplete_expired'
    )
  );

alter table public.user_info
  add column if not exists billing_grace_period_ends_at timestamptz;

alter table public.user_info
  add column if not exists billing_read_only boolean not null default false;

comment on column public.user_info.stripe_customer_id is 'Stripe Customer id (cus_...).';
comment on column public.user_info.stripe_subscription_id is 'Stripe Subscription id (sub_...), if any.';
comment on column public.user_info.billing_subscription_status is 'Mirror of subscription state; refined by webhooks (M3).';
comment on column public.user_info.billing_grace_period_ends_at is
  'SRS: after failed payment; read-only enforcement after this instant (M3). Null = not in grace.';
comment on column public.user_info.billing_read_only is
  'SRS: after grace lapses; API should block mutating actions (M3 enforcement).';

create unique index if not exists user_info_stripe_customer_id_key
  on public.user_info (stripe_customer_id)
  where stripe_customer_id is not null;
