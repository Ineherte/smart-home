// Modo Sims: vuestro piso por dentro, visto desde arriba como en un RPG, con vuestros
// muñecos en pixel art (hojas LPC de assets/sims). El dibujo está en sims-world.js.
// - Tocas un objeto y eliges qué hacer: tu muñeco va andando por las puertas, lo hace y
//   suben sus necesidades (avatars.js). Tocas el suelo y va hasta allí.
// - Tocas al otro muñeco y eliges entre interacciones amistosas, divertidas, románticas,
//   íntimas o de enfado. Le llega al móvil y lo ve en su casa.
// - Parpadean, cambian de cara según lo que hacen o sienten (y su estado de ánimo), se
//   miran, bostezan si tienen sueño y huelen si no se duchan.
// - Libre albedrío: si no le mandas nada y algo le falta, tu muñeco se las apaña solo.
// - Lo que hace cada uno se guarda (activity) y el otro lo ve en directo.
// - Vuestra casa de verdad: sofá verde caqui, alfombra roja, el puzzle de La gran ola, la
//   strelitzia junto al espejo de gota (que os refleja) y vuestras fotos de Nosotros.
// - Ines habla en español y Matteo en italiano (y a veces en simlish); entre ellos,
//   tiburones.
const WALK_SPEED = 62;

const SIM_OBJECTS = {
  fridge: { label: 'Nevera', actions: ['snack'] },
  stove: { label: 'Cocina', actions: ['cook', 'coffee'] },
  ksink: { label: 'Fregadero', actions: ['dishes'] },
  table: { label: 'Mesa', actions: ['eat', 'wine', 'puzzle'] },
  winerack: { label: 'Botellero', actions: ['wine'] },
  radio: { label: 'Tocadiscos', actions: ['dance', 'sing'] },
  sofa: { label: 'Sofá', actions: ['tv', 'games', 'readsofa', 'nap', 'phone'], social: ['cuddle'] },
  tv: { label: 'Tele', actions: ['tv', 'games'] },
  plant: { label: 'Strelitzia', actions: ['water', 'talkplant'] },
  photo: { label: 'Vuestras fotos', actions: ['photos'] },
  photo2: { label: 'Vuestras fotos', actions: ['photos'] },
  polaroids: { label: 'Polaroids', actions: ['photos'] },
  wave: { label: 'La gran ola (vuestro puzzle)', actions: ['admire', 'puzzle'] },
  shark: { label: 'Tiburón de peluche', actions: ['sharkhug', 'sharknap'] },
  mirror: { label: 'Espejo', actions: ['pose'], social: ['selfie'] },
  bed: { label: 'Cama', actions: ['sleep', 'readbed', 'jump'], social: ['spoon', 'woohoo'] },
  wardrobe: { label: 'Armario', actions: ['dress'] },
  sink: { label: 'Lavabo', actions: ['teeth', 'mirror'] },
  shower: { label: 'Bañera', actions: ['shower', 'bath'] },
  washer: { label: 'Lavadora', actions: ['laundry'] },
  bookshelf: { label: 'Librería', actions: ['read', 'readsofa'] },
  window: { label: 'Ventana', actions: ['window'] },
  yoga: { label: 'Esterilla', actions: ['yoga'] },
  desk: { label: 'Escritorio', actions: ['work'] },
  door: { label: 'Puerta de casa', actions: ['goout'] },
  coatrack: { label: 'Perchero', actions: ['goout'] }
};

// Dónde se pone cada uno para usar las cosas (pies del muñeco y hacia dónde mira).
const SPOTS = {
  fridge: { x: 358, y: 92, dir: 'up' },
  stove: { x: 409, y: 88, dir: 'up' },
  ksink: { x: 447, y: 88, dir: 'up' },
  radio: { x: 159, y: 276, dir: 'up' },
  dance: { x: 236, y: 306, dir: 'down' },
  plant: { x: 282, y: 284, dir: 'up' },
  photo: { x: 47, y: 282, dir: 'up' },
  photo2: { x: 128, y: 282, dir: 'up' },
  polaroids: { x: 102, y: 134, dir: 'up' },
  wave: { x: 88, y: 280, dir: 'up' },
  wardrobe: { x: 184, y: 92, dir: 'up' },
  mirror: { x: 317, y: 288, dir: 'up' },
  sink: { x: 317, y: 86, dir: 'up' },
  shower: { x: 262, y: 106, dir: 'up' },
  washer: { x: 296, y: 160, dir: 'right' },
  bookshelf: { x: 409, y: 264, dir: 'up' },
  window: { x: 358, y: 262, dir: 'up' },
  yoga: { x: 366, y: 310, dir: 'down' },
  door: { x: 457, y: 366, dir: 'down' },
  coatrack: { x: 457, y: 366, dir: 'down' }
};
// Sitios con dos plazas: el otro puede estar ya en una.
const SEATS = {
  sofa: [
    { x: 70, y: 260, dir: 'down', sortY: 271, exit: { x: 70, y: 280 } },
    { x: 108, y: 260, dir: 'down', sortY: 271, exit: { x: 108, y: 280 } }
  ],
  cuddle: [
    { x: 82, y: 260, dir: 'down', sortY: 271, exit: { x: 76, y: 280 } },
    { x: 96, y: 260, dir: 'down', sortY: 271, exit: { x: 102, y: 280 } }
  ],
  chair: [
    { x: 352, y: 134, dir: 'right', sortY: 142, exit: { x: 352, y: 158 } },
    { x: 432, y: 134, dir: 'left', sortY: 142, exit: { x: 432, y: 158 } }
  ],
  bed: [
    { x: 88, y: 108, dir: 'down', sortY: 110, exit: { x: 92, y: 134 } },
    { x: 116, y: 108, dir: 'down', sortY: 110, exit: { x: 112, y: 134 } }
  ],
  spoon: [
    { x: 97, y: 108, dir: 'down', sortY: 110, exit: { x: 94, y: 134 } },
    { x: 108, y: 108, dir: 'down', sortY: 110, exit: { x: 110, y: 134 } }
  ],
  desk: [{ x: 262, y: 340, dir: 'down', sortY: 344, exit: { x: 262, y: 318 } }]
};
const SELFIE_SPOTS = { ines: { x: 314, y: 286 }, matteo: { x: 322, y: 296 } };

// secs: duración. anim: [animación, fotogramas, fps] o routine (baile, yoga…). pose: sofa,
// chair, bed, bedsit, bedjump, desk, bath, shower, out. prop: qué cambia en la casa. hold: qué
// lleva en la mano. expr: cara (o lista de caras que van cambiando).
const SIM_ACTIONS = {
  snack: { object: 'fridge', label: 'Picar algo', emoji: '🧀', secs: 5, anim: ['thrust', [0, 1, 2, 3, 3, 2, 1], 5], prop: 'fridge', expr: 'happy', needs: { hunger: 20 } },
  cook: { object: 'stove', label: 'Cocinar', emoji: '🍳', secs: 9, anim: ['thrust', [2, 3, 4, 3], 6], prop: 'stove', expr: [null, 'happy'], needs: { hunger: 45, fun: 5 }, say: { ines: ['¡Tortilla con cebolla, obvio! 🥔', '¿Le echo más sal?', 'Esto huele a gloria'], matteo: ['La pasta al dente! 🤌', 'Mamma mia, che profumo!', 'Niente panna nella carbonara!'] } },
  coffee: { object: 'stove', label: 'Hacer café con la moka', emoji: '☕', secs: 6, anim: ['thrust', [1, 2, 1, 0], 3], prop: 'coffee', after: 'cup', expr: [null, 'happy'], needs: { energy: 20, fun: 5 }, say: { ines: ['Un cafecito y a por el día ☕', '¿Te hago uno, tiburón?'], matteo: ['Un caffè come si deve ☕', 'La moka della nonna'] } },
  dishes: { object: 'ksink', label: 'Fregar los platos', emoji: '🧽', secs: 7, anim: ['thrust', [2, 3, 2, 1], 6], prop: 'dishes', expr: ['eyeroll', null], needs: { hygiene: 10, fun: -5 }, say: { ines: ['¿Otra vez me toca a mí?', 'Venga, que son cuatro platos'], matteo: ['Uffa, i piatti…', 'Tocca sempre a me!'] } },
  eat: { object: 'table', label: 'Merendar', emoji: '🥐', secs: 6, pose: 'chair', expr: 'happy', needs: { hunger: 25, social: 5 } },
  wine: { object: 'table', label: 'Tomar una copa de vino', emoji: '🍷', secs: 8, pose: 'chair', hold: 'wine', expr: ['happy', 'blush'], needs: { fun: 20, social: 10, energy: -5 }, say: { ines: ['¡Un Rioja, por favor! 🍷', 'Salud, tiburón'], matteo: ['Un Chianti, perfetto 🍷', 'Cin cin!'] } },
  dance: { object: 'radio', spot: 'dance', label: 'Bailar', emoji: '💃', secs: 8, routine: 'dance', prop: 'radio', expr: 'happy', needs: { fun: 25, energy: -5 } },
  sing: { object: 'radio', spot: 'dance', label: 'Cantar a pleno pulmón', emoji: '🎤', secs: 7, routine: 'sing', prop: 'radio', talk: true, expr: ['closed', 'happy'], needs: { fun: 20 } },
  nap: { object: 'sofa', label: 'Echar una siesta', emoji: '😴', secs: 10, pose: 'sofa', zzz: true, expr: 'closed', needs: { energy: 25 } },
  phone: { object: 'sofa', label: 'Mirar el móvil', emoji: '📱', secs: 6, pose: 'sofa', hold: 'phone', expr: [null, 'happy'], needs: { fun: 10, social: 5 } },
  tv: { object: 'tv', label: 'Ver la tele', emoji: '📺', secs: 10, pose: 'sofa', prop: 'tv', expr: [null, 'happy', null, 'shock'], needs: { fun: 30 } },
  games: { object: 'tv', label: 'Jugar a la consola', emoji: '🎮', secs: 10, pose: 'sofa', prop: 'games', hold: 'controller', expr: ['happy', 'shock', 'angry', 'happy'], needs: { fun: 35, energy: -5 }, say: { ines: ['¡Te voy a ganar!', '¡No, no, no!'], matteo: ['Dai, dai, dai!', 'Ho vinto! 🏆'] } },
  readsofa: { object: 'sofa', label: 'Leer en el sofá', emoji: '📖', secs: 10, pose: 'sofa', hold: 'book', expr: [null, 'happy'], needs: { fun: 20 } },
  water: { object: 'plant', label: 'Regar la planta', emoji: '💧', secs: 5, anim: ['thrust', [3, 4, 5, 4], 4], hold: 'can', prop: 'plant', expr: 'happy', needs: { fun: 10 } },
  talkplant: { object: 'plant', label: 'Hablarle a la planta', emoji: '🌱', secs: 6, talk: true, expr: 'happy', needs: { social: 5, fun: 5 } },
  admire: { object: 'wave', label: 'Admirar vuestro puzzle', emoji: '🌊', secs: 5, expr: 'happy', needs: { fun: 10, social: 5 }, say: { ines: ['¡Mil piezas, tiburón! 🧩', 'Qué bonito nos quedó 🌊', 'La pieza del cielo me costó…'], matteo: ['Che capolavoro! 🌊', 'Hokusai sarebbe fiero', 'Il prossimo, più difficile!'] } },
  puzzle: { object: 'table', label: 'Empezar otro puzzle', emoji: '🧩', secs: 9, pose: 'chair', prop: 'puzzle', expr: [null, 'eyeroll', 'happy'], needs: { fun: 25 }, say: { ines: ['¿Dónde va esta pieza? 🤔', '¡Primero los bordes!'], matteo: ['Trovata! 🧩', 'Prima i bordi, amore'] } },
  sharkhug: { object: 'shark', label: 'Abrazar al tiburón', emoji: '🦈', secs: 6, pose: 'sofa', hold: 'shark', prop: 'shark', hearts: true, expr: ['closed', 'happy'], needs: { social: 15, fun: 10 }, say: { ines: ['¡Mi tiburoncito! 🦈', 'Te echaba de menos'], matteo: ['Il mio squalo preferito 🦈', 'Abbraccio!'] } },
  sharknap: { object: 'shark', label: 'Siesta con el tiburón', emoji: '😴', secs: 10, pose: 'sofa', hold: 'shark', prop: 'shark', zzz: true, expr: 'closed', needs: { energy: 25, social: 5 } },
  pose: { object: 'mirror', label: 'Posar en el espejo', emoji: '😎', secs: 5, routine: 'pose', expr: ['happy', 'blush'], needs: { fun: 10, social: 5 }, say: { ines: ['¡Qué guapa estoy hoy! ✨', 'Mi mejor perfil 😎'], matteo: ['Bello come il sole 😎', 'Che figo!'] } },
  photos: { object: 'photo', label: 'Mirar vuestras fotos', emoji: '🖼️', secs: 3, expr: 'happy', needs: { social: 10 }, after: 'photos' },
  read: { object: 'bookshelf', label: 'Buscar un libro', emoji: '📚', secs: 6, anim: ['thrust', [0, 1, 2, 1, 0, 0], 3], needs: { fun: 10 }, say: { ines: ['¿Dónde está la novela que empecé?', '¡Este me encanta!'], matteo: ['Ecco il mio libro!', 'Questo è bellissimo'] } },
  window: { object: 'window', label: 'Mirar por la ventana', emoji: '🪟', secs: 6, expr: [null, 'happy'], needs: { fun: 10 }, say: { ines: ['Qué bonito está el barrio', 'Huele a lluvia…'], matteo: ['Che bella giornata', 'Mi manca il mare'] } },
  yoga: { object: 'yoga', label: 'Hacer yoga', emoji: '🧘', secs: 10, routine: 'yoga', expr: 'closed', needs: { energy: 10, fun: 15, hygiene: -5 } },
  work: { object: 'desk', label: 'Trabajar en el portátil', emoji: '💻', secs: 10, pose: 'desk', prop: 'laptop', expr: [null, 'eyeroll', null, 'sad'], needs: { fun: -10, energy: -5 }, say: { ines: ['Una reunión más y lo dejo…', 'Este Excel no cuadra'], matteo: ['Ancora una call…', 'Mamma mia, le mail'] } },
  sleep: { object: 'bed', label: 'Dormir', emoji: '💤', secs: 12, pose: 'bed', zzz: true, expr: 'closed', needs: { energy: 70 } },
  readbed: { object: 'bed', label: 'Leer en la cama', emoji: '📖', secs: 10, pose: 'bedsit', hold: 'book', expr: [null, 'happy', 'closed'], needs: { fun: 15, energy: 10 } },
  jump: { object: 'bed', label: 'Saltar en la cama', emoji: '🤸', secs: 7, pose: 'bedjump', expr: 'happy', needs: { fun: 25, energy: -10 } },
  dress: { object: 'wardrobe', label: 'Cambiar el muñeco del jardín', emoji: '👗', secs: 1.5, prop: 'wardrobe', after: 'dress', own: true },
  teeth: { object: 'sink', label: 'Lavarse los dientes', emoji: '🪥', secs: 5, anim: ['thrust', [1, 2, 1, 2], 8], needs: { hygiene: 20 } },
  mirror: { object: 'sink', label: 'Hablar con el espejo', emoji: '🪞', secs: 6, talk: true, expr: 'happy', needs: { social: 10, fun: 10 } },
  shower: { object: 'shower', label: 'Ducharse', emoji: '🚿', secs: 8, pose: 'shower', prop: 'shower', talk: true, needs: { hygiene: 60 } },
  bath: { object: 'shower', label: 'Baño de espuma', emoji: '🛁', secs: 12, pose: 'bath', prop: 'bath', expr: 'closed', needs: { hygiene: 80, fun: 10 } },
  laundry: { object: 'washer', label: 'Poner una lavadora', emoji: '🧺', secs: 5, anim: ['thrust', [0, 1, 2, 3, 2], 4], prop: 'laundry', propStays: 20000, needs: { hygiene: 25 } },
  goout: { object: 'door', label: 'Salir a dar una vuelta', emoji: '🚶', secs: 14, pose: 'out', expr: 'happy', needs: { fun: 25, social: 15, energy: -10 } }
};
const NEED_ACTIONS = { hunger: ['cook', 'snack', 'eat'], energy: ['nap', 'sleep', 'sharknap', 'coffee'], fun: ['tv', 'games', 'dance', 'jump', 'sing', 'puzzle', 'readsofa', 'yoga', 'window'], hygiene: ['shower', 'teeth', 'bath', 'laundry'], social: ['mirror', 'phone', 'talkplant', 'sharkhug', 'pose', 'wine'] };
const ACTION_VERB = { snack: 'Picando algo', cook: 'Cocinando', coffee: 'Haciendo café', dishes: 'Fregando', eat: 'Merendando', wine: 'Con una copa de vino', dance: 'Bailando', sing: 'Cantando', nap: 'Echando la siesta', phone: 'Con el móvil', tv: 'Viendo la tele', games: 'Jugando a la consola', readsofa: 'Leyendo', water: 'Regando', talkplant: 'Hablando con la planta', admire: 'Mirando el puzzle', puzzle: 'Haciendo un puzzle', sharkhug: 'Abrazando al tiburón', sharknap: 'Siesta con el tiburón', pose: 'Posando', photos: 'Mirando fotos', read: 'Buscando un libro', window: 'Mirando por la ventana', yoga: 'Haciendo yoga', work: 'Trabajando', sleep: 'Durmiendo', readbed: 'Leyendo en la cama', jump: 'Saltando en la cama', dress: 'En el armario', teeth: 'Lavándose los dientes', mirror: 'Hablando con el espejo', shower: 'En la ducha', bath: 'En la bañera', laundry: 'Poniendo una lavadora', goout: 'De paseo' };

// Interacciones entre los dos, por categorías (como en los Sims). needs: lo que le cambia a
// cada uno. dist: a qué distancia se ponen.
const SOCIAL_CATS = [['friendly', 'Amistoso', '😊'], ['fun', 'Divertido', '🎉'], ['romance', 'Romántico', '💕'], ['intimate', 'Íntimo', '🔥'], ['angry', 'Enfado', '😤']];
const SOCIALS = {
  chat: { cat: 'friendly', dist: 20 },
  compliment: { cat: 'friendly', dist: 18 },
  highfive: { cat: 'friendly', dist: 14 },
  selfie: { cat: 'friendly' },
  tickle: { cat: 'fun', dist: 12, needs: { social: 15, fun: 20 } },
  dance: { cat: 'fun', dist: 20, needs: { social: 20, fun: 20 } },
  shark: { cat: 'fun', dist: 14, needs: { social: 15, fun: 20 } },
  pillow: { cat: 'fun', dist: 44, needs: { social: 15, fun: 30 } },
  hug: { cat: 'romance', dist: 13, needs: { social: 25 } },
  kiss: { cat: 'romance', dist: 12, needs: { social: 25, fun: 5 } },
  slowdance: { cat: 'romance', needs: { social: 25, fun: 15 } },
  cuddle: { cat: 'romance', needs: { social: 30, energy: 5 } },
  massage: { cat: 'romance', needs: { social: 20, energy: 15 } },
  makeout: { cat: 'intimate', dist: 11, needs: { social: 30, fun: 15 } },
  spoon: { cat: 'intimate', needs: { social: 25, energy: 40 } },
  woohoo: { cat: 'intimate', needs: { social: 40, fun: 35, energy: -15, hygiene: -15 } },
  argue: { cat: 'angry', dist: 24, needs: { social: -15, fun: -10 } },
  sulk: { cat: 'angry', dist: 26, needs: { social: -10 } },
  apologize: { cat: 'angry', dist: 14, needs: { social: 20 } }
};

// Sitios para pasear cuando no hacen nada.
const IDLE_SPOTS = [{ x: 40, y: 150 }, { x: 150, y: 150 }, { x: 280, y: 150 }, { x: 470, y: 150 }, { x: 236, y: 300 }, { x: 330, y: 330 }, { x: 420, y: 320 }, { x: 180, y: 340 }, { x: 460, y: 280 }];
const SIMLISH = ['¡Sul sul!', 'Dag dag', 'Nooboo', 'Feebee!', '¡Woohoo!', 'Gerbits', 'Vadish', 'Shoo be dee', 'Frobbit', 'Litzergam', 'Yibs!', 'Sna snu', 'Hooba hooba', 'Zib zab', 'Firby nobbin'];
const CHAT_EMOJIS = ['🍕', '❤️', '🏖️', '🐱', '🎬', '😂', '🌮', '✈️', '🎶', '🍝', '☕', '🌙', '🦈', '🏡', '🧩', '🇪🇸', '🇮🇹', '❓', '❗'];
// Cada uno habla en su idioma (y la voz del móvil lo lee con ese acento).
const SIM_VOICES = {
  ines: { lang: 'es-ES', pitch: 1.25, phrases: ['¡Hola, tiburón!', '¿Qué cenamos?', 'Qué bien se está en casa', 'Ay, mi tiburón 🦈', '¿Un café?', '¡Vamos!', 'Te quiero', '¡Me encanta!', '¿Hacemos un puzzle?', 'Venga, va', '¡Qué guay!', 'Madre mía'] },
  matteo: { lang: 'it-IT', pitch: 0.85, phrases: ['Ciao, tiburona!', 'Amore mio', 'Che fame!', 'Andiamo!', 'Mamma mia!', 'Ti amo', 'Dai, dai!', 'Che bello!', 'Un caffè?', 'Bellissima!', 'Allora…', 'Boh 🤷'] }
};
// Frases de cada interacción: [Ines, Matteo].
const LINES = {
  compliment: [['¡Qué guapo estás, tiburón!', 'Me encanta tu sonrisa', 'Te quiero muchísimo ❤️'], ['Sei bellissima, amore!', 'Tiburona mia ❤️', 'Che sorriso!']],
  shark: [['¡Ataque de tiburón! 🦈', '¡Ñam, ñam, tiburón!'], ['Attacco di squalo! 🦈', 'Ti mangio, tiburona!']],
  sharkVictim: [['¡Socorro! 😂', '¡Para, para! 🤣'], ['Aiuto! 😂', 'Basta, basta! 🤣']],
  love: [['Te quiero ❤️', 'Mi tiburón…'], ['Ti amo ❤️', 'Amore…']],
  pillow: [['¡Toma cojinazo! 🛋️', '¡Guerra!'], ['Prendi questo! 🛋️', 'Guerra!']],
  massage: [['Ahh, qué gusto…', 'Un poquito más a la izquierda'], ['Che bello…', 'Ancora, ti prego']],
  argue: [['¡Siempre igual!', '¡No me escuchas!', '¡#@%&!', '¿Otra vez los calcetines por ahí?'], ['Ma dai!', 'Non è vero!', '¡#@%&!', 'Sempre la stessa storia!']],
  sulk: [['¡Hmpf! 😤', 'No te hablo'], ['Uffa! 😤', 'Non ti parlo']],
  sulkVictim: [['¿Qué he hecho? 😟', 'Tiburón…'], ['Che ho fatto? 😟', 'Tiburona…']],
  apologize: [['Perdóname, tiburón 🥺', 'Lo siento mucho'], ['Scusami, tiburona 🥺', 'Mi dispiace tanto']],
  forgive: [['Vaaale… ven aquí 🤍', 'Te perdono'], ['Va bene… vieni qui 🤍', 'Ti perdono']],
  woohoo: [['♪ Ñaca-ñaca ♪'], ['♪ Fiki-fiki ♪']],
  selfie: [['¡Sonríe, tiburón! 📸', '¡Patata!'], ['Cheese! 😁', 'Bellissimi!']]
};
const lineFor = (key, kind) => (LINES[kind] || [[''], ['']])[key === 'matteo' ? 1 : 0];
const SIM_TIPS = [
  'Toca un objeto para ver qué puede hacer tu muñeco.',
  'Toca el suelo y tu muñeco irá andando hasta allí.',
  'Toca al otro muñeco: hay interacciones amistosas, divertidas, románticas, íntimas… y de enfado.',
  'Si discutís, os quedará una nube encima un rato. Pedir perdón lo arregla 🥺',
  'Si no le mandas nada, tu muñeco decide solo según lo que necesite (libre albedrío).',
  'Lo que hacéis de verdad en la app (tareas, recetas, fotos, planes) también cuida a vuestros muñecos.',
  'Las fotos de las paredes son las vuestras de Nosotros. Tócalas para verlas.',
  'Poneos delante del espejo de gota: os refleja. Tócalo para haceros vuestro selfie 🤳',
  'Con la lupa sigues de cerca a tu muñeco por la casa.',
  'De noche se encienden las luces de casa y la tele ilumina el salón.'
];

const simsModal = document.querySelector('#simsModal');
const simsHouse = document.querySelector('#simsHouse');
const simsState = { open: false, timer: null, raf: 0, last: 0, needsOf: 'me', tip: 0, sound: true, zoom: false, world: null, bubbles: [], pieAt: null, photoIndex: 0 };
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
const world = () => simsState.world;
const needsOf = (sim) => currentNeeds(avatarRows[simPerson(sim.key)]);

// ---------- Sonido (opcional) ----------
let simsAudio = null;
function simBlip(freq = 660, duration = 0.08, type = 'sine', volume = 0.07) {
  if (!simsState.sound) return;
  try {
    simsAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = simsAudio.createOscillator();
    const gain = simsAudio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(volume, simsAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, simsAudio.currentTime + duration);
    oscillator.connect(gain).connect(simsAudio.destination);
    oscillator.start();
    oscillator.stop(simsAudio.currentTime + duration);
  } catch {}
}
// Melodías cortas: beso, enfado, música romántica…
async function simTune(notes, gap = 120, type = 'sine') {
  for (const note of notes) {
    if (note) simBlip(note, gap / 900, type);
    await simWait(gap);
  }
}
const SMOOCH = () => simTune([1400, 1800], 70);
const GRUMBLE = () => simTune([180, 150, 170, 130], 110, 'sawtooth');
const ROMANTIC = () => simTune([523, 659, 784, 659, 698, 880, 784], 260, 'triangle');

// Habla con la voz del móvil, en español (Ines) o en italiano (Matteo).
function speak(key, text) {
  if (!simsState.sound || !('speechSynthesis' in window)) return;
  try {
    const voice = SIM_VOICES[key] || SIM_VOICES.ines;
    const clean = text.replace(/[¡!¿#@%&♪]/g, '').replace(/\p{Extended_Pictographic}|‍|️/gu, '').trim();
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
    simBlip(index % 2 ? 87 : 82, 0.22, 'triangle');
    await simWait(Math.max(140, 520 - index * 60));
  }
}

// ---------- Muñecos: animación, caras y movimiento ----------
function newSim(key, x, y) {
  return { key, x, y, dir: 'down', anim: 'idle', frame: 0, play: null, routine: null, path: [], stride: 0, speed: 0, slide: null, headY: y - 48, token: 0, busy: false, idleSince: Date.now() - 6000, seenActivity: '', seat: null, exit: null, current: null, expr: null, face: null, nextBlink: 0, blinkUntil: 0, angryUntil: 0, stormUntil: 0 };
}

// Pone una animación: frames es la lista de fotogramas, fps la velocidad.
function setAnim(sim, anim, { dir = sim.dir, frames, fps = 6, loop = true } = {}) {
  const total = simsWorld.ANIMS[anim]?.frames || 1;
  const list = frames || (anim === 'idle' ? [0, 0, 0, 1, 1, 1] : Array.from({ length: total }, (_, i) => i));
  sim.play = { anim, frames: list, fps, loop, t: 0 };
  sim.anim = anim;
  sim.dir = dir;
  sim.frame = list[0];
}
const idle = (sim, dir = sim.dir) => { sim.routine = null; sim.ox = 0; sim.oy = 0; setAnim(sim, 'idle', { dir, fps: 2 }); };
const faceTo = (sim, other) => {
  const dx = other.x - sim.x;
  const dy = other.y - sim.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
};
const awayFrom = (sim, other) => ({ left: 'right', right: 'left', up: 'down', down: 'up' }[faceTo(sim, other)]);

// Rutinas que cambian cada fotograma: bailar, cantar, posar, reírse, yoga…
const ROUTINES = {
  dance(sim, t) {
    const beat = Math.floor(t / 420);
    sim.dir = ['down', 'left', 'down', 'right'][beat % 4];
    sim.anim = 'emote';
    sim.frame = beat % 2 ? 2 : 0;
    sim.oy = -Math.abs(Math.sin(t / 134)) * 3;
  },
  sing(sim, t) {
    sim.dir = 'down';
    sim.anim = 'spellcast';
    sim.frame = [2, 3, 4, 3][Math.floor(t / 380) % 4];
  },
  pose(sim, t) {
    const beat = Math.floor(t / 900);
    sim.dir = 'up';
    sim.anim = beat % 2 ? 'emote' : 'idle';
    sim.frame = beat % 2 ? 2 : 0;
  },
  laugh(sim, t) {
    sim.anim = 'jump';
    sim.frame = [0, 1, 2, 1][Math.floor(t / 90) % 4];
    sim.ox = Math.sin(t / 40) * 0.8;
  },
  stomp(sim, t) {
    sim.anim = 'idle';
    sim.frame = 0;
    sim.oy = Math.floor(t / 260) % 3 === 0 ? -2 : 0;
  },
  recoil(sim, t) {
    sim.anim = 'idle';
    sim.frame = 0;
    sim.ox = Math.sin(t / 30) * 1.5;
  },
  // Abrazo: se mecen despacio los dos a la vez.
  sway(sim, t) {
    sim.ox = (sim.lean || 0) + Math.sin(t / 420) * 0.8;
  },
  nod(sim, t) {
    sim.oy = Math.floor(t / 300) % 4 === 0 ? 1 : 0;
  },
  yoga(sim, t) {
    const pose = Math.floor(t / 2200) % 3;
    sim.dir = 'down';
    sim.anim = ['emote', 'sit', 'spellcast'][pose];
    sim.frame = [2, 0, 3][pose];
  }
};

// La cara: la que pide la acción, el enfado, el estado de ánimo o cómo están de necesidades.
// Y parpadean cada pocos segundos.
const MOOD_FACE = { happy: 'happy', love: 'blush', excited: 'happy', relaxed: 'happy', party: 'happy', sad: 'sad', grumpy: 'angry', sick: 'sad' };
function faceFor(sim, t, needs) {
  if (sim.hidden) return null;
  if (t > sim.nextBlink) {
    const sleepy = ['tired', 'sleepy'].includes(sim.moodId) || needs.energy < 30;
    sim.blinkUntil = t + (sleepy ? 380 : 130);
    sim.nextBlink = t + (sleepy ? 1500 : 2500) + Math.random() * 3500;
  }
  const base = sim.expr || (sim.angryUntil > Date.now() ? 'angry' : MOOD_FACE[sim.moodId] || (sim.plumbob === 'red' ? 'sad' : null));
  if (t < sim.blinkUntil && base !== 'closed') return 'closed';
  return base;
}

function stepSim(sim, dt, t) {
  const row = avatarRows[simPerson(sim.key)] || {};
  const needs = currentNeeds(row);
  if (sim.path.length) {
    const target = sim.path[0];
    const dx = target.x - sim.x;
    const dy = target.y - sim.y;
    const dist = Math.hypot(dx, dy);
    // Aceleran al arrancar y frenan al llegar; con poca energía van más despacio.
    const top = needs.energy < 25 ? 44 : WALK_SPEED;
    sim.speed = Math.min(top, sim.speed + 260 * dt);
    if (sim.path.length === 1 && dist < 14) sim.speed = Math.max(18, Math.min(sim.speed, (top * dist) / 14));
    const step = sim.speed * dt;
    if (dist > 0.5) sim.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    if (dist <= step) {
      sim.x = target.x;
      sim.y = target.y;
      sim.path.shift();
    } else {
      sim.x += (dx / dist) * step;
      sim.y += (dy / dist) * step;
    }
    sim.stride += Math.min(step, dist);
    sim.anim = 'walk';
    sim.frame = 1 + (Math.floor(sim.stride / 4.5) % 8);
    // Pasitos suaves (solo los tuyos).
    if (sim.key === meKey() && Math.floor(sim.stride / 18) !== sim.lastStep) {
      sim.lastStep = Math.floor(sim.stride / 18);
      simBlip(140 + Math.random() * 30, 0.03, 'triangle', 0.04);
    }
    if (!sim.path.length) {
      sim.speed = 0;
      idle(sim);
      const resolve = sim.walkResolve;
      sim.walkResolve = null;
      resolve?.();
    }
  } else if (sim.slide) {
    const s = sim.slide;
    s.t = Math.min(1, s.t + dt / s.dur);
    const e = s.t * (2 - s.t);
    sim.x = s.fx + (s.tx - s.fx) * e;
    sim.y = s.fy + (s.ty - s.fy) * e - (s.hop ? Math.sin(s.t * Math.PI) * s.hop : 0);
    if (s.t >= 1) sim.slide = null;
  }
  if (!sim.path.length) {
    if (sim.routine) ROUTINES[sim.routine]?.(sim, t);
    else if (sim.play) {
      const p = sim.play;
      p.t += dt;
      const index = Math.floor(p.t * p.fps);
      sim.frame = p.frames[p.loop ? index % p.frames.length : Math.min(index, p.frames.length - 1)];
    }
    if (sim.extraRoutine) ROUTINES[sim.extraRoutine]?.(sim, t);
  }
  sim.headY = sim.y - (sim.anim === 'sit' ? 50 : 48) + (sim.oy || 0);
  sim.plumbob = needsLevel(needs);
  sim.moodId = row.mood || null;
  sim.mood = avatarCatalog()?.MOODS[row.mood]?.emoji || '';
  sim.stinky = needs.hygiene < 25 && !sim.hidden && sim.current?.pose !== 'bath';
  sim.storm = sim.stormUntil > Date.now();
  sim.face = faceFor(sim, t, needs);
}

const checkToken = (sim, token) => { if (sim.token !== token) throw SIM_CANCELLED; };

// Levanta al muñeco de donde esté (sofá, cama, bañera…) y lo deja de pie al lado.
function standUp(sim) {
  const exit = sim.exit;
  Object.assign(sim, { hidden: false, clipY: null, sortY: null, shadow: true, prop: null, seat: null, exit: null, routine: null, extraRoutine: null, ox: 0, oy: 0, lean: 0, expr: null });
  if (sim.propOn) setProp(sim.propOn, false);
  sim.propOn = null;
  sim.current = null;
  if (exit) {
    sim.x = exit.x;
    sim.y = exit.y;
    sim.slide = null;
  }
  idle(sim);
}

// Suaviza las esquinas del camino (Chaikin) para que no giren en seco.
function smoothPath(start, points) {
  if (points.length < 2) return points;
  const all = [{ x: start.x, y: start.y }, ...points];
  const out = [];
  for (let i = 1; i < all.length - 1; i += 1) {
    const [p, q, r] = [all[i - 1], all[i], all[i + 1]];
    const a = { x: q.x + (p.x - q.x) * 0.25, y: q.y + (p.y - q.y) * 0.25 };
    const b = { x: q.x + (r.x - q.x) * 0.25, y: q.y + (r.y - q.y) * 0.25 };
    if (simsWorld.free(a.x, a.y) && simsWorld.free(b.x, b.y)) out.push(a, b);
    else out.push(q);
  }
  out.push(all.at(-1));
  return out;
}

function walkTo(sim, spot, token, { keepProp = false } = {}) {
  const prop = sim.prop;
  standUp(sim);
  if (keepProp) sim.prop = prop;
  sim.walkResolve?.();
  return new Promise((resolve) => {
    sim.path = smoothPath(sim, simsWorld.findPath(sim, spot));
    sim.walkResolve = resolve;
    sim.walkToken = token;
    if (!sim.path.length) {
      sim.walkResolve = null;
      resolve();
    }
  }).then(() => {
    checkToken(sim, token);
    if (spot.dir) idle(sim, spot.dir);
  });
}

// Un pasito directo (sin buscar camino), para acercarse en un abrazo o un beso.
function stepTo(sim, point, token) {
  sim.walkResolve?.();
  return new Promise((resolve) => {
    sim.path = [point];
    sim.walkResolve = resolve;
    sim.walkToken = token;
  }).then(() => checkToken(sim, token));
}

// Para en seco (otra orden manda).
function stopSim(sim) {
  sim.path = [];
  sim.speed = 0;
  const resolve = sim.walkResolve;
  sim.walkResolve = null;
  resolve?.();
}

// ---------- Bocadillos, pensamientos y números que suben (siguen al muñeco) ----------
function placeOverlay(item) {
  const w = world();
  if (!w || !item.el.isConnected) return;
  const point = w.toScreen(item.sim.x, item.sim.headY - item.offset);
  const half = item.el.offsetWidth / 2;
  item.el.style.left = `${Math.min(Math.max(point.x, half + 4), point.width - half - 4)}px`;
  item.el.style.top = `${Math.max(item.el.offsetHeight + 4, point.y)}px`;
}

function simBubble(sim, text, { kind = 'say', secs = 2.6 } = {}) {
  const w = world();
  if (!w || !sim || !text) return;
  // Un bocadillo nuevo del mismo muñeco sustituye al anterior.
  simsState.bubbles.filter((item) => item.sim === sim && item.kind !== 'float').forEach((item) => item.el.remove());
  const bubble = document.createElement('div');
  bubble.className = `sim-bubble is-${kind}`;
  bubble.textContent = text;
  w.overlay.appendChild(bubble);
  const item = { el: bubble, sim, offset: 8, kind };
  simsState.bubbles.push(item);
  placeOverlay(item);
  setTimeout(() => {
    bubble.remove();
    simsState.bubbles = simsState.bubbles.filter((other) => other !== item);
  }, secs * 1000);
}

function simFloat(sim, text) {
  const w = world();
  if (!w || !sim || !text) return;
  const label = document.createElement('div');
  label.className = `sim-float${text.includes('-') ? ' is-down' : ''}`;
  label.textContent = text;
  w.overlay.appendChild(label);
  const item = { el: label, sim, offset: 16, kind: 'float' };
  simsState.bubbles.push(item);
  placeOverlay(item);
  setTimeout(() => {
    label.remove();
    simsState.bubbles = simsState.bubbles.filter((other) => other !== item);
  }, 1800);
}

const needsText = (delta) => Object.entries(delta).filter(([, value]) => value).map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${NEEDS[key].emoji}`).join('  ');

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

// Encendido/apagado de cosas de la casa (tele, nevera, fogones, ducha…). Varios muñecos
// pueden usar la misma: se apaga cuando nadie la usa.
const propUsers = {};
function setProp(prop, on) {
  if (!prop) return;
  propUsers[prop] = Math.max(0, (propUsers[prop] || 0) + (on ? 1 : -1));
  const w = world();
  if (w) w.state.props[prop] = propUsers[prop] > 0;
}

// Plaza libre (el otro puede estar en una).
const SEAT_GROUP = { sofa: 'sofa', cuddle: 'sofa', bed: 'bed', spoon: 'bed', chair: 'chair', desk: 'desk' };
function claimSeat(sim, kind, preferred = 0) {
  const other = Object.values(sims).find((s) => s !== sim);
  const seats = SEATS[kind];
  const taken = other?.seat && SEAT_GROUP[other.seat.kind] === SEAT_GROUP[kind] ? other.seat.index : -1;
  const index = seats.length === 1 ? 0 : preferred !== taken ? preferred : 1 - preferred;
  return { ...seats[index], kind, index };
}

// Dónde se pone y cómo se coloca para cada acción.
function placeFor(sim, action) {
  const seatKind = { sofa: 'sofa', chair: 'chair', bed: 'bed', bedsit: 'bed', bedjump: 'bed', desk: 'desk' }[action.pose];
  if (seatKind) {
    const seat = claimSeat(sim, seatKind, action.hold === 'shark' ? 1 : 0);
    return { approach: { ...seat.exit, dir: seatKind === 'chair' ? seat.dir : 'up' }, seat };
  }
  if (action.pose === 'bath' || action.pose === 'shower') return { approach: SPOTS.shower };
  return { approach: SPOTS[action.spot || action.object] || SPOTS[action.object] };
}

// Sentarse o tumbarse (con un saltito suave).
function sitOn(sim, seat, pose = 'sit') {
  sim.seat = seat;
  sim.exit = seat.exit;
  sim.sortY = seat.sortY;
  sim.shadow = false;
  sim.slide = { fx: sim.x, fy: sim.y, tx: seat.x, ty: seat.y, t: 0, dur: 0.4, hop: 3 };
  if (pose === 'lie') setAnim(sim, 'idle', { dir: 'down', frames: [0], fps: 1 });
  else setAnim(sim, 'sit', { dir: seat.dir, frames: [2], fps: 1 });
}

function enterPose(sim, action, place) {
  sim.current = action;
  sim.prop = action.hold || null;
  sim.exit = null;
  const seat = place.seat;
  if (seat) {
    if (action.pose === 'bed') return sitOn(sim, seat, 'lie');
    if (action.pose === 'bedjump') {
      sitOn(sim, seat);
      sim.slide = { fx: sim.x, fy: sim.y, tx: 102, ty: 104, t: 0, dur: 0.4, hop: 6 };
      sim.sortY = 125;
      sim.shadow = true;
      return setAnim(sim, 'jump', { dir: 'down', fps: 8 });
    }
    sitOn(sim, seat);
    if (action.pose === 'bedsit') sim.sortY = 125;
    return;
  }
  if (action.pose === 'shower' || action.pose === 'out') {
    sim.exit = { x: sim.x, y: sim.y };
    sim.hidden = true;
    return;
  }
  if (action.pose === 'bath') {
    sim.exit = { x: sim.x, y: sim.y };
    sim.slide = { fx: sim.x, fy: sim.y, tx: 262, ty: 86, t: 0, dur: 0.4, hop: 4 };
    Object.assign(sim, { sortY: 80, clipY: 66, shadow: false });
    setAnim(sim, 'idle', { dir: 'down', fps: 2 });
    return;
  }
  if (action.routine) {
    sim.routine = action.routine;
    return;
  }
  const [anim, frames, fps] = action.anim || ['idle', null, 2];
  setAnim(sim, anim, { dir: place.approach.dir || sim.dir, frames: frames || undefined, fps });
}

// Efectos mientras dura: corazones, zetas, notas, vapor, gotas…
function actionEffects(sim, action, elapsed) {
  const w = world();
  if (!w) return;
  if (action.zzz && elapsed % 900 < 300) w.emit('z', sim.x + 6, sim.headY + 4, { vy: -14 });
  if (action.hearts && elapsed % 800 < 300) w.emit('heart', sim.x, sim.headY + 6, { vy: -16 });
  if (action.prop === 'radio' && elapsed % 600 < 300) w.emit('note', 156, 230, { vy: -16, spread: 10 });
  if (action.prop === 'stove' && elapsed % 500 < 300) w.emit('puff', 400, 28, { vy: -10, spread: 6 });
  if (action.prop === 'coffee' && elapsed % 600 < 300) w.emit('puff', 416, 34, { vy: -10, spread: 4 });
  if ((action.prop === 'shower' || action.prop === 'bath') && elapsed % 700 < 300) w.emit('puff', 264, 50, { vy: -8, spread: 30 });
  if (action.prop === 'plant') w.emit('drop', 282, 222, { vy: 30, spread: 10 });
  if (action.routine === 'dance' && elapsed % 1200 < 300) w.emit('note', sim.x, sim.headY, { vy: -14, spread: 14 });
  if (action.routine === 'yoga' && elapsed % 1500 < 300) w.emit('sparkle', sim.x, sim.headY + 10, { vy: -8, spread: 16 });
  if (action.object === 'window' && elapsed % 1400 < 300) w.emit('sparkle', 358, 210, { vy: -6, spread: 20 });
}

async function doAction(key, id, { autonomous = false } = {}) {
  const sim = sims[key];
  const action = SIM_ACTIONS[id];
  if (!sim || !action) return;
  const own = key === meKey();
  const token = ++sim.token;
  sim.busy = true;
  sim.doing = id;
  sim.progress = { start: 0, secs: action.secs };
  if (!autonomous) hidePie();
  let entered = false;
  try {
    if (own) saveAvatar({ activity: id, activity_at: new Date().toISOString() }).catch(() => {});
    if (autonomous) {
      simBubble(sim, `💭 ${action.emoji}`, { kind: 'think', secs: 1.6 });
      await simWait(1200);
      checkToken(sim, token);
    }
    const place = placeFor(sim, action);
    await walkTo(sim, place.approach, token);
    enterPose(sim, action, place);
    entered = true;
    setProp(action.prop, true);
    if (action.propStays) setTimeout(() => setProp(action.prop, false), action.propStays);
    else sim.propOn = action.prop || null;
    sim.progress = { start: performance.now(), secs: action.secs };
    const faces = [].concat(action.expr ?? null);
    sim.expr = faces[0];
    if (action.say?.[key]) simBubble(sim, sayLine(key, action.say[key]), { secs: 2.8 });
    else if (action.talk) simBubble(sim, simlish(key), { secs: 2.2 });
    if (action.prop === 'radio') simBlip(523, 0.12);
    for (let elapsed = 0; elapsed < action.secs * 1000; elapsed += 300) {
      await simWait(300);
      checkToken(sim, token);
      actionEffects(sim, action, elapsed);
      if (faces.length > 1 && elapsed % 2100 === 0) sim.expr = faces[(elapsed / 2100) % faces.length];
      if (action.talk && elapsed > 0 && elapsed % 2700 === 0) simBubble(sim, Math.random() < 0.5 ? simlish(key) : `${pickOne(CHAT_EMOJIS)}${pickOne(CHAT_EMOJIS)}`, { secs: 2 });
    }
    standUp(sim);
    entered = false;
    if (id === 'goout') simBubble(sim, key === 'matteo' ? 'Che bella passeggiata! ☀️' : '¡Qué buen paseo! ☀️', { secs: 2.6 });
    if (own && action.needs) {
      await boostNeeds(action.needs).catch(() => {});
      const text = needsText(action.needs);
      if (text) simFloat(sim, text);
      simBlip(880, 0.1);
    }
    if (own && action.after) runAfter(action.after, sim);
  } catch (error) {
    // Si otra orden ha tomado el relevo, esa decide dónde y cómo queda el muñeco.
    if (entered && sim.current === action && error !== SIM_CANCELLED) standUp(sim);
    if (error !== SIM_CANCELLED) console.warn('[Umbral] Sims:', error);
  } finally {
    if (sim.token === token) {
      sim.busy = false;
      sim.doing = null;
      sim.progress = null;
      sim.idleSince = Date.now();
    }
  }
}

function runAfter(after, sim) {
  if (after === 'dress') openAvatarEditor('clothes');
  if (after === 'photos') showPhotoCard();
  // Se queda un ratito con la taza de café en la mano.
  if (after === 'cup' && sim) {
    sim.prop = 'cup';
    setTimeout(() => { if (sim.prop === 'cup' && !sim.busy) sim.prop = null; }, 9000);
  }
}

// ---------- Vuestras fotos ----------
const momentList = () => (typeof moments !== 'undefined' && Array.isArray(moments) ? moments.filter((moment) => moment.path) : []);

async function loadSimsPhotos() {
  try {
    if (typeof usLoaded !== 'undefined' && !usLoaded && typeof loadUs === 'function') await loadUs();
    const list = momentList().slice(0, 11);
    if (!list.length || typeof photoUrls !== 'function') return;
    const urls = await photoUrls(list.map((moment) => moment.path));
    const images = await Promise.all(list.map((moment) => new Promise((resolve) => {
      const url = urls.get(moment.path);
      if (!url) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    })));
    if (simsState.open) world()?.setPhotos(images);
  } catch (error) {
    console.warn('[Umbral] Fotos de la casa:', error);
  }
}

// Una polaroid grande con la foto de verdad, su pie y la fecha.
async function showPhotoCard() {
  const list = momentList();
  if (!list.length) {
    closeSims();
    setTimeout(() => showView('nosotros'), 250);
    return;
  }
  simsHouse.querySelector('.sims-photo-card')?.remove();
  const moment = list[simsState.photoIndex % list.length];
  const urls = typeof photoUrls === 'function' ? await photoUrls([moment.path]) : new Map();
  const date = typeof financeDate === 'function' ? financeDate(moment.day) : moment.day;
  const card = document.createElement('div');
  card.className = 'sims-photo-card';
  card.innerHTML = `<figure><img alt="" src="${escapeHtml(urls.get(moment.path) || '')}" /><figcaption>${moment.caption ? escapeHtml(moment.caption) : ''}<small>${escapeHtml(date || '')}</small></figcaption></figure>
    <div class="sims-photo-actions">${list.length > 1 ? '<button type="button" data-photo-next>Otra foto</button>' : ''}<button type="button" data-photo-album>Ver el álbum</button></div>`;
  simsHouse.appendChild(card);
}

// ---------- Interacciones entre los dos ----------
// incoming: la ha empezado el otro (llega por 'umbral:poke').
async function doSocial(kind, { incoming = false } = {}) {
  const me = sims[meKey()];
  const partner = sims[partnerKeyOf()];
  if (!me || !partner || !SOCIALS[kind]) return;
  const config = SOCIALS[kind];
  const actor = incoming ? partner : me;
  const target = incoming ? me : partner;
  const tokens = [++me.token, ++partner.token];
  const tokenOf = (sim) => (sim === me ? tokens[0] : tokens[1]);
  [me, partner].forEach((sim) => { sim.busy = true; sim.doing = `social-${kind}`; sim.progress = null; stopSim(sim); });
  hidePie();
  const poke = avatarCatalog().POKES[kind] || { emoji: '💬', text: '' };
  const w = world();
  const both = [actor, target];
  const other = (sim) => (sim === actor ? target : actor);
  const mid = () => ({ x: (actor.x + target.x) / 2, y: Math.min(actor.headY, target.headY) });
  const say = (sim, linesKind, secs = 2.4) => simBubble(sim, sayLine(sim.key, lineFor(sim.key, linesKind)), { secs });
  const alive = () => { checkToken(actor, tokenOf(actor)); checkToken(target, tokenOf(target)); };
  const loop = async (ms, every, fn) => { for (let t = 0; t < ms; t += every) { await simWait(every); alive(); fn(t); } };
  try {
    // ¿Se van a algún sitio concreto o se acerca uno al otro?
    if (kind === 'selfie') {
      await Promise.all(both.map((sim) => walkTo(sim, { ...SELFIE_SPOTS[sim.key], dir: 'up' }, tokenOf(sim))));
    } else if (kind === 'cuddle' || kind === 'spoon' || kind === 'woohoo') {
      const seatKind = kind === 'cuddle' ? 'cuddle' : 'spoon';
      await Promise.all(both.map((sim, i) => walkTo(sim, { ...SEATS[seatKind][i].exit, dir: 'up' }, tokenOf(sim))));
      both.forEach((sim, i) => sitOn(sim, { ...SEATS[seatKind][i], kind: seatKind, index: i }, kind === 'cuddle' ? 'sit' : 'lie'));
      await simWait(500);
    } else if (kind === 'massage') {
      const seat = { ...SEATS.chair[1], kind: 'chair', index: 1 };
      await Promise.all([walkTo(target, { ...seat.exit, dir: 'up' }, tokenOf(target)), walkTo(actor, { x: 448, y: 156, dir: 'up' }, tokenOf(actor))]);
      sitOn(target, seat);
      await stepTo(actor, { x: 447, y: 136 }, tokenOf(actor));
      idle(actor, 'left');
    } else if (kind === 'slowdance') {
      await Promise.all([walkTo(actor, { x: 228, y: 306 }, tokenOf(actor)), walkTo(target, { x: 244, y: 306 }, tokenOf(target))]);
    } else {
      standUp(target);
      if (kind === 'pillow') {
        // Primero coge un cojín del sofá.
        await walkTo(actor, { x: 50, y: 280, dir: 'up' }, tokenOf(actor));
        actor.prop = 'pillow';
        simBlip(600, 0.05);
        await simWait(300);
      }
      const dist = config.dist || 20;
      // Se pone a un lado del otro, en la misma habitación y con el camino despejado entre ellos.
      const side = actor.x <= target.x ? -1 : 1;
      const reach = Math.max(dist, 20);
      const spot = [side, -side, side * 0.6, -side * 0.6]
        .map((s) => ({ x: target.x + s * reach, y: target.y }))
        .find((p) => simsWorld.free(p.x, p.y) && simsWorld.lineFree(p, target));
      const near = spot || simsWorld.nearestFree(target.x + side * reach, target.y);
      await walkTo(actor, near, tokenOf(actor), { keepProp: kind === 'pillow' });
      idle(actor, faceTo(actor, target));
      idle(target, faceTo(target, actor));
      if (dist < 20) {
        const dir = actor.x < target.x ? 1 : -1;
        await stepTo(actor, { x: target.x - dir * dist, y: target.y }, tokenOf(actor));
        idle(actor, faceTo(actor, target));
      }
    }
    simBlip(740, 0.12);

    // Lo que pasa en cada interacción.
    if (kind === 'chat') {
      for (let turn = 0; turn < 4; turn += 1) {
        const speaker = turn % 2 ? target : actor;
        const listener = other(speaker);
        setAnim(speaker, 'thrust', { frames: [0, 0, 1, 0], fps: 3 });
        speaker.extraRoutine = null;
        listener.extraRoutine = 'nod';
        speaker.expr = pickOne([null, 'happy']);
        listener.expr = pickOne(['happy', null, 'shock']);
        simBubble(speaker, Math.random() < 0.6 ? simlish(speaker.key) : `${pickOne(CHAT_EMOJIS)}${pickOne(CHAT_EMOJIS)}`, { secs: 1.5 });
        await simWait(1500);
        alive();
        idle(speaker, faceTo(speaker, listener));
      }
    } else if (kind === 'compliment') {
      simBubble(actor, '🌹', { kind: 'emote', secs: 1.6 });
      await simWait(500);
      say(actor, 'compliment', 2.8);
      actor.expr = 'happy';
      await simWait(1200);
      target.expr = 'blush';
      await loop(2400, 600, () => w?.emit('heart', target.x, target.headY + 6, { vy: -16 }));
    } else if (kind === 'highfive') {
      both.forEach((sim) => { sim.expr = 'happy'; });
      await simWait(400);
      both.forEach((sim) => setAnim(sim, 'emote', { frames: [1, 2], fps: 3, loop: false }));
      await simWait(700);
      w?.emit('spark', mid().x, mid().y + 6, { count: 6, spread: 12, vy: -20 });
      simBlip(1320, 0.12);
      await simWait(2000);
    } else if (kind === 'tickle') {
      setAnim(actor, 'thrust', { frames: [2, 4], fps: 10 });
      actor.expr = 'happy';
      target.expr = 'shock';
      await simWait(500);
      target.routine = 'laugh';
      target.expr = 'happy';
      simBubble(target, '🤣', { kind: 'emote', secs: 3 });
      await simWait(3500);
    } else if (kind === 'shark') {
      say(actor, 'shark');
      setAnim(actor, 'slash', { fps: 14 });
      actor.expr = 'happy';
      target.expr = 'shock';
      jawsTheme();
      await simWait(1400);
      target.routine = 'laugh';
      target.expr = 'happy';
      await simWait(1200);
      say(target, 'sharkVictim', 2.2);
      await simWait(2400);
    } else if (kind === 'pillow') {
      // Guerra de cojines: tres lanzamientos, el otro devuelve.
      target.prop = 'pillow';
      for (let round = 0; round < 3; round += 1) {
        const [thrower, victim] = round % 2 ? [target, actor] : [actor, target];
        thrower.expr = 'happy';
        if (round === 0) say(thrower, 'pillow', 1.6);
        setAnim(thrower, 'thrust', { frames: [0, 2, 4, 5, 5], fps: 10, loop: false });
        w?.throwItem({ x: thrower.x, y: thrower.y - 26 }, { x: victim.x, y: victim.y - 26 }, 550);
        simBlip(300, 0.08, 'triangle');
        await simWait(560);
        victim.routine = 'recoil';
        victim.expr = 'shock';
        simBlip(200, 0.1, 'square', 0.04);
        await simWait(500);
        victim.routine = 'laugh';
        victim.expr = 'happy';
        await simWait(500);
        alive();
        idle(victim, faceTo(victim, thrower));
        idle(thrower, faceTo(thrower, victim));
      }
      both.forEach((sim) => { sim.routine = 'laugh'; sim.prop = null; });
      await simWait(1500);
    } else if (kind === 'selfie') {
      const ines = sims.ines || actor;
      const matteo = sims.matteo || target;
      both.forEach((sim) => { sim.expr = 'happy'; });
      // Ines levanta el móvil; en el espejo se os ve de frente.
      ines.prop = 'phone';
      setAnim(ines, 'thrust', { dir: 'up', frames: [3], fps: 1 });
      say(ines, 'selfie', 2);
      await simWait(1600);
      say(matteo, 'selfie', 1.8);
      await simWait(1400);
      selfieFlash();
      await simWait(500);
      w?.emit('heart', 317, 214, { count: 5, spread: 20, vy: -14 });
      await simWait(2400);
      ines.prop = null;
    } else if (kind === 'dance') {
      both.forEach((sim) => { sim.routine = 'dance'; sim.expr = 'happy'; });
      await loop(5400, 450, () => w?.emit('note', mid().x, mid().y, { vy: -14, spread: 20 }));
    } else if (kind === 'hug') {
      both.forEach((sim) => { sim.lean = sim.x < other(sim).x ? 1 : -1; sim.extraRoutine = 'sway'; sim.expr = 'closed'; });
      simBubble(actor, '🤗', { kind: 'emote', secs: 2.4 });
      setTimeout(() => say(target, 'love', 2), 2000);
      await loop(4500, 500, () => w?.emit('heart', mid().x, mid().y + 4, { vy: -16, spread: 10 }));
      both.forEach((sim) => { sim.expr = 'happy'; });
      await simWait(600);
    } else if (kind === 'kiss' || kind === 'makeout') {
      const long = kind === 'makeout';
      both.forEach((sim) => { sim.lean = (sim.x < other(sim).x ? 1 : -1) * (long ? 2 : 1.5); sim.extraRoutine = 'sway'; sim.expr = 'closed'; });
      SMOOCH();
      if (w) w.state.romance = long ? 0.7 : 0.35;
      w?.emit('heart', mid().x, mid().y, { count: long ? 4 : 2, spread: 8, vy: -18 });
      await loop(long ? 6000 : 2600, 500, (t) => {
        w?.emit('heart', mid().x, mid().y + 4, { vy: -16, spread: 12 });
        if (long && t % 1500 === 0) SMOOCH();
      });
      both.forEach((sim) => { sim.extraRoutine = null; sim.ox = 0; sim.expr = 'blush'; });
      setTimeout(() => say(target, 'love', 2), 200);
      await simWait(1800);
    } else if (kind === 'slowdance') {
      // Bailan agarrados girando despacio el uno alrededor del otro.
      if (w) w.state.romance = 0.4;
      setProp('radio', true);
      ROMANTIC();
      const center = { x: 236, y: 306 };
      both.forEach((sim) => { sim.expr = 'closed'; });
      const start = performance.now();
      try {
        while (performance.now() - start < 8000) {
          const k = (performance.now() - start) / 1000;
          both.forEach((sim, i) => {
            const a = k * 0.8 + i * Math.PI;
            sim.x = center.x + Math.cos(a) * 7;
            sim.y = center.y + Math.sin(a) * 3;
          });
          both.forEach((sim) => { sim.dir = faceTo(sim, other(sim)); setAnim(sim, 'idle', { dir: sim.dir, frames: [Math.floor(k * 2) % 2], fps: 1 }); });
          if (Math.random() < 0.08) w?.emit('note', center.x, center.y - 50, { vy: -12, spread: 24 });
          await simWait(50);
          alive();
        }
      } finally {
        setProp('radio', false);
      }
    } else if (kind === 'cuddle') {
      if (w) w.state.romance = 0.3;
      setProp('tv', true);
      try {
        both.forEach((sim) => { sim.lean = sim.x < other(sim).x ? 2 : -2; sim.extraRoutine = 'sway'; sim.expr = 'happy'; });
        await loop(8000, 700, (t) => {
          w?.emit('heart', mid().x, mid().y + 8, { vy: -12, spread: 8 });
          if (t === 2800) both.forEach((sim) => { sim.expr = 'closed'; });
        });
      } finally {
        setProp('tv', false);
      }
    } else if (kind === 'massage') {
      setAnim(actor, 'thrust', { frames: [1, 2, 1, 0], fps: 4 });
      actor.expr = 'happy';
      target.expr = 'closed';
      await simWait(800);
      say(target, 'massage', 2.6);
      await loop(5500, 700, () => w?.emit('sparkle', target.x, target.headY + 8, { vy: -8, spread: 12 }));
      target.expr = 'blush';
      await simWait(800);
    } else if (kind === 'spoon') {
      if (w) w.state.romance = 0.3;
      both.forEach((sim) => { sim.expr = 'closed'; });
      await loop(10000, 800, (t) => w?.emit(t % 1600 ? 'z' : 'heart', mid().x + 4, mid().y + 6, { vy: -12 }));
    } else if (kind === 'woohoo') {
      // Como en los Sims: se meten bajo el edredón y lo demás se imagina.
      both.forEach((sim) => { sim.expr = 'blush'; });
      await simWait(700);
      both.forEach((sim) => { sim.hidden = true; });
      if (w) { w.state.bedMode = 'woohoo'; w.state.romance = 0.85; }
      ROMANTIC();
      simBubble(actor, sayLine(actor.key, lineFor(actor.key, 'woohoo')), { secs: 2.6 });
      setTimeout(() => simBubble(target, sayLine(target.key, lineFor(target.key, 'woohoo')), { secs: 2.6 }), 2800);
      await loop(8000, 250, (t) => {
        w?.emit(t % 750 ? 'heart' : 'note', 102 + (Math.random() - 0.5) * 30, 92, { vy: -18, spread: 20 });
        if (t % 1000 === 0) simBlip(700 + Math.random() * 300, 0.05, 'triangle', 0.04);
      });
      if (w) w.state.bedMode = null;
      both.forEach((sim) => { sim.hidden = false; sim.expr = 'blush'; });
      w?.emit('heart', 102, 80, { count: 8, spread: 30, vy: -20 });
      simBubble(target, '😳💕', { kind: 'emote', secs: 2.4 });
      await simWait(2400);
    } else if (kind === 'argue') {
      // Discusión: caras de enfado, gestos, gruñidos y rayos.
      both.forEach((sim) => { sim.expr = 'angry'; });
      GRUMBLE();
      for (let turn = 0; turn < 5; turn += 1) {
        const speaker = turn % 2 ? target : actor;
        const listener = other(speaker);
        setAnim(speaker, 'slash', { frames: [0, 1, 2, 1], fps: 8 });
        listener.routine = turn % 2 ? 'stomp' : null;
        if (!listener.routine) idle(listener, faceTo(listener, speaker));
        listener.expr = pickOne(['angry', 'eyeroll']);
        say(speaker, 'argue', 1.5);
        w?.emit('bolt', mid().x, mid().y, { count: 2, spread: 16, vy: -10 });
        if (turn % 2) GRUMBLE();
        await simWait(1500);
        alive();
        speaker.routine = null;
        idle(speaker, faceTo(speaker, listener));
      }
      // Se dan la espalda, cada uno con su nube.
      both.forEach((sim) => { idle(sim, awayFrom(sim, other(sim))); sim.expr = 'angry'; });
      both.forEach((sim) => { sim.stormUntil = Date.now() + 8000; sim.angryUntil = Date.now() + 90000; });
      await simWait(2500);
    } else if (kind === 'sulk') {
      idle(actor, awayFrom(actor, target));
      actor.expr = 'eyeroll';
      actor.stormUntil = Date.now() + 9000;
      actor.angryUntil = Date.now() + 60000;
      say(actor, 'sulk', 2.2);
      target.expr = 'shock';
      await simWait(1600);
      target.expr = 'sad';
      say(target, 'sulkVictim', 2.4);
      await simWait(2800);
      actor.expr = 'angry';
      await simWait(1000);
    } else if (kind === 'apologize') {
      actor.prop = 'rose';
      actor.expr = 'sad';
      target.expr = 'eyeroll';
      setAnim(actor, 'thrust', { frames: [3], fps: 1 });
      say(actor, 'apologize', 2.6);
      await simWait(2600);
      alive();
      target.expr = 'happy';
      say(target, 'forgive', 2.4);
      actor.prop = null;
      idle(actor, faceTo(actor, target));
      both.forEach((sim) => { sim.angryUntil = 0; sim.stormUntil = 0; sim.expr = 'closed'; sim.lean = sim.x < other(sim).x ? 1 : -1; sim.extraRoutine = 'sway'; });
      await loop(3000, 500, () => w?.emit('heart', mid().x, mid().y + 4, { vy: -16, spread: 10 }));
      both.forEach((sim) => { sim.expr = 'happy'; });
    }

    // Necesidades: a los dos les afecta (al otro, en su móvil, cuando le llega el toque).
    const delta = config.needs || { social: 25, fun: 5 };
    if (!incoming) {
      const person = myAvatarPerson();
      await boostNeeds(delta, { poke: kind, poke_at: new Date().toISOString() });
      notifyHousehold(`${poke.emoji} ${person} ${poke.text}`, 'Abre Umbral para verlo en vuestra casa', { open: 'home', tag: 'avatar-poke' });
    }
    simFloat(me, needsText(delta));
  } catch (error) {
    if (error !== SIM_CANCELLED) showToast(error.message || 'No se pudo guardar');
  } finally {
    if (w) { w.state.romance = 0; w.state.bedMode = null; }
    [me, partner].forEach((sim) => {
      if (sim.token !== tokenOf(sim)) return;
      if (sim.seat || sim.hidden) standUp(sim);
      Object.assign(sim, { routine: null, extraRoutine: null, prop: null, expr: null, lean: 0, ox: 0, oy: 0, hidden: false });
      idle(sim);
      sim.busy = false;
      sim.doing = null;
      sim.idleSince = Date.now();
    });
  }
}

function selfieFlash() {
  simBlip(1500, 0.05);
  const w = world();
  if (w) w.state.flashUntil = performance.now() + 500;
  const flash = document.createElement('div');
  flash.className = 'sims-flash';
  simsHouse.appendChild(flash);
  setTimeout(() => flash.remove(), 700);
}

// ---------- Andar tocando el suelo ----------
async function walkHere(point) {
  const sim = sims[meKey()];
  const w = world();
  if (!sim || !w || !simsWorld.free(point.x, point.y)) return;
  w.state.marker = { x: point.x, y: point.y, t0: performance.now() };
  simBlip(1180, 0.05);
  const token = ++sim.token;
  sim.busy = true;
  sim.doing = null;
  sim.progress = null;
  try {
    await walkTo(sim, point, token);
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
  if (world()) world().state.selected = null;
}

function showPie(event, title, options, rect = null) {
  hidePie();
  simBlip(990, 0.05);
  simsState.pieAt = { clientX: event.clientX, clientY: event.clientY, rect };
  if (world()) world().state.selected = rect;
  const box = simsHouse.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  const pie = document.createElement('div');
  pie.className = 'sims-pie';
  pie.innerHTML = `<div class="sims-pie-title">${escapeHtml(title)}</div>${options.map(([id, label, emoji], index) => `<button type="button" class="sims-pie-option${id.startsWith('cat:') ? ' is-cat' : ''}" data-pie="${escapeHtml(id)}" style="--i:${index}"><span>${emoji}</span>${escapeHtml(label)}</button>`).join('')}`;
  simsHouse.appendChild(pie);
  // Con muchas opciones, una lista en dos columnas junto al dedo (en círculo se solaparían).
  if (options.length > 5) {
    pie.classList.add('is-list');
    const list = document.createElement('div');
    list.className = 'sims-pie-list';
    list.append(...pie.querySelectorAll('.sims-pie-option'));
    pie.appendChild(list);
    const titleEl = pie.querySelector('.sims-pie-title');
    const left = Math.min(Math.max(x, list.offsetWidth / 2 + 4), box.width - list.offsetWidth / 2 - 4);
    const top = Math.min(Math.max(y - list.offsetHeight / 2, titleEl.offsetHeight + 10), box.height - list.offsetHeight - 4);
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    titleEl.style.left = `${left}px`;
    titleEl.style.top = `${top - titleEl.offsetHeight / 2 - 4}px`;
    return;
  }
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
  const titleEl = pie.querySelector('.sims-pie-title');
  titleEl.style.left = `${Math.min(Math.max(x, titleEl.offsetWidth / 2 + 4), box.width - titleEl.offsetWidth / 2 - 4)}px`;
  titleEl.style.top = `${Math.min(Math.max(y, 14), box.height - 14)}px`;
}

const pokeOption = (kind, withName = false) => {
  const poke = avatarCatalog().POKES[kind];
  return [`social:${kind}`, withName ? `${poke.label} con ${simPerson(partnerKeyOf())}` : poke.label, poke.emoji];
};
const objectOptions = (id) => {
  const info = SIM_OBJECTS[id];
  if (!info) return [];
  return [...info.actions.map((action) => [`act:${action}`, actionLabel(action), SIM_ACTIONS[action].emoji]), ...(info.social || []).map((kind) => pokeOption(kind, true))];
};
// Al tocar al otro: primero la categoría y luego la interacción. Si estáis enfadados,
// la categoría de enfado sale la primera.
function partnerMenu() {
  const angry = Object.values(sims).some((sim) => sim.angryUntil > Date.now());
  const cats = angry ? [SOCIAL_CATS[4], ...SOCIAL_CATS.slice(0, 4)] : SOCIAL_CATS;
  return cats.map(([id, label, emoji]) => [`cat:${id}`, label, emoji]);
}

function handleHouseTap(event) {
  const w = world();
  if (!w || event.target.closest('.sims-pie-option') || event.target.closest('.sims-hud') || event.target.closest('.sims-photo-card')) return;
  if (event.target.closest('.sims-pie')) return hidePie();
  if (simsHouse.querySelector('.sims-pie')) return hidePie();
  const point = w.toWorld(event.clientX, event.clientY);
  const actor = w.actorAt(point.x, point.y);
  const objectId = w.objectAt(point.x, point.y);
  const me = meKey();
  if (actor && actor.key === me) {
    // Si tu muñeco está delante de un objeto, sus acciones también salen en el menú.
    const own = [['own:look', 'Muñeco del jardín', '👕'], ['own:mood', 'Cómo me siento', '😊'], ['own:need', '¿Qué me falta?', '💭'], ['own:wave', 'Saludar', '👋']];
    return showPie(event, `${simPerson(me)} (tú)`, [...objectOptions(objectId).filter(([id]) => !id.startsWith('social:')), ...own].slice(0, 7));
  }
  if (actor) return showPie(event, simPerson(actor.key), partnerMenu());
  if (objectId && SIM_OBJECTS[objectId]) return showPie(event, SIM_OBJECTS[objectId].label, objectOptions(objectId), w.hitRect(objectId));
  walkHere(point);
}

function handlePieChoice(id) {
  const [type, value] = id.split(':');
  simBlip(1180, 0.06);
  if (type === 'cat') {
    const at = simsState.pieAt || { clientX: 0, clientY: 0 };
    const cat = SOCIAL_CATS.find(([catId]) => catId === value);
    const options = Object.entries(SOCIALS).filter(([, social]) => social.cat === value).map(([kind]) => pokeOption(kind));
    return showPie(at, `${cat[2]} ${cat[1]}`, options, at.rect);
  }
  hidePie();
  const me = sims[meKey()];
  if (type === 'act') return doAction(meKey(), value);
  if (type === 'social') return doSocial(value);
  if (value === 'look') return openAvatarEditor('clothes');
  if (value === 'mood') return openAvatarEditor('mood');
  if (value === 'wave') {
    if (me.busy) return simBubble(me, simlish(meKey()));
    setAnim(me, 'emote', { dir: 'down', frames: [0, 2, 1, 2], fps: 4 });
    me.expr = 'happy';
    simBubble(me, simlish(meKey()));
    setTimeout(() => { if (!me.busy) { idle(me); me.expr = null; } }, 2400);
    return;
  }
  if (value === 'need') {
    const needs = currentNeeds(avatarRows[myAvatarPerson()]);
    const [lowest, amount] = Object.entries(needs).sort((a, b) => a[1] - b[1])[0];
    simBubble(me, amount > 70 ? '💭 ¡Estoy genial! ✨' : `💭 ${NEEDS[lowest].emoji} ${NEEDS[lowest].label.toLowerCase()}…`, { kind: 'think', secs: 2.8 });
  }
}

// ---------- Marcador: qué está haciendo tu muñeco y la hora ----------
function renderHud() {
  const hud = simsHouse.querySelector('.sims-hud');
  if (!hud) return;
  const me = sims[meKey()];
  const now = new Date();
  const time = world()?.state.time;
  const clock = `${time === 'night' ? '🌙' : time === 'dusk' ? '🌇' : '☀️'} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const doing = me?.doing && SIM_ACTIONS[me.doing] ? me.doing : null;
  const social = me?.doing?.startsWith('social-') ? avatarCatalog()?.POKES[me.doing.slice(7)] : null;
  const progress = doing && me.progress?.start ? Math.min(1, (performance.now() - me.progress.start) / (me.progress.secs * 1000)) : 0;
  const label = doing ? `${SIM_ACTIONS[doing].emoji} ${ACTION_VERB[doing] || SIM_ACTIONS[doing].label}` : social ? `${social.emoji} ${social.label}` : me?.path?.length ? '🚶 Andando' : '';
  const key = `${label}|${clock}`;
  if (hud.dataset.key !== key) {
    hud.dataset.key = key;
    hud.innerHTML = `<div class="sims-hud-action"${label ? '' : ' hidden'}><span>${escapeHtml(label)}</span>${doing || social ? '<button type="button" class="sims-hud-cancel" aria-label="Dejar de hacerlo">✕</button>' : ''}<i class="sims-hud-bar"><b></b></i></div><div class="sims-hud-clock">${clock}</div>`;
  }
  const bar = hud.querySelector('.sims-hud-bar b');
  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
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

// ---------- Abrir, cerrar, gestos cuando están quietos y libre albedrío ----------
const timeOfDay = (hour) => (hour < 7 || hour >= 21 ? 'night' : hour < 9 || hour >= 19 ? 'dusk' : 'day');

function updateClock() {
  const w = world();
  if (!w) return;
  w.state.time = timeOfDay(new Date().getHours());
  w.state.lamps = w.state.time !== 'day';
}

function buildSims() {
  simsState.world?.destroy();
  simsState.bubbles = [];
  const w = simsWorld.createWorld(simsHouse);
  simsState.world = w;
  simsHouse.insertAdjacentHTML('beforeend', '<div class="sims-hud"></div>');
  Object.keys(propUsers).forEach((prop) => { propUsers[prop] = 0; });
  const starts = [{ x: 210, y: 300 }, { x: 262, y: 310 }];
  [meKey(), partnerKeyOf()].forEach((key, index) => {
    sims[key] = newSim(key, starts[index].x, starts[index].y);
    idle(sims[key], index ? 'left' : 'right');
  });
  Object.keys(sims).forEach((key) => { if (![meKey(), partnerKeyOf()].includes(key)) delete sims[key]; });
  w.state.actors = Object.values(sims);
  w.state.follow = sims[meKey()];
  w.state.zoom = simsState.zoom;
  updateClock();
}

function frame(t) {
  if (!simsState.open) return;
  simsState.raf = requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(0.05, (t - (simsState.last || t)) / 1000);
  simsState.last = t;
  Object.values(sims).forEach((sim) => {
    // Si otra orden manda, deja de andar hacia donde iba.
    if (sim.path.length && sim.walkToken !== sim.token) stopSim(sim);
    stepSim(sim, dt, t);
  });
  world().render(t, dt);
  simsState.bubbles.forEach(placeOverlay);
  renderHud();
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

// Gestos cuando están quietos: mirar alrededor, el móvil, estirarse, bostezar, tripas…
async function fidget(sim) {
  const token = ++sim.token;
  sim.busy = true;
  const needs = needsOf(sim);
  try {
    let gesture = pickOne(['look', 'look', 'phone', 'stretch', 'shift']);
    if (needs.energy < 40 && Math.random() < 0.6) gesture = 'yawn';
    else if (needs.hunger < 30 && Math.random() < 0.6) gesture = 'hungry';
    else if (needs.hygiene < 25 && Math.random() < 0.4) gesture = 'smell';
    if (gesture === 'look') {
      idle(sim, pickOne(['left', 'right', 'up', 'down']));
      sim.expr = pickOne([null, null, 'happy']);
    } else if (gesture === 'phone') {
      idle(sim, 'down');
      sim.prop = 'phone';
      sim.expr = pickOne(['happy', null, 'shock']);
    } else if (gesture === 'stretch') {
      setAnim(sim, 'spellcast', { dir: 'down', frames: [0, 1, 2, 3, 3, 3, 2, 1, 0], fps: 4, loop: false });
      sim.expr = 'closed';
    } else if (gesture === 'shift') {
      setAnim(sim, 'idle', { frames: [0, 1, 0, 1, 1, 0], fps: 3 });
    } else if (gesture === 'yawn') {
      setAnim(sim, 'emote', { dir: 'down', frames: [0, 2, 2, 2, 0], fps: 3, loop: false });
      sim.expr = 'closed';
      simBubble(sim, '🥱', { kind: 'emote', secs: 2 });
    } else if (gesture === 'hungry') {
      sim.expr = 'sad';
      simBubble(sim, '💭 🍝', { kind: 'think', secs: 2 });
      sim.routine = 'recoil';
      setTimeout(() => { if (sim.routine === 'recoil') { sim.routine = null; sim.ox = 0; } }, 500);
    } else if (gesture === 'smell') {
      sim.expr = 'eyeroll';
      simBubble(sim, sim.key === 'matteo' ? 'Forse una doccia… 🚿' : 'Creo que necesito una ducha 🚿', { secs: 2.2 });
    }
    await simWait(2600);
    checkToken(sim, token);
    sim.prop = null;
    sim.expr = null;
    idle(sim);
  } catch {
    // Cancelado: otra orden manda.
  } finally {
    if (sim.token === token) {
      sim.busy = false;
      sim.idleSince = Date.now() - 3000;
    }
  }
}

async function wander(sim) {
  const token = ++sim.token;
  sim.busy = true;
  try {
    const spot = pickOne(IDLE_SPOTS);
    await walkTo(sim, simsWorld.nearestFree(spot.x + (Math.random() - 0.5) * 30, spot.y + (Math.random() - 0.5) * 16), token);
    idle(sim, pickOne(['left', 'right', 'down']));
    await simWait(2500);
    checkToken(sim, token);
  } catch {
    // Cancelado: otra orden manda.
  } finally {
    if (sim.token === token) {
      sim.busy = false;
      sim.idleSince = Date.now();
    }
  }
}

// Quietos y cerca, se giran el uno hacia el otro (salvo si están enfadados).
function lookAtEachOther() {
  const pair = [sims[meKey()], sims[partnerKeyOf()]];
  pair.forEach((sim, index) => {
    const mate = pair[1 - index];
    if (!sim || !mate || sim.busy || sim.path.length || sim.routine || sim.anim !== 'idle' || sim.angryUntil > Date.now()) return;
    if (Math.hypot(mate.x - sim.x, mate.y - sim.y) < 110) sim.dir = faceTo(sim, mate);
  });
}

function simsTick() {
  if (!simsState.open) return;
  renderSimsNeeds();
  updateClock();
  lookAtEachOther();
  // Mientras eliges en el menú, nadie hace nada por su cuenta.
  if (simsHouse.querySelector('.sims-pie') || simsHouse.querySelector('.sims-photo-card')) return;
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
    if (idleFor > (key === me ? 16000 : 10000)) return wander(sim);
    if (idleFor > 4000 && Math.random() < 0.35) fidget(sim);
  });
}

async function openSims() {
  if (!window.simsWorld || !avatarCatalog()) return;
  if (!myAvatarPerson()) return showToast('Elige primero si eres Ines o Matteo');
  try {
    await simsWorld.loadSprites();
  } catch (error) {
    return showToast(error.message || 'No se pudo abrir la casa');
  }
  simsModal.classList.add('visible');
  buildSims();
  simsState.open = true;
  simsState.last = 0;
  simsState.tip = Math.floor(Math.random() * SIM_TIPS.length);
  document.querySelector('#simsTip').textContent = SIM_TIPS[simsState.tip];
  updateSoundButton();
  updateZoom();
  renderSimsNeeds();
  if (history.state?.page !== 'sims') history.pushState({ page: 'sims' }, '', '#casa-por-dentro');
  cancelAnimationFrame(simsState.raf);
  simsState.raf = requestAnimationFrame(frame);
  clearInterval(simsState.timer);
  simsState.timer = setInterval(simsTick, 2500);
  loadSimsPhotos();
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
  cancelAnimationFrame(simsState.raf);
  Object.values(sims).forEach((sim) => { sim.token += 1; stopSim(sim); });
  try { speechSynthesis.cancel(); } catch {}
}

function updateZoom() {
  const button = document.querySelector('#simsZoom');
  button.setAttribute('aria-pressed', String(simsState.zoom));
  button.setAttribute('aria-label', simsState.zoom ? 'Ver toda la casa' : 'Seguir de cerca a tu muñeco');
  if (world()) world().state.zoom = simsState.zoom;
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
  const card = event.target.closest('.sims-photo-card');
  if (card) {
    if (event.target.closest('[data-photo-next]')) {
      simsState.photoIndex += 1;
      return showPhotoCard();
    }
    if (event.target.closest('[data-photo-album]')) {
      card.remove();
      closeSims();
      setTimeout(() => showView('nosotros'), 250);
      return;
    }
    return card.remove();
  }
  if (event.target.closest('.sims-hud-cancel')) {
    const me = sims[meKey()];
    const partner = sims[partnerKeyOf()];
    [me, ...(me.doing?.startsWith('social-') ? [partner] : [])].forEach((sim) => {
      sim.token += 1;
      stopSim(sim);
      standUp(sim);
      sim.busy = false;
      sim.doing = null;
      sim.idleSince = Date.now();
    });
    if (world()) { world().state.romance = 0; world().state.bedMode = null; }
    return;
  }
  handleHouseTap(event);
});
// Con ratón: resalta lo que se puede tocar.
simsHouse.addEventListener('pointermove', (event) => {
  const w = world();
  if (!w || event.pointerType !== 'mouse' || event.target !== w.canvas) return;
  const point = w.toWorld(event.clientX, event.clientY);
  const id = w.actorAt(point.x, point.y) ? null : w.objectAt(point.x, point.y);
  w.state.hover = id && SIM_OBJECTS[id] ? w.hitRect(id) : null;
  w.canvas.style.cursor = (id && SIM_OBJECTS[id]) || w.actorAt(point.x, point.y) ? 'pointer' : 'default';
});
simsHouse.addEventListener('pointerleave', () => { if (world()) world().state.hover = null; });
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
// Cambios de ánimo o actividad (tuyos o del otro, en directo).
window.addEventListener('umbral:avatars', () => {
  if (!simsState.open) return;
  renderSimsNeeds();
  replayPartnerActivity();
});
// Un toque del otro con la casa abierta: se ve aquí (y no en la escena).
window.addEventListener('umbral:poke', (event) => {
  if (!simsState.open) return;
  event.preventDefault();
  doSocial(event.detail.kind, { incoming: true });
});
