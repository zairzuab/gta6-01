// Missions: three story missions with stages, objectives and rewards.
// Progress saves to localStorage so the player keeps money and rank.
import { CITY_HALF, PITCH } from './city.js';

export const MISSIONS = [
  {
    id: 'arco',
    name: 'ARCO RUN',
    count: 'MISSION 1 OF 3',
    reward: 12000,
    brief: 'The case is in hand. Lose the heat on Avenida del Sol.',
    stages: [
      { name: 'GET IN THE CAR', obj: 'Get in your car on Avenida del Sol.', target: 'car' },
      { name: 'GRAB THE CASE', obj: 'Drive to the yellow marker and grab the case.', target: 'marker' },
      { name: 'LOSE THE HEAT', obj: 'Lose the heat — get your wanted level to zero.', target: 'clean' },
    ],
  },
  {
    id: 'courier',
    name: 'COURIER HEAT',
    count: 'MISSION 2 OF 3',
    reward: 18000,
    brief: 'A package for the crew boss, across town, with the PD already awake.',
    stages: [
      { name: 'PICK UP', obj: 'Pick up the package at the yellow marker.', target: 'marker' },
      { name: 'DELIVER', obj: 'Deliver it to the blue marker in Puerto Azul. Stay fast.', target: 'marker2' },
      { name: 'LOSE THE HEAT', obj: 'Lose the heat — get your wanted level to zero.', target: 'clean' },
    ],
  },
  {
    id: 'fivestar',
    name: 'FIVE-STAR HEAT',
    count: 'MISSION 3 OF 3',
    reward: 30000,
    brief: 'The whole city wants you. Survive 60 seconds at five stars.',
    stages: [
      { name: 'MAKE SOME NOISE', obj: 'Raise your wanted level to 5 stars — steal, ram, shoot.', target: 'five' },
      { name: 'SURVIVE', obj: 'Survive 60 seconds at five stars. The tank is coming.', target: 'survive' },
      { name: 'LOSE THE HEAT', obj: 'Lose the heat — get your wanted level to zero.', target: 'clean' },
    ],
  },
];

const SAVE_KEY = 'viceheat-solmar-save-v1';

export class MissionRunner {
  constructor() {
    this.save = this.loadSave();
    this.missionIndex = 0;
    this.stageIndex = 0;
    this.marker = null; // {x, z, color} current objective marker (world)
    this.surviveTimer = 0;
    this.surviveNeed = 60;
    this.done = false;
    this.setMission(0);
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* fresh save */ }
    return { money: 48250, completed: [], respect: 2450, rank: 5, bestWanted: 0 };
  }

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage unavailable */ }
  }

  mission() { return MISSIONS[this.missionIndex]; }
  stage() { return this.mission().stages[this.stageIndex]; }

  setMission(i) {
    this.missionIndex = i;
    this.stageIndex = 0;
    this.done = false;
    this.surviveTimer = 0;
    this.placeMarkerForStage();
  }

  placeMarkerForStage() {
    const s = this.stage();
    if (s.target === 'marker') {
      const ix = 2 + Math.floor(Math.random() * 4);
      const iz = 2 + Math.floor(Math.random() * 4);
      this.marker = { x: -CITY_HALF + ix * PITCH, z: -CITY_HALF + iz * PITCH, color: 0xffd75e };
    } else if (s.target === 'marker2') {
      this.marker = { x: CITY_HALF - PITCH * 1.5, z: CITY_HALF - PITCH * 1.5, color: 0x4da3ff };
    } else {
      this.marker = null;
    }
  }

  advance() {
    this.stageIndex += 1;
    if (this.stageIndex >= this.mission().stages.length) {
      this.completeMission();
      return 'mission-complete';
    }
    this.placeMarkerForStage();
    return 'stage';
  }

  completeMission() {
    const m = this.mission();
    this.save.money += m.reward;
    this.save.respect += 350;
    if (!this.save.completed.includes(m.id)) this.save.completed.push(m.id);
    this.save.rank = Math.min(10, 5 + this.save.completed.length);
    this.done = true;
    this.persist();
  }

  nextMission() {
    if (this.missionIndex + 1 < MISSIONS.length) {
      this.setMission(this.missionIndex + 1);
      return true;
    }
    return false;
  }

  // Called every frame; returns an event string when a stage completes.
  update(dt, ctx) {
    // ctx: {inCar, wanted, markerDist, speed}
    const s = this.stage();
    if (!s || this.done) return null;
    if (s.target === 'car' && ctx.inCar) return this.advance();
    if ((s.target === 'marker' || s.target === 'marker2') && ctx.markerDist < 7) return this.advance();
    if (s.target === 'clean' && ctx.wanted === 0 && ctx.startedClean) return this.advance();
    if (s.target === 'five' && ctx.wanted >= 5) return this.advance();
    if (s.target === 'survive') {
      if (ctx.wanted >= 5) {
        this.surviveTimer += dt;
        if (this.surviveTimer >= this.surviveNeed) return this.advance();
      }
    }
    return null;
  }

  stageProgress(ctx) {
    const s = this.stage();
    if (!s) return 1;
    if (s.target === 'survive') return Math.min(1, this.surviveTimer / this.surviveNeed);
    if (s.target === 'clean') return ctx.wanted === 0 ? 1 : 1 - ctx.wanted / 5;
    if (s.target === 'five') return ctx.wanted / 5;
    if (s.target === 'marker' || s.target === 'marker2') return Math.max(0, 1 - ctx.markerDist / 220);
    return this.stageIndex / this.mission().stages.length;
  }
}
