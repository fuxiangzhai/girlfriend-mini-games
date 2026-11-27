import {lampNames,portName} from './light-path.mjs';
import {readProjector} from './projection.mjs';
import {changeTotal,handStatus,makeHold,quietScore} from './slip-path.mjs';
import {isDuet,orderName} from './duet-plays.mjs';
import {carrierAt,propRecord} from './duet-marks.mjs';
import {foldLetter,paperName,readingLabel,readingNames} from './receipt-plays.mjs';
import {foldScore} from './fold-score.mjs';
import {drawTicketMap} from './lantern-glass.mjs';

export function layScreen(el,level,art) {
  const bg=new Image(),actor=new Image();
  const cast=level.play.castId||level.play.id;
  const artId=level.play.artId||level.play.id;
  bg.alt=actor.alt='';bg.src=art(artId,'bg');actor.src=art(cast,'actor');
  bg.className='painted-back';actor.className='slipping-glass';
  el.replaceChildren(bg);el.setAttribute('aria-label',level.play.backdrop);
  const {wire,anchor}=level.play;
  if(wire){
    const line=document.createElementNS('http://www.w3.org/2000/svg','svg');
    line.setAttribute('class','slip-wire');line.setAttribute('viewBox','0 0 100 100');line.setAttribute('preserveAspectRatio','none');
    line.setAttribute('aria-hidden','true');
    line.innerHTML='<path d="M0 '+wire[0]+' L100 '+wire[1]+'" fill="none" stroke="#38353e" stroke-width=".42"/>';
    el.append(line);
  }
  el.append(actor);
  let partner=null;
  if(isDuet(level)){
    partner=new Image();partner.className='slipping-glass second-glass';partner.alt='';partner.src=art(cast,'partner');el.append(partner);
  }
  let prop=null,receipt=null;
  if(level.play.delivery){
    prop=document.createElement('span');prop.className='relay-prop';prop.hidden=true;prop.setAttribute('aria-hidden','true');
    const image=new Image();image.alt='';image.src=art(artId,'prop');prop.append(image);el.append(prop);
    if(level.play.coda){
      receipt=new Image();receipt.alt='';receipt.src=art(artId,level.play.coda.insert?'insert':'receipt');receipt.hidden=true;
      prop.append(receipt);
    }
    prop.dataset.seal=String(carrierAt(level,2));
  }
  return {actor,partner,anchor,prop,receipt,level};
}
export function stagePose(scenes,at,key='pose',arc=0) {
  const position=Math.max(0,Math.min(scenes.length-1,at)),left=Math.floor(position),right=Math.ceil(position);
  const fraction=position-left,smooth=fraction*fraction*(3-2*fraction);
  const start=scenes[left][key],end=scenes[right][key];
  const pose=start.map((v,i)=>v+(end[i]-v)*smooth);
  if(arc && start[0]!==end[0])pose[1]-=arc*4*smooth*(1-smooth);
  return pose;
}
function moveActor(actor,pose,anchor=[.5,.5]) {
  actor.hidden=!pose;
  if(!pose)return;
  const [x,y,w,angle]=pose;
  actor.style.left=x+'%';actor.style.top=y+'%';actor.style.width=w+'%';
  actor.style.transformOrigin=anchor.map(v=>v*100+'%').join(' ');
  actor.style.transform='translate('+anchor.map(v=>-v*100+'%').join(',')+') rotate('+angle+'deg)';
}
export function propPose(level,at,poses){
  const d=level.play.delivery,returning=Boolean(level.play.coda && at>4);
  const giver=returning?1-d.giver:d.giver,pass=returning?6:d.pass,width=returning?9:d.width;
  function grip(i){
    const pose=poses[i];return pose?[pose[0]+d.grips[i][0],pose[1]+d.grips[i][1]]:null;
  }
  const raw=Math.max(0,Math.min(1,(at-pass+.50)/.44)),t=raw*raw*(3-2*raw);
  const start=grip(giver),end=grip(1-giver);
  if(t===0 || t===1){const hand=t===0?start:end;return hand?[...hand,width,0]:null;}
  if(!start || !end)return null;
  const arc=4*t*(1-t);
  return [start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*t-arc*4,width,arc*-12];
}
export function moveScreen(screen,pose,partnerPose,at=0){
  moveActor(screen.actor,pose,screen.anchor);
  if(screen.partner)moveActor(screen.partner,partnerPose);
  if(screen.prop){
    moveActor(screen.prop,propPose(screen.level,at,[pose,partnerPose]));
    if(screen.receipt){
      screen.receipt.hidden=at<=4;screen.prop.firstElementChild.hidden=at>4;
      screen.receipt.style.transform=screen.level.play.coda.mode && at>4 && at<6?'scaleX(-1)':'';
    }
    screen.prop.classList.toggle('is-stamped',at>=1.94);
  }
}
export function replayBeat(level,takes,index) {
  const slots=takes[index],result=readProjector(level,slots),frame=level.play.frames[index];
  const held=makeHold(level,takes[index-1],frame);
  const changed=held?handStatus(level,held,slots).changed:[];
  return {slots,result,held,changed,mark:frame.mark,scene:level.projection.scenes[result.scene]};
}
function imageAt(src){const img=new Image();img.src=src;return img.decode().then(()=>img);}
function paintScene(ctx,x,y,w,h,images,scene,level,index) {
  const [back,actor,partner,prop,receipt]=images,play=level.play;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const scale=Math.max(w/back.width,h/back.height),bw=back.width*scale,bh=back.height*scale;
  ctx.drawImage(back,x+(w-bw)/2,y+(h-bh)/2,bw,bh);
  if(play.wire){
    ctx.beginPath();ctx.moveTo(x,y+h*play.wire[0]/100);ctx.lineTo(x+w,y+h*play.wire[1]/100);
    ctx.strokeStyle='#38353e';ctx.lineWidth=h*.0042;ctx.stroke();
  }
  function draw(img,pose,anchor=[.5,.5],reverse=false){
    const [cx,cy,percent,angle]=pose,aw=w*percent/100,ah=aw*img.height/img.width;
    ctx.save();ctx.translate(x+w*cx/100,y+h*cy/100);ctx.rotate(angle*Math.PI/180);if(reverse)ctx.scale(-1,1);
    ctx.drawImage(img,-aw*anchor[0],-ah*anchor[1],aw,ah);ctx.restore();
  }
  draw(actor,scene.pose,play.anchor);if(partner)draw(partner,scene.partnerPose);
  if(prop){
    const p=propPose(level,index,[scene.pose,scene.partnerPose]);draw(receipt && index>4?receipt:prop,p,undefined,play.coda?.mode===1 && index===5);
    if(index>=2){
      const px=x+w*(p[0]+p[2]*.32)/100,py=y+h*p[1]/100,r=w*.0065;
      ctx.beginPath();
      if(carrierAt(level,2)===0)ctx.rect(px-r,py-r,2*r,2*r);else ctx.arc(px,py,r,0,Math.PI*2);
      ctx.fillStyle=carrierAt(level,2)===0?'#9b4837':'#29695a';ctx.fill();ctx.lineWidth=.8;ctx.strokeStyle='#fff2cd';ctx.stroke();
    }
  }
  ctx.restore();
}
function ticketRow(level,takes,images,credit='') {
  const beats=takes.map((_,i)=>replayBeat(level,takes,i));
  const canvas=document.createElement('canvas'),w=400,gap=18,margin=36;
  canvas.width=margin*2+w*beats.length+gap*(beats.length-1);canvas.height=level.play.delivery?604:552;
  const ctx=canvas.getContext('2d'),serif='"Songti SC","SimSun",serif',sans='"Microsoft YaHei","PingFang SC",sans-serif';
  function text(str,x,y,size,family=sans,color='#39383a') {ctx.fillStyle=color;ctx.font=size+'px '+family;ctx.fillText(str,x,y);}
  ctx.fillStyle='#303441';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f8eed6';ctx.fillRect(11,11,canvas.width-22,canvas.height-22);
  ctx.strokeStyle='#aa854f';ctx.strokeRect(20,20,canvas.width-40,canvas.height-40);
  text('留 灯 换 景',margin,65,31,serif);text(level.title,margin,100,24,serif);
  ctx.textAlign='right';text((credit?credit+'　·　':'')+'活动戏本  /  第 '+String(level.showIndex+1).padStart(2,'0')+' 出',canvas.width-margin,66,19,sans,'#70553d');ctx.textAlign='left';
  if(isDuet(level)){
    const total=changeTotal(level,takes);
    ctx.textAlign='right';text(orderName(level)+(level.play.coda?'　·　'+readingLabel(level):'')+'　·　全剧 '+total+' 响'+(total===quietScore(level).target?'　静场收班':''),canvas.width-margin,100,19,sans,'#435c54');ctx.textAlign='left';
  }
  beats.forEach(({scene,held,changed},i)=>{
    const x=margin+i*(w+gap),y=121,h=250;
    paintScene(ctx,x,y,w,h,images,scene,level,i);ctx.strokeStyle='#94784f';ctx.strokeRect(x,y,w,h);
    text('第 '+(i+1)+' 拍  ·  '+scene.title,x,409,22,serif);
    text(level.projection.entries.map((entry,j)=>lampNames[j]+' '+portName(entry)+'→'+portName(scene.exits[j])).join('    '),x,444,17,sans);
    if(held){
      text(lampNames[held.keeper]+'守住  '+held.held.map(id=>level.pieces[id].name).join('、'),x,479,17,sans,'#395250');
      text('换片  '+changed.map(id=>level.pieces[id].name).join('、'),x,506,17,sans,'#72533d');
    }else text('开场  ·  从这套镜位起演',x,479,17,sans,'#72533d');
    if(level.play.delivery){
      ctx.fillStyle='#e9dec2';ctx.fillRect(x,528,w,43);
      text(propRecord(level,i),x+10,556,18,serif,'#574832');
    }
  });
  return canvas;
}
function signedTicket(level,takes,other,images){
  const fold=other.fold?foldScore(level):null;
  const paper=document.createElement('canvas');paper.width=1440;paper.height=fold?1160:1030;
  const g=paper.getContext('2d'),serif='"Songti SC","SimSun",serif',sans='"Microsoft YaHei","PingFang SC",sans-serif';
  function label(str,x,y,size,font=serif,color='#344741'){
    g.fillStyle=color;g.font=size+'px '+font;g.fillText(str,x,y);
  }
  function rule(x,y,w){g.fillStyle='#b6a582';g.fillRect(x,y,w,1);}
  function wrapped(str,x,y,w){
    g.font='19px '+serif;let line='';
    for(const char of str){
      if(line && g.measureText(line+char).width>w){label(line,x,y,19);y+=27;line='';}
      line+=char;
    }
    label(line,x,y,19);
  }
  g.fillStyle='#33463f';g.fillRect(0,0,paper.width,paper.height);
  g.fillStyle='#f8efd9';g.fillRect(11,11,1418,paper.height-22);
  g.strokeStyle='#ab946a';g.strokeRect(22,22,1396,paper.height-44);
  label('留 灯 换 景   ／   活 动 戏 本',49,65,18,sans,'#71634d');
  label(fold?'骑缝双面联':'同谱双签联',47,125,52);
  label(level.title+(level.play.coda?'　·　'+(fold?paperName(level):readingLabel(level)):''),352,119,27);
  const art=images.at(-1),scale=Math.min(180/art.width,98/art.height);
  g.drawImage(art,1370-art.width*scale,80-art.height*scale/2,art.width*scale,art.height*scale);
  rule(49,151,1342);
  const records=[{l:level,t:takes},{l:other.level,t:other.takes}].sort((a,b)=>fold?a.l.play.coda.mode-b.l.play.coda.mode:a.l.play.delivery.version-b.l.play.delivery.version);
  if(fold){
    g.save();g.strokeStyle='#a47453';g.setLineDash([5,7]);g.beginPath();g.moveTo(719,161);g.lineTo(719,739);g.stroke();g.restore();
  }
  for(const [column,{l,t}] of records.entries()){
    const x=51+column*688,d=l.play.delivery;
    label(fold?readingNames[l.play.coda.mode]+' · '+orderName(l):orderName(l),x,201,32);label(fold?'本场 '+changeTotal(l,t)+' 响':d.version?'晚递实演':'早递实演',x+480,197,18,sans,'#786045');
    const scenes=fold?[5,6]:l.play.coda?[2,5]:[2,d.pass];
    scenes.forEach((index,row)=>{
      const y=222+row*260,beat=replayBeat(l,t,index);
      paintScene(g,x,y,323,202,images,beat.scene,l,index);
      const map=document.createElement('canvas');map.width=320;map.height=202;drawTicketMap(map,l,beat);
      g.drawImage(map,x+331,y);
      label('第 '+(index+1)+' 拍　'+propRecord(l,index),x,y+234,21);
    });
    rule(x,747,648);
    wrapped(l.projection.scenes.at(-1).story,x,782,645);
  }
  rule(49,848,1342);label(fold?'两场共用前 '+fold.depth+' 拍　／　第 '+(fold.depth+1)+' 拍起各自排灯':'两场共用的镜位',51,884,23);
  const cost=changeTotal(level,takes)+(fold?changeTotal(other.level,other.takes):0);
  const lowest=fold?cost===fold.min:level.play.coda && cost===quietScore(level,true).target;
  g.textAlign='right';label((lowest?(fold?'骑缝静场':'兼演静场')+'　·　':'')+(fold?'合计 ':'全剧 ')+cost+' 响',1387,883,22,sans);g.textAlign='left';
  const w=1336/takes.length;
  takes.forEach((_,i)=>{
    const x=51+i*w,beat=replayBeat(level,takes,i);
    const split=fold && i>=fold.depth;
    g.fillStyle=split?'#eddbc9':i%2?'#eee4ce':'#e7e1ca';g.fillRect(x,901,w-4,77);
    label('第 '+(i+1)+' 拍',x+9,928,18,sans);
    const tally=split?records.map(({l,t},j)=>(j?'倒 ':'顺 ')+replayBeat(l,t,i).changed.length).join(' · ')+' 响':
      beat.held?(fold?'两场各 ':lampNames[beat.held.keeper]+'守 · ')+beat.changed.length+' 响':'开场免计';
    label(tally,x+9,957,17,sans,'#544f41');
  });
  if(fold){
    const [title,story]=foldLetter(level);
    rule(49,1004,1342);label(title,51,1052,31,serif,'#774e35');wrapped(story,51,1094,1326);
  }
  return paper;
}
export async function longTicket(level,takes,art,other=null) {
  const layers=isDuet(level)?['bg','actor','partner']:['bg','actor'];
  if(level.play.delivery)layers.push('prop');
  if(level.play.coda)layers.push(level.play.coda.insert?'insert':'receipt');
  const images=await Promise.all(layers.map(layer=>imageAt(art((layer==='actor'||layer==='partner') && level.play.castId || level.play.artId || level.play.id,layer))));
  let canvas=other?.signed?signedTicket(level,takes,other,images):ticketRow(level,takes,images,level.play.delivery?'当场实演':'');
  if(other && !other.signed){
    const credit=level.play.delivery?(other.rehearsal?'同谱试演':'当场实演'):'';
    const next=ticketRow(other.level,other.takes,images,credit),pair=document.createElement('canvas');
    pair.width=canvas.width;pair.height=canvas.height+next.height;
    const ctx=pair.getContext('2d');ctx.drawImage(canvas,0,0);ctx.drawImage(next,0,canvas.height);canvas=pair;
  }
  return new Promise((res,rej)=>canvas.toBlob(blob=>blob?res(blob):rej(Error('长票未能冲印')),'image/png'));
}
