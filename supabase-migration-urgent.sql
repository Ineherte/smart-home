alter table public.notes
  add column if not exists priority text not null default 'normal',
  add column if not exists completed boolean not null default false;

alter table public.notes
  add constraint notes_priority_check check (priority in ('normal', 'urgent'));

create policy "Update shared or own notes"
  on public.notes for update
  to authenticated
  using (scope = 'shared' or owner_id = auth.uid())
  with check (scope = 'shared' or owner_id = auth.uid());

alter table public.notes replica identity full;
alter publication supabase_realtime add table public.notes;