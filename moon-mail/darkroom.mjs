import { prepareBoard, trace } from "./puzzle.mjs";

export const shutter = "shutter";
export const sensorName = index => String.fromCharCode(65 + index);
const hit = (pattern, index) => (pattern >> index) & 1;

function flipCount(bits) {
  let count = 0;
  for (; bits; bits &= bits - 1) count++;
  return count;
}

export function prepareFilm(letter, difficulty) {
  const expert = difficulty === "expert";
  const board = prepareBoard(expert ? letter.expert : letter.rows);
  const spec = expert ? letter.expertPlate : letter.plate;
  const sensors = spec.targets.map((_, i) => board.tiles.indexOf(sensorName(i).toLowerCase()));
  const patterns = [];
  const usable = [];
  for (let mask = 0; mask < 2 ** board.mirrors.length; mask++) {
    const ray = trace(board, mask);
    const pattern = ray.end === "ready" ? ray.exposure : 0;
    patterns.push(pattern);
    if (pattern > 0) usable.push(mask);
  }
  board.film = { ...spec, sensors, patterns, usable, plans: new Map() };
  const start = filmPlan(board, board.initial, spec.targets, spec.frames);
  if (difficulty === "relaxed") board.initial = start.shot;
  board.budget = expert ? start.distance : null;
  return board;
}

// A shutter press costs no turns. Between two shots the exact cost is the
// number of different mirror orientations, regardless of the order of flips.
export function filmPlan(board, mask, remaining, slots) {
  const { patterns, usable, plans } = board.film;
  const key = [mask, slots, ...remaining].join(",");
  if (plans.has(key)) return plans.get(key);
  let best = { distance: Infinity };
  if (slots === 0) {
    if (remaining.every(n => n === 0)) best = { distance: 0 };
  } else if (remaining.every(n => n >= 0 && n <= slots)) {
    let fewestBeforeShutter = Infinity;
    for (const shot of usable) {
      const before = flipCount(mask ^ shot);
      if (before > best.distance) continue;
      const after = remaining.map((n, i) => n - hit(patterns[shot], i));
      const tail = filmPlan(board, shot, after, slots - 1);
      const distance = before + tail.distance;
      if (Number.isFinite(distance) && (distance < best.distance || (distance === best.distance && before < fewestBeforeShutter))) {
        best = { distance, shot };
        fewestBeforeShutter = before;
      }
    }
  }
  plans.set(key, best);
  return best;
}

export function readFilm(board, frames, mask) {
  const { targets, patterns } = board.film;
  const counts = targets.map((_, i) => frames.reduce((n, shot) => n + hit(patterns[shot], i), 0));
  const remaining = targets.map((n, i) => n - counts[i]);
  const slots = board.film.frames - frames.length;
  const pattern = patterns[mask];
  const projected = counts.map((n, i) => n + hit(pattern, i));
  const over = projected.findIndex((n, i) => n > targets[i]);
  return { remaining, counts, projected, slots, pattern, over,
    canShoot: slots > 0 && pattern > 0 && over === -1,
    complete: slots === 0 && remaining.every(n => n === 0) };
}

export function filmHint(board, mask, reading) {
  if (reading.complete) return "develop";
  const { shot } = filmPlan(board, mask, reading.remaining, reading.slots);
  if (shot === undefined) return "rewind";
  if (shot === mask) return shutter;
  const changed = shot ^ mask;
  const onRoute = trace(board, shot).turns.find(i => changed & (1 << i));
  return onRoute ?? board.mirrors.findIndex((_, i) => changed & (1 << i));
}

// Rebuild a saved run from its actions. The stored file never supplies doses or budgets.
export function restoreFilm(board, actions) {
  if (!Array.isArray(actions)) return null;
  const frames = [];
  let mask = board.initial, turns = 0;
  for (const action of actions) {
    if (action === shutter) {
      if (!readFilm(board, frames, mask).canShoot) return null;
      frames.push(mask);
    } else {
      if (!Number.isInteger(action) || action < 0 || action >= board.mirrors.length || frames.length === board.film.frames) return null;
      turns++;
      if (board.budget !== null && turns > board.budget) return null;
      mask ^= 1 << action;
    }
  }
  return { mask, frames };
}

export function isDevelopedFilm(board, frames) {
  if (!Array.isArray(frames) || frames.length !== board.film.frames) return false;
  if (!frames.every(mask => Number.isInteger(mask) && board.film.patterns[mask] > 0)) return false;
  return readFilm(board, frames, frames.at(-1)).complete;
}
