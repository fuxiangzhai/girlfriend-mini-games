import {makeLevel} from './levels.mjs';

const plays=[
  {
    id:'postmark',castId:'ferry',title:'桥洞下的回信',names:['邮船','渡船'],first:0,giver:1,
    prop:'回信',verb:'递信',stops:['石桥','邮亭'],seals:['燕尾邮戳','莲叶渡印'],
    map:['AABBC','ABBCC','DDCCE','DFFFE'],cuts:'145023',mirrors:['A0u','B0u','C1d','D1d','E0u','F1d'],clues:'B1 C0',
    sample:[null,{x:2,y:1,o:6},null,null,null,{x:1,y:3,o:1}],
    entries:['B3','R3'],exits:['B4 T5','R1 T5','R1 L1','R4 L1','R4 B1'],eyes:[12,13],ink:[2,0],
    poses:[[[14,67.75,25,0],[35,67.75,25,0],[70,67.75,25,0]],[[49,77.5,24,0],[79,77.5,24,0],[87.5,77.5,24,0]]],
    grips:[[5,-4],[-5,-4]],propWidth:7,
    backdrop:'秋日的水乡，石桥倒映在河面，亮着灯的邮亭等在下游',
    request:'阿婆写了一封回信，只差一枚印。邮船会经过石桥和邮亭。她肯在桥洞交信，也想再留它一站，把渡口的莲叶印亲手盖在上头。',
    titles:[['阿婆推开青篷','桥洞下伸出一只手','船头盖下燕尾戳','邮亭有人等信','朱棚里的一盏灯'],['阿婆推开青篷','让信多坐一站船','渡口借来一片莲叶','邮亭灯下递回信','朱棚里的一盏灯']],
    stories:[[
      '阿婆把一页薄纸折成四折。一角露着「吃过饭了」四个字，她拿蓝叶贴纸轻轻压住。',
      '两盏灯在桥洞交成十字。邮差俯下身，信离开青色船篷，到了朱棚的窗边。',
      '邮差把那枚缺了半边翅膀的燕尾戳蘸上墨。纸一揭，两只燕子倒像是挨在了一起。',
      '邮差经过邮亭时没有停。阿婆从后面招了招手，她知道这封信今晚就能到。',
      '收信的人先摸到那半边燕尾。窗里的灯亮了，有人给炉子添上一瓢水。'
    ],[
      '阿婆把一页薄纸折成四折。一角露着「吃过饭了」四个字，她拿蓝叶贴纸轻轻压住。',
      '桥洞里的手伸过来，阿婆却拍了拍自己的衣袋。邮差会意，让船先过了桥。',
      '渡船摇到莲叶下。阿婆压下旧渡印，信封上多了一道熟悉的叶脉。',
      '邮亭的灯映在两条船之间。这一回阿婆先伸手，把带着渡口气味的信交给了邮差。',
      '信封背面的叶脉很浅。收信人沿着它摸了一圈，像重新走过回家的小路。'
    ]],
    notes:['邮差在存根上画了一只完整的小燕子，另一半翅膀留给下一封信。','阿婆把洗净的旧印搁回青篷。渡口还有一个人，等着她写下次的水位。']
  },{
    id:'chime',castId:'ridge',title:'把铃声送过雪线',names:['缆车','仓鸮'],first:1,giver:0,
    prop:'铜铃',verb:'递铃',stops:['雪松','小站'],seals:['站房方印','松羽林印'],
    map:['AABBC','ABBCC','DDCCE','DFFFE'],cuts:'524130',mirrors:['A1d','B0d','C2u','D0u','E1u','F0d'],clues:'B1 C0',
    sample:[null,null,{x:3,y:1,o:3},null,{x:0,y:2,o:0},null],
    entries:['T2','T5'],exits:['R1 L2','R1 R4','B3 R4','B3 B2','T4 B2'],eyes:[4,17],ink:[9,0],
    wire:[20,43],anchor:[.497,.0428],arc:3.5,
    poses:[[[28,26.44,14.2,0],[62,34.26,14.2,0],[83,39.09,14.2,0]],[[81,19,21,0],[37,28,21,0],[71,35,21,0]]],
    grips:[[6,14],[0,7]],propWidth:6.6,
    backdrop:'晨雪照亮了杉林和远山，缆索横过山腰尽头的小站',
    request:'山站要把修好的第一只铃送回林场。站长在铃绳上系了张空签。你可以让仓鸮在雪松接走它，也可以让铜铃随车到小站，再交给那双白翅。',
    titles:[['晨车解下旧铜铃','雪松伸来白翅','松羽落在铃签上','守站人拉开木窗','第一声回到山里'],['晨车解下旧铜铃','把铃留在车窗边','站房印压过雪线','小站窗外交铃','第一声回到山里']],
    stories:[[
      '第一班车还没开，站长把旧铜铃从墙上解下来。铃绳上绑着一张干净的纸签。',
      '仓鸮在雪松梢收起半边翅膀。站长松开绳结，小铃晃到了鸟爪下面。',
      '仓鸮掠过刻印的松枝，一枚细长的羽印留在铃签上。林中有人抬起头。',
      '小站的木窗吱呀一声打开。守站人只看见车窗里站长空着的双手，又听见头顶很轻的一响。',
      '第一声铃从高处落下来。林场的孩子循着声音，在雪上留下一排小脚印。'
    ],[
      '第一班车还没开，站长把旧铜铃从墙上解下来。铃绳上绑着一张干净的纸签。',
      '白翅从第一棵松树旁掠过。站长让铃再坐一程，戴上手套，把纸签抚平。',
      '小小的站房印上刻着建站那年。站长按下方印，老铃终于有了一张自己的车票。',
      '缆车停在木窗边，仓鸮跟到站台。站长把铃绳递过去，鸟爪轻轻一握。',
      '林场的孩子收到小铃，把纸签挂在木屋门后。门每开一次，雪山就回他们一声。'
    ]],
    notes:['守林人捡到一根白羽毛，和那枚羽印正好差不多长。','站长在册子上写下「已到」。他把笔夹在门边，留给明早的第一班车。']
  }
];

// The cast visits exactly the same five stops in both editions. The physical
// handoff and the carrier's stamp, rather than different exits, branch the play.
export const makeRelayCasts=firstShow=>plays.map((s,n)=>{
  const base=makeLevel(s,-3,'slip-'+s.id,2);
  const exits=s.exits.map(row=>row.split(' ')),ports=[0,1].map(j=>[...new Set(exits.map(row=>row[j]))]);
  const marks=[
    [null,{kind:'pass',cell:s.eyes[0]},{kind:'stamp',cell:s.ink[0],lamp:1-s.giver},null,null],
    [null,{kind:'wait',cell:s.eyes[0]},{kind:'stamp',cell:s.ink[1],lamp:s.giver},{kind:'pass',cell:s.eyes[1]},null]
  ];
  return [0,1].map(version=>{
    const scenes=exits.map((row,i)=>({exits:row,title:s.titles[version][i],story:s.stories[version][i],
      pose:s.poses[0][ports[0].indexOf(row[0])],partnerPose:s.poses[1][ports[1].indexOf(row[1])]}));
    const frames=scenes.map((_,i)=>({scenes:[i],...(i?{keeper:i%2?1-s.first:s.first,limit:3}:{}),mark:marks[version][i],peerMark:marks[1-version][i]}));
    const delivery={version,giver:s.giver,pass:version?3:1,prop:s.prop,verb:s.verb,stops:s.stops,seals:s.seals,grips:s.grips,width:s.propWidth};
    return {...base,sample:s.sample,id:base.id+'-'+version,showIndex:firstShow+n,
      projection:{entries:s.entries,scenes,cue:'第二拍落片前可改交接站。递物时让两束光在交接眼一横一竖直穿。第三拍只让持物角色的灯照到自己的印位。'},
      play:{id:s.id,castId:s.castId,actor:s.names[0],names:s.names,first:s.first,backdrop:s.backdrop,frames,ports,poses:s.poses,
        wire:s.wire,anchor:s.anchor,arc:s.arc,note:s.notes[version],delivery}};
  });
});
