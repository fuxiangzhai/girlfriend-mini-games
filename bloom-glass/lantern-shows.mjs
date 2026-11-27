import {makeLevel} from './levels.mjs';

const program=[
  {title:'燕子先入场',map:['AAB','CCB'],cuts:'010',sample:'C',mirrors:['A0u'],entries:['L1'],
    request:'外公把白床单借给我们，又递来两枚红衣夹。「先试只燕子。尾巴分了叉，我坐远也认得。」',
    cue:'沿西一入光的那一行往右看。要从北二出窗，光得在第二列遇上一面朝右上斜的银镜。',
    scenes:[{id:'swallow',title:'晾衣绳上的燕子',exits:['T2'],alt:'燕子掠过巷院里的晾衣绳，两枚红衣夹夹着白布。',
      story:'燕子飞上床单时，一个孩子伸手去接。影子在他掌心里停了一刻，外公才松开压着开关的手。'}]},
  {title:'木马借一圈风',map:['AAB','ACB','CCB'],cuts:'213',mirrors:['A2d','B1u'],star:'C1',starLamp:0,entries:['L2'],
    request:'木马背上的油漆掉了一小块。外公往空处刻了颗星，说灯照过去，它就又有一颗扣子了。',
    cue:'从东三沿第三行倒着找，再从西二顺着找。两面银镜之间要留一条能直走的路。',
    scenes:[{id:'carousel',title:'木马又转了一圈',exits:['R3'],alt:'一匹古旧的彩绘旋转木马在暖色灯影里扬起前蹄。',
      story:'修鞋师傅听见孩子们替木马配的铃声，把一直搁在膝上的旧皮包放下，也跟着拍起了手。',
      secret:'外公用指尖在幕上点了点。木马胸带空着的地方，多了一颗亮扣子。'}]},
  {title:'池塘借了两盏灯',map:['AABB','ACCB','DDCC'],cuts:'1321',mirrors:['A1d','C2u','B0d'],star:'D1',starLamp:0,entries:['T3','L3'],
    request:'一尾金鱼从荷叶下游出，另一尾青鱼得朝相反的岸去。邻家的妹妹坚持，两条都要有路回水里。',
    cue:'先顾好一条鱼，再单看另一束光。两盏灯共用窗片，转过其中一面银镜，也会改变另一条路。',
    scenes:[{id:'koi',title:'荷叶下换一个方向',exits:['B2','R1'],alt:'金色与青色锦鲤在荷叶下交错游过，水面映着碎光。',
      story:'两条鱼各自游到岸边。妹妹把板凳挪过来，小声说，下回可以把她那只缺了口的鱼缸也画进去。',
      secret:'金鱼经过时，缺口边泛出一小圈亮纹。妹妹认出来了，那就是她家的鱼缸。'}]},
  {title:'把月亮挂回梨树',map:['AABB','ACCB','DDCE','DEEE'],cuts:'12032',mirrors:['A0u','B1d','C0u','E2d'],star:'D1',starLamp:1,entries:['T1','L2'],cross:14,
    request:'梨花画在一张片上，月亮画在另一张。外公在镜框上刻了合像圈。「两束光在这里横竖相交，月亮就挂回枝头了。」',
    cue:'从南三往回数，第一格就是 C4。给一束光留出穿过圈心的直路，再从左右给另一束找路。',
    scenes:[{id:'orchard',title:'梨花留住月亮',exits:['B3','R4'],alt:'梨花满枝，月光透过院墙和树梢，花瓣落在暗蓝夜色中。',
      story:'花和月亮终于叠在一处。外公抬了抬手，像是想把伸到墙外的那根枝子轻轻拉回来。',
      secret:'青光穿过枝梢的星刻，外公忽然说，小时候他在这棵树上挂过一只搪瓷杯。'}]},
  {title:'纸船有两张船票',map:['AABC','ABBC','DDCC','DEEE'],cuts:'23410',clues:'D0',mirrors:['A0d','B1u','C2d','E0u'],star:'D1',starLamp:0,entries:['B2','R3'],
    request:'床单前分成了两派。一边想看小船出海，一边说桥头的孩子还在等。外公把两张船票都塞给了我。',
    cue:'两种散场都让琥珀灯向北、青瓷灯向东。先决定要去的那一列，再从相应的东边出口倒推另一束。',
    scenes:[{id:'sea',title:'让纸船出海',exits:['T3','R2'],alt:'红帆纸船迎着浪花驶向夕阳，船头的蓝缎带在风里飘动。',
      story:'纸船越过最后一层浪。第一排的孩子用力挥手，直到幕角那一点红也看不见了，才肯坐回去。',
      secret:'船底折痕里亮起一粒窗灯大的星。有人说，那是船给岸上回的第一封信。'},
      {id:'home',title:'把纸船送回家',exits:['T1','R4'],alt:'红帆纸船靠回灯下的小码头，捧着信的孩子俯身看它。',
      story:'船靠上旧木阶，孩子蹲下来，仔细把两边湿了的船舷重新折挺。身后的人悄悄收回了捞网。',
      secret:'星光照透折纸，孩子念出了藏在船腹里的两个字：「到家」。'}]},
  {title:'谢幕，把灯交给谁',map:['AABBC','ADBBC','ADDCC','EEEFF'],cuts:'341205',clues:'E1 B1',mirrors:['A1u','B0d','C2d','D1u','F1d'],star:'E1',starLamp:1,entries:['L3','B3'],cross:12,
    request:'还剩最后一张片。你可以照向床单，把谢幕留给观众，也可以把两盏灯转回棚里，让大家看看一直举着片子的人。',
    cue:'从两个入口顺推，先让两束光在 C3 一横一竖穿过。然后看圈外的镜子，决定两束都向北，还是都向东。',
    scenes:[{id:'screen',title:'幕前的双燕',exits:['T3','T1'],alt:'两只燕影在巷院的白床单上共舞，观众坐在小凳上抬头看。',
      story:'幕上多出第二只燕子，它追上开场的那只。两个孩子举着手在幕前学，直到整条晾衣绳上都是翅膀。',
      secret:'青光照到幕角，映出两枚衣夹的影子。外公留一枚给我，说明晚还得用。'},
      {id:'booth',title:'幕后那双手',exits:['R1','R2'],alt:'暖光的放映棚里，一老一少两双手在镜头前交接手绘玻璃片。',
      story:'灯光转回棚里。外公的手还扶着玻璃，我的手已经接住下沿。观众等我们把片子放稳，才开始鼓掌。',
      secret:'青光掠过玻璃的边，照出两道深浅不同的指印。外公没让我擦。'}]},
];

export const shows=program.map((plan,i)=>{
  const level=makeLevel(plan,-2,'lantern-'+(i+1),i===0?0:2);
  level.showIndex=i;
  level.projection={entries:plan.entries,scenes:plan.scenes,starLamp:plan.starLamp,cross:plan.cross,cue:plan.cue};
  return level;
});
