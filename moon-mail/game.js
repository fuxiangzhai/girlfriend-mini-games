import { bindGameSound } from "../assets/sound.js";
import { letters } from "./levels.mjs";
import { prepareBoard, trace, closestRoute } from "./puzzle.mjs";
import { coordinate, mountChart } from "./chart.js";
import { postcardPNG } from "./postcard.js";

const byId = id => document.getElementById(id);
const pad = value => String(value).padStart(2, "0");
const boards = letters.map(letter => prepareBoard(letter.rows));
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

function bestFor(index) {
  const value = read(letters[index].id + ".best");
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function messageFor(index) {
  const value = read(letters[index].id + ".note");
  return typeof value === "string" && value.trim() ? value.slice(0, 80) : letters[index].letter;
}

function chime(audio, cue) {
  const notes = cue === "sent" ? [392, 493.88, 587.33, 783.99] : cue === "ready" ? [440, 659.25] : [392];
  notes.forEach((frequency, i) => {
    const start = audio.currentTime + i * .095;
    const osc = audio.createOscillator();
    const level = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    level.gain.setValueAtTime(.0001, start);
    level.gain.exponentialRampToValueAtTime(.075, start + .012);
    level.gain.exponentialRampToValueAtTime(.0001, start + .32);
    osc.connect(level).connect(audio.destination);
    osc.onended = () => { osc.disconnect(); level.disconnect(); };
    osc.start(start);
    osc.stop(start + .34);
  });
}
const sound = bindGameSound(byId("sound"), byId("sound-label"), chime);
const album = byId("album");
const receipt = byId("receipt");
let active, board, chart, mask, path, history, sent, hint;
let sending = false;
let viewed = 0;
let exportVersion = 0;
let exportURL;

function savedCount() { return letters.filter((_, i) => bestFor(i) !== null).length; }

function updateCount() {
  byId("album-count").textContent = savedCount() + "/" + letters.length;
}

function saveDraft() {
  write(letters[active].id + ".route", { history: history.slice(), sent });
}

function statusText() {
  if (sending) return "信件正在沿着月光航行……";
  if (sent) return "月光已送达，来信可以拆开了。";
  if (hint !== undefined) return "试着转一下 " + coordinate(board, board.mirrors[hint]) + " 的圆镜。";
  if (path.end === "ready") return "邮路接通了！现在可以寄出这封信。";
  if (path.end === "missing") return "光已照到信箱，还差 " + (board.marks.length - path.lit.size) + " 枚邮戳。";
  if (path.end === "blocked") return "前面有阻挡，试试让月光从另一侧经过。";
  if (path.end === "loop") return "月光绕回了原处，转一面镜子打开出口。";
  if (active === 0 && !history.length) return "点一下 D3 圆镜，让光照到 D1 的信箱。";
  return "月光从海图边缘溜走了，再找一个转弯的方向。";
}

function render() {
  path = trace(board, mask);
  chart.draw(mask, path, hint, sending || sent);
  byId("moves").textContent = pad(history.length);
  const counter = byId("mark-count");
  counter.hidden = board.marks.length === 0;
  counter.textContent = "邮戳 " + path.lit.size + "/" + board.marks.length;
  byId("status").textContent = statusText();
  byId("status").parentElement.dataset.state = hint !== undefined ? "hint" : path.end;
  byId("undo").disabled = byId("reset").disabled = !history.length || sending || sent;
  byId("hint").disabled = path.end === "ready" || sending || sent;
  byId("send").disabled = path.end !== "ready" || sending;
  byId("send").querySelector("span").textContent = sending ? "投递中…" : sent ? "拆开来信" : "寄出月光";
  byId("open-album").disabled = sending;
}

function openRoute(index, fresh = false) {
  active = index;
  const letter = letters[index];
  board = boards[index];
  const draft = fresh ? null : read(letter.id + ".route");
  const valid = Array.isArray(draft?.history) && draft.history.every(i => Number.isInteger(i) && i >= 0 && i < board.mirrors.length);
  history = valid ? draft.history.slice() : [];
  mask = history.reduce((state, i) => state ^ (1 << i), board.initial);
  sent = valid && draft.sent === true && bestFor(index) !== null && trace(board, mask).end === "ready";
  hint = undefined;
  sending = false;
  write("active", letter.id);
  if (fresh) saveDraft();
  byId("serial").textContent = "NO. " + pad(index + 1) + " / " + pad(letters.length);
  byId("scene").src = letter.image;
  byId("scene").alt = letter.artAlt;
  byId("station-title").textContent = letter.title;
  byId("place").textContent = letter.place;
  byId("time").textContent = letter.time;
  byId("brief").textContent = letter.brief;
  chart = mountChart(board, rotate);
  render();
  updateCount();
}

function rotate(index) {
  if (sending || sent) return;
  sound.unlock();
  history.push(index);
  mask ^= 1 << index;
  hint = undefined;
  saveDraft();
  render();
  sound.play(path.end === "ready" ? "ready" : "turn");
}

byId("undo").addEventListener("click", () => {
  if (!history.length || sending || sent) return;
  mask ^= 1 << history.pop();
  hint = undefined;
  saveDraft();
  render();
});
byId("reset").addEventListener("click", () => openRoute(active, true));
byId("hint").addEventListener("click", () => {
  hint = closestRoute(board, mask).next;
  render();
  if (hint !== undefined) byId("tiles").querySelector('[data-mirror="' + hint + '"]').focus({ preventScroll: true });
});

byId("send").addEventListener("click", async () => {
  if (sending || path.end !== "ready") return;
  if (!sent) {
    sending = true;
    sent = true;
    sound.unlock();
    write(letters[active].id + ".best", Math.min(bestFor(active) ?? Infinity, history.length));
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
    sound.play("sent");
  }
  showReceipt(active);
});

function fillAlbum() {
  const count = savedCount();
  byId("album-summary").textContent = count === letters.length
    ? "六封信都到了。选一张重读，也可以写成自己的明信片。"
    : "已送达 " + count + " / " + letters.length + " 封。选一站出发，或重读已送达的信。";
  const cards = letters.map((letter, index) => {
    const best = bestFor(index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "album-item";
    button.dataset.delivered = best !== null;
    const image = new Image(625, 415);
    image.src = letter.image;
    image.alt = "";
    const title = document.createElement("strong");
    title.textContent = pad(index + 1) + " · " + letter.title;
    const status = document.createElement("small");
    status.textContent = best !== null ? "已送达 · 最佳 " + best + " 步" : active === index ? "正在投递" : "前往投递";
    button.append(image, title, status);
    button.addEventListener("click", () => {
      album.close();
      if (best !== null) showReceipt(index);
      else goTo(index);
    });
    return button;
  });
  byId("album-grid").replaceChildren(...cards);
}

function showAlbum() {
  fillAlbum();
  album.showModal();
}
byId("open-album").addEventListener("click", showAlbum);

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

function showReceipt(index) {
  viewed = index;
  const letter = letters[index];
  clearExport();
  setEditing(false);
  byId("receipt-meta").textContent = "NO. " + pad(index + 1) + "  /  " + letter.place + " · " + letter.time;
  byId("receipt-image").src = letter.image;
  byId("receipt-image").alt = letter.artAlt;
  byId("receipt-title").textContent = letter.title;
  byId("letter-text").textContent = messageFor(index);
  byId("next").querySelector("span").textContent = index === letters.length - 1 ? "回到信夹" : "下一站";
  receipt.showModal();
}

byId("next").addEventListener("click", () => {
  if (viewed < letters.length - 1) goTo(viewed + 1);
  else { receipt.close(); showAlbum(); }
});
byId("replay").addEventListener("click", () => goTo(viewed, true));
byId("edit-message").addEventListener("click", () => { clearExport(); setEditing(true); });
byId("cancel-edit").addEventListener("click", () => { setEditing(false); byId("edit-message").focus(); });
byId("use-message").addEventListener("click", () => {
  write(letters[viewed].id + ".note", byId("message").value.trim().slice(0, 80));
  byId("letter-text").textContent = messageFor(viewed);
  setEditing(false);
  byId("edit-message").focus();
});
byId("save-image").addEventListener("click", async () => {
  clearExport();
  const version = exportVersion;
  const index = viewed;
  byId("save-image").disabled = true;
  byId("export-status").textContent = "正在印制明信片……";
  try {
    const blob = await postcardPNG(letters[index], index + 1, messageFor(index));
    if (version !== exportVersion || !receipt.open) return;
    exportURL = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = exportURL;
    download.download = "月光邮局-" + letters[index].title + ".png";
    document.body.append(download);
    download.click();
    download.remove();
    byId("export-link").href = exportURL;
    byId("export-link").target = "_blank";
    byId("export-link").rel = "noopener";
    byId("export-link").hidden = false;
    byId("export-status").textContent = "明信片已生成。";
  } catch {
    if (version === exportVersion) byId("export-status").textContent = "图片未能生成，请再试一次。";
  } finally {
    if (version === exportVersion) byId("save-image").disabled = false;
  }
});

for (const dialog of [album, receipt]) {
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
}
receipt.addEventListener("close", () => { if (!receipt.open) clearExport(); });
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
openRoute(Math.max(0, letters.findIndex(letter => letter.id === read("active"))));
