import { fronds, dose, shades } from "./sunprints.mjs";
import { coordinate } from "./chart.js";

const stock = ["#f5f2da", "#92b8cb", "#143e67"];
function canvas(width, height) {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  return el;
}

function ribbonBlade(ctx, points) {
  const spine = [];
  for (let i=0; i<points.length-1; i++) {
    const a=points[Math.max(0,i-1)], b=points[i], c=points[i+1], d=points[Math.min(i+2,points.length-1)];
    for (let k=0; k<12; k++) {
      const u=k/12, v=u*u, w=v*u;
      spine.push(b.map((n,j) => .5*((2*n)+(-a[j]+c[j])*u+(2*a[j]-5*n+4*c[j]-d[j])*v+(-a[j]+3*n-3*c[j]+d[j])*w)));
    }
  }
  spine.push(points.at(-1));
  const left=[], right=[];
  for (const [i,[x,y]] of spine.entries()) {
    const u=i/(spine.length-1);
    const prev=spine[Math.max(0,i-1)], next=spine[Math.min(spine.length-1,i+1)];
    const dx=next[0]-prev[0], dy=next[1]-prev[1], len=Math.hypot(dx,dy);
    const width=.018+.145*Math.sin(Math.PI*u)**.73*(1+.23*Math.sin(29*u));
    left.push([x-dy/len*width,y+dx/len*width]);
    right.push([x+dy/len*width,y-dx/len*width]);
  }
  ctx.beginPath();ctx.moveTo(...left[0]);
  for (const p of left.slice(1)) ctx.lineTo(...p);
  for (const p of right.reverse()) ctx.lineTo(...p);
  ctx.closePath();ctx.fill();
}

function paintFrond(ctx, mount, species, color) {
  const { points, stems } = fronds[species];
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineCap = ctx.lineJoin = "round";
  const point = n => [points[n][0] * mount.face, points[n][1]];
  ctx.beginPath(); ctx.arc(0,0,.085,0,Math.PI*2); ctx.fill();
  if (species === 0) {
    ribbonBlade(ctx,stems[0].map(point));
    return;
  }
  for (const stem of stems) for (let j = 1; j < stem.length; j++) {
    const [x, y] = point(stem[j - 1]), [u, v] = point(stem[j]);
    const angle = Math.atan2(v - y, u - x), length = Math.hypot(v - y, u - x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.lineWidth = .078-.007*j; ctx.beginPath(); ctx.moveTo(0,0);
    ctx.quadraticCurveTo(length*.54,.045,length,0); ctx.stroke();
    for (const side of [-1,1]) for (const along of [.14,.49]) {
      const offset=along+(side===1?.09:0);
      const reach=(.21+.065*Math.sin(j+along*7+side))*(j===1?.75:1);
      ctx.beginPath(); ctx.moveTo(length*offset,.018);
      ctx.bezierCurveTo(length*(offset+.06),side*.07,length*(offset+.10),side*reach,length*(offset+.28),side*(reach+.035));
      ctx.bezierCurveTo(length*(offset+.20),side*reach,length*(offset+.18),side*(reach-.04),length*(offset+.21),side*(reach-.09));
      ctx.bezierCurveTo(length*(offset+.31),side*(reach-.09),length*(offset+.34),side*(reach-.12),length*(offset+.36),side*(reach-.14));
      ctx.quadraticCurveTo(length*(offset+.15),side*.10,length*offset,.018); ctx.fill();
    }
    ctx.restore();
  }
}

function specimenLayer(board, pose, size, colors) {
  const layer = canvas(board.width * size, board.height * size), ctx = layer.getContext("2d");
  ctx.scale(size, size);
  ctx.beginPath();
  Array.from(board.tiles).forEach((tile, i) => { if (tile !== "#") ctx.rect(i % board.width, Math.floor(i / board.width), 1, 1); });
  ctx.clip();
  pose.fronds.forEach((mount, species) => {
    ctx.save();
    ctx.translate(mount.peg % board.width + .5, Math.floor(mount.peg / board.width) + .5);
    paintFrond(ctx, mount, species, colors[species]);
    ctx.restore();
  });
  return layer;
}

// Render both fronds into one opaque mask for each exposure before adding
// the light. Two stems crossing in one exposure leave just one impression.
export function paperImage(rack, first, second, size, mounted = false) {
  const { board } = rack;
  const image = canvas(board.width * size, board.height * size), ctx = image.getContext("2d");
  const wash = ctx.createLinearGradient(0,0,image.width,image.height);
  wash.addColorStop(0, "#123357"); wash.addColorStop(.55, "#205480"); wash.addColorStop(1,"#123c66");
  ctx.fillStyle = wash; ctx.fillRect(0,0,image.width,image.height);
  // Fixed paper grain stays registered between the two impressions.
  ctx.fillStyle = "rgba(224,239,227,.075)";
  for (let i=1; i<=290; i++) {
    const x=((i*137)%293)/293*image.width, y=((i*i*57+i*17)%307)/307*image.height;
    ctx.fillRect(x,y,(.007+(i%4)*.004)*size,.012*size);
  }
  if (mounted) {
    ctx.drawImage(specimenLayer(board, second, size, ["#f1cda2", "#a8ded8"]),0,0);
  } else {
    ctx.globalCompositeOperation = "lighter";
    for (const pose of [first, second]) {
      if (pose) ctx.drawImage(specimenLayer(board, pose, size, ["#71765d", "#71765d"]),0,0);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  return image;
}

export function printSummary(rack, proof, t) {
  const held = proof.first.fronds[proof.held], changed = 1 - proof.held;
  const at = mount => coordinate(rack.board, mount.peg) + (mount.face === 1 ? " →" : " ←");
  return t("sunImpression", { held: t("sunFrond" + proof.held), pin: at(held), moved: t("sunFrond" + changed),
    from: at(proof.first.fronds[changed]), to: at(proof.second.fronds[changed]) });
}

export function sunProof(rack, proof, mate, t) {
  const image = canvas(900, 410), ctx = image.getContext("2d");
  const pair = mate ? (proof.page === "left" ? [proof,mate] : [mate,proof]) : null;
  const swatches = rack.sensors.map((c,i) => String.fromCharCode(65+i) + " " + t("sunTone_" + shades[dose(proof.first,proof.second,c)]));
  image.setAttribute("role","img");
  image.setAttribute("aria-label", [t(pair ? "sunMatched" : "sunPage_" + proof.page), printSummary(rack,proof,t),
    ...swatches, ...rack.margins.map((c,i) => coordinate(rack.board,c) + " " + t("sunTone_" + shades[dose(proof.first,proof.second,c)])),
    mate ? printSummary(rack,mate,t) : ""].filter(Boolean).join(" · "));
  ctx.fillStyle = "#f5efde"; ctx.fillRect(0,0,900,410);
  ctx.strokeStyle = "#bbb596"; ctx.strokeRect(8,8,884,394);
  function panel(x,y,w,h,first,second) {
    ctx.fillStyle="#fff9e6"; ctx.fillRect(x-4,y-4,w+8,h+8);
    ctx.drawImage(paperImage(rack,first,second,65),x,y,w,h);
  }
  function label(value,x,y,size,bold=false,max=850) {
    ctx.font=(bold?"600 ":"")+size+"px system-ui,sans-serif"; ctx.fillStyle="#234356"; ctx.fillText(value,x,y,max);
  }
  label(t(pair ? "sunMatched" : "sunPage_"+proof.page),31,43,25,true);
  if (pair) {
    pair.forEach((p,i) => {
      const x=78+i*431;
      panel(x,70,300,250,p.first,p.second);
      label(t("sunPage_"+p.page),x,350,19,true);
      label(rack.margins.map(c => coordinate(rack.board,c)+" "+t("sunTone_"+shades[dose(p.first,p.second,c)])).join("    ·    "),x,380,17);
    });
  } else {
    panel(35,69,361,301,proof.first,proof.second);
    panel(439,88,184,153,null,proof.first); panel(662,88,184,153,null,proof.second);
    label(t("sunFirst"),439,271,18,true); label(t("sunSecond"),662,271,18,true);
    label(printSummary(rack,proof,t),438,318,16,false,419);
    for (let i=0;i<4;i++) {
      const x=441+(i%2)*218, y=341+Math.floor(i/2)*28;
      ctx.fillStyle=stock[rack.targets[i]];ctx.fillRect(x,y,13,13);ctx.strokeStyle="#687e83";ctx.strokeRect(x,y,13,13);
      label(swatches[i],x+22,y+12,15);
    }
  }
  return image;
}
