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

const byId = id => document.getElementById(id);
const pad = value => String(value).padStart(2, "0");
const memory = new Map();
const memoryOnly = new Set();
const prefix = "moon-mail:v1:";

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
const fog = createFogWatch({ letter: letters[pier], read, write, cue, delivered: updateCount, openReceipt: record => showReceipt(pier, true, record) });
let onWatch = false;
let active, board, chart, mask, path, history, sent, hint;
let frames = [], reading;
let compared = -1, justExposed = false;
let chapter = "coast";
let sending = false;
let viewed = 0;
let receiptWatch;
let exportVersion = 0;
let exportURL;

function delivered(index) {
  return bestFor(index) !== null || (letters[index].chapter === "together" && bestFor(index, "joint") !== null)
    || (index === pier && Boolean(fog.latest(difficulty)));
}
function hasImprint(index) { return read(routeKey(index, "imprint")) === true; }
const meetingStops = letters.map((letter, index) => ({letter, index})).filter(stop => stop.letter.chapter === "together");
function imprintCount() { return meetingStops.filter(stop => hasImprint(stop.index)).length; }
function savedCount() { return letters.filter((_, i) => delivered(i)).length; }

function updateCount() {
  byId("album-count").textContent = savedCount() + "/" + letters.length;
}

function saveDraft() {
  write(routeKey(active, "route", board.goal), { history: history.slice(), sent });
}

function turns() { return history.length - frames.length; }
function outOfTurns() { return board.budget !== null && turns() >= board.budget; }
function readyToSend() { return reading ? reading.complete : path.end === "ready"; }
function nextAction() { return reading ? filmHint(board, mask, reading) : closestRoute(board, mask).next; }

function statusText(advice) {
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
  path = trace(board, mask);
  reading = board.film ? readFilm(board, frames, mask) : null;
  const advice = difficulty === "relaxed" && !sent ? nextAction() : hint;
  chart.draw(mask, path, advice, sending || sent || outOfTurns() || reading?.slots === 0);
  byId("moves").textContent = pad(turns());
  byId("budget").textContent = board.budget === null ? "" : " / " + pad(board.budget);
  byId("turn-counter").title = board.budget === null ? t("turns") : t("budgetAccess", {used: turns(), total: board.budget});
  const counter = byId("mark-count");
  counter.hidden = board.marks.length === 0;
  counter.textContent = t("stamps") + " " + (board.sealOrder.length
    ? board.sealOrder.map((_, i) => path.sequence[i] ?? "–").join("›")
    : path.lit.size + "/" + board.marks.length);
  counter.classList.toggle("wrong-order", path.wrongOrder);
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
  for (const id of ["open-album", "open-settings", "mode-open", "language-switch", "station-desk", "watch-enter"]) byId(id).disabled = sending;
}

function openRoute(index, fresh = false, requestedGoal, watch = false) {
  if (onWatch) fog.leave();
  onWatch = index === pier && watch;
  active = index;
  const letter = letters[index];
  const paired = letter.chapter === "together";
  const choice = requestedGoal ?? (paired ? read(routeKey(index, "goal")) : "direct");
  const goal = paired && choice === "joint" ? "joint" : "direct";
  board = letter.plate ? prepareFilm(letter, difficulty) : prepareRoute(letter, difficulty, goal);
  if (paired) write(routeKey(index, "goal"), goal);
  const draft = fresh ? null : read(routeKey(index, "route", goal));
  const restored = board.film ? restoreFilm(board, draft?.history) : null;
  const valid = board.film ? !!restored : Array.isArray(draft?.history) && (board.budget === null || draft.history.length <= board.budget)
    && draft.history.every(i => Number.isInteger(i) && i >= 0 && i < board.mirrors.length);
  history = valid ? draft.history.slice() : [];
  mask = restored?.mask ?? history.reduce((state, i) => state ^ (1 << i), board.initial);
  frames = restored?.frames ?? [];
  compared = -1;
  justExposed = false;
  sent = valid && draft.sent === true && bestFor(index, goal) !== null
    && (board.film ? isDevelopedFilm(board, frames) : trace(board, mask).end === "ready");
  hint = undefined;
  sending = false;
  write("active", letter.id);
  delete byId("chart").dataset.focus;
  const fragment = location.hash.slice(1);
  const target = onWatch ? "chimes-watch" : letter.id;
  if (fragment !== target && (onWatch || fragment === "chimes-watch" || letters.some(station => station.id === fragment))) {
    try { window.history.replaceState(null, "", "#" + target); } catch { /* Optional shortcut in local files. */ }
  }
  if (fresh) saveDraft();
  presentRoute();
}

function presentRoute() {
  const letter = localLetter(letters[active], language);
  byId("serial").textContent = "NO. " + pad(active + 1) + " / " + pad(letters.length);
  byId("scene").src = letter.image;
  byId("scene").alt = letter.artAlt;
  byId("station-title").textContent = letter.title;
  byId("place").textContent = letter.place;
  byId("time").textContent = letter.time;
  byId("brief").textContent = onWatch ? t("watchBrief") : difficulty === "expert" ? letter.expertNote : letter.brief;
  const chartPanel = document.querySelector(".chart-panel");
  chartPanel.classList.toggle("on-watch", onWatch);
  byId("watch-switch").hidden = active !== pier;
  byId("watch-normal").setAttribute("aria-pressed", String(!onWatch));
  byId("watch-enter").setAttribute("aria-pressed", String(onWatch));
  for (const id of ["watch-head", "watch-panel", "watch-book"]) byId(id).hidden = !onWatch;
  byId("guide").hidden = onWatch;
  byId("chart").setAttribute("aria-label", t(onWatch ? "watchChartAccess" : "chartAccess"));
  byId("mode-label").textContent = t(difficulty);
  byId("mode-open").setAttribute("aria-label", t("modeControl", { mode: t(difficulty) }));
  byId("station-desk").hidden = !dispatchStations.includes(letter.id);
  const paired = board.starSource !== undefined;
  const film = Boolean(board.film);
  byId("goals").hidden = byId("ray-key").hidden = !paired;
  byId("film-tray").hidden = !film;
  byId("send").classList.remove("suggested");
  byId("chart-title").querySelector("span").textContent = t(onWatch ? "watchTitle" : film ? "filmChart" : "chart");
  byId("chart-title").querySelector("use").setAttribute("href", onWatch ? "#i-chime" : film ? "#i-camera" : "#i-compass");
  document.querySelector(".chart-panel").classList.toggle("darkroom-chart", film);
  for (const key of document.querySelectorAll(".bay-symbol")) key.hidden = !paired;
  for (const key of document.querySelectorAll(".single-symbol")) key.hidden = paired || film;
  for (const key of document.querySelectorAll(".film-symbol")) key.hidden = !film;
  byId("guide-instructions").textContent = t(film ? "filmGuide" : paired ? "pairInstructions" : "instructions");
  if (onWatch) fog.mount(difficulty, t);
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
  cue("turn");
  history.push(index);
  mask ^= 1 << index;
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
  const action = history.pop();
  if (action === shutter) frames.pop();
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
byId("reset").addEventListener("click", () => { cue("reset"); openRoute(active, true); });
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
    write(routeKey(active, "best", board.goal), Math.min(bestFor(active, board.goal) ?? Infinity, turns()));
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
    if (!document.hidden) sound.play("sent");
  }
  showReceipt(active, !firstDelivery);
});

function fillAlbum() {
  byId("album-watch").hidden = chapter !== "replies";
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
    button.append(image, title, status);
    if (station.chapter === "together") {
      const jointBest = bestFor(index, "joint");
      if (wasDelivered) {
        const scores = [];
        if (best !== null) scores.push(t("goalBest", {goal: t("direct"), n: best}));
        if (jointBest !== null) scores.push(t("goalBest", {goal: t("joint"), n: jointBest}));
        status.textContent = scores.join(" / ");
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
  chapter = selectedChapter;
  cue("paper");
  fillAlbum();
  album.showModal();
}
byId("open-album").addEventListener("click", () => showAlbum());
function openWatchFromBook() {
  if (album.open) album.close();
  if (receipt.open) receipt.close();
  cue("paper");
  openRoute(pier, false, undefined, true);
  byId("watch-shift").focus();
}
byId("album-watch").addEventListener("click", openWatchFromBook);
byId("receipt-watch").addEventListener("click", openWatchFromBook);
byId("watch-enter").addEventListener("click", () => { if (!onWatch && !sending) { cue("paper"); openRoute(pier, false, undefined, true); } });
byId("watch-normal").addEventListener("click", () => { if (onWatch) { cue("paper"); openRoute(pier); } });
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
  byId("editor").hidden = !value;
  byId("receipt-watch").hidden = value || viewed !== pier;
  byId("watch-slip").hidden = value || !receiptWatch;
  byId("receipt-desk").hidden = value || !dispatchStations.includes(letters[viewed].id);
  byId("letter-text").hidden = value;
  byId("postscript").hidden = value || letters[viewed].chapter !== "together";
  byId("film-proof").hidden = value || !byId("contact-sheet").firstElementChild;
  byId("edit-message").parentElement.hidden = value;
  byId("next").parentElement.hidden = value;
  if (value) {
    byId("message").value = messageFor(viewed);
    byId("message").focus();
  }
}

function showReceipt(index, rustle = true, record) {
  viewed = index;
  receiptWatch = index === pier ? record ?? fog.latest(difficulty) : null;
  const letter = localLetter(letters[index], language);
  if (rustle) cue("paper");
  clearExport();
  setEditing(false);
  byId("receipt-meta").textContent = "NO. " + pad(index + 1) + "  /  " + letter.place + " · " + letter.time;
  byId("receipt-image").src = letter.image;
  byId("receipt-image").alt = letter.artAlt;
  byId("receipt-title").textContent = letter.title;
  byId("letter-text").textContent = messageFor(index);
  if (receiptWatch) {
    byId("watch-slip").querySelector("p").textContent = t("watchStory");
    byId("watch-slip").querySelector("small").textContent = watchSlip(t, receiptWatch.shift, receiptWatch);
  }
  const proof = byId("contact-sheet");
  proof.replaceChildren();
  if (letter.plate) {
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
  const resume = (paired || Boolean(station.plate) || (viewed === pier && fog.latest(difficulty))) && draft?.sent === false && draft.history?.length > 0;
  byId("replay").textContent = t(resume ? "continueRoute" : "replay");
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
    const back = last ? t("watchStory") + "\n" + watchSlip(t, last.shift, last) : hasImprint(index) ? letter.postscript : undefined;
    const blob = await postcardPNG(letter, index + 1, messageFor(index), language, t, back, byId("contact-sheet").firstElementChild, last ? "watchSlipTitle" : "onTheBack");
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
  if (receipt.open) showReceipt(viewed, false, receiptWatch);
  dispatchDesk.refresh();
}
byId("language-switch").addEventListener("click", switchLanguage);

function openSettings(focusMode = false) {
  const inDesk = byId("dispatch-desk").open;
  for (const mode of difficulties) {
    settings.querySelector('[data-t="' + mode + 'Help"]').textContent = t(inDesk ? "deskMode_" + mode : onWatch ? "watchMode_" + mode : mode + "Help");
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
    openRoute(active, false, undefined, onWatch);
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
const savedStation = linked === "chimes-watch" ? "chimes" : letters.some(letter => letter.id === linked) ? linked : read("active");
openRoute(Math.max(0, letters.findIndex(letter => letter.id === savedStation)), false, undefined, linked === "chimes-watch");
if (dispatchStations.some(id => linked === "dispatch-" + id)) dispatchDesk.open(linked.slice("dispatch-".length));
