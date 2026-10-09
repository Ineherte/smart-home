// Detalles de experiencia que valen para toda la app:
// - Con una ficha o ventana abierta, el fondo no se mueve (y se sabe para pausar animaciones).
// - Las fichas que suben desde abajo se cierran deslizándolas hacia abajo, como en el iPhone.
// - Al cambiar de pestaña, cada una recuerda por dónde ibas; tocar la que ya está abierta sube
//   arriba del todo. La vista nueva entra desde el lado hacia el que vas.
(function () {
  const root = document.documentElement;
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const isOpen = (el) => el.classList.contains('visible');

  // ---------- Ventanas abiertas ----------
  function syncModalState() {
    const open = dialogs.some(isOpen);
    root.dataset.modal = open ? 'open' : 'closed';
    window.umbralModalOpen = open;
  }
  const observer = new MutationObserver(syncModalState);
  dialogs.forEach((dialog) => observer.observe(dialog, { attributes: true, attributeFilter: ['class'] }));
  syncModalState();

  // ---------- Deslizar hacia abajo para cerrar ----------
  // No en el modo Sims (se juega con el dedo), ni en la pizarra (se dibuja) ni en el acceso.
  const SWIPEABLE = '.plant-sheet, .calendar-modal, .weather-modal, .finance-modal, .account-modal';
  const panelOf = (dialog) => dialog.querySelector('.plant-sheet-panel, .calendar-panel, .weather-panel, .finance-panel, .account-panel');
  const closeButtonOf = (dialog) => dialog.querySelector('.plant-sheet-close, [aria-label^="Cerrar"], [data-close-note], [data-close-item]');
  let drag = null;
  document.addEventListener('touchstart', (event) => {
    const dialog = event.target.closest(SWIPEABLE);
    if (!dialog || !isOpen(dialog) || event.touches.length !== 1) return;
    const panel = panelOf(dialog);
    if (!panel || !panel.contains(event.target)) return;
    // Solo si el contenido está arriba del todo (si no, el dedo desplaza la ficha).
    if (panel.scrollTop > 0) return;
    if (event.target.closest('input[type="range"], canvas, textarea, .us-map, .leaflet-container')) return;
    const touch = event.touches[0];
    drag = { dialog, panel, x: touch.clientX, y: touch.clientY, dy: 0, t: performance.now(), active: false };
  }, { passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!drag) return;
    const touch = event.touches[0];
    const dx = touch.clientX - drag.x;
    const dy = touch.clientY - drag.y;
    if (!drag.active) {
      if (dy < 8 || Math.abs(dy) < Math.abs(dx) || drag.panel.scrollTop > 0) { if (Math.abs(dx) > 12 || dy < -8) drag = null; return; }
      drag.active = true;
      drag.panel.style.transition = 'none';
    }
    drag.dy = Math.max(0, dy);
    // Un poco de resistencia, como una goma.
    drag.panel.style.transform = `translateY(${drag.dy < 140 ? drag.dy : 140 + (drag.dy - 140) * 0.5}px)`;
    drag.dialog.style.setProperty('--sheet-fade', String(Math.max(0.35, 1 - drag.dy / 500)));
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (!drag) return;
    const { dialog, panel, dy, t, active } = drag;
    drag = null;
    if (!active) return;
    const speed = dy / Math.max(1, performance.now() - t);
    panel.style.transition = '';
    dialog.style.removeProperty('--sheet-fade');
    if (dy > 130 || speed > 0.6) {
      panel.style.transform = '';
      window.umbralMobile?.tap?.();
      closeButtonOf(dialog)?.click();
    } else {
      panel.style.transform = '';
    }
  });

  // ---------- Número en el icono de la app ----------
  // Lo que corre prisa: lo tuyo con el plazo pasado, de hoy o de mañana, y las rutinas que tocan.
  // El iPhone lo enseña en Umbral instalada desde Safari (con los avisos activados).
  function updateBadge() {
    if (!('setAppBadge' in navigator) || typeof householdTasks === 'undefined') return;
    const urgent = householdTasks.filter((task) => isMine(task) && isPendingNow(task) && (isRoutine(task) || (hasDeadline(task) && daysLeft(task) <= 1))).length;
    (urgent ? navigator.setAppBadge(urgent) : navigator.clearAppBadge()).catch(() => {});
  }
  window.addEventListener('umbral:tasks', updateBadge);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateBadge(); });

  // ---------- Pestañas: memoria del desplazamiento y dirección ----------
  const ORDER = ['home', 'casa', 'nosotros', 'personal'];
  const scrollMemory = {};
  const viewsEl = document.querySelector('.views');
  document.querySelectorAll('.nav-item[data-view-target]').forEach((item) => {
    // Va antes que el de app.js (fase de captura): guarda dónde estabas y decide la dirección.
    item.addEventListener('click', () => {
      const from = document.body.dataset.space || 'home';
      const to = item.dataset.viewTarget;
      window.umbralMobile?.tap?.();
      if (from === to) {
        item.dataset.sameTap = '1';
        return;
      }
      scrollMemory[from] = window.scrollY;
      viewsEl.dataset.dir = ORDER.indexOf(to) >= ORDER.indexOf(from) ? 'forward' : 'back';
    }, true);
    item.addEventListener('click', () => {
      const to = item.dataset.viewTarget;
      if (item.dataset.sameTap) {
        delete item.dataset.sameTap;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // Después de app.js (que sube arriba): vuelve a donde estabas en esa pestaña.
      requestAnimationFrame(() => window.scrollTo({ top: scrollMemory[to] || 0, behavior: 'instant' }));
    });
  });
})();
