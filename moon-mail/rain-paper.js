import { coordinate } from "./chart.js";
import { shadeAt, differences } from "./rain-folds.mjs";

const unit=100, paperBases=new WeakMap(), blooms=new Map();
const blue="#365e75", red="#a63f36", line="#706c61";
const serif='Georgia,"Songti SC",SimSun,serif', sans='system-ui,"Microsoft YaHei",sans-serif';
const figures={
  roof:"M-21 2 -10-11 12-11 23 2ZM-16 2v12m32-12v12m-28-23 8 10m1-10 8 10m1-10 8 10",
  star:"M0-18 5-6 18-5 8 4 11 17 0 10-11 17-8 4-18-5-5-6Z",
  mail:"M-20-12h40v26h-40ZM-20-11 0 3l20-14M-19 13l12-11m26 11L7 2",
  window:"M-12-13h24v26h-24Zm0 13h24M0-13v26m-16 1h32",
  shutter:"M-4-13h13v26H-4Zm-3 0-10 4v20l10 3Zm17 0 8 4v20l-8 3ZM-4 0H9",
  wax:"M-15 12-5-13M-5 13 5-13M5 13 15-12",
};
function symbol(desk,c) {
  if (c===desk.board.source) return "roof";
  return ({"*":"star",M:"mail",A:"window",B:"shutter","#":"wax"})[desk.board.tiles[c]];
}
export function foldFeature(desk,c) { return symbol(desk,c) ?? "paper"; }
function path(ctx,d,color,width) {
  ctx.strokeStyle=color; ctx.lineWidth=width;ctx.stroke(new Path2D(d));
}
function canvasOf(w,h) {
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;return canvas;
}
function paperBase(desk) {
  if (paperBases.has(desk)) return paperBases.get(desk);
  const {width,height}=desk.board, w=width*unit,h=height*unit;
  const base=canvasOf(w,h), g=base.getContext("2d");
  const wash=g.createLinearGradient(0,0,w,h);
  wash.addColorStop(0,"#f8edd0");wash.addColorStop(.5,"#f4e7cb");wash.addColorStop(1,"#e8d8b8");
  g.fillStyle=wash;g.fillRect(0,0,w,h);
  for (let i=0;i<1700;i++) {
    const x=(i*173+i%13*19)%w, y=(i*79+i%23*17)%h;
    g.fillStyle=i%3 ? "#73593112" : "#fffef451";g.fillRect(x,y,2+(i%6),.85);
  }
  for (const fold of desk.creases) {
    const q=fold.line*unit;g.beginPath();
    if (fold.vertical) {g.moveTo(q,0);g.lineTo(q,h);} else {g.moveTo(0,q);g.lineTo(w,q);}
    g.strokeStyle="#93856c85";g.lineWidth=1.4;g.stroke();
  }
  paperBases.set(desk,base);return base;
}
function bloom(g,c,shade) {
  const key=c*3+shade;
  if (!blooms.has(key)) {
    const swatch=canvasOf(unit,unit),brush=swatch.getContext("2d");
    const ink=shade===2, pigment=ink?"153,49,46":"43,100,123";
    let seed=(key+11)*3259;
    const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const phi=noise()*6, tilt=.8+noise()*.16;
    brush.translate(50,50);brush.rotate((noise()-.5)*.37);
    const rim=new Path2D(),samples=120;
    for(let j=0;j<samples;j++) {
      const q=j*Math.PI*2/samples;
      const radius=33+3*Math.sin(q*3+phi)+2.3*Math.cos(q*5+c)+1.1*Math.sin(q*12+phi)+noise()*1.6;
      const x=radius*Math.cos(q),y=radius*Math.sin(q)*tilt;
      if (j) rim.lineTo(x,y);else rim.moveTo(x,y);
      const length=1+noise()*2.7;
      brush.strokeStyle="rgba("+pigment+",.18)";brush.lineWidth=.8;brush.beginPath();
      brush.moveTo(x,y);brush.lineTo(x+length*Math.cos(q),y+length*Math.sin(q));brush.stroke();
    }
    rim.closePath();brush.save();brush.clip(rim);
    const wash=brush.createRadialGradient(-6,-5,2,1,1,38);
    wash.addColorStop(0,"rgba("+pigment+",.36)");wash.addColorStop(.66,"rgba("+pigment+",.51)");
    wash.addColorStop(.9,"rgba("+pigment+",.62)");wash.addColorStop(1,"rgba("+pigment+",.35)");
    brush.fillStyle=wash;brush.fillRect(-49,-49,98,98);
    for (let j=0;j<320;j++) {
      brush.fillStyle=j%3 ? "rgba("+pigment+",.075)" : "#fff8dc38";
      const x=noise()*80-40,y=noise()*78-39;brush.fillRect(x,y,noise()*2.6+.6,noise()*1.8+.5);
    }
    brush.restore();brush.strokeStyle="rgba("+pigment+",.4)";brush.lineWidth=1;brush.stroke(rim);
    if (ink) path(brush,"M-7 1h14M0-6v14m-4-11 8 8m-8 0 8-8","#882c2a",2.1);
    else path(brush,"M-12 1q5-5 11 0t12 0m-21 6q4-3 8 0t8 0","#285569",2.2);
    blooms.set(key,swatch);
  }
  g.drawImage(blooms.get(key),-50,-50);
}
function rect(g,c,w,inset=4) {
  g.strokeRect((c%w)*unit+inset,Math.floor(c/w)*unit+inset,unit-inset*2,unit-inset*2);
}
export function drawRainSheet(canvas,desk,sheet,{crease,next,inspect=-1,old,trail=[]}={}) {
  const {width,height,tiles}=desk.board,w=width*unit,h=height*unit;
  if (canvas.width!==w || canvas.height!==h) {canvas.width=w;canvas.height=h;}
  const g=canvas.getContext("2d");g.save();g.drawImage(paperBase(desk),0,0);
  for (let c=0;c<tiles.length;c++) {
    const x=(c%width+.5)*unit,y=(Math.floor(c/width)+.5)*unit,kind=symbol(desk,c),shade=shadeAt(sheet,c);
    g.save();g.translate(x,y);
    if (kind==="wax") {
      g.fillStyle="#b8afa578";g.fillRect(-47,-47,94,94);
      path(g,figures.wax,"#827a69",3);
    } else {
      if (shade) bloom(g,c,shade);
      if (kind) {
        const landmark=kind==="roof"||kind==="mail"||kind==="star";
        if (shade) {g.translate(-26,-27);g.scale(.71,.71);}
        else if (!landmark) g.scale(.85,.85);
        g.lineCap="round";g.lineJoin="round";
        path(g,figures[kind],kind==="star" ? "#914338" : kind==="roof" ? blue : line,landmark?3.2:2.2);
      }
    }
    g.restore();
    if (c===desk.watch) {
      g.save();g.translate(x,y);path(g,"M-39-26v-13h13M39 26v13H26","#8e582e",2.8);g.restore();
    }
    if (next && shadeAt(next,c)!==shade) {
      g.save();g.strokeStyle=shadeAt(next,c)===2 ? "#9f312b" : "#325d77";
      g.lineWidth=3;g.setLineDash([5,5]);g.beginPath();g.arc(x,y,40,0,2*Math.PI);g.stroke();
      g.fillStyle=g.strokeStyle;g.font="bold 19px "+sans;g.fillText("+",x+26,y-24);g.restore();
    }
  }
  if (old) {
    g.strokeStyle="#76578a";g.lineWidth=3;g.setLineDash([3,5]);
    for (const c of differences(desk,sheet,old)) rect(g,c,width,5);
    g.setLineDash([]);
  }
  if (crease) {
    const pos=crease.line*unit;
    g.beginPath();g.moveTo(crease.vertical ? pos : 0, crease.vertical ? 0 : pos);
    g.lineTo(crease.vertical ? pos : w,crease.vertical ? h : pos);
    g.strokeStyle="#f7f2df";g.lineWidth=7;g.stroke();
    g.setLineDash([13,7]);g.strokeStyle="#774832";g.lineWidth=4;g.stroke();g.setLineDash([]);
    const other=crease.across[inspect];
    if (other>=0) {
      const xy=c=>[(c%width+.5)*unit,(Math.floor(c/width)+.5)*unit];
      g.beginPath();g.moveTo(...xy(inspect));g.lineTo(...xy(other));
      g.setLineDash([3,6]);g.strokeStyle="#594b41";g.lineWidth=2;g.stroke();g.setLineDash([]);
      rect(g,other,width,11);
    }
  }
  if (inspect>=0) {g.lineWidth=3;g.strokeStyle="#483e38";rect(g,inspect,width,3);}
  if (trail.length) {
    const points=trail.map(({cell},i)=>{
      const earlier=trail.slice(0,i).filter(mark=>mark.cell===cell).length;
      const total=trail.filter(mark=>mark.cell===cell).length;
      return [(cell%width+.7)*unit-(total-1-earlier)*22,(Math.floor(cell/width)+.74)*unit];
    });
    g.lineWidth=2.5;g.setLineDash([5,6]);g.strokeStyle="#4c4650";g.beginPath();
    points.forEach(([x,y],i)=>{if(i) g.lineTo(x,y);else g.moveTo(x,y);});
    g.stroke();g.setLineDash([]);g.textAlign="center";g.textBaseline="middle";g.font="bold 15px "+sans;
    for (const [i,{step,tone}] of trail.entries()) {
      const [x,y]=points[i];g.beginPath();g.arc(x,y,11,0,2*Math.PI);g.fillStyle=tone===2 ? "#943d35" : "#315b73";g.fill();
      g.strokeStyle="#fff1cf";g.lineWidth=1.6;g.stroke();g.fillStyle="#fff6df";g.fillText(step,x,y);
    }
  }
  g.restore();
}

export function creaseList(desk,code) {
  return [...code].map(key=>desk.creases.find(c=>c.key===key).label).join("  ›  ");
}
export function foldSummary(desk,sheet,t) {
  return t("foldAt",{cell:coordinate(desk.board,desk.watch),shade:t("foldTone"+shadeAt(sheet,desk.watch))})
    +" · "+creaseList(desk,sheet.code);
}

// Print the actual flattened napkin. A companion sheet has the same crease
// multiset and a different ink at the window. Outline just the changed cells.
export function rainProof(desk,sheet,mate,t) {
  const sheets=mate ? [mate,sheet] : [sheet];
  const canvas=canvasOf(mate?1100:790,mate?564:624),g=canvas.getContext("2d");
  const pageW=canvas.width/sheets.length;
  g.fillStyle="#f6f0de";g.fillRect(0,0,canvas.width,canvas.height);
  const title=t(mate?"foldPairTitle":"foldTitle"),watch=coordinate(desk.board,desk.watch);
  g.fillStyle="#344a55";g.font="bold 28px "+serif;g.fillText(title,29,42);
  g.font="17px "+sans;g.textAlign="right";
  const diff=mate ? differences(desk,mate,sheet).length : 0;
  g.fillText(mate ? t("foldDiff",{n:diff}) : t("foldPostmark"),canvas.width-27,40);g.textAlign="left";
  sheets.forEach((s,i)=>{
    const board=canvasOf(600,500);drawRainSheet(board,desk,s,{old:mate ? sheets[1-i] : null});
    const bh=mate?360:422,bw=bh*desk.board.width/desk.board.height,x=i*pageW+(pageW-bw)/2,y=87;
    g.font="bold 18px "+sans;g.fillStyle=shadeAt(s,desk.watch)===2?red:blue;
    g.fillText(t("foldAt",{cell:watch,shade:t("foldTone"+shadeAt(s,desk.watch))}),x,y-18);
    g.drawImage(board,x,y,bw,bh);g.strokeStyle="#988972";g.lineWidth=2;g.strokeRect(x,y,bw,bh);
    g.fillStyle="#394a4c";g.font="17px "+sans;g.textAlign="center";
    for(let c=0;c<desk.board.width;c++)g.fillText(String.fromCharCode(65+c),x+(c+.5)*bw/desk.board.width,y+bh+19);
    for(let r=0;r<desk.board.height;r++)g.fillText(String(r+1),x-12,y+(r+.55)*bh/desk.board.height);
    g.font="bold 17px "+sans;g.fillText(creaseList(desk,s.code),i*pageW+pageW/2,y+bh+56,pageW-26);
    g.textAlign="left";
  });
  g.fillStyle="#52615c";g.font="17px "+sans;g.fillText(t(mate?"foldPairLegend":"foldLegend"),25,canvas.height-18);
  canvas.setAttribute("role","img");canvas.setAttribute("aria-label",[title,...sheets.map(s=>foldSummary(desk,s,t))].join(" · "));
  return canvas;
}

export function animatePress(layer,desk,before,after,crease) {
  if (document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return ()=>{};
  const old=canvasOf(600,500),fresh=canvasOf(600,500);
  drawRainSheet(old,desk,before);drawRainSheet(fresh,desk,after);
  const w=old.width,h=old.height;layer.width=w;layer.height=h;layer.hidden=false;
  const g=layer.getContext("2d"),vertical=crease.vertical,seam=crease.line*unit,length=vertical?w:h;
  const left=seam<=length-seam,begin=left?0:seam,end=left?seam:length;
  const bounds=vertical ? [begin,0,end-begin,h] : [0,begin,w,end-begin];
  const start=performance.now();let handle;
  function stop() {cancelAnimationFrame(handle);layer.hidden=true;}
  function draw(now) {
    const t=(now-start)/490;
    if (t>=1 || document.hidden) {stop();return;}
    const scale=Math.cos(Math.PI*Math.sin(t*Math.PI));
    g.drawImage(t<.5 ? old : fresh,0,0);
    g.fillStyle="#ddd1b7";g.fillRect(...bounds);g.save();
    g.translate(vertical?seam:0,vertical?0:seam);g.scale(vertical?scale:1,vertical?1:scale);
    g.translate(vertical?-seam:0,vertical?0:-seam);
    g.drawImage(t<.5?old:fresh,...bounds,...bounds);
    g.fillStyle="rgba(69,62,69,"+(0.16*(1-scale))+")";g.fillRect(...bounds);g.restore();
    handle=requestAnimationFrame(draw);
  }
  draw(start);return stop;
}
