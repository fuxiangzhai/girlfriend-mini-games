import test from "node:test";
import assert from "node:assert/strict";
import { letters } from "../moon-mail/levels.mjs";
import { bellCourse, crank, parked, readRide, rideDistance, rideFork, rideHint, rideStep, rideStyles } from "../moon-mail/bell-rides.mjs";

const letter = letters.find(l => l.id === "bridge");
const day = bellCourse(letter, "standard"), night = bellCourse(letter, "expert");
const together = "277441027", independent = "27441817", waiting = "27441027";

test("both original editions keep their lamps, reflectors, gates and postboxes", () => {
  for (const [mode, rows, axis] of [["relaxed",letter.rows,0], ["standard",letter.rows,0], ["expert",letter.expert,1]]) {
    const course = bellCourse(letter, mode);
    assert.equal(course.board.tiles, rows.join(""));
    assert.deepEqual(course.start.at,[course.board.source,course.board.starSource]);
    assert.deepEqual(course.boxes.map(c => course.board.tiles[c]), ["M","S"]);
    assert.equal(course.start.axis, axis);
    assert.equal(course.start.bells, 0);
  }
});

test("two eight-move rides share five moves, then change real tracks and use opposite sides of the moon mailbox", () => {
  const a = readRide(day, independent), b = readRide(day, waiting);
  assert.deepEqual(a.states.slice(0,6), b.states.slice(0,6));
  assert.deepEqual(a.states[5].at, [19,27]);
  assert.equal(a.steps[5].stop, "crank");
  assert.deepEqual(a.steps[6].lines, [[19,25]]);
  assert.equal(b.steps[5].stop, "partner");
  assert.deepEqual(b.steps[5].lines, [[19,20,21],[26]]);
  assert.deepEqual(b.steps[6].lines, [[26,25]]);
  assert.equal(a.style, "solo"); assert.equal(b.style, "lend");
  assert.equal(a.state.bells,3); assert.equal(b.state.bells,3);
});

test("a loan needs real travel and a new stopping place, including at a gate", () => {
  const before = readRide(day, "27441").state;
  assert.equal(rideStep(day, before, 1), null); // The deck is still east–west.
  const contact = rideStep(day, before, 0);
  assert.equal(contact.state.borrowed, 1);
  assert.equal(contact.alone.to,27); assert.deepEqual(contact.alone.lines,[[19,20,21],[26,27]]);
  assert.equal(rideStep(day,contact.state,0), null); // Pushing against an adjacent bike gains nothing.
  const free = rideStep(day, {...before, at:[19,0]}, 0);
  assert.equal(free.to,27); assert.equal(free.stop,"rail");
  for (const other of [21,26]) {
    const blockedGate = rideStep(day,{...before, at:[19,other]},0);
    assert.deepEqual(blockedGate.lines, [[19,20]]);
    assert.equal(blockedGate.stop,"partner");
  }
  // A bike sitting on a crosswise bridge contributes no stop of its own.
  const closed = rideStep(day,{...day.start, at:[21,19],axis:1},2);
  assert.deepEqual(closed.lines,[[21,20]]); assert.equal(closed.stop,"closed");
  assert.equal(closed.state.borrowed,0);
});

test("the two bell stamps, parked bikes and undo all follow the ride history", () => {
  const early = readRide(day,"4");
  assert.ok(early.steps[0].lines.flat().includes(day.boxes[0]));
  assert.equal(early.state.bells,0);
  const unsigned = rideStep(day,{...day.start,at:[26,0]},2);
  assert.deepEqual(unsigned.lines,[[26,25,24]]); // Ride through one's own unsigned box.
  const done = readRide(day,together);
  assert.equal(done.style,"both");
  assert.deepEqual(done.steps.filter(step => step.stop === "partner").map(s=>[s.rider,s.to]),[[1,6],[0,26]]);
  assert.equal(parked(day,done.states.at(-2),0),true);
  for (const a of [0,1,2,3]) assert.equal(rideStep(day,done.states.at(-2),a),null);
  assert.equal(rideStep(day,done.state,crank),null);
  assert.equal(readRide(day,together.slice(0,2)).state.borrowed,0);
  assert.equal(readRide(day,together.slice(0,3)).state.borrowed,2);
  for (const invalid of [undefined,{},[2,7],"9","2x"," ",together+"8","3"]) assert.equal(readRide(day,invalid),null);
});

test("an independent forward search finds three optimal rides on both charts, and every suggested move reaches its page", () => {
  for (const [course,expect] of [[day,[8,8,9]],[night,[10,10,11]]]) {
    const queue = [[course.start,0]], seen = new Set(), best = new Map();
    for (const [state,cost] of queue) {
      const id = [state.at,state.axis,state.bells,state.borrowed].join("/");
      if (seen.has(id)) continue;
      seen.add(id);
      if (course.boxes.every((box,rider) => state.at[rider] === box) && state.bells === 3) {
        const style = ["solo","lend","lend","both"][state.borrowed];
        if (!best.has(style)) best.set(style,cost);
        if (best.size === 3) break;
      } else for (let a=0;a<=crank;a++) {
        const step=rideStep(course,state,a);
        if (step) queue.push([step.state,cost+1]);
      }
    }
    for (const [i,target] of rideStyles.entries()) {
      assert.equal(best.get(target),expect[i]);
      let state=course.start;
      for (let left=expect[i];left>0;left--) {
        assert.equal(rideDistance(course,state,target),left);
        state=rideStep(course,state,rideHint(course,state,target)).state;
      }
      assert.equal(state.borrowed === 3 ? "both" : state.borrowed ? "lend" : "solo",target);
      assert.equal(rideDistance(course,state,target),0);
      assert.equal(rideHint(course,state,target),null);
    }
  }
});

test("a fork retains the longest prefix still on a shortest ride for the new page", () => {
  const from=readRide(day,waiting);
  assert.equal(rideFork(day,from,"solo"),5);
  assert.equal(rideFork(day,from,"both"),2);
  assert.equal(rideDistance(day,from.states[6],"solo"),Infinity);
  assert.equal(rideHint(day,from.states[6],"solo"),null);
  const loop=readRide(day,"88"+waiting);
  assert.equal(loop.style,"lend"); assert.equal(rideFork(day,loop,"both"),0);
  for (const target of ["solo","both"]) {
    const n=rideFork(day,from,target), total=rideDistance(day,day.start,target);
    assert.equal(n+rideDistance(day,from.states[n],target),total);
    for(let j=n+1;j<=from.code.length;j++) assert.ok(j+rideDistance(day,from.states[j],target)>total);
  }
});
