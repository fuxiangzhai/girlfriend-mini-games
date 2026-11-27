import test from 'node:test';
import assert from 'node:assert/strict';
import {relayCasts,partnerOrder} from '../bloom-glass/duet-plays.mjs';
import {acceptsMark,readMark} from '../bloom-glass/duet-marks.mjs';
import {poseKey,solve} from '../bloom-glass/puzzle.mjs';
import {readProjector} from '../bloom-glass/projection.mjs';
import {changeTotal,cueHint,deskAt,doubleBill,firstMissedMark,playbill,quietScore,remainingCost,restorePlay,rewindPoint,savePlay,savedOrder,sightline,storePlaybill,takeScene} from '../bloom-glass/slip-path.mjs';
import {propPose} from '../bloom-glass/slip-screen.mjs';
import {write} from '../bloom-glass/save.mjs';

const storage=new Map();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}});

// Independent forward enumeration. Read physical straight segments at an eye
// and actually lift every moved pane to see if the keeper would go dark.
function reads(rays,w,m){
  if(!m || m.kind==='wait')return true;
  const segments=rays.map(ray=>ray.points.slice(1,-1).flatMap(([x,y],i)=>{
    if(y*w+x!==m.cell)return [];
    const [a,b]=ray.points[i],[c,d]=ray.points[i+2];
    return [Math.abs(a-c)===2?'horizontal':Math.abs(b-d)===2?'vertical':'bend'];
  }));
  if(m.kind==='stamp')return segments[m.lamp].length>0 && !segments[1-m.lamp].length;
  return segments.some((s,i)=>s.includes('horizontal') && segments[1-i].includes('vertical'));
}
function enumerate(pair){
  const l=pair[0],rows=[];
  solve(l,undefined,false,null,layout=>{
    const {scene,rays}=readProjector(l,layout);
    if(scene>=0){
      const slots=[...layout],keys=slots.map((p,id)=>poseKey(l,id,p));
      const safe=slots.map((_,id)=>readProjector(l,slots.map((p,j)=>id===j?null:p)).rays.map(r=>Boolean(r.exit)));
      rows.push({scene,rays,slots,keys,safe});
    }
    return false;
  });
  let records=[{rows:[],cost:0}];
  for(const [i,f] of l.play.frames.entries()){
    const next=rows.filter(row=>row.scene===i);
    records=records.flatMap(run=>next.flatMap(row=>{
      const prev=run.rows.at(-1),diff=prev?row.keys.flatMap((k,j)=>prev.keys[j]===k?[]:[j]):[];
      if(prev && (diff.length>f.limit || diff.some(id=>!prev.safe[id][f.keeper])))return [];
      return [{rows:[...run.rows,row],cost:run.cost+diff.length}];
    }));
  }
  return records.map(run=>({...run,takes:run.rows.map(r=>r.slots),
    works:pair.map(level=>run.rows.every((r,i)=>reads(r.rays,l.width,level.play.frames[i].mark)))}));
}
const performances=relayCasts.map(enumerate);
const min=runs=>Math.min(...runs.map(r=>r.cost));

test('a pass requires perpendicular straight segments and a seal rejects blank, wrong and double exposure',()=>{
  const H={points:[[0,1],[1,1],[2,1]]},V={points:[[1,0],[1,1],[1,2]]},turn={points:[[0,1],[1,1],[1,2]]},stop={points:[[0,1],[1,1]],blocked:[1,1]};
  const pass=(a,b)=>acceptsMark({mark:{kind:'pass',cell:4}},3,[a,b]);
  const stamp=(a,b,lamp)=>acceptsMark({mark:{kind:'stamp',lamp,cell:4}},3,[a,b]);
  assert.ok(pass(H,V) && pass(V,H));assert.ok(!pass(H,H) && !pass(turn,H) && !pass(H,stop));
  assert.deepEqual(readMark([turn,stop],3,4),{lit:[true,false],crossed:false});
  assert.ok(stamp(turn,stop,0) && stamp(stop,V,1));
  assert.ok(!stamp(H,V,1) && !stamp(stop,stop,1) && !stamp(stop,V,0));
});

test('all four deliveries and both double scores match an independent forward run of five boards',()=>{
  for(const [j,pair] of relayCasts.entries()){
    const runs=performances[j],joint=runs.filter(r=>r.works.every(Boolean));
    for(const [v,l] of pair.entries()){
      const actual=runs.filter(r=>r.works[v]);
      assert.equal(partnerOrder(l),pair[1-v]);assert.equal(quietScore(l).target,min(actual));
      assert.equal(min(actual),[[6,4],[7,8]][j][v]);
      assert.equal(quietScore(l,true).target,min(joint));assert.ok(actual.some(r=>r.cost>min(actual)));
      for(const run of runs){
        const accepted=run.takes.every((b,i)=>takeScene(l,run.takes.slice(0,i),b)===i);
        assert.equal(accepted,run.works[v]);
        if(accepted)assert.equal(firstMissedMark(l,run.takes)<0,run.works[1-v]);
      }
      const group=new Map();
      for(const r of actual)for(let i=0;i<5;i++){
        const key=r.rows.slice(0,i+1).map(s=>s.keys.join('/')).join('|'),prior=group.get(key);
        if(!prior || prior.r.cost>r.cost)group.set(key,{i,r});
      }
      for(const {i,r} of group.values()){
        const bill=remainingCost(l,r.takes.slice(0,i),r.takes[i]);
        assert.deepEqual(bill,{total:r.cost,remaining:r.cost-changeTotal(l,r.takes.slice(0,i+1))});
      }
    }
    assert.equal(min(joint),[6,8][j]);assert.ok(Math.min(...pair.map(l=>quietScore(l).target))<min(joint));
  }
});

test('passing up an available early crossing keeps the object and switches the third-beat ink',()=>{
  for(const [j,[early,late]] of relayCasts.entries()){
    const joint=performances[j].find(r=>r.works.every(Boolean));
    assert.ok(reads(joint.rows[1].rays,early.width,early.play.frames[1].mark));
    assert.equal(takeScene(late,joint.takes.slice(0,1),joint.takes[1]),1);
    assert.notEqual(late.play.frames[2].mark.cell,early.play.frames[2].mark.cell);
    assert.notEqual(late.play.frames[2].mark.lamp,early.play.frames[2].mark.lamp);
    for(const l of [early,late]){
      const d=l.play.delivery,s=l.projection.scenes[d.pass],stops=[s.pose,s.partnerPose];
      const from=propPose(l,d.pass-.5,stops),to=propPose(l,d.pass,stops),half=propPose(l,d.pass-.28,stops);
      assert.equal(from[0],stops[d.giver][0]+d.grips[d.giver][0]);
      assert.equal(to[0],stops[1-d.giver][0]+d.grips[1-d.giver][0]);
      assert.ok(Math.abs(half[0]-(from[0]+to[0])/2)<1e-6);
      assert.ok(half[1]<(from[1]+to[1])/2 && half[3]<0);
    }
  }
});

test('an incompatible performed cue rewinds joint rehearsals to a viable prefix',()=>{
  for(const [j,pair] of relayCasts.entries()){
    const single=performances[j].find(r=>r.works.filter(Boolean).length===1),l=pair[single.works.indexOf(true)];
    const missed=firstMissedMark(l,single.takes),prefix=single.takes.slice(0,missed+1);
    assert.ok(missed>=1 && missed<4);
    assert.equal(remainingCost(l,prefix,single.takes[prefix.length],true),null);
    assert.equal(sightline(l,prefix,single.takes[prefix.length],4,true).possible,false);
    const back=rewindPoint(l,prefix,4,true);
    assert.ok(back<=missed);
    assert.deepEqual(cueHint(l,prefix,prefix.at(-1),-1,4,true),{type:'rewind',index:back});
    assert.ok(performances[j].some(r=>r.works.every(Boolean) && r.takes.slice(0,back).every((b,i)=>b===prefix[i])));
  }
});

test('a shared rehearsal keeps its own validated record, credits only the performed delivery and restores in-progress edits',()=>{
  storage.clear();
  for(const [j,pair] of relayCasts.entries()){
    const runs=performances[j],single=runs.filter(r=>r.works.filter(Boolean).length===1).sort((a,b)=>a.cost-b.cost)[0];
    const v=single.works.indexOf(true),l=pair[v],other=pair[1-v],joint=runs.filter(r=>r.works.every(Boolean)).sort((a,b)=>b.cost-a.cost)[0];
    assert.ok(joint.cost>single.cost);assert.ok(storePlaybill(l,joint.takes));
    assert.deepEqual(doubleBill(l),joint.takes);assert.equal(playbill(other,4),null);assert.equal(doubleBill(other),null);
    assert.ok(storePlaybill(l,single.takes));assert.deepEqual(playbill(l,4),single.takes);assert.deepEqual(doubleBill(l),joint.takes);
    write('slip:double:'+l.id+':0',joint.takes.slice(0,4));write('slip:double:'+l.id+':'+single.cost,single.takes);
    assert.deepEqual(doubleBill(l),joint.takes);assert.equal(storePlaybill(other,single.takes),false);
    const prefix=joint.takes.slice(0,1),state=deskAt(l,joint.takes[1]);
    savePlay(other,prefix,state,[]);assert.equal(savedOrder(l),1-v);
    assert.deepEqual(restorePlay(other),{takes:prefix,state,history:[]});assert.deepEqual(restorePlay(l).takes,[]);
    const wrong=restorePlay(other,{order:1-v,takes:single.takes,state});assert.equal(wrong.takes.length,firstMissedMark(l,single.takes));
  }
});
