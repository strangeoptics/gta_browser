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
import { SuperyachtSystem } from './vehicles/SuperyachtSystem';
import { DestructibleProps } from './world/DestructibleProps';
import { DecalSystem } from './world/DecalSystem';
import { RoadblockSystem } from './world/RoadblockSystem';
import { NpcSystem } from './entities/NpcSystem';
import { HelicopterSystem } from './entities/HelicopterSystem';
import { SafehousePets, PET_CATALOG, type PetId, type PetInteractable } from './entities/SafehousePets';
import { WildlifeSystem } from './entities/WildlifeSystem';
import { WantedSystem } from './gameplay/WantedSystem';
import { MISSION_CONTRACTS, ObjectiveSystem, type MissionDistrict } from './gameplay/ObjectiveSystem';
import { STORY_CHAPTERS, StoryCampaign } from './gameplay/StoryCampaign';
import { HeistSystem } from './gameplay/HeistSystem';
import { RooftopPartySystem } from './gameplay/RooftopPartySystem';
import { VigilanteSystem } from './gameplay/VigilanteSystem';
import { SpecialVehicleMissionSystem, PARAMEDIC_MAX_HP_RESCUES_REQUIRED } from './gameplay/SpecialVehicleMissions';
import { KittAiSystem } from './gameplay/KittAiSystem';
import { LowriderBattleSystem, LOWRIDER_DIR_SYMBOL } from './gameplay/LowriderBattleSystem';
import { ShopSystem } from './gameplay/ShopSystem';
import { PayNSpray } from './gameplay/PayNSpray';
import { Minimap } from './hud/Minimap';
import { AudioEngine } from './audio/AudioEngine';
import { GamepadInput } from './engine/GamepadInput';
import { TouchControls } from './engine/TouchControls';
import type { AABB } from './types';
import {
  clearProgress,
  createProfile,
  deleteProfile,
  getActiveProfile,
  listProfiles,
  loadProgress,
  loadSettings,
  renameProfile,
  saveProgress,
  saveSettings,
  setActiveProfile,
  type GameSettings,
} from './engine/Storage';

const EMPTY_AABBS: AABB[] = [];

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const gpStatusEl = document.getElementById('gamepad-status');

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
const storyDialogueBannerEl = document.getElementById('story-dialogue-banner') as HTMLDivElement;
const storySpeakerEl = document.getElementById('story-speaker') as HTMLSpanElement;
const storyLineEl = document.getElementById('story-line') as HTMLSpanElement;
const lowriderHudEl = document.getElementById('lowrider-hud') as HTMLDivElement;
const lowriderScoreEl = document.getElementById('lowrider-score') as HTMLSpanElement;
const lowriderNotesEl = document.getElementById('lowrider-notes') as HTMLDivElement;
const lowriderFeedbackEl = document.getElementById('lowrider-feedback') as HTMLSpanElement;
const lowriderProgressEl = document.getElementById('lowrider-progress') as HTMLSpanElement;
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
const timeJumpFlashEl = document.getElementById('timejump-flash') as HTMLDivElement;
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

// Developer Panel Modal
const devOverlayEl = document.getElementById('dev-overlay') as HTMLDivElement;
const devCashEl = document.getElementById('dev-cash') as HTMLSpanElement;
const devStarsEl = document.getElementById('dev-stars') as HTMLSpanElement;
const devStarBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.dev-star-btn'));
const devClearCrimeBtn = document.getElementById('dev-clear-crime') as HTMLButtonElement;
const devCashMinusBtn = document.getElementById('dev-cash-minus') as HTMLButtonElement;
const devCash500Btn = document.getElementById('dev-cash-500') as HTMLButtonElement;
const devCash2500Btn = document.getElementById('dev-cash-2500') as HTMLButtonElement;
const devCash10kBtn = document.getElementById('dev-cash-10k') as HTMLButtonElement;
const devCashZeroBtn = document.getElementById('dev-cash-zero') as HTMLButtonElement;
const devCashInput = document.getElementById('dev-cash-input') as HTMLInputElement;
const devCashSetBtn = document.getElementById('dev-cash-set') as HTMLButtonElement;
const devCloseBtn = document.getElementById('dev-close') as HTMLButtonElement;

// 80s Missions-Telefon / Auftragsboard Modal ([J])
const phoneOverlayEl = document.getElementById('phone-overlay') as HTMLDivElement;
const phoneCashEl = document.getElementById('phone-cash') as HTMLDivElement;
const phoneDoneEl = document.getElementById('phone-done') as HTMLDivElement;
const phoneActiveLabelEl = document.getElementById('phone-active-label') as HTMLSpanElement;
const phoneCancelBtn = document.getElementById('phone-cancel-btn') as HTMLButtonElement;
const phoneHeistBtn = document.getElementById('phone-heist-btn') as HTMLButtonElement;
const phonePartyBtn = document.getElementById('phone-party-btn') as HTMLButtonElement;
const phoneTabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.phone-tab'));
const phoneMissionListEl = document.getElementById('phone-mission-list') as HTMLDivElement;
const phoneCloseBtn = document.getElementById('phone-close') as HTMLButtonElement;

// Pause Settings, Multi-Player Profiles & Saved Stats UI
const profileSelectEl = document.getElementById('profile-select') as HTMLSelectElement;
const profileNewBtn = document.getElementById('profile-new-btn') as HTMLButtonElement;
const profileRenameBtn = document.getElementById('profile-rename-btn') as HTMLButtonElement;
const profileDeleteBtn = document.getElementById('profile-delete-btn') as HTMLButtonElement;
const profileFormEl = document.getElementById('profile-form') as HTMLDivElement;
const profileNameInput = document.getElementById('profile-name-input') as HTMLInputElement;
const profileSaveBtn = document.getElementById('profile-save-btn') as HTMLButtonElement;
const profileCancelBtn = document.getElementById('profile-cancel-btn') as HTMLButtonElement;
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
let devOpen = false;
let phoneOpen = false;
let phoneDistrictFilter: 'story' | 'all' | MissionDistrict = 'story';
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
const opacityCache = new WeakMap<HTMLElement, string>();
function setOpacity(el: HTMLElement, op: string): void {
  if (opacityCache.get(el) !== op) {
    opacityCache.set(el, op);
    el.style.opacity = op;
  }
}
const displayCache = new WeakMap<HTMLElement, string>();
function setDisplay(el: HTMLElement, disp: string): void {
  if (displayCache.get(el) !== disp) {
    displayCache.set(el, disp);
    el.style.display = disp;
  }
}
const classCache = new WeakMap<Element, Map<string, boolean>>();
function setClass(el: Element, cls: string, enabled: boolean): void {
  let map = classCache.get(el);
  if (!map) {
    map = new Map<string, boolean>();
    classCache.set(el, map);
  }
  if (map.get(cls) !== enabled) {
    map.set(cls, enabled);
    el.classList.toggle(cls, enabled);
  }
}
const STAR_STRINGS = ['☆☆☆☆☆', '★☆☆☆☆', '★★☆☆☆', '★★★☆☆', '★★★★☆', '★★★★★'];
let cachedCashValue = -1;
let cachedCashText = '$0';
function formatHudCash(cash: number): string {
  if (cash !== cachedCashValue) {
    cachedCashValue = cash;
    cachedCashText = `$${cash.toLocaleString('en-US')}`;
  }
  return cachedCashText;
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
  }
  lookedFood = null;
  return true;
}

function refreshProfileSelector(): void {
  const profiles = listProfiles();
  const active = getActiveProfile();
  profileSelectEl.innerHTML = '';
  for (const p of profiles) {
    const opt = document.createElement('option');
    opt.value = p.id;
    const ch = p.progress.storyChapter ?? 0;
    opt.textContent = `${p.name} · $${p.progress.cash.toLocaleString('en-US')} · Kap. ${ch}/5`;
    opt.selected = p.id === active.id;
    profileSelectEl.appendChild(opt);
  }
  profileDeleteBtn.disabled = profiles.length <= 1;
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
  slotEls[4].classList.toggle('locked', !prog.launcherUnlocked);

  applySettings(nextSettings);
  persistProgress();
  refreshProfileSelector();
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
  statCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  statMissionsEl.textContent = String(objectives.completedCount);
  refreshProfileSelector();
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

applyActiveProfileToWorld(false);

// Multi-Player Profile Controls
let profileFormMode: 'new' | 'rename' | null = null;
function openProfileForm(mode: 'new' | 'rename'): void {
  profileFormMode = mode;
  profileFormEl.classList.add('visible');
  profileNameInput.value = mode === 'rename' ? getActiveProfile().name : '';
  profileNameInput.placeholder = mode === 'rename' ? 'Neuer Name…' : `Spieler ${listProfiles().length + 1}`;
  profileNameInput.focus();
  profileNameInput.select();
}

function closeProfileForm(): void {
  profileFormMode = null;
  profileFormEl.classList.remove('visible');
}

function submitProfileForm(): void {
  if (!profileFormMode) return;
  const rawName = profileNameInput.value;
  if (profileFormMode === 'new') {
    createProfile(rawName);
    closeProfileForm();
    applyActiveProfileToWorld(true);
  } else {
    const active = getActiveProfile();
    renameProfile(active.id, rawName);
    closeProfileForm();
    refreshProfileSelector();
    showQuickToast(`SPIELER UMBENANNT · ${getActiveProfile().name.toUpperCase()}`);
  }
}

profileSelectEl.addEventListener('change', () => {
  closeProfileForm();
  if (setActiveProfile(profileSelectEl.value)) {
    applyActiveProfileToWorld(true);
  }
});
profileNewBtn.addEventListener('click', () => openProfileForm('new'));
profileRenameBtn.addEventListener('click', () => openProfileForm('rename'));
profileCancelBtn.addEventListener('click', () => closeProfileForm());
profileSaveBtn.addEventListener('click', () => submitProfileForm());
profileNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitProfileForm();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeProfileForm();
  }
});
profileDeleteBtn.addEventListener('click', () => {
  if (listProfiles().length <= 1) return;
  const active = getActiveProfile();
  if (deleteProfile(active.id)) {
    closeProfileForm();
    applyActiveProfileToWorld(true);
    showQuickToast(`PROFIL „${active.name.toUpperCase()}“ GELÖSCHT`);
  }
});

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
  applyActiveProfileToWorld(true);
  showQuickToast(`SPEICHERSTAND VON „${getActiveProfile().name.toUpperCase()}“ ZURÜCKGESETZT`);
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
  buyMedkitBtn.disabled = objectives.cash < 250 || playerHp >= playerMaxHp;
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
  if (objectives.cash < 250 || playerHp >= playerMaxHp) return;
  objectives.cash -= 250;
  playerHp = Math.min(playerMaxHp, playerHp + 50);
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

// Developer Panel Flow ([Alt+D] / [F2] / [D] im Pause-Menü)
function refreshDevUi(): void {
  devCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  devStarsEl.textContent = `${wanted.stars}★`;
  devStarBtns.forEach((btn) => {
    const s = parseInt(btn.dataset.stars ?? '0', 10);
    btn.classList.toggle('active', s === wanted.stars);
  });
}

function openDevPanel(): void {
  devOpen = true;
  player.setActive(false);
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  refreshDevUi();
  devOverlayEl.classList.add('visible');
}

function closeDevPanel(): void {
  devOpen = false;
  devOverlayEl.classList.remove('visible');
  overlay.classList.add('hidden');
  player.setActive(true);
  requestLockSafely();
}

function setDevCash(nextCash: number): void {
  objectives.cash = Math.max(0, Math.floor(nextCash));
  persistProgress();
  refreshDevUi();
  audio.playPurchase();
}

devStarBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetStars = parseInt(btn.dataset.stars ?? '0', 10);
    wanted.setStars(targetStars);
    lastWantedStars = targetStars;
    if (targetStars === 0) {
      npcs.clearPolice();
      heli.clear();
    }
    refreshDevUi();
    audio.playPurchase();
    showQuickToast(`DEV · FAHNDUNGSLEVEL AUF ${targetStars}★ GESETZT`);
  });
});

devClearCrimeBtn.addEventListener('click', () => {
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
  refreshDevUi();
  audio.playPurchase();
  showQuickToast('DEV · POLIZEI-AKTE & FAHNDUNG KOMPLETT AUF 0 ZURÜCKGESETZT');
  sendPoliceDispatch('Akten komplett gelöscht — alle Einheiten & Sperren abziehen.', true);
});

devCashMinusBtn.addEventListener('click', () => setDevCash(objectives.cash - 1000));
devCash500Btn.addEventListener('click', () => setDevCash(objectives.cash + 500));
devCash2500Btn.addEventListener('click', () => setDevCash(objectives.cash + 2500));
devCash10kBtn.addEventListener('click', () => setDevCash(objectives.cash + 10000));
devCashZeroBtn.addEventListener('click', () => setDevCash(0));
devCashSetBtn.addEventListener('click', () => {
  const val = parseInt(devCashInput.value, 10);
  if (!Number.isNaN(val)) {
    setDevCash(val);
    showQuickToast(`DEV · GELD AUF $${Math.max(0, Math.floor(val)).toLocaleString('en-US')} GESETZT`);
  }
});
devCloseBtn.addEventListener('click', () => closeDevPanel());

// 80s Missions-Telefon / Auftragsboard Flow ([J])
function renderPhoneMissions(): void {
  phoneCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
  const doneCount = objectives.getCompletedIds().length;
  phoneDoneEl.textContent = `STORY ${story.getCompletedChapters()}/${STORY_CHAPTERS.length} · JOBS ${doneCount}/${MISSION_CONTRACTS.length}`;

  const active = objectives.current;
  const activeStoryIdx = story.getActiveChapterIndex();
  if (activeStoryIdx >= 0) {
    const ch = STORY_CHAPTERS[activeStoryIdx];
    phoneActiveLabelEl.textContent = `AKTIV: ★ KAPITEL ${ch.number} · ${ch.title}`;
    phoneCancelBtn.disabled = false;
  } else {
    phoneActiveLabelEl.textContent = active ? `AKTIV: ${active.title}` : 'AKTIV: KEIN AUFTRAG';
    phoneCancelBtn.disabled = !active;
  }

  phoneHeistBtn.disabled = heist.isActive();
  phoneHeistBtn.textContent = heist.isActive() ? 'LÄUFT…' : 'STARTEN [H]';

  const hasBar = world.isSafehouseRooftopBarOwned();
  phonePartyBtn.disabled = !hasBar;
  phonePartyBtn.textContent = !hasBar
    ? 'BAR NÖTIG ($1.800)'
    : rooftopParty.isActive()
      ? 'PARTY BEENDEN'
      : 'PARTY STARTEN';

  phoneTabBtns.forEach((btn) => {
    btn.classList.toggle('active', (btn.dataset.district ?? 'story') === phoneDistrictFilter);
  });

  phoneMissionListEl.innerHTML = '';

  if (phoneDistrictFilter === 'story') {
    const completedCh = story.getCompletedChapters();
    const header = document.createElement('div');
    header.className = 'story-progress-header';
    header.innerHTML = `<span>★ OPERATION NEON DUSK</span><span>${completedCh} / ${STORY_CHAPTERS.length} KAPITEL</span>`;
    phoneMissionListEl.appendChild(header);

    for (const ch of STORY_CHAPTERS) {
      const isActive = activeStoryIdx === ch.index;
      const isDone = ch.index < completedCh;
      const isUnlocked = story.canStartChapter(ch.index);

      const card = document.createElement('div');
      card.className = `mission-item${isActive ? ' is-active' : ''}${!isUnlocked ? ' story-locked' : ''}`;

      const left = document.createElement('div');
      const meta = document.createElement('div');
      meta.className = 'mission-meta';

      const chPill = document.createElement('span');
      chPill.className = 'mission-pill east';
      chPill.textContent = `KAPITEL ${ch.number}`;

      const distPill = document.createElement('span');
      distPill.className = 'mission-pill';
      distPill.textContent = ch.districtLabel;
      meta.append(chPill, distPill);

      if (isDone) {
        const doneBadge = document.createElement('span');
        doneBadge.className = 'mission-done-badge';
        doneBadge.textContent = '✓ ABGESCHLOSSEN';
        meta.appendChild(doneBadge);
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'mission-name';
      nameEl.textContent = ch.title;

      const descEl = document.createElement('div');
      descEl.className = 'mission-desc';
      descEl.textContent = ch.summary;

      left.append(meta, nameEl, descEl);

      const right = document.createElement('div');
      right.className = 'mission-right';

      const rewEl = document.createElement('div');
      rewEl.className = 'mission-reward';
      rewEl.textContent = ch.finaleBonus && !isDone
        ? `+$${(ch.reward + ch.finaleBonus).toLocaleString('en-US')}`
        : `+$${ch.reward.toLocaleString('en-US')}`;

      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.className = 'mission-accept-btn';
      acceptBtn.textContent = isActive
        ? 'AKTIV'
        : !isUnlocked
          ? '🔒 GESPERRT'
          : isDone
            ? 'WIEDERHOLEN'
            : 'STARTEN';
      acceptBtn.disabled = isActive || !isUnlocked;
      acceptBtn.addEventListener('click', () => {
        if (story.startChapter(ch.index, npcs, wanted)) {
          audio.playCheckpoint();
          closePhone();
        }
      });

      right.append(rewEl, acceptBtn);
      card.append(left, right);
      phoneMissionListEl.appendChild(card);
    }
    return;
  }

  const filtered =
    phoneDistrictFilter === 'all'
      ? MISSION_CONTRACTS
      : MISSION_CONTRACTS.filter((c) => c.district === phoneDistrictFilter);

  for (const c of filtered) {
    const isActive = active?.id === c.id;
    const isDone = objectives.isContractCompleted(c.id);

    const card = document.createElement('div');
    card.className = `mission-item${isActive ? ' is-active' : ''}`;

    const left = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'mission-meta';

    const distPill = document.createElement('span');
    distPill.className = `mission-pill ${c.district}`;
    distPill.textContent = c.districtLabel;

    const kindPill = document.createElement('span');
    kindPill.className = 'mission-pill';
    kindPill.textContent = c.kindLabel;
    meta.append(distPill, kindPill);

    if (isDone) {
      const doneBadge = document.createElement('span');
      doneBadge.className = 'mission-done-badge';
      doneBadge.textContent = '✓ ERLEDIGT';
      meta.appendChild(doneBadge);
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'mission-name';
    nameEl.textContent = c.title;

    const descEl = document.createElement('div');
    descEl.className = 'mission-desc';
    descEl.textContent = c.briefing;

    left.append(meta, nameEl, descEl);

    const right = document.createElement('div');
    right.className = 'mission-right';

    const rewEl = document.createElement('div');
    rewEl.className = 'mission-reward';
    rewEl.textContent = `+$${c.reward.toLocaleString('en-US')}`;

    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'mission-accept-btn';
    acceptBtn.textContent = isActive ? 'AKTIV' : 'ANNEHMEN';
    acceptBtn.disabled = isActive;
    acceptBtn.addEventListener('click', () => {
      objectives.startContract(c.id, npcs, wanted);
      audio.playCheckpoint();
      closePhone();
      showQuickToast(`AUFTRAG ANGENOMMEN · ${c.title} (+$${c.reward.toLocaleString('en-US')})`);
    });

    right.append(rewEl, acceptBtn);
    card.append(left, right);
    phoneMissionListEl.appendChild(card);
  }
}

function openPhone(): void {
  phoneOpen = true;
  player.setActive(false);
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  renderPhoneMissions();
  phoneOverlayEl.classList.add('visible');
}

function closePhone(): void {
  phoneOpen = false;
  phoneOverlayEl.classList.remove('visible');
  overlay.classList.add('hidden');
  player.setActive(true);
  requestLockSafely();
}

phoneTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    phoneDistrictFilter = (btn.dataset.district ?? 'story') as 'story' | 'all' | MissionDistrict;
    renderPhoneMissions();
  });
});

phoneCancelBtn.addEventListener('click', () => {
  if (story.isActive()) {
    story.cancelChapter(npcs);
    showQuickToast('STORY-KAPITEL ABGEBROCHEN · [J] FÜR NEUSTART');
  } else {
    objectives.cancelActiveObjective(npcs);
    showQuickToast('AUFTRAG ABGEBROCHEN · [J] FÜR NEUE JOBS');
  }
  renderPhoneMissions();
});

phoneHeistBtn.addEventListener('click', () => {
  if (!heist.isActive()) {
    heist.startHeist();
    audio.playCheckpoint();
    closePhone();
  }
});

phonePartyBtn.addEventListener('click', () => {
  if (!world.isSafehouseRooftopBarOwned()) return;
  const started = rooftopParty.toggle();
  audio.playCheckpoint();
  if (!started) {
    showQuickToast('ROOFTOP-PARTY BEENDET · BIS ZUM NÄCHSTEN MAL!');
  }
  closePhone();
});

phoneCloseBtn.addEventListener('click', () => closePhone());

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
    !shopOpen &&
    !petShopOpen &&
    !devOpen &&
    !phoneOpen &&
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
    (e.code === 'KeyD' && pauseOverlayVisible && !shopOpen && !petShopOpen)
  ) {
    e.preventDefault();
    if (devOpen) closeDevPanel();
    else if (!shopOpen && !petShopOpen) openDevPanel();
    return;
  }
  if (devOpen) {
    if (e.code === 'Escape') closeDevPanel();
    return;
  }

  if (e.code === 'KeyJ' && !shopOpen && !petShopOpen && !photoMode && wastedTimer <= 0) {
    if (phoneOpen) {
      closePhone();
    } else if (player.getIsActive()) {
      openPhone();
    }
    return;
  }
  if (phoneOpen) {
    if (e.code === 'Escape') closePhone();
    return;
  }

  if (e.code === 'KeyP' && (player.getIsActive() || photoMode) && !shopOpen) {
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
  if (lowriderBattle.isActive() && player.getIsActive() && !shopOpen && !petShopOpen) {
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

  if (e.code === 'KeyX' && player.getIsActive() && !shopOpen && !petShopOpen && wastedTimer <= 0) {
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

  if (e.code === 'KeyQ' && player.getIsActive() && !shopOpen) {
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
    if (car && world.isCarInTuningBay(car.position)) {
      if (car.isBike) {
        showQuickToast('VICE CUSTOMS · LOWRIDER-HYDRAULIK NUR FÜR AUTOS!');
      } else if (car.hydraulics) {
        vehicles.triggerHydraulicHop(car, 'up');
        audio.playHydraulicBounce(true);
        showQuickToast('VICE CUSTOMS · LOWRIDER-HYDRAULIK BEREITS INSTALLIERT!');
      } else {
        const hydroCost = 500;
        if (objectives.cash >= hydroCost) {
          objectives.cash -= hydroCost;
          vehicles.installHydraulics(car);
          audio.playPurchase();
          audio.playHydraulicBounce(true);
          persistProgress();
          showQuickToast(
            'VICE CUSTOMS · LOWRIDER-HYDRAULIK EINGEBAUT (-$500) · HÜPFT IM RADIO-TAKT & LITTLE HAVANA BATTLE!',
          );
        } else {
          showQuickToast(`VICE CUSTOMS · HYDRAULIK KOSTET $${hydroCost}`);
        }
      }
      return;
    }
    if (car && car.isKitt) {
      if (!vehicles.triggerKittTurboBoost(car)) {
        showQuickToast(
          car.turboBoostCooldown > 0
            ? `K.I.T.T. TURBO-BOOST LÄDT… (${car.turboBoostCooldown.toFixed(1)}s)`
            : 'K.I.T.T. TURBO-BOOST · NUR AUF FESTEM BODEN!',
        );
      }
      return;
    }
    if (car && car.isDelorean) {
      if (!vehicles.triggerDeloreanTimeJump(car)) {
        if (car.timeJumpCooldown && car.timeJumpCooldown > 0) {
          showQuickToast(`FLUXKOMPENSATOR LÄDT… (${Math.ceil(car.timeJumpCooldown)}s)`);
        } else {
          showQuickToast('DELOREAN · ERST AUF 88 MPH (HÖCHSTGESCHWINDIGKEIT) BESCHLEUNIGEN!');
        }
      }
      return;
    }
    if (car && car.specialRole === 'icecream') {
      car.jingleActive = !car.jingleActive;
      if (car.jingleActive) {
        const nearPd = Math.hypot(car.position.x - -40, car.position.z) < 38;
        showQuickToast(
          nearPd
            ? "CHERRY POPPER '86 · JINGLE AN! VICE PD COPS RENNEN FÜR DONUTS RAUS!"
            : "CHERRY POPPER '86 · 8-BIT JINGLE AN! PASSANTEN & COPS KOMMEN ANGELAUFEN!",
        );
        if (nearPd) {
          sendPoliceDispatch('Alle Einheiten am Precinct 06: Gratis-Donuts vor der Tür! Verfolgung kurzzeitig unterbrochen!', true);
        }
      } else {
        showQuickToast("CHERRY POPPER '86 · JINGLE AUS");
      }
      return;
    }
    if (!car && world.isSafehouseRooftopBarOwned() && rooftopParty.isPlayerOnSafehouseRoof(player.position)) {
      const started = rooftopParty.toggle();
      audio.playCheckpoint();
      if (!started) {
        showQuickToast('ROOFTOP-PARTY BEENDET · BIS ZUM NÄCHSTEN MAL!');
      }
      return;
    }
    if (vigilante.isActive()) {
      vigilante.stop(npcs);
      showQuickToast('VIGILANTE-MODUS BEENDET');
    } else if (specialMissions.isActive()) {
      const k = specialMissions.getActiveKind();
      specialMissions.stop();
      showQuickToast(
        k === 'taxi'
          ? 'TAXI-MODUS BEENDET'
          : k === 'firefighter'
            ? 'FEUERWEHR-EINSATZ BEENDET'
            : 'RETTUNGSDIENST BEENDET',
      );
    } else if (car && car.isPolice) {
      vigilante.start(player.position, npcs);
      audio.playCheckpoint();
      sendPoliceDispatch('Vigilante-Modus aktiv! Erster Verdächtiger auf dem Radar markiert.', true);
      showQuickToast('VIGILANTE · STUFE 1 GESTARTET');
    } else if (car && car.specialRole === 'taxi') {
      specialMissions.start('taxi', player.position);
      audio.playCheckpoint();
      showQuickToast('VICE CAB · TAXI-MODUS AKTIV · FAHRGAST AUF RADAR MARKIERT!');
    } else if (car && car.specialRole === 'firetruck') {
      specialMissions.start('firefighter', player.position);
      audio.playCheckpoint();
      sendPoliceDispatch('Feuerwehr-Zentrale: Brennendes Autowrack gemeldet — Wasserwerfer [LMB] bereit!', true);
      showQuickToast('FEUERWEHR-EINSATZ · STUFE 1 · [LMB] WASSERWERFER!');
    } else if (car && car.specialRole === 'ambulance') {
      specialMissions.start('paramedic', player.position);
      const prog = specialMissions.getParamedicProgress();
      audio.playCheckpoint();
      sendPoliceDispatch('Vice EMS Notruf: Verletzte Person auf dem Radar markiert!', true);
      showQuickToast(
        prog.maxHpUnlocked
          ? 'RETTUNGSDIENST AKTIV · 150 MAX-HP BEREITS FREIGESCHALTET!'
          : `RETTUNGSDIENST AKTIV · ${prog.rescues}/${PARAMEDIC_MAX_HP_RESCUES_REQUIRED} RETTUNGEN FÜR 150 MAX-HP!`,
      );
    } else if (car && car.hydraulics) {
      car.hydraulicsAutoBounce = !car.hydraulicsAutoBounce;
      vehicles.triggerHydraulicHop(car, 'up');
      audio.playHydraulicBounce(true);
      showQuickToast(
        car.hydraulicsAutoBounce
          ? 'LOWRIDER-HYDRAULIK · RADIO-BEAT-BOUNCE AN!'
          : 'LOWRIDER-HYDRAULIK · RADIO-BEAT-BOUNCE AUS',
      );
    } else {
      showQuickToast('EINSATZ [G] · NUR IN K.I.T.T., EISWAGEN, HYDRAULIK, VICE PD, TAXI, EMS ODER FEUERWEHR');
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
      } else if (world.isCarInLowriderArena(car.position)) {
        if (lowriderBattle.isActive()) {
          lowriderBattle.cancel();
          showQuickToast('LOWRIDER-BATTLE ABGEBROCHEN');
        } else if (car.hydraulics) {
          lowriderBattle.start();
          vehicles.triggerHydraulicHop(car, 'up');
          audio.playHydraulicBounce(true);
          showQuickToast('LITTLE HAVANA LOWRIDER BATTLE · [W A S D / SPACE] IM TAKT HÜPFEN!');
        } else {
          showQuickToast('LOWRIDER-HYDRAULIK NÖTIG · ERST BEI VICE CUSTOMS EINBAUEN ([G] · $500)');
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
    } else if (rooftopParty.isNearTributeCash(player.position)) {
      const bonus = rooftopParty.claimTributeCash();
      if (bonus > 0) {
        objectives.cash += bonus;
        audio.playMissionPassed();
        persistProgress();
        showQuickToast(`CREW-UMSCHLAG EINGESAMMELT · +$${bonus}`);
      }
    } else if (world.isNearSafehouseRooftopBar(player.position)) {
      if (!world.isSafehouseRooftopBarOwned()) {
        const barCost = 1800;
        if (objectives.cash >= barCost) {
          objectives.cash -= barCost;
          world.setSafehouseRooftopBarOwned(true);
          audio.playMissionPassed();
          persistProgress();
          showQuickToast('PENTHOUSE DACH-COCKTAILBAR GEKAUFT! (-$1.800) · [G] FÜR POOLPARTY!');
        } else {
          showQuickToast(`DACH-COCKTAILBAR · ZU WENIG CASH (BENÖTIGT $${barCost})`);
        }
      } else {
        const prevHp = playerHp;
        playerHp = Math.min(playerMaxHp, playerHp + 30);
        const gained = Math.round(playerHp - prevHp);
        cocktailScore = Math.min(6.0, cocktailScore + 1.25);
        const rawLevel = THREE.MathUtils.clamp((cocktailScore - 1.0) / 3.8, 0, 1);
        audio.playPurchase();
        const hpNote = gained > 0 ? ` · +${gained} HP` : '';
        const buzz =
          rawLevel < 0.32 ? 'LEICHT ANGESCHWIPST 🍹' : rawLevel < 0.7 ? 'BETRUNKEN! 🍹' : 'VOLLRAUSCH! 🍹';
        if (rooftopParty.isActive()) {
          playerArmor = Math.min(100, playerArmor + 35);
          weapons.refillAllAmmo();
          persistProgress();
          showQuickToast(`PARTY-COCKTAIL${hpNote} · +35% ARMOR & MUNI VOLL · ${buzz}`);
        } else {
          showQuickToast(`DACH-BAR · MIAMI VICE COCKTAIL${hpNote} · ${buzz}`);
        }
      }
    } else if (rooftopParty.getNearbyGuest(player.position)) {
      const quip = rooftopParty.talkToNearbyGuest(player.position, pets.ownsPet('elvis'));
      if (quip) {
        audio.playCheckpoint();
        showQuickToast(quip);
      }
    } else if (world.isNearSafehouseFridge(player.position)) {
      const prevHp = playerHp;
      playerHp = Math.min(playerMaxHp, playerHp + 25);
      const gained = Math.round(playerHp - prevHp);
      audio.playEatCrunch();
      showQuickToast(gained > 0 ? `KÜHLSCHRANK-SNACK · +${gained} HP` : 'KÜHLSCHRANK-SNACK · LECKER!');
    } else if (world.isNearSafehouseLounge(player.position)) {
      playerHp = playerMaxHp;
      weapons.refillAllAmmo();
      if (wanted.stars <= 2) {
        wanted.reset();
        npcs.clearPolice();
      }
      audio.playPurchase();
      persistProgress();
      showQuickToast(`SAFEHOUSE · ${playerMaxHp} HP, MUNITION VOLL & GESPEICHERT`);
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
        playerHp = playerMaxHp;
        audio.playEatCrunch();
        persistProgress();
        showQuickToast(`STARLIGHT DINER · CUBAN BURGER & SHAKE (${playerMaxHp} HP · -$40)`);
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
      playerHp = playerMaxHp;
      if (firstDiscovery) {
        objectives.cash += 1000;
        audio.playMissionPassed();
        persistProgress();
        showQuickToast(`CAPE VICE LEUCHTTURM ENTDECKT! · +$1.000 & ${playerMaxHp} HP`);
      } else {
        audio.playPurchase();
        showQuickToast(`CAPE VICE AUSSICHT · FRISCHE MEERESLUFT (${playerMaxHp} HP)`);
      }
    } else if (world.isNearClubBar(player.position)) {
      if (objectives.cash >= 50) {
        objectives.cash -= 50;
        const prevHp = playerHp;
        playerHp = Math.min(playerMaxHp, playerHp + 30);
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
  if (shopOpen || petShopOpen || devOpen || phoneOpen) return;
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
  if (player.getIsActive() && !player.getIsLocked() && !shopOpen && !petShopOpen && !devOpen && !phoneOpen) {
    requestLockSafely();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    pointerLockFallback = false;
    overlay.classList.add('hidden');
    player.setActive(true);
  } else if (!pointerLockFallback && !shopOpen && !petShopOpen && !devOpen && !phoneOpen) {
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
      if (shopOpen) closeShop();
      else if (petShopOpen) closePetShop();
      else if (phoneOpen) closePhone();
      else if (devOpen) closeDevPanel();
      else if (player.getIsActive()) pauseGame();
      else startGame(true);
    } else if (pad.bPressed && (shopOpen || petShopOpen || phoneOpen || devOpen)) {
      if (shopOpen) closeShop();
      else if (petShopOpen) closePetShop();
      else if (phoneOpen) closePhone();
      else if (devOpen) closeDevPanel();
    } else if (pad.aPressed && !player.getIsActive() && !shopOpen && !petShopOpen && !phoneOpen && !devOpen) {
      startGame(true);
    }
  }

  const isPlaying = player.getIsActive() && !shopOpen && !petShopOpen && !devOpen && !phoneOpen && wastedTimer <= 0;

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
      openPhone();
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
        nearPrecinct: Math.hypot(activeCarNow.position.x - -40, activeCarNow.position.z) < 38,
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
  if (storyHud.dialogueSpeaker && storyHud.dialogueText) {
    setText(storySpeakerEl, storyHud.dialogueSpeaker);
    setText(storyLineEl, storyHud.dialogueText);
    setClass(storyDialogueBannerEl, 'visible', true);
  } else if (kittHud.speaker && kittHud.text) {
    setText(storySpeakerEl, kittHud.speaker);
    setText(storyLineEl, kittHud.text);
    setClass(storyDialogueBannerEl, 'visible', true);
  } else {
    setClass(storyDialogueBannerEl, 'visible', false);
  }

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
  setClass(lowriderHudEl, 'visible', lowriderHud.active);
  if (lowriderHud.active) {
    setText(lowriderScoreEl, `${lowriderHud.score} PKT`);
    setText(lowriderProgressEl, `${lowriderHud.progressPct}%`);
    setText(
      lowriderFeedbackEl,
      lowriderHud.feedback || 'IM TAKT HÜPFEN · [W A S D] / [SPACE] · [ESC] ABBRUCH',
    );
    setClass(lowriderFeedbackEl, 'perfect', lowriderHud.feedbackKind === 'perfect');
    setClass(lowriderFeedbackEl, 'good', lowriderHud.feedbackKind === 'good');
    setClass(lowriderFeedbackEl, 'miss', lowriderHud.feedbackKind === 'miss');

    lowriderNotesEl.innerHTML = '';
    for (let i = 0; i < lowriderHud.notes.length; i++) {
      const n = lowriderHud.notes[i];
      const leftPct = 16 + (n.offsetSec / 1.8) * 82;
      const el = document.createElement('div');
      el.className = n.dir === 'hop' ? 'lowrider-note hop' : 'lowrider-note';
      el.style.left = `${leftPct.toFixed(1)}%`;
      el.textContent = LOWRIDER_DIR_SYMBOL[n.dir];
      lowriderNotesEl.appendChild(el);
    }
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

  audio.update(
    dt,
    elapsed,
    isPlaying,
    inAnyCraft,
    inBoat
      ? boatHud.speedKmh
      : inYacht
        ? yachtHud.speedKmh
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
    Math.max(world.getClubProximity(player.position), rooftopParty.getMusicProximity(player.position)),
    inGarageRide && garageRideHud.rideId ? garageRideHud.rideId : 'motor',
    specialHud.kind === 'firefighter' || specialHud.kind === 'paramedic',
    iceCreamJingleOn,
  );

  shootableHitboxes.length = 0;
  npcs.appendShootableHitboxes(shootableHitboxes);
  vehicles.appendShootableHitboxes(shootableHitboxes);
  destructibles.appendShootableHitboxes(shootableHitboxes);
  heli.appendShootableHitboxes(shootableHitboxes);

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

  // --- HUD Updates (Dirty-checked DOM mutations) ---
  damageFlash = Math.max(0, damageFlash - dt * 2.2);
  setOpacity(damageVignetteEl, damageFlash > 0.004 ? damageFlash.toFixed(2) : '0');
  if (timeJumpFlash > 0) {
    timeJumpFlash = Math.max(0, timeJumpFlash - dt * 1.45);
    setOpacity(timeJumpFlashEl, timeJumpFlash > 0.004 ? (timeJumpFlash * 0.92).toFixed(2) : '0');
  } else {
    setOpacity(timeJumpFlashEl, '0');
  }
  if (retrowaveTimer > 0) {
    retrowaveTimer = Math.max(0, retrowaveTimer - dt);
    if (retrowaveTimer <= 0) {
      world.setRetrowaveMode(false);
      document.body.classList.remove('retrowave-mode');
      showQuickToast('ZEITSPRUNG BEENDET · ZURÜCK IN PALM CITY ’86');
    }
  }
  const hpPct = Math.min(100, Math.round((playerHp / playerMaxHp) * 100));
  setWidth(hpFillEl, `${hpPct}%`);
  setText(hpTextEl, playerMaxHp > 100 ? `${Math.round(playerHp)}/${playerMaxHp}` : `${Math.round(playerHp)}`);

  const armorPct = Math.round(playerArmor);
  setWidth(armorFillEl, `${armorPct}%`);
  setText(armorTextEl, `${armorPct}`);

  setText(starsEl, STAR_STRINGS[wanted.stars] ?? STAR_STRINGS[0]);
  setClass(starsEl, 'cooling', wanted.isCoolingDown());
  setClass(starsEl, 'active', wanted.stars > 0);
  setText(cashEl, formatHudCash(objHud.cash));

  if (storyHud.active) {
    setText(objTagEl, `★ STORY · KAP. ${storyHud.chapterNumber}/5`);
    setClass(objTagEl, 'heist', true);
    setText(objTitleEl, storyHud.title);
    setText(objDescEl, storyHud.description);
    setText(objDistEl, `${storyHud.distanceM} m`);
  } else if (vigilanteHud.active) {
    setText(objTagEl, '★ VIGILANTE');
    setClass(objTagEl, 'heist', true);
    setText(objTitleEl, vigilanteHud.title);
    setText(objDescEl, vigilanteHud.description);
    setText(objDistEl, `${vigilanteHud.timerText} · ${vigilanteHud.distanceM} m`);
  } else if (specialHud.active) {
    setText(objTagEl, specialHud.tag);
    setClass(objTagEl, 'heist', true);
    setText(objTitleEl, specialHud.title);
    setText(objDescEl, specialHud.description);
    setText(objDistEl, `${specialHud.timerText} · ${specialHud.distanceM} m`);
  } else if (heistHud.active) {
    setText(objTagEl, '★ HEIST');
    setClass(objTagEl, 'heist', true);
    setText(objTitleEl, heistHud.title);
    setText(objDescEl, heistHud.description);
    setText(objDistEl, `${heistHud.distanceM} m`);
  } else {
    setText(objTagEl, 'ZIEL · [J] TELEFON · [H] HEIST');
    setClass(objTagEl, 'heist', false);
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
    setClass(toastBannerEl, 'visible', true);
  } else {
    setClass(toastBannerEl, 'visible', false);
  }

  setClass(weaponPanelEl, 'hidden', inAnyCraft);
  setDisplay(crosshairEl, inAnyCraft ? 'none' : 'block');
  setClass(vehiclePanelEl, 'visible', inAnyCraft);

  let nextPrompt: string | null = null;

  if (heliPlayerHud.inHeli) {
    setText(vehicleNameEl, `${heliPlayerHud.heliName} · ${heliPlayerHud.altitudeM}m`);
    setText(vehicleSpeedEl, `${heliPlayerHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    setClass(vehicleHpFillEl, 'low', false);
    setText(
      vehicleCamHintEl,
      `[SPACE/C] HÖHE · [Q] ${audio.getRadioStation()} · [V] CAM · [E] LANDEN`,
    );
  } else if (boatHud.inBoat) {
    setText(vehicleNameEl, boatHud.boatName);
    setText(vehicleSpeedEl, `${boatHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    setClass(vehicleHpFillEl, 'low', false);
    setText(vehicleCamHintEl, `[Q] ${audio.getRadioStation()} · [E] AUSSTEIGEN`);
  } else if (yachtHud.inYacht) {
    setText(vehicleNameEl, yachtHud.yachtName);
    setText(vehicleSpeedEl, `${yachtHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    setClass(vehicleHpFillEl, 'low', false);
    setText(vehicleCamHintEl, `[Q] ${audio.getRadioStation()} · [V] BRÜCKE/CHASE · [E] ANKERN`);
  } else if (garageRideHud.inRide) {
    setText(vehicleNameEl, garageRideHud.rideName);
    setText(vehicleSpeedEl, `${garageRideHud.speedKmh}`);
    setWidth(vehicleHpFillEl, '100%');
    setClass(vehicleHpFillEl, 'low', false);
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
    setClass(vehicleHpFillEl, 'low', driveHud.hpPct < 35);
    const car = vehicles.getActiveVehicle();
    if (car?.specialRole === 'firetruck') {
      const fireToggle = specialMissions.getActiveKind() === 'firefighter' ? 'EINSATZ AUS' : 'FEUERWEHR';
      setText(
        vehicleCamHintEl,
        `[LMB/C] WASSERWERFER · [MAUS/PFEILE] ZIELEN · [G] ${fireToggle} · [V] CAM · [E] AUS`,
      );
    } else if (car?.specialRole === 'taxi') {
      const taxiToggle = specialMissions.getActiveKind() === 'taxi' ? 'TAXI AUS' : 'TAXI-MODUS';
      setText(
        vehicleCamHintEl,
        `[LMB] DRIVE-BY · [G] ${taxiToggle} · [Q] ${audio.getRadioStation()} · [V] CAM · [E] AUS`,
      );
    } else if (car?.specialRole === 'ambulance') {
      const emsToggle = specialMissions.getActiveKind() === 'paramedic' ? 'EMS AUS' : 'RETTUNGSDIENST';
      setText(
        vehicleCamHintEl,
        `[LMB] DRIVE-BY · [G] ${emsToggle} · [Q] ${audio.getRadioStation()} · [V] CAM · [E] AUS`,
      );
    } else if (car?.specialRole === 'icecream') {
      const jingleLbl = car.jingleActive ? 'JINGLE AUS' : '8-BIT JINGLE AN';
      setText(
        vehicleCamHintEl,
        `[G] ${jingleLbl} (COPS ABLENKEN) · [V] CAM · [E] AUS`,
      );
    } else if (car?.isDelorean) {
      const warpLbl =
        retrowaveTimer > 0
          ? `⚡ RETROWAVE (${Math.ceil(retrowaveTimer)}s)`
          : car.timeJumpCooldown && car.timeJumpCooldown > 0
            ? `FLUX LÄDT (${Math.ceil(car.timeJumpCooldown)}s)`
            : car.timeJumpReady
              ? '[SHIFT/G] ⚡ 88 MPH ZEITSPRUNG BEREIT!'
              : 'AUF 88 MPH BESCHLEUNIGEN → [SHIFT/G]';
      setText(
        vehicleCamHintEl,
        `${warpLbl} · [Q] ${audio.getRadioStation()} · [V] CAM · [E] AUS`,
      );
    } else if (car?.isKitt) {
      const boostLbl =
        car.turboBoostCooldown > 0
          ? `TURBO-BOOST (${car.turboBoostCooldown.toFixed(1)}s)`
          : 'TURBO-BOOST BEREIT!';
      setText(
        vehicleCamHintEl,
        `[SHIFT/G] ${boostLbl} · [Q] ${audio.getRadioStation()} · [V] CAM · [E] AUS`,
      );
    } else {
      const vigHint = car?.isPolice
        ? ` · [G] ${vigilante.isActive() ? 'VIGILANTE AUS' : 'VIGILANTE'}`
        : car?.hydraulics
          ? ` · [G] HYDRAULIK ${car.hydraulicsAutoBounce ? 'AN' : 'AUS'}`
          : '';
      setText(vehicleCamHintEl, `[LMB] DRIVE-BY · [Q] ${audio.getRadioStation()}${vigHint} · [V] CAM · [E] AUS`);
    }
    if (car && world.isInSafehouseGarage(car.position)) {
      nextPrompt = '[F] PRIVATE GARAGE · GRATIS REPARATUR (100%)';
    } else if (car && world.isCarInTuningBay(car.position)) {
      const hydroPart = car.isBike
        ? ''
        : car.hydraulics
          ? ' · ✓ HYDRAULIK'
          : ' · [G] LOWRIDER-HYDRAULIK ($500)';
      nextPrompt = car.tuned
        ? `[F] VICE CUSTOMS · NEON-FINISH ($400)${hydroPart}`
        : `[F] VICE CUSTOMS · TURBO & NEON ($600)${hydroPart}`;
    } else if (car && world.isCarInLowriderArena(car.position) && !lowriderBattle.isActive()) {
      nextPrompt = car.hydraulics
        ? '[F] LITTLE HAVANA LOWRIDER BATTLE STARTEN (+$1.200)'
        : '[LITTLE HAVANA ARENA] ERST LOWRIDER-HYDRAULIK BEI VICE CUSTOMS EINBAUEN ([G] · $500)';
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
    setClass(reloadBarEl, 'visible', wHud.reloading);
    setWidth(reloadFillEl, `${Math.round(wHud.reloadProgress * 100)}%`);
    for (let i = 0; i < slotEls.length; i++) setClass(slotEls[i], 'active', i === wHud.slotIndex);

    const spreadStr = `${wHud.spreadPx}px`;
    if (widthCache.get(crosshairEl) !== spreadStr) {
      widthCache.set(crosshairEl, spreadStr);
      crosshairEl.style.width = spreadStr;
      crosshairEl.style.height = spreadStr;
    }
    setOpacity(crosshairEl, wHud.ads ? '0.45' : '0.88');

    setOpacity(hitmarkerEl, wHud.hitmarkerAlpha > 0.01 ? wHud.hitmarkerAlpha.toFixed(2) : '0');
    setClass(hitmarkerEl, 'kill', wHud.hitmarkerKill && wHud.hitmarkerAlpha > 0.05);

    if (lookedWallRide) {
      nextPrompt =
        lookedWallRide.action === 'detach'
          ? `[E / F / LMB] ${lookedWallRide.promptLabel}`
          : `[F / LMB] ${lookedWallRide.promptLabel}`;
    } else if (lookedPet) {
      nextPrompt = `[LMB / F] ${lookedPet.promptLabel}`;
    } else if (lookedFood) {
      nextPrompt =
        lookedFood.alcohol && lookedFood.alcohol > 0
          ? `[LMB / F] ${lookedFood.name} TRINKEN (+${lookedFood.heal} HP · 🍺)`
          : `[LMB / F] ${lookedFood.name} NEHMEN & ESSEN (+${lookedFood.heal} HP)`;
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
    } else if (partyHud.nearTributeCash) {
      nextPrompt = '[F] CREW-UMSCHLAG NEHMEN (+$400)';
    } else if (world.isNearSafehouseRooftopBar(player.position)) {
      nextPrompt = !world.isSafehouseRooftopBarOwned()
        ? '[F] PENTHOUSE DACH-COCKTAILBAR KAUFEN · $1.800'
        : partyHud.active
          ? '[F] PARTY-COCKTAIL (+HP/+ARMOR/MUNI) · [G] PARTY BEENDEN'
          : '[F] COCKTAIL MIXEN · [G] ROOFTOP-PARTY SCHMEISSEN';
    } else if (partyHud.nearbyGuestName) {
      nextPrompt = `[F] MIT ${partyHud.nearbyGuestName} ANSTOSSEN · [G] PARTY BEENDEN`;
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
      const climbHint = playerWaterClimbLabel
        ? playerWaterClimbLabel === 'BOOT'
          ? ' · [SPACE] AUFS BOOT ZIEHEN'
          : ' · [SPACE] AUF DEN STEG ZIEHEN'
        : '';
      nextPrompt = `[E] EINSTEIGEN · ${boatHud.nearbyBoatName ?? 'BOOT'}${climbHint}`;
    } else if (yachtHud.nearbyYacht) {
      nextPrompt = playerWaterClimbLabel
        ? '[E] STEUERN · SUPERYACHT „LADY VICE“ · [SPACE] AUFS BOOT ZIEHEN'
        : '[E] STEUERN · SUPERYACHT „LADY VICE“';
    } else if (playerWaterClimbLabel) {
      nextPrompt =
        playerWaterClimbLabel === 'BOOT'
          ? '[SPACE] AUFS BOOT ZIEHEN'
          : '[SPACE] AUF DEN STEG ZIEHEN';
    } else if (garageRideHud.nearbyMountPrompt) {
      nextPrompt = garageRideHud.nearbyMountPrompt;
    } else if (driveHud.nearbyVehicleName) {
      nextPrompt = `[E] EINSTEIGEN · ${driveHud.nearbyVehicleName}`;
    } else if (playerInCover) {
      nextPrompt = playerCoverPeeking
        ? '[DECKUNG · SPÄHEN] [LMB] FEUERN · [Q / X] DECKUNG VERLASSEN'
        : '[DECKUNG] [A/D] ENTLANG · [RMB] SPÄHEN · [Q / X] VERLASSEN';
    } else if (playerCanTakeCover) {
      nextPrompt = '[Q / X] IN DECKUNG GEHEN';
    }
  }

  if (nextPrompt) {
    setText(interactPromptEl, nextPrompt);
    setClass(interactPromptEl, 'visible', true);
  } else {
    setClass(interactPromptEl, 'visible', false);
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
    bloomPass.strength = (retrowaveTimer > 0 ? 0.78 : 0.42) + drunkLevel * 0.62;
    bloomPass.radius = 0.48 + drunkLevel * 0.42;
  } else {
    bloomPass.strength = retrowaveTimer > 0 ? 0.78 : 0.42;
    bloomPass.radius = retrowaveTimer > 0 ? 0.68 : 0.48;
  }

  renderFrame();
}

requestAnimationFrame(animate);
