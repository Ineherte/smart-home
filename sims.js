// Modo Sims: vuestra casa por dentro, en corte, con cocina, salón, dormitorio y baño.
// - Tocas un objeto y eliges qué hacer: tu muñeco va andando (sube las escaleras si hace
//   falta), lo hace y suben sus necesidades (avatars.js).
// - Tocas al otro muñeco: abrazo, beso, charla… Le llega al móvil y lo ve en su casa.
// - Libre albedrío: si no le mandas nada y algo le falta, tu muñeco se las apaña solo.
// - Lo que hace cada uno se guarda (activity) y el otro lo ve en directo.
// - Vuestra casa de verdad: sofá verde caqui, alfombra roja, el puzzle de La gran ola de
//   Kanagawa, la strelitzia, el espejo con forma de gota y el tiburón de peluche.
// - Ines habla en español y Matteo en italiano (y a veces en simlish); entre ellos,
//   tiburones. Se hacen el selfie del espejo como en su foto.
// El dibujo de los muñecos es el de la escena (umbralScene.personSvg).
const SIM_SCALE = 1.8;
const FLOOR_Y = [300, 172];
const STAIRS = { bottom: { x: 176, y: 300 }, top: { x: 232, y: 172 } };
const ROOM_LIMITS = [[16, 386], [16, 386]];
const WALK_SPEED = 75;

const SIM_OBJECTS = {
  fridge: { label: 'Nevera', spot: { floor: 0, x: 30 }, actions: ['snack'] },
  stove: { label: 'Fogones', spot: { floor: 0, x: 72 }, actions: ['cook'] },
  table: { label: 'Mesa', spot: { floor: 0, x: 142 }, actions: ['eat'] },
  radio: { label: 'Tocadiscos', spot: { floor: 0, x: 246 }, actions: ['dance', 'sing'] },
  sofa: { label: 'Sofá', spot: { floor: 0, x: 298 }, actions: ['nap', 'phone'] },
  tv: { label: 'Tele', spot: { floor: 0, x: 298 }, actions: ['tv'] },
  plant: { label: 'Strelitzia', spot: { floor: 0, x: 370 }, actions: ['water', 'talkplant'] },
  photo: { label: 'Vuestra foto', spot: { floor: 0, x: 250 }, actions: ['photos'] },
  wave: { label: 'La gran ola (vuestro puzzle)', spot: { floor: 0, x: 300 }, actions: ['admire', 'puzzle'] },
  shark: { label: 'Tiburón de peluche', spot: { floor: 0, x: 318 }, actions: ['sharkhug', 'sharknap'] },
  mirror: { label: 'Espejo', spot: { floor: 1, x: 214 }, actions: ['pose'], social: ['selfie'] },
  bed: { label: 'Cama', spot: { floor: 1, x: 136 }, actions: ['sleep', 'jump'] },
  wardrobe: { label: 'Armario', spot: { floor: 1, x: 172 }, actions: ['dress', 'costume'] },
  sink: { label: 'Lavabo', spot: { floor: 1, x: 256 }, actions: ['teeth', 'mirror'] },
  shower: { label: 'Ducha', spot: { floor: 1, x: 334 }, actions: ['shower', 'bath'] }
};

// secs: duración; doing: animación; pose: stand/sit/lie/bed/hidden; prop: estado del objeto.
const SIM_ACTIONS = {
  snack: { object: 'fridge', label: 'Picar algo', emoji: '🧀', secs: 5, doing: 'eat', prop: 'fridge', needs: { hunger: 20 } },
  cook: { object: 'stove', label: 'Cocinar', emoji: '🍳', secs: 9, doing: 'cook', prop: 'stove', needs: { hunger: 45, fun: 5 }, say: { ines: ['¡Tortilla con cebolla, obvio! 🥔', '¿Le echo más sal?', 'Esto huele a gloria'], matteo: ['La pasta al dente! 🤌', 'Mamma mia, che profumo!', 'Niente panna nella carbonara!'] } },
  eat: { object: 'table', label: 'Merendar', emoji: '🥐', secs: 6, doing: 'eat', needs: { hunger: 25, social: 5 } },
  dance: { object: 'radio', label: 'Bailar', emoji: '💃', secs: 8, doing: 'dance', prop: 'radio', needs: { fun: 25, energy: -5 } },
  sing: { object: 'radio', label: 'Cantar a pleno pulmón', emoji: '🎤', secs: 7, doing: 'sing', prop: 'radio', talk: true, needs: { fun: 20 } },
  nap: { object: 'sofa', label: 'Echar una siesta', emoji: '😴', secs: 10, doing: 'nap', pose: 'sit', zzz: true, needs: { energy: 25 } },
  phone: { object: 'sofa', label: 'Mirar el móvil', emoji: '📱', secs: 6, doing: 'phone', pose: 'sit', needs: { fun: 10, social: 5 } },
  tv: { object: 'tv', label: 'Ver la tele', emoji: '📺', secs: 10, doing: 'tv', pose: 'sit', prop: 'tv', needs: { fun: 30 } },
  water: { object: 'plant', label: 'Regar la planta', emoji: '💧', secs: 5, doing: 'water', prop: 'plant', needs: { fun: 10 } },
  talkplant: { object: 'plant', label: 'Hablarle a la planta', emoji: '🌱', secs: 6, doing: 'talk', talk: true, needs: { social: 5, fun: 5 } },
  admire: { object: 'wave', label: 'Admirar vuestro puzzle', emoji: '🌊', secs: 5, doing: 'admire', needs: { fun: 10, social: 5 }, say: { ines: ['¡Mil piezas, tiburón! 🧩', 'Qué bonito nos quedó 🌊', 'La pieza del cielo me costó…'], matteo: ['Che capolavoro! 🌊', 'Hokusai sarebbe fiero', 'Il prossimo, più difficile!'] } },
  puzzle: { object: 'table', label: 'Empezar otro puzzle', emoji: '🧩', secs: 9, doing: 'puzzle', prop: 'puzzle', needs: { fun: 25 }, say: { ines: ['¿Dónde va esta pieza? 🤔', '¡Primero los bordes!'], matteo: ['Trovata! 🧩', 'Prima i bordi, amore'] } },
  sharkhug: { object: 'shark', label: 'Abrazar al tiburón', emoji: '🦈', secs: 6, doing: 'sharkhug', prop: 'shark', needs: { social: 15, fun: 10 }, say: { ines: ['¡Mi tiburoncito! 🦈', 'Te echaba de menos'], matteo: ['Il mio squalo preferito 🦈', 'Abbraccio!'] } },
  sharknap: { object: 'shark', label: 'Siesta con el tiburón', emoji: '😴', secs: 10, doing: 'sharknap', pose: 'sit', prop: 'shark', zzz: true, needs: { energy: 25, social: 5 } },
  pose: { object: 'mirror', label: 'Posar en el espejo', emoji: '😎', secs: 5, doing: 'pose', needs: { fun: 10, social: 5 }, say: { ines: ['¡Qué guapa estoy hoy! ✨', 'Mi mejor perfil 😎'], matteo: ['Bello come il sole 😎', 'Che figo!'] } },
  photos: { object: 'photo', label: 'Mirar vuestras fotos', emoji: '🖼️', secs: 3, doing: 'look', needs: { social: 10 }, after: 'photos' },
  sleep: { object: 'bed', label: 'Dormir', emoji: '💤', secs: 12, doing: 'sleep', pose: 'lie', prop: 'bed', zzz: true, needs: { energy: 70 } },
  jump: { object: 'bed', label: 'Saltar en la cama', emoji: '🤸', secs: 7, doing: 'jump', pose: 'bed', needs: { fun: 25, energy: -10 } },
  dress: { object: 'wardrobe', label: 'Cambiarse de ropa', emoji: '👗', secs: 1.5, doing: 'look', prop: 'wardrobe', after: 'dress', own: true },
  costume: { object: 'wardrobe', label: 'Disfraz sorpresa', emoji: '🎲', secs: 3, doing: 'spin', prop: 'wardrobe', after: 'costume', own: true, needs: { fun: 15 } },
  teeth: { object: 'sink', label: 'Lavarse los dientes', emoji: '🪥', secs: 5, doing: 'teeth', needs: { hygiene: 20 } },
  mirror: { object: 'sink', label: 'Hablar con el espejo', emoji: '🪞', secs: 6, doing: 'talk', talk: true, needs: { social: 10, fun: 10 } },
  shower: { object: 'shower', label: 'Ducharse', emoji: '🚿', secs: 8, doing: 'shower', pose: 'hidden', prop: 'shower', talk: true, needs: { hygiene: 60 } },
  bath: { object: 'shower', label: 'Baño de espuma', emoji: '🛁', secs: 12, doing: 'shower', pose: 'hidden', prop: 'bath', needs: { hygiene: 80, fun: 10 } }
};
const NEED_ACTIONS = { hunger: ['cook', 'snack', 'eat'], energy: ['nap', 'sleep', 'sharknap'], fun: ['tv', 'dance', 'jump', 'sing', 'puzzle', 'admire'], hygiene: ['shower', 'teeth', 'bath'], social: ['mirror', 'phone', 'talkplant', 'sharkhug', 'pose'] };
// Sitios para pasear sin quedar detrás del sofá, la cama o la bañera.
const IDLE_SPOTS = [{ floor: 0, x: 108 }, { floor: 0, x: 214 }, { floor: 0, x: 362 }, { floor: 1, x: 140 }, { floor: 1, x: 214 }, { floor: 1, x: 272 }];
const SIMLISH = ['¡Sul sul!', 'Dag dag', 'Nooboo', 'Feebee!', '¡Woohoo!', 'Gerbits', 'Vadish', 'Shoo be dee', 'Frobbit', 'Litzergam', 'Yibs!', 'Sna snu', 'Hooba hooba', 'Zib zab', 'Firby nobbin'];
const CHAT_EMOJIS = ['🍕', '❤️', '🏖️', '🐱', '🎬', '😂', '🌮', '✈️', '🎶', '🍝', '☕', '🌙', '🦈', '🏡', '🧩', '🇪🇸', '🇮🇹', '❓', '❗'];
// Cada uno habla en su idioma (y la voz del móvil lo lee con ese acento).
const SIM_VOICES = {
  ines: { lang: 'es-ES', pitch: 1.25, phrases: ['¡Hola, tiburón!', '¿Qué cenamos?', 'Qué bien se está en casa', 'Ay, mi tiburón 🦈', '¿Un café?', '¡Vamos!', 'Te quiero', '¡Me encanta!', '¿Hacemos un puzzle?', 'Venga, va', '¡Qué guay!', 'Madre mía'] },
  matteo: { lang: 'it-IT', pitch: 0.85, phrases: ['Ciao, tiburona!', 'Amore mio', 'Che fame!', 'Andiamo!', 'Mamma mia!', 'Ti amo', 'Dai, dai!', 'Che bello!', 'Un caffè?', 'Bellissima!', 'Allora…', 'Boh 🤷'] }
};
const COMPLIMENTS = {
  ines: ['¡Qué guapo estás, tiburón!', '¡Eres lo mejor!', 'Me encanta tu sonrisa', 'Te quiero muchísimo ❤️'],
  matteo: ['Sei bellissima, amore!', 'Tiburona mia ❤️', 'Ti amo da morire', 'Che sorriso!']
};
const SHARK_LINES = { ines: ['¡Ataque de tiburón! 🦈', '¡Ñam, ñam, tiburón!'], matteo: ['Attacco di squalo! 🦈', 'Ti mangio, tiburona!'] };
const SHARK_VICTIM = { ines: ['¡Socorro! 😂', '¡Para, para! 🤣'], matteo: ['Aiuto! 😂', 'Basta, basta! 🤣'] };
const SIM_TIPS = [
  'Toca un objeto para ver qué puede hacer tu muñeco.',
  'Toca el muñeco del otro para abrazarle, charlar o sacarle a bailar.',
  'Si no le mandas nada, tu muñeco decide solo según lo que necesite (libre albedrío).',
  'Lo que hacéis de verdad en la app (tareas, recetas, fotos, planes) también cuida a vuestros muñecos.',
  'El diamante sobre la cabeza es verde si está bien, amarillo si le falta algo y rojo si está fatal.',
  'Toca el suelo y tu muñeco irá andando hasta allí.',
  'Id juntos al espejo del dormitorio para haceros vuestro selfie 🤳',
  'Toca al otro y elige «Ataque de tiburón» 🦈',
  'Con la lupa sigues de cerca a tu muñeco por la casa.'
];

const simsModal = document.querySelector('#simsModal');
const simsHouse = document.querySelector('#simsHouse');
const simsState = { open: false, timer: null, needsOf: 'me', tip: 0, sound: true, zoom: false };
try {
  simsState.sound = localStorage.getItem('umbral-sims-sound') !== 'off';
  simsState.zoom = localStorage.getItem('umbral-sims-zoom') === 'on';
} catch {}
const sims = {};
const simWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SIM_CANCELLED = Symbol('cancelled');
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const simPerson = (key) => householdPeople.find((person) => avatarKey(person) === key);
const meKey = () => avatarKey(myAvatarPerson() || householdPeople[0]);
const partnerKeyOf = () => avatarKey(otherPerson(simPerson(meKey())));

// ---------- Sonido (opcional) ----------
let simsAudio = null;
function simBlip(freq = 660, duration = 0.08) {
  if (!simsState.sound) return;
  try {
    simsAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = simsAudio.createOscillator();
    const gain = simsAudio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0.07, simsAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, simsAudio.currentTime + duration);
    oscillator.connect(gain).connect(simsAudio.destination);
    oscillator.start();
    oscillator.stop(simsAudio.currentTime + duration);
  } catch {}
}

// Habla con la voz del móvil, en español (Ines) o en italiano (Matteo).
function speak(key, text) {
  if (!simsState.sound || !('speechSynthesis' in window)) return;
  try {
    const voice = SIM_VOICES[key] || SIM_VOICES.ines;
    const clean = text.replace(/[¡!¿]/g, '').replace(/\p{Extended_Pictographic}|\u200d|\ufe0f/gu, '').trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = voice.lang;
    const native = speechSynthesis.getVoices().find((option) => option.lang?.replace('_', '-').startsWith(voice.lang.slice(0, 2)));
    if (native) utterance.voice = native;
    utterance.pitch = voice.pitch;
    utterance.rate = 1.1;
    utterance.volume = 0.7;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch {}
}

// Una frase suya: casi siempre en su idioma y a veces en simlish, como en los Sims.
function simlish(key) {
  const voice = SIM_VOICES[key] || SIM_VOICES.ines;
  const phrase = Math.random() < 0.7 ? pickOne(voice.phrases) : pickOne(SIMLISH);
  speak(key, phrase);
  return phrase;
}

function sayLine(key, lines) {
  const line = pickOne(lines);
  speak(key, line);
  return line;
}

// Tema de Tiburón: dos notas graves cada vez más rápidas.
async function jawsTheme() {
  for (let index = 0; index < 8; index += 1) {
    simBlip(index % 2 ? 87 : 82, 0.22);
    await simWait(Math.max(140, 520 - index * 60));
  }
}

// ---------- La casa ----------
// La gran ola de Kanagawa, el puzzle que hicisteis, con sus piezas marcadas.
function waveMarkup(x, y) {
  const w = 44;
  const h = 30;
  const cols = 5;
  const rows = 3;
  const pieceW = (w - 4) / cols;
  const pieceH = (h - 4) / rows;
  // Líneas de corte con la «lengüeta» de cada pieza.
  const vertical = Array.from({ length: cols - 1 }, (_, c) => {
    const lx = x + 2 + pieceW * (c + 1);
    return Array.from({ length: rows }, (_, r) => {
      const top = y + 2 + pieceH * r;
      const dir = (c + r) % 2 ? 1 : -1;
      return `M${lx} ${top} v${pieceH * 0.36} q${dir * 1.6} -.2 ${dir * 1.6} ${pieceH * 0.14} q0 ${pieceH * 0.14} ${-dir * 1.6} ${pieceH * 0.14} v${pieceH * 0.36}`;
    }).join(' ');
  }).join(' ');
  const horizontal = Array.from({ length: rows - 1 }, (_, r) => {
    const ly = y + 2 + pieceH * (r + 1);
    return Array.from({ length: cols }, (_, c) => {
      const left = x + 2 + pieceW * c;
      const dir = (c + r) % 2 ? -1 : 1;
      return `M${left} ${ly} h${pieceW * 0.36} q-.2 ${dir * 1.6} ${pieceW * 0.14} ${dir * 1.6} q${pieceW * 0.14} 0 ${pieceW * 0.14} ${-dir * 1.6} h${pieceW * 0.36}`;
    }).join(' ');
  }).join(' ');
  const bx = x + 2;
  const by = y + h - 2;
  return `<g class="sh-wave">
    <rect class="sh-wave-frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"></rect>
    <rect class="sh-wave-sky" x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}"></rect>
    <path class="sh-wave-fuji" d="M${bx + 22} ${by} l5.4 -6.4 l5.4 6.4 z"></path>
    <path class="sh-wave-snow" d="M${bx + 25.6} ${by - 4.3} l1.8 -2.1 l1.8 2.1 l-.9 .5 l-.9 -.6 l-.9 .6 z"></path>
    <path class="sh-wave-big" d="M${bx} ${by} V${by - 10} Q${bx + 3} ${by - 22} ${bx + 12} ${by - 23} Q${bx + 19} ${by - 23} ${bx + 21} ${by - 17} Q${bx + 17} ${by - 21} ${bx + 13} ${by - 17.5} Q${bx + 16} ${by - 18} ${bx + 17} ${by - 15} Q${bx + 12} ${by - 15.5} ${bx + 11} ${by - 11} Q${bx + 15} ${by - 4} ${bx + 34} ${by} Z"></path>
    <path class="sh-wave-light" d="M${bx + 3} ${by - 4} Q${bx + 5} ${by - 15} ${bx + 12} ${by - 19} M${bx + 8} ${by - 2} Q${bx + 8} ${by - 10} ${bx + 12} ${by - 14}"></path>
    <path class="sh-wave-foam" d="M${bx + 12} ${by - 23} q2 -1.2 3 .6 q1.4 -1.4 2.6 .2 q1.6 -1 2.4 .9 q1.4 -.4 1.8 1.6 q-1.6 -.8 -2.6 .2 q-.6 -1.4 -2.2 -.6 q-.8 -1.2 -2.4 -.4 q-.8 -1.4 -2.6 -.5 z"></path>
    <path class="sh-wave-small" d="M${bx + 30} ${by} q3 -6 8 -4.6 q-2.6 .8 -2 4.6 z"></path>
    <path class="sh-wave-boat" d="M${bx + 16} ${by - 5.2} q5 2.4 10 .8"></path>
    <path class="sh-puzzle" d="${vertical} ${horizontal}"></path>
  </g>`;
}

function houseMarkup() {
  const steps = Array.from({ length: 8 }, (_, index) => `<rect x="${176 + index * 7}" y="${300 - (index + 1) * 16}" width="${232 - 176 - index * 7}" height="16"></rect>`).join('');
  const tiles = Array.from({ length: 6 }, (_, index) => `M236 ${122 + index * 9} H394`).join(' ') + ' ' + Array.from({ length: 9 }, (_, index) => `M${246 + index * 18} 120 V172`).join(' ');
  return `<svg class="sims-svg" viewBox="0 0 400 330" role="img" aria-label="Vuestra casa por dentro">
    <rect class="sh-sky" width="400" height="330"></rect>
    <g class="sh-stars"><circle cx="40" cy="20" r="1"></circle><circle cx="120" cy="12" r=".8"></circle><circle cx="300" cy="18" r="1"></circle><circle cx="360" cy="8" r=".8"></circle></g>
    <rect class="sh-grass" y="312" width="400" height="18"></rect>
    <polygon class="sh-roof" points="-8,56 200,4 408,56"></polygon>
    <polygon class="sh-attic" points="40,52 200,14 360,52"></polygon>
    <circle class="sh-attic-window" cx="200" cy="38" r="9"></circle>

    <rect class="sh-room sh-bedroom" x="6" y="54" width="230" height="118"></rect>
    <rect class="sh-room sh-bathroom" x="236" y="54" width="158" height="118"></rect>
    <path class="sh-tiles" d="${tiles}"></path>
    <rect class="sh-room sh-kitchen" x="6" y="180" width="164" height="120"></rect>
    <rect class="sh-room sh-living" x="170" y="180" width="224" height="120"></rect>
    <path class="sh-stripes" d="${Array.from({ length: 11 }, (_, index) => `M${16 + index * 20} 54 V172`).join(' ')}"></path>
    <rect class="sh-backsplash" x="46" y="236" width="76" height="30"></rect>

    ${[[36, 72, 44, 40], [340, 66, 36, 30], [18, 196, 40, 34], [346, 194, 34, 30]].map(([x, y, w, h]) => `<g class="sh-window"><rect class="sh-window-glass" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"></rect><path class="sh-window-bars" d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}"></path><rect class="sh-window-frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"></rect></g>`).join('')}
    <g class="sh-lights">${[[121, 54], [315, 54], [88, 180], [252, 180]].map(([x, y]) => `<path class="sh-lamp-cord" d="M${x} ${y} V${y + 10}"></path><path class="sh-lamp" d="M${x - 7} ${y + 16} q7 -9 14 0 z"></path><circle class="sh-lamp-glow" cx="${x}" cy="${y + 20}" r="26"></circle>`).join('')}</g>

    <rect class="sh-wall" x="233" y="54" width="6" height="64"></rect>
    <rect class="sh-wall" x="167" y="180" width="6" height="56"></rect>
    <g class="sh-stairs">${steps}<path class="sh-rail" d="M180 284 L236 156"></path></g>
    <rect class="sh-floor" x="0" y="172" width="200" height="8"></rect>
    <rect class="sh-floor" x="236" y="172" width="164" height="8"></rect>
    <rect class="sh-floor" x="0" y="300" width="400" height="12"></rect>
    <rect class="sh-frame" x="3" y="52" width="394" height="260" rx="2"></rect>

    <!-- Cocina -->
    <g class="sh-obj" data-obj="fridge"><rect class="sh-fridge" x="14" y="230" width="30" height="70" rx="3"></rect><rect class="sh-fridge-inside" x="16" y="232" width="26" height="66" rx="2"></rect><path class="sh-fridge-food" d="M20 246 h8 v6 h-8 z M30 262 h8 v8 h-8 z M20 280 h14 v5 h-14 z"></path><path class="sh-fridge-line" d="M14 254 H44 M38 240 V248 M38 260 V272"></path><rect class="sh-hit" x="10" y="226" width="38" height="76"></rect></g>
    <g class="sh-obj" data-obj="stove"><rect class="sh-counter" x="48" y="266" width="70" height="34"></rect><rect class="sh-oven" x="52" y="276" width="38" height="20" rx="2"></rect><rect class="sh-oven-glass" x="57" y="280" width="28" height="11" rx="2"></rect><rect class="sh-burner" x="54" y="264" width="34" height="3" rx="1"></rect><rect class="sh-pot" x="60" y="252" width="20" height="12" rx="2"></rect><path class="sh-pot-handle" d="M58 255 h-3 M82 255 h3"></path><g class="sh-steam"><path d="M65 249 q-2 -4 0 -8 q2 -4 0 -8"></path><path d="M72 249 q2 -4 0 -8 q-2 -4 0 -8"></path></g><rect class="sh-board" x="96" y="262" width="18" height="4" rx="1"></rect><rect class="sh-hit" x="46" y="244" width="74" height="58"></rect></g>
    <g class="sh-obj" data-obj="table"><rect class="sh-table" x="124" y="266" width="40" height="4" rx="1.5"></rect><path class="sh-table-legs" d="M130 270 V300 M158 270 V300"></path><circle class="sh-croissant" cx="138" cy="263" r="3"></circle><g class="sh-puzzle-box"><rect x="128" y="263.4" width="22" height="2.6" rx=".4"></rect><path d="M131 263.4 v2.6 M135 263.4 v2.6 M139 263.4 v2.6 M143 263.4 v2.6"></path></g><rect class="sh-cup" x="148" y="259" width="6" height="7" rx="1"></rect><rect class="sh-hit" x="120" y="252" width="48" height="50"></rect></g>

    <!-- Salón -->
    <g class="sh-rug"><path class="sh-rug-base" d="M240 303 L250 296 H350 L360 303 Z"></path><path class="sh-rug-border" d="M246 302 L253.5 297 H346.5 L354 302 Z"></path><path class="sh-rug-pattern" d="M270 299.5 l4 -1.6 l4 1.6 l-4 1.6 z M296 299.5 l4 -1.6 l4 1.6 l-4 1.6 z M322 299.5 l4 -1.6 l4 1.6 l-4 1.6 z"></path><path class="sh-rug-fringe" d="${Array.from({ length: 12 }, (_, index) => `M${241 + index * 1.6} ${303 - index * 0.6} l-1.6 .9`).join(' ')} ${Array.from({ length: 12 }, (_, index) => `M${359 - index * 1.6} ${303 - index * 0.6} l1.6 .9`).join(' ')}"></path></g>
    <g class="sh-obj" data-obj="photo"><rect class="sh-photo" x="241" y="212" width="18" height="14" rx="1.2"></rect><path class="sh-photo-heart" transform="translate(250 216) scale(.7)" d="M0 0 c-1.7 -1.7 -4.2 -.4 -3.1 1.7 l3.1 3.1 l3.1 -3.1 c1.1 -2.1 -1.4 -3.4 -3.1 -1.7 z"></path><rect class="sh-hit" x="238" y="208" width="24" height="22"></rect></g>
    <g class="sh-obj" data-obj="wave">${waveMarkup(278, 196)}<rect class="sh-hit" x="274" y="192" width="52" height="38"></rect></g>
    <g class="sh-obj" data-obj="radio"><rect class="sh-side-table" x="236" y="282" width="22" height="18"></rect><rect class="sh-radio" x="236" y="272" width="22" height="10" rx="2"></rect><ellipse class="sh-record" cx="245" cy="271" rx="7" ry="1.6"></ellipse><g class="sh-notes"><text x="240" y="262">♪</text><text x="250" y="256">♫</text></g><rect class="sh-hit" x="232" y="250" width="30" height="52"></rect></g>
    <g class="sh-obj" data-obj="sofa"><rect class="sh-sofa" x="262" y="256" width="74" height="30" rx="7"></rect><rect class="sh-cushion" x="268" y="262" width="30" height="14" rx="4"></rect><rect class="sh-cushion" x="300" y="262" width="30" height="14" rx="4"></rect><path class="sh-sofa-seam" d="M283 264 v10 M315 264 v10"></path><rect class="sh-hit" x="258" y="252" width="82" height="50"></rect></g>
    <g class="sh-obj" data-obj="shark"><g class="sh-shark"><path class="sh-shark-body" d="M306 268 q4 -6.4 15 -4.6 l5 -4 l-.6 5 l3.6 3.4 l-5.2 .2 q-7.4 4.4 -17.8 0 z"></path><path class="sh-shark-fin" d="M315.4 264.2 l2.6 -5 l2.4 5.2 z"></path><path class="sh-shark-belly" d="M306.4 268.2 q7.4 3 15.2 -.4 q-7.2 4 -15.2 .4 z"></path><circle class="sh-shark-eye" cx="309.8" cy="266.4" r=".8"></circle><path class="sh-shark-gill" d="M313 265.6 v2.2 M314.4 265.4 v2.2"></path></g><rect class="sh-hit" x="304" y="257" width="28" height="15"></rect></g>
    <g class="sh-obj" data-obj="tv"><rect class="sh-tv-stand" x="344" y="282" width="38" height="18" rx="1"></rect><rect class="sh-tv" x="346" y="252" width="34" height="26" rx="2"></rect><rect class="sh-tv-screen" x="349" y="255" width="28" height="20" rx="1"></rect><path class="sh-tv-foot" d="M363 278 V282"></path><rect class="sh-hit" x="342" y="248" width="42" height="54"></rect></g>
    <g class="sh-obj" data-obj="plant"><path class="sh-plant-leaf" d="M389 286 q-10 -20 -4 -34 q6 12 4 34 z M390 286 q4 -24 12 -30 q-2 16 -12 30 z M388 286 q-14 -10 -16 -24 q12 8 16 24 z"></path><path class="sh-plant-bird" d="M392 258 l6 -3 l-2 -3 l4 1 l-2 -3 l4 2 l-2 4 z"></path><path class="sh-pot" d="M382 286 h14 l-2 14 h-10 z"></path><g class="sh-drops"><circle cx="384" cy="270" r="1"></circle><circle cx="388" cy="266" r="1"></circle><circle cx="392" cy="272" r="1"></circle></g><rect class="sh-hit" x="370" y="248" width="30" height="54"></rect></g>

    <!-- Dormitorio -->
    <g class="sh-obj" data-obj="bed"><rect class="sh-headboard" x="14" y="124" width="9" height="48" rx="2"></rect><rect class="sh-bed" x="16" y="152" width="106" height="20" rx="2"></rect><rect class="sh-mattress" x="22" y="145" width="98" height="9" rx="3"></rect><rect class="sh-pillow" x="26" y="139" width="22" height="8" rx="4"></rect><rect class="sh-hit" x="12" y="120" width="114" height="54"></rect></g>
    <g class="sh-obj" data-obj="nightstand"><rect class="sh-nightstand" x="126" y="152" width="16" height="20" rx="1"></rect><path class="sh-bedlamp" d="M128 152 h12 l-3 -9 h-6 z"></path><circle class="sh-bedlamp-glow" cx="134" cy="146" r="14"></circle></g>
    <g class="sh-obj" data-obj="wardrobe"><rect class="sh-wardrobe-inside" x="152" y="98" width="42" height="74" rx="2"></rect><path class="sh-clothes" d="M158 106 v26 h7 v-26 z M168 106 v30 h7 v-30 z M178 106 v22 h7 v-22 z"></path><rect class="sh-wardrobe-door sh-door-l" x="150" y="96" width="23" height="76" rx="2"></rect><rect class="sh-wardrobe-door sh-door-r" x="173" y="96" width="23" height="76" rx="2"></rect><path class="sh-knobs" d="M170 134 v4 M176 134 v4"></path><rect class="sh-hit" x="146" y="92" width="54" height="82"></rect></g>

    <g class="sh-obj" data-obj="mirror"><path class="sh-drop-mirror" d="M214 95 Q206 97 203.4 111 Q200.6 127 202.2 139 Q204 151 214.4 150.4 Q226.4 149.6 227.4 136 Q228.4 121 222.4 107.6 Q219 96 214 95 Z"></path><path class="sh-drop-glass" d="M214 97.4 Q207.6 99 205.6 111.6 Q203 127 204.6 138.4 Q206.2 148.2 214.4 147.8 Q224.4 147.2 225.2 135.6 Q226 121.4 220.4 108.6 Q217.6 98.4 214 97.4 Z"></path><path class="sh-drop-leaf" d="M207 146 q-2 -14 4 -24 q1 12 -4 24 z M209 146 q4 -12 12 -16 q-4 10 -12 16 z"></path><path class="sh-drop-shine" d="M208.6 108 q2 -5 5 -7 M207.4 116 q.6 -2.4 1.6 -4"></path><rect class="sh-hit" x="199" y="92" width="32" height="62"></rect></g>

    <!-- Baño -->
    <g class="sh-obj" data-obj="sink"><rect class="sh-mirror" x="246" y="94" width="20" height="30" rx="9"></rect><path class="sh-mirror-shine" d="M251 100 l4 -3 M251 106 l7 -6"></path><rect class="sh-sink-leg" x="253" y="146" width="6" height="26"></rect><rect class="sh-sink" x="244" y="140" width="24" height="8" rx="3"></rect><path class="sh-tap" d="M256 140 v-4 h4"></path><rect class="sh-hit" x="240" y="90" width="32" height="84"></rect></g>
    <g class="sh-obj" data-obj="shower"><path class="sh-shower-pipe" d="M378 172 V82 h-10 v6"></path><rect class="sh-shower-head" x="362" y="88" width="12" height="4" rx="2"></rect><rect class="sh-tub" x="290" y="146" width="94" height="26" rx="7"></rect><g class="sh-shower-water"><path d="M364 94 l-4 44 M368 94 v44 M372 94 l4 44"></path></g><rect class="sh-hit" x="286" y="80" width="104" height="94"></rect></g>

    <path class="sh-target" d="M0 -4 L3 0 L0 4 L-3 0 Z"></path>
    <g class="sims-layer"></g>

    <!-- Delante de los muñecos -->
    <g class="sh-front">
      <rect class="sh-sofa-front" x="262" y="280" width="74" height="20" rx="5"></rect>
      <rect class="sh-sofa-arm" x="256" y="266" width="12" height="34" rx="5"></rect><rect class="sh-sofa-arm" x="330" y="266" width="12" height="34" rx="5"></rect>
      <path class="sh-duvet" d="M46 144 h72 q4 0 4 4 v8 h-80 q0 -12 4 -12 z"></path>
      <path class="sh-duvet-pattern" d="M60 146 v10 M76 146 v10 M92 146 v10 M108 146 v10"></path>
      <rect class="sh-tub-front" x="290" y="152" width="94" height="20" rx="7"></rect>
      <g class="sh-bubbles"><circle cx="300" cy="150" r="5"></circle><circle cx="312" cy="146" r="6"></circle><circle cx="326" cy="149" r="5"></circle><circle cx="340" cy="145" r="7"></circle><circle cx="356" cy="149" r="5"></circle><circle cx="370" cy="147" r="6"></circle></g>
      <path class="sh-rod" d="M288 86 H384"></path>
      <path class="sh-curtain" d="M290 86 h92 v66 q-11 6 -23 0 q-11 6 -23 0 q-11 6 -23 0 q-11 6 -23 0 z"></path>
      <path class="sh-curtain-open" d="M370 86 h12 v66 q-6 4 -12 0 z"></path>
      <g class="sh-steam-cloud"><circle cx="312" cy="80" r="8"></circle><circle cx="336" cy="72" r="10"></circle><circle cx="358" cy="80" r="8"></circle></g>
    </g>
  </svg>
  <div class="sims-overlay"></div>`;
}

function simMarkup(key) {
  return `<g class="sim sim-${key}" data-sim="${key}" data-pose="stand" data-doing="idle">
    <g class="sim-flip"><g class="sim-body" transform="scale(${SIM_SCALE})"></g></g>
    <circle class="sim-progress" cx="21" cy="-76" r="5"></circle>
    <rect class="sim-hit" x="-18" y="-96" width="36" height="98"></rect>
  </g>`;
}

function renderSimBody(key) {
  const sim = sims[key];
  if (!sim) return;
  const row = avatarRows[simPerson(key)] || {};
  const { style, markup } = window.umbralScene.personSvg(key, { look: row.look || {}, mood: row.mood, plumbob: needsLevel(currentNeeds(row)) }, 'mild');
  const body = sim.el.querySelector('.sim-body');
  // Los brazos del otro (para el abrazo por detrás del selfie) van con sus colores.
  const partnerKey = Object.keys(sims).find((other) => other !== key) || (key === 'ines' ? 'matteo' : 'ines');
  const partnerRow = avatarRows[simPerson(partnerKey)] || {};
  const arms = window.umbralScene.armColors?.(partnerKey, { look: partnerRow.look || {} }) || {};
  body.setAttribute('style', `${style};--hug-skin:${arms.skin || '#efc6a2'};--hug-sleeve:${arms.sleeve || '#1f1e24'}`);
  body.innerHTML = markup;
}

function placeSim(sim, x, y, secs = 0) {
  sim.el.style.transitionDuration = `${secs}s`;
  sim.el.style.transform = `translate(${x}px, ${y}px)`;
  sim.x = x;
  sim.y = y;
  if (sim.el.dataset.sim === meKey()) followCamera(sim, secs);
}

// Con la lupa, la casa se amplía alrededor de tu muñeco y le sigue mientras anda.
function followCamera(sim, secs = 0) {
  simsHouse.style.setProperty('--cam-secs', `${secs}s`);
  simsHouse.style.setProperty('--cam-x', `${((sim.x / 400) * 100).toFixed(1)}%`);
  simsHouse.style.setProperty('--cam-y', `${(((sim.y - 40) / 330) * 100).toFixed(1)}%`);
}

const faceSim = (sim, direction) => {
  sim.facing = direction;
  sim.el.querySelector('.sim-flip').style.setProperty('--flip', String(direction));
};
const checkToken = (sim, token) => { if (sim.token !== token) throw SIM_CANCELLED; };

async function walkTo(sim, spot, token) {
  const points = [];
  if (spot.floor !== sim.floor) points.push(sim.floor === 0 ? STAIRS.bottom : STAIRS.top, sim.floor === 0 ? STAIRS.top : STAIRS.bottom);
  points.push({ x: spot.x, y: FLOOR_Y[spot.floor] });
  sim.el.dataset.pose = 'stand';
  for (const point of points) {
    const distance = Math.hypot(point.x - sim.x, point.y - sim.y);
    if (distance < 1) continue;
    sim.el.dataset.doing = 'walk';
    faceSim(sim, point.x < sim.x ? -1 : 1);
    const secs = distance / WALK_SPEED;
    placeSim(sim, point.x, point.y, secs);
    await simWait(secs * 1000);
    checkToken(sim, token);
    if (point === STAIRS.top) sim.floor = 1;
    if (point === STAIRS.bottom) sim.floor = 0;
  }
  sim.floor = spot.floor;
  faceSim(sim, 1);
  sim.el.dataset.doing = 'idle';
}

// ---------- Bocadillos, pensamientos y números que suben ----------
// Encima de la cabeza, calculado con la posición a la que va el muñeco (no la que se está
// dibujando a mitad de camino).
function overlayPoint(sim, offsetY = 0) {
  const svg = simsHouse.querySelector('.sims-svg');
  const box = simsHouse.getBoundingClientRect();
  const scale = SIM_SCALE * (sim.el.dataset.sim === 'matteo' ? 1.16 : 1);
  const lying = sim.el.dataset.pose === 'lie';
  const point = svg.createSVGPoint();
  point.x = lying ? sim.x - 27 * scale : sim.x;
  point.y = lying ? sim.y - 10 : sim.y - 34 * scale;
  const screen = point.matrixTransform(svg.getScreenCTM());
  return { x: screen.x - box.left, y: screen.y - box.top + offsetY, width: box.width };
}

function simBubble(sim, text, { kind = 'say', secs = 2.6 } = {}) {
  const overlay = simsHouse.querySelector('.sims-overlay');
  const bubble = document.createElement('div');
  bubble.className = `sim-bubble is-${kind}`;
  bubble.textContent = text;
  overlay.appendChild(bubble);
  const point = overlayPoint(sim, -10);
  const half = bubble.offsetWidth / 2;
  bubble.style.left = `${Math.min(Math.max(point.x, half + 4), point.width - half - 4)}px`;
  bubble.style.top = `${Math.max(bubble.offsetHeight + 4, point.y)}px`;
  setTimeout(() => bubble.remove(), secs * 1000);
}

function simFloat(sim, text) {
  const overlay = simsHouse.querySelector('.sims-overlay');
  const label = document.createElement('div');
  label.className = 'sim-float';
  label.textContent = text;
  overlay.appendChild(label);
  const point = overlayPoint(sim, -24);
  label.style.left = `${point.x}px`;
  label.style.top = `${point.y}px`;
  setTimeout(() => label.remove(), 1800);
}

const needsText = (delta) => Object.entries(delta).filter(([, value]) => value > 0).map(([key, value]) => `+${value} ${NEEDS[key].emoji}`).join('  ');

// ---------- Acciones ----------
function actionLabel(id) {
  const action = SIM_ACTIONS[id];
  const dinner = typeof mealAt === 'function' ? mealAt(todayISO(), 'dinner')?.title : '';
  const movie = typeof plans !== 'undefined' ? plans.find((plan) => plan.status === 'todo' && plan.kind === 'movie')?.title : '';
  if (id === 'cook' && dinner) return `Cocinar ${dinner}`;
  if (id === 'cook') return meKey() === 'matteo' ? 'Cocinar pasta 🍝' : 'Hacer una tortilla';
  if (id === 'tv' && movie) return `Ver «${movie}»`;
  return action.label;
}

function setProp(prop, on) {
  if (!prop) return;
  const svg = simsHouse.querySelector('.sims-svg');
  if (on) svg.dataset[prop] = 'on';
  else delete svg.dataset[prop];
}

async function doAction(key, id, { autonomous = false } = {}) {
  const sim = sims[key];
  const action = SIM_ACTIONS[id];
  if (!sim || !action) return;
  const own = key === meKey();
  const token = ++sim.token;
  sim.busy = true;
  if (!autonomous) hidePie();
  try {
    if (own) saveAvatar({ activity: id, activity_at: new Date().toISOString() }).catch(() => {});
    if (autonomous) {
      simBubble(sim, `💭 ${action.emoji}`, { kind: 'think', secs: 1.6 });
      await simWait(1200);
      checkToken(sim, token);
    }
    const object = SIM_OBJECTS[action.object];
    await walkTo(sim, object.spot, token);
    if (action.pose === 'lie') placeSim(sim, 82, 150, 0.4);
    if (action.pose === 'bed') placeSim(sim, 74, 146, 0.4);
    if (action.pose === 'hidden') placeSim(sim, 334, 168, 0.3);
    sim.el.dataset.pose = action.pose || 'stand';
    sim.el.dataset.doing = action.doing;
    setProp(action.prop, true);
    const ring = sim.el.querySelector('.sim-progress');
    ring.style.setProperty('--secs', `${action.secs}s`);
    sim.el.classList.add('is-working');
    if (action.say?.[key]) simBubble(sim, sayLine(key, action.say[key]), { secs: 2.8 });
    else if (action.talk) simBubble(sim, simlish(key), { secs: 2.2 });
    if (action.doing === 'dance' || action.doing === 'sing') simBlip(523, 0.12);
    for (let elapsed = 0; elapsed < action.secs * 1000; elapsed += 500) {
      await simWait(500);
      checkToken(sim, token);
      if (action.zzz && elapsed % 2000 === 0) simBubble(sim, '💤', { kind: 'emote', secs: 1.6 });
      if (action.talk && elapsed > 0 && elapsed % 2500 === 0) simBubble(sim, Math.random() < 0.5 ? simlish(key) : `${pickOne(CHAT_EMOJIS)}${pickOne(CHAT_EMOJIS)}`, { secs: 2 });
    }
    finishPose(sim, action);
    if (own && action.needs) {
      await boostNeeds(action.needs).catch(() => {});
      const text = needsText(action.needs);
      if (text) simFloat(sim, text);
      simBlip(880, 0.1);
    }
    if (own && action.after) runAfter(action.after);
  } catch (error) {
    setProp(action.prop, false);
    if (['walk', 'idle'].includes(sim.el.dataset.doing)) sim.el.classList.remove('is-working');
    // Si otra orden ha tomado el relevo, esa decide dónde y cómo queda el muñeco.
    if (error !== SIM_CANCELLED) {
      console.warn('[Umbral] Sims:', error);
      finishPose(sim, action);
    }
  } finally {
    if (sim.token === token) {
      sim.busy = false;
      sim.idleSince = Date.now();
    }
  }
}

function finishPose(sim, action) {
  setProp(action?.prop, false);
  sim.el.classList.remove('is-working');
  sim.el.dataset.doing = 'idle';
  if (sim.el.dataset.pose !== 'stand') {
    sim.el.dataset.pose = 'stand';
    const spot = SIM_OBJECTS[action?.object]?.spot;
    if (spot) placeSim(sim, spot.x, FLOOR_Y[spot.floor], 0.4);
  }
}

function runAfter(after) {
  if (after === 'dress') openAvatarEditor('clothes');
  if (after === 'photos') {
    closeSims();
    setTimeout(() => showView('nosotros'), 250);
  }
  if (after === 'costume') {
    const person = myAvatarPerson();
    const look = avatarLook(person);
    const options = Object.keys(avatarCatalog().OUTFITS).filter((id) => id !== 'casual' && id !== look.outfit);
    const outfit = pickOne(options);
    saveAvatar({ look: { ...look, outfit } }).then(() => {
      const info = avatarCatalog().OUTFITS[outfit];
      simBubble(sims[meKey()], `¡Ahora voy de ${info.label.toLowerCase()}! ${info.emoji}`, { secs: 3 });
    }).catch((error) => showToast(error.message || 'No se pudo guardar'));
  }
}

// Interacción entre los dos. incoming: la ha empezado el otro (llega por 'umbral:poke').
async function doSocial(kind, { incoming = false } = {}) {
  const me = sims[meKey()];
  const partner = sims[partnerKeyOf()];
  if (!me || !partner) return;
  const actor = incoming ? partner : me;
  const target = incoming ? me : partner;
  const tokens = [++me.token, ++partner.token];
  me.busy = true;
  partner.busy = true;
  hidePie();
  const poke = avatarCatalog().POKES[kind];
  const actorKey = actor.el.dataset.sim;
  const targetKey = target.el.dataset.sim;
  try {
    target.el.dataset.doing = 'idle';
    if (kind === 'selfie') {
      // Los dos al espejo del dormitorio: Matteo detrás abrazando a Ines, como en la foto.
      const spot = SIM_OBJECTS.mirror.spot;
      const place = (sim) => ({ ...spot, x: spot.x + (sim.el.dataset.sim === 'matteo' ? -9 : 3) });
      await Promise.all([walkTo(me, place(me), tokens[0]), walkTo(partner, place(partner), tokens[1])]);
      const front = sims.ines || actor;
      front.el.parentNode.appendChild(front.el);
      [me, partner].forEach((sim) => faceSim(sim, 1));
    } else {
      const side = actor.x <= target.x || target.x > ROOM_LIMITS[target.floor][1] - 24 ? -1 : 1;
      const x = Math.min(Math.max(target.x + side * 22, ROOM_LIMITS[target.floor][0]), ROOM_LIMITS[target.floor][1]);
      await walkTo(actor, { floor: target.floor, x }, actor === me ? tokens[0] : tokens[1]);
      faceSim(actor, actor.x < target.x ? 1 : -1);
      faceSim(target, target.x < actor.x ? 1 : -1);
    }
    [actor, target].forEach((sim) => { sim.el.dataset.doing = `social-${kind}`; });
    target.el.dataset.role = 'target';
    actor.el.dataset.role = 'actor';
    simBlip(740, 0.12);
    if (kind === 'chat') {
      for (let turn = 0; turn < 4; turn += 1) {
        const speaker = turn % 2 ? target : actor;
        simBubble(speaker, Math.random() < 0.6 ? simlish(speaker.el.dataset.sim) : `${pickOne(CHAT_EMOJIS)}${pickOne(CHAT_EMOJIS)}`, { secs: 1.5 });
        await simWait(1500);
      }
    } else if (kind === 'selfie') {
      simBubble(sims.ines || actor, sayLine('ines', ['¡Sonríe, tiburón! 📸', '¡Patata!']), { secs: 2 });
      await simWait(1600);
      simBubble(sims.matteo || target, sayLine('matteo', ['Cheese! 😁', 'Bellissimi!']), { secs: 1.8 });
      await simWait(1400);
      selfieFlash();
      await simWait(900);
      simBubble(actor, '📸', { kind: 'emote', secs: 2 });
      simBubble(target, '❤️', { kind: 'emote', secs: 2 });
      await simWait(2400);
    } else if (kind === 'shark') {
      simBubble(actor, sayLine(actorKey, SHARK_LINES[actorKey] || SHARK_LINES.ines), { secs: 2.4 });
      jawsTheme();
      await simWait(2600);
      simBubble(target, sayLine(targetKey, SHARK_VICTIM[targetKey] || SHARK_VICTIM.ines), { secs: 2.2 });
      simBubble(actor, '🦈', { kind: 'emote', secs: 2 });
      await simWait(2600);
    } else {
      simBubble(actor, `${poke.emoji}`, { kind: 'emote', secs: 2.4 });
      if (kind === 'compliment') {
        await simWait(400);
        simBubble(actor, sayLine(actorKey, COMPLIMENTS[actorKey] || COMPLIMENTS.ines), { secs: 2.8 });
      }
      if (kind === 'kiss' || kind === 'hug') setTimeout(() => simBubble(target, sayLine(targetKey, targetKey === 'matteo' ? ['Ti amo ❤️', 'Amore…'] : ['Te quiero ❤️', 'Mi tiburón…']), { secs: 2 }), 2200);
      await simWait(5000);
    }
    if (!incoming) {
      const person = myAvatarPerson();
      await boostNeeds({ social: 25, fun: kind === 'dance' ? 20 : 5 }, { poke: kind, poke_at: new Date().toISOString() });
      notifyHousehold(`${poke.emoji} ${person} ${poke.text}`, 'Abre Umbral para verlo en vuestra casa', { open: 'home', tag: 'avatar-poke' });
      simFloat(me, `+25 ${NEEDS.social.emoji}`);
    } else {
      simFloat(me, `+20 ${NEEDS.social.emoji}`);
    }
  } catch (error) {
    if (error !== SIM_CANCELLED) showToast(error.message || 'No se pudo guardar');
  } finally {
    [me, partner].forEach((sim) => {
      sim.el.dataset.doing = 'idle';
      delete sim.el.dataset.role;
      faceSim(sim, 1);
      sim.busy = false;
      sim.idleSince = Date.now();
    });
  }
}

function selfieFlash() {
  simBlip(1500, 0.05);
  const flash = document.createElement('div');
  flash.className = 'sims-flash';
  simsHouse.appendChild(flash);
  setTimeout(() => flash.remove(), 700);
}

// ---------- Andar tocando el suelo ----------
function svgPoint(event) {
  const svg = simsHouse.querySelector('.sims-svg');
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

async function walkHere(event) {
  const { x, y } = svgPoint(event);
  // Planta de arriba (dormitorio y baño) o de abajo (cocina y salón); fuera de la casa, nada.
  const floor = y >= 54 && y < 176 ? 1 : y >= 176 && y < 312 ? 0 : null;
  if (floor === null || x < 4 || x > 396) return;
  const [min, max] = ROOM_LIMITS[floor];
  const spot = { floor, x: Math.min(Math.max(x, min), max) };
  const sim = sims[meKey()];
  if (!sim) return;
  const target = simsHouse.querySelector('.sh-target');
  target.setAttribute('transform', `translate(${spot.x} ${FLOOR_Y[floor] - 1})`);
  target.classList.remove('is-on');
  void target.getBoundingClientRect();
  target.classList.add('is-on');
  simBlip(1180, 0.05);
  const token = ++sim.token;
  sim.busy = true;
  sim.el.classList.remove('is-working');
  try {
    await walkTo(sim, spot, token);
  } catch {
    // Otra orden manda.
  } finally {
    if (sim.token === token) {
      sim.busy = false;
      sim.idleSince = Date.now();
    }
  }
}

// ---------- Menú circular (como en los Sims) ----------
function hidePie() {
  simsHouse.querySelector('.sims-pie')?.remove();
}

function showPie(event, title, options) {
  hidePie();
  simBlip(990, 0.05);
  const box = simsHouse.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  const pie = document.createElement('div');
  pie.className = 'sims-pie';
  pie.innerHTML = `<div class="sims-pie-title">${escapeHtml(title)}</div>${options.map(([id, label, emoji], index) => `<button type="button" class="sims-pie-option" data-pie="${escapeHtml(id)}" style="--i:${index}"><span>${emoji}</span>${escapeHtml(label)}</button>`).join('')}`;
  simsHouse.appendChild(pie);
  // Las opciones se reparten en círculo alrededor del dedo y no se salen de la casa.
  const radius = Math.max(56, options.length * 13);
  const buttons = [...pie.querySelectorAll('.sims-pie-option')];
  buttons.forEach((button, index) => {
    const angle = (-90 + (360 / buttons.length) * index) * (Math.PI / 180);
    const bx = Math.min(Math.max(x + Math.cos(angle) * radius, button.offsetWidth / 2 + 4), box.width - button.offsetWidth / 2 - 4);
    const by = Math.min(Math.max(y + Math.sin(angle) * radius * 0.8, button.offsetHeight / 2 + 4), box.height - button.offsetHeight / 2 - 4);
    button.style.left = `${bx}px`;
    button.style.top = `${by}px`;
  });
  const title_ = pie.querySelector('.sims-pie-title');
  title_.style.left = `${Math.min(Math.max(x, title_.offsetWidth / 2 + 4), box.width - title_.offsetWidth / 2 - 4)}px`;
  title_.style.top = `${Math.min(Math.max(y, 14), box.height - 14)}px`;
}

function handleHouseTap(event) {
  if (event.target.closest('.sims-pie-option')) return;
  if (event.target.closest('.sims-pie') || !event.target.closest('.sims-svg')) return hidePie();
  const simEl = event.target.closest('[data-sim]');
  const object = event.target.closest('[data-obj]');
  const me = meKey();
  if (simEl && simEl.dataset.sim === me) {
    // Si tu muñeco tapa un objeto, sus acciones también salen en el menú.
    const behind = document.elementsFromPoint(event.clientX, event.clientY).map((element) => element.closest?.('[data-obj]')).find(Boolean);
    const objectOptions = behind && SIM_OBJECTS[behind.dataset.obj] ? SIM_OBJECTS[behind.dataset.obj].actions.map((id) => [`act:${id}`, actionLabel(id), SIM_ACTIONS[id].emoji]) : [];
    const own = [['own:look', 'Cambiar de look', '👕'], ['own:mood', 'Cómo me siento', '😊'], ['own:need', '¿Qué me falta?', '💭'], ['own:wave', 'Saludar', '👋']];
    return showPie(event, `${simPerson(me)} (tú)`, [...objectOptions, ...own].slice(0, 7));
  }
  if (simEl) {
    const catalog = avatarCatalog();
    return showPie(event, simPerson(simEl.dataset.sim), Object.entries(catalog.POKES).map(([id, poke]) => [`social:${id}`, poke.label, poke.emoji]));
  }
  if (object && SIM_OBJECTS[object.dataset.obj]) {
    const info = SIM_OBJECTS[object.dataset.obj];
    const social = (info.social || []).map((id) => [`social:${id}`, `${avatarCatalog().POKES[id].label} con ${simPerson(partnerKeyOf())}`, avatarCatalog().POKES[id].emoji]);
    return showPie(event, info.label, [...info.actions.map((id) => [`act:${id}`, actionLabel(id), SIM_ACTIONS[id].emoji]), ...social]);
  }
  if (simsHouse.querySelector('.sims-pie')) return hidePie();
  walkHere(event);
}

function handlePieChoice(id) {
  hidePie();
  simBlip(1180, 0.06);
  const [type, value] = id.split(':');
  const me = sims[meKey()];
  if (type === 'act') return doAction(meKey(), value);
  if (type === 'social') return doSocial(value);
  if (value === 'look') return openAvatarEditor('clothes');
  if (value === 'mood') return openAvatarEditor('mood');
  if (value === 'wave') {
    me.el.dataset.doing = 'wave';
    simBubble(me, simlish(meKey()));
    setTimeout(() => { if (!me.busy) me.el.dataset.doing = 'idle'; }, 2400);
    return;
  }
  if (value === 'need') {
    const needs = currentNeeds(avatarRows[myAvatarPerson()]);
    const [lowest, amount] = Object.entries(needs).sort((a, b) => a[1] - b[1])[0];
    simBubble(me, amount > 70 ? '💭 ¡Estoy genial! ✨' : `💭 ${NEEDS[lowest].emoji} ${NEEDS[lowest].label.toLowerCase()}…`, { kind: 'think', secs: 2.8 });
  }
}

// ---------- Panel de necesidades ----------
function renderSimsNeeds() {
  const panel = document.querySelector('#simsNeeds');
  if (!panel) return;
  const me = myAvatarPerson();
  const partner = otherPerson(me);
  const person = simsState.needsOf === 'me' ? me : partner;
  const needs = currentNeeds(avatarRows[person]);
  const level = needsLevel(needs);
  const color = (value) => (value > 60 ? 'is-good' : value > 30 ? 'is-mid' : 'is-low');
  panel.innerHTML = `
    <div class="sims-needs-head">
      <div class="segmented">${[[me, 'me'], [partner, 'partner']].map(([name, who]) => `<button type="button" data-needs-who="${who}" aria-pressed="${simsState.needsOf === who}">${escapeHtml(name)}${who === 'me' ? ' (tú)' : ''}</button>`).join('')}</div>
      <span class="sims-plumbob is-${level}" title="Cómo está"></span>
    </div>
    <div class="sims-needs-grid">${Object.entries(NEEDS).map(([key, need]) => `<div class="sims-need"><span class="sims-need-emoji">${need.emoji}</span><div><small>${need.label}</small><span class="sims-need-track"><span class="${color(needs[key])}" style="width:${needs[key]}%"></span></span></div></div>`).join('')}</div>`;
}

// ---------- Abrir, cerrar y libre albedrío ----------
function buildSims() {
  simsHouse.innerHTML = houseMarkup();
  const layer = simsHouse.querySelector('.sims-layer');
  [meKey(), partnerKeyOf()].forEach((key, index) => {
    layer.insertAdjacentHTML('beforeend', simMarkup(key));
    const el = layer.querySelector(`[data-sim="${key}"]`);
    sims[key] = { el, x: 0, y: 0, floor: 0, token: 0, busy: false, idleSince: Date.now() - 6000, seenActivity: '' };
    renderSimBody(key);
    const start = index ? { floor: 0, x: 362 } : { floor: 0, x: 108 };
    placeSim(sims[key], start.x, FLOOR_Y[start.floor]);
    sims[key].floor = start.floor;
  });
  const hour = new Date().getHours();
  simsHouse.querySelector('.sims-svg').dataset.time = hour < 7 || hour >= 21 ? 'night' : hour < 9 || hour >= 19 ? 'dusk' : 'day';
}

function replayPartnerActivity() {
  const key = partnerKeyOf();
  const sim = sims[key];
  const row = avatarRows[simPerson(key)];
  if (!sim || !row?.activity || !row.activity_at || row.activity_at === sim.seenActivity) return;
  sim.seenActivity = row.activity_at;
  if (Date.now() - Date.parse(row.activity_at) > 30 * 60 * 1000 || !SIM_ACTIONS[row.activity]) return;
  doAction(key, row.activity);
}

async function wander(sim) {
  const token = ++sim.token;
  sim.busy = true;
  try {
    const nearby = IDLE_SPOTS.filter((spot) => spot.floor === sim.floor || Math.random() < 0.25);
    await walkTo(sim, pickOne(nearby), token);
    sim.el.dataset.doing = pickOne(['idle', 'stretch', 'phone', 'idle']);
    await simWait(3000);
    checkToken(sim, token);
  } catch {
    // Cancelado: otra orden manda.
  } finally {
    if (sim.token === token) {
      sim.el.dataset.doing = 'idle';
      sim.busy = false;
      sim.idleSince = Date.now();
    }
  }
}

// Quietos en la misma planta, se giran el uno hacia el otro y se miran.
function lookAtEachOther() {
  const pair = [sims[meKey()], sims[partnerKeyOf()]];
  pair.forEach((sim, index) => {
    if (!sim) return;
    const other = pair[1 - index];
    const idle = !sim.busy && sim.el.dataset.doing === 'idle';
    if (idle && other && other.floor === sim.floor && Math.abs(other.x - sim.x) > 6) {
      faceSim(sim, other.x < sim.x ? -1 : 1);
      sim.el.dataset.gaze = Math.abs(other.x - sim.x) < 90 ? 'side' : 'far';
    } else {
      sim.el.dataset.gaze = sim.el.dataset.doing === 'walk' ? 'side' : 'front';
    }
  });
}

function simsTick() {
  if (!simsState.open) return;
  renderSimsNeeds();
  lookAtEachOther();
  // Mientras eliges en el menú, nadie hace nada por su cuenta.
  if (simsHouse.querySelector('.sims-pie')) return;
  const me = meKey();
  [me, partnerKeyOf()].forEach((key) => {
    const sim = sims[key];
    if (!sim || sim.busy) return;
    const idleFor = Date.now() - sim.idleSince;
    if (key === me && idleFor > 14000) {
      const needs = currentNeeds(avatarRows[myAvatarPerson()]);
      const [lowest, amount] = Object.entries(needs).sort((a, b) => a[1] - b[1])[0];
      if (amount < 45) return doAction(key, pickOne(NEED_ACTIONS[lowest]), { autonomous: true });
    }
    if (idleFor > (key === me ? 16000 : 10000)) wander(sim);
  });
}

function openSims() {
  if (!window.umbralScene?.personSvg || !avatarCatalog()) return;
  if (!myAvatarPerson()) return showToast('Elige primero si eres Ines o Matteo');
  buildSims();
  simsState.open = true;
  simsState.tip = Math.floor(Math.random() * SIM_TIPS.length);
  document.querySelector('#simsTip').textContent = SIM_TIPS[simsState.tip];
  updateSoundButton();
  updateZoom();
  renderSimsNeeds();
  simsModal.classList.add('visible');
  if (history.state?.page !== 'sims') history.pushState({ page: 'sims' }, '', '#casa-por-dentro');
  clearInterval(simsState.timer);
  simsState.timer = setInterval(simsTick, 2500);
  setTimeout(() => {
    simBubble(sims[meKey()], simlish(meKey()), { secs: 2 });
    replayPartnerActivity();
  }, 600);
}

function closeSims() {
  if (!simsModal.classList.contains('visible')) return;
  if (history.state?.page === 'sims') history.back();
  else hideSims();
}

function hideSims() {
  simsModal.classList.remove('visible');
  simsState.open = false;
  clearInterval(simsState.timer);
  Object.values(sims).forEach((sim) => { sim.token += 1; });
  try { speechSynthesis.cancel(); } catch {}
}

function updateZoom() {
  simsHouse.classList.toggle('is-zoomed', simsState.zoom);
  const button = document.querySelector('#simsZoom');
  button.setAttribute('aria-pressed', String(simsState.zoom));
  button.setAttribute('aria-label', simsState.zoom ? 'Ver toda la casa' : 'Seguir de cerca a tu muñeco');
  const me = sims[meKey()];
  if (me) followCamera(me);
}

function updateSoundButton() {
  const button = document.querySelector('#simsSound');
  button.setAttribute('aria-pressed', String(simsState.sound));
  button.textContent = simsState.sound ? '🔊' : '🔇';
  button.setAttribute('aria-label', simsState.sound ? 'Quitar el sonido' : 'Poner el sonido');
}

simsHouse.addEventListener('click', (event) => {
  const option = event.target.closest('[data-pie]');
  if (option) return handlePieChoice(option.dataset.pie);
  handleHouseTap(event);
});
document.querySelector('#simsNeeds').addEventListener('click', (event) => {
  const who = event.target.closest('[data-needs-who]');
  if (!who) return;
  simsState.needsOf = who.dataset.needsWho;
  renderSimsNeeds();
});
document.querySelector('#simsSound').addEventListener('click', () => {
  simsState.sound = !simsState.sound;
  try { localStorage.setItem('umbral-sims-sound', simsState.sound ? 'on' : 'off'); } catch {}
  updateSoundButton();
  if (!simsState.sound) try { speechSynthesis.cancel(); } catch {}
});
document.querySelector('#closeSims').addEventListener('click', closeSims);
document.querySelector('#simsZoom').addEventListener('click', () => {
  hidePie();
  simsState.zoom = !simsState.zoom;
  try { localStorage.setItem('umbral-sims-zoom', simsState.zoom ? 'on' : 'off'); } catch {}
  updateZoom();
});
document.querySelector('#simsTip').addEventListener('click', (event) => {
  simsState.tip = (simsState.tip + 1) % SIM_TIPS.length;
  event.currentTarget.textContent = SIM_TIPS[simsState.tip];
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'sims' && history.state?.page !== 'avatar-sheet') hideSims();
});
// Cambios de look, ánimo o actividad (tuyos o del otro, en directo).
window.addEventListener('umbral:avatars', () => {
  if (!simsState.open) return;
  Object.keys(sims).forEach(renderSimBody);
  renderSimsNeeds();
  replayPartnerActivity();
});
// Un toque del otro con la casa abierta: se ve aquí (y no en la escena).
window.addEventListener('umbral:poke', (event) => {
  if (!simsState.open) return;
  event.preventDefault();
  doSocial(event.detail.kind, { incoming: true });
});
