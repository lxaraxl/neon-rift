create table public.neon_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (
    char_length(nickname) between 3 and 20
    and nickname = btrim(nickname)
    and nickname !~ '[<>[:cntrl:]]'
  ),
  avatar text not null default '' check (avatar ~ '^[a-z]{0,16}$'),
  accent text not null default 'violet' check (accent in ('violet','cyan','amber'))
);
create unique index neon_nickname_ci on public.neon_profiles(lower(nickname));
alter table public.neon_profiles enable row level security;
revoke all on public.neon_profiles from anon, authenticated;
grant select, insert, update (avatar, accent) on public.neon_profiles to authenticated;
create policy neon_profile_read on public.neon_profiles for select to authenticated using (auth.uid() = id);
create policy neon_profile_create on public.neon_profiles for insert to authenticated with check (auth.uid() = id);
create policy neon_profile_edit on public.neon_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.neon_progress (
  id uuid primary key references public.neon_profiles(id) on delete cascade,
  data jsonb not null,
  revision bigint not null,
  updated_at timestamptz not null default now()
);
alter table public.neon_progress enable row level security;
revoke all on public.neon_progress from anon, authenticated;
grant select on public.neon_progress to authenticated;
create policy neon_progress_read on public.neon_progress for select to authenticated using (auth.uid() = id);

create function public.neon_save_progress(payload jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved bigint;
  owner_id uuid := auth.uid();
begin
  if owner_id is null or not exists(select 1 from public.neon_profiles where id=owner_id) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>524288 then
    raise exception 'Invalid progress' using errcode='22023';
  end if;
  if expected_revision=0 then
    insert into public.neon_progress(id,data,revision)
      values(owner_id,payload,1) on conflict(id) do nothing returning revision into saved;
  else
    update public.neon_progress set data=payload, revision=revision+1, updated_at=now()
      where id=owner_id and revision=expected_revision returning revision into saved;
  end if;
  if saved is null then raise exception 'Progress version changed' using errcode='40001'; end if;
  return saved;
end;
$$;
revoke all on function public.neon_save_progress(jsonb,bigint) from public, anon;
grant execute on function public.neon_save_progress(jsonb,bigint) to authenticated;
