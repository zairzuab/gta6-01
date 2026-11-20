// HUD: all the DOM overlay updates plus the circular minimap canvas.
// The layout mirrors the reference: mission card top-left, wanted + money +
// health/armour + weapon + slots top-right, dispatch list, minimap with
// location bottom-left, speedometer bottom-right, radio ticker centre.
import { WEAPONS } from './weapons.js';
import { CITY_HALF, PITCH, GRID } from './city.js';

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['mCount', 'mName', 'mStage', 'mBarFill', 'mObj', 'stars', 'sightLine',
      'money', 'clock', 'healthBar', 'healthVal', 'armourBar', 'armourVal', 'weaponName',
      'weaponAmmo', 'rankLine', 'slots', 'dispatchList', 'locName', 'speedVal', 'carName',
      'engineBar', 'engineVal', 'radioLine', 'tickerAvatar', 'tickerName', 'tickerText',
      'centerBig', 'centerSub', 'dmgFlash', 'crosshair', 'fpsTag']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap.getContext('2d');
    this.buildSlots();
    this.centerTimer = 0;
    this.tickerTimer = 0;
  }

  buildSlots() {
    this.el.slots.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'slot';
      d.id = 'slot' + i;
      d.innerHTML = `<span class="ic">${w.icon}</span><span>${w.name.split(' ')[0]}</span><span class="key">${i + 1}</span>`;
      this.el.slots.appendChild(d);
    });
  }

  setMission(mission, stage, stageIndex, progress) {
    this.el.mCount.textContent = mission.count;
    this.el.mName.textContent = mission.name;
    this.el.mStage.innerHTML = `STAGE ${stageIndex + 1} OF ${mission.stages.length} · <b>${stage.name}</b>`;
    this.el.mBarFill.style.width = `${Math.round(progress * 100)}%`;
    this.el.mObj.textContent = stage.obj;
  }

  setWanted(stars, inSight) {
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? 'on' : 'off'}">★</span>`;
    this.el.stars.innerHTML = html;
    this.el.sightLine.textContent = stars === 0 ? 'CLEAN' : (inSight ? 'IN SIGHT' : 'LOSING THEM…');
    this.el.sightLine.style.color = stars === 0 ? '#7dffa8' : '#ff5d5d';
    this.el.stars.style.transform = stars >= 4 ? 'scale(1.08)' : 'scale(1)';
  }

  setStats(money, health, armour, weapon, ammo, rank, respect) {
    this.el.money.textContent = '$' + money.toLocaleString('en-US');
    this.el.healthBar.style.width = `${Math.max(0, health)}%`;
    this.el.healthVal.textContent = Math.round(health);
    this.el.armourBar.style.width = `${Math.max(0, armour)}%`;
    this.el.armourVal.textContent = Math.round(armour);
    this.el.weaponName.textContent = weapon.name;
    this.el.weaponAmmo.textContent = ammo.mag === Infinity ? '∞' : `${ammo.mag} / ${ammo.reserve}`;
    this.el.rankLine.textContent = `RANK ${rank} · CREW BOSS · ${respect} RESPECT`;
  }

  setSlots(activeIndex, owned) {
    WEAPONS.forEach((w, i) => {
      const s = document.getElementById('slot' + i);
      if (!s) return;
      s.classList.toggle('active', i === activeIndex);
      s.style.opacity = owned[i] ? '1' : '0.35';
    });
  }

  setDispatch(units) {
    if (units.length === 0) {
      this.el.dispatchList.innerHTML = '<div class="unit"><span class="call">—</span><span class="kind">NO UNITS</span><span class="st">CLEAR</span></div>';
      return;
    }
    this.el.dispatchList.innerHTML = units.map((u) =>
      `<div class="unit"><span class="call">${u.call}</span><span class="kind">${u.kind}</span>` +
      `<span class="dist">${u.dist} m</span><span class="st ${u.cls}">${u.status}</span></div>`).join('');
  }

  setSpeed(kmh, carName, enginePct, radio) {
    this.el.speedVal.innerHTML = `${Math.round(kmh)} <small>KM/H</small>`;
    this.el.carName.textContent = carName;
    this.el.engineBar.style.width = `${Math.round(enginePct)}%`;
    this.el.engineVal.textContent = `${Math.round(enginePct)}%`;
    this.el.radioLine.textContent = radio;
  }

  setLocation(street, district) {
    this.el.locName.innerHTML = `${district}<small>${street}</small>`;
  }

  setClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  ticker(name, avatar, text, dur = 6) {
    this.el.tickerName.textContent = name;
    this.el.tickerAvatar.textContent = avatar;
    this.el.tickerText.textContent = text;
    this.tickerTimer = dur;
  }

  center(big, sub, red = false, dur = 2.6) {
    this.el.centerBig.textContent = big;
    this.el.centerBig.className = 'big' + (red ? ' red' : '');
    this.el.centerSub.textContent = sub;
    this.centerTimer = dur;
  }

  damageFlash(strength) {
    this.el.dmgFlash.style.boxShadow = `inset 0 0 120px rgba(255,0,0,${0.25 + strength * 0.5})`;
    setTimeout(() => { this.el.dmgFlash.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,0)'; }, 180);
  }

  setCrosshair(on) { this.el.crosshair.style.display = on ? 'block' : 'none'; }
  setFps(n) { this.el.fpsTag.textContent = n ? `${n} FPS` : ''; }

  // Circular minimap: streets, blocks, player arrow, police blips,
  // mission marker, north indicator.
  drawMinimap(px, pz, heading, police, marker, heli) {
    const g = this.mm;
    const S = 200, C = S / 2;
    const range = 190; // metres shown across the circle
    const scale = S / range;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(C, C, C - 2, 0, Math.PI * 2);
    g.clip();
    // Water / land.
    g.fillStyle = '#0e2a4a';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#14304e';
    g.fillRect(0, 0, S, S);
    // Streets (rotated so the player heading is up: forward (-sin h, -cos h)
    // must map to screen-up, which needs a +heading rotation).
    g.translate(C, C);
    g.rotate(heading);
    g.translate(-px * scale, -pz * scale);
    g.strokeStyle = '#3a4a5e';
    g.lineWidth = 7;
    for (let i = 0; i <= GRID; i++) {
      const c = -CITY_HALF + i * PITCH;
      g.beginPath(); g.moveTo(c * scale, (-CITY_HALF - 20) * scale); g.lineTo(c * scale, (CITY_HALF + 20) * scale); g.stroke();
      g.beginPath(); g.moveTo((-CITY_HALF - 20) * scale, c * scale); g.lineTo((CITY_HALF + 20) * scale, c * scale); g.stroke();
    }
    g.strokeStyle = '#5a6a7e';
    g.lineWidth = 1.5;
    for (let i = 0; i <= GRID; i++) {
      const c = -CITY_HALF + i * PITCH;
      g.beginPath(); g.moveTo(c * scale, (-CITY_HALF - 20) * scale); g.lineTo(c * scale, (CITY_HALF + 20) * scale); g.stroke();
      g.beginPath(); g.moveTo((-CITY_HALF - 20) * scale, c * scale); g.lineTo((CITY_HALF + 20) * scale, c * scale); g.stroke();
    }
    // Beach / sea at the south edge.
    g.fillStyle = '#2e7fb8';
    g.fillRect((-CITY_HALF - 20) * scale, (CITY_HALF + 6) * scale, (GRID * PITCH + 60) * scale, 30 * scale);
    g.fillStyle = '#e8d9a8';
    g.fillRect((-CITY_HALF - 20) * scale, CITY_HALF * scale, (GRID * PITCH + 60) * scale, 6 * scale);
    // Mission marker (pulsing yellow diamond).
    if (marker) {
      const pulse = 1 + Math.sin(performance.now() / 200) * 0.25;
      g.fillStyle = '#ffd75e';
      g.save();
      g.translate(marker.x * scale, marker.z * scale);
      g.rotate(Math.PI / 4);
      const s = 6 * pulse;
      g.fillRect(-s, -s, s * 2, s * 2);
      g.restore();
    }
    // Police blips (red) and helicopter (blue).
    for (const p of police) {
      g.fillStyle = '#ff3b30';
      g.beginPath(); g.arc(p.x * scale, p.z * scale, 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    if (heli) {
      g.fillStyle = '#4da3ff';
      g.beginPath(); g.arc(heli.x * scale, heli.z * scale, 5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // Player arrow at the centre, pointing up.
    g.fillStyle = '#fff';
    g.strokeStyle = '#20242e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(C, C - 11); g.lineTo(C + 7, C + 8); g.lineTo(C, C + 3); g.lineTo(C - 7, C + 8);
    g.closePath(); g.fill(); g.stroke();
    // North marker.
    g.fillStyle = '#fff';
    g.font = 'bold 12px Arial';
    g.textAlign = 'center';
    g.fillText('N', C, 16);
  }

  update(dt) {
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) {
        this.el.centerBig.textContent = '';
        this.el.centerSub.textContent = '';
      }
    }
  }
}
