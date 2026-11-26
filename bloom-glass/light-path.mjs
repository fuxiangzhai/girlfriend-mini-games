// A letter is one brass control. Two panes with the same letter turn together.
// Uppercase is a rising mirror at setting zero, lowercase is a falling one.
const directions = [[0,-1],[1,0],[0,1],[-1,0]];
const sides = ['T','R','B','L'];
const sideNames = {T:'北',R:'东',B:'南',L:'西'};
export const lampNames = ['琥珀灯','青瓷灯'];
export const motifs = {1:'铃兰',2:'紫藤',3:'桂花'};
export const portName = port => sideNames[port[0]] + port.slice(1);
export const squareName = (x,y) => String.fromCharCode(65+x) + (y+1);

export function prepareNight(plan) {
  const height=plan.rows.length, width=plan.rows[0].length;
  const controls=[], panes=new Map();
  plan.rows.forEach((row,y)=>[...row].forEach((mark,x)=>{
    if (!/[a-z]/i.test(mark)) return;
    const key=mark.toUpperCase();
    let control=controls.find(c=>c.key===key);
    if (!control) {
      control={key,bit:1<<controls.length,panes:[]};
      controls.push(control);
    }
    const pane={x,y,control,reverse:mark!==key};
    control.panes.push(pane); panes.set(y*width+x,pane);
  }));
  return {...plan,width,height,controls,panes};
}

export function portPoint(night,port) {
  const index=Number(port.slice(1))-1;
  switch (port[0]) {
    case 'T': return [index,-1];
    case 'B': return [index,night.height];
    case 'L': return [-1,index];
    case 'R': return [night.width,index];
  }
}

export function falls(pane,setting) {
  return Boolean(setting & pane.control.bit)!==pane.reverse;
}

export function traceLight(night,setting,entry) {
  let [x,y]=portPoint(night,entry);
  let heading=(sides.indexOf(entry[0])+2)%4;
  const points=[[x,y]], flowers=[], seen=new Set();
  let film=false, exit=null;
  for (;;) {
    x+=directions[heading][0]; y+=directions[heading][1]; points.push([x,y]);
    if (x<0 || x>=night.width || y<0 || y>=night.height) {
      const index=heading%2 ? y : x;
      exit=sides[heading]+(index+1);
      break;
    }
    const at=y*night.width+x, step=at*4+heading, mark=night.rows[y][x];
    if (seen.has(step)) break;
    seen.add(step);
    if (motifs[mark]) flowers.push(mark);
    if (mark==='*') film=true;
    const pane=night.panes.get(at);
    if (pane) heading ^= falls(pane,setting) ? 3 : 1;
  }
  return {points,flowers,film,exit};
}

export function follows(flowers,order) {
  let step=0;
  for (const flower of flowers) if (flower===order[step]) step++;
  return step===order.length;
}

export function inspectNight(night,setting) {
  const rays=night.lamps.map(lamp=>traceLight(night,setting,lamp.entry));
  const inside=rays.every((ray,i)=>follows(ray.flowers,night.lamps[i].order));
  const outside=rays.every((ray,i)=>ray.exit===night.lamps[i].exit);
  const done=inside && outside;
  return {rays,inside,outside,done,silver:done && night.filmLamp!=null && rays[night.filmLamp].film};
}

function turnsBetween(a,b) {
  let diff=a^b, count=0;
  while (diff) { diff &= diff-1; count++; }
  return count;
}

// A hint follows the closest valid setting, keeping as many of the player's choices as possible.
export function nextTurn(night,setting,withFilm=false) {
  let distance=Infinity, nearest=setting;
  for (let candidate=0;candidate<1<<night.controls.length;candidate++) {
    const turns=turnsBetween(setting,candidate);
    if (turns>=distance) continue;
    const result=inspectNight(night,candidate);
    if (withFilm ? result.silver : result.done) { nearest=candidate; distance=turns; }
  }
  return night.controls.find(control=>(nearest^setting)&control.bit) || null;
}
