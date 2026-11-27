import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { prepareRoute } from "../moon-mail/puzzle.mjs";
import { prepareDuet, gatherDuet, relayDuet, initialDuet, duetMove, duetBeat, duetHint, duetPieces, verifiedDuet, restoreDuet } from "../moon-mail/duet.mjs";

const huts = letters.find(letter => letter.id === "signals");
const modes = ["relaxed", "standard", "expert"];

// A separate cell walker, with no dependency on the production ray tracer.
function walk(b, mask, cell, heading, goal) {
  const seen = new Set(), cells = [cell];
  for (;;) {
    const x = cell % b.width + [1, 0, -1, 0][heading];
    const y = Math.floor(cell / b.width) + [0, 1, 0, -1][heading];
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return null;
    cell = y * b.width + x;
    const entry = cell * 4 + heading;
    if (seen.has(entry) || b.tiles[cell] === "#" || cell === b.source || cell === b.starSource) return null;
    seen.add(entry); cells.push(cell);
    if (b.tiles[cell] === goal) return cells;
    if ("SM".includes(b.tiles[cell])) return null;
    const mirror = b.mirrors.indexOf(cell);
    if (mirror >= 0) heading = (mask & (1 << mirror) ? [1, 0, 3, 2] : [3, 2, 1, 0])[heading];
  }
}
function solve(b, target, state = initialDuet(b)) {
  const history = [];
  for (let n = 0; n < 24; n++) {
    const action = duetHint(b, state, [target]);
    assert.ok(action);
    if (action[0] === "send") {
      assert.equal(relayDuet(b, state).id, target);
      return { history, state };
    }
    state = duetMove(b, state, action);
    assert.ok(state);
    history.push(action);
  }
  assert.fail("The hints did not reach " + target);
}

test("all signal-hut setups agree with an independent walk and yield five coastal or four summit geometries", () => {
  for (const mode of modes) {
    const b = prepareDuet(huts, mode), original = prepareRoute(huts, mode, "joint"), physical = new Map();
    assert.deepEqual([b.tiles, b.initial, b.mirrors], [original.tiles, original.initial, original.mirrors]);
    for (let mask = 0; mask < 2 ** b.mirrors.length; mask++) {
      const incoming = [walk(b, mask, b.source, ">v<^".indexOf(b.tiles[b.source]), "&"),
        walk(b, mask, b.starSource, "eswn".indexOf(b.tiles[b.starSource]), "&")];
      assert.equal(gatherDuet(b, mask).jointCount, incoming.filter(Boolean).length);
      if (!incoming.every(Boolean)) continue;
      for (let switched = -1; switched < b.mirrors.length; switched++) {
        const out = switched < 0 ? mask : mask ^ (1 << switched);
        for (let moon = 0; moon < 4; moon++) for (let star = 0; star < 4; star++) {
          const tracks = [walk(b, out, b.jointCell, moon, "M"), walk(b, out, b.jointCell, star, "S")];
          const state = { stage: "relay", mask, switched, moon, star, delay: 0 };
          const preview = relayDuet(b, state);
          assert.deepEqual(preview.tracks.map(track => track?.map(([x, y]) => Math.floor(x) + Math.floor(y) * b.width) || null), tracks);
          if (!tracks.every(Boolean)) continue;
          const required = tracks[0].length - tracks[1].length;
          for (let delay = -b.maxRest; delay <= b.maxRest; delay++) {
            const score = relayDuet(b, { ...state, delay });
            assert.equal(score.synced, delay === required);
            if (!score.synced) continue;
            const signature = JSON.stringify([...incoming, ...tracks]);
            if (physical.has(score.id)) assert.equal(physical.get(score.id), signature);
            physical.set(score.id, signature);
          }
        }
      }
    }
    assert.equal(physical.size, mode === "expert" ? 4 : 5);
    assert.equal(new Set(physical.values()).size, physical.size);
    assert.deepEqual([...physical.keys()].sort(), duetPieces(b).sort());
  }
});

test("every target is reachable from every intake mirror layout with legal hints and identical replay starts", () => {
  for (const mode of modes) {
    const b = prepareDuet(huts, mode);
    for (const id of duetPieces(b)) {
      const first = solve(b, id);
      assert.deepEqual(restoreDuet(b, first.history), first.state);
      for (let mask = 0; mask < 2 ** b.mirrors.length; mask++) {
        const start = { ...initialDuet(b), mask };
        solve(b, id, start);
        const docked = duetMove(b, start, ["dock"]);
        if (docked) solve(b, id, { ...docked, switched: 0, delay: b.maxRest });
      }
    }
  }
});

test("the two score lanes rest, sail and ring at their actual chart positions, including mismatched arrivals", () => {
  for (const mode of modes) {
    const b = prepareDuet(huts, mode);
    for (const id of duetPieces(b)) {
      const { state } = solve(b, id), s = relayDuet(b, state);
      assert.ok(verifiedDuet(b, state, id));
      assert.deepEqual(duetBeat(s, s.endBeat).map(v => v.event), ["arrive", "arrive"]);
      for (let n = 0; n <= s.endBeat; n++) {
        const voices = duetBeat(s, n);
        voices.forEach((v, i) => {
          if (n < s.waits[i]) assert.equal(v.event, "rest");
          assert.deepEqual(v.point, s.tracks[i][Math.max(0, n - s.waits[i])]);
        });
      }
      if (state.delay) {
        const early = relayDuet(b, { ...state, delay: 0 });
        assert.equal(early.synced, false);
        assert.ok(duetBeat(early, early.endBeat).some(v => v.event === "held"));
        assert.equal(verifiedDuet(b, { ...state, delay: 0 }, id), null);
      }
      assert.equal(duetBeat(s, s.endBeat + 1), null);
    }
  }
});

test("a relay changes at most one mirror, backtracking restores intake and corrupted proofs cannot issue a score", () => {
  const b = prepareDuet(huts, "standard"), solved = solve(b, "moon");
  const dock = restoreDuet(b, solved.history.slice(0, 1 + solved.history.findIndex(a => a[0] === "dock")));
  const first = duetMove(b, dock, ["mirror", 2]);
  const other = duetMove(b, first, ["mirror", 3]);
  assert.equal(other.switched, 3);
  assert.deepEqual(duetMove(b, other, ["mirror", 3]), dock);
  assert.deepEqual(duetMove(b, other, ["back"]), { ...initialDuet(b), mask: dock.mask });
  for (const bad of [null, { stage: "relay" }, { ...solved.state, mask: -1 }, { ...solved.state, mask: b.initial },
    { ...solved.state, switched: 99 }, { ...solved.state, delay: 5 }, { ...solved.state, moon: "1" }]) {
    assert.equal(verifiedDuet(b, bad, "moon"), null);
  }
  assert.equal(verifiedDuet(b, solved.state, "star"), null);
  for (const bad of [null, [["dock"]], [["star", 1]], [["mirror", -1]], [false]]) assert.equal(restoreDuet(b, bad), null);
});
