import {foldPartner} from './duet-plays.mjs';
import {poseKey} from './puzzle.mjs';
import {allows,changeTotal,differentPanes,layoutHint,makeHold,quietScore,takeScene} from './slip-path.mjs';
import {read,write} from './save.mjs';

const key=keys=>keys.join('/');
const boardKey=(l,slots)=>key(slots.map((p,i)=>p?poseKey(l,i,p):''));
const cost=(a,b)=>a.reduce((sum,k,i)=>sum+Number(k!==b[i]),0);
const cache=new WeakMap();

// Match physical glass up to the last cue that both readings can still leave.
// A move before that fold is paid in both performances, once in each show.
export function foldScore(l){
  if(cache.has(l))return cache.get(l);
  const other=foldPartner(l),one=quietScore(l).rest,two=quietScore(other).rest,rows=[];
  for(let i=0;i<5;i++){
    const peer=new Map([...two[i]].map(([o,rest])=>[key(o.keys),rest])),next=[];
    for(const [o,solo] of one[i]){
      const peerRest=peer.get(key(o.keys));
      if(peerRest==null || i && !rows[i-1].some(r=>allows(r.hold,o.keys)))continue;
      next.push({o,solo,peerRest,rest:solo+peerRest,hold:makeHold(l,o.slots,l.play.frames[i+1])});
    }
    if(!next.length)break;
    rows.push(next);
  }
  for(let i=rows.length-2;i>=0;i--){
    for(const r of rows[i]){
      r.rest=Math.min(...rows[i+1].filter(n=>allows(r.hold,n.o.keys)).map(n=>2*cost(r.o.keys,n.o.keys)+n.rest));
    }
    rows[i]=rows[i].filter(r=>Number.isFinite(r.rest));
  }
  const byCue=rows.map(row=>new Map(row.map(r=>[key(r.o.keys),r])));
  const score={depth:rows.length,min:Math.min(...rows[0].map(r=>r.rest)),byCue};
  cache.set(l,score);return score;
}
function seam(l,tape){
  const {byCue,depth}=foldScore(l);if(tape.length<depth)return null;
  let row;
  for(let i=0;i<depth;i++){
    row=byCue[i].get(boardKey(l,tape[i]));if(!row)return null;
  }
  return row;
}
const cap=l=>l.play.frames.reduce((n,f)=>n+(f.limit||0),0);
function complete(l,tape){
  return Array.isArray(tape) && tape.length===l.play.frames.length && tape.every((b,i)=>takeScene(l,tape.slice(0,i),b)>=0);
}
export const canFold=(l,tape)=>complete(l,tape) && Boolean(seam(l,tape));
const prefixKey=(l,tape)=>tape.slice(0,foldScore(l).depth).map(row=>boardKey(l,row)).join('|');
const canonical=l=>l.play.coda.mode?foldPartner(l):l;
const pairKey=l=>'slip:fold-pair:'+canonical(l).id+':';
const sideKey=(l,prefix)=>'slip:fold-leg:'+l.id+':'+prefix+':';
function sameFold(l,a,b){return prefixKey(l,a)===prefixKey(l,b);}
export function foldTotal(l,pair){return changeTotal(l,pair[0])+changeTotal(l,pair[1]);}
function legacy(l,n){return read('slip:bill:'+l.id+':'+l.play.frames.at(-1).scenes[0]+':'+n);}
function findLeg(l,tape,exactCost){
  const prefix=prefixKey(l,tape),base=sideKey(l,prefix);
  for(let i=exactCost??0;i<=(exactCost??cap(l));i++){
    for(const run of [read(base+i),legacy(l,i)]){
      if(canFold(l,run) && changeTotal(l,run)===i && sameFold(l,tape,run))return run;
    }
  }
  return null;
}
export function foldWith(l,tape){
  if(!canFold(l,tape))return null;
  // Replays and predictions cannot issue a signature. Look up both real legs.
  const ours=findLeg(l,tape,changeTotal(l,tape)),peer=findLeg(foldPartner(l),tape);
  if(!ours || !peer)return null;
  return l.play.coda.mode?[peer,ours]:[ours,peer];
}
export function recordFold(l,tape){
  if(!canFold(l,tape))return;
  write(sideKey(l,prefixKey(l,tape))+changeTotal(l,tape),tape);
  const pair=foldWith(l,tape);
  if(pair)write(pairKey(l)+foldTotal(l,pair),pair);
}
export function foldBill(l){
  const front=canonical(l),back=foldPartner(front),min=foldScore(l).min;
  let archived=null;
  for(let n=min;n<=2*cap(l);n++){
    const p=read(pairKey(l)+n);
    if(Array.isArray(p) && p.length===2 && canFold(front,p[0]) && canFold(back,p[1]) && sameFold(l,...p) && foldTotal(l,p)===n){
      if(n===min)return p;
      archived=p;break;
    }
  }
  // Earlier editions filed actual seven-cue scores by cost. Recognize these
  // when the album is first opened, even if the best solo run is a different one.
  let best=archived;
  for(let n=0;n<=cap(l);n++){
    const a=legacy(front,n);if(!canFold(front,a) || changeTotal(front,a)!==n)continue;
    const b=findLeg(back,a);if(!b)continue;
    const pair=[a,b];if(!best || foldTotal(l,pair)<foldTotal(l,best))best=pair;
  }
  if(best && best!==archived)write(pairKey(l)+foldTotal(l,best),best);
  return best;
}
export const saveFoldDesk=(l,plan)=>write('slip:fold-desk:'+l.id,plan);
export function readFoldDesk(l,takes){
  if(!l.play.coda || takes.length===l.play.frames.length)return null;
  const p=read('slip:fold-desk:'+l.id);if(!p || typeof p.low!=='boolean')return null;
  if(p.leg==='first')return {leg:'first',low:p.low};
  if(p.leg!=='reply' || !canFold(foldPartner(l),p.tape))return null;
  const n=Math.min(takes.length,foldScore(l).depth);
  return takes.slice(0,n).every((b,i)=>!differentPanes(l,b,p.tape[i]).length)?p:null;
}
export function foldTarget(l,plan){
  if(plan.leg==='first')return foldScore(l).min;
  const peer=foldPartner(l),row=seam(peer,plan.tape),n=foldScore(l).depth;
  return changeTotal(l,plan.tape)+changeTotal(l,plan.tape.slice(0,n))+row.peerRest;
}
export function foldOptions(l,takes,plan,low=plan.low){
  const {depth,byCue}=foldScore(l),i=takes.length,out=[],ref=plan.tape;
  if(i>=l.play.frames.length)return out;
  for(let j=0;j<Math.min(i,depth);j++){
    if(!byCue[j].has(boardKey(l,takes[j])) || ref && differentPanes(l,takes[j],ref[j]).length)return out;
  }
  const hold=makeHold(l,takes.at(-1),l.play.frames[i]),paid=changeTotal(l,takes),goal=foldTarget(l,plan);
  function add(o,remaining,factor,base){
    if(!allows(hold,o.keys))return;
    const move=hold?cost(hold.keys,o.keys):0,total=base+factor*(paid+move)+remaining;
    if(!low || total<=goal)out.push({o,total});
  }
  if(i<depth){
    for(const r of byCue[i].values()){
      if(ref){if(!differentPanes(l,r.o.slots,ref[i]).length)add(r.o,0,0,goal);}
      else add(r.o,r.rest,2,0);
    }
  }else{
    const peer=ref?changeTotal(l,ref):changeTotal(l,takes.slice(0,depth))+seam(l,takes).peerRest;
    for(const [o,remaining] of quietScore(l).rest[i])add(o,remaining,1,peer);
  }
  return out;
}
export function foldKeep(l,tape,plan){
  for(let i=0;i<tape.length;i++){
    const options=foldOptions(l,tape.slice(0,i),plan);
    if(!options.some(v=>!differentPanes(l,v.o.slots,tape[i]).length))return i;
  }
  return tape.length;
}
export function foldHint(l,takes,slots,selected,plan){
  const options=foldOptions(l,takes,plan);
  if(!options.length)return {type:'rewind',index:foldKeep(l,takes,plan)};
  return layoutHint(l,slots,selected,makeHold(l,takes.at(-1),l.play.frames[takes.length]),options.map(v=>v.o));
}
