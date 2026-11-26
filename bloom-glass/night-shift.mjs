import {nights} from './nights.mjs';
import {inspectNight,lampNames,motifs,nextTurn,portName,squareName} from './light-path.mjs';
import {drawLampBoard,mountMirrors} from './lamp-glass.mjs';
import {read,write} from './save.mjs';
import {icon} from './glass.mjs';

const $=id=>document.getElementById(id);
const slipNames=['窗里笺','窗外笺'];
const receipt=(night,kind)=>read('night:'+kind+':'+night.id)===true;
const lampBadge=i=>'<span class="lamp-badge lamp-'+i+'">'+icon(i?'moon':'sun',15)+lampNames[i]+'</span>';
const flowers=order=>[...order].map(mark=>motifs[mark]).join(' → ');

export function setupNight(chime) {
  let index,night,setting,history,result,filter,hintBit,step=0;
  let pair=read('night:mode')==='pair';
  let privateRole=null;

  function persist() {
    write('night:draft:'+night.id,{setting,history,exposed:Boolean(result)});
  }
  function draw() {
    drawLampBoard($('optics'),$('mirror-controls'),night,setting,result,filter,hintBit,$('ray-study').open?step:null);
    $('lamp-undo').disabled=!history.length;
    const wantFilm=night.filmLamp!=null && receipt(night,'sent') && !receipt(night,'film');
    $('lamp-hint-name').textContent=wantFilm?'底片提示':'看一步提示';
  }
  function slipped(role) {
    return '<p>'+night[role?'outside':'inside']+'</p><ul>'+night.lamps.map((lamp,i)=>{
      const target=role?lamp.to+' · '+portName(lamp.exit):flowers(lamp.order)||'自由经过';
      return '<li>'+lampBadge(i)+'<span>'+target+'</span></li>';
    }).join('')+'</ul>';
  }
  function showSlips() {
    for(const b of $('lamp-modes').children) b.setAttribute('aria-pressed',String((b.dataset.mode==='pair')===pair));
    $('handoff-note').hidden=!pair;
    $('lamp-slips').innerHTML=slipNames.map((title,role)=>{
      const lead=role?'送到哪扇窗':'照过哪些花';
      if(pair) return '<button type="button" class="sealed-slip slip-'+role+'" data-slip="'+role+'">'+icon('book')+'<span><strong>'+title+'</strong><small>'+lead+'</small></span><span>递给'+(role?'窗外':'窗里')+'人 ›</span></button>';
      return '<section class="light-slip slip-'+role+'"><h4>'+title+'<small>'+lead+'</small></h4>'+slipped(role)+'</section>';
    }).join('');
    $('film-order').hidden=night.filmLamp==null;
    if(night.filmLamp!=null) $('film-order').innerHTML=icon('star',18)+'<div><strong>可选 · 晒一张底片</strong><p>送达时，让'+lampNames[night.filmLamp]+'也经过底片格。</p></div>';
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
    if(result.done) return result.silver?'两张笺都对上了，底片上也留下了光。':'两张笺都对上了，交班回条已放进相册。';
    if(pair) return '还有一处约定没对上。把实际灯路和同伴的笺再对一遍。';
    if(result.inside) return '花纹顺序已对上。再看窗外笺，核对每盏灯的出口。';
    if(result.outside) return '光已送到约好的窗。再看窗里笺，核对经过的花和先后。';
    return '把实际灯路和两张笺对照一下，可以转一面镜再试。';
  }
  function enter(target) {
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
  function change(next,remember=true) {
    if(remember) history=[...history.slice(-39),setting];
    setting=next; hintBit=0; result=null; filter=-1; $('ray-study').open=false;
    persist(); draw(); showTrace(); showReceipt();
  }
  function giveHint(film) {
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
  $('read-slips').onclick=()=>{ $('lamp-modes').querySelector('[aria-pressed="true"]').focus({preventScroll:true}); $('slips-heading').scrollIntoView({block:'start'}); };
  $('return-mirrors').onclick=()=>{ $('mirror-controls').firstElementChild.focus({preventScroll:true}); $('mirrors-heading').scrollIntoView({block:'start'}); };
  $('mirror-controls').onclick=e=>{
    const b=e.target.closest('[data-bit]'); if(!b) return;
    change(setting^Number(b.dataset.bit)); chime(1);
    $('lamp-status').textContent=b.dataset.link?b.dataset.link+' 号铜轴上的两面镜已一起转向。':b.dataset.at+' 镜片已转向。';
  };
  $('lamp-undo').onclick=()=>{
    if(!history.length) return;
    const last=history.pop(); change(last,false); $('lamp-status').textContent='已撤销上一次转镜。';
  };
  $('expose').onclick=()=>{
    result=inspectNight(night,setting); hintBit=0; filter=-1; $('ray-study').open=false;
    if(result.done) {
      write('night:sent:'+night.id,true);
      if(result.silver) write('night:film:'+night.id,true);
      listNights(); album();
    }
    persist(); draw(); showTrace(); showReceipt();
    $('lamp-status').textContent=verdict(); chime(2,result.done);
    if(result.done) {
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
    $('lamp-dialog-index').textContent='双人传笺';
    $('lamp-dialog-title').textContent='请把手机递给'+(privateRole?'窗外':'窗里')+'人';
    copy.textContent='接到手机，再拆开你手里的这张笺。';
    action.textContent='我拿到了，拆笺'; dialog.showModal(); action.focus();
  };
  $('lamp-guide').onclick=()=>{
    privateRole=null;
    $('lamp-dialog-index').textContent='值夜手册'; $('lamp-dialog-title').textContent='怎样送出一盏灯';
    copy.innerHTML='<p>带三角的边口是灯的入口。灯沿直线前进，遇镜拐直角。点一面镜子可切换倾斜方向。</p><p>照着窗里笺依次经过花纹，再从窗外笺所写的边口出去。途中可以经过别的花。两盏灯共用镜台，圈号相同的镜片会一起转。</p><p>点「试照」就能看到实际灯路。琥珀灯用实线，青瓷灯用虚线。镜片可以反复转动，也可以撤销。</p>';
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
  return enter;
}
