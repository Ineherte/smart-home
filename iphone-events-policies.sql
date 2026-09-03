create policy "Leer propios eventos del iPhone"
on public.iphone_events for select
to authenticated
using (owner = (auth.jwt() -> 'user_metadata' ->> 'name'));

create policy "Eliminar propios eventos del iPhone"
on public.iphone_events for delete
to authenticated
using (owner = (auth.jwt() -> 'user_metadata' ->> 'name'));
