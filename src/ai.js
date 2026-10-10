import { wrapAngle } from './snake.js';

export function newBrain(diff) {
  return {
    think: Math.random() * 0.2,
    wander: Math.random() * Math.PI * 2,
    aggression: Math.random() * diff.hunt,
    boostUntil: 0,
  };
}

// Headings (relative to current) a bot considers when picking a safe direction.
const OFFSETS = [0, 0.35, -0.35, 0.75, -0.75, 1.2, -1.2, 1.7, -1.7, 2.4, -2.4, Math.PI];

/** Sets s.targetAngle / s.wantBoost. Re-plans every `diff.think` seconds or so. */
export function updateBot(s, world, dt) {
  const b = s.brain, diff = world.diff;
  s.wantBoost = world.time < b.boostUntil;
  b.think -= dt;
  if (b.think > 0) return;
  b.think = diff.think * (0.8 + Math.random() * 0.4);

  const hx = s.headX, hy = s.headY, r = s.radius;
  let goal = null;
  let boost = false;

  // 1. Hunt: cut in front of a nearby snake that isn't much bigger.
  if (b.aggression > 0.45 && s.mass > 30) {
    let bestD = 380 + b.aggression * 220;
    for (const o of world.snakes) {
      if (o === s || !o.alive) continue;
      const dx = o.headX - hx, dy = o.headY - hy;
      const d = Math.hypot(dx, dy);
      if (d >= bestD || o.mass > s.mass * 1.5) continue;
      const lead = o.radius * 3 + 80 + d * 0.3;
      const tx = o.headX + Math.cos(o.angle) * lead, ty = o.headY + Math.sin(o.angle) * lead;
      goal = Math.atan2(ty - hy, tx - hx);
      bestD = d;
      boost = d < 320 && b.aggression > 0.7 && Math.abs(wrapAngle(goal - s.angle)) < 0.6;
    }
  }

  // 2. Food: best value for the distance, preferring what's ahead.
  if (goal === null) {
    let bestScore = 0;
    world.forEachFoodNear(hx, hy, 360, (f) => {
      const dx = f.x - hx, dy = f.y - hy;
      const d = Math.hypot(dx, dy);
      if (d > 360) return;
      const a = Math.atan2(dy, dx);
      const score = f.value / (d + 30 + Math.abs(wrapAngle(a - s.angle)) * 120);
      if (score > bestScore) { bestScore = score; goal = a; }
    });
  }

  // 3. Wander.
  if (goal === null) {
    b.wander += (Math.random() - 0.5) * 0.8;
    goal = b.wander;
  } else {
    b.wander = goal;
  }

  // Head back in when near the wall.
  if (Math.hypot(hx, hy) > world.R - 380) {
    goal = Math.atan2(-hy, -hx);
    boost = false;
  }

  // Avoidance: prefer the goal heading if it's clear, else the clearest nearby heading.
  const look = (r * 4 + 150) * diff.look;
  let bestA = goal, bestScore = -Infinity, bestClear = 0;
  const consider = (a) => {
    const clear = clearance(world, s, hx, hy, a, look, r);
    const score = (clear >= look ? 3 : (clear / look) * 2)
      - Math.abs(wrapAngle(a - goal)) * 0.5
      - Math.abs(wrapAngle(a - s.angle)) * 0.15;
    if (score > bestScore) { bestScore = score; bestA = a; bestClear = clear; }
  };
  consider(goal);
  for (const off of OFFSETS) consider(s.angle + off);

  s.targetAngle = bestA;
  if (boost && bestClear >= look) b.boostUntil = world.time + 0.4;
}

/** Distance along heading `a` before hitting a body or the wall (capped at `look`). */
function clearance(world, s, x, y, a, look, r) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const step = Math.max(r * 1.2, 28);
  const lim = (world.R - r - 30) ** 2;
  for (let t = step; t <= look; t += step) {
    const px = x + ca * t, py = y + sa * t;
    if (px * px + py * py > lim) return t;
    if (world.segmentHit(px, py, r + 10, s, 1)) return t;
  }
  return look;
}
