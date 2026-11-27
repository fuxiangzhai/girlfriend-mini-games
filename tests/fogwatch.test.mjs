import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { closestRoute, prepareBoard, trace, traceShore } from "../moon-mail/puzzle.mjs";
import { advisePort, hearShore, newWatch, possibleMirrors, prepareWatch, proven, publicEvidence, readMirror, restoreWatch, validWatchSeal, watchMask, watchPar } from "../moon-mail/fogwatch.mjs";

const letter = letters.find(l => l.id === "chimes");
const charts = ["standard", "expert"].map(d => prepareWatch(letter, d));
const bits = n => n.toString(2).replaceAll("0", "").length;
const subsets = watch => Array.from({length: 2 ** watch.ports.length}, (_, n) => watch.ports.map((_, i) => i).filter(i => n & (1 << i)));

test("shore pulses enter at the board edge, hit boundary mirrors, preserve gate direction and report only audible evidence", () => {
  const empty = prepareBoard(["...", "..M", ">.."]);
  for (const [from, to] of [["N1", "quiet"], ["N2", "S2"], ["S2", "N2"], ["W2", "box"], ["E1", "W1"]]) {
    assert.equal(traceShore(empty, 0, from).report, "|" + to);
  }
  const gate = prepareBoard(["@1.M", "....", "@..>", ".#.."]);
  const jump = traceShore(gate, 0, "W3");
  assert.equal(jump.report, "1|box");
  assert.deepEqual(jump.ray.lines, [[[0,2.5],[.5,2.5]], [[.5,.5],[1.5,.5],[2.5,.5],[3.5,.5]]]);
  const corner = prepareBoard(["A..", "..M", ">.."]);
  assert.equal(traceShore(corner, 0, "N1").report, "|W1");
  assert.equal(traceShore(corner, 1, "N1").report, "|E1");
  for (const port of ["E0", "N8", "X1"]) assert.throws(() => traceShore(empty, 0, port), RangeError);
  const w = charts[0];
  assert.equal(hearShore(w.board, w.known, "N5").report, "|box");
  assert.equal(hearShore(w.board, w.shifts[0], "N5").report, "2|box");
});

test("every shift takes multiple independent calls, has one identifiable layout and leads to a real ordered delivery", () => {
  assert.strictEqual(prepareWatch(letter, "relaxed"), charts[0]);
  for (const [edition, w] of charts.entries()) {
    assert.equal(w.board.tiles, (edition ? letter.expert : letter.rows).join(""));
    assert.deepEqual(new Set(w.shifts), new Set(w.masks));
    const routes = Array.from({length: 2 ** w.board.mirrors.length}, (_, i) => i).filter(i => trace(w.board, i).end === "ready");
    const transcripts = w.masks.map(m => w.reports.get(m));
    assert.ok(new Set(transcripts.map(r => r.map(v => v.split("|")[1]).join())).size < w.masks.length, "bells carry information even with every shore known");
    for (const [shift, mask] of w.shifts.entries()) {
      let shortest = Infinity;
      for (const heard of subsets(w)) {
        const observed = publicEvidence(w, shift, heard);
        const expected = w.masks.filter(m => heard.every(i => hearShore(w.board, m, w.ports[i]).report === hearShore(w.board, mask, w.ports[i]).report));
        assert.deepEqual(possibleMirrors(w, observed), expected);
        if (expected.length === 1) shortest = Math.min(shortest, heard.length);
        if (heard.length === w.ports.length) assert.deepEqual(expected, [mask]);
      }
      const turns = Math.min(...routes.map(route => bits(route ^ mask)));
      assert.ok(shortest >= 2 && turns > 0);
      assert.deepEqual(watchPar(w, shift), { calls: shortest, turns });
    }
  }
});

test("each pencil explanation cites the fewest observed lamps that force that single mirror", () => {
  for (const w of charts) {
    const choices = subsets(w);
    for (const shift of w.shifts.keys()) for (const heard of choices) {
      const evidence = publicEvidence(w, shift, heard);
      const candidates = possibleMirrors(w, evidence);
      for (const index of w.board.mirrors.keys()) {
        const bit = 1 << index;
        if (!(w.hidden & bit)) continue;
        const result = readMirror(w, evidence, index);
        assert.equal(result.falling, candidates.filter(m => m & bit).length);
        assert.equal(result.rising + result.falling, candidates.length);
        if (result.falling && result.rising) { assert.equal(result.proof, undefined); continue; }
        assert.ok(result.proof.every(entry => evidence.includes(entry)));
        const expected = Boolean(w.shifts[shift] & bit);
        assert.ok(possibleMirrors(w, result.proof).every(m => Boolean(m & bit) === expected));
        for (const smaller of choices.filter(c => c.length < result.proof.length && c.every(i => heard.includes(i)))) {
          const remaining = possibleMirrors(w, publicEvidence(w, shift, smaller));
          assert.ok(remaining.some(m => Boolean(m & bit) !== expected));
        }
      }
    }
  }
});

// Independent decision-tree feasibility, with a fixed maximum number of calls.
function canIdentify(w, candidates, left) {
  if (candidates.length === 1) return true;
  if (!left) return false;
  return w.ports.some((_, port) => {
    const replies = new Set(candidates.map(mask => w.reports.get(mask)[port]));
    return replies.size > 1 && [...replies].every(reply =>
      canIdentify(w, candidates.filter(mask => w.reports.get(mask)[port] === reply), left - 1));
  });
}
test("hints use only shared evidence and always choose an optimal worst-case branch", () => {
  for (const w of charts) {
    const groups = new Map();
    for (const shift of w.shifts.keys()) for (const heard of subsets(w)) {
      const possible = possibleMirrors(w, publicEvidence(w, shift, heard));
      groups.set(possible.join(), possible);
    }
    for (const possible of groups.values()) {
      const hint = advisePort(w, possible);
      assert.ok(canIdentify(w, possible, hint.depth));
      if (hint.depth === 0) { assert.equal(possible.length, 1); continue; }
      assert.ok(!canIdentify(w, possible, hint.depth - 1));
      const branches = new Set(possible.map(m => w.reports.get(m)[hint.port]));
      assert.ok(branches.size > 1);
      for (const reading of branches) assert.ok(canIdentify(w, possible.filter(m => w.reports.get(m)[hint.port] === reading), hint.depth - 1));
    }
  }
});

test("restored runs require public proof before repair and a real delivery before signing", () => {
  for (const w of charts) for (const [shift, truth] of w.shifts.entries()) {
    const run = newWatch(w);
    assert.deepEqual(restoreWatch(w, shift, run), run);
    run.pencil = truth;
    assert.equal(proven(w, shift, run), false);
    assert.equal(restoreWatch(w, shift, { ...run, phase: "repair" }), null);
    run.heard = w.ports.map((_, i) => i);
    run.phase = "repair";
    assert.deepEqual(restoreWatch(w, shift, run), run);
    assert.equal(validWatchSeal(w, shift, run), false);
    for (let mask = truth; trace(w.board, mask).end !== "ready"; mask = watchMask(w, shift, run)) run.turns.push(closestRoute(w.board, mask).next);
    assert.equal(validWatchSeal(w, shift, run), true);
    const altered = { ...run, heard: [0,0] };
    assert.equal(validWatchSeal(w, shift, altered), false);
    for (const bad of [{port: 99}, {heard: [-1]}, {pencil: -1}, {turns: [w.board.mirrors.length]}, {phase: "survey"}]) {
      assert.equal(restoreWatch(w, shift, {...run, ...bad}), null);
    }
  }
});
