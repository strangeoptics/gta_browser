import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './style.css';
import { PlayerController } from './player/PlayerController';
import { PlayerAvatar } from './player/PlayerAvatar';
import { buildMiamiCity } from './world/CityBuilder';
import type { CabinetWeapon, FoodItem } from './world/Safehouse';
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
import { VigilanteSystem } from './gameplay/VigilanteSystem';
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
const vigilante = new VigilanteSystem();
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
let isBustedState = false;
let bustProgress = 0;
let lastBustedFine = 0;
let cocktailScore = 0; // <= 1.0 = sober, > 1.0 = progressively drunk (max 4.5 -> drunkLevel 1.0)
const wastedTextEl = wastedOverlayEl.querySelector<HTMLElement>('.wasted-text')!;
const wastedSubEl = wastedOverlayEl.querySelector<HTMLElement>('.wasted-sub')!;

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
const foodRaycaster = new THREE.Raycaster();
let lookedFood: FoodItem | null = null;
let lookedCabinetWeapon: CabinetWeapon | null = null;
let lookedAtTv = false;
let handHoldTimer = 0;

function toggleSafehouseTv(): void {
  const isOn = world.toggleTv(objectives.cash, wanted.stars);
  if (isOn) {
    audio.playNewsJingle();
    showQuickToast('VICE CHANNEL 6 · BREAKING NEWS LIVE');
  } else {
    showQuickToast('FERNSEHER AUSGESCHALTET');
  }
}

function equipCabinetWeapon(): boolean {
  if (!lookedCabinetWeapon) return false;
  const cw = lookedCabinetWeapon;
  if (cw.slotIndex === 4 && !weapons.isLauncherUnlocked()) {
    showQuickToast('NEON LAUNCHER · ERST IM AMMU-NEON SHOP ($) FREISCHALTEN');
    return true;
  }
  weapons.refillAllAmmo();
  weapons.switchWeapon(cw.slotIndex);
  audio.playPurchase();
  showQuickToast(`WAFFENSCHRANK · ${cw.name} AUSGERÜSTET & GELADEN`);
  return true;
}

function eatLookedFood(): boolean {
  if (!lookedFood || !lookedFood.available) return false;
  const item = lookedFood;
  world.consumeFood(item);
  const prevHp = playerHp;
  playerHp = Math.min(100, playerHp + item.heal);
  const gained = Math.round(playerHp - prevHp);
  audio.playEatCrunch();
  weapons.triggerEatAnimation();
  handHoldTimer = 0.45; // keep hand visible briefly during bite animation!
  showQuickToast(
    gained > 0 ? `${item.name} GEGESSEN · +${gained} HP` : `${item.name} GEGESSEN · LECKER!`,
  );
  lookedFood = null;
  return true;
}

objectives.cash = savedProgress.cash;
objectives.completedCount = savedProgress.completedMissions;
playerAvatar.setOutfit(savedProgress.outfitIndex);
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
    outfitIndex: playerAvatar.getOutfitIndex(),
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
  objectives.cash = 300;
  objectives.completedCount = 0;
  lastCompletedCount = 0;
  playerArmor = 0;
  persistProgress();
});

function triggerBusted(): void {
  if (wastedTimer > 0) return;
  isBustedState = true;
  bustProgress = 0;
  wastedTimer = 2.8;
  const fine = Math.min(objectives.cash, 250 * Math.max(1, wanted.stars));
  lastBustedFine = fine;
  objectives.cash -= fine;
  persistProgress();
  wastedTextEl.textContent = 'VERHAFTET';
  wastedSubEl.textContent =
    fine > 0
      ? `Vice PD Precinct 06 · -$${fine} Kaution (Waffen behalten)`
      : 'Vice PD Precinct 06 · Überführung in die Zelle…';
  wastedOverlayEl.classList.add('busted', 'visible');
  audio.playWasted();
  if (vehicles.isInVehicle()) {
    vehicles.exitVehicle();
    weapons.setEnabled(true);
  }
  if (boat.isInBoat()) {
    boat.disembark();
    weapons.setEnabled(true);
  }
}

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
    if (wanted.stars >= 2) {
      triggerBusted();
      return;
    }
    isBustedState = false;
    wastedTimer = 2.6;
    wastedTextEl.textContent = 'WASTED';
    wastedSubEl.textContent = 'Respawn am Vice Safehouse…';
    wastedOverlayEl.classList.remove('busted');
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

window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && player.getIsActive() && !shopOpen && !photoMode && !vehicles.isInVehicle() && !boat.isInBoat()) {
    if (lookedFood && lookedFood.available) {
      eatLookedFood();
    } else if (lookedCabinetWeapon) {
      equipCabinetWeapon();
    } else if (lookedAtTv) {
      toggleSafehouseTv();
    }
  }
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

  if (e.code === 'KeyG' && player.getIsActive() && !shopOpen && wastedTimer <= 0) {
    const car = vehicles.getActiveVehicle();
    if (vigilante.isActive()) {
      vigilante.stop();
      showQuickToast('VIGILANTE-MODUS BEENDET');
    } else if (car && car.isPolice) {
      vigilante.start(player.position, npcs);
      audio.playCheckpoint();
      sendPoliceDispatch('Vigilante-Modus aktiv! Erster Verdächtiger auf dem Radar markiert.', true);
      showQuickToast('VIGILANTE · STUFE 1 GESTARTET');
    } else {
      showQuickToast('VIGILANTE · NUR IN EINEM VICE-PD-STREIFENWAGEN [G]');
    }
    return;
  }

  if (e.code === 'KeyF' && player.getIsActive() && !shopOpen && wastedTimer <= 0) {
    const car = vehicles.getActiveVehicle();
    if (car) {
      if (world.isInSafehouseGarage(car.position)) {
        car.hp = car.maxHp;
        car.destroyed = false;
        audio.playPurchase();
        showQuickToast(`PRIVATE GARAGE · ${car.name} REPARIERT (100%)`);
      } else {
        tryUsePayNSpray();
      }
    } else if (lookedFood && lookedFood.available) {
      eatLookedFood();
    } else if (lookedCabinetWeapon) {
      equipCabinetWeapon();
    } else if (lookedAtTv) {
      toggleSafehouseTv();
    } else if (world.isNearSafehouseWardrobe(player.position)) {
      const outfitName = playerAvatar.nextOutfit();
      audio.playPurchase();
      persistProgress();
      showQuickToast(`OUTFIT · ${outfitName}`);
    } else if (world.isNearSafehouseFridge(player.position)) {
      const prevHp = playerHp;
      playerHp = Math.min(100, playerHp + 25);
      const gained = Math.round(playerHp - prevHp);
      audio.playEatCrunch();
      showQuickToast(gained > 0 ? `KÜHLSCHRANK-SNACK · +${gained} HP` : 'KÜHLSCHRANK-SNACK · LECKER!');
    } else if (world.isNearSafehouseLounge(player.position)) {
      playerHp = 100;
      weapons.refillAllAmmo();
      if (wanted.stars <= 2) {
        wanted.reset();
        npcs.clearPolice();
      }
      audio.playPurchase();
      persistProgress();
      showQuickToast('SAFEHOUSE · 100% HP, MUNITION VOLL & GESPEICHERT');
    } else if (world.isNearPdDesk(player.position) && wanted.stars >= 1) {
      const bribeCost = wanted.stars * 200;
      if (objectives.cash >= bribeCost) {
        objectives.cash -= bribeCost;
        wanted.reset();
        npcs.clearPolice();
        heli.clear();
        audio.playPurchase();
        persistProgress();
        showQuickToast(`KAUTION GEZAHLT · -$${bribeCost} · ALLE STERNE GELÖSCHT`);
        sendPoliceDispatch('Akten in Precinct 06 geschlossen — Fahndung aufgehoben.', true);
      } else {
        showQuickToast(`ZU WENIG CASH · KAUTION KOSTET $${bribeCost}`);
      }
    } else if (world.isNearPdEvidenceCash(player.position)) {
      world.takePdEvidenceCash();
      objectives.cash += 1500;
      world.triggerPdAlarm();
      wanted.addHeat(105);
      audio.playMissionPassed();
      persistProgress();
      showQuickToast('ASSERVATEN-RAUB · +$1.500 — 3★ GROẞFAHNDUNG!');
      sendPoliceDispatch('CODE 3! Syndikat-Geldkoffer aus Precinct 06 gestohlen — Großfahndung!', true);
    } else if (world.isNearPdKevlar(player.position)) {
      world.takePdKevlar();
      playerArmor = 100;
      world.triggerPdAlarm();
      wanted.addHeat(55);
      audio.playPurchase();
      persistProgress();
      showQuickToast('ASSERVATENKAMMER · KEVLAR-WESTE (100%) — ALARM AUSGELÖST!');
      sendPoliceDispatch('Code 2! Einbruch in die Asservatenkammer von Precinct 06!', true);
    } else if (world.isNearPdArmory(player.position)) {
      weapons.refillAllAmmo();
      weapons.switchWeapon(3);
      world.triggerPdAlarm();
      wanted.addHeat(55);
      audio.playPurchase();
      showQuickToast('WAFFENKAMMER · SHOTGUN & MUNITION GEKLAUT — ALARM!');
      sendPoliceDispatch('Waffenkammer-Alarm in Precinct 06! Alle Einheiten ausrücken!', true);
    } else if (world.isNearPdUniform(player.position)) {
      const outfitName = playerAvatar.setOutfit(4);
      audio.playPurchase();
      persistProgress();
      showQuickToast(`SPIND · ${outfitName} ANGEZOGEN`);
    } else if (world.isNearClubBar(player.position)) {
      if (objectives.cash >= 50) {
        objectives.cash -= 50;
        const prevHp = playerHp;
        playerHp = Math.min(100, playerHp + 30);
        const gained = Math.round(playerHp - prevHp);
        cocktailScore = Math.min(5.0, cocktailScore + 1.0);
        const level = THREE.MathUtils.clamp((cocktailScore - 1.0) / 3.5, 0, 1);
        audio.playPurchase();
        persistProgress();
        const hpNote = gained > 0 ? ` · +${gained} HP` : '';
        if (level <= 0.01) {
          showQuickToast(`MIAMI VICE COCKTAIL${hpNote} · ERFRISCHEND!`);
        } else if (level < 0.45) {
          showQuickToast(`MIAMI VICE COCKTAIL${hpNote} · LEICHT ANGESCHWIPST`);
        } else if (level < 0.8) {
          showQuickToast(`MIAMI VICE COCKTAIL${hpNote} · BETRUNKEN!`);
        } else {
          showQuickToast(`MIAMI VICE COCKTAIL${hpNote} · VOLLRAUSCH!`);
        }
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

let quickToastText = '';
let quickToastTimer = 0;

function showQuickToast(text: string): void {
  quickToastText = text;
  quickToastTimer = 2.4;
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

  // Handle Wasted / Busted respawn countdown
  if (wastedTimer > 0) {
    wastedTimer -= dt;
    if (wastedTimer <= 0) {
      wastedOverlayEl.classList.remove('visible', 'busted');
      playerHp = 100;
      cocktailScore = 0;
      canvas.style.filter = '';
      wanted.reset();
      npcs.clearPolice();
      heli.clear();
      if (heist.isActive()) heist.failHeist();
      if (isBustedState) {
        isBustedState = false;
        // Respawn inside Holding Cell 2 of Vice PD Precinct 06; cell gate slides open after 1.8s!
        player.setSpawn(-42.0, 0.25, -7.2, Math.PI);
        world.lockPdCellBriefly();
        showQuickToast(
          lastBustedFine > 0
            ? `FREIGELASSEN · -$${lastBustedFine} KAUTION · ZELLENTÜR ÖFFNET SICH`
            : 'FREIGELASSEN · ZELLENTÜR ÖFFNET SICH',
        );
      } else {
        // Respawn right outside your personal VICE SAFEHOUSE entrance!
        player.setSpawn(53.5, 0.25, -43.0, -Math.PI / 2);
      }
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

  // Gradually sober up over time; 1st cocktail keeps drunkLevel at 0
  if (cocktailScore > 0) {
    cocktailScore = Math.max(0, cocktailScore - dt * 0.032);
  }
  const drunkLevel = THREE.MathUtils.clamp((cocktailScore - 1.0) / 3.5, 0, 1);

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
      drunkLevel,
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
    drunkLevel,
  );
  const boatHud = boat.update(dt, elapsed, isPlaying, player.position, camera, pad);

  world.update(elapsed, dt, player.position, objectives.cash, wanted.stars);
  destructibles.update(dt);
  roadblocks.update(dt, elapsed, wanted.stars);
  shop.update(elapsed);
  payNSpray.update(dt, elapsed);
  const inSafehouse = world.isInsideSafehouse(player.position);
  wanted.update(inSafehouse ? dt * 3.0 : dt);

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
  const indoors =
    world.isInsideClub(player.position) ||
    world.isInsideSafehouse(player.position) ||
    world.isInsidePoliceStation(player.position);
  npcs.update(dt, player.position, wanted.stars, [
    ...world.colliders,
    ...vehicles.getVehicleColliders(),
    ...roadblocks.getActiveColliders(),
  ]);

  // GTA-style close-range arrest ("BUSTED") when cornered by Vice PD at 2+ stars
  if (isPlaying && wanted.stars >= 2 && !inBoat) {
    const activeCar = vehicles.getActiveVehicle();
    const slowInCar = activeCar ? Math.abs(activeCar.speed) < 2.6 : false;
    const bustRange = activeCar ? (slowInCar ? 3.2 : 0) : 2.3;
    if (bustRange > 0 && npcs.isPoliceBustingPlayer(player.position, bustRange)) {
      bustProgress += dt;
      if (bustProgress >= 1.15) {
        triggerBusted();
      }
    } else {
      bustProgress = Math.max(0, bustProgress - dt * 1.5);
    }
  } else {
    bustProgress = 0;
  }
  heli.update(dt, elapsed, player.position, indoors ? 0 : wanted.stars);
  const heistHud = heist.update(elapsed, player.position, vehicles, boat, npcs, wanted);
  const activePoliceCar = Boolean(vehicles.getActiveVehicle()?.isPolice);
  const vigilanteHud = vigilante.update(dt, player.position, activePoliceCar, npcs);
  if (vigilanteHud.rewardEarned > 0) {
    objectives.cash += vigilanteHud.rewardEarned;
    objectives.completedCount++;
    lastCompletedCount = objectives.completedCount;
    audio.playMissionPassed();
    persistProgress();
  }
  if (vigilanteHud.dispatchMsg) {
    sendPoliceDispatch(vigilanteHud.dispatchMsg, true);
  }
  if (vigilanteHud.toastText) {
    showQuickToast(vigilanteHud.toastText);
  }
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
  // Crosshair raycast for Safehouse food items, gun cabinet weapons & CRT TV -> switches weapon to open Hand!
  if (handHoldTimer > 0) handHoldTimer = Math.max(0, handHoldTimer - dt);
  lookedFood = null;
  lookedCabinetWeapon = null;
  lookedAtTv = false;
  const inSafehouseOrPd = world.isInsideSafehouse(player.position) || world.isInsidePoliceStation(player.position);
  if (isPlaying && !inAnyCraft && inSafehouseOrPd) {
    const camOrigin = new THREE.Vector3();
    camera.getWorldPosition(camOrigin);
    const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    foodRaycaster.set(camOrigin, camDir);
    foodRaycaster.far = 3.2;

    const foods = world.getFoodItems();
    if (foods.length > 0) {
      const foodHits = foodRaycaster.intersectObjects(
        foods.map((f) => f.mesh),
        true,
      );
      if (foodHits.length > 0) {
        const hitObj = foodHits[0].object;
        lookedFood = foods.find((f) => f.mesh === hitObj || f.mesh.children.includes(hitObj)) ?? null;
      }
    }

    if (!lookedFood) {
      const cabWeapons = world.getCabinetWeapons();
      const cabHits = foodRaycaster.intersectObjects(
        cabWeapons.map((w) => w.mesh),
        true,
      );
      if (cabHits.length > 0) {
        let obj: THREE.Object3D | null = cabHits[0].object;
        while (obj) {
          const found = cabWeapons.find((w) => w.mesh === obj);
          if (found) {
            lookedCabinetWeapon = found;
            break;
          }
          obj = obj.parent;
        }
      }
    }

    if (!lookedFood && !lookedCabinetWeapon) {
      const tvHits = foodRaycaster.intersectObject(world.getTvMesh(), true);
      if (tvHits.length > 0) {
        lookedAtTv = true;
      }
    }
  }
  weapons.setHandMode(Boolean(lookedFood) || Boolean(lookedCabinetWeapon) || lookedAtTv || handHoldTimer > 0);

  const wHud = weapons.update(dt, isPlaying && !inAnyCraft, playerSpeed, world.worldMeshes, shootables, pad, drunkLevel);
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
    vigilanteHud.targetPos ?? heistHud.targetPos,
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

  if (vigilanteHud.active) {
    objTagEl.textContent = '★ VIGILANTE';
    objTagEl.classList.add('heist');
    objTitleEl.textContent = vigilanteHud.title;
    objDescEl.textContent = vigilanteHud.description;
    objDistEl.textContent = `${vigilanteHud.timerText} · ${vigilanteHud.distanceM} m`;
  } else if (heistHud.active) {
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

  if (quickToastTimer > 0) quickToastTimer = Math.max(0, quickToastTimer - dt);
  const activeToast = quickToastTimer > 0 ? quickToastText : objHud.toastText;
  if (activeToast) {
    toastBannerEl.textContent = activeToast;
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
    const car = vehicles.getActiveVehicle();
    const vigHint = car?.isPolice ? ` · [G] ${vigilante.isActive() ? 'VIGILANTE AUS' : 'VIGILANTE'}` : '';
    vehicleCamHintEl.textContent = `[LMB] DRIVE-BY · [Q] ${audio.getRadioStation()}${vigHint} · [V] CAM · [E] AUS`;
    if (car && world.isInSafehouseGarage(car.position)) {
      interactPromptEl.textContent = '[F] PRIVATE GARAGE · GRATIS REPARATUR (100%)';
      interactPromptEl.classList.add('visible');
    } else if (car && payNSpray.isCarInBay(car.position)) {
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

    if (lookedFood) {
      interactPromptEl.textContent = `[LMB / F] ${lookedFood.name} NEHMEN & ESSEN (+${lookedFood.heal} HP)`;
      interactPromptEl.classList.add('visible');
    } else if (lookedCabinetWeapon) {
      interactPromptEl.textContent = `[LMB / F] ${lookedCabinetWeapon.name} AUS WAFFENSCHRANK NEHMEN`;
      interactPromptEl.classList.add('visible');
    } else if (lookedAtTv) {
      interactPromptEl.textContent = world.isTvOn()
        ? '[LMB / F] FERNSEHER AUSSCHALTEN'
        : '[LMB / F] FERNSEHER ANSCHALTEN · VICE CHANNEL 6';
      interactPromptEl.classList.add('visible');
    } else if (shop.isPlayerNear(player.position) && !shopOpen) {
      interactPromptEl.textContent = '[B] AMMU-NEON SHOP ÖFFNEN ($)';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearSafehouseWardrobe(player.position)) {
      interactPromptEl.textContent = '[F] KLEIDERSCHRANK · OUTFIT WECHSELN';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearSafehouseFridge(player.position)) {
      interactPromptEl.textContent = '[F] KÜHLSCHRANK · SNACK ESSEN (+25 HP)';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearSafehouseLounge(player.position)) {
      interactPromptEl.textContent = '[F] SAFEHOUSE · HEILEN, MUNITION VOLL & SPEICHERN';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearPdDesk(player.position) && wanted.stars >= 1) {
      interactPromptEl.textContent = `[F] KAUTION / BESTECHUNG · $${wanted.stars * 200} (STERNE LÖSCHEN)`;
      interactPromptEl.classList.add('visible');
    } else if (world.isNearPdEvidenceCash(player.position)) {
      interactPromptEl.textContent = '[F] SYNDIKAT-GELDKOFFER STEHLEN (+$1.500 · ⚠ 3★ ALARM)';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearPdKevlar(player.position)) {
      interactPromptEl.textContent = '[F] KEVLAR-WESTE STEHLEN (100% ARMOR · ⚠ ALARM)';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearPdArmory(player.position)) {
      interactPromptEl.textContent = '[F] POLIZEI-SHOTGUN & MUNITION STEHLEN (⚠ ALARM)';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearPdUniform(player.position)) {
      interactPromptEl.textContent = '[F] SPIND · VICE PD UNIFORM ANZIEHEN';
      interactPromptEl.classList.add('visible');
    } else if (world.isNearClubBar(player.position)) {
      interactPromptEl.textContent = '[F] MIAMI VICE COCKTAIL TRINKEN · $50';
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

  // Apply decaying Camera-Shake & progressive Drunk camera sway/vision effects right before rendering
  if (shakeTrauma > 0.001) {
    const s = shakeTrauma * shakeTrauma;
    camera.position.x += (Math.random() - 0.5) * s * 0.45;
    camera.position.y += (Math.random() - 0.5) * s * 0.45;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.06;
    shakeTrauma = Math.max(0, shakeTrauma - dt * 2.4);
  }

  if (drunkLevel > 0.01) {
    camera.rotation.z += Math.sin(elapsed * 1.65) * 0.11 * drunkLevel;
    camera.rotation.x += Math.cos(elapsed * 1.25) * 0.035 * drunkLevel;
    bloomPass.strength = 0.72 + drunkLevel * 0.42;
    canvas.style.filter = `saturate(${(1 + drunkLevel * 0.45).toFixed(2)}) blur(${(drunkLevel * 1.35).toFixed(2)}px)`;
  } else {
    bloomPass.strength = 0.72;
    if (canvas.style.filter) canvas.style.filter = '';
  }

  composer.render();
}

requestAnimationFrame(animate);
