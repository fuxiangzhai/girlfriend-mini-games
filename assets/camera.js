import { PalmSwipe } from "./swipe.js";

const palmIndices = [0, 5, 9, 13, 17];
const handHoldTime = 135;
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
        minHandDetectionConfidence: .48,
        minHandPresenceConfidence: .47,
        minTrackingConfidence: .45,
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
  if (phase === "video") return "摄像头已连接，但浏览器无法读取画面。请用独立浏览器打开链接再试。";

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

export function createCamera({ video, canvas, portrait, onState, onHand, onHit }) {
  const context = canvas.getContext("2d");
  let stageWidth = 0;
  let stageHeight = 0;
  let target;
  let active;

  function measureStage() {
    const stage = canvas.getBoundingClientRect();
    const bounds = portrait.getBoundingClientRect();
    if (!stage.width || !stage.height || !bounds.width || !bounds.height) return;
    stageWidth = stage.width;
    stageHeight = stage.height;
    target = {
      x: bounds.left + bounds.width * .5 - stage.left,
      y: bounds.top + bounds.height * .5 - stage.top,
      radiusX: bounds.width * .5,
      radiusY: bounds.height * .5,
    };
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(stageWidth * scale);
    canvas.height = Math.round(stageHeight * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    active?.swipe.reset();
  }

  const resizeObserver = new ResizeObserver(measureStage);
  resizeObserver.observe(canvas);
  resizeObserver.observe(portrait);

  function stop(message = "") {
    if (active) {
      cancelAnimationFrame(active.animation);
      release(active.stream);
      active = undefined;
    }
    video.srcObject = null;
    context.clearRect(0, 0, stageWidth, stageHeight);
    onState("off", message);
  }

  function drawHand(landmarks, connections) {
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height || !target) return;
    const center = palmIndices.reduce((sum, index) => ({
      x: sum.x + landmarks[index].x / palmIndices.length,
      y: sum.y + landmarks[index].y / palmIndices.length,
    }), { x: 0, y: 0 });
    const x = (1 - center.x) * stageWidth;
    const y = center.y * stageHeight;
    const scale = Math.min(stageWidth / width, stageHeight / height);
    const points = landmarks.map(point => ({
      x: x - (point.x - center.x) * width * scale,
      y: y + (point.y - center.y) * height * scale,
    }));
    const palmWidth = Math.hypot(points[17].x - points[5].x, points[17].y - points[5].y);
    const line = Math.max(2, Math.min(4, palmWidth * .075));
    context.clearRect(0, 0, stageWidth, stageHeight);
    context.lineCap = "round";
    context.lineJoin = "round";

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const index of palmIndices.slice(1)) context.lineTo(points[index].x, points[index].y);
    context.closePath();
    context.fillStyle = "#ffe97a45";
    context.fill();

    context.beginPath();
    for (const { start, end } of connections) {
      context.moveTo(points[start].x, points[start].y);
      context.lineTo(points[end].x, points[end].y);
    }
    context.strokeStyle = "#26163b";
    context.lineWidth = line + 3;
    context.stroke();
    context.strokeStyle = "#ffe97a";
    context.lineWidth = line;
    context.stroke();

    context.fillStyle = "#fff4cd";
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, line * .85, 0, Math.PI * 2);
      context.fill();
    }
    return { x, y, reach: Math.min(28, palmWidth * .36) };
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
    measureStage();
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
      phase = "video";
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
          if (time - lastScan >= 24 && video.readyState >= 2 && video.currentTime !== previousFrame) {
            lastScan = time;
            previousFrame = video.currentTime;
            const { landmarks } = detector.detectForVideo(video, time);
            const hand = landmarks[0];
            const palm = hand && drawHand(hand, connections);
            if (palm) {
              lastSeen = time;
              if (!tracking) onHand(true);
              tracking = true;
            }
            const hit = session.swipe.sample(palm, time, target);
            if (hit) onHit(hit.direction, { x: hit.x / stageWidth, y: hit.y / stageHeight });
          }
          if (tracking && time - lastSeen >= handHoldTime) {
            tracking = false;
            context.clearRect(0, 0, stageWidth, stageHeight);
            onHand(false);
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
