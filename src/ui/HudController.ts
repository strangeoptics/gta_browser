import type * as THREE from 'three';
import type { WeaponHudState } from '../combat/WeaponSystem';
import type { PetInteractable } from '../entities/SafehousePets';
import type { LowriderHudState } from '../gameplay/LowriderBattleSystem';
import type { PayNSpray } from '../gameplay/PayNSpray';
import type { ShopSystem } from '../gameplay/ShopSystem';
import type { WantedSystem } from '../gameplay/WantedSystem';
import type { BoatHudState } from '../vehicles/BoatSystem';
import type { GarageRideHudState, GarageWallInteractable } from '../vehicles/GarageRidesSystem';
import type { PlayerHeliHudState } from '../vehicles/PlayerHelicopterSystem';
import type { SuperyachtHudState } from '../vehicles/SuperyachtSystem';
import type { DrivingHudState, Vehicle } from '../vehicles/VehicleSystem';
import type { MiamiWorld } from '../world/CityBuilder';
import type { CabinetWeapon, FoodItem } from '../world/Safehouse';
import {
  LowriderNotePool,
  STAR_STRINGS,
  formatHudCash,
  setClass,
  setDisplay,
  setOpacity,
  setSquareSize,
  setText,
  setWidth,
} from './DomHelpers';

export interface HudFrameInput {
  damageFlash: number;
  timeJumpFlash: number;
  retrowaveTimer: number;
  playerPos: THREE.Vector3;
  playerHp: number;
  playerMaxHp: number;
  playerArmor: number;
  cash: number;
  wanted: WantedSystem;
  radioStation: string;
  inAnyCraft: boolean;
  activeCar: Vehicle | null;
  activeSpecialKind: 'taxi' | 'firefighter' | 'paramedic' | null;
  vigilanteActive: boolean;
  lowriderBattleActive: boolean;
  shopOpen: boolean;
  petShopOpen: boolean;
  world: MiamiWorld;
  shop: ShopSystem;
  payNSpray: PayNSpray;
  storyHud: { active: boolean; chapterNumber: number; title: string; description: string; distanceM: number; dialogueSpeaker: string | null; dialogueText: string | null };
  kittHud: { speaker: string | null; text: string | null };
  vigilanteHud: { active: boolean; title: string; description: string; timerText: string; distanceM: number };
  specialHud: { active: boolean; tag: string; title: string; description: string; timerText: string; distanceM: number };
  heistHud: { active: boolean; title: string; description: string; distanceM: number; nearStartMarker: boolean };
  partyHud: { active: boolean; nearTributeCash: boolean; nearbyGuestName: string | null };
  objHud: { title: string; description: string; timerText: string | null; distanceM: number; toastText: string | null };
  lowriderHud: LowriderHudState;
  activeToast: string | null;
  wHud: WeaponHudState;
  driveHud: DrivingHudState;
  garageRideHud: GarageRideHudState;
  boatHud: BoatHudState;
  yachtHud: SuperyachtHudState;
  heliPlayerHud: PlayerHeliHudState;
  lookedWallRide: GarageWallInteractable | null;
  lookedPet: PetInteractable | null;
  lookedFood: FoodItem | null;
  lookedCabinetWeapon: CabinetWeapon | null;
  lookedAtTv: boolean;
  playerWaterClimbLabel: string | null;
  playerInCover: boolean;
  playerCoverPeeking: boolean;
  playerCanTakeCover: boolean;
}

/**
 * Owns all live HUD DOM elements and performs dirty-checked per-frame HUD updates
 * (status bars, objective panel, toast, dialogue, Lowrider battle bar, vehicle/weapon HUD & interact prompt).
 */
export class HudController {
  public readonly slotLauncherEl: HTMLSpanElement;

  private readonly crosshairEl = document.getElementById('crosshair') as HTMLDivElement;
  private readonly hitmarkerEl = document.getElementById('hitmarker') as HTMLDivElement;
  private readonly weaponPanelEl = document.getElementById('weapon-panel') as HTMLDivElement;
  private readonly weaponNameEl = document.getElementById('weapon-name') as HTMLDivElement;
  private readonly ammoCurrentEl = document.getElementById('ammo-current') as HTMLSpanElement;
  private readonly ammoMaxEl = document.getElementById('ammo-max') as HTMLSpanElement;
  private readonly reloadBarEl = document.getElementById('reload-bar') as HTMLDivElement;
  private readonly reloadFillEl = document.getElementById('reload-fill') as HTMLDivElement;
  private readonly slotEls = [
    document.getElementById('slot-0') as HTMLSpanElement,
    document.getElementById('slot-1') as HTMLSpanElement,
    document.getElementById('slot-2') as HTMLSpanElement,
    document.getElementById('slot-3') as HTMLSpanElement,
    document.getElementById('slot-4') as HTMLSpanElement,
  ];
  private readonly objTagEl = document.querySelector('.obj-tag') as HTMLSpanElement;
  private readonly starsEl = document.getElementById('wanted-stars') as HTMLDivElement;
  private readonly cashEl = document.getElementById('cash-display') as HTMLDivElement;
  private readonly hpFillEl = document.getElementById('hp-fill') as HTMLDivElement;
  private readonly hpTextEl = document.getElementById('hp-text') as HTMLSpanElement;
  private readonly armorFillEl = document.getElementById('armor-fill') as HTMLDivElement;
  private readonly armorTextEl = document.getElementById('armor-text') as HTMLSpanElement;
  private readonly objTitleEl = document.getElementById('obj-title') as HTMLDivElement;
  private readonly objDescEl = document.getElementById('obj-desc') as HTMLDivElement;
  private readonly objDistEl = document.getElementById('obj-dist') as HTMLSpanElement;
  private readonly interactPromptEl = document.getElementById('interact-prompt') as HTMLDivElement;
  private readonly storyDialogueBannerEl = document.getElementById('story-dialogue-banner') as HTMLDivElement;
  private readonly storySpeakerEl = document.getElementById('story-speaker') as HTMLSpanElement;
  private readonly storyLineEl = document.getElementById('story-line') as HTMLSpanElement;
  private readonly lowriderHudEl = document.getElementById('lowrider-hud') as HTMLDivElement;
  private readonly lowriderScoreEl = document.getElementById('lowrider-score') as HTMLSpanElement;
  private readonly lowriderFeedbackEl = document.getElementById('lowrider-feedback') as HTMLSpanElement;
  private readonly lowriderProgressEl = document.getElementById('lowrider-progress') as HTMLSpanElement;
  private readonly lowriderNotePool: LowriderNotePool;
  private readonly vehiclePanelEl = document.getElementById('vehicle-panel') as HTMLDivElement;
  private readonly vehicleNameEl = document.getElementById('vehicle-name') as HTMLDivElement;
  private readonly vehicleSpeedEl = document.getElementById('vehicle-speed') as HTMLSpanElement;
  private readonly vehicleHpFillEl = document.getElementById('vehicle-hp-fill') as HTMLDivElement;
  private readonly vehicleCamHintEl = document.getElementById('vehicle-cam-hint') as HTMLDivElement;
  private readonly toastBannerEl = document.getElementById('toast-banner') as HTMLDivElement;
  private readonly damageVignetteEl = document.getElementById('damage-vignette') as HTMLDivElement;
  private readonly timeJumpFlashEl = document.getElementById('timejump-flash') as HTMLDivElement;

  constructor() {
    this.slotLauncherEl = this.slotEls[4];
    const notesContainer = document.getElementById('lowrider-notes') as HTMLDivElement;
    this.lowriderNotePool = new LowriderNotePool(notesContainer, 8);
  }

  public setLauncherLocked(locked: boolean): void {
    this.slotEls[4].classList.toggle('locked', locked);
  }

  public update(inp: HudFrameInput): void {
    setOpacity(this.damageVignetteEl, inp.damageFlash > 0.004 ? inp.damageFlash.toFixed(2) : '0');
    setOpacity(
      this.timeJumpFlashEl,
      inp.timeJumpFlash > 0.004 ? (inp.timeJumpFlash * 0.92).toFixed(2) : '0',
    );

    const hpPct = Math.min(100, Math.round((inp.playerHp / inp.playerMaxHp) * 100));
    setWidth(this.hpFillEl, `${hpPct}%`);
    setText(
      this.hpTextEl,
      inp.playerMaxHp > 100 ? `${Math.round(inp.playerHp)}/${inp.playerMaxHp}` : `${Math.round(inp.playerHp)}`,
    );

    const armorPct = Math.round(inp.playerArmor);
    setWidth(this.armorFillEl, `${armorPct}%`);
    setText(this.armorTextEl, `${armorPct}`);

    setText(this.starsEl, STAR_STRINGS[inp.wanted.stars] ?? STAR_STRINGS[0]);
    setClass(this.starsEl, 'cooling', inp.wanted.isCoolingDown());
    setClass(this.starsEl, 'active', inp.wanted.stars > 0);
    setText(this.cashEl, formatHudCash(inp.cash));

    // Story / K.I.T.T. Dialogue Banner
    if (inp.storyHud.dialogueSpeaker && inp.storyHud.dialogueText) {
      setText(this.storySpeakerEl, inp.storyHud.dialogueSpeaker);
      setText(this.storyLineEl, inp.storyHud.dialogueText);
      setClass(this.storyDialogueBannerEl, 'visible', true);
    } else if (inp.kittHud.speaker && inp.kittHud.text) {
      setText(this.storySpeakerEl, inp.kittHud.speaker);
      setText(this.storyLineEl, inp.kittHud.text);
      setClass(this.storyDialogueBannerEl, 'visible', true);
    } else {
      setClass(this.storyDialogueBannerEl, 'visible', false);
    }

    // Lowrider Rhythm Battle HUD (pooled DOM notes -> zero allocations per frame!)
    setClass(this.lowriderHudEl, 'visible', inp.lowriderHud.active);
    if (inp.lowriderHud.active) {
      setText(this.lowriderScoreEl, `${inp.lowriderHud.score} PKT`);
      setText(this.lowriderProgressEl, `${inp.lowriderHud.progressPct}%`);
      setText(
        this.lowriderFeedbackEl,
        inp.lowriderHud.feedback || 'IM TAKT HÜPFEN · [W A S D] / [SPACE] · [ESC] ABBRUCH',
      );
      setClass(this.lowriderFeedbackEl, 'perfect', inp.lowriderHud.feedbackKind === 'perfect');
      setClass(this.lowriderFeedbackEl, 'good', inp.lowriderHud.feedbackKind === 'good');
      setClass(this.lowriderFeedbackEl, 'miss', inp.lowriderHud.feedbackKind === 'miss');
      this.lowriderNotePool.render(inp.lowriderHud.notes);
    }

    // Top-Left Objective Box
    if (inp.storyHud.active) {
      setText(this.objTagEl, `★ STORY · KAP. ${inp.storyHud.chapterNumber}/5`);
      setClass(this.objTagEl, 'heist', true);
      setText(this.objTitleEl, inp.storyHud.title);
      setText(this.objDescEl, inp.storyHud.description);
      setText(this.objDistEl, `${inp.storyHud.distanceM} m`);
    } else if (inp.vigilanteHud.active) {
      setText(this.objTagEl, '★ VIGILANTE');
      setClass(this.objTagEl, 'heist', true);
      setText(this.objTitleEl, inp.vigilanteHud.title);
      setText(this.objDescEl, inp.vigilanteHud.description);
      setText(this.objDistEl, `${inp.vigilanteHud.timerText} · ${inp.vigilanteHud.distanceM} m`);
    } else if (inp.specialHud.active) {
      setText(this.objTagEl, inp.specialHud.tag);
      setClass(this.objTagEl, 'heist', true);
      setText(this.objTitleEl, inp.specialHud.title);
      setText(this.objDescEl, inp.specialHud.description);
      setText(this.objDistEl, `${inp.specialHud.timerText} · ${inp.specialHud.distanceM} m`);
    } else if (inp.heistHud.active) {
      setText(this.objTagEl, '★ HEIST');
      setClass(this.objTagEl, 'heist', true);
      setText(this.objTitleEl, inp.heistHud.title);
      setText(this.objDescEl, inp.heistHud.description);
      setText(this.objDistEl, `${inp.heistHud.distanceM} m`);
    } else {
      setText(this.objTagEl, 'ZIEL · [J] TELEFON · [H] HEIST');
      setClass(this.objTagEl, 'heist', false);
      setText(this.objTitleEl, inp.objHud.title);
      setText(this.objDescEl, inp.objHud.description);
      if (inp.objHud.timerText && inp.objHud.distanceM > 0) {
        setText(this.objDistEl, `${inp.objHud.timerText} · ${inp.objHud.distanceM} m`);
      } else if (inp.objHud.timerText) {
        setText(this.objDistEl, inp.objHud.timerText);
      } else {
        setText(this.objDistEl, inp.objHud.distanceM > 0 ? `${inp.objHud.distanceM} m` : '');
      }
    }

    // Toast Banner
    if (inp.activeToast) {
      setText(this.toastBannerEl, inp.activeToast);
      setClass(this.toastBannerEl, 'visible', true);
    } else {
      setClass(this.toastBannerEl, 'visible', false);
    }

    setClass(this.weaponPanelEl, 'hidden', inp.inAnyCraft);
    setDisplay(this.crosshairEl, inp.inAnyCraft ? 'none' : 'block');
    setClass(this.vehiclePanelEl, 'visible', inp.inAnyCraft);

    const nextPrompt = this.updateVehicleOrWeaponAndPrompt(inp);
    if (nextPrompt) {
      setText(this.interactPromptEl, nextPrompt);
      setClass(this.interactPromptEl, 'visible', true);
    } else {
      setClass(this.interactPromptEl, 'visible', false);
    }
  }

  private updateVehicleOrWeaponAndPrompt(inp: HudFrameInput): string | null {
    const { world, shop, payNSpray, playerPos } = inp;
    let nextPrompt: string | null = null;

    if (inp.heliPlayerHud.inHeli) {
      setText(this.vehicleNameEl, `${inp.heliPlayerHud.heliName} · ${inp.heliPlayerHud.altitudeM}m`);
      setText(this.vehicleSpeedEl, `${inp.heliPlayerHud.speedKmh}`);
      setWidth(this.vehicleHpFillEl, '100%');
      setClass(this.vehicleHpFillEl, 'low', false);
      setText(
        this.vehicleCamHintEl,
        `[SPACE/C] HÖHE · [Q] ${inp.radioStation} · [V] CAM · [E] LANDEN`,
      );
    } else if (inp.boatHud.inBoat) {
      setText(this.vehicleNameEl, inp.boatHud.boatName);
      setText(this.vehicleSpeedEl, `${inp.boatHud.speedKmh}`);
      setWidth(this.vehicleHpFillEl, '100%');
      setClass(this.vehicleHpFillEl, 'low', false);
      setText(this.vehicleCamHintEl, `[Q] ${inp.radioStation} · [E] AUSSTEIGEN`);
    } else if (inp.yachtHud.inYacht) {
      setText(this.vehicleNameEl, inp.yachtHud.yachtName);
      setText(this.vehicleSpeedEl, `${inp.yachtHud.speedKmh}`);
      setWidth(this.vehicleHpFillEl, '100%');
      setClass(this.vehicleHpFillEl, 'low', false);
      setText(this.vehicleCamHintEl, `[Q] ${inp.radioStation} · [V] BRÜCKE/CHASE · [E] ANKERN`);
    } else if (inp.garageRideHud.inRide) {
      setText(this.vehicleNameEl, inp.garageRideHud.rideName);
      setText(this.vehicleSpeedEl, `${inp.garageRideHud.speedKmh}`);
      setWidth(this.vehicleHpFillEl, '100%');
      setClass(this.vehicleHpFillEl, 'low', false);
      const rideHint =
        inp.garageRideHud.rideId === 'skateboard'
          ? '[SPACE] OLLIE · [SHIFT] PUSH · [V] CAM · [E] ABSTEIGEN'
          : '[SPACE] HOP · [SHIFT] SPRINT · [G] KLINGEL · [V] CAM · [E] AB';
      setText(this.vehicleCamHintEl, rideHint);
      if (inp.garageRideHud.canRehangInGarage) {
        nextPrompt = `[F] ${inp.garageRideHud.rideName} WIEDER AN GARAGENWAND BEFESTIGEN`;
      }
    } else if (inp.driveHud.inVehicle) {
      setText(this.vehicleNameEl, inp.driveHud.vehicleName);
      setText(this.vehicleSpeedEl, `${inp.driveHud.speedKmh}`);
      setWidth(this.vehicleHpFillEl, `${inp.driveHud.hpPct}%`);
      setClass(this.vehicleHpFillEl, 'low', inp.driveHud.hpPct < 35);
      const car = inp.activeCar;
      if (car?.specialRole === 'firetruck') {
        const fireToggle = inp.activeSpecialKind === 'firefighter' ? 'EINSATZ AUS' : 'FEUERWEHR';
        setText(
          this.vehicleCamHintEl,
          `[LMB/C] WASSERWERFER · [MAUS/PFEILE] ZIELEN · [G] ${fireToggle} · [V] CAM · [E] AUS`,
        );
      } else if (car?.specialRole === 'taxi') {
        const taxiToggle = inp.activeSpecialKind === 'taxi' ? 'TAXI AUS' : 'TAXI-MODUS';
        setText(
          this.vehicleCamHintEl,
          `[LMB] DRIVE-BY · [G] ${taxiToggle} · [Q] ${inp.radioStation} · [V] CAM · [E] AUS`,
        );
      } else if (car?.specialRole === 'ambulance') {
        const emsToggle = inp.activeSpecialKind === 'paramedic' ? 'EMS AUS' : 'RETTUNGSDIENST';
        setText(
          this.vehicleCamHintEl,
          `[LMB] DRIVE-BY · [G] ${emsToggle} · [Q] ${inp.radioStation} · [V] CAM · [E] AUS`,
        );
      } else if (car?.specialRole === 'icecream') {
        const jingleLbl = car.jingleActive ? 'JINGLE AUS' : '8-BIT JINGLE AN';
        setText(this.vehicleCamHintEl, `[G] ${jingleLbl} (COPS ABLENKEN) · [V] CAM · [E] AUS`);
      } else if (car?.isDelorean) {
        const warpLbl =
          inp.retrowaveTimer > 0
            ? `⚡ RETROWAVE (${Math.ceil(inp.retrowaveTimer)}s)`
            : car.timeJumpCooldown && car.timeJumpCooldown > 0
              ? `FLUX LÄDT (${Math.ceil(car.timeJumpCooldown)}s)`
              : car.timeJumpReady
                ? '[G / SHIFT] ⚡ ZEITSPRUNG BEREIT!'
                : '100% TOPSPEED FÜR ZEITSPRUNG [G]';
        setText(this.vehicleCamHintEl, `${warpLbl} · [Q] ${inp.radioStation} · [V] CAM · [E] AUS`);
      } else if (car?.isKitt) {
        const boostLbl =
          car.turboBoostCooldown > 0
            ? `TURBO-BOOST (${car.turboBoostCooldown.toFixed(1)}s)`
            : 'TURBO-BOOST BEREIT!';
        setText(
          this.vehicleCamHintEl,
          `[SHIFT/G] ${boostLbl} · [Q] ${inp.radioStation} · [V] CAM · [E] AUS`,
        );
      } else {
        const vigHint = car?.isPolice
          ? ` · [G] ${inp.vigilanteActive ? 'VIGILANTE AUS' : 'VIGILANTE'}`
          : car?.hydraulics
            ? ` · [G] HYDRAULIK ${car.hydraulicsAutoBounce ? 'AN' : 'AUS'}`
            : '';
        setText(this.vehicleCamHintEl, `[LMB] DRIVE-BY · [Q] ${inp.radioStation}${vigHint} · [V] CAM · [E] AUS`);
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
      } else if (car && world.isCarInLowriderArena(car.position) && !inp.lowriderBattleActive) {
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
      } else if (car && car.isDelorean && car.timeJumpReady) {
        nextPrompt = '[G] ⚡ 88 MPH ZEITSPRUNG AUSLÖSEN!';
      }
    } else {
      setText(this.weaponNameEl, inp.wHud.name);
      setText(this.ammoCurrentEl, inp.wHud.isMelee ? '∞' : inp.wHud.reloading ? 'RLD' : String(inp.wHud.ammo));
      setText(this.ammoMaxEl, inp.wHud.isMelee ? 'MELEE' : `/ ${inp.wHud.magSize}`);
      setClass(this.reloadBarEl, 'visible', inp.wHud.reloading);
      setWidth(this.reloadFillEl, `${Math.round(inp.wHud.reloadProgress * 100)}%`);
      for (let i = 0; i < this.slotEls.length; i++) setClass(this.slotEls[i], 'active', i === inp.wHud.slotIndex);

      setSquareSize(this.crosshairEl, `${inp.wHud.spreadPx}px`);
      setOpacity(this.crosshairEl, inp.wHud.ads ? '0.45' : '0.88');
      setOpacity(this.hitmarkerEl, inp.wHud.hitmarkerAlpha > 0.01 ? inp.wHud.hitmarkerAlpha.toFixed(2) : '0');
      setClass(this.hitmarkerEl, 'kill', inp.wHud.hitmarkerKill && inp.wHud.hitmarkerAlpha > 0.05);

      if (inp.lookedWallRide) {
        nextPrompt =
          inp.lookedWallRide.action === 'detach'
            ? `[E / F / LMB] ${inp.lookedWallRide.promptLabel}`
            : `[F / LMB] ${inp.lookedWallRide.promptLabel}`;
      } else if (inp.lookedPet) {
        nextPrompt = `[LMB / F] ${inp.lookedPet.promptLabel}`;
      } else if (inp.lookedFood) {
        nextPrompt =
          inp.lookedFood.alcohol && inp.lookedFood.alcohol > 0
            ? `[LMB / F] ${inp.lookedFood.name} TRINKEN (+${inp.lookedFood.heal} HP · 🍺)`
            : `[LMB / F] ${inp.lookedFood.name} NEHMEN & ESSEN (+${inp.lookedFood.heal} HP)`;
      } else if (inp.lookedCabinetWeapon) {
        nextPrompt = `[LMB / F] ${inp.lookedCabinetWeapon.name} AUS WAFFENSCHRANK NEHMEN`;
      } else if (inp.lookedAtTv) {
        nextPrompt = world.isTvOn()
          ? '[LMB / F] FERNSEHER AUSSCHALTEN'
          : '[LMB / F] FERNSEHER ANSCHALTEN · VICE CHANNEL 6';
      } else if (shop.isPlayerNear(playerPos) && !inp.shopOpen) {
        nextPrompt = '[B] AMMU-NEON SHOP ÖFFNEN ($)';
      } else if (world.isNearPetShop(playerPos) && !inp.petShopOpen) {
        nextPrompt = '[F / B] HAVANA PETS · SAFEHOUSE-HAUSTIER ADOPTIEREN (🐾)';
      } else if (world.isNearSafehouseWardrobe(playerPos)) {
        nextPrompt = '[F] KLEIDERSCHRANK · OUTFIT WECHSELN';
      } else if (inp.partyHud.nearTributeCash) {
        nextPrompt = '[F] CREW-UMSCHLAG NEHMEN (+$400)';
      } else if (world.isNearSafehouseRooftopBar(playerPos)) {
        nextPrompt = !world.isSafehouseRooftopBarOwned()
          ? '[F] PENTHOUSE DACH-COCKTAILBAR KAUFEN · $1.800'
          : inp.partyHud.active
            ? '[F] PARTY-COCKTAIL (+HP/+ARMOR/MUNI) · [G] PARTY BEENDEN'
            : '[F] COCKTAIL MIXEN · [G] ROOFTOP-PARTY SCHMEISSEN';
      } else if (inp.partyHud.nearbyGuestName) {
        nextPrompt = `[F] MIT ${inp.partyHud.nearbyGuestName} ANSTOSSEN · [G] PARTY BEENDEN`;
      } else if (world.isNearSafehouseFridge(playerPos)) {
        nextPrompt = '[F] KÜHLSCHRANK · SNACK ESSEN (+25 HP)';
      } else if (world.isNearSafehouseLounge(playerPos)) {
        nextPrompt = '[F] SAFEHOUSE · HEILEN, MUNITION VOLL & SPEICHERN';
      } else if (world.isNearPdDesk(playerPos) && inp.wanted.stars >= 1) {
        nextPrompt = `[F] KAUTION / BESTECHUNG · $${inp.wanted.stars * 200} (STERNE LÖSCHEN)`;
      } else if (world.isNearPdEvidenceCash(playerPos)) {
        nextPrompt = '[F] SYNDIKAT-GELDKOFFER STEHLEN (+$1.500 · ⚠ 3★ ALARM)';
      } else if (world.isNearPdKevlar(playerPos)) {
        nextPrompt = '[F] KEVLAR-WESTE STEHLEN (100% ARMOR · ⚠ ALARM)';
      } else if (world.isNearPdArmory(playerPos)) {
        nextPrompt = '[F] POLIZEI-SHOTGUN & MUNITION STEHLEN (⚠ ALARM)';
      } else if (world.isNearPdUniform(playerPos)) {
        nextPrompt = '[F] SPIND · VICE PD UNIFORM ANZIEHEN';
      } else if (world.isNearClubBar(playerPos)) {
        nextPrompt = '[F] MIAMI VICE COCKTAIL TRINKEN · $50';
      } else if (world.isNearIslandVault(playerPos)) {
        nextPrompt = '[F] STARFISH ESTATE · GOLD-TRESOR STEHLEN (+$2.500 · ⚠ 3★)';
      } else if (world.isNearYachtLoot(playerPos)) {
        nextPrompt = '[F] SUPERYACHT „LADY VICE“ · KAPITÄNS-GOLD (+$1.800 · ⚠)';
      } else if (world.isNearDinerCounter(playerPos)) {
        nextPrompt = '[F] STARLIGHT DINER · CUBAN BURGER & MILKSHAKE ($40 · 100% HP)';
      } else if (world.isNearBankVault(playerPos)) {
        nextPrompt = '[F] BANCO DE VICE · BANK-TRESOR AUSRAUBEN (+$3.000 · ⚠ 4★ ALARM)';
      } else if (world.isNearMarinaLoot(playerPos)) {
        nextPrompt = '[F] VICE MARINA · SCHMUGGLER-KOFFER STEHLEN (+$2.000 · ⚠ 2★)';
      } else if (world.isNearLighthouseSpot(playerPos)) {
        nextPrompt = '[F] CAPE VICE LEUCHTTURM · AUSSICHT & ENTDECKER-BONUS';
      } else if (world.isNearAirfieldLoot(playerPos)) {
        nextPrompt = '[F] HANGAR 06 · SCHMUGGLER-FRACHT STEHLEN (+$2.800 · ⚠ 3★ ALARM)';
      } else if (world.isNearAirfieldCafe(playerPos)) {
        nextPrompt = '[F] TERMINAL 1 CAFÉ · ESPRESSO & SNACK ($35 · 100% HP)';
      } else if (inp.heistHud.nearStartMarker && !inp.heistHud.active) {
        nextPrompt = '[H] OCEAN CLUB HEIST STARTEN (+$3.500)';
      } else if (inp.heliPlayerHud.nearbyHeli) {
        nextPrompt = '[E] EINSTEIGEN · VICE MAVERICK HELIKOPTER';
      } else if (inp.boatHud.nearbyBoat) {
        const climbHint = inp.playerWaterClimbLabel
          ? inp.playerWaterClimbLabel === 'BOOT'
            ? ' · [SPACE] AUFS BOOT ZIEHEN'
            : ' · [SPACE] AUF DEN STEG ZIEHEN'
          : '';
        nextPrompt = `[E] EINSTEIGEN · ${inp.boatHud.nearbyBoatName ?? 'BOOT'}${climbHint}`;
      } else if (inp.yachtHud.nearbyYacht) {
        nextPrompt = inp.playerWaterClimbLabel
          ? '[E] STEUERN · SUPERYACHT „LADY VICE“ · [SPACE] AUFS BOOT ZIEHEN'
          : '[E] STEUERN · SUPERYACHT „LADY VICE“';
      } else if (inp.playerWaterClimbLabel) {
        nextPrompt =
          inp.playerWaterClimbLabel === 'BOOT'
            ? '[SPACE] AUFS BOOT ZIEHEN'
            : '[SPACE] AUF DEN STEG ZIEHEN';
      } else if (inp.garageRideHud.nearbyMountPrompt) {
        nextPrompt = inp.garageRideHud.nearbyMountPrompt;
      } else if (inp.driveHud.nearbyVehicleName) {
        nextPrompt = `[E] EINSTEIGEN · ${inp.driveHud.nearbyVehicleName}`;
      } else if (inp.playerInCover) {
        nextPrompt = inp.playerCoverPeeking
          ? '[DECKUNG · SPÄHEN] [LMB] FEUERN · [Q / X] DECKUNG VERLASSEN'
          : '[DECKUNG] [A/D] ENTLANG · [RMB] SPÄHEN · [Q / X] VERLASSEN';
      } else if (inp.playerCanTakeCover) {
        nextPrompt = '[Q / X] IN DECKUNG GEHEN';
      }
    }

    return nextPrompt;
  }
}
