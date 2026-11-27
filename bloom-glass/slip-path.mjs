import {fits,poseKey,shapeAt} from './puzzle.mjs';
import {performances,readProjector,validLayout} from './projection.mjs';
import {fresh,read,validDraft,write} from './save.mjs';
import {acceptsMark,versionOf} from './duet-marks.mjs';
import {partnerOrder} from './duet-plays.mjs';

const signature=(level,slots)=>slots.map((p,id)=>p?poseKey(level,id,p):null);
const changes=(a,b)=>a.flatMap((key,id)=>key===b[id]?[]:[id]);
export const differentPanes=(l,a,b)=>changes(signature(l,a),signature(l,b));

// Pulling any pane traversed by the live beam would darken the carrier at
// that cell. Its entire physical footprint stays on the bench until the cue.
export function makeHold(level,base,frame) {
  if (!base || frame?.keeper==null) return null;
  const ray=readProjector(level,base).rays[frame.keeper];
  const path=new Set(ray.points.slice(1,-1).map(([x,y])=>y*level.width+x));
  const held=base.flatMap((place,id)=>shapeAt(level.pieces[id],place.o).some(([x,y])=>
    path.has((place.y+y)*level.width+place.x+x))?[id]:[]);
  return {base,keys:signature(level,base),held,path,keeper:frame.keeper,limit:frame.limit};
}
function allows(hold,keys) {
  if(!hold)return true;
  const diff=changes(hold.keys,keys);
  return diff.length<=hold.limit && diff.every(id=>!hold.held.includes(id));
}
export function handStatus(level,hold,slots) {
  if(!hold)return {changed:[],locked:false,over:false};
  const changed=changes(hold.keys,signature(level,slots));
  return {changed,locked:changed.some(id=>hold.held.includes(id)),over:changed.length>hold.limit};
}

const graphs=new WeakMap();
function marked(keys) {return keys.join('/');}
const common=new WeakMap();
function middleOptions(level) {
  if(common.has(level))return common.get(level);
  const frames=level.play.frames,last=frames.at(-1),pen=frames.length-2;
  const choices=last.scenes.map(id=>new Set(playGraph(level,id)[pen].map(o=>marked(o.keys))));
  const both=new Set([...choices[0]].filter(v=>choices.every(set=>set.has(v))));
  common.set(level,both);return both;
}
export function canTakeRequests(level,takes) {
  const frames=level.play.frames,mid=frames.length-2,slots=takes[mid];
  return frames.at(-1).scenes.length===2 && Boolean(slots) && middleOptions(level).has(marked(signature(level,slots)));
}
export function playGraph(level,ending,encore=false) {
  const relay=Boolean(level.play.delivery);
  encore=encore && (relay || level.play.frames.at(-1).scenes.length===2);
  let cache=graphs.get(level);
  if(!cache){cache=new Map();graphs.set(level,cache);}
  const key=ending+(encore?':both':'');
  if(cache.has(key))return cache.get(key);
  const frames=level.play.frames,opts=performances(level);
  const tails=frames.map(()=>[]);
  for(let i=frames.length-1;i>=0;i--){
    for(const option of opts) {
      if(!frames[i].scenes.includes(option.scene) || !acceptsMark(frames[i],level.width,option.rays))continue;
      if(encore && relay && !fitsPeer(level,i,option.rays))continue;
      if(i===frames.length-1){if(option.scene===ending)tails[i].push(option);continue;}
      if(encore && !relay && i===frames.length-2 && !middleOptions(level).has(marked(option.keys)))continue;
      const hold=makeHold(level,option.slots,frames[i+1]);
      if(tails[i+1].some(next=>allows(hold,next.keys)))tails[i].push(option);
    }
  }
  cache.set(key,tails);return tails;
}

export function takeScene(level,takes,slots) {
  const frame=level.play.frames[takes.length];
  if(!frame || !validLayout(level,slots))return -1;
  const {scene,rays}=readProjector(level,slots);
  if(!frame.scenes.includes(scene) || !acceptsMark(frame,level.width,rays))return -1;
  return allows(makeHold(level,takes.at(-1),frame),signature(level,slots))?scene:-1;
}
export function sightline(level,takes,slots,ending,encore=false,quiet=false) {
  const scene=takeScene(level,takes,slots);
  if(scene<0)return {scene,possible:false};
  const keys=signature(level,slots);
  const possible=reachable(level,takes,playGraph(level,ending,encore),encore,quiet).options.some(s=>s.keys.every((key,id)=>key===keys[id]));
  return {scene,possible};
}
export function changeTotal(level,takes) {
  const keys=takes.map(slots=>signature(level,slots));
  return keys.reduce((n,row,i)=>n+(i?changes(keys[i-1],row).length:0),0);
}
const quietScores=new WeakMap();
export function quietScore(level,both=false) {
  const frames=level.play.frames,tails=playGraph(level,frames.at(-1).scenes[0],both);
  if(quietScores.has(tails))return quietScores.get(tails);
  const rest=tails.map(()=>new Map());
  for(let i=frames.length-1;i>=0;i--){
    for(const layout of tails[i]){
      if(i===frames.length-1){rest[i].set(layout,0);continue;}
      const hold=makeHold(level,layout.slots,frames[i+1]);
      let best=Infinity;
      for(const [next,after] of rest[i+1]){
        if(allows(hold,next.keys))best=Math.min(best,changes(layout.keys,next.keys).length+after);
      }
      rest[i].set(layout,best);
    }
  }
  const score={target:Math.min(...rest[0].values()),rest};
  quietScores.set(tails,score);return score;
}
function fitsPeer(level,index,rays){
  return acceptsMark({mark:level.play.frames[index].peerMark},level.width,rays);
}
export function firstMissedMark(level,takes){
  return takes.findIndex((board,i)=>!fitsPeer(level,i,readProjector(level,board).rays));
}
function reachable(level,takes,tails,encore,quiet) {
  const hold=makeHold(level,takes.at(-1),level.play.frames[takes.length]);
  if(encore && level.play.delivery && firstMissedMark(level,takes)>=0)return {hold,options:[]};
  if(encore && level.play.frames.at(-1).scenes.length===2 && takes.length===tails.length-1 && !canTakeRequests(level,takes))return {hold,options:[]};
  const options=tails[takes.length].filter(s=>allows(hold,s.keys));
  if(!quiet || level.play.first==null)return {hold,options};
  const {target,rest}=quietScore(level,encore),used=changeTotal(level,takes);
  return {hold,options:options.filter(s=>used+(hold?changes(hold.keys,s.keys).length:0)+rest[takes.length].get(s)<=target)};
}
// The currently assembled board is fixed. Price only legal continuations of
// that exact geometry, including the changes already paid before this cue.
export function remainingCost(level,takes,board,both=false){
  if(takeScene(level,takes,board)<0 || both && firstMissedMark(level,takes)>=0)return null;
  const keys=signature(level,board),scores=quietScore(level,both).rest[takes.length];
  for(const [option,remaining] of scores){
    if(option.keys.every((key,i)=>key===keys[i])){
      const paid=changeTotal(level,[...takes,board]);
      return {remaining,total:paid+remaining};
    }
  }
  return null;
}
export function rewindPoint(level,takes,ending,encore=false,quiet=false) {
  const tails=playGraph(level,ending,encore);
  for(let i=Math.min(takes.length-1,tails.length-1);i>=0;i--){
    if(reachable(level,takes.slice(0,i),tails,encore,quiet).options.length)return i;
  }
  return 0;
}
export function cueHint(level,takes,slots,selected,ending,encore=false,quiet=false,reference=null) {
  if(takes.length===level.play.frames.length)return {type:'finished'};
  const {hold,options}=reference?{
    hold:makeHold(level,takes.at(-1),level.play.frames[takes.length]),
    options:[{slots:reference[takes.length],keys:signature(level,reference[takes.length])}]
  }:reachable(level,takes,playGraph(level,ending,encore),encore,quiet);
  if(!options.length)return {type:'rewind',index:rewindPoint(level,takes,ending,encore,quiet)};
  const keys=signature(level,slots);
  let best,wrong,cost=Infinity;
  for(const candidate of options){
    const mismatches=changes(candidate.keys,keys);
    const actions=mismatches.reduce((total,id)=>total+(slots[id]?2:1),0);
    if(actions<cost){cost=actions;best=candidate;wrong=mismatches;}
  }
  if(!wrong.length)return {type:'ready'};
  const loose=wrong.filter(id=>!slots[id]);
  loose.sort((a,b)=>Number(b===selected)-Number(a===selected));
  for(const id of loose){
    if(fits(level,slots,id,best.slots[id]))return {type:'place',id,place:best.slots[id]};
  }
  const lifted=hold?changes(hold.keys,keys):[],set=wrong.filter(id=>slots[id]);
  const id=set.find(i=>lifted.includes(i)) ?? set.find(i=>!hold || lifted.length<hold.limit);
  if(id==null)return {type:'reset'};
  return {type:'lift',id,count:set.length};
}

export function deskAt(level,slots) {
  if(!slots)return fresh(level);
  return {slots:[...slots],angles:slots.map(p=>p?.o??0),selected:slots.findIndex(p=>!p)};
}
function validTakes(level,raw) {
  const takes=[];
  if(Array.isArray(raw))for(const slots of raw.slice(0,level.play.frames.length)){
    if(takeScene(level,takes,slots)<0)break;
    takes.push(slots);
  }
  return takes;
}
const draftKey=level=>'slip:draft:'+(level.play.first==null?level.id:'slip-'+level.play.id);
export const savedOrder=level=>read(draftKey(level))?.order===1?1:0;
export const savedReading=level=>read(draftKey(level))?.reading===1?1:0;
export const hasPlayDraft=level=>Array.isArray(read(draftKey(level))?.takes);
export function restorePlay(level,raw=read(draftKey(level))) {
  if(level.play.first!=null && raw?.order!==versionOf(level))raw=null;
  if(level.play.coda && raw?.reading!==level.play.coda.mode)raw=null;
  const takes=validTakes(level,raw?.takes),frame=level.play.frames[takes.length];
  const hold=makeHold(level,takes.at(-1),frame);
  const intact=Array.isArray(raw?.takes) && raw.takes.length===takes.length;
  const valid=state=>validDraft(level,state) && allows(hold,signature(level,state.slots));
  if(!frame || !intact || !valid(raw?.state))return {takes,state:deskAt(level,takes.at(-1)),history:[]};
  const history=Array.isArray(raw.history)?raw.history.slice(-40).filter(valid):[];
  return {takes,state:raw.state,history};
}
export function savePlay(level,takes,state,history) {
  const draft={takes,state,history:history.slice(-40)};
  if(level.play.first!=null)draft.order=versionOf(level);
  if(level.play.coda)draft.reading=level.play.coda.mode;
  write(draftKey(level),draft);
}
export function storePlaybill(level,takes) {
  if(takes.length!==level.play.frames.length || validTakes(level,takes).length!==takes.length)return false;
  const scene=readProjector(level,takes.at(-1)).scene;
  const key='slip:bill:'+level.id+':'+scene;
  write(level.play.first==null?key:key+':'+changeTotal(level,takes),takes);
  if(level.play.delivery && firstMissedMark(level,takes)<0)recordDouble(level,takes);
  if(canTakeRequests(level,takes) && !encoreBill(level)){
    // Keep each ending separately: another tab can perform its counterpart.
    // The prefix is the geometry, not the pose encoding of a symmetric pane.
    const key='slip:run:'+level.id+':'+castKey(level,takes)+':';
    write(key+scene,takes);
    const pair=level.play.frames.at(-1).scenes.map(s=>read(key+s));
    if(sameCast(level,pair))write('slip:encore:'+level.id,pair);
  }
  return true;
}
const tapeKey=(l,tape)=>tape.map(s=>marked(signature(l,s))).join('|');
const sameTape=(l,a,b)=>a.length===b.length && a.every((row,i)=>!differentPanes(l,row,b[i]).length);
const scoreCap=l=>l.play.frames.reduce((s,f)=>s+(f.limit||0),0);
function validDouble(l,tape){
  const n=l.play.frames.length;
  return Boolean(l.play.delivery && Array.isArray(tape) && tape.length===n && validTakes(l,tape).length===n && firstMissedMark(l,tape)<0);
}
const matchedKey=(l,cost)=>'slip:signed:'+(versionOf(l)===0?l.id:partnerOrder(l).id)+':'+cost;
function recordDouble(l,tape){
  const score=changeTotal(l,tape),suffix=':'+tapeKey(l,tape);
  write('slip:double:'+l.id+':'+score,tape);
  // Keep the first leg under its full geometry: a later performance with the
  // same cost, or a second tab, must not replace the evidence for this pair.
  write('slip:leg:'+l.id+suffix,tape);
  const pair=signedWith(l,tape);
  if(pair)write(matchedKey(l,score),pair);
}
export function signedWith(l,tape){
  if(!validDouble(l,tape))return null;
  const other=partnerOrder(l),suffix=':'+tapeKey(l,tape),cost=changeTotal(l,tape);
  const levels=versionOf(l)===0?[l,other]:[other,l];
  const pair=levels.map(side=>read('slip:leg:'+side.id+suffix)||read('slip:double:'+side.id+':'+cost));
  return pair.every((run,i)=>validDouble(levels[i],run) && sameTape(l,run,tape))?pair:null;
}
export function signedBill(l){
  if(!l.play.delivery)return null;
  const levels=versionOf(l)===0?[l,partnerOrder(l)]:[partnerOrder(l),l];
  for(let score=0;score<=scoreCap(l);score++){
    const archived=read(matchedKey(l,score));
    // Older editions already stored real early and late tickets separately.
    for(const pair of [archived,levels.map(s=>read('slip:double:'+s.id+':'+score))]){
      if(Array.isArray(pair) && pair.length===2 && pair.every((t,i)=>validDouble(levels[i],t) && changeTotal(l,t)===score) && sameTape(l,...pair))return pair;
    }
  }
  return null;
}
export function setTrace(l,reference){
  if(reference && !validDouble(partnerOrder(l),reference))return false;
  write('slip:trace:'+l.id,reference);return true;
}
export function readTrace(l,takes){
  if(!l.play.delivery || takes.length===l.play.frames.length)return null;
  const ref=read('slip:trace:'+l.id);
  return validDouble(partnerOrder(l),ref) && sameTape(l,ref.slice(0,takes.length),takes)?ref:null;
}
// From an actual five-cue run retain the longest prefix which still admits
// this reading, including its keeper and the chosen rehearsal goals.
export function usablePrefix(l,run,both=false,quiet=false){
  const valid=validTakes(l,run),goal=l.play.frames.at(-1).scenes[0];
  for(let n=valid.length;n>0;n--)if(sightline(l,valid.slice(0,n-1),valid[n-1],goal,both,quiet).possible)return n;
  return 0;
}
export function doubleBill(level){
  if(!level.play.delivery)return null;
  for(let cost=0;cost<=scoreCap(level);cost++){
    const raw=read('slip:double:'+level.id+':'+cost);
    if(validDouble(level,raw) && changeTotal(level,raw)===cost)return raw;
  }
  return null;
}
export function playbill(level,ending) {
  const key='slip:bill:'+level.id+':'+ending,frames=level.play.frames;
  function checked(raw){
    const takes=validTakes(level,raw);
    return takes.length===frames.length && readProjector(level,takes.at(-1)).scene===ending?takes:null;
  }
  if(level.play.first==null)return checked(read(key));
  // Each score has its own receipt, including when two tabs finish at once.
  const cap=frames.reduce((n,frame)=>n+(frame.limit||0),0);
  for(let score=0;score<=cap;score++){
    const record=checked(read(key+':'+score));
    if(record && changeTotal(level,record)===score)return record;
  }
  return null;
}

const castKey=(level,takes)=>takes.slice(0,-1).map(s=>marked(signature(level,s))).join('|');
function sameCast(level,pair) {
  const last=level.play.frames.at(-1),length=level.play.frames.length;
  return last.scenes.length===2 && Array.isArray(pair) && pair.length===2 && pair.every((run,i)=>
    Array.isArray(run) && run.length===length && validTakes(level,run).length===length &&
    readProjector(level,run.at(-1)).scene===last.scenes[i]) && castKey(level,pair[0])===castKey(level,pair[1]);
}
export function encoreBill(level) {
  const receipt=read('slip:encore:'+level.id);
  return sameCast(level,receipt)?receipt:null;
}
