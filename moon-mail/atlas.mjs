import { isNumbered, prepareBoard } from "./puzzle.mjs";

const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const observations = ["bare", "short", "rim"];

export function blankChart(board) {
  return { ink: "", cells: [board.source], heading: ">v<^".indexOf(board.tiles[board.source]), stars: 0, pin: null, ready: false };
}

// One pencil step enters an adjacent square. The two ends of a tide gate
// belong to the same step, so undoing it removes both ends of the crossing.
export function drawStep(board, sketch, heading) {
  if (sketch.ready || !Number.isInteger(heading) || !offsets[heading]) return null;
  const tip = sketch.cells.at(-1);
  const tile = board.tiles[tip];
  const turning = heading !== sketch.heading;
  let pin = sketch.pin;
  if (turning) {
    if (tip === board.source || tile === "@" || heading === (sketch.heading + 2) % 4) return null;
    if (!board.mirrorAt.has(tip) && !isNumbered(tile)) {
      if (pin !== null) return null;
      pin = tip;
    }
  }
  const [dx, dy] = offsets[heading];
  const x = tip % board.width + dx, y = Math.floor(tip / board.width) + dy;
  if (x < 0 || x >= board.width || y < 0 || y >= board.height) return null;
  const next = y * board.width + x, nextTile = board.tiles[next];
  if (nextTile === "#" || sketch.cells.includes(next)) return null;
  if (isNumbered(nextTile) && Number(nextTile) !== sketch.stars + 1) return null;
  const ready = nextTile === "M";
  if (ready && sketch.stars !== board.marks.length) return null;
  const cells = [...sketch.cells, next];
  if (nextTile === "@") cells.push(board.gates.find(gate => gate !== next));
  return { ink: sketch.ink + heading, cells, heading, stars: sketch.stars + Number(isNumbered(nextTile)), pin, ready };
}

export function nextSteps(board, sketch) {
  return offsets.map((_, direction) => drawStep(board, sketch, direction)).filter(Boolean);
}

export function restoreSketch(board, ink) {
  if (typeof ink !== "string" || ink.length >= board.tiles.length || /[^0-3]/.test(ink)) return null;
  let sketch = blankChart(board);
  for (const digit of ink) {
    sketch = drawStep(board, sketch, Number(digit));
    if (!sketch) return null;
  }
  return sketch;
}

export function prepareAtlas(station, mode) {
  const night = mode === "expert";
  const board = prepareBoard(night ? station.expert : station.rows);
  // The pencilled star on the margin is a landmark, not an extra seal.
  board.rim = night ? 0 : 4 * board.width + 4;
  board.routes = new Map();
  function explore(sketch) {
    if (sketch.ready) board.routes.set(sketch.ink, sketch);
    else for (const next of nextSteps(board, sketch)) explore(next);
  }
  explore(blankChart(board));
  board.shortest = Math.min(...Array.from(board.routes.keys(), ink => ink.length));
  return board;
}

export function fieldNotes(board, sketch) {
  if (!sketch.ready) return [];
  return observations.filter(id => id === "bare" ? sketch.pin === null
    : id === "short" ? sketch.ink.length === board.shortest : sketch.cells.includes(board.rim));
}

export function commonSteps(first, second) {
  let i = 0;
  while (i < first.length && first[i] === second[i]) i++;
  return i;
}

export function forkPrefix(board, ink, filed) {
  if (!board.routes.has(ink) || !filed.has(ink)) return null;
  let best = -1;
  for (const other of board.routes.keys()) {
    if (!filed.has(other)) best = Math.max(best, commonSteps(ink, other));
  }
  return best < 0 ? null : ink.slice(0, best);
}

// Stay with the player's pencil for as long as possible. Among equally close
// completions, favour an undiscovered ink line, then the shorter drawing.
export function atlasHint(board, sketch, goal, filed) {
  let best = null, prefix = -1;
  for (const route of board.routes.values()) {
    if (goal && !fieldNotes(board, route).includes(goal)) continue;
    const shared = commonSteps(sketch.ink, route.ink);
    const known = filed.has(route.ink), previousKnown = best && filed.has(best.ink);
    if (shared > prefix || (shared === prefix && ((previousKnown && !known) || (known === previousKnown && route.ink.length < best.ink.length)))) {
      best = route;
      prefix = shared;
    }
  }
  if (!best || best.ink === sketch.ink) return null;
  return prefix < sketch.ink.length ? { backTo: prefix } : { direction: Number(best.ink[prefix]) };
}

export function chartLines(board, sketch) {
  const lines = [[]];
  sketch.cells.forEach((cell, i) => {
    if (i && board.tiles[cell] === "@" && board.tiles[sketch.cells[i - 1]] === "@") lines.push([]);
    lines.at(-1).push([cell % board.width + 0.5, Math.floor(cell / board.width) + 0.5]);
  });
  return lines;
}
