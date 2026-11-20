// Weapons: five switchable weapons with ammo, reload, recoil and tracers.
// Shooting is a hitscan ray from the camera (on foot) or from the car
// (drive-by); hits on police, cars and pedestrians are resolved by the
// caller through the returned hit point.
import * as THREE from 'three';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', icon: '✊', damage: 12, rate: 0.45, mag: Infinity, reserve: Infinity, spread: 0.02, auto: false, sound: 'pistol', range: 3 },
  { id: 'pistol', name: 'P-9 PISTOL', icon: '🔫', damage: 22, rate: 0.28, mag: 12, reserve: 96, spread: 0.015, auto: false, sound: 'pistol', range: 60 },
  { id: 'zumbador', name: 'ZUMBADOR MP', icon: '🔫', damage: 14, rate: 0.09, mag: 32, reserve: 148, spread: 0.045, auto: true, sound: 'smg', range: 55 },
  { id: 'escopeta', name: 'ESCOPETA 12', icon: '💥', damage: 16, rate: 0.8, mag: 6, reserve: 30, spread: 0.09, auto: false, sound: 'shotgun', range: 30, pellets: 6 },
  { id: 'falcon', name: 'FALCON RIFLE', icon: '🎯', damage: 45, rate: 0.5, mag: 20, reserve: 80, spread: 0.004, auto: false, sound: 'rifle', range: 120 },
];

export class Arsenal {
  constructor(scene) {
    this.scene = scene;
    this.index = 2; // start on the ZUMBADOR MP, like the reference HUD
    this.ammo = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.tracers = [];
    this.muzzle = null;
    this.owned = [true, true, true, false, false]; // shotgun + rifle found as pickups
  }

  current() { return WEAPONS[this.index]; }
  currentAmmo() { return this.ammo[this.index]; }

  select(i) {
    if (i < 0 || i >= WEAPONS.length) return false;
    if (!this.owned[i]) return false;
    this.index = i;
    this.reloadTimer = 0;
    return true;
  }

  give(id) {
    const i = WEAPONS.findIndex((w) => w.id === id);
    if (i >= 0) { this.owned[i] = true; return true; }
    return false;
  }

  addAmmo(id, n) {
    const i = WEAPONS.findIndex((w) => w.id === id);
    if (i < 0) return;
    this.ammo[i].reserve += n;
  }

  startReload() {
    const w = this.current();
    const a = this.currentAmmo();
    if (this.reloadTimer > 0 || a.mag === w.mag || a.reserve <= 0 || w.mag === Infinity) return false;
    this.reloadTimer = w.id === 'escopeta' ? 1.4 : 1.0;
    return true;
  }

  // Try to fire. Returns null when on cooldown / reloading / empty.
  // Otherwise returns {dir, pellets, weapon} and starts the cooldown.
  tryFire(dt, isAuto) {
    this.cooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const w = this.current();
        const a = this.currentAmmo();
        const need = w.mag - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
      return null;
    }
    const w = this.current();
    const a = this.currentAmmo();
    if (this.cooldown > 0) return null;
    if (a.mag <= 0) {
      // Dry click, then auto-reload.
      this.startReload();
      return { dry: true };
    }
    if (!isAuto && w.auto === false && this._firedThisClick) return null;
    this.cooldown = w.rate;
    if (a.mag !== Infinity) a.mag -= 1;
    return { weapon: w, pellets: w.pellets || 1 };
  }

  // A bright tracer line from muzzle to hit point, fading fast.
  spawnTracer(from, to) {
    const mat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.95 });
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
    // Muzzle flash sphere.
    if (this.muzzle) this.scene.remove(this.muzzle);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.95 }));
    flash.position.copy(from);
    this.scene.add(flash);
    this.muzzle = flash;
    this.muzzleLife = 0.05;
  }

  // A small impact puff (dust / sparks) where a bullet lands.
  spawnImpact(point, color = 0xcccccc) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    puff.position.copy(point);
    this.scene.add(puff);
    this.tracers.push({ line: puff, life: 0.25, mesh: true });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.mesh) t.line.scale.multiplyScalar(1 + dt * 6);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry?.dispose?.();
        this.tracers.splice(i, 1);
      }
    }
    if (this.muzzle) {
      this.muzzleLife -= dt;
      if (this.muzzleLife <= 0) {
        this.scene.remove(this.muzzle);
        this.muzzle = null;
      }
    }
  }
}
