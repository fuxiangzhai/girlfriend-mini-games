import test from "node:test";
import assert from "node:assert/strict";
import { letters, localLetter } from "../moon-mail/levels.mjs";
import { prepareBoard, prepareRoute, isNumbered, trace, closestRoute } from "../moon-mail/puzzle.mjs";
import { chooseLanguage, translator } from "../moon-mail/i18n.mjs";

test("all nine standard letters start unsolved and retain the original six routes", () => {
  const par = [1, 2, 3, 3, 4, 6, 1, 4, 5];
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

test("every standard and expert configuration has a shortest route and a valid next turn", () => {
  const charts = letters.flatMap(letter => [letter.rows, letter.expert]);
  for (const rows of charts) {
    const board = prepareBoard(rows);
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
      assert.equal(hint.distance, distance[state], rows.join("/"));
      if (distance[state] === 0) assert.equal(hint.next, undefined);
      else {
        assert.ok(Number.isInteger(hint.next));
        assert.equal(distance[state ^ (1 << hint.next)], distance[state] - 1, rows.join("/"));
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

test("the dawn letter must traverse the same tide gate twice and keep its direction at both exits", () => {
  const board = prepareBoard(letters.find(letter => letter.id === "dawn").rows);
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

test("relaxed starts one or two turns away and each expert budget fits its own unique chart", () => {
  const expertPar = [3, 4, 5, 5, 6, 7, 4, 6, 7];
  const layouts = new Set();
  letters.forEach((letter, i) => {
    const relaxed = prepareRoute(letter, "relaxed");
    const normal = prepareRoute(letter, "standard");
    const expert = prepareRoute(letter, "expert");
    const min = closestRoute(normal, normal.initial).distance;
    assert.equal(closestRoute(relaxed, relaxed.initial).distance, Math.min(2, min));
    assert.equal(relaxed.budget, null);
    assert.equal(normal.budget, null);
    assert.equal(expert.budget, expertPar[i]);
    assert.equal(closestRoute(expert, expert.initial).distance, expert.budget);
    assert.ok(expert.budget > min);
    for (const rows of [letter.rows, letter.expert]) {
      assert.ok(rows.every(row => row.length === rows[0].length && /^[AB.M#*@1-3<>^v]+$/.test(row)));
      const numbers = [...rows.join("")].filter(isNumbered).map(Number).sort();
      assert.deepEqual(numbers, numbers.map((_, index) => index + 1));
      const layout = rows.join("/").replace(/[AB]/g, "X");
      assert.ok(!layouts.has(layout));
      layouts.add(layout);
    }
  });
});

test("a reply that reaches every seal in reverse order cannot be delivered", () => {
  const board = prepareBoard(letters.find(letter => letter.id === "glasshouse").rows);
  const wrong = trace(board, board.initial);
  assert.equal(wrong.end, "order");
  assert.equal(wrong.lit.size, 2);
  assert.deepEqual(wrong.sequence, [2, 1]);
  const next = closestRoute(board, board.initial).next;
  const right = trace(board, board.initial ^ (1 << next));
  assert.equal(right.end, "ready");
  assert.deepEqual(right.sequence, [1, 2]);
  for (const letter of letters.filter(letter => letter.chapter === "replies")) {
    for (const rows of [letter.rows, letter.expert]) {
      const b = prepareBoard(rows);
      for (let mask = 0; mask < 2 ** b.mirrors.length; mask++) {
        const path = trace(b, mask);
        if (path.end === "ready") assert.deepEqual(path.sequence, b.marks.map((_, index) => index + 1));
      }
    }
  }
});

test("an explicit language takes precedence and both editions contain complete station copy", () => {
  assert.equal(chooseLanguage("zh", ["en-US"]), "zh");
  assert.equal(chooseLanguage(null, ["de-DE", "en-GB"]), "en");
  assert.equal(chooseLanguage("invalid", ["zh-TW"]), "zh");
  assert.equal(chooseLanguage(null, []), "zh");
  assert.equal(translator("en")("hintStatus", {cell: "B2"}), "Try turning the mirror at B2.");
  for (const letter of letters) {
    const en = localLetter(letter, "en");
    for (const key of ["title", "place", "artAlt", "brief", "expertNote", "letter"]) {
      assert.ok(en[key] && letter[key] && en[key] !== letter[key]);
    }
    assert.ok(en.letter.length <= 200 && letter.letter.length <= 200);
  }
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
