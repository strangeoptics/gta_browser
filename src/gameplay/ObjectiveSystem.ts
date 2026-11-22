import * as THREE from 'three';
import type { NpcEntity, NpcSystem } from '../entities/NpcSystem';
import type { VehicleSystem } from '../vehicles/VehicleSystem';
import type { WantedSystem } from './WantedSystem';

export type ObjectiveKind = 'stash' | 'dropoff' | 'bounty' | 'race' | 'survive' | 'courier';
export type MissionDistrict = 'downtown' | 'west' | 'south' | 'north' | 'east';

export interface MissionContract {
  id: string;
  district: MissionDistrict;
  districtLabel: string;
  kind: ObjectiveKind;
  kindLabel: string;
  title: string;
  briefing: string;
  reward: number;
  heatOnComplete?: number;
  startHeat?: number;
  timerSec?: number;
  spot?: [number, number, number];
  deliverySpot?: [number, number, number];
  checkpoints?: [number, number, number][];
}

export const MISSION_CONTRACTS: MissionContract[] = [
  // --- DOWNTOWN / CORE 3x3 ---
  {
    id: 'neon_stash',
    district: 'downtown',
    districtLabel: 'DOWNTOWN',
    kind: 'stash',
    kindLabel: '📦 KURIER',
    title: 'NEON STASH',
    briefing: 'Sammle den versteckten Kurier-Koffer am Central Plaza / Ocean Drive ein.',
    reward: 500,
    heatOnComplete: 25,
    spot: [2.2, 0.2, 2.5],
  },
  {
    id: 'ocean_sprint',
    district: 'downtown',
    districtLabel: 'DOWNTOWN',
    kind: 'race',
    kindLabel: '⚡ RENNEN',
    title: 'OCEAN DRIVE SPRINT',
    briefing: '42s Zeitrennen durch 4 goldene Checkpoints quer durch das Kernviertel.',
    reward: 1200,
    timerSec: 42,
    checkpoints: [
      [60, 0.1, -48],
      [-20, 0.1, -60],
      [-60, 0.1, 20],
      [20, 0.1, 60],
    ],
  },
  {
    id: 'syndikat_ziel',
    district: 'downtown',
    districtLabel: 'DOWNTOWN',
    kind: 'bounty',
    kindLabel: '🎯 KOPFGELD',
    title: 'SYNDIKAT-ZIEL',
    briefing: 'Schalte den bewaffneten Syndikat-Kurier am Pink-Beacon in Downtown aus.',
    reward: 1000,
    heatOnComplete: 75,
    spot: [-20, 0.2, -20],
  },
  {
    id: 'hot_wheels',
    district: 'downtown',
    districtLabel: 'DOWNTOWN',
    kind: 'dropoff',
    kindLabel: '🚗 LIEFERUNG',
    title: 'HOT WHEELS',
    briefing: 'Schnapp dir ein Fahrzeug [E] und liefere es in der Drop-Zone ab.',
    reward: 800,
    heatOnComplete: 45,
    spot: [60, 0.1, -48],
  },
  {
    id: 'heat_survival',
    district: 'downtown',
    districtLabel: 'DOWNTOWN',
    kind: 'survive',
    kindLabel: '🔥 ÜBERLEBEN',
    title: 'HEAT SURVIVAL',
    briefing: 'Löst sofort 2★-Fahndung aus — überlebe 25s gegen die Vice-PD-Streifenwagen!',
    reward: 1100,
    startHeat: 85,
    timerSec: 25,
  },

  // --- WEST DISTRICT · LITTLE HAVANA ---
  {
    id: 'havana_express',
    district: 'west',
    districtLabel: 'LITTLE HAVANA',
    kind: 'courier',
    kindLabel: '📦 EXPRESS',
    title: 'HAVANA EXPRESS',
    briefing: 'Hol das Paket vor dem Starlight 80s Diner ab und bring es rechtzeitig zur Banco de Vice!',
    reward: 1450,
    heatOnComplete: 35,
    timerSec: 55,
    spot: [-74, 0.2, -4],
    deliverySpot: [-74, 0.2, 40],
  },
  {
    id: 'havana_enforcer',
    district: 'west',
    districtLabel: 'LITTLE HAVANA',
    kind: 'bounty',
    kindLabel: '🎯 KOPFGELD',
    title: 'HAVANA-SCHULDNER',
    briefing: 'Ein Kartell-Eintreiber patrouilliert am West Havana Blvd. Stell ihn!',
    reward: 1600,
    heatOnComplete: 85,
    spot: [-112, 0.2, 12],
  },

  // --- SÜD · VICE PORT INDUSTRIAL DOCKS ---
  {
    id: 'port_slalom',
    district: 'south',
    districtLabel: 'VICE PORT',
    kind: 'race',
    kindLabel: '⚡ RENNEN',
    title: 'DOCK-SLALOM',
    briefing: 'Highspeed-Slalom (48s) durch den Containerhafen bis zum Import/Export-Kai.',
    reward: 1850,
    timerSec: 48,
    checkpoints: [
      [42, 0.1, 76],
      [-12, 0.1, 88],
      [-48, 0.1, 114],
      [46, 0.1, 110],
    ],
  },
  {
    id: 'port_smuggler',
    district: 'south',
    districtLabel: 'VICE PORT',
    kind: 'bounty',
    kindLabel: '🎯 KOPFGELD',
    title: 'CONTAINER-SCHMUGGLER',
    briefing: 'Schalte den bewaffneten Schmuggler-Boss am Südkai vor dem Frachter aus.',
    reward: 1750,
    heatOnComplete: 90,
    spot: [10, 0.2, 116],
  },

  // --- NORD · NORTH POINT (MARINA & CAPE VICE) ---
  {
    id: 'north_hillclimb',
    district: 'north',
    districtLabel: 'NORTH POINT',
    kind: 'race',
    kindLabel: '⚡ BERGRENNEN',
    title: 'CAPE VICE SERPENTINE',
    briefing: '58s Küsten- & Bergrennen über die Serpentinen hinauf zum 26m-Leuchtturm!',
    reward: 2200,
    timerSec: 58,
    checkpoints: [
      [-20, 0.1, -81],
      [48, 0.1, -82],
      [96, 5.2, -104],
      [78, 11.1, -118],
    ],
  },
  {
    id: 'north_marina_drop',
    district: 'north',
    districtLabel: 'NORTH POINT',
    kind: 'stash',
    kindLabel: '📦 KURIER',
    title: 'MARINA-ÜBERGABE',
    briefing: 'Sichere den Schmuggler-Koffer draußen am mittleren Holzsteg der Vice Marina.',
    reward: 1500,
    heatOnComplete: 75,
    spot: [-8, 0.9, -116],
  },

  // --- OST · STARFISH ISLAND & SUPERYACHT ---
  {
    id: 'starfish_turbo',
    district: 'east',
    districtLabel: 'STARFISH ISLAND',
    kind: 'race',
    kindLabel: '⚡ RENNEN',
    title: 'CAUSEWAY TURBO',
    briefing: '45s Sonnenuntergangs-Sprint über die Neon-Brücke bis zum Starfish-Helipad!',
    reward: 1950,
    timerSec: 45,
    checkpoints: [
      [60, 0.1, -60],
      [107, 3.0, -60],
      [166, 0.7, -48],
      [162, 0.75, -74],
    ],
  },
  {
    id: 'starfish_baron',
    district: 'east',
    districtLabel: 'STARFISH ISLAND',
    kind: 'bounty',
    kindLabel: '🎯 KOPFGELD',
    title: 'KARTELL-BARON',
    briefing: 'Eliminiere den schwer bewachten Kartell-Baron vor dem Starfish Estate (3★ Risiko!).',
    reward: 2400,
    heatOnComplete: 130,
    spot: [170, 0.72, -55],
  },
];

export interface ActiveObjective {
  id: string;
  district: MissionDistrict;
  kind: ObjectiveKind;
  title: string;
  description: string;
  reward: number;
  heatOnComplete: number;
  targetPos: THREE.Vector3;
  deliveryPos?: THREE.Vector3;
  courierPickedUp?: boolean;
  bountyNpc?: NpcEntity;
  timerSec?: number;
  checkpoints?: THREE.Vector3[];
  checkpointIndex?: number;
}

export interface ObjectiveHudState {
  activeId: string | null;
  title: string;
  description: string;
  distanceM: number;
  timerText: string | null;
  cash: number;
  completedCount: number;
  toastText: string | null;
}

const STASH_SPOTS = [
  new THREE.Vector3(2.2, 0.2, 2.5),
  new THREE.Vector3(-40, 0.2, -27),
  new THREE.Vector3(40, 0.2, -27),
  new THREE.Vector3(69.5, 0.25, -36),
  new THREE.Vector3(-27, 0.2, 40),
];

const DROPOFF_SPOTS = [
  new THREE.Vector3(60, 0.1, -48),
  new THREE.Vector3(-60, 0.1, 48),
  new THREE.Vector3(60, 0.1, 48),
  new THREE.Vector3(-20, 0.1, -56),
];

const BOUNTY_SPOTS = [
  new THREE.Vector3(-20, 0.2, -20),
  new THREE.Vector3(20, 0.2, -40),
  new THREE.Vector3(-40, 0.2, 20),
  new THREE.Vector3(40, 0.2, 40),
];

/**
 * Manages selectable Vice-Phone / Auftragsboard contracts across all 5 districts
 * (Downtown + Little Havana, Vice Port, North Point & Starfish Island) as well as
 * automatic rotating street objectives.
 */
export class ObjectiveSystem {
  public current: ActiveObjective | null = null;
  public cash = 0;
  public completedCount = 0;
  public onCheckpointReached?: () => void;

  private readonly scene: THREE.Scene;
  private readonly beaconGroup = new THREE.Group();
  private readonly beaconBeam: THREE.Mesh;
  private readonly beaconRing: THREE.Mesh;
  private readonly stashProp: THREE.Mesh;
  private readonly completedIds = new Set<string>();

  private nextObjectiveTimer = 0;
  private toastText: string | null = null;
  private toastTimer = 0;
  private cycleIndex = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const beamMat = new THREE.MeshBasicMaterial({
      color: '#36f1e6',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.15, 28, 14, 1, true), beamMat);
    this.beaconBeam.position.y = 14;
    this.beaconGroup.add(this.beaconBeam);

    const ringMat = new THREE.MeshBasicMaterial({ color: '#36f1e6', side: THREE.DoubleSide });
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.55, 24), ringMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.24;
    this.beaconGroup.add(this.beaconRing);

    const stashMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    this.stashProp = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.3), stashMat);
    this.stashProp.position.y = 1.05;
    this.beaconGroup.add(this.stashProp);

    this.scene.add(this.beaconGroup);
  }

  public getCompletedIds(): string[] {
    return Array.from(this.completedIds);
  }

  public setCompletedIds(ids: string[]): void {
    this.completedIds.clear();
    for (const id of ids) this.completedIds.add(id);
  }

  public isContractCompleted(id: string): boolean {
    return this.completedIds.has(id);
  }

  public cancelActiveObjective(): void {
    this.current = null;
    this.beaconGroup.visible = false;
    this.nextObjectiveTimer = 999999; // stay idle until user accepts a job or triggers next
  }

  public startContract(id: string, npcs: NpcSystem, wanted?: WantedSystem): boolean {
    const c = MISSION_CONTRACTS.find((m) => m.id === id);
    if (!c) return false;

    this.nextObjectiveTimer = 0;

    if (c.kind === 'stash') {
      const spot =
        c.id === 'neon_stash'
          ? STASH_SPOTS[Math.floor(Math.random() * STASH_SPOTS.length)].clone()
          : new THREE.Vector3(...(c.spot ?? [0, 0.2, 0]));
      this.current = {
        id: c.id,
        district: c.district,
        kind: 'stash',
        title: c.title,
        description: c.briefing,
        reward: c.reward,
        heatOnComplete: c.heatOnComplete ?? 25,
        targetPos: spot,
      };
      this.setBeaconColor('#36f1e6');
      this.stashProp.visible = true;
      this.beaconGroup.visible = true;
    } else if (c.kind === 'courier') {
      const pickup = new THREE.Vector3(...(c.spot ?? [-74, 0.2, -4]));
      const delivery = new THREE.Vector3(...(c.deliverySpot ?? [-74, 0.2, 40]));
      this.current = {
        id: c.id,
        district: c.district,
        kind: 'courier',
        title: c.title,
        description: 'Phase 1/2: Hol das Paket am Cyan-Beacon ab!',
        reward: c.reward,
        heatOnComplete: c.heatOnComplete ?? 35,
        targetPos: pickup,
        deliveryPos: delivery,
        courierPickedUp: false,
        timerSec: c.timerSec ?? 55,
      };
      this.setBeaconColor('#36f1e6');
      this.stashProp.visible = true;
      this.beaconGroup.visible = true;
    } else if (c.kind === 'race' && c.checkpoints && c.checkpoints.length > 0) {
      const route = c.checkpoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      this.current = {
        id: c.id,
        district: c.district,
        kind: 'race',
        title: c.title,
        description: `Checkpoint 1/${route.length} — Durchfahre alle Gold-Beacons!`,
        reward: c.reward,
        heatOnComplete: c.heatOnComplete ?? 0,
        targetPos: route[0].clone(),
        checkpoints: route,
        checkpointIndex: 0,
        timerSec: c.timerSec ?? 45,
      };
      this.setBeaconColor('#ffbe3b');
      this.stashProp.visible = false;
      this.beaconGroup.visible = true;
    } else if (c.kind === 'bounty') {
      const spot =
        c.id === 'syndikat_ziel'
          ? BOUNTY_SPOTS[Math.floor(Math.random() * BOUNTY_SPOTS.length)].clone()
          : new THREE.Vector3(...(c.spot ?? [0, 0.2, 0]));
      const boss = npcs.spawnBountyTarget(spot.x, spot.z, spot.y);
      this.current = {
        id: c.id,
        district: c.district,
        kind: 'bounty',
        title: c.title,
        description: c.briefing,
        reward: c.reward,
        heatOnComplete: c.heatOnComplete ?? 75,
        targetPos: boss.position.clone(),
        bountyNpc: boss,
      };
      this.setBeaconColor('#ff4fa3');
      this.stashProp.visible = false;
      this.beaconGroup.visible = true;
    } else if (c.kind === 'dropoff') {
      const spot =
        c.id === 'hot_wheels'
          ? DROPOFF_SPOTS[Math.floor(Math.random() * DROPOFF_SPOTS.length)].clone()
          : new THREE.Vector3(...(c.spot ?? [60, 0.1, -48]));
      this.current = {
        id: c.id,
        district: c.district,
        kind: 'dropoff',
        title: c.title,
        description: c.briefing,
        reward: c.reward,
        heatOnComplete: c.heatOnComplete ?? 45,
        targetPos: spot,
      };
      this.setBeaconColor('#ff9f43');
      this.stashProp.visible = false;
      this.beaconGroup.visible = true;
    } else {
      wanted?.addHeat(c.startHeat ?? 85);
      this.current = {
        id: c.id,
        district: c.district,
        kind: 'survive',
        title: c.title,
        description: c.briefing,
        reward: c.reward,
        heatOnComplete: 0,
        targetPos: new THREE.Vector3(0, 0, 0),
        timerSec: c.timerSec ?? 25,
      };
      this.stashProp.visible = false;
      this.beaconGroup.visible = false;
    }

    return true;
  }

  public startNextObjective(npcs: NpcSystem, wanted?: WantedSystem): void {
    const coreIds = ['neon_stash', 'ocean_sprint', 'syndikat_ziel', 'hot_wheels', 'heat_survival'];
    const id = coreIds[this.cycleIndex % coreIds.length];
    this.cycleIndex++;
    this.startContract(id, npcs, wanted);
  }

  private setBeaconColor(hex: string): void {
    (this.beaconBeam.material as THREE.MeshBasicMaterial).color.set(hex);
    (this.beaconRing.material as THREE.MeshBasicMaterial).color.set(hex);
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    vehicles: VehicleSystem,
    npcs: NpcSystem,
    wanted: WantedSystem,
    inAnyGroundRide = false,
  ): ObjectiveHudState {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText = null;
    }

    if (!this.current) {
      this.beaconGroup.visible = false;
      this.nextObjectiveTimer -= dt;
      if (this.nextObjectiveTimer <= 0) {
        this.startNextObjective(npcs, wanted);
      }
      return {
        activeId: null,
        title: 'KEIN AKTIVER AUFTRAG',
        description: 'Drücke [J] für das Missions-Telefon & neue Bezirks-Aufträge!',
        distanceM: 0,
        timerText: null,
        cash: this.cash,
        completedCount: this.completedCount,
        toastText: this.toastText,
      };
    }

    if (this.current.kind === 'bounty' && this.current.bountyNpc) {
      this.current.targetPos.copy(this.current.bountyNpc.position);
    }

    if (this.current.kind !== 'survive') {
      this.beaconGroup.visible = true;
      this.beaconGroup.position.set(
        this.current.targetPos.x,
        Math.max(0, this.current.targetPos.y - 0.12),
        this.current.targetPos.z,
      );
      this.stashProp.rotation.y = elapsed * 2.2;
      this.stashProp.position.y = 1.05 + Math.sin(elapsed * 3.0) * 0.16;
      const pulse = 1 + Math.sin(elapsed * 4.0) * 0.1;
      this.beaconRing.scale.set(pulse, pulse, 1);
    } else {
      this.beaconGroup.visible = false;
    }

    const dist =
      this.current.kind === 'survive'
        ? 0
        : Math.hypot(playerPos.x - this.current.targetPos.x, playerPos.z - this.current.targetPos.z);

    let completed = false;
    let failed = false;

    if (this.current.kind === 'stash' && dist < 2.8) {
      completed = true;
      if (this.current.heatOnComplete > 0) wanted.addHeat(this.current.heatOnComplete);
    } else if (this.current.kind === 'courier') {
      this.current.timerSec = Math.max(0, (this.current.timerSec ?? 0) - dt);
      if (this.current.timerSec <= 0) {
        failed = true;
      } else if (!this.current.courierPickedUp && dist < 3.4) {
        this.current.courierPickedUp = true;
        this.onCheckpointReached?.();
        if (this.current.deliveryPos) {
          this.current.targetPos.copy(this.current.deliveryPos);
        }
        this.current.description = 'Phase 2/2: Liefere das Paket schnell an der Gold-Zone ab!';
        this.setBeaconColor('#ff9f43');
        this.stashProp.visible = false;
        this.toastText = 'PAKET AUFGENOMMEN · AB ZUR LIEFERZONE!';
        this.toastTimer = 2.4;
      } else if (this.current.courierPickedUp && dist < 4.5) {
        completed = true;
        if (this.current.heatOnComplete > 0) wanted.addHeat(this.current.heatOnComplete);
      }
    } else if (this.current.kind === 'dropoff' && (vehicles.isInVehicle() || inAnyGroundRide) && dist < 4.8) {
      completed = true;
      if (this.current.heatOnComplete > 0) wanted.addHeat(this.current.heatOnComplete);
    } else if (this.current.kind === 'bounty' && this.current.bountyNpc && !this.current.bountyNpc.alive) {
      completed = true;
      if (this.current.heatOnComplete > 0) wanted.addHeat(this.current.heatOnComplete);
    } else if (this.current.kind === 'race' && this.current.checkpoints) {
      this.current.timerSec = Math.max(0, (this.current.timerSec ?? 0) - dt);
      if (this.current.timerSec <= 0) {
        failed = true;
      } else if (dist < 6.8) {
        const nextIdx = (this.current.checkpointIndex ?? 0) + 1;
        this.onCheckpointReached?.();
        if (nextIdx >= this.current.checkpoints.length) {
          completed = true;
        } else {
          this.current.checkpointIndex = nextIdx;
          this.current.targetPos.copy(this.current.checkpoints[nextIdx]);
          this.current.description = `Checkpoint ${nextIdx + 1}/${this.current.checkpoints.length} — Weiter zum Gold-Beacon!`;
        }
      }
    } else if (this.current.kind === 'survive') {
      this.current.timerSec = Math.max(0, (this.current.timerSec ?? 0) - dt);
      if (this.current.timerSec <= 0) {
        completed = true;
        wanted.reset();
      }
    }

    if (completed) {
      this.cash += this.current.reward;
      this.completedCount++;
      this.completedIds.add(this.current.id);
      this.toastText = `${this.current.title} ERFÜLLT · +$${this.current.reward.toLocaleString('en-US')}`;
      this.toastTimer = 3.2;
      this.current = null;
      this.nextObjectiveTimer = 4.2;
      this.beaconGroup.visible = false;
    } else if (failed) {
      this.toastText = 'ZEIT ABGELAUFEN · [J] FÜR NEUEN AUFTRAG';
      this.toastTimer = 2.8;
      this.current = null;
      this.nextObjectiveTimer = 5.0;
      this.beaconGroup.visible = false;
    }

    const timerText =
      this.current?.timerSec !== undefined ? `${Math.ceil(this.current.timerSec)}s` : null;

    return {
      activeId: this.current?.id ?? null,
      title: this.current?.title ?? 'ZIEL ERFÜLLT!',
      description: this.current?.description ?? '',
      distanceM: Math.round(dist),
      timerText,
      cash: this.cash,
      completedCount: this.completedCount,
      toastText: this.toastText,
    };
  }
}
