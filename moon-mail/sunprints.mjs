import { prepareBoard } from "./puzzle.mjs";

// Pressed outlines, in paper squares from the brass clip. The wrack forks at
// its second node. The same skeleton is used to sample and draw each frond.
export const fronds = [
  { points: [[0,0],[0,-1],[1,-1],[2,-2],[3,-2],[3,-3]], stems: [[0,1,2,3,4,5]] },
  { points: [[0,0],[0,-1],[-1,-2],[-2,-2],[-2,-3],[1,-1],[2,-1],[3,-2]], stems: [[0,1,2,3,4],[1,5,6,7]] },
];
const editions = new WeakMap();
const covered = (mask, cell) => (mask >>> cell) & 1;
export const dose = (first, second, cell) => 2 - covered(first.mask, cell) - covered(second.mask, cell);
export const shades = ["white", "pale", "blue"];
export const pressKey = (mode, field) => "kelpprint.sunprint." + mode + "." + field;

function mountings(board, shape) {
  const mounts = new Map();
  for (const peg of board.mirrors) {
    const x = peg % board.width, y = Math.floor(peg / board.width);
    let previous;
    for (const face of [1, -1]) {
      const cells = [];
      for (const [dx, dy] of shape.points) {
        const col = x + dx * face, row = y + dy, cell = row * board.width + col;
        if (col >= 0 && col < board.width && row >= 0 && row < board.height && board.tiles[cell] !== "#") cells.push(cell);
      }
      const mask = cells.reduce((bits, cell) => bits | (1 << cell), 0);
      if (cells.length < 3 || mask === previous) continue;
      const id = peg + (face === 1 ? "R" : "L");
      mounts.set(id, { id, peg, face, cells, mask });
      previous = mask;
    }
  }
  return mounts;
}

function collectPrint(rack, first, second) {
  if (first.mask === second.mask) return null;
  const sameRibbon = first.fronds[0] === second.fronds[0];
  const sameWrack = first.fronds[1] === second.fronds[1];
  if (sameRibbon === sameWrack) return null;
  if (rack.sensors.some((cell, i) => dose(first, second, cell) !== rack.targets[i])) return null;
  const [left, right] = rack.margins.map(cell => dose(first, second, cell));
  const page = left === 0 && right === 1 ? "left" : right === 0 && left === 1 ? "right" : "study";
  const white = first.mask & second.mask, pale = first.mask ^ second.mask;
  return { id: first.id + "~" + second.id, first, second, held: sameRibbon ? 0 : 1, page,
    image: white.toString(36) + "-" + pale.toString(36) };
}

export function dryingRack(letter, mode) {
  const night = mode === "expert";
  let cache = editions.get(letter);
  if (!cache) editions.set(letter, cache = new Map());
  if (cache.has(night)) return cache.get(night);
  const board = prepareBoard(night ? letter.expert : letter.rows);
  const rack = { board, mounts: fronds.map(shape => mountings(board, shape)), poses: new Map(), proofs: new Map(),
    targets: (night ? letter.expertPlate : letter.plate).targets,
    sensors: Array.from("abcd", mark => board.tiles.indexOf(mark)),
    margins: night ? [0, 4] : [18, 25], firstPages: new Map() };
  for (const ribbon of rack.mounts[0].values()) for (const wrack of rack.mounts[1].values()) {
    if (ribbon.peg === wrack.peg) continue;
    const id = ribbon.id + "-" + wrack.id;
    rack.poses.set(id, { id, fronds: [ribbon, wrack], mask: ribbon.mask | wrack.mask });
  }
  for (const first of rack.poses.values()) for (const second of rack.poses.values()) {
    const proof = collectPrint(rack, first, second);
    if (!proof) continue;
    rack.proofs.set(proof.id, proof);
    if (!rack.firstPages.has(first.id)) rack.firstPages.set(first.id, new Set());
    rack.firstPages.get(first.id).add(proof.page);
  }
  cache.set(night, rack);
  return rack;
}

export function freshPress(mode) {
  const pose = mode === "relaxed" ? "25R-26L" : mode === "expert" ? "14L-15R" : "25R-26R";
  return { first: null, pose };
}

export function validSheet(rack, sheet) {
  if (!sheet || !rack.poses.has(sheet.pose)) return false;
  if (sheet.first === null) return true;
  const first = rack.poses.get(sheet.first), pose = rack.poses.get(sheet.pose);
  return Boolean(first && first.fronds.some((frond, i) => frond === pose.fronds[i]));
}

// A fresh trial always restores the stationary specimen to the first exposure.
// Players can audition either clip repeatedly without using up the paper.
export function reclip(rack, sheet, which, peg, face) {
  const base = rack.poses.get(sheet.first ?? sheet.pose);
  const pair = base.fronds.map(frond => frond.id);
  pair[which] = peg + (face === 1 ? "R" : "L");
  return rack.poses.get(pair.join("-")) ?? null;
}

function changes(from, to) {
  return from.fronds.reduce((n, f, i) => n + Number(f.peg !== to.fronds[i].peg) + Number(f.face !== to.fronds[i].face), 0);
}

export function pressHint(rack, sheet, goal, filed = []) {
  const current = rack.poses.get(sheet.pose);
  let best, bestScore = Infinity;
  const known = new Set(filed.map(proof => proof.image));
  for (const proof of rack.proofs.values()) {
    if ((sheet.first && proof.first.id !== sheet.first) || (goal && proof.page !== goal)) continue;
    const dest = sheet.first ? proof.second : proof.first;
    const pages = rack.firstPages.get(proof.first.id);
    if (!sheet.first && goal && (!pages.has("left") || !pages.has("right"))) continue;
    const score = changes(current, dest) * 8 + Number(known.has(proof.image)) * 3
      + Number(!pages.has("left") || !pages.has("right"));
    if (score < bestScore) { best = dest; bestScore = score; }
  }
  if (!best) return { action: "rewind" };
  if (current === best) return { action: sheet.first ? "wash" : "expose" };
  // Try an actual legal one-click improvement. If both tips must swap pegs,
  // a spare clip provides the intermediate step.
  const distance = changes(current, best);
  let spare;
  for (const [i, frond] of best.fronds.entries()) {
    if (current.fronds[i] === frond) continue;
    const trial = reclip(rack, sheet, i, frond.peg, frond.face);
    if (trial && changes(trial, best) < distance) return { action: "mount", which: i, frond };
    if (!spare) {
      for (const other of rack.mounts[i].values()) {
        if (best.fronds.some(f => f.peg === other.peg) || other.peg === current.fronds[i].peg) continue;
        if (reclip(rack, sheet, i, other.peg, other.face)) { spare = { action: "mount", which: i, frond: other }; break; }
      }
    }
  }
  return spare ?? { action: "rewind" };
}

export function companion(proof, filed) {
  if (!proof || proof.page === "study") return null;
  const other = proof.page === "left" ? "right" : "left";
  return filed.find(candidate => candidate.first === proof.first && candidate.page === other) ?? null;
}
