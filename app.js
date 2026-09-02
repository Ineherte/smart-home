lucide.createIcons();

const toast = document.querySelector('.toast');
const toastMessage = toast.querySelector('span');
const identityKey = 'umbral-user';
const requestedUser = new URLSearchParams(window.location.search).get('usuario');
let currentUser = 'Ines';
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

const notesModal = document.querySelector('#notesModal');
const sharedNotesKey = 'umbral-shared-notes';
const privateNotesKey = () => `umbral-private-notes-${currentUser.toLowerCase()}`;

function readNotes(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function renderNoteList(elementId, notes, emptyText) {
  const list = document.querySelector(`#${elementId}`);
  list.innerHTML = notes.length ? notes.map((note, index) => `<div class="note-row"><span>${note}</span><button type="button" class="delete-note" data-note-list="${elementId}" data-note-index="${index}" aria-label="Eliminar nota" title="Eliminar nota"><i data-lucide="trash-2"></i></button></div>`).join('') : `<p class="empty-note">${emptyText}</p>`;
}

function renderNotes() {
  const sharedNotes = readNotes(sharedNotesKey);
  const privateNotes = readNotes(privateNotesKey());
  renderNoteList('sharedNotes', sharedNotes, 'No hay notas compartidas.');
  renderNoteList('privateNotes', privateNotes, 'Tus notas privadas aparecerán aquí.');
  const totalNotes = sharedNotes.length + privateNotes.length;
  document.querySelector('#notesCount').textContent = `${totalNotes} ${totalNotes === 1 ? 'nota' : 'notas'}`;
  document.querySelector('#notesPreview').textContent = sharedNotes[0] || 'Nada pendiente';
  lucide.createIcons();
}

function openNotes() {
  renderNotes();
  notesModal.classList.add('visible');
}

document.querySelector('[data-action="notes"]').addEventListener('click', openNotes);
document.querySelector('[data-action="notes"]').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') openNotes();
});
document.querySelector('#closeNotes').addEventListener('click', () => notesModal.classList.remove('visible'));
document.querySelectorAll('.note-form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = form.querySelector('input');
    const key = form.dataset.noteType === 'shared' ? sharedNotesKey : privateNotesKey();
    const notes = readNotes(key);
    notes.unshift(input.value.trim());
    localStorage.setItem(key, JSON.stringify(notes));
    input.value = '';
    renderNotes();
    showToast(form.dataset.noteType === 'shared' ? 'Nota compartida añadida' : 'Nota privada guardada');
  });
});
document.querySelector('#notesModal').addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.delete-note');
  if (!deleteButton) return;
  const key = deleteButton.dataset.noteList === 'sharedNotes' ? sharedNotesKey : privateNotesKey();
  const notes = readNotes(key);
  notes.splice(Number(deleteButton.dataset.noteIndex), 1);
  localStorage.setItem(key, JSON.stringify(notes));
  renderNotes();
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
    showToast(`${item.querySelector('span').textContent}: vista en preparación`);
  });
});

updateWeather();
