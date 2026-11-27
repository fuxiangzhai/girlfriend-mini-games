import {inspectNight,prepareNight,turnsBetween} from './light-path.mjs';

export function withinChange(frame,previous,setting) {
  return previous==null || (turnsBetween(previous,setting)<=frame.limit && !((previous^setting)&frame.waxMask));
}

// Work backwards through the contact strip. An individually correct frame may have no way to its successor.
export function prepareRoll(plan) {
  const bench=prepareNight(plan);
  const frames=plan.frames.map(sheet=>{
    const waxMask=bench.controls.filter(c=>sheet.wax?.includes(c.key)).reduce((mask,c)=>mask|c.bit,0);
    const frame={...bench,...sheet,waxMask};
    const acceptable=[];
    for(let s=0;s<2**bench.controls.length;s++) if(inspectNight(frame,s).done) acceptable.push(s);
    return {...frame,acceptable};
  });
  const tails=frames.map(()=>new Map());
  for(let i=frames.length-1;i>=0;i--) for(const here of frames[i].acceptable) {
    let cost=i===frames.length-1?0:Infinity;
    if(i+1<frames.length) for(const [there,rest] of tails[i+1]) {
      if(withinChange(frames[i+1],here,there)) cost=Math.min(cost,turnsBetween(here,there)+rest);
    }
    if(Number.isFinite(cost)) tails[i].set(here,cost);
  }
  return {...bench,frames,tails,par:Math.min(...tails[0].values())};
}

export function spentTurns(shots) {
  return shots.reduce((total,setting,i)=>total+(i?turnsBetween(shots[i-1],setting):0),0);
}

export function forecast(roll,shots,setting) {
  const i=shots.length, frame=roll.frames[i];
  if(!frame || !withinChange(frame,shots[i-1],setting) || !frame.acceptable.includes(setting)) return {matched:false};
  const rest=roll.tails[i].get(setting);
  return {matched:true,possible:rest!=null,total:rest==null?null:spentTurns([...shots,setting])+rest};
}

// Pencil plans are only usable with the exact preceding mirror setting they were drawn from.
export function plannedSetting(roll,frameIndex,previous,plans) {
  const plan=plans?.[frameIndex],frame=roll.frames[frameIndex];
  if(!frame || previous==null || plan?.base!==previous || !frame.acceptable.includes(plan.setting)) return null;
  return withinChange(frame,previous,plan.setting)?plan.setting:null;
}

export function rehearsalBase(roll,shots,live,view,plans) {
  if(view<=shots.length || view>=roll.frames.length) return null;
  let previous=live;
  for(let i=shots.length+1;i<view;i++) {
    previous=plannedSetting(roll,i,previous,plans);
    if(previous===null) break;
  }
  return previous;
}

function bestSetting(roll,shots,setting,precise) {
  const index=shots.length,previous=shots[index-1],spent=spentTurns(shots);
  let answer=null,nearest=Infinity,cheapest=Infinity;
  for(const [candidate,tail] of roll.tails[index]) {
    if(!withinChange(roll.frames[index],previous,candidate)) continue;
    const total=spent+(previous==null?0:turnsBetween(previous,candidate))+tail;
    if(precise && total!==roll.par) continue;
    const distance=turnsBetween(setting,candidate);
    if(distance<nearest || (distance===nearest && total<cheapest)) {
      answer=candidate; nearest=distance; cheapest=total;
    }
  }
  return answer;
}

export function adviseRoll(roll,shots,setting,precise=false) {
  if(shots.length===roll.frames.length) return {type:'finished'};
  const target=bestSetting(roll,shots,setting,precise);
  if(target===null) {
    // Keep the longest prefix that can still produce the requested ending.
    for(let back=shots.length-1;back>=0;back--) {
      if(bestSetting(roll,shots.slice(0,back),shots[back],precise)!==null) return {type:'rewind',frame:back};
    }
    return null;
  }
  if(target===setting) return {type:'shoot'};
  const difference=target^setting,previous=shots[shots.length-1];
  // Free a used change before spending another, so the suggestion is legal at a tight limit.
  const moves=(previous==null?0:difference&(setting^previous)) || difference;
  return {type:'turn',control:roll.controls.find(c=>c.bit & moves)};
}

export function restoreRoll(roll,raw) {
  const shots=[], valid=s=>Number.isInteger(s) && s>=0 && s<2**roll.controls.length;
  for(const s of Array.isArray(raw?.shots)?raw.shots.slice(0,roll.frames.length):[]) {
    const frame=roll.frames[shots.length];
    if(!valid(s) || !frame.acceptable.includes(s) || !withinChange(frame,shots[shots.length-1],s)) break;
    shots.push(s);
  }
  const previous=shots[shots.length-1],frame=roll.frames[shots.length];
  if(!frame) return {shots,setting:previous,history:[],exposed:true};
  const permitted=s=>valid(s) && withinChange(frame,previous,s);
  const intact=Array.isArray(raw?.shots) && raw.shots.length===shots.length && permitted(raw.setting);
  return {shots,setting:intact?raw.setting:previous??roll.start,
    history:intact && Array.isArray(raw.history)?raw.history.slice(-40).filter(permitted):[],
    exposed:intact && raw.exposed===true};
}
