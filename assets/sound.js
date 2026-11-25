const storageKey = "pat-pat-club:sound";

export function bindGameSound(button, label) {
  let enabled = true;
  let audio;
  let buffer;

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

  function play() {
    if (!enabled || !audio) return;
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
    noise.connect(filter).connect(output).connect(audio.destination);
    noise.start(now);

    const pulse = audio.createOscillator();
    const envelope = audio.createGain();
    pulse.type = "sine";
    pulse.frequency.setValueAtTime(175, now);
    pulse.frequency.exponentialRampToValueAtTime(58, now + .085);
    envelope.gain.setValueAtTime(.17, now);
    envelope.gain.exponentialRampToValueAtTime(.001, now + .1);
    pulse.connect(envelope).connect(audio.destination);
    pulse.start(now);
    pulse.stop(now + .105);
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
