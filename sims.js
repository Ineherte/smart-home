// Modo Sims: vuestra casa por dentro, en corte, con cocina, salón, dormitorio y baño.
// - Tocas un objeto y eliges qué hacer: tu muñeco va andando (sube las escaleras si hace
//   falta), lo hace y suben sus necesidades (avatars.js).
// - Tocas al otro muñeco: abrazo, beso, charla… Le llega al móvil y lo ve en su casa.
// - Libre albedrío: si no le mandas nada y algo le falta, tu muñeco se las apaña solo.
// - Lo que hace cada uno se guarda (activity) y el otro lo ve en directo.
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
  photo: { label: 'Vuestra foto', spot: { floor: 0, x: 300 }, actions: ['photos'] },
  bed: { label: 'Cama', spot: { floor: 1, x: 136 }, actions: ['sleep', 'jump'] },
  wardrobe: { label: 'Armario', spot: { floor: 1, x: 172 }, actions: ['dress', 'costume'] },
  sink: { label: 'Lavabo', spot: { floor: 1, x: 256 }, actions: ['teeth', 'mirror'] },
  shower: { label: 'Ducha', spot: { floor: 1, x: 334 }, actions: ['shower', 'bath'] }
};

// secs: duración; doing: animación; pose: stand/sit/lie/bed/hidden; prop: estado del objeto.
const SIM_ACTIONS = {
  snack: { object: 'fridge', label: 'Picar algo', emoji: '🧀', secs: 5, doing: 'eat', prop: 'fridge', needs: { hunger: 20 } },
  cook: { object: 'stove', label: 'Cocinar', emoji: '🍳', secs: 9, doing: 'cook', prop: 'stove', needs: { hunger: 45, fun: 5 } },
  eat: { object: 'table', label: 'Merendar', emoji: '🥐', secs: 6, doing: 'eat', needs: { hunger: 25, social: 5 } },
  dance: { object: 'radio', label: 'Bailar', emoji: '💃', secs: 8, doing: 'dance', prop: 'radio', needs: { fun: 25, energy: -5 } },
  sing: { object: 'radio', label: 'Cantar a pleno pulmón', emoji: '🎤', secs: 7, doing: 'sing', prop: 'radio', talk: true, needs: { fun: 20 } },
  nap: { object: 'sofa', label: 'Echar una siesta', emoji: '😴', secs: 10, doing: 'nap', pose: 'sit', zzz: true, needs: { energy: 25 } },
  phone: { object: 'sofa', label: 'Mirar el móvil', emoji: '📱', secs: 6, doing: 'phone', pose: 'sit', needs: { fun: 10, social: 5 } },
  tv: { object: 'tv', label: 'Ver la tele', emoji: '📺', secs: 10, doing: 'tv', pose: 'sit', prop: 'tv', needs: { fun: 30 } },
  water: { object: 'plant', label: 'Regar la planta', emoji: '💧', secs: 5, doing: 'water', prop: 'plant', needs: { fun: 10 } },
  talkplant: { object: 'plant', label: 'Hablarle a la planta', emoji: '🌱', secs: 6, doing: 'talk', talk: true, needs: { social: 5, fun: 5 } },
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
const NEED_ACTIONS = { hunger: ['cook', 'snack', 'eat'], energy: ['nap', 'sleep'], fun: ['tv', 'dance', 'jump', 'sing'], hygiene: ['shower', 'teeth', 'bath'], social: ['mirror', 'phone', 'talkplant'] };
// Sitios para pasear sin quedar detrás del sofá, la cama o la bañera.
const IDLE_SPOTS = [{ floor: 0, x: 108 }, { floor: 0, x: 214 }, { floor: 0, x: 362 }, { floor: 1, x: 140 }, { floor: 1, x: 214 }, { floor: 1, x: 272 }];
const SIMLISH = ['¡Sul sul!', 'Dag dag', 'Nooboo', 'Feebee!', '¡Woohoo!', 'Gerbits', 'Vadish', 'Shoo be dee', 'Frobbit', 'Litzergam', 'Yibs!', 'Sna snu', 'Hooba hooba', 'Zib zab', 'Firby nobbin'];
const CHAT_EMOJIS = ['🍕', '❤️', '🏖️', '🐱', '🎬', '😂', '🌮', '✈️', '🎶', '🍝', '☕', '🌙', '👶', '🏡', '🎮', '🐟', '❓', '❗'];
const SIM_TIPS = [
  'Toca un objeto para ver qué puede hacer tu muñeco.',
  'Toca el muñeco del otro para abrazarle, charlar o sacarle a bailar.',
  'Si no le mandas nada, tu muñeco decide solo según lo que necesite (libre albedrío).',
  'Lo que hacéis de verdad en la app (tareas, recetas, fotos, planes) también cuida a vuestros muñecos.',
  'El diamante sobre la cabeza es verde si está bien, amarillo si le falta algo y rojo si está fatal.'
];

const simsModal = document.querySelector('#simsModal');
const simsHouse = document.querySelector('#simsHouse');
const simsState = { open: false, timer: null, needsOf: 'me', tip: 0, sound: true };
try { simsState.sound = localStorage.getItem('umbral-sims-sound') !== 'off'; } catch {}
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

// Simlish: frase inventada con voz aguda o grave según quién hable.
function simlish(key) {
  const phrase = pickOne(SIMLISH);
  if (simsState.sound && 'speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(phrase.replace(/[¡!]/g, ''));
      utterance.pitch = key === 'ines' ? 1.8 : 0.7;
      utterance.rate = 1.35;
      utterance.volume = 0.7;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch {}
  }
  return phrase;
}

// ---------- La casa ----------
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

    ${[[36, 72, 44, 40], [340, 66, 36, 30], [18, 196, 40, 34], [302, 192, 46, 36]].map(([x, y, w, h]) => `<g class="sh-window"><rect class="sh-window-glass" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"></rect><path class="sh-window-bars" d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}"></path><rect class="sh-window-frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"></rect></g>`).join('')}
    <g class="sh-lights">${[[121, 54], [315, 54], [88, 180], [282, 180]].map(([x, y]) => `<path class="sh-lamp-cord" d="M${x} ${y} V${y + 10}"></path><path class="sh-lamp" d="M${x - 7} ${y + 16} q7 -9 14 0 z"></path><circle class="sh-lamp-glow" cx="${x}" cy="${y + 20}" r="26"></circle>`).join('')}</g>

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
    <g class="sh-obj" data-obj="table"><rect class="sh-table" x="124" y="266" width="40" height="4" rx="1.5"></rect><path class="sh-table-legs" d="M130 270 V300 M158 270 V300"></path><circle class="sh-croissant" cx="138" cy="263" r="3"></circle><rect class="sh-cup" x="148" y="259" width="6" height="7" rx="1"></rect><rect class="sh-hit" x="120" y="252" width="48" height="50"></rect></g>

    <!-- Salón -->
    <g class="sh-obj" data-obj="photo"><rect class="sh-photo" x="262" y="200" width="28" height="22" rx="1.5"></rect><path class="sh-photo-heart" transform="translate(276 207) scale(.9)" d="M0 0 c-1.7 -1.7 -4.2 -.4 -3.1 1.7 l3.1 3.1 l3.1 -3.1 c1.1 -2.1 -1.4 -3.4 -3.1 -1.7 z"></path><rect class="sh-hit" x="258" y="196" width="36" height="30"></rect></g>
    <g class="sh-obj" data-obj="radio"><rect class="sh-side-table" x="236" y="282" width="22" height="18"></rect><rect class="sh-radio" x="236" y="272" width="22" height="10" rx="2"></rect><ellipse class="sh-record" cx="245" cy="271" rx="7" ry="1.6"></ellipse><g class="sh-notes"><text x="240" y="262">♪</text><text x="250" y="256">♫</text></g><rect class="sh-hit" x="232" y="250" width="30" height="52"></rect></g>
    <g class="sh-obj" data-obj="sofa"><rect class="sh-sofa" x="262" y="256" width="74" height="30" rx="7"></rect><rect class="sh-cushion" x="268" y="262" width="30" height="14" rx="4"></rect><rect class="sh-cushion" x="300" y="262" width="30" height="14" rx="4"></rect><rect class="sh-hit" x="258" y="252" width="82" height="50"></rect></g>
    <g class="sh-obj" data-obj="tv"><rect class="sh-tv-stand" x="344" y="282" width="38" height="18" rx="1"></rect><rect class="sh-tv" x="346" y="252" width="34" height="26" rx="2"></rect><rect class="sh-tv-screen" x="349" y="255" width="28" height="20" rx="1"></rect><path class="sh-tv-foot" d="M363 278 V282"></path><rect class="sh-hit" x="342" y="248" width="42" height="54"></rect></g>
    <g class="sh-obj" data-obj="plant"><path class="sh-plant-leaf" d="M389 286 q-10 -20 -4 -34 q6 12 4 34 z M390 286 q4 -24 12 -30 q-2 16 -12 30 z M388 286 q-14 -10 -16 -24 q12 8 16 24 z"></path><path class="sh-plant-bird" d="M392 258 l6 -3 l-2 -3 l4 1 l-2 -3 l4 2 l-2 4 z"></path><path class="sh-pot" d="M382 286 h14 l-2 14 h-10 z"></path><g class="sh-drops"><circle cx="384" cy="270" r="1"></circle><circle cx="388" cy="266" r="1"></circle><circle cx="392" cy="272" r="1"></circle></g><rect class="sh-hit" x="370" y="248" width="30" height="54"></rect></g>

    <!-- Dormitorio -->
    <g class="sh-obj" data-obj="bed"><rect class="sh-headboard" x="14" y="124" width="9" height="48" rx="2"></rect><rect class="sh-bed" x="16" y="152" width="106" height="20" rx="2"></rect><rect class="sh-mattress" x="22" y="145" width="98" height="9" rx="3"></rect><rect class="sh-pillow" x="26" y="139" width="22" height="8" rx="4"></rect><rect class="sh-hit" x="12" y="120" width="114" height="54"></rect></g>
    <g class="sh-obj" data-obj="nightstand"><rect class="sh-nightstand" x="126" y="152" width="16" height="20" rx="1"></rect><path class="sh-bedlamp" d="M128 152 h12 l-3 -9 h-6 z"></path><circle class="sh-bedlamp-glow" cx="134" cy="146" r="14"></circle></g>
    <g class="sh-obj" data-obj="wardrobe"><rect class="sh-wardrobe-inside" x="152" y="98" width="42" height="74" rx="2"></rect><path class="sh-clothes" d="M158 106 v26 h7 v-26 z M168 106 v30 h7 v-30 z M178 106 v22 h7 v-22 z"></path><rect class="sh-wardrobe-door sh-door-l" x="150" y="96" width="23" height="76" rx="2"></rect><rect class="sh-wardrobe-door sh-door-r" x="173" y="96" width="23" height="76" rx="2"></rect><path class="sh-knobs" d="M170 134 v4 M176 134 v4"></path><rect class="sh-hit" x="146" y="92" width="54" height="82"></rect></g>

    <!-- Baño -->
    <g class="sh-obj" data-obj="sink"><rect class="sh-mirror" x="246" y="94" width="20" height="30" rx="9"></rect><path class="sh-mirror-shine" d="M251 100 l4 -3 M251 106 l7 -6"></path><rect class="sh-sink-leg" x="253" y="146" width="6" height="26"></rect><rect class="sh-sink" x="244" y="140" width="24" height="8" rx="3"></rect><path class="sh-tap" d="M256 140 v-4 h4"></path><rect class="sh-hit" x="240" y="90" width="32" height="84"></rect></g>
    <g class="sh-obj" data-obj="shower"><path class="sh-shower-pipe" d="M378 172 V82 h-10 v6"></path><rect class="sh-shower-head" x="362" y="88" width="12" height="4" rx="2"></rect><rect class="sh-tub" x="290" y="146" width="94" height="26" rx="7"></rect><g class="sh-shower-water"><path d="M364 94 l-4 44 M368 94 v44 M372 94 l4 44"></path></g><rect class="sh-hit" x="286" y="80" width="104" height="94"></rect></g>

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
  body.setAttribute('style', style);
  body.innerHTML = markup;
}

function placeSim(sim, x, y, secs = 0) {
  sim.el.style.transitionDuration = `${secs}s`;
  sim.el.style.transform = `translate(${x}px, ${y}px)`;
  sim.x = x;
  sim.y = y;
}

const faceSim = (sim, direction) => sim.el.querySelector('.sim-flip').style.setProperty('--flip', String(direction));
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
    if (action.talk) simBubble(sim, simlish(key), { secs: 2.2 });
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
  try {
    const side = actor.x <= target.x || target.x > ROOM_LIMITS[target.floor][1] - 24 ? -1 : 1;
    const x = Math.min(Math.max(target.x + side * 22, ROOM_LIMITS[target.floor][0]), ROOM_LIMITS[target.floor][1]);
    target.el.dataset.doing = 'idle';
    await walkTo(actor, { floor: target.floor, x }, actor === me ? tokens[0] : tokens[1]);
    faceSim(actor, actor.x < target.x ? 1 : -1);
    faceSim(target, target.x < actor.x ? 1 : -1);
    [actor, target].forEach((sim) => { sim.el.dataset.doing = `social-${kind}`; });
    target.el.dataset.role = 'target';
    actor.el.dataset.role = 'actor';
    simBlip(740, 0.12);
    if (kind === 'chat') {
      for (let turn = 0; turn < 4; turn += 1) {
        const speaker = turn % 2 ? target : actor;
        simBubble(speaker, Math.random() < 0.5 ? simlish(speaker.el.dataset.sim) : `${pickOne(CHAT_EMOJIS)}${pickOne(CHAT_EMOJIS)}`, { secs: 1.5 });
        await simWait(1500);
      }
    } else {
      simBubble(actor, `${poke.emoji}`, { kind: 'emote', secs: 2.4 });
      if (kind === 'compliment') simBubble(actor, pickOne(['¡Qué guapa estás hoy!', '¡Eres lo mejor!', '¡Me encanta tu sonrisa!', '¡Te quiero un montón!']).replace('guapa', target.el.dataset.sim === 'matteo' ? 'guapo' : 'guapa'), { secs: 2.6 });
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
      sim.busy = false;
      sim.idleSince = Date.now();
    });
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
    return showPie(event, info.label, info.actions.map((id) => [`act:${id}`, actionLabel(id), SIM_ACTIONS[id].emoji]));
  }
  hidePie();
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

function simsTick() {
  if (!simsState.open) return;
  renderSimsNeeds();
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
