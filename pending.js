// Pendientes: tareas de casa y notas en una sola lista, ordenada por lo que corre más prisa.
// - Tareas (tasks.js): cosas de la casa con fecha, que pueden repetirse y tienen responsable.
// - Notas: recordatorios y mensajes sin fecha, para los dos o solo para ti; pueden ser urgentes.
// Usa getNotes, readNotes, supabaseClient, authUserId, householdId y currentUser de app.js.
let householdNotes = [];
let pendingFilter = 'all';

const PENDING_PLACEHOLDERS = {
  task: 'Sacar la basura, limpiar el baño…',
  note: 'Llamar al casero, la clave del wifi es…'
};

const localNotesKey = (scope) => (scope === 'shared' ? localSharedNotesKey : localPrivateNotesKey());

// Las notas locales antiguas no tenían id; se les asigna uno para poder editarlas.
function readLocalNotes(scope) {
  const key = localNotesKey(scope);
  const notes = readNotes(key);
  if (notes.some((note) => !note.id)) {
    notes.forEach((note) => { note.id ||= createLocalId(); });
    localStorage.setItem(key, JSON.stringify(notes));
  }
  return notes.map((note) => ({ ...note, scope }));
}

async function loadNotes() {
  if (supabaseClient && authUserId) {
    const notes = await getNotes();
    householdNotes = [...notes.shared, ...notes.private];
  } else {
    householdNotes = [...readLocalNotes('shared'), ...readLocalNotes('private')];
  }
}

async function renderNotes() {
  try {
    await loadNotes();
  } catch {
    showToast('No se pudieron cargar las notas');
  }
  const open = householdNotes.filter((note) => !note.completed);
  const urgent = open.filter((note) => note.priority === 'urgent');
  document.querySelector('#notesCount').textContent = open.length ? `${open.length} pendiente${open.length === 1 ? '' : 's'}` : 'Todo hecho';
  document.querySelector('#notesPreview').textContent = (urgent[0] || open[0])?.content || 'No hay nada pendiente';
  renderAttention({ urgentCount: urgent.length });
  showUrgentNotes(householdNotes);
  renderPending();
}

async function addNote({ content, scope, priority }) {
  if (supabaseClient && authUserId) {
    if (!householdReady()) return false;
    const { error } = await supabaseClient.from('notes').insert({ content, scope, priority, owner_id: authUserId, household_id: householdId });
    if (error) {
      showSupabaseError('No se pudo guardar la nota', error);
      return false;
    }
    if (scope === 'shared') notifyHousehold(priority === 'urgent' ? `Nota urgente de ${currentUser}` : `${currentUser} dejó una nota`, content, { open: 'notes', tag: 'notes' });
  } else {
    const notes = readLocalNotes(scope);
    notes.unshift({ id: createLocalId(), content, priority, completed: false, created_at: new Date().toISOString(), scope });
    localStorage.setItem(localNotesKey(scope), JSON.stringify(notes));
  }
  showToast(scope === 'shared' ? 'Nota guardada para los dos' : 'Nota privada guardada');
  await renderNotes();
  return true;
}

async function toggleNote(id) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note) return;
  const completed = !note.completed;
  const row = document.querySelector(`[data-note-row="${CSS.escape(id)}"]`);
  if (completed && row) {
    row.classList.add('is-completing');
    await new Promise((resolve) => setTimeout(resolve, 380));
  }
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from('notes').update({ completed }).eq('id', id);
    if (error) return showSupabaseError('No se pudo actualizar la nota', error);
    if (completed && note.scope === 'shared') notifyHousehold(`${currentUser} completó una nota`, note.content, { open: 'notes', tag: 'notes' });
  } else {
    const notes = readLocalNotes(note.scope).map((entry) => (entry.id === id ? { ...entry, completed } : entry));
    localStorage.setItem(localNotesKey(note.scope), JSON.stringify(notes));
  }
  await renderNotes();
}

async function deleteNote(id) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note || !window.confirm('¿Eliminar esta nota?')) return;
  if (supabaseClient && authUserId) {
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (error) return showSupabaseError('No se pudo eliminar la nota', error);
  } else {
    localStorage.setItem(localNotesKey(note.scope), JSON.stringify(readLocalNotes(note.scope).filter((entry) => entry.id !== id)));
  }
  await renderNotes();
}

function timeAgo(iso) {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

const noteAuthor = (note) => (!note.owner_id || note.owner_id === authUserId ? currentUser : otherPerson(currentUser));

function noteRow(note) {
  const urgent = note.priority === 'urgent' && !note.completed;
  const isPrivate = note.scope === 'private';
  const meta = [urgent ? 'Urgente' : '', isPrivate ? 'Solo para ti' : `Nota de ${noteAuthor(note) === currentUser ? 'ti' : noteAuthor(note)}`, timeAgo(note.created_at)].filter(Boolean).join(' · ');
  return `<div class="list-item note-item${urgent ? ' is-urgent' : ''}${isPrivate ? ' is-private' : ''}${note.completed ? ' is-done' : ''}" data-note-row="${escapeHtml(note.id)}">
    <button type="button" class="check-button" data-note-done="${escapeHtml(note.id)}" aria-label="${note.completed ? 'Reabrir' : 'Marcar como hecha'}: ${escapeHtml(note.content)}"><i data-lucide="${note.completed ? 'rotate-ccw' : 'check'}"></i></button>
    <span class="note-mark"><i data-lucide="${isPrivate ? 'lock' : urgent ? 'siren' : 'sticky-note'}"></i></span>
    <span class="list-item-copy"><strong>${escapeHtml(note.content)}</strong><small>${escapeHtml(meta)}</small></span>
    <button type="button" class="icon-ghost" data-note-delete="${escapeHtml(note.id)}" aria-label="Eliminar nota" title="Eliminar"><i data-lucide="trash-2"></i></button>
  </div>`;
}

const pendingGroup = (key, label, icon, rows) => `<section class="list-group is-${key}"><p class="list-group-title"><i data-lucide="${icon}"></i>${label}<span>${rows.length}</span></p>${rows.join('')}</section>`;

function renderPending() {
  const list = document.querySelector('#pendingList');
  if (!list) return;
  const today = dateToISO(new Date());
  const tasks = pendingFilter === 'notes' ? [] : householdTasks
    .filter((task) => pendingFilter !== 'mine' || isMine(task))
    .sort((first, second) => first.due_date.localeCompare(second.due_date));
  const notes = pendingFilter === 'tasks' ? [] : householdNotes.filter((note) => !note.completed);
  const done = pendingFilter === 'tasks' ? [] : householdNotes.filter((note) => note.completed).slice(0, 8);
  const urgentNotes = notes.filter((note) => note.priority === 'urgent');

  const groups = [
    ['urgent', 'Corre prisa', 'siren', [...urgentNotes.map(noteRow), ...tasks.filter((task) => task.due_date < today).map((task) => taskRow(task, 'overdue'))]],
    ['today', 'Hoy', 'sun', tasks.filter((task) => task.due_date === today).map((task) => taskRow(task, 'today'))],
    ['week', 'Esta semana', 'calendar-range', tasks.filter((task) => task.due_date > today && daysBetween(today, task.due_date) < 7).map((task) => taskRow(task, 'week'))],
    ['notes', 'Notas', 'sticky-note', notes.filter((note) => note.priority !== 'urgent').map(noteRow)],
    ['later', 'Más adelante', 'calendar-clock', tasks.filter((task) => daysBetween(today, task.due_date) >= 7).map((task) => taskRow(task, 'later'))]
  ].filter(([, , , rows]) => rows.length);

  const emptyCopy = {
    all: ['Todo hecho', 'No queda nada pendiente. Disfrutad de la casa.'],
    tasks: ['Sin tareas de casa', 'Añade lo que hay que hacer y Umbral os recordará a quién le toca.'],
    notes: ['Sin notas', 'Deja aquí recordatorios o mensajes para los dos.'],
    mine: ['Nada para ti', 'Todo lo tuyo está hecho.']
  }[pendingFilter];
  list.innerHTML = (groups.length
    ? groups.map(([key, label, icon, rows]) => pendingGroup(key, label, icon, rows)).join('')
    : `<div class="empty-state"><span class="empty-state-icon"><i data-lucide="party-popper"></i></span><strong>${emptyCopy[0]}</strong><span>${emptyCopy[1]}</span></div>`)
    + (done.length ? `<details class="done-group"><summary><i data-lucide="check-check"></i>Hecho hace poco<span>${done.length}</span></summary>${done.map(noteRow).join('')}</details>` : '');

  // Lo que pide atención ahora: tareas tuyas para hoy o atrasadas y notas urgentes.
  const mineNow = householdTasks.filter((task) => isMine(task) && task.due_date <= today).length + householdNotes.filter((note) => !note.completed && note.priority === 'urgent').length;
  setNavBadge('tareas', mineNow);
  lucide.createIcons();
}

function setPendingKind(kind) {
  const form = document.querySelector('#pendingForm');
  form.dataset.kind = kind;
  form.querySelectorAll('[data-kind]').forEach((button) => button.setAttribute('aria-checked', String(button.dataset.kind === kind)));
  form.querySelectorAll('[data-options]').forEach((options) => { options.hidden = options.dataset.options !== kind; });
  form.title.placeholder = PENDING_PLACEHOLDERS[kind];
  document.querySelector('#taskPresetsBlock').hidden = kind !== 'task' || !document.querySelector('#taskPresets').children.length;
}

function setPendingFilter(filter) {
  pendingFilter = filter;
  document.querySelectorAll('[data-pending-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.pendingFilter === filter)));
  renderPending();
}

// Abre Casa → Pendientes; con kind, deja el campo listo para escribir.
function openPending({ filter, kind } = {}) {
  showView('pendientes');
  if (filter) setPendingFilter(filter);
  if (kind) {
    setPendingKind(kind);
    const input = document.querySelector('#pendingForm [name="title"]');
    setTimeout(() => input.focus({ preventScroll: true }), 300);
  }
}

function resetPendingForm(form) {
  form.title.value = '';
  form.recurrence.value = 'none';
  form.assignee.value = 'both';
  form.dueDate.value = dateToISO(new Date());
  form.private.checked = false;
  form.urgent.checked = false;
}

document.querySelector('#pendingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const text = form.title.value.trim();
  if (!text) return form.title.focus();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const saved = form.dataset.kind === 'note'
    ? await addNote({ content: text, scope: form.private.checked ? 'private' : 'shared', priority: form.urgent.checked ? 'urgent' : 'normal' })
    : await createTask({ title: text, recurrence: form.recurrence.value, dueDate: form.dueDate.value || dateToISO(new Date()), assignee: form.assignee.value });
  button.disabled = false;
  if (saved) resetPendingForm(form);
});

document.querySelector('#tasksView').addEventListener('click', (event) => {
  const kind = event.target.closest('#pendingForm [data-kind]');
  if (kind) return setPendingKind(kind.dataset.kind);
  const filter = event.target.closest('[data-pending-filter]');
  if (filter) return setPendingFilter(filter.dataset.pendingFilter);
  const done = event.target.closest('[data-note-done]');
  if (done) return toggleNote(done.dataset.noteDone);
  const remove = event.target.closest('[data-note-delete]');
  if (remove) return deleteNote(remove.dataset.noteDelete);
});

document.addEventListener('DOMContentLoaded', () => { document.querySelector('#pendingForm').dueDate.value = dateToISO(new Date()); });
