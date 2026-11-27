import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { firstParting, fitsDrum, pilotHint, sail, tideCatalog, tideCourse, wakeLines } from "../moon-mail/tide-roll.mjs";

const letter = letters.find(l => l.id === "arches");
const day = tideCourse(letter, "standard");
const night = tideCourse(letter, "expert");
const easy = tideCourse(letter, "relaxed");

test("the reel uses both original Twin Arch charts and their fixed guide mirrors", () => {
  for (const [c, rows] of [[easy, letter.rows], [day, letter.rows], [night, letter.expert]]) {
    assert.equal(c.board.tiles, rows.join(""));
    assert.notEqual(sail(c, c.starter).end, "ready");
  }
  assert.equal(sail(easy, easy.starter).frames.at(-1).stamped, true);
  assert.deepEqual(easy.pinned, [0, 4]);
  assert.ok(fitsDrum(day, "000000"));
  for (const bad of [undefined, null, 302330, "30233", "402330", "300300", "30233\n", "302330 "]) {
    assert.equal(sail(easy, bad), null);
  }
});

test("one tooth at the star creates two eleven-step wakes of equal length", () => {
  const quick = sail(day, "302332"), cove = sail(day, "302333");
  assert.deepEqual([quick.end, cove.end], ["ready", "ready"]);
  assert.deepEqual([quick.steps, cove.steps, quick.coast, cove.coast], [11, 11, "return", "cove"]);
  assert.deepEqual(firstParting(quick, cove), {beat: 7, cell: 23});
  assert.deepEqual(quick.frames.slice(7).map(f => f.enter), [23, 29, 8, 9, 3]);
  assert.deepEqual(cove.frames.slice(7).map(f => f.enter), [23, 22, 28, 29, 3]);
  // Changing an unused tooth cannot mint a different postmark.
  const a = sail(day, "313200"), b = sail(day, "313201");
  assert.equal(a.end, "ready"); assert.equal(a.id, b.id); assert.equal(firstParting(a, b), null);
});

test("arches hold the waiting tooth and heading, flip the reading order and break the drawn wake", () => {
  const trip = sail(day, "302333");
  const [before, arch, stamp, after] = trip.frames.slice(5, 9);
  assert.deepEqual([arch.enter, arch.cell, arch.heading, arch.next, arch.order], [2, 29, before.heading, before.next, -1]);
  assert.deepEqual([stamp.slot, after.slot], [5, 4]);
  const lines = wakeLines(day.board, trip.frames, 8);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].at(-1), [2.5, .5]);
  assert.deepEqual(lines[1], [[5.5, 4.5], [5.5, 3.5], [4.5, 3.5]]);
  assert.deepEqual(wakeLines(day.board, trip.frames, 0), [[[.5, 2.5]]]);
});

// Independent helmsman with a physical queue of teeth. At an arch the current
// tooth stays at the head and the rest of the queue turns end for end.
function pilotByHand(board, tape) {
  const steps = [board.source];
  let d = ">v<^".indexOf(board.tiles[board.source]), cell = board.source;
  let teeth = [...tape].map((_, i) => i), stamped = false, crossings = 0;
  const seen = new Set();
  while (true) {
    const state = [cell, d, teeth.join(""), stamped, crossings > 0].join("/");
    if (seen.has(state)) return null;
    seen.add(state);
    const x = cell % board.width + [1,0,-1,0][d], y = Math.floor(cell/board.width) + [0,1,0,-1][d];
    if (x < 0 || x >= board.width || y < 0 || y >= board.height) return null;
    cell = x + y*board.width;
    const tile = board.tiles[cell];
    steps.push(cell);
    switch (tile) {
      case "#": case ">": return null;
      case "M": return stamped && crossings ? steps : null;
      case "@":
        crossings++;
        cell = board.gates.find(g => g !== cell);
        teeth = [teeth[0], ...teeth.slice(1).reverse()];
        break;
      case "A": d = [3,2,1,0][d]; break;
      case "B": d = [1,0,3,2][d]; break;
      default: {
        stamped ||= tile === "*";
        const tooth = teeth.shift();
        teeth.push(tooth);
        d = (d + Number(tape[tooth])) % 4;
      }
    }
  }
}

test("every allowed strip agrees with an independent navigator, grouped by physical wake", () => {
  for (const [course, counts] of [[easy, [5,2]], [day, [12,4]], [night, [7,1,2]]]) {
    const existing = tideCatalog(course), paths = new Map();
    for (let code = 0; code < 4 ** course.starter.length; code++) {
      const strip = code.toString(4).padStart(course.starter.length, "0");
      if (!fitsDrum(course, strip)) continue;
      const steps = pilotByHand(course.board, strip), trip = sail(course, strip);
      if (!steps) { assert.equal(trip.id, null); continue; }
      assert.deepEqual(trip.frames.map(f => f.enter), steps);
      assert.ok(existing.get(trip.id).tapes.includes(strip));
      assert.equal(trip.coast, course.night ? course.coasts[trip.gates - 1] : steps.includes(28) ? "cove" : "return");
      paths.set(steps.join("."), trip.coast);
    }
    assert.equal(existing.size, paths.size);
    assert.deepEqual(course.coasts.map(k => [...paths.values()].filter(v => v === k).length), counts);
  }
});

test("single-tooth hints reach each requested sailing, honor pins and find another unfiled wake", () => {
  function follow(c, strip, goal, filed) {
    for (let i = 0; i <= strip.length; i++) {
      const hint = pilotHint(c, strip, goal, filed);
      if (!hint) return sail(c, strip);
      assert.ok(!c.pinned.includes(hint.slot));
      strip = strip.slice(0, hint.slot) + hint.turn + strip.slice(hint.slot + 1);
    }
    assert.fail("Hints failed to converge");
  }
  for (const c of [easy, day, night]) {
    for (const coast of c.coasts) {
      const trip = follow(c, c.starter, coast, new Set());
      assert.equal(trip.coast, coast);
      if ([...tideCatalog(c).values()].filter(v => v.coast === coast).length > 1) {
        const next = follow(c, trip.tape, coast, new Set([trip.id]));
        assert.ok(next.id && next.id !== trip.id); assert.equal(next.coast, coast);
      }
    }
  }
});

test("an unstamped arrival, a missed arch and three hazards produce distinct terminal frames", () => {
  for (const [c, strip, end] of [[day,"310000","missing"],[night,"0001022","ungated"],[day,"000000","reef"],[day,"100000","sea"],[day,"102002","quay"]]) {
    const trip = sail(c, strip);
    assert.equal(trip.end, end); assert.equal(trip.id, null);
  }
  const edge = sail(day, "100000");
  assert.deepEqual(edge.frames.at(-1).edge, [1.5, 5]);
  assert.deepEqual(wakeLines(day.board, edge.frames).at(-1).at(-1), [1.5, 5]);
});
