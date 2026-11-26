// Short, gesture-triggered cues. All voices pass through the shared mute/volume gain.
const phrases = {
  focus:   [[0, 698, .12, .035], [.065, 880, .17, .034]],
  shutter: [[0, 190, .04, .06], [.045, 360, .04, .035]],
  develop: [[0, 330, .27, .045], [.12, 440, .32, .04], [.24, 554, .38, .035]],
  turn:    [[0, 1150, .05, .045], [.012, 1535, .08, .022]],
  undo:    [[0, 587, .10, .06], [.075, 392, .14, .055]],
  reset:   [[0, 440, .09, .05], [.075, 330, .09, .05], [.15, 262, .17, .05]],
  hint:    [[0, 523, .22, .06], [.13, 784, .30, .045]],
  stamp:   [[0, 160, .085, .13], [.035, 659, .19, .055]],
  tide:    [[0, 330, .28, .055], [.06, 494, .32, .045], [.14, 740, .33, .035]],
  ready:   [[0, 523, .24, .055], [.08, 659, .25, .045], [.16, 784, .34, .055]],
  joint:   [[0, 440, .28, .055], [.045, 659, .31, .047], [.18, 880, .40, .04]],
  limit:   [[0, 277, .15, .065], [.12, 247, .19, .048]],
  depart:  [[.04, 392, .16, .045], [.13, 587, .22, .05]],
  sent:    [[0, 392, .24, .065], [.11, 494, .24, .06], [.22, 587, .30, .055], [.34, 784, .43, .06]],
};
const textures = {
  shutter: [[0, .033, 1150, .16], [.065, .042, 2400, .09]],
  paper: [[0, .095, 2200, .12], [.105, .105, 3200, .065]],
  depart: [[0, .23, 1250, .09]],
  stamp: [[0, .05, 760, .19]],
};
const noiseBuffers = new WeakMap();

function paperNoise(ctx) {
  if (!noiseBuffers.has(ctx)) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .3), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return noiseBuffers.get(ctx);
}

function envelope(ctx, bus, start, duration, peak) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + .009);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  gain.connect(bus);
  return gain;
}

export function playMailSound(ctx, cue, bus) {
  const now = ctx.currentTime;
  for (const [delay, pitch, length, peak] of phrases[cue] || []) {
    const start = now + delay;
    const voice = ctx.createOscillator();
    voice.type = ["turn", "stamp", "limit"].includes(cue) ? "triangle" : "sine";
    voice.frequency.setValueAtTime(pitch, start);
    if (cue === "tide") voice.frequency.exponentialRampToValueAtTime(pitch * 1.12, start + length);
    const gain = envelope(ctx, bus, start, length, peak);
    voice.connect(gain);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); };
    voice.start(start);
    voice.stop(start + length);
  }
  for (const [delay, length, frequency, peak] of textures[cue] || []) {
    const start = now + delay;
    const source = ctx.createBufferSource();
    source.buffer = paperNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = .75;
    const gain = envelope(ctx, bus, start, length, peak);
    source.connect(filter).connect(gain);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start, 0, length);
  }
}
