-- Tradeflo AI — SRS §4.7: 20 AI quote generations per user per calendar day (UTC)
-- Apply after db/user_info.sql (and db/onboarding.sql if you use it).
-- Required for POST /api/quote/generate rate limiting.

alter table public.user_info
  add column if not exists quote_ai_daily_count int not null default 0;

alter table public.user_info
  add column if not exists quote_ai_daily_reset date;

comment on column public.user_info.quote_ai_daily_count is 'AI /quote/generate calls consumed for quote_ai_daily_reset (UTC day).';
comment on column public.user_info.quote_ai_daily_reset is 'UTC date when quote_ai_daily_count applies; rolls forward at UTC midnight.';

create or replace function public.consume_quote_ai_generation(
  p_user_id uuid,
  p_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_day date;
  v_today date := (timezone('utc', now()))::date;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_limit < 1 then
    p_limit := 20;
  end if;

  select quote_ai_daily_count, quote_ai_daily_reset
    into v_count, v_day
  from public.user_info
  where id = p_user_id
  for update;

  if not found then
    insert into public.user_info (
      id,
      quote_ai_daily_count,
      quote_ai_daily_reset
    )
    values (p_user_id, 1, v_today);
    return jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'limit', p_limit
    );
  end if;

  if v_day is null or v_day < v_today then
    v_count := 0;
  end if;

  if v_count >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'limit', p_limit
    );
  end if;

  update public.user_info
  set
    quote_ai_daily_count = v_count + 1,
    quote_ai_daily_reset = v_today,
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - (v_count + 1),
    'limit', p_limit
  );
end;
$$;

revoke all on function public.consume_quote_ai_generation(uuid, int) from public;
grant execute on function public.consume_quote_ai_generation(uuid, int) to authenticated;
