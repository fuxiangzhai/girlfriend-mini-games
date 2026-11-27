import {pairedLetters,pairVersions} from './courier-score.mjs';
import {courierEnding,cueName,handoffNotes,orderName,wayNames} from './courier-plays.mjs';
import {marginStory,pairEnding} from './counter-plays.mjs';
import {orderName as castName} from './duet-plays.mjs';
import {lampNames} from './light-path.mjs';
import {readingNames} from './receipt-plays.mjs';
import {foldName,routeNames,tailPage} from './tail-plays.mjs';
import {paperInk} from './tail-print.mjs';

export async function printPair(l,w,art){
  const duet=pairedLetters(l,w);if(!duet)throw Error('两路还没送齐');
  const {first,pair,arms,shared,total}=duet,ending=pairEnding(l,first,pair),page=tailPage(l);
  const paper=document.createElement('canvas');paper.width=1200;paper.height=1620;
  const {g,label,wrap,map,sans}=paperInk(l,paper);
  const layers=['twins',...arms.map(a=>page.endings[Number(a.w.order[2])].layer)];
  const images=await Promise.all(layers.map(async layer=>{
    const img=new Image();img.src=art(l.play.artId,layer);await img.decode();return img;
  }));
  function rule(y){g.strokeStyle='#b09b72';g.beginPath();g.moveTo(48,y);g.lineTo(1152,y);g.stroke();}
  label('留 灯 换 景　／　两 路 对 笺',48,66,19,sans,'#755d42');
  label(ending.title,46,129,49);
  label(l.play.coda.paper+' · '+castName(l)+' · '+readingNames[l.play.coda.mode],48,174,22);
  g.textAlign='right';label((w.source.peer?'骑缝续演':'借谱试排')+'　／　合排 '+total+' 响',1152,123,23,sans);g.textAlign='left';
  g.drawImage(images[0],48,205,616,359);
  label(page.shortStops[first]+'同首改投',697,253,31);
  label(foldName(w.flap)+' · '+routeNames(l,w.flap)[w.route],698,298,21,sans,'#755d42');
  wrap(ending.story,698,359,452,23,36);
  rule(601);label('共用的两步',48,649,27);
  g.textAlign='right';label(arms[0].path.total+' ＋ '+arms[1].path.total+' − '+shared+' ＝ '+total+' 响',1152,649,24,sans);g.textAlign='left';
  for(const [i,step] of arms[0].path.steps.slice(0,2).entries()){
    const x=48+564*i;map(step.row.slots,x,674,191,119);
    label(cueName(l,step),x+211,717,22);label('守'+lampNames[step.keeper]+' · '+step.cost+' 响',x+211,755,20,sans);
  }
  rule(819);
  for(const [i,arm] of arms.entries()){
    const x=48+565*i,one=arm.w,story=courierEnding(l,one);
    label(story.title,x,872,30);label(orderName(l,one.order)+' · '+wayNames[one.way]+' · '+arm.path.total+' 响',x,912,20,sans,'#755d42');
    g.drawImage(images[i+1],x,945,214,125);wrap(story.after,x+231,977,301,19,29);
    const notes=handoffNotes(l,one.steps);label(notes[0].label,x,1116,19,sans);label(notes[1].label,x,1147,19,sans);
    for(const [j,step] of arm.path.steps.slice(2).entries()){
      const col=x+(j%2)*273,y=1178+Math.floor(j/2)*184;
      map(step.row.slots,col,y,196,111);label(cueName(l,step),col,y+135,18);
      label('守'+lampNames[step.keeper]+' · '+step.cost+' 响',col,y+162,17,sans,'#70583e');
    }
  }
  const versions=pairVersions(l,w,duet);
  rule(1548);label(versions.length>1?'同响异谱 · '+marginStory(l)[0]+'　'+versions.slice(0,3).map(v=>v.left+' ＋ '+v.right+' − '+v.shared).join('　／　')+'　各 '+total+' 响':'第八拍和首站各落一次。此后两封按各自实演的镜位逐步计响。',48,1586,18,sans,'#70583e');
  return new Promise((resolve,reject)=>paper.toBlob(b=>b?resolve(b):reject(Error('印笺失败')),'image/png'));
}
