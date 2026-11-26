import {lampNames,portName,portPoint,squareName} from './light-path.mjs';
import {markCell,mirrorFalls,shapeAt,transform} from './puzzle.mjs';

const colors=['#ffd071','#7de8ef'];
const unit=48;
const center=n=>(n+.5)*unit;
export const crossName=l=>squareName(l.projection.cross%l.width,Math.floor(l.projection.cross/l.width));
export const lampRoute=(level,scene)=>level.projection.entries.map((e,i)=>lampNames[i]+' '+portName(e)+' → '+portName(scene.exits[i])).join('　');

export function paneDescription(piece,o) {
  function offset(mark) {
    const [x,y]=transform(mark,o);
    const parts=[x?(x<0?'左':'右')+Math.abs(x)+'格':'',y?(y<0?'上':'下')+Math.abs(y)+'格':''].filter(Boolean);
    return parts.length?'在圆钉'+parts.join('、'):'在圆钉上';
  }
  return (piece.mirror?'银镜'+offset(piece.mirror.offset)+'，'+(mirrorFalls(piece.mirror.falls,o)?'左上连右下':'左下连右上')+'，':'')+
    (piece.star?'暗星'+offset(piece.star)+'，':'');
}

function portPosition(level,port) {
  const [x,y]=portPoint(level,port);
  const edge=(n,max)=>n<0?-12:n===max?max*unit+12:center(n);
  return [edge(x,level.width),edge(y,level.height)];
}

export function opticsOverlay(level,scene,result,filter=-1) {
  const {width,height,projection}=level, ports=[];
  for (const side of 'TBRL') {
    const count='TB'.includes(side)?width:height;
    for (let i=1;i<=count;i++) {
      const port=side+i,[x,y]=portPosition(level,port),lamp=projection.entries.indexOf(port),goal=scene.exits.indexOf(port);
      const color=colors[lamp>=0?lamp:goal];
      let plate='';
      if (lamp>=0) plate='<circle r="10" fill="'+color+'" stroke="#302b2b" stroke-width="1.5"/>';
      else if (goal>=0) plate='<rect x="-9" y="-9" width="18" height="18" rx="3" fill="#263543" stroke="'+color+'" stroke-width="2"/>';
      ports.push('<g transform="translate('+x+' '+y+')">'+plate+'<text text-anchor="middle" y="3.8" font-size="11" font-family="sans-serif" fill="'+(lamp>=0?'#23303d':goal>=0?color:'#dfd6bf')+'" font-weight="bold">'+i+'</text></g>');
    }
  }
  const marks=[];
  if (result) for (const [i,r] of result.rays.entries()) {
    if (filter>=0 && i!==filter) continue;
    const coords=r.points.map(([x,y],j)=>{
      if (j===0 || j===r.points.length-1 && r.exit) return portPosition(level,j===0?projection.entries[i]:r.exit);
      return [center(x),center(y)];
    });
    const points=coords.map(p=>p.join(',')).join(' '),dash=i?'stroke-dasharray="6 4"':'';
    marks.push('<g fill="none" stroke-linejoin="round" stroke-linecap="round"><polyline points="'+points+'" stroke="#233547" stroke-width="5.3" opacity=".83"/><polyline points="'+points+'" stroke="'+colors[i]+'" stroke-width="2.8" '+dash+'/></g>');
    if (r.blocked) {
      const [x,y]=coords.at(-1);
      marks.push('<circle cx="'+x+'" cy="'+y+'" r="4.8" fill="#273943" stroke="'+colors[i]+'" stroke-width="2"/>');
    }
  }
  if (projection.cross!=null) {
    const x=center(projection.cross%width),y=center(Math.floor(projection.cross/width));
    marks.push('<g transform="translate('+x+' '+y+')" fill="none"><circle r="13.8" stroke="#29383b" stroke-width="4"/><circle r="13.8" stroke="'+(result?.registered?'#eaffbd':'#fff0c6')+'" stroke-width="2" stroke-dasharray="7 3"/></g>');
  }
  const addresses=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)addresses.push('<text x="'+(x*unit+3)+'" y="'+(y*unit+9)+'" fill="#28343a" stroke="#fff4d5" stroke-width="1.9" paint-order="stroke" font-family="sans-serif" font-size="7.5">'+squareName(x,y)+'</text>');
  return '<g aria-hidden="true">'+addresses.join('')+marks.join('')+ports.join('')+'</g>';
}

function drawMap(ctx,level,slots,rays,x,y,w,h,mark) {
  const size=Math.min((w-40)/level.width,(h-36)/level.height);
  const left=x+(w-size*level.width)/2,top=y+(h-size*level.height)/2;
  ctx.fillStyle='#253941';ctx.fillRect(x,y,w,h);
  const xy=([a,b])=>[left+(a+.5)*size,top+(b+.5)*size];
  function line(points,color,thickness,dashes=[]) {
    ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
    ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.setLineDash(dashes);ctx.stroke();ctx.setLineDash([]);
  }
  slots.forEach((p,i)=>{
    const piece=level.pieces[i];
    for(const [dx,dy] of shapeAt(piece,p.o)) {
      const a=left+(p.x+dx)*size,b=top+(p.y+dy)*size;
      ctx.fillStyle=piece.mid;ctx.fillRect(a+1,b+1,size-2,size-2);
    }
    function point(mark){const at=markCell(level.width,mark,p);return xy([at%level.width,Math.floor(at/level.width)]);}
    if(piece.mirror){
      const [px,py]=point(piece.mirror.offset),d=size*.32,k=mirrorFalls(piece.mirror.falls,p.o)?d:-d;
      const ends=[[px-d,py-k],[px+d,py+k]];line(ends,'#263845',size*.12);line(ends,'#fffdeb',size*.055);
    }
    if(piece.star) {
      const [px,py]=point(piece.star);
      ctx.textAlign='center';ctx.fillStyle='#263744';ctx.font='bold '+Math.round(size*.55)+'px serif';ctx.fillText('✦',px,py+size*.2);ctx.textAlign='left';
    }
  });
  rays.forEach((r,i)=>{
    const path=r.points.map(xy).map(([a,b])=>[Math.max(x+4,Math.min(x+w-4,a)),Math.max(y+4,Math.min(y+h-4,b))]);
    line(path,'#293747',5);line(path,colors[i],3,i?[6,4]:[]);
  });
  const at=mark && mark.kind!=='wait'?mark.cell:level.projection.cross;
  if(at!=null){
    const [px,py]=xy([at%level.width,Math.floor(at/level.width)]);
    ctx.beginPath();
    if(mark?.kind==='stamp')ctx.rect(px-size*.28,py-size*.28,size*.56,size*.56);else ctx.arc(px,py,size*.29,0,Math.PI*2);
    ctx.strokeStyle='#243743';ctx.lineWidth=4;ctx.stroke();
    ctx.strokeStyle=mark?.kind==='stamp'?colors[mark.lamp]:'#f7f0cb';ctx.lineWidth=1.8;ctx.stroke();
    if(mark){
      ctx.font='bold '+Math.max(12,size*.22)+'px sans-serif';ctx.fillStyle='#233347';ctx.fillRect(px-size*.46,py-size*.48,size*.42,size*.25);
      ctx.fillStyle='#fff4db';ctx.fillText(squareName(at%level.width,Math.floor(at/level.width)),px-size*.44,py-size*.29);
    }
  }
}

export function drawTicketMap(canvas,level,receipt) {
  const ctx=canvas.getContext('2d');
  drawMap(ctx,level,receipt.slots,receipt.result.rays,0,0,canvas.width,canvas.height,receipt.mark);
}

export async function ticketImage(level,scene,receipt,src) {
  const image=new Image(); image.src=src; await image.decode();
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=720;
  const ctx=canvas.getContext('2d');
  const serif='"Songti SC","SimSun",serif',sans='"Microsoft YaHei","PingFang SC",sans-serif';
  const ink=(str,x,y,size,family=sans,color='#303b3c')=>{ctx.fillStyle=color;ctx.font=size+'px '+family;ctx.fillText(str,x,y);};
  ctx.fillStyle='#253941';ctx.fillRect(0,0,1200,720);
  ctx.fillStyle='#f9edcf';ctx.fillRect(15,15,1170,690);
  ctx.strokeStyle='#a78148';ctx.lineWidth=1.5;ctx.strokeRect(27,27,1146,666);
  ink('巷 口 幻 灯 会',49,75,33,serif);ink('PETAL PANES  /  MAGIC LANTERN',395,73,16,'Georgia,serif','#6e5738');
  const w=720,h=462,scale=Math.min(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;
  ctx.fillStyle='#25343a';ctx.fillRect(48,99,w,h);ctx.drawImage(image,48+(w-iw)/2,99+(h-ih)/2,iw,ih);
  ctx.strokeStyle='#917345';ctx.strokeRect(46,97,w+4,h+4);
  ink(scene.title,49,619,42,serif);
  const caption=receipt.result.star?scene.secret:scene.story;
  ctx.font='19px '+serif;
  let line='',baseline=650;
  for (const c of caption) {
    if(ctx.measureText(line+c).width>w && line){ink(line,49,baseline,19,serif);baseline+=26;line='';}
    line+=c;
  }
  ink(line,49,baseline,19,serif);
  ctx.save();ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(796,31);ctx.lineTo(796,690);ctx.stroke();ctx.restore();
  ink('放 映 存 根',824,75,26,serif);
  const no=String(level.showIndex+1).padStart(2,'0'),part=String.fromCharCode(65+receipt.result.scene);
  ink('NO. '+no+' / '+part,826,117,23,'Georgia,serif','#815b33');
  ink('当场镜位',825,171,22,serif);
  drawMap(ctx,level,receipt.slots,receipt.result.rays,824,192,318,243);
  level.projection.entries.forEach((e,i)=>ink(lampNames[i]+'    '+portName(e)+' → '+portName(scene.exits[i]),825,483+i*35,21,sans));
  ink(receipt.result.star?'✦  暗星加印':scene.secret?'普通票':'开场票',825,596,25,serif,'#814535');
  ink(level.title,825,641,20,serif);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('未能冲印戏票')),'image/png'));
}
