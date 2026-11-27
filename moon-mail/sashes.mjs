import { prepareBoard, trace } from "./puzzle.mjs";

// These cell addresses belong to the two original Morning Window charts.
// Each inner list is the glass carried by one rigid frame, horizontal then vertical.
const fittings = { day: [[14], [22, 23]], night: [[8, 14], [20]] };
const slides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const countBits = bits => { let n = 0; while (bits) { bits &= bits - 1; n++; } return n; };

function fit(original, frames, x, y) {
  const mirrors = original.mirrors.map((cell, i) => {
    const col = cell % original.width + (frames[0].includes(i) ? x : 0);
    const row = Math.floor(cell / original.width) + (frames[1].includes(i) ? y : 0);
    if (col < 0 || col >= original.width || row < 0 || row >= original.height) return -1;
    return row * original.width + col;
  });
  if (mirrors.some(cell => cell < 0 || !".AB".includes(original.tiles[cell])) || new Set(mirrors).size !== mirrors.length) return null;
  const tiles = [...original.tiles.replace(/[AB]/g, ".")];
  mirrors.forEach((cell, i) => { tiles[cell] = original.tiles[original.mirrors[i]]; });
  return { ...original, tiles: tiles.join(""), mirrors, mirrorAt: new Map(mirrors.map((cell, i) => [cell, i])) };
}

export function prepareSashes(letter, mode) {
  const night = mode === "expert", original = prepareBoard(night ? letter.expert : letter.rows);
  const frames = fittings[night ? "night" : "day"].map(cells => cells.map(cell => original.mirrorAt.get(cell)));
  const groups = [...frames, ...original.mirrors.map((_, i) => i).filter(i => !frames.some(frame => frame.includes(i))).map(i => [i])];
  const groupsAt = original.mirrors.map((_, mirror) => groups.findIndex(group => group.includes(mirror)));
  const masks = Array.from({length: 2 ** groups.length}, (_, tilts) => groups.reduce((mask, group, i) =>
    (tilts & (1 << i)) ? group.reduce((m, index) => m ^ (1 << index), mask) : mask, original.initial));
  const poses = [], byOffset = new Map();
  function add(x, y) {
    const key = x + "," + y;
    if (!byOffset.has(key)) {
      const board = fit(original, frames, x, y);
      byOffset.set(key, board ? poses.length : -1);
      if (board) poses.push({x, y, board, slides: []});
    }
    return byOffset.get(key);
  }
  add(0, 0);
  for (const pose of poses) pose.slides = slides.map(([dx, dy]) => add(pose.x + dx, pose.y + dy));
  const distances = poses.map((_, start) => {
    const d = new Int16Array(poses.length).fill(-1), queue = [start]; d[start] = 0;
    for (const i of queue) for (const next of poses[i].slides) {
      if (next >= 0 && d[next] < 0) { d[next] = d[i] + 1; queue.push(next); }
    }
    return d;
  });
  const bench = {original, frames, groups, groupsAt, poses, byOffset, masks, distances, routes: new Map(), winners: [],
    orders: night ? ["below", "long", "tide"] : ["quick", "amber", "tide"],
    tideEntry: original.gates.find(cell => cell % original.width < original.width / 2)};
  for (let state = 0; state < poses.length * masks.length; state++) {
    const {board, mask} = windowSetting(bench, state);
    const journey = windowJourney(board, trace(board, mask));
    if (!journey) continue;
    if (!bench.routes.has(journey.id)) bench.routes.set(journey.id, journey);
    bench.winners.push({state, id: journey.id});
  }
  const lengths = [...bench.routes.values()].map(route => route.steps);
  bench.shortest = Math.min(...lengths);
  bench.longest = Math.max(...lengths);
  return bench;
}

export function windowSetting(bench, state) {
  const index = Math.floor(state / bench.masks.length), tilts = state % bench.masks.length;
  return {...bench.poses[index], index, tilts, mask: bench.masks[tilts]};
}

export function adjustWindow(bench, state, action) {
  if (!Number.isInteger(action) || action < 0 || action >= 4 + bench.groups.length) return null;
  const {index, slides, tilts} = windowSetting(bench, state);
  if (action < 4) return slides[action] < 0 ? null : slides[action] * bench.masks.length + tilts;
  return index * bench.masks.length + (tilts ^ (1 << (action - 4)));
}

export function packWindow(bench, state) {
  const {x, y, tilts} = windowSetting(bench, state);
  return [x, y, tilts];
}

export function unpackWindow(bench, packed) {
  if (!Array.isArray(packed) || packed.length !== 3 || !packed.every(Number.isSafeInteger)) return null;
  const [x,y,tilts] = packed, pose = bench.byOffset.get(x + "," + y);
  return Number.isInteger(pose) && pose >= 0 && tilts >= 0 && tilts < bench.masks.length ? pose * bench.masks.length + tilts : null;
}

export function windowJourney(board, ray) {
  if (ray.end !== "ready") return null;
  const tracks = ray.lines.map(line => line.map(([x,y]) => Math.floor(y) * board.width + Math.floor(x)));
  return {id: tracks.map(track => track.map(cell => cell.toString(36)).join("")).join("-"), tracks,
    steps: tracks.reduce((n, track) => n + track.length - 1, 0), gates: tracks.length - 1,
    first: tracks.flat().find(cell => board.marks.includes(cell))};
}

export function orderMatches(bench, trip, order) {
  if (!bench.orders.includes(order) || !trip) return false;
  if (order === "quick") return trip.steps === bench.shortest;
  if (order === "long") return trip.steps === bench.longest;
  if (order === "amber") return trip.first === bench.original.marks[0];
  if (order === "below") return trip.tracks.at(-1).at(-2) === bench.original.tiles.indexOf("M") + bench.original.width;
  return trip.tracks.length > 1 && trip.tracks[0].at(-1) === bench.tideEntry;
}

export function restoreAdjustments(bench, actions) {
  if (!Array.isArray(actions)) return null;
  let state = 0;
  for (const action of actions) {
    state = adjustWindow(bench, state, action);
    if (state === null) return null;
  }
  return state;
}

// Sliding and tilting commute. The shortest edit consists of a shortest legal
// path for the two frames and one tilt per differing handle.
function nextAdjustment(bench, current, target) {
  if (current.index !== target.index) {
    return current.slides.findIndex(pose => pose >= 0 && bench.distances[pose][target.index] < bench.distances[current.index][target.index]);
  }
  return 4 + bench.groups.findIndex((_, i) => ((current.tilts ^ target.tilts) & (1 << i)) !== 0);
}

export function reopenSetting(bench, state) {
  const target = windowSetting(bench, state), actions = [];
  let current = 0;
  while (current !== state) {
    const action = nextAdjustment(bench, windowSetting(bench, current), target);
    actions.push(action);
    current = adjustWindow(bench, current, action);
  }
  return actions;
}

export function windowHint(bench, state, allowed) {
  let distance = Infinity, best;
  const current = windowSetting(bench, state);
  for (const win of bench.winners) {
    if (!allowed.has(win.id)) continue;
    const index = Math.floor(win.state / bench.masks.length), tilts = win.state % bench.masks.length;
    const cost = bench.distances[current.index][index] + countBits(current.tilts ^ tilts);
    if (cost < distance) { best = win.state; distance = cost; }
  }
  if (!distance || best === undefined) return null;
  return nextAdjustment(bench, current, windowSetting(bench, best));
}
