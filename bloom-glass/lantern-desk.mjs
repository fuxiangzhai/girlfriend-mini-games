import {lampNames,portName,squareName} from './light-path.mjs';
import {shows} from './lantern-shows.mjs';
import {crossName,drawTicketMap,lampRoute,opticsOverlay,ticketImage} from './lantern-glass.mjs';
import {promptProjector,punchTicket,readProjector,ticketFor} from './projection.mjs';
import {markCell,mirrorFalls,poseKey} from './puzzle.mjs';
import {read,write} from './save.mjs';

const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
export const lastShow=()=>shows.find(l=>l.id===read('lantern:active')) || shows[0];

export function setupLantern({art,open,day,slots,clearStep,repaint,tell,chime}) {
  let level,preferred=0,seekStar=false,testing=true,filter=-1,ticket=null,downloadRun=0;
  function cover(){
    $('hero').classList.remove('is-letter','is-night','is-roll');$('hero').classList.add('is-lantern');
    let illustration='swallow';
    for(let n=level.showIndex;n>=0;n--){
      const show=shows[n],scenes=show.projection.scenes;
      const seen=n===level.showIndex && ticketFor(show,preferred)?preferred:scenes.findIndex((_,i)=>ticketFor(show,i));
      if(seen>=0){illustration=scenes[seen].id;break;}
    }
    $('jacket').hidden=false;$('jacket').src=$('note-art').src=art(illustration);$('sequel').hidden=true;
    $('volume-name').textContent='Petal Panes · Magic Lantern';
    $('page-title').textContent='巷口幻灯会';$('hero-line').textContent='把银镜拼进玻璃，让巷口的白床单演一晚好戏。';
  }
  function album() {
    let earned=0,stars=0;
    $('ticket-grid').innerHTML=shows.flatMap(l=>l.projection.scenes.map((s,i)=>{
      const held=ticketFor(l,i),no=pad(l.showIndex+1)+String.fromCharCode(65+i);
      if(held) {earned++;if(held.result.star)stars++;}
      return '<button type="button" class="ticket-stub" data-act="'+l.showIndex+'" data-ticket="'+i+'" '+(held?'':'disabled')+'>'+
        (held?'<img src="'+art(s.id)+'" alt="">':'<span class="ticket-hole">'+no+'</span>')+
        '<span><strong>'+s.title+'</strong><small>'+(held?(held.result.star?'已加印暗星':'已收票'):'待放映')+'</small></span></button>';
    })).join('');
    $('ticket-count').textContent=earned+' / 8 幕　·　'+stars+' / 7 枚暗星';
  }
  function preferences() {
    const {projection:p}=level, scene=p.scenes[preferred];
    $('scene-choice').hidden=p.scenes.length===1;
    $('scene-choice').innerHTML=p.scenes.length===1?'':'<p>选择要排演的灯位。实际出光决定幕景。</p>'+
      p.scenes.map((s,i)=>'<button type="button" data-prefer="'+i+'" aria-pressed="'+(preferred===i)+'">'+s.title+'</button>').join('');
    $('star-label').hidden=p.starLamp==null;
    $('seek-star').checked=seekStar;
    $('star-copy').textContent=p.starLamp==null?'':'提示也寻找暗星 · 让'+lampNames[p.starLamp]+'经过星刻';
    const lines=p.entries.map((e,i)=>'<span><i aria-hidden="true" class="beam-mark'+(i?' cool':'')+'"></i>'+lampNames[i]+' <b>'+portName(e)+' → '+portName(scene.exits[i])+'</b></span>');
    if (p.cross!=null) lines.push('<span>◎ '+crossName(level)+' 横竖合像</span>');
    $('projection-score').innerHTML='<strong>'+scene.title+'</strong><div class="lamp-lines">'+lines.join('')+'</div>';
    write('lantern:choice:'+level.id,{preferred,seekStar});
  }
  function configure(target) {
    level=target;const enabled=Boolean(level.projection);
    $('bench').classList.toggle('projecting',enabled);
    $('day-desk').setAttribute('aria-pressed',String(!enabled));$('lantern-desk').setAttribute('aria-pressed',String(enabled));
    for (const id of ['program-bar','cue-sheet','lamp-bench','projection-score','ticket-album','optics']) $(id).toggleAttribute('hidden',!enabled);
    if(!enabled) return;
    const p=level.projection, pref=read('lantern:choice:'+level.id);
    preferred=Number.isInteger(pref?.preferred) && p.scenes[pref.preferred]?pref.preferred:0;
    seekStar=p.starLamp!=null && pref?.seekStar===true;testing=read('lantern:test')!==false;filter=-1;
    $('program-select').value=String(level.showIndex);
    $('show-cue').open=false;$('show-cue-text').textContent=p.cue;
    $('beam-solo').hidden=p.entries.length===1;
    $('beam-solo').innerHTML=['双灯','琥珀','青瓷'].map((s,i)=>'<button type="button" data-beam="'+(i-1)+'" aria-pressed="'+(i===0)+'">'+s+'</button>').join('');
    $('optics').setAttribute('viewBox','0 0 '+level.width*48+' '+level.height*48);
    preferences();album();cover();
  }
  function paint(placed,ghost) {
    const p=level.projection, showing=testing && ghost?.valid;
    const shown=showing?placed.map((v,i)=>i===ghost.id?ghost.place:v):placed;
    const result=testing?readProjector(level,shown):null;
    $('optics').innerHTML=opticsOverlay(level,p.scenes[preferred],result,filter);
    $('test-beam').setAttribute('aria-pressed',String(testing));$('beam-solo').hidden=p.entries.length===1 || !testing;
    $('project-slide').disabled=!placed.every(Boolean);
    if(!result) { $('projection-report').textContent='试灯已收起。圆牌进光，方牌是排演出口。';return; }
    const lines=result.rays.flatMap((r,i)=>{
      if(filter>=0 && i!==filter)return [];
      const at=r.blocked?'停在 '+squareName(...r.blocked)+' 空格':'出'+portName(r.exit)+'，转 '+r.turns+' 次';
      return [lampNames[i]+'从'+portName(p.entries[i])+'入，'+at+(i===p.starLamp && r.star?'，经过暗星':'')];
    });
    if(p.cross!=null) lines.push(crossName(level)+(result.registered?' 已合像':' 待合像'));
    $('projection-report').textContent=(showing?'试摆 · ':'')+lines.join('　｜　');
  }
  function openAlbum() {
    $('ticket-album').open=true;const summary=$('ticket-album').querySelector('summary');summary.focus({preventScroll:true});summary.scrollIntoView({block:'nearest'});
  }
  function display(l,i,receipt,premiere=false) {
    const s=l.projection.scenes[i];ticket={l,i,s,receipt};
    $('ticket-dialog').classList.toggle('premiere',premiere);
    $('ticket-image').src=art(s.id);$('ticket-image').alt=s.alt;
    $('ticket-image').hidden=false;$('ticket-map').hidden=$('ticket-replay').hidden=true;
    $('turn-ticket').setAttribute('aria-expanded','false');$('turn-ticket').textContent='翻面看镜位';
    $('ticket-number').textContent='第 '+pad(l.showIndex+1)+' 场　/　票根 '+String.fromCharCode(65+i)+(receipt.result.star?'　✦ 暗星加印':'');
    $('ticket-title').textContent=s.title;$('ticket-story').textContent=s.story;
    $('ticket-secret').hidden=!s.secret;
    $('ticket-secret').textContent=receipt.result.star?s.secret:'票背还空着。让'+(s.secret?lampNames[l.projection.starLamp]:'')+'经过暗星，可以加印一行字。';
    $('ticket-path').textContent=lampRoute(l,s)+(l.projection.cross==null?'':'　◎ '+crossName(l)+' 合像');
    $('next-show').textContent=l.showIndex<shows.length-1?'看下一场':'翻开戏票夹';
    $('other-show').hidden=l.projection.scenes.length<2 && (!s.secret || receipt.result.star);
    $('other-show').textContent=l.projection.scenes.length>1?'排演「'+l.projection.scenes[1-i].title+'」':'再找暗星';
    downloadRun++;$('print-ticket').disabled=false;$('print-status').textContent='';$('ticket-dialog').showModal();
  }
  $('turn-ticket').onclick=()=>{
    const {l,i,receipt}=ticket,back=$('ticket-replay').hidden;
    $('ticket-replay').hidden=$('ticket-map').hidden=!back;$('ticket-image').hidden=back;
    $('turn-ticket').setAttribute('aria-expanded',String(back));$('turn-ticket').textContent=back?'翻回幕景':'翻面看镜位';
    if(!back)return;
    drawTicketMap($('ticket-map'),l,receipt);
    const mark=(id,p)=>{
      const m=l.pieces[id].mirror,at=markCell(l.width,m.offset,p);
      return squareName(at%l.width,Math.floor(at/l.width))+(mirrorFalls(m.falls,p.o)?'（左上连右下）':'（左下连右上）');
    };
    $('ticket-mirrors').textContent=receipt.slots.flatMap((p,id)=>l.pieces[id].mirror?[l.pieces[id].name+'银镜在 '+mark(id,p)]:[]).join('，')+'。';
    const sibling=l.projection.scenes[1-i],other=sibling && ticketFor(l,1-i);
    if(other){
      const changed=l.pieces.flatMap((piece,id)=>poseKey(l,id,receipt.slots[id])===poseKey(l,id,other.slots[id])?[]:[piece.name]);
      $('ticket-compare').textContent='对照已收的「'+sibling.title+'」，这两次放映换过 '+changed.length+' 片玻璃，包括'+changed.join('、')+'。';
    }else $('ticket-compare').textContent=sibling?'收齐这场的两张票后，可以在这里对照哪些玻璃换过位置或朝向。':'';
  };
  function project() {
    const held=punchTicket(level,slots());
    if(!held) {
      testing=true;write('lantern:test',true);repaint();
      const r=readProjector(level,slots());
      const exitsMatch=level.projection.scenes.some(s=>s.exits.every((port,i)=>port===r.rays[i].exit));
      tell(exitsMatch && !r.registered?'出口已对上。两束光还要在 '+crossName(level)+' 一横一竖穿过，幕上的两张片才能合像。':
        '幕景还没对上。沿试灯轨迹查出口，点已嵌的玻璃可以取回。');return;
    }
    album();cover();chime(0,true);display(level,held.scene,{result:held,slots:slots().map(p=>({...p}))},true);
  }
  function go(l){open(l);window.scrollTo(0,0);}
  $('program-select').innerHTML=shows.map((l,i)=>'<option value="'+i+'">'+pad(i+1)+'　'+l.title+'</option>').join('');
  $('program-select').onchange=()=>go(shows[Number($('program-select').value)]);
  $('day-desk').onclick=()=>{if(level.projection)day();};
  $('lantern-desk').onclick=()=>{if(!level.projection)go(lastShow());};
  $('to-tickets').onclick=openAlbum;
  $('jump-tray').onclick=()=>{const b=$('pieces').querySelector('[aria-pressed="true"]')||$('pieces').firstElementChild;b.focus({preventScroll:true});$('pieces').parentElement.scrollIntoView({block:'center'});};
  $('jump-frame').onclick=()=>{const b=$('hit-grid').querySelector('[tabindex="0"]');b.focus({preventScroll:true});$('mat').scrollIntoView({block:'center'});};
  $('scene-choice').onclick=e=>{const b=e.target.closest('[data-prefer]');if(!b)return;preferred=+b.dataset.prefer;preferences();clearStep();tell('正在排演「'+level.projection.scenes[preferred].title+'」，方牌和一步提示已换到这套灯位。');};
  $('seek-star').onchange=()=>{seekStar=$('seek-star').checked;preferences();clearStep();tell(seekStar?'一步提示会同时寻找能加印暗星的拼法。':'一步提示会优先保留手里的拼片。');};
  $('test-beam').onclick=()=>{testing=!testing;write('lantern:test',testing);repaint();};
  $('beam-solo').onclick=e=>{const b=e.target.closest('[data-beam]');if(!b)return;filter=+b.dataset.beam;
    for(const item of $('beam-solo').children)item.setAttribute('aria-pressed',String(item===b));repaint();};
  $('project-slide').onclick=project;
  $('ticket-grid').onclick=e=>{
    const b=e.target.closest('[data-ticket]');if(!b || b.disabled)return;
    const l=shows[+b.dataset.act],i=+b.dataset.ticket,held=ticketFor(l,i);if(held)display(l,i,held);
  };
  $('next-show').onclick=()=>{const i=ticket.l.showIndex;$('ticket-dialog').close();if(i+1<shows.length)go(shows[i+1]);else openAlbum();};
  $('other-show').onclick=()=>{
    const {l,i}=ticket;$('ticket-dialog').close();if(level!==l)go(l);
    preferred=l.projection.scenes.length>1?1-i:i;seekStar=l.projection.scenes.length===1;
    preferences();clearStep();tell('下一次排演「'+l.projection.scenes[preferred].title+'」。可以沿用桌上的玻璃，从一步提示开始调整。');
    $('hint').focus({preventScroll:true});$('projection-score').scrollIntoView({block:'nearest'});
  };
  $('print-ticket').onclick=async()=>{
    const {l,s,receipt}=ticket,run=++downloadRun;$('print-ticket').disabled=true;
    try{
      const blob=await ticketImage(l,s,receipt,art(s.id));
      if(run!==downloadRun || !$('ticket-dialog').open)return;
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='巷口幻灯会-'+s.title+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('print-status').textContent='戏票已生成，存根上印着这一次的镜位。';
    }catch{if(run===downloadRun)$('print-status').textContent='这次冲印没有成功，可以再试一次。';}
    finally{if(run===downloadRun)$('print-ticket').disabled=false;}
  };
  return {configure,paint,cover,project,step:(placed,selected)=>promptProjector(level,placed,selected,preferred,seekStar),
    target:()=>level.projection.scenes[preferred].title};
}
