import {completedPath,stopStep} from './courier-score.mjs';
import {courierEnding,courierPage,cueName,handoffNotes,orderName,wayNames} from './courier-plays.mjs';
import {orderName as castName} from './duet-plays.mjs';
import {lampNames} from './light-path.mjs';
import {readingNames} from './receipt-plays.mjs';
import {foldName,routeNames,tailPage} from './tail-plays.mjs';
import {paperInk} from './tail-print.mjs';

export async function courierPrint(l,w,art){
  const path=completedPath(l,w);if(!path)throw Error('未演完三站');
  const cover=courierPage(l),ending=courierEnding(l,w),stops=path.steps.filter(stopStep);
  const paper=document.createElement('canvas');paper.width=1200;paper.height=1590;
  const {g,label,wrap,map,sans}=paperInk(l,paper);
  async function load(layer){
    const img=new Image();img.src=art(l.play.artId,layer);await img.decode();return img;
  }
  const scenes=tailPage(l).endings,images=await Promise.all([load(cover.layer),...stops.map(s=>load(scenes[s.end].layer))]);
  label('留 灯 换 景　／　三 站 走 笺',48,67,18,sans,'#6c6049');
  label(ending.title,45,131,52);label(l.play.coda.paper+' · '+castName(l)+' · '+readingNames[l.play.coda.mode],49,173,22);
  g.textAlign='right';label((w.source.peer?'骑缝续演':'借谱试排')+'　／　整趟 '+path.total+' 响',1151,123,24,sans);g.textAlign='left';
  g.drawImage(images[0],48,203,650,379);
  label(wayNames[w.way],730,253,31);label(orderName(l,w.order),730,299,24,sans);
  label(foldName(w.flap)+' · '+routeNames(l,w.flap)[w.route],730,339,21,sans,'#755c44');
  wrap(ending.story,730,396,420,22,34);
  for(const [i,s] of stops.entries()){
    const x=48+i*375;g.drawImage(images[i+1],x,606,354,206);
    label(cueName(l,s)+' · '+scenes[s.end].title,x,847,21);
  }
  wrap(ending.after,48,903,1094,23,32);
  for(const [i,note] of handoffNotes(l,path.steps).entries()){
    const x=48+i*566;
    label(note.label,x,977,21,sans,'#755c44');wrap(note.text,x,1015,525,20,29);
  }
  g.strokeStyle='#b09b72';g.beginPath();g.moveTo(48,1108);g.lineTo(1152,1108);g.stroke();
  label('实演镜位',48,1150,27);
  g.textAlign='right';label(path.steps.map(s=>s.cost).join(' ＋ ')+' ＝ '+path.total+' 响',1152,1150,22,sans,'#755c44');g.textAlign='left';
  for(const [i,s] of path.steps.entries()){
    const x=48+i%3*375,y=1170+Math.floor(i/3)*191;
    map(s.row.slots,x,y,218,144);
    label(cueName(l,s),x+227,y+45,17);label('守'+lampNames[s.keeper],x+227,y+78,17,sans);
    label(s.cost+' 响',x+227,y+112,18,sans,'#755c44');
  }
  return new Promise((resolve,reject)=>paper.toBlob(blob=>blob?resolve(blob):reject(Error('印笺失败')),'image/png'));
}
