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
      tone: overdue ? 'warn' : tasks ? 'open' : 'ok'
    });
    const urgent = att.urgentCount || 0;
    if (urgent) list.push({ id: 'notes', icon: 'siren', label: 'Notas urgentes', value: plural(urgent, 'urgente', 'urgentes'), detail: 'Revisar en Pendientes', tone: 'alert' });
    const thirsty = att.thirstyPlants || [];
    const toWater = Math.max(thirsty.length, day.plants || 0);
    list.push({
      id: 'plants', icon: 'sprout', label: 'Plantas',
      value: toWater ? plural(toWater, 'con sed', 'con sed') : 'Regadas',
      detail: thirsty.length ? thirsty.slice(0, 3).join(', ') : toWater ? 'Toca regar hoy' : 'Ninguna pide agua',
      tone: toWater ? 'warn' : 'ok'
    });
    const shopping = day.shopping || 0;
    list.push({ id: 'shopping', icon: 'shopping-basket', label: 'Compra', value: shopping ? plural(shopping, 'cosa', 'cosas') : 'Lista vacía', detail: shopping ? 'Por comprar' : 'No falta nada', tone: shopping ? 'open' : 'ok' });
    const bills = att.pendingBills || 0;
    const owed = att.settlementAmount || 0;
    const money = typeof financeMoney === 'function' ? financeMoney : (n) => `${n.toFixed(2)} €`;
    list.push({
      id: 'finance', icon: 'wallet', label: 'Cuentas',
      value: bills ? plural(bills, 'factura', 'facturas') : owed > 0.009 ? money(owed) : 'Al día',
      detail: bills ? `pendiente${bills === 1 ? '' : 's'}${owed > 0.009 ? ` · falta saldar ${money(owed)}` : ''}` : owed > 0.009 ? 'Falta saldar' : 'Nada que compensar',
      tone: bills ? 'warn' : owed > 0.009 ? 'open' : 'ok'
    });
    const meals = [day.lunch ? `Comida: ${day.lunch}` : '', day.dinner ? `Cena: ${day.dinner}` : ''].filter(Boolean);
    list.push({ id: 'menu', icon: 'chef-hat', label: 'Hoy se come', value: meals.length ? (day.dinner || day.lunch) : 'Sin planificar', detail: meals.length ? meals.join(' · ') : 'Planifica el menú en Cocina', tone: meals.length ? 'ok' : 'info', wide: true });
    const events = day.events || 0;
    if (events) list.push({ id: 'agenda', icon: 'calendar-days', label: 'Agenda', value: plural(events, 'evento', 'eventos'), detail: 'Hoy', tone: 'info' });
    if (day.countdown) list.push({ id: 'dates', icon: 'calendar-heart', label: 'Lo próximo', value: day.countdown, detail: 'Fechas de Nosotros', tone: 'info', wide: true });
    return list;
  }

  function render() {
    const el = host();
    if (!el) return;
    const list = rows();
    const open = list.filter((row) => ['warn', 'alert', 'open'].includes(row.tone));
    const serious = list.filter((row) => ['warn', 'alert'].includes(row.tone));
    const state = list.some((row) => row.tone === 'alert') ? 'alert' : serious.length ? 'warn' : open.length ? 'open' : 'ok';
    const title = { ok: 'Todo en orden', open: 'Casi todo en orden', warn: 'Hay cosas por resolver', alert: 'Algo urgente' }[state];
    const lead = state === 'ok'
      ? 'No hay nada pendiente. Disfrutad de la casa.'
      : `${plural(open.length, 'punto abierto', 'puntos abiertos')}: ${open.map((row) => `${row.label.toLowerCase()} (${row.value.toLowerCase()})`).join(', ')}.`;
    const key = JSON.stringify([title, lead, list]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.className = `house-summary is-${state}`;
    el.innerHTML = `
      <header class="hs-head">
        <span class="hs-mark"><i data-lucide="${{ ok: 'house-heart', open: 'house', warn: 'clipboard-list', alert: 'siren' }[state]}"></i></span>
        <div><p class="eyebrow">Estado de la casa</p><h2>${escapeHtml(title)}</h2></div>
        <span class="hs-pill">${open.length ? plural(open.length, 'abierto', 'abiertos') : 'Al día'}</span>
      </header>
      <p class="hs-lead">${escapeHtml(lead)}</p>
      <div class="hs-grid">${list.map((row) => `<button type="button" class="hs-row is-${row.tone}${row.wide ? ' is-wide' : ''}" data-hs="${row.id}">
        <span class="hs-icon"><i data-lucide="${row.icon}"></i></span>
        <span class="hs-text"><small>${escapeHtml(row.label)}</small><strong>${escapeHtml(row.value)}</strong><em>${escapeHtml(row.detail)}</em></span>
      </button>`).join('')}</div>`;
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
      dates: () => { showView('nosotros'); if (typeof setUsView === 'function') setUsView('dates'); }
    }[row.dataset.hs];
    try { go?.(); } catch (error) { console.warn('[Umbral] Resumen:', error); }
  });

  window.renderHouseSummary = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  setInterval(render, 60 * 1000);
})();
