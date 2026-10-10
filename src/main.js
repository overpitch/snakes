import { CONFIG, DEFAULT_LOOKS, MODES, DIFFICULTIES, PLAYER_LABEL_COLORS, playerSkin } from './config.js';
import { World } from './world.js';
import { Input } from './input.js';
import { drawWorld } from './render.js';
import { drawTitle, drawHud, drawTeamScore, drawPause, LOOK_ROWS, lengthOf } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
addEventListener('resize', resize);
resize();

// ---- Saved stuff (looks, settings, records)

const SAVE_KEY = 'snakes.save.v1';
const save = (() => {
  const base = { looks: structuredClone(DEFAULT_LOOKS), mode: 'versus', difficulty: 'normal', best: 0, teamBest: 0 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return base; }
})();
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode etc. */ }
}

// ---- Game state

const input = new Input();
let screen = 'title';               // 'title' | 'play'
let paused = false;
let world = new World({ difficulty: 'normal' }); // the title screen plays bots in the background
const slots = [null, null];          // joined devices: { device, row }
let players = [];
let startAt = null;                  // title countdown end (seconds), once everyone's ready
const START_COUNTDOWN = 3;
let mode = 'versus';                 // this game's mode: 'solo' with one player, else save.mode
let feed = [];                       // [{ text, time }]
const titleCam = { x: 0, y: 0, zoom: 0.8 };
let titleFollow = null;

function startGame() {
  mode = slots.filter(Boolean).length === 1 ? 'solo' : save.mode;
  world = new World({ difficulty: save.difficulty, mode });
  feed = [];
  paused = false;
  players = [];
  slots.forEach((slot, i) => {
    if (!slot) return;
    players.push({
      index: i, device: slot.device, labelColor: PLAYER_LABEL_COLORS[i],
      snake: null, deadAt: 0, lastLength: 0, best: 0,
      cam: { x: 0, y: 0, zoom: 1 },
    });
  });
  for (const p of players) spawnPlayer(p, CONFIG.playerStartMass);
  screen = 'play';
}

function spawnPlayer(p, mass) {
  // In co-op, land near your teammate.
  const mate = mode === 'coop' ? players.find((q) => q !== p && q.snake?.alive)?.snake : null;
  const near = mate ? { x: mate.headX, y: mate.headY } : null;
  const s = world.spawnSnake({ name: `P${p.index + 1}`, skin: playerSkin(save.looks[p.index]), mass, player: p.index }, near);
  s.shieldUntil = world.time + CONFIG.spawnShield;
  const first = !p.snake;
  p.snake = s;
  Object.assign(p.cam, { x: s.headX, y: s.headY }); // jump straight to the new snake
  if (first) p.cam.zoom = targetZoom(s, viewFor(p));
}

function toTitle() {
  for (const slot of slots) if (slot) slot.ready = false;
  screen = 'title';
  paused = false;
  world = new World({ difficulty: 'normal' });
}

// ---- Update

/** A device that isn't anyone's yet pressed A: give it a player whose controller vanished, if any. */
function takeOver(owners) {
  const taken = [];
  for (const id of input.ids()) {
    if (owners.some((o) => o.device === id) || !input.pressed(id, 'a')) continue;
    const orphan = owners.find((o) => !input.state(o.device));
    if (!orphan) break;
    orphan.device = id;
    taken.push(id);
    input.rumble(id, 120, 0.2, 0.5);
  }
  return taken;
}

function updateTitle() {
  const taken = takeOver(slots.filter(Boolean));
  for (const id of input.ids()) {
    if (taken.includes(id)) continue;
    const i = slots.findIndex((s) => s?.device === id);
    if (i < 0) {
      if (input.pressed(id, 'a')) {
        const free = slots.indexOf(null);
        if (free >= 0) { slots[free] = { device: id, row: 0, ready: false }; input.rumble(id, 120, 0.2, 0.5); }
      }
      continue;
    }
    const slot = slots[i], look = save.looks[i];
    if (input.pressed(id, 'b')) {
      if (slot.ready) slot.ready = false; else slots[i] = null;
      continue;
    }
    if (input.pressed(id, 'a')) { slot.ready = !slot.ready; input.rumble(id, 100, 0.1, 0.4); }
    if (input.pressed(id, 'up')) slot.row = (slot.row + LOOK_ROWS.length - 1) % LOOK_ROWS.length;
    if (input.pressed(id, 'down')) slot.row = (slot.row + 1) % LOOK_ROWS.length;
    const dir = input.pressed(id, 'right') - input.pressed(id, 'left');
    if (dir) {
      const row = LOOK_ROWS[slot.row];
      look[row.key] = (look[row.key] + dir + row.list.length) % row.list.length;
      persist();
    }
    if (input.pressed(id, 'x')) { save.mode = MODES[(MODES.indexOf(save.mode) + 1) % MODES.length]; persist(); }
    if (input.pressed(id, 'y')) { save.difficulty = DIFFICULTIES[(DIFFICULTIES.indexOf(save.difficulty) + 1) % DIFFICULTIES.length]; persist(); }
    // Edge on Xbox keeps the Menu button for itself, so A ("ready") is the real way to start.
    if (input.pressed(id, 'menu')) { startGame(); return; }
  }
  // Everyone ready -> short countdown (so a second player can still jump in), then go.
  const joined = slots.filter(Boolean);
  const now = performance.now() / 1000;
  if (!joined.length || !joined.every((s) => s.ready)) startAt = null;
  else if (startAt === null) startAt = now + START_COUNTDOWN;
  else if (now >= startAt) { startAt = null; startGame(); }
}

function updatePlay() {
  // A controller vanished (e.g. Edge left "Use game controls"): hold everything until it's back
  // or another controller presses A to take that snake over.
  takeOver(players);
  if (players.some((p) => !input.state(p.device))) return false;

  if (players.some((p) => input.pressed(p.device, 'y') || input.pressed(p.device, 'menu'))) paused = !paused;
  if (input.back) paused = true; // browser Back (B in browsing mode) pauses instead of leaving
  if (paused) {
    if (players.some((p) => input.pressed(p.device, 'b') || input.pressed(p.device, 'view'))) toTitle();
    return false;
  }

  for (const p of players) {
    const s = p.snake;
    const st = input.state(p.device);
    if (s.alive) {
      if (!st) { s.wantBoost = false; continue; } // controller dropped: keep going straight
      if (st.analog) {
        if (st.stickX || st.stickY) s.targetAngle = Math.atan2(st.stickY, st.stickX);
      } else {
        s.targetAngle = s.angle + st.turn * 0.6;
      }
      s.wantBoost = st.boost;
    } else {
      const since = world.time - p.deadAt;
      if ((since > CONFIG.respawnDelay && input.pressed(p.device, 'a')) || since > CONFIG.autoRespawn) {
        const mass = Math.min(CONFIG.respawnMaxMass, Math.max(CONFIG.respawnMinMass, p.lastLength / 10 / 2));
        spawnPlayer(p, mass);
      }
    }
  }
  return true;
}

function handleEvents() {
  for (const { victim, killer } of world.events) {
    const vp = players.find((p) => p.snake === victim);
    const kp = killer && players.find((p) => p.snake === killer);
    if (vp) {
      vp.deadAt = world.time;
      vp.lastLength = lengthOf(victim);
      input.rumble(vp.device, 450, 1, 0.6);
    }
    if (kp && kp !== vp) input.rumble(kp.device, 150, 0.2, 0.7);
    const name = (s) => (s.player !== null ? `P${s.player + 1}` : s.name);
    if (vp && !killer) feed.push({ text: `${name(victim)} bonked the wall`, time: world.time });
    else if (vp || kp) feed.push({ text: `${name(killer)} popped ${name(victim)}!`, time: world.time });
  }
  world.events.length = 0;
  feed = feed.filter((f) => world.time - f.time < 4).slice(-3);

  for (const p of players) {
    if (p.snake.alive) p.best = Math.max(p.best, lengthOf(p.snake));
    if (mode !== 'coop' && p.best > save.best) save.best = p.best;
  }
  if (mode === 'coop') save.teamBest = Math.max(save.teamBest, teamScore());
}

const teamScore = () => players.reduce((sum, p) => sum + (p.snake.alive ? lengthOf(p.snake) : 0), 0);

// ---- Cameras

function viewFor(p) {
  if (players.length < 2) return { x: 0, y: 0, w: W, h: H };
  return { x: players.indexOf(p) * (W / 2), y: 0, w: W / 2, h: H };
}

function targetZoom(s, view) {
  return Math.sqrt(view.w * view.h) / (1000 * Math.pow(s.radius / 14, 0.6));
}

function updateCam(cam, s, view, dt) {
  const kp = 1 - Math.exp(-dt * 8), kz = 1 - Math.exp(-dt * 2);
  if (s.alive) {
    cam.x += (s.headX - cam.x) * kp;
    cam.y += (s.headY - cam.y) * kp;
    cam.zoom += (targetZoom(s, view) - cam.zoom) * kz;
  } else {
    cam.zoom += (targetZoom(s, view) * 0.85 - cam.zoom) * kz * 0.5;
  }
}

// ---- Render

function render(dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#07090e';
  ctx.fillRect(0, 0, W, H);
  const u = Math.min(W / 1920, H / 1080);

  if (screen === 'title') {
    if (!titleFollow?.alive) titleFollow = [...world.snakes].sort((a, b) => b.mass - a.mass)[0];
    if (titleFollow) {
      const k = 1 - Math.exp(-dt * 3);
      titleCam.x += (titleFollow.headX - titleCam.x) * k;
      titleCam.y += (titleFollow.headY - titleCam.y) * k;
    }
    titleCam.zoom = Math.sqrt(W * H) / 1500;
    drawWorld(ctx, world, { x: 0, y: 0, w: W, h: H }, titleCam);
    drawTitle(ctx, W, H, {
      t: performance.now() / 1000, slots, looks: save.looks, mode: save.mode, difficulty: save.difficulty,
      save, padCount: input.padCount(), deviceLabel: (id) => input.label(id),
      countdown: startAt === null ? null : Math.max(0, startAt - performance.now() / 1000),
      needHelp: input.browsingMode() || slots.some((sl) => sl && !input.state(sl.device))
        || (input.padCount() === 0 && !slots.some(Boolean)),
    });
    return;
  }

  const labels = new Map(players.map((p) => [p.snake, { text: `P${p.index + 1}`, color: p.labelColor }]));
  const g = { world, players, mode, feed, u, respawnDelay: CONFIG.respawnDelay, lost: (p) => !input.state(p.device) };
  for (const p of players) {
    const view = viewFor(p);
    if (!paused) updateCam(p.cam, p.snake, view, dt);
    drawWorld(ctx, world, view, p.cam, labels);
    drawHud(ctx, view, p, g);
  }
  if (players.length === 2) {
    ctx.fillStyle = '#000';
    ctx.fillRect(W / 2 - 3 * u, 0, 6 * u, H);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(W / 2 - 1, 0, 2, H);
  }
  if (mode === 'coop') drawTeamScore(ctx, W, u, teamScore(), save.teamBest);
  if (paused) drawPause(ctx, W, H);
}

// ---- Loop

let last = performance.now();
let saveTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  input.poll();

  let simulate = true;
  if (screen === 'title') updateTitle();
  else simulate = updatePlay();

  if (simulate) {
    const steps = Math.ceil(dt / (1 / 60));
    for (let i = 0; i < steps; i++) world.update(dt / steps);
    if (screen === 'play') handleEvents();
  }

  saveTimer += dt;
  if (saveTimer > 5 && screen === 'play') { saveTimer = 0; persist(); }

  render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for debugging from the console.
window.snakes = { get world() { return world; }, get players() { return players; }, slots, save };
