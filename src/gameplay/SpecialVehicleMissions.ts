import * as THREE from 'three';
import type { AABB } from '../types';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { SpatialGrid } from '../engine/SpatialGrid';
import type { NpcSystem } from '../entities/NpcSystem';
import type { Vehicle } from '../vehicles/VehicleSystem';

export type SpecialMissionKind = 'taxi' | 'firefighter' | 'paramedic';

export interface SpecialMissionHudState {
  active: boolean;
  kind: SpecialMissionKind | null;
  tag: string;
  title: string;
  description: string;
  distanceM: number;
  timerText: string;
  targetPos: THREE.Vector3 | null;
  toastText: string | null;
  rewardEarned: number;
  dispatchMsg: string | null;
  paramedicRescues: number;
  maxHpJustUnlocked: boolean;
  waterCannonFiring: boolean;
  waterSplashEvent: boolean;
  sprayedPolice: boolean;
}

interface DistrictStop {
  name: string;
  x: number;
  z: number;
  y?: number;
}

const TAXI_STOPS: DistrictStop[] = [
  { name: 'OCEAN DRIVE · NEON CLUB', x: 56, z: 6 },
  { name: 'CENTRAL PLAZA · AMMU-NEON', x: 16, z: 16 },
  { name: 'VICE PD · PRECINCT 06', x: -24, z: 14 },
  { name: 'LITTLE HAVANA · STARLIGHT DINER', x: -64, z: 4 },
  { name: 'LITTLE HAVANA · BANCO DE VICE', x: -64, z: 40 },
  { name: 'VICE PORT · CONTAINER-KAI', x: 20, z: 86 },
  { name: 'VICE PORT · IMPORT/EXPORT', x: 46, z: 96 },
  { name: 'NORTH POINT · VICE MARINA', x: -8, z: -80 },
  { name: 'NORTH POINT · KÜSTENSTRASSE', x: 34, z: -80 },
  { name: 'STARFISH ISLAND · ESTATE-TOR', x: 158, z: -56, y: 0.68 },
  { name: 'SOUTH BEACH · PROMENADE', x: 58, z: 46 },
  { name: 'WEST AVENUE · PAY N SPRAY', x: -58, z: -24 },
];

const FIRE_WRECK_SPOTS: DistrictStop[] = [
  { name: 'DOWNTOWN · OSTKREUZUNG', x: 20, z: 20 },
  { name: 'OCEAN DRIVE · PALMENALLEE', x: 60, z: -18 },
  { name: 'CENTRAL PLAZA · NORD', x: -20, z: -20 },
  { name: 'LITTLE HAVANA · BOULEVARD', x: -60, z: 20 },
  { name: 'VICE PORT · DOCK-EINFAHRT', x: -16, z: 78 },
  { name: 'VICE PORT · KRAN-KAI', x: 32, z: 102 },
  { name: 'NORTH POINT · MARINA-ZUFAHRT', x: 12, z: -80 },
  { name: 'WEST AVENUE · SÜD', x: -60, z: -48 },
  { name: 'DOWNTOWN · SÜDBRÜCKE', x: 20, z: 58 },
];

// Vice EMS Medical Drop-off Bay (open curb near Central/West Downtown)
const EMS_DEPOT_POS = new THREE.Vector3(-24, 0.08, -28);
export const PARAMEDIC_MAX_HP_RESCUES_REQUIRED = 5;

interface BurningWreck {
  group: THREE.Group;
  position: THREE.Vector3;
  flames: THREE.Mesh[];
  ring: THREE.Mesh;
  fireHp: number;
  smokeTimer: number;
  extinguished: boolean;
}

interface WaterDroplet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  isSteam: boolean;
}

/**
 * Classic GTA Special-Vehicle Side-Missions & Firetruck High-Pressure Water Cannon:
 * - VICE CAB (Taxi): Timed multi-district fares with live Drift & Stunt-Jump tip bonuses!
 * - VICE FIRE ENGINE 06 (Feuerwehr): Working mouse/arrow-aimed water turret that extinguishes
 *   burning wrecks & blasts pedestrians/cops backward!
 * - VICE EMS AMBULANCE (Rettungswagen): Rescue injured patients & deliver them to the EMS Depot;
 *   permanently unlocks 150 Max-HP after 5 rescues!
 */
export class SpecialVehicleMissionSystem {
  private readonly scene: THREE.Scene;

  private activeKind: SpecialMissionKind | null = null;
  private level = 1;
  private timer = 0;
  private outOfVehicleTimer = 0;

  // Taxi state
  private taxiPhase: 'pickup' | 'dropoff' = 'pickup';
  private taxiStop: DistrictStop = TAXI_STOPS[0];
  private taxiFareDistance = 0;
  private taxiDriftTip = 0;
  private taxiJumpTip = 0;
  private taxiStreak = 0;

  // Paramedic state
  private paramedicRescues = 0;
  private maxHpUnlocked = false;
  private paramedicPhase: 'pickup' | 'deliver' = 'pickup';
  private patientSpot: DistrictStop = TAXI_STOPS[0];

  // Visual 3D markers & NPC props for Taxi/Paramedic
  private readonly markerGroup = new THREE.Group();
  private readonly markerRing: THREE.Mesh;
  private readonly markerBeam: THREE.Mesh;
  private readonly waitingPerson: THREE.Group;
  private readonly waitingArm: THREE.Mesh;
  private readonly emsDepotGroup = new THREE.Group();
  private readonly emsDepotRing: THREE.Mesh;

  // Firefighter burning wrecks + shared wreck geometries/materials
  private readonly wrecks: BurningWreck[] = [];
  private readonly wreckCharredMat = new THREE.MeshStandardMaterial({
    color: '#1b171d',
    roughness: 0.94,
    metalness: 0.25,
  });
  private readonly wreckBodyGeo = new THREE.BoxGeometry(1.95, 0.72, 4.1);
  private readonly wreckCabinGeo = new THREE.BoxGeometry(1.68, 0.56, 1.9);
  private readonly wreckWheelGeo = (() => {
    const g = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
    g.rotateZ(Math.PI / 2);
    return g;
  })();
  private readonly wreckConeGeoSmall = new THREE.ConeGeometry(0.42, 1.35, 7);
  private readonly wreckConeGeoLarge = new THREE.ConeGeometry(0.56, 1.35, 7);
  private readonly wreckRingGeo = new THREE.RingGeometry(2.6, 3.2, 26);
  private readonly tmpNozzleWorld = new THREE.Vector3();
  private readonly tmpSamplePos = new THREE.Vector3();

  // Firetruck high-pressure water cannon state (works anytime in Firetruck!)
  private turretYaw = 0; // local relative to truck forward (-1.85 .. +1.85 rad)
  private turretPitch = 0.08; // -0.18 .. +0.42 rad
  private waterFireHeld = false;
  private waterSpawnTimer = 0;
  private waterAudioTimer = 0;
  private readonly aimKeys = new Set<string>();
  private readonly droplets: WaterDroplet[] = [];
  private readonly dropletPool: THREE.Mesh[] = [];
  private readonly dropletGeo = new THREE.SphereGeometry(0.18, 6, 5);
  private readonly steamGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);

  // One-frame event buffers (e.g., from jump callback)
  private pendingToast: string | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1) Shared pickup/dropoff beacon + waving passenger / injured patient figure
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffd15c',
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.markerRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.35, 28), ringMat);
    this.markerRing.rotation.x = -Math.PI / 2;
    this.markerRing.position.y = 0.09;
    this.markerGroup.add(this.markerRing);

    const beamMat = new THREE.MeshBasicMaterial({
      color: '#ffd15c',
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.markerBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 11, 16, 1, true), beamMat);
    this.markerBeam.position.y = 5.5;
    this.markerGroup.add(this.markerBeam);

    // Simple 80s passenger/patient figure
    this.waitingPerson = new THREE.Group();
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.78, 0.24),
      new THREE.MeshStandardMaterial({ color: '#24304a', roughness: 0.75 }),
    );
    legs.position.y = 0.39;
    this.waitingPerson.add(legs);
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.64, 0.26),
      new THREE.MeshStandardMaterial({ color: '#ff6eb4', roughness: 0.6 }),
    );
    torso.position.y = 1.08;
    this.waitingPerson.add(torso);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshStandardMaterial({ color: '#e8ba9b', roughness: 0.65 }),
    );
    head.position.y = 1.56;
    this.waitingPerson.add(head);
    this.waitingArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.56, 0.14),
      new THREE.MeshStandardMaterial({ color: '#ff6eb4', roughness: 0.6 }),
    );
    this.waitingArm.position.set(0.32, 1.35, 0);
    this.waitingPerson.add(this.waitingArm);
    this.markerGroup.add(this.waitingPerson);

    this.markerGroup.visible = false;
    this.scene.add(this.markerGroup);

    // 2) Vice EMS Medical Depot drop-off zone (shown during Paramedic mission)
    const depotMat = new THREE.MeshBasicMaterial({
      color: '#ff3355',
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.emsDepotRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 32), depotMat);
    this.emsDepotRing.rotation.x = -Math.PI / 2;
    this.emsDepotRing.position.y = 0.08;
    this.emsDepotGroup.add(this.emsDepotRing);

    const crossMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false });
    const crossA = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), crossMat);
    crossA.rotation.x = -Math.PI / 2;
    crossA.position.y = 0.09;
    const crossB = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2), crossMat);
    crossB.rotation.x = -Math.PI / 2;
    crossB.position.y = 0.09;
    this.emsDepotGroup.add(crossA, crossB);
    this.emsDepotGroup.position.copy(EMS_DEPOT_POS);
    this.emsDepotGroup.visible = false;
    this.scene.add(this.emsDepotGroup);

    // Listen to mouse & arrow keys for firetruck water cannon aiming/firing
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.waterFireHeld = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.waterFireHeld = false;
    });
    window.addEventListener('blur', () => {
      this.waterFireHeld = false;
      this.aimKeys.clear();
    });
    window.addEventListener('keydown', (e) => {
      if (
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'KeyC'
      ) {
        this.aimKeys.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.aimKeys.delete(e.code);
    });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.turretYaw = THREE.MathUtils.clamp(this.turretYaw - e.movementX * 0.0045, -1.85, 1.85);
        this.turretPitch = THREE.MathUtils.clamp(this.turretPitch - e.movementY * 0.0028, -0.16, 0.42);
      }
    });
  }

  public setParamedicProgress(rescues: number, maxHpUnlocked: boolean): void {
    this.paramedicRescues = Math.max(0, Math.floor(rescues));
    this.maxHpUnlocked = maxHpUnlocked || this.paramedicRescues >= PARAMEDIC_MAX_HP_RESCUES_REQUIRED;
  }

  public getParamedicProgress(): { rescues: number; maxHpUnlocked: boolean } {
    return { rescues: this.paramedicRescues, maxHpUnlocked: this.maxHpUnlocked };
  }

  public isActive(): boolean {
    return this.activeKind !== null;
  }

  public getActiveKind(): SpecialMissionKind | null {
    return this.activeKind;
  }

  public start(kind: SpecialMissionKind, playerPos: THREE.Vector3): void {
    this.stop();
    this.activeKind = kind;
    this.level = 1;
    this.outOfVehicleTimer = 0;

    if (kind === 'taxi') {
      this.taxiStreak = 0;
      this.spawnTaxiPickup(playerPos);
    } else if (kind === 'firefighter') {
      this.spawnFireStage(playerPos);
    } else if (kind === 'paramedic') {
      this.emsDepotGroup.visible = true;
      this.spawnParamedicPatient(playerPos);
    }
  }

  public stop(): void {
    this.activeKind = null;
    this.timer = 0;
    this.outOfVehicleTimer = 0;
    this.markerGroup.visible = false;
    this.emsDepotGroup.visible = false;
    this.clearWrecks();
  }

  /**
   * Called from main.ts whenever the player lands a Stunt Ramp jump while driving.
   * Grants an instant Stunt-Jump Tip Bonus during an active Taxi drop-off!
   */
  public notifyTaxiStuntJump(distanceM: number): void {
    if (this.activeKind === 'taxi' && this.taxiPhase === 'dropoff') {
      const tip = distanceM >= 20 ? 250 : 150;
      this.taxiJumpTip += tip;
      this.pendingToast = `VICE CAB · SPRUNG-TRINKGELD +$${tip} (${distanceM}m)!`;
    }
  }

  private pickStopFarFrom(origin: THREE.Vector3, list: DistrictStop[], minDist: number): DistrictStop {
    const candidates = list.filter((s) => Math.hypot(s.x - origin.x, s.z - origin.z) >= minDist);
    const pool = candidates.length > 0 ? candidates : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private spawnTaxiPickup(playerPos: THREE.Vector3): void {
    this.taxiPhase = 'pickup';
    this.taxiDriftTip = 0;
    this.taxiJumpTip = 0;
    this.taxiStop = this.pickStopFarFrom(playerPos, TAXI_STOPS, 24);
    const dist = Math.hypot(this.taxiStop.x - playerPos.x, this.taxiStop.z - playerPos.z);
    this.timer = Math.max(36, Math.min(68, 22 + dist * 0.42));

    this.markerGroup.position.set(this.taxiStop.x, this.taxiStop.y ?? 0, this.taxiStop.z);
    (this.markerRing.material as THREE.MeshBasicMaterial).color.set('#ffd15c');
    (this.markerBeam.material as THREE.MeshBasicMaterial).color.set('#ffd15c');
    this.waitingPerson.visible = true;
    this.waitingPerson.rotation.x = 0;
    this.waitingPerson.position.y = 0;
    this.markerGroup.visible = true;
  }

  private spawnTaxiDropoff(playerPos: THREE.Vector3): void {
    this.taxiPhase = 'dropoff';
    this.taxiDriftTip = 0;
    this.taxiJumpTip = 0;
    this.taxiStop = this.pickStopFarFrom(playerPos, TAXI_STOPS, 48);
    this.taxiFareDistance = Math.hypot(this.taxiStop.x - playerPos.x, this.taxiStop.z - playerPos.z);
    this.timer = Math.max(32, Math.min(72, 20 + this.taxiFareDistance * 0.38));

    this.markerGroup.position.set(this.taxiStop.x, this.taxiStop.y ?? 0, this.taxiStop.z);
    (this.markerRing.material as THREE.MeshBasicMaterial).color.set('#36f1e6');
    (this.markerBeam.material as THREE.MeshBasicMaterial).color.set('#36f1e6');
    this.waitingPerson.visible = false;
    this.markerGroup.visible = true;
  }

  private spawnParamedicPatient(playerPos: THREE.Vector3): void {
    this.paramedicPhase = 'pickup';
    this.patientSpot = this.pickStopFarFrom(playerPos, TAXI_STOPS, 28);
    const dist = Math.hypot(this.patientSpot.x - playerPos.x, this.patientSpot.z - playerPos.z);
    this.timer = Math.max(42, Math.min(75, 26 + dist * 0.45));

    this.markerGroup.position.set(this.patientSpot.x, this.patientSpot.y ?? 0, this.patientSpot.z);
    (this.markerRing.material as THREE.MeshBasicMaterial).color.set('#ff3355');
    (this.markerBeam.material as THREE.MeshBasicMaterial).color.set('#ff3355');
    this.waitingPerson.visible = true;
    // Injured patient lying down on the pavement!
    this.waitingPerson.rotation.x = -Math.PI / 2;
    this.waitingPerson.position.y = 0.22;
    this.markerGroup.visible = true;
  }

  private clearWrecks(): void {
    for (const w of this.wrecks) {
      this.scene.remove(w.group);
      for (const fl of w.flames) {
        (fl.material as THREE.Material).dispose();
      }
      (w.ring.material as THREE.Material).dispose();
    }
    this.wrecks.length = 0;
  }

  private spawnFireStage(playerPos: THREE.Vector3): void {
    this.clearWrecks();
    const count = Math.min(3, this.level);
    const shuffled = [...FIRE_WRECK_SPOTS]
      .filter((s) => Math.hypot(s.x - playerPos.x, s.z - playerPos.z) > 22)
      .sort(() => Math.random() - 0.5);

    const chosen = shuffled.slice(0, count);
    if (chosen.length === 0) chosen.push(FIRE_WRECK_SPOTS[0]);

    for (const spot of chosen) {
      const wreck = this.createBurningWreck(spot.x, spot.z);
      this.wrecks.push(wreck);
    }
    this.timer = Math.max(55, 50 + count * 22);
  }

  private createBurningWreck(x: number, z: number): BurningWreck {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;

    const body = new THREE.Mesh(this.wreckBodyGeo, this.wreckCharredMat);
    body.position.y = 0.56;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(this.wreckCabinGeo, this.wreckCharredMat);
    cabin.position.set(0, 1.15, -0.15);
    group.add(cabin);

    for (const [wx, wz] of [
      [-0.98, 1.25],
      [0.98, 1.25],
      [-0.98, -1.25],
      [0.98, -1.25],
    ]) {
      const w = new THREE.Mesh(this.wreckWheelGeo, this.wreckCharredMat);
      w.position.set(wx, 0.32, wz);
      group.add(w);
    }

    // Animated layered fire cones (emissive orange/yellow for crisp bloom!)
    const flames: THREE.Mesh[] = [];
    const flameColors = ['#ff5511', '#ff9922', '#ffdd44'];
    const flameOffsets: [number, number, number][] = [
      [0, 1.15, 1.15],
      [-0.35, 1.1, 0.75],
      [0.32, 1.35, -0.1],
      [0, 1.1, -1.1],
    ];
    for (let i = 0; i < flameOffsets.length; i++) {
      const [fx, fy, fz] = flameOffsets[i];
      const fMat = new THREE.MeshStandardMaterial({
        color: flameColors[i % flameColors.length],
        emissive: flameColors[i % flameColors.length],
        emissiveIntensity: 2.8,
        transparent: true,
        opacity: 0.9,
      });
      const cone = new THREE.Mesh(i % 2 === 0 ? this.wreckConeGeoSmall : this.wreckConeGeoLarge, fMat);
      cone.position.set(fx, fy + 0.45, fz);
      group.add(cone);
      flames.push(cone);
    }

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ff6622',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(this.wreckRingGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.09;
    group.add(ring);

    this.scene.add(group);
    return {
      group,
      position: new THREE.Vector3(x, 0, z),
      flames,
      ring,
      fireHp: 100,
      smokeTimer: 0,
      extinguished: false,
    };
  }

  private acquireDroplet(color: string, opacity: number, scale: number, isSteam: boolean): THREE.Mesh {
    const existing = this.dropletPool.pop();
    if (existing) {
      existing.geometry = isSteam ? this.steamGeo : this.dropletGeo;
      const mat = existing.material as THREE.MeshBasicMaterial;
      mat.color.set(color);
      mat.opacity = opacity;
      existing.scale.setScalar(scale);
      existing.visible = true;
      return existing;
    }
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    const mesh = new THREE.Mesh(isSteam ? this.steamGeo : this.dropletGeo, mat);
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    return mesh;
  }

  private spawnSteamBurst(pos: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const m = this.acquireDroplet('#e8f6ff', 0.72, 1.1 + Math.random() * 0.8, true);
      m.position.set(pos.x + (Math.random() - 0.5) * 1.1, pos.y + 0.7, pos.z + (Math.random() - 0.5) * 1.1);
      this.droplets.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.4 + Math.random() * 2.6, (Math.random() - 0.5) * 2.2),
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
        isSteam: true,
      });
    }
  }

  private updateWaterCannon(
    dt: number,
    isPlaying: boolean,
    activeCar: Vehicle | null,
    allVehicles: Vehicle[],
    npcs: NpcSystem,
    worldColliders: AABB[],
    pad?: GamepadSnapshot,
    npcGrid?: SpatialGrid,
  ): { firing: boolean; splashEvent: boolean; sprayedPolice: boolean } {
    let firing = false;
    let splashEvent = false;
    let sprayedPolice = false;

    if (isPlaying && activeCar && activeCar.specialRole === 'firetruck' && activeCar.waterTurret) {
      // Arrow keys & gamepad right stick turret aiming (mouse also aims via mousemove listener)
      const yawKey = (this.aimKeys.has('ArrowLeft') ? 1 : 0) - (this.aimKeys.has('ArrowRight') ? 1 : 0);
      const pitchKey = (this.aimKeys.has('ArrowUp') ? 1 : 0) - (this.aimKeys.has('ArrowDown') ? 1 : 0);
      const padYaw = pad?.connected ? -pad.lookX : 0;
      const padPitch = pad?.connected ? -pad.lookY : 0;

      this.turretYaw = THREE.MathUtils.clamp(this.turretYaw + (yawKey + padYaw) * 1.85 * dt, -1.85, 1.85);
      this.turretPitch = THREE.MathUtils.clamp(this.turretPitch + (pitchKey + padPitch) * 1.1 * dt, -0.16, 0.42);

      activeCar.waterTurret.rotation.y = this.turretYaw;
      activeCar.waterTurret.rotation.x = -this.turretPitch;

      firing = this.waterFireHeld || this.aimKeys.has('KeyC') || Boolean(pad?.connected && (pad.crouch || pad.sprint));

      if (firing) {
        this.waterSpawnTimer -= dt;
        this.waterAudioTimer -= dt;
        if (this.waterAudioTimer <= 0) {
          this.waterAudioTimer = 0.095;
          splashEvent = true;
        }

        // Compute world nozzle position & aim direction
        const worldYaw = activeCar.yaw + this.turretYaw;
        const cosP = Math.cos(this.turretPitch);
        const dirX = Math.sin(worldYaw) * cosP;
        const dirY = Math.sin(this.turretPitch) + 0.08;
        const dirZ = Math.cos(worldYaw) * cosP;

        const nozzleWorld = this.tmpNozzleWorld.set(0, 0.06, 1.15);
        activeCar.waterTurret.localToWorld(nozzleWorld);

        if (this.waterSpawnTimer <= 0) {
          this.waterSpawnTimer = 0.018;
          for (let k = 0; k < 2; k++) {
            const col = k === 0 ? '#7de8ff' : '#dff8ff';
            const drop = this.acquireDroplet(col, 0.85, 0.85 + Math.random() * 0.45, false);
            drop.position.copy(nozzleWorld);
            const spd = 25 + Math.random() * 3.5;
            drop.position.x += (Math.random() - 0.5) * 0.12;
            drop.position.z += (Math.random() - 0.5) * 0.12;
            this.droplets.push({
              mesh: drop,
              vel: new THREE.Vector3(
                dirX * spd + (Math.random() - 0.5) * 1.3,
                dirY * spd + (Math.random() - 0.5) * 0.9,
                dirZ * spd + (Math.random() - 0.5) * 1.3,
              ),
              life: 0.95,
              maxLife: 0.95,
              isSteam: false,
            });
          }
        }

        // Sample water jet impact corridor (3m..24m ahead of nozzle) for instant responsive hit detection
        const flatDirLen = Math.hypot(dirX, dirZ) || 1;
        const pushDirX = dirX / flatDirLen;
        const pushDirZ = dirZ / flatDirLen;
        const samplePos = this.tmpSamplePos;

        for (let dist = 4; dist <= 23; dist += 3.8) {
          const tFlight = dist / 26;
          const arcY = nozzleWorld.y + dirY * 26 * tFlight - 0.5 * 14.5 * tFlight * tFlight;
          if (arcY < -0.5) break;
          samplePos.set(nozzleWorld.x + dirX * dist, Math.max(0.2, arcY), nozzleWorld.z + dirZ * dist);

          // 1) Push pedestrians & Vice PD officers backward with high-pressure water!
          const hitCounts = npcs.applyWaterCannonPush(samplePos, pushDirX, pushDirZ, 2.6, dt, worldColliders, npcGrid);
          if (hitCounts.policeHit > 0) sprayedPolice = true;

          // 2) Extinguish Firefighter mission burning wrecks!
          for (const w of this.wrecks) {
            if (w.extinguished) continue;
            if (w.position.distanceToSquared(samplePos) < 13.5) {
              w.fireHp = Math.max(0, w.fireHp - 42 * dt);
              if (Math.random() < dt * 14) {
                this.spawnSteamBurst(w.position, 1);
              }
              if (w.fireHp <= 0) {
                w.extinguished = true;
                w.ring.visible = false;
                for (const f of w.flames) f.visible = false;
                this.spawnSteamBurst(w.position, 10);
              }
            }
          }

          // 3) Also extinguish / cool down any destroyed burning city vehicle!
          for (const v of allVehicles) {
            if (!v.destroyed) continue;
            if (v.position.distanceToSquared(samplePos) < 11.5) {
              v.respawnTimer = Math.max(0.5, v.respawnTimer - 4.5 * dt);
              if (Math.random() < dt * 10) {
                this.spawnSteamBurst(v.position, 1);
              }
            }
          }
        }
      }
    }

    // Update all active water droplets & steam particles
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const p = this.droplets[i];
      p.life -= dt;
      if (p.life <= 0 || (!p.isSteam && p.mesh.position.y < 0.08)) {
        if (!p.isSteam && p.mesh.position.y < 0.08 && Math.random() < 0.25) {
          // Tiny splash mist on asphalt
          p.isSteam = true;
          p.life = 0.22;
          p.maxLife = 0.22;
          p.vel.set((Math.random() - 0.5) * 2.5, 1.4, (Math.random() - 0.5) * 2.5);
          p.mesh.scale.setScalar(0.8);
          continue;
        }
        p.mesh.visible = false;
        this.dropletPool.push(p.mesh);
        const last = this.droplets.length - 1;
        if (i !== last) this.droplets[i] = this.droplets[last];
        this.droplets.pop();
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        if (!p.isSteam) {
          p.vel.y -= 14.5 * dt;
        } else {
          p.vel.y += 0.6 * dt;
          p.mesh.scale.multiplyScalar(1 + dt * 0.9);
        }
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.life / p.maxLife) * 0.82);
      }
    }

    return { firing, splashEvent, sprayedPolice };
  }

  public update(
    dt: number,
    elapsed: number,
    isPlaying: boolean,
    playerPos: THREE.Vector3,
    activeCar: Vehicle | null,
    isDrifting: boolean,
    allVehicles: Vehicle[],
    npcs: NpcSystem,
    worldColliders: AABB[],
    pad?: GamepadSnapshot,
    npcGrid?: SpatialGrid,
  ): SpecialMissionHudState {
    const clampedDt = Math.min(dt, 0.05);

    // Always update firetruck water cannon (works both in free-roam and during Firefighter missions!)
    const waterState = this.updateWaterCannon(
      clampedDt,
      isPlaying,
      activeCar,
      allVehicles,
      npcs,
      worldColliders,
      pad,
      npcGrid,
    );

    const idleOut: SpecialMissionHudState = {
      active: false,
      kind: null,
      tag: '',
      title: '',
      description: '',
      distanceM: 0,
      timerText: '',
      targetPos: null,
      toastText: null,
      rewardEarned: 0,
      dispatchMsg: null,
      paramedicRescues: this.paramedicRescues,
      maxHpJustUnlocked: false,
      waterCannonFiring: waterState.firing,
      waterSplashEvent: waterState.splashEvent,
      sprayedPolice: waterState.sprayedPolice,
    };

    if (!this.activeKind) return idleOut;

    const requiredRole =
      this.activeKind === 'taxi' ? 'taxi' : this.activeKind === 'firefighter' ? 'firetruck' : 'ambulance';
    const inRightVehicle = Boolean(activeCar && activeCar.specialRole === requiredRole);

    if (!inRightVehicle) {
      this.outOfVehicleTimer += clampedDt;
      if (this.outOfVehicleTimer >= 15) {
        const label =
          this.activeKind === 'taxi'
            ? 'TAXI-MODUS ABGEBROCHEN · VICE CAB VERLASSEN'
            : this.activeKind === 'firefighter'
              ? 'FEUERWEHR-EINSATZ ABGEBROCHEN · LÖSCHZUG VERLASSEN'
              : 'RETTUNGSDIENST ABGEBROCHEN · AMBULANZ VERLASSEN';
        this.stop();
        return { ...idleOut, toastText: label };
      }
    } else {
      this.outOfVehicleTimer = 0;
    }

    this.timer -= clampedDt;
    if (this.timer <= 0) {
      const label =
        this.activeKind === 'taxi'
          ? 'TAXI-ZEIT ABGELAUFEN · FAHRGAST ABGESPRUNGEN'
          : this.activeKind === 'firefighter'
            ? 'FEUERWEHR-ZEIT ABGELAUFEN · EINSATZ GESCHEITERT'
            : 'RETTUNGSDIENST · ZEIT ABGELAUFEN!';
      this.stop();
      return { ...idleOut, toastText: label };
    }

    const warnOut = !inRightVehicle ? ` · ZURÜCK INS FAHRZEUG (${Math.ceil(15 - this.outOfVehicleTimer)}s)` : '';
    const consumedToast = this.pendingToast;
    this.pendingToast = null;

    // -------------------------------------------------------------------------
    // 1) TAXI MISSION („VICE CAB“)
    // -------------------------------------------------------------------------
    if (this.activeKind === 'taxi') {
      const pulse = 1 + Math.sin(elapsed * 6.5) * 0.1;
      this.markerRing.scale.setScalar(pulse);
      if (this.taxiPhase === 'pickup') {
        this.waitingArm.rotation.z = -2.3 + Math.sin(elapsed * 9) * 0.45;
      }

      const targetVec = this.markerGroup.position;
      const dist = Math.hypot(playerPos.x - targetVec.x, playerPos.z - targetVec.z);
      const speedAbs = activeCar ? Math.abs(activeCar.speed) : 0;

      if (this.taxiPhase === 'pickup') {
        if (inRightVehicle && dist < 5.6 && speedAbs < 6.5) {
          this.spawnTaxiDropoff(playerPos);
          return {
            ...idleOut,
            active: true,
            kind: 'taxi',
            tag: '★ VICE CAB',
            title: `FAHRGAST → ${this.taxiStop.name}`,
            description: 'Drift & Sprünge geben Trinkgeld! ([G] Beenden)',
            distanceM: Math.round(this.taxiFareDistance),
            timerText: `${Math.ceil(this.timer)}s`,
            targetPos: this.markerGroup.position.clone(),
            toastText: `FAHRGAST AN BORD · ZIEL: ${this.taxiStop.name}`,
          };
        }
        return {
          ...idleOut,
          active: true,
          kind: 'taxi',
          tag: '★ VICE CAB',
          title: `FAHRGAST ABHOLEN · ${this.taxiStop.name}`,
          description: `Am gelben Ring anhalten (Fahrt #${this.taxiStreak + 1})${warnOut}`,
          distanceM: Math.round(dist),
          timerText: `${Math.ceil(this.timer)}s`,
          targetPos: this.markerGroup.position.clone(),
          toastText: consumedToast,
        };
      } else {
        // Dropoff phase: accumulate Drift-Trinkgeld!
        if (inRightVehicle && isDrifting) {
          this.taxiDriftTip += 22 * clampedDt;
        }
        const totalTip = Math.round(this.taxiDriftTip + this.taxiJumpTip);

        if (inRightVehicle && dist < 6.4 && speedAbs < 7.5) {
          this.taxiStreak++;
          const baseFare = Math.round(240 + this.taxiFareDistance * 1.7 + this.taxiStreak * 45);
          const speedBonus = Math.round(Math.max(0, this.timer * 5));
          const totalReward = baseFare + speedBonus + totalTip;
          const tipNote = totalTip > 0 ? ` (INKL. $${totalTip} DRIFT/SPRUNG-TRINKGELD!)` : '';
          this.spawnTaxiPickup(playerPos);
          return {
            ...idleOut,
            active: true,
            kind: 'taxi',
            tag: '★ VICE CAB',
            title: `FAHRGAST ABHOLEN · ${this.taxiStop.name}`,
            description: `Am gelben Ring anhalten (Fahrt #${this.taxiStreak + 1})`,
            distanceM: Math.round(Math.hypot(playerPos.x - this.taxiStop.x, playerPos.z - this.taxiStop.z)),
            timerText: `${Math.ceil(this.timer)}s`,
            targetPos: this.markerGroup.position.clone(),
            toastText: `FAHRT #${this.taxiStreak} ERFÜLLT · +$${totalReward}${tipNote}`,
            rewardEarned: totalReward,
          };
        }

        const tipHud = totalTip > 0 ? ` · Trinkgeld +$${totalTip}` : ' · Drifte/Springe für Trinkgeld!';
        return {
          ...idleOut,
          active: true,
          kind: 'taxi',
          tag: '★ VICE CAB',
          title: `ZIEL · ${this.taxiStop.name}`,
          description: `Schnell abliefern${tipHud}${warnOut}`,
          distanceM: Math.round(dist),
          timerText: `${Math.ceil(this.timer)}s`,
          targetPos: this.markerGroup.position.clone(),
          toastText: consumedToast,
        };
      }
    }

    // -------------------------------------------------------------------------
    // 2) FIREFIGHTER MISSION („VICE FIRE ENGINE 06“)
    // -------------------------------------------------------------------------
    if (this.activeKind === 'firefighter') {
      let remaining = 0;
      let nearestWreck: BurningWreck | null = null;
      let nearestDist = Infinity;

      for (const w of this.wrecks) {
        if (w.extinguished) continue;
        remaining++;
        const scaleFrac = Math.max(0.25, w.fireHp / 100);
        for (let fIdx = 0; fIdx < w.flames.length; fIdx++) {
          const fl = w.flames[fIdx];
          fl.scale.set(
            scaleFrac * (0.9 + Math.sin(elapsed * 14 + fIdx * 2) * 0.14),
            scaleFrac * (0.85 + Math.cos(elapsed * 18 + fIdx) * 0.22),
            scaleFrac * (0.9 + Math.sin(elapsed * 14 + fIdx * 2) * 0.14),
          );
        }
        w.ring.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.08);
        const d = Math.hypot(playerPos.x - w.position.x, playerPos.z - w.position.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestWreck = w;
        }
      }

      if (remaining === 0) {
        const clearedLvl = this.level;
        const reward = 450 + clearedLvl * 200;
        this.level++;
        this.spawnFireStage(playerPos);
        const first = this.wrecks[0];
        const nextDist = first ? Math.round(Math.hypot(playerPos.x - first.position.x, playerPos.z - first.position.z)) : 0;
        return {
          ...idleOut,
          active: true,
          kind: 'firefighter',
          tag: '★ FEUERWEHR',
          title: `LÖSCHEINSATZ · STUFE ${this.level}`,
          description: `${this.wrecks.length} brennende Wracks löschen ([LMB] Wasserwerfer)`,
          distanceM: nextDist,
          timerText: `${Math.ceil(this.timer)}s`,
          targetPos: first ? first.position.clone() : null,
          toastText: `BRAND GELÖSCHT · STUFE ${clearedLvl} ERFÜLLT (+$${reward})`,
          rewardEarned: reward,
          dispatchMsg: `Feuerwehr-Zentrale: Brandstufe ${clearedLvl} gelöscht (+$${reward}) — neuer Notruf!`,
        };
      }

      return {
        ...idleOut,
        active: true,
        kind: 'firefighter',
        tag: '★ FEUERWEHR',
        title: `LÖSCHEINSATZ · STUFE ${this.level} (${remaining} OFFEN)`,
        description: `Mit [LMB] & Maus/Pfeilen löschen${warnOut}`,
        distanceM: Math.round(nearestDist),
        timerText: `${Math.ceil(this.timer)}s`,
        targetPos: nearestWreck ? nearestWreck.position.clone() : null,
        toastText: consumedToast,
      };
    }

    // -------------------------------------------------------------------------
    // 3) PARAMEDIC MISSION („VICE EMS AMBULANCE“) -> Unlocks 150 Max-HP!
    // -------------------------------------------------------------------------
    const pulse = 1 + Math.sin(elapsed * 7) * 0.1;
    this.markerRing.scale.setScalar(pulse);
    this.emsDepotRing.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.08);

    const speedAbs = activeCar ? Math.abs(activeCar.speed) : 0;

    if (this.paramedicPhase === 'pickup') {
      const dist = Math.hypot(playerPos.x - this.markerGroup.position.x, playerPos.z - this.markerGroup.position.z);
      if (inRightVehicle && dist < 5.8 && speedAbs < 6.5) {
        this.paramedicPhase = 'deliver';
        this.markerGroup.visible = false;
        this.timer = Math.max(this.timer + 18, 38);
        const depotDist = Math.round(Math.hypot(playerPos.x - EMS_DEPOT_POS.x, playerPos.z - EMS_DEPOT_POS.z));
        return {
          ...idleOut,
          active: true,
          kind: 'paramedic',
          tag: '★ RETTUNGSDIENST',
          title: 'PATIENT AN BORD → EMS-DEPOT',
          description: `Zum roten Kreuz in Downtown bringen (${this.paramedicRescues}/${PARAMEDIC_MAX_HP_RESCUES_REQUIRED} für 150 HP)`,
          distanceM: depotDist,
          timerText: `${Math.ceil(this.timer)}s`,
          targetPos: EMS_DEPOT_POS.clone(),
          toastText: 'PATIENT STABILISIERT · SCHNELL ZUM EMS-DEPOT!',
        };
      }
      const progressNote = this.maxHpUnlocked
        ? '150 MAX-HP AKTIV'
        : `${this.paramedicRescues}/${PARAMEDIC_MAX_HP_RESCUES_REQUIRED} für 150 Max-HP`;
      return {
        ...idleOut,
        active: true,
        kind: 'paramedic',
        tag: '★ RETTUNGSDIENST',
        title: `NOTFALL · ${this.patientSpot.name}`,
        description: `Patienten aufnehmen (${progressNote})${warnOut}`,
        distanceM: Math.round(dist),
        timerText: `${Math.ceil(this.timer)}s`,
        targetPos: this.markerGroup.position.clone(),
        toastText: consumedToast,
      };
    } else {
      const distDepot = Math.hypot(playerPos.x - EMS_DEPOT_POS.x, playerPos.z - EMS_DEPOT_POS.z);
      if (inRightVehicle && distDepot < 6.8 && speedAbs < 7.5) {
        this.paramedicRescues++;
        this.level++;
        const reward = 350 + this.level * 100;
        let maxHpJustUnlocked = false;
        if (!this.maxHpUnlocked && this.paramedicRescues >= PARAMEDIC_MAX_HP_RESCUES_REQUIRED) {
          this.maxHpUnlocked = true;
          maxHpJustUnlocked = true;
        }
        this.spawnParamedicPatient(playerPos);
        const nextDist = Math.round(
          Math.hypot(playerPos.x - this.markerGroup.position.x, playerPos.z - this.markerGroup.position.z),
        );
        return {
          ...idleOut,
          active: true,
          kind: 'paramedic',
          tag: '★ RETTUNGSDIENST',
          title: `NOTFALL · ${this.patientSpot.name}`,
          description: maxHpJustUnlocked
            ? '150 MAX-HP DAUERHAFT FREIGESCHALTET!'
            : `Nächster Patient markiert (${this.paramedicRescues}/${PARAMEDIC_MAX_HP_RESCUES_REQUIRED})`,
          distanceM: nextDist,
          timerText: `${Math.ceil(this.timer)}s`,
          targetPos: this.markerGroup.position.clone(),
          toastText: maxHpJustUnlocked
            ? `RETTUNGSDIENST-BONUS! · DAUERHAFT 150 MAX-HP FREIGESCHALTET! (+$${reward})`
            : `PATIENT GERETTET (${this.paramedicRescues}/${PARAMEDIC_MAX_HP_RESCUES_REQUIRED}) · +$${reward}`,
          rewardEarned: reward,
          dispatchMsg: maxHpJustUnlocked
            ? 'Vice EMS: 5 Rettungen abgeschlossen — 150 Max-HP dauerhaft freigeschaltet!'
            : `Vice EMS: Patient sicher abgeliefert (+$${reward}) — neuer Notruf!`,
          paramedicRescues: this.paramedicRescues,
          maxHpJustUnlocked,
        };
      }
      return {
        ...idleOut,
        active: true,
        kind: 'paramedic',
        tag: '★ RETTUNGSDIENST',
        title: 'PATIENT → VICE EMS DEPOT',
        description: `Im roten Kreuz-Ring anhalten${warnOut}`,
        distanceM: Math.round(distDepot),
        timerText: `${Math.ceil(this.timer)}s`,
        targetPos: EMS_DEPOT_POS.clone(),
        toastText: consumedToast,
      };
    }
  }
}
