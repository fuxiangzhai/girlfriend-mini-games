import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { rainDesk, foldHistory, foldHint, shadeAt, printId, previewFold, commonFolds,
  alternateFold, differences, creaseSet, foldPair, inkTrail } from "../moon-mail/rain-folds.mjs";

const lane=letters.find(l=>l.id==="rain"),day=rainDesk(lane,"standard"),night=rainDesk(lane,"expert");

// Lay the short flap onto the long side, press each physical pair and open
// it out again. Use individual coloured squares, independent of the bitsets.
function handPrints(rows, limit, clip) {
  const cols=rows[0].length, h=rows.length, text=rows.join(""), marks=new Map();
  const root=Array.from(text,ch=>"><v^".includes(ch)?1:0), box=text.indexOf("M");
  function visit(sheet,code) {
    if (sheet[box]===2) {marks.set(code,sheet);return;}
    if (code.length===limit) return;
    for (let axis=0;axis<2;axis++) {
      const length=axis?h:cols, lanes=axis?cols:h;
      for (let seam=1;seam<length;seam++) {
        const key=String.fromCharCode(65+(axis?cols-1:0)+seam-1);
        if (code.includes(key) && (!clip || new Set(code).size<code.length)) continue;
        const folded=sheet.slice(), flap=Math.min(seam,length-seam);
        for (let d=0;d<flap;d++) for (let lane=0;lane<lanes;lane++) {
          const cell=i=>axis?i*cols+lane:lane*cols+i;
          const a=cell(seam-1-d),b=cell(seam+d);
          if (text[a]==="#" || text[b]==="#") continue;
          const colour=Math.max(sheet[a],sheet[b]);
          for (const c of [a,b]) folded[c]=text[c]==="*" && colour ? 2 : colour;
        }
        if (folded.some((v,c)=>v!==sheet[c])) visit(folded,code+key);
      }
    }
  }
  visit(root,"");return marks;
}

test("pressing and reopening both original charts by hand reproduces every crease sequence and every coloured square",()=>{
  for (const [desk,rows,total,codes] of [[day,lane.rows,9,60],[night,lane.expert,7,29]]) {
    assert.equal(desk.board.tiles,rows.join(""));
    const expected=handPrints(rows,desk.limit,desk===day);
    assert.equal(expected.size,codes);assert.equal(desk.solutions.size,codes);
    assert.equal(new Set([...expected.values()].map(p=>p.join(""))).size,total);assert.equal(desk.prints.size,total);
    for (const [code,physical] of expected) {
      const sheet=desk.solutions.get(code);
      assert.deepEqual(Array.from(desk.board.tiles,(_,i)=>shadeAt(sheet,i)),physical);
      assert.deepEqual(foldHistory(desk,code).at(-1),sheet);
      assert.equal(code.length,desk.limit);
    }
  }
  assert.equal(rainDesk(lane,"relaxed"),day);
});

test("swapping the last two day creases changes only the colour by the window on E3",()=>{
  const a=day.solutions.get("BGHCIDH"),b=day.solutions.get("BGHCIHD");
  assert.equal(commonFolds(a.code,b.code),5);assert.equal(creaseSet(a.code),creaseSet(b.code));
  assert.deepEqual(differences(day,a,b),[16]);assert.deepEqual([shadeAt(a,16),shadeAt(b,16)],[1,2]);
  assert.equal(foldPair(day,a,b),true);
  assert.equal(foldHint(day,"").finish,a);
  assert.deepEqual(alternateFold(day,a),{sheet:b,keep:5,pair:true});
  const c=day.solutions.get("BGHIHCD"),d=day.solutions.get("BGHIHDE");
  for (const window of [14,26]) assert.deepEqual([shadeAt(c,window),shadeAt(d,window)],[2,0]);
});

test("on the night chart the very same six fresh creases can wet both bottom windows or leave only a red B5",()=>{
  const a=night.solutions.get("CAFHIG"),b=night.solutions.get("CAGIHF");
  assert.equal(commonFolds(a.code,b.code),2);assert.equal(new Set(a.code).size,6);
  assert.equal(foldPair(night,a,b),true);
  assert.equal(foldHint(night,"").finish,a);
  assert.deepEqual([25,29].map(c=>[shadeAt(a,c),shadeAt(b,c)]),[[1,2],[1,0]]);
  assert.deepEqual(differences(night,a,b),[7,13,17,25,29]);
});

test("a newly wetted star cannot donate ink on the same press; wax, paper edges and the clip are respected",()=>{
  const seq=foldHistory(day,"BGHIH");
  assert.equal(seq[2].ink,0);assert.equal(seq[3].ink,1<<day.star);
  for(const sheet of seq) for(const [c,ch] of [...day.board.tiles].entries()) if(ch==="#")assert.equal(shadeAt(sheet,c),0);
  const press=(desk,sheet,key)=>previewFold(desk,sheet,desk.creases.find(c=>c.key===key));
  assert.equal(press(day,seq[4],"H").again,true);
  assert.equal(press(day,seq[5],"B").reason,"used");
  assert.equal(press(night,foldHistory(night,"C").at(-1),"C").reason,"used");
  assert.equal(day.creases[0].across[day.box],-1);
  assert.equal(press(day,day.initial,"E").reason,"dry");
  for(const bad of ["Z","BGHCIDHX","BGHIHH",null,5,[],{}]) assert.equal(foldHistory(day,bad),null);
  assert.equal(press(day,day.solutions.get("BGHCIDH"),"A").reason,"done");
});

test("a different print can be resumed from its true shared prefix and hints find the latest viable rewind",()=>{
  for (const desk of [day,night]) {
    const outcomes=[...desk.solutions.values()];
    for (const sheet of outcomes) {
      const target=alternateFold(desk,sheet,[printId(sheet)]);
      assert.notEqual(printId(target.sheet),printId(sheet));
      assert.equal(target.keep,commonFolds(target.sheet.code,sheet.code));
      for (const goal of [1,2]) {
        const options=outcomes.filter(s=>shadeAt(s,desk.watch)===goal);
        for(let i=0;i<=sheet.code.length;i++){
          const start=sheet.code.slice(0,i),hint=foldHint(desk,start,goal);
          assert.equal(hint.keep,Math.max(...options.map(ref=>commonFolds(start,ref.code))));
          assert.ok(options.includes(hint.finish));
        }
      }
      const changed=foldHint(desk,sheet.code,0,target.sheet.code);
      assert.equal(changed.keep,target.keep);assert.equal(changed.finish,target.sheet);
    }
    const dead=desk===day?"A":"E";
    assert.ok(foldHistory(desk,dead));
    const planned=outcomes.find(s=>!s.code.startsWith(dead)), hint=foldHint(desk,dead,0,planned.code);
    assert.equal(hint.keep,0);
    const id=printId(outcomes[0]);
    const discover=foldHint(desk,"",0,"",[id]);
    assert.notEqual(printId(discover.finish),id);
  }
});

test("tracing an impression back across the folds reaches the original eaves, through the star for every red mark",()=>{
  for (const desk of [day,night]) for (const code of desk.solutions.keys()) {
    const frames=foldHistory(desk,code),sheet=frames.at(-1);
    for (let c=0;c<desk.board.tiles.length;c++) {
      const list=inkTrail(desk,frames,c),tone=shadeAt(sheet,c);
      if (!tone) {assert.deepEqual(list,[]);continue;}
      assert.deepEqual(list[0],{cell:desk.board.source,step:0,tone:1});
      assert.equal(list.at(-1).cell,c);assert.equal(list.at(-1).tone,tone);
      assert.equal(list.some(v=>v.cell===desk.star),tone===2);
      for(let i=1;i<list.length;i++){
        const {step,cell}=list[i], prev=list[i-1];
        assert.ok(step>prev.step);
        assert.equal(desk.creases.find(s=>s.key===code[step-1]).across[prev.cell],cell);
        assert.equal(shadeAt(frames[step-1],prev.cell),prev.tone);
      }
    }
  }
});

test("after a companion is bound, repeatedly reopening the fork discovers every distinct sheet on the same map",()=>{
  for (const desk of [day,night]) for (const first of desk.solutions.values()) {
    let now=first;
    const saved=[now], ids=new Set([printId(now)]);
    for(let n=0;ids.size<desk.prints.size && n<desk.prints.size*2;n++){
      const bound=saved.some(previous=>foldPair(desk,previous,now));
      const next=alternateFold(desk,now,[...ids],bound).sheet;
      if (bound) assert.ok(!ids.has(printId(next)));
      saved.push(next);ids.add(printId(next));now=next;
    }
    assert.equal(ids.size,desk.prints.size);
  }
});
