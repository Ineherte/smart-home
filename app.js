lucide.createIcons();

const toast = document.querySelector('.toast');
const toastMessage = toast.querySelector('span');
const identityKey = 'umbral-user';
const requestedUser = new URLSearchParams(window.location.search).get('usuario');
let currentUser = 'Ines';
const notesModal = document.querySelector('#notesModal');
const urgentModal = document.querySelector('#urgentModal');
const localSharedNotesKey = 'umbral-shared-notes';
const localPrivateNotesKey = () => `umbral-private-notes-${currentUser.toLowerCase()}`;
const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseReady = window.supabase && supabaseConfig.url && !supabaseConfig.url.includes('TU-PROYECTO') && supabaseConfig.anonKey && !supabaseConfig.anonKey.includes('TU_CLAVE');
const supabaseClient = supabaseReady ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;
let authUserId;
const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=45.0703&longitude=7.6869&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome';
let toastTimer;
let lightsOn = true;

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
if (requestedUser) {
  setUser(requestedUser);
} else if (savedUser) {
  setUser(savedUser);
} else {
  document.querySelector('#identityModal').classList.add('visible');
}

document.querySelectorAll('[data-user]').forEach((option) => {
  option.addEventListener('click', () => setUser(option.dataset.user));
});

document.querySelector('#userAvatar').addEventListener('click', () => {
  document.querySelector('#identityModal').classList.add('visible');
});

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
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = form.querySelector('input');
    const content = input.value.trim();
    const scope = form.dataset.noteType;
    const priority = form.querySelector('[name="urgent"]').checked ? 'urgent' : 'normal';
    if (supabaseClient && authUserId) {
      const { error } = await supabaseClient.from('notes').insert({ content, scope, priority, owner_id: authUserId });
      if (error) return showToast('No se pudo guardar la nota');
    } else {
      const key = scope === 'shared' ? localSharedNotesKey : localPrivateNotesKey();
      const notes = readNotes(key);
      notes.unshift(content);
      localStorage.setItem(key, JSON.stringify(notes));
    }
    input.value = '';
    form.querySelector('[name="urgent"]').checked = false;
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
    const { error } = await supabaseClient.from('events').insert({ ...eventData, owner_id: authUserId });
    if (error) return showToast('No se pudo guardar el evento');
  } else {
    const events = readEvents();
    events.push({ ...eventData, id: crypto.randomUUID() });
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
  const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Umbral Smart Home//ES', 'BEGIN:VEVENT', `UID:${event.id || crypto.randomUUID()}@umbral`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}Z`, `DTEND:${icsDate(end)}Z`, `SUMMARY:${escapeICS(event.title)}`, event.location ? `LOCATION:${escapeICS(event.location)}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
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
    const { error } = await supabaseClient.from('shared_drawing').upsert({ id: 1, strokes: drawingStrokes, updated_by: authUserId, updated_at: new Date().toISOString() });
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
    status.innerHTML = '<i data-lucide="hard-drive"></i> Modo local: configura Supabase para sincronizar';
    lucide.createIcons();
    return;
  }
  const { data, error } = await supabaseClient.auth.signInAnonymously();
  if (error) {
    status.innerHTML = '<i data-lucide="circle-alert"></i> No se pudo conectar con la nube';
    lucide.createIcons();
    return;
  }
  authUserId = data.user.id;
  await supabaseClient.auth.updateUser({ data: { name: currentUser } });
  await supabaseClient.auth.refreshSession();
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

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

document.querySelectorAll('[data-action]').forEach((action) => {
  action.addEventListener('click', () => {
    const type = action.dataset.action;

    if (type === 'lights') {
      lightsOn = !lightsOn;
      document.querySelector('#lightsStatus').textContent = lightsOn ? '2 encendidas · salón y cocina' : 'Todas apagadas';
      showToast(lightsOn ? 'Luces del salón y la cocina encendidas' : 'Todas las luces están apagadas');
    }

    if (type === 'calendar') {
      showToast('Tu próxima cita es a las 10:30 en el estudio');
      document.querySelector('#agenda-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (type === 'tv') {
      document.querySelector('#tvStatus').textContent = 'Enviando resumen a la TV...';
      showToast('Resumen enviado a la TV del salón');
      setTimeout(() => { document.querySelector('#tvStatus').textContent = 'Resumen listo en la TV del salón'; }, 850);
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

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    const sectionName = item.querySelector('span').textContent;
    if (sectionName === 'Casa' || sectionName === 'Ajustes') {
      showToast(`${sectionName}: vista en preparación`);
      return;
    }
    if (item.dataset.nav === 'agenda') {
      openCalendar();
      return;
    }
    showToast(`${sectionName}: vista en preparación`);
  });
});

window.addEventListener('popstate', () => {
  notesModal.classList.remove('visible');
  calendarModal.classList.remove('visible');
  if (history.state?.page === 'notes') openNotes();
  if (history.state?.page === 'calendar') openCalendar();
});

document.querySelector('.brand').addEventListener('click', (event) => {
  if (history.state?.page) {
    event.preventDefault();
    history.back();
  }
});

updateWeather();
connectNotes();
