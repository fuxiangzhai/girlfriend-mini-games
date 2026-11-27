import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { chairStudio, freshRoom, pushes, stageAction, replayChairs, pushOption, frameOption, portraitStyle,
  portraitId, endings, chairAdvice, retakePoint } from "../moon-mail/chair-portraits.mjs";

const letter=letters.find(s=>s.id==="windowprint");
const day=chairStudio(letter,"standard"), night=chairStudio(letter,"expert");

// Walk the photographer one square at a time. Free steps, passages and
// shutters close each cost layer before pushing into the next one.
function physicalRolls(room) {
  const {tiles,width,height}=room.board, camera=tiles.indexOf("M");
  const floors=c=>c>=0 && c<tiles.length && !["#","A"].includes(tiles[c]);
  const seats=c=>floors(c) && !"M@<>^v".includes(tiles[c]);
  const offsets=[[1,0],[0,1],[-1,0],[0,-1]];
  const step=(c,[dx,dy])=>{
    const x=c%width+dx, y=Math.floor(c/width)+dy;
    return x>=0 && x<width && y>=0 && y<height ? y*width+x : -1;
  };
  let bucket=[[room.board.source,...room.initial,[]]];
  const seen=new Set(), outputs=new Map();
  for (let cost=0; cost<=room.limit; cost++) {
    const next=[];
    for (let i=0;i<bucket.length;i++) {
      const [p,a,b,neg]=bucket[i], key=[p,a,b,...neg].join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      const dx=Math.abs(a%width-b%width),dy=Math.abs(Math.floor(a/width)-Math.floor(b/width));
      if (p===camera) {
        if (!neg.length && "abcd".includes(tiles[a]) && dx+dy>=3) bucket.push([p,a,b,[a]]);
        if (neg.length===1 && dx+dy===2 && (dx===0||dy===0) && seats((a+b)/2)) bucket.push([p,a,b,[...neg,b]]);
        if (neg.length===2 && dx+dy===1) {
          const id=[...neg,a].join("-");
          if (!outputs.has(id)) outputs.set(id,cost);
        }
      }
      for (const vector of offsets) {
        const to=step(p,vector);
        if (!floors(to)) continue;
        if (to!==a && to!==b) {bucket.push([to,a,b,neg]);continue;}
        const active=neg.length%2===0 ? a : b;
        const beyond=step(to,vector);
        if (to===active && seats(beyond) && beyond!==a && beyond!==b && cost<room.limit)
          next.push([to,active===a?beyond:a,active===b?beyond:b,neg]);
      }
      if (tiles[p]==="@") bucket.push([room.board.gates.find(c=>c!==p),a,b,neg]);
    }
    bucket=next;
  }
  return outputs;
}

test("walking the two original darkrooms square by square reproduces every photograph and its minimum push count",()=>{
  for (const [room,rows,total] of [[day,letter.rows,8],[chairStudio(letter,"relaxed"),letter.rows,8],[night,letter.expert,2]]) {
    assert.equal(room.board.tiles,rows.join(""));
    const independent=physicalRolls(room);
    assert.equal(independent.size,total);assert.equal(room.catalog.size,total);
    for(const [id,cost] of independent) assert.equal(room.catalog.get(id)?.count,cost,id);
  }
});

test("one daylight negative admits a direct nudge, a right-angle approach and a move to the far side",()=>{
  const firstTwo="UR!D!";
  const films=["L!","LUL!","LULLD!"].map(end=>replayChairs(day,firstTwo+end));
  assert.deepEqual(films.map(f=>f.frames.slice(0,2).map(frame=>frame.seats)),Array(3).fill([[15,7],[15,13]]));
  assert.deepEqual(films.map(f=>f.seats),[[14,13],[7,13],[12,13]]);
  assert.deepEqual(films.map(portraitStyle),["near","turn","far"]);
  assert.deepEqual(films.map(f=>f.count),[4,6,8]);
  const detour=replayChairs(day,"UR!D!UDL!");
  assert.equal(portraitId(detour),portraitId(films[0]));assert.equal(detour.count,6);
});

test("the night gap cannot be filled directly, but both equally short endings share the walk up to the last push",()=>{
  const mid=replayChairs(night,"LL!R!");
  assert.equal(mid.seats[0],14);assert.equal(mid.seats[1],2);
  const blocked=pushOption(night,mid,3);
  assert.equal(blocked.to,8);assert.equal(blocked.reason,"stand");assert.equal(blocked.walk,null);
  const outcomes=["R!","U!"].map(end=>replayChairs(night,"LL!R!LU"+end));
  assert.deepEqual(outcomes.map(f=>f.count),[6,6]);
  assert.deepEqual(outcomes.map(f=>f.seats),[[8,2],[1,2]]);
});

test("each exposed frame can be restored exactly, and every suggested walk has a clear path to a real pushing side or shutter",()=>{
  let passages=0;
  for (const room of [day,night]) for (const film of room.catalog.values()) {
    let state=freshRoom(room);
    for (const action of film.code) {
      const option=action==="!" ? frameOption(room,state) : pushOption(room,state,pushes.indexOf(action));
      assert.equal(option.reason,null);assert.equal(option.walk[0],state.walker);
      assert.equal(option.walk.at(-1),action==="!" ? room.camera : option.behind);
      option.walk.forEach((c,i)=>{
        assert.ok(room.walkable[c]&&!state.seats.includes(c));
        if (i && !room.next[c].includes(option.walk[i-1])) {passages++;assert.deepEqual(new Set([c,option.walk[i-1]]),new Set(room.board.gates));}
      });
      state=stageAction(room,state,action);
    }
    for(const frame of film.frames) {
      const restored=replayChairs(room,film.code.slice(0,frame.end));
      assert.deepEqual(restored.seats,frame.seats);assert.equal(restored.count,frame.count);assert.equal(restored.walker,room.camera);
    }
    assert.equal(stageAction(room,film,"R"),null);
  }
  assert.ok(passages>0);
  for(const bad of [null,{},12,"!","UR?","UR!D!L!!","R".repeat(20)]) assert.equal(replayChairs(day,bad),null);
});

test("retakes conserve both shots and spent pushes and choose the latest shutter with a distinct reachable ending",()=>{
  for(const room of [day,night]) for(const film of room.catalog.values()) {
    for(const owned of [[],[...room.catalog.keys()]]) {
      const fork=retakePoint(room,film,owned), restored=replayChairs(room,fork.code);
      assert.notEqual(fork.id,portraitId(film));
      assert.equal(restored.frames.length,fork.frame);assert.ok(endings(room,restored).has(fork.id));
      if(fork.frame<2) {
        const after=replayChairs(room,film.code.slice(0,film.frames[fork.frame].end));
        assert.ok([...endings(room,after).keys()].every(id=>id===portraitId(film)));
      }
    }
  }
});

test("hints can recover a dead-end and lead to the requested style within the edition's actual allowance",()=>{
  for (const room of [day,night]) {
    const second=room===day ? "UR!D!" : "LL!R!";
    const stuck=replayChairs(room,second+"R");
    assert.equal(endings(room,stuck).size,0);
    const rescue=chairAdvice(room,stuck,"turn");
    assert.equal(rescue.keep,second.length);
    assert.equal(rescue.token,"L");
    const restored=replayChairs(room,stuck.code.slice(0,rescue.keep));
    assert.deepEqual(restored.frames,stuck.frames);
    assert.ok(endings(room,stageAction(room,restored,rescue.token)).has(rescue.id));
    const styles=[...new Set([...room.catalog.values()].map(portraitStyle))];
    for (const target of styles) for (const start of [freshRoom(room),...room.catalog.values()]) {
      let s=start;
      for (let i=0;i<room.limit+5;i++) {
        if (portraitStyle(s)===target) break;
        const h=chairAdvice(room,s,target);
        assert.ok(h);
        if (h.keep<s.code.length) {
          assert.ok(![...endings(room,s).values()].some(f=>portraitStyle(f)===target));
          s=replayChairs(room,s.code.slice(0,h.keep));
        } else s=stageAction(room,s,h.token);
      }
      assert.equal(portraitStyle(s),target);
    }
  }
});
