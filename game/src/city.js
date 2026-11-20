// City: Solmar — a sun-soaked coastal grid city built from three.js boxes
// with procedural canvas textures. Streets run on a grid; each block holds
// buildings, palms line the avenues, a Ferris wheel turns on the pier, and
// the beach meets the sea at the south edge. All art is generated here.
import * as THREE from 'three';

// City layout constants (metres). Streets are 14 wide, blocks 46, so the
// pitch between street centres is 60.
export const PITCH = 60;
export const STREET_W = 14;
export const BLOCK = PITCH - STREET_W;
export const GRID = 7; // 7x7 blocks -> city spans about 420 m each way
export const CITY_HALF = (GRID * PITCH) / 2;

// Named streets and districts, used by the HUD location line.
export const AVENUES = ['Calle Faro', 'Calle Coral', 'Boulevard Palma', 'Calle Brisa', 'Avenida del Sol', 'Avenida Marea', 'Paseo Coral'];
export const DISTRICTS = ['PLAYA LARGA', 'CENTRO', 'EL FARO', 'VIEJO SOLMAR', 'PUERTO AZUL', 'LAS PALMERAS', 'MIRAMAR'];

function makeBuildingTexture(base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so faces read as concrete, not flat colour.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // Window grid: some lit warm, some dark glass.
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 10 + col * 19;
      const y = 12 + row * 20;
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#1d2f45';
      g.fillRect(x, y, 12, 13);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 12, 2);
    }
  }
  // Rooftop edge.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, 128, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 256, 256);
  // Asphalt speckle.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  // Centre dashed line (yellow) and edge lines (white).
  g.fillStyle = '#e8c33a';
  for (let y = 0; y < 256; y += 32) g.fillRect(126, y, 4, 18);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(6, 0, 3, 256);
  g.fillRect(247, 0, 3, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSidewalkTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9a938a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // {x, z, half} AABBs for buildings
    this.palms = [];
    this.trafficLights = [];
    this.ferrisWheel = null;
    this.ferrisGondolas = [];
    this.build(scene);
  }

  build(scene) {
    // --- Sky, sun, fog -------------------------------------------------
    scene.background = new THREE.Color(0x87bfe8);
    scene.fog = new THREE.Fog(0x9fc6e8, 180, 620);
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 500;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.1));
    // Sun disc + a few clouds.
    const sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff6c9, fog: false }));
    sunMesh.position.set(240, 190, -320);
    sunMesh.lookAt(0, 40, 0);
    scene.add(sunMesh);
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 7, 10, 8), cloudMat);
        s.position.set(j * 8 - 12 + Math.random() * 4, Math.random() * 2, Math.random() * 4);
        s.scale.y = 0.45;
        cloud.add(s);
      }
      cloud.position.set((Math.random() - 0.5) * 700, 95 + Math.random() * 45, (Math.random() - 0.5) * 700 - 60);
      scene.add(cloud);
    }

    // --- Ground: grass base, then street strips ------------------------
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 1100),
      new THREE.MeshLambertMaterial({ color: 0x6fae5e }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.05;
    grass.receiveShadow = true;
    scene.add(grass);
    // Sea at the south edge (z beyond the city).
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 260),
      new THREE.MeshLambertMaterial({ color: 0x2e7fb8 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, CITY_HALF + 150);
    scene.add(sea);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 26),
      new THREE.MeshLambertMaterial({ color: 0xe8d9a8 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.0, CITY_HALF + 12);
    scene.add(sand);

    const roadTex = makeRoadTexture();
    const walkTex = makeSidewalkTexture();
    // Streets: one strip per grid line, both directions.
    const streetMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
    for (let i = 0; i <= GRID; i++) {
      const c = -CITY_HALF + i * PITCH;
      // North-south street (along z).
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(STREET_W, GRID * PITCH + STREET_W), streetMat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(c, 0.03, 0);
      ns.receiveShadow = true;
      scene.add(ns);
      // East-west street (along x).
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(GRID * PITCH + STREET_W, STREET_W), streetMat);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.03, c);
      ew.receiveShadow = true;
      scene.add(ew);
      // Sidewalk borders around each street crossing are drawn per block below.
    }

    // --- Blocks: buildings + sidewalks + palms -------------------------
    const palette = ['#e8d8b8', '#d9a06b', '#c97e6d', '#a8b8c8', '#e8b8c8', '#b8c8a8', '#f0e0c0', '#c8a8d8', '#8fb8c8'];
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let bx = 0; bx < GRID; bx++) {
      for (let bz = 0; bz < GRID; bz++) {
        const cx = -CITY_HALF + STREET_W / 2 + BLOCK / 2 + bx * PITCH;
        const cz = -CITY_HALF + STREET_W / 2 + BLOCK / 2 + bz * PITCH;
        // Sidewalk slab for the block.
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 4, BLOCK + 4), walkMat);
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(cx, 0.04, cz);
        walk.receiveShadow = true;
        scene.add(walk);
        // 1-3 buildings per block, taller near the centre (downtown).
        const distCentre = Math.hypot(cx, cz) / CITY_HALF;
        const count = distCentre < 0.35 ? 2 : (Math.random() < 0.6 ? 2 : 1);
        for (let b = 0; b < count; b++) {
          const w = 12 + Math.random() * 14;
          const d = 12 + Math.random() * 14;
          const h = distCentre < 0.3 ? 26 + Math.random() * 34 : 10 + Math.random() * 22;
          const ox = (b === 0 ? -BLOCK / 4 : BLOCK / 4) + (Math.random() - 0.5) * 4;
          const oz = (b === 0 ? -BLOCK / 4 : BLOCK / 4) + (Math.random() - 0.5) * 4;
          const tex = makeBuildingTexture(palette[(bx * 7 + bz * 3 + b) % palette.length], 0.22);
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const building = new THREE.Mesh(buildingGeo, mat);
          building.scale.set(w, h, d);
          building.position.set(cx + ox, h / 2, cz + oz);
          building.castShadow = true;
          building.receiveShadow = true;
          scene.add(building);
          this.colliders.push({ x: cx + ox, z: cz + oz, halfX: w / 2 + 0.4, halfZ: d / 2 + 0.4 });
          // Rooftop AC box, so roofs are not flat slabs.
          const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3),
            new THREE.MeshLambertMaterial({ color: 0x888888 }));
          ac.position.set(cx + ox + w / 4, h + 0.8, cz + oz);
          scene.add(ac);
        }
        // Palms on the block corners.
        if ((bx + bz) % 2 === 0) {
          this.addPalm(scene, cx - BLOCK / 2 + 2, cz - BLOCK / 2 + 2);
          this.addPalm(scene, cx + BLOCK / 2 - 2, cz + BLOCK / 2 - 2);
        }
      }
    }

    // Palms lining the main avenue (Avenida del Sol, the x = +30 street:
    // streets sit at -210 + i*60, so the central avenue is x = 30).
    for (let z = -CITY_HALF + 30; z < CITY_HALF; z += 30) {
      this.addPalm(scene, 30 - STREET_W / 2 - 2.5, z);
      this.addPalm(scene, 30 + STREET_W / 2 + 2.5, z + 15);
    }

    // --- Traffic lights at the central intersections -------------------
    for (let i = 2; i <= GRID - 2; i += 2) {
      for (let j = 2; j <= GRID - 2; j += 2) {
        const x = -CITY_HALF + i * PITCH;
        const z = -CITY_HALF + j * PITCH;
        this.addTrafficLight(scene, x + STREET_W / 2 + 1, z + STREET_W / 2 + 1);
      }
    }

    // --- Ferris wheel on the pier, south, visible down the avenue ------
    this.buildFerrisWheel(scene);

    // --- Distant skyline silhouette beyond the city --------------------
    const skyMat = new THREE.MeshLambertMaterial({ color: 0x7fa8c8, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 26; i++) {
      const h = 30 + Math.random() * 70;
      const w = 14 + Math.random() * 18;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), skyMat);
      const ang = (i / 26) * Math.PI * 2;
      const r = 420 + Math.random() * 60;
      tower.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r - 40);
      scene.add(tower);
    }
  }

  addPalm(scene, x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.45, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    g.add(trunk);
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e9e4a });
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 4.2), frondMat);
      const a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.6, 7.1, Math.sin(a) * 1.6);
      frond.rotation.y = -a;
      frond.rotation.x = 0.5;
      frond.castShadow = true;
      g.add(frond);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
    nuts.position.y = 6.8;
    g.add(nuts);
    g.position.set(x, 0, z);
    scene.add(g);
    this.palms.push(g);
  }

  addTrafficLight(scene, x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.position.y = 2.7;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    head.position.y = 5.2;
    g.add(head);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lampMat);
    lamp.position.set(0, 5.55, 0.29);
    g.add(lamp);
    g.position.set(x, 0, z);
    scene.add(g);
    this.trafficLights.push({ group: g, lamp, state: 0, timer: Math.random() * 3 });
  }

  buildFerrisWheel(scene) {
    const g = new THREE.Group();
    const hubZ = CITY_HALF + 26;
    // Two support legs.
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 34, 8), legMat);
      leg.position.set(s * 7, 15, 0);
      leg.rotation.z = s * 0.28;
      g.add(leg);
    }
    // The wheel itself, on the pier, facing north up the avenue.
    const wheel = new THREE.Group();
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.55, 8, 40), rimMat);
    wheel.add(rim);
    const spokeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 30, 6), spokeMat);
      spoke.rotation.z = (i / 8) * Math.PI;
      wheel.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2, 12),
      new THREE.MeshLambertMaterial({ color: 0xffd75e }));
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    // Gondolas around the rim, each a little lit cabin.
    const cabMat = new THREE.MeshLambertMaterial({ color: 0x4da3ff });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), cabMat);
      cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
      wheel.add(cab);
      this.ferrisGondolas.push(cab);
    }
    wheel.position.y = 30;
    g.add(wheel);
    this.ferrisWheel = wheel;
    // At the end of Avenida del Sol (x = 30), on the pier.
    g.position.set(30, 0, hubZ);
    scene.add(g);
    // Pier deck under it.
    const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1.5, 40),
      new THREE.MeshLambertMaterial({ color: 0x9a7a5a }));
    pier.position.set(30, 0.75, hubZ + 8);
    scene.add(pier);
  }

  update(dt, t) {
    // Ferris wheel turns slowly; gondolas stay upright.
    if (this.ferrisWheel) {
      this.ferrisWheel.rotation.z = t * 0.05;
      for (const cab of this.ferrisGondolas) cab.rotation.z = -t * 0.05;
    }
    // Traffic lights cycle green -> amber -> red.
    for (const tl of this.trafficLights) {
      tl.timer -= dt;
      if (tl.timer <= 0) {
        tl.state = (tl.state + 1) % 3;
        tl.timer = tl.state === 1 ? 1.2 : 4;
        tl.lamp.material.color.setHex(tl.state === 0 ? 0x33ff66 : tl.state === 1 ? 0xffc233 : 0xff3333);
      }
    }
    // Palms sway gently.
    for (let i = 0; i < this.palms.length; i++) {
      this.palms[i].rotation.z = Math.sin(t * 0.8 + i) * 0.02;
    }
  }

  // True when point (x,z) is inside a building (with margin).
  hitsBuilding(x, z, margin = 0) {
    for (const c of this.colliders) {
      if (Math.abs(x - c.x) < c.halfX + margin && Math.abs(z - c.z) < c.halfZ + margin) return true;
    }
    return false;
  }

  // Nearest street name + district for a position, for the HUD.
  locationAt(x, z) {
    const xi = Math.round((x + CITY_HALF) / PITCH);
    const zi = Math.round((z + CITY_HALF) / PITCH);
    const street = AVENUES[Math.abs(xi) % AVENUES.length];
    const district = DISTRICTS[(Math.abs(xi) + Math.abs(zi) * 2) % DISTRICTS.length];
    return { street, district };
  }

  // A point on a street (used to spawn cars / missions).
  streetPoint(ix, iz, along = 0) {
    return {
      x: -CITY_HALF + ix * PITCH + along,
      z: -CITY_HALF + iz * PITCH,
    };
  }
}
