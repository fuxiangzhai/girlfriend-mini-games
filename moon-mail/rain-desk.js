import { coordinate, mountChart } from "./chart.js";
import { rainDesk, foldKey, foldHistory, previewFold, printId, shadeAt, foldHint, alternateFold,
  foldPair, differences, commonFolds, inkTrail } from "./rain-folds.mjs";
import { drawRainSheet, foldFeature, animatePress, creaseList } from "./rain-paper.js";

const el=id=>document.getElementById("fold-"+id);
function button(text,click) {
  const b=document.createElement("button");b.type="button";b.textContent=text;b.addEventListener("click",click);return b;
}
function option(value,text) {
  const o=document.createElement("option");o.value=value;o.textContent=text;return o;
}

export function createRainDesk({letter,read,write,cue,delivered,receipt}) {
  let desk,mode,t,chart,frames,selected,inspect,view,goal,planned,pin,compare,tracing,help,hint;
  let filed=new Map(),stop=()=>{};
  const pos=c=>coordinate(desk.board,c);
  const current=()=>frames.at(-1);
  const owned=()=>[...filed.keys()];
  const creaseFor=key=>desk.creases.find(c=>c.key===key);
  const describe=(sheet,c)=>t("foldCheck",{cell:pos(c),name:t(c===desk.watch?"foldWatchMark":"fold_rail"+foldFeature(desk,c)),shade:t("foldTone"+shadeAt(sheet,c))});
  function posted(m) {
    const edition=rainDesk(letter,m);
    return [...edition.solutions.values()].filter(s=>read(foldKey(m,"print."+s.code))===true);
  }
  function record(m,code) {
    const edition=rainDesk(letter,m),key=code??read(foldKey(m,"last"));
    if (edition.solutions.has(key) && read(foldKey(m,"print."+key))===true) return edition.solutions.get(key);
    return code===undefined ? posted(m)[0] : null;
  }
  function mate(m,sheet) {
    const edition=rainDesk(letter,m),others=posted(m).filter(s=>foldPair(edition,sheet,s));
    const rank=s=>commonFolds(sheet.code,s.code)*50-differences(edition,sheet,s).length;
    return others.sort((a,b)=>rank(b)-rank(a))[0];
  }
  function save() {
    write(foldKey(mode,"draft"),{code:current().code,selected,inspect,view,goal,planned,pin,compare,tracing});
  }
  function change() {save();render();}
  function normalView() {view=-1;selected="";help=false;}
  function restartAt(n) {
    frames=frames.slice(0,n+1);normalView();change();cue("undo");
  }
  function pick(key) {
    if (view>=0 || shadeAt(current(),desk.box)===2) return;
    selected=key;change();
  }
  function send() {
    const sheet=current();
    const known=record(mode,sheet.code);
    if (!known) write(foldKey(mode,"print."+sheet.code),true);
    write(foldKey(mode,"last"),sheet.code);
    pin=sheet.code;planned="";compare=false;save();refresh();delivered();cue(known?"paper":"foldPost");receipt(sheet.code);
  }
  function press() {
    if (view>=0) return;
    const sheet=current(),crease=creaseFor(selected);
    if (shadeAt(sheet,desk.box)===2) {send();return;}
    if (!crease) return;
    const {next}=previewFold(desk,sheet,crease);
    if (!next) return;
    frames.push(next);normalView();change();
    stop=animatePress(el("motion"),desk,sheet,next,crease);
    cue(shadeAt(sheet,desk.star)!==2 && shadeAt(next,desk.star)===2 ? "foldInk" : "foldPress");
  }
  function branch(code) {
    const from=record(mode,code);if (!from) return;
    const alt=alternateFold(desk,from,owned(),!!mate(mode,from));
    planned=alt.sheet.code;goal=shadeAt(alt.sheet,desk.watch);pin=code;compare=true;
    frames=foldHistory(desk,code.slice(0,alt.keep));inspect=desk.watch;normalView();change();cue("paper");
    el("intro").focus({preventScroll:true});el("head").scrollIntoView({block:"nearest"});
  }
  function refresh() {
    const sheets=posted(mode);
    filed=new Map();
    for (const sheet of sheets) {
      const id=printId(sheet);
      if (!filed.has(id) || sheet.code===pin) filed.set(id,sheet);
    }
    if (!sheets.some(s=>s.code===pin)) pin=record(mode)?.code??"";
    const choices=[...filed.values()];
    el("file").replaceChildren(...choices.map((s,i)=>option(s.code,t("foldFile",{n:i+1,
      label:t("foldAt",{cell:pos(desk.watch),shade:t("foldTone"+shadeAt(s,desk.watch))})+" · "+creaseFor(s.code[0]).label}))));
    const pinned=record(mode,pin);if (pinned) el("file").value=filed.get(printId(pinned)).code;
    render();
  }
  function shelf(shown,old) {
    el("count").textContent=t("foldCount",{n:filed.size,total:desk.prints.size});
    el("goal").value=String(goal);
    el("shelf").hidden=!filed.size;el("compare").setAttribute("aria-pressed",String(compare&&!!old));
    const expected=desk.solutions.get(planned),source=desk.solutions.get(pin);
    el("quest").hidden=!expected||!source;
    if (expected&&source) {
      const keep=commonFolds(source.code,expected.code);
      el("quest").textContent=t(foldPair(desk,source,expected)?"foldLooking":"foldAnother",{n:keep,cell:pos(desk.watch)})
        +" "+t("foldRest",{list:creaseList(desk,source.code.slice(keep))});
    }
    el("diff").hidden=!old;
    if (old) {
      const cells=differences(desk,shown,old);
      el("diff").textContent=t("foldStep",{n:shown.code.length})+" · "+t("foldDiff",{n:cells.length})+
        (cells.length ? " · "+cells.map(pos).join(" ") : "");
    }
    const track=el("steps");
    for(let i=0;i<frames.length;i++) {
      let b=track.children[i];
      if (!b) {
        b=button("",()=>{view=i===frames.length-1 || view===i ? -1 : i;selected="";change();cue("paper");});
        b.append(document.createElement("small"),document.createElement("strong"));track.append(b);
      }
      const crease=creaseFor(frames[i].code.at(-1));
      b.firstChild.textContent=String(i).padStart(2,"0");b.lastChild.textContent=crease?.label ?? t("foldFirst");
      b.setAttribute("aria-description",t("foldStep",{n:i}));
      b.setAttribute("aria-pressed",String(i===(view>=0?view:frames.length-1)));
    }
    while (track.children.length>frames.length) track.lastChild.remove();
    el("now").hidden=el("back").hidden=view<0;
  }
  function render() {
    stop();
    const live=current(),past=view>=0,sheet=past?frames[view]:live;
    const done=shadeAt(live,desk.box)===2, oldPrint=compare ? desk.solutions.get(pin) : null;
    const old=oldPrint ? foldHistory(desk,oldPrint.code.slice(0,sheet.code.length)).at(-1) : null;
    const crease=!past && !done ? creaseFor(selected) : null;
    const press=crease ? previewFold(desk,live,crease) : null;
    const next=press?.next;
    const trail=tracing ? inkTrail(desk,frames.slice(0,sheet.code.length+1),inspect) : [];
    drawRainSheet(el("paper"),desk,sheet,{crease,next,inspect,old,trail});
    el("trace").textContent=t("foldTrace",{cell:pos(inspect)});
    el("trace").disabled=shadeAt(sheet,inspect)===0;el("trace").setAttribute("aria-pressed",String(trail.length>0));
    el("lineage").hidden=!trail.length;
    if (trail.length) el("lineage").textContent=trail.map(({step,cell})=>t(step?"foldContact":"foldTraceStart",{n:step,cell:pos(cell)})).join(" → ");
    chart.cells.forEach((b,c)=>{
      const info=[describe(sheet,c)];
      if (next && shadeAt(sheet,c)!==shadeAt(next,c)) info.push(t("foldHere",{shade:t("foldTone"+shadeAt(next,c))}));
      b.setAttribute("aria-label",info.join(" · "));b.setAttribute("aria-pressed",String(c===inspect));
    });
    el("budget").textContent=t("foldBudget",{n:sheet.code.length,max:desk.limit});
    el("clip").textContent=t(!desk.repeat ? "foldNoClip" : new Set(sheet.code).size===sheet.code.length ? "foldClip" : "foldClipUsed");
    el("intro").textContent=t(shadeAt(sheet,desk.box)===2 ? "foldFinished" : sheet.ink ? "foldCarry" : "foldIntro",{star:pos(desk.star),box:pos(desk.box)});
    let status=t("foldChoose");
    if (past) status=t("foldHistorical",{n:view});
    else if (done) status=t("foldReady");
    else if (sheet.code.length>=desk.limit) status=t("foldReason_limit");
    else if (press?.reason) status=t("foldReason_"+press.reason);
    else if (next) {
      status=t("foldPreview",{line:crease.label,n:differences(desk,sheet,next).length});
      if (press.again) status+=" "+t("foldReuse");
      if (shadeAt(sheet,desk.star)===0 && shadeAt(next,desk.star)===2) status+=" "+t("foldWakes");
      if (shadeAt(next,desk.box)===2) status+=" "+t("foldArrives");
    } else if (sheet.code.length) status=t("foldOpened",{n:sheet.code.length,k:differences(desk,sheet,frames.at(-2)).length});
    el("status").textContent=status;
    let detail=describe(sheet,inspect);
    if (crease) {
      const other=crease.across[inspect];
      detail+=" · "+(other<0 ? t("foldOutside",{a:pos(inspect)}) : t("foldTouch",{a:pos(inspect),b:pos(other)}));
      if (next) detail+=" "+t("foldHere",{shade:t("foldTone"+shadeAt(next,inspect))});
    }
    if (old) detail+=" "+t("foldWas",{shade:t("foldTone"+shadeAt(old,inspect))});
    el("inspect").textContent=detail;document.getElementById("route-description").textContent=status+" "+detail;
    hint=!done && !past && (mode==="relaxed" || help) ? foldHint(desk,live.code,goal,planned,owned()) : null;
    const rewind=hint && hint.keep<live.code.length;
    el("advice").hidden=!hint;el("rewind").hidden=!rewind;
    if (hint) el("advice").textContent=rewind ? t("foldHintBack",{n:hint.keep}) : t("foldHintNext",{line:creaseFor(hint.key).label});
    for (const b of document.querySelectorAll(".fold-creases button")) {
      b.disabled=past || done;b.setAttribute("aria-pressed",String(crease?.key===b.dataset.key));
      b.dataset.used=String(sheet.code.includes(b.dataset.key));b.dataset.guided=String(!!hint && !rewind && hint.key===b.dataset.key);
    }
    el("main").textContent=t(done ? record(mode,live.code) ? "foldRead" : "foldPost" : "foldPress");el("main").disabled=past || (!done&&!next);
    el("undo").disabled=past || !live.code;el("reset").disabled=!live.code;
    el("hint").hidden=mode!=="standard";el("hint").disabled=past||done;
    shelf(sheet,old);
  }
  function mount(m,translate) {
    stop();mode=m;t=translate;desk=rainDesk(letter,m);
    const draft=read(foldKey(mode,"draft"))??{};
    frames=foldHistory(desk,draft.code)??[desk.initial];
    inspect=Number.isInteger(draft.inspect)&&draft.inspect>=0&&draft.inspect<desk.board.tiles.length ? draft.inspect : desk.board.source;
    view=Number.isInteger(draft.view)&&draft.view>=0&&draft.view<frames.length-1 ? draft.view : -1;
    selected=creaseFor(draft.selected)?.key??"";goal=[1,2].includes(draft.goal)?draft.goal:0;
    planned=desk.solutions.has(draft.planned)?draft.planned:"";pin=record(mode,draft.pin)?.code??"";
    compare=!!pin && draft.compare===true;tracing=draft.tracing===true;help=false;
    chart=mountChart(desk.board,null,t,{plotReefs:true,onPlot:c=>{inspect=c;change();}});
    chart.cells.forEach(b=>{b.replaceChildren();b.className="tile";});
    el("cols").replaceChildren();el("rows").replaceChildren();el("steps").replaceChildren();
    for (const crease of desk.creases) {
      const b=button(crease.label,()=>pick(crease.key));b.dataset.key=crease.key;
      const [a,,other]=crease.label;
      b.setAttribute("aria-description",t(crease.vertical?"foldV":"foldH")+" · "+t("foldCrease",{a,b:other}));
      (crease.vertical?el("cols"):el("rows")).append(b);
    }
    el("goal-label").textContent=t("foldGoal",{cell:pos(desk.watch)});
    el("goal").replaceChildren(...[0,1,2].map(v=>option(v,t(v?"foldTone"+v:"foldAny"))));
    refresh();
  }
  el("main").addEventListener("click",press);
  el("trace").addEventListener("click",()=>{tracing=!tracing;change();cue("paper");});
  el("undo").addEventListener("click",()=>restartAt(frames.length-2));
  el("reset").addEventListener("click",()=>restartAt(0));
  el("back").addEventListener("click",()=>{if(view>=0) restartAt(view);});
  el("now").addEventListener("click",()=>{normalView();change();});
  el("hint").addEventListener("click",()=>{help=true;render();cue("hint");});
  el("rewind").addEventListener("click",()=>{if(hint) restartAt(hint.keep);});
  el("goal").addEventListener("change",()=>{goal=Number(el("goal").value);if(goal) inspect=desk.watch;planned="";help=false;change();});
  el("file").addEventListener("change",()=>{pin=el("file").value;planned="";change();});
  el("compare").addEventListener("click",()=>{compare=!compare;change();});
  el("branch").addEventListener("click",()=>branch(pin));
  el("read").addEventListener("click",()=>{if(record(mode,pin)) receipt(pin);});
  document.getElementById("tiles").addEventListener("keydown",event=>{
    if (el("head").hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const delta=directions[event.key],c=Number(event.target.dataset.cell);
    if (!delta || !Number.isInteger(c)) return;
    event.preventDefault();const w=desk.board.width,x=c%w+delta[0],y=Math.floor(c/w)+delta[1];
    if (x<0 || y<0 || x>=w || y>=desk.board.height) return;
    inspect=y*w+x;change();chart.cells[inspect].focus();
  });
  return {mount,refresh,record,mate,branch,leave:()=>stop()};
}
