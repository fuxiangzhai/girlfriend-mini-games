import { coordinate, mountChart } from "./chart.js";
import { letters, localLetter } from "./levels.mjs";
import {
  charterHours, dispatchHint, dispatchStations, inspectDispatch, meetsOrder,
  prepareDispatch, readDispatchLedger, scoreKey, tapBerth, validPlan,
} from "./dispatch.mjs";

const stations = dispatchStations.map(id => letters.find(letter => letter.id === id));
const byId = suffix => document.getElementById("desk-" + suffix);
const clonePlan = ({ mask, berths }) => ({ mask, berths });
const samePlan = (a, b) => a.mask === b.mask && a.berths === b.berths;
const signedNumber = n => n > 0 ? "+" + n : String(n).replace("-", "−");
const orderKey = (index, total) => index === 0 ? "deskEconomy" : index === total - 1 ? "deskExpress" : "deskBalanced";

function node(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}
function button(label, title, action) {
  const el = node("button", label);
  el.type = "button";
  el.setAttribute("aria-label", title);
  el.addEventListener("click", action);
  return el;
}
function setFragment(fragment) {
  try {
    const url = new URL(location.href);
    url.hash = fragment;
    history.replaceState(null, "", url);
  } catch { /* Saving the route still works in offline viewers. */ }
}

export function createDispatchDesk({ context, read, write, cue, openSettings, switchLanguage }) {
  const dialog = document.getElementById("dispatch-desk");
  let language, difficulty, t, letter, desk, current, undo, order, records;
  let chart, drawnBoard, drawnBerths, overlay, requestedHint, notice, returnHash, playback;
  const key = field => "dispatch.v1." + letter.id + "." + difficulty + "." + field;
  const start = () => ({ mask: desk.base.initial, berths: 0 });
  const signed = i => records.some(record => meetsOrder(record, desk.orders[i]));
  const selectedCells = berths => desk.labels.filter((_, i) => berths & (1 << i));
  const scoreText = record => t("deskScore", { h: record.hours, b: record.beats });

  function readLedger() {
    records = readDispatchLedger(desk, k => read(key("plan." + k)));
    if (overlay && !records.some(record => scoreKey(record) === overlay)) overlay = null;
  }
  function save() { write(key("draft"), { current, undo, order }); }

  function selectStation(id) {
    ({ language, difficulty, t } = context());
    letter = stations.find(item => item.id === id) ?? stations[0];
    desk = prepareDispatch(letter, difficulty);
    const saved = read(key("draft"));
    current = validPlan(desk, saved?.current) ? clonePlan(saved.current) : start();
    undo = validPlan(desk, saved?.current) && Array.isArray(saved.undo) && saved.undo.every(item => validPlan(desk, item))
      ? saved.undo.map(clonePlan) : [];
    order = Number.isInteger(saved?.order) && desk.orders[saved.order] ? saved.order : 0;
    overlay = null;
    notice = null;
    requestedHint = false;
    drawnBoard = null;
    write("dispatch.station", letter.id);
    readLedger();
    renderStation();
    setFragment("dispatch-" + letter.id);
  }

  function renderStation() {
    const local = localLetter(letter, language);
    const select = byId("station");
    select.replaceChildren(...stations.map(item => new Option(localLetter(item, language).title, item.id)));
    select.value = letter.id;
    byId("art").src = local.image;
    byId("art").alt = local.artAlt;
    byId("place").textContent = local.place;
    byId("time").textContent = local.time;
    byId("brief").textContent = t("deskBrief_" + letter.id);
    byId("letter").querySelector("p").textContent = t("deskNote_" + letter.id);
    byId("mode").querySelector("span").textContent = t(difficulty);
    byId("mode").setAttribute("aria-label", t("modeControl", { mode: t(difficulty) }));
    byId("language").lang = language === "zh" ? "en" : "zh-CN";
    renderLedger();
    render();
  }
  function renderLedger() {
    const total = desk.orders.length;
    const signedCount = desk.orders.filter((_, i) => signed(i)).length;
    byId("certified").textContent = t("deskCertified", { n: signedCount, total });
    byId("letter").hidden = signedCount !== total;
    const active = dialog.contains(document.activeElement) ? document.activeElement.dataset : {};
    const orders = desk.orders.map((limits, i) => {
      const title = t(orderKey(i, total));
      const caps = [t("deskHourLimit", { n: limits.hours }), t("deskBeatLimit", { n: limits.beats })];
      const signedLabel = signed(i) ? t("deskSigned") : "";
      const el = button("", [title, ...caps, signedLabel].filter(Boolean).join(" · "), () => {
        order = i;
        requestedHint = false;
        notice = null;
        save();
        cue("paper");
        renderLedger();
        render();
      });
      el.dataset.order = i;
      el.setAttribute("aria-pressed", String(i === order));
      const name = node("strong", title);
      if (signedLabel) name.append(node("i", "✓"));
      const capLine = document.createElement("small");
      capLine.append(...caps.map(cap => node("span", cap)));
      el.append(name, capLine);
      return el;
    });
    byId("orders").replaceChildren(...orders);
    byId("empty").hidden = records.length > 0;
    byId("records").replaceChildren(...records.map(record => {
      const id = scoreKey(record);
      const item = document.createElement("div");
      item.className = "desk-record";
      const info = document.createElement("div");
      const [a, b] = selectedCells(record.berths);
      info.append(node("strong", scoreText(record)), node("small", a ? t("deskFerryAt", { a, b }) : t("deskDirect")));
      const compare = button(t("deskCompare"), t("deskCompareLabel", { score: scoreText(record) }), () => {
        overlay = overlay === id ? null : id;
        cue("paper");
        renderLedger();
        render();
      });
      compare.dataset.overlay = id;
      compare.setAttribute("aria-pressed", String(overlay === id));
      const load = button(t("deskLoad"), t("deskLoadLabel", { score: scoreText(record) }), () => change(record, "paper"));
      load.dataset.load = id;
      item.append(info, compare, load);
      return item;
    }));
    if (active.order !== undefined) byId("orders").querySelector('[data-order="' + active.order + '"]')?.focus({ preventScroll: true });
    if (active.overlay) byId("records").querySelector('[data-overlay="' + active.overlay + '"]')?.focus({ preventScroll: true });
    if (active.load) byId("records").querySelector('[data-load="' + active.load + '"]')?.focus({ preventScroll: true });
  }

  function change(plan, sound) {
    if (samePlan(plan, current)) return;
    undo.push(current);
    current = clonePlan(plan);
    afterChange(sound);
  }
  function afterChange(sound) {
    requestedHint = false;
    notice = null;
    save();
    cue(sound);
    render();
  }
  function status(result, hint) {
    if (notice) return t(notice.key, notice.params);
    if (hint?.kind === "mirror") return t("deskHintMirror", { cell: coordinate(desk.base, desk.base.mirrors[hint.index]) });
    if (hint?.kind === "berth") return t("deskHintBerth", { cell: desk.labels[hint.index] });
    if (hint?.kind === "recall") return t("deskHintRecall");
    if (result.pending) return t("deskChooseSecond");
    if (result.valid) {
      if (!meetsOrder(result, desk.orders[order])) return t("deskLogPossible");
      return t(signed(order) ? "deskReadyAgain" : "deskLogReady");
    }
    if (result.route.end === "ready") return t("deskUnused");
    if (result.route.rays.length === 2) {
      if (result.route.rays.some(ray => ray.end === "wrongBox")) return t("wrongBoxStatus");
      const [moon, star] = result.arrivals.map(n => n === null ? t("deskEnRoute") : t("deskAt", { n }));
      return t("deskDualStatus", { moon, star });
    }
    if (result.route.end === "missing") return t("missingStatus", { n: desk.base.marks.length - result.route.lit.size });
    return t(({ blocked: "blockedStatus", loop: "loopStatus" })[result.route.end] ?? "seaStatus");
  }

  function render() {
    playback?.abort();
    playback = null;
    const result = inspectDispatch(desk, current);
    const hint = (difficulty === "relaxed" || requestedHint) ? dispatchHint(desk, current, desk.orders[order]) : null;
    if (drawnBoard !== result.board || drawnBerths !== current.berths) {
      const focusedBerth = dialog.contains(document.activeElement) ? document.activeElement.dataset.berth : undefined;
      chart = mountChart(result.board, i => change({ ...current, mask: current.mask ^ (1 << i) }, "turn"), t, {
        root: dialog, berths: desk.cells, selected: current.berths, trackInitial: true,
        onBerth: i => change({ ...current, berths: tapBerth(current.berths, i) }, "tide"),
      });
      drawnBoard = result.board;
      drawnBerths = current.berths;
      if (focusedBerth !== undefined) dialog.querySelector('[data-berth="' + focusedBerth + '"]').focus({ preventScroll: true });
    }
    chart.draw(current.mask, result.route, hint?.kind === "mirror" ? hint.index : undefined, false);
    for (const el of dialog.querySelectorAll("[data-berth]")) el.classList.toggle("suggested-berth", hint?.kind === "berth" && Number(el.dataset.berth) === hint.index);
    const record = records.find(item => scoreKey(item) === overlay);
    chart.compareRays(record ? inspectDispatch(desk, record).route.rays : []);
    byId("delta").hidden = !record;
    if (record) byId("delta").textContent = result.valid ? t("deskDelta", { h: signedNumber(result.hours - record.hours), b: signedNumber(result.beats - record.beats) }) : t("deskGhost");
    byId("hours").textContent = t("deskHourValue", { n: result.hours });
    byId("beats").textContent = result.valid ? t("deskBeatValue", { n: result.beats }) : "—";
    byId("work").textContent = t("deskWorkSplit", { mirrors: result.mirrorHours, ferry: result.ferryHours });
    byId("arrivals").textContent = t("deskPace");
    if (result.arrivals.length === 2) {
      const [moon, star] = result.arrivals.map(n => n === null ? "—" : t("deskBeatValue", { n }));
      byId("arrivals").textContent = t("deskSplit", { moon, star });
    }
    const [a, b] = selectedCells(current.berths);
    byId("pair").textContent = b ? t("deskPairTwo", { a, b, n: charterHours }) : a ? t("deskPairOne", { cell: a }) : t("deskPairNone");
    byId("recall").disabled = !current.berths;
    byId("recall").classList.toggle("desk-suggested", hint?.kind === "recall");
    byId("undo").disabled = !undo.length;
    byId("reset").disabled = samePlan(current, start());
    byId("hint").hidden = difficulty !== "standard";
    byId("hint").disabled = result.valid && meetsOrder(result, desk.orders[order]);
    byId("log").disabled = !result.valid;
    byId("log").classList.toggle("desk-suggested", hint?.kind === "log");
    byId("status").textContent = status(result, hint);
  }

  async function logTrial() {
    const trial = inspectDispatch(desk, current);
    if (!trial.valid) return;
    readLedger();
    const wasSigned = desk.orders.map((_, i) => signed(i));
    const surpassed = records.find(record => meetsOrder(record, trial));
    const equal = surpassed && scoreKey(surpassed) === scoreKey(trial);
    notice = { key: equal ? "deskDuplicate" : surpassed ? "deskOutdone" : "deskLogged",
      params: surpassed ? { score: scoreText(surpassed) } : {} };
    if (!surpassed) {
      write(key("plan." + scoreKey(trial)), clonePlan(current));
      readLedger();
      const newlySigned = wasSigned.findIndex((was, i) => !was && signed(i));
      if (newlySigned !== -1) notice = desk.orders.every((_, i) => signed(i)) ? { key: "deskLoggedAll" }
        : { key: "deskLoggedOrder", params: { order: t(orderKey(newlySigned, desk.orders.length)) } };
    }
    cue(surpassed ? "paper" : "sent");
    renderLedger();
    render();
    const run = new AbortController();
    playback = run;
    await chart.carryLetter({ arrivals: trial.arrivals, signal: run.signal, onBeat(beat) {
      byId("beats").textContent = t("deskBeatValue", { n: beat });
    } });
    if (playback === run) {
      byId("beats").textContent = t("deskBeatValue", { n: trial.beats });
      playback = null;
    }
  }

  byId("undo").addEventListener("click", () => { if (undo.length) { current = undo.pop(); afterChange("turn"); } });
  byId("reset").addEventListener("click", () => change(start(), "paper"));
  byId("recall").addEventListener("click", () => change({ ...current, berths: 0 }, "tide"));
  byId("hint").addEventListener("click", () => { notice = null; requestedHint = true; cue("paper"); render(); });
  byId("log").addEventListener("click", logTrial);
  byId("mode").addEventListener("click", () => openSettings(true));
  byId("language").addEventListener("click", switchLanguage);
  byId("station").addEventListener("change", e => { cue("paper"); selectStation(e.target.value); });
  byId("close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) {
      playback?.abort();
      dialog.querySelector('[data-chart-part="tiles"]').replaceChildren();
      setFragment(returnHash);
    }
  });
  window.addEventListener("storage", e => {
    if (dialog.open && (!e.key || e.key.includes(key("plan.")))) {
      readLedger(); renderLedger(); render();
    }
  });
  return {
    open(id) {
      returnHash = /^#dispatch-/.test(location.hash) ? "" : location.hash;
      selectStation(id ?? read("dispatch.station"));
      dialog.showModal();
      dialog.scrollTop = 0;
      byId("station").focus({ preventScroll: true });
    },
    refresh() {
      if (!dialog.open) return;
      if (difficulty !== context().difficulty) { selectStation(letter.id); return; }
      ({ language, t } = context());
      notice = null;
      drawnBoard = null;
      renderStation();
    },
  };
}
