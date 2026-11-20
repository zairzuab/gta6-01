// VICE HEAT — Solmar Pursuit. Main orchestrator: renderer, camera, game
// loop, state machine (menu / playing / paused / busted / wasted / done),
// shooting, pickups, mission beacons, radio chatter, save, and the
// ?shot= screenshot presets the maker uses for screenshots/.
import * as THREE from 'three';
import { City, CITY_HALF, PITCH } from './city.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Arsenal } from './weapons.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { makePickup } from './vehicles.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // cover | city | wanted5 | menu | null

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.clock = new THREE.Clock();
    this.time = 0;
    this.gameMinutes = 16 * 60 + 24;

    this.city = new City(this.scene);
    this.player = new Player(this.scene, this.city);
    this.traffic = new Traffic(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.arsenal = new Arsenal(this.scene);
    this.missions = new MissionRunner();
    this.hud = new Hud();
    this.sound = new SoundBank();
    this.input = new Input(this.canvas);

    this.state = 'menu'; // menu | playing | paused | busted | wasted | done
    this.camDist = 11;
    this.camHeight = 4.2;
    this.shake = 0;
    this.raycaster = new THREE.Raycaster();
    this.pickups = [];
    this.beacon = null;
    this.radioQueue = [];
    this.radioTimer = 4;
    this.fpsFrames = 0; this.fpsTime = 0; this.fps = 0;
    this.startedClean = false; // the "lose the heat" stage only counts once heat existed
    this.bustedAt = 0;
    this.shotReady = false;
    this.shotFrames = 0;

    this.buildPickups();
    this.buildMissionList();
    this.bindScreens();
    this.spawnPlayerCar();
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.loop();
  }

  // --- Setup -------------------------------------------------------------
  spawnPlayerCar() {
    // Player starts on Avenida del Sol (the x = 30 street), facing the pier.
    this.player.spawnCar(30, 30, Math.PI);
  }

  buildPickups() {
    const spots = [
      { kind: 'health', x: 18, z: -40 }, { kind: 'armour', x: -22, z: 60 },
      { kind: 'health', x: -70, z: -90 }, { kind: 'armour', x: 70, z: 90 },
      { kind: 'escopeta', x: 40, z: -70 }, { kind: 'falcon', x: -40, z: 120 },
      { kind: 'health', x: 110, z: -20 }, { kind: 'armour', x: -110, z: 30 },
    ];
    for (const s of spots) {
      const mesh = makePickup(s.kind);
      mesh.position.set(s.x, 0, s.z);
      this.scene.add(mesh);
      this.pickups.push({ mesh, kind: s.kind, x: s.x, z: s.z, taken: false, respawn: 0 });
    }
  }

  buildMissionList() {
    const list = document.getElementById('missionList');
    list.innerHTML = MISSIONS.map((m, i) => {
      const done = this.missions.save.completed.includes(m.id);
      return `<div class="mi ${done ? 'done' : ''}" data-i="${i}">
        <span><b>${m.name}</b> — ${m.brief}</span>
        <span class="tag">${done ? '✓ DONE' : '$' + m.reward.toLocaleString('en-US')}</span></div>`;
    }).join('');
    list.querySelectorAll('.mi').forEach((el) => {
      el.addEventListener('click', () => {
        this.missions.setMission(Number(el.dataset.i));
        this.startGame();
      });
    });
  }

  bindScreens() {
    document.getElementById('playBtn').addEventListener('click', () => this.startGame());
    document.getElementById('continueBtn').addEventListener('click', () => this.startGame());
    document.getElementById('resumeBtn').addEventListener('click', () => this.resume());
    document.getElementById('quitBtn').addEventListener('click', () => this.toMenu());
    document.getElementById('againBtn').addEventListener('click', () => this.restart());
    document.getElementById('menuBtn').addEventListener('click', () => this.toMenu());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // --- State transitions ---------------------------------------------------
  startGame() {
    this.sound.ensure();
    this.sound.click();
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('endScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    this.state = 'playing';
    this.hud.center(this.missions.mission().name, this.missions.mission().brief, false, 3.2);
    this.hud.ticker('KIT', 'K', 'Dante, the case is hot. Get in the car and move — PD is already rolling.', 7);
    this.sound.mission();
  }

  resume() {
    document.getElementById('pauseScreen').classList.add('hidden');
    this.state = 'playing';
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    const s = this.missions.save;
    document.getElementById('pauseStats').innerHTML =
      `Money <b>$${s.money.toLocaleString('en-US')}</b> · Missions done <b>${s.completed.length} / 3</b> · ` +
      `Best wanted <b>${s.bestWanted} ★</b> · Respect <b>${s.respect}</b>`;
    document.getElementById('pauseScreen').classList.remove('hidden');
  }

  toMenu() {
    this.state = 'menu';
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('endScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    this.buildMissionList();
    this.police.clearHeat();
  }

  restart() {
    document.getElementById('endScreen').classList.add('hidden');
    this.player.health = 100; this.player.armour = 50;
    this.police.clearHeat();
    this.missions.setMission(0);
    this.spawnPlayerCar();
    this.state = 'playing';
  }

  endScreen(title, text) {
    this.state = title === 'BUSTED' ? 'busted' : 'wasted';
    document.getElementById('endTitle').textContent = title;
    document.getElementById('endText').textContent = text;
    document.getElementById('endScreen').classList.remove('hidden');
    this.sound.busted();
  }

  // --- Shooting ------------------------------------------------------------
  shoot() {
    const res = this.arsenal.tryFire(0, this.input.mouseDown);
    if (!res) return;
    if (res.dry) { this.sound.click(); return; }
    const w = res.weapon;
    this.sound.gunshot(w.sound);
    // Origin: camera for on-foot aim, car nose for drive-by.
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Add spread.
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.y += (Math.random() - 0.5) * w.spread * 2;
    dir.z += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();
    this.raycaster.set(origin, dir);
    this.raycaster.far = w.range;
    // Targets: police cruisers, tank, traffic cars, pedestrians, buildings.
    const targets = [];
    for (const c of this.police.cruisers) targets.push(c.mesh);
    if (this.police.tank) targets.push(this.police.tank.mesh);
    for (const c of this.traffic.cars) targets.push(c.mesh);
    for (const p of this.traffic.peds) targets.push(p.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    const end = origin.clone().add(dir.clone().multiplyScalar(w.range));
    if (hits.length > 0) {
      const hit = hits[0];
      end.copy(hit.point);
      this.arsenal.spawnImpact(hit.point, 0xffd75e);
      this.applyShotHit(hit.object, w);
    } else {
      this.arsenal.spawnImpact(end, 0xbbbbbb);
    }
    const muzzle = origin.clone().add(dir.clone().multiplyScalar(1.2));
    muzzle.y -= 0.25;
    this.arsenal.spawnTracer(muzzle, end);
    // Recoil shake.
    this.shake = Math.min(0.35, this.shake + 0.12);
  }

  applyShotHit(obj, w) {
    // Walk up to the vehicle/ped group.
    let g = obj;
    while (g.parent && g.parent !== this.scene) g = g.parent;
    // Police cruiser hit: damage it, add heat.
    const cruiser = this.police.cruisers.find((c) => c.mesh === g);
    if (cruiser) {
      cruiser.hp = (cruiser.hp ?? 100) - w.damage;
      this.police.addHeat(6, 'shot at police');
      if (cruiser.hp <= 0) {
        this.disableCruiser(cruiser);
        this.hud.center('CRUISER DOWN', 'One less badge on your tail.', false, 2);
      }
      return;
    }
    if (this.police.tank && this.police.tank.mesh === g) {
      this.police.addHeat(4, 'shot at tank');
      this.hud.ticker('ABUELA', 'A', 'The tank barely notices bullets, mijo. Run, don\'t fight it.', 5);
      return;
    }
    const trafficCar = this.traffic.cars.find((c) => c.mesh === g);
    if (trafficCar) {
      trafficCar.scared = 3;
      this.police.addHeat(3, 'shot at traffic');
      this.traffic.panicNear(trafficCar.x, trafficCar.z, 20);
      return;
    }
    const ped = this.traffic.peds.find((p) => p.mesh === g);
    if (ped) {
      this.police.addHeat(8, 'hit a pedestrian');
      this.traffic.panicNear(ped.x, ped.z, 30);
    }
  }

  disableCruiser(cruiser) {
    // Smoke, stall, then remove.
    cruiser.speed = 0;
    cruiser.disabled = true;
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.55 }));
    smoke.position.copy(cruiser.mesh.position);
    smoke.position.y = 1.6;
    this.scene.add(smoke);
    setTimeout(() => this.scene.remove(smoke), 2500);
    setTimeout(() => {
      this.scene.remove(cruiser.mesh);
      const i = this.police.cruisers.indexOf(cruiser);
      if (i >= 0) this.police.cruisers.splice(i, 1);
    }, 1200);
  }

  // --- Pickups ---------------------------------------------------------------
  updatePickups(dt) {
    for (const p of this.pickups) {
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) { p.taken = false; p.mesh.visible = true; }
        continue;
      }
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = Math.sin(this.time * 2 + p.x) * 0.15;
      const d = Math.hypot(this.player.x - p.x, this.player.z - p.z);
      if (d < 2.6) {
        p.taken = true; p.mesh.visible = false; p.respawn = 25;
        this.sound.pickup();
        if (p.kind === 'health') { this.player.heal(35); this.hud.center('HEALTH +35', 'Patched up.', false, 1.6); }
        else if (p.kind === 'armour') { this.player.addArmour(40); this.hud.center('ARMOUR +40', 'Vest on.', false, 1.6); }
        else if (p.kind === 'escopeta' || p.kind === 'falcon') {
          const got = this.arsenal.give(p.kind);
          this.arsenal.addAmmo(p.kind, 24);
          this.hud.center(got ? 'NEW WEAPON' : 'AMMO +24', p.kind === 'escopeta' ? 'ESCOPETA 12 — close and personal.' : 'FALCON RIFLE — long reach.', false, 2);
        }
      }
    }
  }

  // --- Mission beacon ----------------------------------------------------------
  updateBeacon() {
    const m = this.missions.marker;
    if (!m) {
      if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
      return;
    }
    if (!this.beacon) {
      const g = new THREE.Group();
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 2.2, 60, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 30;
      g.add(beam);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 24),
        new THREE.MeshBasicMaterial({ color: m.color }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      g.add(ring);
      this.beacon = g;
      this.scene.add(g);
    }
    this.beacon.position.set(m.x, 0, m.z);
    this.beacon.rotation.y += 0.01;
  }

  // --- Radio chatter -------------------------------------------------------------
  radioTick(dt) {
    this.radioTimer -= dt;
    if (this.radioTimer > 0) return;
    this.radioTimer = 9 + Math.random() * 6;
    const lines = [
      ['KIT', 'K', 'Dispatch is all over the avenue. Keep it moving, Dante.'],
      ['ABUELA', 'A', 'The crew is watching, mijo. Make it look easy.'],
      ['DISPATCH', 'D', 'All units, suspect last seen on Avenida del Sol. Air support en route.'],
      ['KIT', 'K', 'Radio Verano is playing your song. Fitting, no?'],
      ['ABUELA', 'A', 'Five stars and you still smile. That is my boy.'],
    ];
    const [n, a, t] = lines[Math.floor(Math.random() * lines.length)];
    this.hud.ticker(n, a, t, 6);
    this.sound.radioBlip();
  }

  // --- Camera ----------------------------------------------------------------------
  updateCamera(dt) {
    const p = this.player;
    let target, lookAt;
    // Forward is (-sin heading, -cos heading); the camera sits behind the
    // player (opposite of forward) and looks ahead.
    if (p.inCar) {
      const front = new THREE.Vector3(-Math.sin(p.heading), 0, -Math.cos(p.heading));
      target = new THREE.Vector3(p.x, 0, p.z).addScaledVector(front, -this.camDist);
      target.y = this.camHeight;
      lookAt = new THREE.Vector3(p.x, 1.4, p.z).addScaledVector(front, 12);
    } else {
      const yaw = p.camYaw;
      const front = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      target = new THREE.Vector3(p.x, 0, p.z).addScaledVector(front, -8);
      target.y = 3.4;
      lookAt = new THREE.Vector3(p.x, 1.5, p.z).addScaledVector(front, 8);
    }
    // Screen shake.
    if (this.shake > 0) {
      target.x += (Math.random() - 0.5) * this.shake;
      target.y += (Math.random() - 0.5) * this.shake * 0.6;
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }
    const k = 1 - Math.exp(-dt * 7);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(lookAt);
  }

  // --- Main loop ----------------------------------------------------------------------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.gameMinutes += dt * 0.35;
    this.city.update(dt, this.time);
    this.input.beginFrame();

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'paused') {
      // P / Esc resumes from the pause screen too.
      if (this.input.pressed('KeyP') || this.input.pressed('Escape')) this.resume();
    } else if (this.state === 'menu') {
      // Slow orbit around the avenue for the menu backdrop.
      const t = this.time * 0.05;
      this.camera.position.set(Math.sin(t) * 60, 26, 60 + Math.cos(t) * 40);
      this.camera.lookAt(0, 4, -20);
      this.traffic.update(dt, { x: this.player.x, z: this.player.z }, false);
    }
    this.arsenal.update(dt);
    this.hud.update(dt);
    this.sound.radioTick(dt, this.state === 'playing' && this.player.inCar);
    this.input.endFrame();

    // FPS counter.
    this.fpsFrames += 1; this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0; this.fpsTime = 0;
      this.hud.setFps(this.fps);
    }

    this.renderer.render(this.scene, this.camera);

    // Screenshot mode: after a few frames, signal readiness.
    if (SHOT && !this.shotReady) {
      this.shotFrames += 1;
      if (this.shotFrames > 5) {
        this.shotReady = true;
        window.__shotReady = true;
      }
    }
  }

  updatePlaying(dt) {
    const p = this.player;
    const input = this.input;

    // Pause / mute / camera keys.
    if (input.pressed('KeyP') || input.pressed('Escape')) { this.pause(); return; }
    if (input.muteToggle) this.sound.setMuted(!this.sound.muted);
    if (input.pressed('KeyC')) { this.camDist = this.camDist > 9 ? 7 : 12; this.camHeight = this.camDist > 9 ? 3.6 : 2.8; }

    // Enter / exit / steal.
    if (input.pressed('KeyE')) {
      if (p.inCar) { p.exitCar(); this.sound.click(); }
      else {
        const near = this.traffic.nearestCar(p.x, p.z, 5);
        if (near) {
          const mesh = this.traffic.steal(near);
          p.takeCar(mesh);
          this.police.addHeat(5, 'stole a car');
          this.hud.center('CAR JACKED', 'That one is yours now. The owner disagrees.', false, 2);
          this.sound.thud(0.6);
        } else if (p.car && Math.hypot(p.car.position.x - p.x, p.car.position.z - p.z) < 5) {
          p.enterCar();
          this.sound.click();
        }
      }
    }
    if (input.pressed('KeyF') && !p.inCar) {
      const near = this.traffic.nearestCar(p.x, p.z, 6);
      if (near) {
        const mesh = this.traffic.steal(near);
        p.takeCar(mesh);
        this.police.addHeat(8, 'carjacked at gunpoint');
        this.traffic.panicNear(p.x, p.z, 20);
        this.hud.center('CARJACKED', 'Keys, please. Now drive.', false, 2);
      }
    }
    // Weapon switching 1-5 and reload.
    for (let i = 0; i < 5; i++) {
      if (input.pressed('Digit' + (i + 1))) {
        if (this.arsenal.select(i)) this.sound.click();
        else this.sound.denied();
      }
    }
    if (input.pressed('KeyR')) this.arsenal.startReload();
    // Shooting (mouse held for auto weapons).
    if (input.mouseDown || input.mouseClicked) this.shoot();

    // Drive / walk.
    const crash = p.update(dt, input, this.traffic);
    if (crash?.crashed) {
      this.shake = Math.max(this.shake, crash.hard ? 0.6 : 0.3);
      this.sound.thud(crash.hard ? 1 : 0.5);
      this.hud.damageFlash(crash.hard ? 0.8 : 0.4);
      if (crash.hard) this.police.addHeat(2, 'crashed into traffic');
    }

    // Traffic + police.
    const policeNear = this.police.nearestPoliceDist(p.x, p.z) < 55;
    this.traffic.update(dt, { x: p.x, z: p.z }, policeNear);
    this.police.update(dt, { x: p.x, z: p.z, heading: p.heading, speed: p.speed }, !p.inCar);

    // Police ram damage: a cruiser touching the player car hurts.
    for (const c of this.police.cruisers) {
      if (c.disabled) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 3.2 && p.collisionCooldown <= 0) {
        p.collisionCooldown = 0.7;
        const dead = p.damage(6 + Math.abs(c.speed) * 0.15, 'rammed');
        this.shake = 0.5;
        this.sound.thud(1);
        this.hud.damageFlash(0.7);
        if (dead) return this.endScreen('WASTED', 'The Solmar PD finally caught up with Dante Vega. The crew will remember the driver who never stopped.');
      }
    }
    // Tank ram = heavy damage.
    if (this.police.tank) {
      const d = Math.hypot(this.police.tank.x - p.x, this.police.tank.z - p.z);
      if (d < 4.5 && p.collisionCooldown <= 0) {
        p.collisionCooldown = 0.8;
        const dead = p.damage(22, 'tank');
        this.shake = 0.9;
        this.sound.thud(1.4);
        this.hud.damageFlash(1);
        if (dead) return this.endScreen('WASTED', 'Flattened by a Solmar PD tank on Avenida del Sol. Five stars was a promise, not a threat.');
      }
    }
    // Busted: on foot, health low, and a cruiser right on top of you.
    if (!p.inCar && p.health < 25 && this.police.nearestPoliceDist(p.x, p.z) < 4 && this.police.wanted > 0) {
      this.bustedAt += dt;
      if (this.bustedAt > 2) return this.endScreen('BUSTED', 'Hands up, Vega. The Solmar PD has you — this time. The case stays with the crew.');
    } else {
      this.bustedAt = 0;
    }
    if (p.health <= 0) return this.endScreen('WASTED', 'Dante Vega went out the way he lived: fast, loud, and five stars deep.');

    // Spike strip: popped tires slow the car.
    if (p.inCar && this.police.checkSpikes(p.x, p.z)) {
      p.tiresPopped = true;
      this.shake = 0.5;
      this.sound.thud(1);
      this.hud.center('SPIKED!', 'Tires blown — you are crawling now. Ditch the car!', true, 2.5);
      this.hud.ticker('KIT', 'K', 'Spikes! Your tires are gone. Steal something else, fast!', 6);
    }

    // Pickups, beacon, radio.
    this.updatePickups(dt);
    this.updateBeacon();
    this.radioTick(dt);

    // Missions.
    const marker = this.missions.marker;
    const markerDist = marker ? Math.hypot(p.x - marker.x, p.z - marker.z) : 9999;
    const ev = this.missions.update(dt, {
      inCar: p.inCar, wanted: this.police.wanted, markerDist,
      speed: Math.abs(p.speed), startedClean: this.startedClean,
    });
    if (ev === 'stage') {
      this.sound.mission();
      const s = this.missions.stage();
      this.hud.center('STAGE CLEAR', s ? s.name : '', false, 2);
      if (this.missions.stage().target === 'clean') this.startedClean = true;
    } else if (ev === 'mission-complete') {
      const m = this.missions.mission();
      this.sound.mission();
      this.hud.center('MISSION COMPLETE', `${m.name} — $${m.reward.toLocaleString('en-US')} banked.`, false, 3.5);
      this.hud.ticker('ABUELA', 'A', `Beautiful driving, mijo. $${m.reward.toLocaleString('en-US')} is yours. The next job is waiting.`, 7);
      const next = this.missions.nextMission();
      if (!next) {
        this.state = 'done';
        setTimeout(() => this.endScreen('LEGEND', 'All three missions complete. Dante Vega is a Solmar legend — the driver the whole city chased and never caught.'), 1200);
      }
    }
    if (this.police.wanted > 0) this.startedClean = true;
    if (this.police.wanted > this.missions.save.bestWanted) {
      this.missions.save.bestWanted = this.police.wanted;
      this.missions.persist();
    }

    // --- HUD -------------------------------------------------------------
    const loc = this.city.locationAt(p.x, p.z);
    this.hud.setMission(this.missions.mission(), this.missions.stage(), this.missions.stageIndex,
      this.missions.stageProgress({ wanted: this.police.wanted, markerDist }));
    this.hud.setWanted(this.police.wanted, this.police.nearestPoliceDist(p.x, p.z) < 55);
    this.hud.setStats(this.missions.save.money, p.health, p.armour,
      this.arsenal.current(), this.arsenal.currentAmmo(),
      this.missions.save.rank, this.missions.save.respect);
    this.hud.setSlots(this.arsenal.index, this.arsenal.owned);
    this.hud.setDispatch(this.police.dispatchList(p.x, p.z));
    this.hud.setSpeed(Math.abs(p.speed) * 3.6, p.inCar ? p.carName : 'ON FOOT',
      p.enginePct, 'FM Radio Verano 97.3');
    this.hud.setLocation(loc.street, loc.district);
    this.hud.setClock(this.gameMinutes);
    this.hud.setCrosshair(!p.inCar);
    this.hud.drawMinimap(p.x, p.z, p.inCar ? p.heading : p.camYaw,
      this.police.cruisers.map((c) => ({ x: c.x, z: c.z })),
      this.missions.marker,
      this.police.heli ? { x: this.police.heli.mesh.position.x, z: this.police.heli.mesh.position.z } : null);

    // --- Sound -------------------------------------------------------------
    this.sound.setEngine(Math.abs(p.speed) * 3.6, p.inCar);
    this.sound.setSiren(this.police.wanted > 0,
      this.police.nearestPoliceDist(p.x, p.z) < 40);

    this.updateCamera(dt);
  }
}

// --- Screenshot presets -----------------------------------------------------
// ?shot=cover  : the chase — car on the avenue, cruisers behind, heli above, 3 stars
// ?shot=city   : on foot, wide avenue with palms, buildings and the Ferris wheel
// ?shot=wanted5: five stars — tank, helicopter, roadblock, spikes
// ?shot=menu   : the start screen over a slow city orbit
function applyShotPreset(game) {
  if (!SHOT) return;
  if (SHOT === 'menu') return; // menu is the default backdrop
  // Skip the menu and start playing.
  document.getElementById('startScreen').classList.add('hidden');
  game.state = 'playing';
  game.sound.ensure();
  const p = game.player;
  if (SHOT === 'cover') {
    // Facing south down Avenida del Sol toward the pier + Ferris wheel,
    // cruisers in pursuit ahead and flanking (in frame), helicopter
    // overhead ahead, roadblock further up the avenue.
    p.spawnCar(30, 60, Math.PI);
    p.speed = 26;
    game.police.addHeat(45, 'shot preset');
    game.police.spawnCruiser(p.x, p.z, { x: p.x - 7, z: p.z + 20 });
    game.police.spawnCruiser(p.x, p.z, { x: p.x + 8, z: p.z + 42 });
    game.police.spawnHelicopter(p.x, p.z);
    game.police.placeRoadblock(p.x, p.z, p.heading);
    game.missions.setMission(0);
    game.missions.stageIndex = 2; // LOSE THE HEAT stage
    game.missions.placeMarkerForStage();
    game.hud.ticker('KIT', 'K', 'Roadblock on Avenida del Sol, two blocks up. Spikes too. Cut left at the Coral Reina!', 30);
  } else if (SHOT === 'city') {
    p.exitCar();
    // Middle of Avenida del Sol, facing the pier + Ferris wheel.
    p.x = 30; p.z = 40; p.camYaw = Math.PI;
    p.body.position.set(p.x, 0, p.z);
    game.police.clearHeat();
    game.missions.setMission(0);
  } else if (SHOT === 'wanted5') {
    p.spawnCar(30, 40, Math.PI);
    p.speed = 20;
    game.police.addHeat(100, 'shot preset');
    game.police.spawnCruiser(p.x, p.z, { x: p.x - 7, z: p.z + 20 });
    game.police.spawnCruiser(p.x, p.z, { x: p.x + 8, z: p.z + 38 });
    game.police.spawnHelicopter(p.x, p.z);
    game.police.spawnTank(p.x, p.z, { x: p.x - 5, z: p.z + 52 });
    game.police.placeRoadblock(p.x, p.z, p.heading);
    game.missions.setMission(2);
    game.missions.stageIndex = 1; // SURVIVE
    game.hud.ticker('DISPATCH', 'D', 'All units, five-star fugitive on Avenida del Sol. Tank unit Bravo-6 is rolling in.', 30);
  }
  game.updateCamera(0.1);
}

const game = new Game();
window.__game = game; // exposed for automated testing / debugging
applyShotPreset(game);
