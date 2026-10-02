-- Muñecos de la escena: una fila por persona del hogar con su look, estado de ánimo,
-- último mensaje para el otro, último «toque» (beso, abrazo…), sus necesidades y qué está
-- haciendo en la casa.
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
  poke text,
  poke_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, person)
);

-- Casa por dentro (sims.js): necesidades, qué está haciendo cada muñeco y más interacciones
-- (ataque de tiburón y selfie en el espejo incluidos).
alter table public.avatars add column if not exists needs jsonb not null default '{}'::jsonb;
alter table public.avatars add column if not exists needs_at timestamptz;
alter table public.avatars add column if not exists activity text;
alter table public.avatars add column if not exists activity_at timestamptz;
alter table public.avatars drop constraint if exists avatars_activity_check;
alter table public.avatars add constraint avatars_activity_check check (activity is null or char_length(activity) <= 30);
alter table public.avatars drop constraint if exists avatars_needs_check;
alter table public.avatars add constraint avatars_needs_check check (pg_column_size(needs) < 1000);
alter table public.avatars drop constraint if exists avatars_poke_check;
alter table public.avatars add constraint avatars_poke_check check (poke is null or poke in ('kiss', 'hug', 'tickle', 'highfive', 'chat', 'dance', 'compliment', 'shark', 'selfie'));

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
