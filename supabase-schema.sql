create table public.notes (
  id uuid primary key default gen_random_uuid(),
  content text not null check (char_length(content) between 1 and 120),
  scope text not null check (scope in ('shared', 'private')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  completed boolean not null default false,
  owner_id uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Read shared or own notes"
  on public.notes for select
  to authenticated
  using (scope = 'shared' or owner_id = auth.uid());

create policy "Create notes for self"
  on public.notes for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Update shared or own notes"
  on public.notes for update
  to authenticated
  using (scope = 'shared' or owner_id = auth.uid())
  with check (scope = 'shared' or owner_id = auth.uid());

create policy "Delete own notes"
  on public.notes for delete
  to authenticated
  using (owner_id = auth.uid());

alter table public.notes replica identity full;
alter publication supabase_realtime add table public.notes;
