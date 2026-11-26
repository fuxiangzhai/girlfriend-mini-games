import { prepareRoute, traceFrom } from "./puzzle.mjs";

const editions = new WeakMap();
const plans = new WeakMap();
const integer = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
const pop = n => { let count = 0; for (; n; n &= n - 1) count++; return count; };

export function prepareDuet(letter, mode) {
  if (!editions.has(letter)) editions.set(letter, new Map());
  const cache = editions.get(letter);
  if (!cache.has(mode)) {
    const board = prepareRoute(letter, mode, "joint");
    board.budget = null;
    board.maxRest = mode === "expert" ? 10 : 4;
    cache.set(mode, board);
  }
  return cache.get(mode);
}

export function initialDuet(board) {
  return { stage: "gather", mask: board.initial, switched: -1, moon: 0, star: 0, delay: 0 };
}

export function gatherDuet(b, mask) {
  const rays = [traceFrom(b, mask, b.source, ">v<^".indexOf(b.tiles[b.source]), "&"),
    traceFrom(b, mask, b.starSource, "eswn".indexOf(b.tiles[b.starSource]), "&")];
  return { rays, lit: new Set(), jointCount: rays.filter(ray => ray.end === "dock").length };
}

function bearing([x, y], [nx, ny]) {
  return nx > x ? 0 : ny > y ? 1 : nx < x ? 2 : 3;
}

function dock(state, incoming) {
  const reverse = incoming.rays.map(ray => {
    const line = ray.lines.at(-1);
    return bearing(line.at(-1), line.at(-2));
  });
  return { ...state, stage: "relay", switched: -1, moon: reverse[0], star: reverse[1], delay: 0 };
}

export function duetMove(b, state, action) {
  if (!Array.isArray(action)) return null;
  const [kind, value] = action;
  if (kind === "mirror" && integer(value, 0, b.mirrors.length - 1)) {
    return state.stage === "gather" ? { ...state, mask: state.mask ^ (1 << value) }
      : { ...state, switched: state.switched === value ? -1 : value };
  }
  if (kind === "dock" && state.stage === "gather") {
    const path = gatherDuet(b, state.mask);
    return path.jointCount === 2 ? dock(state, path) : null;
  }
  if (state.stage !== "relay") return null;
  if (kind === "back") return { ...initialDuet(b), mask: state.mask };
  if ((kind === "moon" || kind === "star") && integer(value, 0, 3) && state[kind] !== value) return { ...state, [kind]: value };
  if (kind === "delay" && integer(value, -b.maxRest, b.maxRest) && state.delay !== value) return { ...state, delay: value };
  return null;
}

export function restoreDuet(b, actions) {
  if (!Array.isArray(actions)) return null;
  let state = initialDuet(b);
  for (const action of actions) {
    state = duetMove(b, state, action);
    if (!state) return null;
  }
  return state;
}

export function relayMask(state) {
  return state.switched < 0 ? state.mask : state.mask ^ (1 << state.switched);
}

function nameFor([moon, star]) {
  if (moon === 1 && star === 1) return "window";
  if (moon > 1 && star > 1) return "round";
  if (moon > 1) return "moon";
  return star === 3 ? "echo" : "star";
}

export function relayDuet(b, state) {
  const mask = relayMask(state);
  const rays = [traceFrom(b, mask, b.jointCell, state.moon, "M"), traceFrom(b, mask, b.jointCell, state.star, "S")];
  const waits = [Math.max(0, -state.delay), Math.max(0, state.delay)];
  // Twin Signal Huts has no tide gates. Adjacent centres are one musical beat apart.
  const tracks = rays.map(ray => ray.end === "ready" ? ray.lines[0] : null);
  const lengths = tracks.map(track => track ? track.length - 1 : null);
  const arrivals = lengths.map((length, i) => length === null ? null : waits[i] + length);
  const paired = tracks.every(Boolean);
  const synced = paired && arrivals[0] === arrivals[1];
  return { rays, lit: new Set(), jointCount: 2, waits, tracks, lengths, arrivals, paired, synced,
    endBeat: paired ? Math.max(...arrivals) : 0, id: synced ? nameFor(lengths) : null };
}

// The position read by the chart, the printed score and the two voices uses
// the same clock. At beat zero both envelopes are still at the sorting desk.
export function duetBeat(score, beat) {
  if (!score.paired || !integer(beat, 0, score.endBeat)) return null;
  return score.tracks.map((track, i) => {
    const step = beat - score.waits[i];
    const at = Math.max(0, Math.min(track.length - 1, step));
    const event = step < 0 ? "rest" : step === 0 ? "start" : step === track.length - 1 ? "arrive" : step >= track.length ? "held" : "sail";
    return { point: track[at], event, direction: at > 0 ? bearing(track[at - 1], track[at]) : bearing(track[0], track[1]) };
  });
}

export function verifiedDuet(b, state, id) {
  if (!state || state.stage !== "relay" || !integer(state.mask, 0, 2 ** b.mirrors.length - 1)
    || !integer(state.switched, -1, b.mirrors.length - 1) || !integer(state.moon, 0, 3)
    || !integer(state.star, 0, 3) || !integer(state.delay, -b.maxRest, b.maxRest)) return null;
  if (gatherDuet(b, state.mask).jointCount !== 2) return null;
  const score = relayDuet(b, state);
  return score.synced && score.id === id ? score : null;
}

function repertoire(b) {
  if (plans.has(b)) return plans.get(b);
  const works = [];
  for (let mask = 0; mask < 2 ** b.mirrors.length; mask++) {
    const gathered = gatherDuet(b, mask);
    if (gathered.jointCount !== 2) continue;
    const start = dock({ ...initialDuet(b), mask }, gathered);
    for (let switched = -1; switched < b.mirrors.length; switched++) {
      for (let moon = 0; moon < 4; moon++) for (let star = 0; star < 4; star++) {
        const state = { ...start, switched, moon, star };
        const score = relayDuet(b, state);
        if (!score.paired) continue;
        state.delay = score.lengths[0] - score.lengths[1];
        if (Math.abs(state.delay) <= b.maxRest) works.push({ state, id: nameFor(score.lengths) });
      }
    }
  }
  plans.set(b, works);
  return works;
}

export function duetPieces(b) {
  const available = new Set(repertoire(b).map(work => work.id));
  return ["window", "echo", "moon", "star", "round"].filter(id => available.has(id));
}

function relayEdits(state, finish) {
  return Number(state.switched !== finish.switched) + Number(state.moon !== finish.moon)
    + Number(state.star !== finish.star) + Number(state.delay !== finish.delay);
}

export function duetHint(b, state, wanted = []) {
  let best, distance = Infinity;
  for (const work of repertoire(b)) {
    if (wanted.length && !wanted.includes(work.id)) continue;
    const goal = work.state;
    if (state.stage === "relay" && state.mask !== goal.mask) continue;
    const cost = state.stage === "gather" ? pop(state.mask ^ goal.mask) : relayEdits(state, goal);
    if (cost < distance) { best = goal; distance = cost; }
  }
  if (!best) return state.stage === "relay" ? ["back"] : null;
  if (state.stage === "gather") {
    if (!distance) return ["dock"];
    const differences = state.mask ^ best.mask;
    const used = gatherDuet(b, best.mask).rays.flatMap(ray => ray.turns);
    const i = used.find(index => differences & (1 << index)) ?? b.mirrors.findIndex((_, index) => differences & (1 << index));
    return ["mirror", i];
  }
  if (state.switched !== best.switched) return ["mirror", best.switched < 0 ? state.switched : best.switched];
  for (const key of ["moon", "star", "delay"]) if (state[key] !== best[key]) return [key, best[key]];
  return ["send"];
}
