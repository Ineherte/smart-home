create table if not exists public.shared_settlements (
  id uuid primary key default gen_random_uuid(),
  from_person text not null check (from_person in ('Ines', 'Matteo')),
  to_person text not null check (to_person in ('Ines', 'Matteo')),
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_person <> to_person)
);

alter table public.shared_settlements enable row level security;
create policy "Read shared settlements" on public.shared_settlements for select to authenticated using (true);
create policy "Create shared settlements" on public.shared_settlements for insert to authenticated with check (created_by is null or created_by = auth.uid());
alter table public.shared_settlements replica identity full;
