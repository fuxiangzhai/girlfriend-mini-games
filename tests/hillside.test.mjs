import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { prepareRoute, trace } from "../moon-mail/puzzle.mjs";
import { prepareHill, traceHill, hillTrip, filedHillTrip, hillHint, moveHill, restoreHill } from "../moon-mail/hillside.mjs";

const letter = letters.find(l => l.id === "funicular");
const modes = ["relaxed", "standard", "expert"];

function* configurations(board) {
  const fixed = 2 ** board.hill.fixed;
  for (let sockets = 0; sockets < 256; sockets++) {
    const digits = sockets.toString(4);
    if (digits.includes("3") || digits.replaceAll("0", "").length > 2) continue;
    for (let mirrors = 0; mirrors < fixed; mirrors++) yield sockets * fixed + mirrors;
  }
}

// Independent cell-by-cell rail walk over the original edition's tiles.
function walk(board, state) {
  const cells = [board.source], stamps = new Set(), seen = new Set();
  let cell = board.source, heading = ">v<^".indexOf(board.tiles[cell]);
  for (;;) {
    const x = cell % board.width + [1, 0, -1, 0][heading];
    const y = Math.floor(cell / board.width) + [0, 1, 0, -1][heading];
    if (x < 0 || x >= board.width || y < 0 || y >= board.height) return null;
    cell = y * board.width + x;
    const entry = cell * 4 + heading, tile = board.tiles[cell];
    if (tile === "#" || cell === board.source || seen.has(entry)) return null;
    seen.add(entry);
    cells.push(cell);
    if (tile === "*") stamps.add(cell);
    if (tile === "M") return stamps.size === 2 ? cells : null;
    const index = board.mirrors.indexOf(cell);
    if (index < 0) continue;
    const setting = index < board.hill.fixed ? 1 + (Math.floor(state / 2 ** index) % 2)
      : Math.floor(state / (2 ** board.hill.fixed * 4 ** (index - board.hill.fixed))) % 4;
    if (setting) heading ^= setting === 1 ? 3 : 1;
  }
}

test("every legal layout on each original hillside chart gives exactly four different physical journeys", () => {
  for (const mode of modes) {
    const b = prepareHill(letter, mode), original = prepareRoute(letter, mode);
    assert.equal(b.initial, original.initial);
    assert.equal(b.tiles, original.tiles);
    assert.deepEqual(b.mirrors.slice(0, b.hill.fixed), original.mirrors);
    assert.ok(b.hill.sockets.every(cell => b.tiles[cell] === "."));
    assert.deepEqual(traceHill(b, b.initial).lines, trace(original, original.initial).lines);
    const physical = new Map(), trips = new Map();
    for (const state of configurations(b)) {
      const path = traceHill(b, state), trip = hillTrip(b, path);
      const expected = walk(b, state);
      assert.deepEqual(trip?.cells ?? null, expected);
      if (!trip) continue;
      if (physical.has(trip.id)) assert.equal(trip.signature, physical.get(trip.id));
      physical.set(trip.id, trip.signature);
      trips.set(trip.id, trip);
    }
    assert.deepEqual([...physical.keys()].sort(), [...b.hill.lines].sort());
    assert.equal(new Set(physical.values()).size, 4);
    assert.deepEqual(trips.get("cut").side, "west");
    assert.deepEqual(trips.get("orchard").side, "north");
    if (mode !== "expert") assert.deepEqual(trips.get("market").stamps, trips.get("lantern").stamps.slice().reverse());
    else assert.ok(trips.get("balcony").cells.includes(8) && !trips.get("lantern").cells.includes(8));
  }
});

test("mirrors can move between sockets, undo is exact and an over-capacity draft cannot resume", () => {
  for (const mode of modes) {
    const b = prepareHill(letter, mode), first = b.hill.fixed;
    const actions = [0, first, first + 1, first, first, first + 2];
    let state = b.initial;
    const previous = [];
    for (const action of actions) {
      previous.push(state);
      state = moveHill(b, state, action);
      assert.notEqual(state, null);
    }
    assert.equal(restoreHill(b, actions), state);
    for (const action of actions.slice().reverse()) {
      state = moveHill(b, state, action, true);
      assert.equal(state, previous.pop());
    }
    assert.equal(restoreHill(b, [first, first + 1, first + 2]), null);
    for (const invalid of [null, [false], [-1], [1.2], [b.mirrors.length]]) assert.equal(restoreHill(b, invalid), null);
  }
});

test("filing retraces the trip, rejects damaged receipts and ignores switches off the travelled path", () => {
  const b = prepareHill(letter, "standard");
  const states = Array.from(configurations(b)).filter(s => hillTrip(b, traceHill(b, s))?.id === "lantern");
  assert.ok(states.length > 1);
  const signature = filedHillTrip(b, states[0], "lantern").signature;
  for (const s of states) {
    assert.equal(filedHillTrip(b, s, "lantern").signature, signature);
    assert.equal(filedHillTrip(b, s, "market"), null);
  }
  for (const bad of [b.initial, null, "0", -1, 1.5, 3 << b.hill.fixed, 21 << b.hill.fixed, 1 << 24]) {
    assert.equal(filedHillTrip(b, bad, "lantern"), null);
  }
});

test("hints shorten a legal shortest path to each specific ticket even when both mirrors are already in use", () => {
  for (const mode of ["standard", "expert"]) {
    const b = prepareHill(letter, mode), all = [...configurations(b)];
    const winners = new Map(b.hill.lines.map(id => [id, []]));
    for (const state of all) {
      const trip = hillTrip(b, traceHill(b, state));
      if (trip) winners.get(trip.id).push(state);
    }
    for (const [id, queue] of winners) {
      const distance = new Map(queue.map(state => [state, 0]));
      for (let head = 0; head < queue.length; head++) {
        const state = queue[head];
        for (let i = 0; i < b.mirrors.length; i++) {
          const prev = moveHill(b, state, i, true);
          if (prev === null || distance.has(prev)) continue;
          distance.set(prev, 1 + distance.get(state));
          queue.push(prev);
        }
      }
      assert.equal(distance.size, all.length);
      for (const state of all) {
        const next = hillHint(b, state, [id]);
        if (distance.get(state) === 0) assert.equal(next, undefined);
        else assert.equal(distance.get(moveHill(b, state, next)), distance.get(state) - 1);
      }
    }
  }
});
