-- Arregla las políticas de hogares, miembros e invitaciones. Ejecutar después de
-- supabase-foundation.sql y supabase-members.sql. Es idempotente.
--
-- Problemas que corrige:
-- 1. "Manage members as owner" consultaba household_members dentro de una política
--    de household_members: Postgres respondía "infinite recursion detected in policy"
--    a cualquier lectura de miembros, así que la app nunca encontraba el hogar y
--    todo lo compartido (notas, eventos, finanzas) fallaba al guardarse.
-- 2. Al crear un hogar, la app no podía leer la fila recién creada (aún no era
--    miembro), y la política del primer propietario tampoco podía comprobar quién
--    había creado el hogar.
-- Las comprobaciones pasan a funciones SECURITY DEFINER, que no reactivan RLS.

create or replace function public.is_household_owner(target_household uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role = 'owner'
  );
$$;
revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_owner(uuid) to authenticated;

create or replace function public.created_household(target_household uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.households where id = target_household and created_by = auth.uid());
$$;
revoke all on function public.created_household(uuid) from public;
grant execute on function public.created_household(uuid) to authenticated;

-- Hogares: quien lo crea puede leerlo aunque todavía no sea miembro.
drop policy if exists "Read member households" on public.households;
create policy "Read member households" on public.households for select to authenticated
  using (public.is_household_member(id) or created_by = auth.uid());

-- Miembros.
drop policy if exists "Manage members as owner" on public.household_members;
drop policy if exists "Create first household owner" on public.household_members;
drop policy if exists "Owners add members" on public.household_members;
drop policy if exists "Owners update members" on public.household_members;
drop policy if exists "Owners remove members" on public.household_members;
create policy "Create first household owner" on public.household_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'owner' and public.created_household(household_id));
create policy "Owners add members" on public.household_members for insert to authenticated
  with check (public.is_household_owner(household_id));
create policy "Owners update members" on public.household_members for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "Owners remove members" on public.household_members for delete to authenticated
  using (public.is_household_owner(household_id));

-- Invitaciones (solo si existe la tabla de supabase-members.sql).
do $$
begin
  if to_regclass('public.household_invites') is not null then
    drop policy if exists "Owners read household invites" on public.household_invites;
    drop policy if exists "Owners create household invites" on public.household_invites;
    create policy "Owners read household invites" on public.household_invites for select to authenticated
      using (public.is_household_owner(household_id));
    create policy "Owners create household invites" on public.household_invites for insert to authenticated
      with check (created_by = auth.uid() and public.is_household_owner(household_id));
  end if;
end $$;
