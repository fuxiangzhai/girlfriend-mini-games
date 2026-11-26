const arrows = ">v<^";
const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const rising = [3, 2, 1, 0]; // /
const falling = [1, 0, 3, 2]; // Backslash

export function prepareBoard(rows) {
  const tiles = rows.join("");
  const width = rows[0].length;
  const mirrors = [];
  const gates = [];
  const marks = [];
  const mirrorAt = new Map();
  let initial = 0;
  let source;
  for (let cell = 0; cell < tiles.length; cell++) {
    const tile = tiles[cell];
    if (tile === "A" || tile === "B") {
      mirrorAt.set(cell, mirrors.length);
      if (tile === "B") initial |= 1 << mirrors.length;
      mirrors.push(cell);
    }
    if (tile === "@") gates.push(cell);
    if (tile === "*") marks.push(cell);
    if (arrows.includes(tile)) source = cell;
  }
  return { width, height: rows.length, tiles, mirrors, mirrorAt, gates, marks, source, initial };
}

export function trace(board, mask) {
  const { width, height, tiles, mirrorAt, gates, marks, source } = board;
  let x = source % width;
  let y = Math.floor(source / width);
  let direction = arrows.indexOf(tiles[source]);
  let line = [[x + 0.5, y + 0.5]];
  const lines = [line];
  const lit = new Set();
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
    if (tile === "#" || cell === source) {
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
    } else if (tile === "*") {
      lit.add(cell);
    } else if (tile === "@") {
      const exit = gates[0] === cell ? gates[1] : gates[0];
      x = exit % width;
      y = Math.floor(exit / width);
      line = [[x + 0.5, y + 0.5]];
      lines.push(line);
    } else if (tile === "M") {
      end = lit.size === marks.length ? "ready" : "missing";
    }
  }
  return { lines, lit, turns, end };
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
