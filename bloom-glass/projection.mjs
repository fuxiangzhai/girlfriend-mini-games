import {describe, fits, markCell, mirrorFalls, poseKey, shapeAt, solve} from './puzzle.mjs';
import {traceLight} from './light-path.mjs';
import {read,write} from './save.mjs';

// The clear carrier admits light only through a seated pane. An unfilled cell
// is still covered by the opaque slide holder, so rehearsal stops there.
export function readProjector(level,slots) {
  const {width,height,projection}=level, panes=new Map(), covered=new Set();
  const rows=Array.from({length:height},()=>Array(width).fill(' '));
  slots.forEach((p,id)=>{
    if (!p) return;
    const piece=level.pieces[id];
    for (const [dx,dy] of shapeAt(piece,p.o)) covered.add((p.y+dy)*width+p.x+dx);
    if (piece.mirror) panes.set(markCell(width,piece.mirror.offset,p),{control:{bit:0},reverse:mirrorFalls(piece.mirror.falls,p.o)});
    if (piece.star) {
      const at=markCell(width,piece.star,p);
      rows[Math.floor(at/width)][at%width]='*';
    }
  });
  const rays=projection.entries.map(entry=>{
    const path=traceLight({width,height,rows,panes},0,entry);
    const inner=path.points.slice(1,-1);
    const stop=inner.findIndex(([x,y])=>!covered.has(y*width+x));
    const points=stop<0?path.points:path.points.slice(0,stop+2);
    const lit=stop<0?inner:inner.slice(0,stop);
    return {points,exit:stop<0?path.exit:null,blocked:stop<0?null:inner[stop],
      turns:lit.filter(([x,y])=>panes.has(y*width+x)).length,
      star:lit.some(([x,y])=>rows[y][x]==='*')};
  });
  const full=slots.every(Boolean);
  let registered=true;
  if (projection.cross!=null) {
    const directions=rays.map(ray=>{
      const straight=new Set();
      for (let i=1;i<ray.points.length-1;i++) {
        const [x,y]=ray.points[i];
        if (y*width+x!==projection.cross) continue;
        const a=ray.points[i-1],b=ray.points[i+1];
        if (a[0]===b[0]) straight.add('v');
        if (a[1]===b[1]) straight.add('h');
      }
      return straight;
    });
    registered=['v','h'].some((d,i)=>directions[0].has(d) && directions[1].has(i?'v':'h'));
  }
  const scene=full && registered?projection.scenes.findIndex(s=>s.exits.every((port,i)=>rays[i].exit===port)):-1;
  return {rays,full,registered,scene,star:scene>=0 && Boolean(rays[projection.starLamp]?.star)};
}

const solutions=new WeakMap();
export function performances(level) {
  if (solutions.has(level)) return solutions.get(level);
  const list=[];
  solve(level,undefined,false,null,slots=>{
    const result=readProjector(level,slots);
    if (result.scene>=0) list.push({scene:result.scene,star:result.star,slots:[...slots],keys:slots.map((p,id)=>poseKey(level,id,p))});
    return false;
  });
  solutions.set(level,list);
  return list;
}

export function promptProjector(level,slots,selected,scene=0,star=false) {
  const keys=slots.map((p,id)=>p?poseKey(level,id,p):null);
  let closest, moves;
  for (const option of performances(level)) {
    if (option.scene!==scene || (star && !option.star)) continue;
    const lifts=keys.flatMap((k,id)=>k!==null && k!==option.keys[id]?[id]:[]);
    if (!closest || lifts.length<moves.length) {closest=option; moves=lifts;}
    if (!lifts.length) break;
  }
  if (!closest) return null;
  if (moves.length) return {type:'lift',id:moves[0],count:moves.length};
  const id=slots[selected]===null?selected:slots.findIndex(p=>!p);
  return id<0?{type:'ready'}:{type:'place',id,place:closest.slots[id]};
}

export function validLayout(level,slots) {
  return Array.isArray(slots) && slots.length===level.pieces.length &&
    slots.every((p,id)=>p && describe(level,id,p) && fits(level,slots,id,p));
}
const receiptKey=(level,scene,star)=>'lantern:ticket:'+level.id+':'+scene+':'+(star?'star':'plain');

export function punchTicket(level,slots) {
  if (!validLayout(level,slots)) return null;
  const result=readProjector(level,slots);
  if (result.scene<0) return null;
  const key=receiptKey(level,result.scene,result.star);
  write(key,slots.map(({x,y,o})=>({x,y,o})));
  return result;
}

export function ticketFor(level,scene) {
  for (const star of [true,false]) {
    const slots=read(receiptKey(level,scene,star));
    if (!validLayout(level,slots)) continue;
    const result=readProjector(level,slots);
    if (result.scene===scene && result.star===star) return {slots,result};
  }
  return null;
}
