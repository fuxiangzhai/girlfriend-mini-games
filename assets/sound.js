const storageKey = "pat-pat-club:sound";

export function bindGameSound(button, label, playEffect, options = {}) {
  let enabled = true;
  let audio;
  let buffer;
  let master;
  let volume = 1;
  let sessionPreference = false;

  function applyGain() {
    if (master) master.gain.setTargetAtTime(enabled ? volume : 0, audio.currentTime, .008);
  }

  function refreshLabel() {
    button.setAttribute("aria-pressed", String(enabled));
    label.textContent = options.label ? options.label(enabled) : enabled ? "音效开" : "音效关";
    options.onChange?.(enabled, volume);
  }

  function readPreference() {
    try {
      if (!sessionPreference) enabled = localStorage.getItem(storageKey) !== "off";
    } catch {
      // Keep the current preference when browser storage is unavailable.
    }
    applyGain();
    refreshLabel();
  }

  function unlock() {
    if (!enabled) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    try {
      if (!audio) {
        audio = new AudioEngine();
        master = audio.createGain();
        master.gain.value = volume;
        master.connect(audio.destination);
      }
      if (audio.state !== "running") void audio.resume().catch(() => {});
    } catch {
      // The games can provide visual feedback without audio.
    }
  }

  function play(cue) {
    if (!enabled || !audio || volume === 0) return;
    if (playEffect) {
      playEffect(audio, cue, master);
      return;
    }
    if (!buffer) {
      buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .12), audio.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) {
        samples[index] = (Math.random() * 2 - 1) * Math.exp(-8 * index / samples.length);
      }
    }

    const now = audio.currentTime;
    const noise = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const output = audio.createGain();
    noise.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 840;
    filter.Q.value = .68;
    output.gain.value = .24;
    noise.connect(filter).connect(output).connect(master);
    noise.start(now);

    const pulse = audio.createOscillator();
    const envelope = audio.createGain();
    pulse.type = "sine";
    pulse.frequency.setValueAtTime(175, now);
    pulse.frequency.exponentialRampToValueAtTime(58, now + .085);
    envelope.gain.setValueAtTime(.17, now);
    envelope.gain.exponentialRampToValueAtTime(.001, now + .1);
    pulse.connect(envelope).connect(master);
    pulse.start(now);
    pulse.stop(now + .105);
  }

  button.addEventListener("click", () => {
    enabled = !enabled;
    try {
      localStorage.setItem(storageKey, enabled ? "on" : "off");
      sessionPreference = false;
    } catch {
      sessionPreference = true;
    }
    applyGain();
    refreshLabel();
    if (enabled) unlock();
  });
  window.addEventListener("pageshow", readPreference);
  window.addEventListener("storage", event => {
    if (event.key === storageKey) readPreference();
  });
  readPreference();
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    applyGain();
    refreshLabel();
  }
  return { unlock, play, setVolume, refreshLabel };
}
