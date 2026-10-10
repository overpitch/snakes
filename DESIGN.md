# Snakes — Design Doc

A slither.io-style game for **two players on one TV**, split-screen, played in
**Microsoft Edge on an Xbox** with two Xbox controllers. Built for playing with
an **eight-year-old**, so it should be forgiving, readable from the couch, and
need very little reading.

*Decisions from the design interview, 2026-10-10.*

---

## Decided

| Area | Decision |
|---|---|
| Platform | Web page (plain HTML + JavaScript, no build step) opened in Edge on Xbox |
| Hosting | GitHub Pages: https://overpitch.github.io/snakes/ (push to `main` to update) |
| Input | Xbox controllers via the Gamepad API (keyboard only as a dev fallback) |
| Screen | Split-screen: left/right halves, each camera follows one snake. One player = full screen |
| Arena | Big circular arena with ~14 AI snakes, like slither.io |
| Modes | Chosen per game on the title screen: **Versus** or **Co-op** |
| Versus | Free-for-all: players can eat each other, just like the bots |
| Co-op | Players **pass through each other**; a **shared team score** (combined length) with a team record |
| Game end | **Endless**: play until you quit, chasing high scores / the team record |
| Bot difficulty | **Easy / Normal / Hard** picked on the title screen |
| Dying | **Respawn with a head start**: come back right away at a medium size, not tiny |
| Death style | Cute: the snake **pops** into glowing food. Nothing violent |
| Customization | Each player picks **colors & pattern**, a **face/eyes**, and a **hat/accessory** |
| Look | **Neon glow** like slither.io: dark hex grid, glowing pellets, shiny striped snakes |
| Menus | Big icons and buttons, very little reading; **title to playing in a couple of presses** |

## Controls (Xbox controller)

| Action | Button |
|---|---|
| Steer | Left stick (the snake heads where you point) or D-pad |
| Boost | **A** or **RT** (costs length, leaves a trail of food) |
| Join / confirm | **A** |
| Back / leave | **B** |
| Pause | **Menu (☰)** |

## Difficulty

| | Easy | Normal | Hard |
|---|---|---|---|
| Bot reactions | Slow, often miss danger | Decent | Sharp |
| Bots hunt players | Never | Sometimes | Often, and boost to cut you off |
| Bot speed | Slower than players | Same | Same |
| Bot sizes | Mostly small | Mixed | Some big ones |

## Customization

- **Colors & patterns:** preset combos; patterns are stripes, spots, rainbow and solid
- **Faces:** happy, angry, sleepy, googly, sunglasses
- **Hats:** none, crown, party hat, top hat, cap, bow, flower
- Chosen with the stick + A on a big visual picker; remembered between sessions

## Flow

1. **Title**: each player presses **A** to join, which opens their snake picker card
2. **Pick**: pick a mode (Versus / Co-op) and difficulty, then press **☰** to play
3. **Play**: endless; on death the snake pops and you're back in after ~1 second
4. **Pause** (☰): resume, or go back to the title

## Open questions

- Sound & music (not chosen for v1, easy to add later).
- Power-ups (not chosen for v1).
