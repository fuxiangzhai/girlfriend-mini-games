import { PalmSwipe } from "./swipe.js";

let detectorPromise;

function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, HandLandmarker } = await import("./vision/vision_bundle.mjs");
      const assetDirectory = new URL("./vision/", import.meta.url);
      const files = await FilesetResolver.forVisionTasks(new URL("wasm", assetDirectory).href);
      const detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL("hand-landmarker.task", assetDirectory).href },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: .51,
        minHandPresenceConfidence: .51,
        minTrackingConfidence: .5,
      });
      return { detector, connections: HandLandmarker.HAND_CONNECTIONS };
    })().catch(error => {
      detectorPromise = undefined;
      throw error;
    });
  }
  return detectorPromise;
}

function release(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

function cameraError(error, phase) {
  if (phase === "model") return "手部识别暂时加载失败。可以重新开启摄像头，或先点击头像玩。";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "摄像头权限未开启。可以在浏览器里允许访问，或直接点击头像玩。";
  }
  if (error.name === "NotFoundError") return "这里没有找到摄像头。点击头像也能玩。";
  return "摄像头暂时无法使用。可以关闭占用摄像头的应用，或直接点击头像玩。";
}

export function createCamera({ video, feed, canvas, onState, onHand, onHit }) {
  const context = canvas.getContext("2d");
  let active;

  function stop(message = "") {
    if (active) {
      cancelAnimationFrame(active.animation);
      release(active.stream);
      active = undefined;
    }
    video.srcObject = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    onState("off", message);
  }

  function drawHand(landmarks, connections) {
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      feed.style.aspectRatio = width + " / " + height;
    }
    context.clearRect(0, 0, width, height);
    if (!landmarks) return;
    const x = point => (1 - point.x) * width;
    const y = point => point.y * height;
    const line = Math.max(2, width / 145);
    context.strokeStyle = "#f5f184";
    context.lineWidth = line;
    context.lineCap = "round";
    context.beginPath();
    for (const { start, end } of connections) {
      context.moveTo(x(landmarks[start]), y(landmarks[start]));
      context.lineTo(x(landmarks[end]), y(landmarks[end]));
    }
    context.stroke();
    context.fillStyle = "#fff6df";
    for (const point of landmarks) {
      context.beginPath();
      context.arc(x(point), y(point), line, 0, Math.PI * 2);
      context.fill();
    }
  }

  async function start() {
    if (active) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onState("off", "请用 HTTPS 页面或本地预览开启摄像头。也可以直接点击头像玩。");
      return;
    }

    const session = { swipe: new PalmSwipe(), animation: 0, stream: undefined };
    active = session;
    onState("loading");
    let phase = "camera";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
      });
      if (session !== active) {
        release(stream);
        return;
      }
      session.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (session === active) stop("摄像头已断开。你可以点击头像继续玩。");
      }, { once: true });
      video.srcObject = stream;
      await video.play();
      if (session !== active) return;

      phase = "model";
      const { detector, connections } = await loadDetector();
      if (session !== active) return;
      let previousFrame = -1;
      let lastScan = -Infinity;
      let lastSeen = -Infinity;
      let tracking = false;
      onState("on");

      function scan(time) {
        if (session !== active) return;
        try {
          if (time - lastScan >= 30 && video.readyState >= 2 && video.currentTime !== previousFrame) {
            lastScan = time;
            previousFrame = video.currentTime;
            const { landmarks, handedness } = detector.detectForVideo(video, time);
            const hand = landmarks[0];
            if (hand) lastSeen = time;
            const seen = time - lastSeen < 175;
            if (tracking !== seen) {
              tracking = seen;
              onHand(seen);
            }
            drawHand(hand, connections);
            const direction = session.swipe.sample(hand, time, handedness?.[0]?.[0]?.index);
            if (direction) onHit(direction);
          }
          session.animation = requestAnimationFrame(scan);
        } catch {
          stop("手部识别中断。可以重新开启摄像头，或先点击头像玩。");
        }
      }
      session.animation = requestAnimationFrame(scan);
    } catch (error) {
      if (session === active) stop(cameraError(error, phase));
    }
  }

  return { start, stop, isActive: () => Boolean(active) };
}
