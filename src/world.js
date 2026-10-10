import { CONFIG, DIFFICULTY, BOT_NAMES, FOOD_COLORS, botSkin } from './config.js';
import { Snake } from './snake.js';
import { newBrain, updateBot } from './ai.js';

const CELL = 100;
const MAX_SEGS = 1024; // segment-grid entries are encoded as slot * MAX_SEGS + segIndex

export class World {
  constructor({ difficulty = 'normal', mode = 'versus' } = {}) {
    this.R = CONFIG.arenaRadius;
    this.diff = DIFFICULTY[difficulty];
    this.mode = mode;
    this.time = 0;
    this.snakes = [];
    this.food = [];
    this.particles = [];
    this.events = [];       // { victim, killer } — read and cleared by the game each frame
    this.pendingBots = [];  // world times at which to spawn replacement bots
    this.nextId = 1;

    this.n = Math.ceil((2 * this.R) / CELL) + 1;
    this.segGrid = Array.from({ length: this.n * this.n }, () => []);
    this.foodGrid = Array.from({ length: this.n * this.n }, () => []);

    for (let i = 0; i < CONFIG.foodTarget; i++) this.spawnFood();
    for (let i = 0; i < this.diff.bots; i++) this.spawnBot();
    this.rebuildGrids();
  }

  // ---- Spawning

  randomPoint(maxFrac) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * this.R * maxFrac;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }

  spawnFood(x, y, value, color) {
    if (x === undefined) ({ x, y } = this.randomPoint(0.97));
    value ??= 0.6 + Math.random() * Math.random() * 2.4;
    color ??= FOOD_COLORS[(Math.random() * FOOD_COLORS.length) | 0];
    this.food.push({ x, y, value, r: 3.5 + Math.sqrt(value) * 3, color, phase: Math.random() * 6.28, eaten: false });
  }

  /** Squared distance from (x, y) to the nearest living snake segment (sampled). */
  crowding(x, y) {
    let min = Infinity;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      for (let i = 0; i < s.segCount; i += 3) {
        const dx = s.segs[2 * i] - x, dy = s.segs[2 * i + 1] - y;
        const d = dx * dx + dy * dy;
        if (d < min) min = d;
      }
    }
    return min;
  }

  /** A spawn point away from other snakes; if `near` is given, try to land close to it. */
  safeSpawnPoint(near) {
    let best = null, bestD = -1;
    for (let tries = 0; tries < 30; tries++) {
      let p;
      if (near && tries < 20) {
        const a = Math.random() * Math.PI * 2, d = 250 + Math.random() * 250;
        p = { x: near.x + Math.cos(a) * d, y: near.y + Math.sin(a) * d };
        if (Math.hypot(p.x, p.y) > this.R * 0.8) continue;
      } else {
        p = this.randomPoint(0.75);
      }
      const crowd = this.crowding(p.x, p.y);
      if (crowd > 380 * 380) return p;
      if (crowd > bestD) { bestD = crowd; best = p; }
    }
    return best ?? this.randomPoint(0.5);
  }

  spawnSnake(opts, near) {
    const p = this.safeSpawnPoint(near);
    const angle = Math.atan2(-p.y, -p.x) + (Math.random() - 0.5) * 1.2; // roughly toward the middle
    const s = new Snake({ id: this.nextId++, x: p.x, y: p.y, angle, ...opts });
    this.snakes.push(s);
    return s;
  }

  spawnBot() {
    const d = this.diff;
    const taken = new Set(this.snakes.map((o) => o.name));
    const free = BOT_NAMES.filter((n) => !taken.has(n));
    const names = free.length ? free : BOT_NAMES;
    const s = this.spawnSnake({
      name: names[(Math.random() * names.length) | 0],
      skin: botSkin(),
      mass: CONFIG.startMass + Math.random() ** 2 * (d.maxMass - CONFIG.startMass),
      speedMul: d.speed,
    });
    s.brain = newBrain(d);
    return s;
  }

  // ---- Spatial queries

  cell(v) {
    const c = Math.floor((v + this.R) / CELL);
    return c < 0 ? 0 : c >= this.n ? this.n - 1 : c;
  }

  rebuildGrids() {
    for (const c of this.segGrid) c.length = 0;
    for (const c of this.foodGrid) c.length = 0;
    this.snakes.forEach((s, slot) => {
      if (!s.alive) return;
      const segs = s.segs;
      for (let i = 0; i < s.segCount; i++) {
        this.segGrid[this.cell(segs[2 * i + 1]) * this.n + this.cell(segs[2 * i])].push(slot * MAX_SEGS + i);
      }
    });
    for (const f of this.food) this.foodGrid[this.cell(f.y) * this.n + this.cell(f.x)].push(f);
  }

  /** Can `a` and `b` pass through each other? (Teammates in co-op.) */
  friendly(a, b) {
    return this.mode === 'coop' && a.player !== null && b.player !== null;
  }

  /**
   * First snake (other than `self`) with a segment overlapping a circle of radius `rad`
   * at (x, y). Other snakes' segments count as `radius * segScale`.
   */
  segmentHit(x, y, rad, self, segScale = 0.75) {
    const reach = rad + 45;
    const x0 = this.cell(x - reach), x1 = this.cell(x + reach);
    const y0 = this.cell(y - reach), y1 = this.cell(y + reach);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (const code of this.segGrid[cy * this.n + cx]) {
          const o = this.snakes[(code / MAX_SEGS) | 0];
          if (o === self || !o.alive || this.friendly(self, o)) continue;
          const i = code % MAX_SEGS;
          const dx = o.segs[2 * i] - x, dy = o.segs[2 * i + 1] - y;
          const lim = rad + o.radius * segScale;
          if (dx * dx + dy * dy < lim * lim) return o;
        }
      }
    }
    return null;
  }

  forEachFoodNear(x, y, rad, fn) {
    const x0 = this.cell(x - rad), x1 = this.cell(x + rad);
    const y0 = this.cell(y - rad), y1 = this.cell(y + rad);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (const f of this.foodGrid[cy * this.n + cx]) fn(f);
      }
    }
  }

  // ---- Simulation

  update(dt) {
    const C = CONFIG;
    this.time += dt;

    for (const s of this.snakes) if (s.alive && s.brain) updateBot(s, this, dt);

    for (const s of this.snakes) {
      if (!s.alive) continue;
      s.boosting = s.wantBoost && s.mass > C.minBoostMass;
      if (s.boosting) {
        const lost = C.boostDrain * dt;
        s.mass -= lost;
        s.dropAcc += lost;
        if (s.dropAcc >= 1.2) {
          s.dropAcc -= 1.2;
          const i = s.segCount - 1;
          this.spawnFood(s.segs[2 * i] + (Math.random() - 0.5) * 10, s.segs[2 * i + 1] + (Math.random() - 0.5) * 10,
            1.2 * C.boostDropRatio, s.skin.colors[0]);
        }
      }
      s.step(dt);
      this.slideAlongWall(s);
    }

    this.rebuildGrids();
    this.eat(dt);
    this.collide();
    this.updateParticles(dt);

    if (this.food.some((f) => f.eaten)) this.food = this.food.filter((f) => !f.eaten);
    if (this.snakes.some((s) => !s.alive)) this.snakes = this.snakes.filter((s) => s.alive);

    for (let i = 0; i < 6 && this.food.length < C.foodTarget; i++) this.spawnFood();

    const bots = this.snakes.filter((s) => s.brain).length;
    while (bots + this.pendingBots.length < this.diff.bots) this.pendingBots.push(this.time + C.botRespawnDelay);
    while (this.pendingBots.length && this.pendingBots[0] <= this.time) {
      this.pendingBots.shift();
      this.spawnBot();
    }

    // Slots changed (deaths / spawns): rebuild so AI queries next tick see the right snakes.
    this.rebuildGrids();
  }

  /** The red border is a wall, not a death: keep the head inside and turn it to run along it. */
  slideAlongWall(s) {
    const lim = this.R - s.radius;
    const hx = s.headX, hy = s.headY;
    const d = Math.hypot(hx, hy);
    if (d <= lim) return;
    const nx = hx / d, ny = hy / d; // outward normal
    const h = s.hist;
    h[h.length - 2] = nx * lim;
    h[h.length - 1] = ny * lim;
    const cx = Math.cos(s.angle), cy = Math.sin(s.angle);
    const out = cx * nx + cy * ny;
    if (out > 0) {
      let tx = cx - out * nx, ty = cy - out * ny;
      if (Math.hypot(tx, ty) < 0.05) {
        // Head-on into the wall: pick the side the stick is leaning toward.
        const side = Math.cos(s.targetAngle) * -ny + Math.sin(s.targetAngle) * nx >= 0 ? 1 : -1;
        tx = -ny * side; ty = nx * side;
      }
      s.angle = Math.atan2(ty, tx);
    }
    s.layout();
  }

  eat(dt) {
    const C = CONFIG;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const hx = s.headX, hy = s.headY, r = s.radius;
      const reach = r + C.magnetRange;
      this.forEachFoodNear(hx, hy, reach, (f) => {
        if (f.eaten) return;
        const dx = hx - f.x, dy = hy - f.y;
        const d = Math.hypot(dx, dy);
        if (d < r * 0.8 + f.r) {
          f.eaten = true;
          s.mass += f.value;
        } else if (d < reach) {
          const pull = Math.min(d, (C.magnetSpeed + (reach - d) * 4) * dt);
          f.x += (dx / d) * pull;
          f.y += (dy / d) * pull;
        }
      });
    }
  }

  collide() {
    const deaths = [];
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const hx = s.headX, hy = s.headY, r = s.radius;
      if (s.shieldUntil > this.time) continue;
      const hit = this.segmentHit(hx, hy, r * 0.75, s);
      if (hit) deaths.push([s, hit]);
    }
    // Resolve after checking everyone, so head-on crashes pop both snakes.
    for (const [s, killer] of deaths) this.kill(s, killer);
  }

  kill(s, killer) {
    if (!s.alive) return;
    s.alive = false;
    if (killer) killer.kills++;
    this.events.push({ victim: s, killer });

    // Pop into food along the body.
    const n = s.segCount;
    const total = s.mass * CONFIG.deathDropRatio;
    const count = Math.max(3, Math.min(n, Math.round(total / 2)));
    const r = s.radius;
    for (let k = 0; k < count; k++) {
      const i = Math.floor((k * n) / count);
      this.spawnFood(
        s.segs[2 * i] + (Math.random() - 0.5) * r * 1.4,
        s.segs[2 * i + 1] + (Math.random() - 0.5) * r * 1.4,
        total / count,
        s.skin.colors[k % s.skin.colors.length],
      );
    }

    // Sparkles.
    const sparks = 24 + Math.min(40, n / 3);
    for (let k = 0; k < sparks; k++) {
      const i = (Math.random() * n) | 0;
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
      this.particles.push({
        x: s.segs[2 * i], y: s.segs[2 * i + 1],
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: 0.5 + Math.random() * 0.5,
        size: r * (0.8 + Math.random()),
        color: s.skin.colors[k % s.skin.colors.length],
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
    if (this.particles.some((p) => p.life >= p.max)) this.particles = this.particles.filter((p) => p.life < p.max);
  }
}
