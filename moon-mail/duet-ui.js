import { coordinate, mountChart } from "./chart.js";
import { prepareDuet, initialDuet, restoreDuet, duetMove, gatherDuet, relayMask, relayDuet,
  duetBeat, duetPieces, duetHint, verifiedDuet } from "./duet.mjs";

const el = id => document.getElementById("duet-" + id);
const bearings = ["east", "south", "west", "north"];
const arrows = ["→", "↓", "←", "↑"];
export const duetKey = (mode, field) => "duet.v1." + mode + "." + field;
export function duetSummary(score, t) {
  return t("duetSummary", { mw: score.waits[0], ml: score.lengths[0], sw: score.waits[1], sl: score.lengths[1], n: score.endBeat });
}
function gap(value, t) {
  if (Math.abs(value) === 1) return t(value > 0 ? "duetOneStar" : "duetOneMoon");
  return value ? t(value > 0 ? "duetDelayStar" : "duetDelayMoon", { n: Math.abs(value) }) : t("duetTogether");
}
function terminal(end, t) {
  return t(({dock: "duetAtDesk", ready: "duetAtBox", wrongBox: "duetWrong", blocked: "duetBlocked", loop: "duetLoop", sea: "duetLost"})[end] || "duetNotDocked");
}
function menu(select, choices, value) {
  const changed = choices.length !== select.options.length || choices.some(([key, label], i) => {
    const opt = select.options[i]; return opt.value !== String(key) || opt.text !== label;
  });
  if (changed) select.replaceChildren(...choices.map(([key, label]) => new Option(label, key)));
  select.value = value;
}

export function createSignalDuet({ letter, read, write, cue, delivered, receipt }) {
  let board, mode, t, chart, state, history, score, sent, target, viewing, hint;
  let records = new Map(), pieces = [], beat = 0, solo = -1, timer = null, playing = false, pendingLetter = null;

  function readTake(whichMode, id) {
    if (!["window", "echo", "moon", "star", "round"].includes(id)) return null;
    const proof = read(duetKey(whichMode, "take." + id));
    if (!proof) return null;
    const found = verifiedDuet(prepareDuet(letter, whichMode), proof, id);
    return found ? { id, state: proof, score: found } : null;
  }
  function record(whichMode, id) {
    if (id !== undefined) return readTake(whichMode, id);
    const last = read(duetKey(whichMode, "last"));
    for (const key of new Set([last, "window", "echo", "moon", "star", "round"])) {
      const take = readTake(whichMode, key);
      if (take) return take;
    }
    return null;
  }
  function loadRecords() {
    records = new Map();
    for (const id of pieces) {
      const take = record(mode, id);
      if (take) records.set(id, take);
    }
    if (!records.has(viewing)) viewing = "";
  }
  function save() { write(duetKey(mode, "draft"), { history, sent, target }); }
  function stop() {
    clearTimeout(timer);
    timer = null;
    playing = false;
    pendingLetter = null;
    if (t) el("play").textContent = t("duetPlay");
  }
  function leave() {
    stop();
    board = null;
    viewing = "";
    solo = -1;
    el("markers").hidden = true;
  }
  function mount(newMode, translate) {
    stop();
    const continuing = board && mode === newMode;
    mode = newMode; t = translate;
    board = prepareDuet(letter, mode);
    pieces = duetPieces(board);
    if (!continuing) { viewing = ""; beat = 0; solo = -1; }
    loadRecords();
    const draft = read(duetKey(mode, "draft"));
    state = restoreDuet(board, draft?.history);
    history = state ? draft.history.slice() : [];
    state ??= initialDuet(board);
    target = pieces.includes(draft?.target) ? draft.target : "";
    const signedId = state.stage === "relay" && relayDuet(board, state).id;
    sent = draft?.sent === true && records.has(signedId);
    hint = null;
    chart = mountChart(board, i => move(["mirror", i]), t);
    render();
  }
  function fresh(keepTarget = false) {
    stop(); beat = 0; solo = -1; viewing = ""; hint = null; history = [];
    if (!keepTarget) target = "";
    state = initialDuet(board); sent = false; save(); render();
  }
  function move(action) {
    if (!board || sent || viewing) return;
    const next = duetMove(board, state, action);
    if (!next) return;
    stop(); beat = 0; hint = null;
    state = next; history.push(action); save();
    cue(action[0] === "dock" ? "joint" : action[0] === "mirror" ? "turn" : "paper");
    render();
    if (action[0] === "dock") el("moon").focus({preventScroll: true});
    if (action[0] === "back") document.querySelector("#tiles button:not(:disabled)")?.focus({preventScroll: true});
  }
  function targets() { return target ? [target] : pieces.filter(id => !records.has(id)); }
  function advise() { return duetHint(board, state, targets()); }
  function help(action) {
    if (!action) return "";
    const [key, value] = action;
    if (key === "mirror") return t("duetMirrorHint", { cell: coordinate(board, board.mirrors[value]) });
    if (key === "moon" || key === "star") return t("duetHeadingHint", { ray: t(key === "moon" ? "moonRay" : "starRay"), dir: t(bearings[value]) });
    if (key === "delay") return t("duetDelayHint", { gap: gap(value, t) });
    return key === "back" ? t("duetBackHint") : "";
  }
  function suggested(action) {
    if (!action) return null;
    const [key, i] = action;
    if (key === "mirror") return document.querySelector('#tiles [data-mirror="' + i + '"]');
    return el(["dock", "send"].includes(key) ? "main" : key);
  }
  function paintSolo() {
    const map = document.getElementById("chart");
    if (solo === -1) delete map.dataset.focus;
    else map.dataset.focus = ["moon", "star"][solo];
    for (const button of el("staves").querySelectorAll("button[data-solo]")) {
      const i = +button.dataset.solo;
      button.setAttribute("aria-pressed", String(solo === i));
      button.textContent = (i ? "✦ " : "☾ ") + t(i ? "starRay" : "moonRay") + " · " + t(solo === i ? "duetSoloOn" : "duetSolo");
    }
  }
  function drawSheet(incoming) {
    const staves = el("staves");
    staves.replaceChildren();
    for (let i = 0; i < 2; i++) {
      const row = document.createElement("div");
      row.className = "duet-part";
      row.dataset.voice = i;
      const label = document.createElement("button"), time = document.createElement("small");
      label.type = "button";
      label.dataset.solo = i;
      time.textContent = score?.tracks[i] ? t("duetPart", {wait: score.waits[i], length: score.lengths[i], beat: score.arrivals[i]})
        : terminal((score || incoming).rays[i].end, t);
      row.append(label, time);
      if (score?.paired) {
        const strip = document.createElement("div");
        strip.className = "duet-bars";
        strip.setAttribute("aria-hidden", "true");
        for (let n = 0; n <= score.endBeat; n++) {
          const note = document.createElement("i");
          const event = duetBeat(score, n)[i].event;
          note.dataset.beat = n;
          note.dataset.note = event;
          note.textContent = ({rest:"–", held:"·", start:"▷", arrive:"◆", sail:"●"})[event];
          strip.append(note);
        }
        row.append(strip);
      }
      staves.append(row);
    }
    if (score?.paired) {
      const ruler = document.createElement("div");
      ruler.className = "duet-ruler";
      ruler.setAttribute("aria-hidden", "true");
      for (let n = 0; n <= score.endBeat; n++) {
        const tick = document.createElement("span");
        tick.textContent = score.endBeat <= 11 || n % 2 === 0 || n === score.endBeat ? n : "";
        ruler.append(tick);
      }
      staves.append(ruler);
    }
    el("beat").disabled = el("play").disabled = !score?.paired;
    el("beat").max = score?.endBeat || 1;
    paintSolo(); drawBeat();
  }
  function drawBeat() {
    beat = Math.min(beat, score?.endBeat || 0);
    const positions = score?.paired && duetBeat(score, beat);
    el("beat").value = beat;
    el("play").textContent = t(playing ? "duetStop" : "duetPlay");
    el("markers").hidden = !positions;
    let caption = t("duetAwaitScore");
    if (positions) {
      const cells = positions.map(({point: [x, y], event}, i) => {
        const marker = el("markers").children[i];
        marker.style.left = x / board.width * 100 + "%";
        marker.style.top = y / board.height * 100 + "%";
        return coordinate(board, Math.floor(y) * board.width + Math.floor(x)) + " " + t("duetEvent_" + event);
      });
      caption = t("duetReadBeat", {n: beat, moon: cells[0], star: cells[1]});
      for (const node of el("staves").querySelectorAll("[data-beat]")) node.classList.toggle("current", +node.dataset.beat === beat);
    }
    el("readout").textContent = caption;
    el("beat").setAttribute("aria-valuetext", caption);
  }
  function play(openAfter = null) {
    stop();
    if (!score?.paired) return;
    playing = true; pendingLetter = openAfter; beat = 0;
    function tick() {
      drawBeat();
      cue({ kind: "duet", voices: duetBeat(score, beat), solo });
      if (beat === score.endBeat) {
        const id = pendingLetter;
        stop();
        if (id && board && !document.hidden) receipt(id);
      } else timer = setTimeout(() => { beat++; tick(); }, 300);
    }
    tick();
  }
  function render() {
    const archived = records.get(viewing);
    const active = archived?.state || state;
    const gather = active.stage === "gather";
    const locked = !!archived || sent;
    const incoming = gatherDuet(board, active.mask);
    score = gather ? null : relayDuet(board, active);
    const path = score || incoming;
    const advice = locked ? null : mode === "relaxed" ? advise() : hint;
    chart.draw(gather ? active.mask : relayMask(active), path, advice?.[0] === "mirror" ? advice[1] : undefined, locked);
    document.querySelectorAll("#tiles [data-mirror]").forEach(node => {
      node.classList.toggle("duet-switched", !gather && Number(node.dataset.mirror) === active.switched);
    });
    el("phase").textContent = t(archived ? "duetFiledPhase" : gather ? "duetGather" : "duetRelay");
    el("station").textContent = gather ? t("duetDeskAt", {cell: coordinate(board, board.jointCell), n: incoming.jointCount})
      : active.switched < 0 ? t("duetOneMirror") : t("duetSwitched", {cell: coordinate(board, board.mirrors[active.switched])});
    el("console").hidden = gather;
    for (const key of ["moon", "star"]) {
      menu(el(key), bearings.map((dir, i) => [i, arrows[i] + " " + t(dir)]), active[key]);
      el(key).disabled = locked;
    }
    el("delay").min = -board.maxRest; el("delay").max = board.maxRest; el("delay").value = active.delay;
    el("delay").disabled = locked;
    el("earlier").disabled = locked || active.delay === -board.maxRest;
    el("later").disabled = locked || active.delay === board.maxRest;
    el("rest").textContent = gap(active.delay, t);
    el("delay").setAttribute("aria-valuetext", gap(active.delay, t));
    menu(el("piece"), [["", t("duetFree")], ...pieces.map(id => [id, t("duetName_" + id)])], archived?.id || target);
    el("piece").disabled = !!archived;
    el("clue").textContent = t("duetClue_" + (archived?.id || target || "free"));
    menu(el("archive"), [["", t("duetLiveScore")], ...[...records.keys()].map(id => [id, t("duetName_" + id)])], viewing);
    el("archive-row").hidden = !records.size;
    el("coda").hidden = records.size !== pieces.length;
    el("count").textContent = t("duetCount", {n: records.size, total: pieces.length});
    let status;
    if (locked && score) status = t("duetSigned", {name: t("duetName_" + score.id)});
    else if (gather) status = incoming.jointCount === 2 ? t("duetReachBoth") : t("duetNeedDock", {cell: coordinate(board, board.jointCell)});
    else if (score.synced) status = t("duetInTime", {n: score.endBeat, name: t("duetName_" + score.id)});
    else status = score.paired ? t("duetOffbeat", {moon: score.arrivals[0], star: score.arrivals[1]}) : t("duetNeedBoxes");
    el("status").textContent = help(advice) || status;
    const descriptions = path.rays.map((ray, i) => {
      const cells = [gather ? (i ? board.starSource : board.source) : board.jointCell, ...ray.turns.map(index => board.mirrors[index])];
      if (ray.end === "dock") cells.push(board.jointCell);
      if (ray.end === "ready") cells.push(board.tiles.indexOf(i ? "S" : "M"));
      return [t(i ? "starRay" : "moonRay"), cells.map(cell => coordinate(board, cell)).join(" → "), terminal(ray.end, t)].join(" ");
    });
    document.getElementById("route-description").textContent = [el("phase").textContent, ...descriptions, status].join(" · ");
    el("main").textContent = t(locked ? "read" : gather ? "duetDock" : "duetSend");
    el("main").disabled = !locked && (gather ? incoming.jointCount < 2 : !score.synced);
    el("back").hidden = locked || gather;
    el("undo").disabled = locked || !history.length;
    el("hint").hidden = mode !== "standard";
    el("hint").disabled = locked;
    el("again").hidden = !!archived || !history.length;
    el("live").hidden = !archived;
    for (const node of document.querySelectorAll(".duet-advised")) node.classList.remove("duet-advised");
    if (advice?.[0] !== "mirror") suggested(advice)?.classList.add("duet-advised");
    drawSheet(incoming);
  }

  el("main").addEventListener("click", () => {
    if (!board) return;
    if (viewing || sent) { stop(); receipt(viewing || score.id); return; }
    if (state.stage === "gather") { move(["dock"]); return; }
    if (!score?.synced) return;
    stop();
    const id = score.id;
    solo = -1;
    write(duetKey(mode, "take." + id), { ...state });
    write(duetKey(mode, "last"), id);
    sent = true; save(); loadRecords(); delivered(); render();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) { cue("joint"); receipt(id); }
    else play(id);
  });
  el("undo").addEventListener("click", () => {
    if (sent || viewing || !history.length) return;
    stop(); beat = 0; history.pop(); state = restoreDuet(board, history); hint = null; cue("undo"); save(); render();
  });
  el("hint").addEventListener("click", () => {
    if (mode !== "standard" || sent || viewing) return;
    stop(); hint = advise(); cue("hint"); render(); suggested(hint)?.focus({preventScroll: true});
  });
  for (const key of ["moon", "star", "delay"]) el(key).addEventListener("change", () => move([key, +el(key).value]));
  el("delay").addEventListener("input", () => {
    stop(); const text = gap(+el("delay").value, t); el("rest").textContent = text; el("delay").setAttribute("aria-valuetext", text);
  });
  el("earlier").addEventListener("click", () => move(["delay", state.delay - 1]));
  el("later").addEventListener("click", () => move(["delay", state.delay + 1]));
  el("back").addEventListener("click", () => move(["back"]));
  el("again").addEventListener("click", () => { cue("reset"); fresh(!sent); });
  el("piece").addEventListener("change", () => {
    const piece = el("piece").value;
    stop(); if (sent) fresh();
    target = piece; hint = null; cue("paper"); save(); render();
  });
  el("archive").addEventListener("change", () => {
    stop(); beat = 0; viewing = el("archive").value; hint = null; cue("paper"); render();
  });
  el("live").addEventListener("click", () => { stop(); beat = 0; viewing = ""; render(); });
  el("beat").addEventListener("input", () => { stop(); beat = +el("beat").value; drawBeat(); });
  el("play").addEventListener("click", () => { if (playing) stop(); else play(); });
  el("staves").addEventListener("click", event => {
    const button = event.target.closest("button[data-solo]");
    if (!button) return;
    const voice = +button.dataset.solo;
    solo = solo === voice ? -1 : voice;
    paintSolo();
  });
  el("to-score").addEventListener("click", () => {
    el("book").scrollIntoView({block: "nearest"}); (score?.paired ? el("play") : el("piece")).focus({preventScroll: true});
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  return { mount, leave, stop, record, fresh, refresh() { if (board) { stop(); loadRecords(); hint = null; render(); } } };
}
