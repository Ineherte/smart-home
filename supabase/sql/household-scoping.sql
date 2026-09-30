-- Aislamiento por hogar y por persona. Ejecutar DESPUÉS de security-fixes.sql.
-- Es idempotente: se puede ejecutar varias veces.

-- 1. Pizarra: shared_drawing era una única fila global (id = 1) que cualquier
--    cuenta registrada podía leer y sobrescribir. Ahora hay una por hogar.
create table if not exists public.household_drawings (
  household_id uuid primary key references public.households(id) on delete cascade,
  strokes jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.household_drawings enable row level security;
drop policy if exists "Read household drawing" on public.household_drawings;
drop policy if exists "Create household drawing" on public.household_drawings;
drop policy if exists "Update household drawing" on public.household_drawings;
create policy "Read household drawing" on public.household_drawings for select to authenticated using (public.is_household_member(household_id));
create policy "Create household drawing" on public.household_drawings for insert to authenticated with check (public.is_household_member(household_id));
create policy "Update household drawing" on public.household_drawings for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
alter table public.household_drawings replica identity full;

-- La pizarra antigua ya no la usa la app: se cierra (no se borra, por si quieres
-- recuperar el dibujo). Si nunca llegaste a crearla, no se hace nada.
do $$
begin
  if to_regclass('public.shared_drawing') is not null then
    drop policy if exists "Leer pizarra compartida" on public.shared_drawing;
    drop policy if exists "Actualizar pizarra compartida" on public.shared_drawing;
    drop policy if exists "Modificar pizarra compartida" on public.shared_drawing;
  end if;
end $$;

-- 2. Eventos del iPhone: la política comparaba `owner` con user_metadata.name,
--    que cada usuario puede cambiar a su gusto (bastaba llamarse "Matteo" para
--    leer sus eventos). Ahora cada evento pertenece a un user_id.
--    Si la tabla iphone_events no existe (no usas la sincronización), no se hace nada.
do $$
begin
  if to_regclass('public.iphone_events') is null then
    return;
  end if;

  alter table public.iphone_events add column if not exists owner_id uuid references auth.users(id) on delete cascade;

  -- Rellena owner_id en los eventos existentes solo cuando el nombre corresponde a un único perfil.
  update public.iphone_events as event
  set owner_id = profile.id
  from public.profiles as profile
  where event.owner_id is null
    and profile.display_name = event.owner
    and (select count(*) from public.profiles as other where other.display_name = event.owner) = 1;

  drop policy if exists "Leer propios eventos del iPhone" on public.iphone_events;
  drop policy if exists "Eliminar propios eventos del iPhone" on public.iphone_events;
  drop policy if exists "Read own iPhone events" on public.iphone_events;
  drop policy if exists "Delete own iPhone events" on public.iphone_events;
  create policy "Read own iPhone events" on public.iphone_events for select to authenticated using (owner_id = auth.uid());
  create policy "Delete own iPhone events" on public.iphone_events for delete to authenticated using (owner_id = auth.uid());
end $$;

-- 3. Importaciones sin duplicados: la app usa source_reference para ignorar
--    gastos ya importados. Si este índice falla por duplicados, ejecuta antes
--    finance-dedupe-tricount.sql.
create unique index if not exists shared_expenses_tricount_reference_idx
  on public.shared_expenses (source_reference);

-- 4. Tiempo real: la app escucha cambios en estas tablas.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['household_drawings', 'shared_expenses', 'shared_bills', 'shared_fixed_costs', 'shared_settlements', 'events', 'notes']
  loop
    if to_regclass('public.' || table_name) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
