import { transform } from './puzzle.mjs';
import { afterlightChapters, afterlightPlans } from './afterlight.mjs';

export const pigments = [
  { name: '蜜金', mark: '太阳', icon: 'sun', light: '#ffe49b', mid: '#edb64d', dark: '#ad702f' },
  { name: '叶青', mark: '叶片', icon: 'leaf', light: '#bce6b1', mid: '#79bda0', dark: '#417d72' },
  { name: '蔷薇', mark: '花瓣', icon: 'petal', light: '#ffc9b2', mid: '#e79786', dark: '#b65e66' },
  { name: '湖蓝', mark: '水滴', icon: 'drop', light: '#c2e6eb', mid: '#77afc4', dark: '#447189' },
  { name: '紫藤', mark: '菱形', icon: 'diamond', light: '#e5cdf1', mid: '#b7a0cf', dark: '#786b9a' },
  { name: '靛青', mark: '月牙', icon: 'moon', light: '#b7caef', mid: '#889ac8', dark: '#58678e' },
];

export const chapters = [
  { flower: '雏菊', time: '清晨', art: 'daisy', name: '清晨的雏菊', latin: 'Bellis perennis',
    note: '厨房朝东。等水烧开的工夫，第一朵雏菊会亮在你的杯沿。' },
  { flower: '鸢尾', time: '午后', art: 'iris', name: '午后的鸢尾', latin: 'Iris',
    note: '书房的蓝色深了一点。你说以后看书累了，就抬头看一会儿花。' },
  { flower: '虞美人', time: '黄昏', art: 'poppy', name: '黄昏的虞美人', latin: 'Papaver rhoeas',
    note: '西窗把夕阳剪成细小的花瓣。两个人的影子，刚好可以坐在花底下。' },
  { flower: '月光花', time: '深夜', art: 'moonflower', name: '深夜的月光花', latin: 'Ipomoea alba',
    note: '四扇窗终于齐了。即使我们回家的时间不同，也会看见同一朵花。' },
  ...afterlightChapters,
];

export const volumes = [
  { title:'四时同窗', chapters:[0,1,2,3] },
  { title:'花窗背面的信', chapters:[4,5,6] },
];

// Letters describe the artisan's cutting pattern. Only the frame and its etched clues are shown.
// Each clue names a pane and one of its cells in reading order.
const plans = [
  { title: '窗台初晴', map: ['.AA.', 'BAAC', 'BBBC'], cuts: '000', sample: 'A',
    request: '「厨房的小窗还空着。明早煮咖啡时，想看见一点金色。」',
    reply: '第一束光从杯沿滑了过去。你把第二只杯子也摆了过来。' },
  { title: '早餐的影子', map: ['AAB.', 'ACBB', 'CCDB', '.DDD'], cuts: '1230',
    request: '「你总把果酱抹到桌布上。我们给那块草莓色留个位置吧。」',
    reply: '桌布上的草莓印子旁，多了一小片会移动的光。' },
  { title: '一枚金蕊', map: ['.AA.', 'BACC', 'BBDC', '.DDD'], cuts: '2131', gold: 'B',
    request: '「花心可以用黄铜做吗？晴天的时候，它会比花瓣先亮。」',
    reply: '黄铜钉在木桌上投下一枚小圆点。你拿铅笔沿着它描了一圈。' },
  { title: '煮水声里', map: ['.AAA.', 'BBACC', 'BDEEC', '.DDEE'], cuts: '30121', gold: 'E',
    request: '「水壶响了。把盛开的那面转向餐桌，我想从座位上看。」',
    reply: '壶盖轻轻跳着。你推开椅子说，明天也坐这里吃早饭。' },
  { title: '书页里的蓝', map: ['AABB', 'ABBC', 'DDCC', '.DEC', '..EE'], cuts: '13102', clues: 'C0', gold: 'B',
    request: '「翻到夹着鸢尾的那页了。能把那道花纹，也留在窗上吗？」',
    reply: '书页合上了，窗上的花纹还亮着。你这次没有忘记放书签。' },
  { title: '靠窗第二格', map: ['.AAB.', 'CAABB', 'CCDB.', '.CDDE', '...EE'], cuts: '23012', clues: 'B0 D1', gold: 'C',
    request: '「书架第二格是空的。想给那里的旧相机借一点午后的蓝。」',
    reply: '相机的取景框里，微小的玻璃气泡像一串未寄出的句号。' },
  { title: '雨停三分钟', map: ['.AAA.', 'BBAC.', 'BDCCC', 'BDDEE', '..DEE'], cuts: '30221', clues: 'A2 E2', gold: 'D',
    request: '「再过一会儿可能还会下。趁有光，把雨珠的样子拼进去吧。」',
    reply: '雨果然又来了。这一次，书桌上的那片蓝没有被淋湿。' },
  { title: '把午后装订', map: ['.AABB', 'CAADB', 'CCDDD', 'CEEFF', '..EFF'], cuts: '130213', clues: 'C1 F0', gold: 'B',
    request: '「等最后一页读完，就把这扇鸢尾窗当作我们的藏书票。」',
    reply: '你在扉页上写下两个人的名字，墨水被窗上的蓝光照得很浅。' },
  { title: '花瓣的背面', map: ['.AAA', 'BBCA', '.BCC', 'DBEC', 'DDEE'], cuts: '40012', clues: 'A0 B1', gold: 'E',
    request: '「捡到一片颜色很好的玻璃。翻个面，弯角会不会刚好朝西？」',
    reply: '你把玻璃翻在掌心，朝我眨了眨眼。夕阳从另一面透过来了。' },
  { title: '橘红的裙摆', map: ['.AAB.', 'CAABB', 'CCDBE', 'CFDEE', '.FDD.', '.FF..'], cuts: '251406', clues: 'B2 F1', gold: 'D',
    request: '「那天经过花市，风把一排红花吹得朝西倒。就做那一瞬间。」',
    reply: '窗扇合拢时，一整排玻璃花也像被微风碰了一下。' },
  { title: '晚风穿堂', map: ['AA.BB', 'CAABB', 'CCDEE', 'CFDDE', '.FFDE'], cuts: '401625', clues: 'A2 D1', gold: 'C',
    request: '「两扇窗同时开，会有穿堂风。给风也留一条穿过花丛的小路。」',
    reply: '风把桌边的便签吹翻，背面是你写的晚饭菜单。' },
  { title: '日落前的约定', map: ['.AABB.', 'CAABBD', 'CCDDDD', 'CFDEEE', '.FFEE.'], cuts: '254631', clues: 'B2 C0 E2', gold: 'F',
    request: '「今天早点收工吧。那一点最亮的红色，想和你一起装上去。」',
    reply: '你扶着窗框，我按下最后一片。傍晚慢了一小会儿。' },
  { title: '给晚归的人', map: ['..AAB', '.CAAB', 'CCDBB', 'CEDDF', '.EEFF'], cuts: '521346', clues: 'B0 D0 E1', seams: ['C3-D3'], gold: 'A',
    request: '「今晚要晚些到家。如果还亮着，我在巷口就能认出我们的窗。」',
    reply: '巷口传来钥匙碰在一起的声音。我把灯又调亮了一格。' },
  { title: '月落在杯底', map: ['.AABB', 'CA.BD', 'CCBBD', 'CFEED', '.FFEE'], cuts: '254163', clues: 'C1 E2', seams: ['B3-C3','D4-E4'], gold: 'D',
    request: '「杯底剩着一点水，映出半轮月亮。我想把另一半放进窗里。」',
    reply: '两个月亮一高一低。你喝完那杯水，把小的那个月亮藏了起来。' },
  { title: '巷尾那盏灯', map: ['.AAA..', 'BBACCD', 'BECCDD', 'BEEFFD', '..EFF.'], cuts: '516247', clues: 'A1 D0 F2', seams: ['C2-D2','D3-E3','C4-D4'], gold: 'B',
    request: '「对面灯熄了。今晚最后一束光，我们留给楼下等门的猫。」',
    reply: '猫从窗下走过，小小的影子停了停，正踩在一朵月光花上。' },
  { title: '四时同窗', map: ['..AAB.', '.CAABB', 'CCDEEB', 'CDDEEF', '.DFFFF', '...F..'], cuts: '364527', clues: 'A0 C1 E2', seams: ['C3-D3','D4-D5','E3-F3'], gold: 'F',
    request: '「从那天的第一杯咖啡到现在，刚好做满四扇。最后这一扇归谁？」',
    reply: '你把两把椅子并在窗下。四种花都在这里，这扇窗也有了答案。' },
];

function makeLevel(plan, index, id, chapter) {
  const width = plan.map[0].length, cells = plan.map.join('').split('');
  const letters = [...new Set(cells)].filter(c => c !== '.').sort();
  const reference = [], clues = new Map(), rubbings = new Map(), engravings = [];
  const pieces = letters.map((letter, i) => {
    const points = cells.flatMap((c, n) => c === letter ? [[n % width, Math.floor(n / width)]] : []);
    const mean = points.reduce(([x, y], [a, b]) => [x + a / points.length, y + b / points.length], [0, 0]);
    const distance = ([x, y]) => (x - mean[0]) ** 2 + (y - mean[1]) ** 2;
    const rivet = plan.pins?.split(' ').find(s=>s[0]===letter);
    const pin = rivet ? points[Number(rivet.slice(1))] : points.reduce((a, b) => distance(a) <= distance(b) ? a : b);
    const cut = Number(plan.cuts[i]);
    reference.push({ x: pin[0], y: pin[1], o: (cut & 4) ? cut : (-cut & 3) });
    for (const clue of (plan.clues || '').split(' ').filter(s => s[0] === letter)) {
      const [x, y] = points[Number(clue.slice(1))];
      clues.set(y * width + x, i);
    }
    const cutPoint = ([x,y]) => transform([x-pin[0],y-pin[1]],cut);
    const piece = { ...pigments[i], cells:points.map(cutPoint) };
    const mark = (plan.etches || '').split(' ').find(s=>s[0]===letter);
    if (mark) {
      const [x,y] = points[Number(mark.slice(1))];
      piece.etch = cutPoint([x,y]);
      engravings[i] = y*width+x;
      if (plan.rubbings?.includes(letter)) {
        piece.rubbing = engravings[i];
        rubbings.set(piece.rubbing,i);
      }
    }
    return piece;
  });
  const goldPin = reference[letters.indexOf(plan.gold)];
  const cellNumber = pos => (Number(pos.slice(1))-1)*width+pos.charCodeAt(0)-65;
  const seams = (plan.seams || []).map(pair => pair.split('-').map(cellNumber));
  const joints = (plan.joints || []).map(pair=>[letters.indexOf(pair[0]),letters.indexOf(pair[1])]);
  const neighbors = pieces.map(()=>[]);
  for (const [a,b] of joints) { neighbors[a].push(b); neighbors[b].push(a); }
  let fork = null;
  if (plan.fork) {
    const pane = letters.indexOf(plan.fork.pane);
    const cells = [engravings[pane],cellNumber(plan.fork.other)];
    fork = { pane, routes:cells.map((at,i)=>({ at, name:plan.fork.names[i], reply:plan.fork.letters[i] })) };
  }
  return { id, index, chapter, width, height: plan.map.length, cells, pieces, clues, flip: chapter >= 2 || Boolean(plan.daily),
    seams, rubbings, joints, neighbors, fork, hasEtches:pieces.some(p=>p.etch), tip:plan.tip,
    gold: goldPin ? goldPin.y * width + goldPin.x : null,
    sample: letters.map((letter, i) => letter === plan.sample ? reference[i] : null),
    title: plan.title, request: plan.request, reply: plan.reply, daily: Boolean(plan.daily) };
}

export const levels = [...plans,...afterlightPlans].map((plan, n) => makeLevel(plan, n, 'glass-' + (n + 1), Math.floor(n / 4)));

export function dateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function connected(cells, width, letter) {
  const start = cells.indexOf(letter), seen = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const next of [at - width, at + width, at % width ? at - 1 : -1, at % width < width - 1 ? at + 1 : -1]) {
      if (cells[next] === letter && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen.size === cells.filter(c => c === letter).length;
}

// Start from a cuttable frame, then trade adjoining cells between panes.
// Keeping each pane connected preserves a physical cutting pattern and a guaranteed solution.
export function dailyLevel(key = dateKey()) {
  let seed = 2166136261;
  for (const c of key) seed = Math.imul(seed ^ c.charCodeAt(0),16777619) >>> 0;
  const random = n => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * n);
  };
  const chapter = random(4), rows = plans[7 + random(plans.length - 7)].map;
  const width = rows[0].length, cells = rows.join('').split('');
  for (let attempt = 0; attempt < 130; attempt++) {
    const at = random(cells.length), change = [-width, width, -1, 1][random(4)], next = at + change;
    if (Math.abs(change) === 1 && Math.floor(next / width) !== Math.floor(at / width)) continue;
    const from = cells[at], to = cells[next];
    if (!to || to === '.' || from === '.' || from === to) continue;
    if (cells.filter(c => c === from).length <= 3 || cells.filter(c => c === to).length >= 6) continue;
    cells[at] = to;
    if (!connected(cells, width, from)) cells[at] = from;
  }
  const letters = [...new Set(cells)].filter(c => c !== '.').sort();
  const shuffled = [...letters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const clues = shuffled.slice(0, 2).map(c => c + random(cells.filter(l => l === c).length)).join(' ');
  const address = at => String.fromCharCode(65 + at % width) + (Math.floor(at / width) + 1);
  const joints = cells.flatMap((c,at) => c === '.' ? [] : [at+1,at+width].filter(next =>
    (next !== at+1 || next%width !== 0) && cells[next] && cells[next] !== '.' && cells[next] !== c
  ).map(next => address(at)+'-'+address(next)));
  const plan = { map: rows.map((_, y) => cells.slice(y * width, (y + 1) * width).join('')),
    title: '今日花样', cuts: letters.map(() => random(8)).join(''), daily: true, clues, gold: shuffled[2],
    seams: [joints[random(joints.length)]],
    request: '「今天的边角料很漂亮。拿它们拼一扇只属于今天的小窗吧。」',
    reply: '今天的光有了自己的形状。明天再来，工作台上会摆好另一份玻璃。' };
  return makeLevel(plan, -1, 'day-' + key, chapter);
}
