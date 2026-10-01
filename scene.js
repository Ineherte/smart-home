// Escena viva de la casa. Refleja:
// - la hora real (amanecer, día, atardecer, noche) a partir de la salida y puesta de sol,
// - el tiempo de Turín (nubes, lluvia, nieve, niebla, tormenta, viento),
// - la estación del año y la fase real de la luna,
// - el estado de la casa: luces encendidas por habitación, facturas pendientes
//   (bandera del buzón) y notas urgentes (pósit en la puerta),
// - y a Ines y Matteo, que van cambiando de plan según la hora y el tiempo,
//   vestidos según la temperatura (ver PEOPLE, WARDROBE y eligibleActs).
// Uso: umbralScene.mount(elemento) y umbralScene.update({ ...datos parciales }).
(function () {
  'use strict';

  const HORIZON = 150;

  // Aleatorio con semilla: la escena se genera igual en cada carga.
  function seeded(seed) {
    let value = seed;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  const toRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const toHex = (rgb) => `#${rgb.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;
  const mix = (from, to, amount) => {
    const a = toRgb(from);
    const b = toRgb(to);
    return toHex(a.map((value, index) => value + (b[index] - value) * amount));
  };
  const desaturate = (hex, amount) => {
    const [r, g, b] = toRgb(hex);
    const luminance = 0.3 * r + 0.59 * g + 0.11 * b;
    return toHex([r, g, b].map((value) => value + (luminance - value) * amount));
  };
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  // Paletas del paisaje en cada momento del día; entre momentos se interpolan.
  const SKY = {
    night: { skyTop: '#0b1628', skyMid: '#162a4c', skyBottom: '#2b416b', alps: '#24345a', snowcap: '#7488ad', city: '#1c2944', hillFar: '#1f3638', hillNear: '#1b3029', ground: '#213b30' },
    dawn: { skyTop: '#6c86c6', skyMid: '#caa7c9', skyBottom: '#ffcaa2', alps: '#9d90b5', snowcap: '#ffe2d5', city: '#8b7ea3', hillFar: '#90a994', hillNear: '#7f9e7d', ground: '#98b68b' },
    day: { skyTop: '#68b4e6', skyMid: '#a8d5ef', skyBottom: '#e5f3f3', alps: '#9eb7c9', snowcap: '#f7fbfd', city: '#94a8b8', hillFar: '#aad0a0', hillNear: '#90c189', ground: '#a9d495' },
    dusk: { skyTop: '#3a4a8e', skyMid: '#b56d8d', skyBottom: '#ffa46c', alps: '#6d5b88', snowcap: '#f8b99f', city: '#5e5079', hillFar: '#7b7e6f', hillNear: '#67745f', ground: '#7e9271' }
  };
  const NIGHTNESS = { night: 1, dawn: 0.45, day: 0, dusk: 0.4 };
  const WARMTH = { night: 0, dawn: 0.7, day: 0, dusk: 1 };

  const CONDITIONS = {
    clear: { grey: 0, darken: 0, sky: 1, clouds: 1, cloud: '#ffffff', label: 'despejado' },
    partly: { grey: 0.12, darken: 0, sky: 0.9, clouds: 3, cloud: '#ffffff', label: 'con algunas nubes' },
    cloudy: { grey: 0.55, darken: 0.05, sky: 0.3, clouds: 6, cloud: '#e6ebee', label: 'nublado' },
    fog: { grey: 0.7, darken: 0, sky: 0.15, clouds: 2, cloud: '#eef1f0', label: 'con niebla' },
    drizzle: { grey: 0.5, darken: 0.08, sky: 0.15, clouds: 5, cloud: '#d6dde2', label: 'con llovizna' },
    rain: { grey: 0.65, darken: 0.18, sky: 0, clouds: 7, cloud: '#b6c1c9', label: 'lluvioso' },
    storm: { grey: 0.8, darken: 0.32, sky: 0, clouds: 7, cloud: '#8d98a3', label: 'con tormenta' },
    snow: { grey: 0.5, darken: 0.02, sky: 0.1, clouds: 6, cloud: '#eef2f5', label: 'nevado' }
  };

  const OBJECTS = { wall: '#f4e8d4', roof: '#c96b4b', eave: '#a8533a', chimney: '#8d5b45', door: '#1f5a48', trim: '#fffaf0', trunk: '#76563b', bush: '#5d9a5f', bushB: '#4c8a52', path: '#eadcc0', fence: '#f1e7d6', mailbox: '#3c6e8f', curtain: '#e8d3b3' };
  const SEASONS = {
    spring: { canopy: '#7cc062', canopyB: '#9bd07a', accent: '#f6b9ca', label: 'primavera' },
    summer: { canopy: '#4e9658', canopyB: '#63a966', accent: '#63a966', label: 'verano' },
    autumn: { canopy: '#dc8a38', canopyB: '#c55f2d', accent: '#e8b44b', label: 'otoño' },
    winter: { canopy: '#76563b', canopyB: '#76563b', accent: '#76563b', label: 'invierno' }
  };

  // Habitaciones con ventana; una luz de una habitación sin ventana ilumina el salón.
  const WINDOW_ROOMS = ['salon', 'cocina', 'dormitorio', 'bano', 'estudio'];
  const normalizeRoom = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  function conditionFor(code) {
    if ([95, 96, 99].includes(code)) return 'storm';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([45, 48].includes(code)) return 'fog';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
    if (code === 3) return 'cloudy';
    if (code === 2) return 'partly';
    return 'clear';
  }

  function seasonFor(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  // 0 luna nueva · 0,5 luna llena · 1 luna nueva otra vez.
  function moonPhase(date) {
    const synodicMonth = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const days = (date.getTime() - knownNewMoon) / 86400000;
    return (((days % synodicMonth) + synodicMonth) % synodicMonth) / synodicMonth;
  }

  const minutesOf = (date) => date.getHours() * 60 + date.getMinutes();

  function timeline(now, sunrise, sunset) {
    const time = minutesOf(now);
    const rise = minutesOf(sunrise);
    const set = minutesOf(sunset);
    const stops = [[rise - 80, 'night'], [rise - 10, 'dawn'], [rise + 70, 'day'], [set - 80, 'day'], [set + 5, 'dusk'], [set + 75, 'night']];
    for (let index = 0; index < stops.length - 1; index += 1) {
      const [start, from] = stops[index];
      const [end, to] = stops[index + 1];
      if (time >= start && time <= end) return { from, to, amount: end === start ? 0 : (time - start) / (end - start) };
    }
    return { from: 'night', to: 'night', amount: 0 };
  }

  // Posición en un arco de izquierda a derecha; progress 0..1.
  function arc(progress) {
    return { x: 30 + progress * 340, y: HORIZON - 12 - Math.sin(progress * Math.PI) * 98 };
  }

  const CLOUD_SHAPES = [
    'M0 22 a12 12 0 0 1 10 -13 a17 17 0 0 1 31 -3 a12 12 0 0 1 17 9 a9 9 0 0 1 -1 18 h-50 a8 8 0 0 1 -7 -11z',
    'M0 18 a9 9 0 0 1 9 -10 a13 13 0 0 1 24 -2 a9 9 0 0 1 12 8 a7 7 0 0 1 -1 14 h-38 a7 7 0 0 1 -6 -10z'
  ];

  function windowMarkup(room, x, y, width, height, inside = '') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    return `<g class="sc-window" data-room="${room}">
      <rect class="sc-window-glass" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"></rect>
      ${inside}
      <path class="sc-curtain" d="M${x} ${y} h${width * 0.28} q${-width * 0.12} ${height * 0.5} 0 ${height} h${-width * 0.28}z M${x + width} ${y} h${-width * 0.28} q${width * 0.12} ${height * 0.5} 0 ${height} h${width * 0.28}z"></path>
      <path class="sc-window-bars" d="M${cx} ${y} V${y + height} M${x} ${cy} H${x + width}"></path>
      <rect class="sc-window-frame" x="${x}" y="${y}" width="${width}" height="${height}" rx="2"></rect>
      <rect class="sc-trim" x="${x - 2}" y="${y + height}" width="${width + 4}" height="3" rx="1"></rect>
    </g>`;
  }

  // ---------- Ines y Matteo ----------
  // Ines: pelo castaño oscuro, ojos marrones. Matteo: castaño claro, ojos claros y más alto.
  const PEOPLE = {
    ines: { name: 'Ines', scale: 1, skin: '#dca07a', hair: '#2b1a12', eyes: '#5a3420' },
    matteo: { name: 'Matteo', scale: 1.14, skin: '#f0c7a3', hair: '#9b6b3f', eyes: '#4f97b8' }
  };

  // Ropa según la temperatura. sleeve/shin 'skin' = manga corta / pantalón corto.
  const WARDROBE = {
    hot: {
      ines: { top: '#f28b74', sleeve: 'skin', pants: '#86a9d4', shin: 'skin', shoe: '#f6f0e6' },
      matteo: { top: '#f5f1e6', sleeve: 'skin', pants: '#7f9a6f', shin: 'skin', shoe: '#3d4a5c' }
    },
    warm: {
      ines: { top: '#f28b74', sleeve: 'skin', pants: '#46679a', shoe: '#f6f0e6' },
      matteo: { top: '#f5f1e6', sleeve: 'skin', pants: '#4b5d78', shoe: '#3d4a5c' }
    },
    mild: {
      ines: { top: '#c9674a', pants: '#3f5c8a', shoe: '#6a4a3a' },
      matteo: { top: '#4c79a8', pants: '#6b5a48', shoe: '#3d4a5c' }
    },
    cold: {
      ines: { top: '#b8834f', coat: '#b8834f', scarf: '#c8423b', hat: '#a33d5b', pants: '#2f3a4f', shoe: '#5a3e30' },
      matteo: { top: '#34466b', coat: '#34466b', scarf: '#e0a83e', hat: '#707a86', pants: '#2f2f36', shoe: '#2f2f36' }
    },
    rain: {
      ines: { top: '#f2c230', coat: '#f2c230', boot: '#e05a4f', pants: '#3f5c8a', shoe: '#e05a4f' },
      matteo: { top: '#3f8f6b', coat: '#3f8f6b', boot: '#2e3b4e', pants: '#4b5d78', shoe: '#2e3b4e' }
    }
  };

  // Planes posibles. place: 'out' en el jardín, 'in' dentro de casa (room se enciende).
  const ACTS = {
    wave: { place: 'out', label: 'saludan desde el jardín' },
    hug: { place: 'out', label: 'se abrazan en el jardín' },
    dance: { place: 'out', label: 'bailan en el jardín' },
    leaves: { place: 'out', label: 'juegan con las hojas' },
    puddles: { place: 'out', label: 'saltan en los charcos' },
    umbrella: { place: 'out', label: 'pasean bajo el paraguas' },
    snowball: { place: 'out', label: 'juegan con la nieve' },
    stargaze: { place: 'out', label: 'miran las estrellas' },
    movie: { place: 'in', room: 'salon', label: 'ven una película en el salón' },
    cook: { place: 'in', room: 'cocina', label: 'cocinan juntos' },
    sleep: { place: 'in', label: 'duermen' }
  };

  // Lista con pesos (repetir = más probable) de lo que tiene sentido ahora.
  function eligibleActs({ condition, nightness, temperature, minutes, season }) {
    if (minutes >= 30 && minutes < 7 * 60) return ['sleep'];
    const mealtime = (minutes >= 12 * 60 + 30 && minutes <= 14 * 60 + 30) || (minutes >= 19 * 60 + 30 && minutes <= 21 * 60 + 30);
    const indoor = ['movie', 'movie', ...(mealtime ? ['cook', 'cook'] : [])];
    const wet = ['drizzle', 'rain'].includes(condition);
    if (condition === 'storm') return indoor;
    if (nightness > 0.55) {
      const niceNight = ['clear', 'partly'].includes(condition) && temperature >= 12 && minutes < 23 * 60 + 30;
      return niceNight ? ['stargaze', 'stargaze', ...indoor] : indoor;
    }
    if (wet) return ['puddles', 'puddles', 'umbrella', ...(mealtime ? ['cook'] : [])];
    if (condition === 'snow') return ['snowball', 'snowball', 'wave', 'hug'];
    const sunny = ['clear', 'partly'].includes(condition);
    const out = [...(sunny ? ['wave', 'wave'] : ['wave']), 'hug', 'dance'];
    if (season === 'autumn') out.push('leaves', 'leaves');
    if (mealtime) out.push('cook');
    if (temperature < 2) out.push('movie', 'movie');
    return out;
  }

  function outfitFor({ condition, temperature, place }) {
    if (place === 'out' && ['drizzle', 'rain', 'storm'].includes(condition)) return 'rain';
    if (condition === 'snow' || temperature < 9) return 'cold';
    if (temperature < 17) return 'mild';
    if (temperature < 25) return 'warm';
    return 'hot';
  }

  const armMarkup = (side, x, y) => `<g transform="translate(${x} ${y})"><g class="ch-arm ch-arm-${side}">
      <path class="ch-sleeve" d="M0 0 V8"></path><path class="ch-cuff" d="M0 0 V2.6"></path><circle class="ch-hand" cx="0" cy="9" r="1.3"></circle>
    </g></g>`;

  const HAIR_FRONT = {
    ines: 'M-5.3 -26.4 q-.6 -7.4 5.3 -7.4 q5.9 0 5.3 7.4 q-1.4 -3.9 -4.4 -4.7 q-2.6 2.9 -6.2 4.7 z',
    matteo: 'M-5.1 -27.4 q-.4 -6.4 5.1 -6.4 q5.7 0 5.2 6.2 q-1.6 -2.6 -4 -2.8 q-.7 1.3 -2.5 1.5 q-.4 -1.1 -1.4 -1.3 q-1.4 1.7 -2.4 2.8 z'
  };

  function personMarkup(key) {
    const person = PEOPLE[key];
    const splash = [[-6, -2, -5, -5], [-3, -1, -2, -7], [3, -1, 2, -7], [6, -2, 5, -5]]
      .map(([x, y, dx, dy]) => `<circle cx="${x}" cy="${y}" r=".8" style="--dx:${dx}px;--dy:${dy}px"></circle>`).join('');
    return `<g class="ch-pos ch-${key}"><g class="ch-person"><g transform="scale(${person.scale})">
      <ellipse class="ch-shadow" cx="0" cy="0" rx="6.5" ry="1.4"></ellipse>
      <g class="ch-splash">${splash}</g>
      <g class="ch-body">
        ${key === 'ines' ? '<path class="ch-hair" d="M-5.3 -27 q-.2 -6.8 5.3 -6.8 q5.5 0 5.3 6.8 l.7 9.4 q-6 2.2 -12 0 z"></path>' : ''}
        <rect class="ch-thigh" x="-3.5" y="-12.5" width="3" height="6.5" rx=".8"></rect><rect class="ch-thigh" x=".5" y="-12.5" width="3" height="6.5" rx=".8"></rect>
        <rect class="ch-shin" x="-3.3" y="-6.6" width="2.6" height="5.4"></rect><rect class="ch-shin" x=".7" y="-6.6" width="2.6" height="5.4"></rect>
        <rect class="ch-shoe" x="-4.1" y="-1.9" width="3.7" height="1.9" rx=".9"></rect><rect class="ch-shoe" x=".4" y="-1.9" width="3.7" height="1.9" rx=".9"></rect>
        <rect class="ch-boot" x="-3.9" y="-4.6" width="3.5" height="4.6" rx=".9"></rect><rect class="ch-boot" x=".4" y="-4.6" width="3.5" height="4.6" rx=".9"></rect>
        <path class="ch-torso" d="M-4.4 -11.6 v-8.4 q0 -2.2 2.2 -2.2 h4.4 q2.2 0 2.2 2.2 v8.4 z"></path>
        <path class="ch-coat" d="M-4.9 -8.6 v-11.4 q0 -2.4 2.4 -2.4 h5 q2.4 0 2.4 2.4 v11.4 z"></path>
        <path class="ch-coat-line" d="M0 -21.6 V-8.8"></path>
        <rect class="ch-neck" x="-1" y="-23.6" width="2" height="2"></rect>
        <g class="ch-scarf"><rect x="-3.4" y="-23.2" width="6.8" height="2.4" rx="1.1"></rect><rect x="1" y="-21.6" width="2" height="5" rx=".8"></rect></g>
        ${armMarkup('l', -4.2, -20.4)}
        ${armMarkup('r', 4.2, -20.4)}
        <g class="ch-head">
          <circle class="ch-face" cx="0" cy="-27" r="4.8"></circle>
          <g class="ch-eyes"><circle cx="-1.7" cy="-26.6" r=".9"></circle><circle cx="1.7" cy="-26.6" r=".9"></circle></g>
          <g class="ch-glints"><circle cx="-1.4" cy="-26.95" r=".3"></circle><circle cx="2" cy="-26.95" r=".3"></circle></g>
          <circle class="ch-cheek" cx="-3" cy="-25" r=".9"></circle><circle class="ch-cheek" cx="3" cy="-25" r=".9"></circle>
          <path class="ch-mouth" d="M-1.1 -24.5 q1.1 1 2.2 0"></path>
          <path class="ch-hair" d="${HAIR_FRONT[key]}"></path>
          <g class="ch-shades"><rect x="-3.2" y="-27.7" width="2.9" height="2" rx=".7"></rect><rect x=".3" y="-27.7" width="2.9" height="2" rx=".7"></rect><rect x="-.4" y="-27.1" width=".8" height=".45"></rect></g>
          <g class="ch-hat"><path d="M-5 -28.8 q0 -6 5 -6 q5 0 5 6 z"></path><rect x="-5.4" y="-29.6" width="10.8" height="2.1" rx="1"></rect><circle cx="0" cy="-35" r="1.4"></circle></g>
          <path class="ch-hood" d="M-6 -24.6 q-.7 -9.6 6 -9.6 q6.7 0 6 9.6 q-.9 -4.9 -6 -5.2 q-5.1 .3 -6 5.2 z"></path>
        </g>
        ${key === 'matteo' ? `<g class="ch-umbrella">
          <path class="ch-umbrella-stick" d="M-6.6 -29.2 L-8.6 -49"></path>
          <path class="ch-umbrella-top" d="M-28 -46 q19.4 -17 38.8 0 q-3.23 -2.6 -6.47 0 q-3.23 -2.6 -6.47 0 q-3.23 -2.6 -6.47 0 q-3.23 -2.6 -6.47 0 q-3.23 -2.6 -6.47 0 q-3.23 -2.6 -6.45 0 z"></path>
          <circle class="ch-umbrella-tip" cx="-8.6" cy="-58.6" r=".9"></circle>
        </g>` : ''}
      </g>
      <rect class="ch-hit" x="-9" y="-38" width="18" height="40"></rect>
    </g></g></g>`;
  }

  const HEART = 'M0 0 c-1.7 -1.7 -4.2 -.4 -3.1 1.7 l3.1 3.1 l3.1 -3.1 c1.1 -2.1 -1.4 -3.4 -3.1 -1.7 z';

  function coupleMarkup() {
    const hearts = [[-4, 0], [3, -.6], [0, -.3], [-2, -.9], [4, .4]].map(([x, delay], index) => `<path class="sc-heart" d="${HEART}" style="--hx:${x}px;--delay:${(delay - index * 0.55).toFixed(2)}s"></path>`).join('');
    const notes = [0, 1, 2].map((index) => `<g class="sc-note" style="--delay:${(-index * 0.9).toFixed(1)}s;--nx:${[-14, 2, 16][index]}px"><path d="M1.4 -6.4 v6 M1.4 -6.4 l3 -1 v1.6 l-3 1"></path><circle cx=".2" cy="-.4" r="1.3"></circle></g>`).join('');
    const tossed = Array.from({ length: 7 }, (_, index) => `<path class="sc-toss" d="M0 0 q2.6 -3 5.6 0 q-2.6 3 -5.6 0z" style="--tx:${[-16, -9, -3, 3, 9, 15, 0][index]}px;--ty:${[-22, -30, -26, -32, -24, -20, -36][index]}px;--delay:${(-index * 0.3).toFixed(1)}s"></path>`).join('');
    return `<g class="sc-couple">
      <ellipse class="sc-big-puddle" cx="270" cy="189" rx="25" ry="3.4"></ellipse>
      <g class="sc-snowman" transform="translate(252 188)">
        <circle cx="0" cy="-5" r="5.6"></circle><circle cx="0" cy="-13.4" r="4"></circle><circle cx="0" cy="-19.6" r="3"></circle>
        <circle class="sc-snowman-eye" cx="-1" cy="-20.2" r=".45"></circle><circle class="sc-snowman-eye" cx="1.1" cy="-20.2" r=".45"></circle>
        <path class="sc-snowman-nose" d="M0 -19.4 l3.4 .6 l-3.4 .7 z"></path>
        <rect class="sc-snowman-scarf" x="-3.6" y="-17.2" width="7.2" height="1.6" rx=".8"></rect>
      </g>
      <path class="sc-leafpile" d="M197 189 q2 -6 7 -5.5 q3 -3 7 -.5 q4 -1.6 6 2 q3 1.4 2 4 z"></path>
      ${personMarkup('ines')}
      ${personMarkup('matteo')}
      <circle class="sc-snowball" r="1.5"></circle>
      <g class="sc-tossed" transform="translate(206 184)">${tossed}</g>
      <g class="sc-notes" transform="translate(209 154)">${notes}</g>
      <g class="sc-hearts" transform="translate(209 158)">${hearts}</g>
    </g>`;
  }

  // Caras pequeñas para verlos a través de las ventanas.
  function miniHead(key, cx, cy, r, from = 'front') {
    const fringe = `M${cx - r} ${cy - 0.2} A${r} ${r} 0 0 1 ${cx + r} ${cy - 0.2} Q${cx} ${cy - r * 0.62} ${cx - r} ${cy - 0.2} Z`;
    const backHair = key === 'ines' ? `<rect class="mi-hair" x="${cx - r - 0.4}" y="${cy - r - 0.2}" width="${2 * r + 0.8}" height="${r * 2.7}" rx="${r}"></rect>` : '';
    if (from === 'back') return `<g class="mi mi-${key}">${backHair}<circle class="mi-hair" cx="${cx}" cy="${cy}" r="${r}"></circle></g>`;
    return `<g class="mi mi-${key}">${backHair}<circle class="mi-face" cx="${cx}" cy="${cy}" r="${r}"></circle>
      <circle class="mi-eye" cx="${cx - r * 0.36}" cy="${cy + 0.2}" r=".55"></circle><circle class="mi-eye" cx="${cx + r * 0.36}" cy="${cy + 0.2}" r=".55"></circle>
      <path class="mi-hair" d="${fringe}"></path></g>`;
  }

  function movieMarkup() {
    return `<g class="sc-inside sc-inside-movie" clip-path="url(#sc-clip-salon)">
      <rect class="sc-tv" x="170" y="127.5" width="8" height="5" rx=".6"></rect>
      <g transform="rotate(16 169.8 145)">${miniHead('ines', 169.8, 139.8, 3.2, 'back')}</g>
      ${miniHead('matteo', 179.6, 139, 3.6, 'back')}
      <ellipse class="mi-top mi-top-ines" cx="170" cy="147.6" rx="4.4" ry="3"></ellipse>
      <ellipse class="mi-top mi-top-matteo" cx="179.6" cy="147.2" rx="5" ry="3.4"></ellipse>
      <rect class="sc-sofa" x="160" y="145.6" width="28" height="3" rx="1.2"></rect>
      <g class="sc-popcorn"><path d="M172.4 145.6 h4.6 l-.6 2.2 h-3.4 z"></path><circle cx="173.4" cy="145.2" r=".7"></circle><circle cx="174.8" cy="144.8" r=".7"></circle><circle cx="176" cy="145.3" r=".7"></circle></g>
      <rect class="sc-tv-light" x="160" y="124" width="28" height="24"></rect>
    </g>`;
  }

  function cookMarkup() {
    return `<g class="sc-inside sc-inside-cook" clip-path="url(#sc-clip-cocina)">
      <ellipse class="mi-top mi-top-ines" cx="235.4" cy="148.6" rx="4.2" ry="3.2"></ellipse>
      ${miniHead('ines', 235.4, 140.8, 3.2)}
      <ellipse class="mi-top mi-top-matteo" cx="249.4" cy="148" rx="4.8" ry="3.6"></ellipse>
      ${miniHead('matteo', 249.4, 139.4, 3.5)}
      <rect class="sc-counter" x="228" y="145.6" width="28" height="3"></rect>
      <rect class="sc-pot" x="240.4" y="141.8" width="6" height="3.8" rx=".8"></rect>
      <g class="sc-steam"><path d="M242 140.6 q-1 -1.6 0 -3.2 q1 -1.6 0 -3.2"></path><path d="M244.8 140.6 q1 -1.6 0 -3.2 q-1 -1.6 0 -3.2"></path></g>
    </g>`;
  }

  function buildMarkup() {
    const random = seeded(20260930);
    const stars = Array.from({ length: 38 }, () => `<circle class="sc-star" cx="${(random() * 400).toFixed(1)}" cy="${(random() * 95).toFixed(1)}" r="${(0.5 + random() * 1.1).toFixed(2)}" style="--delay:${(-random() * 4).toFixed(2)}s;--dur:${(2 + random() * 3).toFixed(2)}s"></circle>`).join('');
    const clouds = Array.from({ length: 7 }, (_, index) => `<g class="sc-cloud" style="--y:${(8 + random() * 58).toFixed(0)}px;--s:${(0.7 + random() * 0.7).toFixed(2)};--dur:${(70 + random() * 60).toFixed(0)}s;--delay:${(-random() * 120).toFixed(0)}s"><path d="${CLOUD_SHAPES[index % 2]}"></path></g>`).join('');
    const drops = Array.from({ length: 60 }, () => {
      const x = (random() * 440 - 20).toFixed(1);
      const y = (random() * 200).toFixed(1);
      return `<line class="sc-drop" x1="${x}" y1="${y}" x2="${(Number(x) - 2).toFixed(1)}" y2="${(Number(y) + 9).toFixed(1)}" style="--delay:${(-random() * 1.2).toFixed(2)}s;--dur:${(0.55 + random() * 0.35).toFixed(2)}s"></line>`;
    }).join('');
    const flakes = Array.from({ length: 46 }, () => `<circle class="sc-flake" cx="${(random() * 400).toFixed(1)}" cy="${(random() * 200).toFixed(1)}" r="${(1 + random() * 1.6).toFixed(2)}" style="--delay:${(-random() * 9).toFixed(2)}s;--dur:${(6 + random() * 5).toFixed(2)}s;--sway:${(random() * 16 - 8).toFixed(1)}px"></circle>`).join('');
    const leaves = Array.from({ length: 8 }, () => `<path class="sc-leaf" d="M0 0 q3 -3.5 7 0 q-3 3.5 -7 0z" style="--x:${(318 + random() * 28).toFixed(1)}px;--y:${(100 + random() * 20).toFixed(1)}px;--fall-x:${(random() * 50 - 34).toFixed(1)}px;--delay:${(-random() * 9).toFixed(2)}s;--dur:${(6 + random() * 4).toFixed(2)}s"></path>`).join('');
    const fireflies = Array.from({ length: 9 }, () => `<circle class="sc-firefly" cx="${(90 + random() * 290).toFixed(1)}" cy="${(128 + random() * 34).toFixed(1)}" r="1.3" style="--delay:${(-random() * 6).toFixed(2)}s;--dur:${(4 + random() * 4).toFixed(2)}s;--fx:${(random() * 14 - 7).toFixed(1)}px;--fy:${(random() * 10 - 6).toFixed(1)}px"></circle>`).join('');
    const blossoms = Array.from({ length: 14 }, () => `<circle class="sc-blossom" cx="${(310 + random() * 44).toFixed(1)}" cy="${(90 + random() * 34).toFixed(1)}" r="${(1.2 + random() * 1).toFixed(2)}"></circle>`).join('');

    return `<svg class="scene-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop class="sc-sky-top" offset="0"></stop>
          <stop class="sc-sky-mid" offset=".55"></stop>
          <stop class="sc-sky-bottom" offset="1"></stop>
        </linearGradient>
        <radialGradient id="sc-sun-glow">
          <stop class="sc-sun-stop" offset="0" stop-opacity=".55"></stop>
          <stop class="sc-sun-stop" offset="1" stop-opacity="0"></stop>
        </radialGradient>
        <radialGradient id="sc-spill-gradient">
          <stop offset="0" stop-color="#ffd27a" stop-opacity=".75"></stop>
          <stop offset="1" stop-color="#ffd27a" stop-opacity="0"></stop>
        </radialGradient>
        <radialGradient id="sc-moon-glow-gradient">
          <stop offset=".35" stop-color="#e3ebff" stop-opacity=".3"></stop>
          <stop offset="1" stop-color="#e3ebff" stop-opacity="0"></stop>
        </radialGradient>
        <linearGradient id="sc-shooting-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0"></stop>
          <stop offset="1" stop-color="#fff" stop-opacity=".95"></stop>
        </linearGradient>
        <filter id="sc-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4"></feGaussianBlur></filter>
        <filter id="sc-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
        <clipPath id="sc-clip-salon"><rect x="160" y="124" width="28" height="24" rx="2"></rect></clipPath>
        <clipPath id="sc-clip-cocina"><rect x="228" y="124" width="28" height="24" rx="2"></rect></clipPath>
        <mask id="sc-moon-mask"><circle r="10" fill="#fff"></circle><circle class="sc-moon-shadow" r="10.4" fill="#000"></circle></mask>
      </defs>

      <rect class="sc-sky" width="400" height="200" fill="url(#sc-sky)"></rect>
      <g class="sc-stars">${stars}</g>
      <line class="sc-shooting-star" x1="0" y1="0" x2="34" y2="12" stroke="url(#sc-shooting-gradient)"></line>
      <g class="sc-moon"><circle class="sc-moon-glow" r="24" fill="url(#sc-moon-glow-gradient)"></circle><circle class="sc-moon-dark" r="10"></circle><circle class="sc-moon-lit" r="10" mask="url(#sc-moon-mask)"></circle></g>
      <g class="sc-sun"><circle class="sc-sun-halo" r="34" fill="url(#sc-sun-glow)"></circle><circle class="sc-sun-core" r="11"></circle></g>

      <path class="sc-alps" d="M0 118 L22 104 L38 110 L62 86 L78 98 L96 80 L112 96 L134 90 L150 104 L170 96 L186 106 L210 100 L236 84 L252 68 L268 88 L290 94 L312 79 L330 92 L352 88 L372 100 L400 94 V150 H0 Z"></path>
      <path class="sc-snowcaps" d="M62 86 L70 92 L66 91 L62 95 L57 91 L54 92 Z M96 80 L104 89 L99 87 L95 91 L91 87 L88 88 Z M236 84 L241 88 L237 88 Z M252 68 L261 80 L256 78 L252 83 L248 78 L244 81 Z M312 79 L320 87 L315 86 L311 90 L307 86 L304 87 Z"></path>
      <g class="sc-city">
        <rect x="18" y="122" width="14" height="14"></rect><rect x="34" y="117" width="10" height="19"></rect><rect x="46" y="124" width="14" height="12"></rect>
        <path d="M63 136 V113 L65.5 111 L70 95 L74.5 111 L77 113 V136 Z M69.2 96 V81 H70.8 V96 Z"></path>
        <path class="sc-mole-spire" d="M70 81 V71"></path>
        <rect x="84" y="120" width="12" height="16"></rect><rect x="98" y="125" width="18" height="11"></rect><rect x="118" y="121" width="10" height="15"></rect>
      </g>
      <g class="sc-city-lights">
        <rect x="21" y="126" width="2" height="2"></rect><rect x="27" y="130" width="2" height="2"></rect><rect x="37" y="121" width="2" height="2"></rect><rect x="38" y="128" width="2" height="2"></rect>
        <rect x="50" y="128" width="2" height="2"></rect><rect x="69" y="118" width="2" height="2"></rect><rect x="69" y="126" width="2" height="2"></rect><rect x="88" y="124" width="2" height="2"></rect>
        <rect x="102" y="129" width="2" height="2"></rect><rect x="109" y="129" width="2" height="2"></rect><rect x="121" y="126" width="2" height="2"></rect>
      </g>
      <path class="sc-hill-far" d="M0 136 Q60 122 130 132 T260 128 T400 134 V170 H0 Z"></path>
      <path class="sc-hill-near" d="M0 148 Q90 136 190 146 T400 142 V175 H0 Z"></path>
      <g class="sc-clouds">${clouds}</g>

      <path class="sc-ground" d="M0 158 Q200 150 400 158 V200 H0 Z"></path>
      <path class="sc-ground-snow" d="M0 158 Q200 150 400 158 V200 H0 Z"></path>
      <path class="sc-path" d="M199 160 L217 160 L236 200 L178 200 Z"></path>
      <g class="sc-puddles">
        <ellipse cx="118" cy="178" rx="16" ry="2.6"></ellipse><ellipse cx="268" cy="186" rx="20" ry="3"></ellipse><ellipse cx="364" cy="174" rx="12" ry="2.2"></ellipse>
        <ellipse class="sc-ripple" cx="118" cy="178" rx="5" ry="1"></ellipse><ellipse class="sc-ripple sc-ripple-b" cx="268" cy="186" rx="6" ry="1.2"></ellipse><ellipse class="sc-ripple sc-ripple-c" cx="364" cy="174" rx="4" ry=".9"></ellipse>
      </g>
      <g class="sc-spills">
        <ellipse class="sc-spill" data-room="salon" cx="174" cy="164" rx="28" ry="6" fill="url(#sc-spill-gradient)"></ellipse>
        <ellipse class="sc-spill" data-room="cocina" cx="242" cy="164" rx="28" ry="6" fill="url(#sc-spill-gradient)"></ellipse>
        <ellipse class="sc-porch-spill" cx="208" cy="166" rx="22" ry="7" fill="url(#sc-spill-gradient)"></ellipse>
      </g>

      <g class="sc-fence">
        <path d="M104 148 v14 M112 147 v15 M120 148 v14 M128 147 v15 M136 148 v14 M144 147 v15 M152 148 v14 M160 147 v15"></path>
        <path d="M101 152 H163 M101 158 H163"></path>
      </g>
      <g class="sc-bush"><circle cx="128" cy="157" r="9"></circle><circle class="sc-bush-b" cx="141" cy="154" r="11"></circle><circle cx="154" cy="158" r="7"></circle></g>

      <g class="sc-tree">
        <path class="sc-trunk" d="M327 164 L329.5 126 L333.5 126 L336 164 Z"></path>
        <path class="sc-branches" d="M331 134 L316 112 M331 128 L346 106 M331 120 L325 96 M339 116 L352 102 M321 118 L309 108 M331 112 L337 92"></path>
        <g class="sc-canopy">
          <circle class="sc-canopy-a" cx="331" cy="108" r="21"></circle><circle class="sc-canopy-b" cx="315" cy="117" r="13"></circle>
          <circle class="sc-canopy-b" cx="348" cy="117" r="13"></circle><circle class="sc-canopy-a" cx="323" cy="95" r="12"></circle>
          <circle class="sc-canopy-b" cx="340" cy="94" r="12"></circle>
          <g class="sc-blossoms">${blossoms}</g>
          <path class="sc-tree-snow" d="M312 90 q10 -9 22 -8 q12 -1 20 8 q-10 -4 -21 -3 q-11 -1 -21 3z"></path>
        </g>
      </g>

      <g class="sc-house">
        <rect class="sc-chimney" x="238" y="56" width="12" height="28"></rect>
        <rect class="sc-eave" x="236" y="53" width="16" height="4" rx="1"></rect>
        <g class="sc-smoke">
          <circle class="sc-puff" cx="244" cy="50" r="3.4"></circle><circle class="sc-puff sc-puff-b" cx="244" cy="50" r="3.4"></circle><circle class="sc-puff sc-puff-c" cx="244" cy="50" r="3.4"></circle>
        </g>
        <rect class="sc-wall" x="150" y="90" width="116" height="70"></rect>
        <rect class="sc-wall-shadow" x="150" y="90" width="116" height="7"></rect>
        <polygon class="sc-roof" points="140,92 208,47 276,92"></polygon>
        <rect class="sc-eave" x="138" y="90" width="140" height="5" rx="2"></rect>
        <polygon class="sc-roof-snow" points="138,92 208,45 278,92 270,93 208,52 146,93"></polygon>
        <circle class="sc-trim" cx="208" cy="73" r="9"></circle>
        <g class="sc-window" data-room="estudio">
          <circle class="sc-window-glass" cx="208" cy="73" r="7"></circle>
          <path class="sc-window-bars" d="M208 66 V80 M201 73 H215"></path>
        </g>
        ${windowMarkup('dormitorio', 164, 99, 22, 18)}
        ${windowMarkup('bano', 230, 99, 22, 18)}
        ${windowMarkup('salon', 160, 124, 28, 24, movieMarkup())}
        ${windowMarkup('cocina', 228, 124, 28, 24, cookMarkup())}
        <g class="sc-plant"><rect x="188.5" y="154" width="8" height="6" rx="1"></rect><path d="M192.5 154 q-5 -6 -2 -9 M192.5 154 q1 -8 5 -8 M192.5 154 q-1 -5 -5 -5"></path></g>
        <path class="sc-door" d="M198 160 V135 a10 10 0 0 1 20 0 V160 Z"></path>
        <circle class="sc-knob" cx="213.5" cy="147" r="1.3"></circle>
        <g class="sc-door-note"><rect x="202.5" y="136" width="7" height="7" rx=".6" transform="rotate(-7 206 139.5)"></rect></g>
        <rect class="sc-trim" x="195" y="159" width="26" height="3" rx="1"></rect>
        <g class="sc-porch"><circle class="sc-porch-glow" cx="224" cy="133" r="4.5"></circle><rect class="sc-porch-lamp" x="222.4" y="130" width="3.2" height="5" rx="1"></rect></g>
      </g>

      <g class="sc-mailbox">
        <rect class="sc-mailbox-post" x="140.5" y="152" width="3" height="14"></rect>
        <rect class="sc-mailbox-box" x="133" y="143" width="18" height="10" rx="4"></rect>
        <g class="sc-flag"><rect x="150" y="137" width="1.6" height="11"></rect><rect x="150" y="137" width="7" height="4.2" rx=".6"></rect></g>
      </g>

      <g class="sc-zzz"><text x="180" y="110">z</text><text x="180" y="110">Z</text><text x="180" y="110">z</text></g>
      ${coupleMarkup()}

      <g class="sc-leaves">${leaves}</g>
      <g class="sc-fireflies">${fireflies}</g>
      <g class="sc-birds">
        <path class="sc-bird" d="M0 0 q4 -5 8 0 q4 -5 8 0" style="--y:34px;--delay:0s;--dur:14s"></path>
        <path class="sc-bird" d="M0 0 q3 -4 6 0 q3 -4 6 0" style="--y:44px;--delay:-2s;--dur:15s"></path>
        <path class="sc-bird" d="M0 0 q3 -4 6 0 q3 -4 6 0" style="--y:28px;--delay:-4s;--dur:16s"></path>
      </g>
      <g class="sc-fog">
        <rect class="sc-fog-band" x="-60" y="96" width="520" height="16" rx="8" filter="url(#sc-blur)"></rect>
        <rect class="sc-fog-band sc-fog-b" x="-80" y="124" width="540" height="18" rx="9" filter="url(#sc-blur)"></rect>
        <rect class="sc-fog-band sc-fog-c" x="-40" y="150" width="500" height="20" rx="10" filter="url(#sc-blur)"></rect>
      </g>
      <g class="sc-rain">${drops}</g>
      <g class="sc-snow">${flakes}</g>
      <rect class="sc-flash" width="400" height="200"></rect>
      <path class="sc-bolt" d="M96 18 L82 52 H93 L80 86 L106 44 H95 L104 18 Z"></path>
    </svg>`;
  }

  let container = null;
  let lastSignature = '';
  let currentAct = null;
  let actOptions = [];
  let loveTimer = null;
  const state = { weatherCode: 1, temperature: 16, windSpeed: 6, sunrise: null, sunset: null, lights: [], pendingBills: 0, urgentNotes: 0, act: null };

  function atTime(base, hours, minutes) {
    const date = new Date(base);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function apply() {
    if (!container) return;
    const now = new Date();
    const sunrise = state.sunrise instanceof Date && !Number.isNaN(state.sunrise.getTime()) ? state.sunrise : atTime(now, 7, 15);
    const sunset = state.sunset instanceof Date && !Number.isNaN(state.sunset.getTime()) ? state.sunset : atTime(now, 19, 15);
    const moment = timeline(now, sunrise, sunset);
    const nightness = lerp(NIGHTNESS[moment.from], NIGHTNESS[moment.to], moment.amount);
    const warmth = lerp(WARMTH[moment.from], WARMTH[moment.to], moment.amount);
    const condition = conditionFor(Number(state.weatherCode));
    const conditionConfig = CONDITIONS[condition];
    const season = seasonFor(now);
    const seasonConfig = SEASONS[season];
    const wind = clamp(Number(state.windSpeed) || 0, 0, 70);

    const fogTarget = nightness > 0.5 ? '#3b4654' : '#dfe4e2';
    const weathered = (hex) => {
      let color = desaturate(hex, conditionConfig.grey);
      if (conditionConfig.darken) color = mix(color, '#1d2630', conditionConfig.darken);
      if (condition === 'fog') color = mix(color, fogTarget, 0.45);
      return color;
    };
    const lit = (hex) => weathered(mix(mix(hex, '#111c30', nightness * 0.7), '#ff9d62', warmth * 0.14));

    const vars = {};
    const skyFrom = SKY[moment.from];
    const skyTo = SKY[moment.to];
    Object.keys(skyFrom).forEach((key) => { vars[key] = weathered(mix(skyFrom[key], skyTo[key], moment.amount)); });
    Object.entries(OBJECTS).forEach(([key, color]) => { vars[key] = lit(color); });
    vars.canopy = lit(seasonConfig.canopy);
    vars.canopyB = lit(seasonConfig.canopyB);
    vars.accent = lit(seasonConfig.accent);
    vars.cloud = mix(weathered(conditionConfig.cloud), '#26334a', nightness * 0.75);
    vars.glass = lit('#cfe3ee');
    vars.glassLit = mix('#ffe6a8', '#ffc45e', nightness);
    vars.curtainLit = mix('#f3dcae', '#ffb95a', nightness);
    vars.sun = mix('#fff1b8', '#ff9446', warmth);
    vars.rain = mix('#7d9fc2', '#a5bfdb', nightness);

    const daylight = minutesOf(now) >= minutesOf(sunrise) - 5 && minutesOf(now) <= minutesOf(sunset) + 5;
    const dayProgress = clamp((minutesOf(now) - minutesOf(sunrise)) / Math.max(1, minutesOf(sunset) - minutesOf(sunrise)));
    const nightLength = 1440 - minutesOf(sunset) + minutesOf(sunrise);
    const nightProgress = clamp(((minutesOf(now) - minutesOf(sunset) + 1440) % 1440) / Math.max(1, nightLength));
    const sunPosition = arc(dayProgress);
    const moonPosition = arc(nightProgress);

    const numbers = {
      stars: clamp((nightness - 0.5) * 2) * conditionConfig.sky,
      moon: clamp((nightness - 0.35) / 0.65) * conditionConfig.sky,
      sunVisible: daylight ? (1 - nightness * 0.6) * conditionConfig.sky : 0,
      cityLights: clamp((nightness - 0.5) * 2),
      spill: nightness * 0.95,
      porch: nightness > 0.55 ? 1 : 0,
      snowGround: condition === 'snow' ? 0.92 : 0,
      wind: 1 + wind / 18
    };
    Object.entries(numbers).forEach(([key, value]) => { vars[key] = String(Number(value.toFixed(3))); });
    vars.rainDrift = `${(-8 - wind * 0.9).toFixed(1)}px`;
    vars.smokeDrift = `${(4 + wind * 0.5).toFixed(1)}px`;
    vars.swayDeg = `${(0.8 + wind / 12).toFixed(2)}deg`;

    Object.entries(vars).forEach(([key, value]) => {
      container.style.setProperty(`--sc-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
    });

    const svg = container.querySelector('svg');
    svg.querySelector('.sc-sun').setAttribute('transform', `translate(${sunPosition.x.toFixed(1)} ${sunPosition.y.toFixed(1)})`);
    svg.querySelector('.sc-moon').setAttribute('transform', `translate(${moonPosition.x.toFixed(1)} ${moonPosition.y.toFixed(1)})`);
    const phase = moonPhase(now);
    const shadowOffset = phase < 0.5 ? -40 * phase : 40 * (1 - phase);
    svg.querySelector('.sc-moon-shadow').setAttribute('cx', shadowOffset.toFixed(2));

    const cloudCount = condition === 'clear' && nightness > 0.5 ? 0 : conditionConfig.clouds;
    svg.querySelectorAll('.sc-cloud').forEach((cloud, index) => cloud.classList.toggle('is-on', index < cloudCount));
    const dropCount = condition === 'storm' ? 60 : condition === 'rain' ? (Number(state.weatherCode) === 61 || Number(state.weatherCode) === 80 ? 32 : 48) : condition === 'drizzle' ? 20 : 0;
    svg.querySelectorAll('.sc-drop').forEach((drop, index) => drop.classList.toggle('is-on', index < dropCount));
    const flakeCount = condition === 'snow' ? (Number(state.weatherCode) === 71 ? 22 : Number(state.weatherCode) === 75 ? 46 : 34) : 0;
    svg.querySelectorAll('.sc-flake').forEach((flake, index) => flake.classList.toggle('is-on', index < flakeCount));

    // Plan de la pareja: se mantiene mientras siga teniendo sentido con la hora y el tiempo.
    const temperature = Number.isFinite(Number(state.temperature)) ? Number(state.temperature) : 16;
    const options = eligibleActs({ condition, nightness, temperature, minutes: minutesOf(now), season });
    actOptions = options;
    if (state.act && ACTS[state.act]) currentAct = state.act;
    else if (!options.includes(currentAct)) currentAct = pick(options);
    const act = ACTS[currentAct];
    const outfit = outfitFor({ condition, temperature, place: act.place });
    dressCouple(outfit, act.place === 'out' ? nightness * (nightness > 0.55 ? 0.38 : 0.5) : 0);

    const litRooms = new Set(state.lights.map(normalizeRoom).map((room) => (WINDOW_ROOMS.includes(room) ? room : 'salon')));
    if (act.room) litRooms.add(act.room);
    svg.querySelectorAll('[data-room]').forEach((element) => element.classList.toggle('is-lit', litRooms.has(element.dataset.room)));

    const clearish = condition === 'clear' || condition === 'partly';
    Object.assign(container.dataset, {
      condition,
      season,
      night: String(nightness > 0.55),
      wet: String(['drizzle', 'rain', 'storm'].includes(condition)),
      smoke: String(Number(state.temperature) < 15 || (nightness > 0.7 && Number(state.temperature) < 18)),
      birds: String(nightness < 0.2 && clearish && season !== 'winter'),
      fireflies: String(season === 'summer' && nightness > 0.7 && clearish),
      shooting: String(nightness > 0.8 && condition === 'clear'),
      mail: String(Number(state.pendingBills) > 0),
      note: String(Number(state.urgentNotes) > 0),
      act: currentAct,
      place: act.place,
      outfit,
      shades: String(outfit === 'hot' && clearish && nightness < 0.3)
    });

    const momentLabel = nightness > 0.7 ? 'Noche' : moment.from === 'dawn' || moment.to === 'dawn' ? 'Amanecer' : moment.from === 'dusk' || moment.to === 'dusk' ? 'Atardecer' : 'Día';
    const roomsLabel = litRooms.size ? `, luz encendida en ${[...litRooms].map((room) => ({ salon: 'el salón', cocina: 'la cocina', dormitorio: 'el dormitorio', bano: 'el baño', estudio: 'el estudio' })[room]).join(' y ')}` : '';
    container.setAttribute('aria-label', `${momentLabel} de ${seasonConfig.label} ${conditionConfig.label} en Turín${roomsLabel}. Ines y Matteo ${act.label}`);
  }

  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // Colores de ropa y piel como variables --ines-* y --matteo-*; de noche, en el jardín, se oscurecen.
  function dressCouple(outfit, shade) {
    Object.entries(PEOPLE).forEach(([key, person]) => {
      const clothes = WARDROBE[outfit][key];
      const tone = (hex) => mix(hex, '#141d2e', shade);
      const colors = {
        skin: person.skin,
        hair: person.hair,
        eyes: person.eyes,
        top: clothes.top,
        sleeve: clothes.sleeve === 'skin' ? person.skin : clothes.top,
        pants: clothes.pants,
        shin: clothes.shin === 'skin' ? person.skin : clothes.pants,
        shoe: clothes.shoe,
        coat: clothes.coat || clothes.top,
        boot: clothes.boot || clothes.shoe,
        scarf: clothes.scarf || clothes.top,
        hat: clothes.hat || person.hair
      };
      Object.entries(colors).forEach(([part, color]) => container.style.setProperty(`--${key}-${part}`, tone(color)));
    });
  }

  // Cada cierto tiempo cambian de plan (entre los que encajan con el momento).
  function changeAct() {
    if (!container || state.act) return;
    const others = actOptions.filter((option) => option !== currentAct);
    if (others.length) currentAct = pick(others);
    apply();
  }

  // Al tocarlos: corazones y un saltito.
  function cheer(event) {
    event.stopPropagation();
    event.preventDefault();
    container.dataset.love = 'false';
    void container.getBoundingClientRect();
    container.dataset.love = 'true';
    clearTimeout(loveTimer);
    loveTimer = setTimeout(() => { container.dataset.love = 'false'; }, 2600);
  }

  function update(partial = {}) {
    Object.assign(state, partial);
    const signature = JSON.stringify(state);
    if (signature === lastSignature && !partial.force) return;
    lastSignature = signature;
    apply();
  }

  function mount(element) {
    if (!element || container) return;
    container = element;
    container.classList.add('scene');
    container.setAttribute('role', 'img');
    container.innerHTML = buildMarkup();
    apply();
    // El sol y la luna avanzan con el reloj.
    setInterval(apply, 5 * 60 * 1000);
    setInterval(changeAct, 45 * 1000);
    container.querySelectorAll('.ch-hit').forEach((target) => {
      target.addEventListener('click', cheer);
      target.addEventListener('keydown', (event) => event.stopPropagation());
    });
    // Sin animar cuando no se ve: ahorra batería.
    const setPaused = (paused) => container.classList.toggle('is-paused', paused);
    document.addEventListener('visibilitychange', () => setPaused(document.hidden));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting || document.hidden)).observe(container);
    }
  }

  window.umbralScene = { mount, update };
})();
