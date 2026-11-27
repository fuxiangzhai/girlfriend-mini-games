import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { flashAt, launch, lightAt, lightStation, logbook, moor, nextPassage, passages, sail, sounding, voyage } from "../moon-mail/afterglow.mjs";

const letter=letters.find(l=>l.id==="lighthouse");
const day=lightStation(letter,"standard"), night=lightStation(letter,"expert");
const dx=[1,0,-1,0], dy=[0,1,0,-1];

// Independently trace each lamp from the printed rows, then search the clock
// square by square, without using the game's neighbor, light or voyage functions.
function survey(rows,beacons,limit) {
  const width=rows[0].length, height=rows.length, tile=rows.join("");
  const start=tile.search(/[<>v^]/), box=tile.indexOf("M");
  const lamps=[[start,">v<^".indexOf(tile[start]),1],...beacons];
  const rings=lamps.map(l=>l[0]), lights=[], routes=new Set();
  const step=(c,d)=>{
    const x=c%width+dx[d],y=Math.floor(c/width)+dy[d];
    return x>=0&&x<width&&y>=0&&y<height&&rows[y][x]!=="#" ? y*width+x : -1;
  };
  for(let i=0;i<limit;i++) {
    const frame=new Set();
    for(const [origin,bearing,spin] of lamps) {
      let c=origin,d=(bearing+i*spin+4*limit)%4;
      const seen=new Set();
      while(c>=0&&!seen.has(c*4+d)) {
        frame.add(c);seen.add(c*4+d);
        const next=step(c,d);
        if(tile[next]==="A") d=[3,2,1,0][d];
        else if(tile[next]==="B") d=[1,0,3,2][d];
        c=next;
      }
    }
    lights.push(frame);
  }
  function visit(c,code,occupied,full) {
    const i=code.length;
    if(i===limit) {if(c===box)routes.add(code);return;}
    for(let d=0;d<4;d++) {
      const n=step(c,d);
      if(n<0||occupied.has(n)||(n===box&&i+1<limit)) continue;
      const bright=lights[i].has(n);
      if(!bright && !(full&&i&&lights[i-1].has(n)))continue;
      visit(n,code+d,new Set([...occupied,n]),full&&bright);
    }
    if(rings.includes(c))visit(c,code+"4",occupied,full);
  }
  visit(start,"",new Set([start]),true);
  return {lights,routes};
}

test("the unaltered day and night charts and their sweeping lamps produce exactly six and five crossings",()=>{
  assert.equal(lightStation(letter,"relaxed"),day);
  for(const [station,rows,beacons,n,count] of [[day,letter.rows,[[2,3,1],[8,1,1]],7,6],[night,letter.expert,[[15,1,1],[17,2,-1]],8,5]]) {
    assert.equal(station.board.tiles,rows.join(""));assert.equal(station.limit,n);
    const {lights,routes}=survey(rows,beacons,n);
    lights.forEach((frame,i)=>assert.deepEqual(flashAt(station,i+1).lit,frame));
    assert.deepEqual(new Set(logbook(station).keys()),routes);
    assert.equal(routes.size,count);
    assert.deepEqual(new Set([...routes].map(code=>voyage(station,code).style)),new Set(passages));
  }
  assert.deepEqual(flashAt(day,1).beams[0].line,[10,11,12,13,18]);
  assert.deepEqual(night.phases.map(f=>f.beams[2].dir),[2,1,0,3]);
});

test("at the fourth landing D2, two waits or one fading square reach the same seventh flash from different banks",()=>{
  const fork=voyage(day,"0300");
  assert.equal(fork.cell,8); assert.deepEqual(fork.trail,[10,11,6,7,8]);
  assert.equal(sounding(day,fork,8),"moor"); assert.equal(sounding(day,fork,9),"fading");
  assert.deepEqual([lightAt(day,9,4),lightAt(day,9,5),lightAt(day,9,6)],["lit","fading","dark"]);
  const a=voyage(day,"0300443"), b=voyage(day,"0300032");
  assert.equal(a.style,"clear");assert.equal(b.style,"running");
  assert.deepEqual(a.trail.slice(4),[8,8,8,3]); assert.deepEqual(b.trail.slice(4),[8,9,4,3]);
  assert.deepEqual(a.waits,[5,6]);assert.deepEqual(b.waits,[]);
  assert.equal(a.glow,null);assert.deepEqual(b.glow,{beat:5,cell:9});
  const nightRun=voyage(night,"33001033"), nightClear=voyage(night,"33000443");
  assert.deepEqual(nightRun.trail.slice(0,5),nightClear.trail.slice(0,5));
  assert.deepEqual(nightRun.glow,{beat:5,cell:22});assert.equal(nightClear.glow,null);
});

test("light is borrowed from the preceding flash exactly once, and a wake, a closed box or open water cannot be reused as a berth",()=>{
  const first=sail(day,launch(day),0);
  assert.equal(sounding(day,first,10),"wake");assert.equal(sail(day,first,2),null);assert.equal(sail(day,first,moor),null);
  assert.equal(sounding(day,voyage(day,"0300"),3),"early");
  const used=voyage(day,"00");assert.deepEqual(used.glow,{beat:2,cell:12});
  const empty=voyage(day,"0030");assert.equal(sounding(day,empty,9),"empty");assert.equal(sail(day,empty,0),null);
  assert.equal(sounding(day,launch(day),5),"dark");
  assert.equal(voyage(day,"4444444").style,null);assert.equal(sail(day,voyage(day,"4444444"),0),null);
  assert.equal(sail(day,voyage(day,"0300443"),moor),null);
  assert.equal(voyage(day,"0300443".slice(0,4)).glow,null);
  for(const damaged of [null,{},[0],"x4","00a","1","03004433","03042"])assert.equal(voyage(day,damaged),null);
});

test("the same night waterway takes a full bottle or an empty one depending on which buoy hosts the two waits",()=>{
  const late=voyage(night,"33000443"), early=voyage(night,"33044003");
  const waterway=trip=>trip.trail.filter((cell,i,line)=>cell!==line[i-1]);
  assert.deepEqual(waterway(late),waterway(early));
  assert.deepEqual(late.waits.map(beat=>late.trail[beat]),[17,17]);
  assert.deepEqual(early.waits.map(beat=>early.trail[beat]),[15,15]);
  assert.equal(late.glow,null);assert.deepEqual(early.glow,{beat:6,cell:16});
  assert.equal(late.style,"clear");assert.equal(early.style,"harbor");
});

test("a stored crossing can branch at the last shared flash and the full or spent bottle is restored from that prefix",()=>{
  const posted="0300443", filed=new Set([posted]);
  const next=nextPassage(day,posted,filed,"running");
  assert.equal(next.keep,4);assert.equal(next.trip.code,"0300032");assert.equal(voyage(day,posted.slice(0,next.keep)).glow,null);
  const third=nextPassage(day,"0030443",new Set(["0030443"]),"harbor");
  assert.equal(third.keep,3);assert.deepEqual(voyage(day,"003").glow,{beat:2,cell:12});
  const known=nextPassage(day,posted,new Set(logbook(day).keys()),"clear");
  assert.equal(known.fresh,false);assert.notEqual(known.trip.code,posted);
});

test("hints for every reachable prefix lead to a real requested crossing and use the least possible rewind to an unfiled one",()=>{
  for(const station of [day,night]) {
    const states=[launch(station)];
    for(const s of states)for(let d=0;d<=moor;d++){const v=sail(station,s,d);if(v) states.push(v);}
    const all=[...logbook(station).values()];
    for(const filed of [new Set(),new Set(all.filter((_,i)=>i%2===0).map(v=>v.code)),new Set(all.map(v=>v.code))]) {
      for(const target of [null,...passages]) for(const s of states) {
        if(s.style)continue;
        const allowed=all.filter(v=>!target||v.style===target),fresh=allowed.filter(v=>!filed.has(v.code));
        const pool=fresh.length?fresh:allowed;
        const plan=nextPassage(station,s.code,filed,target);
        let n=s.code.length;
        while(!pool.some(p=>p.code.startsWith(s.code.slice(0,n)))) n--;
        assert.equal(plan.keep,n);assert.ok(pool.includes(plan.trip));
        const prefix=voyage(station,s.code.slice(0,n));
        assert.ok(sail(station,prefix,Number(plan.trip.code[n])));
      }
    }
  }
});
