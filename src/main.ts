import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './style.css';
import { PlayerController } from './player/PlayerController';
import { PlayerAvatar } from './player/PlayerAvatar';
import { buildMiamiCity } from './world/CityBuilder';
import { WeaponSystem } from './combat/WeaponSystem';
import { VehicleSystem } from './vehicles/VehicleSystem';
import { BoatSystem } from './vehicles/BoatSystem';
import { DestructibleProps } from './world/DestructibleProps';
import { DecalSystem } from './world/DecalSystem';
import { RoadblockSystem } from './world/RoadblockSystem';
import { NpcSystem } from './entities/NpcSystem';
import { HelicopterSystem } from './entities/HelicopterSystem';
import { WantedSystem } from './gameplay/WantedSystem';
import { ObjectiveSystem } from './gameplay/ObjectiveSystem';
import { HeistSystem } from './gameplay/HeistSystem';
import { ShopSystem } from './gameplay/ShopSystem';
import { PayNSpray } from './gameplay/PayNSpray';
import { Minimap } from './hud/Minimap';
import { AudioEngine } from './audio/AudioEngine';
import { GamepadInput } from './engine/GamepadInput';
import { TouchControls } from './engine/TouchControls';
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
  document.getElementById('slot-0') as HTMLSpanElement,
  document.getElementById('slot-1') as HTMLSpanElement,
  document.getElementById('slot-2') as HTMLSpanElement,
  document.getElementById('slot-3') as HTMLSpanElement,
  document.getElementById('slot-4') as HTMLSpanElement,
];

const objTagEl = document.querySelector('.obj-tag') as HTMLSpanElement;

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
const hudEl = document.getElementById('hud') as HTMLDivElement;
const photoBarEl = document.getElementById('photo-bar') as HTMLDivElement;
const toastBannerEl = document.getElementById('toast-banner') as HTMLDivElement;
const dispatchBannerEl = document.getElementById('dispatch-banner') as HTMLDivElement;
const dispatchTextEl = document.getElementById('dispatch-text') as HTMLSpanElement;
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
const destructibles = new DestructibleProps(scene);
const decals = new DecalSystem(scene);
const roadblocks = new RoadblockSystem(scene);
const weapons = new WeaponSystem(scene, camera);
const vehicles = new VehicleSystem(scene);
const boat = new BoatSystem(scene);
const npcs = new NpcSystem(scene);
const heli = new HelicopterSystem(scene);
const wanted = new WantedSystem();
const objectives = new ObjectiveSystem(scene);
const heist = new HeistSystem(scene);
const shop = new ShopSystem(scene);
const payNSpray = new PayNSpray(scene);
const minimap = new Minimap(minimapCanvas);
const audio = new AudioEngine();
const gamepad = new GamepadInput();
const touchControlsEl = document.getElementById('touch-controls') as HTMLDivElement;
const touch = new TouchControls(touchControlsEl, canvas);
let padConnectedToastShown = false;
objectives.startNextObjective(npcs, wanted);

// Player Controller & 3rd-Person Avatar — spawn on Ocean Drive near parked sports cars
const player = new PlayerController(camera, canvas);
const playerAvatar = new PlayerAvatar(scene);
const b = world.layout.playableBounds;
player.setWorldBounds(b.minX, b.maxX, b.minZ, b.maxZ);
player.setSpawn(60, 0.2, 24, 0.12);

// Player Health, Armor & Shop State (restored from localStorage)
const savedProgress = loadProgress();
let settings: GameSettings = loadSettings();
let playerHp = 100;
let playerArmor = savedProgress.armor;
let damageFlash = 0;
let shakeTrauma = 0;
let lastWantedStars = 0;
let dispatchTimer = 0;
let dispatchCooldown = 0;
let wastedTimer = 0;

function addCameraShake(amount: number): void {
  shakeTrauma = Math.min(1.0, shakeTrauma + amount);
}

function sendPoliceDispatch(message: string, force = false): void {
  if (!force && dispatchCooldown > 0) return;
  dispatchCooldown = 4.5;
  dispatchTimer = 4.2;
  dispatchTextEl.textContent = message;
  dispatchBannerEl.classList.add('visible');
  audio.playRadioChirp();
}
let lastCompletedCount = savedProgress.completedMissions;
let shopOpen = false;
let photoMode = false;
let photoYaw = 0;
let photoPitch = 0;
const photoKeys = new Set<string>();

objectives.cash = savedProgress.cash;
objectives.completedCount = savedProgress.completedMissions;
if (savedProgress.launcherUnlocked) {
  weapons.unlockLauncher();
  weapons.switchWeapon(1);
  slotEls[4].classList.remove('locked');
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
  addCameraShake(0.28);
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
  decals.addScorchMark(origin.x, origin.z);
  npcs.applyBlastDamage(origin, radius, maxDamage);
  vehicles.applyBlastDamage(origin, radius, maxDamage * 0.85);
  heli.applyBlastDamage(origin, radius, maxDamage * 1.1);
  wanted.addHeat(45);

  const distToPlayer = player.position.distanceTo(origin);
  addCameraShake(Math.max(0.2, 0.85 - distToPlayer * 0.025));
  if (distToPlayer < radius) {
    const playerDmg = maxDamage * 0.65 * (1 - distToPlayer / radius);
    applyPlayerDamage(playerDmg);
  }
}

// Wire system callbacks
weapons.onShotFired = (weaponId, origin) => {
  if (weaponId === 'katana') {
    audio.playKatanaSlash();
    return;
  }
  audio.playShot(weaponId);
  if (weaponId === 'shotgun') addCameraShake(0.22);
  else if (weaponId === 'launcher') addCameraShake(0.35);
  npcs.alertNearbyCivilians(origin, 28);
};

weapons.onWorldImpact = (point, normal) => {
  decals.addBulletHole(point, normal);
};

weapons.onExplosion = (origin, radius, damage) => {
  triggerWorldExplosion(origin, radius, damage);
};

vehicles.onVehicleExploded = (origin, radius, maxDamage) => {
  audio.playExplosion();
  decals.addScorchMark(origin.x, origin.z);
  npcs.applyBlastDamage(origin, radius, maxDamage);
  vehicles.applyBlastDamage(origin, radius, maxDamage * 0.8);
  wanted.addHeat(55);
  const distToPlayer = player.position.distanceTo(origin);
  addCameraShake(Math.max(0.25, 0.9 - distToPlayer * 0.025));
  if (distToPlayer < radius) {
    applyPlayerDamage(maxDamage * 0.6 * (1 - distToPlayer / radius));
  }
};

vehicles.onDriftMark = (x, z, yaw) => {
  decals.addSkidmark(x, z, yaw);
};

vehicles.onStuntLanded = (distM, reward) => {
  objectives.cash += reward;
  audio.playMissionPassed();
  addCameraShake(0.32);
  persistProgress();
  showQuickToast(`INSANE STUNT BONUS · ${distM}m · +$${reward}`);
};

vehicles.onPoliceRamPlayer = (dmg) => {
  applyPlayerDamage(dmg);
};

vehicles.onCarCrash = (intensity, playerInvolved) => {
  audio.playCrash(intensity);
  if (playerInvolved) {
    addCameraShake(intensity * 0.55);
    if (intensity > 0.45) {
      wanted.addHeat(12);
    }
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
  const car = vehicles.getActiveVehicle();
  if (car) {
    destructibles.handleVehicleImpact(vPos, car.yaw, speed);
    roadblocks.handleVehicleImpact(vPos, car.yaw, speed);
  }
};

roadblocks.onBarricadeSmashed = () => {
  audio.playCrash(0.5);
  addCameraShake(0.28);
};

destructibles.onPropSmashed = (kind) => {
  if (kind === 'hydrant') audio.playWaterSplash();
  else audio.playCrash(0.32);
};

world.onThunder = () => {
  audio.playThunder();
};

heli.onPlayerDamaged = (dmg) => {
  applyPlayerDamage(dmg);
};

heli.onHelicopterDestroyed = (impactPos) => {
  audio.playExplosion();
  vehicles.spawnExplosionVfx(impactPos);
  decals.addScorchMark(impactPos.x, impactPos.z);
  addCameraShake(0.85);
  objectives.cash += 1500;
  persistProgress();
  showQuickToast('VICE PD CHOPPER ABGESCHOSSEN · +$1.500');
  sendPoliceDispatch('Mayday! Air-One ist abgestürzt — Verstärkung anfordern!', true);
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
    slotEls[4].classList.remove('locked');
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

function tryToggleVehicleOrBoat(): void {
  if (boat.isInBoat()) {
    const land = boat.disembark();
    player.setSpawn(land.x, land.y, land.z, land.yaw);
    camera.fov = 75;
    camera.updateProjectionMatrix();
    weapons.setEnabled(true);
  } else if (vehicles.isInVehicle()) {
    const exitPos = vehicles.exitVehicle();
    if (exitPos) {
      player.setSpawn(exitPos.x, exitPos.y, exitPos.z, exitPos.yaw);
      camera.fov = 75;
      camera.updateProjectionMatrix();
      weapons.setEnabled(true);
    }
  } else if (boat.isPlayerNear(player.position)) {
    boat.board();
    weapons.setEnabled(false);
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

function tryUsePayNSpray(): void {
  const car = vehicles.getActiveVehicle();
  if (car && payNSpray.isCarInBay(car.position)) {
    if (objectives.cash >= payNSpray.cost) {
      objectives.cash -= payNSpray.cost;
      payNSpray.resprayVehicle(car);
      wanted.reset();
      npcs.clearPolice();
      heli.clear();
      audio.playPurchase();
      persistProgress();
      showQuickToast("PAY 'N' SPRAY · REPARIERT & STERNE GELÖSCHT");
      sendPoliceDispatch('Sichtkontakt verloren — alle Einheiten abbrechen.', true);
    } else {
      showQuickToast(`ZU WENIG CASH · BENÖTIGT $${payNSpray.cost}`);
    }
  }
}

window.addEventListener('keyup', (e) => {
  photoKeys.delete(e.code);
});

window.addEventListener('mousemove', (e) => {
  if (!photoMode || document.pointerLockElement !== canvas) return;
  photoYaw -= e.movementX * 0.0022 * settings.mouseSensitivity;
  photoPitch = Math.max(-1.45, Math.min(1.45, photoPitch - e.movementY * 0.0022 * settings.mouseSensitivity));
});

// Enter / Exit Vehicle on [E], Shop on [B], Radio on [Q], Photo Mode on [P], Mute Audio on [M]
window.addEventListener('keydown', (e) => {
  photoKeys.add(e.code);

  if (e.code === 'KeyP' && (player.getIsActive() || photoMode) && !shopOpen) {
    photoMode = !photoMode;
    hudEl.classList.toggle('photo-hidden', photoMode);
    photoBarEl.classList.toggle('visible', photoMode);
    if (photoMode) {
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      photoYaw = euler.y;
      photoPitch = euler.x;
      weapons.setViewmodelVisible(false);
    } else {
      weapons.setViewmodelVisible(!vehicles.isInVehicle() && !boat.isInBoat() && !player.isThirdPerson());
    }
    return;
  }

  if (e.code === 'KeyK' && photoMode) {
    // Capture clean PNG screenshot directly from WebGL canvas
    composer.render();
    const link = document.createElement('a');
    link.download = `vice-dusk-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return;
  }

  if (photoMode) return;
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    audioStatusEl.textContent = muted ? 'AUDIO: STUMM [M]' : 'AUDIO: AN [M]';
    audioStatusEl.classList.toggle('muted', muted);
    return;
  }

  if (e.code === 'KeyQ' && player.getIsActive() && !shopOpen) {
    const station = audio.nextRadioStation();
    showQuickToast(`RADIO · ${station}`);
    return;
  }

  if (e.code === 'KeyT' && player.getIsActive() && !shopOpen) {
    const label = world.cycleTimeOfDay();
    showQuickToast(`LICHT · ${label}`);
    return;
  }

  if (e.code === 'KeyY' && player.getIsActive() && !shopOpen) {
    const raining = world.toggleRain();
    showQuickToast(raining ? 'WETTER · TROPENSCHAUER' : 'WETTER · NACH DEM REGEN');
    return;
  }

  if (e.code === 'KeyH' && player.getIsActive() && !shopOpen && wastedTimer <= 0) {
    if (!heist.isActive()) {
      heist.startHeist();
      audio.playCheckpoint();
    }
    return;
  }

  if (e.code === 'KeyF' && player.getIsActive() && !shopOpen && wastedTimer <= 0) {
    if (vehicles.isInVehicle()) {
      tryUsePayNSpray();
    } else if (world.isNearClubBar(player.position)) {
      if (playerHp >= 100) {
        showQuickToast('HP BEREITS VOLL');
      } else if (objectives.cash >= 50) {
        objectives.cash -= 50;
        playerHp = Math.min(100, playerHp + 30);
        audio.playPurchase();
        persistProgress();
        showQuickToast('MIAMI VICE COCKTAIL · +30 HP');
      } else {
        showQuickToast('ZU WENIG CASH · COCKTAIL KOSTET $50');
      }
    }
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
    tryToggleVehicleOrBoat();
    return;
  }

  if (e.code === 'KeyV' && player.getIsActive() && !shopOpen && !vehicles.isInVehicle() && !boat.isInBoat()) {
    const is3p = player.toggleThirdPerson();
    weapons.setViewmodelVisible(!is3p);
    showQuickToast(is3p ? 'KAMERA · 3RD PERSON' : 'KAMERA · FIRST PERSON');
  }
});

function showQuickToast(text: string): void {
  toastBannerEl.textContent = text;
  toastBannerEl.classList.add('visible');
  window.setTimeout(() => {
    if (toastBannerEl.textContent === text) {
      toastBannerEl.classList.remove('visible');
    }
  }, 1900);
}

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

  // Photo Mode: freeze simulation and let user free-fly the camera!
  if (photoMode) {
    const flySpd = (photoKeys.has('ShiftLeft') ? 22 : 10) * dt;
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(photoPitch, photoYaw, 0, 'YXZ'));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, photoYaw, 0, 'YXZ'));
    if (photoKeys.has('KeyW')) camera.position.addScaledVector(fwd, flySpd);
    if (photoKeys.has('KeyS')) camera.position.addScaledVector(fwd, -flySpd);
    if (photoKeys.has('KeyD')) camera.position.addScaledVector(right, flySpd);
    if (photoKeys.has('KeyA')) camera.position.addScaledVector(right, -flySpd);
    if (photoKeys.has('KeyE') || photoKeys.has('Space')) camera.position.y += flySpd;
    if (photoKeys.has('KeyQ') || photoKeys.has('KeyC')) camera.position.y = Math.max(0.4, camera.position.y - flySpd);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = photoYaw;
    camera.rotation.x = photoPitch;
    camera.rotation.z = 0;
    composer.render();
    return;
  }

  // Handle Wasted respawn countdown
  if (wastedTimer > 0) {
    wastedTimer -= dt;
    if (wastedTimer <= 0) {
      wastedOverlayEl.classList.remove('visible');
      playerHp = 100;
      wanted.reset();
      npcs.clearPolice();
      heli.clear();
      if (heist.isActive()) heist.failHeist();
      player.setSpawn(60, 0.2, 24, 0.12);
    }
  }

  const rawPad = gamepad.poll();
  if (rawPad.connected && !padConnectedToastShown) {
    padConnectedToastShown = true;
    showQuickToast('GAMEPAD VERBUNDEN · CONTROLLER AKTIV');
  } else if (!rawPad.connected) {
    padConnectedToastShown = false;
  }
  const pad = touch.mergeInto(rawPad);

  if (pad.connected && pad.startPressed) {
    if (shopOpen) closeShop();
    else if (player.getIsActive()) pauseGame();
    else startGame();
  }

  const isPlaying = player.getIsActive() && !shopOpen && wastedTimer <= 0;

  if (isPlaying && pad.connected) {
    if (pad.interactPressed) tryToggleVehicleOrBoat();
    if (pad.camTogglePressed && !vehicles.isInVehicle() && !boat.isInBoat()) {
      const is3p = player.toggleThirdPerson();
      weapons.setViewmodelVisible(!is3p);
      showQuickToast(is3p ? 'KAMERA · 3RD PERSON' : 'KAMERA · FIRST PERSON');
    }
    if (pad.reloadOrSprayPressed && vehicles.isInVehicle()) tryUsePayNSpray();
    if (pad.prevWeaponPressed && (vehicles.isInVehicle() || boat.isInBoat())) {
      const station = audio.nextRadioStation();
      showQuickToast(`RADIO · ${station}`);
    }
    if (pad.timeCyclePressed) showQuickToast(`LICHT · ${world.cycleTimeOfDay()}`);
    if (pad.rainTogglePressed) {
      showQuickToast(world.toggleRain() ? 'WETTER · TROPENSCHAUER' : 'WETTER · NACH DEM REGEN');
    }
  }

  const inVehicle = vehicles.isInVehicle();
  const inBoat = boat.isInBoat();
  const inAnyCraft = inVehicle || inBoat;

  let playerSpeed = 0;
  let playerGrounded = true;
  let playerCrouching = false;
  let headingYaw = player.getYaw();

  if (!inAnyCraft) {
    const allColliders = [
      ...world.colliders,
      ...vehicles.getVehicleColliders(),
      ...npcs.getNpcColliders(),
    ];
    const status = player.update(
      dt,
      allColliders,
      pad,
      world.getGroundHeight,
      world.worldMeshes,
      weapons.isAdsActive(),
    );
    playerSpeed = status.speed;
    playerGrounded = status.grounded;
    playerCrouching = status.crouching;
  } else if (inVehicle) {
    const car = vehicles.getActiveVehicle();
    if (car) {
      player.position.copy(car.position);
      headingYaw = car.yaw + Math.PI;
    }
  } else if (inBoat) {
    player.position.copy(boat.position);
    headingYaw = boat.yaw + Math.PI;
  }

  const driveHud = vehicles.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    wanted.stars,
    camera,
    [...world.colliders, ...roadblocks.getActiveColliders()],
    world.layout.playableBounds,
    pad,
    world.stuntRamps,
    world.shouldTrafficStop,
  );
  const boatHud = boat.update(dt, elapsed, isPlaying, player.position, camera, pad);

  world.update(elapsed, dt, player.position);
  destructibles.update(dt);
  roadblocks.update(dt, elapsed, wanted.stars);
  shop.update(elapsed);
  payNSpray.update(dt, elapsed);
  wanted.update(dt);

  // Vice PD Radio Dispatch triggers on Wanted star escalation
  if (dispatchCooldown > 0) dispatchCooldown -= dt;
  if (dispatchTimer > 0) {
    dispatchTimer -= dt;
    if (dispatchTimer <= 0) dispatchBannerEl.classList.remove('visible');
  }
  if (wanted.stars > lastWantedStars) {
    const activeCar = vehicles.getActiveVehicle();
    const area = player.position.x > 48 ? 'Ocean Drive' : 'Downtown Vice';
    if (wanted.stars === 1) {
      sendPoliceDispatch(`10-31 am ${area} — Verdächtiger gesichtet!`);
    } else if (wanted.stars === 2) {
      const carNote = activeCar ? ` im ${activeCar.name}` : '';
      sendPoliceDispatch(`Alle Streifenwagen: Verfolgung${carNote} am ${area}!`, true);
    } else if (wanted.stars >= 3) {
      sendPoliceDispatch(`Code 3! Air-One Helikopter startet über ${area}!`, true);
    }
  }
  lastWantedStars = wanted.stars;
  const insideClub = world.isInsideClub(player.position);
  npcs.update(dt, player.position, wanted.stars);
  heli.update(dt, elapsed, player.position, insideClub ? 0 : wanted.stars);
  const heistHud = heist.update(elapsed, player.position, vehicles, boat, npcs, wanted);
  const objHud = objectives.update(dt, elapsed, player.position, vehicles, npcs, wanted);

  if (heistHud.stageToast) {
    showQuickToast(heistHud.stageToast);
    if (heistHud.justCompleted) {
      objectives.cash += heist.reward;
      objectives.completedCount++;
      lastCompletedCount = objectives.completedCount;
      wanted.reset();
      npcs.clearPolice();
      heli.clear();
      audio.playMissionPassed();
      persistProgress();
    } else {
      audio.playCheckpoint();
    }
  }

  if (objHud.completedCount > lastCompletedCount) {
    lastCompletedCount = objHud.completedCount;
    audio.playMissionPassed();
    persistProgress();
  }

  audio.update(
    dt,
    elapsed,
    isPlaying,
    inAnyCraft,
    inBoat ? boatHud.speedKmh : driveHud.speedKmh,
    driveHud.drifting,
    playerSpeed,
    playerGrounded,
    wanted.stars,
    player.position.x,
    world.getClubProximity(player.position),
  );

  const shootables = [
    ...npcs.getShootableTargets(),
    ...vehicles.getShootableTargets(),
    ...destructibles.getShootableTargets(),
    ...heli.getShootableTargets(),
  ];
  const wHud = weapons.update(dt, isPlaying && !inAnyCraft, playerSpeed, world.worldMeshes, shootables, pad);
  weapons.setViewmodelVisible(!inAnyCraft && !player.isThirdPerson());
  playerAvatar.setVisible(!inAnyCraft && player.isThirdPerson());
  playerAvatar.update(
    dt,
    player.position,
    player.getYaw(),
    playerSpeed,
    playerGrounded,
    playerCrouching,
    wHud.ads,
    wHud.isMelee,
  );
  if (inVehicle) {
    const car = vehicles.getActiveVehicle();
    if (car) {
      weapons.updateDriveBy(dt, isPlaying, car.position, world.worldMeshes, shootables, pad);
    }
  }

  minimap.render(
    player.position.x,
    player.position.z,
    headingYaw,
    world.layout,
    vehicles.vehicles,
    npcs.npcs,
    objectives.current,
    elapsed,
    heli.active ? heli.position : null,
    heistHud.targetPos,
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

  if (heistHud.active) {
    objTagEl.textContent = '★ HEIST';
    objTagEl.classList.add('heist');
    objTitleEl.textContent = heistHud.title;
    objDescEl.textContent = heistHud.description;
    objDistEl.textContent = `${heistHud.distanceM} m`;
  } else {
    objTagEl.textContent = 'ZIEL · [H] HEIST';
    objTagEl.classList.remove('heist');
    objTitleEl.textContent = objHud.title;
    objDescEl.textContent = objHud.description;
    if (objHud.timerText && objHud.distanceM > 0) {
      objDistEl.textContent = `${objHud.timerText} · ${objHud.distanceM} m`;
    } else if (objHud.timerText) {
      objDistEl.textContent = objHud.timerText;
    } else {
      objDistEl.textContent = objHud.distanceM > 0 ? `${objHud.distanceM} m` : '';
    }
  }

  if (objHud.toastText) {
    toastBannerEl.textContent = objHud.toastText;
    toastBannerEl.classList.add('visible');
  } else {
    toastBannerEl.classList.remove('visible');
  }

  weaponPanelEl.classList.toggle('hidden', inAnyCraft);
  crosshairEl.style.display = inAnyCraft ? 'none' : 'block';
  vehiclePanelEl.classList.toggle('visible', inAnyCraft);

  if (boatHud.inBoat) {
    vehicleNameEl.textContent = boatHud.boatName;
    vehicleSpeedEl.textContent = `${boatHud.speedKmh}`;
    vehicleHpFillEl.style.width = '100%';
    vehicleHpFillEl.classList.remove('low');
    vehicleCamHintEl.textContent = `[Q] ${audio.getRadioStation()} · [E] AN LAND`;
    interactPromptEl.classList.remove('visible');
  } else if (driveHud.inVehicle) {
    vehicleNameEl.textContent = driveHud.vehicleName;
    vehicleSpeedEl.textContent = `${driveHud.speedKmh}`;
    vehicleHpFillEl.style.width = `${driveHud.hpPct}%`;
    vehicleHpFillEl.classList.toggle('low', driveHud.hpPct < 35);
    vehicleCamHintEl.textContent = `[LMB] DRIVE-BY · [Q] ${audio.getRadioStation()} · [V] CAM · [E] AUS`;
    const car = vehicles.getActiveVehicle();
    if (car && payNSpray.isCarInBay(car.position)) {
      interactPromptEl.textContent = `[F] PAY 'N' SPRAY · $${payNSpray.cost} (REPARATUR & STERNE WEG)`;
      interactPromptEl.classList.add('visible');
    } else {
      interactPromptEl.classList.remove('visible');
    }
  } else {
    weaponNameEl.textContent = wHud.name;
    ammoCurrentEl.textContent = wHud.isMelee ? '∞' : wHud.reloading ? 'RLD' : String(wHud.ammo);
    ammoMaxEl.textContent = wHud.isMelee ? 'MELEE' : `/ ${wHud.magSize}`;
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
    } else if (world.isNearClubBar(player.position)) {
      interactPromptEl.textContent = '[F] MIAMI VICE COCKTAIL · $50 (+30 HP)';
      interactPromptEl.classList.add('visible');
    } else if (heistHud.nearStartMarker && !heistHud.active) {
      interactPromptEl.textContent = '[H] OCEAN CLUB HEIST STARTEN (+$3.500)';
      interactPromptEl.classList.add('visible');
    } else if (boatHud.nearbyBoat) {
      interactPromptEl.textContent = '[E] EINSTEIGEN · STINGER SPEEDBOAT';
      interactPromptEl.classList.add('visible');
    } else if (driveHud.nearbyVehicleName) {
      interactPromptEl.textContent = `[E] EINSTEIGEN · ${driveHud.nearbyVehicleName}`;
      interactPromptEl.classList.add('visible');
    } else {
      interactPromptEl.classList.remove('visible');
    }
  }

  // Apply decaying Camera-Shake right before rendering
  if (shakeTrauma > 0.001) {
    const s = shakeTrauma * shakeTrauma;
    camera.position.x += (Math.random() - 0.5) * s * 0.45;
    camera.position.y += (Math.random() - 0.5) * s * 0.45;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.06;
    shakeTrauma = Math.max(0, shakeTrauma - dt * 2.4);
  }

  composer.render();
}

requestAnimationFrame(animate);
