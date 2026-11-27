import {duetCasts,relayCasts,receiptCasts,insertCasts,receiptFor,fiveAct,isDuet,orderName,partnerOrder,programmes} from './duet-plays.mjs';
import {activeMarks,address,bendName,carrierAt,holeNames,markReading,markTask,versionOf} from './duet-marks.mjs';
import {changeTotal,deskAt,doubleBill,handStatus,hasPlayDraft,playbill,quietScore,remainingCost,restorePlay,savePlay,savedOrder,savedReading,setTrace,signedBill,usablePrefix} from './slip-path.mjs';
import {moveScreen} from './slip-screen.mjs';
import {readProjector} from './projection.mjs';
import {read,write} from './save.mjs';
import {lampNames,portName} from './light-path.mjs';
import {readingNames} from './receipt-plays.mjs';
import {foldScore,saveFoldDesk} from './fold-score.mjs';

const $=id=>document.getElementById(id);
const lastScene=l=>l.play.frames.at(-1).scenes[0];
export const bestShow=l=>playbill(l,lastScene(l));
export const resumeProgramme=l=>l.play?.coda?receiptFor(l,savedReading(l),savedOrder(l)):isDuet(l) && savedOrder(l)!==versionOf(l)?partnerOrder(l):l;
export function lastReceipt(insert=false){
  const id=read('receipt:active');
  const l=[...receiptCasts,...insertCasts].find(f=>f[0][0].play.id===id)?.[0][0]||receiptCasts[0][0][0];
  return enterReceipt(l,insert || l.play.coda.insert);
}
export function continueReceipt(base,record,insert=read('receipt:paper:'+receiptFor(base).showIndex)===true){
  const page=receiptFor(base,0,versionOf(base),insert),first=receiptFor(page,savedReading(page));
  const choices=[first,receiptFor(first,1-first.play.coda.mode)];
  const key=first.play.id,both=read('relay:both:'+key)===true,quiet=read('duet:quiet:'+key)===true;
  const plans=choices.map(l=>({l,keep:usablePrefix(l,record,both,quiet)}));
  const best=plans[1].keep>plans[0].keep?plans[1]:plans[0];
  setTrace(best.l,null);saveFoldDesk(best.l,null);savePlay(best.l,record.slice(0,best.keep),deskAt(best.l,record[best.keep]||record[best.keep-1]),[]);
  return best;
}
export function enterReceipt(l,insert=read('receipt:paper:'+l.showIndex)===true){
  l=receiptFor(l,l.play.coda.mode,versionOf(l),insert);
  if(hasPlayDraft(l))return resumeProgramme(l);
  const sibling=resumeProgramme(receiptFor(l,0,0,!insert)),siblingRun=restorePlay(sibling).takes;
  if(siblingRun.length)return continueReceipt(fiveAct(sibling),siblingRun.slice(0,5),insert).l;
  const base=resumeProgramme(fiveAct(l)),record=restorePlay(base).takes;
  return continueReceipt(base,record.length?record:bestShow(base)||[],insert).l;
}
export function lastDuet(relay=false){
  const casts=relay?relayCasts:duetCasts,id=read(relay?'relay:active':'duet:active');
  return resumeProgramme(casts.find(pair=>pair[0].play.id===id)?.[0]||casts[0][0]);
}
export function openingForecast(level,board,quiet,both=false){
  const first=level.play.coda?receiptFor(level,level.play.coda.mode,0):programmes[level.showIndex],cast=[first,partnerOrder(first)];
  const prices=[];
  const lines=cast.map(l=>{
    const bill=remainingCost(l,[],board,both);
    if(!bill)return orderName(l)+'接不到'+(both?'两印底谱':'收场');
    prices.push(orderName(l)+' '+bill.total+' 响');
    return orderName(l)+(quiet && bill.total>quietScore(l,both).target?'能收场，静场要改开场':'可以'+(both?(quiet?'兼演静场':'兼演'):quiet?'静场':'收场'));
  });
  return lines.join('。')+'。'+(prices.length?'这套开场的全剧最低换片数为'+prices.join('、')+'。':'');
}
export function duetBills(casts=duetCasts){
  let total=0;
  const insert=casts===insertCasts,coda=casts===receiptCasts||insert,relays=casts===relayCasts;
  $(insert?'insert-tickets':coda?'receipt-tickets':relays?'relay-tickets':'duet-tickets').innerHTML=(coda?casts.flat():casts).map(pair=>{
    const p=pair[0].play,reading=p.coda?' data-reading-mode="'+p.coda.mode+'" data-paper="'+Number(insert)+'"':'';
    const buttons=pair.map(l=>{
      const record=bestShow(l);if(record)total++;
      const cost=record?changeTotal(l,record):null;
      return '<button type="button" data-duet-bill="'+l.showIndex+'" data-first="'+versionOf(l)+'"'+reading+' '+(record?'':'disabled')+'>'+orderName(l)+
        '<small>'+(record?'全剧 '+cost+' 响'+(cost===quietScore(l).target?' · 已收静场笺':''):'尚未收录')+'</small></button>';
    });
    const doubles=relays||coda?pair.map(l=>doubleBill(l)):[],available=doubles.flatMap((t,i)=>t?[i]:[]);
    available.sort((a,b)=>changeTotal(pair[a],doubles[a])-changeTotal(pair[b],doubles[b]));
    function scoreLabel(l,tape){
      const cost=changeTotal(l,tape);
      return cost+' 响'+(coda && cost===quietScore(l,true).target?' · 兼演静场':'');
    }
    const i=available[0],button=i==null?'':'<button type="button" class="read-double" data-duet-bill="'+pair[i].showIndex+'" data-first="'+i+'"'+reading+' data-double>翻两印底谱 · '+scoreLabel(pair[i],doubles[i])+'</button>';
    const signed=(relays||coda) && signedBill(pair[0]),sign=signed?'<button type="button" class="read-signed" data-duet-bill="'+pair[0].showIndex+'" data-first="0"'+reading+' data-signed>翻同谱双签联 · '+scoreLabel(pair[0],signed[0])+'</button>':'';
    return '<div class="duet-bill"><strong>'+pair[0].title+(coda?' · '+readingNames[p.coda.mode]:'')+'</strong><div>'+buttons.join('')+'</div>'+button+sign+'</div>';
  }).join('');
  return total;
}
export function setupDuetControls(changeOrder,updateGoal,readBill,changeReading){
  let level,quiet=false,both=false,stage;
  $('duet-buttons').onclick=e=>{
    const b=e.target.closest('[data-mover]');if(b && !b.disabled && +b.dataset.mover!==versionOf(level))changeOrder(partnerOrder(level));
  };
  $('reading-buttons').onclick=e=>{
    const b=e.target.closest('[data-reading]');if(b && !b.disabled && +b.dataset.reading!==level.play.coda.mode)changeReading(receiptFor(level,+b.dataset.reading));
  };
  $('paper-buttons').onclick=e=>{
    const b=e.target.closest('[data-insert]');if(b && !b.disabled && Boolean(+b.dataset.insert)!==level.play.coda.insert)changeReading(receiptFor(level,level.play.coda.mode,versionOf(level),Boolean(+b.dataset.insert)));
  };
  $('quiet-aim').onchange=()=>{
    quiet=$('quiet-aim').checked;
    if(quiet && both && !level.play.coda){both=false;$('both-marks').checked=false;write('relay:both:'+level.play.id,false);}
    write('duet:quiet:'+level.play.id,quiet);updateGoal(quiet,both);
  };
  $('both-marks').onchange=()=>{
    both=$('both-marks').checked;
    if(both && quiet && !level.play.coda){quiet=false;$('quiet-aim').checked=false;write('duet:quiet:'+level.play.id,false);}
    write('relay:both:'+level.play.id,both);updateGoal(quiet,both);
  };
  $('duet-tickets').onclick=$('relay-tickets').onclick=$('receipt-tickets').onclick=$('insert-tickets').onclick=e=>{
    const b=e.target.closest('[data-duet-bill]');if(!b || b.disabled)return;
    const base=programmes[+b.dataset.duetBill],l=base.play.coda?receiptFor(base,+b.dataset.readingMode,+b.dataset.first,Boolean(+b.dataset.paper)):+b.dataset.first?partnerOrder(base):base,shared=b.hasAttribute('data-double');
    const pair=b.hasAttribute('data-signed')?signedBill(l):null;
    const record=pair?pair[0]:shared?doubleBill(l):bestShow(l);if(record)readBill(l,record,shared,pair);
  };
  function configure(l,screen,art){
    level=l;stage=screen;const duet=isDuet(l);
    for(const id of ['duet-order','duet-live','quiet-score','duet-guide'])$(id).hidden=!duet;
    const d=l.play?.delivery;
    const c=l.play?.coda;$('reading-panel').hidden=!c;
    $('relay-goal').hidden=$('relay-cue').hidden=!d;
    if(!duet){quiet=both=false;return;}
    write(c?'receipt:active':d?'relay:active':'duet:active',l.play.id);
    both=Boolean(d && read('relay:both:'+l.play.id)===true);$('both-marks').checked=both;
    quiet=(!both || Boolean(c)) && read('duet:quiet:'+l.play.id)===true;$('quiet-aim').checked=quiet;
    $('both-goal-copy').textContent=c?'让同样七拍兼演早递和晚递。第六拍，两盏灯都要按各自的顺序读通双孔。勾选静场，还能寻找兼演的最低响数。':'让同样五拍兼演早递和晚递。两处交接眼都要接通，第三拍各自的印位都要单独见光。';
    if(c){
      write('receipt:paper:'+l.showIndex,c.insert);
      $('paper-title').textContent=c.paper;$('receipt-art').src=art(c.baseId,c.insert?'insert':'receipt');$('reading-panel').classList.toggle('turned',Boolean(c.mode));
      $('paper-buttons').lastElementChild.textContent=receiptFor(l,c.mode,versionOf(l),true).play.coda.paper;
      for(const b of $('paper-buttons').children)b.setAttribute('aria-pressed',String(Boolean(+b.dataset.insert)===c.insert));
      for(const b of $('reading-buttons').children)b.setAttribute('aria-pressed',String(+b.dataset.reading===c.mode));
    }
    $('duet-choice-label').textContent=d?'在哪一站'+d.verb:'谁先动';
    const labels=d?d.stops.map(s=>s+d.verb):l.play.names.map(n=>n+'先动');
    $('duet-buttons').innerHTML=labels.map((label,i)=>'<button type="button" data-mover="'+i+'" aria-pressed="'+(i===versionOf(l))+'">'+label+'</button>').join('');
    $('duet-guide').querySelector('p').innerHTML=d?'<strong>递物返场</strong>'+l.projection.cue+' 「排一谱两印」会同时检查早、晚两套灯位。':'<strong>双片合演</strong>琥珀和青瓷各照一个角色。选谁先动，就先守另一盏灯。「探后场」可查眼前镜位的全剧最低响数。开场免费，之后每换一片记一响。';
  }
  function paint(takes,hold,board,result,tracing=false,fold=false){
    if(!isDuet(level))return;
    const p=level.play,d=p.delivery,ended=takes.length===p.frames.length,moved=hold?handStatus(level,hold,board).changed.length:0;
    for(const b of $('duet-buttons').children)b.disabled=Boolean(fold || tracing || takes.length>1 || !d && moved>0);
    if(p.coda){
      const locked=fold || tracing || takes.length>5 || takes.length===5 && moved>0,m=p.frames[5].mark;
      for(const b of [...$('reading-buttons').children,...$('paper-buttons').children])b.disabled=Boolean(locked);
      $('paper-instruction').textContent='第六拍由'+p.names[m.lamp]+'用'+lampNames[m.lamp]+(m.reverse?'从出口倒读 ':'从入口顺读 ')+holeNames(level,m)+'。'+
        (m.bend?'沿着读纸方向，在第二孔'+bendName(m)+'。':'')+(fold?'这场按骑缝联的纸面排演。':tracing?'这场跟随底谱的读法。':takes.length>5?'倒回第六拍可改读法。':locked?'放回本拍动过的玻璃可以改读法。':'第六拍动片前可换纸页或读法。');
    }
    if(d){
      const stamp=p.frames[2].mark;
      $('duet-order-note').textContent='第三拍由'+p.names[stamp.lamp]+'在 '+address(level,stamp)+' 盖'+d.seals[stamp.lamp]+'。'+(takes.length>1?'倒回第二拍可以改站。':'第二拍落片前可改站。');
    }else{
      $('duet-order-note').textContent=takes.length>1?'先手已演。想改顺序，可以倒回开场结束时。':moved?'本拍已有玻璃离开原位。按原样放回，或点「重排」，就能改先手。':
        '琥珀照'+p.names[0]+'，青瓷照'+p.names[1]+'。谁先动，就先守另一盏灯。';
    }
    const paid=changeTotal(level,takes),target=tracing?changeTotal(level,tracing):quietScore(level,both).target;
    $('quiet-aim').closest('label').hidden=Boolean(tracing);
    $('relay-goal').hidden=!d || Boolean(tracing);
    $('quiet-count').textContent='已记 '+paid+' 响'+(hold?' · 本拍暂记 +'+moved:'')+' / '+(tracing?'底谱 ':both?'兼演最低 ':'目标 ')+target+' 响';
    $('quiet-aim').disabled=$('both-marks').disabled=ended || tracing;
    $('quiet-score').hidden=Boolean(fold);
    if(fold)$('relay-goal').hidden=true;
    const last=Math.max(0,takes.length-1);
    const stageTime=p.coda && takes.length===5?4.01:last;
    if(d){
      const holder=p.names[carrierAt(level,last)],frame=p.frames[takes.length],marks=activeMarks(frame,fold?takes.length<foldScore(level).depth:both || tracing);
      $('relay-owner').textContent=holder+'持'+(p.coda && takes.length>=5?p.coda.paper:d.prop);
      $('relay-task').textContent=marks.map(m=>markTask(level,m)).join(' ／ ') || (ended?'已送达':'琥珀照'+p.names[0]+'，青瓷照'+p.names[1]);
      $('relay-reading').textContent=result?marks.map(m=>markReading(level,m,result.rays)).filter(Boolean).join('。'):'';
    }
    if(ended){$('duet-live').textContent='已落幕 · '+orderName(level);return;}
    if(!result){
      const previous=takes.at(-1),scene=previous?level.projection.scenes[readProjector(level,previous).scene]:null;
      moveScreen(stage,scene?.pose,scene?.partnerPose,stageTime);
      $('slip-small-screen').setAttribute('aria-label',p.backdrop+'，'+(scene?.title||'等待开场'));
      $('duet-live').textContent='开启「试灯」，可看两张玻璃各自照到哪一站。';return;
    }
    const indices=result.rays.map((r,i)=>p.ports[i].indexOf(r.exit));
    moveScreen(stage,p.poses[0][indices[0]],p.poses[1][indices[1]],stageTime);
    const text=indices.map((idx,i)=>p.names[i]+(idx<0?'待灯':'在'+portName(p.ports[i][idx]))).join('　·　');
    $('duet-live').textContent='试灯　'+text;$('slip-small-screen').setAttribute('aria-label',p.backdrop+'，'+text);
  }
  return {configure,paint,quiet:()=>quiet,both:()=>both};
}
