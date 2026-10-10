import { CONFIG } from './config.js';

export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/**
 * A snake is a head that steers, plus a trail of head positions (`hist`).
 * Body segments are laid out at fixed spacing along that trail, so the body
 * follows the exact path the head took (which is what makes coiling work).
 */
export class Snake {
  constructor({ id, name, skin, x, y, angle, mass = CONFIG.startMass, player = null, speedMul = 1 }) {
    this.id = id;
    this.name = name;
    this.skin = skin;
    this.player = player;   // player index (0/1) or null for bots
    this.brain = null;      // set for bots
    this.mass = mass;
    this.angle = angle;
    this.targetAngle = angle;
    this.wantBoost = false; // input
    this.boosting = false;  // actually boosting this tick
    this.alive = true;
    this.kills = 0;
    this.dropAcc = 0;
    this.speedMul = speedMul;
    this.shieldUntil = 0;   // world time until which collisions can't pop this snake

    this.hist = [];         // flat [x0,y0,x1,y1,...], oldest first, head last
    this.segs = [];         // flat [x,y,...], head first
    this.segCount = 0;
    this.bbox = { l: 0, t: 0, r: 0, b: 0 };

    // Pre-fill a straight trail behind the spawn point.
    const len = this.targetSegs * this.spacing + 40;
    const cx = Math.cos(angle), cy = Math.sin(angle);
    for (let d = len; d > 0; d -= 6) this.hist.push(x - cx * d, y - cy * d);
    this.hist.push(x, y);
    this.layout();
  }

  get radius() { return 10 + Math.min(32, Math.sqrt(this.mass) * 1.15); }
  get spacing() { return this.radius * 0.45; }
  get targetSegs() { return Math.min(420, Math.floor(10 + this.mass * 0.28)); }
  get turnRate() { return CONFIG.turnRate * Math.pow(15 / this.radius, 0.5); }
  get headX() { return this.segs[0]; }
  get headY() { return this.segs[1]; }

  step(dt) {
    const diff = wrapAngle(this.targetAngle - this.angle);
    const maxTurn = this.turnRate * dt;
    this.angle = wrapAngle(this.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    const speed = (this.boosting ? CONFIG.boostSpeed : CONFIG.baseSpeed) * this.speedMul;
    const h = this.hist, n = h.length;
    h.push(h[n - 2] + Math.cos(this.angle) * speed * dt, h[n - 1] + Math.sin(this.angle) * speed * dt);
    this.layout();
  }

  /** Place segments every `spacing` units back along the trail. */
  layout() {
    const h = this.hist, segs = this.segs;
    const n = this.targetSegs, sp = this.spacing;
    segs.length = n * 2;

    let j = h.length - 2;
    let px = h[j], py = h[j + 1];
    segs[0] = px; segs[1] = py;
    let seg = 1, need = sp;
    j -= 2;
    while (seg < n && j >= 0) {
      const dx = h[j] - px, dy = h[j + 1] - py;
      const d = Math.hypot(dx, dy);
      if (d >= need) {
        const t = need / d;
        px += dx * t; py += dy * t;
        segs[seg * 2] = px; segs[seg * 2 + 1] = py;
        seg++;
        need = sp;
      } else {
        need -= d;
        px = h[j]; py = h[j + 1];
        j -= 2;
      }
    }
    // Trail ran out (just grew): pile the rest at the tail end; it unspools as we move.
    while (seg < n) { segs[seg * 2] = px; segs[seg * 2 + 1] = py; seg++; }
    this.segCount = n;

    // Forget trail we no longer need, keeping some slack for growth.
    if (j > 800) h.splice(0, j - 400);

    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (let i = 0; i < n * 2; i += 2) {
      const x = segs[i], y = segs[i + 1];
      if (x < l) l = x; if (x > r) r = x;
      if (y < t) t = y; if (y > b) b = y;
    }
    const rad = this.radius;
    this.bbox.l = l - rad; this.bbox.t = t - rad; this.bbox.r = r + rad; this.bbox.b = b + rad;
  }
}
