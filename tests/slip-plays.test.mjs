import test from 'node:test';
import assert from 'node:assert/strict';
import {slipPlays} from '../bloom-glass/slip-plays.mjs';
import {fits,poseKey,solve} from '../bloom-glass/puzzle.mjs';
import {readProjector} from '../bloom-glass/projection.mjs';
import {canTakeRequests,cueHint,deskAt,encoreBill,handStatus,makeHold,playbill,restorePlay,rewindPoint,savePlay,sightline,storePlaybill,takeScene} from '../bloom-glass/slip-path.mjs';
import {stagePose} from '../bloom-glass/slip-screen.mjs';
import {write} from '../bloom-glass/save.mjs';

const storage=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});
const options=slipPlays.map(level=>{
  const rows=[];
  solve(level,undefined,false,null,slots=>{
    const r=readProjector(level,slots);
    if(r.scene>=0)rows.push({scene:r.scene,slots:[...slots],keys:slots.map((p,i)=>poseKey(level,i,p))});
    return false;
  });
  return rows;
});
// Independently turn the lamp on with each pane physically removed, then
// enumerate paths forwards. No locked-pane set or backwards graph is reused.
function canChange(l,from,to,frame) {
  const moved=from.keys.flatMap((k,i)=>k===to.keys[i]?[]:[i]);
  if(moved.length>frame.limit)return false;
  const previous=readProjector(l,from.slots).rays[frame.keeper];
  return moved.every(id=>{
    const lifted=from.slots.map((p,i)=>id===i?null:p);
    const ray=readProjector(l,lifted).rays[frame.keeper];
    return ray.exit===previous.exit && JSON.stringify(ray.points)===JSON.stringify(previous.points);
  });
}
const paths=slipPlays.map((l,idx)=>{
  let paths=[[]];
  for(const f of l.play.frames)paths=paths.flatMap(path=>options[idx].filter(to=>f.scenes.includes(to.scene) &&
    (!path.length || canChange(l,path.at(-1),to,f))).map(to=>[...path,to]));
  return paths;
});

test('each act requires an uninterrupted physical ray, including real swaps and a handoff',()=>{
  let count=0;
  for(const [idx,l] of slipPlays.entries()){
    solve(l,undefined,false,null,()=>{count++;return false;});
    const opts=options[idx],frames=l.play.frames;
    for(let i=1;i<frames.length;i++){
      let blackouts=0;
      const f=frames[i];
      for(const from of opts.filter(o=>frames[i-1].scenes.includes(o.scene))){
        const hold=makeHold(l,from.slots,f);assert.ok(hold.held.length);
        for(const to of opts.filter(o=>f.scenes.includes(o.scene))){
          const s=handStatus(l,hold,to.slots),physical=canChange(l,from,to,f);
          assert.equal(!s.locked && !s.over,physical);
          if(!s.over && !physical)blackouts++;
        }
      }
      if(i===1)assert.ok(blackouts>0,l.title);
    }
    assert.ok(paths[idx].length);
    if(frames.length===3)assert.notEqual(frames[1].keeper,frames[2].keeper);
  }
  assert.equal(count,5232);
  const l=slipPlays[1];
  for(const [a,b] of paths[1]){
    const ids=handStatus(l,makeHold(l,a.slots,l.play.frames[1]),b.slots).changed;
    assert.equal(ids.length,2);
    assert.ok(ids.every(i=>a.keys[i].split(':')[0]!==b.keys[i].split(':')[0]));
  }
});

test('suffix hints match forward enumeration, including mids that lead to exactly one ending',()=>{
  for(const [idx,l] of slipPlays.entries()){
    const opts=options[idx],all=paths[idx],frames=l.play.frames;
    for(const ending of frames.at(-1).scenes){
      const endings=all.filter(path=>path.at(-1).scene===ending);
      assert.ok(endings.length);
      let trapped=0;
      for(const a of opts.filter(o=>o.scene===0)){
        const possible=endings.some(path=>path[0]===a);
        assert.deepEqual(sightline(l,[],a.slots,ending),{scene:0,possible});
        if(!possible){trapped++;assert.deepEqual(cueHint(l,[a.slots],a.slots,-1,ending),{type:'rewind',index:0});}
      }
      assert.ok(trapped);
      if(frames.length===3){
        let late=0;
        for(const a of opts.filter(o=>o.scene===0))for(const b of opts.filter(o=>o.scene===1 && canChange(l,a,o,frames[1]))){
          const prefix=endings.filter(path=>path[0]===a),possible=prefix.some(path=>path[1]===b);
          const pro=sightline(l,[a.slots],b.slots,ending);assert.equal(pro.possible,possible);
          if(!possible){assert.equal(rewindPoint(l,[a.slots,b.slots],ending),prefix.length?1:0);if(prefix.length)late++;}
        }
        assert.ok(late);
      }
    }
  }
  const l=slipPlays.at(-1),all=paths.at(-1);
  const mid=new Map();
  for(const p of all){const set=mid.get(p[1])||new Set();set.add(p[2].scene);mid.set(p[1],set);}
  for(const e of l.play.frames.at(-1).scenes)assert.ok([...mid.values()].some(s=>s.size===1 && s.has(e)));
});

test('action hints reach every ending through legal intermediate lifts and seats',()=>{
  for(const l of slipPlays)for(const ending of l.play.frames.at(-1).scenes) {
    const takes=[];let slots=[...l.sample];
    for(const [i,f] of l.play.frames.entries()){
      const hold=makeHold(l,takes.at(-1),f),guard=hold && readProjector(l,hold.base).rays[f.keeper].points;
      for(let n=0;n<=l.pieces.length*3;n++){
        const step=cueHint(l,takes,slots,slots.findIndex(p=>!p),ending);
        if(step.type==='ready')break;
        if(step.type==='lift'){assert.ok(slots[step.id]);slots[step.id]=null;}
        else {assert.equal(step.type,'place');assert.equal(slots[step.id],null);assert.ok(fits(l,slots,step.id,step.place));slots[step.id]=step.place;}
        const s=handStatus(l,hold,slots);assert.ok(!s.locked && !s.over);
        if(hold)assert.deepEqual(readProjector(l,slots).rays[f.keeper].points,guard);
      }
      assert.ok(f.scenes.includes(takeScene(l,takes,slots)),l.title+' '+i);
      takes.push([...slots]);
    }
    assert.equal(readProjector(l,slots).scene,ending);
    assert.equal(cueHint(l,takes,slots,-1,ending).type,'finished');
  }
});

test('draft recovery keeps only a valid prefix and cannot restore glass removed from a live ray',()=>{
  const l=slipPlays[2],p=paths[2][0],a=p[0].slots,b=p[1].slots,hold=makeHold(l,a,l.play.frames[1]);
  const movable=l.pieces.findIndex((_,i)=>!hold.held.includes(i));
  const start=deskAt(l,a),draft=deskAt(l,a.map((v,i)=>i===movable?null:v));
  assert.equal(handStatus(l,hold,draft.slots).changed.length,1);
  savePlay(l,[a],draft,[start]);assert.deepEqual(restorePlay(l),{takes:[a],state:draft,history:[start]});
  const broken=deskAt(l,a.map((v,i)=>i===hold.held[0]?null:v));
  const repaired=restorePlay(l,{takes:[a],state:broken,history:[broken]});
  assert.deepEqual(repaired,{takes:[a],state:start,history:[]});
  assert.deepEqual(restorePlay(l,{takes:[a,b,a],state:broken}).takes,[a,b]);
  assert.equal(storePlaybill(l,[a,b]),false);assert.equal(storePlaybill(l,[a,b,a]),false);
  const last=slipPlays.at(-1);
  for(const ending of last.play.frames.at(-1).scenes){
    const runs=paths.at(-1).find(path=>path.at(-1).scene===ending).map(o=>o.slots);
    assert.equal(storePlaybill(last,runs),true);assert.deepEqual(playbill(last,ending),runs);
  }
  write('slip:bill:'+last.id+':3',[null]);assert.equal(playbill(last,3),null);assert.ok(playbill(last,2));
});

test('the mechanical glass reaches each exact stop and stays on the tracks when scrubbed',()=>{
  for(const l of slipPlays)for(const ending of l.play.frames.at(-1).scenes){
    const picks=l.play.frames.map(f=>l.projection.scenes[f.scenes.includes(ending)?ending:f.scenes[0]]);
    picks.forEach((v,i)=>assert.deepEqual(stagePose(picks,i),v.pose));
    assert.deepEqual(stagePose(picks,-2),picks[0].pose);assert.deepEqual(stagePose(picks,90),picks.at(-1).pose);
    for(let i=1;i<picks.length;i++)stagePose(picks,i-.5).forEach((v,j)=>assert.ok(v>=Math.min(picks[i-1].pose[j],picks[i].pose[j]) && v<=Math.max(picks[i-1].pose[j],picks[i].pose[j])));
  }
  const tram=slipPlays[1].projection.scenes;
  assert.equal(stagePose(tram,.4)[1],tram[0].pose[1]);
});

test('audience requests require both available endings and the identical physical cast of the first two cues',()=>{
  storage.clear();
  const l=slipPlays.at(-1),all=paths.at(-1),last=l.play.frames.at(-1).scenes;
  const casts=new Map();
  for(const path of all){
    const key=path.slice(0,-1).map(o=>o.keys.join('/')).join('|');
    const records=casts.get(key)||new Map();records.set(path.at(-1).scene,path.map(o=>o.slots));casts.set(key,records);
  }
  const shared=[...casts.values()].filter(s=>s.size===2);assert.ok(shared.length>=2);
  const only=[...casts.values()].find(s=>s.size===1).values().next().value;
  const theirs=readProjector(l,only.at(-1)).scene;
  assert.equal(canTakeRequests(l,only),false);
  assert.ok(sightline(l,only.slice(0,2),only[2],theirs).possible);
  assert.equal(sightline(l,only.slice(0,2),only[2],theirs,true).possible,false);
  assert.equal(cueHint(l,only.slice(0,2),only[2],-1,theirs,true).type,'rewind');
  const a=shared[0].get(last[0]),mismatch=shared[1].get(last[1]),b=shared[0].get(last[1]);
  storePlaybill(l,a);storePlaybill(l,mismatch);assert.equal(encoreBill(l),null);
  storePlaybill(l,b);assert.deepEqual(encoreBill(l),[a,b]);
  storePlaybill(l,only);assert.ok(encoreBill(l));
  write('slip:encore:'+l.id,[a,mismatch]);assert.equal(encoreBill(l),null);
});
