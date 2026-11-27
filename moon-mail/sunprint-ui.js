import { coordinate, mountChart } from "./chart.js";
import { dryingRack, freshPress, validSheet, dose, shades, reclip, pressHint, pressKey, companion } from "./sunprints.mjs";
import { paperImage } from "./sunprint-art.js";

const el = name => document.getElementById("sun-" + name);
const faceKey = frond => frond.face === 1 ? "sunFacingR" : "sunFacingL";
const arrow = frond => frond.face === 1 ? "→" : "←";

function putImage(canvas, source) {
  canvas.width = source.width; canvas.height = source.height;
  canvas.getContext("2d").drawImage(source,0,0);
}

export function createSunprints({ letter, read, write, cue, delivered, receipt }) {
  const frondButtons = [...el("fronds").querySelectorAll("button")];
  const pages = [...el("pages").querySelectorAll("button")];
  let rack, chart, mode, t, sheet, history, which, goal, loupe, probe, shelf, advising, notice;
  let filed = [];
  const pos = cell => coordinate(rack.board,cell);
  const tone = depth => t("sunTone_" + shades[depth]);
  const stage = () => rack.poses.get(sheet.pose);
  const copy = () => rack.poses.get(sheet.first);
  const impression = () => rack.proofs.get(sheet.first + "~" + sheet.pose);
  const known = m => [...dryingRack(letter,m).proofs.values()].filter(p => read(pressKey(m,"print."+p.id)) === true);
  function record(m, id) {
    const key = id ?? read(pressKey(m,"last"));
    const result = dryingRack(letter,m).proofs.get(key);
    if (result && read(pressKey(m,"print."+key)) === true) return result;
    return id === undefined ? known(m)[0] : undefined;
  }
  function save() {
    write(pressKey(mode,"draft"), { sheet, history, which, goal, loupe, probe, shelf });
  }
  function setSheet(next) {
    if (!validSheet(rack,next) || (next.first === sheet.first && next.pose === sheet.pose)) return;
    history.push(sheet); sheet = next; notice = null; advising = false;
  }
  function commit() { save(); render(); }
  function choice(i, cell, requestedFace) {
    return reclip(rack,sheet,i,cell,requestedFace) ?? reclip(rack,sheet,i,cell,-requestedFace);
  }
  function inspect(cell) {
    const first = copy() ?? stage(), current = stage();
    const light = pose => t((pose.mask >>> cell) & 1 ? "sunShade" : "sunLight");
    const index = rack.sensors.indexOf(cell), margin = rack.margins.indexOf(cell);
    const label = index < 0 ? pos(cell) : t("sunRegistration",{cell:pos(cell),mark:String.fromCharCode(65+index)});
    const parts = [t(copy() ? "sunInspect2" : "sunInspect1", {cell:label,a:light(first),b:light(current),tone:tone(dose(first,current,cell))})];
    if (index >= 0) parts.push(t("sunGoalAt",{tone:tone(rack.targets[index])}));
    if (margin >= 0) {
      parts.push(t("sunMarginAt",{n:margin+1}));
      if (goal) parts.push(t("sunGoalAt",{tone:tone(margin===(goal==="left" ? 0 : 1) ? 0 : 1)}));
    }
    return parts.join(" ");
  }
  function pick(cell) {
    probe = cell; notice = null;
    if (!loupe && rack.board.mirrorAt.has(cell)) {
      const next = choice(which,cell,stage().fronds[which].face);
      if (!next) notice = t("sunNoPin");
      else {
        setSheet({first:sheet.first,pose:next.id});
        notice = t("sunMoved",{frond:t("sunFrond"+which),pin:pos(cell),face:t(faceKey(next.fronds[which]))});
        cue("sunClip");
      }
    } else notice = inspect(cell);
    commit();
  }
  function branch(id) {
    const proof = record(mode,id);
    if (!proof) return;
    setSheet({first:proof.first.id,pose:proof.first.id});
    which = 1-proof.held; goal = proof.page === "left" ? "right" : proof.page === "right" ? "left" : null;
    shelf = proof.id; loupe = false; probe = null; notice = null; advising = false;
    commit(); cue("paper"); el("intro").focus({preventScroll:true}); el("head").scrollIntoView({block:"nearest"});
  }
  function book() {
    const origin = copy() ?? stage();
    const entries = filed.filter(proof => proof.first === origin);
    let filled = 0;
    for (const [i,button] of pages.entries()) {
      const side = button.dataset.page, cell = rack.margins[i];
      const proof = entries.find(p => p.page === side);
      const thumb = button.querySelector("canvas"), token = proof?.id ?? "blank"+cell;
      if (thumb.dataset.token !== token) {
        if (proof) putImage(thumb,paperImage(rack,proof.first,proof.second,26));
        else {
          thumb.width=156; thumb.height=130;
          const ctx=thumb.getContext("2d");
          ctx.fillStyle="#e5e5d7"; ctx.fillRect(0,0,156,130);
          ctx.strokeStyle="#9caeae"; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
          ctx.strokeRect(8,8,140,114);
          rack.margins.forEach((mark,j) => {
            const x=15+(mark%rack.board.width+.5)*21, y=13+(Math.floor(mark/rack.board.width)+.5)*20;
            ctx.fillStyle=j===i?"#fff9e5":"#88aebf";ctx.fillRect(x-8,y-8,16,16);ctx.strokeStyle="#536d7b";ctx.setLineDash([]);ctx.strokeRect(x-8,y-8,16,16);
          });
        }
        thumb.dataset.token=token;
      }
      if (proof) filled++;
      button.setAttribute("aria-pressed", String(goal === side));
      button.querySelector("small").textContent = t("sunMark",{cell:pos(cell)}) + (proof ? " · "+t("sunFiledPage") : "");
    }
    const unreachable = copy() && goal && !rack.firstPages.get(sheet.first)?.has(goal);
    el("pair").textContent = t(filled===2 ? "sunMatched" : unreachable ? "sunNoPage" : filled===1 ? "sunPair1" : "sunPair0");
    el("pair").dataset.bound = String(filled===2);
    el("count").textContent=t("sunCount",{n:new Set(filed.map(p=>p.image)).size});
    el("shelf").hidden=!filed.length;
    el("file").value=shelf ?? "";
  }
  function refresh() {
    filed=known(mode);
    if (!filed.some(proof => proof.id === shelf)) shelf=record(mode)?.id;
    const options = filed.map(proof => {
      const option=document.createElement("option"); option.value=proof.id;
      const pins=pose => pose.fronds.map(f => pos(f.peg)+arrow(f)).join(" / ");
      option.textContent=t("sunPage_"+proof.page)+" · "+pins(proof.first)+" › "+pins(proof.second);
      return option;
    });
    el("file").replaceChildren(...options); render();
  }
  function render() {
    const pose=stage(), first=copy(), proof=impression();
    const guide=mode==="relaxed" || advising ? pressHint(rack,sheet,goal,filed) : null;
    const hintMount=guide?.frond;
    const selected=pose.fronds[which];
    const depths=rack.sensors.map(c => dose(first ?? pose,pose,c));
    const mismatch=depths.findIndex((n,i) => n!==rack.targets[i]);
    el("intro").textContent=t(first ? "sunIntro2" : "sunIntro1");
    el("stage").textContent=t(first ? "sunStage2" : "sunStage1");
    el("view").setAttribute("aria-pressed",String(loupe));
    frondButtons.forEach((b,i) => {
      b.setAttribute("aria-pressed",String(i===which)); const f=pose.fronds[i];
      b.querySelector("b").textContent=pos(f.peg)+" "+arrow(f);
    });
    el("turn").disabled=!reclip(rack,sheet,which,selected.peg,-selected.face);
    el("turn").classList.toggle("sun-guided",guide?.which===which && hintMount?.peg===selected.peg && hintMount.face!==selected.face);
    const displayToken=[mode,sheet.first,sheet.pose,loupe].join("/");
    if (el("paper").dataset.token !== displayToken) {
      putImage(el("paper"),paperImage(rack,first,pose,88,!loupe));
      el("paper").dataset.token=displayToken;
    }
    for (const [cell,tile] of chart.cells.entries()) {
      if (rack.board.tiles[cell]==="#") continue;
      const pin=rack.board.mirrorAt.has(cell);
      const mount=pose.fronds.findIndex(f=>f.peg===cell);
      tile.dataset.peg=pin ? (mount>=0 ? "held" : choice(which,cell,selected.face) ? "open" : "closed") : "";
      tile.dataset.shade=loupe ? (first ? shades[dose(first,pose,cell)] : (pose.mask>>>cell)&1 ? "white" : "pale") : "";
      tile.classList.toggle("sun-guided",!loupe && hintMount?.peg===cell);
      tile.classList.toggle("sun-probe",probe===cell);
      const tag=tile.querySelector(".sun-peg");
      if (tag) tag.textContent=mount===0 ? "Ⅰ" : mount===1 ? "Ⅱ" : "";
      const labels=[inspect(cell)];
      if (pin) labels.push(t("sunEye"));
      if (mount>=0) labels.push(t("sunFrond"+mount),t(faceKey(pose.fronds[mount])));
      tile.setAttribute("aria-label",labels.join(" · "));
    }
    for (const [i,button] of [...el("readings").children].entries()) {
      const light=(pose.mask>>>rack.sensors[i])&1 ? "sunShade" : "sunLight";
      button.querySelector("b").textContent=first ? tone(depths[i]) : t(light);
      button.dataset.match=String(Boolean(first) && depths[i]===rack.targets[i]);
    }
    let status=t("sunTry",{frond:t("sunFrond"+which)});
    if (first) {
      if (!rack.firstPages.has(first.id)) status=t("sunNoStudy");
      else if (proof) status=t("sunMatch");
      else if (first===pose || mismatch<0) status=t("sunLiftOne");
      else status=t("sunMismatch",{mark:String.fromCharCode(65+mismatch),actual:tone(depths[mismatch]),wanted:tone(rack.targets[mismatch])});
    }
    el("status").textContent=[notice,status,goal ? t("sunGoal",{page:t("sunPage_"+goal)}) : ""].filter(Boolean).join(" ");
    document.getElementById("route-description").textContent=el("status").textContent;
    el("advice").hidden=!guide;
    if (guide) el("advice").textContent=t("sunHint_"+guide.action,hintMount ? {frond:t("sunFrond"+guide.which),pin:pos(hintMount.peg),face:t(faceKey(hintMount))} : {});
    el("main").disabled=Boolean(first && !proof);
    el("main").textContent=t(!first ? "sunExpose" : proof && filed.includes(proof) ? "sunRead" : "sunWash");
    el("hint").hidden=mode!=="standard";
    el("undo").disabled=!history.length; el("rewind").hidden=!first;
    book();
  }
  function mount(m, translate) {
    mode=m; t=translate; rack=dryingRack(letter,m);
    const draft=read(pressKey(m,"draft")) ?? {};
    sheet=validSheet(rack,draft.sheet) ? draft.sheet : freshPress(m);
    history=validSheet(rack,draft.sheet) && Array.isArray(draft.history) && draft.history.every(s=>validSheet(rack,s)) ? draft.history.slice() : [];
    which=draft.which===1 ? 1 : 0; goal=["left","right"].includes(draft.goal) ? draft.goal : null;
    loupe=draft.loupe===true; probe=Number.isInteger(draft.probe) && rack.board.tiles[draft.probe] && rack.board.tiles[draft.probe]!=="#" ? draft.probe : null;
    shelf=draft.shelf; advising=false; notice=null;
    chart=mountChart(rack.board,null,t,{onPlot:pick});
    const badge=(cls,text) => { const tag=document.createElement("span");tag.className=cls;tag.textContent=text;tag.setAttribute("aria-hidden","true");return tag; };
    chart.cells.forEach((tile,c) => {
      tile.replaceChildren();
      if (rack.board.tiles[c]==="#") { tile.className="tile sun-stone";tile.setAttribute("aria-label",pos(c)+" "+t("sunStone"));return; }
      tile.className="tile sun-cell";
      if (rack.board.mirrorAt.has(c)) tile.append(badge("sun-peg",""));
      const sensor=rack.sensors.indexOf(c), margin=rack.margins.indexOf(c);
      if (sensor>=0) tile.append(badge("sun-reg",String.fromCharCode(65+sensor)));
      if (margin>=0) tile.append(badge("sun-margin",margin===0 ? "①" : "②"));
    });
    el("readings").replaceChildren(...rack.sensors.map((c,i) => {
      const button=document.createElement("button");button.type="button";
      const key=document.createElement("span");key.textContent=String.fromCharCode(65+i);
      const current=document.createElement("b"), wanted=document.createElement("small");wanted.textContent=t("sunNeed",{tone:tone(rack.targets[i])});
      button.append(key,current,wanted);button.addEventListener("click",()=>{loupe=true;pick(c);});return button;
    }));
    el("invitation").textContent=t("sunInvitation",{left:pos(rack.margins[0]),right:pos(rack.margins[1])});
    refresh();
  }
  frondButtons.forEach((b,i)=>b.addEventListener("click",()=>{
    if (which!==i && copy() && stage().fronds[1-i]!==copy().fronds[1-i]) {
      setSheet({first:sheet.first,pose:sheet.first}); notice=t("sunChooseAgain",{frond:t("sunFrond"+i)});
    } else notice=null;
    which=i; loupe=false; probe=null; commit();
  }));
  el("turn").addEventListener("click",()=>{
    const f=stage().fronds[which], next=reclip(rack,sheet,which,f.peg,-f.face);
    if (!next) return;
    setSheet({first:sheet.first,pose:next.id});loupe=false;probe=f.peg;commit();cue("sunClip");
  });
  el("view").addEventListener("click",()=>{loupe=!loupe;notice=probe!==null ? inspect(probe) : null;commit();});
  el("hint").addEventListener("click",()=>{advising=true;render();cue("hint");});
  el("undo").addEventListener("click",()=>{if(history.length){sheet=history.pop();notice=null;probe=null;commit();cue("undo");}});
  el("rewind").addEventListener("click",()=>{setSheet({first:null,pose:sheet.pose});loupe=false;probe=null;commit();cue("paper");});
  el("main").addEventListener("click",()=>{
    if (!sheet.first) {
      setSheet({first:sheet.pose,pose:sheet.pose});probe=null;commit();cue("sunExpose");return;
    }
    const proof=impression();if (!proof) return;
    write(pressKey(mode,"print."+proof.id),true);write(pressKey(mode,"last"),proof.id);
    shelf=proof.id;notice=null;save();refresh();delivered();cue("sunWash");receipt(proof.id);
  });
  for (const button of pages) button.addEventListener("click",()=>{
    goal=goal===button.dataset.page ? null : button.dataset.page;notice=null;advising=false;
    commit(); cue("paper");
  });
  el("to-book").addEventListener("click",()=>{(pages.find(b=>b.dataset.page===goal) ?? pages[0]).focus({preventScroll:true});el("book").scrollIntoView({block:"nearest"});});
  el("file").addEventListener("change",()=>{shelf=el("file").value;save();});
  el("fork").addEventListener("click",()=>branch(shelf));
  el("read").addEventListener("click",()=>{if(shelf)receipt(shelf);});
  document.getElementById("tiles").addEventListener("keydown",event=>{
    const tile=event.target.closest("button[data-cell]");
    if (el("head").hidden || !tile || event.ctrlKey || event.altKey || event.metaKey) return;
    const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if (!Object.hasOwn(dirs,event.key)) return;
    event.preventDefault();
    const [dx,dy]=dirs[event.key], cell=Number(tile.dataset.cell), x=cell%rack.board.width+dx, y=Math.floor(cell/rack.board.width)+dy;
    if (x<0 || x>=rack.board.width || y<0 || y>=rack.board.height) return;
    const next=y*rack.board.width+x;
    if(rack.board.tiles[next]!=="#") chart.cells[next].focus({preventScroll:true});
  });
  return {mount,record,refresh,branch,mate:(m,proof)=>companion(proof,known(m))};
}
