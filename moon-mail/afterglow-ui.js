import { coordinate, mountChart } from "./chart.js";
import { flashAt, launch, lightAt, lightStation, logbook, moor, nextPassage, passages, sail, sounding, voyage } from "./afterglow.mjs";

const el = id => document.getElementById("glow-" + id);
const directions = ["east","south","west","north"];
const glyphs = {lit:"✦",fading:"◌",dark:"–"};
const arrows = ["→","↓","←","↑"];
export const glowKey = (mode, field) => "lighthouse-afterglow.v1." + mode + "." + field;
const point = (board, cell) => [cell % board.width + .5, Math.floor(cell/board.width) + .5];
function svg(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg",tag);
  for (const [name,value] of Object.entries(attrs)) node.setAttribute(name,value);
  return node;
}
export function glowSummary(station, trip, t) {
  const bottle = trip.glow ? t("glowUsed",{n:trip.glow.beat,cell:coordinate(station.board,trip.glow.cell)}) : t("glowNoGlow");
  return bottle + " · " + (trip.waits.length ? t("glowWaits",{flashes:trip.waits.join(", ")}) : t("glowNoWaits"));
}
function drawWater(station, display, beat, probe, old) {
  const {board} = station, xy = c => point(board,c).map(v => v*100);
  const path = (line,name) => svg("polyline",{points:line.map(c=>xy(c).join(",")).join(" "),class:name});
  const beams = [];
  for (const beam of flashAt(station,beat).beams) {
    if (beam.line.length < 2) continue;
    beams.push(path(beam.line,"glow-ray-wide"),path(beam.line,beam.line.includes(probe) ? "glow-ray traced" : "glow-ray"));
  }
  el("beams").replaceChildren(...beams);
  const wake = [path(display.trail,"glow-trail")];
  for (const [i,cell] of display.trail.entries()) {
    if (!i || cell === display.trail[i-1]) continue;
    const [x,y] = xy(cell);
    wake.push(svg("path",{d:"m0-7 5 6-2 8h-6l-2-8Z",transform:"translate("+x+" "+y+")",class:display.glow?.beat === i ? "bottled-light" : "paper-light"}));
  }
  if (old) {
    const from=old.trail[beat-1], to=old.trail[beat], [cx,cy]=xy(to);
    if (from!==to) wake.push(path([from,to],"glow-old-stroke"));
    wake.push(svg("circle",{cx,cy,r:31,class:"glow-old-stop","data-cell":to}));
    const mark=svg("text",{x:cx+26,y:cy-17,class:"glow-old-mark","text-anchor":"middle"});
    mark.textContent=from===to ? "Ⅱ" : arrows[Number(old.code[beat-1])];wake.push(mark);
  }
  el("wake").replaceChildren(...wake);
  const [x,y] = xy(display.cell);
  el("boat").setAttribute("x",x-28); el("boat").setAttribute("y",y-21);
}

export function createAfterglow({letter, read, write, cue, delivered, receipt}) {
  let mode, t, station, chart, trip, beat, probe, target, shelf, advice, compare;
  let filed = new Map();
  const pages = [...el("pages").children];
  const liveBeat = () => Math.min(trip.code.length+1,station.limit);
  const pos = cell => coordinate(station.board,cell);
  function record(m, code) {
    const archive = logbook(lightStation(letter,m));
    const valid = key => archive.has(key) && read(glowKey(m,"slip."+key)) === true;
    if (code !== undefined) return valid(code) ? archive.get(code) : null;
    const last = read(glowKey(m,"last"));
    if (valid(last)) return archive.get(last);
    // Each slip is filed separately, so it survives a lost or interrupted bookmark.
    for (const key of archive.keys()) if (valid(key)) return archive.get(key);
    return null;
  }
  function save() { write(glowKey(mode,"draft"),{code:trip.code,beat,probe,target,shelf,compare}); }
  function useTrip(next) {
    trip=next; beat=liveBeat(); probe=null; advice=false;
    save(); render();
  }
  function refresh() {
    filed=new Map();
    for (const [code,entry] of logbook(station)) if (read(glowKey(mode,"slip."+code)) === true) filed.set(code,entry);
    if (!filed.has(shelf)) shelf = record(mode)?.code ?? null;
    el("slips").replaceChildren(...[...filed.values()].map(entry =>
      new Option(t("glowShelfItem",{name:t("glowStyle_"+entry.style),
        marks:entry.code.split("").map(a => a === "4" ? "·" : arrows[Number(a)]).join("")}),entry.code)));
    if (shelf) el("slips").value=shelf;
    render();
  }
  function pickCell(cell) { probe=cell; save(); render(); }
  function turnPage(n) { beat=n; advice=false; save(); render(); }
  function take(action) {
    if (beat !== liveBeat()) return;
    const next=sail(station,trip,action);
    if (!next) return;
    cue(next.style ? "glowDock" : next.glow !== trip.glow ? "glowBottle" : action === moor ? "glowMoor" : "glowOar");
    const from=point(station.board,trip.cell), to=point(station.board,next.cell);
    useTrip(next);
    const boat=el("boat");
    if (boat.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const distance=from.map((v,i)=>(v-to[i])*100+"px").join(", ");
      boat.animate([{transform:"translate("+distance+")"},{transform:"translate(0, 0)"}],{duration:260,easing:"ease-out"});
    }
    if (!trip.style) chart.cells[trip.cell].focus({preventScroll:true});
    else el("main").focus({preventScroll:true});
  }
  function forkFrom(code) {
    const entry=filed.get(code);
    if (!entry) return null;
    const other=passages.filter(p=>p !== entry.style);
    const wanted=target ?? other.find(p=>[...logbook(station).values()].some(v=>v.style===p && !filed.has(v.code))) ?? other[0];
    // A completed page can still be revisited when all of its crossings have been filed.
    const plan=nextPassage(station,code,filed,wanted);
    return plan ? {...plan,wanted} : null;
  }
  function branch(code, fromLetter=false) {
    if (fromLetter && target === filed.get(code)?.style) target=null;
    const plan=forkFrom(code);
    if (!plan) return;
    target=plan.wanted; shelf=code; compare=true;
    useTrip(voyage(station,code.slice(0,plan.keep)));
    cue("paper"); el("intro").focus({preventScroll:true}); el("head").scrollIntoView({block:"nearest"});
  }
  function drawBook() {
    const all=[...logbook(station).values()];
    el("count").textContent=filed.size+" / "+all.length;
    for (const page of pages) {
      const style=page.dataset.style, total=all.filter(v=>v.style===style);
      page.setAttribute("aria-pressed",String(target===style));
      page.querySelector("b").textContent=total.filter(v=>filed.has(v.code)).length+"/"+total.length;
    }
    el("to-book").textContent=t(target ? "glowStyle_"+target : "glowBookLink");
    el("shelf").hidden=!shelf;
    const plan=forkFrom(shelf);
    el("fork").hidden=!plan || plan.keep === shelf?.length;
    if (plan) el("fork").textContent=t("glowFork",{n:plan.keep+1,cell:pos(plan.trip.trail[plan.keep])});
  }
  function drawClock() {
    el("clock-title").textContent=probe === null ? t("glowClock") : t("glowCellClock",{cell:pos(probe)});
    for (const [i,button] of [...el("clock").children].entries()) {
      const n=i+1, light=probe === null ? null : lightAt(station,probe,n);
      button.dataset.light=light ?? "";
      button.dataset.played=String(n <= trip.code.length);
      button.setAttribute("aria-pressed",String(beat===n));
      button.setAttribute("aria-label",t("glowClockBeat",{n})+(light ? " · "+t("glowLight_"+light) : ""));
      button.querySelector("i").textContent=light ? glyphs[light] : (n<=trip.code.length ? "✓" : "·");
    }
  }
  function render() {
    el("boat").getAnimations?.().forEach(animation=>animation.cancel());
    const live=liveBeat(), past=beat <= trip.code.length, reviewing=beat !== live || (past && trip.code.length === station.limit);
    // For a finished crossing the last flash initially shows the boat at the mailbox.
    const atEnd=trip.code.length === station.limit && beat === station.limit;
    const inspect=reviewing && !atEnd;
    const display=past && !atEnd ? voyage(station,trip.code.slice(0,beat-1)) : trip;
    const phase=flashAt(station,beat);
    const plan=!trip.style && (mode === "relaxed" || advice) ? nextPassage(station,trip.code,filed,target) : null;
    const action=plan && plan.keep === trip.code.length ? Number(plan.trip.code[plan.keep]) : null;
    const hintCell=action === null ? null : action===moor ? trip.cell : station.neighbors[trip.cell][action];
    const options = [];
    chart.cells.forEach((node,cell)=>{
      if (station.board.tiles[cell] === "#") return;
      const light=lightAt(station,cell,beat), how=sounding(station,trip,cell);
      const canLand=!reviewing && (how === "lit" || how === "fading");
      if (canLand) options.push(cell);
      node.dataset.glowLight=light;
      node.classList.toggle("glow-land",canLand);
      node.classList.toggle("glow-guided",!reviewing && hintCell===cell);
      node.setAttribute("aria-pressed",String(probe===cell));
      node.tabIndex=cell === (probe ?? display.cell) ? 0 : -1;
      const lamp=station.lamps.findIndex(l=>l.cell===cell);
      const feature=lamp===0 ? "lamp" : lamp>0 ? "buoy" : cell===station.box ? "box" : station.board.mirrorAt.has(cell) ? "mirror" : "water";
      let label=pos(cell)+" · "+t("glowFeature_"+feature)+" · "+t("glowLight_"+light);
      if (lamp>=0) {
        const dir=phase.beams[lamp].dir;
        node.querySelector(".glow-heading").textContent=arrows[dir];
        label+=" · "+t("glowLampDir",{dir:t(directions[dir])});
      }
      if (cell===display.cell) label+=" · "+t("glowAt",{cell:pos(cell)});
      else if (display.trail.includes(cell)) label+=" · "+t("glowWake");
      node.setAttribute("aria-label",label);
    });
    const old=compare ? filed.get(shelf) : null;
    drawWater(station,display,beat,probe,old); drawClock(); drawBook();
    el("beat").textContent=t(!inspect && !atEnd ? "glowNext" : "glowFlash",{n:beat,total:station.limit})+(inspect ? " · "+t(past ? "glowPast" : "glowFuture") : "");
    el("boat-at").textContent=t("glowAt",{cell:pos(display.cell)});
    el("bottle").classList.toggle("spent",Boolean(display.glow));
    el("bottle").textContent=t(display.glow ? "glowSpent" : "glowFull");
    const how=probe === null ? null : sounding(station,trip,probe);
    el("comparison").hidden=!shelf;
    el("compare").setAttribute("aria-pressed",String(Boolean(old)));
    el("echo").hidden=!old;
    if (old) {
      const from=old.trail[beat-1], cell=old.trail[beat];
      let echo=t(from===cell ? "glowEchoMoor" : "glowEchoRow",{from:pos(from),cell:pos(cell)});
      const draftAction=how==="moor" ? moor : station.neighbors[trip.cell].indexOf(probe);
      const pending=!reviewing && ["moor","lit","fading"].includes(how);
      const course=pending ? trip.code+draftAction : trip.code;
      const split=[...course].findIndex((a,i)=>a!==old.code[i]);
      if (split>=0) echo+=" "+t(split===trip.code.length ? "glowParting" : "glowParted",{n:split+1});
      el("echo").textContent=echo;
    }
    const canMoor=sounding(station,trip,trip.cell)==="moor";
    let status;
    if (inspect) status=t(past ? "glowReview" : "glowForecast",{n:beat,cell:pos(display.cell)});
    else if (trip.style) status=t("glowReady",{name:t("glowStyle_"+trip.style)});
    else if (atEnd) status=t("glowMiss");
    else if (!options.length && !canMoor) status=t("glowStuck");
    else status=how ? t("glowLook_"+how,{cell:pos(probe),n:station.limit}) : t("glowPick");
    el("status").textContent=status;
    el("hint-text").hidden=!plan || inspect;
    if (plan) el("hint-text").textContent=action===null ? t("glowHintBack",{n:plan.keep+1,cell:pos(trip.trail[plan.keep])})
      : t(action===moor ? "glowHintWait" : sounding(station,trip,hintCell)==="fading" ? "glowHintSpend" : "glowHintRow",{cell:pos(hintCell)});
    el("now").hidden=!inspect;
    el("rewind").hidden=!past;
    el("rewind").textContent=t("glowRewind",{n:beat});
    el("undo").disabled=!trip.code.length || inspect;
    el("reset").disabled=!trip.code.length;
    el("hint").hidden=mode!=="standard"; el("hint").disabled=Boolean(trip.style)||inspect;
    el("moor").disabled=!canMoor || inspect;
    el("moor").classList.toggle("glow-guided",action===moor && !inspect);
    el("main").disabled=inspect || (!trip.style && how!=="lit" && how!=="fading");
    el("main").textContent=t(trip.style ? (filed.has(trip.code) ? "glowRead" : "glowPost") : how==="fading" ? "glowSpend" : how==="lit" ? "glowRow" : "glowRowIdle",{cell:probe===null ? "" : pos(probe)});
    document.getElementById("route-description").textContent=display.trail.map(pos).join(" → ")+". "+status;
  }
  function mount(m,translate) {
    mode=m; t=translate; station=lightStation(letter,m);
    const draft=read(glowKey(m,"draft")) || {};
    trip=voyage(station,draft.code) ?? launch(station);
    beat=Number.isInteger(draft.beat) && draft.beat>=1 && draft.beat<=station.limit ? draft.beat : liveBeat();
    probe=Number.isInteger(draft.probe) && station.board.tiles[draft.probe] && station.board.tiles[draft.probe]!=="#" ? draft.probe : null;
    target=passages.includes(draft.target) ? draft.target : null; shelf=draft.shelf; advice=false; compare=draft.compare===true;
    chart=mountChart(station.board,null,t,{onPlot:pickCell});
    for (const [i,node] of chart.cells.entries()) {
      const mirror=station.board.mirrorAt.has(i), lamp=station.lamps.some(l=>l.cell===i);
      if (mirror || lamp) {
        node.querySelector("svg")?.remove(); node.querySelector(".heading-arrow")?.remove();
        const icon=svg("svg",{"aria-hidden":"true"});
        icon.append(svg("use",{href:mirror ? "#g-mirror" : i===station.board.source ? "#g-watchtower" : "#g-sweepbuoy"}));
        node.append(icon);
      }
      if (mirror) {node.className="tile mirror";node.classList.toggle("falling",station.board.tiles[i]==="B");}
      if (lamp) {
        node.classList.add("glow-beacon");
        const dir=document.createElement("i");dir.className="glow-heading";dir.setAttribute("aria-hidden","true");node.append(dir);
      }
    }
    el("clock").replaceChildren(...Array.from({length:station.limit},(_,i)=>{
      const button=document.createElement("button"); button.type="button";
      const n=document.createElement("b"); n.textContent=i+1;
      const icon=document.createElement("i"); icon.setAttribute("aria-hidden","true");
      button.append(n,icon); button.addEventListener("click",()=>turnPage(i+1));return button;
    }));
    el("overlay").setAttribute("viewBox","0 0 "+station.board.width*100+" "+station.board.height*100);
    el("intro").textContent=t("glowIntro",{n:station.limit,box:pos(station.box)});
    refresh();
  }
  document.getElementById("tiles").addEventListener("keydown",event=>{
    if (el("head").hidden || event.ctrlKey || event.metaKey || event.altKey) return;
    const dir=["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].indexOf(event.key);
    const button=event.target.closest("button[data-cell]");
    if (!button) return;
    if (event.key==="Enter" && Number(button.dataset.cell)===probe && beat===liveBeat()) {
      const how=sounding(station,trip,probe);
      if (["moor","lit","fading"].includes(how)) {
        event.preventDefault();
        if (!event.repeat) take(how==="moor" ? moor : station.neighbors[trip.cell].indexOf(probe));
        return;
      }
    }
    if (dir<0) return;
    event.preventDefault();
    const next=station.neighbors[Number(button.dataset.cell)][dir];
    if (next>=0) {pickCell(next);chart.cells[next].focus({preventScroll:true});}
  });
  el("main").addEventListener("click",()=>{
    if (!trip.style) {take(station.neighbors[trip.cell].indexOf(probe));return;}
    const code=trip.code;
    write(glowKey(mode,"slip."+code),true); write(glowKey(mode,"last"),code);
    shelf=code; save(); refresh(); delivered(); cue("glowDock"); receipt(code);
  });
  el("moor").addEventListener("click",()=>take(moor));
  el("undo").addEventListener("click",()=>{useTrip(voyage(station,trip.code.slice(0,-1)));cue("undo");});
  el("reset").addEventListener("click",()=>{useTrip(launch(station));cue("reset");});
  el("rewind").addEventListener("click",()=>{useTrip(voyage(station,trip.code.slice(0,beat-1)));cue("paper");});
  el("now").addEventListener("click",()=>turnPage(liveBeat()));
  el("hint").addEventListener("click",()=>{advice=true;render();cue("hint");});
  for (const page of pages) page.addEventListener("click",()=>{
    target=target===page.dataset.style ? null : page.dataset.style;
    advice=false;save();render();cue("paper");
  });
  el("to-book").addEventListener("click",()=>{
    (pages.find(p=>p.dataset.style===target) ?? pages[0]).focus({preventScroll:true});
    el("book").scrollIntoView({block:"nearest"});
  });
  el("slips").addEventListener("change",()=>{shelf=el("slips").value;save();render();});
  el("compare").addEventListener("click",()=>{compare=!compare;save();render();});
  el("read").addEventListener("click",()=>{if(filed.has(shelf)) receipt(shelf);});
  el("fork").addEventListener("click",()=>branch(shelf));
  return {mount,refresh,record,another:code=>branch(code,true)};
}

export function glowPrint(station, trip, t) {
  const {board}=station, canvas=document.createElement("canvas");
  canvas.width=840; canvas.height=358;
  const summary=glowSummary(station,trip,t);
  canvas.setAttribute("role","img");canvas.setAttribute("aria-label",t("glowStyle_"+trip.style)+" · "+summary+" · "+trip.trail.map(c=>coordinate(board,c)).join(" → "));
  const ctx=canvas.getContext("2d");
  const size=Math.min(54,226/board.height), left=51, top=97;
  const xy=c=>point(board,c).map((v,i)=>v*size+(i?top:left));
  const dot=(x,y,r,fill)=>{ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();};
  ctx.fillStyle="#f6edda";ctx.fillRect(0,0,840,358);ctx.strokeStyle="#b6a783";ctx.strokeRect(8,8,824,342);
  ctx.fillStyle="#2f4752";ctx.font="bold 27px system-ui,sans-serif";ctx.fillText(t("glowStyle_"+trip.style),25,43);
  ctx.font="17px system-ui,sans-serif";ctx.fillText(summary,25,70);
  ctx.font="14px system-ui,sans-serif";ctx.textAlign="center";ctx.fillStyle="#5a625c";
  for(let j=0;j<board.width;j++)ctx.fillText(String.fromCharCode(65+j),left+(j+.5)*size,top-6);
  for(let i=0;i<board.height;i++)ctx.fillText(String(i+1),left-14,top+(i+.5)*size+5);
  ctx.fillStyle="#fdf6e5";ctx.fillRect(left,top,board.width*size,board.height*size);
  Array.from(board.tiles).forEach((tile,c)=>{
    const [x,y]=xy(c);ctx.strokeStyle="#cdc8b4";ctx.lineWidth=1;ctx.strokeRect(x-size/2,y-size/2,size,size);
    if(tile==="#"){ctx.fillStyle="#a3aaa5";ctx.fillRect(x-10,y-10,20,20);}
    if(tile==="A"||tile==="B"){const d=tile==="A"?9:-9;ctx.strokeStyle="#8a9991";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-9,y+d);ctx.lineTo(x+9,y-d);ctx.stroke();}
    if(station.berths.has(c)){dot(x,y,10,"#c6a872");dot(x,y,6,"#f8ebcc");}
  });
  ctx.strokeStyle="#39646a";ctx.lineWidth=3;ctx.lineJoin=ctx.lineCap="round";ctx.beginPath();
  trip.trail.forEach((c,i)=>{const [x,y]=xy(c);if(i) ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
  for(const [i,cell] of trip.trail.entries()) {
    const [x,y]=xy(cell);
    if(trip.waits.includes(i)){ctx.strokeStyle="#996139";ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();}
    else if(trip.glow?.beat===i){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle="#80648e";ctx.fillRect(-5,-5,10,10);ctx.restore();}
    else dot(x,y,3.6,"#34575d");
  }
  const [bx,by]=xy(station.box);
  ctx.fillStyle="#ac604b";ctx.fillRect(bx-8,by-6,16,12);ctx.strokeStyle="#fff1d6";ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(bx-7,by-5);ctx.lineTo(bx,by);ctx.lineTo(bx+7,by-5);ctx.stroke();
  const x0=390, y0=97;
  ctx.textAlign="start";ctx.font="bold 18px system-ui,sans-serif";ctx.fillStyle="#354f54";ctx.fillText(t("glowClock"),x0,y0+3);
  trip.code.split("").forEach((a,i)=>{
    const y=y0+29+i*27, spent=trip.glow?.beat===i+1, hold=Number(a)===moor;
    ctx.font="bold 16px system-ui,sans-serif";ctx.fillStyle=spent?"#745782":"#35555c";
    ctx.fillText(String(i+1).padStart(2,"0"),x0,y);
    ctx.fillText(hold?"Ⅱ":arrows[Number(a)],x0+45,y);
    ctx.fillText(coordinate(board,trip.trail[i+1]),x0+83,y);
    ctx.font="16px system-ui,sans-serif";ctx.fillText(t(hold?"glowWait":spent?"glowLight_fading":"glowLight_lit"),x0+144,y);
    ctx.strokeStyle="#d7cebb";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y+7);ctx.lineTo(807,y+7);ctx.stroke();
  });
  return canvas;
}
