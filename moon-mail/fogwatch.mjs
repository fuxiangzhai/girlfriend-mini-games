import { closestRoute, prepareBoard, trace, traceShore } from "./puzzle.mjs";

// These shore stations were chosen on the two existing Wind Chime Pier charts.
// Each hidden arrangement has a unique transcript. The order deals out shifts
// without repeats, with a two-observation case on the first standard watch.
const editions = [
  { hidden: ["E1", "C4", "E4"], falling: ["C3"], ports: ["N5", "E4", "S3", "S5"], shifts: [5, 2, 7, 0, 3, 4, 1, 6] },
  { hidden: ["D1", "F1", "E4", "C5"], falling: ["A2", "D2", "C4"], ports: ["N4", "E1", "E3", "S3", "S5"],
    shifts: [9, 2, 13, 7, 4, 10, 0, 15, 6, 11, 1, 12, 5, 14, 3, 8] },
];
const cache = new WeakMap();

// A keeper can hear the chimes in first-visit order and see which shore
// answered. The exact exit cell and the journey through the fog stay private.
export function hearShore(board, mask, port) {
  const { ray, report } = traceShore(board, mask, port);
  return { ray, report: report.replace(/[0-9]+$/, "") };
}

export function prepareWatch(letter, difficulty) {
  if (letter.id !== "chimes") throw new RangeError("Fog watch is available at Wind Chime Pier");
  if (!cache.has(letter)) cache.set(letter, new Map());
  const expert = difficulty === "expert";
  if (cache.get(letter).has(expert)) return cache.get(letter).get(expert);
  const board = prepareBoard(expert ? letter.expert : letter.rows);
  const spec = editions[Number(expert)];
  const bit = label => {
    const cell = (Number(label.slice(1)) - 1) * board.width + label.charCodeAt(0) - 65;
    return 1 << board.mirrorAt.get(cell);
  };
  const combine = labels => labels.reduce((value, label) => value | bit(label), 0);
  const hidden = combine(spec.hidden), known = combine(spec.falling);
  const masks = Array.from({ length: 2 ** board.mirrors.length }, (_, i) => i).filter(mask => (mask & ~hidden) === known);
  const reports = new Map(masks.map(mask => [mask, spec.ports.map(port => hearShore(board, mask, port).report)]));
  const watch = { board, hidden, known, masks, reports, ports: spec.ports, shifts: spec.shifts.map(i => masks[i]) };
  cache.get(letter).set(expert, watch);
  return watch;
}

export function publicEvidence(watch, shift, heard) {
  return heard.map(port => ({ port, report: watch.reports.get(watch.shifts[shift])[port] }));
}
export function possibleMirrors(watch, evidence) {
  return watch.masks.filter(mask => evidence.every(({ port, report }) => watch.reports.get(mask)[port] === report));
}

// Explain a single mirror from observations alone. A certificate uses the
// smallest subset of entries that forces the same slope across every layout.
export function readMirror(watch, evidence, index) {
  const bit = 1 << index;
  const possible = possibleMirrors(watch, evidence);
  const falling = possible.filter(mask => mask & bit).length, rising = possible.length - falling;
  if (rising && falling) return { rising, falling };
  let proof = evidence;
  for (let subset = 0; subset < 2 ** evidence.length; subset++) {
    const entries = evidence.filter((_, i) => subset & (1 << i));
    if (entries.length >= proof.length) continue;
    if (possibleMirrors(watch, entries).every(mask => Boolean(mask & bit) === Boolean(falling))) proof = entries;
  }
  return { rising, falling, proof };
}

// Minimise the worst remaining number of calls. Break ties by the size of the
// worst branch, then by expected survivors. This never reads the hidden shift.
export function advisePort(watch, possible, memo = new Map()) {
  if (possible.length <= 1) return { depth: 0 };
  const key = possible.join(",");
  if (memo.has(key)) return memo.get(key);
  let best;
  for (let port = 0; port < watch.ports.length; port++) {
    const groups = new Map();
    for (const mask of possible) {
      const response = watch.reports.get(mask)[port];
      if (!groups.has(response)) groups.set(response, []);
      groups.get(response).push(mask);
    }
    if (groups.size < 2) continue;
    const branches = [...groups.values()];
    const sizes = branches.map(p => p.length).sort((a, b) => b - a);
    const depth = 1 + Math.max(...branches.map(p => advisePort(watch, p, memo).depth));
    const spread = sizes.reduce((sum, n) => sum + n * n, 0);
    if (!best || depth < best.depth || (depth === best.depth && (sizes[0] < best.sizes[0] || (sizes[0] === best.sizes[0] && spread < best.spread)))) {
      best = { port, sizes, depth, spread };
    }
  }
  memo.set(key, best);
  return best;
}

export function watchPar(watch, shift) {
  let calls = watch.ports.length;
  for (let subset = 1; subset < 2 ** watch.ports.length; subset++) {
    const heard = watch.ports.map((_, i) => i).filter(i => subset & (1 << i));
    if (heard.length < calls && possibleMirrors(watch, publicEvidence(watch, shift, heard)).length === 1) calls = heard.length;
  }
  return { calls, turns: closestRoute(watch.board, watch.shifts[shift]).distance };
}

export function newWatch(watch) {
  return { phase: "survey", port: 0, heard: [], pencil: watch.known, turns: [] };
}
export function watchMask(watch, shift, run) {
  return run.phase === "survey" ? run.pencil : run.turns.reduce((mask, i) => mask ^ (1 << i), watch.shifts[shift]);
}
export function proven(watch, shift, run) {
  const possible = possibleMirrors(watch, publicEvidence(watch, shift, run.heard));
  return possible.length === 1 && possible[0] === run.pencil;
}
export function restoreWatch(watch, shift, value) {
  if (!Number.isInteger(shift) || shift < 0 || shift >= watch.shifts.length) return null;
  const portOK = p => Number.isInteger(p) && p >= 0 && p < watch.ports.length;
  if (!value || !portOK(value.port) || !watch.masks.includes(value.pencil) || !["survey", "repair", "signed"].includes(value.phase)
    || !Array.isArray(value.heard) || !value.heard.every(portOK) || new Set(value.heard).size !== value.heard.length
    || !Array.isArray(value.turns) || !value.turns.every(i => Number.isInteger(i) && i >= 0 && i < watch.board.mirrors.length)) return null;
  if (value.phase === "survey" ? value.turns.length > 0 : !proven(watch, shift, value)) return null;
  if (value.phase === "signed" && trace(watch.board, watchMask(watch, shift, value)).end !== "ready") return null;
  return { phase: value.phase, port: value.port, pencil: value.pencil, heard: [...value.heard], turns: [...value.turns] };
}
export function validWatchSeal(watch, shift, seal) {
  if (!seal || !Number.isInteger(shift) || shift < 0 || shift >= watch.shifts.length) return false;
  if (seal.shift !== undefined && seal.shift !== shift) return false;
  return Boolean(restoreWatch(watch, shift, { ...seal, phase: "signed", port: 0, pencil: watch.shifts[shift] }));
}
