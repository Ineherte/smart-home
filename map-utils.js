// Herramientas de mapas que comparten el mapa de Nosotros (nosotros.js) y los viajes (trips.js):
// los tipos de sitio, leer enlaces de Google Maps (también los cortos que da «Compartir» en el
// móvil, que resuelve la función resolve-maps-link), buscar sitios por su nombre y saber en qué
// país está un punto.

// Tipos de sitio de los viajes. El mapa de Nosotros añade «Ciudad» (PLACE_TYPES).
const STOP_KINDS = {
  food: { label: 'Restaurante', plural: 'Restaurantes', emoji: '🍽️', color: '#e0703a' },
  cafe: { label: 'Café y copas', plural: 'Cafés y copas', emoji: '☕', color: '#9a6a44' },
  beach: { label: 'Playa', plural: 'Playas', emoji: '🏖️', color: '#1f9fc4' },
  nature: { label: 'Parque y naturaleza', plural: 'Parques y naturaleza', emoji: '🌳', color: '#3c9a5b' },
  view: { label: 'Sitio bonito', plural: 'Sitios bonitos', emoji: '🌅', color: '#e6a127' },
  culture: { label: 'Museo y cultura', plural: 'Museos y cultura', emoji: '🏛️', color: '#6a58c2' },
  fun: { label: 'Actividad', plural: 'Actividades', emoji: '🎟️', color: '#d9466a' },
  shop: { label: 'Compras', plural: 'Compras', emoji: '🛍️', color: '#c2569b' },
  stay: { label: 'Alojamiento', plural: 'Alojamiento', emoji: '🛏️', color: '#275b49' },
  move: { label: 'Transporte', plural: 'Transporte', emoji: '🚆', color: '#566778' },
  other: { label: 'Otro', plural: 'Otros', emoji: '📍', color: '#8a8a80' }
};
const PLACE_TYPES = { city: { label: 'Ciudad o pueblo', plural: 'Ciudades', emoji: '🏙️', color: '#3a6fb0' }, ...STOP_KINDS };

const hasCoords = (item) => item && item.lat !== null && item.lon !== null && item.lat !== undefined && item.lon !== undefined && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon));
const isShortMapsLink = (url) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)\//i.test(String(url || ''));
const isGoogleMapsLink = (url) => /^https?:\/\/([a-z]+\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(url || ''));

// Un enlace de Google Maps: nombre, dirección y coordenadas si vienen en él.
function parseMapsLink(text) {
  const url = (String(text || '').match(/https?:\/\/\S+/) || [''])[0].replace(/[).,;]+$/, '');
  if (!url) return null;
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch {}
  // !3d…!4d… es el punto exacto del sitio; @lat,lon, el centro de la vista.
  const pin = [/!3d(-?\d+\.\d+)/.exec(decoded), /!4d(-?\d+\.\d+)/.exec(decoded)];
  const coords = pin[0] && pin[1] ? [null, pin[0][1], pin[1][1]]
    : /[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i.exec(decoded) || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(decoded);
  let label = '';
  try {
    const path = /\/(?:place|search)\/([^/@?]+)/.exec(url)?.[1];
    const query = new URL(url).searchParams.get('q') || new URL(url).searchParams.get('query') || '';
    label = decodeURIComponent((path || (/^-?\d+\.\d+\s*,/.test(query) ? '' : query)).replace(/\+/g, ' ')).trim();
  } catch {}
  return {
    url: url.slice(0, 500),
    name: label.split(',')[0].trim().slice(0, 120),
    address: label.split(',').slice(1).join(',').trim().slice(0, 200),
    lat: coords ? Number(coords[1]) : null,
    lon: coords ? Number(coords[2]) : null
  };
}

// Lee un enlace de Google Maps y lo convierte en un sitio con coordenadas. Los enlaces cortos
// (maps.app.goo.gl) no dicen dónde está el sitio: los abre la función resolve-maps-link. Si aun
// así no hay coordenadas pero sí nombre, se busca por el nombre.
async function resolveMapsLink(text) {
  let link = parseMapsLink(text);
  if (!link) return null;
  if (!hasCoords(link) && (isShortMapsLink(link.url) || !link.name) && typeof supabaseClient !== 'undefined' && supabaseClient && authUserId) {
    try {
      const { data, error } = await supabaseClient.functions.invoke('resolve-maps-link', { body: { url: link.url } });
      const full = !error && data?.url ? parseMapsLink(data.url) : null;
      if (full) link = { ...full, url: link.url, name: full.name || link.name };
    } catch {}
  }
  if (!hasCoords(link) && link.name) {
    const [hit] = await searchPlacesByName([link.name, link.address].filter(Boolean).join(', ')).catch(() => []);
    if (hit) link = { ...link, lat: hit.lat, lon: hit.lon, address: link.address || hit.address, country: hit.country, category: hit.category };
  }
  return link;
}

// Qué es un sitio según OpenStreetMap.
function guessKind(key, value) {
  const tag = `${key}:${value}`;
  if (/^(place|boundary):(city|town|village|hamlet|suburb|quarter|neighbourhood|municipality|locality|administrative)/.test(tag)) return 'city';
  if (/restaurant|fast_food|food_court|ice_cream/.test(tag)) return 'food';
  if (/cafe|:bar|:pub|biergarten|wine|bakery|pastry/.test(tag)) return 'cafe';
  if (/beach|:bay|coastline/.test(tag)) return 'beach';
  if (/park|garden|nature_reserve|forest|wood|peak|mountain|waterfall|lake|valley|island/.test(tag)) return 'nature';
  if (/museum|gallery|monument|memorial|castle|church|cathedral|place_of_worship|ruins|archaeolog|theatre|historic|artwork/.test(tag)) return 'culture';
  if (/viewpoint|attraction|lighthouse|square|fountain/.test(tag)) return 'view';
  if (/hotel|hostel|guest_house|apartment|motel|camp_site|chalet/.test(tag)) return 'stay';
  if (/station|aerodrome|airport|ferry|terminal|railway|bus_stop/.test(tag)) return 'move';
  if (/shop|mall|marketplace|market/.test(tag)) return 'shop';
  if (/zoo|theme_park|aquarium|cinema|stadium|water_park|leisure/.test(tag)) return 'fun';
  return 'other';
}

// Qué es un sitio según su nombre (lo que se puede saber de un enlace de Google Maps).
const NAME_HINTS = [
  [/\b(playa|platja|beach|praia|spiaggia|plage|cala|strand|lido)\b/, 'beach'],
  [/\b(restaurante?|ristorante|trattoria|osteria|pizzeria|taberna|tasca|marisqueria|asador|sushi|bistro|brasserie|tapas|ramen|steakhouse|braseria|cocina)\b/, 'food'],
  [/\b(cafe|caffe|coffee|bar|cerveceria|pasteleria|pasticceria|gelateria|heladeria|panaderia|bakery|vinoteca|enoteca|pub)\b/, 'cafe'],
  [/\b(parque|parco|park|jardin|jardines|giardino|garden|bosque|monte|sierra|lago|lake|cascada|valle|reserva|sendero)\b/, 'nature'],
  [/\b(mirador|miradouro|belvedere|viewpoint|faro|lighthouse|puerto|plaza|piazza|praca)\b/, 'view'],
  [/\b(museo|museu|museum|musee|catedral|cathedral|duomo|castillo|castello|castle|palacio|palazzo|iglesia|chiesa|basilica|monasterio|teatro|ruinas|alhambra)\b/, 'culture'],
  [/\b(hotel|hostal|hostel|apartamentos?|agriturismo|camping|resort|posada|parador)\b/, 'stay'],
  [/\b(aeropuerto|airport|aeroporto|estacion|stazione|station)\b/, 'move'],
  [/\b(mercado|mercato|market|tienda|shop|outlet|centro comercial)\b/, 'shop'],
  [/\b(zoo|acuario|aquarium|cine|estadio|stadio|parque de atracciones)\b/, 'fun']
];
const guessKindFromName = (name) => NAME_HINTS.find(([pattern]) => pattern.test(normalizeText(name)))?.[1] || null;

// Busca sitios concretos (restaurantes, playas, miradores…) o ciudades. Con near, primero los de cerca.
async function searchPlacesByName(query, near = null) {
  const bias = hasCoords(near) ? `&lat=${near.lat}&lon=${near.lon}` : '';
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8${bias}`);
    if (!response.ok) throw new Error('photon');
    const data = await response.json();
    return (data.features || []).map(({ properties: p, geometry }) => ({
      name: p.name || p.street || query,
      address: [p.street && `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}`, p.city || p.town || p.village || p.county, p.country].filter(Boolean).join(', '),
      country: p.country || null,
      lat: geometry.coordinates[1],
      lon: geometry.coordinates[0],
      category: guessKind(p.osm_key, p.osm_value)
    }));
  } catch {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=es&addressdetails=1&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.map((row) => ({ name: row.name || row.display_name.split(',')[0], address: row.display_name.split(',').slice(1, 4).join(',').trim(), country: row.address?.country || null, lat: Number(row.lat), lon: Number(row.lon), category: guessKind(row.category, row.type) }));
  }
}

// En qué país y ciudad está un punto (en español, para agrupar el mapa por países).
async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=${lat}&lon=${lon}`);
    const address = (await response.json()).address || {};
    return { country: address.country || null, city: address.city || address.town || address.village || address.municipality || address.county || null };
  } catch {
    return {};
  }
}

// Enlace para abrir un sitio en Google Maps: el que pegasteis o una búsqueda.
function googleMapsLink(place, where = '') {
  if (isGoogleMapsLink(place.url)) return place.url;
  const query = place.address ? `${place.name}, ${place.address}` : hasCoords(place) ? `${place.lat},${place.lon}` : [place.name, where].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// Leaflet y su agrupador de pines se cargan solo al abrir un mapa.
let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  const load = (tag, attrs) => new Promise((resolve, reject) => {
    const el = Object.assign(document.createElement(tag), attrs);
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/';
  leafletLoading ||= (async () => {
    load('link', { rel: 'stylesheet', href: `${base}leaflet/1.9.4/leaflet.min.css` }).catch(() => {});
    await load('script', { src: `${base}leaflet/1.9.4/leaflet.min.js` }).catch(() => { throw new Error('No se pudo cargar el mapa'); });
    load('link', { rel: 'stylesheet', href: `${base}leaflet.markercluster/1.5.3/MarkerCluster.css` }).catch(() => {});
    await load('script', { src: `${base}leaflet.markercluster/1.5.3/leaflet.markercluster.js` }).catch(() => {});
    return window.L;
  })();
  leafletLoading.catch(() => { leafletLoading = null; });
  return leafletLoading;
}
