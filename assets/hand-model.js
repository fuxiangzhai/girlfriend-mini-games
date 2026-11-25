const fingers = [
  { joints: [1, 2, 3, 4], radii: [.165, .147, .113, .104] },
  { joints: [5, 6, 7, 8], radii: [.135, .118, .092, .084] },
  { joints: [9, 10, 11, 12], radii: [.144, .123, .095, .087] },
  { joints: [13, 14, 15, 16], radii: [.13, .112, .09, .081] },
  { joints: [17, 18, 19, 20], radii: [.112, .092, .077, .072] },
];

function between(a, b, fraction) {
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
}

function offset(point, sideways, along, across, forward) {
  return {
    x: point.x + across.x * sideways + forward.x * along,
    y: point.y + across.y * sideways + forward.y * along,
  };
}

function outerEdge(points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const side = ordered => {
    const edge = [];
    for (const point of ordered) {
      while (edge.length >= 2) {
        const [a, b] = edge.slice(-2);
        if ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) > 0) break;
        edge.pop();
      }
      edge.push(point);
    }
    return edge.slice(0, -1);
  };
  return [...side(sorted), ...side(sorted.reverse())];
}

function addPalm(path, vertices) {
  const edge = outerEdge(vertices);
  const first = between(edge[0], edge.at(-1), .25);
  path.moveTo(first.x, first.y);
  for (let index = 0; index < edge.length; index++) {
    const joint = edge[index];
    const entry = between(joint, edge[(index + edge.length - 1) % edge.length], .25);
    const exit = between(joint, edge[(index + 1) % edge.length], .25);
    path.lineTo(entry.x, entry.y);
    path.quadraticCurveTo(joint.x, joint.y, exit.x, exit.y);
  }
  path.closePath();
}

function addFinger(path, points, profile, size) {
  const joints = profile.joints.map(index => points[index]);
  const radii = joints.map((point, index) => {
    const perspective = Math.max(.86, Math.min(1.18, 1 - point.z / size * .14));
    return size * profile.radii[index] * perspective;
  });

  for (let index = 1; index < joints.length; index++) {
    const a = joints[index - 1];
    const b = joints[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < .01) continue;
    const x = (a.y - b.y) / length;
    const y = (b.x - a.x) / length;
    const start = radii[index - 1];
    const end = radii[index];
    path.moveTo(a.x + x * start, a.y + y * start);
    path.lineTo(a.x - x * start, a.y - y * start);
    path.lineTo(b.x - x * end, b.y - y * end);
    path.lineTo(b.x + x * end, b.y + y * end);
    path.closePath();
  }
  for (let index = 0; index < joints.length; index++) {
    const point = joints[index];
    const radius = radii[index];
    path.moveTo(point.x + radius, point.y);
    path.arc(point.x, point.y, radius, 0, Math.PI * 2);
    path.closePath();
  }
}

export function renderHand(context, points, palmWidth) {
  const wrist = points[0];
  const knuckles = between(points[5], points[17], .5);
  const dx = knuckles.x - wrist.x;
  const dy = knuckles.y - wrist.y;
  const palmLength = Math.hypot(dx, dy);
  const size = Math.max(5, palmWidth, palmLength * .82);
  const forward = palmLength > .01 ? { x: dx / palmLength, y: dy / palmLength } : { x: 0, y: -1 };
  const spreadX = points[17].x - points[5].x;
  const spreadY = points[17].y - points[5].y;
  const flip = forward.x * spreadY - forward.y * spreadX < 0 ? -1 : 1;
  const across = { x: -forward.y * flip, y: forward.x * flip };
  const place = (point, sideways, along) => offset(point, sideways * size, along * size, across, forward);
  const shape = new Path2D();
  addPalm(shape, [
    place(wrist, -.29, -.13),
    place(wrist, .29, -.13),
    place(points[17], .15, .10),
    place(points[13], 0, .12),
    place(points[9], 0, .14),
    place(points[5], -.13, .10),
    place(points[1], -.13, -.05),
  ]);
  for (const profile of fingers) addFinger(shape, points, profile, size);

  const edge = Math.max(1.6, Math.min(3.2, size * .042));
  const light = place(knuckles, -.26, .90);
  const dark = place(wrist, .22, -.24);
  const finish = context.createLinearGradient(light.x, light.y, dark.x, dark.y);
  finish.addColorStop(0, "#fff0b2");
  finish.addColorStop(.53, "#ffcc7d");
  finish.addColorStop(1, "#e68b54");

  context.save();
  context.translate(edge * .8, edge * 1.6);
  context.fillStyle = "#21133562";
  context.fill(shape);
  context.restore();

  context.lineJoin = "round";
  context.lineWidth = edge * 2;
  context.strokeStyle = "#392345";
  context.stroke(shape);
  context.fillStyle = finish;
  context.fill(shape);

  context.save();
  context.clip(shape);
  context.lineCap = "round";
  context.lineWidth = Math.max(1, size * .037);
  const a = between(points[5], wrist, .34);
  const curve = between(knuckles, wrist, .50);
  const b = between(points[17], wrist, .37);
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.quadraticCurveTo(curve.x, curve.y, b.x, b.y);
  context.strokeStyle = "#a951425e";
  context.stroke();
  const gleam = place(points[9], -.085, -.08);
  const end = between(points[13], wrist, .16);
  context.beginPath();
  context.moveTo(gleam.x, gleam.y);
  context.quadraticCurveTo(knuckles.x, knuckles.y, end.x, end.y);
  context.strokeStyle = "#fff3c491";
  context.stroke();
  context.restore();
}
