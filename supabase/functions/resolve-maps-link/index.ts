// Abre un enlace corto de Google Maps (el de «Compartir» en el móvil: maps.app.goo.gl/…) y
// devuelve el enlace largo, que ya trae el nombre y las coordenadas del sitio. El navegador no
// puede hacerlo solo (Google no lo permite desde otra web), así que lo hace esta función.
//   POST { url } con la sesión del usuario → { url }
// Solo sigue enlaces de Google; si Google pide antes aceptar las cookies, saca el enlace del
// sitio de la propia página de aviso.
// Despliegue: supabase functions deploy resolve-maps-link
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const isGoogle = (url: URL) => /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.|consent\.)?google\.[a-z.]+)$/i.test(url.hostname);
const hasPlace = (url: URL) => /\/maps\/(place|search)\/|@-?\d+\.\d+,-?\d+\.\d+|!3d-?\d/.test(url.href) || /[?&](q|query|ll)=/.test(url.search);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Solo se acepta POST' }, 405);
  let url: URL;
  try {
    url = new URL(String((await request.json()).url || ''));
  } catch {
    return json({ error: 'Enlace no válido' }, 400);
  }
  for (let hop = 0; hop < 6; hop += 1) {
    if (!isGoogle(url)) return json({ error: 'Solo enlaces de Google Maps' }, 400);
    // La página de cookies lleva el destino en ?continue=.
    if (url.hostname.startsWith('consent.')) {
      const next = url.searchParams.get('continue');
      if (!next) break;
      url = new URL(next);
      continue;
    }
    if (hasPlace(url) && !/goo\.gl$/i.test(url.hostname)) return json({ url: url.href });
    const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 'Accept-Language': 'es' } });
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) break;
    url = new URL(location, url);
  }
  return hasPlace(url) ? json({ url: url.href }) : json({ error: 'No se pudo abrir el enlace', url: url.href }, 422);
});
