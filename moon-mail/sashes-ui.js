import { coordinate, mountChart } from "./chart.js";
import { trace } from "./puzzle.mjs";
import { adjustWindow, orderMatches, packWindow, prepareSashes, reopenSetting, restoreAdjustments,
  unpackWindow, windowHint, windowJourney, windowSetting } from "./sashes.mjs";

const el = id => document.getElementById("sash-" + id);
const ns = "http://www.w3.org/2000/svg";
const cupName = (board, cell, t) => t(board.marks[0] === cell ? "sashAmber" : "sashBlue");
const cupOrder = (board, lit, t) => lit.size ? [...lit].map(cell => cupName(board, cell, t)).join(" → ") : t("sashCold");
export const sashKey = (mode, field) => "sashes.v1." + mode + "." + field;

export function teaStory({bench, trip}, t) {
  const note = bench.orders.find(order => orderMatches(bench, trip, order));
  return t("sashStory_" + (note || "free"));
}
export function teaSummary({bench, trip}, t) {
  return [cupName(bench.original, trip.first, t), cupName(bench.original, bench.original.marks.find(cell => cell !== trip.first), t)].join(" → ")
    + " · " + t("sashLength", {n:trip.steps}) + " · " + t("sashCrossings", {n:trip.gates});
}

// Print each uninterrupted path separately so ink never bridges the tide gates.
export function teaPrint(record, t) {
  const {bench, trip} = record, b = bench.original;
  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 328;
  canvas.setAttribute("role","img");
  canvas.setAttribute("aria-label", teaSummary(record, t) + ". " + trip.tracks.map(track => track.map(c => coordinate(b,c)).join(" → ")).join(" / "));
  const pen = canvas.getContext("2d");
  pen.fillStyle = "#f4ead4"; pen.fillRect(0,0,720,328);
  pen.strokeStyle = "#b29978"; pen.strokeRect(10,10,700,308);
  const point = cell => [45 + (cell % b.width) * 49, 59 + Math.floor(cell / b.width) * 49];
  for (let cell = 0; cell < b.tiles.length; cell++) {
    const [x,y] = point(cell);
    if (b.tiles[cell] !== "#") { pen.fillStyle = "#b8a384"; pen.fillRect(x-1.6,y-1.6,3.2,3.2); }
  }
  pen.strokeStyle = "#986038"; pen.lineWidth = 4; pen.lineJoin = pen.lineCap = "round";
  for (const track of trip.tracks) {
    pen.beginPath();
    track.forEach((cell,i) => { const [x,y] = point(cell); if (i) pen.lineTo(x,y); else pen.moveTo(x,y); });
    pen.stroke();
  }
  for (const cell of b.gates) {
    const [x,y] = point(cell); pen.lineWidth = 2; pen.strokeStyle = "#65567e";
    pen.strokeRect(x-6,y-6,12,12);
  }
  pen.textAlign = "center"; pen.textBaseline = "middle";
  b.marks.forEach((cell,i) => {
    const [x,y] = point(cell);
    pen.beginPath(); pen.arc(x,y,13,0,2*Math.PI); pen.fillStyle = i ? "#416f80" : "#a75d35"; pen.fill();
    pen.fillStyle = "#fff4de"; pen.font = "bold 17px Georgia, serif"; pen.fillText(cell === trip.first ? "I" : "II", x,y+1);
  });
  const [boxX,boxY] = point(b.tiles.indexOf("M"));
  pen.fillStyle = "#975a42"; pen.fillRect(boxX-7,boxY-5,14,10);
  pen.strokeStyle = "#fff4de"; pen.lineWidth = 1.3;
  pen.beginPath(); pen.moveTo(boxX-6,boxY-4); pen.lineTo(boxX,boxY+1); pen.lineTo(boxX+6,boxY-4); pen.stroke();
  pen.strokeStyle = "#c6b89d"; pen.lineWidth = 1; pen.beginPath(); pen.moveTo(336,39); pen.lineTo(336,288); pen.stroke();
  pen.textAlign = "left"; pen.fillStyle = "#715b46"; pen.font = "20px system-ui, sans-serif"; pen.fillText(t("sashTable"),366,60,310);
  pen.fillStyle = "#3c4d43"; pen.font = "bold 33px Georgia, serif"; pen.fillText(t("sashLength",{n:trip.steps}),366,117,313);
  const second = b.marks.find(cell => cell !== trip.first);
  [trip.first,second].forEach((cell,i) => {
    pen.font = "20px system-ui, sans-serif"; pen.fillStyle = cell === b.marks[0] ? "#864f32" : "#386475";
    pen.fillText((i ? "II" : "I") + "   " + coordinate(b,cell) + "   " + cupName(b,cell,t),366,173+i*35,313);
  });
  pen.font = "18px system-ui, sans-serif"; pen.fillStyle = "#655b57"; pen.fillText(t("sashCrossings",{n:trip.gates}),366,266,310);
  return canvas;
}

function comparison(board, live, ghost, t) {
  const points = ray => ray.lines.flatMap((line,i) => line.map(([x,y]) => [i,x,y]));
  const a = points(live), b = points(ghost);
  let cell = board.source, i = 0;
  while (i < a.length && i < b.length && a[i].every((v,j) => v === b[i][j])) {
    const [,x,y] = a[i++];
    if (x % 1 === .5 && y % 1 === .5) cell = Math.floor(y) * board.width + Math.floor(x);
  }
  return i === a.length && i === b.length ? t("sashSame")
    : t(i === a.length || i === b.length ? "sashEnds" : "sashSplit", {cell:coordinate(board,cell)});
}

export function createMorningWindow({letter, read, write, cue, delivered, receipt}) {
  const editions = new Map(), tiles = document.getElementById("tiles");
  let mode, bench, t, live, memo, sent, goal, show, message, advice, filed, archiveId;
  let chart, mountedPose, ray, trip, grip, skipClick = false;
  function edition(which) {
    const key = which === "expert" ? "night" : "day";
    if (!editions.has(key)) editions.set(key, prepareSashes(letter, which));
    return editions.get(key);
  }
  function readCoaster(which, id) {
    const b = edition(which);
    if (!b.routes.has(id)) return null;
    const state = unpackWindow(b, read(sashKey(which, "cup." + id)));
    if (state === null) return null;
    const setting = windowSetting(b,state), found = windowJourney(setting.board, trace(setting.board,setting.mask));
    return found?.id === id ? {bench:b, state, trip:found} : null;
  }
  function record(which, id) {
    if (id !== undefined) return readCoaster(which,id);
    for (const key of new Set([read(sashKey(which,"last")), ...edition(which).routes.keys()])) {
      const coaster = readCoaster(which,key);
      if (coaster) return coaster;
    }
    return null;
  }
  function loadCoasters() {
    filed = new Map();
    for (const id of bench.routes.keys()) {
      const coaster = readCoaster(mode,id);
      if (coaster) filed.set(id,coaster);
    }
  }
  function recover(actions) {
    const state = restoreAdjustments(bench, actions);
    return state === null ? null : {state, actions:actions.slice()};
  }
  function save() { write(sashKey(mode,"draft"), {live:live.actions, memo:memo?.actions ?? null, show, goal, sent, archiveId}); }
  function mount(which, translate) {
    leave();
    mode = which; t = translate; bench = edition(mode); loadCoasters();
    const draft = read(sashKey(mode,"draft"));
    live = recover(draft?.live) || {state:0,actions:[]}; memo = recover(draft?.memo);
    show = Boolean(memo && draft?.show !== false);
    goal = bench.orders.includes(draft?.goal) ? draft.goal : "";
    sent = draft?.sent === true && filed.has(reading(live).trip?.id);
    archiveId = filed.has(draft?.archiveId) && memo?.state === filed.get(draft.archiveId).state ? draft.archiveId : "";
    advice = message = null; mountedPose = -1;
    updateBook(); render();
  }
  function leave() { clearGrip(); skipClick = false; bench = null; chart = null; }
  function reading(draft) {
    const setting = windowSetting(bench,draft.state), ray = trace(setting.board,setting.mask);
    return {setting,ray,trip:windowJourney(setting.board,ray)};
  }
  function fresh(reference) {
    if (reference && filed.has(reference)) {
      const {state} = filed.get(reference);
      memo = {state, actions:reopenSetting(bench,state)}; archiveId = reference; show = true;
    }
    live = {state:0,actions:[]}; sent = false; advice = message = null;
    save(); render();
  }
  function move(action) {
    if (!bench || sent) return;
    const state = adjustWindow(bench, live.state, action);
    if (state === null) { message = "sashBlocked"; advice = null; cue("limit"); render(); return; }
    const warmed = ray.lit.size;
    live = {state,actions:[...live.actions,action]}; advice = message = null;
    save(); render();
    cue(trip ? "ready" : action < 4 ? "sashGlide" : ray.lit.size > warmed ? "stamp" : "turn");
  }
  function suggest() {
    const acceptable = [...bench.routes.values()].filter(route => !goal || orderMatches(bench,route,goal));
    const fresh = acceptable.filter(route => !filed.has(route.id));
    return windowHint(bench,live.state,new Set((fresh.length ? fresh : acceptable).map(route => route.id)));
  }
  function updateBook() {
    let served = 0;
    el("orders").replaceChildren(...bench.orders.map(id => {
      const button = document.createElement("button"), title = document.createElement("strong"), detail = document.createElement("small");
      button.type = "button"; button.dataset.order = id;
      title.textContent = t("sashName_"+id);
      const lengths = [...filed.values()].filter(({trip})=>orderMatches(bench,trip,id)).map(({trip})=>trip.steps);
      if (lengths.length) served++;
      button.dataset.served = String(Boolean(lengths.length));
      detail.textContent = lengths.length ? "✓ " + t("sashBestLight",{n:Math.min(...lengths)}) : t("sashOpenNote");
      button.append(title,detail);
      return button;
    }));
    el("count").textContent = t("sashCount",{n:filed.size});
    el("notes").textContent = t("sashFinished",{n:served,total:bench.orders.length});
    el("shelf").hidden = !filed.size;
    const choices = [new Option(t("sashPick"),"")];
    let n = 0;
    for (const [id,r] of bench.routes) {
      n++;
      if (filed.has(id)) choices.push(new Option(t("sashPlate",{no:n,n:r.steps,cup:cupName(bench.original,r.first,t)}),id));
    }
    el("album").replaceChildren(...choices);
  }
  function railLines(setting) {
    const svg = el("rails"), strokes = [];
    svg.setAttribute("viewBox", "0 0 " + setting.board.width * 100 + " " + setting.board.height * 100);
    for (const [frame,indices] of bench.frames.entries()) {
      let lo = setting.index, hi = setting.index;
      while (bench.poses[lo].slides[frame * 2] >= 0) lo = bench.poses[lo].slides[frame * 2];
      while (bench.poses[hi].slides[frame * 2 + 1] >= 0) hi = bench.poses[hi].slides[frame * 2 + 1];
      for (const i of indices) {
        const from = bench.poses[lo].board.mirrors[i], to = bench.poses[hi].board.mirrors[i], w = setting.board.width;
        const line = document.createElementNS(ns,"line");
        line.setAttribute("x1", (from % w) * 100 + (frame ? 83 : 10));
        line.setAttribute("x2", (to % w) * 100 + (frame ? 83 : 90));
        line.setAttribute("y1", Math.floor(from / w) * 100 + (frame ? 10 : 83));
        line.setAttribute("y2", Math.floor(to / w) * 100 + (frame ? 90 : 83));
        line.dataset.frame = frame; strokes.push(line);
      }
    }
    svg.replaceChildren(...strokes);
  }
  function draw(setting, hint) {
    const {board,mask,index} = setting;
    if (mountedPose !== index) {
      const focused = tiles.contains(document.activeElement) ? document.activeElement.dataset.mirror : undefined;
      chart = mountChart(board, i => move(4 + bench.groupsAt[i]), t);
      for (const [frame,indices] of bench.frames.entries()) for (const i of indices) {
        const tile = chart.cells[board.mirrors[i]];
        tile.dataset.sashFrame = frame;
        const tab = document.createElement("span"); tab.className = "sash-tab"; tab.setAttribute("aria-hidden","true");
        tab.textContent = frame ? "↕" : "↔"; tile.append(tab);
      }
      board.marks.forEach((cell,i) => chart.cells[cell].querySelector("use").setAttribute("href", i ? "#g-blueCup" : "#g-amberCup"));
      railLines(setting); mountedPose = index;
      if (focused !== undefined) chart.cells[board.mirrors[Number(focused)]]?.focus({preventScroll:true});
    }
    chart.draw(mask,ray,undefined,sent);
    board.marks.forEach(cell => {
      const tile = chart.cells[cell]; tile.classList.add("sash-cup");
      tile.setAttribute("aria-label", [coordinate(board,cell),cupName(board,cell,t),t(ray.lit.has(cell) ? "lit" : "unlit")].join(" · "));
    });
    for (const [i,cell] of board.mirrors.entries()) {
      const group = bench.groupsAt[i], tile = chart.cells[cell];
      if (group < 2) tile.setAttribute("aria-label",t("sashFrameMirror",{cell:coordinate(board,cell),frame:t("sashFrame"+group),slope:t(mask & (1<<i) ? "falling" : "rising")}));
      tile.classList.toggle("sash-guided",hint === group+4 || (hint != null && hint < 4 && group === Math.floor(hint/2)));
    }
    for (const [i,indices] of bench.frames.entries()) el("pos"+i).textContent = indices.map(j=>coordinate(board, board.mirrors[j])).join(" · ");
    for (const btn of el("head").querySelectorAll("[data-sash-action]")) {
      const action = Number(btn.dataset.sashAction);
      btn.disabled = sent || (action < 4 && setting.slides[action] < 0);
      btn.classList.toggle("sash-guided", action === hint);
    }
  }
  function feedback(setting, hint) {
    if (sent) return t("sashPosted");
    if (message) return t(message);
    if (hint != null) {
      const action = hint < 4 ? t("sashSlide"+hint) : hint < 6 ? t("sashTilt"+(hint-4)) : t("sashFixed",{cell:coordinate(setting.board, setting.board.mirrors[bench.groups[hint-4][0]])});
      return t("sashHintAction",{action});
    }
    if (trip) return t(filed.has(trip.id) ? "sashKnown" : "sashReady");
    if (!live.actions.length) return t("sashOpening");
    if (ray.end === "missing") {
      const missing = setting.board.marks.find(cell=>!ray.lit.has(cell));
      return ray.lit.size ? t("sashNeedCup",{cup:cupName(setting.board,missing,t)}) : t("sashNeedBoth");
    }
    return t(ray.end === "blocked" ? "blockedStatus" : ray.end === "loop" ? "loopStatus" : "seaStatus");
  }
  function render() {
    const result = reading(live), {setting} = result;
    ray = result.ray; trip = result.trip;
    const next = sent || mode === "expert" ? null : suggest(), hint = mode === "relaxed" ? next : advice;
    draw(setting,hint);
    el("cups").textContent = cupOrder(setting.board,ray.lit,t) + (trip ? " · " + t("sashLength",{n:trip.steps}) : "");
    el("gates").textContent = t("sashCrossings",{n:ray.lines.length-1});
    el("to-book").textContent = goal ? t("sashName_"+goal) : t("sashBook");
    let status = feedback(setting,hint);
    if (trip && goal) status += " " + t(orderMatches(bench,trip,goal) ? "sashMeet" : "sashMiss",{name:t("sashName_"+goal)});
    el("status").textContent = status;
    el("undo").disabled = el("reset").disabled = !live.actions.length || sent;
    el("hint").hidden = mode !== "standard"; el("hint").disabled = next === null || sent;
    el("send").disabled = !trip; el("send").textContent = t(sent ? "read" : "sashSend");
    el("again").hidden = !sent; el("keep").disabled = sent || memo?.state === live.state;
    el("swap").disabled = sent || !memo || memo.state === live.state;
    el("show").disabled = !memo; el("show").checked = Boolean(memo && show);
    el("album").value = archiveId; el("read").hidden = !filed.has(archiveId);
    el("comparison").hidden = !memo || !show;
    const other = memo && show ? reading(memo) : null, ghost = other?.ray;
    chart.compareRays(ghost ? ghost.rays : []);
    if (ghost) el("comparison").textContent = t("sashComparison",{cups:cupOrder(setting.board,ghost.lit,t),gates:t("sashCrossings",{n:ghost.lines.length-1})})
      + (other.trip ? " · " + t("sashLength",{n:other.trip.steps}) : "") + " · " + comparison(setting.board,ray,ghost,t);
    for (const button of el("orders").children) button.setAttribute("aria-pressed",String(button.dataset.order === goal));
    el("request").textContent = goal ? t("sashNote_"+goal,{n:goal==="long"?bench.longest:bench.shortest,cell:coordinate(setting.board,bench.tideEntry)}) : t("sashFreeText");
  }
  function refresh() {
    if (!bench) return;
    loadCoasters(); if (!filed.has(archiveId)) archiveId = "";
    if (sent && !filed.has(trip?.id)) sent = false;
    updateBook(); render();
  }
  function clearGrip() {
    if (!grip) return;
    for (const node of grip.members) { node.classList.remove("sash-gripped"); node.style.removeProperty("translate"); }
    grip = null;
  }
  tiles.addEventListener("pointerdown", e => {
    if (!bench || sent || !e.isPrimary || e.button !== 0) return;
    skipClick = false;
    const tile = e.target.closest("[data-sash-frame]");
    if (!tile) return;
    const frame = Number(tile.dataset.sashFrame);
    grip = {id:e.pointerId,frame,x:e.clientX,y:e.clientY,threshold:Math.max(12,tile.clientWidth*.24),
      members:tiles.querySelectorAll('[data-sash-frame="'+frame+'"]')};
    tile.setPointerCapture(e.pointerId);
  });
  tiles.addEventListener("pointermove", e => {
    if (!grip || e.pointerId !== grip.id) return;
    const distance = grip.frame ? e.clientY-grip.y : e.clientX-grip.x;
    const offset = Math.max(-grip.threshold,Math.min(grip.threshold,distance))*.7;
    for (const tile of grip.members) {
      tile.classList.add("sash-gripped"); tile.style.translate = grip.frame ? "0 "+offset+"px" : offset+"px 0";
    }
  });
  tiles.addEventListener("pointerup", e => {
    if (!grip || e.pointerId !== grip.id) return;
    const {x,y,frame,threshold} = grip; clearGrip();
    const along = frame ? e.clientY-y : e.clientX-x, across = frame ? e.clientX-x : e.clientY-y;
    if (Math.max(Math.abs(along),Math.abs(across)) < threshold) return;
    skipClick = true;
    if (Math.abs(along) >= Math.abs(across)) move(frame*2 + Number(along>0));
  });
  tiles.addEventListener("pointercancel",clearGrip);
  tiles.addEventListener("lostpointercapture",clearGrip);
  tiles.addEventListener("click", e => { if (bench && skipClick && e.detail) { e.stopImmediatePropagation(); skipClick=false; } },true);
  el("head").addEventListener("click", e => { const btn=e.target.closest("[data-sash-action]"); if (btn) move(Number(btn.dataset.sashAction)); });
  el("undo").addEventListener("click", () => { live = recover(live.actions.slice(0,-1)); advice=message=null; cue("undo"); save(); render(); });
  el("reset").addEventListener("click", () => { cue("reset"); fresh(); });
  el("hint").addEventListener("click", () => { message=null; advice=suggest(); cue("hint"); render(); });
  el("keep").addEventListener("click", () => { memo={...live}; archiveId=""; show=true; advice=null; message="sashKept"; cue("paper"); save(); render(); });
  el("swap").addEventListener("click", () => { [live,memo]=[memo,live]; show=true; archiveId=""; advice=message=null; cue("sashGlide"); save(); render(); });
  el("show").addEventListener("change", e => { show=e.target.checked; message=null; save(); render(); });
  el("again").addEventListener("click", () => { cue("paper"); fresh(trip.id); });
  el("to-book").addEventListener("click", () => el("orders").firstElementChild.focus());
  el("orders").addEventListener("click", e => {
    const button = e.target.closest("[data-order]"); if (!button) return;
    goal = goal === button.dataset.order ? "" : button.dataset.order; advice=message=null; cue("paper");
    if (sent) fresh(trip.id); else { save(); render(); }
    if (matchMedia("(max-width: 680px)").matches) {
      el("head").querySelector("button:not(:disabled)")?.focus({preventScroll:true});
      el("head").scrollIntoView({block:"start"});
    }
  });
  el("album").addEventListener("change", e => {
    archiveId=e.target.value;
    if (archiveId) { const state=filed.get(archiveId).state; memo={state,actions:reopenSetting(bench,state)}; show=true; }
    else show=false;
    advice=message=null; cue("paper"); save(); render();
  });
  el("read").addEventListener("click", () => { if (filed.has(archiveId)) { cue("paper"); receipt(archiveId); } });
  el("send").addEventListener("click", () => {
    if (!trip) return;
    if (!sent) {
      // Keep the first physical setting as the coaster's tracing. Different
      // unused mirror angles can produce exactly the same path through the cups.
      if (!readCoaster(mode,trip.id)) write(sashKey(mode,"cup."+trip.id),packWindow(bench,live.state));
      write(sashKey(mode,"last"),trip.id); sent=true; advice=message=null;
      save(); refresh(); delivered(); cue("teaServed");
    }
    receipt(trip.id);
  });
  return {mount,leave,fresh,refresh,record};
}
