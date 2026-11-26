import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { trace } from "../moon-mail/puzzle.mjs";
import { prepareFilm, filmPlan, filmHint, readFilm, restoreFilm, isDevelopedFilm, shutter } from "../moon-mail/darkroom.mjs";

const plates = letters.filter(letter => letter.plate);
const editions = plates.flatMap(letter => ["standard", "expert"].map(mode => prepareFilm(letter, mode)));

test("the plates have six distinct layouts and correctly meter every camera path", () => {
  assert.equal(plates.length, 3);
  assert.equal(new Set(editions.map(b => b.tiles.replace(/[AB]/g, "X"))).size, 6);
  for (const board of editions) {
    const { patterns, targets, sensors } = board.film;
    assert.deepEqual(sensors.map(cell => board.tiles[cell]), [..."abcd"].slice(0, targets.length));
    for (let mask = 0; mask < patterns.length; mask++) {
      const path = trace(board, mask);
      const points = path.lines.flat().map(([x, y]) => Math.floor(y) * board.width + Math.floor(x));
      const expected = sensors.reduce((bits, cell, i) => bits | (points.includes(cell) ? 1 << i : 0), 0);
      assert.equal(patterns[mask], path.end === "ready" ? expected : 0);
    }
  }
});

function possibleCounts(targets) {
  return targets.reduce((rows, max) => rows.flatMap(row =>
    Array.from({length: max + 1}, (_, n) => [...row, n])), [[]]);
}

test("the exposure planner agrees with independent one-mirror search for every dose, shot count and orientation", () => {
  for (const board of editions) {
    const { patterns, targets, frames } = board.film;
    let previous = new Map();
    for (let slots = 0; slots <= frames; slots++) {
      const current = new Map();
      for (const doses of possibleCounts(targets)) {
        const distance = Array(patterns.length).fill(Infinity);
        const queue = [];
        for (let mask = 0; mask < patterns.length; mask++) {
          if (slots === 0 && doses.every(n => n === 0)) distance[mask] = 0;
          if (slots > 0 && patterns[mask]) {
            const after = doses.map((n, i) => n - ((patterns[mask] >> i) & 1));
            distance[mask] = previous.get(after.join(","))?.[mask] ?? Infinity;
          }
          if (Number.isFinite(distance[mask])) queue.push(mask);
        }
        // Propagate costs over adjacent mirror settings, independent of the planner's shot-to-shot distances.
        for (let n = 0; n < queue.length; n++) {
          const mask = queue[n];
          for (let i = 0; i < board.mirrors.length; i++) {
            const neighbor = mask ^ (1 << i);
            if (distance[neighbor] <= distance[mask] + 1) continue;
            distance[neighbor] = distance[mask] + 1;
            queue.push(neighbor);
          }
        }
        current.set(doses.join(","), distance);
        for (let mask = 0; mask < patterns.length; mask++) {
          assert.equal(filmPlan(board, mask, doses, slots).distance, distance[mask]);
          const complete = slots === 0 && doses.every(n => n === 0);
          const hint = filmHint(board, mask, {remaining: doses, slots, complete});
          if (complete) assert.equal(hint, "develop");
          else if (distance[mask] === Infinity) assert.equal(hint, "rewind");
          else if (hint === shutter) {
            const after = doses.map((n, i) => n - ((patterns[mask] >> i) & 1));
            assert.equal(previous.get(after.join(","))[mask], distance[mask]);
          } else {
            assert.ok(Number.isInteger(hint) && hint >= 0 && hint < board.mirrors.length);
            assert.equal(distance[mask ^ (1 << hint)], distance[mask] - 1);
          }
        }
      }
      previous = current;
    }
  }
});

test("all three difficulties develop distinct exposures, resume mid-roll and count only turns against par", () => {
  for (const [i, letter] of plates.entries()) {
    for (const mode of ["relaxed", "standard", "expert"]) {
      const b = prepareFilm(letter, mode);
      const actions = [], frames = [];
      let mask = b.initial, turns = 0;
      if (mode === "expert") assert.equal(b.budget, [4, 6, 8][i]);
      const par = filmPlan(b, mask, b.film.targets, b.film.frames).distance;
      if (mode === "standard") assert.equal(par, [2, 4, 6][i]);
      if (mode === "relaxed") assert.equal(filmHint(b, mask, readFilm(b, frames, mask)), shutter);
      for (let n = 0; n <= par + b.film.frames; n++) {
        const reading = readFilm(b, frames, mask);
        if (reading.complete) break;
        const hint = filmHint(b, mask, reading);
        actions.push(hint);
        if (hint === shutter) {
          assert.ok(reading.canShoot);
          frames.push(mask);
        } else {
          assert.ok(Number.isInteger(hint));
          mask ^= 1 << hint;
          turns++;
        }
        assert.deepEqual(restoreFilm(b, actions), {mask, frames});
      }
      assert.ok(isDevelopedFilm(b, frames));
      assert.equal(turns, par);
      assert.equal(new Set(frames.map(m => b.film.patterns[m])).size, b.film.frames);
      assert.equal(restoreFilm(b, [...actions, 0]), null);
      assert.equal(restoreFilm(b, [...actions, shutter]), null);
    }
  }
});

test("metering protects white paper, recognizes a plausible dead end, and rejects broken saves", () => {
  const middle = prepareFilm(plates[1], "standard");
  assert.equal(readFilm(middle, [], middle.initial).over, 3);
  assert.equal(restoreFilm(middle, [shutter]), null);
  const last = prepareFilm(plates[2], "standard");
  const tempting = last.film.patterns.indexOf(15);
  assert.ok(readFilm(last, [], tempting).canShoot);
  assert.equal(filmHint(last, tempting, readFilm(last, [tempting], tempting)), "rewind");
  assert.ok(Number.isFinite(filmPlan(last, tempting, last.film.targets, last.film.frames).distance));
  assert.equal(isDevelopedFilm(last, [tempting, tempting, tempting]), false);
  assert.equal(isDevelopedFilm(last, [0, -1, "7"]), false);
  assert.equal(restoreFilm(last, [last.mirrors.length]), null);
  assert.equal(restoreFilm(last, null), null);
  const expert = prepareFilm(plates[0], "expert");
  assert.equal(restoreFilm(expert, Array(expert.budget + 1).fill(0)), null);
});

test("the final Expert negative uses the same three photographs in an eight-turn or ten-turn order", () => {
  const board = prepareFilm(plates[2], "expert");
  function costInOrder(labels) {
    let costs = new Map([[board.initial, 0]]);
    for (const names of labels) {
      const nextCosts = new Map();
      for (const mask of board.film.usable) {
        const sites = [..."ABCD"].filter((_, i) => board.film.patterns[mask] & (1 << i)).join("");
        if (sites !== names) continue;
        for (const [previous, cost] of costs) {
          const flips = board.mirrors.filter((_, i) => (previous ^ mask) & (1 << i)).length;
          nextCosts.set(mask, Math.min(nextCosts.get(mask) ?? Infinity, cost + flips));
        }
      }
      costs = nextCosts;
    }
    return Math.min(...costs.values());
  }
  assert.equal(costInOrder(["BCD", "D", "ABC"]), 8);
  assert.equal(costInOrder(["D", "BCD", "ABC"]), 10);
});
