create table if not exists public.device_state (
  device_id text primary key,
  kind text not null default 'light',
  status text not null default 'off',
  updated_at timestamptz not null default now()
);

alter table public.device_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_state'
      and policyname = 'public read device_state'
  ) then
    create policy "public read device_state"
      on public.device_state
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_state'
      and policyname = 'public write device_state'
  ) then
    create policy "public write device_state"
      on public.device_state
      for insert
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_state'
      and policyname = 'public update device_state'
  ) then
    create policy "public update device_state"
      on public.device_state
      for update
      using (true)
      with check (true);
  end if;
end
$$;
