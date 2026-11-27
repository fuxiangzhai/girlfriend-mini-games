import {orderName} from './duet-plays.mjs';
import {drawTicketMap} from './lantern-glass.mjs';
import {portName} from './light-path.mjs';
import {readProjector} from './projection.mjs';
import {readingNames} from './receipt-plays.mjs';
import {differentPanes} from './slip-path.mjs';
import {endingStory,endsIn,foldName,jointText,routeNames,tailMargin,tailPage} from './tail-plays.mjs';
import {actualPrice,tailCost} from './tail-score.mjs';

export function paperInk(l,paper){
  const g=paper.getContext('2d'),serif='"Songti SC","SimSun",serif',sans='"Microsoft YaHei","PingFang SC",sans-serif';
  function label(s,x,y,size=22,face=serif,ink='#35463d'){
    g.fillStyle=ink;g.font=size+'px '+face;g.fillText(s,x,y);
  }
  function wrap(s,x,y,w,size=23,leading=35){
    let line='';g.font=size+'px '+serif;
    // Set Chinese punctuation with its neighbour so a full stop never sits alone.
    for(const unit of s.match(/[「『《（“‘]*.[，。！？、）》」』”’]*/gu) || []){
      if(line && g.measureText(line+unit).width>w){label(line,x,y,size);y+=leading;line='';}
      line+=unit;
    }
    label(line,x,y,size);return y;
  }
  function map(board,x,y,w,h){
    const cell=document.createElement('canvas');cell.width=w;cell.height=h;
    const result=readProjector(l,board);drawTicketMap(cell,l,{slots:board,result});g.drawImage(cell,x,y);
    return result.rays.map(r=>portName(r.exit)).join(' ／ ');
  }
  g.fillStyle='#2c443c';g.fillRect(0,0,1200,paper.height);g.fillStyle='#f7eed9';g.fillRect(12,12,1176,paper.height-24);
  g.strokeStyle='#b09b72';g.strokeRect(24,24,1152,paper.height-48);
  return {g,label,wrap,map,sans,serif};
}
export async function tailPrint(l,r,art,legs,view){
  const page=tailPage(l),ending=page.endings[r.end],paper=document.createElement('canvas');
  const members=endsIn(view),others=members.filter(e=>e!==r.end);
  paper.width=1200;paper.height=[890,1080,1300][others.length];
  const {g,label,wrap,map,sans}=paperInk(l,paper);
  async function illustration(e){
    const image=new Image();image.src=art(l.play.artId,page.endings[e].layer);await image.decode();return image;
  }
  label('留 灯 换 景　 ／　 折 后 戏 笺',48,67,18,sans,'#6f6049');
  label(ending.title,45,128,49);label(l.play.coda.paper+' · '+orderName(l)+' · '+readingNames[l.play.coda.mode],48,169,23);
  g.textAlign='right';label((r.source.peer?'骑缝续演':'借谱试排')+'　／　续场 '+tailCost(l,r)+' 响',1150,124,24,sans);g.textAlign='left';
  const img=await illustration(r.end);g.drawImage(img,49,200,717,418);
  const eight=map(r.mid,790,200,360,160),nine=map(r.last,790,418,360,160);
  label('第八拍　'+foldName(r.flap)+' · '+routeNames(l,r.flap)[r.route],790,391,20);label('第九拍　'+ending.action,790,612,20);
  const a=differentPanes(l,r.source.tape[6],r.mid).length,b=differentPanes(l,r.mid,r.last).length;
  label('第八拍 '+eight+'（'+a+' 响）　→　第九拍 '+nine+'（'+b+' 响）',49,657,20,sans,'#74563e');
  wrap(endingStory(l,r),49,719,1095);
  wrap(tailMargin(l,r.end),49,803,1095);
  if(others.length){
    g.strokeStyle='#b09b72';g.beginPath();g.moveTo(49,850);g.lineTo(1151,850);g.stroke();
    const [title,letter]=jointText(l,view),triple=others.length===2;
    const costs=members.map(e=>page.shortStops[e]+' '+differentPanes(l,r.mid,legs[e]).length);
    const bill='第八拍 '+a+' ＋ '+costs.join(' ＋ ')+' ＝ 合排 '+actualPrice(l,r,legs,view)+' 响';
    label((triple?'三处同笺':'同一拍双落款')+'　·　'+title,triple?49:518,895,27);
    for(const [i,e] of others.entries()){
      const x=49+i*565,y=triple?958:873,w=triple?291:231,h=Math.round(w*7/12);
      const image=await illustration(e);g.drawImage(image,x,y,w,h);
      const exits=map(legs[e],x+w+9,y,triple?222:206,h);
      label(page.endings[e].title+'　'+exits+'　换 '+differentPanes(l,r.mid,legs[e]).length+' 片',x,y+h+27,17,sans);
    }
    wrap(letter,triple?49:518,triple?1204:936,triple?1095:623,21,30);
    label(bill,triple?49:518,triple?932:1038,20,sans,'#74563e');
  }
  return new Promise((resolve,reject)=>paper.toBlob(blob=>blob?resolve(blob):reject(Error('印笺失败')),'image/png'));
}
