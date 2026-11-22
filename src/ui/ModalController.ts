import type { AudioEngine } from '../audio/AudioEngine';
import type { WeaponSystem } from '../combat/WeaponSystem';
import {
  clearProgress,
  createProfile,
  deleteProfile,
  getActiveProfile,
  listProfiles,
  renameProfile,
  setActiveProfile,
  type GameSettings,
} from '../engine/Storage';
import type { HelicopterSystem } from '../entities/HelicopterSystem';
import type { NpcSystem } from '../entities/NpcSystem';
import { PET_CATALOG, type PetId, type SafehousePets } from '../entities/SafehousePets';
import type { HeistSystem } from '../gameplay/HeistSystem';
import { MISSION_CONTRACTS, type MissionDistrict, type ObjectiveSystem } from '../gameplay/ObjectiveSystem';
import type { RooftopPartySystem } from '../gameplay/RooftopPartySystem';
import { STORY_CHAPTERS, type StoryCampaign } from '../gameplay/StoryCampaign';
import type { WantedSystem } from '../gameplay/WantedSystem';
import type { PlayerController } from '../player/PlayerController';
import type { MiamiWorld } from '../world/CityBuilder';

export interface ModalContext {
  canvas: HTMLCanvasElement;
  overlay: HTMLDivElement;
  slotLauncherEl: HTMLSpanElement;
  player: PlayerController;
  world: MiamiWorld;
  weapons: WeaponSystem;
  npcs: NpcSystem;
  heli: HelicopterSystem;
  pets: SafehousePets;
  wanted: WantedSystem;
  objectives: ObjectiveSystem;
  story: StoryCampaign;
  heist: HeistSystem;
  rooftopParty: RooftopPartySystem;
  audio: AudioEngine;
  getPlayerHp: () => number;
  setPlayerHp: (hp: number) => void;
  getPlayerMaxHp: () => number;
  getPlayerArmor: () => number;
  setPlayerArmor: (armor: number) => void;
  getSettings: () => GameSettings;
  applySettings: (next: GameSettings) => void;
  onWantedStarsChanged: (stars: number) => void;
  onClearCrimeRecord: () => void;
  applyActiveProfileToWorld: (respawnPlayer: boolean) => void;
  persistProgress: () => void;
  requestLockSafely: () => void;
  showQuickToast: (text: string) => void;
}

/**
 * Owns all modal overlays (AMMU-NEON Shop, HAVANA PETS, Developer Panel, 80s Missions-Telefon)
 * as well as the Pause Menu's Multi-Player Profile selector & Live Settings controls.
 */
export class ModalController {
  private readonly ctx: ModalContext;

  private shopOpen = false;
  private petShopOpen = false;
  private devOpen = false;
  private phoneOpen = false;
  private phoneDistrictFilter: 'story' | 'all' | MissionDistrict = 'story';
  private profileFormMode: 'new' | 'rename' | null = null;

  // AMMU-NEON Shop
  private readonly shopOverlayEl = document.getElementById('shop-overlay') as HTMLDivElement;
  private readonly shopCashEl = document.getElementById('shop-cash') as HTMLSpanElement;
  private readonly buyMedkitBtn = document.getElementById('buy-medkit') as HTMLButtonElement;
  private readonly buyArmorBtn = document.getElementById('buy-armor') as HTMLButtonElement;
  private readonly buyLauncherBtn = document.getElementById('buy-launcher') as HTMLButtonElement;
  private readonly shopCloseBtn = document.getElementById('shop-close') as HTMLButtonElement;

  // HAVANA PETS & EXOTICS
  private readonly petShopOverlayEl = document.getElementById('pet-shop-overlay') as HTMLDivElement;
  private readonly petShopCashEl = document.getElementById('pet-shop-cash') as HTMLSpanElement;
  private readonly buyPetBtns: Record<PetId, HTMLButtonElement> = {
    cleo: document.getElementById('buy-pet-cleo') as HTMLButtonElement,
    rico: document.getElementById('buy-pet-rico') as HTMLButtonElement,
    zeus: document.getElementById('buy-pet-zeus') as HTMLButtonElement,
    elvis: document.getElementById('buy-pet-elvis') as HTMLButtonElement,
  };
  private readonly petShopCloseBtn = document.getElementById('pet-shop-close') as HTMLButtonElement;

  // Developer Panel
  private readonly devOverlayEl = document.getElementById('dev-overlay') as HTMLDivElement;
  private readonly devCashEl = document.getElementById('dev-cash') as HTMLSpanElement;
  private readonly devStarsEl = document.getElementById('dev-stars') as HTMLSpanElement;
  private readonly devStarBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.dev-star-btn'));
  private readonly devClearCrimeBtn = document.getElementById('dev-clear-crime') as HTMLButtonElement;
  private readonly devCashMinusBtn = document.getElementById('dev-cash-minus') as HTMLButtonElement;
  private readonly devCash500Btn = document.getElementById('dev-cash-500') as HTMLButtonElement;
  private readonly devCash2500Btn = document.getElementById('dev-cash-2500') as HTMLButtonElement;
  private readonly devCash10kBtn = document.getElementById('dev-cash-10k') as HTMLButtonElement;
  private readonly devCashZeroBtn = document.getElementById('dev-cash-zero') as HTMLButtonElement;
  private readonly devCashInput = document.getElementById('dev-cash-input') as HTMLInputElement;
  private readonly devCashSetBtn = document.getElementById('dev-cash-set') as HTMLButtonElement;
  private readonly devCloseBtn = document.getElementById('dev-close') as HTMLButtonElement;

  // 80s Missions-Telefon / Auftragsboard ([J])
  private readonly phoneOverlayEl = document.getElementById('phone-overlay') as HTMLDivElement;
  private readonly phoneCashEl = document.getElementById('phone-cash') as HTMLDivElement;
  private readonly phoneDoneEl = document.getElementById('phone-done') as HTMLDivElement;
  private readonly phoneActiveLabelEl = document.getElementById('phone-active-label') as HTMLSpanElement;
  private readonly phoneCancelBtn = document.getElementById('phone-cancel-btn') as HTMLButtonElement;
  private readonly phoneHeistBtn = document.getElementById('phone-heist-btn') as HTMLButtonElement;
  private readonly phonePartyBtn = document.getElementById('phone-party-btn') as HTMLButtonElement;
  private readonly phoneTabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.phone-tab'));
  private readonly phoneMissionListEl = document.getElementById('phone-mission-list') as HTMLDivElement;
  private readonly phoneCloseBtn = document.getElementById('phone-close') as HTMLButtonElement;

  // Pause Settings & Multi-Player Profiles
  private readonly profileSelectEl = document.getElementById('profile-select') as HTMLSelectElement;
  private readonly profileNewBtn = document.getElementById('profile-new-btn') as HTMLButtonElement;
  private readonly profileRenameBtn = document.getElementById('profile-rename-btn') as HTMLButtonElement;
  private readonly profileDeleteBtn = document.getElementById('profile-delete-btn') as HTMLButtonElement;
  private readonly profileFormEl = document.getElementById('profile-form') as HTMLDivElement;
  private readonly profileNameInput = document.getElementById('profile-name-input') as HTMLInputElement;
  private readonly profileSaveBtn = document.getElementById('profile-save-btn') as HTMLButtonElement;
  private readonly profileCancelBtn = document.getElementById('profile-cancel-btn') as HTMLButtonElement;
  private readonly statCashEl = document.getElementById('stat-cash') as HTMLElement;
  private readonly statMissionsEl = document.getElementById('stat-missions') as HTMLElement;
  private readonly resetSaveBtn = document.getElementById('reset-save-btn') as HTMLButtonElement;
  private readonly optSensInput = document.getElementById('opt-sens') as HTMLInputElement;
  private readonly optSensValEl = document.getElementById('opt-sens-val') as HTMLSpanElement;
  private readonly optInvertYInput = document.getElementById('opt-invert-y') as HTMLInputElement;
  private readonly optSfxInput = document.getElementById('opt-sfx') as HTMLInputElement;
  private readonly optSfxValEl = document.getElementById('opt-sfx-val') as HTMLSpanElement;
  private readonly optMusicInput = document.getElementById('opt-music') as HTMLInputElement;
  private readonly optMusicValEl = document.getElementById('opt-music-val') as HTMLSpanElement;
  private readonly optPerfInput = document.getElementById('opt-perf') as HTMLInputElement;

  constructor(ctx: ModalContext) {
    this.ctx = ctx;
    this.bindProfileAndSettings();
    this.bindShopModal();
    this.bindPetShopModal();
    this.bindDevModal();
    this.bindPhoneModal();
  }

  public isShopOpen(): boolean {
    return this.shopOpen;
  }
  public isPetShopOpen(): boolean {
    return this.petShopOpen;
  }
  public isDevOpen(): boolean {
    return this.devOpen;
  }
  public isPhoneOpen(): boolean {
    return this.phoneOpen;
  }
  public isAnyModalOpen(): boolean {
    return this.shopOpen || this.petShopOpen || this.devOpen || this.phoneOpen;
  }

  public closeActiveModal(): boolean {
    if (this.shopOpen) {
      this.closeShop();
      return true;
    }
    if (this.petShopOpen) {
      this.closePetShop();
      return true;
    }
    if (this.phoneOpen) {
      this.closePhone();
      return true;
    }
    if (this.devOpen) {
      this.closeDevPanel();
      return true;
    }
    return false;
  }

  public updateStats(cash: number, completedMissions: number): void {
    this.statCashEl.textContent = `$${cash.toLocaleString('en-US')}`;
    this.statMissionsEl.textContent = String(completedMissions);
    this.refreshProfileSelector();
  }

  public syncSettingsUi(settings: GameSettings): void {
    this.optSensInput.value = String(settings.mouseSensitivity);
    this.optSensValEl.textContent = `${settings.mouseSensitivity.toFixed(1)}×`;
    this.optInvertYInput.checked = settings.invertMouseY;
    this.optSfxInput.value = String(settings.sfxVolume);
    this.optSfxValEl.textContent = `${Math.round(settings.sfxVolume * 100)}%`;
    this.optMusicInput.value = String(settings.musicVolume);
    this.optMusicValEl.textContent = `${Math.round(settings.musicVolume * 100)}%`;
    this.optPerfInput.checked = settings.performanceMode;
  }

  public refreshProfileSelector(): void {
    const profiles = listProfiles();
    const active = getActiveProfile();
    this.profileSelectEl.innerHTML = '';
    for (const p of profiles) {
      const opt = document.createElement('option');
      opt.value = p.id;
      const ch = p.progress.storyChapter ?? 0;
      opt.textContent = `${p.name} · $${p.progress.cash.toLocaleString('en-US')} · Kap. ${ch}/5`;
      opt.selected = p.id === active.id;
      this.profileSelectEl.appendChild(opt);
    }
    this.profileDeleteBtn.disabled = profiles.length <= 1;
  }

  // ---------------------------------------------------------------------------
  // AMMU-NEON Shop
  // ---------------------------------------------------------------------------
  public openShop(): void {
    this.shopOpen = true;
    this.ctx.player.setActive(false);
    if (document.pointerLockElement === this.ctx.canvas) {
      document.exitPointerLock?.();
    }
    this.refreshShopUi();
    this.shopOverlayEl.classList.add('visible');
  }

  public closeShop(): void {
    this.shopOpen = false;
    this.shopOverlayEl.classList.remove('visible');
    this.ctx.overlay.classList.add('hidden');
    this.ctx.player.setActive(true);
    this.ctx.requestLockSafely();
  }

  private refreshShopUi(): void {
    const { objectives, weapons } = this.ctx;
    this.shopCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
    this.buyMedkitBtn.disabled = objectives.cash < 250 || this.ctx.getPlayerHp() >= this.ctx.getPlayerMaxHp();
    this.buyArmorBtn.disabled = objectives.cash < 400 || this.ctx.getPlayerArmor() >= 100;
    if (weapons.isLauncherUnlocked()) {
      this.buyLauncherBtn.textContent = 'FREIGESCHALTET [4] · MUNITION VOLL ($200)';
      this.buyLauncherBtn.disabled = objectives.cash < 200;
    } else {
      this.buyLauncherBtn.textContent = 'NEON LAUNCHER [4] · $900';
      this.buyLauncherBtn.disabled = objectives.cash < 900;
    }
  }

  private bindShopModal(): void {
    this.buyMedkitBtn.addEventListener('click', () => {
      if (this.ctx.objectives.cash < 250 || this.ctx.getPlayerHp() >= this.ctx.getPlayerMaxHp()) return;
      this.ctx.objectives.cash -= 250;
      this.ctx.setPlayerHp(Math.min(this.ctx.getPlayerMaxHp(), this.ctx.getPlayerHp() + 50));
      this.ctx.audio.playPurchase();
      this.ctx.persistProgress();
      this.refreshShopUi();
    });

    this.buyArmorBtn.addEventListener('click', () => {
      if (this.ctx.objectives.cash < 400 || this.ctx.getPlayerArmor() >= 100) return;
      this.ctx.objectives.cash -= 400;
      this.ctx.setPlayerArmor(100);
      this.ctx.audio.playPurchase();
      this.ctx.persistProgress();
      this.refreshShopUi();
    });

    this.buyLauncherBtn.addEventListener('click', () => {
      if (!this.ctx.weapons.isLauncherUnlocked()) {
        if (this.ctx.objectives.cash < 900) return;
        this.ctx.objectives.cash -= 900;
        this.ctx.weapons.unlockLauncher();
        this.ctx.slotLauncherEl.classList.remove('locked');
        this.ctx.audio.playPurchase();
        this.ctx.persistProgress();
        this.refreshShopUi();
      } else {
        if (this.ctx.objectives.cash < 200) return;
        this.ctx.objectives.cash -= 200;
        this.ctx.weapons.refillAllAmmo();
        this.ctx.audio.playPurchase();
        this.ctx.persistProgress();
        this.refreshShopUi();
      }
    });

    this.shopCloseBtn.addEventListener('click', () => this.closeShop());
  }

  // ---------------------------------------------------------------------------
  // HAVANA PETS & EXOTICS
  // ---------------------------------------------------------------------------
  public openPetShop(): void {
    this.petShopOpen = true;
    this.ctx.player.setActive(false);
    if (document.pointerLockElement === this.ctx.canvas) {
      document.exitPointerLock?.();
    }
    this.refreshPetShopUi();
    this.petShopOverlayEl.classList.add('visible');
  }

  public closePetShop(): void {
    this.petShopOpen = false;
    this.petShopOverlayEl.classList.remove('visible');
    this.ctx.overlay.classList.add('hidden');
    this.ctx.player.setActive(true);
    this.ctx.requestLockSafely();
  }

  private refreshPetShopUi(): void {
    this.petShopCashEl.textContent = `$${this.ctx.objectives.cash.toLocaleString('en-US')}`;
    for (const item of PET_CATALOG) {
      const btn = this.buyPetBtns[item.id];
      if (this.ctx.pets.ownsPet(item.id)) {
        btn.textContent = `✓ ${item.name} · IM VICE SAFEHOUSE ZUHAUSE`;
        btn.disabled = true;
      } else {
        btn.textContent = `${item.title} · $${item.price.toLocaleString('en-US')}`;
        btn.disabled = this.ctx.objectives.cash < item.price;
      }
    }
  }

  private bindPetShopModal(): void {
    for (const item of PET_CATALOG) {
      this.buyPetBtns[item.id].addEventListener('click', () => {
        if (this.ctx.pets.ownsPet(item.id) || this.ctx.objectives.cash < item.price) return;
        this.ctx.objectives.cash -= item.price;
        this.ctx.pets.adoptPet(item.id);
        if (item.id === 'cleo') this.ctx.audio.playCatPurr();
        else if (item.id === 'rico') this.ctx.audio.playParrotSquawk();
        else if (item.id === 'zeus') this.ctx.audio.playDogBark();
        else this.ctx.audio.playGatorSnap();
        this.ctx.audio.playPurchase();
        this.ctx.persistProgress();
        this.refreshPetShopUi();
        this.ctx.showQuickToast(
          item.id === 'elvis'
            ? 'ADOPTIERT! · ALLIGATOR „ELVIS“ WARTET AM SAFEHOUSE-DACHPOOL!'
            : `ADOPTIERT! · ${item.name} WARTET JETZT IM VICE SAFEHOUSE AUF DICH!`,
        );
      });
    }
    this.petShopCloseBtn.addEventListener('click', () => this.closePetShop());
  }

  // ---------------------------------------------------------------------------
  // Developer Panel
  // ---------------------------------------------------------------------------
  public openDevPanel(): void {
    this.devOpen = true;
    this.ctx.player.setActive(false);
    if (document.pointerLockElement === this.ctx.canvas) {
      document.exitPointerLock?.();
    }
    this.refreshDevUi();
    this.devOverlayEl.classList.add('visible');
  }

  public closeDevPanel(): void {
    this.devOpen = false;
    this.devOverlayEl.classList.remove('visible');
    this.ctx.overlay.classList.add('hidden');
    this.ctx.player.setActive(true);
    this.ctx.requestLockSafely();
  }

  private refreshDevUi(): void {
    this.devCashEl.textContent = `$${this.ctx.objectives.cash.toLocaleString('en-US')}`;
    this.devStarsEl.textContent = `${this.ctx.wanted.stars}★`;
    this.devStarBtns.forEach((btn) => {
      const s = parseInt(btn.dataset.stars ?? '0', 10);
      btn.classList.toggle('active', s === this.ctx.wanted.stars);
    });
  }

  private setDevCash(nextCash: number): void {
    this.ctx.objectives.cash = Math.max(0, Math.floor(nextCash));
    this.ctx.persistProgress();
    this.refreshDevUi();
    this.ctx.audio.playPurchase();
  }

  private bindDevModal(): void {
    this.devStarBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetStars = parseInt(btn.dataset.stars ?? '0', 10);
        this.ctx.wanted.setStars(targetStars);
        this.ctx.onWantedStarsChanged(targetStars);
        if (targetStars === 0) {
          this.ctx.npcs.clearPolice();
          this.ctx.heli.clear();
        }
        this.refreshDevUi();
        this.ctx.audio.playPurchase();
        this.ctx.showQuickToast(`DEV · FAHNDUNGSLEVEL AUF ${targetStars}★ GESETZT`);
      });
    });

    this.devClearCrimeBtn.addEventListener('click', () => {
      this.ctx.onClearCrimeRecord();
      this.refreshDevUi();
    });

    this.devCashMinusBtn.addEventListener('click', () => this.setDevCash(this.ctx.objectives.cash - 1000));
    this.devCash500Btn.addEventListener('click', () => this.setDevCash(this.ctx.objectives.cash + 500));
    this.devCash2500Btn.addEventListener('click', () => this.setDevCash(this.ctx.objectives.cash + 2500));
    this.devCash10kBtn.addEventListener('click', () => this.setDevCash(this.ctx.objectives.cash + 10000));
    this.devCashZeroBtn.addEventListener('click', () => this.setDevCash(0));
    this.devCashSetBtn.addEventListener('click', () => {
      const val = parseInt(this.devCashInput.value, 10);
      if (!Number.isNaN(val)) {
        this.setDevCash(val);
        this.ctx.showQuickToast(`DEV · GELD AUF $${Math.max(0, Math.floor(val)).toLocaleString('en-US')} GESETZT`);
      }
    });
    this.devCloseBtn.addEventListener('click', () => this.closeDevPanel());
  }

  // ---------------------------------------------------------------------------
  // 80s Missions-Telefon / Auftragsboard ([J])
  // ---------------------------------------------------------------------------
  public openPhone(): void {
    this.phoneOpen = true;
    this.ctx.player.setActive(false);
    if (document.pointerLockElement === this.ctx.canvas) {
      document.exitPointerLock?.();
    }
    this.renderPhoneMissions();
    this.phoneOverlayEl.classList.add('visible');
  }

  public closePhone(): void {
    this.phoneOpen = false;
    this.phoneOverlayEl.classList.remove('visible');
    this.ctx.overlay.classList.add('hidden');
    this.ctx.player.setActive(true);
    this.ctx.requestLockSafely();
  }

  private renderPhoneMissions(): void {
    const { objectives, story, heist, rooftopParty, world, npcs, wanted, audio } = this.ctx;
    this.phoneCashEl.textContent = `$${objectives.cash.toLocaleString('en-US')}`;
    const doneCount = objectives.getCompletedIds().length;
    this.phoneDoneEl.textContent = `STORY ${story.getCompletedChapters()}/${STORY_CHAPTERS.length} · JOBS ${doneCount}/${MISSION_CONTRACTS.length}`;

    const active = objectives.current;
    const activeStoryIdx = story.getActiveChapterIndex();
    if (activeStoryIdx >= 0) {
      const ch = STORY_CHAPTERS[activeStoryIdx];
      this.phoneActiveLabelEl.textContent = `AKTIV: ★ KAPITEL ${ch.number} · ${ch.title}`;
      this.phoneCancelBtn.disabled = false;
    } else {
      this.phoneActiveLabelEl.textContent = active ? `AKTIV: ${active.title}` : 'AKTIV: KEIN AUFTRAG';
      this.phoneCancelBtn.disabled = !active;
    }

    this.phoneHeistBtn.disabled = heist.isActive();
    this.phoneHeistBtn.textContent = heist.isActive() ? 'LÄUFT…' : 'STARTEN [H]';

    const hasBar = world.isSafehouseRooftopBarOwned();
    this.phonePartyBtn.disabled = !hasBar;
    this.phonePartyBtn.textContent = !hasBar
      ? 'BAR NÖTIG ($1.800)'
      : rooftopParty.isActive()
        ? 'PARTY BEENDEN'
        : 'PARTY STARTEN';

    this.phoneTabBtns.forEach((btn) => {
      btn.classList.toggle('active', (btn.dataset.district ?? 'story') === this.phoneDistrictFilter);
    });

    this.phoneMissionListEl.innerHTML = '';

    if (this.phoneDistrictFilter === 'story') {
      const completedCh = story.getCompletedChapters();
      const header = document.createElement('div');
      header.className = 'story-progress-header';
      header.innerHTML = `<span>★ OPERATION NEON DUSK</span><span>${completedCh} / ${STORY_CHAPTERS.length} KAPITEL</span>`;
      this.phoneMissionListEl.appendChild(header);

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
        rewEl.textContent =
          ch.finaleBonus && !isDone
            ? `+$${(ch.reward + ch.finaleBonus).toLocaleString('en-US')}`
            : `+$${ch.reward.toLocaleString('en-US')}`;

        const acceptBtn = document.createElement('button');
        acceptBtn.type = 'button';
        acceptBtn.className = 'mission-accept-btn';
        acceptBtn.textContent = isActive ? 'AKTIV' : !isUnlocked ? '🔒 GESPERRT' : isDone ? 'WIEDERHOLEN' : 'STARTEN';
        acceptBtn.disabled = isActive || !isUnlocked;
        acceptBtn.addEventListener('click', () => {
          if (story.startChapter(ch.index, npcs, wanted)) {
            audio.playCheckpoint();
            this.closePhone();
          }
        });

        right.append(rewEl, acceptBtn);
        card.append(left, right);
        this.phoneMissionListEl.appendChild(card);
      }
      return;
    }

    const filtered =
      this.phoneDistrictFilter === 'all'
        ? MISSION_CONTRACTS
        : MISSION_CONTRACTS.filter((c) => c.district === this.phoneDistrictFilter);

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
        this.closePhone();
        this.ctx.showQuickToast(`AUFTRAG ANGENOMMEN · ${c.title} (+$${c.reward.toLocaleString('en-US')})`);
      });

      right.append(rewEl, acceptBtn);
      card.append(left, right);
      this.phoneMissionListEl.appendChild(card);
    }
  }

  private bindPhoneModal(): void {
    this.phoneTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.phoneDistrictFilter = (btn.dataset.district ?? 'story') as 'story' | 'all' | MissionDistrict;
        this.renderPhoneMissions();
      });
    });

    this.phoneCancelBtn.addEventListener('click', () => {
      if (this.ctx.story.isActive()) {
        this.ctx.story.cancelChapter(this.ctx.npcs);
        this.ctx.showQuickToast('STORY-KAPITEL ABGEBROCHEN · [J] FÜR NEUSTART');
      } else {
        this.ctx.objectives.cancelActiveObjective(this.ctx.npcs);
        this.ctx.showQuickToast('AUFTRAG ABGEBROCHEN · [J] FÜR NEUE JOBS');
      }
      this.renderPhoneMissions();
    });

    this.phoneHeistBtn.addEventListener('click', () => {
      if (!this.ctx.heist.isActive()) {
        this.ctx.heist.startHeist();
        this.ctx.audio.playCheckpoint();
        this.closePhone();
      }
    });

    this.phonePartyBtn.addEventListener('click', () => {
      if (!this.ctx.world.isSafehouseRooftopBarOwned()) return;
      const started = this.ctx.rooftopParty.toggle();
      this.ctx.audio.playCheckpoint();
      if (!started) {
        this.ctx.showQuickToast('ROOFTOP-PARTY BEENDET · BIS ZUM NÄCHSTEN MAL!');
      }
      this.closePhone();
    });

    this.phoneCloseBtn.addEventListener('click', () => this.closePhone());
  }

  // ---------------------------------------------------------------------------
  // Profile Selector & Pause Settings
  // ---------------------------------------------------------------------------
  private openProfileForm(mode: 'new' | 'rename'): void {
    this.profileFormMode = mode;
    this.profileFormEl.classList.add('visible');
    this.profileNameInput.value = mode === 'rename' ? getActiveProfile().name : '';
    this.profileNameInput.placeholder = mode === 'rename' ? 'Neuer Name…' : `Spieler ${listProfiles().length + 1}`;
    this.profileNameInput.focus();
    this.profileNameInput.select();
  }

  private closeProfileForm(): void {
    this.profileFormMode = null;
    this.profileFormEl.classList.remove('visible');
  }

  private submitProfileForm(): void {
    if (!this.profileFormMode) return;
    const rawName = this.profileNameInput.value;
    if (this.profileFormMode === 'new') {
      createProfile(rawName);
      this.closeProfileForm();
      this.ctx.applyActiveProfileToWorld(true);
    } else {
      const active = getActiveProfile();
      renameProfile(active.id, rawName);
      this.closeProfileForm();
      this.refreshProfileSelector();
      this.ctx.showQuickToast(`SPIELER UMBENANNT · ${getActiveProfile().name.toUpperCase()}`);
    }
  }

  private bindProfileAndSettings(): void {
    this.profileSelectEl.addEventListener('change', () => {
      this.closeProfileForm();
      if (setActiveProfile(this.profileSelectEl.value)) {
        this.ctx.applyActiveProfileToWorld(true);
      }
    });
    this.profileNewBtn.addEventListener('click', () => this.openProfileForm('new'));
    this.profileRenameBtn.addEventListener('click', () => this.openProfileForm('rename'));
    this.profileCancelBtn.addEventListener('click', () => this.closeProfileForm());
    this.profileSaveBtn.addEventListener('click', () => this.submitProfileForm());
    this.profileNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitProfileForm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeProfileForm();
      }
    });
    this.profileDeleteBtn.addEventListener('click', () => {
      if (listProfiles().length <= 1) return;
      const active = getActiveProfile();
      if (deleteProfile(active.id)) {
        this.closeProfileForm();
        this.ctx.applyActiveProfileToWorld(true);
        this.ctx.showQuickToast(`PROFIL „${active.name.toUpperCase()}“ GELÖSCHT`);
      }
    });

    this.optSensInput.addEventListener('input', () => {
      this.ctx.applySettings({ ...this.ctx.getSettings(), mouseSensitivity: parseFloat(this.optSensInput.value) });
    });
    this.optInvertYInput.addEventListener('change', () => {
      this.ctx.applySettings({ ...this.ctx.getSettings(), invertMouseY: this.optInvertYInput.checked });
    });
    this.optSfxInput.addEventListener('input', () => {
      this.ctx.applySettings({ ...this.ctx.getSettings(), sfxVolume: parseFloat(this.optSfxInput.value) });
    });
    this.optMusicInput.addEventListener('input', () => {
      this.ctx.applySettings({ ...this.ctx.getSettings(), musicVolume: parseFloat(this.optMusicInput.value) });
    });
    this.optPerfInput.addEventListener('change', () => {
      this.ctx.applySettings({ ...this.ctx.getSettings(), performanceMode: this.optPerfInput.checked });
    });
    this.resetSaveBtn.addEventListener('click', () => {
      clearProgress();
      this.ctx.applyActiveProfileToWorld(true);
      this.ctx.showQuickToast(`SPEICHERSTAND VON „${getActiveProfile().name.toUpperCase()}“ ZURÜCKGESETZT`);
    });
  }
}
