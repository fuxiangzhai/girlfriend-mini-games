import {orderName} from './duet-plays.mjs';
import {drawTicketMap} from './lantern-glass.mjs';
import {portName} from './light-path.mjs';
import {readProjector} from './projection.mjs';
import {readingNames} from './receipt-plays.mjs';
import {differentPanes} from './slip-path.mjs';
import {tailMargin,tailPage} from './tail-plays.mjs';
import {tailCost} from './tail-score.mjs';

export async function tailPrint(l,r,art,twin){
  const page=tailPage(l),ending=page.endings[r.end],paper=document.createElement('canvas');
  paper.width=1200;paper.height=twin?1080:890;
  const g=paper.getContext('2d'),serif='"Songti SC","SimSun",serif',sans='"Microsoft YaHei","PingFang SC",sans-serif';
  function label(s,x,y,size=22,face=serif,ink='#35463d'){
    g.fillStyle=ink;g.font=size+'px '+face;g.fillText(s,x,y);
  }
  function wrap(s,x,y,w){
    let line='';g.font='23px '+serif;
    for(const ch of s){
      if(line && g.measureText(line+ch).width>w){label(line,x,y,23);y+=35;line='';}
      line+=ch;
    }
    label(line,x,y,23);return y;
  }
  async function illustration(e){
    const image=new Image();image.src=art(l.play.artId,page.endings[e].layer);await image.decode();return image;
  }
  function map(board,x,y,w,h){
    const cell=document.createElement('canvas');cell.width=w;cell.height=h;
    const result=readProjector(l,board);drawTicketMap(cell,l,{slots:board,result});g.drawImage(cell,x,y);
    return result.rays.map(r=>portName(r.exit)).join(' ／ ');
  }
  g.fillStyle='#2c443c';g.fillRect(0,0,1200,paper.height);g.fillStyle='#f7eed9';g.fillRect(12,12,1176,paper.height-24);
  g.strokeStyle='#b09b72';g.strokeRect(24,24,1152,paper.height-48);
  label('留 灯 换 景　 ／　 折 后 戏 笺',48,67,18,sans,'#6f6049');
  label(ending.title,45,128,49);label(l.play.coda.paper+' · '+orderName(l)+' · '+readingNames[l.play.coda.mode],48,169,23);
  g.textAlign='right';label((r.source.peer?'骑缝续演':'借谱试排')+'　／　续场 '+tailCost(l,r)+' 响',1150,124,24,sans);g.textAlign='left';
  const img=await illustration(r.end);g.drawImage(img,49,200,717,418);
  const eight=map(r.mid,790,200,360,160),nine=map(r.last,790,418,360,160);
  label('第八拍　'+page.routes[r.route],790,391,20);label('第九拍　'+ending.action,790,612,20);
  const a=differentPanes(l,r.source.tape[6],r.mid).length,b=differentPanes(l,r.mid,r.last).length;
  label('第八拍 '+eight+'（'+a+' 响）　→　第九拍 '+nine+'（'+b+' 响）',49,657,20,sans,'#74563e');
  wrap(ending.lines[r.route],49,719,1095);
  wrap(tailMargin(l,r.end),49,803,1095);
  if(twin){
    g.strokeStyle='#b09b72';g.beginPath();g.moveTo(49,856);g.lineTo(1151,856);g.stroke();
    const sibling=await illustration(1-r.end);g.drawImage(sibling,49,882,236,138);
    const exits=map(twin,297,882,222,138),otherCost=differentPanes(l,r.mid,twin).length;
    label(page.endings[1-r.end].title+'　'+exits+'　换 '+otherCost+' 片',49,1047,17,sans);
    label('同一拍双落款　·　'+page.joint[0],541,919,25);
    wrap(page.joint[1],541,961,607);
  }
  return new Promise((resolve,reject)=>paper.toBlob(blob=>blob?resolve(blob):reject(Error('印笺失败')),'image/png'));
}
