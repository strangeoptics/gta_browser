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
import { ShopSystem } from './gameplay/ShopSystem';
import { Minimap } from './hud/Minimap';
import { AudioEngine } from './audio/AudioEngine';
import {
  clearProgress,
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
  type GameSettings,
} from './engine/Storage';

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
  document.getElementById('slot-4') as HTMLSpanElement,
];

const starsEl = document.getElementById('wanted-stars') as HTMLDivElement;
const cashEl = document.getElementById('cash-display') as HTMLDivElement;
const hpFillEl = document.getElementById('hp-fill') as HTMLDivElement;
const hpTextEl = document.getElementById('hp-text') as HTMLSpanElement;
const armorFillEl = document.getElementById('armor-fill') as HTMLDivElement;
const armorTextEl = document.getElementById('armor-text') as HTMLSpanElement;
const objTitleEl = document.getElementById('obj-title') as HTMLDivElement;
const objDescEl = document.getElementById('obj-desc') as HTMLDivElement;
const objDistEl = document.getElementById('obj-dist') as HTMLSpanElement;
const interactPromptEl = document.getElementById('interact-prompt') as HTMLDivElement;
const vehiclePanelEl = document.getElementById('vehicle-panel') as HTMLDivElement;
const vehicleNameEl = document.getElementById('vehicle-name') as HTMLDivElement;
const vehicleSpeedEl = document.getElementById('vehicle-speed') as HTMLSpanElement;
const vehicleHpFillEl = document.getElementById('vehicle-hp-fill') as HTMLDivElement;
const vehicleCamHintEl = document.getElementById('vehicle-cam-hint') as HTMLDivElement;
const toastBannerEl = document.getElementById('toast-banner') as HTMLDivElement;
const damageVignetteEl = document.getElementById('damage-vignette') as HTMLDivElement;
const wastedOverlayEl = document.getElementById('wasted-overlay') as HTMLDivElement;
const audioStatusEl = document.getElementById('audio-status') as HTMLDivElement;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;

// AMMU-NEON Shop Modal
const shopOverlayEl = document.getElementById('shop-overlay') as HTMLDivElement;
const shopCashEl = document.getElementById('shop-cash') as HTMLSpanElement;
const buyMedkitBtn = document.getElementById('buy-medkit') as HTMLButtonElement;
const buyArmorBtn = document.getElementById('buy-armor') as HTMLButtonElement;
const buyLauncherBtn = document.getElementById('buy-launcher') as HTMLButtonElement;
const shopCloseBtn = document.getElementById('shop-close') as HTMLButtonElement;

// Pause Settings & Saved Stats UI
const statCashEl = document.getElementById('stat-cash') as HTMLElement;
const statMissionsEl = document.getElementById('stat-missions') as HTMLElement;
const resetSaveBtn = document.getElementById('reset-save-btn') as HTMLButtonElement;
const optSensInput = document.getElementById('opt-sens') as HTMLInputElement;
const optSensValEl = document.getElementById('opt-sens-val') as HTMLSpanElement;
const optSfxInput = document.getElementById('opt-sfx') as HTMLInputElement;
const optSfxValEl = document.getElementById('opt-sfx-val') as HTMLSpanElement;
const optMusicInput = document.getElementById('opt-music') as HTMLInputElement;
const optMusicValEl = document.getElementById('opt-music-val') as HTMLSpanElement;
const optPerfInput = document.getElementById('opt-perf') as HTMLInputElement;

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
const shop = new ShopSystem(scene);
const minimap = new Minimap(minimapCanvas);
const audio = new AudioEngine();
objectives.startNextObjective(npcs, wanted);

// Player Controller — spawn on Ocean Drive near parked sports cars
const player = new PlayerController(camera, canvas);
const b = world.layout.playableBounds;
player.setWorldBounds(b.minX, b.maxX, b.minZ, b.maxZ);
player.setSpawn(60, 0.2, 24, 0.12);

// Player Health, Armor & Shop State (restored from localStorage)
const savedProgress = loadProgress();
let settings: GameSettings = loadSettings();
let playerHp = 100;
let playerArmor = savedProgress.armor;
let damageFlash = 0;
let wastedTimer = 0;
let lastCompletedCount = savedProgress.completedMissions;
let shopOpen = false;

objectives.cash = savedProgress.cash;
objectives.completedCount = savedProgress.completedMissions;
if (savedProgress.launcherUnlocked) {
  weapons.unlockLauncher();
  weapons.switchWeapon(0);
  slotEls[3].classList.remove('locked');
}

function persistProgress(): void {
  saveProgress({
    cash: objectives.cash,
    completedMissions: objectives.completedCount,
    launcherUnlocked: weapons.isLauncherUnlocked(),
    armor: Math.round(playerArmor),
  });
  statCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  statMissionsEl.textContent = String(objectives.completedCount);
}

function applySettings(next: GameSettings): void {
  settings = next;
  player.setSensitivityMultiplier(settings.mouseSensitivity);
  audio.setSfxVolume(settings.sfxVolume);
  audio.setMusicVolume(settings.musicVolume);
  renderer.shadowMap.enabled = !settings.performanceMode;
  renderer.setPixelRatio(settings.performanceMode ? 1 : Math.min(window.devicePixelRatio, 2));
  bloomPass.enabled = !settings.performanceMode;

  optSensInput.value = String(settings.mouseSensitivity);
  optSensValEl.textContent = `${settings.mouseSensitivity.toFixed(1)}×`;
  optSfxInput.value = String(settings.sfxVolume);
  optSfxValEl.textContent = `${Math.round(settings.sfxVolume * 100)}%`;
  optMusicInput.value = String(settings.musicVolume);
  optMusicValEl.textContent = `${Math.round(settings.musicVolume * 100)}%`;
  optPerfInput.checked = settings.performanceMode;
  saveSettings(settings);
}

applySettings(settings);
persistProgress();

optSensInput.addEventListener('input', () => {
  applySettings({ ...settings, mouseSensitivity: parseFloat(optSensInput.value) });
});
optSfxInput.addEventListener('input', () => {
  applySettings({ ...settings, sfxVolume: parseFloat(optSfxInput.value) });
});
optMusicInput.addEventListener('input', () => {
  applySettings({ ...settings, musicVolume: parseFloat(optMusicInput.value) });
});
optPerfInput.addEventListener('change', () => {
  applySettings({ ...settings, performanceMode: optPerfInput.checked });
});
resetSaveBtn.addEventListener('click', () => {
  clearProgress();
  objectives.cash = 0;
  objectives.completedCount = 0;
  lastCompletedCount = 0;
  playerArmor = 0;
  persistProgress();
});

function applyPlayerDamage(amount: number): void {
  if (wastedTimer > 0) return;
  let dmg = vehicles.isInVehicle() ? amount * 0.55 : amount;

  // Armor absorbs 75% of incoming damage
  if (playerArmor > 0) {
    const absorbed = Math.min(playerArmor, dmg * 0.75);
    playerArmor = Math.max(0, playerArmor - absorbed);
    dmg -= absorbed;
  }

  playerHp = Math.max(0, playerHp - dmg);
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

function triggerWorldExplosion(origin: THREE.Vector3, radius: number, maxDamage: number): void {
  audio.playExplosion();
  vehicles.spawnExplosionVfx(origin);
  npcs.applyBlastDamage(origin, radius, maxDamage);
  vehicles.applyBlastDamage(origin, radius, maxDamage * 0.85);
  wanted.addHeat(45);

  const distToPlayer = player.position.distanceTo(origin);
  if (distToPlayer < radius) {
    const playerDmg = maxDamage * 0.65 * (1 - distToPlayer / radius);
    applyPlayerDamage(playerDmg);
  }
}

// Wire system callbacks
weapons.onShotFired = (weaponId, origin) => {
  audio.playShot(weaponId);
  npcs.alertNearbyCivilians(origin, 28);
};

weapons.onExplosion = (origin, radius, damage) => {
  triggerWorldExplosion(origin, radius, damage);
};

vehicles.onVehicleExploded = (origin, radius, maxDamage) => {
  audio.playExplosion();
  npcs.applyBlastDamage(origin, radius, maxDamage);
  vehicles.applyBlastDamage(origin, radius, maxDamage * 0.8);
  wanted.addHeat(55);
  const distToPlayer = player.position.distanceTo(origin);
  if (distToPlayer < radius) {
    applyPlayerDamage(maxDamage * 0.6 * (1 - distToPlayer / radius));
  }
};

vehicles.onPoliceRamPlayer = (dmg) => {
  applyPlayerDamage(dmg);
};

vehicles.onCarCrash = (intensity, playerInvolved) => {
  audio.playCrash(intensity);
  if (playerInvolved && intensity > 0.45) {
    wanted.addHeat(12);
  }
};

vehicles.onActiveVehicleDestroyed = () => {
  const exitPos = vehicles.exitVehicle();
  if (exitPos) {
    player.setSpawn(exitPos.x, exitPos.y, exitPos.z, exitPos.yaw);
    camera.fov = 75;
    camera.updateProjectionMatrix();
    weapons.setEnabled(true);
  }
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

objectives.onCheckpointReached = () => {
  audio.playCheckpoint();
};

// AMMU-NEON Shop UI Flow
function refreshShopUi(): void {
  shopCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  buyMedkitBtn.disabled = objectives.cash < 250 || playerHp >= 100;
  buyArmorBtn.disabled = objectives.cash < 400 || playerArmor >= 100;
  if (weapons.isLauncherUnlocked()) {
    buyLauncherBtn.textContent = 'FREIGESCHALTET [4] · MUNITION VOLL ($200)';
    buyLauncherBtn.disabled = objectives.cash < 200;
  } else {
    buyLauncherBtn.textContent = 'NEON LAUNCHER [4] · $900';
    buyLauncherBtn.disabled = objectives.cash < 900;
  }
}

function openShop(): void {
  shopOpen = true;
  player.setActive(false);
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  refreshShopUi();
  shopOverlayEl.classList.add('visible');
}

function closeShop(): void {
  shopOpen = false;
  shopOverlayEl.classList.remove('visible');
  overlay.classList.add('hidden');
  player.setActive(true);
  requestLockSafely();
}

buyMedkitBtn.addEventListener('click', () => {
  if (objectives.cash < 250 || playerHp >= 100) return;
  objectives.cash -= 250;
  playerHp = Math.min(100, playerHp + 50);
  audio.playPurchase();
  persistProgress();
  refreshShopUi();
});

buyArmorBtn.addEventListener('click', () => {
  if (objectives.cash < 400 || playerArmor >= 100) return;
  objectives.cash -= 400;
  playerArmor = 100;
  audio.playPurchase();
  persistProgress();
  refreshShopUi();
});

buyLauncherBtn.addEventListener('click', () => {
  if (!weapons.isLauncherUnlocked()) {
    if (objectives.cash < 900) return;
    objectives.cash -= 900;
    weapons.unlockLauncher();
    slotEls[3].classList.remove('locked');
    audio.playPurchase();
    persistProgress();
    refreshShopUi();
  } else {
    if (objectives.cash < 200) return;
    objectives.cash -= 200;
    weapons.refillAllAmmo();
    audio.playPurchase();
    persistProgress();
    refreshShopUi();
  }
});

shopCloseBtn.addEventListener('click', () => {
  closeShop();
});

// Enter / Exit Vehicle on [E], Shop on [B], Radio on [Q], Mute Audio on [M]
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    audioStatusEl.textContent = muted ? 'AUDIO: STUMM [M]' : 'AUDIO: AN [M]';
    audioStatusEl.classList.toggle('muted', muted);
    return;
  }

  if (e.code === 'KeyQ' && player.getIsActive() && !shopOpen) {
    const station = audio.nextRadioStation();
    toastBannerEl.textContent = `RADIO · ${station}`;
    toastBannerEl.classList.add('visible');
    window.setTimeout(() => {
      if (toastBannerEl.textContent === `RADIO · ${station}`) {
        toastBannerEl.classList.remove('visible');
      }
    }, 1800);
    return;
  }

  if (e.code === 'KeyB' && wastedTimer <= 0) {
    if (shopOpen) {
      closeShop();
    } else if (player.getIsActive() && !vehicles.isInVehicle() && shop.isPlayerNear(player.position)) {
      openShop();
    }
    return;
  }

  if (e.code === 'Escape' && shopOpen) {
    closeShop();
    return;
  }

  if (e.code === 'KeyE' && player.getIsActive() && !shopOpen && wastedTimer <= 0) {
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
  if (shopOpen) return;
  player.setActive(false);
  persistProgress();
  overlay.classList.remove('hidden');
}

playBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

canvas.addEventListener('click', () => {
  audio.unlock();
  if (player.getIsActive() && !player.getIsLocked() && !shopOpen) {
    requestLockSafely();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    pointerLockFallback = false;
    overlay.classList.add('hidden');
    player.setActive(true);
  } else if (!pointerLockFallback && !shopOpen) {
    pauseGame();
  }
});

document.addEventListener('pointerlockerror', () => {
  pointerLockFallback = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && player.getIsActive() && !player.getIsLocked() && !shopOpen) {
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

  const isPlaying = player.getIsActive() && !shopOpen && wastedTimer <= 0;
  const inVehicle = vehicles.isInVehicle();

  let playerSpeed = 0;
  let playerGrounded = true;
  let headingYaw = player.getYaw();

  if (!inVehicle) {
    const allColliders = [...world.colliders, ...vehicles.getVehicleColliders()];
    const status = player.update(dt, allColliders);
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
    wanted.stars,
    camera,
    world.colliders,
    world.layout.playableBounds,
  );

  world.update(elapsed, dt);
  shop.update(elapsed);
  wanted.update(dt);
  npcs.update(dt, player.position, wanted.stars);
  const objHud = objectives.update(dt, elapsed, player.position, vehicles, npcs, wanted);

  if (objHud.completedCount > lastCompletedCount) {
    lastCompletedCount = objHud.completedCount;
    audio.playMissionPassed();
    persistProgress();
  }

  audio.update(
    dt,
    elapsed,
    isPlaying,
    driveHud.inVehicle,
    driveHud.speedKmh,
    driveHud.drifting,
    playerSpeed,
    playerGrounded,
    wanted.stars,
  );

  const shootables = [...npcs.getShootableTargets(), ...vehicles.getShootableTargets()];
  const wHud = weapons.update(dt, isPlaying && !inVehicle, playerSpeed, world.worldMeshes, shootables);

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

  const armorPct = Math.round(playerArmor);
  armorFillEl.style.width = `${armorPct}%`;
  armorTextEl.textContent = `${armorPct}`;

  const starStr = '★'.repeat(wanted.stars) + '☆'.repeat(5 - wanted.stars);
  starsEl.textContent = starStr;
  starsEl.classList.toggle('cooling', wanted.isCoolingDown());
  starsEl.classList.toggle('active', wanted.stars > 0);
  cashEl.textContent = `$${objHud.cash.toLocaleString('en-US')}`;

  objTitleEl.textContent = objHud.title;
  objDescEl.textContent = objHud.description;
  if (objHud.timerText && objHud.distanceM > 0) {
    objDistEl.textContent = `${objHud.timerText} · ${objHud.distanceM} m`;
  } else if (objHud.timerText) {
    objDistEl.textContent = objHud.timerText;
  } else {
    objDistEl.textContent = objHud.distanceM > 0 ? `${objHud.distanceM} m` : '';
  }

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
    vehicleHpFillEl.style.width = `${driveHud.hpPct}%`;
    vehicleHpFillEl.classList.toggle('low', driveHud.hpPct < 35);
    vehicleCamHintEl.textContent = `[Q] ${audio.getRadioStation()} · [V] ${driveHud.firstPersonCam ? 'COCKPIT' : 'CHASE'} · [E] AUS`;
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

    if (shop.isPlayerNear(player.position) && !shopOpen) {
      interactPromptEl.textContent = '[B] AMMU-NEON SHOP ÖFFNEN ($)';
      interactPromptEl.classList.add('visible');
    } else if (driveHud.nearbyVehicleName) {
      interactPromptEl.textContent = `[E] EINSTEIGEN · ${driveHud.nearbyVehicleName}`;
      interactPromptEl.classList.add('visible');
    } else {
      interactPromptEl.classList.remove('visible');
    }
  }

  composer.render();
}

requestAnimationFrame(animate);
