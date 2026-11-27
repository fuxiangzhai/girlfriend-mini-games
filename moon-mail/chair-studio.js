import { coordinate, mountChart } from "./chart.js";
import { arrows, pushes, shutter, chairKey, chairStudio, freshRoom, movingChair, pushOption, frameOption,
  stageAction, replayChairs, portraitStyle, portraitId, chairAdvice, retakePoint } from "./chair-portraits.mjs";
import { showStill } from "./chair-photo.js";

const el=id=>document.getElementById("chair-"+id);
const ns="http://www.w3.org/2000/svg";
const directions=["east","south","west","north"];
const styleNames=["near","turn","far"];
export const rollToken=film=>portraitId(film)+"@"+film.count;
function svg(tag,attrs={}) {
  const node=document.createElementNS(ns,tag);
  for (const [k,v] of Object.entries(attrs)) node.setAttribute(k,v);
  return node;
}
function glyph(name,cls) {
  const node=svg("svg",{class:cls,"aria-hidden":"true"});
  node.append(svg("use",{href:"#"+name}));return node;
}
function makeButton(...parts) {
  const b=document.createElement("button");b.type="button";b.append(...parts);return b;
}
function textTag(tag,text) {
  const node=document.createElement(tag);node.textContent=text;return node;
}

export function createChairStudio({letter,read,write,cue,delivered,receipt}) {
  let room, chart, mode, t, state, dir, view, target, selected, compare, split, help, comment, guide;
  let filed=new Map();
  let animation=0, obscured=[];
  const pos=c=>coordinate(room.board,c);
  const chairName=i=>t("chairName"+i);
  const oldFilm=()=>filed.get(selected);
  function loadRoll(m,r,id,count) {
    if (!r.catalog.has(id) || !Number.isInteger(count) || count<r.catalog.get(id).count || count>r.limit) return null;
    const film=replayChairs(r,read(chairKey(m,"roll."+id+"@"+count)));
    return film && film.count===count && portraitId(film)===id ? film : null;
  }
  function library(m) {
    const r=chairStudio(letter,m), results=new Map();
    for (const [id,shortest] of r.catalog) {
      for (let n=shortest.count;n<=r.limit;n++) {
        const film=loadRoll(m,r,id,n);
        if (film) { results.set(id,film);break; }
      }
    }
    return results;
  }
  function record(m,key) {
    const token=key ?? read(chairKey(m,"last"));
    if (typeof token==="string") {
      const [id,n]=token.split("@");
      const saved=loadRoll(m,chairStudio(letter,m),id,Number(n));
      if (saved && rollToken(saved)===token) return saved;
    }
    return key===undefined ? library(m).values().next().value : null;
  }
  function save() {
    write(chairKey(mode,"draft"),{code:state.code,dir,view,target,selected,compare,split});
  }
  function stopMotion() {
    cancelAnimationFrame(animation);
    for (const node of obscured) node.classList.remove("chair-in-motion");
    obscured=[];el("motion").replaceChildren();
  }
  function playMove(before,token) {
    if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const shot=token===shutter, action=shot ? frameOption(room,before) : pushOption(room,before,pushes.indexOf(token));
    const path=action.walk, steps=path.length-1;
    const person=svg("g");
    person.append(svg("circle",{cx:0,cy:0,r:12,fill:"#314d50",stroke:"#fae2b5","stroke-width":2}),
      svg("circle",{cx:0,cy:-4,r:3.5,fill:"#ffe3aa"}),svg("path",{d:"M-7 7q1-12 7-10 6-2 7 10Z",fill:"#ffe3aa"}));
    const chair=svg("g"), overlay=el("motion");
    const cover=node=>{node.classList.add("chair-in-motion");obscured.push(node);};
    cover(chart.cells[state.walker].querySelector(".chair-person"));
    if (!shot) {
      cover(chart.cells[action.to].querySelector(".chair-piece"));
      chair.append(svg("use",{href:action.which===0 ? "#g-wicker" : "#g-slat",x:-43,y:-43,width:86,height:86}));
    }
    overlay.append(chair,person);
    const walkTime=Math.min(540,steps*70), duration=walkTime+(shot?60:155);
    const place=(node,from,to,mix,offset=0)=>{
      const [x,y]=xy(from), [u,v]=xy(to);
      node.setAttribute("transform","translate("+(x+(u-x)*mix+offset)+" "+(y+(v-y)*mix+offset)+")");
    };
    const start=performance.now();
    function draw(now) {
      const time=now-start;
      if (time>=duration || document.hidden) {stopMotion();return;}
      if (!shot) place(chair,action.from,action.to,Math.max(0,(time-walkTime)/155));
      if (time<walkTime) {
        const distance=time/walkTime*steps, i=Math.floor(distance), mix=distance-i;
        const a=path[i], b=path[i+1], portal=room.board.gates.includes(a) && room.board.gates.includes(b);
        place(person,a,b,portal ? Number(mix>=.5) : mix,20);
        person.setAttribute("opacity",portal ? Math.abs(mix*2-1) : 1);
      } else {
        person.setAttribute("opacity",1);
        place(person,path.at(-1),state.walker,shot ? 1 : (time-walkTime)/155,20);
      }
      animation=requestAnimationFrame(draw);
    }
    draw(start);
  }
  function update() {save();render();}
  function leaveReview() {view=-1;dir=-1;comment=null;help=false;}
  function shoot() {
    const id=portraitId(state), token=rollToken(state);
    if (!record(mode,token)) write(chairKey(mode,"roll."+token),state.code);
    write(chairKey(mode,"last"),token);
    selected=id;save();refresh();delivered();cue("chairPrint");receipt(token);
  }
  function act(token) {
    if (view>=0) return;
    if (state.frames.length===3) {if(token===shutter) shoot();return;}
    const before=state, next=stageAction(room,state,token);
    if (!next) return;
    state=next;leaveReview();
    if (state.frames.length===3) {shoot();return;}
    update();playMove(before,token);cue(token===shutter ? "chairShutter" : "chairSlide");
  }
  function pickDirection(i) {
    if (view>=0 || state.frames.length===3) return;
    dir=i;comment=null;update();
  }
  function feature(c) {
    const tile=room.board.tiles[c];
    if (room.chalk.includes(c)) return t("chairChalk",{mark:tile.toUpperCase()});
    return t(tile==="A" ? "chairRack" : tile==="#" ? "chairCabinet" : tile==="M" ? "chairCamera"
      : tile==="@" ? "chairDoor" : c===room.board.source ? "chairEntry" : "chairFloor");
  }
  function pickCell(c) {
    if (view>=0) return;
    const i=room.next[state.seats[movingChair(state)]].indexOf(c);
    if (i>=0 && state.frames.length<3) {
      if (dir===i && !pushOption(room,state,i).reason) act(pushes[i]);
      else pickDirection(i);
    } else {
      const chair=state.seats.indexOf(c);
      comment=pos(c)+" · "+(chair<0 ? feature(c) : chairName(chair))+".";
      dir=-1;update();
    }
  }
  function branch(key) {
    const film=record(mode,key);
    if (!film) return;
    const fork=retakePoint(room,film,[...filed.keys()]);
    if (!fork) return;
    state=replayChairs(room,fork.code);leaveReview();
    target=portraitStyle(room.catalog.get(fork.id));selected=portraitId(film);compare=true;split=50;
    update();cue("paper");el("intro").focus({preventScroll:true});el("head").scrollIntoView({block:"nearest"});
  }
  function refresh() {
    filed=library(mode);
    if (!filed.has(selected)) {
      const last=record(mode);
      selected=last ? portraitId(last) : null;
    }
    el("file").replaceChildren(...[...filed].map(([id,film])=>{
      const opt=document.createElement("option");opt.value=id;
      const cells=film.frames.map((f,i)=>pos(f.seats[i%2])).join(" › ");
      opt.textContent=t("chairStyle_"+portraitStyle(film))+" · "+cells+" · "+t("chairCaption",{n:film.count});return opt;
    }));
    render();
  }
  const xy=c=>[(c%room.board.width+.5)*100,(Math.floor(c/room.board.width)+.5)*100];
  function floorPath(path,cls) {
    if (!path?.length) return [];
    const lines=[], groups=[[path[0]]];
    for (let i=1;i<path.length;i++) {
      if (room.board.gates.includes(path[i]) && room.board.gates.includes(path[i-1])) {
        for (const c of [path[i-1],path[i]]) {
          const [cx,cy]=xy(c);lines.push(svg("circle",{cx,cy,r:29,class:"chair-doorstep"}));
        }
        groups.push([]);
      }
      groups.at(-1).push(path[i]);
    }
    for (const cells of groups) if (cells.length>1) lines.push(svg("polyline",{points:cells.map(c=>xy(c).join(",")).join(" "),class:cls}));
    return lines;
  }
  function drawFloor(display, option, ready) {
    const past=view>=0, stage=display.frames.length, active=movingChair(display);
    const comparison=compare && oldFilm() ? oldFilm().frames[past ? view : Math.min(stage,2)] : null;
    for (const [c,tile] of chart.cells.entries()) {
      if (room.board.tiles[c]==="#") continue;
      const chair=display.seats.indexOf(c), direction=room.next[display.seats[active]].indexOf(c);
      tile.dataset.reach=!past && stage<3 && direction>=0 && !pushOption(room,display,direction).reason ? "yes" : "";
      tile.classList.toggle("chair-focus",!past && stage<3 && chair===active);
      tile.classList.toggle("chair-aim",option?.to===c);
      tile.classList.toggle("chair-stance",option?.behind===c);
      tile.classList.toggle("chair-guide",!past && guide?.keep===state.code.length && pushes.includes(guide.token ?? "!")
        && room.next[state.seats[active]][pushes.indexOf(guide.token)]===c);
      const piece=tile.querySelector(".chair-piece");
      piece.style.display=chair<0 ? "none" : "";
      if (chair>=0) piece.firstElementChild.setAttribute("href",chair===0 ? "#g-wicker" : "#g-slat");
      tile.querySelector(".chair-person").hidden=c!==display.walker;
      tile.setAttribute("aria-label",[pos(c),feature(c),chair>=0 ? chairName(chair) : "",c===display.walker ? t("chairOperator",{cell:pos(c)}) : ""].filter(Boolean).join(" · "));
    }
    const overlay=el("floor"), walk=past ? state.frames[view].walk : option ? option.walk : ready && stage<3 ? frameOption(room,display).walk : null;
    const marks=floorPath(walk,"chair-footsteps");
    if (option && !option.reason) marks.push(...floorPath([option.from,option.to],"chair-pushline"));
    if (comparison) for (const [i,c] of comparison.seats.entries()) {
      if (c===display.seats[i]) continue;
      const [x,y]=xy(c);marks.push(svg("rect",{x:x-35,y:y-35,width:70,height:70,rx:8,class:"chair-ghost"}));
    }
    overlay.replaceChildren(...marks);
  }
  function showBook(display) {
    const n=state.frames.length;
    for (const [i,b] of [...el("strip").children].entries()) {
      const frame=state.frames[i], live=!frame && i===n;
      b.disabled=!frame && (!live || view<0);
      b.setAttribute("aria-pressed",String(view===i || (view<0 && live)));
      const photo=b.querySelector("canvas");photo.hidden=!frame && !live;
      if (!photo.hidden) showStill(photo,room,frame?.seats ?? state.seats,letter.image);
      b.dataset.frameState=frame ? "exposed" : live ? "live" : "blank";
      b.querySelector("small").textContent=t(frame ? "chairExposed" : live ? "chairViewfinder" : "chairWaiting");
    }
    el("count").textContent=t("chairCount",{n:filed.size,total:room.catalog.size});
    el("legend").textContent=t(view<0 ? "chairLegend" : "chairReview",{n:view+1,a:pos(display.seats[0]),b:pos(display.seats[1])});
    el("retake").hidden=view<0 || view===2;
    el("retake").textContent=t("chairContinue",{n:view+1});el("now").hidden=view<0;
    for (const b of el("styles").children) {
      const style=b.dataset.style;
      b.setAttribute("aria-pressed",String(target===style));
      const total=[...room.catalog.values()].filter(f=>portraitStyle(f)===style).length;
      b.querySelector("small").textContent=[...filed.values()].filter(f=>portraitStyle(f)===style).length+" / "+total;
    }
    el("shelf").hidden=!filed.size;el("file").value=selected ?? "";
    const old=oldFilm();el("lightbox").hidden=!compare || !old;el("compare").setAttribute("aria-pressed",String(compare && !!old));
    if (compare && old) {
      const pair=old.frames[view>=0 ? view : Math.min(n,2)].seats;
      showStill(el("wipe"),room,display.seats,letter.image,pair,split);
      el("wipe").setAttribute("aria-label",t("chairComparePos",{a:pos(pair[0]),b:pos(pair[1]),c:pos(display.seats[0]),d:pos(display.seats[1])}));
      el("divider").value=split;
    }
  }
  function render() {
    stopMotion();
    const stage=state.frames.length, past=view>=0, complete=stage===3;
    const display=past ? replayChairs(room,state.code.slice(0,state.frames[view].end)) : state;
    const option=!past && !complete && dir>=0 ? pushOption(room,state,dir) : null;
    const shot=frameOption(room,state), ready=!shot.reason;
    guide=!past && !complete && (mode==="relaxed" || help) ? chairAdvice(room,state,target,[...filed.keys()]) : null;
    const framed=past ? view : Math.min(stage,2);
    el("stage").textContent=t("chairStage",{n:framed+1,name:t("chairFrame"+framed)});
    el("budget").textContent=t("chairBudget",{used:display.count,max:room.limit});
    const [a,b]=display.seats, width=room.board.width;
    el("wicker-at").textContent=chairName(0)+" "+pos(a);el("slat-at").textContent=chairName(1)+" "+pos(b);
    el("offsets").textContent=t("chairOffsets",{x:Math.abs(a%width-b%width),y:Math.abs(Math.floor(a/width)-Math.floor(b/width))});
    el("intro").textContent=[t("chairIntro"+(past ? view : stage)),target && !past && !complete ? t("chairAim",{name:t("chairStyle_"+target)}) : ""].filter(Boolean).join(" ");
    let status=complete ? t("chairComplete") : t("chairChooseHint",{chair:chairName(movingChair(state))});
    if (option) status=option.reason ? t("chairBlock_"+option.reason) : t("chairWalk",{behind:pos(option.behind),chair:chairName(option.which),from:pos(option.from),to:pos(option.to)});
    if (option?.walk?.some((c,i,a)=>i>0 && room.board.gates.includes(c) && room.board.gates.includes(a[i-1]))) status+=" "+t("chairVia");
    if (ready || shot.reason==="camera") {
      const shutterText=t(ready ? "chairReady" : "chairBlock_camera");
      status=option ? status+" "+shutterText : shutterText;
    }
    if (ready && stage===2) status+=" "+t("chairFramed",{name:t("chairStyle_"+portraitStyle(stageAction(room,state,shutter)))});
    if (!past && stage<3 && !ready && state.count===room.limit && option?.reason!=="limit") status+=" "+t("chairBlock_limit");
    if (past) status=t("chairReview",{n:view+1,a:pos(display.seats[0]),b:pos(display.seats[1])});
    el("status").textContent=[comment,status].filter(Boolean).join(" ");
    document.getElementById("route-description").textContent=[0,1].map(i=>t("chairAt",{name:chairName(i),cell:pos(display.seats[i])})).join(" · ")+". "+status;
    el("undo").disabled=past || !state.code.length;
    el("reset").disabled=!state.code.length;
    el("hint").hidden=mode!=="standard";el("hint").disabled=past || complete;
    el("advice").hidden=!guide;
    el("hint-back").hidden=!guide || guide.keep===state.code.length;
    if (guide) {
      el("advice").textContent=guide.keep<state.code.length ? t("chairHintUndo",{n:state.code.length-guide.keep})
        : guide.token===shutter ? t("chairHintShoot") : t("chairHintPush",{chair:chairName(movingChair(state)),cell:pos(room.next[state.seats[movingChair(state)]][pushes.indexOf(guide.token)])});
    }
    for (const [i,b] of [...el("dirs").children].entries()) {
      b.disabled=past || complete;b.setAttribute("aria-pressed",String(dir===i && !past && !complete));
      b.dataset.free=String(!b.disabled && !pushOption(room,state,i).reason);
    }
    el("push").disabled=!option || !!option.reason;
    el("push").textContent=t(!option || option.to<0 ? "chairPush" : "chairPushTo",{cell:option?.to>=0 ? pos(option.to) : ""});
    el("shot").disabled=past || (!complete && !ready);
    el("shot").textContent=t(complete ? "chairRead" : stage===2 ? "chairPost" : "chairShoot",{n:stage+1});
    drawFloor(display,option,ready);showBook(display);
  }
  function mount(m,translate) {
    mode=m;t=translate;room=chairStudio(letter,m);
    const draft=read(chairKey(mode,"draft")) ?? {};
    state=replayChairs(room,draft.code) ?? freshRoom(room);
    dir=Number.isInteger(draft.dir) && draft.dir>=0 && draft.dir<4 ? draft.dir : -1;
    view=Number.isInteger(draft.view) && draft.view>=0 && draft.view<state.frames.length ? draft.view : -1;
    const styles=styleNames.filter(name=>[...room.catalog.values()].some(f=>portraitStyle(f)===name));
    target=styles.includes(draft.target) ? draft.target : null;
    selected=draft.selected;compare=draft.compare===true;split=Number.isInteger(draft.split) && draft.split>=0 && draft.split<=100 ? draft.split : 50;
    help=false;comment=null;
    chart=mountChart(room.board,null,t,{onPlot:pickCell});
    chart.cells.forEach((tile,c)=>{
      const stamp=room.board.tiles[c];tile.replaceChildren();tile.className="tile studio-tile";
      if (stamp==="#") {tile.classList.add("chair-cabinet");tile.setAttribute("aria-label",pos(c)+" "+feature(c));return;}
      const symbol=stamp==="A" ? "g-dryingrack" : stamp==="@" ? "g-curtain" : stamp==="M" ? "g-filmCamera" : null;
      if (symbol) tile.append(glyph(symbol,"chair-prop"));
      if (room.chalk.includes(c) || c===room.board.source) {
        const tag=textTag("small",c===room.board.source ? "↪" : stamp.toUpperCase());tag.className="chair-chalk";tag.setAttribute("aria-hidden","true");tile.append(tag);
      }
      const person=textTag("span","");person.className="chair-person";person.setAttribute("aria-hidden","true");
      tile.append(glyph("g-wicker","chair-piece"),person);
    });
    el("floor").setAttribute("viewBox","0 0 "+room.board.width*100+" "+room.board.height*100);
    el("motion").setAttribute("viewBox",el("floor").getAttribute("viewBox"));
    el("dirs").replaceChildren(...arrows.map((arrow,i)=>{
      const b=makeButton(textTag("b",arrow),textTag("span",t(directions[i])));b.dataset.dir=i;
      b.addEventListener("click",()=>pickDirection(i));return b;
    }));
    el("strip").replaceChildren(...[0,1,2].map(i=>{
      const img=document.createElement("canvas");img.setAttribute("aria-hidden","true");
      const b=makeButton(img,textTag("strong",String(i+1).padStart(2,"0")+" · "+t("chairFrame"+i)),textTag("small",""));b.dataset.frame=i;
      b.addEventListener("click",()=>{view=view===i || !state.frames[i] ? -1 : i;dir=-1;comment=null;update();cue("paper");});return b;
    }));
    el("styles").replaceChildren(...styles.map(style=>{
      const b=makeButton(textTag("strong",t("chairStyle_"+style)),textTag("span",t("chairGoal_"+style)),textTag("small",""));
      b.dataset.style=style;b.addEventListener("click",()=>{target=target===style ? null : style;help=false;update();cue("paper");});return b;
    }));
    refresh();
  }
  el("push").addEventListener("click",()=>{if(dir>=0) act(pushes[dir]);});
  el("shot").addEventListener("click",()=>act(shutter));
  function rewind(code) {
    const restored=replayChairs(room,code);if (!restored) return;
    state=restored;leaveReview();update();cue("undo");
  }
  el("undo").addEventListener("click",()=>rewind(state.code.slice(0,-1)));
  el("reset").addEventListener("click",()=>rewind(""));
  el("retake").addEventListener("click",()=>{if(view>=0 && view<2)rewind(state.code.slice(0,state.frames[view].end));});
  el("now").addEventListener("click",()=>{leaveReview();update();});
  el("hint").addEventListener("click",()=>{help=true;render();cue("hint");});
  el("hint-back").addEventListener("click",()=>{if(guide)rewind(state.code.slice(0,guide.keep));});
  el("to-book").addEventListener("click",()=>{(el("styles").querySelector('[aria-pressed="true"]') ?? el("styles").firstElementChild).focus({preventScroll:true});el("book").scrollIntoView({block:"nearest"});});
  el("file").addEventListener("change",()=>{selected=el("file").value;update();});
  el("branch").addEventListener("click",()=>{if(oldFilm())branch(rollToken(oldFilm()));});
  el("read").addEventListener("click",()=>{if(oldFilm())receipt(rollToken(oldFilm()));});
  el("compare").addEventListener("click",()=>{compare=!compare;update();});
  el("divider").addEventListener("input",()=>{split=el("divider").valueAsNumber;save();showBook(view>=0 ? replayChairs(room,state.code.slice(0,state.frames[view].end)) : state);});
  document.getElementById("tiles").addEventListener("keydown",event=>{
    if (el("head").hidden || view>=0 || state.frames.length===3 || event.altKey || event.ctrlKey || event.metaKey) return;
    const i=["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].indexOf(event.key);
    if (i>=0) {event.preventDefault();pickDirection(i);return;}
    if (event.key==="Enter" && dir>=0) {event.preventDefault();if(!event.repeat)act(pushes[dir]);}
  });
  return {mount,record,refresh,branch,leave:stopMotion};
}
