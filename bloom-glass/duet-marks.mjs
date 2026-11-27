import {lampNames,squareName} from './light-path.mjs';

// A blocked beam ends at the first empty cell. Only the interior of its
// recorded polyline contains glass actually illuminated by the lamp.
export function readMark(rays,width,cell){
  const lit=[],axes=[];
  for(const ray of rays){
    let present=false,directions=0;
    for(let i=1;i<ray.points.length-1;i++){
      const [x,y]=ray.points[i];if(y*width+x!==cell)continue;
      present=true;
      const previous=ray.points[i-1],next=ray.points[i+1];
      if(previous[1]===next[1])directions|=1;
      if(previous[0]===next[0])directions|=2;
    }
    lit.push(present);axes.push(directions);
  }
  const crossed=Boolean((axes[0]&1) && (axes[1]&2) || (axes[0]&2) && (axes[1]&1));
  return {lit,crossed};
}
export function acceptsMark(frame,width,rays){
  const m=frame.mark;if(!m || m.kind==='wait')return true;
  if(m.kind==='watermark')return readHoles(m,width,rays).ordered;
  const reading=readMark(rays,width,m.cell);
  return m.kind==='pass'?reading.crossed:reading.lit[m.lamp] && !reading.lit[1-m.lamp];
}
export function readHoles(mark,width,rays){
  const ray=rays[mark.lamp],path=ray.points.slice(1,-1).map(([x,y])=>y*width+x);
  if(mark.reverse)path.reverse();
  const [a,b]=mark.cells,first=path.indexOf(a),second=path.indexOf(b);
  return {lit:[first>=0,second>=0],ordered:(!mark.reverse || Boolean(ray.exit)) && first>=0 && path.indexOf(b,first+1)>=0};
}
export const versionOf=l=>l.play.delivery?.version??l.play.first;
export function carrierAt(level,index){
  const d=level.play.delivery;
  return index<d.pass || level.play.coda && index>=6?d.giver:1-d.giver;
}
export const cellName=(level,cell)=>squareName(cell%level.width,Math.floor(cell/level.width));
export const address=(level,mark)=>cellName(level,mark.cell);
export const holeNames=(l,m)=>m.cells.map(c=>cellName(l,c)).join(' → ');
export function activeMarks(frame,both){
  const all=frame?[frame.mark,...(both && frame.peerMark!==frame.mark?[frame.peerMark]:[])]:[];
  return all.filter(m=>m && (!both || m.kind!=='wait'));
}
export function markTask(level,mark){
  if(!mark)return '';
  const p=level.play,d=p.delivery;
  if(mark.kind==='watermark')return lampNames[mark.lamp]+(mark.reverse?'从出口倒读 ':'从入口顺读 ')+holeNames(level,mark);
  const at=address(level,mark);
  if(mark.kind==='wait')return '留到'+d.stops[1]+' · '+p.names[d.giver]+'继续拿'+d.prop;
  if(mark.kind==='pass')return at+' 交接眼 · 两灯一横一竖直穿';
  return at+' '+d.seals[mark.lamp]+' · 只让'+lampNames[mark.lamp]+'照印';
}
export function markReading(level,mark,rays){
  if(!mark || mark.kind==='wait')return '';
  if(mark.kind==='watermark'){
    const {lit,ordered}=readHoles(mark,level.width,rays),[a,b]=mark.cells.map(c=>cellName(level,c));
    if(ordered)return lampNames[mark.lamp]+'依次照过 '+a+'、'+b+'，水印可读';
    if(mark.reverse && !rays[mark.lamp].exit)return lampNames[mark.lamp]+'尚未出光，接通出口后可倒读';
    if(lit.every(Boolean))return '两孔都亮了，读序颠倒。请先过 '+a+'，再过 '+b;
    return '还要照亮 '+[a,b].filter((_,i)=>!lit[i]).join('、');
  }
  const at=address(level,mark),{crossed,lit}=readMark(rays,level.width,mark.cell);
  if(mark.kind==='pass')return at+(crossed?' 已十字相交，可以'+(mark.action||level.play.delivery.verb):' 还差十字交光，要有一束横穿、一束竖穿');
  if(lit[0] && lit[1])return at+' 双灯叠印，移开'+lampNames[1-mark.lamp];
  if(!lit[mark.lamp])return at+(lit[1-mark.lamp]?' 照错了印，请换成':' 印位还暗，请引来')+lampNames[mark.lamp];
  return at+' 单灯照印，'+level.play.delivery.seals[mark.lamp]+'已对准';
}
export function propRecord(level,index){
  const p=level.play,d=p.delivery,m=p.frames[index].mark,holder=p.names[carrierAt(level,index)];
  if(m?.kind==='watermark')return p.names[m.lamp]+(m.reverse?'倒读 ':'顺读 ')+holeNames(level,m);
  if(p.coda && index===6)return address(level,m)+' 回签 · '+p.names[1-d.giver]+' → '+holder;
  if(m?.kind==='pass')return address(level,m)+' 交接 · '+p.names[d.giver]+' → '+holder;
  if(m?.kind==='stamp')return address(level,m)+' 单灯盖印 · '+d.seals[m.lamp];
  if(m?.kind==='wait')return d.stops[0]+'留件 · '+holder+'续带';
  return holder+'带'+d.prop+(index===4?'抵达':'');
}
