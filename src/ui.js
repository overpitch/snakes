import { PALETTES, PATTERNS, FACES, HATS, MODE, MODES, DIFFICULTY, DIFFICULTIES, playerSkin, PLAYER_LABEL_COLORS } from './config.js';
import { drawSnake, drawMinimap, previewSnake } from './render.js';

const FONT = 'system-ui, "Segoe UI", -apple-system, sans-serif';

/** Rows of the snake picker card, in order. */
export const LOOK_ROWS = [
  { key: 'palette', icon: '🎨', list: PALETTES },
  { key: 'pattern', icon: '✨', list: PATTERNS },
  { key: 'face',    icon: '😀', list: FACES },
  { key: 'hat',     icon: '🎩', list: HATS },
];

export const fmt = (n) => Math.floor(n).toLocaleString('en-US');
export const lengthOf = (s) => s.mass * 10;

// ---- Drawing helpers

export function text(ctx, str, x, y, size, color, { align = 'center', weight = 800, stroke = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

const BTN_COLORS = { A: '#3fbf3f', B: '#e04848', X: '#3a7be0', Y: '#f0c020', menu: '#5a6170', view: '#5a6170' };

/** An Xbox face-button glyph. */
export function button(ctx, label, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = BTN_COLORS[label];
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.stroke();
  if (label === 'menu') {
    ctx.fillStyle = '#fff';
    for (let k = -1; k <= 1; k++) ctx.fillRect(x - r * 0.45, y + k * r * 0.32 - r * 0.07, r * 0.9, r * 0.14);
  } else if (label === 'view') {
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x - r * 0.4, y - r * 0.3, r * 0.5, r * 0.4);
    ctx.strokeRect(x - r * 0.1, y - r * 0.1, r * 0.5, r * 0.4);
  } else {
    text(ctx, label, x, y + r * 0.04, r * 1.2, label === 'Y' ? '#3a2a00' : '#fff', { weight: 900 });
  }
}

/** A line mixing text and button glyphs, centered on (cx, cy). parts: string | { btn } */
export function rich(ctx, parts, cx, cy, size, color) {
  ctx.font = `800 ${size}px ${FONT}`;
  const br = size * 0.62, gap = size * 0.25;
  const widths = parts.map((p) => (typeof p === 'string' ? ctx.measureText(p).width : br * 2 + gap * 2));
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  parts.forEach((p, i) => {
    if (typeof p === 'string') text(ctx, p, x, cy, size, color, { align: 'left' });
    else button(ctx, p.btn, x + gap + br, cy, br);
    x += widths[i];
  });
}

function panel(ctx, x, y, w, h, r, fill, border, lw = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

// ---- Title screen

export function drawTitle(ctx, W, H, st) {
  const u = Math.min(W / 1920, H / 1080);
  const t = st.t;

  ctx.fillStyle = 'rgba(5, 8, 14, 0.55)';
  ctx.fillRect(0, 0, W, H);

  // Wiggly title.
  const title = 'SNAKES';
  const fs = 150 * u;
  ctx.font = `900 ${fs}px ${FONT}`;
  const tw = ctx.measureText(title).width + fs * 0.08 * (title.length - 1);
  let x = W / 2 - tw / 2;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i];
    const cw = ctx.measureText(ch).width;
    const y = H * 0.12 + Math.sin(t * 3 - i * 0.7) * 14 * u;
    const col = i % 2 ? PLAYER_LABEL_COLORS[1] : PLAYER_LABEL_COLORS[0];
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 30 * u;
    text(ctx, ch, x + cw / 2, y, fs, col, { weight: 900 });
    ctx.restore();
    x += cw + fs * 0.08;
  }

  // Mode + difficulty pickers (any player: X and Y).
  const rowY = H * 0.255;
  pickerPill(ctx, W / 2 - 330 * u, rowY, u, 'X', MODES.map((m) => MODE[m]), MODES.indexOf(st.mode));
  pickerPill(ctx, W / 2 + 330 * u, rowY, u, 'Y', DIFFICULTIES.map((d) => DIFFICULTY[d]), DIFFICULTIES.indexOf(st.difficulty));

  // Player cards.
  const cw = 560 * u, ch = 560 * u, gap = 70 * u, cy = H * 0.33;
  for (let i = 0; i < 2; i++) {
    const cx = W / 2 + (i === 0 ? -gap / 2 - cw : gap / 2);
    drawCard(ctx, cx, cy, cw, ch, u, i, st);
  }

  // Bottom prompt.
  const anyJoined = st.slots.some(Boolean);
  const pulse = 1 + Math.sin(t * 5) * 0.04;
  if (anyJoined) rich(ctx, ['Press ', { btn: 'menu' }, ' to play!'], W / 2, H * 0.93, 54 * u * pulse, '#fff');
  else if (st.padCount === 0) text(ctx, 'Turn on a controller, then press any button', W / 2, H * 0.93, 38 * u, '#c9d1e0');
  else rich(ctx, ['Press ', { btn: 'A' }, ' to join'], W / 2, H * 0.93, 54 * u * pulse, '#fff');

  const rec = [];
  if (st.save.best) rec.push(`🏆 Best ${fmt(st.save.best)}`);
  if (st.save.teamBest) rec.push(`🤝 Team best ${fmt(st.save.teamBest)}`);
  if (rec.length) text(ctx, rec.join('     '), W / 2, H * 0.985, 24 * u, 'rgba(201,209,224,0.75)');
}

function pickerPill(ctx, cx, cy, u, btn, options, selected) {
  const ow = 190 * u, oh = 76 * u, pad = 10 * u;
  const w = options.length * ow + pad * 2 + 80 * u;
  const x = cx - w / 2;
  panel(ctx, x, cy - oh / 2 - pad, w, oh + pad * 2, (oh + pad * 2) / 2, 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.15)', 2);
  button(ctx, btn, x + pad + 34 * u, cy, 26 * u);
  options.forEach((o, i) => {
    const ox = x + pad + 80 * u + i * ow;
    if (i === selected) panel(ctx, ox, cy - oh / 2, ow - 6 * u, oh, oh / 2, 'rgba(255,255,255,0.92)');
    const col = i === selected ? '#0b0e15' : 'rgba(220,228,240,0.6)';
    text(ctx, o.icon, ox + 40 * u, cy + 2 * u, 36 * u, col);
    text(ctx, o.label, ox + 72 * u, cy, 28 * u, col, { align: 'left' });
  });
}

function drawCard(ctx, x, y, w, h, u, i, st) {
  const slot = st.slots[i];
  const color = PLAYER_LABEL_COLORS[i];
  panel(ctx, x, y, w, h, 28 * u, slot ? 'rgba(12,16,26,0.88)' : 'rgba(12,16,26,0.55)', slot ? color : 'rgba(255,255,255,0.15)', slot ? 4 * u : 2 * u);
  text(ctx, `P${i + 1}`, x + 40 * u, y + 50 * u, 56 * u, color, { align: 'left', weight: 900 });

  const look = st.looks[i];
  const skin = playerSkin(look);
  const pr = slot ? 30 * u : 24 * u;
  const snake = previewSnake(skin, st.t + i * 1.7, x + w / 2, y + 170 * u, w * 0.62, pr);
  if (!slot) ctx.globalAlpha = 0.35;
  drawSnake(ctx, snake, { l: -1e9, r: 1e9, t: -1e9, b: 1e9 }, st.t);
  ctx.globalAlpha = 1;

  if (!slot) {
    const pulse = 1 + Math.sin(st.t * 5 + i) * 0.05;
    rich(ctx, ['Press ', { btn: 'A' }], x + w / 2, y + 340 * u, 56 * u * pulse, '#fff');
    text(ctx, 'to join', x + w / 2, y + 410 * u, 40 * u, 'rgba(220,228,240,0.8)');
    return;
  }

  text(ctx, st.deviceLabel(slot.device), x + w - 32 * u, y + 50 * u, 22 * u, 'rgba(220,228,240,0.6)', { align: 'right', weight: 600 });

  const rowH = 64 * u, top = y + 262 * u;
  LOOK_ROWS.forEach((row, r) => {
    const ry = top + r * rowH;
    const active = slot.row === r;
    if (active) panel(ctx, x + 20 * u, ry - rowH / 2 + 4 * u, w - 40 * u, rowH - 8 * u, 16 * u, 'rgba(255,255,255,0.12)', color, 2 * u);
    text(ctx, row.icon, x + 62 * u, ry + 2 * u, 34 * u, '#fff');
    const item = row.list[look[row.key]];
    text(ctx, item.label, x + w / 2 + 20 * u, ry, 32 * u, active ? '#fff' : 'rgba(220,228,240,0.75)');
    if (active) {
      const nudge = Math.sin(st.t * 6) * 4 * u;
      text(ctx, '◀', x + 140 * u - nudge, ry, 30 * u, color);
      text(ctx, '▶', x + w - 60 * u + nudge, ry, 30 * u, color);
    }
  });
  rich(ctx, [{ btn: 'B' }, ' leave'], x + w / 2, y + h - 34 * u, 24 * u, 'rgba(220,228,240,0.6)');
}

// ---- In-game HUD

export function drawHud(ctx, view, p, g) {
  const { x, y, w, h } = view;
  const u = g.u;
  const m = Math.max(24 * u, h * 0.045); // keep clear of TV edges
  const s = p.snake;
  const world = g.world;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Bottom-left: who you are and how long you are.
  const len = s?.alive ? lengthOf(s) : p.lastLength;
  text(ctx, `P${p.index + 1}`, x + m, y + h - m - 74 * u, 34 * u, p.labelColor, { align: 'left', weight: 900, stroke: 6 * u });
  text(ctx, fmt(len), x + m, y + h - m - 26 * u, 62 * u, '#fff', { align: 'left', weight: 900, stroke: 8 * u });
  if (g.mode === 'versus') {
    text(ctx, `🏆 ${fmt(p.best)}`, x + m + 4 * u, y + h - m + 18 * u, 24 * u, 'rgba(220,228,240,0.8)', { align: 'left', weight: 700, stroke: 5 * u });
  }

  // Bottom-right: minimap.
  const mr = 78 * u;
  drawMinimap(ctx, x + w - m - mr, y + h - m - mr, mr, world, g.players, p);

  // Top-right: leaderboard (versus only; co-op shows the team score instead).
  if (g.mode === 'versus') drawLeaderboard(ctx, x + w - m, y + m, u, g);

  // Top-left: recent happenings.
  let fy = y + m + 16 * u;
  for (const f of g.feed) {
    const age = world.time - f.time;
    ctx.globalAlpha = Math.max(0, Math.min(1, 4 - age));
    text(ctx, f.text, x + m, fy, 26 * u, '#fff', { align: 'left', weight: 800, stroke: 6 * u });
    fy += 38 * u;
  }
  ctx.globalAlpha = 1;

  // Arrow toward your partner when they're off-screen.
  const partner = g.players.find((q) => q !== p);
  if (partner?.snake?.alive) drawPartnerArrow(ctx, view, p.cam, partner, u, m);

  // Popped!
  if (!s?.alive) {
    ctx.fillStyle = 'rgba(5,8,14,0.45)';
    ctx.fillRect(x, y, w, h);
    const k = Math.min(1, (world.time - p.deadAt) * 4);
    const bounce = 1 + Math.sin(k * Math.PI) * 0.25;
    text(ctx, '💥 POP!', x + w / 2, y + h * 0.42, 110 * u * bounce, '#fff', { weight: 900, stroke: 10 * u });
    if (world.time - p.deadAt > g.respawnDelay) {
      rich(ctx, [{ btn: 'A' }, ' Go again!'], x + w / 2, y + h * 0.56, 44 * u, '#fff');
    }
  }
  ctx.restore();
}

function drawLeaderboard(ctx, right, top, u, g) {
  const sorted = [...g.world.snakes].sort((a, b) => b.mass - a.mass);
  const rows = sorted.slice(0, 5);
  for (const pl of g.players) {
    if (pl.snake?.alive && !rows.includes(pl.snake)) rows.push(pl.snake);
  }
  const lw = 300 * u, lh = 36 * u;
  panel(ctx, right - lw, top, lw, rows.length * lh + 20 * u, 14 * u, 'rgba(5,8,14,0.5)');
  rows.forEach((s, i) => {
    const ry = top + 10 * u + lh / 2 + i * lh;
    const isP = s.player !== null;
    const col = isP ? PLAYER_LABEL_COLORS[s.player] : 'rgba(220,228,240,0.8)';
    const rank = sorted.indexOf(s) + 1;
    text(ctx, `${rank}`, right - lw + 30 * u, ry, 24 * u, col);
    text(ctx, isP ? `P${s.player + 1}` : s.name, right - lw + 58 * u, ry, 24 * u, col, { align: 'left', weight: isP ? 900 : 700 });
    text(ctx, fmt(lengthOf(s)), right - 16 * u, ry, 22 * u, col, { align: 'right', weight: 700 });
  });
}

function drawPartnerArrow(ctx, view, cam, partner, u, m) {
  const s = partner.snake;
  const z = cam.zoom;
  const sx = view.x + view.w / 2 + (s.headX - cam.x) * z;
  const sy = view.y + view.h / 2 + (s.headY - cam.y) * z;
  const inset = m + 30 * u;
  if (sx > view.x + inset && sx < view.x + view.w - inset && sy > view.y + inset && sy < view.y + view.h - inset) return;
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const hw = view.w / 2 - inset, hh = view.h / 2 - inset;
  const k = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
  const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(26 * u, 0); ctx.lineTo(-14 * u, -18 * u); ctx.lineTo(-14 * u, 18 * u); ctx.closePath();
  ctx.fillStyle = partner.labelColor;
  ctx.shadowColor = partner.labelColor;
  ctx.shadowBlur = 16 * u;
  ctx.fill();
  ctx.restore();
  text(ctx, `P${partner.index + 1}`, ax - Math.cos(a) * 44 * u, ay - Math.sin(a) * 44 * u, 24 * u, partner.labelColor, { weight: 900, stroke: 5 * u });
}

export function drawTeamScore(ctx, W, u, team, best) {
  const w = 420 * u, h = 96 * u, x = W / 2 - w / 2, y = 18 * u;
  panel(ctx, x, y, w, h, 20 * u, 'rgba(5,8,14,0.65)', 'rgba(255,255,255,0.2)', 2);
  text(ctx, `🤝 ${fmt(team)}`, W / 2, y + 38 * u, 46 * u, '#fff', { weight: 900 });
  const beat = team >= best && best > 0;
  text(ctx, beat ? '★ NEW TEAM RECORD! ★' : `Team best ${fmt(best)}`, W / 2, y + 76 * u, 20 * u, beat ? '#ffe14d' : 'rgba(220,228,240,0.7)');
}

export function drawPause(ctx, W, H) {
  const u = Math.min(W / 1920, H / 1080);
  ctx.fillStyle = 'rgba(5,8,14,0.7)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'Paused', W / 2, H * 0.4, 120 * u, '#fff', { weight: 900 });
  rich(ctx, [{ btn: 'menu' }, ' Keep playing'], W / 2, H * 0.55, 48 * u, '#fff');
  rich(ctx, [{ btn: 'B' }, ' Back to title'], W / 2, H * 0.64, 36 * u, 'rgba(220,228,240,0.8)');
}
