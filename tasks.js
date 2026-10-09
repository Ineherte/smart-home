// Por hacer: datos y acciones. Hay dos clases de tareas:
// - Las de una vez («pagar la luz en 5 días»): están en la lista todos los días desde que se
//   apuntan hasta que se hacen, con la cuenta atrás de su plazo (o sin plazo). Al hacerlas, se van.
// - Las rutinas (se repiten: «basura cada semana»): solo salen cuando toca, y al hacerlas
//   vuelven a la siguiente fecha (y, si van por turnos, le tocan a la otra persona).
// Pueden ir en listas (Casa, Papeles, Recados…), ser de una persona, de los dos o por turnos,
// y tener prioridad, detalles y duración. La interfaz está en pending.js.
const tasksStore = createHouseholdStore({ table: 'household_tasks', localKey: 'umbral-tasks' });
const completionsStore = createHouseholdStore({ table: 'task_completions', localKey: 'umbral-task-completions' });

const RECURRENCE_LABELS = { none: 'Una vez', daily: 'Cada día', weekly: 'Cada semana', biweekly: 'Cada 2 semanas', monthly: 'Cada mes', yearly: 'Cada año' };
const PRIORITIES = {
  high: { label: 'Alta', short: 'Importante', icon: 'flag', rank: 0 },
  normal: { label: 'Normal', short: 'Normal', icon: 'flag', rank: 1 },
  low: { label: 'Sin prisa', short: 'Sin prisa', icon: 'coffee', rank: 2 }
};
const DURATIONS = [5, 15, 30, 60, 120];
// Sin plazo: se guarda con una fecha muy lejana (no hace falta tocar la tabla para ello).
const NO_DEADLINE = '2099-12-31';
const DEFAULT_LISTS = ['Casa', 'Papeles', 'Recados'];
const LIST_ICONS = [[/casa|hogar|limpi/, 'house'], [/papel|factura|banco|gestion|tramite/, 'receipt-text'], [/recado|compra|tienda/, 'shopping-bag'], [/trabajo|curro|oficina/, 'briefcase'], [/viaje|vacacion/, 'plane'], [/regalo|cumple/, 'gift'], [/salud|medic|doctor/, 'heart-pulse'], [/coche/, 'car']];
const listIcon = (name) => LIST_ICONS.find(([pattern]) => pattern.test(normalizeText(name || '')))?.[1] || 'list';

const TASK_ICONS = [
  [/basura|reciclaj|contenedor|spazzatura|rifiuti/, 'trash-2'],
  [/\bplant|\bregar|jardin|cesped/, 'sprout'],
  [/ropa|lavadora|tender|plancha|sabana|toalla|bucato/, 'shirt'],
  [/compra|super|mercado|spesa/, 'shopping-cart'],
  [/caldera|revision|mantenimiento|filtro|arregl|reparar|caldaia|bombilla/, 'wrench'],
  [/factura|pagar|recibo|seguro|impuesto|papeles|banco|alquiler|bolletta|gestion|cita/, 'receipt-text'],
  [/perro|gato|mascota|veterin|arena/, 'paw-print'],
  [/cena|comida|cocinar|menu|recet|nevera|congelador/, 'chef-hat'],
  [/coche|itv|taller|gasolina|revisione auto/, 'car'],
  [/llamar|telefon|escribir|mail|correo/, 'phone'],
  [/bano|limpi|fregar|aspira|polvo|cristales|horno|pulire|barrer|lavavajillas|platos/, 'sparkles']
];

const TASK_PRESETS = [
  { title: 'Sacar la basura', recurrence: 'weekly', assignee: 'rotate', minutes: 5 },
  { title: 'Limpiar el baño', recurrence: 'weekly', assignee: 'rotate', minutes: 30 },
  { title: 'Regar las plantas', recurrence: 'weekly', assignee: 'both', minutes: 10 },
  { title: 'Cambiar las sábanas', recurrence: 'biweekly', assignee: 'both', minutes: 15 },
  { title: 'Aspirar la casa', recurrence: 'weekly', assignee: 'rotate', minutes: 30 },
  { title: 'Limpieza a fondo de la cocina', recurrence: 'monthly', assignee: 'rotate', minutes: 60 },
  { title: 'Revisión de la caldera', recurrence: 'yearly', assignee: 'both', minutes: 60 }
];

let householdTasks = [];
let taskCompletions = [];
let tasksReloadTimer;
// Si aún no se ha ejecutado tasks-notes-v2.sql, se guardan las tareas sin los campos nuevos.
let tasksV2Available = true;

const taskIcon = (title) => TASK_ICONS.find(([pattern]) => pattern.test(normalizeText(title)))?.[1] || 'circle-check-big';
const isoToDate = (iso) => new Date(`${iso}T12:00:00`);
const daysBetween = (fromISO, toISO) => Math.round((isoToDate(toISO) - isoToDate(fromISO)) / 86400000);
const todayISO = () => dateToISO(new Date());
const taskPriority = (task) => (PRIORITIES[task.priority] ? task.priority : 'normal');
const isRoutine = (task) => task.recurrence && task.recurrence !== 'none';
const hasDeadline = (task) => Boolean(task.due_date) && task.due_date < '2090-01-01';
// Lo que está pendiente hoy: lo de una vez (siempre, hasta hacerlo) y las rutinas que tocan.
const isPendingNow = (task) => !isRoutine(task) || task.due_date <= todayISO();
const isOverdue = (task) => hasDeadline(task) && task.due_date < todayISO();
window.isPendingNow = isPendingNow;
// Días que quedan del plazo (negativo si ya pasó; null si no tiene).
const daysLeft = (task) => (hasDeadline(task) ? daysBetween(todayISO(), task.due_date) : null);
function deadlineLabel(task) {
  const left = daysLeft(task);
  if (left === null) return 'Sin plazo';
  if (left < -1) return `Venció hace ${-left} días`;
  if (left === -1) return 'Venció ayer';
  if (left === 0) return 'Hoy';
  if (left === 1) return 'Mañana';
  if (left <= 14) return `Quedan ${left} días`;
  return `Hasta el ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(isoToDate(task.due_date))}`;
}
// Qué parte del plazo ha pasado ya (de cuando se apuntó a la fecha límite), para la barrita.
function deadlineProgress(task) {
  if (!hasDeadline(task)) return null;
  const start = String(task.created_at || '').slice(0, 10) || todayISO();
  const total = Math.max(1, daysBetween(start, task.due_date));
  return Math.min(1, Math.max(0, daysBetween(start, todayISO()) / total));
}
const deadlineTone = (task) => { const left = daysLeft(task); return left === null ? 'is-none' : left < 0 ? 'is-late' : left <= 1 ? 'is-soon' : left <= 3 ? 'is-near' : 'is-ok'; };
// Las listas que existen: las de siempre más las que tengan tareas.
const taskLists = () => [...new Set([...DEFAULT_LISTS, ...householdTasks.map((task) => task.list).filter(Boolean)])];

function addDaysToISO(iso, days) {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToISO(date);
}

function addRecurrence(iso, recurrence) {
  const date = isoToDate(iso);
  if (recurrence === 'daily') date.setDate(date.getDate() + 1);
  if (recurrence === 'weekly') date.setDate(date.getDate() + 7);
  if (recurrence === 'biweekly') date.setDate(date.getDate() + 14);
  if (recurrence === 'monthly') date.setMonth(date.getMonth() + 1);
  if (recurrence === 'yearly') date.setFullYear(date.getFullYear() + 1);
  return dateToISO(date);
}

// La siguiente fecha sigue el ritmo de la tarea, pero nunca cae en el pasado.
function nextDueDate(task) {
  const today = todayISO();
  let next = addRecurrence(task.due_date, task.recurrence);
  while (next <= today) next = addRecurrence(next, task.recurrence);
  return next;
}

// Fechas en las que toca una tarea entre from y to (las repetidas aparecen varias veces).
function taskOccurrences(task, from, to) {
  const dates = [];
  let date = task.due_date;
  for (let guard = 0; date <= to && guard < 60; guard += 1) {
    if (date >= from) dates.push(date);
    if (task.recurrence === 'none') break;
    date = addRecurrence(date, task.recurrence);
  }
  return dates;
}

function dueLabel(iso) {
  const days = daysBetween(todayISO(), iso);
  if (days < -1) return `Hace ${-days} días`;
  if (days === -1) return 'Ayer';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days < 7) return capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(isoToDate(iso)));
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(isoToDate(iso));
}

function minutesLabel(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
}

const isMine = (task) => task.assignee === 'both' || task.assignee === currentUser;
const assigneeLabel = (task) => (task.assignee === 'both' ? 'Los dos' : task.assignee === currentUser ? 'Te toca a ti' : `Le toca a ${task.assignee}`);

async function loadTasks() {
  try {
    const since = new Date(Date.now() - 45 * 86400000).toISOString();
    const [tasks, completions] = await Promise.all([
      tasksStore.list({ build: (query) => query.eq('active', true).order('due_date'), filter: (row) => row.active !== false }),
      completionsStore.list({ build: (query) => query.gte('done_at', since).order('done_at', { ascending: false }), filter: (row) => row.done_at >= since })
    ]);
    householdTasks = tasks;
    taskCompletions = completions.sort((first, second) => String(second.done_at).localeCompare(String(first.done_at)));
  } catch (error) {
    console.error('[Umbral] Tareas:', error);
    showToast(`No se pudieron cargar las tareas: ${error.message || 'error desconocido'}`);
  }
  renderTasks();
}

// Campos que llegaron después (v2: prioridad, detalles y duración; v3: lista). Si la base aún
// no los tiene, se guarda sin ellos y se avisa una vez.
const V2_FIELDS = ['priority', 'details', 'minutes', 'list'];
const missingTaskFields = new Set();
const missingField = (error) => (/column|schema cache/i.test(error?.message || '') ? V2_FIELDS.find((field) => (error.message || '').includes(`'${field}'`) || (error.message || '').includes(`"${field}"`) || (error.message || '').includes(` ${field} `)) : null);
const stripV2 = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !missingTaskFields.has(key)));

async function saveWithFallback(save, row) {
  for (let attempt = 0; attempt < V2_FIELDS.length + 1; attempt += 1) {
    try {
      return await save(stripV2(row));
    } catch (error) {
      const field = missingField(error);
      if (!field || missingTaskFields.has(field)) throw error;
      missingTaskFields.add(field);
      tasksV2Available = false;
      showToast(field === 'list' ? 'Falta ejecutar tasks-notes-v3.sql en Supabase: las listas no se guardarán' : 'Falta ejecutar tasks-notes-v2.sql en Supabase: prioridad y duración no se guardarán');
    }
  }
  return save(stripV2(row));
}

// Resumen en Inicio y centro de atención; la lista la pinta pending.js.
function renderTasks() {
  const today = todayISO();
  const overdue = householdTasks.filter((task) => task.due_date < today);
  const mineNow = householdTasks.filter((task) => isMine(task) && isPendingNow(task)).sort((first, second) => first.due_date.localeCompare(second.due_date));
  const nextMine = householdTasks.filter(isMine).sort((first, second) => first.due_date.localeCompare(second.due_date))[0];
  document.querySelector('#tasksTileValue').textContent = mineNow.length ? `${mineNow.length} por hacer` : householdTasks.length ? 'Al día' : 'Nada pendiente';
  document.querySelector('#tasksTileDetail').textContent = mineNow[0] ? `${mineNow[0].title}${hasDeadline(mineNow[0]) ? ` · ${deadlineLabel(mineNow[0]).toLowerCase()}` : ''}` : nextMine ? `Próxima: ${nextMine.title} (${dueLabel(nextMine.due_date).toLowerCase()})` : 'Toca para apuntar algo';
  renderAttention({ overdueTasks: overdue.length });
  updateDaySummary({ tasks: mineNow.length });
  renderPending();
  // La app de iPhone (native.js) reprograma los avisos de plazos.
  window.dispatchEvent(new CustomEvent('umbral:tasks'));
}

async function completeTask(id) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task) return;
  document.querySelectorAll(`[data-task-row="${CSS.escape(id)}"]`).forEach((row) => row.classList.add('is-completing'));
  await new Promise((resolve) => setTimeout(resolve, 380));
  const doneBy = householdPeople.includes(currentUser) ? currentUser : task.assignee;
  const before = { ...task };
  window.umbralMobile?.tap?.();
  try {
    const [completion] = await saveWithFallback((row) => completionsStore.insert(row), { task_id: task.id, title: task.title, done_by: doneBy, done_at: new Date().toISOString(), minutes: task.minutes || null });
    taskCompletions.unshift(completion);
    window.dispatchEvent(new CustomEvent('umbral:life', { detail: { kind: 'task' } }));
    if (task.recurrence === 'none') {
      await tasksStore.update(id, { active: false });
      householdTasks = householdTasks.filter((entry) => entry.id !== id);
      showToast(`✓ ${task.title}`, { action: 'Deshacer', onAction: () => undoComplete(before, completion) });
      notifyHousehold(`${doneBy} completó una tarea`, task.title, { open: 'pendientes', tag: 'tasks' });
    } else {
      const changes = { due_date: nextDueDate(task) };
      if (task.rotate) changes.assignee = otherPerson(task.assignee === 'both' ? doneBy : task.assignee);
      await tasksStore.update(id, changes);
      Object.assign(task, changes);
      showToast(`✓ Hecho. Próxima vez: ${dueLabel(task.due_date).toLowerCase()}${task.rotate ? ` · le toca a ${task.assignee === currentUser ? 'ti' : task.assignee}` : ''}`, { action: 'Deshacer', onAction: () => undoComplete(before, completion) });
      notifyHousehold(`${doneBy} completó una tarea`, `${task.title}${task.rotate && task.assignee !== doneBy ? ' · la próxima vez te toca a ti' : ''}`, { open: 'pendientes', tag: 'tasks' });
    }
  } catch (error) {
    showSupabaseError('No se pudo completar la tarea', error);
  }
  renderTasks();
}

// Deshacer «hecho»: la tarea vuelve como estaba y se borra del historial.
async function undoComplete(before, completion) {
  try {
    if (before.recurrence === 'none') {
      await tasksStore.update(before.id, { active: true });
      if (!householdTasks.some((entry) => entry.id === before.id)) householdTasks.push(before);
    } else {
      await tasksStore.update(before.id, { due_date: before.due_date, assignee: before.assignee });
      Object.assign(householdTasks.find((entry) => entry.id === before.id) || {}, { due_date: before.due_date, assignee: before.assignee });
    }
    if (completion?.id) {
      await completionsStore.remove(completion.id);
      taskCompletions = taskCompletions.filter((entry) => entry.id !== completion.id);
    }
    renderTasks();
    showToast(`«${before.title}» vuelve a la lista`);
  } catch (error) {
    showSupabaseError('No se pudo deshacer', error);
  }
}

function taskRowValues({ title, recurrence = 'none', dueDate, assignee = 'both', priority = 'normal', minutes = null, details = '', list = null }) {
  const rotate = assignee === 'rotate';
  return {
    title: title.trim().slice(0, 80),
    recurrence,
    // Lo de una vez sin fecha va sin plazo; una rutina sin fecha empieza hoy.
    due_date: dueDate || (recurrence === 'none' ? NO_DEADLINE : todayISO()),
    list: String(list || '').trim().slice(0, 30) || null,
    assignee: rotate ? (householdPeople.includes(currentUser) ? currentUser : householdPeople[0]) : assignee,
    rotate,
    priority: PRIORITIES[priority] ? priority : 'normal',
    minutes: minutes ? Number(minutes) : null,
    details: details?.trim().slice(0, 600) || null
  };
}

async function createTask(values) {
  try {
    const row = { ...taskRowValues(values), active: true };
    const [task] = await saveWithFallback((data) => tasksStore.insert(data), row);
    householdTasks.push(task);
    renderTasks();
    showToast(`Apuntado: ${task.title}${hasDeadline(task) && !isRoutine(task) ? ` · ${deadlineLabel(task).toLowerCase()}` : ''}`);
    notifyHousehold(`${currentUser} añadió una tarea`, `${task.title}${task.assignee !== currentUser && task.assignee !== 'both' ? ' · te toca a ti' : ''}${task.priority === 'high' ? ' · importante' : ''}`, { open: 'pendientes', tag: 'tasks' });
    return task;
  } catch (error) {
    showSupabaseError('No se pudo crear la tarea', error);
    return null;
  }
}

async function updateTask(id, values) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task) return false;
  const changes = taskRowValues(values);
  // Al editar, una tarea por turnos conserva a quién le toca ahora.
  if (changes.rotate && task.rotate) changes.assignee = task.assignee;
  try {
    await saveWithFallback((data) => tasksStore.update(id, data), changes);
    Object.assign(task, stripV2(changes));
    renderTasks();
    showToast('Tarea actualizada');
    return true;
  } catch (error) {
    showSupabaseError('No se pudo guardar la tarea', error);
    return false;
  }
}

async function snoozeTask(id, dueDate = addDaysToISO(todayISO(), 1)) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task) return;
  try {
    await tasksStore.update(id, { due_date: dueDate });
    task.due_date = dueDate;
    renderTasks();
    showToast(dueDate === NO_DEADLINE ? `«${task.title}» queda sin plazo` : `«${task.title}» pasa a ${dueLabel(dueDate).toLowerCase()}`);
  } catch (error) {
    showSupabaseError('No se pudo posponer la tarea', error);
  }
}

async function deleteTask(id) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task) return false;
  try {
    await tasksStore.update(id, { active: false });
    householdTasks = householdTasks.filter((entry) => entry.id !== id);
    renderTasks();
    showToast(`Eliminada: ${task.title}`, { action: 'Deshacer', onAction: async () => {
      try {
        await tasksStore.update(id, { active: true });
        householdTasks.push(task);
        renderTasks();
      } catch (error) { showSupabaseError('No se pudo recuperar', error); }
    } });
    return true;
  } catch (error) {
    showSupabaseError('No se pudo eliminar la tarea', error);
    return false;
  }
}

function focusNewTask() {
  openPending({ kind: 'task' });
}

document.addEventListener('umbral:ready', () => {
  loadTasks();
  const reload = () => {
    clearTimeout(tasksReloadTimer);
    tasksReloadTimer = setTimeout(loadTasks, 300);
  };
  tasksStore.subscribe(reload);
  completionsStore.subscribe(reload);
});
