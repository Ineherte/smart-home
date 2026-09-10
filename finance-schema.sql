create table public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 160),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  paid_by text not null check (paid_by in ('Ines', 'Matteo')),
  category text not null default 'Otros' check (category in ('Hogar', 'Alimentación', 'Transporte', 'Viajes', 'Ocio', 'Compras', 'Salud', 'Otros', 'Alquiler', 'Luz', 'Internet', 'Agua', 'Gas', 'Compra')),
  expense_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'tricount', 'email')),
  source_reference text,
  notes text,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.shared_bills (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('Alquiler', 'Octopus', 'TIM', 'Otro')),
  description text not null,
  paid_by text not null default 'Ines' check (paid_by in ('Ines', 'Matteo')),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  due_date date,
  billing_period text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'review')),
  source text not null default 'manual' check (source in ('manual', 'email')),
  source_reference text,
  attachment_url text,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.shared_expenses enable row level security;
alter table public.shared_bills enable row level security;

create policy "Read shared expenses" on public.shared_expenses for select to authenticated using (true);
create policy "Create shared expenses" on public.shared_expenses for insert to authenticated with check (created_by = auth.uid());
create policy "Update shared expenses" on public.shared_expenses for update to authenticated using (true) with check (true);
create policy "Delete own shared expenses" on public.shared_expenses for delete to authenticated using (created_by = auth.uid());

create policy "Read shared bills" on public.shared_bills for select to authenticated using (true);
create policy "Create shared bills" on public.shared_bills for insert to authenticated with check (created_by = auth.uid());
create policy "Update shared bills" on public.shared_bills for update to authenticated using (true) with check (true);
create policy "Delete own shared bills" on public.shared_bills for delete to authenticated using (created_by = auth.uid());

alter table public.shared_expenses replica identity full;
alter table public.shared_bills replica identity full;
alter publication supabase_realtime add table public.shared_expenses;
alter publication supabase_realtime add table public.shared_bills;
