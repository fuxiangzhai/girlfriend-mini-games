import {duetCasts,isDuet,orderName,partnerOrder,programmes} from './duet-plays.mjs';
import {changeTotal,handStatus,playbill,quietScore,savedOrder,sightline} from './slip-path.mjs';
import {moveScreen} from './slip-screen.mjs';
import {readProjector} from './projection.mjs';
import {read,write} from './save.mjs';
import {portName} from './light-path.mjs';

const $=id=>document.getElementById(id);
const lastScene=l=>l.play.frames.at(-1).scenes[0];
export const bestShow=l=>playbill(l,lastScene(l));
export const resumeProgramme=l=>isDuet(l) && savedOrder(l)!==l.play.first?partnerOrder(l):l;
export function lastDuet(){
  const id=read('duet:active');
  return resumeProgramme(duetCasts.find(pair=>pair[0].play.id===id)?.[0]||duetCasts[0][0]);
}
export function openingForecast(level,board,quiet){
  const cast=duetCasts.find(pair=>pair[0].showIndex===level.showIndex);
  const lines=cast.map(l=>{
    const possible=sightline(l,[],board,lastScene(l)).possible;
    if(!possible)return orderName(l)+'接不到收场';
    return orderName(l)+(quiet && !sightline(l,[],board,lastScene(l),false,true).possible?'能收场，静场要改开场':'可以'+(quiet?'静场':'收场'));
  });
  return lines.join('。')+'。';
}
export function duetBills(){
  let total=0;
  $('duet-tickets').innerHTML=duetCasts.map(pair=>{
    const buttons=pair.map(l=>{
      const record=bestShow(l);if(record)total++;
      const cost=record?changeTotal(l,record):null;
      return '<button type="button" data-duet-bill="'+l.showIndex+'" data-first="'+l.play.first+'" '+(record?'':'disabled')+'>'+orderName(l)+
        '<small>'+(record?'全剧 '+cost+' 响'+(cost===quietScore(l).target?' · 已收静场笺':''):'尚未收录')+'</small></button>';
    });
    return '<div class="duet-bill"><strong>'+pair[0].title+'</strong><div>'+buttons.join('')+'</div></div>';
  }).join('');
  return total;
}
export function setupDuetControls(changeOrder,updateGoal,readBill){
  let level,quiet=false,stage;
  $('duet-buttons').onclick=e=>{
    const b=e.target.closest('[data-mover]');if(b && !b.disabled && +b.dataset.mover!==level.play.first)changeOrder(partnerOrder(level));
  };
  $('quiet-aim').onchange=()=>{
    quiet=$('quiet-aim').checked;write('duet:quiet:'+level.play.id,quiet);updateGoal(quiet);
  };
  $('duet-tickets').onclick=e=>{
    const b=e.target.closest('[data-duet-bill]');if(!b || b.disabled)return;
    const base=programmes[+b.dataset.duetBill],l=+b.dataset.first?partnerOrder(base):base,record=bestShow(l);
    if(record)readBill(l,record);
  };
  function configure(l,screen){
    level=l;stage=screen;const duet=isDuet(l);
    for(const id of ['duet-order','duet-live','quiet-score','duet-guide'])$(id).hidden=!duet;
    if(!duet){quiet=false;return;}
    write('duet:active',l.play.id);
    quiet=read('duet:quiet:'+l.play.id)===true;$('quiet-aim').checked=quiet;
    $('duet-buttons').innerHTML=l.play.names.map((name,i)=>'<button type="button" data-mover="'+i+'" aria-pressed="'+(i===l.play.first)+'">'+name+'先动</button>').join('');
  }
  function paint(takes,hold,board,result){
    if(!isDuet(level))return;
    const p=level.play,ended=takes.length===p.frames.length,moved=hold?handStatus(level,hold,board).changed.length:0;
    for(const b of $('duet-buttons').children)b.disabled=takes.length>1 || moved>0;
    $('duet-order-note').textContent=takes.length>1?'先手已演。想改顺序，可以倒回开场结束时。':moved?'本拍已有玻璃离开原位。按原样放回，或点「重排」，就能改先手。':
      '琥珀照'+p.names[0]+'，青瓷照'+p.names[1]+'。谁先动，就先守另一盏灯。';
    const paid=changeTotal(level,takes),target=quietScore(level).target;
    $('quiet-count').textContent='已记 '+paid+' 响'+(hold?' · 本拍暂记 +'+moved:'')+' / 目标 '+target+' 响';
    $('quiet-aim').disabled=ended;
    if(ended){$('duet-live').textContent='已落幕 · '+orderName(level);return;}
    if(!result){
      const previous=takes.at(-1),scene=previous?level.projection.scenes[readProjector(level,previous).scene]:null;
      moveScreen(stage,scene?.pose,scene?.partnerPose);
      $('slip-small-screen').setAttribute('aria-label',p.backdrop+'，'+(scene?.title||'等待开场'));
      $('duet-live').textContent='开启「试灯」，可看两张玻璃各自照到哪一站。';return;
    }
    const indices=result.rays.map((r,i)=>p.ports[i].indexOf(r.exit));
    moveScreen(stage,...indices.map((idx,i)=>p.poses[i][idx]));
    const text=indices.map((idx,i)=>p.names[i]+(idx<0?'待灯':'在'+portName(p.ports[i][idx]))).join('　·　');
    $('duet-live').textContent='试灯　'+text;$('slip-small-screen').setAttribute('aria-label',p.backdrop+'，'+text);
  }
  return {configure,paint,quiet:()=>quiet};
}
