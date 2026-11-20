# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zairzuab/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zairzuab/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VICE HEAT — Solmar Pursuit** (v2 rebuild). An original open-world crime game that runs
offline in a desktop browser from static files. You are Dante Vega, getaway
driver for the Solmar crew: steal cars, outrun the Solmar PD through a
sun-soaked coastal city, and lose five stars of wanted level — cruisers,
a helicopter, roadblocks with spike strips, and a tank at the end of the line.
The v2 build rebuilds the 3D presentation from scratch: detailed procedural
building facades with balconies and striped shop awnings, lush palm-lined
avenues, eight distinct car models, and a big police helicopter overhead.

## What is in the game

- **A city to explore on foot and by car** — Solmar: a 7×7 grid of streets,
  buildings, palm-lined avenues, traffic lights, a pier with a turning Ferris
  wheel, a beach and the sea, a distant skyline.
- **Traffic and pedestrians** — cars cruise the streets, pedestrians walk the
  sidewalks and panic when things get loud.
- **Cars to steal and drive** — eight original models; press **F** near a
  traffic car to carjack it, **E** to enter and exit your car.
- **A wanted level with police who respond** — 1–5 stars. Cruisers chase,
  PIT-manoeuvre and box you in; at 2 stars roadblocks with spike strips
  appear; at 3 a helicopter circles overhead; at 5 a tank rolls in. Lose the
  heat by staying out of sight.
- **Missions and a story** — three missions (ARCO RUN, COURIER HEAT,
  FIVE-STAR HEAT) with stages, objectives and rewards; progress, money and
  rank save to localStorage.
- **Combat** — five weapons (fists, pistol, ZUMBADOR MP, ESCOPETA 12, FALCON
  rifle) with ammo and reload, drive-by shooting, health and armour pickups.
- **A full GTA-style HUD** — mission card, wanted stars, money, health and
  armour bars, weapon slots, police dispatch list, circular minimap with the
  street and district name, speedometer with car name and engine %, and a
  crew radio ticker.
- **Polish** — day sky with sun glare and drifting clouds, building windows,
  screen shake, damage flashes, wanted pulse, and synthesized WebAudio sound
  (engine, two-tone sirens, gunshots, radio music) — no audio files.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static server. No build step, no network requests.

## Controls

| Key | Action |
| --- | --- |
| W A S D | drive / walk |
| SPACE | handbrake |
| E | enter / exit car |
| F | steal nearest car |
| CLICK | shoot (drive-by in a car) |
| R | reload |
| 1–5 | switch weapon |
| P | pause |
| M | mute |
| C | camera distance |

## Tech

- Three.js (vendored under `game/vendor/`, ES module build) for real 3D.
- All art, names, story, sound and music are original — nothing from any
  commercial game.
- `main.ts` (Node 22, standard library only) copies `game/` and
  `screenshots/` to `/output` and writes `/output/dossier.json`.

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=3jbcqfgw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
