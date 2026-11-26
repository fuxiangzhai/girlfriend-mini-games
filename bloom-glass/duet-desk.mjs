import {duetCasts,relayCasts,isDuet,orderName,partnerOrder,programmes} from './duet-plays.mjs';
import {address,carrierAt,markReading,markTask,versionOf} from './duet-marks.mjs';
import {changeTotal,doubleBill,handStatus,playbill,quietScore,remainingCost,savedOrder} from './slip-path.mjs';
import {moveScreen} from './slip-screen.mjs';
import {readProjector} from './projection.mjs';
import {read,write} from './save.mjs';
import {portName} from './light-path.mjs';

const $=id=>document.getElementById(id);
const lastScene=l=>l.play.frames.at(-1).scenes[0];
export const bestShow=l=>playbill(l,lastScene(l));
export const resumeProgramme=l=>isDuet(l) && savedOrder(l)!==versionOf(l)?partnerOrder(l):l;
export function lastDuet(relay=false){
  const casts=relay?relayCasts:duetCasts,id=read(relay?'relay:active':'duet:active');
  return resumeProgramme(casts.find(pair=>pair[0].play.id===id)?.[0]||casts[0][0]);
}
export function openingForecast(level,board,quiet,both=false){
  const first=programmes[level.showIndex],cast=[first,partnerOrder(first)];
  const prices=[];
  const lines=cast.map(l=>{
    const bill=remainingCost(l,[],board,both);
    if(!bill)return orderName(l)+'接不到'+(both?'两印底谱':'收场');
    prices.push(orderName(l)+' '+bill.total+' 响');
    return orderName(l)+(quiet && bill.total>quietScore(l).target?'能收场，静场要改开场':'可以'+(both?'兼演':quiet?'静场':'收场'));
  });
  return lines.join('。')+'。'+(prices.length?'这套开场的全剧最低换片数为'+prices.join('、')+'。':'');
}
export function duetBills(casts=duetCasts){
  let total=0;
  $(casts===relayCasts?'relay-tickets':'duet-tickets').innerHTML=casts.map(pair=>{
    const buttons=pair.map(l=>{
      const record=bestShow(l);if(record)total++;
      const cost=record?changeTotal(l,record):null;
      return '<button type="button" data-duet-bill="'+l.showIndex+'" data-first="'+versionOf(l)+'" '+(record?'':'disabled')+'>'+orderName(l)+
        '<small>'+(record?'全剧 '+cost+' 响'+(cost===quietScore(l).target?' · 已收静场笺':''):'尚未收录')+'</small></button>';
    });
    const doubles=casts===relayCasts?pair.map(l=>doubleBill(l)):[],available=doubles.flatMap((t,i)=>t?[i]:[]);
    available.sort((a,b)=>changeTotal(pair[a],doubles[a])-changeTotal(pair[b],doubles[b]));
    const i=available[0],button=i==null?'':'<button type="button" class="read-double" data-duet-bill="'+pair[i].showIndex+'" data-first="'+i+'" data-double>翻两印底谱 · '+changeTotal(pair[i],doubles[i])+' 响</button>';
    return '<div class="duet-bill"><strong>'+pair[0].title+'</strong><div>'+buttons.join('')+'</div>'+button+'</div>';
  }).join('');
  return total;
}
export function setupDuetControls(changeOrder,updateGoal,readBill){
  let level,quiet=false,both=false,stage;
  $('duet-buttons').onclick=e=>{
    const b=e.target.closest('[data-mover]');if(b && !b.disabled && +b.dataset.mover!==versionOf(level))changeOrder(partnerOrder(level));
  };
  $('quiet-aim').onchange=()=>{
    quiet=$('quiet-aim').checked;
    if(quiet && both){both=false;$('both-marks').checked=false;write('relay:both:'+level.play.id,false);}
    write('duet:quiet:'+level.play.id,quiet);updateGoal(quiet,both);
  };
  $('both-marks').onchange=()=>{
    both=$('both-marks').checked;
    if(both && quiet){quiet=false;$('quiet-aim').checked=false;write('duet:quiet:'+level.play.id,false);}
    write('relay:both:'+level.play.id,both);updateGoal(quiet,both);
  };
  $('duet-tickets').onclick=$('relay-tickets').onclick=e=>{
    const b=e.target.closest('[data-duet-bill]');if(!b || b.disabled)return;
    const base=programmes[+b.dataset.duetBill],l=+b.dataset.first?partnerOrder(base):base,shared=b.hasAttribute('data-double');
    const record=shared?doubleBill(l):bestShow(l);if(record)readBill(l,record,shared);
  };
  function configure(l,screen){
    level=l;stage=screen;const duet=isDuet(l);
    for(const id of ['duet-order','duet-live','quiet-score','duet-guide'])$(id).hidden=!duet;
    const d=l.play?.delivery;
    $('relay-goal').hidden=$('relay-cue').hidden=!d;
    if(!duet){quiet=both=false;return;}
    write(d?'relay:active':'duet:active',l.play.id);
    both=Boolean(d && read('relay:both:'+l.play.id)===true);$('both-marks').checked=both;
    quiet=!both && read('duet:quiet:'+l.play.id)===true;$('quiet-aim').checked=quiet;
    $('duet-choice-label').textContent=d?'在哪一站'+d.verb:'谁先动';
    const labels=d?d.stops.map(s=>s+d.verb):l.play.names.map(n=>n+'先动');
    $('duet-buttons').innerHTML=labels.map((label,i)=>'<button type="button" data-mover="'+i+'" aria-pressed="'+(i===versionOf(l))+'">'+label+'</button>').join('');
    $('duet-guide').querySelector('p').innerHTML=d?'<strong>递物返场</strong>'+l.projection.cue+' 「排一谱两印」会同时检查早、晚两套灯位。':'<strong>双片合演</strong>琥珀和青瓷各照一个角色。选谁先动，就先守另一盏灯。「探后场」可查眼前镜位的全剧最低响数。开场免费，之后每换一片记一响。';
  }
  function paint(takes,hold,board,result){
    if(!isDuet(level))return;
    const p=level.play,d=p.delivery,ended=takes.length===p.frames.length,moved=hold?handStatus(level,hold,board).changed.length:0;
    for(const b of $('duet-buttons').children)b.disabled=takes.length>1 || !d && moved>0;
    if(d){
      const stamp=p.frames[2].mark;
      $('duet-order-note').textContent='第三拍由'+p.names[stamp.lamp]+'在 '+address(level,stamp)+' 盖'+d.seals[stamp.lamp]+'。'+(takes.length>1?'倒回第二拍可以改站。':'第二拍落片前可改站。');
    }else{
      $('duet-order-note').textContent=takes.length>1?'先手已演。想改顺序，可以倒回开场结束时。':moved?'本拍已有玻璃离开原位。按原样放回，或点「重排」，就能改先手。':
        '琥珀照'+p.names[0]+'，青瓷照'+p.names[1]+'。谁先动，就先守另一盏灯。';
    }
    const paid=changeTotal(level,takes),target=quietScore(level,both).target;
    $('quiet-count').textContent='已记 '+paid+' 响'+(hold?' · 本拍暂记 +'+moved:'')+' / '+(both?'兼演最低 ':'目标 ')+target+' 响';
    $('quiet-aim').disabled=$('both-marks').disabled=ended;
    const last=Math.max(0,takes.length-1);
    if(d){
      const holder=p.names[carrierAt(level,last)],frame=p.frames[takes.length],marks=frame?[frame.mark,...(both?[frame.peerMark]:[])].filter(m=>m && (!both || m.kind!=='wait')):[];
      $('relay-owner').textContent=holder+'持'+d.prop;
      $('relay-task').textContent=marks.map(m=>markTask(level,m)).join(' ／ ') || (ended?'已送达':'琥珀照'+p.names[0]+'，青瓷照'+p.names[1]);
      $('relay-reading').textContent=result?marks.map(m=>markReading(level,m,result.rays)).filter(Boolean).join('。'):'';
    }
    if(ended){$('duet-live').textContent='已落幕 · '+orderName(level);return;}
    if(!result){
      const previous=takes.at(-1),scene=previous?level.projection.scenes[readProjector(level,previous).scene]:null;
      moveScreen(stage,scene?.pose,scene?.partnerPose,last);
      $('slip-small-screen').setAttribute('aria-label',p.backdrop+'，'+(scene?.title||'等待开场'));
      $('duet-live').textContent='开启「试灯」，可看两张玻璃各自照到哪一站。';return;
    }
    const indices=result.rays.map((r,i)=>p.ports[i].indexOf(r.exit));
    moveScreen(stage,p.poses[0][indices[0]],p.poses[1][indices[1]],last);
    const text=indices.map((idx,i)=>p.names[i]+(idx<0?'待灯':'在'+portName(p.ports[i][idx]))).join('　·　');
    $('duet-live').textContent='试灯　'+text;$('slip-small-screen').setAttribute('aria-label',p.backdrop+'，'+text);
  }
  return {configure,paint,quiet:()=>quiet,both:()=>both};
}
