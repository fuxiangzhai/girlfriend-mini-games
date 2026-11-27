import {insertCasts,orderName} from './duet-plays.mjs';
import {foldBill,foldOptions} from './fold-score.mjs';
import {cellName,markReading} from './duet-marks.mjs';
import {thumbnail} from './glass.mjs';
import {drawTicketMap} from './lantern-glass.mjs';
import {lampNames,portName} from './light-path.mjs';
import {markCell,mirrorFalls,poseKey} from './puzzle.mjs';
import {readProjector} from './projection.mjs';
import {foldLetter,readingNames} from './receipt-plays.mjs';
import {read,write} from './save.mjs';
import {differentPanes,handStatus} from './slip-path.mjs';
import {tailMargin,tailPage} from './tail-plays.mjs';
import {anchor,bestTail,cueMatch,insertPane,midAt,newTail,practiceSource,readTailDesk,recordTail,retakeReturn,saveTailDesk,savedTwin,signedSource,tailCost,tailCue,tailHint,tailPrices,tailRoutes,twinTail} from './tail-score.mjs';
import {tailPrint} from './tail-print.mjs';

const $=id=>document.getElementById(id);
const levels=insertCasts.flat(2);
const ports=p=>p.map((v,i)=>lampNames[i]+' '+(v?portName(v):'未出光')).join(' ／ ');
const price=n=>Number.isFinite(n)?n+' 响':'此路不通';
const label=l=>orderName(l)+' · '+readingNames[l.play.coda.mode];
const sourceOf=(l,pair)=>({tape:pair[l.play.coda.mode],peer:pair[1-l.play.coda.mode]});
function chip(attr,id,name,note,pressed,disabled=false){
  return '<button type="button" '+attr+'="'+id+'" aria-pressed="'+pressed+'" '+(disabled?'disabled':'')+'><strong>'+name+'</strong><small>'+note+'</small></button>';
}
function socket(l,id,p){
  const piece=l.pieces[id],at=cellName(l,markCell(l.width,piece.mirror.offset,p));
  return at+' '+(mirrorFalls(piece.mirror.falls,p.o)?'↘':'↗');
}
export function setupTailLook(){
  let current=null;
  const look=$('tail-look'),select=$('tail-look-route');
  function render(){
    if(!look.open || !current)return;
    const {l,takes,plan,slots}=current,page=tailPage(l),route=Number(select.value);
    for(const [i,o] of [...select.options].entries())o.textContent=page.routes[i];
    const options=foldOptions(l,takes,plan,false);
    const match=options.find(v=>!differentPanes(l,slots,v.o.slots).length);
    $('tail-look-live').textContent=match?'照桌上的镜位落回签，'+page.routes.map((name,i)=>{
      const p=tailPrices(tailRoutes(l,slots,i));return name+(p.some(Number.isFinite)?'可走，续场 '+Math.min(...p)+' 响起':'暂时走不了');
    }).join('。')+'。':'回签落片前，可以先看哪套镜位能把灯留到第八拍。';
    const candidates=options.map(v=>({...v,mids:tailRoutes(l,v.o.slots,route)})).filter(v=>v.mids.length);
    candidates.sort((a,b)=>Number(b.mids.some(m=>m.finals.every(f=>f.length)))-Number(a.mids.some(m=>m.finals.every(f=>f.length))) || a.total-b.total);
    const pick=candidates[0];$('tail-look-map').hidden=!pick;
    if(!pick){$('tail-look-note').textContent='从这一拍暂时接不到这条路线。';return;}
    drawTicketMap($('tail-look-map'),l,{slots:pick.o.slots,result:readProjector(l,pick.o.slots),mark:l.play.frames[6].mark},{selected:-1,goal:l.projection.scenes[6].exits});
    const prices=tailPrices(pick.mids);
    const diff=differentPanes(l,slots,pick.o.slots).map(id=>l.pieces[id].name);
    $('tail-look-note').textContent='照图落片，两场合计 '+pick.total+' 响。第八拍走「'+page.routes[route]+'」后，'+prices.map((p,i)=>page.endings[i].action+' '+price(p)).join('，')+'。'+(diff.length?'桌上还要调整'+diff.join('、')+'。':'桌上的镜位已经对齐。');
  }
  look.ontoggle=render;select.onchange=render;
  return (l,takes,plan,slots)=>{
    const visible=l.play.coda?.insert && plan?.leg==='reply' && takes.length===6;
    look.hidden=!visible;
    if(!visible){current=null;look.open=false;return;}
    current={l,takes,plan,slots};render();
  };
}
export function setupTails(art,formal,chime){
  let l,s,page,cue,undo=[],hint=null,renderId=0;
  const dialog=$('tail-dialog');
  const tell=t=>{$('tail-message').textContent=t;};
  function remember(){saveTailDesk(l,s);write('slip:tail-last',l.id);write('slip:tail-signed',Boolean(s.source.peer));}
  function freshAt(level,source){
    const route=tailRoutes(level,source.tape[6],0).length?0:1;
    return newTail(level,source,route);
  }
  function start(level,source=null,options={}){
    const pair=source?null:foldBill(level);
    const signed=options.resume?read('slip:tail-signed')===true:Boolean(source?.peer || pair);
    const saved=readTailDesk(level,signed);
    l=level;page=tailPage(l);
    s=saved && (!source || anchor(l,source)===anchor(l,saved.source))?saved:freshAt(l,source || (pair?sourceOf(l,pair):practiceSource(l)));
    undo=[];hint=null;remember();write('slip:tail-open',true);
    $('tail-page').value=String(insertCasts.findIndex(f=>f.flat().includes(l)));
    $('tail-side').innerHTML=insertCasts[+$('tail-page').value].flat().map(v=>'<option value="'+v.id+'">'+label(v)+'</option>').join('');
    $('tail-side').value=l.id;$('tail-album').open=Boolean(options.album);
    $('tail-paper').src=art(l.play.artId,'insert');
    if(s.source.peer)signedSource(l,s.source);
    if(!dialog.open)dialog.showModal();draw();album();dialog.scrollTop=0;
    if(options.album){$('tail-album').querySelector('summary').focus();}else $('tail-title').focus({preventScroll:true});
  }
  function refresh(note=''){
    const focus=document.activeElement,attr=['data-tail-route','data-tail-end','data-tail-pane','data-tail-pose'].find(a=>focus?.hasAttribute(a)),v=attr && focus.getAttribute(attr);
    remember();draw();
    if(attr)dialog.querySelector('['+attr+'="'+v+'"]:not(:disabled)')?.focus({preventScroll:true});
    if(note)tell(note);
  }
  function draw(){
    renderId++;
    $('tail-intro').textContent=l.play.coda.baseId==='postmark'?'阿婆收好饭桌图。船还在桥下，锅里还有饭。':'回签到了站长手里。末班车还没进站，松径上已经落了雪。';
    $('tail-credit').textContent=s.source.peer?'从已合签的《'+foldLetter(l)[0]+'》续演，起点是第二场的第七拍。':'借谱试排，从一套可合签的第七拍起手。排成自己的骑缝联后，可以从实演镜位另收署名戏笺。';
    $('tail-rehearse').hidden=Boolean(s.source.peer);
    $('tail-finale').hidden=!s.last;$('tail-work').hidden=Boolean(s.last);
    $('tail-to-bench').hidden=Boolean(s.last);
    if(s.last)finale();else work();
    if($('tail-album').open)album();
  }
  function work(){
    const startBoard=s.source.tape[6],mids=tailRoutes(l,startBoard,s.route),m=s.mid?midAt(l,s.source,s.route,s.mid):null;
    cue=tailCue(l,s);
    const costs=m?m.prices:tailPrices(s.both?mids.filter(v=>v.finals.every(f=>f.length)):mids);
    $('tail-routes').innerHTML=page.routes.map((name,i)=>{
      const rows=tailRoutes(l,startBoard,i),prices=tailPrices(rows),options=prices.filter(Number.isFinite).length;
      return chip('data-tail-route',i,name,options?'守'+lampNames[i]+' · '+(options===2?'两种去处':'一种去处')+' · '+Math.min(...prices)+' 响起':'需另排第七拍',s.route===i,Boolean(s.mid));
    }).join('');
    $('tail-ends').innerHTML=page.endings.map((e,i)=>chip('data-tail-end',i,e.title,Number.isFinite(costs[i])?'两拍最低 '+price(costs[i]):m?'此镜位到不了':'此路不通',s.end===i,!Number.isFinite(costs[i]) || s.prep)).join('');
    $('tail-passage').textContent=page.passages[s.route];
    $('tail-both-label').hidden=Boolean(s.mid || s.prep || !mids.length);
    $('tail-both').checked=s.both;$('tail-both').disabled=!mids.some(r=>r.finals.every(a=>a.length));
    $('tail-back').hidden=!s.mid;$('tail-prep').hidden=Boolean(s.mid);$('tail-prep').textContent=s.prep?'回到原第七拍':'另排第七拍';
    const beat=s.prep?7:s.mid?9:8,names=cue.rack.hold.held.map(i=>l.pieces[i].name).join('、');
    $('tail-cue').textContent=s.prep?'第七拍 · 重排回签':s.mid?'第九拍 · '+page.endings[s.end].action:'第八拍 · '+page.routes[s.route];
    $('tail-task').textContent='守'+lampNames[cue.rack.hold.keeper]+'，夹住'+names+'。把光接到方框里的出口，'+ports(cue.goal)+'。';
    const result=readProjector(l,s.slots),status=handStatus(l,cue.rack.hold,s.slots);
    $('tail-rays').textContent=ports(result.rays.map(r=>r.exit))+' · 已动 '+status.changed.length+' / 3 片';
    const editable=i=>!cue.rack.hold.held.includes(i) && (cue.rack.poses[i].length>1 || !s.slots[i]);
    if(!Number.isInteger(s.selected) || !l.pieces[s.selected] || !editable(s.selected))s.selected=l.pieces.findIndex((_,i)=>editable(i));
    drawTicketMap($('tail-map'),l,{slots:s.slots,result,mark:s.prep?l.play.frames[6].mark:null},{selected:s.selected,goal:cue.goal});
    $('tail-rack').innerHTML=l.pieces.map((piece,i)=>{
      const locked=cue.rack.hold.held.includes(i),o=(s.slots[i]||cue.rack.from.slots[i]).o;
      return '<button type="button" data-tail-pane="'+i+'" aria-pressed="'+(s.selected===i)+'" '+(editable(i)?'':'disabled')+'>'+thumbnail(piece,o,'tail-'+i)+'<span>'+piece.name+'</span><small>'+(locked?'守灯':!s.slots[i]?'待回座':cue.rack.poses[i].length===1?'原位':status.changed.includes(i)?'已调':'可调')+'</small></button>';
    }).join('');
    const id=s.selected,poses=cue.rack.poses[id]||[];
    $('tail-sockets').innerHTML=id<0?'':'<span>'+l.pieces[id].name+'的银镜插槽</span>'+poses.map((p,j)=>{
      const current=s.slots[id] && poseKey(l,id,s.slots[id])===poseKey(l,id,p);
      return '<button type="button" data-tail-pose="'+j+'" aria-pressed="'+Boolean(current)+'" '+(hint?.id===id && poseKey(l,id,hint.place)===poseKey(l,id,p)?'class="hint-socket"':'')+' title="圆钉在 '+cellName(l,p.y*l.width+p.x)+'">'+socket(l,id,p)+'<small>钉 '+cellName(l,p.y*l.width+p.x)+'</small></button>';
    }).join('');
    $('tail-take').textContent=s.prep?'落片续第八拍':s.mid?'落片收戏笺':'落片，留住第八拍';
    $('tail-undo').disabled=!undo.length;$('tail-reset').disabled=!status.changed.length;
    $('tail-take').disabled=!cue.options.length;$('tail-hint').disabled=!cue.options.length;
    const matched=cueMatch(l,cue,s.slots),currentMid=beat===8?midAt(l,s.source,s.route,s.slots):null;
    if(!cue.options.length)tell('这套第七拍留不住这条灯路。点「另排第七拍」，可以带着原来前六拍再试。');
    else if(matched)tell(s.prep?'双灯已在交接眼穿过，这套回签镜位可以接上所选路线。':s.mid?'两盏灯已抵达。落片就能读到结局。':'这套镜位可以落片。'+currentMid.prices.map((n,i)=>page.endings[i].action+' '+price(n)).join('，')+'。');
    else if(currentMid)tell('出口已对。这套镜位只留得住「'+page.endings[currentMid.finals[0].length?0:1].title+'」。可以改点去处或再调一片。');
    else if(s.prep && sameExits(result,cue.goal))tell(markReading(l,l.play.frames[6].mark,result.rays)+'。还要给所选的第八拍留路。');
    else tell('先点可调的玻璃，再点它的银镜插槽。被挪开的玻璃会回到片盒，落片前要全部插好。');
  }
  function sameExits(result,goal){return result.rays.every((r,i)=>r.exit===goal[i]);}
  function clearHand(){undo=[];hint=null;s.selected=-1;}
  function resetHand(){
    clearHand();s.slots=tailCue(l,s).rack.from.slots;
  }
  function chooseEnd(end){
    if(s.end===end)return;
    s.end=end;if(s.mid)resetHand();else hint=null;
    refresh();
  }
  $('tail-page').onchange=()=>start(insertCasts[+$('tail-page').value][l.play.coda.mode][l.play.delivery.version]);
  $('tail-side').onchange=()=>start(levels.find(v=>v.id===$('tail-side').value));
  $('tail-to-bench').onclick=()=>{$('tail-cue').focus();$('tail-cue').scrollIntoView({block:'start'});};
  $('tail-routes').onclick=e=>{
    const b=e.target.closest('[data-tail-route]');if(!b || b.disabled || s.route===+b.dataset.tailRoute)return;
    s.route=+b.dataset.tailRoute;s.both=false;
    const costs=tailPrices(tailRoutes(l,s.source.tape[6],s.route));
    if(!Number.isFinite(costs[s.end]))s.end=Number.isFinite(costs[1])?1:0;
    resetHand();refresh();
  };
  $('tail-ends').onclick=e=>{const b=e.target.closest('[data-tail-end]');if(b && !b.disabled)chooseEnd(+b.dataset.tailEnd);};
  $('tail-both').onchange=()=>{s.both=$('tail-both').checked;hint=null;refresh();};
  $('tail-prep').onclick=()=>{s.prep=!s.prep;s.both=false;resetHand();refresh(s.prep?'前六拍已夹好。从第六拍的镜位接回第七拍，双灯还要在原交接眼相遇。':'已接回原第七拍。');};
  $('tail-rack').onclick=e=>{const b=e.target.closest('[data-tail-pane]');if(b && !b.disabled){s.selected=+b.dataset.tailPane;refresh();}};
  $('tail-sockets').onclick=e=>{
    const b=e.target.closest('[data-tail-pose]');if(!b || b.getAttribute('aria-pressed')==='true')return;
    const id=s.selected,p=cue.rack.poses[id][+b.dataset.tailPose],next=insertPane(l,cue.rack,s.slots,id,p);
    if(!next){tell('这一步会动到第四片玻璃。先把一片拨回原位，或点「还原本拍」。');return;}
    undo.push(s.slots);if(undo.length>25)undo.shift();s.slots=next;hint=null;refresh();
  };
  $('tail-undo').onclick=()=>{if(undo.length){s.slots=undo.pop();hint=null;refresh();}};
  $('tail-reset').onclick=()=>{undo.push(s.slots);s.slots=cue.rack.from.slots;hint=null;refresh('已回到这一拍开始时的镜位。');};
  $('tail-hint').onclick=()=>{
    const next=tailHint(l,s,cue);hint=null;
    if(!next)return;
    if(next.ready){tell('已到所选去处的省响镜位，可以落片。');return;}
    if(next.reset){tell('先点「还原本拍」，可以腾出换片名额。');return;}
    hint=next;s.selected=next.id;refresh('把'+l.pieces[next.id].name+'的银镜拨到 '+socket(l,next.id,next.place)+'。选中带虚线的插槽。');
  };
  $('tail-take').onclick=()=>{
    if(!cueMatch(l,cue,s.slots)){
      const result=readProjector(l,s.slots);
      if(!sameExits(result,cue.goal))tell('还没接到目标出口。现在是'+ports(result.rays.map(r=>r.exit))+'。');
      else if(!result.full)tell('灯已接通，还有玻璃在片盒里。把它插回再落片。');
      else if(s.prep)tell('交接眼和下一条灯路要同时接通。点「看一步提示」可找能接的镜位。');
      else tell('出口虽对，这套镜位留不住所选去处。试试另一处插槽，或更换想演的结局。');
      return;
    }
    chime(0,true,handStatus(l,cue.rack.hold,s.slots).changed);
    if(s.prep){
      const source=retakeReturn(l,s.source,s.slots);
      if(!source){tell('未能对齐原谱的回签镜位，请翻开原骑缝联再续演。');return;}
      s.source=source;s.prep=false;
    }else if(!s.mid)s.mid=s.slots;
    else {
      if(!recordTail(l,{...s,last:s.slots})){tell('这张原谱的实演记录未能对上，请从戏本里的骑缝联重新接演。');return;}
      s.last=s.slots;album();
    }
    clearHand();refresh();
    const next=s.last?'tail-ending':'tail-cue';$(next).focus();$(next).scrollIntoView({block:'nearest'});
  };
  function returnToEight(){
    s.mid=null;s.last=null;s.prep=false;s.both=false;resetHand();refresh();$('tail-cue').focus();
  }
  $('tail-back').onclick=$('tail-again').onclick=returnToEight;
  $('tail-sibling').onclick=()=>{
    const other=1-s.end,m=midAt(l,s.source,s.route,s.mid);
    if(!m?.finals[other].length){returnToEight();return;}
    s.last=null;s.end=other;resetHand();refresh('第八拍的镜位已留下。把灯接到另一处，再落一次第九拍。');$('tail-cue').focus();
  };
  function finale(){
    const end=page.endings[s.end],m=midAt(l,s.source,s.route,s.mid),total=tailCost(l,s),joint=twinTail(l,s);
    const img=$('tail-image');img.src=art(l.play.artId,end.layer);img.alt=end.title;
    $('tail-stamp').textContent=(s.source.peer?'骑缝续演':'借谱试排')+' ／ '+page.routes[s.route];
    $('tail-ending').textContent=end.title;$('tail-story').textContent=end.lines[s.route];$('tail-margin').textContent=tailMargin(l,s.end);
    $('tail-joint').hidden=!joint;
    if(joint){$('tail-joint').querySelector('strong').textContent='同一拍双落款 · '+page.joint[0];$('tail-joint').querySelector('p').textContent=page.joint[1];$('tail-turn').textContent='翻读《'+page.endings[1-s.end].title+'》';}
    const a=differentPanes(l,s.source.tape[6],s.mid).length;
    $('tail-tally').textContent='第八拍 '+a+' 响 ＋ 第九拍 '+(total-a)+' 响 ＝ 续场 '+total+' 响。这张第七拍走此路最低 '+tailPrices(tailRoutes(l,s.source.tape[6],s.route))[s.end]+' 响。';
    $('tail-sibling').hidden=!m.finals[1-s.end].length;
    $('tail-sibling').textContent='留住第八拍，去「'+page.endings[1-s.end].action+'」';
    if(!joint && m.finals[1-s.end].length)$('tail-tally').textContent+='留下这套第八拍，再演另一个结局，可收同一拍双落款。';
    $('tail-print-status').textContent='';$('tail-print').disabled=false;
    proofs();
  }
  function proofs(){
    const twin=twinTail(l,s),start=s.source.tape[6];
    const boards=[[s.mid,start,'第八拍 · '+page.routes[s.route]],[s.last,s.mid,'第九拍 · '+page.endings[s.end].action]];
    if(twin)boards.push([twin,s.mid,'另一处落款 · '+page.endings[1-s.end].action]);
    const nodes=boards.map(([board,prior,name])=>{
      const fig=document.createElement('figure'),cap=document.createElement('figcaption'),canvas=document.createElement('canvas');
      canvas.width=340;canvas.height=205;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',name+'镜位');
      const diff=differentPanes(l,prior,board).map(i=>l.pieces[i].name),result=readProjector(l,board);
      const top=document.createElement('strong');top.textContent=name;
      cap.append(top,document.createTextNode(ports(result.rays.map(r=>r.exit))+'。换'+diff.join('、')+'，共 '+diff.length+' 响。'));
      drawTicketMap(canvas,l,{slots:board,result},{selected:-1,goal:result.rays.map(r=>r.exit)});fig.append(canvas,cap);return fig;
    });
    $('tail-maps').replaceChildren(...nodes);
  }
  $('tail-proofs').ontoggle=()=>{if(dialog.open && s?.last && $('tail-proofs').open)proofs();};
  $('tail-turn').onclick=()=>{
    const last=twinTail(l,s);if(!last)return;
    s.end=1-s.end;s.last=s.slots=last;refresh();$('tail-ending').focus();
  };
  function album(){
    let signed=0,trial=0;
    const cards=[];
    for(const [route,path] of page.routes.entries()){
      const choices=page.endings.map((end,i)=>{
        const own=bestTail(l,route,i,true),borrowed=bestTail(l,route,i,false),r=own||borrowed;
        if(own)signed++;if(borrowed)trial++;
        return '<button type="button" data-tail-card="'+route+i+'" '+(r?'':'disabled')+'>'+end.title+'<small>'+(r?(own?'骑缝续演':'借谱试排')+' · '+tailCost(l,r)+' 响':'待落款')+'</small></button>';
      });
      const twin=savedTwin(l,route,true)||savedTwin(l,route,false);
      if(twin)choices.push('<button type="button" data-tail-twin="'+route+'">同一拍双落款<small>'+page.joint[0]+'</small></button>');
      cards.push('<div><strong>'+path+'</strong>'+choices.join('')+'</div>');
    }
    $('tail-count').textContent='实演 '+signed+' · 试排 '+trial;$('tail-collection').innerHTML=cards.join('');
  }
  $('tail-album').ontoggle=()=>{if(dialog.open && $('tail-album').open)album();};
  $('tail-collection').onclick=e=>{
    const b=e.target.closest('button');if(!b || b.disabled)return;
    const twin=b.dataset.tailTwin,code=b.dataset.tailCard;
    const r=twin!=null?savedTwin(l,+twin,true)||savedTwin(l,+twin,false):bestTail(l,+code[0],+code[1],true)||bestTail(l,+code[0],+code[1],false);
    if(!r)return;
    s={...newTail(l,r.source,r.route),...r,slots:r.last};clearHand();refresh();$('tail-ending').focus();
  };
  $('tail-print').onclick=async()=>{
    const token=renderId;$('tail-print').disabled=true;
    try{
      const blob=await tailPrint(l,s,art,twinTail(l,s));if(token!==renderId || !dialog.open)return;
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;
      a.download='留灯换景-'+l.play.coda.paper+'-'+page.endings[s.end].title+'-'+(s.source.peer?'骑缝续演':'借谱试排')+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('tail-print-status').textContent='戏笺已冲印，笺上留有这两拍的镜位。';
    }catch{if(token===renderId)$('tail-print-status').textContent='这次未能冲印，请重试。';}
    finally{if(token===renderId)$('tail-print').disabled=false;}
  };
  $('tail-rehearse').onclick=()=>{dialog.close();formal(l);};
  dialog.addEventListener('close',()=>{if(!dialog.open){write('slip:tail-open',false);renderId++;}});
  function openLast(album=false){
    const last=levels.find(v=>v.id===read('slip:tail-last'));
    start(last||insertCasts[0][1][1],null,{album,resume:Boolean(last)});
  }
  return {start,openLast,shouldResume:()=>read('slip:tail-open')===true};
}
