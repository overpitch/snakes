// Devices: Xbox controllers ('pad0'..'pad3') plus two keyboard halves ('kb1', 'kb2')
// as a fallback for testing on a computer.

// Edge on Xbox treats the controller as a mouse cursor unless the page opts out.
try { navigator.gamepadInputEmulation = 'gamepad'; } catch { /* not Xbox */ }

const keys = new Set();
const tapped = new Set(); // keys pressed since the last poll, so quick taps aren't missed
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', 'Tab']);
addEventListener('keydown', (e) => { keys.add(e.code); tapped.add(e.code); if (BLOCK.has(e.code)) e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const KEYMAP = {
  kb1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['Space'], b: ['KeyQ'],
    x: ['Digit1'], y: ['Digit2'], menu: ['Escape'], view: [], boost: ['Space', 'ShiftLeft'] },
  kb2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], a: ['Enter'], b: ['Backspace'],
    x: ['Digit9'], y: ['Digit0'], menu: ['Escape'], view: [], boost: ['Enter', 'ShiftRight'] },
};

const STICK_DEAD = 0.3;
const STICK_MENU = 0.6;

export class Input {
  constructor() {
    this.cur = new Map();
    this.prev = new Map();
  }

  poll() {
    this.prev = this.cur;
    this.cur = new Map();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
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
    for (const [id, map] of Object.entries(KEYMAP)) {
      const k = (name) => map[name].some((c) => keys.has(c) || tapped.has(c));
      this.cur.set(id, {
        analog: false, stickX: 0, stickY: 0, turn: k('right') - k('left'),
        a: k('a'), b: k('b'), x: k('x'), y: k('y'), view: k('view'), menu: k('menu'), boost: k('boost'),
        left: k('left'), right: k('right'), up: k('up'), down: k('down'),
      });
    }
    tapped.clear();
  }

  ids() { return [...this.cur.keys()]; }
  state(id) { return this.cur.get(id); }
  pressed(id, button) { return !!this.cur.get(id)?.[button] && !this.prev.get(id)?.[button]; }

  label(id) {
    if (id === 'kb1') return 'Keyboard (WASD)';
    if (id === 'kb2') return 'Keyboard (arrows)';
    return 'Controller ' + (Number(id.slice(3)) + 1);
  }

  padCount() { return this.ids().filter((id) => id.startsWith('pad')).length; }

  rumble(id, ms, strong = 0.6, weak = 0.6) {
    if (!id.startsWith('pad')) return;
    const pad = navigator.getGamepads?.()[Number(id.slice(3))];
    try {
      pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => {});
    } catch { /* no rumble support */ }
  }
}
