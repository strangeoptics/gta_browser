import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './style.css';
import { PlayerController } from './player/PlayerController';
import { buildMiamiCity } from './world/CityBuilder';
import { WeaponSystem } from './combat/WeaponSystem';
import { VehicleSystem } from './vehicles/VehicleSystem';
import { NpcSystem } from './entities/NpcSystem';
import { WantedSystem } from './gameplay/WantedSystem';
import { ObjectiveSystem } from './gameplay/ObjectiveSystem';
import { Minimap } from './hud/Minimap';
import { AudioEngine } from './audio/AudioEngine';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;

// HUD elements
const crosshairEl = document.getElementById('crosshair') as HTMLDivElement;
const hitmarkerEl = document.getElementById('hitmarker') as HTMLDivElement;
const weaponPanelEl = document.getElementById('weapon-panel') as HTMLDivElement;
const weaponNameEl = document.getElementById('weapon-name') as HTMLDivElement;
const ammoCurrentEl = document.getElementById('ammo-current') as HTMLSpanElement;
const ammoMaxEl = document.getElementById('ammo-max') as HTMLSpanElement;
const reloadBarEl = document.getElementById('reload-bar') as HTMLDivElement;
const reloadFillEl = document.getElementById('reload-fill') as HTMLDivElement;
const slotEls = [
  document.getElementById('slot-1') as HTMLSpanElement,
  document.getElementById('slot-2') as HTMLSpanElement,
  document.getElementById('slot-3') as HTMLSpanElement,
];

const starsEl = document.getElementById('wanted-stars') as HTMLDivElement;
const cashEl = document.getElementById('cash-display') as HTMLDivElement;
const hpFillEl = document.getElementById('hp-fill') as HTMLDivElement;
const hpTextEl = document.getElementById('hp-text') as HTMLSpanElement;
const objTitleEl = document.getElementById('obj-title') as HTMLDivElement;
const objDescEl = document.getElementById('obj-desc') as HTMLDivElement;
const objDistEl = document.getElementById('obj-dist') as HTMLSpanElement;
const interactPromptEl = document.getElementById('interact-prompt') as HTMLDivElement;
const vehiclePanelEl = document.getElementById('vehicle-panel') as HTMLDivElement;
const vehicleNameEl = document.getElementById('vehicle-name') as HTMLDivElement;
const vehicleSpeedEl = document.getElementById('vehicle-speed') as HTMLSpanElement;
const vehicleCamHintEl = document.getElementById('vehicle-cam-hint') as HTMLDivElement;
const toastBannerEl = document.getElementById('toast-banner') as HTMLDivElement;
const damageVignetteEl = document.getElementById('damage-vignette') as HTMLDivElement;
const wastedOverlayEl = document.getElementById('wasted-overlay') as HTMLDivElement;
const audioStatusEl = document.getElementById('audio-status') as HTMLDivElement;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

// Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 420);

// Post-Processing (Neon & Sunset Bloom)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.48,
  0.86,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// World + Gameplay Systems
const world = buildMiamiCity(scene, renderer);
const weapons = new WeaponSystem(scene, camera);
const vehicles = new VehicleSystem(scene);
const npcs = new NpcSystem(scene);
const wanted = new WantedSystem();
const objectives = new ObjectiveSystem(scene);
const minimap = new Minimap(minimapCanvas);
const audio = new AudioEngine();
objectives.startNextObjective(npcs);

// Player Controller — spawn on Ocean Drive near parked sports cars
const player = new PlayerController(camera, canvas);
const b = world.layout.playableBounds;
player.setWorldBounds(b.minX, b.maxX, b.minZ, b.maxZ);
player.setSpawn(60, 0.2, 24, 0.12);

// Player Health & Wasted State
let playerHp = 100;
let damageFlash = 0;
let wastedTimer = 0;
let lastCompletedCount = 0;

function applyPlayerDamage(amount: number): void {
  if (wastedTimer > 0) return;
  const mitigated = vehicles.isInVehicle() ? amount * 0.55 : amount;
  playerHp = Math.max(0, playerHp - mitigated);
  damageFlash = 0.85;
  audio.playDamage();

  if (playerHp <= 0) {
    wastedTimer = 2.6;
    wastedOverlayEl.classList.add('visible');
    audio.playWasted();
    if (vehicles.isInVehicle()) {
      vehicles.exitVehicle();
      weapons.setEnabled(true);
    }
  }
}

// Wire system callbacks
weapons.onShotFired = (weaponId, origin) => {
  audio.playShot(weaponId);
  npcs.alertNearbyCivilians(origin, 28);
};

npcs.onPlayerDamaged = (dmg) => {
  applyPlayerDamage(dmg);
};

npcs.onNpcKilled = (npc) => {
  if (npc.role === 'civilian') {
    wanted.addHeat(30);
  } else if (npc.role === 'police') {
    wanted.addHeat(65);
    objectives.cash += 100;
  } else if (npc.role === 'bounty') {
    wanted.addHeat(45);
  }
};

vehicles.onVehicleHitNpc = (vPos, speed) => {
  npcs.handleVehicleImpact(vPos, speed);
};

// Enter / Exit Vehicle on [E], Mute Audio on [M]
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    audioStatusEl.textContent = muted ? 'AUDIO: STUMM [M]' : 'AUDIO: AN [M]';
    audioStatusEl.classList.toggle('muted', muted);
    return;
  }

  if (e.code === 'KeyE' && player.getIsActive() && wastedTimer <= 0) {
    if (vehicles.isInVehicle()) {
      const exitPos = vehicles.exitVehicle();
      if (exitPos) {
        player.setSpawn(exitPos.x, exitPos.y, exitPos.z, exitPos.yaw);
        camera.fov = 75;
        camera.updateProjectionMatrix();
        weapons.setEnabled(true);
      }
    } else {
      const nearest = vehicles.findNearestVehicle(player.position, 4.4);
      if (nearest) {
        if (nearest.isPolice || nearest.isAiControlled) {
          wanted.addHeat(28);
        }
        vehicles.enterVehicle(nearest);
        weapons.setEnabled(false);
      }
    }
  }
});

// Pointer Lock flow
let pointerLockFallback = false;

function requestLockSafely(): void {
  try {
    const maybePromise = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {
        pointerLockFallback = true;
      });
    }
  } catch {
    pointerLockFallback = true;
  }
}

function startGame(): void {
  audio.unlock();
  overlay.classList.add('hidden');
  player.setActive(true);
  requestLockSafely();
}

function pauseGame(): void {
  player.setActive(false);
  overlay.classList.remove('hidden');
}

playBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

canvas.addEventListener('click', () => {
  audio.unlock();
  if (player.getIsActive() && !player.getIsLocked()) {
    requestLockSafely();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    pointerLockFallback = false;
    overlay.classList.add('hidden');
    player.setActive(true);
  } else if (!pointerLockFallback) {
    pauseGame();
  }
});

document.addEventListener('pointerlockerror', () => {
  pointerLockFallback = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && player.getIsActive() && !player.getIsLocked()) {
    pauseGame();
  }
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// Main Loop
let lastTime = performance.now();
const startTime = lastTime;

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  const elapsed = (now - startTime) / 1000;
  lastTime = now;

  // Handle Wasted respawn countdown
  if (wastedTimer > 0) {
    wastedTimer -= dt;
    if (wastedTimer <= 0) {
      wastedOverlayEl.classList.remove('visible');
      playerHp = 100;
      wanted.reset();
      npcs.clearPolice();
      player.setSpawn(60, 0.2, 24, 0.12);
    }
  }

  const isPlaying = player.getIsActive() && wastedTimer <= 0;
  const inVehicle = vehicles.isInVehicle();

  // Update player or vehicle
  let playerSpeed = 0;
  let playerGrounded = true;
  let headingYaw = player.getYaw();

  if (!inVehicle) {
    const status = player.update(dt, world.colliders);
    playerSpeed = status.speed;
    playerGrounded = status.grounded;
  } else {
    const car = vehicles.getActiveVehicle();
    if (car) {
      player.position.copy(car.position);
      headingYaw = car.yaw + Math.PI;
    }
  }

  const driveHud = vehicles.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    camera,
    world.colliders,
    world.layout.playableBounds,
  );

  // Update world, wanted, NPCs & objectives
  world.update(elapsed, dt);
  wanted.update(dt);
  npcs.update(dt, player.position, wanted.stars);
  const objHud = objectives.update(dt, elapsed, player.position, vehicles, npcs, wanted);

  if (objHud.completedCount > lastCompletedCount) {
    lastCompletedCount = objHud.completedCount;
    audio.playMissionPassed();
  }

  // Update procedural audio (engine, siren, footsteps, synthwave pulse)
  audio.update(
    dt,
    elapsed,
    isPlaying,
    driveHud.inVehicle,
    driveHud.speedKmh,
    playerSpeed,
    playerGrounded,
    wanted.stars,
  );

  // Update weapons when on foot
  const shootables = [...npcs.getShootableTargets(), ...vehicles.getShootableTargets()];
  const wHud = weapons.update(dt, isPlaying && !inVehicle, playerSpeed, world.worldMeshes, shootables);

  // Render Miami Radar / Minimap
  minimap.render(
    player.position.x,
    player.position.z,
    headingYaw,
    world.layout,
    vehicles.vehicles,
    npcs.npcs,
    objectives.current,
    elapsed,
  );

  // --- HUD Updates ---
  damageFlash = Math.max(0, damageFlash - dt * 2.2);
  damageVignetteEl.style.opacity = String(damageFlash);
  const hpPct = Math.round(playerHp);
  hpFillEl.style.width = `${hpPct}%`;
  hpTextEl.textContent = `${hpPct}`;

  const starStr = '★'.repeat(wanted.stars) + '☆'.repeat(5 - wanted.stars);
  starsEl.textContent = starStr;
  starsEl.classList.toggle('cooling', wanted.isCoolingDown());
  starsEl.classList.toggle('active', wanted.stars > 0);
  cashEl.textContent = `$${objHud.cash.toLocaleString('en-US')}`;

  objTitleEl.textContent = objHud.title;
  objDescEl.textContent = objHud.description;
  objDistEl.textContent = objHud.distanceM > 0 ? `${objHud.distanceM} m` : '';

  if (objHud.toastText) {
    toastBannerEl.textContent = objHud.toastText;
    toastBannerEl.classList.add('visible');
  } else {
    toastBannerEl.classList.remove('visible');
  }

  weaponPanelEl.classList.toggle('hidden', driveHud.inVehicle);
  crosshairEl.style.display = driveHud.inVehicle ? 'none' : 'block';
  vehiclePanelEl.classList.toggle('visible', driveHud.inVehicle);

  if (driveHud.inVehicle) {
    vehicleNameEl.textContent = driveHud.vehicleName;
    vehicleSpeedEl.textContent = `${driveHud.speedKmh}`;
    vehicleCamHintEl.textContent = `[V] ${driveHud.firstPersonCam ? 'COCKPIT' : 'CHASE'} · [E] AUSSTEIGEN`;
    interactPromptEl.classList.remove('visible');
  } else {
    weaponNameEl.textContent = wHud.name;
    ammoCurrentEl.textContent = wHud.reloading ? 'RLD' : String(wHud.ammo);
    ammoMaxEl.textContent = `/ ${wHud.magSize}`;
    reloadBarEl.classList.toggle('visible', wHud.reloading);
    reloadFillEl.style.width = `${Math.round(wHud.reloadProgress * 100)}%`;
    slotEls.forEach((el, idx) => el.classList.toggle('active', idx === wHud.slotIndex));

    crosshairEl.style.width = `${wHud.spreadPx}px`;
    crosshairEl.style.height = `${wHud.spreadPx}px`;
    crosshairEl.style.opacity = wHud.ads ? '0.45' : '0.88';

    hitmarkerEl.style.opacity = String(wHud.hitmarkerAlpha);
    hitmarkerEl.classList.toggle('kill', wHud.hitmarkerKill && wHud.hitmarkerAlpha > 0.05);

    if (driveHud.nearbyVehicleName) {
      interactPromptEl.textContent = `[E] EINSTEIGEN · ${driveHud.nearbyVehicleName}`;
      interactPromptEl.classList.add('visible');
    } else {
      interactPromptEl.classList.remove('visible');
    }
  }

  composer.render();
}

requestAnimationFrame(animate);
