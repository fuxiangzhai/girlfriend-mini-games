import test from 'node:test';
import assert from 'node:assert/strict';
import {nights} from '../bloom-glass/nights.mjs';
import {prepareNight,traceLight,inspectNight,falls,follows,nextTurn} from '../bloom-glass/light-path.mjs';

const settings=night=>Array.from({length:2**night.controls.length},(_,i)=>i);
const turns=(a,b)=>((a^b).toString(2).match(/1/g)||[]).length;

test('a mirror reflects from both faces and all four ports are reversible',()=>{
  const mirror=prepareNight({rows:['A']});
  for(const [port,rising,falling] of [['T1','L1','R1'],['B1','R1','L1'],['L1','T1','B1'],['R1','B1','T1']]) {
    assert.equal(traceLight(mirror,0,port).exit,rising);
    assert.equal(traceLight(mirror,1,port).exit,falling);
  }
  for(const night of nights) for(const s of settings(night)) for(const lamp of night.lamps) {
    const ray=traceLight(night,s,lamp.entry);
    const back=traceLight(night,s,ray.exit);
    assert.equal(back.exit,lamp.entry);
    assert.deepEqual(back.points,ray.points.slice().reverse());
    assert.deepEqual(back.flowers,ray.flowers.slice().reverse());
    assert.equal(back.film,ray.film);
  }
});

test('every night needs both slips, all seven prints offer a genuinely different path',()=>{
  assert.equal(nights.length,8); assert.equal(new Set(nights.map(l=>l.id)).size,8);
  const minimum=[1,2,2,2,3,3,3,4];
  for (const [i,night] of nights.entries()) {
    const all=settings(night).map(s=>inspectNight(night,s));
    for(const row of night.rows) assert.equal(row.length,night.width);
    assert.ok(all.some(r=>r.inside && !r.outside),night.id+' has an inside-only configuration');
    assert.ok(all.some(r=>r.outside && !r.inside),night.id+' has an outside-only configuration');
    const wins=settings(night).filter(s=>all[s].done);
    assert.ok(wins.length,night.id);
    assert.equal(Math.min(...wins.map(s=>turns(night.start,s))),minimum[i],night.id);
    for(const pane of night.panes.values()) {
      assert.ok(wins.some(s=>all[s].rays.some(r=>r.points.some(([x,y])=>x===pane.x && y===pane.y))),night.id+' pane is usable');
    }
    if (i===0) { assert.equal(night.filmLamp,undefined); continue; }
    const golden=wins.filter(s=>all[s].silver),ordinary=wins.filter(s=>!all[s].silver);
    assert.ok(golden.length && ordinary.length,night.id);
    assert.equal(night.rows.join('').split('*').length-1,1);
    assert.ok(night.print && night.lamps[night.filmLamp]);
    const goldPaths=new Set(golden.map(s=>JSON.stringify(all[s].rays[night.filmLamp].points)));
    assert.ok(ordinary.every(s=>!goldPaths.has(JSON.stringify(all[s].rays[night.filmLamp].points))));
  }
});

test('flower order, shared mirrors and mechanically linked pairs affect real routes',()=>{
  assert.ok(follows(['3','1','3','2'],'12'));
  assert.equal(follows(['2','1'],'12'),false);
  for(const index of [2,5]) {
    const night=nights[index], opening=inspectNight(night,night.start);
    assert.equal(opening.inside,false);
    assert.equal(opening.rays[0].flowers.join(''),'21');
  }
  for(const night of nights.filter(l=>l.lamps.length===2)) {
    assert.ok(settings(night).some(s=>{
      const {rays,done}=inspectNight(night,s);
      if(!done) return false;
      return [...night.panes.values()].some(p=>rays.every(r=>r.points.some(([x,y])=>x===p.x && y===p.y)));
    }),night.id+' has a mirror used by both lamps');
  }
  for(const [i,count] of [[5,1],[6,1],[7,2]]) {
    const night=nights[i], linked=night.controls.filter(c=>c.panes.length>1);
    assert.equal(linked.length,count);
    for(const c of linked) {
      assert.ok(settings(night).some(s=>inspectNight(night,s).done && !inspectNight(night,s^c.bit).done));
      for(const p of night.panes.values()) assert.equal(falls(p,0)!==falls(p,c.bit),p.control===c);
    }
  }
});

test('hints reach the nearest delivery or photographic exposure from a saved arrangement',()=>{
  for (const night of nights) for (const film of night.filmLamp==null?[false]:[false,true]) {
    const goal=s=>{const r=inspectNight(night,s); return film?r.silver:r.done;};
    const wins=settings(night).filter(goal);
    for(const initial of [night.start,0,2**night.controls.length-1,...wins.slice(0,2)]) {
      let current=initial;
      const distance=Math.min(...wins.map(s=>turns(initial,s)));
      for(let i=0;i<distance;i++) {
        const hint=nextTurn(night,current,film);
        assert.ok(hint,night.id); current^=hint.bit;
      }
      assert.ok(goal(current),night.id);
      assert.equal(nextTurn(night,current,film),null);
    }
  }
});
