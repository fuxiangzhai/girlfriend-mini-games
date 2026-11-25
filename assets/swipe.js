const motionWindow = 170;
const trackingGap = 195;
const hitCooldown = 150;
const restInterval = 105;

function contactPoint(from, to, target) {
  const reach = Math.max(from.reach, to.reach);
  const radiusX = target.radiusX + reach;
  const radiusY = target.radiusY + reach;
  const offsetX = (from.x - target.x) / radiusX;
  const offsetY = (from.y - target.y) / radiusY;
  const dx = (to.x - from.x) / radiusX;
  const dy = (to.y - from.y) / radiusY;
  const along = -(offsetX * dx + offsetY * dy) / (dx * dx + dy * dy);
  const closest = Math.max(0, Math.min(1, along));
  if (Math.hypot(offsetX + closest * dx, offsetY + closest * dy) > 1) return;

  // Place the effect on the portrait even when the edge of the palm touched it.
  const x = from.x + (to.x - from.x) * closest - target.x;
  const y = from.y + (to.y - from.y) * closest - target.y;
  const edge = Math.max(1, Math.hypot(x / target.radiusX, y / target.radiusY));
  return { x: target.x + x / edge, y: target.y + y / edge };
}

export class PalmSwipe {
  history = [];
  lastMotion = -Infinity;
  lastHit = -Infinity;
  hitDirection = 0;

  reset() {
    this.history = [];
    this.lastMotion = -Infinity;
    this.hitDirection = 0;
  }

  sample(palm, time, target) {
    const previous = this.history.at(-1);
    if (previous && time - previous.time > trackingGap) this.reset();
    if (!palm) return;

    this.history = this.history.filter(point => time - point.time <= motionWindow);
    const minimumTravel = Math.max(14, target.radiusX * .19);
    const minimumSpeed = Math.max(.13, target.radiusX * .00185);
    const recentDx = palm.x - (this.history.at(-1)?.x ?? palm.x);
    const recentDirection = Math.abs(recentDx) >= 5 ? Math.sign(recentDx) : 0;
    let direction = 0;
    let contact;

    for (let index = this.history.length - 1; index >= 0; index--) {
      const point = this.history[index];
      const elapsed = time - point.time;
      const dx = palm.x - point.x;
      const distance = Math.abs(dx);
      if (elapsed < 30 || distance < minimumTravel || distance < elapsed * minimumSpeed
        || Math.abs(palm.y - point.y) > distance * 1.1) continue;

      const candidate = Math.sign(dx);
      if ((recentDirection && candidate !== recentDirection) || (direction && candidate !== direction)) continue;
      direction = candidate;
      contact = contactPoint(point, palm, target);
      if (contact) break;
    }

    this.history.push({ ...palm, time });
    if (!direction) {
      if (time - this.lastMotion >= restInterval) this.hitDirection = 0;
      return;
    }
    this.lastMotion = time;
    if (this.hitDirection !== direction) this.hitDirection = 0;
    if (!contact || this.hitDirection || time - this.lastHit < hitCooldown) return;

    this.hitDirection = direction;
    this.lastHit = time;
    this.history = [{ ...palm, time }];
    return { ...contact, direction };
  }
}
