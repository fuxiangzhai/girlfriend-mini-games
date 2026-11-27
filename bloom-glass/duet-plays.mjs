import {makeLevel} from './levels.mjs';
import {slipPlays} from './slip-plays.mjs';
import {makeRelayCasts} from './duet-relays.mjs';
import {makeReceiptCasts} from './receipt-plays.mjs';
import {versionOf} from './duet-marks.mjs';

// The two glasses have independent stops. A lamp's exit selects its actor's
// stop, so holding that lamp also holds the actor still throughout the cue.
const scripts=[
  {id:'ferry',title:'两只船的一封信',names:['邮船','渡船'],limit:2,
    backdrop:'清早的水乡邮埠，远岸的石阶前亮着一盏小灯',
    request:'邮船捎来一封没有门牌的信，信封上只写着「给总在桥边等我的人」。渡船上的阿婆认出了笔迹。谁先摇出第一桨？',
    tip:'两艘船各有一盏灯。开场落片前先探后场，看哪艘船能从这套镜位先开。想轻轻靠岸，每次落片前数一数换过几片。',
    notes:['邮差先把信举高。阿婆没有拆，她认得寄信人写自己名字时，最后一笔总要抖一下。','阿婆先把船靠过来，把一只搪瓷杯递给邮差。杯底压着她写了好久的回信。'],
    map:['AABBC','AADBC','FDDCC','FFEEE'],cuts:'314250',mirrors:['A0d','B1u','C1d','D1u','F1d'],clues:'B0 E1',
    entries:['T2','R3'],ports:[['L1','R2'],['B4','R1']],
    poses:[[[18,67.75,25,0],[51,67.75,25,0]],[[85,77.5,24,0],[64,77.5,24,0]]],
    beats:[
      {at:[0,0],title:'隔着水面认笔迹',story:'天刚泛白，两个船头还隔着半条河。邮差拿信封的手在风里抖，阿婆眯起眼睛。'},
      {at:[1,0],title:'邮船先摇一桨',story:'朱棚的小邮船先离了岸。邮差把信举过头顶，渡船上的阿婆放下了手里的碗。'},
      {at:[0,1],title:'渡船先解开缆绳',story:'阿婆先解缆绳，青色船篷掠过水纹。邮差留在埠头等她，怕两条船一齐动会错过去。'},
      {at:[1,1],title:'两只船头一封信',story:'船头终于挨近。阿婆伸手接信，邮差才看清楚，信封上的名字就是渡船船尾那两个字。'}
    ]},
  {id:'ridge',title:'末班缆车与仓鸮',names:['缆车','仓鸮'],limit:3,
    backdrop:'暮紫的山脊、山站的轨索和林中一扇亮着灯的窗',
    request:'山站修好了一只旧铃。今晚缆车下山，林子里的仓鸮也要回巢。站长把铃用布裹住，请你给它们排一场安静的收班戏。',
    tip:'会合之后，缆车还要独走最后一程。眼前少换一片，可能让末段多换两片。「探后场」会算进还没演的几拍。',
    notes:['车先走，风把车窗里的铃绳吹到外面。仓鸮在它旁边飞了一段。一路到站，旧铃都没有响。','鸟先走，站长看见那张白脸掠过窗才松手。小木屋熄了灯，守夜的人终于能睡了。'],
    map:['AABBC','ABBCC','DDCCE','DFFFE'],cuts:'145023',mirrors:['A0u','B0u','C1d','D1d','E0u','F1d'],clues:'B1 C0',
    entries:['T3','L1'],ports:[['L2','B1','B2'],['T1','T2']],
    wire:[20,43],anchor:[.497,.0428],arc:3.5,
    poses:[[[20,24.6,14.2,0],[52,31.96,14.2,0],[78,37.94,14.2,0]],[[80,17,21,0],[56,20,21,0]]],
    beats:[
      {at:[0,0],title:'山站挂起末班牌',story:'站长把小铃挂回车厢。林子那头，仓鸮的白脸从暮色里探了出来。'},
      {at:[1,0],title:'红车厢先离站',story:'缆车从站台滑出，车窗里有一方晃动的暖光。仓鸮收着翅尖，先让它过去。'},
      {at:[0,1],title:'白翅先过松梢',story:'仓鸮展开翅膀，把一段山风领到了松梢上。站长在车厢里数着，等它飞过第二棵树。'},
      {at:[1,1],title:'在半山相互望见',story:'白色的脸和车窗里的人影并排了一瞬。站长抬手打了个招呼，压低了铃绳。'},
      {at:[2,1],title:'把一盏暖窗送到站',story:'仓鸮留在林边，红车厢滑向下站。小木屋的窗开了一线，有人一直等着最后一盏灯回家。'}
    ]}
];

export const duetCasts=scripts.map((script,index)=>{
  const base=makeLevel(script,-3,'slip-'+script.id,2),showIndex=slipPlays.length+index;
  if(script.id==='ferry')base.sample=[null,null,null,null,{x:2,y:3,o:1},{x:0,y:2,o:1}];
  const scenes=script.beats.map(({at,title,story})=>({
    title,story,exits:at.map((stop,i)=>script.ports[i][stop]),pose:script.poses[0][at[0]],partnerPose:script.poses[1][at[1]]
  }));
  const projection={entries:script.entries,scenes,cue:script.tip};
  return [0,1].map(first=>{
    const frames=[{scenes:[0]},{scenes:[1+first],keeper:1-first,limit:script.limit},{scenes:[3],keeper:first,limit:script.limit}];
    if(scenes.length===5)frames.push({scenes:[4],keeper:1,limit:script.limit});
    return {...base,id:base.id+'-'+first,showIndex,projection,play:{
      id:script.id,actor:script.names[0],backdrop:script.backdrop,frames,first,names:script.names,
      ports:script.ports,poses:script.poses,wire:script.wire,anchor:script.anchor,arc:script.arc,note:script.notes[first]
    }};
  });
});

export const relayCasts=makeRelayCasts(slipPlays.length+duetCasts.length);
const casts=[...duetCasts,...relayCasts];
const receiptStart=slipPlays.length+casts.length;
export const receiptCasts=makeReceiptCasts(relayCasts,receiptStart);
export const programmes=[...slipPlays,...casts.map(cast=>cast[0]),...receiptCasts.map(family=>family[0][0])];
export const allDuets=[...casts.flat(),...receiptCasts.flat(2)];
export function receiptFor(l,mode=0,v=versionOf(l)){
  const n=l.play.coda?l.showIndex-receiptStart:relayCasts.findIndex(pair=>pair.includes(l));
  return receiptCasts[n]?.[mode]?.[v];
}
export const fiveAct=l=>relayCasts[l.showIndex-receiptStart][versionOf(l)];
export const partnerOrder=level=>level.play.coda?receiptFor(level,level.play.coda.mode,1-versionOf(level)):casts[level.showIndex-slipPlays.length][1-versionOf(level)];
export const isDuet=level=>level?.play?.first!=null;
export function orderName(level){
  const d=level.play.delivery;
  return d?d.stops[d.version]+d.verb:level.play.names[level.play.first]+'先动';
}
