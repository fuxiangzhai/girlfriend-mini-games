import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { dryingRack, freshPress, dose, validSheet, reclip, pressHint, companion } from "../moon-mail/sunprints.mjs";

const terrace = letters.find(letter => letter.id === "kelpprint");
const day = dryingRack(terrace,"standard"), night = dryingRack(terrace,"expert");
const color = (pose, cell) => Number(!pose.fronds.some(f => f.cells.includes(cell)));

test("each clip is on the original chart and each sampling point stays on its side of the frame", () => {
  for (const [i,rack] of [day,night].entries()) {
    assert.equal(rack.board.tiles, (i ? terrace.expert : terrace.rows).join(""));
    for (const mounts of rack.mounts) for (const f of mounts.values()) {
      assert.ok(rack.board.mirrorAt.has(f.peg));
      assert.ok(f.cells.length>=3 && f.cells.includes(f.peg));
      assert.ok(f.cells.every(c => c>=0 && c<rack.board.tiles.length && rack.board.tiles[c]!=="#"));
      assert.deepEqual([...f.cells].sort((a,b)=>a-b),
        Array.from(rack.board.tiles,(_,c)=>c).filter(c => (f.mask >>> c)&1));
    }
  }
  assert.deepEqual(day.mounts[0].get("25R").cells,[25,19,20,15,16,10]);
  assert.deepEqual(day.mounts[1].get("26L").cells,[26,20,15,16,10,19,18]);
  for (const m of ["relaxed","standard","expert"]) assert.ok(validSheet(dryingRack(terrace,m),freshPress(m)));
});

test("an independent two-exposure census counts tones over whole sheets, regardless of exposure order", () => {
  for (const [i,rack] of [day,night].entries()) {
    const outcomes=new Set();
    for (const a of rack.poses.values()) for (const b of rack.poses.values()) {
      const colors=Array.from(rack.board.tiles,(_,c)=>color(a,c)+color(b,c));
      const shared=a.fronds.filter((f,i)=>f.id===b.fronds[i].id).length;
      const expected=shared===1 && rack.sensors.every((c,i)=>colors[c]===rack.targets[i])
        && colors.includes(1);
      const proof=rack.proofs.get(a.id+"~"+b.id);
      assert.equal(Boolean(proof),expected);
      if (!expected) continue;
      assert.deepEqual(colors,colors.map((_,c)=>dose(a,b,c)));
      assert.equal(proof.image,rack.proofs.get(b.id+"~"+a.id).image);
      outcomes.add(colors.join(""));
    }
    assert.equal(outcomes.size,[29,18][i]);
    assert.equal(new Set([...rack.proofs.values()].map(p=>p.image)).size,outcomes.size);
  }
});

test("the day pair exchanges which frond stays pinned, the night pair turns the same wrack over on the same peg", () => {
  for (const [rack,first,left,right] of [
    [day,"25R-26L","23L-26L","25R-23L"],
    [night,"26R-15L","26R-8L","26R-8R"],
  ]) {
    const a=rack.proofs.get(first+"~"+left), b=rack.proofs.get(first+"~"+right);
    assert.equal(a.page,"left"); assert.equal(b.page,"right");
    assert.deepEqual(rack.margins.map(c=>dose(a.first,a.second,c)),[0,1]);
    assert.deepEqual(rack.margins.map(c=>dose(b.first,b.second,c)),[1,0]);
    assert.equal(companion(a,[a,b]),b);
    assert.equal(companion(a,[a,rack.proofs.get(right+"~"+first)]),null);
    assert.notEqual(a.image,b.image);
    if (rack===day) assert.notEqual(a.held,b.held);
    else {
      assert.equal(a.held,b.held);assert.equal(a.second.fronds[1].peg,b.second.fronds[1].peg);
      assert.notEqual(a.second.fronds[1].face,b.second.fronds[1].face);
    }
  }
});

test("reclipping one specimen always restores the stationary exposure and stale or double-moved sheets cannot load", () => {
  const sheet={first:"25R-26L",pose:"23L-26L"};
  assert.equal(reclip(day,sheet,1,23,-1).id,"25R-23L");
  assert.equal(reclip(day,sheet,1,25,1),null);
  assert.ok(validSheet(day,sheet));
  for (const invalid of [null,{},[],{pose:"25R-26L"},{first:0,pose:sheet.pose},
    {first:sheet.first,pose:"23L-25R"},{first:null,pose:"bogus"}]) assert.equal(validSheet(day,invalid),false);
});

test("directions reach a real print from every first composition and every viable second exposure", () => {
  for (const rack of [day,night]) for (const goal of [null,"left","right"]) {
    function follow(start) {
      let sheet=start;
      const seen=new Set();
      while (true) {
        const mark=sheet.first+"~"+sheet.pose;
        assert.ok(!seen.has(mark),"cycling at "+mark+" for "+goal);
        seen.add(mark);
        const h=pressHint(rack,sheet,goal);
        if (h.action==="rewind") {
          assert.ok(sheet.first && ![...rack.proofs.values()].some(p=>p.first.id===sheet.first && (!goal||p.page===goal)));
          return;
        }
        if (h.action==="wash") {
          const proof=rack.proofs.get(mark);
          assert.ok(proof && (!goal || proof.page===goal)); return;
        }
        if (h.action==="expose") sheet={first:sheet.pose,pose:sheet.pose};
        else {
          const current=rack.poses.get(sheet.pose).fronds[h.which];
          const face=current.peg===h.frond.peg ? h.frond.face : current.face;
          const next=reclip(rack,sheet,h.which,h.frond.peg,face) ?? reclip(rack,sheet,h.which,h.frond.peg,-face);
          assert.ok(next); sheet={first:sheet.first,pose:next.id};
        }
      }
    }
    for(const initial of rack.poses.keys()) follow({first:null,pose:initial});
    for(const first of rack.firstPages.keys()) for(const pose of rack.poses.keys()) {
      if(validSheet(rack,{first,pose})) follow({first,pose});
    }
  }
});
