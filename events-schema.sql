create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  event_date date not null,
  event_time time not null,
  duration text not null default '',
  location text not null default '',
  scope text not null check (scope in ('shared', 'private')),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Read shared or own events"
  on public.events for select to authenticated
  using (scope = 'shared' or owner_id = auth.uid());

create policy "Create events for self"
  on public.events for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Delete own events"
  on public.events for delete to authenticated
  using (owner_id = auth.uid());

alter table public.events replica identity full;
alter publication supabase_realtime add table public.events;
