import { bindGameSound } from "../assets/sound.js";
import { letters, localLetter } from "./levels.mjs";
import { prepareRoute, difficulties, trace, closestRoute } from "./puzzle.mjs";
import { chooseLanguage, translator } from "./i18n.mjs";
import { playMailSound } from "./soundscape.js";
import { coordinate, mountChart } from "./chart.js";
import { postcardPNG } from "./postcard.js";

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
function routeKey(index, field) {
  const id = letters[index].id;
  return difficulty === "standard" ? id + "." + field : id + "." + difficulty + "." + field;
}

function bestFor(index) {
  const value = read(routeKey(index, "best"));
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
let active, board, chart, mask, path, history, sent, hint;
let chapter = "coast";
let sending = false;
let viewed = 0;
let exportVersion = 0;
let exportURL;

function savedCount() { return letters.filter((_, i) => bestFor(i) !== null).length; }

function updateCount() {
  byId("album-count").textContent = savedCount() + "/" + letters.length;
}

function saveDraft() {
  write(routeKey(active, "route"), { history: history.slice(), sent });
}

function outOfTurns() {
  return board.budget !== null && history.length >= board.budget;
}

function statusText(advice) {
  if (sending) return t("busyStatus");
  if (sent) return t("deliveredStatus");
  if (path.end === "ready") return t("readyStatus");
  if (outOfTurns()) return t("exhausted");
  if (advice !== undefined) return t(difficulty === "relaxed" ? "guidedStatus" : "hintStatus", {cell: coordinate(board, board.mirrors[advice])});
  if (path.wrongOrder) {
    return t("orderStatus", {actual: path.sequence.join(" → "), expected: board.sealOrder.join(" → ")});
  }
  if (difficulty === "expert" && !history.length) return t("budgetStart", {n: board.budget});
  if (path.end === "missing") return t("missingStatus", {n: board.marks.length - path.lit.size});
  if (path.end === "blocked") return t("blockedStatus");
  if (path.end === "loop") return t("loopStatus");
  if (active === 0 && !history.length) return t("firstStatus");
  return t("seaStatus");
}

function render() {
  path = trace(board, mask);
  const advice = difficulty === "relaxed" ? closestRoute(board, mask).next : hint;
  chart.draw(mask, path, advice, sending || sent || outOfTurns());
  byId("moves").textContent = pad(history.length);
  byId("budget").textContent = board.budget === null ? "" : " / " + pad(board.budget);
  byId("turn-counter").title = board.budget === null ? t("turns") : t("budgetAccess", {used: history.length, total: board.budget});
  byId("mode-label").textContent = t(difficulty);
  byId("mode-open").setAttribute("aria-label", t("modeControl", {mode: t(difficulty)}));
  const counter = byId("mark-count");
  counter.hidden = board.marks.length === 0;
  counter.textContent = t("stamps") + " " + (board.sealOrder.length
    ? board.sealOrder.map((_, i) => path.sequence[i] ?? "–").join("›")
    : path.lit.size + "/" + board.marks.length);
  counter.classList.toggle("wrong-order", path.wrongOrder);
  byId("status").textContent = statusText(advice);
  byId("status").parentElement.dataset.state = advice !== undefined ? "hint" : path.end;
  byId("undo").disabled = byId("reset").disabled = !history.length || sending || sent;
  byId("hint").hidden = difficulty !== "standard";
  byId("hint").disabled = difficulty !== "standard" || path.end === "ready" || sending || sent;
  byId("send").disabled = path.end !== "ready" || sending;
  byId("send").querySelector("span").textContent = t(sending ? "sending" : sent ? "read" : "send");
  for (const id of ["open-album", "open-settings", "mode-open", "language-switch"]) byId(id).disabled = sending;
}

function openRoute(index, fresh = false) {
  active = index;
  const letter = letters[index];
  board = prepareRoute(letter, difficulty);
  const draft = fresh ? null : read(routeKey(index, "route"));
  const valid = Array.isArray(draft?.history) && (board.budget === null || draft.history.length <= board.budget)
    && draft.history.every(i => Number.isInteger(i) && i >= 0 && i < board.mirrors.length);
  history = valid ? draft.history.slice() : [];
  mask = history.reduce((state, i) => state ^ (1 << i), board.initial);
  sent = valid && draft.sent === true && bestFor(index) !== null && trace(board, mask).end === "ready";
  hint = undefined;
  sending = false;
  write("active", letter.id);
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
  byId("brief").textContent = difficulty === "expert" ? letter.expertNote : letter.brief;
  chart = mountChart(board, rotate, t);
  render();
  updateCount();
}

function rotate(index) {
  if (sending || sent || outOfTurns()) return;
  const previous = path;
  cue("turn");
  history.push(index);
  mask ^= 1 << index;
  hint = undefined;
  saveDraft();
  render();
  if ([...path.lit].some(cell => !previous.lit.has(cell))) sound.play("stamp");
  else if (path.lines.length > previous.lines.length) sound.play("tide");
  if (path.end === "ready" && previous.end !== "ready") sound.play("ready");
  else if (outOfTurns() && path.end !== "ready") sound.play("limit");
}

byId("undo").addEventListener("click", () => {
  if (!history.length || sending || sent) return;
  cue("undo");
  mask ^= 1 << history.pop();
  hint = undefined;
  saveDraft();
  render();
});
byId("reset").addEventListener("click", () => { cue("reset"); openRoute(active, true); });
byId("hint").addEventListener("click", () => {
  if (difficulty !== "standard") return;
  cue("hint");
  hint = closestRoute(board, mask).next;
  render();
  if (hint !== undefined) byId("tiles").querySelector('[data-mirror="' + hint + '"]').focus({ preventScroll: true });
});

byId("send").addEventListener("click", async () => {
  if (sending || path.end !== "ready") return;
  const firstDelivery = !sent;
  if (firstDelivery) {
    sending = true;
    sent = true;
    cue("depart");
    write(routeKey(active, "best"), Math.min(bestFor(active) ?? Infinity, history.length));
    saveDraft();
    updateCount();
    render();
    try {
      await chart.carryLetter();
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
    button.dataset.delivered = best !== null;
    const image = new Image(625, 415);
    image.src = letter.image;
    image.alt = "";
    const title = document.createElement("strong");
    title.textContent = pad(index + 1) + " · " + letter.title;
    const status = document.createElement("small");
    status.textContent = best !== null ? t(best === 1 ? "albumBestOne" : "albumBest", {n: best}) : t(active === index ? "inProgress" : "visit");
    button.append(image, title, status);
    button.addEventListener("click", () => {
      album.close();
      if (best !== null) showReceipt(index);
      else goTo(index);
    });
    cards.push(button);
  });
  byId("album-grid").replaceChildren(...cards);
}

function showAlbum(selectedChapter = letters[active].chapter) {
  chapter = selectedChapter;
  cue("paper");
  fillAlbum();
  album.showModal();
}
byId("open-album").addEventListener("click", () => showAlbum());
for (const tab of byId("chapters").querySelectorAll("button")) {
  tab.addEventListener("click", () => { chapter = tab.dataset.chapter; cue("paper"); fillAlbum(); });
}

function goTo(index, fresh = false) {
  if (receipt.open) receipt.close();
  openRoute(index, fresh);
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
  byId("letter-text").hidden = value;
  byId("edit-message").parentElement.hidden = value;
  byId("next").parentElement.hidden = value;
  if (value) {
    byId("message").value = messageFor(viewed);
    byId("message").focus();
  }
}

function showReceipt(index, rustle = true) {
  viewed = index;
  const letter = localLetter(letters[index], language);
  if (rustle) cue("paper");
  clearExport();
  setEditing(false);
  byId("receipt-meta").textContent = "NO. " + pad(index + 1) + "  /  " + letter.place + " · " + letter.time;
  byId("receipt-image").src = letter.image;
  byId("receipt-image").alt = letter.artAlt;
  byId("receipt-title").textContent = letter.title;
  byId("letter-text").textContent = messageFor(index);
  const next = letters[index + 1];
  byId("next").querySelector("span").textContent = t(!next ? "backToAlbum" : next.chapter !== letter.chapter ? "nextChapter" : "next");
  receipt.showModal();
}

byId("next").addEventListener("click", () => {
  if (viewed < letters.length - 1) goTo(viewed + 1);
  else { receipt.close(); showAlbum(letters[viewed].chapter); }
});
byId("replay").addEventListener("click", () => goTo(viewed, true));
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
    const blob = await postcardPNG(letter, index + 1, messageFor(index), language, t);
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
byId("language-switch").addEventListener("click", () => {
  language = language === "zh" ? "en" : "zh";
  write("language", language);
  applyLanguage();
  presentRoute();
});

function openSettings(focusMode = false) {
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
    openRoute(active);
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
  if (!event.key?.startsWith(prefix) || !event.key.endsWith(".best")) return;
  const key = event.key.slice(prefix.length);
  const previous = memory.get(key);
  const now = read(key);
  if (Number.isInteger(previous) && Number.isInteger(now) && previous < now) write(key, previous);
  updateCount();
  if (album.open) fillAlbum();
});
const savedStation = read("active");
openRoute(Math.max(0, letters.findIndex(letter => letter.id === savedStation)));
