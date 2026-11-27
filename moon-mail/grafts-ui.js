import { coordinate, mountChart } from "./chart.js";
import { cuttingsLeft, facingPage, freshGlass, gardenHint, glassGarden, herbarium, inspectGlass, specimen, takeCutting, tendGlass } from "./grafts.mjs";

const el = id => document.getElementById("graft-" + id);
const bearings = ["east", "south", "west", "north"];
export const graftKey = (mode, field) => "glasshouse-grafts.v1." + mode + "." + field;
const total = sample => sample.lengths.reduce((a, b) => a + b, 0);
export function specimenSummary(board, sample, t) {
  const [, a, b] = sample.buds;
  return t("graftSummary", {a: coordinate(board, a.cell), ad: t(bearings[a.dir]), b: coordinate(board, b.cell), bd: t(bearings[b.dir]), n: total(sample)});
}
function center(board, cell) { return [cell % board.width + .5, Math.floor(cell / board.width) + .5]; }
function element(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

export function createGlasshouse({letter, read, write, cue, delivered, receipt}) {
  let mode, t, garden, chart, state, hint, wanted = null;
  let history = [], filed = new Map();
  const dirs = [...el("compass").querySelectorAll("button")];
  function record(m, id = read(graftKey(m, "last"))) {
    if (typeof id !== "string" || id.length > 512 || !/^[0-9./]+$/.test(id)) return null;
    const saved = specimen(glassGarden(letter, m), read(graftKey(m, "sheet." + id)));
    return saved?.id === id ? saved : null;
  }
  function save() { write(graftKey(mode, "draft"), {state, history, wanted}); }
  function change(next) {
    if (!next) return;
    history.push(state);
    history = history.slice(-48);
    state = next;
    hint = null;
    save(); render();
  }
  function act(action) {
    const next = tendGlass(garden, state, action);
    if (!next) return;
    cue(({turn:"turn", pick:"graftBud", aim:"graftBud", press:"graftPress", prune:"paper"})[action.type]);
    change(next);
    if (action.type === "press" || action.type === "prune") el("instruction").focus({preventScroll: true});
  }
  function tapCell(cell) {
    const view = inspectGlass(garden, state);
    if (view.sites.has(cell)) act({type:"pick", cell});
    else if (garden.board.mirrorAt.has(cell)) act({type:"turn", index:garden.board.mirrorAt.get(cell)});
  }
  function openBook() {
    const edition = garden.night ? "Night" : "Day";
    const pages = [...el("pages").children];
    const collection = [...filed.values()];
    for (const [i, btn] of pages.entries()) {
      const example = collection.find(s => facingPage(garden, s) === i);
      btn.setAttribute("aria-pressed", String(wanted === i));
      btn.querySelector("strong").textContent = t("graftPage" + edition + i);
      btn.querySelector("small").textContent = t(example ? "graftFiledPage" : "graftOpenPage");
      const art = btn.querySelector("svg");
      art.replaceChildren();
      if (!example) {
        art.append(element("path", {d:"M32 59Q52 54 74 20M48 49Q34 47 33 34Q48 35 50 46M58 38Q59 22 72 19Q72 30 61 37M54 43Q73 44 79 32Q62 31 54 43", class:"waiting-leaf"}));
        continue;
      }
      example.stems.forEach((stem, stage) => {
        const points = stem.cells.map(cell => {
          const [x,y]=center(garden.board,cell); return [12+x*16,3+y*14].join(",");
        }).join(" ");
        art.append(element("polyline",{points,class:"sample-trace trace-" + stage}));
        const [x,y]=center(garden.board,stem.cells.at(-1));
        art.append(element("circle",{cx:12+x*16,cy:3+y*14,r:3.1,class:"sample-dot trace-" + stage}));
      });
    }
    const both = [0,1].every(i => collection.some(s => facingPage(garden, s) === i));
    el("study").textContent = t(wanted !== null ? "graftWish" + edition + wanted : (both ? "graftPair" : "graftStudy") + edition);
    const sample = filed.get(el("specimens").value);
    el("shelf").hidden = !sample; el("empty").hidden = Boolean(sample);
    el("count").textContent = t("graftCount", {n: filed.size});
    if (!sample) return;
    el("caption").textContent = specimenSummary(garden.board, sample, t);
    for (const keep of [1, 2]) {
      const n = cuttingsLeft(garden, sample.stems.slice(0, keep), filed);
      const title = document.createElement("strong");
      title.textContent = t("graftKeep" + keep);
      const note = document.createElement("small");
      note.textContent = t(n ? "graftUnseen" : "graftExhausted", {n});
      el("keep" + keep).replaceChildren(title, note);
    }
  }
  function refresh() {
    const choice = el("specimens").value;
    filed = new Map();
    for (const id of herbarium(garden).keys()) {
      const saved = record(mode, id);
      if (saved) filed.set(id, saved);
    }
    el("specimens").replaceChildren(...[...filed.values()].map(sample => {
      const joints = sample.buds.slice(1).map(bud => coordinate(garden.board, bud.cell) + ["→","↓","←","↑"][bud.dir]);
      return new Option(t("graftName_" + sample.kind) + " · " + joints.join(" / "), sample.id);
    }));
    const last = read(graftKey(mode, "last"));
    if (filed.has(choice) || filed.has(last)) el("specimens").value = filed.has(choice) ? choice : last;
    openBook(); render();
  }
  function keepCutting(id, keep) {
    const sample = record(mode, id);
    if (!sample) return;
    // From a letter, keep the longest living prefix that still has a new ending.
    if (keep === undefined) {
      const page = facingPage(garden, sample);
      if (page !== null && (wanted === null || wanted === page) && cuttingsLeft(garden, [], filed, 1-page)) wanted = 1-page;
      else if (wanted !== null && !cuttingsLeft(garden, [], filed, wanted)) wanted = null;
    }
    const depth = keep ?? (cuttingsLeft(garden, sample.stems.slice(0, 2), filed, wanted) ? 2 : 1);
    change(takeCutting(sample, depth));
    el("specimens").value = id;
    openBook(); cue("paper");
    el("instruction").focus({preventScroll: true});
    el("head").scrollIntoView({block:"nearest"});
  }
  function drawStems(view) {
    const {board} = garden;
    const ink = [];
    view.fixed.forEach((stem, i) => {
      const points = stem.cells.map(cell => center(board, cell).map(v => v*100).join(",")).join(" ");
      ink.push(element("polyline", {points, class:"pressed-stem stem-" + i}));
      // Paired leaflets sit between squares so joints and mirror faces stay legible.
      stem.cells.slice(1).forEach((cell, n) => {
        if (n % 2) return;
        const [ax, ay] = center(board, stem.cells[n]), [bx, by] = center(board, cell);
        const angle = Math.atan2(by-ay, bx-ax) * 180 / Math.PI;
        ink.push(element("path", {d:"M-5 0Q-7-12 6-12Q7-3-5 0M3 0Q8 8 15 5Q13-1 3 0Z",
          class:"pressed-leaf stem-" + i, transform:"translate(" + (ax+bx)*50 + " " + (ay+by)*50 + ") rotate(" + angle + ")"}));
      });
    });
    el("stems").replaceChildren(...ink);
    const points = view.live?.cells.map(cell => center(board, cell)) || [];
    if (view.live?.tip) points.push(view.live.tip);
    chart.drawLines([{lines: points.length ? [points] : []}]);
  }
  function hintText(action) {
    if (action.retarget) return t("graftHint_retarget");
    if (action.explored) return t("graftHint_explored");
    const cell = action.type === "turn" ? garden.board.mirrors[action.index] : action.cell ?? state.bud?.cell;
    return t("graftHint_" + action.type, {cell: cell === undefined ? "" : coordinate(garden.board, cell),
      dir: action.dir === undefined ? "" : t(bearings[action.dir])});
  }
  function render() {
    const {board} = garden, stage = state.pins.length;
    const view = inspectGlass(garden, state), sample = specimen(garden, state);
    const guide = mode === "relaxed" ? gardenHint(garden, state, filed, wanted) : hint;
    const ready = view.live?.end === "ready";
    el("stems").parentElement.dataset.graftStage = stage;
    for (const [i, li] of [...el("stages").children].entries()) {
      li.dataset.phase = i < stage ? "pressed" : i === stage ? "active" : "waiting";
      if (i === stage) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      li.querySelector("b").textContent = i < stage ? t("graftPinned", {n:view.fixed[i].edges.size})
        : i === stage && ready ? t("graftReached", {n:view.live.edges.size}) : t(i === stage ? "graftGrowing" : "graftPending");
    }
    drawStems(view);
    chart.cells.forEach((node, cell) => {
      const tile = board.tiles[cell], mirror = board.mirrorAt.get(cell), site = view.sites.has(cell);
      const pressed = mirror !== undefined && Boolean(view.locked & (1 << mirror));
      node.classList.toggle("graft-site", site);
      node.classList.toggle("graft-picked", state.bud?.cell === cell);
      if (state.bud?.cell === cell && state.bud.dir !== null) node.dataset.graftArrow = ["→","↓","←","↑"][state.bud.dir];
      else delete node.dataset.graftArrow;
      node.classList.toggle("graft-fixed", pressed);
      node.classList.toggle("graft-guided", (guide?.type === "pick" && guide.cell === cell) || (guide?.type === "turn" && guide.index === mirror));
      if (tile === "1" || tile === "2") node.classList.toggle("lit", Number(tile) <= stage || (Number(tile) === stage+1 && ready));
      if (tile === "M") node.classList.toggle("arrived", Boolean(sample));
      if (node.tagName !== "BUTTON") return;
      node.disabled = mirror === undefined || pressed ? !site : false;
      if (site) node.setAttribute("aria-pressed", String(state.bud?.cell === cell)); else node.removeAttribute("aria-pressed");
      const pos = coordinate(board, cell);
      let name = tile === "." ? t("water") : mirror !== undefined ? t("mirror") : t("graftPart" + (Number(tile)-1));
      if (mirror !== undefined) {
        const falling = Boolean(state.mask & (1 << mirror));
        node.classList.toggle("falling", falling);
        name = pressed ? t("graftLocked", {cell:pos}) : t("mirrorLabel", {cell:pos, slope:t(falling ? "falling" : "rising")});
      }
      node.setAttribute("aria-label", site ? t("graftSite", {cell:pos, tile:mirror !== undefined ? t("graftMirror") : name})
        : mirror !== undefined ? name : pos + " · " + name);
    });
    el("instruction").textContent = t("graftIntro" + stage);
    el("to-book").textContent = wanted === null ? t("graftPages") : t("graftChoice", {name:t("graftPage" + (garden.night ? "Night" : "Day") + wanted)});
    el("compass").hidden = stage === 0;
    el("joint").textContent = state.bud ? t("graftJoint", {cell:coordinate(board, state.bud.cell)}) : t("graftPick");
    dirs.forEach(btn => {
      const dir = Number(btn.dataset.graftDir);
      btn.disabled = !view.sites.get(state.bud?.cell)?.includes(dir);
      btn.setAttribute("aria-pressed", String(state.bud?.dir === dir));
      btn.classList.toggle("graft-guided", guide?.type === "aim" && guide.dir === dir);
    });
    const otherPage = sample && wanted !== null && facingPage(garden, sample) !== wanted;
    const status = sample ? t(otherPage ? "graftOtherPage" : filed.has(sample.id) ? "graftKnown" : "graftNew") : ready ? t("graftToPress")
      : view.live ? t("graftEnd_" + view.live.end) : state.bud ? t("graftChooseDir", {cell:coordinate(board, state.bud.cell)}) : t("graftChooseSite");
    el("status").textContent = guide && !["press","send"].includes(guide.type) ? status + " " + hintText(guide) : status;
    el("status").classList.toggle("ready", ready);
    // Expose the actual route as an ordered set of squares for keyboard and screen-reader players.
    const stems = view.live ? [...view.fixed, view.live] : view.fixed;
    document.getElementById("route-description").textContent = stems.map((stem, i) =>
      t("graftPart" + i) + " · " + stem.cells.map(cell => coordinate(board, cell)).join(" → ")).join(". ");
    el("main").textContent = t(stage < 2 ? "graftPress" + stage : "graftSend");
    el("main").disabled = !ready;
    el("main").classList.toggle("graft-guided", guide?.type === "press" || guide?.type === "send");
    el("prune").disabled = !stage;
    el("prune").classList.toggle("graft-guided", guide?.type === "prune");
    el("undo").disabled = !history.length;
    el("hint").hidden = mode !== "standard";
    el("reset").disabled = !stage && state.mask === garden.initial;
  }
  function mount(m, translate) {
    mode = m; t = translate; garden = glassGarden(letter, m);
    const draft = read(graftKey(m, "draft")) || {};
    wanted = draft.wanted === 0 || draft.wanted === 1 ? draft.wanted : null;
    state = inspectGlass(garden, draft.state) ? draft.state : freshGlass(garden);
    history = Array.isArray(draft.history) ? draft.history.slice(-48).filter(s => inspectGlass(garden, s)) : [];
    hint = null;
    chart = mountChart(garden.board, i => tapCell(garden.board.mirrors[i]), t, {onInspect:tapCell, inspectSeals:true});
    for (const cell of garden.board.marks) {
      const tile = chart.cells[cell];
      tile.dataset.flower = garden.board.tiles[cell];
      tile.querySelector("use").setAttribute("href", tile.dataset.flower === "1" ? "#g-blossom" : "#g-bellflower");
    }
    el("stems").setAttribute("viewBox", "0 0 " + garden.board.width*100 + " " + garden.board.height*100);
    refresh();
  }
  for (const btn of dirs) btn.addEventListener("click", () => act({type:"aim", dir:Number(btn.dataset.graftDir)}));
  document.getElementById("chart").addEventListener("keydown", event => {
    if (el("head").hidden || !event.target.closest(".graft-picked") || event.altKey || event.ctrlKey || event.metaKey) return;
    const dir = ["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].indexOf(event.key);
    if (dir < 0) return;
    event.preventDefault();
    act({type:"aim", dir});
  });
  el("main").addEventListener("click", () => {
    if (state.pins.length < 2) { act({type:"press"}); return; }
    const sample = specimen(garden, state);
    if (!sample) return;
    write(graftKey(mode, "sheet." + sample.id), state);
    write(graftKey(mode, "last"), sample.id);
    save(); refresh();
    el("specimens").value = sample.id; openBook();
    delivered(); cue("graftPost"); receipt(sample.id);
  });
  el("undo").addEventListener("click", () => {
    if (!history.length) return;
    state = history.pop(); hint = null; save(); render(); cue("undo");
  });
  el("prune").addEventListener("click", () => act({type:"prune"}));
  el("reset").addEventListener("click", () => { change(freshGlass(garden)); cue("reset"); });
  el("hint").addEventListener("click", () => { hint = gardenHint(garden, state, filed, wanted); render(); cue("hint"); });
  for (const btn of el("pages").children) btn.addEventListener("click", () => {
    const page = Number(btn.dataset.leaf);
    wanted = wanted === page ? null : page;
    hint = null; save(); openBook(); render(); cue("paper");
  });
  el("to-book").addEventListener("click", () => {
    el("pages").children[wanted ?? 0].focus({preventScroll:true});
    el("book").scrollIntoView({block:"nearest"});
  });
  el("specimens").addEventListener("change", openBook);
  for (const n of [1, 2]) el("keep"+n).addEventListener("click", () => keepCutting(el("specimens").value, n));
  el("read").addEventListener("click", () => receipt(el("specimens").value));
  return {mount, record, refresh, keepCutting};
}

export function pressPrint(board, sample, t) {
  const canvas = document.createElement("canvas");
  canvas.width = 840; canvas.height = 290;
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", specimenSummary(board, sample, t));
  const ctx = canvas.getContext("2d"), size = 44, x0 = 22, y0 = 34;
  const colors = ["#53704e", "#984d38", "#63618a"];
  const dot = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x,y,r,0,2*Math.PI); ctx.fillStyle=fill; ctx.fill(); };
  ctx.fillStyle = "#eee6cc"; ctx.fillRect(0, 0, 840, 290);
  ctx.strokeStyle = "#97977b"; ctx.lineWidth = 1; ctx.strokeRect(8, 8, 824, 274);
  ctx.fillStyle = "#f8f1da"; ctx.fillRect(x0,y0,board.width*size,board.height*size);
  Array.from(board.tiles).forEach((tile, cell) => {
    const x = x0 + cell % board.width * size, y = y0 + Math.floor(cell/board.width) * size;
    ctx.strokeStyle = "#d1ccb7"; ctx.strokeRect(x,y,size,size);
    if (tile === "#") { ctx.fillStyle="#cbc8b5"; ctx.fillRect(x+9,y+9,size-18,size-18); }
  });
  for (const [i, stem] of sample.stems.entries()) {
    const xy = stem.cells.map(cell => center(board, cell).map((v,j) => v*size + (j ? y0 : x0)));
    ctx.strokeStyle=colors[i]; ctx.lineWidth=4.5; ctx.lineCap=ctx.lineJoin="round";
    ctx.setLineDash(i === 2 ? [7, 3] : []);
    ctx.beginPath(); xy.forEach(([x,y],j) => j ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.stroke(); ctx.setLineDash([]);
    for (let j=1; j<xy.length; j+=2) {
      const [x,y]=xy[j-1], [nx,ny]=xy[j];
      ctx.save(); ctx.translate((x+nx)/2,(y+ny)/2); ctx.rotate(Math.atan2(ny-y,nx-x)-.65);
      ctx.fillStyle=colors[i]; ctx.beginPath(); ctx.ellipse(0,-2,6,2.6,0,0,2*Math.PI); ctx.fill(); ctx.restore();
    }
    const [ex,ey]=xy.at(-1);
    if (i<2) {
      for (let p=0;p<5;p++) { const a=(p*2/5-.5)*Math.PI; dot(ex+6*Math.cos(a), ey+6*Math.sin(a), 5, i ? "#9583ac" : "#d99462"); }
      dot(ex,ey,4,"#efd083");
    } else { ctx.fillStyle=colors[i]; ctx.fillRect(ex-8,ey-6,16,12); ctx.strokeStyle="#fff4d7"; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ex-7,ey-5); ctx.lineTo(ex,ey);ctx.lineTo(ex+7,ey-5);ctx.stroke(); }
  }
  const tagX = x0 + board.width*size + 30;
  ctx.fillStyle="#2f4c3a"; ctx.font="bold 32px system-ui,sans-serif";
  ctx.fillText(t("graftName_"+sample.kind),tagX,62);
  ctx.font="18px system-ui,sans-serif"; ctx.fillText(t("graftBook") + " · " + t("graftLength", {n:total(sample)}),tagX,97);
  for (const [i,bud] of sample.buds.entries()) {
    const y = 132 + 42*i;
    ctx.fillStyle=colors[i]; ctx.fillRect(tagX,y-11,5,20);
    ctx.font="bold 20px system-ui,sans-serif"; ctx.fillText(t("graftPart"+i),tagX+15,y+6);
    ctx.font="18px system-ui,sans-serif"; ctx.fillText(coordinate(board,bud.cell) + " " + ["→","↓","←","↑"][bud.dir] + "   ·   " + t("graftLength",{n:sample.lengths[i]}), tagX+225, y+6);
  }
  return canvas;
}
