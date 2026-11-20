// Screenshot driver for VICE HEAT: serves game/ on localhost, opens each
// ?shot= URL in headless Chromium, waits for window.__shotReady, saves JPEG.
// Usage: node shots.mjs [cover|city|wanted5|menu|all]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const entry = '/home/hatch/workspace/makefun/gta6-01-entry';
const gameDir = join(entry, 'game');
const shotsDir = join(entry, 'screenshots');
if (!existsSync(shotsDir)) mkdirSync(shotsDir, { recursive: true });
const PORT = 8932;
const SHOTS = [
  { name: '1-cover.jpg', query: '?shot=cover' },
  { name: '2-city.jpg', query: '?shot=city' },
  { name: '3-wanted5.jpg', query: '?shot=wanted5' },
  { name: '4-menu.jpg', query: '?shot=menu' },
];

const which = process.argv[2] ?? 'all';
const wanted = which === 'all' ? SHOTS : SHOTS.filter((s) => s.name.startsWith(which) || s.query.includes(`shot=${which}`));
if (wanted.length === 0) { console.log('unknown shot:', which); process.exit(1); }

const server = spawn('node', [join(entry, 'serve.ts'), '--port', String(PORT)], { cwd: entry, stdio: 'pipe' });
server.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
server.stderr.on('data', (d) => process.stdout.write('[server:err] ' + d));
await new Promise((resolve) => setTimeout(resolve, 1500));

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const requests = [];
page.on('request', (req) => { requests.push(req.url()); });
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.log('[console]', msg.type(), msg.text().slice(0, 300));
});
page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)));

for (const shot of wanted) {
  const url = `http://127.0.0.1:${PORT}/${shot.query}`;
  console.log('opening', url);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 25000 });
  } catch {
    console.log('TIMEOUT waiting for __shotReady on', shot.name);
    await page.screenshot({ path: join(shotsDir, shot.name.replace('.jpg', '-timeout.png')) });
    continue;
  }
  await page.waitForTimeout(400);
  const buffer = await page.screenshot({ type: 'jpeg', quality: 85 });
  writeFileSync(join(shotsDir, shot.name), buffer);
  console.log('saved', shot.name, buffer.length, 'bytes');
}

const external = requests.filter((u) => !u.startsWith('http://127.0.0.1') && !u.startsWith('data:'));
console.log('total requests:', requests.length, '| external (non-localhost):', external.length);
if (external.length > 0) console.log('EXTERNAL:', external.slice(0, 10));
await browser.close();
server.kill();
console.log('done');
