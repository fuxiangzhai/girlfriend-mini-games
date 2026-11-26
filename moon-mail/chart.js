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

function axis(id, labels) {
  document.getElementById(id).replaceChildren(...labels.map(label => {
    const span = document.createElement("span");
    span.textContent = label;
    return span;
  }));
}

export function mountChart(board, onRotate, t) {
  const chart = document.getElementById("chart");
  const tiles = document.getElementById("tiles");
  const beam = document.getElementById("beam");
  const groups = [...beam.querySelectorAll(".beam-lines [data-ray]")];
  const couriers = [document.getElementById("courier"), document.getElementById("star-courier")];
  const paired = board.starSource !== undefined;
  groups.forEach(group => group.replaceChildren());
  const frame = chart.parentElement;
  frame.style.setProperty("--cols", board.width);
  frame.style.setProperty("--rows", board.height);
  beam.setAttribute("viewBox", [0, 0, board.width * 100, board.height * 100].join(" "));
  beam.setAttribute("preserveAspectRatio", "none");
  axis("col-labels", Array.from({ length: board.width }, (_, i) => String.fromCharCode(65 + i)));
  axis("row-labels", Array.from({ length: board.height }, (_, i) => i + 1));

  const cells = Array.from(board.tiles, (tile, cell) => {
    const index = board.mirrorAt.get(cell);
    const isMirror = index !== undefined;
    const element = document.createElement(isMirror ? "button" : "span");
    const starDirection = starArrows.indexOf(tile);
    const direction = starDirection !== -1 ? starDirection : arrows.indexOf(tile);
    let name = features[tile] || "water";
    if (direction !== -1) name = starDirection !== -1 ? "starLamp" : "lamp";
    if (paired && tile === "M") name = "moonBox";
    if (isMirror) name = "mirror";
    if (isNumbered(tile)) name = "number";
    element.className = "tile " + name + (name === "number" ? " mark" : "");
    if (isMirror) {
      element.type = "button";
      element.dataset.mirror = index;
      element.addEventListener("click", () => onRotate(index));
    } else if (name !== "water") {
      element.setAttribute("role", "img");
      const label = direction !== -1 ? t(starDirection !== -1 ? "starLampLabel" : "lampLabel", {direction: t(directions[direction])})
        : name === "number" ? t("sealLabel", {n: tile}) : t(name);
      element.setAttribute("aria-label", coordinate(board, cell) + " " + label);
    } else {
      element.setAttribute("aria-hidden", "true");
    }
    if (name !== "water" || (cell * 7 + Math.floor(cell / board.width)) % 5 < 2) element.append(glyph(name, name === "number" ? tile : null));
    if (direction !== -1) {
      const arrow = document.createElement("i");
      arrow.className = "heading-arrow";
      arrow.style.setProperty("--angle", direction * 90 + "deg");
      element.append(arrow);
    }
    return element;
  });
  tiles.replaceChildren(...cells);

  function draw(mask, route, hint, locked) {
    route.rays.forEach((ray, i) => {
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
    board.mirrors.forEach((cell, index) => {
      const mirror = cells[cell];
      const falling = !!(mask & (1 << index));
      mirror.classList.toggle("falling", falling);
      mirror.classList.toggle("hinted", index === hint);
      mirror.disabled = locked;
      mirror.setAttribute("aria-label", t("mirrorLabel", {cell: coordinate(board, cell), slope: t(falling ? "falling" : "rising")}) + (index === hint ? t("hinted") : ""));
    });
    board.marks.forEach(cell => {
      cells[cell].classList.toggle("lit", route.lit.has(cell));
      const tile = board.tiles[cell];
      const name = isNumbered(tile) ? t("sealLabel", {n: tile}) : t("mark");
      cells[cell].setAttribute("aria-label", [coordinate(board, cell), name, t(route.lit.has(cell) ? "lit" : "unlit")].join(" "));
    });
    if (paired) {
      const seal = cells[board.jointCell];
      seal.dataset.count = route.jointCount;
      seal.setAttribute("aria-label", coordinate(board, board.jointCell) + " " + t("sealCount", {n: route.jointCount}));
    }
    document.getElementById("route-description").textContent = route.rays.map((ray, i) => {
      const boxCell = board.tiles.indexOf(i === 0 ? "M" : "S");
      cells[boxCell].classList.toggle("arrived", ray.end === "ready");
      const via = ray.turns.map(index => coordinate(board, board.mirrors[index]));
      return [
        paired ? t("beamFrom", {ray: t(i === 0 ? "moonRay" : "starRay"), cell: coordinate(board, i === 0 ? board.source : board.starSource)})
          : t("routeFrom", {cell: coordinate(board, board.source)}),
        via.length ? t("routeVia", {cells: via.join(" → ")}) : "",
        t("routeTo", {cell: coordinate(board, boxCell)}),
        paired ? t(ray.end === "ready" ? "arrived" : ray.end === "wrongBox" ? "wrongBox" : "inTransit") : "",
      ].filter(Boolean).join(" ");
    }).join(" ");
  }

  async function carryLetter() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) return;
    const journeys = groups.slice(0, paired ? 2 : 1).map((group, i) => {
      const parts = Array.from(group.querySelectorAll(".beam-core"), path => ({ path, length: path.getTotalLength() }));
      return { parts, courier: couriers[i], total: parts.reduce((sum, part) => sum + part.length, 0) };
    });
    const duration = Math.min(1700, 520 + Math.max(...journeys.map(journey => journey.total)) * 0.6);
    chart.classList.add("sending");
    journeys.forEach(({ courier }) => courier.removeAttribute("hidden"));
    try {
      await new Promise(resolve => {
        const start = performance.now();
        let frameId;
        function finish() {
          cancelAnimationFrame(frameId);
          document.removeEventListener("visibilitychange", visibility);
          resolve();
        }
        function visibility() { if (document.hidden) finish(); }
        function frame(now) {
          const progress = Math.min(1, (now - start) / duration);
          for (const journey of journeys) moveEnvelope(journey, progress);
          if (progress === 1) finish();
          else frameId = requestAnimationFrame(frame);
        }
        document.addEventListener("visibilitychange", visibility);
        frame(start);
      });
    } finally {
      journeys.forEach(({ courier }) => courier.setAttribute("hidden", ""));
      chart.classList.remove("sending");
    }
  }
  return { draw, carryLetter };
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
