# Snakes 🐍

A slither.io-style game for two players on one TV: split-screen, Xbox controllers,
made to play in Microsoft Edge on an Xbox. See [DESIGN.md](DESIGN.md).

## Play

Game address: https://overpitch.github.io/snakes/ (use it in Edge on the Xbox).

**First, switch Edge to game controls.** Edge starts pages in "browsing controls" (the stick
moves a mouse pointer and the game can't see the controller). Hold **☰ (Menu)** until a menu
pops up, pick **Use game controls**, and press **A**. Holding ☰ again switches back.

1. Each player presses **A** to join and picks a look (stick ↕ chooses the row, ↔ changes it)
2. **X** switches Versus / Co-op, **Y** switches Easy / Normal / Hard (only one player joined = Solo, full screen)
3. Press **A** again when ready; the game starts 3 seconds after everyone's ready

In game: **left stick** steers, **A** or **RT** boosts, **Y** pauses.
(The game avoids ☰ and View because Edge on Xbox keeps those buttons for itself.)

## Run locally

```bash
python3 serve.py
```

Then open http://localhost:8080. No controller? Keyboard works for testing:
P1 = A/D steer, Space boost & join · P2 = ←/→ steer, Enter boost & join · Esc = pause.

## Xbox simulator

`xbox.html` (https://overpitch.github.io/snakes/xbox.html) runs the game on a pretend 1920×1080 TV
with two virtual Xbox controllers, behaving like Edge on Xbox: it starts in browsing controls
(stick = pointer, B = browser Back, no controllers visible to the game), holding ☰ opens Edge's
menu with "Use game controls", controllers only appear after a button press, and Edge keeps ☰
and View for itself. Controller 1 = WASD + F/G/R/T (A/B/X/Y), E = RT, hold 1 = ☰.
Controller 2 = arrows + L/;/O/P, K = RT, hold 9 = ☰. Scriptable via `window.xbox` for tests.

## Code

Plain JavaScript modules, no build step.

- `src/config.js` — tunables, difficulties, customization options
- `src/snake.js` — snake movement (body follows the head's exact trail)
- `src/world.js` — arena, food, collisions, spawning
- `src/ai.js` — bot brains
- `src/input.js` — Xbox controllers + keyboard
- `src/render.js` — drawing the world (sprites, faces, hats)
- `src/ui.js` — title screen, HUD, pause
- `src/main.js` — game loop and screens
