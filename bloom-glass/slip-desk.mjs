import {lampNames,portName} from './light-path.mjs';
import {drawTicketMap,lampRoute} from './lantern-glass.mjs';
import {edgePath} from './glass.mjs';
import {fits,markCell,mirrorFalls,shapeAt} from './puzzle.mjs';
import {readProjector} from './projection.mjs';
import {read,write} from './save.mjs';
import {slipPlays} from './slip-plays.mjs';
import {canTakeRequests,cueHint,deskAt,encoreBill,handStatus,makeHold,playbill,restorePlay,rewindPoint,savePlay,sightline,storePlaybill,takeScene} from './slip-path.mjs';
import {layScreen,longTicket,moveActor,replayBeat,stagePose} from './slip-screen.mjs';

const $=id=>document.getElementById(id);
const two=n=>String(n).padStart(2,'0');
const endings=l=>l.play.frames.at(-1).scenes;
const names=(l,ids)=>ids.map(id=>l.pieces[id].name).join('、');
export const lastPlay=()=>slipPlays.find(l=>l.id===read('slip:active')) || slipPlays[0];

export function setupSlips({open,slots,selected,seat,repaint,clearStep,tell,chime,art}) {
  let level,takes=[],hold=null,ending,encore=false,showing=null,raf=0,downloadRun=0,overlay=false,forecastBoard;
  const finished=()=>takes.length===level.play.frames.length;
  function sceneId(){
    if(finished())return readProjector(level,takes.at(-1)).scene;
    const candidates=level.play.frames[takes.length].scenes;
    return candidates.includes(ending)?ending:candidates[0];
  }
  function load(l){
    const restored=restorePlay(l);level=l;takes=restored.takes;
    hold=makeHold(l,takes.at(-1),l.play.frames[takes.length]);
    const requested=read('slip:ending:'+l.id);
    ending=endings(l).includes(requested)?requested:endings(l)[0];
    encore=endings(l).length>1 && read('slip:requests:'+l.id)===true;
    if(finished() && !playbill(l,sceneId()))storePlaybill(l,takes);
    return restored;
  }
  function setDesk(prefix,board){
    savePlay(level,prefix,deskAt(level,board),[]);
    open(level);
  }
  function rewind(index){
    if(index<0 || index>=takes.length)return;
    setDesk(takes.slice(0,index),takes[index]);tell('已倒回第 '+(index+1)+' 拍，镜位停在当时落片的位置，可以接着调。');
  }
  function issue(placed){
    if(finished())return '这出戏已收进活动戏本。可以回看，或倒回一拍重演。';
    if(!hold)return '';
    const s=handStatus(level,hold,placed);
    if(s.locked)return lampNames[hold.keeper]+'正经过这片玻璃。要让光一直亮着，请从其余玻璃里换片。';
    return s.over?'这一拍最多换 '+hold.limit+' 片。按原样放回一片，就能腾出名额。':'';
  }
  function rules(placed){
    if(finished())return '全剧已收进活动戏本，可推拉活动片重演。';
    if(!hold){
      const next=level.play.frames[1];
      return '开场自由拼片。下一拍守'+lampNames[next.keeper]+'，最多换 '+next.limit+' 片。';
    }
    return lampNames[hold.keeper]+'守光 · '+names(level,hold.held)+'夹住　｜　已换 '+handStatus(level,hold,placed).changed.length+' / '+hold.limit+' 片';
  }
  function clamps(placed){
    if(!hold)return '';
    const prior=overlay?handStatus(level,hold,placed).changed.map(id=>{
      const p=hold.base[id],piece=level.pieces[id];
      const border=edgePath(shapeAt(piece,p.o).map(([dx,dy])=>[p.x+dx,p.y+dy]));
      let d=border;
      if(piece.mirror){
        const at=markCell(level.width,piece.mirror.offset,p),x=(at%level.width+.5)*48,y=(Math.floor(at/level.width)+.5)*48;
        const dy=mirrorFalls(piece.mirror.falls,p.o)?13:-13;
        d+='M'+(x-13)+' '+(y-dy)+'l26 '+(dy*2);
      }
      return '<g data-stencil="'+id+'" fill="none"><path d="'+d+'" stroke="#fff5e0" stroke-width="4.3"/><path d="'+d+'" stroke="#814954" stroke-width="2.3" stroke-dasharray="5 3"/></g>';
    }).join(''):'';
    return prior+hold.held.map(id=>{
      const p=hold.base[id],x=p.x*48+37,y=p.y*48+10;
      return '<g transform="translate('+x+' '+y+')"><rect x="-7.3" y="-7" width="14.6" height="14" rx="3" fill="#334544" stroke="#f8dd92" stroke-width="1.4"/><text y="3.6" text-anchor="middle" font-size="9.5" fill="#fff2c8">守</text></g>';
    }).join('');
  }
  function cover(){
    $('hero').classList.remove('is-night','is-letter','is-roll');$('hero').classList.add('is-lantern','is-slip');
    $('jacket').hidden=false;$('jacket').src=art(level.play.id,'bg');$('sequel').hidden=true;
    $('volume-name').textContent='Petal Panes · Slipping Glass';
    $('page-title').textContent='留灯换景';$('hero-line').textContent='留一盏灯照着原处，让另一张玻璃上的故事动起来。';
  }
  function archive(){
    let n=0;
    $('playbill-grid').innerHTML=slipPlays.flatMap((l,index)=>endings(l).map(s=>{
      const saved=playbill(l,s);if(saved)n++;
      return '<button type="button" data-bill="'+index+'" data-ending="'+s+'" '+(saved?'':'disabled')+'><span>'+two(index+1)+'</span><strong>'+l.title+'</strong><small>'+(saved?'可重映':'待演全')+' · '+l.projection.scenes[s].title+'</small></button>';
    })).join('');
    $('playbill-count').textContent=n+' / 5 本';
    const signed=encoreBill(slipPlays.at(-1));
    $('read-encore').hidden=!signed;
    $('audience-copy').textContent=signed?'「我想先跟鲸鱼打个招呼，再让它带我去看天亮。」她把两幕写在同一张点戏签上。':
      '用完全相同的开场和中场镜位，把云鲸的两个结尾都演出来，阁楼的孩子就会送来点戏签。';
  }
  function score(){
    const scenes=level.projection.scenes,alts=endings(level),at=takes.length;
    $('slip-count').textContent='已演 '+at+' / '+level.play.frames.length+' 拍';
    $('slip-endings').hidden=alts.length===1;
    $('encore-order').hidden=alts.length===1 || finished();$('keep-both').checked=encore;
    $('slip-endings').innerHTML=alts.length===1?'':'<span>排演结尾</span>'+alts.map(s=>
      '<button type="button" data-end="'+s+'" aria-pressed="'+(s===ending)+'">'+scenes[s].title+'</button>').join('');
    $('slip-cues').innerHTML=level.play.frames.map((f,i)=>{
      const done=i<at,actual=done?readProjector(level,takes[i]).scene:null;
      const s=scenes[done?actual:f.scenes.includes(ending)?ending:f.scenes[0]];
      return '<li'+(i===at?' aria-current="step"':'')+'><div class="slip-cue-number">'+two(i+1)+'</div><div>'+
        (done?'<button type="button" data-replay="'+i+'">'+s.title+' ↗</button>':'<strong>'+s.title+'</strong>')+
        '<small>'+s.exits.map((e,j)=>lampNames[j]+'出'+portName(e)).join('　')+'</small><small>'+
        (f.keeper==null?'开场自由拼片':'守'+lampNames[f.keeper]+' · 最多换 '+f.limit+' 片')+'</small></div></li>';
    }).join('');
  }
  function configure(target){
    const yes=Boolean(target.play);
    $('bench').classList.toggle('slip-bench',yes);
    $('slip-desk').setAttribute('aria-pressed',String(yes));
    for(const id of ['slip-bar','slip-hold','slip-run-sheet','slip-scorecard','slip-archive'])$(id).hidden=!yes;
    $('slip-overlay-tools').hidden=!yes || !hold;overlay=false;forecastBoard=null;$('slip-forecast').textContent='';
    if(!yes)return;
    $('slip-select').value=String(level.showIndex);$('slip-letter').textContent=level.request;
    $('slip-tip').textContent=level.projection.cue;$('slip-notes').open=false;
    const actor=layScreen($('slip-small-screen'),level,art);
    const current=takes.at(-1),scene=current?level.projection.scenes[readProjector(level,current).scene]:null;
    moveActor(actor,scene?.pose);$('slip-small-screen').setAttribute('aria-label',level.play.backdrop+'，'+(scene?scene.title:'等待开场'));
    score();archive();cover();
  }
  function paint(placed){
    $('slip-hold').textContent=rules(placed);$('slip-hold').classList.toggle('has-hold',Boolean(hold));
    $('predict-slip').disabled=finished() || !placed.every(Boolean);$('retake-slip').disabled=!takes.length;
    $('project-slide').textContent=finished()?'重映整出':'落下这一拍';
    if(forecastBoard && forecastBoard!==placed){$('slip-forecast').textContent='';forecastBoard=null;}
    $('overlay-slip').setAttribute('aria-pressed',String(overlay));$('stencil-key').hidden=!overlay;
    const id=selected();
    $('reseat-slip').hidden=!hold || id<0 || Boolean(placed[id]);
    if(!$('reseat-slip').hidden){
      $('reseat-slip').textContent='原位放回'+level.pieces[id].name;
      $('reseat-slip').disabled=!fits(level,placed,id,hold.base[id]);
    }
  }
  function stop(){cancelAnimationFrame(raf);raf=0;$('run-slip').textContent='连放';}
  function showPosition(value){
    const v=showing;if(!v)return;
    const pos=value/100,index=Math.round(pos),beat=v.beats[index];
    $('slide-lever').value=String(value);
    $('slide-lever').setAttribute('aria-valuetext','第 '+(index+1)+' 拍，'+beat.scene.title);
    moveActor(v.actor,stagePose(v.scenes,pos));
    if(v.index===index)return;
    v.index=index;
    $('slip-title').textContent=beat.scene.title;$('slip-caption').textContent=beat.scene.story;
    $('slip-large-screen').setAttribute('aria-label',v.l.play.backdrop+'，'+beat.scene.title);
    const routed='第 '+(index+1)+' 拍定格。'+lampRoute(v.l,beat.scene);
    $('slip-proof-text').textContent=beat.held?routed+'。这一拍由'+lampNames[beat.held.keeper]+'守住'+names(v.l,beat.held.held)+'，实际换了'+names(v.l,beat.changed)+'。':routed+'。这是全剧的开场镜位。';
    drawTicketMap($('slip-map'),v.l,beat);
  }
  function travel(from,to){
    stop();if(from>=to){showPosition(to);return;}
    const start=performance.now(),duration=(to-from)*15;
    $('run-slip').textContent='停住';
    const tick=now=>{
      if(!$('slip-dialog').open){stop();return;}
      const progress=Math.min(1,(now-start)/duration);
      showPosition(Math.round(from+(to-from)*progress));
      if(progress===1)stop();else raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
  }
  function display(l,record,index,premiere=false,pair=null){
    stop();downloadRun++;
    const beats=record.map((_,i)=>replayBeat(l,record,i)),all=record.length===l.play.frames.length;
    const last=beats.length-1;
    showing={l,record,beats,scenes:beats.map(b=>b.scene),actor:layScreen($('slip-large-screen'),l,art),index:-1,all,pair};
    $('slip-kicker').textContent=l.title+'　/　'+(all?'全剧已收录':('已演 '+record.length+' 拍'));
    $('slip-map').hidden=$('slip-proof-text').hidden=true;$('slip-large-screen').hidden=false;
    $('slip-proof').setAttribute('aria-expanded','false');$('slip-proof').textContent='看当场镜位';
    $('slip-lever').hidden=!last;$('slide-lever').max=String(last*100);$('slip-print-status').textContent='';
    $('slip-continue').textContent=!all?'继续换景':l.showIndex<slipPlays.length-1?'排下一出':'翻活动戏本';
    $('slip-other').hidden=!all;$('slip-other').textContent=endings(l).length>1?'排演另一结尾':'再演一次';
    const shared=canTakeRequests(l,record);
    $('audience-choice').hidden=!pair;
    $('audience-choice').innerHTML=pair?'<span>观众点戏</span>'+pair.map((run,i)=>{
      const scene=readProjector(l,run.at(-1)).scene;
      return '<button type="button" data-request="'+i+'" aria-pressed="'+(beats.at(-1).result.scene===scene)+'">'+l.projection.scenes[scene].title+'</button>';
    }).join(''):'';
    $('slip-encore-note').hidden=!shared;
    if(shared){
      $('slip-encore-note').textContent=pair?'两次演出用了相同的前两拍。点一个结尾，就从共同的中场接演。':
        all && encoreBill(l)?'阁楼点戏签已收进活动戏本。':
        all?'中场给观众留下了两个结尾。用原班镜位加演另一幕，就能收到点戏签。':'这套中场镜位能让鲸停在窗前，也能送它游向天明。';
      if(all)$('slip-other').textContent='原班加演另一幕';
    }
    $('print-play').hidden=!all;$('print-play').disabled=false;
    const motion=premiere && index>0 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    showPosition((motion?index-1:index)*100);if(!$('slip-dialog').open)$('slip-dialog').showModal();
    if(motion)travel((index-1)*100,index*100);
  }
  function project(){
    if(finished()){display(level,takes,0);return;}
    const board=slots(),index=takes.length;
    if(takeScene(level,takes,board)<0){
      tell('这一拍还没对上。按场记核对两盏灯的出口，点「试灯」可看各自的路径。');return;
    }
    const next=[...takes,board.map(({x,y,o})=>({x,y,o}))];
    if(next.length===level.play.frames.length)storePlaybill(level,next);
    setDesk(next,next.at(-1));chime(0,true);display(level,next,index,true);
  }
  function openArchive(){
    $('slip-archive').open=true;const s=$('slip-archive').querySelector('summary');s.focus({preventScroll:true});s.scrollIntoView({block:'nearest'});
  }
  function aim(id){
    ending=id;write('slip:ending:'+level.id,id);$('slip-forecast').textContent='';score();clearStep();
  }
  $('slip-select').innerHTML=slipPlays.map((l,i)=>'<option value="'+i+'">'+two(i+1)+'　'+l.title+'</option>').join('');
  $('slip-select').onchange=()=>open(slipPlays[+$('slip-select').value]);
  $('slip-program').open=matchMedia('(min-width: 651px)').matches;
  $('slip-desk').onclick=()=>{if(!$('bench').classList.contains('slip-bench'))open(lastPlay());};
  $('to-plays').onclick=openArchive;
  $('overlay-slip').onclick=()=>{overlay=!overlay;repaint();};
  $('reseat-slip').onclick=()=>{const id=selected();if(hold && id>=0 && !slots()[id])seat(id,hold.base[id]);};
  $('slip-endings').onclick=e=>{
    const b=e.target.closest('[data-end]');if(!b)return;aim(+b.dataset.end);
    tell('场记和提示正在排演「'+level.projection.scenes[ending].title+'」。最后一拍的实际光路决定演出的结尾。');
  };
  $('slip-cues').onclick=e=>{const b=e.target.closest('[data-replay]');if(b)display(level,takes,+b.dataset.replay);};
  $('keep-both').onchange=()=>{
    encore=$('keep-both').checked;write('slip:requests:'+level.id,encore);$('slip-forecast').textContent='';clearStep();
    tell(encore?'提示会寻找能把两个结尾都留到中场的拼法。':'提示会继续寻找所选的结尾。');
  };
  $('retake-slip').onclick=()=>rewind(takes.length-1);
  $('predict-slip').onclick=()=>{
    const board=slots(),look=sightline(level,takes,board,ending,encore),title=level.projection.scenes[ending].title;
    let line;
    if(look.scene<0)line='眼前这拍的出口还没对上，可以先单看一束光。';
    else if(look.possible)line=encore?'观众点戏的两条路都接得上，可以放心落片。':'这一拍能接到「'+title+'」。可以放心落片。';
    else if(takes.length===level.play.frames.length-1 && look.scene!==ending)
      line='照这套镜位落片，将收录「'+level.projection.scenes[look.scene].title+'」。';
    else if(encore && sightline(level,takes,board,ending).possible)
      line='这套镜位能接到「'+title+'」，但没给观众留下两个结尾。想拿点戏签，可以看一步提示改排。';
    else line='眼前这拍能演，后面却接不到「'+title+'」。可查看一步提示，或保留这次拼法试演。';
    forecastBoard=board;$('slip-forecast').textContent=line;
  };
  $('playbill-grid').onclick=e=>{const b=e.target.closest('[data-bill]');if(!b || b.disabled)return;
    const l=slipPlays[+b.dataset.bill],record=playbill(l,+b.dataset.ending);if(record)display(l,record,0);};
  $('read-encore').onclick=()=>{
    const l=slipPlays.at(-1),pair=encoreBill(l);if(pair)display(l,pair[0],1,false,pair);
  };
  $('audience-choice').onclick=e=>{
    const b=e.target.closest('[data-request]');if(!b || !showing?.pair)return;
    const {l,pair}=showing;display(l,pair[+b.dataset.request],l.play.frames.length-1,true,pair);
  };
  $('slide-lever').oninput=()=>{stop();showPosition(+$('slide-lever').value);};
  $('run-slip').onclick=()=>{
    if(raf){stop();return;}
    const end=+$('slide-lever').max,at=+$('slide-lever').value;travel(at===end?0:at,end);
  };
  $('slip-proof').onclick=()=>{
    const reveal=$('slip-map').hidden;stop();
    $('slip-map').hidden=$('slip-proof-text').hidden=!reveal;$('slip-large-screen').hidden=reveal;
    $('slip-proof').setAttribute('aria-expanded',String(reveal));$('slip-proof').textContent=reveal?'回到幕布':'看当场镜位';
  };
  $('slip-dialog').addEventListener('close',stop);
  $('slip-continue').onclick=()=>{
    const {l,all}=showing;$('slip-dialog').close();
    if(all && l.showIndex<slipPlays.length-1){open(slipPlays[l.showIndex+1]);window.scrollTo(0,0);}
    else if(all)openArchive();
    else $('slip-hold').scrollIntoView({block:'nearest'});
  };
  $('slip-other').onclick=()=>{
    const {l,record,beats}=showing;$('slip-dialog').close();
    const alternatives=endings(l),other=alternatives.find(id=>id!==beats.at(-1).result.scene);
    level=l;
    if(other!=null){
      write('slip:ending:'+l.id,other);
      const i=rewindPoint(l,record,other,read('slip:requests:'+l.id)===true);setDesk(record.slice(0,i),record[i]);
      tell('保留前 '+i+' 拍，从第 '+(i+1)+' 拍改排「'+l.projection.scenes[other].title+'」。');
    }else{setDesk([],null);tell('已铺好开场玻璃，收过的戏本可以随时翻看。');}
  };
  $('print-play').onclick=async()=>{
    const {l,record}=showing,run=++downloadRun;$('print-play').disabled=true;
    try{
      const blob=await longTicket(l,record,art);if(run!==downloadRun || !$('slip-dialog').open)return;
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='留灯换景-'+showing.scenes.at(-1).title+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('slip-print-status').textContent='长票已冲印，票下记着每次交灯和换片。';
    }catch{if(run===downloadRun)$('slip-print-status').textContent='这次冲印没有成功，可以重试。';}
    finally{if(run===downloadRun)$('print-play').disabled=false;}
  };
  return {load,configure,paint,cover,clamps,issue,project,sceneId,finished,rewind,
    held:id=>Boolean(hold?.held.includes(id)),keeper:()=>hold?.keeper,
    resetDesk:()=>deskAt(level,takes.at(-1)),save:(state,history)=>savePlay(level,takes,state,history),
    step:(placed,selected)=>cueHint(level,takes,placed,selected,ending,encore)};
}
