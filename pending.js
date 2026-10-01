// Pendientes: tareas de casa y notas, pensadas para ver de un vistazo qué es lo importante.
// - Arriba, «Tu día»: progreso de hoy, lo que queda y la carga de la semana.
// - Añadir rápido escribiendo normal: «basura mañana @matteo cada semana !».
// - Cuatro vistas: Hoy (por prioridad), Semana (día a día), Personas (quién hace qué) y Notas.
// - Cada tarea o nota se abre en una ficha con sus detalles, historial y acciones.
// Usa getNotes, readNotes, supabaseClient, authUserId, householdId y currentUser de app.js,
// y los datos y acciones de tareas de tasks.js.
let householdNotes = [];
let todoView = 'today';
let onlyMine = false;
let quickType = null;
let openItem = null;
let notesV2Available = true;

try {
  todoView = localStorage.getItem('umbral-todo-view') || 'today';
  onlyMine = localStorage.getItem('umbral-only-mine') === 'true';
} catch {}

const localNotesKey = (scope) => (scope === 'shared' ? localSharedNotesKey : localPrivateNotesKey());
const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const personName = (assignee) => (assignee === 'both' ? 'Los dos' : assignee === currentUser ? 'Tú' : assignee);

// ---------- Notas: datos ----------

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

const NOTE_V2_FIELDS = ['pinned', 'details'];
const stripNoteV2 = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !NOTE_V2_FIELDS.includes(key)));
const isMissingNoteColumn = (error) => /column|schema cache/i.test(error?.message || '') && NOTE_V2_FIELDS.some((field) => (error.message || '').includes(field));

async function notesQuery(run, row) {
  const attempt = async (data) => {
    const { error } = await run(data);
    if (error) throw error;
  };
  if (!notesV2Available) return attempt(stripNoteV2(row));
  try {
    await attempt(row);
  } catch (error) {
    if (!isMissingNoteColumn(error)) throw error;
    notesV2Available = false;
    showToast('Falta ejecutar tasks-notes-v2.sql en Supabase: detalles y fijadas no se guardarán');
    await attempt(stripNoteV2(row));
  }
}

async function addNote({ content, scope = 'shared', priority = 'normal', details = '', pinned = false }) {
  const row = { content: content.trim().slice(0, 120), scope, priority, details: details.trim().slice(0, 1000) || null, pinned: Boolean(pinned) };
  try {
    if (supabaseClient && authUserId) {
      if (!householdReady()) return false;
      await notesQuery((data) => supabaseClient.from('notes').insert({ ...data, owner_id: authUserId, household_id: householdId }), row);
      if (scope === 'shared') notifyHousehold(priority === 'urgent' ? `Nota urgente de ${currentUser}` : `${currentUser} dejó una nota`, row.content, { open: 'notes', tag: 'notes' });
    } else {
      const notes = readLocalNotes(scope);
      notes.unshift({ id: createLocalId(), ...row, completed: false, created_at: new Date().toISOString() });
      localStorage.setItem(localNotesKey(scope), JSON.stringify(notes));
    }
  } catch (error) {
    showSupabaseError('No se pudo guardar la nota', error);
    return false;
  }
  showToast(scope === 'shared' ? 'Nota guardada para los dos' : 'Nota privada guardada');
  await renderNotes();
  return true;
}

async function updateNote(id, changes) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note) return false;
  try {
    if (supabaseClient && authUserId) {
      await notesQuery((data) => supabaseClient.from('notes').update(data).eq('id', id), changes);
    } else {
      // Cambiar de compartida a privada mueve la nota de lista local.
      const target = changes.scope || note.scope;
      const updated = { ...note, ...changes, scope: target };
      localStorage.setItem(localNotesKey(note.scope), JSON.stringify(readLocalNotes(note.scope).filter((entry) => entry.id !== id)));
      localStorage.setItem(localNotesKey(target), JSON.stringify([updated, ...readLocalNotes(target)]));
    }
  } catch (error) {
    showSupabaseError('No se pudo actualizar la nota', error);
    return false;
  }
  await renderNotes();
  return true;
}

async function toggleNote(id) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note) return;
  const completed = !note.completed;
  if (completed) {
    document.querySelectorAll(`[data-note-row="${CSS.escape(id)}"]`).forEach((row) => row.classList.add('is-completing'));
    await new Promise((resolve) => setTimeout(resolve, 380));
  }
  const saved = await updateNote(id, { completed });
  if (saved && completed && note.scope === 'shared') notifyHousehold(`${currentUser} completó una nota`, note.content, { open: 'notes', tag: 'notes' });
}

async function deleteNote(id) {
  const note = householdNotes.find((entry) => entry.id === id);
  if (!note || !window.confirm('¿Eliminar esta nota?')) return false;
  try {
    if (supabaseClient && authUserId) {
      const { error } = await supabaseClient.from('notes').delete().eq('id', id);
      if (error) throw error;
    } else {
      localStorage.setItem(localNotesKey(note.scope), JSON.stringify(readLocalNotes(note.scope).filter((entry) => entry.id !== id)));
    }
  } catch (error) {
    showSupabaseError('No se pudo eliminar la nota', error);
    return false;
  }
  await renderNotes();
  return true;
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

// ---------- Añadir rápido en lenguaje natural ----------

function nextWeekday(target) {
  const today = new Date();
  const ahead = (target - today.getDay() + 7) % 7 || 7;
  return addDaysToISO(todayISO(), ahead);
}

// Entiende fechas, repetición, persona, prioridad y duración dentro del texto;
// lo que sobra es el título.
function parseQuickAdd(text) {
  const result = { type: 'task', title: '', dueDate: null, recurrence: 'none', assignee: null, priority: 'normal', minutes: null, scope: 'shared' };
  let rest = ` ${text} `;
  const take = (pattern, apply) => {
    rest = rest.replace(pattern, (...match) => {
      apply(match);
      return ' ';
    });
  };
  const word = (body) => new RegExp(`(^|\\s)(${body})(?=[\\s,.!]|$)`, 'i');

  take(/(^|\s)(nota|apunte)\s*:\s*/i, () => { result.type = 'note'; });
  take(/(^|\s)#nota(?=\s|$)/i, () => { result.type = 'note'; });
  take(word('solo para m[ií]|solo yo|privad[oa]'), () => { result.scope = 'private'; result.type = 'note'; });
  take(word('!{1,3}|urgente|importante|prioridad alta|cuanto antes'), () => { result.priority = 'high'; });
  take(/!+(?=\s)/, () => { result.priority = 'high'; });
  take(word('sin prisa|cuando se pueda|baja prioridad|cuando pueda'), () => { result.priority = 'low'; });

  take(word('@?por turnos|@?turnos|turn[aá]ndonos'), () => { result.assignee = 'rotate'; });
  take(word('@los dos|@ambos|los dos|entre los dos'), () => { result.assignee = 'both'; });
  householdPeople.forEach((person) => take(new RegExp(`(^|\\s)@${person}(?=\\s|$)`, 'i'), () => { result.assignee = person; }));
  take(/(^|\s)@(yo|m[ií])(?=\s|$)/i, () => { result.assignee = currentUser; });

  take(word('cada (2|dos) semanas|quincenal(mente)?'), () => { result.recurrence = 'biweekly'; });
  take(word('cada d[ií]a|a diario|diariamente|todos los d[ií]as'), () => { result.recurrence = 'daily'; });
  take(word('cada semana|semanal(mente)?|todas las semanas'), () => { result.recurrence = 'weekly'; });
  take(word('cada mes|mensual(mente)?|todos los meses'), () => { result.recurrence = 'monthly'; });
  take(word('cada a[ñn]o|anual(mente)?'), () => { result.recurrence = 'yearly'; });
  take(word('cada (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)'), (match) => {
    result.recurrence = 'weekly';
    result.dueDate = nextWeekday(WEEKDAYS[normalizeText(match[3])]);
  });

  take(word('pasado ma[ñn]ana'), () => { result.dueDate = addDaysToISO(todayISO(), 2); });
  take(word('ma[ñn]ana'), () => { result.dueDate = addDaysToISO(todayISO(), 1); });
  take(word('hoy|esta (tarde|noche)'), () => { result.dueDate = todayISO(); });
  take(word('(este )?fin de semana|el finde|este finde'), () => { result.dueDate = new Date().getDay() === 6 || new Date().getDay() === 0 ? todayISO() : nextWeekday(6); });
  take(word('(la )?pr[oó]xima semana|la semana que viene'), () => { result.dueDate = nextWeekday(1); });
  take(word('(el )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)'), (match) => { result.dueDate = nextWeekday(WEEKDAYS[normalizeText(match[4])]); });
  take(new RegExp(`(^|\\s)(el )?(\\d{1,2}) de (${MONTHS.join('|')})(?=\\s|$)`, 'i'), (match) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), MONTHS.indexOf(match[4].toLowerCase()), Number(match[3]), 12);
    if (dateToISO(date) < todayISO()) date.setFullYear(date.getFullYear() + 1);
    result.dueDate = dateToISO(date);
  });
  take(/(^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/, (match) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), Number(match[3]) - 1, Number(match[2]), 12);
    if (dateToISO(date) < todayISO()) date.setFullYear(date.getFullYear() + 1);
    result.dueDate = dateToISO(date);
  });

  take(word('media hora'), () => { result.minutes = 30; });
  take(/(^|\s)(\d{1,3})\s*(min|mins|minutos)(?=\s|$)/i, (match) => { result.minutes = Number(match[2]); });
  take(/(^|\s)(\d(?:[.,]5)?)\s*(h|hora|horas)(?=\s|$)/i, (match) => { result.minutes = Math.round(Number(match[2].replace(',', '.')) * 60); });

  result.title = capitalizeFirst(rest.replace(/\s+/g, ' ').trim());
  return result;
}

function renderQuickPreview() {
  const form = document.querySelector('#pendingForm');
  const preview = document.querySelector('#quickPreview');
  const text = form.title.value.trim();
  form.classList.toggle('has-text', Boolean(text));
  if (!text && !quickType) {
    preview.innerHTML = '<span class="quick-hint"><i data-lucide="sparkles"></i>Escribe normal: «mañana», «cada semana», «@matteo», «!», «30 min»… o «nota: …»</span>';
    lucide.createIcons();
    return;
  }
  const parsed = parseQuickAdd(text);
  const type = quickType || parsed.type;
  const chip = (icon, label, extra = '') => `<span class="quick-chip ${extra}"><i data-lucide="${icon}"></i>${escapeHtml(label)}</span>`;
  const chips = [`<button type="button" class="quick-chip is-type" data-quick-type="${type === 'task' ? 'note' : 'task'}" title="Cambiar a ${type === 'task' ? 'nota' : 'tarea'}"><i data-lucide="${type === 'task' ? 'circle-check-big' : 'sticky-note'}"></i>${type === 'task' ? 'Tarea' : 'Nota'}<i data-lucide="repeat-2" class="quick-swap"></i></button>`];
  if (type === 'task') {
    chips.push(chip('calendar', parsed.dueDate ? dueLabel(parsed.dueDate) : 'Hoy', parsed.dueDate ? '' : 'is-default'));
    chips.push(chip('user-round', parsed.assignee === 'rotate' ? 'Por turnos' : personName(parsed.assignee || 'both'), parsed.assignee ? '' : 'is-default'));
    if (parsed.recurrence !== 'none') chips.push(chip('repeat', RECURRENCE_LABELS[parsed.recurrence]));
    if (parsed.priority !== 'normal') chips.push(chip(PRIORITIES[parsed.priority].icon, PRIORITIES[parsed.priority].short, `is-${parsed.priority}`));
    if (parsed.minutes) chips.push(chip('timer', minutesLabel(parsed.minutes)));
  } else {
    chips.push(chip(parsed.scope === 'private' ? 'lock' : 'users', parsed.scope === 'private' ? 'Solo para ti' : 'Para los dos'));
    if (parsed.priority === 'high') chips.push(chip('siren', 'Urgente', 'is-high'));
  }
  chips.push('<button type="button" class="quick-chip is-more" data-quick-more><i data-lucide="sliders-horizontal"></i>Más opciones</button>');
  preview.innerHTML = chips.join('');
  lucide.createIcons();
}

async function submitQuickAdd() {
  const form = document.querySelector('#pendingForm');
  const text = form.title.value.trim();
  if (!text) return form.title.focus();
  const parsed = parseQuickAdd(text);
  const type = quickType || parsed.type;
  if (!parsed.title) return openEditor(type, parsed);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const saved = type === 'note'
    ? await addNote({ content: parsed.title, scope: parsed.scope, priority: parsed.priority === 'high' ? 'urgent' : 'normal' })
    : await createTask({ title: parsed.title, recurrence: parsed.recurrence, dueDate: parsed.dueDate || todayISO(), assignee: parsed.assignee || 'both', priority: parsed.priority, minutes: parsed.minutes });
  button.disabled = false;
  if (saved) {
    form.title.value = '';
    quickType = null;
    renderQuickPreview();
  }
}

// ---------- Filas y tarjetas ----------

const priorityFlag = (task) => (taskPriority(task) === 'high' ? '<span class="prio-flag" title="Importante"><i data-lucide="flag"></i></span>' : '');

function personChip(assignee, rotate) {
  if (assignee === 'both') return '<span class="person-chip is-both" title="Los dos"><i data-lucide="users"></i></span>';
  return `<span class="person-chip ${assignee === currentUser ? 'is-me' : ''}${rotate ? ' is-rotate' : ''}" title="${escapeHtml(personName(assignee))}${rotate ? ' · por turnos' : ''}">${escapeHtml(initialsOf(assignee))}</span>`;
}

// date: la fecha de esta aparición (en la semana, una tarea repetida sale varias veces;
// solo la primera se puede marcar como hecha).
function taskRow(task, { date = task.due_date, showDate = true } = {}) {
  const today = todayISO();
  const isNext = date === task.due_date;
  const state = date < today ? 'is-overdue' : date === today ? 'is-today' : 'is-later';
  const meta = [
    showDate ? dueLabel(date) : '',
    task.recurrence !== 'none' ? RECURRENCE_LABELS[task.recurrence] : '',
    task.rotate ? 'por turnos' : '',
    minutesLabel(task.minutes)
  ].filter(Boolean).join(' · ');
  return `<div class="todo-row ${state} prio-${taskPriority(task)}${isNext ? '' : ' is-future'}" data-task-row="${escapeHtml(task.id)}" data-open-task="${escapeHtml(task.id)}" tabindex="0" role="button" aria-label="${escapeHtml(task.title)}">
    ${isNext ? `<button type="button" class="todo-check" data-task-done="${escapeHtml(task.id)}" aria-label="Marcar «${escapeHtml(task.title)}» como hecha"><i data-lucide="check"></i></button>` : '<span class="todo-check is-ghost" aria-hidden="true"><i data-lucide="repeat"></i></span>'}
    <span class="todo-icon"><i data-lucide="${taskIcon(task.title)}"></i></span>
    <span class="todo-copy"><strong>${escapeHtml(task.title)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</span>
    <span class="todo-side">${priorityFlag(task)}${personChip(task.assignee, task.rotate)}</span>
  </div>`;
}

function noteRow(note) {
  const urgent = note.priority === 'urgent' && !note.completed;
  const meta = [urgent ? 'Urgente' : '', note.scope === 'private' ? 'Solo para ti' : `Nota de ${noteAuthor(note) === currentUser ? 'ti' : noteAuthor(note)}`, timeAgo(note.created_at)].filter(Boolean).join(' · ');
  return `<div class="todo-row is-note${urgent ? ' is-urgent' : ''}${note.completed ? ' is-done' : ''}" data-note-row="${escapeHtml(note.id)}" data-open-note="${escapeHtml(note.id)}" tabindex="0" role="button" aria-label="${escapeHtml(note.content)}">
    <button type="button" class="todo-check" data-note-done="${escapeHtml(note.id)}" aria-label="${note.completed ? 'Reabrir' : 'Marcar como hecha'}"><i data-lucide="${note.completed ? 'rotate-ccw' : 'check'}"></i></button>
    <span class="todo-icon is-note"><i data-lucide="${note.scope === 'private' ? 'lock' : urgent ? 'siren' : 'sticky-note'}"></i></span>
    <span class="todo-copy"><strong>${escapeHtml(note.content)}</strong><small>${escapeHtml(meta)}</small></span>
    ${note.pinned ? '<span class="todo-side"><span class="pin-mark" title="Fijada"><i data-lucide="pin"></i></span></span>' : ''}
  </div>`;
}

function noteCard(note) {
  const urgent = note.priority === 'urgent';
  return `<article class="note-card${urgent ? ' is-urgent' : ''}${note.scope === 'private' ? ' is-private' : ''}${note.pinned ? ' is-pinned' : ''}" data-open-note="${escapeHtml(note.id)}" data-note-row="${escapeHtml(note.id)}" tabindex="0" role="button">
    <div class="note-card-top">${note.pinned ? '<i data-lucide="pin"></i>' : ''}${urgent ? '<span class="note-tag">Urgente</span>' : ''}${note.scope === 'private' ? '<i data-lucide="lock"></i>' : ''}</div>
    <p>${escapeHtml(note.content)}</p>
    ${note.details ? `<small class="note-card-details">${escapeHtml(note.details)}</small>` : ''}
    <div class="note-card-foot"><span>${escapeHtml(note.scope === 'private' ? 'Solo tú' : noteAuthor(note) === currentUser ? 'Tú' : noteAuthor(note))} · ${escapeHtml(timeAgo(note.created_at))}</span><button type="button" class="note-card-done" data-note-done="${escapeHtml(note.id)}" aria-label="Marcar como hecha"><i data-lucide="check"></i></button></div>
  </article>`;
}

const section = (key, icon, title, body, extra = '') => `<section class="todo-section is-${key}"><p class="list-group-title"><i data-lucide="${icon}"></i>${title}${extra}</p>${body}</section>`;
const countBadge = (count) => `<span>${count}</span>`;
const byPriority = (first, second) => PRIORITIES[taskPriority(first)].rank - PRIORITIES[taskPriority(second)].rank || first.due_date.localeCompare(second.due_date);
const visibleTasks = () => householdTasks.filter((task) => !onlyMine || isMine(task));
const openNotes = () => householdNotes.filter((note) => !note.completed);

// ---------- Resumen «Tu día» ----------

function completionsOn(iso, person) {
  return taskCompletions.filter((completion) => dateToISO(new Date(completion.done_at)) === iso && (!person || completion.done_by === person));
}

function ringMarkup(done, total) {
  const ratio = total ? done / total : 0;
  const circumference = 2 * Math.PI * 26;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ring-track" cx="32" cy="32" r="26"></circle><circle class="ring-fill" cx="32" cy="32" r="26" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference * (1 - ratio)).toFixed(1)}"></circle></svg><span><b>${done}</b>/${total}</span>`;
}

function renderHero() {
  const today = todayISO();
  const mine = householdTasks.filter(isMine);
  const pendingToday = mine.filter((task) => task.due_date <= today).sort(byPriority);
  const doneToday = completionsOn(today, currentUser).length;
  const total = doneToday + pendingToday.length;
  const minutes = pendingToday.reduce((sum, task) => sum + (Number(task.minutes) || 0), 0);
  const ring = document.querySelector('#todoRing');
  ring.innerHTML = ringMarkup(doneToday, total);
  ring.setAttribute('aria-label', `${doneToday} de ${total} hechas hoy`);
  const title = document.querySelector('#todoHeroTitle');
  const detail = document.querySelector('#todoHeroDetail');
  const next = mine.filter((task) => task.due_date > today).sort((first, second) => first.due_date.localeCompare(second.due_date))[0];
  if (pendingToday.length) {
    title.textContent = pendingToday.length === 1 ? 'Te queda 1 cosa hoy' : `Te quedan ${pendingToday.length} cosas hoy`;
    detail.textContent = `${minutes ? `Unos ${minutesLabel(minutes)} · ` : ''}Lo primero: ${pendingToday[0].title}`;
  } else if (doneToday) {
    title.textContent = '¡Todo hecho por hoy!';
    detail.textContent = `${doneToday === 1 ? 'Has completado 1 tarea' : `Has completado ${doneToday} tareas`}${next ? `. Lo siguiente: ${next.title}, ${dueLabel(next.due_date).toLowerCase()}` : ''}.`;
  } else {
    title.textContent = 'Día tranquilo';
    detail.textContent = next ? `Nada para hoy. Lo siguiente: ${next.title}, ${dueLabel(next.due_date).toLowerCase()}.` : 'No tienes nada pendiente.';
  }

  const tasks = visibleTasks();
  const weekEnd = addDaysToISO(today, 6);
  const overdue = tasks.filter((task) => task.due_date < today).length;
  const dueToday = tasks.filter((task) => task.due_date === today).length;
  const week = tasks.reduce((sum, task) => sum + taskOccurrences(task, addDaysToISO(today, 1), weekEnd).length, 0);
  const urgent = householdNotes.filter((note) => !note.completed && note.priority === 'urgent').length;
  const stat = (key, view, icon, value, label) => `<button type="button" class="todo-stat is-${key}${value ? '' : ' is-zero'}" data-todo-view-jump="${view}"><i data-lucide="${icon}"></i><b>${value}</b><span>${label}</span></button>`;
  document.querySelector('#todoStats').innerHTML = [
    stat('overdue', 'today', 'alarm-clock', overdue, overdue === 1 ? 'atrasada' : 'atrasadas'),
    stat('today', 'today', 'sun', dueToday, 'hoy en casa'),
    stat('week', 'week', 'calendar-range', week, 'esta semana'),
    stat('urgent', 'notes', 'siren', urgent, urgent === 1 ? 'nota urgente' : 'notas urgentes')
  ].join('');

  // Carga de los próximos 7 días (contando cada repetición).
  const days = Array.from({ length: 7 }, (_, index) => addDaysToISO(today, index));
  const loads = days.map((day) => tasks.filter((task) => taskOccurrences(task, day, day).length || (day === today && task.due_date < today)));
  const maxLoad = Math.max(...loads.map((list) => list.length), 1);
  document.querySelector('#weekStrip').innerHTML = days.map((day, index) => {
    const list = loads[index];
    const minutesDay = list.reduce((sum, task) => sum + (Number(task.minutes) || 0), 0);
    const date = isoToDate(day);
    const label = `${index === 0 ? 'Hoy' : capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date))}: ${list.length} ${list.length === 1 ? 'tarea' : 'tareas'}${minutesDay ? `, ${minutesLabel(minutesDay)}` : ''}`;
    return `<button type="button" class="week-day${index === 0 ? ' is-today' : ''}${list.some((task) => taskPriority(task) === 'high') ? ' has-high' : ''}" data-week-day="${day}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="week-day-name">${index === 0 ? 'Hoy' : new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '')}</span>
      <span class="week-day-bar"><span style="height:${list.length ? Math.max(18, (list.length / maxLoad) * 100) : 0}%"></span></span>
      <span class="week-day-count">${list.length || '·'}</span>
    </button>`;
  }).join('');
}

// ---------- Vistas ----------

function viewToday() {
  const today = todayISO();
  const tasks = visibleTasks();
  const overdue = tasks.filter((task) => task.due_date < today).sort(byPriority);
  const dueToday = tasks.filter((task) => task.due_date === today).sort(byPriority);
  const urgentNotes = openNotes().filter((note) => note.priority === 'urgent');
  const upcoming = tasks.filter((task) => task.due_date > today).sort((first, second) => first.due_date.localeCompare(second.due_date) || byPriority(first, second)).slice(0, 4);
  const doneToday = completionsOn(today).slice(0, 6);
  const blocks = [];
  if (overdue.length) blocks.push(section('overdue', 'alarm-clock', 'Atrasadas', overdue.map((task) => taskRow(task)).join(''), countBadge(overdue.length)));
  if (dueToday.length) blocks.push(section('today', 'sun', 'Para hoy', dueToday.map((task) => taskRow(task, { showDate: false })).join(''), countBadge(dueToday.length)));
  if (urgentNotes.length) blocks.push(section('urgent', 'siren', 'Notas urgentes', urgentNotes.map(noteRow).join(''), countBadge(urgentNotes.length)));
  if (!overdue.length && !dueToday.length && !urgentNotes.length) {
    blocks.push(`<div class="empty-state"><span class="empty-state-icon"><i data-lucide="${householdTasks.length ? 'party-popper' : 'list-checks'}"></i></span><strong>${householdTasks.length ? 'Nada pendiente para hoy' : 'Empieza a organizar la casa'}</strong><span>${householdTasks.length ? 'Disfrutad del día. Abajo tienes lo que viene.' : 'Escribe arriba o elige una de las tareas típicas.'}</span></div>`);
  }
  if (!householdTasks.length || householdTasks.length < 3) {
    const existing = new Set(householdTasks.map((task) => normalizeText(task.title)));
    const presets = TASK_PRESETS.filter((preset) => !existing.has(normalizeText(preset.title)));
    if (presets.length) blocks.push(section('presets', 'wand-sparkles', 'Tareas típicas, con un toque', `<div class="suggestion-row">${presets.map((preset) => `<button type="button" class="suggestion-chip" data-task-preset="${escapeHtml(preset.title)}"><i data-lucide="${taskIcon(preset.title)}"></i>${escapeHtml(preset.title)} <em>${RECURRENCE_LABELS[preset.recurrence].toLowerCase()}</em></button>`).join('')}</div>`));
  }
  if (upcoming.length) blocks.push(section('upcoming', 'calendar-clock', 'Lo próximo', upcoming.map((task) => taskRow(task)).join('')));
  if (doneToday.length) blocks.push(section('done', 'check-check', 'Hecho hoy', doneToday.map((completion) => `<div class="todo-done-row"><i data-lucide="check"></i><span>${escapeHtml(completion.title)}</span><small>${escapeHtml(completion.done_by)} · ${new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(completion.done_at))}</small></div>`).join(''), countBadge(doneToday.length)));
  return blocks.join('');
}

function viewWeek() {
  const today = todayISO();
  const tasks = visibleTasks();
  const days = Array.from({ length: 7 }, (_, index) => addDaysToISO(today, index));
  const weekEnd = days.at(-1);
  const overdue = tasks.filter((task) => task.due_date < today).sort(byPriority);
  const blocks = days.map((day, index) => {
    const entries = tasks
      .flatMap((task) => taskOccurrences(task, day, day).map((date) => ({ task, date })))
      .concat(index === 0 ? overdue.map((task) => ({ task, date: task.due_date })) : [])
      .sort((first, second) => byPriority(first.task, second.task));
    const minutes = entries.reduce((sum, { task }) => sum + (Number(task.minutes) || 0), 0);
    const date = isoToDate(day);
    const name = index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date));
    return `<section class="week-block${index === 0 ? ' is-today' : ''}" id="week-${day}">
      <header><strong>${name}</strong><span>${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date)}</span><em>${entries.length ? `${entries.length} · ${minutesLabel(minutes) || 'sin estimar'}` : 'Libre'}</em></header>
      ${entries.length ? entries.map(({ task, date: occurrence }) => taskRow(task, { date: occurrence, showDate: occurrence < today })).join('') : '<p class="week-free"><i data-lucide="sparkles"></i>Día libre</p>'}
    </section>`;
  });
  const later = tasks.filter((task) => task.due_date > weekEnd).sort((first, second) => first.due_date.localeCompare(second.due_date));
  if (later.length) blocks.push(`<details class="done-group week-later"><summary><i data-lucide="calendar-clock"></i>Más adelante<span>${later.length}</span></summary>${later.map((task) => taskRow(task)).join('')}</details>`);
  return blocks.join('');
}

function viewPeople() {
  const today = todayISO();
  const weekEnd = addDaysToISO(today, 6);
  const since = Date.now() - 30 * 86400000;
  const recent = taskCompletions.filter((completion) => new Date(completion.done_at).getTime() >= since);
  const columns = [currentUser, otherPerson(currentUser), 'both'].map((person) => {
    const tasks = householdTasks.filter((task) => task.assignee === person).sort((first, second) => first.due_date.localeCompare(second.due_date) || byPriority(first, second));
    const thisWeek = tasks.filter((task) => task.due_date <= weekEnd);
    const minutes = thisWeek.reduce((sum, task) => sum + (Number(task.minutes) || 0) * Math.max(1, taskOccurrences(task, today, weekEnd).length), 0);
    const done = person === 'both' ? null : recent.filter((completion) => completion.done_by === person).length;
    const avatar = person === 'both' ? '<span class="person-avatar is-both"><i data-lucide="users"></i></span>' : `<span class="person-avatar${person === currentUser ? ' is-me' : ''}">${escapeHtml(initialsOf(person))}</span>`;
    return `<section class="person-card">
      <header>${avatar}<div><strong>${escapeHtml(personName(person))}</strong><small>${thisWeek.length} esta semana${minutes ? ` · ${minutesLabel(minutes)}` : ''}${done !== null ? ` · ${done} ${done === 1 ? 'hecha' : 'hechas'} en 30 días` : ''}</small></div></header>
      ${tasks.length ? tasks.slice(0, 8).map((task) => taskRow(task)).join('') : '<p class="week-free"><i data-lucide="sparkles"></i>Nada asignado</p>'}
      ${tasks.length > 8 ? `<p class="person-more">y ${tasks.length - 8} más</p>` : ''}
    </section>`;
  });
  return `<p class="todo-view-intro"><i data-lucide="info"></i>Las tareas por turnos aparecen con quien le toca ahora y cambian de persona al hacerlas.</p>${columns.join('')}`;
}

function viewNotes() {
  const open = householdNotes.filter((note) => !note.completed)
    .sort((first, second) => (second.pinned === true) - (first.pinned === true) || (second.priority === 'urgent') - (first.priority === 'urgent') || String(second.created_at).localeCompare(String(first.created_at)));
  const done = householdNotes.filter((note) => note.completed).slice(0, 10);
  const add = '<button type="button" class="note-card is-add" data-new-note><i data-lucide="plus"></i><span>Nueva nota</span></button>';
  return `<div class="note-board">${open.map(noteCard).join('')}${add}</div>
    ${done.length ? `<details class="done-group"><summary><i data-lucide="check-check"></i>Hechas<span>${done.length}</span></summary>${done.map(noteRow).join('')}</details>` : ''}`;
}

// ---------- Estadísticas ----------

function renderInsights() {
  const card = document.querySelector('#todoInsights');
  const since = Date.now() - 30 * 86400000;
  const recent = taskCompletions.filter((completion) => new Date(completion.done_at).getTime() >= since);
  card.hidden = !recent.length || todoView === 'notes';
  if (card.hidden) return;
  const people = householdPeople;
  const taskMinutes = (completion) => Number(completion.minutes) || Number(householdTasks.find((task) => task.id === completion.task_id)?.minutes) || 0;
  const days = Array.from({ length: 7 }, (_, index) => addDaysToISO(todayISO(), index - 6));
  const perDay = days.map((day) => people.map((person) => completionsOn(day, person).length));
  const maxDay = Math.max(...perDay.map((counts) => counts.reduce((sum, count) => sum + count, 0)), 1);
  const weekDone = perDay.flat().reduce((sum, count) => sum + count, 0);
  const weekMinutes = taskCompletions.filter((completion) => dateToISO(new Date(completion.done_at)) >= days[0]).reduce((sum, completion) => sum + taskMinutes(completion), 0);
  const totals = people.map((person) => ({ person, count: recent.filter((completion) => completion.done_by === person).length, minutes: recent.filter((completion) => completion.done_by === person).reduce((sum, completion) => sum + taskMinutes(completion), 0) }));
  const totalCount = totals.reduce((sum, entry) => sum + entry.count, 0) || 1;
  card.innerHTML = `
    <div class="finance-subheading"><strong>Cómo vamos</strong><span>${weekDone} ${weekDone === 1 ? 'hecha' : 'hechas'} esta semana${weekMinutes ? ` · ${minutesLabel(weekMinutes)}` : ''}</span></div>
    <div class="done-chart" role="img" aria-label="Tareas hechas cada día de los últimos 7 días">
      ${days.map((day, index) => {
        const counts = perDay[index];
        const sum = counts.reduce((total, count) => total + count, 0);
        return `<div class="done-day" title="${escapeHtml(`${dueLabel(day)}: ${people.map((person, i) => `${person} ${counts[i]}`).join(', ')}`)}"><span class="done-day-total">${sum || ''}</span><span class="done-day-bar">${counts.map((count, i) => (count ? `<span style="flex:${count};background:var(--cat-${i + 1})"></span>` : '')).join('')}</span><span class="done-day-name">${index === 6 ? 'Hoy' : new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' }).format(isoToDate(day))}</span></div>`;
      }).join('')}
    </div>
    <p class="insight-label">Reparto de los últimos 30 días</p>
    <div class="balance-bar">${totals.map((entry, index) => `<span class="balance-segment" style="flex:${Math.max(entry.count, 0.15)};background:var(--cat-${index + 1})"></span>`).join('')}</div>
    <div class="balance-legend">${totals.map((entry, index) => `<span><i class="balance-dot" style="background:var(--cat-${index + 1})"></i>${escapeHtml(entry.person)} <b>${entry.count}</b> (${Math.round((entry.count / totalCount) * 100)} %)${entry.minutes ? ` · ${minutesLabel(entry.minutes)}` : ''}</span>`).join('')}</div>`;
}

// ---------- Pintar ----------

function renderPending() {
  const list = document.querySelector('#pendingList');
  if (!list) return;
  renderHero();
  document.querySelectorAll('[data-todo-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.todoView === todoView)));
  document.querySelector('#onlyMine').checked = onlyMine;
  document.querySelector('.mine-toggle').hidden = todoView === 'people' || todoView === 'notes';
  list.innerHTML = { today: viewToday, week: viewWeek, people: viewPeople, notes: viewNotes }[todoView]();
  renderInsights();
  // Lo que pide atención ahora: tareas tuyas para hoy o atrasadas y notas urgentes.
  const today = todayISO();
  const mineNow = householdTasks.filter((task) => isMine(task) && task.due_date <= today).length + householdNotes.filter((note) => !note.completed && note.priority === 'urgent').length;
  setNavBadge('tareas', mineNow);
  if (openItem) renderItemSheet();
  lucide.createIcons();
}

function setTodoView(view) {
  todoView = view;
  try { localStorage.setItem('umbral-todo-view', view); } catch {}
  renderPending();
}

// Abre Casa → Pendientes; con kind, deja el campo listo para escribir una tarea o nota.
function openPending({ filter, kind } = {}) {
  showView('pendientes');
  if (filter === 'notes') setTodoView('notes');
  else if (filter) setTodoView('today');
  if (kind) {
    quickType = kind;
    const input = document.querySelector('#pendingForm [name="title"]');
    input.placeholder = kind === 'note' ? 'Escribe la nota: «llamar al casero», «la clave del wifi es…»' : 'Añade algo: «basura mañana @matteo cada semana»';
    renderQuickPreview();
    setTimeout(() => input.focus({ preventScroll: true }), 300);
  }
}

// ---------- Ficha y editor ----------

const itemSheet = document.querySelector('#itemSheet');

function showItemSheet() {
  itemSheet.classList.add('visible');
  if (history.state?.page !== 'item') history.pushState({ page: 'item' }, '', '#pendiente');
}

function closeItemSheet() {
  if (!itemSheet.classList.contains('visible')) return;
  if (history.state?.page === 'item') history.back();
  else hideItemSheet();
}

function hideItemSheet() {
  itemSheet.classList.remove('visible');
  openItem = null;
}

const detailCell = (icon, label, value) => `<div class="detail-cell"><i data-lucide="${icon}"></i><span><small>${label}</small><strong>${escapeHtml(value)}</strong></span></div>`;

function taskDetailMarkup(task) {
  const completions = taskCompletions.filter((completion) => completion.task_id === task.id).slice(0, 6);
  const today = todayISO();
  const saturday = new Date().getDay() === 6 ? addDaysToISO(today, 7) : nextWeekday(6);
  return `
    <div class="item-hero prio-${taskPriority(task)}"><span class="todo-icon is-large"><i data-lucide="${taskIcon(task.title)}"></i></span><div><p class="eyebrow muted">${task.due_date < today ? 'Atrasada' : 'Tarea de casa'}${taskPriority(task) !== 'normal' ? ` · ${PRIORITIES[taskPriority(task)].short}` : ''}</p><h2 id="itemSheetTitle">${escapeHtml(task.title)}</h2></div></div>
    <div class="detail-grid">
      ${detailCell('calendar', 'Cuándo', dueLabel(task.due_date))}
      ${detailCell('user-round', 'Quién', task.rotate ? `${personName(task.assignee)} (por turnos)` : personName(task.assignee))}
      ${detailCell('repeat', 'Se repite', RECURRENCE_LABELS[task.recurrence])}
      ${detailCell('timer', 'Duración', minutesLabel(task.minutes) || 'Sin estimar')}
    </div>
    ${task.details ? `<p class="item-details">${escapeHtml(task.details)}</p>` : ''}
    <div class="item-actions">
      <button type="button" class="primary-button" data-sheet-done="${escapeHtml(task.id)}"><i data-lucide="check"></i> Hecha</button>
      <div class="snooze-row"><span>Posponer a</span>
        <button type="button" data-sheet-snooze="${addDaysToISO(today, 1)}">Mañana</button>
        <button type="button" data-sheet-snooze="${saturday}">Finde</button>
        <button type="button" data-sheet-snooze="${addDaysToISO(today, 7)}">1 semana</button>
      </div>
    </div>
    ${completions.length ? `<section class="plant-section"><h3>Historial</h3><div class="plant-history">${completions.map((completion) => `<div class="plant-history-item"><i data-lucide="check"></i><span><strong>${escapeHtml(completion.done_by)}</strong><small>${escapeHtml(timeAgo(completion.done_at))}</small></span></div>`).join('')}</div></section>` : ''}
    <div class="item-footer"><button type="button" class="pill-button" data-sheet-edit-task="${escapeHtml(task.id)}"><i data-lucide="pencil"></i> Editar</button><button type="button" class="link-button is-danger" data-sheet-delete-task="${escapeHtml(task.id)}">Eliminar</button></div>`;
}

function noteDetailMarkup(note) {
  const urgent = note.priority === 'urgent';
  return `
    <div class="item-hero is-note${urgent ? ' prio-high' : ''}"><span class="todo-icon is-large is-note"><i data-lucide="${note.scope === 'private' ? 'lock' : 'sticky-note'}"></i></span><div><p class="eyebrow muted">${note.scope === 'private' ? 'Nota privada' : `Nota de ${noteAuthor(note) === currentUser ? 'ti' : escapeHtml(noteAuthor(note))}`} · ${escapeHtml(timeAgo(note.created_at))}</p><h2 id="itemSheetTitle">${escapeHtml(note.content)}</h2></div></div>
    ${note.details ? `<p class="item-details">${escapeHtml(note.details)}</p>` : ''}
    <div class="item-toggles">
      <button type="button" class="option-pill${urgent ? ' is-on is-high' : ''}" data-note-toggle="priority"><i data-lucide="siren"></i>${urgent ? 'Urgente' : 'Marcar urgente'}</button>
      <button type="button" class="option-pill${note.pinned ? ' is-on' : ''}" data-note-toggle="pinned"><i data-lucide="pin"></i>${note.pinned ? 'Fijada' : 'Fijar arriba'}</button>
    </div>
    <div class="item-actions">
      <button type="button" class="primary-button" data-sheet-note-done="${escapeHtml(note.id)}"><i data-lucide="${note.completed ? 'rotate-ccw' : 'check'}"></i> ${note.completed ? 'Reabrir' : 'Hecha'}</button>
      <button type="button" class="pill-button" data-note-to-task="${escapeHtml(note.id)}"><i data-lucide="list-checks"></i> Convertir en tarea</button>
    </div>
    <div class="item-footer"><button type="button" class="pill-button" data-sheet-edit-note="${escapeHtml(note.id)}"><i data-lucide="pencil"></i> Editar</button><button type="button" class="link-button is-danger" data-sheet-delete-note="${escapeHtml(note.id)}">Eliminar</button></div>`;
}

const choice = (name, value, label, checked, icon = '') => `<label class="option-toggle"><input type="radio" name="${name}" value="${escapeHtml(value)}" ${checked ? 'checked' : ''} /><span>${icon ? `<i data-lucide="${icon}"></i>` : ''}${escapeHtml(label)}</span></label>`;

function editorMarkup(type, values = {}, id = null) {
  const today = todayISO();
  const isTask = type === 'task';
  const typeSwitch = id ? '' : `<div class="segmented is-wide editor-type" role="group" aria-label="Tipo"><button type="button" data-editor-type="task" aria-pressed="${isTask}"><i data-lucide="circle-check-big"></i>Tarea</button><button type="button" data-editor-type="note" aria-pressed="${!isTask}"><i data-lucide="sticky-note"></i>Nota</button></div>`;
  if (isTask) {
    const due = values.dueDate || values.due_date || today;
    const assignee = values.rotate ? 'rotate' : values.assignee || 'both';
    const priority = values.priority || 'normal';
    const minutes = Number(values.minutes) || 0;
    const quickDates = [[today, 'Hoy'], [addDaysToISO(today, 1), 'Mañana'], [new Date().getDay() === 6 ? addDaysToISO(today, 7) : nextWeekday(6), 'Finde'], [nextWeekday(1), 'Lunes']];
    return `<div class="plant-add-heading"><p class="eyebrow muted">${id ? 'Editar tarea' : 'Nueva'}</p><h2 id="itemSheetTitle">${id ? escapeHtml(values.title) : '¿Qué hay que hacer?'}</h2></div>
      ${typeSwitch}
      <form class="item-editor" data-editor="task" ${id ? `data-editor-id="${escapeHtml(id)}"` : ''}>
        <label class="plant-field"><span>Tarea</span><input name="title" type="text" maxlength="80" required value="${escapeHtml(values.title || '')}" placeholder="Limpiar el baño" /></label>
        <label class="plant-field"><span>Detalles (opcional)</span><textarea name="details" maxlength="600" rows="2" placeholder="Qué incluye, dónde están las cosas…">${escapeHtml(values.details || '')}</textarea></label>
        <fieldset class="plant-field"><legend>Quién</legend><div class="choice-row">${choice('assignee', 'both', 'Los dos', assignee === 'both', 'users')}${householdPeople.map((person) => choice('assignee', person, person === currentUser ? `${person} (tú)` : person, assignee === person)).join('')}${choice('assignee', 'rotate', 'Por turnos', assignee === 'rotate', 'repeat-2')}</div></fieldset>
        <fieldset class="plant-field"><legend>Cuándo</legend><div class="choice-row">${quickDates.map(([date, label]) => `<button type="button" class="option-pill${date === due ? ' is-on' : ''}" data-editor-date="${date}">${label}</button>`).join('')}<input name="dueDate" type="date" value="${due}" aria-label="Fecha" /></div></fieldset>
        <label class="plant-field"><span>Se repite</span><select name="recurrence">${Object.entries(RECURRENCE_LABELS).map(([key, label]) => `<option value="${key}" ${key === (values.recurrence || 'none') ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <fieldset class="plant-field"><legend>Prioridad</legend><div class="choice-row priority-choices">${Object.entries(PRIORITIES).map(([key, info]) => choice('priority', key, info.label, priority === key, key === 'high' ? 'flag' : key === 'low' ? 'coffee' : '')).join('')}</div></fieldset>
        <fieldset class="plant-field"><legend>¿Cuánto lleva?</legend><div class="choice-row">${choice('minutes', '', 'Sin estimar', !minutes)}${DURATIONS.map((value) => choice('minutes', String(value), minutesLabel(value), minutes === value)).join('')}</div></fieldset>
        <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${id ? 'Guardar cambios' : 'Añadir tarea'}</button></div>
      </form>`;
  }
  const scope = values.scope || 'shared';
  const urgent = values.priority === 'urgent' || values.priority === 'high';
  return `<div class="plant-add-heading"><p class="eyebrow muted">${id ? 'Editar nota' : 'Nueva'}</p><h2 id="itemSheetTitle">${id ? 'Editar nota' : 'Una nota para recordar'}</h2></div>
    ${typeSwitch}
    <form class="item-editor" data-editor="note" ${id ? `data-editor-id="${escapeHtml(id)}"` : ''}>
      <label class="plant-field"><span>Nota</span><input name="content" type="text" maxlength="120" required value="${escapeHtml(values.content || values.title || '')}" placeholder="Llamar al casero por la caldera" /></label>
      <label class="plant-field"><span>Detalles (opcional)</span><textarea name="details" maxlength="1000" rows="3" placeholder="Teléfono, dirección, la clave del wifi…">${escapeHtml(values.details || '')}</textarea></label>
      <fieldset class="plant-field"><legend>Para</legend><div class="choice-row">${choice('scope', 'shared', 'Los dos', scope === 'shared', 'users')}${choice('scope', 'private', 'Solo yo', scope === 'private', 'lock')}</div></fieldset>
      <div class="choice-row"><label class="option-toggle is-urgent"><input type="checkbox" name="urgent" ${urgent ? 'checked' : ''} /><span><i data-lucide="siren"></i>Urgente</span></label><label class="option-toggle"><input type="checkbox" name="pinned" ${values.pinned ? 'checked' : ''} /><span><i data-lucide="pin"></i>Fijar arriba</span></label></div>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${id ? 'Guardar cambios' : 'Guardar nota'}</button></div>
    </form>`;
}

function renderItemSheet() {
  const body = document.querySelector('#itemSheetBody');
  if (!openItem) return;
  if (openItem.kind === 'task') {
    const task = householdTasks.find((entry) => entry.id === openItem.id);
    if (!task) return closeItemSheet();
    body.innerHTML = taskDetailMarkup(task);
  } else if (openItem.kind === 'note') {
    const note = householdNotes.find((entry) => entry.id === openItem.id);
    if (!note) return closeItemSheet();
    body.innerHTML = noteDetailMarkup(note);
  } else {
    return;
  }
  lucide.createIcons();
}

function openTaskSheet(id) {
  openItem = { kind: 'task', id };
  renderItemSheet();
  showItemSheet();
}

function openNoteSheet(id) {
  openItem = { kind: 'note', id };
  renderItemSheet();
  showItemSheet();
}

function openEditor(type, values = {}, id = null) {
  openItem = { kind: 'editor', type, id };
  document.querySelector('#itemSheetBody').innerHTML = editorMarkup(type, values, id);
  showItemSheet();
  lucide.createIcons();
  setTimeout(() => document.querySelector('#itemSheetBody input[type="text"]')?.focus({ preventScroll: true }), 300);
}

async function submitEditor(form) {
  const values = Object.fromEntries(new FormData(form));
  const id = form.dataset.editorId;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  let saved;
  if (form.dataset.editor === 'task') {
    const task = { title: values.title, details: values.details, assignee: values.assignee, dueDate: values.dueDate, recurrence: values.recurrence, priority: values.priority, minutes: values.minutes || null };
    saved = id ? await updateTask(id, task) : await createTask(task);
  } else {
    const note = { content: values.content, details: values.details, scope: values.scope, priority: values.urgent ? 'urgent' : 'normal', pinned: Boolean(values.pinned) };
    saved = id ? await updateNote(id, { ...note, details: note.details.trim() || null }) : await addNote(note);
  }
  button.disabled = false;
  if (!saved) return;
  document.querySelector('#pendingForm').title.value = '';
  quickType = null;
  renderQuickPreview();
  if (id) {
    openItem = { kind: form.dataset.editor, id };
    renderItemSheet();
  } else {
    closeItemSheet();
  }
}

// ---------- Eventos ----------

document.querySelector('#pendingForm').addEventListener('submit', (event) => {
  event.preventDefault();
  submitQuickAdd();
});
document.querySelector('#pendingForm').addEventListener('input', renderQuickPreview);

document.querySelector('#tasksView').addEventListener('click', (event) => {
  const target = event.target;
  const done = target.closest('[data-task-done]');
  if (done) return completeTask(done.dataset.taskDone);
  const noteDone = target.closest('[data-note-done]');
  if (noteDone) return toggleNote(noteDone.dataset.noteDone);
  const view = target.closest('[data-todo-view]');
  if (view) return setTodoView(view.dataset.todoView);
  const jump = target.closest('[data-todo-view-jump]');
  if (jump) return setTodoView(jump.dataset.todoViewJump);
  const day = target.closest('[data-week-day]');
  if (day) {
    setTodoView('week');
    document.getElementById(`week-${day.dataset.weekDay}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const type = target.closest('[data-quick-type]');
  if (type) {
    quickType = type.dataset.quickType;
    renderQuickPreview();
    return;
  }
  if (target.closest('[data-quick-more]')) {
    const parsed = parseQuickAdd(document.querySelector('#pendingForm').title.value);
    const kind = quickType || parsed.type;
    return openEditor(kind, kind === 'note' ? { content: parsed.title, scope: parsed.scope, priority: parsed.priority === 'high' ? 'urgent' : 'normal' } : { ...parsed, assignee: parsed.assignee || 'both', rotate: parsed.assignee === 'rotate' });
  }
  if (target.closest('[data-new-note]')) return openEditor('note');
  const preset = target.closest('[data-task-preset]');
  if (preset) {
    const found = TASK_PRESETS.find((entry) => entry.title === preset.dataset.taskPreset);
    return createTask({ ...found, dueDate: todayISO() });
  }
  const task = target.closest('[data-open-task]');
  if (task) return openTaskSheet(task.dataset.openTask);
  const note = target.closest('[data-open-note]');
  if (note) return openNoteSheet(note.dataset.openNote);
});

document.querySelector('#tasksView').addEventListener('keydown', (event) => {
  const row = event.target.closest('[data-open-task], [data-open-note]');
  if (!row || event.target !== row || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  if (row.dataset.openTask) openTaskSheet(row.dataset.openTask);
  else openNoteSheet(row.dataset.openNote);
});

document.querySelector('#onlyMine').addEventListener('change', (event) => {
  onlyMine = event.target.checked;
  try { localStorage.setItem('umbral-only-mine', String(onlyMine)); } catch {}
  renderPending();
});

itemSheet.addEventListener('click', async (event) => {
  const target = event.target;
  if (target === itemSheet || target.closest('[data-close-item]')) return closeItemSheet();
  const done = target.closest('[data-sheet-done]');
  if (done) {
    closeItemSheet();
    return completeTask(done.dataset.sheetDone);
  }
  const snooze = target.closest('[data-sheet-snooze]');
  if (snooze) {
    await snoozeTask(openItem.id, snooze.dataset.sheetSnooze);
    return closeItemSheet();
  }
  const editTask = target.closest('[data-sheet-edit-task]');
  if (editTask) {
    const task = householdTasks.find((entry) => entry.id === editTask.dataset.sheetEditTask);
    return openEditor('task', task, task.id);
  }
  const deleteTaskButton = target.closest('[data-sheet-delete-task]');
  if (deleteTaskButton && await deleteTask(deleteTaskButton.dataset.sheetDeleteTask)) return closeItemSheet();
  const noteDone = target.closest('[data-sheet-note-done]');
  if (noteDone) {
    closeItemSheet();
    return toggleNote(noteDone.dataset.sheetNoteDone);
  }
  const toggle = target.closest('[data-note-toggle]');
  if (toggle) {
    const note = householdNotes.find((entry) => entry.id === openItem.id);
    if (toggle.dataset.noteToggle === 'priority') return updateNote(note.id, { priority: note.priority === 'urgent' ? 'normal' : 'urgent' });
    return updateNote(note.id, { pinned: !note.pinned });
  }
  const toTask = target.closest('[data-note-to-task]');
  if (toTask) {
    const note = householdNotes.find((entry) => entry.id === toTask.dataset.noteToTask);
    return openEditor('task', { title: note.content.slice(0, 80), details: note.details, priority: note.priority === 'urgent' ? 'high' : 'normal' });
  }
  const editNote = target.closest('[data-sheet-edit-note]');
  if (editNote) {
    const note = householdNotes.find((entry) => entry.id === editNote.dataset.sheetEditNote);
    return openEditor('note', note, note.id);
  }
  const deleteNoteButton = target.closest('[data-sheet-delete-note]');
  if (deleteNoteButton && await deleteNote(deleteNoteButton.dataset.sheetDeleteNote)) return closeItemSheet();
  const editorType = target.closest('[data-editor-type]');
  if (editorType) {
    const form = itemSheet.querySelector('.item-editor');
    const text = form?.title?.value || form?.content?.value || '';
    const details = form?.details?.value || '';
    return openEditor(editorType.dataset.editorType, { title: text, content: text, details });
  }
  const date = target.closest('[data-editor-date]');
  if (date) {
    const form = date.closest('form');
    form.dueDate.value = date.dataset.editorDate;
    form.querySelectorAll('[data-editor-date]').forEach((button) => button.classList.toggle('is-on', button === date));
  }
});

itemSheet.addEventListener('change', (event) => {
  if (event.target.name === 'dueDate') {
    event.target.form.querySelectorAll('[data-editor-date]').forEach((button) => button.classList.toggle('is-on', button.dataset.editorDate === event.target.value));
  }
});

itemSheet.addEventListener('submit', (event) => {
  event.preventDefault();
  submitEditor(event.target);
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'item') hideItemSheet();
});

document.addEventListener('DOMContentLoaded', renderQuickPreview);
