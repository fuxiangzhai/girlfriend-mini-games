import {bendName,cellName,markReading,pathTurn,readHoles} from './duet-marks.mjs';
import {drawReadingMap} from './lantern-glass.mjs';
import {lampNames,portName} from './light-path.mjs';
import {readProjector} from './projection.mjs';

// Scrub the light that is actually on the bench, including repeated visits.
// Changing the lamp or the board starts a fresh reading from the proper end.
export function setupPaperReader(){
  const $=id=>document.getElementById(id),box=$('paper-loupe'),walk=$('ray-walk');
  let level,board,rays,peer=false,points=[],second=-1;
  function paint(){
    if(!box.open || box.hidden || !board)return;
    const frame=level.play.frames[5],m=peer?frame.peerMark:frame.mark,ray=rays[m.lamp];
    points=m.reverse?(ray.exit?[...ray.points].reverse():[]):ray.points;
    const inner=points.slice(1,-1).map(([x,y])=>y*level.width+x),first=inner.indexOf(m.cells[0]);
    second=points.length?readHoles(m,level.width,rays).visit:-1;
    $('peek-mark').setAttribute('aria-pressed',String(peer));$('peek-mark').textContent=peer?'看本场印':'看另一印';
    $('loupe-lamp').textContent=(peer?'另一印 · ':'本场 · ')+lampNames[m.lamp]+(m.reverse?'从出口倒读':'从入口顺读');
    walk.max=String(Math.max(0,points.length-1));walk.disabled=points.length<2;
    $('seek-hole').disabled=second<0;const i=Math.min(+walk.value,+walk.max);
    let word;
    if(!points.length)word='这束灯尚未出光，接通出口后才能倒读。';
    else if(i===0)word=(m.reverse?'出口 ':'入口 ')+portName(m.reverse?ray.exit:level.projection.entries[m.lamp])+'，从这里起读。';
    else if(i===points.length-1)word=ray.exit?'读到另一端。'+markReading(level,m,rays):'前方的玻璃没有接通，光停在空格前。';
    else{
      const cell=inner[i-1],kind=pathTurn(points,i);
      word=cellName(level,cell)+(cell===m.cells[0]?' · 第一孔':cell===m.cells[1]?' · 第二孔':'')+'，实际'+(kind==='straight'?'直穿':bendName({bend:kind}))+'。';
      if(cell===m.cells[1])word+=first<0 || i<=first+1?'还未读过第一孔。':m.bend?'此孔应'+bendName(m)+'。':'双孔已依次读到。';
    }
    $('ray-word').textContent=word;walk.setAttribute('aria-valuetext',word);
    drawReadingMap($('loupe-map'),level,board,rays,m,points.slice(0,i+1));
  }
  box.ontoggle=()=>{if(box.open && !box.hidden && board){rays=readProjector(level,board).rays;paint();}};
  $('peek-mark').onclick=()=>{peer=!peer;walk.value='0';paint();};
  walk.oninput=paint;$('seek-hole').onclick=()=>{if(second>=0){walk.value=String(second);paint();walk.focus({preventScroll:true});}};
  return (l,takes,slots)=>{
    const active=Boolean(l.play?.coda && takes.length===5);
    if(!active || level!==l){box.open=false;peer=false;walk.value='0';board=null;}
    level=l;box.hidden=!active;if(!active || board===slots)return;
    board=slots;walk.value='0';
    if(box.open){rays=readProjector(l,slots).rays;paint();}
  };
}
