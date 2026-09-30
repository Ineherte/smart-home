alter table public.shared_bills
  add column if not exists paid_by text not null default 'Ines'
  check (paid_by in ('Ines', 'Matteo'));

alter table public.shared_bills
  add column if not exists billing_period text;

alter table public.shared_bills replica identity full;
