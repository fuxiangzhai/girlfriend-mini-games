const svgNS = "http://www.w3.org/2000/svg";
const arrows = ">v<^";
const directions = ["东", "南", "西", "北"];
const features = {
  M: ["box", "收信箱"], "#": ["reef", "礁石"], "*": ["mark", "星形邮戳"], "@": ["gate", "潮门"],
};

export function coordinate(board, cell) {
  return String.fromCharCode(65 + cell % board.width) + (1 + Math.floor(cell / board.width));
}

function glyph(name) {
  const icon = document.createElementNS(svgNS, "svg");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svgNS, "use");
  use.setAttribute("href", "#g-" + name);
  icon.append(use);
  return icon;
}

function axis(id, labels) {
  document.getElementById(id).replaceChildren(...labels.map(label => {
    const span = document.createElement("span");
    span.textContent = label;
    return span;
  }));
}

export function mountChart(board, onRotate) {
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
    let feature = features[tile];
    if (direction !== -1) feature = ["lamp", "向" + directions[direction] + "发出的月光源"];
    if (isMirror) feature = ["mirror", "圆镜"];
    const name = feature?.[0] || "water";
    element.className = "tile " + name;
    if (isMirror) {
      element.type = "button";
      element.dataset.mirror = index;
      element.addEventListener("click", () => onRotate(index));
    } else if (feature) {
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", coordinate(board, cell) + " " + feature[1]);
    } else {
      element.setAttribute("aria-hidden", "true");
    }
    if (feature || (cell * 7 + Math.floor(cell / board.width)) % 5 < 2) element.append(glyph(name));
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
      mirror.setAttribute("aria-label", coordinate(board, cell) + " 圆镜，" + (falling ? "左上至右下" : "左下至右上") + (index === hint ? "，提示位置" : ""));
    });
    board.marks.forEach(cell => {
      cells[cell].classList.toggle("lit", route.lit.has(cell));
      cells[cell].setAttribute("aria-label", coordinate(board, cell) + (route.lit.has(cell) ? " 已点亮邮戳" : " 未点亮邮戳"));
    });
    cells[board.tiles.indexOf("M")].classList.toggle("arrived", route.end === "ready");
    const via = route.turns.map(index => coordinate(board, board.mirrors[index]));
    document.getElementById("route-description").textContent = "月光从 " + coordinate(board, board.source) + " 出发。" +
      (via.length ? "依次经过圆镜 " + via.join("、") + "。" : "") + "信箱在 " + coordinate(board, board.tiles.indexOf("M")) + "。";
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
