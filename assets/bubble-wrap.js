import { enableGridKeyboard } from "./grid-keys.js";
import { bindGameSound } from "./sound.js";

const sheet = document.getElementById("bubble-sheet");
const countLabel = document.getElementById("bubble-count");
const progress = document.getElementById("bubble-progress");
const status = document.getElementById("bubble-status");
const newSheet = document.getElementById("new-sheet");
const sound = bindGameSound(document.getElementById("sound"), document.getElementById("sound-label"));
let count = 0;

const bubbles = Array.from({ length: progress.max }, (_, index) => {
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "bubble";
  bubble.tabIndex = -1;
  bubble.dataset.label = "气泡 " + (index + 1);
  bubble.setAttribute("aria-label", bubble.dataset.label);
  return bubble;
});
sheet.append(...bubbles);
enableGridKeyboard(sheet, 6);

function updateProgress() {
  countLabel.textContent = String(count).padStart(2, "0");
  progress.value = count;
  newSheet.disabled = count === 0;
  status.textContent = count === bubbles.length ? "这一张全捏爆啦！" : "";
}

sheet.addEventListener("click", event => {
  const bubble = event.target.closest(".bubble");
  if (!bubble || bubble.classList.contains("is-popped")) return;
  sound.unlock();
  sound.play("bubble", .88 + Math.random() * .24);
  bubble.classList.add("is-popped");
  bubble.setAttribute("aria-disabled", "true");
  bubble.setAttribute("aria-label", bubble.dataset.label + "，已捏爆");
  count++;
  updateProgress();
});

newSheet.addEventListener("click", () => {
  count = 0;
  for (const bubble of bubbles) {
    bubble.classList.remove("is-popped");
    bubble.removeAttribute("aria-disabled");
    bubble.setAttribute("aria-label", bubble.dataset.label);
  }
  bubbles[0].focus();
  updateProgress();
});
