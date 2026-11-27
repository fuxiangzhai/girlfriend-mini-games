import { coordinate, mountChart } from "./chart.js";
import { firstParting, fitsDrum, helms, pilotHint, sail, tideCatalog, tideCourse, wakeLines } from "./tide-roll.mjs";

const byId = name => document.getElementById("reel-" + name);
const svgNS = "http://www.w3.org/2000/svg";
const directions = ["east", "south", "west", "north"];
const arrows = ["↑", "↱", "↶", "↰"];
export const reelKey = (mode, field) => "tide-reel.v1." + mode + "." + field;
export const reelSummary = (trip, t) => t("reelName_" + trip.coast) + " · " + t("reelStats", {n: trip.steps, g: trip.gates});

function svg(name, attributes) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
function helmIcon(turn) {
  const icon = svg("svg", {class: "icon", "aria-hidden": "true"});
  icon.append(svg("use", {href: "#i-helm" + turn}));
  return icon;
}
function button(action) {
  const el = document.createElement("button");
  el.type = "button";
  el.addEventListener("click", action);
  return el;
}

export function createTideRoom({letter, read, write, cue, delivered, receipt}) {
  let mode, t, course, chart, tape, trip, reference, wanted, selected, cursor, hint, timer;
  let history = [], filed = new Map(), visits = new Map(), running = false;
  function record(m, id = read(reelKey(m, "last"))) {
    if (typeof id !== "string" || !/^[a-z0-9]+$/.test(id)) return null;
    const map = tideCourse(letter, m);
    const saved = sail(map, read(reelKey(m, "wake." + id)));
    return saved?.id === id ? saved : null;
  }
  function save() {
    write(reelKey(mode, "draft"), {tape, selected, cursor, wanted, reference: reference?.id ?? null, history});
  }
  function stop() {
    if (!running) return;
    clearInterval(timer);
    running = false;
    byId("play").textContent = t("reelPlay");
    save();
  }
  function frameText(f) {
    const cell = coordinate(course.board, f.cell), dir = t(directions[f.heading]);
    if (f.event === "launch") return t("reelLaunch", {cell, dir});
    if (f.event === "vane") return t("reelVane", {cell, dir});
    if (f.event === "box") return t("reelAtBox", {cell});
    if (f.event === "sea") return t("reelAtEdge", {cell, dir});
    const enter = coordinate(course.board, f.enter);
    if (f.edge) return t("reelAtBlock", {cell, dir, enter});
    if (f.event === "arch") return t("reelArchFrame", {cell, enter, n: f.next + 1, order: t(f.order > 0 ? "reelForward" : "reelBackward")});
    return t(f.event === "stamp" ? "reelStampFrame" : "reelHelm", {cell, dir, n: f.slot + 1, turn: t("reel_" + helms[tape[f.slot]])});
  }
  function drawFrame() {
    const {board} = course, f = trip.frames[cursor];
    chart.drawLines([{lines: wakeLines(board, trip.frames, cursor)}]);
    const mark = board.marks[0], box = board.tiles.indexOf("M");
    chart.cells[mark].classList.toggle("lit", f.stamped);
    byId("stamp").textContent = t(f.stamped ? "reelStamped" : "reelUnstamped");
    byId("crossings").textContent = t("reelGates", {g: f.gates});
    chart.cells[box].classList.toggle("arrived", cursor === trip.steps && trip.end === "ready");
    const pinCells = new Set(trip.frames.slice(0, cursor + 1).filter(frame => frame.slot === selected).map(frame => frame.cell));
    byId("pins").replaceChildren(...[...pinCells].map(cell => {
      const label = svg("g", {transform: "translate(" + (cell % board.width * 100 + 76) + " " + (Math.floor(cell / board.width) * 100 + 24) + ")"});
      const num = svg("text", {y: 5, "text-anchor": "middle"});
      num.textContent = selected + 1;
      label.append(svg("circle", {r: 11}), num);
      return label;
    }));
    const [x, y] = f.edge || [f.cell % board.width + .5, Math.floor(f.cell / board.width) + .5];
    // Keep the bow visible at an off-chart stop.
    const clamp = (v, limit) => Math.max(17, Math.min(limit * 100 - 17, v * 100));
    byId("boat").setAttribute("transform", "translate(" + clamp(x, board.width) + " " + clamp(y, board.height) + ") rotate(" + f.heading * 90 + ")");
    [...byId("tape").children].forEach((el, i) => el.classList.toggle("sounding", i === f.slot));
    byId("counter").textContent = cursor + " / " + trip.steps;
    byId("scrub").max = trip.steps;
    byId("scrub").value = cursor;
    const passes = visits.get(f.cell);
    const occurrence = f.slot !== null && passes?.length > 1 ? " · " + t("reelVisit", {n: passes.indexOf(cursor) + 1, total: passes.length}) : "";
    const where = frameText(f) + occurrence;
    byId("frame").textContent = where;
    const description = t("reelStep", {n: cursor, total: trip.steps}) + " · " + where;
    byId("scrub").setAttribute("aria-valuetext", description);
    document.getElementById("route-description").textContent = description;
  }
  function render() {
    const pinned = course.pinned.includes(selected);
    const needsGuide = mode === "relaxed" && (!trip.id || (wanted && trip.coast !== wanted));
    const guide = needsGuide ? pilotHint(course, tape, wanted, new Set(filed.keys())) : hint;
    visits = new Map();
    trip.frames.forEach((f, i) => {
      if (f.slot === null) return;
      if (!visits.has(f.cell)) visits.set(f.cell, []);
      visits.get(f.cell).push(i);
    });
    chart.cells.forEach((tile, cell) => {
      if (tile.tagName !== "BUTTON") return;
      const passes = visits.get(cell);
      tile.disabled = !passes;
      const name = coordinate(course.board, cell) + " · " + t(course.board.tiles[cell] === "*" ? "mark" : "water");
      tile.setAttribute("aria-label", passes ? name + " · " + t("reelInspect", {beats: passes.map(i => trip.frames[i].slot + 1).join(" / ")}) : name);
    });
    byId("selected").textContent = t("reelBeat", {n: selected + 1}) + (pinned ? " · " + t("reelFixed") : "");
    [...byId("tape").children].forEach((el, i) => {
      const turn = Number(tape[i]);
      el.querySelector("use").setAttribute("href", "#i-helm" + turn);
      el.setAttribute("aria-pressed", String(selected === i));
      el.classList.toggle("guided", guide?.slot === i);
      const name = t("reelBeat", {n: i + 1}) + " · " + t("reel_" + helms[turn]) + (course.pinned.includes(i) ? " · " + t("reelFixed") : "") + (guide?.slot === i ? t("hinted") : "");
      el.setAttribute("aria-label", name);
      el.title = name;
    });
    [...byId("keys").children].forEach((el, turn) => {
      el.disabled = pinned;
      el.setAttribute("aria-pressed", String(Number(tape[selected]) === turn));
      el.classList.toggle("guided", guide?.turn === turn && guide?.slot === selected);
    });
    const known = filed.has(trip.id);
    const result = trip.id ? t(known ? "reelKnown" : "reelReady", {name: t("reelName_" + trip.coast)}) : t("reelEnd_" + trip.end);
    byId("status").textContent = guide ? result + " " + t("reelHintTurn", {n: guide.slot + 1, turn: t("reel_" + helms[guide.turn])}) : result;
    byId("status").classList.toggle("ready", Boolean(trip.id));
    byId("undo").disabled = !history.length;
    byId("reset").disabled = tape === course.starter && !reference;
    byId("send").disabled = !trip.id;
    byId("hint").hidden = mode !== "standard";
    byId("play").textContent = t(running ? "reelPause" : "reelPlay");
    [...byId("coasts").children].forEach(el => {
      const coast = el.dataset.coast;
      el.setAttribute("aria-pressed", String(wanted === coast));
      el.textContent = ([...filed.values()].some(wake => wake.coast === coast) ? "✓ " : "") + t("reelName_" + coast);
    });
    byId("request").textContent = t(wanted ? "reelNote_" + wanted : "reelFree");
    byId("count").textContent = t("reelCount", {n: filed.size});
    byId("compare").hidden = !reference;
    if (reference) {
      const fork = firstParting(reference, trip);
      byId("compare").textContent = fork ? t("reelFork", {cell: coordinate(course.board, fork.cell), old: t(directions[reference.frames[fork.beat].heading]), now: t(directions[trip.frames[fork.beat].heading])})
        : t(tape === reference.tape ? "reelReference" : "reelSame");
    }
    chart.compareRays(reference ? [{lines: wakeLines(course.board, reference.frames)}] : []);
    drawFrame();
  }
  function refresh() {
    filed = new Map();
    const previous = byId("shelf").value;
    for (const id of tideCatalog(course).keys()) {
      const stored = record(mode, id);
      if (stored) filed.set(id, stored);
    }
    byId("library").hidden = !filed.size;
    byId("shelf").replaceChildren(...[...filed.values()].sort((a, b) => a.steps - b.steps).map(wake =>
      new Option(reelSummary(wake, t) + " · " + [...wake.tape].map(v => arrows[v]).join(""), wake.id)));
    const last = read(reelKey(mode, "last"));
    if (filed.has(previous) || filed.has(last)) byId("shelf").value = filed.has(previous) ? previous : last;
    render();
  }
  function edit(value, ref = reference) {
    stop();
    if (tape !== value || ref?.id !== reference?.id) {
      history.push({tape, reference: reference?.id ?? null});
      history = history.slice(-48);
    }
    reference = ref;
    tape = value;
    trip = sail(course, tape);
    cursor = trip.steps;
    hint = null;
    save();
    render();
  }
  function rework(id) {
    const wake = record(mode, id);
    if (!wake) return;
    selected = wake.frames.find(f => f.event === "stamp").slot;
    wanted = null;
    edit(wake.tape, wake);
    byId("tape").children[selected].focus({preventScroll: true});
  }
  function inspect(cell) {
    stop();
    const passes = visits.get(cell);
    if (!passes) return;
    cursor = passes.find(i => i > cursor) ?? passes[0];
    selected = trip.frames[cursor].slot;
    hint = null;
    save();
    render();
  }
  function mount(m, translate) {
    stop();
    mode = m;
    t = translate;
    course = tideCourse(letter, mode);
    const d = read(reelKey(mode, "draft")) || {};
    tape = fitsDrum(course, d.tape) ? d.tape : course.starter;
    trip = sail(course, tape);
    selected = Number.isInteger(d.selected) && d.selected >= 0 && d.selected < tape.length ? d.selected : mode === "relaxed" ? 5 : 0;
    cursor = Number.isInteger(d.cursor) && d.cursor >= 0 && d.cursor <= trip.steps ? d.cursor : trip.steps;
    wanted = course.coasts.includes(d.wanted) ? d.wanted : null;
    reference = d.reference ? record(mode, d.reference) : null;
    history = Array.isArray(d.history) ? d.history.slice(-48).filter(state => fitsDrum(course, state?.tape)) : [];
    hint = null;
    chart = mountChart(course.board, null, t, {fixedMirrors: true, onInspect: inspect});
    byId("soundings").setAttribute("viewBox", "0 0 " + course.board.width * 100 + " " + course.board.height * 100);
    byId("tape").style.setProperty("--beats", tape.length);
    byId("tape").replaceChildren(...[...tape].map((v, slot) => {
      const el = button(() => { stop(); selected = slot; hint = null; save(); render(); });
      const number = document.createElement("span");
      number.textContent = slot + 1;
      el.append(number, helmIcon(v));
      el.classList.toggle("pinned", course.pinned.includes(slot));
      return el;
    }));
    byId("keys").replaceChildren(...helms.map((name, turn) => {
      const el = button(() => {
        if (course.pinned.includes(selected) || Number(tape[selected]) === turn) return;
        cue("reelPunch");
        edit(tape.slice(0, selected) + turn + tape.slice(selected + 1), reference || filed.get(trip.id));
      });
      el.append(helmIcon(turn), t("reel_" + name));
      return el;
    }));
    byId("coasts").replaceChildren(...course.coasts.map(coast => {
      const el = button(() => { wanted = wanted === coast ? null : coast; hint = null; save(); render(); });
      el.dataset.coast = coast;
      return el;
    }));
    refresh();
  }
  byId("scrub").addEventListener("input", () => {
    stop();
    cursor = byId("scrub").valueAsNumber;
    drawFrame();
    save();
  });
  byId("play").addEventListener("click", () => {
    if (running) { stop(); return; }
    if (cursor === trip.steps) cursor = 0;
    cue("depart");
    running = true;
    byId("play").textContent = t("reelPause");
    drawFrame();
    timer = setInterval(() => {
      cursor++;
      const event = trip.frames[cursor].event;
      if (event === "arch") cue("tide");
      else if (event === "stamp") cue("stamp");
      else if (event === "helm") cue("reelTick");
      drawFrame();
      if (cursor === trip.steps) stop();
    }, 510);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  byId("undo").addEventListener("click", () => {
    stop();
    const prev = history.pop();
    if (!prev) return;
    tape = prev.tape;
    trip = sail(course, tape);
    reference = prev.reference ? record(mode, prev.reference) : null;
    cursor = trip.steps;
    hint = null;
    cue("undo"); save(); render();
  });
  byId("reset").addEventListener("click", () => { cue("reset"); edit(course.starter, null); });
  byId("hint").addEventListener("click", () => {
    stop();
    hint = pilotHint(course, tape, wanted, new Set(filed.keys()));
    if (hint) selected = hint.slot;
    cue("hint"); save(); render();
    if (!hint) byId("status").textContent = t("reelHintDone");
  });
  byId("borrow").addEventListener("click", () => { cue("paper"); rework(byId("shelf").value); });
  byId("read").addEventListener("click", () => { stop(); receipt(byId("shelf").value); });
  byId("send").addEventListener("click", () => {
    if (!trip.id) return;
    stop();
    write(reelKey(mode, "wake." + trip.id), tape);
    write(reelKey(mode, "last"), trip.id);
    save();
    refresh();
    delivered();
    cue("reelPost");
    receipt(trip.id);
  });
  return {mount, stop, refresh, record, rework};
}

export function reelPrint(board, trip, t) {
  const canvas = document.createElement("canvas");
  canvas.width = 780;
  canvas.height = 246;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", reelSummary(trip, t) + " · " + [...trip.tape].map(v => t("reel_" + helms[v])).join(" · "));
  const ctx = canvas.getContext("2d");
  const size = 39, left = 20, top = 25;
  ctx.fillStyle = "#e9d8af"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 9; x < canvas.width; x += 19) {
    ctx.fillStyle = "#a69a7b"; ctx.fillRect(x, 7, 6, 4); ctx.fillRect(x, canvas.height - 11, 6, 4);
  }
  ctx.fillStyle = "#203d49"; ctx.fillRect(left, top, size * board.width, size * board.height);
  ctx.font = "bold 20px Georgia,serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  Array.from(board.tiles).forEach((tile, cell) => {
    const x = left + cell % board.width * size, y = top + Math.floor(cell / board.width) * size;
    ctx.strokeStyle = "#577075"; ctx.lineWidth = 1; ctx.strokeRect(x, y, size, size);
    const mark = cell === board.source ? "☾" : ({"@":"◎", "#":"▴", "*":"✶", M:"▣", A:"╱", B:"╲"})[tile];
    if (mark) { ctx.fillStyle = tile === "@" ? "#ddaee1" : "#d1d9bd"; ctx.fillText(mark, x + size/2, y + size/2); }
  });
  ctx.strokeStyle = "#ffd17b"; ctx.lineWidth = 3; ctx.lineJoin = ctx.lineCap = "round";
  for (const line of wakeLines(board, trip.frames)) {
    ctx.beginPath();
    line.forEach(([x, y], i) => i ? ctx.lineTo(left + x * size, top + y * size) : ctx.moveTo(left + x * size, top + y * size));
    ctx.stroke();
  }
  const start = left + board.width * size + 30;
  ctx.textAlign = "left"; ctx.fillStyle = "#243f42"; ctx.font = "bold 32px system-ui,sans-serif";
  ctx.fillText(t("reelName_" + trip.coast), start, 59);
  ctx.font = "20px system-ui,sans-serif"; ctx.fillText(t("reelStats", {n:trip.steps, g:trip.gates}), start, 105);
  [...trip.tape].forEach((digit, i) => {
    const x = start + i*63;
    ctx.fillStyle = "#cbb78a"; ctx.fillRect(x, 142, 55, 61);
    ctx.fillStyle = "#594e37"; ctx.font = "bold 13px monospace"; ctx.fillText(String(i+1).padStart(2, "0"), x+6, 152);
    ctx.fillStyle = "#234346"; ctx.font = "bold 30px system-ui,sans-serif"; ctx.fillText(arrows[digit], x+13, 184);
  });
  return canvas;
}
