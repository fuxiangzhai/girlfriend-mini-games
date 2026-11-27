import { coordinate, mountChart } from "./chart.js";
import { closestRoute, trace } from "./puzzle.mjs";
import { advisePort, hearShore, newWatch, possibleMirrors, prepareWatch, proven, publicEvidence, readMirror, restoreWatch, validWatchSeal, watchMask, watchPar } from "./fogwatch.mjs";

const el = name => document.getElementById("watch-" + name);
const panel = document.querySelector(".chart-panel");
const serial = i => String(i + 1).padStart(2, "0");
const arrows = { N: "↓", E: "←", S: "↑", W: "→" };
const key = (mode, suffix) => "watch.v1." + mode + "." + suffix;

function shoreName(t, port) {
  const lane = "NS".includes(port[0]) ? String.fromCharCode(64 + Number(port.slice(1))) : port.slice(1);
  return t("watchPort", { side: t("watch" + port[0]), lane });
}
function reportText(t, report) {
  const [bells, terminal] = report.split("|");
  const stops = Array.from(bells, n => t("watchBell", { n }));
  if (!stops.length) stops.push(t("watchNoBell"));
  stops.push(t(terminal === "quiet" ? "watchQuiet" : terminal === "box" ? "box" : "watch" + terminal));
  return stops.join(" → ");
}
export function watchSlip(t, shift, seal) {
  return t("watchSlip", { shift: serial(shift), calls: countText(t, "watchCallCount", seal.heard.length), turns: countText(t, "watchTurnCount", seal.turns.length) });
}
const countText = (t, key, n) => t(n === 1 ? key + "One" : key, { n });

export function createFogWatch({ letter, read, write, cue, delivered, openReceipt }) {
  let t, difficulty, watch, shift, run, chart, hint = false, overlay, playback, lens;
  const draftKey = () => key(difficulty, shift + ".draft");
  const sealKey = (calls) => key(difficulty, shift + ".seal." + calls);
  const save = () => write(draftKey(), run);

  function latest(mode) {
    const last = read(key(mode, "last"));
    if (!last || !validWatchSeal(prepareWatch(letter, mode), last.shift, last)) return null;
    return last;
  }
  function seals() {
    return watch.ports.map((_, i) => read(sealKey(i + 1)))
      .filter((s, i) => validWatchSeal(watch, shift, s) && s.heard.length === i + 1);
  }
  function stopPlayback() { playback?.abort(); playback = null; }
  function loadShift(index) {
    stopPlayback();
    shift = Number.isInteger(index) && index >= 0 && index < watch.shifts.length ? index : 0;
    run = restoreWatch(watch, shift, read(draftKey())) ?? newWatch(watch);
    hint = false;
    overlay = -1;
    lens = watch.board.mirrors.findIndex((_, i) => watch.hidden & (1 << i));
    write(key(difficulty, "active"), shift);
    el("shift").value = shift;
    render();
  }
  function rotate(index) {
    if (run.phase === "survey" && (watch.hidden & (1 << index))) run.pencil ^= 1 << index;
    else if (run.phase === "repair") run.turns.push(index);
    else return;
    hint = false;
    cue("turn");
    save();
    render();
  }
  function choosePort(index) {
    if (run.phase === "survey") run.port = index;
    else overlay = overlay === index ? -1 : index;
    hint = false;
    save();
    render();
  }
  function listen() {
    if (run.phase !== "survey") return;
    const p = run.port;
    if (!run.heard.includes(p)) run.heard.push(p);
    const [bells] = watch.reports.get(watch.shifts[shift])[p].split("|");
    cue({ kind: "echo", bells });
    hint = false;
    save();
    render();
  }
  function writeSeal() {
    const seal = { shift, heard: [...run.heard], turns: [...run.turns] };
    const old = read(sealKey(seal.heard.length));
    if (!validWatchSeal(watch, shift, old) || old.heard.length !== seal.heard.length || old.turns.length > seal.turns.length) write(sealKey(seal.heard.length), seal);
    write(key(difficulty, "last"), seal);
  }
  async function act() {
    if (playback) return;
    if (run.phase === "signed") { openReceipt({ shift, heard: run.heard, turns: run.turns }); return; }
    if (run.phase === "survey") {
      if (!proven(watch, shift, run)) return;
      run.phase = "repair";
      hint = false;
      cue("ready");
      save(); render();
      return;
    }
    if (trace(watch.board, watchMask(watch, shift, run)).end !== "ready") return;
    run.phase = "signed";
    writeSeal(); save(); delivered();
    cue("depart");
    const trip = new AbortController();
    playback = trip;
    render();
    await chart.carryLetter({ signal: trip.signal });
    if (playback !== trip) return;
    playback = null;
    render();
    if (!document.hidden && !document.querySelector("dialog[open]")) { cue("sent"); openReceipt({ shift, heard: run.heard, turns: run.turns }); }
  }

  function drawOrigin(port) {
    const node = el("origin");
    node.hidden = run.phase !== "survey";
    if (node.hidden) return;
    const side = port[0], lane = Number(port.slice(1)) - .5;
    node.dataset.side = side;
    node.textContent = arrows[side];
    node.style.left = (side === "W" ? 2 : side === "E" ? 98 : 100 * lane / watch.board.width) + "%";
    node.style.top = (side === "N" ? 3 : side === "S" ? 97 : 100 * lane / watch.board.height) + "%";
  }
  function renderBook(evidence, survey) {
    const selected = survey ? run.port : overlay;
    const focused = document.activeElement?.dataset.echo;
    el("count").textContent = countText(t, "watchCalls", evidence.length);
    el("empty").hidden = evidence.length > 0;
    el("records").replaceChildren(...evidence.map(({ port, report }) => {
      const item = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button"; btn.dataset.echo = port;
      btn.setAttribute("aria-pressed", String(port === selected));
      const origin = document.createElement("b"), result = document.createElement("span"), match = document.createElement("small");
      origin.textContent = shoreName(t, watch.ports[port]);
      result.textContent = reportText(t, report);
      const fits = watch.reports.get(run.pencil)[port] === report;
      match.textContent = survey ? t(fits ? "watchFits" : "watchDiffers") : t(port === overlay ? "watchHideTrace" : "watchShowTrace");
      btn.dataset.fits = String(!survey || fits);
      btn.addEventListener("click", () => choosePort(port));
      btn.append(origin, result, match);
      item.append(btn);
      return item;
    }));
    if (focused !== undefined) el("records").querySelector('[data-echo="' + focused + '"]')?.focus({ preventScroll: true });
    const saved = seals();
    el("achievement").hidden = saved.length === 0;
    if (saved.length) {
      const par = watchPar(watch, shift);
      const bestCalls = Math.min(...saved.map(s => s.heard.length)), bestTurns = Math.min(...saved.map(s => s.turns.length));
      el("achievement").textContent = t("watchBest", { c: countText(t, "watchCallCount", bestCalls), p: countText(t, "watchCallCount", par.calls),
        m: countText(t, "watchTurnCount", bestTurns), q: countText(t, "watchTurnCount", par.turns) });
    }
    el("proof").hidden = evidence.length === 0 || (survey && difficulty === "expert");
    if (!el("proof").hidden && el("proof").open) renderProof(evidence);
  }
  function renderProof(evidence) {
    const result = readMirror(watch, evidence, lens);
    const cell = coordinate(watch.board, watch.board.mirrors[lens]);
    for (const btn of el("lenses").children) btn.setAttribute("aria-pressed", String(Number(btn.dataset.lens) === lens));
    el("reason").textContent = result.proof ? t("watchProofFound", { cell, slope: t(result.falling ? "falling" : "rising"),
      entries: result.proof.map(e => shoreName(t, watch.ports[e.port]) + " (" + reportText(t, e.report) + ")").join(" · ") })
      : t("watchProofOpen", { cell, rising: result.rising, falling: result.falling });
  }
  function guidance(evidence, possible, ray) {
    const assist = (difficulty === "relaxed" || hint) && run.phase !== "signed";
    if (run.phase !== "survey") {
      if (run.phase === "signed") return { text: watchSlip(t, shift, run) };
      if (ray.end === "ready") return { text: t("watchSendReady") };
      if (assist) {
        const mirror = closestRoute(watch.board, watchMask(watch, shift, run)).next;
        return { mirror, text: t("watchFixHint", { cell: coordinate(watch.board, watch.board.mirrors[mirror]) }) };
      }
      return { text: t(overlay >= 0 ? "watchOverlayOn" : "watchRepairHelp") };
    }
    if (possible.length === 1 && possible[0] === run.pencil) return { text: t("watchProven") };
    if (possible.length === 1 && assist) {
      const mirror = watch.board.mirrors.findIndex((_, i) => (possible[0] ^ run.pencil) & (1 << i));
      const { proof } = readMirror(watch, evidence, mirror);
      return { mirror, text: t("watchPencilHint", { cell: coordinate(watch.board, watch.board.mirrors[mirror]),
        entries: proof.map(e => shoreName(t, watch.ports[e.port])).join(" + ") }) };
    }
    if (possible.length === 1) return { text: t("watchOneLeft") };
    if (assist) {
      const { port, sizes } = advisePort(watch, possible);
      return { port, text: t("watchCallHint", { port: shoreName(t, watch.ports[port]), groups: sizes.join(" / ") }) };
    }
    if (!evidence.length) return { text: t("watchFirst") };
    const conflicts = evidence.filter(({ port, report }) => watch.reports.get(run.pencil)[port] !== report).length;
    return { text: t(conflicts === 1 ? "watchConflictOne" : conflicts ? "watchConflict" : "watchNeedMore", { n: conflicts }) };
  }

  function render() {
    const survey = run.phase === "survey", signed = run.phase === "signed";
    const mask = watchMask(watch, shift, run), port = watch.ports[run.port];
    const pencil = survey ? hearShore(watch.board, mask, port) : null;
    const route = survey ? { ...pencil.ray, rays: [pencil.ray] } : trace(watch.board, mask);
    const evidence = publicEvidence(watch, shift, run.heard);
    const possible = possibleMirrors(watch, evidence);
    const advice = guidance(evidence, possible, route);
    panel.dataset.watchPhase = run.phase;
    chart.draw(mask, route, advice.mirror, signed);
    if (survey) {
      for (const mirror of document.querySelectorAll("#tiles [data-mirror]")) {
        const unknown = Boolean(watch.hidden & (1 << Number(mirror.dataset.mirror)));
        mirror.disabled = !unknown;
        mirror.classList.toggle("watch-pencil", unknown);
        mirror.setAttribute("aria-label", mirror.getAttribute("aria-label") + t(unknown ? "watchPencilled" : "watchKnown"));
      }
      document.getElementById("route-description").textContent = t("watchPredictionFrom", { port: shoreName(t, port), reading: reportText(t, pencil.report) });
      const box = document.getElementById("tiles").children[watch.board.tiles.indexOf("M")];
      box.classList.toggle("arrived", pencil.report.endsWith("|box"));
    } else {
      for (const mirror of document.querySelectorAll("#tiles .watch-pencil")) mirror.classList.remove("watch-pencil");
    }
    chart.compareRays(!survey && overlay >= 0 ? [hearShore(watch.board, watch.shifts[shift], watch.ports[overlay]).ray] : []);
    drawOrigin(port);
    el("phase").textContent = survey ? countText(t, "watchPossibilities", possible.length) : signed ? t("watchSigned") : countText(t, "watchTurnCount", run.turns.length);
    el("shores").hidden = el("readings").hidden = !survey;
    el("ports").querySelectorAll("button").forEach((button, i) => {
      button.setAttribute("aria-pressed", String(i === run.port));
      button.classList.toggle("watch-advised", advice.port === i);
    });
    if (survey) {
      el("prediction").textContent = reportText(t, pencil.report);
      const observed = evidence.find(e => e.port === run.port);
      const answer = observed ? reportText(t, observed.report) : t("watchUnheard");
      if (el("answer").textContent !== answer) el("answer").textContent = answer;
    }
    el("status").textContent = advice.text;
    el("listen").hidden = !survey;
    el("listen").querySelector("span").textContent = t(run.heard.includes(run.port) ? "watchRelisten" : "watchListen");
    el("action").textContent = t(survey ? "watchVerify" : signed ? "read" : "watchSend");
    el("action").disabled = Boolean(playback) || (survey ? possible.length !== 1 || possible[0] !== mask : !signed && route.end !== "ready");
    el("undo").hidden = run.phase !== "repair"; el("undo").disabled = !run.turns.length;
    el("hint").hidden = difficulty !== "standard" || signed;
    el("hint").disabled = survey ? possible.length === 1 && possible[0] === mask : route.end === "ready";
    el("retry").hidden = el("next").hidden = !signed;
    renderBook(evidence, survey);
  }

  el("shift").addEventListener("change", () => { cue("paper"); loadShift(Number(el("shift").value)); });
  el("listen").addEventListener("click", listen);
  el("action").addEventListener("click", act);
  el("proof").addEventListener("toggle", () => { if (el("proof").open && !el("proof").hidden) renderProof(publicEvidence(watch, shift, run.heard)); });
  el("hint").addEventListener("click", () => { hint = true; cue("hint"); render(); });
  el("undo").addEventListener("click", () => { if (run.phase === "repair" && run.turns.length) { run.turns.pop(); hint = false; cue("undo"); save(); render(); } });
  el("retry").addEventListener("click", () => { stopPlayback(); run = newWatch(watch); overlay = -1; hint = false; cue("paper"); save(); render(); });
  el("next").addEventListener("click", () => { cue("paper"); loadShift((shift + 1) % watch.shifts.length); });
  return {
    latest,
    mount(mode, translate) {
      const sameShift = panel.hasAttribute("data-watch-phase") && mode === difficulty;
      stopPlayback();
      t = translate; difficulty = mode; watch = prepareWatch(letter, mode);
      el("lenses").replaceChildren(...watch.board.mirrors.flatMap((cell, i) => {
        if (!(watch.hidden & (1 << i))) return [];
        const button = document.createElement("button");
        button.type = "button"; button.dataset.lens = i; button.textContent = coordinate(watch.board, cell);
        button.addEventListener("click", () => { lens = i; renderProof(publicEvidence(watch, shift, run.heard)); });
        return [button];
      }));
      el("shift").replaceChildren(...watch.shifts.map((_, i) => new Option(t("watchSerial", { n: serial(i) }), i)));
      el("ports").replaceChildren(...watch.ports.map((port, i) => {
        const button = document.createElement("button");
        button.type = "button"; button.dataset.port = i;
        button.textContent = arrows[port[0]] + " " + shoreName(t, port);
        button.addEventListener("click", () => choosePort(i));
        return button;
      }));
      chart = mountChart(watch.board, rotate, t);
      if (sameShift) {
        el("shift").value = shift;
        render();
      } else loadShift(read(key(mode, "active")));
    },
    leave() { stopPlayback(); el("origin").hidden = true; delete panel.dataset.watchPhase; },
  };
}
