import {makeLevel} from './levels.mjs';

// actor poses use center coordinates and width as percentages of the painted slide.
const plays=[
  {id:'kite',title:'桥头放纸燕',actor:'纸燕',backdrop:'晚霞下的石桥与临河屋顶',entries:['T1','T2'],
    map:['AAB','CCB','DDB'],cuts:'1203',mirrors:['A0u','B1d','C0d'],clues:'B1',
    request:'孩子踮着脚，把纸燕托过桥栏。外公留一盏灯照住他的手，把另一张玻璃推给你。',
    tip:'开场先看琥珀光压住哪些玻璃。第二拍它仍要照着桥栏，纸燕只能借另一片玻璃起飞。',
    frames:[{scenes:[0]},{scenes:[1],keeper:0,limit:1}],
    scenes:[{title:'风刚到桥栏',exits:['L3','R1'],pose:[26,54,25,-14],story:'蓝飘带垂着。桥上的孩子把手往上托了托，等风先拉一下他的袖口。'},
      {title:'纸燕越过桥脊',exits:['L3','L1'],pose:[73,24,20,-4],story:'衣袖突然轻了。纸燕越过桥脊，孩子还张着手，好像能再接住一次起飞。'}]},
  {id:'tram',title:'电车替谁等一等',actor:'绿电车',backdrop:'暮蓝色的老街与亮灯的路边候车亭',entries:['T1','T2'],
    map:['AABB','ACCB','DDCE'],cuts:'30142',mirrors:['A1d','B0u','D1d','E0u'],clues:'C0',
    request:'站牌下有人举着一把合拢的伞。司机已经看见她了，换景时请留青瓷灯照着站牌。',
    tip:'进站要真的挪动两块玻璃。先认清青瓷光经过哪几片，剩下两片可以一起拿回托盘，再交换位置。',
    frames:[{scenes:[0]},{scenes:[1],keeper:1,limit:2}],
    scenes:[{title:'拐过街角',exits:['B4','L1'],pose:[23,67.3,29.5,0],story:'第一声铃响在街拐角。卖面的人抬起锅盖，热气里露出两扇黄澄澄的车窗。'},
      {title:'为一把伞停靠',exits:['L3','L1'],pose:[71,67.3,29.5,0],story:'电车在举伞的人面前停住。她先把伞递上车，回头搀住那个走得慢一点的人。'}]},
  {id:'lotus',title:'荷灯捎过三道湾',actor:'荷灯',backdrop:'月下的河湾、石埠与柳树的倒影',entries:['R3','L3'],
    map:['AABB','ACCB','DDCE','DEEE'],cuts:'12530',mirrors:['A0u','B1d','C0u','E2d'],clues:'E2',
    request:'第一道湾照着放灯的手，第二道湾换另一岸的人接灯。哪一盏该留下，要提前一拍想好。',
    tip:'第二拍是交灯处。琥珀灯先守住原岸，到第三拍改由青瓷灯守弯口。用「探后场」看看手里的第二拍能否把灯接下去。',
    frames:[{scenes:[0]},{scenes:[1],keeper:0,limit:2},{scenes:[2],keeper:1,limit:2}],
    scenes:[{title:'从柳根松手',exits:['T4','B4'],pose:[25,73,17,-4],story:'卖花的阿姨把蜡烛捻直，连纸瓣上的水珠也一并交给了河。'},
      {title:'转过回水湾',exits:['T4','B2'],pose:[50,66,14,3],story:'河心的水打了个旋。对岸的人举起第二盏灯，从这一刻起，认路的事归他。'},
      {title:'靠上青石埠',exits:['B1','B2'],pose:[78,57,16,-2],story:'荷灯轻轻撞了一下青石阶。等灯的人读完纸瓣上的字，又把灯推回水里，让下游也亮一会儿。'}]},
  {id:'whale',title:'阁楼窗外有鲸',actor:'云鲸',backdrop:'黎明前的巷子、一线天光与亮着的阁楼窗',entries:['T2','B1'],
    map:['AABBC','ADBBC','ADDCC','EEEFF'],cuts:'321405',mirrors:['A1u','B0d','C2d','D1u','F1d'],clues:'E1 B1',
    request:'阁楼上的小朋友今年还没去过海边。外公在活动片上画了一条鲸，问我，是让它停在她窗前，还是领她看天亮。',
    tip:'两个结尾共用一个中场出口，却不一定能从同一套中场镜位抵达。排演时先选想看的结尾，留意下一盏守灯压住了哪几片。',
    frames:[{scenes:[0]},{scenes:[1],keeper:0,limit:2},{scenes:[2,3],keeper:1,limit:3}],
    scenes:[{title:'云里露出尾鳍',exits:['L2','R3'],pose:[21,32,25,-8],story:'孩子用指节在窗上敲了两下。巷顶的一小片云也动了动，露出一截鲸尾巴。'},
      {title:'游过一排烟囱',exits:['L2','L3'],pose:[50,37,33,4],story:'云鲸游到烟囱上方。她把脸贴近玻璃，呼出的一点雾气，刚好画成了海。'},
      {title:'停在她的窗前',exits:['R4','L3'],pose:[66,54,27,7],story:'鲸把影子停在阁楼窗前。她不敢大声叫，只用手指在玻璃上写了一个小小的「嗨」。'},
      {title:'陪她游向天明',exits:['L4','L3'],pose:[84,19,20,-13],story:'云鲸一抬头，天就亮了一线。她把窗扇推开，说这下不用趴在玻璃上，也能看见海了。'}]},
];

export const slipPlays=plays.map((p,index)=>{
  const level=makeLevel(p,-3,'slip-'+p.id,2);
  level.showIndex=index;
  level.projection={entries:p.entries,scenes:p.scenes,cue:p.tip};
  level.play={id:p.id,actor:p.actor,backdrop:p.backdrop,frames:p.frames};
  if(index===0) level.sample=[null,{x:2,y:1,o:0},null,{x:0,y:1,o:0}];
  return level;
});
