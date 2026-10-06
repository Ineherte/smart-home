// Mundo del modo Sims: vuestro piso visto desde arriba, en pixel art al estilo de los
// personajes LPC (Liberated Pixel Cup) de assets/sims. Aquí está todo lo que se ve: suelos,
// paredes, muebles, ventanas, luces de día y de noche, el reflejo del espejo de gota,
// partículas, la cámara y las rutas para andar por la casa. Qué hace cada uno, las
// necesidades y los menús están en sims.js.
//
// Coordenadas en píxeles del juego (512 × 384). Los muñecos miden unos 48 px y sus pies
// están en (x, y). Luz de arriba a la izquierda, contornos marrón oscuro como en LPC.
(function () {
  const W = 512;
  const H = 384;
  const OL = '#2b1f1d';
  // Hojas de sprites. Las de ropa y familia están compactadas: solo llevan algunas filas
  // (rows dice qué fila original es cada una). Si a una hoja de ropa le falta una animación,
  // se usa la de su ropa de siempre (base).
  const OUTFIT_ROWS = [...Array(12).keys(), ...Array.from({ length: 16 }, (_, i) => 22 + i)];
  const NPC_ROWS = [8, 9, 10, 11, ...Array.from({ length: 16 }, (_, i) => 22 + i)];
  const SHEETS = {
    ines: { src: 'assets/sims/ines.png?v=1' },
    matteo: { src: 'assets/sims/matteo.png?v=2' }
  };
  ['pajamas', 'cold', 'hot', 'elegant', 'halloween', 'xmas'].forEach((outfit) => ['ines', 'matteo'].forEach((key) => {
    SHEETS[`${key}-${outfit}`] = { src: `assets/sims/outfits/${key}-${outfit}.png?v=1`, rows: OUTFIT_ROWS, base: key };
  }));
  ['ines-mom', 'ines-dad', 'ines-brother', 'matteo-mom', 'matteo-francesca', 'matteo-clara', 'matteo-claudia', 'matteo-paolo',
    'kid-cecilia', 'kid-giulia', 'kid-vittoria', 'kid-agnese', 'kid-teresa', 'kid-tommaso', 'ped-a', 'ped-b'].forEach((id) => {
    SHEETS[id] = { src: `assets/sims/npc/${id}.png?v=3`, rows: NPC_ROWS };
  });
  // Expresiones (solo los píxeles de la cara que cambian respecto a la neutra), en un atlas:
  // una franja de 54 filas × 13 columnas por expresión. box: dónde va dentro del fotograma.
  const FACES = {
    ines: { src: 'assets/sims/ines-faces.png?v=1', box: [14, 23, 36, 20] },
    matteo: { src: 'assets/sims/matteo-faces.png?v=1', box: [14, 26, 36, 16] }
  };
  const FACE_ORDER = ['closed', 'happy', 'angry', 'sad', 'shock', 'blush', 'eyeroll'];

  // Filas de la hoja LPC (64 × 64 por fotograma). Cada animación tiene 4 filas: arriba,
  // izquierda, abajo y derecha, salvo «hurt» (caerse), que solo tiene una.
  const ANIMS = {
    spellcast: { row: 0, frames: 7 },
    thrust: { row: 4, frames: 8 },
    walk: { row: 8, frames: 9 },
    slash: { row: 12, frames: 6 },
    shoot: { row: 16, frames: 13 },
    hurt: { row: 20, frames: 6, single: true },
    idle: { row: 22, frames: 2 },
    jump: { row: 26, frames: 5 },
    sit: { row: 30, frames: 3 },
    emote: { row: 34, frames: 3 },
    run: { row: 38, frames: 8 }
  };
  const DIR_ROW = { up: 0, left: 1, down: 2, right: 3 };

  // ---------- Colores ----------
  const toneCache = new Map();
  // f > 0 aclara hacia blanco, f < 0 oscurece hacia negro.
  function tone(hex, f) {
    const key = hex + f;
    if (toneCache.has(key)) return toneCache.get(key);
    const n = parseInt(hex.slice(1), 16);
    const target = f > 0 ? 255 : 0;
    const a = Math.abs(f);
    const mix = (v) => Math.round(v + (target - v) * a);
    const out = `#${((1 << 24) | (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255)).toString(16).slice(1)}`;
    toneCache.set(key, out);
    return out;
  }

  // ---------- Pinceles de pixel art ----------
  function R(c, x, y, w, h, color) {
    if (w <= 0 || h <= 0) return;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  // Caja con contorno, brillo arriba y sombra abajo y a la derecha.
  function box(c, x, y, w, h, color, { hi = 0.22, lo = -0.26, ol = OL } = {}) {
    R(c, x, y, w, h, ol);
    R(c, x + 1, y + 1, w - 2, h - 2, color);
    R(c, x + 1, y + 1, w - 2, 1, tone(color, hi));
    R(c, x + 1, y + h - 3, w - 2, 2, tone(color, lo));
    R(c, x + w - 2, y + 2, 1, h - 4, tone(color, lo * 0.6));
  }
  function oval(c, cx, cy, rx, ry, color) {
    c.fillStyle = color;
    for (let dy = -ry; dy <= ry; dy += 1) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
      c.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1);
    }
  }
  function ovalBox(c, cx, cy, rx, ry, color) {
    oval(c, cx, cy, rx + 1, ry + 1, OL);
    oval(c, cx, cy, rx, ry, color);
  }
  function shadow(c, cx, cy, rx, ry, alpha = 0.22) {
    c.globalAlpha = alpha;
    oval(c, cx, cy, rx, ry, '#000000');
    c.globalAlpha = 1;
  }
  function pixels(c, list, color) {
    c.fillStyle = color;
    list.forEach(([x, y, w = 1, h = 1]) => c.fillRect(Math.round(x), Math.round(y), w, h));
  }
  const clipRect = (c, x, y, w, h) => { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); };
  // Dibuja algo desplazado (para recolocar muebles sin rehacer su dibujo).
  const shifted = (c, dx, dy, fn) => { c.save(); c.translate(dx, dy); fn(); c.restore(); };
  const line = (c, x0, y0, x1, y1, color) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    c.fillStyle = color;
    for (let i = 0; i <= steps; i += 1) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), 1, 1);
  };

  // ---------- El piso ----------
  // Tres habitaciones arriba (dormitorio, baño y cocina) y el salón abajo. Cada pared del
  // fondo se ve de frente (48 px) y las demás, desde arriba (8 px).
  const ROOMS = {
    bedroom: [8, 56, 208, 120],
    bathroom: [224, 56, 112, 120],
    kitchen: [344, 56, 160, 120],
    living: [8, 232, 496, 144]
  };
  const DOORS = [[176, 32], [232, 32], [440, 56]];
  const segmentsWithout = (x0, x1, gaps) => {
    const out = [];
    let x = x0;
    gaps.forEach(([gx, gw]) => { if (gx > x) out.push([x, gx]); x = gx + gw; });
    if (x < x1) out.push([x, x1]);
    return out;
  };

  function planks(c, x0, y0, w, h, base) {
    const lengths = [44, 60, 36, 52, 40];
    for (let row = 0, y = y0; y < y0 + h; row += 1, y += 8) {
      const ph = Math.min(8, y0 + h - y);
      let x = x0 - ((row * 23) % 37);
      let i = row;
      while (x < x0 + w) {
        const len = lengths[i % lengths.length];
        const color = tone(base, (((i * 7 + row * 3) % 5) - 2) * 0.02);
        const xa = Math.max(x, x0);
        const xb = Math.min(x + len, x0 + w);
        R(c, xa, y, xb - xa, ph, color);
        R(c, xa, y, xb - xa, 1, tone(color, 0.1));
        if (ph === 8) R(c, xa, y + 7, xb - xa, 1, tone(base, -0.18));
        if (x >= x0) R(c, x, y, 1, ph, tone(base, -0.2));
        if (xb - xa > 14) {
          R(c, xa + 3 + ((i * 13) % (xb - xa - 12)), y + 3, 6, 1, tone(color, -0.05));
          R(c, xa + 6 + ((i * 29) % (xb - xa - 12)), y + 5, 4, 1, tone(color, 0.04));
        }
        x += len;
        i += 1;
      }
    }
  }

  function bathTiles(c, x0, y0, w, h) {
    R(c, x0, y0, w, h, '#a9b9be');
    for (let y = y0; y < y0 + h; y += 12) {
      for (let x = x0; x < x0 + w; x += 12) {
        const dark = ((x - x0) / 12 + (y - y0) / 12) % 2 === 1;
        const color = dark ? '#d5e4e6' : '#f1f5f2';
        R(c, x + 1, y + 1, 11, 11, color);
        R(c, x + 1, y + 1, 11, 1, tone(color, 0.4));
        R(c, x + 1, y + 1, 1, 11, tone(color, 0.3));
      }
    }
  }

  // Baldosa de barro y crema en damero suave, con alguna hidráulica suelta de adorno.
  function checker(c, x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y += 16) {
      for (let x = x0; x < x0 + w; x += 16) {
        const odd = ((x - x0) / 16 + (y - y0) / 16) % 2;
        const color = odd ? '#d9a27e' : '#f0e2c8';
        R(c, x, y, 16, 16, color);
        R(c, x, y, 16, 1, tone(color, 0.12));
        R(c, x, y, 1, 16, tone(color, -0.08));
      }
    }
  }
  // Baldosa hidráulica, de las de casa de abuela (en España y en Italia).
  function hydraulic(c, x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y += 16) {
      for (let x = x0; x < x0 + w; x += 16) {
        R(c, x, y, 16, 16, '#efe3c8');
        R(c, x, y, 16, 1, '#c9b994');
        R(c, x, y, 1, 16, '#c9b994');
        // Cuartos de círculo en las esquinas y rombo en el centro.
        [[x + 1, y + 1], [x + 12, y + 1], [x + 1, y + 12], [x + 12, y + 12]].forEach(([cx, cy]) => R(c, cx, cy, 3, 3, '#c0603e'));
        R(c, x + 4, y + 1, 1, 2, '#c0603e');
        R(c, x + 11, y + 1, 1, 2, '#c0603e');
        R(c, x + 4, y + 13, 1, 2, '#c0603e');
        R(c, x + 11, y + 13, 1, 2, '#c0603e');
        R(c, x + 7, y + 4, 2, 1, '#3d6a9a');
        R(c, x + 6, y + 5, 4, 1, '#3d6a9a');
        R(c, x + 5, y + 6, 6, 4, '#3d6a9a');
        R(c, x + 6, y + 10, 4, 1, '#3d6a9a');
        R(c, x + 7, y + 11, 2, 1, '#3d6a9a');
        R(c, x + 7, y + 7, 2, 2, '#efe3c8');
      }
    }
  }

  // Parquet en cesta: bloques de 16 px con tablillas horizontales y verticales.
  function parquet(c, x0, y0, w, h, base) {
    for (let by = 0; by * 16 < h; by += 1) {
      for (let bx = 0; bx * 16 < w; bx += 1) {
        const x = x0 + bx * 16;
        const y = y0 + by * 16;
        const vertical = (bx + by) % 2 === 0;
        for (let s = 0; s < 4; s += 1) {
          const color = tone(base, (((bx * 5 + by * 3 + s * 7) % 6) - 2.5) * 0.03);
          if (vertical) {
            R(c, x + s * 4, y, 4, 16, color);
            R(c, x + s * 4, y, 1, 16, tone(color, 0.12));
            R(c, x + s * 4 + 3, y, 1, 16, tone(base, -0.22));
          } else {
            R(c, x, y + s * 4, 16, 4, color);
            R(c, x, y + s * 4, 16, 1, tone(color, 0.12));
            R(c, x, y + s * 4 + 3, 16, 1, tone(base, -0.22));
          }
        }
      }
    }
  }

  // Pared vista de frente, con rodapié abajo y sombra del techo arriba.
  function wallFace(c, x0, x1, y0, y1, style) {
    const w = x1 - x0;
    const h = y1 - y0;
    if (style === 'bath') {
      R(c, x0, y0, w, h, '#a8cbc6');
      for (let y = y0 + 14; y < y1; y += 8) {
        for (let x = x0 + (((y - y0) / 8) % 2 ? 4 : 0) - 8; x < x1; x += 8) {
          const xa = Math.max(x, x0);
          const xb = Math.min(x + 8, x1);
          R(c, xa + 1, y + 1, xb - xa - 1, 7, '#cfe9e4');
          R(c, xa + 1, y + 1, xb - xa - 1, 1, '#e8f6f3');
        }
      }
      R(c, x0, y0, w, 14, '#f2efe6');
      R(c, x0, y0 + 13, w, 1, '#9fbdb8');
    } else {
      const paint = decorOf('walls');
      const base = { bedroom: paint.bed, kitchen: '#f0e3c6', living: paint.base }[style];
      R(c, x0, y0, w, h, base);
      if (style === 'bedroom') {
        for (let y = y0 + 6; y < y1 - 8; y += 8) for (let x = x0 + (((y - y0) / 8) % 2 ? 2 : 6); x < x1; x += 8) R(c, x, y, 1, 1, tone(base, -0.12));
      }
      if (style === 'living') {
        // Zócalo de madera pintada en verde salvia, con su moldura.
        const trim = paint.trim;
        R(c, x0, y1 - 20, w, 15, trim);
        R(c, x0, y1 - 20, w, 1, '#f6f1e8');
        R(c, x0, y1 - 19, w, 1, tone(trim, 0.2));
        for (let x = x0 + 6; x < x1 - 4; x += 16) {
          R(c, x, y1 - 16, 12, 8, tone(trim, -0.05));
          R(c, x, y1 - 16, 12, 1, tone(trim, -0.12));
        }
      }
      if (style === 'kitchen') {
        // Azulejos tipo metro detrás de la encimera.
        for (let y = y0 + 22; y < y1 - 4; y += 5) {
          for (let x = x0 + (((y - y0) / 5) % 2 ? 5 : 0) - 10; x < x1; x += 10) {
            const xa = Math.max(x, x0);
            const xb = Math.min(x + 10, x1);
            R(c, xa, y, xb - xa, 5, '#d4cbb8');
            R(c, xa + 1, y + 1, xb - xa - 1, 4, '#faf7f0');
          }
        }
      }
      R(c, x0, y1 - 5, w, 5, '#f6f1e8');
      R(c, x0, y1 - 6, w, 1, tone(base, -0.25));
      R(c, x0, y1 - 1, w, 1, '#a8998a');
    }
    // Sombra bajo el techo.
    c.globalAlpha = 0.18;
    R(c, x0, y0, w, 3, '#000000');
    c.globalAlpha = 0.08;
    R(c, x0, y0 + 3, w, 3, '#000000');
    c.globalAlpha = 1;
  }

  // Parte de arriba de los muros (lo que se ve desde el techo).
  function cap(c, x, y, w, h) {
    R(c, x, y, w, h, OL);
    R(c, x + 1, y + 1, w - 2, h - 2, '#7d6c63');
    R(c, x + 1, y + 1, w - 2, 1, '#9c8a7f');
  }

  function rug(c, x = 30, y = 276) {
    const w = 124;
    const h = 60;
    const [rBase, rDark, rMid, rGold] = decorOf('rug');
    // Flecos en los lados cortos.
    for (let fy = y + 2; fy < y + h - 2; fy += 2) {
      R(c, x - 3, fy, 3, 1, '#efe2c8');
      R(c, x + w, fy, 3, 1, '#efe2c8');
    }
    R(c, x, y, w, h, OL);
    R(c, x + 1, y + 1, w - 2, h - 2, rBase);
    R(c, x + 4, y + 4, w - 8, h - 8, rDark);
    R(c, x + 6, y + 6, w - 12, h - 12, rBase);
    // Grecas de la cenefa.
    for (let i = x + 8; i < x + w - 8; i += 6) {
      R(c, i, y + 4, 2, 2, rGold);
      R(c, i + 3, y + h - 6, 2, 2, rGold);
    }
    for (let j = y + 8; j < y + h - 8; j += 6) {
      R(c, x + 4, j, 2, 2, rGold);
      R(c, x + w - 6, j + 3, 2, 2, rGold);
    }
    // Medallón central y motivos.
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (let r = 0; r < 14; r += 1) R(c, cx - (14 - r) * 1.6, cy - r, (14 - r) * 3.2, 1, r % 4 < 2 ? rMid : rDark);
    for (let r = 0; r < 14; r += 1) R(c, cx - (14 - r) * 1.6, cy + r, (14 - r) * 3.2, 1, r % 4 < 2 ? rMid : rDark);
    R(c, cx - 3, cy - 3, 6, 6, rGold);
    R(c, cx - 1, cy - 1, 2, 2, rDark);
    [[x + 18, y + 16], [x + w - 22, y + 16], [x + 18, y + h - 20], [x + w - 22, y + h - 20]].forEach(([mx, my]) => {
      R(c, mx + 1, my, 2, 4, rGold);
      R(c, mx, my + 1, 4, 2, rGold);
    });
    c.globalAlpha = 0.1;
    R(c, x + 1, y + 1, w - 2, 3, '#ffffff');
    c.globalAlpha = 1;
  }

  // La gran ola de Kanagawa, el puzzle de 1000 piezas que hicisteis.
  function greatWave(c, x, y) {
    const w = 56;
    const h = 36;
    R(c, x, y + h, w, 2, 'rgba(0,0,0,.18)');
    box(c, x, y, w, h, '#3b2a22', { hi: 0.15, lo: -0.2 });
    const ix = x + 3;
    const iy = y + 3;
    const iw = w - 6;
    const ih = h - 6;
    R(c, ix, iy, iw, ih, '#eadab4');
    R(c, ix, iy, iw, 4, '#e2cfa4');
    // Fuji al fondo.
    for (let i = 0; i < 8; i += 1) R(c, ix + 34 - i, iy + ih - 12 + i, 2 + i * 2, 1, i < 2 ? '#f6f2e6' : '#56769e');
    // Olas pequeñas abajo.
    R(c, ix, iy + ih - 5, iw, 5, '#1f3b6e');
    for (let i = 0; i < iw; i += 6) R(c, ix + i, iy + ih - 6, 4, 1, '#f6f2e6');
    // La gran ola: un óvalo azul con el hueco de la curva recortado.
    c.save();
    c.beginPath();
    c.rect(ix, iy, iw, ih);
    c.clip();
    oval(c, ix + 12, iy + 17, 14, 14, '#1f3b6e');
    oval(c, ix + 12, iy + 17, 11, 11, '#2f5a94');
    oval(c, ix + 14, iy + 18, 9, 9, '#1f3b6e');
    oval(c, ix + 19, iy + 22, 8, 7, '#eadab4');
    R(c, ix + 19, iy + ih - 5, 10, 5, '#1f3b6e');
    // Espuma con garras.
    pixels(c, [[ix + 3, iy + 6, 3, 1], [ix + 6, iy + 4, 4, 1], [ix + 10, iy + 3, 5, 1], [ix + 15, iy + 3, 4, 1], [ix + 19, iy + 4, 3, 1], [ix + 22, iy + 5, 2, 1],
      [ix + 23, iy + 6, 2, 2], [ix + 24, iy + 8, 1, 2], [ix + 21, iy + 7, 1, 2], [ix + 18, iy + 6, 1, 2], [ix + 25, iy + 10, 1, 1], [ix + 2, iy + 8, 2, 1], [ix + 1, iy + 11, 2, 1]], '#f6f2e6');
    pixels(c, [[ix + 4, iy + 14, 1, 6], [ix + 7, iy + 11, 1, 8], [ix + 10, iy + 9, 1, 6]], '#6f9acb');
    // Barca.
    R(c, ix + 22, iy + ih - 8, 12, 2, '#d8c08e');
    R(c, ix + 23, iy + ih - 6, 10, 1, '#a68a5a');
    c.restore();
    // Las piezas del puzzle.
    c.globalAlpha = 0.18;
    for (let px = ix + 10; px < ix + iw; px += 10) {
      R(c, px, iy, 1, ih, '#000000');
      for (let py = iy + 4; py < iy + ih; py += 10) R(c, px + ((px + py) % 20 ? 1 : -2), py, 1, 2, '#000000');
    }
    for (let py = iy + 10; py < iy + ih; py += 10) {
      R(c, ix, py, iw, 1, '#000000');
      for (let px = ix + 4; px < ix + iw; px += 10) R(c, px, py + ((px + py) % 20 ? 1 : -2), 2, 1, '#000000');
    }
    c.globalAlpha = 1;
    R(c, ix, iy, iw, 1, 'rgba(255,255,255,.25)');
  }

  // ---------- Vuestras fotos ----------
  // Huecos para fotos: galería junto al puzzle, polaroids sobre la cama, la mesilla, la
  // nevera y el escritorio. Se rellenan con vuestras fotos de Nosotros (pixeladas) y, si aún
  // no hay, con dibujitos vuestros.
  const PHOTO_SLOTS = [
    { x: 41, y: 191, w: 12, h: 10, frame: '#8a5a3a', art: 'couple' },
    { x: 41, y: 206, w: 12, h: 12, frame: '#2b2522', art: 'roma' },
    { x: 214, y: 212, w: 12, h: 10, frame: '#f4f0e8', art: 'beach' },
    { x: 46, y: 18, w: 12, h: 10, frame: '#c9a06a', art: 'flags' },
    { x: 75, y: 20, w: 8, h: 7, polaroid: true, art: 'heart' },
    { x: 90, y: 22, w: 8, h: 7, polaroid: true, art: 'couple' },
    { x: 105, y: 22, w: 8, h: 7, polaroid: true, art: 'shark' },
    { x: 120, y: 20, w: 8, h: 7, polaroid: true, art: 'beach' },
    { x: 142, y: 44, w: 6, h: 5, frame: '#e3b86a', art: 'couple' },
    { x: 350, y: 56, w: 8, h: 7, frame: '#ffffff', art: 'roma' },
    { x: 243, y: 346, w: 6, h: 5, frame: '#2b2522', art: 'heart' }
  ];
  // Dibujitos de reserva (cuando aún no hay fotos en Nosotros).
  function photoArt(c, kind, x, y, w, h) {
    if (kind === 'couple') {
      R(c, x, y, w, h, '#efe2c8');
      R(c, x, y + h - 2, w, 2, '#c9a06a');
      const ix = x + Math.floor(w / 2) - 3;
      R(c, ix, y + 2, 2, 2, '#4a2a1a');
      R(c, ix, y + 4, 2, h - 5, '#f4f1ea');
      R(c, ix - 1, y + 2, 1, 4, '#4a2a1a');
      R(c, ix + 3, y + 1, 3, 2, '#a8754a');
      R(c, ix + 3, y + 3, 3, h - 4, '#f4f1ea');
      R(c, ix + 2, y + 4, 1, 1, '#ef476f');
    } else if (kind === 'roma') {
      R(c, x, y, w, h, '#9fd3f0');
      R(c, x, y + Math.floor(h * 0.4), w, h, '#c99a6b');
      for (let i = x + 1; i < x + w - 1; i += 3) R(c, i, y + Math.floor(h * 0.55), 1, 2, '#7a4e30');
      R(c, x, y + h - 2, w, 2, '#e3b86a');
    } else if (kind === 'beach') {
      R(c, x, y, w, h, '#f7c58a');
      R(c, x, y + Math.floor(h * 0.45), w, 3, '#3d8ac0');
      R(c, x, y + Math.floor(h * 0.45) + 3, w, h, '#ecd49a');
      R(c, x + w - 4, y + 1, 2, 2, '#fff2b0');
    } else if (kind === 'flags') {
      const half = Math.floor(w / 2);
      R(c, x, y, half, h, '#c60b1e');
      R(c, x, y + Math.floor(h / 4), half, Math.ceil(h / 2), '#ffc400');
      R(c, x + half, y, Math.ceil(w / 3), h, '#009246');
      R(c, x + half + Math.ceil(w / 6), y, Math.ceil(w / 6), h, '#f1f2f1');
      R(c, x + w - Math.ceil(w / 6), y, Math.ceil(w / 6), h, '#ce2b37');
    } else if (kind === 'shark') {
      R(c, x, y, w, h, '#4f9fd0');
      R(c, x, y + h - 3, w, 3, '#2f6a9a');
      pixels(c, [[x + 3, y + h - 6, 1, 3], [x + 4, y + h - 5, 1, 2], [x + 2, y + h - 4, 1, 1]], '#7f9fc0');
    } else {
      R(c, x, y, w, h, '#f6d3dc');
      pixels(c, [[x + w / 2 - 2, y + 2, 1, 1], [x + w / 2 + 1, y + 2, 1, 1], [x + w / 2 - 3, y + 3, 6, 1], [x + w / 2 - 2, y + 4, 4, 1], [x + w / 2 - 1, y + 5, 2, 1]], '#ef476f');
    }
  }
  // Una foto de verdad reducida a pocos píxeles (recortada para llenar el hueco).
  function pixelPhoto(img, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d');
    const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / ratio;
    const sh = h / ratio;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
    return canvas;
  }
  function drawSlot(c, slot, photo) {
    const { x, y, w, h } = slot;
    if (slot.polaroid) {
      R(c, x - 1, y - 1, w + 2, h + 6, 'rgba(0,0,0,.18)');
      box(c, x - 1, y - 2, w + 2, h + 6, '#fbf9f3', { hi: 0.3, lo: -0.1 });
      R(c, x + Math.floor(w / 2) - 1, y - 4, 2, 2, '#c0503e');
    } else {
      R(c, x - 1, y + h + 1, w + 2, 1, 'rgba(0,0,0,.18)');
      box(c, x - 1, y - 1, w + 2, h + 2, slot.frame, { hi: 0.2, lo: -0.2 });
    }
    if (photo) c.drawImage(photo, x, y, w, h);
    else photoArt(c, slot.art, x, y, w, h);
    c.globalAlpha = 0.18;
    R(c, x, y, w, 1, '#ffffff');
    c.globalAlpha = 1;
  }
  // El cordel de las polaroids, combado.
  function polaroidString(c) {
    for (let x = 70; x <= 134; x += 1) {
      const sag = Math.round(Math.sin(((x - 70) / 64) * Math.PI) * 4);
      R(c, x, 15 + sag, 1, 1, '#8a7a6a');
    }
    R(c, 69, 14, 2, 2, '#6a5a4a');
    R(c, 133, 14, 2, 2, '#6a5a4a');
  }

  // ---------- Decoración que elegís desde el juego (sims.js la guarda y la sincroniza) ----------
  // Por defecto, vuestro piso tal cual: suelo de roble, paredes crema con zócalo salvia,
  // alfombra roja, sofá caqui y edredón crema.
  const DECOR = {
    floor: { oak: ['#b4834f', '#c99a64'], light: ['#d3b07e', '#dcbc8c'], dark: ['#7a5232', '#8a5e3a'], grey: ['#a0948a', '#b3a89c'] },
    walls: {
      cream: { base: '#ece4d4', bed: '#e8d3c3', trim: '#a9b59a' },
      sage: { base: '#dfe6d2', bed: '#dfe6d2', trim: '#8fa286' },
      terracotta: { base: '#f0d2bd', bed: '#f0d2bd', trim: '#c98a6a' },
      blue: { base: '#d8e3ec', bed: '#d8e3ec', trim: '#7f9bb3' },
      white: { base: '#f6f3ee', bed: '#f6f3ee', trim: '#cfc7ba' },
      pink: { base: '#f3dcd8', bed: '#f3dcd8', trim: '#c99a9a' }
    },
    rug: {
      red: ['#a3242b', '#701519', '#c94a3a', '#e3b86a'],
      blue: ['#2f5f8a', '#1d3d5e', '#4a7fae', '#e8d9b0'],
      beige: ['#cdb88f', '#a8925f', '#e0cfa8', '#8a5a3a'],
      green: ['#5e7a52', '#3f5637', '#7c9a6c', '#e3c98a'],
      pink: ['#d79a9a', '#a86868', '#e8b8b0', '#f6ead8']
    },
    sofa: { khaki: '#7d7f4f', mustard: '#c39a3c', grey: '#8b8d92', navy: '#4c6585', rose: '#c48c8a', terracotta: '#b8674a' },
    bedding: { cream: ['#e4dccb', '#8a8c5a'], white: ['#f2efe8', '#9db4c8'], blue: ['#9fb8d0', '#3f5f86'], rose: ['#e8c4c0', '#b86a6a'], green: ['#c8d4b4', '#5e7a52'], mustard: ['#ecd9a8', '#c39a3c'] },
    theme: ['auto', 'none', 'halloween', 'xmas', 'valentine', 'spring']
  };
  const DEFAULT_DECOR = { floor: 'oak', walls: 'cream', rug: 'red', sofa: 'khaki', bedding: 'cream', theme: 'auto' };
  let decor = { ...DEFAULT_DECOR };
  const decorOf = (key) => DECOR[key][decor[key]] || DECOR[key][DEFAULT_DECOR[key]];
  function setDecorValues(next = {}) {
    const clean = { ...DEFAULT_DECOR };
    Object.keys(DEFAULT_DECOR).forEach((key) => {
      const value = next[key];
      if (key === 'theme' ? DECOR.theme.includes(value) : DECOR[key][value]) clean[key] = value;
    });
    decor = clean;
    return clean;
  }
  // Temática de temporada: Halloween, Navidad, San Valentín o primavera (si está en «auto»).
  function seasonalTheme(date = new Date()) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    if ((m === 10 && d >= 20) || (m === 11 && d <= 2)) return 'halloween';
    if (m === 12 || (m === 1 && d <= 6)) return 'xmas';
    if (m === 2 && d >= 7 && d <= 14) return 'valentine';
    if ((m === 3 && d >= 20) || m === 4) return 'spring';
    return 'none';
  }
  const themeNow = () => (decor.theme === 'auto' ? seasonalTheme() : decor.theme);

  // ---------- Ciclo de día y noche: avanza solo con la hora de verdad ----------
  // Entre medias se mezclan los colores poco a poco (amanecer, atardecer), así que la luz,
  // el cielo y las lámparas cambian sin saltos mientras jugáis.
  const DAY_KEYS = [[0, 'night'], [375, 'night'], [435, 'dawn'], [510, 'day'], [1125, 'day'], [1200, 'dusk'], [1275, 'night'], [1440, 'night']];
  const PHASE = {
    day: { amb: '#ffffff', top: '#6fb6e6', bottom: '#cfeaf8', dark: 0 },
    dawn: { amb: '#f0c8bc', top: '#e9a28a', bottom: '#f7d8b8', dark: 0.42 },
    dusk: { amb: '#f4c8a0', top: '#e7895c', bottom: '#f7cf94', dark: 0.5 },
    night: { amb: '#47507e', top: '#0e1532', bottom: '#2a3664', dark: 1 }
  };
  function mixHex(a, b, f) {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (shift) => Math.round(((pa >> shift) & 255) + ((((pb >> shift) & 255) - ((pa >> shift) & 255)) * f));
    return `#${((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1)}`;
  }
  function dayPhase(date = new Date()) {
    const min = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
    let i = 0;
    while (i < DAY_KEYS.length - 2 && min >= DAY_KEYS[i + 1][0]) i += 1;
    const [m0, a] = DAY_KEYS[i];
    const [m1, b] = DAY_KEYS[i + 1];
    const f = m1 > m0 ? Math.min(1, Math.max(0, (min - m0) / (m1 - m0))) : 0;
    const A = PHASE[a];
    const B = PHASE[b];
    const dark = A.dark + (B.dark - A.dark) * f;
    return {
      min,
      dark,
      amb: mixHex(A.amb, B.amb, f),
      top: mixHex(A.top, B.top, f),
      bottom: mixHex(A.bottom, B.bottom, f),
      warm: (a === 'dusk' || b === 'dusk' || a === 'dawn' || b === 'dawn') && a !== b ? Math.sin(f * Math.PI) : a === 'dusk' || a === 'dawn' ? 1 : 0
    };
  }

  // ---------- Adornos de cada temática ----------
  // En la pared del salón (guirnaldas, telarañas, murciélagos, calcetines), en el rincón de abajo
  // a la izquierda (árbol, calabazas, globos o tulipanes) y en las mesas.
  function bunting(c, t, bulbs) {
    segmentsWithout(8, 504, DOORS).forEach(([x0, x1]) => {
      for (let x = x0 + 3; x < x1 - 2; x += 1) {
        const sag = Math.sin(((x - x0) / Math.max(1, x1 - x0)) * Math.PI) * 4;
        R(c, x, 187 + sag, 1, 1, '#3a3028');
      }
      for (let x = x0 + 7, i = 0; x < x1 - 4; x += 11, i += 1) {
        const sag = Math.sin(((x - x0) / Math.max(1, x1 - x0)) * Math.PI) * 4;
        bulbs(x, 188 + sag, i);
      }
    });
  }
  function drawThemeWall(c, t) {
    const theme = themeNow();
    if (theme === 'none') return;
    const blink = (i, speed = 700) => Math.floor(t / speed + i * 0.7) % 3 !== 0;
    if (theme === 'halloween') {
      bunting(c, t, (x, y, i) => {
        const color = i % 2 ? '#a05ad8' : '#ff9a2a';
        R(c, x - 1, y, 3, 4, OL);
        R(c, x, y + 1, 1, 2, blink(i) ? color : tone(color, -0.4));
      });
      // Telarañas en las esquinas.
      [[8, 184, 1], [504, 184, -1], [8, 8, 1]].forEach(([wx, wy, dir]) => {
        c.globalAlpha = 0.75;
        for (let r = 4; r <= 16; r += 4) line(c, wx + dir * r, wy, wx, wy + r, '#f2efe6');
        line(c, wx, wy, wx + dir * 16, wy + 16, '#f2efe6');
        line(c, wx, wy, wx + dir * 18, wy + 6, '#f2efe6');
        line(c, wx, wy, wx + dir * 6, wy + 18, '#f2efe6');
        c.globalAlpha = 1;
      });
      // Murciélagos que vuelan por la pared.
      for (let i = 0; i < 3; i += 1) {
        const bx = ((t / (60 + i * 15)) + i * 170) % 520 - 8;
        const by = 198 + Math.sin(t / 500 + i * 2) * 6 + i * 4;
        const flap = Math.floor(t / 140 + i) % 2;
        R(c, bx - 1, by, 3, 2, '#1a1418');
        R(c, bx - 4, by - (flap ? 2 : 0), 3, 1, '#1a1418');
        R(c, bx + 2, by - (flap ? 2 : 0), 3, 1, '#1a1418');
        R(c, bx - 5, by - (flap ? 3 : -1), 1, 1, '#1a1418');
        R(c, bx + 5, by - (flap ? 3 : -1), 1, 1, '#1a1418');
      }
    } else if (theme === 'xmas') {
      bunting(c, t, (x, y, i) => {
        ovalBox(c, x, y + 1, 4, 2, '#2f6a3a');
        const colors = ['#ff4d4d', '#ffd23f', '#4dc3ff', '#7dff6a'];
        R(c, x - 1, y + 2, 2, 2, blink(i, 500) ? colors[i % 4] : '#3a3a3a');
      });
      // Calcetines colgados en la pared, sobre el tocadiscos.
      [[150, '#c0303a'], [164, '#2f6a3a']].forEach(([sx, color], i) => {
        R(c, sx + 2, 192, 1, 4, '#8a7a6a');
        box(c, sx, 196, 6, 10, color, { hi: 0.2, lo: -0.2 });
        box(c, sx + (i ? -3 : 3), 203, 6, 4, color, { hi: 0.2, lo: -0.2 });
        R(c, sx, 196, 6, 3, '#f7f3ea');
      });
      // Nieve en las ventanas.
      [[16, 13, 26, 25], [236, 14, 18, 14], [474, 14, 26, 26], [340, 191, 36, 30]].forEach(([wx, wy, ww, wh]) => {
        R(c, wx, wy + wh - 2, ww, 2, '#ffffff');
        R(c, wx, wy + wh - 4, 3, 2, '#ffffff');
        R(c, wx + ww - 3, wy + wh - 4, 3, 2, '#ffffff');
      });
    } else if (theme === 'valentine' || theme === 'spring') {
      const colors = theme === 'valentine' ? ['#e0405a', '#f49ab0', '#ffffff'] : ['#f7b2c4', '#ffe08a', '#a8d8f0', '#b8e0a0'];
      bunting(c, t, (x, y, i) => {
        const color = colors[i % colors.length];
        if (theme === 'valentine') {
          pixels(c, [[x - 2, y, 2, 2], [x + 1, y, 2, 2], [x - 2, y + 1, 5, 2], [x - 1, y + 3, 3, 1], [x, y + 4, 1, 1]], color);
        } else {
          for (let k = 0; k < 4; k += 1) R(c, x - 3 + k, y + k, 7 - k * 2, 1, color);
        }
      });
    }
  }
  function drawThemeSpot(c, s, t) {
    const theme = themeNow();
    const x = 26;
    const y = 368;
    if (theme === 'xmas') {
      shadow(c, x, y, 14, 3, 0.3);
      R(c, x - 2, y - 6, 4, 6, '#6a4a34');
      [[30, 0], [24, 10], [18, 19], [11, 27]].forEach(([w, dy], i) => {
        const ty = y - 8 - dy;
        for (let k = 0; k < 10; k += 1) R(c, x - (w / 2) * (1 - k / 12), ty - k, w * (1 - k / 12), 1, k === 0 ? '#1f4f2a' : i % 2 ? '#2f6a3a' : '#357a42');
      });
      const colors = ['#ff4d4d', '#ffd23f', '#4dc3ff', '#ff8ad8'];
      [[-10, -12], [6, -14], [-5, -22], [8, -26], [-3, -33], [4, -40], [-8, -28], [0, -18]].forEach(([dx, dy], i) => {
        R(c, x + dx, y + dy, 2, 2, Math.floor(t / 450 + i) % 3 ? colors[i % 4] : '#fff6c8');
      });
      pixels(c, [[x - 1, y - 52, 3, 3], [x, y - 54, 1, 7], [x - 3, y - 51, 7, 1]], '#ffd23f');
      // Regalos.
      [[x + 10, y - 2, 9, 7, '#c0303a', '#ffd23f'], [x - 18, y - 1, 8, 6, '#3d6a9a', '#f4f1ea'], [x + 2, y + 1, 7, 5, '#8a5ab8', '#f7d8e8']].forEach(([gx, gy, gw, gh, col, rib]) => {
        box(c, gx, gy - gh, gw, gh, col, { hi: 0.2, lo: -0.2 });
        R(c, gx + Math.floor(gw / 2), gy - gh, 1, gh, rib);
        R(c, gx, gy - gh + 2, gw, 1, rib);
      });
    } else if (theme === 'halloween') {
      shadow(c, x, y, 16, 3, 0.3);
      [[x - 8, y - 4, 8, 6], [x + 7, y - 3, 7, 5], [x, y - 13, 6, 5]].forEach(([px, py, rx, ry], i) => {
        ovalBox(c, px, py, rx, ry, '#e8751f');
        R(c, px - 1, py - ry, 1, ry * 2, tone('#e8751f', -0.2));
        R(c, px - 1, py - ry - 3, 2, 3, '#4a6a2a');
        if (i !== 1) {
          const lit = s.time !== 'day' ? '#ffd23f' : '#3a2010';
          pixels(c, [[px - 4, py - 2, 2, 2], [px + 2, py - 2, 2, 2], [px - 3, py + 2, 6, 1], [px - 2, py + 3, 1, 1], [px + 1, py + 3, 1, 1]], lit);
        }
      });
      // Un fantasmita que flota encima.
      const gy = y - 34 + Math.sin(t / 400) * 3;
      c.globalAlpha = 0.9;
      ovalBox(c, x, gy, 6, 6, '#f7f5f0');
      R(c, x - 6, gy, 12, 6, '#f7f5f0');
      pixels(c, [[x - 6, gy + 6, 2, 2], [x - 2, gy + 6, 2, 2], [x + 2, gy + 6, 2, 2]], '#f7f5f0');
      c.globalAlpha = 1;
      pixels(c, [[x - 3, gy - 2, 2, 2], [x + 1, gy - 2, 2, 2], [x - 1, gy + 2, 2, 2]], OL);
    } else if (theme === 'valentine') {
      shadow(c, x, y, 8, 2, 0.25);
      box(c, x - 4, y - 5, 8, 5, '#c0303a');
      [[-8, -44, '#e0405a'], [4, -50, '#f49ab0'], [-1, -38, '#ff6a8a']].forEach(([dx, dy, col], i) => {
        const sway = Math.sin(t / 700 + i) * 2;
        line(c, x, y - 5, x + dx + sway, y + dy + 8, '#8a7a6a');
        const hx = x + dx + sway;
        const hy = y + dy;
        pixels(c, [[hx - 4, hy - 3, 4, 4], [hx + 1, hy - 3, 4, 4], [hx - 5, hy - 1, 11, 4], [hx - 3, hy + 3, 7, 2], [hx - 1, hy + 5, 3, 2]], OL);
        pixels(c, [[hx - 3, hy - 2, 3, 3], [hx + 1, hy - 2, 3, 3], [hx - 4, hy, 9, 3], [hx - 2, hy + 3, 5, 1], [hx, hy + 4, 1, 1]], col);
        R(c, hx - 2, hy - 1, 1, 1, '#ffffff');
      });
    } else if (theme === 'spring') {
      shadow(c, x, y, 10, 3, 0.28);
      box(c, x - 8, y - 12, 16, 12, '#c9714a');
      R(c, x - 9, y - 13, 18, 3, '#b8603e');
      ['#f7b2c4', '#ffd23f', '#e0405a', '#a05ad8', '#f7f5f0'].forEach((col, i) => {
        const fx = x - 8 + i * 4;
        const fy = y - 22 - ((i * 5) % 7);
        R(c, fx, fy + 3, 1, y - 13 - fy - 3, '#4c9a5a');
        ovalBox(c, fx, fy, 2, 3, col);
      });
    }
  }
  function drawThemeTable(c, s, t) {
    const theme = themeNow();
    const x = 392;
    const y = 120;
    if (theme === 'xmas') {
      ovalBox(c, x, y + 2, 7, 3, '#2f6a3a');
      pixels(c, [[x - 4, y, 2, 2], [x + 3, y + 1, 2, 2]], '#c0303a');
      box(c, x - 1, y - 7, 3, 8, '#f7f3ea');
      R(c, x, y - 9 + Math.round(Math.sin(t / 120)), 1, 2, '#ffb030');
    } else if (theme === 'halloween') {
      ovalBox(c, x, y, 6, 5, '#e8751f');
      R(c, x - 1, y - 7, 2, 3, '#4a6a2a');
      pixels(c, [[x - 3, y - 2, 2, 2], [x + 1, y - 2, 2, 2], [x - 2, y + 2, 4, 1]], Math.floor(t / 300) % 4 ? '#ffd23f' : '#ffb030');
    } else if (theme === 'valentine' || theme === 'spring') {
      box(c, x - 3, y - 6, 6, 8, '#bfe1ea', { hi: 0.3, lo: -0.15 });
      const colors = theme === 'valentine' ? ['#c0303a', '#e0405a', '#c0303a'] : ['#f7b2c4', '#ffd23f', '#a05ad8'];
      colors.forEach((col, i) => { R(c, x - 3 + i * 3, y - 12 + (i % 2) * 2, 1, 6, '#4c9a5a'); ovalBox(c, x - 3 + i * 3, y - 13 + (i % 2) * 2, 2, 2, col); });
    }
  }
  function drawThemeCoffee(c) {
    const theme = themeNow();
    const x = 84;
    const y = 300;
    if (theme === 'xmas') {
      ovalBox(c, x, y, 6, 2, '#f7f3ea');
      pixels(c, [[x - 4, y - 2, 3, 2], [x, y - 2, 3, 2], [x + 3, y - 1, 2, 2]], '#b8743e');
    } else if (theme === 'halloween') {
      ovalBox(c, x, y - 1, 6, 3, '#5a3a8a');
      pixels(c, [[x - 3, y - 3, 2, 2], [x, y - 4, 2, 2], [x + 2, y - 3, 2, 2]], '#ff9a2a');
      R(c, x - 1, y - 3, 1, 1, '#7dff6a');
    } else if (theme === 'valentine') {
      pixels(c, [[x - 4, y - 4, 4, 4], [x + 1, y - 4, 4, 4], [x - 5, y - 2, 11, 3], [x - 3, y + 1, 7, 1], [x - 1, y + 2, 3, 1]], '#c0303a');
      R(c, x - 3, y - 3, 1, 1, '#f49ab0');
    }
  }

  function bakeBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    R(c, 0, 0, W, H, '#33292a');
    planks(c, ...ROOMS.bedroom, decorOf('floor')[1]);
    bathTiles(c, ...ROOMS.bathroom);
    checker(c, ...ROOMS.kitchen);
    planks(c, 8, 176, 496, 200, decorOf('floor')[0]);
    // Sombra del suelo junto a las paredes.
    const ao = (x, y, w, h, dir) => {
      for (let i = 0; i < 6; i += 1) {
        c.globalAlpha = 0.2 * (1 - i / 6);
        if (dir === 'top') R(c, x, y + i, w, 1, '#000000');
        else R(c, x + i, y, 1, h, '#000000');
      }
      c.globalAlpha = 1;
    };
    Object.values(ROOMS).forEach(([x, y, w, h]) => { ao(x, y, w, h, 'top'); ao(x, y, w, h, 'left'); });
    // Paredes del fondo de cada habitación.
    wallFace(c, 8, 216, 8, 56, 'bedroom');
    wallFace(c, 224, 336, 8, 56, 'bath');
    wallFace(c, 344, 504, 8, 56, 'kitchen');
    segmentsWithout(8, 504, DOORS).forEach(([x0, x1]) => wallFace(c, x0, x1, 184, 232, 'living'));
    // Marcos de las puertas.
    DOORS.forEach(([x, w]) => {
      R(c, x, 176, 2, 56, tone('#ece4d4', -0.3));
      R(c, x + w - 2, 176, 2, 56, tone('#ece4d4', -0.42));
      R(c, x + 2, 176, w - 4, 3, 'rgba(0,0,0,.25)');
    });
    // Muros vistos desde arriba.
    cap(c, 0, 0, W, 8);
    cap(c, 0, 0, 8, H);
    cap(c, W - 8, 0, 8, H);
    cap(c, 0, H - 8, W, 8);
    cap(c, 216, 0, 8, 184);
    cap(c, 336, 0, 8, 184);
    segmentsWithout(8, 504, DOORS).forEach(([x0, x1]) => cap(c, x0, 176, x1 - x0, 8));
    // Puerta de casa, abajo a la derecha, con su felpudo.
    R(c, 438, H - 8, 40, 8, OL);
    R(c, 439, H - 7, 38, 6, '#7a4a2c');
    R(c, 439, H - 7, 38, 1, '#9a6a44');
    R(c, 471, H - 5, 2, 2, '#e3b86a');
    R(c, 440, 360, 36, 14, OL);
    R(c, 441, 361, 34, 12, '#8d6b3e');
    for (let i = 443; i < 474; i += 3) R(c, i, 363, 1, 8, '#7a5a30');
    // Alfombras: la roja del salón, la del dormitorio, la del baño, la de la cocina y la esterilla.
    rug(c, 30, 276);
    R(c, 76, 132, 54, 24, OL);
    R(c, 77, 133, 52, 22, '#ebe1cd');
    for (let i = 80; i < 127; i += 8) R(c, i, 133, 3, 22, '#c97a52');
    R(c, 77, 133, 52, 1, '#f8f2e4');
    R(c, 240, 102, 36, 14, OL);
    R(c, 241, 103, 34, 12, '#8ec9c0');
    R(c, 241, 103, 34, 1, '#b8e2db');
    R(c, 380, 80, 84, 12, OL);
    R(c, 381, 81, 82, 10, '#b8674a');
    for (let i = 383; i < 462; i += 6) R(c, i, 83, 3, 6, '#efe3c8');
    // Alfombra de yute y la esterilla de yoga encima.
    ovalBox(c, 366, 308, 44, 20, '#cdb88f');
    for (let r = 16; r > 2; r -= 5) { c.globalAlpha = 0.25; oval(c, 366, 308, r * 2.6, r, '#a8925f'); c.globalAlpha = 1; oval(c, 366, 308, r * 2.6 - 1, r - 1, '#cdb88f'); }
    R(c, 341, 301, 50, 14, OL);
    R(c, 342, 302, 48, 12, '#8fa98a');
    R(c, 342, 302, 48, 1, '#aec4a8');
    R(c, 387, 302, 3, 12, '#7a9475');
    // Zapatillas junto a la cama.
    pixels(c, [[66, 136, 5, 3], [72, 137, 5, 3]], OL);
    pixels(c, [[67, 136, 3, 2], [73, 137, 3, 2]], '#e98a6a');
    // Cosas colgadas en las paredes.
    greatWave(c, 60, 186);
    polaroidString(c);
    // Reloj del salón (las agujas se dibujan con la hora de verdad) e interruptores.
    ovalBox(c, 220, 200, 7, 7, '#f7f2e6');
    oval(c, 220, 200, 5, 5, '#fbf8f0');
    [[220, 194], [226, 200], [220, 206], [214, 200]].forEach(([hx, hy]) => R(c, hx, hy, 1, 1, OL));
    [[266, 212], [158, 26], [438, 212]].forEach(([sx, sy]) => { R(c, sx, sy, 4, 6, OL); R(c, sx + 1, sy + 1, 2, 4, '#f7f2e6'); });
    // Espejo redondo del baño.
    ovalBox(c, 319, 25, 9, 10, '#c5ccce');
    oval(c, 319, 25, 7, 8, '#bfe1ea');
    R(c, 315, 20, 1, 4, '#ffffff');
    R(c, 316, 19, 2, 1, '#ffffff');
    // Toalla colgada.
    R(c, 295, 18, 11, 1, '#8a8f96');
    box(c, 296, 19, 9, 18, '#e98a6a', { hi: 0.2, lo: -0.2 });
    // Ducha: tubo y alcachofa.
    R(c, 291, 16, 2, 30, '#9aa3a8');
    R(c, 284, 16, 9, 2, '#9aa3a8');
    box(c, 280, 15, 8, 5, '#b9c2c6');
    // Repisa sobre la bañera con botes, una vela y un poto que cuelga.
    R(c, 258, 28, 22, 2, '#c9a06a');
    R(c, 258, 30, 22, 1, OL);
    box(c, 259, 21, 4, 7, '#f4f1ea');
    box(c, 264, 23, 3, 5, '#9ad1c9');
    box(c, 268, 22, 4, 6, '#e98a6a');
    R(c, 274, 25, 3, 3, '#f7f2e6');
    R(c, 275, 24, 1, 1, '#f2c230');
    // Muebles altos de la cocina, ristra de ajos y guindillas junto a la ventana.
    box(c, 372, 10, 98, 18, '#7f9a7a');
    for (let i = 372; i < 470; i += 24.5) R(c, i, 11, 1, 16, tone('#7f9a7a', -0.35));
    for (let i = 372 + 10; i < 470; i += 24.5) R(c, i, 22, 4, 1, '#d9c38e');
    R(c, 471, 12, 1, 4, '#8a7a6a');
    for (let i = 0; i < 4; i += 1) ovalBox(c, 471, 18 + i * 4, 2, 2, '#f4eedd');
    pixels(c, [[502, 13, 1, 4], [501, 17, 2, 3], [502, 20, 1, 3]], '#d6333f');
    return canvas;
  }

  // ---------- Ventanas (cambian con la hora) ----------
  const WINDOWS = [[16, 13, 26, 25], [236, 14, 18, 14], [474, 14, 26, 26], [340, 191, 36, 30]];
  function windowAt(c, [x, y, w, h], sky, t) {
    box(c, x - 2, y - 2, w + 4, h + 4, '#f5f1e8', { hi: 0.4, lo: -0.15 });
    const grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(1, sky[1]);
    c.fillStyle = grad;
    c.fillRect(x, y, w, h);
    // Tejados y edificios de enfrente (de noche, con alguna ventana encendida).
    const roofs = sky.night ? '#0e1430' : sky.dusk ? '#9a5a4a' : '#c98a6a';
    const walls = sky.night ? '#1a2246' : sky.dusk ? '#d49a78' : '#efd8bc';
    for (let i = 0; i < w; i += 7) {
      const bh = 6 + ((i * 13 + x) % 7);
      R(c, x + i, y + h - bh, 7, bh, walls);
      R(c, x + i, y + h - bh, 7, 2, roofs);
      if (sky.night && (i + x) % 3 === 0) R(c, x + i + 2, y + h - bh + 4, 1, 1, '#ffd77a');
      else if (!sky.night) R(c, x + i + 2, y + h - bh + 4, 2, 2, tone(walls, -0.25));
    }
    if (sky.rain || sky.snow) {
      c.globalAlpha = sky.snow ? 0.9 : 0.6;
      for (let i = 0; i < w; i += 3) {
        const fy = (t / (sky.snow ? 60 : 14) + i * 7) % h;
        R(c, x + i, y + fy, 1, sky.snow ? 1 : 3, sky.snow ? '#ffffff' : '#dbe8f4');
      }
      c.globalAlpha = 1;
    }
    if (sky.night) {
      pixels(c, [[x + 4, y + 4], [x + w - 6, y + 6], [x + w / 2, y + 3], [x + 7, y + 9]], '#ffffff');
      if (w > 30) { R(c, x + w - 12, y + 4, 5, 5, '#f6f0c8'); R(c, x + w - 10, y + 4, 3, 3, sky[0]); }
    } else {
      // Una nube que pasa despacio.
      const cx = x + ((t / 900 + x) % (w + 16)) - 8;
      clipRect(c, x, y, w, h);
      R(c, cx, y + 5, 10, 3, 'rgba(255,255,255,.85)');
      R(c, cx + 3, y + 3, 5, 2, 'rgba(255,255,255,.85)');
      c.restore();
    }
    R(c, x + w / 2 - 1, y, 2, h, '#f5f1e8');
    R(c, x, y + h / 2 - 1, w, 2, '#f5f1e8');
    R(c, x - 3, y + h + 1, w + 6, 3, '#e4ddd0');
    R(c, x - 3, y + h + 3, w + 6, 1, OL);
    // Cortinas blancas y finas, como las de vuestro piso.
    if (w > 24) {
      const sway = Math.round(Math.sin(t / 1300 + x) * 1);
      c.globalAlpha = 0.82;
      R(c, x - 4, y - 3, 7 + sway, h + 5, '#fbfaf6');
      R(c, x + w - 3 - sway, y - 3, 7 + sway, h + 5, '#fbfaf6');
      c.globalAlpha = 1;
      R(c, x - 2, y - 3, 1, h + 5, '#e3ddd2');
      R(c, x + w, y - 3, 1, h + 5, '#e3ddd2');
      R(c, x + 1 + sway, y - 3, 1, h + 5, '#efe9df');
      R(c, x - 6, y - 4, w + 12, 1, '#8a7a6a');
    }
  }

  // ---------- Muebles ----------
  // Cada mueble: draw(c, state, t). sort: la «y» de su base (para saber quién tapa a quién).
  // block: lo que ocupa en el suelo. hit: dónde se toca.
  const PLANT_LEAF = '#3f8a4f';
  const GREENS = ['#3f8a4f', '#4c9a5a', '#3a7d47', '#5aa86a'];
  const DRYS = ['#8f8a45', '#a39a52', '#7f7a3c', '#b3aa62'];
  function strelitzia(c, x, y, t, wet, dry) {
    const pal = dry ? DRYS : GREENS;
    const droop = dry ? 5 : 0;
    const sway = Math.sin(t / 1400) * 1.2;
    const leaf = (bx, by, dx, dy, len, color) => {
      for (let i = 0; i < len; i += 1) {
        const px = bx + dx * i + (i > len / 2 ? sway * (i / len) : 0);
        const py = by + dy * i;
        const half = Math.max(1, Math.round(Math.sin((i / len) * Math.PI) * 4));
        R(c, px - half, py, half * 2, 1, color);
        R(c, px - half, py, 1, 1, tone(color, -0.35));
        R(c, px, py, 1, 1, tone(color, 0.25));
      }
    };
    // Tallos.
    [[-4, -1], [0, 0], [4, 1], [-1, -1]].forEach(([dx]) => R(c, x + dx, y - 26, 1, 20, '#5b7a3a'));
    leaf(x - 10 - droop, y - 50 + droop, 0.25, 1, 22, pal[0]);
    leaf(x + 8 + droop, y - 54 + droop, -0.15, 1, 26, pal[1]);
    leaf(x - 2, y - 58 + droop, 0.05, 1, 28, pal[2]);
    leaf(x + 12, y - 40 + droop, -0.4, 1, 16, pal[1]);
    leaf(x - 14, y - 36 + droop, 0.45, 1, 14, pal[2]);
    // La flor de ave del paraíso.
    if (!dry) {
      pixels(c, [[x + 6, y - 46, 4, 1], [x + 8, y - 47, 3, 1], [x + 9, y - 49, 2, 2], [x + 5, y - 45, 6, 1]], '#f08a2c');
      pixels(c, [[x + 10, y - 48, 2, 1], [x + 4, y - 44, 6, 1]], '#3f5aa8');
    }
    // Maceta de barro.
    box(c, x - 9, y - 12, 18, 13, '#c47a52');
    R(c, x - 10, y - 13, 20, 3, OL);
    R(c, x - 9, y - 12, 18, 2, '#d89068');
    if (wet) R(c, x - 7, y - 11, 14, 1, '#5a3a2a');
  }

  function bookshelf(c) {
    const x = 298;
    const y = 188;
    box(c, x, y, 58, 58, '#8a5a3a', { hi: 0.18 });
    R(c, x + 3, y + 3, 52, 50, '#5a3a26');
    const colors = ['#c0503e', '#3d6a9a', '#e3b86a', '#4c8a5a', '#efe6d4', '#7a62b3', '#d88a6a', '#2f4a5a', '#b8432f'];
    for (let shelf = 0; shelf < 4; shelf += 1) {
      const sy = y + 4 + shelf * 12.5;
      let bx = x + 4;
      let i = shelf * 3;
      while (bx < x + 52) {
        const bw = 2 + ((i * 7) % 3);
        const bh = 8 + ((i * 5) % 3);
        if ((i + shelf) % 9 === 4) { bx += 5; i += 1; continue; }
        const color = colors[i % colors.length];
        R(c, bx, sy + 10 - bh, bw, bh, color);
        R(c, bx, sy + 10 - bh, 1, bh, tone(color, 0.25));
        bx += bw + ((i % 4) === 0 ? 1 : 0);
        i += 1;
      }
      R(c, x + 3, sy + 10, 52, 2, '#8a5a3a');
      R(c, x + 3, sy + 12, 52, 1, OL);
    }
    R(c, x, y + 56, 58, 3, 'rgba(0,0,0,.2)');
  }

  function drawSofa(c, s) {
    const x = 52;
    const y = 222;
    const khaki = decorOf('sofa');
    shadow(c, x + 52, y + 46, 54, 4, 0.25);
    // Respaldo.
    box(c, x + 6, y, 92, 18, tone(khaki, -0.08));
    R(c, x + 8, y + 2, 88, 2, tone(khaki, 0.15));
    // Asiento con dos cojines.
    box(c, x + 8, y + 14, 88, 26, khaki);
    [[x + 10, 41], [x + 52, 42]].forEach(([cx, cw]) => {
      box(c, cx, y + 15, cw, 22, tone(khaki, 0.06), { hi: 0.2, lo: -0.18 });
      R(c, cx + 3, y + 18, cw - 6, 1, tone(khaki, 0.22));
    });
    // Brazos.
    box(c, x, y + 8, 12, 36, tone(khaki, -0.12));
    box(c, x + 92, y + 8, 12, 36, tone(khaki, -0.12));
    R(c, x + 2, y + 10, 8, 2, tone(khaki, 0.1));
    R(c, x + 94, y + 10, 8, 2, tone(khaki, 0.1));
    // Faldón y patas.
    R(c, x + 8, y + 38, 88, 6, OL);
    R(c, x + 9, y + 38, 86, 5, tone(khaki, -0.25));
    R(c, x + 4, y + 44, 3, 2, '#3a2a20');
    R(c, x + 97, y + 44, 3, 2, '#3a2a20');
    // Cojín terracota y la manta.
    const cushion = decor.sofa === 'terracotta' ? '#efe2c8' : '#c9714a';
    box(c, x + 14, y + 6, 14, 12, cushion);
    R(c, x + 17, y + 9, 8, 1, tone(cushion, 0.15));
    // El tiburón de peluche, si nadie lo tiene en brazos.
    if (!s.props.shark) drawShark(c, x + 70, y + 22, 1);
  }

  // Tiburón de peluche (dir 1 mira a la izquierda, -1 a la derecha).
  function drawShark(c, x, y, dir = 1) {
    c.save();
    c.translate(Math.round(x), Math.round(y));
    c.scale(dir, 1);
    pixels(c, [[-10, -2, 18, 6], [-12, -1, 2, 4], [8, -1, 3, 4], [11, -3, 2, 3], [11, 2, 2, 3], [-2, -6, 4, 4], [-1, -8, 2, 2]], OL);
    pixels(c, [[-10, -1, 18, 4], [8, 0, 3, 2], [11, -2, 1, 2], [11, 3, 1, 1], [-1, -5, 2, 4], [0, -7, 1, 2]], '#7f9fc0');
    pixels(c, [[-9, 2, 15, 1], [-11, 0, 2, 2]], '#f1f4f6');
    pixels(c, [[-7, -1, 1, 1]], OL);
    pixels(c, [[-10, 2, 3, 1]], '#c45a6a');
    pixels(c, [[-8, -1, 10, 1]], '#a9c3dc');
    c.restore();
  }

  function drawTvBack(c, s, t) {
    // Mueble bajo y la tele vista desde detrás (mira al sofá).
    box(c, 68, 350, 76, 20, '#6a4a34');
    R(c, 72, 356, 32, 10, '#4a3224');
    R(c, 108, 356, 32, 10, '#4a3224');
    R(c, 87, 360, 2, 2, '#c9a06a');
    R(c, 123, 360, 2, 2, '#c9a06a');
    R(c, 100, 346, 12, 5, OL);
    box(c, 78, 326, 56, 22, '#2c2c32', { hi: 0.12, lo: -0.3 });
    for (let i = 84; i < 128; i += 4) R(c, i, 331, 2, 1, '#45454d');
    R(c, 104, 340, 4, 6, '#1a1a1e');
    // Altavoz y una vela.
    box(c, 136, 340, 8, 12, '#3a3a40');
    box(c, 70, 343, 6, 8, '#f2e6cf');
    if (s.props.tv || s.props.games) {
      const colors = ['#9fd3f0', '#f2c2a0', '#b0e0b0', '#e0b0f0'];
      c.globalAlpha = 0.85;
      R(c, 79, 325, 54, 1, colors[Math.floor(t / 700) % colors.length]);
      c.globalAlpha = 1;
    }
  }

  function drawRecordPlayer(c, s, t) {
    box(c, 160, 240, 26, 22, '#9a6a44');
    R(c, 163, 254, 20, 5, '#7a4e30');
    box(c, 160, 232, 26, 12, '#d8c8a8');
    oval(c, 170, 237, 5, 3, '#1d1d22');
    const spin = s.props.radio ? Math.floor(t / 120) % 2 : 0;
    R(c, 169, 236, 2, 2, spin ? '#e0533f' : '#c0503e');
    R(c, 177, 234, 1, 5, '#9aa3a8');
    R(c, 176, 238, 3, 1, '#9aa3a8');
    // Discos apoyados.
    box(c, 184, 248, 4, 14, '#2f4a5a');
  }

  function drawBed(c) {
    const x = 28;
    const y = 38;
    shadow(c, x + 36, y + 86, 38, 4, 0.22);
    // Cabecero de madera contra la pared.
    box(c, x, y, 72, 22, '#8a5a3a');
    R(c, x + 4, y + 4, 64, 3, '#a87048');
    // Estructura y colchón.
    box(c, x + 2, y + 18, 68, 68, '#7a4a2c');
    R(c, x + 5, y + 20, 62, 62, '#f7f3ea');
    // Almohadas.
    box(c, x + 7, y + 22, 27, 13, '#fbf8f2', { hi: 0.3, lo: -0.12 });
    box(c, x + 38, y + 22, 27, 13, '#fbf8f2', { hi: 0.3, lo: -0.12 });
  }
  // El edredón va aparte: tapa a quien duerme en la cama.
  function drawDuvet(c) {
    const x = 28;
    const y = 38;
    const [duvet, blanket] = decorOf('bedding');
    R(c, x + 3, y + 40, 66, 44, OL);
    R(c, x + 4, y + 41, 64, 42, duvet);
    R(c, x + 4, y + 41, 64, 3, tone(duvet, 0.3));
    for (let i = 0; i < 4; i += 1) R(c, x + 6, y + 50 + i * 9, 60, 1, tone(duvet, -0.07));
    // Manta a los pies (por defecto, en verde caqui como el sofá).
    R(c, x + 3, y + 68, 66, 16, OL);
    R(c, x + 4, y + 69, 64, 14, blanket);
    for (let i = x + 6; i < x + 66; i += 4) R(c, i, y + 69, 1, 14, tone(blanket, -0.12));
    R(c, x + 4, y + 69, 64, 1, tone(blanket, 0.2));
  }

  // Mesillas: la izquierda con un libro y gafas; la derecha con vuestra foto.
  function drawCover(c, s, t) {
    shifted(c, 38, 0, () => drawDuvet(c));
    if (s.bedMode === 'woohoo') {
      const wig = Math.sin(t / 80) * 1.5;
      ovalBox(c, 96 + wig, 99 + Math.cos(t / 95), 10, 8, decorOf('bedding')[0]);
      ovalBox(c, 110 - wig, 101 - Math.cos(t / 85), 10, 8, tone(decorOf('bedding')[0], 0.1));
      R(c, 92 + wig, 96, 6, 1, '#f4efe4');
      R(c, 106 - wig, 98, 6, 1, '#f8f4ea');
    }
  }
  function drawNightstand(c, x, photo) {
    shadow(c, x + 9, 77, 10, 2, 0.22);
    box(c, x, 52, 18, 24, '#9a6a44');
    R(c, x + 3, 64, 12, 1, OL);
    R(c, x + 8, 66, 2, 1, '#e3b86a');
    const lx = photo === undefined ? x + 3 : x + 8;
    R(c, lx + 5, 44, 2, 8, '#6a5a4a');
    box(c, lx, 36, 12, 9, '#efe2c4');
    R(c, lx + 2, 37, 8, 1, '#fbf3dc');
    R(c, lx + 2, 50, 8, 2, '#6a5a4a');
    if (photo === undefined) {
      box(c, x + 1, 47, 8, 4, '#3d6a9a');
      R(c, x + 10, 49, 5, 1, OL);
      R(c, x + 10, 48, 2, 2, '#9aa3a8');
      R(c, x + 13, 48, 2, 2, '#9aa3a8');
    } else drawSlot(c, PHOTO_SLOTS[8], photo);
  }
  function drawBasket(c) {
    shadow(c, 18, 112, 9, 2, 0.22);
    box(c, 10, 98, 16, 14, '#c9a06a');
    for (let i = 12; i < 25; i += 3) R(c, i, 100, 1, 11, '#a87e4a');
    pixels(c, [[12, 95, 6, 4], [17, 94, 6, 4]], '#f4f1ea');
    pixels(c, [[14, 96, 4, 3]], '#1f1e24');
  }
  function snakePlant(c, x, y, dry) {
    const pal = dry ? DRYS : GREENS;
    shadow(c, x, y, 9, 2, 0.22);
    [[-6, -36, 3, 24, pal[2]], [-2, -40, 3, 28, pal[1]], [2, -34, 3, 22, pal[2]], [5, -28, 2, 16, pal[3]]].forEach(([lx, ly, lw, lh, color]) => {
      const tilt = dry ? 3 : 0;
      R(c, x + lx - 1, y + ly + tilt, lw + 2, lh - tilt, OL);
      R(c, x + lx, y + ly + 1 + tilt, lw, lh - 1 - tilt, color);
      R(c, x + lx, y + ly + 1 + tilt, 1, lh - 1 - tilt, dry ? '#c9b46a' : '#c9d27a');
    });
    box(c, x - 8, y - 14, 16, 14, '#efe6d4');
    R(c, x - 7, y - 11, 14, 1, '#cfc4b1');
  }
  // Poto colgante: maceta con cuerdas o encima de un mueble, con guías que caen.
  function pothos(c, x, y, t, dry, hanging) {
    const pal = dry ? DRYS : GREENS;
    if (hanging) {
      R(c, x - 5, y - 14, 1, 10, '#a89070');
      R(c, x + 4, y - 14, 1, 10, '#a89070');
      R(c, x - 1, y - 16, 2, 2, '#8a7a6a');
    }
    const sway = Math.sin(t / 1500);
    [[-4, 16], [0, 22], [4, 12], [-2, 9]].forEach(([dx, len], i) => {
      for (let k = 0; k < len; k += 1) {
        const px = x + dx + Math.round(Math.sin(k / 4 + i) * 1 + sway * (k / len));
        R(c, px, y + k, 1, 1, tone(pal[2], -0.2));
        if (k % 4 === 2) { R(c, px - 2, y + k - 1, 2, 2, pal[(i + k) % 2]); R(c, px + 1, y + k, 2, 2, pal[(i + k + 1) % 2]); }
      }
    });
    pixels(c, [[x - 6, y - 6, 12, 3], [x - 5, y - 8, 10, 2]], pal[1]);
    pixels(c, [[x - 4, y - 9, 3, 2], [x + 2, y - 9, 3, 2]], pal[3]);
    box(c, x - 5, y - 4, 10, 6, hanging ? '#efe6d4' : '#c47a52');
  }
  // Plantita aromática (albahaca o lo que sea) en una maceta pequeña.
  function herb(c, x, y, dry) {
    const pal = dry ? DRYS : GREENS;
    [[-4, -10], [0, -13], [3, -9], [-2, -7], [2, -6]].forEach(([dx, dy], i) => ovalBox(c, x + dx, y + dy + (dry ? 2 : 0), 2, 2, pal[i % 4]));
    box(c, x - 4, y - 5, 9, 6, '#c47a52');
    R(c, x - 5, y - 6, 11, 2, OL);
  }
  // Huecos para plantas: los grandes en el suelo y los pequeños colgados o en muebles.
  // Ahí se ponen vuestras plantas de la app (con su nombre y su sed de verdad).
  const PLANT_SLOTS = [
    { kind: 'strelitzia', x: 282, y: 266, hit: [266, 196, 32, 72], block: [268, 248, 30, 20], sort: 267, top: 62, spot: { x: 282, y: 284, dir: 'up' } },
    { kind: 'monstera', x: 488, y: 318, hit: [474, 274, 30, 48], block: [478, 300, 22, 18], sort: 319, top: 50, spot: { x: 464, y: 316, dir: 'right' } },
    { kind: 'snake', x: 19, y: 174, hit: [8, 130, 24, 46], block: [10, 160, 18, 14], sort: 174, top: 44, spot: { x: 36, y: 166, dir: 'left' } },
    { kind: 'pothos', x: 431, y: 186, hit: [420, 172, 24, 34], sort: 249, top: 12, spot: { x: 420, y: 264, dir: 'up' } },
    { kind: 'herb', x: 487, y: 42, hit: [478, 26, 20, 18], sort: 44, top: 16, spot: { x: 452, y: 88, dir: 'up' } },
    { kind: 'pothos', x: 247, y: 26, hit: [236, 10, 22, 34], sort: 30, top: 18, hanging: true, spot: { x: 262, y: 106, dir: 'up' } }
  ];
  const BIG_KINDS = ['strelitzia', 'monstera', 'snake'];
  function drawPlantSlot(c, s, t, index) {
    const slot = PLANT_SLOTS[index];
    const info = s.plants?.[index];
    const dry = Boolean(info && ['thirsty', 'parched'].includes(info.mood));
    const wet = Boolean(s.props[`plant${index}`]);
    const kind = info?.draw && (BIG_KINDS.includes(slot.kind) === BIG_KINDS.includes(info.draw)) ? info.draw : slot.kind;
    if (kind === 'strelitzia') strelitzia(c, slot.x, slot.y, t, wet, dry);
    else if (kind === 'monstera') drawMonstera(c, t, slot.x, slot.y, dry);
    else if (kind === 'snake') snakePlant(c, slot.x, slot.y, dry);
    else if (kind === 'pothos') pothos(c, slot.x, slot.y, t, dry, slot.hanging);
    else herb(c, slot.x, slot.y, dry);
    // Gota que parpadea encima si tiene sed.
    if (dry && Math.floor(t / 500) % 2) {
      const dx = slot.x;
      const dy = slot.y - slot.top - 8;
      pixels(c, [[dx, dy, 1, 1], [dx - 1, dy + 1, 3, 1], [dx - 2, dy + 2, 5, 2], [dx - 1, dy + 4, 3, 1]], '#2b6a9a');
      pixels(c, [[dx, dy + 1, 1, 1], [dx - 1, dy + 2, 3, 2]], '#7cc4e6');
    }
  }
  // Letras y números de 3×5 píxeles (calendario, carteles…).
  const GLYPHS = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
    H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
    O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
    V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
    6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110', ' ': '000000000000000', "'": '010010000000000', '.': '000000000000010'
  };
  function pixelText(c, text, x, y, color, scale = 1) {
    c.fillStyle = color;
    [...String(text).toUpperCase()].forEach((ch, i) => {
      const glyph = GLYPHS[ch] || GLYPHS[' '];
      for (let k = 0; k < 15; k += 1) if (glyph[k] === '1') c.fillRect(Math.round(x + (i * 4 + (k % 3)) * scale), Math.round(y + Math.floor(k / 3) * scale), scale, scale);
    });
  }
  const textWidth = (text, scale = 1) => (String(text).length * 4 - 1) * scale;
  // Corcho del salón con vuestras tareas pendientes (una nota por tarea).
  function drawBoard(c, s) {
    const x = 120;
    const y = 188;
    R(c, x, y + 30, 20, 2, 'rgba(0,0,0,.16)');
    box(c, x, y, 20, 30, '#8a5a3a');
    R(c, x + 2, y + 2, 16, 26, '#c9a06a');
    for (let i = 0; i < 12; i += 1) R(c, x + 3 + ((i * 7) % 14), y + 3 + ((i * 11) % 24), 1, 1, '#a8804e');
    const n = s.data?.tasks || 0;
    const colors = ['#fbe58a', '#f6b3c4', '#a9d8f0', '#c8e6a0'];
    if (!n) {
      R(c, x + 6, y + 9, 8, 8, '#c8e6a0');
      pixels(c, [[x + 8, y + 13, 1, 1], [x + 9, y + 14, 1, 1], [x + 10, y + 13, 1, 1], [x + 11, y + 12, 1, 1], [x + 12, y + 11, 1, 1]], '#3a7d47');
    }
    for (let i = 0; i < Math.min(n, 4); i += 1) {
      const nx = x + 3 + (i % 2) * 8;
      const ny = y + 4 + Math.floor(i / 2) * 12;
      R(c, nx, ny, 7, 8, colors[i]);
      R(c, nx + 1, ny + 3, 5, 1, 'rgba(0,0,0,.25)');
      R(c, nx + 1, ny + 5, 4, 1, 'rgba(0,0,0,.25)');
      R(c, nx + 3, ny, 1, 1, '#c0303e');
    }
    if (n > 4) pixelText(c, `${Math.min(n, 9)}`, x + 14, y + 24, OL);
  }

  function drawWasher(c, s, t) {
    shadow(c, 322, 172, 14, 2, 0.22);
    box(c, 308, 146, 28, 26, '#f1f4f5', { hi: 0.35, lo: -0.15 });
    R(c, 310, 149, 24, 4, '#d4dcde');
    R(c, 312, 150, 4, 2, '#7cc4e6');
    R(c, 328, 150, 3, 2, '#3fbf6a');
    ovalBox(c, 322, 162, 7, 6, '#9aa3a8');
    oval(c, 322, 162, 5, 4, s.props.laundry ? '#7cc4e6' : '#c5d1d4');
    if (s.props.laundry) {
      const a = t / 120;
      pixels(c, [[322 + Math.cos(a) * 3, 162 + Math.sin(a) * 2, 2, 2], [322 - Math.cos(a) * 3, 162 - Math.sin(a) * 2, 2, 2]], '#e98a6a');
    }
  }
  function drawWineRack(c) {
    shadow(c, 487, 77, 15, 2, 0.22);
    box(c, 472, 44, 30, 32, '#8a5a3a');
    R(c, 474, 58, 26, 1, OL);
    [[476, '#5a1a24'], [482, '#2f5a2a'], [488, '#5a1a24'], [494, '#e3c87a']].forEach(([bx, color]) => {
      box(c, bx, 47, 5, 10, color);
      R(c, bx + 1, 44, 3, 3, OL);
    });
    for (let i = 0; i < 4; i += 1) ovalBox(c, 477 + i * 6, 66, 2, 2, i % 2 ? '#5a1a24' : '#2f5a2a');
    R(c, 474, 70, 26, 1, OL);
  }
  // Escritorio con el portátil (la tapa se ve por detrás) y su sillita.
  function drawDeskChair(c) {
    shadow(c, 262, 336, 10, 2, 0.2);
    box(c, 252, 318, 20, 9, '#3a3a40');
    box(c, 253, 326, 18, 8, '#4a4a52');
  }
  function drawDesk(c, s) {
    shadow(c, 262, 373, 34, 3, 0.25);
    R(c, 232, 354, 3, 17, OL);
    R(c, 289, 354, 3, 17, OL);
    R(c, 233, 354, 1, 16, '#8a5a3a');
    R(c, 290, 354, 1, 16, '#8a5a3a');
    box(c, 230, 342, 64, 14, '#c99a6b');
    R(c, 232, 344, 60, 1, '#e0b88a');
    box(c, 250, 332, 24, 12, '#b9c2c6', { hi: 0.3, lo: -0.2 });
    R(c, 260, 336, 4, 4, '#e8edef');
    if (s.props.laptop) {
      c.globalAlpha = 0.6;
      R(c, 249, 331, 26, 1, '#9fd3f0');
      c.globalAlpha = 1;
    }
    R(c, 237, 330, 2, 13, '#3a3a40');
    box(c, 233, 326, 9, 5, '#f2c230');
    box(c, 277, 337, 5, 5, '#f4f1ea');
    R(c, 278, 338, 3, 1, '#6a4a34');
    drawSlot(c, PHOTO_SLOTS[10], s.photos?.[10]);
    const day = String(s.data?.day || new Date().getDate()).padStart(2, '0');
    R(c, 284, 333, 11, 11, OL);
    R(c, 285, 334, 9, 9, '#fbf9f3');
    R(c, 285, 334, 9, 2, '#c0303e');
    pixelText(c, day, 285, 337, OL);
    if (s.data?.events) R(c, 292, 341, 2, 2, '#3d6a9a');
  }
  function drawCoatRack(c) {
    shadow(c, 491, 372, 8, 2, 0.25);
    R(c, 485, 369, 13, 3, OL);
    R(c, 490, 326, 2, 44, '#5a3a26');
    R(c, 486, 328, 10, 2, '#5a3a26');
    box(c, 483, 330, 8, 18, '#2f3a5a');
    box(c, 491, 332, 8, 15, '#c9b48f');
    box(c, 486, 346, 7, 8, '#c0503e');
    R(c, 488, 344, 3, 2, OL);
  }
  function drawShoeBench(c) {
    box(c, 400, 360, 36, 12, '#a87048');
    R(c, 402, 365, 32, 1, OL);
    pixels(c, [[403, 357, 4, 3], [408, 357, 4, 3]], '#c0303e');
    pixels(c, [[415, 357, 4, 3], [420, 357, 4, 3]], '#5a6a7a');
    pixels(c, [[427, 357, 4, 3], [432, 358, 3, 2]], '#f4f1ea');
  }

  function drawWardrobe(c, s) {
    const x = 124;
    const y = 10;
    shadow(c, x + 21, y + 66, 22, 3, 0.25);
    box(c, x, y, 42, 66, '#b88a5e');
    R(c, x + 2, y + 2, 38, 3, '#d0a478');
    if (s.props.wardrobe) {
      R(c, x + 3, y + 6, 36, 56, '#4a3224');
      R(c, x + 4, y + 9, 34, 1, '#9aa3a8');
      const clothes = ['#1f1e24', '#f4f1ea', '#c0503e', '#3d6a9a', '#1f1e24', '#e3b86a', '#a9c7e3'];
      clothes.forEach((color, i) => box(c, x + 5 + i * 5, y + 10, 5, 18 + (i % 3) * 6, color, { hi: 0.2, lo: -0.2 }));
      // Puertas abiertas a los lados.
      box(c, x - 8, y + 4, 9, 62, '#c99a6b');
      box(c, x + 41, y + 4, 9, 62, '#c99a6b');
    } else {
      R(c, x + 21, y + 6, 1, 56, tone('#b88a5e', -0.4));
      R(c, x + 18, y + 32, 1, 6, '#e3b86a');
      R(c, x + 24, y + 32, 1, 6, '#e3b86a');
      R(c, x + 4, y + 6, 1, 54, tone('#b88a5e', 0.15));
    }
    R(c, x + 2, y + 62, 38, 3, tone('#b88a5e', -0.3));
  }

  // Espejo de pie con forma de gota, como el de vuestra foto. Refleja a quien se pone delante.
  const MIRROR = { x: 317, top: 188, bottom: 252 };
  function dropPath(inset) {
    const path = new Path2D();
    const { x, top, bottom } = MIRROR;
    const cx = x;
    path.moveTo(cx + 1, top + inset);
    path.bezierCurveTo(cx + 9 - inset, top + 6 + inset, cx + 15 - inset, top + 30, cx + 13 - inset, bottom - 18);
    path.bezierCurveTo(cx + 12 - inset, bottom - 4 - inset, cx + 4, bottom - inset, cx - 2, bottom - inset);
    path.bezierCurveTo(cx - 10 + inset, bottom - inset, cx - 14 + inset, bottom - 10, cx - 13 + inset, bottom - 24);
    path.bezierCurveTo(cx - 12 + inset, top + 22, cx - 7 + inset, top + 6, cx + 1, top + inset);
    return path;
  }
  const MIRROR_OUTER = typeof Path2D !== 'undefined' ? dropPath(0) : null;
  const MIRROR_FRAME = typeof Path2D !== 'undefined' ? dropPath(1) : null;
  const MIRROR_GLASS = typeof Path2D !== 'undefined' ? dropPath(3) : null;
  const REFLECT_DIR = { up: 'down', down: 'up', left: 'left', right: 'right' };
  function drawMirror(c, s, t) {
    const { x, bottom } = MIRROR;
    shadow(c, x, bottom + 1, 13, 3, 0.25);
    c.fillStyle = OL;
    c.fill(MIRROR_OUTER);
    c.fillStyle = '#d9c3a5';
    c.fill(MIRROR_FRAME);
    c.fillStyle = '#bfd8de';
    c.fill(MIRROR_GLASS);
    c.save();
    c.clip(MIRROR_GLASS);
    // Lo que hay detrás de ti: la pared y el suelo del dormitorio.
    R(c, x - 16, MIRROR.top, 32, 64, '#ece4d4');
    R(c, x - 16, bottom - 22, 32, 24, '#b07a4c');
    R(c, x - 16, bottom - 23, 32, 1, '#f6f1e8');
    // La puerta del baño y la ventana, al fondo del reflejo.
    R(c, x - 14, MIRROR.top + 14, 6, 26, '#d8cfbf');
    // Reflejos de los muñecos que están delante (los de más lejos, más pequeños y detrás).
    s.actors
      .filter((a) => !a.hidden && Math.abs(a.x - x) < 34 && a.y > bottom + 8 && a.y < bottom + 100)
      .sort((a, b) => b.y - a.y)
      .forEach((a) => {
        const depth = Math.max(0, a.y - bottom - 30);
        const scale = Math.max(0.5, 0.8 - depth / 180);
        const rx = x + (a.x - x) * 0.7;
        const ry = bottom - 2 - depth * 0.22;
        c.globalAlpha = 0.92;
        drawActorFrame(c, a, rx, ry, scale, REFLECT_DIR[a.dir] || a.dir);
        c.globalAlpha = 1;
        if (a.prop === 'phone') R(c, rx + 4 * scale, ry - 34 * scale, 3, 4, '#f0d48a');
      });
    // Brillo del cristal y destello del selfie.
    c.globalAlpha = 0.35;
    R(c, x - 8, MIRROR.top + 16, 2, 14, '#ffffff');
    R(c, x - 6, MIRROR.top + 10, 2, 6, '#ffffff');
    c.globalAlpha = 1;
    if (s.flashUntil > t) {
      c.globalAlpha = Math.min(1, (s.flashUntil - t) / 300);
      R(c, x - 16, MIRROR.top, 32, bottom - MIRROR.top, '#ffffff');
      c.globalAlpha = 1;
    }
    c.restore();
    // Patas del soporte.
    R(c, x - 9, bottom - 2, 2, 4, OL);
    R(c, x + 8, bottom - 2, 2, 4, OL);
  }

  function drawTub(c, s) {
    const x = 228;
    const y = 40;
    shadow(c, x + 36, y + 52, 38, 3, 0.2);
    box(c, x, y, 72, 50, '#f4f6f6', { hi: 0.4, lo: -0.12 });
    R(c, x + 4, y + 4, 64, 40, '#d7e6ea');
    R(c, x + 6, y + 6, 60, 36, s.props.bath ? '#a8dcea' : '#e2eef1');
    R(c, x + 58, y + 8, 3, 3, '#9aa3a8');
    R(c, x + 57, y + 6, 6, 2, '#b9c2c6');
  }
  // Borde delantero de la bañera, espuma y cortina: tapan a quien se baña.
  function drawTubFront(c, s, t) {
    const x = 228;
    const y = 40;
    if (s.props.bath) {
      for (let i = 0; i < 16; i += 1) {
        const bx = x + 8 + ((i * 17) % 56);
        const by = y + 18 + ((i * 11) % 18) + Math.sin(t / 400 + i) * 1;
        ovalBox(c, bx, by, 3 + (i % 3), 2 + (i % 2), '#ffffff');
      }
    }
    R(c, x + 1, y + 42, 70, 5, '#f4f6f6');
    R(c, x + 1, y + 46, 70, 2, '#c5d1d4');
    R(c, x, y + 48, 72, 1, OL);
    // Cortina: recogida a la derecha o cerrada durante la ducha.
    R(c, x, y - 2, 72, 1, '#8a8f96');
    if (s.props.shower) {
      for (let i = 0; i < 70; i += 1) R(c, x + 1 + i, y - 1, 1, 46 + ((i % 6) < 3 ? 1 : 0), (i % 6) < 3 ? '#9ad1c9' : '#86bdb4');
      R(c, x, y - 1, 1, 47, OL);
      R(c, x + 71, y - 1, 1, 47, OL);
    } else {
      for (let i = 0; i < 10; i += 1) R(c, x + 61 + i, y - 1, 1, 44, i % 3 ? '#9ad1c9' : '#86bdb4');
      R(c, x + 60, y - 1, 1, 44, OL);
    }
    if (s.props.shower) {
      c.globalAlpha = 0.6;
      for (let i = 0; i < 8; i += 1) R(c, x + 6 + i * 8, y + ((t / 20 + i * 13) % 30), 1, 4, '#ffffff');
      c.globalAlpha = 1;
    }
  }

  function drawSink(c) {
    shadow(c, 317, 68, 10, 2, 0.2);
    R(c, 315, 52, 5, 16, '#e4e9ea');
    R(c, 315, 52, 1, 16, OL);
    R(c, 319, 52, 1, 16, OL);
    ovalBox(c, 317, 48, 11, 5, '#fbfcfc');
    oval(c, 317, 48, 7, 3, '#d4e2e6');
    R(c, 316, 42, 2, 4, '#9aa3a8');
    R(c, 310, 44, 3, 2, '#7f9fc0');
    R(c, 322, 43, 2, 4, '#e98a6a');
  }

  function drawToilet(c) {
    box(c, 323, 112, 11, 22, '#f4f6f6', { hi: 0.4, lo: -0.12 });
    ovalBox(c, 315, 123, 8, 7, '#fbfcfc');
    oval(c, 314, 123, 5, 4, '#d4e2e6');
  }

  function drawFridge(c, s) {
    const x = 346;
    const y = 6;
    shadow(c, x + 12, y + 74, 13, 3, 0.25);
    box(c, x, y, 24, 72, '#eef1f2', { hi: 0.35, lo: -0.15 });
    R(c, x + 1, y + 28, 22, 1, '#b9c2c6');
    R(c, x + 19, y + 12, 2, 10, '#9aa3a8');
    R(c, x + 19, y + 34, 2, 14, '#9aa3a8');
    // La nota de la compra (una raya por cosa apuntada), imanes de Italia y España y una foto.
    const items = Math.min(s.data?.shopping || 0, 6);
    R(c, x + 3, y + 33, 12, 15, 'rgba(0,0,0,.15)');
    R(c, x + 2, y + 32, 12, 15, '#fbf6dc');
    for (let i = 0; i < items; i += 1) R(c, x + 4, y + 35 + i * 2, 5 + ((i * 3) % 4), 1, '#5a6a8a');
    if (!items) pixelText(c, 'OK', x + 4, y + 37, '#3a9a5a');
    R(c, x + 7, y + 31, 2, 2, '#c0303e');
    pixels(c, [[x + 16, y + 34, 1, 3], [x + 17, y + 34, 1, 3], [x + 18, y + 34, 1, 3]], '#3a9a5a');
    pixels(c, [[x + 17, y + 34, 1, 3]], '#f4f1ea');
    pixels(c, [[x + 18, y + 34, 1, 3]], '#c0303e');
    pixels(c, [[x + 16, y + 40, 3, 1], [x + 16, y + 42, 3, 1]], '#c0303e');
    pixels(c, [[x + 16, y + 41, 3, 1]], '#f2c230');
    drawSlot(c, PHOTO_SLOTS[9], s.photos?.[9]);
    if (s.props.fridge) {
      box(c, x - 14, y + 29, 15, 44, '#eef1f2');
      R(c, x + 1, y + 29, 22, 42, '#fff7c2');
      for (let i = 0; i < 3; i += 1) R(c, x + 2, y + 41 + i * 11, 20, 1, '#d9cf9a');
      pixels(c, [[x + 4, y + 35, 4, 5], [x + 12, y + 36, 6, 4], [x + 3, y + 46, 7, 4], [x + 13, y + 47, 4, 3], [x + 6, y + 57, 10, 3]], '#e07a5f');
      pixels(c, [[x + 4, y + 35, 4, 1], [x + 13, y + 47, 4, 1]], '#f2c230');
    }
  }

  function drawCounter(c, s, t) {
    const x = 370;
    const y = 32;
    shadow(c, x + 50, y + 42, 50, 3, 0.2);
    box(c, x, y + 22, 100, 20, '#7f9a7a');
    for (let i = x + 24.5; i < x + 100; i += 24.5) R(c, i, y + 24, 1, 16, tone('#7f9a7a', -0.35));
    for (let i = x + 10; i < x + 100; i += 24.5) R(c, i, y + 28, 4, 1, '#d9c38e');
    // Encimera.
    R(c, x - 1, y, 102, 24, OL);
    R(c, x, y + 1, 100, 22, '#e9e1d2');
    R(c, x, y + 1, 100, 1, '#fbf8f2');
    R(c, x, y + 21, 100, 2, '#cfc4b1');
    // Fogones.
    R(c, x + 24, y + 4, 30, 16, '#2a2a2e');
    [[x + 30, y + 8], [x + 46, y + 8], [x + 30, y + 16], [x + 46, y + 16]].forEach(([bx, by], i) => {
      oval(c, bx, by, 4, 2, s.props.stove && i === 0 ? '#e0533f' : '#4a4a50');
      oval(c, bx, by, 2, 1, '#2a2a2e');
    });
    // Olla y la cafetera italiana.
    box(c, x + 24, y - 2, 13, 11, '#9aa3a8');
    R(c, x + 25, y - 2, 11, 2, '#c5ccce');
    R(c, x + 21, y + 2, 3, 2, '#6a6f74');
    R(c, x + 37, y + 2, 3, 2, '#6a6f74');
    box(c, x + 43, y + 10, 6, 8, '#b9c2c6');
    R(c, x + 44, y + 8, 4, 2, '#6a6f74');
    // Fregadero (con espuma si se friegan los platos).
    R(c, x + 64, y + 5, 26, 14, '#9aa3a8');
    R(c, x + 66, y + 7, 22, 10, '#c5ccce');
    if (s.props.dishes) for (let i = 0; i < 6; i += 1) ovalBox(c, x + 69 + i * 3, y + 10 + (i % 2) * 3 + Math.sin(t / 300 + i), 2, 2, '#ffffff');
    if (s.props.coffee) {
      c.globalAlpha = 0.7;
      R(c, x + 45, y + 4 - ((t / 60) % 6), 1, 2, '#ffffff');
      R(c, x + 47, y + 2 - ((t / 70) % 6), 1, 2, '#ffffff');
      c.globalAlpha = 1;
    }
    R(c, x + 76, y + 2, 2, 5, '#6a6f74');
    // Tabla de cortar con tomates, albahaca y frutero.
    box(c, x + 4, y + 6, 16, 11, '#c99a6b');
    pixels(c, [[x + 7, y + 9, 3, 3], [x + 12, y + 10, 3, 3]], '#d6333f');
    pixels(c, [[x + 8, y + 8, 1, 1], [x + 13, y + 9, 1, 1]], '#3a9a5a');
    ovalBox(c, x + 95, y + 10, 4, 3, '#c99a6b');
    pixels(c, [[x + 92, y + 7, 3, 3], [x + 96, y + 7, 3, 3]], '#f2c230');
    pixels(c, [[x + 94, y + 6, 3, 3]], '#e07a5f');
    R(c, x + 58, y + 3, 4, 6, '#4c9a5a');
    R(c, x + 57, y + 9, 6, 4, '#c47a52');
  }

  function drawTable(c, s) {
    const x = 410;
    const y = 106;
    shadow(c, x + 30, y + 34, 32, 3, 0.25);
    box(c, x, y, 60, 26, '#b88a5e');
    R(c, x + 2, y + 2, 56, 2, '#d0a478');
    // Mantel de cuadros (picnic italiano) en el centro.
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 3; j += 1) R(c, x + 18 + i * 4, y + 6 + j * 4, 4, 4, (i + j) % 2 ? '#f4f1ea' : '#c0503e');
    R(c, x + 4, y + 25, 3, 8, '#7a4e30');
    R(c, x + 53, y + 25, 3, 8, '#7a4e30');
    if (s.props.puzzle) {
      R(c, x + 4, y + 4, 20, 14, '#eadab4');
      R(c, x + 36, y + 6, 18, 12, '#1f3b6e');
      pixels(c, [[x + 6, y + 6, 4, 3], [x + 14, y + 10, 3, 3], [x + 38, y + 8, 5, 3], [x + 46, y + 12, 4, 3]], '#4f7bb0');
      pixels(c, [[x + 28, y + 16, 3, 3], [x + 31, y + 4, 3, 2]], '#eadab4');
    } else {
      ovalBox(c, x + 10, y + 12, 4, 3, '#ffffff');
      R(c, x + 9, y + 10, 3, 2, '#e6a85a');
      box(c, x + 46, y + 7, 6, 7, '#ffffff');
      R(c, x + 52, y + 9, 2, 3, '#ffffff');
    }
  }

  function drawChair(c, x, side) {
    const y = 108;
    shadow(c, x + 7, y + 28, 8, 2, 0.22);
    box(c, x, y + 8, 14, 12, '#a87048');
    if (side === 'left') box(c, x - 2, y - 2, 5, 24, '#8a5a3a');
    else box(c, x + 11, y - 2, 5, 24, '#8a5a3a');
    R(c, x + 1, y + 20, 2, 7, '#6a4a34');
    R(c, x + 11, y + 20, 2, 7, '#6a4a34');
  }

  function drawCoffeeTable(c) {
    shadow(c, 108, 312, 22, 3, 0.25);
    ovalBox(c, 108, 300, 21, 9, '#8a5a3a');
    oval(c, 108, 299, 19, 7, '#a87048');
    R(c, 94, 297, 10, 1, '#c08a5a');
    box(c, 112, 294, 6, 6, '#f4f1ea');
    R(c, 113, 295, 4, 1, '#6a4a34');
    R(c, 98, 299, 9, 5, '#3d6a9a');
    R(c, 98, 299, 9, 1, '#6f9acb');
  }

  function drawFloorLamp(c) {
    shadow(c, 368, 248, 6, 2, 0.25);
    R(c, 363, 246, 10, 2, OL);
    R(c, 367, 206, 2, 40, '#3a3a40');
    box(c, 360, 196, 16, 12, '#efe2c4');
    R(c, 362, 198, 12, 1, '#fbf3dc');
  }

  function drawMonstera(c, t, x = 486, y = 262, dry = false) {
    const pal = dry ? DRYS : GREENS;
    const sway = Math.round(Math.sin(t / 1600) * 1);
    const leaf = (lx, ly, r) => {
      ly += dry ? 4 : 0;
      ovalBox(c, lx, ly, r, r - 1, pal[0]);
      R(c, lx - 1, ly - r + 2, 1, r * 2 - 3, tone(pal[0], -0.25));
      R(c, lx - r + 2, ly, 2, 1, '#33221a');
      R(c, lx + r - 3, ly - 1, 2, 1, '#33221a');
      R(c, lx - r + 3, ly - 2, 2, 1, pal[3]);
    };
    leaf(x - 8 + sway, y - 34, 7);
    leaf(x + 6 + sway, y - 40, 8);
    leaf(x - 2, y - 26, 7);
    leaf(x + 9, y - 22, 6);
    box(c, x - 8, y - 12, 16, 13, '#e9e1d2');
    R(c, x - 7, y - 9, 14, 1, '#cfc4b1');
  }

  // layer 'static': muebles pegados a la pared, que nunca tapan a nadie (se pintan una vez).
  const OBJECTS = [
    // Dormitorio
    { id: 'bed', sort: 64, layer: 'static', hit: [66, 38, 72, 86], block: [66, 52, 72, 72], draw: (c) => shifted(c, 38, 0, () => drawBed(c)) },
    { id: 'bedCover', sort: 123, draw: drawCover },
    { id: 'nightstandL', sort: 76, layer: 'static', block: [46, 56, 18, 22], draw: (c) => drawNightstand(c, 46) },
    { id: 'nightstandR', sort: 76, layer: 'static', block: [140, 56, 18, 22], draw: (c, s) => drawNightstand(c, 140, s.photos?.[8] || null) },
    { id: 'wardrobe', sort: 77, hit: [160, 8, 46, 70], block: [160, 56, 48, 22], draw: (c, s) => shifted(c, 38, 0, () => drawWardrobe(c, s)) },
    { id: 'basket', sort: 112, block: [10, 98, 16, 14], draw: drawBasket },
    // Baño
    { id: 'shower', sort: 60, hit: [226, 14, 76, 78], block: [226, 56, 76, 36], draw: drawTub },
    { id: 'showerFront', sort: 93, draw: drawTubFront },
    { id: 'sink', sort: 69, layer: 'static', hit: [302, 12, 30, 58], block: [304, 56, 26, 14], draw: drawSink },
    { id: 'toilet', sort: 137, block: [306, 112, 30, 24], draw: drawToilet },
    { id: 'washer', sort: 173, hit: [306, 142, 30, 32], block: [308, 148, 28, 24], draw: drawWasher },
    // Cocina
    { id: 'fridge', sort: 79, hit: [344, 4, 28, 76], block: [344, 56, 28, 24], draw: drawFridge },
    { id: 'stove', sort: 75, hit: [390, 26, 42, 50], block: [369, 56, 103, 20], draw: drawCounter },
    { id: 'ksink', sort: 0, hit: [432, 30, 32, 44] },
    { id: 'winerack', sort: 77, layer: 'static', hit: [470, 40, 34, 38], block: [472, 56, 30, 22], draw: drawWineRack },
    { id: 'table', sort: 141, hit: [344, 108, 98, 40], block: [362, 114, 60, 26], draw: (c, s) => shifted(c, -48, 8, () => drawTable(c, s)) },
    { id: 'chairL', sort: 136, block: [345, 124, 14, 14], draw: (c) => shifted(c, -48, 8, () => drawChair(c, 393, 'left')) },
    { id: 'chairR', sort: 136, block: [425, 124, 14, 14], draw: (c) => shifted(c, -48, 8, () => drawChair(c, 473, 'right')) },
    // Salón
    { id: 'lamp', sort: 252, layer: 'static', block: [10, 240, 20, 12], draw: (c) => shifted(c, -348, 0, () => drawFloorLamp(c)) },
    { id: 'sofa', sort: 269, hit: [36, 220, 104, 48], block: [36, 232, 104, 36], draw: (c, s) => shifted(c, -16, 0, () => drawSofa(c, s)) },
    { id: 'radio', sort: 263, hit: [144, 228, 32, 36], block: [144, 236, 32, 28], draw: (c, s, t) => shifted(c, -14, 0, () => drawRecordPlayer(c, s, t)) },
    ...PLANT_SLOTS.map((slot, index) => ({ id: `plant${index}`, sort: slot.sort, hit: slot.hit, block: slot.block, draw: (c, s, t) => drawPlantSlot(c, s, t, index) })),
    { id: 'board', sort: 2, hit: [118, 186, 24, 34], draw: drawBoard },
    { id: 'mirror', sort: 253, hit: [302, 186, 30, 68], block: [304, 242, 28, 12], draw: drawMirror },
    { id: 'bookshelf', sort: 247, layer: 'static', hit: [380, 184, 62, 64], block: [380, 232, 62, 16], draw: (c) => shifted(c, 84, 0, () => bookshelf(c)) },
    { id: 'coffee', sort: 310, block: [68, 291, 44, 19], draw: (c) => shifted(c, -18, 0, () => drawCoffeeTable(c)) },
    { id: 'tv', sort: 371, hit: [50, 322, 82, 50], block: [50, 330, 80, 46], draw: (c, s, t) => shifted(c, -16, 0, () => drawTvBack(c, s, t)) },
    { id: 'deskchair', sort: 336, draw: drawDeskChair },
    { id: 'desk', sort: 373, hit: [228, 326, 68, 48], block: [228, 342, 68, 32], draw: drawDesk },
    { id: 'coatrack', sort: 372, hit: [480, 324, 22, 50], block: [482, 352, 18, 20], draw: drawCoatRack },
    { id: 'shoes', sort: 372, layer: 'static', block: [400, 358, 36, 14], draw: drawShoeBench },
    // Cosas que se tocan pero ya están pintadas (paredes y suelo).
    { id: 'shark', sort: 270, hit: [100, 236, 30, 18] },
    { id: 'wave', sort: 1, hit: [58, 184, 60, 40] },
    { id: 'photo', sort: 2, hit: [38, 188, 20, 32] },
    { id: 'photo2', sort: 2, hit: [119, 188, 20, 32] },
    { id: 'polaroids', sort: 2, hit: [68, 12, 70, 26] },
    { id: 'window', sort: 1, hit: [334, 186, 46, 40] },
    { id: 'yoga', sort: 1, hit: [338, 298, 56, 20] },
    { id: 'door', sort: 1, hit: [434, 354, 46, 30] },
    // Adornos de la temática (si no hay, no se dibuja nada).
    { id: 'themeSpot', sort: 368, block: [14, 356, 26, 14], draw: drawThemeSpot },
    { id: 'themeTable', sort: 142, draw: drawThemeTable },
    { id: 'themeCoffee', sort: 311, draw: drawThemeCoffee }
  ];
  const OBJECT_BY_ID = Object.fromEntries(OBJECTS.map((object) => [object.id, object]));

  // ---------- Por dónde se puede andar (una red por escena) ----------
  const CELL = 4;
  const GW = W / CELL;
  const GH = H / CELL;
  const PAD_X = 6;
  const PAD_Y = 3;
  const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;

  function makeNav(walkAreas, objects) {
    const blockers = objects.filter((object) => object.block).map(({ block: [x, y, w, h] }) => [x - PAD_X, y - PAD_Y, w + PAD_X * 2, h + PAD_Y * 2]);
    const free = (x, y) => walkAreas.some((area) => inRect(x, y, area)) && !blockers.some((block) => inRect(x, y, block));
    const grid = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy += 1) for (let gx = 0; gx < GW; gx += 1) grid[gy * GW + gx] = free(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;
    const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))];
    const center = (gx, gy) => ({ x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2 });

    function nearestFree(x, y) {
      if (free(x, y)) return { x, y };
      for (let r = 2; r < 160; r += 2) {
        for (let a = 0; a < 16; a += 1) {
          const px = x + Math.cos((a / 16) * Math.PI * 2) * r;
          const py = y + Math.sin((a / 16) * Math.PI * 2) * r;
          if (free(px, py)) return { x: px, y: py };
        }
      }
      return { x, y };
    }

    function lineFree(a, b) {
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
      for (let i = 1; i < steps; i += 1) {
        if (!free(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)) return false;
      }
      return true;
    }

    // A* sobre una cuadrícula de 4 px y luego se estira el camino para que no haga zigzag.
    function findPath(from, to) {
      const start = nearestFree(from.x, from.y);
      const goal = nearestFree(to.x, to.y);
      if (lineFree(start, goal)) return [goal];
      const [sx, sy] = cellOf(start.x, start.y);
      const [tx, ty] = cellOf(goal.x, goal.y);
      const startId = sy * GW + sx;
      const goalId = ty * GW + tx;
      const gScore = new Float32Array(GW * GH).fill(Infinity);
      const came = new Int32Array(GW * GH).fill(-1);
      const closed = new Uint8Array(GW * GH);
      const heap = [];
      const push = (id, f) => {
        heap.push([f, id]);
        let i = heap.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (heap[p][0] <= heap[i][0]) break;
          [heap[p], heap[i]] = [heap[i], heap[p]];
          i = p;
        }
      };
      const pop = () => {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1;
            const r = l + 1;
            let m = i;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === i) break;
            [heap[m], heap[i]] = [heap[i], heap[m]];
            i = m;
          }
        }
        return top;
      };
      const h = (id) => Math.hypot((id % GW) - tx, Math.floor(id / GW) - ty);
      gScore[startId] = 0;
      push(startId, h(startId));
      let found = false;
      while (heap.length) {
        const [, id] = pop();
        if (closed[id]) continue;
        if (id === goalId) { found = true; break; }
        closed[id] = 1;
        const cx = id % GW;
        const cy = Math.floor(id / GW);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
            const nid = ny * GW + nx;
            if (!grid[nid] || closed[nid]) continue;
            if (dx && dy && (!grid[cy * GW + nx] || !grid[ny * GW + cx])) continue;
            const g = gScore[id] + (dx && dy ? 1.414 : 1);
            if (g < gScore[nid]) {
              gScore[nid] = g;
              came[nid] = id;
              push(nid, g + h(nid));
            }
          }
        }
      }
      if (!found) return [goal];
      const cells = [];
      for (let id = goalId; id !== -1 && id !== startId; id = came[id]) cells.push(center(id % GW, Math.floor(id / GW)));
      cells.reverse();
      cells[cells.length - 1] = goal;
      const out = [];
      let anchor = start;
      let i = 0;
      while (i < cells.length) {
        let j = cells.length - 1;
        while (j > i && !lineFree(anchor, cells[j])) j -= 1;
        out.push(cells[j]);
        anchor = cells[j];
        i = j + 1;
      }
      return out;
    }
    return { free, lineFree, nearestFree, findPath };
  }

  // ---------- Escenas: la casa y los sitios a los que se puede ir (sims-places.js) ----------
  const HOUSE_WALK = [
    ...Object.values(ROOMS).map(([x, y, w, h]) => [x + PAD_X, y + 4, w - PAD_X * 2, h - 4 - PAD_Y]),
    ...DOORS.map(([x, w]) => [x + PAD_X, 168, w - PAD_X * 2, 72])
  ];
  const SCENES = {
    house: { id: 'house', label: 'Casa', indoor: true, bake: bakeBackground, objects: OBJECTS, walk: HOUSE_WALK, lights: [[112, 112, 80], [280, 118, 56], [424, 118, 70], [90, 300, 90], [300, 300, 90], [440, 300, 70]] }
  };
  function registerScene(def) {
    SCENES[def.id] = def;
  }
  let activeScene = SCENES.house;
  const navOf = (scene) => (scene.nav ||= makeNav(scene.walk, scene.objects));
  const free = (x, y) => navOf(activeScene).free(x, y);
  const lineFree = (a, b) => navOf(activeScene).lineFree(a, b);
  const nearestFree = (x, y) => navOf(activeScene).nearestFree(x, y);
  const findPath = (from, to) => navOf(activeScene).findPath(from, to);

  // ---------- Los perros: Kika (salchicha arlequín) y Loco (labrador rubio) ----------
  // Dibujados a mano: de lado cuando van a izquierda o derecha y de frente o de espaldas.
  const BREEDS = {
    dachshund: { len: 24, legs: 3, body: 7, head: 7, snout: 5, ear: 6, fur: '#5a3220', light: '#d2ab82', belly: '#7a4a30', earColor: '#3e2215', spots: true, collar: '#d6333f' },
    labrador: { len: 22, legs: 7, body: 9, head: 9, snout: 4, ear: 5, fur: '#e6c68a', light: '#f6e6c2', belly: '#f2ddb0', earColor: '#cfa864', spots: false, collar: '#3d6a9a', thickTail: true }
  };
  // Manchas claras del arlequín (en coordenadas del cuerpo, de 0 a 1).
  const DAPPLE = [[0.15, 0.2], [0.32, 0.55], [0.5, 0.15], [0.62, 0.6], [0.78, 0.3], [0.9, 0.65], [0.42, 0.35]];
  function drawDog(c, a, t) {
    const b = BREEDS[a.breed] || BREEDS.dachshund;
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    const walking = a.anim === 'walk';
    const step = walking ? Math.floor(a.stride / 3) % 2 : 0;
    const wag = Math.floor(t / (a.happy ? 80 : 260)) % 2;
    shadow(c, x, y, b.len / 2 + 3, 2, 0.25);
    if (a.dir === 'left' || a.dir === 'right') {
      c.save();
      c.translate(x, y);
      if (a.dir === 'right') c.scale(-1, 1);
      const half = b.len / 2;
      const sitDrop = a.sit ? Math.min(b.legs, 4) : 0;
      const top = -b.legs - b.body;
      const bob = walking && step ? 1 : 0;
      // Patas (las de atrás dobladas si está sentado).
      [[-half + 3, step], [-half + 6, -step], [half - 6, step], [half - 3, -step]].forEach(([lx, off], i) => {
        const back = i >= 2;
        const h = b.legs - (back ? sitDrop : 0);
        R(c, lx - 1 + off, -h, 3, h, OL);
        R(c, lx + off, -h, 1, h - 1, b.fur);
      });
      // Cuerpo, con la tripa más clara y las manchas.
      const bodyTop = top - bob + (a.sit ? sitDrop : 0);
      R(c, -half - 1, bodyTop - 1, b.len + 2, b.body + 2, OL);
      R(c, -half, bodyTop, b.len, b.body, b.fur);
      R(c, -half, bodyTop, b.len, 1, tone(b.fur, 0.18));
      R(c, -half + 2, bodyTop + b.body - 2, b.len - 4, 2, b.belly);
      if (b.spots) DAPPLE.forEach(([sx, sy], i) => R(c, -half + Math.round(sx * (b.len - 3)), bodyTop + Math.round(sy * (b.body - 2)), i % 2 ? 2 : 3, 2, b.light));
      // Cola: fina y curva (Kika) o gruesa de nutria (Loco).
      const tw = b.thickTail ? 2 : 1;
      pixels(c, [[half, bodyTop + 1 - wag * 2, tw + 2, 3], [half + 2, bodyTop - 1 - wag * 3, tw + 1, 3]], OL);
      pixels(c, [[half, bodyTop + 2 - wag * 2, tw + 1, 1], [half + 2, bodyTop - wag * 3, tw, 2]], b.fur);
      // Cabeza con hocico largo, nariz, ojo y oreja caída.
      const hx = -half - b.head + 4;
      const hy = bodyTop - b.head + (b.legs > 4 ? 2 : 4);
      R(c, hx - 1, hy - 1, b.head + 2, b.head + 2, OL);
      R(c, hx, hy, b.head, b.head, b.fur);
      R(c, hx, hy, b.head, 1, tone(b.fur, 0.18));
      R(c, hx - b.snout - 1, hy + b.head - 5, b.snout + 2, 5, OL);
      R(c, hx - b.snout, hy + b.head - 4, b.snout + 1, 3, b.spots ? b.fur : b.light);
      R(c, hx - b.snout - 1, hy + b.head - 5, 2, 2, '#1d1d22');
      R(c, hx + 1, hy + 2, 1, 1, '#1d1d22');
      R(c, hx + b.head - 4, hy - 1, 4, b.ear + 1, OL);
      R(c, hx + b.head - 3, hy, 2, b.ear, b.earColor);
      if (b.spots) { R(c, hx + 2, hy + 1, 2, 1, b.light); R(c, hx - 2, hy + b.head - 3, 1, 1, b.light); }
      if (a.happy && !walking) R(c, hx - b.snout + 1, hy + b.head - 1, 2, 2, '#e87a8a');
      R(c, hx + b.head - 1, hy + b.head - 3, 2, 3, b.collar);
      if (a.ball) ovalBox(c, hx - b.snout - 2, hy + b.head - 2, 2, 2, '#e8e04a');
      c.restore();
    } else {
      // De frente o de espaldas.
      const back = a.dir === 'up';
      const w = b.legs > 4 ? 12 : 10;
      const bh = b.legs > 4 ? 10 : 7;
      [[-4, step], [3, -step]].forEach(([lx, off]) => { R(c, x + lx - 1, y - b.legs - 1 + off, 3, b.legs + 1 - off, OL); R(c, x + lx, y - b.legs + off, 1, b.legs - off, b.fur); });
      R(c, x - w / 2 - 1, y - b.legs - bh - 1, w + 2, bh + 2, OL);
      R(c, x - w / 2, y - b.legs - bh, w, bh, b.fur);
      if (!back) R(c, x - 2, y - b.legs - bh + 1, 4, bh - 2, b.light);
      if (back) pixels(c, [[x - 1, y - b.legs - bh - 4 - wag, 2, 5]], b.fur);
      if (b.spots) DAPPLE.slice(0, 4).forEach(([sx, sy]) => R(c, x - w / 2 + Math.round(sx * (w - 2)), y - b.legs - bh + Math.round(sy * (bh - 2)), 2, 1, b.light));
      const hy = y - b.legs - bh - b.head + 2;
      R(c, x - b.head / 2 - 1, hy - 1, b.head + 2, b.head + 2, OL);
      R(c, x - b.head / 2, hy, b.head, b.head, b.fur);
      R(c, x - b.head / 2 - 2, hy, 3, b.ear + 1, OL);
      R(c, x + b.head / 2 - 1, hy, 3, b.ear + 1, OL);
      R(c, x - b.head / 2 - 1, hy + 1, 1, b.ear - 1, b.earColor);
      R(c, x + b.head / 2, hy + 1, 1, b.ear - 1, b.earColor);
      if (!back) {
        R(c, x - 2, hy + 2, 1, 1, '#1d1d22');
        R(c, x + 1, hy + 2, 1, 1, '#1d1d22');
        R(c, x - 1, hy + b.head - 3, 3, 3, b.light);
        R(c, x - 1, hy + b.head - 3, 2, 1, '#1d1d22');
        if (a.happy) R(c, x - 1, hy + b.head, 2, 1, '#e87a8a');
        R(c, x - 3, hy + b.head + 1, 6, 1, b.collar);
      }
    }
  }

  // ---------- Muñecos ----------
  const images = {};
  const faceImages = {};
  const loadImage = (store, key, src, optional) => new Promise((resolve, reject) => {
    if (store[key]?.complete && store[key].naturalWidth) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => (optional ? resolve() : reject(new Error(`No se pudo cargar ${src}`)));
    img.src = src;
    store[key] = img;
  });
  function loadSheet(id) {
    return SHEETS[id] ? loadImage(images, id, SHEETS[id].src, true) : Promise.resolve();
  }
  // Retrato de frente (para el armario): el primer fotograma de estar de pie mirando abajo.
  async function portrait(id, canvas) {
    await loadSheet(id);
    const img = images[id];
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!img?.naturalWidth) return;
    const rows = SHEETS[id].rows;
    const row = rows ? rows.indexOf(24) : 24;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 16, row * 64 + 8, 32, 56, 0, 0, canvas.width, canvas.height);
  }
  function loadSprites() {
    return Promise.all([
      ...['ines', 'matteo'].map((key) => loadImage(images, key, SHEETS[key].src)),
      // Sin las caras, los muñecos funcionan igual (solo no cambian de expresión).
      ...Object.entries(FACES).map(([key, face]) => loadImage(faceImages, key, face.src, true))
    ]);
  }

  // Un fotograma de la hoja (para el reflejo también, con otra dirección y tamaño).
  function drawActorFrame(c, a, x, y, scale = 1, dir = a.dir) {
    const anim = ANIMS[a.anim] || ANIMS.idle;
    const row = anim.row + (anim.single ? 0 : DIR_ROW[dir] ?? 2);
    let col = Math.max(0, Math.min(anim.frames - 1, Math.floor(a.frame || 0)));
    // Qué hoja y qué fila: la de su ropa si está cargada y tiene esa animación.
    const id = a.sprite || a.key;
    const sheet = SHEETS[id] || {};
    let img = images[id];
    let drawRow = row;
    if (sheet.rows) {
      const index = sheet.rows.indexOf(row);
      if (img?.naturalWidth && index >= 0) drawRow = index;
      else if (sheet.base) img = images[sheet.base];
      else if (img?.naturalWidth) {
        drawRow = sheet.rows.indexOf(22 + (DIR_ROW[dir] ?? 2));
        col = col % 2;
      } else img = null;
    }
    if (!img?.naturalWidth) return;
    const size = Math.round(64 * scale);
    const dx = Math.round(x - 32 * scale);
    const dy = Math.round(y - 62 * scale);
    c.drawImage(img, col * 64, drawRow * 64, 64, 64, dx, dy, size, size);
    // Expresión: se pintan encima solo los ojos y la boca que cambian.
    const faceIndex = FACE_ORDER.indexOf(a.face);
    const faceImg = a.npc ? null : faceImages[a.key];
    if (faceIndex >= 0 && faceImg?.naturalWidth && !anim.single) {
      const [bx, by, bw, bh] = FACES[a.key].box;
      c.drawImage(faceImg, col * bw, (faceIndex * 54 + row) * bh, bw, bh, dx + Math.round(bx * scale), dy + Math.round(by * scale), Math.round(bw * scale), Math.round(bh * scale));
    }
  }

  // Cosas en la mano según hacia dónde miran.
  const HAND = { down: [7, -22], up: [-7, -24], left: [-9, -22], right: [9, -22] };
  function drawProp(c, a) {
    if (!a.prop) return;
    const sitting = a.anim === 'sit';
    const [hx, hy] = HAND[a.dir] || HAND.down;
    const x = Math.round(a.x + (sitting ? hx * 0.4 : hx));
    const y = Math.round(a.y + hy + (sitting ? 6 : 0));
    if (a.prop === 'phone') {
      if (a.dir === 'up') return;
      R(c, x - 1, y - 2, 4, 6, OL);
      R(c, x, y - 1, 2, 4, '#f0d48a');
      R(c, x, y, 1, 1, '#e0533f');
    }
    if (a.prop === 'shark') drawShark(c, a.x, a.y - 18 + (sitting ? 6 : 0), a.dir === 'right' ? -1 : 1);
    if (a.prop === 'book') {
      R(c, x - 3, y - 2, 7, 6, OL);
      R(c, x - 2, y - 1, 5, 4, '#c0503e');
      R(c, x, y - 1, 1, 4, '#f4f1ea');
    }
    if (a.prop === 'controller') {
      R(c, x - 3, y - 1, 7, 4, OL);
      R(c, x - 2, y, 5, 2, '#3a3a40');
      R(c, x + 1, y, 1, 1, '#e0533f');
    }
    if (a.prop === 'wine') {
      R(c, x - 1, y - 3, 3, 4, OL);
      R(c, x, y - 2, 1, 2, '#8e1f3a');
      R(c, x, y + 1, 1, 2, OL);
      R(c, x - 1, y + 3, 3, 1, OL);
    }
    if (a.prop === 'cup') {
      R(c, x - 2, y - 2, 5, 5, OL);
      R(c, x - 1, y - 1, 3, 3, '#f4f1ea');
      R(c, x + 3, y - 1, 1, 2, OL);
    }
    if (a.prop === 'pillow') {
      R(c, x - 5, y - 4, 10, 8, OL);
      R(c, x - 4, y - 3, 8, 6, '#c9714a');
      R(c, x - 3, y - 2, 6, 1, '#e08e66');
    }
    if (a.prop === 'baby') {
      // El bebé en brazos, envuelto en su mantita.
      if (a.dir === 'up') return;
      const bx = Math.round(a.x + (a.dir === 'left' ? -3 : a.dir === 'right' ? 3 : 0));
      const by = Math.round(a.y - 24 * (a.scale || 1) + (sitting ? 4 : 0));
      ovalBox(c, bx, by, 5, 3, a.babyColor || '#f4f1ea');
      oval(c, bx + (a.dir === 'right' ? 2 : -2), by - 1, 2, 2, '#f1c7a5');
      R(c, bx + (a.dir === 'right' ? 1 : -3), by - 3, 3, 1, a.babyHair || '#c9a06a');
      return;
    }
    if (a.prop === 'gelato') {
      R(c, x - 1, y, 3, 5, OL);
      R(c, x, y + 1, 1, 3, '#d8a860');
      ovalBox(c, x, y - 2, 2, 2, '#9ad08a');
      R(c, x - 1, y - 4, 2, 2, '#f6c8d6');
    }
    if (a.prop === 'rose') {
      R(c, x, y - 1, 1, 6, '#3a9a5a');
      R(c, x - 2, y - 4, 5, 4, OL);
      R(c, x - 1, y - 3, 3, 2, '#d6333f');
    }
    if (a.prop === 'can') {
      R(c, x - 3, y - 2, 7, 6, OL);
      R(c, x - 2, y - 1, 5, 4, '#5aa0b8');
      R(c, x + (a.dir === 'left' ? -5 : 4), y - 2, 2, 1, '#5aa0b8');
    }
  }

  // Nube de enfado con lluvia y algún rayo, y las rayitas verdes de «no me he duchado».
  function drawMoodFx(c, a, t) {
    if (a.hidden) return;
    const x = Math.round(a.x + (a.ox || 0));
    if (a.storm) {
      const y = Math.round(a.headY - 16 + Math.sin(t / 500));
      for (let i = 0; i < 3; i += 1) R(c, x - 4 + ((t / 80 + i * 5) % 9), y + 6 + ((t / 40 + i * 7) % 8), 1, 2, '#7cc4e6');
      ovalBox(c, x - 4, y, 5, 3, '#5a5f6e');
      ovalBox(c, x + 3, y - 1, 6, 4, '#4a4f5e');
      oval(c, x - 4, y, 5, 3, '#5a5f6e');
      R(c, x - 3, y - 2, 6, 1, '#7a7f8e');
      if (Math.floor(t / 700) % 3 === 0) pixels(c, [[x + 2, y + 4, 2, 1], [x + 1, y + 5, 2, 1], [x + 2, y + 6, 2, 1], [x + 1, y + 7, 1, 2]], '#ffd166');
    }
    if (a.stinky) {
      c.globalAlpha = 0.75;
      for (let i = 0; i < 3; i += 1) {
        const phase = (t / 900 + i / 3) % 1;
        const sx = x - 8 + i * 8;
        const sy = Math.round(a.headY + 10 - phase * 16);
        R(c, sx + Math.round(Math.sin(phase * 8) * 1.5), sy, 1, 3, '#8fc23a');
        R(c, sx + Math.round(Math.sin(phase * 8 + 2) * 1.5), sy + 3, 1, 2, '#6fa22a');
      }
      c.globalAlpha = 1;
    }
  }

  function drawActor(c, a, t = 0) {
    if (a.hidden) return;
    if (a.kind === 'dog') return drawDog(c, a, t);
    if (a.shadow !== false) shadow(c, a.x, a.y, 9, 3, 0.26);
    if (a.clipY) clipRect(c, a.x - 40, a.y - 70, 80, a.clipY - (a.y - 70));
    drawActorFrame(c, a, a.x + (a.ox || 0), a.y + (a.oy || 0), a.scale || 1);
    if (a.clipY) c.restore();
    drawProp(c, a);
  }

  // Diamante de los Sims (verde, amarillo o rojo) que gira sobre la cabeza.
  const PLUMBOB = { green: ['#3fd46a', '#9cf2b4', '#1f8a3e'], yellow: ['#f2c230', '#fbe58a', '#a8820f'], red: ['#ef4f4f', '#f9a0a0', '#9a2020'] };
  function drawPlumbob(c, a, t) {
    if (a.kind === 'dog' || a.npc) return;
    const colors = PLUMBOB[a.plumbob];
    if (!colors || a.hidden) return;
    const x = Math.round(a.x + (a.ox || 0));
    const y = Math.round(a.headY - 12 + Math.sin(t / 420) * 1.5);
    const half = Math.max(1, Math.round(Math.abs(Math.cos(t / 600)) * 4));
    for (let i = 0; i < 6; i += 1) {
      const w = Math.round(half * (i / 5) * 2) || 1;
      R(c, x - w / 2 - 0.5, y - 6 + i, w + 1, 1, OL);
      R(c, x - w / 2, y - 6 + i, w, 1, i < 2 ? colors[1] : colors[0]);
    }
    for (let i = 0; i < 7; i += 1) {
      const w = Math.round(half * (1 - i / 7) * 2) || 1;
      R(c, x - w / 2 - 0.5, y + i, w + 1, 1, OL);
      R(c, x - w / 2, y + i, w, 1, colors[i > 3 ? 2 : 0]);
    }
  }

  // ---------- Partículas: corazones, notas, zetas, gotas, chispas… ----------
  const SHAPES = {
    heart: [[1, 0, 2, 1], [5, 0, 2, 1], [0, 1, 8, 2], [1, 3, 6, 1], [2, 4, 4, 1], [3, 5, 2, 1]],
    note: [[3, 0, 3, 1], [5, 1, 1, 4], [3, 1, 1, 4], [1, 4, 3, 2], [4, 4, 2, 2]],
    z: [[0, 0, 5, 1], [3, 1, 1, 1], [2, 2, 1, 1], [1, 3, 1, 1], [0, 4, 5, 1]],
    spark: [[2, 0, 1, 5], [0, 2, 5, 1]],
    drop: [[0, 0, 1, 2]],
    puff: [[1, 0, 2, 1], [0, 1, 4, 2], [1, 3, 2, 1]],
    feather: [[0, 0, 1, 1], [1, 1, 2, 1], [3, 2, 1, 1]],
    bolt: [[2, 0, 2, 1], [1, 1, 2, 1], [0, 2, 3, 1], [2, 3, 1, 1], [1, 4, 1, 1]],
    sparkle: [[1, 0, 1, 3], [0, 1, 3, 1]]
  };
  const PARTICLE_COLORS = { heart: '#ef476f', note: '#7a62b3', z: '#f4f9ff', spark: '#ffd166', drop: '#7cc4e6', puff: '#ffffff', feather: '#ffffff', bolt: '#ffd166', sparkle: '#fff6c8' };

  // ---------- El renderizador ----------
  function createWorld(container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sims-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Vuestro piso por dentro, con vuestros muñecos');
    const overlay = document.createElement('div');
    overlay.className = 'sims-overlay';
    container.replaceChildren(canvas, overlay);
    const c = canvas.getContext('2d');
    let scene = SCENES.house;
    activeScene = scene;
    let background = scene.bake();
    const light = document.createElement('canvas');
    light.width = W;
    light.height = H;
    const lc = light.getContext('2d');
    const staticLayer = document.createElement('canvas');
    staticLayer.width = W;
    staticLayer.height = H;
    const state = {
      actors: [],
      props: {},
      photos: [],
      projectiles: [],
      bedMode: null,
      romance: 0,
      lamps: false,
      time: 'day',
      particles: [],
      hover: null,
      selected: null,
      marker: null,
      flashUntil: 0,
      cam: { x: 0, y: 0, z: 1 },
      // Lo que cabe en pantalla (en píxeles del mundo): toda la casa en 4:3, o una franja que
      // sigue a tu muñeco en pantalla completa horizontal.
      view: { w: W, h: H },
      pan: null,
      follow: null,
      zoom: false,
      scene: 'house',
      plants: [],
      data: {},
      weather: { code: 1, temp: 18 },
      tram: null,
      phase: dayPhase(),
      phaseAt: 0
    };
    let scale = 2;
    // Muebles fijos y fotos de las paredes: se pintan una vez (y otra si llegan vuestras fotos).
    function bakeStatic() {
      const sc = staticLayer.getContext('2d');
      sc.clearRect(0, 0, W, H);
      sc.imageSmoothingEnabled = false;
      if (scene.id === 'house') PHOTO_SLOTS.slice(0, 8).forEach((slot, i) => drawSlot(sc, slot, state.photos[i]));
      scene.objects.filter((object) => object.layer === 'static').sort((a, b) => a.sort - b.sort).forEach((object) => object.draw(sc, state, 0));
    }
    // Cambiar de sitio: la casa, Turín, Chieti o España.
    function setScene(id) {
      if (!SCENES[id]) return;
      scene = SCENES[id];
      activeScene = scene;
      state.scene = id;
      state.particles = [];
      state.projectiles = [];
      state.hover = null;
      state.selected = null;
      background = scene.bake();
      bakeStatic();
    }
    bakeStatic();
    function setPhotos(list) {
      const valid = list.filter((img) => img?.naturalWidth);
      state.photos = valid.length ? PHOTO_SLOTS.map((slot, i) => pixelPhoto(valid[i % valid.length], slot.w, slot.h)) : [];
      bakeStatic();
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const aspect = rect.width && rect.height ? rect.width / rect.height : W / H;
      // Más ancha que 4:3: se ve todo el ancho y la cámara sube y baja; más alta: al revés.
      const view = aspect >= W / H ? { w: W, h: Math.round(W / aspect) } : { w: Math.round(H * aspect), h: H };
      state.view = view;
      scale = Math.max(1, Math.min(5, Math.round((rect.width * dpr) / view.w) || 2));
      canvas.width = view.w * scale;
      canvas.height = view.h * scale;
    }
    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    resize();

    // Luces del techo de cada habitación y las que se encienden con cosas.
    const LIGHTS = [[112, 112, 80], [280, 118, 56], [424, 118, 70], [90, 300, 90], [300, 300, 90], [440, 300, 70]];

    const isRain = (code) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    const isSnow = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;
    const isCloudy = (code) => [2, 3, 45, 48].includes(code) || isRain(code) || isSnow(code);
    // Cielo de los sitios de fuera: color según la hora, sol o luna, estrellas y nubes.
    function drawSky(t) {
      const horizon = scene.horizon || 170;
      const code = state.weather.code;
      const grey = isCloudy(code);
      const ph = state.phase || dayPhase();
      // Con nubes, el cielo se agrisa (menos de noche, que ya es oscuro).
      const greyF = grey ? 0.55 * (1 - ph.dark * 0.6) : 0;
      const colors = [mixHex(ph.top, '#9aa8b6', greyF), mixHex(ph.bottom, '#d0d6dc', greyF)];
      const grad = c.createLinearGradient(0, 0, 0, horizon);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      c.fillStyle = grad;
      c.fillRect(0, 0, W, horizon);
      // Estrellas que aparecen poco a poco al anochecer.
      if (ph.dark > 0.35) {
        const starA = Math.min(1, (ph.dark - 0.35) / 0.5);
        for (let i = 0; i < 40; i += 1) {
          const sx = (i * 97) % W;
          const sy = (i * 53) % (horizon - 30);
          c.globalAlpha = starA * (0.4 + 0.6 * Math.abs(Math.sin(t / 900 + i)));
          R(c, sx, sy, 1, 1, '#ffffff');
        }
        c.globalAlpha = 1;
      }
      // El sol cruza el cielo de 7:00 a 21:00 y la luna, de 20:00 a 7:00.
      const arc = (from, to, min) => {
        const span = (to - from + 1440) % 1440;
        const f = ((min - from + 1440) % 1440) / span;
        return f >= 0 && f <= 1 ? { x: 30 + f * (W - 60), y: horizon - 14 - Math.sin(f * Math.PI) * (horizon - 40), f } : null;
      };
      const sun = arc(420, 1260, ph.min);
      if (sun && !grey) {
        const low = 1 - Math.sin(sun.f * Math.PI);
        c.globalAlpha = 0.35;
        oval(c, sun.x, sun.y, 16, 16, '#fff6c8');
        c.globalAlpha = 1;
        oval(c, sun.x, sun.y, 10, 10, mixHex('#fff2a8', '#ff9a5a', Math.min(1, low * 1.3)));
      }
      const moon = arc(1200, 420, ph.min);
      if (moon && ph.dark > 0.3) {
        c.globalAlpha = Math.min(1, (ph.dark - 0.3) / 0.4);
        oval(c, moon.x, moon.y, 9, 9, '#f6f0c8');
        oval(c, moon.x + 4, moon.y - 3, 8, 8, colors[0]);
        c.globalAlpha = 1;
      }
      // Nubes que pasan despacio (más y más grises si está nublado).
      const clouds = grey ? 8 : 4;
      for (let i = 0; i < clouds; i += 1) {
        const cx = ((t / (900 + i * 300)) * 8 + i * 140) % (W + 80) - 40;
        const cy = 14 + ((i * 37) % 60);
        const tint = mixHex(grey ? '#b9c3cc' : '#ffffff', grey ? '#3a4466' : '#2c3a66', ph.dark);
        c.globalAlpha = grey ? 0.95 : 0.85;
        oval(c, cx, cy, 14, 4, tint);
        oval(c, cx + 8, cy - 3, 9, 4, tint);
        oval(c, cx - 7, cy - 2, 7, 3, tint);
        c.globalAlpha = 1;
      }
    }
    // Lluvia o nieve (el tiempo de verdad de Turín, que la app ya tiene).
    function drawWeather(t) {
      const code = state.weather.code;
      if (scene.indoor || !(isRain(code) || isSnow(code))) return;
      const snow = isSnow(code);
      c.globalAlpha = snow ? 0.9 : 0.55;
      for (let i = 0; i < (snow ? 70 : 110); i += 1) {
        const speed = snow ? 0.02 : 0.25;
        const x = ((i * 53) + (snow ? Math.sin(t / 700 + i) * 6 : -t * speed * 0.3)) % W;
        const y = ((i * 89) + t * speed) % H;
        if (snow) R(c, (x + W) % W, y, 1, 1, '#ffffff');
        else R(c, (x + W) % W, y, 1, 4, '#c8dcf0');
      }
      c.globalAlpha = 1;
    }

    function updateCamera() {
      const cam = state.cam;
      const z = state.zoom ? 2 : 1;
      cam.z += (z - cam.z) * 0.15;
      if (Math.abs(cam.z - z) < 0.01) cam.z = z;
      const vw = state.view.w / cam.z;
      const vh = state.view.h / cam.z;
      let tx = 0;
      let ty = 0;
      if (state.pan) {
        // Arrastrando el dedo para mirar por la casa: manda el dedo hasta que vuelves a andar.
        tx = state.pan.x;
        ty = state.pan.y;
      } else if (state.follow && (cam.z > 1.01 || vw < W - 1 || vh < H - 1)) {
        tx = state.follow.x - vw / 2;
        ty = state.follow.y - 24 - vh / 2;
      }
      tx = Math.max(0, Math.min(W - vw, tx));
      ty = Math.max(0, Math.min(H - vh, ty));
      cam.x += (tx - cam.x) * (state.pan ? 0.5 : 0.12);
      cam.y += (ty - cam.y) * (state.pan ? 0.5 : 0.12);
      cam.x = Math.max(0, Math.min(W - vw, cam.x));
      cam.y = Math.max(0, Math.min(H - vh, cam.y));
    }

    function drawLighting(t) {
      const ph = state.phase || dayPhase();
      const theme = scene.id === 'house' ? themeNow() : 'none';
      const ambient = ph.amb;
      const busy = state.props.tv || state.props.games || state.bedMode === 'woohoo';
      if (ph.dark < 0.02 && !busy) return;
      lc.globalCompositeOperation = 'source-over';
      lc.fillStyle = ambient;
      lc.fillRect(0, 0, W, H);
      lc.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, color, strength = 1) => {
        const grad = lc.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        lc.globalAlpha = strength;
        lc.fillStyle = grad;
        lc.fillRect(x - r, y - r, r * 2, r * 2);
        lc.globalAlpha = 1;
      };
      if (state.lamps) {
        (scene.lights || []).forEach(([x, y, r]) => glow(x, y, r, 'rgba(255,214,150,.9)', 0.35 + ph.dark * 0.45));
        if (scene.id === 'house') {
          glow(55, 42, 30, 'rgba(255,200,120,.9)');
          glow(154, 42, 30, 'rgba(255,200,120,.9)');
          glow(19, 204, 46, 'rgba(255,210,140,.9)');
          glow(237, 330, 26, 'rgba(255,220,140,.8)');
        }
      }
      if (scene.id === 'house' && (state.props.tv || state.props.games)) {
        const flicker = 0.55 + Math.sin(t / 90) * 0.1 + Math.sin(t / 37) * 0.05;
        glow(90, 300, 70, `rgba(150,190,255,${flicker})`);
      }
      if (state.props.laptop) glow(262, 330, 24, 'rgba(170,210,255,.7)');
      // Luces de la temática: el árbol de Navidad o las calabazas encendidas.
      if (theme === 'xmas') glow(26, 340, 40, `rgba(255,220,150,${0.6 + Math.sin(t / 300) * 0.1})`);
      if (theme === 'halloween') { glow(26, 356, 30, 'rgba(255,150,60,.85)'); glow(392, 120, 16, 'rgba(255,170,60,.7)'); }
      if (theme === 'xmas') glow(392, 112, 14, 'rgba(255,190,110,.7)');
      if (state.bedMode === 'woohoo') glow(102, 100, 60, 'rgba(255,140,180,.9)');
      if (state.props.fridge) glow(358, 70, 34, 'rgba(255,250,200,.9)');
      if (state.props.stove) glow(394, 40, 20, 'rgba(255,140,80,.8)');
      c.globalCompositeOperation = 'multiply';
      c.drawImage(light, 0, 0);
      c.globalCompositeOperation = 'source-over';
    }

    // Rayos de sol que entran por las ventanas durante el día.
    function drawSunbeams() {
      const ph = state.phase || dayPhase();
      if (ph.dark > 0.6 || !scene.indoor || isCloudy(state.weather.code)) return;
      c.globalAlpha = (0.06 + ph.warm * 0.03) * (1 - ph.dark / 0.6);
      c.fillStyle = mixHex('#fff6c8', '#ffb070', ph.warm);
      [[16, 40, 26, 70], [474, 42, 26, 60], [340, 222, 36, 70]].forEach(([x, y, w, h]) => {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + w, y);
        c.lineTo(x + w + h * 0.5, y + h);
        c.lineTo(x + h * 0.5, y + h);
        c.closePath();
        c.fill();
      });
      c.globalAlpha = 1;
    }

    // Motas de polvo que flotan en los rayos de sol.
    function drawDust(t) {
      if (state.time !== 'day' || !scene.indoor || isCloudy(state.weather.code)) return;
      [[16, 40, 26, 70], [474, 42, 26, 60], [340, 222, 36, 70]].forEach(([x, y, w, h], beam) => {
        for (let i = 0; i < 6; i += 1) {
          const phase = (t / (9000 + i * 1300) + i / 6 + beam / 3) % 1;
          const px = x + ((i * 11) % w) + phase * h * 0.5 + Math.sin(t / 1200 + i) * 2;
          const py = y + phase * h;
          c.globalAlpha = Math.sin(phase * Math.PI) * 0.55;
          R(c, px, py, 1, 1, '#fff8d8');
        }
      });
      c.globalAlpha = 1;
    }

    // Agujas del reloj del salón con la hora de verdad.
    function drawClock() {
      const now = new Date();
      const minute = (now.getMinutes() / 60) * Math.PI * 2;
      const hour = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
      line(c, 220, 200, 220 + Math.sin(hour) * 3, 200 - Math.cos(hour) * 3, OL);
      line(c, 220, 200, 220 + Math.sin(minute) * 4.5, 200 - Math.cos(minute) * 4.5, '#5a4a44');
      R(c, 220, 200, 1, 1, '#c0503e');
    }

    // Cosas que vuelan (cojines en la guerra de almohadas).
    function drawProjectiles(t) {
      state.projectiles = state.projectiles.filter((p) => {
        const k = (t - p.t0) / p.dur;
        if (k >= 1) {
          if (p.kind === 'ball') return false;
          for (let i = 0; i < 8; i += 1) state.particles.push({ type: 'feather', x: p.x1 + (Math.random() - 0.5) * 8, y: p.y1 + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, life: 1 + Math.random() });
          return false;
        }
        const x = p.x0 + (p.x1 - p.x0) * k;
        const y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 16;
        shadow(c, x, p.y0 + 30 + (p.y1 - p.y0) * k, 4, 1, 0.2);
        if (p.kind === 'ball') {
          ovalBox(c, x, y, 2, 2, '#e8e04a');
          return true;
        }
        R(c, x - 5, y - 4, 10, 8, OL);
        R(c, x - 4, y - 3, 8, 6, '#c9714a');
        R(c, x - 3, y - 2, 6, 1, '#e08e66');
        return true;
      });
    }

    // Brillo rosado en los momentos románticos.
    function drawRomance() {
      if (state.romance <= 0.01) return;
      const grad = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8);
      grad.addColorStop(0, 'rgba(255,120,170,0)');
      grad.addColorStop(1, `rgba(255,120,170,${0.35 * state.romance})`);
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }

    function drawBrackets(rect, t) {
      if (!rect) return;
      const [x, y, w, h] = rect;
      const pulse = Math.round(Math.sin(t / 180) * 1);
      const color = '#ffffff';
      const len = 5;
      [[x - pulse, y - pulse, 1, 1], [x + w + pulse, y - pulse, -1, 1], [x - pulse, y + h + pulse, 1, -1], [x + w + pulse, y + h + pulse, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        R(c, sx > 0 ? cx - 1 : cx - len, sy > 0 ? cy - 1 : cy, len + 1, 2, OL);
        R(c, sx > 0 ? cx - 1 : cx - len, sy > 0 ? cy - 1 : cy - 1, 1 + len, 1, color);
        R(c, sx > 0 ? cx - 1 : cx - 1, sy > 0 ? cy - 1 : cy - len, 1, len + 1, color);
      });
    }

    function drawMarker(t) {
      const m = state.marker;
      if (!m) return;
      const age = (t - m.t0) / 900;
      if (age > 1) { state.marker = null; return; }
      const r = 3 + age * 6;
      c.globalAlpha = 1 - age;
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        R(c, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r * 0.45, 1, 1, '#3fd46a');
      }
      R(c, m.x - 1, m.y - 1, 3, 2, '#3fd46a');
      c.globalAlpha = 1;
    }

    function stepParticles(dt) {
      state.particles = state.particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        return p.life > 0;
      });
    }
    function drawParticles() {
      state.particles.forEach((p) => {
        c.globalAlpha = Math.min(1, p.life / 0.5);
        pixels(c, SHAPES[p.type].map(([x, y, w, h]) => [p.x + x, p.y + y, w, h]), p.color || PARTICLE_COLORS[p.type]);
        if (p.type === 'z' || p.type === 'note') {
          c.globalAlpha *= 0.6;
          pixels(c, SHAPES[p.type].map(([x, y, w, h]) => [p.x + x + 1, p.y + y + 1, w, h]), OL);
        }
      });
      c.globalAlpha = 1;
    }

    function render(t, dt) {
      if (!state.phaseAt || t - state.phaseAt > 2000) { state.phase = dayPhase(); state.phaseAt = t; }
      updateCamera();
      stepParticles(dt);
      const cam = state.cam;
      const k = scale * cam.z;
      c.setTransform(k, 0, 0, k, -Math.round(cam.x * k), -Math.round(cam.y * k));
      c.imageSmoothingEnabled = false;
      if (!scene.indoor) drawSky(t);
      c.drawImage(background, 0, 0);
      if (scene.indoor) {
        const ph = state.phase;
        const sky = Object.assign([ph.top, ph.bottom], { night: ph.dark > 0.7, dusk: ph.dark > 0.25 && ph.dark <= 0.7, rain: isRain(state.weather.code), snow: isSnow(state.weather.code) });
        WINDOWS.forEach((win) => windowAt(c, win, sky, t));
        drawClock();
      }
      scene.drawBack?.(c, state, t);
      c.drawImage(staticLayer, 0, 0);
      if (scene.id === 'house') drawThemeWall(c, t);
      drawSunbeams();
      // Muebles y muñecos ordenados por profundidad.
      const drawables = scene.objects.filter((object) => object.draw && object.layer !== 'static').map((object) => ({ y: object.sort, draw: () => object.draw(c, state, t) }));
      state.actors.forEach((a) => drawables.push({ y: a.sortY ?? a.y, draw: () => drawActor(c, a, t) }));
      drawables.sort((a, b) => a.y - b.y).forEach((item) => item.draw());
      scene.drawFront?.(c, state, t);
      drawWeather(t);
      drawProjectiles(t);
      drawParticles();
      drawDust(t);
      drawLighting(t);
      drawRomance();
      state.actors.forEach((a) => drawMoodFx(c, a, t));
      drawMarker(t);
      drawBrackets(state.selected || state.hover, t);
      state.actors.forEach((a) => drawPlumbob(c, a, t));
      // Emoji del estado de ánimo junto a la cabeza.
      c.font = '9px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      c.textAlign = 'center';
      state.actors.forEach((a) => { if (a.mood && !a.hidden) c.fillText(a.mood, a.x + 13, a.headY - 2); });
    }

    // Pantalla ⇄ mundo, para tocar cosas y colocar bocadillos.
    function toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const cam = state.cam;
      return { x: cam.x + ((clientX - rect.left) / rect.width) * (state.view.w / cam.z), y: cam.y + ((clientY - rect.top) / rect.height) * (state.view.h / cam.z) };
    }
    function toScreen(x, y) {
      const rect = canvas.getBoundingClientRect();
      const cam = state.cam;
      return { x: ((x - cam.x) * cam.z * rect.width) / state.view.w, y: ((y - cam.y) * cam.z * rect.height) / state.view.h, width: rect.width, height: rect.height };
    }
    function objectAt(x, y) {
      return scene.objects.filter((object) => object.hit && inRect(x, y, object.hit)).sort((a, b) => b.sort - a.sort)[0]?.id || null;
    }
    function actorAt(x, y) {
      return state.actors
        .filter((a) => !a.hidden && (a.kind === 'dog' ? x > a.x - 14 && x < a.x + 14 && y > a.y - 22 && y < a.y + 2 : true) && x > a.x - 11 && x < a.x + 11 && y > a.headY - 2 && y < a.y + 2)
        .sort((a, b) => b.y - a.y)[0] || null;
    }
    function emit(type, x, y, { count = 1, spread = 6, vy = -18, color } = {}) {
      for (let i = 0; i < count; i += 1) {
        state.particles.push({ type, x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.5, vx: (Math.random() - 0.5) * 10, vy: vy * (0.7 + Math.random() * 0.6), life: 1.2 + Math.random() * 0.8, color });
      }
    }

    return {
      state,
      canvas,
      overlay,
      render,
      toWorld,
      toScreen,
      objectAt,
      actorAt,
      emit,
      hitRect: (id) => scene.objects.find((object) => object.id === id)?.hit || null,
      setScene,
      scene: () => scene,
      setPhotos,
      throwItem: (from, to, dur = 600, kind = 'pillow') => state.projectiles.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, t0: performance.now(), dur, kind }),
      resize,
      // Mirar por la casa arrastrando: desplaza la cámara en píxeles de pantalla.
      panBy(dx, dy) {
        const rect = canvas.getBoundingClientRect();
        const cam = state.cam;
        const k = rect.width ? state.view.w / cam.z / rect.width : 1;
        const from = state.pan || { x: cam.x, y: cam.y };
        state.pan = { x: Math.max(0, Math.min(W - state.view.w / cam.z, from.x - dx * k)), y: Math.max(0, Math.min(H - state.view.h / cam.z, from.y - dy * k)) };
      },
      endPan: () => { state.pan = null; },
      // Cambiar la decoración: se vuelve a pintar el piso con los colores nuevos.
      setDecor(next) {
        setDecorValues(next);
        if (scene.id === 'house') { background = scene.bake(); bakeStatic(); }
        return { ...decor };
      },
      destroy: () => observer?.disconnect()
    };
  }

  window.simsWorld = {
    W, H, ANIMS, OL, loadSprites, loadSheet, createWorld, findPath, nearestFree, free, lineFree, registerScene, PLANT_SLOTS,
    portrait, DECOR, DEFAULT_DECOR, getDecor: () => ({ ...decor }), setDecorValues, seasonalTheme, themeNow, dayPhase, mixHex,
    // Para el jardín de la pantalla de inicio (garden.js): mismos muñecos, perros y diamante.
    drawActor, drawPlumbob, drawMoodFx,
    // Pinceles para dibujar los sitios de fuera (sims-places.js).
    paint: { R, box, oval, ovalBox, shadow, pixels, tone, line, pixelText, textWidth, planks, checker, rug, shifted, clipRect }
  };
})();
