lucide.createIcons();

const toast = document.querySelector('.toast');
const toastMessage = toast.querySelector('span');
const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=45.0703&longitude=7.6869&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome';
let toastTimer;
let lightsOn = true;

const weatherDescriptions = {
  0: ['Despejado', 'sun'],
  1: ['Casi despejado', 'sun'],
  2: ['Parcialmente nublado', 'cloud-sun'],
  3: ['Nublado', 'cloud'],
  45: ['Niebla', 'cloud-fog'],
  48: ['Niebla helada', 'cloud-fog'],
  51: ['Llovizna ligera', 'cloud-drizzle'],
  53: ['Llovizna', 'cloud-drizzle'],
  55: ['Llovizna intensa', 'cloud-drizzle'],
  61: ['Lluvia ligera', 'cloud-rain'],
  63: ['Lluvia', 'cloud-rain'],
  65: ['Lluvia intensa', 'cloud-rain'],
  71: ['Nieve ligera', 'snowflake'],
  73: ['Nieve', 'snowflake'],
  75: ['Nieve intensa', 'snowflake'],
  80: ['Chubascos ligeros', 'cloud-rain'],
  81: ['Chubascos', 'cloud-rain'],
  82: ['Chubascos intensos', 'cloud-rain'],
  95: ['Tormenta', 'cloud-lightning'],
  96: ['Tormenta con granizo', 'cloud-lightning'],
  99: ['Tormenta con granizo', 'cloud-lightning']
};

function formatToday() {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

async function loadWeather() {
  const response = await fetch(weatherUrl);
  if (!response.ok) throw new Error('No se pudo consultar el tiempo');
  const data = await response.json();
  const current = data.current;
  const daily = data.daily;
  const [description, icon] = weatherDescriptions[current.weather_code] || ['Tiempo variable', 'cloud-sun'];
  const temperature = Math.round(current.temperature_2m);
  document.querySelector('#todayLabel').textContent = formatToday();
  document.querySelector('#headerWeather').textContent = `· ${temperature}° / ${description.toLowerCase()}`;
  document.querySelector('#weatherTemp').textContent = `${temperature}°`;
  document.querySelector('#weatherDescription').textContent = `${description} · Sensación ${Math.round(current.apparent_temperature)}°`;
  document.querySelector('#weatherDetails').textContent = `Humedad ${current.relative_humidity_2m}% · Máx. ${Math.round(daily.temperature_2m_max[0])}° / mín. ${Math.round(daily.temperature_2m_min[0])}°`;
  const weatherIcon = document.querySelector('.climate-card .card-icon svg');
  weatherIcon.setAttribute('data-lucide', icon);
  weatherIcon.outerHTML = `<i data-lucide="${icon}"></i>`;
  lucide.createIcons();
  return true;
}

function updateWeather() {
  return loadWeather().catch(() => {
    document.querySelector('#headerWeather').textContent = '· Tiempo no disponible';
    document.querySelector('#weatherDescription').textContent = 'No se pudo actualizar';
    showToast('No se pudo actualizar el tiempo ahora');
    return false;
  });
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

document.querySelectorAll('[data-action]').forEach((action) => {
  action.addEventListener('click', () => {
    const type = action.dataset.action;

    if (type === 'lights') {
      lightsOn = !lightsOn;
      document.querySelector('#lightsStatus').textContent = lightsOn ? '2 encendidas · salón y cocina' : 'Todas apagadas';
      showToast(lightsOn ? 'Luces del salón y la cocina encendidas' : 'Todas las luces están apagadas');
    }

    if (type === 'calendar') {
      showToast('Tu próxima cita es a las 10:30 en el estudio');
      document.querySelector('#agenda-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (type === 'tv') {
      document.querySelector('#tvStatus').textContent = 'Enviando resumen a la TV...';
      showToast('Resumen enviado a la TV del salón');
      setTimeout(() => { document.querySelector('#tvStatus').textContent = 'Resumen listo en la TV del salón'; }, 850);
    }
  });
});

document.querySelector('#refreshButton').addEventListener('click', (event) => {
  const icon = event.currentTarget.querySelector('svg');
  icon.classList.add('spin');
  updateWeather().then((updated) => {
    if (updated) showToast('Tiempo actualizado hace un momento');
  });
  setTimeout(() => icon.classList.remove('spin'), 500);
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.remove('active'));
    item.classList.add('active');
    showToast(`${item.querySelector('span').textContent}: vista en preparación`);
  });
});

updateWeather();
