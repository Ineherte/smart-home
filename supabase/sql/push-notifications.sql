-- Notificaciones push: un registro por teléfono (o navegador) con los avisos activados.
-- La función notify-household lee esta tabla con la service role para avisar al resto del hogar.
-- Ejecutar después de shopping-and-tasks.sql. Es idempotente.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  person text,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (char_length(user_agent) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_household_idx on public.push_subscriptions (household_id);

-- Cada persona solo ve y gestiona sus propios dispositivos, y solo en un hogar del que es miembro.
alter table public.push_subscriptions enable row level security;
drop policy if exists "Own push subscriptions read" on public.push_subscriptions;
drop policy if exists "Own push subscriptions create" on public.push_subscriptions;
drop policy if exists "Own push subscriptions update" on public.push_subscriptions;
drop policy if exists "Own push subscriptions delete" on public.push_subscriptions;
create policy "Own push subscriptions read" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy "Own push subscriptions create" on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "Own push subscriptions update" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy "Own push subscriptions delete" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
