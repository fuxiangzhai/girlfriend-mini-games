import { chapters, volumes, levels, dailyLevel, dateKey } from './levels.mjs';
import { turn, flip, shapeAt, fits, isGilded, suggest, etchAt, endingOf, transform, markCell, mirrorFalls } from './puzzle.mjs';
import { address, cellLabel, orderLines, backIssue } from './brief.mjs';
import { icon, thumbnail, drawBoard } from './glass.mjs';
import { read, write, fresh, restore, save, record, award } from './save.mjs';
import { setupNight } from './night-shift.mjs';
import { lastShow, setupLantern } from './lantern-desk.mjs';
import { lastPlay, setupSlips } from './slip-desk.mjs';
import {lastDuet,lastReceipt} from './duet-desk.mjs';
import { paneDescription } from './lantern-glass.mjs';

const $ = id => document.getElementById(id);
const els = id => Array.from($(id).children);
const chapterNumbers = ['一','二','三','四','五','六','七'];
const number = n => String(n).padStart(2,'0');
const art = chapter => './art/' + chapters[chapter].art + '.webp';
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

let level, state, history, hint, hover, drag, lesson, focusAt, activePage = 'bench', chapterOpen = 0;
let trying=false, trial=null, hintRoute=null;
let suppressClick = false, soundOn = read('sound') !== false, audio;
function soundButton() {
  $('sound').innerHTML = icon(soundOn ? 'speaker' : 'mute');
  $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').title = soundOn ? '关闭工坊音效' : '打开工坊音效';
}
function chime(id = 0, complete = false, cuePanes = null) {
  if (!soundOn) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state !== 'running') void audio.resume().catch(() => {});
    const glass = [392,440,523.25,587.33,659.25,783.99];
    const notes = cuePanes ? cuePanes.map(piece=>glass[piece]) : complete ? [523.25,659.25,783.99] : [glass[id] || 440];
    const gap = cuePanes ? 0.18 : 0.085, decay = cuePanes ? 0.19 : 0.46;
    notes.forEach((hz,i) => {
      const start = audio.currentTime + .01 + i * gap, osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = hz; osc.type = cuePanes?'triangle':'sine';
      gain.gain.setValueAtTime(.001,start);
      gain.gain.exponentialRampToValueAtTime(cuePanes ? 0.045 : 0.085,start + .008);
      gain.gain.exponentialRampToValueAtTime(.001,start + decay);
      osc.connect(gain).connect(audio.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(start); osc.stop(start + decay + .02);
    });
  } catch { /* Sound is optional on browsers that suspend audio. */ }
}
$('sound').onclick = () => { soundOn = !soundOn; write('sound',soundOn); soundButton(); if (soundOn) chime(); };
soundButton();

function tell(text) { $('message').textContent = text; }
function occupiedAt(x,y) {
  return state.slots.findIndex((p,i) => p && shapeAt(level.pieces[i],p.o).some(([dx,dy]) => p.x+dx === x && p.y+dy === y));
}
function baseText() {
  if(level.play){
    if(slips.finished())return '落幕了。可以重映整出，或在活动戏本里回看每次换片。';
    if(state.selected<0)return '镜位已拼满。可以先探后场，再落下这一拍。';
    if(trying)return '先选格试摆，点「嵌入此处」才会放下这片活动玻璃。';
    return '已选'+level.pieces[state.selected].name+'，圆钉是落点。按场记拼出这一拍的两束光。';
  }
  if (level.projection) {
    if(state.selected<0)return '玻璃已拼满。核对出光口后，点「开场放映」试演。';
    if(trying)return '先选窗格试摆，再看试灯轨迹。点「嵌入此处」才会放下玻璃。';
    return level.showIndex===0 && state.slots.filter(Boolean).length===1?'从西一进光。让蜜金片的银镜在 B1 把光折向北二。':
      '已选'+level.pieces[state.selected].name+'。点窗格落下圆钉，银镜会随玻璃一起转。';
  }
  if (state.selected < 0) return '这张试片已拼好，可以查看成品或撤销再试。';
  if (lesson) return '叶青已选好。点虚线中的圆钉，嵌入第一片。';
  if (level.index === 2 && !isGilded(level,state.slots)) return '试着让一枚圆钉对准四角星，成品会得到金印。';
  if (level.index === 4) return '窗格上的花瓣刻纹，要用带花瓣标记的蔷薇玻璃覆盖。';
  if (level.index === 8) return '这次试试翻面。玻璃上的圆钉始终是落点。';
  if (level.index === 12) return '金边粗线是固定铅条，整块玻璃不能跨过它。';
  if (level.hasEtches) {
    if (trying) return '先点窗格试摆。可以旋转或翻面，满意后点「嵌入此处」。';
    const id=state.selected, piece=level.pieces[id], needs=[];
    if (piece.rubbing!=null) needs.push('对上 '+cellLabel(level,piece.rubbing)+' 的空心花');
    if (level.fork?.pane===id) needs.push('落在 '+level.fork.routes.map(r=>cellLabel(level,r.at)+'「'+r.name+'」').join(' 或 '));
    if (level.neighbors[id].length) needs.push('与'+level.neighbors[id].map(n=>level.pieces[n].name).join('、')+'的花心共边');
    if (needs.length) return piece.name+'背花要'+needs.join('，并')+'。';
  }
  return '已选' + level.pieces[state.selected].name + '。点窗格放下圆钉，也可以先旋转。';
}
function persist(){
  if(level.play)slips.save(state,history);else save(level,state,history);
}
function issueAt(id,place) {
  return level.play?slips.issue(state.slots.map((p,i)=>i===id?place:p)):'';
}
function commit(next) {
  history = [...history.slice(-39),state];
  state = next; hint = null; hover = null; lesson = null; trial = null;
  persist();
}
function preview() {
  if (trial) {
    const id=state.selected, place={...trial,o:state.angles[id]};
    return {id,place,valid:fits(level,state.slots,id,place) && !issueAt(id,place)};
  }
  if (hover) return hover;
  const ghost = hint?.type === 'place' ? hint : lesson;
  return ghost ? { ...ghost,valid:true } : null;
}
function paint() {
  const ghost=preview();
  const seated=level.projection && ghost?.valid && state.slots[ghost.id] ?
    state.slots.map((p,id)=>id===ghost.id?null:p) : state.slots;
  drawBoard($('drawing'),level,seated,ghost,hint?.type === 'lift' ? hint.id : -1);
  if (level.projection) lantern.paint(state.slots,ghost);
  if (level.hasEtches) $('order-lines').innerHTML=orderLines(level,state.slots,ghost);
  $('seat-trial').disabled = !trial || !ghost?.valid;
}
function render() {
  const count = state.slots.filter(Boolean).length, done = count === level.pieces.length;
  $('counter').textContent = '已嵌 ' + count + ' / ' + level.pieces.length;
  $('turn').disabled = $('flip').disabled = done;
  $('audition').disabled = done;
  $('audition').setAttribute('aria-pressed',String(trying && !done));
  $('trialbar').hidden = !trying || done;
  $('mat').classList.toggle('is-lit',trying && !done);
  $('undo').disabled = !history.length;
  $('reset').disabled = !history.length && !record(level) &&
    JSON.stringify(state.slots) === JSON.stringify(level.sample) && state.angles.every(o => !o);
  $('hint-label').textContent = done && !level.projection ? '查看成品' : hint ? (hint.type === 'place' ? '照提示嵌入' : '取回这片') : '看一步提示';
  if(level.play){
    if(slips.finished()){$('reset').disabled=true;$('hint-label').textContent='重映整出';}
    if(hint?.type==='rewind')$('hint-label').textContent='倒回第 '+(hint.index+1)+' 拍';
    if(hint?.type==='reset')$('hint-label').textContent='还原本拍';
  }
  els('pieces').forEach((btn,id) => {
    const p = level.pieces[id], placed = state.slots[id];
    btn.classList.toggle('is-set',Boolean(placed));
    const guarded=Boolean(level.play && slips.held(id));
    btn.classList.toggle('is-guarded',guarded);
    btn.setAttribute('aria-pressed',String(state.selected === id));
    const angle=placed?.o ?? state.angles[id];
    const offset=p.etch && transform(p.etch,angle);
    const offsets=offset ? [offset[0] ? (offset[0]>0?'右':'左')+Math.abs(offset[0])+'格':'',
      offset[1] ? (offset[1]>0?'下':'上')+Math.abs(offset[1])+'格':''].filter(Boolean).join('、') : '';
    btn.setAttribute('aria-label',p.name + '玻璃，' + p.mark + '纹，' +(offsets?'背花在圆钉'+offsets+'，':'')+paneDescription(p,angle)+ (guarded?'守灯夹住':placed ? '已嵌入，点按取回' : '点按选择'));
    btn.innerHTML = thumbnail(p,angle,id) +
      (placed ? '<span class="check">'+icon('check')+'</span>' : '') + '<span class="piece-label">'+p.name+'</span>';
  });
  $('objective').hidden = level.gold === null;
  if (level.gold !== null) $('objective').innerHTML = icon('star') + (isGilded(level,state.slots) ? '圆钉已对准金印。' : '可选金印 · 让一枚圆钉压住四角星。');
  for (const cell of els('hit-grid')) {
    const x = +cell.dataset.x, y = +cell.dataset.y, at = y*level.width+x, id = occupiedAt(x,y);
    const text = [address(x,y), id < 0 ? '空格' : level.pieces[id].name+(level.play && slips.held(id)?'玻璃，守灯夹住':'玻璃，点按取回')];
    if (level.clues.has(at)) text.push(level.pieces[level.clues.get(at)].mark+'刻纹');
    if (at === level.gold) text.push('金印');
    if (level.rubbings.has(at)) text.push(level.pieces[level.rubbings.get(at)].name+'背花拓印');
    const route=level.fork?.routes.find(r=>r.at===at);
    if (route) text.push(route.name+'信位');
    if (id>=0 && etchAt(level,id,state.slots[id])===at) text.push('实心背花');
    if (level.projection) {
      if (at===level.projection.cross) text.push('合像圈');
      if(id>=0) {
        const piece=level.pieces[id], p=state.slots[id];
        if(piece.star && markCell(level.width,piece.star,p)===at)text.push('暗星');
        if(piece.mirror && markCell(level.width,piece.mirror.offset,p)===at)text.push('银镜，'+(mirrorFalls(piece.mirror.falls,p.o)?'左上连右下':'左下连右上'));
      }
    }
    for (const [a,b] of level.seams) {
      if (at===a) text.push(b-a===1?'右侧有铅条':'下方有铅条');
      if (at===b) text.push(b-a===1?'左侧有铅条':'上方有铅条');
    }
    cell.setAttribute('aria-label',text.join('，'));
    cell.tabIndex = at === focusAt ? 0 : -1;
  }
  paint();
}
function setPage(page) {
  activePage = page;
  for (const id of ['bench','book','night']) {
    $(id).hidden=page!==id;
    const tab=$('nav-'+id);
    if (id===page) tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  }
  write('room',page);
}
function jacket(chapter) {
  $('hero').classList.remove('is-night','is-roll','is-lantern','is-slip');
  const sequel=volumes[1].chapters.includes(chapter);
  $('hero').classList.toggle('is-letter',sequel);
  $('jacket').hidden=!sequel;
  if (sequel) $('jacket').src=art(chapter);
  $('sequel').hidden=sequel;
  $('volume-name').textContent=sequel?'Petal Panes · II':'Petal Panes';
  $('page-title').textContent=sequel?volumes[1].title:'借一束光';
  $('hero-line').textContent=sequel?'从旧站走到桂花巷，拼出玻璃背面的回信。':'把彩色玻璃拼成花窗，留一束光给喜欢的人。';
}
function routeButtons() {
  if (!level.fork) return;
  els('routes').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===hintRoute)));
}
function preferRoute(index) {
  hintRoute=index;
  write('route:'+level.id,index);
  hint=null; hover=null; trial=null;
  routeButtons(); render();
}
function openLevel(target, showFinished = false) {
  level = target; ({ state, history } = level.play?slips.load(level):restore(level));
  hint = null; hover = null; drag = null; lesson = null; if (!level.projection) chapterOpen = level.chapter;
  trying=false; trial=null;
  const preference=level.fork ? read('route:'+level.id) : null;
  hintRoute=Number.isInteger(preference) && level.fork?.routes[preference] ? preference : null;
  if (!level.projection) jacket(level.chapter);
  lantern.configure(level);
  focusAt = level.cells.findIndex(c => c !== '.');
  if (level.index === 0 && !history.length && state.selected === 1 && state.slots.filter(Boolean).length === 1) {
    const step = suggest(level,state.slots,state.selected);
    if (step?.type === 'place') {
      lesson = step;
      state = { ...state, angles:state.angles.map((o,i) => i === step.id ? step.place.o : o) };
      focusAt = step.place.y * level.width + step.place.x;
    }
  }
  write('bench:mode',level.play?'slips':level.projection?'lantern':'day');
  write(level.play?'slip:active':level.projection?'lantern:active':'active',level.daily ? 'daily' : level.id);
  const chapter = chapters[level.chapter];
  $('chapter-label').textContent = level.daily ? '每日委托 · '+level.id.slice(4) :
    '第'+chapterNumbers[level.chapter]+'章·'+chapter.flower+' / 图纸'+number(level.index+1);
  $('level-title').textContent = level.title;
  $('request').textContent = level.request; if(!level.projection)$('note-art').src=art(level.chapter);
  $('instruction').textContent = level.seams.length ? '同纹填刻槽，整片玻璃不能跨过金边铅条。' :
    level.clues.size ? '刻纹格要配同纹玻璃。点选或拖入窗框。' : '点选或拖动玻璃，圆钉对准想放的窗格。';
  if (level.hasEtches) $('instruction').textContent='圆钉仍是落点。玻璃上的实心小花会一起转动。';
  if(level.projection) {
    $('chapter-label').textContent=level.play?'留灯换景 / 第 '+number(level.showIndex+1)+' 出':'巷口幻灯会 / 第 '+number(level.showIndex+1)+' 场';
    $('instruction').textContent='点玻璃，再点窗格放圆钉。光从圆牌入，遇银镜转直角，向方牌出。';
  }
  $('note-art').closest('.note-card').querySelector('h3').textContent=level.projection?'棚边来信':'窗边来信';
  $('audition').hidden=!(level.hasEtches || level.projection);
  $('afterlight-guide').hidden=$('order-card').hidden=!level.hasEtches;
  $('level-title').closest('.work-heading').classList.toggle('with-light',Boolean(level.hasEtches || level.projection));
  $('strategy').hidden=!level.tip;
  $('strategy').open=false; $('strategy-text').textContent=level.tip || '';
  $('route-picker').hidden=!level.fork;
  $('routes').innerHTML=level.fork ? level.fork.routes.map((r,i)=>'<button type="button" data-route="'+i+'">'+(i+1)+' · '+r.name+'</button>').join('') : '';
  routeButtons();
  $('flip').hidden = !level.flip;
  const board = $('board');
  board.style.setProperty('--w',level.width); board.style.setProperty('--h',level.height);
  $('mat').style.setProperty('--rows',level.height);
  board.style.setProperty('--ratio',level.width/level.height);
  $('col-labels').innerHTML = Array.from({length:level.width},(_,x)=>'<span>'+String.fromCharCode(65+x)+'</span>').join('');
  $('row-labels').innerHTML = Array.from({length:level.height},(_,y)=>'<span>'+(y+1)+'</span>').join('');
  $('hit-grid').replaceChildren(...level.cells.flatMap((c,at) => {
    if(c === '.') return [];
    const btn = document.createElement('button'), x = at%level.width, y = Math.floor(at/level.width);
    btn.type = 'button'; btn.className = 'cell'; btn.dataset.x = x; btn.dataset.y = y;
    btn.style.gridArea = (y+1)+' / '+(x+1); return [btn];
  }));
  $('pieces').replaceChildren(...level.pieces.map((_,i) => {
    const b=document.createElement('button'); b.type='button'; b.className='piece'; b.dataset.id=i; return b;
  }));
  setPage('bench'); render(); tell(baseText());
  if (!level.projection && state.slots.every(Boolean)) {
    award(level,isGilded(level,state.slots),endingOf(level,state.slots));
    if (showFinished) showResult();
  }
}
function selectPane(id) {
  const installed = state.slots[id];
  if(installed && level.play){const why=issueAt(id,null);if(why){tell(why);return;}}
  trial=null;
  if (installed) {
    const angles = [...state.angles], slots = [...state.slots];
    angles[id] = installed.o; slots[id] = null;
    commit({angles,slots,selected:id});
  } else {
    state = { ...state, selected:id }; hint=null; lesson=null; hover=null; persist();
  }
  render(); tell(installed ? '已取回'+level.pieces[id].name+'，可以重新嵌入。' : baseText());
}
function orient(fn) {
  const id = state.selected;
  if (id < 0) return;
  const angles = [...state.angles]; angles[id] = fn(angles[id]);
  const point=trial;
  commit({...state,angles}); trial=point; render();
  tell(point ? trialText() : '已'+(fn===turn?'旋转':'翻面')+'。'+baseText());
}
function rejection(id,place) {
  const points = shapeAt(level.pieces[id],place.o).map(([dx,dy])=>[place.x+dx,place.y+dy]);
  if (points.some(([x,y])=>x<0 || x>=level.width || y<0 || y>=level.height || level.cells[y*level.width+x]==='.')) {
    return '有玻璃伸出了窗框。试着换个落点或转一面。';
  }
  if (points.some(([x,y])=>level.clues.has(y*level.width+x) && level.clues.get(y*level.width+x)!==id)) {
    return '这片玻璃与窗格的刻纹不同。找找托盘里相同的花纹。';
  }
  const taken=new Set(points.map(([x,y])=>y*level.width+x));
  if (level.seams.some(([a,b])=>taken.has(a)&&taken.has(b))) {
    return '金边的铅条隔开了这两格。这片玻璃得完整地放在铅条一侧。';
  }
  return backIssue(level,state.slots,id,place,taken) || '这里已经嵌了玻璃。换个位置，或先取回挡住的那片。';
}
function trialText() {
  const ghost=preview();
  if(level.play && fits(level,state.slots,ghost.id,ghost.place)){const why=issueAt(ghost.id,ghost.place);if(why)return why;}
  return ghost.valid?'试摆在 '+address(ghost.place.x,ghost.place.y)+'，位置合适。可以嵌入或继续尝试。':rejection(ghost.id,ghost.place);
}
function tryCell(x,y) {
  trial={x,y}; hint=null; hover=null;
  render(); tell(trialText());
}
function placePane(id,place) {
  if (!fits(level,state.slots,id,place)) { tell(rejection(id,place)); return; }
  const why=issueAt(id,place);if(why){tell(why);return;}
  const slots = [...state.slots], angles = [...state.angles];
  slots[id] = place; angles[id] = place.o;
  commit({ slots,angles, selected:slots.findIndex(p=>!p) });
  const done = slots.every(Boolean);
  if (done && !level.projection) award(level,isGilded(level,slots),endingOf(level,slots));
  render(); chime(id,done && !level.projection);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const spark = document.createElement('span');
    spark.className = 'seat-ring';
    spark.style.left = (place.x+.5)/level.width*100+'%';
    spark.style.top = (place.y+.5)/level.height*100+'%';
    $('board').append(spark);
    setTimeout(()=>spark.remove(),460);
  }
  if (done && level.projection) tell(baseText());
  else if (done) { tell('试片已入册。'); showResult(); }
  else tell(level.pieces[id].name+'已嵌入。'+(level.hasEtches?baseText():'接下来是'+level.pieces[state.selected].name+'。'));
}
function guidedPlace(id,x,y) {
  const step = hint?.type === 'place' ? hint : lesson;
  if (step?.id !== id) return null;
  const {place} = step;
  return shapeAt(level.pieces[id],place.o).some(([dx,dy])=>place.x+dx===x && place.y+dy===y) ? place : null;
}
function onCell(x,y) {
  focusAt = y*level.width+x;
  if (trying && state.selected>=0) {
    const guided=guidedPlace(state.selected,x,y);
    tryCell(guided?.x ?? x,guided?.y ?? y); return;
  }
  const id = occupiedAt(x,y);
  if (id >= 0) { selectPane(id); return; }
  if (state.selected >= 0) placePane(state.selected,guidedPlace(state.selected,x,y) || {x,y,o:state.angles[state.selected]});
}
function undo() {
  if (!history.length) return;
  state = history[history.length-1]; history=history.slice(0,-1);
  hint=null; lesson=null; hover=null; trial=null; persist(); render(); tell('已撤销上一步。'+baseText());
}
function showHint() {
  if (!level.projection && state.slots.every(Boolean)) { showResult(); return; }
  if (hint) {
    if (hint.type==='rewind') slips.rewind(hint.index);
    else if (hint.type==='reset') $('reset').click();
    else if (hint.type === 'lift') selectPane(hint.id);
    else placePane(hint.id,hint.place);
    return;
  }
  hint = level.projection?lantern.step(state.slots,state.selected):suggest(level,state.slots,state.selected,hintRoute); hover=null; lesson=null; trial=null;
  if (!hint) return;
  if(hint.type==='finished'){hint=null;slips.project();return;}
  if(hint.type==='rewind'){render();tell('要完成这次排演，最晚从第 '+(hint.index+1)+' 拍起改。再点提示会保留前 '+hint.index+' 拍。');return;}
  if(hint.type==='reset'){render();tell('先还原这次换景，再从上一拍的镜位接下去。');return;}
  if (hint.type==='ready') {hint=null;render();tell('这套镜位已经能演「'+lantern.target()+'」。'+(level.play?'可以落下这一拍。':'点「开场放映」即可收票。'));return;}
  const { id,place } = hint;
  if (hint.type === 'lift' && level.play) tell('要接完整场，先取回红色虚线里的'+level.pieces[id].name+'。这套排法还有 '+hint.count+' 片在桌上需要调整。');
  else if (hint.type === 'lift' && level.projection) tell('要演「'+lantern.target()+'」，桌上至少要换 '+hint.count+' 片。先取回红色虚线里的'+level.pieces[id].name+'。');
  else if (hint.type === 'lift') tell('要完成'+(hintRoute===null?'余下的图纸':'「'+level.fork.routes[hintRoute].name+'」')+'，先取回红色虚线里的'+level.pieces[id].name+'。');
  else {
    state = {...state,selected:id,angles:state.angles.map((o,i)=>i===id?place.o:o)};
    persist();
    tell('试试'+level.pieces[id].name+'，方向已对好。把圆钉放到 '+address(place.x,place.y)+' 的亮圈。');
  }
  render();
}
$('turn').onclick = () => orient(turn); $('flip').onclick = () => orient(flip);
$('audition').onclick=()=>{ trying=!trying; trial=null; hint=null; hover=null; render(); tell(baseText()); };
$('seat-trial').onclick=()=>{ const ghost=preview(); if(trial && ghost?.valid) placePane(ghost.id,ghost.place); };
$('routes').onclick=e=>{
  const b=e.target.closest('[data-route]'); if (!b) return;
  const index=Number(b.dataset.route);
  preferRoute(hintRoute===index?null:index);
  tell(hintRoute===null?'两封回信都可以尝试。':'提示将寻找「'+level.fork.routes[index].name+'」，目标在 '+cellLabel(level,level.fork.routes[index].at)+'。');
};
$('undo').onclick = undo; $('hint').onclick = showHint;
$('reset').onclick = () => { if(level.play && slips.finished())return;commit(level.play?slips.resetDesk():fresh(level)); render(); tell((level.play?'本拍的起始镜位已还原。':'图纸已铺好，可以重新拼。')+baseText()); };
$('pieces').onclick = e => { const b=e.target.closest('.piece'); if (b && !suppressClick) selectPane(+b.dataset.id); };
$('hit-grid').onclick = e => { const b=e.target.closest('.cell'); if (b && !suppressClick) onCell(+b.dataset.x,+b.dataset.y); };

function cellBelow(x,y) { return document.elementFromPoint(x,y)?.closest('#hit-grid .cell'); }
function setHover(id,place) {
  if (!drag?.moved) place = guidedPlace(id,place.x,place.y) || place;
  if (hover?.id===id && hover.place.x===place.x && hover.place.y===place.y && hover.place.o===place.o) return;
  hover = {id,place,valid:fits(level,state.slots,id,place) && !issueAt(id,place)}; paint();
}
function clearHover() { if (hover) { hover=null; paint(); } }
function startDrag(event) {
  if (!event.isPrimary || event.button !== 0) return;
  const button = event.target.closest('.piece,.cell');
  if (!button) return;
  const fromBoard = button.classList.contains('cell');
  const x=+button.dataset.x,y=+button.dataset.y;
  const id = fromBoard ? occupiedAt(x,y) : +button.dataset.id;
  if (id < 0) return;
  const installed = state.slots[id];
  if(installed && level.play && issueAt(id,null))return;
  if (trying && installed) return;
  drag = {id, pointer:event.pointerId, startX:event.clientX, startY:event.clientY, moved:false, button,
    dx:fromBoard?x-installed.x:0, dy:fromBoard?y-installed.y:0, o:installed?.o??state.angles[id]};
}
$('pieces').addEventListener('pointerdown',startDrag);
$('hit-grid').addEventListener('pointerdown',startDrag);
document.addEventListener('pointermove',e => {
  if (drag && e.pointerId===drag.pointer) {
    if (!drag.moved && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<7) return;
    if (!drag.moved) {
      drag.moved=true;
      drag.button.setPointerCapture(e.pointerId);
      hint=null; lesson=null; trial=null;
      if (!state.slots[drag.id]) {
        state={...state,selected:drag.id};
        persist();
        els('pieces').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===drag.id)));
      }
      $('hint-label').textContent='看一步提示';
      tell('拖动'+level.pieces[drag.id].name+(trying?'，在窗格上松开即可试摆。':'，在窗格上松开即可嵌入。'));
    }
    const cell=cellBelow(e.clientX,e.clientY);
    if (cell) setHover(drag.id,{x:+cell.dataset.x-drag.dx,y:+cell.dataset.y-drag.dy,o:drag.o});
    else clearHover();
    return;
  }
  if (e.pointerType!=='mouse' || activePage!=='bench' || document.querySelector('dialog[open]')) return;
  const cell=e.target.closest('.cell');
  if (cell && state.selected>=0 && occupiedAt(+cell.dataset.x,+cell.dataset.y)<0) {
    setHover(state.selected,{x:+cell.dataset.x,y:+cell.dataset.y,o:state.angles[state.selected]});
  } else clearHover();
});
function endDrag(e,cancel) {
  if (!drag || e.pointerId!==drag.pointer) return;
  const d=drag; drag=null;
  if (!d.moved) return;
  suppressClick=true; setTimeout(()=>{suppressClick=false;},0);
  if (d.button.hasPointerCapture(e.pointerId)) d.button.releasePointerCapture(e.pointerId);
  if (cancel) { clearHover(); render(); tell(baseText()); return; }
  const cell=cellBelow(e.clientX,e.clientY);
  clearHover();
  if (cell && trying) tryCell(+cell.dataset.x,+cell.dataset.y);
  else if (cell) placePane(d.id,{x:+cell.dataset.x-d.dx,y:+cell.dataset.y-d.dy,o:d.o});
  else if (state.slots[d.id] && document.elementFromPoint(e.clientX,e.clientY)?.closest('#pieces')) selectPane(d.id);
  else { render(); tell(baseText()); }
}
document.addEventListener('pointerup',e=>endDrag(e,false));
document.addEventListener('pointercancel',e=>endDrag(e,true));
$('hit-grid').addEventListener('focusin',e=>{
  if (!e.target.matches('.cell')) return;
  focusAt=+e.target.dataset.y*level.width + +e.target.dataset.x;
  els('hit-grid').forEach(b=>{b.tabIndex=b===e.target?0:-1;});
});
function moveFocus(dx,dy) {
  let x=focusAt%level.width,y=Math.floor(focusAt/level.width);
  do { x+=dx; y+=dy; } while (x>=0 && x<level.width && y>=0 && y<level.height && level.cells[y*level.width+x]==='.');
  const cell=$('hit-grid').querySelector('[data-x="'+x+'"][data-y="'+y+'"]') || $('hit-grid').querySelector('[tabindex="0"]');
  cell?.focus();
  if (cell && state.selected>=0 && occupiedAt(+cell.dataset.x,+cell.dataset.y)<0) setHover(state.selected,{x:+cell.dataset.x,y:+cell.dataset.y,o:state.angles[state.selected]});
  else clearHover();
}
document.addEventListener('keydown',e => {
  if (activePage!=='bench' || document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
  if (e.target.closest?.('input,select,textarea,summary')) return;
  const key=e.key.toLowerCase(), directions={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};
  if (directions[key]) { e.preventDefault(); moveFocus(...directions[key]); }
  else if (/^[1-6]$/.test(key) && Number(key)<=level.pieces.length) { e.preventDefault(); selectPane(Number(key)-1); $('hit-grid').querySelector('[tabindex="0"]')?.focus(); }
  else if (key==='r') { e.preventDefault(); orient(turn); }
  else if (key==='f' && level.flip) { e.preventDefault(); orient(flip); }
  else if (key==='z') { e.preventDefault(); undo(); }
});

function completedIn(chapter) { return levels.filter(l=>l.chapter===chapter && record(l)).length; }
function collectedLetters(l) {
  const done=record(l);
  if (!done) return [];
  if (!l.fork) return [{name:l.title,reply:l.reply}];
  return l.fork.routes.flatMap((r,i)=>(done.endings & (1<<i)) ? [{name:l.title+' · '+r.name,reply:r.reply}] : []);
}
function print(container,chapter,lit) {
  const src=art(chapter);
  container.style.setProperty('--unlit',(100-lit*25)+'%');
  container.innerHTML = '<img class="underprint" alt="" src="'+src+'"><img class="inkprint" alt="'+chapters[chapter].flower+'彩绘玻璃花窗" src="'+src+'">';
}
function showBook(chapter=level.chapter) {
  chapterOpen=chapter; setPage('book'); hover=null; drag=null;
  jacket(chapter);
  const volume=volumes.find(v=>v.chapters.includes(chapter));
  els('volumes').forEach((b,i)=>b.setAttribute('aria-pressed',String(volumes[i]===volume)));
  const full=chapters.filter((_,i)=>completedIn(i)===4).length, done=levels.filter(record).length;
  const medals=levels.filter(l=>record(l)?.gold).length;
  $('collection-count').textContent=done+' / '+levels.length+' 张试片　·　'+full+' / '+chapters.length+' 扇花窗　·　'+medals+' 枚金印';
  $('chapter-tabs').style.setProperty('--chapters',volume.chapters.length);
  $('chapter-tabs').innerHTML=volume.chapters.map(i=>'<button type="button" data-chapter="'+i+'" aria-pressed="'+(i===chapter)+'"><img src="'+art(i)+'" alt="">'+chapters[i].flower+'</button>').join('');
  const c=chapters[chapter], lit=completedIn(chapter);
  const entries=levels.filter(l=>l.chapter===chapter), letters=entries.flatMap(collectedLetters);
  const envelopeCount=entries.reduce((n,l)=>n+(l.fork?.routes.length || 1),0);
  print($('folio-print'),chapter,lit);
  $('flower-name').textContent=c.flower; $('latin').textContent=c.latin;
  $('chapter-title').textContent=c.name; $('chapter-count').textContent='已点亮 '+lit+' / 4';
  $('chapter-note').textContent=letters.length===envelopeCount?c.note:lit===4?'花窗已点亮。换一个信位，还能收到余下的 '+(envelopeCount-letters.length)+' 封回信。':
    c.intro || '每拼好一张试片，这扇花窗就多亮起四分之一。';
  $('level-list').innerHTML=entries.map(l=>{
    const done=record(l), saved=read('draft:'+l.id);
    const label=l.fork?'回信 '+collectedLetters(l).length+' / 2':done?(done.gold?'已获金印':'已入册'):(saved?'继续拼':'开始');
    return '<button type="button" class="level-row" data-index="'+l.index+'"><span class="level-no">'+number(l.index+1)+'</span><span class="level-name">'+l.title+'</span><span class="level-state">'+label+'</span>'+icon(done?.gold?'star':'next')+'</button>';
  }).join('');
  $('letters').hidden=!letters.length; $('letters').open=false;
  $('letters-title').textContent='重读回信 · '+letters.length+' / '+envelopeCount+' 封';
  $('letter-pages').innerHTML=letters.map(l=>'<h4>'+l.name+'</h4><p>'+l.reply+'</p>').join('');
}
$('volumes').onclick=e=>{const b=e.target.closest('[data-volume]'); if(b) showBook(volumes[+b.dataset.volume].chapters[0]);};
$('sequel').onclick=()=>{
  const resume=levels.find(l=>volumes[1].chapters.includes(l.chapter) && !record(l));
  showBook(resume?.chapter ?? volumes[1].chapters[0]);
  $('volumes').querySelector('[aria-pressed="true"]').focus({preventScroll:true});
  $('book').scrollIntoView({block:'start'});
};
$('chapter-tabs').onclick=e=>{ const b=e.target.closest('[data-chapter]'); if (b) { showBook(+b.dataset.chapter); $('chapter-tabs').querySelector('[aria-pressed="true"]').focus(); } };
$('level-list').onclick=e=>{ const b=e.target.closest('[data-index]'); if (b) { openLevel(levels[+b.dataset.index],true); window.scrollTo(0,0); } };
$('daily').onclick=()=>{ openLevel(dailyLevel(dateKey()),true); window.scrollTo(0,0); };
$('nav-bench').onclick=()=>{setPage('bench'); if(level.projection)lantern.cover();else jacket(level.chapter); render();};
$('brand').onclick=e=>{e.preventDefault(); $('nav-bench').click();};
$('nav-book').onclick=()=>showBook(chapterOpen);
const filmArt = id => './art/film-' + id + '.webp';
const enterNight=setupNight(chime,nightCover,filmArt);
function nightCover(edition) {
  const roll=edition==='roll';
  $('hero').classList.remove('is-letter','is-lantern','is-slip'); $('hero').classList.add('is-night');
  $('hero').classList.toggle('is-roll',roll);
  $('jacket').hidden=true; $('sequel').hidden=true;
  $('volume-name').textContent=roll?'Petal Panes · Contact Sheets':'Petal Panes · Night Shift';
  $('page-title').textContent=roll?'快门之间':'对窗夜班';
  $('hero-line').textContent=roll?'把两三次快门之间发生的小事，留在同一卷底片上。':'一人在窗里，一人在窗外，把两盏灯送到约好的地方。';
}
function showNight(edition) {
  setPage('night'); hover=null; drag=null; enterNight(edition);
}
$('nav-night').onclick=()=>showNight();
$('nav-night').hidden=false;
$('guide').onclick=()=>$(level.play?'slip-guide':level.projection?'lantern-guide':'guide-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>{b.onclick=()=>b.closest('dialog').close();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{
  if (e.target!==d) return;
  const r=d.getBoundingClientRect();
  if (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) d.close();
}));
function showResult() {
  const c=chapters[level.chapter], lit=completedIn(level.chapter);
  print($('result-print'),level.chapter,level.daily?4:lit);
  const gold = isGilded(level,state.slots);
  const ending=endingOf(level,state.slots);
  $('result-kicker').textContent=(level.daily?'每日委托':c.flower+' · 图纸 '+number(level.index+1))+(gold?'　✧ 金印':'');
  $('result-title').textContent=level.fork?'回信 · '+level.fork.routes[ending].name:level.daily?'今日花样已完成':lit===4?c.flower+'花窗已点亮':'一张试片，已入册';
  $('result-story').textContent=level.fork?level.fork.routes[ending].reply:level.reply;
  $('result-progress').textContent=level.daily?'今日图纸已收好。明天还会有新的切割花样。':
    c.flower+'花窗已点亮 '+lit+' / 4'+(level.gold!==null && !gold?'。重拼时，可把圆钉对准四角星收集金印。':'。');
  const last=level.index===levels.length-1;
  $('next').innerHTML=(level.daily?'回到故事图纸':last?'翻开花窗册':level.chapter===3 && levels[level.index+1].chapter===4?'翻开续篇':'下一张图纸')+icon('next');
  $('alternate').hidden=true;
  if (level.fork) {
    const other=1-ending, found=collectedLetters(level).length;
    $('result-progress').textContent+=' 本张已收到 '+found+' / 2 封回信。';
    if (found<2) {
      $('alternate').hidden=false;
      $('alternate').textContent='再拼「'+level.fork.routes[other].name+'」';
    }
  }
  $('result-book').hidden=last;
  $('retry-gold').hidden=level.gold===null || gold;
  $('result-dialog').showModal();
}
$('next').onclick=()=>{
  $('result-dialog').close();
  if (level.daily) openLevel(levels.find(l=>!record(l)) || levels[0],true);
  else if (level.index+1<levels.length) openLevel(levels[level.index+1]);
  else showBook(level.chapter);
  window.scrollTo(0,0);
};
$('result-book').onclick=()=>{ $('result-dialog').close(); showBook(level.chapter); window.scrollTo(0,0); };
$('retry-gold').onclick=()=>{ $('result-dialog').close(); $('reset').click(); $('pieces').querySelector('[aria-pressed="true"]')?.focus(); };
$('alternate').onclick=()=>{
  const nextRoute=1-endingOf(level,state.slots);
  $('result-dialog').close();
  commit(fresh(level)); preferRoute(nextRoute);
  const route=level.fork.routes[nextRoute];
  tell('这次找「'+route.name+'」的回信。让'+level.pieces[level.fork.pane].name+'背花落在 '+cellLabel(level,route.at)+'。');
  $('pieces').querySelector('[aria-pressed="true"]')?.focus();
};
const lastRoom=read('room');
function dayLevel() {
  const last=read('active');
  return last==='daily'?dailyLevel():levels.find(l=>l.id===last) || levels[0];
}
const slideArt = id => './art/slide-' + id + '.webp';
const slipArt = (id,layer) => './art/slip-' + id + '-' + layer + '.webp';
const clearStep=()=>{hint=null;lesson=null;trial=null;hover=null;render();};
const slips=setupSlips({art:slipArt,open:openLevel,slots:()=>state.slots,selected:()=>state.selected,deskState:()=>({state,history}),seat:placePane,repaint:paint,clearStep,tell,chime});
const lantern=setupLantern({art:slideArt,open:openLevel,day:()=>openLevel(dayLevel()),slots:()=>state.slots,
  clearStep,repaint:paint,tell,chime,slips});
chapterOpen=dayLevel().chapter;
function consumeEntry() {
  try { window.history.replaceState(null,'',location.href.split('#')[0]); } catch { /* The game also works on restricted file URLs. */ }
}
function openAfterlight() {
  const active=levels.find(l=>l.id===read('active'));
  const next=levels.find(l=>l.hasEtches && !record(l));
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  openLevel(active?.hasEtches && !record(active) ? active : next || levels.find(l=>l.hasEtches));
  window.scrollTo(0,0);
  // Consume the entry link so subsequent refreshes resume the pane on the table.
  consumeEntry();
}
if (location.hash==='#afterlight') openAfterlight();
else if (location.hash==='#lantern') {openLevel(lastShow());consumeEntry();}
else if (['#slips','#duets','#relay','#receipts','#folds'].includes(location.hash)) {openLevel(slipEntry());consumeEntry();}
else {
  const mode=read('bench:mode');openLevel(mode==='slips'?lastPlay():mode==='lantern'?lastShow():dayLevel());
  if(location.hash==='#nightshift' || location.hash==='#shutters') {
    showNight(location.hash==='#shutters'?'roll':'night'); consumeEntry();
  } else if(lastRoom==='night') showNight();
}
window.addEventListener('hashchange',()=>{
  if(location.hash==='#afterlight') openAfterlight();
  if(['#lantern','#slips','#duets','#relay','#receipts','#folds'].includes(location.hash)) {
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    openLevel(location.hash==='#lantern'?lastShow():slipEntry());consumeEntry();window.scrollTo(0,0);
  }
  if(location.hash==='#nightshift' || location.hash==='#shutters') {
    for(const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    showNight(location.hash==='#shutters'?'roll':'night'); consumeEntry(); window.scrollTo(0,0);
  }
});
function slipEntry(){
  if(location.hash==='#folds' || location.hash==='#receipts')return lastReceipt(location.hash==='#folds');
  return location.hash==='#slips'?lastPlay():lastDuet(location.hash==='#relay');
}
