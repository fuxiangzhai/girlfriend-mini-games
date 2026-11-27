import test from 'node:test';
import assert from 'node:assert/strict';
import {insertCasts,foldPartner} from '../bloom-glass/duet-plays.mjs';
import {foldOptions,recordFold} from '../bloom-glass/fold-score.mjs';
import {storePlaybill} from '../bloom-glass/slip-path.mjs';
import {insertPane,practiceSource,socketHint} from '../bloom-glass/tail-score.mjs';
import {beginCourier,completedPath,courierBook,courierCue,fare,fileCourier,forecasts,readCourier,roadsFor,saveCourier,savedCourier,takeCourier} from '../bloom-glass/courier-score.mjs';
import {courierEnding} from '../bloom-glass/courier-plays.mjs';

const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
function step(l,w){
  const cue=courierCue(l,w),guide={...cue,options:cue.recommended};
  for(let i=0;i<12;i++){
    const h=socketHint(l,w.slots,guide,()=>0);
    if(h.ready){const next=takeCourier(l,w);assert.ok(next);return next;}
    assert.ok(!h.reset);w.slots=insertPane(l,cue.rack,w.slots,h.id,h.place);assert.ok(w.slots);
  }
  assert.fail('hint failed to seat the chosen board');
}
function perform(l,book){
  let w=beginCourier(l,book);assert.ok(w);
  for(let i=0;i<6 && w.phase!=='done';i++)w=step(l,w);
  assert.equal(w.phase,'done');return w;
}

test('one extra pane at the first river stop buys a quieter handoff; both guiding priorities are playable with the original sockets',()=>{
  const l=insertCasts[0][0][0],book=courierBook(practiceSource(l),0,0,null,'021','direct');
  const proposals=forecasts(l,book);
  assert.equal(proposals[0].path.total,10);assert.equal(proposals.find(p=>p.pace==='first').path.total,11);
  const quiet=perform(l,book),lightFirst=perform(l,{...book,pace:'first'});
  const fees=w=>completedPath(l,w).steps.map(s=>s.cost);
  assert.deepEqual(fees(quiet),[2,3,1,3,1]);assert.deepEqual(fees(lightFirst),[2,2,3,3,1]);
  assert.deepEqual(quiet.steps[0],lightFirst.steps[0]);
  assert.equal(fare(l,{...book,way:'fold',pin:quiet.steps[0].slots}),13);
  assert.equal(quiet.steps.at(-1).kind,'out');assert.match(courierEnding(l,quiet).after,/折里摸到一张纸/);
  assert.notEqual(courierEnding(l,quiet).after,courierEnding(l,{...quiet,way:'fold'}).after);
});

test('a snow lantern can be handed from the trail to the lookout on one crease, while another equally cheap eighth requires two returns',()=>{
  const l=insertCasts[1][0][0],source=practiceSource(l),book=courierBook(source,1,1,null,'012','direct');
  assert.equal(fare(l,book),5);assert.equal(fare(l,{...book,way:'fold'}),6);
  assert.equal(fare(l,{...book,flap:0,route:0}),Infinity);assert.equal(fare(l,{...book,flap:0,route:0,way:'fold'}),8);
  const w=perform(l,book),p=completedPath(l,w);
  assert.deepEqual(p.steps.map(s=>s.cost),[1,1,1,1,1]);
  assert.deepEqual(p.steps.map(s=>s.kind),['mid','first','back','out','direct']);
  assert.deepEqual(roadsFor(l,book)[0],{flap:1,route:1,price:5});
  assert.equal(p.steps[4].keeper,0);
  assert.match(courierEnding(l,w).after,/接来的灯/);
});

test('an ordered programme earns its own signed letter only after all actual handoffs and exact returns; budgets keep the best take per way',()=>{
  storage.clear();const l=insertCasts[0][0][0],trial=practiceSource(l),book=courierBook(trial,0,0,null,'021','direct');
  const w=perform(l,book),folded=perform(l,{...book,way:'fold'}),loud=perform(l,{...book,pace:'first'});
  assert.ok(fileCourier(l,w));assert.ok(fileCourier(l,loud));assert.ok(fileCourier(l,folded));
  assert.equal(savedCourier(l,'021','direct',false).total,10);assert.equal(savedCourier(l,'021','fold',false).total,13);
  assert.equal(savedCourier(l,'012','direct',false),null);assert.equal(savedCourier(l,'021','direct',true),null);
  for(const forgery of [{...w,steps:w.steps.filter(s=>s.kind!=='back')},{...w,way:'fold'},{...w,route:1},{...w,order:'201'},
    {...w,steps:w.steps.map(s=>s.kind==='direct'?{...s,keeper:1-s.keeper}:s)}])assert.equal(fileCourier(l,forgery),false);
  const other=foldPartner(l),peer=[];
  while(peer.length<7)peer.push(foldOptions(other,peer,{leg:'reply',low:false,tape:trial.tape})[0].o.slots);
  const real={...w,source:{tape:trial.tape,peer}};
  assert.equal(fileCourier(l,real),false);
  for(const [cast,tape] of [[l,trial.tape],[other,peer]]){storePlaybill(cast,tape);recordFold(cast,tape);}
  assert.ok(fileCourier(l,real));assert.equal(savedCourier(l,'021','direct',true).total,10);
  assert.equal(savedCourier(l,'021','fold',true),null);
});

test('a kept eighth skips only its already staged move; a half-seated return resumes, and a forged prefix cannot be finished',()=>{
  storage.clear();const l=insertCasts[1][0][0],book=courierBook(practiceSource(l),1,1,null,'012','direct');
  const first=step(l,beginCourier(l,book)),pinned=beginCourier(l,{...book,pin:first.steps[0].slots});
  assert.deepEqual(first.steps,pinned.steps);
  const w=step(l,pinned),cue=courierCue(l,w);assert.equal(cue.step.kind,'back');
  const h=socketHint(l,w.slots,cue,()=>0);w.slots=insertPane(l,cue.rack,w.slots,h.id,h.place);
  saveCourier(l,w);assert.deepEqual(readCourier(l,false),w);
  saveCourier(l,{...w,slots:[]});assert.deepEqual(readCourier(l,false).slots,cue.rack.from.slots);
  saveCourier(l,{...w,steps:[]});assert.equal(readCourier(l,false),null);
  saveCourier(l,{...w,steps:[w.steps[1]]});assert.equal(readCourier(l,false),null);
  assert.equal(beginCourier(l,{...book,order:'001'}),null);
  assert.equal(fileCourier(l,{...w,phase:'done'}),false);
});
