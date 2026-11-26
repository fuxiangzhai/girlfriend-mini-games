import { coordinate, mountChart } from "./chart.js";
import { atlasHint, blankChart, chartLines, commonSteps, fieldNotes, forkPrefix, nextSteps, observations, prepareAtlas, restoreSketch } from "./atlas.mjs";

const el = name => document.getElementById("atlas-" + name);
const map = () => document.getElementById("chart");
const directions = ["east", "south", "west", "north"];
export const atlasKey = (mode, field) => "atlas.v1." + mode + "." + field;
const pinLabel = (board, sketch, t) => sketch.pin === null ? t("atlasUnpinned") : t("atlasPinAt", {cell: coordinate(board, sketch.pin)});

export function atlasSummary({board, sketch}, t) {
  return t("atlasSummary", {steps: sketch.ink.length, pin: pinLabel(board, sketch, t), gates: chartLines(board, sketch).length - 1});
}
export function atlasStory({board, sketch}, t) {
  return t("atlasStory_" + (fieldNotes(board, sketch).at(-1) || "free"));
}

export function starPrint(record, t) {
  const {board, sketch} = record;
  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 344;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", atlasSummary(record, t) + ". " + sketch.cells.map(cell => coordinate(board, cell)).join(" → "));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e2a42";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const unit = 56, left = 29, top = 35;
  const xy = cell => [left + (cell % board.width + .5) * unit, top + (Math.floor(cell / board.width) + .5) * unit];
  const dot = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  ctx.strokeStyle = "#65738b"; ctx.lineWidth = 1;
  ctx.strokeRect(13, 13, 694, 318);
  for (let cell = 0; cell < board.tiles.length; cell++) {
    if (board.tiles[cell] !== "#") dot(...xy(cell), 2, "#97a6bb");
  }
  ctx.strokeStyle = "#f3d69c"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const line of chartLines(board, sketch)) {
    ctx.beginPath();
    line.forEach(([x, y], i) => ctx[i ? "lineTo" : "moveTo"](left + x * unit, top + y * unit));
    ctx.stroke();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const cell of board.marks) {
    const [x, y] = xy(cell);
    dot(x, y, 13, "#f6deaa");
    ctx.fillStyle = "#26344c"; ctx.font = "bold 17px monospace"; ctx.fillText(board.tiles[cell], x, y + 1);
  }
  for (const cell of [board.source, board.tiles.indexOf("M"), ...board.gates, sketch.pin]) {
    if (cell === null || !sketch.cells.includes(cell)) continue;
    const [x, y] = xy(cell), gate = board.tiles[cell] === "@";
    ctx.strokeStyle = gate ? "#91e0d4" : "#f1c69e"; ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 5, y - 5, 10, 10);
    if (gate) ctx.strokeRect(x - 9, y - 9, 18, 18);
  }
  ctx.textAlign = "left"; ctx.fillStyle = "#b7c9da"; ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(t("atlasLog"), 398, 80, 286);
  ctx.fillStyle = "#ffdfa2"; ctx.font = "36px Georgia, serif"; ctx.fillText(t("atlasSteps", {n: sketch.ink.length}), 398, 143);
  ctx.fillStyle = "#f1e5d0"; ctx.font = "20px system-ui, sans-serif"; ctx.fillText(pinLabel(board, sketch, t), 398, 193, 286);
  const stamps = [...board.marks].sort((a, b) => Number(board.tiles[a]) - Number(board.tiles[b]));
  ctx.fillStyle = "#b7c9da"; ctx.font = "19px monospace"; ctx.fillText(stamps.map(cell => coordinate(board, cell)).join(" → "), 398, 253, 286);
  const notes = fieldNotes(board, sketch);
  if (notes.length) {
    ctx.fillStyle = "#efdab9"; ctx.font = "17px system-ui, sans-serif";
    ctx.fillText(notes.map(note => t("atlasName_" + note)).join(" · "), 398, 291, 286);
  }
  return canvas;
}

export function createStarAtlas({letter, read, write, cue, delivered, receipt}) {
  const editions = new Map();
  let board, mode, t, chart, sketch, choices, filed, sent, target, overlay, hint;
  let loadedPlates;
  function edition(which) {
    if (!editions.has(which)) editions.set(which, prepareAtlas(letter, which));
    return editions.get(which);
  }
  function records(which) {
    const chart = edition(which);
    return new Map([...chart.routes].filter(([ink]) => read(atlasKey(which, "chart." + ink)) === ink));
  }
  function record(which, id) {
    const catalog = records(which);
    const selected = id === undefined ? catalog.get(read(atlasKey(which, "last"))) || catalog.values().next().value : catalog.get(id);
    return selected ? {board: edition(which), sketch: selected} : null;
  }
  function save() { write(atlasKey(mode, "draft"), {ink: sketch.ink, sent, target, overlay}); }
  function mount(which, translate) {
    mode = which; t = translate; board = edition(mode);
    const draft = read(atlasKey(mode, "draft"));
    filed = records(mode);
    sketch = restoreSketch(board, draft?.ink) || blankChart(board);
    sent = draft?.sent === true && filed.has(sketch.ink);
    target = observations.includes(draft?.target) ? draft.target : "";
    overlay = filed.has(draft?.overlay) ? draft.overlay : "";
    hint = null; loadedPlates = null;
    chart = mountChart(board, null, t, {onPlot: cell => extend(choices.find(next => entry(next) === cell))});
    map().tabIndex = 0;
    const rim = document.createElement("i");
    rim.className = "atlas-rim"; rim.textContent = "✧"; rim.setAttribute("aria-hidden", "true");
    chart.cells[board.rim].append(rim);
    buildBook();
    render();
  }
  function leave() { board = null; map().removeAttribute("tabindex"); }
  function entry(next) { return next.cells[sketch.cells.length]; }
  function fresh(reference = "") {
    if (!board) return;
    overlay = filed.has(reference) ? reference : sent ? sketch.ink : overlay;
    sketch = blankChart(board); sent = false; hint = null;
    save(); render(); map().focus({preventScroll:true});
  }
  function forkCell(which, reference) {
    const draft = read(atlasKey(which, "draft"));
    if (draft?.ink && !draft.sent) return null;
    const sky = edition(which), prefix = forkPrefix(sky, reference, records(which));
    return prefix === null ? null : coordinate(sky, restoreSketch(sky, prefix).cells.at(-1));
  }
  function branch(reference) {
    if (!board || (!sent && sketch.ink)) return;
    filed = records(mode);
    const prefix = forkPrefix(board, reference, filed);
    if (prefix === null) return;
    sketch = restoreSketch(board, prefix); overlay = reference;
    target = ""; hint = null; sent = false;
    cue("pencil"); save(); render(); map().focus();
  }
  function extend(next) {
    if (!next || !board || sent) return;
    const gate = next.cells.length - sketch.cells.length === 2;
    cue(next.ready ? "ready" : next.stars > sketch.stars ? "stamp" : gate ? "tide" : next.pin !== sketch.pin ? "starPin" : "pencil");
    sketch = next; hint = null; save(); render(); map().focus({preventScroll:true});
  }
  function undo() {
    if (!board || sent || !sketch.ink) return;
    sketch = restoreSketch(board, sketch.ink.slice(0, -1)); hint = null;
    cue("undo"); save(); render(); map().focus({preventScroll:true});
  }
  function buildBook() {
    const completed = new Set([...filed.values()].flatMap(route => fieldNotes(board, route)));
    el("tasks").replaceChildren(...observations.map(id => {
      const button = document.createElement("button"), title = document.createElement("strong"), clue = document.createElement("span");
      button.type = "button"; button.dataset.note = id;
      title.textContent = t("atlasName_" + id);
      clue.textContent = t("atlasClue_" + id, {n: board.shortest, cell: coordinate(board, board.rim)});
      const seal = document.createElement("small");
      seal.textContent = (completed.has(id) ? "✓ " : "") + t(completed.has(id) ? "atlasNoteDone" : "atlasNoteOpen");
      button.dataset.done = String(completed.has(id));
      button.append(title, clue, seal);
      button.addEventListener("click", () => {
        target = target === id ? "" : id; hint = null; cue("paper");
        if (sent) fresh();
        else { save(); render(); }
        map().focus();
      });
      return button;
    }));
    el("count").textContent = t("atlasCount", {n: filed.size});
    el("tracing").hidden = !filed.size;
    const options = [new Option(t("atlasNoOverlay"), "")];
    let n = 0;
    for (const [ink, route] of board.routes) {
      n++;
      if (filed.has(ink)) options.push(new Option(t("atlasPlate", {n, steps: ink.length, pin: pinLabel(board, route, t)}), ink));
    }
    el("overlay").replaceChildren(...options);
  }
  function status(advice) {
    if (sent) return t("atlasFiled");
    if (advice?.backTo !== undefined) return t("atlasHintBack", {cell: coordinate(board, restoreSketch(board, sketch.ink.slice(0, advice.backTo)).cells.at(-1))});
    if (advice?.direction !== undefined) return t("atlasHintStep", {dir: t(directions[advice.direction]), cell: coordinate(board, entry(choices.find(next => next.heading === advice.direction)))});
    if (sketch.ready) return t(filed.has(sketch.ink) ? "atlasKnown" : "atlasNew");
    const tip = sketch.cells.at(-1), cell = coordinate(board, tip), dir = t(directions[sketch.heading]);
    if (overlay && sketch.ink === forkPrefix(board, overlay, filed)) return t("atlasForkHelp", {cell});
    if (!choices.length) return t("atlasDead", {cell});
    if (!sketch.ink) return t("atlasStart", {cell, dir});
    if (board.tiles[tip] === "@") return t("atlasGate", {cell, dir});
    return t(sketch.stars === board.marks.length ? "atlasHome" : "atlasTip", {cell, n: sketch.stars + 1});
  }
  function paintCells(advice) {
    const tip = sketch.cells.at(-1);
    for (const [cell, tile] of chart.cells.entries()) {
      if (board.tiles[cell] === "#") continue;
      const step = choices.find(next => entry(next) === cell), value = board.tiles[cell];
      const feature = board.marks.includes(cell) ? t("sealLabel", {n: value}) : cell === board.source ? t("lampLabel", {direction: t(directions[">v<^".indexOf(value)])})
        : t(value === "M" ? "box" : value === "@" ? "gate" : board.mirrorAt.has(cell) ? "atlasEyelet" : "atlasSky");
      tile.disabled = !step;
      tile.classList.toggle("atlas-next", Boolean(step));
      tile.classList.toggle("atlas-spend", Boolean(step && step.pin !== sketch.pin));
      tile.classList.toggle("atlas-tip", cell === tip);
      tile.classList.toggle("atlas-pinned", cell === sketch.pin);
      tile.classList.toggle("atlas-hinted", Boolean(step && advice?.direction === step.heading));
      tile.classList.toggle("lit", board.marks.includes(cell) && sketch.cells.includes(cell));
      tile.classList.toggle("arrived", value === "M" && sketch.ready);
      tile.setAttribute("aria-label", [coordinate(board, cell), feature, cell === board.rim && t("atlasRimStar"), cell === tip && t("atlasTipLabel"),
        cell === sketch.pin && t("atlasPinAt", {cell: coordinate(board, cell)}), step && t("atlasNext", {dir: t(directions[step.heading])}),
        step && step.pin !== sketch.pin && t("atlasCostsPin")].filter(Boolean).join(" · "));
      if (step) tile.title = tile.getAttribute("aria-label");
      else tile.removeAttribute("title");
    }
  }
  function render() {
    choices = sent ? [] : nextSteps(board, sketch);
    const advice = !sent && mode === "relaxed" ? atlasHint(board, sketch, target, filed) : hint;
    chart.drawLines([{lines: chartLines(board, sketch)}]);
    paintCells(advice);
    const text = status(advice);
    el("status").textContent = text;
    document.getElementById("route-description").textContent = [t("atlasStars", {n: sketch.stars}), pinLabel(board, sketch, t), text].join(" · ");
    el("stars").textContent = t("atlasStars", {n: sketch.stars});
    el("steps").textContent = t(sketch.ink.length === 1 ? "atlasOneStep" : "atlasSteps", {n: sketch.ink.length});
    el("pin").textContent = sketch.pin === null ? t("atlasPinFull") : pinLabel(board, sketch, t);
    el("quest").hidden = !target;
    if (target) {
      const name = t("atlasName_" + target);
      el("quest").textContent = sketch.ready ? t(fieldNotes(board, sketch).includes(target) ? "atlasMet" : "atlasMissed", {name})
        : t("atlasSelected", {name, clue: t("atlasClue_" + target, {n: board.shortest, cell: coordinate(board, board.rim)})});
    }
    el("undo").disabled = el("reset").disabled = !sketch.ink || sent;
    el("undo").classList.toggle("atlas-guided", advice?.backTo !== undefined);
    el("hint").hidden = mode !== "standard";
    el("hint").disabled = sent || !atlasHint(board, sketch, target, filed);
    el("send").textContent = t(sent ? "read" : "atlasSend");
    el("send").disabled = !sketch.ready;
    el("again").hidden = !sent;
    const fork = sent ? forkPrefix(board, sketch.ink, filed) : null;
    el("fork").hidden = fork === null;
    if (fork !== null) el("fork").textContent = t("atlasFork", {cell: coordinate(board, restoreSketch(board, fork).cells.at(-1))});
    for (const button of el("tasks").children) button.setAttribute("aria-pressed", String(button.dataset.note === target));
    if (loadedPlates !== overlay) {
      chart.compareRays(overlay ? [{lines: chartLines(board, filed.get(overlay))}] : []);
      el("overlay").value = overlay; loadedPlates = overlay;
    }
    el("read").hidden = el("compare").hidden = !overlay;
    if (overlay) {
      const split = commonSteps(sketch.ink, overlay);
      el("compare").textContent = !sketch.ink ? t("atlasCompareStart") : split === sketch.ink.length ? t("atlasCompareSame")
        : t("atlasCompareSplit", {cell: coordinate(board, restoreSketch(board, sketch.ink.slice(0, split)).cells.at(-1))});
    }
  }
  function refresh() {
    if (!board) return;
    filed = records(mode); if (!filed.has(overlay)) overlay = "";
    if (sent && !filed.has(sketch.ink)) sent = false;
    loadedPlates = null; buildBook(); render();
  }
  map().addEventListener("keydown", event => {
    if (!board || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].indexOf(event.key);
    if (direction < 0 && event.key !== "Backspace") return;
    event.preventDefault();
    if (event.key === "Backspace") undo();
    else extend(choices.find(next => next.heading === direction));
  });
  el("undo").addEventListener("click", undo);
  el("to-book").addEventListener("click", () => el("tasks").firstElementChild.focus());
  el("read").addEventListener("click", () => { if (filed.has(overlay)) { cue("paper"); receipt(overlay); } });
  el("reset").addEventListener("click", () => { cue("reset"); fresh(); });
  el("again").addEventListener("click", () => { cue("paper"); fresh(); });
  el("fork").addEventListener("click", () => branch(sketch.ink));
  el("hint").addEventListener("click", () => { hint = atlasHint(board, sketch, target, filed); cue("hint"); render(); });
  el("overlay").addEventListener("change", event => { overlay = event.target.value; save(); render(); });
  el("send").addEventListener("click", () => {
    if (!board || !board.routes.has(sketch.ink)) return;
    if (!sent) {
      write(atlasKey(mode, "chart." + sketch.ink), sketch.ink);
      write(atlasKey(mode, "last"), sketch.ink);
      sent = true; hint = null; save(); refresh(); delivered(); cue("sent");
    }
    receipt(sketch.ink);
  });
  return {mount, leave, record, fresh, branch, forkCell, refresh};
}
