import {lampNames,portName} from './light-path.mjs';
import {drawTicketMap,lampRoute} from './lantern-glass.mjs';
import {edgePath} from './glass.mjs';
import {fits,markCell,mirrorFalls,shapeAt} from './puzzle.mjs';
import {readProjector} from './projection.mjs';
import {read,write} from './save.mjs';
import {slipPlays} from './slip-plays.mjs';
import {allDuets,duetCasts,relayCasts,receiptCasts,receiptFor,fiveAct,isDuet,orderName,partnerOrder,programmes} from './duet-plays.mjs';
import {acceptsMark,activeMarks,markReading,markTask,propRecord} from './duet-marks.mjs';
import {bestShow,continueReceipt,duetBills,enterReceipt,lastDuet,openingForecast,resumeProgramme,setupDuetControls} from './duet-desk.mjs';
import {canTakeRequests,changeTotal,cueHint,deskAt,differentPanes,encoreBill,firstMissedMark,handStatus,makeHold,playbill,quietScore,readTrace,remainingCost,restorePlay,rewindPoint,savePlay,setTrace,signedWith,sightline,storePlaybill,takeScene,usablePrefix} from './slip-path.mjs';
import {readingNames} from './receipt-plays.mjs';
import {layScreen,longTicket,moveScreen,replayBeat,stagePose} from './slip-screen.mjs';

const $=id=>document.getElementById(id);
const two=n=>String(n).padStart(2,'0');
const endings=l=>l.play.frames.at(-1).scenes;
const names=(l,ids)=>ids.map(id=>l.pieces[id].name).join('、');
function beatProof(l,beat,index){
  const route='第 '+(index+1)+' 拍定格。'+(l.play.delivery?propRecord(l,index)+'。':'')+lampRoute(l,beat.scene);
  return beat.held?route+'。这一拍由'+lampNames[beat.held.keeper]+'守住'+names(l,beat.held.held)+'，实际换了'+names(l,beat.changed)+'。':route+'。这是全剧的开场镜位。';
}
export const lastPlay=()=>resumeProgramme([...slipPlays,...allDuets].find(l=>l.id===read('slip:active')) || slipPlays[0]);
const nextPlay=l=>[slipPlays.length-1,duetCasts.at(-1)[0].showIndex,relayCasts.at(-1)[0].showIndex].includes(l.showIndex)?null:programmes[l.showIndex+1];

export function setupSlips({open,slots,selected,deskState,seat,repaint,clearStep,tell,chime,art}) {
  let level,takes=[],hold=null,ending,encore=false,showing=null,raf=0,downloadRun=0,overlay=false,forecastBoard,reference=null;
  const duet=setupDuetControls(switchOrder,(quiet,both)=>{
    $('slip-forecast').textContent='';clearStep();repaint();
    tell(both && quiet?'提示会按两种演法都能达到的最低响数排演。':both?'提示会照顾两条路线上的灯位。':quiet?'提示会按整场最少的换片数排演。':'提示会寻找能演到收场的镜位。');
  },(l,record,shared,pair)=>{display(l,record,0);if(pair)compare(false,pair[1]);else if(shared)compare(true);},switchReading);
  const twoWays=()=>encore || duet.both();
  function switchOrder(other){
    if(reference || takes.length>1 || !level.play.delivery && hold && handStatus(level,hold,slots()).changed.length)return;
    const current=deskState();if(other.play.delivery)setTrace(other,null);
    savePlay(other,takes,current.state,takes.length && !level.play.delivery?[]:current.history);open(other);
    $('duet-buttons').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    tell('已改为'+orderName(other)+'。'+(takes.length?'开场镜位已保留。':'可以继续拼开场。'));
  }
  function switchReading(other){
    if(reference || takes.length>5 || takes.length===5 && handStatus(level,hold,slots()).changed.length)return;
    const current=deskState();setTrace(other,null);savePlay(other,takes,current.state,current.history);open(other);
    $('reading-buttons').querySelector('[aria-pressed="true"]').focus({preventScroll:true});
    const keep=usablePrefix(other,takes,duet.both(),duet.quiet());
    tell('已改为'+readingNames[other.play.coda.mode]+'。'+(keep<takes.length?'这条回路最晚从第 '+(keep+1)+' 拍改起，点一步提示可以倒回。':'已演的 '+takes.length+' 拍和桌上的玻璃都已保留。'));
  }
  const finished=()=>takes.length===level.play.frames.length;
  function sceneId(){
    if(finished())return readProjector(level,takes.at(-1)).scene;
    const candidates=level.play.frames[takes.length].scenes;
    return candidates.includes(ending)?ending:candidates[0];
  }
  function load(l){
    const restored=restorePlay(l);level=l;takes=restored.takes;
    reference=readTrace(l,takes);
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
    const frame=level.play.frames[takes.length];
    const marks=activeMarks(frame,duet.both()||reference).filter(m=>m.kind!=='wait').map(m=>{
      if(m.kind==='watermark')return m.cells.map((cell,i)=>{
        const x=(cell%level.width+.5)*48,y=(Math.floor(cell/level.width)+.5)*48,color=m.lamp?'#96f5ef':'#ffe197';
        return '<g data-relay-mark="watermark" transform="translate('+x+' '+y+')" fill="none"><circle r="15" stroke="#2e383a" stroke-width="5"/><circle r="15" stroke="'+color+'" stroke-width="2" stroke-dasharray="4 3"/><circle cx="-11" cy="10" r="7" fill="#28383e" stroke="'+color+'"/><text x="-11" y="13.3" text-anchor="middle" font-size="10" font-weight="bold" fill="'+color+'">'+(i+1)+'</text></g>';
      }).join('');
      const x=(m.cell%level.width+.5)*48,y=(Math.floor(m.cell/level.width)+.5)*48,pass=m.kind==='pass';
      const shape=pass?'<circle r="15"/>':'<rect x="-13" y="-13" width="26" height="26" rx="'+(m.lamp?10:2)+'"/>';
      return '<g data-relay-mark="'+m.kind+'" transform="translate('+x+' '+y+')" fill="none"><g stroke="#353234" stroke-width="4.5">'+shape+'</g><g stroke="'+(pass?'#fff2bd':m.lamp?'#99fbef':'#ffda84')+'" stroke-width="2" stroke-dasharray="6 2">'+shape+'</g></g>';
    }).join('');
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
    return prior+marks+hold.held.map(id=>{
      const p=hold.base[id],x=p.x*48+37,y=p.y*48+10;
      return '<g transform="translate('+x+' '+y+')"><rect x="-7.3" y="-7" width="14.6" height="14" rx="3" fill="#334544" stroke="#f8dd92" stroke-width="1.4"/><text y="3.6" text-anchor="middle" font-size="9.5" fill="#fff2c8">守</text></g>';
    }).join('');
  }
  function cover(){
    $('hero').classList.remove('is-night','is-letter','is-roll');$('hero').classList.add('is-lantern','is-slip');
    $('jacket').hidden=false;$('jacket').src=art(level.play.artId||level.play.id,'bg');$('sequel').hidden=true;
    $('volume-name').textContent='Petal Panes · Slipping Glass';
    $('page-title').textContent='留灯换景';$('hero-line').textContent=level.play.delivery?'让两束光在途中相遇，把手里的东西递给等它的人。':isDuet(level)?'两张玻璃，各有一束光。你来决定谁先动。':'留一盏灯照着原处，让另一张玻璃上的故事动起来。';
  }
  function archive(){
    let n=0;
    $('playbill-grid').innerHTML=slipPlays.flatMap((l,index)=>endings(l).map(s=>{
      const saved=playbill(l,s);if(saved)n++;
      return '<button type="button" data-bill="'+index+'" data-ending="'+s+'" '+(saved?'':'disabled')+'><span>'+two(index+1)+'</span><strong>'+l.title+'</strong><small>'+(saved?'可重映':'待演全')+' · '+l.projection.scenes[s].title+'</small></button>';
    })).join('');
    $('playbill-count').textContent=n+' / 5 本　·　合演 '+duetBills()+' / 4 场　·　递物 '+duetBills(relayCasts)+' / 4 场　·　回执 '+duetBills(receiptCasts)+' / 8 场';
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
        (f.keeper==null?'开场自由拼片':'守'+lampNames[f.keeper]+' · 最多换 '+f.limit+' 片')+'</small>'+
        (f.mark?'<small>'+markTask(level,f.mark)+'</small>':'')+'</div></li>';
    }).join('');
  }
  function configure(target){
    const yes=Boolean(target.play);
    $('bench').classList.toggle('slip-bench',yes);
    $('slip-desk').setAttribute('aria-pressed',String(yes));
    for(const id of ['slip-bar','slip-hold','slip-run-sheet','slip-scorecard','slip-archive'])$(id).hidden=!yes;
    $('slip-overlay-tools').hidden=!yes || !hold;overlay=false;forecastBoard=null;$('slip-forecast').textContent='';
    $('trace-panel').hidden=!yes || !reference;
    if(!yes){duet.configure(target,null);return;}
    $('trace-template').open=false;
    if(reference)drawTicketMap($('trace-map'),level,replayBeat(level,reference,takes.length));
    $('to-duets').hidden=isDuet(level);
    $('to-relay').hidden=!isDuet(level) || Boolean(level.play.coda);$('to-relay').textContent=level.play.delivery?'回这组正场':'演递物返场';
    $('to-receipts').hidden=!level.play.delivery;$('to-receipts').textContent=level.play.coda?'回五拍返场':'续演回执';
    $('slip-select').value=String(level.showIndex);$('slip-letter').textContent=level.request;
    $('slip-tip').textContent=level.projection.cue;$('slip-notes').open=false;
    const stage=layScreen($('slip-small-screen'),level,art);duet.configure(level,stage,art);
    const current=takes.at(-1),scene=current?level.projection.scenes[readProjector(level,current).scene]:null;
    moveScreen(stage,scene?.pose,scene?.partnerPose,Math.max(0,takes.length-1));$('slip-small-screen').setAttribute('aria-label',level.play.backdrop+'，'+(scene?scene.title:'等待开场'));
    score();archive();cover();
  }
  function paint(placed,result){
    duet.paint(takes,hold,placed,result,reference);
    if(reference){
      const diff=differentPanes(level,placed,reference[takes.length]);
      $('trace-count').textContent='第 '+(takes.length+1)+' 拍 · '+(diff.length?'还差 '+diff.length+' 片':'已对齐底稿');
      $('trace-panes').textContent=diff.length?'待对齐的玻璃为'+names(level,diff)+'。一步提示会按底稿排片。':'镜位和底稿吻合，可以落片。';
    }
    $('slip-hold').textContent=rules(placed);$('slip-hold').classList.toggle('has-hold',Boolean(hold));
    $('predict-slip').disabled=finished() || !placed.every(Boolean);$('retake-slip').disabled=!takes.length;
    const m=level.play.frames[takes.length]?.mark;
    $('project-slide').textContent=finished()?'重映整出':m?.kind==='pass'?'落片并'+(m.action||level.play.delivery.verb):m?.kind==='watermark'?'落片验回签':m?.kind==='stamp'?'落片盖印':m?.kind==='wait'?'落片留到下一站':'落下这一拍';
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
    const alternate=v.comparison?.level;
    $('slide-lever').setAttribute('aria-valuetext','第 '+(index+1)+' 拍，'+beat.scene.title+(alternate?.play.delivery?'。另一幕，'+propRecord(alternate,index):''));
    function projectStage(stage,scenes){
      moveScreen(stage,stagePose(scenes,pos),stage.partner?stagePose(scenes,pos,'partnerPose',v.l.play.arc):null,pos);
    }
    projectStage(v.stage,v.scenes);
    if(v.comparison)projectStage(v.comparison.stage,v.comparison.scenes);
    if(v.index===index)return;
    v.index=index;
    $('slip-title').textContent=v.comparison?'第 '+(index+1)+' 拍 · '+(v.l.play.delivery?['出发','第一处交接','各自的印','第二处交接','送达','双孔验印','回签归还'][index]:beat.scene===v.comparison.beats[index].scene?beat.scene.title:'谁先动'):beat.scene.title;
    $('slip-caption').textContent=(v.comparison?orderName(v.l)+' · ':'')+beat.scene.story;
    $('slip-large-screen').setAttribute('aria-label',v.l.play.backdrop+'，'+beat.scene.title);
    $('slip-proof-text').textContent=(v.comparison?orderName(v.l)+' · ':'')+beatProof(v.l,beat,index);
    if(v.comparison){
      const other=v.comparison.beats[index];
      $('duet-alt-caption').textContent=orderName(v.comparison.level)+' · '+other.scene.story;
      $('duet-alt-screen').setAttribute('aria-label',other.scene.title);
      $('duet-main-label').textContent=orderName(v.l)+' · '+beat.scene.title;
      $('duet-alt-label').textContent=(v.comparison.rehearsal?'同谱试演 · ':'')+orderName(v.comparison.level)+' · '+other.scene.title;
      $('duet-main-tally').textContent='本拍 '+beat.changed.length+' 响　/　全剧 '+changeTotal(v.l,v.record)+' 响';
      $('duet-alt-tally').textContent='本拍 '+other.changed.length+' 响　/　全剧 '+changeTotal(v.comparison.level,v.comparison.takes)+' 响';
      $('duet-proof-main').textContent=$('duet-main-label').textContent;$('duet-proof-label').textContent=$('duet-alt-label').textContent;
      $('duet-alt-proof-text').textContent=orderName(v.comparison.level)+' · '+beatProof(v.comparison.level,other,index);
      drawTicketMap($('duet-alt-map'),v.comparison.level,other);
    }
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
    showing={l,record,beats,scenes:beats.map(b=>b.scene),stage:layScreen($('slip-large-screen'),l,art),index:-1,all,pair};
    $('slip-kicker').textContent=l.title+'　/　'+(isDuet(l)?orderName(l)+'　·　':'')+(all?'全剧已收录':('已演 '+record.length+' 拍'));
    $('duet-stage-pair').hidden=false;$('slip-dialog').classList.remove('compare-open');
    $('slip-dialog').classList.toggle('relay-show',Boolean(l.play.delivery));
    $('duet-main-label').hidden=$('duet-main-tally').hidden=$('duet-alt-pane').hidden=$('duet-alt-caption').hidden=true;
    $('slip-proof-pair').hidden=$('duet-proof-main').hidden=$('duet-proof-other').hidden=$('duet-alt-proof-text').hidden=true;
    $('compare-duet').hidden=!all || !isDuet(l) || !bestShow(partnerOrder(l));
    $('compare-duet').setAttribute('aria-pressed','false');$('compare-duet').textContent=l.play.delivery?'对照两场实演':'并排看两种先手';
    const miss=all && l.play.delivery?firstMissedMark(l,record):-1;
    const repair=all && l.play.delivery && (miss>=0 || l.play.coda && changeTotal(l,record)>quietScore(l,true).target);
    $('repair-double').hidden=!repair;$('other-reading').hidden=!all || !l.play.coda;
    $('revise-receipt').hidden=!repair && $('other-reading').hidden;
    if(repair){
      showing.repair=usablePrefix(l,record,true,Boolean(l.play.coda));
      $('repair-double').textContent='从第 '+(showing.repair+1)+' 拍'+(miss>=0?'补两印':'改排兼演静场');
    }
    if(all && l.play.coda)$('other-reading').textContent='改演'+readingNames[1-l.play.coda.mode];
    $('compare-score').hidden=!all || !l.play.delivery || miss>=0;
    $('sign-score').hidden=!all || !l.play.delivery || miss>=0;
    showing.signed=all && l.play.delivery && miss<0?signedWith(l,record):null;
    $('sign-score').textContent=showing.signed?'看这张同谱双签联':'照底谱实演另一印';
    $('extend-show').hidden=!all || !l.play.delivery || Boolean(l.play.coda);
    $('compare-score').setAttribute('aria-pressed','false');$('compare-score').textContent='同谱换手试映';
    $('print-play').textContent=l.play.delivery?'保存交接联 PNG':'保存连景长票 PNG';
    $('duet-receipt').hidden=!isDuet(l) || !all;
    $('retry-quiet').hidden=true;
    if(!$('duet-receipt').hidden){
      const cost=changeTotal(l,record),target=quietScore(l).target;
      $('retry-quiet').hidden=cost===target;$('retry-quiet').textContent=l.play.coda?'按单场静场改排':'按静场目标改排';
      if(l.play.coda && miss<0 && cost===quietScore(l,true).target){
        $('duet-receipt').textContent='兼演静场　这张底谱只需 '+cost+' 响就能兼演两种递法。'+(cost===target?'这一场也收到了单场静场笺。':'单独排「'+orderName(l)+'」还可以省 '+(cost-target)+' 响。');
      }else $('duet-receipt').textContent='全剧 '+cost+' 响，静场目标 '+target+' 响。'+(cost===target?'收班笺　'+l.play.note:'按静场目标重演，可以收到这套演法的收班笺。');
    }
    $('slip-map').hidden=$('slip-proof-text').hidden=true;$('slip-large-screen').hidden=false;
    $('slip-proof').setAttribute('aria-expanded','false');$('slip-proof').textContent='看当场镜位';
    $('slip-lever').hidden=!last;$('slide-lever').max=String(last*100);$('slip-print-status').textContent='';
    $('slip-continue').textContent=!all?'继续换景':nextPlay(l)?'排下一出':'翻活动戏本';
    $('slip-other').hidden=!all;$('slip-other').textContent=endings(l).length>1?'排演另一结尾':'再演一次';
    if(isDuet(l))$('slip-other').textContent='换'+orderName(partnerOrder(l));
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
    if(all && l.play.delivery){
      $('slip-encore-note').hidden=false;
      $('slip-encore-note').textContent=miss<0?'已收两印底谱。'+(l.play.coda?'这七拍可以换印验回签，兼演最低 '+quietScore(l,true).target+' 响。':'这五拍也能在另一站交接。')+
        (showing.signed?'这张底谱的两场实演已合签。':'照这张底谱亲手演完另一印，就能合签。'):
        '原谱改演「'+orderName(partnerOrder(l))+'」会卡在第 '+(miss+1)+' 拍。'+markTask(l,l.play.frames[miss].peerMark)+'。';
    }
    $('print-play').hidden=!all;$('print-play').disabled=false;
    const motion=premiere && index>0 && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    showPosition((motion?index-1:index)*100);if(!$('slip-dialog').open)$('slip-dialog').showModal();
    $('slip-dialog').scrollTop=0;
    if(motion)travel((index-1)*100,index*100);
  }
  function project(){
    if(finished()){display(level,takes,0);return;}
    const board=slots(),index=takes.length;
    if(reference){
      const diff=differentPanes(level,board,reference[index]);
      if(diff.length){tell('本拍还有 '+diff.length+' 片与底稿不同。翻看本拍底稿或用一步提示对齐。');return;}
    }
    if(takeScene(level,takes,board)<0){
      const f=level.play.frames[index],r=readProjector(level,board);
      tell(f.scenes.includes(r.scene) && !acceptsMark(f,level.width,r.rays)?markReading(level,f.mark,r.rays)+'。':
        '这一拍还没对上。按场记核对两盏灯的出口，点「试灯」可看各自的路径。');return;
    }
    const next=[...takes,board.map(({x,y,o})=>({x,y,o}))];
    const cuePanes=isDuet(level) && hold?handStatus(level,hold,board).changed:null;
    if(level.play.coda && next.length===5)storePlaybill(fiveAct(level),next);
    if(next.length===level.play.frames.length){storePlaybill(level,next);if(reference)setTrace(level,null);}
    setDesk(next,next.at(-1));chime(0,true,cuePanes);display(level,next,index,true);
  }
  function openArchive(){
    $('slip-archive').open=true;const s=$('slip-archive').querySelector('summary');s.focus({preventScroll:true});s.scrollIntoView({block:'nearest'});
  }
  function aim(id){
    ending=id;write('slip:ending:'+level.id,id);$('slip-forecast').textContent='';score();clearStep();
  }
  const option=l=>'<option value="'+l.showIndex+'">'+two(l.showIndex+1)+'　'+l.title+'</option>';
  $('slip-select').innerHTML='<optgroup label="活动片">'+slipPlays.map(option).join('')+'</optgroup><optgroup label="双片合演">'+duetCasts.map(pair=>option(pair[0])).join('')+'</optgroup><optgroup label="递物返场">'+relayCasts.map(pair=>option(pair[0])).join('')+'</optgroup><optgroup label="七拍回执">'+receiptCasts.map(f=>option(f[0][0])).join('')+'</optgroup>';
  $('slip-select').onchange=()=>{const selected=programmes[+$('slip-select').value];open(selected.play.coda?enterReceipt(selected):resumeProgramme(selected));};
  $('slip-program').open=matchMedia('(min-width: 651px)').matches;
  $('slip-desk').onclick=()=>{if(!$('bench').classList.contains('slip-bench'))open(lastPlay());};
  $('to-plays').onclick=openArchive;
  $('to-duets').onclick=()=>open(lastDuet());
  $('to-receipts').onclick=()=>open(level.play.coda?resumeProgramme(fiveAct(level)):enterReceipt(receiptFor(level)));
  $('extend-show').onclick=()=>{
    const {l,record}=showing,plan=continueReceipt(l,record);$('slip-dialog').close();open(plan.l);
    tell('沿用原戏前 '+plan.keep+' 拍，以「'+readingNames[plan.l.play.coda.mode]+'」续演。'+(plan.keep<5?'从第 '+(plan.keep+1)+' 拍起为回程留路。':'接下来验回签。'));
  };
  $('other-reading').onclick=()=>{
    const {l,record}=showing,other=receiptFor(l,1-l.play.coda.mode),prefix=record.slice(0,5);
    const n=usablePrefix(other,prefix,read('relay:both:'+l.play.id)===true,read('duet:quiet:'+l.play.id)===true);
    $('slip-dialog').close();setTrace(other,null);level=other;setDesk(prefix.slice(0,n),prefix[n]||prefix[n-1]);
    tell('已保留前 '+n+' 拍。'+(n===5?'这套收场能直接换读法。':'从第 '+(n+1)+' 拍起，为「'+readingNames[other.play.coda.mode]+'」留路。'));
  };
  $('repair-double').onclick=()=>{
    const {l,record,repair}=showing;if(repair==null)return;
    $('slip-dialog').close();setTrace(l,null);write('relay:both:'+l.play.id,true);write('duet:quiet:'+l.play.id,Boolean(l.play.coda));
    level=l;setDesk(record.slice(0,repair),record[repair]);
    tell('已保留能接上两印的前 '+repair+' 拍。从第 '+(repair+1)+' 拍起排'+(l.play.coda?'兼演静场。':'另一枚印。'));
  };
  $('sign-score').onclick=()=>{
    const {l,record}=showing,other=partnerOrder(l);
    if(showing.signed){compare(false,showing.signed[1-l.play.delivery.version]);return;}
    if(firstMissedMark(l,record)>=0 || !setTrace(other,record))return;
    $('slip-dialog').close();savePlay(other,[],deskAt(other,null),[]);open(other);
    tell('这次在'+other.play.delivery.stops[other.play.delivery.version]+'交接。每拍照底稿亲手落片，收场即可合签。');
  };
  $('leave-trace').onclick=()=>{
    setTrace(level,null);open(level);tell('已转为自由排演。刚才落下的镜位和本拍改动都已保留。');
  };
  $('to-relay').onclick=()=>{
    const group=level.play.delivery?duetCasts:relayCasts;
    const cast=group.find(([l])=>(l.play.castId||l.play.id)===(level.play.castId||level.play.id));
    if(cast)open(resumeProgramme(cast[0]));
  };
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
    const board=slots();
    if(reference){
      const diff=differentPanes(level,board,reference[takes.length]);
      $('slip-forecast').textContent=diff.length?'还需对齐'+names(level,diff)+'，才能用同一张底稿合签。':'本拍与底稿逐片相同，可以放心落片。';forecastBoard=board;return;
    }
    const look=sightline(level,takes,board,ending,twoWays(),duet.quiet()),title=level.projection.scenes[ending].title;
    let line;
    if(look.scene<0){
      const f=level.play.frames[takes.length],r=readProjector(level,board);
      line=f.scenes.includes(r.scene) && f.mark?markReading(level,f.mark,r.rays)+'。':'眼前这拍的出口还没对上，可以先单看一束光。';
    }
    else if(isDuet(level) && !takes.length)line=openingForecast(level,board,duet.quiet(),duet.both())+(look.possible?'可以放心落片。':'可以改排或看一步提示。');
    else if(duet.both() && duet.quiet() && !look.possible && sightline(level,takes,board,ending,true,false).possible)
      line='两种递法都能演完。要达到兼演静场的 '+quietScore(level,true).target+' 响，还要改排。';
    else if(duet.both())line=look.possible?(duet.quiet()?'两种递法都能静场，可以放心落片。':'两种递法都能演完，可以放心落片。'):
      '这套镜位接不到两印底谱。一步提示会找到还能兼演的镜位或可倒回的拍次。';
    else if(look.possible)line=encore?'观众点戏的两条路都接得上，可以放心落片。':'这一拍能接到「'+title+'」。'+(duet.quiet()?'还能达到静场目标。':'')+'可以放心落片。';
    else if(duet.quiet() && sightline(level,takes,board,ending).possible)line='这场能演完，按眼前的镜位会超过静场目标。可以照常落片收戏本，或用一步提示改排。';
    else if(takes.length===level.play.frames.length-1 && look.scene!==ending)
      line='照这套镜位落片，将收录「'+level.projection.scenes[look.scene].title+'」。';
    else if(encore && sightline(level,takes,board,ending).possible)
      line='这套镜位能接到「'+title+'」，但没给观众留下两个结尾。想拿点戏签，可以看一步提示改排。';
    else line='眼前这拍能演，后面却接不到「'+title+'」。可查看一步提示，或保留这次拼法试演。';
    if(isDuet(level) && takes.length && look.scene>=0){
      const cost=remainingCost(level,takes,board,duet.both());
      if(cost)line+='按本拍落片，全剧最低 '+cost.total+' 响，余下至少换 '+cost.remaining+' 片。';
    }
    if(level.play.coda && takes.length===4 && look.scene>=0){
      const other=receiptFor(level,1-level.play.coda.mode),alt=remainingCost(other,takes,board,duet.both());
      line+='若改「'+readingNames[other.play.coda.mode]+'」，'+(alt?'这套镜位全剧最低 '+alt.total+' 响。':'须改第五拍或更早的镜位。');
    }
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
  function compare(rehearsal,signedRecord=null){
    const v=showing;if(!v?.all || !isDuet(v.l))return;
    if(rehearsal && (!v.l.play.delivery || firstMissedMark(v.l,v.record)>=0))return;
    const other=partnerOrder(v.l),record=signedRecord || (rehearsal?v.record:bestShow(other));if(!record)return;
    stop();downloadRun++;$('print-play').disabled=false;$('slip-print-status').textContent='';
    if(!$('slip-map').hidden)$('slip-proof').click();
    if(v.comparison?.rehearsal===rehearsal && v.comparison.signed===Boolean(signedRecord))v.comparison=null;
    else{
      const beats=record.map((_,i)=>replayBeat(other,record,i));
      v.comparison={level:other,takes:record,beats,rehearsal,signed:Boolean(signedRecord),scenes:beats.map(b=>b.scene),stage:layScreen($('duet-alt-screen'),other,art)};
    }
    const on=Boolean(v.comparison);
    $('slip-dialog').classList.toggle('compare-open',on);$('duet-alt-pane').hidden=$('duet-alt-caption').hidden=$('duet-main-label').hidden=$('duet-main-tally').hidden=!on;
    $('slip-kicker').textContent=v.l.title+'　/　'+(on?(signedRecord?'同谱合签 · 两场实演':rehearsal?'两印底谱 · 同谱试映':'双幕对照'):orderName(v.l)+'　·　全剧已收录');
    $('compare-duet').setAttribute('aria-pressed',String(on && !rehearsal && !signedRecord));$('compare-duet').textContent=on && !rehearsal && !signedRecord?'回到单幕':v.l.play.delivery?'对照两场实演':'并排看两种先手';
    if(v.signed)$('sign-score').textContent=on && signedRecord?'收起双签联':'看这张同谱双签联';
    $('compare-score').setAttribute('aria-pressed',String(on && rehearsal));$('compare-score').textContent=on && rehearsal?'回到单幕':'同谱换手试映';
    $('print-play').textContent=on && signedRecord?'保存同谱双签联 PNG':v.l.play.delivery?(on?'保存双幕交接联 PNG':'保存交接联 PNG'):on?'保存双幕对照票 PNG':'保存连景长票 PNG';
    $('slip-proof').textContent=on?'对照两幕镜位':'看当场镜位';
    v.index=-1;showPosition(on?(v.l.play.coda?500:v.l.play.delivery?200:100):+$('slide-lever').value);
    if(on){$('slide-lever').focus({preventScroll:true});$('slip-dialog').scrollTop=0;}
  }
  $('compare-duet').onclick=()=>compare(false);
  $('compare-score').onclick=()=>compare(true);
  $('retry-quiet').onclick=()=>{
    const {l,record}=showing,index=rewindPoint(l,record,endings(l)[0],false,true);
    $('slip-dialog').close();if(l.play.delivery){write('relay:both:'+l.play.id,false);setTrace(l,null);}
    write('duet:quiet:'+l.play.id,true);level=l;setDesk(record.slice(0,index),record[index]);
    tell('从第 '+(index+1)+' 拍起改排静场，之前落下的 '+index+' 拍已经留好。');
  };
  $('slip-proof').onclick=()=>{
    const reveal=$('slip-map').hidden;stop();
    $('slip-map').hidden=$('slip-proof-text').hidden=!reveal;$('slip-large-screen').hidden=reveal;
    $('duet-stage-pair').hidden=reveal;$('duet-alt-caption').hidden=reveal || !showing?.comparison;
    $('slip-proof-pair').hidden=!reveal;
    $('duet-proof-main').hidden=$('duet-proof-other').hidden=$('duet-alt-proof-text').hidden=!reveal || !showing?.comparison;
    $('slip-proof').setAttribute('aria-expanded',String(reveal));$('slip-proof').textContent=reveal?'回到幕布':showing?.comparison?'对照两幕镜位':'看当场镜位';
    if(showing?.comparison){$('slide-lever').focus({preventScroll:true});$('slip-dialog').scrollTop=0;}
  };
  $('slip-dialog').addEventListener('close',stop);
  $('slip-continue').onclick=()=>{
    const {l,all}=showing;$('slip-dialog').close();
    if(all && nextPlay(l)){const next=nextPlay(l);open(next.play.coda?enterReceipt(next):resumeProgramme(next));window.scrollTo(0,0);}
    else if(all)openArchive();
    else $('slip-hold').scrollIntoView({block:'nearest'});
  };
  $('slip-other').onclick=()=>{
    const {l,record,beats}=showing;$('slip-dialog').close();
    if(isDuet(l)){
      const other=partnerOrder(l),goal=endings(other)[0],wantsQuiet=read('duet:quiet:'+other.play.id)===true;
      const joint=Boolean(l.play.delivery && read('relay:both:'+l.play.id)===true);
      const keep=sightline(other,[],record[0],goal,joint,(!joint || Boolean(other.play.coda)) && wantsQuiet).possible;
      if(other.play.delivery)setTrace(other,null);
      level=other;setDesk(keep?[record[0]]:[],record[0]);tell(keep?'保留了刚才的开场。这次'+orderName(other)+'。':'新演法需要改排。已摆回开场落片前，可以接着调。');return;
    }
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
      const comparison=showing.comparison,blob=await longTicket(l,record,art,comparison);if(run!==downloadRun || !$('slip-dialog').open)return;
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;
      const variant=comparison?(comparison.signed?'同谱双签联':comparison.rehearsal?'两印底谱':l.play.delivery?'双幕交接联':'双幕对照'):isDuet(l)?orderName(l):'';
      a.download='留灯换景-'+(isDuet(l)?l.title+'-'+(l.play.coda?readingNames[l.play.coda.mode]+'-':'')+variant:showing.scenes.at(-1).title)+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('slip-print-status').textContent=comparison?.signed?'同谱双签联已冲印，两次实演的光路并排留在票上。':'长票已冲印，票下记着每次交灯和换片。';
    }catch{if(run===downloadRun)$('slip-print-status').textContent='这次冲印没有成功，可以重试。';}
    finally{if(run===downloadRun)$('print-play').disabled=false;}
  };
  return {load,configure,paint,cover,clamps,issue,project,sceneId,finished,rewind,
    held:id=>Boolean(hold?.held.includes(id)),keeper:()=>hold?.keeper,
    resetDesk:()=>deskAt(level,takes.at(-1)),save:(state,history)=>savePlay(level,takes,state,history),
    step:(placed,selected)=>cueHint(level,takes,placed,selected,ending,twoWays(),duet.quiet(),reference)};
}
