-- Documentos (Vida → Documentos): el DNI escaneado, el contrato del piso, la tarjeta sanitaria…
-- Cada documento es de alguien (person: Ines, Matteo o los dos) y lo ve:
--   scope 'shared'  → los dos miembros del hogar;
--   scope 'private' → solo quien lo subió (ni siquiera tu pareja puede abrirlo).
-- Los archivos van a un bucket privado de Storage, con la misma regla en la ruta:
--   <household_id>/shared/<archivo>            → los dos
--   <household_id>/private/<user_id>/<archivo> → solo esa persona
-- Ejecutar después de life.sql (usa public.is_household_member). Es idempotente.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  person text not null default 'both' check (char_length(person) <= 40),
  scope text not null default 'private' check (scope in ('shared', 'private')),
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'Otros' check (category in ('Identidad', 'Salud', 'Casa', 'Coche', 'Trabajo', 'Viajes', 'Dinero', 'Garantías', 'Estudios', 'Otros')),
  path text not null check (char_length(path) <= 400),
  file_name text check (char_length(file_name) <= 160),
  mime text check (char_length(mime) <= 100),
  size_bytes integer check (size_bytes between 0 and 15728640),
  expires_on date,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_household_idx on public.documents (household_id, created_at desc);

alter table public.documents enable row level security;
alter table public.documents replica identity full;
drop policy if exists "Documents read" on public.documents;
drop policy if exists "Documents create" on public.documents;
drop policy if exists "Documents update" on public.documents;
drop policy if exists "Documents delete" on public.documents;
create policy "Documents read" on public.documents for select to authenticated
  using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));
create policy "Documents create" on public.documents for insert to authenticated
  with check (public.is_household_member(household_id) and owner_id = auth.uid());
-- Uno compartido lo pueden editar los dos; uno privado, solo su dueño (y nadie puede
-- convertir en privado un documento de otro).
create policy "Documents update" on public.documents for update to authenticated
  using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()))
  with check (public.is_household_member(household_id) and (owner_id = auth.uid() or scope = 'shared'));
create policy "Documents delete" on public.documents for delete to authenticated
  using (public.is_household_member(household_id) and (scope = 'shared' or owner_id = auth.uid()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;

-- Archivos: bucket privado (hasta 15 MB por archivo: PDF y fotos).
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'Storage no disponible: se omite el bucket de documentos';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('household-documents', 'household-documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "Household documents read" on storage.objects;
  drop policy if exists "Household documents upload" on storage.objects;
  drop policy if exists "Household documents delete" on storage.objects;
  create policy "Household documents read" on storage.objects for select to authenticated
    using (bucket_id = 'household-documents'
      and public.is_household_member(((storage.foldername(name))[1])::uuid)
      and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)));
  create policy "Household documents upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'household-documents'
      and public.is_household_member(((storage.foldername(name))[1])::uuid)
      and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)));
  create policy "Household documents delete" on storage.objects for delete to authenticated
    using (bucket_id = 'household-documents'
      and public.is_household_member(((storage.foldername(name))[1])::uuid)
      and ((storage.foldername(name))[2] = 'shared' or ((storage.foldername(name))[2] = 'private' and (storage.foldername(name))[3] = auth.uid()::text)));
end $$;

notify pgrst, 'reload schema';
