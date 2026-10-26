// Viajes: el organizador de viajes de Nosotros. Cada viaje tiene su itinerario por días, los
// sitios que queréis ver (restaurantes, playas, parques, sitios bonitos…) en su propio mapa y
// lo que hay que preparar. Lo de preparar no vive aparte, para que salga también en
// Casa → Pendientes:
//   · «Antes de ir» son tareas normales en una lista propia («Viaje · Lisboa»);
//   · la maleta y «A tener en cuenta» son notas normales con su lista para marcar.
// Datos en trips y trip_stops (supabase/sql/trips.sql). Usa de nosotros.js el sheet (usSheet),
// el mapa de sitios visitados (places) y las fechas (special_dates), y de tasks.js y notes.js
// las tareas y las notas.
const tripsStore = createHouseholdStore({ table: 'trips', localKey: 'umbral-trips' });
const tripStopsStore = createHouseholdStore({ table: 'trip_stops', localKey: 'umbral-trip-stops' });

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
const TRIP_COLORS = { sea: ['#1f6f8b', '#4fb0a5'], sunset: ['#d9534f', '#f2a65a'], forest: ['#2f5d46', '#7bb07f'], lavender: ['#5a4a7e', '#a487cf'], sand: ['#a8703f', '#e6bb7a'], night: ['#1f2a44', '#44649a'] };
const TRIP_EMOJIS = ['✈️', '🏖️', '🏔️', '🏙️', '🍷', '🚗', '🚆', '⛺', '🎄', '💞'];
const TRIP_INFO = [
  ['stay', 'Alojamiento', 'bed-double', 'Hotel, dirección, hora de entrada, código de reserva'],
  ['transport', 'Cómo llegamos', 'plane', 'Vuelo o tren, horarios, localizador'],
  ['docs', 'Documentos', 'id-card', 'DNI, pasaporte, visado, tarjeta sanitaria'],
  ['money', 'Dinero', 'banknote', 'Moneda, efectivo, propinas'],
  ['budget', 'Presupuesto', 'piggy-bank', 'Cuánto queremos gastar'],
  ['language', 'Idioma', 'languages', 'Cuatro frases útiles'],
  ['plug', 'Enchufes', 'plug-zap', 'Tipo de enchufe, adaptador'],
  ['emergency', 'Emergencias', 'siren', '112, embajada, seguro de viaje']
];
const BEFORE_PRESETS = ['Reservar el alojamiento', 'Comprar los billetes', 'Contratar el seguro de viaje', 'Hacer el check-in online', 'Descargar los mapas sin conexión', 'Reservar restaurantes', 'Cambiar algo de moneda', 'Dejar organizado el riego de las plantas'];
const BEFORE_DEADLINES = [['', 'Sin plazo'], ['30', '1 mes antes'], ['14', '2 semanas antes'], ['7', '1 semana antes'], ['2', '2 días antes'], ['1', 'El día antes']];
const PACKING_EXTRAS = { beach: ['Bañador', 'Toalla de playa', 'Crema solar', 'Chanclas'], nature: ['Calzado cómodo', 'Chubasquero', 'Botella de agua'], view: ['Batería externa'], fun: ['Entradas en el móvil'], culture: ['Entradas en el móvil'] };
const CARE_PRESETS = ['Llevar algo de efectivo', 'Ojo con los carteristas en las zonas turísticas', 'Mirar si el agua del grifo es potable', 'Revisar qué días cierran los museos', 'Foto del DNI y del seguro en el móvil', 'Protector solar y agua'];
const TRIP_TABS = [['plan', 'Itinerario', 'calendar-range'], ['map', 'Mapa', 'map'], ['places', 'Sitios', 'map-pin'], ['prep', 'Preparar', 'list-checks']];

let trips = [];
let tripStops = [];
// Tareas de los viajes ya hechas (las activas están en householdTasks, de tasks.js).
let tripDoneTasks = [];
let tripsLoaded = false;
let tripsError = '';
let openTripId = null;
let tripTab = 'plan';
let tripKindFilter = '';
let tripDayFilter = '';
let tripMap = null;
let tripLayer = null;
let tripsRenderTimer;
let tripHistoryTimer;
// Si abrir el viaje dejó una entrada en el historial (para que «atrás» vuelva a la lista).
let tripInHistory = false;

// ---------- Utilidades ----------

const tripById = (id) => trips.find((trip) => trip.id === id);
const stopsOf = (trip) => tripStops.filter((stop) => stop.trip_id === trip.id);
const stopKind = (stop) => STOP_KINDS[stop.category] || STOP_KINDS.other;
const hasCoords = (item) => item && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)) && item.lat !== null && item.lon !== null;
const byPosition = (first, second) => (first.position || 0) - (second.position || 0) || String(first.created_at).localeCompare(String(second.created_at));
const normalizeTrip = (trip) => ({ ...trip, info: trip.info || {}, days: trip.days || {} });
const tripColors = (trip) => TRIP_COLORS[trip.color] || TRIP_COLORS.sea;
const coverStyle = (trip) => `--trip-a:${tripColors(trip)[0]};--trip-b:${tripColors(trip)[1]}`;
const tripWhere = (trip) => [trip.destination, trip.country].filter(Boolean).join(', ');
const shortDay = (iso) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(isoToDate(iso));
const weekdayLabel = (iso) => capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(isoToDate(iso)));

function tripDays(trip) {
  if (!trip.start_date) return [];
  const end = trip.end_date && trip.end_date >= trip.start_date ? trip.end_date : trip.start_date;
  const days = [];
  for (let day = trip.start_date; day <= end && days.length < 60; day = addDaysToISO(day, 1)) days.push(day);
  return days;
}

function tripPhase(trip) {
  if (!trip.start_date) return 'idea';
  const today = todayISO();
  const end = trip.end_date || trip.start_date;
  if (end < today) return 'past';
  return trip.start_date <= today ? 'now' : 'upcoming';
}

function tripRange(trip) {
  if (!trip.start_date) return 'Sin fechas todavía';
  const end = trip.end_date || trip.start_date;
  const year = end.slice(0, 4) !== todayISO().slice(0, 4) ? ` ${end.slice(0, 4)}` : '';
  if (end === trip.start_date) return `${weekdayLabel(end)}${year}`;
  if (trip.start_date.slice(0, 7) === end.slice(0, 7)) return `${Number(trip.start_date.slice(8))}–${shortDay(end)}${year}`;
  return `${shortDay(trip.start_date)} – ${shortDay(end)}${year}`;
}

function tripCountdown(trip) {
  const today = todayISO();
  const phase = tripPhase(trip);
  if (phase === 'idea') return 'Por decidir fechas';
  if (phase === 'now') return `¡De viaje! Día ${daysBetween(trip.start_date, today) + 1} de ${tripDays(trip).length}`;
  if (phase === 'past') {
    const ago = daysBetween(trip.end_date || trip.start_date, today);
    return ago <= 1 ? 'Recién vueltos' : ago < 60 ? `Volvisteis hace ${ago} días` : 'Viaje hecho';
  }
  const left = daysBetween(today, trip.start_date);
  if (left === 1) return '¡Mañana!';
  return left < 60 ? `Faltan ${left} días` : `Faltan ${Math.round(left / 30)} meses`;
}

// Enlace a Google Maps: el que pegasteis o una búsqueda del sitio.
function mapsLink(stop, trip) {
  if (/^https?:\/\/([a-z]+\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(stop.url || '')) return stop.url;
  const query = stop.address ? `${stop.name}, ${stop.address}` : hasCoords(stop) ? `${stop.lat},${stop.lon}` : `${stop.name}, ${tripWhere(trip) || trip.title}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// La ruta del día, sitio a sitio, andando (Google admite unos diez puntos).
function dayRouteLink(list) {
  const points = list.filter(hasCoords).map((stop) => `${stop.lat},${stop.lon}`).slice(0, 10);
  if (points.length < 2) return '';
  const [origin, ...rest] = points;
  const destination = rest.pop();
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${rest.length ? `&waypoints=${encodeURIComponent(rest.join('|'))}` : ''}&travelmode=walking`;
}

// Un enlace de Google Maps pegado: nombre y coordenadas si vienen en él.
function parseMapsLink(text) {
  const url = String(text || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  // !3d…!4d… es el punto exacto del sitio; @lat,lon, el centro de la vista.
  const pin = [/!3d(-?\d+\.\d+)/.exec(url), /!4d(-?\d+\.\d+)/.exec(url)];
  const coords = pin[0] && pin[1] ? [null, pin[0][1], pin[1][1]] : /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url) || /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i.exec(url);
  let place = '';
  try { place = decodeURIComponent((/\/place\/([^/@?]+)/.exec(url)?.[1] || '').replace(/\+/g, ' ')); } catch {}
  return { url: url.slice(0, 500), name: place.split(',')[0].trim(), address: place.split(',').slice(1).join(',').trim(), lat: coords ? Number(coords[1]) : null, lon: coords ? Number(coords[2]) : null };
}

// Qué es un sitio según OpenStreetMap.
function guessKind(key, value) {
  const tag = `${key}:${value}`;
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

// Busca sitios concretos (restaurantes, playas, miradores…) cerca del destino.
async function searchStops(query, trip) {
  const near = hasCoords(trip) ? `&lat=${trip.lat}&lon=${trip.lon}` : '';
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8${near}`);
    if (!response.ok) throw new Error('photon');
    const data = await response.json();
    return (data.features || []).map(({ properties: p, geometry }) => ({
      name: p.name || p.street || query,
      address: [p.street && `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}`, p.city || p.town || p.village || p.county, p.country].filter(Boolean).join(', '),
      lat: geometry.coordinates[1],
      lon: geometry.coordinates[0],
      category: guessKind(p.osm_key, p.osm_value)
    }));
  } catch {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=es&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.map((row) => ({ name: row.name || row.display_name.split(',')[0], address: row.display_name.split(',').slice(1, 4).join(',').trim(), lat: Number(row.lat), lon: Number(row.lon), category: guessKind(row.category, row.type) }));
  }
}

// ---------- Datos ----------

async function loadTrips({ quiet = false } = {}) {
  try {
    const [tripRows, stopRows] = await Promise.all([
      tripsStore.list({ build: (query) => query.order('start_date', { ascending: true, nullsFirst: false }) }),
      tripStopsStore.list({ build: (query) => query.order('position') })
    ]);
    trips = tripRows.map(normalizeTrip);
    tripStops = stopRows;
    tripsError = '';
  } catch (error) {
    console.warn('[Umbral] Viajes:', error?.message || error);
    tripsError = /relation|schema cache|does not exist|could not find/i.test(error?.message || '') ? 'missing' : error?.message || 'error';
  }
  tripsLoaded = true;
  await loadTripTaskHistory();
  if (openTripId && !tripById(openTripId)) openTripId = null;
  if (quiet) softRenderTrips();
  else rerenderTrips();
}

// Las tareas de los viajes ya hechas: las que se cerraron con su «hecho» (no las borradas).
async function loadTripTaskHistory() {
  const lists = trips.map((trip) => trip.task_list).filter(Boolean);
  if (!lists.length) { tripDoneTasks = []; return; }
  try {
    const closed = await tasksStore.list({ build: (query) => query.eq('active', false).in('list', lists).order('created_at', { ascending: false }).limit(300), filter: (row) => row.active === false && lists.includes(row.list) });
    if (!closed.length) { tripDoneTasks = []; return; }
    const ids = closed.map((task) => task.id);
    const completions = await completionsStore.list({ build: (query) => query.in('task_id', ids), filter: (row) => ids.includes(row.task_id) });
    const byTask = new Map(completions.map((completion) => [completion.task_id, completion]));
    tripDoneTasks = closed.filter((task) => byTask.has(task.id)).map((task) => ({ ...task, completion: byTask.get(task.id) }));
  } catch {
    tripDoneTasks = [];
  }
}

function tripNote(id) {
  return id && typeof householdNotes !== 'undefined' ? householdNotes.find((note) => note.id === id) || null : null;
}

function tripPrep(trip) {
  const open = trip.task_list ? householdTasks.filter((task) => task.list === trip.task_list) : [];
  const done = trip.task_list ? tripDoneTasks.filter((task) => task.list === trip.task_list) : [];
  const packNote = tripNote(trip.packing_note_id);
  const careNote = tripNote(trip.care_note_id);
  const pack = packNote ? parseNoteBody(packNote.details) : null;
  const care = careNote ? parseNoteBody(careNote.details) : null;
  return {
    open, done, packNote, careNote, pack, care,
    todo: { done: done.length, total: open.length + done.length },
    packing: { done: pack ? pack.items.filter((item) => item.done).length : 0, total: pack ? pack.items.length : 0 }
  };
}

// ---------- Pintar ----------

// Lo llama renderUs (nosotros.js) en la pestaña Viajes.
function renderTrips() {
  if (!tripsLoaded) return '<p class="empty-note">Cargando viajes…</p>';
  const trip = openTripId && tripById(openTripId);
  if (trip) {
    if (tripTab === 'map') setTimeout(() => mountTripMap(trip), 0);
    return renderTripPage(trip);
  }
  return renderTripsHome() + renderMap();
}

function rerenderTrips(focus = '') {
  if (typeof usView === 'undefined' || usView !== 'trips') return;
  renderUs();
  if (focus) document.querySelector(`[data-trip-focus="${focus}"]`)?.focus({ preventScroll: true });
}

// Cambios que llegan de fuera (la otra persona, notas, tareas): si estás escribiendo, espera.
function softRenderTrips() {
  clearTimeout(tripsRenderTimer);
  tripsRenderTimer = setTimeout(() => {
    const active = document.activeElement;
    if (active?.closest?.('#usContent') && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return softRenderTrips();
    rerenderTrips();
  }, 600);
}

function tripCard(trip, big = false) {
  const stops = stopsOf(trip);
  const prep = tripPrep(trip);
  const where = trip.destination && normalizeText(trip.destination) !== normalizeText(trip.title) ? tripWhere(trip) : trip.country || '';
  return `<button type="button" class="trip-card${big ? ' is-big' : ''} phase-${tripPhase(trip)}" style="${coverStyle(trip)}" data-open-trip="${escapeHtml(trip.id)}">
    <span class="trip-card-emoji">${escapeHtml(trip.emoji || '✈️')}</span>
    <span class="trip-card-copy"><small>${escapeHtml(tripRange(trip))}</small><strong>${escapeHtml(trip.title)}</strong>${where ? `<em>${escapeHtml(where)}</em>` : ''}</span>
    <span class="trip-card-count">${escapeHtml(tripCountdown(trip))}</span>
    ${big ? `<span class="trip-card-chips"><span>📍 ${stops.length} ${stops.length === 1 ? 'sitio' : 'sitios'}</span>${prep.todo.total ? `<span>✅ ${prep.todo.done}/${prep.todo.total} antes de ir</span>` : ''}${prep.packing.total ? `<span>🧳 ${prep.packing.done}/${prep.packing.total} en la maleta</span>` : ''}</span>` : ''}
  </button>`;
}

function renderTripsHome() {
  if (tripsError === 'missing') {
    return `<section class="panel trips-home"><div class="empty-state"><span class="empty-state-icon"><i data-lucide="plane"></i></span><strong>Falta un paso para los viajes</strong><span>Ejecutad supabase/sql/trips.sql en Supabase y el organizador de viajes quedará listo para los dos.</span></div></section>`;
  }
  const byStart = (first, second) => String(first.start_date).localeCompare(String(second.start_date));
  const upcoming = trips.filter((trip) => ['now', 'upcoming'].includes(tripPhase(trip))).sort(byStart);
  const ideas = trips.filter((trip) => tripPhase(trip) === 'idea');
  const past = trips.filter((trip) => tripPhase(trip) === 'past').sort((first, second) => byStart(second, first));
  const [next, ...later] = upcoming;
  const wishes = (typeof places !== 'undefined' ? places : []).filter((place) => place.kind === 'wish' && !trips.some((trip) => normalizeText(trip.destination) === normalizeText(place.name)));
  return `<section class="trips-home">
    <div class="section-heading trips-heading"><div class="heading-copy"><p class="eyebrow">Organizador de viajes</p><h2>${upcoming.length ? 'Próximos viajes' : 'Vuestros viajes'}</h2></div><button type="button" class="pill-button" data-trip-new><i data-lucide="plus"></i> Nuevo viaje</button></div>
    ${tripsError ? `<p class="notes-local-warning"><i data-lucide="info"></i> No se pudieron cargar los viajes: ${escapeHtml(tripsError)}</p>` : ''}
    ${next ? tripCard(next, true) : `<button type="button" class="trip-empty" data-trip-new><span>🧭</span><strong>¿A dónde vamos ahora?</strong><small>Cread un viaje y organizad el itinerario día a día, los sitios en el mapa y la maleta.</small><b><i data-lucide="plus"></i> Planear un viaje</b></button>`}
    ${later.length ? `<div class="trip-grid">${later.map((trip) => tripCard(trip)).join('')}</div>` : ''}
    ${ideas.length ? `<p class="list-group-title trips-group"><i data-lucide="sparkles"></i>Ideas sin fecha<span>${ideas.length}</span></p><div class="trip-grid">${ideas.map((trip) => tripCard(trip)).join('')}</div>` : ''}
    ${wishes.length ? `<div class="trip-wishes"><p>⭐ Queréis ir a… <small>toca uno para empezar a planearlo</small></p><div>${wishes.slice(0, 10).map((place) => `<button type="button" class="trip-wish" data-trip-from-wish="${escapeHtml(place.id)}">${escapeHtml(place.name)}<i data-lucide="arrow-right"></i></button>`).join('')}</div></div>` : ''}
    ${past.length ? `<details class="done-group trips-past"><summary><i data-lucide="history"></i>Viajes hechos<span>${past.length}</span></summary><div class="trip-grid">${past.map((trip) => tripCard(trip)).join('')}</div></details>` : ''}
  </section>`;
}

function renderTripPage(trip) {
  const stops = stopsOf(trip);
  const prep = tripPrep(trip);
  const days = tripDays(trip);
  const planned = stops.filter((stop) => days.includes(stop.day)).length;
  const inMap = typeof places !== 'undefined' && places.some((place) => place.kind !== 'wish' && normalizeText(place.name) === normalizeText(trip.destination));
  const views = { plan: tripPlanView, map: tripMapView, places: tripPlacesView, prep: tripPrepView };
  return `<article class="trip-page">
    <header class="trip-cover" style="${coverStyle(trip)}">
      <div class="trip-cover-bar"><button type="button" class="trip-back" data-trip-back><i data-lucide="chevron-left"></i>Viajes</button><button type="button" class="trip-cover-edit" data-trip-edit aria-label="Editar el viaje" title="Editar"><i data-lucide="pencil"></i></button></div>
      <span class="trip-cover-emoji">${escapeHtml(trip.emoji || '✈️')}</span>
      ${tripWhere(trip) ? `<p class="trip-cover-place"><i data-lucide="map-pin"></i>${escapeHtml(tripWhere(trip))}</p>` : ''}
      <h2>${escapeHtml(trip.title)}</h2>
      <p class="trip-cover-dates">${escapeHtml(tripRange(trip))}${days.length > 1 ? ` · ${days.length} días` : ''}<span>${escapeHtml(tripCountdown(trip))}</span></p>
      ${trip.summary ? `<p class="trip-cover-summary">${escapeHtml(trip.summary)}</p>` : ''}
      <div class="trip-stats">
        <button type="button" data-trip-tab="places"><b>${stops.length}</b><small>sitios</small></button>
        <button type="button" data-trip-tab="plan"><b>${planned}</b><small>en el plan</small></button>
        <button type="button" data-trip-tab="prep"><b>${prep.todo.done}/${prep.todo.total}</b><small>antes de ir</small></button>
        <button type="button" data-trip-tab="prep"><b>${prep.packing.done}/${prep.packing.total}</b><small>maleta</small></button>
      </div>
    </header>
    ${tripPhase(trip) === 'past' && trip.destination && !inMap ? `<button type="button" class="trip-memory" data-trip-to-map><span>❤️</span><span><strong>¿Qué tal fue ${escapeHtml(trip.destination)}?</strong><small>Añadidlo a vuestro mapa de sitios en los que habéis estado</small></span><i data-lucide="chevron-right"></i></button>` : ''}
    <div class="segmented is-wide trip-tabs" role="group" aria-label="Partes del viaje">${TRIP_TABS.map(([id, label, icon]) => `<button type="button" data-trip-tab="${id}" aria-pressed="${tripTab === id}"><i data-lucide="${icon}"></i>${label}</button>`).join('')}</div>
    <div class="trip-body">${(views[tripTab] || tripPlanView)(trip, stops, prep)}</div>
  </article>`;
}

// ----- Itinerario -----

function timelineStop(stop, trip, index, count) {
  const kind = stopKind(stop);
  return `<li class="trip-stop" style="--k:${kind.color}">
    <span class="trip-stop-dot" aria-hidden="true">${kind.emoji}</span>
    <button type="button" class="trip-stop-main" data-trip-stop="${escapeHtml(stop.id)}">
      <span class="trip-stop-meta">${stop.time ? `<b>${escapeHtml(stop.time)}</b>` : ''}<span>${escapeHtml(kind.label)}</span>${stop.must ? '<em class="is-must">★ Imprescindible</em>' : ''}${stop.booked ? '<em class="is-booked">Reservado</em>' : ''}</span>
      <strong>${escapeHtml(stop.name)}</strong>
      ${stop.notes ? `<small>${escapeHtml(stop.notes.slice(0, 160))}</small>` : stop.address ? `<small>${escapeHtml(stop.address)}</small>` : ''}
    </button>
    <span class="trip-stop-tools">
      <a href="${escapeHtml(mapsLink(stop, trip))}" target="_blank" rel="noreferrer" aria-label="Abrir ${escapeHtml(stop.name)} en Google Maps" title="Google Maps"><i data-lucide="navigation"></i></a>
      ${count > 1 ? `<button type="button" data-trip-move="${escapeHtml(stop.id)}" data-dir="-1" ${index === 0 ? 'disabled' : ''} aria-label="Antes"><i data-lucide="chevron-up"></i></button><button type="button" data-trip-move="${escapeHtml(stop.id)}" data-dir="1" ${index === count - 1 ? 'disabled' : ''} aria-label="Después"><i data-lucide="chevron-down"></i></button>` : ''}
    </span>
  </li>`;
}

function spotCard(stop, trip) {
  const kind = stopKind(stop);
  const index = tripDays(trip).indexOf(stop.day);
  const when = index >= 0 ? `Día ${index + 1}${stop.time ? ` · ${stop.time}` : ''}` : 'Sin día';
  return `<li class="trip-spot" style="--k:${kind.color}">
    <button type="button" class="trip-spot-main" data-trip-stop="${escapeHtml(stop.id)}"><span class="trip-spot-badge">${kind.emoji}</span><span class="trip-spot-copy"><strong>${escapeHtml(stop.name)}${stop.must ? ' <em>★</em>' : ''}</strong><small>${escapeHtml([when, stop.booked ? 'reservado' : '', stop.address || ''].filter(Boolean).join(' · '))}</small></span></button>
    <a class="trip-spot-go" href="${escapeHtml(mapsLink(stop, trip))}" target="_blank" rel="noreferrer" aria-label="Abrir ${escapeHtml(stop.name)} en Google Maps" title="Google Maps"><i data-lucide="navigation"></i></a>
  </li>`;
}

function tripPlanView(trip, stops) {
  const days = tripDays(trip);
  const today = todayISO();
  const loose = stops.filter((stop) => !days.includes(stop.day)).sort(byPosition);
  const dayBlocks = days.map((day, index) => {
    const list = stops.filter((stop) => stop.day === day).sort(byPosition);
    const meta = trip.days?.[day] || {};
    const route = dayRouteLink(list);
    return `<section class="trip-day${day === today ? ' is-today' : ''}">
      <header class="trip-day-head">
        <span class="trip-day-num"><small>Día</small>${index + 1}</span>
        <button type="button" class="trip-day-title" data-trip-day="${day}"><small>${escapeHtml(weekdayLabel(day))}${day === today ? ' · hoy' : ''}</small><strong>${meta.title ? escapeHtml(meta.title) : '<em>Ponle nombre al día</em>'}</strong></button>
        ${route ? `<a class="icon-button small" href="${escapeHtml(route)}" target="_blank" rel="noreferrer" aria-label="Ruta del día en Google Maps" title="Ruta del día en Google Maps"><i data-lucide="route"></i></a>` : ''}
      </header>
      ${meta.note ? `<p class="trip-day-note">${escapeHtml(meta.note)}</p>` : ''}
      ${list.length ? `<ol class="trip-timeline">${list.map((stop, position) => timelineStop(stop, trip, position, list.length)).join('')}</ol>` : '<p class="trip-day-empty">Día libre… o por organizar.</p>'}
      <button type="button" class="trip-add-stop" data-trip-add-stop="${day}"><i data-lucide="plus"></i>Añadir a este día</button>
    </section>`;
  }).join('');
  return `${days.length ? dayBlocks : '<div class="trip-nodates"><i data-lucide="calendar-plus"></i><p>Poned las fechas del viaje y podréis repartir los sitios por días.</p><button type="button" class="pill-button" data-trip-edit>Poner fechas</button></div>'}
    <section class="trip-card-section trip-loose">
      <div class="trip-section-head"><div><p class="eyebrow">Ideas</p><h3>${days.length ? 'Sin día todavía' : 'Sitios que queremos ver'}</h3></div><button type="button" class="pill-button" data-trip-add-stop=""><i data-lucide="map-pin-plus"></i> Añadir sitio</button></div>
      ${loose.length ? `<ul class="trip-spot-list">${loose.map((stop) => spotCard(stop, trip)).join('')}</ul>` : '<p class="trip-day-empty">Apuntad aquí lo que os apetece ver y, cuando lo tengáis claro, le dais un día.</p>'}
    </section>`;
}

// ----- Mapa y sitios -----

function kindChips(stops) {
  const present = Object.entries(STOP_KINDS).filter(([id]) => stops.some((stop) => stop.category === id));
  if (present.length < 2) return '';
  return `<div class="trip-chip-row" role="group" aria-label="Filtrar por tipo"><button type="button" class="filter-chip${tripKindFilter ? '' : ' is-on'}" data-trip-kind="">Todo <b>${stops.length}</b></button>${present.map(([id, kind]) => `<button type="button" class="filter-chip trip-kind-chip${tripKindFilter === id ? ' is-on' : ''}" style="--k:${kind.color}" data-trip-kind="${id}">${kind.emoji} ${kind.plural} <b>${stops.filter((stop) => stop.category === id).length}</b></button>`).join('')}</div>`;
}

const filteredStops = (trip, stops) => stops.filter((stop) => (!tripKindFilter || stop.category === tripKindFilter) && (!tripDayFilter || stop.day === tripDayFilter));

function tripMapView(trip, stops) {
  const days = tripDays(trip);
  if (tripDayFilter && !days.includes(tripDayFilter)) tripDayFilter = '';
  const visible = filteredStops(trip, stops).sort(byPosition);
  const located = stops.filter(hasCoords).length;
  const legend = Object.entries(STOP_KINDS).filter(([id]) => stops.some((stop) => stop.category === id));
  return `${kindChips(stops)}
    ${days.length && stops.some((stop) => stop.day) ? `<div class="trip-chip-row" role="group" aria-label="Filtrar por día"><button type="button" class="filter-chip${tripDayFilter ? '' : ' is-on'}" data-trip-day-filter="">Todos los días</button>${days.map((day, index) => `<button type="button" class="filter-chip${tripDayFilter === day ? ' is-on' : ''}" data-trip-day-filter="${day}">Día ${index + 1}</button>`).join('')}</div>` : ''}
    <div class="trip-map" id="tripMap" role="img" aria-label="Mapa del viaje"></div>
    ${legend.length ? `<p class="trip-map-legend">${legend.map(([, kind]) => `<span style="--k:${kind.color}"><i></i>${kind.emoji} ${kind.plural}</span>`).join('')}</p>` : ''}
    ${stops.length > located ? `<p class="recurring-intro"><i data-lucide="info"></i>${stops.length - located === 1 ? 'Un sitio no tiene ubicación y no sale' : `${stops.length - located} sitios no tienen ubicación y no salen`} en el mapa. Ábrelos y búscalos para situarlos.</p>` : ''}
    ${visible.length ? `<ul class="trip-spot-list">${visible.map((stop) => spotCard(stop, trip)).join('')}</ul>` : ''}
    <section class="trip-gmaps">
      <span class="trip-gmaps-icon"><i data-lucide="map"></i></span>
      <div><strong>Vuestro viaje en Google Maps</strong><small>Exportad el viaje y, en Google My Maps, tocad «Crear un mapa» → «Importar». Lo tendréis en la app de Google Maps, en Guardados → Mapas. Cada sitio lleva también su botón <i data-lucide="navigation"></i> para abrirlo directamente.</small></div>
      <div class="trip-gmaps-actions"><button type="button" class="primary-button" data-trip-kml ${located ? '' : 'disabled'}><i data-lucide="download"></i> Exportar el viaje</button><a class="pill-button is-quiet" href="https://www.google.com/maps/d/" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i> Abrir My Maps</a></div>
    </section>`;
}

function tripPlacesView(trip, stops) {
  const present = Object.entries(STOP_KINDS).filter(([id]) => stops.some((stop) => stop.category === id) && (!tripKindFilter || tripKindFilter === id));
  return `<div class="trip-section-head"><div><p class="eyebrow">Todo lo que queremos ver</p><h3>${stops.length} ${stops.length === 1 ? 'sitio' : 'sitios'}</h3></div><button type="button" class="pill-button" data-trip-add-stop=""><i data-lucide="map-pin-plus"></i> Añadir</button></div>
    ${kindChips(stops)}
    ${stops.length ? present.map(([id, kind]) => {
      const list = stops.filter((stop) => stop.category === id).sort((first, second) => Number(second.must) - Number(first.must) || first.name.localeCompare(second.name, 'es'));
      return `<section class="trip-card-section trip-kind-group" style="--k:${kind.color}"><p class="trip-kind-title"><span>${kind.emoji}</span>${kind.plural}<b>${list.length}</b></p><ul class="trip-spot-list">${list.map((stop) => spotCard(stop, trip)).join('')}</ul></section>`;
    }).join('') : `<button type="button" class="trip-empty is-small" data-trip-add-stop=""><span>📍</span><strong>Empezad a apuntar sitios</strong><small>Restaurantes, playas, parques, miradores… Buscadlos por nombre o pegad un enlace de Google Maps.</small></button>`}`;
}

// Leaflet (lo carga nosotros.js) con el mapa base de OpenStreetMap.
async function mountTripMap(trip) {
  const el = document.querySelector('#tripMap');
  if (!el) return;
  try {
    const L = await loadLeaflet();
    if (!document.body.contains(el)) return;
    if (tripMap && tripMap.getContainer() !== el) { tripMap.remove(); tripMap = null; }
    if (!tripMap) {
      tripMap = L.map(el, { scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(tripMap);
      tripLayer = L.layerGroup().addTo(tripMap);
    }
    tripLayer.clearLayers();
    const days = tripDays(trip);
    const visible = filteredStops(trip, stopsOf(trip)).filter(hasCoords).sort(byPosition);
    visible.forEach((stop, index) => {
      const kind = stopKind(stop);
      const dayIndex = days.indexOf(stop.day);
      const label = tripDayFilter ? `<i>${index + 1}</i>` : '';
      const icon = L.divIcon({ className: 'trip-pin', html: `<span style="--k:${kind.color}"><b>${kind.emoji}</b>${label}</span>`, iconSize: [34, 34], iconAnchor: [17, 32], popupAnchor: [0, -28] });
      L.marker([stop.lat, stop.lon], { icon, title: stop.name }).bindPopup(`<div class="trip-popup"><small>${kind.emoji} ${escapeHtml(kind.label)}${dayIndex >= 0 ? ` · Día ${dayIndex + 1}${stop.time ? ` · ${escapeHtml(stop.time)}` : ''}` : ''}</small><strong>${escapeHtml(stop.name)}</strong>${stop.notes ? `<p>${escapeHtml(stop.notes.slice(0, 120))}</p>` : ''}<span><a href="${escapeHtml(mapsLink(stop, trip))}" target="_blank" rel="noreferrer">Google Maps ↗</a><button type="button" data-trip-stop="${escapeHtml(stop.id)}">Ver ficha</button></span></div>`).addTo(tripLayer);
    });
    if (tripDayFilter && visible.length > 1) L.polyline(visible.map((stop) => [stop.lat, stop.lon]), { color: '#1f5a48', weight: 3, opacity: 0.75, dashArray: '6 8' }).addTo(tripLayer);
    if (visible.length > 1) tripMap.fitBounds(L.latLngBounds(visible.map((stop) => [stop.lat, stop.lon])).pad(0.18));
    else if (visible.length) tripMap.setView([visible[0].lat, visible[0].lon], 14);
    else if (hasCoords(trip)) tripMap.setView([trip.lat, trip.lon], 12);
    else tripMap.setView([42, 4], 4);
    setTimeout(() => tripMap?.invalidateSize(), 60);
  } catch (error) {
    el.innerHTML = `<p class="empty-note">${escapeHtml(error.message || 'No se pudo cargar el mapa')}</p>`;
  }
}

// KML para importarlo en Google My Maps: una carpeta por día y cada tipo con su color.
function tripKml(trip) {
  const esc = (value) => String(value ?? '').replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]));
  const kmlColor = (hex) => `ff${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;
  const days = tripDays(trip);
  const stops = stopsOf(trip).filter(hasCoords).sort(byPosition);
  const styles = Object.entries(STOP_KINDS).map(([id, kind]) => `<Style id="${id}"><IconStyle><color>${kmlColor(kind.color)}</color><Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle></Style>`).join('');
  const placemark = (stop) => {
    const kind = stopKind(stop);
    const dayIndex = days.indexOf(stop.day);
    const description = [kind.label, dayIndex >= 0 ? `Día ${dayIndex + 1}${stop.time ? ` · ${stop.time}` : ''}` : '', stop.must ? 'Imprescindible' : '', stop.booked ? 'Reservado' : '', stop.address, stop.notes, stop.url].filter(Boolean).join('\n');
    return `<Placemark><name>${esc(`${kind.emoji} ${stop.name}`)}</name><description>${esc(description)}</description><styleUrl>#${STOP_KINDS[stop.category] ? stop.category : 'other'}</styleUrl><Point><coordinates>${stop.lon},${stop.lat},0</coordinates></Point></Placemark>`;
  };
  const folder = (name, list) => (list.length ? `<Folder><name>${esc(name)}</name>${list.map(placemark).join('')}</Folder>` : '');
  const folders = days.map((day, index) => folder(`Día ${index + 1} · ${shortDay(day)}${trip.days?.[day]?.title ? ` · ${trip.days[day].title}` : ''}`, stops.filter((stop) => stop.day === day))).join('') + folder('Sin día', stops.filter((stop) => !days.includes(stop.day)));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(`${trip.emoji || ''} ${trip.title}`.trim())}</name><description>${esc([tripRange(trip), trip.summary].filter(Boolean).join('\n'))}</description>${styles}${folders}</Document></kml>`;
}

async function exportTripKml(trip) {
  const name = `${normalizeText(trip.title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viaje'}.kml`;
  const blob = new Blob([tripKml(trip)], { type: 'application/vnd.google-earth.kml+xml' });
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: trip.title });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  showToast('Viaje exportado: impórtalo en Google My Maps');
}

// ----- Preparar -----

function checkItems(which, items) {
  return items.map((item, index) => `<li class="trip-check-row${item.done ? ' is-done' : ''}"><button type="button" class="trip-check${item.done ? ' is-on' : ''}" data-trip-note-toggle="${which}:${index}" aria-label="${item.done ? 'Desmarcar' : 'Marcar'} ${escapeHtml(item.text)}"><i data-lucide="check"></i></button><span><strong>${escapeHtml(item.text)}</strong></span><button type="button" class="trip-check-remove" data-trip-note-remove="${which}:${index}" aria-label="Quitar ${escapeHtml(item.text)}"><i data-lucide="x"></i></button></li>`).join('');
}

const progressBar = (done, total) => (total ? `<span class="trip-progress"><b style="width:${Math.round((done / total) * 100)}%"></b></span>` : '');
const presetChips = (attr, list) => (list.length ? `<div class="trip-presets">${list.map((text) => `<button type="button" ${attr}="${escapeHtml(text)}"><i data-lucide="plus"></i>${escapeHtml(text)}</button>`).join('')}</div>` : '');

function packingSuggestions(trip, pack) {
  const have = new Set((pack?.items || []).map((item) => normalizeText(item.text)));
  const kinds = new Set(stopsOf(trip).map((stop) => stop.category));
  const base = (typeof NOTE_TEMPLATES !== 'undefined' ? NOTE_TEMPLATES.find((template) => template.id === 'trip')?.items : null) || [];
  const extras = [...kinds].flatMap((kind) => PACKING_EXTRAS[kind] || []);
  return [...new Set([...extras, ...base])].filter((text) => !have.has(normalizeText(text))).slice(0, 8);
}

function tripPrepView(trip, stops, prep) {
  const shared = (label) => `<p class="trip-shared"><i data-lucide="${label === 'nota' ? 'notebook-pen' : 'list-todo'}"></i>También en Casa → Pendientes${label === 'nota' ? ' → Notas' : `, en la lista «${escapeHtml(trip.task_list || '')}»`}</p>`;
  const openTasks = [...prep.open].sort((first, second) => first.due_date.localeCompare(second.due_date));
  const taskTitles = new Set([...prep.open, ...prep.done].map((task) => normalizeText(task.title)));
  const careItems = prep.care?.items || [];
  const careTexts = new Set(careItems.map((item) => normalizeText(item.text)));
  const defaultDeadline = trip.start_date && tripPhase(trip) === 'upcoming' ? '7' : '';
  return `<section class="trip-prep-card is-todo">
      <header><span class="trip-prep-icon">✅</span><div><h3>Antes de ir</h3>${shared('lista')}</div>${prep.todo.total ? `<b class="trip-prep-count">${prep.todo.done}/${prep.todo.total}</b>` : ''}<button type="button" class="icon-button small" data-trip-open-list aria-label="Ver en Pendientes" title="Ver en Pendientes"><i data-lucide="arrow-up-right"></i></button></header>
      ${progressBar(prep.todo.done, prep.todo.total)}
      ${openTasks.length || prep.done.length ? `<ul class="trip-checks">${openTasks.map((task) => `<li class="trip-check-row" data-task-row="${escapeHtml(task.id)}"><button type="button" class="trip-check" data-trip-task-done="${escapeHtml(task.id)}" aria-label="Hecho: ${escapeHtml(task.title)}"><i data-lucide="check"></i></button><span><strong>${escapeHtml(task.title)}</strong><small class="${deadlineTone(task)}">${escapeHtml(deadlineLabel(task))} · ${escapeHtml(assigneeLabel(task))}</small></span></li>`).join('')}${prep.done.map((task) => `<li class="trip-check-row is-done"><button type="button" class="trip-check is-on" data-trip-task-undo="${escapeHtml(task.id)}" aria-label="Desmarcar: ${escapeHtml(task.title)}"><i data-lucide="check"></i></button><span><strong>${escapeHtml(task.title)}</strong><small>Hecho${task.completion?.done_by ? ` por ${escapeHtml(task.completion.done_by === currentUser ? 'ti' : task.completion.done_by)}` : ''}</small></span></li>`).join('')}</ul>` : '<p class="trip-day-empty">Reservas, billetes, seguro… lo que haya que dejar hecho antes de salir.</p>'}
      <form class="trip-add-row" data-trip-task-form autocomplete="off"><input name="title" type="text" maxlength="80" placeholder="Reservar la cena del sábado" aria-label="Algo que hacer antes de ir" data-trip-focus="task" /><select name="deadline" aria-label="Plazo">${BEFORE_DEADLINES.filter(([days]) => !days || trip.start_date).map(([days, label]) => `<option value="${days}" ${days === defaultDeadline ? 'selected' : ''}>${label}</option>`).join('')}</select><button type="submit" aria-label="Añadir"><i data-lucide="arrow-up"></i></button></form>
      ${presetChips('data-trip-task-preset', BEFORE_PRESETS.filter((text) => !taskTitles.has(normalizeText(text))).slice(0, 5))}
    </section>

    <section class="trip-prep-card is-pack">
      <header><span class="trip-prep-icon">🧳</span><div><h3>Qué llevar</h3>${shared('nota')}</div>${prep.packing.total ? `<b class="trip-prep-count">${prep.packing.done}/${prep.packing.total}</b>` : ''}${prep.packNote ? `<button type="button" class="icon-button small" data-trip-open-note="${escapeHtml(prep.packNote.id)}" aria-label="Abrir la nota" title="Abrir la nota"><i data-lucide="arrow-up-right"></i></button>` : ''}</header>
      ${prep.packNote ? `${progressBar(prep.packing.done, prep.packing.total)}${prep.pack.items.length ? `<ul class="trip-checks">${checkItems('pack', prep.pack.items)}</ul>` : ''}
        <form class="trip-add-row" data-trip-note-form="pack" autocomplete="off"><input name="item" type="text" maxlength="120" placeholder="Añadir a la maleta" aria-label="Añadir a la maleta" data-trip-focus="pack" /><button type="submit" aria-label="Añadir"><i data-lucide="arrow-up"></i></button></form>
        ${presetChips('data-trip-pack-preset', packingSuggestions(trip, prep.pack))}`
        : `<p class="trip-day-empty">Una lista para ir marcando mientras hacéis la maleta, con lo básico ya puesto según los sitios del viaje.</p><button type="button" class="primary-button" data-trip-pack-create><i data-lucide="plus"></i> Empezar la maleta</button>`}
    </section>

    <section class="trip-prep-card is-care">
      <header><span class="trip-prep-icon">⚠️</span><div><h3>A tener en cuenta</h3>${shared('nota')}</div>${prep.careNote ? `<button type="button" class="icon-button small" data-trip-open-note="${escapeHtml(prep.careNote.id)}" aria-label="Abrir la nota" title="Abrir la nota"><i data-lucide="arrow-up-right"></i></button>` : ''}</header>
      <textarea class="trip-care-text" rows="3" maxlength="2000" placeholder="Precauciones y recordatorios: barrios a evitar de noche, la farmacia de guardia, que el martes cierra el museo…" aria-label="Precauciones y recordatorios" data-trip-care-text>${escapeHtml(prep.care?.text || '')}</textarea>
      ${careItems.length ? `<ul class="trip-checks">${checkItems('care', careItems)}</ul>` : ''}
      <form class="trip-add-row" data-trip-note-form="care" autocomplete="off"><input name="item" type="text" maxlength="120" placeholder="Añadir un recordatorio" aria-label="Añadir un recordatorio" data-trip-focus="care" /><button type="submit" aria-label="Añadir"><i data-lucide="arrow-up"></i></button></form>
      ${presetChips('data-trip-care-preset', CARE_PRESETS.filter((text) => !careTexts.has(normalizeText(text))).slice(0, 4))}
    </section>

    <section class="trip-prep-card is-info">
      <header><span class="trip-prep-icon">🗂️</span><div><h3>Datos prácticos</h3><p class="trip-shared">Reservas, documentos, dinero y teléfonos, a mano</p></div><button type="button" class="icon-button small" data-trip-info aria-label="Editar los datos prácticos" title="Editar"><i data-lucide="pencil"></i></button></header>
      <div class="trip-info-grid">${TRIP_INFO.map(([key, label, icon]) => `<button type="button" class="trip-info-cell${trip.info?.[key] ? '' : ' is-empty'}" data-trip-info="${key}"><i data-lucide="${icon}"></i><span><small>${label}</small><strong>${trip.info?.[key] ? escapeHtml(trip.info[key]) : 'Añadir'}</strong></span></button>`).join('')}</div>
    </section>`;
}

// ---------- Acciones ----------

function openTrip(id, { push = true } = {}) {
  openTripId = id;
  try { if (id) localStorage.setItem('umbral-trip-open', id); else localStorage.removeItem('umbral-trip-open'); } catch {}
  if (id) {
    tripKindFilter = '';
    tripDayFilter = '';
    if (push && history.state?.page !== 'trip') { history.pushState({ page: 'trip' }, '', '#viaje'); tripInHistory = true; }
  } else {
    tripInHistory = false;
  }
  rerenderTrips();
  document.querySelector('#usContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTrip() {
  if (tripInHistory && history.state?.page === 'trip') history.back();
  else openTrip(null);
}

function setTripTab(tab) {
  tripTab = tab;
  try { localStorage.setItem('umbral-trip-tab', tab); } catch {}
  rerenderTrips();
}

const tripListName = (row) => {
  const base = `Viaje · ${row.destination || row.title}`.slice(0, 30);
  const taken = new Set(trips.map((trip) => trip.task_list));
  return taken.has(base) && row.start_date ? `${base.slice(0, 25)} ${row.start_date.slice(0, 4)}` : base;
};

function openTripEditor(id = null, preset = {}) {
  const trip = id ? tripById(id) : { title: '', emoji: '✈️', color: 'sea', ...preset };
  if (!trip) return;
  const dest = { destination: trip.destination || null, country: trip.country || null, lat: trip.lat ?? null, lon: trip.lon ?? null };
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">${id ? 'Editar viaje' : 'Nuevo viaje'}</p><h2 id="usSheetTitle">${id ? escapeHtml(trip.title) : '¿A dónde vamos?'}</h2></div>
    <form class="item-editor trip-form" data-trip-form autocomplete="off">
      <div class="plant-field"><span>Destino</span>
        <div class="trip-dest-picked" data-trip-dest>${tripDestChip(dest)}</div>
        <div class="quick-add trip-dest-search"><div class="quick-add-row"><input name="q" type="search" maxlength="80" placeholder="Busca la ciudad, isla o zona" aria-label="Buscar destino" /><button type="button" data-trip-dest-search aria-label="Buscar"><i data-lucide="search"></i></button></div></div>
        <div class="place-results" data-trip-dest-results></div>
      </div>
      <label class="plant-field"><span>Nombre del viaje</span><input name="title" type="text" maxlength="60" required value="${escapeHtml(trip.title || '')}" placeholder="Lisboa en otoño" /></label>
      <div class="detail-grid"><label class="plant-field"><span>Ida</span><input name="start_date" type="date" value="${escapeHtml(trip.start_date || '')}" /></label><label class="plant-field"><span>Vuelta</span><input name="end_date" type="date" value="${escapeHtml(trip.end_date || '')}" /></label></div>
      <fieldset class="plant-field"><legend>Icono</legend><div class="choice-row trip-emoji-choices">${TRIP_EMOJIS.map((emoji) => `<label class="option-toggle"><input type="radio" name="emoji" value="${emoji}" ${emoji === (trip.emoji || '✈️') ? 'checked' : ''} /><span>${emoji}</span></label>`).join('')}</div></fieldset>
      <fieldset class="plant-field"><legend>Color de la portada</legend><div class="choice-row trip-color-choices">${Object.entries(TRIP_COLORS).map(([key, [from, to]]) => `<label class="option-toggle"><input type="radio" name="color" value="${key}" ${key === (trip.color || 'sea') ? 'checked' : ''} /><span style="--trip-a:${from};--trip-b:${to}" aria-label="${key}"></span></label>`).join('')}</div></fieldset>
      <label class="plant-field"><span>En una frase (opcional)</span><textarea name="summary" rows="2" maxlength="600" placeholder="Pasteles de nata, tranvía 28 y atardeceres en los miradores">${escapeHtml(trip.summary || '')}</textarea></label>
      <p class="recurring-intro"><i data-lucide="info"></i>Con fechas, el viaje sale con su cuenta atrás en Fechas y en Inicio.</p>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${id ? 'Guardar' : 'Crear el viaje'}</button>${id ? '<button type="button" class="link-button is-danger" data-trip-delete>Eliminar viaje</button>' : ''}</div>
    </form>`, { kind: 'trip-edit', id, dest });
}

const tripDestChip = (dest) => (dest.destination ? `<span class="trip-dest-chip"><i data-lucide="map-pin"></i><strong>${escapeHtml(dest.destination)}</strong>${dest.country ? `<small>${escapeHtml(dest.country)}</small>` : ''}</span>` : '<span class="trip-dest-chip is-empty">Sin elegir: búscalo abajo</span>');

async function searchTripDestination() {
  const input = usSheet.querySelector('[data-trip-form] [name="q"]');
  const query = input?.value.trim();
  if (!query) return input?.focus();
  const box = usSheet.querySelector('[data-trip-dest-results]');
  box.innerHTML = '<p class="empty-note">Buscando…</p>';
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=es&format=json`);
    const results = (await response.json()).results || [];
    usSheetState.results = results;
    box.innerHTML = results.length ? results.map((result, index) => `<button type="button" class="recipe-option" data-trip-dest-pick="${index}"><span class="pcat-icon tone-blue"><i data-lucide="map-pin"></i></span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml([result.admin1, result.country].filter(Boolean).join(', '))}</small></span></button>`).join('') : '<p class="empty-note">No lo encuentro. Puedes dejarlo escrito tal cual y guardar.</p>';
    lucide.createIcons();
  } catch {
    box.innerHTML = '<p class="empty-note">Sin conexión para buscar. Puedes dejarlo escrito tal cual.</p>';
  }
}

function pickTripDestination(index) {
  const result = usSheetState.results?.[index];
  if (!result) return;
  usSheetState.dest = { destination: result.name, country: result.country || null, lat: result.latitude, lon: result.longitude };
  const form = usSheet.querySelector('[data-trip-form]');
  form.q.value = '';
  if (!form.title.value.trim()) form.title.value = `Viaje a ${result.name}`.slice(0, 60);
  usSheet.querySelector('[data-trip-dest]').innerHTML = tripDestChip(usSheetState.dest);
  usSheet.querySelector('[data-trip-dest-results]').innerHTML = '';
  lucide.createIcons();
}

async function saveTrip(form) {
  const state = usSheetState;
  const values = Object.fromEntries(new FormData(form));
  const typed = values.q?.trim();
  const dest = state.dest?.destination ? state.dest : typed ? { destination: typed.slice(0, 80), country: null, lat: null, lon: null } : { destination: null, country: null, lat: null, lon: null };
  const start = values.start_date || null;
  const row = {
    title: values.title.trim().slice(0, 60) || `Viaje a ${dest.destination || 'algún sitio'}`.slice(0, 60),
    destination: dest.destination, country: dest.country, lat: dest.lat, lon: dest.lon,
    start_date: start,
    end_date: start ? (values.end_date && values.end_date >= start ? values.end_date : start) : null,
    emoji: values.emoji || '✈️',
    color: values.color || 'sea',
    summary: values.summary?.trim().slice(0, 600) || null
  };
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    let trip;
    if (state.id) {
      await tripsStore.update(state.id, row);
      trip = Object.assign(tripById(state.id), row);
    } else {
      const [created] = await tripsStore.insert({ ...row, info: {}, days: {}, task_list: tripListName(row), created_by_name: currentUser });
      trip = normalizeTrip(created);
      trips.push(trip);
      openTripId = trip.id;
      tripTab = 'plan';
      try { localStorage.setItem('umbral-trip-open', trip.id); } catch {}
      notifyHousehold(`${currentUser} ha creado un viaje ${trip.emoji || '✈️'}`, `${trip.title}${trip.start_date ? ` · ${tripRange(trip)}` : ''}`, { open: 'nosotros', tag: 'trips' });
    }
    await syncTripDate(trip);
    closeUsSheet();
    rerenderTrips();
    showToast(state.id ? 'Viaje guardado' : `${trip.emoji || '✈️'} ¡${trip.title} en marcha!`);
  } catch (error) {
    button.disabled = false;
    showSupabaseError('No se pudo guardar el viaje', error);
  }
}

// El viaje sale en Fechas (cuenta atrás en Inicio y la escena de la casa).
async function syncTripDate(trip) {
  if (typeof datesStore === 'undefined') return;
  const existing = trip.date_id && specialDates.find((entry) => entry.id === trip.date_id);
  try {
    if (!trip.start_date) {
      if (existing) {
        await datesStore.remove(existing.id);
        specialDates = specialDates.filter((entry) => entry.id !== existing.id);
      }
    } else {
      const row = { title: `Viaje a ${trip.destination || trip.title}`.slice(0, 60), kind: 'trip', date: trip.start_date, end_date: trip.end_date && trip.end_date > trip.start_date ? trip.end_date : null, yearly: false, emoji: (trip.emoji || '✈️').slice(0, 8) };
      if (existing) {
        await datesStore.update(existing.id, row);
        Object.assign(existing, row);
      } else {
        const [created] = await datesStore.insert(row);
        specialDates.push(created);
        await tripsStore.update(trip.id, { date_id: created.id });
        trip.date_id = created.id;
      }
    }
    shareWithScene();
  } catch (error) {
    console.warn('[Umbral] Fecha del viaje:', error?.message || error);
  }
}

async function deleteTrip(id) {
  const trip = tripById(id);
  if (!trip || !window.confirm(`¿Eliminar el viaje «${trip.title}»? Se borran también sus sitios, lo pendiente de «Antes de ir» y sus notas de maleta y precauciones.`)) return;
  try {
    const open = householdTasks.filter((task) => task.list === trip.task_list);
    if (trip.task_list && open.length) await tasksStore.update(open.map((task) => task.id), { active: false });
    for (const noteId of [trip.packing_note_id, trip.care_note_id]) if (tripNote(noteId)) await removeNote(noteId).catch(() => {});
    if (trip.date_id && specialDates.some((entry) => entry.id === trip.date_id)) {
      await datesStore.remove(trip.date_id);
      specialDates = specialDates.filter((entry) => entry.id !== trip.date_id);
    }
    const stops = stopsOf(trip);
    if (stops.length) await tripStopsStore.remove(stops.map((stop) => stop.id));
    await tripsStore.remove(id);
    trips = trips.filter((entry) => entry.id !== id);
    tripStops = tripStops.filter((stop) => stop.trip_id !== id);
    openTripId = null;
    closeUsSheet();
    tripInHistory = false;
    loadTasks();
    renderNotesSummary();
    renderNotesBoard();
    shareWithScene();
    rerenderTrips();
    showToast(`Viaje eliminado: ${trip.title}`);
  } catch (error) {
    showSupabaseError('No se pudo eliminar el viaje', error);
  }
}

// ----- Sitios -----

function stopWhereText(loc) {
  if (hasCoords(loc)) return `<i data-lucide="map-pin"></i><span>${loc.address ? escapeHtml(loc.address) : 'Ubicación guardada'}<small> · saldrá en el mapa</small></span>`;
  return '<i data-lucide="info"></i><span>Sin ubicación: búscalo arriba (o pega su enlace de Google Maps) para que salga en el mapa.</span>';
}

function openStopEditor(tripId, stopId = null, preset = {}) {
  const trip = tripById(tripId);
  const stop = stopId ? tripStops.find((entry) => entry.id === stopId) : { category: tripKindFilter || 'other', ...preset };
  if (!trip || !stop) return;
  const days = tripDays(trip);
  const loc = { lat: stop.lat ?? null, lon: stop.lon ?? null, address: stop.address || null };
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">${escapeHtml(trip.emoji || '✈️')} ${escapeHtml(trip.title)}</p><h2 id="usSheetTitle">${stopId ? escapeHtml(stop.name) : 'Nuevo sitio'}</h2></div>
    <form class="quick-add trip-stop-search" data-trip-stop-search autocomplete="off"><div class="quick-add-row"><input name="q" type="search" maxlength="300" placeholder="Busca un sitio o pega un enlace de Google Maps" aria-label="Buscar un sitio" /><button type="submit" aria-label="Buscar"><i data-lucide="search"></i></button></div></form>
    <div class="place-results" data-trip-stop-results></div>
    <form class="item-editor trip-stop-form" data-trip-stop-form autocomplete="off">
      <label class="plant-field"><span>Nombre</span><input name="name" type="text" maxlength="120" required value="${escapeHtml(stop.name || '')}" placeholder="Miradouro de Santa Luzia" /></label>
      <p class="trip-stop-where" data-trip-stop-where>${stopWhereText(loc)}</p>
      <fieldset class="plant-field"><legend>Qué es</legend><div class="choice-row trip-kind-choices">${Object.entries(STOP_KINDS).map(([id, kind]) => `<label class="option-toggle" style="--k:${kind.color}"><input type="radio" name="category" value="${id}" ${id === (stop.category || 'other') ? 'checked' : ''} /><span>${kind.emoji} ${kind.label}</span></label>`).join('')}</div></fieldset>
      <div class="detail-grid"><label class="plant-field"><span>Día</span><select name="day"><option value="">Sin día</option>${days.map((day, index) => `<option value="${day}" ${day === stop.day ? 'selected' : ''}>Día ${index + 1} · ${escapeHtml(shortDay(day))}</option>`).join('')}</select></label><label class="plant-field"><span>Hora</span><input name="time" type="time" value="${escapeHtml(stop.time || '')}" /></label></div>
      <div class="choice-row"><label class="option-toggle"><input type="checkbox" name="must" ${stop.must ? 'checked' : ''} /><span><i data-lucide="star"></i>Imprescindible</span></label><label class="option-toggle"><input type="checkbox" name="booked" ${stop.booked ? 'checked' : ''} /><span><i data-lucide="ticket"></i>Reservado</span></label></div>
      <label class="plant-field"><span>Notas</span><textarea name="notes" rows="3" maxlength="1000" placeholder="Qué pedir, a qué hora ir, el código de la reserva…">${escapeHtml(stop.notes || '')}</textarea></label>
      <label class="plant-field"><span>Enlace (Google Maps, web, reserva)</span><input name="url" type="url" maxlength="500" value="${escapeHtml(stop.url || '')}" placeholder="https://" /></label>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar</button>${stopId ? `<a class="pill-button is-quiet" href="${escapeHtml(mapsLink(stop, trip))}" target="_blank" rel="noreferrer"><i data-lucide="navigation"></i> Google Maps</a><button type="button" class="link-button is-danger" data-trip-stop-delete>Quitar</button>` : ''}</div>
    </form>`, { kind: 'trip-stop', tripId, id: stopId, loc });
  if (!stopId) setTimeout(() => usSheet.querySelector('[data-trip-stop-search] input')?.focus({ preventScroll: true }), 250);
}

function applyStopLocation(found) {
  const form = usSheet.querySelector('[data-trip-stop-form]');
  usSheetState.loc = { lat: found.lat, lon: found.lon, address: found.address || null };
  if (found.name) form.name.value = found.name.slice(0, 120);
  if (found.category && found.category !== 'other') form.querySelector(`[name="category"][value="${found.category}"]`).checked = true;
  if (found.url) form.url.value = found.url;
  usSheet.querySelector('[data-trip-stop-where]').innerHTML = stopWhereText(usSheetState.loc);
  usSheet.querySelector('[data-trip-stop-results]').innerHTML = '';
  lucide.createIcons();
}

async function runStopSearch(query) {
  const box = usSheet.querySelector('[data-trip-stop-results]');
  const link = parseMapsLink(query);
  if (link) {
    if (hasCoords(link)) {
      applyStopLocation(link);
      showToast('📍 Sitio de Google Maps listo');
    } else {
      const form = usSheet.querySelector('[data-trip-stop-form]');
      form.url.value = link.url;
      if (link.name) form.name.value = link.name;
      box.innerHTML = '<p class="empty-note">He guardado el enlace, pero no trae la ubicación (pasa con los enlaces cortos). Busca el sitio por su nombre para situarlo en el mapa.</p>';
    }
    return;
  }
  box.innerHTML = '<p class="empty-note">Buscando…</p>';
  try {
    const results = await searchStops(query, tripById(usSheetState.tripId));
    usSheetState.results = results;
    box.innerHTML = results.length ? results.map((result, index) => {
      const kind = STOP_KINDS[result.category] || STOP_KINDS.other;
      return `<button type="button" class="recipe-option" data-trip-stop-pick="${index}"><span class="trip-spot-badge" style="--k:${kind.color}">${kind.emoji}</span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(result.address || kind.label)}</small></span></button>`;
    }).join('') : '<p class="empty-note">No lo encuentro. Prueba con otro nombre, o pega el enlace de Google Maps.</p>';
  } catch {
    box.innerHTML = '<p class="empty-note">Sin conexión para buscar ahora mismo.</p>';
  }
}

// Coloca un sitio en su día: si tiene hora, entre los que tienen hora; si no, al final.
async function placeInDay(stop) {
  const list = tripStops.filter((entry) => entry.trip_id === stop.trip_id && (entry.day || null) === (stop.day || null) && entry.id !== stop.id).sort(byPosition);
  let index = list.length;
  if (stop.time) {
    const after = list.findIndex((entry) => entry.time && entry.time > stop.time);
    if (after >= 0) index = after;
  }
  list.splice(index, 0, stop);
  await renumberStops(list);
}

async function renumberStops(list) {
  const changes = list.map((stop, index) => [stop, (index + 1) * 10]).filter(([stop, position]) => stop.position !== position);
  await Promise.all(changes.map(([stop, position]) => tripStopsStore.update(stop.id, { position })));
  changes.forEach(([stop, position]) => { stop.position = position; });
}

async function saveStop(form) {
  const state = usSheetState;
  const values = Object.fromEntries(new FormData(form));
  const name = values.name.trim().slice(0, 120);
  if (!name) return form.name.focus();
  const row = {
    name,
    category: STOP_KINDS[values.category] ? values.category : 'other',
    day: values.day || null,
    time: values.time || null,
    must: Boolean(values.must),
    booked: Boolean(values.booked),
    notes: values.notes.trim().slice(0, 1000) || null,
    url: values.url.trim().slice(0, 500) || null,
    lat: hasCoords(state.loc) ? Number(state.loc.lat) : null,
    lon: hasCoords(state.loc) ? Number(state.loc.lon) : null,
    address: state.loc.address ? String(state.loc.address).slice(0, 200) : null
  };
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const trip = tripById(state.tripId);
    if (state.id) {
      const stop = tripStops.find((entry) => entry.id === state.id);
      const moved = stop.day !== row.day || stop.time !== row.time;
      await tripStopsStore.update(state.id, row);
      Object.assign(stop, row);
      if (moved) await placeInDay(stop);
    } else {
      const [created] = await tripStopsStore.insert({ ...row, trip_id: state.tripId, position: 0, created_by_name: currentUser });
      tripStops.push(created);
      await placeInDay(created);
      notifyHousehold(`${currentUser} añadió un sitio al viaje ${trip?.emoji || '✈️'}`, `${STOP_KINDS[row.category].emoji} ${name} · ${trip?.title || ''}`, { open: 'nosotros', tag: 'trips' });
    }
    closeUsSheet();
    rerenderTrips();
    const dayIndex = tripDays(trip).indexOf(row.day);
    showToast(`${STOP_KINDS[row.category].emoji} ${name}${dayIndex >= 0 ? ` · día ${dayIndex + 1}` : ''}`);
  } catch (error) {
    button.disabled = false;
    showSupabaseError('No se pudo guardar el sitio', error);
  }
}

async function deleteStop(id) {
  const stop = tripStops.find((entry) => entry.id === id);
  if (!stop || !window.confirm(`¿Quitar «${stop.name}» del viaje?`)) return;
  try {
    await tripStopsStore.remove(id);
    tripStops = tripStops.filter((entry) => entry.id !== id);
    closeUsSheet();
    rerenderTrips();
  } catch (error) {
    showSupabaseError('No se pudo quitar', error);
  }
}

async function moveStop(id, direction) {
  const stop = tripStops.find((entry) => entry.id === id);
  if (!stop) return;
  const list = tripStops.filter((entry) => entry.trip_id === stop.trip_id && entry.day === stop.day).sort(byPosition);
  const from = list.indexOf(stop);
  const to = from + direction;
  if (to < 0 || to >= list.length) return;
  [list[from], list[to]] = [list[to], list[from]];
  try {
    await renumberStops(list);
    window.umbralMobile?.tap?.();
    rerenderTrips();
  } catch (error) {
    showSupabaseError('No se pudo mover', error);
  }
}

// ----- Días y datos prácticos -----

function openDayEditor(trip, day) {
  const meta = trip.days?.[day] || {};
  const index = tripDays(trip).indexOf(day);
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">Día ${index + 1} · ${escapeHtml(weekdayLabel(day))}</p><h2 id="usSheetTitle">${meta.title ? escapeHtml(meta.title) : 'El plan del día'}</h2></div>
    <form class="item-editor" data-trip-day-form>
      <label class="plant-field"><span>Nombre del día</span><input name="title" type="text" maxlength="60" value="${escapeHtml(meta.title || '')}" placeholder="Alfama y Baixa" /></label>
      <label class="plant-field"><span>Nota del día</span><textarea name="note" rows="3" maxlength="400" placeholder="Salir pronto, comer por la zona, a las 19:00 atardecer en el mirador…">${escapeHtml(meta.note || '')}</textarea></label>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar</button></div>
    </form>`, { kind: 'trip-day', tripId: trip.id, day });
}

async function saveTripField(trip, field, value, message) {
  try {
    await tripsStore.update(trip.id, { [field]: value });
    trip[field] = value;
    closeUsSheet();
    rerenderTrips();
    if (message) showToast(message);
  } catch (error) {
    showSupabaseError('No se pudo guardar', error);
  }
}

function openInfoEditor(trip, focusKey = '') {
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">${escapeHtml(trip.emoji || '✈️')} ${escapeHtml(trip.title)}</p><h2 id="usSheetTitle">Datos prácticos</h2></div>
    <form class="item-editor" data-trip-info-form>
      ${TRIP_INFO.map(([key, label, , hint]) => `<label class="plant-field"><span>${label}</span><textarea name="${key}" rows="2" maxlength="500" placeholder="${escapeHtml(hint)}">${escapeHtml(trip.info?.[key] || '')}</textarea></label>`).join('')}
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar</button></div>
    </form>`, { kind: 'trip-info', tripId: trip.id });
  if (focusKey) setTimeout(() => usSheet.querySelector(`[name="${focusKey}"]`)?.focus({ preventScroll: false }), 250);
}

// ----- Preparar: tareas y notas -----

async function addTripTask(trip, title, deadline) {
  let dueDate = NO_DEADLINE;
  if (deadline && trip.start_date) {
    dueDate = addDaysToISO(trip.start_date, -Number(deadline));
    if (dueDate < todayISO()) dueDate = todayISO();
  }
  return createTask({ title, dueDate, list: trip.task_list, assignee: 'both' });
}

async function reopenTripTask(id) {
  const task = tripDoneTasks.find((entry) => entry.id === id);
  if (!task) return;
  try {
    await tasksStore.update(id, { active: true });
    if (task.completion?.id) await completionsStore.remove(task.completion.id);
    tripDoneTasks = tripDoneTasks.filter((entry) => entry.id !== id);
    await loadTasks();
  } catch (error) {
    showSupabaseError('No se pudo desmarcar', error);
  }
}

// La maleta y las precauciones son notas compartidas: se crean la primera vez que hacen falta.
async function ensureTripNote(trip, which, items = []) {
  const field = which === 'pack' ? 'packing_note_id' : 'care_note_id';
  const existing = tripNote(trip[field]);
  if (existing) return existing;
  const place = trip.destination || trip.title;
  const draft = which === 'pack'
    ? { content: `🧳 Maleta · ${place}`, color: 'sky' }
    : { content: `⚠️ ${place} · a tener en cuenta`, color: 'lemon' };
  const id = await saveNote({ ...draft, details: serializeNoteBody('', items.map((text) => ({ text, done: false }))), scope: 'shared', pinned: false, completed: false });
  await tripsStore.update(trip.id, { [field]: id });
  trip[field] = id;
  return tripNote(id);
}

async function editTripNote(trip, which, change, focus = '') {
  try {
    const note = await ensureTripNote(trip, which);
    const body = parseNoteBody(note.details);
    change(body);
    const details = serializeNoteBody(body.text, body.items);
    await saveNote({ ...note, details });
    const stored = tripNote(note.id);
    if (stored) stored.details = details;
    renderNotesSummary();
    renderNotesBoard();
    rerenderTrips(focus);
  } catch (error) {
    showSupabaseError('No se pudo guardar la nota', error);
  }
}

async function startPacking(trip) {
  try {
    await ensureTripNote(trip, 'pack', packingSuggestions(trip, null).concat(['Cargadores', 'Documentos']).filter((text, index, list) => list.indexOf(text) === index));
    renderNotesSummary();
    renderNotesBoard();
    rerenderTrips();
    showToast('🧳 Maleta lista para ir marcando (también en Notas)');
  } catch (error) {
    showSupabaseError('No se pudo crear la lista', error);
  }
}

async function tripToMap(trip) {
  const wish = places.find((place) => place.kind === 'wish' && normalizeText(place.name) === normalizeText(trip.destination));
  if (wish) return visitPlace(wish.id);
  if (!hasCoords(trip)) return showToast('Este viaje no tiene el destino situado: edítalo y búscalo');
  const row = { name: trip.destination.slice(0, 80), country: trip.country || null, lat: trip.lat, lon: trip.lon, kind: 'trip', note: trip.title.slice(0, 200), visited_on: trip.end_date || trip.start_date, added_by: currentUser };
  try {
    if (placesShared) { const [created] = await placesStore.insert(row); places.push(created); }
    else { places.push({ ...row, id: createLocalId() }); saveFallbackPlaces(); }
    window.dispatchEvent(new CustomEvent('umbral:places', { detail: { places } }));
    rerenderTrips();
    showToast(`❤️ ${trip.destination}, ¡a vuestro mapa!`);
  } catch (error) {
    showSupabaseError('No se pudo añadir al mapa', error);
  }
}

// ---------- Eventos ----------

const usViewEl = document.querySelector('#usView');

usViewEl.addEventListener('click', (event) => {
  const target = event.target;
  const hit = (selector) => target.closest(selector);
  let el;
  if (hit('[data-trip-new]')) return openTripEditor();
  if ((el = hit('[data-open-trip]'))) return openTrip(el.dataset.openTrip);
  if ((el = hit('[data-trip-from-wish]'))) {
    const place = places.find((entry) => entry.id === el.dataset.tripFromWish);
    return place && openTripEditor(null, { title: `Viaje a ${place.name}`.slice(0, 60), destination: place.name, country: place.country, lat: place.lat, lon: place.lon });
  }
  const trip = openTripId && tripById(openTripId);
  if (!trip) return;
  if (hit('[data-trip-back]')) return closeTrip();
  if (hit('[data-trip-edit]')) return openTripEditor(trip.id);
  if ((el = hit('[data-trip-tab]'))) return setTripTab(el.dataset.tripTab);
  if ((el = hit('[data-trip-kind]'))) { tripKindFilter = el.dataset.tripKind; return rerenderTrips(); }
  if ((el = hit('[data-trip-day-filter]'))) { tripDayFilter = el.dataset.tripDayFilter; return rerenderTrips(); }
  if ((el = hit('[data-trip-add-stop]'))) return openStopEditor(trip.id, null, { day: el.dataset.tripAddStop || null });
  if ((el = hit('[data-trip-stop]'))) return openStopEditor(trip.id, el.dataset.tripStop);
  if ((el = hit('[data-trip-move]'))) return moveStop(el.dataset.tripMove, Number(el.dataset.dir));
  if ((el = hit('[data-trip-day]'))) return openDayEditor(trip, el.dataset.tripDay);
  if ((el = hit('[data-trip-info]'))) return openInfoEditor(trip, el.dataset.tripInfo);
  if (hit('[data-trip-kml]')) return exportTripKml(trip);
  if (hit('[data-trip-to-map]')) return tripToMap(trip);
  if ((el = hit('[data-trip-task-done]'))) return completeTask(el.dataset.tripTaskDone);
  if ((el = hit('[data-trip-task-undo]'))) return reopenTripTask(el.dataset.tripTaskUndo);
  if ((el = hit('[data-trip-task-preset]'))) return addTripTask(trip, el.dataset.tripTaskPreset, trip.start_date && tripPhase(trip) === 'upcoming' ? '7' : '');
  if (hit('[data-trip-open-list]')) {
    setActiveList(trip.task_list);
    return openPending({ filter: 'tasks' });
  }
  if ((el = hit('[data-trip-open-note]'))) return openNote(el.dataset.tripOpenNote);
  if (hit('[data-trip-pack-create]')) return startPacking(trip);
  if ((el = hit('[data-trip-pack-preset]'))) return editTripNote(trip, 'pack', (body) => body.items.push({ text: el.dataset.tripPackPreset, done: false }));
  if ((el = hit('[data-trip-care-preset]'))) return editTripNote(trip, 'care', (body) => body.items.push({ text: el.dataset.tripCarePreset, done: false }));
  if ((el = hit('[data-trip-note-toggle]'))) {
    const [which, index] = el.dataset.tripNoteToggle.split(':');
    window.umbralMobile?.tap?.();
    return editTripNote(trip, which, (body) => { if (body.items[index]) body.items[index].done = !body.items[index].done; });
  }
  if ((el = hit('[data-trip-note-remove]'))) {
    const [which, index] = el.dataset.tripNoteRemove.split(':');
    return editTripNote(trip, which, (body) => body.items.splice(Number(index), 1));
  }
});

usViewEl.addEventListener('submit', (event) => {
  const form = event.target;
  const trip = openTripId && tripById(openTripId);
  if (!trip) return;
  if (form.hasAttribute('data-trip-task-form')) {
    event.preventDefault();
    const title = form.title.value.trim();
    if (!title) return form.title.focus();
    addTripTask(trip, title, form.deadline.value).then(() => rerenderTrips('task'));
  }
  if (form.hasAttribute('data-trip-note-form')) {
    event.preventDefault();
    const which = form.dataset.tripNoteForm;
    const text = form.item.value.trim();
    if (!text) return form.item.focus();
    editTripNote(trip, which, (body) => body.items.push({ text: text.slice(0, 120), done: false }), which);
  }
});

// Las precauciones (texto libre) se guardan al salir del campo.
usViewEl.addEventListener('change', (event) => {
  if (!event.target.matches('[data-trip-care-text]')) return;
  const trip = openTripId && tripById(openTripId);
  const text = event.target.value.trim().slice(0, 2000);
  if (!trip || (text === (tripPrep(trip).care?.text || ''))) return;
  editTripNote(trip, 'care', (body) => { body.text = text; });
});

usSheet.addEventListener('click', (event) => {
  const state = usSheetState;
  if (!state || !String(state.kind).startsWith('trip')) return;
  const target = event.target;
  let el;
  if (target.closest('[data-trip-dest-search]')) return searchTripDestination();
  if ((el = target.closest('[data-trip-dest-pick]'))) return pickTripDestination(Number(el.dataset.tripDestPick));
  if ((el = target.closest('[data-trip-stop-pick]'))) return applyStopLocation(state.results[Number(el.dataset.tripStopPick)]);
  if (target.closest('[data-trip-stop-delete]')) return deleteStop(state.id);
  if (target.closest('[data-trip-delete]')) return deleteTrip(state.id);
});

usSheet.addEventListener('submit', (event) => {
  const state = usSheetState;
  if (!state || !String(state.kind).startsWith('trip')) return;
  event.preventDefault();
  const form = event.target;
  if (form.hasAttribute('data-trip-form')) {
    // Intro en el buscador de destino busca; no guarda el viaje.
    if (document.activeElement === form.q && form.q.value.trim()) return searchTripDestination();
    return saveTrip(form);
  }
  if (form.hasAttribute('data-trip-stop-search')) return form.q.value.trim() && runStopSearch(form.q.value.trim());
  if (form.hasAttribute('data-trip-stop-form')) return saveStop(form);
  const trip = tripById(state.tripId);
  if (!trip) return;
  if (form.hasAttribute('data-trip-day-form')) {
    const meta = { title: form.title.value.trim().slice(0, 60), note: form.note.value.trim().slice(0, 400) };
    const days = { ...(trip.days || {}) };
    if (meta.title || meta.note) days[state.day] = meta;
    else delete days[state.day];
    return saveTripField(trip, 'days', days);
  }
  if (form.hasAttribute('data-trip-info-form')) {
    const info = Object.fromEntries(TRIP_INFO.map(([key]) => [key, form[key].value.trim().slice(0, 500)]).filter(([, value]) => value));
    return saveTripField(trip, 'info', info, 'Datos prácticos guardados');
  }
});

window.addEventListener('popstate', () => {
  // Atrás desde la ficha de un viaje vuelve a la lista de viajes.
  if (tripInHistory && openTripId && !['trip', 'us-sheet', 'note', 'item'].includes(history.state?.page)) {
    tripInHistory = false;
    openTripId = null;
    try { localStorage.removeItem('umbral-trip-open'); } catch {}
    rerenderTrips();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    tripTab = localStorage.getItem('umbral-trip-tab') || 'plan';
    openTripId = localStorage.getItem('umbral-trip-open') || null;
  } catch {}
});

// Las tareas y notas del viaje también se tocan desde Pendientes: se refresca al cambiar.
window.addEventListener('umbral:tasks', () => {
  if (!trips.length) return;
  clearTimeout(tripHistoryTimer);
  tripHistoryTimer = setTimeout(async () => { await loadTripTaskHistory(); softRenderTrips(); }, 400);
});
window.addEventListener('umbral:notes', () => { if (trips.length) softRenderTrips(); });

document.addEventListener('umbral:ready', () => {
  loadTrips();
  const reload = () => {
    clearTimeout(tripsRenderTimer);
    tripsRenderTimer = setTimeout(() => loadTrips({ quiet: true }), 400);
  };
  tripsStore.subscribe(reload);
  tripStopsStore.subscribe(reload);
});
