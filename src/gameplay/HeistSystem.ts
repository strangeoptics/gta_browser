import * as THREE from 'three';
import type { NpcEntity, NpcSystem } from '../entities/NpcSystem';
import type { VehicleSystem } from '../vehicles/VehicleSystem';
import type { BoatSystem } from '../vehicles/BoatSystem';
import type { WantedSystem } from './WantedSystem';

export type HeistStage = 'idle' | 'stage_car' | 'clear_vault' | 'ocean_escape';

export interface HeistHudState {
  active: boolean;
  stage: HeistStage;
  title: string;
  description: string;
  distanceM: number;
  targetPos: THREE.Vector3 | null;
  nearStartMarker: boolean;
  justCompleted: boolean;
  stageToast: string | null;
}

/**
 * 3-Stage Story Mini-Heist: "OCEAN CLUB FINALE" (+$3,500)
 * 1) Park any getaway car in the Ocean Club staging zone (60, -26)
 * 2) Eliminate 3 Syndicate guards & grab the golden vault briefcase on the Ocean Drive Terrace (69.2, 5.2, -20.5)
 * 3) Escape 4-star heat + Vice PD Helicopter by boarding the Stinger Speedboat and reaching the ocean buoy (168, -28)
 */
export class HeistSystem {
  public stage: HeistStage = 'idle';
  public readonly startPos = new THREE.Vector3(60, 0.1, -26);
  public readonly reward = 3500;

  private readonly vaultPos = new THREE.Vector3(69.2, 5.1, -20.5);
  private readonly escapePos = new THREE.Vector3(168, 0.2, -28);

  private readonly scene: THREE.Scene;
  private readonly beaconGroup = new THREE.Group();
  private readonly beam: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly vaultCase: THREE.Mesh;

  private guards: NpcEntity[] = [];
  private pendingToast: string | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const beamMat = new THREE.MeshBasicMaterial({
      color: '#ffd15c',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 34, 16, 1, true), beamMat);
    this.beam.position.y = 17;
    this.beaconGroup.add(this.beam);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.1, 2.6, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd15c', side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.22;
    this.beaconGroup.add(this.ring);

    // Golden syndicate vault briefcase
    this.vaultCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.55, 0.36),
      new THREE.MeshStandardMaterial({
        color: '#ffd15c',
        emissive: '#ffaa22',
        emissiveIntensity: 2.2,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    this.vaultCase.position.y = 1.1;
    this.vaultCase.visible = false;
    this.beaconGroup.add(this.vaultCase);

    this.beaconGroup.position.copy(this.startPos);
    this.scene.add(this.beaconGroup);
  }

  public isActive(): boolean {
    return this.stage !== 'idle';
  }

  public startHeist(): void {
    if (this.stage !== 'idle') return;
    this.stage = 'stage_car';
    this.guards = [];
    this.vaultCase.visible = false;
    this.setBeaconColor('#ffd15c');
    this.pendingToast = 'HEIST GESTARTET · STELL EIN AUTO AM OCEAN CLUB AB';
  }

  public failHeist(npcs?: NpcSystem): void {
    if (this.stage === 'idle') return;
    if (npcs) {
      for (const g of this.guards) npcs.removeNpc(g);
    }
    this.stage = 'idle';
    this.guards = [];
    this.vaultCase.visible = false;
    this.beaconGroup.position.copy(this.startPos);
    this.setBeaconColor('#ffd15c');
    this.pendingToast = 'HEIST GESCHEITERT · [H] FÜR NEUSTART';
  }

  private setBeaconColor(hex: string): void {
    (this.beam.material as THREE.MeshBasicMaterial).color.set(hex);
    (this.ring.material as THREE.MeshBasicMaterial).color.set(hex);
  }

  public update(
    elapsed: number,
    playerPos: THREE.Vector3,
    vehicles: VehicleSystem,
    boat: BoatSystem,
    npcs: NpcSystem,
    wanted: WantedSystem,
  ): HeistHudState {
    const toastOut = this.pendingToast;
    this.pendingToast = null;

    const pulse = 1 + Math.sin(elapsed * 4.5) * 0.1;
    this.ring.scale.set(pulse, pulse, 1);

    if (this.stage === 'idle') {
      this.beaconGroup.visible = true;
      this.beaconGroup.position.copy(this.startPos);
      this.vaultCase.visible = false;
      const distStart = Math.hypot(playerPos.x - this.startPos.x, playerPos.z - this.startPos.z);
      return {
        active: false,
        stage: 'idle',
        title: '',
        description: '',
        distanceM: Math.round(distStart),
        targetPos: null,
        nearStartMarker: distStart < 5.5,
        justCompleted: false,
        stageToast: toastOut,
      };
    }

    if (this.stage === 'stage_car') {
      this.beaconGroup.visible = true;
      this.beaconGroup.position.copy(this.startPos);
      const dist = Math.hypot(playerPos.x - this.startPos.x, playerPos.z - this.startPos.z);

      if (vehicles.isInVehicle() && dist < 5.8) {
        // Advance to Stage 2: Spawn 3 Syndicate guards near/on the Ocean Drive Terrace
        this.stage = 'clear_vault';
        this.guards = [
          npcs.spawnBountyTarget(66.5, -16),
          npcs.spawnBountyTarget(69.5, -24),
          npcs.spawnBountyTarget(64.0, -21),
        ];
        this.guards.forEach((g) => {
          g.state = 'pursue';
        });
        this.vaultCase.visible = true;
        this.setBeaconColor('#ff4fa3');
        this.pendingToast = 'PHASE 2/3 · WACHEN AUSSCHALTEN & KOFFER AUF DER TERRASSE HOLEN';
      }

      return {
        active: true,
        stage: this.stage,
        title: 'HEIST 1/3 · FLUCHTWAGEN',
        description: 'Fahr ein Auto [E] in die Gold-Zone vor dem Ocean Club.',
        distanceM: Math.round(dist),
        targetPos: this.startPos,
        nearStartMarker: false,
        justCompleted: false,
        stageToast: toastOut,
      };
    }

    if (this.stage === 'clear_vault') {
      this.beaconGroup.visible = true;
      this.beaconGroup.position.copy(this.vaultPos);
      this.vaultCase.rotation.y = elapsed * 2.6;
      this.vaultCase.position.y = 1.1 + Math.sin(elapsed * 3.4) * 0.16;

      const aliveGuards = this.guards.filter((g) => g.alive).length;
      const dist3D = playerPos.distanceTo(this.vaultPos);

      if (aliveGuards === 0 && dist3D < 3.4) {
        // Advance to Stage 3: Trigger 4-star heat + chopper + escape by speedboat!
        this.stage = 'ocean_escape';
        this.vaultCase.visible = false;
        this.setBeaconColor('#36f1e6');
        wanted.addHeat(260); // 4 stars -> Vice PD Cruisers + Chopper!
        this.pendingToast = 'KOFFER GESICHERT! FLIEH PER SPEEDBOAT ZUM OZEAN-BEACON!';
      }

      return {
        active: true,
        stage: this.stage,
        title: 'HEIST 2/3 · OCEAN TERRACE',
        description:
          aliveGuards > 0
            ? `Schalte alle Syndikat-Wachen aus (${aliveGuards} übrig) & hol den Koffer oben auf dem Deck.`
            : 'Alle Wachen erledigt! Hol den Gold-Koffer oben auf der Ocean-Terrasse.',
        distanceM: Math.round(dist3D),
        targetPos: this.vaultPos,
        nearStartMarker: false,
        justCompleted: false,
        stageToast: toastOut,
      };
    }

    // Stage 3: Ocean Escape by Speedboat!
    this.beaconGroup.visible = true;
    this.beaconGroup.position.copy(this.escapePos);
    const distEscape = Math.hypot(playerPos.x - this.escapePos.x, playerPos.z - this.escapePos.z);

    if (boat.isInBoat() && distEscape < 16.5) {
      this.stage = 'idle';
      this.guards = [];
      this.beaconGroup.position.copy(this.startPos);
      this.setBeaconColor('#ffd15c');
      return {
        active: false,
        stage: 'idle',
        title: '',
        description: '',
        distanceM: 0,
        targetPos: null,
        nearStartMarker: false,
        justCompleted: true,
        stageToast: `OCEAN CLUB HEIST ERFOLGREICH · +$${this.reward.toLocaleString('en-US')}`,
      };
    }

    return {
      active: true,
      stage: this.stage,
      title: 'HEIST 3/3 · FLUCHT ÜBER SEE',
      description: boat.isInBoat()
        ? 'Vollgas zum Cyan-Flucht-Beacon draußen auf dem Ozean!'
        : 'Renn zum Strand, schnapp dir das STINGER SPEEDBOAT [E] und entkomme!',
      distanceM: Math.round(distEscape),
      targetPos: this.escapePos,
      nearStartMarker: false,
      justCompleted: false,
      stageToast: toastOut,
    };
  }
}
