import test from 'node:test';
import assert from 'node:assert/strict';
import {beginCourier,completedPath,courierBook,courierCue,fare,fileCourier,forecasts,oppositeOrder,pairedLetters,pairVersions,readCourier,redirectCourier,saveCourier,savedCourier,savedPair,secondLetter,stationCourses,takeCourier,wayFor} from '../bloom-glass/courier-score.mjs';
import {pairEnding} from '../bloom-glass/counter-plays.mjs';
import {foldPartner,insertCasts} from '../bloom-glass/duet-plays.mjs';
import {foldOptions,recordFold} from '../bloom-glass/fold-score.mjs';
import {storePlaybill} from '../bloom-glass/slip-path.mjs';
import {insertPane,practiceSource,socketHint} from '../bloom-glass/tail-score.mjs';

const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
function advance(l,w){
  const cue=courierCue(l,w);assert.ok(cue);
  return takeCourier(l,{...w,slots:cue.recommended[0].slots});
}
function finish(l,w){
  assert.ok(w);
  for(let i=0;i<6 && w.phase==='play';i++)w=advance(l,w);
  assert.equal(w.phase,'done');return w;
}
function book(l,order,pair,flap=0,route=0){
  return {...courierBook(practiceSource(l),flap,route,null,order,wayFor(pair,order)),pair};
}
function both(l,b){
  const first=finish(l,beginCourier(l,b)),other=secondLetter(l,first,wayFor(b.pair,oppositeOrder(b.order)));
  assert.deepEqual(other.steps,first.steps.slice(0,2));return finish(l,other);
}

test('the two independently quiet river letters cannot share a first board; both true eighteen-sound allocations can be sealed, reloaded and printed separately',()=>{
  memory.clear();const l=insertCasts[0][0][0],b=book(l,'021','fd'),plans=forecasts(l,b);
  const alternative=plans.find(p=>p.path.total===11 && p.path.partner.total===11);assert.ok(alternative);
  const initial=both(l,b),alternate=both(l,{...b,pace:alternative.pace});
  const actual=w=>pairedLetters(l,w).arms.map(a=>a.path.total);
  assert.deepEqual(actual(initial),[13,10]);assert.deepEqual(actual(alternate),[11,11]);
  assert.equal(pairedLetters(l,initial).shared,5);assert.equal(pairedLetters(l,alternate).shared,4);
  assert.notDeepEqual(initial.steps[1].slots,alternate.steps[1].slots);
  assert.ok(fileCourier(l,initial));assert.ok(fileCourier(l,alternate));assert.ok(fileCourier(l,initial));
  assert.equal(savedPair(l,0,'fd',false).total,18);
  const versions=pairVersions(l,initial);
  assert.deepEqual(versions.map(v=>[v.left,v.right,v.shared]),[[11,11,4],[13,10,5]]);
  for(const v of versions){assert.deepEqual(actual(v.w),[v.left,v.right]);assert.equal(pairedLetters(l,v.w).total,18);}
  for(const [plan,w] of [[plans[0],initial],[alternative,alternate]]){
    const [left,right]=pairedLetters(l,w).arms,split=p=>p.steps.map(s=>s.cost);
    assert.deepEqual(split(right.path),split(plan.path));assert.deepEqual(split(left.path),split(plan.path.partner));
  }
  fileCourier(l,both(l,book(l,'021','fd',1,1)));
  assert.equal(savedPair(l,0,'fd',false).total,15);assert.equal(savedPair(l,0,'fd',false,true).total,18);
  assert.equal(pairVersions(l,savedPair(l,0,'fd',false,true).w).length,2);
  assert.equal(pairedLetters(l,{...initial,mate:alternate.mate}),null);
  assert.equal(fileCourier(l,{...initial,mate:{...initial.mate,flap:1}}),false);
  assert.equal(fileCourier(l,{...initial,mate:{...initial.mate,steps:initial.mate.steps.slice(1)}}),false);
});

test('a station can exchange the remaining order and both delivery methods, but a moving pane and a paid first transfer cannot be erased',()=>{
  const l=insertCasts[0][0][0],b=courierBook(practiceSource(l),0,0,null,'021','direct');
  const first=advance(l,advance(l,beginCourier(l,b))),courses=stationCourses(l,first);
  assert.deepEqual(courses.map(c=>[c.order,c.legs]).sort(),[['012','ff'],['021','df'],['021','ff']]);
  const swapped=redirectCourier(l,first,'012','ff');assert.deepEqual(swapped.steps,first.steps);assert.deepEqual(swapped.slots,first.slots);
  assert.equal(redirectCourier(l,first,'012','df'),null);
  assert.equal(redirectCourier(l,{...first,slots:[]},'012','ff'),null);
  const cue=courierCue(l,first),h=socketHint(l,first.slots,cue,()=>0);
  const loose=insertPane(l,cue.rack,first.slots,h.id,h.place);
  assert.equal(redirectCourier(l,{...first,slots:loose},'012','ff'),null);
  const late=advance(l,redirectCourier(l,first,'021','df'));assert.equal(late.steps.at(-1).kind,'direct');
  assert.deepEqual(stationCourses(l,late).map(c=>[c.order,c.legs]),[['021','df']]);
  assert.equal(redirectCourier(l,late,'021','ff'),null);
  const returning=advance(l,swapped);assert.equal(returning.steps.at(-1).kind,'back');
  assert.deepEqual(stationCourses(l,returning),[]);
  assert.equal(completedPath(l,finish(l,swapped)).steps.filter(s=>s.kind==='back').length,2);
});

test('equal-price opposite handoffs in the same river reading earn distinct endings and stay on separate shelves',()=>{
  memory.clear();const l=insertCasts[0][1][0];
  const a=both(l,book(l,'102','df')),b=both(l,book(l,'102','fd'));
  assert.equal(pairedLetters(l,a).total,18);assert.equal(pairedLetters(l,b).total,18);
  assert.notEqual(pairEnding(l,1,'df').title,pairEnding(l,1,'fd').title);
  fileCourier(l,a);fileCourier(l,b);
  assert.equal(savedPair(l,1,'df',false).w.pair,'df');assert.equal(savedPair(l,1,'fd',false).w.pair,'fd');
  assert.equal(savedPair(l,1,'fd',true),null);
});

test('a legacy signed snow letter supplies exactly two physical steps; changing source, order, crease, or either opening invalidates the pair',()=>{
  memory.clear();const l=insertCasts[1][0][0],source=practiceSource(l),partner=foldPartner(l),peer=[];
  while(peer.length<7)peer.push(foldOptions(partner,peer,{leg:'reply',low:false,tape:source.tape})[0].o.slots);
  const b={...courierBook({...source,peer},1,1,null,'012','direct')};
  const legacy=finish(l,beginCourier(l,b));assert.equal(secondLetter(l,legacy,'fold'),null);
  for(const [cast,tape] of [[l,source.tape],[partner,peer]]){storePlaybill(cast,tape);recordFold(cast,tape);}
  fileCourier(l,legacy);const old=savedCourier(l,'012','direct',true).w;
  const resume=secondLetter(l,old,'fold');assert.deepEqual(resume.steps,old.steps.slice(0,2));
  const cue=courierCue(l,resume),h=socketHint(l,resume.slots,cue,()=>0);
  const partial={...resume,slots:insertPane(l,cue.rack,resume.slots,h.id,h.place)};
  saveCourier(l,partial);assert.deepEqual(readCourier(l,true),partial);assert.equal(fileCourier(l,partial),false);
  const result=finish(l,readCourier(l,true));assert.ok(fileCourier(l,result));
  assert.equal(savedPair(l,0,'df',true).total,pairedLetters(l,result).total);assert.equal(savedPair(l,0,'df',false),null);
  for(const bad of [{...result,order:old.order},{...result,pair:'dd'},{...result,flap:0},{...result,mate:{...old,source}},{...result,steps:result.steps.slice(1)},
    {...result,steps:result.steps.map(s=>({...s,keeper:String(s.keeper)}))}]){
    assert.equal(fileCourier(l,bad),false);
  }
  saveCourier(l,{...partial,mate:{...old,source}});assert.equal(readCourier(l,true),null);
  assert.deepEqual(savedCourier(l,'012','direct',true).w.steps,old.steps);
});

test('two direct letters need a common first station that leaves a live transfer in each opposite order',()=>{
  const l=insertCasts[1][0][0],b=book(l,'201','dd',1,0);
  assert.equal(fare(l,b),Infinity);assert.equal(beginCourier(l,b),null);
  assert.ok(Number.isFinite(fare(l,book(l,'201','ff',1,0))));
  const feasible=book(l,'012','dd',1,1);assert.ok(Number.isFinite(fare(l,feasible)));
  const result=both(l,feasible);assert.ok(pairedLetters(l,result).arms.every(a=>a.path.steps.some(s=>s.kind==='direct')));
});

test('at the snowy second station the last leg can still be changed from a live handoff to a paid second return',()=>{
  const l=insertCasts[1][0][0],b=courierBook(practiceSource(l),1,1,null,'012','direct');
  const first=advance(l,advance(l,beginCourier(l,b)));
  const second=advance(l,advance(l,redirectCourier(l,first,'012','fd')));
  assert.deepEqual(second.steps.map(s=>s.kind),['mid','first','back','out']);
  const choices=stationCourses(l,second);assert.deepEqual(choices.map(c=>[c.legs,c.path.total]),[['fd',5],['ff',6]]);
  const turn=redirectCourier(l,second,'012','ff'),sealed=finish(l,turn);
  assert.deepEqual(turn.steps,second.steps);assert.ok(sealed.steps.slice(4).every(s=>s.kind!=='direct'));
  assert.equal(completedPath(l,sealed).total,6);
});
