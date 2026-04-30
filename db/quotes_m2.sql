-- Tradeflo AI — Milestone 2: per-version status, approval token columns, immutability
-- Apply once after db/quotes.sql. See docs/MILESTONE_2_SCHEMA.md.

alter table public.quote_versions
  add column if not exists status text not null default 'draft';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quote_versions_status_check'
      and conrelid = 'public.quote_versions'::regclass
  ) then
    alter table public.quote_versions
      add constraint quote_versions_status_check
        check (status in ('draft', 'sent', 'approved', 'changes_requested'));
  end if;
end $$;

alter table public.quote_versions
  add column if not exists sent_at timestamptz;

alter table public.quote_versions
  add column if not exists approval_token text;

alter table public.quote_versions
  add column if not exists approval_token_expires_at timestamptz;

alter table public.quote_versions
  add column if not exists approval_token_consumed_at timestamptz;

create unique index if not exists quote_versions_approval_token_uidx
  on public.quote_versions (approval_token)
  where approval_token is not null;

create index if not exists quote_versions_quote_id_status_idx
  on public.quote_versions (quote_id, status);

comment on table public.quotes is
  'Quote thread per user; status mirrors head quote_versions row (current_version).';

comment on table public.quote_versions is
  'Per-version snapshot in payload. Non-draft rows: payload/quote_id/version_number immutable.';

create or replace function public.quote_versions_block_immutable_content_change()
returns trigger
language plpgsql
as $fn$
begin
  if old.status is distinct from 'draft' then
    if new.payload is distinct from old.payload
      or new.version_number is distinct from old.version_number
      or new.quote_id is distinct from old.quote_id
    then
      raise exception
        'quote_versions: cannot change immutable fields on status %',
        old.status;
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists quote_versions_block_immutable_content on public.quote_versions;
create trigger quote_versions_block_immutable_content
  before update on public.quote_versions
  for each row
  execute function public.quote_versions_block_immutable_content_change();

drop policy if exists "Users can delete quote_versions for own quotes" on public.quote_versions;
create policy "Users can delete quote_versions for own quotes"
  on public.quote_versions for delete
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_versions.quote_id and q.user_id = auth.uid()
    )
  );
