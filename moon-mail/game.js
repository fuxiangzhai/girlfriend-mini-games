import { bindGameSound } from "../assets/sound.js";
import { letters, localLetter } from "./levels.mjs";
import { prepareRoute, difficulties, trace, closestRoute } from "./puzzle.mjs";
import { chooseLanguage, translator } from "./i18n.mjs";
import { playMailSound } from "./soundscape.js";
import { coordinate, mountChart } from "./chart.js";
import { postcardPNG } from "./postcard.js";
import { prepareFilm, readFilm, restoreFilm, filmHint, isDevelopedFilm, shutter } from "./darkroom.mjs";
import { showFilmTray, filmStatus, contactSheet, developPrint } from "./darkroom-ui.js";
import { dispatchStations } from "./dispatch.mjs";
import { createDispatchDesk } from "./dispatch-ui.js";
import { createFogWatch, watchSlip } from "./fogwatch-ui.js";
import { prepareHill, moveHill, restoreHill, hillSetting, traceHill, hillTrip, hillHint } from "./hillside.mjs";
import { hillKey, hillTickets, hillSummary, drawHillBook, drawHillSlip } from "./hillside-ui.js";
import { createSignalDuet, duetKey, duetSummary } from "./duet-ui.js";
import { createStarAtlas, atlasKey, atlasStory, atlasSummary, starPrint } from "./atlas-ui.js";
import { createMorningWindow, sashKey, teaStory, teaSummary, teaPrint } from "./sashes-ui.js";
import { createTideRoom, reelKey, reelSummary, reelPrint } from "./tide-roll-ui.js";
import { tideCourse } from "./tide-roll.mjs";
import { createGlasshouse, graftKey, pressPrint, specimenSummary } from "./grafts-ui.js";
import { glassGarden } from "./grafts.mjs";
import { bellCourse } from "./bell-rides.mjs";
import { createBridgeBells, bikeKey, rideSummary, ridePrint } from "./bell-rides-ui.js";
import { lightStation } from "./afterglow.mjs";
import { createAfterglow, glowKey, glowSummary, glowPrint } from "./afterglow-ui.js";
import { dryingRack, pressKey } from "./sunprints.mjs";
import { createSunprints } from "./sunprint-ui.js";
import { sunProof, printSummary } from "./sunprint-art.js";
import { chairStudio, chairKey, portraitStyle } from "./chair-portraits.mjs";
import { createChairStudio, rollToken } from "./chair-studio.js";
import { contactPrint, chairSummary } from "./chair-photo.js";
import { rainDesk, foldKey, shadeAt } from "./rain-folds.mjs";
import { createRainDesk } from "./rain-desk.js";
import { rainProof, foldSummary } from "./rain-paper.js";

const byId = id => document.getElementById(id);
const pad = value => String(value).padStart(2, "0");
const memory = new Map();
const memoryOnly = new Set();
const prefix = "moon-mail:v1:";
const services = {
  fold: {station:"rain", hash:"rain-folds", access:"foldAccess", map:"foldMap", icon:"#i-rainfold"},
  chair: {station:"windowprint", hash:"windowprint-three-frames", access:"chairAccess", map:"chairMap", icon:"#i-chair"},
  sun: {station:"kelpprint", hash:"kelpprint-diptych", access:"sunAccess", map:"sunMap", icon:"#i-frond"},
  glow: {station:"lighthouse", hash:"lighthouse-afterglow", access:"glowAccess", map:"glowMap", icon:"#i-afterglow"},
  bike: {station:"bridge", hash:"bridge-bells", access:"bikeAccess", map:"bikeMap", icon:"#i-bike"},
  graft: {station:"glasshouse", hash:"glasshouse-herbarium", access:"graftAccess", map:"graftMap", icon:"#i-cutting"},
  reel: {station:"arches", hash:"arches-reel", access:"reelAccess", map:"reelMap", icon:"#i-reel"},
  sashes: {station:"dawn", hash:"dawn-sashes", access:"sashAccess", map:"sashMap", icon:"#i-sash"},
  atlas: {station:"observatory", hash:"observatory-atlas", access:"atlasAccess", map:"atlasMap", icon:"#i-atlas"},
  duet: {station:"signals", hash:"signals-duet", access:"duetAccess", map:"duetMap", icon:"#i-duet"},
  watch: {station:"chimes", hash:"chimes-watch", access:"watchChartAccess", map:"watchTitle", icon:"#i-chime"},
  hill: {station:"funicular", hash:"funicular-switchbacks", access:"hillChartAccess", map:"hillMap", icon:"#i-switchback"},
};

function read(key) {
  if (memoryOnly.has(key)) return memory.get(key);
  try {
    const saved = localStorage.getItem(prefix + key);
    return saved === null ? undefined : JSON.parse(saved);
  } catch { /* Storage can be unavailable in a private or local-file session. */ }
  return memory.get(key);
}

function write(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    memoryOnly.delete(key);
  } catch {
    memoryOnly.add(key);
  }
}

// Standard routes keep the keys used by the original six-letter release.
function routeKey(index, field, goal = "direct") {
  const mode = difficulty === "standard" ? "" : "." + difficulty;
  return letters[index].id + mode + (goal === "joint" ? ".joint" : "") + "." + field;
}

function bestFor(index, goal = "direct") {
  const value = read(routeKey(index, "best", goal));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function messageFor(index) {
  const value = read(letters[index].id + ".note");
  const letter = letters[index];
  if (typeof value === "string" && value.trim() && value !== letter.letter && value !== letter.en.letter) return value.slice(0, 200);
  return localLetter(letter, language).letter;
}

let language = chooseLanguage(read("language"), navigator.languages || [navigator.language]);
let t = translator(language);
const savedDifficulty = read("difficulty");
let difficulty = difficulties.includes(savedDifficulty) ? savedDifficulty : "standard";
const sound = bindGameSound(byId("sound"), byId("sound-label"), playMailSound, {
  label: enabled => t(enabled ? "soundOn" : "soundOff"),
  onChange(enabled, gain) { byId("preview-sound").disabled = !enabled || gain === 0; },
});
function cue(name) {
  sound.unlock();
  sound.play(name);
}
const album = byId("album");
const receipt = byId("receipt");
const settings = byId("settings");
const dispatchDesk = createDispatchDesk({ context: () => ({ language, t, difficulty }), read, write, cue, openSettings, switchLanguage });
const pier = letters.findIndex(letter => letter.id === "chimes");
const slope = letters.findIndex(letter => letter.id === "funicular");
const huts = letters.findIndex(letter => letter.id === "signals");
const dome = letters.findIndex(letter => letter.id === "observatory");
const sill = letters.findIndex(letter => letter.id === "dawn");
const strait = letters.findIndex(letter => letter.id === "arches");
const greenhouse = letters.findIndex(letter => letter.id === "glasshouse");
const bridge = letters.findIndex(letter => letter.id === "bridge");
const lighthouse = letters.findIndex(letter => letter.id === "lighthouse");
const terrace = letters.findIndex(letter => letter.id === "kelpprint");
const seawall = letters.findIndex(letter => letter.id === "windowprint");
const lane = letters.findIndex(letter => letter.id === "rain");
const folds = createRainDesk({letter:letters[lane], read, write, cue, delivered:updateCount, receipt:code=>showReceipt(lane,false,code)});
const chairs = createChairStudio({letter:letters[seawall], read, write, cue, delivered:updateCount, receipt:token => showReceipt(seawall,false,token)});
const sun = createSunprints({letter:letters[terrace], read, write, cue, delivered:updateCount, receipt:id => showReceipt(terrace,false,id)});
const glow = createAfterglow({letter:letters[lighthouse], read, write, cue, delivered:updateCount, receipt:code => showReceipt(lighthouse,false,code)});
const bikes = createBridgeBells({letter:letters[bridge], read, write, cue, delivered:updateCount, receipt:code => showReceipt(bridge, false, code)});
const graft = createGlasshouse({letter:letters[greenhouse], read, write, cue, delivered:updateCount, receipt:id => showReceipt(greenhouse, false, id)});
const reel = createTideRoom({letter: letters[strait], read, write, cue, delivered: updateCount, receipt: id => showReceipt(strait, false, id)});
const sashes = createMorningWindow({letter:letters[sill], read, write, cue, delivered:updateCount, receipt:id=>showReceipt(sill,false,id)});
const atlas = createStarAtlas({ letter: letters[dome], read, write, cue, delivered: updateCount, receipt: ink => showReceipt(dome, false, ink) });
const duet = createSignalDuet({ letter: letters[huts], read, write, cue, delivered: updateCount, receipt: id => showReceipt(huts, false, id) });
const fog = createFogWatch({ letter: letters[pier], read, write, cue, delivered: updateCount, openReceipt: record => showReceipt(pier, true, record) });
let activeService, receiptDuet, receiptAtlas, receiptTea, receiptReel, receiptGraft, receiptBike, receiptGlow;
let receiptSun, receiptMate;
let receiptChairs;
let receiptFold, foldMate, foldSpread=true;
let sunSpread = true;
let active, board, chart, mask, path, history, sent, hint;
let frames = [], reading;
let compared = -1, justExposed = false;
let chapter = "coast";
let sending = false;
let viewed = 0;
let receiptWatch;
let receiptHill, hillGoal, hillOverlay, hillFull;
let tickets = new Map();
let exportVersion = 0;
let exportURL;

function delivered(index) {
  return bestFor(index) !== null || (letters[index].chapter === "together" && bestFor(index, "joint") !== null)
    || (index === pier && Boolean(fog.latest(difficulty)))
    || (index === slope && hillTickets(letters[slope], difficulty, read).size > 0)
    || (index === huts && Boolean(duet.record(difficulty)))
    || (index === bridge && Boolean(bikes.record(difficulty)))
    || (index === lighthouse && Boolean(glow.record(difficulty)))
    || (index === terrace && Boolean(sun.record(difficulty)))
    || (index === seawall && Boolean(chairs.record(difficulty)))
    || (index === lane && Boolean(folds.record(difficulty)))
    || (index === dome && Boolean(atlas.record(difficulty)))
    || (index === strait && Boolean(reel.record(difficulty)))
    || (index === greenhouse && Boolean(graft.record(difficulty)))
    || (index === sill && Boolean(sashes.record(difficulty)));
}
function hasImprint(index) { return read(routeKey(index, "imprint")) === true; }
const meetingStops = letters.map((letter, index) => ({letter, index})).filter(stop => stop.letter.chapter === "together");
function imprintCount() { return meetingStops.filter(stop => hasImprint(stop.index)).length; }
function savedCount() { return letters.filter((_, i) => delivered(i)).length; }

function updateCount() {
  byId("album-count").textContent = savedCount() + "/" + letters.length;
}

function saveDraft() {
  if (board.hill) {
    write(hillKey(difficulty, "draft"), { history: history.slice(), sent, goal: hillGoal, overlay: hillOverlay });
    return;
  }
  write(routeKey(active, "route", board.goal), { history: history.slice(), sent });
}

function turns() { return history.length - frames.length; }
function outOfTurns() { return board.budget !== null && turns() >= board.budget; }
function readyToSend() { return reading ? reading.complete : path.end === "ready"; }
function hillTargets() {
  return hillGoal ? [hillGoal] : board.hill.lines.filter(id => !tickets.has(id));
}
function nextAction() {
  if (board.hill) return hillHint(board, mask, hillTargets());
  return reading ? filmHint(board, mask, reading) : closestRoute(board, mask).next;
}

function statusText(advice) {
  if (board.hill && !sending) {
    if (hillFull) return t("hillFull");
    if (advice !== undefined && advice >= board.hill.fixed) {
      const action = ["hillFit", "hillFlip", "hillLift"][hillSetting(board, mask, advice)];
      return t(action, {cell: coordinate(board, board.mirrors[advice])});
    }
    if (advice !== undefined) return t("hintStatus", {cell: coordinate(board, board.mirrors[advice])});
    const trip = hillTrip(board, path);
    if (trip) return t(sent ? "hillSigned" : tickets.has(trip.id) ? "hillKnown" : "hillNew", {name: t("hillName_" + trip.id)});
  }
  if (board.film) {
    if (sending || sent) return t(sending ? "developing" : "printSent");
    const text = Number.isInteger(advice)
      ? t(difficulty === "relaxed" ? "guidedStatus" : "hintStatus", {cell: coordinate(board, board.mirrors[advice])})
      : filmStatus(board, path, reading, advice, outOfTurns(), t);
    return justExposed ? t("shotStored", {n: frames.length}) + " " + text : text;
  }
  if (sending) return t("busyStatus");
  if (sent) return t("deliveredStatus");
  if (path.end === "ready") {
    if (board.starSource === undefined) return t("readyStatus");
    return t(path.jointCount === 2 ? "imprintReady" : "pairReady");
  }
  if (outOfTurns()) return t("exhausted");
  if (advice !== undefined) return t(difficulty === "relaxed" ? "guidedStatus" : "hintStatus", {cell: coordinate(board, board.mirrors[advice])});
  if (path.wrongOrder) {
    return t("orderStatus", {actual: path.sequence.join(" → "), expected: board.sealOrder.join(" → ")});
  }
  if (difficulty === "expert" && !history.length) return t("budgetStart", {n: board.budget});
  if (board.starSource !== undefined) {
    if (path.end === "needsJoint") return t("needsJoint");
    if (path.rays.some(ray => ray.end === "wrongBox")) return t("wrongBoxStatus");
    if (board.goal === "joint") return t("jointStatus");
    if (path.matched === 1) return t("oneArrived", {ray: t(path.rays[0].end === "ready" ? "moonRay" : "starRay")});
    return t("dualStatus");
  }
  if (path.end === "missing") return t("missingStatus", {n: board.marks.length - path.lit.size});
  if (path.end === "blocked") return t("blockedStatus");
  if (path.end === "loop") return t("loopStatus");
  if (active === 0 && !history.length) return t("firstStatus");
  return t("seaStatus");
}

function render() {
  path = board.hill ? traceHill(board, mask) : trace(board, mask);
  reading = board.film ? readFilm(board, frames, mask) : null;
  const advice = difficulty === "relaxed" && !sent ? nextAction() : hint;
  chart.draw(path.mask ?? mask, path, advice, sending || sent || outOfTurns() || reading?.slots === 0);
  byId("moves").textContent = pad(turns());
  byId("budget").textContent = board.budget === null ? "" : " / " + pad(board.budget);
  byId("turn-counter").title = board.budget === null ? t("turns") : t("budgetAccess", {used: turns(), total: board.budget});
  const counter = byId("mark-count");
  counter.hidden = board.marks.length === 0;
  counter.textContent = t("stamps") + " " + (board.sealOrder.length
    ? board.sealOrder.map((_, i) => path.sequence[i] ?? "–").join("›")
    : path.lit.size + "/" + board.marks.length);
  counter.classList.toggle("wrong-order", path.wrongOrder);
  if (board.hill) {
    const stamps = [...path.lit].map(cell => coordinate(board, cell));
    counter.textContent = t("stamps") + " " + [stamps[0] || "–", stamps[1] || "–"].join(" › ");
    byId("hill-stock").textContent = t("hillStock", {n: board.hill.capacity - path.used, total: board.hill.capacity});
    const comparedTicket = tickets.get(hillOverlay);
    chart.compareRays(comparedTicket ? traceHill(board, comparedTicket.state).rays : []);
    drawHillBook(board, tickets, hillGoal, hillOverlay, t, sending);
    const trip = hillTrip(board, path);
    if (comparedTicket && trip) {
      const previous = comparedTicket.trip.cells;
      const at = trip.cells.findIndex((cell, i) => cell !== previous[i]);
      byId("hill-comparison").textContent += " · " + (at > 0 ? t("hillSplit", {cell: coordinate(board, trip.cells[at - 1])}) : t("hillSame"));
    }
    byId("hill-again").hidden = !sent || sending;
    byId("hill-read").hidden = !comparedTicket;
    byId("hill-read").disabled = byId("hill-wallet-link").disabled = byId("hill-return").disabled = sending;
  }
  if (reading) {
    counter.hidden = false;
    counter.textContent = t("filmCounter", {n: frames.length, total: board.film.frames});
    if (compared >= frames.length) compared = -1;
    showFilmTray(board, frames, reading, advice, sending || sent, compared, t);
    chart.compareExposure(compared >= 0 ? trace(board, frames[compared]) : null);
  }
  byId("status").textContent = statusText(advice);
  byId("status").parentElement.dataset.state = readyToSend() ? "ready" : advice !== undefined ? "hint" : reading ? "film" : path.end;
  byId("undo").disabled = byId("reset").disabled = !history.length || sending || sent;
  byId("hint").hidden = difficulty !== "standard";
  byId("hint").disabled = difficulty !== "standard" || readyToSend() || sending || sent;
  if (board.hill && difficulty === "standard" && !sending && !sent && readyToSend()) {
    const targets = hillTargets();
    byId("hint").disabled = !targets.length || targets.includes(hillTrip(board, path).id);
  }
  byId("send").disabled = sending || !(readyToSend() || reading?.canShoot);
  const paired = board.starSource !== undefined;
  const action = reading ? (reading.complete ? "develop" : "takeShot") : paired ? "pairSend" : "send";
  byId("send").querySelector("span").textContent = t(sending ? (reading ? "developing" : "sending") : sent ? "read" : action);
  byId("send").querySelector("use").setAttribute("href", reading && !reading.complete ? "#i-camera" : "#i-mail");
  if (paired) {
    for (const button of byId("goals").querySelectorAll("button")) {
      button.disabled = sending;
      button.setAttribute("aria-pressed", String(button.dataset.goal === board.goal));
    }
    byId("ray-key").querySelectorAll("button").forEach((button, i) => {
      const end = path.rays[i].end;
      button.querySelector("small").textContent = t(end === "ready" ? "arrived" : end === "wrongBox" ? "wrongBox" : "inTransit");
      button.title = t("focusRay", {ray: t(i === 0 ? "moonRay" : "starRay")});
      button.setAttribute("aria-pressed", String(byId("chart").dataset.focus === button.dataset.focus));
    });
    byId("joint-count").textContent = t("sealCount", {n: path.jointCount});
  }
  for (const id of ["open-album", "open-settings", "mode-open", "language-switch", "station-desk", "watch-enter", "hill-enter", "hill-normal", "duet-enter", "atlas-enter", "sash-enter", "reel-enter", "graft-enter", "bike-enter", "glow-enter", "sun-enter", "chair-enter", "fold-enter"]) byId(id).disabled = sending;
}

function openRoute(index, fresh = false, requestedGoal, service) {
  if (activeService === "fold") folds.leave();
  if (activeService === "chair") chairs.leave();
  if (activeService === "reel") reel.stop();
  if (activeService === "sashes") sashes.leave();
  if (activeService === "atlas") atlas.leave();
  if (activeService === "watch") fog.leave();
  if (activeService === "duet") duet.leave();
  active = index;
  const letter = letters[index];
  activeService = services[service]?.station === letter.id ? service : undefined;
  const hillside = activeService === "hill";
  const paired = letter.chapter === "together";
  const choice = requestedGoal ?? (paired ? read(routeKey(index, "goal")) : "direct");
  const goal = paired && choice === "joint" ? "joint" : "direct";
  board = hillside ? prepareHill(letter, difficulty) : letter.plate ? prepareFilm(letter, difficulty) : prepareRoute(letter, difficulty, goal);
  if (paired && !activeService) write(routeKey(index, "goal"), goal);
  const draft = fresh ? null : read(hillside ? hillKey(difficulty, "draft") : routeKey(index, "route", goal));
  const hillState = hillside ? restoreHill(board, draft?.history) : null;
  tickets = hillside ? hillTickets(letter, difficulty, read) : new Map();
  hillGoal = hillside && board.hill.lines.includes(draft?.goal) && !tickets.has(draft.goal) ? draft.goal : null;
  const compareId = fresh && hillside ? read(hillKey(difficulty, "last")) : draft?.overlay;
  hillOverlay = tickets.has(compareId) ? compareId : null;
  hillFull = false;
  const restored = board.film ? restoreFilm(board, draft?.history) : null;
  const valid = hillside ? hillState !== null : board.film ? !!restored : Array.isArray(draft?.history) && (board.budget === null || draft.history.length <= board.budget)
    && draft.history.every(i => Number.isInteger(i) && i >= 0 && i < board.mirrors.length);
  history = valid ? draft.history.slice() : [];
  mask = hillState ?? restored?.mask ?? history.reduce((state, i) => state ^ (1 << i), board.initial);
  frames = restored?.frames ?? [];
  compared = -1;
  justExposed = false;
  sent = valid && draft.sent === true && (hillside ? tickets.has(hillTrip(board, traceHill(board, mask))?.id)
    : bestFor(index, goal) !== null && (board.film ? isDevelopedFilm(board, frames) : trace(board, mask).end === "ready"));
  hint = undefined;
  sending = false;
  write("active", letter.id);
  delete byId("chart").dataset.focus;
  const fragment = location.hash.slice(1);
  const target = services[activeService]?.hash ?? letter.id;
  if (fragment !== target && (activeService || Object.values(services).some(link => link.hash === fragment) || letters.some(station => station.id === fragment))) {
    try { window.history.replaceState(null, "", "#" + target); } catch { /* Optional shortcut in local files. */ }
  }
  if (fresh) saveDraft();
  presentRoute();
}

function presentRoute() {
  const letter = localLetter(letters[active], language);
  const service = services[activeService];
  const onSashes = activeService === "sashes";
  const onAtlas = activeService === "atlas", onDuet = activeService === "duet", onWatch = activeService === "watch";
  byId("serial").textContent = "NO. " + pad(active + 1) + " / " + pad(letters.length);
  byId("scene").src = letter.image;
  byId("scene").alt = letter.artAlt;
  byId("station-title").textContent = letter.title;
  byId("place").textContent = letter.place;
  byId("time").textContent = letter.time;
  byId("brief").textContent = service ? t(activeService + "Brief") : difficulty === "expert" ? letter.expertNote : letter.brief;
  const chartPanel = document.querySelector(".chart-panel");
  const onFold = activeService==="fold";
  chartPanel.classList.toggle("on-fold",onFold);
  byId("fold-service").hidden=active!==lane;
  byId("fold-normal").setAttribute("aria-pressed",String(!onFold));
  byId("fold-enter").setAttribute("aria-pressed",String(onFold));
  for (const id of ["fold-head","fold-controls","fold-book","fold-paper"]) byId(id).hidden=!onFold;
  const onChairs = activeService === "chair";
  chartPanel.classList.toggle("on-chairs",onChairs);
  byId("chair-service").hidden = active !== seawall;
  byId("chair-normal").setAttribute("aria-pressed",String(!onChairs));
  byId("chair-enter").setAttribute("aria-pressed",String(onChairs));
  for (const id of ["chair-head","chair-controls","chair-book"]) byId(id).hidden = !onChairs;
  byId("chair-floor").toggleAttribute("hidden",!onChairs);
  byId("chair-motion").toggleAttribute("hidden",!onChairs);
  const onSun = activeService === "sun";
  chartPanel.classList.toggle("on-sun", onSun);
  byId("sun-service").hidden = active !== terrace;
  byId("sun-normal").setAttribute("aria-pressed", String(!onSun));
  byId("sun-enter").setAttribute("aria-pressed", String(onSun));
  for (const id of ["sun-head","sun-controls","sun-book","sun-paper"]) byId(id).hidden = !onSun;
  const onGlow = activeService === "glow";
  chartPanel.classList.toggle("on-glow", onGlow);
  byId("glow-service").hidden = active !== lighthouse;
  byId("glow-normal").setAttribute("aria-pressed", String(!onGlow));
  byId("glow-enter").setAttribute("aria-pressed", String(onGlow));
  for (const id of ["glow-head","glow-controls","glow-book"]) byId(id).hidden = !onGlow;
  byId("glow-overlay").toggleAttribute("hidden", !onGlow);
  const onBike = activeService === "bike";
  chartPanel.classList.toggle("on-bike", onBike);
  byId("bike-service").hidden = active !== bridge;
  byId("bike-enter").setAttribute("aria-pressed", String(onBike));
  byId("bike-normal").setAttribute("aria-pressed", String(!onBike));
  for (const id of ["bike-head","bike-controls","bike-book","bike-layer"]) byId(id).hidden = !onBike;
  const onGraft = activeService === "graft";
  chartPanel.classList.toggle("on-graft", onGraft);
  byId("graft-service").hidden = active !== greenhouse;
  byId("graft-enter").setAttribute("aria-pressed", String(onGraft));
  byId("graft-normal").setAttribute("aria-pressed", String(!onGraft));
  for (const id of ["graft-head", "graft-controls", "graft-book"]) byId(id).hidden = !onGraft;
  byId("graft-stems").toggleAttribute("hidden", !onGraft);
  const onReel = activeService === "reel";
  chartPanel.classList.toggle("on-reel", onReel);
  byId("reel-service").hidden = active !== strait;
  byId("reel-enter").setAttribute("aria-pressed", String(onReel));
  byId("reel-normal").setAttribute("aria-pressed", String(!onReel));
  for (const id of ["reel-head", "reel-controls", "reel-book", "reel-meters"]) byId(id).hidden = !onReel;
  byId("reel-soundings").toggleAttribute("hidden", !onReel);
  chartPanel.classList.toggle("on-sashes", onSashes);
  byId("sash-service").hidden = active !== sill;
  byId("sash-enter").setAttribute("aria-pressed",String(onSashes));
  byId("sash-normal").setAttribute("aria-pressed",String(!onSashes));
  for (const id of ["sash-head","sash-controls","sash-book"]) byId(id).hidden = !onSashes;
  byId("sash-rails").toggleAttribute("hidden",!onSashes);
  chartPanel.classList.toggle("on-watch", onWatch);
  chartPanel.classList.toggle("on-duet", onDuet);
  chartPanel.classList.toggle("on-atlas", onAtlas);
  byId("atlas-service").hidden = active !== dome;
  byId("atlas-enter").setAttribute("aria-pressed", String(onAtlas));
  byId("atlas-normal").setAttribute("aria-pressed", String(!onAtlas));
  for (const id of ["atlas-head", "atlas-controls", "atlas-book"]) byId(id).hidden = !onAtlas;
  byId("duet-service").hidden = active !== huts;
  byId("duet-enter").setAttribute("aria-pressed", String(onDuet));
  byId("duet-normal").setAttribute("aria-pressed", String(!onDuet));
  for (const id of ["duet-head", "duet-controls", "duet-book"]) byId(id).hidden = !onDuet;
  chartPanel.classList.toggle("on-hill", Boolean(board.hill));
  byId("hill-switch").hidden = active !== slope;
  byId("hill-normal").setAttribute("aria-pressed", String(!board.hill));
  byId("hill-enter").setAttribute("aria-pressed", String(Boolean(board.hill)));
  byId("hill-tray").hidden = byId("hill-book").hidden = !board.hill;
  byId("watch-switch").hidden = active !== pier;
  byId("watch-normal").setAttribute("aria-pressed", String(!onWatch));
  byId("watch-enter").setAttribute("aria-pressed", String(onWatch));
  for (const id of ["watch-head", "watch-panel", "watch-book"]) byId(id).hidden = !onWatch;
  byId("guide").hidden = Boolean(service);
  byId("chart").setAttribute("aria-label", t(service?.access ?? "chartAccess"));
  byId("mode-label").textContent = t(difficulty);
  byId("mode-open").setAttribute("aria-label", t("modeControl", { mode: t(difficulty) }));
  byId("station-desk").hidden = !dispatchStations.includes(letter.id);
  const paired = board.starSource !== undefined;
  const film = Boolean(board.film) && !service;
  byId("goals").hidden = byId("ray-key").hidden = !paired || onDuet || onBike;
  byId("film-tray").hidden = !film;
  byId("send").classList.remove("suggested");
  byId("chart-title").querySelector("span").textContent = t(service?.map ?? (film ? "filmChart" : "chart"));
  byId("chart-title").querySelector("use").setAttribute("href", service?.icon ?? (film ? "#i-camera" : "#i-compass"));
  document.querySelector(".chart-panel").classList.toggle("darkroom-chart", film);
  for (const key of document.querySelectorAll(".bay-symbol")) key.hidden = !paired;
  for (const key of document.querySelectorAll(".single-symbol")) key.hidden = paired || film;
  for (const key of document.querySelectorAll(".film-symbol")) key.hidden = !film;
  byId("guide-instructions").textContent = t(film ? "filmGuide" : paired ? "pairInstructions" : "instructions");
  if (onFold) folds.mount(difficulty,t);
  else if (onChairs) chairs.mount(difficulty,t);
  else if (onSun) sun.mount(difficulty, t);
  else if (onGlow) glow.mount(difficulty, t);
  else if (onBike) bikes.mount(difficulty, t);
  else if (onGraft) graft.mount(difficulty, t);
  else if (onReel) reel.mount(difficulty, t);
  else if (onSashes) sashes.mount(difficulty, t);
  else if (onAtlas) atlas.mount(difficulty, t);
  else if (onDuet) duet.mount(difficulty, t);
  else if (onWatch) fog.mount(difficulty, t);
  else {
    chart = mountChart(board, rotate, t);
    render();
  }
  updateCount();
}

function rotate(index) {
  if (sending || sent || outOfTurns() || reading?.slots === 0) return;
  const previous = path;
  const wasShootable = reading?.canShoot;
  const next = board.hill ? moveHill(board, mask, index) : mask ^ (1 << index);
  if (next === null) {
    hillFull = true;
    cue("limit");
    render();
    return;
  }
  hillFull = false;
  cue(board.hill && index >= board.hill.fixed ? "switchRail" : "turn");
  history.push(index);
  mask = next;
  justExposed = false;
  hint = undefined;
  saveDraft();
  render();
  if (reading) {
    if (reading.canShoot && !wasShootable) sound.play("focus");
    else if (outOfTurns() && !reading.canShoot) sound.play("limit");
    return;
  }
  const stampedTogether = path.jointCount === 2 && previous.jointCount !== 2;
  if (stampedTogether) sound.play("joint");
  else if ([...path.lit].some(cell => !previous.lit.has(cell))) sound.play("stamp");
  else if (path.rays.some((ray, i) => ray.lines.length > previous.rays[i].lines.length)) sound.play("tide");
  if (path.end === "ready" && previous.end !== "ready" && !stampedTogether) sound.play("ready");
  else if (outOfTurns() && path.end !== "ready") sound.play("limit");
}

function undoAction() {
  justExposed = false;
  hillFull = false;
  const action = history.pop();
  if (action === shutter) frames.pop();
  else if (board.hill) mask = moveHill(board, mask, action, true);
  else mask ^= 1 << action;
}

byId("undo").addEventListener("click", () => {
  if (!history.length || sending || sent) return;
  cue("undo");
  undoAction();
  hint = undefined;
  saveDraft();
  render();
});
byId("rewind-film").addEventListener("click", () => {
  if (!frames.length || sending || sent) return;
  const last = history.lastIndexOf(shutter);
  cue("undo");
  while (history.length > last) undoAction();
  hint = undefined;
  saveDraft();
  render();
});
byId("film-log").addEventListener("click", event => {
  const toggle = event.target.closest("button[data-frame]");
  if (!toggle || sending) return;
  const index = Number(toggle.dataset.frame);
  compared = compared === index ? -1 : index;
  render();
  byId("film-log").querySelector('[data-frame="' + index + '"]').focus({preventScroll: true});
});
byId("reset").addEventListener("click", () => {
  cue("reset");
  if (board.hill) {
    mask = board.initial;
    history = [];
    hint = undefined;
    hillFull = false;
    saveDraft();
    render();
  } else openRoute(active, true);
});
for (const button of byId("goals").querySelectorAll("button")) {
  button.addEventListener("click", () => {
    if (sending || button.dataset.goal === board.goal) return;
    cue("paper");
    openRoute(active, false, button.dataset.goal);
  });
}
for (const button of byId("ray-key").querySelectorAll("button")) {
  button.addEventListener("click", () => {
    const chartElement = byId("chart");
    const focus = button.dataset.focus;
    if (chartElement.dataset.focus === focus) delete chartElement.dataset.focus;
    else chartElement.dataset.focus = focus;
    for (const toggle of byId("ray-key").querySelectorAll("button")) {
      toggle.setAttribute("aria-pressed", String(toggle.dataset.focus === chartElement.dataset.focus));
    }
  });
}
byId("hint").addEventListener("click", () => {
  if (difficulty !== "standard") return;
  cue("hint");
  hillFull = false;
  justExposed = false;
  hint = nextAction();
  render();
  if (Number.isInteger(hint)) byId("tiles").querySelector('[data-mirror="' + hint + '"]').focus({ preventScroll: true });
  if (hint === shutter || hint === "rewind") byId(hint === shutter ? "send" : "rewind-film").focus({ preventScroll: true });
});

byId("send").addEventListener("click", async () => {
  if (sending) return;
  if (reading && !reading.complete) {
    if (!reading.canShoot || sent) return;
    cue(shutter);
    frames.push(mask);
    justExposed = true;
    history.push(shutter);
    hint = undefined;
    saveDraft();
    render();
    return;
  }
  if (!readyToSend()) return;
  const firstDelivery = !sent;
  if (firstDelivery) {
    sending = true;
    sent = true;
    cue(reading ? "develop" : "depart");
    if (reading) write(routeKey(active, "print"), frames.slice());
    if (board.hill) {
      const trip = hillTrip(board, path);
      hint = undefined;
      hillFull = false;
      write(hillKey(difficulty, trip.id), mask);
      write(hillKey(difficulty, "last"), trip.id);
      tickets = hillTickets(letters[slope], difficulty, read);
      if (hillGoal === trip.id) hillGoal = null;
    } else write(routeKey(active, "best", board.goal), Math.min(bestFor(active, board.goal) ?? Infinity, turns()));
    if (path.jointCount === 2) write(routeKey(active, "imprint"), true);
    saveDraft();
    updateCount();
    render();
    try {
      if (reading) await developPrint();
      else await chart.carryLetter();
    } catch {
      // A browser without SVG path measurement can still open the delivered letter.
    } finally {
      sending = false;
      render();
    }
    if (!document.hidden) sound.play(board.hill ? "punchTicket" : "sent");
  }
  showReceipt(active, !firstDelivery, board.hill ? hillTrip(board, path).id : [slope,huts,dome,sill,strait,greenhouse,bridge,lighthouse,terrace,seawall,lane].includes(active) ? null : undefined);
});

function fillAlbum() {
  byId("album-fold").hidden = chapter !== letters[lane].chapter;
  byId("album-chairs").hidden = chapter !== letters[seawall].chapter;
  byId("album-sun").hidden = chapter !== letters[terrace].chapter;
  byId("album-glow").hidden = chapter !== letters[lighthouse].chapter;
  byId("album-bike").hidden = chapter !== letters[bridge].chapter;
  byId("album-graft").hidden = chapter !== letters[greenhouse].chapter;
  byId("album-reel").hidden = chapter !== letters[strait].chapter;
  byId("album-sash").hidden = chapter !== "coast";
  byId("album-atlas").hidden = chapter !== "replies";
  byId("album-duet").hidden = chapter !== "together";
  byId("album-watch").hidden = chapter !== "replies";
  byId("album-hill").hidden = chapter !== "coast";
  const count = savedCount();
  byId("album-summary").textContent = t(count === letters.length ? "albumComplete" : "albumSummary", {mode: t(difficulty), done: count, total: letters.length});
  for (const tab of byId("chapters").querySelectorAll("button")) tab.setAttribute("aria-pressed", String(tab.dataset.chapter === chapter));
  const cards = [];
  letters.forEach((station, index) => {
    if (station.chapter !== chapter) return;
    const letter = localLetter(station, language);
    const best = bestFor(index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "album-item";
    button.dataset.station = letter.id;
    const wasDelivered = delivered(index);
    button.dataset.delivered = wasDelivered;
    const image = new Image(625, 415);
    image.src = letter.image;
    image.alt = "";
    const title = document.createElement("strong");
    title.textContent = pad(index + 1) + " · " + letter.title;
    const status = document.createElement("small");
    status.textContent = best !== null ? t(best === 1 ? "albumBestOne" : "albumBest", {n: best}) : t(active === index ? "inProgress" : "visit");
    if (index === pier && wasDelivered && best === null) status.textContent = t("watchDelivered");
    if (index === dome && wasDelivered && best === null) status.textContent = t("atlasFiled");
    if (index === sill && wasDelivered && best === null) status.textContent = t("sashPosted");
    if (index === strait && wasDelivered && best === null) status.textContent = t("reelPosted");
    if (index === greenhouse && wasDelivered && best === null) status.textContent = t("graftFiled");
    if (index === lighthouse && wasDelivered && best === null) status.textContent = t("glowFiled");
    if (index === terrace && wasDelivered && best === null) status.textContent = t("sunFiled");
    if (index === seawall && wasDelivered && best === null) status.textContent = t("chairFiled");
    if (index === lane && wasDelivered && best === null) status.textContent=t("foldFiled");
    if (index === slope && wasDelivered && best === null) status.textContent = t("hillFiled", {n: hillTickets(station, difficulty, read).size, total: 4});
    button.append(image, title, status);
    if (station.chapter === "together") {
      const jointBest = bestFor(index, "joint");
      if (wasDelivered) {
        const scores = [];
        if (best !== null) scores.push(t("goalBest", {goal: t("direct"), n: best}));
        if (jointBest !== null) scores.push(t("goalBest", {goal: t("joint"), n: jointBest}));
        status.textContent = scores.length ? scores.join(" / ") : t(index === bridge ? "bikeTitle" : "duetTitle");
      }
      const seal = document.createElement("small");
      seal.className = "imprint-state";
      seal.dataset.collected = hasImprint(index);
      seal.textContent = "◇ " + t(hasImprint(index) ? "imprintCollected" : "imprintOpen");
      button.append(seal);
    }
    button.addEventListener("click", () => {
      album.close();
      if (wasDelivered) showReceipt(index);
      else goTo(index);
    });
    cards.push(button);
  });
  byId("album-grid").replaceChildren(...cards);
  byId("appointment").hidden = chapter !== "together";
  if (chapter === "together") {
    const together = meetingStops.length;
    const imprints = imprintCount();
    byId("ticket-pieces").replaceChildren(...meetingStops.map(({letter, index}) => {
      const piece = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      const collected = hasImprint(index);
      piece.dataset.open = String(collected);
      term.textContent = t(letter.clueLabel);
      detail.textContent = collected ? localLetter(letter, language).clue : t("folded");
      piece.append(term, detail);
      return piece;
    }));
    byId("appointment-count").textContent = t("collected", {n: imprints, total: together});
    byId("appointment-text").textContent = t(imprints === together ? "appointmentOpen" : "appointmentLocked");
    byId("appointment").dataset.open = String(imprints === together);
  }
}

function showAlbum(selectedChapter = letters[active].chapter) {
  if (activeService === "reel") reel.stop();
  if (activeService === "duet") duet.stop();
  chapter = selectedChapter;
  cue("paper");
  fillAlbum();
  album.showModal();
}
byId("open-album").addEventListener("click", () => showAlbum());
function openChairs(token) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  openRoute(seawall,false,undefined,"chair");
  if (token) chairs.branch(token);
  else { cue("paper"); byId("chair-intro").focus({preventScroll:true}); byId("chair-head").scrollIntoView({block:"nearest"}); }
}
function openFolds(code) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  openRoute(lane,false,undefined,"fold");
  if (code) folds.branch(code);
  else {cue("paper");byId("fold-intro").focus({preventScroll:true});byId("fold-head").scrollIntoView({block:"nearest"});}
}
byId("fold-enter").addEventListener("click",()=>{if(!sending && activeService!=="fold") openFolds();});
byId("fold-normal").addEventListener("click",()=>{if(activeService==="fold") {cue("paper");openRoute(lane);}});
byId("album-fold").addEventListener("click",()=>openFolds());
byId("receipt-fold").addEventListener("click",()=>openFolds(receiptFold?.code));
byId("chair-enter").addEventListener("click", () => { if (!sending && activeService!=="chair") openChairs(); });
byId("chair-normal").addEventListener("click", () => { if (activeService==="chair") { cue("paper"); openRoute(seawall); } });
byId("album-chairs").addEventListener("click", () => openChairs());
byId("receipt-chairs").addEventListener("click", () => openChairs(receiptChairs && rollToken(receiptChairs)));
function openSun(id) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  openRoute(terrace,false,undefined,"sun");
  if (id) sun.branch(id);
  else { cue("paper"); byId("sun-intro").focus({preventScroll:true}); byId("sun-head").scrollIntoView({block:"nearest"}); }
}
byId("sun-enter").addEventListener("click", () => { if (!sending && activeService!=="sun") openSun(); });
byId("sun-normal").addEventListener("click", () => { if (activeService==="sun") { cue("paper"); openRoute(terrace); } });
byId("album-sun").addEventListener("click", () => openSun());
byId("receipt-sun").addEventListener("click", () => openSun(receiptSun?.id));
function openGlow(code) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  openRoute(lighthouse,false,undefined,"glow");
  if (code) glow.another(code);
  else {
    cue("paper"); byId("glow-intro").focus({preventScroll:true});
    byId("glow-head").scrollIntoView({block:"nearest"});
  }
}
byId("glow-enter").addEventListener("click", () => { if (!sending && activeService!=="glow") openGlow(); });
byId("glow-normal").addEventListener("click", () => { if (activeService==="glow") { cue("paper"); openRoute(lighthouse); } });
byId("album-glow").addEventListener("click", () => openGlow());
byId("receipt-glow").addEventListener("click", () => openGlow(receiptGlow?.code));
function openBikes(code) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  openRoute(bridge, false, undefined, "bike");
  if (code) bikes.another(code);
  else {
    cue("paper"); byId("bike-intro").focus({preventScroll:true});
    byId("bike-head").scrollIntoView({block:"nearest"});
  }
}
byId("bike-enter").addEventListener("click", () => { if (!sending && activeService !== "bike") openBikes(); });
byId("bike-normal").addEventListener("click", () => { if (activeService === "bike") { cue("paper"); openRoute(bridge); } });
byId("album-bike").addEventListener("click", () => openBikes());
byId("receipt-bike").addEventListener("click", () => openBikes(receiptBike?.code));
function openGraft(id) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  openRoute(greenhouse, false, undefined, "graft");
  if (id) graft.keepCutting(id);
  else {
    cue("paper");
    byId("graft-instruction").focus({preventScroll:true});
    byId("graft-head").scrollIntoView({block:"nearest"});
  }
}
byId("graft-enter").addEventListener("click", () => { if (!sending && activeService !== "graft") openGraft(); });
byId("graft-normal").addEventListener("click", () => { if (activeService === "graft") { cue("paper"); openRoute(greenhouse); } });
byId("album-graft").addEventListener("click", () => openGraft());
byId("receipt-graft").addEventListener("click", () => openGraft(receiptGraft?.id));
function openReel(id) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  cue("paper");
  openRoute(strait, false, undefined, "reel");
  if (id) reel.rework(id);
  byId("reel-tape").querySelector('[aria-pressed="true"]').focus({preventScroll: true});
  byId("reel-head").scrollIntoView({block: "nearest"});
}
byId("reel-enter").addEventListener("click", () => { if (activeService !== "reel" && !sending) openReel(); });
byId("reel-normal").addEventListener("click", () => { if (activeService === "reel") { cue("paper"); openRoute(strait); } });
byId("album-reel").addEventListener("click", () => openReel());
byId("receipt-reel").addEventListener("click", () => openReel(receiptReel?.id));
function openSashes(reference) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  cue("paper");
  openRoute(sill,false,undefined,"sashes");
  if (reference && read(sashKey(difficulty,"draft"))?.sent === true) sashes.fresh(reference);
  byId("sash-head").querySelector("button:not(:disabled)")?.focus({preventScroll:true});
  byId("sash-head").scrollIntoView({block:"nearest"});
}
byId("sash-enter").addEventListener("click", () => { if (activeService !== "sashes" && !sending) openSashes(); });
byId("sash-normal").addEventListener("click", () => { if (activeService === "sashes") { cue("paper"); openRoute(sill); } });
byId("album-sash").addEventListener("click", () => openSashes());
byId("receipt-sash").addEventListener("click", () => openSashes(receiptTea?.trip.id));
function openAtlas(reference, branch = false) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  cue("paper");
  openRoute(dome, false, undefined, "atlas");
  if (branch) atlas.branch(reference);
  else if (reference && read(atlasKey(difficulty, "draft"))?.sent === true) atlas.fresh(reference);
  byId("chart").focus({preventScroll:true});
  byId("atlas-head").scrollIntoView({block:"nearest"});
}
byId("atlas-enter").addEventListener("click", () => { if (activeService !== "atlas" && !sending) openAtlas(); });
byId("atlas-normal").addEventListener("click", () => { if (activeService === "atlas") { cue("paper"); openRoute(dome); } });
byId("album-atlas").addEventListener("click", () => openAtlas());
byId("receipt-atlas").addEventListener("click", () => openAtlas(receiptAtlas?.sketch.ink));
byId("receipt-atlas-fork").addEventListener("click", () => openAtlas(receiptAtlas?.sketch.ink, true));
function openDuet(restart = false) {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  cue("paper");
  openRoute(huts, false, undefined, "duet");
  if (restart) duet.fresh();
  byId("duet-phase").scrollIntoView({block: "nearest"});
  (byId("tiles").querySelector("button:not(:disabled)") || byId("duet-main")).focus({preventScroll:true});
}
byId("duet-enter").addEventListener("click", () => { if (activeService !== "duet" && !sending) openDuet(); });
byId("duet-normal").addEventListener("click", () => { if (activeService === "duet") { cue("paper"); openRoute(huts); } });
byId("album-duet").addEventListener("click", () => openDuet());
byId("receipt-duet").addEventListener("click", () => openDuet(read(duetKey(difficulty, "draft"))?.sent === true));
function openWatchFromBook() {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  cue("paper");
  openRoute(pier, false, undefined, "watch");
  byId("watch-shift").focus();
}
byId("album-watch").addEventListener("click", openWatchFromBook);
byId("receipt-watch").addEventListener("click", openWatchFromBook);
byId("watch-enter").addEventListener("click", () => { if (activeService !== "watch" && !sending) { cue("paper"); openRoute(pier, false, undefined, "watch"); } });
byId("watch-normal").addEventListener("click", () => { if (activeService === "watch") { cue("paper"); openRoute(pier); } });
function openHill(fresh = false) {
  if (receipt.open) receipt.close();
  if (album.open) album.close();
  cue("paper");
  openRoute(slope, fresh, undefined, "hill");
  focusHillChart();
}
function focusHillChart() {
  const first = byId("tiles").querySelector("button:not(:disabled)") || byId("send");
  first.focus({ preventScroll: true });
  if (matchMedia("(max-width: 680px)").matches) document.querySelector(".chart-head").scrollIntoView({block: "start"});
}
byId("hill-wallet-link").addEventListener("click", () => {
  byId("hill-lines").querySelector("button").focus({preventScroll: true});
  byId("hill-book").scrollIntoView({block: "start"});
});
byId("hill-return").addEventListener("click", focusHillChart);
byId("hill-read").addEventListener("click", () => { if (tickets.has(hillOverlay)) showReceipt(slope, true, hillOverlay); });
byId("hill-enter").addEventListener("click", () => { if (!board.hill && !sending) openHill(); });
byId("hill-normal").addEventListener("click", () => { if (board.hill && !sending) { cue("paper"); openRoute(slope); } });
byId("album-hill").addEventListener("click", () => openHill());
byId("receipt-hill").addEventListener("click", () => openHill(read(hillKey(difficulty, "draft"))?.sent === true));
byId("hill-again").addEventListener("click", () => openHill(true));
byId("hill-lines").addEventListener("click", event => {
  const id = event.target.closest("button[data-line]")?.dataset.line;
  if (!board.hill || !board.hill.lines.includes(id) || sending) return;
  if (tickets.has(id)) hillOverlay = hillOverlay === id ? null : id;
  else {
    if (sent) openRoute(slope, true, undefined, "hill");
    hillGoal = hillGoal === id ? null : id;
  }
  hint = undefined;
  hillFull = false;
  cue("paper");
  saveDraft();
  render();
});
byId("station-desk").addEventListener("click", () => { cue("paper"); dispatchDesk.open(letters[active].id); });
byId("receipt-desk").addEventListener("click", () => { cue("paper"); dispatchDesk.open(letters[viewed].id); });
byId("album-desk").addEventListener("click", () => { cue("paper"); dispatchDesk.open(); });
for (const tab of byId("chapters").querySelectorAll("button")) {
  tab.addEventListener("click", () => { chapter = tab.dataset.chapter; cue("paper"); fillAlbum(); });
}

function goTo(index, fresh = false, goal) {
  if (receipt.open) receipt.close();
  openRoute(index, fresh, goal);
  window.scrollTo(0, 0);
  const first = byId("tiles").querySelector("button:not(:disabled)") || byId("send");
  first.focus({ preventScroll: true });
}

function clearExport() {
  exportVersion++;
  byId("export-status").textContent = "";
  byId("export-link").hidden = true;
  byId("save-image").disabled = false;
  if (exportURL) {
    URL.revokeObjectURL(exportURL);
    exportURL = undefined;
  }
}

function setEditing(value) {
  byId("fold-story").hidden=value || !receiptFold;
  byId("fold-pair").hidden=value || !foldMate;
  byId("receipt-fold").hidden=value || viewed!==lane;
  byId("chair-story").hidden = value || !receiptChairs;
  byId("receipt-chairs").hidden = value || viewed !== seawall;
  byId("sun-story").hidden = value || !receiptSun;
  byId("sun-spread").hidden = value || !receiptMate;
  byId("receipt-sun").hidden = value || viewed !== terrace;
  byId("glow-story").hidden = value || !receiptGlow;
  byId("receipt-glow").hidden = value || viewed !== lighthouse;
  byId("bike-story").hidden = value || !receiptBike;
  byId("receipt-bike").hidden = value || viewed !== bridge;
  byId("graft-slip").hidden = value || !receiptGraft;
  byId("receipt-graft").hidden = value || viewed !== greenhouse;
  byId("reel-slip").hidden = value || !receiptReel;
  byId("receipt-reel").hidden = value || viewed !== strait;
  byId("sash-slip").hidden = value || !receiptTea;
  byId("receipt-sash").hidden = value || viewed !== sill;
  byId("atlas-slip").hidden = value || !receiptAtlas;
  byId("receipt-atlas").hidden = value || viewed !== dome;
  const forkCell = receiptAtlas && atlas.forkCell(difficulty, receiptAtlas.sketch.ink);
  byId("receipt-atlas-fork").hidden = value || !forkCell;
  if (forkCell) byId("receipt-atlas-fork").querySelector("span").textContent = t("atlasFork", {cell: forkCell});
  byId("duet-slip").hidden = value || !receiptDuet;
  byId("receipt-duet").hidden = value || viewed !== huts;
  byId("editor").hidden = !value;
  byId("receipt-watch").hidden = value || viewed !== pier;
  byId("watch-slip").hidden = value || !receiptWatch;
  byId("receipt-hill").hidden = value || viewed !== slope;
  byId("hill-slip").hidden = value || !receiptHill;
  byId("receipt-desk").hidden = value || !dispatchStations.includes(letters[viewed].id);
  byId("letter-text").hidden = value;
  byId("postscript").hidden = value || Boolean(receiptDuet || receiptBike) || letters[viewed].chapter !== "together";
  byId("film-proof").hidden = value || !byId("contact-sheet").firstElementChild;
  byId("edit-message").parentElement.hidden = value;
  byId("next").parentElement.hidden = value;
  if (value) {
    byId("message").value = messageFor(viewed);
    byId("message").focus();
  }
}

function proofTitle() {
  if (receiptFold) return "foldProof";
  return receiptChairs ? "chairProof" : receiptSun ? "sunProof" : receiptGlow ? "glowProof" : receiptBike ? "bikeProof" : receiptGraft ? "graftProof" : receiptReel ? "reelProof" : receiptTea ? "sashProof" : receiptAtlas ? "atlasProof" : "contactTitle";
}

function drawFoldReceipt() {
  const desk=rainDesk(letters[lane],difficulty);
  byId("fold-story").textContent=t("foldStory"+shadeAt(receiptFold,desk.watch));
  byId("fold-pair").textContent=t(foldSpread ? "foldSeparate" : "foldTogether");
  byId("contact-sheet").replaceChildren(rainProof(desk,receiptFold,foldSpread ? foldMate : null,t));
}
byId("fold-pair").addEventListener("click",()=>{
  if (!foldMate) return;
  foldSpread=!foldSpread;clearExport();drawFoldReceipt();cue("paper");
});

function drawSunReceipt() {
  const mate = sunSpread ? receiptMate : null;
  byId("sun-story").textContent = t("sunStory_"+(mate ? "pair" : receiptSun.page));
  byId("sun-spread").textContent = t(mate ? "sunSeparate" : "sunBind");
  byId("contact-sheet").replaceChildren(sunProof(dryingRack(letters[terrace],difficulty),receiptSun,mate,t));
}
byId("sun-spread").addEventListener("click", () => {
  if (!receiptMate) return;
  sunSpread = !sunSpread; clearExport(); drawSunReceipt(); cue("paper");
});

function showReceipt(index, rustle = true, record) {
  viewed = index;
  const previousFold=receiptFold;
  receiptFold=index===lane && record!==null && (record!==undefined || bestFor(lane)===null) ? folds.record(difficulty,record) : null;
  foldMate=receiptFold ? folds.mate(difficulty,receiptFold) : null;
  if (!receipt.open || receiptFold!==previousFold) foldSpread=true;
  receiptChairs = index===seawall && record!==null && (record!==undefined || bestFor(seawall)===null) ? chairs.record(difficulty,record) : null;
  const previousSun = receiptSun;
  receiptSun = index === terrace && record !== null && (record !== undefined || bestFor(terrace) === null) ? sun.record(difficulty,record) : null;
  if (!receipt.open || previousSun !== receiptSun) sunSpread = true;
  receiptMate = receiptSun ? sun.mate(difficulty,receiptSun) : null;
  receiptGlow = index === lighthouse && record !== null && (record !== undefined || bestFor(lighthouse) === null) ? glow.record(difficulty,record) : null;
  const onlyBikes = index === bridge && bestFor(bridge) === null && bestFor(bridge, "joint") === null && !hasImprint(bridge);
  receiptBike = index === bridge && record !== null && (record !== undefined || onlyBikes) ? bikes.record(difficulty, record) : null;
  receiptGraft = index === greenhouse && record !== null && (record !== undefined || bestFor(greenhouse) === null) ? graft.record(difficulty, record) : null;
  if (activeService === "reel") reel.stop();
  receiptReel = index === strait && record !== null && (record !== undefined || bestFor(strait) === null) ? reel.record(difficulty, record) : null;
  receiptTea = index === sill && record !== null && (record !== undefined || bestFor(sill) === null) ? sashes.record(difficulty,record) : null;
  receiptAtlas = index === dome && record !== null && (record !== undefined || bestFor(dome) === null) ? atlas.record(difficulty, record) : null;
  if (activeService === "duet") duet.stop();
  receiptDuet = null;
  if (index === huts && record !== null) {
    const onlyDuet = bestFor(huts) === null && bestFor(huts, "joint") === null && !hasImprint(huts);
    if (record !== undefined || onlyDuet) receiptDuet = duet.record(difficulty, record);
  }
  receiptWatch = index === pier ? record ?? fog.latest(difficulty) : null;
  receiptHill = index === slope && record !== null ? hillTickets(letters[slope], difficulty, read).get(record ?? read(hillKey(difficulty, "last"))) : null;
  const letter = localLetter(letters[index], language);
  if (rustle) cue("paper");
  clearExport();
  setEditing(false);
  byId("receipt-meta").textContent = "NO. " + pad(index + 1) + "  /  " + letter.place + " · " + letter.time;
  byId("receipt-image").src = letter.image;
  byId("receipt-image").alt = letter.artAlt;
  byId("receipt-title").textContent = letter.title;
  byId("letter-text").textContent = messageFor(index);
  if (index===lane) byId("receipt-fold").querySelector("span").textContent=t(receiptFold ? "foldBranch" : "foldTitle");
  if (index===seawall) {
    byId("receipt-chairs").querySelector("span").textContent=t(receiptChairs ? "chairBranch" : "chairTitle");
    if (receiptChairs) byId("chair-story").textContent=t("chairStory_"+portraitStyle(receiptChairs));
  }
  if (index === terrace) {
    byId("receipt-sun").querySelector("span").textContent = t(receiptSun ? "sunFork" : "sunTitle");
  }
  if (index === lighthouse) {
    byId("receipt-glow").querySelector("span").textContent = t(receiptGlow ? "glowAgain" : "glowTitle");
    if (receiptGlow) byId("glow-story").textContent = t("glowStory_"+receiptGlow.style);
  }
  if (index === bridge) {
    byId("receipt-bike").querySelector("span").textContent = t(receiptBike ? "bikeAgain" : "bikeTitle");
    if (receiptBike) byId("bike-story").textContent = t("bikeStory_" + receiptBike.style);
  }
  if (index === greenhouse) {
    byId("receipt-graft").querySelector("span").textContent = t(receiptGraft ? "graftAgain" : read(graftKey(difficulty, "draft")) ? "graftResume" : "graftTitle");
    if (receiptGraft) byId("graft-slip").textContent = t("graftStory_" + receiptGraft.kind);
  }
  if (index === strait) {
    byId("receipt-reel").querySelector("span").textContent = t(receiptReel ? "reelRework" : read(reelKey(difficulty, "draft")) ? "reelResume" : "reelTitle");
    if (receiptReel) byId("reel-slip").textContent = t("reelStory_" + receiptReel.coast);
  }
  if (index === sill) {
    const draft = read(sashKey(difficulty,"draft"));
    byId("receipt-sash").querySelector("span").textContent = t(!receiptTea ? "sashTitle" : draft && !draft.sent ? "sashResume" : "sashAgain");
    if (receiptTea) byId("sash-slip").textContent = teaStory(receiptTea,t);
  }
  if (index === dome) {
    const draft = read(atlasKey(difficulty, "draft"));
    byId("receipt-atlas").querySelector("span").textContent = t(receiptAtlas ? draft?.ink && !draft.sent ? "atlasResume" : "atlasAgain" : "atlasTitle");
    if (receiptAtlas) byId("atlas-slip").textContent = atlasStory(receiptAtlas, t);
  }
  if (receiptDuet) {
    const slip = byId("duet-slip");
    slip.querySelector("strong").textContent = t("duetName_" + receiptDuet.id);
    slip.querySelector("p").textContent = t("duetStory_" + receiptDuet.id);
    slip.querySelector("span").textContent = duetSummary(receiptDuet.score, t);
  }
  if (index === slope) {
    byId("receipt-hill").querySelector("span").textContent = t(receiptHill ? read(hillKey(difficulty, "draft"))?.sent === true ? "hillAgain" : "hillBack" : "hillOpen");
    if (receiptHill) drawHillSlip(prepareHill(letters[slope], difficulty), receiptHill.trip, t);
  }
  if (receiptWatch) {
    byId("watch-slip").querySelector("p").textContent = t("watchStory");
    byId("watch-slip").querySelector("small").textContent = watchSlip(t, receiptWatch.shift, receiptWatch);
  }
  const proof = byId("contact-sheet");
  proof.replaceChildren();
  byId("film-proof").querySelector("figcaption").textContent = t(proofTitle());
  if (receiptFold) drawFoldReceipt();
  if (receiptChairs) proof.append(contactPrint(chairStudio(letters[seawall],difficulty),receiptChairs,letters[seawall].image,t));
  if (receiptSun) drawSunReceipt();
  if (receiptGlow) proof.append(glowPrint(lightStation(letters[lighthouse],difficulty),receiptGlow,t));
  if (receiptBike) proof.append(ridePrint(bellCourse(letters[bridge],difficulty).board, receiptBike, t));
  if (receiptGraft) proof.append(pressPrint(glassGarden(letters[greenhouse],difficulty).board, receiptGraft, t));
  if (receiptReel) proof.append(reelPrint(tideCourse(letters[strait], difficulty).board, receiptReel, t));
  if (receiptTea) proof.append(teaPrint(receiptTea,t));
  if (receiptAtlas) proof.append(starPrint(receiptAtlas, t));
  if (letter.plate && !receiptSun && !receiptChairs) {
    const printBoard = index === active ? board : prepareFilm(letter, difficulty);
    const saved = read(routeKey(index, "print"));
    if (isDevelopedFilm(printBoard, saved)) proof.append(contactSheet(printBoard, saved, t));
  }
  byId("film-proof").hidden = !proof.firstElementChild;
  updateReceiptRoutes();
  const next = letters[index + 1];
  byId("next").querySelector("span").textContent = t(!next ? "backToAlbum" : next.chapter !== letter.chapter ? "nextChapter" : "next", {chapter: next && t(next.chapter)});
  receipt.showModal();
}

function updateReceiptRoutes() {
  const station = letters[viewed];
  const paired = station.chapter === "together";
  const goal = paired && read(routeKey(viewed, "goal")) === "joint" ? "joint" : "direct";
  const draft = read(routeKey(viewed, "route", goal));
  const resume = (paired || Boolean(station.plate) || (viewed === pier && fog.latest(difficulty)) || [slope,dome,sill,strait,greenhouse,lighthouse,lane].includes(viewed)) && draft?.sent === false && draft.history?.length > 0;
  byId("replay").textContent = t(receiptTea || receiptReel || receiptGraft || receiptBike || receiptGlow || receiptSun || receiptChairs || receiptFold ? (resume ? "sashRegularResume" : "sashRegularOpen") : (resume ? "continueRoute" : "replay"));
  byId("replay").dataset.resume = String(resume);
  if (!paired) return;
  const collected = hasImprint(viewed);
  byId("postscript-text").textContent = collected ? localLetter(station, language).postscript : t("foldedNote");
  byId("postscript").dataset.open = String(collected);
  const alternate = byId("alternate-route");
  alternate.hidden = bestFor(viewed) !== null && bestFor(viewed, "joint") !== null;
  alternate.dataset.goal = bestFor(viewed, "joint") === null ? "joint" : "direct";
  alternate.textContent = t(alternate.dataset.goal === "direct" ? "tryDirect" : collected ? "tryJoint" : "seekJoint");
  byId("read-ending").hidden = imprintCount() !== meetingStops.length;
}

byId("next").addEventListener("click", () => {
  if (viewed < letters.length - 1) goTo(viewed + 1);
  else { receipt.close(); showAlbum(letters[viewed].chapter); }
});
byId("replay").addEventListener("click", () => goTo(viewed, byId("replay").dataset.resume !== "true"));
byId("alternate-route").addEventListener("click", () => goTo(viewed, false, byId("alternate-route").dataset.goal));
byId("read-ending").addEventListener("click", () => {
  receipt.close();
  showAlbum("together");
  byId("appointment").focus();
});
byId("edit-message").addEventListener("click", () => { clearExport(); setEditing(true); });
byId("cancel-edit").addEventListener("click", () => { setEditing(false); byId("edit-message").focus(); });
byId("use-message").addEventListener("click", () => {
  write(letters[viewed].id + ".note", byId("message").value.trim().slice(0, 200));
  byId("letter-text").textContent = messageFor(viewed);
  setEditing(false);
  byId("edit-message").focus();
});
byId("save-image").addEventListener("click", async () => {
  clearExport();
  const version = exportVersion;
  const index = viewed;
  byId("save-image").disabled = true;
  byId("export-status").textContent = t("printing");
  try {
    const letter = localLetter(letters[index], language);
    const last = receiptWatch;
    const trip = receiptHill?.trip;
    const sunPages = receiptMate && sunSpread ? [receiptSun,receiptMate].sort((a,b)=>a.page.localeCompare(b.page)) : [receiptSun];
    const foldSheets=foldSpread && foldMate ? [foldMate,receiptFold] : [receiptFold];
    const back = receiptFold ? [byId("fold-story").textContent,...foldSheets.map(s=>foldSummary(rainDesk(letters[lane],difficulty),s,t))].join("\n")
      : receiptChairs ? [t("chairStory_"+portraitStyle(receiptChairs)),chairSummary(chairStudio(letters[seawall],difficulty),receiptChairs,t)].join("\n")
      : receiptSun ? [byId("sun-story").textContent,...sunPages.map(page => t("sunPage_"+page.page)+" · "+printSummary(dryingRack(letters[terrace],difficulty),page,t))].join("\n")
      : receiptGlow ? [t("glowStory_"+receiptGlow.style),glowSummary(lightStation(letters[lighthouse],difficulty),receiptGlow,t)].join("\n")
      : receiptBike ? [t("bikeStory_" + receiptBike.style), rideSummary(receiptBike, t)].join("\n")
      : receiptGraft ? [t("graftStory_" + receiptGraft.kind), specimenSummary(glassGarden(letters[greenhouse], difficulty).board, receiptGraft, t)].join("\n")
      : receiptReel ? [t("reelStory_" + receiptReel.coast), reelSummary(receiptReel, t)].join("\n")
      : receiptTea ? [teaStory(receiptTea,t),teaSummary(receiptTea,t)].join("\n") : receiptAtlas ? [atlasStory(receiptAtlas, t), atlasSummary(receiptAtlas, t)].join("\n") : receiptDuet ? [t("duetName_" + receiptDuet.id), duetSummary(receiptDuet.score, t), t("duetStory_" + receiptDuet.id)].join("\n")
      : trip ? t("hillName_" + trip.id) + "\n" + hillSummary(prepareHill(letters[slope], difficulty), trip, t) + "\n" + t("hillStory_" + trip.id)
      : last ? t("watchStory") + "\n" + watchSlip(t, last.shift, last) : hasImprint(index) ? letter.postscript : undefined;
    const backTitle = receiptFold ? "foldBook" : receiptChairs ? "chairBook" : receiptSun ? "sunBook" : receiptGlow ? "glowBook" : receiptBike ? "bikeBook" : receiptGraft ? "graftBook" : receiptReel ? "reelBook" : receiptTea ? "sashTable" : receiptAtlas ? "atlasLog" : receiptDuet ? "duetSlip" : trip ? "hillStub" : last ? "watchSlipTitle" : "onTheBack";
    const blob = await postcardPNG(letter, index + 1, messageFor(index), language, t, back, byId("contact-sheet").firstElementChild, backTitle, proofTitle());
    if (version !== exportVersion || !receipt.open) return;
    exportURL = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = exportURL;
    download.download = t("title") + "-" + letter.title + ".png";
    document.body.append(download);
    download.click();
    download.remove();
    byId("export-link").href = exportURL;
    byId("export-link").target = "_blank";
    byId("export-link").rel = "noopener";
    byId("export-link").hidden = false;
    byId("export-status").textContent = t("printed");
  } catch {
    if (version === exportVersion) byId("export-status").textContent = t("exportFailed");
  } finally {
    if (version === exportVersion) byId("save-image").disabled = false;
  }
});

for (const dialog of [album, receipt, settings]) {
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
}
receipt.addEventListener("close", () => { if (!receipt.open) clearExport(); });

function applyLanguage() {
  t = translator(language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");
  document.querySelector('meta[name="description"]').content = t("description");
  for (const element of document.querySelectorAll("[data-t]")) element.textContent = t(element.dataset.t);
  for (const element of document.querySelectorAll("[data-aria]")) element.setAttribute("aria-label", t(element.dataset.aria));
  byId("language-switch").lang = language === "zh" ? "en" : "zh-CN";
  sound.refreshLabel();
}
function switchLanguage() {
  language = language === "zh" ? "en" : "zh";
  write("language", language);
  applyLanguage();
  presentRoute();
  if (album.open) fillAlbum();
  if (receipt.open) showReceipt(viewed, false, viewed === lane ? receiptFold?.code ?? null : viewed === seawall ? (receiptChairs ? rollToken(receiptChairs) : null) : viewed === terrace ? receiptSun?.id ?? null : viewed === lighthouse ? receiptGlow?.code ?? null : viewed === bridge ? receiptBike?.code ?? null : viewed === greenhouse ? receiptGraft?.id ?? null : viewed === strait ? receiptReel?.id ?? null : viewed === sill ? receiptTea?.trip.id ?? null : viewed === dome ? receiptAtlas?.sketch.ink ?? null : viewed === huts ? receiptDuet?.id ?? null : viewed === slope ? receiptHill?.trip.id ?? null : receiptWatch);
  dispatchDesk.refresh();
}
byId("language-switch").addEventListener("click", switchLanguage);

function openSettings(focusMode = false) {
  if (activeService === "reel") reel.stop();
  if (activeService === "duet") duet.stop();
  const inDesk = byId("dispatch-desk").open;
  for (const mode of difficulties) {
    settings.querySelector('[data-t="' + mode + 'Help"]').textContent = t(inDesk ? "deskMode_" + mode : activeService ? activeService + "Mode_" + mode : mode + "Help");
  }
  const selected = settings.querySelector('input[value="' + difficulty + '"]');
  selected.checked = true;
  settings.showModal();
  if (focusMode) selected.focus();
}
byId("open-settings").addEventListener("click", () => openSettings());
byId("mode-open").addEventListener("click", () => openSettings(true));
byId("finish-settings").addEventListener("click", () => settings.close());
for (const radio of settings.querySelectorAll('input[name="difficulty"]')) {
  radio.addEventListener("change", () => {
    if (!radio.checked || difficulty === radio.value) return;
    difficulty = radio.value;
    write("difficulty", difficulty);
    openRoute(active, false, undefined, activeService);
    if (album.open) fillAlbum();
    if (receipt.open && !delivered(viewed)) receipt.close();
    else if (receipt.open) showReceipt(viewed, false);
    dispatchDesk.refresh();
  });
}
function setVolume(percent) {
  byId("volume").value = percent;
  byId("volume").setAttribute("aria-valuetext", percent + "%");
  byId("volume-value").textContent = percent + "%";
  sound.setVolume(percent / 100);
}
byId("volume").addEventListener("input", event => {
  const percent = event.target.valueAsNumber;
  setVolume(percent);
  write("volume", percent);
});
byId("preview-sound").addEventListener("click", () => cue("sent"));
const savedVolume = read("volume");
setVolume(Number.isInteger(savedVolume) && savedVolume >= 0 && savedVolume <= 100 ? savedVolume : 70);
applyLanguage();
window.addEventListener("pageshow", updateCount);
window.addEventListener("storage", event => {
  if (event.key?.startsWith(prefix+foldKey(difficulty,"")) && !event.key.endsWith(".draft")) {
    if (activeService==="fold") folds.refresh();
    updateCount();
    if (album.open) fillAlbum();
    if (receipt.open && receiptFold && !foldMate && byId("editor").hidden && folds.mate(difficulty,receiptFold)) showReceipt(viewed,false,receiptFold.code);
    return;
  }
  if (event.key?.startsWith(prefix + chairKey(difficulty,"")) && !event.key.endsWith(".draft")) {
    if (activeService==="chair") chairs.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + pressKey(difficulty,"")) && !event.key.endsWith(".draft")) {
    if (activeService === "sun") sun.refresh();
    updateCount();
    if (album.open) fillAlbum();
    if (receipt.open && receiptSun && !receiptMate && byId("editor").hidden && sun.mate(difficulty,receiptSun)) showReceipt(viewed,false,receiptSun.id);
    return;
  }
  if (event.key?.startsWith(prefix + glowKey(difficulty,"")) && !event.key.endsWith(".draft")) {
    if (activeService === "glow") glow.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + bikeKey(difficulty, "")) && !event.key.endsWith(".draft")) {
    if (activeService === "bike") bikes.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + graftKey(difficulty, "")) && !event.key.endsWith(".draft")) {
    if (activeService === "graft") graft.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + reelKey(difficulty, "")) && !event.key.endsWith(".draft")) {
    if (activeService === "reel") reel.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + sashKey(difficulty,"cup."))) {
    if (activeService === "sashes") sashes.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + atlasKey(difficulty, "chart."))) {
    if (activeService === "atlas") atlas.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + duetKey(difficulty, "")) && !event.key.endsWith(".draft")) {
    if (activeService === "duet") duet.refresh();
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key?.startsWith(prefix + hillKey(difficulty, "")) && !event.key.endsWith(".draft")) {
    if (board.hill) {
      tickets = hillTickets(letters[slope], difficulty, read);
      if (tickets.has(hillGoal)) hillGoal = null;
      if (!tickets.has(hillOverlay)) hillOverlay = null;
      hint = undefined;
      render();
    }
    updateCount();
    if (album.open) fillAlbum();
    return;
  }
  if (event.key === prefix + "watch.v1." + difficulty + ".last") {
    updateCount();
    if (album.open) fillAlbum();
    if (receipt.open && viewed === pier && !receiptWatch && byId("editor").hidden) showReceipt(viewed, false);
    return;
  }
  if (!event.key?.startsWith(prefix) || !/\.(best|imprint)$/.test(event.key)) return;
  const key = event.key.slice(prefix.length);
  const previous = memory.get(key);
  const now = read(key);
  if (Number.isInteger(previous) && Number.isInteger(now) && previous < now) write(key, previous);
  updateCount();
  if (album.open) fillAlbum();
  if (receipt.open) updateReceiptRoutes();
});
const linked = location.hash.slice(1);
const linkedService = Object.keys(services).find(key => services[key].hash === linked);
const savedStation = services[linkedService]?.station ?? (letters.some(letter => letter.id === linked) ? linked : read("active"));
openRoute(Math.max(0, letters.findIndex(letter => letter.id === savedStation)), false, undefined, linkedService);
if (dispatchStations.some(id => linked === "dispatch-" + id)) dispatchDesk.open(linked.slice("dispatch-".length));
