// Vehicles: every car, the police helicopter and the tank are built from
// boxes, cylinders and emissive lights — no imported models, all original.
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

function wheelMesh() {
  const w = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12),
    new THREE.MeshLambertMaterial({ color: 0x141414 }));
  w.rotation.z = Math.PI / 2;
  w.castShadow = true;
  return w;
}

// A car: group with body, cabin, wheels, lights. `opts` picks colours and
// whether it is a police cruiser (light bar + black/white paint).
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
  const body = box(2.0, 0.62, 4.4, bodyColor);
  body.position.y = 0.62;
  g.add(body);
  // Police cars get a black hood + doors band.
  if (isPolice) {
    const band = box(2.02, 0.3, 2.2, 0x1a1a1a);
    band.position.set(0, 0.72, 0.4);
    g.add(band);
    const hood = box(2.02, 0.1, 1.1, 0x1a1a1a);
    hood.position.set(0, 0.95, -1.7);
    g.add(hood);
  }
  const cabin = box(1.7, 0.58, 2.2, isPolice ? 0x222222 : 0x1a2733);
  cabin.position.set(0, 1.2, 0.25);
  g.add(cabin);
  // Windshield strip (lighter glass).
  const glass = box(1.72, 0.3, 0.1, 0x9fd0e8);
  glass.position.set(0, 1.18, -0.85);
  g.add(glass);
  // Wheels.
  const wheels = [];
  for (const [wx, wz] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
    const w = wheelMesh();
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  // Headlights (front = -z) and taillights.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0xfff2a0, emissiveIntensity: 1.2 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hl);
    h.position.set(s * 0.62, 0.66, -2.21);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xaa0000, emissive: 0xff2222, emissiveIntensity: 0.9 }));
    t.position.set(s * 0.62, 0.66, 2.21);
    g.add(t);
  }
  // Police light bar: red left, blue right, flashing by code.
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.x = 0.35;
    lightBar.add(red); lightBar.add(blue);
    lightBar.position.set(0, 1.62, 0.25);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    // "SOLMAR PD" is painted on the side via a small white plate.
    const plate = box(0.05, 0.4, 1.6, 0xffffff);
    plate.position.set(1.02, 0.7, 0.3);
    g.add(plate);
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

// Police helicopter: body, tail, skids, spinning main rotor, searchlight.
export function makeHelicopter() {
  const g = new THREE.Group();
  const body = box(2.4, 1.5, 4.2, 0x2244aa);
  body.position.y = 0;
  g.add(body);
  const glass = box(2.0, 0.8, 1.2, 0x9fd0e8);
  glass.position.set(0, 0.25, -1.8);
  g.add(glass);
  const tail = box(0.7, 0.7, 4.5, 0x2244aa);
  tail.position.set(0, 0.3, 4.0);
  g.add(tail);
  const fin = box(0.25, 1.6, 1.2, 0x2244aa);
  fin.position.set(0, 0.9, 6.0);
  g.add(fin);
  // Skids.
  for (const s of [-1, 1]) {
    const skid = box(0.15, 0.15, 3.6, 0x222222);
    skid.position.set(s * 1.1, -1.0, 0);
    g.add(skid);
  }
  // Main rotor (spins) + tail rotor.
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.1;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.3), bladeMat);
  tailRotor.position.set(0.45, 0.9, 6.0);
  g.add(tailRotor);
  // Searchlight cone pointing down.
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(4, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.10, side: THREE.DoubleSide }));
  spot.position.y = -13;
  spot.rotation.x = Math.PI;
  g.add(spot);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9 }));
  lamp.position.y = -0.9;
  g.add(lamp);
  g.userData = { rotor, tailRotor };
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
