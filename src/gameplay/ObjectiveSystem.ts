import * as THREE from 'three';
import type { NpcEntity, NpcSystem } from '../entities/NpcSystem';
import type { VehicleSystem } from '../vehicles/VehicleSystem';
import type { WantedSystem } from './WantedSystem';

export type ObjectiveKind = 'stash' | 'dropoff' | 'bounty';

export interface ActiveObjective {
  kind: ObjectiveKind;
  title: string;
  description: string;
  reward: number;
  targetPos: THREE.Vector3;
  bountyNpc?: NpcEntity;
}

export interface ObjectiveHudState {
  title: string;
  description: string;
  distanceM: number;
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
 * Rotating bite-sized GTA street objectives with a glowing 3D beacon pillar
 * so the player always has a clear, quick goal across the 3x3 Miami district.
 */
export class ObjectiveSystem {
  public current: ActiveObjective | null = null;
  public cash = 0;
  public completedCount = 0;

  private readonly scene: THREE.Scene;
  private readonly beaconGroup = new THREE.Group();
  private readonly beaconBeam: THREE.Mesh;
  private readonly beaconRing: THREE.Mesh;
  private readonly stashProp: THREE.Mesh;

  private nextObjectiveTimer = 0;
  private toastText: string | null = null;
  private toastTimer = 0;
  private cycleIndex = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Translucent glowing beacon pillar visible over rooftops
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

    // Floating neon briefcase for Stash missions
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

  public startNextObjective(npcs: NpcSystem): void {
    const mod = this.cycleIndex % 3;
    this.cycleIndex++;

    if (mod === 0) {
      const spot = STASH_SPOTS[Math.floor(Math.random() * STASH_SPOTS.length)].clone();
      this.current = {
        kind: 'stash',
        title: 'NEON STASH',
        description: 'Sammle den leuchtenden Kurier-Koffer am Cyan-Beacon ein.',
        reward: 500,
        targetPos: spot,
      };
      this.setBeaconColor('#36f1e6');
      this.stashProp.visible = true;
    } else if (mod === 1) {
      const spot = DROPOFF_SPOTS[Math.floor(Math.random() * DROPOFF_SPOTS.length)].clone();
      this.current = {
        kind: 'dropoff',
        title: 'HOT WHEELS',
        description: 'Schnapp dir ein Auto [E] und fahr in die Ocean-Drop-Zone.',
        reward: 800,
        targetPos: spot,
      };
      this.setBeaconColor('#ff9f43');
      this.stashProp.visible = false;
    } else {
      const spot = BOUNTY_SPOTS[Math.floor(Math.random() * BOUNTY_SPOTS.length)].clone();
      const boss = npcs.spawnBountyTarget(spot.x, spot.z);
      this.current = {
        kind: 'bounty',
        title: 'SYNDIKAT-ZIEL',
        description: 'Schalte den markierten Kurier am Pink-Beacon aus.',
        reward: 1000,
        targetPos: boss.position,
        bountyNpc: boss,
      };
      this.setBeaconColor('#ff4fa3');
      this.stashProp.visible = false;
    }

    this.beaconGroup.visible = true;
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
  ): ObjectiveHudState {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText = null;
    }

    if (!this.current) {
      this.beaconGroup.visible = false;
      this.nextObjectiveTimer -= dt;
      if (this.nextObjectiveTimer <= 0) {
        this.startNextObjective(npcs);
      }
      return {
        title: 'NEUES ZIEL FOLGT…',
        description: 'Erkunde das Viertel oder schüttle die Polizei ab.',
        distanceM: 0,
        cash: this.cash,
        completedCount: this.completedCount,
        toastText: this.toastText,
      };
    }

    // Track moving bounty NPC
    if (this.current.kind === 'bounty' && this.current.bountyNpc) {
      this.current.targetPos.copy(this.current.bountyNpc.position);
    }

    this.beaconGroup.position.set(this.current.targetPos.x, 0, this.current.targetPos.z);
    this.stashProp.rotation.y = elapsed * 2.2;
    this.stashProp.position.y = 1.05 + Math.sin(elapsed * 3.0) * 0.16;
    const pulse = 1 + Math.sin(elapsed * 4.0) * 0.1;
    this.beaconRing.scale.set(pulse, pulse, 1);

    const dist = Math.hypot(
      playerPos.x - this.current.targetPos.x,
      playerPos.z - this.current.targetPos.z,
    );

    // Check completion conditions
    let completed = false;
    if (this.current.kind === 'stash' && dist < 2.6) {
      completed = true;
      wanted.addHeat(25);
    } else if (this.current.kind === 'dropoff' && vehicles.isInVehicle() && dist < 4.8) {
      completed = true;
      wanted.addHeat(45);
    } else if (this.current.kind === 'bounty' && this.current.bountyNpc && !this.current.bountyNpc.alive) {
      completed = true;
      wanted.addHeat(75);
    }

    if (completed) {
      this.cash += this.current.reward;
      this.completedCount++;
      this.toastText = `ZIEL ERFÜLLT · +$${this.current.reward}`;
      this.toastTimer = 3.2;
      this.current = null;
      this.nextObjectiveTimer = 3.5;
      this.beaconGroup.visible = false;
    }

    return {
      title: this.current?.title ?? 'ZIEL ERFÜLLT!',
      description: this.current?.description ?? '',
      distanceM: Math.round(dist),
      cash: this.cash,
      completedCount: this.completedCount,
      toastText: this.toastText,
    };
  }
}
