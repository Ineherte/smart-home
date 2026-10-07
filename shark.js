// El tiburón de Inicio: nada en su pecera y su ánimo refleja cómo está la casa.
// Feliz si todo está en orden, preocupado si hay cosas urgentes, con sed si las plantas la
// tienen, ajetreado con tareas pendientes, hambriento con la compra larga, de fiesta en
// cumpleaños y aniversarios, y dormido por la noche. Dibujado a mano en canvas (sin imágenes).
(function () {
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  // Qué le pasa a la casa (lo leen de app.js, Cocina, Plantas, Nosotros y los muñecos).
  function readHouse() {
    const att = typeof attentionState !== 'undefined' ? attentionState : {};
    const day = typeof daySummaryState !== 'undefined' ? daySummaryState : {};
    const hour = new Date().getHours();
    let celebration = '';
    try {
      const next = typeof upcomingDates === 'function' ? upcomingDates()[0] : null;
      if (next && next.days === 0 && ['birthday', 'anniversary'].includes(next.entry.kind)) celebration = next.entry.title;
    } catch {}
    return {
      urgent: (att.urgentCount || 0) + (att.pendingBills || 0),
      overdue: att.overdueTasks || 0,
      thirsty: (att.thirstyPlants || []).length,
      tasks: day.tasks || 0,
      shopping: day.shopping || 0,
      night: hour >= 23 || hour < 7,
      celebration
    };
  }
  function moodOf(h) {
    if (h.celebration) return { id: 'party', text: `¡Fiesta! ${h.celebration} 🎉`, speed: 1.2 };
    if (h.night) return { id: 'sleep', text: 'Zzz… la casa duerme. Buenas noches, tiburones 🌙', speed: 0.25 };
    if (h.urgent >= 2 || h.overdue >= 3) return { id: 'worried', text: `Algo inquieto: ${[h.urgent ? `${h.urgent} asunto${h.urgent === 1 ? '' : 's'} urgente${h.urgent === 1 ? '' : 's'}` : '', h.overdue ? `${h.overdue} tarea${h.overdue === 1 ? '' : 's'} atrasada${h.overdue === 1 ? '' : 's'}` : ''].filter(Boolean).join(' y ')}`, speed: 1.15 };
    if (h.thirsty) return { id: 'thirsty', text: h.thirsty === 1 ? 'Una planta tiene sed… y el tiburón lo nota 🌱' : `${h.thirsty} plantas tienen sed 🌱`, speed: 0.8 };
    if (h.shopping >= 8) return { id: 'hungry', text: `Hambriento: ${h.shopping} cosas en la compra 🛒`, speed: 1.35 };
    if (h.tasks || h.urgent || h.overdue) return { id: 'busy', text: `Ajetreado: ${h.tasks + h.overdue} tarea${h.tasks + h.overdue === 1 ? '' : 's'} para hoy. ¡Ánimo!`, speed: 1 };
    return { id: 'happy', text: 'Todo en orden. El tiburón nada feliz 🦈', speed: 0.9 };
  }

  function create(host) {
    host.innerHTML = '<canvas class="shark-canvas" aria-hidden="true"></canvas><p class="shark-caption" aria-live="polite"></p>';
    const canvas = host.querySelector('canvas');
    const caption = host.querySelector('.shark-caption');
    const c = canvas.getContext('2d');
    let W = 320;
    let H = 120;
    let dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(3, window.devicePixelRatio || 1);
      W = Math.max(200, rect.width);
      H = Math.max(90, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();

    let mood = moodOf(readHouse());
    caption.textContent = mood.text;
    const shark = { x: W * 0.3, y: H * 0.5, dir: 1, turn: 1, phase: 0, blinkAt: 0, blinkUntil: 0, flipUntil: 0, chompUntil: 0 };
    const bubbles = [];
    const fish = [];
    const hearts = [];
    const confetti = [];
    let last = 0;
    let raf = 0;
    let visible = true;
    let targetY = H * 0.5;

    // ---------- Fondo: agua con luz, rayos, arena y algas ----------
    function drawWater(t) {
      const night = mood.id === 'sleep';
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, night ? '#1d3557' : '#8fd8e8');
      g.addColorStop(0.55, night ? '#16294a' : '#3fa8c8');
      g.addColorStop(1, night ? '#0e1c36' : '#1f6f9a');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // Rayos de luz que bajan desde la superficie.
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i += 1) {
        const x0 = ((i * 97 + t * 0.012) % (W + 120)) - 60;
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `rgba(255,255,255,${night ? 0.05 : 0.14})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = grad;
        c.beginPath();
        c.moveTo(x0, 0);
        c.lineTo(x0 + 26, 0);
        c.lineTo(x0 + 70, H);
        c.lineTo(x0 + 30, H);
        c.closePath();
        c.fill();
      }
      c.restore();
      // Reflejos de la superficie (cáusticas).
      c.strokeStyle = `rgba(255,255,255,${night ? 0.08 : 0.22})`;
      c.lineWidth = 1.2;
      for (let row = 0; row < 3; row += 1) {
        c.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = 6 + row * 7 + Math.sin(x / 23 + t / 700 + row) * 2.2;
          if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
      if (night) {
        c.fillStyle = 'rgba(246,240,200,.18)';
        c.beginPath();
        c.ellipse(W * 0.82, 10, 16, 4, 0, 0, TAU);
        c.fill();
      }
      // Arena con ondas, conchas y algas que se mecen.
      const sand = c.createLinearGradient(0, H - 18, 0, H);
      sand.addColorStop(0, night ? '#4a4a5a' : '#e9d3a0');
      sand.addColorStop(1, night ? '#3a3a48' : '#d4b77c');
      c.fillStyle = sand;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) c.lineTo(x, H - 12 - Math.sin(x / 40) * 3 - Math.sin(x / 17) * 1.2);
      c.lineTo(W, H);
      c.fill();
      [[0.12, '#f49ab0'], [0.47, '#fff3e0'], [0.74, '#f2a33a']].forEach(([fx, col]) => {
        c.fillStyle = night ? '#6a6a7a' : col;
        c.beginPath();
        c.ellipse(W * fx, H - 7, 4, 2.5, 0, Math.PI, TAU);
        c.fill();
      });
      [0.06, 0.2, 0.62, 0.9].forEach((fx, i) => {
        const bx = W * fx;
        c.strokeStyle = night ? '#2f5a4a' : i % 2 ? '#3f9a5f' : '#2f8a52';
        c.lineWidth = 3;
        c.lineCap = 'round';
        for (let k = 0; k < 3; k += 1) {
          c.beginPath();
          c.moveTo(bx + k * 4, H - 10);
          const sway = Math.sin(t / 900 + i + k) * 5;
          c.quadraticCurveTo(bx + k * 4 + sway, H - 26, bx + k * 4 + sway * 1.6, H - 38 - k * 5);
          c.stroke();
        }
      });
    }

    // ---------- El tiburón: cuerpo que ondula, aletas, cola, ojo y boca ----------
    function drawShark(t, dt) {
      const L = Math.min(W * 0.36, 130);
      const thick = L * 0.2;
      const swim = mood.id === 'sleep' ? 0.6 : mood.id === 'hungry' || mood.id === 'worried' ? 1.6 : 1.1;
      shark.phase += dt * 6 * swim;
      // Columna: del morro (s=0) a la cola (s=1); la cola ondula más que la cabeza.
      const N = 18;
      const spine = [];
      for (let i = 0; i <= N; i += 1) {
        const s = i / N;
        const amp = (s ** 1.8) * thick * 0.55;
        spine.push({ x: -s * L, y: Math.sin(shark.phase - s * 4) * amp });
      }
      const profile = (s) => (s < 0.12 ? Math.sqrt(s / 0.12) * 0.82 : s < 0.38 ? lerp(0.82, 1, (s - 0.12) / 0.26) : lerp(1, 0.16, ease((s - 0.38) / 0.62))) * thick;
      c.save();
      c.translate(shark.x, shark.y);
      // Al llegar al borde se da la vuelta (se «aplasta» y gira, como en 3D).
      const flip = t < shark.flipUntil ? Math.sin(((shark.flipUntil - t) / 900) * TAU) * 0.25 : 0;
      c.rotate(flip + Math.sin(t / 1300) * 0.04);
      c.scale(shark.turn, 1);
      const top = [];
      const bottom = [];
      spine.forEach((p, i) => {
        const s = i / N;
        const next = spine[Math.min(N, i + 1)];
        const prev = spine[Math.max(0, i - 1)];
        // Dirección hacia el morro (+x), para que «arriba» sea de verdad el lomo.
        const ang = Math.atan2(prev.y - next.y, prev.x - next.x);
        const w = profile(s);
        top.push({ x: p.x + Math.sin(ang) * w * 0.95, y: p.y - Math.cos(ang) * w * 0.95 });
        bottom.push({ x: p.x - Math.sin(ang) * w * 0.8, y: p.y + Math.cos(ang) * w * 0.8 });
      });
      const tail = spine[N];
      const tailAng = Math.atan2(spine[N].y - spine[N - 2].y, spine[N].x - spine[N - 2].x);
      const body = '#6f8ea3';
      const dark = '#4f6f86';
      const belly = '#eef4f7';
      // Cola (dos lóbulos, el de arriba más grande).
      c.save();
      c.translate(tail.x, tail.y);
      c.rotate(tailAng + Math.PI);
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(-L * 0.08, -thick * 0.9, -L * 0.2, -thick * 1.35);
      c.quadraticCurveTo(-L * 0.12, -thick * 0.3, -L * 0.04, 0);
      c.quadraticCurveTo(-L * 0.11, thick * 0.25, -L * 0.15, thick * 0.85);
      c.quadraticCurveTo(-L * 0.05, thick * 0.55, 0, 0);
      c.fill();
      c.restore();
      // Aleta pectoral (la de atrás, más oscura).
      const fin = (sx, color, flap) => {
        const p = spine[Math.round(sx * N)];
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(p.x + L * 0.02, p.y + thick * 0.45);
        c.quadraticCurveTo(p.x - L * 0.06, p.y + thick * (1.25 + flap), p.x - L * 0.17, p.y + thick * (1.45 + flap));
        c.quadraticCurveTo(p.x - L * 0.09, p.y + thick * 0.75, p.x - L * 0.08, p.y + thick * 0.4);
        c.fill();
      };
      fin(0.34, '#56768c', Math.sin(t / 260) * 0.12);
      // Cuerpo con sombreado: oscuro arriba y barriga clara.
      const path = new Path2D();
      path.moveTo(top[0].x + L * 0.02, spine[0].y);
      top.forEach((p) => path.lineTo(p.x, p.y));
      for (let i = bottom.length - 1; i >= 0; i -= 1) path.lineTo(bottom[i].x, bottom[i].y);
      path.closePath();
      const grad = c.createLinearGradient(0, -thick, 0, thick);
      grad.addColorStop(0, dark);
      grad.addColorStop(0.42, body);
      grad.addColorStop(0.58, belly);
      grad.addColorStop(1, belly);
      c.fillStyle = grad;
      c.fill(path);
      c.strokeStyle = 'rgba(30,50,70,.35)';
      c.lineWidth = 1;
      c.stroke(path);
      // Brillo en el lomo.
      c.strokeStyle = 'rgba(255,255,255,.28)';
      c.lineWidth = 1.6;
      c.beginPath();
      top.slice(2, 10).forEach((p, i) => (i ? c.lineTo(p.x, p.y + 2.5) : c.moveTo(p.x, p.y + 2.5)));
      c.stroke();
      // Aleta dorsal.
      const d = spine[Math.round(0.4 * N)];
      const dTop = top[Math.round(0.4 * N)];
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(dTop.x + L * 0.07, dTop.y + 1);
      c.quadraticCurveTo(dTop.x + L * 0.01, dTop.y - thick * 1.05, dTop.x - L * 0.09, dTop.y - thick * 1.2);
      c.quadraticCurveTo(dTop.x - L * 0.06, dTop.y - thick * 0.4, dTop.x - L * 0.08, d.y - thick * 0.75);
      c.fill();
      // Branquias.
      c.strokeStyle = 'rgba(40,60,80,.45)';
      c.lineWidth = 1;
      for (let k = 0; k < 3; k += 1) {
        const g = spine[Math.round((0.2 + k * 0.035) * N)];
        c.beginPath();
        c.moveTo(g.x, g.y - thick * 0.35);
        c.quadraticCurveTo(g.x - 2, g.y, g.x, g.y + thick * 0.3);
        c.stroke();
      }
      // Aleta pectoral delantera.
      fin(0.3, '#6a8aa0', Math.sin(t / 260 + 1) * 0.15);
      // Cara: ojo que parpadea (o duerme), mejillas y boca según el ánimo.
      const head = spine[Math.round(0.1 * N)];
      const ex = head.x - L * 0.005;
      const ey = head.y - thick * 0.28;
      if (t > shark.blinkAt) { shark.blinkUntil = t + 140; shark.blinkAt = t + 2400 + Math.random() * 3000; }
      const closed = mood.id === 'sleep' || t < shark.blinkUntil;
      if (closed) {
        c.strokeStyle = '#1b2a36';
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(ex, ey - 1, thick * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
        c.stroke();
      } else {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(ex, ey, thick * 0.17, 0, TAU);
        c.fill();
        c.fillStyle = '#1b2a36';
        c.beginPath();
        c.arc(ex + thick * 0.03, ey + (mood.id === 'worried' ? thick * 0.03 : 0), thick * 0.11, 0, TAU);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(ex + thick * 0.07, ey - thick * 0.05, thick * 0.04, 0, TAU);
        c.fill();
        if (mood.id === 'worried') {
          c.strokeStyle = '#1b2a36';
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(ex - thick * 0.2, ey - thick * 0.32);
          c.lineTo(ex + thick * 0.15, ey - thick * 0.22);
          c.stroke();
        }
      }
      if (['happy', 'party'].includes(mood.id)) {
        c.fillStyle = 'rgba(240,130,150,.45)';
        c.beginPath();
        c.ellipse(ex - thick * 0.05, ey + thick * 0.32, thick * 0.14, thick * 0.08, 0, 0, TAU);
        c.fill();
      }
      const mx = head.x + L * 0.035;
      const my = head.y + thick * 0.28;
      const chomp = t < shark.chompUntil;
      c.strokeStyle = '#1b2a36';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.beginPath();
      if (chomp) {
        c.fillStyle = '#7a2a3a';
        c.ellipse(mx - 2, my, thick * 0.2, thick * 0.16, 0, 0, TAU);
        c.fill();
        c.stroke();
        c.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k += 1) { c.beginPath(); c.moveTo(mx - 6 + k * 4, my - thick * 0.14); c.lineTo(mx - 4 + k * 4, my - thick * 0.02); c.lineTo(mx - 2 + k * 4, my - thick * 0.14); c.fill(); }
      } else if (mood.id === 'worried' || mood.id === 'thirsty') {
        c.moveTo(mx - thick * 0.35, my + 1);
        c.quadraticCurveTo(mx - thick * 0.15, my - thick * 0.08, mx + thick * 0.05, my + 1);
        c.stroke();
      } else if (mood.id === 'sleep') {
        c.moveTo(mx - thick * 0.3, my);
        c.lineTo(mx, my);
        c.stroke();
      } else {
        c.moveTo(mx - thick * 0.4, my - 1);
        c.quadraticCurveTo(mx - thick * 0.15, my + thick * 0.18, mx + thick * 0.06, my - thick * 0.04);
        c.stroke();
      }
      // Gorro de fiesta.
      if (mood.id === 'party') {
        const hx = head.x - L * 0.06;
        const hy = top[Math.round(0.12 * N)].y;
        c.fillStyle = '#f2c230';
        c.beginPath();
        c.moveTo(hx - thick * 0.35, hy + 2);
        c.lineTo(hx + thick * 0.3, hy + 2);
        c.lineTo(hx - thick * 0.05, hy - thick * 0.9);
        c.closePath();
        c.fill();
        c.fillStyle = '#e0405a';
        c.beginPath();
        c.arc(hx - thick * 0.05, hy - thick * 0.9, 3, 0, TAU);
        c.fill();
      }
      // Gotita de sudor si está preocupado; gota de agua si tiene sed.
      if (mood.id === 'worried' || mood.id === 'thirsty') {
        const k = (t % 1600) / 1600;
        c.globalAlpha = 1 - k;
        c.fillStyle = mood.id === 'thirsty' ? '#7cc4e6' : '#cfeaf8';
        c.beginPath();
        const dx = head.x - L * 0.08;
        const dy = top[Math.round(0.08 * N)].y - 4 + k * 8;
        c.moveTo(dx, dy - 5);
        c.quadraticCurveTo(dx + 4, dy, dx, dy + 3);
        c.quadraticCurveTo(dx - 4, dy, dx, dy - 5);
        c.fill();
        c.globalAlpha = 1;
      }
      c.restore();
      return { mouthX: shark.x + shark.turn * (L * 0.04), mouthY: shark.y + thick * 0.28, length: L };
    }

    function step(t) {
      raf = requestAnimationFrame(step);
      if (!visible || document.hidden) { last = t; return; }
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const L = Math.min(W * 0.36, 130);
      // Nada de lado a lado; al llegar al borde da la vuelta.
      const speed = 34 * mood.speed;
      shark.x += shark.dir * speed * dt;
      const margin = L * 0.15;
      if (shark.dir > 0 && shark.x > W - margin) { shark.dir = -1; shark.flipUntil = t + 900; }
      if (shark.dir < 0 && shark.x < L + margin) { shark.dir = 1; shark.flipUntil = t + 900; }
      // El giro: la escala horizontal pasa suavemente de un lado al otro.
      shark.turn += (shark.dir - shark.turn) * Math.min(1, dt * 4);
      if (Math.abs(shark.turn) < 0.08) shark.turn = shark.dir * 0.08;
      // Sube y baja despacio (dormido, cerca del fondo).
      if (Math.random() < dt * 0.4) targetY = mood.id === 'sleep' ? H * 0.68 : H * (0.35 + Math.random() * 0.3);
      shark.y += (targetY + Math.sin(t / 900) * 3 - shark.y) * Math.min(1, dt * 1.2);
      drawWater(t);
      // Pececitos: un banco si está feliz; si tiene hambre, se los come.
      const wantFish = mood.id === 'happy' || mood.id === 'party' ? 5 : mood.id === 'hungry' ? 3 : 0;
      while (fish.length < wantFish) fish.push({ x: Math.random() < 0.5 ? -10 : W + 10, y: H * (0.2 + Math.random() * 0.5), v: (10 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1), hue: ['#f2a33a', '#ffd23f', '#f49ab0'][fish.length % 3], t: Math.random() * 6 });
      if (fish.length > wantFish) fish.length = wantFish;
      const mouth = drawShark(t, dt);
      fish.forEach((f) => {
        f.x += f.v * dt;
        if (f.x < -20) f.x = W + 10;
        if (f.x > W + 20) f.x = -10;
        const fy = f.y + Math.sin(t / 400 + f.t) * 3;
        if (mood.id === 'hungry' && Math.hypot(f.x - mouth.mouthX, fy - mouth.mouthY) < 10) {
          shark.chompUntil = t + 300;
          f.x = shark.dir > 0 ? -20 : W + 20;
          for (let k = 0; k < 3; k += 1) bubbles.push({ x: mouth.mouthX, y: mouth.mouthY, r: 2 + Math.random() * 2, v: 14 + Math.random() * 10 });
        }
        c.save();
        c.translate(f.x, fy);
        c.scale(f.v > 0 ? 1 : -1, 1);
        c.fillStyle = f.hue;
        c.beginPath();
        c.ellipse(0, 0, 5, 3, 0, 0, TAU);
        c.fill();
        c.beginPath();
        c.moveTo(-4, 0);
        c.lineTo(-8, -3 + Math.sin(t / 90 + f.t) * 1);
        c.lineTo(-8, 3 + Math.sin(t / 90 + f.t) * 1);
        c.fill();
        c.fillStyle = '#1b2a36';
        c.beginPath();
        c.arc(2.5, -0.5, 0.9, 0, TAU);
        c.fill();
        c.restore();
      });
      // Burbujas (y «Z» si duerme).
      if (Math.random() < dt * (mood.id === 'sleep' ? 0.6 : 1.2)) bubbles.push({ x: mouth.mouthX, y: mouth.mouthY - 4, r: 1.5 + Math.random() * 2.5, v: 12 + Math.random() * 12, z: mood.id === 'sleep' });
      for (let i = bubbles.length - 1; i >= 0; i -= 1) {
        const b = bubbles[i];
        b.y -= b.v * dt;
        b.x += Math.sin(t / 300 + i) * 0.2;
        if (b.y < -6) { bubbles.splice(i, 1); continue; }
        if (b.z) {
          c.fillStyle = 'rgba(230,240,255,.8)';
          c.font = `${8 + b.r * 2}px system-ui, sans-serif`;
          c.fillText('z', b.x, b.y);
        } else {
          c.strokeStyle = 'rgba(255,255,255,.75)';
          c.lineWidth = 1;
          c.beginPath();
          c.arc(b.x, b.y, b.r, 0, TAU);
          c.stroke();
          c.fillStyle = 'rgba(255,255,255,.5)';
          c.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 1, 1);
        }
      }
      // Corazones al tocarlo y confeti de fiesta.
      for (let i = hearts.length - 1; i >= 0; i -= 1) {
        const hh = hearts[i];
        hh.y -= 22 * dt;
        hh.life -= dt;
        if (hh.life <= 0) { hearts.splice(i, 1); continue; }
        c.globalAlpha = Math.min(1, hh.life * 1.5);
        c.font = '14px system-ui, "Apple Color Emoji", sans-serif';
        c.fillText(hh.e, hh.x, hh.y);
        c.globalAlpha = 1;
      }
      if (mood.id === 'party' && Math.random() < dt * 8) confetti.push({ x: Math.random() * W, y: -4, v: 20 + Math.random() * 20, col: ['#e0405a', '#ffd23f', '#3fd46a', '#4a8fe0'][Math.floor(Math.random() * 4)], r: Math.random() * TAU });
      for (let i = confetti.length - 1; i >= 0; i -= 1) {
        const p = confetti[i];
        p.y += p.v * dt;
        p.r += dt * 4;
        if (p.y > H) { confetti.splice(i, 1); continue; }
        c.save();
        c.translate(p.x + Math.sin(p.r) * 3, p.y);
        c.rotate(p.r);
        c.fillStyle = p.col;
        c.fillRect(-2, -1, 4, 2);
        c.restore();
      }
      // Viñeta suave para darle profundidad.
      const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,20,40,.22)');
      c.fillStyle = v;
      c.fillRect(0, 0, W, H);
    }
    // Cada pocos segundos mira cómo está la casa.
    const refresh = () => {
      const next = moodOf(readHouse());
      if (next.id !== mood.id || next.text !== mood.text) {
        mood = next;
        caption.textContent = mood.text;
        host.dataset.mood = mood.id;
      }
    };
    host.dataset.mood = mood.id;
    const timer = setInterval(refresh, 3000);
    raf = requestAnimationFrame(step);
    // Tocarlo: da una voltereta, suelta corazones y dice cómo está la casa.
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      shark.flipUntil = performance.now() + 900;
      shark.chompUntil = performance.now() + 250;
      for (let k = 0; k < 4; k += 1) hearts.push({ x: x - 10 + Math.random() * 20, y: y - 6, life: 1.4 + Math.random() * 0.5, e: mood.id === 'worried' ? '💦' : mood.id === 'sleep' ? '💤' : '💙' });
      refresh();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(host);
    }
    return {
      refresh,
      destroy() { cancelAnimationFrame(raf); clearInterval(timer); observer?.disconnect(); }
    };
  }

  window.umbralShark = { create };
  // Se monta solo en Inicio.
  const mount = () => {
    const host = document.querySelector('#sharkTank');
    if (host && !host.dataset.ready) { host.dataset.ready = '1'; window.umbralShark.instance = create(host); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
