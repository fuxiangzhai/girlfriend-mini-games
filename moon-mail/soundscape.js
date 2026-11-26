// Short, gesture-triggered cues. All voices pass through the shared mute/volume gain.
const phrases = {
  switchRail: [[0, 430, .055, .055], [.045, 720, .085, .033]],
  punchTicket: [[0, 215, .065, .075], [.095, 659, .19, .045], [.20, 988, .28, .035]],
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
  switchRail: [[0, .039, 1650, .075]],
  punchTicket: [[0, .065, 820, .13]],
  shutter: [[0, .033, 1150, .16], [.065, .042, 2400, .09]],
  paper: [[0, .095, 2200, .12], [.105, .105, 3200, .065]],
  depart: [[0, .23, 1250, .09]],
  stamp: [[0, .05, 760, .19]],
};
const noiseBuffers = new WeakMap();
const playingEcho = new WeakMap();

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
  const echo = cue?.kind === "echo";
  const voices = echo ? new Set() : null;
  if (echo) {
    // A new call replaces the previous sequence so two replies cannot be
    // mistaken for a single sequence of bells.
    for (const previous of playingEcho.get(ctx) || []) {
      if (previous.start > now) previous.voice.stop(now);
      else {
        const level = previous.gain.gain;
        if (level.cancelAndHoldAtTime) level.cancelAndHoldAtTime(now);
        else { const held = level.value; level.cancelScheduledValues(now); level.setValueAtTime(held, now); }
        level.setTargetAtTime(.0001, now, .004);
        previous.voice.stop(now + .02);
      }
    }
    playingEcho.set(ctx, voices);
  }
  const notes = cue?.kind === "duet" ? duetNotes(cue.voices, cue.solo)
    : echo ? [[0, 294, .10, .045], ...Array.from(cue.bells, (bell, i) => [.15 + i * .28, bell === "1" ? 660 : 988, .36, .055])] : phrases[cue] || [];
  for (const [delay, pitch, length, peak] of notes) {
    const start = now + delay;
    const voice = ctx.createOscillator();
    voice.type = ["turn", "stamp", "limit"].includes(cue) ? "triangle" : "sine";
    voice.frequency.setValueAtTime(pitch, start);
    if (cue === "tide") voice.frequency.exponentialRampToValueAtTime(pitch * 1.12, start + length);
    const gain = envelope(ctx, bus, start, length, peak);
    voice.connect(gain);
    const sounding = { voice, gain, start };
    voices?.add(sounding);
    voice.onended = () => {
      voice.disconnect(); gain.disconnect();
      if (voices) {
        voices.delete(sounding);
        if (!voices.size && playingEcho.get(ctx) === voices) playingEcho.delete(ctx);
      }
    };
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

function duetNotes(voices, solo = -1) {
  const scales = [[262, 294, 330, 392], [523, 587, 659, 784]];
  return voices.flatMap(({event, direction}, i) => {
    if (event === "rest" || event === "held" || (solo !== -1 && solo !== i)) return [];
    if (event === "arrive") return [[0, i ? 660 : 392, .32, .055]];
    return [[0, scales[i][direction], event === "start" ? .15 : .105, .04]];
  });
}
