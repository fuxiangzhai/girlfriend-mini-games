import {atLandedBoard,budget,courierBook,courierCue,fare,forecasts,oppositeOrder,pairedLetters,pairs,pairVersions,redirectCourier,savedPair,secondLetter,stationCourses,stopStep,wayFor,ways} from './courier-score.mjs';
import {courierEnding,cueName,handoffNotes,orderName,wayNames} from './courier-plays.mjs';
import {deliveryLabel,marginStory,pairEnding,pairLabel,twinAlt} from './counter-plays.mjs';
import {printPair} from './counter-print.mjs';
import {lampNames} from './light-path.mjs';
import {tailPage} from './tail-plays.mjs';

const $=id=>document.getElementById(id);
const sounds=n=>Number.isFinite(n)?n+' 响':'这套镜位接不上';
function button(key,value,title,note,pressed,disabled=false){
  return '<button type="button" '+key+'="'+value+'"'+(pressed==null?'':' aria-pressed="'+pressed+'"')+(disabled?' disabled':'')+'><strong>'+title+'</strong><small>'+note+'</small></button>';
}
export function setupCounterDesk(current,update,art,drawMap){
  let replay=null;
  function book(l,w){
    const places=tailPage(l).shortStops,first=Number(w.order[0]);
    $('counter-premise').textContent='从'+places[first]+'发两封。两封共用第八拍和首站的整套镜位，余下两站交换先后。';
    $('counter-programs').innerHTML=pairs.map(pair=>{
      const price=fare(l,{...w,pair,way:wayFor(pair,w.order)});
      return button('data-counter-pair',pair,pairLabel(l,first,pair),Number.isFinite(price)?'合排 '+sounds(price):'本路接不上',w.pair===pair);
    }).join('');
    $('counter-single').hidden=!w.pair;
    $('counter-target').textContent=w.pair?'先演「'+orderName(l,w.order)+'」，再留着首站走「'+orderName(l,oppositeOrder(w.order))+'」。':'点一组递法，就能在开演前比较两封合起来的响数。';
  }
  function run(l,w,cue){
    const courses=stationCourses(l,w),panel=$('counter-station');panel.hidden=!courses.length;
    if(!courses.length)return;
    const clean=atLandedBoard(l,w),visited=w.steps.filter(stopStep).length,places=tailPage(l).shortStops;
    const suggested=cue.guide.steps.filter(s=>s.kind==='out' || s.kind==='direct').map(s=>s.kind==='direct'?'d':'f').join('');
    $('counter-course-note').textContent=!clean?'本拍已有玻璃离开原位。点「还原本拍」，可以在这一站改投。':w.mate?'第一封已收好。沿这套首站镜位演完另一封，合排才会落款。':visited===1?'首站已落片。现在可交换后两站，也可换递法，已经演过的两步会留下。':'第二站已送达。已经走过的路会留下，看看这一程还能怎样到终点。';
    $('counter-courses').innerHTML=courses.map(c=>{
      const target=visited===1?places[Number(c.order[1])]+' → '+places[Number(c.order[2])]:'送到'+places[Number(c.order[2])];
      const name=visited===1?deliveryLabel(c.legs):c.legs[1]==='d'?'守灯直递':'回折捎话';
      const prefix=c.path.steps.slice(0,w.steps.length).reduce((n,s)=>n+s.cost,0);
      return button('data-counter-course',c.order+'-'+c.legs,target+' · '+name,'余程 '+sounds(c.path.total-prefix)+(w.pair?' ／ 两封 '+sounds(budget(c.path)):''),c.order===w.order && c.legs===suggested,!clean);
    }).join('');
  }
  function finish(l,w){
    const duet=pairedLetters(l,w),finish=$('counter-ending');finish.hidden=!duet;
    const follow=$('counter-follow');follow.hidden=Boolean(duet);
    if(!duet){
      const other=oppositeOrder(w.order);
      $('counter-follow-note').textContent='从这张首站原位改送「'+orderName(l,other)+'」。已落过的两步只计一次。';
      $('counter-replies').innerHTML=ways.map(way=>{
        const next=secondLetter(l,w,way),quote=next?courierCue(l,next).best:Infinity;
        return button('data-counter-reply',way,wayNames[way]+(w.pair && way===wayFor(w.pair,other)?' · 原定':''),
          Number.isFinite(quote)?'两封合排可到 '+sounds(quote):'这套首站接不上',null,!next);
      }).join('');return;
    }
    const {first,pair,arms,shared,total}=duet,places=tailPage(l).shortStops,ending=pairEnding(l,first,pair);
    $('counter-art').src=art(l.play.artId,'twins');$('counter-art').alt=twinAlt(l);
    $('counter-title').textContent=ending.title;$('counter-story').textContent=ending.story;
    $('counter-seal').textContent=(w.source.peer?'骑缝续演':'借谱试排')+' ／ '+places[first]+'同首 ／ 两路对笺';
    $('counter-bill').textContent=arms[0].path.total+' ＋ '+arms[1].path.total+' − 共用 '+shared+' ＝ 合排 '+sounds(total)+'。';
    const versions=pairVersions(l,w,duet);$('counter-versions').hidden=versions.length<2;
    const left=arms[0].w;
    replay={...courierBook(left.source,left.flap,left.route,null,left.order,left.way),pair};
    const alternative=forecasts(l,replay).find(({path})=>path.joint===total && !versions.some(v=>v.left===path.total && v.right===path.partner.total));
    if(alternative)replay.pace=alternative.pace;
    $('counter-again').textContent=alternative?'另排 '+alternative.path.total+' 与 '+alternative.path.partner.total+' 响，同为 '+sounds(total):'从第七拍另排对笺';
    if(versions.length>=2){
      const [title,story]=marginStory(l);
      $('counter-margin-title').textContent='同响异谱 · '+title;$('counter-margin').textContent=story;
      $('counter-splits').innerHTML=versions.map(v=>button('data-counter-split',v.left+'-'+v.right,'经'+places[+arms[0].w.order[1]]+' '+sounds(v.left)+' ／ 经'+places[+arms[1].w.order[1]]+' '+sounds(v.right),'共用 '+sounds(v.shared)+' · 合排 '+sounds(total),v.left===arms[0].path.total && v.right===arms[1].path.total)).join('');
    }
    $('counter-arms').innerHTML=arms.map(({w:arm,path})=>{
      const story=courierEnding(l,arm),notes=handoffNotes(l,arm.steps);
      return '<details><summary><strong>'+story.title+'</strong><small>'+orderName(l,arm.order)+' · '+sounds(path.total)+'</small></summary><p>'+story.after+'</p>'+notes.map(n=>'<p><b>'+n.label+'</b>　'+n.text+'</p>').join('')+'</details>';
    }).join('');
    const maps=$('counter-proof-maps');maps.replaceChildren();
    function row(title,steps){
      const heading=document.createElement('h4');heading.textContent=title;
      const group=document.createElement('div');group.className='counter-map-row';
      for(const step of steps){
        const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');
        canvas.width=340;canvas.height=205;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',cueName(l,step)+'的实演镜位');
        drawMap(canvas,l,step.row.slots);caption.textContent=cueName(l,step)+' · 守'+lampNames[step.keeper]+' · '+sounds(step.cost);
        figure.append(canvas,caption);group.append(figure);
      }
      maps.append(heading,group);
    }
    row('两封共用',arms[0].path.steps.slice(0,2));
    for(const arm of arms)row(orderName(l,arm.w.order),arm.path.steps.slice(2));
    $('counter-print-note').textContent='';$('counter-print').disabled=false;
  }
  function draw(l,w,cue){
    $('counter-ending').hidden=true;
    if(w?.phase==='book')book(l,w);
    if(w?.phase==='play')run(l,w,cue);
    if(w?.phase==='done')finish(l,w);
  }
  function shelf(l){
    const cards=[],margins=[];let own=0,trial=0;
    for(const first of [0,1,2])for(const pair of pairs)for(const signed of [true,false]){
      const entry=savedPair(l,first,pair,signed);if(!entry)continue;
      if(signed)own++;else trial++;
      cards.push(button('data-counter-file',[first,pair,Number(signed)].join('-'),pairEnding(l,first,pair).title,
        tailPage(l).shortStops[first]+'首发 · '+(signed?'实演':'试排')+' '+sounds(entry.total),null));
      const margin=savedPair(l,first,pair,signed,true);
      if(margin)margins.push(button('data-counter-file',[first,pair,Number(signed),'margin'].join('-'),marginStory(l)[0],
        pairEnding(l,first,pair).title+' · '+(signed?'实演':'试排')+' '+sounds(margin.total),null));
    }
    $('counter-count').textContent='实演 '+own+' · 试排 '+trial;
    $('counter-files').innerHTML=cards.join('') || '<p>从同一套首站镜位把两封都寄到，会在这里留一份对笺。</p>';
    $('counter-margins').hidden=!margins.length;$('counter-margin-files').innerHTML=margins.join('');
  }
  $('counter-programs').onclick=e=>{
    const {w}=current(),b=e.target.closest('[data-counter-pair]');if(!b)return;
    const pair=b.dataset.counterPair;update({...w,pair,way:wayFor(pair,w.order),pace:'quiet'});
  };
  $('counter-single').onclick=()=>{const {w}=current();update({...w,pair:null,pace:'quiet'},'','courier-book-title');};
  $('counter-courses').onclick=e=>{
    const {l,w}=current(),b=e.target.closest('[data-counter-course]');if(!b)return;
    const [order,legs]=b.dataset.counterCourse.split('-');update(redirectCourier(l,w,order,legs),'已照这一程改投，沿途响数接着算。','tail-cue');
  };
  $('counter-replies').onclick=e=>{
    const {l,w}=current(),b=e.target.closest('[data-counter-reply]');if(b)update(secondLetter(l,w,b.dataset.counterReply),'从共演的首站接着走。','tail-cue');
  };
  $('counter-files').onclick=$('counter-margin-files').onclick=e=>{
    const {l}=current(),b=e.target.closest('[data-counter-file]');if(!b)return;
    const [first,pair,signed,margin]=b.dataset.counterFile.split('-'),entry=savedPair(l,Number(first),pair,signed==='1',margin==='margin');
    if(entry)update(entry.w,'','counter-title');
  };
  $('counter-splits').onclick=e=>{
    const {l,w}=current(),b=e.target.closest('[data-counter-split]');if(!b)return;
    const selected=pairVersions(l,w).find(v=>v.left+'-'+v.right===b.dataset.counterSplit);
    if(selected)update(selected.w,'','counter-margin-title');
  };
  $('counter-again').onclick=()=>{
    $('counter-book').open=true;$('courier-forecast').open=true;update(replay,'','courier-book-title');
  };
  $('counter-print').onclick=async()=>{
    const {l,w,token}=current();$('counter-print').disabled=true;
    try{
      const blob=await printPair(l,w,art);if(current().token!==token)return;
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;
      a.download='留灯换景-'+l.play.coda.paper+'-'+pairEnding(l,Number(w.order[0]),w.pair).title+'-两路对笺-'+(w.source.peer?'骑缝续演':'借谱试排')+'.png';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('counter-print-note').textContent='两封的落款和实演镜位已冲印。';
    }catch{if(current().token===token)$('counter-print-note').textContent='这次未能冲印，可以再试一次。';}
    finally{if(current().token===token)$('counter-print').disabled=false;}
  };
  return {draw,shelf};
}
