import test from 'node:test';
import assert from 'node:assert/strict';
import {fiveAct,partnerOrder,receiptCasts,receiptFor,relayCasts} from '../bloom-glass/duet-plays.mjs';
import {carrierAt,readHoles} from '../bloom-glass/duet-marks.mjs';
import {poseKey,solve} from '../bloom-glass/puzzle.mjs';
import {readProjector} from '../bloom-glass/projection.mjs';
import {changeTotal,cueHint,deskAt,firstMissedMark,playbill,quietScore,readTrace,remainingCost,restorePlay,savePlay,savedReading,setTrace,signedBill,signedWith,storePlaybill,takeScene,usablePrefix} from '../bloom-glass/slip-path.mjs';
import {propPose} from '../bloom-glass/slip-screen.mjs';
import {write} from '../bloom-glass/save.mjs';

const memory=new Map();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}});
function accepts(m,width,rays){
  if(!m || m.kind==='wait')return true;
  const lines=rays.map(r=>r.points.slice(1,-1).map(([x,y])=>y*width+x));
  if(m.kind==='stamp')return lines[m.lamp].includes(m.cell) && !lines[1-m.lamp].includes(m.cell);
  if(m.kind==='watermark'){
    const sequence=m.reverse?[...lines[m.lamp]].reverse():lines[m.lamp];
    return sequence.some((at,i)=>at===m.cells[0] && sequence.slice(i+1).includes(m.cells[1]));
  }
  const axes=rays.map((r,lamp)=>lines[lamp].flatMap((at,i)=>{
    if(at!==m.cell)return [];
    const [a,b]=r.points[i],[c,d]=r.points[i+2];
    return [Math.abs(a-c)===2?'h':Math.abs(b-d)===2?'v':'bend'];
  }));
  return axes.some((set,i)=>set.includes('h') && axes[1-i].includes('v'));
}
// Enumerate forwards. Lift each changed pane from the prior accepted layout
// and trace the keeper to check whether that move could really be made.
function runsFor(pair){
  const l=pair[0],rows=[];
  solve(l,undefined,false,null,p=>{
    const slots=[...p],{scene,rays}=readProjector(l,slots);
    if(scene>=0){
      const keys=slots.map((b,i)=>poseKey(l,i,b));
      const safe=slots.map((_,i)=>readProjector(l,slots.map((b,j)=>i===j?null:b)).rays.map(r=>Boolean(r.exit)));
      rows.push({scene,rays,slots,keys,safe});
    }
    return false;
  });
  let runs=[{boards:[],last:null,cost:0,works:[true,true]}];const prefixes=[];
  for(let i=0;i<7;i++){
    const f=l.play.frames[i],options=rows.filter(o=>o.scene===i);
    runs=runs.flatMap(run=>options.flatMap(row=>{
      const old=run.last,changed=old?old.keys.flatMap((k,id)=>k===row.keys[id]?[]:[id]):[];
      if(old && (changed.length>f.limit || changed.some(id=>!old.safe[id][f.keeper])))return [];
      const works=pair.map((s,v)=>run.works[v] && accepts(s.play.frames[i].mark,l.width,row.rays));
      return works.includes(true)?[{boards:[...run.boards,row.slots],last:row,cost:run.cost+changed.length,works}]:[];
    }));
    if(i===4)prefixes.push(...runs);
  }
  return {runs,prefixes};
}
const families=receiptCasts.map(f=>f.map(runsFor));
const key=(l,row)=>row.map((b,id)=>poseKey(l,id,b)).join('/');
const geometry=(l,t)=>t.map(row=>key(l,row)).join('|');

test('watermarks respect read direction, the physical exit, and a second visit after a bend',()=>{
  const r={exit:'R1',points:[[-1,0],[0,0],[1,0],[2,0],[3,0]]},blank={points:[[-1,0],[0,0]],exit:null};
  const m={lamp:0,cells:[0,2]};assert.ok(readHoles(m,3,[r,blank]).ordered);
  assert.ok(!readHoles({...m,reverse:true},3,[r,blank]).ordered);
  assert.ok(readHoles({...m,cells:[2,0],reverse:true},3,[r,blank]).ordered);
  assert.ok(!readHoles({...m,lamp:1},3,[r,blank]).ordered);
  assert.ok(!readHoles({...m,reverse:true,cells:[2,0]},3,[{...r,exit:null},blank]).ordered);
  const revisit={exit:'T1',points:[[-1,0],[0,0],[1,0],[1,1],[0,1],[0,0],[0,-1]]};
  assert.ok(readHoles({lamp:0,cells:[4,0]},3,[revisit,blank]).ordered);
});

test('all eight seven-cue scripts and their quiet shared targets agree with independent physical enumeration',()=>{
  const expected=[[[8,7,8],[9,7,9]],[[11,11,12],[10,11,11]]];
  for(const [j,family] of receiptCasts.entries())for(const [mode,pair] of family.entries()){
    const {runs}=families[j][mode],joint=runs.filter(r=>r.works.every(Boolean));
    for(const [v,l] of pair.entries()){
      assert.equal(fiveAct(l),relayCasts[j][v]);assert.equal(partnerOrder(l),pair[1-v]);assert.equal(receiptFor(l,1-mode),family[1-mode][v]);
      const real=runs.filter(r=>r.works[v]),minimum=Math.min(...real.map(r=>r.cost));
      assert.equal(minimum,expected[j][mode][v]);assert.equal(quietScore(l).target,minimum);
      assert.equal(quietScore(l,true).target,Math.min(...joint.map(r=>r.cost)));assert.equal(quietScore(l,true).target,expected[j][mode][2]);
      for(const r of real){
        assert.equal(firstMissedMark(l,r.boards)<0,r.works[1-v]);
        assert.ok(r.boards.every((b,i)=>takeScene(l,r.boards.slice(0,i),b)===i));
      }
    }
  }
});

test('the same fifth scene can commit to different continuations and a saved five-cue run preserves its longest viable prefix',()=>{
  const [front,back]=receiptCasts[0],a=families[0][0].runs.find(r=>r.works.every(Boolean)),b=families[0][1].runs.find(r=>r.works.every(Boolean));
  const goal=(l,t)=>remainingCost(l,t.slice(0,4),t[4],true);
  assert.deepEqual(readProjector(front[0],a.boards[4]).rays.map(r=>r.exit),readProjector(back[0],b.boards[4]).rays.map(r=>r.exit));
  assert.ok(goal(front[0],a.boards));assert.equal(goal(back[0],a.boards),null);
  assert.ok(goal(back[0],b.boards));assert.equal(goal(front[0],b.boards),null);
  for(const [k,pair] of [front,back].entries()){
    const l=pair[0],available=families[0][k].runs.filter(r=>r.works.every(Boolean));
    const prefixes=Array.from({length:6},(_,n)=>new Set(available.map(r=>geometry(l,r.boards.slice(0,n)))));
    for(const old of families[0][k].prefixes.filter(r=>r.works[0])){
      const keep=usablePrefix(l,old.boards,true);assert.ok(prefixes[keep].has(geometry(l,old.boards.slice(0,keep))));
      if(keep<5)assert.ok(!prefixes[keep+1].has(geometry(l,old.boards.slice(0,keep+1))));
    }
  }
});

test('a real second performance must match every pane in every cue to countersign, even at equal cost',()=>{
  memory.clear();const [l,other]=receiptCasts[1][0],joint=families[1][0].runs.filter(r=>r.works.every(Boolean));
  const a=joint[0],b=joint.find(r=>r.cost===a.cost && geometry(l,r.boards)!==geometry(l,a.boards));assert.ok(b);
  assert.ok(storePlaybill(l,a.boards));assert.ok(setTrace(other,a.boards));assert.equal(playbill(other,6),null);
  assert.ok(storePlaybill(other,b.boards));assert.equal(signedBill(l),null);assert.equal(signedWith(l,a.boards),null);
  assert.ok(storePlaybill(l,b.boards));assert.deepEqual(signedWith(l,b.boards),[b.boards,b.boards]);
  assert.ok(storePlaybill(other,a.boards));assert.deepEqual(signedWith(l,a.boards),[a.boards,a.boards]);
  assert.ok(signedBill(l));assert.equal(signedBill(receiptFor(l,1)),null);
  // Read a pair earned under the previous five-cue storage format.
  memory.clear();const base=fiveAct(l),tape=a.boards.slice(0,5),cost=changeTotal(base,tape);
  write('slip:double:'+base.id+':'+cost,tape);assert.equal(signedBill(base),null);
  write('slip:double:'+partnerOrder(base).id+':'+cost,tape);assert.deepEqual(signedBill(base),[tape,tape]);
  write('slip:double:'+base.id+':'+cost,tape.slice(0,4));assert.equal(signedBill(base),null);
});

test('exact-score hints, draft mode restoration, and forged or truncated references are handled independently',()=>{
  memory.clear();const l=receiptCasts[0][1][0],other=partnerOrder(l),tape=families[0][1].runs.find(r=>r.works.every(Boolean)).boards;
  assert.ok(!setTrace(other,tape.slice(0,6)));assert.ok(setTrace(other,tape));
  assert.deepEqual(readTrace(other,tape.slice(0,3)),tape);
  const step=cueHint(other,[],other.sample,0,6,false,false,tape);
  assert.ok(['lift','place'].includes(step.type));if(step.type==='place')assert.deepEqual(step.place,tape[0][step.id]);
  const prefix=tape.slice(0,5),state=deskAt(l,tape[5]);savePlay(l,prefix,state,[]);
  assert.equal(savedReading(l),1);assert.deepEqual(restorePlay(l).takes,prefix);assert.deepEqual(restorePlay(receiptFor(l,0)).takes,[]);
  write('slip:trace:'+other.id,Array(7).fill(null));assert.equal(readTrace(other,[]),null);
});

test('the reply travels back to the original giver while the delivered object stays at the destination',()=>{
  for(const l of receiptCasts.flat(2)){
    const d=l.play.delivery,scene=l.projection.scenes[6],poses=[scene.pose,scene.partnerPose];
    assert.equal(carrierAt(l,5),1-d.giver);assert.equal(carrierAt(l,6),d.giver);
    const a=propPose(l,5.5,poses),b=propPose(l,6,poses),mid=propPose(l,5.72,poses);
    assert.equal(a[0],poses[1-d.giver][0]+d.grips[1-d.giver][0]);assert.equal(b[0],poses[d.giver][0]+d.grips[d.giver][0]);
    assert.ok(mid[1]<(a[1]+b[1])/2);assert.equal(a[2],9);
    assert.equal(propPose(l,4,poses)[2],d.width);
  }
});
