import { coordinate } from "./chart.js";
import { filedHillTrip, prepareHill } from "./hillside.mjs";

const byId = id => document.getElementById(id);
const ns = "http://www.w3.org/2000/svg";
export const hillKey = (mode, field) => "hill.v1." + mode + "." + field;

export function hillTickets(letter, mode, read) {
  const records = new Map();
  // Retrace each filed configuration on its own edition before showing a ticket.
  const ids = ["lantern", "market", "balcony", "orchard", "cut"];
  for (const id of ids) {
    const state = read(hillKey(mode, id));
    if (state === undefined) continue;
    const board = prepareHill(letter, mode);
    const trip = filedHillTrip(board, state, id);
    if (trip) records.set(id, { state, trip });
  }
  return records;
}

export function hillSummary(board, trip, t) {
  return t("hillJourney", { first: coordinate(board, trip.stamps[0]), second: coordinate(board, trip.stamps[1]),
    side: t(trip.side), n: trip.length });
}

function miniMap(board, trip) {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + board.width * 10 + " " + board.height * 10);
  svg.setAttribute("aria-hidden", "true");
  const point = cell => [5 + cell % board.width * 10, 5 + Math.floor(cell / board.width) * 10];
  const line = document.createElementNS(ns, "polyline");
  line.setAttribute("points", trip.cells.map(cell => point(cell).join(",")).join(" "));
  svg.append(line);
  for (const cell of [board.source, ...trip.stamps, board.tiles.indexOf("M")]) {
    const circle = document.createElementNS(ns, "circle");
    const [x, y] = point(cell);
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", cell === board.source ? 1.8 : 2.7);
    svg.append(circle);
  }
  return svg;
}

export function drawHillBook(board, records, goal, overlay, t, locked) {
  const list = byId("hill-lines");
  const buttons = board.hill.lines.map(id => {
    const record = records.get(id);
    let button = list.querySelector('[data-line="' + id + '"]');
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.line = id;
      const stamp = document.createElement("span");
      stamp.className = "hill-stamp";
      stamp.setAttribute("aria-hidden", "true");
      button.append(stamp, document.createElement("strong"), document.createElement("small"));
    }
    const pressed = id === (record ? overlay : goal);
    button.setAttribute("aria-pressed", String(pressed));
    button.disabled = locked;
    button.dataset.filed = String(!!record);
    const icon = button.firstElementChild;
    if (record && icon.dataset.path !== record.trip.signature) {
      icon.replaceChildren(miniMap(board, record.trip));
      icon.dataset.path = record.trip.signature;
    }
    if (!record) { icon.textContent = "◇"; delete icon.dataset.path; }
    button.children[1].textContent = t("hillName_" + id);
    button.children[2].textContent = t(record ? pressed ? "hillOverlaid" : "hillOverlay" : pressed ? "hillPinned" : "hillClue");
    return button;
  });
  if (buttons.some((button, i) => list.children[i] !== button)) list.replaceChildren(...buttons);
  byId("hill-count").textContent = t("hillFiled", { n: records.size, total: buttons.length });
  byId("hill-homeward").hidden = records.size !== buttons.length;
  const clue = byId("hill-clue");
  clue.hidden = !goal;
  if (goal) clue.textContent = t("hillName_" + goal) + " · " + t("hillClue_" + (board.hill.summit && goal === "lantern" ? "summit" : goal));
  const comparison = records.get(overlay);
  const caption = byId("hill-comparison");
  caption.hidden = !comparison;
  if (comparison) caption.textContent = t("hillTracing", { name: t("hillName_" + overlay) }) + " " + hillSummary(board, comparison.trip, t);
}

export function drawHillSlip(board, trip, t) {
  const slip = byId("hill-slip");
  slip.querySelector("strong").textContent = t("hillName_" + trip.id);
  slip.querySelector("small").textContent = hillSummary(board, trip, t);
  slip.querySelector("p").textContent = t("hillStory_" + trip.id);
  slip.querySelector(".hill-slip-map").replaceChildren(miniMap(board, trip));
}
