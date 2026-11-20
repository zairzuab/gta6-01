import * as THREE from 'three';
export const PITCH = 60;        // distance between parallel street centrelines
export const STREET_W = 14;     // street width (kerb to kerb)
export const BLOCK = 46;        // block width (PITCH - STREET_W)
export const GRID = 7;          // blocks per side
export const CITY_HALF = 210;   // half-extent of the street grid
export const AVENUES = ['Avenida del Puerto', 'Avenida de las Flores', 'Calle Mayor', 'Paseo del Mar', 'Avenida del Sol', 'Calle de los Olivos', 'Avenida Central'];
export const DISTRICTS = ['PLAYA LARGA', 'LAS PALMERAS', 'EL CENTRO', 'BARRIO ALTO', 'LA COLINA', 'PUERTO VIEJO', 'LOS JARDINES'];
const streetCoord = (i) => -CITY_HALF + i * PITCH;
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.min(255, Math.max(0, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function facadeTexture(base, seed) {
  const rnd = mulberry32(seed);
  const floors = 4 + Math.floor(rnd() * 4);   // 4..7 floors
  const cols = 4 + Math.floor(rnd() * 2);     // 4..5 window columns
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.14)'); grad.addColorStop(0.5, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,40,0.10)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const fh = h / floors, cw = w / cols;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.18, y = f * fh + fh * 0.2;
        const ww = cw * 0.64, wh = fh * 0.58;
        g.fillStyle = '#f4efe4'; g.fillRect(x - 3, y - 3, ww + 6, wh + 6);
        const gg = g.createLinearGradient(x, y, x + ww, y + wh);
        gg.addColorStop(0, '#2c4d6e'); gg.addColorStop(0.55, '#1d3550');
        gg.addColorStop(1, '#274b6d');
        g.fillStyle = gg; g.fillRect(x, y, ww, wh);
        if (rnd() < 0.16) { g.fillStyle = '#ffd98a'; g.fillRect(x, y, ww, wh); }
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath();
        g.moveTo(x + ww * 0.12, y + wh); g.lineTo(x + ww * 0.42, y); g.lineTo(x + ww * 0.58, y); g.lineTo(x + ww * 0.28, y + wh);
        g.closePath(); g.fill();
        g.fillStyle = '#e8e2d2';
        g.fillRect(x + ww / 2 - 1, y, 2, wh);
        g.fillRect(x, y + wh / 2 - 1, ww, 2);
      }
      g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, f * fh + fh - 2, w, 2);
    }
    g.fillStyle = shade(base, 0.72); g.fillRect(0, 0, w, 12);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 12, w, 3);
    if (rnd() < 0.45) {
      g.fillStyle = '#20262e'; g.fillRect(8, h - 64, w - 16, 56);
      const sg = g.createLinearGradient(0, h - 64, 0, h - 8);
      sg.addColorStop(0, '#3d6a8c'); sg.addColorStop(1, '#1c3247');
      g.fillStyle = sg; g.fillRect(12, h - 60, w - 24, 48);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(30, h - 58, 10, 44); g.fillRect(90, h - 58, 10, 44);
    }
  });
}

function awningTexture(c1, c2) {
  return canvasTex(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 === 0 ? c1 : c2; g.fillRect((i * w) / 8, 0, w / 8 + 1, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 6, w, 6);
  });
}

function asphaltTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#33363b'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7);
    for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.fillStyle = '#d8d8d2'; g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
    g.fillStyle = '#e8c832';
    for (let y = 0; y < h; y += 32) { g.fillRect(w / 2 - 6, y, 3, 18); g.fillRect(w / 2 + 3, y, 3, 18); }
  }, 1, 8);
}

function sidewalkTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#cfc4ae'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke();
    }
    const rnd = mulberry32(11);
    for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }, 12, 12);
}

function sandTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8d5a8'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(21);
    for (let i = 0; i < 500; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(120,90,40,0.15)'; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  }, 24, 24);
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const FACADE_BASES = ['#f7f2e6', '#f3e3cf', '#e8c9a8', '#dfe8ea', '#f2d7c9', '#e9dcc3'];
const AWNING_PAIRS = [['#e85d75', '#fdf6ec'], ['#d43d2a', '#fdf6ec'], ['#2a9d8f', '#fdf6ec'], ['#f4a261', '#fdf6ec']];
export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; this.palms = []; this.trafficLights = [];
    this.wheel = null; this.gondolas = [];
    this._skyAndLights();
    this._groundAndStreets();
    this._buildings();
    this._palms();
    this._props();
    this._ferrisWheel();
    this._seaAndSkyline();
  }

  // sky, sun, clouds, fog, lights
  _skyAndLights() {
    const skyTex = canvasTex(4, 512, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#5fb2e8'); grad.addColorStop(0.45, '#9fd4f2'); grad.addColorStop(0.72, '#fde9c8'); grad.addColorStop(1, '#ffe9b8');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    });
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(0xd8ecf7, 280, 750);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
    sun.position.set(190, 165, 380); sun.lookAt(0, 40, 0); this.scene.add(sun);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshBasicMaterial({ color: 0xfff8d0, transparent: true, opacity: 0.35, fog: false }));
    glow.position.copy(sun.position).multiplyScalar(1.001); glow.lookAt(0, 40, 0); this.scene.add(glow);
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
    const puff = new THREE.SphereGeometry(1, 10, 8);
    const cloudSpots = [[-160, 120, -260], [60, 140, -300], [220, 110, -180], [-240, 130, 120], [140, 125, 260], [-80, 150, 300]];
    for (const [cx, cy, cz] of cloudSpots) {
      const cloud = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(puff, cloudMat);
        p.position.set((i - n / 2) * 9 + Math.random() * 3, Math.random() * 2, Math.random() * 4);
        p.scale.set(9 + Math.random() * 5, 3.2, 5); cloud.add(p);
      }
      cloud.position.set(cx, cy, cz); this.scene.add(cloud);
    }
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0xe8c9a0, 0.75);
    this.scene.add(hemi);
    const sunLight = new THREE.DirectionalLight(0xffe7b8, 2.1);
    sunLight.position.set(120, 190, 140); sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc = sunLight.shadow.camera;
    sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 20; sc.far = 600;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
  }

  // ground, streets, sidewalks, crosswalks
  // Roads: one dark-asphalt strip per grid line. North-south streets use
  // a (STREET_W x roadLen) plane; east-west streets use the same plane
  // rotated 90 degrees about Z so the texture dashes stay along the road.
  _groundAndStreets() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, CITY_HALF * 2 + 40), new THREE.MeshLambertMaterial({ color: 0xd9cfba }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
    this.scene.add(ground);
    const asphaltTex = asphaltTexture();
    const asphaltMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
    const walkTex = sidewalkTexture();
    const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
    const roadLen = CITY_HALF * 2 + STREET_W;
    const roadGeo = new THREE.PlaneGeometry(STREET_W, roadLen);
    const walkGeo = new THREE.PlaneGeometry(5, roadLen);
    for (let i = 0; i <= GRID; i++) {
      const c = streetCoord(i);
      // North-south street (along z) at x = c.
      const ns = new THREE.Mesh(roadGeo, asphaltMat);
      ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0, 0); ns.receiveShadow = true; this.scene.add(ns);
      // East-west street (along x) at z = c: same plane, turned 90 degrees.
      const ew = new THREE.Mesh(roadGeo, asphaltMat);
      ew.rotation.x = -Math.PI / 2; ew.rotation.z = Math.PI / 2; ew.position.set(0, 0, c); ew.receiveShadow = true; this.scene.add(ew);
      // Sidewalks flanking each street (5 m wide, just outside the kerb).
      for (const side of [-1, 1]) {
        const off = side * (STREET_W / 2 + 2.5);
        const wns = new THREE.Mesh(walkGeo, walkMat);
        wns.rotation.x = -Math.PI / 2; wns.position.set(c + off, 0.02, 0); wns.receiveShadow = true; this.scene.add(wns);
        const wew = new THREE.Mesh(walkGeo, walkMat);
        wew.rotation.x = -Math.PI / 2; wew.rotation.z = Math.PI / 2; wew.position.set(0, 0.02, c + off); wew.receiveShadow = true; this.scene.add(wew);
      }
    }
    const zebraMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
    const stripeGeo = new THREE.BoxGeometry(0.9, 0.06, 3.4);
    for (let j = 0; j <= GRID; j++) {
      const z = streetCoord(j);
      for (let k = -5; k <= 5; k++) { const s = new THREE.Mesh(stripeGeo, zebraMat); s.position.set(30 + k * 1.5, 0.04, z); this.scene.add(s); }
    }
  }

  // buildings: facades, awnings, balconies, rooftop props
  _buildings() {
    const facadeMats = FACADE_BASES.map((base, i) => new THREE.MeshLambertMaterial({ map: facadeTexture(base, 100 + i * 37) }));
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a7f70 });
    const acMat = new THREE.MeshLambertMaterial({ color: 0xb9c0c4 });
    const tankMat = new THREE.MeshLambertMaterial({ color: 0x7a6a55 });
    const balconyMat = new THREE.MeshLambertMaterial({ color: 0xefe8d8 });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    const awningMats = AWNING_PAIRS.map(([a, b]) => new THREE.MeshLambertMaterial({ map: awningTexture(a, b), side: THREE.DoubleSide }));
    for (let bi = 0; bi < GRID; bi++) {
      for (let bj = 0; bj < GRID; bj++) {
        const rnd = mulberry32(bi * 131 + bj * 17 + 5);
        const cx = streetCoord(bi) + PITCH / 2;
        const cz = streetCoord(bj) + PITCH / 2;
        const centre = 1 - (Math.abs(cx) + Math.abs(cz)) / (CITY_HALF * 2);
        const count = rnd() < 0.45 ? 1 : rnd() < 0.8 ? 2 : 3;
        const facesAvenue = bi === 3 || bi === 4; // blocks flanking x=+30
        const avenueSide = bi === 3 ? 1 : -1;     // which face looks at the avenue
        for (let k = 0; k < count; k++) {
          const w = 16 + rnd() * 14;
          const d = 14 + rnd() * 12;
          const h = 11 + rnd() * 12 + centre * 26;
          const ox = count === 1 ? 0 : (k - (count - 1) / 2) * (BLOCK / count) * 0.9;
          const oz = (rnd() - 0.5) * 8;
          const x = cx + ox, z = cz + oz;
          const mat = facadeMats[Math.floor(rnd() * facadeMats.length)];
          const b = new THREE.Mesh(BOX, mat);
          b.scale.set(w, h, d);
          b.position.set(x, h / 2, z);
          b.castShadow = true; b.receiveShadow = true;
          this.scene.add(b);
          this.colliders.push({ x, z, halfX: w / 2, halfZ: d / 2 });
          const cap = new THREE.Mesh(BOX, roofMat);
          cap.scale.set(w + 0.6, 0.7, d + 0.6); cap.position.set(x, h + 0.35, z); this.scene.add(cap);
          if (rnd() < 0.7) {
            const ac = new THREE.Mesh(BOX, acMat); ac.scale.set(2.2, 1.1, 1.6);
            ac.position.set(x + (rnd() - 0.5) * (w - 4), h + 1.2, z + (rnd() - 0.5) * (d - 4)); this.scene.add(ac);
          }
          if (rnd() < 0.4) {
            const tank = new THREE.Mesh(CYL, tankMat); tank.scale.set(1.1, 2.2, 1.1);
            tank.position.set(x + (rnd() - 0.5) * (w - 4), h + 1.8, z + (rnd() - 0.5) * (d - 4)); this.scene.add(tank);
          }
          if (facesAvenue) {
            const faceX = x + avenueSide * (w / 2 + 0.15);
            // Sloped canopy box jutting out from the wall over the sidewalk:
            // 3 m deep, thin, striped on top, outer edge lower than the wall.
            const awn = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, d * 0.85), awningMats[Math.floor(rnd() * awningMats.length)]);
            awn.position.set(faceX + avenueSide * 1.3, 4.4, z);
            awn.rotation.z = -avenueSide * 0.3;
            awn.castShadow = true;
            this.scene.add(awn);
            const balconies = Math.floor(h / 9);
            for (let f = 0; f < balconies; f++) {
              const by = 8.5 + f * 8;
              if (by > h - 3) break;
              const slab = new THREE.Mesh(BOX, balconyMat);
              slab.scale.set(1.4, 0.35, 5); slab.position.set(faceX + avenueSide * 0.7, by, z + (rnd() - 0.5) * (d - 8));
              slab.castShadow = true; this.scene.add(slab);
              const rail = new THREE.Mesh(BOX, railMat);
              rail.scale.set(0.12, 1.0, 5); rail.position.set(faceX + avenueSide * 1.35, by + 0.65, slab.position.z); this.scene.add(rail);
            }
          }
        }
      }
    }
  }

  // palms along Avenida del Sol + block corners
  _palms() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d, side: THREE.DoubleSide });
    const frondMat2 = new THREE.MeshLambertMaterial({ color: 0x57b25e, side: THREE.DoubleSide });
    const nutMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 1, 7);
    const frondGeo = new THREE.PlaneGeometry(0.85, 4.6, 1, 3);
    const pos = frondGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, -Math.pow((y + 2.3) / 4.6, 2) * 1.1); }
    frondGeo.computeVertexNormals();
    const nutGeo = new THREE.SphereGeometry(0.32, 8, 6);
    const makePalm = (x, z, height, phase) => {
      const palm = new THREE.Group();
      const lean = (Math.random() - 0.5) * 0.12;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.scale.y = height; trunk.position.y = height / 2; trunk.rotation.z = lean; trunk.castShadow = true;
      palm.add(trunk);
      const crown = new THREE.Group();
      crown.position.set(Math.sin(lean) * height * -0.5 + lean * height, height, 0);
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(frondGeo, i % 2 ? frondMat : frondMat2);
        f.rotation.y = (i / 6) * Math.PI * 2; f.rotation.x = -0.9; f.position.y = 0.4; f.translateY(2.0); crown.add(f);
      }
      for (let i = 0; i < 8; i++) {
        const f = new THREE.Mesh(frondGeo, i % 2 ? frondMat2 : frondMat);
        f.rotation.y = (i / 8) * Math.PI * 2 + 0.4; f.rotation.x = 0.55; f.position.y = 0.1; f.translateY(2.0); crown.add(f);
      }
      for (let i = 0; i < 3; i++) { const nut = new THREE.Mesh(nutGeo, nutMat); nut.position.set(Math.cos(i * 2.1) * 0.5, -0.4, Math.sin(i * 2.1) * 0.5); crown.add(nut); }
      palm.add(crown);
      palm.position.set(x, 0, z);
      palm.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(palm);
      this.palms.push({ crown, phase });
    };
    for (let z = -CITY_HALF + 8; z <= CITY_HALF - 8; z += 15) {
      makePalm(30 - 10.5, z + 3, 8 + Math.random() * 2.5, z * 0.13);
      makePalm(30 + 10.5, z - 4, 8 + Math.random() * 2.5, z * 0.13 + 2);
    }
    for (let j = 0; j <= GRID; j++) {
      const z = streetCoord(j);
      makePalm(30 - 10.5, z + 10, 7.5, j);
      makePalm(30 + 10.5, z - 10, 7.5, j + 3);
    }
  }

  // street lamps + traffic lights
  _props() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3438 });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8);
    const headGeo = new THREE.SphereGeometry(0.3, 10, 8);
    for (let z = -CITY_HALF + 15; z <= CITY_HALF - 15; z += 30) {
      for (const side of [-1, 1]) {
        const x = 30 + side * 9.5;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 3.25, z); pole.castShadow = true; this.scene.add(pole);
        const arm = new THREE.Mesh(BOX, poleMat); arm.scale.set(1.6, 0.12, 0.12); arm.position.set(x - side * 0.8, 6.4, z); this.scene.add(arm);
        const head = new THREE.Mesh(headGeo, lampMat); head.position.set(x - side * 1.6, 6.3, z); this.scene.add(head);
      }
    }
    const headMat = new THREE.MeshLambertMaterial({ color: 0x22262a });
    const lampGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const mkLamp = (color) => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.15 });
    for (const ix of [3, 4]) {
      for (const iz of [3, 4]) {
        const x = streetCoord(ix) + STREET_W / 2 + 1.2;
        const z = streetCoord(iz) + STREET_W / 2 + 1.2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8), poleMat);
        pole.position.set(x, 2.7, z); pole.castShadow = true; this.scene.add(pole);
        const head = new THREE.Mesh(BOX, headMat); head.scale.set(0.7, 1.9, 0.7); head.position.set(x, 5.6, z); this.scene.add(head);
        const red = new THREE.Mesh(lampGeo, mkLamp(0xff2a22));
        const amber = new THREE.Mesh(lampGeo, mkLamp(0xffb020));
        const green = new THREE.Mesh(lampGeo, mkLamp(0x2aff66));
        red.position.set(x, 6.15, z + 0.36); amber.position.set(x, 5.6, z + 0.36); green.position.set(x, 5.05, z + 0.36);
        this.scene.add(red, amber, green);
        this.trafficLights.push({ red, amber, green, offset: (ix + iz * 2) * 3.1 });
      }
    }
  }

  // Ferris wheel on the pier at (30, CITY_HALF + 26)
  _ferrisWheel() {
    const px = 30, pz = CITY_HALF + 26; // (30, 236)
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x9a7b52 });
    const deck = new THREE.Mesh(BOX, deckMat);
    deck.scale.set(46, 1.2, 30); deck.position.set(px, 0.6, pz); deck.receiveShadow = true; this.scene.add(deck);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x6b5233 });
    for (const dx of [-20, -10, 0, 10, 20]) {
      for (const dz of [-13, 13]) { const post = new THREE.Mesh(CYL, postMat); post.scale.set(0.5, 3, 0.5); post.position.set(px + dx, -0.8, pz + dz); this.scene.add(post); }
    }
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xff5d8f, emissive: 0x881133, emissiveIntensity: 0.25 });
    const innerMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x7a5a00, emissiveIntensity: 0.25 });
    const spokeMat = new THREE.MeshLambertMaterial({ color: 0xfdf6ec });
    const hubMat = new THREE.MeshLambertMaterial({ color: 0xff5d8f });
    const legGeo = new THREE.CylinderGeometry(0.35, 0.5, 30, 8);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, spokeMat);
      leg.position.set(px + side * 5.5, 15, pz); leg.rotation.z = side * 0.32; leg.castShadow = true; this.scene.add(leg);
    }
    const wheel = new THREE.Group();
    wheel.position.set(px, 27, pz);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(17, 0.55, 10, 48), rimMat));
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(11, 0.35, 8, 40), innerMat));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 16), hubMat);
    hub.rotation.x = Math.PI / 2; wheel.add(hub);
    const spokeGeo = new THREE.CylinderGeometry(0.16, 0.16, 17, 6);
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(spokeGeo, spokeMat); sp.rotation.z = (i / 8) * Math.PI; wheel.add(sp); }
    const cabinColors = [0xff5d8f, 0xffd23f, 0x2ec4b6, 0x4d96ff, 0xff7b2f, 0x9b5de5];
    const cabinGeo = new THREE.BoxGeometry(2.6, 2.2, 2.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshLambertMaterial({ color: cabinColors[i % cabinColors.length] }));
      cabin.position.set(Math.cos(a) * 17, Math.sin(a) * 17, 0); cabin.castShadow = true;
      wheel.add(cabin); this.gondolas.push(cabin);
    }
    this.scene.add(wheel);
    this.wheel = wheel;
    const booth = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: 0xfdf6ec }));
    booth.scale.set(5, 3.2, 4); booth.position.set(px - 15, 2.8, pz - 10); booth.castShadow = true; this.scene.add(booth);
    const boothRoof = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: 0xff5d8f }));
    boothRoof.scale.set(5.6, 0.4, 4.6); boothRoof.position.set(px - 15, 4.6, pz - 10); this.scene.add(boothRoof);
    this.colliders.push({ x: px - 15, z: pz - 10, halfX: 2.5, halfZ: 2 });
  }

  // sand beach, sea, distant skyline silhouettes
  _seaAndSkyline() {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 120, 60), new THREE.MeshLambertMaterial({ map: sandTexture() }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.01, CITY_HALF + 30); sand.receiveShadow = true; this.scene.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 260), new THREE.MeshLambertMaterial({ color: 0x2f8fc4 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.2, CITY_HALF + 190); this.scene.add(sea);
    const waveMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 4; i++) {
      const wave = new THREE.Mesh(new THREE.PlaneGeometry(500, 1.2), waveMat);
      wave.rotation.x = -Math.PI / 2; wave.position.set(0, 0.02, CITY_HALF + 58 + i * 7); this.scene.add(wave);
    }
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x8fa8bd });
    const towerMat2 = new THREE.MeshLambertMaterial({ color: 0x7d99b0 });
    const rnd = mulberry32(99);
    for (let i = 0; i < 14; i++) {
      const w = 18 + rnd() * 22, h = 45 + rnd() * 90;
      const t = new THREE.Mesh(BOX, i % 2 ? towerMat : towerMat2);
      t.scale.set(w, h, w);
      const a = (i / 14) * Math.PI * 2, r = 330 + rnd() * 60;
      t.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); this.scene.add(t);
    }
  }

  // animation: wheel, traffic lights, palm sway
  update(dt, t) {
    if (this.wheel) {
      this.wheel.rotation.z -= dt * 0.12;
      for (const g of this.gondolas) g.rotation.z = -this.wheel.rotation.z;
    }
    const CYCLE = 12;
    for (const tl of this.trafficLights) {
      const ph = ((t + tl.offset) % CYCLE + CYCLE) % CYCLE;
      const on = (m, lit) => { m.material.emissiveIntensity = lit ? 1.6 : 0.12; };
      on(tl.green, ph < 5); on(tl.amber, ph >= 5 && ph < 6.5); on(tl.red, ph >= 6.5);
    }
    for (const p of this.palms) { p.crown.rotation.z = Math.sin(t * 0.8 + p.phase) * 0.035; p.crown.rotation.x = Math.cos(t * 0.6 + p.phase) * 0.02; }
  }

  // collision query against building AABBs
  hitsBuilding(x, z, margin = 0) {
    for (const c of this.colliders) {
      if (Math.abs(x - c.x) < c.halfX + margin && Math.abs(z - c.z) < c.halfZ + margin) return true;
    }
    return false;
  }

  // street + district at a point
  locationAt(x, z) {
    let street = null;
    let best = Infinity;
    for (let i = 0; i <= GRID; i++) {
      const dx = Math.abs(x - streetCoord(i));
      const dz = Math.abs(z - streetCoord(i));
      if (dx < STREET_W / 2 + 1 && dx < best) { best = dx; street = AVENUES[i]; }
      if (dz < STREET_W / 2 + 1 && dz < best) { best = dz; street = AVENUES[i]; }
    }
    let district;
    if (z > CITY_HALF - 20) district = 'PLAYA LARGA';
    else if (Math.abs(x - 30) < 45) district = z > -20 ? 'PLAYA LARGA' : 'LAS PALMERAS';
    else {
      const ix = Math.min(GRID - 1, Math.max(0, Math.floor((x + CITY_HALF) / PITCH)));
      const iz = Math.min(GRID - 1, Math.max(0, Math.floor((z + CITY_HALF) / PITCH)));
      district = DISTRICTS[(ix * 3 + iz) % DISTRICTS.length];
    }
    return { street: street || 'Calle Mayor', district };
  }
  streetPoint(ix, iz, along = 0) { return { x: streetCoord(ix), z: streetCoord(iz) + along }; }
}
