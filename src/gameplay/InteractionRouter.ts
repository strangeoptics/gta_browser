import * as THREE from 'three';
import type { AudioEngine } from '../audio/AudioEngine';
import type { WeaponSystem } from '../combat/WeaponSystem';
import type { HelicopterSystem } from '../entities/HelicopterSystem';
import type { NpcSystem } from '../entities/NpcSystem';
import type { SafehousePets } from '../entities/SafehousePets';
import type { LowriderBattleSystem } from './LowriderBattleSystem';
import type { ObjectiveSystem } from './ObjectiveSystem';
import type { RooftopPartySystem } from './RooftopPartySystem';
import { PARAMEDIC_MAX_HP_RESCUES_REQUIRED, type SpecialVehicleMissionSystem } from './SpecialVehicleMissions';
import type { VigilanteSystem } from './VigilanteSystem';
import type { WantedSystem } from './WantedSystem';
import type { PlayerAvatar } from '../player/PlayerAvatar';
import type { PlayerController } from '../player/PlayerController';
import type { GarageRidesSystem } from '../vehicles/GarageRidesSystem';
import type { VehicleSystem } from '../vehicles/VehicleSystem';
import type { MiamiWorld } from '../world/CityBuilder';
import { WORLD_LANDMARKS } from '../world/CityLayout';

export interface InteractionContext {
  camera: THREE.PerspectiveCamera;
  player: PlayerController;
  playerAvatar: PlayerAvatar;
  world: MiamiWorld;
  weapons: WeaponSystem;
  vehicles: VehicleSystem;
  garageRides: GarageRidesSystem;
  npcs: NpcSystem;
  heli: HelicopterSystem;
  pets: SafehousePets;
  wanted: WantedSystem;
  objectives: ObjectiveSystem;
  rooftopParty: RooftopPartySystem;
  vigilante: VigilanteSystem;
  specialMissions: SpecialVehicleMissionSystem;
  lowriderBattle: LowriderBattleSystem;
  audio: AudioEngine;
  getPlayerHp: () => number;
  setPlayerHp: (hp: number) => void;
  getPlayerMaxHp: () => number;
  getPlayerArmor: () => number;
  setPlayerArmor: (armor: number) => void;
  getCocktailScore: () => number;
  setCocktailScore: (score: number) => void;
  setCarryingSnack: (name: string, durationSec: number) => void;
  onMissionCompletedIncrement: () => void;
  tryUsePayNSpray: () => void;
  tryInteractLookedObject: () => boolean;
  togglePetShop: () => void;
  persistProgress: () => void;
  showQuickToast: (text: string) => void;
  sendPoliceDispatch: (msg: string, force?: boolean) => void;
}

/**
 * Handles [G] special-vehicle / K.I.T.T. / DeLorean / Ice Cream / Hydraulics / Rooftop Party actions.
 */
export function handleSpecialActionKeyG(ctx: InteractionContext): void {
  const {
    garageRides,
    vehicles,
    world,
    objectives,
    rooftopParty,
    vigilante,
    specialMissions,
    npcs,
    player,
    audio,
    showQuickToast,
    sendPoliceDispatch,
    persistProgress,
  } = ctx;

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
      const nearPd =
        Math.hypot(
          car.position.x - WORLD_LANDMARKS.VICE_PD_PRECINCT.x,
          car.position.z - WORLD_LANDMARKS.VICE_PD_PRECINCT.z,
        ) < 38;
      showQuickToast(
        nearPd
          ? "CHERRY POPPER '86 · JINGLE AN! VICE PD COPS RENNEN FÜR DONUTS RAUS!"
          : "CHERRY POPPER '86 · 8-BIT JINGLE AN! PASSANTEN & COPS KOMMEN ANGELAUFEN!",
      );
      if (nearPd) {
        sendPoliceDispatch(
          'Alle Einheiten am Precinct 06: Gratis-Donuts vor der Tür! Verfolgung kurzzeitig unterbrochen!',
          true,
        );
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
}

/**
 * Handles [F] contextual interactions (garages, tuning, Lowrider arena, heist vaults, bars, shops, interiors).
 */
export function handleInteractKeyF(ctx: InteractionContext): void {
  const {
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
    lowriderBattle,
    audio,
    persistProgress,
    showQuickToast,
    sendPoliceDispatch,
  } = ctx;

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
        ctx.onMissionCompletedIncrement();
        audio.playMissionPassed();
        persistProgress();
        const exitPos = vehicles.exitVehicle();
        if (exitPos) {
          player.setSpawn(46.5, 0.25, 92, Math.PI / 2);
          weapons.setEnabled(true);
        }
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
      ctx.tryUsePayNSpray();
    }
    return;
  }

  if (ctx.tryInteractLookedObject()) return;

  const pos = player.position;
  const maxHp = ctx.getPlayerMaxHp();

  if (world.isNearPetShop(pos)) {
    ctx.togglePetShop();
  } else if (world.isNearSafehouseWardrobe(pos)) {
    const outfitName = playerAvatar.nextOutfit();
    audio.playPurchase();
    persistProgress();
    showQuickToast(`OUTFIT · ${outfitName}`);
  } else if (rooftopParty.isNearTributeCash(pos)) {
    const bonus = rooftopParty.claimTributeCash();
    if (bonus > 0) {
      objectives.cash += bonus;
      audio.playMissionPassed();
      persistProgress();
      showQuickToast(`CREW-UMSCHLAG EINGESAMMELT · +$${bonus}`);
    }
  } else if (world.isNearSafehouseRooftopBar(pos)) {
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
      const prevHp = ctx.getPlayerHp();
      const nextHp = Math.min(maxHp, prevHp + 30);
      ctx.setPlayerHp(nextHp);
      const gained = Math.round(nextHp - prevHp);
      const nextCocktail = Math.min(6.0, ctx.getCocktailScore() + 1.25);
      ctx.setCocktailScore(nextCocktail);
      const rawLevel = THREE.MathUtils.clamp((nextCocktail - 1.0) / 3.8, 0, 1);
      audio.playPurchase();
      const hpNote = gained > 0 ? ` · +${gained} HP` : '';
      const buzz =
        rawLevel < 0.32 ? 'LEICHT ANGESCHWIPST 🍹' : rawLevel < 0.7 ? 'BETRUNKEN! 🍹' : 'VOLLRAUSCH! 🍹';
      if (rooftopParty.isActive()) {
        ctx.setPlayerArmor(Math.min(100, ctx.getPlayerArmor() + 35));
        weapons.refillAllAmmo();
        persistProgress();
        showQuickToast(`PARTY-COCKTAIL${hpNote} · +35% ARMOR & MUNI VOLL · ${buzz}`);
      } else {
        showQuickToast(`DACH-BAR · MIAMI VICE COCKTAIL${hpNote} · ${buzz}`);
      }
    }
  } else if (rooftopParty.getNearbyGuest(pos)) {
    const quip = rooftopParty.talkToNearbyGuest(pos, pets.ownsPet('elvis'));
    if (quip) {
      audio.playCheckpoint();
      showQuickToast(quip);
    }
  } else if (world.isNearSafehouseFridge(pos)) {
    const prevHp = ctx.getPlayerHp();
    const nextHp = Math.min(maxHp, prevHp + 25);
    ctx.setPlayerHp(nextHp);
    const gained = Math.round(nextHp - prevHp);
    audio.playEatCrunch();
    showQuickToast(gained > 0 ? `KÜHLSCHRANK-SNACK · +${gained} HP` : 'KÜHLSCHRANK-SNACK · LECKER!');
  } else if (world.isNearSafehouseLounge(pos)) {
    ctx.setPlayerHp(maxHp);
    weapons.refillAllAmmo();
    if (wanted.stars <= 2) {
      wanted.reset();
      npcs.clearPolice();
    }
    audio.playPurchase();
    persistProgress();
    showQuickToast(`SAFEHOUSE · ${maxHp} HP, MUNITION VOLL & GESPEICHERT`);
  } else if (world.isNearPdDesk(pos) && wanted.stars >= 1) {
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
  } else if (world.isNearPdEvidenceCash(pos)) {
    world.takePdEvidenceCash();
    objectives.cash += 1500;
    world.triggerPdAlarm();
    wanted.addHeat(105);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast('ASSERVATEN-RAUB · +$1.500 — 3★ GROẞFAHNDUNG!');
    sendPoliceDispatch('CODE 3! Syndikat-Geldkoffer aus Precinct 06 gestohlen — Großfahndung!', true);
  } else if (world.isNearPdKevlar(pos)) {
    world.takePdKevlar();
    ctx.setPlayerArmor(100);
    world.triggerPdAlarm();
    wanted.addHeat(55);
    audio.playPurchase();
    persistProgress();
    showQuickToast('ASSERVATENKAMMER · KEVLAR-WESTE (100%) — ALARM AUSGELÖST!');
    sendPoliceDispatch('Code 2! Einbruch in die Asservatenkammer von Precinct 06!', true);
  } else if (world.isNearPdArmory(pos)) {
    weapons.refillAllAmmo();
    weapons.switchWeapon(3);
    world.triggerPdAlarm();
    wanted.addHeat(55);
    audio.playPurchase();
    showQuickToast('WAFFENKAMMER · SHOTGUN & MUNITION GEKLAUT — ALARM!');
    sendPoliceDispatch('Waffenkammer-Alarm in Precinct 06! Alle Einheiten ausrücken!', true);
  } else if (world.isNearPdUniform(pos)) {
    const outfitName = playerAvatar.setOutfit(4);
    audio.playPurchase();
    persistProgress();
    showQuickToast(`SPIND · ${outfitName} ANGEZOGEN`);
  } else if (world.isNearIslandVault(pos)) {
    world.takeIslandVault();
    npcs.alertEstateGuards();
    objectives.cash += 2500;
    wanted.addHeat(110);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast('STARFISH ESTATE TRESOR · +$2.500 GOLD — 3★ ALARM!');
    sendPoliceDispatch('CODE 3 auf Starfish Island! Kartell-Anwesen ausgeraubt!', true);
  } else if (world.isNearYachtLoot(pos)) {
    world.takeYachtLoot();
    npcs.alertEstateGuards();
    objectives.cash += 1800;
    wanted.addHeat(85);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast('SUPERYACHT „LADY VICE“ · +$1.800 KAPITÄNS-GOLD!');
    sendPoliceDispatch('Alarm auf der Superyacht Lady Vice! Küstenwache & Einheiten ausrücken!', true);
  } else if (world.isNearDinerCounter(pos)) {
    const mealCost = 40;
    if (objectives.cash >= mealCost) {
      objectives.cash -= mealCost;
      ctx.setPlayerHp(maxHp);
      audio.playEatCrunch();
      persistProgress();
      ctx.setCarryingSnack('CUBAN BURGER', 50.0);
      showQuickToast(`STARLIGHT DINER · CUBAN BURGER & SHAKE (${maxHp} HP · -$40)`);
    } else {
      showQuickToast(`STARLIGHT DINER · ZU WENIG CASH (BENÖTIGT $${mealCost})`);
    }
  } else if (world.isNearBankVault(pos)) {
    world.takeBankVault();
    objectives.cash += 3000;
    wanted.addHeat(165);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast('BANCO DE VICE TRESOR GEKNACKT · +$3.000 — 4★ GROẞFAHNDUNG!');
    sendPoliceDispatch('CODE 3! Bewaffneter Banküberfall in der Banco de Vice (Little Havana)!', true);
  } else if (world.isNearMarinaLoot(pos)) {
    world.takeMarinaLoot();
    objectives.cash += 2000;
    wanted.addHeat(75);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast('VICE MARINA · SCHMUGGLER-KOFFER GEKLAUT (+$2.000 · ⚠ 2★)');
    sendPoliceDispatch('Schmuggler-Alarm an der Vice Marina! Küstenwache & Streifen ausrücken!', true);
  } else if (world.isNearLighthouseSpot(pos)) {
    const firstDiscovery = world.claimLighthouseBonus();
    ctx.setPlayerHp(maxHp);
    if (firstDiscovery) {
      objectives.cash += 1000;
      audio.playMissionPassed();
      persistProgress();
      showQuickToast(`CAPE VICE LEUCHTTURM ENTDECKT! · +$1.000 & ${maxHp} HP`);
    } else {
      audio.playPurchase();
      showQuickToast(`CAPE VICE AUSSICHT · FRISCHE MEERESLUFT (${maxHp} HP)`);
    }
  } else if (world.isNearAirfieldLoot(pos)) {
    world.takeAirfieldLoot();
    objectives.cash += 2800;
    wanted.addHeat(115);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast('HANGAR 06 · SCHMUGGLER-FRACHT GEKLAUT (+$2.800 · ⚠ 3★ ALARM)');
    sendPoliceDispatch('CODE 3 am Vice International Airfield! Hangar 06 wurde überfallen!', true);
  } else if (world.isNearAirfieldCafe(pos)) {
    const cafeCost = 35;
    if (objectives.cash >= cafeCost) {
      objectives.cash -= cafeCost;
      ctx.setPlayerHp(maxHp);
      audio.playEatCrunch();
      persistProgress();
      ctx.setCarryingSnack('AIRPORT ESPRESSO', 40.0);
      showQuickToast(`TERMINAL 1 CAFÉ · CUBAN ESPRESSO & SNACK (${maxHp} HP · -$35)`);
    } else {
      showQuickToast(`TERMINAL 1 CAFÉ · ZU WENIG CASH (BENÖTIGT $${cafeCost})`);
    }
  } else if (world.isNearSmugglersLoot(pos)) {
    world.takeSmugglersLoot();
    objectives.cash += 3500;
    wanted.addHeat(120);
    audio.playMissionPassed();
    persistProgress();
    showQuickToast("SMUGGLER'S CAY · SCHMUGGLER-SCHATZ GEKLAUT (+$3.500 · ⚠ 3★ ALARM)");
    sendPoliceDispatch("CODE 3 auf Smuggler's Cay! Kartell-Versteck geplündert — Küstenwache & Air-One ausrücken!", true);
  } else if (world.isNearSmugglersBar(pos)) {
    const rumCost = 45;
    if (objectives.cash >= rumCost) {
      objectives.cash -= rumCost;
      ctx.setPlayerHp(maxHp);
      ctx.setCocktailScore(Math.min(6.0, ctx.getCocktailScore() + 1.0));
      audio.playPurchase();
      persistProgress();
      showQuickToast(`CAYO TIKI BAR · COCONUT RUM (${maxHp} HP · -$45 · 🍹)`);
    } else {
      showQuickToast(`CAYO TIKI BAR · ZU WENIG CASH (BENÖTIGT $${rumCost})`);
    }
  } else if (world.isNearClubBar(pos)) {
    if (objectives.cash >= 50) {
      objectives.cash -= 50;
      const prevHp = ctx.getPlayerHp();
      const nextHp = Math.min(maxHp, prevHp + 30);
      ctx.setPlayerHp(nextHp);
      const gained = Math.round(nextHp - prevHp);
      const nextCocktail = Math.min(6.0, ctx.getCocktailScore() + 1.0);
      ctx.setCocktailScore(nextCocktail);
      const rawLevel = THREE.MathUtils.clamp((nextCocktail - 1.0) / 4.5, 0, 1);
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
}
