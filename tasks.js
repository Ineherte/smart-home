// Tareas de casa: puntuales o que se repiten, asignadas a una persona, a los dos o
// por turnos (al completarla le toca a la otra persona). Sirve también para
// vencimientos como la revisión de la caldera. Guarda quién hizo qué para mostrar
// un reparto justo del último mes.
const tasksStore = createHouseholdStore({ table: 'household_tasks', localKey: 'umbral-tasks' });
const completionsStore = createHouseholdStore({ table: 'task_completions', localKey: 'umbral-task-completions' });

const RECURRENCE_LABELS = { none: 'Una vez', daily: 'Cada día', weekly: 'Cada semana', biweekly: 'Cada 2 semanas', monthly: 'Cada mes', yearly: 'Cada año' };

const TASK_ICONS = [
  [/basura|reciclaj|contenedor|spazzatura|rifiuti/, 'trash-2'],
  [/plant|regar|jardin|cesped/, 'sprout'],
  [/ropa|lavadora|tender|plancha|sabana|toalla|bucato/, 'shirt'],
  [/compra|super|mercado|spesa/, 'shopping-cart'],
  [/caldera|revision|mantenimiento|filtro|arregl|reparar|caldaia/, 'wrench'],
  [/factura|pagar|recibo|seguro|impuesto|papeles|banco|alquiler|bolletta/, 'receipt-text'],
  [/perro|gato|mascota|veterin|arena/, 'paw-print'],
  [/cena|comida|cocinar|menu|recet/, 'chef-hat'],
  [/coche|itv|taller|gasolina|revisione auto/, 'car'],
  [/bano|limpi|fregar|aspira|polvo|cristales|horno|nevera|pulire/, 'sparkles']
];

const TASK_PRESETS = [
  { title: 'Sacar la basura', recurrence: 'weekly', assignee: 'rotate' },
  { title: 'Limpiar el baño', recurrence: 'weekly', assignee: 'rotate' },
  { title: 'Regar las plantas', recurrence: 'weekly', assignee: 'both' },
  { title: 'Cambiar las sábanas', recurrence: 'biweekly', assignee: 'both' },
  { title: 'Limpieza a fondo de la cocina', recurrence: 'monthly', assignee: 'rotate' },
  { title: 'Revisión de la caldera', recurrence: 'yearly', assignee: 'both' }
];

let householdTasks = [];
let taskCompletions = [];
let tasksReloadTimer;

const taskIcon = (title) => TASK_ICONS.find(([pattern]) => pattern.test(normalizeText(title)))?.[1] || 'circle-check-big';
const isoToDate = (iso) => new Date(`${iso}T12:00:00`);
const daysBetween = (fromISO, toISO) => Math.round((isoToDate(toISO) - isoToDate(fromISO)) / 86400000);

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
  const today = dateToISO(new Date());
  let next = addRecurrence(task.due_date, task.recurrence);
  while (next <= today) next = addRecurrence(next, task.recurrence);
  return next;
}

function dueLabel(iso) {
  const days = daysBetween(dateToISO(new Date()), iso);
  if (days < -1) return `Hace ${-days} días`;
  if (days === -1) return 'Ayer';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days < 7) return capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(isoToDate(iso)));
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(isoToDate(iso));
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
    taskCompletions = completions;
  } catch (error) {
    console.error('[Umbral] Tareas:', error);
    showToast(`No se pudieron cargar las tareas: ${error.message || 'error desconocido'}`);
  }
  renderTasks();
}

function taskRow(task, bucket) {
  const chip = task.assignee === 'both' ? '<span class="person-chip is-both" title="Los dos"><i data-lucide="users"></i></span>' : `<span class="person-chip ${task.assignee === currentUser ? 'is-me' : ''}" title="${escapeHtml(assigneeLabel(task))}">${escapeHtml(initialsOf(task.assignee))}</span>`;
  const meta = [dueLabel(task.due_date), task.recurrence !== 'none' ? RECURRENCE_LABELS[task.recurrence] : '', task.rotate ? 'por turnos' : ''].filter(Boolean).join(' · ');
  return `<div class="list-item task-item is-${bucket}" data-task-row="${task.id}">
    <button type="button" class="check-button" data-task-done="${task.id}" aria-label="Marcar «${escapeHtml(task.title)}» como hecha"><i data-lucide="check"></i></button>
    <span class="task-icon"><i data-lucide="${taskIcon(task.title)}"></i></span>
    <span class="list-item-copy"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(meta)}</small></span>
    ${chip}
    <button type="button" class="icon-ghost" data-task-menu="${task.id}" aria-label="Más opciones" title="Más opciones"><i data-lucide="more-horizontal"></i></button>
    <div class="task-actions" hidden>
      <button type="button" data-task-snooze="${task.id}"><i data-lucide="alarm-clock"></i> Mañana</button>
      <button type="button" data-task-delete="${task.id}" class="is-danger"><i data-lucide="trash-2"></i> Eliminar</button>
    </div>
  </div>`;
}

// La lista se pinta junto a las notas en pending.js; aquí, sugerencias y resúmenes.
function renderTasks() {
  const today = dateToISO(new Date());
  const existing = new Set(householdTasks.map((task) => normalizeText(task.title)));
  const presets = TASK_PRESETS.filter((preset) => !existing.has(normalizeText(preset.title)));
  document.querySelector('#taskPresets').innerHTML = presets.map((preset) => `<button type="button" class="suggestion-chip" data-task-preset="${escapeHtml(preset.title)}"><i data-lucide="${taskIcon(preset.title)}"></i>${escapeHtml(preset.title)} <em>${RECURRENCE_LABELS[preset.recurrence].toLowerCase()}</em></button>`).join('');
  document.querySelector('#taskPresetsBlock').hidden = !presets.length || document.querySelector('#pendingForm').dataset.kind !== 'task';

  renderTaskBalance();

  // Resumen en Inicio, navegación y centro de atención.
  const overdue = householdTasks.filter((task) => task.due_date < today);
  const mineNow = householdTasks.filter((task) => isMine(task) && task.due_date <= today);
  const nextMine = householdTasks.filter(isMine).sort((first, second) => first.due_date.localeCompare(second.due_date))[0];
  document.querySelector('#tasksTileValue').textContent = mineNow.length ? `${mineNow.length} para hoy` : householdTasks.length ? 'Al día' : 'Sin tareas';
  document.querySelector('#tasksTileDetail').textContent = mineNow[0] ? `${mineNow[0].assignee === currentUser ? 'Te toca' : 'Toca'}: ${mineNow[0].title}` : nextMine ? `Próxima: ${nextMine.title} (${dueLabel(nextMine.due_date).toLowerCase()})` : 'Toca para organizar la casa';
  renderAttention({ overdueTasks: overdue.length });
  updateDaySummary({ tasks: mineNow.length });
  renderPending();
}

function renderTaskBalance() {
  const block = document.querySelector('#taskBalance');
  const since = Date.now() - 30 * 86400000;
  const recent = taskCompletions.filter((completion) => new Date(completion.done_at).getTime() >= since);
  block.hidden = !recent.length;
  if (!recent.length) return;
  const counts = householdPeople.map((person) => ({ person, count: recent.filter((completion) => completion.done_by === person).length }));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0) || 1;
  document.querySelector('#taskBalanceBar').innerHTML = counts.map((entry, index) => `<span class="balance-segment is-${index}" style="flex:${Math.max(entry.count, 0.2)}"></span>`).join('');
  document.querySelector('#taskBalanceLegend').innerHTML = counts.map((entry, index) => `<span><i class="balance-dot is-${index}"></i>${escapeHtml(entry.person)} <b>${entry.count}</b> (${Math.round((entry.count / total) * 100)}%)</span>`).join('');
}

async function completeTask(id) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task) return;
  const row = document.querySelector(`[data-task-row="${id}"]`);
  row?.classList.add('is-completing');
  await new Promise((resolve) => setTimeout(resolve, 380));
  const doneBy = householdPeople.includes(currentUser) ? currentUser : task.assignee;
  try {
    const [completion] = await completionsStore.insert({ task_id: task.id, title: task.title, done_by: doneBy, done_at: new Date().toISOString() });
    taskCompletions.unshift(completion);
    if (task.recurrence === 'none') {
      await tasksStore.update(id, { active: false });
      householdTasks = householdTasks.filter((entry) => entry.id !== id);
      showToast('¡Hecho! Una cosa menos.');
      notifyHousehold(`${doneBy} completó una tarea`, task.title, { open: 'pendientes', tag: 'tasks' });
    } else {
      const changes = { due_date: nextDueDate(task) };
      if (task.rotate) changes.assignee = otherPerson(task.assignee === 'both' ? doneBy : task.assignee);
      await tasksStore.update(id, changes);
      Object.assign(task, changes);
      showToast(`¡Hecho! Próxima vez: ${dueLabel(task.due_date).toLowerCase()}${task.rotate ? ` · le toca a ${task.assignee === currentUser ? 'ti' : task.assignee}` : ''}`);
      notifyHousehold(`${doneBy} completó una tarea`, `${task.title}${task.rotate && task.assignee !== doneBy ? ' · la próxima vez te toca a ti' : ''}`, { open: 'pendientes', tag: 'tasks' });
    }
  } catch (error) {
    showSupabaseError('No se pudo completar la tarea', error);
  }
  renderTasks();
}

async function createTask({ title, recurrence, dueDate, assignee }) {
  const rotate = assignee === 'rotate';
  try {
    const [task] = await tasksStore.insert({ title, recurrence, due_date: dueDate, assignee: rotate ? (householdPeople.includes(currentUser) ? currentUser : householdPeople[0]) : assignee, rotate, active: true });
    householdTasks.push(task);
    renderTasks();
    showToast(`Tarea añadida: ${title}`);
    notifyHousehold(`${currentUser} añadió una tarea`, `${title}${task.assignee !== currentUser && task.assignee !== 'both' ? ' · te toca a ti' : ''}`, { open: 'pendientes', tag: 'tasks' });
    return true;
  } catch (error) {
    showSupabaseError('No se pudo crear la tarea', error);
    return false;
  }
}

async function snoozeTask(id) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  try {
    await tasksStore.update(id, { due_date: dateToISO(tomorrow) });
    task.due_date = dateToISO(tomorrow);
    renderTasks();
    showToast(`«${task.title}» pasa a mañana`);
  } catch (error) {
    showSupabaseError('No se pudo posponer la tarea', error);
  }
}

async function deleteTask(id) {
  const task = householdTasks.find((entry) => entry.id === id);
  if (!task || !window.confirm(`¿Eliminar «${task.title}»?`)) return;
  try {
    await tasksStore.update(id, { active: false });
    householdTasks = householdTasks.filter((entry) => entry.id !== id);
    renderTasks();
    showToast('Tarea eliminada');
  } catch (error) {
    showSupabaseError('No se pudo eliminar la tarea', error);
  }
}

document.querySelector('#tasksView').addEventListener('click', (event) => {
  const done = event.target.closest('[data-task-done]');
  if (done) return completeTask(done.dataset.taskDone);
  const menu = event.target.closest('[data-task-menu]');
  if (menu) {
    const actions = menu.closest('.task-item').querySelector('.task-actions');
    actions.hidden = !actions.hidden;
    return;
  }
  const snooze = event.target.closest('[data-task-snooze]');
  if (snooze) return snoozeTask(snooze.dataset.taskSnooze);
  const remove = event.target.closest('[data-task-delete]');
  if (remove) return deleteTask(remove.dataset.taskDelete);
  const preset = event.target.closest('[data-task-preset]');
  if (preset) {
    const found = TASK_PRESETS.find((entry) => entry.title === preset.dataset.taskPreset);
    return createTask({ title: found.title, recurrence: found.recurrence, dueDate: dateToISO(new Date()), assignee: found.assignee });
  }
});

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
