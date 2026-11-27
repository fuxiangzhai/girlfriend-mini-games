import {beginCourier,completedPath,courierBook,courierCue,fare,fileCourier,forecasts,orders,readCourier,roadsFor,saveCourier,savedCourier,stopStep,takeCourier,ways} from './courier-score.mjs';
import {courierEnding,courierPage,cueName,handoffNotes,orderName,paceNames,stepNote,wayNames} from './courier-plays.mjs';
import {courierPrint} from './courier-print.mjs';
import {drawTicketMap} from './lantern-glass.mjs';
import {lampNames} from './light-path.mjs';
import {readProjector} from './projection.mjs';
import {differentPanes} from './slip-path.mjs';
import {foldName,routeNames,tailPage} from './tail-plays.mjs';
import {anchor,midAt,socketHint} from './tail-score.mjs';

const $=id=>document.getElementById(id);
const sound=n=>Number.isFinite(n)?n+' 响':'此路走不通';
const roadName=(l,flap,route)=>foldName(flap)+' · '+routeNames(l,flap)[route];
function chip(attr,value,heading,caption,on){
  return '<button type="button" '+attr+'="'+value+'" aria-pressed="'+on+'"><strong>'+heading+'</strong><small>'+caption+'</small></button>';
}
function drawMap(canvas,l,slots){
  const result=readProjector(l,slots);
  drawTicketMap(canvas,l,{slots,result},{selected:-1,goal:result.rays.map(r=>r.exit)});
}
export function setupCourierDesk(art,changed){
  let l,w=null,renderToken=0,archiveDirty=true;
  function update(next,note='',focus=''){
    if(!next)return;
    w=next;renderToken++;changed(note,focus);
  }
  function open(level,ordinary,useBoard=false,resumeOwn=null){
    l=level;archiveDirty=true;renderToken++;$('courier-shelf').open=false;
    const source=ordinary.source,old=readCourier(l,resumeOwn??Boolean(source.peer));
    if(resumeOwn!==null && old){w=old;return;}
    const mid=ordinary.mid && midAt(l,source,ordinary.route,ordinary.mid,ordinary.flap);
    const pin=mid?.finals.every(f=>f.length)?mid.row.slots:null;
    if(!useBoard && old && anchor(l,old.source)===anchor(l,source)){w=old;return;}
    const order=l.play.coda.baseId==='postmark'?'021':'012';
    w=courierBook(source,pin?ordinary.flap:1,pin?ordinary.route:0,pin,order);
    if(pin){
      if(!Number.isFinite(fare(l,w))){
        const other=orders.find(o=>Number.isFinite(fare(l,{...w,order:o})));
        if(other)w.order=other;else w.way='fold';
      }
    }else{
      const roads=roadsFor(l,w),best=roads.find(r=>r.flap===1 && Number.isFinite(r.price)) || roads[0];
      if(Number.isFinite(best.price)){w.flap=best.flap;w.route=best.route;}else w.way='fold';
    }
  }
  function hide(){w=null;renderToken++;}
  function rebook(pin){
    update(courierBook(w.source,w.flap,w.route,pin,w.order,w.way),'','courier-book-title');
  }
  function renderBook(){
    const page=courierPage(l),roads=roadsFor(l,w),local=fare(l,w);
    $('courier-book-art').src=art(l.play.artId,page.layer);
    const select=$('courier-road');select.disabled=Boolean(w.pin);
    select.innerHTML=[0,1].flatMap(flap=>[0,1].map(route=>{
      const road=roads.find(r=>r.route===route && r.flap===flap);
      const price=w.pin && flap===w.flap && route===w.route?local:road.price;
      return '<option value="'+(flap*2+route)+'">'+roadName(l,flap,route)+' · '+sound(price)+'</option>';
    })).join('');select.value=String(2*w.flap+w.route);
    $('courier-pin').textContent=w.pin?'沿用已演过的第八拍。三处都从这一套玻璃留路，原先的换片计入整趟响数。':'第八拍只排一次。三站的收场镜位都要能从这一拍走到。';
    $('courier-release').hidden=!w.pin;
    $('courier-ways').innerHTML=ways.map(way=>chip('data-courier-way',way,wayNames[way],sound(fare(l,{...w,way})),w.way===way)).join('');
    $('courier-rule').textContent=w.way==='direct'?'至少有一程要守住上一站的一盏灯，最多换三片，直接把笺递过去。其余路段沿原折往返。':'每到一站都能捎一句话。前两站送达后，亲手还原共同的第八拍，再把折里的话送去下一站。';
    $('courier-orders').innerHTML=orders.map(order=>chip('data-courier-order',order,orderName(l,order),sound(fare(l,{...w,order})),order===w.order)).join('');
    $('courier-begin').disabled=!Number.isFinite(local);
    $('courier-fare').textContent=Number.isFinite(local)?'整趟最低 '+sound(local)+'。每步落片时，和上一步镜位不同的玻璃各计一响。':w.pin?'这一套第八拍接不出所选走法。可以换次序、回折捎话或另排第八拍。':'这条路线接不出所选走法。可以换道、换序或点「回折捎话」。';
    $('courier-cheaper').hidden=!Number.isFinite(roads[0].price) || roads[0].price>=local;
    $('courier-cheaper').textContent='另排「'+routeNames(l,roads[0].flap)[roads[0].route]+'」 · '+sound(roads[0].price);
    const plans=forecasts(l,w);$('courier-forecast').hidden=!plans.length;
    if(plans.length){
      const chosen=plans.find(p=>p.pace===w.pace) || plans[0];
      const handoffs=handoffNotes(l,chosen.path.steps);
      $('courier-book-note').textContent=handoffs.map(h=>h.label).join('　／　')+'。最后由'+tailPage(l).shortStops[+w.order[2]]+'收笺。';
      $('courier-forecast-title').textContent=plans.length>1?'比较 '+plans.length+' 种排法 · '+paceNames[chosen.pace]:'看逐步排法 · '+sound(chosen.path.total);
      $('courier-paces').hidden=plans.length<2;
      $('courier-paces').innerHTML=plans.map(p=>chip('data-courier-pace',p.pace,paceNames[p.pace],sound(p.path.total),p===chosen)).join('');
      $('courier-forecast-steps').innerHTML=chosen.path.steps.map(s=>'<li>'+cueName(l,s)+' <strong>'+sound(s.cost)+'</strong></li>').join('');
      $('courier-forecast-note').textContent='这一排合计 '+sound(chosen.path.total)+'。开演后提示会照这一排引路，也可以自己另调镜位。';
    }else $('courier-book-note').textContent='这道折痕接不上所点的次序与递法。翻看其他路线，或把这一趟改作回折捎话。';
  }
  function renderRun(cue){
    const places=tailPage(l).shortStops,visited=w.steps.filter(stopStep).length;
    $('courier-run-title').textContent=wayNames[w.way]+' · '+routeNames(l,w.flap)[w.route];
    $('courier-stations').innerHTML=Array.from(w.order,(e,i)=>'<li'+(i===visited?' aria-current="step"':'')+'><strong>'+places[e]+'</strong><small>'+(i<visited?'已送达':i===visited?'正前往':'待送')+'</small></li>').join('');
    $('courier-line').textContent=stepNote(l,w,w.steps);
    let prev=w.source.tape[6],spent=0;
    for(const step of w.steps){spent+=differentPanes(l,prev,step.slots).length;prev=step.slots;}
    $('courier-ledger').textContent='已落片 '+sound(spent)+' · 从这里演完整趟最低 '+sound(cue.best)+'。'+(w.pace!=='quiet'?'照「'+paceNames[w.pace]+'」排是 '+sound(cue.guide.total)+'。':'');
    $('courier-reference').hidden=!w.steps.length;
    if(w.steps.length){
      drawMap($('courier-reference-map'),l,w.steps[0].slots);
      const changes=differentPanes(l,w.slots,w.steps[0].slots).map(i=>l.pieces[i].name);
      $('courier-reference-note').textContent=changes.length?'桌上和第八拍相差 '+changes.length+' 片，分别是'+changes.join('、')+'。':'桌上正是这一趟的第八拍。';
    }
    $('courier-rewind').disabled=w.steps.length<=(w.pin?1:0);
  }
  function renderFinish(){
    const path=completedPath(l,w),page=courierPage(l),ends=tailPage(l).endings,ending=courierEnding(l,w);
    $('courier-letter-art').src=art(l.play.artId,page.layer);$('courier-letter-art').alt=l.play.coda.baseId==='postmark'?'传过三处的饭篮、碗筷和习字纸':'传过三处的铃绳、铜铃和交接纸';
    $('courier-stamp').textContent=(w.source.peer?'骑缝续演':'借谱试排')+' ／ '+roadName(l,w.flap,w.route)+' ／ '+wayNames[w.way];
    $('courier-title').textContent=ending.title;$('courier-story').textContent=ending.story;$('courier-after').textContent=ending.after;
    $('courier-keeps').innerHTML=handoffNotes(l,w.steps).map(n=>'<div><strong>'+n.label+'</strong><p>'+n.text+'</p></div>').join('');
    const scenes=path.steps.filter(stopStep).map(step=>{
      const fig=document.createElement('figure'),img=new Image(),cap=document.createElement('figcaption');
      img.src=art(l.play.artId,ends[step.end].layer);img.alt=ends[step.end].title;
      cap.textContent=cueName(l,step)+' · '+sound(step.cost);fig.append(img,cap);return fig;
    });
    $('courier-scenes').replaceChildren(...scenes);
    const back=path.steps.filter(s=>s.kind==='back').length,n=path.steps.filter(s=>s.kind==='direct').length;
    const kept=fare(l,{...w,pin:w.steps[0].slots}),best=roadsFor(l,w)[0];
    $('courier-total').textContent=orderName(l,w.order)+'。直递 '+n+' 次，折回 '+back+' 次，整趟 '+sound(path.total)+'。沿用这套第八拍最低 '+sound(kept)+'。';
    $('courier-challenge').hidden=path.total<=best.price;
    $('courier-challenge').textContent=(kept===best.price?'留原镜位重排':'改排「'+routeNames(l,best.flap)[best.route]+'」')+' · 挑战 '+sound(best.price);
    const maps=path.steps.map((step,i)=>{
      const fig=document.createElement('figure'),canvas=document.createElement('canvas'),cap=document.createElement('figcaption');
      const prev=i?path.steps[i-1].row.slots:w.source.tape[6],moved=differentPanes(l,prev,step.row.slots).map(id=>l.pieces[id].name);
      canvas.width=340;canvas.height=205;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',cueName(l,step)+'的实演镜位');
      drawMap(canvas,l,step.row.slots);cap.textContent=cueName(l,step)+' · 守'+lampNames[step.keeper]+'。换'+moved.join('、')+'，'+sound(step.cost)+'。';fig.append(canvas,cap);return fig;
    });$('courier-maps').replaceChildren(...maps);
    $('courier-print-status').textContent='';$('courier-print').disabled=false;
  }
  function shelf(){
    let ownCount=0,trial=0;const buttons=[];
    for(const order of orders)for(const way of ways)for(const own of [true,false]){
      const entry=savedCourier(l,order,way,own);if(!entry)continue;
      if(own)ownCount++;else trial++;
      buttons.push('<button type="button" class="secondary" data-courier-file="'+order+'" data-way="'+way+'" data-own="'+own+'"><strong>'+courierEnding(l,entry.w).title+'</strong><small>'+orderName(l,order)+' · '+wayNames[way]+' · '+(own?'实演':'试排')+' '+sound(entry.total)+'</small></button>');
    }
    $('courier-count').textContent='实演 '+ownCount+' · 试排 '+trial;
    $('courier-files').innerHTML=buttons.join('') || '<p>走完三站后，落款会收在这里。</p>';archiveDirty=false;
  }
  function draw(cue){
    $('courier-book').hidden=w?.phase!=='book';$('courier-run').hidden=w?.phase!=='play';$('courier-letter').hidden=w?.phase!=='done';
    $('courier-shelf').hidden=!w;if(!w)return;
    if(w.phase==='book')renderBook();else if(w.phase==='play')renderRun(cue);else renderFinish();
    if(archiveDirty)shelf();
  }
  $('courier-road').onchange=()=>{const code=+$('courier-road').value;update({...w,flap:code>>1,route:code%2,pace:'quiet'});};
  $('courier-orders').onclick=e=>{const b=e.target.closest('[data-courier-order]');if(b)update({...w,order:b.dataset.courierOrder,pace:'quiet'});};
  $('courier-ways').onclick=e=>{const b=e.target.closest('[data-courier-way]');if(b)update({...w,way:b.dataset.courierWay,pace:'quiet'});};
  $('courier-paces').onclick=e=>{const b=e.target.closest('[data-courier-pace]');if(b)update({...w,pace:b.dataset.courierPace});};
  $('courier-release').onclick=()=>rebook(null);
  $('courier-cheaper').onclick=()=>{const r=roadsFor(l,w)[0];update({...w,pin:null,flap:r.flap,route:r.route,pace:'quiet'},'','courier-begin');};
  $('courier-begin').onclick=()=>update(beginCourier(l,w),'','tail-cue');
  $('courier-rebook').onclick=()=>rebook(w.pin);
  $('courier-next-order').onclick=()=>rebook(w.steps[0].slots);
  $('courier-challenge').onclick=()=>{
    const pin=w.steps[0].slots,best=roadsFor(l,w)[0];
    const next=fare(l,{...w,pin})===best.price?courierBook(w.source,w.flap,w.route,pin,w.order,w.way):courierBook(w.source,best.flap,best.route,null,w.order,w.way);
    update(next,'','courier-book-title');
  };
  $('courier-rewind').onclick=()=>{
    if(w.steps.length<=(w.pin?1:0))return;
    const steps=w.steps.slice(0,-1);update({...w,steps,slots:steps.at(-1)?.slots||w.source.tape[6],selected:-1},'已撤回上一步落片，可以换一套镜位。','tail-cue');
  };
  $('courier-files').onclick=e=>{
    const b=e.target.closest('[data-courier-file]');if(!b)return;
    const entry=savedCourier(l,b.dataset.courierFile,b.dataset.way,b.dataset.own==='true');
    if(entry)update(entry.w,'','courier-title');
  };
  $('courier-shelf').ontoggle=()=>{if(w && $('courier-shelf').open)shelf();};
  $('courier-print').onclick=async()=>{
    const token=renderToken;$('courier-print').disabled=true;
    try{
      const blob=await courierPrint(l,w,art);if(token!==renderToken)return;
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;
      a.download='留灯换景-'+l.play.coda.paper+'-'+courierEnding(l,w).title+'-'+wayNames[w.way]+'-'+(w.source.peer?'骑缝续演':'借谱试排')+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('courier-print-status').textContent='整趟走笺已冲印。';
    }catch{if(token===renderToken)$('courier-print-status').textContent='这次未能冲印，可以再试一次。';}
    finally{if(token===renderToken)$('courier-print').disabled=false;}
  };
  function advance(){
    const next=takeCourier(l,w);
    if(!next)return false;
    if(next.phase==='done'){if(!fileCourier(l,next))return false;archiveDirty=true;}
    update(next,'',next.phase==='done'?'courier-title':'tail-cue');return true;
  }
  return {open,hide,draw,advance,get state(){return w;},cue:()=>courierCue(l,w),remember:()=>saveCourier(l,w),
    hint:cue=>socketHint(l,w.slots,{...cue,options:cue.recommended},()=>0),invalidate:()=>{renderToken++;}};
}
