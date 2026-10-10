import { HATS } from './config.js';
import { wrapAngle } from './snake.js';

// ---- Color helpers

function parseHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex, toward, t) {
  const a = parseHex(hex), b = toward === 'white' ? [255, 255, 255] : [0, 0, 0];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
function rgba(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function hslHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---- Sprite caches (pre-rendered so we draw thousands of segments with drawImage)

const SPR = 64;
const bodyCache = new Map();
const glowCache = new Map();
const emojiCache = new Map();

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** A shiny ball: light top-left, darker rim. */
function bodySprite(hex) {
  let c = bodyCache.get(hex);
  if (c) return c;
  c = makeCanvas(SPR);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(SPR * 0.4, SPR * 0.36, 1, SPR / 2, SPR / 2, SPR / 2);
  grad.addColorStop(0, mix(hex, 'white', 0.55));
  grad.addColorStop(0.45, hex);
  grad.addColorStop(0.85, mix(hex, 'black', 0.35));
  grad.addColorStop(1, mix(hex, 'black', 0.65));
  g.fillStyle = grad;
  g.beginPath(); g.arc(SPR / 2, SPR / 2, SPR / 2, 0, Math.PI * 2); g.fill();
  bodyCache.set(hex, c);
  return c;
}

function glowSprite(hex) {
  let c = glowCache.get(hex);
  if (c) return c;
  c = makeCanvas(SPR);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, rgba(hex, 1));
  grad.addColorStop(0.4, rgba(hex, 0.35));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, SPR, SPR);
  glowCache.set(hex, c);
  return c;
}

function emojiSprite(ch) {
  let c = emojiCache.get(ch);
  if (c) return c;
  c = makeCanvas(128);
  const g = c.getContext('2d');
  g.font = '100px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 64, 70);
  emojiCache.set(ch, c);
  return c;
}

const RAINBOW = Array.from({ length: 12 }, (_, i) => hslHex(i * 30, 1, 0.6));

let hexTile = null;
function hexPattern(ctx) {
  if (!hexTile) {
    // Pointy-top hexes; tile repeats every 2 rows. Width rounded so the pattern tiles cleanly.
    const s = 40, W = 70, H = 120;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = '#0b0e15';
    g.fillRect(0, 0, W, H);
    for (let row = -1; row <= 2; row++) {
      for (let col = -1; col <= 1; col++) {
        const cx = col * W + (row & 1 ? W / 2 : 0), cy = row * s * 1.5;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          g.lineTo(cx + Math.cos(a) * (s - 3) * (W / (Math.sqrt(3) * s)), cy + Math.sin(a) * (s - 3));
        }
        g.closePath();
        const grad = g.createRadialGradient(cx, cy - 8, 2, cx, cy, s);
        grad.addColorStop(0, '#171c28');
        grad.addColorStop(1, '#10141d');
        g.fillStyle = grad;
        g.fill();
      }
    }
    hexTile = c;
  }
  return ctx.createPattern(hexTile, 'repeat');
}

// ---- World

/**
 * Draw the world into the screen rect `view` ({x,y,w,h} in CSS px) from camera `cam` ({x,y,zoom}).
 * `labels`: map of snake -> {text, color} for name tags.
 */
export function drawWorld(ctx, world, view, cam, labels) {
  const { x, y, w, h } = view;
  const z = cam.zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);
  const vb = { l: cam.x - w / 2 / z, r: cam.x + w / 2 / z, t: cam.y - h / 2 / z, b: cam.y + h / 2 / z };
  const t = world.time;

  // Floor.
  ctx.fillStyle = hexPattern(ctx);
  ctx.fillRect(vb.l, vb.t, vb.r - vb.l, vb.b - vb.t);

  // Outside the arena: red tint, glowing border.
  const R = world.R;
  ctx.beginPath();
  ctx.rect(vb.l - 10, vb.t - 10, vb.r - vb.l + 20, vb.b - vb.t + 20);
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(110, 0, 30, 0.55)';
  ctx.fill('evenodd');
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 60, 90, 0.25)';
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.strokeStyle = '#ff3c5a';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Food.
  ctx.globalCompositeOperation = 'lighter';
  for (const f of world.food) {
    if (f.x < vb.l - 20 || f.x > vb.r + 20 || f.y < vb.t - 20 || f.y > vb.b + 20) continue;
    const size = f.r * 4 * (1 + 0.15 * Math.sin(t * 3 + f.phase));
    ctx.drawImage(glowSprite(f.color), f.x - size / 2, f.y - size / 2, size, size);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Snakes: bots first, players on top.
  for (const s of world.snakes) if (s.player === null) drawSnake(ctx, s, vb, t);
  for (const s of world.snakes) if (s.player !== null) drawSnake(ctx, s, vb, t);

  // Pop sparkles.
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.particles) {
    const k = 1 - p.life / p.max;
    const size = p.size * (0.6 + k);
    ctx.globalAlpha = k;
    ctx.drawImage(glowSprite(p.color), p.x - size, p.y - size, size * 2, size * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Name tags.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of world.snakes) {
    const hx = s.headX, hy = s.headY;
    if (hx < vb.l - 100 || hx > vb.r + 100 || hy < vb.t - 100 || hy > vb.b + 100) continue;
    const tag = labels?.get(s);
    const fs = tag ? 22 : 15;
    ctx.font = `800 ${fs}px system-ui, "Segoe UI", sans-serif`;
    const ty = hy + s.radius + 22;
    if (tag) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(tag.text, hx, ty);
      ctx.fillStyle = tag.color;
    } else {
      ctx.fillStyle = 'rgba(220,228,240,0.55)';
    }
    ctx.fillText(tag ? tag.text : s.name, hx, ty);
  }

  ctx.restore();
}

export function drawSnake(ctx, s, vb, t) {
  const bb = s.bbox;
  if (bb.r < vb.l || bb.l > vb.r || bb.b < vb.t || bb.t > vb.b) return;
  const r = s.radius, n = s.segCount, segs = s.segs, skin = s.skin;

  if (s.boosting) {
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite(skin.glow);
    for (let i = 0; i < n; i += 2) {
      const size = r * (4 + Math.sin(t * 20 + i) * 0.6);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(g, segs[2 * i] - size / 2, segs[2 * i + 1] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  const cols = skin.colors.map(bodySprite);
  const spot = bodySprite(skin.colors[1] ?? '#ffffff');
  const shift = (t * 14) | 0;
  for (let i = n - 1; i >= 0; i--) {
    const x = segs[2 * i], y = segs[2 * i + 1];
    if (x < vb.l - r || x > vb.r + r || y < vb.t - r || y > vb.b + r) continue;
    const rr = i > n - 8 ? r * (0.55 + (0.45 * (n - 1 - i)) / 7) : r; // tapered tail
    let spr;
    switch (skin.pattern) {
      case 'stripes': spr = cols[((i / 3) | 0) % cols.length]; break;
      case 'rainbow': spr = bodySprite(RAINBOW[(((i + shift) / 2) | 0) % 12]); break;
      default: spr = cols[0];
    }
    ctx.drawImage(spr, x - rr, y - rr, rr * 2, rr * 2);
    if (skin.pattern === 'spots' && i % 5 === 2) {
      const sr = rr * 0.42;
      ctx.drawImage(spot, x - sr, y - sr, sr * 2, sr * 2);
    }
  }

  drawFace(ctx, s, t);
  drawHat(ctx, s, t);

  if (s.shieldUntil > t) {
    const left = s.shieldUntil - t;
    if (left > 0.8 || Math.sin(t * 30) > 0) { // blink as it runs out
      ctx.beginPath();
      ctx.arc(s.headX, s.headY, r * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160, 230, 255, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 245, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function eye(ctx, x, y, er, px, py) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(x + px, y + py, er * 0.55, 0, Math.PI * 2); ctx.fill();
}

/** Face in head-local coordinates: +x is forward. */
function drawFace(ctx, s, t) {
  const r = s.radius;
  ctx.save();
  ctx.translate(s.headX, s.headY);
  ctx.rotate(s.angle);
  const ex = r * 0.3, ey = r * 0.45, er = r * 0.36;
  const look = Math.max(-0.9, Math.min(0.9, wrapAngle(s.targetAngle - s.angle)));
  const lx = Math.cos(look) * er * 0.35, ly = Math.sin(look) * er * 0.35;

  switch (s.skin.face) {
    case 'happy': {
      // Tongue flicks out now and then.
      const flick = Math.max(0, Math.sin(t * 2.2 + s.id));
      if (flick > 0.6) {
        const len = r * 0.9 * (flick - 0.6) / 0.4;
        ctx.strokeStyle = '#ff3b6b';
        ctx.lineWidth = r * 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * 0.8 + len, 0);
        ctx.lineTo(r * 0.8 + len + r * 0.2, -r * 0.15);
        ctx.moveTo(r * 0.8 + len, 0); ctx.lineTo(r * 0.8 + len + r * 0.2, r * 0.15);
        ctx.stroke();
      }
      eye(ctx, ex, -ey, er, lx, ly);
      eye(ctx, ex, ey, er, lx, ly);
      ctx.fillStyle = 'rgba(255,120,160,0.45)';
      ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.72, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.05, r * 0.72, r * 0.16, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'googly': {
      const ger = er * 1.25;
      for (const sy of [-1, 1]) {
        const jx = Math.cos(t * 9 + s.id + sy) * ger * 0.3, jy = Math.sin(t * 7.3 + s.id * 2 + sy) * ger * 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex, sy * ey, ger, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = r * 0.06; ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(ex + jx, sy * ey + jy, ger * 0.45, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'grumpy': {
      eye(ctx, ex, -ey, er, lx, ly);
      eye(ctx, ex, ey, er, lx, ly);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = r * 0.16;
      ctx.lineCap = 'round';
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(ex - er * 0.9, sy * (ey + er * 0.9));
        ctx.lineTo(ex + er * 1.1, sy * (ey - er * 0.2));
        ctx.stroke();
      }
      break;
    }
    case 'sleepy': {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = r * 0.12;
      ctx.lineCap = 'round';
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ex - er * 0.3, sy * ey, er * 0.75, -Math.PI / 2.6, Math.PI / 2.6);
        ctx.stroke();
      }
      break;
    }
    case 'cool': {
      ctx.fillStyle = '#0d0d12';
      for (const sy of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(ex + er * 0.1, sy * ey, er * 1.05, er * 1.25, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#0d0d12';
      ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.moveTo(ex + er * 0.3, -ey); ctx.lineTo(ex + er * 0.3, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = r * 0.07;
      for (const sy of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(ex + er * 0.6, sy * ey - er * 0.5); ctx.lineTo(ex + er * 0.2, sy * ey - er * 0.1); ctx.stroke();
      }
      break;
    }
    default: // classic
      eye(ctx, ex, -ey, er * 0.9, lx, ly);
      eye(ctx, ex, ey, er * 0.9, lx, ly);
  }
  ctx.restore();
}

/** Hats stay upright on screen, like a sticker on the head. */
function drawHat(ctx, s, t) {
  const hat = HATS.find((h) => h.id === s.skin.hat);
  if (!hat || hat.id === 'none') return;
  const r = s.radius, x = s.headX, y = s.headY - r * 0.55;
  if (hat.emoji) {
    const size = r * 2.1;
    const bob = Math.sin(t * 4 + s.id) * r * 0.05;
    ctx.drawImage(emojiSprite(hat.emoji), x - size / 2, y - size * 0.7 + bob, size, size);
    return;
  }
  // Party hat: striped cone with a pompom.
  const w = r * 1.2, h = r * 1.6, by = y + r * 0.1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w / 2, by); ctx.lineTo(x + w / 2, by); ctx.lineTo(x, by - h); ctx.closePath();
  ctx.fillStyle = '#ff4fd8';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = r * 0.22;
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath(); ctx.moveTo(x - w, by - (h * k) / 4 + r * 0.3); ctx.lineTo(x + w, by - (h * k) / 4 - r * 0.3); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, by - h, r * 0.24, 0, Math.PI * 2); ctx.fill();
}

// ---- Minimap

/** Arena overview: just the players, so you can find each other. */
export function drawMinimap(ctx, cx, cy, rad, world, players, me) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(5, 8, 14, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 60, 90, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const p of players) {
    const s = p.snake;
    if (!s?.alive) continue;
    const px = cx + (s.headX / world.R) * rad, py = cy + (s.headY / world.R) * rad;
    const big = p === me;
    ctx.beginPath();
    ctx.arc(px, py, big ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = p.labelColor;
    ctx.fill();
    if (big) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.restore();
}

/** For the title-screen picker: a snake-like object wiggling in place. */
export function previewSnake(skin, t, cx, cy, len, r) {
  const n = 22, segs = [];
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * len;
    segs.push(cx + len / 2 - d, cy + Math.sin(t * 4 - i * 0.45) * r * 0.9);
  }
  const angle = Math.atan2(segs[1] - segs[3], segs[0] - segs[2]);
  return {
    id: 7, skin, segs, segCount: n, radius: r, angle, targetAngle: angle,
    boosting: false, shieldUntil: 0,
    headX: segs[0], headY: segs[1],
    bbox: { l: -1e9, t: -1e9, r: 1e9, b: 1e9 },
  };
}
