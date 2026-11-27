import {foldPartner} from './duet-plays.mjs';
import {canFold,foldOptions,foldScore,recordedFold,recordFold} from './fold-score.mjs';
import {describe,fits,poseKey,solve} from './puzzle.mjs';
import {readProjector,validLayout} from './projection.mjs';
import {allows,differentPanes,makeHold,storePlaybill,takeScene} from './slip-path.mjs';
import {read,write} from './save.mjs';
import {endsIn,tailGroups,tailKeeper,tailPorts} from './tail-plays.mjs';

const cache=new WeakMap();
const keys=(l,board)=>board.map((p,i)=>p?poseKey(l,i,p):'');
const sameSequence=(a,b)=>a.every((p,i)=>p===b[i]);
const distance=(a,b)=>a.reduce((n,k,i)=>n+Number(k!==b[i]),0);
const bit=n=>n===0 || n===1;
const endId=n=>bit(n) || n===2;
const setting=(route,flap)=>flap?'side'+route:String(route);
export const aimMask=s=>s.both?(s.stops??3):1<<s.end;

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
export function tailRoutes(l,base,route,flap=0){
  const c=catalogue(l),rack=tailRack(l,base,tailKeeper(l,route,null,flap)),id=rack.from.index+':'+setting(route,flap);
  if(c.routes.has(id))return c.routes.get(id);
  const arrivals=tailPorts(l,route,null,flap),mids=[];
  for(const row of rack.rows.filter(r=>sameSequence(r.ports,arrivals))){
    const finals=[0,1,2].map(e=>{
      const keeper=tailKeeper(l,route,e,flap),goal=tailPorts(l,route,e,flap);
      return keeper==null?[]:tailRack(l,row.slots,keeper).rows.filter(r=>sameSequence(r.ports,goal));
    });
    if(!finals.some(a=>a.length))continue;
    const cost=distance(rack.from.keys,row.keys);
    const prices=finals.map(list=>Math.min(...list.map(last=>cost+distance(row.keys,last.keys))));
    mids.push({row,cost,finals,prices});
  }
  c.routes.set(id,mids);return mids;
}
export const tailPrices=mids=>[0,1,2].map(e=>Math.min(...mids.map(m=>m.prices[e])));
// A shared eighth cue is staged once. The ninth cue is set afresh from it
// for every requested destination, even if the same pane moves in both.
export const sharedPrice=(m,mask)=>endsIn(mask).reduce((sum,e)=>sum+m.prices[e]-m.cost,m.cost);
export const bestPrice=(mids,mask)=>Math.min(...mids.map(m=>sharedPrice(m,mask)));
export function roadPlans(l,source,mask){
  return [0,1].flatMap(flap=>[0,1].map(route=>{
    const mids=tailRoutes(l,source.tape[6],route,flap);
    return {flap,route,price:bestPrice(mids,mask)};
  })).sort((a,b)=>a.price-b.price);
}
export function midAt(l,source,route,board,flap=0){
  if(!validLayout(l,board))return null;
  const row=rowAt(l,board);
  return tailRoutes(l,source.tape[6],route,flap).find(m=>m.row===row);
}
export function prepOptions(l,source,route,flap=0,mask=0){
  const tape=source.tape.slice(0,6),frame=l.play.frames[6];
  return tailRack(l,tape[5],frame.keeper).rows.filter(r=>takeScene(l,tape,r.slots)===6 && Number.isFinite(bestPrice(tailRoutes(l,r.slots,route,flap),mask)));
}
export function tailCue(l,s){
  const {source,route,end,mid,prep,flap=0}=s,start=source.tape[6],mask=aimMask(s);
  if(prep)return {rack:tailRack(l,source.tape[5],l.play.frames[6].keeper),goal:l.projection.scenes[6].exits,options:prepOptions(l,source,route,flap,mask)};
  if(mid){
    const m=midAt(l,source,route,mid,flap);
    return {rack:tailRack(l,mid,tailKeeper(l,route,end,flap)),goal:tailPorts(l,route,end,flap),options:m.finals[end]};
  }
  const mids=tailRoutes(l,start,route,flap);
  return {rack:tailRack(l,start,tailKeeper(l,route,null,flap)),goal:tailPorts(l,route,null,flap),options:mids.filter(m=>Number.isFinite(sharedPrice(m,mask))).map(m=>m.row)};
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
  const start=s.source.tape[6];
  function price(row){
    if(s.prep)return distance(cue.rack.from.keys,row.keys);
    if(s.mid)return distance(rowAt(l,s.mid).keys,row.keys);
    const m=tailRoutes(l,start,s.route,s.flap).find(x=>x.row===row);return sharedPrice(m,aimMask(s));
  }
  return socketHint(l,s.slots,cue,price);
}
export function socketHint(l,slots,cue,price){
  const current=keys(l,slots),options=[...cue.options];
  if(!options.length)return null;
  const best=options.sort((a,b)=>price(a)-price(b) || distance(current,a.keys)-distance(current,b.keys))[0];
  if(sameSequence(best.keys,current))return {ready:true};
  const diff=l.pieces.map((_,i)=>i).filter(i=>current[i]!==best.keys[i]);
  diff.sort((a,b)=>Number(current[a]===cue.rack.from.keys[a])-Number(current[b]===cue.rack.from.keys[b]));
  for(const id of diff)if(insertPane(l,cue.rack,slots,id,best.slots[id]))return {id,place:best.slots[id]};
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
const billPrefix=(l,route,end,signed,flap)=>'slip:tail-bill:'+l.id+':'+setting(route,flap)+end+':'+(signed?'signed:':'trial:');
function twinKey(l,r){
  return 'slip:tail-branch:'+l.id+':'+anchor(l,r.source)+':'+setting(r.route,r.flap)+':'+keys(l,r.mid).join(',')+':';
}
export function validTail(l,r){
  if(!r || !bit(r.route) || !bit(r.flap??0) || !endId(r.end) || !validSource(l,r.source) || !validLayout(l,r.last))return false;
  return Boolean(midAt(l,r.source,r.route,r.mid,r.flap)?.finals[r.end].includes(rowAt(l,r.last)));
}
export function tailCost(l,r){
  return differentPanes(l,r.source.tape[6],r.mid).length+differentPanes(l,r.mid,r.last).length;
}
export function recordTail(l,r){
  if(!validTail(l,r) || r.source.peer && !signedSource(l,r.source))return false;
  const record={source:r.source,flap:r.flap??0,route:r.route,end:r.end,mid:r.mid,last:r.last};
  const signed=Boolean(r.source.peer),closeCost=differentPanes(l,r.mid,r.last).length;
  write(billPrefix(l,r.route,r.end,signed,r.flap)+tailCost(l,r),record);
  // File independent legs by price so two tabs (or a costlier encore) cannot
  // replace the partner of an existing, quieter double or triple signature.
  write(twinKey(l,r)+r.end+':'+closeCost,r.last);
  const legs=recordedEnds(l,r);
  for(const mask of tailGroups){
    const ends=endsIn(mask);
    if(!(mask & (1<<r.end)) || !ends.every(e=>legs[e]))continue;
    const receipt={...record,end:ends[0],last:legs[ends[0]],stops:mask,both:true};
    write(groupPrefix(l,r.route,r.flap,mask,signed)+actualPrice(l,r,legs,mask),receipt);
  }
  return true;
}
function readLeg(l,r,e,mid,base){
  const valid=board=>validLayout(l,board) && mid.finals[e].includes(rowAt(l,board));
  const old=read(base+e);
  const limit=valid(old)?differentPanes(l,r.mid,old).length:4;
  for(let cost=0;cost<limit;cost++){
    const leg=read(base+e+':'+cost);
    if(valid(leg) && differentPanes(l,r.mid,leg).length===cost)return leg;
    // A legacy encore replaced the branch pointer, but its quieter original
    // can still be on the individual shelf. It must belong to this exact cast.
    if(limit<4){
      const bill=read(billPrefix(l,r.route,e,Boolean(r.source.peer),0)+(mid.cost+cost));
      if(!bill || bill.flap!==undefined || bill.route!==r.route || bill.end!==e || !validLayout(l,bill.mid) || rowAt(l,bill.mid)!==mid.row)continue;
      if(valid(bill.last) && differentPanes(l,r.mid,bill.last).length===cost && validSource(l,bill.source) && anchor(l,bill.source)===anchor(l,r.source))return bill.last;
    }
  }
  return limit<4?old:null;
}
export function recordedEnds(l,r){
  const mid=midAt(l,r.source,r.route,r.mid,r.flap);
  if(!mid)return [null,null,null];
  const base=twinKey(l,r);
  return [0,1,2].map(e=>readLeg(l,r,e,mid,base));
}
export function actualPrice(l,r,legs,mask){
  return endsIn(mask).reduce((n,e)=>n+differentPanes(l,r.mid,legs[e]).length,differentPanes(l,r.source.tape[6],r.mid).length);
}
export function twinTail(l,r,end=r.end===0?1:0){return recordedEnds(l,r)[end];}
export function bestTail(l,route,end,signed,flap=0){
  for(let i=0;i<=6;i++){
    const r=read(billPrefix(l,route,end,signed,flap)+i);
    if(r && r.route===route && r.end===end && (r.flap??0)===flap && Boolean(r.source?.peer)===signed && validTail(l,r) && tailCost(l,r)===i)return r;
  }
  return null;
}
const groupPrefix=(l,route,flap,mask,signed)=>'slip:tail-ensemble:'+l.id+':'+setting(route,flap)+':'+mask+':'+signed+':';
export function savedGroup(l,route,flap,mask,signed){
  if(!tailGroups.includes(mask))return null;
  const group=groupPrefix(l,route,flap,mask,signed),ends=endsIn(mask);
  function restore(r){
    if(!r || (r.flap??0)!==flap || r.route!==route || Boolean(r.source?.peer)!==signed || !validTail(l,r))return null;
    const legs=recordedEnds(l,r);
    if(!ends.every(e=>legs[e]))return null;
    return {...r,flap,end:ends[0],last:legs[ends[0]],stops:mask,both:true,total:actualPrice(l,r,legs,mask)};
  }
  let best=null;
  if(!flap && mask===3){
    // Edition eleven also kept individual cue-nine receipts at this anchor.
    // Recover a quieter legacy pair even when its last displayed card was dearer.
    best=restore(read('slip:tail-twin:'+l.id+':'+route+':'+signed));
    for(const e of ends)for(let i=0;i<=6;i++){
      const old=read(billPrefix(l,route,e,signed,0)+i);
      if(!old || old.flap!==undefined)continue;
      const candidate=restore(old);
      if(candidate && (!best || candidate.total<best.total))best=candidate;
    }
  }
  for(let n=0;n<=(best?.total??3*(ends.length+1));n++){
    const r=restore(read(group+n));
    if(r && (!best || r.total<best.total))best=r;
  }
  return best;
}
export const savedTwin=(l,route,signed)=>savedGroup(l,route,0,3,signed);
export function newTail(l,source,route=0){
  return {source,route,flap:0,end:0,stops:3,mid:null,last:null,prep:false,both:false,slots:source.tape[6],selected:-1};
}
const draftKey=(l,signed)=>'slip:tail-desk:'+l.id+':'+signed;
export function saveTailDesk(l,s){write(draftKey(l,Boolean(s.source.peer)),s);}
export function readTailDesk(l,signed){
  const raw=read(draftKey(l,signed));if(!raw)return null;
  const s={flap:0,stops:3,...raw};
  if(!bit(s.route) || !bit(s.flap) || !endId(s.end) || !tailGroups.includes(s.stops) || typeof s.prep!=='boolean' || typeof s.both!=='boolean' || !validSource(l,s.source) || Boolean(s.source.peer)!==signed || signed && !signedSource(l,s.source))return null;
  if(s.both && !(s.stops & (1<<s.end)))return null;
  if(s.last)return validTail(l,s)?{...s,prep:false,slots:s.last}:null;
  if(s.mid){
    const m=midAt(l,s.source,s.route,s.mid,s.flap);
    if(s.prep || !m || !Number.isFinite(sharedPrice(m,aimMask(s))))return null;
  }
  const cue=tailCue(l,s),slots=s.slots;
  if(!Array.isArray(slots) || slots.length!==l.pieces.length || !slots.every((p,i)=>p===null || fits(l,slots,i,p)) || !allows(cue.rack.hold,keys(l,slots)))return {...s,slots:cue.rack.from.slots,selected:-1};
  return s;
}
