-- Muñecos de la escena: una fila por persona del hogar con su look, estado de ánimo,
-- último mensaje para el otro y último «toque» (beso, abrazo…).
-- Los dos ven ambos muñecos, pero cada uno solo puede cambiar el suyo: la fila tiene que
-- ser de su usuario y llevar su nombre de perfil (Ines o Matteo).
-- Ejecutar después de life.sql. Es idempotente.

create table if not exists public.avatars (
  household_id uuid not null references public.households(id) on delete cascade,
  person text not null check (person in ('Ines', 'Matteo')),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  look jsonb not null default '{}'::jsonb check (pg_column_size(look) < 4000),
  mood text check (char_length(mood) <= 20),
  mood_at timestamptz,
  message text check (char_length(message) <= 140),
  message_at timestamptz,
  poke text check (poke in ('kiss', 'hug', 'tickle', 'highfive')),
  poke_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, person)
);

alter table public.avatars enable row level security;
alter table public.avatars replica identity full;

-- El nombre de perfil de quien escribe (profiles.display_name).
create or replace function public.my_display_name()
returns text
language sql
stable
security definer
set search_path = public
as $$ select display_name from public.profiles where id = auth.uid() $$;

drop policy if exists "Household members read avatars" on public.avatars;
drop policy if exists "Members create own avatar" on public.avatars;
drop policy if exists "Members update own avatar" on public.avatars;
drop policy if exists "Members delete own avatar" on public.avatars;
create policy "Household members read avatars" on public.avatars for select to authenticated
  using (public.is_household_member(household_id));
create policy "Members create own avatar" on public.avatars for insert to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid() and person = public.my_display_name());
create policy "Members update own avatar" on public.avatars for update to authenticated
  using (user_id = auth.uid())
  with check (public.is_household_member(household_id) and user_id = auth.uid() and person = public.my_display_name());
create policy "Members delete own avatar" on public.avatars for delete to authenticated
  using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'avatars') then
    alter publication supabase_realtime add table public.avatars;
  end if;
end $$;

notify pgrst, 'reload schema';
