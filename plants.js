// Plantas de casa: cada una tiene un avatar que cambia según lo que lleva sin agua, una
// guía de cuidados y problemas, y recordatorio de riego (la próxima fecha se guarda en
// next_water_on y pg_cron avisa por la mañana).
const plantsStore = createHouseholdStore({ table: 'plants', localKey: 'umbral-plants' });
const plantLogStore = createHouseholdStore({ table: 'plant_log', localKey: 'umbral-plant-log' });

// Guía de cada especie. Frecuencias orientativas para interior en Turín: más agua en verano
// y mucha menos en invierno (crecen poco, aunque la calefacción seque el aire). Siempre
// manda el dedo en la tierra. problems: [síntoma, por qué pasa, qué hacer].
const PLANT_SPECIES = {
  monstera: {
    label: 'Monstera',
    latin: 'Monstera deliciosa',
    intro: 'Trepadora de selva tropical. Con buena luz crece rápido y sus hojas se abren con los típicos cortes.',
    water: { summer: 7, mid: 10, winter: 14 },
    check: 'Riega cuando los primeros 3–5 cm de tierra estén secos.',
    care: [
      ['sun', 'Luz', 'Mucha luz indirecta, cerca de una ventana luminosa. El sol directo de mediodía le quema las hojas; con poca luz salen hojas pequeñas y sin cortes.'],
      ['droplets', 'Riego', 'A fondo, hasta que salga agua por los agujeros, y vacía el plato a los 15 minutos. Mejor quedarse corto que pasarse: el exceso de agua es lo que más la daña.'],
      ['cloud-fog', 'Humedad', 'Le gusta el ambiente húmedo (50–60 %). Con la calefacción, agrúpala con otras plantas o ponle debajo un plato con piedras y agua (sin que la maceta toque el agua).'],
      ['thermometer', 'Temperatura', 'Entre 18 y 27 °C. Por debajo de 12 °C sufre: lejos de ventanas abiertas en invierno y de radiadores.'],
      ['sprout', 'Abono', 'Cada 4 semanas de marzo a septiembre, con abono líquido para plantas verdes a la mitad de la dosis. En invierno, nada.'],
      ['shovel', 'Trasplante', 'Cada 1–2 años en primavera, cuando las raíces salgan por abajo. Maceta solo 3–5 cm más ancha y tierra aireada: sustrato universal con corteza de pino y perlita.'],
      ['scissors', 'Poda y esquejes', 'Corta justo debajo de un nudo que tenga raíz aérea: en un vaso de agua echa raíces en 3–6 semanas. Las raíces aéreas no se cortan; guíalas hacia el tutor o la tierra.'],
      ['paw-print', 'Mascotas', 'Tóxica para perros y gatos si la muerden: irrita la boca. Mejor fuera de su alcance.']
    ],
    problems: [
      ['Hojas nuevas sin cortes', 'Falta de luz, o la planta aún es joven (las primeras hojas siempre salen enteras).', 'Acércala a una ventana más luminosa, sin sol directo de mediodía. Las hojas que ya han salido no cambian; las nuevas sí.'],
      ['Gotitas de agua en el borde de las hojas', 'Se llama gutación: la planta expulsa agua sobrante. Suele pasar tras regar mucho o con mucha humedad.', 'Es inofensivo. Si pasa a menudo, espacia un poco los riegos.'],
      ['Tallos largos y hojas pequeñas', 'Se estira buscando luz.', 'Más luz y un tutor de musgo o fibra de coco para que trepe: con apoyo, las hojas salen más grandes.'],
      ['Raíces aéreas por todas partes', 'Es normal: en la selva las usa para trepar.', 'Guíalas hacia el tutor o entiérralas. Solo corta las que estén secas.']
    ]
  },
  strelitzia: {
    label: 'Strelitzia',
    latin: 'Strelitzia · ave del paraíso',
    intro: 'Hojas grandes de aire tropical, parecidas a las del platanero. Es la más exigente con la luz de las tres.',
    water: { summer: 6, mid: 9, winter: 14 },
    check: 'Riega cuando los 2–3 cm de arriba estén secos; en verano le gusta la tierra algo húmeda.',
    care: [
      ['sun', 'Luz', 'La que más luz necesita: junto a la ventana más luminosa. Agradece unas horas de sol suave por la mañana o por la tarde. Con poca luz deja de crecer.'],
      ['droplets', 'Riego', 'Tierra ligeramente húmeda en primavera y verano, más seca en invierno. Riega a fondo y nunca dejes agua estancada en el plato.'],
      ['cloud-fog', 'Humedad', 'Media-alta. Pásale un paño húmedo por las hojas de vez en cuando: quita el polvo y le ayuda a respirar.'],
      ['thermometer', 'Temperatura', 'Entre 18 y 30 °C. No le gustan las corrientes frías ni bajar de 10 °C.'],
      ['sprout', 'Abono', 'Cada 2–3 semanas de marzo a septiembre. En invierno, nada.'],
      ['shovel', 'Trasplante', 'Le gusta estar algo apretada: cada 2–3 años en primavera, con tierra que drene bien. Al trasplantar puedes separar los hijuelos con sus raíces para tener plantas nuevas.'],
      ['scissors', 'Limpieza', 'Corta las hojas viejas secas por la base del tallo con tijeras limpias. No cortes hojas sanas aunque estén rajadas.'],
      ['paw-print', 'Mascotas', 'Puede sentar mal a perros y gatos si la mordisquean (molestias digestivas).']
    ],
    problems: [
      ['Hojas rajadas', 'Es normal: en la naturaleza se rajan para dejar pasar el viento. Con aire seco o golpes se nota más.', 'No hay que hacer nada. Si quieres menos rajas, sube la humedad y evita que la rocen al pasar.'],
      ['Hojas que se enrollan a lo largo', 'Sed o calor: la planta cierra la hoja para perder menos agua.', 'Comprueba la tierra y riega a fondo si está seca. Aléjala del radiador.'],
      ['Bordes marrones y secos', 'Aire seco o riegos muy espaciados.', 'Riega con más regularidad y sube la humedad. Recorta lo seco siguiendo la forma de la hoja.'],
      ['Manchas en la hoja nueva al abrirse', 'Frío, corrientes o riego irregular mientras se formaba.', 'Mantén la temperatura estable y el riego regular; las siguientes saldrán bien.'],
      ['Algodoncillos blancos en la base de las hojas', 'Cochinilla algodonosa, una plaga habitual en strelitzias.', 'Quítala con un bastoncillo con alcohol y después limpia con jabón potásico. Repite cada semana hasta que no aparezca más.'],
      ['No florece', 'En interior es raro: necesita varios años, mucha luz y algo de sol directo.', 'Dale la ventana más luminosa de la casa y abono en primavera. Si no florece, es normal.']
    ]
  },
  pothos: {
    label: 'Pothos',
    latin: 'Epipremnum aureum',
    intro: 'Colgante o trepadora y muy resistente; perfecta para una estantería. Avisa de la sed con las hojas lacias.',
    water: { summer: 7, mid: 10, winter: 15 },
    check: 'Riega cuando la mitad de arriba de la tierra esté seca. Si las hojas se ven blandas y caídas, tiene sed.',
    care: [
      ['sun', 'Luz', 'Luz indirecta media o alta. Aguanta rincones con poca luz, pero pierde las vetas claras y echa guías largas con pocas hojas.'],
      ['droplets', 'Riego', 'Prefiere quedarse corto que encharcado. En una estantería alta la tierra se seca antes que abajo: compruébala con el dedo.'],
      ['cloud-fog', 'Humedad', 'Se adapta a la de casa. Pulverizarla de vez en cuando le sienta bien, sobre todo con calefacción.'],
      ['thermometer', 'Temperatura', 'Entre 15 y 30 °C. Por debajo de 10 °C las hojas se oscurecen.'],
      ['sprout', 'Abono', 'Una vez al mes de marzo a septiembre.'],
      ['shovel', 'Trasplante', 'Cada 1–2 años en primavera, cuando las raíces salgan por los agujeros. Le vale sustrato universal con algo de perlita.'],
      ['scissors', 'Poda y esquejes', 'Despunta las guías largas justo encima de una hoja y saldrá más frondoso. Un trozo con un nudo echa raíces en agua en 2–3 semanas; vuelve a plantarlo en la misma maceta para rellenarla.'],
      ['paw-print', 'Mascotas', 'Tóxico para perros y gatos si lo muerden: cuidado con las guías que cuelgan a su altura.']
    ],
    problems: [
      ['Hojas lacias y blandas', 'Sed: es su forma de avisar.', 'Riega a fondo. En unas horas recupera la firmeza. Si la tierra estaba mojada, el problema es el contrario: déjala secar.'],
      ['Hojas amarillas', 'Casi siempre exceso de agua.', 'Deja secar la mitad de la tierra antes de regar y vacía el plato. Quita las hojas amarillas.'],
      ['Pierde las vetas claras', 'Poca luz: la planta produce más verde para aprovecharla.', 'Muévelo a un sitio más luminoso. Las hojas nuevas recuperarán el variegado.'],
      ['Guías peladas con hojas pequeñas', 'Poca luz o guías muy largas.', 'Poda las guías y planta los esquejes en la misma maceta para que quede frondoso.']
    ]
  },
  other: {
    label: 'Otra planta',
    latin: 'Planta de interior',
    intro: 'Consejos generales que sirven para la mayoría de plantas de interior.',
    water: { summer: 7, mid: 10, winter: 14 },
    check: 'Riega cuando los primeros centímetros de tierra estén secos.',
    care: [
      ['sun', 'Luz', 'La mayoría de plantas de interior prefieren mucha luz indirecta.'],
      ['droplets', 'Riego', 'A fondo y espaciado; vacía el plato para que las raíces no se encharquen.'],
      ['sprout', 'Abono', 'Una vez al mes en primavera y verano.']
    ],
    problems: []
  }
};

// Problemas comunes a todas las plantas.
const PLANT_SYMPTOMS = [
  ['Hojas amarillas', 'Casi siempre es exceso de agua, sobre todo si son las de abajo y la tierra sigue húmeda. Si es una sola hoja vieja, es normal: la planta la renueva.', 'Espacia los riegos, comprueba que la maceta drena y vacía el plato. Corta la hoja cuando esté amarilla del todo.'],
  ['Puntas marrones y secas', 'Aire seco (calefacción), riegos irregulares o sales del agua del grifo.', 'Riega con regularidad, usa agua reposada y sube la humedad agrupando plantas. Puedes recortar la punta seca con tijeras limpias.'],
  ['Manchas marrones blandas o negras', 'Exceso de agua: las raíces empiezan a pudrirse.', 'Deja secar bien la tierra antes de volver a regar. Si huele mal, saca la planta, corta las raíces negras y blandas y cambia la tierra.'],
  ['Hojas caídas', 'Si la tierra está seca, tiene sed. Si está empapada, sobra agua y las raíces no respiran.', 'Toca la tierra: si está seca, riega a fondo y se recuperará en horas; si está mojada, déjala secar y no riegues.'],
  ['Manchas claras o quemadas', 'Quemadura de sol directo, a menudo detrás del cristal.', 'Muévela a un sitio con luz filtrada. Las manchas no desaparecen, pero las hojas nuevas saldrán sanas.'],
  ['Puntitos, telarañas finas o bichitos', 'Plagas como la araña roja (sobre todo con aire seco) o la cochinilla.', 'Limpia las hojas por las dos caras con un paño con agua y jabón potásico, y repite cada semana hasta que desaparezcan. Sepárala de las otras plantas mientras tanto.'],
  ['Mosquitas pequeñas alrededor de la maceta', 'Mosca del sustrato: aparece cuando la tierra está húmeda mucho tiempo.', 'Deja secar más la capa de arriba entre riegos. Las trampas amarillas adhesivas atrapan a los adultos.'],
  ['Moho blanco sobre la tierra', 'Tierra húmeda mucho tiempo y poca ventilación.', 'Retira la capa de arriba, riega menos y ventila la habitación. No es grave.'],
  ['Hojas que caen de golpe', 'Cambio brusco: traslado, corriente fría o un radiador cerca.', 'Busca un sitio estable y no la muevas más. Se recuperará en unas semanas.']
];

// Cómo regar bien, para todas.
const WATERING_TIPS = [
  ['hand', 'Mira antes de regar', 'Mete el dedo 2–3 cm en la tierra (o un palillo de madera: si sale limpio y seco, toca). La fecha es una guía; la tierra manda.'],
  ['droplets', 'Riega a fondo', 'Echa agua despacio por toda la superficie hasta que salga por abajo. Así se moja todo el cepellón y no solo la capa de arriba.'],
  ['circle-off', 'Vacía el plato', 'A los 15 minutos tira el agua que quede en el plato o en el cubremacetas. Raíces en agua estancada se pudren.'],
  ['glass-water', 'Agua a temperatura ambiente', 'Mejor reposada de la noche anterior: el agua de Turín es bastante calcárea y así pierde cloro y no llega fría.'],
  ['sunrise', 'Mejor por la mañana', 'La planta usa el agua durante el día y la tierra no se queda húmeda y fría toda la noche.'],
  ['snowflake', 'En invierno, menos', 'Con poca luz crecen poco y beben menos, aunque la calefacción seque el aire. Pulveriza las hojas en vez de regar más.'],
  ['plane', 'Si os vais unos días', 'Riega bien antes de salir y júntalas lejos de la ventana. Para más de una semana, un cordón de algodón de un vaso de agua a la tierra funciona como goteo.']
];

const PLANT_MOODS = {
  watered: { label: 'Recién regada', icon: 'droplets' },
  happy: { label: 'Feliz', icon: 'smile' },
  ok: { label: 'Bien', icon: 'smile' },
  thirsty: { label: 'Tiene sed', icon: 'frown' },
  parched: { label: 'Muy sedienta', icon: 'thermometer-sun' }
};

const SEASON_LABELS = { summer: 'en verano', mid: 'en esta época', winter: 'en invierno' };

let householdPlants = [];
let plantLog = [];
let openPlantId = null;
let plantsReloadTimer;

const plantSpecies = (plant) => PLANT_SPECIES[plant.species] || PLANT_SPECIES.other;

function seasonOf(date = new Date()) {
  const month = date.getMonth();
  if (month >= 5 && month <= 7) return 'summer';
  if (month === 11 || month <= 1) return 'winter';
  return 'mid';
}

const plantInterval = (plant, date = new Date()) => Number(plant.water_every_days) || plantSpecies(plant).water[seasonOf(date)];

function addDaysISO(iso, days) {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToISO(date);
}

const nextWaterFrom = (plant, wateredISO) => addDaysISO(wateredISO, plantInterval(plant, isoToDate(wateredISO)));

function plantState(plant) {
  const today = dateToISO(new Date());
  const interval = plantInterval(plant);
  const due = plant.next_water_on || today;
  const daysLeft = daysBetween(today, due);
  const hoursSince = plant.last_watered_at ? (Date.now() - new Date(plant.last_watered_at).getTime()) / 3600000 : null;
  const daysSince = hoursSince === null ? null : Math.floor(hoursSince / 24);
  let mood;
  if (hoursSince !== null && hoursSince < 20) mood = 'watered';
  else if (daysLeft > interval * 0.45) mood = 'happy';
  else if (daysLeft > 0) mood = 'ok';
  else if (daysLeft >= -2) mood = 'thirsty';
  else mood = 'parched';
  // Agua que le queda: 100 % recién regada, 0 % el día que toca.
  const level = Math.max(0, Math.min(1, daysLeft / interval));
  let status;
  if (mood === 'watered') status = `Regada hoy · próximo riego ${dueLabel(due).toLowerCase()}`;
  else if (daysLeft > 1) status = `Riego en ${daysLeft} días`;
  else if (daysLeft === 1) status = 'Riego mañana';
  else if (daysLeft === 0) status = 'Toca regar hoy';
  else status = daysLeft === -1 ? 'Tenía que regarse ayer' : `Lleva ${-daysLeft} días esperando agua`;
  return { mood, daysLeft, daysSince, interval, level, status, due };
}

// ---------- Avatar ----------

// Hoja de monstera con sus cortes (máscara con id único por avatar).
const MONSTERA_BLADE = 'M0 -26 C-13 -25 -23 -34 -20 -47 C-17 -59 -5 -61 0 -54 C5 -61 17 -59 20 -47 C23 -34 13 -25 0 -26 Z';
const MONSTERA_CUTS = 'M-20 -44 L-7 -42 M-19 -36 L-6 -37 M-14 -29 L-4 -32 M20 -44 L7 -42 M19 -36 L6 -37 M14 -29 L4 -32';
const STRELITZIA_BLADE = 'M0 -30 C-9 -36 -11 -56 -4 -70 C-2 -73 2 -73 4 -70 C11 -56 9 -36 0 -30 Z';
const POTHOS_LEAF = 'M0 0 C-5 -3 -6.5 -9 -2.8 -10.5 C-1.2 -11 0 -9.6 0 -8.6 C0 -9.6 1.2 -11 2.8 -10.5 C6.5 -9 5 -3 0 0 Z';

const leafGroup = (x, y, angle, scale, dir, inner) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><g class="pl-leaf" style="--dir:${dir}">${inner}</g></g>`;

function plantFoliage(species, uid) {
  if (species === 'monstera') {
    const leaf = `<path class="pl-stem" d="M0 0 C1 -10 -1 -18 0 -27"></path><path class="pl-blade" d="${MONSTERA_BLADE}" mask="url(#${uid}-cuts)"></path><path class="pl-vein" d="M0 -27 V-52"></path>`;
    return `<defs><mask id="${uid}-cuts" maskUnits="userSpaceOnUse" x="-30" y="-70" width="60" height="50"><rect x="-30" y="-70" width="60" height="50" fill="#fff"></rect><path d="${MONSTERA_CUTS}" stroke="#000" stroke-width="2.6" stroke-linecap="round"></path><circle cx="-9" cy="-49" r="1.8" fill="#000"></circle><circle cx="9" cy="-49" r="1.8" fill="#000"></circle></mask></defs>
      ${leafGroup(60, 88, -42, 0.78, -1, leaf)}${leafGroup(60, 88, 40, 0.74, 1, leaf)}${leafGroup(60, 88, -14, 0.98, -1, leaf)}${leafGroup(60, 88, 14, 0.9, 1, leaf)}`;
  }
  if (species === 'strelitzia') {
    const leaf = (torn) => `<path class="pl-stem" d="M0 0 V-31"></path><path class="pl-blade" d="${STRELITZIA_BLADE}"></path><path class="pl-vein" d="M0 -31 V-69 M0 -40 L-6 -46 M0 -50 L-6 -56 M0 -40 L6 -46 M0 -50 L6 -56"></path>${torn ? '<path class="pl-tear" d="M-7.5 -50 L-3 -53"></path>' : ''}`;
    return `${leafGroup(60, 88, -30, 0.78, -1, leaf(false))}${leafGroup(60, 88, 30, 0.8, 1, leaf(true))}${leafGroup(60, 88, -12, 0.96, -1, leaf(true))}${leafGroup(60, 88, 12, 0.92, 1, leaf(false))}${leafGroup(60, 88, 0, 1.04, 1, leaf(false))}`;
  }
  if (species === 'pothos') {
    const heart = (x, y, angle, scale = 1) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><g class="pl-leaf" style="--dir:${angle > 90 || angle < -90 ? 0.4 : angle < 0 ? -1 : 1}"><path class="pl-blade" d="${POTHOS_LEAF}"></path><path class="pl-variegation" d="M0 -1.5 C-1.5 -4 -2.5 -6.5 -1 -8.6"></path></g></g>`;
    const vines = '<path class="pl-vine" d="M40 60 C26 64 20 80 24 96 C27 108 22 118 18 128"></path><path class="pl-vine" d="M80 60 C94 64 100 80 96 96 C93 108 98 118 102 126"></path><path class="pl-vine" d="M48 60 C40 70 38 82 41 94"></path>';
    const leaves = [heart(25, 73, -150), heart(21, 88, 165), heart(25, 102, -170), heart(21, 116, 170, 0.9), heart(17, 127, -175, 0.8),
      heart(95, 73, 150), heart(99, 88, -165), heart(95, 102, 170), heart(99, 114, -170, 0.9),
      heart(41, 80, 160, 0.85), heart(40, 93, -170, 0.8),
      heart(50, 58, -30, 1.15), heart(60, 54, 0, 1.25), heart(70, 58, 30, 1.15), heart(43, 62, -60), heart(77, 62, 60)].join('');
    return `${vines}${leaves}`;
  }
  const leaf = '<path class="pl-stem" d="M0 0 V-18"></path><path class="pl-blade" d="M0 -16 C-9 -20 -10 -34 0 -42 C10 -34 9 -20 0 -16 Z"></path><path class="pl-vein" d="M0 -18 V-38"></path>';
  return [-50, -25, 0, 25, 50].map((angle, index) => leafGroup(60, 88, angle, [0.8, 0.95, 1.05, 0.95, 0.8][index], angle < 0 ? -1 : 1, leaf)).join('');
}

// Maceta con cara: la expresión cambia con data-mood (CSS).
function potMarkup(y) {
  return `<g class="pl-pot" transform="translate(60 ${y})">
    <ellipse class="pl-soil" cx="0" cy="1.5" rx="26" ry="3.2"></ellipse>
    <rect class="pl-rim" x="-30" y="0" width="60" height="10" rx="3"></rect>
    <path class="pl-body" d="M-26 10 H26 L20.5 37 Q19.6 41 15.6 41 H-15.6 Q-19.6 41 -20.5 37 Z"></path>
    <g class="pl-face">
      <g class="pl-eyes-open"><circle cx="-9" cy="22" r="2.3"></circle><circle cx="9" cy="22" r="2.3"></circle><circle class="pl-glint" cx="-8.2" cy="21.2" r=".8"></circle><circle class="pl-glint" cx="9.8" cy="21.2" r=".8"></circle></g>
      <g class="pl-eyes-happy"><path d="M-12 23 q3 -4 6 0 M6 23 q3 -4 6 0"></path></g>
      <g class="pl-eyes-dizzy"><path d="M-11 20 l4 4 M-7 20 l-4 4 M7 20 l4 4 M11 20 l-4 4"></path></g>
      <path class="pl-brows" d="M-12.5 19 l5.5 -2.2 M12.5 19 l-5.5 -2.2"></path>
      <circle class="pl-cheek" cx="-14" cy="27" r="2.6"></circle><circle class="pl-cheek" cx="14" cy="27" r="2.6"></circle>
      <path class="pl-mouth-smile" d="M-4 28 q4 4.5 8 0"></path>
      <path class="pl-mouth-open" d="M-4.2 27.5 q4.2 6.5 8.4 0 z"></path>
      <path class="pl-mouth-wavy" d="M-5 30 q1.7 -2 3.4 0 q1.7 2 3.4 0 q1.6 -2 3.2 0"></path>
      <ellipse class="pl-mouth-gasp" cx="0" cy="30" rx="2.6" ry="3"></ellipse>
    </g>
    <path class="pl-sweat" d="M29 -4 q3 5 0 7 q-3 -2 0 -7 z"></path>
  </g>`;
}

function plantAvatar(plant, size = 'card') {
  const uid = `pl-${String(plant.id).replace(/[^a-z0-9]/gi, '').slice(-12)}-${size}`;
  const potY = plant.species === 'pothos' ? 58 : 86;
  const shelf = plant.species === 'pothos' ? '<rect class="pl-shelf" x="6" y="99" width="108" height="5" rx="1.5"></rect><path class="pl-bracket" d="M20 104 v8 h8 M100 104 v8 h-8"></path>' : '';
  const drops = [[48, 0], [60, -0.35], [72, -0.7]].map(([x, delay]) => `<path class="pl-drop" style="--x:${x}px;--delay:${delay}s" d="M0 -5 q3.4 5 0 7 q-3.4 -2 0 -7 z"></path>`).join('');
  const sparkles = [[30, 30], [92, 24], [86, 60]].map(([x, y], index) => `<g transform="translate(${x} ${y})"><path class="pl-spark" style="--delay:${index * -0.6}s" d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z"></path></g>`).join('');
  return `<svg class="plant-svg" viewBox="0 0 120 132" aria-hidden="true" focusable="false">
    <ellipse class="pl-shadow" cx="60" cy="${plant.species === 'pothos' ? 100 : 128}" rx="30" ry="3.5"></ellipse>
    ${shelf}
    <g class="pl-foliage">${plantFoliage(plant.species, uid)}</g>
    ${potMarkup(potY)}
    <g class="pl-drops">${drops}</g>
    <g class="pl-sparkles">${sparkles}</g>
  </svg>`;
}

// ---------- Datos ----------

async function loadPlants() {
  try {
    const since = new Date(Date.now() - 120 * 86400000).toISOString();
    const [plants, log] = await Promise.all([
      plantsStore.list({ build: (query) => query.eq('active', true).order('created_at'), filter: (row) => row.active !== false }),
      plantLogStore.list({ build: (query) => query.gte('created_at', since).order('created_at', { ascending: false }).limit(200), filter: (row) => row.created_at >= since })
    ]);
    householdPlants = plants;
    plantLog = log.sort((first, second) => String(second.created_at).localeCompare(String(first.created_at)));
  } catch (error) {
    console.error('[Umbral] Plantas:', error);
    showToast(`No se pudieron cargar las plantas: ${error.message || 'error desconocido'}`);
  }
  renderPlants();
}

async function savePlant(values) {
  const species = PLANT_SPECIES[values.species] ? values.species : 'other';
  const row = {
    name: values.name.trim().slice(0, 40) || PLANT_SPECIES[species].label,
    species,
    location: (values.location || '').trim().slice(0, 40),
    water_every_days: values.waterEvery ? Number(values.waterEvery) : null
  };
  try {
    if (values.id) {
      const plant = householdPlants.find((entry) => entry.id === values.id);
      const merged = { ...plant, ...row };
      // Si cambia la frecuencia, se recalcula la próxima fecha desde el último riego.
      if (plant.last_watered_at) row.next_water_on = nextWaterFrom(merged, dateToISO(new Date(plant.last_watered_at)));
      await plantsStore.update(values.id, row);
      Object.assign(plant, row);
      showToast('Planta actualizada');
    } else {
      const lastISO = values.lastWatered === 'unknown' ? null : addDaysISO(dateToISO(new Date()), -Number(values.lastWatered || 0));
      row.last_watered_at = lastISO ? new Date(`${lastISO}T10:00:00`).toISOString() : null;
      row.next_water_on = lastISO ? nextWaterFrom(row, lastISO) : dateToISO(new Date());
      row.active = true;
      const [created] = await plantsStore.insert(row);
      householdPlants.push(created);
      showToast(`¡${created.name} ya vive en Umbral! 🌱`);
      notifyHousehold(`${currentUser} añadió una planta`, `${created.name} · ${PLANT_SPECIES[species].latin}`, { open: 'plantas', tag: 'plants' });
    }
    renderPlants();
    return true;
  } catch (error) {
    showSupabaseError('No se pudo guardar la planta', error);
    return false;
  }
}

async function addPlantLog(plant, entry) {
  const [created] = await plantLogStore.insert({ plant_id: plant.id, done_by: currentUser, ...entry });
  plantLog.unshift(created);
  return created;
}

async function waterPlant(id) {
  const plant = householdPlants.find((entry) => entry.id === id);
  if (!plant) return;
  const today = dateToISO(new Date());
  const changes = { last_watered_at: new Date().toISOString(), next_water_on: nextWaterFrom(plant, today), reminded_on: null };
  const previous = { ...plant };
  Object.assign(plant, changes);
  renderPlants();
  celebrate(id);
  try {
    await plantsStore.update(id, changes);
    await addPlantLog(plant, { kind: 'water' });
    showToast(`${plant.name} regada · próximo riego ${dueLabel(plant.next_water_on).toLowerCase()}`);
    notifyHousehold(`${currentUser} regó ${plant.name}`, `Ya no hace falta regarla. Próximo riego: ${dueLabel(plant.next_water_on).toLowerCase()}.`, { open: 'plantas', tag: 'plants' });
  } catch (error) {
    Object.assign(plant, previous);
    renderPlants();
    showSupabaseError('No se pudo guardar el riego', error);
  }
}

// «Todavía está húmeda»: pospone dos días sin contar como riego.
async function snoozePlant(id) {
  const plant = householdPlants.find((entry) => entry.id === id);
  if (!plant) return;
  const changes = { next_water_on: addDaysISO(dateToISO(new Date()), 2), reminded_on: null };
  try {
    await plantsStore.update(id, changes);
    Object.assign(plant, changes);
    await addPlantLog(plant, { kind: 'snooze' });
    renderPlants();
    showToast(`Vale, te recuerdo ${plant.name} pasado mañana`);
  } catch (error) {
    showSupabaseError('No se pudo posponer', error);
  }
}

async function deletePlant(id) {
  const plant = householdPlants.find((entry) => entry.id === id);
  if (!plant || !window.confirm(`¿Quitar ${plant.name} de tus plantas?`)) return;
  try {
    await plantsStore.update(id, { active: false });
    householdPlants = householdPlants.filter((entry) => entry.id !== id);
    closePlantSheet();
    renderPlants();
    showToast('Planta quitada');
  } catch (error) {
    showSupabaseError('No se pudo quitar la planta', error);
  }
}

// ---------- Pintar ----------

function celebrate(id) {
  document.querySelectorAll(`[data-plant-avatar="${CSS.escape(id)}"]`).forEach((avatar) => {
    avatar.classList.remove('is-watering');
    void avatar.getBoundingClientRect();
    avatar.classList.add('is-watering');
    setTimeout(() => avatar.classList.remove('is-watering'), 2200);
  });
}

function plantCard(plant) {
  const state = plantState(plant);
  const species = plantSpecies(plant);
  const due = state.daysLeft <= 0;
  return `<article class="plant-card is-${state.mood}" data-plant-open="${escapeHtml(plant.id)}" tabindex="0" role="button" aria-label="${escapeHtml(`${plant.name}: ${state.status}`)}">
    <div class="plant-avatar" data-plant-avatar="${escapeHtml(plant.id)}" data-species="${escapeHtml(plant.species)}" data-mood="${state.mood}">${plantAvatar(plant)}</div>
    <div class="plant-card-copy">
      <strong>${escapeHtml(plant.name)}</strong>
      <small>${escapeHtml(plant.location || species.label)}</small>
    </div>
    <div class="plant-water-level" aria-hidden="true"><span style="width:${Math.round(state.level * 100)}%"></span></div>
    <p class="plant-status">${escapeHtml(state.status)}</p>
    <button type="button" class="plant-water-button${due ? ' is-due' : ''}" data-plant-water="${escapeHtml(plant.id)}"><i data-lucide="droplets"></i>${due ? 'Regar ahora' : 'Regar'}</button>
  </article>`;
}

function renderPlants() {
  const grid = document.querySelector('#plantGrid');
  if (!grid) return;
  const states = householdPlants.map((plant) => ({ plant, state: plantState(plant) })).sort((first, second) => first.state.daysLeft - second.state.daysLeft);
  const due = states.filter(({ state }) => state.daysLeft <= 0);
  grid.innerHTML = householdPlants.length
    ? states.map(({ plant }) => plantCard(plant)).join('')
    : `<div class="plants-empty">
        <div class="plants-empty-art">${['monstera', 'strelitzia', 'pothos'].map((species) => `<div class="plant-avatar" data-species="${species}" data-mood="happy">${plantAvatar({ id: `empty-${species}`, species })}</div>`).join('')}</div>
        <strong>Tus plantas, con cara y nombre</strong>
        <span>Añádelas y Umbral os avisará cuando toque regarlas, según cada especie y la época del año.</span>
        <button type="button" class="primary-button" data-plant-add><i data-lucide="plus"></i> Añadir la primera</button>
        <button type="button" class="link-button" id="plantGuideEmpty" data-guide-open>O echa un vistazo a la guía</button>
      </div>`;

  const summary = document.querySelector('#plantsSummary');
  const names = due.map(({ plant }) => plant.name);
  summary.textContent = !householdPlants.length ? '' : names.length
    ? `${names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)} tienen` : `${names[0]} tiene`} sed. ${names.length > 1 ? 'Riégalas' : 'Riégala'} y márcalo aquí.`
    : `Todas bien regadas. La próxima es ${states[0].plant.name}, ${dueLabel(states[0].state.due).toLowerCase()}.`;
  summary.hidden = !householdPlants.length;

  setNavBadge('plantas', due.length);
  renderAttention({ thirstyPlants: names });
  updateDaySummary({ plants: due.length });
  window.umbralScene?.update({ plants: householdPlants.map((plant) => ({ id: plant.id, name: plant.name, species: plant.species, mood: plantState(plant).mood })) });
  if (openPlantId) renderPlantSheet();
  lucide.createIcons();
}

// ---------- Ficha de una planta ----------

const plantSheet = document.querySelector('#plantSheet');

function openPlantSheet(id) {
  openPlantId = id;
  renderPlantSheet();
  plantSheet.classList.add('visible');
  if (history.state?.page !== 'plant') history.pushState({ page: 'plant' }, '', '#planta');
}

function closePlantSheet() {
  if (!plantSheet.classList.contains('visible')) return;
  if (history.state?.page === 'plant') history.back();
  else hidePlantSheet();
}

function hidePlantSheet() {
  plantSheet.classList.remove('visible');
  openPlantId = null;
}

function logLabel(entry) {
  const when = timeAgo(entry.created_at);
  if (entry.kind === 'water') return `<i data-lucide="droplets"></i><span><strong>Regada</strong><small>${escapeHtml(entry.done_by || '')} · ${when}</small></span>`;
  return `<i data-lucide="clock-3"></i><span><strong>Aún húmeda, pospuesta</strong><small>${escapeHtml(entry.done_by || '')} · ${when}</small></span>`;
}

// ---------- Guía ----------

const GUIDE_TABS = [['care', 'leaf', 'Cuidados'], ['problems', 'stethoscope', 'Problemas'], ['water', 'droplets', 'Regar']];
const careItems = (items) => `<div class="care-list">${items.map(([icon, title, text]) => `<div class="care-item"><span><i data-lucide="${icon}"></i></span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div></div>`).join('')}</div>`;

function guideMarkup(key) {
  const species = PLANT_SPECIES[key] || PLANT_SPECIES.other;
  const problems = [...species.problems.map((problem) => [...problem, true]), ...PLANT_SYMPTOMS];
  const { summer, mid, winter } = species.water;
  return `<section class="plant-guide">
    <div class="segmented is-wide guide-tabs" role="group" aria-label="Apartado de la guía">${GUIDE_TABS.map(([tab, icon, label], index) => `<button type="button" data-guide-tab="${tab}" aria-pressed="${index === 0}"><i data-lucide="${icon}"></i>${label}</button>`).join('')}</div>
    <div class="guide-pane" data-guide-pane="care">
      <p class="guide-intro">${escapeHtml(species.intro)}</p>
      <div class="guide-calendar" aria-label="Riego orientativo">
        <div><i data-lucide="sun"></i><strong>${summer} días</strong><small>Verano</small></div>
        <div><i data-lucide="leaf"></i><strong>${mid} días</strong><small>Primavera y otoño</small></div>
        <div><i data-lucide="snowflake"></i><strong>${winter} días</strong><small>Invierno</small></div>
      </div>
      ${careItems(species.care)}
    </div>
    <div class="guide-pane" data-guide-pane="problems" hidden>
      <input type="search" class="guide-search" placeholder="Busca: amarillas, manchas, bichitos…" aria-label="Buscar un síntoma" />
      <div class="problem-list">${problems.map(([title, cause, fix, own]) => `<details class="problem-item" data-problem-text="${escapeHtml(normalizeText(`${title} ${cause} ${fix}`))}"><summary><span>${escapeHtml(title)}</span>${own ? `<em>${escapeHtml(species.label)}</em>` : ''}<i data-lucide="chevron-down"></i></summary><p><b>Por qué pasa.</b> ${escapeHtml(cause)}</p><p><b>Qué hacer.</b> ${escapeHtml(fix)}</p></details>`).join('')}</div>
      <p class="empty-note guide-empty" hidden>No hay nada con esa palabra. Prueba con otra.</p>
    </div>
    <div class="guide-pane" data-guide-pane="water" hidden>${careItems(WATERING_TIPS)}</div>
  </section>`;
}

// Guía sin planta concreta: se elige la especie arriba.
function openGuide(key = 'monstera') {
  openPlantId = null;
  const sheet = plantSheet.querySelector('.plant-sheet-body');
  sheet.innerHTML = `
    <div class="plant-add-heading"><p class="eyebrow muted">Guía de plantas</p><h2 id="plantSheetTitle">Cómo cuidarlas</h2></div>
    <div class="species-picker guide-picker" role="radiogroup" aria-label="Especie">${Object.entries(PLANT_SPECIES).map(([species, info]) => `<label class="species-option"><input type="radio" name="guideSpecies" value="${species}" ${species === key ? 'checked' : ''} /><span><span class="plant-avatar is-mini" data-species="${species}" data-mood="happy">${plantAvatar({ id: `guide-${species}`, species }, 'pick')}</span>${info.label}</span></label>`).join('')}</div>
    <div id="guideBody">${guideMarkup(key)}</div>`;
  plantSheet.classList.add('visible');
  if (history.state?.page !== 'plant') history.pushState({ page: 'plant' }, '', '#planta');
  lucide.createIcons();
}

function showGuideTab(button) {
  const guide = button.closest('.plant-guide');
  guide.querySelectorAll('[data-guide-tab]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
  guide.querySelectorAll('[data-guide-pane]').forEach((pane) => { pane.hidden = pane.dataset.guidePane !== button.dataset.guideTab; });
}

function filterProblems(input) {
  const query = normalizeText(input.value);
  const pane = input.closest('[data-guide-pane]');
  let visible = 0;
  pane.querySelectorAll('.problem-item').forEach((item) => {
    const match = !query || item.dataset.problemText.includes(query);
    item.hidden = !match;
    if (match) visible += 1;
    if (query && match && visible === 1) item.open = true;
  });
  pane.querySelector('.guide-empty').hidden = visible > 0;
}

function renderPlantSheet() {
  const plant = householdPlants.find((entry) => entry.id === openPlantId);
  if (!plant) return hidePlantSheet();
  const state = plantState(plant);
  const species = plantSpecies(plant);
  const season = seasonOf();
  const entries = plantLog.filter((entry) => entry.plant_id === plant.id).slice(0, 8);
  const sheet = plantSheet.querySelector('.plant-sheet-body');
  sheet.innerHTML = `
    <div class="plant-hero is-${state.mood}">
      <div class="plant-avatar is-large" data-plant-avatar="${escapeHtml(plant.id)}" data-species="${escapeHtml(plant.species)}" data-mood="${state.mood}">${plantAvatar(plant, 'sheet')}</div>
      <div class="plant-hero-copy">
        <p class="eyebrow muted">${escapeHtml(species.latin)}</p>
        <h2 id="plantSheetTitle">${escapeHtml(plant.name)}</h2>
        <span class="plant-mood-chip is-${state.mood}"><i data-lucide="${PLANT_MOODS[state.mood].icon}"></i>${PLANT_MOODS[state.mood].label}</span>
      </div>
    </div>
    <div class="plant-next">
      <div><span>Próximo riego</span><strong>${escapeHtml(state.daysLeft < 0 ? 'Cuanto antes' : capitalizeFirst(dueLabel(state.due)))}</strong><small>Cada ${state.interval} días ${plant.water_every_days ? '(lo elegiste tú)' : SEASON_LABELS[season]}</small></div>
      <div class="plant-next-actions">
        <button type="button" class="primary-button" data-plant-water="${escapeHtml(plant.id)}"><i data-lucide="droplets"></i> La he regado</button>
        ${state.daysLeft <= 1 ? `<button type="button" class="link-button" data-plant-snooze="${escapeHtml(plant.id)}">Aún está húmeda: recuérdamelo en 2 días</button>` : ''}
      </div>
      <p class="plant-check"><i data-lucide="hand"></i>${escapeHtml(species.check)}</p>
    </div>

    <section class="plant-section">
      <h3>Guía de ${escapeHtml(species.label.toLowerCase())}</h3>
      ${guideMarkup(plant.species)}
    </section>

    ${entries.length ? `<section class="plant-section"><h3>Historial</h3><div class="plant-history">${entries.map((entry) => `<div class="plant-history-item">${logLabel(entry)}</div>`).join('')}</div></section>` : ''}

    <details class="plant-section plant-settings"><summary><i data-lucide="settings-2"></i> Ajustes de la planta</summary>
      <form class="plant-form" data-plant-edit="${escapeHtml(plant.id)}">${plantFormFields(plant)}
        <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="check"></i> Guardar</button><button type="button" class="link-button is-danger" data-plant-delete="${escapeHtml(plant.id)}">Quitar planta</button></div>
      </form>
    </details>`;
  lucide.createIcons();
}

function plantFormFields(plant = {}) {
  const species = plant.species || 'monstera';
  const intervals = [0, 3, 5, 7, 10, 14, 21, 30];
  return `
    <div class="species-picker" role="radiogroup" aria-label="Especie">${Object.entries(PLANT_SPECIES).map(([key, info]) => `<label class="species-option"><input type="radio" name="species" value="${key}" ${key === species ? 'checked' : ''} /><span><span class="plant-avatar is-mini" data-species="${key}" data-mood="happy">${plantAvatar({ id: `pick-${key}`, species: key }, 'pick')}</span>${info.label}</span></label>`).join('')}</div>
    <label class="plant-field"><span>Nombre</span><input name="name" type="text" maxlength="40" value="${escapeHtml(plant.name || '')}" placeholder="${escapeHtml(PLANT_SPECIES[species].label)}" /></label>
    <label class="plant-field"><span>Dónde está</span><input name="location" type="text" maxlength="40" value="${escapeHtml(plant.location || '')}" placeholder="Salón, estantería…" /></label>
    <label class="plant-field"><span>Riego</span><select name="waterEvery">${intervals.map((days) => `<option value="${days || ''}" ${Number(plant.water_every_days || 0) === days ? 'selected' : ''}>${days ? `Cada ${days} días` : 'Automático según especie y época'}</option>`).join('')}</select></label>`;
}

// Añadir planta: mismo formulario más «¿cuándo la regaste?».
function openAddPlant() {
  openPlantId = null;
  const sheet = plantSheet.querySelector('.plant-sheet-body');
  sheet.innerHTML = `
    <div class="plant-add-heading"><p class="eyebrow muted">Nueva planta</p><h2 id="plantSheetTitle">¿Qué planta es?</h2></div>
    <form class="plant-form" data-plant-new>${plantFormFields()}
      <fieldset class="plant-field"><legend>¿Cuándo la regaste por última vez?</legend>
        <div class="choice-row">${[['0', 'Hoy'], ['3', 'Hace unos días'], ['7', 'Hace una semana'], ['unknown', 'No me acuerdo']].map(([value, label], index) => `<label class="option-toggle"><input type="radio" name="lastWatered" value="${value}" ${index === 0 ? 'checked' : ''} /><span>${label}</span></label>`).join('')}</div>
      </fieldset>
      <div class="plant-form-actions"><button type="submit" class="primary-button"><i data-lucide="sprout"></i> Añadir planta</button></div>
    </form>`;
  plantSheet.classList.add('visible');
  if (history.state?.page !== 'plant') history.pushState({ page: 'plant' }, '', '#planta');
  lucide.createIcons();
}

// ---------- Eventos ----------

document.querySelector('#plantsView').addEventListener('click', (event) => {
  const water = event.target.closest('[data-plant-water]');
  if (water) {
    event.stopPropagation();
    return waterPlant(water.dataset.plantWater);
  }
  if (event.target.closest('[data-plant-add], #addPlantButton')) return openAddPlant();
  if (event.target.closest('#plantGuideButton, [data-guide-open]')) return openGuide();
  const card = event.target.closest('[data-plant-open]');
  if (card) openPlantSheet(card.dataset.plantOpen);
});

document.querySelector('#plantsView').addEventListener('keydown', (event) => {
  const card = event.target.closest('[data-plant-open]');
  if (card && event.target === card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openPlantSheet(card.dataset.plantOpen);
  }
});

plantSheet.addEventListener('click', (event) => {
  if (event.target === plantSheet || event.target.closest('#closePlantSheet')) return closePlantSheet();
  const water = event.target.closest('[data-plant-water]');
  if (water) return waterPlant(water.dataset.plantWater);
  const snooze = event.target.closest('[data-plant-snooze]');
  if (snooze) return snoozePlant(snooze.dataset.plantSnooze);
  const remove = event.target.closest('[data-plant-delete]');
  if (remove) return deletePlant(remove.dataset.plantDelete);
  const guideTab = event.target.closest('[data-guide-tab]');
  if (guideTab) showGuideTab(guideTab);
});

plantSheet.addEventListener('change', (event) => {
  if (event.target.name === 'guideSpecies') {
    document.querySelector('#guideBody').innerHTML = guideMarkup(event.target.value);
    lucide.createIcons();
  }
  // Al elegir especie en una planta nueva, el nombre sugerido cambia con ella.
  if (event.target.name === 'species' && event.target.form) {
    const nameInput = event.target.form.name;
    nameInput.placeholder = PLANT_SPECIES[event.target.value].label;
  }
});

plantSheet.addEventListener('input', (event) => {
  if (event.target.matches('.guide-search')) filterProblems(event.target);
});

plantSheet.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const saved = await savePlant({ ...values, id: form.dataset.plantEdit });
  button.disabled = false;
  if (saved && form.hasAttribute('data-plant-new')) closePlantSheet();
});

window.addEventListener('popstate', () => {
  if (history.state?.page !== 'plant') hidePlantSheet();
});

document.addEventListener('umbral:ready', () => {
  loadPlants();
  const reload = () => {
    clearTimeout(plantsReloadTimer);
    plantsReloadTimer = setTimeout(loadPlants, 300);
  };
  plantsStore.subscribe(reload);
  plantLogStore.subscribe(reload);
  // Los estados dependen del día: se repintan cada hora por si la app queda abierta.
  setInterval(renderPlants, 60 * 60 * 1000);
});
