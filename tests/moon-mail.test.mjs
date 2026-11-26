import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { prepareBoard, trace, closestRoute } from "../moon-mail/puzzle.mjs";

test("all six letters start unsolved and their shortest routes follow the intended progression", () => {
  const par = [1, 2, 3, 3, 4, 6];
  assert.equal(new Set(letters.map(letter => letter.id)).size, par.length);
  letters.forEach(({ rows }, index) => {
    const board = prepareBoard(rows);
    assert.ok(rows.every(row => row.length === board.width));
    assert.equal(board.tiles.match(/[<>v^]/g)?.length, 1);
    assert.equal(board.tiles.match(/M/g)?.length, 1);
    assert.ok([0, 2].includes(board.gates.length));
    assert.notEqual(trace(board, board.initial).end, "ready");
    assert.equal(closestRoute(board, board.initial).distance, par[index]);
  });
});

test("hints reduce the actual shortest distance by one from every mirror configuration", () => {
  for (const letter of letters) {
    const board = prepareBoard(letter.rows);
    // Work backwards from every valid delivery by individual mirror turns.
    const size = 2 ** board.mirrors.length;
    const distance = Array(size).fill(Infinity);
    const queue = [];
    for (let state = 0; state < size; state++) {
      if (trace(board, state).end === "ready") {
        queue.push(state);
        distance[state] = 0;
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const state = queue[i];
      for (let mirror = 0; mirror < board.mirrors.length; mirror++) {
        const other = state ^ (1 << mirror);
        if (distance[other] !== Infinity) continue;
        distance[other] = distance[state] + 1;
        queue.push(other);
      }
    }
    assert.equal(queue.length, size);
    for (let state = 0; state < size; state++) {
      const hint = closestRoute(board, state);
      assert.equal(hint.distance, distance[state], letter.id);
      if (distance[state] === 0) assert.equal(hint.next, undefined);
      else {
        assert.ok(Number.isInteger(hint.next));
        assert.equal(distance[state ^ (1 << hint.next)], distance[state] - 1, letter.id);
      }
    }
  }
});

test("illumination is recomputed for each route and the mailbox requires every mark", () => {
  const board = prepareBoard(letters[2].rows);
  const direct = trace(board, board.initial);
  assert.equal(direct.end, "missing");
  assert.equal(direct.lit.size, 0);
  let state = board.initial;
  while (trace(board, state).end !== "ready") state ^= 1 << closestRoute(board, state).next;
  assert.equal(trace(board, state).lit.size, 1);
  assert.equal(trace(board, board.initial).lit.size, 0);
});

test("the last letter must traverse the same tide gate twice and keep its direction at both exits", () => {
  const board = prepareBoard(letters.at(-1).rows);
  let found = 0;
  for (let state = 0; state < 2 ** board.mirrors.length; state++) {
    const result = trace(board, state);
    if (result.end !== "ready") continue;
    found++;
    assert.equal(result.lit.size, 2);
    assert.equal(result.lines.length, 3);
    const entrances = [];
    for (let i = 1; i < result.lines.length; i++) {
      const before = result.lines[i - 1], after = result.lines[i];
      const entrance = before.at(-1), exit = after[0];
      assert.notDeepEqual(entrance, exit);
      entrances.push(entrance);
      assert.deepEqual(entrance.map((value, n) => value - before.at(-2)[n]),
        after[1].map((value, n) => value - exit[n]));
    }
    assert.deepEqual(entrances[0], entrances[1]);
  }
  assert.ok(found > 0);
});

test("a reef stops light on its near side, and an escaping beam ends on the board edge", () => {
  const reef = prepareBoard([">#M"]);
  const hit = trace(reef, reef.initial);
  assert.equal(hit.end, "blocked");
  assert.deepEqual(hit.lines[0].at(-1), [1.2, .5]);
  const sea = prepareBoard([">B.", "..M"]);
  const escaped = trace(sea, sea.initial);
  assert.equal(escaped.end, "sea");
  assert.deepEqual(escaped.lines[0].at(-1), [1.5, 2]);
});
