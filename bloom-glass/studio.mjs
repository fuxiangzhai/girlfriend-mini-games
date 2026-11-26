import { chapters, levels, dailyLevel, dateKey } from './levels.mjs';
import { turn, flip, shapeAt, fits, isGilded, suggest } from './puzzle.mjs';
import { icon, thumbnail, drawBoard } from './glass.mjs';
import { read, write, fresh, restore, save, record, award } from './save.mjs';

const $ = id => document.getElementById(id);
const els = id => Array.from($(id).children);
const chapterNumbers = ['一','二','三','四'];
const number = n => String(n).padStart(2,'0');
const address = (x,y) => String.fromCharCode(65 + x) + (y + 1);
const art = chapter => './art/' + chapters[chapter].art + '.webp';
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

let level, state, history, hint, hover, drag, lesson, focusAt, activePage = 'bench', chapterOpen = 0;
let suppressClick = false, soundOn = read('sound') !== false, audio;
function soundButton() {
  $('sound').innerHTML = icon(soundOn ? 'speaker' : 'mute');
  $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').title = soundOn ? '关闭工坊音效' : '打开工坊音效';
}
function chime(id = 0, complete = false) {
  if (!soundOn) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state !== 'running') void audio.resume().catch(() => {});
    const tone = [392,440,523.25,587.33,659.25,783.99][id] || 440;
    const notes = complete ? [523.25,659.25,783.99] : [tone];
    notes.forEach((hz,i) => {
      const start = audio.currentTime + .01 + i * .085, osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = hz; osc.type = 'sine';
      gain.gain.setValueAtTime(.001,start);
      gain.gain.exponentialRampToValueAtTime(.085,start + .008);
      gain.gain.exponentialRampToValueAtTime(.001,start + .46);
      osc.connect(gain).connect(audio.destination);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(start); osc.stop(start + .48);
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
  if (state.selected < 0) return '这张试片已拼好，可以查看成品或撤销再试。';
  if (lesson) return '叶青已选好。点虚线中的圆钉，嵌入第一片。';
  if (level.index === 2 && !isGilded(level,state.slots)) return '试着让一枚圆钉对准四角星，成品会得到金印。';
  if (level.index === 4) return '窗格上的花瓣刻纹，要用带花瓣标记的蔷薇玻璃覆盖。';
  if (level.index === 8) return '这次试试翻面。玻璃上的圆钉始终是落点。';
  if (level.index === 12) return '金边粗线是固定铅条，整块玻璃不能跨过它。';
  return '已选' + level.pieces[state.selected].name + '。点窗格放下圆钉，也可以先旋转。';
}
function commit(next) {
  history = [...history.slice(-39),state];
  state = next; hint = null; hover = null; lesson = null;
  save(level,state,history);
}
function preview() {
  if (hover) return hover;
  const ghost = hint?.type === 'place' ? hint : lesson;
  return ghost ? { ...ghost,valid:true } : null;
}
function paint() { drawBoard($('drawing'),level,state.slots,preview(),hint?.type === 'lift' ? hint.id : -1); }
function render() {
  const count = state.slots.filter(Boolean).length, done = count === level.pieces.length;
  $('counter').textContent = '已嵌 ' + count + ' / ' + level.pieces.length;
  $('turn').disabled = $('flip').disabled = done;
  $('undo').disabled = !history.length;
  $('reset').disabled = !history.length && !record(level) &&
    JSON.stringify(state.slots) === JSON.stringify(level.sample) && state.angles.every(o => !o);
  $('hint-label').textContent = done ? '查看成品' : hint ? (hint.type === 'place' ? '照提示嵌入' : '取回这片') : '看一步提示';
  els('pieces').forEach((btn,id) => {
    const p = level.pieces[id], placed = state.slots[id];
    btn.classList.toggle('is-set',Boolean(placed));
    btn.setAttribute('aria-pressed',String(state.selected === id));
    btn.setAttribute('aria-label',p.name + '玻璃，' + p.mark + '纹，' + (placed ? '已嵌入，点按取回' : '点按选择'));
    btn.innerHTML = thumbnail(p,placed?.o ?? state.angles[id],id) +
      (placed ? '<span class="check">'+icon('check')+'</span>' : '') + '<span class="piece-label">'+p.name+'</span>';
  });
  $('objective').hidden = level.gold === null;
  if (level.gold !== null) $('objective').innerHTML = icon('star') + (isGilded(level,state.slots) ? '圆钉已对准金印。' : '可选金印 · 让一枚圆钉压住四角星。');
  for (const cell of els('hit-grid')) {
    const x = +cell.dataset.x, y = +cell.dataset.y, at = y*level.width+x, id = occupiedAt(x,y);
    const text = [address(x,y), id < 0 ? '空格' : level.pieces[id].name+'玻璃，点按取回'];
    if (level.clues.has(at)) text.push(level.pieces[level.clues.get(at)].mark+'刻纹');
    if (at === level.gold) text.push('金印');
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
  $('bench').hidden = page !== 'bench'; $('book').hidden = page !== 'book';
  $('nav-bench').toggleAttribute('aria-current',page === 'bench');
  $('nav-book').toggleAttribute('aria-current',page === 'book');
  $(page === 'bench' ? 'nav-bench' : 'nav-book').setAttribute('aria-current','page');
}
function openLevel(target, showFinished = false) {
  level = target; ({ state, history } = restore(level));
  hint = null; hover = null; drag = null; lesson = null; chapterOpen = level.chapter;
  focusAt = level.cells.findIndex(c => c !== '.');
  if (level.index === 0 && !history.length && state.selected === 1 && state.slots.filter(Boolean).length === 1) {
    const step = suggest(level,state.slots,state.selected);
    if (step?.type === 'place') {
      lesson = step;
      state = { ...state, angles:state.angles.map((o,i) => i === step.id ? step.place.o : o) };
      focusAt = step.place.y * level.width + step.place.x;
    }
  }
  write('active',level.daily ? 'daily' : level.id);
  const chapter = chapters[level.chapter];
  $('chapter-label').textContent = level.daily ? '每日委托 · '+level.id.slice(4) :
    '第'+chapterNumbers[level.chapter]+'章 · '+chapter.flower+'　/　图纸 '+number(level.index+1);
  $('level-title').textContent = level.title;
  $('request').textContent = level.request; $('note-art').src = art(level.chapter);
  $('instruction').textContent = level.seams.length ? '同纹填刻槽，整片玻璃不能跨过金边铅条。' :
    level.clues.size ? '刻纹格要配同纹玻璃。点选或拖入窗框。' : '点选或拖动玻璃，圆钉对准想放的窗格。';
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
  if (state.slots.every(Boolean)) {
    award(level,isGilded(level,state.slots));
    if (showFinished) showResult();
  }
}
function selectPane(id) {
  const installed = state.slots[id];
  if (installed) {
    const angles = [...state.angles], slots = [...state.slots];
    angles[id] = installed.o; slots[id] = null;
    commit({angles,slots,selected:id});
  } else {
    state = { ...state, selected:id }; hint=null; lesson=null; hover=null; save(level,state,history);
  }
  render(); tell(installed ? '已取回'+level.pieces[id].name+'，可以重新嵌入。' : baseText());
}
function orient(fn) {
  const id = state.selected;
  if (id < 0) return;
  const angles = [...state.angles]; angles[id] = fn(angles[id]);
  commit({...state,angles}); render(); tell('已'+(fn===turn?'旋转':'翻面')+'。'+baseText());
}
function reject(id,place) {
  const points = shapeAt(level.pieces[id],place.o).map(([dx,dy])=>[place.x+dx,place.y+dy]);
  if (points.some(([x,y])=>x<0 || x>=level.width || y<0 || y>=level.height || level.cells[y*level.width+x]==='.')) {
    tell('有玻璃伸出了窗框。试着换个落点或转一面。'); return;
  }
  if (points.some(([x,y])=>level.clues.has(y*level.width+x) && level.clues.get(y*level.width+x)!==id)) {
    tell('这片玻璃与窗格的刻纹不同。找找托盘里相同的花纹。'); return;
  }
  const taken=new Set(points.map(([x,y])=>y*level.width+x));
  if (level.seams.some(([a,b])=>taken.has(a)&&taken.has(b))) {
    tell('金边的铅条隔开了这两格。这片玻璃得完整地放在铅条一侧。'); return;
  }
  tell('这里已经嵌了玻璃。换个位置，或先取回挡住的那片。');
}
function placePane(id,place) {
  if (!fits(level,state.slots,id,place)) { reject(id,place); return; }
  const slots = [...state.slots], angles = [...state.angles];
  slots[id] = place; angles[id] = place.o;
  commit({ slots,angles, selected:slots.findIndex(p=>!p) });
  const done = slots.every(Boolean);
  if (done) award(level,isGilded(level,slots));
  render(); chime(id,done);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const spark = document.createElement('span');
    spark.className = 'seat-ring';
    spark.style.left = (place.x+.5)/level.width*100+'%';
    spark.style.top = (place.y+.5)/level.height*100+'%';
    $('board').append(spark);
    setTimeout(()=>spark.remove(),460);
  }
  if (done) { tell('试片已入册。'); showResult(); }
  else tell(level.pieces[id].name+'已嵌入。接下来是'+level.pieces[state.selected].name+'。');
}
function guidedPlace(id,x,y) {
  const step = hint?.type === 'place' ? hint : lesson;
  if (step?.id !== id) return null;
  const {place} = step;
  return shapeAt(level.pieces[id],place.o).some(([dx,dy])=>place.x+dx===x && place.y+dy===y) ? place : null;
}
function onCell(x,y) {
  focusAt = y*level.width+x;
  const id = occupiedAt(x,y);
  if (id >= 0) { selectPane(id); return; }
  if (state.selected >= 0) placePane(state.selected,guidedPlace(state.selected,x,y) || {x,y,o:state.angles[state.selected]});
}
function undo() {
  if (!history.length) return;
  state = history[history.length-1]; history=history.slice(0,-1);
  hint=null; lesson=null; hover=null; save(level,state,history); render(); tell('已撤销上一步。'+baseText());
}
function showHint() {
  if (state.slots.every(Boolean)) { showResult(); return; }
  if (hint) {
    if (hint.type === 'lift') selectPane(hint.id);
    else placePane(hint.id,hint.place);
    return;
  }
  hint = suggest(level,state.slots,state.selected); hover=null; lesson=null;
  if (!hint) return;
  const { id,place } = hint;
  if (hint.type === 'lift') tell('这片'+level.pieces[id].name+'挡住了余下的拼法。先把红色虚线那片取回。');
  else {
    state = {...state,selected:id,angles:state.angles.map((o,i)=>i===id?place.o:o)};
    save(level,state,history);
    tell('试试'+level.pieces[id].name+'，方向已对好。把圆钉放到 '+address(place.x,place.y)+' 的亮圈。');
  }
  render();
}
$('turn').onclick = () => orient(turn); $('flip').onclick = () => orient(flip);
$('undo').onclick = undo; $('hint').onclick = showHint;
$('reset').onclick = () => { commit(fresh(level)); render(); tell('图纸已铺好，可以重新拼。'+baseText()); };
$('pieces').onclick = e => { const b=e.target.closest('.piece'); if (b && !suppressClick) selectPane(+b.dataset.id); };
$('hit-grid').onclick = e => { const b=e.target.closest('.cell'); if (b && !suppressClick) onCell(+b.dataset.x,+b.dataset.y); };

function cellBelow(x,y) { return document.elementFromPoint(x,y)?.closest('#hit-grid .cell'); }
function setHover(id,place) {
  if (!drag?.moved) place = guidedPlace(id,place.x,place.y) || place;
  if (hover?.id===id && hover.place.x===place.x && hover.place.y===place.y && hover.place.o===place.o) return;
  hover = {id,place,valid:fits(level,state.slots,id,place)}; paint();
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
      hint=null; lesson=null;
      if (!state.slots[drag.id]) {
        state={...state,selected:drag.id};
        save(level,state,history);
        els('pieces').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===drag.id)));
      }
      $('hint-label').textContent='看一步提示';
      tell('拖动'+level.pieces[drag.id].name+'，在窗格上松开即可嵌入。');
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
  if (cell) placePane(d.id,{x:+cell.dataset.x-d.dx,y:+cell.dataset.y-d.dy,o:d.o});
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
  const key=e.key.toLowerCase(), directions={arrowleft:[-1,0],arrowright:[1,0],arrowup:[0,-1],arrowdown:[0,1]};
  if (directions[key]) { e.preventDefault(); moveFocus(...directions[key]); }
  else if (/^[1-6]$/.test(key) && Number(key)<=level.pieces.length) { e.preventDefault(); selectPane(Number(key)-1); $('hit-grid').querySelector('[tabindex="0"]')?.focus(); }
  else if (key==='r') { e.preventDefault(); orient(turn); }
  else if (key==='f' && level.flip) { e.preventDefault(); orient(flip); }
  else if (key==='z') { e.preventDefault(); undo(); }
});

function completedIn(chapter) { return levels.filter(l=>l.chapter===chapter && record(l)).length; }
function print(container,chapter,lit) {
  const src=art(chapter);
  container.style.setProperty('--unlit',(100-lit*25)+'%');
  container.innerHTML = '<img class="underprint" alt="" src="'+src+'"><img class="inkprint" alt="'+chapters[chapter].flower+'彩绘玻璃花窗" src="'+src+'">';
}
function showBook(chapter=level.chapter) {
  chapterOpen=chapter; setPage('book'); hover=null; drag=null;
  const full=chapters.filter((_,i)=>completedIn(i)===4).length, done=levels.filter(record).length;
  const medals=levels.filter(l=>record(l)?.gold).length;
  $('collection-count').textContent=done+' / 16 张试片　·　'+full+' / 4 扇花窗　·　'+medals+' 枚金印';
  $('chapter-tabs').innerHTML=chapters.map((c,i)=>'<button type="button" data-chapter="'+i+'" aria-pressed="'+(i===chapter)+'"><img src="'+art(i)+'" alt="">'+c.flower+'</button>').join('');
  const c=chapters[chapter], lit=completedIn(chapter);
  print($('folio-print'),chapter,lit);
  $('flower-name').textContent=c.flower; $('latin').textContent=c.latin;
  $('chapter-title').textContent=c.name; $('chapter-count').textContent='已点亮 '+lit+' / 4';
  $('chapter-note').textContent=lit===4?c.note:'每拼好一张试片，这扇花窗就多亮起四分之一。';
  $('level-list').innerHTML=levels.filter(l=>l.chapter===chapter).map(l=>{
    const done=record(l), saved=read('draft:'+l.id);
    const label=done?(done.gold?'已获金印':'已入册'):(saved?'继续拼':'开始');
    return '<button type="button" class="level-row" data-index="'+l.index+'"><span class="level-no">'+number(l.index+1)+'</span><span class="level-name">'+l.title+'</span><span class="level-state">'+label+'</span>'+icon(done?.gold?'star':'next')+'</button>';
  }).join('');
  const letters=levels.filter(l=>l.chapter===chapter && record(l));
  $('letters').hidden=!letters.length; $('letters').open=false;
  $('letters-title').textContent='重读回信 · '+letters.length+' 封';
  $('letter-pages').innerHTML=letters.map(l=>'<h4>'+l.title+'</h4><p>'+l.reply+'</p>').join('');
}
$('chapter-tabs').onclick=e=>{ const b=e.target.closest('[data-chapter]'); if (b) { showBook(+b.dataset.chapter); $('chapter-tabs').querySelector('[aria-pressed="true"]').focus(); } };
$('level-list').onclick=e=>{ const b=e.target.closest('[data-index]'); if (b) { openLevel(levels[+b.dataset.index],true); window.scrollTo(0,0); } };
$('daily').onclick=()=>{ openLevel(dailyLevel(dateKey()),true); window.scrollTo(0,0); };
$('nav-bench').onclick=()=>{setPage('bench'); render();};
$('brand').onclick=e=>{e.preventDefault(); $('nav-bench').click();};
$('nav-book').onclick=()=>showBook(chapterOpen);
$('guide').onclick=()=>$('guide-dialog').showModal();
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
  $('result-kicker').textContent=(level.daily?'每日委托':c.flower+' · 图纸 '+number(level.index+1))+(gold?'　✧ 金印':'');
  $('result-title').textContent=level.daily?'今日花样已完成':lit===4?c.flower+'花窗已点亮':'一张试片，已入册';
  $('result-story').textContent=level.reply;
  $('result-progress').textContent=level.daily?'今日图纸已收好。明天还会有新的切割花样。':
    c.flower+'花窗已点亮 '+lit+' / 4'+(level.gold!==null && !gold?'。重拼时，可把圆钉对准四角星收集金印。':'。');
  const last=level.index===levels.length-1;
  $('next').innerHTML=(level.daily?'回到故事图纸':last?'翻开花窗册':'下一张图纸')+icon('next');
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
const last=read('active');
openLevel(last==='daily'?dailyLevel():levels.find(l=>l.id===last) || levels[0]);
