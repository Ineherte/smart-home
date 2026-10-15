// Inicio → «Para hoy»: lo que importa hoy en un solo sitio, y que se puede hacer desde aquí:
// marcar tareas como hechas, regar una planta, ver los planes con su hora, el menú, las cuentas
// pendientes y lo próximo. Sustituye a los resúmenes repetidos de antes.
// Usa los datos de tasks.js, plants.js, app.js (agenda, cuentas, resumen del día) y upkeep.js.
(function () {
  const host = document.querySelector('#todayPlan');
  if (!host) return;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const money = (value) => (typeof financeMoney === 'function' ? financeMoney(value) : `${Number(value).toFixed(2)} €`);
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

  function taskBadge(task) {
    if (isRoutine(task)) return { text: task.due_date < todayISO() ? 'Rutina atrasada' : 'Rutina de hoy', tone: task.due_date < todayISO() ? 'late' : 'today' };
    const left = daysLeft(task);
    if (left < 0) return { text: left === -1 ? 'Venció ayer' : `Venció hace ${-left} días`, tone: 'late' };
    return { text: 'Vence hoy', tone: 'today' };
  }
  const whoChip = (task) => (task.assignee && task.assignee !== 'both' ? `<span class="today-who" title="${escapeHtml(task.assignee)}">${escapeHtml(initialsOf(task.assignee))}</span>` : '');

  function data() {
    const today = todayISO();
    const tasks = safe(() => householdTasks.filter((task) => task.active !== false && isPendingNow(task) && (isRoutine(task) || (hasDeadline(task) && task.due_date <= today)))
      .sort((a, b) => (isMine(b) - isMine(a)) || String(a.due_date).localeCompare(String(b.due_date))), []);
    const doneToday = safe(() => taskCompletions.filter((entry) => entry.done_at && dateToISO(new Date(entry.done_at)) === today).length, 0);
    const events = safe(() => cachedEvents.filter((event) => normalizeEventDate(event.event_date) === today).sort((a, b) => String(a.event_time || '').localeCompare(String(b.event_time || ''))), []);
    const plants = safe(() => householdPlants.filter((plant) => plant.active !== false && plant.next_water_on && plant.next_water_on <= today), []);
    const day = typeof daySummaryState !== 'undefined' ? daySummaryState : {};
    const upkeep = safe(() => (typeof window.upkeepDueItems === 'function' ? window.upkeepDueItems() : []), []);
    const settlement = safe(() => (financeCache?.loaded ? settlementWithReset(financeCache) : null), null);
    return { tasks, doneToday, events, plants, day, upkeep, settlement };
  }

  function render() {
    const { tasks, doneToday, events, plants, day, upkeep, settlement } = data();
    const pending = tasks.length + plants.length;
    const total = pending + doneToday;
    const progress = total ? doneToday / total : 1;
    const sections = [];

    if (tasks.length) {
      sections.push(`<div class="today-group"><p class="today-label"><i data-lucide="list-checks"></i> Por hacer</p>
        ${tasks.slice(0, 5).map((task) => {
          const badge = taskBadge(task);
          return `<div class="today-row" data-task-row="${escapeHtml(task.id)}">
            <button type="button" class="today-check" data-today-done="${escapeHtml(task.id)}" aria-label="Hecho: ${escapeHtml(task.title)}"><i data-lucide="check"></i></button>
            <button type="button" class="today-copy" data-today-open="tasks"><strong>${escapeHtml(task.title)}</strong><small class="is-${badge.tone}">${escapeHtml(badge.text)}</small></button>
            ${whoChip(task)}
          </div>`;
        }).join('')}
        ${tasks.length > 5 ? `<button type="button" class="today-more" data-today-open="tasks">Ver ${plural(tasks.length - 5, 'más', 'más')}</button>` : ''}
      </div>`);
    }
    if (plants.length) {
      sections.push(`<div class="today-group"><p class="today-label"><i data-lucide="droplets"></i> Plantas con sed</p>
        ${plants.slice(0, 4).map((plant) => `<div class="today-row">
          <span class="today-dot is-plant"><i data-lucide="sprout"></i></span>
          <button type="button" class="today-copy" data-today-open="plantas"><strong>${escapeHtml(plant.name)}</strong><small class="${plant.next_water_on < todayISO() ? 'is-late' : 'is-today'}">${plant.next_water_on < todayISO() ? 'Lleva días esperando agua' : 'Toca regar hoy'}</small></button>
          <button type="button" class="today-action" data-today-water="${escapeHtml(plant.id)}"><i data-lucide="droplet"></i> Regar</button>
        </div>`).join('')}
      </div>`);
    }
    if (events.length) {
      sections.push(`<div class="today-group"><p class="today-label"><i data-lucide="calendar-days"></i> Planes</p>
        ${events.slice(0, 4).map((event) => `<button type="button" class="today-row is-link" data-today-open="calendar">
          <span class="today-time">${event.event_time && event.event_time !== '00:00' ? escapeHtml(String(event.event_time).slice(0, 5)) : 'Todo el día'}</span>
          <span class="today-copy"><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.location || (event.source === 'iphone' ? 'Calendario del iPhone' : event.scope === 'shared' ? 'Los dos' : 'Solo tú'))}</small></span>
          <i data-lucide="chevron-right" class="today-chevron"></i>
        </button>`).join('')}
      </div>`);
    }
    const meals = [day.lunch ? ['Comida', day.lunch] : null, day.dinner ? ['Cena', day.dinner] : null].filter(Boolean);
    const extras = [];
    if (meals.length) extras.push(`<button type="button" class="today-pill" data-today-open="menu"><i data-lucide="chef-hat"></i><span>${meals.map(([when, what]) => `<b>${when}:</b> ${escapeHtml(what)}`).join(' · ')}</span></button>`);
    if (settlement && settlement.amount >= 0.01) {
      const text = settlement.debtor === currentUser ? `Le debes ${money(settlement.amount)} a ${settlement.creditor}` : settlement.creditor === currentUser ? `${settlement.debtor} te debe ${money(settlement.amount)}` : `${settlement.debtor} debe ${money(settlement.amount)}`;
      extras.push(`<button type="button" class="today-pill" data-today-open="finance"><i data-lucide="wallet"></i><span>${escapeHtml(text)}</span></button>`);
    }
    if (upkeep.length) extras.push(`<button type="button" class="today-pill" data-today-open="upkeep"><i data-lucide="wrench"></i><span>${escapeHtml(upkeep.length === 1 ? upkeep[0].title : plural(upkeep.length, 'cosa de mantenimiento', 'cosas de mantenimiento'))}</span></button>`);
    if (day.countdown) extras.push(`<button type="button" class="today-pill is-soft" data-today-open="dates"><i data-lucide="calendar-heart"></i><span>${escapeHtml(day.countdown)}</span></button>`);

    const title = pending ? (pending === 1 ? 'Una cosa para hoy' : `${pending} cosas para hoy`) : doneToday ? '¡Todo hecho por hoy!' : 'Nada pendiente hoy';
    const subtitle = doneToday ? `${plural(doneToday, 'hecha', 'hechas')} hoy · ¡bien!` : pending ? 'Marca lo que vayas haciendo' : 'Disfrutad del día ✨';
    const ring = 2 * Math.PI * 17;
    const html = `
      <div class="today-head">
        <span class="today-ring-wrap" aria-hidden="true"><svg class="today-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" class="track"></circle><circle cx="20" cy="20" r="17" class="fill" stroke-dasharray="${ring}" stroke-dashoffset="${ring * (1 - progress)}"></circle></svg><b>${pending || '✓'}</b></span>
        <div><p class="eyebrow">Para hoy</p><h2>${escapeHtml(title)}</h2><small>${escapeHtml(subtitle)}</small></div>
      </div>
      ${sections.join('') || '<p class="today-empty">Sin tareas, plantas ni planes pendientes. Si se os ocurre algo, díselo al asistente.</p>'}
      ${extras.length ? `<div class="today-pills">${extras.join('')}</div>` : ''}`;
    // El saludo de arriba, con las mismas cuentas que la tarjeta (sin repetir el detalle).
    const summary = document.querySelector('#daySummary');
    if (summary) {
      const bits = [];
      if (pending) bits.push(`<b>${plural(pending, 'cosa', 'cosas')}</b> para hoy`);
      if (events.length) bits.push(`<b>${plural(events.length, 'plan', 'planes')}</b>`);
      const shopping = day.shopping || 0;
      const line = bits.length ? `Tienes ${bits.join(' y ')}.` : doneToday ? '¡Todo hecho por hoy! 🎉' : 'Hoy no tienes nada pendiente. Disfrutad del día.';
      const text = `${line}${shopping ? ` En la compra hay <b>${plural(shopping, 'cosa', 'cosas')}</b>.` : ''}`;
      if (summary.innerHTML !== text) summary.innerHTML = text;
    }
    if (host.dataset.html === html) return;
    host.dataset.html = html;
    host.innerHTML = html;
    lucide.createIcons();
  }

  host.addEventListener('click', async (event) => {
    const done = event.target.closest('[data-today-done]');
    if (done) {
      done.disabled = true;
      done.closest('.today-row')?.classList.add('is-done');
      await completeTask(done.dataset.todayDone);
      return render();
    }
    const water = event.target.closest('[data-today-water]');
    if (water) {
      water.disabled = true;
      water.closest('.today-row')?.classList.add('is-done');
      await waterPlant(water.dataset.todayWater);
      return render();
    }
    const open = event.target.closest('[data-today-open]');
    if (!open) return;
    const go = {
      tasks: () => openPending({ filter: 'all' }),
      plantas: () => showView('plantas'),
      calendar: () => openCalendar(),
      menu: () => showView('menu'),
      finance: () => openFinance(),
      upkeep: () => { showView('personal'); setTimeout(() => document.querySelector('#upkeepSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); },
      dates: () => { showView('nosotros'); if (typeof setUsView === 'function') setUsView('dates'); }
    }[open.dataset.todayOpen];
    try { go?.(); } catch (error) { console.warn('[Umbral] Para hoy:', error); }
  });

  // Se repinta cuando la app avisa de cambios (tareas, plantas, agenda, cuentas…).
  const previous = window.renderHouseSummary;
  window.renderHouseSummary = () => { previous?.(); render(); };
  ['umbral:tasks', 'umbral:life', 'umbral:energy'].forEach((name) => window.addEventListener(name, () => setTimeout(render, 50)));
  document.addEventListener('umbral:ready', () => setTimeout(render, 300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(render, 60 * 1000);
  render();
  window.renderToday = render;
})();
