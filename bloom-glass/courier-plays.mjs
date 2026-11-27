import {lampNames} from './light-path.mjs';
import {tailPage} from './tail-plays.mjs';

export const wayNames={direct:'沿灯直递',fold:'回折捎话'};
export const paceNames={quiet:'整趟省响',first:'首站少动',last:'末站少动',pass:'直递少动'};
const pages={
  postmark:{
    layer:'basket',intro:'阿婆把饭篮提到灯下。桥下、饭桌和夜学都要到，最后一个接篮的人负责把它送回家。',
    first:['摆渡人腾出船头，先用自己的袖口擦干放碗的地方。','孩子听见提篮的竹响，把凳子转向河边。','教员把窗推开一半，怕风吹跑还没干的习字纸。'],
    back:['摆渡人把话夹在篮盖下，说青边那只碗明早随船还。','孩子往折里塞进一双短筷，托人交给下一桌手最小的客人。','老船工把写得最端正的一张叠好，请阿婆沿旧折捎回去。'],
    direct:{'02':'摆渡人端着还冒气的饭，借同一盏灯认出了夜学窗下的石阶。','20':'船工刚在窗边写好的收条连墨都没干，就在灯下交到了摆渡人手里。'},
    stops:{
      '012':['最后一课是写家书','摆渡人说今夜还要跑一班，孩子便在桌边替他留饭。饭篮到夜学时，教员让老船工自己写那张留饭条。他把「等我」二字写了两遍，挑了好看的一张夹进篮底。'],
      '021':['一张添出来的席签','桥下先收了热饭，窗里的船工便空出手来写名字。孩子在饭桌边接过纸条，照着那两个字添了一张席签。最晚靠岸的人提着空碗回来，一眼就找到了自己的座。'],
      '102':['那只碗有了名字','从饭桌出发时，孩子在篮盖上画了一只豁口碗。摆渡人认出它是自己年轻时送给阿婆的。消息到了夜学，船工问教员怎么写「还」，低头在纸上写下了碗主人的全名。'],
      '120':['末渡收下点名簿','孩子从饭桌上数了三只碗，夜学却有四个人。教员撕下一页点名纸，把漏掉的那个名字交给了船头。末渡临开前，摆渡人朝岸上多等了一声应答。'],
      '201':['碗边的一圈墨','教员在夜学给饭篮系了张空签。摆渡人用沾过墨的手扶了一把，签上留了半圈指印。孩子在饭桌上顺着它画成一只碗，给阿婆看谁已经吃过了。'],
      '210':['明早来取两只碗','夜学送出最后一页习字，饭桌上添了两块藕夹。摆渡人压低船灯，看清纸上写着「明早见」。他把一只碗扣在另一只上头，特意留了个给晨风透气的小缝。']
    },
    endings:{
      direct:['收篮时，摆渡人还能摸到上一个人手心捂热的那一截竹篾。','孩子沿着方才直递的灯光望出去，隔窗朝递篮的人举了一下筷子。','下课铃响以前，教员已经用那盏接过来的灯，照着船工写完了落款。'],
      afterReturn:['摆渡人翻开篮盖，借船灯读完折里最后捎来的一句话，把船留在岸边多等了一会儿。','孩子掀开篮盖，在折里摸到一张纸。纸背压着一道碗沿印，他便照着印子把最后一只碗摆好。','教员从折口取出上一站夹的东西，先放到讲台上，让最后一排的人也看一眼。'],
      fold:['摆渡人从篮底翻出前两处留的话，把纸条夹进明早的第一叠船票。','阿婆在桌上摊开两次折回带来的便条，挑了一个干净的碗，把它们一并扣在下面。','教员打开两道折口，让学生把捎来的两句话念完，才合上课本。']
    }
  },
  chime:{
    layer:'cord',intro:'站长从门钩上解下红铃绳。站房、松径和望哨各打一个结，最后一处要听见前两处的消息。',
    first:['站长把第一只搪瓷杯翻过来，杯底干干净净。','孩子在最矮的松枝上找到去年留下的绳圈。','守林人解开哨窗的搭扣，把冻硬的红绳放在掌心里焐。'],
    back:['站长在折口记下一行开车时刻，托人带给山上。','孩子把一小截松针夹进纸背，给下一班人认路。','守林人把平安信捻成细卷，沿铃绳的老折送了回来。'],
    direct:{'02':'站房的灯一下照到望哨，守林人举起茶杯，杯沿闪了一下算应答。','20':'望哨松开铃绳，站长守着那道灯光，一声不落地听到了最后。','12':'松枝上的灯朝高处一偏，守林人已经伸手接到了绳头。','21':'守林人从哨窗放下铃绳，孩子站在松径的灯圈里，稳稳接住。'},
    stops:{
      '012':['高窗里多了一把椅子','站房的茶还在炉上，松径上的孩子替巡线人认出了最后一级雪阶。到望哨时，守林人已经搬出一把矮椅。往年孩子只能从山下看这扇窗，今夜他第一次坐在窗里看灯。'],
      '021':['拐角那盏灯低了一掌','站长把一张旧车票夹上绳头。守林人在望哨看过，记起最矮的乘客才够到窗沿。孩子在松径收绳时，把灯放低一掌，刚好照到那张票上印着的小站。'],
      '102':['迟到的第四声','松径先响了一声，站长在站房替它续了两下。守林人在望哨听罢，又单独补了一声。那是给还在坡上的人留的，不必赶铃，沿亮着的路慢慢走就好。'],
      '120':['开车前先喝口茶','孩子先替林缘打好结，守林人从望哨一路数到站房。炉膛里的火还红着，站长把表扣在桌面上。末班车可以等他们坐稳，喝完这口热茶再开。'],
      '201':['雪下埋着去年的结','高窗传来今年第一声平安，站长在站房取出一截褪色红线。孩子到松径扫开积雪，发现去年的绳结还在那里。他把新线搭在旧结旁边，让两年的灯照着同一个转弯。'],
      '210':['交给第一班车的人','守林人在望哨松开铃，孩子在松径将绳头打好。天亮时，站长在站房把它交给第一班车的司机。司机轻拉一下，积雪从檐上落下来，昨夜那三处灯都看得清了。']
    },
    endings:{
      direct:['站长把一直亮着的那盏灯挂到门边，头一个进站的人伸手便摸得到绳结。','两处之间的那盏灯还举着，孩子借光在木牌上补画了通往来路的一支箭。','守林人没有放下接来的灯，等山下再亮一次，才把窗合拢。'],
      afterReturn:['站长把末程捎到的消息压在杯底，先去门外摇一声铃，让送信的人听见回音。','孩子拆开折口，把末程捎的话念给身后的巡线人听。两个人把铃绳重新系回低枝。','守林人认出折口上的旧绳印，沿着它摸到了末程捎来的消息，才敢把炉火添旺。'],
      fold:['站长把两道折里各捎回来的一句话，都抄进了明早的行车簿。','孩子拆开两道折口，把带回的消息藏进松枝下那只防雪的小木匣。','守林人把两次折回捎来的记号画在窗框边，说明山下两处都平安。']
    }
  }
};
export const courierPage=l=>pages[l.play.coda.baseId];
export const orderName=(l,order)=>Array.from(order,e=>tailPage(l).shortStops[+e]).join(' → ');
export const courierEnding=(l,w)=>{
  const page=courierPage(l),[title,story]=page.stops[w.order];
  const arrival=w.way==='direct' && w.steps?.at(-1)?.kind==='out'?'afterReturn':w.way;
  return {title,story,after:page.endings[arrival][+w.order[2]]};
};
export function cueName(l,step){
  const place=tailPage(l).shortStops[step.end];
  if(step.kind==='mid')return '留住第八拍';
  if(step.kind==='back')return place+'折回原镜位';
  return (step.kind==='direct'?'直递':step.kind==='first'?'首送':'从折口去')+place;
}
export function stepNote(l,w,steps){
  if(!steps.length)return '先安好能走到三处的第八拍。后面折回时，连玻璃的钉位也要一一对上。';
  if(steps.at(-1).kind==='mid')return '共同的镜位已经留下。第一站要去'+tailPage(l).shortStops[+w.order[0]]+'，收场时还得给后一站留路。';
  const page=courierPage(l),step=steps.at(-1);
  if(step.kind==='back')return page.back[step.end];
  if(step.kind==='direct'){
    const prev=steps.at(-2).end;
    return (page.direct[''+prev+step.end] || '两处接住了同一盏灯。')+'这一程守的是'+lampNames[step.keeper]+'。';
  }
  if(step.kind==='first')return page.first[step.end];
  return tailPage(l).shortStops[step.end]+'收到了从折口带来的话。'+page.first[step.end];
}
export function handoffNotes(l,steps){
  const places=tailPage(l).shortStops,page=courierPage(l),notes=[];
  for(const [i,s] of steps.entries()){
    if(s.kind==='back')notes.push({label:'回折 · '+places[s.end]+' → '+places[steps[i+1].end],text:page.back[s.end]});
    if(s.kind==='direct'){
      const prev=steps[i-1].end;
      notes.push({label:'守'+lampNames[s.keeper]+' · '+places[prev]+' → '+places[s.end],text:page.direct[''+prev+s.end]});
    }
  }
  return notes;
}
