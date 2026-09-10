if (!window.lucide) window.lucide = { createIcons() {} };
window.lucide.createIcons();

function reportAppError(error) {
  const message = error?.message || String(error);
  const status = document.querySelector('#financeStatus');
  if (status) status.textContent = `Umbral necesita atención: ${message}`;
  console.error('[Umbral]', error);
}

window.addEventListener('error', (event) => reportAppError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => reportAppError(event.reason));

function updateConnectionState() {
  const status = document.querySelector('.orientation-status');
  if (!status) return;
  status.innerHTML = navigator.onLine
    ? '<i data-lucide="circle-check"></i> Sincronización activa'
    : '<i data-lucide="cloud-off"></i> Sin conexión · última copia local';
  status.classList.toggle('is-offline', !navigator.onLine);
  lucide.createIcons();
}
window.addEventListener('online', updateConnectionState);
window.addEventListener('offline', updateConnectionState);

const toast = document.querySelector('.toast');
const toastMessage = toast.querySelector('span');
const identityKey = 'umbral-user';
const requestedUser = new URLSearchParams(window.location.search).get('usuario');
let currentUser = 'Ines';
const notesModal = document.querySelector('#notesModal');
const urgentModal = document.querySelector('#urgentModal');
const weatherModal = document.querySelector('#weatherModal');
const financeModal = document.querySelector('#financeModal');
const authModal = document.querySelector('#authModal');
const localSharedNotesKey = 'umbral-shared-notes';
const localPrivateNotesKey = () => `umbral-private-notes-${currentUser.toLowerCase()}`;
const localExpensesKey = 'umbral-shared-expenses';
const localBillsKey = 'umbral-shared-bills';
const localSettlementsKey = 'umbral-shared-settlements';
const localFixedCostsKey = 'umbral-fixed-costs';
const defaultFixedCosts = [
  { id: 'fixed-rent', description: 'Alquiler', amount: 800, category: 'Alquiler', paid_by: 'Ines', active: true },
  { id: 'fixed-internet', description: 'Internet', amount: 30, category: 'Internet', paid_by: 'Ines', active: true }
];
const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseReady = window.supabase && supabaseConfig.url && !supabaseConfig.url.includes('TU-PROYECTO') && supabaseConfig.anonKey && !supabaseConfig.anonKey.includes('TU_CLAVE');
const supabaseClient = supabaseReady ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'umbral-auth-session' }
}) : null;
const supabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey && !supabaseConfig.url.includes('TU-PROYECTO') && !supabaseConfig.anonKey.includes('TU_CLAVE'));
let authUserId;
let householdId;
let householdRole = 'member';
const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=45.0703&longitude=7.6869&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome';
const weatherDetailUrl = 'https://api.open-meteo.com/v1/forecast?latitude=45.0703&longitude=7.6869&past_days=30&forecast_days=7&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Europe%2FRome';
let toastTimer;
let lightsOn = true;
const smartHomeConfig = window.SMART_HOME_CONFIG || {
  devices: [
    { id: 'salon-demo', name: 'Salón', room: 'salón', powered: true },
    { id: 'cocina-demo', name: 'Cocina', room: 'cocina', powered: true }
  ],
  demoMode: true
};
const smartLights = smartHomeConfig.devices.map((device) => ({
  id: device.id,
  name: device.name,
  room: device.room,
  powered: Boolean(device.powered)
}));

function createLocalId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `umbral-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function callSmartHomeCommand(lightId, nextState) {
  if (smartHomeConfig.demoMode || !supabaseConfig.url || !supabaseConfig.anonKey) {
    return { ok: true, demo: true };
  }

  const response = await fetch(`${supabaseConfig.url}/functions/v1/smart-home`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseConfig.anonKey}`
    },
    body: JSON.stringify({
      kind: 'light',
      deviceId: lightId,
      action: nextState ? 'on' : 'off'
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo comunicar con el backend de Smart Home');
  }

  return response.json();
}

function renderSmartLights() {
  const container = document.querySelector('#smartLightsList');
  if (!container) return;

  container.innerHTML = smartLights.map((light) => `
    <div class="light-row" data-light-id="${light.id}" data-powered="${String(light.powered)}">
      <div class="light-meta">
        <span class="light-icon"><i data-lucide="lightbulb"></i></span>
        <div>
          <strong>${light.name}</strong>
          <small>${light.powered ? 'Encendida' : 'Apagada'} · ${light.room}</small>
        </div>
      </div>
      <button type="button" class="light-toggle" data-light-toggle="${light.id}" aria-label="Cambiar estado de ${light.name}"></button>
    </div>
  `).join('');

  lucide.createIcons();
}

function updateLightStatusText() {
  const activeLights = smartLights.filter((light) => light.powered).length;
  const lightsStatus = document.querySelector('#lightsStatus');
  if (!lightsStatus) return;

  lightsStatus.textContent = activeLights === smartLights.length ? '2 encendidas · salón y cocina' : activeLights === 0 ? 'Todas apagadas' : `${activeLights} encendida${activeLights === 1 ? '' : 's'} · ${smartLights.filter((light) => light.powered).map((light) => light.room).join(' y ')}`;
}

function setSmartLightState(lightId, powered) {
  const light = smartLights.find((entry) => entry.id === lightId);
  if (!light) return;

  light.powered = powered;
  const row = document.querySelector(`.light-row[data-light-id="${lightId}"]`);
  if (!row) return;

  row.dataset.powered = String(powered);
  row.querySelector('small').textContent = `${powered ? 'Encendida' : 'Apagada'} · ${light.room}`;
  updateLightStatusText();
}

async function toggleSmartLight(lightId) {
  const light = smartLights.find((entry) => entry.id === lightId);
  if (!light) return;

  const newState = !light.powered;
  try {
    await callSmartHomeCommand(lightId, newState);
    setSmartLightState(lightId, newState);
    showToast(newState ? `${light.name} encendida` : `${light.name} apagada`);
  } catch (error) {
    showToast(error.message || 'No se pudo cambiar el estado de la luz');
  }
}

const weatherDescriptions = {
  0: ['Despejado', 'sun'],
  1: ['Casi despejado', 'sun'],
  2: ['Parcialmente nublado', 'cloud-sun'],
  3: ['Nublado', 'cloud'],
  45: ['Niebla', 'cloud-fog'],
  48: ['Niebla helada', 'cloud-fog'],
  51: ['Llovizna ligera', 'cloud-drizzle'],
  53: ['Llovizna', 'cloud-drizzle'],
  55: ['Llovizna intensa', 'cloud-drizzle'],
  61: ['Lluvia ligera', 'cloud-rain'],
  63: ['Lluvia', 'cloud-rain'],
  65: ['Lluvia intensa', 'cloud-rain'],
  71: ['Nieve ligera', 'snowflake'],
  73: ['Nieve', 'snowflake'],
  75: ['Nieve intensa', 'snowflake'],
  80: ['Chubascos ligeros', 'cloud-rain'],
  81: ['Chubascos', 'cloud-rain'],
  82: ['Chubascos intensos', 'cloud-rain'],
  95: ['Tormenta', 'cloud-lightning'],
  96: ['Tormenta con granizo', 'cloud-lightning'],
  99: ['Tormenta con granizo', 'cloud-lightning']
};

function setUser(name) {
  const formattedName = name.trim().slice(0, 30) || 'Ines';
  currentUser = formattedName;
  localStorage.setItem(identityKey, formattedName);
  document.querySelector('#userName').textContent = formattedName;
  document.querySelector('#userAvatar').textContent = formattedName.slice(0, 2).toUpperCase();
  document.querySelector('#privateUserLabel').textContent = formattedName;
  document.querySelector('#identityModal').classList.remove('visible');
  renderNotes();
}

const savedUser = localStorage.getItem(identityKey);
if (!supabaseClient && !supabaseConfigured) {
  if (requestedUser) {
    setUser(requestedUser);
  } else if (savedUser) {
    setUser(savedUser);
  } else {
    document.querySelector('#identityModal').classList.add('visible');
  }
}

if (!supabaseConfigured) {
  document.querySelectorAll('[data-user]').forEach((option) => {
    option.addEventListener('click', () => setUser(option.dataset.user));
  });
}

function readNotes(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function renderNoteList(elementId, notes, emptyText) {
  const list = document.querySelector(`#${elementId}`);
  list.innerHTML = notes.length ? notes.map((note, index) => `<div class="note-row ${note.completed ? 'completed' : ''} ${note.priority === 'urgent' ? 'urgent' : ''}"><button type="button" class="complete-note" data-note-list="${elementId}" data-note-index="${index}" data-note-id="${note.id || ''}" aria-label="${note.completed ? 'Reabrir nota' : 'Marcar como hecha'}" title="${note.completed ? 'Reabrir nota' : 'Marcar como hecha'}"><i data-lucide="${note.completed ? 'check-circle-2' : 'circle'}"></i></button><span>${escapeHtml(note.content || note)}</span>${note.priority === 'urgent' && !note.completed ? '<b class="urgent-badge">Urgente</b>' : ''}<button type="button" class="delete-note" data-note-list="${elementId}" data-note-index="${index}" data-note-id="${note.id || ''}" aria-label="Eliminar nota" title="Eliminar nota"><i data-lucide="trash-2"></i></button></div>`).join('') : `<p class="empty-note">${emptyText}</p>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function getNotes() {
  if (supabaseClient && authUserId) {
    const { data, error } = await supabaseClient.from('notes').select('id, content, scope, priority, completed, owner_id, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return { shared: data.filter((note) => note.scope === 'shared'), private: data.filter((note) => note.scope === 'private') };
  }
  return { shared: readNotes(localSharedNotesKey), private: readNotes(localPrivateNotesKey()) };
}

async function renderNotes() {
  let notes;
  try {
    notes = await getNotes();
  } catch {
    notes = { shared: [], private: [] };
    showToast('No se pudieron cargar las notas');
  }
  const sharedNotes = notes.shared;
  const privateNotes = notes.private;
  renderNoteList('sharedNotes', sharedNotes, 'No hay notas compartidas.');
  renderNoteList('privateNotes', privateNotes, 'Tus notas privadas aparecerán aquí.');
  const totalNotes = sharedNotes.length + privateNotes.length;
  document.querySelector('#notesCount').textContent = `${totalNotes} ${totalNotes === 1 ? 'nota' : 'notas'}`;
  document.querySelector('#notesPreview').textContent = sharedNotes[0]?.content || sharedNotes[0] || 'Nada pendiente';
  renderAttention({ urgentCount: [...sharedNotes, ...privateNotes].filter((note) => note.priority === 'urgent' && !note.completed).length });
  showUrgentNotes([...sharedNotes, ...privateNotes]);
  lucide.createIcons();
}

function showUrgentNotes(notes) {
  const urgentNotes = notes.filter((note) => note.priority === 'urgent' && !note.completed);
  if (!urgentNotes.length || sessionStorage.getItem('umbral-urgent-seen') === 'true') return;
  document.querySelector('#urgentList').innerHTML = urgentNotes.map((note) => `<p><i data-lucide="alert-circle"></i>${escapeHtml(note.content)}</p>`).join('');
  urgentModal.classList.add('visible');
  sessionStorage.setItem('umbral-urgent-seen', 'true');
  lucide.createIcons();
}

const attentionState = { urgentCount: 0, pendingBills: 0, settlementAmount: 0 };

function renderAttention(nextState = {}) {
  Object.assign(attentionState, nextState);
  const { urgentCount, pendingBills, settlementAmount } = attentionState;
  const list = document.querySelector('#attentionList');
  const count = document.querySelector('#attentionCount');
  if (!list || !count) return;
  const items = [];
  if (urgentCount) items.push({ icon: 'siren', title: `${urgentCount} nota${urgentCount === 1 ? '' : 's'} urgente${urgentCount === 1 ? '' : 's'}`, detail: 'Revisar en Notas', action: 'notes' });
  if (pendingBills) items.push({ icon: 'receipt-text', title: `${pendingBills} factura${pendingBills === 1 ? '' : 's'} pendiente${pendingBills === 1 ? '' : 's'}`, detail: 'Revisar en Casa financiera', action: 'finance' });
  if (settlementAmount > 0.009) items.push({ icon: 'arrow-right-left', title: `Liquidación pendiente · ${financeMoney(settlementAmount)}`, detail: 'Registrar un pago cuando lo hagáis', action: 'finance' });
  count.textContent = items.length ? `${items.length} pendiente${items.length === 1 ? '' : 's'}` : 'Todo en orden';
  list.innerHTML = items.length ? items.map((item) => `<button type="button" class="attention-item" data-attention-action="${item.action}"><span class="attention-item-icon"><i data-lucide="${item.icon}"></i></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span><i data-lucide="chevron-right"></i></button>`).join('') : '<div class="attention-empty"><i data-lucide="sparkles"></i><span>No hay nada urgente. La casa está tranquila.</span></div>';
  lucide.createIcons();
}

document.querySelector('#attentionList').addEventListener('click', (event) => {
  const action = event.target.closest('[data-attention-action]')?.dataset.attentionAction;
  if (!action) return;
  if (action === 'notes') openNotes();
  if (action === 'finance') openFinance();
});

function openNotes() {
  renderNotes();
  notesModal.classList.add('visible');
  if (history.state?.page !== 'notes') history.pushState({ page: 'notes' }, '', '#notas');
  initDrawing();
}

document.querySelector('[data-action="notes"]').addEventListener('click', openNotes);
document.querySelector('[data-action="notes"]').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') openNotes();
});
document.querySelector('#closeNotes').addEventListener('click', () => history.back());
document.querySelector('#closeUrgent').addEventListener('click', () => { urgentModal.classList.remove('visible'); openNotes(); });
document.querySelectorAll('.note-form').forEach((form) => {
  const textInput = form.querySelector('input[type="text"]');
  const urgentInput = form.querySelector('[name="urgent"]');
  const submitButton = form.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.addEventListener('click', (event) => {
      if (!textInput || !textInput.value.trim()) {
        event.preventDefault();
        textInput?.focus();
        return;
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!textInput) return;

    const content = textInput.value.trim();
    if (!content) {
      textInput.focus();
      return;
    }

    const scope = form.dataset.noteType;
    const priority = urgentInput?.checked ? 'urgent' : 'normal';

    if (supabaseClient && authUserId) {
      const { error } = await supabaseClient.from('notes').insert({ content, scope, priority, owner_id: authUserId, household_id: householdId });
      if (error) return showToast('No se pudo guardar la nota');
    } else {
      const key = scope === 'shared' ? localSharedNotesKey : localPrivateNotesKey();
      const notes = readNotes(key);
      notes.unshift(content);
      localStorage.setItem(key, JSON.stringify(notes));
    }

    textInput.value = '';
    if (urgentInput) urgentInput.checked = false;
    renderNotes();
    showToast(scope === 'shared' ? 'Nota compartida sincronizada' : 'Nota privada guardada');
  });
});
document.querySelector('#notesModal').addEventListener('click', async (event) => {
  const completeButton = event.target.closest('.complete-note');
  if (completeButton) {
    if (supabaseClient && authUserId && completeButton.dataset.noteId) {
      const notes = await getNotes();
      const note = [...notes.shared, ...notes.private].find((item) => item.id === completeButton.dataset.noteId);
      const { error } = await supabaseClient.from('notes').update({ completed: !note.completed }).eq('id', note.id);
      if (error) return showToast('No se pudo actualizar la nota');
      if (!note.completed && note.scope === 'shared') notifyOtherUser('Nota completada', `${currentUser} ha completado: ${note.content}`);
    } else {
      const key = completeButton.dataset.noteList === 'sharedNotes' ? localSharedNotesKey : localPrivateNotesKey();
      const notes = readNotes(key);
      notes[Number(completeButton.dataset.noteIndex)].completed = !notes[Number(completeButton.dataset.noteIndex)].completed;
      localStorage.setItem(key, JSON.stringify(notes));
    }
    renderNotes();
    return;
  }
  const deleteButton = event.target.closest('.delete-note');
  if (!deleteButton) return;
  if (supabaseClient && authUserId && deleteButton.dataset.noteId) {
    const { error } = await supabaseClient.from('notes').delete().eq('id', deleteButton.dataset.noteId);
    if (error) return showToast('No se pudo eliminar la nota');
  } else {
    const key = deleteButton.dataset.noteList === 'sharedNotes' ? localSharedNotesKey : localPrivateNotesKey();
    const notes = readNotes(key);
    notes.splice(Number(deleteButton.dataset.noteIndex), 1);
    localStorage.setItem(key, JSON.stringify(notes));
  }
  renderNotes();
});

const calendarModal = document.querySelector('#calendarModal');
const localEventsKey = () => `umbral-events-${currentUser.toLowerCase()}`;
let selectedDate = new Date();
let visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let cachedEvents = [];

function dateToISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeEventDate(value) {
  return String(value || '').slice(0, 10);
}

function formatEventDate(date) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

function readEvents() {
  try {
    return JSON.parse(localStorage.getItem(localEventsKey()) || '[]');
  } catch {
    return [];
  }
}

async function getEvents() {
  if (supabaseClient && authUserId) {
    const [homeEvents, iphoneEvents] = await Promise.all([
      supabaseClient.from('events').select('id, title, event_date, event_time, duration, location, scope, owner_id, created_at').order('event_date').order('event_time'),
      supabaseClient.from('iphone_events').select('id, external_id, title, event_date, event_time, duration_minutes, location, calendar_name, owner').order('event_date').order('event_time')
    ]);
    if (iphoneEvents.error) throw iphoneEvents.error;
    const importedEvents = iphoneEvents.data.map((event) => ({ ...event, id: `iphone-${event.id}`, event_date: normalizeEventDate(event.event_date), duration: event.duration_minutes ? `${event.duration_minutes} min` : '', event_time: event.event_time || '00:00', scope: 'private', source: 'iphone' }));
    return [...(homeEvents.error ? [] : homeEvents.data), ...importedEvents];
  }
  return readEvents();
}

function renderCalendar() {
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(visibleMonth);
  document.querySelector('#calendarMonth').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const firstDay = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const todayISO = dateToISO(new Date());
  const selectedISO = dateToISO(selectedDate);
  const days = [];
  for (let index = 0; index < firstDay; index += 1) days.push('<span class="calendar-day empty"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    const dateISO = dateToISO(date);
    const hasHomeEvents = cachedEvents.some((event) => normalizeEventDate(event.event_date) === dateISO && event.source !== 'iphone');
    const hasIphoneEvents = cachedEvents.some((event) => normalizeEventDate(event.event_date) === dateISO && event.source === 'iphone');
    const markers = `${hasHomeEvents ? '<i class="home-marker"></i>' : ''}${hasIphoneEvents ? '<i class="iphone-marker"></i>' : ''}`;
    days.push(`<button type="button" class="calendar-day ${dateISO === todayISO ? 'today' : ''} ${dateISO === selectedISO ? 'selected' : ''}" data-calendar-date="${dateISO}">${day}${markers}</button>`);
  }
  document.querySelector('#calendarDays').innerHTML = days.join('');
  document.querySelectorAll('[data-calendar-date]').forEach((dayButton) => {
    dayButton.addEventListener('click', () => {
      selectedDate = new Date(`${dayButton.dataset.calendarDate}T12:00:00`);
      renderCalendar();
      renderSelectedDay();
    });
  });
}

function renderSelectedDay() {
  const dateISO = dateToISO(selectedDate);
  const dayEvents = cachedEvents.filter((event) => normalizeEventDate(event.event_date) === dateISO).sort((first, second) => (first.event_time || '00:00').localeCompare(second.event_time || '00:00'));
  const dateLabel = formatEventDate(selectedDate);
  document.querySelector('#selectedDateLabel').textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  document.querySelector('#selectedDayCount').textContent = `${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`;
  document.querySelector('#calendarEvents').innerHTML = dayEvents.length ? dayEvents.map((event) => { const isIphoneEvent = event.source === 'iphone'; const sourceLabel = isIphoneEvent ? 'Calendario iPhone' : 'Smart Home'; const eventLocation = event.location || (event.scope === 'shared' ? 'Casa · Compartido' : `Solo para ${currentUser}`); return `<div class="calendar-event ${isIphoneEvent ? 'iphone-event' : 'home-event'}"><div class="time-block"><strong>${(event.event_time || '00:00').slice(0, 5)}</strong><span>${event.duration || 'Sin duración'}</span></div><div class="event-line"></div><div class="event-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(eventLocation)}</span></div><span class="source-tag">${sourceLabel}</span>${event.scope === 'shared' && !isIphoneEvent ? '<span class="shared-tag">Casa</span>' : ''}${!isIphoneEvent ? `<button type="button" class="export-event" data-event-index="${cachedEvents.indexOf(event)}" aria-label="Añadir al Calendario del iPhone" title="Añadir al Calendario del iPhone"><i data-lucide="calendar-plus"></i></button><button type="button" class="delete-event" data-event-id="${event.id || ''}" data-event-index="${cachedEvents.indexOf(event)}" aria-label="Eliminar evento" title="Eliminar evento"><i data-lucide="trash-2"></i></button>` : ''}</div>`; }).join('') : '<p class="empty-note">No hay eventos para este día.</p>';
  const eventForm = document.querySelector('#eventForm');
  eventForm.date.value = dateISO;
  lucide.createIcons();
}

async function renderCalendarData() {
  try {
    cachedEvents = await getEvents();
  } catch (error) {
    cachedEvents = [];
    const status = document.querySelector('#eventsConnectionStatus');
    status.innerHTML = `<i data-lucide="circle-alert"></i> Error cargando eventos: ${escapeHtml(error.message || 'permiso denegado')}`;
    lucide.createIcons();
    showToast('No se pudieron cargar los eventos');
    renderCalendar();
    renderSelectedDay();
    return;
  }
  renderCalendar();
  renderSelectedDay();
  const count = cachedEvents.filter((event) => normalizeEventDate(event.event_date) === dateToISO(new Date())).length;
  document.querySelector('#calendarPreview').innerHTML = count ? `<b>${count} ${count === 1 ? 'evento' : 'eventos'}</b> · ver agenda` : 'Sin eventos para hoy · añadir uno';
  document.querySelector('#eventsConnectionStatus').innerHTML = `<i data-lucide="cloud-check"></i> ${cachedEvents.length} eventos cargados · Smart Home e iPhone`;
  lucide.createIcons();
}

async function openCalendar() {
  calendarModal.classList.add('visible');
  if (history.state?.page !== 'calendar') history.pushState({ page: 'calendar' }, '', '#agenda');
  await renderCalendarData();
}

document.querySelector('[data-action="calendar"]').addEventListener('click', openCalendar);
document.querySelector('#previousMonth').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderCalendar(); });
document.querySelector('#nextMonth').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderCalendar(); });
document.querySelector('#closeCalendar').addEventListener('click', () => history.back());
document.querySelector('#eventForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const eventData = { title: form.title.value.trim(), event_date: form.date.value, event_time: form.time.value || null, duration: form.duration.value.trim(), location: form.location.value.trim(), scope: form.scope.value };
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from('events').insert({ ...eventData, owner_id: authUserId, household_id: householdId });
    if (error) return showToast('No se pudo guardar el evento');
  } else {
    const events = readEvents();
    events.push({ ...eventData, id: createLocalId() });
    localStorage.setItem(localEventsKey(), JSON.stringify(events));
  }
  selectedDate = new Date(`${eventData.event_date}T12:00:00`);
  visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  form.title.value = '';
  form.time.value = '';
  form.duration.value = '';
  form.location.value = '';
  await renderCalendarData();
  showToast(eventData.scope === 'shared' ? 'Evento compartido añadido' : 'Evento personal añadido');
});
document.querySelector('#calendarEvents').addEventListener('click', async (event) => {
  const exportButton = event.target.closest('.export-event');
  if (exportButton) {
    downloadICS(cachedEvents[Number(exportButton.dataset.eventIndex)]);
    return;
  }
  const deleteButton = event.target.closest('.delete-event');
  if (!deleteButton) return;
  if (supabaseClient && authUserId && deleteButton.dataset.eventId) {
    const { error } = await supabaseClient.from('events').delete().eq('id', deleteButton.dataset.eventId);
    if (error) return showToast('No se pudo eliminar el evento');
  } else {
    const events = readEvents();
    events.splice(Number(deleteButton.dataset.eventIndex), 1);
    localStorage.setItem(localEventsKey(), JSON.stringify(events));
  }
  renderCalendarData();
});

function downloadICS(event) {
  const start = new Date(`${event.event_date}T${event.event_time || '00:00'}:00`);
  const end = new Date(start.getTime() + parseDuration(event.duration));
  const icsDate = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escapeICS = (value) => String(value || '').replace(/[\\;,\n]/g, (character) => `\\${character}`);
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Umbral Smart Home//ES', 'BEGIN:VEVENT', `UID:${event.id || createLocalId()}@umbral`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}Z`, `DTEND:${icsDate(end)}Z`, `SUMMARY:${escapeICS(event.title)}`, event.location ? `LOCATION:${escapeICS(event.location)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'evento'}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Abre el archivo para añadirlo al Calendario');
}

function parseDuration(duration) {
  const hours = Number(String(duration).match(/(\d+(?:[.,]\d+)?)\s*h/i)?.[1]?.replace(',', '.') || 1);
  const minutes = Number(String(duration).match(/(\d+)\s*min/i)?.[1] || 0);
  return (hours * 60 + minutes) * 60 * 1000;
}

function notifyOtherUser(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  showToast(body);
}

const drawingCanvas = document.querySelector('#sharedCanvas');
const drawingKey = 'umbral-shared-drawing';
let drawingStrokes = [];
let activeStroke;
let drawingReady = false;

function resizeDrawingCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = drawingCanvas.getBoundingClientRect();
  drawingCanvas.width = rect.width * ratio;
  drawingCanvas.height = rect.height * ratio;
  drawingCanvas.getContext('2d').scale(ratio, ratio);
  drawStrokes();
}

function drawStrokes() {
  const context = drawingCanvas.getContext('2d');
  const rect = drawingCanvas.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  context.strokeStyle = '#275b49';
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  drawingStrokes.forEach((stroke) => {
    if (stroke.points.length < 2) return;
    context.beginPath();
    stroke.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.stroke();
  });
}

async function loadDrawing() {
  if (supabaseClient && authUserId) {
    const { data, error } = await supabaseClient.from('shared_drawing').select('strokes').eq('id', 1).maybeSingle();
    if (error) throw error;
    drawingStrokes = data?.strokes || [];
  } else {
    drawingStrokes = readNotes(drawingKey);
  }
  drawStrokes();
}

async function saveDrawing() {
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from('shared_drawing').upsert({ id: 1, strokes: drawingStrokes, updated_by: authUserId, household_id: householdId, updated_at: new Date().toISOString() });
    if (error) showToast('No se pudo sincronizar la pizarra');
  } else {
    localStorage.setItem(drawingKey, JSON.stringify(drawingStrokes));
  }
}

async function initDrawing() {
  if (!drawingReady) {
    drawingCanvas.addEventListener('pointerdown', (event) => {
      drawingCanvas.setPointerCapture(event.pointerId);
      const rect = drawingCanvas.getBoundingClientRect();
      activeStroke = { points: [{ x: event.clientX - rect.left, y: event.clientY - rect.top }] };
      drawingStrokes.push(activeStroke);
      drawStrokes();
    });
    drawingCanvas.addEventListener('pointermove', (event) => {
      if (!activeStroke) return;
      const rect = drawingCanvas.getBoundingClientRect();
      activeStroke.points.push({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      drawStrokes();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => drawingCanvas.addEventListener(eventName, () => { if (activeStroke) saveDrawing(); activeStroke = null; }));
    window.addEventListener('resize', resizeDrawingCanvas);
    drawingReady = true;
    resizeDrawingCanvas();
  }
  loadDrawing().catch(() => showToast('No se pudo cargar la pizarra compartida'));
}

document.querySelector('#clearDrawing').addEventListener('click', () => { drawingStrokes = []; drawStrokes(); saveDrawing(); showToast('Pizarra borrada'); });

async function enableNotifications() {
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
}

async function connectNotes() {
  const status = document.querySelector('#notesConnectionStatus');
  if (!supabaseClient) {
    if (supabaseConfigured) {
      status.innerHTML = '<i data-lucide="circle-alert"></i> No se pudo cargar el cliente seguro de Supabase';
      authModal.classList.add('visible');
    } else {
      status.innerHTML = '<i data-lucide="hard-drive"></i> Modo local: configura Supabase para sincronizar';
    }
    lucide.createIcons();
    return;
  }
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  const sessionUser = sessionData.session?.user;
  const isAnonymousSession = Boolean(sessionUser?.is_anonymous || sessionUser?.app_metadata?.provider === 'anonymous');
  if (sessionError || !sessionData.session || isAnonymousSession) {
    if (isAnonymousSession) await supabaseClient.auth.signOut();
    status.innerHTML = '<i data-lucide="lock-keyhole"></i> Inicia sesión para sincronizar tus datos';
    authModal.classList.add('visible');
    lucide.createIcons();
    return;
  }
  authUserId = sessionData.session.user.id;
  const inviteToken = new URLSearchParams(window.location.search).get('invite');
  if (inviteToken) {
    const { data: acceptedHousehold, error: inviteError } = await supabaseClient.rpc('accept_household_invite', { raw_token: inviteToken });
    if (!inviteError && acceptedHousehold) householdId = acceptedHousehold;
  }
  householdId = householdId || await ensureHousehold();
  if (!householdId) {
    status.innerHTML = '<i data-lucide="circle-alert"></i> No se pudo preparar tu hogar compartido';
    lucide.createIcons();
    return;
  }
  const { data: profile } = await supabaseClient.from('profiles').select('display_name').eq('id', authUserId).maybeSingle();
  if (profile?.display_name) setUser(profile.display_name);
  document.querySelector('#accountDisplayName').textContent = profile?.display_name || currentUser;
  document.querySelector('#accountAvatar').textContent = (profile?.display_name || currentUser).slice(0, 2).toUpperCase();
  document.querySelector('#accountEmail').textContent = sessionData.session.user.email || 'Cuenta autenticada';
  if (householdRole === 'guest') {
    document.querySelectorAll('[data-action="finance"]').forEach((element) => { element.hidden = true; });
    document.querySelectorAll('.finance-modal').forEach((element) => element.setAttribute('aria-hidden', 'true'));
  }
  await loadHouseholdAdmin();
  if (inviteToken) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  await supabaseClient.auth.updateUser({ data: { name: currentUser } });
  status.innerHTML = '<i data-lucide="cloud-check"></i> Sincronizado entre los dos teléfonos';
  lucide.createIcons();
  renderNotes();
  await enableNotifications();
  supabaseClient.channel('notes-live').on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
    if (payload.eventType === 'UPDATE' && payload.new.completed && payload.new.owner_id !== authUserId && payload.new.scope === 'shared') {
      notifyOtherUser('Nota completada', 'La otra persona ha completado una nota compartida.');
    }
    renderNotes();
  }).subscribe();
  supabaseClient.channel('drawing-live').on('postgres_changes', { event: '*', schema: 'public', table: 'shared_drawing' }, (payload) => {
    if (payload.new?.updated_by !== authUserId) {
      drawingStrokes = payload.new?.strokes || [];
      drawStrokes();
    }
  }).subscribe();
  supabaseClient.channel('events-live').on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
    if (calendarModal.classList.contains('visible')) renderCalendarData();
  }).subscribe();
}

async function ensureHousehold() {
  const { data: memberships, error: membershipError } = await supabaseClient.from('household_members').select('household_id, role').eq('user_id', authUserId).limit(1);
  if (membershipError) return null;
  if (memberships?.[0]?.household_id) {
    householdRole = memberships[0].role;
    return memberships[0].household_id;
  }
  const { data: household, error: householdError } = await supabaseClient.from('households').insert({ name: 'Casa', created_by: authUserId }).select('id').single();
  if (householdError) return null;
  const { error: memberError } = await supabaseClient.from('household_members').insert({ household_id: household.id, user_id: authUserId, role: 'owner' });
  householdRole = 'owner';
  return memberError ? null : household.id;
}

async function loadHouseholdAdmin() {
  const admin = document.querySelector('#householdAdmin');
  if (!admin || !householdId) return;
  const { data: members } = await supabaseClient.from('household_members').select('user_id, role').eq('household_id', householdId);
  const isOwner = members?.some((member) => member.user_id === authUserId && member.role === 'owner');
  if (!isOwner) return;
  const mount = document.querySelector('#accountMembersMount');
  if (mount) mount.appendChild(admin);
  admin.hidden = false;
  document.querySelector('#householdMemberCount').textContent = `${members.length} ${members.length === 1 ? 'persona' : 'personas'}`;
}

async function hashInviteToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

let authSignUpMode = false;
function showAuthError(message) { document.querySelector('#authError').textContent = message; }

const authErrorParams = new URLSearchParams(window.location.search);
if (authErrorParams.get('error')) {
  authModal.classList.add('visible');
  showAuthError(authErrorParams.get('error_description') || 'El enlace de confirmación no es válido o ha caducado. Solicita un correo nuevo.');
  window.history.replaceState({}, document.title, window.location.pathname);
}

document.querySelector('#authModeSwitch').addEventListener('click', (event) => {
  authSignUpMode = !authSignUpMode;
  event.currentTarget.textContent = authSignUpMode ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva';
  document.querySelector('#authTitle').textContent = authSignUpMode ? 'Crea tu acceso.' : 'Tu casa, protegida.';
  const nameField = document.querySelector('.auth-name-field');
  nameField.hidden = !authSignUpMode;
  nameField.querySelector('select').required = authSignUpMode;
  document.querySelector('.auth-submit').innerHTML = `<i data-lucide="${authSignUpMode ? 'user-plus' : 'log-in'}"></i> ${authSignUpMode ? 'Crear cuenta' : 'Entrar'}`;
  showAuthError('');
  lucide.createIcons();
});

document.querySelector('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return showAuthError(supabaseConfigured ? 'No se pudo cargar la conexión segura. Recarga Umbral con conexión a internet.' : 'Configura Supabase para activar el acceso seguro.');
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email')).trim();
  const password = String(form.get('password'));
  const displayName = String(form.get('displayName') || '').trim();
  const submit = event.currentTarget.querySelector('.auth-submit');
  submit.disabled = true;
  showAuthError('');
  const pendingInvite = new URLSearchParams(window.location.search).get('invite');
  const emailRedirectTo = `${window.location.origin}${window.location.pathname}${pendingInvite ? `?invite=${encodeURIComponent(pendingInvite)}` : ''}`;
  const result = authSignUpMode
    ? await supabaseClient.auth.signUp({ email, password, options: { data: { name: displayName || email.split('@')[0] }, emailRedirectTo } })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  submit.disabled = false;
  if (result.error) return showAuthError(result.error.message);
  if (authSignUpMode && !result.data.session) return showAuthError('Revisa tu correo para confirmar la cuenta y vuelve a entrar.');
  authModal.classList.remove('visible');
  await connectNotes();
});

document.querySelector('#userAvatar').addEventListener('click', () => {
  if (supabaseClient && authUserId) {
    document.querySelector('#accountModal').classList.add('visible');
    lucide.createIcons();
  } else if (supabaseConfigured) {
    authModal.classList.add('visible');
  }
});
document.querySelector('#closeAccount').addEventListener('click', () => document.querySelector('#accountModal').classList.remove('visible'));
document.querySelector('#signOutButton').addEventListener('click', async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  window.location.reload();
});

document.querySelector('#inviteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient || !householdId) return;
  const values = new FormData(event.currentTarget);
  const tokenBytes = new Uint8Array(24);
  crypto.getRandomValues(tokenBytes);
  const token = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const tokenHash = await hashInviteToken(token);
  const { error } = await supabaseClient.from('household_invites').insert({ household_id: householdId, invited_email: String(values.get('email')).trim().toLowerCase(), role: values.get('role'), token_hash: tokenHash, created_by: authUserId });
  const result = document.querySelector('#inviteResult');
  if (error) { result.textContent = error.message; return; }
  const link = `${window.location.origin}${window.location.pathname}?invite=${token}`;
  result.textContent = `Enlace creado: ${link}`;
  event.currentTarget.reset();
});

function formatToday() {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

async function loadWeather() {
  const response = await fetch(weatherUrl);
  if (!response.ok) throw new Error('No se pudo consultar el tiempo');
  const data = await response.json();
  const current = data.current;
  const daily = data.daily;
  const [description, icon] = weatherDescriptions[current.weather_code] || ['Tiempo variable', 'cloud-sun'];
  const temperature = Math.round(current.temperature_2m);
  document.querySelector('#todayLabel').textContent = formatToday();
  document.querySelector('#headerWeather').textContent = `· ${temperature}° / ${description.toLowerCase()}`;
  document.querySelector('#orientationWeather').textContent = `${temperature}° · ${description}`;
  document.querySelector('#orientationDate').textContent = formatToday();
  document.querySelector('#weatherTemp').textContent = `${temperature}°`;
  document.querySelector('#weatherDescription').textContent = `${description} · Sensación ${Math.round(current.apparent_temperature)}°`;
  document.querySelector('#weatherDetails').textContent = `Humedad ${current.relative_humidity_2m}% · Máx. ${Math.round(daily.temperature_2m_max[0])}° / mín. ${Math.round(daily.temperature_2m_min[0])}°`;
  const weatherIcon = document.querySelector('.climate-card .card-icon svg');
  weatherIcon.setAttribute('data-lucide', icon);
  weatherIcon.outerHTML = `<i data-lucide="${icon}"></i>`;
  lucide.createIcons();
  return true;
}

function updateWeather() {
  return loadWeather().catch(() => {
    document.querySelector('#headerWeather').textContent = '· Tiempo no disponible';
    document.querySelector('#weatherDescription').textContent = 'No se pudo actualizar';
    showToast('No se pudo actualizar el tiempo ahora');
    return false;
  });
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null;
}

function dailyWeatherData(data) {
  const days = {};
  data.hourly.time.forEach((time, index) => {
    const day = time.slice(0, 10);
    if (!days[day]) days[day] = { temperatures: [], humidity: [], rain: [] };
    days[day].temperatures.push(data.hourly.temperature_2m[index]);
    days[day].humidity.push(data.hourly.relative_humidity_2m[index]);
    days[day].rain.push(data.hourly.precipitation_probability[index] || 0);
  });
  return Object.entries(days).map(([date, values]) => ({ date, temperature: average(values.temperatures), humidity: average(values.humidity), rain: Math.max(...values.rain) }));
}

function renderWeatherChart(elementId, values, color, unit) {
  const element = document.querySelector(`#${elementId}`);
  const valid = values.filter((value) => Number.isFinite(value));
  if (!element || !valid.length) return;
  const width = 320;
  const height = 96;
  const padding = 8;
  const minimum = Math.min(...valid);
  const maximum = Math.max(...valid);
  const range = maximum - minimum || 1;
  const points = valid.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(valid.length - 1, 1);
    const y = height - padding - ((value - minimum) / range) * (height - padding * 2);
    return { x, y };
  });
  const line = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const last = points[points.length - 1];
  element.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica de ${unit}"><defs><linearGradient id="${elementId}Fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><line class="chart-gridline" x1="8" y1="24" x2="312" y2="24"/><line class="chart-gridline" x1="8" y1="72" x2="312" y2="72"/><polygon points="${area}" fill="url(#${elementId}Fill)"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last.x}" cy="${last.y}" r="4" fill="${color}"/><text x="8" y="93">${Math.round(minimum)}${unit === 'temperatura' ? '°' : '%'}</text><text x="312" y="15" text-anchor="end">${Math.round(maximum)}${unit === 'temperatura' ? '°' : '%'}</text></svg>`;
}

function renderForecast(days, data) {
  const list = document.querySelector('#forecastList');
  const today = new Date().toISOString().slice(0, 10);
  const firstFutureDay = Math.max(days.findIndex((day) => day >= today), 0);
  list.innerHTML = days.slice(firstFutureDay, firstFutureDay + 7).map((day, offset) => {
    const index = firstFutureDay + offset;
    const weatherCode = data.daily.weather_code[index] ?? 3;
    const [description, icon] = weatherDescriptions[weatherCode] || ['Variable', 'cloud-sun'];
    const label = index === 0 ? 'Hoy' : new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(new Date(`${day}T12:00:00`));
    return `<div class="forecast-row"><strong>${label}</strong><i data-lucide="${icon}"></i><span>${description}</span><b>${Math.round(data.daily.temperature_2m_max[index])}° <em>${Math.round(data.daily.temperature_2m_min[index])}°</em></b></div>`;
  }).join('');
  lucide.createIcons();
}

function renderWeatherAdvice(days) {
  const advice = document.querySelector('#weatherAdvice');
  const rainyDay = days.slice(-7).find((day) => day.rain >= 55);
  if (rainyDay) {
    const label = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(`${rainyDay.date}T12:00:00`));
    advice.innerHTML = `<i data-lucide="umbrella"></i><span><strong>Lleva paraguas el ${label}.</strong><br />Hay una probabilidad alta de lluvia en la previsión.</span>`;
  } else {
    advice.innerHTML = '<i data-lucide="sparkles"></i><span><strong>Semana bastante estable.</strong><br />No aparece ninguna alerta meteorológica importante.</span>';
  }
  lucide.createIcons();
}

async function loadWeatherDetails() {
  const updated = document.querySelector('#weatherUpdated');
  try {
    const response = await fetch(weatherDetailUrl);
    if (!response.ok) throw new Error('No se pudo cargar el detalle meteorológico');
    const data = await response.json();
    const daily = dailyWeatherData(data);
    renderWeatherChart('temperatureChart', daily.slice(0, -7).map((day) => day.temperature), '#275b49', 'temperatura');
    renderWeatherChart('humidityChart', daily.slice(0, -7).map((day) => day.humidity), '#7b9bb5', 'humedad');
    renderForecast(data.daily.time, data);
    renderWeatherAdvice(daily);
    const currentIndex = Math.max(data.hourly.time.findIndex((time) => time >= new Date().toISOString().slice(0, 13)), 0);
    document.querySelector('#detailWeatherTemp').textContent = `${Math.round(data.hourly.temperature_2m[currentIndex])}°`;
    document.querySelector('#detailWeatherDescription').textContent = 'Condiciones actuales';
    document.querySelector('#detailWeatherMeta').innerHTML = `Humedad ${Math.round(data.hourly.relative_humidity_2m[currentIndex])}%<br />Previsión a 7 días`;
    updated.innerHTML = `<i data-lucide="clock-3"></i> Actualizado a las ${formatNewsTime()}`;
    lucide.createIcons();
  } catch {
    document.querySelector('#weatherAdvice').innerHTML = '<i data-lucide="wifi-off"></i><span>No se pudo actualizar el detalle meteorológico.</span>';
    lucide.createIcons();
  }
}

function openWeather() {
  weatherModal.classList.add('visible');
  if (history.state?.page !== 'weather') history.pushState({ page: 'weather' }, '', '#tiempo');
  loadWeatherDetails();
}

document.querySelector('#weatherCard').addEventListener('click', openWeather);
document.querySelector('#weatherCard').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') openWeather();
});
document.querySelector('#closeWeather').addEventListener('click', () => history.back());

const newsFeeds = {
  italy: { label: 'Italia', flag: 'IT', url: 'https://www.ansa.it/sito/ansait_rss.xml' },
  spain: { label: 'España', flag: 'ES', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' }
};
let activeNewsCountry = 'italy';
const newsCache = {};

function stripNewsMarkup(value) {
  const element = document.createElement('div');
  element.innerHTML = value || '';
  return element.textContent.trim();
}

function cleanNewsTitle(value) {
  return value.replace(/^\s*\d{1,2}\s+/, '').replace(/\s+/g, ' ').trim();
}

function classifyNews(title) {
  const categories = [
    ['Política', /governo|govern|elezion|politic|senato|congres|ministro|president|moncloa|parlamento/i],
    ['Economía', /econom|mercat|mercado|inflaz|inflac|banca|lavoro|empleo|empresa|prezzo|precio/i],
    ['Sociedad', /salute|sanit|scuola|educa|famil|turist|migr|societ|viv|seguridad/i],
    ['Cultura', /cinema|cultur|music|teatro|arte|libro|festival|venezia/i]
  ];
  return categories.find(([, pattern]) => pattern.test(title))?.[0] || 'Actualidad';
}

function formatNewsTime(date = new Date()) {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function renderNews(items, country) {
  const feed = document.querySelector('#italyNews');
  const insight = document.querySelector('#newsInsight');
  const source = newsFeeds[country];
  if (!items.length) {
    insight.textContent = 'No hemos podido construir el briefing en este momento.';
    feed.innerHTML = '<div class="news-empty"><i data-lucide="cloud-off"></i><strong>No hay noticias disponibles</strong><span>Prueba a actualizar en un momento.</span></div>';
    lucide.createIcons();
    return;
  }

  const [lead, ...secondary] = items.slice(0, 4);
  const categories = [...new Set(items.slice(0, 4).map((item) => item.category))];
  insight.innerHTML = `<strong>${items.length > 3 ? 'Panorama amplio' : 'Lo esencial'}</strong> · ${categories.slice(0, 2).join(' y ')} · ${items.length} titulares seleccionados`;
  feed.innerHTML = `
    <a class="news-lead" href="${lead.link}" target="_blank" rel="noreferrer">
      <span class="news-kicker"><span class="news-flag">${source.flag}</span> Lo más importante de ${source.label}</span>
      <strong>${escapeHtml(lead.title)}</strong>
      <span class="news-source">${escapeHtml(lead.source || 'Google News')} · ${escapeHtml(lead.timeLabel)}</span>
      <i data-lucide="arrow-up-right"></i>
    </a>
    <div class="news-list">${secondary.map((item, index) => `
      <a class="news-item" href="${item.link}" target="_blank" rel="noreferrer">
        <span class="news-item-index">${String(index + 2).padStart(2, '0')}</span>
        <span><strong>${escapeHtml(item.title)}</strong><small><b>${escapeHtml(item.category)}</b> · ${escapeHtml(item.source || 'Actualidad')} · ${escapeHtml(item.timeLabel)}</small></span>
        <i data-lucide="chevron-right"></i>
      </a>`).join('')}</div>`;
  lucide.createIcons();
}

async function loadNews(country = activeNewsCountry) {
  const feed = document.querySelector('#italyNews');
  const updated = document.querySelector('#newsUpdated');
  const refreshIcon = document.querySelector('#refreshNews svg');
  if (refreshIcon) refreshIcon.classList.add('spin');
  feed.innerHTML = '<div class="news-loading"><span></span><span></span><span></span></div>';
  try {
    const rssUrl = encodeURIComponent(newsFeeds[country].url);
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
    if (!response.ok) throw new Error('No se pudo cargar el resumen');
    const data = await response.json();
    if (data.status !== 'ok') throw new Error('Fuente no disponible');
    const items = (data.items || []).map((item) => ({
      title: cleanNewsTitle(stripNewsMarkup(item.title)), link: item.link,
      source: (item.author || data.feed?.title?.split(' - ')[0] || 'Actualidad').replace(/^Primo piano\s*/i, '').trim(),
      category: classifyNews(cleanNewsTitle(stripNewsMarkup(item.title))),
      timeLabel: formatNewsTime(new Date(item.pubDate))
    })).filter((item) => item.title && item.link);
    newsCache[country] = items;
    renderNews(items, country);
    updated.innerHTML = `<i data-lucide="clock-3"></i> Actualizado hoy a las ${formatNewsTime()}`;
    lucide.createIcons();
  } catch {
    renderNews(newsCache[country] || [], country);
    updated.innerHTML = '<i data-lucide="wifi-off"></i> No se pudo actualizar ahora';
    lucide.createIcons();
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spin');
  }
}

document.querySelectorAll('[data-news-country]').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeNewsCountry = tab.dataset.newsCountry;
    document.querySelectorAll('[data-news-country]').forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
    });
    loadNews(activeNewsCountry);
  });
});
document.querySelector('#refreshNews').addEventListener('click', () => loadNews(activeNewsCountry));

function financeMoney(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
}

function financeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date);
}

function readFinanceLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

async function getFinanceData() {
  if (supabaseClient && authUserId) {
    const [{ data: expenses, error: expensesError }, { data: bills, error: billsError }] = await Promise.all([
      supabaseClient.from('shared_expenses').select('*').order('expense_date', { ascending: false }),
      supabaseClient.from('shared_bills').select('*').order('due_date', { ascending: true })
    ]);
    if (expensesError) throw expensesError;
    if (billsError) throw billsError;
    const [{ data: fixedCosts, error: fixedError }, { data: settlements, error: settlementsError }] = await Promise.all([
      supabaseClient.from('shared_fixed_costs').select('*').eq('active', true).order('created_at'),
      supabaseClient.from('shared_settlements').select('*').order('payment_date', { ascending: false })
    ]);
    return { expenses: dedupeImportedExpenses(expenses || []), bills: bills || [], fixedCosts: fixedError || !fixedCosts?.length ? fixedError ? getLocalFixedCosts() : defaultFixedCosts : fixedCosts, settlements: settlementsError ? readFinanceLocal(localSettlementsKey) : (settlements || []).map((payment) => ({ ...payment, from: payment.from_person, to: payment.to_person })) };
  }
  return { expenses: readFinanceRecords(localExpensesKey), bills: readFinanceRecords(localBillsKey), fixedCosts: getLocalFixedCosts(), settlements: readFinanceRecords(localSettlementsKey) };
}

let financeCache = { expenses: [], bills: [] };

function readFinanceRecords(key) {
  const records = readFinanceLocal(key).map((entry) => entry.id ? entry : { ...entry, id: createLocalId() });
  const uniqueRecords = key === localExpensesKey ? dedupeImportedExpenses(records) : records;
  localStorage.setItem(key, JSON.stringify(uniqueRecords));
  return uniqueRecords;
}

function dedupeImportedExpenses(expenses) {
  const seen = new Set();
  return expenses.filter((expense) => {
    if (expense.source !== 'tricount' || !expense.source_reference) return true;
    if (seen.has(expense.source_reference)) return false;
    seen.add(expense.source_reference);
    return true;
  });
}

function getLocalFixedCosts() {
  const stored = readFinanceLocal(localFixedCostsKey);
  if (stored.length) return stored;
  localStorage.setItem(localFixedCostsKey, JSON.stringify(defaultFixedCosts));
  return defaultFixedCosts;
}

function financeSourceLabel(source) {
  return source === 'tricount' ? 'Tricount' : source === 'email' ? 'Correo' : source === 'fixed' ? 'Fijo' : 'Manual';
}

const financeCategories = ['Hogar', 'Alimentación', 'Transporte', 'Viajes', 'Ocio', 'Compras', 'Salud', 'Otros'];

function financeCategory(value, description = '') {
  const text = `${value || ''} ${description || ''}`.toLowerCase();
  if (/alquil|internet|tim|octopus|luz|agua|gas|hogar|casa/.test(text)) return 'Hogar';
  if (/pizza|pizz|cena|comida|comer|restaurant|restaurante|supermercado|compra|gelato|vino|aperitivo|bebida|aliment/.test(text)) return 'Alimentación';
  if (/tren|taxi|metro|bus|avion|aereo|aeropuerto|vuelo|viaje|hotel|airbnb|retorno|billete/.test(text)) return text.includes('viaj') || /avion|aereo|vuelo|hotel|airbnb|retorno/.test(text) ? 'Viajes' : 'Transporte';
  if (/ocio|cine|concierto|teatro|fiesta|entrada|bar/.test(text)) return 'Ocio';
  if (/regalo|ropa|compra|tienda|electron|mueble/.test(text)) return 'Compras';
  if (/farmacia|medic|salud|doctor|dentista/.test(text)) return 'Salud';
  return financeCategories.includes(value) ? value : 'Otros';
}

function financeEntries(data) {
  const safeData = {
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    bills: Array.isArray(data?.bills) ? data.bills : [],
    fixedCosts: Array.isArray(data?.fixedCosts) ? data.fixedCosts : []
  };
  return [
    ...safeData.expenses.map((entry) => ({ ...entry, kind: 'expense', date: entry.expense_date, category: financeCategory(entry.category, entry.description), payer: entry.paid_by || 'Ines', label: entry.description, settled: Boolean(entry.settled) })),
    ...safeData.bills.filter((entry) => Number(entry.amount) > 0).map((entry) => ({ ...entry, kind: 'bill', date: entry.due_date || entry.created_at, category: entry.provider || 'Otro', payer: entry.paid_by || 'Ines', label: `${entry.provider} · ${entry.description}` })),
    ...safeData.fixedCosts.filter((entry) => entry.active !== false).map((entry) => ({ ...entry, kind: 'fixed', date: new Date().toISOString().slice(0, 10), category: entry.category || 'Otros', payer: entry.paid_by || 'Ines', label: entry.description, source: 'fixed' }))
  ];
}

function filteredFinanceData(data) {
  const safeData = {
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    bills: Array.isArray(data?.bills) ? data.bills : []
  };
  const query = document.querySelector('#financeSearch')?.value.trim().toLowerCase() || '';
  const category = document.querySelector('#financeCategoryFilter')?.value || 'all';
  const period = document.querySelector('#financePeriod')?.value || 'all';
  const currentMonth = new Date().toISOString().slice(0, 7);
  const matches = (entry) => {
    const searchable = `${entry.description || ''} ${entry.provider || ''} ${entry.category || ''} ${entry.source || ''}`.toLowerCase();
    return (!query || searchable.includes(query)) && (category === 'all' || financeCategory(entry.category, entry.description) === category || entry.provider === category) && (period !== 'current' || String(entry.date || '').slice(0, 7) === currentMonth);
  };
  return { expenses: safeData.expenses.filter(matches), bills: safeData.bills.filter(matches) };
}

function calculateFinanceSettlement(entries, settlements = []) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const fairShare = total / 2;
  const paid = { Ines: 0, Matteo: 0 };
  entries.forEach((entry) => { paid[entry.payer] = (paid[entry.payer] || 0) + Number(entry.amount || 0); });
  settlements.forEach((payment) => {
    const amount = Number(payment.amount || 0);
    paid[payment.from] = (paid[payment.from] || 0) + amount;
    paid[payment.to] = (paid[payment.to] || 0) - amount;
  });
  const balance = { Ines: paid.Ines - fairShare, Matteo: paid.Matteo - fairShare };
  const creditor = balance.Ines >= 0 ? 'Ines' : 'Matteo';
  const debtor = creditor === 'Ines' ? 'Matteo' : 'Ines';
  const paymentsTotal = settlements.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return { total, fairShare, paid, balance, amount: Math.abs(balance[creditor]), creditor, debtor, paymentsTotal };
}

function renderFinanceBreakdown(entries) {
  const totals = entries.reduce((result, entry) => { result[entry.category] = (result[entry.category] || 0) + Number(entry.amount || 0); return result; }, {});
  const sorted = Object.entries(totals).sort(([, first], [, second]) => second - first);
  const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  document.querySelector('#financeBreakdownTotal').textContent = financeMoney(total);
  document.querySelector('#financeCategoryBreakdown').innerHTML = sorted.length ? sorted.map(([category, amount]) => `<button type="button" class="finance-category-row" data-finance-category="${escapeHtml(category)}"><strong>${escapeHtml(category)}</strong><div class="finance-category-track"><span style="width:${total ? Math.max(4, amount / total * 100) : 0}%"></span></div><b>${financeMoney(amount)}</b></button>`).join('') : '<p class="empty-note">Aún no hay datos para analizar.</p>';
}

function renderFinancePayerChart(settlement) {
  const maximum = Math.max(settlement.paid.Ines, settlement.paid.Matteo, 1);
  document.querySelector('#financePayerChart').innerHTML = ['Ines', 'Matteo'].map((person) => `<div class="finance-payer-row"><strong>${person}</strong><div class="finance-payer-track"><span style="width:${Math.max(3, settlement.paid[person] / maximum * 100)}%"></span></div><b>${financeMoney(settlement.paid[person])}</b></div>`).join('');
}

function renderFixedCosts(fixedCosts) {
  const list = document.querySelector('#fixedCostList');
  list.innerHTML = fixedCosts.length ? fixedCosts.map((cost) => `<div class="finance-fixed-item"><span class="fixed-cost-icon"><i data-lucide="repeat-2"></i></span><span class="finance-fixed-copy"><strong>${escapeHtml(cost.description)}</strong><small>${escapeHtml(cost.category || 'Otros')} · Pagó ${escapeHtml(cost.paid_by || 'Ines')} · Cada mes</small></span><b class="finance-fixed-amount">${financeMoney(cost.amount)}</b><span class="finance-item-actions"><button type="button" data-fixed-edit="${cost.id}" aria-label="Editar ${escapeHtml(cost.description)}" title="Editar"><i data-lucide="pencil"></i></button><button type="button" data-fixed-delete="${cost.id}" aria-label="Eliminar ${escapeHtml(cost.description)}" title="Eliminar"><i data-lucide="trash-2"></i></button></span></div>`).join('') : '<p class="empty-note">No hay gastos fijos configurados.</p>';
}

function renderFinance(data) {
  data = {
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    bills: Array.isArray(data?.bills) ? data.bills : [],
    fixedCosts: Array.isArray(data?.fixedCosts) ? data.fixedCosts : [],
    settlements: Array.isArray(data?.settlements) ? data.settlements : []
  };
  const expenseList = document.querySelector('#expenseList');
  const billList = document.querySelector('#billList');
  const allEntries = financeEntries(data);
  const visible = filteredFinanceData(data);
  const visibleEntries = financeEntries(visible);
  const settlement = calculateFinanceSettlement(allEntries, data.settlements);
  const billTotal = data.bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  const sourceCount = new Set(allEntries.map((entry) => entry.source || 'manual')).size;
  document.querySelector('#financeTotal').textContent = financeMoney(settlement.total);
  document.querySelector('#financeBalance').textContent = financeMoney(settlement.fairShare);
  document.querySelector('#financeExpenseCount').textContent = data.expenses.length;
  document.querySelector('#financeExpenseTotal').textContent = financeMoney(data.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0));
  document.querySelector('#financeBillCount').textContent = data.bills.filter((bill) => bill.status !== 'paid').length;
  document.querySelector('#financeBillTotal').textContent = financeMoney(billTotal);
  document.querySelector('#financeSourceCount').textContent = sourceCount;
  renderAttention({ pendingBills: data.bills.filter((bill) => bill.status !== 'paid').length, settlementAmount: settlement.amount });
  document.querySelector('#settlementPaymentTotal').textContent = `${financeMoney(settlement.paymentsTotal)} entregados`;
  renderFixedCosts(data.fixedCosts || []);
  document.querySelector('#financeSettlement').innerHTML = settlement.amount < 0.01 ? '<i data-lucide="check-circle-2"></i><span><strong>Casa al día.</strong><br />No queda ninguna compensación pendiente.</span>' : `<i data-lucide="arrow-right-left"></i><span><strong>${escapeHtml(settlement.debtor)} debe ${financeMoney(settlement.amount)} a ${escapeHtml(settlement.creditor)}.</strong><br />${settlement.paymentsTotal ? `${financeMoney(settlement.paymentsTotal)} ya entregados · ` : ''}Compensación global 50/50.</span>`;
  renderFinanceBreakdown(allEntries);
  renderFinancePayerChart(settlement);
  expenseList.innerHTML = visible.expenses.length ? visible.expenses.map((expense) => `<div class="finance-item"><span class="finance-item-icon"><i data-lucide="receipt"></i></span><span><strong>${escapeHtml(expense.description)} <em class="finance-item-source">${financeSourceLabel(expense.source)}</em></strong><small>${escapeHtml(financeCategory(expense.category, expense.description))} · ${financeDate(expense.expense_date)} · Pagó ${escapeHtml(expense.paid_by || 'Ines')}</small></span><b>${financeMoney(expense.amount)}</b><span class="finance-item-actions"><button type="button" data-expense-edit="${expense.id}" aria-label="Editar gasto" title="Editar"><i data-lucide="pencil"></i></button><button type="button" data-expense-delete="${expense.id}" aria-label="Eliminar gasto" title="Eliminar"><i data-lucide="trash-2"></i></button></span></div>`).join('') : '<p class="empty-note">No hay gastos con estos filtros.</p>';
  billList.innerHTML = visible.bills.length ? visible.bills.map((bill) => { const isPaid = bill.status === 'paid'; return `<div class="finance-item"><span class="finance-item-icon bill-icon"><i data-lucide="file-text"></i></span><span><strong>${escapeHtml(bill.provider)} · ${escapeHtml(bill.description)} <em class="finance-item-source">${financeSourceLabel(bill.source)}</em></strong><small>Vence ${financeDate(bill.due_date)} · Pagó ${escapeHtml(bill.paid_by || 'Ines')}</small><button type="button" class="finance-status-toggle" data-bill-status="${bill.id}"><i data-lucide="${isPaid ? 'check-circle-2' : 'circle'}"></i><em class="finance-status-badge ${isPaid ? 'is-paid' : ''}">${isPaid ? 'Pagada' : 'Pendiente'}</em></button></span><b>${bill.amount ? financeMoney(bill.amount) : 'Por revisar'}</b><span class="finance-item-actions"><button type="button" data-bill-edit="${bill.id}" aria-label="Editar factura" title="Editar"><i data-lucide="pencil"></i></button><button type="button" data-bill-delete="${bill.id}" aria-label="Eliminar factura" title="Eliminar"><i data-lucide="trash-2"></i></button></span></div>`; }).join('') : '<p class="empty-note">No hay facturas con estos filtros.</p>';
  lucide.createIcons();
}

async function refreshFinance() {
  try { financeCache = await getFinanceData(); renderFinance(financeCache); document.querySelector('#financeStatus').innerHTML = `<i data-lucide="cloud-check"></i> ${financeCache.expenses.length + financeCache.bills.length} movimientos guardados · reparto 50/50`; lucide.createIcons(); } catch { document.querySelector('#financeStatus').innerHTML = '<i data-lucide="circle-alert"></i> No se pudieron cargar los datos financieros.'; lucide.createIcons(); }
}

function openFinance() {
  financeModal.classList.add('visible');
  if (history.state?.page !== 'finance') history.pushState({ page: 'finance' }, '', '#finanzas');
  refreshFinance();
}

let financeEditing = null;

function setFinanceFormButton(form, label, icon) {
  const button = form.querySelector('button[type="submit"]');
  button.innerHTML = `<i data-lucide="${icon}"></i> ${label}`;
  lucide.createIcons();
}

function startFinanceEdit(kind, id) {
  const source = kind === 'expense' ? financeCache.expenses : kind === 'bill' ? financeCache.bills : financeCache.fixedCosts;
  const entry = source.find((item) => item.id === id);
  if (!entry) return;
  financeEditing = { kind, id };
  const form = document.querySelector(kind === 'expense' ? '#expenseForm' : kind === 'bill' ? '#billForm' : '#fixedCostForm');
  form.hidden = false;
  form.description.value = entry.description || '';
  form.amount.value = entry.amount || '';
  form.paidBy.value = entry.paid_by || 'Ines';
  if (kind === 'expense') {
    form.category.value = entry.category || 'Otros';
    form.date.value = entry.expense_date || '';
  }
  if (kind === 'bill') {
    form.provider.value = entry.provider || 'Otro';
    form.dueDate.value = entry.due_date || '';
    form.billingPeriod.value = entry.billing_period || '';
  }
  if (kind === 'fixed') form.category.value = entry.category || 'Otros';
  setFinanceFormButton(form, 'Guardar cambios', 'check');
  if (kind !== 'fixed') document.querySelector(`[data-finance-view="${kind === 'expense' ? 'expenses' : 'bills'}"]`).click();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveFinanceEntity(kind, values) {
  const table = kind === 'expense' ? 'shared_expenses' : kind === 'bill' ? 'shared_bills' : 'shared_fixed_costs';
  const key = kind === 'expense' ? localExpensesKey : kind === 'bill' ? localBillsKey : localFixedCostsKey;
  const record = { ...values };

  if (kind === 'fixed') {
    const records = getLocalFixedCosts();
    const index = financeEditing?.kind === kind ? records.findIndex((item) => item.id === financeEditing.id) : -1;
    const savedRecord = index >= 0 ? { ...records[index], ...record } : { ...record, id: createLocalId() };
    if (index >= 0) records[index] = savedRecord;
    else records.unshift(savedRecord);
    localStorage.setItem(localFixedCostsKey, JSON.stringify(records));
    financeEditing = null;

    if (supabaseClient && authUserId) {
      const query = savedRecord.id && index >= 0
        ? supabaseClient.from(table).update(record).eq('id', savedRecord.id)
        : supabaseClient.from(table).insert({ ...record, household_id: householdId, created_by: authUserId });
      query.then(({ error }) => {
        if (error) console.warn('[Umbral] Gasto fijo guardado localmente; nube no disponible:', error.message);
      }).catch((error) => console.warn('[Umbral] Gasto fijo guardado localmente; nube no disponible:', error));
      return { localOnly: false };
    }
    return { localOnly: true };
  }

  const records = readFinanceRecords(key);
  const index = financeEditing?.kind === kind ? records.findIndex((item) => item.id === financeEditing.id) : -1;
  const savedRecord = index >= 0 ? { ...records[index], ...record } : { ...record, id: createLocalId() };
  if (index >= 0) records[index] = savedRecord;
  else records.unshift(savedRecord);
  localStorage.setItem(key, JSON.stringify(records));
  financeEditing = null;

  if (!supabaseClient || !authUserId) return { localOnly: true };

  const query = index >= 0
    ? supabaseClient.from(table).update(record).eq('id', savedRecord.id)
    : supabaseClient.from(table).insert({ ...record, household_id: householdId, created_by: authUserId });
  query.then(({ error }) => {
    if (error) console.warn(`[Umbral] ${kind} guardado localmente; nube no disponible:`, error.message);
  }).catch((error) => console.warn(`[Umbral] ${kind} guardado localmente; nube no disponible:`, error));
  return { localOnly: false };
}

async function deleteFinanceEntity(kind, id) {
  if (!id || !window.confirm('¿Eliminar este movimiento?')) return;
  const table = kind === 'expense' ? 'shared_expenses' : kind === 'bill' ? 'shared_bills' : 'shared_fixed_costs';
  const key = kind === 'expense' ? localExpensesKey : kind === 'bill' ? localBillsKey : localFixedCostsKey;
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (error) return showToast('No se pudo eliminar');
  } else {
    const records = kind === 'fixed' ? getLocalFixedCosts() : readFinanceRecords(key);
    localStorage.setItem(key, JSON.stringify(records.filter((item) => item.id !== id)));
  }
  await refreshFinance();
  showToast('Movimiento eliminado');
}

async function saveSettlementPayment(payment) {
  const record = { ...payment, id: createLocalId() };
  const payments = readFinanceRecords(localSettlementsKey);
  payments.unshift(record);
  localStorage.setItem(localSettlementsKey, JSON.stringify(payments));
  financeCache.settlements = payments;
  renderFinance(financeCache);
  showToast('Pago registrado en la liquidación');
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from('shared_settlements').insert({ from_person: payment.from, to_person: payment.to, amount: payment.amount, payment_date: payment.payment_date, note: payment.note, household_id: householdId, created_by: authUserId });
    if (error) console.warn('[Umbral] Pago guardado localmente; nube no disponible:', error.message);
  }
}

async function toggleBillStatus(id) {
  const bill = financeCache.bills.find((item) => item.id === id);
  if (!bill) return;
  const status = bill.status === 'paid' ? 'pending' : 'paid';
  bill.status = status;
  const bills = readFinanceRecords(localBillsKey);
  const index = bills.findIndex((item) => item.id === id);
  if (index >= 0) { bills[index].status = status; localStorage.setItem(localBillsKey, JSON.stringify(bills)); }
  renderFinance(financeCache);
  showToast(status === 'paid' ? 'Factura marcada como pagada' : 'Factura marcada como pendiente');
  if (supabaseClient && authUserId && !String(id).startsWith('umbral-')) {
    supabaseClient.from('shared_bills').update({ status }).eq('id', id).then(({ error }) => { if (error) console.warn('[Umbral] No se sincronizó el estado de la factura:', error.message); });
  }
}

async function toggleExpenseSettled(id) {
  const expense = financeCache.expenses.find((item) => item.id === id);
  if (!expense) return;
  expense.settled = !Boolean(expense.settled);
  const expenses = readFinanceRecords(localExpensesKey);
  const index = expenses.findIndex((item) => item.id === id);
  if (index >= 0) { expenses[index].settled = expense.settled; localStorage.setItem(localExpensesKey, JSON.stringify(expenses)); }
  renderFinance(financeCache);
  showToast(expense.settled ? 'Gasto marcado como saldado' : 'Gasto marcado como pendiente');
  if (supabaseClient && authUserId && !String(id).startsWith('umbral-')) {
    supabaseClient.from('shared_expenses').update({ settled: expense.settled }).eq('id', id).then(({ error }) => { if (error) console.warn('[Umbral] No se sincronizó el estado del gasto:', error.message); });
  }
}

function financeRowFromImport(row) {
  const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]));
  const amountValue = values.amount || values.importe || values.total || values.cantidad || values.value;
  const amount = Number(String(amountValue || '').replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(amount)) return null;
  const description = String(values.description || values.descripcion || values.concept || values.concepto || values.name || 'Gasto importado');
  return { description, amount, currency: 'EUR', paid_by: String(values.paidby || values.pagopor || values.payer || 'Ines').toLowerCase().includes('matteo') ? 'Matteo' : 'Ines', category: financeCategory(values.category || values.categoria, description), expense_date: values.date || values.fecha || new Date().toISOString().slice(0, 10), source: 'tricount', settled: false };
}

async function getSupabaseSessionToken() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) return null;
  return data.session.access_token;
}

async function syncFinanceImport(kind, rows) {
  if (!supabaseClient) {
    localStorage.setItem(kind === 'tricount' ? localExpensesKey : localBillsKey, JSON.stringify([...rows, ...readFinanceLocal(kind === 'tricount' ? localExpensesKey : localBillsKey)]));
    return { ok: true, localOnly: true, imported: rows.length };
  }

  const sessionToken = await getSupabaseSessionToken();
  if (!sessionToken) {
    localStorage.setItem(kind === 'tricount' ? localExpensesKey : localBillsKey, JSON.stringify([...rows, ...readFinanceLocal(kind === 'tricount' ? localExpensesKey : localBillsKey)]));
    return { ok: true, localOnly: true, imported: rows.length };
  }

  const endpoint = kind === 'tricount' ? 'tricount-sync' : 'invoice-ingest';
  const payload = kind === 'tricount' ? { expenses: rows } : { invoices: rows };
  const response = await fetch(`${supabaseConfig.url}/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo sincronizar la importación');
  }

  return data;
}

async function saveImportedExpenses(rows) {
  const current = readFinanceRecords(localExpensesKey);
  const existingReferences = new Set(current.map((row) => row.source_reference).filter(Boolean));
  const savedRows = rows.filter((row) => !row.source_reference || !existingReferences.has(row.source_reference)).map((row) => ({ ...row, id: createLocalId() }));
  if (!savedRows.length) {
    financeCache.expenses = readFinanceRecords(localExpensesKey);
    renderFinance(financeCache);
    document.querySelector('#financeStatus').innerHTML = '<i data-lucide="check-circle-2"></i> Este Tricount ya estaba cargado.';
    lucide.createIcons();
    return { imported: 0, duplicate: true };
  }
  localStorage.setItem(localExpensesKey, JSON.stringify([...savedRows, ...current]));
  financeCache.expenses = readFinanceRecords(localExpensesKey);
  renderFinance(financeCache);
  document.querySelector('#financeStatus').innerHTML = `<i data-lucide="hard-drive"></i> ${savedRows.length} gastos nuevos guardados en este dispositivo.`;
  lucide.createIcons();

  if (supabaseClient && authUserId) {
    syncFinanceImport('tricount', rows).then((syncResult) => {
      document.querySelector('#financeStatus').innerHTML = `<i data-lucide="cloud-check"></i> ${syncResult.imported || rows.length} gastos sincronizados con Tricount.`;
      lucide.createIcons();
    }).catch((error) => console.warn('[Umbral] Importación local pendiente de nube:', error));
  }
  return { imported: savedRows.length, localOnly: true };
}

function normalizeSharedTricountData(payload) {
  const tricount = payload?.tricount || {};
  const members = Array.isArray(tricount.members) ? tricount.members : [];
  const memberNames = Object.fromEntries(members.map((member) => [member.uuid, String(member.name || 'Ines')]));
  const allowedCategories = ['Alquiler', 'Luz', 'Internet', 'Agua', 'Gas', 'Compra', 'Transporte', 'Ocio', 'Otros'];
  return (Array.isArray(tricount.expenses) ? tricount.expenses : []).map((expense, index) => {
    const payerName = memberNames[expense.payerUuid] || expense.payer || 'Ines';
    const category = String(expense.category || 'Otros');
    const amount = Number(String(expense.totalAmount || '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return {
      description: String(expense.description || `Gasto Tricount ${index + 1}`).slice(0, 160),
      amount,
      currency: 'EUR',
      paid_by: payerName.toLowerCase().includes('matteo') ? 'Matteo' : 'Ines',
      category: allowedCategories.includes(category) ? category : 'Otros',
      expense_date: String(expense.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      source: 'tricount',
      source_reference: `${payload.tricountId || 'shared'}:${expense.id || index}`
    };
  }).filter((expense) => Number.isFinite(expense.amount) && expense.amount >= 0);
}

document.querySelector('#financeShareForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const shareLink = form.shareLink.value.trim();
  const button = form.querySelector('button');
  button.disabled = true;
  button.innerHTML = '<i data-lucide="loader-circle"></i> Cargando...';
  lucide.createIcons();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(`${supabaseConfig.url}/functions/v1/tricount-share-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.anonKey, Authorization: `Bearer ${supabaseConfig.anonKey}` }, body: JSON.stringify({ shareLink }), signal: controller.signal });
    clearTimeout(timeout);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo cargar el Tricount compartido');
    const rows = normalizeSharedTricountData(result);
    if (!rows.length) throw new Error('El enlace no contiene gastos importables');
    await saveImportedExpenses(rows);
    form.reset();
    showToast(`${rows.length} gastos de Tricount añadidos`);
  } catch (error) {
    reportAppError(error);
    showToast(error.message || 'No se pudo importar el Tricount');
  } finally {
    button.disabled = false;
    button.innerHTML = '<i data-lucide="link-2"></i> Cargar Tricount';
    lucide.createIcons();
  }
});

document.querySelector('#expenseForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const expense = { description: form.get('description').trim(), amount: Number(form.get('amount')), paid_by: form.get('paidBy'), category: form.get('category'), expense_date: form.get('date'), source: 'manual', settled: Boolean(form.get('settled')) };
  try { await saveFinanceEntity('expense', expense); event.currentTarget.reset(); event.currentTarget.date.value = new Date().toISOString().slice(0, 10); setFinanceFormButton(event.currentTarget, 'Añadir gasto', 'plus'); financeCache.expenses = readFinanceRecords(localExpensesKey); renderFinance(financeCache); showToast('Gasto guardado'); } catch (error) { reportAppError(error); showToast('No se pudo guardar el gasto'); }
});

document.querySelector('#billForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const bill = { provider: form.get('provider'), description: form.get('description').trim(), amount: Number(form.get('amount')), due_date: form.get('dueDate') || null, billing_period: form.get('billingPeriod')?.trim() || null, paid_by: form.get('paidBy'), source: 'manual', status: 'pending' };
  try { await saveFinanceEntity('bill', bill); event.currentTarget.reset(); setFinanceFormButton(event.currentTarget, 'Añadir factura', 'plus'); financeCache.bills = readFinanceRecords(localBillsKey); renderFinance(financeCache); showToast('Factura guardada'); } catch (error) { reportAppError(error); showToast('No se pudo guardar la factura'); }
});

document.querySelector('#addFixedCost').addEventListener('click', () => {
  const form = document.querySelector('#fixedCostForm');
  form.hidden = !form.hidden;
  if (!form.hidden) { financeEditing = null; form.reset(); setFinanceFormButton(form, 'Guardar fijo', 'check'); }
});
document.querySelector('#fixedCostForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const fixed = { description: form.get('description').trim(), amount: Number(form.get('amount')), paid_by: form.get('paidBy'), category: form.get('category'), active: true };
  try {
    const result = await saveFinanceEntity('fixed', fixed);
    event.currentTarget.reset();
    event.currentTarget.hidden = true;
    financeCache.fixedCosts = getLocalFixedCosts();
    renderFinance(financeCache);
    showToast(result?.localOnly ? 'Guardado en este dispositivo; falta configurar la tabla compartida' : 'Gasto fijo guardado');
  } catch (error) {
    document.querySelector('#financeStatus').innerHTML = `<i data-lucide="circle-alert"></i> ${escapeHtml(error.message || 'No se pudo guardar el gasto fijo')}`;
    lucide.createIcons();
    showToast('No se pudo guardar el gasto fijo');
  }
});

document.querySelector('#fixedCostList').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-fixed-edit]');
  const remove = event.target.closest('[data-fixed-delete]');
  if (edit) startFinanceEdit('fixed', edit.dataset.fixedEdit);
  if (remove) deleteFinanceEntity('fixed', remove.dataset.fixedDelete);
});
document.querySelector('#financeCategoryBreakdown').addEventListener('click', (event) => {
  const categoryButton = event.target.closest('[data-finance-category]');
  if (!categoryButton) return;
  document.querySelector('#financeCategoryFilter').value = categoryButton.dataset.financeCategory;
  document.querySelector('[data-finance-view="expenses"]').click();
  renderFinance(financeCache);
  document.querySelector('#expenseList').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#expenseList').addEventListener('click', (event) => {
  const settled = event.target.closest('[data-expense-settled]');
  if (settled) toggleExpenseSettled(settled.dataset.expenseSettled);
});
document.querySelector('#expenseList').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-expense-edit]');
  const remove = event.target.closest('[data-expense-delete]');
  if (edit) startFinanceEdit('expense', edit.dataset.expenseEdit);
  if (remove) deleteFinanceEntity('expense', remove.dataset.expenseDelete);
});
document.querySelector('#billList').addEventListener('click', (event) => {
  const status = event.target.closest('[data-bill-status]');
  const edit = event.target.closest('[data-bill-edit]');
  const remove = event.target.closest('[data-bill-delete]');
  if (status) toggleBillStatus(status.dataset.billStatus);
  if (edit) startFinanceEdit('bill', edit.dataset.billEdit);
  if (remove) deleteFinanceEntity('bill', remove.dataset.billDelete);
});

document.querySelector('#financeImport').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file || !window.XLSX) return;
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]).map(financeRowFromImport).filter(Boolean);
    if (!rows.length) throw new Error('No hay gastos reconocibles');
    await saveImportedExpenses(rows); await refreshFinance(); showToast(`${rows.length} gastos importados`);
  } catch (error) {
    document.querySelector('#financeStatus').innerHTML = `<i data-lucide="circle-alert"></i> ${escapeHtml(error.message || 'No se pudo interpretar el archivo de Tricount')}`;
    lucide.createIcons();
    showToast('No se pudo interpretar el archivo de Tricount');
  }
  event.target.value = '';
});

document.querySelector('#exportFinance').addEventListener('click', async () => {
  const data = await getFinanceData();
  const entries = financeEntries(data);
  const settlement = calculateFinanceSettlement(entries);
  const workbook = XLSX.utils.book_new();
  const expenseRows = data.expenses.map((expense) => ({ Fecha: expense.expense_date, Descripción: expense.description, Categoría: expense.category || 'Otros', Importe: Number(expense.amount || 0), 'Pagó': expense.paid_by || 'Ines', 'Parte de cada uno': Number(expense.amount || 0) / 2, Fuente: financeSourceLabel(expense.source) }));
  const fixedRows = data.fixedCosts.map((fixed) => ({ Concepto: fixed.description, Categoría: fixed.category, 'Importe mensual': Number(fixed.amount || 0), 'Pagó': fixed.paid_by || 'Ines', Reparto: '50/50', Fuente: 'Fijo' }));
  const billRows = data.bills.map((bill) => ({ Proveedor: bill.provider, Periodo: bill.billing_period || '', Descripción: bill.description, 'Fecha de vencimiento': bill.due_date || '', Importe: Number(bill.amount || 0), 'Pagó': bill.paid_by || 'Ines', Estado: bill.status === 'paid' ? 'Pagada' : 'Pendiente', Fuente: financeSourceLabel(bill.source) }));
  const categoryRows = Object.entries(entries.reduce((result, entry) => { result[entry.category] = (result[entry.category] || 0) + Number(entry.amount || 0); return result; }, {})).map(([category, amount]) => ({ Categoría: category, Total: amount, Porcentaje: settlement.total ? amount / settlement.total : 0 }));
  const settlementRows = [{ Persona: 'Ines', 'Total pagado': settlement.paid.Ines, 'Parte justa': settlement.fairShare, Balance: settlement.balance.Ines, 'Resultado': settlement.balance.Ines >= 0 ? `Recibe ${financeMoney(settlement.balance.Ines)}` : `Paga ${financeMoney(Math.abs(settlement.balance.Ines))}` }, { Persona: 'Matteo', 'Total pagado': settlement.paid.Matteo, 'Parte justa': settlement.fairShare, Balance: settlement.balance.Matteo, 'Resultado': settlement.balance.Matteo >= 0 ? `Recibe ${financeMoney(settlement.balance.Matteo)}` : `Paga ${financeMoney(Math.abs(settlement.balance.Matteo))}` }];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseRows), 'Gastos');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(fixedRows), 'Gastos fijos');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(billRows), 'Facturas');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(categoryRows), 'Por categorías');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(settlementRows), 'Liquidación');
  XLSX.writeFile(workbook, `umbral-finanzas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Excel detallado exportado');
});

document.querySelectorAll('[data-finance-view]').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('[data-finance-view]').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.finance-view').forEach((view) => view.classList.toggle('active', view.id === `${tab.dataset.financeView}View`));
}));
['#financeSearch', '#financeCategoryFilter', '#financePeriod'].forEach((selector) => document.querySelector(selector).addEventListener('input', () => renderFinance(financeCache)));
document.querySelector('#closeFinance').addEventListener('click', () => history.back());
document.querySelector('#openSettlementForm').addEventListener('click', () => {
  const form = document.querySelector('#settlementForm');
  form.hidden = !form.hidden;
  if (!form.hidden) form.paymentDate.value = new Date().toISOString().slice(0, 10);
});
document.querySelector('#settlementForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const from = values.get('from');
  const to = values.get('to');
  const amount = Number(values.get('amount'));
  if (from === to || !Number.isFinite(amount) || amount <= 0) return showToast('Indica dos personas distintas y un importe válido');
  await saveSettlementPayment({ from, to, amount, payment_date: values.get('paymentDate'), note: String(values.get('note') || '').trim() || null });
  event.currentTarget.reset();
  event.currentTarget.hidden = true;
});
document.querySelector('#expenseForm').date.value = new Date().toISOString().slice(0, 10);

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

document.querySelectorAll('[data-action]').forEach((action) => {
  action.addEventListener('click', () => {
    const type = action.dataset.action;

    if (type === 'calendar') {
      setWorkspace('personal');
      showToast('Tu próxima cita es a las 10:30 en el estudio');
      document.querySelector('#agenda-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (type === 'news') {
      setWorkspace('personal');
      document.querySelector('#news-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (type === 'notes') {
      openNotes();
    }

    if (type === 'finance') {
      openFinance();
    }
  });
});

document.querySelector('#refreshButton').addEventListener('click', (event) => {
  const icon = event.currentTarget.querySelector('svg');
  icon.classList.add('spin');
  updateWeather().then((updated) => {
    if (updated) showToast('Tiempo actualizado hace un momento');
  });
  setTimeout(() => icon.classList.remove('spin'), 500);
});

document.querySelector('#toggleAllLightsButton').addEventListener('click', () => {
  const shouldTurnOn = smartLights.some((light) => !light.powered);
  smartLights.forEach(async (light) => {
    try {
      await callSmartHomeCommand(light.id, shouldTurnOn);
      setSmartLightState(light.id, shouldTurnOn);
    } catch (error) {
      showToast(error.message || 'No se pudo cambiar el estado de la luz');
    }
  });
  showToast(shouldTurnOn ? 'Todas las luces encendidas' : 'Todas las luces apagadas');
});

document.querySelector('#smartLightsList').addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-light-toggle]');
  if (!toggle) return;
  toggleSmartLight(toggle.dataset.lightToggle);
});

function setWorkspace(view) {
  document.querySelectorAll('[data-space]').forEach((section) => {
    section.classList.toggle('is-hidden', section.dataset.space !== view);
  });
  document.querySelectorAll('[data-space-target]').forEach((tab) => {
    const selected = tab.dataset.spaceTarget === view;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.nav-item[data-view-target]').forEach((item) => {
    item.classList.toggle('active', item.dataset.viewTarget === view);
  });
}

document.querySelectorAll('[data-space-target]').forEach((tab) => {
  tab.addEventListener('click', () => setWorkspace(tab.dataset.spaceTarget));
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    if (item.dataset.viewTarget) {
      setWorkspace(item.dataset.viewTarget);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (item.querySelector('span')?.textContent === 'Ajustes') {
      document.querySelector('#accountModal').classList.add('visible');
      lucide.createIcons();
      return;
    }
    const sectionName = item.querySelector('span').textContent;
    showToast(`${sectionName}: próximamente`);
  });
});

window.addEventListener('popstate', () => {
  notesModal.classList.remove('visible');
  calendarModal.classList.remove('visible');
  weatherModal.classList.remove('visible');
  financeModal.classList.remove('visible');
  if (history.state?.page === 'notes') openNotes();
  if (history.state?.page === 'calendar') openCalendar();
  if (history.state?.page === 'weather') openWeather();
  if (history.state?.page === 'finance') openFinance();
});

document.querySelector('.brand').addEventListener('click', (event) => {
  if (history.state?.page) {
    event.preventDefault();
    history.back();
  }
});

setWorkspace('home');
updateWeather();
connectNotes();
loadNews();
renderSmartLights();
updateLightStatusText();
updateConnectionState();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
