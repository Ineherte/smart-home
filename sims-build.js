// Modo construcción del modo Sims: mover muebles por la casa.
// Se entra desde 🎨 Decorar → «Mover muebles». Tocas un mueble (se ilumina) y luego tocas dónde
// lo quieres; si cabe, se queda ahí y lo ve también tu pareja. Lo que se puede mover está en
// simsWorld.MOVABLE (los muebles de la tienda y algunos sueltos), y la posición se guarda en la
// decoración (decor.place), que ya se sincroniza y se guarda en look.
(function () {
  const $house = () => document.querySelector('#simsHouse');
  const LABELS = {
    guitar: '🎸 Guitarra', beanbag: '🛋️ Puf', easel: '🎨 Caballete', telescope: '🔭 Telescopio', aquarium: '🐠 Acuario',
    arcade: '🕹️ Recreativa', armchair: '🪑 Sillón', sidetable: '🪴 Mesita', olivetree: '🫒 Olivo'
  };
  const state = { on: false, selected: null };
  const snap = (value) => Math.round(value / 4) * 4;
  const visible = (id) => !simsWorld.SHOP_ITEMS.includes(id) || simsWorld.owns(id);
  const movableHere = () => simsWorld.MOVABLE.filter(visible);

  function bar() {
    const house = $house();
    if (!house) return;
    let el = house.querySelector('.sims-build');
    if (!state.on) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'sims-build';
      house.appendChild(el);
    }
    const sel = state.selected;
    const moved = sel && (simsWorld.getDecor().place?.[sel]);
    el.innerHTML = `<div class="sims-build-copy"><b>🔨 Modo construcción</b><span>${sel ? `${escapeHtml(LABELS[sel] || sel)}: toca dónde lo quieres` : 'Toca un mueble con borde para moverlo'}</span></div>
      <div class="sims-build-actions">${moved ? '<button type="button" data-build="reset">↺ A su sitio</button>' : ''}<button type="button" data-build="done" class="is-done">Listo</button></div>`;
  }
  function highlight() {
    const w = world();
    if (!w) return;
    w.state.buildMode = state.on ? movableHere().map((id) => simsWorld.objectInfo(id)?.hit).filter(Boolean) : null;
    w.state.selected = state.selected ? simsWorld.objectInfo(state.selected)?.hit || null : null;
  }
  function start() {
    if (curScene() !== 'house') return showToast('Los muebles se mueven en casa 🏠');
    hidePie();
    $house()?.querySelector('.sims-card')?.remove();
    state.on = true;
    state.selected = null;
    bar();
    highlight();
    simTune([523, 659], 80, 'triangle');
  }
  function stop() {
    state.on = false;
    state.selected = null;
    bar();
    highlight();
  }
  function place(id, dx, dy) {
    const current = simsWorld.getDecor().place || {};
    const next = { ...current };
    if (dx || dy) next[id] = { dx, dy };
    else delete next[id];
    setDecorChoice('place', next);
    const info = simsWorld.objectInfo(id);
    if (info?.hit) world()?.emit('puff', info.hit[0] + info.hit[2] / 2, info.hit[1] + info.hit[3], { count: 8, spread: 18, vy: -8 });
    simTune([660, 880], 70, 'triangle');
  }
  // Un toque en la casa durante el modo construcción.
  function tap(event) {
    const w = world();
    if (!w) return;
    const point = w.toWorld(event.clientX, event.clientY);
    const id = w.objectAt(point.x, point.y);
    if (!state.selected) {
      if (id && movableHere().includes(id)) {
        state.selected = id;
        simBlip(1320, 0.05);
      } else if (id) {
        showToast('Ese mueble va fijo. Se mueven los que tienen borde ✨');
      }
      bar();
      highlight();
      return;
    }
    if (id === state.selected) {
      state.selected = null;
      bar();
      highlight();
      return;
    }
    // Si tocas otro mueble movible, pasas a ese.
    if (id && movableHere().includes(id)) {
      state.selected = id;
      bar();
      highlight();
      return;
    }
    const info = simsWorld.objectInfo(state.selected);
    const base = info.base.block || info.base.hit;
    const dx = snap(point.x - (base[0] + base[2] / 2));
    const dy = snap(point.y - (base[1] + base[3] / 2));
    if (!simsWorld.canPlace(state.selected, dx, dy)) {
      simBlip(220, 0.08, 'square');
      w.state.marker = { x: point.x, y: point.y, t0: performance.now(), bad: true };
      return showToast('Ahí no cabe: tiene que quedar dentro de una habitación y sin tapar puertas ni muebles');
    }
    place(state.selected, dx, dy);
    state.selected = null;
    bar();
    highlight();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.sims-build [data-build]');
    if (!button) return;
    if (button.dataset.build === 'done') { stop(); showToast('🏡 ¡Casa colocada!'); }
    if (button.dataset.build === 'reset' && state.selected) { place(state.selected, 0, 0); state.selected = null; bar(); highlight(); }
  });
  // Al cambiar algo de la decoración (también si lo mueve tu pareja), los bordes se recolocan.
  window.addEventListener('umbral:avatars', () => { if (state.on) highlight(); });

  window.simsBuild = { start, stop, tap, isOn: () => state.on, refresh: () => { if (state.on) { bar(); highlight(); } } };
})();
