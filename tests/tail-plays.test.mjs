import test from 'node:test';
import assert from 'node:assert/strict';
import {foldPartner,insertCasts} from '../bloom-glass/duet-plays.mjs';
import {courierBook,courierCue,fare,orders,stationCourses} from '../bloom-glass/courier-score.mjs';
import {pairEnding} from '../bloom-glass/counter-plays.mjs';
import {foldOptions,recordFold} from '../bloom-glass/fold-score.mjs';
import {poseKey,solve} from '../bloom-glass/puzzle.mjs';
import {readProjector} from '../bloom-glass/projection.mjs';
import {write} from '../bloom-glass/save.mjs';
import {differentPanes,storePlaybill} from '../bloom-glass/slip-path.mjs';
import {endsIn,tailKeeper,tailPorts} from '../bloom-glass/tail-plays.mjs';
import {actualPrice,anchor,bestPrice,bestTail,cueMatch,insertPane,newTail,practiceSource,prepOptions,readTailDesk,recordedEnds,recordTail,retakeReturn,roadPlans,saveTailDesk,savedGroup,savedTwin,sharedPrice,signedSource,tailCost,tailCue,tailHint,tailPrices,tailRoutes,twinTail,validTail} from '../bloom-glass/tail-score.mjs';

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
const groups=[3,5,6,7];
test('every signed seventh can leave three destinations on a side fold; an independent optical search matches all boards, prices and shared bills',()=>{
  for(const family of insertCasts){
    const {rows,step}=oracle(family[0][0]);
    for(const l of family.flat())for(const tape of signedSevens(l)){
      const base=tape[6],start=rows.find(r=>r.id===signature(l,base));let oldPair=false,sideTriple=false;
      for(const flap of [0,1])for(const route of [0,1]){
        const actual=tailRoutes(l,base,route,flap),expected=[],minima=groups.map(()=>Infinity);
        const lead=tailKeeper(l,route,null,flap);
        for(const {r,cost} of step(start,lead,tailPorts(l,route,null,flap))){
          const finals=[0,1,2].map(e=>{
            const exits=tailPorts(l,route,e,flap);if(!exits)return [];
            const keeper=r.exits.findIndex((p,k)=>p===exits[k]);
            assert.equal(tailKeeper(l,route,e,flap),keeper);
            return step(r,keeper,exits);
          });
          if(!finals.some(f=>f.length))continue;
          expected.push(r.id);
          const m=actual.find(x=>x.row.keys.join('/')===r.id);assert.ok(m);
          assert.deepEqual(m.prices,finals.map(f=>Math.min(...f.map(k=>cost+k.cost))));
          assert.deepEqual(m.finals.map(f=>f.map(k=>k.keys.join('/')).sort()),finals.map(f=>f.map(k=>k.r.id).sort()));
          for(const [i,mask] of groups.entries()){
            const combined=endsIn(mask).reduce((n,e)=>n+Math.min(...finals[e].map(k=>k.cost)),cost);
            assert.equal(sharedPrice(m,mask),combined);minima[i]=Math.min(minima[i],combined);
          }
          oldPair ||= !flap && finals.slice(0,2).every(f=>f.length);
          sideTriple ||= Boolean(flap) && finals.every(f=>f.length);
        }
        assert.deepEqual(actual.map(m=>m.row.keys.join('/')).sort(),expected.sort());
        assert.deepEqual(groups.map(mask=>bestPrice(actual,mask)),minima);
      }
      assert.ok(oldPair,l.id);assert.ok(sideTriple,l.id);
    }
  }
});
test('the short owl return and the costly two-way snow fork have real counterexamples at identical eighth-cue exits',()=>{
  const l=insertCasts[1][1][1],s=practiceSource(l),base=s.tape[6];
  assert.deepEqual(tailPrices(tailRoutes(l,base,1)),[2,Infinity,Infinity]);
  const mids=tailRoutes(l,base,0),both=mids.filter(m=>m.finals.slice(0,2).every(f=>f.length));
  assert.equal(both.length,1);assert.ok(mids.length>both.length);
  assert.deepEqual(both[0].prices.slice(0,2),[6,4]);
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
      const cheap=tailPrices(tailRoutes(l,tape[6],1)),both=tailPrices(tailRoutes(l,tape[6],1).filter(m=>m.finals.slice(0,2).every(f=>f.length)));
      assert.deepEqual(cheap,[2,4,Infinity]);assert.deepEqual(both,[3,4,Infinity]);
    }
  }
});
function cueWithHints(l,s){
  const cue=tailCue(l,s);
  for(const id of cue.rack.hold.held)assert.equal(insertPane(l,cue.rack,s.slots,id,s.slots[id]),null);
  for(let k=0;k<12;k++){
    const h=tailHint(l,s,cue);
    if(h.ready){assert.ok(cueMatch(l,cue,s.slots));return s.slots;}
    assert.ok(!h.reset);s.slots=insertPane(l,cue.rack,s.slots,h.id,h.place);assert.ok(s.slots);
    assert.ok(differentPanes(l,cue.rack.from.slots,s.slots).length<=3);
  }
  assert.fail('socket hints did not reach the selected target');
}
test('manual socket hints keep the live panes and attain all single, double and triple minima from each practice source',()=>{
  for(const l of insertCasts.flat(2)){
    const source=practiceSource(l);
    for(const flap of [0,1])for(const route of [0,1])for(const mask of [1,2,4,...groups]){
      const members=endsIn(mask),mids=tailRoutes(l,source.tape[6],route,flap),expected=bestPrice(mids,mask);
      if(!Number.isFinite(expected))continue;
      const s={...newTail(l,source,route),flap,end:members[0],stops:mask,both:members.length>1},legs=[];
      s.mid=cueWithHints(l,s);
      for(const end of members){
        s.end=end;s.slots=s.mid;legs[end]=cueWithHints(l,s);
      }
      assert.equal(actualPrice(l,s,legs,mask),expected);
    }
  }
});
test('signed tickets, rehearsals and a double ending require their own actual midpoint, source and valid final glasses',()=>{
  storage.clear();const l=insertCasts[0][1][0],s=practiceSource(l),other=foldPartner(l),peer=[];
  while(peer.length<7)peer.push(foldOptions(other,peer,{leg:'reply',low:false,tape:s.tape})[0].o.slots);
  const official={tape:s.tape,peer},mids=tailRoutes(l,s.tape[6],0),both=mids.filter(m=>m.finals.slice(0,2).every(f=>f.length));
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

test('on the south river steps the four-sound school visit cannot also set the table; a shared stage costs two plus one plus three',()=>{
  const l=insertCasts[0][0][0],source=practiceSource(l),mids=tailRoutes(l,source.tape[6],0,1);
  const solo=tailPrices(mids)[2],paired=bestPrice(mids,6);
  assert.equal(solo,4);assert.equal(paired,6);
  assert.ok(mids.filter(m=>m.prices[2]===solo).every(m=>!m.finals[1].length));
  const joint=mids.find(m=>sharedPrice(m,6)===paired);
  assert.deepEqual([joint.cost,...[1,2].map(e=>joint.prices[e]-joint.cost)],[2,1,3]);
  assert.deepEqual(roadPlans(l,source,6)[0],{flap:1,route:1,price:5});
  const snow=insertCasts[1][1][1],snowSource=practiceSource(snow),forest=tailRoutes(snow,snowSource.tape[6],1,1);
  assert.deepEqual(tailPrices(forest).slice(1),[4,4]);assert.equal(bestPrice(forest,6),6);
  const shared=forest.find(m=>sharedPrice(m,6)===6);
  assert.deepEqual([shared.cost,...[1,2].map(e=>shared.prices[e]-shared.cost)],[3,1,2]);
  assert.ok(forest.some(m=>sharedPrice(m,6)===6 && m.prices[1]-m.cost===2 && m.prices[2]-m.cost===1));
});

test('single shelves, each of the three double bills and the triple use only their own eighth cue and keep the cheapest real leg on an encore',()=>{
  storage.clear();const l=insertCasts[0][0][0],source=practiceSource(l);
  const rows=tailRoutes(l,source.tape[6],0,1),mid=rows.find(m=>m.finals.every(f=>f.length));
  const ticket=(m,flap,end,last=m.finals[end][0].slots)=>({source,flap,route:0,end,mid:m.row.slots,last});
  const early=mid.finals[0].map(r=>r.slots).sort((a,b)=>differentPanes(l,mid.row.slots,a).length-differentPanes(l,mid.row.slots,b).length);
  assert.notEqual(differentPanes(l,mid.row.slots,early[0]).length,differentPanes(l,mid.row.slots,early.at(-1)).length);
  const first=ticket(mid,1,0,early[0]);
  assert.ok(recordTail(l,first));assert.ok(recordTail(l,ticket(mid,1,1)));
  assert.ok(recordTail(l,ticket(rows.find(m=>m!==mid && m.finals[2].length),1,2)));
  assert.ok(recordTail(l,ticket(tailRoutes(l,source.tape[6],0).find(m=>m.finals[2].length),0,2)));
  assert.ok(savedGroup(l,0,1,3,false));assert.equal(savedGroup(l,0,1,7,false),null);
  assert.equal(savedGroup(l,0,1,6,false),null);assert.equal(recordedEnds(l,first)[2],null);
  assert.ok(recordTail(l,ticket(mid,1,2)));
  const legs=recordedEnds(l,first);
  for(const mask of groups){
    const sheet=savedGroup(l,0,1,mask,false);assert.equal(sheet.total,actualPrice(l,first,legs,mask));
    assert.deepEqual(sheet.mid,first.mid);assert.equal(savedGroup(l,0,1,mask,true),null);
  }
  const total=savedGroup(l,0,1,7,false).total;
  assert.ok(recordTail(l,ticket(mid,1,0,early.at(-1))));
  assert.equal(savedGroup(l,0,1,7,false).total,total);assert.deepEqual(recordedEnds(l,first)[0],early[0]);
  assert.deepEqual(bestTail(l,0,0,false,1).last,early[0]);
});

test('edition eleven double bills, a costlier encore and an unfinished ninth reload on their original crease and can earn a third signature',()=>{
  storage.clear();const l=insertCasts[0][0][0],source=practiceSource(l);
  const m=tailRoutes(l,source.tape[6],0).find(m=>m.finals.every(f=>f.length));
  const legs=m.finals.map(f=>f.map(r=>r.slots).sort((a,b)=>differentPanes(l,m.row.slots,a).length-differentPanes(l,m.row.slots,b).length));
  const base='slip:tail-branch:'+l.id+':'+anchor(l,source)+':0:'+m.row.keys.join(',')+':';
  const old=(end,last)=>({source,route:0,end,mid:m.row.slots,last});
  const quiet=old(0,legs[0][0]),encore=old(0,legs[0].at(-1)),sibling=old(1,legs[1][0]);
  for(const r of [quiet,encore,sibling]){
    write('slip:tail-bill:'+l.id+':0'+r.end+':trial:'+tailCost(l,r),r);
    write(base+r.end,r.last);
  }
  write('slip:tail-twin:'+l.id+':0:false',encore);
  write('slip:tail-desk:'+l.id+':false',{...encore,last:null,slots:m.row.slots,both:true,prep:false,selected:-1});
  const restored=readTailDesk(l,false);assert.equal(restored.flap,0);assert.equal(restored.stops,3);assert.deepEqual(restored.mid,quiet.mid);
  assert.deepEqual(recordedEnds(l,encore),[quiet.last,sibling.last,null]);
  assert.deepEqual(savedGroup(l,0,0,3,false).last,quiet.last);
  assert.ok(recordTail(l,old(2,legs[2][0])));
  assert.equal(savedGroup(l,0,0,7,false).total,actualPrice(l,quiet,legs.map(f=>f[0]),7));
  assert.equal(savedGroup(l,0,1,7,false),null);
});

test('resuming a side fold restores partial sockets and its whole commission, and rejects a draft that promises unreachable signatures',()=>{
  storage.clear();const l=insertCasts[0][0][0],source=practiceSource(l);
  const s={...newTail(l,source),flap:1,both:true,stops:6,end:2},cue=tailCue(l,s);
  const h=tailHint(l,s,cue);s.slots=insertPane(l,cue.rack,s.slots,h.id,h.place);
  saveTailDesk(l,s);assert.deepEqual(readTailDesk(l,false),s);
  const wrong=tailRoutes(l,source.tape[6],0,1).find(m=>m.finals[2].length && !m.finals[1].length);
  saveTailDesk(l,{...s,mid:wrong.row.slots,slots:wrong.row.slots});assert.equal(readTailDesk(l,false),null);
  saveTailDesk(l,{...s,end:0});assert.equal(readTailDesk(l,false),null);
  const revised=prepOptions(l,source,0,1,7);assert.ok(revised.length);
  for(const row of revised)assert.ok(Number.isFinite(bestPrice(tailRoutes(l,row.slots,0,1),7)));
});

test('all six itineraries on every three-way eighth match independently lifted panes, paid reversals and the cheapest ordered transfers',()=>{
  let itineraries=0,canPass=0,cheaper=0;
  const pairCounts={ff:0,fd:0,df:0,dd:0},chapters=new Set();
  for(const family of insertCasts)for(const cast of family){
    const l=cast[0],sources=new Map();
    for(const level of cast)for(const tape of signedSevens(level))sources.set(signature(level,tape[6]),{tape,peer:null});
    const edges=new Map();
    function live(a,b,k){
      const key=[a.index,b.index,k].join(':');if(edges.has(key))return edges.get(key);
      const diff=differentPanes(l,a.slots,b.slots),lift=a.slots.map((p,i)=>diff.includes(i)?null:p);
      const ray=readProjector(l,lift).rays[k],original=readProjector(l,a.slots).rays[k];
      const cost=diff.length<=3 && ray.exit===original.exit && JSON.stringify(ray.points)===JSON.stringify(original.points)?diff.length:Infinity;
      edges.set(key,cost);return cost;
    }
    for(const source of sources.values())for(const flap of [0,1])for(const route of [0,1]){
      for(const m of tailRoutes(l,source.tape[6],route,flap).filter(v=>v.finals.every(f=>f.length))){
        const suffixes=new Map();
        for(const order of orders){
          const [a,b,c]=Array.from(order,Number),keeper=e=>tailKeeper(l,route,e,flap);
          let pass=Infinity,fold=Infinity;
          for(const x of m.finals[a])for(const y of m.finals[b])for(const z of m.finals[c]){
            const first=m.cost+live(m.row,x,keeper(a)),back1=live(x,m.row,keeper(a))+live(m.row,y,keeper(b));
            const back2=live(y,m.row,keeper(b))+live(m.row,z,keeper(c));
            const direct1=Math.min(live(x,y,0),live(x,y,1)),direct2=Math.min(live(y,z,0),live(y,z,1));
            const key=order+':'+x.index,legs=suffixes.get(key) || {ff:Infinity,df:Infinity,fd:Infinity,dd:Infinity};
            legs.ff=Math.min(legs.ff,back1+back2);legs.df=Math.min(legs.df,direct1+back2);
            legs.fd=Math.min(legs.fd,back1+direct2);legs.dd=Math.min(legs.dd,direct1+direct2);suffixes.set(key,legs);
            fold=Math.min(fold,first+back1+back2);
            pass=Math.min(pass,first+direct1+back2,first+back1+direct2,first+direct1+direct2);
          }
          assert.equal(fare(l,courierBook(source,flap,route,m.row.slots,order,'fold')),fold);
          assert.equal(fare(l,courierBook(source,flap,route,m.row.slots,order,'direct')),pass);
          assert.ok(Number.isFinite(fold));itineraries++;if(Number.isFinite(pass))canPass++;if(pass<fold)cheaper++;
        }
        for(const [first,rows] of m.finals.entries())for(const row of rows){
          const [left,right]=orders.filter(o=>Number(o[0])===first),keeper=tailKeeper(l,route,first,flap);
          const leftLegs=suffixes.get(left+':'+row.index),rightLegs=suffixes.get(right+':'+row.index);
          const shared=m.cost+live(m.row,row,keeper);
          const desk={...courierBook(source,flap,route,m.row.slots,left,'fold'),phase:'play',slots:row.slots,steps:[
            {kind:'mid',end:null,keeper:tailKeeper(l,route,null,flap),slots:m.row.slots},{kind:'first',end:first,keeper,slots:row.slots}
          ]};
          const courses=stationCourses(l,desk);
          for(const [order,legs] of [[left,leftLegs],[right,rightLegs]])for(const [pattern,cost] of Object.entries(legs)){
            const actual=courses.find(c=>c.order===order && c.legs===pattern);
            assert.equal(actual?.path.total??Infinity,shared+cost);
          }
          const suffix=(legs,letter)=>letter==='f'?legs.ff:Math.min(legs.df,legs.fd,legs.dd);
          for(const pair of Object.keys(pairCounts)){
            const expected=shared+suffix(leftLegs,pair[0])+suffix(rightLegs,pair[1]);
            const cue=courierCue(l,{...desk,pair,way:pair[0]==='d'?'direct':'fold'});
            assert.equal(cue?.best??Infinity,expected);
            if(Number.isFinite(expected)){pairCounts[pair]++;chapters.add(pairEnding(l,first,pair).title);}
          }
        }
      }
    }
  }
  assert.deepEqual([itineraries,canPass,cheaper],[354,236,191]);
  assert.deepEqual(pairCounts,{ff:453,fd:416,df:224,dd:187});assert.equal(chapters.size,19);
});
