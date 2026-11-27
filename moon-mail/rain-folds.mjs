import { prepareBoard } from "./puzzle.mjs";

const editions = new WeakMap();
export const foldKey = (mode, field) => "rain.folds." + mode + "." + field;
const bit = cell => 1 << cell;
export const shadeAt = (sheet, cell) => sheet.ink & bit(cell) ? 2 : sheet.wet & bit(cell) ? 1 : 0;
export const printId = sheet => sheet.wet.toString(36) + "." + sheet.ink.toString(36);
export const creaseSet = code => [...code].sort().join("");

export function rainDesk(letter, mode) {
  const night = mode === "expert";
  let variants = editions.get(letter);
  if (!variants) editions.set(letter, variants = new Map());
  if (variants.has(night)) return variants.get(night);
  const board = prepareBoard(night ? letter.expert : letter.rows);
  const { width, height, tiles, source } = board;
  const creases = Array.from({length:width+height-2}, (_, i) => {
    const vertical = i < width-1, line = vertical ? i+1 : i-width+2;
    const label = vertical ? String.fromCharCode(64+line)+"│"+String.fromCharCode(65+line) : line+"─"+(line+1);
    const across = Array.from(tiles, (_, cell) => {
      const col = cell % width, row = Math.floor(cell/width);
      const x = vertical ? 2*line-1-col : col, y = vertical ? row : 2*line-1-row;
      return x>=0 && x<width && y>=0 && y<height ? y*width+x : -1;
    });
    const pairs = [];
    across.forEach((other, cell) => {
      if (other>cell && tiles[cell]!=="#" && tiles[other]!=="#") pairs.push([bit(cell),bit(other)]);
    });
    return {key:String.fromCharCode(65+i), vertical, line, label, across, pairs};
  });
  const desk = {board, creases, star:board.marks[0], box:tiles.indexOf("M"), watch:night ? 25 : 16,
    limit:night ? 6 : 7, repeat:!night, firstStudy:night ? "CAFHIG" : "BGHCIDH",
    initial:{wet:bit(source), ink:0, code:""},
    solutions:new Map(), prints:new Map()};
  function collect(sheet) {
    if (shadeAt(sheet,desk.box)===2) {
      desk.solutions.set(sheet.code,sheet);
      if (!desk.prints.has(printId(sheet))) desk.prints.set(printId(sheet),sheet);
      return;
    }
    if (sheet.code.length===desk.limit) return;
    for (const crease of creases) {
      const {next} = previewFold(desk,sheet,crease);
      if (next) collect(next);
    }
  }
  collect(desk.initial);
  variants.set(night,desk);
  return desk;
}

// Every pair meets once before the paper reopens. A stamp woken by this
// press only becomes a donor on the following press.
export function previewFold(desk, sheet, crease) {
  const code=sheet.code;
  if (shadeAt(sheet,desk.box)===2) return {reason:"done"};
  if (code.length>=desk.limit) return {reason:"limit"};
  const again=code.includes(crease.key);
  if (again && (!desk.repeat || new Set(code).size<code.length)) return {reason:"used"};
  let wet=sheet.wet, ink=sheet.ink;
  for (const [a,b] of crease.pairs) {
    if (sheet.wet & (a|b)) wet |= a|b;
    if (sheet.ink & (a|b)) ink |= a|b;
  }
  if (wet & bit(desk.star)) ink |= bit(desk.star);
  if (wet===sheet.wet && ink===sheet.ink) return {reason:"dry"};
  return {next:{wet,ink,code:code+crease.key},again};
}

export function foldHistory(desk, code) {
  if (typeof code!=="string" || code.length>desk.limit) return null;
  const frames=[desk.initial];
  for (const key of code) {
    const crease=desk.creases.find(c=>c.key===key);
    if (!crease) return null;
    const {next}=previewFold(desk,frames.at(-1),crease);
    if (!next) return null;
    frames.push(next);
  }
  return frames;
}

export function commonFolds(a,b) {
  let i=0;
  while (i<a.length && i<b.length && a[i]===b[i]) i++;
  return i;
}

export function differences(desk,a,b) {
  return Array.from(desk.board.tiles,(_,cell)=>cell).filter(c=>shadeAt(a,c)!==shadeAt(b,c));
}

// A retained mark keeps its donor until the first red overprint. Follow one
// contact backwards per press, including the fold that woke the star.
export function inkTrail(desk,frames,cell) {
  if (!shadeAt(frames.at(-1),cell)) return [];
  const trail=[];
  for (let step=frames.length-1;step>0;step--) {
    const tone=shadeAt(frames[step],cell);
    if (tone===shadeAt(frames[step-1],cell)) continue;
    const crease=desk.creases.find(c=>c.key===frames[step].code.at(-1));
    trail.push({step,cell,tone});
    cell=crease.across[cell];
  }
  trail.push({step:0,cell,tone:1});
  return trail.reverse();
}

export function foldPair(desk,a,b) {
  return !!a && !!b && creaseSet(a.code)===creaseSet(b.code) && shadeAt(a,desk.watch)!==shadeAt(b,desk.watch);
}

// Prefer an unfiled companion made with the identical creases. Among those,
// retain the longest common start, then choose the smallest visible change.
export function alternateFold(desk, sheet, filed=[], alreadyPaired=false) {
  const id=printId(sheet), candidates=[...desk.solutions.values()].filter(p=>printId(p)!==id);
  const unfiled=candidates.filter(p=>!filed.includes(printId(p)));
  const choices=alreadyPaired && unfiled.length ? unfiled : candidates;
  const score=p=>Number(foldPair(desk,sheet,p))*10000 + Number(!filed.includes(printId(p)))*1000
    + commonFolds(sheet.code,p.code)*50 - differences(desk,sheet,p).length;
  const best=choices.reduce((a,b)=>score(a)>=score(b) ? a : b);
  return {sheet:best,keep:commonFolds(sheet.code,best.code),pair:foldPair(desk,sheet,best)};
}

export function foldHint(desk, code, goal=0, planned="", filed=[]) {
  let options=[...desk.solutions.values()].filter(p=>!goal || shadeAt(p,desk.watch)===goal);
  if (desk.solutions.has(planned)) options=[desk.solutions.get(planned)];
  else {
    const fresh=options.filter(p=>!filed.includes(printId(p)));
    if (fresh.length) options=fresh;
  }
  if (!options.length) return null;
  // Break equal choices in favour of the first window study. An existing
  // draft with a longer viable prefix always takes precedence.
  let finish=options.find(p=>p.code===desk.firstStudy) ?? options[0];
  let keep=commonFolds(code,finish.code);
  for (const p of options) {
    const common=commonFolds(code,p.code);
    if (common>keep) {keep=common;finish=p;}
  }
  return {keep,key:finish.code[keep],finish};
}
