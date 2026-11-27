import { prepareBoard } from "./puzzle.mjs";

export const crank = 8;
export const rideStyles = ["solo", "lend", "both"];
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const courses = new WeakMap();

export function bellCourse(letter, mode) {
  const night = mode === "expert", rows = night ? letter.expert : letter.rows;
  if (courses.has(rows)) return courses.get(rows);
  const board = prepareBoard(rows);
  const course = {board, boxes: ["M", "S"].map(tile => board.tiles.indexOf(tile)),
    start: {at: [board.source, board.starSource], axis: night ? 1 : 0, bells: 0, borrowed: 0},
    coasts: new Map(), distances: new Map()};
  courses.set(rows, course);
  return course;
}

export function parked(course, state, rider) {
  return Boolean(state.bells & (1 << rider)) && state.at[rider] === course.boxes[rider];
}
export function rideStyle(course, state) {
  if (!parked(course, state, 0) || !parked(course, state, 1)) return null;
  return state.borrowed === 3 ? "both" : state.borrowed ? "lend" : "solo";
}

// A missing partner (-1) lets us tell whether a waiting bike actually created a new stop.
function coast(course, from, other, axis, mailbox, heading) {
  const {board} = course, {width, height, tiles, gates, jointCell} = board;
  let cell = from, dir = heading;
  const lines = [[from]], seen = new Set();
  let stop = "rail";
  if (cell === jointCell && axis !== dir % 2) return null;
  while (true) {
    const signature = cell * 4 + dir;
    if (seen.has(signature)) return null;
    seen.add(signature);
    const x = cell % width + directions[dir][0], y = Math.floor(cell / width) + directions[dir][1];
    const next = y * width + x;
    if (x < 0 || x >= width || y < 0 || y >= height || tiles[next] === "#") break;
    if (next === jointCell && axis !== dir % 2) { stop = "closed"; break; }
    const gate = tiles[next] === "@";
    const exit = gate ? (next === gates[0] ? gates[1] : gates[0]) : next;
    if (next === other || exit === other) { stop = "partner"; break; }
    lines.at(-1).push(next);
    cell = exit;
    if (gate) lines.push([exit]);
    if (cell === jointCell) { stop = "bridge"; break; }
    if (cell === mailbox) { stop = "box"; break; }
    if (tiles[cell] === "A") dir = 3 - dir;
    if (tiles[cell] === "B") dir ^= 1;
  }
  return cell === from ? null : {to: cell, lines, stop};
}

export function rideStep(course, state, action) {
  if (!Number.isInteger(action) || action < 0 || action > crank || rideStyle(course, state)) return null;
  if (action === crank) return {state: {...state, axis: 1 - state.axis}, stop: "crank"};
  const rider = Math.floor(action / 4), bit = 1 << rider, dir = action % 4;
  if (parked(course, state, rider)) return null;
  const from = state.at[rider], other = state.at[1 - rider];
  const mailbox = state.bells & bit ? course.boxes[rider] : -1;
  const cacheKey = (((from * course.board.tiles.length + other) * 2 + state.axis) * 3
    + (mailbox < 0 ? 2 : rider)) * 4 + dir;
  if (!course.coasts.has(cacheKey)) {
    const ride = coast(course, from, other, state.axis, mailbox, dir);
    if (ride?.stop === "partner") {
      const alone = coast(course, from, -1, state.axis, mailbox, dir);
      if (alone?.to === ride.to) ride.stop = "rail";
      else ride.alone = alone;
    }
    course.coasts.set(cacheKey, ride);
  }
  const ride = course.coasts.get(cacheKey);
  if (!ride) return null;
  const at = state.at.slice();
  at[rider] = ride.to;
  return {...ride, rider, state: {at, axis: state.axis,
    bells: ride.stop === "bridge" ? state.bells | bit : state.bells,
    borrowed: ride.stop === "partner" ? state.borrowed | bit : state.borrowed}};
}

export function readRide(course, code) {
  if (typeof code !== "string" || /[^0-8]/.test(code)) return null;
  const steps = [], states = [course.start];
  for (const digit of code) {
    const step = rideStep(course, states.at(-1), Number(digit));
    if (!step) return null;
    steps.push(step);
    states.push(step.state);
  }
  const state = states.at(-1);
  return {code, steps, states, state, style: rideStyle(course, state)};
}

function key(course, state) {
  return (((state.at[0] * course.board.tiles.length + state.at[1]) * 2 + state.axis) * 4 + state.bells) * 4 + state.borrowed;
}

// Count backwards from the three kinds of completed ride. A hint and a rewind then
// use the same distance, including parked bikes, bell stamps and all previous loans.
function distances(course, target) {
  if (!course.graph) {
    const states = [course.start], back = new Map([[key(course, course.start), []]]);
    const ends = {solo: [], lend: [], both: []};
    for (const state of states) {
      const here = key(course, state), style = rideStyle(course, state);
      if (style) { ends[style].push(here); continue; }
      for (let action = 0; action <= crank; action++) {
        const next = rideStep(course, state, action);
        if (!next) continue;
        const there = key(course, next.state);
        if (!back.has(there)) { states.push(next.state); back.set(there, []); }
        back.get(there).push(here);
      }
    }
    course.graph = {back, ends};
  }
  if (!course.distances.has(target)) {
    const {back, ends} = course.graph;
    const queue = target ? [...ends[target]] : Object.values(ends).flat();
    const distance = new Map(queue.map(end => [end, 0]));
    for (const end of queue) {
      for (const prev of back.get(end)) {
        if (distance.has(prev)) continue;
        queue.push(prev);
        distance.set(prev, distance.get(end) + 1);
      }
    }
    course.distances.set(target, distance);
  }
  return course.distances.get(target);
}

export function rideDistance(course, state, target = null) {
  return distances(course, target).get(key(course, state)) ?? Infinity;
}

export function rideHint(course, state, target = null) {
  const left = rideDistance(course, state, target);
  if (!Number.isFinite(left) || !left) return null;
  for (let action = 0; action <= crank; action++) {
    const move = rideStep(course, state, action);
    if (move && rideDistance(course, move.state, target) === left - 1) return action;
  }
  return null;
}

export function rideFork(course, ride, target) {
  const par = rideDistance(course, course.start, target);
  for (let n = Math.min(ride.code.length, par); n > 0; n--) {
    if (n + rideDistance(course, ride.states[n], target) === par) return n;
  }
  return 0;
}
