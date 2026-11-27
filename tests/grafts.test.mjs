import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { cuttingsLeft, facingPage, freshGlass, gardenHint, glassGarden, herbarium, inspectGlass, specimen, takeCutting, tendGlass } from "../moon-mail/grafts.mjs";

const letter = letters.find(l => l.id === "glasshouse");
const day = glassGarden(letter, "standard"), night = glassGarden(letter, "expert");
const action = (type, fields) => ({type, ...fields});
function play(garden, state, moves) {
  for (const move of moves) {
    state = tendGlass(garden, state, move);
    assert.ok(state, JSON.stringify(move));
  }
  return state;
}
const bedside = [action("turn",{index:3}), action("press"), action("pick",{cell:2}), action("aim",{dir:0}), action("press")];

test("original lamp, buds, walls, mirror sites and mailbox stay in place on all three benches", () => {
  const easy = glassGarden(letter, "relaxed");
  assert.equal(day.board.tiles,letter.rows.join("")); assert.equal(easy.board.tiles,day.board.tiles);
  assert.equal(night.board.tiles,letter.expert.join(""));
  assert.equal(day.initial,day.board.initial); assert.equal(night.initial,night.board.initial);
  assert.equal(inspectGlass(easy, freshGlass(easy)).live.end,"ready");
  assert.notEqual(inspectGlass(day, freshGlass(day)).live.end,"ready");
});

test("the same two pressed flowers and the same glass make a one-edge shortcut or a nine-edge eastern branch", () => {
  const prefix = play(day, freshGlass(day), bedside);
  const short = play(day,prefix,[action("pick",{cell:20}),action("aim",{dir:3})]);
  const long = play(day,prefix,[action("pick",{cell:3}),action("aim",{dir:0})]);
  const a = specimen(day,short), b = specimen(day,long);
  assert.deepEqual(a.lengths,[8,1,1]); assert.deepEqual(b.lengths,[8,1,9]);
  assert.deepEqual(a.stems[2].cells,[20,14]);
  assert.deepEqual(b.stems[2].cells,[3,4,5,11,17,23,22,21,20,14]);
  assert.deepEqual(a.stems.slice(0,2),b.stems.slice(0,2));
  assert.equal(a.mask,b.mask); assert.notEqual(a.id,b.id);
  assert.equal(specimen(day,{...short,mask:short.mask ^ 2}).id,a.id);
  assert.ok(b.stems[0].cells.includes(20) && b.stems[2].cells.includes(20));
});

test("pressed mirrors stay fixed, used edges close in both directions, and pruning reopens precisely the last stem", () => {
  const first = play(day,freshGlass(day),bedside.slice(0,2));
  const view = inspectGlass(day,first);
  for (const i of [3,2,0]) assert.equal(tendGlass(day,first,action("turn",{index:i})),null);
  assert.deepEqual(view.sites.get(20),[0,3]);
  assert.ok(!view.sites.has(day.root.cell));
  const cut = play(day,first,[action("pick",{cell:20}),action("aim",{dir:0}),action("press")]);
  assert.equal(tendGlass(day,cut,action("turn",{index:4})),null);
  const pruned = tendGlass(day,cut,action("prune"));
  assert.equal(pruned.pins.length,1); assert.deepEqual(pruned.bud,{cell:20,dir:0});
  assert.ok(tendGlass(day,pruned,action("turn",{index:4})));
  assert.equal(tendGlass(day,pruned,action("aim",{dir:1})),null);
  assert.deepEqual(tendGlass(day,pruned,action("press")),cut);
});

// Independent grid walk. Try every compass bearing at every illuminated square,
// including impossible departures. Store each occupied edge in both directions.
function survey(garden) {
  const b=garden.board, wins=new Map();
  for (let mask=0;mask<2**b.mirrors.length;mask++) {
    function shoot(stage, start, d, paper, stems) {
      const nextPaper=new Set(paper), line=[start];
      let c=start;
      while (true) {
        const x=c%b.width+[1,0,-1,0][d], y=Math.floor(c/b.width)+[0,1,0,-1][d];
        if (x<0 || y<0 || x>=b.width || y>=b.height) return;
        const to=x+y*b.width, tile=b.tiles[to], edge=c+"-"+to;
        if (tile==="#" || to===b.source || nextPaper.has(edge)) return;
        nextPaper.add(edge); nextPaper.add(to+"-"+c);
        c=to; line.push(c);
        if (tile===["1","2","M"][stage]) break;
        if (tile==="M" || (!stage && tile==="2")) return;
        if ("AB".includes(tile)) d=(mask & (1<<b.mirrors.indexOf(c)) ? [1,0,3,2] : [3,2,1,0])[d];
      }
      const next=[...stems,line];
      if (stage===2) {
        const id=next.map(s=>s.join(".")).join("/");
        if (!wins.has(id)) wins.set(id,[]);
        wins.get(id).push(mask);
        return;
      }
      for (const cell of new Set(next.flat())) if (cell!==b.source) {
        for (let heading=0;heading<4;heading++) shoot(stage+1,cell,heading,nextPaper,next);
      }
    }
    shoot(0,b.source,">v<^".indexOf(b.tiles[b.source]),new Set(),[]);
  }
  return wins;
}

test("independent paper-and-grid enumeration verifies every daytime and night specimen at every mirror setting", () => {
  for (const [g,count] of [[day,7],[night,4]]) {
    const wins=survey(g), book=herbarium(g);
    assert.equal(wins.size,count); assert.equal(book.size,count);
    const footprints=new Set([...book.values()].map(p=>p.stems.flatMap(s=>[...s.edges]).sort().join("|")));
    assert.equal(footprints.size,count);
    for (const [id,masks] of wins) assert.deepEqual(book.get(id)?.masks,masks);
  }
  assert.ok([...herbarium(day).values()].every(s=>s.masks.includes(14)));
  const equalLength=[...herbarium(night).values()].filter(p=>p.stems.reduce((n,s)=>n+s.edges.size,0)===8);
  assert.equal(equalLength.length,2); assert.notDeepEqual(equalLength[0].buds[1],equalLength[1].buds[1]);
});

test("saved cuttings preserve their prefix and count only physically new endings", () => {
  const state=play(day,freshGlass(day),bedside);
  const a=specimen(day,play(day,state,[action("pick",{cell:20}),action("aim",{dir:3})]));
  const book=new Set([a.id]);
  assert.equal(cuttingsLeft(day,a.stems.slice(0,1),book),6);
  assert.equal(cuttingsLeft(day,a.stems.slice(0,2),book),3);
  for (const n of [1,2]) {
    const saved=takeCutting(a,n);
    assert.deepEqual(inspectGlass(day,saved).fixed,a.stems.slice(0,n));
    assert.equal(saved.bud,null);
  }
  assert.equal(cuttingsLeft(day,a.stems.slice(0,2),new Set(herbarium(day).keys())),0);
  for (const invalid of [null, {}, {...state,mask:-1}, {...state,pins:[day.root,null]}, {...state,bud:{cell:26,dir:3}},
    {...state,pins:[day.root,day.root,day.root]}, {...state,bud:{cell:2,dir:2}}]) assert.equal(inspectGlass(day,invalid),null);
});

test("each facing page has one physical impression and keeps the longest shared cutting when changing pages", () => {
  for (const [g,keep] of [[day,2],[night,1]]) {
    const plans=[...herbarium(g).values()];
    const ends=[0,1].map(page=>plans.filter(p=>facingPage(g,p)===page));
    assert.deepEqual(ends.map(bucket=>bucket.length),[1,1]);
    const [left,right]=ends.map(bucket=>bucket[0]);
    const shot=specimen(g,{mask:left.masks[0],pins:left.buds.slice(0,2),bud:left.buds[2]});
    const filed=new Set([shot.id]);
    assert.equal(cuttingsLeft(g,shot.stems.slice(0,keep),filed,1),1);
    let seed=takeCutting(shot,2);
    if (keep===1) assert.deepEqual(gardenHint(g,seed,filed,1),{type:"prune", retarget:true});
    for (let step=0;step<16;step++) {
      const move=gardenHint(g,seed,filed,1);
      if (move.type==="send") break;
      seed=play(g,seed,[move]);
    }
    assert.equal(specimen(g,seed)?.id,right.id);
  }
});

test("step hints find every as-yet unfiled pattern and suggest pruning a fully explored fork", () => {
  for (const g of [day,night]) {
    const book=new Set();
    for (const plan of herbarium(g).values()) {
      const others=new Set([...herbarium(g).keys()].filter(id=>id!==plan.id));
      let state=freshGlass(g), steps=0;
      while (++steps<25) {
        const move=gardenHint(g,state,others);
        if (move.type==="send") break;
        state=play(g,state,[move]);
      }
      assert.equal(specimen(g,state)?.id,plan.id);
      book.add(plan.id);
    }
    assert.equal(book.size,herbarium(g).size);
  }
  const state=play(day,freshGlass(day),bedside), prefix=inspectGlass(day,state).fixed;
  const filed=new Set([...herbarium(day).values()].filter(p=>p.stems[1].cells.join(".")===prefix[1].cells.join(".")).map(p=>p.id));
  assert.equal(filed.size,4);
  assert.deepEqual(gardenHint(day,state,filed),{type:"prune", explored:true});
  const pruned=tendGlass(day,state, action("prune"));
  assert.equal(gardenHint(day,pruned,filed).type,"pick");
});
