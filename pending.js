// Casa → Por hacer: lo que hay que hacer, separado de las notas (notes.js).
// - Lo de una vez («pagar la luz en 5 días») está en la lista cada día, con su cuenta atrás,
//   hasta que se marca. Las rutinas («basura cada semana») solo salen cuando toca.
// - Listas: Casa, Papeles, Recados… (y las que creéis), con un filtro arriba.
// - Añadir rápido escribiendo normal: «pagar la luz en 5 días #papeles @matteo».
// - Tres vistas: Lista, Semana y Personas. Cada tarea se abre en una ficha.
// Usa los datos y acciones de tasks.js, y currentUser, showToast… de app.js.
let todoView = 'list';
let onlyMine = false;
let activeList = '';
let pendingPane = 'todo';
let quickType = null;
let openItem = null;

try {
  todoView = ['list', 'week', 'people'].includes(localStorage.getItem('umbral-todo-view')) ? localStorage.getItem('umbral-todo-view') : 'list';
  onlyMine = localStorage.getItem('umbral-only-mine') === 'true';
  activeList = localStorage.getItem('umbral-todo-list') || '';
  pendingPane = localStorage.getItem('umbral-pending-pane') === 'notes' ? 'notes' : 'todo';
} catch {}

const WEEKDAYS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const personName = (assignee) => (assignee === 'both' ? 'Los dos' : assignee === currentUser ? 'Tú' : assignee);
// Listas creadas a mano que aún no tienen nada (se recuerdan en este teléfono).
const customLists = () => { try { return JSON.parse(localStorage.getItem('umbral-task-lists') || '[]'); } catch { return []; } };
const allLists = () => [...new Set([...taskLists(), ...customLists()])];

// ---------- Añadir rápido en lenguaje natural ----------

function nextWeekday(target) {
  const today = new Date();
  const ahead = (target - today.getDay() + 7) % 7 || 7;
  return addDaysToISO(todayISO(), ahead);
}
const NUMBERS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };
const toNumber = (word) => Number(word) || NUMBERS[normalizeText(word)] || 0;

// Entiende el plazo, la repetición, la lista, la persona, la prioridad y la duración dentro
// del texto; lo que sobra es el título.
function parseQuickAdd(text) {
  const result = { type: 'task', title: '', dueDate: null, recurrence: 'none', assignee: null, priority: 'normal', minutes: null, list: null, noDeadline: false };
  let rest = ` ${text} `;
  const take = (pattern, apply) => {
    rest = rest.replace(pattern, (...match) => {
      apply(match);
      return ' ';
    });
  };
  const word = (body) => new RegExp(`(^|\\s)(${body})(?=[\\s,.!]|$)`, 'i');
  const num = '(\\d{1,3}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince)';

  take(/(^|\s)(nota|apunte)\s*:\s*/i, () => { result.type = 'note'; });
  take(/(^|\s)#([\p{L}\d][\p{L}\d-]{0,29})(?=\s|$)/u, (match) => {
    const name = match[2].replace(/-/g, ' ');
    result.list = allLists().find((list) => normalizeText(list) === normalizeText(name)) || capitalizeFirst(name);
  });
  take(word('!{1,3}|urgente|importante|prioridad alta|cuanto antes'), () => { result.priority = 'high'; });
  take(/!+(?=\s)/, () => { result.priority = 'high'; });
  take(word('sin prisa|cuando se pueda|baja prioridad|cuando pueda'), () => { result.priority = 'low'; });
  take(word('sin plazo|sin fecha|alg[uú]n d[ií]a'), () => { result.noDeadline = true; });

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

  // Plazos: «en 5 días», «dentro de una semana», «en un mes»…
  take(new RegExp(`(^|\\s)(en|dentro de|como mucho en|antes de)\\s+${num}\\s+(d[ií]as?)(?=[\\s,.!]|$)`, 'i'), (match) => { result.dueDate = addDaysToISO(todayISO(), toNumber(match[3])); });
  take(new RegExp(`(^|\\s)(en|dentro de|antes de)\\s+${num}\\s+(semanas?)(?=[\\s,.!]|$)`, 'i'), (match) => { result.dueDate = addDaysToISO(todayISO(), 7 * toNumber(match[3])); });
  take(new RegExp(`(^|\\s)(en|dentro de|antes de)\\s+${num}\\s+(mes|meses)(?=[\\s,.!]|$)`, 'i'), (match) => { result.dueDate = addDaysToISO(todayISO(), 30 * toNumber(match[3])); });
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

  // Lo que se queda colgando al quitar la fecha: «pagar la luz antes del», «… para el».
  rest = rest.replace(/\s(antes del?|para el|para|hasta el|hasta|como tarde el|como tarde|el)\s*$/i, ' ');
  result.title = capitalizeFirst(rest.replace(/\s+/g, ' ').trim());
  if (result.noDeadline && result.recurrence === 'none') result.dueDate = NO_DEADLINE;
  return result;
}

function quickDeadlineLabel(parsed) {
  if (parsed.recurrence !== 'none') return parsed.dueDate ? `Empieza ${dueLabel(parsed.dueDate).toLowerCase()}` : 'Empieza hoy';
  if (!parsed.dueDate || parsed.dueDate === NO_DEADLINE) return 'Sin plazo';
  return deadlineLabel({ due_date: parsed.dueDate });
}

function renderQuickPreview() {
  const form = document.querySelector('#pendingForm');
  const preview = document.querySelector('#quickPreview');
  const text = form.title.value.trim();
  form.classList.toggle('has-text', Boolean(text));
  if (!text) {
    preview.innerHTML = '<span class="quick-hint"><i data-lucide="sparkles"></i>Escribe normal: «en 5 días», «el viernes», «cada semana», «#papeles», «@matteo», «!»</span>';
    lucide.createIcons();
    return;
  }
  const parsed = parseQuickAdd(text);
  if (parsed.type === 'note') {
    preview.innerHTML = '<span class="quick-chip is-type"><i data-lucide="sticky-note"></i>Se guardará como nota</span>';
    lucide.createIcons();
    return;
  }
  const chip = (icon, label, extra = '') => `<span class="quick-chip ${extra}"><i data-lucide="${icon}"></i>${escapeHtml(label)}</span>`;
  const list = parsed.list || activeList;
  const chips = [
    chip(parsed.recurrence !== 'none' ? 'repeat' : 'hourglass', parsed.recurrence !== 'none' ? `Rutina · ${RECURRENCE_LABELS[parsed.recurrence].toLowerCase()}` : quickDeadlineLabel(parsed), parsed.dueDate || parsed.recurrence !== 'none' ? '' : 'is-default'),
    chip(list ? listIcon(list) : 'inbox', list || 'Sin lista', list ? '' : 'is-default'),
    chip('user-round', parsed.assignee === 'rotate' ? 'Por turnos' : personName(parsed.assignee || 'both'), parsed.assignee ? '' : 'is-default')
  ];
  if (parsed.priority !== 'normal') chips.push(chip(PRIORITIES[parsed.priority].icon, PRIORITIES[parsed.priority].short, `is-${parsed.priority}`));
  if (parsed.minutes) chips.push(chip('timer', minutesLabel(parsed.minutes)));
  chips.push('<button type="button" class="quick-chip is-more" data-quick-more><i data-lucide="sliders-horizontal"></i>Más</button>');
  preview.innerHTML = chips.join('');
  lucide.createIcons();
}

async function submitQuickAdd() {
  const form = document.querySelector('#pendingForm');
  const text = form.title.value.trim();
  if (!text) return form.title.focus();
  const parsed = parseQuickAdd(text);
  if (parsed.type === 'note') {
    form.title.value = '';
    renderQuickPreview();
    setPendingPane('notes');
    newNote();
    const title = document.querySelector('#noteSheet [name="noteTitle"]');
    if (title) { title.value = parsed.title; title.dispatchEvent(new Event('input', { bubbles: true })); }
    return;
  }
  if (!parsed.title) return openEditor(editorValuesFrom(parsed));
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const saved = await createTask(taskFromParsed(parsed));
  button.disabled = false;
  if (saved) {
    form.title.value = '';
    renderQuickPreview();
  }
}
const taskFromParsed = (parsed) => ({ title: parsed.title, recurrence: parsed.recurrence, dueDate: parsed.dueDate || (parsed.recurrence === 'none' ? NO_DEADLINE : todayISO()), assignee: parsed.assignee || 'both', priority: parsed.priority, minutes: parsed.minutes, list: parsed.list || activeList || null });
const editorValuesFrom = (parsed) => ({ ...taskFromParsed(parsed), due_date: parsed.dueDate || (parsed.recurrence === 'none' ? NO_DEADLINE : todayISO()), rotate: parsed.assignee === 'rotate' });

// ---------- Filas ----------

const priorityFlag = (task) => (taskPriority(task) === 'high' ? '<span class="prio-flag" title="Importante"><i data-lucide="flag"></i></span>' : '');
function personChip(assignee, rotate) {
  if (assignee === 'both') return '<span class="person-chip is-both" title="Los dos"><i data-lucide="users"></i></span>';
  return `<span class="person-chip ${assignee === currentUser ? 'is-me' : ''}${rotate ? ' is-rotate' : ''}" title="${escapeHtml(personName(assignee))}${rotate ? ' · por turnos' : ''}">${escapeHtml(initialsOf(assignee))}</span>`;
}
// date: la fecha de esta aparición (en la semana, una rutina sale varias veces; solo la primera se marca).
function taskRow(task, { date = task.due_date } = {}) {
  const routine = isRoutine(task);
  const isNext = date === task.due_date;
  const tone = routine ? (date < todayISO() ? 'is-late' : date === todayISO() ? 'is-soon' : 'is-ok') : deadlineTone(task);
  const pill = routine ? (date <= todayISO() ? (date < todayISO() ? dueLabel(date) : 'Hoy') : dueLabel(date)) : deadlineLabel(task);
  const meta = [
    routine ? `${RECURRENCE_LABELS[task.recurrence]}${task.rotate ? ' · por turnos' : ''}` : '',
    !activeList && task.list ? task.list : '',
    minutesLabel(task.minutes)
  ].filter(Boolean).join(' · ');
  const progress = !routine ? deadlineProgress(task) : null;
  return `<div class="todo-row ${tone} prio-${taskPriority(task)}${routine ? ' is-routine' : ''}${isNext ? '' : ' is-future'}" data-task-row="${escapeHtml(task.id)}" data-open-task="${escapeHtml(task.id)}" tabindex="0" role="button" aria-label="${escapeHtml(task.title)}">
    ${isNext ? `<button type="button" class="todo-check" data-task-done="${escapeHtml(task.id)}" aria-label="Marcar «${escapeHtml(task.title)}» como hecha"><i data-lucide="check"></i></button>` : '<span class="todo-check is-ghost" aria-hidden="true"><i data-lucide="repeat"></i></span>'}
    <span class="todo-copy"><strong>${escapeHtml(task.title)}</strong><span class="todo-meta"><span class="deadline-pill ${tone}">${routine ? '<i data-lucide="repeat"></i>' : ''}${escapeHtml(pill)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</span>${progress !== null ? `<span class="deadline-bar"><b style="width:${Math.round(progress * 100)}%"></b></span>` : ''}</span>
    <span class="todo-side">${priorityFlag(task)}${personChip(task.assignee, task.rotate)}</span>
  </div>`;
}

const section = (key, icon, title, body, extra = '') => `<section class="todo-section is-${key}"><p class="list-group-title"><i data-lucide="${icon}"></i>${title}${extra}</p>${body}</section>`;
const countBadge = (count) => `<span>${count}</span>`;
const byPriority = (first, second) => PRIORITIES[taskPriority(first)].rank - PRIORITIES[taskPriority(second)].rank || first.due_date.localeCompare(second.due_date);
const byDeadline = (first, second) => first.due_date.localeCompare(second.due_date) || PRIORITIES[taskPriority(first)].rank - PRIORITIES[taskPriority(second)].rank;
const visibleTasks = () => householdTasks.filter((task) => (!onlyMine || isMine(task)) && (!activeList || task.list === activeList));

// ---------- Resumen «Tu día» ----------

function completionsOn(iso, person) {
  return taskCompletions.filter((completion) => dateToISO(new Date(completion.done_at)) === iso && (!person || completion.done_by === person));
}
function ringMarkup(done, total) {
  const ratio = total ? done / total : 0;
  const circumference = 2 * Math.PI * 26;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="ring-track" cx="32" cy="32" r="26"></circle><circle class="ring-fill" cx="32" cy="32" r="26" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference * (1 - ratio)).toFixed(1)}"></circle></svg><span><b>${done}</b>/${total}</span>`;
}
// Lo que toca un día: plazos que vencen ese día y rutinas (hoy incluye lo vencido).
function dayLoad(tasks, day, isToday) {
  return tasks.filter((task) => (isRoutine(task) ? taskOccurrences(task, day, day).length || (isToday && task.due_date < day) : task.due_date === day || (isToday && isOverdue(task))));
}

function renderHero() {
  const today = todayISO();
  const mine = householdTasks.filter(isMine);
  const pendingNow = mine.filter(isPendingNow).sort(byDeadline);
  const urgentMine = pendingNow.filter((task) => isRoutine(task) || (hasDeadline(task) && daysLeft(task) <= 1));
  const doneToday = completionsOn(today, currentUser).length;
  const total = doneToday + urgentMine.length;
  const ring = document.querySelector('#todoRing');
  ring.innerHTML = ringMarkup(doneToday, total);
  ring.setAttribute('aria-label', `${doneToday} de ${total} hechas hoy`);
  const title = document.querySelector('#todoHeroTitle');
  const detail = document.querySelector('#todoHeroDetail');
  const late = mine.filter(isOverdue);
  if (late.length) {
    title.textContent = late.length === 1 ? 'Tienes 1 cosa con el plazo pasado' : `Tienes ${late.length} cosas con el plazo pasado`;
    detail.textContent = `Lo primero: ${late.sort(byDeadline)[0].title}`;
  } else if (urgentMine.length) {
    title.textContent = urgentMine.length === 1 ? '1 cosa para hoy o mañana' : `${urgentMine.length} cosas para hoy o mañana`;
    detail.textContent = `Lo primero: ${urgentMine[0].title}${pendingNow.length > urgentMine.length ? ` · y ${pendingNow.length - urgentMine.length} más con margen` : ''}`;
  } else if (pendingNow.length) {
    title.textContent = 'Vas con margen';
    detail.textContent = `${pendingNow.length} ${pendingNow.length === 1 ? 'cosa por hacer' : 'cosas por hacer'}. La más próxima: ${pendingNow[0].title} (${deadlineLabel(pendingNow[0]).toLowerCase()})`;
  } else {
    title.textContent = doneToday ? '¡Todo hecho!' : 'Nada pendiente';
    detail.textContent = doneToday ? `Hoy has hecho ${doneToday} ${doneToday === 1 ? 'cosa' : 'cosas'}.` : 'Apunta abajo lo que tengas que hacer.';
  }

  const tasks = visibleTasks();
  const weekEnd = addDaysToISO(today, 6);
  const overdue = tasks.filter(isOverdue).length + tasks.filter((task) => isRoutine(task) && task.due_date < today).length;
  const dueToday = tasks.filter((task) => task.due_date === today).length;
  const week = tasks.filter((task) => (isRoutine(task) ? taskOccurrences(task, addDaysToISO(today, 1), weekEnd).length : hasDeadline(task) && task.due_date > today && task.due_date <= weekEnd)).length;
  const open = tasks.filter((task) => !isRoutine(task) && !hasDeadline(task)).length;
  const stat = (key, view, icon, value, label) => `<button type="button" class="todo-stat is-${key}${value ? '' : ' is-zero'}" data-todo-view-jump="${view}"><i data-lucide="${icon}"></i><b>${value}</b><span>${label}</span></button>`;
  document.querySelector('#todoStats').innerHTML = [
    stat('overdue', 'list', 'alarm-clock', overdue, 'vencidas'),
    stat('today', 'list', 'sun', dueToday, 'para hoy'),
    stat('week', 'week', 'calendar-range', week, 'esta semana'),
    stat('urgent', 'list', 'infinity', open, 'sin plazo')
  ].join('');

  const days = Array.from({ length: 7 }, (_, index) => addDaysToISO(today, index));
  const loads = days.map((day, index) => dayLoad(tasks, day, index === 0));
  const maxLoad = Math.max(...loads.map((list) => list.length), 1);
  document.querySelector('#weekStrip').innerHTML = days.map((day, index) => {
    const list = loads[index];
    const date = isoToDate(day);
    const label = `${index === 0 ? 'Hoy' : capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date))}: ${list.length} ${list.length === 1 ? 'cosa' : 'cosas'}`;
    return `<button type="button" class="week-day${index === 0 ? ' is-today' : ''}${list.some((task) => taskPriority(task) === 'high') ? ' has-high' : ''}" data-week-day="${day}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="week-day-name">${index === 0 ? 'Hoy' : new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '')}</span>
      <span class="week-day-bar"><span style="height:${list.length ? Math.max(18, (list.length / maxLoad) * 100) : 0}%"></span></span>
      <span class="week-day-count">${list.length || '·'}</span>
    </button>`;
  }).join('');
}

// ---------- Listas (filtro de arriba) ----------

function renderLists() {
  const host = document.querySelector('#todoLists');
  if (!host) return;
  const pending = householdTasks.filter((task) => (!onlyMine || isMine(task)) && isPendingNow(task));
  const count = (list) => pending.filter((task) => (list ? task.list === list : true)).length;
  if (activeList && !allLists().includes(activeList)) activeList = '';
  host.innerHTML = [['', 'Todo', 'layers']].concat(allLists().map((list) => [list, list, listIcon(list)])).map(([id, label, icon]) => `<button type="button" class="list-chip${activeList === id ? ' is-on' : ''}" data-todo-list="${escapeHtml(id)}"><i data-lucide="${icon}"></i>${escapeHtml(label)}${count(id) ? `<b>${count(id)}</b>` : ''}</button>`).join('') + '<button type="button" class="list-chip is-new" data-new-list><i data-lucide="plus"></i>Lista</button>';
}

// ---------- Vistas ----------

function viewList() {
  const today = todayISO();
  const tasks = visibleTasks();
  const once = tasks.filter((task) => !isRoutine(task));
  const routines = tasks.filter(isRoutine);
  const late = [...once.filter(isOverdue), ...routines.filter((task) => task.due_date < today)].sort(byDeadline);
  const todayList = [...once.filter((task) => task.due_date === today), ...routines.filter((task) => task.due_date === today)].sort(byPriority);
  const withDeadline = once.filter((task) => hasDeadline(task) && task.due_date > today).sort(byDeadline);
  const noDeadline = once.filter((task) => !hasDeadline(task)).sort(byPriority);
  const nextRoutines = routines.filter((task) => task.due_date > today).sort(byDeadline);
  const doneToday = completionsOn(today).filter((completion) => !activeList || householdTasks.find((task) => task.id === completion.task_id)?.list === activeList || !completion.task_id).slice(0, 6);
  const blocks = [];
  if (late.length) blocks.push(section('overdue', 'alarm-clock', 'Plazo pasado', late.map((task) => taskRow(task)).join(''), countBadge(late.length)));
  if (todayList.length) blocks.push(section('today', 'sun', 'Para hoy', todayList.map((task) => taskRow(task)).join(''), countBadge(todayList.length)));
  if (withDeadline.length) blocks.push(section('upcoming', 'hourglass', 'Con plazo', withDeadline.map((task) => taskRow(task)).join(''), countBadge(withDeadline.length)));
  if (noDeadline.length) blocks.push(section('open', 'infinity', 'Sin plazo', noDeadline.map((task) => taskRow(task)).join(''), countBadge(noDeadline.length)));
  if (!late.length && !todayList.length && !withDeadline.length && !noDeadline.length) {
    blocks.push(`<div class="empty-state"><span class="empty-state-icon"><i data-lucide="${householdTasks.length ? 'party-popper' : 'list-checks'}"></i></span><strong>${activeList ? `Nada en ${escapeHtml(activeList)}` : householdTasks.length ? 'Todo hecho' : 'Apunta lo que tengas que hacer'}</strong><span>Por ejemplo: «pagar la luz en 5 días #papeles». Se queda aquí cada día, con su cuenta atrás, hasta que lo marques.</span></div>`);
  }
  if (nextRoutines.length) blocks.push(`<details class="done-group routines-group"${!once.length ? ' open' : ''}><summary><i data-lucide="repeat"></i>Próximas rutinas<span>${nextRoutines.length}</span></summary>${nextRoutines.map((task) => taskRow(task)).join('')}</details>`);
  if (routines.length < 3 && (!activeList || activeList === 'Casa')) {
    const existing = new Set(householdTasks.map((task) => normalizeText(task.title)));
    const presets = TASK_PRESETS.filter((preset) => !existing.has(normalizeText(preset.title)));
    if (presets.length) blocks.push(section('presets', 'wand-sparkles', 'Rutinas de casa, con un toque', `<div class="suggestion-row">${presets.map((preset) => `<button type="button" class="suggestion-chip" data-task-preset="${escapeHtml(preset.title)}"><i data-lucide="${taskIcon(preset.title)}"></i>${escapeHtml(preset.title)} <em>${RECURRENCE_LABELS[preset.recurrence].toLowerCase()}</em></button>`).join('')}</div>`));
  }
  if (doneToday.length) blocks.push(section('done', 'check-check', 'Hecho hoy', doneToday.map((completion) => `<div class="todo-done-row"><i data-lucide="check"></i><span>${escapeHtml(completion.title)}</span><small>${escapeHtml(completion.done_by)} · ${new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(completion.done_at))}</small></div>`).join(''), countBadge(doneToday.length)));
  return blocks.join('');
}

function viewWeek() {
  const today = todayISO();
  const tasks = visibleTasks();
  const days = Array.from({ length: 7 }, (_, index) => addDaysToISO(today, index));
  const blocks = days.map((day, index) => {
    const entries = tasks
      .flatMap((task) => (isRoutine(task) ? taskOccurrences(task, day, day).map((date) => ({ task, date })) : task.due_date === day ? [{ task, date: day }] : []))
      .concat(index === 0 ? tasks.filter((task) => (isRoutine(task) ? task.due_date < today : isOverdue(task))).map((task) => ({ task, date: task.due_date })) : [])
      .sort((first, second) => byPriority(first.task, second.task));
    const date = isoToDate(day);
    const name = index === 0 ? 'Hoy' : index === 1 ? 'Mañana' : capitalizeFirst(new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date));
    return `<section class="week-block${index === 0 ? ' is-today' : ''}" id="week-${day}">
      <header><strong>${name}</strong><span>${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date)}</span><em>${entries.length ? `${entries.length} ${entries.length === 1 ? 'cosa' : 'cosas'}` : 'Libre'}</em></header>
      ${entries.length ? entries.map(({ task, date: occurrence }) => taskRow(task, { date: occurrence })).join('') : '<p class="week-free"><i data-lucide="sparkles"></i>Nada vence este día</p>'}
    </section>`;
  });
  const open = tasks.filter((task) => !isRoutine(task) && (!hasDeadline(task) || task.due_date > days.at(-1))).sort(byDeadline);
  if (open.length) blocks.push(`<details class="done-group week-later"><summary><i data-lucide="calendar-clock"></i>Más adelante o sin plazo<span>${open.length}</span></summary>${open.map((task) => taskRow(task)).join('')}</details>`);
  return blocks.join('');
}

function viewPeople() {
  const since = Date.now() - 30 * 86400000;
  const recent = taskCompletions.filter((completion) => new Date(completion.done_at).getTime() >= since);
  const columns = [currentUser, otherPerson(currentUser), 'both'].map((person) => {
    const tasks = householdTasks.filter((task) => task.assignee === person && (!activeList || task.list === activeList) && isPendingNow(task)).sort(byDeadline);
    const done = person === 'both' ? null : recent.filter((completion) => completion.done_by === person).length;
    const avatar = person === 'both' ? '<span class="person-avatar is-both"><i data-lucide="users"></i></span>' : `<span class="person-avatar${person === currentUser ? ' is-me' : ''}">${escapeHtml(initialsOf(person))}</span>`;
    return `<section class="person-card">
      <header>${avatar}<div><strong>${escapeHtml(personName(person))}</strong><small>${tasks.length} por hacer${done !== null ? ` · ${done} ${done === 1 ? 'hecha' : 'hechas'} en 30 días` : ''}</small></div></header>
      ${tasks.length ? tasks.slice(0, 8).map((task) => taskRow(task)).join('') : '<p class="week-free"><i data-lucide="sparkles"></i>Nada pendiente</p>'}
      ${tasks.length > 8 ? `<p class="person-more">y ${tasks.length - 8} más</p>` : ''}
    </section>`;
  });
  return `<p class="todo-view-intro"><i data-lucide="info"></i>Las rutinas por turnos aparecen con quien le toca ahora y cambian de persona al hacerlas.</p>${columns.join('')}`;
}

// ---------- Estadísticas ----------

function renderInsights() {
  const card = document.querySelector('#todoInsights');
  const since = Date.now() - 30 * 86400000;
  const recent = taskCompletions.filter((completion) => new Date(completion.done_at).getTime() >= since);
  card.hidden = !recent.length || pendingPane !== 'todo';
  if (card.hidden) return;
  const people = householdPeople;
  const days = Array.from({ length: 7 }, (_, index) => addDaysToISO(todayISO(), index - 6));
  const perDay = days.map((day) => people.map((person) => completionsOn(day, person).length));
  const weekDone = perDay.flat().reduce((sum, count) => sum + count, 0);
  const totals = people.map((person) => ({ person, count: recent.filter((completion) => completion.done_by === person).length }));
  const totalCount = totals.reduce((sum, entry) => sum + entry.count, 0) || 1;
  card.innerHTML = `
    <div class="finance-subheading"><strong>Cómo vamos</strong><span>${weekDone} ${weekDone === 1 ? 'hecha' : 'hechas'} esta semana</span></div>
    <div class="done-chart" role="img" aria-label="Cosas hechas cada día de los últimos 7 días">
      ${days.map((day, index) => {
        const counts = perDay[index];
        const sum = counts.reduce((total, count) => total + count, 0);
        return `<div class="done-day" title="${escapeHtml(`${dueLabel(day)}: ${people.map((person, i) => `${person} ${counts[i]}`).join(', ')}`)}"><span class="done-day-total">${sum || ''}</span><span class="done-day-bar">${counts.map((count, i) => (count ? `<span style="flex:${count};background:var(--cat-${i + 1})"></span>` : '')).join('')}</span><span class="done-day-name">${index === 6 ? 'Hoy' : new Intl.DateTimeFormat('es-ES', { weekday: 'narrow' }).format(isoToDate(day))}</span></div>`;
      }).join('')}
    </div>
    <p class="insight-label">Reparto de los últimos 30 días</p>
    <div class="balance-bar">${totals.map((entry, index) => `<span class="balance-segment" style="flex:${Math.max(entry.count, 0.15)};background:var(--cat-${index + 1})"></span>`).join('')}</div>
    <div class="balance-legend">${totals.map((entry, index) => `<span><i class="balance-dot" style="background:var(--cat-${index + 1})"></i>${escapeHtml(entry.person)} <b>${entry.count}</b> (${Math.round((entry.count / totalCount) * 100)} %)</span>`).join('')}</div>`;
}

// ---------- Pintar ----------

function renderPending() {
  const list = document.querySelector('#pendingList');
  if (!list) return;
  document.querySelectorAll('[data-pending-pane]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.pendingPane === pendingPane)));
  document.querySelectorAll('[data-pane="todo"]').forEach((el) => { el.hidden = pendingPane !== 'todo'; });
  document.querySelectorAll('[data-pane="notes"]').forEach((el) => { el.hidden = pendingPane !== 'notes'; });
  renderHero();
  renderLists();
  document.querySelectorAll('[data-todo-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.todoView === todoView)));
  document.querySelector('#onlyMine').checked = onlyMine;
  document.querySelector('.mine-toggle').hidden = todoView === 'people';
  list.innerHTML = { list: viewList, week: viewWeek, people: viewPeople }[todoView]();
  renderInsights();
  // Lo que pide atención: lo tuyo vencido, de hoy o de mañana.
  const mineNow = householdTasks.filter((task) => isMine(task) && isPendingNow(task) && (isRoutine(task) || (hasDeadline(task) && daysLeft(task) <= 1))).length;
  setNavBadge('tareas', mineNow);
  if (openItem) renderItemSheet();
  lucide.createIcons();
}

function setTodoView(view) {
  todoView = view;
  try { localStorage.setItem('umbral-todo-view', view); } catch {}
  renderPending();
}
function setPendingPane(pane) {
  pendingPane = pane;
  try { localStorage.setItem('umbral-pending-pane', pane); } catch {}
  renderPending();
  if (pane === 'notes' && typeof renderNotesBoard === 'function') renderNotesBoard();
}
function setActiveList(list) {
  activeList = list;
  try { localStorage.setItem('umbral-todo-list', list); } catch {}
  renderPending();
}

// Abre Casa → Por hacer (o Notas); con kind, deja listo para escribir.
function openPending({ filter, kind } = {}) {
  showView('pendientes');
  if (filter === 'notes' || kind === 'note') {
    setPendingPane('notes');
    if (kind === 'note') setTimeout(() => newNote(), 250);
    return;
  }
  setPendingPane('todo');
  if (filter) setTodoView('list');
  if (kind) {
    const input = document.querySelector('#pendingForm [name="title"]');
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
  const routine = isRoutine(task);
  const progress = !routine ? deadlineProgress(task) : null;
  const saturday = new Date().getDay() === 6 ? addDaysToISO(today, 7) : nextWeekday(6);
  return `
    <div class="item-hero prio-${taskPriority(task)}"><span class="todo-icon is-large"><i data-lucide="${routine ? 'repeat' : listIcon(task.list)}"></i></span><div><p class="eyebrow muted">${routine ? 'Rutina' : task.list ? `Por hacer · ${escapeHtml(task.list)}` : 'Por hacer'}${taskPriority(task) !== 'normal' ? ` · ${PRIORITIES[taskPriority(task)].short}` : ''}</p><h2 id="itemSheetTitle">${escapeHtml(task.title)}</h2></div></div>
    ${!routine ? `<div class="deadline-hero ${deadlineTone(task)}"><strong>${escapeHtml(deadlineLabel(task))}</strong><small>${hasDeadline(task) ? `Plazo: ${new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(isoToDate(task.due_date))}` : 'Se queda en la lista hasta que lo hagas'}</small>${progress !== null ? `<span class="deadline-bar"><b style="width:${Math.round(progress * 100)}%"></b></span>` : ''}</div>` : ''}
    <div class="detail-grid">
      ${routine ? detailCell('calendar', 'Próxima vez', dueLabel(task.due_date)) : ''}
      ${detailCell('user-round', 'Quién', task.rotate ? `${personName(task.assignee)} (por turnos)` : personName(task.assignee))}
      ${routine ? detailCell('repeat', 'Se repite', RECURRENCE_LABELS[task.recurrence]) : detailCell(listIcon(task.list), 'Lista', task.list || 'Sin lista')}
      ${detailCell('timer', 'Duración', minutesLabel(task.minutes) || 'Sin estimar')}
    </div>
    ${task.details ? `<p class="item-details">${escapeHtml(task.details)}</p>` : ''}
    <div class="item-actions">
      <button type="button" class="primary-button" data-sheet-done="${escapeHtml(task.id)}"><i data-lucide="check"></i> Hecho</button>
      <div class="snooze-row"><span>${routine ? 'Posponer a' : 'Mover el plazo a'}</span>
        <button type="button" data-sheet-snooze="${addDaysToISO(today, 1)}">Mañana</button>
        <button type="button" data-sheet-snooze="${saturday}">Finde</button>
        <button type="button" data-sheet-snooze="${addDaysToISO(today, 7)}">1 semana</button>
        ${!routine && hasDeadline(task) ? `<button type="button" data-sheet-snooze="${NO_DEADLINE}">Sin plazo</button>` : ''}
      </div>
    </div>
    ${completions.length ? `<section class="plant-section"><h3>Historial</h3><div class="plant-history">${completions.map((completion) => `<div class="plant-history-item"><i data-lucide="check"></i><span><strong>${escapeHtml(completion.done_by)}</strong><small>${escapeHtml(timeAgo(completion.done_at))}</small></span></div>`).join('')}</div></section>` : ''}
    <div class="item-footer"><button type="button" class="pill-button" data-sheet-edit-task="${escapeHtml(task.id)}"><i data-lucide="pencil"></i> Editar</button><button type="button" class="link-button is-danger" data-sheet-delete-task="${escapeHtml(task.id)}">Eliminar</button></div>`;
}

const choice = (name, value, label, checked, icon = '') => `<label class="option-toggle"><input type="radio" name="${name}" value="${escapeHtml(value)}" ${checked ? 'checked' : ''} /><span>${icon ? `<i data-lucide="${icon}"></i>` : ''}${escapeHtml(label)}</span></label>`;

function editorMarkup(values = {}, id = null) {
  const today = todayISO();
  const recurrence = values.recurrence || 'none';
  const routine = recurrence !== 'none';
  const due = values.dueDate || values.due_date || (routine ? today : NO_DEADLINE);
  const assignee = values.rotate ? 'rotate' : values.assignee || 'both';
  const priority = values.priority || 'normal';
  const minutes = Number(values.minutes) || 0;
  const list = values.list ?? (id ? '' : activeList);
  const deadlines = [[NO_DEADLINE, 'Sin plazo'], [today, 'Hoy'], [addDaysToISO(today, 1), 'Mañana'], [addDaysToISO(today, 3), 'En 3 días'], [addDaysToISO(today, 7), 'En 1 semana'], [addDaysToISO(today, 30), 'En 1 mes']];
  return `<div class="plant-add-heading"><p class="eyebrow muted">${id ? 'Editar' : 'Nuevo'}</p><h2 id="itemSheetTitle">${id ? escapeHtml(values.title) : '¿Qué hay que hacer?'}</h2></div>
    <form class="item-editor" data-editor="task" ${id ? `data-editor-id="${escapeHtml(id)}"` : ''}>
      <label class="plant-field"><span>Qué</span><input name="title" type="text" maxlength="80" required value="${escapeHtml(values.title || '')}" placeholder="Pagar la factura de la luz" /></label>
      <fieldset class="plant-field"><legend>Tipo</legend><div class="choice-row">${choice('kind', 'once', 'Una vez', !routine, 'circle-check-big')}${choice('kind', 'routine', 'Rutina que se repite', routine, 'repeat')}</div></fieldset>
      <fieldset class="plant-field" data-when="once" ${routine ? 'hidden' : ''}><legend>Plazo</legend><div class="choice-row">${deadlines.map(([date, label]) => `<button type="button" class="option-pill${date === due ? ' is-on' : ''}" data-editor-date="${date}">${label}</button>`).join('')}<input name="dueDate" type="date" value="${due === NO_DEADLINE ? '' : due}" aria-label="Fecha límite" /></div><small class="field-hint">Estará en la lista cada día, con la cuenta atrás, hasta que lo hagas.</small></fieldset>
      <fieldset class="plant-field" data-when="routine" ${routine ? '' : 'hidden'}><legend>Cada cuánto</legend><div class="choice-row">${Object.entries(RECURRENCE_LABELS).filter(([key]) => key !== 'none').map(([key, label]) => choice('recurrence', key, label, recurrence === key || (!routine && key === 'weekly'))).join('')}</div><label class="plant-field"><span>Empieza</span><input name="startDate" type="date" value="${routine ? due : today}" /></label></fieldset>
      <fieldset class="plant-field"><legend>Lista</legend><div class="choice-row">${choice('list', '', 'Sin lista', !list, 'inbox')}${allLists().map((name) => choice('list', name, name, list === name, listIcon(name))).join('')}</div></fieldset>
      <fieldset class="plant-field"><legend>Quién</legend><div class="choice-row">${choice('assignee', 'both', 'Los dos', assignee === 'both', 'users')}${householdPeople.map((person) => choice('assignee', person, person === currentUser ? `${person} (tú)` : person, assignee === person)).join('')}${choice('assignee', 'rotate', 'Por turnos', assignee === 'rotate', 'repeat-2')}</div></fieldset>
      <details class="editor-more"${values.details || priority !== 'normal' || minutes ? ' open' : ''}><summary>Detalles, prioridad y duración</summary>
        <label class="plant-field"><span>Detalles</span><textarea name="details" maxlength="600" rows="2" placeholder="Referencia de la factura, teléfono, dónde está…">${escapeHtml(values.details || '')}</textarea></label>
        <fieldset class="plant-field"><legend>Prioridad</legend><div class="choice-row priority-choices">${Object.entries(PRIORITIES).map(([key, info]) => choice('priority', key, info.label, priority === key, key === 'high' ? 'flag' : key === 'low' ? 'coffee' : '')).join('')}</div></fieldset>
        <fieldset class="plant-field"><legend>¿Cuánto lleva?</legend><div class="choice-row">${choice('minutes', '', 'Sin estimar', !minutes)}${DURATIONS.map((value) => choice('minutes', String(value), minutesLabel(value), minutes === value)).join('')}</div></fieldset>
      </details>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> ${id ? 'Guardar cambios' : 'Apuntar'}</button></div>
    </form>`;
}

function renderItemSheet() {
  const body = document.querySelector('#itemSheetBody');
  if (!openItem || openItem.kind !== 'task') return;
  const task = householdTasks.find((entry) => entry.id === openItem.id);
  if (!task) return closeItemSheet();
  body.innerHTML = taskDetailMarkup(task);
  lucide.createIcons();
}
function openTaskSheet(id) {
  openItem = { kind: 'task', id };
  renderItemSheet();
  showItemSheet();
}
function openEditor(values = {}, id = null) {
  openItem = { kind: 'editor', id };
  document.querySelector('#itemSheetBody').innerHTML = editorMarkup(values, id);
  showItemSheet();
  lucide.createIcons();
  setTimeout(() => document.querySelector('#itemSheetBody input[type="text"]')?.focus({ preventScroll: true }), 300);
}

async function submitEditor(form) {
  const values = Object.fromEntries(new FormData(form));
  const id = form.dataset.editorId;
  const routine = values.kind === 'routine';
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const task = {
    title: values.title,
    details: values.details || '',
    assignee: values.assignee,
    recurrence: routine ? values.recurrence || 'weekly' : 'none',
    dueDate: routine ? values.startDate || todayISO() : values.dueDate || NO_DEADLINE,
    priority: values.priority || 'normal',
    minutes: values.minutes || null,
    list: values.list || null
  };
  const saved = id ? await updateTask(id, task) : await createTask(task);
  button.disabled = false;
  if (!saved) return;
  document.querySelector('#pendingForm').title.value = '';
  renderQuickPreview();
  if (id) {
    openItem = { kind: 'task', id };
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
  const pane = target.closest('[data-pending-pane]');
  if (pane) return setPendingPane(pane.dataset.pendingPane);
  const done = target.closest('[data-task-done]');
  if (done) return completeTask(done.dataset.taskDone);
  const view = target.closest('[data-todo-view]');
  if (view) return setTodoView(view.dataset.todoView);
  const jump = target.closest('[data-todo-view-jump]');
  if (jump) return setTodoView(jump.dataset.todoViewJump);
  const listButton = target.closest('[data-todo-list]');
  if (listButton) return setActiveList(listButton.dataset.todoList);
  if (target.closest('[data-new-list]')) {
    const name = capitalizeFirst(String(window.prompt('Nombre de la lista nueva (por ejemplo: Trabajo, Viaje, Boda…)') || '').trim().slice(0, 30));
    if (!name) return;
    try { localStorage.setItem('umbral-task-lists', JSON.stringify([...new Set([...customLists(), name])])); } catch {}
    showToast(`📋 Lista «${name}» creada. Lo que apuntes ahora irá ahí.`);
    return setActiveList(name);
  }
  const day = target.closest('[data-week-day]');
  if (day) {
    setTodoView('week');
    document.getElementById(`week-${day.dataset.weekDay}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (target.closest('[data-quick-more]')) return openEditor(editorValuesFrom(parseQuickAdd(document.querySelector('#pendingForm').title.value)));
  const preset = target.closest('[data-task-preset]');
  if (preset) {
    const found = TASK_PRESETS.find((entry) => entry.title === preset.dataset.taskPreset);
    return createTask({ ...found, dueDate: todayISO(), list: 'Casa' });
  }
  const task = target.closest('[data-open-task]');
  if (task) return openTaskSheet(task.dataset.openTask);
});

document.querySelector('#tasksView').addEventListener('keydown', (event) => {
  const row = event.target.closest('[data-open-task]');
  if (!row || event.target !== row || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  openTaskSheet(row.dataset.openTask);
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
    return openEditor(task, task.id);
  }
  const deleteTaskButton = target.closest('[data-sheet-delete-task]');
  if (deleteTaskButton && await deleteTask(deleteTaskButton.dataset.sheetDeleteTask)) return closeItemSheet();
  const date = target.closest('[data-editor-date]');
  if (date) {
    const form = date.closest('form');
    form.dueDate.value = date.dataset.editorDate === NO_DEADLINE ? '' : date.dataset.editorDate;
    form.querySelectorAll('[data-editor-date]').forEach((button) => button.classList.toggle('is-on', button === date));
  }
});

itemSheet.addEventListener('change', (event) => {
  const form = event.target.form;
  if (event.target.name === 'dueDate') {
    form.querySelectorAll('[data-editor-date]').forEach((button) => button.classList.toggle('is-on', button.dataset.editorDate === (event.target.value || NO_DEADLINE)));
  }
  if (event.target.name === 'kind') {
    const routine = event.target.value === 'routine';
    form.querySelector('[data-when="once"]').hidden = routine;
    form.querySelector('[data-when="routine"]').hidden = !routine;
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
