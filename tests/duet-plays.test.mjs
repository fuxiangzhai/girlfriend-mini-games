import test from 'node:test';
import assert from 'node:assert/strict';
import {duetCasts,partnerOrder} from '../bloom-glass/duet-plays.mjs';
import {fits,poseKey,solve} from '../bloom-glass/puzzle.mjs';
import {readProjector} from '../bloom-glass/projection.mjs';
import {changeTotal,cueHint,deskAt,makeHold,playbill,quietScore,restorePlay,rewindPoint,savePlay,savedOrder,sightline,storePlaybill,takeScene} from '../bloom-glass/slip-path.mjs';
import {stagePose} from '../bloom-glass/slip-screen.mjs';
import {write} from '../bloom-glass/save.mjs';

const store=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}});
// Enumerate forwards. Pull each changed piece out individually and check the
// actual ray while it is absent. This oracle does not use the game's hold set,
// suffix graph, or whole-show cost calculation.
const catalog=duetCasts.map(([l])=>{
  const rows=[];let count=0;
  solve(l,undefined,false,null,s=>{
    count++;const projected=readProjector(l,s);
    if(projected.scene>=0)rows.push({scene:projected.scene,slots:[...s],keys:s.map((p,i)=>poseKey(l,i,p)),rays:projected.rays});
    return false;
  });
  return {rows,count};
});
function connection(l,a,b,f){
  if(!a)return 0;
  const moved=a.keys.flatMap((key,id)=>b.keys[id]===key?[]:[id]);
  if(moved.length>f.limit)return Infinity;
  for(const id of moved){
    const lifted=a.slots.map((p,i)=>i===id?null:p),ray=readProjector(l,lifted).rays[f.keeper];
    if(JSON.stringify(ray.points)!==JSON.stringify(a.rays[f.keeper].points))return Infinity;
  }
  return moved.length;
}
const versions=duetCasts.flatMap((pair,index)=>pair.map(l=>{
  const {rows}=catalog[index];let paths=[{steps:[],costs:[],total:0}];
  for(const f of l.play.frames){
    paths=paths.flatMap(p=>rows.filter(row=>row.scene===f.scenes[0]).flatMap(row=>{
      const cost=connection(l,p.steps.at(-1),row,f);
      return Number.isFinite(cost)?[{steps:[...p.steps,row],costs:[...p.costs,cost],total:p.total+cost}]:[];
    }));
  }
  return {l,paths,min:Math.min(...paths.map(p=>p.total)),rows};
}));
const layouts=p=>p.steps.map(s=>s.slots);

test('the two orders move different physical glasses and really share a first and last scene',()=>{
  assert.deepEqual(catalog.map(c=>c.count),[240,256]);
  for(const [idx,pair] of duetCasts.entries()){
    const branches=versions.filter(v=>pair.includes(v.l));
    const starts=branches.map(v=>new Set(v.paths.map(p=>p.steps[0])));
    assert.ok([...starts[0]].some(o=>starts[1].has(o)));
    assert.ok(starts.every((set,i)=>[...set].some(o=>!starts[1-i].has(o))));
    for(const [i,{l,paths}] of branches.entries()){
      assert.equal(partnerOrder(l),pair[1-i]);
      assert.equal(l.play.frames[1].keeper,1-i);assert.equal(l.play.frames[2].keeper,i);
      for(const p of paths)for(let n=1;n<p.steps.length;n++){
        const a=l.projection.scenes[p.steps[n-1].scene],b=l.projection.scenes[p.steps[n].scene],f=l.play.frames[n];
        const channel=f.keeper?'partnerPose':'pose',moving=f.keeper?'pose':'partnerPose';
        assert.deepEqual(stagePose([a,b],.4,channel,l.play.arc),a[channel]);
        assert.notDeepEqual(a[moving],b[moving]);assert.notDeepEqual(stagePose([a,b],.4,moving),a[moving]);
      }
      assert.equal(l.play.frames.at(-1).scenes[0],idx===0?3:4);
    }
  }
  const ridge=duetCasts[1][0],scenes=ridge.projection.scenes;
  for(const s of scenes)assert.ok(Math.abs(s.pose[1]-(20+.23*s.pose[0]))<1e-6);
  assert.ok(stagePose([scenes[0],scenes[2]],.5,'partnerPose',ridge.play.arc)[1]<Math.min(scenes[0].partnerPose[1],scenes[2].partnerPose[1]));
});

test('global quiet targets and forecasts match every forward path, including a costly greedy first move',()=>{
  assert.deepEqual(versions.map(v=>v.min),[3,3,5,3]);
  for(const {l,paths,min,rows} of versions){
    assert.equal(quietScore(l).target,min);assert.ok(paths.some(p=>p.total>min));
    const end=l.play.frames.at(-1).scenes[0],checked=new Set();
    for(const p of paths)for(let i=0;i<p.steps.length;i++){
      const prefix=p.steps.slice(0,i),key=prefix.map(o=>rows.indexOf(o)).join('/');
      if(checked.has(key))continue;checked.add(key);
      const takes=prefix.map(o=>o.slots),matches=paths.filter(q=>prefix.every((s,j)=>q.steps[j]===s));
      for(const row of rows.filter(o=>o.scene===l.play.frames[i].scenes[0])){
        const has=matches.filter(q=>q.steps[i]===row);
        assert.equal(sightline(l,takes,row.slots,end).possible,Boolean(has.length));
        assert.equal(sightline(l,takes,row.slots,end,false,true).possible,has.some(q=>q.total===min));
      }
    }
    for(const p of paths.filter(p=>p.total>min)){
      const rewind=rewindPoint(l,layouts(p),end,false,true);
      const common=Math.max(...paths.filter(q=>q.total===min).map(q=>p.steps.findIndex((s,i)=>q.steps[i]!==s)));
      assert.equal(rewind,common);
    }
  }
  assert.ok(versions.slice(2).some(({paths})=>paths.some(p=>{
    const same=paths.filter(q=>q.steps[0]===p.steps[0]),cheap=Math.min(...same.map(q=>q.costs[1]));
    return p.costs[1]>cheap && same.filter(q=>q.costs[1]===cheap).every(q=>p.total<q.total);
  })));
});

test('both paces are playable through normal hint actions without interrupting the parked actor',()=>{
  for(const {l,min} of versions)for(const quiet of [false,true]){
    const takes=[],end=l.play.frames.at(-1).scenes[0];let board=[...l.sample];
    for(const frame of l.play.frames){
      const hold=makeHold(l,takes.at(-1),frame);
      for(let i=0;i<=3*l.pieces.length;i++){
        const step=cueHint(l,takes,board,board.findIndex(p=>!p),end,false,quiet);
        if(step.type==='ready')break;
        if(step.type==='lift')board[step.id]=null;
        else{assert.equal(step.type,'place');assert.ok(fits(l,board,step.id,step.place));board[step.id]=step.place;}
        if(hold)assert.deepEqual(readProjector(l,board).rays[hold.keeper].points,readProjector(l,hold.base).rays[hold.keeper].points);
      }
      assert.equal(takeScene(l,takes,board),frame.scenes[0]);takes.push([...board]);
    }
    if(quiet)assert.equal(changeTotal(l,takes),min);
  }
});

test('quiet receipts survive louder reruns and independent orders, and drafts keep the cast with its takes',()=>{
  for(const {l,min,paths} of versions){
    const fast=layouts(paths.find(p=>p.total===min)),loud=layouts(paths.find(p=>p.total>min)),end=l.play.frames.at(-1).scenes[0];
    assert.equal(storePlaybill(l,fast),true);assert.equal(storePlaybill(l,loud),true);
    assert.deepEqual(playbill(l,end),fast);assert.equal(storePlaybill(partnerOrder(l),fast),false);
    const state=deskAt(l,fast[0]);savePlay(l,[fast[0]],state,[state]);
    assert.equal(savedOrder(l),l.play.first);assert.deepEqual(restorePlay(l).takes,[fast[0]]);
    assert.deepEqual(restorePlay(partnerOrder(l)).takes,[]);
    write('slip:bill:'+l.id+':'+end+':0',loud);assert.deepEqual(playbill(l,end),fast);
  }
});
