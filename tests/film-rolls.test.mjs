import test from 'node:test';
import assert from 'node:assert/strict';
import {rolls} from '../bloom-glass/film-rolls.mjs';
import {adviseRoll,forecast,plannedSetting,rehearsalBase,restoreRoll,spentTurns,withinChange} from '../bloom-glass/film-path.mjs';
import {inspectNight} from '../bloom-glass/light-path.mjs';
import {bestRecord,bestStrip,keepStrip} from '../bloom-glass/film-album.mjs';

const bits=n=>n.toString(2).replaceAll('0','').length;
const states=r=>Array.from({length:2**r.controls.length},(_,n)=>n);
function legal(frame,a,b) {
  if(a==null) return true;
  return bits(a^b)<=frame.limit && frame.controls.every(c=>!frame.wax?.includes(c.key) || (a&c.bit)===(b&c.bit));
}
function allStrips(roll) {
  const options=roll.frames.map(f=>states(roll).filter(s=>inspectNight(f,s).done));
  return options.reduce((prefixes,opts,i)=>prefixes.flatMap(p=>opts.filter(s=>legal(roll.frames[i],p.at(-1),s)).map(s=>[...p,s])),[[]]);
}
const cost=strip=>strip.reduce((n,s,i)=>n+(i?bits(s^strip[i-1]):0),0);
const hasPrefix=(strip,prefix)=>prefix.every((s,i)=>strip[i]===s);

test('each of the 15 frames uses both slips and every roll rewards thinking past the current shot',()=>{
  assert.deepEqual(rolls.map(r=>r.frames.length),[2,2,2,3,3,3]);
  for(const r of rolls) {
    const paths=allStrips(r),costs=paths.map(cost);
    assert.ok(paths.length,r.id);
    assert.equal(r.par,Math.min(...costs));
    assert.ok(r.frames[0].acceptable.some(s=>!paths.some(p=>p[0]===s)),r.id+' trap at the first shutter');
    for(const f of r.frames) {
      const results=states(r).map(s=>inspectNight(f,s));
      assert.ok(results.some(v=>v.inside && !v.outside),r.id+' inside alone');
      assert.ok(results.some(v=>v.outside && !v.inside),r.id+' outside alone');
    }
    if(r.frames.length===3) {
      assert.ok(r.frames[0].acceptable.some(a=>r.frames[1].acceptable.some(b=>legal(r.frames[1],a,b)) && !paths.some(p=>p[0]===a)),r.id+' a two-shot prefix cannot always reach the third');
    }
    if(r.challenge) {
      // A higher-cost strip must have a different optical route, even after ignoring idle controls.
      const cheapestByRoute=new Map();
      for(const strip of paths) {
        const key=JSON.stringify(strip.map((s,i)=>inspectNight(r.frames[i],s).rays.map(ray=>ray.points)));
        cheapestByRoute.set(key,Math.min(cost(strip),cheapestByRoute.get(key)??Infinity));
      }
      assert.ok([...cheapestByRoute.values()].some(n=>n>r.par),r.id);
    }
  }
});

test('forecast agrees with independent enumeration for viable and stranded prefixes',()=>{
  for(const r of rolls) {
    const paths=allStrips(r);
    let prefixes=[[]];
    for(const f of r.frames) {
      const next=[];
      for(const p of prefixes) for(const s of f.acceptable) {
        const answer=forecast(r,p,s);
        if(!legal(f,p.at(-1),s)) { assert.equal(answer.matched,false); continue; }
        const head=[...p,s],completions=paths.filter(c=>hasPrefix(c,head));
        assert.equal(answer.matched,true);
        assert.equal(answer.possible,Boolean(completions.length));
        assert.equal(answer.total,completions.length?Math.min(...completions.map(cost)):null);
        next.push(head);
      }
      prefixes=next;
    }
  }
});

test('whole-roll hints respect wax and remaining changes, and rewind only the necessary suffix',()=>{
  for(const r of rolls) {
    const all=allStrips(r);
    for(const precise of [false,true]) {
      const targets=all.filter(p=>!precise || cost(p)===r.par);
      let prefixes=[[]];
      for(const f of r.frames) {
        const next=[];
        for(const shots of prefixes) {
          const keep=targets.filter(p=>hasPrefix(p,shots));
          let s=shots.at(-1)??r.start;
          if(!keep.length) {
            const h=adviseRoll(r,shots,s,precise);
            assert.equal(h.type,'rewind');
            assert.ok(targets.some(p=>hasPrefix(p,shots.slice(0,h.frame))));
            assert.equal(targets.some(p=>hasPrefix(p,shots.slice(0,h.frame+1))),false);
          } else {
            for(let k=0;k<=r.controls.length;k++) {
              const h=adviseRoll(r,shots,s,precise);
              if(h.type==='shoot') break;
              assert.equal(h.type,'turn'); s^=h.control.bit;
              assert.ok(legal(f,shots.at(-1),s));
            }
            assert.ok(keep.some(p=>p[shots.length]===s));
          }
          for(const candidate of f.acceptable) if(legal(f,shots.at(-1),candidate))next.push([...shots,candidate]);
        }
        prefixes=next;
      }
    }
    for(let i=1;i<r.frames.length;i++) {
      const f=r.frames[i]; if(!f.wax)continue;
      assert.ok(r.frames[i-1].acceptable.some(a=>f.acceptable.some(b=>bits(a^b)<=f.limit && !withinChange(f,a,b))),r.id+' wax changes the possible transitions');
    }
  }
});

test('roll drafts retain valid exposures and bounded undo; later playthroughs keep the best print',()=>{
  const stored=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)}});
  const r=rolls[4], paths=allStrips(r), optimal=paths.find(p=>cost(p)===r.par),slow=paths.find(p=>cost(p)>r.par);
  const [first,second]=optimal;
  const oldest={shots:[first],setting:second,history:Array(64).fill(first),exposed:true};
  const kept=restoreRoll(r,oldest);
  assert.deepEqual(kept.shots,[first]); assert.equal(kept.setting,second); assert.equal(kept.history.length,40); assert.ok(kept.exposed);
  const truncated=restoreRoll(r,{shots:[first,-1],setting:999,history:[999],exposed:true});
  assert.deepEqual(truncated,{shots:[first],setting:first,history:[],exposed:false});
  assert.deepEqual(restoreRoll(r,{shots:optimal,setting:0}),{shots:optimal,setting:optimal.at(-1),history:[],exposed:true});
  assert.deepEqual(restoreRoll(r,null).shots,[]);
  assert.equal(bestRecord(r),null); keepStrip(r,slow); assert.equal(bestRecord(r),spentTurns(slow));
  keepStrip(r,optimal); keepStrip(r,slow); assert.equal(bestRecord(r),r.par); assert.deepEqual(bestStrip(r),optimal);
});

test('a pencil rehearsal chains three frames only while each preceding exposure matches',()=>{
  const r=rolls[5], [first,second,third]=allStrips(r)[0],plans={};
  assert.equal(rehearsalBase(r,[],first,1,plans),first);
  assert.equal(rehearsalBase(r,[],first,2,plans),null);
  plans[1]={base:first,setting:second}; plans[2]={base:second,setting:third};
  assert.equal(rehearsalBase(r,[],first,2,plans),second);
  assert.equal(plannedSetting(r,2,second,plans),third);
  assert.equal(rehearsalBase(r,[],first^1,2,plans),null);
  assert.equal(plannedSetting(r,1,first^1,plans),null);
  assert.equal(plannedSetting(r,1,first,{1:{base:first,setting:-1}}),null);
  assert.equal(rehearsalBase(r,[first],second,1,plans),null);
});
