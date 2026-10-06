// Nosotros: vuestro rincón. La foto del día (con aviso sorpresa, como BeReal) y el álbum por
// meses, las fechas importantes con su cuenta atrás y los planes por hacer con vuestra nota.
const momentsStore = createHouseholdStore({ table: 'moments', localKey: 'umbral-moments' });
const datesStore = createHouseholdStore({ table: 'special_dates', localKey: 'umbral-special-dates' });
const plansStore = createHouseholdStore({ table: 'plans', localKey: 'umbral-plans' });

const DATE_KINDS = {
  birthday: { label: 'Cumpleaños', icon: 'cake', emoji: '🎂' },
  anniversary: { label: 'Aniversario', icon: 'heart', emoji: '💞' },
  trip: { label: 'Viaje', icon: 'plane', emoji: '✈️' },
  event: { label: 'Fecha especial', icon: 'calendar-heart', emoji: '✨' }
};
// Fechas iniciales (se añaden la primera vez que abrís «Fechas» si no hay ninguna).
const STARTER_DATES = [
  { title: 'Cumpleaños de Matteo', kind: 'birthday', date: '2026-01-13', yearly: true, emoji: '🎂' },
  { title: 'Cumpleaños de Ines', kind: 'birthday', date: '2026-05-16', yearly: true, emoji: '🎂' },
  { title: 'Nuestro aniversario', kind: 'anniversary', date: '2026-05-25', yearly: true, emoji: '💞' },
  { title: 'Viaje a Chieti', kind: 'trip', date: '2026-10-08', end_date: '2026-10-13', yearly: false, emoji: '✈️' }
];
const PLAN_KINDS = {
  movie: { label: 'Películas', one: 'Película', icon: 'clapperboard' },
  series: { label: 'Series', one: 'Serie', icon: 'tv' },
  restaurant: { label: 'Restaurantes', one: 'Restaurante', icon: 'utensils' },
  trip: { label: 'Viajes', one: 'Viaje', icon: 'plane' },
  book: { label: 'Libros', one: 'Libro', icon: 'book-open' },
  activity: { label: 'Planes', one: 'Plan', icon: 'map-pin' },
  other: { label: 'Otros', one: 'Otro', icon: 'sparkles' }
};

let moments = [];
let specialDates = [];
let plans = [];
let usView = 'photos';
let planKindFilter = null;
let usReloadTimer;
let usLoaded = false;

// ---------- La hora de la foto (la misma que calcula el servidor) ----------

// Cada día, una hora distinta entre las 10:00 y las 19:50 (hora de Turín).
function photoPromptTime(iso) {
  let hash = 0;
  for (const char of iso) hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
  const slot = hash % 60;
  return { hour: 10 + Math.floor(slot / 6), minute: (slot % 6) * 10 };
}

function promptDate(iso) {
  const { hour, minute } = photoPromptTime(iso);
  const date = isoToDate(iso);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// «A tiempo» si se subió en los 15 minutos siguientes al aviso.
const onTime = (moment) => {
  const start = promptDate(moment.day).getTime();
  const created = new Date(moment.created_at).getTime();
  return created >= start && created <= start + 15 * 60000;
};

// ---------- Datos ----------

async function loadUs() {
  try {
    const [momentRows, dateRows, planRows] = await Promise.all([
      momentsStore.list({ build: (query) => query.order('day', { ascending: false }).limit(800) }),
      datesStore.list(),
      plansStore.list({ build: (query) => query.order('created_at', { ascending: false }) })
    ]);
    moments = momentRows.sort((first, second) => String(second.day).localeCompare(String(first.day)) || String(second.created_at).localeCompare(String(first.created_at)));
    specialDates = dateRows;
    plans = planRows.map((plan) => ({ ...plan, ratings: plan.ratings || {} }));
    usLoaded = true;
  } catch (error) {
    console.error('[Umbral] Nosotros:', error);
    document.querySelector('#usContent').innerHTML = `<p class="empty-note">No se pudo cargar: ${escapeHtml(error.message || 'error')}. ¿Has ejecutado life.sql en Supabase?</p>`;
    return;
  }
  if (!specialDates.length) await seedDates();
  renderUs();
  shareWithScene();
}

async function seedDates() {
  try {
    specialDates = await datesStore.insert(STARTER_DATES);
  } catch (error) {
    console.error('[Umbral] Fechas iniciales:', error);
  }
}

// ---------- Fechas ----------

// Próxima vez que toca (las anuales se repiten); para viajes, si está en curso.
function nextOccurrence(entry, from = todayISO()) {
  if (!entry.yearly) {
    const end = entry.end_date || entry.date;
    if (end < from) return null;
    return { start: entry.date, end, ongoing: entry.date <= from && end >= from };
  }
  const [, month, day] = entry.date.split('-');
  let year = Number(from.slice(0, 4));
  let start = `${year}-${month}-${day}`;
  if (start < from) start = `${++year}-${month}-${day}`;
  return { start, end: start, ongoing: start === from, years: Number(entry.date.slice(0, 4)) < Number(from.slice(0, 4)) - 0 ? year - Number(entry.date.slice(0, 4)) : null };
}

function upcomingDates() {
  const today = todayISO();
  return specialDates.map((entry) => ({ entry, next: nextOccurrence(entry, today) })).filter(({ next }) => next)
    .map((item) => ({ ...item, days: daysBetween(today, item.next.start) }))
    .sort((first, second) => (second.next.ongoing - first.next.ongoing) || first.days - second.days);
}

function countdownText({ entry, next, days }) {
  if (next.ongoing && entry.kind === 'trip') {
    const day = daysBetween(next.start, todayISO()) + 1;
    const total = daysBetween(next.start, next.end) + 1;
    return `Día ${day} de ${total}`;
  }
  if (days === 0) return '¡Hoy!';
  if (days === 1) return 'Mañana';
  return `Faltan ${days} días`;
}

// ---------- Pintar ----------

function renderUsHero() {
  const anniversary = specialDates.find((entry) => entry.kind === 'anniversary');
  const together = anniversary && Number(anniversary.date.slice(0, 4)) < new Date().getFullYear() ? daysBetween(anniversary.date, todayISO()) : null;
  const next = upcomingDates()[0];
  document.querySelector('#usHero').innerHTML = `
    <div class="us-hero-names">${householdPeople.map((person, index) => `${index ? '<i data-lucide="heart"></i>' : ''}<button type="button" class="us-doll" data-open-avatar="${escapeHtml(person)}" aria-label="${person === currentUser ? 'Personaliza tu muñeco' : `Muñeco de ${escapeHtml(person)}`}">${typeof avatarPreviewFor === 'function' ? avatarPreviewFor(person) : ''}</button>`).join('')}</div>
    <div class="us-hero-copy"><p class="eyebrow">Nosotros</p><h2>${escapeHtml(householdPeople.join(' & '))}</h2><p>${together ? `${together.toLocaleString('es-ES')} días juntos` : 'Vuestro rincón: fotos, fechas y planes'}</p><button type="button" class="us-sims" data-open-sims>🏠 Entrar en casa</button></div>
    ${next ? `<button type="button" class="us-next" data-us-view-jump="dates"><span>${escapeHtml(next.entry.emoji || DATE_KINDS[next.entry.kind].emoji)}</span><strong>${escapeHtml(countdownText(next))}</strong><small>${escapeHtml(next.entry.title)}</small></button>` : ''}`;
}

function renderPhotos() {
  const today = todayISO();
  const todays = moments.filter((moment) => moment.day === today);
  const prompt = promptDate(today);
  const now = new Date();
  const minutesLeft = Math.ceil((prompt.getTime() + 15 * 60000 - now.getTime()) / 60000);
  let status;
  if (todays.length) status = onTime(todays.at(-1)) ? '<span class="moment-badge is-ontime"><i data-lucide="zap"></i>¡A tiempo!</span>' : `<span class="moment-badge">Subida a las ${new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(todays.at(-1).created_at))}</span>`;
  else if (now < prompt) status = '<span class="moment-badge"><i data-lucide="bell"></i>El aviso llegará por sorpresa</span>';
  else if (minutesLeft > 0) status = `<span class="moment-badge is-live"><i data-lucide="zap"></i>¡Es la hora! Quedan ${minutesLeft} min</span>`;
  else status = '<span class="moment-badge is-late">Aún no habéis subido la de hoy</span>';

  // Racha: días seguidos con foto, contando hasta hoy o ayer.
  const days = new Set(moments.map((moment) => moment.day));
  let streak = 0;
  for (let cursor = days.has(today) ? today : addDaysToISO(today, -1); days.has(cursor); cursor = addDaysToISO(cursor, -1)) streak += 1;

  const lastYear = moments.filter((moment) => moment.day === addDaysToISO(today, -365) || moment.day === `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`);
  const lastMonth = moments.filter((moment) => moment.day === addDaysToISO(today, -30));
  const memory = lastYear.length ? { label: 'Hace un año', items: lastYear } : lastMonth.length ? { label: 'Hace un mes', items: lastMonth } : null;

  const byMonth = new Map();
  moments.forEach((moment) => byMonth.set(moment.day.slice(0, 7), [...(byMonth.get(moment.day.slice(0, 7)) || []), moment]));

  return `
    <section class="moment-today">
      <div class="moment-today-head"><div><p class="eyebrow">La foto de hoy</p><h3>${todays.length ? 'Ya tenéis la de hoy' : 'Una foto juntos'}</h3></div>${streak ? `<span class="streak"><i data-lucide="flame"></i>${streak} ${streak === 1 ? 'día' : 'días'}</span>` : ''}</div>
      ${todays.length ? `<button type="button" class="moment-today-photo" data-open-moment="${escapeHtml(todays.at(-1).id)}"><img alt="La foto de hoy" data-photo="${escapeHtml(todays.at(-1).path)}" />${todays.at(-1).caption ? `<span>${escapeHtml(todays.at(-1).caption)}</span>` : ''}</button>` : '<div class="moment-empty"><i data-lucide="aperture"></i><p>Cada día os aviso a una hora distinta. Tenéis 15 minutos para que salga «a tiempo», pero cualquier foto vale.</p></div>'}
      <div class="moment-actions">${status}<div><button type="button" class="primary-button" data-new-moment="camera"><i data-lucide="camera"></i> ${todays.length ? 'Otra' : 'Hacer la foto'}</button><button type="button" class="icon-button" data-new-moment="gallery" aria-label="Elegir de la galería" title="Elegir de la galería"><i data-lucide="image-plus"></i></button></div></div>
    </section>
    ${memory ? `<section class="money-card memory-card"><div class="finance-subheading"><strong><i data-lucide="sparkles"></i> ${memory.label}</strong><span>${financeDate(memory.items[0].day)}</span></div><div class="memory-strip">${memory.items.map((moment) => `<button type="button" data-open-moment="${escapeHtml(moment.id)}"><img alt="" data-photo="${escapeHtml(moment.path)}" /></button>`).join('')}</div></section>` : ''}
    ${[...byMonth].map(([month, list]) => `<section class="album-month"><header><strong>${escapeHtml(monthLabel(month))}</strong><span>${list.length} ${list.length === 1 ? 'foto' : 'fotos'}</span></header><div class="album-grid">${list.map((moment) => `<button type="button" class="album-photo" data-open-moment="${escapeHtml(moment.id)}"><img alt="" loading="lazy" data-photo="${escapeHtml(moment.path)}" /><span>${Number(moment.day.slice(8, 10))}</span>${onTime(moment) ? '<em><i data-lucide="zap"></i></em>' : ''}</button>`).join('')}</div></section>`).join('')}
    ${!moments.length ? '<p class="empty-note album-empty">Aquí irá creciendo vuestro álbum, mes a mes.</p>' : ''}`;
}

function renderDates() {
  const list = upcomingDates();
  const past = specialDates.filter((entry) => !nextOccurrence(entry));
  const card = (item, big = false) => {
    const kind = DATE_KINDS[item.entry.kind];
    const when = item.next.start === item.next.end
      ? new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(isoToDate(item.next.start))
      : `${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(isoToDate(item.next.start))} – ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(isoToDate(item.next.end))}`;
    const yearsText = item.entry.kind === 'anniversary' && item.next.years ? ` · ${item.next.years} ${item.next.years === 1 ? 'año' : 'años'} juntos` : item.entry.kind === 'birthday' && item.next.years ? ` · cumple ${item.next.years}` : '';
    return `<button type="button" class="date-card${big ? ' is-big' : ''}${item.days === 0 || item.next.ongoing ? ' is-today' : ''} kind-${item.entry.kind}" data-open-date="${escapeHtml(item.entry.id)}">
      <span class="date-emoji">${escapeHtml(item.entry.emoji || kind.emoji)}</span>
      <span class="date-copy"><strong>${escapeHtml(item.entry.title)}</strong><small>${escapeHtml(capitalizeFirst(when))}${escapeHtml(yearsText)}</small></span>
      <span class="date-count">${item.days > 1 && !item.next.ongoing ? `<b>${item.days}</b><small>días</small>` : `<b class="is-word">${escapeHtml(countdownText(item))}</b>`}</span>
    </button>`;
  };
  return `
    <div class="dates-head"><p class="recurring-intro">Cumpleaños, aniversario, viajes… con su cuenta atrás. Las fechas también aparecen en la escena de la casa el día que tocan.</p><button type="button" class="pill-button" data-new-date><i data-lucide="plus"></i> Añadir</button></div>
    ${list.length ? `${card(list[0], true)}<div class="date-list">${list.slice(1).map((item) => card(item)).join('')}</div>` : '<p class="empty-note">Añade vuestras fechas importantes.</p>'}
    ${past.length ? `<details class="done-group"><summary><i data-lucide="history"></i>Pasadas<span>${past.length}</span></summary>${past.map((entry) => `<button type="button" class="date-card is-past" data-open-date="${escapeHtml(entry.id)}"><span class="date-emoji">${escapeHtml(entry.emoji || DATE_KINDS[entry.kind].emoji)}</span><span class="date-copy"><strong>${escapeHtml(entry.title)}</strong><small>${financeDate(entry.date)}</small></span></button>`).join('')}</details>` : ''}`;
}

const stars = (value) => `<span class="stars" aria-label="${value} de 5">${[1, 2, 3, 4, 5].map((index) => `<i data-lucide="star" class="${index <= Math.round(value) ? 'is-on' : ''}"></i>`).join('')}</span>`;
const planAverage = (plan) => {
  const values = Object.values(plan.ratings || {}).map(Number).filter(Boolean);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

function renderPlans() {
  const filtered = plans.filter((plan) => !planKindFilter || plan.kind === planKindFilter);
  const todo = filtered.filter((plan) => plan.status === 'todo');
  const done = filtered.filter((plan) => plan.status === 'done').sort((first, second) => planAverage(second) - planAverage(first));
  const planCard = (plan) => {
    const kind = PLAN_KINDS[plan.kind] || PLAN_KINDS.other;
    const average = planAverage(plan);
    return `<button type="button" class="plan-card${plan.status === 'done' ? ' is-done' : ''}" data-open-plan="${escapeHtml(plan.id)}">
      <span class="pcat-icon"><i data-lucide="${kind.icon}"></i></span>
      <span class="plan-copy"><strong>${escapeHtml(plan.title)}</strong><small>${escapeHtml(kind.one)}${plan.notes ? ` · ${escapeHtml(plan.notes.slice(0, 60))}` : ''}${plan.created_by_name ? ` · idea de ${escapeHtml(plan.created_by_name === currentUser ? 'ti' : plan.created_by_name)}` : ''}</small>${plan.status === 'done' ? `<span class="plan-ratings">${average ? stars(average) : '<em>Sin nota</em>'}${householdPeople.map((person) => plan.ratings?.[person] ? `<em>${escapeHtml(initialsOf(person))} ${plan.ratings[person]}★</em>` : '').join('')}</span>` : ''}</span>
    </button>`;
  };
  return `
    <form class="quick-add plan-add" data-new-plan>
      <div class="quick-add-row"><select name="kind" aria-label="Tipo">${Object.entries(PLAN_KINDS).map(([key, kind]) => `<option value="${key}" ${key === (planKindFilter || 'movie') ? 'selected' : ''}>${kind.one}</option>`).join('')}</select><input name="title" type="text" maxlength="120" placeholder="Dune 2, el sushi de Via Po…" aria-label="Qué" /><button type="submit" aria-label="Añadir"><i data-lucide="plus"></i></button></div>
    </form>
    <div class="category-chips plan-filters"><button type="button" class="filter-chip${planKindFilter ? '' : ' is-on'}" data-plan-kind="">Todo</button>${Object.entries(PLAN_KINDS).map(([key, kind]) => `<button type="button" class="filter-chip${planKindFilter === key ? ' is-on' : ''}" data-plan-kind="${key}"><i data-lucide="${kind.icon}"></i>${kind.label}</button>`).join('')}</div>
    ${todo.length > 1 ? `<button type="button" class="pick-plan" data-pick-plan><i data-lucide="dices"></i><span><strong>¿Qué hacemos hoy?</strong><small>Elijo uno al azar de ${planKindFilter ? PLAN_KINDS[planKindFilter].label.toLowerCase() : 'vuestros planes'}</small></span></button>` : ''}
    <section class="todo-section"><p class="list-group-title"><i data-lucide="list-todo"></i>Por hacer<span>${todo.length}</span></p>${todo.map(planCard).join('') || '<p class="empty-note">Apuntad aquí lo que queréis ver, probar o visitar.</p>'}</section>
    ${done.length ? `<section class="todo-section"><p class="list-group-title"><i data-lucide="trophy"></i>Hechos, por nota<span>${done.length}</span></p>${done.map(planCard).join('')}</section>` : ''}`;
}

function renderUs() {
  if (!document.querySelector('#usContent')) return;
  renderUsHero();
  document.querySelectorAll('[data-us-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.usView === usView)));
  const content = document.querySelector('#usContent');
  content.innerHTML = usLoaded ? { photos: renderPhotos, dates: renderDates, plans: renderPlans }[usView]() : '<p class="empty-note">Cargando…</p>';
  hydratePhotos(content);
  // Cuenta atrás en Inicio.
  const next = upcomingDates()[0];
  updateDaySummary({ countdown: next && (next.days <= 30 || next.next.ongoing) ? `${countdownText(next)}${next.days > 1 && !next.next.ongoing ? ' para' : ':'} ${next.entry.title.replace(/^Viaje a /, '').replace(/^Cumpleaños de /, 'el cumple de ')} ${next.entry.emoji || ''}`.trim() : null });
  lucide.createIcons();
}

function setUsView(view) {
  usView = view;
  try { localStorage.setItem('umbral-us-view', view); } catch {}
  renderUs();
}

// La escena de la casa celebra cumpleaños, aniversario y viajes.
function shareWithScene() {
  const today = todayISO();
  const occasions = specialDates.map((entry) => ({ entry, next: nextOccurrence(entry, today) })).filter(({ next }) => next);
  const birthday = occasions.find(({ entry, next }) => entry.kind === 'birthday' && next.start === today);
  const anniversary = occasions.find(({ entry, next }) => entry.kind === 'anniversary' && next.start === today);
  const trip = occasions.find(({ entry, next }) => entry.kind === 'trip' && (next.ongoing || daysBetween(today, next.start) === 1));
  const next = upcomingDates()[0];
  window.umbralScene?.update({
    birthday: birthday ? (householdPeople.find((person) => birthday.entry.title.includes(person)) || 'alguien') : '',
    anniversary: Boolean(anniversary),
    trip: trip ? (trip.next.ongoing && trip.next.start < today ? 'away' : 'leaving') : '',
    tripName: trip ? trip.entry.title.replace(/^Viaje a /, '') : '',
    countdown: next && next.days > 0 && next.days <= 60 ? `${next.days} días para ${next.entry.title.replace(/^Viaje a /, '').replace(/^Cumpleaños de /, 'el cumple de ')}` : '',
    moviePlan: plans.find((plan) => plan.status === 'todo' && plan.kind === 'movie')?.title || ''
  });
}

// ---------- Hojas ----------

const usSheet = document.querySelector('#usSheet');
let usSheetState = null;

function showUsSheet(html, state) {
  usSheetState = state;
  document.querySelector('#usSheetBody').innerHTML = html;
  usSheet.classList.add('visible');
  if (history.state?.page !== 'us-sheet') history.pushState({ page: 'us-sheet' }, '', '#nosotros');
  hydratePhotos(usSheet);
  lucide.createIcons();
}

function closeUsSheet() {
  if (!usSheet.classList.contains('visible')) return;
  if (history.state?.page === 'us-sheet') history.back();
  else hideUsSheet();
}

function hideUsSheet() {
  usSheet.classList.remove('visible');
  usSheetState = null;
}

async function newMoment(source) {
  const file = await pickPhoto({ camera: source === 'camera' });
  if (!file) return;
  const preview = URL.createObjectURL(file);
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">${new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p><h2 id="usSheetTitle">La foto de hoy</h2></div>
    <img class="moment-preview" alt="" src="${preview}" />
    <form class="item-editor" data-moment-form><label class="plant-field"><span>Una frase (opcional)</span><input name="caption" type="text" maxlength="200" placeholder="Domingo de lluvia y peli 🍿" /></label><div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="heart"></i> Guardar en el álbum</button></div></form>`, { kind: 'new-moment', file, preview });
}

async function saveMoment(form) {
  const { file } = usSheetState;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.innerHTML = '<i data-lucide="loader-circle"></i> Subiendo…';
  lucide.createIcons();
  try {
    const path = await uploadPhoto(file, 'moments');
    const [created] = await momentsStore.insert({ day: todayISO(), path, caption: form.caption.value.trim().slice(0, 200) || null, author: currentUser });
    moments.unshift(created);
    window.dispatchEvent(new CustomEvent('umbral:life', { detail: { kind: 'moment' } }));
    URL.revokeObjectURL(usSheetState.preview);
    closeUsSheet();
    setUsView('photos');
    showToast(onTime(created) ? '¡A tiempo! ⚡📸' : 'Guardada en vuestro álbum 📸');
    notifyHousehold(`${currentUser} subió la foto de hoy 📸`, created.caption || 'Mírala en Nosotros', { open: 'nosotros', tag: 'moment' });
  } catch (error) {
    button.disabled = false;
    button.innerHTML = '<i data-lucide="heart"></i> Guardar en el álbum';
    lucide.createIcons();
    showToast(error.message || 'No se pudo subir la foto');
  }
}

// Fotos hechas dentro del modo Sims: van al mismo álbum, con su frase.
async function saveGameMoment(blob, caption) {
  const path = await uploadPhoto(blob, 'moments');
  const [created] = await momentsStore.insert({ day: todayISO(), path, caption: String(caption || '').trim().slice(0, 200) || null, author: currentUser });
  if (created) moments.unshift(created);
  window.dispatchEvent(new CustomEvent('umbral:life', { detail: { kind: 'moment' } }));
  try { if (typeof renderUs === 'function') renderUs(); } catch {}
  notifyHousehold(`${currentUser} hizo una foto en el modo Sims 📸`, created?.caption || 'Mírala en Nosotros', { open: 'nosotros', tag: 'moment' });
  return created;
}

function openMoment(id) {
  const moment = moments.find((entry) => entry.id === id);
  if (!moment) return;
  showUsSheet(`
    <img class="moment-full" alt="" data-photo="${escapeHtml(moment.path)}" />
    <div class="plant-add-heading"><p class="eyebrow muted">${escapeHtml(capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(isoToDate(moment.day))))}${onTime(moment) ? ' · ⚡ a tiempo' : ''}</p><h2 id="usSheetTitle">${escapeHtml(moment.caption || 'Sin frase')}</h2><p class="recipe-history">Subida por ${escapeHtml(moment.author || '—')}</p></div>
    <div class="item-footer"><span></span><button type="button" class="link-button is-danger" data-delete-moment="${escapeHtml(moment.id)}">Eliminar foto</button></div>`, { kind: 'moment', id });
}

function openDateEditor(id = null) {
  const entry = id ? specialDates.find((item) => item.id === id) : { kind: 'event', yearly: false, date: todayISO() };
  showUsSheet(`
    <div class="plant-add-heading"><p class="eyebrow muted">${id ? 'Editar fecha' : 'Nueva fecha'}</p><h2 id="usSheetTitle">${id ? escapeHtml(entry.title) : 'Algo que celebrar'}</h2></div>
    <form class="item-editor" data-date-form ${id ? `data-date-id="${escapeHtml(id)}"` : ''}>
      <label class="plant-field"><span>Nombre</span><input name="title" type="text" maxlength="60" required value="${escapeHtml(entry.title || '')}" placeholder="Viaje a Lisboa" /></label>
      <fieldset class="plant-field"><legend>Tipo</legend><div class="choice-row">${Object.entries(DATE_KINDS).map(([key, kind]) => `<label class="option-toggle"><input type="radio" name="kind" value="${key}" ${key === entry.kind ? 'checked' : ''} /><span><i data-lucide="${kind.icon}"></i>${kind.label}</span></label>`).join('')}</div></fieldset>
      <div class="detail-grid"><label class="plant-field"><span>Fecha</span><input name="date" type="date" required value="${escapeHtml(entry.date)}" /></label><label class="plant-field"><span>Hasta (viajes)</span><input name="end_date" type="date" value="${escapeHtml(entry.end_date || '')}" /></label></div>
      <label class="option-toggle"><input type="checkbox" name="yearly" ${entry.yearly ? 'checked' : ''} /><span><i data-lucide="repeat"></i>Se repite cada año</span></label>
      <p class="recurring-intro"><i data-lucide="info"></i>Si pones el año real (por ejemplo, el de vuestro aniversario), os diré cuántos años cumplís.</p>
      <label class="plant-field"><span>Emoji</span><input name="emoji" type="text" maxlength="8" value="${escapeHtml(entry.emoji || '')}" placeholder="✈️" /></label>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar</button>${id ? '<button type="button" class="link-button is-danger" data-delete-date>Eliminar</button>' : ''}</div>
    </form>`, { kind: 'date', id });
}

async function saveDate(form) {
  const values = Object.fromEntries(new FormData(form));
  const row = { title: values.title.trim().slice(0, 60), kind: values.kind, date: values.date, end_date: values.end_date && values.end_date >= values.date ? values.end_date : null, yearly: Boolean(values.yearly), emoji: values.emoji.trim().slice(0, 8) || DATE_KINDS[values.kind].emoji };
  const id = form.dataset.dateId;
  try {
    if (id) {
      await datesStore.update(id, row);
      Object.assign(specialDates.find((item) => item.id === id), row);
    } else {
      const [created] = await datesStore.insert(row);
      specialDates.push(created);
    }
    closeUsSheet();
    renderUs();
    shareWithScene();
  } catch (error) {
    showSupabaseError('No se pudo guardar la fecha', error);
  }
}

function openPlan(id) {
  const plan = plans.find((entry) => entry.id === id);
  if (!plan) return;
  const kind = PLAN_KINDS[plan.kind] || PLAN_KINDS.other;
  const mine = Number(plan.ratings?.[currentUser]) || 0;
  showUsSheet(`
    <div class="item-hero"><span class="todo-icon is-large"><i data-lucide="${kind.icon}"></i></span><div><p class="eyebrow muted">${escapeHtml(kind.one)}${plan.created_by_name ? ` · idea de ${escapeHtml(plan.created_by_name)}` : ''}</p><h2 id="usSheetTitle">${escapeHtml(plan.title)}</h2></div></div>
    ${plan.notes ? `<p class="item-details">${escapeHtml(plan.notes)}</p>` : ''}
    ${plan.link ? `<a class="pill-button plan-link" href="${escapeHtml(plan.link)}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i> Abrir enlace</a>` : ''}
    ${plan.status === 'done' ? `<section class="plant-section"><h3>Vuestra nota</h3>
      <div class="rate-row"><span>Tú</span><div class="rate-stars">${[1, 2, 3, 4, 5].map((value) => `<button type="button" data-rate="${value}" aria-label="${value} estrellas" class="${value <= mine ? 'is-on' : ''}"><i data-lucide="star"></i></button>`).join('')}</div></div>
      ${householdPeople.filter((person) => person !== currentUser).map((person) => `<div class="rate-row"><span>${escapeHtml(person)}</span>${plan.ratings?.[person] ? stars(plan.ratings[person]) : '<em class="muted-text">Aún no ha votado</em>'}</div>`).join('')}
      ${plan.done_on ? `<p class="recipe-history">Hecho el ${financeDate(plan.done_on)}</p>` : ''}
    </section>` : ''}
    <form class="item-editor" data-plan-form><label class="plant-field"><span>Notas</span><textarea name="notes" rows="2" maxlength="600" placeholder="Dónde, quién la recomendó…">${escapeHtml(plan.notes || '')}</textarea></label><label class="plant-field"><span>Enlace (opcional)</span><input name="link" type="url" maxlength="300" value="${escapeHtml(plan.link || '')}" placeholder="https://" /></label><div class="plant-form-actions"><button type="submit" class="pill-button"><i data-lucide="check"></i> Guardar notas</button></div></form>
    <div class="item-footer">${plan.status === 'todo' ? '<button type="button" class="primary-button" data-plan-done><i data-lucide="check"></i> ¡Hecho! Puntuar</button>' : '<button type="button" class="pill-button" data-plan-undo><i data-lucide="rotate-ccw"></i> Volver a por hacer</button>'}<button type="button" class="link-button is-danger" data-delete-plan>Eliminar</button></div>`, { kind: 'plan', id });
}

async function updatePlan(id, changes) {
  const plan = plans.find((entry) => entry.id === id);
  try {
    await plansStore.update(id, changes);
    Object.assign(plan, changes);
    renderUs();
    shareWithScene();
    if (usSheetState?.kind === 'plan') openPlanInPlace(id);
    return true;
  } catch (error) {
    showSupabaseError('No se pudo guardar', error);
    return false;
  }
}

function openPlanInPlace(id) {
  const state = history.state?.page;
  openPlan(id);
  if (state === 'us-sheet') history.replaceState({ page: 'us-sheet' }, '', '#nosotros');
}

// ---------- Eventos ----------

document.querySelector('#usView').addEventListener('click', async (event) => {
  const target = event.target;
  if (target.closest('[data-open-sims]')) return openSims();
  const doll = target.closest('[data-open-avatar]');
  if (doll) return openAvatarEditor(doll.dataset.openAvatar === currentUser ? 'mood' : 'partner');
  const view = target.closest('[data-us-view], [data-us-view-jump]');
  if (view) return setUsView(view.dataset.usView || view.dataset.usViewJump);
  const momentSource = target.closest('[data-new-moment]');
  if (momentSource) return newMoment(momentSource.dataset.newMoment);
  const moment = target.closest('[data-open-moment]');
  if (moment) return openMoment(moment.dataset.openMoment);
  if (target.closest('[data-new-date]')) return openDateEditor();
  const date = target.closest('[data-open-date]');
  if (date) return openDateEditor(date.dataset.openDate);
  const kind = target.closest('[data-plan-kind]');
  if (kind) {
    planKindFilter = kind.dataset.planKind || null;
    return renderUs();
  }
  const plan = target.closest('[data-open-plan]');
  if (plan) return openPlan(plan.dataset.openPlan);
  const pickButton = target.closest('[data-pick-plan]');
  if (pickButton) {
    // Segundo toque: abre el plan que salió.
    if (pickButton.dataset.picked) return openPlan(pickButton.dataset.picked);
    const todo = plans.filter((entry) => entry.status === 'todo' && (!planKindFilter || entry.kind === planKindFilter));
    if (!todo.length || pickButton.classList.contains('is-rolling')) return;
    pickButton.classList.add('is-rolling');
    let turns = 0;
    const roll = setInterval(() => {
      const pick = todo[Math.floor(Math.random() * todo.length)];
      pickButton.querySelector('strong').textContent = pick.title;
      if (++turns > 12) {
        clearInterval(roll);
        pickButton.classList.remove('is-rolling');
        pickButton.querySelector('small').textContent = `${(PLAN_KINDS[pick.kind] || PLAN_KINDS.other).one} · toca para verlo`;
        pickButton.dataset.picked = pick.id;
      }
    }, 90);
  }
});

document.querySelector('#usView').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  if (!form.hasAttribute('data-new-plan')) return;
  const title = form.title.value.trim();
  if (!title) return form.title.focus();
  try {
    const [created] = await plansStore.insert({ kind: form.kind.value, title: title.slice(0, 120), status: 'todo', ratings: {}, created_by_name: currentUser });
    plans.unshift({ ...created, ratings: created.ratings || {} });
    form.title.value = '';
    renderUs();
    shareWithScene();
    notifyHousehold(`${currentUser} apuntó un plan`, `${(PLAN_KINDS[created.kind] || PLAN_KINDS.other).one}: ${created.title}`, { open: 'nosotros', tag: 'plans' });
  } catch (error) {
    showSupabaseError('No se pudo guardar el plan', error);
  }
});

usSheet.addEventListener('click', async (event) => {
  const target = event.target;
  const state = usSheetState;
  if (target === usSheet || target.closest('[data-close-us]')) return closeUsSheet();
  if (!state) return;
  const removeMoment = target.closest('[data-delete-moment]');
  if (removeMoment && window.confirm('¿Eliminar esta foto del álbum?')) {
    const moment = moments.find((entry) => entry.id === state.id);
    try {
      await momentsStore.remove(moment.id);
      await deletePhoto(moment.path).catch(() => {});
      moments = moments.filter((entry) => entry.id !== moment.id);
      closeUsSheet();
      renderUs();
    } catch (error) {
      showSupabaseError('No se pudo eliminar', error);
    }
    return;
  }
  if (target.closest('[data-delete-date]') && window.confirm('¿Eliminar esta fecha?')) {
    try {
      await datesStore.remove(state.id);
      specialDates = specialDates.filter((entry) => entry.id !== state.id);
      closeUsSheet();
      renderUs();
      shareWithScene();
    } catch (error) {
      showSupabaseError('No se pudo eliminar', error);
    }
    return;
  }
  const plan = plans.find((entry) => entry.id === state.id);
  if (target.closest('[data-plan-done]')) {
    window.dispatchEvent(new CustomEvent('umbral:life', { detail: { kind: 'plan' } }));
    return updatePlan(plan.id, { status: 'done', done_on: todayISO() });
  }
  if (target.closest('[data-plan-undo]')) return updatePlan(plan.id, { status: 'todo', done_on: null });
  const rate = target.closest('[data-rate]');
  if (rate) return updatePlan(plan.id, { ratings: { ...(plan.ratings || {}), [currentUser]: Number(rate.dataset.rate) } });
  if (target.closest('[data-delete-plan]') && window.confirm(`¿Eliminar «${plan.title}»?`)) {
    try {
      await plansStore.remove(plan.id);
      plans = plans.filter((entry) => entry.id !== plan.id);
      closeUsSheet();
      renderUs();
    } catch (error) {
      showSupabaseError('No se pudo eliminar', error);
    }
  }
});

usSheet.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.hasAttribute('data-moment-form')) return saveMoment(form);
  if (form.hasAttribute('data-date-form')) return saveDate(form);
  if (form.hasAttribute('data-plan-form')) return updatePlan(usSheetState.id, { notes: form.notes.value.trim().slice(0, 600) || null, link: form.link.value.trim().slice(0, 300) || null });
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'us-sheet') hideUsSheet();
});

document.addEventListener('DOMContentLoaded', () => {
  try { usView = localStorage.getItem('umbral-us-view') || 'photos'; } catch {}
});

document.addEventListener('umbral:ready', () => {
  loadUs();
  const reload = () => {
    clearTimeout(usReloadTimer);
    usReloadTimer = setTimeout(loadUs, 400);
  };
  momentsStore.subscribe(reload);
  datesStore.subscribe(reload);
  plansStore.subscribe(reload);
  // La cuenta atrás y el estado de la foto cambian con la hora.
  setInterval(() => { if (usView === 'photos') renderUs(); }, 60 * 1000);
});
