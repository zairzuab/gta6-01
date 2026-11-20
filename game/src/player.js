// Player: Dante Vega on foot and behind the wheel. Arcade car physics
// (accelerate, brake, steer, handbrake, collisions) and a simple on-foot
// walker with a third-person camera. Health, armour and pickups live here.
import * as THREE from 'three';
import { makeCar, makePerson } from './vehicles.js';

export class Player {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.x = 0; this.z = 20;
    this.heading = 0; // radians, 0 = +z (south down the avenue)
    this.speed = 0; // m/s, signed (negative = reversing)
    this.inCar = false;
    this.car = null; // THREE.Group of the driven car
    this.carName = 'CORSA BRISA GT';
    this.topSpeed = 42;
    this.enginePct = 93;
    this.health = 86;
    this.armour = 64;
    this.tiresPopped = false;
    this.collisionCooldown = 0;
    this.walkSpeed = 6;
    this.camYaw = 0; // on-foot camera yaw (mouse drag / arrows)
    // The on-foot body.
    this.body = makePerson(0x2ea88a, 0x2a3a55);
    this.body.position.set(this.x, 0, this.z);
    scene.add(this.body);
    this.walkPhase = 0;
    this.onFoot = true;
  }

  spawnCar(x, z, heading) {
    const car = makeCar('player');
    car.position.set(x, 0, z);
    car.rotation.y = heading;
    this.scene.add(car);
    this.car = car;
    this.carName = car.userData.name;
    this.topSpeed = car.userData.topSpeed;
    this.x = x; this.z = z; this.heading = heading;
    this.enterCar();
    return car;
  }

  enterCar() {
    this.inCar = true;
    this.onFoot = false;
    this.body.visible = false;
    if (this.car) {
      this.x = this.car.position.x;
      this.z = this.car.position.z;
      this.heading = this.car.rotation.y;
      this.speed = 0;
    }
  }

  exitCar() {
    if (!this.car) return;
    this.inCar = false;
    this.onFoot = true;
    this.body.visible = true;
    // Step out to the driver's side.
    const sx = this.x + Math.cos(this.heading) * 2.2;
    const sz = this.z - Math.sin(this.heading) * 2.2;
    this.x = sx; this.z = sz;
    this.body.position.set(sx, 0, sz);
    this.body.rotation.y = this.heading;
    this.speed = 0;
  }

  // Take over a traffic car mesh (stealing). Returns the car group.
  takeCar(mesh) {
    if (this.car) this.scene.remove(this.car);
    this.car = mesh;
    this.carName = mesh.userData.name || 'STOLEN RIDE';
    this.topSpeed = mesh.userData.topSpeed || 30;
    this.x = mesh.position.x;
    this.z = mesh.position.z;
    this.heading = mesh.rotation.y;
    this.speed = 0;
    this.tiresPopped = false;
    this.enterCar();
    return mesh;
  }

  damage(amount, cause) {
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, amount * 0.6);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    return this.health <= 0;
  }

  heal(n) { this.health = Math.min(100, this.health + n); }
  addArmour(n) { this.armour = Math.min(100, this.armour + n); }

  update(dt, input, traffic) {
    this.collisionCooldown -= dt;
    if (this.inCar) this.updateDriving(dt, input, traffic);
    else this.updateWalking(dt, input);
  }

  updateDriving(dt, input, traffic) {
    const accel = 22;
    const brake = 34;
    const maxSpeed = this.tiresPopped ? this.topSpeed * 0.45 : this.topSpeed;
    const maxReverse = 12;
    const forward = input.down('KeyW') || input.down('ArrowUp');
    const back = input.down('KeyS') || input.down('ArrowDown');
    const handbrake = input.down('Space');
    if (forward) this.speed += accel * dt;
    if (back) {
      if (this.speed > 0.5) this.speed -= brake * dt;
      else this.speed -= accel * 0.6 * dt;
    }
    if (!forward && !back) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    if (handbrake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 30 * dt);
    }
    this.speed = THREE.MathUtils.clamp(this.speed, -maxReverse, maxSpeed);
    // Steering: stronger at low speed, inverted when reversing.
    const steerInput = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0) -
      (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
    const steerAuthority = 1.6 * Math.min(1, Math.abs(this.speed) / 10 + 0.25) * (handbrake ? 1.7 : 1);
    const dirSign = this.speed >= 0 ? 1 : -1;
    this.heading += steerInput * steerAuthority * dirSign * dt * Math.min(1, Math.abs(this.speed) / 6 + 0.15);
    const nx = this.x - Math.sin(this.heading) * this.speed * dt;
    const nz = this.z - Math.cos(this.heading) * this.speed * dt;
    // Building collision: slide along the wall, lose speed, take damage.
    if (this.city.hitsBuilding(nx, nz, 1.4)) {
      const hitX = this.city.hitsBuilding(nx, this.z, 1.4);
      const hitZ = this.city.hitsBuilding(this.x, nz, 1.4);
      if (!hitX) { this.x = nx; }
      if (!hitZ) { this.z = nz; }
      if (Math.abs(this.speed) > 10 && this.collisionCooldown <= 0) {
        this.collisionCooldown = 0.6;
        this.damage(Math.abs(this.speed) * 0.5, 'crash');
        this.speed *= 0.35;
        return { crashed: true, hard: Math.abs(this.speed) > 14 };
      }
      this.speed *= 0.55;
    } else {
      this.x = nx; this.z = nz;
    }
    // Bump into traffic cars: slow both, small damage.
    if (traffic) {
      for (const c of traffic.cars) {
        const d = Math.hypot(c.x - this.x, c.z - this.z);
        if (d < 3.4 && Math.abs(this.speed) > 4) {
          c.scared = 2;
          if (this.collisionCooldown <= 0) {
            this.collisionCooldown = 0.5;
            this.damage(4, 'traffic');
            this.speed *= 0.6;
            return { crashed: true, hard: false };
          }
        }
      }
    }
    // Keep the player inside the playable area (sea at the south).
    const LIM = 240;
    if (this.x > LIM) { this.x = LIM; this.speed *= 0.5; }
    if (this.x < -LIM) { this.x = -LIM; this.speed *= 0.5; }
    if (this.z > LIM) { this.z = LIM; this.speed *= 0.5; }
    if (this.z < -LIM) { this.z = -LIM; this.speed *= 0.5; }
    // Sync the car mesh.
    this.car.position.set(this.x, 0, this.z);
    this.car.rotation.y = this.heading;
    const steerVis = steerInput * 0.4;
    this.car.rotation.z = -steerVis * Math.min(1, Math.abs(this.speed) / 20);
    for (const w of this.car.userData.wheels) w.rotation.x += this.speed * dt * 2.2;
    // Engine wear: hard driving lowers the engine %.
    this.enginePct = THREE.MathUtils.clamp(this.enginePct - Math.abs(this.speed) * dt * 0.004, 55, 98);
    return null;
  }

  updateWalking(dt, input) {
    // Camera-relative movement; mouse drag (or arrow keys) turns the view.
    this.camYaw -= input.mouseDX * 0.004;
    if (input.down('ArrowLeft')) this.camYaw += 1.8 * dt;
    if (input.down('ArrowRight')) this.camYaw -= 1.8 * dt;
    const f = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) -
      (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const r = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const moving = f !== 0 || r !== 0;
    const sp = this.walkSpeed * (input.down('ShiftLeft') ? 1.6 : 1);
    if (moving) {
      const len = Math.hypot(f, r) || 1;
      // Forward is (-sin yaw, -cos yaw), right is (cos yaw, -sin yaw).
      const mx = (-Math.sin(this.camYaw) * f + Math.cos(this.camYaw) * r) / len;
      const mz = (-Math.cos(this.camYaw) * f - Math.sin(this.camYaw) * r) / len;
      const nx = this.x + mx * sp * dt;
      const nz = this.z + mz * sp * dt;
      if (!this.city.hitsBuilding(nx, nz, 0.8)) { this.x = nx; this.z = nz; }
      this.heading = Math.atan2(-mx, -mz);
      this.walkPhase += sp * dt * 2.2;
    }
    this.body.position.set(this.x, 0, this.z);
    this.body.rotation.y = this.heading;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.body.userData.legs[0].rotation.x = swing;
    this.body.userData.legs[1].rotation.x = -swing;
    this.body.userData.arms[0].rotation.x = -swing * 0.7;
    this.body.userData.arms[1].rotation.x = swing * 0.7;
    const LIM = 240;
    this.x = THREE.MathUtils.clamp(this.x, -LIM, LIM);
    this.z = THREE.MathUtils.clamp(this.z, -LIM, LIM);
  }
}
