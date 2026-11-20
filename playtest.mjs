// Interactive gameplay test for VICE HEAT.
// Drives, exits, steals, shoots, and forces wanted escalation, checking
// state via window.__game after each step. Reports PASS/FAIL per step.
// Usage: NODE_PATH=... node playtest.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const entry = '/home/hatch/workspace/makefun/gta6-01-entry-v2';
const PORT = 8933;
const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: entry, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  — ' + detail : ''));
};
const state = () => page.evaluate(() => {
  const g = window.__game;
  if (!g) return null;
  return {
    state: g.state,
    inCar: g.player.inCar,
    x: +g.player.x.toFixed(1), z: +g.player.z.toFixed(1),
    speed: +g.player.speed.toFixed(1),
    heading: +g.player.heading.toFixed(2),
    health: g.player.health, armour: g.player.armour,
    wanted: g.police.wanted, heat: +g.police.heat.toFixed(1),
    cruisers: g.police.cruisers.length,
    heli: !!g.police.heli, tank: !!g.police.tank,
    roadblock: !!g.police.roadblock,
    mission: g.missions.missionIndex, stage: g.missions.stageIndex,
    money: g.money,
    weapon: g.arsenal.current().id, ammo: g.arsenal.currentAmmo(),
    traffic: g.traffic.cars.length, peds: g.traffic.peds.length,
    msg: g.message,
  };
});

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
check('game object exposed', !!(await state()), JSON.stringify(await state())?.slice(0, 120));

let s = await state();
check('starts in menu', s.state === 'menu', s.state);

// Start the game via the START ENGINE button.
await page.click('#playBtn');
await page.waitForTimeout(800);
s = await state();
check('START ENGINE -> playing', s.state === 'playing', s.state);
check('player in car at start', s.inCar, `inCar=${s.inCar}`);
check('traffic present', s.traffic >= 10, `${s.traffic} cars`);
check('pedestrians present', s.peds >= 10, `${s.peds} peds`);

// Drive forward with W for 6 seconds (headless swiftshader renders slowly,
// so the game simulates far less than 6s of game time — be lenient).
await page.keyboard.down('KeyW');
await page.waitForTimeout(6000);
await page.keyboard.up('KeyW');
s = await state();
check('driving moves the car', Math.abs(s.z - 30) > 1 || Math.abs(s.x - 30) > 1, `pos (${s.x}, ${s.z}) speed ${s.speed} km/h`);
check('speed reads on HUD', s.speed > 5, `${s.speed} km/h`);

// Steer: hold W + A for 1.5s and confirm heading changed.
const h0 = s.heading;
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyA');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyA');
await page.keyboard.up('KeyW');
s = await state();
check('steering changes heading', Math.abs(s.heading - h0) > 0.15, `heading ${h0} -> ${s.heading}`);

// Handbrake: build speed then Space.
await page.keyboard.down('KeyW');
await page.waitForTimeout(1500);
await page.keyboard.down('Space');
await page.waitForTimeout(1200);
await page.keyboard.up('Space');
await page.keyboard.up('KeyW');
s = await state();
check('handbrake slows the car', s.speed < 40, `speed after brake ${s.speed}`);

// Exit the car with E.
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
s = await state();
check('E exits the car', !s.inCar, `inCar=${s.inCar}`);
const onFoot = { x: s.x, z: s.z };

// Walk forward with W for 3s (headless is slow; the player moves a little).
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');
s = await state();
check('on-foot walking moves player', Math.hypot(s.x - onFoot.x, s.z - onFoot.z) > 1, `moved ${Math.hypot(s.x - onFoot.x, s.z - onFoot.z).toFixed(1)}m`);

// Shoot on foot: switch to pistol (2), hold the mouse down to fire
// (a quick click can fall between frames at headless frame rates).
await page.keyboard.press('Digit2');
await page.waitForTimeout(200);
const ammoBefore = (await state()).ammo;
await page.mouse.move(640, 400);
await page.mouse.down();
await page.waitForTimeout(900);
await page.mouse.up();
await page.waitForTimeout(300);
s = await state();
check('shooting consumes ammo', s.ammo.mag < ammoBefore.mag, `mag ${ammoBefore.mag} -> ${s.ammo.mag}`);

// Reload with R.
await page.keyboard.press('KeyR');
await page.waitForTimeout(1400);
s = await state();
check('reload refills mag', s.ammo.mag > 0, `mag ${s.ammo.mag}`);

// E re-enters the player's own car.
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
s = await state();
check('E re-enters own car', s.inCar, `inCar=${s.inCar}`);

// F carjacks a traffic car: exit, teleport next to a traffic car, press F.
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.evaluate(() => {
  const g = window.__game;
  const c = g.traffic.cars[0];
  g.player.x = c.x + 2; g.player.z = c.z;
  g.player.body.position.set(g.player.x, 0, g.player.z);
});
await page.keyboard.press('KeyF');
await page.waitForTimeout(600);
s = await state();
check('F carjacks nearest traffic car', s.inCar, `inCar=${s.inCar}`);

// Wanted escalation: drive into things / add heat via the police API is
// internal, so instead commit a "crime": ram a traffic car at speed.
// Simpler: use the debug-free path — shoot a pedestrian? Instead, verify the
// escalation logic directly through the game's own crime path: ram traffic.
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyW');
s = await state();
console.log('  after driving: wanted', s.wanted, 'heat', s.heat, 'cruisers', s.cruisers);

// Force heat through the game's public crime entry (same code path the
// collision/steal handlers use) to prove escalation + heli + tank spawn.
// The spawn timers are 8 simulated seconds; headless renders slowly, so
// fast-forward them to prove the escalation path fires.
await page.evaluate(() => window.__game.police.addHeat(100, 'playtest'));
await page.evaluate(() => { window.__game.police.spawnTimer = 0; window.__game.police.roadblockTimer = 0; });
await page.waitForTimeout(4000);
s = await state();
check('wanted reaches 5 stars', s.wanted === 5, `wanted=${s.wanted} heat=${s.heat}`);
check('helicopter spawns at 3+ stars', s.heli, `heli=${s.heli}`);
check('tank spawns at 5 stars', s.tank, `tank=${s.tank}`);
check('cruisers dispatched', s.cruisers >= 2, `${s.cruisers} cruisers`);
check('roadblock placed at 2+ stars', s.roadblock, `roadblock=${s.roadblock}`);

// Heat decay: wait out of sight (police far) — just confirm heat exists and
// the dispatch list is populated via HUD text.
const dispatch = await page.evaluate(() => document.getElementById('dispatchList').textContent);
check('dispatch list populated', /HALCON|BRAVO|LIMA/.test(dispatch), dispatch.slice(0, 80));

// Pause and resume.
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
s = await state();
check('P pauses', s.state === 'paused', s.state);
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
s = await state();
check('P resumes', s.state === 'playing', s.state);

// Minimap + HUD present.
const hudOk = await page.evaluate(() => {
  const ids = ['mission', 'stats', 'minimap', 'speedo', 'ticker', 'slots', 'dispatchList'];
  return ids.map((id) => [id, !!document.getElementById(id)]);
});
check('all HUD elements present', hudOk.every(([, v]) => v), hudOk.filter(([, v]) => !v).map(([k]) => k).join(',') || 'all present');

// Mission progress: teleport-free check — the mission marker exists.
const marker = await page.evaluate(() => !!window.__game.missions.marker);
check('mission marker exists', marker);

console.log('\n--- console/page errors during playtest:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  ', e));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
server.kill();
process.exit(failed.length || errors.length ? 1 : 0);
