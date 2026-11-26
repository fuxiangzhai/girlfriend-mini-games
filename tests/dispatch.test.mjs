import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { trace } from "../moon-mail/puzzle.mjs";
import { dispatchStations, prepareDispatch, inspectDispatch, dispatchHint, tapBerth, validPlan, readDispatchLedger, scoreKey, tradeoffs } from "../moon-mail/dispatch.mjs";

const station = id => letters.find(letter => letter.id === id);
const charts = dispatchStations.flatMap(id => ["standard", "expert"].map(mode => ({ id, mode, desk: prepareDispatch(station(id), mode) })));
const frontiers = {
  ferry: { standard: [[2, 8], [3, 2]], expert: [[3, 8], [4, 7]] },
  rain: { standard: [[3, 9], [5, 7]], expert: [[5, 14], [6, 10]] },
  bell: { standard: [[3, 14], [4, 10], [5, 6]], expert: [[5, 7], [6, 6], [7, 5]] },
};
const states = [0, 1, 2, 4, 8, 3, 5, 6, 9, 10, 12];
const pairs = states.filter(n => (n & (n - 1)) !== 0);
const bits = n => n.toString(2).replaceAll("0", "").length;
function sailedLength(ray) {
  return ray.lines.reduce((total, line) => total + line.slice(1).reduce((n, [x,y], i) =>
    n + Math.abs(x - line[i][0]) + Math.abs(y - line[i][1]), 0), 0);
}

test("each manifest offers distinct, attainable tradeoffs on the original mirrors, water and mailboxes", () => {
  for (const { id, mode, desk } of charts) {
    assert.equal(desk.base.tiles, (mode === "expert" ? station(id).expert : station(id).rows).join(""));
    assert.equal(new Set(desk.cells).size, 4);
    assert.ok(desk.cells.every(cell => desk.base.tiles[cell] === "."));
    assert.deepEqual([...desk.boards.keys()].sort((a,b) => a-b), [0,...pairs].sort((a,b) => a-b));
    assert.deepEqual(desk.orders.map(p => [p.hours, p.beats]), frontiers[id][mode]);
    assert.equal(prepareDispatch(station(id), "relaxed"), prepareDispatch(station(id), "standard"));
    const keys = new Set(desk.solutions.map(scoreKey));
    for (const order of desk.orders) {
      assert.ok(keys.has(scoreKey(order)));
      assert.ok(!desk.solutions.some(p => p.hours <= order.hours && p.beats <= order.beats && scoreKey(p) !== scoreKey(order)));
    }
    assert.ok(!desk.solutions.some(p => p.hours === desk.orders[0].hours && p.beats === desk.orders.at(-1).beats));
    const economyBerths = new Set(desk.solutions.filter(p => scoreKey(p) === scoreKey(desk.orders[0])).map(p => p.berths));
    assert.ok(desk.solutions.filter(p => scoreKey(p) === scoreKey(desk.orders.at(-1))).every(p => !economyBerths.has(p.berths)));
    assert.ok(desk.solutions.some(p => p.berths && p.beats === desk.orders.at(-1).beats));
  }
});

test("timing counts sailed edges, preserves stamps and prices only the final mirror setup and a used ferry", () => {
  let unequalArrivals = 0, unusedCharters = 0, skippedStamps = 0;
  for (const { desk } of charts) {
    for (const berths of states) for (let mask = 0; mask < 2 ** desk.base.mirrors.length; mask++) {
      const result = inspectDispatch(desk, { mask, berths });
      const chartered = pairs.includes(berths);
      const original = trace(result.board, mask);
      const jumped = original.rays.some(ray => ray.lines.length > 1);
      assert.equal(result.hours, bits(mask ^ desk.base.initial) + (chartered ? 3 : 0));
      assert.equal(result.valid, original.end === "ready" && (!berths || chartered && jumped));
      if (chartered && !jumped && original.end === "ready") unusedCharters++;
      if (chartered && jumped && original.end === "missing") skippedStamps++;
      if (!result.valid) { assert.equal(result.beats, null); continue; }
      const arrivals = original.rays.map(sailedLength);
      assert.deepEqual(result.arrivals, arrivals);
      assert.equal(result.beats, Math.max(...arrivals));
      if (arrivals.length === 2 && arrivals[0] !== arrivals[1]) unequalArrivals++;
      assert.ok(original.rays.every(ray => ray.lit.size === desk.base.marks.length));
    }
  }
  assert.ok(unequalArrivals && unusedCharters && skippedStamps);
});

// Reverse the legal editing graph, seeded by every sailing that meets the order.
// Dock taps are directional: selecting a third berth releases the previous pair.
function enumerateEdits(desk) {
  const size = 16 * 2 ** desk.base.mirrors.length;
  const previous = Array.from({ length: size }, () => []);
  for (const berths of states) for (let mask = 0; mask < size / 16; mask++) {
    const state = 16 * mask + berths;
    previous[16 * mask].push(state);
    for (const bit of [1,2,4,8]) {
      const next = berths & bit ? berths - bit : pairs.includes(berths) ? bit : berths + bit;
      previous[16 * mask + next].push(state);
    }
    for (let i = 0; i < desk.base.mirrors.length; i++) previous[16 * (mask ^ (1 << i)) + berths].push(state);
  }
  return previous;
}
test("guided and on-demand hints take a shortest path from every chart state to every work order", () => {
  for (const { desk } of charts) {
    const previous = enumerateEdits(desk);
    for (const order of desk.orders) {
      const distance = new Int16Array(previous.length).fill(-1);
      const queue = [];
      for (const { berths, mask, hours, beats } of desk.solutions) {
        if (hours > order.hours || beats > order.beats) continue;
        queue.push(16 * mask + berths);
        distance[16 * mask + berths] = 0;
      }
      for (let i = 0; i < queue.length; i++) for (const prior of previous[queue[i]]) {
        if (distance[prior] !== -1) continue;
        distance[prior] = distance[queue[i]] + 1;
        queue.push(prior);
      }
      for (const berths of states) for (let mask = 0; mask < previous.length / 16; mask++) {
        const steps = distance[16 * mask + berths];
        const hint = dispatchHint(desk, { mask, berths }, order);
        assert.equal(hint.distance, steps);
        if (!steps) { assert.equal(hint.kind, "log"); continue; }
        const next = hint.kind === "mirror" ? 16 * (mask ^ (1 << hint.index)) + berths
          : 16 * mask + (hint.kind === "berth" ? tapBerth(berths, hint.index) : 0);
        assert.equal(distance[next], steps - 1);
      }
    }
  }
});

test("the logbook restores real sailings by score, ignoring corrupt, mismatched and superseded entries", () => {
  const desk = prepareDispatch(station("bell"), "standard");
  const saved = new Map(desk.solutions.map(plan => [scoreKey(plan), plan]));
  const load = () => readDispatchLedger(desk, key => saved.get(key));
  assert.deepEqual(load().map(scoreKey), desk.orders.map(scoreKey));
  const first = load()[0], last = load().at(-1);
  saved.set(scoreKey(first), last);
  assert.ok(!load().some(plan => scoreKey(plan) === scoreKey(first)));
  saved.set(scoreKey(first), { mask: desk.base.initial, berths: 2 });
  assert.ok(!load().some(plan => scoreKey(plan) === scoreKey(first)));
  for (const bad of [null, {}, { mask: -1, berths: 0 }, { mask: 2 ** desk.base.mirrors.length, berths: 0 }, { mask: 0, berths: 7 }, { mask: 0, berths: "1" }]) assert.equal(validPlan(desk, bad), false);
  assert.ok(validPlan(desk, { mask: 0, berths: 1 }));
  assert.deepEqual(tradeoffs([last, first, first]).map(scoreKey), [scoreKey(first),scoreKey(last)]);
});
