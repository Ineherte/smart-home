// Umbral como app de iPhone (Capacitor). En el navegador no hace nada.
// - Avisos de Por hacer con botones: el día antes y el mismo día del plazo (y el día de cada
//   rutina) a las 9:00 llega un aviso con «Hecho ✓» y «Mañana», que funcionan sin abrir la app.
// - Enlaces umbral://abrir/compra (o ?abrir=compra) abren esa sección (los usará el widget).
// - La barra de estado sigue al tema claro u oscuro, y al volver a la app se recargan los datos.
(function () {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const { LocalNotifications, App, StatusBar } = cap.Plugins || {};
  document.documentElement.classList.add('is-native');

  // ---------- Barra de estado ----------
  function syncStatusBar() {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    StatusBar?.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch?.(() => {});
  }
  syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncStatusBar);

  // ---------- Enlaces umbral:// ----------
  function openFromUrl(url) {
    try {
      const parsed = new URL(url);
      const target = parsed.searchParams.get('abrir') || parsed.pathname.replace(/^\/+/, '').split('/').pop() || parsed.host;
      if (target && target !== 'abrir' && typeof openLinkTarget === 'function') openLinkTarget(target);
    } catch {}
  }
  App?.addListener('appUrlOpen', ({ url }) => openFromUrl(url));
  App?.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    // Al volver: datos frescos (lo que haya cambiado tu pareja mientras tanto).
    if (typeof loadTasks === 'function') loadTasks();
    if (typeof renderNotes === 'function') renderNotes();
    if (typeof updateWeather === 'function') updateWeather();
  });

  // ---------- Avisos de Por hacer ----------
  if (!LocalNotifications) return;
  const PREFIX = 7000;
  const AT_HOUR = 9;
  let permission = null;
  async function ensurePermission() {
    if (permission) return permission === 'granted';
    try {
      const current = await LocalNotifications.checkPermissions();
      permission = current.display === 'granted' ? 'granted' : (await LocalNotifications.requestPermissions()).display;
    } catch { permission = 'denied'; }
    return permission === 'granted';
  }
  LocalNotifications.registerActionTypes({
    // Los botones abren Umbral un momento para guardar el cambio (así no se pierde nunca).
    types: [
      { id: 'UMBRAL_TASK', actions: [{ id: 'done', title: 'Hecho ✓', foreground: true }, { id: 'tomorrow', title: 'Mañana', foreground: true }] },
      { id: 'UMBRAL_TASK_EARLY', actions: [{ id: 'done', title: 'Hecho ✓', foreground: true }] }
    ]
  }).catch(() => {});
  // Id numérico estable por tarea y día (para poder borrarlos y volver a crearlos).
  const idFor = (taskId, slot) => PREFIX + (([...String(taskId)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7) % 90000) * 4) + slot;
  const at = (iso, hour = AT_HOUR) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, hour, 0, 0); };

  let scheduleTimer = 0;
  async function scheduleTaskReminders() {
    if (typeof householdTasks === 'undefined' || !(await ensurePermission())) return;
    const now = Date.now();
    const notifications = [];
    householdTasks.filter((task) => isMine(task) && task.active !== false).forEach((task) => {
      const routine = isRoutine(task);
      if (!routine && !hasDeadline(task)) return;
      const slots = routine ? [[task.due_date, 0, `Hoy toca: ${task.title}`]] : [[addDaysToISO(task.due_date, -1), 1, `Mañana vence: ${task.title}`], [task.due_date, 2, `Hoy vence: ${task.title}`]];
      slots.forEach(([day, slot, title]) => {
        const when = at(day);
        if (when.getTime() <= now) return;
        notifications.push({
          id: idFor(task.id, slot),
          title,
          body: routine ? `${RECURRENCE_LABELS[task.recurrence]}${task.assignee !== 'both' ? ` · le toca a ${task.assignee === currentUser ? 'ti' : task.assignee}` : ''}` : task.list ? `Lista ${task.list}` : 'En Umbral · Por hacer',
          schedule: { at: when, allowWhileIdle: true },
          actionTypeId: slot === 1 ? 'UMBRAL_TASK_EARLY' : 'UMBRAL_TASK',
          extra: { taskId: task.id, open: 'pendientes' },
          threadIdentifier: 'umbral-tasks'
        });
      });
    });
    try {
      // Se rehacen los avisos de tareas (los que ya no tocan, desaparecen).
      const pending = await LocalNotifications.getPending();
      const ours = (pending.notifications || []).filter((n) => n.id >= PREFIX && n.id < PREFIX + 400000).map((n) => ({ id: n.id }));
      if (ours.length) await LocalNotifications.cancel({ notifications: ours });
      if (notifications.length) await LocalNotifications.schedule({ notifications: notifications.slice(0, 60) });
    } catch (error) {
      console.warn('[Umbral] Avisos:', error);
    }
  }
  window.addEventListener('umbral:tasks', () => {
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(scheduleTaskReminders, 1500);
  });

  LocalNotifications.addListener('localNotificationActionPerformed', async ({ actionId, notification }) => {
    const taskId = notification?.extra?.taskId;
    if (taskId && actionId === 'done' && typeof completeTask === 'function') return completeTask(taskId);
    if (taskId && actionId === 'tomorrow' && typeof snoozeTask === 'function') return snoozeTask(taskId, addDaysToISO(todayISO(), 1));
    if (typeof openLinkTarget === 'function') openLinkTarget(notification?.extra?.open || 'pendientes');
  });
})();
