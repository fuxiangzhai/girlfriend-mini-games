import test from 'node:test';
import assert from 'node:assert/strict';
import {shows} from '../bloom-glass/lantern-shows.mjs';
import {describe,fits,flip,poseKey,solve,transform,turn} from '../bloom-glass/puzzle.mjs';
import {promptProjector,punchTicket,readProjector,ticketFor} from '../bloom-glass/projection.mjs';
import {write} from '../bloom-glass/save.mjs';

const saved=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
  getItem:key=>saved.get(key) ?? null,setItem:(key,value)=>saved.set(key,value)
}});

// Make a second catalogue from occupancy and two transformed endpoints of
// each mirror. This also exercises symmetric panes with asymmetric engraving.
function physical(level,id,p) {
  const d=describe(level,id,p);
  if (!d) return null;
  const piece=level.pieces[id];
  const at=offset=>{const [x,y]=transform(offset,p.o);return (y+p.y)*level.width+x+p.x;};
  let mirror=null,star=null,fall=null;
  if(piece.mirror) {
    mirror=at(piece.mirror.offset);
    const [x,y]=transform([1,piece.mirror.falls?1:-1],p.o);
    fall=x*y>0;
  }
  if(piece.star)star=at(piece.star);
  return {place:p,mask:d.mask,mirror,fall,star,key:[d.mask,mirror,fall,star].join(':')};
}
function independent(level) {
  const byPiece=level.pieces.map((p,id)=>{
    const set=new Map();
    for(let o=0;o<(level.flip?8:4);o++)for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){
      const v=physical(level,id,{o,x,y});if(v)set.set(v.key,v);
    }
    return [...set.values()];
  });
  const all=[],slots=[];
  function branch(i,occupied) {
    if(i===byPiece.length){all.push([...slots]);return;}
    for(const q of byPiece[i])if(!(q.mask&occupied)){slots[i]=q;branch(i+1,occupied|q.mask);}
  }
  branch(0,0n);return all;
}
const layouts=shows.map(independent);
function oracle(level,cut) {
  const {width:w,height:h,projection:p}=level;
  const ports={T:i=>[i,-1,0,1],R:i=>[w,i,-1,0],B:i=>[i,h,0,-1],L:i=>[-1,i,1,0]};
  const rays=p.entries.map(e=>{
    let [x,y,dx,dy]=ports[e[0]](+e.slice(1)-1);
    let star=false,turns=0;const crossing=new Set();
    for(let step=0;step<=w*h*4;step++) {
      x+=dx;y+=dy;
      if(x<0||x>=w||y<0||y>=h)return {exit:x<0?'L'+(y+1):x>=w?'R'+(y+1):y<0?'T'+(x+1):'B'+(x+1),star,crossing,turns};
      const at=y*w+x,m=cut.find(c=>c.mirror===at);
      if(cut.some(c=>c.star===at))star=true;
      if(m){[dx,dy]=m.fall?[dy,dx]:[-dy,-dx];turns++;}
      else if(at===p.cross)crossing.add(dx?'horizontal':'vertical');
    }
    assert.fail('boundary ray failed to exit');
  });
  const registered=p.cross==null || rays[0].crossing.has('horizontal')&&rays[1].crossing.has('vertical') ||
    rays[1].crossing.has('horizontal')&&rays[0].crossing.has('vertical');
  return {rays,registered};
}

test('all physical tilings agree with an independent reflection and crossing oracle',()=>{
  for(const [i,level] of shows.entries()){
    const keys=new Set();
    solve(level,undefined,false,null,slots=>{keys.add(slots.map((p,id)=>physical(level,id,p).key).join('|'));return false;});
    assert.equal(keys.size,layouts[i].length,level.title);
    let wrong=0;
    const marks=level.projection.scenes.map(()=>({plain:0,star:0,oneLamp:[],missedCircle:0}));
    for (const cut of layouts[i]){
      assert.ok(keys.has(cut.map(c=>c.key).join('|')));
      const result=readProjector(level,cut.map(c=>c.place)), wanted=oracle(level,cut);
      assert.deepEqual(result.rays.map(r=>r.exit),wanted.rays.map(r=>r.exit));
      assert.deepEqual(result.rays.map(r=>r.turns),wanted.rays.map(r=>r.turns));
      assert.deepEqual(result.rays.map(r=>r.star),wanted.rays.map(r=>r.star));
      assert.equal(result.registered,wanted.registered);
      if(result.scene<0)wrong++;
      level.projection.scenes.forEach((scene,j)=>{
        const flags=scene.exits.map((e,k)=>wanted.rays[k].exit===e);
        if(flags.every(Boolean) && !wanted.registered)marks[j].missedCircle++;
        if(flags.some(v=>!v))flags.forEach((v,k)=>{if(v)marks[j].oneLamp[k]=true;});
        if(result.scene!==j)return;
        assert.ok(flags.every(Boolean) && wanted.registered && result.rays.every(r=>r.turns>0));
        marks[j][result.star?'star':'plain']++;
      });
    }
    assert.ok(wrong>0);
    for(const m of marks){
      assert.ok(m.plain>0);
      if(level.projection.starLamp!=null)assert.ok(m.star>0);
      if(level.projection.entries.length===2)assert.deepEqual(m.oneLamp,[true,true]);
      if(level.projection.cross!=null)assert.ok(m.missedCircle>0);
    }
  }
});

test('silver and the dark star move with the pane, including a symmetric square turned in place',()=>{
  const l=shows.at(-1),id=1,p=l.pieces[id];
  assert.ok(p.mirror);
  for (let o=0;o<8;o++){assert.equal(turn(turn(turn(turn(o)))),o);assert.equal(flip(flip(o)),o);}
  const same=new Map();
  for(const cut of layouts.at(-1)){
    const m=cut[id],v=same.get(m.mask)||new Set();v.add(poseKey(l,id,m.place));same.set(m.mask,v);
  }
  assert.ok([...same.values()].some(x=>x.size>=4));
  const first=shows[0],draft=first.sample;
  assert.deepEqual(readProjector(first,draft).rays[0].blocked,[0,0]);
  assert.equal(readProjector(first,draft).scene,-1);
});

test('route and star hints preserve the largest possible subset of a full wrong board',()=>{
  for(const [i,l] of shows.entries()){
    const options=layouts[i].map(c=>({keys:c.map(q=>q.key),slots:c.map(q=>q.place),r:readProjector(l,c.map(q=>q.place))}));
    const wrong=options.find(v=>v.r.scene===-1);
    for(const [scene] of l.projection.scenes.entries()){
      const star=l.projection.starLamp!=null,valid=options.filter(v=>v.r.scene===scene && (!star||v.r.star));
      const min=Math.min(...valid.map(v=>v.keys.filter((k,j)=>wrong.keys[j]!==k).length));
      const slots=[...wrong.slots];let removed=0;
      for(let n=0;n<2*l.pieces.length+1;n++){
        const step=promptProjector(l,slots,slots.findIndex(p=>!p),scene,star);
        assert.ok(step);
        if(step.type==='ready')break;
        if(step.type==='lift'){assert.equal(step.count,min-removed);removed++;slots[step.id]=null;}
        else {assert.equal(slots[step.id],null);assert.ok(fits(l,slots,step.id,step.place));slots[step.id]=step.place;}
      }
      assert.equal(removed,min);
      const r=readProjector(l,slots);assert.equal(r.scene,scene);assert.equal(r.star,star);
    }
  }
});

test('only seated, geometrically valid performances punch tickets; editions and star prints survive replays',()=>{
  const l=shows.at(-1);
  const opts=layouts.at(-1).map(c=>({slots:c.map(q=>q.place),r:readProjector(l,c.map(q=>q.place))}));
  const bad=opts.find(v=>v.r.scene<0);
  assert.equal(punchTicket(l,l.sample),null);assert.equal(punchTicket(l,bad.slots),null);
  assert.equal(punchTicket(l,bad.slots.map(()=>bad.slots[0])),null);
  for(const i of [0,1]){
    for(const star of [false,true,false]){
      const hit=opts.find(v=>v.r.scene===i && v.r.star===star);
      assert.equal(punchTicket(l,hit.slots).scene,i);
    }
    assert.equal(ticketFor(l,i).result.star,true);
  }
  write('lantern:ticket:'+l.id+':1:star',bad.slots);
  assert.equal(ticketFor(l,1).result.star,false);
  assert.equal(ticketFor(l,0).result.star,true);
});
