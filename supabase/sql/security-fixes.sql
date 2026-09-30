-- Correcciones de seguridad. Ejecutar DESPUÉS de supabase-foundation.sql y
-- supabase-access-hardening.sql. Es idempotente: se puede ejecutar varias veces.
--
-- En Postgres las políticas RLS permisivas se combinan con OR: si queda una
-- política antigua abierta, las políticas nuevas por hogar no sirven de nada.

-- 1. Eventos: events-schema.sql creó políticas que supabase-foundation.sql no
--    borra (borra "Read events", pero la original se llama "Read shared or own
--    events"). Con ellas, cualquier cuenta registrada, de cualquier hogar, puede
--    leer los eventos compartidos de todos los hogares.
drop policy if exists "Read shared or own events" on public.events;
drop policy if exists "Create events for self" on public.events;
drop policy if exists "Delete own events" on public.events;

-- Además, "Read household events" deja ver los eventos privados de la otra
-- persona del hogar. Se restringe igual que las notas.
drop policy if exists "Read household events" on public.events;
create policy "Read household events" on public.events for select to authenticated
  using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));

drop policy if exists "Update household events" on public.events;
create policy "Update household events" on public.events for update to authenticated
  using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  with check (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));

drop policy if exists "Delete household events" on public.events;
create policy "Delete household events" on public.events for delete to authenticated
  using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));

-- 2. device_state: device-state.sql permitía a cualquiera (incluso sin sesión)
--    insertar y modificar el estado de los dispositivos. La Edge Function
--    tuya-lights escribe con la service role key, que ignora RLS, así que no
--    hace falta ninguna política de escritura.
do $$
begin
  if to_regclass('public.device_state') is not null then
    drop policy if exists "public write device_state" on public.device_state;
    drop policy if exists "public update device_state" on public.device_state;
    drop policy if exists "public read device_state" on public.device_state;
    drop policy if exists "Read device_state" on public.device_state;
    create policy "Read device_state" on public.device_state for select to authenticated using (true);
  end if;
end $$;
