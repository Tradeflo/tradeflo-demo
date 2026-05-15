-- Customer message on "request changes" (token flow). Not part of immutable payload JSON.
alter table public.quote_versions
  add column if not exists approval_customer_message text;

comment on column public.quote_versions.approval_customer_message is
  'Optional note from customer when using approval link to request changes (M3).';
