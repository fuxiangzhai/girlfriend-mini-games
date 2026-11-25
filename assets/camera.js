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
  if (phase === "model") return "摄像头已连接，但手势模型加载失败。检查网络后重新开启摄像头。";
  if (phase === "preview") return "摄像头已连接，但浏览器没能播放预览。请用独立浏览器打开链接再试。";

  switch (error.name) {
    case "NotAllowedError":
      return "浏览器未允许摄像头访问。请在地址栏的网站设置中允许摄像头。如果是在内嵌预览，请复制链接到 Chrome 或 Edge 打开。";
    case "SecurityError":
      return "当前页面禁止使用摄像头。请复制游戏链接到 Chrome 或 Edge 打开。";
    case "NotFoundError":
      return "浏览器没有找到可用的摄像头。请先用设备自带的相机检查画面。";
    case "NotReadableError":
    case "AbortError":
      return "浏览器找到了摄像头，但无法启动。请关闭可能占用摄像头的应用，然后重试。";
    default:
      return "摄像头启动失败。可以重新开启摄像头，或先点击头像玩。";
  }
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
    if (!window.isSecureContext) {
      onState("off", "摄像头需要 HTTPS。请打开游戏的 HTTPS 链接，本机调试可以使用 localhost。");
      return;
    }
    const policy = document.permissionsPolicy ?? document.featurePolicy;
    if (policy?.allowsFeature?.("camera") === false || !navigator.mediaDevices?.getUserMedia) {
      onState("off", "当前浏览器或内嵌预览未开放摄像头。请复制游戏链接到 Chrome 或 Edge 打开。");
      return;
    }

    const session = { swipe: new PalmSwipe(), animation: 0, stream: undefined };
    active = session;
    onState("loading");
    let phase = "camera";
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user" } });
      } catch (error) {
        // Retry a device startup failure with the browser's default camera.
        if (session !== active || !["NotReadableError", "OverconstrainedError"].includes(error.name)) throw error;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      if (session !== active) {
        release(stream);
        return;
      }
      session.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (session === active) stop("摄像头已断开。你可以点击头像继续玩。");
      }, { once: true });
      phase = "preview";
      video.srcObject = stream;
      onState("initializing");
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
            const { landmarks } = detector.detectForVideo(video, time);
            const hand = landmarks[0];
            if (hand) lastSeen = time;
            const seen = time - lastSeen < 175;
            if (tracking !== seen) {
              tracking = seen;
              onHand(seen);
            }
            drawHand(hand, connections);
            const direction = session.swipe.sample(hand, time);
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
