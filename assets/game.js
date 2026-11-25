import { createCamera } from "./camera.js";

const byId = id => document.getElementById(id);
const stage = byId("stage");
const target = byId("target");
const pose = byId("pose");
const face = byId("face");
const originalFace = face.src;
const effects = byId("effects");
const soundButton = byId("sound");
const cameraButton = byId("camera");
const cameraPreview = byId("camera-preview");
const mode = byId("mode");
const hint = byId("stage-hint");
const feedback = byId("feedback");
const resetButton = byId("reset");
const photoInput = byId("photo-input");
const photoButton = byId("photo-button");
const undoPhoto = byId("undo-photo");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

let hits = 0;
let combo = 0;
let best = 0;
let lastHit = -Infinity;
let lastDirection = -1;
let bounce;
let photoUrl;
let photoRequest = 0;
let soundOn = true;
let audio;
let soundBuffer;

function report(message = "") {
  feedback.textContent = message;
  feedback.hidden = !message;
}

function updateScore() {
  byId("hits").textContent = String(hits).padStart(2, "0");
  byId("best").textContent = String(best);
  resetButton.disabled = hits === 0;
}

function unlockAudio() {
  if (!soundOn) return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  try {
    audio ??= new AudioEngine();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {
    // The visual feedback is available even without browser audio.
  }
}

function playPop() {
  if (!soundOn || !audio) return;
  if (!soundBuffer) {
    soundBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .12), audio.sampleRate);
    const samples = soundBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.random() * 2 - 1) * Math.exp(-8 * i / samples.length);
    }
  }
  const now = audio.currentTime;
  const noise = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const output = audio.createGain();
  noise.buffer = soundBuffer;
  filter.type = "bandpass";
  filter.frequency.value = 840;
  filter.Q.value = .68;
  output.gain.value = .24;
  noise.connect(filter).connect(output).connect(audio.destination);
  noise.start(now);

  const thump = audio.createOscillator();
  const envelope = audio.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(175, now);
  thump.frequency.exponentialRampToValueAtTime(58, now + .085);
  envelope.gain.setValueAtTime(.17, now);
  envelope.gain.exponentialRampToValueAtTime(.001, now + .1);
  thump.connect(envelope).connect(audio.destination);
  thump.start(now);
  thump.stop(now + .105);
}

function animateEffect(element, frames, duration) {
  const animation = element.animate(frames, { duration, easing: "cubic-bezier(.2,.7,.25,1)" });
  animation.onfinish = () => element.remove();
}

function showImpact(direction, position) {
  const x = position?.x ?? (direction > 0 ? .38 : .62);
  const y = position?.y ?? .41;
  const burst = document.createElement("div");
  burst.className = "impact";
  const label = document.createElement("span");
  label.className = "impact-text";
  label.textContent = ["啪！", "啪叽！", "啵！"][Math.min(2, combo - 1)];
  burst.append(label);
  if (combo > 1) {
    const streak = document.createElement("span");
    streak.className = "impact-combo";
    streak.textContent = "×" + combo;
    burst.append(streak);
  }
  burst.style.left = Math.max(18, Math.min(82, x * 100)) + "%";
  burst.style.top = Math.max(18, Math.min(78, y * 100)) + "%";
  effects.append(burst);
  const still = "translate(-50%,-50%) rotate(" + direction * -12 + "deg)";
  if (reducedMotion.matches) {
    animateEffect(burst, [{ transform: still }, { transform: still, opacity: 0 }], 350);
    return;
  }
  animateEffect(burst, [
    { transform: still + " scale(.6)", opacity: .9 },
    { transform: still + " scale(1.1)", opacity: 1, offset: .23 },
    { transform: still + " scale(1.02)", opacity: 1, offset: .55 },
    { transform: still + " scale(.96)", opacity: 0 },
  ], 510);
  for (let i = 0; i < 6; i++) {
    const star = document.createElement("span");
    star.className = "particle";
    star.textContent = i % 2 ? "✧" : "✦";
    star.style.left = burst.style.left;
    star.style.top = burst.style.top;
    effects.append(star);
    const theta = (i + .35) * Math.PI / 3;
    const distance = 58 + Math.random() * 43;
    const dx = Math.cos(theta) * distance;
    const dy = Math.sin(theta) * distance;
    animateEffect(star, [
      { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
      { transform: "translate(" + dx * .65 + "px," + dy * .65 + "px) scale(1)", opacity: 1, offset: .3 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(.45)", opacity: 0 },
    ], 480);
  }
}

function hit(direction, position) {
  const now = performance.now();
  combo = now - lastHit <= 1150 ? combo + 1 : 1;
  hits++;
  best = Math.max(best, combo);
  lastHit = now;
  lastDirection = direction;
  updateScore();

  if (!reducedMotion.matches) {
    bounce?.cancel();
    bounce = pose.animate([
      { transform: "none" },
      { transform: "translateX(" + 27 * direction + "px) rotate(" + direction * 12 + "deg) scale(.91,1.03)", offset: .21 },
      { transform: "translateX(" + -8 * direction + "px) rotate(" + direction * -4 + "deg) scale(1.04,.99)", offset: .59 },
      { transform: "none" },
    ], { duration: 390, easing: "ease-out" });
  }
  showImpact(direction, position);
  playPop();
}

target.addEventListener("click", event => {
  unlockAudio();
  const bounds = stage.getBoundingClientRect();
  if (event.detail === 0) {
    hit(-lastDirection);
    return;
  }
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  hit(x < .5 ? 1 : -1, { x, y });
});

soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.setAttribute("aria-pressed", String(soundOn));
  byId("sound-label").textContent = soundOn ? "音效开" : "音效关";
  if (soundOn) unlockAudio();
});

resetButton.addEventListener("click", () => {
  hits = combo = best = 0;
  lastHit = -Infinity;
  bounce?.cancel();
  effects.replaceChildren();
  target.focus({ preventScroll: true });
  updateScore();
});

photoButton.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  photoInput.value = "";
  if (!file) return;
  const request = ++photoRequest;
  if (file.size > 20 * 1024 * 1024) {
    report("请选择小于 20 MB 的照片。");
    return;
  }
  const nextPhoto = URL.createObjectURL(file);
  const preview = new Image();
  preview.src = nextPhoto;
  try {
    await preview.decode();
  } catch {
    URL.revokeObjectURL(nextPhoto);
    if (request === photoRequest) report("这张照片无法打开。试试 JPG、PNG 或 WebP。");
    return;
  }
  if (request !== photoRequest) {
    URL.revokeObjectURL(nextPhoto);
    return;
  }
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = nextPhoto;
  face.src = photoUrl;
  target.classList.add("has-photo");
  undoPhoto.hidden = false;
  report();
});

undoPhoto.addEventListener("click", () => {
  photoRequest++;
  face.src = originalFace;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = undefined;
  target.classList.remove("has-photo");
  photoButton.focus({ preventScroll: true });
  undoPhoto.hidden = true;
  report();
});

const camera = createCamera({
  video: byId("camera-video"),
  feed: byId("camera-feed"),
  canvas: byId("skeleton"),
  onState(state, message = "") {
    const labels = {
      off: ["开启摄像头", "点击模式", "点击头像，先拍一下！"],
      loading: ["取消开启", "正在开启", "等待摄像头和识别模型…"],
      on: ["关闭摄像头", "手势模式", "把张开的手掌放进画面"],
    };
    const [buttonText, modeText, hintText] = labels[state];
    cameraButton.setAttribute("aria-pressed", String(state !== "off"));
    byId("camera-label").textContent = buttonText;
    mode.textContent = modeText;
    hint.textContent = hintText;
    stage.classList.toggle("is-tracking", state === "on");
    cameraPreview.hidden = state !== "on";
    report(message);
  },
  onHand(found) {
    hint.textContent = found ? "手掌张开，快速横挥！" : "把张开的手掌放进画面";
  },
  onHit: hit,
});

cameraButton.addEventListener("click", () => {
  if (camera.isActive()) {
    camera.stop();
  } else {
    unlockAudio();
    void camera.start();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && camera.isActive()) camera.stop("切换页面后，摄像头已关闭。");
});
window.addEventListener("pagehide", () => {
  if (camera.isActive()) camera.stop();
});
