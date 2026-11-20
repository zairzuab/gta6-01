// Traffic: cars that cruise the streets and pedestrians that walk the
// sidewalks. Both are simple, cheap, and give the city life.
import * as THREE from 'three';
import { makeCar, makePerson } from './vehicles.js';
import { CITY_HALF, PITCH, STREET_W } from './city.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0xd84ad8, 0xffffff, 0x333333, 0xff8c42];

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = []; // {mesh, x, z, heading, speed, lane, axis, dir, targetSpeed}
    this.peds = []; // {mesh, x, z, heading, speed, walkPhase, sidewalk}
    this.spawnCars(14);
    this.spawnPeds(26);
    this.spawnAvenuePeds(12);
  }

  // Pedestrians strolling the sidewalks of Avenida del Sol itself, so the
  // main avenue feels busy in chase shots.
  spawnAvenuePeds(n) {
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = 30 + side * (STREET_W / 2 + 2 + Math.random() * 3);
      const z = -CITY_HALF + 20 + Math.random() * (2 * CITY_HALF - 40);
      const mesh = makePerson(SHIRTS[(i + 3) % SHIRTS.length]);
      mesh.position.set(x, 0, z);
      const heading = Math.random() < 0.5 ? 0 : Math.PI; // walk along the avenue
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.peds.push({
        mesh, x, z, heading,
        speed: 1.1 + Math.random() * 0.7, walkPhase: Math.random() * 6,
        panic: 0,
      });
    }
  }

  randomStreetPoint() {
    const i = 1 + Math.floor(Math.random() * 6);
    const j = 1 + Math.floor(Math.random() * 6);
    const along = (Math.random() - 0.5) * (PITCH - STREET_W);
    if (Math.random() < 0.5) {
      return { x: -CITY_HALF + i * PITCH, z: -CITY_HALF + j * PITCH + along, axis: 'z', dir: Math.random() < 0.5 ? 1 : -1 };
    }
    return { x: -CITY_HALF + i * PITCH + along, z: -CITY_HALF + j * PITCH, axis: 'x', dir: Math.random() < 0.5 ? 1 : -1 };
  }

  spawnCars(n) {
    for (let i = 0; i < n; i++) {
      const p = this.randomStreetPoint();
      const kind = Math.random() < 0.12 ? 'taxi' : 'traffic';
      const mesh = makeCar(kind, i);
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = p.axis === 'z' ? (p.dir > 0 ? Math.PI : 0) : (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.scene.add(mesh);
      this.cars.push({
        mesh, x: p.x, z: p.z, axis: p.axis, dir: p.dir,
        speed: 7 + Math.random() * 5, targetSpeed: 8 + Math.random() * 5,
        heading: mesh.rotation.y, scared: 0,
      });
    }
  }

  spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const p = this.randomStreetPoint();
      const mesh = makePerson(SHIRTS[i % SHIRTS.length]);
      const sx = p.axis === 'z' ? p.x + (Math.random() < 0.5 ? -9 : 9) : p.x;
      const sz = p.axis === 'x' ? p.z + (Math.random() < 0.5 ? -9 : 9) : p.z;
      mesh.position.set(sx, 0, sz);
      const heading = Math.random() * Math.PI * 2;
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.peds.push({
        mesh, x: sx, z: sz, heading,
        speed: 1.1 + Math.random() * 0.7, walkPhase: Math.random() * 6,
        panic: 0,
      });
    }
  }

  // Find the nearest drivable traffic car to a point (for stealing).
  nearestCar(x, z, maxDist = 6) {
    let best = null; let bestD = maxDist;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // A traffic car is removed from traffic and handed to the player.
  steal(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    return car.mesh;
  }

  // When the player causes chaos nearby, pedestrians panic and run.
  panicNear(x, z, radius = 26) {
    for (const p of this.peds) {
      if (Math.hypot(p.x - x, p.z - z) < radius) p.panic = 3 + Math.random() * 2;
    }
    for (const c of this.cars) {
      if (Math.hypot(c.x - x, c.z - z) < radius) c.scared = 2;
    }
  }

  update(dt, playerPos, policeNear) {
    // --- Traffic cars ---------------------------------------------------
    for (const c of this.cars) {
      // Slow down if the player (in a car) is right ahead.
      let want = c.targetSpeed;
      if (policeNear) want = Math.min(want, 16);
      if (c.scared > 0) { want = 14; c.scared -= dt; }
      c.speed += (want - c.speed) * Math.min(1, dt * 1.5);
      if (c.axis === 'z') {
        c.z += c.dir * c.speed * dt;
        if (c.z > CITY_HALF + 10) { c.z = -CITY_HALF - 10; }
        if (c.z < -CITY_HALF - 10) { c.z = CITY_HALF + 10; }
      } else {
        c.x += c.dir * c.speed * dt;
        if (c.x > CITY_HALF + 10) { c.x = -CITY_HALF - 10; }
        if (c.x < -CITY_HALF - 10) { c.x = CITY_HALF + 10; }
      }
      // Keep the car on its street line (no turning at intersections, by
      // design: the grid gives the impression of flow, cheaply).
      // Car front is local -z, so rotation.y = atan2(-dx, -dz) of travel.
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.axis === 'z' ? (c.dir > 0 ? Math.PI : 0) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      // Wheel spin.
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.2;
    }
    // --- Pedestrians ----------------------------------------------------
    for (const p of this.peds) {
      const speed = p.panic > 0 ? 3.4 : p.speed;
      if (p.panic > 0) p.panic -= dt;
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      // Bounce off city bounds and buildings; wander a little.
      if (Math.abs(p.x) > CITY_HALF + 6 || Math.abs(p.z) > CITY_HALF + 6 || this.city.hitsBuilding(p.x, p.z, 1)) {
        p.heading += Math.PI / 2 + (Math.random() - 0.5);
      }
      if (Math.random() < dt * 0.08) p.heading += (Math.random() - 0.5) * 1.2;
      p.walkPhase += speed * dt * 4;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.mesh.userData.legs[0].rotation.x = swing;
      p.mesh.userData.legs[1].rotation.x = -swing;
      p.mesh.userData.arms[0].rotation.x = -swing * 0.7;
      p.mesh.userData.arms[1].rotation.x = swing * 0.7;
    }
  }
}
