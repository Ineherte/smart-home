-- Lavadora: «la he puesto» → aviso al terminar, aunque la app
-- esté cerrada, con un consejo para secarla dentro de casa según el tiempo de Turín.
-- Cada ciclo es una fila; la función notify-household (trabajo «appliances», cada minuto con
-- pg_cron: ver plant-reminders-cron.sql) avisa cuando acaba y, si la ropa sigue dentro, otra
-- vez a los 45 minutos.
-- Ejecutar después de supabase-foundation.sql (usa public.is_household_member). Es idempotente.

create table if not exists public.appliance_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  appliance text not null default 'lavadora' check (appliance in ('lavadora')),
  program text check (char_length(program) <= 40),
  minutes integer not null check (minutes between 5 and 600),
  started_by text check (char_length(started_by) <= 40),
  started_by_id uuid references auth.users(id) on delete set null default auth.uid(),
  -- A quién avisar: a quien la puso, a su pareja o a los dos.
  notify text not null default 'me' check (notify in ('me', 'partner', 'both')),
  ends_at timestamptz not null,
  notified_at timestamptz,
  reminded_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists appliance_runs_pending_idx on public.appliance_runs (ends_at) where finished_at is null;
create index if not exists appliance_runs_household_idx on public.appliance_runs (household_id, created_at desc);

alter table public.appliance_runs enable row level security;
alter table public.appliance_runs replica identity full;
drop policy if exists "Household members read" on public.appliance_runs;
drop policy if exists "Household members create" on public.appliance_runs;
drop policy if exists "Household members update" on public.appliance_runs;
drop policy if exists "Household members delete" on public.appliance_runs;
create policy "Household members read" on public.appliance_runs for select to authenticated using (public.is_household_member(household_id));
create policy "Household members create" on public.appliance_runs for insert to authenticated with check (public.is_household_member(household_id));
create policy "Household members update" on public.appliance_runs for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "Household members delete" on public.appliance_runs for delete to authenticated using (public.is_household_member(household_id));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appliance_runs') then
    alter publication supabase_realtime add table public.appliance_runs;
  end if;
end $$;

notify pgrst, 'reload schema';
