// El jardín de la pantalla de inicio, en el mismo pixel art que el modo Sims:
// - Cielo según la hora real (amanecer, día, atardecer, noche), sol y luna con su fase,
//   estrellas, nubes y el tiempo de Turín (lluvia, nieve, niebla, tormenta).
// - Al fondo, los Alpes y Turín (la Mole Antonelliana y la Superga), con luces de noche.
// - La casa con las luces de cada habitación encendidas, el humo de la chimenea si hace frío,
//   el buzón (bandera si hay facturas), la nota de la puerta y vuestras plantas reales.
// - El árbol según la estación, pájaros, luciérnagas, estrellas fugaces, murciélagos en
//   Halloween, luces de Navidad, corazones en San Valentín y fuegos en Nochevieja.
// - Ines y Matteo con sus sprites LPC haciendo el plan del momento (saludar, abrazarse,
//   bailar, charcos, paraguas, nieve, mirar las estrellas, regar…), vestidos según el tiempo.
// scene.js decide qué toca (hora, tiempo, plan, días especiales) y llama a garden.set(info).
(function () {
  if (!window.simsWorld) return;
  const { OL } = window.simsWorld;
  const { R, box, oval, ovalBox, shadow, pixels, tone, line, pixelText } = window.simsWorld.paint;
  const GW = 400;
  const GH = 200;
  const GROUND = 160;
  const HOUSE = { x: 128, w: 148, top: 94 };
  const DOOR = { x: 192, y: 120, w: 20, h: 40 };
  const PLANT_SPOTS = [[180, 160], [224, 160], [264, 160]];
  const WINDOWS = { dormitorio: [146, 102], bano: [240, 102], salon: [146, 128], cocina: [240, 128], estudio: [196, 70] };
  const MOOD_FACE = { happy: 'happy', love: 'blush', excited: 'happy', relaxed: 'happy', party: 'happy', sad: 'sad', grumpy: 'angry', sick: 'sad', tired: 'closed', sleepy: 'closed' };
  const PLUMBOB = { green: ['#3fd46a', '#9cf2b4', '#1f8a3e'], yellow: ['#f2c230', '#fbe58a', '#a8820f'], red: ['#ef4f4f', '#f9a0a0', '#9a2020'] };

  function create(host, { onTap } = {}) {
    const canvas = document.createElement('canvas');
    canvas.className = 'garden-canvas';
    host.appendChild(canvas);
    const c = canvas.getContext('2d');
    const background = document.createElement('canvas');
    background.width = GW;
    background.height = GH;
    let bgKey = '';
    let info = null;
    let paused = false;
    let raf = 0;
    let last = 0;
    let loveUntil = 0;
    const particles = [];
    const view = { s: 1, ox: 0, oy: 0 };
    const actors = {
      ines: { key: 'ines', x: 186, y: 184, dir: 'down', anim: 'idle', frame: 0, nextBlink: 0, blinkUntil: 0 },
      matteo: { key: 'matteo', x: 214, y: 184, dir: 'down', anim: 'idle', frame: 0, nextBlink: 0, blinkUntil: 0 }
    };
    window.simsWorld.loadSprites().catch(() => {});

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const s = Math.max(canvas.width / GW, canvas.height / GH);
      Object.assign(view, { s, ox: (canvas.width - GW * s) / 2, oy: (canvas.height - GH * s) / 2 });
    }
    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();

    // ---------- Fondo (se repinta cuando cambian los colores del momento del día) ----------
    function bake() {
      const v = info.vars;
      const key = JSON.stringify([v.alps, v.city, v.hillFar, v.hillNear, v.ground, v.wall, v.roof, info.season, info.snowGround > 0, info.cityLights > 0.3, info.decor]);
      if (key === bgKey) return;
      bgKey = key;
      const b = background.getContext('2d');
      b.clearRect(0, 0, GW, GH);
      // Alpes con nieve.
      for (let x = 0; x < GW; x += 1) {
        const top = Math.round(104 - Math.abs(Math.sin(x / 31)) * 16 - Math.abs(Math.sin(x / 73 + 1)) * 18);
        R(b, x, top, 1, 60, v.alps);
        if (top < 92) R(b, x, top, 1, Math.round((92 - top) * 0.5) + 1, v.snowcap);
      }
      // Turín: la Superga en su colina y la ciudad con la Mole.
      for (let x = 290; x < GW; x += 1) R(b, x, Math.round(118 - Math.sin(((x - 290) / 110) * Math.PI) * 10), 1, 30, tone(v.city, -0.05));
      box(b, 336, 98, 18, 12, v.city, { hi: 0.15, lo: -0.15, ol: tone(v.city, -0.35) });
      oval(b, 345, 97, 6, 5, tone(v.city, 0.08));
      R(b, 344, 89, 2, 4, tone(v.city, -0.2));
      for (let i = 0; i < 26; i += 1) {
        const bx = 10 + i * 15;
        const bh = 8 + ((i * 7) % 9);
        R(b, bx, 128 - bh, 13, bh + 6, v.city);
        R(b, bx, 128 - bh, 13, 1, tone(v.city, 0.12));
      }
      const mx = 96;
      R(b, mx - 1, 74, 2, 14, tone(v.city, -0.25));
      for (let y = 88; y < 118; y += 1) {
        const half = Math.round(2 + ((y - 88) / 30) ** 1.4 * 9);
        R(b, mx - half, y, half * 2, 1, tone(v.city, -0.12));
      }
      R(b, mx - 12, 116, 24, 12, tone(v.city, -0.08));
      if (info.cityLights > 0.3) for (let i = 0; i < 60; i += 1) R(b, (i * 53) % GW, 112 + ((i * 29) % 16), 1, 1, '#ffd77a');
      // Colinas y césped con su textura.
      for (let x = 0; x < GW; x += 1) R(b, x, Math.round(128 - Math.abs(Math.sin(x / 57 + 2)) * 8), 1, 40, v.hillFar);
      for (let x = 0; x < GW; x += 1) R(b, x, Math.round(142 - Math.abs(Math.sin(x / 41 + 1)) * 7), 1, 30, v.hillNear);
      R(b, 0, GROUND - 6, GW, GH - GROUND + 6, v.ground);
      for (let i = 0; i < 260; i += 1) R(b, (i * 37) % GW, GROUND - 4 + ((i * 23) % 44), 1, 2, tone(v.ground, i % 2 ? -0.08 : 0.08));
      if (info.snowGround > 0) {
        R(b, 0, GROUND - 6, GW, GH - GROUND + 6, '#eef3f8');
        for (let i = 0; i < 120; i += 1) R(b, (i * 37) % GW, GROUND - 4 + ((i * 23) % 44), 2, 1, '#d8e2ee');
      }
      // Camino de la puerta.
      for (let y = 160; y < GH; y += 1) {
        const w = 16 + (y - 160) * 0.7;
        R(b, 202 - w / 2, y, w, 1, ((y * 7) % 5) ? v.path : tone(v.path, -0.08));
      }
      for (let y = 164; y < GH; y += 7) R(b, 196 - (y - 160) * 0.3, y, 4, 2, tone(v.path, -0.12));
      // Valla a los dos lados.
      [[52, 116], [290, 356]].forEach(([x0, x1]) => {
        R(b, x0, 168, x1 - x0, 2, v.fence);
        R(b, x0, 174, x1 - x0, 2, v.fence);
        for (let x = x0; x <= x1; x += 8) { R(b, x - 1, 162, 4, 16, OL); R(b, x, 163, 2, 14, v.fence); }
      });
      // La casa.
      const { x, w, top } = HOUSE;
      R(b, x - 2, top, w + 4, GROUND - top, OL);
      R(b, x, top + 1, w, GROUND - top - 1, v.wall);
      for (let yy = top + 8; yy < GROUND; yy += 8) R(b, x, yy, w, 1, tone(v.wall, -0.05));
      R(b, x, GROUND - 6, w, 6, tone(v.wall, -0.18));
      // Tejado escalonado con tejas.
      for (let i = 0; i < 34; i += 1) {
        const rowW = w + 16 - i * 5;
        if (rowW < 8) break;
        R(b, x + w / 2 - rowW / 2 - 1, top - i, rowW + 2, 1, OL);
        R(b, x + w / 2 - rowW / 2, top - i, rowW, 1, i % 3 === 0 ? v.eave : v.roof);
      }
      R(b, x - 8, top - 1, w + 16, 3, v.eave);
      box(b, 238, 58, 12, 28, v.chimney, { hi: 0.15, lo: -0.2 });
      R(b, 236, 56, 16, 3, tone(v.chimney, -0.2));
      // Escalón y felpudo.
      R(b, DOOR.x - 4, GROUND - 2, DOOR.w + 8, 3, tone(v.path, -0.2));
      R(b, DOOR.x - 2, GROUND + 1, DOOR.w + 4, 3, '#8d6b3e');
      // Buzón.
      R(b, 99, 142, 3, 30, OL);
      R(b, 100, 142, 1, 30, '#6a4a34');
      box(b, 88, 128, 24, 15, v.mailbox);
      R(b, 90, 130, 20, 1, tone(v.mailbox, 0.2));
      R(b, 92, 136, 10, 1, tone(v.mailbox, -0.25));
      // Arbustos.
      [[124, 160], [280, 160], [112, 166]].forEach(([bx, by]) => { ovalBox(b, bx, by, 9, 6, v.bush); oval(b, bx - 2, by - 2, 5, 3, v.bushB); });
    }

    // ---------- Elementos que cambian ----------
    function drawSkyFx(t) {
      const v = info.vars;
      const grad = c.createLinearGradient(0, 0, 0, GROUND);
      grad.addColorStop(0, v.skyTop);
      grad.addColorStop(0.55, v.skyMid);
      grad.addColorStop(1, v.skyBottom);
      c.fillStyle = grad;
      c.fillRect(0, 0, GW, GROUND);
      if (info.stars > 0.02) {
        c.globalAlpha = info.stars;
        for (let i = 0; i < 46; i += 1) {
          c.globalAlpha = info.stars * (0.4 + 0.6 * Math.abs(Math.sin(t / 900 + i)));
          R(c, (i * 97) % GW, (i * 31) % 92, 1, 1, '#ffffff');
        }
        c.globalAlpha = 1;
      }
      if (info.moon.visible > 0.05) {
        c.globalAlpha = info.moon.visible;
        oval(c, info.moon.x, info.moon.y, 7, 7, '#f6f0c8');
        const shift = info.moon.phase < 0.5 ? -14 * info.moon.phase : 14 * (1 - info.moon.phase);
        if (Math.abs(shift) > 0.5) oval(c, info.moon.x + shift, info.moon.y, 7, 7, v.skyTop);
        c.globalAlpha = 1;
      }
      if (info.sun.visible > 0.05) {
        c.globalAlpha = 0.3 * info.sun.visible;
        oval(c, info.sun.x, info.sun.y, 14, 14, v.sun);
        c.globalAlpha = info.sun.visible;
        oval(c, info.sun.x, info.sun.y, 8, 8, v.sun);
        c.globalAlpha = 1;
      }
      if (info.shooting && Math.floor(t / 13000) % 2 === 0) {
        const k = (t % 13000) / 1300;
        if (k < 1) { c.globalAlpha = 1 - k; line(c, 60 + k * 120, 20 + k * 30, 54 + k * 120, 17 + k * 30, '#ffffff'); c.globalAlpha = 1; }
      }
      for (let i = 0; i < info.clouds; i += 1) {
        const cx = ((t / (1600 + i * 400)) * 6 + i * 80) % (GW + 60) - 30;
        const cy = 14 + ((i * 23) % 46);
        c.globalAlpha = 0.92;
        oval(c, cx, cy, 13, 4, v.cloud);
        oval(c, cx + 7, cy - 3, 8, 4, v.cloud);
        oval(c, cx - 7, cy - 2, 6, 3, v.cloud);
        c.globalAlpha = 1;
      }
    }

    function drawHouseFx(t) {
      const v = info.vars;
      const lit = new Set(info.lit || []);
      Object.entries(WINDOWS).forEach(([room, [wx, wy]]) => {
        const small = room === 'estudio';
        const ww = small ? 12 : 18;
        const wh = small ? 10 : 15;
        box(c, wx - 1, wy - 1, ww + 2, wh + 2, v.trim, { hi: 0.2, lo: -0.15 });
        R(c, wx, wy, ww, wh, lit.has(room) ? v.glassLit : v.glass);
        if (lit.has(room)) {
          R(c, wx, wy, 3, wh, v.curtainLit);
          R(c, wx + ww - 3, wy, 3, wh, v.curtainLit);
          if (room === 'salon' && info.act === 'movie') {
            R(c, wx + 4, wy + 3, ww - 8, 5, ['#9fd3f0', '#f2c2a0', '#b0e0b0'][Math.floor(t / 600) % 3]);
            pixels(c, [[wx + 5, wy + 8, 2, 3], [wx + 8, wy + 8, 2, 3]], '#2b1f1d');
          }
          if (room === 'cocina' && info.act === 'cook') pixels(c, [[wx + 4, wy + 7, 2, 4], [wx + 8, wy + 7, 2, 4]], '#2b1f1d');
        }
        R(c, wx + ww / 2 - 0.5, wy, 1, wh, v.trim);
        R(c, wx, wy + wh / 2, ww, 1, v.trim);
      });
      // Puerta con su farol y la nota.
      box(c, DOOR.x, DOOR.y, DOOR.w, DOOR.h, v.door, { hi: 0.15, lo: -0.2 });
      R(c, DOOR.x + DOOR.w - 5, DOOR.y + 22, 2, 2, '#e3b86a');
      R(c, DOOR.x + 2, DOOR.y + 3, DOOR.w - 4, 1, tone(v.door, -0.25));
      R(c, DOOR.x + 2, DOOR.y + 20, DOOR.w - 4, 1, tone(v.door, -0.25));
      box(c, DOOR.x + DOOR.w + 4, DOOR.y + 4, 6, 9, '#3a3a36');
      R(c, DOOR.x + DOOR.w + 5, DOOR.y + 6, 4, 5, info.porch ? '#ffe9a8' : '#c8c0a8');
      if (info.note) { R(c, DOOR.x + 4, DOOR.y + 7, 9, 9, '#fbe58a'); R(c, DOOR.x + 5, DOOR.y + 10, 7, 1, '#9a8a50'); R(c, DOOR.x + 5, DOOR.y + 12, 5, 1, '#9a8a50'); }
      if (info.act === 'away') {
        box(c, DOOR.x - 6, DOOR.y + 8, 28, 9, '#f4efe2');
        pixelText(c, 'VIAJE', DOOR.x - 2, DOOR.y + 10, '#2b1f1d');
      }
      // Bandera del buzón si hay facturas.
      R(c, 112, info.mail ? 118 : 130, 2, info.mail ? 12 : 6, '#2b1f1d');
      if (info.mail) R(c, 114, 118, 7, 5, '#e0533f');
      // Humo de la chimenea.
      if (info.smoke) for (let i = 0; i < 4; i += 1) {
        const k = ((t / 1800 + i / 4) % 1);
        c.globalAlpha = 0.5 * (1 - k);
        oval(c, 244 + k * 10 * info.wind, 52 - k * 30, 3 + k * 4, 2 + k * 3, '#e8ecef');
        c.globalAlpha = 1;
      }
      if (info.act === 'sleep' && Math.floor(t / 800) % 2) pixelText(c, 'Z', 166, 96 - ((t / 400) % 6), '#f4f9ff');
      if (info.act === 'cook') for (let i = 0; i < 2; i += 1) { c.globalAlpha = 0.6; oval(c, 246 + i * 6, 122 - ((t / 50 + i * 9) % 14), 2, 2, '#ffffff'); c.globalAlpha = 1; }
    }

    function drawTree(t) {
      const v = info.vars;
      const tx = 330;
      const ty = 170;
      shadow(c, tx, ty, 18, 3, 0.25);
      R(c, tx - 3, ty - 34, 6, 34, OL);
      R(c, tx - 2, ty - 34, 4, 34, v.trunk);
      if (info.season === 'winter') {
        [[-14, -46], [12, -50], [-6, -58], [8, -40]].forEach(([dx, dy]) => line(c, tx, ty - 30, tx + dx, ty + dy, v.trunk));
        if (info.snowGround) pixels(c, [[tx - 14, ty - 47, 4, 1], [tx + 10, ty - 51, 4, 1], [tx - 7, ty - 59, 3, 1]], '#ffffff');
        return;
      }
      const sway = Math.round(Math.sin(t / 1400) * info.wind * 0.8);
      [[0, -48, 18], [-14, -40, 12], [14, -40, 12], [0, -62, 12]].forEach(([dx, dy, r], i) => ovalBox(c, tx + dx + sway, ty + dy, r, r * 0.8, i % 2 ? v.canopyB : v.canopy));
      if (info.season === 'spring') for (let i = 0; i < 12; i += 1) R(c, tx - 16 + ((i * 11) % 32) + sway, ty - 66 + ((i * 7) % 30), 2, 2, v.accent);
      if (info.season === 'autumn') for (let i = 0; i < 5; i += 1) {
        const k = ((t / 3000 + i / 5) % 1);
        R(c, tx - 10 + i * 6 + Math.sin(t / 400 + i) * 4, ty - 40 + k * 40, 2, 1, i % 2 ? v.canopy : v.canopyB);
      }
    }

    function drawPlants(t) {
      (info.plants || []).slice(0, 3).forEach((plant, i) => {
        const [px, py] = PLANT_SPOTS[i];
        const dry = ['thirsty', 'parched'].includes(plant.mood);
        const leaf = dry ? '#a39a52' : '#4c9a5a';
        const leaf2 = dry ? '#8f8a45' : '#3a7d47';
        if (plant.species === 'monstera') { ovalBox(c, px - 3, py - 10 + (dry ? 2 : 0), 4, 3, leaf); ovalBox(c, px + 3, py - 12 + (dry ? 2 : 0), 4, 3, leaf2); }
        else if (plant.species === 'strelitzia') { [[-3, -16], [0, -19], [3, -15]].forEach(([dx, dy]) => { R(c, px + dx - 1, py + dy + (dry ? 3 : 0), 3, 10, OL); R(c, px + dx, py + dy + 1 + (dry ? 3 : 0), 1, 8, leaf); }); if (!dry) R(c, px + 2, py - 17, 3, 2, '#f08a2c'); }
        else { [[-3, -9], [0, -12], [3, -9], [0, -7]].forEach(([dx, dy], k) => ovalBox(c, px + dx, py + dy + (dry ? 2 : 0), 2, 2, k % 2 ? leaf : leaf2)); }
        box(c, px - 4, py - 5, 8, 6, '#c47a52');
        if (dry && Math.floor(t / 500) % 2) pixels(c, [[px, py - 24, 1, 1], [px - 1, py - 23, 3, 2], [px, py - 21, 1, 1]], '#7cc4e6');
        if (plant.mood === 'watered' && Math.floor(t / 400) % 2) pixels(c, [[px - 6, py - 14, 1, 1], [px + 6, py - 16, 1, 1]], '#fff6c8');
      });
    }

    function drawDecor(t) {
      const d = info.decor;
      if (d === 'christmas') {
        for (let i = 0; i < 18; i += 1) R(c, HOUSE.x - 6 + i * 6.6, HOUSE.top + 2 + (i % 2), 2, 2, ['#e0533f', '#f2c230', '#3fd46a', '#4a8fe0'][(i + Math.floor(t / 500)) % 4]);
        for (let i = 0; i < 7; i += 1) R(c, 140 - i * 1.5, 150 + i * 3, 3 + i * 3, 3, '#2f6a3c');
        R(c, 145, 172, 3, 4, '#6a4a34');
        R(c, 145, 147, 3, 3, '#f2c230');
      }
      if (d === 'halloween') {
        [[160, 168], [252, 168]].forEach(([px, py]) => { ovalBox(c, px, py - 3, 5, 4, '#e8742a'); R(c, px - 1, py - 8, 2, 2, '#4a6a2a'); if (info.nightness > 0.4) pixels(c, [[px - 3, py - 4, 2, 1], [px + 1, py - 4, 2, 1], [px - 2, py - 2, 4, 1]], '#ffe07a'); });
        if (info.bats) for (let i = 0; i < 3; i += 1) { const bx = (t / 30 + i * 120) % GW; const by = 40 + Math.sin(t / 300 + i) * 8; pixels(c, [[bx - 3, by, 2, 1], [bx + 2, by, 2, 1], [bx - 1, by + 1, 3, 1]], '#1d1d22'); }
      }
      if (d === 'valentine') for (let i = 0; i < 8; i += 1) pixels(c, [[HOUSE.x + 6 + i * 12, HOUSE.top + 4, 2, 1], [HOUSE.x + 9 + i * 12, HOUSE.top + 4, 2, 1], [HOUSE.x + 5 + i * 12, HOUSE.top + 5, 7, 2], [HOUSE.x + 7 + i * 12, HOUSE.top + 7, 3, 1]], '#ef476f');
      if (info.act === 'birthday') {
        for (let i = 0; i < 9; i += 1) R(c, HOUSE.x + 4 + i * 11, HOUSE.top + 3 + (i % 2), 4, 4, ['#e0533f', '#f2c230', '#4a8fe0'][i % 3]);
        box(c, 140, 170, 18, 6, '#8a5a3a');
        box(c, 144, 163, 10, 7, '#f4e6d4');
        R(c, 148, 160, 1, 3, '#f2c230');
        for (let i = 0; i < 10; i += 1) R(c, 150 + ((i * 37 + t / 20) % 120), (t / 15 + i * 23) % 150, 2, 2, ['#e0533f', '#f2c230', '#3fd46a', '#4a8fe0'][i % 4]);
      }
      if (info.act === 'pack') [[164, 182], [236, 182]].forEach(([sx, sy]) => { box(c, sx, sy - 14, 12, 14, '#c0503e'); R(c, sx + 4, sy - 17, 4, 3, OL); });
      if (info.fireworks) for (let i = 0; i < 3; i += 1) {
        const k = ((t / 1600 + i / 3) % 1);
        const fx = 80 + i * 120;
        const fy = 50 - i * 6;
        if (k < 0.35) R(c, fx, 120 - k * 200, 1, 3, '#ffe9a8');
        else { c.globalAlpha = 1 - (k - 0.35) / 0.65; for (let a = 0; a < 12; a += 1) R(c, fx + Math.cos(a / 12 * Math.PI * 2) * (k - 0.35) * 40, fy + Math.sin(a / 12 * Math.PI * 2) * (k - 0.35) * 40, 2, 2, ['#e0533f', '#f2c230', '#4a8fe0'][i % 3]); c.globalAlpha = 1; }
      }
    }

    function drawFauna(t) {
      if (info.birds) for (let i = 0; i < 3; i += 1) {
        const bx = (t / (60 + i * 15) + i * 140) % (GW + 40) - 20;
        const by = 30 + i * 9 + Math.sin(t / 300 + i) * 3;
        const flap = Math.floor(t / 200 + i) % 2;
        pixels(c, [[bx - 3, by - flap, 3, 1], [bx + 1, by - flap, 3, 1], [bx, by + 1 - flap, 1, 1]], '#2b2f3a');
      }
      if (info.fireflies) for (let i = 0; i < 8; i += 1) {
        if (Math.sin(t / 400 + i * 2) < 0.3) continue;
        R(c, 40 + ((i * 47 + t / 80) % 320), 150 + Math.sin(t / 700 + i) * 12 + (i % 3) * 8, 1, 1, '#f6f08a');
      }
    }

    function drawWeather(t) {
      if (info.drops) {
        c.globalAlpha = 0.6;
        for (let i = 0; i < info.drops; i += 1) {
          const x = ((i * 53) - (t / 6) * (0.4 + info.wind * 0.1)) % GW;
          const y = ((i * 89) + t / 3) % GH;
          R(c, (x + GW) % GW, y, 1, 4, info.vars.rain);
        }
        c.globalAlpha = 1;
      }
      if (info.flakes) for (let i = 0; i < info.flakes; i += 1) R(c, ((i * 53) + Math.sin(t / 800 + i) * 6 + GW) % GW, ((i * 89) + t / 40) % GH, 1, 1, '#ffffff');
      if (info.condition === 'storm' && t % 7000 < 120) { c.globalAlpha = 0.5; R(c, 0, 0, GW, GH, '#ffffff'); c.globalAlpha = 1; }
      if (info.condition === 'fog') { c.globalAlpha = 0.35; R(c, 0, 60, GW, GH, info.nightness > 0.5 ? '#3b4654' : '#e6eae8'); c.globalAlpha = 1; }
    }

    // ---------- Ines y Matteo ----------
    const outfitSprite = (key) => {
      const o = info.outfit;
      const kind = o === 'hot' ? 'hot' : o === 'cold' || o === 'rain' ? 'cold' : null;
      if (kind) window.simsWorld.loadSheet(`${key}-${kind}`);
      return kind ? `${key}-${kind}` : key;
    };
    function poseActors(t) {
      const act = info.act;
      const out = info.place === 'out';
      const a = actors.ines;
      const b = actors.matteo;
      [a, b].forEach((p) => Object.assign(p, { hidden: !out, prop: null, routineFace: null, ox: 0, oy: 0, sprite: outfitSprite(p.key), anim: 'idle', dir: 'down', scale: 1, shadow: true }));
      a.x = 158; b.x = 246; a.y = b.y = 190;
      const beat = Math.floor(t / 420);
      const f2 = (list, speed = 300) => list[Math.floor(t / speed) % list.length];
      if (!out) return;
      switch (act) {
        case 'wave':
          a.anim = 'emote'; a.frame = f2([0, 2, 1, 2]);
          b.frame = f2([0, 0, 1, 1], 500);
          if (Math.floor(t / 4000) % 2) { b.anim = 'emote'; b.frame = f2([0, 2, 1, 2]); a.anim = 'idle'; a.frame = 0; }
          break;
        case 'hug': case 'anniversary':
          a.x = 196; b.x = 208; a.dir = 'right'; b.dir = 'left';
          a.ox = Math.sin(t / 420) * 0.8 + 1; b.ox = Math.sin(t / 420) * 0.8 - 1;
          a.routineFace = b.routineFace = 'closed';
          if (t % 800 < 30) emit('heart', 201, 140);
          break;
        case 'dance': case 'birthday':
          [a, b].forEach((p, i) => { p.anim = 'emote'; p.frame = (beat + i) % 2 ? 2 : 0; p.dir = ['down', 'left', 'down', 'right'][(beat + i) % 4]; p.oy = -Math.abs(Math.sin(t / 134 + i)) * 3; p.routineFace = 'happy'; });
          if (act === 'dance' && t % 1200 < 30) emit('note', 200, 136);
          break;
        case 'highfive':
          a.x = 196; b.x = 206; a.dir = 'right'; b.dir = 'left';
          a.anim = b.anim = 'emote'; a.frame = b.frame = f2([1, 2, 2, 1], 400);
          a.routineFace = b.routineFace = 'happy';
          break;
        case 'leaves':
          [a, b].forEach((p, i) => { p.anim = 'spellcast'; p.frame = f2([0, 2, 4, 5, 3, 1], 260 + i * 40); p.routineFace = 'happy'; });
          if (t % 700 < 30) emit('leaf', 200, 150);
          break;
        case 'puddles':
          a.x = 252; b.x = 276; a.y = b.y = 188;
          [a, b].forEach((p, i) => { p.anim = 'jump'; p.frame = f2([0, 1, 2, 3, 4], 200 + i * 30); p.routineFace = 'happy'; });
          if (t % 900 < 30) { emit('splash', 252, 188); emit('splash', 276, 188); }
          break;
        case 'umbrella': {
          const k = Math.sin(t / 5000);
          a.x = 180 + k * 40; b.x = a.x + 12; a.y = b.y = 186;
          a.anim = b.anim = 'walk'; a.frame = b.frame = 1 + (Math.floor(t / 130) % 8);
          a.dir = b.dir = Math.cos(t / 5000) > 0 ? 'right' : 'left';
          b.umbrella = true;
          break;
        }
        case 'snowball': {
          const k = (t % 2800) / 2800;
          a.anim = 'thrust'; a.frame = k < 0.4 ? Math.floor(k * 12) % 6 : 0; a.dir = 'right';
          b.dir = 'left'; a.x = 176; b.x = 228;
          if (k > 0.45 && k < 0.6) { b.ox = Math.sin(t / 30) * 1.5; b.routineFace = 'shock'; } else b.routineFace = 'happy';
          a.routineFace = 'happy';
          if (k > 0.25 && k < 0.45) { const s = (k - 0.25) / 0.2; R(c, 180 + s * 44, 160 - Math.sin(s * Math.PI) * 10, 3, 3, '#ffffff'); }
          break;
        }
        case 'stargaze':
          a.x = 194; b.x = 208; a.y = b.y = 188;
          a.anim = b.anim = 'sit'; a.frame = b.frame = 0; a.dir = b.dir = 'up';
          a.shadow = b.shadow = false;
          break;
        case 'water':
          a.x = PLANT_SPOTS[0][0] - 10; a.y = 186; a.dir = 'up';
          a.anim = 'thrust'; a.frame = f2([3, 4, 5, 4], 260); a.prop = 'can';
          b.x = 226; b.anim = 'emote'; b.frame = f2([0, 2], 500);
          if (t % 400 < 30) emit('drop', PLANT_SPOTS[0][0], 150);
          break;
        case 'pack':
          a.x = 182; b.x = 222; a.anim = 'emote'; a.frame = f2([0, 2, 1, 2]);
          break;
        default:
      }
      // Corazones y saltito al tocarlos.
      if (t < loveUntil) { [a, b].forEach((p) => { p.oy -= Math.abs(Math.sin(t / 120)) * 3; p.routineFace = 'blush'; }); if (t % 300 < 30) emit('heart', 200, 132); }
    }

    function faceOf(p, avatar, t) {
      if (t > p.nextBlink) { p.blinkUntil = t + 130; p.nextBlink = t + 2500 + Math.random() * 3500; }
      const base = p.routineFace || MOOD_FACE[avatar?.mood] || null;
      return t < p.blinkUntil && base !== 'closed' ? 'closed' : base;
    }

    function drawActors(t) {
      ['ines', 'matteo'].sort((x, y) => actors[x].y - actors[y].y).forEach((key) => {
        const p = actors[key];
        if (p.hidden) return;
        const avatar = info.avatars?.[key] || {};
        p.face = faceOf(p, avatar, t);
        p.headY = p.y - (p.anim === 'sit' ? 50 : 48) + (p.oy || 0);
        window.simsWorld.drawActor(c, p, t);
        if (p.umbrella) {
          const ux = Math.round(p.x - 6);
          const uy = Math.round(p.headY - 8);
          R(c, ux, uy, 1, 16, '#4a3a30');
          for (let i = 0; i < 9; i += 1) R(c, ux - 16 + i * 0.5, uy - 6 + i, 32 - i, 1, i < 2 ? '#f0705a' : '#e0533f');
          R(c, ux - 16, uy + 3, 32, 1, OL);
          p.umbrella = false;
        }
        // Diamante, estado de ánimo y mensaje sin leer.
        p.plumbob = avatar.plumbob;
        if (PLUMBOB[p.plumbob]) window.simsWorld.drawPlumbob(c, p, t);
        c.font = '8px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
        c.textAlign = 'center';
        const emoji = avatar.mood ? window.umbralScene?.catalog?.MOODS[avatar.mood]?.emoji : '';
        if (emoji) c.fillText(emoji, p.x + 12, p.headY + 2);
        if (avatar.unread) c.fillText('💌', p.x - 12, p.headY + 2 - Math.abs(Math.sin(t / 400)) * 2);
      });
    }

    function emit(type, x, y) {
      particles.push({ type, x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 12, vy: type === 'drop' ? 30 : type === 'leaf' ? -16 : -18, life: 1.4 });
    }
    function drawParticles(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'leaf') p.vy += 20 * dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        c.globalAlpha = Math.min(1, p.life);
        if (p.type === 'heart') pixels(c, [[p.x - 3, p.y, 2, 1], [p.x + 1, p.y, 2, 1], [p.x - 3, p.y + 1, 6, 2], [p.x - 2, p.y + 3, 4, 1], [p.x - 1, p.y + 4, 2, 1]], '#ef476f');
        else if (p.type === 'note') pixels(c, [[p.x, p.y, 1, 4], [p.x - 2, p.y + 3, 2, 2], [p.x + 1, p.y, 2, 1]], '#7a62b3');
        else if (p.type === 'leaf') R(c, p.x, p.y, 2, 1, info.vars.canopy);
        else if (p.type === 'drop') R(c, p.x, p.y, 1, 2, '#7cc4e6');
        else if (p.type === 'splash') pixels(c, [[p.x - 4, p.y - 3, 1, 1], [p.x + 4, p.y - 4, 1, 1], [p.x, p.y - 6, 1, 1]], '#c8def0');
        c.globalAlpha = 1;
      }
    }

    // Luz de noche: todo más oscuro salvo las ventanas encendidas y el farol.
    function drawNight() {
      if (info.nightness < 0.15) return;
      c.save();
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = Math.min(0.75, info.nightness * 0.65);
      c.fillStyle = '#3a4270';
      c.fillRect(0, 0, GW, GH);
      c.restore();
      c.save();
      c.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, a) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,200,120,${a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      };
      (info.lit || []).forEach((room) => { const w = WINDOWS[room]; if (w) glow(w[0] + 7, w[1] + 6, 22, 0.35 * info.nightness); });
      if (info.porch) glow(DOOR.x + DOOR.w + 5, DOOR.y + 5, 26, 0.45);
      c.restore();
    }

    function render(t, dt) {
      if (!info) return;
      bake();
      c.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
      c.imageSmoothingEnabled = false;
      drawSkyFx(t);
      c.drawImage(background, 0, 0);
      drawHouseFx(t);
      drawTree(t);
      drawPlants(t);
      drawDecor(t);
      poseActors(t);
      drawActors(t);
      drawParticles(dt);
      drawFauna(t);
      drawWeather(t);
      drawNight();
    }
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (paused || document.hidden) return;
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      render(t, dt);
    }
    raf = requestAnimationFrame(loop);

    // Toques: muñecos, plantas, buzón, nota y puerta.
    const toWorld = (event) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / rect.width;
      return { x: ((event.clientX - rect.left) * dpr - view.ox) / view.s, y: ((event.clientY - rect.top) * dpr - view.oy) / view.s };
    };
    canvas.addEventListener('click', (event) => {
      if (!info) return;
      const p = toWorld(event);
      const person = ['ines', 'matteo'].find((key) => { const a = actors[key]; return !a.hidden && p.x > a.x - 11 && p.x < a.x + 11 && p.y > a.y - 50 && p.y < a.y + 2; });
      if (person) return onTap?.({ type: 'person', key: person }, event);
      const plantIndex = PLANT_SPOTS.findIndex(([px, py], i) => info.plants?.[i] && p.x > px - 7 && p.x < px + 7 && p.y > py - 24 && p.y < py + 2);
      if (plantIndex >= 0) return onTap?.({ type: 'plant', id: info.plants[plantIndex].id }, event);
      if (p.x > 84 && p.x < 124 && p.y > 114 && p.y < 172) return onTap?.({ type: 'mail' }, event);
      if (p.x > DOOR.x - 2 && p.x < DOOR.x + DOOR.w + 2 && p.y > DOOR.y && p.y < DOOR.y + DOOR.h) return onTap?.({ type: info.note ? 'note' : 'door' }, event);
    });

    return {
      set(next) { info = next; },
      love() { loveUntil = performance.now() + 2600; },
      setPaused(value) { paused = value; },
      // Rectángulo en pantalla de un muñeco (para colocar su bocadillo).
      rectOf(key) {
        const rect = canvas.getBoundingClientRect();
        const dpr = canvas.width / rect.width;
        const a = actors[key];
        const x = (a.x * view.s + view.ox) / dpr + rect.left;
        const top = ((a.y - 50) * view.s + view.oy) / dpr + rect.top;
        return { left: x - 10, right: x + 10, top, bottom: top + 40, width: 20, height: 40 };
      },
      destroy() { cancelAnimationFrame(raf); observer?.disconnect(); }
    };
  }

  window.umbralGarden = { create };
})();
