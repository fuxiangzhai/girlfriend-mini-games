import {fits,poseKey} from './puzzle.mjs';
import {validLayout} from './projection.mjs';
import {allows} from './slip-path.mjs';
import {read,write} from './save.mjs';
import {cueMatch,midAt,signedSource,tailRack,tailRoutes,validSource} from './tail-score.mjs';
import {tailKeeper} from './tail-plays.mjs';

export const orders=['012','021','102','120','201','210'];
export const ways=['direct','fold'];
export const priorities=['quiet','first','last','pass'];
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
function allPaths(l,w){
  const mids=w.pin?[midAt(l,w.source,w.route,w.pin,w.flap)]:tailRoutes(l,w.source.tape[6],w.route,w.flap);
  return mids.flatMap(m=>m && m.finals.every(f=>f.length)?pathways(l,m,w.route,w.flap,w.order)[w.way]:[]);
}
export function fare(l,w){
  return allPaths(l,w).reduce((best,p)=>Math.min(best,p.total),Infinity);
}
function preferredCost(path,pace){
  if(pace==='first')return path.steps[1].cost;
  if(pace==='last')return path.steps.at(-1).cost;
  if(pace==='pass')return path.steps.find(s=>s.kind==='direct')?.cost??0;
  return 0;
}
function compare(a,b,pace){
  const rank=preferredCost(a,pace)-preferredCost(b,pace) || a.total-b.total;
  if(rank)return rank;
  // Keep the advertised breakdown stable when several real boards tie.
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
    const path=paths.reduce((best,p)=>compare(p,best,pace)<0?p:best);
    const pattern=path.steps.map(s=>s.cost).join('/');
    if(!result.some(x=>x.pattern===pattern))result.push({pace,path,pattern});
  }
  return result;
}
export function roadsFor(l,w){
  return [0,1].flatMap(flap=>[0,1].map(route=>({flap,route,price:fare(l,{...w,pin:null,flap,route})})))
    .sort((a,b)=>a.price-b.price);
}
function compatible(l,w){
  const stamped=w.steps.map(s=>({...s,key:boardKey(l,s.slots)}));
  return allPaths(l,w).filter(p=>stamped.length<=p.steps.length && stamped.every((s,i)=>{
    const n=p.steps[i];return s.kind===n.kind && s.end===n.end && s.keeper===n.keeper && s.key===n.key;
  }));
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
    prices.set(next.row,Math.min(prices.get(next.row)??Infinity,p.total));
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
function validHeader(l,w){
  if(!w || !orders.includes(w.order) || !ways.includes(w.way) || !priorities.includes(w.pace??'quiet') || !bit(w.flap) || !bit(w.route) || !validSource(l,w.source))return false;
  if(w.pin && !midAt(l,w.source,w.route,w.pin,w.flap)?.finals.every(f=>f.length))return false;
  return Array.isArray(w.steps) && w.steps.length<=6 && w.steps.every(s=>s && validLayout(l,s.slots));
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
const shelfKey=(l,order,way,own)=>'slip:courier-letter:'+l.id+':'+order+':'+way+':'+own+':';
export function fileCourier(l,w){
  const path=completedPath(l,w);
  if(!path || w.source.peer && !signedSource(l,w.source))return false;
  const {source,route,flap,order,way,steps}=w;
  write(shelfKey(l,order,way,Boolean(source.peer))+path.total,{...courierBook(source,flap,route,null,order,way),pace:w.pace,phase:'done',steps,slots:steps.at(-1).slots});
  return true;
}
export function savedCourier(l,order,way,own){
  const key=shelfKey(l,order,way,own);
  for(let n=0;n<=18;n++){
    const w=read(key+n);
    if(w && w.order===order && w.way===way && Boolean(w.source?.peer)===own && completedPath(l,w)?.total===n && (!own || signedSource(l,w.source)))return {w,total:n};
  }
  return null;
}
