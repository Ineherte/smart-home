// Nuestro mapa (Nosotros → Viajes): los sitios en los que habéis estado juntos y los que queréis
// visitar. Cada sitio tiene un estado (casa, familia, hemos estado, queremos ir: lo usa también el
// modo Sims) y un tipo (ciudad, playa, restaurante…). Se añaden pegando el enlace de Google Maps
// o buscándolos por su nombre, y el mapa se filtra por tipo y estado.
// Datos en la tabla places (places.sql y places-v2.sql). Si aún no existe, el mapa funciona en
// este móvil con los sitios de siempre y avisa de que falta ejecutar el SQL para compartirlo.
// Usa de map-utils.js los tipos y los enlaces, y de nosotros.js el sheet (usSheet).
const placesStore = createHouseholdStore({ table: 'places', localKey: 'umbral-places' });
const PLACE_KINDS = {
  trip: { label: 'Hemos estado', emoji: '❤️' },
  wish: { label: 'Queremos ir', emoji: '⭐' },
  family: { label: 'Familia', emoji: '👪' },
  home: { label: 'Casa', emoji: '🏠' }
};
const isWish = (place) => place.kind === 'wish';
const STARTER_PLACES = [
  ['Turín', 'Italia', 45.0703, 7.6869, 'home', 'Donde vivimos'],
  ['Chieti', 'Italia', 42.3510, 14.1675, 'family', 'La familia de Matteo'],
  ['Pozo Lorente', 'España', 39.0667, -1.2833, 'family', ''],
  ['Elda', 'España', 38.4775, -0.7917, 'family', ''],
  ['Alicante', 'España', 38.3452, -0.4810, 'trip', ''],
  ['Sevilla', 'España', 37.3891, -5.9845, 'trip', ''],
  ['Granada', 'España', 37.1773, -3.5986, 'trip', ''],
  ['Valencia', 'España', 39.4699, -0.3763, 'trip', ''],
  ['Madrid', 'España', 40.4168, -3.7038, 'trip', ''],
  ['Valladolid', 'España', 41.6523, -4.7245, 'trip', ''],
  ['Burgos', 'España', 42.3439, -3.6969, 'trip', ''],
  ['Niza', 'Francia', 43.7102, 7.2620, 'trip', ''],
  ['Villefranche-sur-Mer', 'Francia', 43.7040, 7.3111, 'trip', ''],
  ['Antibes', 'Francia', 43.5808, 7.1251, 'trip', ''],
  ['Menorca', 'España', 39.9496, 4.1104, 'trip', ''],
  ['Alba', 'Italia', 44.7004, 8.0352, 'trip', ''],
  ['Noli', 'Italia', 44.2060, 8.4157, 'trip', ''],
  ['Génova', 'Italia', 44.4056, 8.9463, 'trip', '']
].map(([name, country, lat, lon, kind, note]) => ({ name, country, lat, lon, kind, note: note || null }));
// Campos de places-v2.sql: si la base aún no los tiene, se guarda sin ellos y se avisa una vez.
const PLACE_V2_FIELDS = ['category', 'url', 'address'];
let placesV2 = true;
let places = [];
let placesShared = true;
let placesMap = null;
let placesLayer = null;
let placesMarkers = new Map();
let placeStatus = 'all';
let placeType = '';
let placeSelected = null;
let placeOnlyVisible = false;
let placeHere = null;

const placeType_ = (place) => (PLACE_TYPES[place.category] ? place.category : 'city');
const placeTypeInfo = (place) => PLACE_TYPES[placeType_(place)];
const placeEmoji = (place) => (place.kind === 'home' ? '🏠' : place.kind === 'family' ? '👪' : placeTypeInfo(place).emoji);
const placeStatusLabel = (place) => (place.kind === 'wish' ? 'Queremos ir' : place.kind === 'home' ? 'Casa' : place.kind === 'family' ? 'Familia' : 'Hemos estado');
const placeById = (id) => places.find((place) => place.id === id);
const matchesStatus = (place) => placeStatus === 'all' || (placeStatus === 'wish' ? isWish(place) : !isWish(place));
const filteredPlaces = () => places.filter((place) => hasCoords(place) && matchesStatus(place) && (!placeType || placeType_(place) === placeType));

async function loadPlaces() {
  try {
    places = await placesStore.list({ build: (query) => query.order('created_at') });
    placesShared = true;
    if (!places.length) places = await placesStore.insert(STARTER_PLACES.map((place) => ({ ...place, added_by: currentUser })));
  } catch (error) {
    console.warn('[Umbral] Mapa:', error?.message || error);
    placesShared = false;
    try { places = JSON.parse(localStorage.getItem('umbral-places-fallback') || 'null') || STARTER_PLACES.map((place, i) => ({ ...place, id: `seed-${i}` })); } catch { places = STARTER_PLACES; }
  }
  // Por si los dos móviles sembraron a la vez: un sitio por nombre y sitio.
  const seen = new Set();
  places = places.filter((place) => { const key = `${normalizeText(place.name)}|${Math.round(place.lat * 100)}|${Math.round(place.lon * 100)}`; if (seen.has(key)) return false; seen.add(key); return true; });
  if (placeSelected && !placeById(placeSelected)) placeSelected = null;
  window.dispatchEvent(new CustomEvent('umbral:places', { detail: { places } }));
}
const saveFallbackPlaces = () => { try { localStorage.setItem('umbral-places-fallback', JSON.stringify(places)); } catch {} };
const placesChanged = () => window.dispatchEvent(new CustomEvent('umbral:places', { detail: { places } }));

// Guarda en Supabase quitando los campos nuevos si la base aún no los tiene.
async function storePlace(run, row) {
  const strip = (data) => (placesV2 ? data : Object.fromEntries(Object.entries(data).filter(([key]) => !PLACE_V2_FIELDS.includes(key))));
  try {
    return await run(strip(row));
  } catch (error) {
    if (!placesV2 || !/column|schema cache/i.test(error?.message || '') || !PLACE_V2_FIELDS.some((field) => (error.message || '').includes(field))) throw error;
    placesV2 = false;
    showToast('Falta ejecutar places-v2.sql en Supabase: el tipo de sitio no se guardará');
    return run(strip(row));
  }
}

// ---------- Pintar ----------

// Lo llama renderTrips (trips.js) debajo de los viajes.
function renderMap() {
  if (document.querySelector('#placesWrap.is-full')) toggleFullMap();
  document.querySelectorAll('body > #placesWrap').forEach((el) => el.remove());
  setTimeout(mountMap, 0);
  const been = places.filter((place) => !isWish(place));
  const countries = new Set(been.map((place) => place.country).filter(Boolean));
  return `<section class="panel places-panel">
    <div class="section-heading"><div><p class="eyebrow">Nuestro mapa</p><h2>${been.length} sitios juntos</h2></div><button type="button" class="pill-button" data-place-add><i data-lucide="map-pin-plus"></i> Añadir sitio</button></div>
    <div class="places-kpis">
      <button type="button" data-place-status="trip"><b>${countries.size}</b>${countries.size === 1 ? 'país' : 'países'}</button>
      <button type="button" data-place-status="trip"><b>${been.length}</b>${been.length === 1 ? 'sitio' : 'sitios'}</button>
      <button type="button" data-place-status="wish"><b>${places.length - been.length}</b>por visitar</button>
    </div>
    <div id="placesControls">${placesControls()}</div>
    <div class="places-map-wrap" id="placesWrap">
      <div class="places-map" id="usMap" role="application" aria-label="Mapa de vuestros sitios"></div>
      <div class="places-tools">
        <button type="button" data-map-full aria-label="Pantalla completa" title="Pantalla completa"><i data-lucide="maximize"></i></button>
        <button type="button" data-map-fit aria-label="Ver todos los sitios" title="Ver todo"><i data-lucide="globe"></i></button>
        ${navigator.geolocation ? '<button type="button" data-map-locate aria-label="Dónde estoy" title="Dónde estoy"><i data-lucide="locate-fixed"></i></button>' : ''}
      </div>
      <div class="places-card" id="placeCard" ${placeSelected ? '' : 'hidden'}>${placeCard()}</div>
    </div>
    ${placesShared ? '' : '<p class="notes-local-warning"><i data-lucide="info"></i> Para que el mapa se comparta entre los dos, ejecutad supabase/sql/places.sql y places-v2.sql en Supabase.</p>'}
    <div class="places-list-head"><h3 id="placesListTitle">${placesListTitle()}</h3><label class="mine-toggle"><input type="checkbox" data-place-visible ${placeOnlyVisible ? 'checked' : ''} /><span><i data-lucide="scan"></i>Solo lo que se ve</span></label></div>
    <div id="placesList">${placesList()}</div>
  </section>`;
}

function placesControls() {
  const count = (status) => places.filter((place) => hasCoords(place) && (status === 'all' || (status === 'wish' ? isWish(place) : !isWish(place)))).length;
  const inStatus = places.filter((place) => hasCoords(place) && matchesStatus(place));
  const types = Object.entries(PLACE_TYPES).filter(([id]) => inStatus.some((place) => placeType_(place) === id));
  return `<div class="segmented is-wide places-status" role="group" aria-label="Qué sitios ver">${[['all', 'Todo'], ['trip', 'Visitados'], ['wish', 'Por visitar']].map(([id, label]) => `<button type="button" data-place-status="${id}" aria-pressed="${placeStatus === id}">${label} <b>${count(id)}</b></button>`).join('')}</div>
    ${types.length > 1 ? `<div class="trip-chip-row places-types" role="group" aria-label="Tipo de sitio"><button type="button" class="filter-chip${placeType ? '' : ' is-on'}" data-place-type="">Todos</button>${types.map(([id, type]) => `<button type="button" class="filter-chip trip-kind-chip${placeType === id ? ' is-on' : ''}" style="--k:${type.color}" data-place-type="${id}">${type.emoji} ${type.plural} <b>${inStatus.filter((place) => placeType_(place) === id).length}</b></button>`).join('')}</div>` : ''}`;
}

function placeCard() {
  const place = placeSelected && placeById(placeSelected);
  if (!place) return '';
  const type = placeTypeInfo(place);
  return `<span class="places-card-badge" style="--k:${type.color}">${placeEmoji(place)}</span>
    <div class="places-card-copy"><small>${escapeHtml([type.label, placeStatusLabel(place), place.country].filter(Boolean).join(' · '))}</small><strong>${escapeHtml(place.name)}</strong>${place.note ? `<p>${escapeHtml(place.note)}</p>` : place.address ? `<p>${escapeHtml(place.address)}</p>` : ''}</div>
    <button type="button" class="places-card-close" data-place-close aria-label="Cerrar"><i data-lucide="x"></i></button>
    <div class="places-card-actions">
      <a class="pill-button" href="${escapeHtml(googleMapsLink(place, place.country))}" target="_blank" rel="noreferrer"><i data-lucide="navigation"></i> Google Maps</a>
      ${isWish(place) ? `<button type="button" class="pill-button" data-place-visit="${escapeHtml(place.id)}"><i data-lucide="check"></i> Ya fuimos</button>` : ''}
      <button type="button" class="pill-button is-quiet" data-place-edit="${escapeHtml(place.id)}"><i data-lucide="pencil"></i> Editar</button>
    </div>`;
}

function visiblePlaces() {
  const list = filteredPlaces();
  if (!placeOnlyVisible || !placesMap) return list;
  const bounds = placesMap.getBounds();
  return list.filter((place) => bounds.contains([place.lat, place.lon]));
}

function placesListTitle() {
  const list = visiblePlaces();
  const one = list.length === 1;
  const scope = placeType ? (one ? PLACE_TYPES[placeType].label : PLACE_TYPES[placeType].plural).toLowerCase() : `${one ? 'sitio' : 'sitios'}${placeStatus === 'wish' ? ' por visitar' : ''}`;
  return `${list.length} ${scope}${placeOnlyVisible ? ' en esta zona' : ''}`;
}

function placesList() {
  const list = visiblePlaces();
  if (!list.length) return `<p class="trip-day-empty">${places.length ? 'Nada con estos filtros. Prueba con otro tipo o mueve el mapa.' : 'Añadid vuestro primer sitio.'}</p>`;
  const groups = new Map();
  list.forEach((place) => {
    const key = place.country || 'Otros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(place);
  });
  return [...groups].sort((a, b) => b[1].length - a[1].length).map(([country, items]) => `<div class="places-group"><p class="places-group-title">${escapeHtml(country)} <span>${items.length}</span></p><ul class="trip-spot-list">${items.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((place) => {
    const type = placeTypeInfo(place);
    return `<li class="trip-spot${place.id === placeSelected ? ' is-selected' : ''}${isWish(place) ? ' is-wish' : ''}" style="--k:${type.color}"><button type="button" class="trip-spot-main" data-place-select="${escapeHtml(place.id)}"><span class="trip-spot-badge">${placeEmoji(place)}</span><span class="trip-spot-copy"><strong>${escapeHtml(place.name)}</strong><small>${escapeHtml([type.label, placeStatusLabel(place), place.note].filter(Boolean).join(' · '))}</small></span></button><a class="trip-spot-go" href="${escapeHtml(googleMapsLink(place, place.country))}" target="_blank" rel="noreferrer" aria-label="Abrir ${escapeHtml(place.name)} en Google Maps" title="Google Maps"><i data-lucide="navigation"></i></a></li>`;
  }).join('')}</ul></div>`).join('');
}

// Cambia filtros o selección sin volver a pintar todo (el mapa conserva su sitio).
function refreshPlaces({ fit = false } = {}) {
  const set = (selector, html) => { const el = document.querySelector(selector); if (el) el.innerHTML = html; };
  set('#placesControls', placesControls());
  set('#placesList', placesList());
  set('#placesListTitle', placesListTitle());
  const card = document.querySelector('#placeCard');
  if (card) { card.innerHTML = placeCard(); card.hidden = !placeSelected; }
  drawMarkers({ fit });
  lucide.createIcons();
}

// ---------- Mapa ----------

function markerIcon(place) {
  const type = placeTypeInfo(place);
  return L.divIcon({ className: `place-pin${isWish(place) ? ' is-wish' : ''}${place.id === placeSelected ? ' is-selected' : ''}`, html: `<span style="--k:${type.color}"><b>${placeEmoji(place)}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 32] });
}

function drawMarkers({ fit = false } = {}) {
  if (!placesMap || !placesLayer) return;
  placesLayer.clearLayers();
  placesMarkers = new Map();
  const list = filteredPlaces();
  list.forEach((place) => {
    const marker = L.marker([place.lat, place.lon], { icon: markerIcon(place), title: place.name, riseOnHover: true, zIndexOffset: place.id === placeSelected ? 1000 : 0 });
    marker.on('click', () => selectPlace(place.id, { fly: false }));
    placesMarkers.set(place.id, marker);
    placesLayer.addLayer(marker);
  });
  if (fit) fitPlaces(list);
}

function fitPlaces(list = filteredPlaces()) {
  if (!placesMap) return;
  if (list.length > 1) placesMap.fitBounds(L.latLngBounds(list.map((place) => [place.lat, place.lon])).pad(0.15), { maxZoom: 13 });
  else if (list.length) placesMap.setView([list[0].lat, list[0].lon], 12);
  else placesMap.setView([42, 4], 4);
}

async function mountMap() {
  const el = document.querySelector('#usMap');
  if (!el) return;
  try {
    await loadLeaflet();
    if (!document.body.contains(el)) return;
    if (placesMap && placesMap.getContainer() !== el) { placesMap.remove(); placesMap = null; }
    if (!placesMap) {
      placesMap = L.map(el, { zoomControl: false, scrollWheelZoom: false, tap: true });
      L.control.zoom({ position: 'bottomleft' }).addTo(placesMap);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(placesMap);
      // Los pines cercanos se juntan en un círculo con el número; al acercarse se separan.
      placesLayer = L.markerClusterGroup
        ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, spiderfyDistanceMultiplier: 1.4, iconCreateFunction: (cluster) => L.divIcon({ className: 'place-cluster', html: `<span>${cluster.getChildCount()}</span>`, iconSize: [40, 40] }) })
        : L.layerGroup();
      placesLayer.addTo(placesMap);
      placesMap.on('click', () => { if (placeSelected) { placeSelected = null; refreshPlaces(); } });
      placesMap.on('moveend', () => {
        if (!placeOnlyVisible) return;
        const list = document.querySelector('#placesList');
        if (list) { list.innerHTML = placesList(); document.querySelector('#placesListTitle').textContent = placesListTitle(); lucide.createIcons(); }
      });
    }
    drawMarkers();
    const selected = placeSelected && placeById(placeSelected);
    const marker = selected && placesMarkers.get(selected.id);
    if (selected) placesMap.setView([selected.lat, selected.lon], 13);
    else fitPlaces();
    // El sitio elegido se ve suelto aunque esté junto a otros.
    if (marker && placesLayer.zoomToShowLayer) setTimeout(() => placesLayer.zoomToShowLayer(marker), 120);
    if (placeHere) L.circleMarker(placeHere, { radius: 8, color: '#fff', weight: 3, fillColor: '#2a78d6', fillOpacity: 1 }).addTo(placesMap);
    setTimeout(() => placesMap?.invalidateSize(), 60);
  } catch (error) {
    el.innerHTML = `<p class="empty-note">${escapeHtml(error.message || 'No se pudo cargar el mapa')}</p>`;
  }
}

function selectPlace(id, { fly = true } = {}) {
  const place = placeById(id);
  if (!place) return;
  placeSelected = id;
  if (fly && placesMap) {
    const marker = placesMarkers.get(id);
    // Dentro de un grupo, primero se abre el grupo; si no, se vuela al sitio.
    if (marker && placesLayer.zoomToShowLayer) placesLayer.zoomToShowLayer(marker, () => placesMap.panTo([place.lat, place.lon]));
    else placesMap.flyTo([place.lat, place.lon], Math.max(placesMap.getZoom(), 12), { duration: 0.7 });
    document.querySelector('#placesWrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  refreshPlaces();
}

// A pantalla completa, el mapa pasa a colgar de la página: dentro de la sección, la animación
// de cambio de pestaña haría de marco y no ocuparía toda la pantalla.
let placesFullAnchor = null;
function toggleFullMap() {
  const wrap = document.querySelector('#placesWrap');
  if (!wrap) return;
  const full = !wrap.classList.contains('is-full');
  if (full) {
    placesFullAnchor = document.createComment('mapa');
    wrap.before(placesFullAnchor);
    document.body.appendChild(wrap);
  } else if (placesFullAnchor?.isConnected) {
    placesFullAnchor.replaceWith(wrap);
  }
  if (!full) placesFullAnchor = null;
  wrap.classList.toggle('is-full', full);
  document.documentElement.classList.toggle('has-full-map', full);
  const button = wrap.querySelector('[data-map-full]');
  button.innerHTML = `<i data-lucide="${full ? 'minimize' : 'maximize'}"></i>`;
  button.setAttribute('aria-label', full ? 'Salir de pantalla completa' : 'Pantalla completa');
  lucide.createIcons();
  if (full) placesMap?.scrollWheelZoom.enable(); else placesMap?.scrollWheelZoom.disable();
  setTimeout(() => placesMap?.invalidateSize(), 60);
}

function locateMe() {
  navigator.geolocation.getCurrentPosition((position) => {
    placeHere = [position.coords.latitude, position.coords.longitude];
    if (!placesMap) return;
    L.circleMarker(placeHere, { radius: 8, color: '#fff', weight: 3, fillColor: '#2a78d6', fillOpacity: 1 }).bindTooltip('Estás aquí').addTo(placesMap);
    placesMap.flyTo(placeHere, 12, { duration: 0.8 });
  }, () => showToast('No puedo saber dónde estás: revisa el permiso de ubicación'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

// ---------- Añadir y editar ----------

function openPlaceAdder(kind = 'trip') {
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">Nuestro mapa</p><h2 id="usSheetTitle">Añadir un sitio</h2></div>
    <form class="quick-add place-link-form" data-place-link autocomplete="off">
      <div class="quick-add-row"><input name="link" type="url" inputmode="url" placeholder="Pega el enlace de Google Maps" aria-label="Enlace de Google Maps" />${navigator.clipboard?.readText ? '<button type="button" data-place-paste aria-label="Pegar" title="Pegar"><i data-lucide="clipboard-paste"></i></button>' : ''}<button type="submit" aria-label="Añadir"><i data-lucide="arrow-right"></i></button></div>
    </form>
    <p class="recurring-intro"><i data-lucide="info"></i>En Google Maps, abre el sitio → Compartir → Copiar enlace, y pégalo aquí. También puedes buscarlo por su nombre:</p>
    <form class="quick-add" data-place-search autocomplete="off"><div class="quick-add-row"><input name="q" type="search" maxlength="100" placeholder="Una playa, un restaurante, una ciudad…" aria-label="Buscar sitio" /><button type="submit" aria-label="Buscar"><i data-lucide="search"></i></button></div></form>
    <div class="place-results" data-place-results></div>
    <div data-place-draft></div>`, { kind: 'place-add', status: PLACE_KINDS[kind] ? kind : 'trip' });
}

// El formulario de un sitio: después de pegar o buscar, y para editar uno que ya está.
function placeForm(draft, { editing = false } = {}) {
  const type = placeType_(draft);
  const kind = PLACE_KINDS[draft.kind] ? draft.kind : 'trip';
  return `<form class="item-editor place-form" data-place-form>
    <div class="place-found"><span class="places-card-badge" style="--k:${PLACE_TYPES[type].color}">${draft.kind === 'home' ? '🏠' : draft.kind === 'family' ? '👪' : PLACE_TYPES[type].emoji}</span><span><strong>${escapeHtml(draft.name || 'Sitio sin nombre')}</strong><small>${escapeHtml([draft.address, draft.country].filter(Boolean).join(' · ') || (hasCoords(draft) ? 'Ubicación guardada' : ''))}</small></span></div>
    <label class="plant-field"><span>Nombre</span><input name="name" type="text" maxlength="120" required value="${escapeHtml(draft.name || '')}" /></label>
    <fieldset class="plant-field"><legend>Qué es</legend><div class="choice-row trip-kind-choices">${Object.entries(PLACE_TYPES).map(([id, info]) => `<label class="option-toggle" style="--k:${info.color}"><input type="radio" name="category" value="${id}" ${id === type ? 'checked' : ''} /><span>${info.emoji} ${info.label}</span></label>`).join('')}</div></fieldset>
    <fieldset class="plant-field"><legend>Para vosotros</legend><div class="choice-row">${Object.entries(PLACE_KINDS).map(([id, info]) => `<label class="option-toggle"><input type="radio" name="kind" value="${id}" ${id === kind ? 'checked' : ''} /><span>${info.emoji} ${info.label}</span></label>`).join('')}</div></fieldset>
    <label class="plant-field"><span>Una nota (opcional)</span><input name="note" type="text" maxlength="200" value="${escapeHtml(draft.note || '')}" placeholder="El mejor arroz de la costa, ir al atardecer…" /></label>
    <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${editing ? 'Guardar' : 'Añadir al mapa'}</button>${editing ? '<button type="button" class="link-button is-danger" data-place-remove>Quitar del mapa</button>' : ''}</div>
  </form>`;
}

async function showPlaceDraft(found) {
  if (!found || !hasCoords(found)) return;
  const status = usSheetState.status || 'trip';
  const draft = { ...found, kind: status, category: found.category && found.category !== 'other' ? found.category : guessKindFromName(found.name) || found.category || 'city' };
  // El país, siempre en español (la búsqueda a veces lo da en inglés).
  const geo = await reverseGeocode(draft.lat, draft.lon);
  draft.country = geo.country || draft.country || null;
  usSheetState.draft = draft;
  usSheet.querySelector('[data-place-results]').innerHTML = '';
  usSheet.querySelector('[data-place-draft]').innerHTML = placeForm(draft);
  lucide.createIcons();
  usSheet.querySelector('[data-place-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function addFromLink(text) {
  const box = usSheet.querySelector('[data-place-results]');
  if (!parseMapsLink(text)) { box.innerHTML = '<p class="empty-note">Eso no parece un enlace. Pega el de Google Maps o busca el sitio por su nombre.</p>'; return; }
  box.innerHTML = '<p class="empty-note">Buscando el sitio…</p>';
  const found = await resolveMapsLink(text).catch(() => null);
  if (!found || !hasCoords(found)) {
    const name = found?.name;
    box.innerHTML = `<p class="empty-note">${isShortMapsLink(text) && !name ? 'No he podido abrir ese enlace corto. Busca el sitio por su nombre aquí abajo (o despliega la función resolve-maps-link).' : `No sé dónde está${name ? ` «${escapeHtml(name)}»` : ''}. Búscalo por su nombre aquí abajo.`}</p>`;
    if (name) usSheet.querySelector('[data-place-search] [name="q"]').value = name;
    return;
  }
  showPlaceDraft(found);
}

async function searchPlaces(query) {
  const box = usSheet.querySelector('[data-place-results]');
  box.innerHTML = '<p class="empty-note">Buscando…</p>';
  try {
    const results = await searchPlacesByName(query);
    usSheetState.results = results;
    box.innerHTML = results.length ? results.map((result, i) => {
      const type = PLACE_TYPES[result.category] || PLACE_TYPES.other;
      return `<button type="button" class="recipe-option" data-place-result="${i}"><span class="trip-spot-badge" style="--k:${type.color}">${type.emoji}</span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(result.address || type.label)}</small></span></button>`;
    }).join('') : '<p class="empty-note">No lo encuentro. Prueba con otro nombre o pega el enlace de Google Maps.</p>';
  } catch {
    box.innerHTML = '<p class="empty-note">Sin conexión para buscar ahora mismo.</p>';
  }
}

function openPlaceEditor(id) {
  const place = placeById(id);
  if (!place) return;
  showUsSheet(`<div class="plant-add-heading"><p class="eyebrow muted">Nuestro mapa</p><h2 id="usSheetTitle">${escapeHtml(place.name)}</h2></div>${placeForm(place, { editing: true })}`, { kind: 'place-edit', id, draft: place });
}

async function savePlace(form) {
  const state = usSheetState;
  const values = Object.fromEntries(new FormData(form));
  const draft = state.draft;
  const row = {
    name: values.name.trim().slice(0, 120) || draft.name,
    kind: PLACE_KINDS[values.kind] ? values.kind : 'trip',
    category: PLACE_TYPES[values.category] ? values.category : 'city',
    note: values.note.trim().slice(0, 200) || null
  };
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    let saved;
    if (state.kind === 'place-edit') {
      if (row.kind === 'trip' && draft.kind === 'wish') row.visited_on = todayISO();
      if (placesShared) await storePlace((data) => placesStore.update(draft.id, data), row);
      saved = Object.assign(placeById(draft.id), row);
    } else {
      const twin = places.find((place) => normalizeText(place.name) === normalizeText(row.name) && Math.abs(place.lat - draft.lat) < 0.01 && Math.abs(place.lon - draft.lon) < 0.01);
      if (twin) {
        closeUsSheet();
        selectPlace(twin.id);
        return showToast(`${twin.name} ya está en el mapa`);
      }
      const full = { ...row, country: (draft.country || '').slice(0, 60) || null, lat: Number(draft.lat), lon: Number(draft.lon), url: draft.url || null, address: draft.address ? String(draft.address).slice(0, 200) : null, visited_on: row.kind === 'trip' ? todayISO() : null, added_by: currentUser };
      if (placesShared) [saved] = await storePlace((data) => placesStore.insert(data), full);
      else { saved = { ...full, id: createLocalId() }; }
      places.push(saved);
      const wish = row.kind === 'wish';
      notifyHousehold(wish ? `${currentUser} quiere ir a ${row.name} ⭐` : `${currentUser} añadió ${row.name} al mapa 📍`, `${PLACE_TYPES[row.category].emoji} ${PLACE_TYPES[row.category].label} · mirad vuestro mapa en Nosotros`, { open: 'nosotros', tag: 'places' });
      showToast(`${PLACE_TYPES[row.category].emoji} ${row.name}, ${wish ? 'a la lista de sitios por visitar' : 'en vuestro mapa'}`);
    }
    if (!placesShared) saveFallbackPlaces();
    // Que el sitio nuevo se vea: sin filtros que lo escondan y seleccionado.
    if (!matchesStatus(saved)) placeStatus = 'all';
    if (placeType && placeType_(saved) !== placeType) placeType = '';
    placeSelected = saved.id;
    closeUsSheet();
    if (typeof openTripId !== 'undefined' && openTripId) openTrip(null);
    if (usView !== 'trips') setUsView('trips'); else renderUs();
    placesChanged();
  } catch (error) {
    button.disabled = false;
    showSupabaseError('No se pudo guardar el sitio', error);
  }
}

// Un sitio pendiente que ya habéis visitado pasa a «hemos estado» (con la fecha de hoy).
async function visitPlace(id) {
  const place = placeById(id);
  if (!place) return;
  const changes = { kind: 'trip', visited_on: todayISO() };
  try {
    if (placesShared) await placesStore.update(id, changes);
    Object.assign(place, changes);
    if (!placesShared) saveFallbackPlaces();
    if (placeStatus === 'wish') placeStatus = 'all';
    renderUs();
    showToast(`❤️ ${place.name}, ¡a vuestro mapa!`);
    placesChanged();
    window.dispatchEvent(new CustomEvent('umbral:life', { detail: { kind: 'plan' } }));
    notifyHousehold(`¡${place.name} ya está en vuestro mapa! ❤️`, `${currentUser} lo ha marcado como visitado`, { open: 'nosotros', tag: 'places' });
  } catch (error) {
    showSupabaseError('No se pudo marcar como visitado', error);
  }
}

async function removePlace(id) {
  const place = placeById(id);
  if (!place || !window.confirm(`¿Quitar ${place.name} del mapa?`)) return;
  try {
    if (placesShared) await placesStore.remove(id);
    places = places.filter((entry) => entry.id !== id);
    if (placeSelected === id) placeSelected = null;
    if (!placesShared) saveFallbackPlaces();
    closeUsSheet();
    renderUs();
    placesChanged();
  } catch (error) {
    showSupabaseError('No se pudo quitar', error);
  }
}

// ---------- Eventos ----------

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!target.closest?.('#usView, #placesWrap')) return;
  let el;
  if ((el = target.closest('[data-place-add]'))) return openPlaceAdder(el.dataset.placeAdd || 'trip');
  if ((el = target.closest('[data-place-status]'))) { placeStatus = el.dataset.placeStatus; placeType = ''; placeSelected = null; return refreshPlaces({ fit: true }); }
  if ((el = target.closest('[data-place-type]'))) { placeType = el.dataset.placeType; placeSelected = null; return refreshPlaces({ fit: true }); }
  if ((el = target.closest('[data-place-select]'))) return selectPlace(el.dataset.placeSelect);
  if (target.closest('[data-place-close]')) { placeSelected = null; return refreshPlaces(); }
  if ((el = target.closest('[data-place-edit]'))) return openPlaceEditor(el.dataset.placeEdit);
  if ((el = target.closest('[data-place-visit]'))) return visitPlace(el.dataset.placeVisit);
  if (target.closest('[data-map-full]')) return toggleFullMap();
  if (target.closest('[data-map-fit]')) { placeSelected = null; refreshPlaces(); return fitPlaces(); }
  if (target.closest('[data-map-locate]')) return locateMe();
});

document.querySelector('#usView').addEventListener('change', (event) => {
  if (!event.target.matches('[data-place-visible]')) return;
  placeOnlyVisible = event.target.checked;
  refreshPlaces();
});

usSheet.addEventListener('click', async (event) => {
  const state = usSheetState;
  if (!state || !String(state.kind).startsWith('place')) return;
  const target = event.target;
  const result = target.closest('[data-place-result]');
  if (result) return showPlaceDraft(state.results[Number(result.dataset.placeResult)]);
  if (target.closest('[data-place-paste]')) {
    try {
      const text = await navigator.clipboard.readText();
      usSheet.querySelector('[data-place-link] [name="link"]').value = text;
      return addFromLink(text);
    } catch {
      return showToast('No puedo leer el portapapeles: pega el enlace a mano');
    }
  }
  if (target.closest('[data-place-remove]')) return removePlace(state.id);
});

// Cambiar el tipo o el estado cambia el icono de la ficha al momento.
usSheet.addEventListener('change', (event) => {
  const form = event.target.closest('[data-place-form]');
  if (!form) return;
  const kind = form.kind.value;
  const type = PLACE_TYPES[form.category.value] || PLACE_TYPES.city;
  const badge = form.querySelector('.places-card-badge');
  badge.style.setProperty('--k', type.color);
  badge.textContent = kind === 'home' ? '🏠' : kind === 'family' ? '👪' : type.emoji;
});

usSheet.addEventListener('submit', (event) => {
  const state = usSheetState;
  if (!state || !String(state.kind).startsWith('place')) return;
  event.preventDefault();
  const form = event.target;
  if (form.hasAttribute('data-place-link')) return form.link.value.trim() && addFromLink(form.link.value.trim());
  if (form.hasAttribute('data-place-search')) return form.q.value.trim() && searchPlaces(form.q.value.trim());
  if (form.hasAttribute('data-place-form')) return savePlace(form);
});

// En pantalla completa, «atrás» (o Escape) primero cierra el mapa grande.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.querySelector('#placesWrap.is-full')) toggleFullMap();
});
