import {foldPartner,insertCasts,orderName,programmes,receiptCasts,receiptFor} from './duet-plays.mjs';
import {foldLetter,paperName,readingNames} from './receipt-plays.mjs';
import {canFold,foldBill,foldKeep,foldScore,foldTarget,foldTotal,foldWith} from './fold-score.mjs';
import {changeTotal} from './slip-path.mjs';

const $=id=>document.getElementById(id);
export const foldLabel=l=>orderName(l)+' · '+readingNames[l.play.coda.mode];
export function foldPanel(l,takes,plan,tracing){
  const c=l.play?.coda,done=c && takes.length===l.play.frames.length;
  $('fold-panel').hidden=!plan;$('fold-lobby').hidden=!c || Boolean(plan || tracing || done);
  if(!c)return;
  const {depth,min}=foldScore(l),other=foldPartner(l);
  $('fold-offer').textContent='与「'+foldLabel(other)+'」共用前 '+depth+' 拍，两场合计最低 '+min+' 响。';
  if(!plan)return;
  const replying=plan.leg==='reply',past=takes.length>=depth;
  $('fold-phase').textContent='骑缝合签 · '+(replying?'第二场':'第一场')+' · '+(past?'分开读纸':'共排前 '+depth+' 拍');
  $('fold-instruction').textContent=past?'折口已对齐。余下 '+(l.play.frames.length-takes.length)+' 拍可以自己排，让'+l.play.names[l.play.coda.reader]+'读「'+l.play.coda.paper+'」。':
    replying?'本场'+foldLabel(l)+'。照第一场的底稿亲手拼到第 '+depth+' 拍，之后可以另走灯路。':
    '本场'+foldLabel(l)+'。前 '+depth+' 拍要给「'+foldLabel(other)+'」也留一条路；探后场可算这套拼法的两场总响。';
  $('fold-low').checked=plan.low;
  const target=foldTarget(l,plan);
  $('fold-cost').textContent=(replying?'第一场 '+changeTotal(l,plan.tape)+' 响 · ':'')+'本场已记 '+changeTotal(l,takes)+' 响 · '+(replying?'沿此底稿最低 ':'两场合计最低 ')+target+' 响'+(target>min?'（全谱 '+min+' 响）':'');
}
export function foldResult(l,tape,all){
  $('fold-result').hidden=!all || !l.play.coda;$('fold-jumps').hidden=true;
  if($('fold-result').hidden)return null;
  const other=foldPartner(l),score=foldScore(l),pair=foldWith(l,tape),eligible=canFold(l,tape);
  const keep=eligible?score.depth:foldKeep(l,tape,{leg:'first',low:false});
  const n=pair?foldTotal(l,pair):null;
  const bound=eligible?foldTarget(other,{leg:'reply',tape}):null;
  const trim=eligible && (n??bound)>score.min?foldKeep(l,tape,{leg:'first',low:true}):null;
  $('trim-fold').hidden=trim==null;
  if(trim!=null)$('trim-fold').textContent=trim===tape.length?'沿此底稿补演骑缝静场':'从第 '+(trim+1)+' 拍改排 '+score.min+' 响';
  $('fold-letter').hidden=!pair;
  if(pair){
    const [title,story]=foldLetter(l);$('fold-letter').querySelector('strong').textContent=title;$('fold-letter').querySelector('p').textContent=story;
  }
  $('fold-result-note').textContent=pair?'已收骑缝联。两场共用前 '+score.depth+' 拍，从第 '+(score.depth+1)+' 拍分开。合计 '+n+' 响'+(n===score.min?'，已达两场静场。':'，这组最低 '+score.min+' 响。'):
    eligible?'这套开场可以和「'+foldLabel(other)+'」骑缝合签。另一场照演前 '+score.depth+' 拍，余下自己排，两场合计最低 '+bound+' 响。':
    '要和「'+foldLabel(other)+'」合签，前 '+score.depth+' 拍都要留得住另一面。当前可保留 '+keep+' 拍。';
  $('fold-action').textContent=pair?'翻这张骑缝联':eligible?'换站翻面实演':'从第 '+(keep+1)+' 拍留折口';
  return {pair,eligible,keep,trim};
}
export function foldAlbum(){
  let total=0;
  $('fold-tickets').innerHTML=[receiptCasts,insertCasts].flatMap(casts=>casts.map(f=>{
    const first=f[0][0],buttons=f[0].map(l=>{
      const pair=foldBill(l),other=foldPartner(l);if(pair)total++;
      return '<button type="button" data-fold-show="'+l.showIndex+'" data-first="'+l.play.delivery.version+'" data-paper="'+Number(l.play.coda.insert)+'" '+(pair?'':'disabled')+'>'+
        orderName(l)+'顺读 × '+orderName(other)+'倒读<small>共 '+foldScore(l).depth+' 拍 · '+(pair?'合计 '+foldTotal(l,pair)+' 响':'尚未合签')+'</small></button>';
    });
    return '<div class="duet-bill"><strong>'+first.title+' · '+paperName(first)+'</strong><div>'+buttons.join('')+'</div></div>';
  })).join('');
  $('fold-count').textContent=total+' / 8 张';
}
export function onFoldAlbum(show){
  $('fold-tickets').onclick=e=>{
    const b=e.target.closest('[data-fold-show]');if(!b || b.disabled)return;
    const l=receiptFor(programmes[+b.dataset.foldShow],0,+b.dataset.first,Boolean(+b.dataset.paper)),pair=foldBill(l);
    if(pair)show(l,pair);
  };
}
