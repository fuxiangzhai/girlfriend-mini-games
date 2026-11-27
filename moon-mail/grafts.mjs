import { prepareBoard } from "./puzzle.mjs";

const vectors = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const destinations = ["1", "2", "M"];
const gardens = new WeakMap();

function neighbor(board, cell, dir) {
  const x = cell % board.width + vectors[dir][0], y = Math.floor(cell / board.width) + vectors[dir][1];
  return x < 0 || x >= board.width || y < 0 || y >= board.height ? -1 : y * board.width + x;
}
function segment(a, b) { return Math.min(a, b) + ":" + Math.max(a, b); }
function sameBud(a, b) { return a?.cell === b?.cell && a?.dir === b?.dir; }
function changes(a, b) {
  let count = 0;
  for (let bits = a ^ b; bits; bits &= bits - 1) count++;
  return count;
}

function follow(garden, mask, bud, target, occupied) {
  const {board} = garden;
  let {cell, dir} = bud;
  const cells = [cell], edges = new Set(), mirrors = [];
  let end, tip = null;
  while (!end) {
    const to = neighbor(board, cell, dir);
    const edge = segment(cell, to);
    if (to === -1) end = "edge";
    else if (board.tiles[to] === "#" || to === board.source) end = "blocked";
    else if (occupied.has(edge) || edges.has(edge)) end = "overlap";
    if (end) {
      const length = end === "overlap" ? .22 : .5;
      tip = [cell % board.width + .5 + vectors[dir][0] * length, Math.floor(cell / board.width) + .5 + vectors[dir][1] * length];
      break;
    }
    cell = to;
    cells.push(cell); edges.add(edge);
    const tile = board.tiles[cell];
    if (tile === target) end = "ready";
    else if (tile === "M") end = "earlyMail";
    else if (tile === "2" && target === "1") end = "earlyFlower";
    else if (board.mirrorAt.has(cell)) {
      const index = board.mirrorAt.get(cell);
      mirrors.push(index);
      dir = mask & (1 << index) ? dir ^ 1 : 3 - dir;
    }
  }
  return {cells, edges, mirrors, tip, end};
}

function plantingSites(garden, fixed) {
  const {board} = garden;
  const occupied = new Set(fixed.flatMap(stem => [...stem.edges]));
  const sites = new Map();
  for (const cell of new Set(fixed.flatMap(stem => stem.cells))) {
    if (cell === board.source) continue;
    const exits = vectors.map((_, dir) => dir).filter(dir => {
      const to = neighbor(board, cell, dir);
      return to >= 0 && to !== board.source && board.tiles[to] !== "#" && !occupied.has(segment(cell, to));
    });
    if (exits.length) sites.set(cell, exits);
  }
  return {occupied, sites};
}

export function glassGarden(letter, mode) {
  if (!gardens.has(letter)) gardens.set(letter, new Map());
  const modes = gardens.get(letter);
  if (modes.has(mode)) return modes.get(mode);
  const board = prepareBoard(mode === "expert" ? letter.expert : letter.rows);
  const root = {cell: board.source, dir: ">v<^".indexOf(board.tiles[board.source])};
  const garden = {board, root, initial: board.initial, night: mode === "expert"};
  if (mode === "relaxed") {
    let distance = Infinity;
    for (let mask = 0; mask < 2 ** board.mirrors.length; mask++) {
      const edits = changes(mask, board.initial);
      if (edits < distance && follow(garden, mask, root, "1", new Set()).end === "ready") {
        garden.initial = mask; distance = edits;
      }
    }
  }
  modes.set(mode, garden);
  return garden;
}

export const freshGlass = garden => ({mask: garden.initial, pins: [], bud: null});

// A pin records the joint and bearing. Re-tracing the pressed stems also
// recovers exactly which mirrors and edges must stay fixed after a reload.
export function inspectGlass(garden, state) {
  if (!state || !Number.isInteger(state.mask) || state.mask < 0 || state.mask >= 2 ** garden.board.mirrors.length
      || !Array.isArray(state.pins) || state.pins.length > 2) return null;
  const fixed = [];
  let locked = 0, ground = plantingSites(garden, fixed);
  for (const seed of state.pins) {
    if (fixed.length ? !ground.sites.get(seed?.cell)?.includes(seed.dir) : !sameBud(seed, garden.root)) return null;
    const stem = follow(garden, state.mask, seed, destinations[fixed.length], ground.occupied);
    if (stem.end !== "ready") return null;
    fixed.push(stem);
    for (const mirror of stem.mirrors) locked |= 1 << mirror;
    ground = plantingSites(garden, fixed);
  }
  if (state.bud !== null) {
    const exits = ground.sites.get(state.bud?.cell);
    if (!exits || (state.bud.dir !== null && !exits.includes(state.bud.dir))) return null;
  }
  const seed = fixed.length ? state.bud : garden.root;
  const live = seed && seed.dir !== null ? follow(garden, state.mask, seed, destinations[fixed.length], ground.occupied) : null;
  return {fixed, live, locked, sites: ground.sites, seed};
}

export function tendGlass(garden, state, action) {
  const view = inspectGlass(garden, state);
  if (!view) return null;
  switch (action.type) {
    case "turn": {
      const i = action.index;
      if (!Number.isInteger(i) || i < 0 || i >= garden.board.mirrors.length || (view.locked & (1 << i))) return null;
      return {...state, mask: state.mask ^ (1 << i)};
    }
    case "pick": {
      const exits = view.sites.get(action.cell);
      if (!exits || state.bud?.cell === action.cell) return null;
      return {...state, bud: {cell: action.cell, dir: exits.length === 1 ? exits[0] : null}};
    }
    case "aim":
      if (!state.bud || state.bud.dir === action.dir || !view.sites.get(state.bud.cell)?.includes(action.dir)) return null;
      return {...state, bud: {cell: state.bud.cell, dir: action.dir}};
    case "press":
      if (state.pins.length === 2 || view.live?.end !== "ready") return null;
      return {...state, pins: [...state.pins, view.seed], bud: null};
    case "prune":
      if (!state.pins.length) return null;
      return {...state, pins: state.pins.slice(0, -1), bud: state.pins.length === 2 ? state.pins[1] : null};
    default: return null;
  }
}

const signature = stems => stems.map(stem => stem.cells.join(".")).join("/");

export function specimen(garden, state) {
  const view = inspectGlass(garden, state);
  if (!view || view.fixed.length !== 2 || view.live?.end !== "ready") return null;
  const stems = [...view.fixed, view.live], buds = [...state.pins, state.bud];
  const [one, two] = view.fixed.map(s => s.cells.at(-1));
  let kind = "side";
  if (buds[1].cell === buds[2].cell) kind = "twins";
  else if (buds[1].cell === one) kind = buds[2].cell === two ? "chain" : "root";
  return {id: signature(stems), kind, stems, buds, mask: state.mask, lengths: stems.map(s => s.edges.size)};
}

const collections = new WeakMap();
export function herbarium(garden) {
  if (collections.has(garden)) return collections.get(garden);
  const patterns = new Map();
  function visit(mask, buds, stems, ground) {
    const stage = stems.length;
    const starts = stage ? [...ground.sites].flatMap(([cell, dirs]) => dirs.map(dir => ({cell, dir}))) : [garden.root];
    for (const seed of starts) {
      const live = follow(garden, mask, seed, destinations[stage], ground.occupied);
      if (live.end !== "ready") continue;
      const next = [...stems, live], joints = [...buds, seed];
      if (stage < 2) { visit(mask, joints, next, plantingSites(garden, next)); continue; }
      const id = signature(next);
      if (!patterns.has(id)) patterns.set(id, {id, stems: next, buds: joints, masks: []});
      patterns.get(id).masks.push(mask);
    }
  }
  for (let mask = 0; mask < 2 ** garden.board.mirrors.length; mask++) visit(mask, [], [], plantingSites(garden, []));
  collections.set(garden, patterns);
  return patterns;
}

function compatible(pattern, fixed) {
  return !fixed.length || signature(pattern.stems.slice(0, fixed.length)) === signature(fixed);
}
export function facingPage(garden, pattern) {
  const [first, second, last] = pattern.stems;
  const fromFlower = pattern.buds[1].cell === first.cells.at(-1);
  if (garden.night) {
    if (first.edges.size + second.edges.size + last.edges.size !== 8) return null;
    if (fromFlower) return 0;
    return garden.board.mirrorAt.has(pattern.buds[1].cell) ? 1 : null;
  }
  if (!fromFlower || second.edges.size !== 1) return null;
  if (last.edges.size === 1) return 0;
  const eastWindow = last.cells.some(cell => cell % garden.board.width === garden.board.width - 1);
  return pattern.buds[2].cell === second.cells.at(-1) && eastWindow ? 1 : null;
}
export function cuttingsLeft(garden, fixed, filed, page = null) {
  return [...herbarium(garden).values()].filter(p => !filed.has(p.id) && compatible(p, fixed) && (page === null || facingPage(garden, p) === page)).length;
}
export function takeCutting(sample, keep) {
  return {mask: sample.mask, pins: sample.buds.slice(0, keep), bud: null};
}

export function gardenHint(garden, state, filed = new Set(), page = null) {
  const view = inspectGlass(garden, state), stage = state.pins.length;
  const patterns = [...herbarium(garden).values()].filter(p => page === null || facingPage(garden, p) === page);
  const matches = patterns.filter(p => compatible(p, view.fixed));
  const fresh = matches.filter(p => !filed.has(p.id));
  if (!matches.length) return {type:"prune", retarget:page !== null};
  if (stage && !fresh.length && patterns.some(p => !filed.has(p.id))) return {type:"prune", explored:true};
  let best;
  for (const plan of fresh.length ? fresh : matches) {
    const seed = plan.buds[stage];
    const choiceCost = !stage || sameBud(state.bud, seed) ? 0 : state.bud?.cell === seed.cell ? 1 : 2;
    for (const mask of plan.masks) {
      const cost = choiceCost + changes(mask, state.mask);
      if (!best || cost < best.cost) best = {plan, mask, seed, cost};
    }
  }
  if (stage && state.bud?.cell !== best.seed.cell) return {type:"pick", cell:best.seed.cell};
  if (stage && state.bud.dir !== best.seed.dir) return {type:"aim", dir:best.seed.dir};
  const index = best.plan.stems[stage].mirrors.find(i => (best.mask ^ state.mask) & (1 << i));
  if (index !== undefined) return {type:"turn", index};
  return {type: stage === 2 ? "send" : "press"};
}
