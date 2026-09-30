create table public.shared_drawing (
  id integer primary key default 1 check (id = 1),
  strokes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.shared_drawing (id) values (1) on conflict (id) do nothing;
alter table public.shared_drawing enable row level security;

create policy "Leer pizarra compartida"
on public.shared_drawing for select to authenticated
using (true);

create policy "Actualizar pizarra compartida"
on public.shared_drawing for insert to authenticated
with check (true);

create policy "Modificar pizarra compartida"
on public.shared_drawing for update to authenticated
using (true) with check (true);

alter table public.shared_drawing replica identity full;
alter publication supabase_realtime add table public.shared_drawing;
