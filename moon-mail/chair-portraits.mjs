import { prepareBoard } from "./puzzle.mjs";

export const arrows = ["→","↓","←","↑"];
export const pushes = "RDLU";
export const shutter = "!";
export const chairKey = (mode, field) => "windowprint.chairs." + mode + "." + field;
const studios = new WeakMap();

export function chairStudio(letter, mode) {
  let modes = studios.get(letter);
  if (!modes) studios.set(letter, modes = new Map());
  if (modes.has(mode)) return modes.get(mode);
  const night = mode === "expert";
  const board = prepareBoard(night ? letter.expert : letter.rows);
  const { width, height, tiles } = board;
  const next = Array.from(tiles, (_, c) => [
    c%width < width-1 ? c+1 : -1, c+width < width*height ? c+width : -1,
    c%width > 0 ? c-1 : -1, c >= width ? c-width : -1,
  ]);
  const room = {
    board, next, camera:tiles.indexOf("M"), initial:night ? [16,1] : [20,7],
    limit:night ? 6 : mode === "relaxed" ? 12 : 8,
    walkable:Array.from(tiles, t => t !== "#" && t !== "A"),
    rollable:Array.from(tiles, t => !"#A@M<>^v".includes(t)),
    chalk:Array.from(tiles, (t,c) => "abcd".includes(t) ? c : -1).filter(c => c >= 0),
    walks:new Map(),
  };
  room.catalog = endings(room, freshRoom(room));
  modes.set(mode, room);
  return room;
}

export function freshRoom(room) {
  return { seats:room.initial, walker:room.board.source, frames:[], count:0, code:"" };
}
export const movingChair = state => state.frames.length % 2;
const gap = (room, a, b) => Math.abs(a%room.board.width-b%room.board.width)
  + Math.abs(Math.floor(a/room.board.width)-Math.floor(b/room.board.width));

// The two curtained doors connect the photographer's passages. A chair can
// neither enter a doorway nor pass through its partner.
function flood(room, state) {
  const key = [state.walker,...state.seats].join("/");
  if (room.walks.has(key)) return room.walks.get(key);
  const parent = new Map([[state.walker,null]]);
  for (const cell of parent.keys()) {
    const choices = room.next[cell];
    const neighbors = room.board.gates.includes(cell) ? [...choices,room.board.gates.find(g => g !== cell)] : choices;
    for (const to of neighbors) {
      if (!room.walkable[to] || state.seats.includes(to) || parent.has(to)) continue;
      parent.set(to,cell);
    }
  }
  const reach = {parent, region:Math.min(...parent.keys())};
  room.walks.set(key,reach);
  return reach;
}

function pathTo(reach, end) {
  if (!reach.parent.has(end)) return null;
  const path = [];
  for (let c=end; c!==null; c=reach.parent.get(c)) path.push(c);
  return path.reverse();
}

export function pushOption(room, state, dir) {
  const which = movingChair(state), from = state.seats[which];
  const to = room.next[from][dir], behind = room.next[from][(dir+2)%4];
  const walk = pathTo(flood(room,state),behind);
  let reason = null;
  if (state.frames.length===3) reason="done";
  else if (!room.rollable[to]) reason="floor";
  else if (state.seats[1-which]===to) reason="other";
  else if (!walk) reason="stand";
  else if (state.count>=room.limit) reason="limit";
  return {which,from,to,behind,walk,reason};
}

export function frameOption(room, state) {
  const stage = state.frames.length, [a,b] = state.seats, distance = gap(room,a,b);
  const walk = pathTo(flood(room,state),room.camera);
  let reason = null;
  if (stage===3) reason="done";
  else if (stage===0 && (!room.chalk.includes(a) || distance<3)) reason="wide";
  else if (stage===1) {
    const aligned = a%room.board.width===b%room.board.width || Math.floor(a/room.board.width)===Math.floor(b/room.board.width);
    if (!aligned || distance!==2 || !room.rollable[(a+b)/2]) reason="middle";
  } else if (stage===2 && distance!==1) reason="close";
  if (!reason && !walk) reason="camera";
  return {walk,reason};
}

export function stageAction(room, state, token) {
  if (token===shutter) {
    const {walk,reason} = frameOption(room,state);
    if (reason) return null;
    const code = state.code+shutter;
    const frame = {seats:state.seats, end:code.length, count:state.count, walk};
    return {...state,walker:room.camera,frames:[...state.frames,frame],code};
  }
  if (typeof token!=="string" || token.length!==1) return null;
  const dir = pushes.indexOf(token);
  if (dir<0) return null;
  const {which,from,to,reason} = pushOption(room,state,dir);
  if (reason) return null;
  const seats = state.seats.slice(); seats[which]=to;
  return {...state,seats,walker:from,count:state.count+1,code:state.code+token};
}

export function replayChairs(room, code) {
  if (typeof code!=="string" || code.length>room.limit+3) return null;
  let state = freshRoom(room);
  for (const token of code) {
    state = stageAction(room,state,token);
    if (!state) return null;
  }
  return state;
}

export function portraitStyle(state) {
  if (state.frames.length!==3) return null;
  const middle = state.frames[1].seats, [chair,still] = state.seats;
  const side = middle[0]-middle[1], final = chair-still;
  if (side===2*final) return "near";
  return side===-2*final ? "far" : "turn";
}

export function portraitId(state) {
  if (state.frames.length!==3) return null;
  return state.frames.map((frame,i)=>frame.seats[i%2]).join("-");
}

// Walking has no cost. Within a connected part of the room the same chairs
// give the same legal pushes. Keep the first (least pushed) route to each
// ordered strip of photographs, independently of how the operator walked.
export function endings(room, start) {
  const queue=[start], seen=new Set(), films=new Map();
  for (let i=0; i<queue.length; i++) {
    const state=queue[i], id=portraitId(state);
    if (id) { if (!films.has(id)) films.set(id,state); continue; }
    const key=[...state.seats,flood(room,state).region,...state.frames.map((f,j)=>f.seats[j%2])].join("/");
    if (seen.has(key)) continue;
    seen.add(key);
    for (const token of "!RDLU") {
      const next=stageAction(room,state,token);
      if (next) queue.push(next);
    }
  }
  return films;
}

export function chairAdvice(room, state, style, filed = []) {
  const desired = [...room.catalog.keys()].filter(id => !style || portraitStyle(room.catalog.get(id))===style);
  const newIds = desired.filter(id => !filed.includes(id));
  const wanted = new Set(newIds.length ? newIds : desired);
  for (let keep=state.code.length; keep>=0; keep--) {
    const from = keep===state.code.length ? state : replayChairs(room,state.code.slice(0,keep));
    for (const [id,finish] of endings(room,from)) {
      if (wanted.has(id)) return {keep,token:finish.code[keep] ?? null,id};
    }
  }
  return null;
}

// Preserve a shutter's exact prefix, including the pushes spent reaching it.
export function retakePoint(room, film, filed = []) {
  const self = portraitId(film);
  const unseen = [...room.catalog.keys()].filter(id => id!==self && !filed.includes(id));
  const goals = unseen.length ? unseen : [...room.catalog.keys()].filter(id => id!==self);
  for (const n of [2,1,0]) {
    const code = n===0 ? "" : film.code.slice(0,film.frames[n-1].end);
    const options=endings(room,replayChairs(room,code));
    const id=goals.find(key=>options.has(key));
    if (id) return {code,frame:n,id};
  }
  return null;
}
