import { enableGridKeyboard } from "./grid-keys.js";
import { bindGameSound } from "./sound.js";

const fruits = [
  { icon: "🍓", label: "草莓" },
  { icon: "🍋", label: "柠檬" },
  { icon: "🍒", label: "樱桃" },
  { icon: "🍉", label: "西瓜" },
  { icon: "🍊", label: "橙子" },
  { icon: "🫐", label: "蓝莓" },
];
const board = document.getElementById("memory-board");
const countLabel = document.getElementById("memory-count");
const progress = document.getElementById("memory-progress");
const status = document.getElementById("memory-status");
const shuffle = document.getElementById("shuffle-cards");
const sound = bindGameSound(document.getElementById("sound"), document.getElementById("sound-label"));
let deck;
let firstCard;
let mismatchedTurn;
let pairs = 0;

const cards = Array.from({ length: fruits.length * 2 }, (_, index) => {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "fruit-card";
  card.tabIndex = -1;
  card.dataset.index = String(index);
  return card;
});
board.append(...cards);
enableGridKeyboard(board, 4);

function displayCard(card, state) {
  const index = Number(card.dataset.index);
  const fruit = deck[index];
  card.dataset.state = state;
  card.classList.toggle("is-face-up", state !== "down");
  card.classList.toggle("is-matched", state === "matched");
  card.textContent = state === "down" ? "✦" : fruit.icon;
  const description = state === "down" ? "未翻开" : fruit.label;
  card.setAttribute("aria-label", "卡片 " + (index + 1) + "，" + description + (state === "matched" ? "，已配对" : ""));
  if (state === "matched") card.setAttribute("aria-disabled", "true");
  else card.removeAttribute("aria-disabled");
}

function updateProgress() {
  countLabel.textContent = String(pairs);
  progress.value = pairs;
  status.textContent = pairs === fruits.length ? "全部配对成功！" : "";
}

function newRound() {
  clearTimeout(mismatchedTurn);
  mismatchedTurn = undefined;
  firstCard = undefined;
  pairs = 0;
  deck = [...fruits, ...fruits];
  for (let index = deck.length - 1; index > 0; index--) {
    const choice = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[choice]] = [deck[choice], deck[index]];
  }
  for (const card of cards) displayCard(card, "down");
  updateProgress();
}

board.addEventListener("click", event => {
  const card = event.target.closest(".fruit-card");
  if (!card || mismatchedTurn || card.dataset.state !== "down") return;
  sound.unlock();
  displayCard(card, "up");
  if (!firstCard) {
    firstCard = card;
    sound.play("flip");
    return;
  }

  const previous = firstCard;
  firstCard = undefined;
  if (deck[Number(previous.dataset.index)] === deck[Number(card.dataset.index)]) {
    displayCard(previous, "matched");
    displayCard(card, "matched");
    pairs++;
    updateProgress();
    sound.play("match");
    return;
  }

  sound.play("flip", .87);
  mismatchedTurn = window.setTimeout(() => {
    displayCard(previous, "down");
    displayCard(card, "down");
    mismatchedTurn = undefined;
  }, 700);
});

shuffle.addEventListener("click", () => {
  newRound();
  cards[0].focus();
});
newRound();
