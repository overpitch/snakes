// Devices the game understands. Every way Edge on Xbox might hand us the controller is covered:
//   'pad0'..'pad3'  Gamepad API (Edge in "Use game controls" mode, or a PC with controllers)
//   'xkeys'         controller buttons arriving as "GamepadA"-style key events
//   'kb1', 'kb2'    two keyboard halves, for testing on a computer
// The game needs Edge's "Use game controls" mode; in browsing mode the stick moves a pointer,
// which we only watch for so we can tell the player how to switch.

// Legacy Edge on Xbox: opt the page out of mouse emulation where that switch exists.
try { navigator.gamepadInputEmulation = 'gamepad'; } catch { /* not supported */ }

// ---- Keyboard (and controller-buttons-as-keys)

const keys = new Set();
const tapped = new Set(); // pressed since the last poll, so quick taps aren't missed
let xkeysSeen = false;
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', 'Tab']);

function keyName(e) {
  if (e.key && e.key.startsWith('Gamepad')) { xkeysSeen = true; return e.key; }
  return e.code;
}
addEventListener('keydown', (e) => {
  const k = keyName(e);
  keys.add(k);
  tapped.add(k);
  if (BLOCK.has(k) || k.startsWith('Gamepad')) e.preventDefault();
  armBackTrap();
});
addEventListener('keyup', (e) => keys.delete(keyName(e)));
addEventListener('blur', () => keys.clear());

const KEYMAP = {
  kb1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['Space'], b: ['KeyQ'],
    x: ['Digit1'], y: ['Digit2'], menu: ['Escape'], view: [], boost: ['Space', 'ShiftLeft'] },
  kb2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], a: ['Enter'], b: ['Backspace'],
    x: ['Digit9'], y: ['Digit0'], menu: ['Escape'], view: [], boost: ['Enter', 'ShiftRight'] },
  xkeys: {
    left: ['GamepadDPadLeft', 'GamepadLeftThumbstickLeft'], right: ['GamepadDPadRight', 'GamepadLeftThumbstickRight'],
    up: ['GamepadDPadUp', 'GamepadLeftThumbstickUp'], down: ['GamepadDPadDown', 'GamepadLeftThumbstickDown'],
    a: ['GamepadA'], b: ['GamepadB'], x: ['GamepadX'], y: ['GamepadY'], menu: ['GamepadMenu'], view: ['GamepadView'],
    boost: ['GamepadA', 'GamepadRightTrigger', 'GamepadRightShoulder'],
  },
};

// ---- Pointer: if it's moving, Edge is probably in browsing mode (stick = pointer).

let pointerAt = -1e9;
addEventListener('pointermove', () => { pointerAt = performance.now(); });
addEventListener('pointerdown', () => { pointerAt = performance.now(); armBackTrap(); });
addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Back button trap
// If Edge slips back into browsing mode, B is the browser's Back button. Keep a spare history
// entry so Back lands on this page (the game pauses) instead of leaving the game. Browsers only
// honor entries added after a user gesture, so re-arm on every press.

let trapArmed = false;
let backPresses = 0;
function armBackTrap() {
  if (trapArmed) return;
  try { history.pushState({ snakes: Date.now() }, ''); trapArmed = true; } catch { /* ignore */ }
}
addEventListener('popstate', () => {
  backPresses++;
  trapArmed = false;
  armBackTrap();
  trapArmed = false; // that push may not count without a gesture; push again on the next press
});

// ---- Polling

const STICK_DEAD = 0.3;
const STICK_MENU = 0.6;

export class Input {
  constructor() {
    this.cur = new Map();
    this.prev = new Map();
    this.back = false;  // browser Back (= B in browsing mode) this frame
  }

  poll() {
    this.prev = this.cur;
    this.cur = new Map();

    let pads = [];
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { /* blocked */ }
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const btn = (i) => !!p.buttons[i]?.pressed;
      const val = (i) => p.buttons[i]?.value ?? 0;
      let sx = p.axes[0] ?? 0, sy = p.axes[1] ?? 0;
      const dx = btn(15) - btn(14), dy = btn(13) - btn(12);
      if (dx || dy) { sx = dx; sy = dy; }
      if (Math.hypot(sx, sy) < STICK_DEAD) { sx = 0; sy = 0; }
      this.cur.set('pad' + p.index, {
        analog: true, stickX: sx, stickY: sy, turn: 0,
        a: btn(0), b: btn(1), x: btn(2), y: btn(3), view: btn(8), menu: btn(9),
        boost: btn(0) || btn(5) || val(7) > 0.3,
        left: sx < -STICK_MENU, right: sx > STICK_MENU, up: sy < -STICK_MENU, down: sy > STICK_MENU,
      });
    }
    const havePads = this.cur.size > 0;

    for (const [id, map] of Object.entries(KEYMAP)) {
      // Controller-buttons-as-keys only when the Gamepad API isn't already giving us the pads
      // (otherwise one press would count as two players).
      if (id === 'xkeys' && (!xkeysSeen || havePads)) continue;
      const k = (name) => map[name].some((c) => keys.has(c) || tapped.has(c));
      const sx = k('right') - k('left'), sy = k('down') - k('up');
      this.cur.set(id, {
        analog: id === 'xkeys', stickX: id === 'xkeys' ? sx : 0, stickY: id === 'xkeys' ? sy : 0, turn: sx,
        a: k('a'), b: k('b'), x: k('x'), y: k('y'), view: k('view'), menu: k('menu'), boost: k('boost'),
        left: k('left'), right: k('right'), up: k('up'), down: k('down'),
      });
    }
    tapped.clear();

    this.back = backPresses > 0;
    backPresses = 0;
  }

  /** Pointer moved recently: Edge is likely in browsing mode. */
  browsingMode() { return performance.now() - pointerAt < 4000 && this.padCount() === 0; }

  ids() { return [...this.cur.keys()]; }
  state(id) { return this.cur.get(id); }
  pressed(id, button) { return !!this.cur.get(id)?.[button] && !this.prev.get(id)?.[button]; }

  label(id) {
    if (id === 'kb1') return 'Keyboard (WASD)';
    if (id === 'kb2') return 'Keyboard (arrows)';
    if (id === 'xkeys') return 'Controller';
    return 'Controller ' + (Number(id.slice(3)) + 1);
  }

  padCount() { return this.ids().filter((id) => id.startsWith('pad') || id === 'xkeys').length; }

  rumble(id, ms, strong = 0.6, weak = 0.6) {
    if (!id.startsWith('pad')) return;
    try {
      const pad = navigator.getGamepads?.()[Number(id.slice(3))];
      pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => {});
    } catch { /* no rumble support */ }
  }
}
