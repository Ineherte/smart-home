// Estado de la casa en Inicio: un resumen claro de lo que está abierto (tareas, compra,
// plantas, cuentas, notas urgentes), lo de hoy (comidas y agenda) y lo próximo. Cada fila
// lleva a su sección. Se repinta cuando cambian los datos (app.js avisa) y cada minuto.
(function () {
  const host = () => document.querySelector('#houseSummary');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function rows() {
    const att = typeof attentionState !== 'undefined' ? attentionState : {};
    const day = typeof daySummaryState !== 'undefined' ? daySummaryState : {};
    const list = [];
    const tasks = day.tasks || 0;
    const overdue = att.overdueTasks || 0;
    list.push({
      id: 'tasks', icon: 'list-checks', label: 'Tareas',
      value: overdue ? plural(overdue, 'atrasada', 'atrasadas') : tasks ? plural(tasks, 'para hoy', 'para hoy') : 'Al día',
      detail: overdue && tasks ? `y ${plural(tasks, 'para hoy', 'para hoy')}` : overdue ? 'Toca ponerse al día' : tasks ? 'Pendientes de hoy' : 'Nada pendiente hoy',
      tone: overdue ? 'warn' : tasks ? 'open' : 'ok',
      chip: overdue ? plural(overdue, 'tarea atrasada', 'tareas atrasadas') : plural(tasks, 'tarea hoy', 'tareas hoy')
    });
    const urgent = att.urgentCount || 0;
    if (urgent) list.push({ id: 'notes', icon: 'siren', label: 'Notas urgentes', value: plural(urgent, 'urgente', 'urgentes'), detail: 'Revisar en Pendientes', tone: 'alert', chip: plural(urgent, 'nota urgente', 'notas urgentes') });
    const thirsty = att.thirstyPlants || [];
    const toWater = Math.max(thirsty.length, day.plants || 0);
    list.push({
      id: 'plants', icon: 'sprout', label: 'Plantas',
      value: toWater ? plural(toWater, 'con sed', 'con sed') : 'Regadas',
      detail: thirsty.length ? thirsty.slice(0, 3).join(', ') : toWater ? 'Toca regar hoy' : 'Ninguna pide agua',
      tone: toWater ? 'warn' : 'ok',
      chip: plural(toWater, 'planta con sed', 'plantas con sed')
    });
    const shopping = day.shopping || 0;
    list.push({ id: 'shopping', icon: 'shopping-basket', label: 'Compra', value: shopping ? plural(shopping, 'cosa', 'cosas') : 'Lista vacía', detail: shopping ? 'Por comprar' : 'No falta nada', tone: shopping ? 'open' : 'ok', chip: `${shopping} en la compra` });
    const bills = att.pendingBills || 0;
    const owed = att.settlementAmount || 0;
    const money = typeof financeMoney === 'function' ? financeMoney : (n) => `${n.toFixed(2)} €`;
    list.push({
      id: 'finance', icon: 'wallet', label: 'Cuentas',
      value: bills ? plural(bills, 'factura', 'facturas') : owed > 0.009 ? money(owed) : 'Al día',
      detail: bills ? `pendiente${bills === 1 ? '' : 's'}${owed > 0.009 ? ` · falta saldar ${money(owed)}` : ''}` : owed > 0.009 ? 'Falta saldar' : 'Nada que compensar',
      tone: bills ? 'warn' : owed > 0.009 ? 'open' : 'ok',
      chip: bills ? plural(bills, 'factura pendiente', 'facturas pendientes') : `Saldar ${money(owed)}`
    });
    const meals = [day.lunch ? `Comida: ${day.lunch}` : '', day.dinner ? `Cena: ${day.dinner}` : ''].filter(Boolean);
    list.push({ id: 'menu', icon: 'chef-hat', label: 'Hoy se come', value: meals.length ? (day.dinner || day.lunch) : 'Sin planificar', detail: meals.length ? meals.join(' · ') : 'Planifica el menú en Cocina', tone: meals.length ? 'ok' : 'info', wide: true });
    const upkeep = typeof window.upkeepDueItems === 'function' ? window.upkeepDueItems() : [];
    if (upkeep.length) list.push({ id: 'upkeep', icon: 'wrench', label: 'Casa al día', value: plural(upkeep.length, 'cosa', 'cosas'), detail: upkeep.slice(0, 2).map((item) => item.title).join(', '), tone: 'warn', chip: upkeep.length === 1 ? upkeep[0].title : plural(upkeep.length, 'cosa de mantenimiento', 'cosas de mantenimiento') });
    const events = day.events || 0;
    if (events) list.push({ id: 'agenda', icon: 'calendar-days', label: 'Agenda', value: plural(events, 'evento', 'eventos'), detail: 'Hoy', tone: 'info' });
    if (day.countdown) list.push({ id: 'dates', icon: 'calendar-heart', label: 'Lo próximo', value: day.countdown, detail: 'Fechas de Nosotros', tone: 'info', wide: true });
    return list;
  }

  // Versión compacta: una línea con el estado y solo las cosas abiertas, como etiquetas.
  function render() {
    const el = host();
    if (!el) return;
    const list = rows();
    const open = list.filter((row) => ['warn', 'alert', 'open'].includes(row.tone));
    const state = list.some((row) => row.tone === 'alert') ? 'alert' : open.some((row) => row.tone === 'warn') ? 'warn' : open.length ? 'open' : 'ok';
    const title = state === 'ok' ? 'Todo en orden en casa' : open.length === 1 ? 'Una cosa por resolver' : `${open.length} cosas por resolver`;
    const key = JSON.stringify([title, open]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.className = `house-summary is-${state}`;
    el.innerHTML = `<div class="hs-line"><span class="hs-mark"><i data-lucide="${state === 'ok' ? 'circle-check' : state === 'alert' ? 'siren' : 'house'}"></i></span><strong>${escapeHtml(title)}</strong></div>
      ${open.length ? `<div class="hs-chips">${open.map((row) => `<button type="button" class="hs-chip is-${row.tone}" data-hs="${row.id}"><i data-lucide="${row.icon}"></i>${escapeHtml(row.chip || row.value)}</button>`).join('')}</div>` : ''}`;
    if (window.lucide) lucide.createIcons();
  }

  document.addEventListener('click', (event) => {
    const row = event.target.closest('#houseSummary [data-hs]');
    if (!row) return;
    const go = {
      tasks: () => openPending({ filter: 'all' }),
      notes: () => openPending({ filter: 'all' }),
      plants: () => showView('plantas'),
      shopping: () => showView('compra'),
      finance: () => openFinance(),
      menu: () => showView('menu'),
      agenda: () => openCalendar(),
      upkeep: () => { showView('personal'); setTimeout(() => document.querySelector('#upkeepSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); },
      dates: () => { showView('nosotros'); if (typeof setUsView === 'function') setUsView('dates'); }
    }[row.dataset.hs];
    try { go?.(); } catch (error) { console.warn('[Umbral] Resumen:', error); }
  });

  window.renderHouseSummary = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  setInterval(render, 60 * 1000);
})();
