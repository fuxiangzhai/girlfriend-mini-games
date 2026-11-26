import {read,write} from './save.mjs';
import {restoreRoll,spentTurns} from './film-path.mjs';
import {falls,inspectNight,lampNames,motifs,portName,squareName} from './light-path.mjs';
import {drawLampBoard} from './lamp-glass.mjs';
import {rolls} from './film-rolls.mjs';

const $=id=>document.getElementById(id);
export const frameNo=i=>['第一帧','第二帧','第三帧'][i];
const artStyle=frames=>'--strip-size:'+(frames*100)+'%';
const crop=(count,index)=>'--crop:'+(index*100/(count-1))+'%';
const setImage=(node,path)=>node.style.setProperty('--roll-image','url("'+path+'")');

export function bestRecord(roll) {
  // Separate receipts keep a slower replay in another tab from overwriting the best strip.
  const limit=roll.frames.reduce((n,f)=>n+(f.limit||0),0);
  for(let n=roll.par;n<=limit;n++) if(read('roll:score:'+roll.id+':'+n)===true) return n;
  return null;
}
export function keepStrip(roll,shots) {
  if(shots.length!==roll.frames.length) return;
  const mark=roll.id+':'+spentTurns(shots);
  write('roll:negative:'+mark,[...shots]);
  write('roll:score:'+mark,true);
}
export function bestStrip(roll) {
  const best=bestRecord(roll);
  if(best===null) return null;
  const raw=read('roll:negative:'+roll.id+':'+best);
  const {shots}=restoreRoll(roll,{shots:raw});
  return shots.length===roll.frames.length && spentTurns(shots)===best?shots:null;
}
export function changeRule(frame) {
  if(!frame.limit) return '开场自由调镜';
  const locks=frame.controls.filter(c=>c.bit&frame.waxMask).flatMap(c=>c.panes.map(p=>squareName(p.x,p.y)));
  return '与上一帧最多相差 '+frame.limit+' 根轴'+(locks.length?'，'+locks.join('、')+' 已封蜡':'');
}
export function drawRollList(active) {
  $('roll-list').replaceChildren(...rolls.map((r,i)=>{
    const best=bestRecord(r),option=document.createElement('option');
    option.value=i; option.textContent='卷 '+(i+1)+'　'+r.title+(best===null?'':best===r.par&&r.challenge?' · 已读题字':' · 已冲洗');
    return option;
  }));
  $('roll-list').value=String(rolls.indexOf(active));
}
export function drawStrip(roll,shots,view,art,plans) {
  const strip=$('take-strip'),count=roll.frames.length;
  setImage(strip,art(roll.id)); strip.style.setProperty('--strip-size',(count*100)+'%');
  strip.innerHTML=roll.frames.map((f,i)=>{
    const shot=i<shots.length,label=shot?'已拍':i===shots.length?'正在拍':plans?.[i]?'有草稿':'可预看';
    return '<button type="button" data-view="'+i+'" aria-pressed="'+(view===i)+'"><span class="frame-thumb '+(shot?'developed-frame':'film-back')+'" style="'+crop(count,i)+'" aria-hidden="true">'+(shot?'':String(i+1).padStart(2,'0'))+'</span><span class="frame-meta"><small>'+frameNo(i)+' · '+label+'</small><strong>'+f.name+'</strong></span></button>';
  }).join('');
  $('take-count').textContent='已拍 '+shots.length+' / '+count+' 帧';
}
export function drawFilmAlbum(art) {
  const completed=rolls.filter(r=>bestRecord(r)!==null);
  const notes=completed.filter(r=>r.challenge && bestRecord(r)===r.par).length;
  $('roll-count').textContent=completed.length+' / '+rolls.length+' 卷　题字 '+notes+' / '+rolls.filter(r=>r.challenge).length;
  $('roll-prints').innerHTML=completed.map(r=>{
    const best=bestRecord(r),count=r.frames.length;
    return '<article class="contact-page" data-print="'+r.id+'" style="'+artStyle(count)+'"><header><h4>'+r.title+'</h4><span>最佳调镜 '+best+' 次</span></header><div class="proof-photos">'+
      r.frames.map((f,i)=>'<button type="button" data-photo="'+i+'" aria-label="放大照片，'+f.name+'"><span class="developed-frame" style="'+crop(count,i)+'"></span><span>'+f.name+'</span></button>').join('')+
      '</div><p>'+(!r.challenge || best===r.par?r.note:'用 '+r.par+' 次调镜拍完整卷，可以读到照片背面的题字。')+'</p>'+
      (bestStrip(r)?'<button type="button" class="subtle proof-open" data-replay>复看最佳灯路</button>':'')+'</article>';
  }).join('') || '<p class="empty-film">拍完第一卷，这里就会留下完整的连拍。每一格都可以放大重看。</p>';
  for(const node of $('roll-prints').children) if(node.dataset.print) setImage(node,art(node.dataset.print));
}
export function openPhoto(roll,initial,art,{shots=null,replay=false,button='收好照片'}={}) {
  let i=initial,light=replay && Boolean(shots);
  const picture=$('photo-image'),count=shots?.length??roll.frames.length;
  function render() {
    const frame=roll.frames[i];
    $('photo-roll').textContent=roll.title+' · '+frameNo(i); $('photo-title').textContent=frame.name;
    picture.style.cssText=artStyle(roll.frames.length)+';'+crop(roll.frames.length,i);
    setImage(picture,art(roll.id)); picture.setAttribute('aria-label',frame.caption);
    $('photo-caption').textContent=frame.caption; $('photo-return').textContent=button;
    $('photo-views').hidden=!shots; picture.hidden=light; $('proof-view').hidden=!light;
    for(const tab of $('photo-views').children) tab.setAttribute('aria-pressed',String((tab.dataset.proof==='rays')===light));
    $('photo-paging').hidden=count<2; $('photo-prev').disabled=i===0; $('photo-next').disabled=i===count-1;
    if(!light) return;
    const mask=i===0?0:shots[i]^shots[i-1],result=inspectNight(frame,shots[i]);
    drawLampBoard($('proof-board'),null,frame,shots[i],result,-1,0,null,mask);
    const turned=roll.controls.filter(c=>mask&c.bit).map(c=>c.panes.map(p=>squareName(p.x,p.y)).join('、'));
    $('proof-changes').textContent=i===0?'开场定镜，不计调镜次数。':'这帧改了 '+turned.length+' 根轴。金色虚线标出了 '+turned.join(' 和 ')+'。';
    $('proof-angles').textContent=[...frame.panes.values()].map(p=>squareName(p.x,p.y)+(falls(p,shots[i])?' 左上至右下':' 左下至右上')).join('，')+'。';
    $('proof-lamps').replaceChildren(...result.rays.map((ray,n)=>{
      const row=document.createElement('p'),via=ray.flowers.map(f=>motifs[f]).join(' → ');
      row.textContent=lampNames[n]+'（'+(n?'虚线':'实线')+'）　'+portName(frame.lamps[n].entry)+' → '+(via?via+' → ':'')+portName(ray.exit);
      return row;
    }));
  }
  $('photo-views').onclick=e=>{const b=e.target.closest('[data-proof]'); if(b) {light=b.dataset.proof==='rays';render();}};
  $('photo-prev').onclick=()=>{if(i>0) {i--;render();}};
  $('photo-next').onclick=()=>{if(i<count-1) {i++;render();}};
  $('proof-orientation').open=false; render();
  $('photo-dialog').showModal(); $('photo-return').focus();
}
