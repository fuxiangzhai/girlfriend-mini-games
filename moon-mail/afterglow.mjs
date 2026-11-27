import { prepareBoard } from "./puzzle.mjs";

const offsets = [[1,0], [0,1], [-1,0], [0,-1]];
const arrows = ">v<^";
export const moor = 4;
export const passages = ["clear", "running", "harbor"];
const courses = new WeakMap();

function sweep(board, neighbors, cell, heading) {
  const line = [cell], seen = new Set();
  let dir = heading;
  while (neighbors[cell][dir] >= 0) {
    cell = neighbors[cell][dir];
    const key = cell * 4 + dir;
    if (seen.has(key)) break;
    seen.add(key); line.push(cell);
    if (board.tiles[cell] === "A") dir = 3 - dir;
    if (board.tiles[cell] === "B") dir ^= 1;
  }
  return line;
}

export function lightStation(letter, mode) {
  const night = mode === "expert", rows = night ? letter.expert : letter.rows;
  if (courses.has(rows)) return courses.get(rows);
  const board = prepareBoard(rows), {width, height, tiles, source} = board;
  const neighbors = Array.from(tiles, (_,cell) => offsets.map(([dx,dy]) => {
    const x = cell % width + dx, y = Math.floor(cell/width) + dy, next = y*width+x;
    return x >= 0 && x < width && y >= 0 && y < height && tiles[next] !== "#" ? next : -1;
  }));
  // Buoys on original open water. The night buoy on the east bank sweeps counterclockwise.
  const buoys = night ? [[15,1,1],[17,2,-1]] : [[2,3,1],[8,1,1]];
  const lamps = [[source,arrows.indexOf(tiles[source]),1], ...buoys].map(([cell,heading,turn]) => ({cell,heading,turn}));
  const phases = Array.from({length:4}, (_,i) => {
    const lit = new Set();
    const beams = lamps.map(lamp => {
      const dir = (lamp.heading+i*lamp.turn+4)%4;
      const line = sweep(board,neighbors,lamp.cell,dir);
      for (const cell of line) lit.add(cell);
      return {dir,line};
    });
    return {lit, beams};
  });
  const station = {board, neighbors, lamps, phases, berths:new Set(lamps.map(l => l.cell)),
    box:tiles.indexOf("M"), limit:night ? 8 : 7};
  courses.set(rows,station);
  return station;
}

export function flashAt(station, beat) {
  return station.phases[(beat-1)%4];
}
export function lightAt(station, cell, beat) {
  if (flashAt(station,beat).lit.has(cell)) return "lit";
  return beat > 1 && flashAt(station,beat-1).lit.has(cell) ? "fading" : "dark";
}
export function launch(station) {
  const cell = station.board.source;
  return {code:"", cell, trail:[cell], waits:[], glow:null, style:null};
}

export function sounding(station, trip, cell) {
  const beat = trip.code.length+1;
  if (beat > station.limit) return "over";
  if (cell === trip.cell) return station.berths.has(cell) ? "moor" : "noMoor";
  if (!station.neighbors[trip.cell].includes(cell) || cell < 0) return "far";
  if (trip.trail.includes(cell)) return "wake";
  if (cell === station.box && beat !== station.limit) return "early";
  const light = lightAt(station,cell,beat);
  return light === "fading" && trip.glow ? "empty" : light;
}

export function sail(station, trip, action) {
  if (!Number.isInteger(action) || action < 0 || action > moor) return null;
  const cell = action === moor ? trip.cell : station.neighbors[trip.cell][action];
  const how = sounding(station,trip,cell);
  if (how !== "lit" && how !== "fading" && how !== "moor") return null;
  const code = trip.code + action;
  const waits = how === "moor" ? [...trip.waits,code.length] : trip.waits;
  const glow = how === "fading" ? {beat:code.length,cell} : trip.glow;
  const style = cell === station.box ? (glow ? (waits.length ? "harbor" : "running") : "clear") : null;
  return {code,cell,trail:[...trip.trail,cell],waits,glow,style};
}

export function voyage(station, code) {
  if (typeof code !== "string" || code.length > station.limit || /[^0-4]/.test(code)) return null;
  let trip = launch(station);
  for (const digit of code) {
    trip = sail(station, trip, Number(digit));
    if (!trip) return null;
  }
  return trip;
}

export function logbook(station) {
  if (!station.book) {
    const book = new Map();
    function explore(trip) {
      if (trip.style) { book.set(trip.code,trip); return; }
      const {width} = station.board;
      const distance = Math.abs(trip.cell%width-station.box%width) + Math.abs(Math.floor(trip.cell/width)-Math.floor(station.box/width));
      if (trip.code.length + distance > station.limit) return;
      for (let a=0;a<=moor;a++) {
        const next = sail(station,trip,a);
        if (next) explore(next);
      }
    }
    explore(launch(station)); station.book=book;
  }
  return station.book;
}

// Pick a still-unfiled crossing when possible. Keep the longest prefix that can
// reach it, including waits and the exact flash when the bottle was opened.
export function nextPassage(station, code, filed, style = null) {
  const eligible = [...logbook(station).values()].filter(trip => !style || trip.style === style);
  const unseen = eligible.filter(trip => !filed.has(trip.code));
  const alternatives = eligible.filter(trip => trip.code !== code);
  const choices = unseen.length ? unseen : alternatives.length ? alternatives : eligible;
  if (!style) choices.sort((a,b) => passages.indexOf(a.style)-passages.indexOf(b.style));
  let best = null;
  for (const trip of choices) {
    let keep = 0;
    while (keep < code.length && code[keep] === trip.code[keep]) keep++;
    if (!best || keep > best.keep) best = {keep, trip, fresh:unseen.length > 0};
  }
  return best;
}
