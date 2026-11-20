// Police: the wanted system and the Solmar PD response.
// Wanted 0-5 stars. Cruisers chase and PIT; at 2+ stars roadblocks with
// spike strips appear ahead of the player; at 3+ a helicopter circles
// overhead; at 5 a tank rolls in. Heat fades when the player stays out of
// sight — "lose the heat" is how missions are won.
import * as THREE from 'three';
import { makeCar, makeHelicopter, makeTank } from './vehicles.js';
import { CITY_HALF, PITCH } from './city.js';

const CALLSIGNS = ['HALCON-1', 'LIMA-13', 'LIMA-21', 'BRAVO-6', 'LIMA-24', 'HALCON-2', 'BRAVO-9', 'LIMA-31'];

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.heat = 0; // 0..100, drives the star count
    this.hiddenTimer = 0; // seconds the player has been out of sight
    this.cruisers = []; // {mesh, x, z, heading, speed, state, callsign, pitTimer, stuck}
    this.heli = null; // {mesh, angle, height}
    this.tank = null; // {mesh, x, z, heading, speed}
    this.roadblock = null; // {meshes, spikes, x, z, heading, active}
    this.spawnTimer = 0;
    this.roadblockTimer = 8;
    this.lightPhase = 0;
    this.bustedTimer = 0;
  }

  stars() { return this.wanted; }

  addHeat(n, reason) {
    this.heat = Math.min(100, this.heat + n);
    this.hiddenTimer = 0;
    const want = this.heat <= 0 ? 0 : this.heat < 20 ? 1 : this.heat < 40 ? 2 : this.heat < 60 ? 3 : this.heat < 85 ? 4 : 5;
    if (want > this.wanted) {
      this.wanted = want;
      return { raised: true, to: want, reason };
    }
    return { raised: false, to: this.wanted };
  }

  clearHeat() { this.heat = 0; this.wanted = 0; }

  // Where to spawn a cruiser: on a street, off-screen from the player.
  spawnPoint(playerX, playerZ) {
    for (let tries = 0; tries < 12; tries++) {
      const i = 1 + Math.floor(Math.random() * 6);
      const j = 1 + Math.floor(Math.random() * 6);
      const x = -CITY_HALF + i * PITCH;
      const z = -CITY_HALF + j * PITCH;
      if (Math.hypot(x - playerX, z - playerZ) > 70) return { x, z };
    }
    return { x: playerX + 90, z: playerZ };
  }

  spawnCruiser(px, pz, at = null) {
    const p = at || this.spawnPoint(px, pz);
    const mesh = makeCar('police');
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    const c = {
      mesh, x: p.x, z: p.z, heading: Math.atan2(-(px - p.x), -(pz - p.z)),
      speed: 0, state: 'chase', callsign: CALLSIGNS[this.cruisers.length % CALLSIGNS.length],
      pitTimer: 0, stuck: 0, ramCooldown: 0,
    };
    this.cruisers.push(c);
    return c;
  }

  spawnHelicopter(px, pz) {
    if (this.heli) return;
    const mesh = makeHelicopter();
    // Scaled up 1.35x and on a low, close orbit (r 36, height 17) so the
    // helicopter dominates the top of the frame like in the reference.
    mesh.scale.setScalar(1.35);
    // Start ahead of the player (in the chase camera's view), on a wide
    // low orbit that keeps the helicopter inside the frame.
    mesh.position.set(px, 17, pz + 36);
    this.scene.add(mesh);
    // Searchlight pool on the street under the helicopter.
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(px, 0.06, pz + 40);
    this.scene.add(pool);
    this.heli = { mesh, angle: Math.PI / 2, height: 17, pool };
  }

  spawnTank(px, pz, at = null) {
    if (this.tank) return;
    const mesh = makeTank();
    const p = at || this.spawnPoint(px, pz);
    mesh.position.set(p.x, 0, p.z);
    this.scene.add(mesh);
    this.tank = { mesh, x: p.x, z: p.z, heading: 0, speed: 0 };
  }

  removeHelicopter() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    if (this.heli.pool) this.scene.remove(this.heli.pool);
    this.heli = null;
  }

  removeTank() {
    if (!this.tank) return;
    this.scene.remove(this.tank.mesh);
    this.tank = null;
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    for (const m of this.roadblock.meshes) this.scene.remove(m);
    this.roadblock = null;
  }

  // A roadblock: two cruisers parked across the street ahead of the player
  // plus a spike strip between them.
  placeRoadblock(px, pz, heading) {
    this.clearRoadblock();
    const ahead = 55;
    const bx = px + Math.sin(heading) * ahead;
    const bz = pz + Math.cos(heading) * ahead;
    const meshes = [];
    const perp = heading + Math.PI / 2;
    for (const s of [-4.5, 4.5]) {
      const car = makeCar('police');
      car.position.set(bx + Math.sin(perp) * s, 0, bz + Math.cos(perp) * s);
      car.rotation.y = perp;
      this.scene.add(car);
      meshes.push(car);
    }
    // Spike strip: a dark strip with metal teeth across the lane.
    const strip = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 1.1),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    strip.add(base);
    for (let i = -4; i <= 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4),
        new THREE.MeshLambertMaterial({ color: 0xcccccc }));
      spike.position.set(i, 0.3, 0);
      strip.add(spike);
    }
    strip.position.set(bx, 0.1, bz);
    strip.rotation.y = perp;
    this.scene.add(strip);
    meshes.push(strip);
    this.roadblock = { meshes, x: bx, z: bz, heading: perp, active: true, strip };
  }

  // Player ran over the spike strip: returns true when it should pop tires.
  checkSpikes(x, z) {
    if (!this.roadblock || !this.roadblock.active) return false;
    const d = Math.hypot(x - this.roadblock.x, z - this.roadblock.z);
    if (d < 5.5) {
      this.roadblock.active = false;
      return true;
    }
    return false;
  }

  update(dt, player, onFoot) {
    const px = player.x, pz = player.z;
    const pSpeed = Math.abs(player.speed || 0);
    this.lightPhase += dt;

    // --- Wanted decay: out of sight, heat fades ------------------------
    const nearest = this.nearestPoliceDist(px, pz);
    const inSight = nearest < 55 || this.wanted >= 3; // helicopter keeps eyes on you
    if (this.wanted > 0 && !inSight && pSpeed < 12) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 6) {
        this.heat = Math.max(0, this.heat - dt * 7);
        const want = this.heat <= 0 ? 0 : this.heat < 20 ? 1 : this.heat < 40 ? 2 : this.heat < 60 ? 3 : this.heat < 85 ? 4 : 5;
        if (want < this.wanted) this.wanted = want;
      }
    } else {
      this.hiddenTimer = 0;
    }

    // --- Spawn / despawn by wanted level --------------------------------
    const wantCruisers = this.wanted === 0 ? 0 : Math.min(2 + this.wanted, 6);
    this.spawnTimer -= dt;
    if (this.cruisers.length < wantCruisers && this.spawnTimer <= 0) {
      this.spawnCruiser(px, pz);
      this.spawnTimer = 2.5;
    }
    if (this.wanted === 0) {
      for (const c of this.cruisers) this.scene.remove(c.mesh);
      this.cruisers = [];
      this.removeHelicopter();
      this.removeTank();
      this.clearRoadblock();
    }
    if (this.wanted >= 3) this.spawnHelicopter(px, pz); else this.removeHelicopter();
    if (this.wanted >= 5) this.spawnTank(px, pz); else this.removeTank();

    // --- Roadblocks at 2+ stars -----------------------------------------
    this.roadblockTimer -= dt;
    if (this.wanted >= 2 && this.roadblockTimer <= 0 && !this.roadblock) {
      this.placeRoadblock(px, pz, player.heading);
      this.roadblockTimer = 16;
    }
    if (this.roadblock && Math.hypot(px - this.roadblock.x, pz - this.roadblock.z) > 120) {
      this.clearRoadblock();
      this.roadblockTimer = 6;
    }

    // --- Cruiser AI: chase, PIT, box-in ---------------------------------
    for (const c of this.cruisers) {
      const dx = px - c.x, dz = pz - c.z;
      const dist = Math.hypot(dx, dz);
      // Forward is (-sin h, -cos h): to face the player, h = atan2(-dx, -dz).
      const targetHeading = Math.atan2(-dx, -dz);
      let turn = targetHeading - c.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      // PIT: when alongside and fast, swerve into the player's flank.
      if (dist < 9 && Math.abs(turn) < 0.5 && pSpeed > 8 && c.ramCooldown <= 0) {
        c.state = 'pit';
        c.pitTimer = 0.9;
        c.ramCooldown = 4;
      }
      if (c.state === 'pit') {
        c.pitTimer -= dt;
        turn += (dx > 0 ? 1 : -1) * 0.6;
        if (c.pitTimer <= 0) c.state = 'chase';
      }
      c.ramCooldown -= dt;
      // Box-in: two cruisers ahead slow down to trap the player.
      const topSpeed = c.state === 'pit' ? 46 : 38;
      const wantSpeed = dist > 60 ? topSpeed : Math.min(topSpeed, 18 + dist * 0.45);
      c.speed += (wantSpeed - c.speed) * Math.min(1, dt * 1.2);
      c.heading += THREE.MathUtils.clamp(turn, -1.9 * dt, 1.9 * dt);
      // Forward is (-sin heading, -cos heading), matching the car model.
      c.x -= Math.sin(c.heading) * c.speed * dt;
      c.z -= Math.cos(c.heading) * c.speed * dt;
      // Keep cruisers out of buildings (slide along).
      if (this.city.hitsBuilding(c.x, c.z, 1.5)) {
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        c.heading += 0.9 * dt * 4;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.2;
      // Flash the light bar red/blue.
      const lb = c.mesh.userData.lightBar;
      if (lb) {
        const on = Math.floor(this.lightPhase * 6) % 2 === 0;
        lb.userData.red.material.emissiveIntensity = on ? 2.5 : 0.2;
        lb.userData.blue.material.emissiveIntensity = on ? 0.2 : 2.5;
      }
      // Ram the player: close + fast = a hit (handled by main via dist).
      c.dist = dist;
    }

    // --- Helicopter: circle above the player, spotlight -----------------
    // Low close orbit (r 36, height 17): the helicopter stays inside the
    // chase camera's frame and dominates the top of it.
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.35;
      const r = 36;
      h.mesh.position.set(
        px + Math.cos(h.angle) * r,
        h.height + Math.sin(h.angle * 0.7) * 3,
        pz + Math.sin(h.angle) * r);
      h.mesh.rotation.y = Math.atan2(px - h.mesh.position.x, pz - h.mesh.position.z);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.mesh.userData.tailRotor.rotation.x += dt * 18;
      // Red anti-collision beacon flashes.
      const bc = h.mesh.userData.beacon;
      if (bc) bc.material.emissiveIntensity = (Math.floor(this.lightPhase * 3) % 2 === 0) ? 3 : 0.25;
      // Searchlight pool follows the helicopter on the street.
      if (h.pool) h.pool.position.set(h.mesh.position.x, 0.06, h.mesh.position.z);
    }

    // --- Tank: slow, heavy, rams ----------------------------------------
    if (this.tank) {
      const t = this.tank;
      const dx = px - t.x, dz = pz - t.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(-dx, -dz);
      let turn = targetHeading - t.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      t.heading += THREE.MathUtils.clamp(turn, -0.7 * dt, 0.7 * dt);
      t.speed += (Math.min(11, dist * 0.3) - t.speed) * Math.min(1, dt);
      t.x -= Math.sin(t.heading) * t.speed * dt;
      t.z -= Math.cos(t.heading) * t.speed * dt;
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = t.heading;
      t.dist = dist;
      // Turret tracks the player (barrel points along local -z = forward).
      t.mesh.userData.turret.rotation.y = THREE.MathUtils.clamp(
        Math.atan2(-dx, -dz) - t.heading, -0.9, 0.9);
    }
  }

  nearestPoliceDist(px, pz) {
    let d = Infinity;
    for (const c of this.cruisers) d = Math.min(d, Math.hypot(c.x - px, c.z - pz));
    if (this.tank) d = Math.min(d, Math.hypot(this.tank.x - px, this.tank.z - pz));
    return d;
  }

  // Dispatch list for the HUD: callsign, type, distance, status.
  dispatchList(px, pz) {
    const list = [];
    for (const c of this.cruisers) {
      list.push({
        call: c.callsign, kind: 'CRUISER',
        dist: Math.round(Math.hypot(c.x - px, c.z - pz)),
        status: c.state === 'pit' ? 'PIT MANEUVER' : (c.dist < 12 ? 'BOX IN' : 'PURSUIT'),
        cls: c.state === 'pit' ? 'pit' : (c.dist < 12 ? 'box' : 'pursuit'),
      });
    }
    if (this.heli) list.push({ call: 'HALCON-1', kind: 'AIR', dist: 36, status: 'OVERHEAD', cls: 'air' });
    if (this.tank) list.push({ call: 'BRAVO-6', kind: 'TANK', dist: Math.round(this.tank.dist || 0), status: 'PURSUIT', cls: 'pursuit' });
    return list.slice(0, 5);
  }
}
