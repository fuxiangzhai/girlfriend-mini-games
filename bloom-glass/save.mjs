import { fits } from './puzzle.mjs';

const prefix = 'petal-panes:v1:';
const memory = new Map();
export function read(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const value = localStorage.getItem(prefix + key);
    if (value !== null) return JSON.parse(value);
  } catch { /* A private or full store still allows a session in memory. */ }
  return null;
}
export function write(key, value) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); memory.delete(key); }
  catch { memory.set(key, value); }
}
export function fresh(level) {
  return { slots: [...level.sample], angles: level.pieces.map(() => 0), selected: level.sample.findIndex(p => !p) };
}
function valid(level, draft) {
  const n = level.pieces.length;
  return draft && Array.isArray(draft.slots) && draft.slots.length === n &&
    Array.isArray(draft.angles) && draft.angles.length === n &&
    draft.angles.every(o => Number.isInteger(o) && o >= 0 && o < (level.flip ? 8 : 4)) &&
    draft.slots.every((p,i) => p === null || fits(level,draft.slots,i,p)) &&
    Number.isInteger(draft.selected) && draft.selected >= -1 && draft.selected < n &&
    (draft.slots.every(Boolean) ? draft.selected === -1 : draft.selected >= 0 && !draft.slots[draft.selected]);
}
function keyFor(level, kind) { return kind + (level.daily ? 'today' : level.id); }
export function restore(level) {
  const draft = read(keyFor(level, 'draft:'));
  if (draft?.id !== level.id || !valid(level,draft.state)) return { state: fresh(level), history: [] };
  const history = Array.isArray(draft.history) ? draft.history.slice(-40).filter(s => valid(level,s)) : [];
  return { state: draft.state, history };
}
export function save(level,state,history) {
  write(keyFor(level,'draft:'), { id:level.id, state, history:history.slice(-40) });
}
export function record(level) {
  const value = read(keyFor(level,'done:'));
  return value?.id === level.id ? value : null;
}
export function award(level,gold) {
  write(keyFor(level,'done:'), { id:level.id, gold: Boolean(record(level)?.gold || gold) });
}
