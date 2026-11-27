import {foldPartner} from './duet-plays.mjs';
import {canFold,foldOptions,foldScore,recordedFold,recordFold} from './fold-score.mjs';
import {describe,fits,poseKey,solve} from './puzzle.mjs';
import {readProjector,validLayout} from './projection.mjs';
import {allows,differentPanes,makeHold,storePlaybill,takeScene} from './slip-path.mjs';
import {read,write} from './save.mjs';
import {tailPorts} from './tail-plays.mjs';

const cache=new WeakMap();
const keys=(l,board)=>board.map((p,i)=>p?poseKey(l,i,p):'');
const sameSequence=(a,b)=>a.every((p,i)=>p===b[i]);
const distance=(a,b)=>a.reduce((n,k,i)=>n+Number(k!==b[i]),0);
const bit=n=>n===0 || n===1;

// The closing cue can deliberately return to the seventh cue's exits.
// Index the physical lamps directly, including boards outside the old script.
function catalogue(l){
  if(cache.has(l))return cache.get(l);
  const rows=[],byKey=new Map();
  solve(l,undefined,false,null,p=>{
    const slots=[...p],k=keys(l,slots),id=k.join('/');
    if(!byKey.has(id)){
      const row={slots,keys:k,index:rows.length,ports:readProjector(l,slots).rays.map(r=>r.exit)};
      rows.push(row);byKey.set(id,row);
    }
    return false;
  });
  const c={rows,byKey,moves:new Map(),routes:new Map()};cache.set(l,c);return c;
}
function rowAt(l,slots){return catalogue(l).byKey.get(keys(l,slots).join('/'));}
export function tailRack(l,base,keeper){
  const c=catalogue(l),from=rowAt(l,base),id=from.index+':'+keeper;
  if(c.moves.has(id))return c.moves.get(id);
  const hold=makeHold(l,base,{keeper,limit:3}),rows=c.rows.filter(r=>allows(hold,r.keys));
  const poses=l.pieces.map((_,i)=>[...new Map(rows.map(r=>[r.keys[i],r.slots[i]])).values()]);
  const rack={from,hold,rows,poses};c.moves.set(id,rack);return rack;
}
export function tailRoutes(l,base,route){
  const c=catalogue(l),rack=tailRack(l,base,route),id=rack.from.index+':'+route;
  if(c.routes.has(id))return c.routes.get(id);
  const arrivals=tailPorts(l,route),mids=[];
  for(const row of rack.rows.filter(r=>sameSequence(r.ports,arrivals))){
    const finals=[0,1].map(e=>tailRack(l,row.slots,e?1-route:route).rows.filter(r=>sameSequence(r.ports,tailPorts(l,route,e))));
    if(!finals.some(a=>a.length))continue;
    const cost=distance(rack.from.keys,row.keys);
    const prices=finals.map(list=>Math.min(...list.map(last=>cost+distance(row.keys,last.keys))));
    mids.push({row,cost,finals,prices});
  }
  c.routes.set(id,mids);return mids;
}
export const tailPrices=mids=>[0,1].map(e=>Math.min(...mids.map(m=>m.prices[e])));
export function midAt(l,source,route,board){
  if(!validLayout(l,board))return null;
  const row=rowAt(l,board);
  return tailRoutes(l,source.tape[6],route).find(m=>m.row===row);
}
export function prepOptions(l,source,route){
  const tape=source.tape.slice(0,6),frame=l.play.frames[6];
  return tailRack(l,tape[5],frame.keeper).rows.filter(r=>takeScene(l,tape,r.slots)===6 && tailRoutes(l,r.slots,route).length);
}
export function tailCue(l,s){
  const {source,route,end,mid,prep}=s,start=source.tape[6];
  if(prep)return {rack:tailRack(l,source.tape[5],l.play.frames[6].keeper),goal:l.projection.scenes[6].exits,options:prepOptions(l,source,route)};
  if(mid){
    const m=midAt(l,source,route,mid);
    return {rack:tailRack(l,mid,end?1-route:route),goal:tailPorts(l,route,end),options:m.finals[end]};
  }
  const mids=tailRoutes(l,start,route);
  return {rack:tailRack(l,start,route),goal:tailPorts(l,route),options:mids.filter(m=>m.finals[end].length && (!s.both || m.finals.every(a=>a.length))).map(m=>m.row)};
}
export function cueMatch(l,cue,slots){
  if(!validLayout(l,slots))return null;
  const row=rowAt(l,slots);return cue.options.includes(row)?row:null;
}
// Moving a pane to a marked socket lifts loose pieces that cover its footprint.
// The keeper's illuminated panes and the three-pane budget apply throughout.
export function insertPane(l,rack,slots,id,place){
  if(!rack.poses[id] || rack.hold.held.includes(id))return null;
  const mask=describe(l,id,place);
  if(!mask || !rack.poses[id].some(p=>poseKey(l,id,p)===poseKey(l,id,place)))return null;
  const next=slots.map((p,i)=>i===id?place:p && (describe(l,i,p).mask & mask.mask)?null:p);
  return fits(l,next,id,place) && allows(rack.hold,keys(l,next))?next:null;
}
export function tailHint(l,s,cue){
  const current=keys(l,s.slots),options=[...cue.options],start=s.source.tape[6];
  if(!options.length)return null;
  function price(row){
    if(s.prep)return distance(cue.rack.from.keys,row.keys);
    if(s.mid)return distance(rowAt(l,s.mid).keys,row.keys);
    const m=tailRoutes(l,start,s.route).find(x=>x.row===row);return m.prices[s.end];
  }
  const best=options.sort((a,b)=>price(a)-price(b) || distance(current,a.keys)-distance(current,b.keys))[0];
  if(sameSequence(best.keys,current))return {ready:true};
  const diff=l.pieces.map((_,i)=>i).filter(i=>current[i]!==best.keys[i]);
  diff.sort((a,b)=>Number(current[a]===cue.rack.from.keys[a])-Number(current[b]===cue.rack.from.keys[b]));
  for(const id of diff)if(insertPane(l,cue.rack,s.slots,id,best.slots[id]))return {id,place:best.slots[id]};
  return {reset:true};
}
export function practiceSource(l){
  const c=catalogue(l);if(c.practice)return c.practice;
  const plan={leg:'first',low:true},tape=[];
  while(tape.length<7){
    const choices=foldOptions(l,tape,plan);
    if(tape.length===6)choices.sort((a,b)=>[0,1].filter(r=>tailRoutes(l,b.o.slots,r).length).length-[0,1].filter(r=>tailRoutes(l,a.o.slots,r).length).length);
    tape.push(choices[0].o.slots);
  }
  c.practice={tape,peer:null};return c.practice;
}
export function validSource(l,source){
  if(!l.play.coda?.insert || !canFold(l,source?.tape))return false;
  if(source.peer===null)return true;
  return canFold(foldPartner(l),source.peer) && source.tape.slice(0,foldScore(l).depth).every((b,i)=>!differentPanes(l,b,source.peer[i]).length);
}
function tapeId(l,tape){return tape.map(row=>keys(l,row).join(',')).join('|');}
export const anchor=(l,s)=>tapeId(l,s.tape)+'/'+(s.peer?tapeId(l,s.peer):'p');
const sourceKey=(l,s)=>'slip:tail-source:'+l.id+':'+anchor(l,s);
export function signedSource(l,s){
  if(!s.peer || !validSource(l,s))return false;
  const key=sourceKey(l,s);
  if(read(key)===true)return true;
  if(!recordedFold(l,s.tape,s.peer))return false;
  write(key,true);return true;
}
export function retakeReturn(l,source,board){
  if(!validSource(l,source))return null;
  const prefix=source.tape.slice(0,6);
  if(takeScene(l,prefix,board)!==6)return null;
  const next={tape:[...prefix,board],peer:source.peer};
  if(source.peer){
    if(!signedSource(l,source))return null;
    storePlaybill(l,next.tape);recordFold(l,next.tape);
    // The other performance was already authenticated on this exact sheet.
    // A newer solo record in another tab cannot invalidate its six kept cues.
    write(sourceKey(l,next),true);
  }
  return next;
}
const billPrefix=(l,route,end,signed)=>'slip:tail-bill:'+l.id+':'+route+end+':'+(signed?'signed:':'trial:');
function twinKey(l,r){
  return 'slip:tail-branch:'+l.id+':'+anchor(l,r.source)+':'+r.route+':'+keys(l,r.mid).join(',')+':';
}
export function validTail(l,r){
  if(!r || !bit(r.route) || !bit(r.end) || !validSource(l,r.source) || !validLayout(l,r.last))return false;
  return Boolean(midAt(l,r.source,r.route,r.mid)?.finals[r.end].includes(rowAt(l,r.last)));
}
export function tailCost(l,r){
  return differentPanes(l,r.source.tape[6],r.mid).length+differentPanes(l,r.mid,r.last).length;
}
export function recordTail(l,r){
  if(!validTail(l,r) || r.source.peer && !signedSource(l,r.source))return false;
  const record={source:r.source,route:r.route,end:r.end,mid:r.mid,last:r.last};
  write(billPrefix(l,r.route,r.end,Boolean(r.source.peer))+tailCost(l,r),record);
  write(twinKey(l,r)+r.end,r.last);
  if(twinTail(l,r))write('slip:tail-twin:'+l.id+':'+r.route+':'+Boolean(r.source.peer),record);
  return true;
}
export function twinTail(l,r){
  const end=1-r.end,last=read(twinKey(l,r)+end);
  return last && validTail(l,{...r,end,last})?last:null;
}
export function bestTail(l,route,end,signed){
  for(let i=0;i<=6;i++){
    const r=read(billPrefix(l,route,end,signed)+i);
    if(r && r.route===route && r.end===end && Boolean(r.source?.peer)===signed && validTail(l,r) && tailCost(l,r)===i)return r;
  }
  return null;
}
export function savedTwin(l,route,signed){
  const r=read('slip:tail-twin:'+l.id+':'+route+':'+signed);
  return r && r.route===route && Boolean(r.source?.peer)===signed && validTail(l,r) && twinTail(l,r)?r:null;
}
export function newTail(l,source,route=0){
  return {source,route,end:0,mid:null,last:null,prep:false,both:false,slots:source.tape[6],selected:-1};
}
const draftKey=(l,signed)=>'slip:tail-desk:'+l.id+':'+signed;
export function saveTailDesk(l,s){write(draftKey(l,Boolean(s.source.peer)),s);}
export function readTailDesk(l,signed){
  const s=read(draftKey(l,signed));
  if(!s || !bit(s.route) || !bit(s.end) || typeof s.prep!=='boolean' || typeof s.both!=='boolean' || !validSource(l,s.source) || Boolean(s.source.peer)!==signed || signed && !signedSource(l,s.source))return null;
  if(s.last)return validTail(l,s)?{...s,prep:false,slots:s.last}:null;
  if(s.mid && (s.prep || !midAt(l,s.source,s.route,s.mid)?.finals[s.end].length))return null;
  const cue=tailCue(l,s),slots=s.slots;
  if(!Array.isArray(slots) || slots.length!==l.pieces.length || !slots.every((p,i)=>p===null || fits(l,slots,i,p)) || !allows(cue.rack.hold,keys(l,slots)))return {...s,slots:cue.rack.from.slots,selected:-1};
  return s;
}
