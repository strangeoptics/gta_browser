import * as THREE from 'three';
import type { NpcEntity, NpcSystem } from '../entities/NpcSystem';
import { ROAD_COORDS } from '../world/CityLayout';

export interface VigilanteHudState {
  active: boolean;
  level: number;
  title: string;
  description: string;
  distanceM: number;
  timerText: string;
  targetPos: THREE.Vector3 | null;
  toastText: string | null;
  rewardEarned: number;
  dispatchMsg: string | null;
}

/**
 * GTA-style Vigilante (Bürgerwehr) Mode triggered with [G] inside any Vice PD vehicle.
 * Dispatches escalating criminal suspects across the city with a countdown timer and cash bounties.
 */
export class VigilanteSystem {
  private active = false;
  private level = 1;
  private targetNpc: NpcEntity | null = null;
  private timer = 0;
  private outOfCarTimer = 0;

  public isActive(): boolean {
    return this.active;
  }

  public start(playerPos: THREE.Vector3, npcs: NpcSystem): void {
    this.active = true;
    this.level = 1;
    this.outOfCarTimer = 0;
    this.spawnNextSuspect(playerPos, npcs);
  }

  public stop(): void {
    this.active = false;
    this.targetNpc = null;
    this.timer = 0;
    this.outOfCarTimer = 0;
  }

  private spawnNextSuspect(playerPos: THREE.Vector3, npcs: NpcSystem): void {
    let bestX = 20;
    let bestZ = 20;
    for (let attempt = 0; attempt < 12; attempt++) {
      const rx = ROAD_COORDS[Math.floor(Math.random() * ROAD_COORDS.length)];
      const rz = ROAD_COORDS[Math.floor(Math.random() * ROAD_COORDS.length)];
      const sx = rx + (Math.random() - 0.5) * 8;
      const sz = rz + (Math.random() - 0.5) * 8;
      if (Math.hypot(sx - playerPos.x, sz - playerPos.z) > 30) {
        bestX = sx;
        bestZ = sz;
        break;
      }
    }
    this.targetNpc = npcs.spawnBountyTarget(bestX, bestZ);
    this.timer = Math.max(30, 50 - this.level * 2);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    inPoliceVehicle: boolean,
    npcs: NpcSystem,
  ): VigilanteHudState {
    if (!this.active) {
      return {
        active: false,
        level: 0,
        title: '',
        description: '',
        distanceM: 0,
        timerText: '',
        targetPos: null,
        toastText: null,
        rewardEarned: 0,
        dispatchMsg: null,
      };
    }

    const clampedDt = Math.min(dt, 0.05);
    this.timer -= clampedDt;

    if (!inPoliceVehicle) {
      this.outOfCarTimer += clampedDt;
      if (this.outOfCarTimer >= 15) {
        this.stop();
        return {
          active: false,
          level: 0,
          title: '',
          description: '',
          distanceM: 0,
          timerText: '',
          targetPos: null,
          toastText: 'VIGILANTE ABGEBROCHEN · STREIFENWAGEN VERLASSEN',
          rewardEarned: 0,
          dispatchMsg: null,
        };
      }
    } else {
      this.outOfCarTimer = 0;
    }

    if (this.timer <= 0) {
      this.stop();
      return {
        active: false,
        level: 0,
        title: '',
        description: '',
        distanceM: 0,
        timerText: '',
        targetPos: null,
        toastText: 'VIGILANTE ZEIT ABGELAUFEN · VERDÄCHTIGER ENTKOMMEN',
        rewardEarned: 0,
        dispatchMsg: null,
      };
    }

    // Check if suspect was eliminated!
    if (!this.targetNpc || !this.targetNpc.alive) {
      const reward = 400 + this.level * 150;
      const clearedLvl = this.level;
      this.level++;
      this.spawnNextSuspect(playerPos, npcs);
      const dist = this.targetNpc ? Math.round(playerPos.distanceTo(this.targetNpc.position)) : 0;
      return {
        active: true,
        level: this.level,
        title: `VIGILANTE · STUFE ${this.level}`,
        description: 'Verdächtigen stellen & ausschalten ([G] Beenden)',
        distanceM: dist,
        timerText: `${Math.ceil(this.timer)}s`,
        targetPos: this.targetNpc ? this.targetNpc.position : null,
        toastText: `VIGILANTE STUFE ${clearedLvl} ERFÜLLT · +$${reward}`,
        rewardEarned: reward,
        dispatchMsg: `10-4! Stufe ${clearedLvl} erledigt (+$${reward}) — nächster Notruf markiert!`,
      };
    }

    const dist = Math.round(playerPos.distanceTo(this.targetNpc.position));
    const warnOut = !inPoliceVehicle ? ` · ZURÜCK INS POLIZEIAUTO (${Math.ceil(15 - this.outOfCarTimer)}s)` : '';

    return {
      active: true,
      level: this.level,
      title: `VIGILANTE · STUFE ${this.level}`,
      description: `Syndikat-Verdächtigen ausschalten${warnOut}`,
      distanceM: dist,
      timerText: `${Math.ceil(this.timer)}s`,
      targetPos: this.targetNpc.position,
      toastText: null,
      rewardEarned: 0,
      dispatchMsg: null,
    };
  }
}
