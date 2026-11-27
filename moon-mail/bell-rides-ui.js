import { coordinate, mountChart } from "./chart.js";
import { bellCourse, crank, parked, readRide, rideFork, rideHint, rideStep, rideStyles } from "./bell-rides.mjs";

const el = id => document.getElementById("bike-" + id);
const dirs = ["east", "south", "west", "north"];
const riderName = (t, rider) => t(rider ? "bikeStar" : "bikeMoon");
export const bikeKey = (mode, field) => "bridge-bells.v1." + mode + "." + field;
const axisName = (t, axis) => t(axis ? "bikeVertical" : "bikeHorizontal");
const point = (board, cell) => [cell % board.width + .5, Math.floor(cell / board.width) + .5];

export function rideSummary(ride, t) {
  const first = ride.steps.find(step => step.stop === "box");
  const turns = ride.steps.filter(step => step.stop === "crank").length;
  return t("bikeMoves", {n:ride.code.length}) + " · " + t(turns === 1 ? "bikeTurnOnce" : "bikeTurns", {n:turns})
    + " · " + t("bikeFirst", {who:riderName(t, first.rider)});
}

function drawTracks(board, ride, preview, compare) {
  const ink = [], svg = tag => document.createElementNS("http://www.w3.org/2000/svg", tag);
  function trace(step, planned) {
    if (!step) return;
    const offset = step.rider ? 4 : -4;
    const xy = cell => point(board, cell).map(v => v * 100 + offset);
    for (const line of step.lines) {
      const path = svg("polyline");
      path.setAttribute("points", line.map(cell => xy(cell).join(",")).join(" "));
      path.setAttribute("class", "bike-line rider-" + step.rider + (planned ? " planned" : ""));
      ink.push(path);
    }
    if (planned) {
      const [x,y] = xy(step.to), stop = svg("circle");
      stop.setAttribute("cx", x); stop.setAttribute("cy", y); stop.setAttribute("r", 13);
      stop.setAttribute("class", "bike-landing rider-" + step.rider); ink.push(stop);
    }
  }
  for (const rider of [0, 1]) trace(ride.steps.findLast(step => step.rider === rider), false);
  if (compare && preview?.alone) {
    // Only draw the continuation beyond the borrowed stop. A gate always breaks the ink.
    const index = preview.lines.length - 1;
    const lines = preview.alone.lines.slice(index);
    lines[0] = lines[0].slice(preview.lines[index].length - 1);
    for (const line of lines) {
      const path = svg("polyline");
      path.setAttribute("points", line.map(cell => point(board, cell).map(v => v*100).join(",")).join(" "));
      path.setAttribute("class", "bike-if-line"); ink.push(path);
    }
    const [x,y] = point(board,preview.alone.to).map(v => v*100), ring = svg("circle");
    ring.setAttribute("cx",x); ring.setAttribute("cy",y); ring.setAttribute("r",39);
    ring.setAttribute("class","bike-if-stop"); ink.push(ring);
  }
  trace(preview, true);
  el("tracks").replaceChildren(...ink);
}

function animateCoast(board, piece, step) {
  if (!piece.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const frames = [];
  let time = 0;
  function frame(cell, opacity, elapsed) {
    const [x,y] = point(board, cell);
    time += elapsed;
    frames.push({left:x/board.width*100 + "%", top:y/board.height*100 + "%", opacity, offset:time});
  }
  step.lines.forEach((line,n) => {
    if (n) {
      frame(step.lines[n-1].at(-1),0,.55);
      frame(line[0],0,.1);
      frame(line[0],1,.55);
    } else frame(line[0],1,0);
    for (const cell of line.slice(1)) frame(cell,1,1);
  });
  for (const keyframe of frames) keyframe.offset /= time;
  piece.animate(frames, {duration:Math.min(850,140*time), easing:"linear"});
}

export function createBridgeBells({letter, read, write, cue, delivered, receipt}) {
  let mode, t, course, chart, ride, rider, direction, target, advice, forkAt, compare;
  let best = new Map();
  const riders = [...document.querySelectorAll("#bike-riders button, .bike-piece")];
  const choices = [...el("dirs").children], pages = [...el("pages").children];
  function record(m, code) {
    const map = bellCourse(letter, m);
    const run = readRide(map, code === undefined ? read(bikeKey(m, "last")) : code);
    if (run?.style) return run;
    if (code !== undefined) return null;
    // The page is filed before the bookmark. It can still be opened after an interrupted write.
    for (const style of rideStyles) {
      const page = readRide(map, read(bikeKey(m, "best." + style)));
      if (page?.style === style) return page;
    }
    return null;
  }
  function save() { write(bikeKey(mode, "draft"), {code:ride.code, rider, direction, target}); }
  function refresh() {
    best = new Map();
    for (const style of rideStyles) {
      const run = record(mode, read(bikeKey(mode, "best." + style)) ?? null);
      if (run?.style === style) best.set(style, run);
    }
    render();
  }
  function setCode(code) {
    for (const piece of el("layer").querySelectorAll("button")) piece.getAnimations?.().forEach(anim => anim.cancel());
    ride = readRide(course, code);
    direction = null; advice = false; compare = false;
    if (!ride.style && parked(course, ride.state, rider)) rider = 1 - rider;
    save(); render();
  }
  function move(action) {
    const step = rideStep(course, ride.state, action);
    if (!step) return;
    cue(step.stop === "crank" ? "bikeCrank" : step.stop === "bridge" || step.stop === "box"
      ? (step.rider ? "bikeStar" : "bikeMoon") : step.stop === "partner" ? "bikeMeet" : "bikeWheel");
    setCode(ride.code + action);
    if (step.lines) animateCoast(course.board, el("layer").querySelector('[data-rider="' + step.rider + '"]'), step);
  }
  function selectRider(next) {
    if (parked(course, ride.state, next)) return;
    rider = next; direction = null; compare = false;
    save(); render();
  }
  function selectDirection(dir) {
    if (!rideStep(course, ride.state, rider * 4 + dir)) return;
    direction = dir; compare = false; save(); render();
  }
  function resumeFork(code, style) {
    const prior = readRide(course, code);
    if (!prior || !rideStyles.includes(style)) return;
    target = style;
    const n = rideFork(course, prior, target);
    rider = prior.steps[n]?.rider ?? 0;
    setCode(code.slice(0, n));
    cue("paper"); el("intro").focus({preventScroll:true}); el("head").scrollIntoView({block:"nearest"});
  }
  function another(code) {
    const signed = record(mode, code);
    if (!signed) return;
    const choices = rideStyles.filter(style => style !== signed.style);
    const next = choices.includes(target) ? target : choices.find(style => !best.has(style)) ?? choices[0];
    resumeFork(code, next);
  }
  function describe(step, preview) {
    const text = t(preview ? "bikePreview" : "bikeLanded", {who:riderName(t, step.rider), dir:t(dirs[direction ?? 0]),
      cell:coordinate(course.board, step.to), why:t("bikeStop_" + step.stop)});
    return text + (step.lines.length > 1 ? " " + t("bikeGate") : "");
  }
  function render() {
    const {board} = course, {state, style} = ride;
    const preview = direction === null ? null : rideStep(course, state, rider * 4 + direction);
    const guide = !style && (mode === "relaxed" || advice);
    const next = guide ? rideHint(course, state, target) : null;
    for (const button of riders) {
      const i = Number(button.dataset.rider), cell = state.at[i], docked = parked(course, state, i);
      const text = coordinate(board, cell) + " · " + t(docked ? "bikeParked" : state.bells & (1 << i) ? "bikeRang" : "bikeNoBell")
        + (state.borrowed & (1 << i) ? " · " + t("bikeBorrowed") : "");
      button.disabled = docked;
      button.setAttribute("aria-pressed", String(rider === i));
      button.classList.toggle("bike-guided", next !== null && next < crank && Math.floor(next/4) === i && i !== rider);
      if (button.classList.contains("bike-piece")) {
        button.setAttribute("aria-label", riderName(t, i) + " · " + text);
        const [x,y] = point(board, cell);
        button.style.left = x / board.width * 100 + "%"; button.style.top = y / board.height * 100 + "%";
        button.classList.toggle("on-deck", cell === board.jointCell);
      } else button.querySelector("small").textContent = text;
    }
    const deck = chart.cells[board.jointCell];
    deck.classList.toggle("vertical", Boolean(state.axis));
    deck.setAttribute("aria-label", coordinate(board, board.jointCell) + " · " + t("bikeAxis", {axis:axisName(t,state.axis)}));
    for (const button of choices) {
      const dir = Number(button.dataset.dir), action = rider * 4 + dir, option = rideStep(course, state, action);
      button.disabled = !option;
      button.setAttribute("aria-pressed", String(direction === dir));
      button.querySelector("span").textContent = t(dirs[dir]);
      button.querySelector("small").textContent = option ? coordinate(board, option.to) : t("bikeClosedDir");
      button.classList.toggle("bike-guided", next === action);
    }
    const loan = preview?.stop === "partner";
    el("whatif").hidden = !loan;
    el("whatif").setAttribute("aria-pressed", String(Boolean(loan && compare)));
    el("whatif").textContent = t("bikeWhatIf", {who:riderName(t,1-rider)});
    el("difference").hidden = !loan || !compare;
    if (loan && compare) el("difference").textContent = preview.alone ? t("bikeDifference", {
      here:coordinate(board,preview.to), there:coordinate(board,preview.alone.to)}) : t("bikeNoLanding",{here:coordinate(board,preview.to)});
    drawTracks(board, ride, preview, compare);
    el("moves").textContent = t(ride.code.length === 1 ? "bikeMove" : "bikeMoves", {n:ride.code.length});
    el("axis").textContent = (state.axis ? "↕ " : "↔ ") + t("bikeAxis", {axis:axisName(t, state.axis)});
    el("crank").disabled = Boolean(style);
    el("crank").classList.toggle("bike-guided", next === crank);
    el("main").disabled = !style && !preview;
    el("main").textContent = t(style ? (read(bikeKey(mode, "last")) === ride.code ? "bikeRead" : "bikeSend") : "bikePush");
    el("main").classList.toggle("bike-guided", Boolean(preview) && next === rider * 4 + direction);
    const last = ride.steps.at(-1);
    el("status").textContent = style ? t("bikeReady", {name:t("bikePage_" + style)}) : preview ? describe(preview, true)
      : last?.lines ? describe(last, false) : t("bikePick");
    const detail = preview ?? last;
    document.getElementById("route-description").textContent = detail?.lines ? detail.lines.map(line => line.map(cell => coordinate(board, cell)).join(" → ")).join(" / ") : el("axis").textContent;
    el("hint").hidden = mode !== "standard"; el("hint").disabled = Boolean(style);
    el("advice").hidden = !guide;
    if (guide) el("advice").textContent = next === null ? t(target ? "bikeNoPath" : "bikeNoWay") : next === crank
      ? t("bikeGuideTurn", {axis:axisName(t, 1-state.axis)}) : t("bikeGuideHint", {who:riderName(t, Math.floor(next/4)), dir:t(dirs[next%4])});
    el("undo").disabled = el("reset").disabled = !ride.code.length;
    el("count").textContent = best.size + " / 3";
    for (const page of pages) {
      const id = page.dataset.style;
      page.setAttribute("aria-pressed", String(id === target));
      page.querySelector("b").textContent = best.has(id) ? t("bikeBest", {n:best.get(id).code.length}) : t("bikePageEmpty");
    }
    el("to-book").textContent = target ? t("bikeGoal", {name:t("bikePage_" + target)}) : t("bikeBookLink");
    forkAt = target ? rideFork(course, ride, target) : null;
    el("fork").hidden = forkAt === null || forkAt === ride.code.length;
    el("fork").textContent = t(forkAt ? "bikeFork" : "bikeFromStart", {n:forkAt});
    el("slip").hidden = !best.has(target);
  }
  function mount(m, translate) {
    for (const piece of el("layer").querySelectorAll("button")) piece.getAnimations?.().forEach(anim => anim.cancel());
    mode = m; t = translate; course = bellCourse(letter, m);
    const draft = read(bikeKey(m, "draft")) || {};
    ride = readRide(course, draft.code) ?? readRide(course, "");
    rider = draft.rider === 1 ? 1 : 0;
    if (!ride.style && parked(course, ride.state, rider)) rider = 1-rider;
    direction = Number.isInteger(draft.direction) && draft.direction >= 0 && draft.direction < 4
      && rideStep(course, ride.state, rider*4 + draft.direction) ? draft.direction : null;
    target = rideStyles.includes(draft.target) ? draft.target : null; advice = false; compare = false;
    const {board} = course;
    chart = mountChart(board, null, t, {fixedMirrors:true});
    chart.cells[board.jointCell].querySelector("use").setAttribute("href", "#g-cycledeck");
    for (const cell of [board.source, board.starSource]) chart.cells[cell].setAttribute("aria-hidden", "true");
    el("tracks").setAttribute("viewBox", [0,0,board.width*100,board.height*100].join(" "));
    refresh();
  }
  async function post() {
    const signed = ride, edition = mode;
    const file = () => {
      const field = bikeKey(edition, "best." + signed.style);
      const previous = record(edition, read(field) ?? null);
      if (previous?.style !== signed.style || previous.code.length > signed.code.length) write(field, signed.code);
      write(bikeKey(edition,"last"), signed.code);
    };
    // Two windows can file different lengths on the same page at the same time.
    try {
      if (navigator.locks) await navigator.locks.request(bikeKey(edition, "filing"), file);
      else file();
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
      file(); // Sandboxed local-file viewers can expose Web Locks but deny access.
    }
    delivered();
    if (mode !== edition || el("head").hidden || ride.code !== signed.code) return;
    refresh(); cue("joint"); receipt(signed.code);
  }
  for (const button of riders) button.addEventListener("click", () => selectRider(Number(button.dataset.rider)));
  for (const button of choices) button.addEventListener("click", () => selectDirection(Number(button.dataset.dir)));
  el("crank").addEventListener("click", () => move(crank));
  el("whatif").addEventListener("click", () => { compare = !compare; render(); });
  el("main").addEventListener("click", () => {
    if (ride.style) { void post(); return; }
    if (direction !== null) move(rider * 4 + direction);
  });
  el("undo").addEventListener("click", () => {
    if (!ride.code.length) return;
    rider = ride.steps.at(-1).rider ?? rider;
    setCode(ride.code.slice(0, -1)); cue("undo");
  });
  el("reset").addEventListener("click", () => { rider = 0; setCode(""); cue("reset"); });
  el("hint").addEventListener("click", () => { advice = true; render(); cue("hint"); });
  for (const page of pages) page.addEventListener("click", () => {
    target = target === page.dataset.style ? null : page.dataset.style;
    advice = false; save(); render(); cue("paper");
  });
  el("to-book").addEventListener("click", () => {
    (pages.find(page => page.dataset.style === target) ?? pages[0]).focus({preventScroll:true});
    el("book").scrollIntoView({block:"nearest"});
  });
  el("fork").addEventListener("click", () => resumeFork(ride.code, target));
  el("slip").addEventListener("click", () => { if (best.has(target)) receipt(best.get(target).code); });
  document.querySelector(".chart-panel").addEventListener("keydown", event => {
    if (el("head").hidden || event.altKey || event.ctrlKey || event.metaKey || !event.target.closest("#bike-head,#bike-layer,#bike-controls")) return;
    const dir = ["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].indexOf(event.key);
    if (dir < 0) return;
    event.preventDefault(); selectDirection(dir);
    if (direction === dir) el("main").focus({preventScroll:true});
  });
  return {mount, refresh, record, another};
}

export function ridePrint(board, ride, t) {
  const canvas = document.createElement("canvas");
  canvas.width = 840; canvas.height = 433;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", t("bikePage_" + ride.style) + " · " + rideSummary(ride,t));
  const ctx = canvas.getContext("2d"), size = 46, top = 120;
  ctx.fillStyle = "#f7ecd4"; ctx.fillRect(0,0,840,433);
  ctx.strokeStyle = "#ba9a74"; ctx.lineWidth = 1; ctx.strokeRect(8,8,824,417);
  ctx.beginPath(); ctx.moveTo(420,97); ctx.lineTo(420,411); ctx.stroke();
  ctx.fillStyle = "#3e3f40"; ctx.font = "bold 27px system-ui,sans-serif";
  ctx.fillText(t("bikePage_" + ride.style), 24, 45);
  ctx.font = "18px system-ui,sans-serif"; ctx.fillText(rideSummary(ride, t), 24, 75);
  for (const i of [0,1]) {
    const left = i ? 489 : 69, ink = i ? "#256663" : "#91552e";
    const xy = cell => point(board,cell).map((v,j) => v*size + (j ? top : left));
    const dot = (x,y,r) => {ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();};
    ctx.font="15px system-ui,sans-serif"; ctx.textAlign="center"; ctx.fillStyle="#5b6158";
    for (let x=0;x<board.width;x++) ctx.fillText(String.fromCharCode(65+x),left+(x+.5)*size,top-8);
    for (let y=0;y<board.height;y++) ctx.fillText(String(y+1),left-14,top+(y+.5)*size+5);
    ctx.textAlign="start"; ctx.fillStyle = "#faf5e7"; ctx.fillRect(left,top,size*board.width,size*board.height);
    for (const [cell,tile] of Array.from(board.tiles).entries()) {
      const [x,y] = xy(cell);
      ctx.lineWidth = 1; ctx.strokeStyle = "#d2c8ad"; ctx.strokeRect(x-size/2,y-size/2,size,size);
      if (tile === "#") {ctx.fillStyle="#aca69b";ctx.fillRect(x-11,y-11,22,22);}
      if (tile === "A" || tile === "B") {
        const dy = tile === "A" ? 9 : -9;
        ctx.strokeStyle="#afa99b"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x-9,y+dy); ctx.lineTo(x+9,y-dy); ctx.stroke();
      }
      if (tile === "@") {ctx.beginPath();ctx.arc(x,y,9,0,2*Math.PI);ctx.strokeStyle="#819c98";ctx.lineWidth=2;ctx.stroke();}
      if (tile === "&") {ctx.fillStyle="#eac78f";dot(x,y,11);}
    }
    const rides = ride.steps.filter(step => step.rider === i);
    ctx.strokeStyle=ink; ctx.lineWidth=3; ctx.lineCap=ctx.lineJoin="round"; ctx.setLineDash(i ? [6,4] : []);
    for (const step of rides) for (const line of step.lines) {
      ctx.beginPath();
      line.forEach((cell,n) => {const [x,y]=xy(cell); if(n) ctx.lineTo(x,y); else ctx.moveTo(x,y);});
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.fillStyle=ink;
    for (const step of rides) {
      const [x,y]=xy(step.to);
      if (step.stop === "partner") {ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-5,-5,10,10);ctx.restore();}
      else if (step.stop === "box") {ctx.fillRect(x-6,y-5,12,10);ctx.strokeStyle="#fff3d6";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-5,y-4);ctx.lineTo(x,y);ctx.lineTo(x+5,y-4);ctx.stroke();}
      else dot(x,y,2.8);
    }
    ctx.font="bold 21px system-ui,sans-serif"; ctx.fillText((i ? "✦ " : "☾ ") + riderName(t,i),left,384);
    const loan = rides.find(s => s.stop === "partner");
    ctx.font="16px system-ui,sans-serif";
    ctx.fillText(loan ? "◆ " + t("bikeSlipStop",{who:riderName(t,i),cell:coordinate(board,loan.to)})
      : coordinate(board, i ? board.starSource : board.source) + " → " + coordinate(board,board.jointCell) + " → " + coordinate(board,rides.at(-1).to), left,408);
  }
  return canvas;
}
