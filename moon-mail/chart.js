import { isNumbered, starArrows } from "./puzzle.mjs";

const svgNS = "http://www.w3.org/2000/svg";
const arrows = ">v<^";
const directions = ["east", "south", "west", "north"];
const features = {
  M: "box", S: "starBox", "&": "jointSeal", "#": "reef", "*": "mark", "@": "gate",
};

export function coordinate(board, cell) {
  return String.fromCharCode(65 + cell % board.width) + (1 + Math.floor(cell / board.width));
}

function glyph(name, number) {
  const icon = document.createElementNS(svgNS, "svg");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svgNS, "use");
  use.setAttribute("href", "#g-" + name);
  icon.append(use);
  if (number) {
    icon.setAttribute("viewBox", "0 0 64 64");
    const text = document.createElementNS(svgNS, "text");
    text.setAttribute("x", "32");
    text.setAttribute("y", "41");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "seal-digit");
    text.textContent = number;
    icon.append(text);
  }
  return icon;
}

function axis(element, labels) {
  element.replaceChildren(...labels.map(label => {
    const span = document.createElement("span");
    span.textContent = label;
    return span;
  }));
}

export function mountChart(board, onRotate, t, options = {}) {
  const part = id => options.root ? options.root.querySelector('[data-chart-part="' + id + '"]') : document.getElementById(id);
  const chart = part("chart");
  const tiles = part("tiles");
  const beam = part("beam");
  const groups = [...beam.querySelectorAll("[data-ray]")];
  const overlay = part("film-overlay");
  overlay.replaceChildren();
  const couriers = [part("courier"), part("star-courier")];
  const paired = board.starSource !== undefined;
  groups.forEach(group => group.replaceChildren());
  const frame = chart.parentElement;
  frame.style.setProperty("--cols", board.width);
  frame.style.setProperty("--rows", board.height);
  beam.setAttribute("viewBox", [0, 0, board.width * 100, board.height * 100].join(" "));
  beam.setAttribute("preserveAspectRatio", "none");
  axis(part("col-labels"), Array.from({ length: board.width }, (_, i) => String.fromCharCode(65 + i)));
  axis(part("row-labels"), Array.from({ length: board.height }, (_, i) => i + 1));

  const cells = Array.from(board.tiles, (tile, cell) => {
    const index = board.mirrorAt.get(cell);
    const isMirror = index !== undefined;
    const berth = options.berths?.indexOf(cell) ?? -1;
    const plotCell = options.onPlot && tile !== "#";
    const inspectCell = options.onInspect && (tile === "." || tile === "*");
    const element = document.createElement(plotCell || inspectCell || (isMirror && !options.fixedMirrors) || berth >= 0 ? "button" : "span");
    const starDirection = starArrows.indexOf(tile);
    const direction = starDirection !== -1 ? starDirection : arrows.indexOf(tile);
    let name = features[tile] || "water";
    if (direction !== -1) name = starDirection !== -1 ? "starLamp" : "lamp";
    if (paired && tile === "M") name = "moonBox";
    if (board.film && tile === "M") name = "filmCamera";
    if (board.film && "abcd".includes(tile)) name = "sensor";
    const isSiding = isMirror && board.hill && index >= board.hill.fixed;
    if (isMirror) name = plotCell ? "eyelet" : isSiding ? "siding" : "mirror";
    if (isNumbered(tile)) name = "number";
    if (berth >= 0) name = "berth";
    element.className = "tile " + name + (name === "number" ? " mark" : isSiding ? " mirror" : "");
    if (plotCell) {
      element.type = "button";
      element.dataset.cell = cell;
      element.addEventListener("click", () => options.onPlot(cell));
    } else if (inspectCell) {
      element.type = "button";
      element.disabled = true;
      element.addEventListener("click", () => options.onInspect(cell));
    } else if (isMirror && options.fixedMirrors) {
      element.classList.toggle("falling", tile === "B");
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", t("fixedMirrorLabel", {cell: coordinate(board, cell), slope: t(tile === "B" ? "falling" : "rising")}));
    } else if (isMirror) {
      element.type = "button";
      element.dataset.mirror = index;
      element.addEventListener("click", () => onRotate(index));
    } else if (berth >= 0) {
      element.type = "button";
      element.dataset.berth = berth;
      element.setAttribute("aria-pressed", String(Boolean(options.selected & (1 << berth))));
      element.setAttribute("aria-label", t("deskBerthAt", { cell: coordinate(board, cell) }));
      element.addEventListener("click", () => options.onBerth(berth));
    } else if (name !== "water") {
      element.setAttribute("role", "img");
      const label = direction !== -1 ? t(starDirection !== -1 ? "starLampLabel" : "lampLabel", {direction: t(directions[direction])})
        : name === "number" ? t("sealLabel", {n: tile}) : name === "sensor" ? t("sensorLabel", {name: tile.toUpperCase()}) : t(name);
      element.setAttribute("aria-label", coordinate(board, cell) + " " + label);
    } else {
      element.setAttribute("aria-hidden", "true");
    }
    if (name !== "water" || (!plotCell && (cell * 7 + Math.floor(cell / board.width)) % 5 < 2)) {
      element.append(glyph(name, name === "sensor" ? tile.toUpperCase() : name === "number" ? tile : null));
    }
    if (isSiding) element.append(glyph("blade"));
    if (board.hill && name === "mark") {
      const order = document.createElement("span");
      order.className = "hill-stop";
      order.setAttribute("aria-hidden", "true");
      element.append(order);
    }
    if (direction !== -1) {
      const arrow = document.createElement("i");
      arrow.className = "heading-arrow";
      arrow.style.setProperty("--angle", direction * 90 + "deg");
      element.append(arrow);
    }
    return element;
  });
  tiles.replaceChildren(...cells);

  function drawLines(rays) {
    rays.forEach((ray, i) => {
      const strokes = [];
      for (const line of ray.lines) {
        const points = line.map(([x, y]) => [x * 100, y * 100].join(",")).join(" ");
        for (const name of ["halo", "core", "flow"]) {
          const path = document.createElementNS(svgNS, "polyline");
          path.setAttribute("points", points);
          path.setAttribute("class", "beam-" + name);
          strokes.push(path);
        }
      }
      groups[i].replaceChildren(...strokes);
    });
  }

  function draw(mask, route, hint, locked) {
    drawLines(route.rays);
    board.mirrors.forEach((cell, index) => {
      const mirror = cells[cell];
      const falling = !!(mask & (1 << index));
      const isSiding = board.hill && index >= board.hill.fixed;
      const empty = Boolean(route.straight & (1 << index));
      if (isSiding) mirror.classList.toggle("empty", empty);
      mirror.classList.toggle("falling", falling);
      mirror.classList.toggle("hinted", index === hint);
      mirror.disabled = locked;
      const realigned = options.trackInitial && Boolean((mask ^ board.initial) & (1 << index));
      mirror.classList.toggle("realigned", Boolean(realigned));
      mirror.setAttribute("aria-label", t(isSiding ? "hillSocket" : "mirrorLabel", {cell: coordinate(board, cell), slope: t(empty ? "hillStraight" : falling ? "falling" : "rising")})
        + (realigned ? t("deskShifted") : "") + (index === hint ? t("hinted") : ""));
    });
    board.marks.forEach(cell => {
      cells[cell].classList.toggle("lit", route.lit.has(cell));
      const tile = board.tiles[cell];
      const name = isNumbered(tile) ? t("sealLabel", {n: tile}) : t("mark");
      cells[cell].setAttribute("aria-label", [coordinate(board, cell), name, t(route.lit.has(cell) ? "lit" : "unlit")].join(" "));
      if (board.hill) {
        const order = cells[cell].querySelector(".hill-stop");
        order.hidden = !route.lit.has(cell);
        order.textContent = String([...route.lit].indexOf(cell) + 1);
      }
    });
    if (paired) {
      const seal = cells[board.jointCell];
      seal.dataset.count = route.jointCount;
      seal.setAttribute("aria-label", coordinate(board, board.jointCell) + " " + t("sealCount", {n: route.jointCount}));
    }
    if (board.film) board.film.sensors.forEach((cell, i) => {
      const lit = Boolean(route.exposure & (1 << i));
      cells[cell].classList.toggle("lit", lit);
      const name = board.tiles[cell].toUpperCase();
      cells[cell].setAttribute("aria-label", [coordinate(board, cell), t("sensorLabel", {name}), t(lit ? "lit" : "unlit")].join(" "));
    });
    part("route-description").textContent = route.rays.map((ray, i) => {
      const boxCell = board.tiles.indexOf(i === 0 ? "M" : "S");
      cells[boxCell].classList.toggle("arrived", ray.end === "ready");
      const via = ray.turns.map(index => coordinate(board, board.mirrors[index]));
      return [
        paired ? t("beamFrom", {ray: t(i === 0 ? "moonRay" : "starRay"), cell: coordinate(board, i === 0 ? board.source : board.starSource)})
          : t("routeFrom", {cell: coordinate(board, board.source)}),
        via.length ? t(board.hill ? "hillVia" : "routeVia", {cells: via.join(" → ")}) : "",
        t(board.film ? "cameraTo" : "routeTo", {cell: coordinate(board, boxCell)}),
        paired ? t(ray.end === "ready" ? "arrived" : ray.end === "wrongBox" ? "wrongBox" : "inTransit") : "",
      ].filter(Boolean).join(" ");
    }).join(" ");
  }

  let animation = 0;
  async function carryLetter({ arrivals, signal, onBeat } = {}) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden || signal?.aborted) return;
    const version = ++animation;
    const journeys = groups.slice(0, paired ? 2 : 1).map((group, i) => {
      const parts = Array.from(group.querySelectorAll(".beam-core"), path => ({ path, length: path.getTotalLength() }));
      return { parts, courier: couriers[i], total: parts.reduce((sum, part) => sum + part.length, 0) };
    });
    const lastBeat = arrivals ? Math.max(...arrivals) : 0;
    const duration = lastBeat ? Math.min(1900, 180 * lastBeat) : Math.min(1700, 520 + Math.max(...journeys.map(journey => journey.total)) * 0.6);
    chart.classList.add("sending");
    journeys.forEach(({ courier }) => courier.removeAttribute("hidden"));
    try {
      await new Promise(resolve => {
        const start = performance.now();
        let frameId;
        function finish() {
          cancelAnimationFrame(frameId);
          document.removeEventListener("visibilitychange", visibility);
          signal?.removeEventListener("abort", finish);
          resolve();
        }
        function visibility() { if (document.hidden) finish(); }
        function frame(now) {
          const progress = Math.min(1, (now - start) / duration);
          journeys.forEach((journey, i) => moveEnvelope(journey, lastBeat ? Math.min(1, progress * lastBeat / arrivals[i]) : progress));
          if (lastBeat) onBeat?.(Math.floor(progress * lastBeat));
          if (progress === 1) finish();
          else frameId = requestAnimationFrame(frame);
        }
        document.addEventListener("visibilitychange", visibility);
        signal?.addEventListener("abort", finish, { once: true });
        frame(start);
      });
    } finally {
      if (animation === version) {
        journeys.forEach(({ courier }) => courier.setAttribute("hidden", ""));
        chart.classList.remove("sending");
      }
    }
  }
  function compareRays(rays) {
    overlay.replaceChildren(...rays.flatMap((ray, index) => ray.lines.map(line => {
      const path = document.createElementNS(svgNS, "polyline");
      path.setAttribute("points", line.map(([x, y]) => [x * 100, y * 100].join(",")).join(" "));
      path.dataset.comparisonRay = index;
      return path;
    })));
  }
  return { cells, draw, drawLines, carryLetter, compareRays, compareExposure: ray => compareRays(ray ? [ray] : []) };
}

function moveEnvelope({ courier, total, parts }, progress) {
  let travel = total * progress;
  for (const part of parts) {
    if (travel <= part.length || part === parts.at(-1)) {
      const { x, y } = part.path.getPointAtLength(Math.min(travel, part.length));
      courier.setAttribute("transform", "translate(" + x + " " + y + ")");
      return;
    }
    travel -= part.length;
  }
}
