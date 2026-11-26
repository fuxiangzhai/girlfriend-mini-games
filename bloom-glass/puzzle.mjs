// Board coordinates name the rivet of a pane. It stays under the pointer as the pane turns.
const catalogs = new WeakMap();
export const turn = o => (o & 4) | ((o + 1) & 3);
export const flip = o => ((o ^ 4) & 4) | ((-o) & 3);

export function transform([x, y], o) {
  if (o & 4) x = -x;
  switch (o & 3) {
    case 1: return [-y, x];
    case 2: return [-x, -y];
    case 3: return [y, -x];
    default: return [x, y];
  }
}

export function shapeAt(piece, o) {
  return piece.cells.map(point => transform(point, o));
}

export function etchAt(level,id,place) {
  const etch = level.pieces[id].etch;
  if (!place || !etch) return null;
  const [dx,dy] = transform(etch,place.o);
  const x=place.x+dx, y=place.y+dy;
  return x>=0 && x<level.width && y>=0 && y<level.height ? y*level.width+x : null;
}

export function sideBySide(width,a,b) {
  if (a == null || b == null) return false;
  return Math.abs(a%width-b%width) + Math.abs(Math.floor(a/width)-Math.floor(b/width)) === 1;
}

export function endingOf(level,slots) {
  if (!level.fork) return -1;
  const at = etchAt(level,level.fork.pane,slots[level.fork.pane]);
  return level.fork.routes.findIndex(route=>route.at===at);
}

export function describe(level, id, place) {
  if (!place || ![place.x, place.y, place.o].every(Number.isInteger) ||
      place.o < 0 || place.o >= (level.flip ? 8 : 4) || !level.pieces[id]) return null;
  let mask = 0n;
  for (const [dx, dy] of shapeAt(level.pieces[id], place.o)) {
    const x = place.x + dx, y = place.y + dy;
    if (x < 0 || x >= level.width || y < 0 || y >= level.height) return null;
    const at = y * level.width + x;
    if (level.cells[at] === '.' || (level.clues.has(at) && level.clues.get(at) !== id) ||
        (level.rubbings.has(at) && level.rubbings.get(at)!==id)) return null;
    mask |= 1n << BigInt(at);
  }
  if (level.seams.some(([a,b]) => (mask & (1n << BigInt(a))) && (mask & (1n << BigInt(b))))) return null;
  const etch = etchAt(level,id,place);
  if (level.pieces[id].rubbing != null && level.pieces[id].rubbing !== etch) return null;
  if (level.fork?.pane === id && !level.fork.routes.some(route=>route.at===etch)) return null;
  return { mask, etch, gold: place.y * level.width + place.x === level.gold };
}

export function fits(level, slots, id, place) {
  const candidate = describe(level, id, place);
  if (!candidate) return false;
  if (level.neighbors[id].some(n=>slots[n] && !sideBySide(level.width,candidate.etch,etchAt(level,n,slots[n])))) return false;
  return slots.every((other, i) => {
    if (!other || i === id) return true;
    const taken = describe(level, i, other);
    return taken && !(taken.mask & candidate.mask);
  });
}

export function isGilded(level, slots) {
  return level.gold !== null && slots.some(p => p && p.y * level.width + p.x === level.gold);
}

function catalog(level) {
  if (catalogs.has(level)) return catalogs.get(level);
  const byCell = level.cells.map(() => []);
  const byPiece = level.pieces.map((piece, id) => {
    const seen = new Set(), choices = [];
    for (let o = 0; o < (level.flip ? 8 : 4); o++) {
      for (let at = 0; at < level.cells.length; at++) {
        if (level.cells[at] === '.') continue;
        const place = { x: at % level.width, y: Math.floor(at / level.width), o };
        const candidate = describe(level, id, place);
        if (!candidate) continue;
        // Identical silhouettes can have their back flower in different cells.
        const key = String(candidate.mask) + ':' + candidate.etch + (candidate.gold ? '*' : '');
        if (seen.has(key)) continue;
        seen.add(key);
        const record = { ...candidate, place, id, bit: 1 << id };
        choices.push(record);
        for (const [dx, dy] of shapeAt(piece, o)) {
          byCell[(place.y + dy) * level.width + place.x + dx].push(record);
        }
      }
    }
    return choices;
  });
  const result = { byPiece, byCell };
  catalogs.set(level, result);
  return result;
}

// Exact cover over both the remaining panes and the uncovered cells.
export function solve(level, slots = level.pieces.map(() => null), requireGold = false, route = null) {
  const { byPiece, byCell } = catalog(level);
  const result = [...slots], all = (1 << level.pieces.length) - 1;
  const marks = level.pieces.map(()=>null);
  const wanted = level.fork?.routes[route]?.at;
  function matches(id,etch) {
    if (level.fork?.pane === id && wanted != null && wanted !== etch) return false;
    return level.neighbors[id].every(n=>marks[n]===null || sideBySide(level.width,etch,marks[n]));
  }
  let occupied = 0n, used = 0;
  for (let i = 0; i < result.length; i++) {
    if (!result[i]) continue;
    const c = describe(level, i, result[i]);
    if (!c || (occupied & c.mask) || !matches(i,c.etch)) return null;
    marks[i]=c.etch;
    occupied |= c.mask;
    used |= 1 << i;
  }
  function search(mask, pieces, gold) {
    if (pieces === all) return !requireGold || gold;
    let fewest;
    function consider(options) {
      const open = options.filter(c => !(c.bit & pieces) && !(c.mask & mask) && matches(c.id,c.etch));
      if (!fewest || open.length < fewest.length) fewest = open;
    }
    for (let i = 0; i < byPiece.length; i++) {
      if (!(pieces & (1 << i))) consider(byPiece[i]);
      if (fewest?.length === 0) return false;
    }
    for (let at = 0; at < byCell.length; at++) {
      if (level.cells[at] !== '.' && !(mask & (1n << BigInt(at)))) consider(byCell[at]);
      if (fewest.length === 0) return false;
    }
    for (const c of fewest) {
      result[c.id] = c.place;
      marks[c.id] = c.etch;
      if (search(mask | c.mask, pieces | c.bit, gold || c.gold)) return true;
      result[c.id] = null;
      marks[c.id] = null;
    }
    return false;
  }
  return search(occupied, used, isGilded(level, slots)) ? result : null;
}

export function suggest(level, slots, selected, route = null) {
  if (slots.every(Boolean)) return null;
  const answer = (level.gold !== null && solve(level, slots, true,route)) || solve(level, slots,false,route);
  if (answer) {
    const id = Number.isInteger(selected) && !slots[selected] ? selected : slots.findIndex(p => !p);
    return { type: 'place', id, place: answer[id] };
  }
  // A dead end can have several causes. Preserve the largest solvable subset.
  const placed = slots.flatMap((p, i) => p ? [i] : []);
  for (let count = 1; count <= placed.length; count++) {
    for (let bits = 1; bits < (1 << placed.length); bits++) {
      const remove = placed.filter((_, n) => bits & (1 << n));
      if (remove.length !== count) continue;
      const trial = slots.map((p, i) => remove.includes(i) ? null : p);
      if (solve(level, trial,false,route)) return { type: 'lift', id: remove[0] };
    }
  }
  return null;
}
