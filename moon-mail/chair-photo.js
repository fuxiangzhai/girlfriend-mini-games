import { coordinate } from "./chart.js";
import { portraitStyle } from "./chair-portraits.mjs";

// Use the harbour and the hanging prints from this letter's own illustration.
// The foreground is drawn from the seats on the floor at each actual shutter.
const backdrops = new Map();
function background(src) {
  if (!backdrops.has(src)) {
    const img=new Image(); img.src=src;
    backdrops.set(src,{img,ready:img.decode().then(()=>img,()=>null)});
  }
  return backdrops.get(src);
}

function painted(canvas, src, draw) {
  const entry=background(src);
  const version=(canvas.paintVersion ?? 0)+1; canvas.paintVersion=version;
  if (entry.img.complete && entry.img.naturalWidth) {
    draw(entry.img); canvas.paintReady=Promise.resolve(); return;
  }
  draw(null);
  canvas.paintReady=entry.ready.then(img=>{if (canvas.paintVersion===version && img) draw(img);});
}

function timberChair(ctx, type, x, y, size) {
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  const wood=type===0 ? "#ae7843" : "#58787a", edge=type===0 ? "#462f24" : "#273f45", light=type===0 ? "#e0b679" : "#a8bab0";
  function stroke(points,width,color) {
    ctx.beginPath();points.forEach(([u,v],i)=>i ? ctx.lineTo(u,v) : ctx.moveTo(u,v));
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  ctx.fillStyle="rgba(21,26,26,.32)";ctx.beginPath();ctx.ellipse(6,-1,23,4,-.07,0,2*Math.PI);ctx.fill();
  ctx.lineCap="round";ctx.lineJoin="round";
  for (const [u,v,end] of [[-13,-23,-15],[7,-25,9],[-5,-18,-7],[18,-20,20]]) {
    stroke([[u,v],[end,-1]],3.2,edge);stroke([[u-.35,v],[end-.35,-2]],1.1,wood);
  }
  ctx.beginPath();ctx.moveTo(-15,-25);ctx.lineTo(6,-28);ctx.lineTo(20,-21);ctx.lineTo(-4,-17);ctx.closePath();
  ctx.fillStyle=wood;ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=1.6;ctx.stroke();
  stroke([[-12,-24],[5,-26],[15,-21]],1,light);
  if (type===0) {
    ctx.beginPath();ctx.moveTo(-14,-24);ctx.bezierCurveTo(-15,-35,-23,-56,-10,-60);
    ctx.bezierCurveTo(6,-65,8,-54,7,-27);ctx.strokeStyle=edge;ctx.lineWidth=4.3;ctx.stroke();
    ctx.strokeStyle=wood;ctx.lineWidth=2.3;ctx.stroke();
    for (let k=0;k<4;k++) stroke([[-13+5*k,-53-k%2],[-10+4*k,-26]],1.9,light);
    for (let k=0;k<4;k++) stroke([[-12,-48+k*4],[4,-50+k*4]],.8,wood);
  } else {
    for (const [u,v] of [[-13,-24],[7,-27]]) {
      stroke([[u,v],[u-3,v-33]],4.5,edge);stroke([[u,v],[u-3,v-33]],2.8,wood);
    }
    for (const v of [-53,-43,-34]) {
      stroke([[-15,v],[5,v-3]],4.2,wood);stroke([[-15,v-1],[5,v-4]],.9,light);
    }
  }
  ctx.restore();
}

function scene(ctx, room, seats, img) {
  const W=300,H=190;
  ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
  ctx.fillStyle="#30495a";ctx.fillRect(0,0,W,H);
  if (img) ctx.drawImage(img,0,0,img.naturalWidth,img.naturalHeight*.59,0,0,W,90);
  const floor=ctx.createLinearGradient(0,85,0,H);
  floor.addColorStop(0,"#705e49");floor.addColorStop(.45,"#a98b66");floor.addColorStop(1,"#79634c");
  ctx.fillStyle=floor;ctx.fillRect(0,91,W,99);
  ctx.fillStyle="#5a5146";ctx.fillRect(0,88,W,4);
  ctx.fillStyle="#b39a70";ctx.fillRect(0,88,W,1.3);
  ctx.strokeStyle="#463f386c";ctx.lineWidth=1;
  for(let x=-140;x<=450;x+=38) {
    ctx.beginPath();ctx.moveTo(149+(x-149)*.34,91);ctx.lineTo(x,H);ctx.stroke();
  }
  for(const y of [94,103,118,139,169]) {ctx.fillStyle="#4f443951";ctx.fillRect(0,y,W,1);}
  ctx.fillStyle="rgba(247,202,120,.10)";ctx.beginPath();ctx.moveTo(62,91);ctx.lineTo(181,91);ctx.lineTo(118,H);ctx.lineTo(0,H);ctx.fill();
  const lamp=ctx.createRadialGradient(73,108,3,73,119,124);
  lamp.addColorStop(0,"#f8cf8b38");lamp.addColorStop(1,"#f8cf8b00");
  ctx.fillStyle=lamp;ctx.fillRect(0,92,W,H-92);
  // Grain stays on the floor while the chairs move between the frames.
  for (let i=0;i<250;i++) {
    const x=(i*109)%303, y=94+((i*i*17+i*13)%97);
    ctx.fillStyle=i%3 ? "#53422f22" : "#f7d49a28";ctx.fillRect(x,y,1.4+i%4,.53);
  }
  const {width,height}=room.board, cam=room.camera;
  const fx=width/2-.5-cam%width, fy=height/2-.5-Math.floor(cam/width);
  const norm=Math.hypot(fx,fy);
  const projection=c=>{
    const dx=c%width-(width-1)/2,dy=Math.floor(c/width)-(height-1)/2;
    return [(dy*fx-dx*fy)/norm,(dx*fx+dy*fy)/norm];
  };
  const corners=[0,width-1,(height-1)*width,height*width-1].map(projection);
  const lateral=Math.max(...corners.map(p=>p[0])),depth=Math.max(...corners.map(p=>p[1]));
  const chairs=seats.map((cell,type)=>{
    const [across,away]=projection(cell), far=(away/depth+1)/2;
    return {type, x:150+across/lateral*(124-26*far), y:178-far*58,size:1.04-far*.39};
  });
  chairs.sort((a,b)=>a.y-b.y).forEach(c=>timberChair(ctx,c.type,c.x,c.y,c.size));
  const vignette=ctx.createRadialGradient(151,99,73,151,99,184);
  vignette.addColorStop(0,"rgba(21,24,24,0)");vignette.addColorStop(1,"rgba(26,23,23,.37)");
  ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  ctx.restore();
}

export function showStill(canvas, room, seats, src, compare, split=50) {
  const token=[room.camera,seats,compare,split].join("|");
  if (canvas.stillToken===token && canvas.stillSource===src) return;
  canvas.stillToken=token;canvas.stillSource=src;
  canvas.width=420;canvas.height=266;
  painted(canvas,src,img=>{
    const ctx=canvas.getContext("2d");ctx.save();ctx.scale(1.4,1.4);scene(ctx,room,seats,img);
    if (compare) {
      const at=3*split;ctx.save();ctx.beginPath();ctx.rect(0,0,at,190);ctx.clip();
      scene(ctx,room,compare,img);ctx.restore();
      ctx.fillStyle="#fff2c9";ctx.fillRect(at-1,0,2,190);
    }
    ctx.restore();
  });
}

export function chairSummary(room, film, t) {
  const locs=film.frames.map(f=>f.seats.map(c=>coordinate(room.board,c)).join(" / "));
  return t("chairCaption",{n:film.count})+" · "+locs.join(" › ");
}

export function contactPrint(room, film, src, t) {
  const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=372;
  const style=portraitStyle(film);
  canvas.setAttribute("role","img");canvas.setAttribute("aria-label",t("chairStyle_"+style)+" · "+chairSummary(room,film,t));
  painted(canvas,src,img=>{
    const ctx=canvas.getContext("2d");ctx.fillStyle="#ece6d5";ctx.fillRect(0,0,1000,372);
    const label=(text,x,y,size,color="#363e40",bold=false)=>{
      ctx.fillStyle=color;ctx.font=(bold?"600 ":"")+size+"px system-ui,sans-serif";ctx.fillText(text,x,y);
    };
    label(t("chairStyle_"+style),24,39,25,"#3f4243",true);
    label(t("chairCaption",{n:film.count}),700,38,17);
    ctx.fillStyle="#292b2c";ctx.fillRect(14,57,972,259);
    for (let x=21;x<979;x+=21) {
      ctx.fillStyle="#ede2c5";ctx.fillRect(x,63,10,5);ctx.fillRect(x,304,10,5);
    }
    film.frames.forEach((frame,i)=>{
      const left=27+i*323;
      ctx.save();ctx.translate(left,85);ctx.scale(1.02,1.02);scene(ctx,room,frame.seats,img);ctx.restore();
      label(String(i+1).padStart(2,"0")+"   "+frame.seats.map(c=>coordinate(room.board,c)).join(" / "),left+2,296,13,"#f5d394");
      label(t("chairFrame"+i),left+1,345,18,"#394c50",true);
      label(t("chairCaption",{n:frame.count}),left+145,345,14);
    });
  });
  return canvas;
}
