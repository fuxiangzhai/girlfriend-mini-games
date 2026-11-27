import test from 'node:test';
import assert from 'node:assert/strict';
import {foldPartner,insertCasts} from '../bloom-glass/duet-plays.mjs';
import {foldOptions,recordFold} from '../bloom-glass/fold-score.mjs';
import {poseKey,solve} from '../bloom-glass/puzzle.mjs';
import {readProjector} from '../bloom-glass/projection.mjs';
import {write} from '../bloom-glass/save.mjs';
import {differentPanes,storePlaybill} from '../bloom-glass/slip-path.mjs';
import {tailPorts} from '../bloom-glass/tail-plays.mjs';
import {bestTail,cueMatch,insertPane,newTail,practiceSource,prepOptions,readTailDesk,recordTail,retakeReturn,saveTailDesk,savedTwin,signedSource,tailCost,tailCue,tailHint,tailPrices,tailRoutes,twinTail,validTail} from '../bloom-glass/tail-score.mjs';

const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const signature=(l,b)=>b.map((p,i)=>poseKey(l,i,p)).join('/');
function signedSevens(l){
  let paths=[[]];
  for(let i=0;i<7;i++){
    const next=new Map();
    for(const p of paths)for(const {o} of foldOptions(l,p,{leg:'first',low:false}))next.set(o.keys.join('/'),[...p,o.slots]);
    paths=[...next.values()];
  }
  return paths;
}
// Lift each changed pane on the old board to independently test whether the
// keeper's ray goes dark. No stage indexes or production transition matrix.
function oracle(l){
  const rows=[];
  solve(l,undefined,false,null,p=>{
    const slots=[...p],exits=readProjector(l,slots).rays.map(r=>r.exit);
    const safe=p.map((_,i)=>readProjector(l,p.map((b,j)=>i===j?null:b)).rays.map((r,k)=>r.exit===exits[k]));
    rows.push({slots,exits,safe,id:signature(l,slots)});return false;
  });
  function step(row,keeper,exits){
    return rows.filter(r=>r.exits.every((e,i)=>e===exits[i])).flatMap(r=>{
      const diff=differentPanes(l,row.slots,r.slots);
      return diff.length<=3 && diff.every(i=>row.safe[i][keeper])?[{r,cost:diff.length}]:[];
    });
  }
  return {rows,step};
}
test('every signed seventh board can stage both destinations and the independent optical search gives the same eighth and ninth boards and costs',()=>{
  for(const family of insertCasts){
    const {rows,step}=oracle(family[0][0]);
    for(const l of family.flat())for(const tape of signedSevens(l)){
      const base=tape[6],start=rows.find(r=>r.id===signature(l,base));let flexible=false;
      for(const route of [0,1]){
        const actual=tailRoutes(l,base,route),expected=[];
        for(const {r,cost} of step(start,route,tailPorts(l,route))){
          const finals=[0,1].map(e=>step(r,e?1-route:route,tailPorts(l,route,e)));
          if(!finals.some(f=>f.length))continue;
          expected.push(r.id);
          const m=actual.find(x=>x.row.keys.join('/')===r.id);assert.ok(m);
          assert.deepEqual(m.prices,finals.map(f=>Math.min(...f.map(k=>cost+k.cost))));
          assert.deepEqual(m.finals.map(f=>f.map(k=>k.keys.join('/')).sort()),finals.map(f=>f.map(k=>k.r.id).sort()));
          flexible ||= finals.every(f=>f.length);
        }
        assert.deepEqual(actual.map(m=>m.row.keys.join('/')).sort(),expected.sort());
      }
      assert.ok(flexible,l.id);
    }
  }
});
test('the short owl return and the costly two-way snow fork have real counterexamples at identical eighth-cue exits',()=>{
  const l=insertCasts[1][1][1],s=practiceSource(l),base=s.tape[6];
  assert.deepEqual(tailPrices(tailRoutes(l,base,1)),[2,Infinity]);
  const mids=tailRoutes(l,base,0),both=mids.filter(m=>m.finals.every(f=>f.length));
  assert.equal(both.length,1);assert.ok(mids.length>both.length);
  assert.deepEqual(both[0].prices,[6,4]);
  const desk={...newTail(l,s),both:true,end:1},cue=tailCue(l,desk);
  const single=mids.find(m=>!m.finals[1].length);
  assert.deepEqual(single.row.ports,both[0].row.ports);assert.equal(cueMatch(l,cue,single.row.slots),null);
  assert.ok(cueMatch(l,cue,both[0].row.slots));assert.equal(cueMatch(l,cue,base),null);
});
test('a blocked table route can reopen by restaging only cue seven under the original live beam and return mark',()=>{
  for(const l of insertCasts[0][0]){
    const sources=signedSevens(l).filter(p=>!tailRoutes(l,p[6],0).length);assert.ok(sources.length);
    for(const tape of sources){
      const source={tape,peer:null},options=prepOptions(l,source,0);
      assert.ok(options.length);const desk={...newTail(l,source),prep:true};
      assert.ok(!cueMatch(l,tailCue(l,desk),tape[6]));
      for(const r of options)assert.ok(tailRoutes(l,r.slots,0).length);
      const cheap=tailPrices(tailRoutes(l,tape[6],1)),both=tailPrices(tailRoutes(l,tape[6],1).filter(m=>m.finals.every(f=>f.length)));
      assert.deepEqual(cheap,[2,4]);assert.deepEqual(both,[3,4]);
    }
  }
});
test('manual socket changes and one-step hints respect all locked panes and reach the chosen lowest cost including a two-way midpoint',()=>{
  for(const l of insertCasts.flat(2)){
    const source=practiceSource(l);
    for(const route of [0,1])for(const end of [0,1])for(const both of [false,true]){
      const s={...newTail(l,source,route),end,both},mids=tailRoutes(l,source.tape[6],route).filter(m=>!both||m.finals.every(f=>f.length));
      const expected=tailPrices(mids)[end];if(!Number.isFinite(expected))continue;
      for(const stage of [8,9]){
        const cue=tailCue(l,s);
        for(const id of cue.rack.hold.held)assert.equal(insertPane(l,cue.rack,s.slots,id,s.slots[id]),null);
        for(let k=0;k<11;k++){
          const h=tailHint(l,s,cue);if(h.ready)break;
          assert.ok(!h.reset);
          s.slots=insertPane(l,cue.rack,s.slots,h.id,h.place);assert.ok(s.slots);
          assert.ok(differentPanes(l,cue.rack.from.slots,s.slots).length<=3);
        }
        assert.ok(cueMatch(l,cue,s.slots));if(stage===8)s.mid=s.slots;else s.last=s.slots;
      }
      assert.equal(tailCost(l,s),expected);
    }
  }
});
test('signed tickets, rehearsals and a double ending require their own actual midpoint, source and valid final glasses',()=>{
  storage.clear();const l=insertCasts[0][1][0],s=practiceSource(l),other=foldPartner(l),peer=[];
  while(peer.length<7)peer.push(foldOptions(other,peer,{leg:'reply',low:false,tape:s.tape})[0].o.slots);
  const official={tape:s.tape,peer},mids=tailRoutes(l,s.tape[6],0),both=mids.filter(m=>m.finals.every(f=>f.length));
  assert.ok(both.length>1);
  const ticket=(source,m,end)=>({source,route:0,end,mid:m.row.slots,last:m.finals[end][0].slots});
  const a=ticket(official,both[0],0),b=ticket(official,both[0],1);
  assert.equal(recordTail(l,{...a,last:s.tape[6].slice(0,3)}),false);
  assert.equal(recordTail(l,{...a,source:{...official,peer:peer.slice(1)}}),false);
  assert.equal(bestTail(l,0,0,true),null);assert.equal(recordTail(l,a),false);
  storePlaybill(l,s.tape);recordFold(l,s.tape);assert.equal(recordTail(l,a),false);
  storePlaybill(other,peer);recordFold(other,peer);assert.ok(recordTail(l,a));
  assert.ok(recordTail(l,ticket(s,both[0],1)));assert.ok(recordTail(l,ticket(official,both[1],1)));
  assert.equal(twinTail(l,a),null);assert.equal(savedTwin(l,0,true),null);assert.equal(bestTail(l,0,0,false),null);
  assert.ok(recordTail(l,b));assert.deepEqual(twinTail(l,a),b.last);assert.ok(savedTwin(l,0,true));
  assert.ok(bestTail(l,0,1,true));assert.equal(savedTwin(l,0,false),null);assert.ok(validTail(l,b));
  const broken={...newTail(l,s),slots:[null]};saveTailDesk(l,broken);
  assert.deepEqual(readTailDesk(l,false).slots,s.tape[6]);
  write('slip:tail-desk:'+l.id+':true',{...newTail(l,official),mid:[null]});assert.equal(readTailDesk(l,true),null);
});

test('restaging the return preserves the authenticated partner even after the original solo records are superseded',()=>{
  storage.clear();const l=insertCasts[0][0][0],other=foldPartner(l);
  const tape=signedSevens(l).find(p=>!tailRoutes(l,p[6],0).length),peer=[];
  while(peer.length<7)peer.push(foldOptions(other,peer,{leg:'reply',low:false,tape})[0].o.slots);
  const source={tape,peer},replacement=prepOptions(l,source,0)[0].slots;
  assert.equal(retakeReturn(l,source,replacement),null);
  assert.deepEqual(retakeReturn(l,{tape,peer:null},replacement),{tape:[...tape.slice(0,6),replacement],peer:null});
  assert.equal(storage.size,0);
  for(const [side,t] of [[l,tape],[other,peer]]){storePlaybill(side,t);recordFold(side,t);}
  assert.ok(signedSource(l,source));
  for(const key of [...storage.keys()])if(!key.includes('tail-source:'))storage.delete(key);
  assert.equal(retakeReturn(l,source,tape[5]),null);
  const revised=retakeReturn(l,source,replacement);assert.deepEqual(revised.peer,peer);assert.deepEqual(revised.tape.slice(0,6),tape.slice(0,6));
  assert.ok(signedSource(l,revised));assert.ok(tailRoutes(l,revised.tape[6],0).length);
});
