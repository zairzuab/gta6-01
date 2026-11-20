// Vehicles: every car, the police helicopter and the tank are built from
// boxes, cylinders and emissive lights — no imported models, all original.
// Police units carry real markings: canvas-texture "POLICE" / "SOLMAR PD"
// decals, a flashing light bar, push bars and hubcaps, so they read as
// police at a glance. The helicopter is a detailed police air unit with a
// spinning rotor + blur disc, tail rotor, skids and an aimed searchlight.
import * as THREE from 'three';

const CAR_NAMES = [
  { name: 'CORSA BRISA GT', body: 0xd8352a, fast: true },
  { name: 'VELOZ COMET', body: 0x2a6fd8, fast: true },
  { name: 'PRADO SEDAN', body: 0xd8d8d8, fast: false },
  { name: 'BISON PICKUP', body: 0x3a7a3a, fast: false },
  { name: 'SOL TAXI', body: 0xf2c200, fast: false },
  { name: 'ORCA VAN', body: 0x8a6fd8, fast: false },
  { name: 'FUEGO COUPE', body: 0xff7a1a, fast: true },
  { name: 'MARLIN HATCH', body: 0x1ad8c8, fast: false },
];

function box(w, h, d, color, emissive = 0x000000, ei = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei }));
  m.castShadow = true;
  return m;
}

// --- Canvas text decals -------------------------------------------------
// A readable "POLICE" / "SOLMAR PD" marking drawn on a canvas and applied
// to a plane. MeshBasicMaterial keeps the text legible in any light.
function makeTextTexture(text, opts = {}) {
  const {
    w = 512, h = 128, font = 'bold 84px Arial, sans-serif',
    fg = '#ffffff', bg = null, letterSpacing = 6,
  } = opts;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = font;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Manual letter-spacing for a stencil look.
  if (letterSpacing > 0) {
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
    let x = (w - total) / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x + widths[i] / 2, h / 2 + 4);
      x += widths[i] + letterSpacing;
    }
  } else {
    ctx.fillText(text, w / 2, h / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A flat decal plane carrying `text`. `opts` pass through to the texture.
function textPlane(text, w, h, opts = {}) {
  const tex = makeTextTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  return m;
}

// A decal that lies flat on a horizontal surface (hood / roof) with its
// text top pointing toward +z (the rear), so it reads correctly from the
// front of the vehicle — the direction a screenshot camera sees.
function flatText(text, w, h, opts = {}) {
  const g = new THREE.Group();
  const p = textPlane(text, w, h, opts);
  p.rotation.x = -Math.PI / 2;
  g.add(p);
  g.rotation.y = Math.PI;
  return g;
}

// A wheel: black tyre + light hubcap, in a group so the caller can spin it
// around its axle (rotation.x) exactly as before.
function wheelMesh() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14),
    new THREE.MeshLambertMaterial({ color: 0x141414 }));
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12),
    new THREE.MeshLambertMaterial({ color: 0xb8bcc2 }));
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.36, 8),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  cap.rotation.z = Math.PI / 2;
  g.add(cap);
  return g;
}

// A car: body with a sloped hood and trunk, a painted cabin with dark
// glass, grille, bumpers, mirrors, headlights and taillights. `opts` picks
// colours and whether it is a police cruiser (black-and-white livery,
// push bar, big flashing light bar, POLICE decals).
export function makeCar(kind = 'traffic', seed = 0) {
  const g = new THREE.Group();
  let bodyColor = 0xcccccc;
  let name = 'PRADO SEDAN';
  let topSpeed = 26;
  if (kind === 'player') {
    const pick = CAR_NAMES[0];
    bodyColor = pick.body; name = pick.name; topSpeed = 42;
  } else if (kind === 'police') {
    bodyColor = 0xf2f2f2; name = 'LIMA CRUISER'; topSpeed = 40;
  } else if (kind === 'taxi') {
    bodyColor = 0xf2c200; name = 'SOL TAXI'; topSpeed = 26;
  } else {
    const pick = CAR_NAMES[seed % CAR_NAMES.length];
    bodyColor = pick.body; name = pick.name; topSpeed = pick.fast ? 34 : 24;
  }
  const isPolice = kind === 'police';
  const paint = isPolice ? 0xf2f2f2 : bodyColor;

  // --- Lower body + sloped hood + trunk ---------------------------------
  const body = box(2.0, 0.55, 4.4, paint);
  body.position.y = 0.62;
  g.add(body);
  const hood = box(1.9, 0.3, 1.35, isPolice ? 0x161616 : paint);
  hood.position.set(0, 0.86, -1.5);
  hood.rotation.x = -0.08;
  g.add(hood);
  const trunk = box(1.9, 0.32, 1.05, isPolice ? 0x161616 : paint);
  trunk.position.set(0, 0.86, 1.65);
  trunk.rotation.x = 0.08;
  g.add(trunk);
  // Police black door band (white body, black middle) — the classic livery.
  if (isPolice) {
    const band = box(2.02, 0.34, 2.3, 0x161616);
    band.position.set(0, 0.68, 0.25);
    g.add(band);
  }

  // --- Cabin: painted shell + dark glass --------------------------------
  const cabin = box(1.62, 0.5, 2.0, paint);
  cabin.position.set(0, 1.13, 0.15);
  g.add(cabin);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x14202e, emissive: 0x0a141e, emissiveIntensity: 0.4 });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.06), glassMat);
  windshield.position.set(0, 1.15, -0.8);
  windshield.rotation.x = -0.32;
  g.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.06), glassMat);
  rearGlass.position.set(0, 1.15, 1.08);
  rearGlass.rotation.x = 0.28;
  g.add(rearGlass);
  for (const s of [-1, 1]) {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 1.7), glassMat);
    sideGlass.position.set(s * 0.82, 1.15, 0.15);
    g.add(sideGlass);
    // Side mirrors.
    const mirror = box(0.14, 0.1, 0.22, 0x1a1a1a);
    mirror.position.set(s * 0.92, 1.22, -0.55);
    g.add(mirror);
  }

  // --- Grille, bumpers ---------------------------------------------------
  const grille = box(1.3, 0.28, 0.1, 0x1a1a1a);
  grille.position.set(0, 0.6, -2.22);
  g.add(grille);
  for (const gy of [0.54, 0.68]) {
    const slat = box(1.2, 0.05, 0.04, 0xcfd4d8, 0x222222, 0.4);
    slat.position.set(0, gy, -2.28);
    g.add(slat);
  }
  const bumperF = box(2.04, 0.24, 0.28, 0x2a2a2a);
  bumperF.position.set(0, 0.38, -2.28);
  g.add(bumperF);
  const bumperR = box(2.04, 0.24, 0.28, 0x2a2a2a);
  bumperR.position.set(0, 0.38, 2.28);
  g.add(bumperR);

  // --- Wheels ------------------------------------------------------------
  const wheels = [];
  for (const [wx, wz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
    const w = wheelMesh();
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }

  // --- Headlights, fog lights, taillights --------------------------------
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0xfff2a0, emissiveIntensity: 1.4 });
  const tl = new THREE.MeshLambertMaterial({ color: 0xaa0000, emissive: 0xff2222, emissiveIntensity: 1.0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.08), hl);
    h.position.set(s * 0.62, 0.68, -2.21);
    g.add(h);
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), hl);
    fog.rotation.x = Math.PI / 2;
    fog.position.set(s * 0.55, 0.42, -2.26);
    g.add(fog);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.08), tl);
    t.position.set(s * 0.62, 0.68, 2.21);
    g.add(t);
  }
  // Rear light strip across the trunk.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.06), tl);
  strip.position.set(0, 0.95, 2.18);
  g.add(strip);

  // --- Police equipment --------------------------------------------------
  let lightBar = null;
  if (isPolice) {
    // Push bar: two uprights + a crossbar + a centre plate on the nose.
    const barMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    for (const s of [-1, 1]) {
      const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.72, 8), barMat);
      upright.position.set(s * 0.55, 0.62, -2.42);
      g.add(upright);
    }
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.24, 8), barMat);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, 0.88, -2.42);
    g.add(cross);
    const plate = box(0.34, 0.3, 0.08, 0x1a1a1a);
    plate.position.set(0, 0.62, -2.44);
    g.add(plate);

    // Light bar: dark base + big red/blue domes + a centre clear dome.
    lightBar = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x181818 }));
    base.position.y = -0.06;
    lightBar.add(base);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.46),
      new THREE.MeshLambertMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    red.position.x = -0.36;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x0022cc, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.x = 0.36;
    const clear = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0.5 }));
    lightBar.add(red); lightBar.add(blue); lightBar.add(clear);
    lightBar.position.set(0, 1.5, 0.2);
    lightBar.userData = { red, blue };
    g.add(lightBar);

    // "POLICE" on both doors (white on the black band).
    for (const s of [-1, 1]) {
      const decal = textPlane('POLICE', 1.9, 0.42, { fg: '#ffffff', font: 'bold 88px Arial, sans-serif' });
      decal.position.set(s * 1.03, 0.68, 0.25);
      decal.rotation.y = s * Math.PI / 2;
      g.add(decal);
    }
    // "POLICE" on the hood, readable from the front.
    const hoodText = flatText('POLICE', 1.7, 0.5, { fg: '#ffffff', font: 'bold 88px Arial, sans-serif' });
    hoodText.position.set(0, 1.03, -1.5);
    g.add(hoodText);
    // "POLICE" on the rear, readable from behind.
    const rearText = textPlane('POLICE', 1.7, 0.42, { fg: '#ffffff', font: 'bold 88px Arial, sans-serif' });
    rearText.position.set(0, 0.9, 2.19);
    rearText.rotation.y = Math.PI;
    g.add(rearText);
    // "SOLMAR PD" small on the front fenders.
    for (const s of [-1, 1]) {
      const fender = textPlane('SOLMAR PD', 1.1, 0.24, { fg: '#ffffff', font: 'bold 52px Arial, sans-serif' });
      fender.position.set(s * 1.03, 0.62, -1.35);
      fender.rotation.y = s * Math.PI / 2;
      g.add(fender);
    }
  }

  // Headlight beams (cheap fake: two translucent cones).
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.10, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 7, 8, 1, true), beamMat);
    cone.rotation.x = -Math.PI / 2 - 0.12;
    cone.position.set(s * 0.6, 0.55, -5.4);
    g.add(cone);
  }
  g.userData = { kind, name, topSpeed, wheels, lightBar, bodyColor };
  return g;
}

// Police helicopter: white/dark-blue SOLMAR PD livery, rounded nose with a
// glass canopy, tapered tail boom, tail fin + stabiliser, spinning main
// rotor with a blur disc, spinning tail rotor, landing skids with struts,
// a flashing red beacon and an aimed searchlight. Built bigger than the
// old one so it reads clearly from the street.
export function makeHelicopter() {
  const g = new THREE.Group();
  const white = 0xf2f2f2;
  const navy = 0x1a3a8a;
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x16324a, emissive: 0x0a1a2a, emissiveIntensity: 0.5 });

  // --- Fuselage: white body, navy belly stripe, rounded nose -------------
  const body = box(3.0, 1.9, 5.2, white);
  body.position.y = 0;
  g.add(body);
  const belly = box(3.02, 0.5, 5.22, navy);
  belly.position.y = -0.55;
  g.add(belly);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10),
    new THREE.MeshLambertMaterial({ color: white }));
  nose.scale.set(1.35, 0.85, 1.3);
  nose.position.set(0, -0.1, -2.6);
  nose.castShadow = true;
  g.add(nose);
  // Cockpit glass: sloped dark canopy over the nose.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.7), glassMat);
  canopy.position.set(0, 0.45, -2.0);
  canopy.rotation.x = -0.3;
  g.add(canopy);
  // Side windows + rear side windows.
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 1.8), glassMat);
    win.position.set(s * 1.52, 0.35, -0.6);
    g.add(win);
    const winR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.2), glassMat);
    winR.position.set(s * 1.52, 0.3, 1.2);
    g.add(winR);
    // "SOLMAR PD" on the fuselage flanks.
    const decal = textPlane('SOLMAR PD', 2.4, 0.55, { fg: '#1a3a8a', font: 'bold 72px Arial, sans-serif' });
    decal.position.set(s * 1.53, -0.05, 0.4);
    decal.rotation.y = s * Math.PI / 2;
    g.add(decal);
  }

  // --- Tail boom (tapered), fin, stabiliser ------------------------------
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.6, 5.2, 10),
    new THREE.MeshLambertMaterial({ color: white }));
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.35, 4.6);
  boom.castShadow = true;
  g.add(boom);
  const fin = box(0.22, 1.7, 1.3, white);
  fin.position.set(0, 1.0, 7.0);
  g.add(fin);
  // "POLICE" on both faces of the tail fin.
  for (const s of [-1, 1]) {
    const decal = textPlane('POLICE', 1.0, 0.45, { fg: '#1a3a8a', font: 'bold 72px Arial, sans-serif' });
    decal.position.set(s * 0.13, 1.0, 7.0);
    decal.rotation.y = s * Math.PI / 2;
    g.add(decal);
  }
  const stab = box(2.6, 0.1, 0.8, white);
  stab.position.set(0, 0.5, 6.9);
  g.add(stab);

  // --- Tail rotor: 4-blade cross on the fin's left side, spins on x -----
  const tailRotor = new THREE.Group();
  const trMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const trHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 8), trMat);
  trHub.rotation.z = Math.PI / 2;
  tailRotor.add(trHub);
  const trBladeV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.18), trMat);
  tailRotor.add(trBladeV);
  const trBladeH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 1.9), trMat);
  tailRotor.add(trBladeH);
  tailRotor.position.set(-0.38, 1.0, 7.0);
  g.add(tailRotor);

  // --- Landing skids + struts --------------------------------------------
  for (const s of [-1, 1]) {
    const skid = box(0.16, 0.16, 4.6, 0x222222);
    skid.position.set(s * 1.35, -1.35, 0);
    g.add(skid);
    for (const zz of [-1.4, 1.4]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      strut.position.set(s * 1.05, -1.1, zz);
      strut.rotation.z = s > 0 ? 0.5 : -0.5;
      g.add(strut);
    }
  }

  // --- Main rotor: mast, hub, 4 blades + a blur disc ---------------------
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  mast.position.y = 1.35;
  g.add(mast);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), bladeMat);
  rotor.add(hub);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(13, 0.08, 0.55), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.95;
  g.add(rotor);
  // Blur disc: reads as a spinning rotor even in a still screenshot.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6.6, 40),
    new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.92;
  g.add(disc);

  // --- Red anti-collision beacon (flashes; pulsed by police.js) ----------
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
  beacon.position.set(0, 1.15, 0.5);
  g.add(beacon);

  // --- Searchlight: lamp + a long aimed beam ----------------------------
  // The beam points down-forward (toward the nose / the player below) and
  // is long enough to reach the street from the helicopter's orbit.
  const spotGroup = new THREE.Group();
  spotGroup.position.set(0, -1.0, -0.8);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9 }));
  spotGroup.add(lamp);
  const beamLen = 55;
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(6, beamLen, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  outer.rotation.x = Math.PI / 2;
  outer.position.z = -beamLen / 2;
  spotGroup.add(outer);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, beamLen, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  inner.rotation.x = Math.PI / 2;
  inner.position.z = -beamLen / 2;
  spotGroup.add(inner);
  spotGroup.rotation.x = -0.55; // tilt the beam down toward the player
  g.add(spotGroup);

  g.userData = { rotor, tailRotor, beacon, spotGroup };
  return g;
}

// The tank: slow, heavy, joins at 5 stars. Hull, turret, barrel, tracks.
export function makeTank() {
  const g = new THREE.Group();
  const hull = box(3.4, 1.3, 5.6, 0x4a5a3a);
  hull.position.y = 1.0;
  g.add(hull);
  for (const s of [-1, 1]) {
    const track = box(0.9, 1.0, 5.8, 0x222222);
    track.position.set(s * 1.7, 0.5, 0);
    g.add(track);
  }
  const turret = box(2.2, 0.9, 2.6, 0x55663f);
  turret.position.set(0, 2.05, 0.2);
  g.add(turret);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 4.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 2.05, -2.6);
  g.add(barrel);
  const star = box(0.9, 0.9, 0.06, 0xffffff);
  star.position.set(1.72, 1.2, 0);
  star.rotation.y = Math.PI / 2;
  g.add(star);
  g.userData = { turret, barrel };
  return g;
}

// On-foot character: a simple articulated figure (torso, head, legs, arms).
export function makePerson(shirt = 0x2ea88a, pants = 0x2a3a55) {
  const g = new THREE.Group();
  const torso = box(0.62, 0.72, 0.34, shirt);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a077 }));
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const cap = box(0.5, 0.12, 0.5, 0x222222);
  cap.position.y = 1.82;
  g.add(cap);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = box(0.22, 0.68, 0.24, pants);
    leg.position.set(s * 0.16, 0.34, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = box(0.16, 0.6, 0.18, shirt);
    arm.position.set(s * 0.4, 1.05, 0);
    g.add(arm);
    arms.push(arm);
  }
  g.userData = { legs, arms, torso, head };
  return g;
}

// A weapon pickup / health / armour box on the street.
export function makePickup(kind) {
  const g = new THREE.Group();
  const color = kind === 'health' ? 0xff4d6d : kind === 'armour' ? 0x4da3ff : 0xffd75e;
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.7 }));
  core.position.y = 0.9;
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  g.add(ring);
  g.userData = { kind, core, ring };
  return g;
}
