import { etchAt, sideBySide } from './puzzle.mjs';
import { icon } from './glass.mjs';

export const address = (x,y) => String.fromCharCode(65+x)+(y+1);
export const cellLabel = (level,at) => address(at%level.width,Math.floor(at/level.width));

// Status reflects a trial placement without recording it as an installed pane.
export function orderLines(level,slots,trial) {
  const marks=slots.map((p,i)=>etchAt(level,i,trial?.id===i ? trial.place : p));
  const lines=[];
  function line(symbol,text,matched,involved,pending) {
    const status=matched ? (involved?'试摆吻合':'已完成') : pending;
    lines.push('<li class="'+(matched?'met':'')+'">'+icon(symbol,16)+'<span>'+text+'</span><span class="goal-state">'+status+'</span></li>');
  }
  for (const [at,id] of level.rubbings) {
    line('flower',level.pieces[id].name+'背花 → '+cellLabel(level,at),marks[id]===at,trial?.id===id,'待对印');
  }
  for (const [a,b] of level.joints) {
    const ready=marks[a]!=null && marks[b]!=null;
    const waiting=ready?'须共一边':marks[a]!=null || marks[b]!=null?'等另一片':'待接枝';
    line('leaf',level.pieces[a].name+' ↔ '+level.pieces[b].name,sideBySide(level.width,marks[a],marks[b]),
      trial?.id===a || trial?.id===b,waiting);
  }
  if (level.fork) {
    const {pane,routes}=level.fork;
    const at=marks[pane], route=routes.find(r=>r.at===at);
    line('book',level.pieces[pane].name+'背花 → '+routes.map((r,i)=>(i+1)+'号 '+cellLabel(level,r.at)).join(' / '),
      Boolean(route),trial?.id===pane,at==null?'任选一处':'待对信位');
  }
  return lines.join('');
}

export function backIssue(level,slots,id,place,cells) {
  if (!level.hasEtches) return '';
  const piece=level.pieces[id], at=etchAt(level,id,place);
  for (const cell of cells) {
    const owner=level.rubbings.get(cell);
    if (owner!==undefined && owner!==id) return cellLabel(level,cell)+' 留给'+level.pieces[owner].name+'的背花。';
  }
  if (piece.rubbing!=null && piece.rubbing!==at) return piece.name+'的实心背花要对上 '+cellLabel(level,piece.rubbing)+' 的空心拓印。';
  if (level.fork?.pane===id && !level.fork.routes.some(r=>r.at===at)) {
    return '让'+piece.name+'的背花落在 '+level.fork.routes.map(r=>cellLabel(level,r.at)).join(' 或 ')+'，回信会随落点改变。';
  }
  for (const partner of level.neighbors[id]) {
    if (slots[partner] && !sideBySide(level.width,at,etchAt(level,partner,slots[partner]))) {
      return piece.name+'和'+level.pieces[partner].name+'的背花要上下或左右相邻。可以先试着旋转其中一片。';
    }
  }
  return '';
}
