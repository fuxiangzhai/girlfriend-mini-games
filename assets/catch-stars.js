import { bindGameSound } from "./sound.js";

const laneCount = 5;
const starCount = 12;
const launchInterval = 1050;
const fallDuration = 2550;
const stage = document.getElementById("catch-stage");
const fallingStars = document.getElementById("falling-stars");
const startPanel = document.getElementById("catch-start");
const startButton = document.getElementById("start-catching");
const countLabel = document.getElementById("caught-count");
const status = document.getElementById("catch-status");
const sound = bindGameSound(document.getElementById("sound"), document.getElementById("sound-label"));
let lane = 2;
let round;
let pointer;

function moveBasket(next) {
  lane = Math.min(laneCount - 1, Math.max(0, next));
  stage.style.setProperty("--lane", lane);
}

function moveToPointer(event) {
  const bounds = stage.getBoundingClientRect();
  moveBasket(Math.floor((event.clientX - bounds.left) / bounds.width * laneCount));
}

stage.addEventListener("pointerdown", event => {
  if (!round || !event.isPrimary || event.button !== 0) return;
  pointer = event.pointerId;
  stage.setPointerCapture(pointer);
  moveToPointer(event);
});
stage.addEventListener("pointermove", event => {
  if (round && event.pointerId === pointer) moveToPointer(event);
});
stage.addEventListener("lostpointercapture", event => {
  if (event.pointerId === pointer) pointer = undefined;
});
stage.addEventListener("keydown", event => {
  if (!round) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  moveBasket(lane + (event.key === "ArrowLeft" ? -1 : 1));
});

function spawnStar(activeRound) {
  const index = activeRound.launched++;
  const nextLane = index === 0 ? 2 : Math.floor(Math.random() * laneCount);
  const element = document.createElement("span");
  element.className = "falling-star";
  element.style.setProperty("--lane", nextLane);
  fallingStars.append(element);
  activeRound.stars.push({ element, lane: nextLane, launchTime: index * launchInterval });
}

function catchStar(activeRound) {
  activeRound.caught++;
  countLabel.textContent = String(activeRound.caught).padStart(2, "0");
  sound.play("star");
  const spark = document.createElement("span");
  spark.className = "catch-spark";
  spark.setAttribute("aria-hidden", "true");
  spark.style.setProperty("--lane", lane);
  spark.textContent = "✦";
  fallingStars.append(spark);
  window.setTimeout(() => spark.remove(), 380);
}

function frame(time) {
  const activeRound = round;
  activeRound.elapsed += Math.min(time - (activeRound.lastFrame ?? time), 60);
  activeRound.lastFrame = time;
  while (activeRound.launched < starCount && activeRound.elapsed >= activeRound.launched * launchInterval) {
    spawnStar(activeRound);
  }

  const travel = stage.clientHeight - 28;
  activeRound.stars = activeRound.stars.filter(star => {
    const progress = (activeRound.elapsed - star.launchTime) / fallDuration;
    if (progress >= .90 && progress <= 1 && star.lane === lane) {
      catchStar(activeRound);
    } else if (progress < 1) {
      star.element.style.transform = "translateY(" + (progress * travel - 30) + "px)";
      return true;
    }
    star.element.remove();
    return false;
  });

  if (activeRound.launched < starCount || activeRound.stars.length) {
    requestAnimationFrame(frame);
    return;
  }
  round = undefined;
  pointer = undefined;
  stage.classList.remove("is-playing");
  status.textContent = "接到了 " + activeRound.caught + " 颗星星。";
  startButton.textContent = "再接一轮";
  startPanel.hidden = false;
  if (document.activeElement === stage) startButton.focus({ preventScroll: true });
}

startButton.addEventListener("click", () => {
  if (round) return;
  sound.unlock();
  round = { elapsed: 0, launched: 0, stars: [], caught: 0 };
  moveBasket(2);
  countLabel.textContent = "00";
  status.textContent = "";
  startPanel.hidden = true;
  stage.classList.add("is-playing");
  stage.focus({ preventScroll: true });
  requestAnimationFrame(frame);
});
