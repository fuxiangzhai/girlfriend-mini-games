import test from "node:test";
import assert from "node:assert/strict";
import { letters, localLetter } from "../moon-mail/levels.mjs";
import { prepareBoard, prepareRoute, isNumbered, trace, closestRoute } from "../moon-mail/puzzle.mjs";
import { chooseLanguage, translator } from "../moon-mail/i18n.mjs";

test("all twelve standard letters start unsolved and retain the original nine routes", () => {
  const par = [1, 2, 3, 3, 4, 6, 1, 4, 5, 2, 3, 4];
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
  const charts = letters.flatMap(letter => [letter.rows, letter.expert].flatMap(rows =>
    rows.join("").includes("&") ? [prepareBoard(rows), prepareBoard(rows, "joint")] : [prepareBoard(rows)]));
  for (const board of charts) {
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
      assert.equal(hint.distance, distance[state], board.tiles);
      if (distance[state] === 0) assert.equal(hint.next, undefined);
      else {
        assert.ok(Number.isInteger(hint.next));
        assert.equal(distance[state ^ (1 << hint.next)], distance[state] - 1, board.tiles);
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
  const expertPar = [3, 4, 5, 5, 6, 7, 4, 6, 7, 4, 5, 7];
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
      assert.ok(rows.every(row => row.length === rows[0].length && /^[AB.M#*@1-3<>^veswnS&]+$/.test(row)));
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

test("wrong mailboxes and the other lamp stop a beam, and two lit boxes alone cannot earn a joint postmark", () => {
  const swapped = trace(prepareBoard([">S.", "eM&"]), 0);
  assert.deepEqual(swapped.rays.map(ray => ray.end), ["wrongBox", "wrongBox"]);
  assert.equal(swapped.matched, 0);
  const blocked = trace(prepareBoard([">e.", "MS&"]), 0);
  assert.equal(blocked.rays[0].end, "blocked");
  const rows = [">.M", "e&S"];
  assert.equal(trace(prepareBoard(rows), 0).end, "ready");
  const unstamped = trace(prepareBoard(rows, "joint"), 0);
  assert.equal(unstamped.jointCount, 1);
  assert.equal(unstamped.end, "needsJoint");
});

test("each pair can take a shorter direct route or a genuine two-way crossing to collect its postmark", () => {
  const stamps = [[4, 5], [5, 8], [6, 8]];
  letters.filter(letter => letter.chapter === "together").forEach((letter, station) => {
    for (const key of ["clue", "postscript"]) assert.ok(letter[key] && letter.en[key] && letter.en[key] !== letter[key]);
    for (const [i, mode] of ["standard", "expert"].entries()) {
      const direct = prepareRoute(letter, mode);
      const joint = prepareRoute(letter, mode, "joint");
      const relaxed = prepareRoute(letter, "relaxed", "joint");
      assert.equal(closestRoute(relaxed, relaxed.initial).distance, 2);
      assert.equal(closestRoute(joint, joint.initial).distance, stamps[station][i]);
      assert.ok(closestRoute(direct, direct.initial).distance < stamps[station][i]);
      if (mode === "expert") assert.equal(joint.budget, stamps[station][i]);
      assert.equal(joint.tiles.match(/[eswn]/g).length, 1);
      assert.equal(joint.tiles.match(/S/g).length, 1);
      assert.equal(joint.tiles.match(/&/g).length, 1);
      let plain = 0, stamped = 0;
      for (let mask = 0; mask < 2 ** joint.mirrors.length; mask++) {
        const path = trace(direct, mask);
        const alternate = trace(joint, mask);
        const matches = path.rays.every(ray => ray.end === "ready");
        assert.equal(path.end === "ready", matches);
        assert.equal(alternate.end === "ready", matches && alternate.jointCount === 2);
        if (!matches) continue;
        if (letter.id === "bridge") assert.ok(path.rays.some(ray => ray.lines.length > 1));
        if (alternate.end !== "ready") { plain++; continue; }
        stamped++;
        const [x, y] = [joint.jointCell % joint.width + .5, Math.floor(joint.jointCell / joint.width) + .5];
        const headings = path.rays.map(ray => {
          const segment = ray.lines.find(line => line.some(p => p[0] === x && p[1] === y));
          const entry = segment.findIndex(p => p[0] === x && p[1] === y);
          return segment[entry - 1][0] === x ? "vertical" : "horizontal";
        });
        assert.notEqual(headings[0], headings[1]);
        if (letter.id === "bell") assert.ok(path.rays[0].turns.some(mirror => path.rays[1].turns.includes(mirror)));
      }
      assert.ok(plain > 0 && stamped > 0);
    }
  });
});
