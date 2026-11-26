import {lampNames,portName} from './light-path.mjs';
import {readProjector} from './projection.mjs';
import {handStatus,makeHold} from './slip-path.mjs';

export function layScreen(el,level,art) {
  const bg=new Image(),actor=new Image();
  bg.alt=actor.alt='';bg.src=art(level.play.id,'bg');actor.src=art(level.play.id,'actor');
  bg.className='painted-back';actor.className='slipping-glass';
  el.replaceChildren(bg,actor);el.setAttribute('aria-label',level.play.backdrop);
  return actor;
}
export function stagePose(scenes,at) {
  const position=Math.max(0,Math.min(scenes.length-1,at)),left=Math.floor(position),right=Math.ceil(position);
  const fraction=position-left,smooth=fraction*fraction*(3-2*fraction);
  return scenes[left].pose.map((v,i)=>v+(scenes[right].pose[i]-v)*smooth);
}
export function moveActor(actor,pose) {
  actor.hidden=!pose;
  if(!pose)return;
  const [x,y,w,angle]=pose;
  actor.style.left=x+'%';actor.style.top=y+'%';actor.style.width=w+'%';
  actor.style.transform='translate(-50%,-50%) rotate('+angle+'deg)';
}
export function replayBeat(level,takes,index) {
  const slots=takes[index],result=readProjector(level,slots),frame=level.play.frames[index];
  const held=makeHold(level,takes[index-1],frame);
  const changed=held?handStatus(level,held,slots).changed:[];
  return {slots,result,held,changed,scene:level.projection.scenes[result.scene]};
}
function imageAt(src){const img=new Image();img.src=src;return img.decode().then(()=>img);}
function paintScene(ctx,x,y,w,h,back,actor,pose) {
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const scale=Math.max(w/back.width,h/back.height),bw=back.width*scale,bh=back.height*scale;
  ctx.drawImage(back,x+(w-bw)/2,y+(h-bh)/2,bw,bh);
  const [cx,cy,percent,angle]=pose,aw=w*percent/100,ah=aw*actor.height/actor.width;
  ctx.translate(x+w*cx/100,y+h*cy/100);ctx.rotate(angle*Math.PI/180);ctx.drawImage(actor,-aw/2,-ah/2,aw,ah);ctx.restore();
}
export async function longTicket(level,takes,art) {
  const [back,actor]=await Promise.all(['bg','actor'].map(layer=>imageAt(art(level.play.id,layer))));
  const beats=takes.map((_,i)=>replayBeat(level,takes,i));
  const canvas=document.createElement('canvas'),w=400,gap=18,margin=36;
  canvas.width=margin*2+w*beats.length+gap*(beats.length-1);canvas.height=552;
  const ctx=canvas.getContext('2d'),serif='"Songti SC","SimSun",serif',sans='"Microsoft YaHei","PingFang SC",sans-serif';
  function text(str,x,y,size,family=sans,color='#39383a') {ctx.fillStyle=color;ctx.font=size+'px '+family;ctx.fillText(str,x,y);}
  ctx.fillStyle='#303441';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#f8eed6';ctx.fillRect(11,11,canvas.width-22,canvas.height-22);
  ctx.strokeStyle='#aa854f';ctx.strokeRect(20,20,canvas.width-40,canvas.height-40);
  text('留 灯 换 景',margin,65,31,serif);text(level.title,margin,100,24,serif);
  ctx.textAlign='right';text('活动戏本  /  第 '+String(level.showIndex+1).padStart(2,'0')+' 出',canvas.width-margin,66,19,sans,'#70553d');ctx.textAlign='left';
  beats.forEach(({scene,held,changed},i)=>{
    const x=margin+i*(w+gap),y=121,h=250;
    paintScene(ctx,x,y,w,h,back,actor,scene.pose);ctx.strokeStyle='#94784f';ctx.strokeRect(x,y,w,h);
    text('第 '+(i+1)+' 拍  ·  '+scene.title,x,409,22,serif);
    text(level.projection.entries.map((entry,j)=>lampNames[j]+' '+portName(entry)+'→'+portName(scene.exits[j])).join('    '),x,444,17,sans);
    if(held){
      text(lampNames[held.keeper]+'守住  '+held.held.map(id=>level.pieces[id].name).join('、'),x,479,17,sans,'#395250');
      text('换片  '+changed.map(id=>level.pieces[id].name).join('、'),x,506,17,sans,'#72533d');
    }else text('开场  ·  从这套镜位起演',x,479,17,sans,'#72533d');
  });
  return new Promise((res,rej)=>canvas.toBlob(blob=>blob?res(blob):rej(Error('长票未能冲印')),'image/png'));
}
