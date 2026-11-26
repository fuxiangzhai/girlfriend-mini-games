import { prepareRoute, trace } from "./puzzle.mjs";

const plans = {
  coast: { sockets: [10, 15, 21, 22], lines: ["lantern", "market", "orchard", "cut"] },
  summit: { sockets: [3, 7, 10, 15], lines: ["lantern", "balcony", "orchard", "cut"] },
};
const boards = new WeakMap();
const winningStates = new WeakMap();

export function prepareHill(letter, difficulty) {
  if (!boards.has(letter)) boards.set(letter, new Map());
  const editions = boards.get(letter);
  if (!editions.has(difficulty)) {
    const board = prepareRoute(letter, difficulty);
    const plan = plans[difficulty === "expert" ? "summit" : "coast"];
    board.hill = { ...plan, fixed: board.mirrors.length, capacity: 2, summit: plan === plans.summit };
    board.budget = null;
    for (const cell of plan.sockets) {
      board.mirrorAt.set(cell, board.mirrors.length);
      board.mirrors.push(cell);
    }
    editions.set(difficulty, board);
  }
  return editions.get(difficulty);
}

// Low bits hold the permanent mirrors. Each siding takes two more bits:
// 0 passes straight through, 1 holds a / mirror, 2 holds a backslash mirror.
export function hillSetting(board, state, index) {
  const fixed = board.hill.fixed;
  return index < fixed ? (state >> index) & 1 : (state >> (fixed + 2 * (index - fixed))) & 3;
}

function validTools(board, state) {
  let used = 0;
  for (let index = board.hill.fixed; index < board.mirrors.length; index++) {
    const setting = hillSetting(board, state, index);
    if (setting === 3) return false;
    if (setting) used++;
  }
  return used <= board.hill.capacity;
}

export function moveHill(board, state, index, undo = false) {
  if (!Number.isInteger(index) || index < 0 || index >= board.mirrors.length) return null;
  if (index < board.hill.fixed) return state ^ (1 << index);
  const bit = 1 << (board.hill.fixed + 2 * (index - board.hill.fixed));
  const old = hillSetting(board, state, index);
  const next = state + (((old + (undo ? 2 : 1)) % 3) - old) * bit;
  return validTools(board, next) ? next : null;
}

export function restoreHill(board, history) {
  if (!Array.isArray(history)) return null;
  let state = board.initial;
  for (const index of history) {
    state = moveHill(board, state, index);
    if (state === null) return null;
  }
  return state;
}

export function traceHill(board, state) {
  const fixed = board.hill.fixed;
  let mask = state & ((1 << fixed) - 1), straight = 0, used = 0;
  for (let i = fixed; i < board.mirrors.length; i++) {
    const setting = hillSetting(board, state, i);
    if (setting === 0) straight |= 1 << i;
    else {
      used++;
      if (setting === 2) mask |= 1 << i;
    }
  }
  return { ...trace(board, mask, straight), mask, straight, used };
}

// Only travelled cells enter the ticket signature. Opposite traversals of
// the valley loop visit the same scenery but stamp the ticket in reverse.
export function hillTrip(board, route) {
  if (route.end !== "ready") return null;
  const cells = route.lines[0].map(([x, y]) => Math.floor(x) + board.width * Math.floor(y));
  const step = cells.at(-1) - cells.at(-2);
  const side = step === 1 ? "west" : step === -1 ? "east" : step > 0 ? "north" : "south";
  const stamps = [...route.lit];
  let id = "lantern";
  if (side === "west") id = "cut";
  else if (side === "north") id = "orchard";
  else if (board.hill.summit && cells.includes(8)) id = "balcony";
  else if (!board.hill.summit && stamps[0] === board.marks[1]) id = "market";
  return { id, side, stamps, length: cells.length - 1, signature: cells.join("."), cells };
}

export function filedHillTrip(board, state, id) {
  const limit = 2 ** (board.hill.fixed + 2 * board.hill.sockets.length);
  if (!Number.isSafeInteger(state) || state < 0 || state >= limit || !validTools(board, state)) return null;
  const trip = hillTrip(board, traceHill(board, state));
  return trip?.id === id ? trip : null;
}

function solutions(board) {
  if (!winningStates.has(board)) {
    const wins = [];
    const fixedStates = 1 << board.hill.fixed;
    for (let sockets = 0; sockets < 4 ** board.hill.sockets.length; sockets++) {
      const tools = sockets * fixedStates;
      if (!validTools(board, tools)) continue;
      for (let mirrors = 0; mirrors < fixedStates; mirrors++) {
        const state = tools + mirrors;
        const trip = hillTrip(board, traceHill(board, state));
        if (trip) wins.push({ state, id: trip.id });
      }
    }
    winningStates.set(board, wins);
  }
  return winningStates.get(board);
}

function moveDistance(board, state, goal) {
  let count = 0;
  for (let i = 0; i < board.mirrors.length; i++) {
    const cycle = i < board.hill.fixed ? 2 : 3;
    count += (hillSetting(board, goal, i) - hillSetting(board, state, i) + cycle) % cycle;
  }
  return count;
}

export function hillHint(board, state, wanted) {
  let best, distance = Infinity;
  for (const win of solutions(board)) {
    if (wanted.length && !wanted.includes(win.id)) continue;
    const changes = moveDistance(board, state, win.state);
    if (changes < distance) { best = win.state; distance = changes; }
  }
  if (best === undefined || !distance) return undefined;
  for (let i = 0; i < board.mirrors.length; i++) {
    if (hillSetting(board, state, i) === hillSetting(board, best, i)) continue;
    const next = moveHill(board, state, i);
    if (next !== null && moveDistance(board, next, best) === distance - 1) return i;
  }
}
