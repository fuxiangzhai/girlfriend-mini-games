const scripts=[
  {
    title:'一张回到渡口的签条',paper:'回信签条',
    request:'收信人记得阿婆看不清小字。他把「饭还热着」挤在回执边上，想让原来那盏灯认一遍，也留了背面给另一只船代读。',
    routes:[{
      keeper:1,stops:[['R1','B1'],['R1','B4']],extra:[{}, {B4:[46,77.5,24,0]}],holes:[[17,7],[14,12]],eye:17,
      names:[['燕尾下的一行小字','邮差把热饭捎回去'],['莲叶边缘的铅笔字','阿婆收回自己的印']],
      stories:[['邮差迎着灯举起回执。燕尾下面慢慢透出「饭还热着」。他用指腹抚平一角油渍。','阿婆接过签条，闻到一点葱油味。回水轻轻一推，两条船又分开了。'],['阿婆隔着水看自己的莲叶印。两处透孔连起来，正好读到「今晚加个碗」。','邮差把签条还给她。阿婆数了数船舱里的碗，顺手多拿出一只。']]
    },{
      keeper:0,stops:[['R4','L4'],['R1','L4']],extra:[{}, {L4:[47,77.5,24,0]}],holes:[[17,13],[14,12]],eye:12,
      names:[['渡船背光认燕尾','桥柱后的第二只碗'],['邮差反读一片莲叶','一笔写在落款旁']],
      stories:[['阿婆请邮差把纸翻过来。从灯的另一头看，燕尾旁藏着一个小小的碗。','邮差把签条送还。阿婆把它塞进围裙口袋，说那只碗，她认得。'],['莲叶的细纹从背面显出来。邮差念出最后一行，原来收信人还留了一张靠窗的椅子。','阿婆接回签条，借了邮差的铅笔，在那行小字旁添上一笔「好」。']]
    }]
  },{
    title:'雪线那头的回音',paper:'林场回签',
    request:'林场孩子把铃挂上门楣，托仓鸮带回一枚纸签。风雪洇开了正面的墨，留在纸里的两个小孔还能读。站房和林间各有一种读法。',
    routes:[{
      keeper:0,stops:[['T4','R3'],['R1','R3']],extra:[{}, {R3:[38,26,21,0]}],holes:[[11,13],[14,18]],eye:4,
      names:[['白羽下透出两道光','给站长的一声早安'],['方印里的一道门','小站收到第一声铃']],
      stories:[['仓鸮用爪尖捏住回签。两点亮光顺着羽纹过去，纸上的小门开了一条缝。','站长从窗边接回纸签。山下传来一声铃，有个孩子起得比他还早。'],['站长认出了自己刻歪的方印。两处透孔中间，孩子画了新挂上的门铃。','仓鸮把回签放在车窗沿。站长将它夹在班车时刻表第一页。']]
    },{
      keeper:1,stops:[['L4','B2'],['L4','T1']],extra:[{L4:[46,30.58,14.2,0]}, {T1:[54,30,21,0]}],holes:[[11,15],[14,18]],eye:6,
      names:[['把羽纹翻向山壁','雪停后开的那扇门'],['白翅认得站房印','留下铃签过冬']],
      stories:[['缆车把暖灯移到回签背后。站长从出口倒着读，羽纹尽头是一排新落的脚印。','仓鸮把纸签递进车厢。站长把回程车窗擦出一个圆，正好看见林场的门。'],['方印背面留着一小块空白。仓鸮把回签对准雪地的反光，一根松针从双孔间显出来。','站长把带着松针影子的回签系在车窗边。这个冬天走哪一站，都有人给他摇铃。']]
    }]
  }
];
export const readingNames=['原灯顺读','翻面倒读'];
const inserts=[
  {paper:'饭桌夹页',request:'回信里夹着半张饭桌图。阿婆认得青花碗，却想知道靠窗那双筷子是谁的。把光送过两个针孔，再循折痕拐一下，就能读到藏在桌沿的那行字。',
    routes:[{
      keeper:0,stops:[['R4','T1'],['R1','T1']],extra:[{},{T1:[51.5,77.5,24,0]}],holes:[[7,18],[14,10]],bends:['left','right'],eye:12,
      names:[['沿桌边数到第三只碗','邮船捎来一双筷子'],['给靠窗的人留碗','空椅回到饭桌旁']],
      stories:[['燕尾落在桌角。邮差沿左手的折线读下去，第三只碗比另外两只小一圈，正好给刚会用勺的孩子。','阿婆接回饭桌图，把船头那双短筷包好。今晚得提早收船。'],['阿婆把莲叶印对上桌脚，顺着右折认出靠窗那只碗。碗口的豁儿，和她用了三十年的那只一模一样。','邮差把夹页递回来。阿婆摸到纸边翘起的小椅背，轻轻把它摁平。']]
    },{
      keeper:0,stops:[['R4','B4'],['R1','B4']],extra:[{},{B4:[46,77.5,24,0]}],holes:[[19,7],[18,11]],bends:['left','right'],eye:17,
      names:[['从桌背找那双短筷','桥影里的小手印'],['油渍后面的小方桌','阿婆添上一道菜']],
      stories:[['阿婆把饭桌图贴向夕照，倒着追过一条右折的筷影。靠窗那一格印着孩子蘸酱油的小指头。','邮船靠近。阿婆收回那只纸上的小手，隔着桥洞朝对岸挥了挥。'],['邮差从灯的出口往回寻。折线往左，小桌背面有一块空白，正等阿婆写下自己拿手的菜。','阿婆在邮差递回的空格里画了两颗葱。两条船还没分开，邮差已经猜出了菜名。']]
    }]},
  {paper:'雪路夹页',request:'孩子在铃签里叠了一张雪路图。脚印和松针各占一面。要看出哪条路通向屋里的灯，得让光走到第二孔，再沿纸上的折痕转弯。',
    routes:[{
      keeper:0,stops:[['T4','B4'],['R1','B4']],extra:[{},{B4:[40,33,21,0]}],holes:[[1,13],[4,18]],bends:['left','left'],eye:4,
      names:[['白羽沿雪路向左','第一班车多停一刻'],['脚印绕过矮松','一条给孩子的小路']],
      stories:[['仓鸮顺着羽印往左一折。孩子的脚印绕过结冰的石阶，走到一棵系着红绳的松树下。','站长从车窗接过图，给明早的第一班车多留了一分钟，等那双小靴子。'],['站长从方印读起。左折处的树枝原来是个路标，有人在雪深的岔口踩出了一级台阶。','仓鸮把图递进窗里。站长用铅笔在时刻表旁补上一棵矮松，免得换班的人走错。']]
    },{
      keeper:1,stops:[['R1','B2'],['R1','T4']],extra:[{},{T4:[31,31,21,0]}],holes:[[4,1],[16,19]],bends:['right','left'],eye:3,
      names:[['从屋灯倒寻回程','迎车的那盏灯'],['倒看屋檐下的足迹','窗沿的一线炉火']],
      stories:[['站长借屋里的灯倒看雪路，绕过右折的山口。脚印尽头有根火柴画的小旗，是孩子约他下车喝茶的记号。','仓鸮把图放到站长掌心。车厢刚过弯，他就从雾里认出了那盏迎车的灯。'],['仓鸮从雪地的反光往回认，在左折处看见一排朝屋门去的脚印，屋檐下还有一排朝站房回来的。','站长接过红绳系着的图。回程的最后一小点，是孩子给站房窗沿添上的炉火。']]
    }]}
];
export const paperName=l=>l.play.coda?.insert?l.play.coda.paper:'回签正文';
export const readingLabel=l=>(l.play.coda.insert?l.play.coda.paper+' · ':'')+readingNames[l.play.coda.mode];

const letters={
  postmark:[
    [['窗边的热饭','「饭还热着」底下的铅笔线，恰好接上另一面的椅背。阿婆这才知道，那不是一句客气话，靠窗的位置一直给她留着。'],
     ['碗底的姓','把莲叶下多出来的那只碗和背面的碗影对拢，碗底露出歪歪扭扭的一个「婆」。阿婆端详半天，说这字像她教出来的。']],
    [['一双短筷，两颗小葱','短筷正好指着阿婆画的两颗葱。孩子在纸缝旁蘸了点酱油，替这道还没出锅的菜先尝了一口。'],
     ['谁把椅子拉开了','靠窗的旧碗旁，那枚小手印贴在椅背上。原来椅子不是画歪了，是孩子踮着脚，替阿婆拉开了一点。']]
  ],
  chime:[
    [['山上的第二声铃','羽纹下的小门接上方印背面的松针。一声从林场来，一声从车窗边应。站长隔着两层玻璃又摇了一下。'],
     ['第一班的乘客','把时刻表的第一页翻向脚印，两行恰好在开车前一格碰头。站长给从林场走来的那双小靴子留了窗边的座。']],
    [['两头都有灯','红绳的松树和站房窗上的炉火连成一条回路。孩子肯早起，并不是怕赶不上车，是想先把站长回家的那段路踩平。'],
     ['下车喝杯茶','站长画的矮松和孩子画的小旗，在折口合成一块路牌。他给接班人留下钥匙，把自己的搪瓷杯带上了。']]
  ]
};
export function foldLetter(l){
  const c=l.play.coda,v=l.play.delivery.version;
  return letters[c.baseId][Number(c.insert)][c.mode?1-v:v];
}

// The sixth cue takes the stamp back to its original lamp, or to its
// partner for a reverse reading. Both timings share a physical seven-cue
// score within each reading, while the two readings may need different stops.
export function makeReceiptCasts(relays,firstShow,insert=false){
  const pages=insert?inserts:scripts;
  return relays.map((pair,n)=>pages[n].routes.map((route,mode)=>pair.map((base,v)=>{
    const s=pages[n],p=base.play,signer=p.frames[2].mark.lamp;
    const reader=mode?1-signer:signer;
    const marks=route.holes.map((cells,lamp)=>({kind:'watermark',lamp,reverse:Boolean(mode),cells:mode && !insert?[...cells].reverse():cells,bend:route.bends?.[lamp]}));
    const transfer={kind:'pass',cell:route.eye,action:'递回签'};
    const ports=p.ports.map((row,i)=>[...row,...Object.keys(route.extra[i])]);
    const poses=p.poses.map((row,i)=>[...row,...Object.values(route.extra[i])]);
    const scenes=route.stops.map((exits,i)=>({exits,title:route.names[v][i],story:route.stories[v][i],
      pose:poses[0][ports[0].indexOf(exits[0])],partnerPose:poses[1][ports[1].indexOf(exits[1])]}));
    const frames=[...p.frames,{scenes:[5],keeper:route.keeper,limit:3,mark:marks[reader],peerMark:marks[1-reader]},
      {scenes:[6],keeper:1-route.keeper,limit:3,mark:transfer,peerMark:transfer}];
    const coda={mode,reader,insert,paper:s.paper,baseId:p.id,holes:marks[reader].cells};
    const suffix=insert?'-insert':'';
    return {...base,id:base.id+'-receipt-'+mode+suffix,showIndex:firstShow+n,title:scripts[n].title,request:s.request,
      projection:{...base.projection,scenes:[...base.projection.scenes,...scenes],cue:base.projection.cue+' 第六拍验回签，顺读沿原灯从入口追光，倒读沿搭档的灯从出口往回看。'+(insert?'夹页要在第二孔按读纸方向左折或右折。':'')+'第七拍让两束光交叉，把回签递还给出发时的主人。'},
      play:{...p,id:p.id+'-receipt'+suffix,artId:p.id,ports,poses,frames,coda,note:route.stories[v][1]}};
  })));
}
