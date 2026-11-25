const storageKey = "pat-pat-club:sound";
const hit = { length: .12, filter: 840, noise: .24, pitch: 175, end: 58, tone: .17 };
const effects = {
  hit,
  bubble: { length: .071, filter: 1860, noise: .20, pitch: 325, end: 117, tone: .14 },
  flip: { length: .075, filter: 2200, noise: .09, pitch: 490, end: 330, tone: .07 },
  match: { length: .16, filter: 1550, noise: .035, pitch: 622, end: 935, tone: .12 },
  star: { length: .15, filter: 2600, noise: .018, pitch: 660, end: 990, tone: .12 },
};

export function bindGameSound(button, label) {
  let enabled = true;
  let audio;
  const buffers = new Map();

  function refreshLabel() {
    button.setAttribute("aria-pressed", String(enabled));
    label.textContent = enabled ? "音效开" : "音效关";
  }

  function readPreference() {
    try {
      enabled = localStorage.getItem(storageKey) !== "off";
    } catch {
      // Keep the current preference when browser storage is unavailable.
    }
    refreshLabel();
  }

  function unlock() {
    if (!enabled) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    try {
      audio ??= new AudioEngine();
      if (audio.state !== "running") void audio.resume().catch(() => {});
    } catch {
      // The games can provide visual feedback without audio.
    }
  }

  function play(effect = "hit", pitchFactor = 1) {
    if (!enabled || !audio) return;
    const { length, filter: center, noise: noiseLevel, pitch, end, tone } = effects[effect];
    if (!buffers.has(effect)) {
      const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * length), audio.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) {
        samples[index] = (Math.random() * 2 - 1) * Math.exp(-8 * index / samples.length);
      }
      buffers.set(effect, buffer);
    }

    const now = audio.currentTime;
    const noise = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const output = audio.createGain();
    noise.buffer = buffers.get(effect);
    filter.type = "bandpass";
    filter.frequency.value = center * pitchFactor;
    filter.Q.value = .68;
    output.gain.value = noiseLevel;
    noise.connect(filter).connect(output).connect(audio.destination);
    noise.start(now);

    const pulse = audio.createOscillator();
    const envelope = audio.createGain();
    pulse.type = "sine";
    pulse.frequency.setValueAtTime(pitch * pitchFactor, now);
    pulse.frequency.exponentialRampToValueAtTime(end * pitchFactor, now + length * .71);
    envelope.gain.setValueAtTime(tone, now);
    envelope.gain.exponentialRampToValueAtTime(.001, now + length * .83);
    pulse.connect(envelope).connect(audio.destination);
    pulse.start(now);
    pulse.stop(now + length * .88);
  }

  button.addEventListener("click", () => {
    enabled = !enabled;
    try {
      localStorage.setItem(storageKey, enabled ? "on" : "off");
    } catch {
      // The toggle still works for the current page.
    }
    refreshLabel();
    if (enabled) unlock();
  });
  window.addEventListener("pageshow", readPreference);
  window.addEventListener("storage", event => {
    if (event.key === storageKey) readPreference();
  });
  readPreference();
  return { unlock, play };
}
