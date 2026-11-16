-- Mapa de Nosotros, versión 2: cada sitio tiene un tipo (ciudad, playa, restaurante…), el enlace
-- de Google Maps del que salió y su dirección. Los nombres de sitios concretos pueden ser más
-- largos que los de una ciudad. Ejecutar después de places.sql. Es idempotente.

alter table public.places add column if not exists category text;
alter table public.places drop constraint if exists places_category_check;
alter table public.places add constraint places_category_check check (category is null or category in ('city', 'food', 'cafe', 'beach', 'nature', 'view', 'culture', 'fun', 'shop', 'stay', 'move', 'other'));
alter table public.places add column if not exists url text;
alter table public.places drop constraint if exists places_url_check;
alter table public.places add constraint places_url_check check (url is null or char_length(url) <= 500);
alter table public.places add column if not exists address text;
alter table public.places drop constraint if exists places_address_check;
alter table public.places add constraint places_address_check check (address is null or char_length(address) <= 200);
alter table public.places drop constraint if exists places_name_check;
alter table public.places add constraint places_name_check check (char_length(name) between 1 and 120);

notify pgrst, 'reload schema';
