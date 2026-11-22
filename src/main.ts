import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './style.css';
import { PlayerController } from './player/PlayerController';
import { PlayerAvatar } from './player/PlayerAvatar';
import { buildMiamiCity } from './world/CityBuilder';
import { WORLD_LANDMARKS } from './world/CityLayout';
import type { CabinetWeapon, FoodItem } from './world/Safehouse';
import { WeaponSystem } from './combat/WeaponSystem';
import { VehicleSystem } from './vehicles/VehicleSystem';
import { BoatSystem } from './vehicles/BoatSystem';
import { PlayerHelicopterSystem } from './vehicles/PlayerHelicopterSystem';
import { GarageRidesSystem, type GarageWallInteractable } from './vehicles/GarageRidesSystem';
import { SuperyachtSystem } from './vehicles/SuperyachtSystem';
import { DestructibleProps } from './world/DestructibleProps';
import { DecalSystem } from './world/DecalSystem';
import { RoadblockSystem } from './world/RoadblockSystem';
import { NpcSystem } from './entities/NpcSystem';
import { HelicopterSystem } from './entities/HelicopterSystem';
import { SafehousePets, type PetId, type PetInteractable } from './entities/SafehousePets';
import { WildlifeSystem } from './entities/WildlifeSystem';
import { WantedSystem } from './gameplay/WantedSystem';
import { ObjectiveSystem } from './gameplay/ObjectiveSystem';
import { StoryCampaign } from './gameplay/StoryCampaign';
import { HeistSystem } from './gameplay/HeistSystem';
import { RooftopPartySystem } from './gameplay/RooftopPartySystem';
import { VigilanteSystem } from './gameplay/VigilanteSystem';
import { SpecialVehicleMissionSystem } from './gameplay/SpecialVehicleMissions';
import { KittAiSystem } from './gameplay/KittAiSystem';
import { LowriderBattleSystem } from './gameplay/LowriderBattleSystem';
import { handleInteractKeyF, handleSpecialActionKeyG, type InteractionContext } from './gameplay/InteractionRouter';
import { ShopSystem } from './gameplay/ShopSystem';
import { PayNSpray } from './gameplay/PayNSpray';
import { Minimap } from './hud/Minimap';
import { AudioEngine, type AudioFrameState } from './audio/AudioEngine';
import { GamepadInput } from './engine/GamepadInput';
import { TouchControls } from './engine/TouchControls';
import { HudController } from './ui/HudController';
import { ModalController } from './ui/ModalController';
import type { AABB } from './types';
import {
  getActiveProfile,
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
  type GameSettings,
} from './engine/Storage';

const EMPTY_AABBS: AABB[] = [];

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const gpStatusEl = document.getElementById('gamepad-status');

// Core DOM elements (all HUD panels & modals are owned by HudController & ModalController)
const hudEl = document.getElementById('hud') as HTMLDivElement;
const photoBarEl = document.getElementById('photo-bar') as HTMLDivElement;
const dispatchBannerEl = document.getElementById('dispatch-banner') as HTMLDivElement;
const dispatchTextEl = document.getElementById('dispatch-text') as HTMLSpanElement;
const wastedOverlayEl = document.getElementById('wasted-overlay') as HTMLDivElement;
const audioStatusEl = document.getElementById('audio-status') as HTMLDivElement;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const hud = new HudController();

// Renderer (antialias: false on default backbuffer because EffectComposer uses a 4x MSAA HalfFloat target!)
const initialDpr = Math.min(window.devicePixelRatio, 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(initialDpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

// Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 420);

// Post-Processing (4x MSAA HalfFloat RenderTarget + Half-Resolution Neon & Sunset Bloom)
const composerTarget = new THREE.WebGLRenderTarget(
  Math.max(1, Math.floor(window.innerWidth * initialDpr)),
  Math.max(1, Math.floor(window.innerHeight * initialDpr)),
  {
    type: THREE.HalfFloatType,
    samples: 4,
  },
);
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(initialDpr);
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
const boat = new BoatSystem(scene, world.marinaBoats);
const maverick = new PlayerHelicopterSystem(scene, world.maverickSpawn);
const garageRides = new GarageRidesSystem(scene);
const superyacht = new SuperyachtSystem(scene, world.yacht);
const npcs = new NpcSystem(scene);
const heli = new HelicopterSystem(scene);
const pets = new SafehousePets(scene);
const wildlife = new WildlifeSystem(scene);
const wanted = new WantedSystem();
const objectives = new ObjectiveSystem(scene);
const story = new StoryCampaign(scene);
const heist = new HeistSystem(scene);
const rooftopParty = new RooftopPartySystem(scene);
const vigilante = new VigilanteSystem();
const specialMissions = new SpecialVehicleMissionSystem(scene);
const kittAi = new KittAiSystem();
const lowriderBattle = new LowriderBattleSystem();
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
let playerMaxHp = savedProgress.maxHpUnlocked ? 150 : 100;
let playerHp = playerMaxHp;
let playerArmor = savedProgress.armor;
let damageFlash = 0;
let timeJumpFlash = 0;
let retrowaveTimer = 0;
let shakeTrauma = 0;
let lastWantedStars = 0;
let dispatchTimer = 0;
let dispatchCooldown = 0;
let wastedTimer = 0;
let isBustedState = false;
let bustProgress = 0;
let lastBustedFine = 0;
let cocktailScore = 0; // <= 1.0 = sober, > 1.0 = progressively drunk (max 4.5 -> drunkLevel 1.0)
let hallucinationMode: 'none' | 'flamingos' | 'bigheads' = 'none';
let hallucinationSwitchTimer = 0;
let carryingSnackTimer = 0;
let carryingSnackName = 'DONUT';
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
let photoMode = false;
let photoYaw = 0;
let photoPitch = 0;
const photoKeys = new Set<string>();
const photoEulerScratch = new THREE.Euler(0, 0, 0, 'YXZ');
const photoFwdScratch = new THREE.Vector3();
const photoRightScratch = new THREE.Vector3();
const foodRaycaster = new THREE.Raycaster();
const camOriginScratch = new THREE.Vector3();
const camDirScratch = new THREE.Vector3();
let lookedFood: FoodItem | null = null;
let lookedCabinetWeapon: CabinetWeapon | null = null;
let lookedAtTv = false;
let lookedPet: PetInteractable | null = null;
let lookedWallRide: GarageWallInteractable | null = null;
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
  playerHp = Math.min(playerMaxHp, playerHp + item.heal);
  const gained = Math.round(playerHp - prevHp);
  audio.playEatCrunch();
  weapons.triggerEatAnimation();
  handHoldTimer = 0.45; // keep hand visible briefly during bite animation!
  if (item.alcohol && item.alcohol > 0) {
    cocktailScore = Math.min(6.0, cocktailScore + item.alcohol);
    const rawLevel = THREE.MathUtils.clamp((cocktailScore - 1.0) / 3.8, 0, 1);
    const hpNote = gained > 0 ? ` · +${gained} HP` : '';
    const buzzNote =
      rawLevel < 0.32 ? 'LEICHT ANGESCHWIPST 🍺' : rawLevel < 0.7 ? 'BETRUNKEN! 🍺' : 'VOLLRAUSCH! 🍺';
    showQuickToast(`${item.name} GETRUNKEN${hpNote} · ${buzzNote}`);
  } else {
    showQuickToast(
      gained > 0 ? `${item.name} GEGESSEN · +${gained} HP` : `${item.name} GEGESSEN · LECKER!`,
    );
    carryingSnackTimer = 45.0;
    carryingSnackName = item.name;
  }
  lookedFood = null;
  return true;
}

function applyActiveProfileToWorld(respawnPlayer: boolean): void {
  const active = getActiveProfile();
  const prog = loadProgress();
  const nextSettings = loadSettings();

  if (respawnPlayer) {
    if (vehicles.isInVehicle()) vehicles.exitVehicle();
    if (boat.isInBoat()) boat.disembark();
    if (superyacht.isInYacht()) superyacht.disembark();
    if (maverick.isInHeli()) maverick.exit(EMPTY_AABBS, world.getGroundHeight, world.playerGrid);
    if (garageRides.isRiding()) garageRides.dismountRide(world.layout.playableBounds);
    weapons.setEnabled(true);
    wanted.reset();
    lastWantedStars = 0;
    bustProgress = 0;
    cocktailScore = 0;
    npcs.clearPolice();
    npcs.calmAllLawAndGuards();
    heli.clear();
    world.clearPdAlarm();
    if (heist.isActive()) heist.failHeist(npcs);
    if (rooftopParty.isActive()) rooftopParty.stop();
    if (vigilante.isActive()) vigilante.stop(npcs);
    if (specialMissions.isActive()) specialMissions.stop();
    story.cancelChapter(npcs);
    player.setSpawn(60, 0.2, 24, 0.12);
    camera.fov = 75;
    camera.updateProjectionMatrix();
  }

  objectives.cash = prog.cash;
  objectives.completedCount = prog.completedMissions;
  lastCompletedCount = prog.completedMissions;
  objectives.setCompletedIds(prog.completedMissionIds ?? []);
  story.setCompletedChapters(prog.storyChapter ?? 0);
  specialMissions.setParamedicProgress(prog.paramedicRescues ?? 0, Boolean(prog.maxHpUnlocked));
  playerMaxHp = prog.maxHpUnlocked ? 150 : 100;
  playerHp = playerMaxHp;
  playerArmor = prog.armor;
  playerAvatar.setOutfit(prog.outfitIndex);
  pets.setOwnedPets((prog.ownedPets ?? []) as PetId[]);
  world.setSafehouseRooftopBarOwned(Boolean(prog.rooftopBarOwned));

  weapons.setLauncherUnlocked(Boolean(prog.launcherUnlocked));
  weapons.refillAllAmmo();
  weapons.switchWeapon(1);
  hud.setLauncherLocked(!prog.launcherUnlocked);

  applySettings(nextSettings);
  persistProgress();
  if (respawnPlayer) {
    showQuickToast(`SPIELER GEWECHSELT · ${active.name.toUpperCase()}`);
  }
}

function persistProgress(): void {
  const paramedic = specialMissions.getParamedicProgress();
  saveProgress({
    cash: objectives.cash,
    completedMissions: objectives.completedCount,
    launcherUnlocked: weapons.isLauncherUnlocked(),
    armor: Math.round(playerArmor),
    outfitIndex: playerAvatar.getOutfitIndex(),
    ownedPets: pets.getOwnedPets(),
    rooftopBarOwned: world.isSafehouseRooftopBarOwned(),
    completedMissionIds: objectives.getCompletedIds(),
    storyChapter: story.getCompletedChapters(),
    paramedicRescues: paramedic.rescues,
    maxHpUnlocked: paramedic.maxHpUnlocked,
    starterBonusApplied: true,
  });
  modals.updateStats(objectives.cash, objectives.completedCount);
}

function renderFrame(): void {
  if (settings.performanceMode) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }
}

function applySettings(next: GameSettings): void {
  settings = next;
  player.setSensitivityMultiplier(settings.mouseSensitivity);
  player.setInvertY(settings.invertMouseY);
  audio.setSfxVolume(settings.sfxVolume);
  audio.setMusicVolume(settings.musicVolume);
  const dpr = settings.performanceMode ? 1 : Math.min(window.devicePixelRatio, 2);
  renderer.shadowMap.enabled = !settings.performanceMode;
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.enabled = !settings.performanceMode;
  bloomPass.setSize(Math.max(1, Math.floor(window.innerWidth / 2)), Math.max(1, Math.floor(window.innerHeight / 2)));
  document.body.classList.toggle('perf-mode', settings.performanceMode);

  modals.syncSettingsUi(settings);
  saveSettings(settings);
}

const modals = new ModalController({
  canvas,
  overlay,
  slotLauncherEl: hud.slotLauncherEl,
  player,
  world,
  weapons,
  npcs,
  heli,
  pets,
  wanted,
  objectives,
  story,
  heist,
  rooftopParty,
  audio,
  getPlayerHp: () => playerHp,
  setPlayerHp: (hp) => {
    playerHp = hp;
  },
  getPlayerMaxHp: () => playerMaxHp,
  getPlayerArmor: () => playerArmor,
  setPlayerArmor: (armor) => {
    playerArmor = armor;
  },
  getSettings: () => settings,
  applySettings,
  onWantedStarsChanged: (stars) => {
    lastWantedStars = stars;
  },
  onClearCrimeRecord: () => {
    wanted.reset();
    lastWantedStars = 0;
    bustProgress = 0;
    npcs.clearPolice();
    npcs.calmAllLawAndGuards();
    heli.clear();
    world.clearPdAlarm();
    dispatchTimer = 0;
    dispatchCooldown = 0;
    dispatchBannerEl.classList.remove('visible');
    audio.playPurchase();
    showQuickToast('DEV · POLIZEI-AKTE & FAHNDUNG KOMPLETT AUF 0 ZURÜCKGESETZT');
    sendPoliceDispatch('Akten komplett gelöscht — alle Einheiten & Sperren abziehen.', true);
  },
  applyActiveProfileToWorld,
  persistProgress,
  requestLockSafely,
  showQuickToast,
});

applyActiveProfileToWorld(false);

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
    maverick.exit(EMPTY_AABBS, world.getGroundHeight, world.playerGrid);
    weapons.setEnabled(true);
  }
  if (garageRides.isRiding()) {
    garageRides.dismountRide(world.layout.playableBounds);
    weapons.setEnabled(true);
  }
  if (superyacht.isInYacht()) {
    superyacht.disembark();
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
    if (superyacht.isInYacht()) {
      superyacht.disembark();
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
  specialMissions.notifyTaxiStuntJump(distM);
  if (vehicles.getActiveVehicle()?.isKitt) {
    kittAi.speak('stunt', audio.isMuted());
  }
  showQuickToast(`INSANE STUNT BONUS · ${distM}m · +$${reward}`);
};

vehicles.onKittTurboBoost = () => {
  audio.playKittTurboBoost();
  addCameraShake(0.32);
  kittAi.speak('boost', audio.isMuted(), true);
};

vehicles.onDeloreanTimeJump = (_v, fromPos, toPos, destLabel) => {
  audio.playDeloreanTimeJump();
  addCameraShake(0.68);
  timeJumpFlash = 1.0;
  decals.addScorchMark(fromPos.x, fromPos.z);
  decals.addScorchMark(toPos.x, toPos.z);

  const hadWanted = wanted.stars > 0;
  wanted.reset();
  lastWantedStars = 0;
  bustProgress = 0;
  npcs.clearPolice();
  heli.clear();

  retrowaveTimer = 15.0;
  world.setRetrowaveMode(true);
  document.body.classList.add('retrowave-mode');

  showQuickToast(
    hadWanted
      ? `⚡ 88 MPH ZEITSPRUNG → ${destLabel} · RETROWAVE (15s) · FAHNDUNG GELÖSCHT!`
      : `⚡ 88 MPH ZEITSPRUNG → ${destLabel} · RETROWAVE-MODUS (15s)!`,
  );
  if (hadWanted) {
    sendPoliceDispatch('Verdächtiger im DeLorean bei 88 MPH verschwunden — nur brennende Reifenspuren übrig!', true);
  }
};

vehicles.onPoliceRamPlayer = (dmg) => {
  applyPlayerDamage(dmg);
};

vehicles.onCarCrash = (intensity, playerInvolved) => {
  audio.playCrash(intensity);
  if (playerInvolved) {
    addCameraShake(intensity * 0.55);
    if (intensity > 0.35 && vehicles.getActiveVehicle()?.isKitt) {
      kittAi.speak('crash', audio.isMuted());
    }
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

npcs.onIceCreamSale = (isPolice) => {
  const earned = isPolice ? 45 : 35;
  objectives.cash += earned;
  audio.playPurchase();
  persistProgress();
  showQuickToast(
    isPolice
      ? `VICE PD DONUT-PAUSE! · +$${earned} (COPS ABGELENKT!)`
      : `CHERRY POPPER '86 · EIS VERKAUFT · +$${earned}`,
  );
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
  showQuickToast('HAI-ALARM! · RIFFHAI IM TIEFEN WASSER — SCHNELL ZURÜCK ZUM PIER!');
};

wildlife.onSeagullStealSnack = (hadSnack) => {
  audio.playSeagullSquawk();
  addCameraShake(0.16);
  if (hadSnack) {
    carryingSnackTimer = 0;
    showQuickToast(`FRECHE MÖWE! · HAT DIR IM STURZFLUG DEINEN ${carryingSnackName} GEKLAUT!`);
  } else {
    const stolen = Math.min(objectives.cash, 15);
    if (stolen > 0) {
      objectives.cash -= stolen;
      persistProgress();
    }
    showQuickToast('FRECHE STRAND-MÖWE! · HAT DIR IM STURZFLUG EINEN SNACK AUS DER HAND GEKLAUT!');
  }
};

wildlife.onBeachBallBounce = (intensity) => {
  audio.playBeachBallBounce(intensity);
};

wildlife.onBeachBallPortGoal = () => {
  objectives.cash += 750;
  audio.playMissionPassed();
  persistProgress();
  showQuickToast('STRANDBALL-CHAMPION! · ÜBER OCEAN DRIVE BIS IN DEN VICE PORT GEKICKT · +$750!');
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

function interactWithLookedPet(): boolean {
  if (!lookedPet) return false;
  const p = lookedPet;
  pets.triggerReaction(p.id);
  weapons.triggerEatAnimation();
  handHoldTimer = 0.55;

  if (p.id === 'cleo') {
    audio.playCatPurr();
    playerHp = Math.min(playerMaxHp, playerHp + 15);
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
    playerHp = Math.min(playerMaxHp, playerHp + 25);
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
    if (maverick.canExit(EMPTY_AABBS, world.getGroundHeight, world.playerGrid)) {
      const land = maverick.exit(EMPTY_AABBS, world.getGroundHeight, world.playerGrid);
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
  } else if (superyacht.isInYacht()) {
    const deck = superyacht.disembark();
    player.setSpawn(deck.x, deck.y, deck.z, deck.yaw);
    camera.fov = 75;
    camera.updateProjectionMatrix();
    weapons.setEnabled(true);
    showQuickToast('SUPERYACHT „LADY VICE“ · ANKER GEWORFEN');
  } else if (garageRides.isRiding()) {
    const exitPos = garageRides.dismountRide(world.layout.playableBounds);
    if (exitPos) {
      player.setSpawn(exitPos.x, exitPos.y, exitPos.z, exitPos.yaw);
      camera.fov = 75;
      camera.updateProjectionMatrix();
      weapons.setEnabled(true);
    }
  } else if (vehicles.isInVehicle()) {
    const prevCar = vehicles.getActiveVehicle();
    if (lowriderBattle.isActive()) lowriderBattle.cancel();
    if (prevCar?.isKitt) kittAi.stop();
    if (prevCar?.specialRole === 'icecream') prevCar.jingleActive = false;
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
    boat.board(player.position);
    weapons.setEnabled(false);
  } else if (superyacht.isPlayerNear(player.position)) {
    superyacht.board();
    weapons.setEnabled(false);
    showQuickToast('SUPERYACHT „LADY VICE“ · [WASD] STEUERN · [V] BRÜCKE/CHASE · [E] ANKERN');
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
      if (nearest.isKitt) {
        kittAi.speak('enter', audio.isMuted(), true);
      } else if (nearest.specialRole === 'icecream') {
        showQuickToast("CHERRY POPPER '86 · [G] 8-BIT JINGLE AN/AUS (LOCKT COPS & PASSANTEN AN!)");
      }
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
    !modals.isAnyModalOpen() &&
    !photoMode &&
    !vehicles.isInVehicle() &&
    !boat.isInBoat() &&
    !superyacht.isInYacht() &&
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

const interactionCtx: InteractionContext = {
  camera,
  player,
  playerAvatar,
  world,
  weapons,
  vehicles,
  garageRides,
  npcs,
  heli,
  pets,
  wanted,
  objectives,
  rooftopParty,
  vigilante,
  specialMissions,
  lowriderBattle,
  audio,
  getPlayerHp: () => playerHp,
  setPlayerHp: (hp) => {
    playerHp = hp;
  },
  getPlayerMaxHp: () => playerMaxHp,
  getPlayerArmor: () => playerArmor,
  setPlayerArmor: (armor) => {
    playerArmor = armor;
  },
  getCocktailScore: () => cocktailScore,
  setCocktailScore: (score) => {
    cocktailScore = score;
  },
  setCarryingSnack: (name, durationSec) => {
    carryingSnackName = name;
    carryingSnackTimer = durationSec;
  },
  onMissionCompletedIncrement: () => {
    objectives.completedCount++;
    lastCompletedCount = objectives.completedCount;
  },
  tryUsePayNSpray,
  tryInteractLookedObject: () => {
    if (lookedFood && lookedFood.available) return eatLookedFood();
    if (lookedCabinetWeapon) return equipCabinetWeapon();
    if (lookedAtTv) {
      toggleSafehouseTv();
      return true;
    }
    if (lookedPet) return interactWithLookedPet();
    if (lookedWallRide) return interactWithLookedWallRide();
    return false;
  },
  togglePetShop: () => {
    if (modals.isPetShopOpen()) modals.closePetShop();
    else modals.openPetShop();
  },
  persistProgress,
  showQuickToast,
  sendPoliceDispatch,
};

window.addEventListener('mousemove', (e) => {
  if (!photoMode || document.pointerLockElement !== canvas) return;
  const ySign = settings.invertMouseY ? -1 : 1;
  photoYaw -= e.movementX * 0.0022 * settings.mouseSensitivity;
  photoPitch = Math.max(-1.45, Math.min(1.45, photoPitch - e.movementY * 0.0022 * settings.mouseSensitivity * ySign));
});

// Enter / Exit Vehicle on [E], Shop on [B], Radio on [Q], Photo Mode on [P], Mute Audio on [M]
window.addEventListener('keydown', (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLSelectElement
  ) {
    return;
  }
  photoKeys.add(e.code);

  // Developer Panel shortcut: [Alt+D] or [F2] anytime, or [D] while Pause overlay is open!
  const pauseOverlayVisible = !overlay.classList.contains('hidden');
  if (
    e.code === 'F2' ||
    (e.code === 'KeyD' && e.altKey) ||
    (e.code === 'KeyD' && pauseOverlayVisible && !modals.isShopOpen() && !modals.isPetShopOpen())
  ) {
    e.preventDefault();
    if (modals.isDevOpen()) modals.closeDevPanel();
    else if (!modals.isShopOpen() && !modals.isPetShopOpen()) modals.openDevPanel();
    return;
  }
  if (modals.isDevOpen()) {
    if (e.code === 'Escape') modals.closeDevPanel();
    return;
  }

  if (e.code === 'KeyJ' && !modals.isShopOpen() && !modals.isPetShopOpen() && !photoMode && wastedTimer <= 0) {
    if (modals.isPhoneOpen()) {
      modals.closePhone();
    } else if (player.getIsActive()) {
      modals.openPhone();
    }
    return;
  }
  if (modals.isPhoneOpen()) {
    if (e.code === 'Escape') modals.closePhone();
    return;
  }

  if (e.code === 'KeyP' && (player.getIsActive() || photoMode) && !modals.isShopOpen()) {
    photoMode = !photoMode;
    hudEl.classList.toggle('photo-hidden', photoMode);
    photoBarEl.classList.toggle('visible', photoMode);
    if (photoMode) {
      photoEulerScratch.setFromQuaternion(camera.quaternion, 'YXZ');
      photoYaw = photoEulerScratch.y;
      photoPitch = photoEulerScratch.x;
      weapons.setViewmodelVisible(false);
    } else {
      weapons.setViewmodelVisible(
        !vehicles.isInVehicle() &&
          !boat.isInBoat() &&
          !superyacht.isInYacht() &&
          !maverick.isInHeli() &&
          !garageRides.isRiding() &&
          !player.isThirdPerson(),
      );
    }
    return;
  }

  if (e.code === 'KeyK' && photoMode) {
    // Capture clean PNG screenshot directly from WebGL canvas
    renderFrame();
    const link = document.createElement('a');
    link.download = `vice-dusk-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return;
  }

  if (photoMode) return;
  if (lowriderBattle.isActive() && player.getIsActive() && !modals.isShopOpen() && !modals.isPetShopOpen()) {
    if (e.code === 'Escape') {
      lowriderBattle.cancel();
      showQuickToast('LOWRIDER-BATTLE ABGEBROCHEN');
      return;
    }
    const car = vehicles.getActiveVehicle();
    const res = lowriderBattle.handleKey(e.code);
    if (res.dir && car) {
      e.preventDefault();
      const hopMap = { up: 'front', down: 'back', left: 'left', right: 'right', hop: 'up' } as const;
      vehicles.triggerHydraulicHop(car, hopMap[res.dir]);
      audio.playHydraulicBounce(res.quality === 'perfect');
      if (res.matched) {
        addCameraShake(res.quality === 'perfect' ? 0.14 : 0.08);
      }
      return;
    }
  }
  if (modals.isPetShopOpen() && (e.code === 'KeyF' || e.code === 'KeyB' || e.code === 'Escape')) {
    modals.closePetShop();
    return;
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    audioStatusEl.textContent = muted ? 'AUDIO: STUMM [M]' : 'AUDIO: AN [M]';
    audioStatusEl.classList.toggle('muted', muted);
    return;
  }

  if (e.code === 'KeyX' && player.getIsActive() && !modals.isShopOpen() && !modals.isPetShopOpen() && wastedTimer <= 0) {
    const onFoot =
      !vehicles.isInVehicle() &&
      !boat.isInBoat() &&
      !superyacht.isInYacht() &&
      !maverick.isInHeli() &&
      !garageRides.isRiding();
    if (onFoot) {
      const wasInCover = player.isInCover();
      if (player.toggleCover()) {
        showQuickToast(
          wasInCover
            ? 'DECKUNG VERLASSEN'
            : 'IN DECKUNG · [A/D] ENTLANG · [RMB] SPÄHEN & SCHIESSEN · [Q/X] RAUS',
        );
      } else {
        showQuickToast('KEINE DECKUNG IN DER NÄHE · NAH AN WAND ODER AUTO STELLEN');
      }
    }
    return;
  }

  if (e.code === 'KeyQ' && player.getIsActive() && !modals.isShopOpen()) {
    const onFoot =
      !vehicles.isInVehicle() &&
      !boat.isInBoat() &&
      !superyacht.isInYacht() &&
      !maverick.isInHeli() &&
      !garageRides.isRiding();
    if (onFoot && (player.isInCover() || player.canTakeCover())) {
      const wasInCover = player.isInCover();
      if (player.toggleCover()) {
        showQuickToast(
          wasInCover
            ? 'DECKUNG VERLASSEN'
            : 'IN DECKUNG · [A/D] ENTLANG · [RMB] SPÄHEN & SCHIESSEN · [Q/X] RAUS',
        );
      }
      return;
    }
    const station = audio.nextRadioStation();
    showQuickToast(`RADIO · ${station}`);
    return;
  }

  if (e.code === 'KeyT' && player.getIsActive() && !modals.isShopOpen()) {
    const label = world.cycleTimeOfDay();
    showQuickToast(`LICHT · ${label}`);
    return;
  }

  if (e.code === 'KeyY' && player.getIsActive() && !modals.isShopOpen()) {
    const raining = world.toggleRain();
    showQuickToast(raining ? 'WETTER · TROPENSCHAUER' : 'WETTER · NACH DEM REGEN');
    return;
  }

  if (e.code === 'KeyH' && player.getIsActive() && !modals.isShopOpen() && wastedTimer <= 0) {
    if (!heist.isActive()) {
      heist.startHeist();
      audio.playCheckpoint();
    }
    return;
  }

  if (e.code === 'KeyG' && player.getIsActive() && !modals.isShopOpen() && wastedTimer <= 0) {
    handleSpecialActionKeyG(interactionCtx);
    return;
  }

  if (e.code === 'KeyF' && player.getIsActive() && !modals.isShopOpen() && wastedTimer <= 0) {
    handleInteractKeyF(interactionCtx);
    return;
  }

  if (e.code === 'KeyB' && wastedTimer <= 0) {
    if (modals.isShopOpen()) {
      modals.closeShop();
    } else if (modals.isPetShopOpen()) {
      modals.closePetShop();
    } else if (player.getIsActive() && !vehicles.isInVehicle() && shop.isPlayerNear(player.position)) {
      modals.openShop();
    } else if (player.getIsActive() && !vehicles.isInVehicle() && world.isNearPetShop(player.position)) {
      modals.openPetShop();
    }
    return;
  }

  if (e.code === 'Escape' && (modals.isShopOpen() || modals.isPetShopOpen())) {
    modals.closeActiveModal();
    return;
  }

  if (e.code === 'KeyE' && player.getIsActive() && !modals.isShopOpen() && wastedTimer <= 0) {
    tryToggleVehicleOrBoat();
    return;
  }

  if (
    e.code === 'KeyV' &&
    player.getIsActive() &&
    !modals.isShopOpen() &&
    !vehicles.isInVehicle() &&
    !boat.isInBoat() &&
    !superyacht.isInYacht() &&
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

function startGame(fromGamepad = false): void {
  audio.unlock();
  overlay.classList.add('hidden');
  player.setActive(true);
  if (fromGamepad) {
    // Gamepad play does not need mouse Pointer Lock (and requestPointerLock fails outside DOM click/key gestures!)
    pointerLockFallback = true;
  } else {
    requestLockSafely();
  }
}

function pauseGame(): void {
  if (modals.isAnyModalOpen()) return;
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
  if (player.getIsActive() && !player.getIsLocked() && !modals.isAnyModalOpen()) {
    requestLockSafely();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    pointerLockFallback = false;
    overlay.classList.add('hidden');
    player.setActive(true);
  } else if (!pointerLockFallback && !modals.isAnyModalOpen()) {
    pauseGame();
  }
});

document.addEventListener('pointerlockerror', () => {
  pointerLockFallback = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && player.getIsActive() && !player.getIsLocked() && !modals.isShopOpen() && !modals.isPetShopOpen()) {
    pauseGame();
  }
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const dpr = settings.performanceMode ? 1 : Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(Math.max(1, Math.floor(window.innerWidth / 2)), Math.max(1, Math.floor(window.innerHeight / 2)));
});

// Pre-allocated per-frame scratch buffers (zero GC pressure in 60-144Hz main loop!)
const playerDynColliders: AABB[] = [];
const garageRideDynColliders: AABB[] = [];
const npcDynColliders: AABB[] = [];
const shootableHitboxes: THREE.Object3D[] = [];
const interactMeshesScratch: THREE.Object3D[] = [];
const yachtRadarState = { x: 0, z: 0, yaw: 0 };
const playerCoverScratch = { inCover: true, peeking: false, normalX: 0, normalZ: 1 };
const audioFrameScratch: AudioFrameState = {
  dt: 0,
  elapsed: 0,
  isActive: false,
  inVehicle: false,
  speedKmh: 0,
  drifting: false,
  onFootSpeed: 0,
  grounded: true,
  wantedStars: 0,
  playerX: 0,
  clubProximity: 0,
  rideAudioMode: 'motor',
  emergencySirenActive: false,
  iceCreamJingleActive: false,
  sharkDanger: 0,
};

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
    photoEulerScratch.set(photoPitch, photoYaw, 0, 'YXZ');
    photoFwdScratch.set(0, 0, -1).applyEuler(photoEulerScratch);
    photoEulerScratch.set(0, photoYaw, 0, 'YXZ');
    photoRightScratch.set(1, 0, 0).applyEuler(photoEulerScratch);
    if (photoKeys.has('KeyW')) camera.position.addScaledVector(photoFwdScratch, flySpd);
    if (photoKeys.has('KeyS')) camera.position.addScaledVector(photoFwdScratch, -flySpd);
    if (photoKeys.has('KeyD')) camera.position.addScaledVector(photoRightScratch, flySpd);
    if (photoKeys.has('KeyA')) camera.position.addScaledVector(photoRightScratch, -flySpd);
    if (photoKeys.has('KeyE') || photoKeys.has('Space')) camera.position.y += flySpd;
    if (photoKeys.has('KeyQ') || photoKeys.has('KeyC')) camera.position.y = Math.max(0.4, camera.position.y - flySpd);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = photoYaw;
    camera.rotation.x = photoPitch;
    camera.rotation.z = 0;
    renderFrame();
    return;
  }

  // Handle Wasted / Busted respawn countdown
  if (wastedTimer > 0) {
    wastedTimer -= dt;
    if (wastedTimer <= 0) {
      wastedOverlayEl.classList.remove('visible', 'busted');
      playerHp = playerMaxHp;
      cocktailScore = 0;
      canvas.style.filter = '';
      wanted.reset();
      npcs.clearPolice();
      heli.clear();
      if (heist.isActive()) heist.failHeist(npcs);
      if (story.isActive()) story.failChapter(npcs);
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
  if (gpStatusEl && gpStatusEl.textContent !== rawPad.diagnostic) {
    gpStatusEl.textContent = rawPad.diagnostic;
    gpStatusEl.style.color = rawPad.connected ? '#6bf7c8' : '#ffb86c';
  }
  if (rawPad.connected && !padConnectedToastShown) {
    padConnectedToastShown = true;
    showQuickToast('GAMEPAD VERBUNDEN · CONTROLLER AKTIV');
  } else if (!rawPad.connected && padConnectedToastShown) {
    padConnectedToastShown = false;
  }
  const pad = touch.mergeInto(rawPad);

  if (pad.connected) {
    // Menu/Start toggles pause or closes any open modal; A resumes from title screen; B closes open modals!
    if (pad.startPressed) {
      if (!modals.closeActiveModal()) {
        if (player.getIsActive()) pauseGame();
        else startGame(true);
      }
    } else if (pad.bPressed && modals.isAnyModalOpen()) {
      modals.closeActiveModal();
    } else if (pad.aPressed && !player.getIsActive() && !modals.isAnyModalOpen()) {
      startGame(true);
    }
  }

  const isPlaying = player.getIsActive() && !modals.isAnyModalOpen() && wastedTimer <= 0;

  // Gradually sober up over time; 1st cocktail keeps drunkLevel at 0
  if (cocktailScore > 0) {
    cocktailScore = Math.max(0, cocktailScore - dt * 0.025);
  }
  const rawDrunk = THREE.MathUtils.clamp((cocktailScore - 1.0) / 3.8, 0, 1);
  const drunkLevel = Math.pow(rawDrunk, 1.25);

  // Drunk Hallucinations (Neon Club / Cocktails): randomly alternates between
  // Giant Pink Flamingo Police Cars & Big Head Mode for all pedestrians/NPCs!
  if (drunkLevel >= 0.35) {
    hallucinationSwitchTimer -= dt;
    if (hallucinationMode === 'none' || hallucinationSwitchTimer <= 0) {
      const nextMode: 'flamingos' | 'bigheads' =
        hallucinationMode === 'none'
          ? Math.random() < 0.5
            ? 'flamingos'
            : 'bigheads'
          : hallucinationMode === 'flamingos'
            ? 'bigheads'
            : 'flamingos';
      hallucinationMode = nextMode;
      hallucinationSwitchTimer = 14 + Math.random() * 8;
      vehicles.setPoliceFlamingoMode(nextMode === 'flamingos');
      npcs.setBigHeadMode(nextMode === 'bigheads');
      showQuickToast(
        nextMode === 'flamingos'
          ? '🍹 HALLUZINATION! · ALLE POLIZEIAUTOS SEHEN AUS WIE RIESIGE ROSA FLAMINGOS!'
          : '🍹 HALLUZINATION! · BIG HEAD MODE — ALLE PASSANTEN HABEN RIESIGE KÖPFE!',
      );
    }
  } else if (hallucinationMode !== 'none' && drunkLevel < 0.22) {
    hallucinationMode = 'none';
    hallucinationSwitchTimer = 0;
    vehicles.setPoliceFlamingoMode(false);
    npcs.setBigHeadMode(false);
    showQuickToast('AUSGENÜCHTERT · HALLUZINATIONEN VERKLINGEN');
  }

  if (isPlaying && pad.connected) {
    if (pad.interactPressed) tryToggleVehicleOrBoat();
    if (
      pad.camTogglePressed &&
      !vehicles.isInVehicle() &&
      !boat.isInBoat() &&
      !superyacht.isInYacht() &&
      !maverick.isInHeli() &&
      !garageRides.isRiding()
    ) {
      const is3p = player.toggleThirdPerson();
      weapons.setViewmodelVisible(!is3p);
      showQuickToast(is3p ? 'KAMERA · 3RD PERSON' : 'KAMERA · FIRST PERSON');
    }
    if (
      pad.coverPressed &&
      !vehicles.isInVehicle() &&
      !boat.isInBoat() &&
      !superyacht.isInYacht() &&
      !maverick.isInHeli() &&
      !garageRides.isRiding()
    ) {
      const wasInCover = player.isInCover();
      if (player.toggleCover()) {
        showQuickToast(wasInCover ? 'DECKUNG VERLASSEN' : 'IN DECKUNG · [LT] ZUM HERVORLUGEN');
      }
    }
    if (pad.phonePressed) {
      modals.openPhone();
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
  const inYacht = superyacht.isInYacht();
  const inHeli = maverick.isInHeli();
  const inGarageRide = garageRides.isRiding();
  const inAnyCraft = inVehicle || inBoat || inYacht || inHeli || inGarageRide;

  let playerSpeed = 0;
  let playerGrounded = true;
  let playerCrouching = false;
  let playerSwimming = false;
  let playerInCover = false;
  let playerCoverPeeking = false;
  let playerCoverNormalX = 0;
  let playerCoverNormalZ = 1;
  let playerCanTakeCover = false;
  let playerWaterClimbLabel: string | null = null;
  let headingYaw = player.getYaw();
  const rbColliders = roadblocks.getActiveColliders();

  if (!inAnyCraft) {
    playerDynColliders.length = 0;
    vehicles.appendVehicleColliders(playerDynColliders);
    boat.appendBoatColliders(playerDynColliders);
    npcs.appendNpcColliders(playerDynColliders);
    for (let i = 0; i < rbColliders.length; i++) playerDynColliders.push(rbColliders[i]);
    const status = player.update(
      dt,
      playerDynColliders,
      pad,
      world.getGroundHeight,
      world.cameraMeshes,
      weapons.isAdsActive(),
      drunkLevel,
      world.playerGrid,
    );
    playerSpeed = status.speed;
    playerGrounded = status.grounded;
    playerCrouching = status.crouching;
    playerSwimming = status.swimming;
    playerInCover = status.inCover;
    playerCoverPeeking = status.coverPeeking;
    playerCoverNormalX = status.coverNormalX;
    playerCoverNormalZ = status.coverNormalZ;
    playerCanTakeCover = status.canTakeCover;
    playerWaterClimbLabel = status.waterClimbLabel;
  } else if (inVehicle) {
    player.exitCover();
    const car = vehicles.getActiveVehicle();
    if (car) {
      player.position.copy(car.position);
      headingYaw = car.yaw + Math.PI;
    }
  } else if (inGarageRide) {
    player.exitCover();
    const gr = garageRides.getActiveRide();
    if (gr) {
      player.position.copy(gr.position);
      headingYaw = gr.yaw + Math.PI;
    }
  } else if (inBoat) {
    player.exitCover();
    player.position.copy(boat.position);
    headingYaw = boat.yaw + Math.PI;
  } else if (inYacht) {
    player.exitCover();
    player.position.copy(superyacht.position);
    headingYaw = superyacht.yaw + Math.PI;
  } else if (inHeli) {
    player.exitCover();
    player.position.copy(maverick.position);
    headingYaw = maverick.yaw + Math.PI;
  }

  const driveHud = vehicles.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    wanted.stars,
    camera,
    rbColliders,
    world.layout.playableBounds,
    pad,
    world.stuntRamps,
    world.shouldTrafficStop,
    drunkLevel,
    world.getGroundHeight,
    world.vehicleGrid,
    audio.getRadioBeatPulse(),
    lowriderBattle.isActive(),
  );
  garageRideDynColliders.length = 0;
  if (inGarageRide) {
    vehicles.appendVehicleColliders(garageRideDynColliders);
    for (let i = 0; i < rbColliders.length; i++) garageRideDynColliders.push(rbColliders[i]);
  }
  const garageRideHud = garageRides.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    camera,
    garageRideDynColliders,
    world.layout.playableBounds,
    pad,
    world.stuntRamps,
    drunkLevel,
    world.getGroundHeight,
    world.playerGrid,
  );
  if (inGarageRide) {
    const gr = garageRides.getActiveRide();
    if (gr && Math.abs(gr.speed) > 5.0) {
      destructibles.handleVehicleImpact(gr.position, gr.yaw, Math.abs(gr.speed));
    }
  }
  const boatHud = boat.update(dt, elapsed, isPlaying, player.position, camera, pad, superyacht.position);
  const yachtHud = superyacht.update(dt, elapsed, isPlaying, player.position, camera, pad);
  const heliPlayerHud = maverick.update(
    dt,
    isPlaying,
    player.position,
    camera,
    EMPTY_AABBS,
    world.getGroundHeight,
    pad,
    world.playerGrid,
  );

  world.update(
    elapsed,
    dt,
    player.position,
    objectives.cash,
    wanted.stars,
    player.getYaw(),
    settings.performanceMode,
  );
  const inSafehouse = world.isInsideSafehouse(player.position);
  pets.update(dt, elapsed, player.position, inSafehouse);
  if (carryingSnackTimer > 0) carryingSnackTimer = Math.max(0, carryingSnackTimer - dt);
  const activeCarForBall = vehicles.getActiveVehicle();
  const wildlifeHud = wildlife.update(
    dt,
    elapsed,
    player.position,
    playerSwimming && !inAnyCraft,
    carryingSnackTimer > 0,
    inAnyCraft,
    activeCarForBall?.position,
    activeCarForBall?.speed ?? 0,
    world.getGroundHeight,
    rbColliders,
    world.vehicleGrid,
  );
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
      if (activeCar?.isKitt) {
        kittAi.speak('wanted', audio.isMuted());
      }
    } else if (wanted.stars >= 3) {
      sendPoliceDispatch(`Code 3! Air-One Helikopter startet über ${area}!`, true);
    }
  }
  lastWantedStars = wanted.stars;
  const indoors =
    inSafehouse ||
    world.isInsideClub(player.position) ||
    world.isInsidePoliceStation(player.position) ||
    world.isInsideWestInterior(player.position);
  let playerCoverState: typeof playerCoverScratch | undefined;
  if (playerInCover) {
    playerCoverScratch.peeking = playerCoverPeeking;
    playerCoverScratch.normalX = playerCoverNormalX;
    playerCoverScratch.normalZ = playerCoverNormalZ;
    playerCoverState = playerCoverScratch;
  }
  npcDynColliders.length = 0;
  vehicles.appendVehicleColliders(npcDynColliders);
  for (let i = 0; i < rbColliders.length; i++) npcDynColliders.push(rbColliders[i]);
  const activeCarNow = vehicles.getActiveVehicle();
  const iceCreamJingleOn = Boolean(activeCarNow?.specialRole === 'icecream' && activeCarNow.jingleActive);
  const iceCreamLure = iceCreamJingleOn && activeCarNow
    ? {
        pos: activeCarNow.position,
        active: true,
        nearPrecinct:
          Math.hypot(
            activeCarNow.position.x - WORLD_LANDMARKS.VICE_PD_PRECINCT.x,
            activeCarNow.position.z - WORLD_LANDMARKS.VICE_PD_PRECINCT.z,
          ) < 38,
      }
    : undefined;
  const npcTick = npcs.update(
    dt,
    player.position,
    wanted.stars,
    npcDynColliders,
    playerCoverState,
    world.npcGrid,
    iceCreamLure,
  );
  if (npcTick.distractedCops > 0 && wanted.stars > 0) {
    wanted.update(dt * 2.5);
  }

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
  const partyHud = rooftopParty.update(dt, elapsed, player.position, wanted.stars, npcs);
  if (partyHud.fireworkPopped) {
    audio.playExplosion();
  }
  if (partyHud.crewShotFired) {
    audio.playShot('pistol');
  }
  if (partyHud.toastText) {
    showQuickToast(partyHud.toastText);
  }
  const storyHud = story.update(dt, elapsed, player.position, inBoat || inYacht || inHeli, npcs, wanted);
  if (storyHud.completedChapterReward > 0) {
    objectives.cash += storyHud.completedChapterReward;
    objectives.completedCount++;
    lastCompletedCount = objectives.completedCount;
    wanted.reset();
    npcs.clearPolice();
    heli.clear();
    audio.playMissionPassed();
    persistProgress();
  }
  if (storyHud.toastText) {
    showQuickToast(storyHud.toastText);
  }
  const kittHud = kittAi.update(dt);
  const lowriderHud = lowriderBattle.update(dt);
  if (lowriderHud.finishedToast) {
    if (lowriderHud.finishedReward > 0) {
      objectives.cash += lowriderHud.finishedReward;
      objectives.completedCount++;
      lastCompletedCount = objectives.completedCount;
      audio.playMissionPassed();
      persistProgress();
    }
    showQuickToast(lowriderHud.finishedToast);
  }
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

  const specialHud = specialMissions.update(
    dt,
    elapsed,
    isPlaying,
    player.position,
    vehicles.getActiveVehicle(),
    driveHud.drifting,
    vehicles.vehicles,
    npcs,
    npcDynColliders,
    pad,
    world.npcGrid,
  );
  if (specialHud.waterSplashEvent) {
    audio.playWaterCannonPulse();
  }
  if (specialHud.sprayedPolice) {
    wanted.addHeat(14 * dt);
  }
  if (specialHud.maxHpJustUnlocked) {
    playerMaxHp = 150;
    playerHp = 150;
  }
  if (specialHud.rewardEarned > 0) {
    objectives.cash += specialHud.rewardEarned;
    objectives.completedCount++;
    lastCompletedCount = objectives.completedCount;
    audio.playMissionPassed();
    persistProgress();
  } else if (specialHud.toastText && specialHud.active) {
    audio.playCheckpoint();
  }
  if (specialHud.dispatchMsg) {
    sendPoliceDispatch(specialHud.dispatchMsg, true);
  }
  if (specialHud.toastText) {
    showQuickToast(specialHud.toastText);
  }

  const objHud = objectives.update(dt, elapsed, player.position, vehicles, npcs, wanted, inGarageRide);

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

  audioFrameScratch.dt = dt;
  audioFrameScratch.elapsed = elapsed;
  audioFrameScratch.isActive = isPlaying;
  audioFrameScratch.inVehicle = inAnyCraft;
  audioFrameScratch.speedKmh = inBoat
    ? boatHud.speedKmh
    : inYacht
      ? yachtHud.speedKmh
      : inHeli
        ? heliPlayerHud.speedKmh
        : inGarageRide
          ? garageRideHud.speedKmh
          : driveHud.speedKmh;
  audioFrameScratch.drifting = driveHud.drifting;
  audioFrameScratch.onFootSpeed = playerSpeed;
  audioFrameScratch.grounded = inGarageRide ? garageRideHud.grounded : playerGrounded;
  audioFrameScratch.wantedStars = wanted.stars;
  audioFrameScratch.playerX = player.position.x;
  audioFrameScratch.clubProximity = Math.max(
    world.getClubProximity(player.position),
    rooftopParty.getMusicProximity(player.position),
  );
  audioFrameScratch.rideAudioMode = inGarageRide && garageRideHud.rideId ? garageRideHud.rideId : 'motor';
  audioFrameScratch.emergencySirenActive = specialHud.kind === 'firefighter' || specialHud.kind === 'paramedic';
  audioFrameScratch.iceCreamJingleActive = iceCreamJingleOn;
  audioFrameScratch.sharkDanger = wildlifeHud.sharkDanger;
  audio.update(audioFrameScratch);

  shootableHitboxes.length = 0;
  npcs.appendShootableHitboxes(shootableHitboxes);
  vehicles.appendShootableHitboxes(shootableHitboxes);
  destructibles.appendShootableHitboxes(shootableHitboxes);
  heli.appendShootableHitboxes(shootableHitboxes);
  wildlife.appendShootableHitboxes(shootableHitboxes);

  // Crosshair raycast for Safehouse food items, gun cabinet weapons, CRT TV & Safehouse Pets -> switches weapon to open Hand!
  if (handHoldTimer > 0) handHoldTimer = Math.max(0, handHoldTimer - dt);
  lookedFood = null;
  lookedCabinetWeapon = null;
  lookedAtTv = false;
  lookedPet = null;
  lookedWallRide = null;
  const sf = WORLD_LANDMARKS.SAFEHOUSE_LOT;
  const onSafehouseLot =
    player.position.x > sf.minX &&
    player.position.x < sf.maxX &&
    player.position.z > sf.minZ &&
    player.position.z < sf.maxZ &&
    player.position.y < 9.0;
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
        interactMeshesScratch.length = 0;
        for (let i = 0; i < wallRides.length; i++) interactMeshesScratch.push(wallRides[i].hitbox);
        const wallHits = foodRaycaster.intersectObjects(interactMeshesScratch, false);
        if (wallHits.length > 0) {
          lookedWallRide = wallRides.find((w) => w.hitbox === wallHits[0].object) ?? null;
        }
      }

      const petTargets = pets.getInteractables();
      if (!lookedWallRide && petTargets.length > 0) {
        interactMeshesScratch.length = 0;
        for (let i = 0; i < petTargets.length; i++) interactMeshesScratch.push(petTargets[i].hitbox);
        const petHits = foodRaycaster.intersectObjects(interactMeshesScratch, false);
        if (petHits.length > 0) {
          lookedPet = petTargets.find((p) => p.hitbox === petHits[0].object) ?? null;
        }
      }
    }

    const foods = world.getFoodItems();
    if (!lookedWallRide && !lookedPet && foods.length > 0) {
      interactMeshesScratch.length = 0;
      for (let i = 0; i < foods.length; i++) interactMeshesScratch.push(foods[i].mesh);
      const foodHits = foodRaycaster.intersectObjects(interactMeshesScratch, true);
      if (foodHits.length > 0) {
        const hitObj = foodHits[0].object;
        lookedFood = foods.find((f) => f.mesh === hitObj || f.mesh.children.includes(hitObj)) ?? null;
      }
    }

    if (!lookedWallRide && !lookedFood) {
      const cabWeapons = world.getCabinetWeapons();
      interactMeshesScratch.length = 0;
      for (let i = 0; i < cabWeapons.length; i++) interactMeshesScratch.push(cabWeapons[i].mesh);
      const cabHits = foodRaycaster.intersectObjects(interactMeshesScratch, true);
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

  const wHud = weapons.update(dt, isPlaying && !inAnyCraft && !playerSwimming, playerSpeed, world.worldMeshes, shootableHitboxes, pad, drunkLevel);
  weapons.setViewmodelVisible(!inAnyCraft && !player.isThirdPerson() && !playerSwimming);
  const showMirrorAvatar = inSafehouse && !inAnyCraft && !player.isThirdPerson();
  playerAvatar.setMirrorOnlyMode(showMirrorAvatar);
  playerAvatar.setVisible(!inAnyCraft && (player.isThirdPerson() || showMirrorAvatar));
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
    playerCoverState,
  );
  if (inVehicle) {
    const car = vehicles.getActiveVehicle();
    if (car && car.specialRole !== 'firetruck') {
      weapons.updateDriveBy(dt, isPlaying, car.position, world.worldMeshes, shootableHitboxes, pad);
    }
  } else if (inGarageRide) {
    const gr = garageRides.getActiveRide();
    if (gr) {
      weapons.updateDriveBy(dt, isPlaying, gr.position, world.worldMeshes, shootableHitboxes, pad);
    }
  }

  yachtRadarState.x = superyacht.position.x;
  yachtRadarState.z = superyacht.position.z;
  yachtRadarState.yaw = superyacht.yaw;
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
    storyHud.targetPos ?? vigilanteHud.targetPos ?? specialHud.targetPos ?? heistHud.targetPos,
    maverick.position,
    garageRides.getParkedMarkers(),
    yachtRadarState,
    boat.getBoatMarkers(),
  );

  // --- HUD & Visual Timers ---
  damageFlash = Math.max(0, damageFlash - dt * 2.2);
  if (timeJumpFlash > 0) timeJumpFlash = Math.max(0, timeJumpFlash - dt * 1.45);
  if (retrowaveTimer > 0) {
    retrowaveTimer = Math.max(0, retrowaveTimer - dt);
    if (retrowaveTimer <= 0) {
      world.setRetrowaveMode(false);
      document.body.classList.remove('retrowave-mode');
      showQuickToast('ZEITSPRUNG BEENDET · ZURÜCK IN PALM CITY ’86');
    }
  }
  if (quickToastTimer > 0) quickToastTimer = Math.max(0, quickToastTimer - dt);

  hud.update({
    damageFlash,
    timeJumpFlash,
    retrowaveTimer,
    playerPos: player.position,
    playerHp,
    playerMaxHp,
    playerArmor,
    cash: objHud.cash,
    wanted,
    radioStation: audio.getRadioStation(),
    inAnyCraft,
    activeCar: vehicles.getActiveVehicle(),
    activeSpecialKind: specialMissions.getActiveKind(),
    vigilanteActive: vigilante.isActive(),
    lowriderBattleActive: lowriderBattle.isActive(),
    shopOpen: modals.isShopOpen(),
    petShopOpen: modals.isPetShopOpen(),
    world,
    shop,
    payNSpray,
    storyHud,
    kittHud,
    vigilanteHud,
    specialHud,
    heistHud,
    partyHud,
    objHud,
    lowriderHud,
    activeToast: quickToastTimer > 0 ? quickToastText : objHud.toastText,
    wHud,
    driveHud,
    garageRideHud,
    boatHud,
    yachtHud,
    heliPlayerHud,
    lookedWallRide,
    lookedPet,
    lookedFood,
    lookedCabinetWeapon,
    lookedAtTv,
    playerWaterClimbLabel,
    playerInCover,
    playerCoverPeeking,
    playerCanTakeCover,
  });

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
    bloomPass.strength = (retrowaveTimer > 0 ? 0.78 : 0.42) + drunkLevel * 0.62;
    bloomPass.radius = 0.48 + drunkLevel * 0.42;
  } else {
    bloomPass.strength = retrowaveTimer > 0 ? 0.78 : 0.42;
    bloomPass.radius = retrowaveTimer > 0 ? 0.68 : 0.48;
  }

  renderFrame();
}

requestAnimationFrame(animate);
