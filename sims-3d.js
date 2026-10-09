// La casa del modo Sims en 3D (estilo HD-2D): muebles 3D de verdad (Kenney Furniture Kit, CC0),
// paredes con altura que bajan solas cuando tapan, luz del sol según la hora, sombras, lámparas
// de noche y vuestros muñecos en pixel art de pie dentro de la escena.
// No cambia la lógica del juego: envuelve el mundo 2D (sims-world.js) y le sustituye el dibujo, la
// cámara y los toques en la casa. Los viajes (Turín, Chieti, España) siguen en 2D.
// El suelo y las paredes salen del mismo dibujo de la casa 2D (suelos, alfombras, la ola, las
// polaroids y vuestras fotos), así que lo personal se conserva.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PX = 30; // píxeles del mundo 2D por metro
const W2 = 512;
const WALL_H = 2.5;
const CUT_H = 0.3;
const MODELS = 'assets/sims/3d/';
// El dibujo 2D tiene una «franja de pared» de 56 px entre los cuartos de arriba y el salón: en 3D
// la pared mide 8 px, así que el salón sube 48 px. zpx pasa de y 2D a profundidad 3D y ypx al revés.
const zpx = (y) => (y <= 176 ? y : y < 232 ? 176 + ((y - 176) * 8) / 56 : y - 48);
const ypx = (z) => (z <= 176 ? z : z < 184 ? 176 + ((z - 176) * 56) / 8 : z + 48);
const D2 = zpx(384);
const toM = (x, y) => new THREE.Vector3(x / PX, 0, zpx(y) / PX);

// ---------- Qué mueble va en cada sitio ----------
// id: objeto de la casa (se coloca en su hueco, «block», que se mueve con el modo construcción).
// rect: hueco propio [x, y, ancho, fondo] en píxeles 2D. h: alto en metros. rot: giro en grados
// (0 = mirando a la cámara). y: altura sobre el suelo. tint: color por material.
const WOOD = '#c48f5e';
const SAGE = '#7f9a7a';
const FURNITURE = [
  { id: 'bed', model: 'bedDouble', h: 0.62, tint: { carpet: () => bedding(), wood: WOOD } },
  { id: 'nightstandL', model: 'cabinetBedDrawerTable', h: 0.55, tint: { wood: WOOD } },
  { id: 'nightstandL', model: 'lampRoundTable', h: 0.42, y: 0.55, shrink: 0.6, light: 'lamp' },
  { id: 'nightstandR', model: 'cabinetBedDrawerTable', h: 0.55, tint: { wood: WOOD } },
  { id: 'nightstandR', model: 'lampRoundTable', h: 0.42, y: 0.55, shrink: 0.6, light: 'lamp' },
  { id: 'wardrobe', model: 'bookcaseClosedDoors', h: 2.05, tint: { wood: '#e9dcc6' } },
  { id: 'basket', model: 'cardboardBoxOpen', h: 0.4 },
  { id: 'shower', model: 'bathtub', h: 0.58 },
  { id: 'sink', model: 'bathroomSink', h: 0.9 },
  { rect: [306, 56, 22, 4], model: 'bathroomMirror', h: 0.7, y: 1.15 },
  { id: 'toilet', model: 'toilet', h: 0.78, rot: -90 },
  { id: 'washer', model: 'washer', h: 0.88, rot: -90 },
  { id: 'fridge', model: 'kitchenFridgeLarge', h: 1.9 },
  { rect: [369, 56, 22, 20], model: 'kitchenCabinet', h: 0.92, tint: { wood: SAGE, woodDark: '#6c8668' } },
  { rect: [391, 56, 26, 20], model: 'kitchenStove', h: 0.92, tint: { wood: SAGE } },
  { rect: [417, 56, 15, 20], model: 'kitchenCabinetDrawer', h: 0.92, tint: { wood: SAGE, woodDark: '#6c8668' } },
  { rect: [432, 56, 28, 20], model: 'kitchenSink', h: 0.92, tint: { wood: SAGE } },
  { rect: [460, 56, 12, 20], model: 'kitchenCabinet', h: 0.92, tint: { wood: SAGE, woodDark: '#6c8668' } },
  { rect: [369, 56, 22, 10], model: 'kitchenCabinetUpper', h: 0.62, y: 1.5, tint: { wood: SAGE, woodDark: '#6c8668' } },
  { rect: [393, 56, 22, 10], model: 'hoodModern', h: 0.5, y: 1.55, light: 'hood' },
  { rect: [417, 56, 55, 10], model: 'kitchenCabinetUpperDouble', h: 0.62, y: 1.5, tint: { wood: SAGE, woodDark: '#6c8668' } },
  { rect: [400, 56, 12, 10], model: 'kitchenCoffeeMachine', h: 0.3, y: 0.92 },
  { id: 'winerack', model: 'bookcaseOpenLow', h: 1.0, tint: { wood: WOOD } },
  { id: 'table', model: 'tableCloth', h: 0.76, tint: { carpet: '#d9584a', wood: WOOD } },
  { id: 'chairL', model: 'chair', h: 0.9, rot: 90, tint: { wood: WOOD } },
  { id: 'chairR', model: 'chair', h: 0.9, rot: -90, tint: { wood: WOOD } },
  { id: 'lamp', model: 'lampSquareFloor', h: 1.7, light: 'floor' },
  { id: 'sofa', model: 'loungeSofa', h: 0.86, tint: { carpet: () => sofa(), wood: '#8a6a4e' } },
  { id: 'radio', model: 'sideTableDrawers', h: 0.6, tint: { wood: WOOD } },
  { id: 'radio', model: 'radio', h: 0.25, y: 0.6, shrink: 0.55 },
  { id: 'bookshelf', model: 'bookcaseOpen', h: 1.95, tint: { wood: WOOD } },
  { id: 'bookshelf', model: 'books', h: 0.24, y: 1.02, shrink: 0.5 },
  { id: 'bookshelf', model: 'books', h: 0.24, y: 0.45, shrink: 0.45 },
  { id: 'coffee', model: 'tableCoffee', h: 0.42, tint: { wood: WOOD } },
  { id: 'tv', model: 'cabinetTelevision', h: 0.5, rot: 180, tint: { wood: '#6e4d36' } },
  { id: 'tv', model: 'televisionModern', h: 0.62, y: 0.5, rot: 180, shrink: 0.82, screen: true },
  { rect: [246, 324, 22, 16], model: 'chairDesk', h: 0.95 },
  { id: 'desk', model: 'desk', h: 0.76, rot: 180, tint: { wood: WOOD } },
  { id: 'desk', model: 'laptop', h: 0.2, y: 0.76, rot: 180, shrink: 0.35 },
  { id: 'desk', model: 'lampSquareTable', h: 0.4, y: 0.76, shrink: 0.18, offset: [-0.32, 0], light: 'desk' },
  { id: 'coatrack', model: 'coatRackStanding', h: 1.8, tint: { wood: WOOD } },
  { id: 'shoes', model: 'benchCushionLow', h: 0.45, tint: { carpet: '#a9b59a', wood: WOOD } },
  { id: 'armchair', model: 'loungeChair', h: 0.92, rot: -90, tint: { carpet: '#c39a3c', wood: '#8a6a4e' } },
  { id: 'sidetable', model: 'sideTable', h: 0.55, tint: { wood: WOOD } },
  { id: 'sidetable', model: 'lampRoundTable', h: 0.42, y: 0.55, shrink: 0.7, light: 'lamp' },
  { id: 'olivetree', model: 'pottedPlant', h: 1.5, tint: { plant: '#7c8f4c', wood: '#b5714a' } },
  // Muebles de la tienda (solo si los habéis comprado).
  { id: 'beanbag', custom: 'beanbag', h: 0.6 },
  { id: 'aquarium', custom: 'aquarium', h: 1.25 },
  { id: 'arcade', custom: 'arcade', h: 1.75 },
  { id: 'guitar', custom: 'guitar', h: 1.05 },
  { id: 'easel', custom: 'easel', h: 1.6 },
  { id: 'telescope', custom: 'telescope', h: 1.35 }
];
let houseApi = null;
const sofa = () => houseApi.decorOf('sofa');
const bedding = () => houseApi.decorOf('bedding')[0];

// ---------- Piezas hechas a mano (lo que no está en el kit) ----------
function customMesh(kind) {
  const g = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  if (kind === 'beanbag') {
    const bag = add(new THREE.SphereGeometry(0.5, 24, 16), mat('#3f8a8a', { roughness: 0.95 }), 0, 0.32, 0);
    bag.scale.set(1, 0.62, 0.9);
  } else if (kind === 'aquarium') {
    add(new THREE.BoxGeometry(1, 0.55, 0.5), mat('#6e4d36'), 0, 0.27, 0);
    add(new THREE.BoxGeometry(1, 0.55, 0.5), mat('#bfe6f4', { transparent: true, opacity: 0.35, roughness: 0.1 }), 0, 0.83, 0);
    add(new THREE.BoxGeometry(0.96, 0.42, 0.46), mat('#2a78b8', { transparent: true, opacity: 0.55, emissive: '#1b4f7a', emissiveIntensity: 0.4 }), 0, 0.8, 0);
    ['#f08a3a', '#f2c230', '#e05a7a'].forEach((color, i) => add(new THREE.SphereGeometry(0.035, 8, 6), mat(color, { emissive: color, emissiveIntensity: 0.3 }), -0.3 + i * 0.25, 0.75 + (i % 2) * 0.08, 0.05));
  } else if (kind === 'arcade') {
    add(new THREE.BoxGeometry(0.62, 1.7, 0.6), mat('#3a2a6a'), 0, 0.85, 0);
    add(new THREE.BoxGeometry(0.5, 0.36, 0.02), mat('#111', { emissive: '#3fd4ff', emissiveIntensity: 1.2 }), 0, 1.2, 0.31);
    add(new THREE.BoxGeometry(0.56, 0.08, 0.2), mat('#e05a7a'), 0, 0.9, 0.36);
  } else if (kind === 'guitar') {
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), mat('#5a3a24'), 0, 0.42, -0.08);
    const body = add(new THREE.SphereGeometry(0.2, 18, 12), mat('#c98a3a', { roughness: 0.4 }), 0, 0.5, 0);
    body.scale.set(1, 1.25, 0.32);
    add(new THREE.BoxGeometry(0.06, 0.5, 0.04), mat('#3b2616'), 0, 0.85, 0.02);
  } else if (kind === 'easel') {
    [-0.22, 0.22].forEach((x) => add(new THREE.BoxGeometry(0.04, 1.6, 0.04), mat('#8a6a4e'), x, 0.8, 0));
    add(new THREE.BoxGeometry(0.62, 0.48, 0.03), mat('#fbf6e8'), 0, 1.1, 0.04);
    add(new THREE.BoxGeometry(0.4, 0.22, 0.01), mat('#7aa6d6'), -0.05, 1.12, 0.06);
  } else if (kind === 'telescope') {
    [-0.25, 0, 0.25].forEach((x, i) => { const leg = add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), mat('#6b7a82'), x, 0.52, i === 1 ? -0.2 : 0.1); leg.rotation.z = -x * 0.6; });
    const tube = add(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 16), mat('#e9edf0', { roughness: 0.3 }), 0, 1.15, 0);
    tube.rotation.x = 1.0;
  }
  return g;
}
// Espejo de gota del salón: marco blanco y cristal que refleja la luz.
function mirrorMesh() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.absarc(0, 0.75, 0.38, Math.PI, 0, true);
  shape.lineTo(0.38, 0.75);
  shape.quadraticCurveTo(0.38, 1.7, 0, 2.05);
  shape.quadraticCurveTo(-0.38, 1.7, -0.38, 0.75);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.5 }));
  frame.castShadow = true;
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#dceef4', roughness: 0.15, emissive: '#5d7a86', emissiveIntensity: 0.25 }));
  glass.scale.set(0.86, 0.9, 1);
  glass.position.set(0, 0.1, 0.065);
  g.add(frame, glass);
  g.position.y = 0.38;
  return g;
}

// ---------- Texturas: suelo y paredes a partir del dibujo 2D ----------
function floorCanvas(art) {
  const canvas = document.createElement('canvas');
  canvas.width = W2;
  canvas.height = D2;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#4d3f39';
  c.fillRect(0, 0, W2, D2);
  c.drawImage(art, 0, 56, W2, 120, 0, 56, W2, 120);
  c.drawImage(art, 0, 232, W2, 152, 0, 184, W2, 152);
  return canvas;
}
// Pared: abajo la «cara» de la pared del dibujo 2D (cuadros, zócalo, interruptores); arriba, el
// mismo color de pared hasta el techo.
function wallCanvas(art, x0, x1, y0, y1) {
  const h = Math.round(WALL_H * PX);
  const canvas = document.createElement('canvas');
  canvas.width = x1 - x0;
  canvas.height = h;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  const face = y1 - (y0 + 6);
  const sample = art.getContext('2d').getImageData(Math.min(x0 + 4, W2 - 1), y0 + 10, 1, 1).data;
  c.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
  c.fillRect(0, 0, canvas.width, h);
  // Moldura bajo el techo.
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.fillRect(0, 4, canvas.width, 2);
  c.drawImage(art, x0, y0 + 6, x1 - x0, face, 0, h - face, x1 - x0, face);
  return canvas;
}
const pixelTexture = (canvas) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
};

// ---------- El mundo 3D ----------
export async function attach(container, base) {
  if (!houseApi) houseApi = window.simsWorld.house;
  const api = houseApi;
  const state = base.state;
  const canvas = document.createElement('canvas');
  canvas.className = 'sims-canvas sims-canvas-3d';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Vuestro piso en 3D, con vuestros muñecos');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Las sombras (de muebles y paredes, que están quietos) se recalculan solo cuando se mueve el sol
  // o cambia algo de sitio, no en cada fotograma.
  renderer.shadowMap.autoUpdate = false;
  const refreshShadows = () => { renderer.shadowMap.needsUpdate = true; };
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c1515');

  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.5, 120);
  const PITCH = THREE.MathUtils.degToRad(52);
  const hemi = new THREE.HemisphereLight('#fff6e8', '#7a6250', 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const house = new THREE.Group();
  const furniture = new THREE.Group();
  const actorsGroup = new THREE.Group();
  const fx = new THREE.Group();
  scene.add(house, furniture, actorsGroup, fx);

  // ----- Suelo y paredes -----
  let floorMesh = null;
  const walls = [];
  const windows = [];
  // Al rehacer la casa (decoración nueva, fotos) se sueltan las texturas y piezas de antes.
  const disposeTree = (group) => group.traverse((node) => {
    node.geometry?.dispose();
    [].concat(node.material || []).forEach((material) => { material.map?.dispose(); material.dispose(); });
  });
  function buildShell() {
    disposeTree(house);
    house.clear();
    walls.length = 0;
    windows.length = 0;
    const art = api.art(state.photosRaw || []);
    const floorTex = pixelTexture(floorCanvas(art));
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W2 / PX, D2 / PX), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(W2 / PX / 2, 0, D2 / PX / 2);
    floorMesh.receiveShadow = true;
    floorMesh.userData.floor = true;
    house.add(floorMesh);
    const capMat = new THREE.MeshStandardMaterial({ color: '#5d4c45', roughness: 0.9 });
    const wall = (x0, x1, zFront, art2d, opts = {}) => {
      const width = (x1 - x0) / PX;
      const tex = art2d ? pixelTexture(wallCanvas(art, x0, x1, art2d[0], art2d[1])) : null;
      const faceMat = tex ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }) : capMat;
      const geo = new THREE.BoxGeometry(width, WALL_H, 8 / PX);
      geo.translate(0, WALL_H / 2, 0);
      const mesh = new THREE.Mesh(geo, [capMat, capMat, capMat, capMat, faceMat, capMat]);
      mesh.position.set((x0 + x1) / 2 / PX, 0, (zFront - 4) / PX);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.wall = { x0, x1, zFront, face: art2d, cut: opts.cut !== false, level: 1 };
      house.add(mesh);
      walls.push(mesh);
    };
    // Paredes del fondo de los cuartos de arriba (con su dibujo) y del salón (con sus puertas).
    wall(8, 216, 56, [8, 56]);
    wall(224, 336, 56, [8, 56]);
    wall(344, 504, 56, [8, 56]);
    const doors = [...api.DOORS].sort((a, b) => a[0] - b[0]);
    let x = 8;
    doors.forEach(([dx, dw]) => { if (dx > x) wall(x, dx, 184, [184, 232]); x = dx + dw; });
    if (x < 504) wall(x, 504, 184, [184, 232]);
    // Tabiques y paredes de los lados (vistos de canto).
    const side = (x0, x1, z0, z1) => {
      const geo = new THREE.BoxGeometry((x1 - x0) / PX, WALL_H, (z1 - z0) / PX);
      geo.translate(0, WALL_H / 2, 0);
      const mesh = new THREE.Mesh(geo, capMat);
      mesh.position.set((x0 + x1) / 2 / PX, 0, (z0 + z1) / 2 / PX);
      mesh.castShadow = x0 > 8 && x1 < 504;
      mesh.receiveShadow = true;
      house.add(mesh);
    };
    side(216, 224, 48, 176);
    side(336, 344, 48, 176);
    side(0, 8, 48, D2);
    side(504, 512, 48, D2);
    // Ventanas: el cielo de Turín según la hora.
    api.WINDOWS.forEach(([wx, wy, ww, wh]) => {
      const top = wy < 120;
      const y1 = top ? 56 : 232;
      const sky = document.createElement('canvas');
      sky.width = 8;
      sky.height = 32;
      const tex = new THREE.CanvasTexture(sky);
      tex.colorSpace = THREE.SRGBColorSpace;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww / PX, wh / PX), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      const frame = new THREE.Mesh(new THREE.BoxGeometry((ww + 6) / PX, (wh + 6) / PX, 0.04), new THREE.MeshStandardMaterial({ color: '#f5f1e8' }));
      // Encima de la ventana dibujada en la pared (su borde de abajo está a esa altura).
      const elev = (y1 - (wy + wh)) / PX;
      const cx = (wx + ww / 2) / PX;
      const cz = zpx(y1) / PX + 0.012;
      frame.position.set(cx, elev + wh / PX / 2, cz);
      pane.position.set(cx, elev + wh / PX / 2, cz + 0.022);
      house.add(frame, pane);
      windows.push({ sky, tex, pane, frame, top, wallZ: zpx(y1) });
    });
    paintWindows(true);
    refreshShadows();
  }
  let windowsAt = 0;
  function paintWindows(force) {
    if (!force && performance.now() - windowsAt < 20000) return;
    windowsAt = performance.now();
    const ph = state.phase || window.simsWorld.dayPhase();
    windows.forEach(({ sky, tex }) => {
      const c = sky.getContext('2d');
      const grad = c.createLinearGradient(0, 0, 0, 32);
      grad.addColorStop(0, ph.top);
      grad.addColorStop(1, ph.bottom);
      c.fillStyle = grad;
      c.fillRect(0, 0, 8, 32);
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.fillRect(3, 0, 1, 32);
      tex.needsUpdate = true;
    });
  }

  // ----- Muebles -----
  const loader = new GLTFLoader();
  const modelCache = new Map();
  const loadModel = (name) => {
    if (!modelCache.has(name)) modelCache.set(name, loader.loadAsync(`${MODELS}${name}.glb`).then((gltf) => gltf.scene));
    return modelCache.get(name);
  };
  const lamps = [];
  let tvScreen = null;
  const objectMeshes = new Map();
  async function buildFurniture() {
    const objects = new Map(api.objects().map((object) => [object.id, object]));
    const specs = FURNITURE.filter((spec) => !spec.id || (objects.get(spec.id)?.block && (!objects.get(spec.id).shop || api.owns(spec.id))));
    const built = await Promise.all(specs.map(async (spec) => {
      const object = spec.id ? objects.get(spec.id) : null;
      let rect = spec.rect || object.block;
      if (spec.shrink) { const s = spec.shrink; rect = [rect[0] + (rect[2] * (1 - s)) / 2 + (spec.offset?.[0] || 0) * PX, rect[1] + (rect[3] * (1 - s)) / 2 + (spec.offset?.[1] || 0) * PX, rect[2] * s, rect[3] * s]; }
      let node;
      if (spec.custom) node = customMesh(spec.custom);
      else {
        const source = await loadModel(spec.model).catch(() => null);
        if (!source) return null;
        node = source.clone(true);
        node.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = child.material.clone();
          // Sin mapa de reflejos (sería lento en el móvil), el metal puro se vería negro.
          child.material.metalness = Math.min(child.material.metalness ?? 0, 0.25);
          const tint = spec.tint?.[child.material.name];
          if (tint) child.material.color.set(typeof tint === 'function' ? tint() : tint);
          if (spec.screen && child.material.name === 'metalDark') { child.material.emissive = new THREE.Color('#000'); tvScreen = child.material; }
          if (spec.light && child.material.name === 'lamp') { child.material.emissive = new THREE.Color('#ffd28a'); child.material.emissiveIntensity = 0; lamps.push({ material: child.material }); }
        });
      }
      // Encaja en su hueco: ancho y fondo del rectángulo 2D, alto realista.
      const holder = new THREE.Group();
      holder.add(node);
      node.rotation.y = THREE.MathUtils.degToRad(spec.rot || 0);
      node.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(node);
      const size = box.getSize(new THREE.Vector3());
      const w = rect[2] / PX;
      const d = (zpx(rect[1] + rect[3]) - zpx(rect[1])) / PX;
      node.scale.set(w / Math.max(size.x, 0.01), spec.h / Math.max(size.y, 0.01), d / Math.max(size.z, 0.01));
      node.updateMatrixWorld(true);
      const fitted = new THREE.Box3().setFromObject(node);
      node.position.sub(new THREE.Vector3((fitted.min.x + fitted.max.x) / 2, fitted.min.y, (fitted.min.z + fitted.max.z) / 2));
      holder.position.set((rect[0] + rect[2] / 2) / PX, spec.y || 0, (zpx(rect[1]) + zpx(rect[1] + rect[3])) / 2 / PX);
      if (object) holder.userData.objectId = object.id;
      if ((spec.y || 0) + spec.h > 1.2) holder.userData.tall = true;
      if (spec.light) {
        const light = new THREE.PointLight('#ffc98a', 0, spec.light === 'floor' ? 7 : 4.5, 1.4);
        light.position.set(0, spec.h + 0.15, 0);
        holder.add(light);
        lamps.push({ light, kind: spec.light });
      }
      return holder;
    }));
    furniture.clear();
    objectMeshes.clear();
    lamps.splice(0, lamps.length, ...lamps.filter((lamp) => built.some((holder) => holder && (holder === lamp.light?.parent || holder.getObjectById(lamp.material?.id)))));
    refreshShadows();
    built.filter(Boolean).forEach((holder) => {
      furniture.add(holder);
      if (holder.userData.objectId) {
        const list = objectMeshes.get(holder.userData.objectId) || [];
        list.push(holder);
        objectMeshes.set(holder.userData.objectId, list);
      }
    });
    // El espejo de gota del salón.
    const mirror = objects.get('mirror');
    if (mirror?.block) {
      const m = mirrorMesh();
      m.position.set((mirror.block[0] + mirror.block[2] / 2) / PX, 0, zpx(mirror.block[1] + 4) / PX);
      m.scale.setScalar(0.85);
      m.userData.objectId = 'mirror';
      m.userData.tall = true;
      furniture.add(m);
      objectMeshes.set('mirror', [m]);
    }
    // Plantas (las de verdad de la app, en sus macetas).
    api.objects().filter((object) => /^plant\d$/.test(object.id) && object.block).forEach(async (object, i) => {
      const big = object.block[2] > 18;
      const source = await loadModel(big ? 'pottedPlant' : ['plantSmall1', 'plantSmall2', 'plantSmall3'][i % 3]).catch(() => null);
      if (!source) return;
      const node = source.clone(true);
      node.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.material = child.material.clone(); if (child.material.name === 'plant') child.material.color.set(big ? '#3f8a52' : '#5aa05e'); } });
      const holder = new THREE.Group();
      holder.add(node);
      const box = new THREE.Box3().setFromObject(node);
      const size = box.getSize(new THREE.Vector3());
      const h = big ? 1.45 : 0.55;
      node.scale.setScalar(h / size.y);
      node.updateMatrixWorld(true);
      const fitted = new THREE.Box3().setFromObject(node);
      node.position.sub(new THREE.Vector3((fitted.min.x + fitted.max.x) / 2, fitted.min.y, (fitted.min.z + fitted.max.z) / 2));
      holder.position.set((object.block[0] + object.block[2] / 2) / PX, 0, zpx(object.block[1] + object.block[3] / 2) / PX);
      holder.userData.objectId = object.id;
      holder.userData.tall = big;
      furniture.add(holder);
      objectMeshes.set(object.id, [holder]);
      refreshShadows();
    });
  }

  // ----- Muñecos (pixel art de pie en la escena) -----
  const SPRITE_W = 96;
  const SPRITE_H = 124;
  const FEET = 106;
  const ALPHA = THREE.MathUtils.degToRad(30);
  const actorViews = new Map();
  const blobTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(0,0,0,.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  function actorView(a) {
    let view = actorViews.get(a);
    if (view) return view;
    const c = document.createElement('canvas');
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    const geo = new THREE.PlaneGeometry(SPRITE_W / PX, SPRITE_H / PX);
    geo.translate(0, SPRITE_H / PX / 2 - (SPRITE_H - FEET) / PX, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false }));
    mesh.userData.actor = a;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.38), new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    actorsGroup.add(mesh, blob);
    view = { c, tex, mesh, blob };
    actorViews.set(a, view);
    return view;
  }
  const toCam = new THREE.Vector3();
  function drawActors(t, light) {
    const seen = new Set();
    (state.actors || []).forEach((a) => {
      const view = actorView(a);
      seen.add(a);
      view.mesh.visible = !a.hidden;
      view.blob.visible = !a.hidden && a.shadow !== false;
      if (a.hidden) return;
      const g = view.c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, SPRITE_W, SPRITE_H);
      g.imageSmoothingEnabled = false;
      g.setTransform(1, 0, 0, 1, SPRITE_W / 2 - a.x, FEET - a.y);
      const shadow = a.shadow;
      a.shadow = false;
      window.simsWorld.drawActor(g, a, t);
      a.shadow = shadow;
      window.simsWorld.drawMoodFx(g, a, t);
      window.simsWorld.drawPlumbob(g, a, t);
      if (a.mood) { g.font = '9px system-ui, "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText(a.mood, a.x + 13, a.headY - 2); }
      view.tex.needsUpdate = true;
      // De pie en su sitio, algo inclinado hacia la cámara y adelantado para no cortarse con lo de detrás.
      const feet = toM(a.x, a.y);
      toCam.copy(camera.position).sub(feet).normalize();
      const pushed = feet.clone().addScaledVector(toCam, 0.8);
      const k = camera.position.distanceTo(pushed) / camera.position.distanceTo(feet);
      view.mesh.position.copy(pushed);
      view.mesh.rotation.set(-ALPHA, 0, 0);
      view.mesh.scale.set(k, k / Math.cos(PITCH - ALPHA), 1);
      view.mesh.material.color.copy(light);
      view.blob.position.set(feet.x, 0.012, feet.z);
    });
    actorViews.forEach((view, a) => {
      if (seen.has(a)) return;
      actorsGroup.remove(view.mesh, view.blob);
      view.tex.dispose();
      actorViews.delete(a);
    });
  }

  // ----- Partículas, cosas de los sucesos, marcas y modo construcción -----
  const PARTICLE_COLORS = { heart: '#ef476f', note: '#7a62b3', z: '#f4f9ff', spark: '#ffd166', drop: '#7cc4e6', puff: '#ffffff', feather: '#ffffff', bolt: '#ffd166', sparkle: '#fff6c8' };
  // Un único búfer fijo (crear uno por fotograma dejaría memoria colgada en la tarjeta gráfica).
  const MAX_PARTICLES = 400;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const particleCol = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(THREE.DynamicDrawUsage);
  particleGeo.setAttribute('position', particlePos);
  particleGeo.setAttribute('color', particleCol);
  const particleMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  fx.add(particles);
  const particleBase = new WeakMap();
  const particleColor = new THREE.Color();
  function stepParticles(dt) {
    state.particles = (state.particles || []).filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      return p.life > 0;
    });
    const list = state.particles.slice(-MAX_PARTICLES);
    list.forEach((p, i) => {
      if (!particleBase.has(p)) particleBase.set(p, p.y);
      const base = particleBase.get(p);
      // La subida en pantalla (y que baja) es altura en 3D; la profundidad es la del origen.
      particlePos.setXYZ(i, p.x / PX, 1.1 + (base - p.y) / PX, zpx(base + 30) / PX);
      particleColor.set(p.color || PARTICLE_COLORS[p.type] || '#ffffff');
      particleCol.setXYZ(i, particleColor.r, particleColor.g, particleColor.b);
    });
    particleGeo.setDrawRange(0, list.length);
    particlePos.needsUpdate = true;
    particleCol.needsUpdate = true;
  }
  const propViews = new Map();
  function drawProps(t) {
    const live = new Set();
    (state.eventProps || []).forEach((p, i) => {
      const key = `${p.kind}-${i}`;
      live.add(key);
      let view = propViews.get(key);
      if (!view) {
        const c = document.createElement('canvas');
        c.width = 40;
        c.height = 32;
        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const geo = new THREE.PlaneGeometry(40 / PX, 32 / PX);
        geo.translate(0, 32 / PX / 2 - 6 / PX, 0);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, toneMapped: false }));
        fx.add(mesh);
        view = { c, tex, mesh };
        propViews.set(key, view);
      }
      const g = view.c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, 40, 32);
      g.imageSmoothingEnabled = false;
      g.setTransform(1, 0, 0, 1, 20 - p.x, 26 - p.y);
      api.drawEventProp(g, p, t);
      view.tex.needsUpdate = true;
      const at = toM(p.x, p.y);
      view.mesh.position.copy(at).add(new THREE.Vector3(0, 0, 0.3));
      view.mesh.rotation.x = p.kind === 'puddle' ? -Math.PI / 2 : -ALPHA;
    });
    propViews.forEach((view, key) => {
      if (live.has(key)) return;
      fx.remove(view.mesh);
      view.tex.dispose();
      propViews.delete(key);
    });
  }
  // Cojines (guerra de almohadas) y pelotas que vuelan; al llegar, el cojín suelta plumas.
  const flying = new Map();
  const pillowGeo = new THREE.BoxGeometry(0.34, 0.12, 0.24);
  const ballGeo = new THREE.SphereGeometry(0.07, 12, 8);
  const pillowMat = new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.9 });
  const ballMat = new THREE.MeshStandardMaterial({ color: '#e8e04a', roughness: 0.5 });
  function drawProjectiles(t) {
    state.projectiles = (state.projectiles || []).filter((p) => {
      const k = (t - p.t0) / p.dur;
      if (k >= 1) {
        if (p.kind !== 'ball') for (let i = 0; i < 8; i += 1) state.particles.push({ type: 'feather', x: p.x1 + (Math.random() - 0.5) * 8, y: p.y1 + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 20, life: 1 + Math.random() });
        return false;
      }
      let mesh = flying.get(p);
      if (!mesh) {
        mesh = new THREE.Mesh(p.kind === 'ball' ? ballGeo : pillowGeo, p.kind === 'ball' ? ballMat : pillowMat);
        fx.add(mesh);
        flying.set(p, mesh);
      }
      const x = p.x0 + (p.x1 - p.x0) * k;
      const y = p.y0 + (p.y1 - p.y0) * k;
      mesh.position.set(x / PX, 1.0 + Math.sin(k * Math.PI) * 0.7, zpx(y + 30) / PX);
      mesh.rotation.set(k * 6, k * 9, 0);
      return true;
    });
    flying.forEach((mesh, p) => { if (!state.projectiles.includes(p)) { fx.remove(mesh); flying.delete(p); } });
  }
  const outlineMat = new THREE.LineBasicMaterial({ color: '#ffe27a', transparent: true, depthTest: false });
  const outlines = new THREE.Group();
  fx.add(outlines);
  let outlineKey = '';
  function drawOutlines(t) {
    const rects = [...(state.buildMode || []), ...(state.selected ? [state.selected] : [])];
    const key = JSON.stringify(rects);
    if (key !== outlineKey) {
      outlineKey = key;
      outlines.clear();
      rects.forEach(([x, y, w, h], i) => {
        const z0 = zpx(Math.max(y, 56)) / PX;
        const z1 = zpx(Math.max(y + h, 60)) / PX;
        const pts = [[x, z0], [x + w, z0], [x + w, z1], [x, z1], [x, z0]].map(([px, z]) => new THREE.Vector3(px / PX, 0.03, z));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), outlineMat.clone());
        line.renderOrder = 10;
        line.userData.selected = state.selected && i === rects.length - 1;
        outlines.add(line);
      });
    }
    outlines.children.forEach((line) => { line.material.opacity = line.userData.selected ? 1 : 0.55 + Math.sin(t / 220) * 0.25; });
  }
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 24), new THREE.MeshBasicMaterial({ color: '#3fd46a', transparent: true, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  fx.add(marker);
  function drawMarker(t) {
    const m = state.marker;
    const age = m ? (t - m.t0) / 900 : 2;
    marker.visible = age < 1;
    if (!marker.visible) { if (m && age >= 1) state.marker = null; return; }
    marker.position.copy(toM(m.x, m.y)).setY(0.02);
    marker.scale.setScalar(1 + age * 1.6);
    marker.material.opacity = 1 - age;
    marker.material.color.set(m.bad ? '#e0503e' : '#3fd46a');
  }

  // ----- Cámara: sigue a tu muñeco, con zoom y arrastre -----
  const target = new THREE.Vector3(W2 / PX / 2, 0, D2 / PX / 2 + 0.4);
  const center = target.clone();
  let pan = null;
  let size = { w: 0, h: 0 };
  function zoomLevel() {
    const z = typeof state.zoom === 'number' ? state.zoom : state.zoom ? 2 : 1;
    return Math.max(1, Math.min(3, z));
  }
  function fitDistance() {
    const aspect = size.w / Math.max(1, size.h);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const byWidth = (W2 / PX / 2 + 0.6) / Math.tan(hFov / 2);
    const byDepth = ((D2 / PX) * Math.sin(PITCH) / 2 + 1.2) / Math.tan(vFov / 2);
    return Math.max(byWidth, byDepth);
  }
  function updateCamera() {
    const zoom = zoomLevel();
    const want = new THREE.Vector3();
    if (pan) want.copy(pan);
    else if (zoom > 1.05 && state.follow) want.copy(toM(state.follow.x, state.follow.y)).add(new THREE.Vector3(0, 0, -0.3));
    else want.copy(center);
    const distance = fitDistance() / zoom;
    // Con zoom, el encuadre no se sale de la casa (ni negro delante ni a los lados).
    if (zoom > 1.05) {
      const half = THREE.MathUtils.degToRad(camera.fov) / 2;
      const height = distance * Math.sin(PITCH);
      const back = distance * Math.cos(PITCH);
      const nearEdge = back - height / Math.tan(PITCH + half);
      const farEdge = back - height / Math.tan(PITCH - half);
      want.z = Math.min(want.z, D2 / PX + 0.2 - nearEdge);
      want.z = Math.max(want.z, Math.min(D2 / PX + 0.2 - nearEdge, 0.6 - farEdge));
      const halfW = Math.tan(half) * camera.aspect * distance;
      want.x = halfW * 2 >= W2 / PX ? W2 / PX / 2 : Math.max(halfW - 0.1, Math.min(W2 / PX - halfW + 0.1, want.x));
    }
    target.lerp(want, pan ? 0.5 : 0.1);
    camera.position.set(target.x, target.y + distance * Math.sin(PITCH), target.z + distance * Math.cos(PITCH));
    camera.lookAt(target);
    state.cam.z = zoom;
  }
  // Paredes que tapan (las que quedan entre la cámara y lo que miras) bajan, como en los Sims.
  function updateWalls() {
    walls.forEach((mesh) => {
      const info = mesh.userData.wall;
      const want = info.cut && info.zFront / PX > target.z - 0.4 ? CUT_H / WALL_H : 1;
      if (Math.abs(want - info.level) < 0.002) return;
      info.level += (want - info.level) * 0.18;
      refreshShadows();
      mesh.scale.y = info.level;
    });
    // Los muebles altos que quedan delante de lo que miras se vuelven transparentes.
    const close = zoomLevel() > 1.25;
    furniture.children.forEach((holder) => {
      if (!holder.userData.tall) return;
      const want = close && holder.position.z > target.z + 1.1 ? 0.22 : 1;
      const now = holder.userData.fade ?? 1;
      if (Math.abs(want - now) < 0.01) return;
      const next = now + (want - now) * 0.2;
      holder.userData.fade = Math.abs(want - next) < 0.01 ? want : next;
      holder.traverse((child) => {
        if (!child.isMesh) return;
        child.material.transparent = holder.userData.fade < 1;
        child.material.opacity = holder.userData.fade;
        child.material.depthWrite = holder.userData.fade >= 1;
        child.castShadow = holder.userData.fade > 0.5;
      });
    });
    windows.forEach((win) => {
      const wall = walls.find((mesh) => mesh.userData.wall.zFront === win.wallZ && mesh.userData.wall.cut);
      const visible = !wall || wall.userData.wall.level > 0.9;
      win.pane.visible = visible;
      win.frame.visible = visible;
    });
  }

  // ----- Luz según la hora -----
  const light = new THREE.Color();
  function updateLighting(t) {
    if (!state.phaseAt || t - state.phaseAt > 2000) { state.phase = window.simsWorld.dayPhase(); state.phaseAt = t; paintWindows(); }
    const ph = state.phase;
    if (ph !== lastPhase) { lastPhase = ph; refreshShadows(); }
    const blackout = Boolean(state.blackout);
    const dark = blackout ? Math.max(ph.dark, 0.85) : ph.dark;
    const minutes = ph.min;
    // El sol cruza de este a oeste entre las 7 y las 21 (y de noche, luz de luna fría).
    const f = Math.min(1, Math.max(0, (minutes - 420) / 840));
    const elevation = Math.sin(f * Math.PI);
    const middle = new THREE.Vector3(W2 / PX / 2, 0, D2 / PX / 2);
    // Siempre alto y desde el lado de la cámara (un sol rasante dejaría la casa en sombra), y va
    // de este a oeste a lo largo del día.
    sun.position.set(middle.x + Math.cos(f * Math.PI) * 6, 13 + elevation * 5, middle.z + 9);
    sun.target.position.copy(middle);
    sun.color.set(new THREE.Color('#fff1d6').lerp(new THREE.Color('#ff9a5a'), ph.warm * 0.8).lerp(new THREE.Color('#8fa6ff'), dark));
    sun.intensity = 2.6 * (1 - dark) + 0.55 * dark;
    hemi.intensity = 1.55 * (1 - dark) + 0.75 * dark;
    hemi.color.set(new THREE.Color('#fff6e8').lerp(new THREE.Color('#4a5580'), dark));
    const lampsOn = state.lamps && !blackout;
    lamps.forEach((lamp) => {
      if (lamp.light) lamp.light.intensity = lampsOn ? (lamp.kind === 'floor' ? 16 : lamp.kind === 'hood' ? 6 : 8) : 0;
      if (lamp.material) lamp.material.emissiveIntensity = lampsOn ? 1.4 : 0;
    });
    if (tvScreen) {
      const on = state.props?.tv || state.props?.games;
      tvScreen.emissive.set(on ? '#7fb2ff' : '#000000');
      tvScreen.emissiveIntensity = on ? 0.9 + Math.sin(t / 90) * 0.15 : 0;
    }
    // Los muñecos (dibujados) se oscurecen un poco de noche, salvo con luces encendidas.
    light.setRGB(1, 1, 1).lerp(new THREE.Color(lampsOn ? '#f0d6b4' : blackout ? '#9a8070' : '#7a83a8'), dark * 0.5);
    // Velas del apagón.
    candleLights.forEach((candle, i) => {
      const pos = state.blackout ? state.candles?.[i] : null;
      candle.visible = Boolean(pos);
      if (pos) { candle.position.copy(toM(pos[0], pos[1])).setY(0.5); candle.intensity = 2.2 + Math.sin(t / 110 + i) * 0.3; }
    });
  }
  let lastPhase = null;
  const candleLights = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ffb070', 0, 4, 1.8); l.visible = false; scene.add(l); return l; });

  // ----- Tamaño -----
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    size = { w: rect.width, h: rect.height };
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    state.view = { w: W2, h: Math.round(W2 * (rect.height / rect.width)) };
  }
  const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;

  // ----- Pantalla ⇄ mundo -----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function rayFrom(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  function toWorld3D(clientX, clientY) {
    rayFrom(clientX, clientY);
    // Primero los muñecos, luego los muebles y las paredes; si no, el suelo.
    // En el muñeco cuenta el mismo rectángulo del cuerpo que en 2D (más fácil de acertar con el dedo
    // que solo los píxeles pintados).
    for (const hit of raycaster.intersectObjects([...actorViews.values()].map((view) => view.mesh).filter((mesh) => mesh.visible), false)) {
      const a = hit.object.userData.actor;
      if (!hit.uv || !a) continue;
      const x = a.x + hit.uv.x * SPRITE_W - SPRITE_W / 2;
      const y = a.y + (1 - hit.uv.y) * SPRITE_H - FEET;
      if (base.actorAt(x, y) === a) return { x, y };
    }
    const hits = raycaster.intersectObjects([furniture, house], true);
    for (const hit of hits) {
      let node = hit.object;
      while (node && !node.userData.objectId && node.parent && node.parent !== furniture) node = node.parent;
      const id = node?.userData.objectId;
      const hitRect = id ? base.hitRect(id) : null;
      if (hitRect) return { x: hitRect[0] + hitRect[2] / 2, y: hitRect[1] + hitRect[3] / 2 };
      const info = hit.object.userData.wall;
      if (info?.face) {
        // En la cara de una pared: se pasa a la franja de pared del dibujo 2D (cuadros, ventana…).
        const fromBottom = hit.point.y * PX;
        const [y0, y1] = info.face;
        return { x: hit.point.x * PX, y: Math.max(y0 + 6, y1 - fromBottom) };
      }
      if (hit.object.userData.floor || hit.object === floorMesh) return { x: hit.point.x * PX, y: ypx(hit.point.z * PX) };
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    return p ? { x: p.x * PX, y: ypx(p.z * PX) } : { x: 0, y: 0 };
  }
  const projected = new THREE.Vector3();
  function toScreen3D(x, y) {
    const rect = canvas.getBoundingClientRect();
    // Para los bocadillos: un punto por encima de los pies de un muñeco es su cabeza.
    const a = (state.actors || []).find((actor) => Math.abs(actor.x - x) < 0.5 && y <= actor.y);
    const view = a && actorViews.get(a);
    if (view) view.mesh.localToWorld(projected.set(0, (a.y - y) / PX, 0));
    else projected.copy(toM(x, y));
    projected.project(camera);
    return { x: ((projected.x + 1) / 2) * rect.width, y: ((1 - projected.y) / 2) * rect.height, width: rect.width, height: rect.height };
  }

  // ----- Montaje -----
  await buildFurniture();
  buildShell();
  container.insertBefore(canvas, base.overlay);
  base.canvas.style.display = 'none';
  observer?.observe(canvas);
  resize();
  container.classList.add('is-3d');

  function render3D(t, dt) {
    if (!size.w) resize();
    updateCamera();
    updateWalls();
    updateLighting(t);
    stepParticles(dt);
    drawActors(t, light);
    drawProps(t);
    drawProjectiles(t);
    drawOutlines(t);
    drawMarker(t);
    renderer.render(scene, camera);
  }
  let active = true;
  const isHouse = () => (state.scene || 'house') === 'house';
  function showMode() {
    const house3d = active && isHouse();
    canvas.style.display = house3d ? '' : 'none';
    base.canvas.style.display = house3d ? 'none' : '';
    container.classList.toggle('is-3d', house3d);
  }

  const world = Object.create(base);
  Object.assign(world, {
    is3D: true,
    three: { renderer, scene, camera, THREE },
    render(t, dt) {
      showMode();
      if (active && isHouse()) render3D(t, dt);
      else base.render(t, dt);
    },
    toWorld(x, y) { return active && isHouse() ? toWorld3D(x, y) : base.toWorld(x, y); },
    toScreen(x, y) { return active && isHouse() ? toScreen3D(x, y) : base.toScreen(x, y); },
    panBy(dx, dy) {
      if (!(active && isHouse())) return base.panBy(dx, dy);
      const k = (fitDistance() / zoomLevel()) * 0.0016;
      pan = (pan || target.clone()).add(new THREE.Vector3(-dx * k, 0, -dy * k / Math.sin(PITCH)));
      pan.x = Math.max(0.5, Math.min(W2 / PX - 0.5, pan.x));
      pan.z = Math.max(1.5, Math.min(D2 / PX, pan.z));
    },
    endPan() { pan = null; base.endPan(); },
    setDecor(next) {
      const result = base.setDecor(next);
      buildShell();
      buildFurniture();
      return result;
    },
    setPhotos(list) {
      base.setPhotos(list);
      state.photosRaw = state.photos;
      buildShell();
    },
    set3D(on) { active = on; showMode(); },
    destroy() {
      observer?.disconnect();
      renderer.dispose();
      canvas.remove();
      base.canvas.style.display = '';
      container.classList.remove('is-3d');
      base.destroy?.();
    }
  });
  Object.defineProperty(world, 'canvas', { get: () => (active && isHouse() ? canvas : base.canvas) });
  state.photosRaw = state.photos;
  return world;
}
