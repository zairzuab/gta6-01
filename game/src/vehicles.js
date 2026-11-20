// vehicles.js — procedural vehicle / pedestrian / pickup meshes for the
// Solmar GTA-style game. Everything is built from primitives + canvas
// textures; no network requests, no external assets.
//
// Conventions: every vehicle faces local -z (front = -z, rear = +z).
// Wheels spin around their local X axle, rotors around Y (tail rotor X).
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared geometry / material caches (keeps ~60 vehicles + ~38 peds cheap).
// ---------------------------------------------------------------------------
const _geo = new Map();
function boxGeo(w, h, d) {
  const k = `b${w}|${h}|${d}`;
  let g = _geo.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _geo.set(k, g); }
  return g;
}
function cylGeo(rt, rb, h, seg = 14) {
  const k = `c${rt}|${rb}|${h}|${seg}`;
  let g = _geo.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); _geo.set(k, g); }
  return g;
}
function sphGeo(r, w = 16, h = 12) {
  const k = `s${r}|${w}|${h}`;
  let g = _geo.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, w, h); _geo.set(k, g); }
  return g;
}

const _mat = new Map();
function paintMat(color) {
  const k = `p${color}`;
  let m = _mat.get(k);
  if (!m) {
    m = new THREE.MeshPhongMaterial({ color, shininess: 110, specular: 0x999999 });
    _mat.set(k, m);
  }
  return m;
}
function flatMat(color) {
  const k = `f${color}`;
  let m = _mat.get(k);
  if (!m) { m = new THREE.MeshPhongMaterial({ color, shininess: 25, specular: 0x222222 }); _mat.set(k, m); }
  return m;
}
function glowMat(color, intensity = 1.6) {
  const k = `g${color}|${intensity}`;
  let m = _mat.get(k);
  if (!m) {
    m = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: intensity, shininess: 40 });
    _mat.set(k, m);
  }
  return m;
}

const MAT = {
  glass: new THREE.MeshPhongMaterial({ color: 0x101d28, shininess: 160, specular: 0xffffff }),
  chrome: new THREE.MeshPhongMaterial({ color: 0xdfe4ea, shininess: 180, specular: 0xffffff }),
  black: flatMat(0x14161a),
  darkTrim: flatMat(0x23262b),
  tyre: new THREE.MeshPhongMaterial({ color: 0x0c0d0f, shininess: 8, specular: 0x111111 }),
  hub: new THREE.MeshPhongMaterial({ color: 0xcfd4da, shininess: 120, specular: 0xffffff }),
  headlight: new THREE.MeshBasicMaterial({ color: 0xfff6c8 }),
  fog: new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  taillight: glowMat(0xff1a1a, 1.8),
  tailStrip: glowMat(0xcc0a0a, 1.4),
  white: paintMat(0xf4f4f4),
  navy: paintMat(0x14264d),
  olive: flatMat(0x5a6136),
  oliveDark: flatMat(0x424a28),
  track: flatMat(0x1c1e20),
};

// Small helper: mesh from cached box geometry, positioned in one call.
function bx(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Canvas-texture decals. Transparent background, MeshBasicMaterial so the
// lettering stays readable in any light.
// ---------------------------------------------------------------------------
function textPlane(text, w, h, { font = 'bold 96px Arial, sans-serif', fg = '#ffffff',
  bg = null, stroke = null, letter = 0 } = {}) {
  const cw = 512;
  const ch = Math.max(64, Math.round((512 * h) / w));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch); }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Shrink to fit the canvas width.
  let size = parseInt(font.match(/(\d+)px/)?.[1] || '96', 10);
  const maxW = cw - 16;
  while (ctx.measureText(text).width > maxW && size > 18) {
    size -= 4;
    ctx.font = font.replace(/(\d+)px/, `${size}px`);
  }
  if (letter) ctx.letterSpacing = `${letter}px`;
  if (stroke) { ctx.lineWidth = 8; ctx.strokeStyle = stroke; ctx.strokeText(text, cw / 2, ch / 2 + 2); }
  ctx.fillStyle = fg;
  ctx.fillText(text, cw / 2, ch / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.renderOrder = 3;
  return m;
}

function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 72;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8f8f2'; ctx.fillRect(0, 0, 256, 72);
  ctx.strokeStyle = '#14304d'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 66);
  ctx.fillStyle = '#14304d'; ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial'; ctx.fillText('SOLMAR', 128, 22);
  ctx.font = 'bold 30px Arial'; ctx.fillText('7GTA-21', 128, 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const PLATE_TEX = plateTexture();

function starTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f2ea';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 58 : 24;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const STAR_TEX = starTexture();

// ---------------------------------------------------------------------------
// Wheels — a group whose origin is the axle, so callers spin rotation.x.
// ---------------------------------------------------------------------------
function makeWheel(r = 0.36, w = 0.28) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(cylGeo(r, r, w, 20), MAT.tyre);
  tyre.rotation.z = Math.PI / 2; // cylinder axis Y -> X (axle)
  g.add(tyre);
  const hub = new THREE.Mesh(cylGeo(r * 0.58, r * 0.58, w + 0.03, 14), MAT.hub);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(cylGeo(r * 0.2, r * 0.2, 0.03, 10), MAT.black);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * (w / 2 + 0.01);
    g.add(cap);
  }
  // 5 spokes suggested by thin dark boxes on both faces.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(boxGeo(0.02, r * 0.5, 0.09), MAT.darkTrim);
      const a = (i / 5) * Math.PI * 2;
      sp.position.set(s * (w / 2 + 0.005), Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28);
      sp.rotation.x = a;
      g.add(sp);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Cars. Front is local -z. Each model style gets its own silhouette:
// sports = low + long hood + spoiler, sedan = classic 3-box, coupe = short
// low cabin, hatch = short tail, pickup = cab + open bed, van = tall box.
// ---------------------------------------------------------------------------
const MODELS = [
  { name: 'CORSA BRISA GT', color: 0xd21f2b, top: 34, style: 'sports', len: 4.6, wid: 1.95 },
  { name: 'VELOZ COMET', color: 0x1f5fd2, top: 34, style: 'sports', len: 4.5, wid: 1.9 },
  { name: 'PRADO SEDAN', color: 0xc8ccd2, top: 24, style: 'sedan', len: 4.7, wid: 1.95 },
  { name: 'BISON PICKUP', color: 0x2e7d32, top: 24, style: 'pickup', len: 5.0, wid: 2.0 },
  { name: 'SOL TAXI', color: 0xf5c518, top: 26, style: 'sedan', len: 4.7, wid: 1.95, taxi: true },
  { name: 'ORCA VAN', color: 0x7b2fbe, top: 24, style: 'van', len: 4.9, wid: 2.05 },
  { name: 'FUEGO COUPE', color: 0xf26a1b, top: 34, style: 'coupe', len: 4.4, wid: 1.9 },
  { name: 'MARLIN HATCH', color: 0x0f9d8f, top: 24, style: 'hatch', len: 4.1, wid: 1.85 },
];

function addPlate(g, len, wid, y) {
  const mat = new THREE.MeshBasicMaterial({ map: PLATE_TEX });
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.17), mat);
  rear.position.set(0, y, len / 2 + 0.145);
  rear.rotation.y = Math.PI;
  g.add(rear);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.17), mat);
  front.position.set(0, y, -len / 2 - 0.145);
  g.add(front);
}

function addTextDecal(g, text, w, h, x, y, z, ry, opts = {}) {
  const p = textPlane(text, w, h, opts);
  p.position.set(x, y, z);
  p.rotation.y = ry;
  g.add(p);
  return p;
}

function buildCar(spec) {
  const g = new THREE.Group();
  const paint = paintMat(spec.color);
  const { len, wid } = spec;
  const style = spec.style;
  const wheelR = style === 'van' ? 0.4 : style === 'sports' ? 0.34 : 0.37;
  const wheelW = 0.3;

  // --- Lower body ---------------------------------------------------------
  const bodyH = style === 'van' ? 1.18 : style === 'sports' ? 0.5 : style === 'pickup' ? 0.58 : 0.6;
  const bodyY = style === 'van' ? 1.02 : wheelR + bodyH / 2 + 0.16;
  const bodyTop = bodyY + bodyH / 2;
  bx(g, paint, wid, bodyH, len, 0, bodyY, 0);

  // Sloped hood (front dips down) and sloped trunk deck (rear dips down).
  const hoodLen = style === 'sports' ? 1.25 : 1.0;
  const hood = bx(g, paint, wid * 0.96, 0.14, hoodLen, 0, bodyTop - 0.06, -len / 2 + hoodLen / 2 - 0.05, -0.16);
  hood.position.y = bodyTop - 0.1;
  const trunkLen = style === 'hatch' ? 0.45 : style === 'pickup' ? 0 : 0.9;
  if (trunkLen > 0) {
    bx(g, paint, wid * 0.96, 0.14, trunkLen, 0, bodyTop - 0.08, len / 2 - trunkLen / 2 + 0.05, 0.14);
  }

  // --- Cabin / glasshouse -------------------------------------------------
  let cabinLen, cabinH, cabinZ, cabinY;
  if (style === 'van') {
    // Tall box: windshield is a sloped glass plane at the front, long side
    // windows, painted roof.
    const shield = bx(g, MAT.glass, wid * 0.86, 0.78, 0.08, 0, bodyTop + 0.28, -len / 2 + 0.42, 0.32);
    shield.position.y = bodyTop + 0.3;
    bx(g, paint, wid * 0.98, 0.1, len * 0.94, 0, bodyTop + 0.62, 0);
    for (const s of [-1, 1]) {
      bx(g, MAT.glass, 0.04, 0.5, len * 0.52, s * (wid / 2 + 0.005), bodyTop + 0.3, 0.3);
      bx(g, MAT.glass, 0.04, 0.5, 0.7, s * (wid / 2 + 0.005), bodyTop + 0.3, -len / 2 + 0.75);
    }
    bx(g, MAT.glass, wid * 0.8, 0.55, 0.06, 0, bodyTop + 0.3, len / 2 - 0.02);
    cabinLen = 0; cabinH = 0; cabinZ = 0; cabinY = bodyTop;
  } else if (style === 'pickup') {
    // Cab up front, open bed behind it.
    cabinLen = 1.7; cabinH = 0.62; cabinZ = -len / 2 + 1.55; cabinY = bodyTop;
    bx(g, MAT.glass, wid * 0.8, cabinH, cabinLen, 0, cabinY + cabinH / 2 - 0.04, cabinZ);
    bx(g, paint, wid * 0.84, 0.09, cabinLen * 0.98, 0, cabinY + cabinH - 0.02, cabinZ);
    // Sloped windshield + rear cab glass.
    bx(g, MAT.glass, wid * 0.78, 0.5, 0.06, 0, cabinY + 0.32, cabinZ - cabinLen / 2 - 0.08, 0.38);
    bx(g, MAT.glass, wid * 0.78, 0.42, 0.06, 0, cabinY + 0.3, cabinZ + cabinLen / 2 + 0.06, -0.22);
    // Open bed: floor + side walls + tailgate, dark bed liner.
    const bedZ0 = cabinZ + cabinLen / 2 + 0.1, bedZ1 = len / 2 - 0.08;
    const bedLen = bedZ1 - bedZ0, bedZ = (bedZ0 + bedZ1) / 2;
    bx(g, MAT.darkTrim, wid * 0.92, 0.08, bedLen, 0, bodyTop - 0.1, bedZ);
    for (const s of [-1, 1]) bx(g, paint, 0.09, 0.42, bedLen, s * (wid / 2 - 0.05), bodyTop + 0.1, bedZ);
    bx(g, paint, wid * 0.94, 0.42, 0.09, 0, bodyTop + 0.1, bedZ1);
    // Bed rails + a spare tyre lying in the bed.
    for (const s of [-1, 1]) bx(g, MAT.chrome, 0.05, 0.05, bedLen, s * (wid / 2 - 0.05), bodyTop + 0.33, bedZ);
    const spare = new THREE.Mesh(cylGeo(0.34, 0.34, 0.2, 16), MAT.tyre);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0.4, bodyTop + 0.12, bedZ + 0.3);
    g.add(spare);
  } else {
    // Sedan / sports / coupe / hatch: painted cabin with dark glass.
    cabinLen = style === 'sports' ? 2.3 : style === 'coupe' ? 2.0 : style === 'hatch' ? 2.2 : 2.4;
    cabinH = style === 'sports' ? 0.5 : style === 'coupe' ? 0.52 : 0.62;
    cabinZ = style === 'hatch' ? 0.25 : style === 'sports' ? 0.15 : 0.05;
    cabinY = bodyTop;
    bx(g, MAT.glass, wid * 0.8, cabinH, cabinLen, 0, cabinY + cabinH / 2 - 0.04, cabinZ);
    bx(g, paint, wid * 0.84, 0.09, cabinLen * 0.96, 0, cabinY + cabinH - 0.02, cabinZ);
    // Sloped windshield and rear window.
    bx(g, MAT.glass, wid * 0.78, 0.46, 0.06, 0, cabinY + 0.3, cabinZ - cabinLen / 2 - 0.1, 0.42);
    bx(g, MAT.glass, wid * 0.78, 0.4, 0.06, 0, cabinY + 0.28, cabinZ + cabinLen / 2 + 0.08, -0.38);
    // Painted A-pillars framing the windshield.
    for (const s of [-1, 1]) {
      bx(g, paint, 0.09, 0.5, 0.09, s * (wid * 0.4), cabinY + 0.3, cabinZ - cabinLen / 2 - 0.06, 0.42);
    }
    // Side glass split into front / rear windows with a B-pillar.
    for (const s of [-1, 1]) {
      bx(g, paint, 0.05, cabinH * 0.9, 0.08, s * (wid * 0.4 + 0.01), cabinY + cabinH / 2, cabinZ);
    }
  }

  // --- Front face: grille, headlights, fog lights, bumper ----------------
  const noseZ = -len / 2;
  bx(g, MAT.chrome, wid * 0.52, 0.16, 0.06, 0, bodyY + 0.08, noseZ - 0.02);
  for (let i = 0; i < 3; i++) {
    bx(g, MAT.darkTrim, wid * 0.46, 0.025, 0.03, 0, bodyY + 0.03 + i * 0.05, noseZ - 0.05);
  }
  for (const s of [-1, 1]) {
    bx(g, MAT.headlight, 0.44, 0.15, 0.07, s * (wid * 0.32), bodyY + 0.14, noseZ - 0.03);
    const fog = new THREE.Mesh(cylGeo(0.09, 0.09, 0.05, 12), MAT.fog);
    fog.rotation.x = Math.PI / 2;
    fog.position.set(s * (wid * 0.3), bodyY - 0.14, noseZ - 0.04);
    g.add(fog);
  }
  bx(g, MAT.darkTrim, wid + 0.08, 0.2, 0.28, 0, wheelR + 0.02, noseZ - 0.06);

  // --- Rear face: taillights, light strip, bumper, exhausts, plate -------
  const tailZ = len / 2;
  for (const s of [-1, 1]) {
    bx(g, MAT.taillight, 0.42, 0.14, 0.07, s * (wid * 0.32), bodyY + 0.14, tailZ + 0.03);
  }
  bx(g, MAT.tailStrip, wid * 0.7, 0.06, 0.04, 0, bodyY + 0.02, tailZ + 0.04);
  bx(g, MAT.darkTrim, wid + 0.08, 0.2, 0.28, 0, wheelR + 0.02, tailZ + 0.06);
  for (const s of [-1, 1]) {
    const ex = new THREE.Mesh(cylGeo(0.07, 0.07, 0.3, 10), MAT.chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(s * 0.55, wheelR - 0.02, tailZ + 0.12);
    g.add(ex);
  }
  addPlate(g, len, wid, bodyY + 0.02);

  // --- Sides: mirrors, skirts -------------------------------------------
  for (const s of [-1, 1]) {
    bx(g, paint, 0.06, 0.1, 0.16, s * (wid / 2 + 0.03), cabinY + 0.28,
      style === 'van' ? -len / 2 + 0.55 : cabinZ - cabinLen / 2 + 0.25);
    bx(g, MAT.black, 0.1, 0.14, 0.06, s * (wid / 2 + 0.09), cabinY + 0.3,
      style === 'van' ? -len / 2 + 0.55 : cabinZ - cabinLen / 2 + 0.25);
    bx(g, MAT.darkTrim, 0.06, 0.12, len * 0.82, s * (wid / 2 + 0.005), wheelR + 0.1, 0);
  }

  // --- Spoiler (sports / player) ----------------------------------------
  // Black wing (not body paint): it must read as a separate part from the
  // chase camera behind the car, or the rear is one flat red slab.
  if (spec.spoiler) {
    const sy = bodyTop + 0.3;
    for (const s of [-1, 1]) bx(g, MAT.black, 0.08, 0.32, 0.3, s * 0.62, sy - 0.1, tailZ - 0.25);
    bx(g, MAT.black, wid * 0.94, 0.1, 0.46, 0, sy + 0.06, tailZ - 0.25, -0.08);
  }

  // --- Sunroof (sports / coupe): a black glass panel breaking up the roof
  if (style === 'sports' || style === 'coupe') {
    bx(g, MAT.glass, wid * 0.6, 0.05, cabinLen * 0.5, 0, cabinY + cabinH + 0.02, cabinZ - 0.1);
  }

  // --- Wheels -------------------------------------------------------------
  const wheels = [];
  const wz = len * 0.32;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = makeWheel(wheelR, wheelW);
      w.position.set(sx * (wid / 2 - 0.06), wheelR, sz * wz);
      g.add(w);
      wheels.push(w);
    }
  }

  return { group: g, wheels, bodyTop, cabinY };
}

export function makeCar(kind = 'traffic', seed = 0) {
  let spec;
  let police = false;
  if (kind === 'player') {
    spec = { name: 'CORSA BRISA GT', color: 0xd21f2b, top: 42, style: 'sports', len: 4.6, wid: 1.95, spoiler: true };
  } else if (kind === 'police') {
    police = true;
    spec = { name: 'SOLMAR PD CRUISER', color: 0xf4f4f4, top: 40, style: 'sedan', len: 4.8, wid: 2.0 };
  } else if (kind === 'taxi') {
    spec = { ...MODELS[4] };
  } else {
    spec = { ...MODELS[((seed % 8) + 8) % 8] };
  }

  const { group: g, wheels, bodyTop, cabinY } = buildCar(spec);
  const { len, wid } = spec;
  let lightBar = null;

  // --- Police livery ------------------------------------------------------
  if (police) {
    const noseZ = -len / 2, tailZ = len / 2;
    // Black hood + trunk panels.
    bx(g, MAT.black, wid * 0.94, 0.05, 1.05, 0, bodyTop + 0.02, noseZ + 0.6, -0.14);
    bx(g, MAT.black, wid * 0.94, 0.05, 0.95, 0, bodyTop + 0.02, tailZ - 0.55, 0.12);
    // Black door band on both sides.
    for (const s of [-1, 1]) bx(g, MAT.black, 0.04, 0.52, 2.3, s * (wid / 2 + 0.012), bodyTop - 0.22, 0.1);
    // Push bar on the nose: two uprights + two cross bars, chrome.
    for (const s of [-1, 1]) bx(g, MAT.chrome, 0.09, 0.55, 0.09, s * 0.55, 0.55, noseZ - 0.2);
    bx(g, MAT.chrome, 1.35, 0.09, 0.09, 0, 0.72, noseZ - 0.2);
    bx(g, MAT.chrome, 1.35, 0.09, 0.09, 0, 0.42, noseZ - 0.2);
    // Roof light bar: black base, red lens left, blue lens right.
    const lb = new THREE.Group();
    const lbY = cabinY + 0.7;
    bx(lb, MAT.black, 1.15, 0.1, 0.4, 0, 0, 0);
    const redMat = new THREE.MeshPhongMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 0.2, shininess: 60 });
    const blueMat = new THREE.MeshPhongMaterial({ color: 0x2040ff, emissive: 0x1020ff, emissiveIntensity: 0.2, shininess: 60 });
    const red = new THREE.Mesh(boxGeo(0.5, 0.16, 0.36), redMat);
    red.position.set(-0.3, 0.12, 0);
    const blue = new THREE.Mesh(boxGeo(0.5, 0.16, 0.36), blueMat);
    blue.position.set(0.3, 0.12, 0);
    lb.add(red, blue);
    lb.position.set(0, lbY, 0.05);
    lb.userData = { red, blue };
    g.add(lb);
    lightBar = lb;
    // Decals: POLICE on doors / hood / rear, SOLMAR PD on front fenders.
    const navy = '#0a2a6b';
    for (const s of [-1, 1]) {
      // White POLICE lettering on the black door band.
      addTextDecal(g, 'POLICE', 1.15, 0.34, s * (wid / 2 + 0.045), bodyTop - 0.22, 0.1, s * Math.PI / 2,
        { font: 'bold 96px Arial', fg: '#ffffff' });
      // Navy SOLMAR PD on the white front fender, ahead of the door band.
      addTextDecal(g, 'SOLMAR PD', 0.85, 0.2, s * (wid / 2 + 0.035), bodyTop - 0.15, noseZ + 0.75, s * Math.PI / 2,
        { font: 'bold 80px Arial', fg: navy });
    }
    const hoodDecal = textPlane('POLICE', 1.3, 0.34, { font: 'bold 96px Arial', fg: navy });
    hoodDecal.rotation.x = -Math.PI / 2 - 0.14;
    hoodDecal.position.set(0, bodyTop + 0.06, noseZ + 0.62);
    g.add(hoodDecal);
    const rearDecal = textPlane('POLICE', 1.3, 0.3, { font: 'bold 96px Arial', fg: navy });
    rearDecal.position.set(0, bodyTop - 0.12, tailZ + 0.08);
    rearDecal.rotation.y = Math.PI;
    g.add(rearDecal);
  }

  // --- Taxi roof sign -----------------------------------------------------
  if (spec.taxi) {
    const sign = new THREE.Group();
    bx(sign, flatMat(0xf5c518), 0.72, 0.2, 0.3, 0, 0, 0);
    for (const rz of [-0.16, 0.16]) {
      const t = textPlane('TAXI', 0.6, 0.15, { font: 'bold 90px Arial', fg: '#111111' });
      t.position.set(0, 0, rz);
      if (rz > 0) t.rotation.y = Math.PI;
      sign.add(t);
    }
    sign.position.set(0, cabinY + 0.74, 0.05);
    g.add(sign);
    for (const s of [-1, 1]) {
      addTextDecal(g, 'TAXI', 0.7, 0.22, s * (wid / 2 + 0.035), bodyTop - 0.2, 0.1, s * Math.PI / 2,
        { font: 'bold 90px Arial', fg: '#111111' });
    }
  }

  g.userData = { kind, name: spec.name, topSpeed: spec.top, wheels, lightBar, bodyColor: spec.color };
  return g;
}

// ---------------------------------------------------------------------------
// Helicopter — big, dark blue / white Solmar PD bird, like the reference:
// white fuselage, navy belly stripe + navy roof, sloped glass canopy,
// long tail boom with POLICE fin, 4-blade main rotor + blur disc,
// 4-blade tail rotor, skids, red beacon, searchlight with a beam that
// reaches the street. Front is -z. Group origin = fuselage centre.
// ---------------------------------------------------------------------------
export function makeHelicopter() {
  const g = new THREE.Group();
  const white = MAT.white;
  const navy = MAT.navy;

  // Fuselage: white body, navy belly stripe + navy roof panel.
  bx(g, white, 2.1, 1.5, 3.6, 0, 0, 0);
  bx(g, navy, 2.14, 0.34, 3.62, 0, -0.55, 0);
  bx(g, navy, 1.9, 0.14, 3.3, 0, 0.8, 0);
  // Rounded nose (front = -z).
  const nose = new THREE.Mesh(sphGeo(1.02, 18, 14), white);
  nose.scale.set(1.02, 0.72, 1.15);
  nose.position.set(0, -0.05, -1.8);
  g.add(nose);
  bx(g, navy, 2.0, 0.22, 0.5, 0, -0.62, -1.85);
  // Sloped dark-glass canopy over the nose + side windows.
  bx(g, MAT.glass, 1.7, 0.85, 0.9, 0, 0.28, -1.55, 0.5);
  bx(g, MAT.glass, 1.55, 0.6, 0.7, 0, 0.18, -0.75, 0.18);
  for (const s of [-1, 1]) {
    bx(g, MAT.glass, 0.04, 0.62, 1.15, s * 1.06, 0.12, -0.35);
    bx(g, MAT.glass, 0.04, 0.55, 0.9, s * 1.06, 0.12, 0.85);
  }
  // Rear cabin doors (white with navy outline) + side intake.
  for (const s of [-1, 1]) {
    bx(g, navy, 0.05, 0.9, 0.95, s * 1.06, -0.05, 0.85);
    bx(g, white, 0.05, 0.74, 0.8, s * 1.07, -0.05, 0.85);
  }
  // SOLMAR PD on both flanks.
  for (const s of [-1, 1]) {
    addTextDecal(g, 'SOLMAR PD', 1.9, 0.34, s * 1.12, -0.28, 0.35, s * Math.PI / 2,
      { font: 'bold 84px Arial', fg: '#14264d' });
  }

  // Tail boom: tapered cylinder along +z, white with navy stripe underneath.
  const boom = new THREE.Mesh(cylGeo(0.32, 0.62, 4.6, 12), white);
  boom.rotation.x = Math.PI / 2; // axis Y -> Z; narrow end (+y) points +z
  boom.position.set(0, 0.15, 3.9);
  g.add(boom);
  const boomStripe = new THREE.Mesh(cylGeo(0.34, 0.6, 4.4, 12), navy);
  boomStripe.rotation.x = Math.PI / 2;
  boomStripe.scale.set(1, 1, 0.35);
  boomStripe.position.set(0, -0.12, 3.9);
  g.add(boomStripe);
  // Tail fin (vertical) with POLICE on both faces + horizontal stabiliser.
  bx(g, navy, 0.1, 1.5, 1.0, 0, 0.75, 6.0, -0.25);
  for (const s of [-1, 1]) {
    addTextDecal(g, 'POLICE', 0.85, 0.24, s * 0.075, 0.85, 6.02, s * Math.PI / 2,
      { font: 'bold 90px Arial', fg: '#ffffff' });
  }
  bx(g, white, 0.08, 1.0, 0.7, 0, 0.6, 5.7, -0.25);
  bx(g, navy, 2.4, 0.08, 0.55, 0, 0.15, 5.6);

  // Main rotor: mast + two crossed long blades (4 blades) + blur disc.
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.05, 0);
  const mast = new THREE.Mesh(cylGeo(0.14, 0.18, 0.5, 10), MAT.darkTrim);
  mast.position.y = -0.1;
  rotor.add(mast);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(boxGeo(7.6, 0.06, 0.42), MAT.darkTrim);
    blade.rotation.y = a;
    rotor.add(blade);
    // Red tip stripes so the spin reads in stills.
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(boxGeo(0.5, 0.07, 0.43), flatMat(0xc22a2a));
      tip.position.set(s * 3.5, 0, 0);
      tip.rotation.y = a;
      rotor.add(tip);
    }
  }
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(3.85, 40),
    new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  blur.rotation.x = -Math.PI / 2;
  blur.position.y = 0.06;
  rotor.add(blur);
  g.add(rotor);

  // Tail rotor: 4 blades in the YZ plane, spun around local X.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.42, 0.45, 5.85);
  const tailHub = new THREE.Mesh(cylGeo(0.09, 0.09, 0.3, 8), MAT.darkTrim);
  tailHub.rotation.z = Math.PI / 2;
  tailRotor.add(tailHub);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(boxGeo(0.05, 1.15, 0.16), MAT.darkTrim);
    b.rotation.x = (i * Math.PI) / 2;
    tailRotor.add(b);
  }
  g.add(tailRotor);

  // Landing skids: two long tubes + angled struts.
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(cylGeo(0.07, 0.07, 3.4, 8), MAT.darkTrim);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(s * 0.95, -1.25, -0.1);
    g.add(skid);
    for (const sz of [-0.9, 0.7]) {
      const strut = new THREE.Mesh(cylGeo(0.05, 0.05, 0.75, 8), MAT.darkTrim);
      strut.position.set(s * 0.85, -0.95, sz);
      strut.rotation.z = s * 0.5;
      g.add(strut);
    }
  }

  // Red anti-collision beacon on the tail fin top.
  const beaconMat = new THREE.MeshPhongMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 0.3, shininess: 60 });
  const beacon = new THREE.Mesh(sphGeo(0.14, 10, 8), beaconMat);
  beacon.position.set(0, 1.62, 5.85);
  g.add(beacon);

  // Searchlight under the nose: lamp + long beam cone, tilted down-forward.
  const spotGroup = new THREE.Group();
  spotGroup.position.set(0, -0.85, -1.7);
  const lampBody = new THREE.Mesh(cylGeo(0.22, 0.26, 0.3, 12), MAT.darkTrim);
  lampBody.rotation.x = Math.PI / 2;
  spotGroup.add(lampBody);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), MAT.headlight);
  lens.position.set(0, -0.05, -0.16);
  lens.rotation.x = 0.35;
  spotGroup.add(lens);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  // Cone apex is at +h/2; centred 8 below the lamp the apex sits at the
  // lamp and the beam widens downward. A small +x tilt throws the wide
  // end forward, so the pool lands ahead of the helicopter.
  beam.position.set(0, -8, -2.2);
  beam.rotation.x = 0.28;
  spotGroup.add(beam);
  g.add(spotGroup);

  g.userData = { rotor, tailRotor, beacon, spotGroup };
  return g;
}

// ---------------------------------------------------------------------------
// Tank — olive hull, dark tracks, turret + long barrel, white star.
// Front is -z; the caller rotates userData.turret (rotation.y) to aim.
// ---------------------------------------------------------------------------
export function makeTank() {
  const g = new THREE.Group();
  const olive = MAT.olive, oliveDark = MAT.oliveDark;

  // Hull: main box + sloped glacis plate at the front.
  bx(g, olive, 2.5, 0.85, 4.1, 0, 0.85, 0);
  bx(g, olive, 2.4, 0.7, 1.0, 0, 0.95, -2.1, 0.5);
  bx(g, oliveDark, 2.55, 0.18, 4.15, 0, 0.5, 0);
  // Tracks: dark boxes on both sides with road-wheel discs.
  for (const s of [-1, 1]) {
    bx(g, MAT.track, 0.72, 0.95, 4.5, s * 1.55, 0.48, 0);
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(cylGeo(0.3, 0.3, 0.06, 12), flatMat(0x3a3d33));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 1.93, 0.42, -1.6 + i * 0.8);
      g.add(w);
    }
  }
  // White star on both hull sides.
  for (const s of [-1, 1]) {
    const star = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: STAR_TEX, transparent: true, depthWrite: false }),
    );
    star.position.set(s * 1.27, 0.95, 0.2);
    star.rotation.y = s * Math.PI / 2;
    star.renderOrder = 3;
    g.add(star);
  }
  // Front headlight + tow hooks.
  for (const s of [-1, 1]) {
    bx(g, MAT.headlight, 0.2, 0.12, 0.06, s * 0.9, 1.0, -2.55);
  }

  // Turret group (origin at turret centre so rotation.y aims it).
  const turret = new THREE.Group();
  turret.position.set(0, 1.32, 0.25);
  bx(turret, olive, 1.7, 0.62, 2.1, 0, 0.31, 0);
  bx(turret, oliveDark, 1.78, 0.16, 2.15, 0, 0.05, 0);
  // Commander's hatch + periscope.
  const hatch = new THREE.Mesh(cylGeo(0.32, 0.32, 0.1, 12), oliveDark);
  hatch.position.set(-0.4, 0.68, 0.3);
  turret.add(hatch);
  bx(turret, MAT.glass, 0.3, 0.12, 0.2, 0.45, 0.68, -0.2);
  // Long barrel pointing forward (-z) + muzzle brake.
  const barrel = new THREE.Mesh(cylGeo(0.11, 0.13, 2.7, 12), MAT.darkTrim);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.38, -2.2);
  turret.add(barrel);
  const brake = new THREE.Mesh(cylGeo(0.17, 0.17, 0.4, 12), MAT.darkTrim);
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, 0.38, -3.35);
  turret.add(brake);
  g.add(turret);

  g.userData = { turret, barrel };
  return g;
}

// ---------------------------------------------------------------------------
// Person — cheap articulated figure. Legs/arms pivot at hip/shoulder
// (geometry translated so the group origin is the joint), so callers can
// swing them with rotation.x. ~14 meshes each; traffic spawns ~38.
// ---------------------------------------------------------------------------
const SKIN = flatMat(0xd9a066);
const HAIR = flatMat(0x1c1410);
function limbGeo(w, h, d) {
  const k = `limb${w}|${h}|${d}`;
  let geo = _geo.get(k);
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, -h / 2, 0); // pivot at the top (joint)
    _geo.set(k, geo);
  }
  return geo;
}

export function makePerson(shirt = 0x2ea88a, pants = 0x2a3a55) {
  const g = new THREE.Group();
  const shirtMat = flatMat(shirt);
  const pantsMat = flatMat(pants);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(limbGeo(0.2, 0.78, 0.22), pantsMat);
    leg.position.set(s * 0.13, 0.8, 0);
    g.add(leg);
    legs.push(leg);
    const shoe = new THREE.Mesh(boxGeo(0.22, 0.1, 0.34), MAT.black);
    shoe.position.set(0, -0.74, 0.05);
    leg.add(shoe);
  }
  const torso = new THREE.Mesh(boxGeo(0.56, 0.62, 0.3), shirtMat);
  torso.position.set(0, 1.12, 0);
  g.add(torso);
  const head = new THREE.Mesh(boxGeo(0.32, 0.34, 0.3), SKIN);
  head.position.set(0, 1.62, 0);
  g.add(head);
  // Cap / hat.
  const cap = new THREE.Mesh(boxGeo(0.36, 0.1, 0.34), shirtMat);
  cap.position.set(0, 1.82, 0);
  g.add(cap);
  bx(g, shirtMat, 0.36, 0.04, 0.16, 0, 1.78, -0.22);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(limbGeo(0.16, 0.62, 0.18), shirtMat);
    arm.position.set(s * 0.36, 1.4, 0);
    g.add(arm);
    arms.push(arm);
    const hand = new THREE.Mesh(boxGeo(0.15, 0.14, 0.16), SKIN);
    hand.position.set(0, -0.62, 0);
    arm.add(hand);
  }

  g.userData = { legs, arms, torso, head };
  return g;
}

// ---------------------------------------------------------------------------
// Pickups — glowing core box + flat ring on the ground. The caller spins
// the whole group (rotation.y) and bobs it.
// ---------------------------------------------------------------------------
const PICKUP_COLORS = {
  health: 0xff4d6d, // pink/red
  armour: 0x3aa0ff, // blue
  weapon: 0xffc93a, // gold
};

export function makePickup(kind) {
  const g = new THREE.Group();
  const color = PICKUP_COLORS[kind] ?? PICKUP_COLORS.weapon;
  const coreMat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 1.4, shininess: 60 });
  const core = new THREE.Mesh(boxGeo(0.7, 0.7, 0.7), coreMat);
  core.position.y = 0.85;
  core.rotation.y = Math.PI / 4;
  g.add(core);
  // Bright inner cube so the core reads as glowing from every angle.
  const inner = new THREE.Mesh(boxGeo(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  inner.position.y = 0.85;
  inner.rotation.y = Math.PI / 4;
  g.add(inner);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 8, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.06;
  g.add(disc);

  g.userData = { kind, core, ring };
  return g;
}
