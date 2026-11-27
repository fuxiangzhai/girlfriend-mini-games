import {insertCasts,orderName} from './duet-plays.mjs';
import {setupCourierDesk} from './courier-desk.mjs';
import {courierPage,cueName} from './courier-plays.mjs';
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
import {endingStory,endsIn,foldName,jointText,routeNames,stopNames,tailGroups as groups,tailKeeper,tailMargin,tailPage} from './tail-plays.mjs';
import {actualPrice,aimMask,anchor,bestPrice,bestTail,cueMatch,insertPane,midAt,newTail,practiceSource,readTailDesk,recordedEnds,recordTail,retakeReturn,roadPlans,saveTailDesk,savedGroup,sharedPrice,signedSource,tailCost,tailCue,tailHint,tailPrices,tailRoutes,validTail} from './tail-score.mjs';
import {tailPrint} from './tail-print.mjs';

const $=id=>document.getElementById(id);
const levels=insertCasts.flat(2);
const ports=p=>p.map((v,i)=>lampNames[i]+' '+(v?portName(v):'未出光')).join(' ／ ');
const price=n=>Number.isFinite(n)?n+' 响':'此路不通';
const groupName=mask=>mask===7?'三处同笺':'同一拍双落款';
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
    const {l,takes,plan,slots}=current,page=tailPage(l),code=Number(select.value),flap=code>>1,route=code%2;
    for(const [i,o] of [...select.options].entries())o.textContent=foldName(i>>1)+' · '+routeNames(l,i>>1)[i%2];
    const options=foldOptions(l,takes,plan,false);
    const match=options.find(v=>!differentPanes(l,slots,v.o.slots).length);
    $('tail-look-live').textContent=match?'照桌上的镜位落回签，'+routeNames(l,flap).map((name,i)=>{
      const p=tailPrices(tailRoutes(l,slots,i,flap));return name+(p.some(Number.isFinite)?'可走，续场 '+Math.min(...p)+' 响起':'暂时走不了');
    }).join('。')+'。':'回签落片前，可以先看哪套镜位能把灯留到第八拍。';
    const candidates=options.map(v=>({...v,mids:tailRoutes(l,v.o.slots,route,flap)})).filter(v=>v.mids.length);
    candidates.sort((a,b)=>Number(b.mids.some(m=>m.finals.every(f=>f.length)))-Number(a.mids.some(m=>m.finals.every(f=>f.length))) || a.total-b.total);
    const pick=candidates[0];$('tail-look-map').hidden=!pick;
    if(!pick){$('tail-look-note').textContent='从这一拍暂时接不到这条路线。';return;}
    drawTicketMap($('tail-look-map'),l,{slots:pick.o.slots,result:readProjector(l,pick.o.slots),mark:l.play.frames[6].mark},{selected:-1,goal:l.projection.scenes[6].exits});
    const prices=tailPrices(pick.mids);
    const diff=differentPanes(l,slots,pick.o.slots).map(id=>l.pieces[id].name);
    const triple=bestPrice(pick.mids,7);
    $('tail-look-note').textContent='照图落片，两场合计 '+pick.total+' 响。第八拍走「'+routeNames(l,flap)[route]+'」后，'+prices.map((p,i)=>page.endings[i].action+' '+price(p)).join('，')+'。'+(Number.isFinite(triple)?'三处合排最低 '+price(triple)+'。':'')+(diff.length?'桌上还要调整'+diff.join('、')+'。':'桌上的镜位已经对齐。');
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
  const courier=setupCourierDesk(art,(note,focus)=>{
    undo=[];hint=null;refresh(note);
    if(focus)$(focus).focus();
  });
  const hand=()=>courier.state||s;
  function remember(){
    saveTailDesk(l,s);if(courier.state)courier.remember();
    write('slip:tail-last',l.id);write('slip:tail-signed',Boolean(hand().source.peer));write('slip:courier-open',Boolean(courier.state));
  }
  function freshAt(level,source){
    const route=tailRoutes(level,source.tape[6],0).length?0:1;
    return newTail(level,source,route);
  }
  function start(level,source=null,options={}){
    const pair=source?null:foldBill(level);
    const signed=options.resume?read('slip:tail-signed')===true:Boolean(source?.peer || pair);
    const saved=readTailDesk(level,signed);
    l=level;page=tailPage(l);
    if(saved && (!source || anchor(l,source)===anchor(l,saved.source)))s=saved;
    else{
      s=freshAt(l,source || (pair?sourceOf(l,pair):practiceSource(l)));
      const request=options.program || (options.spotlight?{flap:1,end:1,stops:6,both:true}:null);
      if(request){
        const roads=roadPlans(l,s.source,aimMask(request)).filter(v=>Number.isFinite(v.price));
        const road=roads.find(v=>v.flap===request.flap && v.route===request.route) || roads.find(v=>v.flap===request.flap) || roads[0];
        if(road)Object.assign(s,request,{flap:road.flap,route:road.route});
      }
    }
    if(options.courier)courier.open(l,s,false,options.resume?signed:null);else courier.hide();
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
    const focus=document.activeElement,attr=['data-tail-route','data-tail-plan','data-tail-view','data-tail-end','data-tail-pane','data-tail-pose','data-courier-order','data-courier-way','data-courier-pace'].find(a=>focus?.hasAttribute(a)),v=attr && focus.getAttribute(attr);
    remember();draw();
    if(attr)dialog.querySelector('['+attr+'="'+v+'"]:not(:disabled)')?.focus({preventScroll:true});
    if(note)tell(note);
  }
  function draw(){
    renderId++;
    const w=courier.state,active=Boolean(w),source=hand().source;
    $('tail-title').textContent=active?'三站走笺':'折后两拍';
    dialog.querySelector('.close').setAttribute('aria-label','合上'+$('tail-title').textContent);
    $('tail-intro').textContent=active?courierPage(l).intro:l.play.coda.baseId==='postmark'?'阿婆收好饭桌图。船还在桥下，锅里还有饭。':'回签到了站长手里。末班车还没进站，松径上已经落了雪。';
    $('tail-credit').textContent=source.peer?'从已合签的《'+foldLetter(l)[0]+'》续演，起点是第二场的第七拍。':'借谱试排，从一套可合签的第七拍起手。排成自己的骑缝联后，可以从实演镜位另收署名戏笺。';
    $('tail-rehearse').hidden=Boolean(source.peer);$('tail-album').hidden=active;$('tail-program').hidden=active;
    $('courier-open').hidden=active;$('courier-leave').hidden=!active;
    $('tail-finale').hidden=active || !s.last;$('tail-work').hidden=active?w.phase!=='play':Boolean(s.last);
    $('tail-to-bench').hidden=$('tail-work').hidden;
    if(w?.phase==='play'){cue=courier.cue();walkBench(w);}
    courier.draw(cue);
    if(!active){if(s.last)finale();else work();}
  }
  function drawPlan(mids,m){
    $('tail-both-label').hidden=Boolean(s.mid || s.prep);
    $('tail-both').checked=s.both;
    $('tail-commission').hidden=!s.both || s.prep;
    if(!s.both || s.prep)return;
    const best=roadPlans(l,s.source,s.stops)[0],local=m?sharedPrice(m,s.stops):bestPrice(mids,s.stops);
    $('tail-plans').innerHTML=groups.map(mask=>{
      const n=m?sharedPrice(m,mask):bestPrice(mids,mask);
      return chip('data-tail-plan',mask,stopNames(l,mask),Number.isFinite(n)?price(n):m?'此镜位到不了':'另路可排',s.stops===mask,Boolean(m));
    }).join('');
    $('tail-plan-price').textContent=(m?'留住这套镜位，': '从这张第七拍起，')+(Number.isFinite(local)?'「'+stopNames(l,s.stops)+'」合排最低 '+price(local)+'。':'本路暂时接不齐所点的落款。')+'第八拍算一次，各处的第九拍分别计响。'+(s.stops===7?'三处都演完，可收「三处同笺」。':'');
    $('tail-plan-switch').hidden=Boolean(m) || !Number.isFinite(best.price) || best.price>=local;
    $('tail-plan-switch').textContent='换走「'+routeNames(l,best.flap)[best.route]+'」 · '+price(best.price);
  }
  function showExits(m){
    const strip=$('tail-exits');strip.hidden=!m;if(!m)return;
    $('tail-exit-title').textContent=(s.mid?'已留下的':'桌上这套')+'第八拍 · '+price(m.cost);
    strip.querySelector('ul').innerHTML=m.prices.map((n,i)=>{
      const open=Number.isFinite(n);
      return '<li class="'+(open?'lit':'closed')+'"><strong>'+page.shortStops[i]+'</strong><small>'+(open?'再 '+price(n-m.cost):'灯未接通')+'</small></li>';
    }).join('');
  }
  function work(){
    const startBoard=s.source.tape[6],routes=routeNames(l,s.flap),mids=tailRoutes(l,startBoard,s.route,s.flap),m=s.mid?midAt(l,s.source,s.route,s.mid,s.flap):null;
    cue=tailCue(l,s);
    const costs=m?m.prices:tailPrices(mids);
    for(const b of $('tail-flaps').children){b.setAttribute('aria-pressed',String(s.flap===+b.dataset.tailFlap));b.disabled=Boolean(m);}
    $('tail-routes').innerHTML=routes.map((name,i)=>{
      const rows=tailRoutes(l,startBoard,i,s.flap),prices=tailPrices(rows),options=prices.filter(Number.isFinite).length;
      return chip('data-tail-route',i,name,options?'守'+lampNames[tailKeeper(l,i,null,s.flap)]+' · '+options+' 处 · '+Math.min(...prices)+' 响起':'需另排第七拍',s.route===i,Boolean(s.mid));
    }).join('');
    $('tail-ends').innerHTML=page.endings.map((e,i)=>chip('data-tail-end',i,e.title,Number.isFinite(costs[i])?(m?'第九拍最低 '+price(costs[i]-m.cost):'单演最低 '+price(costs[i])):m?'此镜位到不了':'此路不通',s.end===i,!Number.isFinite(costs[i]) || s.prep)).join('');
    $('tail-passage').textContent=(s.flap?page.sidePassages:page.passages)[s.route];drawPlan(mids,m);
    $('tail-back').hidden=!s.mid;$('tail-prep').hidden=Boolean(s.mid);$('tail-prep').textContent=s.prep?'回到原第七拍':'另排第七拍';
    const beat=s.prep?7:s.mid?9:8;
    $('tail-cue').textContent=s.prep?'第七拍 · 重排回签':s.mid?'第九拍 · '+page.endings[s.end].action:'第八拍 · '+routes[s.route];
    const result=glassBench(s,s.prep?l.play.frames[6].mark:null);
    $('tail-take').textContent=s.prep?'落片续第八拍':s.mid?'落片收戏笺':'落片，留住第八拍';
    const matched=cueMatch(l,cue,s.slots),currentMid=beat===8?midAt(l,s.source,s.route,s.slots,s.flap):null;
    showExits(m||currentMid);
    const reachable=currentMid?.finals.flatMap((f,e)=>f.length?[page.shortStops[e]]:[]).join('、');
    if(!cue.options.length)tell(s.prep?'保留前六拍也接不齐所点的去处。回到原第七拍，可换折痕或改点落款。':'这张第七拍接不齐所选去处。可以换线路，或点「另排第七拍」留着前六拍重来。');
    else if(matched)tell(s.prep?'双灯已在交接眼穿过，这套回签镜位可以接上所选路线。':s.mid?'两盏灯已抵达。落片就能读到结局。':'这套镜位可以落片，留得住'+reachable+'。'+(s.both?'所点落款合排最低 '+price(sharedPrice(currentMid,s.stops))+'。':''));
    else if(currentMid)tell('出口已对。这套镜位留得住'+reachable+'，还接不到所点的全部去处。可以改点落款或再调一片。');
    else if(s.prep && sameExits(result,cue.goal))tell(markReading(l,l.play.frames[6].mark,result.rays)+'。还要给所选的第八拍留路。');
    else tell('先点可调的玻璃，再点它的银镜插槽。被挪开的玻璃会回到片盒，落片前要全部插好。');
  }
  function glassBench(s,mark=null){
    const names=cue.rack.hold.held.map(i=>l.pieces[i].name).join('、');
    $('tail-task').textContent='守'+lampNames[cue.rack.hold.keeper]+'，夹住'+names+'。把光接到方框里的出口，'+ports(cue.goal)+'。';
    const result=readProjector(l,s.slots),status=handStatus(l,cue.rack.hold,s.slots);
    $('tail-rays').textContent=ports(result.rays.map(r=>r.exit))+' · 已动 '+status.changed.length+' / 3 片';
    const editable=i=>!cue.rack.hold.held.includes(i) && (cue.rack.poses[i].length>1 || !s.slots[i]);
    if(!Number.isInteger(s.selected) || !l.pieces[s.selected] || !editable(s.selected))s.selected=l.pieces.findIndex((_,i)=>editable(i));
    drawTicketMap($('tail-map'),l,{slots:s.slots,result,mark},{selected:s.selected,goal:cue.goal});
    $('tail-rack').innerHTML=l.pieces.map((piece,i)=>{
      const locked=cue.rack.hold.held.includes(i),o=(s.slots[i]||cue.rack.from.slots[i]).o;
      return '<button type="button" data-tail-pane="'+i+'" aria-pressed="'+(s.selected===i)+'" '+(editable(i)?'':'disabled')+'>'+thumbnail(piece,o,'tail-'+i)+'<span>'+piece.name+'</span><small>'+(locked?'守灯':!s.slots[i]?'待回座':cue.rack.poses[i].length===1?'原位':status.changed.includes(i)?'已调':'可调')+'</small></button>';
    }).join('');
    const id=s.selected,poses=cue.rack.poses[id]||[];
    $('tail-sockets').innerHTML=id<0?'':'<span>'+l.pieces[id].name+'的银镜插槽</span>'+poses.map((p,j)=>{
      const current=s.slots[id] && poseKey(l,id,s.slots[id])===poseKey(l,id,p);
      return '<button type="button" data-tail-pose="'+j+'" aria-pressed="'+Boolean(current)+'" '+(hint?.id===id && poseKey(l,id,hint.place)===poseKey(l,id,p)?'class="hint-socket"':'')+' title="圆钉在 '+cellName(l,p.y*l.width+p.x)+'">'+socket(l,id,p)+'<small>钉 '+cellName(l,p.y*l.width+p.x)+'</small></button>';
    }).join('');
    $('tail-undo').disabled=!undo.length;$('tail-reset').disabled=!status.changed.length;
    $('tail-take').disabled=!cue.options.length;$('tail-hint').disabled=!cue.options.length;
    return result;
  }
  function walkBench(w){
    const step=cue.step,stops=w.steps.filter(x=>['first','out','direct'].includes(x.kind)).length;
    $('tail-cue').textContent=(step.kind==='mid'?'第八拍':step.kind==='back'?'折回':'第 '+(stops+1)+' 站')+' · '+cueName(l,step);
    $('tail-take').textContent=step.kind==='back'?'落片，认回原折':step.kind==='mid'?'落片，留住三处':stops===2?'落片收走笺':'落片，送到这一站';
    const result=glassBench(w),matched=cueMatch(l,cue,w.slots);showExits(null);
    if(matched)tell('这套镜位可以落片，照此演完整趟最低 '+price(cue.prices.get(matched))+'。');
    else if(step.kind==='back')tell('把银镜拨回这一趟共同的第八拍。可以展开「对照共同的第八拍」看原位。');
    else if(sameExits(result,cue.goal))tell('两灯到了出口，还要给接下来的站点留下合适的镜位。');
    else tell('守住原灯，点一片可调的玻璃，再点它的银镜插槽。提示会把后面几程一并算进去。');
  }
  function sameExits(result,goal){return result.rays.every((r,i)=>r.exit===goal[i]);}
  function clearHand(){undo=[];hint=null;s.selected=-1;}
  function resetHand(){
    clearHand();s.slots=tailCue(l,s).rack.from.slots;
  }
  function chooseEnd(end){
    if(s.end===end)return;
    const solo=s.both && !(s.stops & (1<<end));
    if(solo)s.both=false;
    s.end=end;if(s.mid)resetHand();else hint=null;
    refresh(solo?'改作单演「'+page.endings[end].title+'」。':'');
  }
  function setRoad(flap,route){
    s.flap=flap;s.route=route;
    const costs=tailPrices(tailRoutes(l,s.source.tape[6],route,flap));
    if(!s.both && !Number.isFinite(costs[s.end]) && costs.some(Number.isFinite))s.end=costs.findIndex(Number.isFinite);
    resetHand();refresh();
  }
  function choosePlan(mask){
    s.both=true;s.stops=mask;
    if(!(mask & (1<<s.end)))s.end=endsIn(mask)[0];
    hint=null;refresh();
  }
  function switchCast(level){
    const {flap,route,end,stops,both}=s;start(level,null,{program:{flap,route,end,stops,both},courier:Boolean(courier.state)});
  }
  $('tail-page').onchange=()=>switchCast(insertCasts[+$('tail-page').value][l.play.coda.mode][l.play.delivery.version]);
  $('tail-side').onchange=()=>switchCast(levels.find(v=>v.id===$('tail-side').value));
  $('tail-to-bench').onclick=()=>{$('tail-cue').focus();$('tail-cue').scrollIntoView({block:'start'});};
  function openCourier(useBoard){
    courier.open(l,s,useBoard);undo=[];hint=null;refresh();$('tail-title').focus();dialog.scrollTop=0;
  }
  $('courier-open').onclick=()=>openCourier(false);
  $('courier-this').onclick=()=>openCourier(true);
  $('courier-leave').onclick=()=>{courier.hide();undo=[];hint=null;refresh();$('tail-title').focus();dialog.scrollTop=0;};
  $('tail-flaps').onclick=e=>{const b=e.target.closest('[data-tail-flap]');if(b && !b.disabled && s.flap!==+b.dataset.tailFlap)setRoad(+b.dataset.tailFlap,s.route);};
  $('tail-routes').onclick=e=>{const b=e.target.closest('[data-tail-route]');if(b && !b.disabled && s.route!==+b.dataset.tailRoute)setRoad(s.flap,+b.dataset.tailRoute);};
  $('tail-ends').onclick=e=>{const b=e.target.closest('[data-tail-end]');if(b && !b.disabled)chooseEnd(+b.dataset.tailEnd);};
  $('tail-both').onchange=()=>{
    if($('tail-both').checked)choosePlan(s.stops & (1<<s.end)?s.stops:s.end===2?5:3);
    else{s.both=false;hint=null;refresh();}
  };
  $('tail-plans').onclick=e=>{const b=e.target.closest('[data-tail-plan]');if(b && !b.disabled)choosePlan(+b.dataset.tailPlan);};
  $('tail-plan-switch').onclick=()=>{const best=roadPlans(l,s.source,s.stops)[0];if(Number.isFinite(best.price)){setRoad(best.flap,best.route);$('tail-routes').querySelector('[aria-pressed=true]').focus();}};
  $('tail-prep').onclick=()=>{s.prep=!s.prep;resetHand();refresh(s.prep?'前六拍已夹好。从第六拍的镜位接回第七拍，双灯还要在原交接眼相遇。':'已接回原第七拍。');};
  $('tail-rack').onclick=e=>{const b=e.target.closest('[data-tail-pane]');if(b && !b.disabled){hand().selected=+b.dataset.tailPane;refresh();}};
  $('tail-sockets').onclick=e=>{
    const b=e.target.closest('[data-tail-pose]');if(!b || b.getAttribute('aria-pressed')==='true')return;
    const s=hand(),id=s.selected,p=cue.rack.poses[id][+b.dataset.tailPose],next=insertPane(l,cue.rack,s.slots,id,p);
    if(!next){tell('这一步会动到第四片玻璃。先把一片拨回原位，或点「还原本拍」。');return;}
    undo.push(s.slots);if(undo.length>25)undo.shift();s.slots=next;hint=null;refresh();
  };
  $('tail-undo').onclick=()=>{if(undo.length){hand().slots=undo.pop();hint=null;refresh();}};
  $('tail-reset').onclick=()=>{const s=hand();undo.push(s.slots);s.slots=cue.rack.from.slots;hint=null;refresh('已回到这一拍开始时的镜位。');};
  $('tail-hint').onclick=()=>{
    const s=hand(),next=courier.state?courier.hint(cue):tailHint(l,s,cue);hint=null;
    if(!next)return;
    if(next.ready){tell(courier.state?'照所点的排法可用 '+price(cue.guide.total)+' 演完整趟，可以落片。':s.both && !s.prep && !s.mid?'已为「'+stopNames(l,s.stops)+'」留下合排最省的镜位，可以落片。':'已到所选去处的省响镜位，可以落片。');return;}
    if(next.reset){tell('先点「还原本拍」，可以腾出换片名额。');return;}
    hint=next;s.selected=next.id;refresh('把'+l.pieces[next.id].name+'的银镜拨到 '+socket(l,next.id,next.place)+'。选中带虚线的插槽。');
  };
  $('tail-take').onclick=()=>{
    if(courier.state){
      const w=courier.state,changed=handStatus(l,cue.rack.hold,w.slots).changed;
      if(courier.advance())chime(0,true,changed);
      else if(cue.step.kind==='back')tell('原折要对上同一套玻璃。对照第八拍的银镜与钉位，再落片。');
      else tell('这套镜位还接不成所点的整趟戏。看双灯出口，或点「看一步提示」。');
      return;
    }
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
      s.last=s.slots;s.view=null;s.openingLeg=null;album();
    }
    clearHand();refresh();
    const next=s.last?'tail-ending':'tail-cue';$(next).focus();$(next).scrollIntoView({block:'nearest'});
  };
  function returnToEight(flap){
    s.mid=null;s.last=null;s.prep=false;s.view=null;s.openingLeg=null;s.both=false;
    setRoad(flap,s.route);$('tail-cue').focus();
  }
  $('tail-back').onclick=$('tail-again').onclick=()=>returnToEight(s.flap);
  $('tail-change-flap').onclick=()=>returnToEight(1-s.flap);
  function receipt(){
    const legs=recordedEnds(l,s),first=s.openingLeg;
    // Turning the paper keeps the take the reader opened, including a louder
    // encore. The collection can independently keep its quieter performance.
    if(first && legs[first.end] && validTail(l,{...s,end:first.end,last:first.last}))legs[first.end]=first.last;
    legs[s.end]=s.last;
    const earned=legs.reduce((mask,b,e)=>b?mask|(1<<e):mask,0);
    const view=[s.view,s.both?s.stops:null].find(mask=>groups.includes(mask) && (mask & earned)===mask && (mask & (1<<s.end)))??earned;
    return {legs,earned,view};
  }
  function buttons(ids,others,text){
    for(const [i,id] of ids.entries()){
      const b=$(id),end=others[i];b.hidden=end===undefined;
      if(end!==undefined){b.dataset.end=String(end);b.textContent=text(end);}
    }
  }
  function performOther(end){
    const {earned}=receipt();
    if(!midAt(l,s.source,s.route,s.mid,s.flap).finals[end]?.length)return;
    if(!s.both || !(s.stops & (1<<end))){s.stops=earned|(1<<end);s.both=groups.includes(s.stops);if(!s.both)s.stops=3;}
    s.last=null;s.view=null;s.openingLeg=null;s.end=end;resetHand();
    refresh('已留下第八拍。从同一套镜位起手，演「'+page.endings[end].title+'」的第九拍。');$('tail-cue').focus();
  }
  for(const id of ['tail-sibling','tail-sibling-alt'])$(id).onclick=()=>performOther(+$(id).dataset.end);
  function finale(){
    const end=page.endings[s.end],m=midAt(l,s.source,s.route,s.mid,s.flap),total=tailCost(l,s);
    const {legs,earned,view}=receipt(),members=endsIn(view),others=members.filter(e=>e!==s.end),routes=routeNames(l,s.flap);
    const img=$('tail-image');img.src=art(l.play.artId,end.layer);img.alt=end.title;
    $('tail-stamp').textContent=(s.source.peer?'骑缝续演':'借谱试排')+' ／ '+foldName(s.flap)+' · '+routes[s.route];
    $('tail-ending').textContent=end.title;$('tail-story').textContent=endingStory(l,s);$('tail-margin').textContent=tailMargin(l,s.end);
    const mids=tailRoutes(l,s.source.tape[6],s.route,s.flap);
    $('tail-joint').hidden=!others.length;
    $('courier-this').hidden=earned!==7;
    if(others.length){
      const [title,story]=jointText(l,view);
      $('tail-joint-title').textContent=groupName(view)+' · '+title;$('tail-joint-story').textContent=story;
      $('tail-pair-tabs').hidden=earned!==7;
      if(earned===7)$('tail-pair-tabs').innerHTML=groups.map(mask=>chip('data-tail-view',mask,stopNames(l,mask),mask===7?'三处同笺':'双落款',mask===view)).join('');
      const costs=members.map(e=>page.shortStops[e]+' '+differentPanes(l,s.mid,legs[e]).length);
      const actual=actualPrice(l,s,legs,view),local=bestPrice(mids,view),best=roadPlans(l,s.source,view)[0];
      $('tail-joint-price').textContent='第八拍 '+m.cost+' ＋ '+costs.join(' ＋ ')+' ＝ 合排 '+price(actual)+'。这张第七拍走此路最低 '+price(local)+'。';
      $('tail-quieter').hidden=actual<=best.price;
      $('tail-quieter').textContent=local===best.price?'重排这组 · 挑战 '+price(local):'走「'+routeNames(l,best.flap)[best.route]+'」挑战 '+price(best.price);
      buttons(['tail-turn','tail-turn-alt'],others,e=>'翻读《'+page.endings[e].title+'》');
    }
    $('tail-tally').textContent='第八拍 '+m.cost+' 响 ＋ 第九拍 '+(total-m.cost)+' 响 ＝ 续场 '+total+' 响。这张第七拍走此路最低 '+price(tailPrices(mids)[s.end])+'。';
    const reachable=m.finals.flatMap((f,e)=>e!==s.end && f.length?[e]:[]);
    const priority=e=>(legs[e]?2:0)+(s.both && !(s.stops & (1<<e))?1:0);
    reachable.sort((a,b)=>priority(a)-priority(b));
    buttons(['tail-sibling','tail-sibling-alt'],reachable,e=>(legs[e]?'同拍再演':'留住第八拍，去')+'「'+page.endings[e].action+'」');
    const missing=s.both?s.stops & ~earned:0;
    if(missing)$('tail-tally').textContent+='这张点戏笺还等「'+stopNames(l,missing)+'」。留住第八拍，可以接着演。';
    else if(!others.length && reachable.length)$('tail-tally').textContent+='留下这套第八拍，再演一个去处，可收同一拍双落款。';
    $('tail-change-flap').textContent=s.flap?'回原折另排':'把纸角侧折另排';
    $('tail-print-status').textContent='';$('tail-print').disabled=false;
    proofs(legs,others);
  }
  function proofs(legs,others){
    const boards=[[s.mid,s.source.tape[6],'第八拍 · '+routeNames(l,s.flap)[s.route]],[s.last,s.mid,'第九拍 · '+page.endings[s.end].action]];
    for(const e of others)boards.push([legs[e],s.mid,'另一处落款 · '+page.endings[e].action]);
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
  function turn(end,view){
    const {legs}=receipt();if(!legs[end])return;
    s.openingLeg??={end:s.end,last:s.last};
    s.view=view;s.stops=view;s.both=true;s.end=end;s.last=s.slots=legs[end];refresh();$('tail-ending').focus({preventScroll:true});
  }
  for(const id of ['tail-turn','tail-turn-alt'])$(id).onclick=()=>turn(+$(id).dataset.end,receipt().view);
  $('tail-pair-tabs').onclick=e=>{
    const b=e.target.closest('[data-tail-view]');if(!b)return;
    const view=+b.dataset.tailView;turn(view & (1<<s.end)?s.end:endsIn(view)[0],view);
  };
  $('tail-quieter').onclick=()=>{
    const {view}=receipt(),best=roadPlans(l,s.source,view)[0],local=bestPrice(tailRoutes(l,s.source.tape[6],s.route,s.flap),view);
    s.mid=null;s.last=null;s.view=null;s.openingLeg=null;s.both=true;s.stops=view;
    setRoad(local===best.price?s.flap:best.flap,local===best.price?s.route:best.route);
    $('tail-cue').focus();
  };
  function album(){
    let signed=0,trial=0;
    const cards=[];
    for(const flap of [0,1])for(const [route,path] of routeNames(l,flap).entries()){
      const choices=[],attr=' data-flap="'+flap+'" data-route="'+route+'"';
      for(const [i,end] of page.endings.entries()){
        if(tailKeeper(l,route,i,flap)==null)continue;
        let found=false;
        for(const own of [true,false]){
          const r=bestTail(l,route,i,own,flap);if(!r)continue;
          found=true;if(own)signed++;else trial++;
          choices.push('<button type="button" data-tail-card="'+route+i+'"'+attr+' data-own="'+own+'">'+end.title+'<small>'+(own?'骑缝续演':'借谱试排')+' · '+price(tailCost(l,r))+'</small></button>');
        }
        if(!found)choices.push('<button type="button" disabled>'+end.title+'<small>待落款</small></button>');
      }
      for(const mask of groups)for(const own of [true,false]){
        const r=savedGroup(l,route,flap,mask,own);if(!r)continue;
        choices.push('<button type="button" data-tail-group="'+mask+'"'+attr+' data-own="'+own+'">'+groupName(mask)+' · '+jointText(l,mask)[0]+'<small>'+(own?'骑缝续演':'借谱试排')+' · '+price(r.total)+'</small></button>');
      }
      cards.push('<div><strong>'+foldName(flap)+' · '+path+'</strong>'+choices.join('')+'</div>');
    }
    $('tail-count').textContent='实演 '+signed+' · 试排 '+trial;$('tail-collection').innerHTML=cards.join('');
  }
  $('tail-album').ontoggle=()=>{if(dialog.open && $('tail-album').open)album();};
  $('tail-collection').onclick=e=>{
    const b=e.target.closest('button');if(!b || b.disabled)return;
    const {flap,route,tailGroup,tailCard,own}=b.dataset;
    const r=tailGroup?savedGroup(l,+route,+flap,+tailGroup,own==='true'):bestTail(l,+route,+tailCard[1],own==='true',+flap);
    if(!r)return;
    s={...newTail(l,r.source,r.route),...r,view:tailGroup?+tailGroup:null,slots:r.last};clearHand();refresh();$('tail-ending').focus();
  };
  $('tail-print').onclick=async()=>{
    const token=renderId;$('tail-print').disabled=true;
    try{
      const {legs,view}=receipt(),blob=await tailPrint(l,s,art,legs,view);if(token!==renderId || !dialog.open)return;
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;
      a.download='留灯换景-'+l.play.coda.paper+'-'+(groups.includes(view)?jointText(l,view)[0]:page.endings[s.end].title)+'-'+(s.source.peer?'骑缝续演':'借谱试排')+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      $('tail-print-status').textContent='戏笺已冲印，收有共同的第八拍和所演落款的实景、镜位与响数。';
    }catch{if(token===renderId)$('tail-print-status').textContent='这次未能冲印，请重试。';}
    finally{if(token===renderId)$('tail-print').disabled=false;}
  };
  $('tail-rehearse').onclick=()=>{dialog.close();formal(l);};
  dialog.addEventListener('close',()=>{if(!dialog.open){write('slip:tail-open',false);courier.invalidate();renderId++;}});
  function openLast(album=false,spotlight=false,journey=false){
    const last=levels.find(v=>v.id===read('slip:tail-last'));
    start(last||(spotlight || journey?insertCasts[0][0][0]:insertCasts[0][1][1]),null,{album,spotlight,resume:Boolean(last),courier:journey});
  }
  return {start,openLast,resume:()=>openLast(false,false,read('slip:courier-open')===true),shouldResume:()=>read('slip:tail-open')===true};
}
