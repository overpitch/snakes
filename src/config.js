// Tunables. World units are roughly "pixels at zoom 1".
export const CONFIG = {
  arenaRadius: 3200,
  foodTarget: 1400,   // natural pellets kept in the arena

  startMass: 20,      // bots' minimum size
  playerStartMass: 40,
  respawnMinMass: 60, // "head start": respawn at half your old size, at least this
  respawnMaxMass: 500,
  spawnShield: 2.5,   // seconds a fresh player can't be popped

  baseSpeed: 210,     // units / second
  boostSpeed: 440,
  boostDrain: 7,      // mass / second while boosting
  boostDropRatio: 0.7,// share of boost-drained mass left behind as pellets
  minBoostMass: 14,   // can't boost below this
  turnRate: 5.2,      // rad / second for a small snake; big snakes turn slower

  magnetRange: 70,    // extra reach (beyond head radius) that pulls pellets in
  magnetSpeed: 520,
  deathDropRatio: 0.8,// share of a dead snake's mass that becomes pellets

  respawnDelay: 0.8,  // seconds before A brings a popped player back
  autoRespawn: 2.2,   // ...or it happens by itself
  botRespawnDelay: 2.5,
};

export const DIFFICULTIES = ['easy', 'normal', 'hard'];
export const DIFFICULTY = {
  //        think: seconds between bot decisions; look: how far ahead they check for danger
  //        hunt: how keen they are to cut others off; speed: bot speed vs players
  easy:   { label: 'Easy',   icon: '🐢', bots: 12, think: 0.35, look: 0.6,  hunt: 0,   speed: 0.85, maxMass: 60 },
  normal: { label: 'Normal', icon: '🐍', bots: 14, think: 0.16, look: 1,    hunt: 0.7, speed: 1,    maxMass: 160 },
  hard:   { label: 'Hard',   icon: '🔥', bots: 16, think: 0.08, look: 1.25, hunt: 1.3, speed: 1,    maxMass: 320 },
};

export const MODES = ['versus', 'coop'];
export const MODE = {
  versus: { label: 'Versus', icon: '⚔️' },
  coop:   { label: 'Co-op',  icon: '🤝' },
};

// ---- Customization

export const PALETTES = [
  { label: 'Ocean',     colors: ['#2ee6ff', '#1b8cff'] },
  { label: 'Lava',      colors: ['#ffb12e', '#ff4d2e'] },
  { label: 'Lime',      colors: ['#c6ff3d', '#2fbf3a'] },
  { label: 'Bubblegum', colors: ['#ff7ad9', '#a24bff'] },
  { label: 'Sunshine',  colors: ['#fff04d', '#ffa31a'] },
  { label: 'Mint',      colors: ['#7dffd4', '#14b88a'] },
  { label: 'Cherry',    colors: ['#ff4d6d', '#ffffff'] },
  { label: 'Midnight',  colors: ['#8a7dff', '#2b2bd9'] },
];
export const PATTERNS = [
  { id: 'stripes', label: 'Stripes' },
  { id: 'spots',   label: 'Spots' },
  { id: 'solid',   label: 'Solid' },
  { id: 'rainbow', label: 'Rainbow' },
];
export const FACES = [
  { id: 'happy',  label: 'Happy' },
  { id: 'googly', label: 'Googly' },
  { id: 'grumpy', label: 'Grumpy' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'cool',   label: 'Cool' },
];
export const HATS = [
  { id: 'none',   label: 'No hat' },
  { id: 'crown',  label: 'Crown',   emoji: '👑' },
  { id: 'party',  label: 'Party' },
  { id: 'tophat', label: 'Top hat', emoji: '🎩' },
  { id: 'cap',    label: 'Cap',     emoji: '🧢' },
  { id: 'bow',    label: 'Bow',     emoji: '🎀' },
  { id: 'flower', label: 'Flower',  emoji: '🌻' },
];

export const DEFAULT_LOOKS = [
  { palette: 0, pattern: 0, face: 0, hat: 0 },
  { palette: 1, pattern: 0, face: 1, hat: 1 },
];

export const PLAYER_LABEL_COLORS = ['#2ee6ff', '#ffb12e'];

/** A skin is what the renderer needs: colors, pattern, face, hat. */
export function playerSkin(look) {
  const pal = PALETTES[look.palette];
  return {
    colors: pal.colors,
    pattern: PATTERNS[look.pattern].id,
    face: FACES[look.face].id,
    hat: HATS[look.hat].id,
    glow: pal.colors[0],
  };
}

const BOT_COLORS = [
  ['#7cff5a', '#2fbf3a'], ['#ff4fd8', '#a13bff'], ['#ffe14d', '#e0b400'],
  ['#ff4d6d', '#f2f2f2'], ['#9d7bff', '#5a3bff'], ['#3dffc5', '#0fa37f'],
  ['#ff8a3d', '#ffd23d', '#ff3d3d'], ['#d8d8d8', '#7a7a7a'],
  ['#5ad1ff', '#ffffff', '#ff5ad1'], ['#c6ff3d', '#3d8bff'], ['#ff6f91', '#ffc75f'],
];

export function botSkin() {
  const colors = BOT_COLORS[(Math.random() * BOT_COLORS.length) | 0];
  const hat = Math.random() < 0.15 ? HATS[1 + ((Math.random() * (HATS.length - 1)) | 0)].id : 'none';
  return { colors, pattern: Math.random() < 0.7 ? 'stripes' : 'solid', face: 'classic', hat, glow: colors[0] };
}

export const BOT_NAMES = [
  'Viper', 'Noodle', 'Slinky', 'Mamba', 'Wiggles', 'Copperhead', 'Sir Hiss',
  'Ramen', 'Zigzag', 'Kaa', 'Boomslang', 'Spaghetti', 'Taipan', 'Sidewinder',
  'Lasso', 'Udon', 'Python', 'Squiggle', 'Cobra', 'Fettuccine', 'Asp', 'Rattler',
];

export const FOOD_COLORS = [
  '#ff4d6d', '#ffb12e', '#ffe14d', '#7cff5a', '#3dffc5', '#2ee6ff',
  '#5a8bff', '#9d7bff', '#ff4fd8',
];
