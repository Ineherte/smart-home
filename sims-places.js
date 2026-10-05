// Sitios a los que podéis ir desde la casa del modo Sims, en el mismo pixel art:
// - Turín: un paseo por los pórticos con la Mole Antonelliana, el tranvía naranja, un café
//   con bicerin y una gelateria.
// - Chieti: la casa de la familia de Matteo, con la Majella al fondo, la pérgola con parra,
//   la mesa larga para comer todos juntos, la parrilla de arrosticini y el huerto.
// - España: la casa de los padres de Ines, encalada, con macetas, naranjo, fuente, hamaca,
//   paella en la mesa y la camita de Kika.
// Cada sitio dice qué se dibuja (bake: lo fijo; objects: lo que se ordena por profundidad y
// se puede tocar), por dónde se anda (walk), las luces de noche y dónde se pone cada uno
// (spot, seats). La lógica está en sims.js.
(function () {
  if (!window.simsWorld) return;
  const { W, H, OL, registerScene } = window.simsWorld;
  const { R, box, oval, ovalBox, shadow, pixels, tone, line, pixelText, textWidth } = window.simsWorld.paint;

  const canvasOf = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    return canvas;
  };
  // Montañas o colinas: una silueta rellena desde la altura h(x) hasta abajo.
  function ridge(c, h, bottom, color, cap) {
    for (let x = 0; x < W; x += 1) {
      const top = Math.round(h(x));
      R(c, x, top, 1, bottom - top, color);
      if (cap && top < cap.below) R(c, x, top, 1, Math.max(1, Math.round((cap.below - top) * 0.45)), cap.color);
    }
  }
  // Un árbol redondeado (copa de varios óvalos) para olivos, naranjos y árboles de calle.
  function roundTree(c, x, y, size, leaves, fruit) {
    shadow(c, x, y, size * 0.8, 3, 0.25);
    R(c, x - 2, y - size * 1.2, 4, size * 1.2, OL);
    R(c, x - 1, y - size * 1.2, 2, size * 1.2, '#6a4a34');
    const cy = y - size * 1.6;
    [[0, 0, 1], [-0.6, 0.25, 0.7], [0.6, 0.2, 0.7], [0, -0.45, 0.7]].forEach(([dx, dy, k]) => ovalBox(c, x + dx * size, cy + dy * size, size * k, size * k * 0.8, leaves));
    [[0, -0.2, 0.6], [-0.4, -0.5, 0.35]].forEach(([dx, dy, k]) => oval(c, x + dx * size, cy + dy * size, size * k, size * k * 0.7, tone(leaves, 0.15)));
    if (fruit) for (let i = 0; i < 9; i += 1) R(c, x + Math.round(Math.cos(i * 2.3) * size * 0.75), cy + Math.round(Math.sin(i * 1.7) * size * 0.5), 2, 2, fruit);
  }
  // Silla vista desde arriba (respaldo detrás o delante según hacia dónde mira quien se sienta).
  function chair(c, x, y, back, color = '#a87048') {
    shadow(c, x, y + 6, 7, 2, 0.2);
    box(c, x - 6, y - 4, 12, 9, color);
    if (back === 'up') box(c, x - 6, y - 12, 12, 6, tone(color, -0.15));
    if (back === 'down') box(c, x - 6, y + 4, 12, 4, tone(color, -0.15));
    if (back === 'left') box(c, x - 8, y - 10, 4, 16, tone(color, -0.15));
    if (back === 'right') box(c, x + 4, y - 10, 4, 16, tone(color, -0.15));
  }

  // =====================================================================================
  // TURÍN
  // =====================================================================================
  const MOLE_X = 330;
  function mole(c) {
    const x = MOLE_X;
    // Aguja y la estrella de arriba.
    R(c, x - 1, 6, 2, 40, OL);
    R(c, x, 6, 1, 40, '#9a8d74');
    pixels(c, [[x - 1, 2, 3, 1], [x, 1, 1, 3]], '#f2d27a');
    // Linterna de dos pisos con columnitas.
    box(c, x - 6, 36, 12, 9, '#d8cbb0');
    box(c, x - 8, 45, 16, 9, '#d8cbb0');
    for (let i = -6; i <= 6; i += 3) R(c, x + i, 47, 1, 6, '#9a8d74');
    for (let i = -4; i <= 4; i += 3) R(c, x + i, 38, 1, 6, '#9a8d74');
    // La cúpula: muy alta y estrecha, con sus nervios y ventanitas.
    for (let y = 54; y < 134; y += 1) {
      const k = (y - 54) / 80;
      const half = Math.round(7 + Math.pow(k, 1.4) * 24);
      R(c, x - half - 1, y, half * 2 + 2, 1, OL);
      R(c, x - half, y, half, 1, '#c9bb9e');
      R(c, x, y, half, 1, '#b3a587');
      for (let r = -half + 4; r < half; r += 6) R(c, x + r, y, 1, 1, '#9a8d74');
    }
    [[96, 3], [114, 4]].forEach(([wy, n]) => { for (let i = 0; i < n; i += 1) { const wx = x - (n - 1) * 5 + i * 10; box(c, wx - 2, wy, 4, 6, '#5a5040'); } });
    // Tambor con columnas y el edificio de abajo.
    box(c, x - 32, 133, 64, 14, '#ddd0b5');
    for (let i = -28; i <= 28; i += 4) R(c, x + i, 135, 1, 10, '#a99c80');
    box(c, x - 42, 146, 84, 56, '#e3d6bb');
    R(c, x - 42, 146, 84, 3, '#f0e6d0');
    for (let i = -36; i <= 36; i += 12) {
      box(c, x + i - 3, 156, 6, 14, '#5a5040');
      R(c, x + i - 2, 155, 4, 1, '#5a5040');
      R(c, x + i + 4, 150, 2, 50, '#d0c2a4');
    }
  }
  const TURIN_BUILDINGS = [
    { x: 0, w: 118, top: 116, color: '#ecc884', sign: ['CAFFE BICERIN', '#2f4a3a', '#f4e6c4'] },
    { x: 118, w: 126, top: 124, color: '#e0ab83' },
    { x: 244, w: 44, top: 150, color: '#e9d5a9' },
    { x: 288, w: 88, top: 186, color: '#e8c99b' },
    { x: 376, w: 136, top: 120, color: '#e8bb8e', sign: ['GELATERIA', '#e89aaf', '#fff6f0'] }
  ];
  function turinFacade(c, b) {
    const { x, w, top, color } = b;
    R(c, x, top, w, 232 - top, color);
    R(c, x, top, w, 1, tone(color, 0.3));
    R(c, x, top + 3, w, 3, tone(color, -0.22));
    R(c, x + w - 1, top, 1, 232 - top, tone(color, -0.25));
    // Ventanas con contraventanas verdes y balconcillos de hierro.
    for (let wy = top + 12; wy < 186; wy += 20) {
      for (let wx = x + 7; wx < x + w - 10; wx += 16) {
        box(c, wx, wy, 7, 11, '#4a5866');
        R(c, wx + 1, wy + 1, 5, 1, '#7a8a9a');
        R(c, wx - 3, wy, 3, 11, '#5f7f5a');
        R(c, wx + 7, wy, 3, 11, '#5f7f5a');
        if (((wy - top) / 20) % 2 === 1) { R(c, wx - 3, wy + 11, 13, 1, OL); for (let k = 0; k < 13; k += 3) R(c, wx - 3 + k, wy + 9, 1, 2, OL); }
      }
    }
    // Soportales (los pórticos de Turín).
    R(c, x, 190, w, 6, tone(color, -0.12));
    for (let ax = x + 4; ax < x + w - 12; ax += 24) {
      R(c, ax, 200, 16, 32, '#3a2a22');
      R(c, ax + 2, 198, 12, 2, '#3a2a22');
      R(c, ax + 4, 196, 8, 2, '#3a2a22');
      R(c, ax + 1, 224, 14, 8, '#6a4a30');
      R(c, ax + 3, 210, 10, 10, '#f2d9a0');
      pixels(c, [[ax + 4, 214, 2, 3], [ax + 8, 213, 3, 4], [ax + 11, 215, 1, 2]], ['#c0503e', '#3d6a9a', '#e3b86a'][(ax / 24) % 3 | 0]);
    }
    if (b.sign) {
      const [text, bg, fg] = b.sign;
      const tw = textWidth(text);
      const sx = x + Math.round((w - tw) / 2);
      box(c, sx - 3, 190, tw + 6, 9, bg);
      pixelText(c, text, sx, 192, fg);
    }
  }
  function sanpietrini(c, x0, y0, w, h) {
    R(c, x0, y0, w, h, '#7d736a');
    for (let y = y0; y < y0 + h; y += 4) {
      for (let x = x0 - ((y / 4) % 2) * 3; x < x0 + w; x += 6) {
        const shade = ((x * 7 + y * 13) % 5) - 2;
        R(c, x + 1, y + 1, 4, 2, tone('#9a8f84', shade * 0.04));
        R(c, x + 1, y + 1, 4, 1, tone('#9a8f84', 0.12 + shade * 0.04));
      }
    }
  }
  function slabs(c, x0, y0, w, h, base) {
    R(c, x0, y0, w, h, base);
    for (let y = y0; y < y0 + h; y += 10) R(c, x0, y, w, 1, tone(base, -0.12));
    for (let y = y0; y < y0 + h; y += 10) for (let x = x0 + ((y / 10) % 2) * 9; x < x0 + w; x += 18) R(c, x, y, 1, 10, tone(base, -0.12));
  }
  function bakeTurin() {
    const canvas = canvasOf();
    const c = canvas.getContext('2d');
    // Los Alpes al fondo, con nieve.
    ridge(c, (x) => 150 - Math.abs(Math.sin(x / 37)) * 20 - Math.abs(Math.sin(x / 91 + 1)) * 22, 200, '#a9b8cc', { below: 124, color: '#f4f6fa' });
    ridge(c, (x) => 160 - Math.abs(Math.sin(x / 23 + 2)) * 10, 200, '#93a4b8');
    mole(c);
    TURIN_BUILDINGS.forEach((b) => turinFacade(c, b));
    // Suelo de los soportales, bordillo, adoquines con las vías del tranvía y la acera.
    slabs(c, 0, 232, W, 30, '#d6cec0');
    for (let i = 0; i < 6; i += 1) { c.globalAlpha = 0.18 * (1 - i / 6); R(c, 0, 232 + i, W, 1, '#000000'); }
    c.globalAlpha = 1;
    R(c, 0, 262, W, 3, '#b8b0a2');
    R(c, 0, 265, W, 1, '#5a524a');
    sanpietrini(c, 0, 266, W, 64);
    [288, 300].forEach((ry) => { R(c, 0, ry, W, 1, '#e4e4e4'); R(c, 0, ry + 1, W, 1, '#4a4a4a'); });
    R(c, 0, 330, W, 3, '#b8b0a2');
    R(c, 0, 330, W, 1, '#5a524a');
    slabs(c, 0, 333, W, 51, '#cfc7b9');
    // Cable del tranvía.
    R(c, 0, 246, W, 1, '#2b2b2b');
    return canvas;
  }
  function lampPost(c, x, s) {
    shadow(c, x, 340, 4, 1, 0.25);
    box(c, x - 3, 334, 6, 6, '#2a3a30');
    R(c, x - 1, 298, 2, 36, '#2a3a30');
    R(c, x - 4, 298, 8, 1, '#2a3a30');
    box(c, x - 4, 288, 8, 10, '#33433a');
    R(c, x - 2, 290, 4, 6, s.lamps ? '#ffe9a8' : '#e6dcc0');
    R(c, x - 1, 285, 2, 3, '#2a3a30');
  }
  function bench(c) {
    shadow(c, 258, 365, 24, 2, 0.25);
    R(c, 238, 358, 2, 7, OL);
    R(c, 276, 358, 2, 7, OL);
    box(c, 236, 350, 44, 5, '#8a5a3a');
    box(c, 236, 355, 44, 5, '#a87048');
  }
  function cafeTable(c) {
    chair(c, 90, 356, 'left', '#2f4a3a');
    chair(c, 118, 356, 'right', '#2f4a3a');
    shadow(c, 104, 362, 9, 2, 0.25);
    R(c, 103, 352, 2, 10, OL);
    ovalBox(c, 104, 350, 9, 4, '#e9e4d8');
    box(c, 101, 345, 5, 5, '#5a3a2a');
    R(c, 102, 345, 3, 1, '#f4e6c4');
  }
  function kiosk(c) {
    shadow(c, 484, 372, 18, 2, 0.25);
    box(c, 466, 330, 36, 42, '#3f6a4a');
    R(c, 466, 326, 36, 5, '#2f5a3a');
    R(c, 469, 336, 30, 22, '#f4efe2');
    for (let i = 0; i < 6; i += 1) R(c, 470 + i * 5, 338 + (i % 2) * 9, 4, 7, ['#c0503e', '#3d6a9a', '#e3b86a', '#8a5aa8', '#3a9a5a', '#e98a6a'][i]);
    pixelText(c, 'EDICOLA', 470, 360, '#f4efe2');
  }
  function tram(c, s) {
    if (!s.tram) return;
    const x = Math.round(s.tram.x);
    const y = 268;
    shadow(c, x + 60, 302, 62, 3, 0.3);
    box(c, x, y, 120, 32, '#e5762b');
    R(c, x + 2, y + 2, 116, 10, '#f2e2c0');
    for (let i = 6; i < 112; i += 12) box(c, x + i, y + 3, 9, 8, '#3a4a5a');
    R(c, x + 2, y + 22, 116, 2, '#c45a1a');
    R(c, x + 1, y - 2, 118, 3, '#7a7a7a');
    line(c, x + 60, y - 2, x + 52, 247, '#2b2b2b');
    R(c, x + 50, 246, 6, 1, '#2b2b2b');
    [x + 16, x + 30, x + 88, x + 102].forEach((wx) => ovalBox(c, wx, y + 31, 3, 2, '#2b2b2b'));
    pixelText(c, '15', x + 104, y + 15, '#f2e2c0');
  }
  registerScene({
    id: 'turin',
    label: 'Turín',
    indoor: false,
    horizon: 200,
    bake: bakeTurin,
    walk: [[6, 238, 500, 140]],
    lights: [[60, 294, 46], [190, 294, 46], [320, 294, 46], [450, 294, 46], [56, 214, 34], [440, 214, 34], [260, 214, 30]],
    objects: [
      { id: 'mole', sort: 1, hit: [290, 0, 80, 150], spot: { x: 330, y: 312, dir: 'up' }, selfie: { ines: { x: 324, y: 310 }, matteo: { x: 334, y: 318 } } },
      { id: 'cafe', sort: 358, hit: [20, 188, 84, 46], block: [84, 344, 42, 16], draw: cafeTable, seats: [{ x: 90, y: 358, dir: 'right', sortY: 362, exit: { x: 90, y: 374 } }, { x: 118, y: 358, dir: 'left', sortY: 362, exit: { x: 118, y: 374 } }] },
      { id: 'gelato', sort: 1, hit: [400, 188, 90, 46], spot: { x: 444, y: 252, dir: 'up' } },
      { id: 'bench', sort: 364, hit: [234, 346, 48, 20], block: [236, 352, 44, 10], draw: bench, seats: [{ x: 248, y: 362, dir: 'down', sortY: 368, exit: { x: 248, y: 376 } }, { x: 268, y: 362, dir: 'down', sortY: 368, exit: { x: 268, y: 376 } }] },
      { id: 'kiosk', sort: 372, hit: [464, 324, 40, 50], block: [466, 330, 36, 42], draw: kiosk, spot: { x: 454, y: 360, dir: 'right' } },
      { id: 'tram', sort: 302, draw: tram },
      ...[60, 190, 320, 450].map((x, i) => ({ id: `lamp${i}`, sort: 341, block: [x - 3, 334, 6, 6], draw: (c, s) => lampPost(c, x, s) })),
      ...[150, 400].map((x, i) => ({ id: `tree${i}`, sort: 373, block: [x - 9, 358, 18, 14], draw: (c) => { box(c, x - 9, 360, 18, 12, '#7a8a80'); roundTree(c, x, 362, 12, '#4c8a52'); } }))
    ]
  });

  // =====================================================================================
  // CHIETI (Abruzzo): la casa de la familia de Matteo
  // =====================================================================================
  function bakeChieti() {
    const canvas = canvasOf();
    const c = canvas.getContext('2d');
    // La Majella, con nieve arriba, y colinas verdes con olivos.
    ridge(c, (x) => 150 - 78 * Math.exp(-(((x - 340) / 120) ** 2)) - Math.abs(Math.sin(x / 31)) * 8, 210, '#8296b0', { below: 92, color: '#f4f6fa' });
    ridge(c, (x) => 158 - Math.abs(Math.sin(x / 57 + 1)) * 14, 210, '#93ad6c');
    ridge(c, (x) => 176 - Math.abs(Math.sin(x / 41 + 3)) * 10, 232, '#7f9c5a');
    // Hileras de olivos y algún ciprés en las colinas.
    for (let i = 0; i < 46; i += 1) {
      const ox = (i * 61) % W;
      const oy = 168 + ((i * 29) % 44);
      oval(c, ox, oy, 3, 2, i % 3 ? '#6f8f55' : '#5f7f4a');
      R(c, ox - 2, oy + 2, 4, 1, 'rgba(0,0,0,.12)');
    }
    [[214, 168], [232, 172], [500, 170]].forEach(([cx, cy]) => { oval(c, cx, cy - 8, 2, 9, '#2f4a32'); R(c, cx, cy, 1, 3, '#4a3a2a'); });
    // Chieti en su colina (a la derecha), con el campanario de la catedral.
    ridge(c, (x) => (x > 360 ? 150 - Math.sin(((x - 360) / 152) * Math.PI) * 36 : 232), 232, '#8aa45e');
    for (let i = 0; i < 11; i += 1) {
      const hx = 372 + i * 12;
      const hy = 128 - Math.round(Math.sin((i / 10) * Math.PI) * 18);
      box(c, hx, hy, 11, 11, i % 3 ? '#efe2c8' : '#e6c99a');
      R(c, hx - 1, hy - 3, 13, 4, '#c0603e');
      R(c, hx + 4, hy + 5, 2, 3, '#4a5866');
    }
    box(c, 436, 82, 9, 30, '#e6d4b0');
    R(c, 436, 77, 9, 6, '#c0603e');
    R(c, 439, 71, 2, 6, '#8a6a4a');
    R(c, 438, 88, 4, 5, '#4a3a30');
    // La casa de la familia: fachada ocre, tejas, contraventanas verdes y balcón con geranios.
    R(c, 6, 102, 176, 14, '#b85a3a');
    for (let i = 6; i < 182; i += 4) R(c, i, 102, 2, 14, '#a04a2e');
    R(c, 4, 114, 180, 2, OL);
    R(c, 8, 116, 172, 116, '#e3c48c');
    for (let y = 120; y < 232; y += 8) { R(c, 8, y, 6, 6, '#cfae74'); R(c, 174, y + 4, 6, 6, '#cfae74'); }
    [[30, 130], [76, 130], [122, 130], [30, 172], [122, 172]].forEach(([wx, wy]) => {
      box(c, wx, wy, 12, 18, '#4a5866');
      R(c, wx - 5, wy, 5, 18, '#5f8a5a');
      R(c, wx + 12, wy, 5, 18, '#5f8a5a');
      R(c, wx - 2, wy + 18, 16, 2, '#efe2c8');
    });
    R(c, 68, 150, 44, 2, OL);
    for (let i = 68; i < 112; i += 3) R(c, i, 146, 1, 4, OL);
    for (let i = 70; i < 110; i += 4) { R(c, i, 144, 3, 3, '#3a8a4a'); R(c, i + 1, 143, 2, 2, '#e0303e'); }
    // Puerta de madera con arco y farol.
    R(c, 74, 186, 28, 46, OL);
    R(c, 75, 190, 26, 42, '#7a4a2c');
    R(c, 77, 188, 22, 3, '#7a4a2c');
    R(c, 87, 192, 1, 40, '#5a3a20');
    R(c, 84, 210, 2, 2, '#e3b86a');
    box(c, 106, 196, 6, 8, '#3a3a30');
    R(c, 107, 198, 4, 4, '#ffe9a8');
    // Pérgola con la parra, uvas y lucecitas.
    R(c, 186, 196, 4, 40, '#7a5a3a');
    R(c, 400, 196, 4, 40, '#7a5a3a');
    R(c, 182, 194, 226, 5, '#8a6a4a');
    R(c, 182, 194, 226, 1, '#a88a6a');
    for (let i = 0; i < 34; i += 1) ovalBox(c, 186 + i * 6.5, 192 + ((i * 7) % 5), 4, 3, i % 2 ? '#5a9a4a' : '#4a8a3c');
    for (let i = 0; i < 9; i += 1) pixels(c, [[200 + i * 24, 200, 3, 2], [201 + i * 24, 202, 2, 2], [201 + i * 24, 204, 1, 1]], '#6a3a7a');
    for (let x = 188; x < 404; x += 1) { const sag = Math.round(Math.sin(((x - 188) / 54) * Math.PI) ** 2 * 6); if (x % 9 === 0) R(c, x, 206 + sag, 2, 2, '#ffd77a'); else R(c, x, 206 + sag, 1, 1, '#5a5a5a'); }
    // Suelo de barro cocido de la terraza.
    for (let y = 232; y < H; y += 12) {
      for (let x = ((y / 12) % 2) * 8 - 8; x < W; x += 16) {
        const color = tone('#c67b55', (((x * 3 + y * 5) % 7) - 3) * 0.025);
        R(c, x, y, 16, 12, color);
        R(c, x, y, 16, 1, tone(color, 0.12));
        if (x > 0) R(c, x, y, 1, 12, tone(color, -0.15));
      }
    }
    for (let i = 0; i < 6; i += 1) { c.globalAlpha = 0.2 * (1 - i / 6); R(c, 0, 232 + i, W, 1, '#000000'); }
    c.globalAlpha = 1;
    // Macetas junto a la pared y el huerto.
    [[20, 238], [140, 238], [166, 238]].forEach(([px, py]) => { box(c, px - 5, py, 10, 8, '#c47a52'); ovalBox(c, px, py - 3, 5, 4, '#4a8a3c'); R(c, px - 1, py - 6, 2, 2, '#e0303e'); });
    R(c, 400, 340, 104, 40, OL);
    R(c, 401, 341, 102, 38, '#6a4a30');
    for (let i = 0; i < 6; i += 1) {
      const tx = 410 + i * 16;
      R(c, tx, 326, 1, 46, '#a88a6a');
      for (let k = 0; k < 4; k += 1) ovalBox(c, tx + (k % 2 ? 3 : -3), 332 + k * 9, 3, 2, '#4a8a3c');
      R(c, tx + 2, 340, 2, 2, '#e0303e');
      R(c, tx - 3, 352, 2, 2, '#e0303e');
    }
    return canvas;
  }
  // Mesa larga para el pranzo della domenica.
  function familyTable(c) {
    shadow(c, 292, 294, 100, 4, 0.25);
    box(c, 196, 262, 192, 26, '#8a5a3a');
    for (let x = 198; x < 386; x += 6) for (let y = 264; y < 286; y += 6) R(c, x, y, 6, 6, ((x - 198) / 6 + (y - 264) / 6) % 2 ? '#f4f1ea' : '#c0303e');
    R(c, 198, 286, 188, 2, '#c8c2b4');
    [216, 256, 296, 336, 372].forEach((px) => { ovalBox(c, px, 268, 5, 3, '#ffffff'); oval(c, px, 268, 3, 2, '#e8a050'); });
    [236, 292, 348].forEach((px) => { ovalBox(c, px, 282, 5, 3, '#ffffff'); oval(c, px, 282, 3, 2, '#e8a050'); });
    box(c, 274, 270, 5, 10, '#2f5a2a');
    R(c, 275, 268, 3, 2, OL);
    ovalBox(c, 312, 275, 9, 4, '#e9e1d2');
    for (let i = 0; i < 6; i += 1) { R(c, 305 + i * 3, 270, 1, 6, '#c9a06a'); R(c, 305 + i * 3, 273, 2, 2, '#8a4a2a'); }
    ovalBox(c, 250, 276, 6, 3, '#c9a06a');
    pixels(c, [[246, 274, 3, 2], [251, 274, 3, 2]], '#e6c48a');
  }
  function chietiChairs(c, back) {
    if (back === 'up') [216, 256, 296, 336, 372].forEach((x) => chair(c, x, 258, 'up'));
    else [236, 292, 348].forEach((x) => chair(c, x, 300, 'down'));
  }
  function grill(c, s, t) {
    shadow(c, 456, 324, 28, 2, 0.25);
    R(c, 432, 314, 2, 10, OL);
    R(c, 478, 314, 2, 10, OL);
    box(c, 428, 304, 56, 12, '#3a3a40');
    R(c, 430, 306, 52, 4, s.props.grill ? '#e0533f' : '#5a3a2a');
    for (let i = 0; i < 12; i += 1) { R(c, 432 + i * 4, 300, 1, 10, '#c9a06a'); R(c, 431 + i * 4, 304, 3, 3, '#8a4a2a'); }
    if (s.props.grill) {
      c.globalAlpha = 0.5;
      for (let i = 0; i < 4; i += 1) oval(c, 440 + i * 10 + Math.sin(t / 300 + i) * 2, 290 - ((t / 30 + i * 9) % 30), 3, 3, '#e8e8e8');
      c.globalAlpha = 1;
    }
  }
  function vespa(c) {
    shadow(c, 46, 366, 22, 3, 0.3);
    ovalBox(c, 30, 362, 6, 4, '#2b2b2b');
    ovalBox(c, 62, 362, 6, 4, '#2b2b2b');
    box(c, 26, 344, 44, 16, '#8fc3d6');
    R(c, 28, 346, 40, 2, '#b8e0ea');
    box(c, 30, 340, 18, 6, '#5a3a2a');
    R(c, 62, 334, 2, 12, '#7a7a7a');
    R(c, 58, 332, 10, 2, '#7a7a7a');
    R(c, 66, 348, 4, 3, '#ffe9a8');
  }
  function rockingChair(c) {
    shadow(c, 114, 264, 10, 2, 0.22);
    R(c, 102, 262, 24, 2, '#6a4a34');
    box(c, 104, 250, 20, 10, '#a87048');
    box(c, 104, 240, 20, 10, '#8a5a3a');
    for (let i = 106; i < 122; i += 4) R(c, i, 242, 1, 7, '#6a4a34');
  }
  registerScene({
    id: 'chieti',
    label: 'Chieti',
    indoor: false,
    horizon: 160,
    bake: bakeChieti,
    walk: [[6, 238, 500, 140]],
    lights: [[108, 200, 40], [220, 210, 46], [300, 210, 46], [380, 210, 46], [36, 140, 24], [128, 140, 24]],
    objects: [
      { id: 'chairsBack', sort: 255, draw: (c) => chietiChairs(c, 'up') },
      { id: 'familytable', sort: 292, hit: [194, 248, 196, 62], block: [196, 262, 192, 28], draw: familyTable,
        seats: [
          ...[216, 256, 296, 336, 372].map((x) => ({ x, y: 266, dir: 'down', sortY: 270, exit: { x, y: 246 } })),
          ...[236, 292, 348].map((x) => ({ x, y: 304, dir: 'up', sortY: 306, exit: { x, y: 322 } }))
        ] },
      { id: 'chairsFront', sort: 301, draw: (c) => chietiChairs(c, 'down') },
      { id: 'grill', sort: 324, hit: [424, 290, 64, 36], block: [428, 304, 56, 20], draw: grill, spot: { x: 456, y: 334, dir: 'up' } },
      { id: 'olive', sort: 300, hit: [450, 214, 50, 90], block: [462, 288, 16, 12], draw: (c) => roundTree(c, 470, 300, 22, '#8aa080'), spot: { x: 440, y: 288, dir: 'right' } },
      { id: 'lemon', sort: 300, block: [152, 288, 18, 14], draw: (c) => { box(c, 152, 288, 18, 14, '#c47a52'); roundTree(c, 161, 290, 11, '#4c8a52', '#f2d230'); } },
      { id: 'rocking', sort: 263, block: [102, 240, 24, 24], draw: rockingChair, seats: [{ x: 114, y: 258, dir: 'down', sortY: 266, exit: { x: 114, y: 276 } }] },
      { id: 'vespa', sort: 366, hit: [22, 326, 52, 44], block: [24, 338, 48, 26], draw: vespa, spot: { x: 84, y: 356, dir: 'left' } },
      { id: 'orto', sort: 1, hit: [398, 322, 106, 58], block: [400, 338, 104, 40], spot: { x: 452, y: 330, dir: 'down' } },
      { id: 'majella', sort: 0, hit: [200, 40, 300, 120], spot: { x: 300, y: 244, dir: 'up' } }
    ]
  });

  // =====================================================================================
  // ESPAÑA: la casa de los padres de Ines (con Kika)
  // =====================================================================================
  function bakeSpain() {
    const canvas = canvasOf();
    const c = canvas.getContext('2d');
    // Lomas secas con olivos y un campanario a lo lejos.
    ridge(c, (x) => 128 - Math.abs(Math.sin(x / 53)) * 16, 160, '#d6c08e');
    ridge(c, (x) => 140 - Math.abs(Math.sin(x / 33 + 2)) * 8, 160, '#c4ac78');
    for (let i = 0; i < 24; i += 1) ovalBox(c, (i * 47) % W, 132 + ((i * 13) % 14), 2, 2, '#7a8a52');
    box(c, 390, 54, 14, 46, '#efe6d4');
    R(c, 388, 50, 18, 5, '#c0603e');
    R(c, 395, 40, 4, 10, '#c0603e');
    R(c, 395, 62, 4, 7, '#4a3a30');
    // La casa encalada: tejas, zócalo azul, rejas, macetas y buganvilla.
    R(c, 0, 90, W, 12, '#b85a3a');
    for (let x = 0; x < W; x += 5) { R(c, x, 90, 3, 12, '#c96b4b'); R(c, x, 100, 3, 2, '#8a3a2a'); }
    R(c, 0, 102, W, 2, OL);
    R(c, 0, 104, W, 128, '#f6f3ec');
    for (let i = 0; i < 160; i += 1) R(c, (i * 37) % W, 104 + ((i * 53) % 118), 1, 1, '#e6e1d6');
    R(c, 0, 220, W, 12, '#3d6a9a');
    R(c, 0, 220, W, 1, '#6a94c0');
    [[36, 130], [120, 130], [340, 130], [430, 130], [36, 174], [430, 174]].forEach(([wx, wy]) => {
      box(c, wx, wy, 22, 26, '#3a4a5a');
      R(c, wx + 2, wy + 2, 18, 22, '#5a7a9a');
      for (let k = 3; k < 22; k += 4) R(c, wx + k, wy + 1, 1, 24, OL);
      R(c, wx + 1, wy + 12, 20, 1, OL);
      R(c, wx - 6, wy, 6, 26, '#4a7a4a');
      R(c, wx + 22, wy, 6, 26, '#4a7a4a');
      for (let k = 0; k < 3; k += 1) { box(c, wx - 2 + k * 9, wy + 27, 7, 5, '#3d6a9a'); R(c, wx - 1 + k * 9, wy + 25, 5, 2, '#3a8a4a'); R(c, wx + k * 9, wy + 24, 3, 2, '#e0303e'); }
    });
    // Macetas azules colgadas en la pared (como en los patios del sur).
    for (let row = 0; row < 2; row += 1) for (let i = 0; i < 6; i += 1) {
      const px = 188 + i * 14 + row * 7;
      const py = 118 + row * 18;
      box(c, px, py, 7, 6, '#3d6a9a');
      ovalBox(c, px + 3, py - 2, 4, 3, '#3a8a4a');
      R(c, px + 2, py - 4, 3, 2, i % 2 ? '#e0303e' : '#f08ab0');
    }
    // Puerta verde con arco y azulejo con el número.
    R(c, 234, 178, 44, 54, OL);
    R(c, 236, 184, 40, 48, '#3f6a4a');
    R(c, 240, 180, 32, 5, '#3f6a4a');
    R(c, 255, 186, 2, 46, '#2f5a3a');
    R(c, 250, 206, 2, 2, '#e3b86a');
    R(c, 260, 206, 2, 2, '#e3b86a');
    box(c, 282, 190, 10, 10, '#f4f1ea');
    R(c, 284, 192, 6, 6, '#3d6a9a');
    pixelText(c, '7', 286, 193, '#f4f1ea');
    // Buganvilla trepando por la derecha.
    for (let i = 0; i < 90; i += 1) {
      const bx = 470 + Math.round(Math.sin(i * 1.7) * 26);
      const by = 104 + ((i * 23) % 120);
      R(c, bx, by, 3, 3, i % 4 ? '#d6337a' : '#4a8a3c');
    }
    R(c, 488, 120, 2, 112, '#6a4a34');
    // Patio: barro con olambrillas azules, la camita de Kika y su cuenco.
    for (let y = 232; y < H; y += 24) {
      for (let x = 0; x < W; x += 24) {
        R(c, x, y, 24, 24, tone('#cf8e62', ((((x + y) / 24) % 3) - 1) * 0.025));
        R(c, x, y, 24, 1, '#dca07a');
        R(c, x, y, 1, 24, '#b8784e');
        if (((x + y) / 24) % 2 === 0) {
          R(c, x - 2, y - 2, 5, 5, '#f4f1ea');
          R(c, x - 1, y - 1, 3, 3, '#5a86b4');
        }
      }
    }
    // Faroles de hierro en la fachada.
    [[200, 186], [320, 186]].forEach(([lx, ly]) => { R(c, lx - 1, ly - 6, 2, 6, OL); box(c, lx - 4, ly, 8, 10, '#2b2b2b'); R(c, lx - 2, ly + 2, 4, 6, '#ffe9a8'); });
    for (let i = 0; i < 6; i += 1) { c.globalAlpha = 0.2 * (1 - i / 6); R(c, 0, 232 + i, W, 1, '#000000'); }
    c.globalAlpha = 1;
    ovalBox(c, 302, 248, 14, 6, '#8a5aa8');
    oval(c, 302, 247, 10, 4, '#b08ad0');
    ovalBox(c, 324, 250, 4, 2, '#c0c8cc');
    oval(c, 324, 250, 3, 1, '#7cc4e6');
    ovalBox(c, 290, 256, 2, 2, '#e8e04a');
    return canvas;
  }
  function fountain(c, s, t) {
    shadow(c, 150, 280, 20, 3, 0.25);
    ovalBox(c, 150, 270, 18, 8, '#e6dccb');
    oval(c, 150, 269, 14, 5, '#5aa8d0');
    for (let i = 0; i < 8; i += 1) R(c, 134 + i * 4, 275, 3, 3, i % 2 ? '#3d6a9a' : '#f4f1ea');
    R(c, 149, 252, 2, 16, '#d8ccb8');
    ovalBox(c, 150, 252, 4, 2, '#e6dccb');
    c.globalAlpha = 0.8;
    for (let i = 0; i < 3; i += 1) R(c, 147 + i * 3, 254 + ((t / 50 + i * 5) % 12), 1, 2, '#bfe6f6');
    c.globalAlpha = 1;
  }
  function paellaTable(c) {
    shadow(c, 280, 326, 66, 3, 0.25);
    box(c, 216, 296, 128, 26, '#f4f1ea');
    R(c, 218, 318, 124, 3, '#d8d2c4');
    ovalBox(c, 280, 308, 16, 8, '#3a3a3a');
    oval(c, 280, 308, 14, 6, '#e8b830');
    for (let i = 0; i < 10; i += 1) R(c, 270 + ((i * 7) % 20), 304 + ((i * 5) % 8), 2, 1, i % 2 ? '#c0303e' : '#3a8a4a');
    ovalBox(c, 238, 308, 7, 4, '#ffffff');
    oval(c, 238, 307, 5, 3, '#e8c060');
    box(c, 318, 300, 6, 10, '#8e1f3a');
    [252, 300, 330].forEach((gx) => { R(c, gx, 312, 3, 4, '#d6e6ee'); R(c, gx, 313, 3, 2, '#8e1f3a'); });
  }
  function spainChairs(c, back) {
    if (back === 'up') [236, 280, 324].forEach((x) => chair(c, x, 292, 'up', '#c9a06a'));
    else [248, 312].forEach((x) => chair(c, x, 334, 'down', '#c9a06a'));
  }
  function hammock(c) {
    [40, 140].forEach((px) => { shadow(c, px, 352, 3, 1, 0.25); R(c, px - 2, 312, 4, 40, OL); R(c, px - 1, 312, 2, 40, '#8a6a4a'); });
    for (let x = 42; x < 140; x += 1) {
      const sag = Math.round(Math.sin(((x - 42) / 98) * Math.PI) * 10);
      R(c, x, 330 + sag, 1, 6, ['#e0533f', '#f2c230', '#3d8ac0', '#3a9a5a'][Math.floor((x - 42) / 6) % 4]);
      R(c, x, 336 + sag, 1, 1, OL);
    }
    line(c, 40, 316, 42, 330, '#c8b090');
    line(c, 140, 316, 138, 330, '#c8b090');
  }
  registerScene({
    id: 'spain',
    label: 'España',
    indoor: false,
    horizon: 150,
    bake: bakeSpain,
    walk: [[6, 238, 500, 140]],
    lights: [[200, 200, 40], [320, 200, 40], [90, 170, 26], [440, 170, 26]],
    objects: [
      { id: 'fountain', sort: 280, hit: [128, 246, 44, 36], block: [132, 262, 36, 16], draw: fountain, spot: { x: 150, y: 292, dir: 'up' } },
      { id: 'chairsBack', sort: 288, draw: (c) => spainChairs(c, 'up') },
      { id: 'paellatable', sort: 323, hit: [214, 284, 132, 56], block: [216, 296, 128, 26], draw: paellaTable,
        seats: [
          ...[236, 280, 324].map((x) => ({ x, y: 300, dir: 'down', sortY: 304, exit: { x, y: 280 } })),
          ...[248, 312].map((x) => ({ x, y: 338, dir: 'up', sortY: 340, exit: { x, y: 356 } }))
        ] },
      { id: 'chairsFront', sort: 335, draw: (c) => spainChairs(c, 'down') },
      { id: 'orange', sort: 304, hit: [396, 230, 52, 80], block: [410, 290, 20, 14], draw: (c) => { box(c, 408, 290, 24, 14, '#e9e1d2'); roundTree(c, 420, 292, 16, '#3f7a3f', '#f28a1e'); }, spot: { x: 396, y: 300, dir: 'right' } },
      { id: 'hammock', sort: 345, hit: [34, 308, 112, 44], block: [36, 344, 8, 8], draw: hammock, seats: [{ x: 90, y: 340, dir: 'down', sortY: 348, exit: { x: 90, y: 362 } }] },
      { id: 'kikabed', sort: 1, hit: [284, 240, 48, 20], spot: { x: 302, y: 266, dir: 'up' } }
    ]
  });
})();
