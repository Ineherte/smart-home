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
  fridge: { label: 'Nevera', actions: ['snack', 'shoplist'] },
  board: { label: 'Corcho de tareas', actions: ['tasklist'] },
  stove: { label: 'Cocina', actions: ['cook', 'coffee'] },
  ksink: { label: 'Fregadero', actions: ['dishes'] },
  table: { label: 'Mesa', actions: ['eat', 'wine', 'puzzle'] },
  winerack: { label: 'Botellero', actions: ['wine'] },
  radio: { label: 'Tocadiscos', actions: ['dance', 'sing'] },
  sofa: { label: 'Sofá', actions: ['tv', 'games', 'sharkgame', 'readsofa', 'nap', 'phone'], social: ['cuddle'] },
  tv: { label: 'Tele', actions: ['tv', 'games', 'sharkgame'] },
  photo: { label: 'Vuestras fotos', actions: ['photos'] },
  photo2: { label: 'Vuestras fotos', actions: ['photos'] },
  polaroids: { label: 'Polaroids', actions: ['photos'] },
  wave: { label: 'La gran ola (vuestro puzzle)', actions: ['admire', 'puzzle'] },
  shark: { label: 'Tiburón de peluche', actions: ['sharkhug', 'sharknap', 'sharkgame'] },
  mirror: { label: 'Espejo', actions: ['pose'], social: ['selfie'] },
  bed: { label: 'Cama', actions: ['sleep', 'readbed', 'jump'], social: ['spoon', 'woohoo'] },
  wardrobe: { label: 'Armario', actions: ['outfit', 'dress'] },
  sink: { label: 'Lavabo', actions: ['teeth', 'mirror'] },
  shower: { label: 'Bañera', actions: ['shower', 'bath'] },
  washer: { label: 'Lavadora', actions: ['laundry'] },
  bookshelf: { label: 'Librería', actions: ['read', 'readsofa'] },
  window: { label: 'Ventana', actions: ['window'] },
  yoga: { label: 'Esterilla', actions: ['yoga'] },
  desk: { label: 'Escritorio', actions: ['work', 'agenda'] },
  door: { label: 'Puerta de casa', actions: ['tripturin', 'tripchieti', 'tripspain', 'goout'] },
  coatrack: { label: 'Perchero', actions: ['tripturin', 'goout'] },
  travelmap: { label: 'Vuestro mapa de viajes', actions: ['mapview'] },
  // Muebles de la tienda (solo se pueden tocar si los habéis comprado).
  guitar: { label: 'Guitarra', actions: ['guitar'] },
  beanbag: { label: 'Puf', actions: ['beanread', 'beannap'] },
  easel: { label: 'Caballete', actions: ['paint'] },
  telescope: { label: 'Telescopio', actions: ['stargaze'] },
  aquarium: { label: 'Acuario', actions: ['fishwatch', 'fishfeed'] },
  arcade: { label: 'Recreativa', actions: ['arcade'] },
  // Turín
  mole: { label: 'Mole Antonelliana', actions: ['moleview', 'moleselfie'] },
  cafe: { label: 'Caffè al Bicerin', actions: ['bicerin'] },
  gelato: { label: 'Gelateria', actions: ['gelato'] },
  bench: { label: 'Banco', actions: ['benchsit'] },
  kiosk: { label: 'Edicola', actions: ['newspaper'] },
  // Chieti
  familytable: { label: 'La mesa de la familia', actions: ['familylunch'] },
  grill: { label: 'Fornacella', actions: ['arrosticini'] },
  olive: { label: 'Olivo', actions: ['olivepick'] },
  vespa: { label: 'La Vespa', actions: ['vespa'] },
  orto: { label: 'El huerto', actions: ['tomatoes'] },
  majella: { label: 'La Majella', actions: ['majella'] },
  // España
  paellatable: { label: 'La mesa del patio', actions: ['paella'] },
  hammock: { label: 'Hamaca', actions: ['siesta'] },
  orange: { label: 'Naranjo', actions: ['orange'] },
  fountain: { label: 'El pozo', actions: ['fountain'] },
  kikabed: { label: 'La camita de Kika', actions: ['petkika', 'fetch'] },
  huerto: { label: 'El huerto de papá', actions: ['veggies'] }
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
  coatrack: { x: 457, y: 366, dir: 'down' },
  board: { x: 130, y: 282, dir: 'up' }
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
  guitar: { object: 'guitar', label: 'Tocar la guitarra', emoji: '🎸', secs: 9, hold: 'guitar', prop: 'guitar', anim: ['thrust', [0, 1, 0, 1], 4], fx: 'notes', expr: ['happy', 'closed'], needs: { fun: 25 }, say: { ines: ['🎶 Bésame, bésame mucho…', '¡Me sé tres acordes!'], matteo: ['🎶 Volare, oh oh…', 'Questa è per te, Ines'] } },
  beanread: { object: 'beanbag', label: 'Leer en el puf', emoji: '📖', secs: 9, pose: 'seat', hold: 'book', expr: [null, 'happy'], needs: { fun: 15, energy: 5 } },
  beannap: { object: 'beanbag', label: 'Hundirse en el puf', emoji: '😌', secs: 8, pose: 'seat', zzz: true, expr: 'closed', needs: { energy: 20 } },
  paint: { object: 'easel', label: 'Pintar un cuadro', emoji: '🎨', secs: 10, hold: 'brush', anim: ['thrust', [1, 2, 3, 2], 3], fx: 'paint', expr: ['happy', null], needs: { fun: 25 }, say: { ines: ['Un poco más de azul…', '¡Esto va al salón!'], matteo: ['Sembra un Van Gogh', 'Che capolavoro'] } },
  stargaze: { object: 'telescope', label: 'Mirar por el telescopio', emoji: '🔭', secs: 8, anim: ['thrust', [0], 1], fx: 'stars', expr: ['shock', 'happy'], needs: { fun: 20 } },
  fishwatch: { object: 'aquarium', label: 'Mirar los peces', emoji: '🐠', secs: 6, expr: ['happy', 'closed'], needs: { fun: 10, energy: 5 } },
  fishfeed: { object: 'aquarium', label: 'Dar de comer a los peces', emoji: '🍤', secs: 4, anim: ['thrust', [2, 3, 2], 3], fx: 'feed', expr: 'happy', needs: { fun: 8 } },
  mapview: { object: 'travelmap', label: 'Mirar el mapa de viajes', emoji: '🗺️', secs: 2.5, expr: 'happy', after: 'travelmap', own: true, needs: { social: 5 }, say: { ines: ['¿Te acuerdas de Menorca? 🏝️', 'Nos falta Japón…'], matteo: ['Che bello Noli…', 'Prossima tappa?'] } },
  arcade: { object: 'arcade', label: 'Jugar a la recreativa', emoji: '🕹️', secs: 1.5, prop: 'arcade', after: 'minigames', own: true },
  outfit: { object: 'wardrobe', label: 'Cambiarse de ropa', emoji: '👚', secs: 1.2, prop: 'wardrobe', after: 'outfit', own: true },
  sharkgame: { object: 'tv', label: 'Jugar a Tiburón hambriento', emoji: '🦈', secs: 1, pose: 'sofa', hold: 'controller', after: 'sharkgame', own: true, needs: { fun: 5 } },
  teeth: { object: 'sink', label: 'Lavarse los dientes', emoji: '🪥', secs: 5, anim: ['thrust', [1, 2, 1, 2], 8], needs: { hygiene: 20 } },
  mirror: { object: 'sink', label: 'Hablar con el espejo', emoji: '🪞', secs: 6, talk: true, expr: 'happy', needs: { social: 10, fun: 10 } },
  shower: { object: 'shower', label: 'Ducharse', emoji: '🚿', secs: 8, pose: 'shower', prop: 'shower', talk: true, needs: { hygiene: 60 } },
  bath: { object: 'shower', label: 'Baño de espuma', emoji: '🛁', secs: 12, pose: 'bath', prop: 'bath', expr: 'closed', needs: { hygiene: 80, fun: 10 } },
  laundry: { object: 'washer', label: 'Poner una lavadora', emoji: '🧺', secs: 5, anim: ['thrust', [0, 1, 2, 3, 2], 4], prop: 'laundry', propStays: 20000, needs: { hygiene: 25 } },
  goout: { object: 'door', label: 'Salir a dar una vuelta', emoji: '🚶', secs: 14, pose: 'out', expr: 'happy', needs: { fun: 25, social: 15, energy: -10 } },
  // Con la app de verdad: la lista de la compra, las tareas y la agenda.
  shoplist: { object: 'fridge', label: 'Ver la lista de la compra', emoji: '📝', secs: 1.2, after: 'shoplist' },
  tasklist: { object: 'board', label: 'Ver las tareas pendientes', emoji: '📌', secs: 1.2, after: 'tasklist' },
  agenda: { object: 'desk', label: 'Mirar la agenda', emoji: '📅', secs: 1.5, pose: 'desk', after: 'agenda' },
  // Viajes (se va con el otro).
  tripturin: { object: 'door', label: 'Pasear por Turín', emoji: '🏛️', trip: 'turin' },
  tripchieti: { object: 'door', label: 'Ir a Chieti (familia de Matteo)', emoji: '🇮🇹', trip: 'chieti' },
  tripspain: { object: 'door', label: 'Ir a España (familia de Ines y Kika)', emoji: '🇪🇸', trip: 'spain' },
  // Turín
  moleview: { object: 'mole', label: 'Admirar la Mole', emoji: '🏛️', secs: 5, expr: 'happy', needs: { fun: 15 }, say: { ines: ['¡Qué alta es la Mole!', 'Me encanta Turín'], matteo: ['La Mole è sempre bellissima', 'Dentro c\'è il museo del cinema'] } },
  moleselfie: { object: 'mole', label: 'Selfie con la Mole', emoji: '🤳', social: 'selfie' },
  bicerin: { object: 'cafe', label: 'Tomar un bicerin', emoji: '☕', secs: 9, pose: 'seat', hold: 'cup', expr: ['happy', 'closed', 'happy'], needs: { energy: 15, fun: 15, hunger: 10 }, say: { ines: ['¡Qué rico el bicerin!', 'Chocolate, café y nata… 😍'], matteo: ['Il bicerin è una religione qui', 'Un classico torinese'] } },
  gelato: { object: 'gelato', label: 'Comprar un helado', emoji: '🍦', secs: 5, anim: ['thrust', [0, 1, 2, 1], 3], after: 'gelato', needs: { hunger: 15, fun: 15 }, say: { ines: ['¡Uno de pistacho, porfa!'], matteo: ['Gianduia e nocciola!'] } },
  benchsit: { object: 'bench', label: 'Sentarse en el banco', emoji: '🪑', secs: 9, pose: 'seat', expr: [null, 'happy'], needs: { energy: 10, fun: 5 } },
  newspaper: { object: 'kiosk', label: 'Comprar el periódico', emoji: '📰', secs: 5, hold: 'book', anim: ['thrust', [0, 1, 0], 2], needs: { fun: 10 }, say: { ines: ['¿Tienen El País?'], matteo: ['La Stampa, grazie'] } },
  // Chieti
  familylunch: { object: 'familytable', label: 'Comer todos juntos', emoji: '🍝', secs: 14, pose: 'seat', family: true, expr: ['happy', null, 'happy', 'blush'], needs: { hunger: 55, social: 35 }, say: { ines: ['¡Qué buena está la pasta, mamma!'], matteo: ['Come la fa la mamma, nessuno!'] } },
  arrosticini: { object: 'grill', label: 'Hacer arrosticini', emoji: '🍢', secs: 9, anim: ['thrust', [1, 2, 3, 2], 5], prop: 'grill', expr: 'happy', needs: { hunger: 30, fun: 15 }, say: { ines: ['¡Huelen genial!'], matteo: ['Gli arrosticini abruzzesi, i migliori!'] } },
  olivepick: { object: 'olive', label: 'Coger aceitunas', emoji: '🫒', secs: 6, anim: ['thrust', [3, 4, 5, 4], 4], needs: { fun: 10 } },
  vespa: { object: 'vespa', label: 'Dar una vuelta en Vespa', emoji: '🛵', secs: 12, pose: 'out', expr: 'happy', needs: { fun: 30, energy: -5 } },
  tomatoes: { object: 'orto', label: 'Coger tomates del huerto', emoji: '🍅', secs: 6, anim: ['thrust', [3, 4, 5, 4], 4], needs: { hunger: 10, fun: 10 } },
  majella: { object: 'majella', label: 'Mirar la Majella', emoji: '⛰️', secs: 6, expr: [null, 'happy'], needs: { fun: 10 }, say: { ines: ['¡Qué montañas tan bonitas!'], matteo: ['Casa mia ❤️', 'La Majella, che spettacolo'] } },
  // España
  paella: { object: 'paellatable', label: 'Comer paella todos juntos', emoji: '🥘', secs: 14, pose: 'seat', family: true, expr: ['happy', null, 'happy'], needs: { hunger: 55, social: 35 }, say: { ines: ['¡La paella de papá es la mejor!'], matteo: ['Buonissima la paella!'] } },
  siesta: { object: 'hammock', label: 'Siesta en la hamaca', emoji: '😴', secs: 12, pose: 'hammock', zzz: true, expr: 'closed', needs: { energy: 40 } },
  orange: { object: 'orange', label: 'Coger una naranja', emoji: '🍊', secs: 5, anim: ['thrust', [3, 4, 5, 4], 4], needs: { hunger: 15 } },
  fountain: { object: 'fountain', label: 'Sacar agua fresca del pozo', emoji: '🪣', secs: 6, anim: ['thrust', [1, 2, 3, 2], 4], needs: { hygiene: 15, fun: 5 }, say: { ines: ['¡Qué fresquita está!'], matteo: ['Che acqua fresca!'] } },
  veggies: { object: 'huerto', label: 'Coger verduras del huerto', emoji: '🥬', secs: 7, anim: ['thrust', [3, 4, 5, 4], 4], needs: { hunger: 10, fun: 10 }, say: { ines: ['¡Mira qué pimientos, papá!'], matteo: ['Che bell\'orto!'] } },
  petkika: { object: 'kikabed', label: 'Acariciar al perro', emoji: '🐶', secs: 6, dog: 'pet', expr: 'happy', needs: { social: 20, fun: 15 } },
  fetch: { object: 'kikabed', label: 'Tirarle la pelota', emoji: '🎾', secs: 10, dog: 'fetch', expr: 'happy', needs: { fun: 30, social: 10 } }
};
const NEED_ACTIONS = { hunger: ['cook', 'snack', 'eat'], energy: ['nap', 'sleep', 'sharknap', 'coffee'], fun: ['tv', 'games', 'dance', 'jump', 'sing', 'puzzle', 'readsofa', 'yoga', 'window'], hygiene: ['shower', 'teeth', 'bath', 'laundry'], social: ['mirror', 'phone', 'talkplant', 'sharkhug', 'pose', 'wine'] };
const ACTION_VERB = { shoplist: 'Mirando la compra', tasklist: 'Mirando las tareas', agenda: 'Mirando la agenda', moleview: 'Admirando la Mole', bicerin: 'Con un bicerin', gelato: 'Comprando un helado', benchsit: 'En el banco', newspaper: 'Con el periódico', familylunch: 'Comiendo en familia', arrosticini: 'Haciendo arrosticini', olivepick: 'Cogiendo aceitunas', vespa: 'En Vespa', tomatoes: 'En el huerto', majella: 'Mirando la Majella', paella: 'Comiendo paella', siesta: 'Siesta en la hamaca', orange: 'Cogiendo naranjas', fountain: 'En la fuente', petkika: 'Con Kika', fetch: 'Jugando con Kika', water: 'Regando', snack: 'Picando algo', cook: 'Cocinando', coffee: 'Haciendo café', dishes: 'Fregando', eat: 'Merendando', wine: 'Con una copa de vino', dance: 'Bailando', sing: 'Cantando', nap: 'Echando la siesta', phone: 'Con el móvil', tv: 'Viendo la tele', games: 'Jugando a la consola', readsofa: 'Leyendo', water: 'Regando', talkplant: 'Hablando con la planta', admire: 'Mirando el puzzle', puzzle: 'Haciendo un puzzle', sharkhug: 'Abrazando al tiburón', sharknap: 'Siesta con el tiburón', pose: 'Posando', photos: 'Mirando fotos', read: 'Buscando un libro', window: 'Mirando por la ventana', yoga: 'Haciendo yoga', work: 'Trabajando', sleep: 'Durmiendo', readbed: 'Leyendo en la cama', jump: 'Saltando en la cama', dress: 'En el armario', teeth: 'Lavándose los dientes', mirror: 'Hablando con el espejo', shower: 'En la ducha', bath: 'En la bañera', laundry: 'Poniendo una lavadora', goout: 'De paseo' };

// Interacciones entre los dos, por categorías (como en los Sims). needs: lo que le cambia a
// cada uno. dist: a qué distancia se ponen.
const SOCIAL_CATS = [['friendly', 'Amistoso', '😊'], ['fun', 'Divertido', '🎉'], ['romance', 'Romántico', '💕'], ['intimate', 'Íntimo', '🔥'], ['angry', 'Enfado', '😤'], ['plans', 'Planes', '✈️']];
const SOCIALS = {
  chat: { cat: 'friendly', dist: 20 },
  compliment: { cat: 'friendly', dist: 22 },
  highfive: { cat: 'friendly', dist: 19 },
  selfie: { cat: 'friendly' },
  tickle: { cat: 'fun', dist: 17, needs: { social: 15, fun: 20 } },
  dance: { cat: 'fun', dist: 20, needs: { social: 20, fun: 20 } },
  shark: { cat: 'fun', dist: 19, needs: { social: 15, fun: 20 } },
  pillow: { cat: 'fun', dist: 44, home: true, needs: { social: 15, fun: 30 } },
  hug: { cat: 'romance', dist: 15, needs: { social: 25 } },
  kiss: { cat: 'romance', dist: 16, needs: { social: 25, fun: 5 } },
  slowdance: { cat: 'romance', needs: { social: 25, fun: 15 } },
  cuddle: { cat: 'romance', home: true, needs: { social: 30, energy: 5 } },
  massage: { cat: 'romance', home: true, needs: { social: 20, energy: 15 } },
  makeout: { cat: 'intimate', dist: 15, needs: { social: 30, fun: 15 } },
  spoon: { cat: 'intimate', home: true, needs: { social: 25, energy: 40 } },
  woohoo: { cat: 'intimate', home: true, needs: { social: 40, fun: 35, energy: -15, hygiene: -15 } },
  argue: { cat: 'angry', dist: 24, needs: { social: -15, fun: -10 } },
  sulk: { cat: 'angry', dist: 26, needs: { social: -10 } },
  apologize: { cat: 'angry', dist: 19, needs: { social: 20 } },
  turin: { cat: 'plans', trip: true, needs: { fun: 30, social: 15, energy: -10 } },
  chieti: { cat: 'plans', trip: true, needs: { social: 40, fun: 25, energy: -15 } },
  spain: { cat: 'plans', trip: true, needs: { social: 40, fun: 25, energy: -15 } }
};
// Lo que cada interacción le cambia al otro cuando le llega (avatars.js usa la misma tabla).
Object.entries(SOCIALS).forEach(([kind, social]) => { if (social.needs) POKE_NEEDS[kind] = social.needs; });

// ---------- Viajes y familias ----------
const TRIPS = {
  turin: { label: 'Turín', icon: '🏛️', travel: '🚶 Paseando hacia el centro de Turín…', arrive: [{ x: 40, y: 352 }, { x: 60, y: 362 }] },
  chieti: { label: 'Chieti', icon: '🇮🇹', travel: '🚆 En el Frecciarossa camino de Chieti…', arrive: [{ x: 220, y: 330 }, { x: 240, y: 340 }] },
  spain: { label: 'España', icon: '🇪🇸', travel: '✈️ Volando a España, a la casa de campo…', arrive: [{ x: 166, y: 300 }, { x: 184, y: 310 }] }
};
// La familia de cada uno (y paseantes en Turín). lines: lo que dicen; greet: al llegar.
const FAMILY = {
  // La familia de Matteo en Chieti: su madre Giuliana, sus hermanas Francesca, Clara y
  // Claudia (con sus hijos) y su hermano Paolo. Los niños llaman «zio Meo» a Matteo y a Ines, por su nombre.
  chieti: [
    { id: 'matteo-mom', name: 'Giuliana', home: { x: 120, y: 282 }, voice: 'it-f', greet: ['Ciao ragazzi! Che bello vedervi!', 'Matteo, tesoro mio!', 'Ines, cara, vieni qui!'], lines: ['Avete mangiato?', 'Vi preparo qualcosa?', 'Che bello avervi qui', 'Fate i bravi a Torino', 'Bambini, piano!'] },
    { id: 'matteo-francesca', name: 'Francesca', home: { x: 300, y: 340 }, voice: 'it-f', greet: ['Fratellone!', 'Ciao Ines! 💕'], lines: ['Matte, mi presti la macchina?', 'Domani ho un esame…', 'Ines, mi insegni lo spagnolo?', 'Che bello che siete venuti'] },
    { id: 'matteo-clara', name: 'Clara', home: { x: 200, y: 326 }, voice: 'it-f', prop: 'baby', babyHair: '#a8754a', greet: ['Ciao fratellino!', 'Guarda chi c\'è: il piccolo Matteo!'], lines: ['Il piccolo Matteo ha messo un dentino', 'Cecilia, piano!', 'Bambine, a tavola!', 'Vittoria, non tirare i capelli a Giulia'] },
    { id: 'matteo-claudia', name: 'Claudia', home: { x: 380, y: 322 }, voice: 'it-f', prop: 'baby', babyHair: '#d8b070', babyColor: '#cfe3f4', greet: ['Ciao ragazzi!', 'Emmanuele finalmente dorme…'], lines: ['Tommaso, non correre!', 'Emmanuele ha fame…', 'Agnese, aiuta Teresa', 'Che stanchezza, quattro figli!'] },
    { id: 'matteo-paolo', name: 'Paolo', home: { x: 456, y: 342 }, voice: 'it-m', greet: ['Fratello!', 'Ciao Ines!'], lines: ['Gli arrosticini sono quasi pronti', 'Una partita a scopa dopo?', 'Loco, vieni qua!', 'Forza Chieti!'] },
    { id: 'kid-cecilia', name: 'Cecilia', kid: true, home: { x: 260, y: 352 }, voice: 'kid-f', greet: ['Zio Meo!', 'Ines!'], lines: ['Ines, giochiamo?', 'Prendimi!', 'Guarda cosa so fare!', 'Ho sette anni!'] },
    { id: 'kid-giulia', name: 'Giulia', kid: true, home: { x: 230, y: 360 }, voice: 'kid-f', greet: ['Zio Meo! Zio Meo!', 'Ines!'], lines: ['Prendimi, prendimi!', 'Voglio un gelato', 'Ahahah!'] },
    { id: 'kid-vittoria', name: 'Vittoria', kid: true, scale: 0.86, home: { x: 210, y: 350 }, voice: 'kid-f', greet: ['Zio Meo!'], lines: ['Mamma!', 'Ahah!', 'Ancora!'] },
    { id: 'kid-agnese', name: 'Agnese', kid: true, home: { x: 360, y: 356 }, voice: 'kid-f', greet: ['Zio Meo!', 'Ciao Ines!'], lines: ['Teresa, vieni!', 'Giochiamo a nascondino?', 'Ines, sei bellissima!'] },
    { id: 'kid-teresa', name: 'Teresa', kid: true, scale: 0.8, home: { x: 390, y: 350 }, voice: 'kid-f', greet: ['Zio Meo!'], lines: ['Agne!', 'Ahah!', 'Pappa!'] },
    { id: 'kid-tommaso', name: 'Tommaso', kid: true, scale: 0.92, home: { x: 330, y: 362 }, voice: 'kid-m', greet: ['Zio Meo!'], lines: ['Brum brum! 🛵', 'Sono un dinosauro! Roar!', 'Prendimi!', 'Loco, vieni!'] }
  ],
  // La familia de Ines en su casa de campo: Mari Cruz, Pedro y Alex.
  spain: [
    { id: 'ines-mom', name: 'Mari Cruz', home: { x: 200, y: 268 }, voice: 'es-f', greet: ['¡Hija mía, qué alegría!', '¡Ya estáis aquí!', 'Matteo, ¡qué guapo estás!'], lines: ['¿Habéis comido bien?', 'Os he hecho tortilla', '¿Cuándo volvéis otra vez?', 'Abrígate, que refresca'] },
    { id: 'ines-dad', name: 'Pedro', home: { x: 372, y: 316 }, voice: 'es-m', greet: ['¡Hombre, Matteo! ¿Qué tal?', '¡Bienvenidos a casa!'], lines: ['La paella está casi lista', '¿Qué tal por Turín?', 'Mira qué pimientos han salido en el huerto', 'Este año las naranjas están buenísimas'] },
    { id: 'ines-brother', name: 'Alex', home: { x: 120, y: 330 }, voice: 'es-m', greet: ['¡Hermanita!', '¡Qué pasa, cuñado!'], lines: ['¿Echamos un FIFA, Matteo?', 'Kika te echaba de menos', 'Mamá ha hecho comida para un regimiento', '¿Os quedáis a dormir?'] }
  ],
  turin: [
    { id: 'ped-a', name: 'Una vecina', walker: true, lane: 250, voice: 'it-f', lines: ['Buongiorno!', 'Che bella giornata'] },
    { id: 'ped-b', name: 'Un señor', walker: true, lane: 356, voice: 'it-m', lines: ['Buonasera', 'Permesso…'] }
  ]
};
// Los perros: Loco (labrador rubio de la familia de Matteo) y Kika (salchicha arlequín de Ines).
const DOGS = {
  chieti: { key: 'loco', name: 'Loco', breed: 'labrador', follow: 'matteo', bark: '¡Bau!', at: { x: 330, y: 300 } },
  spain: { key: 'kika', name: 'Kika', breed: 'dachshund', follow: 'ines', bark: '¡Guau!', at: { x: 330, y: 268 } }
};
const NPC_LINES = { hug: { 'it': ['Che bello!', 'Un abbraccio forte!'], 'es': ['¡Qué alegría!', '¡Ay, qué abrazo!'] } };

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
  'De noche se encienden las luces de casa y la tele ilumina el salón.',
  'La nota de la nevera es vuestra lista de la compra de verdad: tócala para ver o añadir cosas.',
  'En el corcho del salón están vuestras tareas: puedes darlas por hechas desde aquí.',
  'Las plantas de casa son las vuestras: si tienen sed se ponen mustias; riégalas y quedan regadas en la app.',
  'Por la puerta podéis ir a pasear por Turín, a Chieti con la familia de Matteo o a España con la de Ines y Kika.',
  'Se ponen el pijama para dormir y, al salir, abrigo o ropa de verano según el tiempo de Turín.',
  'Si dormís a la vez, la energía os sube más a los dos 💞'
];

const simsModal = document.querySelector('#simsModal');
const simsHouse = document.querySelector('#simsHouse');
const ZOOM_CLOSE = 1.8;
const simsState = { open: false, timer: null, raf: 0, last: 0, needsOf: 'me', tip: 0, sound: true, zoom: false, world: null, bubbles: [], pieAt: null, photoIndex: 0, npcs: [], dog: null, nextTram: 0, full: false, needsMini: false, drag: null, dragged: false, wakeLock: null };
try {
  simsState.sound = localStorage.getItem('umbral-sims-sound') !== 'off';
  simsState.music = localStorage.getItem('umbral-sims-music') !== 'off';
  // Zoom continuo: por defecto, de cerca (1,8). Se guarda el último que elegiste.
  const savedZoom = localStorage.getItem('umbral-sims-zoom');
  simsState.zoom = savedZoom === 'on' ? 2 : savedZoom === 'off' ? 1 : Number(savedZoom) >= 1 ? Math.min(3, Number(savedZoom)) : ZOOM_CLOSE;
} catch {}
const sims = {};
const simWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SIM_CANCELLED = Symbol('cancelled');
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const simPerson = (key) => householdPeople.find((person) => avatarKey(person) === key);
const meKey = () => avatarKey(myAvatarPerson() || householdPeople[0]);
const partnerKeyOf = () => avatarKey(otherPerson(simPerson(meKey())));
const world = () => simsState.world;
const curScene = () => world()?.state.scene || 'house';
const sceneObj = (id) => world()?.scene().objects.find((object) => object.id === id);
const NPC_NEEDS = { hunger: 80, energy: 80, fun: 80, hygiene: 80, social: 80 };
const needsOf = (sim) => currentNeeds(avatarRows[simPerson(sim.key)]);
// Sitio fijo de cada uno al llegar a los sitios (Ines a la izquierda, Matteo a la derecha): igual
// en los dos móviles, para que al sincronizar posiciones no acaben uno encima del otro.
const slotOf = (sim) => (simPerson(sim.key) === householdPeople[0] ? 0 : 1);

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
// Un soplo de ruido filtrado: agua, fritura, sábanas o páginas (según el filtro).
function simNoise(secs = 0.4, freq = 1800, volume = 0.05, type = 'bandpass') {
  if (!simsState.sound) return;
  try {
    simsAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    const length = Math.floor(simsAudio.sampleRate * secs);
    const buffer = simsAudio.createBuffer(1, length, simsAudio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = simsAudio.createBufferSource();
    source.buffer = buffer;
    const filter = simsAudio.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = simsAudio.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(simsAudio.destination);
    source.start();
  } catch {}
}
// El sonido de cada cosa al empezar a usarla.
const ACTION_SFX = {
  stove: () => { simNoise(1.2, 3200, 0.04, 'highpass'); simTune([330, 392], 90, 'triangle'); },
  coffee: () => { simNoise(0.8, 900, 0.05); simTune([700, 0, 820], 120, 'sine'); },
  fridge: () => { simBlip(110, 0.25, 'sine', 0.06); simTune([523, 659], 80, 'triangle'); },
  tv: () => simTune([1320, 0, 990], 60, 'square'),
  games: () => simTune([523, 659, 784, 1047], 70, 'square'),
  arcade: () => simTune([392, 523, 659, 784, 1047], 60, 'square'),
  shower: () => simNoise(1.6, 2600, 0.05),
  bath: () => simNoise(1.4, 1400, 0.05, 'lowpass'),
  ksink: () => simNoise(0.9, 2200, 0.04),
  sink: () => simNoise(0.7, 2400, 0.04),
  washer: () => { simBlip(98, 0.4, 'sawtooth', 0.03); simTune([880, 880], 140, 'square'); },
  bed: () => simNoise(0.5, 600, 0.04, 'lowpass'),
  sofa: () => simBlip(120, 0.12, 'sine', 0.08),
  bookshelf: () => simNoise(0.25, 4200, 0.03, 'highpass'),
  plant: () => simTune([1200, 980, 1320], 90, 'sine'),
  mirror: () => simTune([1568, 2093], 70, 'sine'),
  wardrobe: () => simNoise(0.3, 900, 0.04),
  door: () => simTune([392, 294], 120, 'triangle')
};

// Pequeño rebote al llegar a un sitio o al sentarse (como en un juego de verdad).
const squash = (sim, delay = 0) => { sim.squashAt = performance.now() + delay; };
// Sonido ambiente muy bajito: lluvia de fondo, pájaros de día fuera, grillos de noche.
// Solo con el sonido puesto.
let simsRain = null;
function simChirp(from, to, duration, volume = 0.025) {
  if (!simsState.sound || !simsAudio) return;
  try {
    const t = simsAudio.currentTime;
    const oscillator = simsAudio.createOscillator();
    const gain = simsAudio.createGain();
    oscillator.frequency.setValueAtTime(from, t);
    oscillator.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain).connect(simsAudio.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
  } catch {}
}
function setRainSound(on) {
  if (!on || !simsState.sound || !simsAudio) {
    if (simsRain) { try { simsRain.gain.gain.setTargetAtTime(0, simsAudio.currentTime, 0.4); const node = simsRain.source; setTimeout(() => { try { node.stop(); } catch {} }, 1500); } catch {} simsRain = null; }
    return;
  }
  if (simsRain) return;
  try {
    const buffer = simsAudio.createBuffer(1, simsAudio.sampleRate * 2, simsAudio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = simsAudio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = simsAudio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const gain = simsAudio.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(simsAudio.destination);
    source.start();
    gain.gain.setTargetAtTime(curScene() === 'house' ? 0.018 : 0.035, simsAudio.currentTime, 0.8);
    simsRain = { source, gain };
  } catch {}
}
function ambientTick() {
  const w = world();
  if (!w || !simsAudio || !simsState.sound) return setRainSound(false);
  const code = w.state.weather.code;
  const rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  setRainSound(rain);
  const outdoor = curScene() !== 'house';
  if (w.state.time === 'night') {
    if (Math.random() < (outdoor ? 0.7 : 0.25)) [0, 120, 240].forEach((ms) => setTimeout(() => simChirp(4200, 4000, 0.06, outdoor ? 0.012 : 0.006), ms));
  } else if (!rain && Math.random() < (outdoor ? 0.45 : 0.15)) {
    const base = 2200 + Math.random() * 1400;
    simChirp(base, base * 1.4, 0.12, outdoor ? 0.02 : 0.008);
    setTimeout(() => simChirp(base * 1.2, base * 0.9, 0.1, outdoor ? 0.018 : 0.007), 160);
  }
}

const SMOOCH = () => simTune([1400, 1800], 70);
const GRUMBLE = () => simTune([180, 150, 170, 130], 110, 'sawtooth');
const ROMANTIC = () => simTune([523, 659, 784, 659, 698, 880, 784], 260, 'triangle');

// Voces: busca en el móvil una voz de mujer en español para Ines y una de hombre en italiano
// para Matteo (y para cada familiar, la suya). Prefiere las voces «naturales» o «mejoradas».
const VOICE_PROFILES = {
  ines: { lang: 'es', female: true, pitch: 1.05, rate: 1.02 },
  matteo: { lang: 'it', female: false, pitch: 0.95, rate: 1.0 },
  'es-f': { lang: 'es', female: true, pitch: 1.0, rate: 1.0 },
  'es-m': { lang: 'es', female: false, pitch: 0.9, rate: 1.0 },
  'it-f': { lang: 'it', female: true, pitch: 1.0, rate: 1.0 },
  'it-m': { lang: 'it', female: false, pitch: 0.85, rate: 0.98 },
  'it-old': { lang: 'it', female: true, pitch: 0.9, rate: 0.85 },
  'kid-f': { lang: 'it', female: true, pitch: 1.6, rate: 1.1 },
  'kid-m': { lang: 'it', female: false, pitch: 1.5, rate: 1.1 }
};
const FEMALE_VOICE = /(m[oó]nica|paulina|helena|elvira|laura|luc[ií]a|marisol|esperanza|conchita|pen[eé]lope|lupe|sabina|dalia|elena|ximena|camila|isabela|marta|carmen|sara|paloma|alice|federica|elsa|isabella|chiara|paola|giorgia|emma|francesca|female|mujer|donna|femmin|google espa[nñ]ol|google italiano)/i;
const MALE_VOICE = /(jorge|diego|juan|pablo|carlos|enrique|alvaro|álvaro|raul|raúl|luca|cosimo|giuseppe|benigno|giorgio|calogero|lorenzo|federico|diego|marco|male|hombre|uomo|maschil)/i;
let voiceCache = {};
function pickVoice(profile) {
  if (!('speechSynthesis' in window)) return null;
  const cacheKey = `${profile.lang}-${profile.female}`;
  if (voiceCache[cacheKey] !== undefined) return voiceCache[cacheKey];
  const voices = speechSynthesis.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith(profile.lang));
  if (!voices.length) return null;
  const score = (voice) => {
    let points = 0;
    const name = voice.name || '';
    if (profile.female ? FEMALE_VOICE.test(name) : MALE_VOICE.test(name)) points += 10;
    if (profile.female ? MALE_VOICE.test(name) : FEMALE_VOICE.test(name)) points -= 10;
    if (/natural|neural|premium|enhanced|mejorad|siri/i.test(name)) points += 4;
    if (/es-ES|it-IT/i.test(voice.lang)) points += 2;
    if (voice.localService) points += 1;
    return points;
  };
  const best = [...voices].sort((a, b) => score(b) - score(a))[0];
  voiceCache[cacheKey] = { voice: best, matches: score(best) >= 10 };
  return voiceCache[cacheKey];
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', () => { voiceCache = {}; });

function speak(key, text, profileId) {
  if (!simsState.sound || !('speechSynthesis' in window)) return;
  try {
    const profile = VOICE_PROFILES[profileId || key] || VOICE_PROFILES.ines;
    const clean = text.replace(/[¡!¿#@%&♪]/g, '').replace(/\p{Extended_Pictographic}|‍|️/gu, '').trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    const picked = pickVoice(profile);
    utterance.lang = profile.lang === 'es' ? 'es-ES' : 'it-IT';
    if (picked?.voice) utterance.voice = picked.voice;
    // Si el móvil no tiene una voz de ese tipo, se ajusta el tono para que se parezca.
    utterance.pitch = picked?.matches ? profile.pitch : profile.female ? 1.35 : 0.7;
    utterance.rate = profile.rate;
    utterance.volume = 0.8;
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
  const row = sim.npc ? {} : avatarRows[simPerson(sim.key)] || {};
  const needs = sim.npc ? NPC_NEEDS : currentNeeds(row);
  if (sim.path.length) {
    const target = sim.path[0];
    const dx = target.x - sim.x;
    const dy = target.y - sim.y;
    const dist = Math.hypot(dx, dy);
    // Aceleran al arrancar y frenan al llegar; con poca energía van más despacio.
    const top = (sim.kind === 'dog' ? (sim.breed === 'labrador' ? 92 : 78) : sim.run ? 100 : sim.def?.kid ? 60 : sim.npc ? 46 : needs.energy < 25 ? 44 : WALK_SPEED) * (sim.npc ? 1 : window.simsMind?.speedMult(sim) ?? 1);
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
    // Andando o, si el camino es largo, corriendo (con polvillo en la calle).
    sim.anim = sim.run ? 'run' : 'walk';
    sim.frame = sim.run ? Math.floor(sim.stride / 6) % 8 : 1 + (Math.floor(sim.stride / 4.5) % 8);
    if (sim.run && Math.floor(sim.stride / 14) !== sim.lastDust) {
      sim.lastDust = Math.floor(sim.stride / 14);
      world()?.emit('puff', sim.x, sim.y - 2, { vy: -4, spread: 4, color: curScene() === 'house' ? '#efe4d2' : '#d8ccb8' });
    }
    // Pasitos suaves (solo los tuyos).
    if (!sim.npc && sim.key === meKey() && Math.floor(sim.stride / 18) !== sim.lastStep) {
      sim.lastStep = Math.floor(sim.stride / 18);
      simBlip(140 + Math.random() * 30, 0.03, 'triangle', 0.04);
    }
    if (!sim.path.length) {
      sim.speed = 0;
      if (sim.run) squash(sim);
      sim.run = false;
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
  sim.headY = sim.y - ((sim.height || 48) + (sim.anim === 'sit' ? 2 : 0)) * (sim.scale || 1) + (sim.oy || 0);
  if (sim.npc) {
    sim.face = null;
    // Las madres no sueltan al bebé.
    if (!sim.prop && sim.def?.prop) sim.prop = sim.def.prop;
    return;
  }
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
  Object.assign(sim, { hidden: false, clipY: null, sortY: null, shadow: true, prop: null, seat: null, seatClaim: null, exit: null, routine: null, extraRoutine: null, ox: 0, oy: 0, lean: 0, expr: null });
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
  const claim = sim.seatClaim;
  standUp(sim);
  sim.seatClaim = claim;
  if (keepProp) sim.prop = prop;
  sim.walkResolve?.();
  return new Promise((resolve) => {
    sim.path = smoothPath(sim, simsWorld.findPath(sim, spot));
    // Si el camino es largo (y va con su ropa de siempre), corre.
    const length = sim.path.reduce((sum, point, i) => sum + Math.hypot(point.x - (i ? sim.path[i - 1].x : sim.x), point.y - (i ? sim.path[i - 1].y : sim.y)), 0);
    sim.run = !sim.npc && length > 230 && (sim.outfit || 'casual') === 'casual';
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
  if (id === 'petkika' && simsState.dog) return `Acariciar a ${simsState.dog.name}`;
  if (id === 'fetch' && simsState.dog) return `Tirarle la pelota a ${simsState.dog.name}`;
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
  const held = other?.seat || other?.seatClaim;
  const taken = held && SEAT_GROUP[held.kind] === SEAT_GROUP[kind] ? held.index : -1;
  const index = seats.length === 1 ? 0 : preferred !== taken ? preferred : 1 - preferred;
  return { ...seats[index], kind, index };
}

// Dónde se pone y cómo se coloca para cada acción.
// Plaza libre de un objeto de la escena (sillas, banco, hamaca…), sin quitársela a nadie.
function claimObjectSeat(sim, objectId) {
  const seats = sceneObj(objectId)?.seats || [];
  const taken = everyone().filter((other) => other !== sim && (other.seat || other.seatClaim)?.kind === objectId).map((other) => (other.seat || other.seatClaim).index);
  // La más cercana de las libres (y se reserva ya, para que nadie más vaya a la misma).
  const free = seats.map((seat, i) => ({ seat, i })).filter(({ i }) => !taken.includes(i));
  if (!free.length) return null;
  const best = free.sort((a, b) => Math.hypot(a.seat.x - sim.x, a.seat.y - sim.y) - Math.hypot(b.seat.x - sim.x, b.seat.y - sim.y))[0];
  const seat = { ...best.seat, kind: objectId, index: best.i };
  sim.seatClaim = seat;
  return seat;
}
const everyone = () => [...Object.values(sims), ...simsState.npcs];

function placeFor(sim, action) {
  if (action.pose === 'seat' || action.pose === 'hammock') {
    const seat = claimObjectSeat(sim, action.object);
    sim.seatClaim = seat;
    if (seat) return { approach: { ...seat.exit, dir: 'up' }, seat };
  }
  const seatKind = { sofa: 'sofa', chair: 'chair', bed: 'bed', bedsit: 'bed', bedjump: 'bed', desk: 'desk' }[action.pose];
  if (seatKind) {
    const seat = claimSeat(sim, seatKind, action.hold === 'shark' ? 1 : 0);
    // Reserva la plaza ya, para que el otro no se siente en el mismo sitio mientras llega.
    sim.seatClaim = seat;
    return { approach: { ...seat.exit, dir: seatKind === 'chair' ? seat.dir : 'up' }, seat };
  }
  if (action.pose === 'bath' || action.pose === 'shower') return { approach: SPOTS.shower };
  return { approach: (curScene() === 'house' && (SPOTS[action.spot || action.object] || SPOTS[action.object])) || sceneObj(action.object)?.spot || { x: sim.x, y: sim.y } };
}

// Sentarse o tumbarse (con un saltito suave).
function sitOn(sim, seat, pose = 'sit') {
  sim.seat = seat;
  sim.seatClaim = null;
  sim.exit = seat.exit;
  sim.sortY = seat.sortY;
  sim.shadow = false;
  sim.slide = { fx: sim.x, fy: sim.y, tx: seat.x, ty: seat.y, t: 0, dur: 0.4, hop: 3 };
  squash(sim, 380);
  if (pose === 'lie') setAnim(sim, 'idle', { dir: 'down', frames: [0], fps: 1 });
  else setAnim(sim, 'sit', { dir: seat.dir, frames: [2], fps: 1 });
}

function enterPose(sim, action, place) {
  sim.current = action;
  sim.prop = action.hold || null;
  sim.exit = null;
  const seat = place.seat;
  if (['bed', 'bedsit'].includes(action.pose)) setOutfit(sim, 'pajamas');
  if (seat) {
    if (action.pose === 'hammock') {
      sitOn(sim, seat);
      return setAnim(sim, 'sit', { dir: 'down', frames: [0], fps: 1 });
    }
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
  if (action.fx === 'notes' && elapsed % 700 < 300) w.emit('note', sim.x + 6, sim.headY + 6, { vy: -16, spread: 10 });
  // Los muebles que se pueden mover llevan sus efectos con ellos.
  const { dx = 0, dy = 0 } = (action.object && simsWorld.objectInfo?.(action.object)?.offset) || {};
  if (action.fx === 'paint' && elapsed % 900 < 300) { w.state.paintStrokes = Math.min(10, (w.state.paintStrokes || 0) + 1); w.emit('spark', 360 + dx, 146 + dy, { vy: -6, spread: 10 }); }
  if (action.fx === 'stars' && elapsed % 1000 < 300) w.emit('sparkle', 372 + dx, 230 + dy, { vy: -8, spread: 16 });
  if (action.fx === 'feed' && elapsed % 800 < 300) w.emit('drop', 196 + dx, 336 + dy, { vy: 14, spread: 8 });
}

async function doAction(key, id, { autonomous = false } = {}) {
  const sim = sims[key];
  const action = SIM_ACTIONS[id];
  if (!sim || !action) return;
  if (action.trip) return key === meKey() ? doSocial(action.trip) : null;
  if (action.social) return key === meKey() ? doSocial(action.social) : null;
  if (action.dog) return doDogAction(key, id);
  const own = key === meKey();
  const token = ++sim.token;
  sim.busy = true;
  sim.doing = id;
  sim.progress = { start: 0, secs: action.secs };
  if (!autonomous) hidePie();
  let entered = false;
  try {
    if (own) {
      const at = new Date().toISOString();
      saveAvatar({ activity: id, activity_at: at }).catch(() => {});
      liveSend('act', { id, at });
    }
    if (autonomous) {
      simBubble(sim, `💭 ${action.emoji}`, { kind: 'think', secs: 1.6 });
      await simWait(1200);
      checkToken(sim, token);
    }
    const place = placeFor(sim, action);
    await walkTo(sim, place.approach, token);
    enterPose(sim, action, place);
    entered = true;
    if (own || sims[partnerKeyOf()] === sim) (ACTION_SFX[action.prop] || ACTION_SFX[action.object] || ACTION_SFX[action.pose])?.();
    if (action.family && own) joinFamilyMeal(id);
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
      // Si dormís a la vez, la energía sube más a los dos (cada uno en su móvil).
      const partner = sims[partnerKeyOf()];
      const together = id === 'sleep' && (partner?.doing === 'sleep' || (avatarRows[simPerson(partner?.key)]?.activity === 'sleep' && Date.now() - Date.parse(avatarRows[simPerson(partner.key)].activity_at || 0) < 20 * 60000));
      const base = together ? { ...action.needs, energy: (action.needs.energy || 0) + 20, social: (action.needs.social || 0) + 15 } : action.needs;
      const delta = window.simsMind?.needsDelta(base) || base;
      await boostNeeds(delta).catch(() => {});
      const text = needsText(delta);
      if (text) simFloat(sim, text);
      if (together) simBubble(sim, '💞 Dormir juntos', { kind: 'emote', secs: 2.4 });
      simBlip(880, 0.1);
    }
    if (own && action.after) runAfter(action.after, sim);
    if (own) lifeAfterAction(id);
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
      if (own) setTimeout(runQueued, 400);
    }
  }
}

function runAfter(after, sim) {
  if (after === 'shoplist') return shoppingCard();
  if (after === 'tasklist') return tasksCard();
  if (after === 'agenda') return agendaCard();
  if (after === 'gelato' && sim) {
    sim.prop = 'gelato';
    sim.expr = 'happy';
    setTimeout(() => { if (sim.prop === 'gelato') { sim.prop = null; sim.expr = null; } }, 10000);
  }
  if (after === 'dress') openAvatarEditor('clothes');
  if (after === 'outfit') wardrobeCard();
  if (after === 'sharkgame') startSharkGame();
  if (after === 'minigames') gamesCard();
  if (after === 'travelmap') travelMapCard();
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
      // Con permiso CORS, para que las fotos del juego (que incluyen estas) se puedan guardar.
      if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
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

// ---------- Ropa: pijama para dormir y, fuera, según el tiempo que haga ----------
const outsideTemp = () => {
  const temp = Number(world()?.state.weather.temp ?? 18);
  return curScene() === 'spain' ? temp + 5 : curScene() === 'chieti' ? temp + 2 : temp;
};
function wantedOutfit(sim) {
  const inBedNow = ['bed', 'bedsit'].includes(sim.current?.pose) || ['spoon', 'woohoo'].includes(sim.socialKind);
  if (inBedNow) return 'pajamas';
  // Lo que hayáis elegido en el armario manda.
  const pick = simsState.outfitPick?.[sim.key];
  if (pick && pick !== 'auto') return pick;
  // Y en Nochebuena, Navidad y la noche de Halloween, disfraz.
  const today = new Date();
  const md = `${today.getMonth() + 1}-${today.getDate()}`;
  if (md === '10-31' && today.getHours() >= 17) return 'halloween';
  if (md === '12-24' || md === '12-25') return 'xmas';
  if (curScene() !== 'house') {
    const temp = outsideTemp();
    return temp < 13 ? 'cold' : temp >= 26 ? 'hot' : 'casual';
  }
  const inBed = ['bed', 'bedsit'].includes(sim.current?.pose) || ['spoon', 'woohoo'].includes(sim.socialKind);
  const hour = new Date().getHours();
  return inBed || hour >= 23 || hour < 7 ? 'pajamas' : 'casual';
}
// Cambio de ropa con un destello (como en los Sims).
function setOutfit(sim, outfit, animate = true) {
  if (!sim || sim.npc || (sim.outfit || 'casual') === outfit) return;
  sim.outfit = outfit;
  sim.sprite = outfit === 'casual' ? sim.key : `${sim.key}-${outfit}`;
  simsWorld.loadSheet(sim.sprite);
  if (animate && world()) {
    world().emit('sparkle', sim.x, sim.headY + 14, { count: 8, spread: 18, vy: -14 });
    simBlip(1240, 0.06);
  }
}
const checkOutfit = (sim, animate = true) => setOutfit(sim, wantedOutfit(sim), animate);

// ---------- Viajes: Turín, Chieti y España ----------
function showTravelCard(text, ms) {
  return new Promise((resolve) => {
    const card = document.createElement('div');
    card.className = 'sims-travel';
    card.innerHTML = `<div><span>${escapeHtml(text)}</span><i><b style="animation-duration:${ms}ms"></b></i></div>`;
    simsHouse.appendChild(card);
    setTimeout(() => {
      card.classList.add('is-off');
      setTimeout(() => { card.remove(); resolve(); }, 400);
    }, ms);
  });
}
function updateSceneTitle() {
  const trip = TRIPS[curScene()];
  document.querySelector('#simsTitle').textContent = trip ? `${trip.icon} ${trip.label}` : 'Vuestra casa';
}
function enterScene(id) {
  const w = world();
  if (!w) return;
  w.setScene(id);
  Object.keys(propUsers).forEach((prop) => { propUsers[prop] = 0; });
  w.state.props = {};
  w.state.tram = null;
  simsState.nextTram = performance.now() + 4000;
  spawnNpcs(id);
  updateClock();
  updateSceneTitle();
  w.state.cam.x = 0;
  w.state.cam.y = 0;
}
async function doTrip(dest, { incoming = false, at = new Date().toISOString() } = {}) {
  const trip = TRIPS[dest];
  if (!trip || curScene() === dest) return;
  wantProgress({ trip: true });
  if (!incoming) { window.simsLife?.stat('trips'); window.simsLife?.diary(trip.icon, `Excursión a ${trip.label}`); }
  window.simsMind?.remember(trip.icon, `Excursión a ${trip.label}`, pickOne([`¿Te acuerdas de la excursión a ${trip.label}?`, `Tenemos que volver a ${trip.label} pronto`]));
  const both = [sims[meKey()], sims[partnerKeyOf()]];
  const tokens = both.map((sim) => ++sim.token);
  both.forEach((sim) => { sim.busy = true; sim.doing = `trip-${dest}`; sim.progress = null; stopSim(sim); });
  hidePie();
  try {
    if (curScene() === 'house') await Promise.all(both.map((sim, i) => walkTo(sim, { x: 450 + slotOf(sim) * 12, y: 362, dir: 'down' }, tokens[i]).catch(() => {})));
    simTune([660, 880, 990], 120);
    await showTravelCard(trip.travel, 2400);
    enterScene(dest);
    both.forEach((sim) => {
      standUp(sim);
      Object.assign(sim, { x: trip.arrive[slotOf(sim)].x, y: trip.arrive[slotOf(sim)].y, slide: null });
      idle(sim, 'right');
      checkOutfit(sim, false);
    });
    simBubble(both[0], `${trip.icon} ¡${trip.label}!`, { secs: 2.2 });
    greetFamily();
    if (!incoming) {
      const delta = SOCIALS[dest].needs;
      // Se guarda dónde estáis: si el otro abre la app más tarde, aparece aquí con vosotros.
      simsState.placeSeen = at;
      await boostNeeds(delta, { poke: dest, poke_at: at, place: dest, place_at: at }).catch(() => {});
      const poke = avatarCatalog().POKES[dest];
      if (poke) notifyHousehold(`${poke.emoji} ${myAvatarPerson()} ${poke.text}`, 'Abre Umbral para ir juntos', { open: 'home', tag: 'avatar-poke' });
      simFloat(both[0], needsText(delta));
    }
  } catch (error) {
    if (error !== SIM_CANCELLED) console.warn('[Umbral] Viaje:', error);
  } finally {
    both.forEach((sim, i) => {
      if (sim.token !== tokens[i]) return;
      sim.busy = false;
      sim.doing = null;
      sim.idleSince = Date.now();
    });
  }
}
async function goHome({ incoming = false } = {}) {
  if (curScene() === 'house') return;
  if (!incoming) {
    const at = new Date().toISOString();
    simsState.placeSeen = at;
    liveSend('home', { at });
    saveAvatar({ place: 'house', place_at: at }).catch(() => {});
  }
  const both = [sims[meKey()], sims[partnerKeyOf()]];
  both.forEach((sim) => { sim.token += 1; stopSim(sim); standUp(sim); sim.busy = true; });
  hidePie();
  simsHouse.querySelector('.sims-card')?.remove();
  await showTravelCard('🏠 Volviendo a casa…', 1800);
  enterScene('house');
  both.forEach((sim) => {
    Object.assign(sim, { x: 446 + slotOf(sim) * 16, y: 350, busy: false, doing: null, idleSince: Date.now() });
    idle(sim, 'up');
    checkOutfit(sim, false);
  });
}

// ---------- La familia, los paseantes y Kika ----------
function syncActors() {
  const w = world();
  if (w) w.state.actors = [...Object.values(sims), ...simsState.npcs, ...(simsState.dog ? [simsState.dog] : [])];
}
function spawnNpcs(sceneId) {
  simsState.npcs = (FAMILY[sceneId] || []).map((def) => {
    const npc = Object.assign(newSim(def.id, def.home?.x ?? 60 + Math.random() * 380, def.home?.y ?? def.lane), { npc: true, sprite: def.id, def, name: def.name, scale: def.scale || 1, height: def.kid ? 37 : 48, prop: def.prop || null, babyHair: def.babyHair, babyColor: def.babyColor });
    simsWorld.loadSheet(def.id);
    if (def.seat) {
      const seat = claimObjectSeat(npc, def.seat);
      if (seat) { sitOn(npc, seat); Object.assign(npc, { x: seat.x, y: seat.y, slide: null }); }
    } else idle(npc, 'down');
    return npc;
  });
  const dog = DOGS[sceneId];
  simsState.dog = dog ? Object.assign(newSim(dog.key, dog.at.x, dog.at.y), { kind: 'dog', npc: true, name: dog.name, breed: dog.breed, def: dog, height: dog.breed === 'labrador' ? 24 : 18 }) : null;
  if (simsState.dog) idle(simsState.dog, 'down');
  syncActors();
}
function npcSay(npc, text, { force = false } = {}) {
  if (!text) return;
  // Hablan por turnos (como en una comida de verdad): si alguien acaba de hablar, espera.
  const now = Date.now();
  if (!force && now < (simsState.npcTalkUntil || 0)) return;
  simsState.npcTalkUntil = now + 2200;
  simBubble(npc, text, { secs: 2.6 });
  speak(npc.key, text, npc.def?.voice);
}
function dogBark(dog) {
  simBubble(dog, dog.def?.bark || '¡Guau!', { secs: 1.2 });
  simBlip(520, 0.06, 'square', 0.04);
  setTimeout(() => simBlip(470, 0.06, 'square', 0.04), 120);
}
async function npcWalk(npc, spot) {
  const token = ++npc.token;
  npc.busy = true;
  try {
    await walkTo(npc, spot, token);
  } catch {
    // Otra orden manda.
  } finally {
    if (npc.token === token) { npc.busy = false; npc.idleSince = Date.now(); }
  }
}
// Al llegar, la familia sale a recibiros: un abrazo y un saludo para cada uno.
function greetFamily() {
  const mains = [sims[meKey()], sims[partnerKeyOf()]];
  // Los niños salen corriendo hacia el zio Meo y hacia Ines (solo algunos hablan, para no pisarse).
  simsState.npcs.filter((npc) => npc.def.kid).forEach(async (kid, i) => {
    const token = ++kid.token;
    kid.busy = true;
    try {
      await simWait(300 + i * 350);
      const line = pickOne(kid.def.greet);
      const target = /ines/i.test(line) ? sims.ines || mains[0] : sims.matteo || mains[1];
      await walkTo(kid, simsWorld.nearestFree(target.x + (Math.random() - 0.5) * 50, target.y + 14 + Math.random() * 14), token);
      idle(kid, faceTo(kid, target));
      if (i < 3) npcSay(kid, line);
      else simBubble(kid, pickOne(['😄', '🥰', '🙌']), { kind: 'emote', secs: 1.6 });
      kid.routine = 'laugh';
      await simWait(1400);
      checkToken(kid, token);
      kid.routine = null;
      idle(kid);
    } catch {
      // Otra orden manda.
    } finally {
      if (kid.token === token) { kid.busy = false; kid.idleSince = Date.now(); }
    }
  });
  simsState.npcs.filter((npc) => !npc.def.walker && !npc.def.kid).forEach(async (npc, i) => {
    const token = ++npc.token;
    npc.busy = true;
    try {
      await simWait(1200 + i * 1700);
      const target = mains[i % 2];
      if (!npc.seat) {
        await walkTo(npc, simsWorld.nearestFree(target.x + (i % 2 ? -16 : 16), target.y + 2), token);
        idle(npc, faceTo(npc, target));
        if (!target.busy) idle(target, faceTo(target, npc));
        npc.lean = npc.x < target.x ? 1 : -1;
        npc.extraRoutine = 'sway';
        world()?.emit('heart', (npc.x + target.x) / 2, npc.headY + 6, { count: 3, spread: 10, vy: -16 });
      }
      npcSay(npc, pickOne(npc.def.greet || npc.def.lines));
      await simWait(2400);
      checkToken(npc, token);
      npc.extraRoutine = null;
      npc.ox = 0;
      npc.lean = 0;
    } catch {
      // Otra orden manda.
    } finally {
      if (npc.token === token) { npc.busy = false; npc.idleSince = Date.now(); }
    }
  });
  if (simsState.dog) setTimeout(() => { if (simsState.dog) { simsState.dog.happy = true; dogBark(simsState.dog); setTimeout(() => { if (simsState.dog) simsState.dog.happy = false; }, 4000); } }, 800);
}
// Comer todos juntos: el otro y la familia se sientan a la mesa y charlan.
function joinFamilyMeal(id) {
  const action = SIM_ACTIONS[id];
  const partner = sims[partnerKeyOf()];
  if (partner && !partner.busy) doAction(partner.key, id);
  simsState.npcs.filter((npc) => !npc.def.walker && !npc.def.kid).forEach(async (npc, i) => {
    const token = ++npc.token;
    npc.busy = true;
    try {
      await simWait(300 + i * 450);
      const seat = claimObjectSeat(npc, action.object);
      if (!seat) return;
      await walkTo(npc, { ...seat.exit }, token);
      sitOn(npc, seat);
      for (let t = 0; t < action.secs * 1000 - 2000; t += 2600) {
        await simWait(2600);
        checkToken(npc, token);
        if (Math.random() < 0.6) npcSay(npc, pickOne(npc.def.lines));
        if (Math.random() < 0.3) world()?.emit('heart', npc.x, npc.headY + 6, { vy: -12 });
      }
      standUp(npc);
    } catch {
      // Otra orden manda.
    } finally {
      if (npc.token === token) {
        npc.busy = false;
        npc.idleSince = Date.now();
        if (npc.def.seat && !npc.seat) {
          const back = claimObjectSeat(npc, npc.def.seat);
          if (back) { npc.slide = null; sitOn(npc, back); }
        }
      }
    }
  });
}
// Con la familia: charlar, abrazar o dar dos besos (en España y en Italia, siempre dos).
async function npcInteract(npc, kind, { remote = false } = {}) {
  if (!remote) liveSend('npc', { id: npc.key, kind });
  const me = sims[remote ? partnerKeyOf() : meKey()];
  const token = ++me.token;
  const ntoken = ++npc.token;
  me.busy = true;
  npc.busy = true;
  me.doing = null;
  hidePie();
  try {
    await walkTo(me, simsWorld.nearestFree(npc.x + (me.x < npc.x ? -16 : 16), npc.y), token);
    idle(me, faceTo(me, npc));
    if (!npc.seat) idle(npc, faceTo(npc, me));
    const es = npc.def?.voice?.startsWith('es');
    if (kind === 'chat') {
      for (let turn = 0; turn < 4; turn += 1) {
        if (turn % 2) npcSay(npc, pickOne(npc.def.lines));
        else simBubble(me, simlish(me.key), { secs: 1.8 });
        await simWait(1900);
        checkToken(me, token);
      }
    } else {
      me.lean = me.x < npc.x ? 1 : -1;
      npc.lean = -me.lean;
      [me, npc].forEach((sim) => { sim.extraRoutine = 'sway'; });
      me.expr = 'closed';
      if (kind === 'kisses') { SMOOCH(); setTimeout(SMOOCH, 500); }
      npcSay(npc, pickOne(kind === 'kisses' ? (es ? ['¡Dos besos!', '¡Muak, muak!'] : ['Un bacio!', 'Ciao bella!']) : NPC_LINES.hug[es ? 'es' : 'it']));
      for (let i = 0; i < 6; i += 1) { await simWait(450); world()?.emit('heart', (me.x + npc.x) / 2, me.headY + 6, { vy: -14 }); }
    }
    if (!remote) {
      await boostNeeds({ social: 15, fun: 5 }).catch(() => {});
      simFloat(me, needsText({ social: 15, fun: 5 }));
    }
  } catch (error) {
    if (error !== SIM_CANCELLED) console.warn(error);
  } finally {
    [me, npc].forEach((sim) => { sim.extraRoutine = null; sim.lean = 0; sim.ox = 0; });
    if (npc.token === ntoken) { npc.busy = false; npc.idleSince = Date.now(); }
    if (me.token === token) { me.busy = false; me.expr = null; idle(me); me.idleSince = Date.now(); }
  }
}
// Kika: acariciarla o tirarle la pelota (va, la coge y te la trae).
async function doDogAction(key, id) {
  const sim = sims[key];
  const dog = simsState.dog;
  const action = SIM_ACTIONS[id];
  if (!sim || !dog) return showToast('Aquí no hay ningún perro 🐶 (Kika está en España y Loco en Chieti)');
  if (key === meKey()) liveSend('dog', { id });
  const token = ++sim.token;
  const dogToken = ++dog.token;
  sim.busy = true;
  dog.busy = true;
  sim.doing = id;
  sim.progress = { start: performance.now(), secs: action.secs };
  hidePie();
  try {
    await walkTo(sim, simsWorld.nearestFree(dog.x + (sim.x < dog.x ? -16 : 16), dog.y), token);
    idle(sim, faceTo(sim, dog));
    idle(dog, faceTo(dog, sim));
    dog.happy = true;
    sim.expr = 'happy';
    if (action.dog === 'pet') {
      setAnim(sim, 'thrust', { frames: [2, 3, 2, 3], fps: 3 });
      dog.sit = true;
      const girl = dog.breed === 'dachshund';
      simBubble(sim, sim.key === 'ines' ? (girl ? '¿Quién es la perrita más buena? 🐶' : `¡Qué bueno eres, ${dog.name}! 🐶`) : `${girl ? 'Brava' : 'Bravo'} ${dog.name}! 🐶`, { secs: 2.6 });
      for (let i = 0; i < 12; i += 1) {
        await simWait(500);
        checkToken(sim, token);
        if (i % 2 === 0) world()?.emit('heart', dog.x, dog.y - 24, { vy: -14 });
      }
    } else {
      for (let round = 0; round < 2; round += 1) {
        const target = simsWorld.nearestFree(sim.x + (sim.x < 256 ? 130 : -130), 300 + Math.random() * 60);
        setAnim(sim, 'thrust', { frames: [0, 2, 4, 5, 5], fps: 10, loop: false });
        world()?.throwItem({ x: sim.x, y: sim.y - 24 }, { x: target.x, y: target.y - 4 }, 700, 'ball');
        simBubble(sim, sim.key === 'ines' ? `¡${dog.name}, a por ella! 🎾` : `Vai ${dog.name}! 🎾`, { secs: 1.6 });
        simBlip(400, 0.06, 'triangle');
        dog.sit = false;
        await simWait(300);
        await walkTo(dog, target, dogToken);
        dog.ball = true;
        dogBark(dog);
        await walkTo(dog, simsWorld.nearestFree(sim.x + (dog.x < sim.x ? -14 : 14), sim.y), dogToken);
        dog.ball = false;
        idle(dog, faceTo(dog, sim));
        idle(sim, faceTo(sim, dog));
        world()?.emit('heart', dog.x, dog.y - 24, { count: 2, vy: -14 });
        await simWait(500);
        checkToken(sim, token);
      }
    }
    if (key === meKey()) {
      await boostNeeds(action.needs).catch(() => {});
      simFloat(sim, needsText(action.needs));
    }
  } catch (error) {
    if (error !== SIM_CANCELLED) console.warn(error);
  } finally {
    Object.assign(dog, { happy: false, sit: false, ball: false });
    if (dog.token === dogToken) { dog.busy = false; dog.idleSince = Date.now(); }
    if (sim.token === token) { sim.busy = false; sim.doing = null; sim.progress = null; sim.expr = null; idle(sim); sim.idleSince = Date.now(); }
  }
}
// Cada pocos segundos: la familia charla y pasea, los paseantes van y vienen y Kika te sigue.
function npcTick() {
  const mains = Object.values(sims);
  simsState.npcs.forEach((npc) => {
    if (npc.busy) return;
    const near = mains.some((sim) => Math.hypot(sim.x - npc.x, sim.y - npc.y) < 70);
    const idleFor = Date.now() - npc.idleSince;
    if (npc.def.walker) {
      if (idleFor > 1200) npcWalk(npc, { x: npc.x < 256 ? 470 + Math.random() * 20 : 30 + Math.random() * 20, y: npc.def.lane + (Math.random() - 0.5) * 6 });
      else if (near && Math.random() < 0.15) npcSay(npc, pickOne(npc.def.lines));
      return;
    }
    if (npc.seat) {
      if (near && Math.random() < 0.12) npcSay(npc, pickOne(npc.def.lines));
      return;
    }
    // Los niños no paran: corretean, se persiguen y se ríen.
    if (npc.def.kid) {
      if (Math.random() < 0.55) {
        const others = simsState.npcs.filter((other) => other !== npc && other.def.kid);
        const chase = Math.random() < 0.4 && others.length ? pickOne(others) : null;
        const to = chase ? { x: chase.x + (Math.random() - 0.5) * 20, y: chase.y + 4 } : { x: npc.def.home.x + (Math.random() - 0.5) * 180, y: 300 + Math.random() * 70 };
        npcWalk(npc, simsWorld.nearestFree(to.x, to.y));
        if (chase && Math.random() < 0.3) simBubble(npc, pickOne(['Ahah!', 'Prendimi!', '😆', 'Ti ho preso!']), { secs: 1.4 });
      } else if (near && Math.random() < 0.08) npcSay(npc, pickOne(npc.def.lines));
      return;
    }
    if (near && Math.random() < 0.15) {
      const sim = mains.find((other) => Math.hypot(other.x - npc.x, other.y - npc.y) < 70);
      idle(npc, faceTo(npc, sim));
      npcSay(npc, pickOne(npc.def.lines));
    } else if (idleFor > 5000 && Math.random() < 0.5) {
      npcWalk(npc, simsWorld.nearestFree(npc.def.home.x + (Math.random() - 0.5) * 80, npc.def.home.y + (Math.random() - 0.5) * 30));
    }
  });
  // Cada perro va detrás de su persona: Kika de Ines y Loco de Matteo (y de los niños).
  const dog = simsState.dog;
  const owner = sims[dog?.def?.follow] || mains[0];
  if (dog && !dog.busy && owner) {
    const kids = simsState.npcs.filter((npc) => npc.def.kid);
    const target = dog.breed === 'labrador' && kids.length && Math.random() < 0.35 ? pickOne(kids) : owner;
    const dist = Math.hypot(target.x - dog.x, target.y - dog.y);
    if (dist > 50) {
      dog.sit = false;
      npcWalk(dog, simsWorld.nearestFree(target.x + (dog.x < target.x ? -20 : 20), target.y + 6));
    } else if (Math.random() < 0.15) dogBark(dog);
    else if (Math.random() < 0.3) { dog.sit = true; idle(dog, faceTo(dog, target)); }
  }
}

// ---------- La app de verdad dentro del juego: compra, tareas, agenda y plantas ----------
function showSimsCard(className, html) {
  simsHouse.querySelector('.sims-card')?.remove();
  const card = document.createElement('div');
  card.className = `sims-card ${className}`;
  card.innerHTML = `<div class="sims-card-paper">${html}<button type="button" class="sims-card-close" data-card-close aria-label="Cerrar">✕</button></div>`;
  simsHouse.appendChild(card);
  return card;
}
const pendingShopping = () => (typeof shoppingItems !== 'undefined' && Array.isArray(shoppingItems) ? shoppingItems.filter((item) => item.status !== 'done') : []);
const dueTasks = () => {
  if (typeof householdTasks === 'undefined' || !Array.isArray(householdTasks)) return [];
  const limit = typeof addDaysToISO === 'function' ? addDaysToISO(todayISO(), 2) : todayISO();
  return householdTasks.filter((task) => task.active !== false && (!task.due_date || task.due_date <= limit)).sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
};
const eventsOn = (iso) => (typeof cachedEvents !== 'undefined' && Array.isArray(cachedEvents) ? cachedEvents.filter((event) => String(event.event_date || '').slice(0, 10) === iso).sort((a, b) => (a.event_time || '').localeCompare(b.event_time || '')) : []);

function shoppingCard() {
  const items = pendingShopping();
  const meals = typeof mealAt === 'function' ? ['lunch', 'dinner'].map((slot) => [slot, mealAt(todayISO(), slot)]).filter(([, meal]) => meal) : [];
  showSimsCard('is-note', `<h3>📝 La lista de la compra</h3>
    ${meals.length ? `<p class="sims-card-meals">${meals.map(([slot, meal]) => `<span>${slot === 'lunch' ? 'Comida' : 'Cena'}: <b>${escapeHtml(meal.title || '')}</b></span>`).join('')}</p>` : ''}
    <ul>${items.length ? items.map((item) => `<li><button type="button" data-shop-toggle="${escapeHtml(item.id)}" aria-pressed="${item.status === 'in_cart'}"><i></i>${escapeHtml(item.name || '')}${item.quantity ? ` <small>${escapeHtml(String(item.quantity))}</small>` : ''}</button></li>`).join('') : '<li class="is-empty">No falta nada 🎉</li>'}</ul>
    <form data-shop-add><input name="item" maxlength="200" placeholder="Añadir… (leche, pan y 6 huevos)" autocomplete="off" enterkeyhint="done" /><button type="submit" aria-label="Añadir">＋</button></form>
    <button type="button" class="sims-card-link" data-card-open="compra">Abrir la compra en la app</button>`);
}
function tasksCard() {
  const tasks = dueTasks();
  const today = todayISO();
  showSimsCard('is-board', `<h3>📌 Tareas pendientes</h3>
    <ul>${tasks.length ? tasks.slice(0, 8).map((task) => `<li><span>${escapeHtml(task.title)}<small>${task.due_date ? (task.due_date < today ? 'Atrasada' : task.due_date === today ? 'Hoy' : escapeHtml(typeof dueLabel === 'function' ? dueLabel(task.due_date) : task.due_date)) : ''}${task.assignee && task.assignee !== 'both' ? ` · ${escapeHtml(task.assignee)}` : ''}</small></span><button type="button" data-task-done="${escapeHtml(task.id)}">Hecho ✓</button></li>`).join('') : '<li class="is-empty">¡Nada pendiente! A descansar 🛋️</li>'}</ul>
    <button type="button" class="sims-card-link" data-card-open="tareas">Abrir las tareas en la app</button>`);
}
function agendaCard() {
  const today = todayISO();
  const tomorrow = typeof addDaysToISO === 'function' ? addDaysToISO(today, 1) : today;
  const day = (iso, label) => {
    const list = eventsOn(iso);
    return `<h4>${label}</h4><ul>${list.length ? list.map((event) => `<li><b>${event.event_time && event.event_time !== '00:00' && event.event_time !== '00:00:00' ? escapeHtml(event.event_time.slice(0, 5)) : 'Todo el día'}</b><span>${escapeHtml(event.title || '')}${event.location ? `<small>${escapeHtml(event.location)}</small>` : ''}</span></li>`).join('') : '<li class="is-empty">Nada apuntado</li>'}</ul>`;
  };
  showSimsCard('is-calendar', `<h3>📅 La agenda</h3>${day(today, 'Hoy')}${day(tomorrow, 'Mañana')}
    <button type="button" class="sims-card-link" data-card-open="calendar">Abrir el calendario</button>`);
}

// Plantas: en las macetas de la casa van vuestras plantas de la app, con su nombre y su sed.
const SPECIES_DRAW = { strelitzia: 'strelitzia', monstera: 'monstera', pothos: 'pothos', other: 'herb' };
const BIG_DRAW = ['strelitzia', 'monstera', 'snake'];
function mapPlants() {
  const list = typeof householdPlants !== 'undefined' && Array.isArray(householdPlants) ? householdPlants : [];
  const slots = simsWorld.PLANT_SLOTS;
  const out = new Array(slots.length).fill(null);
  const info = (plant, draw) => ({ id: plant.id, name: plant.name, species: plant.species, draw, mood: typeof plantState === 'function' ? plantState(plant).mood : 'ok' });
  const rest = [];
  list.forEach((plant) => {
    const draw = SPECIES_DRAW[plant.species] || 'herb';
    const index = slots.findIndex((slot, i) => !out[i] && slot.kind === draw);
    if (index >= 0) out[index] = info(plant, draw);
    else rest.push([plant, draw]);
  });
  rest.forEach(([plant, draw]) => {
    let index = slots.findIndex((slot, i) => !out[i] && BIG_DRAW.includes(slot.kind) === BIG_DRAW.includes(draw));
    if (index < 0) index = slots.findIndex((_, i) => !out[i]);
    if (index >= 0) out[index] = info(plant, draw);
  });
  return out;
}
function plantOptions(index) {
  const info = world()?.state.plants?.[index];
  const name = info?.name || 'la planta';
  return [[`plant:water:${index}`, `Regar ${name}`, '💧'], [`plant:talk:${index}`, `Hablarle a ${name}`, '🌱'], ...(info ? [[`plant:sheet:${index}`, 'Ver su ficha', '📋']] : [])];
}
async function plantAction(index, kind, { remote = false } = {}) {
  // remote: lo está haciendo el otro en su móvil (aquí solo se ve, no se riega dos veces).
  const sim = sims[remote ? partnerKeyOf() : meKey()];
  if (!remote && kind !== 'sheet') liveSend('plant', { index, kind });
  const slot = simsWorld.PLANT_SLOTS[index];
  const info = world()?.state.plants?.[index];
  if (kind === 'sheet') {
    if (info && typeof openPlantSheet === 'function') { closeSims(); setTimeout(() => openPlantSheet(info.id), 300); }
    return;
  }
  const token = ++sim.token;
  sim.busy = true;
  sim.doing = kind === 'water' ? 'water' : 'talkplant';
  sim.progress = { start: 0, secs: 5 };
  hidePie();
  try {
    await walkTo(sim, slot.spot, token);
    sim.progress = { start: performance.now(), secs: 5 };
    sim.expr = 'happy';
    if (kind === 'water') {
      sim.prop = 'can';
      setAnim(sim, 'thrust', { frames: [3, 4, 5, 4], fps: 4 });
      setProp(`plant${index}`, true);
      for (let i = 0; i < 10; i += 1) { await simWait(500); checkToken(sim, token); world()?.emit('drop', slot.x, slot.y - slot.top + 8, { vy: 30, spread: 10 }); }
      setProp(`plant${index}`, false);
      // De verdad: queda regada en la app (y le llega el aviso al otro).
      if (remote) { /* El riego de verdad lo guarda su móvil. */ } else if (info && typeof waterPlant === 'function') await waterPlant(info.id);
      else { await boostNeeds({ fun: 10 }).catch(() => {}); simFloat(sim, needsText({ fun: 10 })); }
      if (world()) world().state.plants = mapPlants();
      simBubble(sim, info ? `${info.name}, ¡ya tienes agua! 💧` : '¡Ya está! 💧', { secs: 2.2 });
    } else {
      simBubble(sim, sayLine(sim.key, sim.key === 'matteo' ? [`Ciao ${info?.name || 'piantina'}, come stai?`, 'Che belle foglie!'] : [`Hola, ${info?.name || 'bonita'}, ¿qué tal?`, '¡Qué hojas tan bonitas!']), { secs: 2.6 });
      for (let i = 0; i < 10; i += 1) { await simWait(500); checkToken(sim, token); }
      if (!remote) await boostNeeds({ social: 5, fun: 5 }).catch(() => {});
    }
  } catch (error) {
    if (error !== SIM_CANCELLED) console.warn(error);
  } finally {
    if (sim.token === token) { sim.busy = false; sim.doing = null; sim.progress = null; sim.prop = null; sim.expr = null; idle(sim); sim.idleSince = Date.now(); }
  }
}
// Lo que se ve en la casa con datos de la app: nota de la nevera, corcho, calendario y plantas.
function refreshAppData() {
  const w = world();
  if (!w) return;
  w.state.data = { shopping: pendingShopping().length, tasks: dueTasks().filter((task) => !task.due_date || task.due_date <= todayISO()).length, events: eventsOn(todayISO()).length, day: new Date().getDate() };
  w.state.plants = mapPlants();
}

// ---------- Tiempo real: los dos en la misma partida desde cada móvil ----------
// Un canal de Supabase Realtime por hogar: cada móvil avisa al otro al instante de lo que hace
// su muñeco (andar, acciones, interacciones, viajes, volver a casa, plantas, familia, perros)
// y el otro lo reproduce. La presencia dice si el otro está jugando ahora mismo; entonces su
// muñeco no hace nada por su cuenta en tu pantalla (lo mueve él). Si el otro no está, su
// muñeco sigue con el libre albedrío y con lo que guardó en la base de datos.
const live = { channel: null, ready: false, partnerOnline: false, lastPos: null, posTimer: null };
const canLive = () => typeof supabaseClient !== 'undefined' && supabaseClient && typeof authUserId !== 'undefined' && authUserId && typeof householdId !== 'undefined' && householdId;
function liveSend(type, data = {}) {
  if (!live.channel || !live.ready) return;
  try {
    const result = live.channel.send({ type: 'broadcast', event: 'sims', payload: { type, from: meKey(), scene: curScene(), ...data } });
    result?.catch?.(() => {});
  } catch {}
}
const myPos = () => { const me = sims[meKey()]; return me ? { x: Math.round(me.x), y: Math.round(me.y), dir: me.dir } : null; };
function liveConnect() {
  if (!canLive() || live.channel) return;
  const person = myAvatarPerson();
  try {
    live.channel = supabaseClient.channel(`umbral-sims-${householdId}`, { config: { broadcast: { self: false }, presence: { key: person } } });
    live.channel
      .on('broadcast', { event: 'sims' }, ({ payload }) => onLive(payload))
      .on('presence', { event: 'sync' }, () => {
        const online = Boolean(live.channel?.presenceState()?.[otherPerson(person)]?.length);
        if (online !== live.partnerOnline) {
          live.partnerOnline = online;
          const partner = sims[partnerKeyOf()];
          if (partner && online) simBubble(partner, '👋', { kind: 'emote', secs: 1.6 });
        }
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        live.ready = true;
        try { await live.channel.track({ scene: curScene(), at: Date.now() }); } catch {}
        liveSend('hello', { pos: myPos() });
      });
  } catch (error) {
    console.warn('[Umbral] Tiempo real:', error);
    live.channel = null;
  }
  // Cada poco, dónde está tu muñeco (por si se ha movido sin una orden clara).
  clearInterval(live.posTimer);
  live.posTimer = setInterval(() => {
    const pos = myPos();
    const me = sims[meKey()];
    if (!pos || !live.partnerOnline || me?.busy) return;
    if (live.lastPos && Math.hypot(pos.x - live.lastPos.x, pos.y - live.lastPos.y) < 4) return;
    live.lastPos = pos;
    liveSend('pos', pos);
  }, 1500);
}
function liveDisconnect() {
  clearInterval(live.posTimer);
  if (!live.channel) return;
  try { live.channel.untrack(); supabaseClient.removeChannel(live.channel); } catch {}
  Object.assign(live, { channel: null, ready: false, partnerOnline: false, lastPos: null });
}
// El muñeco del otro anda a donde le ha mandado él.
function remoteWalk(partner, to) {
  const token = ++partner.token;
  partner.busy = true;
  partner.doing = null;
  walkTo(partner, { x: to.x, y: to.y, dir: to.dir }, token).catch(() => {}).finally(() => {
    if (partner.token === token) { partner.busy = false; partner.idleSince = Date.now(); }
  });
}
function markPokeSeen(at) {
  if (!at || typeof readAvatarSeen !== 'function') return;
  const seen = readAvatarSeen();
  seen[`poke-${simPerson(partnerKeyOf())}`] = at;
  writeAvatarSeen(seen);
}
// Ir a donde esté el otro (otra escena): con su pantallita de viaje.
function followScene(scene) {
  if (!scene || scene === curScene()) return;
  if (scene === 'house') goHome({ incoming: true });
  else if (TRIPS[scene]) doTrip(scene, { incoming: true });
}
function onLive(msg) {
  if (!simsState.open || !msg || msg.from === meKey()) return;
  const partner = sims[partnerKeyOf()];
  if (!partner) return;
  live.partnerOnline = true;
  // Si estáis en sitios distintos, primero te vas con él (salvo que lo que llegue sea un viaje).
  const travelling = msg.type === 'home' || (msg.type === 'social' && SOCIALS[msg.kind]?.trip);
  // Mensajes, ropa, decoración, fotos y minijuego valen estés donde estés.
  const anywhere = ['chat', 'outfit', 'decor', 'photo', 'game'].includes(msg.type);
  if (msg.scene && msg.scene !== curScene() && !travelling && msg.type !== 'hello' && !anywhere) { followScene(msg.scene); return; }
  switch (msg.type) {
    case 'hello':
      liveSend('state', { pos: myPos() });
      if (msg.scene === curScene() && msg.pos && !partner.busy) Object.assign(partner, { x: msg.pos.x, y: msg.pos.y });
      else if (msg.scene !== curScene() && msg.scene !== 'house') followScene(msg.scene);
      break;
    case 'state':
      if (msg.scene !== curScene()) followScene(msg.scene);
      else if (msg.pos && !partner.busy) { Object.assign(partner, { x: msg.pos.x, y: msg.pos.y }); idle(partner, msg.pos.dir || 'down'); }
      break;
    case 'walk':
    case 'pos':
      if (msg.type === 'pos' && (partner.busy || Math.hypot(partner.x - msg.x, partner.y - msg.y) < 8)) break;
      remoteWalk(partner, msg);
      break;
    case 'act':
      partner.seenActivity = msg.at;
      doAction(partner.key, msg.id);
      break;
    case 'social':
      markPokeSeen(msg.at);
      doSocial(msg.kind, { incoming: true, rejected: msg.rejected || null });
      break;
    case 'home':
      goHome({ incoming: true });
      break;
    case 'plant':
      plantAction(msg.index, msg.kind, { remote: true });
      break;
    case 'npc': {
      const npc = simsState.npcs.find((other) => other.key === msg.id);
      if (npc) npcInteract(npc, msg.kind, { remote: true });
      break;
    }
    case 'dog':
      doDogAction(partner.key, msg.id);
      break;
    case 'cancel':
      partner.token += 1;
      stopSim(partner);
      standUp(partner);
      Object.assign(partner, { busy: false, doing: null, idleSince: Date.now() });
      break;
    case 'chat': {
      const text = String(msg.text || '').slice(0, 120);
      if (!text) break;
      simBubble(partner, text, { secs: Math.min(7, 2.5 + text.length / 14) });
      pushChat(simPerson(partner.key), text);
      simBlip(1180, 0.06);
      break;
    }
    case 'outfit':
      pickOutfit(msg.id, { key: partner.key, remote: true });
      break;
    case 'decor':
      if (msg.decor && (!simsState.decorAt || String(msg.at) > simsState.decorAt)) {
        applyDecor(msg.decor, msg.at);
        const card = simsHouse.querySelector('.sims-card.is-decor');
        if (card) decorCard();
        simBubble(partner, '🎨', { kind: 'emote', secs: 1.6 });
      }
      break;
    case 'photo':
      takeSimPhoto({ remote: true });
      simBubble(partner, '📸 ¡Patata!', { secs: 2 });
      break;
    case 'game':
      simBubble(partner, `🦈 ${msg.record ? '¡Récord! ' : ''}${Number(msg.score) || 0} puntos`, { secs: 3.5 });
      break;
    case 'event':
    case 'event-choice':
      window.simsLife?.onRemote(msg);
      break;
    case 'wave':
      setAnim(partner, 'emote', { dir: 'down', frames: [0, 2, 1, 2], fps: 4 });
      simBubble(partner, simlish(partner.key), { secs: 2 });
      setTimeout(() => { if (!partner.busy) idle(partner); }, 2400);
      break;
    default:
  }
}
// Al abrir: si uno de los dos se fue de viaje hace poco, empezáis allí los dos.
function startWherePartnerIs() {
  const rows = [avatarRows[myAvatarPerson()], avatarRows[otherPerson(myAvatarPerson())]]
    .filter((row) => row?.place && row.place_at && Date.now() - Date.parse(row.place_at) < 10 * 3600000)
    .sort((a, b) => Date.parse(b.place_at) - Date.parse(a.place_at));
  const latest = rows[0];
  simsState.placeSeen = latest?.place_at || '';
  if (!latest || latest.place === 'house' || !TRIPS[latest.place]) return;
  enterScene(latest.place);
  const trip = TRIPS[latest.place];
  [sims[meKey()], sims[partnerKeyOf()]].forEach((sim) => {
    Object.assign(sim, { x: trip.arrive[slotOf(sim)].x + 30, y: trip.arrive[slotOf(sim)].y });
    idle(sim, 'down');
    checkOutfit(sim, false);
  });
}
// Si el otro se ha ido a otro sitio (aunque no estuviera jugando a la vez), le sigues.
function followPartnerPlace() {
  const row = avatarRows[otherPerson(myAvatarPerson())];
  if (!row?.place || !row.place_at || row.place_at <= (simsState.placeSeen || '')) return;
  simsState.placeSeen = row.place_at;
  if (Date.now() - Date.parse(row.place_at) > 10 * 3600000) return;
  followScene(row.place);
}

// ---------- Interacciones entre los dos ----------
// incoming: la ha empezado el otro (llega por 'umbral:poke').
async function doSocial(kind, { incoming = false, rejected = null } = {}) {
  const me = sims[meKey()];
  const partner = sims[partnerKeyOf()];
  if (!me || !partner || !SOCIALS[kind]) return;
  const at = new Date().toISOString();
  // Como en los Sims, el otro puede decir que no (si está enfadado, agotado…).
  const refusal = incoming ? rejected : socialVerdict(kind);
  if (!incoming) liveSend('social', { kind, at, rejected: refusal });
  if (SOCIALS[kind].trip) return doTrip(kind, { incoming, at });
  // Lo de casa (sofá, cama, cojines…) solo se puede hacer en casa.
  if (SOCIALS[kind].home && curScene() !== 'house') return showToast('Eso mejor en casa 🏠');
  const config = SOCIALS[kind];
  const actor = incoming ? partner : me;
  const target = incoming ? me : partner;
  const tokens = [++me.token, ++partner.token];
  const tokenOf = (sim) => (sim === me ? tokens[0] : tokens[1]);
  [me, partner].forEach((sim) => { sim.busy = true; sim.doing = `social-${kind}`; sim.socialKind = kind; sim.progress = null; stopSim(sim); });
  hidePie();
  if (kind === 'spoon' || kind === 'woohoo') [me, partner].forEach((sim) => setOutfit(sim, 'pajamas'));
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
      const spots = curScene() === 'house' ? SELFIE_SPOTS : sceneObj('mole')?.selfie || { ines: simsWorld.nearestFree(me.x, me.y), matteo: simsWorld.nearestFree(me.x + 10, me.y + 8) };
      await Promise.all(both.map((sim) => walkTo(sim, { ...spots[sim.key], dir: curScene() === 'house' || curScene() === 'turin' ? 'up' : 'down' }, tokenOf(sim))));
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
      const c0 = curScene() === 'house' ? { x: 236, y: 306 } : simsWorld.nearestFree((actor.x + target.x) / 2, (actor.y + target.y) / 2);
      simsState.danceCenter = c0;
      await Promise.all([walkTo(actor, { x: c0.x - 8, y: c0.y }, tokenOf(actor)), walkTo(target, { x: c0.x + 8, y: c0.y }, tokenOf(target))]);
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

    if (refusal) {
      // Rechazo: el otro niega con la cabeza y al que lo intenta se le queda cara de pena.
      target.expr = 'eyeroll';
      setAnim(target, 'emote', { dir: faceTo(target, actor), frames: [0, 1, 0, 1], fps: 4, loop: false });
      simBubble(target, refusal, { secs: 2.8 });
      await simWait(1400);
      alive();
      actor.expr = 'sad';
      simBubble(actor, '😔', { kind: 'emote', secs: 1.8 });
      simBlip(220, 0.18, 'triangle');
      const life = getLife();
      life.rel.friend = Math.max(0, life.rel.friend - 2);
      saveLife();
      await simWait(1800);
      return;
    }

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
      w?.emit('heart', curScene() === 'house' ? 317 : me.x, curScene() === 'house' ? 214 : me.headY, { count: 5, spread: 20, vy: -14 });
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
      both.forEach((sim) => { sim.lean = (sim.x < other(sim).x ? 1 : -1) * (long ? 1.5 : 1); sim.extraRoutine = 'sway'; sim.expr = 'closed'; });
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
      const center = simsState.danceCenter || { x: 236, y: 306 };
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

    // Relación y carisma.
    relChange(kind);
    if (!incoming && ['friendly', 'fun', 'romance'].includes(config.cat)) gainSkill('charisma', 8);
    if (!incoming) addCoins(3);
    // Necesidades: a los dos les afecta (al otro, en su móvil, cuando le llega el toque).
    const delta = config.needs || { social: 25, fun: 5 };
    if (!incoming) {
      const person = myAvatarPerson();
      await boostNeeds(delta, { poke: kind, poke_at: at });
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
      Object.assign(sim, { routine: null, extraRoutine: null, prop: null, expr: null, lean: 0, ox: 0, oy: 0, hidden: false, socialKind: null });
      idle(sim);
      sim.busy = false;
      sim.doing = null;
      sim.idleSince = Date.now();
    });
    setTimeout(runQueued, 500);
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
  w.endPan();
  liveSend('walk', { x: Math.round(point.x), y: Math.round(point.y) });
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
  // Lista ordenada junto al dedo (una columna, o dos si hay muchas opciones): nunca se solapan
  // y siempre caben dentro de la casa.
  pie.classList.add('is-list');
  const list = document.createElement('div');
  list.className = `sims-pie-list${options.length > 5 ? ' is-two' : ''}`;
  list.append(...pie.querySelectorAll('.sims-pie-option'));
  pie.appendChild(list);
  const titleEl = pie.querySelector('.sims-pie-title');
  list.prepend(titleEl);
  const lw = list.offsetWidth;
  const lh = list.offsetHeight;
  const gap = 18;
  let left = x + gap + lw <= box.width - 6 ? x + gap : x - gap - lw;
  left = Math.min(Math.max(left, 6), Math.max(6, box.width - lw - 6));
  const top = Math.min(Math.max(y - lh / 2, 6), Math.max(6, box.height - lh - 6));
  list.style.left = `${left}px`;
  list.style.top = `${top}px`;
}

const pokeOption = (kind, withName = false) => {
  const poke = avatarCatalog().POKES[kind];
  return [`social:${kind}`, withName ? `${poke.label} con ${simPerson(partnerKeyOf())}` : poke.label, poke.emoji];
};
const objectOptions = (id) => {
  if (/^plant\d$/.test(id || '')) return plantOptions(Number(id.slice(5)));
  const info = SIM_OBJECTS[id];
  if (!info) return [];
  return [...info.actions.map((action) => [`act:${action}`, actionLabel(action), SIM_ACTIONS[action].emoji]), ...(info.social || []).map((kind) => pokeOption(kind, true))];
};
// Al tocar al otro: primero la categoría y luego la interacción. Si estáis enfadados,
// la categoría de enfado sale la primera.
function partnerMenu() {
  const angry = Object.values(sims).some((sim) => sim.angryUntil > Date.now());
  const cats = angry ? [SOCIAL_CATS[4], ...SOCIAL_CATS.slice(0, 4), SOCIAL_CATS[5]] : SOCIAL_CATS;
  return cats.map(([id, label, emoji]) => [`cat:${id}`, label, emoji]);
}

function handleHouseTap(event) {
  const w = world();
  if (!w || event.target.closest('.sims-pie-option') || event.target.closest('.sims-hud') || event.target.closest('.sims-photo-card')) return;
  if (window.simsBuild?.isOn()) return event.target.closest('.sims-build') ? null : window.simsBuild.tap(event);
  if (event.target.closest('.sims-pie')) return hidePie();
  if (simsHouse.querySelector('.sims-pie')) return hidePie();
  if (event.target.closest('.sims-travel')) return;
  const point = w.toWorld(event.clientX, event.clientY);
  const actor = w.actorAt(point.x, point.y);
  const objectId = w.objectAt(point.x, point.y);
  const me = meKey();
  if (actor && actor.key === me) {
    // Si tu muñeco está delante de un objeto, sus acciones también salen en el menú.
    const own = [['own:look', 'Muñeco del jardín', '👕'], ['own:mood', 'Cómo me siento', '😊'], ['own:need', '¿Qué me falta?', '💭'], ['own:wave', 'Saludar', '👋']];
    const extra = curScene() !== 'house' ? [['home:go', 'Volver a casa', '🏠']] : [];
    return showPie(event, `${simPerson(me)} (tú)`, [...objectOptions(objectId).filter(([id]) => !id.startsWith('social:')), ...extra, ...own].slice(0, 7));
  }
  if (actor?.kind === 'dog') return showPie(event, `🐶 ${actor.name}`, [['act:petkika', `Acariciar a ${actor.name}`, '🐶'], ['act:fetch', `Tirarle la pelota a ${actor.name}`, '🎾']]);
  if (actor?.npc) {
    simsState.pieNpc = actor;
    return showPie(event, actor.name, [['npc:chat', 'Charlar', '💬'], ['npc:hug', 'Un abrazo', '🤗'], ['npc:kisses', 'Dos besos', '😘']]);
  }
  if (actor) return showPie(event, simPerson(actor.key), partnerMenu());
  if (/^plant\d$/.test(objectId || '')) {
    const info = w.state.plants?.[Number(objectId.slice(5))];
    const thirsty = info && ['thirsty', 'parched'].includes(info.mood);
    return showPie(event, info ? `${info.name}${thirsty ? ' · tiene sed' : ''}` : 'Planta', objectOptions(objectId), w.hitRect(objectId));
  }
  if (objectId && SIM_OBJECTS[objectId]) return showPie(event, SIM_OBJECTS[objectId].label, objectOptions(objectId), w.hitRect(objectId));
  walkHere(point);
}

function handlePieChoice(id) {
  const [type, value] = id.split(':');
  simBlip(1180, 0.06);
  if (type === 'cat') {
    const at = simsState.pieAt || { clientX: 0, clientY: 0 };
    const cat = SOCIAL_CATS.find(([catId]) => catId === value);
    const options = Object.entries(SOCIALS).filter(([kind, social]) => social.cat === value && !(social.home && curScene() !== 'house') && kind !== curScene()).map(([kind]) => pokeOption(kind));
    return showPie(at, `${cat[2]} ${cat[1]}`, options, at.rect);
  }
  hidePie();
  const me = sims[meKey()];
  if (type === 'plant') {
    const [, act, index] = id.split(':');
    return plantAction(Number(index), act);
  }
  if (type === 'npc') return simsState.pieNpc && npcInteract(simsState.pieNpc, value);
  if (type === 'act' || type === 'social') {
    const label = type === 'act' ? SIM_ACTIONS[value] : avatarCatalog().POKES[value];
    return queueOrRun({ type, value, emoji: label?.emoji || '•' });
  }
  if (type === 'home') return goHome();
  if (value === 'look') return openAvatarEditor('clothes');
  if (value === 'mood') return openAvatarEditor('mood');
  if (value === 'wave') {
    liveSend('wave');
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
  const label = doing ? `${SIM_ACTIONS[doing].emoji} ${ACTION_VERB[doing] || SIM_ACTIONS[doing].label}` : social ? `${social.emoji} ${social.label}` : me?.path?.length ? (me.run ? '🏃 Corriendo' : '🚶 Andando') : '';
  const trip = TRIPS[curScene()];
  const temp = world()?.state.weather.temp;
  const weather = Number.isFinite(Number(temp)) ? ` · ${Math.round(curScene() === 'house' ? temp : outsideTemp())}°` : '';
  const coins = Math.round(getLife().coins);
  const queue = simsState.queue.map((entry) => entry.emoji).join('');
  const key = `${label}|${clock}|${curScene()}|${weather}|${live.partnerOnline}|${coins}|${queue}`;
  if (hud.dataset.key !== key) {
    hud.dataset.key = key;
    hud.innerHTML = `<div class="sims-hud-main"><div class="sims-hud-action"${label ? '' : ' hidden'}><span>${escapeHtml(label)}</span>${doing || social ? '<button type="button" class="sims-hud-cancel" aria-label="Dejar de hacerlo">✕</button>' : ''}<i class="sims-hud-bar"><b></b></i></div>${simsState.queue.length ? `<div class="sims-hud-queue">${simsState.queue.map((entry, i) => `<button type="button" data-queue="${i}" aria-label="Quitar de la cola">${entry.emoji}</button>`).join('')}</div>` : ''}</div><div class="sims-hud-side"><div class="sims-hud-clock">${clock}${weather} · <b class="sims-hud-coins">§${coins}</b></div>${live.partnerOnline ? `<div class="sims-hud-live">🟢 ${escapeHtml(simPerson(partnerKeyOf()) || '')} está jugando</div>` : ''}${trip ? `<button type="button" class="sims-hud-home">🏠 Volver a casa</button>` : ''}</div>`;
  }
  const bar = hud.querySelector('.sims-hud-bar b');
  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
}

// ---------- Panel de necesidades ----------
function renderSimsNeeds() {
  const panel = document.querySelector('#simsNeeds');
  if (!panel) return;
  const skillsOpen = panel.querySelector('.sims-skills')?.open;
  const me = myAvatarPerson();
  const partner = otherPerson(me);
  const person = simsState.needsOf === 'me' ? me : partner;
  const needs = currentNeeds(avatarRows[person]);
  const level = needsLevel(needs);
  const color = (value) => (value > 60 ? 'is-good' : value > 30 ? 'is-mid' : 'is-low');
  panel.innerHTML = `
    <div class="sims-needs-head">
      <div class="segmented">${[[me, 'me'], [partner, 'partner']].map(([name, who]) => `<button type="button" data-needs-who="${who}" aria-pressed="${simsState.needsOf === who}">${escapeHtml(name)}${who === 'me' ? ' (tú)' : ''}</button>`).join('')}</div>
      ${simsState.needsOf === 'me' && window.simsLife?.bestTitle() ? `<span class="sims-title">${escapeHtml(window.simsLife.bestTitle())}</span>` : ''}<span class="sims-plumbob is-${level}" title="Cómo está"></span>
    </div>
    <div class="sims-needs-grid">${Object.entries(NEEDS).map(([key, need]) => `<div class="sims-need"><span class="sims-need-emoji">${need.emoji}</span><div><small>${need.label}</small><span class="sims-need-track"><span class="${color(needs[key])}" style="width:${needs[key]}%"></span></span></div></div>`).join('')}</div>
    ${window.simsMind ? (() => { const id = window.simsMind.emotionOf(person); const emotion = window.simsMind.EMOTIONS[id]; return `<div class="sims-emotion is-${id}"><span>${emotion.emoji}</span><b>${escapeHtml(window.simsMind.emotionLabel(person, id).replace(/^\S+\s/, ''))}</b><small>${escapeHtml(emotion.text)}</small></div>`; })() : ''}
    <div class="sims-moodlets">${moodlets(person).map(([emoji, text]) => `<span title="${escapeHtml(text)}">${emoji} <em>${escapeHtml(text)}</em></span>`).join('')}</div>
    ${simsState.needsOf === 'me' ? (() => {
      const life = getLife();
      return `${avatarRows[me] ? wantsMarkup() : ''}<div class="sims-rel"><small>Con ${escapeHtml(partner)}</small><div><span>🤝</span><i><b style="width:${life.rel.friend}%"></b></i><span>💗</span><i class="is-romance"><b style="width:${life.rel.romance}%"></b></i></div></div>
      <details class="sims-skills"><summary>🌟 Habilidades · §${Math.round(life.coins)}</summary><div>${Object.entries(SKILLS).map(([id, [emoji, name]]) => { const xp = life.skills[id] || 0; const lv = skillLevel(xp); const next = 14 * (lv + 1) ** 2; const prev = 14 * lv ** 2; return `<p><span>${emoji} ${name}</span><b>${lv}</b><i><b style="width:${lv >= 10 ? 100 : Math.round(((xp - prev) / (next - prev)) * 100)}%"></b></i></p>`; }).join('')}</div></details>`;
    })() : ''}`;
  if (skillsOpen) panel.querySelector('.sims-skills')?.setAttribute('open', '');
}

// Monedas por usar la app de verdad: tareas, recetas, riego, fotos y planes.
const LIFE_REWARDS = { task: 20, cook: 15, water: 10, moment: 15, plan: 10, upkeep: 15 };
window.addEventListener('umbral:life', (event) => {
  const amount = LIFE_REWARDS[event.detail?.kind];
  if (!amount || !myAvatarPerson()) return;
  addCoins(amount, simsState.open ? sims[meKey()] : null);
  wantProgress({ life: event.detail.kind });
  window.simsLife?.stat('real');
});

// ---------- Deseos de hoy (como los deseos de los Sims) ----------
// Cada día, cada uno tiene tres deseos: dos dentro de la casa y uno de la vida real. Cumplirlos
// da monedas; con los tres, premio extra. Se guardan en look.wants junto con lo demás.
const WANTS = {
  cook: ['🍳', 'Cocinar algo rico', { act: ['cook'] }, 25],
  dance: ['💃', 'Bailar un rato', { act: ['dance'] }, 20],
  yoga: ['🧘', 'Hacer yoga', { act: ['yoga'] }, 20],
  read: ['📚', 'Leer un rato', { act: ['readsofa', 'readbed', 'read', 'beanread'] }, 20],
  bath: ['🛁', 'Darse un baño relajante', { act: ['bath'] }, 20],
  puzzle: ['🧩', 'Avanzar el puzzle', { act: ['puzzle'] }, 25],
  sing: ['🎤', 'Cantar a pleno pulmón', { act: ['sing'] }, 20],
  tv: ['📺', 'Ver la tele en el sofá', { act: ['tv'] }, 15],
  kiss: ['💋', 'Dar un beso a {p}', { social: ['kiss', 'makeout'] }, 25],
  hug: ['🤗', 'Abrazar a {p}', { social: ['hug', 'cuddle'] }, 20],
  laugh: ['🎉', 'Pasarlo bien con {p}', { cat: ['fun'] }, 25],
  compliment: ['💬', 'Decirle algo bonito a {p}', { social: ['compliment', 'chat'] }, 15],
  trip: ['✈️', 'Salir de excursión juntos', { trip: true }, 40],
  game: ['🕹️', 'Echar una partida en la sala de juegos', { game: true }, 25],
  photo: ['📸', 'Haceros una foto en casa', { photo: true }, 20],
  task: ['✅', 'Hacer una tarea de verdad', { life: ['task'] }, 40, true],
  water: ['🪴', 'Regar una planta de verdad', { life: ['water'] }, 30, true],
  moment: ['📷', 'Subir una foto a Nosotros', { life: ['moment'] }, 35, true],
  upkeep: ['🛠️', 'Cuidar la casa en Casa al día', { life: ['upkeep'] }, 35, true],
  recipe: ['🥘', 'Cocinar algo del menú', { life: ['cook'] }, 30, true],
  plan: ['🍿', 'Apuntar o cumplir un plan juntos', { life: ['plan'] }, 25, true]
};
const WANTS_BONUS = 50;
const wantDay = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// Elección estable para el día y la persona (no cambia al recargar).
function wantPick(seedText, list, count) {
  let seed = [...seedText].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  return list.map((id) => [rand(), id]).sort((a, b) => a[0] - b[0]).slice(0, count).map(([, id]) => id);
}
function todaysWants() {
  const life = getLife();
  const day = wantDay();
  if (life.wants?.day !== day) {
    const person = myAvatarPerson() || 'yo';
    const ids = Object.keys(WANTS);
    // Uno de los deseos de casa sale de lo que le gusta por su personalidad (si hay).
    const liked = (window.simsMind?.likedWants() || []).filter((id) => WANTS[id] && !WANTS[id][4]);
    const fav = liked.length ? wantPick(`${day}|${person}|gusto`, liked, 1) : [];
    const house = [...fav, ...wantPick(`${day}|${person}|casa`, ids.filter((id) => !WANTS[id][4] && !fav.includes(id)), 2 - fav.length)];
    life.wants = { day, done: [], list: [...house, ...wantPick(`${day}|${person}|vida`, ids.filter((id) => WANTS[id][4]), 1)] };
  }
  return life.wants;
}
const wantText = (id) => WANTS[id][1].replace('{p}', otherPerson(myAvatarPerson()) || 'tu pareja');
function wantMatches(id, event) {
  const rule = WANTS[id][2];
  if (rule.act && event.act) return rule.act.includes(event.act);
  if (rule.social || rule.cat) return Boolean(rule.social?.includes(event.social) || rule.cat?.includes(event.cat));
  if (rule.life && event.life) return rule.life.includes(event.life);
  return Boolean((rule.trip && event.trip) || (rule.game && event.game) || (rule.photo && event.photo));
}
function wantProgress(event) {
  if (!myAvatarPerson() || !avatarRows[myAvatarPerson()]) return;
  const wants = todaysWants();
  const hit = wants.list.find((id) => !wants.done.includes(id) && wantMatches(id, event));
  if (!hit) return;
  wants.done.push(hit);
  window.simsLife?.stat('wants');
  window.simsLife?.diary('⭐', `Deseo cumplido: ${wantText(hit)}`);
  const me = simsState.open ? sims[meKey()] : null;
  const [emoji, , , coins] = WANTS[hit];
  addCoins(coins, me);
  pushEvent('want');
  if (me) {
    simBubble(me, `⭐ ¡Deseo cumplido! ${emoji}`, { secs: 3 });
    world()?.emit('sparkle', me.x, me.headY + 6, { count: 14, spread: 24, vy: -18 });
    simTune([659, 880, 1175], 110, 'triangle');
  } else {
    showToast(`⭐ Deseo cumplido en vuestra casa: ${wantText(hit)} (+§${coins})`);
  }
  if (wants.done.length === wants.list.length) {
    setTimeout(() => {
      addCoins(WANTS_BONUS, me);
      showToast(`🌟 ¡Día redondo! Los tres deseos cumplidos (+§${WANTS_BONUS})`);
      if (me) simTune([523, 659, 784, 1047, 1319], 120, 'triangle');
    }, me ? 1400 : 2600);
  }
  saveLife();
  if (simsState.open) renderSimsNeeds();
}
// Tocar un deseo te pone en marcha: lo de casa entra en la cola; lo real abre su sección.
function startWant(id) {
  const rule = WANTS[id]?.[2];
  if (!rule) return;
  const [emoji] = WANTS[id];
  if (rule.act) {
    const act = rule.act.find((action) => SIM_ACTIONS[action]);
    if (act) return queueOrRun({ type: 'act', value: act, emoji });
  }
  if (rule.social) return queueOrRun({ type: 'social', value: rule.social[0], emoji });
  if (rule.cat) return queueOrRun({ type: 'social', value: 'tickle', emoji });
  if (rule.trip) return curScene() === 'house' ? queueOrRun({ type: 'social', value: 'turin', emoji }) : showToast('¡Ya estáis de excursión! 🧳');
  if (rule.game) return gamesCard();
  if (rule.photo) return takeSimPhoto();
  if (rule.life) {
    const go = { task: () => openPending({ filter: 'all' }), water: () => showView('plantas'), moment: () => { showView('nosotros'); setUsView?.('photos'); }, upkeep: () => { showView('personal'); setTimeout(() => document.querySelector('#upkeepSection')?.scrollIntoView({ behavior: 'smooth' }), 80); }, cook: () => showView('menu'), plan: () => { showView('nosotros'); setUsView?.('plans'); } }[rule.life[0]];
    closeSims();
    setTimeout(() => { try { go?.(); } catch (error) { console.warn('[Umbral] Deseo:', error); } }, 120);
  }
}
function wantsMarkup() {
  const wants = todaysWants();
  const done = wants.done.length;
  return `<div class="sims-wants">
    <p class="sims-wants-head"><span>⭐ Deseos de hoy</span><b>${done}/${wants.list.length}${done === wants.list.length ? ' · ¡día redondo!' : ''}</b></p>
    <div class="sims-wants-list">${wants.list.map((id) => {
      const [emoji, , , coins, real] = WANTS[id];
      const isDone = wants.done.includes(id);
      return `<button type="button" class="sims-want${isDone ? ' is-done' : ''}${real ? ' is-real' : ''}" data-want="${id}" ${isDone ? 'disabled' : ''}><span class="sims-want-emoji">${emoji}</span><span class="sims-want-copy"><em>${escapeHtml(wantText(id))}</em>${real ? '<small>En la vida real</small>' : ''}</span><b>${isDone ? '✓' : `§${coins}`}</b></button>`;
    }).join('')}</div>
  </div>`;
}

// ---------- Abrir, cerrar, gestos cuando están quietos y libre albedrío ----------
const timeOfDay = (hour) => (hour < 7 || hour >= 21 ? 'night' : hour < 9 || hour >= 19 ? 'dusk' : 'day');

function updateClock() {
  const w = world();
  if (!w) return;
  w.state.time = timeOfDay(new Date().getHours());
  // Las lámparas se encienden poco a poco según oscurece (ciclo de día y noche continuo).
  const dark = simsWorld.dayPhase().dark;
  w.state.lamps = !w.state.blackout && (curScene() === 'house' ? dark > 0.2 : dark > 0.55);
  if (window.umbralWeather) w.state.weather = { code: Number(window.umbralWeather.code ?? 1), temp: Number(window.umbralWeather.temp ?? 18) };
}

function buildSims() {
  simsState.world?.destroy();
  simsState.bubbles = [];
  const w = simsWorld.createWorld(simsHouse);
  simsState.world = w;
  simsHouse.insertAdjacentHTML('beforeend', `<div class="sims-hud"></div><div class="sims-chatlog" aria-live="polite"></div><div class="sims-toolbar">${SIM_TOOLS.map(([id, emoji, label, short]) => `<button type="button" data-tool="${id}" aria-label="${label}" title="${label}"><span class="sims-tool-emoji">${emoji}</span><span class="sims-tool-label">${short}</span></button>`).join('')}</div>`);
  Object.keys(propUsers).forEach((prop) => { propUsers[prop] = 0; });
  const starts = [{ x: 210, y: 300 }, { x: 262, y: 310 }];
  [meKey(), partnerKeyOf()].forEach((key) => {
    const slot = simPerson(key) === householdPeople[0] ? 0 : 1;
    sims[key] = newSim(key, starts[slot].x, starts[slot].y);
    idle(sims[key], slot ? 'left' : 'right');
  });
  Object.keys(sims).forEach((key) => { if (![meKey(), partnerKeyOf()].includes(key)) delete sims[key]; });
  simsState.npcs = [];
  simsState.dog = null;
  syncActors();
  w.state.follow = sims[meKey()];
  w.state.zoom = simsState.zoom;
  updateClock();
  updateSceneTitle();
  refreshAppData();
  Object.values(sims).forEach((sim) => checkOutfit(sim, false));
}

function frame(t) {
  if (!simsState.open) return;
  simsState.raf = requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(0.05, (t - (simsState.last || t)) / 1000);
  simsState.last = t;
  everyone().concat(simsState.dog ? [simsState.dog] : []).forEach((sim) => {
    // Si otra orden manda, deja de andar hacia donde iba.
    if (sim.path.length && sim.walkToken !== sim.token) stopSim(sim);
    stepSim(sim, dt, t);
  });
  // El tranvía de Turín pasa de vez en cuando (con su campanita).
  const w = world();
  if (curScene() === 'turin') {
    if (!w.state.tram && t > simsState.nextTram) {
      w.state.tram = { x: -130, v: 46 };
      simTune([1320, 0, 1320], 90, 'triangle');
    }
    if (w.state.tram) {
      w.state.tram.x += w.state.tram.v * dt;
      if (w.state.tram.x > 540) { w.state.tram = null; simsState.nextTram = t + 18000 + Math.random() * 14000; }
    }
  }
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
  const action = SIM_ACTIONS[row.activity];
  if (Date.now() - Date.parse(row.activity_at) > 30 * 60 * 1000 || !action || action.trip || action.social) return;
  // Solo si eso se puede hacer donde estáis ahora.
  if (curScene() === 'house' ? !SPOTS[action.spot || action.object] && !SEATS[action.pose] && !['bed', 'bedsit', 'bedjump', 'shower', 'bath', 'desk', 'chair', 'sofa'].includes(action.pose) && !sceneObj(action.object) : !sceneObj(action.object)) return;
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
    const spot = curScene() === 'house' ? pickOne(IDLE_SPOTS) : { x: 40 + Math.random() * 430, y: 250 + Math.random() * 110 };
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
  refreshAppData();
  lookAtEachOther();
  npcTick();
  ambientTick();
  renderChatLog();
  window.simsLife?.tick();
  window.simsMind?.tick();
  window.simsMusic?.setMood(curScene(), new Date().getHours());
  // Ropa según dónde estéis, la hora y el tiempo (si no están haciendo nada).
  Object.values(sims).forEach((sim) => { if (!sim.busy) checkOutfit(sim); });
  // Mientras eliges en el menú, nadie hace nada por su cuenta.
  if (simsHouse.querySelector('.sims-pie') || simsHouse.querySelector('.sims-photo-card')) return;
  const me = meKey();
  [me, partnerKeyOf()].forEach((key) => {
    const sim = sims[key];
    if (!sim || sim.busy) return;
    if (key !== me && live.partnerOnline) return;
    const idleFor = Date.now() - sim.idleSince;
    if (key === me && idleFor > 14000 && curScene() === 'house') {
      const needs = currentNeeds(avatarRows[myAvatarPerson()]);
      const [lowest, amount] = Object.entries(needs).sort((a, b) => a[1] - b[1])[0];
      if (amount < 45) return doAction(key, window.simsMind?.preferAction(NEED_ACTIONS[lowest]) || pickOne(NEED_ACTIONS[lowest]), { autonomous: true });
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
  loadSimPicks();
  buildSims();
  loadDecor();
  syncPlaces();
  if (typeof loadPlaces === 'function' && !travelPlaces().length) loadPlaces().catch(() => {});
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
  startWherePartnerIs();
  liveConnect();
  // La ropa de dormir, de abrigo y de verano se carga ya, para cambiarse sin esperas.
  ['pajamas', 'cold', 'hot'].forEach((outfit) => ['ines', 'matteo'].forEach((key) => simsWorld.loadSheet(`${key}-${outfit}`)));
  setTimeout(() => {
    // Al entrar, tu muñeco piensa en uno de sus deseos pendientes (o saluda en simlish).
    const pending = avatarRows[myAvatarPerson()] ? todaysWants().list.find((id) => !todaysWants().done.includes(id)) : null;
    simBubble(sims[meKey()], pending ? `💭 ${WANTS[pending][0]} ${wantText(pending)}` : simlish(meKey()), { secs: pending ? 3.5 : 2 });
    replayPartnerActivity();
  }, 600);
}

function closeSims() {
  if (!simsModal.classList.contains('visible')) return;
  if (history.state?.page === 'sims') history.back();
  else hideSims();
}

function hideSims() {
  if (simsState.full) setSimsFull(false);
  simsModal.classList.remove('visible');
  simsState.open = false;
  window.simsMusic?.stop();
  window.simsLife?.onClose();
  window.simsBuild?.stop();
  liveDisconnect();
  setRainSound(false);
  clearInterval(simsState.timer);
  cancelAnimationFrame(simsState.raf);
  Object.values(sims).forEach((sim) => { sim.token += 1; stopSim(sim); });
  try { speechSynthesis.cancel(); } catch {}
}

function updateZoom({ save = true } = {}) {
  const button = document.querySelector('#simsZoom');
  const close = simsState.zoom > 1.05;
  button.setAttribute('aria-pressed', String(close));
  button.setAttribute('aria-label', close ? 'Ver toda la casa' : 'Seguir de cerca a tu muñeco');
  if (button.dataset.close !== String(close)) {
    button.dataset.close = String(close);
    button.innerHTML = `<i data-lucide="${close ? 'zoom-out' : 'zoom-in'}"></i>`;
    lucide.createIcons();
  }
  if (world()) world().state.zoom = simsState.zoom;
  if (save) try { localStorage.setItem('umbral-sims-zoom', String(Math.round(simsState.zoom * 100) / 100)); } catch {}
}

// ---------- Lo vuestro que se guarda en la fila de cada uno (look) ----------
// La ropa elegida, la decoración y el récord del minijuego van dentro de look (jsonb), así no
// hace falta tocar la base de datos. La decoración la puede cambiar cualquiera de los dos: vale
// la más reciente de las dos filas.
const simLookOf = (person) => avatarRows[person]?.look || {};
function saveSimLook(changes) {
  const person = myAvatarPerson();
  // Siempre con la foto de la vida en el juego (monedas, habilidades, relación, deseos),
  // para que no se pierda al guardar otra cosa ni al cerrar la casa.
  const look = { ...simLookOf(person), ...lifeSnapshot(), ...changes };
  return saveAvatar({ look }).catch((error) => {
    // Si la base aún tiene el límite antiguo de tamaño (avatars.sql sin volver a ejecutar),
    // se guarda lo esencial: diario y recuerdos más cortos, para no perder monedas ni progreso.
    if (!/avatars_look_check|look/i.test(error?.message || '')) return console.warn('[Umbral] Guardar en el juego:', error);
    const slim = { ...look, diary: (look.diary || []).slice(0, 4), memories: (look.memories || []).slice(0, 4) };
    return saveAvatar({ look: slim }).catch((again) => console.warn('[Umbral] Guardar en el juego:', again));
  });
}

// ---------- Armario: ropa, pijama y disfraces cuando queráis ----------
const WARDROBE = [
  ['auto', '✨', () => 'Según el momento'],
  ['casual', '👕', () => 'La de siempre'],
  ['pajamas', '🌙', () => 'Pijama'],
  ['cold', '🧥', () => 'De abrigo'],
  ['hot', '🩳', () => 'De verano'],
  ['elegant', '🍷', () => 'Elegante'],
  ['halloween', '🎃', (key) => (key === 'ines' ? 'Bruja' : 'Diablo')],
  ['xmas', '🎅', (key) => (key === 'ines' ? 'Mamá Noel' : 'Papá Noel')]
];
const WARDROBE_IDS = WARDROBE.map(([id]) => id);
simsState.outfitPick = {};
function loadSimPicks() {
  householdPeople.forEach((person) => {
    const id = simLookOf(person).simOutfit;
    const key = avatarKey(person);
    // Lo que ha llegado en directo manda sobre la fila (que puede ir un poco por detrás).
    if (simsState.outfitLive?.[key]) return;
    simsState.outfitPick[key] = WARDROBE_IDS.includes(id) ? id : 'auto';
  });
}
function pickOutfit(id, { key = meKey(), remote = false } = {}) {
  if (!WARDROBE_IDS.includes(id)) return;
  simsState.outfitPick[key] = id;
  (simsState.outfitLive ||= {})[key] = true;
  const sim = sims[key];
  if (sim) {
    sim.outfit = null;
    checkOutfit(sim, true);
    if (!sim.busy) {
      setAnim(sim, 'emote', { dir: 'down', frames: [0, 2, 2, 1], fps: 5, loop: false });
      setTimeout(() => { if (!sim.busy) idle(sim, 'down'); }, 1000);
    }
    const label = WARDROBE.find(([other]) => other === id);
    if (label && id !== 'auto') simBubble(sim, `${label[1]} ¿Qué tal estoy?`, { secs: 2.2 });
  }
  if (!remote) {
    liveSend('outfit', { id });
    saveSimLook({ simOutfit: id });
  }
}
function wardrobeCard() {
  const key = meKey();
  const current = simsState.outfitPick[key] || 'auto';
  const card = showSimsCard('is-wardrobe', `<h3>👗 Tu armario</h3>
    <p class="sims-card-hint">Elige qué te pones. «Según el momento» se cambia sola: pijama de noche, abrigo si hace frío y disfraz en Halloween y Navidad.</p>
    <div class="sims-wardrobe">${WARDROBE.map(([id, emoji, label]) => `<button type="button" data-outfit="${id}" aria-pressed="${current === id}"><canvas width="32" height="56" data-portrait="${id === 'auto' || id === 'casual' ? key : `${key}-${id}`}"></canvas><span>${emoji} ${escapeHtml(label(key))}</span></button>`).join('')}</div>`);
  card.querySelectorAll('[data-portrait]').forEach((canvas) => simsWorld.portrait(canvas.dataset.portrait, canvas));
}

// ---------- Decorar la casa (y temáticas de temporada) ----------
const DECOR_LABELS = {
  theme: ['Temática', { auto: '📅 Según la fecha', none: '🏠 Ninguna', halloween: '🎃 Halloween', xmas: '🎄 Navidad', valentine: '💘 San Valentín', spring: '🌷 Primavera' }],
  walls: ['Paredes', { cream: 'Crema', sage: 'Salvia', terracotta: 'Terracota', blue: 'Azul', white: 'Blanco', pink: 'Rosa' }],
  floor: ['Suelo', { oak: 'Roble', light: 'Claro', dark: 'Nogal', grey: 'Gris' }],
  rug: ['Alfombra del salón', { red: 'Roja', blue: 'Azul', beige: 'Yute', green: 'Verde', pink: 'Rosa' }],
  sofa: ['Sofá', { khaki: 'Caqui', mustard: 'Mostaza', grey: 'Gris', navy: 'Marino', rose: 'Rosa', terracotta: 'Teja' }],
  bedding: ['Edredón', { cream: 'Crema', white: 'Blanco', blue: 'Azul', rose: 'Rosa', green: 'Verde', mustard: 'Mostaza' }],
  paperBed: ['Papel del dormitorio', { dots: '· Topitos', plain: '▢ Liso', stripes: '║ Rayas', flowers: '✿ Flores', diamonds: '◆ Rombos' }],
  paperLiving: ['Papel del salón', { plain: '▢ Liso', stripes: '║ Rayas', flowers: '✿ Flores', diamonds: '◆ Rombos', dots: '· Topitos' }],
  tiles: ['Azulejos de la cocina', { white: 'Blanco', green: 'Verde', blue: 'Azul', terracotta: 'Teja', black: 'Negro' }]
};
const decorSwatch = (part, id) => {
  const value = simsWorld.DECOR[part]?.[id];
  if (part === 'walls') return value.base;
  if (value?.pattern) return null;
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : null;
};
function applyDecor(values, at) {
  if (!values) return;
  simsState.decorAt = at || new Date().toISOString();
  const w = world();
  if (w) w.setDecor(values);
  else simsWorld.setDecorValues(values);
}
function loadDecor() {
  const latest = householdPeople.map((person) => simLookOf(person).decor).filter((decor) => decor?.at).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (latest && latest.at > (simsState.decorAt || '')) applyDecor(latest, latest.at);
}
function setDecorChoice(part, value, { remote = false, at } = {}) {
  const next = { ...simsWorld.getDecor(), [part]: value };
  const stamp = at || new Date().toISOString();
  applyDecor(next, stamp);
  if (remote) return;
  simBlip(1240, 0.05);
  world()?.emit('sparkle', 250, 280, { count: 10, spread: 160, vy: -10 });
  liveSend('decor', { decor: next, at: stamp });
  saveSimLook({ decor: { ...next, at: stamp } });
}
function decorCard() {
  if (curScene() !== 'house') return showToast('La decoración se cambia en casa 🏠');
  const decor = simsWorld.getDecor();
  showSimsCard('is-decor', `<h3>🎨 Decorar la casa</h3>
    <button type="button" class="sims-card-link is-primary sims-build-start" data-build-start>🔨 Mover muebles por la casa</button>
    ${Object.entries(DECOR_LABELS).map(([part, [title, options]]) => `<h4>${title}</h4><div class="sims-swatches${part === 'theme' ? ' is-theme' : ''}">${Object.entries(options).map(([id, label]) => {
      const color = part === 'theme' ? null : decorSwatch(part, id);
      return `<button type="button" data-decor="${part}:${id}" aria-pressed="${decor[part] === id}">${color ? `<i style="background:${color}"></i>` : ''}${escapeHtml(label)}</button>`;
    }).join('')}</div>`).join('')}
    <p class="sims-card-hint">Lo ve también ${escapeHtml(simPerson(partnerKeyOf()) || '')} en su móvil.</p>`);
}

// ---------- Mensajes en directo ----------
// Lo que escribes sale en un bocadillo encima de tu muñeco en las dos pantallas. Si el otro no
// está jugando, se queda como «tu mensaje» y lo verá al abrir la app.
simsState.chat = [];
function pushChat(person, text) {
  simsState.chat.push({ person, text, at: Date.now() });
  simsState.chat = simsState.chat.slice(-20);
  renderChatLog();
}
function renderChatLog() {
  const log = simsHouse.querySelector('.sims-chatlog');
  if (!log) return;
  const recent = simsState.chat.filter((entry) => Date.now() - entry.at < 20000).slice(-4);
  log.innerHTML = recent.map((entry) => `<p class="${entry.person === myAvatarPerson() ? 'is-me' : ''}"><b>${escapeHtml(entry.person)}</b> ${escapeHtml(entry.text)}</p>`).join('');
}
function sendSimChat(raw) {
  const text = String(raw || '').trim().slice(0, 120);
  const me = sims[meKey()];
  if (!text || !me) return;
  simBubble(me, text, { secs: Math.min(7, 2.5 + text.length / 14) });
  pushChat(myAvatarPerson(), text);
  simBlip(880, 0.05);
  liveSend('chat', { text });
  if (!live.partnerOnline) saveAvatar({ message: text, message_at: new Date().toISOString() }).catch(() => {});
}
function toggleChatBar(open = !simsHouse.querySelector('.sims-chatbar')) {
  simsHouse.querySelector('.sims-chatbar')?.remove();
  if (!open) return;
  const bar = document.createElement('form');
  bar.className = 'sims-chatbar';
  bar.innerHTML = `<div class="sims-chat-quick">${['❤️', '😘', '😂', '🦈', '👋', '🍕', '😴', '🥺'].map((emoji) => `<button type="button" data-chat-quick="${emoji}">${emoji}</button>`).join('')}</div>
    <div class="sims-chat-row"><input name="text" maxlength="120" placeholder="Escribe a ${escapeHtml(simPerson(partnerKeyOf()) || '')}…" autocomplete="off" enterkeyhint="send" /><button type="submit" aria-label="Enviar">➤</button><button type="button" data-chat-close aria-label="Cerrar">✕</button></div>`;
  simsHouse.appendChild(bar);
  bar.querySelector('input').focus();
}

// ---------- Fotos del juego (se guardan en Nosotros) ----------
const SCENE_NAMES = { house: 'en casa', turin: 'en Turín', chieti: 'en Chieti', spain: 'en la casa de campo' };
async function takeSimPhoto({ remote = false } = {}) {
  const w = world();
  if (!w) return;
  if (!remote) { wantProgress({ photo: true }); window.simsLife?.stat('photos'); }
  const flash = document.createElement('div');
  flash.className = 'sims-flash';
  simsHouse.appendChild(flash);
  setTimeout(() => flash.remove(), 700);
  simTune([1600, 900], 60, 'square');
  if (remote) return;
  liveSend('photo');
  // La foto: lo que se ve ahora mismo, ampliado en píxeles enteros y en un marco de polaroid.
  const src = w.canvas;
  const { view, cam } = w.state;
  const k = Math.max(1, Math.round(1100 / (view.w / cam.z)));
  const pw = Math.round((view.w / cam.z) * k);
  const ph = Math.round((view.h / cam.z) * k);
  const pad = Math.round(pw * 0.04);
  const out = document.createElement('canvas');
  out.width = pw + pad * 2;
  out.height = ph + pad * 2 + Math.round(pw * 0.12);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fbf9f3';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, pad, pad, pw, ph);
  const when = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const caption = `🎮 ${householdPeople.join(' y ')} ${SCENE_NAMES[curScene()] || ''} · ${when}`;
  ctx.fillStyle = '#2b1f1d';
  ctx.font = `${Math.round(pw * 0.034)}px "Pixelify Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(caption.replace('🎮 ', ''), out.width / 2, ph + pad * 2 + Math.round(pw * 0.07));
  let blob;
  try {
    blob = await new Promise((resolve, reject) => out.toBlob((result) => (result ? resolve(result) : reject(new Error('No se pudo hacer la foto'))), 'image/png'));
  } catch (error) {
    return showToast('No se pudo hacer la foto');
  }
  const url = URL.createObjectURL(blob);
  simsState.lastPhoto = { blob, url, caption };
  showSimsCard('is-snapshot', `<h3>📸 ¡Foto!</h3><img class="sims-snapshot" alt="" src="${url}" />
    <input class="sims-snapshot-caption" maxlength="200" value="${escapeHtml(caption)}" aria-label="Frase de la foto" />
    <div class="sims-snapshot-actions"><button type="button" class="sims-card-link is-primary" data-snapshot-save>💖 Guardar en Nosotros</button><button type="button" class="sims-card-link" data-snapshot-download>⬇️ Descargar</button></div>`);
}
async function saveSnapshot(button) {
  const photo = simsState.lastPhoto;
  if (!photo || typeof saveGameMoment !== 'function') return showToast('El álbum aún no está listo');
  const caption = simsHouse.querySelector('.sims-snapshot-caption')?.value.trim() || photo.caption;
  button.disabled = true;
  button.textContent = 'Subiendo…';
  try {
    await saveGameMoment(photo.blob, caption);
    simsHouse.querySelector('.sims-card')?.remove();
    showToast('Guardada en vuestro álbum 📸');
    const me = sims[meKey()];
    if (me) world()?.emit('heart', me.x, me.headY, { count: 4, spread: 12 });
  } catch (error) {
    button.disabled = false;
    button.textContent = '💖 Guardar en Nosotros';
    showToast(error.message || 'No se pudo guardar la foto');
  }
}
function downloadSnapshot() {
  const photo = simsState.lastPhoto;
  if (!photo) return;
  const link = document.createElement('a');
  link.href = photo.url;
  link.download = `umbral-sims-${todayISO()}.png`;
  link.click();
}

// ---------- Minijuego: Tiburón hambriento 🦈 ----------
// Mueves el dedo y el tiburón lo sigue: cómete los peces (el dorado vale 10), evita los peces
// globo y las medusas. 60 segundos y 3 vidas. Comer seguido hace combo. El récord de cada uno
// se guarda y se ve el del otro.
const SHARK_MAP = [
  '.......DD.......',
  '......DGGD......',
  'D....DGGGGDDDD..',
  'GD..DGGGGGGGGGD.',
  'GGDDGGGGGGGGGoGD',
  'GGGGGGWWWWWWWWWD',
  'GD..DWWWWWWWWDD.',
  'D....DDWDDWDD...'
];
const FISH_KINDS = {
  small: { w: 7, h: 4, pts: 1, color: '#f2a33a', speed: [22, 34] },
  mid: { w: 10, h: 6, pts: 3, color: '#4ab0d8', speed: [16, 26] },
  gold: { w: 8, h: 5, pts: 10, color: '#ffd23f', speed: [46, 60] },
  puffer: { w: 9, h: 9, danger: true, color: '#e8c050', speed: [12, 20] },
  jelly: { w: 8, h: 9, danger: true, color: '#d89ae8', speed: [6, 10] }
};
function startSharkGame() {
  if (simsHouse.querySelector('.sims-game')) return;
  hidePie();
  simsHouse.querySelector('.sims-card')?.remove();
  toggleChatBar(false);
  const host = document.createElement('div');
  host.className = 'sims-game';
  const best = (person) => Number(simLookOf(person).sharkBest) || 0;
  const partner = simPerson(partnerKeyOf());
  host.innerHTML = `<canvas></canvas>
    <div class="sims-game-hud"><span data-g="score">0</span><span data-g="lives">❤️❤️❤️</span><span data-g="time">${'60'}</span><button type="button" data-game-quit aria-label="Salir del juego">✕</button></div>
    <div class="sims-game-msg" data-g="msg"><b>🦈 Tiburón hambriento</b><span>Mueve el dedo y el tiburón lo sigue. Cómete los peces, esquiva los peces globo y las medusas. ¡El dorado vale 10!</span><small>Tu récord: ${best(myAvatarPerson())} · ${escapeHtml(partner || '')}: ${best(partner)}</small><button type="button" data-game-start>¡A jugar!</button></div>`;
  simsHouse.appendChild(host);
  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const G = { w: 200, h: 150, k: 2, running: false, over: false, raf: 0 };
  function fit() {
    const rect = host.getBoundingClientRect();
    G.w = 160;
    G.h = Math.max(90, Math.round(160 * (rect.height / Math.max(1, rect.width))));
    G.k = Math.max(1, Math.round((rect.width * (window.devicePixelRatio || 1)) / G.w));
    canvas.width = G.w * G.k;
    canvas.height = G.h * G.k;
  }
  fit();
  const S = { shark: null, fish: [], bubbles: [], floats: [], score: 0, lives: 3, time: 60, combo: 0, lastEat: 0, hurtUntil: 0, spawn: 0, target: null, last: 0, chomp: 0 };
  const reset = () => Object.assign(S, { shark: { x: G.w / 2, y: G.h / 2, dir: 1, size: 1 }, fish: [], bubbles: [], floats: [], score: 0, lives: 3, time: 60, combo: 0, lastEat: 0, hurtUntil: 0, spawn: 0, target: null, chomp: 0 });
  reset();
  const toGame = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * G.w, y: ((event.clientY - rect.top) / rect.height) * G.h };
  };
  canvas.addEventListener('pointerdown', (event) => { S.target = toGame(event); canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse' || event.buttons || event.pressure) S.target = toGame(event); });
  const hud = (name, value) => { const el = host.querySelector(`[data-g="${name}"]`); if (el) el.textContent = value; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawnFish(elapsed) {
    const roll = Math.random();
    const danger = Math.min(0.32, 0.12 + elapsed / 300);
    const kind = roll < 0.05 ? 'gold' : roll < 0.05 + danger * 0.6 ? 'puffer' : roll < 0.05 + danger ? 'jelly' : roll < 0.7 ? 'small' : 'mid';
    const def = FISH_KINDS[kind];
    const fromLeft = Math.random() < 0.5;
    const speed = rnd(...def.speed) * (1 + elapsed / 120);
    if (kind === 'jelly') return S.fish.push({ kind, x: rnd(20, G.w - 20), y: G.h + 10, vx: rnd(-4, 4), vy: -speed, t: Math.random() * 6 });
    S.fish.push({ kind, x: fromLeft ? -12 : G.w + 12, y: rnd(12, G.h - 26), vx: fromLeft ? speed : -speed, vy: 0, t: Math.random() * 6 });
  }
  function px(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function drawShark(sh, t) {
    const hurt = t < S.hurtUntil && Math.floor(t / 100) % 2;
    if (hurt) return;
    const scale = sh.size;
    const colors = { G: '#7d8a96', W: '#eef2f4', D: '#2b1f1d', o: '#111111' };
    const mw = SHARK_MAP[0].length;
    const mh = SHARK_MAP.length;
    ctx.save();
    ctx.translate(Math.round(sh.x), Math.round(sh.y));
    ctx.scale(sh.dir * scale, scale);
    SHARK_MAP.forEach((row, ry) => [...row].forEach((cell, rx) => {
      if (cell === '.') return;
      let color = colors[cell];
      if (S.chomp > t && ry === 5 && rx >= 12) color = '#2b1f1d';
      ctx.fillStyle = color;
      ctx.fillRect(rx - mw / 2, ry - mh / 2, 1, 1);
    }));
    ctx.restore();
  }
  function drawFish(f, t) {
    const def = FISH_KINDS[f.kind];
    const dir = f.vx >= 0 ? 1 : -1;
    const x = Math.round(f.x);
    const y = Math.round(f.y + Math.sin(t / 300 + f.t) * (f.kind === 'jelly' ? 0 : 1.5));
    if (f.kind === 'puffer') {
      const r = 4 + Math.round(Math.sin(t / 250 + f.t));
      px(x - r, y - r, r * 2, r * 2, '#2b1f1d');
      px(x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2, def.color);
      [[-r - 1, 0], [r, 0], [0, -r - 1], [0, r], [-r, -r], [r - 1, -r], [-r, r - 1], [r - 1, r - 1]].forEach(([dx, dy]) => px(x + dx, y + dy, 1, 1, '#2b1f1d'));
      px(x + dir * 1, y - 1, 1, 1, '#111111');
      return;
    }
    if (f.kind === 'jelly') {
      ctx.globalAlpha = 0.85;
      px(x - 4, y - 4, 8, 4, def.color);
      px(x - 3, y - 5, 6, 1, def.color);
      for (let i = 0; i < 4; i += 1) px(x - 3 + i * 2, y, 1, 3 + Math.round(Math.sin(t / 200 + i + f.t) * 1.5 + 1.5), '#c07ad8');
      ctx.globalAlpha = 1;
      return;
    }
    const { w, h, color } = def;
    const L = x - w / 2;
    const T = y - h / 2;
    const light = simsWorld.mixHex(color, '#ffffff', 0.35);
    const dark = simsWorld.mixHex(color, '#000000', 0.25);
    // Cuerpo redondeado con contorno, barriga clara, aleta y cola que se mueve.
    px(L + 1, T, w - 2, h, '#2b1f1d');
    px(L, T + 1, w, h - 2, '#2b1f1d');
    px(L + 1, T + 1, w - 2, h - 2, color);
    px(L + 2, T + h - 3, w - 4, 1, light);
    px(L + 2, T + 1, w - 4, 1, light);
    if (f.kind === 'mid') for (let i = 3; i < w - 3; i += 3) px(L + i, T + 1, 1, h - 2, dark);
    px(x - dir * 1, T - 1, 3, 1, '#2b1f1d');
    px(x - dir * 1, T, 2, 1, dark);
    const flap = Math.round(Math.sin(t / 90 + f.t));
    const tail = dir > 0 ? L - 3 : L + w;
    px(tail, y - 2 + flap, 3, 4, '#2b1f1d');
    px(tail + (dir > 0 ? 0 : 1), y - 1 + flap, 2, 2, dark);
    px(x + dir * (w / 2 - 3), y - 1, 2, 2, '#ffffff');
    px(x + dir * (w / 2 - 3) + (dir > 0 ? 1 : 0), y - 1, 1, 1, '#111111');
    if (f.kind === 'gold' && Math.floor(t / 150) % 2) px(x - 1, y - h / 2 - 2, 1, 1, '#fff6c8');
  }
  function drawSea(t) {
    const grad = ctx.createLinearGradient(0, 0, 0, G.h);
    grad.addColorStop(0, '#5cc0e8');
    grad.addColorStop(1, '#0d3a66');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, G.w, G.h);
    // Rayos de luz que se mueven.
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 5; i += 1) {
      const x0 = ((i * 53 + t / 80) % (G.w + 60)) - 30;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + 12, 0);
      ctx.lineTo(x0 + 40, G.h);
      ctx.lineTo(x0 + 22, G.h);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Arena, algas y conchas.
    px(0, G.h - 10, G.w, 10, '#d8bf88');
    for (let x = 0; x < G.w; x += 4) px(x, G.h - 10 + ((x * 7) % 3), 2, 1, '#c4a870');
    for (let i = 0; i < 7; i += 1) {
      const sx = 12 + i * 29;
      for (let k = 0; k < 6; k += 1) px(sx + Math.round(Math.sin(t / 500 + k * 0.6 + i) * 1.5), G.h - 12 - k * 3, 2, 3, k % 2 ? '#3f8a4f' : '#4c9a5a');
    }
    [[40, '#f49ab0'], [120, '#f7f2e6'], [170, '#f2a33a']].forEach(([sx, col]) => { px(sx, G.h - 5, 4, 2, col); px(sx + 1, G.h - 6, 2, 1, col); });
    S.bubbles.forEach((b) => { ctx.globalAlpha = 0.6; px(b.x, b.y, b.r, b.r, '#dff4ff'); ctx.globalAlpha = 1; });
  }
  function finish() {
    G.running = false;
    G.over = true;
    const mine = myAvatarPerson();
    const record = S.score > best(mine);
    const msg = host.querySelector('[data-g="msg"]');
    msg.hidden = false;
    msg.innerHTML = `<b>${record ? '🏆 ¡Nuevo récord!' : S.lives <= 0 ? '😵 ¡Ay, el pez globo!' : '⏱️ ¡Se acabó el tiempo!'}</b><span class="sims-game-score">${S.score} puntos</span><small>Tu récord: ${Math.max(S.score, best(mine))} · ${escapeHtml(partner || '')}: ${best(partner)}</small><div><button type="button" data-game-start>Otra vez</button><button type="button" data-game-quit>Salir</button></div>`;
    simTune(record ? [523, 659, 784, 1047] : [660, 520, 440], 140, 'triangle');
    if (record) saveSimLook({ sharkBest: S.score });
    liveSend('game', { score: S.score, record });
    boostNeeds({ fun: 25, energy: -5 }).catch(() => {});
    addCoins(window.simsMind?.gameCoins(Math.max(5, Math.round(S.score / 3))) ?? Math.max(5, Math.round(S.score / 3)));
    gainSkill('logic', 10);
  }
  function step(t) {
    G.raf = requestAnimationFrame(step);
    if (!host.isConnected) return cancelAnimationFrame(G.raf);
    const dt = Math.min(0.05, (t - (S.last || t)) / 1000);
    S.last = t;
    if (G.running) {
      S.time -= dt;
      const elapsed = 60 - S.time;
      S.spawn -= dt;
      if (S.spawn <= 0) { spawnFish(elapsed); S.spawn = Math.max(0.28, 0.8 - elapsed / 120); }
      // El tiburón va hacia el dedo.
      const sh = S.shark;
      if (S.target) {
        const dx = S.target.x - sh.x;
        const dy = S.target.y - sh.y;
        const dist = Math.hypot(dx, dy);
        const speed = Math.min(dist * 6, 120);
        if (dist > 1) { sh.x += (dx / dist) * speed * dt; sh.y += (dy / dist) * speed * dt; }
        if (Math.abs(dx) > 2) sh.dir = dx > 0 ? 1 : -1;
      }
      sh.x = Math.max(8, Math.min(G.w - 8, sh.x));
      sh.y = Math.max(8, Math.min(G.h - 14, sh.y));
      if (Math.random() < dt * 3) S.bubbles.push({ x: sh.x - sh.dir * 8, y: sh.y - 2, r: 1, v: rnd(10, 18) });
      // Peces que nadan y lo que se come.
      const mouth = { x: sh.x + sh.dir * 6 * sh.size, y: sh.y + 1 };
      S.fish = S.fish.filter((f) => {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.kind === 'jelly') f.x += Math.sin(t / 600 + f.t) * 4 * dt;
        if (f.x < -20 || f.x > G.w + 20 || f.y < -20) return false;
        const def = FISH_KINDS[f.kind];
        const reach = 5 * sh.size + Math.max(def.w, def.h) / 2;
        const body = Math.hypot(f.x - sh.x, f.y - sh.y) < 4 * sh.size + Math.max(def.w, def.h) / 2 - 1;
        if (def.danger) {
          if (body && t > S.hurtUntil) {
            S.lives -= 1;
            S.hurtUntil = t + 1500;
            S.combo = 0;
            simBlip(160, 0.25, 'sawtooth', 0.08);
            if (navigator.vibrate) try { navigator.vibrate(120); } catch {}
            S.floats.push({ x: sh.x, y: sh.y - 10, text: '💥', life: 1 });
            return false;
          }
          return true;
        }
        if (Math.hypot(f.x - mouth.x, f.y - mouth.y) < reach) {
          S.combo = t - S.lastEat < 1300 ? S.combo + 1 : 1;
          S.lastEat = t;
          const mult = Math.min(4, S.combo);
          const pts = def.pts * mult;
          S.score += pts;
          S.chomp = t + 160;
          sh.size = Math.min(1.7, 1 + S.score / 160);
          simBlip(f.kind === 'gold' ? 1500 : 700 + mult * 120, 0.06, 'square', 0.05);
          S.floats.push({ x: f.x, y: f.y - 6, text: `+${pts}${mult > 1 ? ` x${mult}` : ''}`, life: 1, gold: f.kind === 'gold' });
          return false;
        }
        return true;
      });
      if (S.time <= 0 || S.lives <= 0) { S.time = Math.max(0, S.time); finish(); }
      hud('score', `🐟 ${S.score}`);
      hud('lives', '❤️'.repeat(Math.max(0, S.lives)) + '🖤'.repeat(Math.max(0, 3 - S.lives)));
      hud('time', `⏱️ ${Math.ceil(S.time)}`);
    }
    S.bubbles = S.bubbles.filter((b) => { b.y -= b.v * dt; return b.y > -4; });
    if (Math.random() < dt * 2) S.bubbles.push({ x: rnd(0, G.w), y: G.h - 10, r: Math.random() < 0.3 ? 2 : 1, v: rnd(8, 16) });
    S.floats = S.floats.filter((f) => { f.y -= 14 * dt; f.life -= dt; return f.life > 0; });
    ctx.setTransform(G.k, 0, 0, G.k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawSea(t);
    S.fish.forEach((f) => drawFish(f, t));
    drawShark(S.shark, t);
    ctx.font = '7px "Pixelify Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    S.floats.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = '#2b1f1d';
      ctx.fillText(f.text, f.x + 0.5, f.y + 0.5);
      ctx.fillStyle = f.gold ? '#ffd23f' : '#ffffff';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    });
  }
  host.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target.closest('[data-game-quit]')) {
      cancelAnimationFrame(G.raf);
      host.remove();
      return;
    }
    if (event.target.closest('[data-game-start]')) {
      reset();
      fit();
      host.querySelector('[data-g="msg"]').hidden = true;
      G.running = true;
      G.over = false;
      simTune([523, 784], 100, 'triangle');
    }
  });
  G.raf = requestAnimationFrame(step);
}

// ---------- Vida Sims: monedas, habilidades, relación, ánimo y cola de acciones ----------
// Todo vive en memoria mientras jugáis y se guarda (con un poco de retraso, para no escribir a
// cada segundo) dentro de look, junto con la ropa, la decoración y los récords.
const SKILLS = {
  cooking: ['🍳', 'Cocina'],
  fitness: ['💪', 'Forma física'],
  logic: ['🧠', 'Lógica'],
  music: ['🎸', 'Música'],
  creativity: ['🎨', 'Creatividad'],
  charisma: ['💬', 'Carisma']
};
const ACTION_SKILL = {
  cook: 'cooking', coffee: 'cooking', yoga: 'fitness', jump: 'fitness', goout: 'fitness',
  puzzle: 'logic', read: 'logic', readsofa: 'logic', readbed: 'logic', beanread: 'logic', stargaze: 'logic', work: 'logic',
  guitar: 'music', sing: 'music', dance: 'music', paint: 'creativity', pose: 'creativity', admire: 'creativity'
};
const SHOP = {
  guitar: { label: 'Guitarra española', emoji: '🎸', price: 200, where: 'Dormitorio, junto a la ventana', does: 'Tocarla sube la diversión y la habilidad de música' },
  beanbag: { label: 'Puf gigante', emoji: '🛋️', price: 150, where: 'Salón, junto al sillón', does: 'Para leer o echarse un rato' },
  easel: { label: 'Caballete de pintura', emoji: '🎨', price: 250, where: 'Cocina, junto a la mesa', does: 'Pintar sube la creatividad (y el cuadro se va llenando)' },
  telescope: { label: 'Telescopio', emoji: '🔭', price: 400, where: 'Salón, frente a la ventana', does: 'Mirar las estrellas (o Superga de día) sube la lógica' },
  aquarium: { label: 'Acuario con tiburoncito', emoji: '🐠', price: 500, where: 'Salón, entre la tele y el escritorio', does: 'Mirar y dar de comer a los peces relaja' },
  arcade: { label: 'Máquina recreativa', emoji: '🕹️', price: 700, where: 'Dormitorio, rincón gamer', does: 'Acceso a todos los minijuegos' }
};
const skillLevel = (xp) => Math.min(10, Math.floor(Math.sqrt((xp || 0) / 14)));
simsState.queue = [];
simsState.events = [];
function getLife() {
  // Hasta que no llega tu fila de la base de datos no se fija nada (para no pisar lo guardado).
  if (!simsState.life && !avatarRows[myAvatarPerson()]) return { coins: 0, skills: {}, rel: { friend: 80, romance: 85 } };
  if (!simsState.life) {
    const look = simLookOf(myAvatarPerson());
    simsState.life = {
      coins: Number.isFinite(look.coins) ? look.coins : 300,
      skills: { ...(look.skills || {}) },
      rel: { friend: 80, romance: 85, ...(look.rel || {}) },
      wants: look.wants?.day ? { ...look.wants, done: [...(look.wants.done || [])], list: [...(look.wants.list || [])] } : null
    };
    // La relación se enfría un poco si pasan días sin interactuar (como en los Sims).
    const days = look.rel?.at ? Math.floor((Date.now() - Date.parse(look.rel.at)) / 86400000) : 0;
    if (days > 1) { simsState.life.rel.friend = Math.max(40, simsState.life.rel.friend - days); simsState.life.rel.romance = Math.max(40, simsState.life.rel.romance - days * 2); }
  }
  return simsState.life;
}
// Foto completa de lo vuestro para guardarla de una vez (así no se pisan cambios seguidos).
function lifeSnapshot() {
  const snap = {};
  if (simsState.life) {
    const life = simsState.life;
    Object.assign(snap, { coins: Math.round(life.coins), skills: life.skills, rel: { ...life.rel, at: life.rel.at || new Date().toISOString() } });
    if (life.wants?.day) snap.wants = life.wants;
    // Contadores, aspiraciones y diario (sims-life.js).
    if (life.stats) Object.assign(snap, { stats: life.stats, aspire: life.aspire, diary: life.diary });
    // Personalidad, trabajo y recuerdos (sims-mind.js).
    if (life.mind) Object.assign(snap, { traits: life.mind.traits, career: life.mind.career, memories: life.mind.memories });
  }
  if (simsState.decorAt) snap.decor = { ...simsWorld.getDecor(), at: simsState.decorAt };
  const pick = simsState.outfitPick?.[meKey()];
  if (pick) snap.simOutfit = pick;
  return snap;
}
let lifeTimer = 0;
function saveLife() {
  clearTimeout(lifeTimer);
  lifeTimer = setTimeout(() => saveSimLook({}), 1500);
}
function addCoins(amount, sim = sims[meKey()]) {
  if (!amount) return;
  const life = getLife();
  life.coins = Math.max(0, life.coins + amount);
  if (sim && simsState.open) simFloat(sim, `${amount > 0 ? '+' : ''}§${amount}`);
  if (amount > 0) simBlip(1560, 0.05, 'triangle');
  saveLife();
  renderHud();
}
function gainSkill(skill, xp, sim = sims[meKey()]) {
  if (!SKILLS[skill] || !xp) return;
  // Rasgos y emoción: inspirada aprende antes a pintar, agobiado aprende peor…
  xp = Math.max(1, Math.round(xp * (window.simsMind?.skillMult(skill) ?? 1)));
  const life = getLife();
  const before = skillLevel(life.skills[skill]);
  life.skills[skill] = (life.skills[skill] || 0) + xp;
  const after = skillLevel(life.skills[skill]);
  if (after > before && sim) {
    simBubble(sim, `🎉 ¡Nivel ${after} de ${SKILLS[skill][1]}!`, { secs: 3 });
    window.simsLife?.diary(SKILLS[skill][0], `Nivel ${after} de ${SKILLS[skill][1]}`);
    if (after >= 5) window.simsMind?.remember(SKILLS[skill][0], `Nivel ${after} de ${SKILLS[skill][1]}`, `¿Te acuerdas de cuando llegué al nivel ${after} de ${SKILLS[skill][1].toLowerCase()}?`);
    world()?.emit('sparkle', sim.x, sim.headY + 6, { count: 12, spread: 22, vy: -16 });
    simTune([784, 988, 1175, 1568], 110, 'triangle');
    pushEvent('levelup');
  }
  saveLife();
}
function pushEvent(kind) {
  simsState.events.push({ kind, at: Date.now() });
  simsState.events = simsState.events.filter((event) => Date.now() - event.at < 4 * 3600000).slice(-30);
}
const recent = (kind, ms) => simsState.events.some((event) => event.kind === kind && Date.now() - event.at < ms);
// Cómo cambia la relación con cada interacción (amistad y romance, de 0 a 100).
const REL_DELTA = {
  friendly: [3, 0], fun: [4, 1], romance: [2, 5], intimate: [1, 6], angry: [-8, -5], plans: [4, 3]
};
function relChange(kind) {
  const social = SOCIALS[kind];
  if (!social) return;
  const life = getLife();
  const [df0, dr0] = kind === 'apologize' ? [8, 4] : REL_DELTA[social.cat] || [2, 0];
  // Romántica o enamorado: lo bueno de pareja cuenta más.
  const relBoost = window.simsMind?.relMult() ?? 1;
  const df = df0 > 0 ? Math.round(df0 * relBoost) : df0;
  const dr = dr0 > 0 ? Math.round(dr0 * relBoost) : dr0;
  life.rel.friend = Math.max(0, Math.min(100, life.rel.friend + df));
  life.rel.romance = Math.max(0, Math.min(100, life.rel.romance + dr));
  life.rel.at = new Date().toISOString();
  wantProgress({ social: kind, cat: social.cat });
  if (['romance', 'intimate'].includes(social.cat)) window.simsLife?.stat('love');
  pushEvent(social.cat === 'angry' && kind !== 'apologize' ? 'fight' : social.cat === 'romance' || social.cat === 'intimate' ? 'love' : 'social');
  saveLife();
}
// ¿Le apetece al otro? Si está enfadado, agotado o no hay confianza, puede decir que no.
function socialVerdict(kind) {
  const social = SOCIALS[kind];
  const partner = sims[partnerKeyOf()];
  if (!social || social.trip || !partner) return null;
  // Si la enfadada eres tú, tampoco te apetece (hasta que hagáis las paces).
  if (['romance', 'intimate'].includes(social.cat) && window.simsMind?.emotionOf() === 'angry') return '😤 Con este enfado, mejor primero pedir perdón';
  const pNeeds = needsOf(partner);
  const life = getLife();
  const angry = partner.angryUntil && partner.angryUntil > Date.now();
  const name = simPerson(partner.key);
  if (angry && ['romance', 'intimate', 'fun'].includes(social.cat)) return `😤 ${partner.key === 'matteo' ? 'Adesso no, sono arrabbiato' : 'Ahora no, estoy enfadada'}`;
  if (['intimate'].includes(social.cat) && (pNeeds.energy < 15 || pNeeds.hygiene < 15)) return partner.key === 'matteo' ? '😮‍💨 Sono distrutto… domani?' : '😮‍💨 Estoy agotada… ¿mañana?';
  if (social.cat === 'fun' && pNeeds.energy < 10) return `🥱 ${name} no tiene fuerzas ahora`;
  if (['romance', 'intimate'].includes(social.cat) && life.rel.romance < 30) return '🙄 Mmm… primero arreglemos lo de antes';
  if (social.cat === 'angry' && kind !== 'apologize' && life.rel.friend > 90 && Math.random() < 0.3) return partner.key === 'matteo' ? '😄 Dai, non litighiamo!' : '😄 Venga, no discutamos';
  return null;
}
// Moodlets: lo que le pasa ahora a tu muñeco (como en los Sims).
function moodlets(person = myAvatarPerson()) {
  const needs = currentNeeds(avatarRows[person]);
  const list = [];
  const isMe = person === myAvatarPerson();
  if (needs.hunger > 80) list.push(['😋', 'Bien comido']);
  if (needs.hunger < 30) list.push(['🍽️', 'Hambriento']);
  if (needs.energy < 30) list.push(['🥱', 'Cansado']);
  if (needs.energy > 85) list.push(['⚡', 'Descansado']);
  if (needs.hygiene < 30) list.push(['🫧', 'Necesita una ducha']);
  if (needs.fun > 80) list.push(['🎉', 'Se lo está pasando bien']);
  if (needs.fun < 30) list.push(['😐', 'Aburrido']);
  if (needs.social < 30) list.push(['🫂', 'Necesita mimos']);
  if (isMe && recent('love', 2 * 3600000)) list.push(['💞', 'Enamorado']);
  if (isMe && recent('fight', 3600000)) list.push(['😤', 'Molesto']);
  if (isMe && recent('levelup', 3600000)) list.push(['🌟', 'Ha mejorado en algo']);
  if (isMe && recent('purchase', 2 * 3600000)) list.push(['🛍️', 'Estrena mueble']);
  if (isMe && recent('want', 3 * 3600000)) list.push(['⭐', 'Deseo cumplido']);
  if (curScene() !== 'house') list.push(['🧳', 'De viaje']);
  if (new Date().getHours() >= 23 || new Date().getHours() < 6) list.push(['🌙', 'Es tarde']);
  return list.slice(0, 5);
}

// Cola de acciones: si estás haciendo algo, lo siguiente espera su turno (hasta 4).
function queueOrRun(entry) {
  const me = sims[meKey()];
  if (me?.busy && me.doing) {
    if (simsState.queue.length >= 4) return showToast('Ya tienes 4 cosas en cola');
    simsState.queue.push(entry);
    simBlip(1320, 0.04);
    renderHud();
    return;
  }
  runEntry(entry);
}
function runEntry(entry) {
  if (entry.type === 'act') return doAction(meKey(), entry.value);
  if (entry.type === 'social') return doSocial(entry.value);
  return null;
}
function runQueued() {
  const me = sims[meKey()];
  if (!simsState.open || !me || me.busy || !simsState.queue.length) return;
  const next = simsState.queue.shift();
  renderHud();
  runEntry(next);
}
// Lo que deja cada acción terminada: monedas y experiencia.
function lifeAfterAction(id) {
  const action = SIM_ACTIONS[id];
  if (!action) return;
  const coins = id === 'work' ? (window.simsMind?.work() ?? 40) : Math.max(1, Math.round((action.secs || 2) / 2));
  addCoins(coins);
  window.simsMind?.afterAction(id);
  wantProgress({ act: id });
  const skill = ACTION_SKILL[id];
  if (skill) gainSkill(skill, Math.round((action.secs || 4) * 1.5));
}

// ---------- Tienda de muebles ----------
function shopCard() {
  const life = getLife();
  const owned = simsWorld.getDecor().items || [];
  showSimsCard('is-shop', `<h3>🛍️ Tienda de muebles</h3>
    <p class="sims-card-hint">Tienes <b>§${Math.round(life.coins)}</b>. Se ganan haciendo cosas en el juego, con los minijuegos y usando la app de verdad (tareas, plantas, recetas, fotos y planes). Lo que compréis se puede recolocar en 🎨 Decorar → Mover muebles.</p>
    <div class="sims-shop">${Object.entries(SHOP).map(([id, item]) => {
      const has = owned.includes(id);
      return `<div class="sims-shop-item${has ? ' is-owned' : ''}"><span class="sims-shop-emoji">${item.emoji}</span><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.does)}</small><small>📍 ${escapeHtml(item.where)}${has ? ' (o donde lo pongáis)' : ''}</small></div>${has ? '<em>✓ Vuestro</em>' : `<button type="button" data-buy="${id}"${life.coins < item.price ? ' disabled' : ''}>§${item.price}</button>`}</div>`;
    }).join('')}</div>`);
}
function buyItem(id) {
  const item = SHOP[id];
  const life = getLife();
  const owned = simsWorld.getDecor().items || [];
  if (!item || owned.includes(id)) return;
  if (curScene() !== 'house') return showToast('Los muebles se compran en casa 🏠');
  if (life.coins < item.price) return showToast(`Te faltan §${item.price - Math.round(life.coins)}`);
  life.coins -= item.price;
  pushEvent('purchase');
  setDecorChoice('items', [...owned, id]);
  window.simsLife?.diary(item.emoji, `Comprasteis: ${item.label}`);
  window.simsLife?.checkAspirations();
  simTune([660, 880, 1320], 90, 'triangle');
  const me = sims[meKey()];
  if (me) { simBubble(me, `${item.emoji} ¡Nuevo! ${item.label}`, { secs: 2.6 }); me.expr = 'happy'; }
  shopCard();
  renderHud();
}

// ---------- Sala de juegos: Sudoku, Binairo y crucigrama ----------
function gamesCard() {
  const best = simLookOf(myAvatarPerson());
  showSimsCard('is-games', `<h3>🧩 Sala de juegos</h3>
    <div class="sims-games">
      <button type="button" data-play="shark"><span>🦈</span><b>Tiburón hambriento</b><small>Récord: ${Number(best.sharkBest) || 0}</small></button>
      <button type="button" data-play="sudoku"><span>🔢</span><b>Sudoku</b><small>Tres niveles</small></button>
      <button type="button" data-play="binairo"><span>⚪</span><b>Binairo</b><small>Ceros y unos, sin tres seguidos</small></button>
      <button type="button" data-play="crossword"><span>✏️</span><b>Crucigrama</b><small>Con pistas sobre vosotros</small></button>
    </div>`);
}
function playGame(id) {
  simsHouse.querySelector('.sims-card')?.remove();
  wantProgress({ game: true });
  window.simsLife?.stat('games');
  if (id === 'shark') return startSharkGame();
  if (id === 'sudoku') return startSudoku();
  if (id === 'binairo') return startBinairo();
  if (id === 'crossword') return startCrossword();
  return null;
}
const shuffled = (list) => list.map((value) => [Math.random(), value]).sort((a, b) => a[0] - b[0]).map(([, value]) => value);
// Ventana común de los juegos de mesa: cabecera con reloj y salir, y el tablero debajo.
function puzzleShell(title) {
  hidePie();
  toggleChatBar(false);
  simsHouse.querySelector('.sims-puzzle')?.remove();
  const host = document.createElement('div');
  host.className = 'sims-puzzle';
  host.innerHTML = `<div class="sims-puzzle-head"><b>${title}</b><span data-p="time">0:00</span><button type="button" data-puzzle-quit aria-label="Salir">✕</button></div><div class="sims-puzzle-body"></div>`;
  simsHouse.appendChild(host);
  const start = Date.now();
  const timer = setInterval(() => {
    if (!host.isConnected) return clearInterval(timer);
    const s = Math.floor((Date.now() - start) / 1000);
    host.querySelector('[data-p="time"]').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  host.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target.closest('[data-puzzle-quit]')) { clearInterval(timer); host.remove(); }
  });
  return { host, body: host.querySelector('.sims-puzzle-body'), elapsed: () => Math.floor((Date.now() - start) / 1000), stop: () => clearInterval(timer) };
}
function puzzleWin(shell, { game, coins, xp }) {
  shell.stop();
  const secs = shell.elapsed();
  const panel = document.createElement('div');
  panel.className = 'sims-game-msg';
  panel.innerHTML = `<b>🏆 ¡Resuelto!</b><span class="sims-game-score">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</span><small>+§${coins} · +${xp} de lógica</small><div><button type="button" data-puzzle-quit>Volver a casa</button></div>`;
  shell.host.appendChild(panel);
  simTune([523, 659, 784, 1047], 140, 'triangle');
  addCoins(window.simsMind?.gameCoins(coins) ?? coins);
  gainSkill('logic', xp);
  boostNeeds({ fun: 20 }).catch(() => {});
  liveSend('game', { game, score: secs, record: false });
}

// Sudoku: se genera uno nuevo cada vez (y vale cualquier solución que cumpla las reglas).
function makeSudoku(holes) {
  const g = Array(81).fill(0);
  const ok = (i, n) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (let k = 0; k < 9; k += 1) if (g[r * 9 + k] === n || g[k * 9 + c] === n) return false;
    const br = r - (r % 3);
    const bc = c - (c % 3);
    for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) if (g[(br + y) * 9 + bc + x] === n) return false;
    return true;
  };
  const fill = (i) => {
    if (i === 81) return true;
    for (const n of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (ok(i, n)) { g[i] = n; if (fill(i + 1)) return true; g[i] = 0; }
    }
    return false;
  };
  fill(0);
  const puzzle = [...g];
  shuffled([...Array(81).keys()]).slice(0, holes).forEach((i) => { puzzle[i] = 0; });
  return puzzle;
}
function sudokuConflicts(cells) {
  const bad = new Set();
  const groups = [];
  for (let k = 0; k < 9; k += 1) {
    groups.push([...Array(9).keys()].map((i) => k * 9 + i));
    groups.push([...Array(9).keys()].map((i) => i * 9 + k));
    const br = Math.floor(k / 3) * 3;
    const bc = (k % 3) * 3;
    groups.push([...Array(9).keys()].map((i) => (br + Math.floor(i / 3)) * 9 + bc + (i % 3)));
  }
  groups.forEach((group) => {
    const seen = {};
    group.forEach((i) => { if (cells[i]) (seen[cells[i]] ||= []).push(i); });
    Object.values(seen).forEach((list) => { if (list.length > 1) list.forEach((i) => bad.add(i)); });
  });
  return bad;
}
function startSudoku(levelName) {
  const shell = puzzleShell('🔢 Sudoku');
  if (!levelName) {
    shell.body.innerHTML = `<div class="sims-puzzle-pick"><p>¿Qué nivel?</p>${[['easy', 'Fácil 🙂'], ['medium', 'Medio 🤔'], ['hard', 'Difícil 🔥']].map(([id, label]) => `<button type="button" data-level="${id}">${label}</button>`).join('')}</div>`;
    shell.body.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-level]');
      if (pick) { shell.stop(); shell.host.remove(); startSudoku(pick.dataset.level); }
    });
    return;
  }
  const holes = { easy: 38, medium: 46, hard: 53 }[levelName];
  const givens = makeSudoku(holes);
  const cells = [...givens];
  let selected = -1;
  const render = () => {
    const bad = sudokuConflicts(cells);
    const sel = selected >= 0 ? cells[selected] : 0;
    shell.body.innerHTML = `<div class="sims-sudoku">${cells.map((n, i) => {
      const cls = [givens[i] ? 'is-given' : '', i === selected ? 'is-sel' : '', bad.has(i) ? 'is-bad' : '', sel && n === sel ? 'is-same' : '', (i % 9) % 3 === 2 && i % 9 !== 8 ? 'is-r' : '', Math.floor(i / 9) % 3 === 2 && i < 72 ? 'is-b' : ''].join(' ');
      return `<button type="button" class="${cls}" data-cell="${i}">${n || ''}</button>`;
    }).join('')}</div>
    <div class="sims-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-num="${n}">${n}</button>`).join('')}<button type="button" data-num="0">⌫</button></div>`;
  };
  render();
  shell.body.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-cell]');
    if (cell) { selected = Number(cell.dataset.cell); return render(); }
    const num = event.target.closest('[data-num]');
    if (num && selected >= 0 && !givens[selected]) {
      cells[selected] = Number(num.dataset.num);
      simBlip(900 + Number(num.dataset.num) * 40, 0.03);
      render();
      if (cells.every(Boolean) && !sudokuConflicts(cells).size) puzzleWin(shell, { game: 'sudoku', coins: { easy: 40, medium: 70, hard: 110 }[levelName], xp: { easy: 20, medium: 35, hard: 55 }[levelName] });
    }
  });
}

// Binairo (o Takuzu): cada fila y columna con tantos ceros como unos y nunca tres iguales seguidos.
function binairoRuleBreaks(cells, n) {
  const bad = new Set();
  const lines = [];
  for (let k = 0; k < n; k += 1) { lines.push([...Array(n).keys()].map((i) => k * n + i)); lines.push([...Array(n).keys()].map((i) => i * n + k)); }
  lines.forEach((lineCells) => {
    for (let i = 0; i + 2 < n; i += 1) {
      const [a, b, c] = [lineCells[i], lineCells[i + 1], lineCells[i + 2]];
      if (cells[a] !== null && cells[a] === cells[b] && cells[b] === cells[c]) [a, b, c].forEach((x) => bad.add(x));
    }
    const ones = lineCells.filter((i) => cells[i] === 1).length;
    const zeros = lineCells.filter((i) => cells[i] === 0).length;
    if (ones > n / 2 || zeros > n / 2) lineCells.forEach((i) => { if (cells[i] !== null) bad.add(i); });
  });
  return bad;
}
function makeBinairo(n) {
  const g = Array(n * n).fill(null);
  const valid = (i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const row = [...Array(n).keys()].map((k) => g[r * n + k]);
    const col = [...Array(n).keys()].map((k) => g[k * n + c]);
    for (const lineVals of [row, col]) {
      if (lineVals.filter((v) => v === 1).length > n / 2 || lineVals.filter((v) => v === 0).length > n / 2) return false;
      for (let k = 0; k + 2 < n; k += 1) if (lineVals[k] !== null && lineVals[k] === lineVals[k + 1] && lineVals[k + 1] === lineVals[k + 2]) return false;
    }
    return true;
  };
  const fill = (i) => {
    if (i === n * n) return true;
    for (const v of shuffled([0, 1])) { g[i] = v; if (valid(i) && fill(i + 1)) return true; }
    g[i] = null;
    return false;
  };
  fill(0);
  const puzzle = [...g];
  shuffled([...Array(n * n).keys()]).slice(0, Math.round(n * n * 0.58)).forEach((i) => { puzzle[i] = null; });
  return puzzle;
}
function startBinairo(size) {
  const shell = puzzleShell('⚪ Binairo');
  if (!size) {
    shell.body.innerHTML = `<div class="sims-puzzle-pick"><p>Rellena con 🔴 y 🔵: en cada fila y columna, tantos de uno como de otro y nunca tres iguales seguidos.</p><button type="button" data-size="6">6 × 6 🙂</button><button type="button" data-size="8">8 × 8 🔥</button></div>`;
    shell.body.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-size]');
      if (pick) { shell.stop(); shell.host.remove(); startBinairo(Number(pick.dataset.size)); }
    });
    return;
  }
  const n = size;
  const givens = makeBinairo(n);
  const cells = [...givens];
  const render = () => {
    const bad = binairoRuleBreaks(cells, n);
    shell.body.innerHTML = `<p class="sims-puzzle-hint">Toca una casilla para cambiarla: vacía → 🔴 → 🔵</p><div class="sims-binairo" style="--n:${n}">${cells.map((v, i) => `<button type="button" class="${givens[i] !== null ? 'is-given' : ''} ${bad.has(i) ? 'is-bad' : ''}" data-bin="${i}">${v === null ? '' : `<i class="is-${v}"></i>`}</button>`).join('')}</div>`;
  };
  render();
  shell.body.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-bin]');
    if (!cell) return;
    const i = Number(cell.dataset.bin);
    if (givens[i] !== null) return;
    cells[i] = cells[i] === null ? 0 : cells[i] === 0 ? 1 : null;
    simBlip(cells[i] === 1 ? 760 : 620, 0.03);
    render();
    if (cells.every((v) => v !== null) && !binairoRuleBreaks(cells, n).size) puzzleWin(shell, { game: 'binairo', coins: n === 6 ? 40 : 80, xp: n === 6 ? 20 : 45 });
  });
}

// Crucigrama: se monta uno distinto cada vez con palabras vuestras (Turín, Chieti, Kika…).
const CROSS_WORDS = [
  ['TIBURON', 'Así os llamáis con cariño (en singular)'], ['TURIN', 'Ciudad donde vivís'], ['MOLE', 'La ___ Antonelliana, símbolo de Turín'],
  ['CHIETI', 'Ciudad de la familia de Matteo'], ['KIKA', 'La perrita salchicha arlequín'], ['LOCO', 'El labrador rubio de Chieti'],
  ['PAELLA', 'Arroz valenciano en paellera'], ['GELATO', 'Helado, en italiano'], ['VESPA', 'Moto italiana con mucho estilo'],
  ['OLA', 'La gran ___ de Kanagawa, vuestro puzzle'], ['SOFA', 'Es verde caqui y está en el salón'], ['AMORE', 'Amor, en italiano'],
  ['PIZZA', 'Margarita, diavola o cuatro quesos'], ['MAJELLA', 'Montaña que se ve desde Chieti'], ['BICERIN', 'Café, chocolate y nata: muy turinés'],
  ['ALBA', 'Ciudad piamontesa de la trufa blanca'], ['GENOVA', 'Ciudad del pesto, en italiano'], ['NIZA', 'Ciudad de la Costa Azul'],
  ['MENORCA', 'Isla balear de calas turquesa'], ['SEVILLA', 'Ciudad de la Giralda'], ['GRANADA', 'Ciudad de la Alhambra'],
  ['ELDA', 'Ciudad alicantina del calzado'], ['NONNA', 'Abuela, en italiano'], ['TRUFA', 'Tesoro que se busca en Alba'],
  ['PESTO', 'Salsa de albahaca, piñones y queso'], ['SIESTA', 'Costumbre española después de comer'], ['BESO', 'Se da con los labios'],
  ['NOLI', 'Pueblo de la Riviera ligur que visitasteis'], ['ANTIBES', 'Ciudad francesa de la Costa Azul con murallas'], ['VALENCIA', 'Ciudad de las Fallas'],
  ['BURGOS', 'Ciudad de la catedral gótica y el Cid'], ['MADRID', 'Capital de España'], ['ALICANTE', 'Ciudad de la Explanada y el castillo de Santa Bárbara'],
  ['ESPRESSO', 'Café corto italiano'], ['PIAMONTE', 'Región de Turín']
];
function makeCrossword(target = 8) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pool = shuffled(CROSS_WORDS).slice(0, 22).sort((a, b) => b[0].length - a[0].length);
    const grid = new Map();
    const placed = [];
    const at = (x, y) => grid.get(`${x},${y}`);
    const put = ([word, clue], x, y, dir) => {
      [...word].forEach((ch, i) => grid.set(`${x + (dir === 'h' ? i : 0)},${y + (dir === 'v' ? i : 0)}`, ch));
      placed.push({ word, clue, x, y, dir });
    };
    const fits = (word, x, y, dir) => {
      const dx = dir === 'h' ? 1 : 0;
      const dy = dir === 'v' ? 1 : 0;
      if (at(x - dx, y - dy) || at(x + dx * word.length, y + dy * word.length)) return -1;
      let crosses = 0;
      for (let i = 0; i < word.length; i += 1) {
        const cx = x + dx * i;
        const cy = y + dy * i;
        const cur = at(cx, cy);
        if (cur) { if (cur !== word[i]) return -1; crosses += 1; continue; }
        // Una letra nueva no puede tocar otras de lado (saldrían palabras raras).
        if (at(cx + dy, cy + dx) || at(cx - dy, cy - dx)) return -1;
      }
      return crosses;
    };
    put(pool[0], 0, 0, 'h');
    for (const entry of pool.slice(1)) {
      if (placed.length >= target) break;
      const [word] = entry;
      const options = [];
      placed.forEach((other) => {
        [...other.word].forEach((ch, oi) => {
          [...word].forEach((wc, wi) => {
            if (ch !== wc) return;
            const dir = other.dir === 'h' ? 'v' : 'h';
            const ox = other.x + (other.dir === 'h' ? oi : 0);
            const oy = other.y + (other.dir === 'v' ? oi : 0);
            const x = dir === 'h' ? ox - wi : ox;
            const y = dir === 'v' ? oy - wi : oy;
            const crosses = fits(word, x, y, dir);
            if (crosses > 0) options.push({ x, y, dir, crosses });
          });
        });
      });
      if (options.length) {
        const best = options.sort((a, b) => b.crosses - a.crosses || Math.random() - 0.5)[0];
        put(entry, best.x, best.y, best.dir);
      }
    }
    if (placed.length < Math.min(6, target)) continue;
    const xs = [...grid.keys()].map((k) => Number(k.split(',')[0]));
    const ys = [...grid.keys()].map((k) => Number(k.split(',')[1]));
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(...xs) - minX + 1;
    const h = Math.max(...ys) - minY + 1;
    if (w > 13 || h > 13) continue;
    placed.forEach((p) => { p.x -= minX; p.y -= minY; });
    // Números en orden de lectura.
    const starts = [...new Set(placed.map((p) => `${p.y},${p.x}`))].sort((a, b) => { const [ay, ax] = a.split(',').map(Number); const [by, bx] = b.split(',').map(Number); return ay - by || ax - bx; });
    placed.forEach((p) => { p.num = starts.indexOf(`${p.y},${p.x}`) + 1; });
    const letters = {};
    grid.forEach((ch, key) => { const [x, y] = key.split(',').map(Number); letters[`${x - minX},${y - minY}`] = ch; });
    return { w, h, placed, letters };
  }
  return null;
}
function startCrossword() {
  const shell = puzzleShell('✏️ Crucigrama');
  const cw = makeCrossword(8);
  if (!cw) { shell.body.textContent = 'No se pudo montar el crucigrama, prueba otra vez'; return; }
  const numAt = {};
  cw.placed.forEach((p) => { numAt[`${p.x},${p.y}`] = p.num; });
  let dir = 'h';
  const cellsHtml = [];
  for (let y = 0; y < cw.h; y += 1) for (let x = 0; x < cw.w; x += 1) {
    const key = `${x},${y}`;
    if (!cw.letters[key]) { cellsHtml.push('<span class="is-void"></span>'); continue; }
    cellsHtml.push(`<label>${numAt[key] ? `<small>${numAt[key]}</small>` : ''}<input maxlength="1" autocomplete="off" autocapitalize="characters" spellcheck="false" data-cw="${key}" aria-label="Casilla" /></label>`);
  }
  const clues = (d) => cw.placed.filter((p) => p.dir === d).sort((a, b) => a.num - b.num).map((p) => `<li data-clue="${p.x},${p.y},${p.dir}"><b>${p.num}</b> ${escapeHtml(p.clue)} <i>(${p.word.length})</i></li>`).join('');
  shell.body.innerHTML = `<div class="sims-cross" style="--w:${cw.w}">${cellsHtml.join('')}</div>
    <div class="sims-cross-clues"><div><h4>Horizontales</h4><ol>${clues('h')}</ol></div><div><h4>Verticales</h4><ol>${clues('v')}</ol></div></div>
    <div class="sims-cross-actions"><button type="button" data-cw-check>Comprobar</button><button type="button" data-cw-hint>💡 Una letra</button></div>`;
  const input = (x, y) => shell.body.querySelector(`[data-cw="${x},${y}"]`);
  const check = (final) => {
    let all = true;
    shell.body.querySelectorAll('[data-cw]').forEach((el) => {
      const right = el.value.toUpperCase() === cw.letters[el.dataset.cw];
      if (!right) all = false;
      if (final) el.parentElement.classList.toggle('is-bad', Boolean(el.value) && !right);
      el.parentElement.classList.toggle('is-good', final && right);
    });
    return all;
  };
  shell.body.addEventListener('focusin', (event) => {
    const el = event.target.closest('[data-cw]');
    if (!el) return;
    const [x, y] = el.dataset.cw.split(',').map(Number);
    // Si solo hay palabra en un sentido, escribe en ese.
    const hasH = cw.letters[`${x - 1},${y}`] || cw.letters[`${x + 1},${y}`];
    const hasV = cw.letters[`${x},${y - 1}`] || cw.letters[`${x},${y + 1}`];
    if (hasH && !hasV) dir = 'h';
    if (hasV && !hasH) dir = 'v';
  });
  shell.body.addEventListener('input', (event) => {
    const el = event.target.closest('[data-cw]');
    if (!el) return;
    el.value = el.value.slice(-1).toUpperCase();
    el.parentElement.classList.remove('is-bad', 'is-good');
    if (el.value) {
      const [x, y] = el.dataset.cw.split(',').map(Number);
      const next = dir === 'h' ? input(x + 1, y) : input(x, y + 1);
      next?.focus();
    }
    if (check(false)) { check(true); puzzleWin(shell, { game: 'crossword', coins: 60, xp: 35 }); }
  });
  shell.body.addEventListener('click', (event) => {
    const clue = event.target.closest('[data-clue]');
    if (clue) { const [x, y, d] = clue.dataset.clue.split(','); dir = d; input(x, y)?.focus(); return; }
    if (event.target.closest('[data-cw-check]')) return check(true);
    if (event.target.closest('[data-cw-hint]')) {
      const empty = [...shell.body.querySelectorAll('[data-cw]')].filter((el) => el.value.toUpperCase() !== cw.letters[el.dataset.cw]);
      const pick = pickOne(empty);
      if (pick) { pick.value = cw.letters[pick.dataset.cw]; pick.parentElement.classList.add('is-hint'); if (check(false)) { check(true); puzzleWin(shell, { game: 'crossword', coins: 60, xp: 35 }); } }
    }
  });
}

// ---------- El mapa de vuestros viajes (el mismo que en Nosotros) ----------
// Solo los sitios visitados: los pendientes (kind = 'wish') se quedan en Nosotros.
const travelPlaces = () => (typeof places !== 'undefined' && Array.isArray(places) ? places.filter((place) => place.kind !== 'wish') : []);
function syncPlaces() {
  if (world()) world().state.places = travelPlaces();
}
window.addEventListener('umbral:places', syncPlaces);
function travelMapCard() {
  const list = travelPlaces();
  const countries = [...new Set(list.map((place) => place.country).filter(Boolean))];
  const card = showSimsCard('is-map', `<h3>🗺️ Vuestro mapa</h3>
    <canvas class="sims-travelmap" width="324" height="190"></canvas>
    <p class="sims-card-hint">${list.length} sitios juntos en ${countries.length} ${countries.length === 1 ? 'país' : 'países'}: 🏠 casa · 👪 familia · ❤️ viajes</p>
    <button type="button" class="sims-card-link" data-card-open="nosotros-map">Abrir el mapa en Nosotros</button>`);
  const canvas = card.querySelector('canvas');
  const draw = (t) => {
    if (!canvas.isConnected) return;
    simsWorld.drawTravelMap(canvas.getContext('2d'), 0, 0, 324, 190, list, { cell: 3, t, labels: true });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

// ---------- Barra de herramientas del juego ----------
const SIM_TOOLS = [
  ['chat', '💬', 'Escribir un mensaje', 'Chat'],
  ['photo', '📸', 'Hacer una foto', 'Foto'],
  ['wardrobe', '👗', 'Cambiarte de ropa', 'Armario'],
  ['decor', '🎨', 'Decorar la casa', 'Decorar'],
  ['shop', '🛍️', 'Tienda de muebles', 'Tienda'],
  ['game', '🧩', 'Sala de juegos', 'Juegos'],
  ['goals', '🏆', 'Aspiraciones y diario', 'Metas']
];
function handleSimTool(tool) {
  hidePie();
  if (tool === 'chat') return toggleChatBar();
  if (tool === 'photo') return takeSimPhoto();
  if (tool === 'wardrobe') return wardrobeCard();
  if (tool === 'decor') return decorCard();
  if (tool === 'shop') return shopCard();
  if (tool === 'game') return gamesCard();
  if (tool === 'goals') return window.simsLife?.goalsCard();
}

// ---------- Pantalla completa en horizontal ----------
// El juego ocupa toda la pantalla, gira a horizontal si el móvil lo permite (Android) y la
// cámara sigue a tu muñeco. En iPhone, que no deja poner una web en pantalla completa, ocupa
// toda la ventana y basta con girar el móvil.
async function setSimsFull(on) {
  simsState.full = on;
  simsModal.classList.toggle('is-full', on);
  const button = document.querySelector('#simsFull');
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
  button.title = button.getAttribute('aria-label');
  button.innerHTML = `<i data-lucide="${on ? 'minimize' : 'maximize'}"></i>`;
  lucide.createIcons();
  hidePie();
  world()?.endPan();
  if (on) {
    const rotate = document.querySelector('#simsRotate');
    rotate.classList.remove('is-shown');
    void rotate.offsetWidth;
    rotate.classList.add('is-shown');
    try { if (!document.fullscreenElement) await simsModal.requestFullscreen?.({ navigationUI: 'hide' }); } catch {}
    try { await screen.orientation?.lock?.('landscape'); } catch {}
    try { simsState.wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
  } else {
    try { screen.orientation?.unlock?.(); } catch {}
    try { if (document.fullscreenElement === simsModal) await document.exitFullscreen(); } catch {}
    try { await simsState.wakeLock?.release(); } catch {}
    simsState.wakeLock = null;
  }
  requestAnimationFrame(() => world()?.resize());
}

document.addEventListener('fullscreenchange', () => {
  // Salir con el gesto del sistema (atrás, Esc) también quita el modo pantalla completa.
  if (!document.fullscreenElement && simsState.full) setSimsFull(false);
});
document.addEventListener('visibilitychange', async () => {
  // El bloqueo de pantalla encendida se pierde al cambiar de app: se pide otra vez al volver.
  if (document.hidden || !simsState.full || !simsState.open || (simsState.wakeLock && !simsState.wakeLock.released)) return;
  try { simsState.wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
});

// El altavoz tiene tres estados: sonido y música, solo sonido, y silencio.
function updateSoundButton() {
  const button = document.querySelector('#simsSound');
  const music = simsState.sound && simsState.music;
  button.setAttribute('aria-pressed', String(simsState.sound));
  button.innerHTML = `<i data-lucide="${music ? 'volume-2' : simsState.sound ? 'volume-1' : 'volume-x'}"></i>`;
  lucide.createIcons();
  const label = music ? 'Quitar la música' : simsState.sound ? 'Silenciar' : 'Poner sonido y música';
  button.setAttribute('aria-label', label);
  button.title = label;
  if (simsState.open && music) { window.simsMusic?.setMood(curScene(), new Date().getHours()); window.simsMusic?.start(); }
  else window.simsMusic?.stop();
}

simsHouse.addEventListener('click', async (event) => {
  // Si acabas de arrastrar para mirar por la casa, soltar el dedo no cuenta como toque.
  if (simsState.dragged) { simsState.dragged = false; return; }
  const tool = event.target.closest('[data-tool]');
  if (tool) return handleSimTool(tool.dataset.tool);
  const chatbar = event.target.closest('.sims-chatbar');
  if (chatbar) {
    const quick = event.target.closest('[data-chat-quick]');
    if (quick) sendSimChat(quick.dataset.chatQuick);
    if (event.target.closest('[data-chat-close]')) toggleChatBar(false);
    return;
  }
  if (event.target.closest('.sims-game, .sims-puzzle, .sims-event, .sims-banner')) return;
  const queued = event.target.closest('[data-queue]');
  if (queued) { simsState.queue.splice(Number(queued.dataset.queue), 1); renderHud(); return; }
  const option = event.target.closest('[data-pie]');
  if (option) return handlePieChoice(option.dataset.pie);
  if (event.target.closest('.sims-hud-home')) return goHome();
  const appCard = event.target.closest('.sims-card');
  if (appCard) {
    if (event.target.closest('[data-card-close]') || event.target === appCard) return appCard.remove();
    if (event.target.closest('[data-build-start]')) return window.simsBuild?.start();
    const outfit = event.target.closest('[data-outfit]');
    if (outfit) {
      pickOutfit(outfit.dataset.outfit);
      appCard.querySelectorAll('[data-outfit]').forEach((button) => button.setAttribute('aria-pressed', String(button === outfit)));
      return;
    }
    const decorButton = event.target.closest('[data-decor]');
    if (decorButton) {
      const [part, value] = decorButton.dataset.decor.split(':');
      setDecorChoice(part, value);
      appCard.querySelectorAll(`[data-decor^="${part}:"]`).forEach((button) => button.setAttribute('aria-pressed', String(button === decorButton)));
      return;
    }
    const buy = event.target.closest('[data-buy]');
    if (buy) return buyItem(buy.dataset.buy);
    const play = event.target.closest('[data-play]');
    if (play) return playGame(play.dataset.play);
    if (event.target.closest('[data-snapshot-save]')) return saveSnapshot(event.target.closest('[data-snapshot-save]'));
    if (event.target.closest('[data-snapshot-download]')) return downloadSnapshot();
    const toggle = event.target.closest('[data-shop-toggle]');
    if (toggle && typeof toggleShoppingItem === 'function') {
      await toggleShoppingItem(toggle.dataset.shopToggle);
      simBlip(1100, 0.05);
      refreshAppData();
      return shoppingCard();
    }
    const done = event.target.closest('[data-task-done]');
    if (done && typeof completeTask === 'function') {
      done.disabled = true;
      const me = sims[meKey()];
      if (me && !me.busy) { setAnim(me, 'emote', { dir: 'down', frames: [1, 2, 2, 1], fps: 4, loop: false }); me.expr = 'happy'; setTimeout(() => { me.expr = null; idle(me); }, 1500); }
      await completeTask(done.dataset.taskDone);
      world()?.emit('spark', me.x, me.headY + 6, { count: 5, spread: 12, vy: -18 });
      refreshAppData();
      return tasksCard();
    }
    const open = event.target.closest('[data-card-open]');
    if (open) {
      const target = open.dataset.cardOpen;
      appCard.remove();
      closeSims();
      setTimeout(() => {
        if (target === 'calendar') return typeof openCalendar === 'function' && openCalendar();
        if (target === 'nosotros-map') { showView('nosotros'); return typeof setUsView === 'function' && setUsView('map'); }
        return showView(target);
      }, 300);
    }
    return;
  }
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
    simsState.queue = [];
    liveSend('cancel');
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
// Arrastrar el dedo (o el ratón) por la casa para mirar alrededor cuando no cabe entera.
// Pellizco con dos dedos para acercar o alejar (y rueda del ratón en el ordenador).
const pinch = { points: new Map(), startDist: 0, startZoom: 1 };
const pinchDist = () => { const [a, b] = [...pinch.points.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
simsHouse.addEventListener('pointerdown', (event) => {
  const w = world();
  if (!w || event.target !== w.canvas) return;
  pinch.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch.points.size === 2) {
    pinch.startDist = pinchDist();
    pinch.startZoom = simsState.zoom;
    simsState.drag = null;
    w.state.pinching = true;
    hidePie();
    return;
  }
  simsState.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  simsState.dragged = false;
});
simsHouse.addEventListener('pointermove', (event) => {
  if (!pinch.points.has(event.pointerId)) return;
  pinch.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch.points.size !== 2 || !pinch.startDist) return;
  simsState.zoom = Math.max(1, Math.min(3, pinch.startZoom * (pinchDist() / pinch.startDist)));
  simsState.dragged = true;
  updateZoom({ save: false });
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => simsHouse.addEventListener(type, (event) => {
  if (!pinch.points.delete(event.pointerId)) return;
  if (pinch.points.size < 2 && pinch.startDist) {
    pinch.startDist = 0;
    if (world()) world().state.pinching = false;
    updateZoom();
  }
}));
simsHouse.addEventListener('wheel', (event) => {
  const w = world();
  if (!w || event.target !== w.canvas) return;
  event.preventDefault();
  simsState.zoom = Math.max(1, Math.min(3, simsState.zoom * Math.exp(-event.deltaY * 0.0015)));
  updateZoom();
}, { passive: false });
simsHouse.addEventListener('pointermove', (event) => {
  const drag = simsState.drag;
  const w = world();
  if (!drag || !w || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 10) return;
  const { view, cam } = w.state;
  if (view.w / cam.z >= simsWorld.W - 1 && view.h / cam.z >= simsWorld.H - 1) return;
  if (!drag.moved) { drag.moved = true; hidePie(); w.canvas.setPointerCapture?.(event.pointerId); }
  w.panBy(dx, dy);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
['pointerup', 'pointercancel'].forEach((type) => simsHouse.addEventListener(type, (event) => {
  if (simsState.drag?.id !== event.pointerId) return;
  simsState.dragged = simsState.drag.moved && type === 'pointerup';
  simsState.drag = null;
}));
// Añadir a la lista de la compra desde la nota de la nevera (de verdad).
simsHouse.addEventListener('submit', async (event) => {
  const chatForm = event.target.closest('.sims-chatbar');
  if (chatForm) {
    event.preventDefault();
    sendSimChat(chatForm.text.value);
    chatForm.text.value = '';
    return;
  }
  const form = event.target.closest('[data-shop-add]');
  if (!form) return;
  event.preventDefault();
  const text = form.item.value.trim();
  if (!text || typeof addShoppingItems !== 'function') return;
  form.item.disabled = true;
  await addShoppingItems(text);
  refreshAppData();
  shoppingCard();
  simsHouse.querySelector('[data-shop-add] input')?.focus();
});
document.querySelector('#simsNeeds').addEventListener('click', (event) => {
  // En pantalla completa, el diamante pliega y despliega las necesidades.
  if (simsState.full && event.target.closest('.sims-plumbob')) {
    simsState.needsMini = !simsState.needsMini;
    return event.currentTarget.classList.toggle('is-mini', simsState.needsMini);
  }
  const want = event.target.closest('[data-want]');
  if (want) return startWant(want.dataset.want);
  const who = event.target.closest('[data-needs-who]');
  if (!who) return;
  simsState.needsOf = who.dataset.needsWho;
  renderSimsNeeds();
});
document.querySelector('#simsSound').addEventListener('click', () => {
  if (simsState.sound && simsState.music) simsState.music = false;
  else if (simsState.sound) simsState.sound = false;
  else { simsState.sound = true; simsState.music = true; }
  try { localStorage.setItem('umbral-sims-sound', simsState.sound ? 'on' : 'off'); localStorage.setItem('umbral-sims-music', simsState.music ? 'on' : 'off'); } catch {}
  updateSoundButton();
  showToast(simsState.sound ? (simsState.music ? '🎵 Sonido y música' : '🔉 Solo sonido, sin música') : '🔇 Silencio');
  if (!simsState.sound) { setRainSound(false); try { speechSynthesis.cancel(); } catch {} }
});
document.querySelector('#closeSims').addEventListener('click', closeSims);
document.querySelector('#simsFull').addEventListener('click', () => setSimsFull(!simsState.full));
document.querySelector('#simsZoom').addEventListener('click', () => {
  hidePie();
  simsState.zoom = simsState.zoom > 1.05 ? 1 : ZOOM_CLOSE;
  world()?.endPan();
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
  // La ropa elegida y la decoración también se ven en el jardín de inicio.
  loadSimPicks();
  loadDecor();
  if (!simsState.open) return;
  renderSimsNeeds();
  followPartnerPlace();
  if (!live.partnerOnline) replayPartnerActivity();
});
// Un toque del otro con la casa abierta: se ve aquí (y no en la escena).
window.addEventListener('umbral:poke', (event) => {
  if (!simsState.open) return;
  event.preventDefault();
  doSocial(event.detail.kind, { incoming: true });
});
