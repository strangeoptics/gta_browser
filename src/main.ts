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
import { PlayerHelicopterSystem } from './vehicles/PlayerHelicopterSystem';
import { GarageRidesSystem, type GarageWallInteractable } from './vehicles/GarageRidesSystem';
import { DestructibleProps } from './world/DestructibleProps';
import { DecalSystem } from './world/DecalSystem';
import { RoadblockSystem } from './world/RoadblockSystem';
import { NpcSystem } from './entities/NpcSystem';
import { HelicopterSystem } from './entities/HelicopterSystem';
import { SafehousePets, PET_CATALOG, type PetId, type PetInteractable } from './entities/SafehousePets';
import { WildlifeSystem } from './entities/WildlifeSystem';
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

// HAVANA PETS & EXOTICS Modal
const petShopOverlayEl = document.getElementById('pet-shop-overlay') as HTMLDivElement;
const petShopCashEl = document.getElementById('pet-shop-cash') as HTMLSpanElement;
const buyPetBtns: Record<PetId, HTMLButtonElement> = {
  cleo: document.getElementById('buy-pet-cleo') as HTMLButtonElement,
  rico: document.getElementById('buy-pet-rico') as HTMLButtonElement,
  zeus: document.getElementById('buy-pet-zeus') as HTMLButtonElement,
  elvis: document.getElementById('buy-pet-elvis') as HTMLButtonElement,
};
const petShopCloseBtn = document.getElementById('pet-shop-close') as HTMLButtonElement;

// Pause Settings & Saved Stats UI
const statCashEl = document.getElementById('stat-cash') as HTMLElement;
const statMissionsEl = document.getElementById('stat-missions') as HTMLElement;
const resetSaveBtn = document.getElementById('reset-save-btn') as HTMLButtonElement;
const optSensInput = document.getElementById('opt-sens') as HTMLInputElement;
const optSensValEl = document.getElementById('opt-sens-val') as HTMLSpanElement;
const optInvertYInput = document.getElementById('opt-invert-y') as HTMLInputElement;
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

// Post-Processing (Half-Resolution Neon & Sunset Bloom -> ~55% lower GPU fillrate cost!)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(Math.max(1, Math.floor(window.innerWidth / 2)), Math.max(1, Math.floor(window.innerHeight / 2))),
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
const maverick = new PlayerHelicopterSystem(scene, world.maverickSpawn);
const garageRides = new GarageRidesSystem(scene);
const npcs = new NpcSystem(scene);
const heli = new HelicopterSystem(scene);
const pets = new SafehousePets(scene);
const wildlife = new WildlifeSystem(scene);
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

// Pre-compile all WebGL shaders up front while light counts are fixed -> eliminates mid-game shader stalls!
renderer.compile(scene, camera);

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
let petShopOpen = false;
let photoMode = false;
let photoYaw = 0;
let photoPitch = 0;
const photoKeys = new Set<string>();
const foodRaycaster = new THREE.Raycaster();
const camOriginScratch = new THREE.Vector3();
const camDirScratch = new THREE.Vector3();
let lookedFood: FoodItem | null = null;
let lookedCabinetWeapon: CabinetWeapon | null = null;
let lookedAtTv = false;
let lookedPet: PetInteractable | null = null;
let lookedWallRide: GarageWallInteractable | null = null;
let handHoldTimer = 0;

// Dirty-checked DOM write helpers to eliminate redundant style/layout work at 60-144 FPS
const domCache = new WeakMap<Element, string>();
function setText(el: HTMLElement, text: string): void {
  if (domCache.get(el) !== text) {
    domCache.set(el, text);
    el.textContent = text;
  }
}
const widthCache = new WeakMap<HTMLElement, string>();
function setWidth(el: HTMLElement, w: string): void {
  if (widthCache.get(el) !== w) {
    widthCache.set(el, w);
    el.style.width = w;
  }
}

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
pets.setOwnedPets((savedProgress.ownedPets ?? []) as PetId[]);
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
    ownedPets: pets.getOwnedPets(),
    starterBonusApplied: true,
  });
  statCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  statMissionsEl.textContent = String(objectives.completedCount);
}

function applySettings(next: GameSettings): void {
  settings = next;
  player.setSensitivityMultiplier(settings.mouseSensitivity);
  player.setInvertY(settings.invertMouseY);
  audio.setSfxVolume(settings.sfxVolume);
  audio.setMusicVolume(settings.musicVolume);
  renderer.shadowMap.enabled = !settings.performanceMode;
  renderer.setPixelRatio(settings.performanceMode ? 1 : Math.min(window.devicePixelRatio, 2));
  bloomPass.enabled = !settings.performanceMode;

  optSensInput.value = String(settings.mouseSensitivity);
  optSensValEl.textContent = `${settings.mouseSensitivity.toFixed(1)}×`;
  optInvertYInput.checked = settings.invertMouseY;
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
optInvertYInput.addEventListener('change', () => {
  applySettings({ ...settings, invertMouseY: optInvertYInput.checked });
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
  pets.setOwnedPets([]);
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
  if (maverick.isInHeli()) {
    maverick.exit(world.colliders, world.getGroundHeight);
    weapons.setEnabled(true);
  }
  if (garageRides.isRiding()) {
    garageRides.dismountRide(world.layout.playableBounds);
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
    if (wanted.stars >= 2 && !maverick.isInHeli()) {
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
    if (garageRides.isRiding()) {
      garageRides.dismountRide(world.layout.playableBounds);
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

garageRides.onMountStateChanged = (detachingFromWall) => {
  audio.playWallMountToggle(detachingFromWall);
};

garageRides.onJumpTriggered = () => {
  audio.playSkateOllie();
};

garageRides.onLanded = () => {
  audio.playSkateLand();
};

garageRides.onStuntLanded = (distM, reward) => {
  objectives.cash += reward;
  audio.playMissionPassed();
  addCameraShake(0.24);
  persistProgress();
  showQuickToast(`STUNT BONUS · ${distM}m SPRUNG · +$${reward}`);
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

wildlife.onRoosterSpooked = () => {
  audio.playRoosterCluck();
};

wildlife.onSharkNipPlayer = () => {
  audio.playWaterSplash();
  applyPlayerDamage(8);
  showQuickToast('VORSICHT · RIFFHAI IM TIEFEN MEER!');
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

// HAVANA PETS & EXOTICS UI Flow + Safehouse Pet Interaction
function refreshPetShopUi(): void {
  petShopCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  for (const item of PET_CATALOG) {
    const btn = buyPetBtns[item.id];
    if (pets.ownsPet(item.id)) {
      btn.textContent = `✓ ${item.name} · IM VICE SAFEHOUSE ZUHAUSE`;
      btn.disabled = true;
    } else {
      btn.textContent = `${item.title} · $${item.price.toLocaleString('en-US')}`;
      btn.disabled = objectives.cash < item.price;
    }
  }
}

function openPetShop(): void {
  petShopOpen = true;
  player.setActive(false);
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  refreshPetShopUi();
  petShopOverlayEl.classList.add('visible');
}

function closePetShop(): void {
  petShopOpen = false;
  petShopOverlayEl.classList.remove('visible');
  overlay.classList.add('hidden');
  player.setActive(true);
  requestLockSafely();
}

for (const item of PET_CATALOG) {
  buyPetBtns[item.id].addEventListener('click', () => {
    if (pets.ownsPet(item.id) || objectives.cash < item.price) return;
    objectives.cash -= item.price;
    pets.adoptPet(item.id);
    if (item.id === 'cleo') audio.playCatPurr();
    else if (item.id === 'rico') audio.playParrotSquawk();
    else if (item.id === 'zeus') audio.playDogBark();
    else audio.playGatorSnap();
    audio.playPurchase();
    persistProgress();
    refreshPetShopUi();
    showQuickToast(
      item.id === 'elvis'
        ? 'ADOPTIERT! · ALLIGATOR „ELVIS“ WARTET AM SAFEHOUSE-DACHPOOL!'
        : `ADOPTIERT! · ${item.name} WARTET JETZT IM VICE SAFEHOUSE AUF DICH!`,
    );
  });
}

petShopCloseBtn.addEventListener('click', () => {
  closePetShop();
});

function interactWithLookedPet(): boolean {
  if (!lookedPet) return false;
  const p = lookedPet;
  pets.triggerReaction(p.id);
  weapons.triggerEatAnimation();
  handHoldTimer = 0.55;

  if (p.id === 'cleo') {
    audio.playCatPurr();
    playerHp = Math.min(100, playerHp + 15);
    showQuickToast('KATZE „CLEO“ SCHNURRT ZUFRIEDEN · +15 HP');
  } else if (p.id === 'rico') {
    audio.playParrotSquawk();
    const drunk = THREE.MathUtils.clamp((cocktailScore - 1.0) / 4.5, 0, 1);
    showQuickToast(pets.getRicoQuip(objectives.cash, wanted.stars, drunk));
  } else if (p.id === 'zeus') {
    audio.playDogBark();
    playerArmor = Math.min(100, playerArmor + 25);
    persistProgress();
    showQuickToast('DOBERMANN „ZEUS“ FREUT SICH RIESIG! · +25% KEVLAR-MORAL');
  } else if (p.id === 'elvis') {
    audio.playGatorSnap();
    playerHp = Math.min(100, playerHp + 25);
    showQuickToast('ALLIGATOR „ELVIS“ VERSCHLINGT DAS STEAK! · +25 HP');
  }
  return true;
}

function interactWithLookedWallRide(): boolean {
  if (!lookedWallRide) return false;
  const target = lookedWallRide;
  weapons.triggerEatAnimation();
  handHoldTimer = 0.4;
  if (target.action === 'detach') {
    garageRides.mountRide(target.id, playerAvatar.getCurrentOutfit());
    weapons.setEnabled(false);
    showQuickToast(
      target.id === 'skateboard'
        ? 'NEON SKATEBOARD ABGENOMMEN · [WASD] PUSHEN · [SPACE] OLLIE · [SHIFT] SPRINT'
        : '80s RENNRAD ABGENOMMEN · [WASD] TRETEN · [SHIFT] SPRINT · [SPACE] HOP · [G] KLINGEL',
    );
  } else {
    const res = garageRides.hangRideOnWall(target.id);
    showQuickToast(`GARAGENWAND · ${res.name} WIEDER FEST MONTIERT`);
  }
  lookedWallRide = null;
  return true;
}

function tryToggleVehicleOrBoat(): void {
  if (maverick.isInHeli()) {
    if (maverick.canExit(world.colliders, world.getGroundHeight)) {
      const land = maverick.exit(world.colliders, world.getGroundHeight);
      player.setSpawn(land.x, land.y, land.z, land.yaw);
      camera.fov = 75;
      camera.updateProjectionMatrix();
      weapons.setEnabled(true);
    } else {
      showQuickToast('ZU HOCH ZUM AUSSTEIGEN · BITTE ERST TIEFER SINKEN [C / SHIFT]');
    }
  } else if (boat.isInBoat()) {
    const land = boat.disembark();
    player.setSpawn(land.x, land.y, land.z, land.yaw);
    camera.fov = 75;
    camera.updateProjectionMatrix();
    weapons.setEnabled(true);
  } else if (garageRides.isRiding()) {
    const exitPos = garageRides.dismountRide(world.layout.playableBounds);
    if (exitPos) {
      player.setSpawn(exitPos.x, exitPos.y, exitPos.z, exitPos.yaw);
      camera.fov = 75;
      camera.updateProjectionMatrix();
      weapons.setEnabled(true);
    }
  } else if (vehicles.isInVehicle()) {
    const exitPos = vehicles.exitVehicle(world.layout.playableBounds);
    if (exitPos) {
      player.setSpawn(exitPos.x, exitPos.y, exitPos.z, exitPos.yaw);
      camera.fov = 75;
      camera.updateProjectionMatrix();
      weapons.setEnabled(true);
    }
  } else if (lookedWallRide && lookedWallRide.action === 'detach') {
    interactWithLookedWallRide();
  } else if (maverick.isPlayerNear(player.position)) {
    maverick.board();
    weapons.setEnabled(false);
    showQuickToast('VICE MAVERICK · [SPACE] STEIGEN · [C] SINKEN · [WASD] FLIEGEN');
  } else if (boat.isPlayerNear(player.position)) {
    boat.board();
    weapons.setEnabled(false);
  } else {
    const nearGarageRide = garageRides.findNearestMountable(player.position);
    if (nearGarageRide) {
      garageRides.mountRide(nearGarageRide.id, playerAvatar.getCurrentOutfit());
      weapons.setEnabled(false);
      if (nearGarageRide.fromWall) {
        showQuickToast(
          nearGarageRide.id === 'skateboard'
            ? 'NEON SKATEBOARD ABGENOMMEN · [WASD] PUSHEN · [SPACE] OLLIE · [SHIFT] SPRINT'
            : '80s RENNRAD ABGENOMMEN · [WASD] TRETEN · [SHIFT] SPRINT · [SPACE] HOP · [G] KLINGEL',
        );
      }
      return;
    }
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
  if (
    e.button === 0 &&
    player.getIsActive() &&
    !shopOpen &&
    !petShopOpen &&
    !photoMode &&
    !vehicles.isInVehicle() &&
    !boat.isInBoat() &&
    !maverick.isInHeli() &&
    !garageRides.isRiding()
  ) {
    if (lookedFood && lookedFood.available) {
      eatLookedFood();
    } else if (lookedCabinetWeapon) {
      equipCabinetWeapon();
    } else if (lookedAtTv) {
      toggleSafehouseTv();
    } else if (lookedPet) {
      interactWithLookedPet();
    } else if (lookedWallRide) {
      interactWithLookedWallRide();
    }
  }
});

window.addEventListener('mousemove', (e) => {
  if (!photoMode || document.pointerLockElement !== canvas) return;
  const ySign = settings.invertMouseY ? -1 : 1;
  photoYaw -= e.movementX * 0.0022 * settings.mouseSensitivity;
  photoPitch = Math.max(-1.45, Math.min(1.45, photoPitch - e.movementY * 0.0022 * settings.mouseSensitivity * ySign));
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
      weapons.setViewmodelVisible(
        !vehicles.isInVehicle() &&
          !boat.isInBoat() &&
          !maverick.isInHeli() &&
          !garageRides.isRiding() &&
          !player.isThirdPerson(),
      );
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
  if (petShopOpen && (e.code === 'KeyF' || e.code === 'KeyB' || e.code === 'Escape')) {
    closePetShop();
    return;
  }
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
    if (garageRides.getActiveRideId() === 'roadbike') {
      audio.playBikeBell();
      showQuickToast('KLINGELING! · FREIE BAHN FÜR DAS 80s RENNRAD!');
      return;
    }
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
    const activeGarageRide = garageRides.getActiveRideId();
    if (activeGarageRide && garageRides.canRehangActiveRide(player.position)) {
      const res = garageRides.hangRideOnWall(activeGarageRide);
      if (res.dismountedPlayerPos) {
        player.setSpawn(
          res.dismountedPlayerPos.x,
          res.dismountedPlayerPos.y,
          res.dismountedPlayerPos.z,
          res.dismountedPlayerPos.yaw,
        );
        camera.fov = 75;
        camera.updateProjectionMatrix();
        weapons.setEnabled(true);
      }
      showQuickToast(`GARAGENWAND · ${res.name} WIEDER AN DER WAND BEFESTIGT`);
      return;
    }
    const car = vehicles.getActiveVehicle();
    if (car) {
      if (world.isInSafehouseGarage(car.position)) {
        car.hp = car.maxHp;
        car.destroyed = false;
        audio.playPurchase();
        showQuickToast(`PRIVATE GARAGE · ${car.name} REPARIERT (100%)`);
      } else if (world.isCarInTuningBay(car.position)) {
        const tuneCost = car.tuned ? 400 : 600;
        if (objectives.cash >= tuneCost) {
          objectives.cash -= tuneCost;
          const { firstUpgrade, neonLabel } = vehicles.tuneVehicle(car);
          audio.playPurchase();
          persistProgress();
          showQuickToast(
            firstUpgrade
              ? `VICE CUSTOMS · TURBO + PANZERUNG + ${neonLabel} NEON (-$${tuneCost})`
              : `VICE CUSTOMS · ${neonLabel} NEON-FINISH & 100% REPARATUR (-$${tuneCost})`,
          );
        } else {
          showQuickToast(`VICE CUSTOMS · ZU WENIG CASH (BENÖTIGT $${tuneCost})`);
        }
      } else if (world.isCarInExportBay(car.position)) {
        const exportSpec = world.canDeliverExportVehicle(car.name);
        if (exportSpec) {
          const { reward, allDoneBonus } = world.deliverExportVehicle(car.name);
          objectives.cash += reward + allDoneBonus;
          objectives.completedCount++;
          lastCompletedCount = objectives.completedCount;
          audio.playMissionPassed();
          persistProgress();
          const exitPos = vehicles.exitVehicle();
          if (exitPos) {
            player.setSpawn(46.5, 0.25, 92, Math.PI / 2);
            weapons.setEnabled(true);
          }
          // Respawn delivered vehicle back at its original city spot
          car.position.set(car.spawnX, 0, car.spawnZ);
          car.yaw = car.spawnYaw;
          car.speed = 0;
          car.mesh.position.set(car.spawnX, 0, car.spawnZ);
          car.mesh.rotation.y = car.spawnYaw;
          showQuickToast(
            allDoneBonus > 0
              ? `IMPORT/EXPORT KOMPLETT! · +$${reward + allDoneBonus} (INKL. $5.000 BONUS!)`
              : `IMPORT/EXPORT · ${car.name} GELIEFERT (+$${reward})`,
          );
        } else {
          showQuickToast(`IMPORT/EXPORT · ${car.name} AKTUELL NICHT AUF DER LISTE`);
        }
      } else {
        tryUsePayNSpray();
      }
    } else if (lookedFood && lookedFood.available) {
      eatLookedFood();
    } else if (lookedCabinetWeapon) {
      equipCabinetWeapon();
    } else if (lookedAtTv) {
      toggleSafehouseTv();
    } else if (lookedPet) {
      interactWithLookedPet();
    } else if (lookedWallRide) {
      interactWithLookedWallRide();
    } else if (world.isNearPetShop(player.position)) {
      if (petShopOpen) closePetShop();
      else openPetShop();
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
    } else if (world.isNearIslandVault(player.position)) {
      world.takeIslandVault();
      npcs.alertEstateGuards();
      objectives.cash += 2500;
      wanted.addHeat(110);
      audio.playMissionPassed();
      persistProgress();
      showQuickToast('STARFISH ESTATE TRESOR · +$2.500 GOLD — 3★ ALARM!');
      sendPoliceDispatch('CODE 3 auf Starfish Island! Kartell-Anwesen ausgeraubt!', true);
    } else if (world.isNearYachtLoot(player.position)) {
      world.takeYachtLoot();
      npcs.alertEstateGuards();
      objectives.cash += 1800;
      wanted.addHeat(85);
      audio.playMissionPassed();
      persistProgress();
      showQuickToast('SUPERYACHT „LADY VICE“ · +$1.800 KAPITÄNS-GOLD!');
      sendPoliceDispatch('Alarm auf der Superyacht Lady Vice! Küstenwache & Einheiten ausrücken!', true);
    } else if (world.isNearDinerCounter(player.position)) {
      const mealCost = 40;
      if (objectives.cash >= mealCost) {
        objectives.cash -= mealCost;
        playerHp = 100;
        audio.playEatCrunch();
        persistProgress();
        showQuickToast('STARLIGHT DINER · CUBAN BURGER & SHAKE (100% HP · -$40)');
      } else {
        showQuickToast(`STARLIGHT DINER · ZU WENIG CASH (BENÖTIGT $${mealCost})`);
      }
    } else if (world.isNearBankVault(player.position)) {
      world.takeBankVault();
      objectives.cash += 3000;
      wanted.addHeat(165);
      audio.playMissionPassed();
      persistProgress();
      showQuickToast('BANCO DE VICE TRESOR GEKNACKT · +$3.000 — 4★ GROẞFAHNDUNG!');
      sendPoliceDispatch('CODE 3! Bewaffneter Banküberfall in der Banco de Vice (Little Havana)!', true);
    } else if (world.isNearMarinaLoot(player.position)) {
      world.takeMarinaLoot();
      objectives.cash += 2000;
      wanted.addHeat(75);
      audio.playMissionPassed();
      persistProgress();
      showQuickToast('VICE MARINA · SCHMUGGLER-KOFFER GEKLAUT (+$2.000 · ⚠ 2★)');
      sendPoliceDispatch('Schmuggler-Alarm an der Vice Marina! Küstenwache & Streifen ausrücken!', true);
    } else if (world.isNearLighthouseSpot(player.position)) {
      const firstDiscovery = world.claimLighthouseBonus();
      playerHp = 100;
      if (firstDiscovery) {
        objectives.cash += 1000;
        audio.playMissionPassed();
        persistProgress();
        showQuickToast('CAPE VICE LEUCHTTURM ENTDECKT! · +$1.000 & 100% HP');
      } else {
        audio.playPurchase();
        showQuickToast('CAPE VICE AUSSICHT · FRISCHE MEERESLUFT (100% HP)');
      }
    } else if (world.isNearClubBar(player.position)) {
      if (objectives.cash >= 50) {
        objectives.cash -= 50;
        const prevHp = playerHp;
        playerHp = Math.min(100, playerHp + 30);
        const gained = Math.round(playerHp - prevHp);
        cocktailScore = Math.min(6.0, cocktailScore + 1.0);
        const rawLevel = THREE.MathUtils.clamp((cocktailScore - 1.0) / 4.5, 0, 1);
        audio.playPurchase();
        persistProgress();
        const hpNote = gained > 0 ? ` · +${gained} HP` : '';
        if (rawLevel <= 0.01) {
          showQuickToast(`MIAMI VICE COCKTAIL${hpNote} · ERFRISCHEND!`);
        } else if (rawLevel < 0.35) {
          showQuickToast(`MIAMI VICE COCKTAIL${hpNote} · LEICHT ANGESCHWIPST`);
        } else if (rawLevel < 0.72) {
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
    } else if (petShopOpen) {
      closePetShop();
    } else if (player.getIsActive() && !vehicles.isInVehicle() && shop.isPlayerNear(player.position)) {
      openShop();
    } else if (player.getIsActive() && !vehicles.isInVehicle() && world.isNearPetShop(player.position)) {
      openPetShop();
    }
    return;
  }

  if (e.code === 'Escape' && (shopOpen || petShopOpen)) {
    if (shopOpen) closeShop();
    if (petShopOpen) closePetShop();
    return;
  }

  if (e.code === 'KeyE' && player.getIsActive() && !shopOpen && wastedTimer <= 0) {
    tryToggleVehicleOrBoat();
    return;
  }

  if (
    e.code === 'KeyV' &&
    player.getIsActive() &&
    !shopOpen &&
    !vehicles.isInVehicle() &&
    !boat.isInBoat() &&
    !maverick.isInHeli() &&
    !garageRides.isRiding()
  ) {
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
  if (shopOpen || petShopOpen) return;
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
  if (player.getIsActive() && !player.getIsLocked() && !shopOpen && !petShopOpen) {
    requestLockSafely();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    pointerLockFallback = false;
    overlay.classList.add('hidden');
    player.setActive(true);
  } else if (!pointerLockFallback && !shopOpen && !petShopOpen) {
    pauseGame();
  }
});

document.addEventListener('pointerlockerror', () => {
  pointerLockFallback = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && player.getIsActive() && !player.getIsLocked() && !shopOpen && !petShopOpen) {
    pauseGame();
  }
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(Math.max(1, Math.floor(window.innerWidth / 2)), Math.max(1, Math.floor(window.innerHeight / 2)));
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
    cocktailScore = Math.max(0, cocktailScore - dt * 0.025);
  }
  const rawDrunk = THREE.MathUtils.clamp((cocktailScore - 1.0) / 3.8, 0, 1);
  const drunkLevel = Math.pow(rawDrunk, 1.25);

  if (isPlaying && pad.connected) {
    if (pad.interactPressed) tryToggleVehicleOrBoat();
    if (
      pad.camTogglePressed &&
      !vehicles.isInVehicle() &&
      !boat.isInBoat() &&
      !maverick.isInHeli() &&
      !garageRides.isRiding()
    ) {
      const is3p = player.toggleThirdPerson();
      weapons.setViewmodelVisible(!is3p);
      showQuickToast(is3p ? 'KAMERA · 3RD PERSON' : 'KAMERA · FIRST PERSON');
    }
    if (pad.reloadOrSprayPressed && vehicles.isInVehicle()) tryUsePayNSpray();
    if (pad.prevWeaponPressed && (vehicles.isInVehicle() || boat.isInBoat() || garageRides.isRiding())) {
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
  const inHeli = maverick.isInHeli();
  const inGarageRide = garageRides.isRiding();
  const inAnyCraft = inVehicle || inBoat || inHeli || inGarageRide;

  let playerSpeed = 0;
  let playerGrounded = true;
  let playerCrouching = false;
  let playerSwimming = false;
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
      world.cameraMeshes,
      weapons.isAdsActive(),
      drunkLevel,
    );
    playerSpeed = status.speed;
    playerGrounded = status.grounded;
    playerCrouching = status.crouching;
    playerSwimming = status.swimming;
  } else if (inVehicle) {
    const car = vehicles.getActiveVehicle();
    if (car) {
      player.position.copy(car.position);
      headingYaw = car.yaw + Math.PI;
    }
  } else if (inGarageRide) {
    const gr = garageRides.getActiveRide();
    if (gr) {
      player.position.copy(gr.position);
      headingYaw = gr.yaw + Math.PI;
    }
  } else if (inBoat) {
    player.position.copy(boat.position);
    headingYaw = boat.yaw + Math.PI;
  } else if (inHeli) {
    player.position.copy(maverick.position);
    headingYaw = maverick.yaw + Math.PI;
  }

  const rbColliders = roadblocks.getActiveColliders();
  const vehicleWorldColliders =
    rbColliders.length > 0 ? [...world.solidVehicleColliders, ...rbColliders] : world.solidVehicleColliders;
  const driveHud = vehicles.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    wanted.stars,
    camera,
    vehicleWorldColliders,
    world.layout.playableBounds,
    pad,
    world.stuntRamps,
    world.shouldTrafficStop,
    drunkLevel,
    world.getGroundHeight,
  );
  const garageRideColliders = [
    ...world.colliders,
    ...vehicles.getVehicleColliders(),
    ...rbColliders,
  ];
  const garageRideHud = garageRides.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    camera,
    garageRideColliders,
    world.layout.playableBounds,
    pad,
    world.stuntRamps,
    drunkLevel,
    world.getGroundHeight,
  );
  if (inGarageRide) {
    const gr = garageRides.getActiveRide();
    if (gr && Math.abs(gr.speed) > 5.0) {
      destructibles.handleVehicleImpact(gr.position, gr.yaw, Math.abs(gr.speed));
    }
  }
  const boatHud = boat.update(dt, elapsed, isPlaying, player.position, camera, pad);
  const heliPlayerHud = maverick.update(
    dt,
    isPlaying,
    player.position,
    camera,
    world.colliders,
    world.getGroundHeight,
    pad,
  );

  world.update(elapsed, dt, player.position, objectives.cash, wanted.stars);
  const inSafehouse = world.isInsideSafehouse(player.position);
  pets.update(dt, elapsed, player.position, inSafehouse);
  wildlife.update(dt, elapsed, player.position, playerSwimming && !inAnyCraft);
  destructibles.update(dt);
  roadblocks.update(dt, elapsed, wanted.stars);
  shop.update(elapsed);
  payNSpray.update(dt, elapsed);
  wanted.update(inSafehouse ? dt * (pets.ownsPet('zeus') ? 4.2 : 3.0) : dt);

  // Vice PD Radio Dispatch triggers on Wanted star escalation
  if (dispatchCooldown > 0) dispatchCooldown -= dt;
  if (dispatchTimer > 0) {
    dispatchTimer -= dt;
    if (dispatchTimer <= 0) dispatchBannerEl.classList.remove('visible');
  }
  if (wanted.stars > lastWantedStars) {
    const activeCar = vehicles.getActiveVehicle();
    const area =
      player.position.z < -68
        ? 'North Point'
        : player.position.x < -66
          ? 'Little Havana'
          : player.position.z > 66
            ? 'Vice Port'
            : player.position.x > 130
              ? 'Starfish Island'
              : player.position.x > 48
                ? 'Ocean Drive'
                : 'Downtown Vice';
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
    world.isInsidePoliceStation(player.position) ||
    world.isInsideWestInterior(player.position);
  npcs.update(dt, player.position, wanted.stars, [
    ...world.solidNpcColliders,
    ...vehicles.getVehicleColliders(),
    ...rbColliders,
  ]);

  // GTA-style close-range arrest ("BUSTED") when cornered by Vice PD at 2+ stars (never while flying in the Maverick!)
  if (isPlaying && wanted.stars >= 2 && !inBoat && !inHeli) {
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
    inBoat
      ? boatHud.speedKmh
      : inHeli
        ? heliPlayerHud.speedKmh
        : inGarageRide
          ? garageRideHud.speedKmh
          : driveHud.speedKmh,
    driveHud.drifting,
    playerSpeed,
    inGarageRide ? garageRideHud.grounded : playerGrounded,
    wanted.stars,
    player.position.x,
    world.getClubProximity(player.position),
    inGarageRide && garageRideHud.rideId ? garageRideHud.rideId : 'motor',
  );

  const shootables = [
    ...npcs.getShootableTargets(),
    ...vehicles.getShootableTargets(),
    ...destructibles.getShootableTargets(),
    ...heli.getShootableTargets(),
  ];
  // Crosshair raycast for Safehouse food items, gun cabinet weapons, CRT TV & Safehouse Pets -> switches weapon to open Hand!
  if (handHoldTimer > 0) handHoldTimer = Math.max(0, handHoldTimer - dt);
  lookedFood = null;
  lookedCabinetWeapon = null;
  lookedAtTv = false;
  lookedPet = null;
  lookedWallRide = null;
  const onSafehouseLot =
    player.position.x > 29 && player.position.x < 51 && player.position.z > -50 && player.position.z < -30 && player.position.y < 9.0;
  const inSafehouseOrPd = onSafehouseLot || world.isInsidePoliceStation(player.position);
  if (isPlaying && !inAnyCraft && inSafehouseOrPd) {
    camera.getWorldPosition(camOriginScratch);
    camDirScratch.set(0, 0, -1).applyQuaternion(camera.quaternion);
    foodRaycaster.set(camOriginScratch, camDirScratch);
    foodRaycaster.far = 3.6;

    // Check Garage West-Wall Skateboard & Rennrad mounts + Adopted Safehouse Pets
    if (onSafehouseLot) {
      const wallRides = garageRides.getWallInteractables();
      if (wallRides.length > 0) {
        const wallHits = foodRaycaster.intersectObjects(
          wallRides.map((w) => w.hitbox),
          false,
        );
        if (wallHits.length > 0) {
          lookedWallRide = wallRides.find((w) => w.hitbox === wallHits[0].object) ?? null;
        }
      }

      const petTargets = pets.getInteractables();
      if (!lookedWallRide && petTargets.length > 0) {
        const petHits = foodRaycaster.intersectObjects(
          petTargets.map((p) => p.hitbox),
          false,
        );
        if (petHits.length > 0) {
          lookedPet = petTargets.find((p) => p.hitbox === petHits[0].object) ?? null;
        }
      }
    }

    const foods = world.getFoodItems();
    if (!lookedWallRide && !lookedPet && foods.length > 0) {
      const foodHits = foodRaycaster.intersectObjects(
        foods.map((f) => f.mesh),
        true,
      );
      if (foodHits.length > 0) {
        const hitObj = foodHits[0].object;
        lookedFood = foods.find((f) => f.mesh === hitObj || f.mesh.children.includes(hitObj)) ?? null;
      }
    }

    if (!lookedWallRide && !lookedFood) {
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

    if (!lookedWallRide && !lookedPet && !lookedFood && !lookedCabinetWeapon) {
      const tvHits = foodRaycaster.intersectObject(world.getTvMesh(), true);
      if (tvHits.length > 0) {
        lookedAtTv = true;
      }
    }
  }
  weapons.setHandMode(
    Boolean(lookedWallRide) ||
      Boolean(lookedPet) ||
      Boolean(lookedFood) ||
      Boolean(lookedCabinetWeapon) ||
      lookedAtTv ||
      handHoldTimer > 0,
  );

  const wHud = weapons.update(dt, isPlaying && !inAnyCraft && !playerSwimming, playerSpeed, world.worldMeshes, shootables, pad, drunkLevel);
  weapons.setViewmodelVisible(!inAnyCraft && !player.isThirdPerson() && !playerSwimming);
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
    playerSwimming,
  );
  if (inVehicle) {
    const car = vehicles.getActiveVehicle();
    if (car) {
      weapons.updateDriveBy(dt, isPlaying, car.position, world.worldMeshes, shootables, pad);
    }
  } else if (inGarageRide) {
    const gr = garageRides.getActiveRide();
    if (gr) {
      weapons.updateDriveBy(dt, isPlaying, gr.position, world.worldMeshes, shootables, pad);
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
    maverick.position,
    garageRides.getParkedMarkers(),
  );

  // --- HUD Updates (Dirty-checked DOM mutations) ---
  damageFlash = Math.max(0, damageFlash - dt * 2.2);
  damageVignetteEl.style.opacity = damageFlash > 0.004 ? damageFlash.toFixed(2) : '0';
  const hpPct = Math.round(playerHp);
  setWidth(hpFillEl, `${hpPct}%`);
  setText(hpTextEl, `${hpPct}`);

  const armorPct = Math.round(playerArmor);
  setWidth(armorFillEl, `${armorPct}%`);
  setText(armorTextEl, `${armorPct}`);

  const starStr = '★'.repeat(wanted.stars) + '☆'.repeat(5 - wanted.stars);
  setText(starsEl, starStr);
  starsEl.classList.toggle('cooling', wanted.isCoolingDown());
  starsEl.classList.toggle('active', wanted.stars > 0);
  setText(cashEl, `$${objHud.cash.toLocaleString('en-US')}`);

  if (vigilanteHud.active) {
    setText(objTagEl, '★ VIGILANTE');
    objTagEl.classList.add('heist');
    setText(objTitleEl, vigilanteHud.title);
    setText(objDescEl, vigilanteHud.description);
    setText(objDistEl, `${vigilanteHud.timerText} · ${vigilanteHud.distanceM} m`);
  } else if (heistHud.active) {
    setText(objTagEl, '★ HEIST');
    objTagEl.classList.add('heist');
    setText(objTitleEl, heistHud.title);
    setText(objDescEl, heistHud.description);
    setText(objDistEl, `${heistHud.distanceM} m`);
  } else {
    setText(objTagEl, 'ZIEL · [H] HEIST');
    objTagEl.classList.remove('heist');
    setText(objTitleEl, objHud.title);
    setText(objDescEl, objHud.description);
    if (objHud.timerText && objHud.distanceM > 0) {
      setText(objDistEl, `${objHud.timerText} · ${objHud.distanceM} m`);
    } else if (objHud.timerText) {
      setText(objDistEl, objHud.timerText);
    } else {
      setText(objDistEl, objHud.distanceM > 0 ? `${objHud.distanceM} m` : '');
    }
  }

  if (quickToastTimer > 0) quickToastTimer = Math.max(0, quickToastTimer - dt);
  const activeToast = quickToastTimer > 0 ? quickToastText : objHud.toastText;
  if (activeToast) {
    setText(toastBannerEl, activeToast);
    toastBannerEl.classList.add('visible');
  } else {
    toastBannerEl.classList.remove('visible');
  }

  weaponPanelEl.classList.toggle('hidden', inAnyCraft);
  crosshairEl.style.display = inAnyCraft ? 'none' : 'block';
  vehiclePanelEl.classList.toggle('visible', inAnyCraft);

  let nextPrompt: string | null = null;

  if (heliPlayerHud.inHeli) {
    setText(vehicleNameEl, `${heliPlayerHud.heliName} · ${heliPlayerHud.altitudeM}m`);
    setText(vehicleSpeedEl, `${heliPlayerHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    vehicleHpFillEl.classList.remove('low');
    setText(
      vehicleCamHintEl,
      `[SPACE/C] HÖHE · [Q] ${audio.getRadioStation()} · [V] CAM · [E] LANDEN`,
    );
  } else if (boatHud.inBoat) {
    setText(vehicleNameEl, boatHud.boatName);
    setText(vehicleSpeedEl, `${boatHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    vehicleHpFillEl.classList.remove('low');
    setText(vehicleCamHintEl, `[Q] ${audio.getRadioStation()} · [E] AN LAND`);
  } else if (garageRideHud.inRide) {
    setText(vehicleNameEl, garageRideHud.rideName);
    setText(vehicleSpeedEl, `${garageRideHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    vehicleHpFillEl.classList.remove('low');
    const rideHint =
      garageRideHud.rideId === 'skateboard'
        ? `[SPACE] OLLIE · [SHIFT] PUSH · [V] CAM · [E] ABSTEIGEN`
        : `[SPACE] HOP · [SHIFT] SPRINT · [G] KLINGEL · [V] CAM · [E] AB`;
    setText(vehicleCamHintEl, rideHint);
    if (garageRideHud.canRehangInGarage) {
      nextPrompt = `[F] ${garageRideHud.rideName} WIEDER AN GARAGENWAND BEFESTIGEN`;
    }
  } else if (driveHud.inVehicle) {
    setText(vehicleNameEl, driveHud.vehicleName);
    setText(vehicleSpeedEl, `${driveHud.speedKmh}`);
    setWidth(vehicleHpFillEl, `${driveHud.hpPct}%`);
    vehicleHpFillEl.classList.toggle('low', driveHud.hpPct < 35);
    const car = vehicles.getActiveVehicle();
    const vigHint = car?.isPolice ? ` · [G] ${vigilante.isActive() ? 'VIGILANTE AUS' : 'VIGILANTE'}` : '';
    setText(vehicleCamHintEl, `[LMB] DRIVE-BY · [Q] ${audio.getRadioStation()}${vigHint} · [V] CAM · [E] AUS`);
    if (car && world.isInSafehouseGarage(car.position)) {
      nextPrompt = '[F] PRIVATE GARAGE · GRATIS REPARATUR (100%)';
    } else if (car && world.isCarInTuningBay(car.position)) {
      nextPrompt = car.tuned
        ? '[F] VICE CUSTOMS · NEON-UNDERGLOW WECHSELN & REPARATUR ($400)'
        : '[F] VICE CUSTOMS · TURBO (+30%), PANZERUNG & NEON-UNDERGLOW ($600)';
    } else if (car && world.isCarInExportBay(car.position)) {
      const exportSpec = world.canDeliverExportVehicle(car.name);
      nextPrompt = exportSpec
        ? `[F] IMPORT / EXPORT · ${car.name} ABLIEFERN (+$${exportSpec.reward})`
        : `[IMPORT / EXPORT] ${car.name} NICHT GESUCHT (SIEHE TAFEL)`;
    } else if (car && payNSpray.isCarInBay(car.position)) {
      nextPrompt = `[F] PAY 'N' SPRAY · $${payNSpray.cost} (REPARATUR & STERNE WEG)`;
    }
  } else {
    setText(weaponNameEl, wHud.name);
    setText(ammoCurrentEl, wHud.isMelee ? '∞' : wHud.reloading ? 'RLD' : String(wHud.ammo));
    setText(ammoMaxEl, wHud.isMelee ? 'MELEE' : `/ ${wHud.magSize}`);
    reloadBarEl.classList.toggle('visible', wHud.reloading);
    setWidth(reloadFillEl, `${Math.round(wHud.reloadProgress * 100)}%`);
    slotEls.forEach((el, idx) => el.classList.toggle('active', idx === wHud.slotIndex));

    const spreadStr = `${wHud.spreadPx}px`;
    if (crosshairEl.style.width !== spreadStr) {
      crosshairEl.style.width = spreadStr;
      crosshairEl.style.height = spreadStr;
    }
    crosshairEl.style.opacity = wHud.ads ? '0.45' : '0.88';

    hitmarkerEl.style.opacity = wHud.hitmarkerAlpha > 0.01 ? wHud.hitmarkerAlpha.toFixed(2) : '0';
    hitmarkerEl.classList.toggle('kill', wHud.hitmarkerKill && wHud.hitmarkerAlpha > 0.05);

    if (lookedWallRide) {
      nextPrompt =
        lookedWallRide.action === 'detach'
          ? `[E / F / LMB] ${lookedWallRide.promptLabel}`
          : `[F / LMB] ${lookedWallRide.promptLabel}`;
    } else if (lookedPet) {
      nextPrompt = `[LMB / F] ${lookedPet.promptLabel}`;
    } else if (lookedFood) {
      nextPrompt = `[LMB / F] ${lookedFood.name} NEHMEN & ESSEN (+${lookedFood.heal} HP)`;
    } else if (lookedCabinetWeapon) {
      nextPrompt = `[LMB / F] ${lookedCabinetWeapon.name} AUS WAFFENSCHRANK NEHMEN`;
    } else if (lookedAtTv) {
      nextPrompt = world.isTvOn()
        ? '[LMB / F] FERNSEHER AUSSCHALTEN'
        : '[LMB / F] FERNSEHER ANSCHALTEN · VICE CHANNEL 6';
    } else if (shop.isPlayerNear(player.position) && !shopOpen) {
      nextPrompt = '[B] AMMU-NEON SHOP ÖFFNEN ($)';
    } else if (world.isNearPetShop(player.position) && !petShopOpen) {
      nextPrompt = '[F / B] HAVANA PETS · SAFEHOUSE-HAUSTIER ADOPTIEREN (🐾)';
    } else if (world.isNearSafehouseWardrobe(player.position)) {
      nextPrompt = '[F] KLEIDERSCHRANK · OUTFIT WECHSELN';
    } else if (world.isNearSafehouseFridge(player.position)) {
      nextPrompt = '[F] KÜHLSCHRANK · SNACK ESSEN (+25 HP)';
    } else if (world.isNearSafehouseLounge(player.position)) {
      nextPrompt = '[F] SAFEHOUSE · HEILEN, MUNITION VOLL & SPEICHERN';
    } else if (world.isNearPdDesk(player.position) && wanted.stars >= 1) {
      nextPrompt = `[F] KAUTION / BESTECHUNG · $${wanted.stars * 200} (STERNE LÖSCHEN)`;
    } else if (world.isNearPdEvidenceCash(player.position)) {
      nextPrompt = '[F] SYNDIKAT-GELDKOFFER STEHLEN (+$1.500 · ⚠ 3★ ALARM)';
    } else if (world.isNearPdKevlar(player.position)) {
      nextPrompt = '[F] KEVLAR-WESTE STEHLEN (100% ARMOR · ⚠ ALARM)';
    } else if (world.isNearPdArmory(player.position)) {
      nextPrompt = '[F] POLIZEI-SHOTGUN & MUNITION STEHLEN (⚠ ALARM)';
    } else if (world.isNearPdUniform(player.position)) {
      nextPrompt = '[F] SPIND · VICE PD UNIFORM ANZIEHEN';
    } else if (world.isNearClubBar(player.position)) {
      nextPrompt = '[F] MIAMI VICE COCKTAIL TRINKEN · $50';
    } else if (world.isNearIslandVault(player.position)) {
      nextPrompt = '[F] STARFISH ESTATE · GOLD-TRESOR STEHLEN (+$2.500 · ⚠ 3★)';
    } else if (world.isNearYachtLoot(player.position)) {
      nextPrompt = '[F] SUPERYACHT „LADY VICE“ · KAPITÄNS-GOLD (+$1.800 · ⚠)';
    } else if (world.isNearDinerCounter(player.position)) {
      nextPrompt = '[F] STARLIGHT DINER · CUBAN BURGER & MILKSHAKE ($40 · 100% HP)';
    } else if (world.isNearBankVault(player.position)) {
      nextPrompt = '[F] BANCO DE VICE · BANK-TRESOR AUSRAUBEN (+$3.000 · ⚠ 4★ ALARM)';
    } else if (world.isNearMarinaLoot(player.position)) {
      nextPrompt = '[F] VICE MARINA · SCHMUGGLER-KOFFER STEHLEN (+$2.000 · ⚠ 2★)';
    } else if (world.isNearLighthouseSpot(player.position)) {
      nextPrompt = '[F] CAPE VICE LEUCHTTURM · AUSSICHT & ENTDECKER-BONUS';
    } else if (heistHud.nearStartMarker && !heistHud.active) {
      nextPrompt = '[H] OCEAN CLUB HEIST STARTEN (+$3.500)';
    } else if (heliPlayerHud.nearbyHeli) {
      nextPrompt = '[E] EINSTEIGEN · VICE MAVERICK HELIKOPTER';
    } else if (boatHud.nearbyBoat) {
      nextPrompt = '[E] EINSTEIGEN · STINGER SPEEDBOAT';
    } else if (garageRideHud.nearbyMountPrompt) {
      nextPrompt = garageRideHud.nearbyMountPrompt;
    } else if (driveHud.nearbyVehicleName) {
      nextPrompt = `[E] EINSTEIGEN · ${driveHud.nearbyVehicleName}`;
    }
  }

  if (nextPrompt) {
    setText(interactPromptEl, nextPrompt);
    interactPromptEl.classList.add('visible');
  } else {
    interactPromptEl.classList.remove('visible');
  }

  // Apply decaying Camera-Shake & progressive Drunk camera sway/vision effects right before rendering
  if (shakeTrauma > 0.001) {
    const s = shakeTrauma * shakeTrauma;
    camera.position.x += (Math.random() - 0.5) * s * 0.45;
    camera.position.y += (Math.random() - 0.5) * s * 0.45;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.06;
    shakeTrauma = Math.max(0, shakeTrauma - dt * 2.4);
  }

  if (drunkLevel > 0.005) {
    camera.rotation.z += Math.sin(elapsed * 1.65) * 0.125 * drunkLevel;
    camera.rotation.x += Math.cos(elapsed * 1.2) * 0.032 * drunkLevel;
    bloomPass.strength = 0.42 + drunkLevel * 0.62;
    bloomPass.radius = 0.48 + drunkLevel * 0.42;
  } else {
    bloomPass.strength = 0.42;
    bloomPass.radius = 0.48;
  }

  composer.render();
}

requestAnimationFrame(animate);
