import { prepareBoard } from "./puzzle.mjs";

// Drum teeth are quarter turns relative to the boat's bow.
export const helms = ["ahead", "right", "back", "left"];
const vectors = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const courses = new WeakMap();
const catalogs = new WeakMap();

export function tideCourse(letter, mode) {
  if (!courses.has(letter)) courses.set(letter, new Map());
  const modes = courses.get(letter);
  if (!modes.has(mode)) {
    const night = mode === "expert";
    modes.set(mode, {
      board: prepareBoard(night ? letter.expert : letter.rows),
      starter: night ? "0013000" : mode === "relaxed" ? "302330" : "310000",
      pinned: mode === "relaxed" ? [0, 4] : [],
      coasts: night ? ["once", "twice", "thrice"] : ["return", "cove"],
      night,
    });
  }
  return modes.get(mode);
}

export function fitsDrum(course, tape) {
  return typeof tape === "string" && tape.length === course.starter.length && /^[0-3]+$/.test(tape)
    && course.pinned.every(slot => tape[slot] === course.starter[slot]);
}

export function sail(course, tape) {
  if (!fitsDrum(course, tape)) return null;
  const {board} = course;
  let cell = board.source, heading = ">v<^".indexOf(board.tiles[cell]);
  let next = 0, order = 1, stamped = false, gates = 0, stampTurn;
  const frames = [];
  function frame(event, enter = cell, slot = null, edge = null) {
    return { event, enter, cell, heading, next, order, stamped, gates, slot, edge };
  }
  frames.push(frame("launch"));
  const seen = new Set();
  let end;
  while (!end) {
    // A second crossing matters to the log, but only the first unlocks delivery.
    const state = [cell, heading, next, order, stamped, gates > 0].join(",");
    if (seen.has(state)) { end = "loop"; break; }
    seen.add(state);
    const [dx, dy] = vectors[heading];
    const x = cell % board.width + dx, y = Math.floor(cell / board.width) + dy;
    const enter = y * board.width + x;
    const sea = x < 0 || x >= board.width || y < 0 || y >= board.height;
    const tile = board.tiles[enter];
    if (sea || tile === "#" || enter === board.source) {
      end = sea ? "sea" : tile === "#" ? "reef" : "quay";
      frames.push(frame(end, sea ? null : enter, null, [x + .5 - dx / 2, y + .5 - dy / 2]));
      break;
    }
    cell = enter;
    if (tile === "M") {
      end = !stamped ? "missing" : !gates ? "ungated" : "ready";
      frames.push(frame("box"));
    } else if (tile === "@") {
      cell = board.gates[0] === enter ? board.gates[1] : board.gates[0];
      gates++;
      order = -order;
      frames.push(frame("arch", enter));
    } else if (tile === "A" || tile === "B") {
      heading = tile === "A" ? 3 - heading : heading ^ 1;
      frames.push(frame("vane"));
    } else {
      const slot = next;
      const turn = Number(tape[slot]);
      if (tile === "*" && !stamped) stampTurn = turn;
      stamped ||= tile === "*";
      heading = (heading + turn) % 4;
      next = (slot + order + tape.length) % tape.length;
      frames.push(frame(tile === "*" ? "stamp" : "helm", cell, slot));
    }
  }
  const id = end === "ready" ? frames.map(f => f.enter.toString(36)).join("") : null;
  const coast = end !== "ready" ? null : course.night ? course.coasts[gates - 1] : stampTurn === 2 ? "return" : "cove";
  return { tape, frames, end, id, coast, steps: frames.length - 1, gates };
}

export function wakeLines(board, frames, last = frames.length - 1) {
  const point = cell => [cell % board.width + .5, Math.floor(cell / board.width) + .5];
  const lines = [[point(frames[0].cell)]];
  for (let i = 1; i <= last; i++) {
    const f = frames[i];
    lines.at(-1).push(f.edge || point(f.enter));
    if (f.event === "arch") lines.push([point(f.cell)]);
  }
  return lines;
}

// Compare actual wakes. Two different teeth can be inaudible if neither is read.
export function firstParting(a, b) {
  const count = Math.min(a.frames.length, b.frames.length);
  for (let i = 0; i < count; i++) {
    if (a.frames[i].heading !== b.frames[i].heading) return { beat: i, cell: a.frames[i].cell };
  }
  return null;
}

export function tideCatalog(course) {
  if (catalogs.has(course)) return catalogs.get(course);
  const wakes = new Map();
  // Only enumerate on this desk. Regular mail never needs a tide search.
  function fill(prefix) {
    if (prefix.length !== course.starter.length) {
      const choices = course.pinned.includes(prefix.length) ? course.starter[prefix.length] : "0123";
      for (const digit of choices) fill(prefix + digit);
      return;
    }
    const trip = sail(course, prefix);
    if (!trip.id) return;
    if (!wakes.has(trip.id)) wakes.set(trip.id, { coast: trip.coast, steps: trip.steps, tapes: [] });
    wakes.get(trip.id).tapes.push(prefix);
  }
  fill("");
  catalogs.set(course, wakes);
  return wakes;
}

export function pilotHint(course, tape, coast, filed = new Set()) {
  const matches = [...tideCatalog(course)].filter(([, wake]) => !coast || wake.coast === coast);
  const unfiled = matches.filter(([id]) => !filed.has(id));
  let best;
  for (const [, wake] of unfiled.length ? unfiled : matches) {
    for (const candidate of wake.tapes) {
      const changes = [...candidate].filter((digit, i) => digit !== tape[i]).length;
      if (!best || changes < best.changes || (changes === best.changes && wake.steps < best.steps)) {
        best = { tape: candidate, changes, steps: wake.steps };
      }
    }
  }
  if (!best?.changes) return null;
  const trip = sail(course, best.tape);
  const slot = trip.frames.find(f => f.slot !== null && tape[f.slot] !== best.tape[f.slot]).slot;
  return { slot, turn: Number(best.tape[slot]) };
}
