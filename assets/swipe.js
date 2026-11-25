const palmIndices = [0, 5, 9, 13, 17];
const fingerIndices = [5, 9, 13, 17];
const maxWindow = 240;
const cooldown = 255;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function isFingerExtended(points, rootIndex) {
  const root = points[rootIndex];
  const joint = points[rootIndex + 1];
  const tip = points[rootIndex + 3];
  const firstSegment = distance(root, joint);
  const restOfFinger = distance(joint, tip);
  const total = distance(root, tip);
  return firstSegment > 0 && total > firstSegment * 1.55
    && total > (firstSegment + restOfFinger) * 0.89;
}

export class PalmSwipe {
  history = [];
  lastHit = -Infinity;

  reset() {
    this.history = [];
  }

  sample(landmarks, time, handedness) {
    if (!landmarks) return 0;
    if (fingerIndices.filter(index => isFingerExtended(landmarks, index)).length < 3) {
      this.reset();
      return 0;
    }

    const palm = palmIndices.map(index => landmarks[index]);
    const x = 1 - palm.reduce((sum, point) => sum + point.x, 0) / palm.length;
    const y = palm.reduce((sum, point) => sum + point.y, 0) / palm.length;
    const previous = this.history.at(-1);
    if (previous && (time - previous.time > 175 || previous.handedness !== handedness
      || Math.abs(previous.y - y) > .25 || Math.abs(previous.x - x) > .49)) {
      this.reset();
    }
    this.history = this.history.filter(point => time - point.time <= maxWindow);

    let direction = 0;
    if (time - this.lastHit >= cooldown && y > .13 && y < .87) {
      for (const point of this.history) {
        const elapsed = time - point.time;
        const dx = x - point.x;
        const crossesCenter = dx > 0 ? point.x < .46 && x >= .48 : point.x > .54 && x <= .52;
        if (elapsed >= 42 && Math.abs(dx) >= .145 && Math.abs(dx) / elapsed >= .00092
          && Math.abs(y - point.y) < Math.abs(dx) * .84 && crossesCenter) {
          direction = Math.sign(dx);
          this.lastHit = time;
          this.reset();
          break;
        }
      }
    }
    this.history.push({ x, y, time, handedness });
    return direction;
  }
}
