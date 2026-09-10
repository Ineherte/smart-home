alter table public.shared_expenses
  add column if not exists settled boolean not null default false;
