create table if not exists public.shared_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 80),
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null default 'Otros' check (category in ('Alquiler', 'Internet', 'Luz', 'Agua', 'Gas', 'Otros')),
  paid_by text not null default 'Ines' check (paid_by in ('Ines', 'Matteo')),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.shared_fixed_costs enable row level security;
create policy "Read shared fixed costs" on public.shared_fixed_costs for select to authenticated using (true);
create policy "Create shared fixed costs" on public.shared_fixed_costs for insert to authenticated with check (created_by = auth.uid());
create policy "Update shared fixed costs" on public.shared_fixed_costs for update to authenticated using (true) with check (true);
create policy "Delete own shared fixed costs" on public.shared_fixed_costs for delete to authenticated using (created_by = auth.uid());
alter table public.shared_fixed_costs replica identity full;
alter publication supabase_realtime add table public.shared_fixed_costs;

insert into public.shared_fixed_costs (description, amount, category, paid_by)
select 'Alquiler', 800, 'Alquiler', 'Ines'
where not exists (select 1 from public.shared_fixed_costs where description = 'Alquiler');

insert into public.shared_fixed_costs (description, amount, category, paid_by)
select 'Internet', 30, 'Internet', 'Ines'
where not exists (select 1 from public.shared_fixed_costs where description = 'Internet');
