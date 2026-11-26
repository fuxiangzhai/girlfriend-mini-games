import { prepareBoard, trace } from "./puzzle.mjs";

// The four moorings occupy existing open water on each edition of the chart.
const moorings = {
  ferry: [["B2", "D2", "B4", "D4"], ["B3", "B4", "E5", "F5"]],
  rain:  [["A1", "D1", "E3", "E5"], ["A3", "B3", "F3", "A4"]],
  bell:  [["B3", "C4", "B5", "C5"], ["D2", "F2", "C3", "B5"]],
};
export const dispatchStations = Object.keys(moorings);
export const charterHours = 3;

function bitCount(value) {
  let count = 0;
  for (; value; value &= value - 1) count++;
  return count;
}
const berthStates = Array.from({ length: 16 }, (_, i) => i).filter(i => bitCount(i) <= 2);

export function tapBerth(berths, slot) {
  const bit = 1 << slot;
  if (berths & bit) return berths ^ bit;
  return bitCount(berths) === 2 ? bit : berths | bit;
}

// Shortest editing gestures between two selections, including the recall button.
const berthPaths = berthStates.map(start => {
  const paths = new Map([[start, { distance: 0 }]]);
  for (const [state, path] of paths) {
    for (const slot of [0, 1, 2, 3, -1]) {
      const next = slot === -1 ? 0 : tapBerth(state, slot);
      if (!paths.has(next)) paths.set(next, { distance: path.distance + 1, first: path.first ?? slot });
    }
  }
  return [start, paths];
});
const gestures = new Map(berthPaths);

export function scoreKey({ hours, beats }) { return hours + "." + beats; }
export function meetsOrder(plan, order) {
  return plan.hours <= order.hours && plan.beats <= order.beats;
}

// A later arrival is worth keeping only if it saves some crew time.
export function tradeoffs(plans) {
  const ordered = [...plans].sort((a, b) => a.hours - b.hours || a.beats - b.beats);
  let earliest = Infinity;
  return ordered.filter(plan => {
    if (plan.beats >= earliest) return false;
    earliest = plan.beats;
    return true;
  });
}

export function inspectDispatch(desk, { mask, berths }) {
  const board = desk.boards.get(berths) ?? desk.base;
  const route = trace(board, mask);
  const paired = board.gates.length === 2;
  const mirrorHours = bitCount(mask ^ desk.base.initial);
  const ferryHours = paired ? charterHours : 0;
  const hours = mirrorHours + ferryHours;
  const pending = bitCount(berths) === 1;
  const sailed = route.rays.some(ray => ray.lines.length > 1);
  const valid = !pending && route.end === "ready" && (!paired || sailed);
  // Each point on a completed segment is a cell centre. Ferry crossings start
  // a new segment, and both lamps leave shore on the same beat.
  const arrivals = route.rays.map(ray => ray.end === "ready"
    ? ray.lines.reduce((sum, segment) => sum + segment.length - 1, 0) : null);
  return { board, route, hours, mirrorHours, ferryHours, arrivals, beats: valid ? Math.max(...arrivals) : null, pending, sailed, valid };
}

const chartCache = new WeakMap();
export function prepareDispatch(letter, difficulty) {
  if (!dispatchStations.includes(letter.id)) throw new Error("Station has no dispatch chart");
  if (!chartCache.has(letter)) chartCache.set(letter, new Map());
  const expert = difficulty === "expert";
  const cached = chartCache.get(letter);
  if (cached.has(expert)) return cached.get(expert);
  const rows = expert ? letter.expert : letter.rows;
  const base = prepareBoard(rows);
  const labels = moorings[letter.id][Number(expert)];
  const cells = labels.map(label => (Number(label.slice(1)) - 1) * base.width + label.charCodeAt(0) - 65);
  const boards = new Map([[0, base]]);
  for (const berths of berthStates.filter(value => bitCount(value) === 2)) {
    const tiles = [...base.tiles];
    cells.forEach((cell, i) => { if (berths & (1 << i)) tiles[cell] = "@"; });
    boards.set(berths, prepareBoard(rows.map((_, y) => tiles.slice(y * base.width, (y + 1) * base.width).join(""))));
  }
  const desk = { base, cells, labels, boards, solutions: [], scores: new Set(), orders: [] };
  for (const berths of boards.keys()) {
    for (let mask = 0; mask < 2 ** base.mirrors.length; mask++) {
      const { hours, beats, valid } = inspectDispatch(desk, { mask, berths });
      if (!valid) continue;
      const plan = { mask, berths, hours, beats };
      desk.solutions.push(plan);
      desk.scores.add(scoreKey(plan));
    }
  }
  desk.orders = tradeoffs(desk.solutions).map(({ hours, beats }) => ({ hours, beats }));
  cached.set(expert, desk);
  return desk;
}

export function validPlan(desk, plan) {
  return Number.isInteger(plan?.mask) && plan.mask >= 0 && plan.mask < 2 ** desk.base.mirrors.length
    && berthStates.includes(plan.berths);
}

export function dispatchHint(desk, current, order) {
  const paths = gestures.get(current.berths);
  let best;
  let distance = Infinity;
  for (const plan of desk.solutions) {
    if (!meetsOrder(plan, order)) continue;
    const steps = bitCount(current.mask ^ plan.mask) + paths.get(plan.berths).distance;
    if (steps < distance) {
      best = plan;
      distance = steps;
    }
  }
  if (!best || !distance) return { kind: "log", distance };
  if (current.berths !== best.berths) {
    const slot = paths.get(best.berths).first;
    return { kind: slot === -1 ? "recall" : "berth", index: slot, distance };
  }
  const differences = current.mask ^ best.mask;
  const { route } = inspectDispatch(desk, best);
  const index = route.turns.find(i => differences & (1 << i)) ?? (31 - Math.clz32(differences));
  return { kind: "mirror", index, distance };
}

export function readDispatchLedger(desk, readPlan) {
  const saved = [];
  for (const key of desk.scores) {
    const plan = readPlan(key);
    if (!validPlan(desk, plan)) continue;
    const { hours, beats, valid } = inspectDispatch(desk, plan);
    if (valid && scoreKey({ hours, beats }) === key) saved.push({ mask: plan.mask, berths: plan.berths, hours, beats });
  }
  return tradeoffs(saved);
}
