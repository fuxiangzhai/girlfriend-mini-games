import { isNumbered } from "./puzzle.mjs";

const svgNS = "http://www.w3.org/2000/svg";
const arrows = ">v<^";
const directions = ["east", "south", "west", "north"];
const features = {
  M: "box", "#": "reef", "*": "mark", "@": "gate",
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
  const lines = beam.querySelector(".beam-lines");
  const courier = document.getElementById("courier");
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
    const direction = arrows.indexOf(tile);
    let name = features[tile] || "water";
    if (direction !== -1) name = "lamp";
    if (isMirror) name = "mirror";
    if (isNumbered(tile)) name = "number";
    element.className = "tile " + name + (name === "number" ? " mark" : "");
    if (isMirror) {
      element.type = "button";
      element.dataset.mirror = index;
      element.addEventListener("click", () => onRotate(index));
    } else if (name !== "water") {
      element.setAttribute("role", "img");
      const label = name === "lamp" ? t("lampLabel", {direction: t(directions[direction])})
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
    const strokes = [];
    for (const line of route.lines) {
      const points = line.map(([x, y]) => [x * 100, y * 100].join(",")).join(" ");
      for (const name of ["halo", "core", "flow"]) {
        const path = document.createElementNS(svgNS, "polyline");
        path.setAttribute("points", points);
        path.setAttribute("class", "beam-" + name);
        strokes.push(path);
      }
    }
    lines.replaceChildren(...strokes);
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
    cells[board.tiles.indexOf("M")].classList.toggle("arrived", route.end === "ready");
    const via = route.turns.map(index => coordinate(board, board.mirrors[index]));
    document.getElementById("route-description").textContent = [
      t("routeFrom", {cell: coordinate(board, board.source)}),
      via.length ? t("routeVia", {cells: via.join(" → ")}) : "",
      t("routeTo", {cell: coordinate(board, board.tiles.indexOf("M"))}),
    ].filter(Boolean).join(" ");
  }

  async function carryLetter() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) return;
    const parts = Array.from(lines.querySelectorAll(".beam-core"), path => ({ path, length: path.getTotalLength() }));
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const duration = Math.min(1700, 520 + total * 0.6);
    chart.classList.add("sending");
    courier.removeAttribute("hidden");
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
        let travel = total * progress;
        for (const part of parts) {
          if (travel <= part.length || part === parts.at(-1)) {
            const { x, y } = part.path.getPointAtLength(travel);
            courier.setAttribute("transform", "translate(" + x + " " + y + ")");
            break;
          }
          travel -= part.length;
        }
        if (progress === 1) finish();
        else frameId = requestAnimationFrame(frame);
      }
      document.addEventListener("visibilitychange", visibility);
      frame(start);
    });
    courier.setAttribute("hidden", "");
    chart.classList.remove("sending");
  }
  return { draw, carryLetter };
}
