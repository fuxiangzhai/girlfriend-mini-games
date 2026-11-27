import {fits,poseKey} from './puzzle.mjs';
import {validLayout} from './projection.mjs';
import {allows} from './slip-path.mjs';
import {read,write} from './save.mjs';
import {anchor,cueMatch,midAt,signedSource,tailRack,tailRoutes,validSource} from './tail-score.mjs';
import {tailKeeper} from './tail-plays.mjs';

export const orders=['012','021','102','120','201','210'];
export const ways=['direct','fold'];
export const priorities=['quiet','thisLetter','otherLetter','first','last','pass'];
export const pairs=['ff','df','fd','dd'];
const deliveries=['ff','df','fd','dd'];
export const oppositeOrder=o=>o[0]+o[2]+o[1];
export const pairOrders=first=>orders.filter(o=>o[0]===String(first));
export const wayFor=(pair,order)=>pair[order[1]<order[2]?0:1]==='d'?'direct':'fold';
export function changeWay(pair,order,way){
  const marks=[...pair];marks[order[1]<order[2]?0:1]=way==='direct'?'d':'f';return marks.join('');
}
const catalogues=new WeakMap();
const rowKey=row=>row.keys.join('/');
const boardKey=(l,board)=>board.map((p,i)=>poseKey(l,i,p)).join('/');
const distance=(a,b)=>a.keys.reduce((n,k,i)=>n+Number(k!==b.keys[i]),0);
const stepKey=s=>[s.kind,s.end,s.keeper].join(':');
const bit=n=>n===0 || n===1;

function segment(kind,end,keeper,from,row){
  return {kind,end,keeper,row,key:rowKey(row),cost:distance(from,row)};
}
// Both sides of a handoff are valid ninth cues from this very same eighth.
// A lit exit alone does not guarantee a handoff: the original ray's panes
// must remain on their sockets throughout every movement.
function transitions(l,m,route,flap,fromEnd,from,toEnd,to){
  const backKeeper=tailKeeper(l,route,fromEnd,flap),outKeeper=tailKeeper(l,route,toEnd,flap);
  const choices=[];
  if(tailRack(l,from.slots,backKeeper).rows.includes(m.row)){
    choices.push([segment('back',fromEnd,backKeeper,from,m.row),segment('out',toEnd,outKeeper,m.row,to)]);
  }
  for(const keeper of [0,1]){
    if(from.ports[keeper]===to.ports[keeper] && tailRack(l,from.slots,keeper).rows.includes(to)){
      choices.push([segment('direct',toEnd,keeper,from,to)]);
    }
  }
  return choices;
}
function pathways(l,m,route,flap,order){
  let index=catalogues.get(m);
  if(!index){index=new Map();catalogues.set(m,index);}
  if(index.has(order))return index.get(order);
  const [a,b,c]=Array.from(order,Number),lead=tailKeeper(l,route,null,flap),result={direct:[],fold:[]};
  const mid={kind:'mid',end:null,keeper:lead,row:m.row,key:rowKey(m.row),cost:m.cost};
  for(const first of m.finals[a]){
    const opening=segment('first',a,tailKeeper(l,route,a,flap),m.row,first);
    for(const second of m.finals[b]){
      const next=transitions(l,m,route,flap,a,first,b,second);
      for(const third of m.finals[c]){
        const final=transitions(l,m,route,flap,b,second,c,third);
        for(const one of next)for(const two of final){
          const steps=[mid,opening,...one,...two],total=steps.reduce((sum,s)=>sum+s.cost,0);
          const way=steps.some(s=>s.kind==='direct')?'direct':'fold';
          result[way].push({steps,total});
        }
      }
    }
  }
  for(const list of Object.values(result))list.sort((a,b)=>a.total-b.total);
  index.set(order,result);return result;
}
function singlePaths(l,w){
  const mids=w.pin?[midAt(l,w.source,w.route,w.pin,w.flap)]:tailRoutes(l,w.source.tape[6],w.route,w.flap);
  return mids.flatMap(m=>m && m.finals.every(f=>f.length)?pathways(l,m,w.route,w.flap,w.order)[w.way]:[]);
}
const sharedKey=p=>p.steps[0].key+'|'+p.steps[1].key;
const sharedCost=p=>p.steps[0].cost+p.steps[1].cost;
export const budget=p=>p.joint??p.total;
const delivery=p=>p.steps.filter(s=>s.kind==='out' || s.kind==='direct').map(s=>s.kind==='direct'?'d':'f').join('');
function matches(l,steps,paths){
  const stamped=steps.map(s=>({...s,key:boardKey(l,s.slots)}));
  return paths.filter(p=>stamped.length<=p.steps.length && stamped.every((s,i)=>{
    const n=p.steps[i];return s.kind===n.kind && s.end===n.end && s.keeper===n.keeper && s.key===n.key;
  }));
}
function singleProof(l,w){
  if(!w || w.phase!=='done' || !baseHeader(l,w))return null;
  return matches(l,w.steps,singlePaths(l,w)).find(p=>p.steps.length===w.steps.length) || null;
}
function otherProof(l,w){
  const other=w.mate;
  if(!other || other.mate || other.pair || other.order!==oppositeOrder(w.order) || other.way!==wayFor(w.pair,other.order) ||
    other.flap!==w.flap || other.route!==w.route)return null;
  const proof=singleProof(l,other);
  return proof && anchor(l,w.source)===anchor(l,other.source)?proof:null;
}
function allPaths(l,w){
  let paths=singlePaths(l,w);
  if(w.delivery)paths=paths.filter(p=>delivery(p)===w.delivery);
  if(!w.pair)return paths;
  if(!pairs.includes(w.pair) || w.way!==wayFor(w.pair,w.order))return [];
  const order=oppositeOrder(w.order),other=w.mate?otherProof(l,w):null;
  if(w.mate && !other)return [];
  const best=new Map();
  const partners=other?[other]:singlePaths(l,{...w,order,way:wayFor(w.pair,order)});
  for(const p of partners){
    const key=sharedKey(p),old=best.get(key);
    if(!old || compare(p,old,'quiet')<0)best.set(key,p);
  }
  const linked=[];
  for(const p of paths){
    const partner=best.get(sharedKey(p));
    if(partner)linked.push({...p,partner,joint:p.total+partner.total-sharedCost(p)});
  }
  return linked;
}
export function fare(l,w){
  return allPaths(l,w).reduce((best,p)=>Math.min(best,budget(p)),Infinity);
}
function preferredCost(path,pace){
  if(pace==='thisLetter')return path.total;
  if(pace==='otherLetter')return path.partner?.total??0;
  if(pace==='first')return path.steps[1].cost;
  if(pace==='last')return path.steps.at(-1).cost;
  if(pace==='pass')return path.steps.find(s=>s.kind==='direct')?.cost??0;
  return 0;
}
function compare(a,b,pace){
  const rank=preferredCost(a,pace)-preferredCost(b,pace) || budget(a)-budget(b) || a.total-b.total;
  if(rank)return rank;
  // Both printed schedules must remain reproducible when several boards tie.
  return compareSteps(a,b) || (a.partner && b.partner?compareSteps(a.partner,b.partner):0);
}
function compareSteps(a,b){
  for(let i=0;i<Math.min(a.steps.length,b.steps.length);i++){
    const delta=a.steps[i].cost-b.steps[i].cost;if(delta)return delta;
  }
  return a.steps.length-b.steps.length;
}
export function forecasts(l,w){
  const paths=allPaths(l,w);if(!paths.length)return [];
  const result=[];
  for(const pace of priorities){
    if(pace==='pass' && w.way!=='direct')continue;
    if((pace==='thisLetter' || pace==='otherLetter') && (!w.pair || w.mate))continue;
    const path=paths.reduce((best,p)=>compare(p,best,pace)<0?p:best);
    const pattern=path.steps.map(s=>s.cost).join('/')+(path.partner?'|'+path.partner.steps.map(s=>s.cost).join('/'):'');
    if(!result.some(x=>x.pattern===pattern))result.push({pace,path,pattern});
  }
  return result;
}
export function roadsFor(l,w){
  return [0,1].flatMap(flap=>[0,1].map(route=>({flap,route,price:fare(l,{...w,pin:null,flap,route})})))
    .sort((a,b)=>a.price-b.price);
}
function compatible(l,w){
  return matches(l,w.steps,allPaths(l,w));
}
export const stopStep=s=>['first','direct','out'].includes(s.kind);
const stamp=s=>({kind:s.kind,end:s.end,keeper:s.keeper,slots:s.row.slots});
export function courierCue(l,w){
  const i=w.steps.length,paths=compatible(l,w).filter(p=>p.steps.length>i).sort((a,b)=>compare(a,b,w.pace));
  if(!paths.length)return null;
  const guide=paths[0],step=guide.steps[i],prices=new Map(),recommended=new Set();
  for(const p of paths){
    const next=p.steps[i];
    if(stepKey(next)!==stepKey(step))continue;
    prices.set(next.row,Math.min(prices.get(next.row)??Infinity,budget(p)));
    if(compare(p,guide,w.pace)===0)recommended.add(next.row);
  }
  const from=w.steps.at(-1)?.slots || w.source.tape[6];
  return {rack:tailRack(l,from,step.keeper),goal:step.row.ports,options:[...prices.keys()],prices,step,guide,recommended:[...recommended],best:Math.min(...prices.values())};
}
export function courierBook(source,flap=1,route=0,pin=null,order='021',way='direct'){
  return {source,flap,route,pin,order,way,pace:'quiet',phase:'book',steps:[],selected:-1,slots:null};
}
export function beginCourier(l,w){
  if(w.phase!=='book' || !validHeader(l,w) || w.steps.length)return null;
  const paths=allPaths(l,w);
  if(!paths.length)return null;
  const steps=w.pin?[stamp(paths[0].steps[0])]:[];
  return {...w,phase:'play',steps,slots:w.pin||w.source.tape[6],selected:-1};
}
export function takeCourier(l,w){
  if(w.phase!=='play')return null;
  const cue=courierCue(l,w);
  if(!cue)return null;
  const row=cueMatch(l,cue,w.slots);
  if(!row)return null;
  const step={...stamp(cue.step),slots:row.slots},steps=[...w.steps,step];
  const done=steps.filter(stopStep).length===3;
  return {...w,phase:done?'done':'play',steps,slots:row.slots,selected:-1};
}
export function completedPath(l,w){
  if(!w || w.phase!=='done' || !validHeader(l,w))return null;
  return compatible(l,w).find(p=>p.steps.length===w.steps.length) || null;
}
function baseHeader(l,w){
  if(!w || !orders.includes(w.order) || !ways.includes(w.way) || !priorities.includes(w.pace??'quiet') || !bit(w.flap) || !bit(w.route) || !validSource(l,w.source))return false;
  if(w.pin && !midAt(l,w.source,w.route,w.pin,w.flap)?.finals.every(f=>f.length))return false;
  return Array.isArray(w.steps) && w.steps.length<=6 && w.steps.every(s=>s && validLayout(l,s.slots));
}
function validHeader(l,w){
  if(!baseHeader(l,w) || w.delivery!=null && !deliveries.includes(w.delivery))return false;
  if(!w.pair)return !w.mate;
  if(!pairs.includes(w.pair) || w.way!==wayFor(w.pair,w.order))return false;
  return !w.mate || w.phase!=='book' && w.steps.length>=2 && Boolean(otherProof(l,w));
}
const draftKey=(l,own)=>'slip:courier-draft:'+l.id+':'+own;
export const saveCourier=(l,w)=>write(draftKey(l,Boolean(w.source.peer)),w);
export function readCourier(l,own){
  const w=read(draftKey(l,own));
  if(!validHeader(l,w) || Boolean(w.source.peer)!==own || own && !signedSource(l,w.source))return null;
  if(w.phase==='book')return w.steps.length===0?{...w,slots:null}:null;
  if(w.phase==='done')return completedPath(l,w)?{...w,slots:w.steps.at(-1).slots,selected:-1}:null;
  if(w.phase!=='play' || w.pin && !w.steps.length)return null;
  const cue=courierCue(l,w);if(!cue)return null;
  const board=w.slots;
  if(Array.isArray(board) && board.length===l.pieces.length && board.every((p,i)=>p===null || fits(l,board,i,p)) &&
    allows(cue.rack.hold,board.map((p,i)=>p?poseKey(l,i,p):null)))return w;
  return {...w,slots:cue.rack.from.slots,selected:-1};
}
// Only a landed station is a decision point. The exact panels already played
// stay in the prefix, including the outgoing keeper if a transfer has begun.
export function stationCourses(l,w){
  const last=w.steps.at(-1);
  if(w.phase!=='play' || !last || !stopStep(last))return [];
  const visited=w.steps.filter(stopStep).length;
  const itineraries=visited===1 && !w.mate?pairOrders(w.order[0]):[w.order];
  const choices=[];
  for(const order of itineraries)for(const way of ways){
    const input={...w,pin:w.steps[0].slots,order,way,delivery:null};
    const byLegs=new Map();
    for(const p of compatible(l,input)){
      const legs=delivery(p),previous=byLegs.get(legs);
      if(!previous || compare(p,previous,'quiet')<0)byLegs.set(legs,p);
    }
    for(const [legs,path] of byLegs)choices.push({order,way,legs,path});
  }
  return choices;
}
export const atLandedBoard=(l,w)=>Array.isArray(w.slots) && w.slots.length===l.pieces.length &&
  w.slots.every((p,i)=>p && poseKey(l,i,p)===poseKey(l,i,w.steps.at(-1).slots[i]));
export function redirectCourier(l,w,order,legs){
  const proposal=stationCourses(l,w).find(c=>c.order===order && c.legs===legs);
  if(!proposal || !atLandedBoard(l,w))return null;
  return {...w,order,way:proposal.way,delivery:legs,pace:'quiet',selected:-1};
}
function singleLetter(w){
  const {source,flap,route,order,way,steps}=w;
  return {...courierBook(source,flap,route,null,order,way),phase:'done',steps,slots:steps.at(-1).slots};
}
// An old single receipt can supply the first letter too. Restaging starts
// after the two shared moves; the other route still has to be played in full.
export function secondLetter(l,w,way){
  if(!ways.includes(way) || !completedPath(l,w) || w.source.peer && !signedSource(l,w.source))return null;
  const order=oppositeOrder(w.order),pair=changeWay(changeWay('ff',w.order,w.way),order,way);
  const steps=w.steps.slice(0,2),mid=steps[0].slots,slots=steps[1].slots;
  const next={...courierBook(w.source,w.flap,w.route,mid,order,way),pair,mate:singleLetter(w),phase:'play',steps,slots};
  return compatible(l,next).length?next:null;
}
export function pairedLetters(l,w){
  if(!w?.mate)return null;
  const path=completedPath(l,w);
  if(!path?.partner)return null;
  const arms=[{w:singleLetter(w),path},{w:w.mate,path:path.partner}].sort((a,b)=>a.w.order.localeCompare(b.w.order));
  return {arms,first:Number(w.order[0]),pair:w.pair,shared:sharedCost(path),total:path.joint};
}
const pairShelf=(l,first,pair,own)=>'slip:courier-pair:'+l.id+':'+first+':'+pair+':'+own+':';
const versionShelf=(l,w,total)=>pairShelf(l,w.order[0],w.pair,Boolean(w.source.peer))+total+':'+w.flap+w.route+':'+anchor(l,w.source)+':';
const shelfKey=(l,order,way,own)=>'slip:courier-letter:'+l.id+':'+order+':'+way+':'+own+':';
export function fileCourier(l,w){
  const path=completedPath(l,w);
  if(!path || w.source.peer && !signedSource(l,w.source))return false;
  const solo=singleLetter(w),own=Boolean(w.source.peer);
  const soloPace=['thisLetter','otherLetter'].includes(w.pace)?'quiet':w.pace;
  write(shelfKey(l,w.order,w.way,own)+path.total,{...solo,pace:soloPace});
  if(w.mate){
    const record={...solo,pair:w.pair,mate:singleLetter(w.mate)};
    const left=w.order[1]<w.order[2],a=left?path:path.partner,b=left?path.partner:path;
    // Separate keys retain equal-price allocations, even across two tabs.
    write(versionShelf(l,w,path.joint)+a.total+'/'+b.total,left?[w.steps,w.mate.steps]:[w.mate.steps,w.steps]);
    write(pairShelf(l,w.order[0],w.pair,own)+path.joint,record);
    if(pairVersions(l,record).length>1)write(pairShelf(l,w.order[0],w.pair,own)+'margin:'+path.joint,record);
  }
  return true;
}
export function savedPair(l,first,pair,own,margin=false){
  if(!pairs.includes(pair) || ![0,1,2].includes(first))return null;
  const key=pairShelf(l,first,pair,own);
  // Two 6-move readings share two moves. Each remaining move costs at most three.
  for(let n=0;n<=30;n++){
    const w=read(key+(margin?'margin:':'')+n);
    if(w?.order?.[0]===String(first) && w.pair===pair && Boolean(w.source?.peer)===own &&
      pairedLetters(l,w)?.total===n && (!own || signedSource(l,w.source)) && (!margin || pairVersions(l,w).length>1))return {w,total:n};
  }
  return null;
}
export function pairVersions(l,w,duet=pairedLetters(l,w)){
  if(!duet || w.source.peer && !signedSource(l,w.source))return [];
  const result=[],base=versionShelf(l,w,duet.total),orders=pairOrders(duet.first);
  // A letter has at most 6 moves, and the shared opening at most 2.
  for(let left=0;left<=18;left++)for(let shared=0;shared<=6;shared++){
    const right=duet.total+shared-left;if(right<0 || right>18)continue;
    const snippet=read(base+left+'/'+right);
    if(!Array.isArray(snippet) || snippet.length!==2 || !snippet.every(s=>Array.isArray(s) && s.length))continue;
    const arms=orders.map((o,i)=>({...courierBook(w.source,w.flap,w.route,null,o,wayFor(w.pair,o)),phase:'done',steps:snippet[i],slots:snippet[i].at(-1)?.slots}));
    const snapshot={...arms[1],pair:w.pair,mate:arms[0]},verified=pairedLetters(l,snapshot);
    if(verified?.total===duet.total && verified.shared===shared && verified.arms[0].path.total===left)result.push({left,right,shared,w:snapshot});
  }
  return result;
}
export function savedCourier(l,order,way,own){
  const key=shelfKey(l,order,way,own);
  for(let n=0;n<=18;n++){
    const w=read(key+n);
    if(w && w.order===order && w.way===way && Boolean(w.source?.peer)===own && completedPath(l,w)?.total===n && (!own || signedSource(l,w.source)))return {w,total:n};
  }
  return null;
}
