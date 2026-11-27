const pages={
  postmark:{
    turns:[['R4','B4'],['R4','T1']],routes:['邮船照桥洞','渡船贴水走'],
    passages:[
      '邮差把灯从篷下摘下来，照见桥栏上扣着一只空碗。碗底有水，他替人倒干净，放在伸手够得到的地方。',
      '阿婆让渡船顺着岸脚走。对岸有人拉开了窗，孩子隔水举起两根筷子，像两支细细的船桨。'
    ],
    endings:[
      {title:'桥下的第一碗',layer:'bridge',action:'回船送饭',lines:[
        '值夜的摆渡人听见瓷碗轻轻碰了两声。阿婆把饭端到桥阴里，邮差替他举着灯，让他腾出两只手来吃。',
        '阿婆认出了旧搭档的青篷。她把第一碗饭递下去，孩子在岸上数着，一直数到那人笑着把碗举过头顶。'
      ]},
      {title:'靠岸开席',layer:'table',action:'靠岸开席',lines:[
        '邮差提灯领最后一条船靠岸。孩子把短筷往旁边挪了挪，又分给邮差一双。他第一次看见自己常送信的那扇窗，从里头往外是什么样。',
        '渡船刚系好，锅盖就揭开了。阿婆坐进孩子拉开的椅子，把桌上最后一块藕夹给刚刚放下邮包的人。'
      ]},
      {title:'夜学窗前的一篮饭',layer:'school',action:'送饭到夜学',lines:[
        '邮差听见窗里一声声念自己的名字。阿婆把荷叶饭篮放在窗台，那个正在学写「渡」字的船工先把笔搁稳，又把第一团饭让给了教员。'
      ]}
    ],
    margins:[
      [['石桥的燕尾戳受了潮。孩子拿它当汤勺，在碗沿补了半圈热气。','石桥那张饭桌图上，短筷旁原本空着的地方，今天多了一只邮包。'],
       ['邮亭的莲叶印刚好托住图上的碗底。阿婆怕饭凉，用另一只碗把它扣严了。','邮亭送来的那只旧碗有个豁口。孩子悄悄转了半圈，让光滑的那一边朝着阿婆。']],
      [['从石桥倒读出来的小手印沾上了汤汁。摆渡人把自己的大拇指轻轻按在旁边。','石桥来的小手印留在折痕背面。孩子比了比，正好是他伸手拉椅子的地方。'],
       ['邮亭的回签翻过来，两颗小葱倒像船桨。阿婆顺着它们把饭送进了桥阴。','邮亭来的折页上画着两颗葱。邮差一眼就认出桌上的葱油拌面，没等阿婆开口就接过了碗。']]
    ],
    shortStops:['桥下','饭桌','夜学'],sideNames:['南岸过水阶','沿柳巷叩窗'],
    sidePassages:['阿婆把纸角压在篮沿上。南岸的水阶只露出最上一级，邮差用船灯把那一级照白，好让提篮的人看见脚下。','柳条擦过纸背，原来的折口岔出一条细线。窗里有人把灯芯剪短了一点，怕晃着临水写字的人。'],
    sideLines:[
      ['南岸的石阶湿得发滑。邮差蹲下来托住碗底，直到摆渡人的两只手都接稳，才把灯转向别处。','柳巷尽头还有一只船在等。阿婆把碗边的饭拨出一个小窝，给值夜人添进去半勺卤汁。'],
      ['孩子听见水阶上竹篮磕了一下，立刻拿走空凳上的书包。阿婆坐下时，邮差正好把最后一碟藕片端上桌。','邮差从柳巷捎回一张练字纸。孩子把它垫在热锅下面，桌上的每个人都能找到自己熟悉的一个字。'],
      ['阿婆踩着照亮的石阶，把篮子递给女教员。教员正教一个白发船工写女儿的名字。他先把最后一点写完，才伸手接饭。','柳巷的窗开得低，竹篮刚好过得去。下课时篮子沿原路回来，荷叶下面压着一张小条，是船工头一回亲笔写的「收到」。']
    ],
    thirdMargins:[['石桥的燕尾印落在生字格旁。船工描了两下，学会写船名里的「燕」。','邮亭来的莲叶印被孩子当成田字格，他给每一道叶脉添了一笔。'],['从石桥倒着找回的小手印，大小正好够压住窗台上翘起的习字纸。','邮亭纸背那两颗小葱，成了夜学里第一道有饭香的字谜。']],
    joints:{
      3:['一桌也在河上','孩子把两幅灯影贴在饭桌图两边，又给桥洞下的那只碗画了一把椅子。阿婆看明白了，把窗再推开一点。'],
      5:['碗底的头一个字','值夜人用指尖蘸水，在碗底写刚学会的姓。夜学窗台还留着他的竹篮，阿婆这才认出，收饭的人也正是给她写收条的人。'],
      6:['把名字写进座次','饭桌图上的座位只画了碗。女教员领孩子把每个人的名字补在碗边，最后空出一处，让刚放下邮包的人自己签。'],
      7:['一篮饭绕过三扇门','孩子沿纸折出一条巷子。桥下的碗、桌上的筷、夜学的字排在同一条线上。阿婆提起空篮，发现三处都给她留了饭。']
    }
  },
  chime:{
    turns:[['T4','R3'],['B2','B4']],routes:['缆车照山口','仓鸮巡松径'],
    passages:[
      '缆车到弯上停了一刻。站长把玻璃擦出一块巴掌大的亮处，看见路绳在雪下面一跳一跳，有人在下面拉它。',
      '仓鸮贴着雪松的低枝飞。孩子把空茶杯扣在栏杆上，听见杯底应了一声，知道站长还在山的这一面。'
    ],
    endings:[
      {title:'末班车的热茶',layer:'tea',action:'回站候车',lines:[
        '站长把炉门拨开，给两只搪瓷杯各添半杯茶。孩子趴在窗台上，守到远处最后一格车窗亮起来才肯喝。',
        '仓鸮落在站房的檐角，抖下一撮雪。孩子往站长杯里续茶，站长把另一只热杯放进他的两只手心。末班车的铃刚好响了。'
      ]},
      {title:'给夜行人的灯',layer:'trail',action:'入林挂灯',lines:[
        '站长下车沿绳找到孩子，一大一小把灯系在最低的松枝上。孩子退回雪阶试了试，说个子再矮一点的人也看得见。',
        '仓鸮绕过低枝，指给站长看那排细小的靴印。孩子把红绳打了两个结。雪又落下来，路的拐角一直亮着。'
      ]},
      {title:'望哨回了三声铃',layer:'watch',action:'给望哨报平安',lines:[
        '站长用车灯向高坡点了两下。守林人伸手拉响檐下的小铜铃，隔一会儿，又补了第三声。孩子数到这里才肯把耳朵从窗上挪开。'
      ]}
    ],
    margins:[
      [['雪松羽印旁有一道红绳。孩子说当初怕误了车，今天倒巴不得车来得慢一点。','雪松下先前系着红绳的那根枝子，恰好能让提灯的人把另一只手空出来。'],
       ['小站方印里的一级雪阶化了。站长在纸上把它改成茶炉的小脚，告诉孩子明天还来。','小站那棵画歪的矮松成了路标。接班人拿图走进雪里，一回头就认出了屋檐。']],
      [['从雪松倒读出来的小旗插在杯把里。孩子说这下谁也不会拿错站长的杯子。','从雪松倒着数到第三排脚印，就是插小旗的地方。站长照着它把绳结往低处挪了一掌。'],
       ['小站回签背面，原来画的是一线炉火。孩子拿茶杯一压，纸上又添了半个月亮。','从小站倒读时看见的两排足迹，一排往站房，一排往木屋。今夜它们共用了拐角的这盏灯。']]
    ],
    shortStops:['站房','松径','望哨'],sideNames:['绕到望哨背坡','沿林缘递信'],
    sidePassages:['站长把图的一角折向背坡，露出望哨的木栏杆。风从另一面刮来，站房的灯够不着那里，得把光从坡侧送过去。','林缘有一段路被新雪埋平了。孩子贴着树梢找出一块深色的木牌。木牌转向的地方，正对望哨边的一扇小窗。'],
    sideLines:[
      ['缆车从背坡绕回站房。孩子把罩在杯上的小碟揭起来，茶还冒着气。站长把最先倒的那一杯留给晚归的巡线人。','站长把林缘的雪抖在门外。孩子在炉上多温了一只空杯，说守林人换班下来时也该喝一口。'],
      ['背坡的松枝朝山下伸。站长把灯挂在枝梢，让走过结冰弯道的人一抬头就能看清下一阶。','孩子在林缘的木牌下面打了个活结，灯可以顺着绳子放低。仓鸮从树间回头，认出两道并排走下山的脚印。'],
      ['灯光顺着背坡爬上木栏杆。守林人把手套掖进腰带，用冻红的手拉了三下铃，站长在图的高处点下了第三个点。','林缘的木牌照亮了一瞬。岗亭里的人解开铃绳，提灯应了三声。孩子用铅笔圈起那扇高窗，把雪路的尽头补全了。']
    ],
    thirdMargins:[['雪松那端的红绳在图上绕了三圈，孩子每听到一响就松开一圈。','从小站顺读的方印旁，站长写上望哨应铃的时刻，好交给早班。'],['顺着雪松印倒回去，第三响正落在原来那面小旗上。','小站回签背面的一点炉火，如今有了山上回给它的第二点光。']],
    joints:{
      3:['两班人共一盏灯','清早来接班的人摊开雪路图，见松枝边画了一只杯子，站房边画了一盏灯。昨夜照路的人和守炉子的人，都在图上留了位置。'],
      5:['等第三声再喝','守林人过去总说站房的茶凉得快。站长今晚等到第三声铃才喝，热的。他在图上往杯里添了一圈白汽，算是回话。'],
      6:['从低枝到高窗','站在松枝下只能看见山腰。孩子把灯举高一点，望哨便答一声。他们这样一来一回，把被雪藏住的山路认到了尽头。'],
      7:['夜班交接簿','早班来时，炉上留着茶，低枝上留着灯，守林人已经走下望哨。他在交接簿的三行落款下面画了同一弯月亮。']
    }
  }
};
export const tailPage=l=>pages[l.play.coda.baseId];
export const tailMargin=(l,end)=>end===2?tailPage(l).thirdMargins[l.play.coda.mode][l.play.delivery.version]:tailPage(l).margins[l.play.coda.mode][l.play.delivery.version][end];
export const routeNames=(l,flap)=>flap?tailPage(l).sideNames:tailPage(l).routes;
export const endingStory=(l,r)=>r.flap?tailPage(l).sideLines[r.end][r.route]:tailPage(l).endings[r.end].lines[r.route];
export const foldName=flap=>flap?'侧折':'原折';
export const endsIn=mask=>[0,1,2].filter(e=>mask & (1<<e));
export const tailGroups=[3,5,6,7];
export const stopNames=(l,mask)=>endsIn(mask).map(e=>tailPage(l).shortStops[e]).join('＋');
export const jointText=(l,mask)=>tailPage(l).joints[mask];

// Return always uses the original crossing. On the side fold each scene may
// be reached from the far bank or slope, with a distinct pair of real exits.
const school=['R1','L2'],watch=['R1','B2'];
const tableSide=[
  {keeper:0,via:['R1','B1'],meet:['R4','B1'],third:school,thirdKeeper:0},
  {keeper:0,via:['R1','L1'],meet:['R4','L1'],third:school,thirdKeeper:0}
];
const snowSide=[
  [{keeper:0,via:['R1','R4'],meet:['T4','R4'],third:['B3','R4'],thirdKeeper:1},
   {keeper:1,via:['B3','B4'],meet:['B3','R3'],third:['B3','R4'],thirdKeeper:0}],
  [{keeper:0,via:['R1','L3'],meet:['B2','L3'],third:watch,thirdKeeper:0},
   {keeper:0,via:['R1','R4'],meet:['B2','R4'],third:watch,thirdKeeper:0}]
];
const side=(l,r)=>l.play.coda.baseId==='postmark'?tableSide[r]:snowSide[l.play.coda.mode][r];
export function tailKeeper(l,route,end=null,flap=0){
  const lead=flap?side(l,route).keeper:route;
  if(end===2)return flap?side(l,route).thirdKeeper:route===0?0:null;
  return end===1?1-lead:lead;
}
export function tailPorts(l,route,end=null,flap=0){
  const old=l.projection.scenes[6].exits,next=tailPage(l).turns[l.play.coda.mode];
  if(flap){const r=side(l,route);return end===null?r.via:[old,r.meet,r.third][end];}
  if(end===2)return route===0?(l.play.coda.baseId==='postmark'?school:watch):null;
  return end==null?old.map((port,i)=>i===route?port:next[i]):end?next:old;
}
