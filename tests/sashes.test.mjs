import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { trace } from "../moon-mail/puzzle.mjs";
import { adjustWindow, orderMatches, packWindow, prepareSashes, reopenSetting, restoreAdjustments, unpackWindow, windowHint, windowJourney, windowSetting } from "../moon-mail/sashes.mjs";

const station = letters.find(station => station.id === "dawn");
const modes = ["standard","expert"];
const benches = new Map(modes.map(mode => [mode,prepareSashes(station,mode)]));

// Lay the physical pieces directly onto the printed chart and follow the beam
// through each square. No game move generator, ray tracer or solver is used.
function physicalChart(rows, night, x, y, tilts) {
  const w = rows[0].length, cells = [...rows.join("")], all = [];
  cells.forEach((tile,i) => { if (tile === "A" || tile === "B") all.push(i); });
  const h = night ? [8,14] : [14], v = night ? [20] : [22,23];
  const singles = all.filter(i => !h.includes(i) && !v.includes(i));
  for (const i of all) cells[i] = ".";
  for (const [g,group] of [h,v,...singles.map(i=>[i])].entries()) for (const origin of group) {
    const nx = origin%w + (g === 0 ? x : 0), ny = Math.floor(origin/w) + (g === 1 ? y : 0);
    if (nx<0 || nx>=w || ny<0 || ny>=rows.length || cells[ny*w+nx] !== ".") return null;
    const side = rows[Math.floor(origin/w)][origin%w] === "B";
    cells[ny*w+nx] = side !== Boolean((1<<g)&tilts) ? "\\" : "/";
  }
  return cells;
}
function takeLight(cells,w) {
  const gates = cells.flatMap((v,i)=>v==="@"?[i]:[]), seals = new Set(), visited = new Set();
  let cell = cells.findIndex(v=>">v<^".includes(v));
  const origin = cell, tracks=[[cell]], dir = [[1,0],[0,1],[-1,0],[0,-1]][">v<^".indexOf(cells[cell])];
  let [dx,dy] = dir;
  for (;;) {
    const x=cell%w+dx, y=Math.floor(cell/w)+dy, n=y*w+x;
    if (x<0 || x>=w || n<0 || n>=cells.length || cells[n]==="#" || n===origin) return null;
    const k=[n,dx,dy].join();
    if (visited.has(k)) return null;
    visited.add(k); cell=n; tracks.at(-1).push(n);
    switch(cells[n]) {
      case "*": seals.add(n); break;
      case "M": return seals.size === 2 ? {tracks, first:[...seals][0]} : null;
      case "/": [dx,dy]=[-dy,-dx]; break;
      case "\\": [dx,dy]=[dy,dx]; break;
      case "@": cell=gates.find(g=>g!==cell); tracks.push([cell]); break;
    }
  }
}

test("all 4,096 reachable window settings agree with an independent pane placement and ray walk on the original two maps", () => {
  for (const mode of modes) {
    const b=benches.get(mode), night=mode==="expert", rows=night?station.expert:station.rows;
    assert.equal(b.original.tiles,rows.join(""));
    assert.equal(b.masks.length*b.poses.length,night?1792:2304);
    const positions=new Set(["0,0"]);
    for (const key of positions) {
      const [x,y]=key.split(",").map(Number);
      for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) if (physicalChart(rows,night,nx,ny,0)) positions.add([nx,ny].join());
    }
    assert.deepEqual(positions,new Set(b.poses.map(p=>[p.x,p.y].join())));
    const actualShapes=new Set();
    for (let s=0;s<b.masks.length*b.poses.length;s++) {
      const setting=windowSetting(b,s), {x,y,tilts}=setting, cells=physicalChart(rows,night,x,y,tilts);
      const expected=takeLight(cells,b.original.width), trip=windowJourney(setting.board,trace(setting.board,setting.mask));
      if (!expected) { assert.equal(trip,null); continue; }
      assert.deepEqual(trip.tracks,expected.tracks); assert.equal(trip.first,expected.first);
      assert.equal(trip.steps,expected.tracks.flat().length-expected.tracks.length);
      actualShapes.add(trip.id);
    }
    assert.deepEqual(actualShapes,new Set(b.routes.keys()));
    assert.equal(actualShapes.size,night?10:13);
  }
});

test("frames move one notch at a time, tilt every member together and jam when either pane meets an obstruction", () => {
  for (const [mode,b] of benches) {
    const rows=mode==="expert"?station.expert:station.rows;
    let coupledStops=0;
    for (let p=0;p<b.poses.length;p++) {
      const start=p*b.masks.length, before=windowSetting(b,start);
      for (let a=0;a<4;a++) {
        const [dx,dy]=[[-1,0],[1,0],[0,-1],[0,1]][a];
        const expected=physicalChart(rows,mode==="expert",before.x+dx,before.y+dy,0);
        const s=adjustWindow(b,start,a);
        assert.equal(s===null,expected===null);
        if (s===null) { if (b.frames[Math.floor(a/2)].length===2) coupledStops++; continue; }
        assert.equal(adjustWindow(b,s,a^1),start);
        const after=windowSetting(b,s);
        before.board.mirrors.forEach((cell,i)=>assert.equal(after.board.mirrors[i],cell+(b.frames[Math.floor(a/2)].includes(i)?dx+dy*b.original.width:0)));
      }
      for (const [g,group] of b.groups.entries()) {
        const after=windowSetting(b,adjustWindow(b,start,g+4));
        assert.deepEqual(after.board.mirrors,before.board.mirrors);
        assert.equal(after.mask^before.mask,group.reduce((mask,i)=>mask|1<<i,0));
      }
    }
    assert.ok(coupledStops);
  }
});

test("breakfast notes require different physical deliveries, including both cup orders on the day dish", () => {
  for (const [mode,b] of benches) {
    const dishes=[...b.routes.values()];
    for (const note of b.orders) assert.ok(dishes.some(trip=>orderMatches(b,trip,note) && b.orders.every(other=>other===note || !orderMatches(b,trip,other))));
    assert.equal(b.shortest,mode==="expert"?16:13); assert.equal(b.longest,mode==="expert"?22:21);
    assert.equal(dishes.filter(trip=>orderMatches(b,trip,"tide")).length,1);
    assert.equal(new Set(dishes.map(trip=>trip.tracks[0].at(-1))).size,2);
    if (mode==="standard") {
      assert.equal(Math.min(...dishes.filter(trip=>orderMatches(b,trip,"amber")).map(trip=>trip.steps)),15);
      assert.ok(dishes.filter(trip=>trip.steps===13).every(trip=>trip.first===b.original.marks[1]));
    }
  }
});

test("hints for every chart, individual coaster and request shorten the true edit distance by exactly one", () => {
  for (const b of benches.values()) {
    const size=b.poses.length*b.masks.length;
    const edges=Array.from({length:size},(_,s)=>Array.from({length:b.groups.length+4},(_,a)=>adjustWindow(b,s,a)).filter(n=>n!==null));
    const all=new Set(b.routes.keys()), goals=[all,...[...all].map(id=>new Set([id])),
      ...b.orders.map(note=>new Set([...b.routes.values()].filter(trip=>orderMatches(b,trip,note)).map(trip=>trip.id)))];
    for (const allowed of goals) {
      const queue=b.winners.filter(w=>allowed.has(w.id)).map(w=>w.state);
      const dist=new Int16Array(size).fill(-1);
      queue.forEach(s=>{dist[s]=0;});
      for (const from of queue) for (const to of edges[from]) if (dist[to]<0) {dist[to]=dist[from]+1;queue.push(to);}
      assert.equal(queue.length,size);
      for (let s=0;s<size;s++) {
        const a=windowHint(b,s,allowed);
        if (!dist[s]) assert.equal(a,null);
        else assert.equal(dist[adjustWindow(b,s,a)],dist[s]-1);
      }
    }
  }
});

test("every filed setting can be reopened from the same window and undone, while malformed drafts and impossible offsets are rejected", () => {
  for (const b of benches.values()) {
    for (let s=0;s<b.poses.length*b.masks.length;s++) {
      assert.equal(unpackWindow(b,packWindow(b,s)),s);
      const path=reopenSetting(b,s);
      assert.equal(restoreAdjustments(b,path),s);
      if (path.length) assert.equal(adjustWindow(b,restoreAdjustments(b,path.slice(0,-1)),path.at(-1)),s);
    }
    for (const value of [null,"0",{},[0,0],[0,0,-1],[0,0,b.masks.length],[0,0,"1"],[1.1,0,0],[10,0,0]]) assert.equal(unpackWindow(b,value),null);
    for (const value of [null,{},[4,500],[0.1],["4"]]) assert.equal(restoreAdjustments(b,value),null);
    assert.equal(restoreAdjustments(b,[]),0);
  }
  assert.deepEqual([...prepareSashes(station,"relaxed").routes.keys()],[...benches.get("standard").routes.keys()]);
});
