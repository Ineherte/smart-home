// Música de fondo del modo Sims, generada en el navegador (sin archivos): acordes suaves, un
// bajo y un arpegio que cambian con la hora y el sitio. De día, alegre; al atardecer y de noche,
// más tranquila; en Turín y Chieti, con aire de mandolina; en la casa de campo, cadencia andaluza.
// La activa y para sims.js (botón del altavoz) y usa el mismo AudioContext que los sonidos.
(function () {
  const NOTE = (name) => {
    const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const [, n, o] = /^([A-G]#?)(\d)$/.exec(name);
    return 440 * 2 ** ((map[n] + (Number(o) + 1) * 12 - 69) / 12);
  };
  const chord = (...names) => names.map(NOTE);
  const MOODS = {
    day: { tempo: 92, hats: true, pluck: 'triangle', chords: [chord('C3', 'E4', 'G4', 'C5'), chord('G2', 'D4', 'G4', 'B4'), chord('A2', 'C4', 'E4', 'A4'), chord('F2', 'C4', 'F4', 'A4')] },
    dusk: { tempo: 78, hats: false, pluck: 'sine', chords: [chord('F2', 'A3', 'E4', 'C5'), chord('E2', 'G3', 'D4', 'B4'), chord('D2', 'F3', 'C4', 'A4'), chord('C2', 'E3', 'B3', 'G4')] },
    night: { tempo: 64, hats: false, pluck: 'sine', soft: true, chords: [chord('A2', 'C4', 'E4', 'G4'), chord('F2', 'A3', 'C4', 'E4'), chord('C2', 'E3', 'G3', 'B3'), chord('G2', 'B3', 'D4', 'E4')] },
    italy: { tempo: 104, hats: true, tremolo: true, pluck: 'triangle', chords: [chord('G2', 'B3', 'D4', 'G4'), chord('D2', 'A3', 'D4', 'F#4'), chord('E2', 'B3', 'E4', 'G4'), chord('C2', 'G3', 'C4', 'E4')] },
    spain: { tempo: 96, hats: true, pluck: 'sawtooth', guitar: true, chords: [chord('A2', 'C4', 'E4', 'A4'), chord('G2', 'B3', 'D4', 'G4'), chord('F2', 'A3', 'C4', 'F4'), chord('E2', 'G#3', 'B3', 'E4')] }
  };
  const music = { on: false, mood: 'day', master: null, nextTime: 0, step: 0, timer: 0 };
  const ctx = () => (simsAudio ||= new (window.AudioContext || window.webkitAudioContext)());

  function voice(type, freq, start, dur, volume, { attack = 0.01, filter = 0 } = {}) {
    const audio = ctx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = osc.connect(gain);
    if (filter) {
      const lp = audio.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filter;
      node = gain.connect(lp);
      lp.connect(music.master);
    } else gain.connect(music.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
  function hat(start) {
    const audio = ctx();
    const length = Math.floor(audio.sampleRate * 0.05);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = audio.createGain();
    gain.gain.value = 0.12;
    source.connect(filter).connect(gain).connect(music.master);
    source.start(start);
  }
  // Una corchea: el bajo en las partes fuertes, el acorde al empezar el compás y un arpegio
  // que a veces se calla (para que no suene a bucle).
  function schedule(time) {
    const mood = MOODS[music.mood];
    const eighth = 60 / mood.tempo / 2;
    const bar = Math.floor(music.step / 8) % mood.chords.length;
    const beat = music.step % 8;
    const notes = mood.chords[bar];
    if (beat === 0) {
      notes.slice(1).forEach((freq) => voice('triangle', freq, time, eighth * 8, mood.soft ? 0.05 : 0.04, { attack: 0.25, filter: 1400 }));
      voice('sine', notes[0], time, eighth * 3.5, 0.22);
    }
    if (beat === 4) voice('sine', notes[0] * (mood.guitar ? 1 : 1.5), time, eighth * 3, 0.16);
    const pattern = [1, 2, 3, 2, 1, 3, 2, 3];
    if (Math.random() > (mood.soft ? 0.45 : 0.22)) {
      const freq = notes[pattern[beat]] * 2;
      if (mood.tremolo) [0, 1, 2].forEach((i) => voice('triangle', freq, time + i * eighth / 3, eighth / 3, 0.035));
      else voice(mood.pluck, freq, time, eighth * 1.8, mood.guitar ? 0.03 : 0.05, { filter: mood.guitar ? 2200 : 0 });
    }
    if (mood.hats && beat % 2 === 1) hat(time);
  }
  function tick() {
    if (!music.on) return;
    const audio = ctx();
    while (music.nextTime < audio.currentTime + 0.35) {
      schedule(music.nextTime);
      music.nextTime += 60 / MOODS[music.mood].tempo / 2;
      music.step += 1;
    }
  }
  function start() {
    if (music.on) return;
    try {
      const audio = ctx();
      audio.resume?.();
      music.master = audio.createGain();
      music.master.gain.value = 0;
      music.master.connect(audio.destination);
      music.master.gain.setTargetAtTime(0.5, audio.currentTime, 1.2);
      music.nextTime = audio.currentTime + 0.1;
      music.step = 0;
      music.on = true;
      music.timer = setInterval(tick, 100);
    } catch {}
  }
  function stop() {
    if (!music.on) return;
    music.on = false;
    clearInterval(music.timer);
    const master = music.master;
    try { master.gain.setTargetAtTime(0, ctx().currentTime, 0.4); setTimeout(() => master.disconnect(), 1600); } catch {}
  }
  // Qué suena según el sitio y la hora (se llama en cada vuelta del juego).
  function setMood(scene, hour) {
    const next = scene === 'chieti' || scene === 'turin' ? 'italy' : scene === 'spain' ? 'spain' : hour >= 21 || hour < 7 ? 'night' : hour >= 18 ? 'dusk' : 'day';
    if (next === music.mood) return;
    music.mood = next;
    music.step = 0;
  }
  window.simsMusic = { start, stop, setMood, isOn: () => music.on };
})();
