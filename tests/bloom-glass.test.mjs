import test from 'node:test';
import assert from 'node:assert/strict';
import { levels, dailyLevel, dateKey } from '../bloom-glass/levels.mjs';
import { describe, fits, shapeAt, turn, flip, solve, suggest, isGilded, transform, sideBySide, endingOf } from '../bloom-glass/puzzle.mjs';
import { fresh, restore, save, record, award, read, write } from '../bloom-glass/save.mjs';

const saved=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
  getItem:k=>saved.get(k) ?? null, setItem:(k,v)=>saved.set(k,v)
}});

// Check the returned tiling independently of the solver's coverage masks.
function checkTiling(l, solution) {
  assert.ok(solution,l.id);
  const grid=l.cells.map(()=>-1);
  solution.forEach((p,i)=>{
    assert.ok(p.o < (l.flip?8:4));
    for (const [dx,dy] of shapeAt(l.pieces[i],p.o)) {
      const x=p.x+dx,y=p.y+dy,at=y*l.width+x;
      assert.ok(x>=0 && x<l.width && y>=0 && y<l.height);
      assert.notEqual(l.cells[at],'.');
      assert.equal(grid[at],-1);
      if(l.clues.has(at)) assert.equal(i,l.clues.get(at));
      grid[at]=i;
    }
  });
  l.cells.forEach((c,n)=>assert.equal(grid[n]===-1,c==='.'));
  for (const [a,b] of l.seams) assert.notEqual(grid[a],grid[b]);
  const marks=solution.map((p,i)=>{
    const offset=l.pieces[i].etch;
    if (!offset) return null;
    const [dx,dy]=transform(offset,p.o);
    return [p.x+dx,p.y+dy];
  });
  for (const [at,i] of l.rubbings) assert.deepEqual(marks[i],[at%l.width,Math.floor(at/l.width)]);
  for (const [a,b] of l.joints) {
    assert.equal(Math.abs(marks[a][0]-marks[b][0])+Math.abs(marks[a][1]-marks[b][1]),1);
  }
  if (l.fork) {
    const [x,y]=marks[l.fork.pane];
    assert.ok(l.fork.routes.some(r=>r.at===y*l.width+x));
  }
}
function checkConnected(l) {
  for (const p of l.pieces) {
    const points=new Set(p.cells.map(String)), queue=[[0,0]], seen=new Set(['0,0']);
    for(let n=0;n<queue.length;n++) {
      const [x,y]=queue[n];
      for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]) {
        const next=[x+dx,y+dy],key=String(next);
        if(points.has(key) && !seen.has(key)){seen.add(key);queue.push(next);}
      }
    }
    assert.equal(seen.size,points.size,l.id+' '+p.name);
  }
}

test('all 28 patterns use connected panes and can be finished with every optional gold seal',()=>{
  assert.equal(levels.length,28);
  assert.equal(levels.filter(l=>l.gold!==null).length,26);
  for (const l of levels) {
    checkConnected(l);
    const solution=solve(l,l.sample,l.gold!==null);
    checkTiling(l,solution);
    if(l.gold!==null) assert.equal(isGilded(l,solution),true);
  }
});

test('rotation and turning the glass over preserve its rivet and use screen coordinates',()=>{
  for(let o=0;o<8;o++) {
    assert.equal(turn(turn(turn(turn(o)))),o);
    assert.equal(flip(flip(o)),o);
    const [x,y]=transform([2,-1],o);
    assert.deepEqual(transform([2,-1],turn(o)),[-y,x]);
    assert.deepEqual(transform([2,-1],flip(o)),[-x,y]);
  }
  const lesson=levels[8];
  assert.equal(solve({...lesson,flip:false},lesson.sample),null,'The first flip lesson must require a flip.');
});

function placements(l,id) {
  const list=[];
  for(let o=0;o<(l.flip?8:4);o++) for(let y=0;y<l.height;y++) for(let x=0;x<l.width;x++) {
    const p={x,y,o}; if(describe(l,id,p)) list.push(p);
  }
  return list;
}

test('etchings and lead strips each exclude a geometrically fitting placement',()=>{
  const etched=levels[4], plain={...etched,clues:new Map()};
  assert.ok(etched.pieces.some((_,i)=>placements(plain,i).some(p=>!describe(etched,i,p))));
  for (const l of levels.filter(l=>l.seams.length)) {
    const withoutLead={...l,seams:[]};
    assert.ok(l.pieces.some((_,i)=>placements(withoutLead,i).some(p=>!describe(l,i,p))),l.id);
  }
});

test('a rubbing distinguishes two turns of a square that cover exactly the same cells',()=>{
  const l=levels[16], i=0, answer=solve(l,l.sample,true);
  const plain={...l,rubbings:new Map(),pieces:l.pieces.map(p=>({...p,rubbing:undefined}))};
  const target=describe(l,i,answer[i]);
  assert.ok(placements(plain,i).some(p=>{
    const other=describe(plain,i,p);
    return other.mask===target.mask && other.etch!==target.etch && !describe(l,i,p);
  }));
});

test('each vine requires a shared edge and rules out an otherwise complete cutting pattern',()=>{
  assert.equal(sideBySide(4,3,4),false);
  assert.equal(sideBySide(4,0,5),false);
  assert.equal(sideBySide(4,0,1),true);
  for(const l of levels.filter(l=>l.joints.length)) {
    for(const [a,b] of l.joints) {
      const neighbors=l.neighbors.map((list,id)=>list.filter(other=>!(id===a && other===b || id===b && other===a)));
      const loose={...l,neighbors,joints:l.joints.filter(([i,j])=>i!==a || j!==b)};
      const pairs=placements(loose,b);
      const example=placements(loose,a).some(p=>pairs.some(q=>{
        const slots=[...l.sample]; slots[a]=p; slots[b]=q;
        return !fits(l,slots,b,q) && fits(loose,slots,b,q) && Boolean(solve(loose,slots));
      }));
      assert.ok(example,l.id+' joint '+a+'–'+b);
    }
  }
});

test('each of the eight last-chapter replies has its own gilded tiling and directed hint path',()=>{
  const last=levels.filter(l=>l.fork);
  assert.equal(last.length,4);
  for(const l of last) {
    const paths=[0,1].map(route=>{
      const answer=solve(l,l.sample,true,route);
      checkTiling(l,answer);
      assert.equal(endingOf(l,answer),route);
      assert.ok(isGilded(l,answer));
      return answer;
    });
    // Changing the reply actually rearranges the window, beyond turning a decoration.
    const moved=paths[0].filter((p,i)=>describe(l,i,p).mask!==describe(l,i,paths[1][i]).mask).length;
    assert.ok(moved>=2,l.title);
    const slots=[...l.sample];
    slots[l.fork.pane]=paths[0][l.fork.pane];
    assert.equal(solve(l,slots,false,1),null);
    for(let steps=0;steps<l.pieces.length*3 && !slots.every(Boolean);steps++) {
      const step=suggest(l,slots,slots.findIndex(p=>!p),1);
      assert.ok(step);
      if(step.type==='lift') slots[step.id]=null;
      else { assert.ok(fits(l,slots,step.id,step.place)); slots[step.id]=step.place; }
    }
    checkTiling(l,slots); assert.equal(endingOf(l,slots),1);
    award(l,true,0); award(l,false,1); award(l,false,0);
    assert.equal(record(l).endings,3); assert.equal(record(l).gold,true);
    write('done:'+l.id,{id:l.id,gold:false,endings:1}); // A stale tab writes its own summary last.
    assert.equal(record(l).endings,3); assert.equal(record(l).gold,true);
  }
});

test('each sequel contract, including each reply, also has a genuine unstamped solution',()=>{
  for (const l of levels.filter(l=>l.tip)) {
    const routes=l.fork?[0,1]:[null];
    for (const route of routes) {
      // If a pane covers the seal away from its rivet, no later pane can earn it.
      const ordinary=l.pieces.some((_,id)=>!l.sample[id] && placements(l,id).some(p=>{
        const c=describe(l,id,p);
        if (c.gold || !(c.mask & (1n<<BigInt(l.gold))) || !fits(l,l.sample,id,p)) return false;
        const slots=[...l.sample]; slots[id]=p;
        const answer=solve(l,slots,false,route);
        return answer && !isGilded(l,answer);
      }));
      assert.ok(ordinary,l.title+' route '+route);
    }
  }
});

test('both plain and gilded completions are possible on the first gold challenge',()=>{
  const l=levels[2], copy={...l,gold:null};
  let plain=false;
  for(let i=0;i<l.pieces.length && !plain;i++) for(const p of placements(copy,i)) {
    const slots=[...l.sample]; slots[i]=p;
    const answer=solve(copy,slots);
    if(answer && !isGilded(l,answer)) { plain=true; break; }
  }
  assert.equal(plain,true);
  checkTiling(l,solve(l,l.sample,true));
});

test('hints continue from legal play, recover a dead end, and never overwrite another pane',()=>{
  let deadEnds=0;
  for(const l of levels) {
    const id=l.sample.findIndex(p=>!p);
    const opening=placements(l,id).find(p=>{
      const slots=[...l.sample]; slots[id]=p;
      return fits(l,l.sample,id,p) && !solve(l,slots);
    });
    let slots=[...l.sample];
    if(opening) {
      slots[id]=opening;
      assert.equal(suggest(l,slots,slots.findIndex(p=>!p)).type,'lift');
      deadEnds++;
    }
    for(let n=0;!slots.every(Boolean) && n<l.pieces.length*3;n++) {
      const step=suggest(l,slots,slots.findIndex(p=>!p)); assert.ok(step);
      if(step.type==='lift') { assert.ok(slots[step.id]); slots[step.id]=null; }
      else {
        assert.equal(slots[step.id],null);
        assert.ok(fits(l,slots,step.id,step.place));
        slots[step.id]=step.place;
      }
    }
    checkTiling(l,slots);
  }
  assert.ok(deadEnds>=8);
});

test('a full civil year of daily windows is deterministic, varied, connected and gildable',()=>{
  const cuts=new Set(), themes=new Set();
  for(let i=0;i<365;i++) {
    const key=dateKey(new Date(2026,0,i+1,12)), l=dailyLevel(key);
    assert.deepEqual(dailyLevel(key),l);
    cuts.add(l.cells.join('')); themes.add(l.chapter);
    checkConnected(l);
    const answer=solve(l,l.sample,true); checkTiling(l,answer); assert.ok(isGilded(l,answer));
  }
  assert.ok(cuts.size>350); assert.equal(themes.size,4);
  assert.equal(dateKey(new Date(2026,0,1,0,1)),'2026-01-01');
});

test('resume, undo history, malformed saves, retained gold, and daily rollover',()=>{
  const l=levels[3], start=fresh(l), step=suggest(l,start.slots,0);
  const slots=[...start.slots]; slots[step.id]=step.place;
  const state={...start,slots,selected:slots.findIndex(p=>!p)};
  save(l,state,[start]); assert.deepEqual(restore(l),{state,history:[start]});
  award(l,true); award(l,false); assert.equal(record(l).gold,true);
  const broken={...state,slots:state.slots.map(p=>p?{...p,x:500}:null)};
  save(l,broken,[]); assert.deepEqual(restore(l),{state:fresh(l),history:[]});
  const today=dailyLevel('2026-11-26'), tomorrow=dailyLevel('2026-11-27');
  save(today,fresh(today),[]); award(today,true);
  assert.deepEqual(restore(tomorrow),{state:fresh(tomorrow),history:[]}); assert.equal(record(tomorrow),null);
});

test('full browser storage keeps the latest in-session progress',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
      getItem:()=>JSON.stringify('old'),setItem:()=>{throw new Error('quota');}
    }});
    write('quota-test','new');
    assert.equal(read('quota-test'),'new');
  } finally {
    if(previous) Object.defineProperty(globalThis,'localStorage',previous);
    else delete globalThis.localStorage;
  }
});
