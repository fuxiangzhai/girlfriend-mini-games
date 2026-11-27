import { sensorName, shutter } from "./darkroom.mjs";
import { trace } from "./puzzle.mjs";

const el = id => document.getElementById(id);
const tags = (board, pattern) => board.film.targets.map((_, i) => pattern & (1 << i) ? sensorName(i) : "").filter(Boolean).join(" + ");

export function showFilmTray(board, frames, reading, hint, locked, compared, t) {
  const { targets, patterns } = board.film;
  el("film-doses").replaceChildren(...targets.map((target, i) => {
    const chip = document.createElement("span");
    const name = document.createElement("b");
    name.textContent = sensorName(i);
    const value = document.createElement("span");
    const stored = reading.counts[i];
    const next = reading.slots > 0 ? reading.projected[i] : stored;
    chip.dataset.state = next > target ? "over" : stored === target ? "met" : "open";
    value.textContent = (next === stored ? stored : stored + "→" + next) + " / " + target;
    chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", t("doseLabel", {name: name.textContent, stored, next, target}));
    chip.append(name, value);
    return chip;
  }));
  el("film-log").replaceChildren(...Array.from({length: board.film.frames}, (_, i) => {
    const item = document.createElement("li");
    const recorded = i < frames.length;
    const names = recorded ? tags(board, patterns[frames[i]]) : "—";
    const label = document.createElement(recorded ? "button" : "span");
    label.textContent = String(i + 1).padStart(2, "0") + " · " + names;
    if (recorded) {
      label.type = "button";
      label.dataset.frame = i;
      label.setAttribute("aria-label", label.textContent + " · " + t("compareFrame"));
      label.setAttribute("aria-pressed", String(i === compared));
    } else item.setAttribute("aria-label", t("frameLabel", {n: i + 1, names: t("unexposed")}));
    item.append(label);
    item.dataset.exposed = String(recorded);
    return item;
  }));
  el("rewind-film").disabled = !frames.length || locked;
  el("rewind-film").classList.toggle("suggested", hint === "rewind");
  el("send").classList.toggle("suggested", hint === shutter);
  el("compare-note").hidden = frames.length === 0;
  el("compare-note").textContent = compared < 0 ? t("compareHelp") : t("compareActive", {n: compared + 1});
}

export function filmStatus(board, path, reading, advice, spent, t) {
  if (reading.complete) return t("developReady");
  if (advice === "rewind" || reading.slots === 0 || reading.remaining.some(n => n > reading.slots)) return t("rewindStatus");
  if (advice === shutter) return t("shutterHint", {names: tags(board, reading.pattern)});
  if (spent && !reading.canShoot) return t("exhausted");
  if (reading.over !== -1) return t("overStatus", {name: sensorName(reading.over)});
  if (reading.canShoot) return t("shutterStatus", {names: tags(board, reading.pattern)});
  return t(path.end === "ready" ? "noSensor" : "seekCamera");
}

export async function developPrint() {
  if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const photo = el("scene");
  if (!photo.animate) return;
  const animation = photo.animate([{filter: "sepia(.8) contrast(.7)", opacity: .65}, {filter: "none", opacity: 1}], {duration: 680, easing: "ease-out"});
  const finishWhenHidden = () => { if (document.hidden) animation.finish(); };
  document.addEventListener("visibilitychange", finishWhenHidden);
  try { await animation.finished; }
  finally { document.removeEventListener("visibilitychange", finishWhenHidden); }
}

// Use the same contact sheet in the receipt and the exported postcard.
export function contactSheet(board, frames, t) {
  const sheet = document.createElement("canvas");
  sheet.width = frames.length * 360;
  sheet.height = 284;
  const ctx = sheet.getContext("2d");
  const width = sheet.width / frames.length;
  ctx.fillStyle = "#16383f";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = "#e9ddc1";
  for (let x = 13; x < sheet.width - 10; x += 25) {
    ctx.fillRect(x, 7, 12, 5);
    ctx.fillRect(x, sheet.height - 12, 12, 5);
  }
  const captions = [];
  frames.forEach((mask, i) => {
    const path = trace(board, mask);
    const title = tags(board, path.exposure);
    captions.push(t("frameLabel", {n: i + 1, names: title}));
    const step = Math.min((width - 38) / board.width, 184 / board.height);
    const left = width * (i + .5) - board.width * step / 2;
    const top = 29 + (184 - board.height * step) / 2;
    const toPoint = cell => [left + (cell % board.width + .5) * step, top + (Math.floor(cell / board.width) + .5) * step];
    ctx.fillStyle = "#23505a";
    ctx.fillRect(left, top, step * board.width, step * board.height);
    ctx.fillStyle = "#779293";
    for (let cell = 0; cell < board.tiles.length; cell++) {
      const [x, y] = toPoint(cell);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.strokeStyle = "#ffda92";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    for (const line of path.lines) {
      ctx.beginPath();
      line.forEach(([x, y], k) => {
        if (k === 0) ctx.moveTo(left + x * step, top + y * step);
        else ctx.lineTo(left + x * step, top + y * step);
      });
      ctx.stroke();
    }
    for (const gate of board.gates) {
      const [x, y] = toPoint(gate);
      ctx.strokeStyle = "#cbbce2";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, step * .21, Math.PI, 0);
      ctx.stroke();
    }
    const [lampX, lampY] = toPoint(board.source);
    ctx.fillStyle = "#ffe1a1";
    ctx.beginPath();
    ctx.arc(lampX, lampY, step * .14, 0, Math.PI * 2);
    ctx.fill();
    const [lensX, lensY] = toPoint(board.tiles.indexOf("M"));
    ctx.strokeStyle = "#c6ece1";
    ctx.strokeRect(lensX - step * .17, lensY - step * .14, step * .34, step * .28);
    board.film.sensors.forEach((cell, s) => {
      const [x, y] = toPoint(cell);
      const lit = Boolean(path.exposure & (1 << s));
      ctx.beginPath();
      ctx.arc(x, y, step * .32, 0, Math.PI * 2);
      ctx.fillStyle = lit ? "#ffe5ad" : "#41606a";
      ctx.fill();
      ctx.fillStyle = lit ? "#203d42" : "#d4ded6";
      ctx.textAlign = "center";
      ctx.font = "bold " + Math.round(step * .44) + "px monospace";
      ctx.fillText(sensorName(s), x, y + step * .15);
    });
    ctx.fillStyle = "#f6e4bf";
    ctx.textAlign = "center";
    ctx.font = "bold 25px monospace";
    ctx.fillText(String(i + 1).padStart(2, "0") + "   " + title, width * (i + .5), 250);
  });
  sheet.setAttribute("role", "img");
  sheet.setAttribute("aria-label", captions.join(". "));
  return sheet;
}
