do $$
begin
  create type public.user_info_role as enum ('contractor', 'admin');
exception
  when duplicate_object then
    null;
end $$;

do $$
declare
  dtype text;
begin
  select c.data_type::text
    into dtype
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'user_info'
    and c.column_name = 'role';

  if dtype is null then
    alter table public.user_info
      add column role public.user_info_role not null
        default 'contractor'::public.user_info_role;
    return;
  end if;

  if dtype = 'USER-DEFINED' then
    return;
  end if;

  if dtype in ('text', 'character varying') then
    drop trigger if exists user_info_block_role_for_authenticated
      on public.user_info;

    drop policy if exists "Users can insert own user_info"
      on public.user_info;

    alter table public.user_info
      drop constraint if exists user_info_role_check;

    alter table public.user_info
      alter column role drop default;

    alter table public.user_info
      alter column role type public.user_info_role
      using (
        case
          when trim(role::text) = 'admin'
            then 'admin'::public.user_info_role
          else 'contractor'::public.user_info_role
        end
      );

    alter table public.user_info
      alter column role set default 'contractor'::public.user_info_role;

    alter table public.user_info
      alter column role set not null;
  end if;
end $$;

comment on type public.user_info_role is
  'SRS: contractor (default), admin (Tradeflo operator; app-enforced privileges).';

comment on column public.user_info.role is
  'contractor — default; admin — /admin tools and bypasses billing/AI limits (enforced in app + API).';

-- Self-service signups cannot pick admin via the API.
drop policy if exists "Users can insert own user_info" on public.user_info;
create policy "Users can insert own user_info"
  on public.user_info for insert
  with check (auth.uid() = id and role = 'contractor'::public.user_info_role);

-- Block role changes except from postgres / service_role (SQL editor, service key).
create or replace function public.user_info_enforce_role_immutable_for_authenticated()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.role is distinct from new.role then
    if current_user in ('service_role', 'postgres') then
      return new;
    end if;
    raise exception 'role cannot be changed from the client API';
  end if;
  return new;
end;
$$;

drop trigger if exists user_info_block_role_for_authenticated on public.user_info;

create trigger user_info_block_role_for_authenticated
  before update on public.user_info
  for each row
  execute function public.user_info_enforce_role_immutable_for_authenticated();
