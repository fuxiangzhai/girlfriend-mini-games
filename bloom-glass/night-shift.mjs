import {nights} from './nights.mjs';
import {inspectNight,lampNames,motifs,nextTurn,portName,squareName,turnsBetween} from './light-path.mjs';
import {drawLampBoard,mountMirrors} from './lamp-glass.mjs';
import {read,write} from './save.mjs';
import {icon} from './glass.mjs';
import {rolls} from './film-rolls.mjs';
import {adviseRoll,forecast,plannedSetting,rehearsalBase,restoreRoll,spentTurns,withinChange} from './film-path.mjs';
import {bestRecord,bestStrip,changeRule,drawFilmAlbum,drawRollList,drawStrip,frameNo,keepStrip,openPhoto} from './film-album.mjs';

const $=id=>document.getElementById(id);
const slipNames=['窗里笺','窗外笺'];
const receipt=(night,kind)=>read('night:'+kind+':'+night.id)===true;
const lampBadge=i=>'<span class="lamp-badge lamp-'+i+'">'+icon(i?'moon':'sun',15)+lampNames[i]+'</span>';
const flowers=order=>[...order].map(mark=>motifs[mark]).join(' → ');

export function setupNight(chime,cover,filmArt) {
  let index,night,setting,history,result,filter,hintBit,step=0;
  let roll=null,take=null,view=0,precise=false,repair=null;
  let rehearsal=null,plans={};
  let pair=read('night:mode')==='pair';
  let privateRole=null;

  const working=()=>Boolean(roll && view===take.shots.length);
  function markEdition() {
    const edition=roll?'roll':'night';
    write('night:edition',edition); cover(edition);
    for(const btn of $('night-editions').children) btn.setAttribute('aria-pressed',String(btn.dataset.edition===edition));
    for(const id of ['contact-bar','roll-select-label','take-tools','roll-album']) $(id).hidden=!roll;
    for(const id of ['night-select-label','night-album']) $(id).hidden=Boolean(roll);
  }
  function persist() {
    if(roll) {
      if(!working()) return;
      take.setting=setting; take.history=history; take.exposed=Boolean(result);
      write('roll:draft:'+roll.id,take);
    } else write('night:draft:'+night.id,{setting,history,exposed:Boolean(result)});
  }
  function draw() {
    drawLampBoard($('optics'),$('mirror-controls'),night,setting,result,filter,hintBit,$('ray-study').open?step:null);
    $('lamp-undo').disabled=!history.length || Boolean(roll && !working() && !rehearsal);
    $('take-shot').hidden=!working();
    $('take-shot').disabled=!working() || !result?.done;
    if(roll) {
      const last=rehearsal?.base??take.shots[view-1];
      for(const button of $('mirror-controls').children) {
        const bit=Number(button.dataset.bit),wax=Boolean(night.waxMask&bit);
        button.disabled=!working() && !rehearsal; button.classList.toggle('waxed',wax);
        const changed=last!=null && Boolean((last^setting)&bit);
        button.classList.toggle('changed-axis',changed);
        button.setAttribute('aria-label',button.getAttribute('aria-label')+(wax?'，封蜡固定':'')+(changed?'，与上一帧不同':''));
      }
      $('look-ahead').hidden=!working() || view===roll.frames.length-1;
      const base=rehearsalBase(roll,take.shots,take.setting,view,plans);
      $('try-next').hidden=view<=take.shots.length || base===null || Boolean(rehearsal);
      $('keep-plan').hidden=!rehearsal; $('keep-plan').disabled=!result?.done;
      const pencilled=working()?plannedSetting(roll,view,take.shots[view-1],plans):null;
      $('apply-plan').hidden=pencilled===null || pencilled===setting;
      $('review-shot').hidden=view>=take.shots.length;
      $('rewind-shot').hidden=view>=take.shots.length && repair===null;
      $('rewind-shot').textContent='重拍'+frameNo(repair??view);
      $('live-shot').hidden=working() || take.shots.length===roll.frames.length;
      $('economy-label').hidden=!roll.challenge || !working(); $('economy').checked=precise;
      $('lamp-hint').hidden=!working();
      $('lamp-hint-name').textContent=precise?'省镜提示':'整卷提示';
      const lead=working()?'正在拍':rehearsal?'草稿试调':view<take.shots.length?'重看成片':'预看灯笺';
      $('take-rule').textContent=lead+' · '+frameNo(view)+'「'+night.name+'」。'+changeRule(night)+
        (last!=null && (working()||rehearsal)?'，已改动 '+turnsBetween(last,setting)+' 根，转回原位可腾出名额。':'。')+
        (rehearsal?'试照合格后可以记下草稿。':view>take.shots.length?(base===null?'先把前一帧的试调镜位记在草稿上，就能接着试这一帧。':'可以在草稿里转镜，试出后一帧的拍法。'):'');
    } else {
      $('lamp-hint').hidden=false;
      const wantFilm=night.filmLamp!=null && receipt(night,'sent') && !receipt(night,'film');
      $('lamp-hint-name').textContent=wantFilm?'底片提示':'看一步提示';
    }
  }
  function slipped(role) {
    return '<p>'+night[role?'outside':'inside']+'</p><ul>'+night.lamps.map((lamp,i)=>{
      const clue=role?lamp.to+' · '+portName(lamp.exit):flowers(lamp.order)||'自由经过';
      const target=roll?portName(lamp.entry)+'入窗 → '+clue:clue;
      return '<li>'+lampBadge(i)+'<span>'+target+'</span></li>';
    }).join('')+'</ul>';
  }
  function showSlips() {
    $('slips-heading').textContent=roll?frameNo(view)+'灯笺':'值夜灯笺';
    $('mirrors-heading').textContent=roll && !working()?(rehearsal?'草稿镜台':view<take.shots.length?'拍摄时的镜位':'分镜试映'):'调光镜台';
    $('optical-board').closest('.lamp-mat').classList.toggle('rehearsal-mat',Boolean(rehearsal));
    for(const b of $('lamp-modes').children) b.setAttribute('aria-pressed',String((b.dataset.mode==='pair')===pair));
    $('handoff-note').hidden=!pair;
    $('lamp-slips').innerHTML=slipNames.map((title,role)=>{
      const lead=role?'送到哪扇窗':'照过哪些花';
      if(pair) return '<button type="button" class="sealed-slip slip-'+role+'" data-slip="'+role+'">'+icon('book')+'<span><strong>'+title+'</strong><small>'+lead+'</small></span><span>递给'+(role?'窗外':'窗里')+'人 ›</span></button>';
      return '<section class="light-slip slip-'+role+'"><h4>'+title+'<small>'+lead+'</small></h4>'+slipped(role)+'</section>';
    }).join('');
    $('film-order').hidden=night.filmLamp==null;
    if(night.filmLamp!=null) $('film-order').innerHTML=icon('star',18)+'<div><strong>可选 · 晒一张底片</strong><p>送达时，让'+lampNames[night.filmLamp]+'也经过底片格。</p></div>';
    if(roll?.challenge) {
      $('film-order').hidden=false;
      $('film-order').innerHTML=icon('star',18)+'<div><strong>照片背面的题字</strong><p>开场随意调镜。全卷帧间调镜合计 '+roll.par+' 次，就能读到题字。</p></div>';
    }
  }
  function listNights() {
    let place='',group;
    $('night-list').replaceChildren();
    nights.forEach((l,i)=>{
      if(place!==l.place) { place=l.place; group=document.createElement('optgroup'); group.label=place; $('night-list').append(group); }
      const option=document.createElement('option'); option.value=i;
      const status=receipt(l,'film')?' · 已晒底片':receipt(l,'sent')?' · 已交班':'';
      option.textContent=String(i+1).padStart(2,'0')+'　'+l.title+status; group.append(option);
    });
    $('night-list').value=String(index);
  }
  function album() {
    const sent=nights.filter(l=>receipt(l,'sent')).length;
    const film=nights.filter(l=>receipt(l,'film')).length;
    const possible=nights.filter(l=>l.filmLamp!=null).length;
    $('album-count').textContent='交班 '+sent+' / '+nights.length+'　底片 '+film+' / '+possible;
    $('film-strips').innerHTML=nights.map(l=>'<span class="'+(receipt(l,'sent')?'developed':'latent')+'"></span>').join('');
    $('panorama-caption').textContent=sent<nights.length?'每完成一份委托，照片就多显出一段街景。':
      film<possible?'街景显好了。洗出余下的底片，还能看见照片背面的题字。':'照片背面有人写着「我们各提一盏灯，刚好看清了对方走过的路。」';
    $('album-notes').innerHTML=nights.flatMap((l,i)=>receipt(l,'sent')?[
      '<article><h4>'+l.title+'</h4><p>'+l.reply+'</p>'+(receipt(l,'film')?'<p class="print-note">底片里 · '+l.print+'</p>':'')+'<button type="button" class="subtle" data-revisit="'+i+'">重访这扇窗</button></article>'
    ]:[]).join('');
  }
  function showTrace() {
    $('light-report').hidden=!result;
    $('ray-filter').hidden=!result || night.lamps.length<2;
    if(!result) return;
    $('ray-filter').innerHTML=['合看',...lampNames].map((name,i)=>'<button type="button" data-ray="'+(i-1)+'" aria-pressed="'+(filter===i-1)+'">'+name+'</button>').join('');
    $('ray-report').innerHTML=result.rays.flatMap((r,i)=>filter!==-1 && filter!==i ? []:[
      '<p>'+lampBadge(i)+'<span>'+portName(night.lamps[i].entry)+'入窗　'+(flowers(r.flowers)||'未经过花纹')+'　'+(r.exit?portName(r.exit)+'出窗':'回到原路')+
      (r.film?'　· 照过底片':'')+'</span></p>'
    ]).join('');
  }
  function study(position) {
    const lamp=Math.max(0,filter), ray=result.rays[lamp], last=ray.points.length-1;
    step=Math.max(0,Math.min(position,last));
    const slider=$('study-step'); slider.max=last; slider.value=step;
    $('study-prev').disabled=step===0; $('study-next').disabled=step===last;
    let detail;
    if(step===0) detail='从'+portName(night.lamps[lamp].entry)+'入窗';
    else if(step===last) detail=ray.exit?'从'+portName(ray.exit)+'出窗':'回到了原路';
    else {
      const [x,y]=ray.points[step],[px,py]=ray.points[step-1],[nx,ny]=ray.points[step+1];
      const toward=(dx,dy)=>dx>0?'东':dx<0?'西':dy>0?'南':'北';
      const from=toward(px-x,py-y),to=toward(nx-x,ny-y);
      const pane=night.panes.get(y*night.width+x),mark=night.rows[y][x];
      const subject=pane?(pane.control.panes.length>1?'联动镜':'镜面'):motifs[mark]||(mark==='*'?'底片':'窗格');
      detail=squareName(x,y)+' '+subject+'，光从'+from+'边来，'+(pane?'折向':'直行向')+to;
    }
    const description=lampNames[lamp]+' · '+step+' / '+last+'　'+detail;
    $('study-detail').textContent=description; slider.setAttribute('aria-valuetext',description); draw();
  }
  function showReceipt() {
    $('start-roll').hidden=Boolean(roll) || index!==nights.length-1 || !result?.done;
    if(roll) {
      const finished=take.shots.length===roll.frames.length;
      $('shift-receipt').hidden=!finished;
      if(!finished) return;
      const spent=spentTurns(take.shots), best=bestRecord(roll);
      $('receipt-place').textContent=roll.place+' · 整卷冲洗';
      $('receipt-title').textContent='《'+roll.title+'》已入册';
      $('receipt-story').textContent='这次帧间调镜 '+spent+' 次。'+(roll.challenge?'本卷最少 '+roll.par+' 次。':'开场的调整自由，不计入帧间次数。');
      $('receipt-print').hidden=false; $('receipt-print').textContent=!roll.challenge || best===roll.par?roll.note:'重拍时试试更少的调镜次数，读照片背面的题字。';
      $('seek-film').hidden=true; $('next-night').textContent=roll===rolls[rolls.length-1]?'翻开底片册':'接下一卷胶片';
      return;
    }
    $('shift-receipt').hidden=!result?.done;
    if(!result?.done) return;
    $('receipt-place').textContent=night.place+' · 交班回条';
    $('receipt-title').textContent=result.silver?'灯已送到，底片也洗好了':'灯已送到';
    $('receipt-story').textContent=night.reply;
    $('receipt-print').hidden=!result.silver; $('receipt-print').textContent=result.silver?'底片里 · '+night.print:'';
    $('seek-film').hidden=night.filmLamp==null || receipt(night,'film');
    $('next-night').textContent=index===nights.length-1?'翻开值夜相册':'接下一份委托';
  }
  function verdict() {
    if(roll) {
      if(rehearsal) return result.done?'这组草稿镜位能拍好这一帧。可以记下来，正式换帧时再用。':'草稿试照还没对上两张笺。可以继续试调，或回到正在拍的那一帧。';
      if(view<take.shots.length) return '这是按下快门时的镜位。可以分开看灯路，也可以从这帧重拍。';
      if(!working()) return result.done?'用手里这组镜位试映，这一帧的灯路已经对上。':'这是用当前镜位照出的未来灯路。可以对照这帧的笺，再回到手里的镜台。';
      if(result.done) return '这一帧的两张笺都已对上。可以按下快门，也可以继续调镜。';
    }
    if(result.done) return result.silver?'两张笺都对上了，底片上也留下了光。':'两张笺都对上了，交班回条已放进相册。';
    if(pair) return '还有一处约定没对上。把实际灯路和同伴的笺再对一遍。';
    if(result.inside) return '花纹顺序已对上。再看窗外笺，核对每盏灯的出口。';
    if(result.outside) return '光已送到约好的窗。再看窗里笺，核对经过的花和先后。';
    return '把实际灯路和两张笺对照一下，可以转一面镜再试。';
  }
  function enter(target) {
    roll=null; take=null; rehearsal=null; repair=null; markEdition();
    const savedNight=nights.findIndex(l=>l.id===read('night:active'));
    index=Number.isInteger(target) && nights[target]?target:Math.max(0,savedNight);
    night=nights[index];
    const draft=read('night:draft:'+night.id);
    const valid=n=>Number.isInteger(n) && n>=0 && n<2**night.controls.length;
    setting=valid(draft?.setting)?draft.setting:night.start;
    history=valid(draft?.setting) && Array.isArray(draft.history)?draft.history.slice(-40).filter(valid):[];
    result=valid(draft?.setting) && draft?.exposed===true?inspectNight(night,setting):null;
    filter=-1; hintBit=0; step=0; $('ray-study').open=false;
    write('night:active',night.id);
    $('night-place').textContent=night.place+' · 第 '+(index+1)+' 份委托';
    $('night-title').textContent=night.title;
    $('shift-tip').open=false; $('shift-tip-text').textContent=night.tip;
    $('night-album').open=false;
    mountMirrors($('optical-board'),$('mirror-controls'),night);
    listNights(); showSlips(); album(); showTrace(); showReceipt(); draw();
    $('lamp-status').textContent=result?verdict():night.lamps.map((l,i)=>lampNames[i]+'从'+portName(l.entry)+'入窗').join('，')+'。点镜片转向，点「试照」看灯路。';
  }
  function setFrame(next) {
    rehearsal=null; view=next; night=roll.frames[view];
    setting=view<take.shots.length?take.shots[view]:take.setting;
    if(view>take.shots.length) setting=rehearsalBase(roll,take.shots,take.setting,view,plans)??setting;
    history=working()?take.history:[];
    result=!working() || take.exposed?inspectNight(night,setting):null;
    hintBit=0; repair=null; filter=-1; step=0; $('ray-study').open=false;
    $('night-place').textContent=roll.place+' · 胶卷 '+(rolls.indexOf(roll)+1);
    $('night-title').textContent=roll.title;
    $('shift-tip').open=false; $('shift-tip-text').textContent=roll.tip;
    mountMirrors($('optical-board'),$('mirror-controls'),night);
    drawStrip(roll,take.shots,view,filmArt,plans); showSlips(); showTrace(); showReceipt(); draw();
    $('lamp-status').textContent=result?verdict():view===0?'点镜片转向，同圈号的镜一起转。试照对上两张笺，再按快门。也可以先翻看后面的分镜。':'沿用上一帧的镜位。先试照，看哪些光路值得留下。';
  }
  function enterRoll(target) {
    roll=rolls[target] || rolls.find(r=>r.id===read('roll:active')) || rolls[0];
    take=restoreRoll(roll,read('roll:draft:'+roll.id));
    const savedPlans=read('roll:plans:'+roll.id);
    plans=savedPlans && typeof savedPlans==='object' && !Array.isArray(savedPlans)?savedPlans:{};
    precise=read('roll:precise:'+roll.id)===true && Boolean(roll.challenge);
    write('roll:active',roll.id);
    if(take.shots.length===roll.frames.length) keepStrip(roll,take.shots);
    markEdition(); drawRollList(roll); drawFilmAlbum(filmArt); $('roll-album').open=false;
    setFrame(Math.min(take.shots.length,roll.frames.length-1));
  }
  function change(next,remember=true) {
    if(remember) history=[...history.slice(-39),setting];
    setting=next; hintBit=0; repair=null; result=null; filter=-1; $('ray-study').open=false;
    persist(); draw(); showTrace(); showReceipt();
  }
  function giveHint(film) {
    if(roll) {
      const advice=adviseRoll(roll,take.shots,setting,precise);
      if(!advice) return;
      hintBit=advice.control?.bit||0; repair=advice.type==='rewind'?advice.frame:null; draw();
      $('lamp-status').textContent=advice.type==='turn'?'转动 '+advice.control.panes.map(p=>squareName(p.x,p.y)).join('、')+' 的镜轴。'+(view===roll.frames.length-1?'这一帧仍能在限额内拍好。':'这一步会给后一帧留出位置。'):
        advice.type==='rewind'?'这段底片要从'+frameNo(repair)+'重拍，才能'+(precise?'用最少的调镜次数收卷。':'接上余下的画面。'):'整卷的后路已留好。'+(result?.done?'可以按下快门。':'先试照，再按下快门。');
      return;
    }
    const withFilm=film || (night.filmLamp!=null && receipt(night,'sent') && !receipt(night,'film'));
    const control=nextTurn(night,setting,withFilm);
    hintBit=control?.bit||0; draw();
    $('lamp-status').textContent=control?'试着转动 '+control.panes.map(p=>squareName(p.x,p.y)).join(' 和 ')+' 的'+(control.panes.length>1?'联动镜，点其中一面即可。':'镜片，再沿着灯路看看。'):
      withFilm?'底片和两张笺都已对准，点「试照」显影。':'镜面已经对好，点「试照」交班。';
  }
  function switchTo(target) {
    enter(target);
    $('night-title').tabIndex=-1; $('night-title').focus({preventScroll:true});
    $('night').scrollIntoView({block:'start'});
  }
  $('night-list').onchange=e=>switchTo(Number(e.target.value));
  $('night-editions').onclick=e=>{
    const btn=e.target.closest('[data-edition]'); if(!btn) return;
    if(btn.dataset.edition==='roll') enterRoll(); else enter();
  };
  $('roll-list').onchange=e=>enterRoll(Number(e.target.value));
  $('start-roll').onclick=()=>{ enterRoll(); $('night').scrollIntoView({block:'start'}); };
  $('take-strip').onclick=e=>{
    const btn=e.target.closest('[data-view]'); if(!roll || !btn) return;
    setFrame(Number(btn.dataset.view)); $('take-strip').querySelector('[aria-pressed="true"]').focus({preventScroll:true});
  };
  $('live-shot').onclick=()=>setFrame(take.shots.length);
  $('try-next').onclick=()=>{
    const base=rehearsalBase(roll,take.shots,take.setting,view,plans);
    if(base===null) return;
    rehearsal={base}; history=[]; setting=plannedSetting(roll,view,base,plans)??base;
    result=inspectNight(night,setting); filter=-1; $('ray-study').open=false;
    showSlips(); draw(); showTrace();
    $('lamp-status').textContent='现在转的是草稿镜台。可以按这帧的限额试调，满意后试照并记下镜位。';
  };
  $('keep-plan').onclick=()=>{
    if(!rehearsal || !result?.done || !withinChange(night,rehearsal.base,setting)) return;
    plans[view]={base:rehearsal.base,setting}; write('roll:plans:'+roll.id,plans);
    drawStrip(roll,take.shots,view,filmArt,plans);
    $('lamp-status').textContent=frameNo(view)+'的草稿已收好。正式拍到这一帧时，只要上一帧镜位一致，就可以照草稿调镜。';
  };
  $('apply-plan').onclick=()=>{
    const target=working()?plannedSetting(roll,view,take.shots[view-1],plans):null;
    if(target===null || target===setting) return;
    change(target); $('lamp-status').textContent='已照草稿摆好镜位。试照后再按快门，也可以撤销这次调整。';
  };
  $('review-shot').onclick=()=>{ if(view<take.shots.length) openPhoto(roll,view,filmArt,{shots:take.shots}); };
  $('economy').onchange=e=>{
    precise=e.target.checked; write('roll:precise:'+roll.id,precise); hintBit=0; repair=null; draw();
    $('lamp-status').textContent=precise?'提示将寻找整卷 '+roll.par+' 次帧间调镜的拍法。':'提示将优先保留当前镜位，帮你拍完整卷。';
  };
  $('look-ahead').onclick=()=>{
    const check=forecast(roll,take.shots,setting);
    $('lamp-status').textContent=!check.matched?'这帧的灯路还没对上。先试照，再用预演核对拍下后能否续拍。':
      !check.possible?'照这样按下快门，后面会接不上。还有别的镜位能拍好现在这一帧，可以提前翻看后面的笺。':
      '照这样拍下去，后面的画面都能接上。整卷最少需要 '+check.total+' 次帧间调镜。';
  };
  $('take-shot').onclick=()=>{
    if(!working() || !result?.done || !withinChange(night,take.shots[view-1],setting)) return;
    const shot=view;
    take.shots.push(setting); take.setting=setting; take.history=[]; take.exposed=false;
    write('roll:draft:'+roll.id,take);
    const done=take.shots.length===roll.frames.length;
    if(done) { keepStrip(roll,take.shots); drawRollList(roll); drawFilmAlbum(filmArt); }
    setFrame(done?shot:shot+1); chime(4,true);
    openPhoto(roll,shot,filmArt,{shots:take.shots,button:done?'收好这卷底片':'继续拍'+frameNo(shot+1)});
    $('photo-dialog').addEventListener('close',()=>{ if(roll && !$('night').hidden) $(done?'next-night':'expose').focus({preventScroll:true}); },{once:true});
  };
  $('rewind-shot').onclick=()=>{
    const back=repair??view,original=take.shots[back];
    if(original===undefined) return;
    take={shots:take.shots.slice(0,back),setting:original,history:[],exposed:true};
    write('roll:draft:'+roll.id,take); setFrame(back);
    $('lamp-status').textContent='回到'+frameNo(back)+'按快门前的镜位，可以重新安排后面的画面。';
  };
  $('roll-prints').onclick=e=>{
    const btn=e.target.closest('[data-photo],[data-replay]'); if(!btn) return;
    const item=rolls.find(r=>r.id===btn.closest('[data-print]').dataset.print);
    openPhoto(item,Number(btn.dataset.photo||0),filmArt,{shots:bestStrip(item),replay:btn.hasAttribute('data-replay')});
  };
  $('read-slips').onclick=()=>{ $('lamp-modes').querySelector('[aria-pressed="true"]').focus({preventScroll:true}); $('slips-heading').scrollIntoView({block:'start'}); };
  $('return-mirrors').onclick=()=>{ ($('mirror-controls').querySelector('button:enabled')||$('expose')).focus({preventScroll:true}); $('mirrors-heading').scrollIntoView({block:'start'}); };
  $('mirror-controls').onclick=e=>{
    const b=e.target.closest('[data-bit]'); if(!b) return;
    const bit=Number(b.dataset.bit), next=setting^bit;
    if(roll) {
      if(!working() && !rehearsal) return;
      if(bit&night.waxMask) { $('lamp-status').textContent=b.dataset.at+' 已封蜡，这帧要沿用上一帧的朝向。'; return; }
      if(!withinChange(night,rehearsal?.base??take.shots[view-1],next)) { $('lamp-status').textContent='这次换帧的调镜名额已用完。先把一根改过的轴转回原位，就可以换另一根。'; return; }
    }
    change(next); chime(1);
    $('lamp-status').textContent=b.dataset.link?b.dataset.link+' 号铜轴上的两面镜已一起转向。':b.dataset.at+' 镜片已转向。';
  };
  $('lamp-undo').onclick=()=>{
    if(!history.length) return;
    const last=history.pop(); change(last,false); $('lamp-status').textContent='已撤销上一次转镜。';
  };
  $('expose').onclick=()=>{
    result=inspectNight(night,setting); hintBit=0; filter=-1; $('ray-study').open=false;
    if(result.done && !roll) {
      write('night:sent:'+night.id,true);
      if(result.silver) write('night:film:'+night.id,true);
      listNights(); album();
    }
    persist(); draw(); showTrace(); showReceipt();
    $('lamp-status').textContent=verdict(); chime(2,result.done);
    if(result.done && !roll) {
      $('receipt-title').tabIndex=-1; $('receipt-title').focus({preventScroll:true});
      $('shift-receipt').scrollIntoView({block:'nearest'});
    }
  };
  $('ray-filter').onclick=e=>{
    const b=e.target.closest('[data-ray]'); if(!b) return;
    filter=Number(b.dataset.ray);
    if(filter<0) $('ray-study').open=false;
    if($('ray-study').open) study(0);
    else draw();
    showTrace();
    $('ray-filter').querySelector('[aria-pressed="true"]').focus({preventScroll:true});
  };
  $('ray-study').ontoggle=()=>{
    if(!result) return;
    if($('ray-study').open) {
      if(filter<0 && night.lamps.length>1) { filter=0; showTrace(); }
      study(0);
    } else draw();
  };
  $('study-step').oninput=e=>study(Number(e.target.value));
  $('study-prev').onclick=()=>study(step-1);
  $('study-next').onclick=()=>study(step+1);
  $('lamp-hint').onclick=()=>giveHint(false);
  $('seek-film').onclick=()=>{
    giveHint(true); ($('mirror-controls').querySelector('.suggested') || $('expose')).focus();
  };
  $('next-night').onclick=()=>{
    if(roll) {
      const next=rolls.indexOf(roll)+1;
      if(next<rolls.length) { enterRoll(next); $('night').scrollIntoView({block:'start'}); }
      else { $('roll-album').open=true; $('roll-album').querySelector('summary').focus(); }
      return;
    }
    if(index<nights.length-1) switchTo(index+1);
    else { $('night-album').open=true; $('night-album').querySelector('summary').focus(); }
  };
  $('album-notes').onclick=e=>{const b=e.target.closest('[data-revisit]'); if(b) switchTo(+b.dataset.revisit);};
  $('lamp-modes').onclick=e=>{
    const b=e.target.closest('[data-mode]'); if(!b) return;
    pair=b.dataset.mode==='pair'; write('night:mode',pair?'pair':'solo'); showSlips();
    if(result) $('lamp-status').textContent=verdict();
  };
  const dialog=$('lamp-dialog'), copy=$('lamp-dialog-copy'), action=$('lamp-dialog-action');
  $('lamp-slips').onclick=e=>{
    const b=e.target.closest('[data-slip]'); if(!pair || !b) return;
    privateRole=Number(b.dataset.slip);
    $('lamp-dialog-index').textContent=roll?frameNo(view)+' · '+night.name:'双人传笺';
    $('lamp-dialog-title').textContent='请把手机递给'+(privateRole?'窗外':'窗里')+'人';
    copy.textContent='接到手机，再拆开你手里的这张笺。';
    action.textContent='我拿到了，拆笺'; dialog.showModal(); action.focus();
  };
  $('lamp-guide').onclick=()=>{
    privateRole=null;
    $('lamp-dialog-index').textContent='值夜手册'; $('lamp-dialog-title').textContent='怎样送出一盏灯';
    copy.innerHTML='<p>带三角的边口是灯的入口。灯沿直线前进，遇镜拐直角。点一面镜子可切换倾斜方向。</p><p>照着窗里笺依次经过花纹，再从窗外笺所写的边口出去。途中可以经过别的花。两盏灯共用镜台，圈号相同的镜片会一起转。</p><p>点「试照」就能看到实际灯路。琥珀灯用实线，青瓷灯用虚线。镜片可以反复转动，也可以撤销。</p>';
    if(roll) copy.innerHTML+='<p>连拍时提前翻分镜，可以在草稿镜台依照下一帧的限额试调。草稿试照合格后记下镜位，正式换帧时就能采用。只有按下快门才会留下照片。</p><p>两帧之间只数最终朝向不同的轴，转回原位可腾出名额。封蜡镜要保持上一帧的方向。点已拍的分镜可以从那里重拍。</p>';
    action.textContent='回到镜台'; dialog.showModal(); action.focus();
  };
  action.onclick=()=>{
    if(privateRole===null) { dialog.close(); return; }
    $('lamp-dialog-title').textContent=slipNames[privateRole];
    copy.innerHTML='<div class="light-slip slip-'+privateRole+'">'+slipped(privateRole)+'</div>';
    privateRole=null; action.textContent='封好，交还手机';
    $('lamp-dialog-title').tabIndex=-1; $('lamp-dialog-title').focus();
  };
  dialog.addEventListener('close',()=>{privateRole=null; copy.replaceChildren(); $('lamp-dialog-title').textContent='';});
  return edition=>{ if((edition||read('night:edition'))==='roll') enterRoll(); else enter(); };
}
