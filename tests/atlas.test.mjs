import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { atlasHint, blankChart, chartLines, commonSteps, drawStep, fieldNotes, forkPrefix, nextSteps, observations, prepareAtlas, restoreSketch } from "../moon-mail/atlas.mjs";

const station = letters.find(letter => letter.id === "observatory");
const modes = ["standard", "expert"];

// Independent walk over the printed rows. Inspect completed cell trajectories,
// never the game's headings, candidate generator, or list of known solutions.
function pencilWalks(rows) {
  const tiles = rows.join(""), w = rows[0].length;
  const start = tiles.search(/[<>^v]/), mailbox = tiles.indexOf("M");
  const gates = [...tiles.matchAll(/@/g)].map(m => m.index);
  const walks = [];
  function visit(path, dx, dy, freePin, nextSeal) {
    const tip = path.at(-1), x = tip % w, y = Math.floor(tip / w);
    for (const [sx, sy] of [[0,-1], [1,0], [0,1], [-1,0]]) {
      if (dx * sx + dy * sy < 0) continue;
      const bend = dx !== sx || dy !== sy;
      if (bend && (tip === start || gates.includes(tip))) continue;
      const spend = bend && tiles[tip] === ".";
      if (spend && !freePin) continue;
      const nx = x + sx, ny = y + sy, n = ny * w + nx;
      if (nx < 0 || nx >= w || ny < 0 || ny >= rows.length || path.includes(n) || tiles[n] === "#") continue;
      const sequence = Number(tiles[n]);
      if (sequence && sequence !== nextSeal) continue;
      const trail = [...path, n];
      if (n === mailbox) {
        if (nextSeal === 4) walks.push(trail.join("."));
        continue;
      }
      if (gates.includes(n)) trail.push(gates.find(other => other !== n));
      visit(trail, sx, sy, freePin && !spend, nextSeal + Number(Boolean(sequence)));
    }
  }
  const lamp = {v:[0,1], "^":[0,-1]}[tiles[start]];
  visit([start], ...lamp, true, 1);
  return walks.sort();
}

test("the same observatory lamp, ordered stars, twin gates and mailbox admit ten day charts and twenty-one night charts", () => {
  for (const mode of ["relaxed", ...modes]) {
    const board = prepareAtlas(station, mode);
    const rows = mode === "expert" ? station.expert : station.rows;
    assert.equal(board.tiles, rows.join(""));
    const shapes = [...board.routes.values()].map(route => route.cells.join(".")).sort();
    assert.equal(board.routes.size, mode === "expert" ? 21 : 10);
    assert.equal(new Set(shapes).size, shapes.length);
    assert.deepEqual(shapes, pencilWalks(rows));
    for (const [ink, route] of board.routes) {
      assert.deepEqual(restoreSketch(board, ink), route);
      assert.equal(route.cells[0], board.source);
      assert.equal(route.cells.at(-1), board.tiles.indexOf("M"));
      assert.equal(new Set(route.cells).size, route.cells.length);
      assert.deepEqual(route.cells.map(cell => board.tiles[cell]).filter(c => "123".includes(c)), ["1","2","3"]);
    }
  }
});

test("the field notes reward three different physical drawings on each edition, including one standard chart that earns two notes", () => {
  for (const mode of modes) {
    const board = prepareAtlas(station, mode);
    const routes = [...board.routes.values()];
    assert.equal(board.shortest, 10);
    for (const id of observations) assert.ok(routes.some(route => fieldNotes(board, route).join() === id));
    assert.equal(routes.filter(route => route.cells.includes(board.rim)).length, 1);
    const bare = routes.filter(route => fieldNotes(board, route).includes("bare"));
    assert.equal(bare.length, 3);
    assert.ok(bare.every(route => route.pin === null));
    assert.deepEqual(fieldNotes(board, blankChart(board)), []);
    assert.equal(routes.filter(route => fieldNotes(board, route).length > 1).length, mode === "expert" ? 0 : 1);
    if (mode === "expert") assert.deepEqual(new Set(routes.map(route => chartLines(board, route).length)), new Set([1, 2]));
  }
});

test("a tide crossing is a single erasable stroke, and undo returns the sole pin at the bend where it was spent", () => {
  for (const mode of modes) {
    const board = prepareAtlas(station, mode);
    let pins = 0, crossings = 0;
    for (const route of board.routes.values()) {
      let before = blankChart(board);
      for (const d of route.ink) {
        const after = drawStep(board, before, Number(d));
        assert.ok(after);
        assert.deepEqual(restoreSketch(board, after.ink.slice(0, -1)), before);
        if (after.pin !== before.pin) {
          pins++;
          assert.equal(before.pin, null);
          assert.equal(after.pin, before.cells.at(-1));
          assert.equal(board.tiles[after.pin], ".");
        }
        if (board.gates.includes(after.cells.at(-1))) {
          crossings++;
          assert.deepEqual(new Set(after.cells.slice(-2)), new Set(board.gates));
          assert.equal(after.cells.length, before.cells.length + 2);
          assert.ok(nextSteps(board, after).every(next => next.heading === after.heading));
          const segments = chartLines(board, after);
          assert.equal(segments.length, 2);
          assert.equal(segments[1].length, 1);
        }
        before = after;
      }
      assert.deepEqual(nextSteps(board, before), []);
    }
    assert.ok(pins && crossings);
  }
});

test("every legal draft can recover towards each chosen field note with the smallest necessary rewind", () => {
  for (const mode of modes) {
    const board = prepareAtlas(station, mode);
    const filed = new Set([...board.routes.keys()].filter((_, i) => i % 2 === 0));
    let deadEnds = 0;
    function visit(sketch) {
      const next = nextSteps(board, sketch);
      if (!sketch.ready && !next.length) deadEnds++;
      for (const goal of ["", ...observations]) {
        const matches = [...board.routes.values()].filter(route => !goal || fieldNotes(board, route).includes(goal));
        const reachable = matches.filter(route => route.ink.startsWith(sketch.ink));
        const advice = atlasHint(board, sketch, goal, filed);
        if (reachable.some(route => route.ink === sketch.ink)) assert.equal(advice, null);
        else if (reachable.length) {
          const following = drawStep(board, sketch, advice.direction);
          const fresh = reachable.filter(route => !filed.has(route.ink));
          assert.ok((fresh.length ? fresh : reachable).some(route => route.ink.startsWith(following.ink)));
        } else {
          assert.equal(advice.backTo, Math.max(...matches.map(route => commonSteps(sketch.ink, route.ink))));
          assert.ok(advice.backTo < sketch.ink.length);
        }
      }
      for (const move of next) visit(move);
    }
    visit(blankChart(board));
    assert.ok(deadEnds > 0);
  }
});

test("bad saves, wrong first strokes and strokes past the mailbox cannot enter the notebook", () => {
  const board = prepareAtlas(station, "standard");
  for (const ink of [null, {}, [], 110, "١", "1a", "1 ", "1\n", "1".repeat(60), "0", "3", "13"]) assert.equal(restoreSketch(board, ink), null);
  const ink = board.routes.keys().next().value;
  assert.equal(restoreSketch(board, ink + "0"), null);
  for (const d of [-1, 4, 1.5, null, "1", NaN]) assert.equal(drawStep(board, blankChart(board), d), null);
  assert.deepEqual(restoreSketch(board, ""), blankChart(board));
  assert.equal(board.routes.has(ink.slice(0, -1)), false);
});

test("branching keeps the longest real prefix with an unposted alternative, then closes when all charts are filed", () => {
  for (const mode of modes) {
    const board = prepareAtlas(station, mode);
    const filed = new Set();
    for (const ink of board.routes.keys()) {
      assert.equal(forkPrefix(board, ink, filed), null);
      filed.add(ink);
      for (const old of filed) {
        const prefix = forkPrefix(board, old, filed);
        const unseen = [...board.routes.keys()].filter(key => !filed.has(key));
        if (!unseen.length) { assert.equal(prefix, null); continue; }
        assert.ok(old.startsWith(prefix));
        assert.equal(prefix.length, Math.max(...unseen.map(candidate => commonSteps(old, candidate))));
        const alternatives = unseen.filter(key => key.startsWith(prefix) && key[prefix.length] !== old[prefix.length]);
        assert.ok(alternatives.length);
        const tip = restoreSketch(board, prefix);
        assert.ok(alternatives.every(key => drawStep(board, tip, Number(key[prefix.length]))));
      }
    }
    assert.equal(forkPrefix(board, "broken", filed), null);
  }
});
