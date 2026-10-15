// Fotos del hogar (recetas y momentos). Se reducen en el teléfono antes de subirlas y se
// guardan en el bucket privado household-media de Supabase, en la carpeta del hogar.
// Para verlas se piden enlaces firmados temporales. En modo local se guarda una versión
// pequeña dentro del propio registro (data URL).
const MEDIA_BUCKET = 'household-media';
const mediaUrlCache = new Map();

// Reduce la foto antes de subirla. Las del iPhone 17 son de 48 MP: si el método normal no puede
// con ella, se intenta con createImageBitmap antes de dar error.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la foto')); };
    image.src = url;
  });
}
async function resizePhoto(file, maxSide = 1600, quality = 0.82) {
  let source;
  try {
    source = await loadImage(file);
  } catch (error) {
    if (!('createImageBitmap' in window)) throw error;
    try { source = await createImageBitmap(file); } catch { throw new Error('No se pudo leer la foto (¿formato HEIC en el ordenador? Prueba desde el iPhone o en JPG)'); }
  }
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('No se pudo preparar la foto');
  return blob;
}

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});

// Devuelve la ruta guardada (o un data URL en modo local).
async function uploadPhoto(file, folder) {
  if (!(supabaseClient && authUserId)) return blobToDataUrl(await resizePhoto(file, 700, 0.75));
  if (!householdReady()) throw new Error('Tu hogar aún se está conectando');
  const blob = await resizePhoto(file);
  const path = `${householdId}/${folder}/${dateToISO(new Date())}-${createLocalId()}.jpg`;
  const { error } = await supabaseClient.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Falta ejecutar life.sql en Supabase (bucket de fotos)' : error.message);
  return path;
}

async function deletePhoto(path) {
  if (!path || path.startsWith('data:') || !(supabaseClient && authUserId)) return;
  await supabaseClient.storage.from(MEDIA_BUCKET).remove([path]);
  mediaUrlCache.delete(path);
}

// Enlaces para mostrar varias fotos de una vez (válidos una hora).
async function photoUrls(paths) {
  const now = Date.now();
  const result = new Map();
  const missing = [];
  [...new Set(paths.filter(Boolean))].forEach((path) => {
    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) result.set(path, path);
    else if (mediaUrlCache.get(path)?.expires > now) result.set(path, mediaUrlCache.get(path).url);
    else missing.push(path);
  });
  if (missing.length && supabaseClient && authUserId) {
    const { data } = await supabaseClient.storage.from(MEDIA_BUCKET).createSignedUrls(missing, 3600);
    (data || []).forEach((entry) => {
      if (!entry.signedUrl) return;
      mediaUrlCache.set(entry.path, { url: entry.signedUrl, expires: now + 50 * 60 * 1000 });
      result.set(entry.path, entry.signedUrl);
    });
  }
  return result;
}

// Rellena las <img data-photo="ruta"> de un contenedor.
async function hydratePhotos(container) {
  const images = [...container.querySelectorAll('img[data-photo]')];
  if (!images.length) return;
  const urls = await photoUrls(images.map((image) => image.dataset.photo));
  images.forEach((image) => {
    const url = urls.get(image.dataset.photo);
    if (url && image.src !== url) image.src = url;
  });
}

// Selector de foto: cámara o galería. El campo va dentro de la página mientras se elige: en el
// iPhone, uno suelto a veces se pierde y no llega a avisar de la foto elegida (sobre todo con la
// cámara o si se tarda en elegir). facing: 'user' (cámara de los selfis) o 'environment'.
function pickPhoto({ camera = false, facing = 'environment' } = {}) {
  return new Promise((resolve) => {
    document.querySelectorAll('input[data-photo-picker]').forEach((old) => old.remove());
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.dataset.photoPicker = '';
    if (camera) input.setAttribute('capture', facing);
    input.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    let done = false;
    const finish = (file) => {
      if (done) return;
      done = true;
      resolve(file);
      setTimeout(() => input.remove(), 1000);
    };
    input.addEventListener('change', () => finish(input.files?.[0] || null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
