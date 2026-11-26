const arrows = ">v<^";
export const starArrows = "eswn";
const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const rising = [3, 2, 1, 0]; // /
const falling = [1, 0, 3, 2]; // Backslash

export function prepareBoard(rows, goal = "direct") {
  const tiles = rows.join("");
  const width = rows[0].length;
  const mirrors = [];
  const gates = [];
  const marks = [];
  const mirrorAt = new Map();
  let initial = 0;
  let source;
  let starSource;
  for (let cell = 0; cell < tiles.length; cell++) {
    const tile = tiles[cell];
    if (tile === "A" || tile === "B") {
      mirrorAt.set(cell, mirrors.length);
      if (tile === "B") initial |= 1 << mirrors.length;
      mirrors.push(cell);
    }
    if (tile === "@") gates.push(cell);
    if (tile === "*" || isNumbered(tile)) marks.push(cell);
    if (arrows.includes(tile)) source = cell;
    if (starArrows.includes(tile)) starSource = cell;
  }
  const sealOrder = marks.map(cell => tiles[cell]).filter(isNumbered).map(Number).sort((a, b) => a - b);
  return { width, height: rows.length, tiles, mirrors, mirrorAt, gates, marks, sealOrder, source,
    starSource, jointCell: tiles.indexOf("&"), goal, initial };
}

export function isNumbered(tile) {
  return tile === "1" || tile === "2" || tile === "3";
}

function traceBeam(board, mask, source, direction, mailbox) {
  const { width, height, tiles, mirrorAt, gates, marks } = board;
  let x = source % width;
  let y = Math.floor(source / width);
  let line = [[x + 0.5, y + 0.5]];
  const lines = [line];
  const lit = new Set();
  const sequence = [];
  let wrongOrder = false;
  let crossed = false;
  let exposure = 0;
  const turns = [];
  const visited = new Set();
  let end;
  while (!end) {
    const [dx, dy] = offsets[direction];
    x += dx;
    y += dy;
    if (x < 0 || y < 0 || x >= width || y >= height) {
      line.push([x + 0.5 - dx / 2, y + 0.5 - dy / 2]);
      end = "sea";
      break;
    }
    const cell = y * width + x;
    const tile = tiles[cell];
    if (tile === "#" || cell === board.source || cell === board.starSource) {
      line.push([x + 0.5 - dx * 0.3, y + 0.5 - dy * 0.3]);
      end = "blocked";
      break;
    }
    line.push([x + 0.5, y + 0.5]);
    const entry = cell * 4 + direction;
    if (visited.has(entry)) {
      end = "loop";
      break;
    }
    visited.add(entry);
    if (mirrorAt.has(cell)) {
      const index = mirrorAt.get(cell);
      turns.push(index);
      direction = (mask & (1 << index) ? falling : rising)[direction];
    } else if (tile === "*" || isNumbered(tile)) {
      if (isNumbered(tile) && !lit.has(cell)) {
        const number = Number(tile);
        if (number !== board.sealOrder[sequence.length]) wrongOrder = true;
        sequence.push(number);
      }
      lit.add(cell);
    } else if (tile === "@") {
      const exit = gates[0] === cell ? gates[1] : gates[0];
      x = exit % width;
      y = Math.floor(exit / width);
      line = [[x + 0.5, y + 0.5]];
      lines.push(line);
    } else if (tile === "&") {
      crossed = true;
    } else if ("abcd".includes(tile)) {
      exposure |= 1 << (tile.charCodeAt(0) - 97);
    } else if (tile === mailbox) {
      end = "ready";
      if (lit.size < marks.length) end = "missing";
      else if (wrongOrder) end = "order";
    } else if (tile === "M" || tile === "S") {
      end = "wrongBox";
    }
  }
  return { lines, lit, sequence, wrongOrder, turns, end, crossed, exposure };
}

export function trace(board, mask) {
  const moon = traceBeam(board, mask, board.source, arrows.indexOf(board.tiles[board.source]), "M");
  const rays = [moon];
  if (board.starSource === undefined) return { ...moon, rays };
  const star = traceBeam(board, mask, board.starSource, starArrows.indexOf(board.tiles[board.starSource]), "S");
  rays.push(star);
  const jointCount = Number(moon.crossed) + Number(star.crossed);
  const matched = rays.filter(ray => ray.end === "ready").length;
  let end = "unmatched";
  if (matched === 2) end = board.goal === "joint" && jointCount < 2 ? "needsJoint" : "ready";
  return { ...moon, rays, end, matched, jointCount, turns: moon.turns.concat(star.turns) };
}

const cachedSolutions = new WeakMap();
function solutions(board) {
  if (!cachedSolutions.has(board)) {
    const valid = [];
    for (let mask = 0; mask < 2 ** board.mirrors.length; mask++) {
      if (trace(board, mask).end === "ready") valid.push(mask);
    }
    cachedSolutions.set(board, valid);
  }
  return cachedSolutions.get(board);
}

export function closestRoute(board, mask) {
  let distance = Infinity;
  let best;
  for (const route of solutions(board)) {
    let changes = 0;
    for (let bits = route ^ mask; bits; bits &= bits - 1) changes++;
    if (changes < distance) {
      distance = changes;
      best = route;
    }
  }
  if (best === undefined || distance === 0) return { distance };
  const differences = best ^ mask;
  const next = trace(board, best).turns.find(index => differences & (1 << index));
  return { distance, next };
}

export const difficulties = ["relaxed", "standard", "expert"];

export function prepareRoute(letter, difficulty, goal = "direct") {
  const board = prepareBoard(difficulty === "expert" ? letter.expert : letter.rows, goal);
  board.budget = null;
  if (difficulty === "expert") board.budget = closestRoute(board, board.initial).distance;
  if (difficulty === "relaxed") {
    let guide = closestRoute(board, board.initial);
    while (guide.distance > 2 && guide.next !== undefined) {
      board.initial ^= 1 << guide.next;
      guide = closestRoute(board, board.initial);
    }
  }
  return board;
}
