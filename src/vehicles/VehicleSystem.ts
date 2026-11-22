import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { SpatialGrid } from '../engine/SpatialGrid';
import type { StuntRamp } from '../world/StuntRamps';
import { ROAD_COORDS } from '../world/CityLayout';
import { createCarModel, type CarModelType } from './CarBuilder';
import { createMotorcycleMesh } from './MotorcycleBuilder';

export type SpecialVehicleRole = 'taxi' | 'ambulance' | 'firetruck' | 'icecream';

export interface Vehicle {
  id: string;
  name: string;
  isPolice: boolean;
  isPursuitUnit: boolean;
  specialRole?: SpecialVehicleRole;
  isBike: boolean;
  isRv: boolean;
  isDelorean: boolean;
  timeJumpReady?: boolean;
  timeJumpCooldown?: number;
  isKitt: boolean;
  turboBoostCooldown: number;
  turboBoostFlashTimer: number;
  jingleActive?: boolean;
  mesh: THREE.Group;
  hitbox: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
  riderMesh?: THREE.Group;
  kickstand?: THREE.Object3D;
  waterTurret?: THREE.Group;
  originalColor: string;
  position: THREE.Vector3;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  yaw: number;
  speed: number;
  vy: number;
  airborne: boolean;
  jumpStartX: number;
  jumpStartZ: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  respawnTimer: number;
  smokeTimer: number;
  wheels: THREE.Object3D[];
  tailMat?: THREE.MeshStandardMaterial;
  reverseMat?: THREE.MeshStandardMaterial;
  lightbarRed?: THREE.Mesh;
  lightbarBlue?: THREE.Mesh;
  scannerLeds?: THREE.Mesh[];
  flamingoDisguise?: {
    group: THREE.Group;
    wingL: THREE.Group;
    wingR: THREE.Group;
    neckPivot: THREE.Group;
  };
  // Vice Customs Tuning & Lowrider Hydraulics state
  tuned?: boolean;
  hydraulics?: boolean;
  hydraulicsAutoBounce?: boolean;
  hydroOffsetY?: number;
  hydroVelY?: number;
  hydroPitch?: number;
  hydroRoll?: number;
  underglowMesh?: THREE.Mesh;
  underglowColorIdx?: number;
  // AI traffic state
  isAiControlled: boolean;
  aiSpeed: number;
  aiTargetX: number;
  aiTargetZ: number;
  aiNodeX: number;
  aiNodeZ: number;
  aiDirX: number;
  aiDirZ: number;
  aiStuckTimer: number;
  aiReverseTimer: number;
  aiReverseSteer: number;
  collider: AABB;
}

export interface DrivingHudState {
  inVehicle: boolean;
  vehicleName: string;
  speedKmh: number;
  hpPct: number;
  drifting: boolean;
  firstPersonCam: boolean;
  nearbyVehicleName: string | null;
}

interface ExplosionFlash {
  sphere: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface SmokeParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface FireTrailSegment {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  phase: number;
}

interface ElectricBolt {
  line: THREE.Line;
  positions: Float32Array;
  life: number;
  maxLife: number;
}

const LANE_OFFSET = 2.75; // US right-hand lane center offset from road center (road width = 12m, curb at ±6.0m)

const CAR_SPECS: {
  name: string;
  model: CarModelType;
  color: string;
  neon: string;
  x: number;
  z: number;
  yaw: number;
  ai: boolean;
  police: boolean;
  pursuit: boolean;
  bike: boolean;
  specialRole?: SpecialVehicleRole;
}[] = [
  // Parked cars positioned cleanly half on the sidewalk / curb (roadCenter ± 6.0m) so road lanes stay 100% clear!
  { name: 'DELOREAN DMC-12', model: 'delorean', color: '#c8d0d8', neon: '#36f1e6', x: 54.0, z: 16, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false },
  { name: 'PCJ-86 NEON BIKE', model: 'supercar', color: '#36f1e6', neon: '#ff4fa3', x: 66.2, z: 20, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: true },
  { name: 'TESLA CYBERTRUCK', model: 'cybertruck', color: '#c2c9d2', neon: '#5ee8ff', x: 65.8, z: -6, yaw: 0, ai: false, police: false, pursuit: false, bike: false },
  { name: '1982 PONTIAC TRANS AM', model: 'transam', color: '#101118', neon: '#ff1e38', x: 54.0, z: -26, yaw: 0, ai: false, police: false, pursuit: false, bike: false },
  { name: 'DODGE CHALLENGER', model: 'challenger', color: '#e64928', neon: '#ff9f43', x: 14.0, z: 6, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false },
  { name: '1986 FLEETWOOD BOUNDER', model: 'bounder', color: '#e8dec5', neon: '#ffbe55', x: -26.0, z: -14, yaw: 0, ai: false, police: false, pursuit: false, bike: false },
  { name: '1974 DODGE MONACO', model: 'monaco', color: '#14151c', neon: '#36f1e6', x: -14.0, z: 28, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false },
  { name: 'VICE PD CRUISER', model: 'police', color: '#1b1b26', neon: '#36f1e6', x: -26.4, z: 7.5, yaw: 0, ai: false, police: true, pursuit: true, bike: false },
  { name: 'VICE PD INTERCEPTOR', model: 'police', color: '#1b1b26', neon: '#ff3355', x: 22.75, z: 48, yaw: Math.PI, ai: true, police: true, pursuit: true, bike: false },
  // Classic GTA Special Service Vehicles: Checker Taxi, Ambulance & Firetruck!
  { name: 'VICE CAB · CHECKER TAXI', model: 'taxi', color: '#f2c22e', neon: '#ffd15c', x: 54.0, z: -8, yaw: 0, ai: false, police: false, pursuit: false, bike: false, specialRole: 'taxi' },
  { name: 'VICE CAB · CHECKER TAXI', model: 'taxi', color: '#f2c22e', neon: '#ffd15c', x: -22.75, z: -40, yaw: 0, ai: true, police: false, pursuit: false, bike: false, specialRole: 'taxi' },
  { name: 'VICE EMS AMBULANCE', model: 'ambulance', color: '#f2f5fa', neon: '#ff3355', x: -14.0, z: -28, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false, specialRole: 'ambulance' },
  { name: 'VICE FIRE ENGINE 06', model: 'firetruck', color: '#d9232e', neon: '#ff9f43', x: 26.0, z: 42, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false, specialRole: 'firetruck' },
  { name: "CHERRY POPPER '86", model: 'icecream', color: '#ff7eb8', neon: '#63e8d4', x: 54.0, z: 28, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false, specialRole: 'icecream' },
  // Cruising traffic cars in right-hand lanes on the road grid
  { name: 'CHEETAH GT', model: 'supercar', color: '#ff4fa3', neon: '#ff4fa3', x: 17.25, z: -44, yaw: 0, ai: true, police: false, pursuit: false, bike: false },
  { name: 'DODGE CHALLENGER RT', model: 'challenger', color: '#36c9c6', neon: '#36f1e6', x: -44, z: 22.75, yaw: Math.PI / 2, ai: true, police: false, pursuit: false, bike: false },
];

export class VehicleSystem {
  public readonly vehicles: Vehicle[] = [];
  private readonly scene: THREE.Scene;
  private activeVehicle: Vehicle | null = null;
  private firstPersonCam = false;

  private readonly keys = new Set<string>();
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private camInitialized = false;

  private readonly explosions: ExplosionFlash[] = [];
  private readonly explosionSphereGeo = new THREE.SphereGeometry(1.1, 14, 10);
  private readonly explosionSpherePool: THREE.Mesh[] = [];
  private readonly smokeParticles: SmokeParticle[] = [];
  private readonly smokePool: THREE.Mesh[] = [];
  private readonly smokeGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  private readonly fireTrails: FireTrailSegment[] = [];
  private readonly fireTrailPool: THREE.Mesh[] = [];
  private readonly fireTrailGeo = new THREE.BoxGeometry(0.32, 0.045, 1.15);
  private readonly activeBolts: ElectricBolt[] = [];
  private readonly boltPool: ElectricBolt[] = [];
  private deloreanFireTimer = 0;
  private deloreanSparkTimer = 0;
  private readonly hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  private readonly localColliders: AABB[] = [];
  private readonly vehicleColliderScratch: AABB[] = [];
  private readonly tmpDesiredPos = new THREE.Vector3();
  private readonly tmpDesiredLook = new THREE.Vector3();
  private readonly tmpImpactPos = new THREE.Vector3();

  private acquireSmokeMesh(color: string | number, opacity: number, scale: number): THREE.Mesh {
    const existing = this.smokePool.pop();
    if (existing) {
      const mat = existing.material as THREE.MeshBasicMaterial;
      mat.color.set(color);
      mat.opacity = opacity;
      existing.scale.setScalar(scale);
      existing.visible = true;
      return existing;
    }
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
    const mesh = new THREE.Mesh(this.smokeGeo, mat);
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    return mesh;
  }

  // Dynamic headlight SpotLight + permanent explosion PointLight (zero runtime light add/remove -> zero shader recompiles!)
  private readonly headlightSpot: THREE.SpotLight;
  private readonly headlightTarget = new THREE.Object3D();
  private readonly explosionLight: THREE.PointLight;
  private isDrifting = false;
  private driftSmokeTimer = 0;

  public onVehicleHitNpc?: (vehiclePos: THREE.Vector3, speed: number) => void;
  public onVehicleExploded?: (pos: THREE.Vector3, radius: number, maxDamage: number) => void;
  public onPoliceRamPlayer?: (damage: number) => void;
  public onCarCrash?: (intensity: number, playerInvolved: boolean) => void;
  public onActiveVehicleDestroyed?: () => void;
  public onDriftMark?: (x: number, z: number, yaw: number) => void;
  public onStuntLanded?: (distanceM: number, reward: number) => void;
  public onKittTurboBoost?: (v: Vehicle) => void;
  public onDeloreanTimeJump?: (v: Vehicle, fromPos: THREE.Vector3, toPos: THREE.Vector3, destLabel: string) => void;
  private ramCooldown = 0;
  private crashSoundCooldown = 0;
  private policeFlamingoMode = false;

  /**
   * Drunk Hallucination Mode: turns every Vice PD cruiser into a giant pink flapping Flamingo!
   */
  public setPoliceFlamingoMode(active: boolean): void {
    if (this.policeFlamingoMode === active) return;
    this.policeFlamingoMode = active;

    for (const v of this.vehicles) {
      if (!v.isPolice) continue;
      if (active && !v.flamingoDisguise) {
        v.flamingoDisguise = this.buildGiantFlamingoDisguise();
        v.mesh.add(v.flamingoDisguise.group);
      }
      for (const child of v.mesh.children) {
        if (child === v.hitbox) continue;
        if (v.flamingoDisguise && child === v.flamingoDisguise.group) {
          child.visible = active;
        } else {
          child.visible = !active;
        }
      }
    }
  }

  private buildGiantFlamingoDisguise(): {
    group: THREE.Group;
    wingL: THREE.Group;
    wingR: THREE.Group;
    neckPivot: THREE.Group;
  } {
    const g = new THREE.Group();
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#ff5ea8', roughness: 0.35, metalness: 0.1 });
    const darkPinkMat = new THREE.MeshStandardMaterial({ color: '#e63788', roughness: 0.4 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#ff8cc2', roughness: 0.45 });
    const beakBaseMat = new THREE.MeshStandardMaterial({ color: '#ffe4ef', roughness: 0.35 });
    const beakTipMat = new THREE.MeshStandardMaterial({ color: '#18141e', roughness: 0.3 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });
    const sirenRedMat = new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.4 });
    const sirenBlueMat = new THREE.MeshStandardMaterial({ color: '#22aaff', emissive: '#22aaff', emissiveIntensity: 3.4 });

    // Long comical flamingo stilt legs
    for (const sx of [-0.36, 0.36]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 1.45, 8), legMat);
      leg.position.set(sx, 0.72, -0.1);
      g.add(leg);
    }

    // Giant plush pink oval flamingo torso
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.02, 16, 12), pinkMat);
    body.scale.set(0.9, 0.88, 1.52);
    body.position.set(0, 1.68, -0.1);
    body.castShadow = true;
    g.add(body);

    // Flapping pink wings on both sides
    const makeWing = (side: -1 | 1): THREE.Group => {
      const wp = new THREE.Group();
      wp.position.set(side * 0.85, 1.78, -0.05);
      const wingMesh = new THREE.Mesh(new THREE.SphereGeometry(0.76, 10, 8), darkPinkMat);
      wingMesh.scale.set(0.28, 0.7, 1.38);
      wingMesh.position.set(side * 0.15, -0.08, -0.15);
      wp.add(wingMesh);
      return wp;
    };
    const wingL = makeWing(-1);
    const wingR = makeWing(1);
    g.add(wingL, wingR);

    // Towering S-curved Flamingo Neck + Head + Hooked Beak + Tiny Police Sirens on Head!
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 1.98, 1.15);
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.55, 0.42),
      new THREE.Vector3(0, 1.25, 0.05),
      new THREE.Vector3(0, 1.75, 0.3),
    ]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 14, 0.17, 10, false), pinkMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), pinkMat);
    head.scale.set(0.9, 0.92, 1.2);
    head.position.set(0, 1.82, 0.36);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
      eye.position.set(sx * 0.28, 1.88, 0.5);
      neckPivot.add(eye);
    }

    const beakUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.45, 8), beakBaseMat);
    beakUpper.rotation.x = Math.PI / 2 + 0.25;
    beakUpper.position.set(0, 1.75, 0.85);
    const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.52, 8), beakTipMat);
    beakHook.rotation.x = Math.PI * 0.78;
    beakHook.position.set(0, 1.48, 1.12);

    // Tiny Vice PD red/blue siren hat right on the flamingo's head!
    const hatRed = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.16), sirenRedMat);
    hatRed.position.set(-0.14, 2.2, 0.34);
    const hatBlue = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.16), sirenBlueMat);
    hatBlue.position.set(0.14, 2.2, 0.34);

    neckPivot.add(neck, head, beakUpper, beakHook, hatRed, hatBlue);
    g.add(neckPivot);
    return { group: g, wingL, wingR, neckPivot };
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Warm halogen headlight cone for the active player vehicle
    this.headlightSpot = new THREE.SpotLight('#ffe4b5', 0, 44, Math.PI / 5.2, 0.55, 1.4);
    this.headlightSpot.target = this.headlightTarget;
    this.scene.add(this.headlightSpot);
    this.scene.add(this.headlightTarget);

    this.explosionLight = new THREE.PointLight('#ff6a22', 0, 32, 1.5);
    this.scene.add(this.explosionLight);

    CAR_SPECS.forEach((spec, idx) => {
      const built = spec.bike
        ? createMotorcycleMesh(spec.color, spec.neon)
        : createCarModel(spec.model, spec.color, spec.neon);
      built.group.position.set(spec.x, 0, spec.z);
      built.group.rotation.y = spec.yaw;
      if (spec.bike) {
        built.group.rotation.z = 0.09; // Subtle parked lean on side kickstand
      }
      scene.add(built.group);

      const isRv =
        spec.model === 'bounder' ||
        spec.model === 'ambulance' ||
        spec.model === 'firetruck' ||
        spec.model === 'icecream';
      const maxHp =
        spec.model === 'firetruck'
          ? 320
          : spec.model === 'bounder'
            ? 240
            : spec.model === 'ambulance'
              ? 220
              : spec.model === 'icecream'
                ? 200
                : spec.model === 'cybertruck'
                  ? 210
                  : spec.model === 'taxi'
                    ? 165
                    : 140;
      const hbW = spec.bike ? 0.7 : isRv ? 2.3 : 2.1;
      const hbH = spec.bike ? 1.35 : isRv ? 2.7 : 1.45;
      const hbD = spec.bike ? 2.1 : isRv ? 6.1 : 4.6;
      const hitbox = new THREE.Mesh(new THREE.BoxGeometry(hbW, hbH, hbD), this.hitboxMat);
      hitbox.position.y = hbH * 0.5;
      built.group.add(hitbox);

      const initDirX = Math.round(Math.sin(spec.yaw));
      const initDirZ = Math.round(Math.cos(spec.yaw));
      const initY = !spec.ai ? 0.08 : 0; // Parked cars sit cleanly half on the 0.18m sidewalk curb
      built.group.position.set(spec.x, initY, spec.z);

      const v: Vehicle = {
        id: `car-${idx}`,
        name: spec.name,
        isPolice: spec.police,
        isPursuitUnit: spec.pursuit,
        specialRole: spec.specialRole,
        isBike: spec.bike,
        isRv,
        isDelorean: spec.model === 'delorean',
        isKitt: spec.model === 'transam',
        turboBoostCooldown: 0,
        turboBoostFlashTimer: 0,
        mesh: built.group,
        hitbox,
        bodyMat: built.bodyMat,
        riderMesh: built.riderMesh,
        kickstand: 'kickstand' in built ? built.kickstand : undefined,
        waterTurret: 'waterTurret' in built ? built.waterTurret : undefined,
        originalColor: spec.color,
        position: new THREE.Vector3(spec.x, initY, spec.z),
        spawnX: spec.x,
        spawnZ: spec.z,
        spawnYaw: spec.yaw,
        yaw: spec.yaw,
        speed: 0,
        vy: 0,
        airborne: false,
        jumpStartX: spec.x,
        jumpStartZ: spec.z,
        hp: maxHp,
        maxHp,
        destroyed: false,
        respawnTimer: 0,
        smokeTimer: 0,
        wheels: built.wheels,
        tailMat: built.tailMat,
        reverseMat: 'reverseMat' in built ? built.reverseMat : undefined,
        lightbarRed: 'lightbarRed' in built ? built.lightbarRed : undefined,
        lightbarBlue: 'lightbarBlue' in built ? built.lightbarBlue : undefined,
        scannerLeds: 'scannerLeds' in built ? built.scannerLeds : undefined,
        isAiControlled: spec.ai,
        aiSpeed: spec.ai ? 8.2 : 0,
        aiTargetX: spec.x,
        aiTargetZ: spec.z,
        aiNodeX: this.nearestRoadCoord(spec.x),
        aiNodeZ: this.nearestRoadCoord(spec.z),
        aiDirX: initDirX,
        aiDirZ: initDirZ,
        aiStuckTimer: 0,
        aiReverseTimer: 0,
        aiReverseSteer: 1,
        collider: {
          minX: spec.x - 1.5,
          maxX: spec.x + 1.5,
          minY: 0,
          maxY: isRv ? 2.75 : 1.5,
          minZ: spec.z - 2.25,
          maxZ: spec.z + 2.25,
          tag: 'vehicle',
        },
      };
      const shootable: ShootableTarget = {
        id: v.id,
        mesh: hitbox,
        onHit: (damage: number) => {
          if (v === this.activeVehicle || v.destroyed) return false;
          this.damageVehicle(v, damage);
          return v.destroyed;
        },
      };
      hitbox.userData.shootableTarget = shootable;
      if (spec.ai) {
        this.pickNextAiWaypoint(v);
      }
      this.vehicles.push(v);
    });

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyV' && this.activeVehicle) {
        this.firstPersonCam = !this.firstPersonCam;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  public isInVehicle(): boolean {
    return this.activeVehicle !== null;
  }

  public getActiveVehicle(): Vehicle | null {
    return this.activeVehicle;
  }

  /**
   * Applies Vice Customs Turbo + Armor + Neon Underglow upgrade to a vehicle.
   * Returns true if this was the first full Turbo upgrade, or false if cycling custom neon finish.
   */
  public tuneVehicle(v: Vehicle): { firstUpgrade: boolean; neonLabel: string } {
    const NEON_PRESETS = [
      { hex: '#36f1e6', label: 'VICE CYAN' },
      { hex: '#ff4fa3', label: 'HOT PINK' },
      { hex: '#52f29c', label: 'MIAMI MINT' },
      { hex: '#ff9f43', label: 'SUNSET AMBER' },
      { hex: '#b388ff', label: 'ULTRAVIOLET' },
    ];
    const firstUpgrade = !v.tuned;
    if (firstUpgrade) {
      v.tuned = true;
      v.maxHp = Math.round(v.maxHp * 1.5);
    }
    v.hp = v.maxHp;
    v.destroyed = false;

    const nextIdx = ((v.underglowColorIdx ?? -1) + 1) % NEON_PRESETS.length;
    v.underglowColorIdx = nextIdx;
    const preset = NEON_PRESETS[nextIdx];

    // Metallic gloss boost on body paint
    v.bodyMat.roughness = 0.14;
    v.bodyMat.metalness = Math.max(v.bodyMat.metalness, 0.55);

    if (!v.underglowMesh) {
      const gw = v.isBike ? 0.55 : v.isRv ? 2.0 : 1.85;
      const gd = v.isBike ? 1.75 : v.isRv ? 5.2 : 3.9;
      const glowMat = new THREE.MeshBasicMaterial({
        color: preset.hex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), glowMat);
      glowMesh.rotation.x = -Math.PI / 2;
      glowMesh.position.y = 0.08;
      v.mesh.add(glowMesh);
      v.underglowMesh = glowMesh;
    } else {
      (v.underglowMesh.material as THREE.MeshBasicMaterial).color.set(preset.hex);
    }

    return { firstUpgrade, neonLabel: preset.label };
  }

  /**
   * Installs Vice Customs Lowrider Hydraulics on any 4-wheel car (not motorcycles).
   */
  public installHydraulics(v: Vehicle): boolean {
    if (v.isBike) return false;
    v.hydraulics = true;
    v.hydraulicsAutoBounce = true;
    this.triggerHydraulicHop(v, 'up');
    return true;
  }

  /**
   * Triggers a crisp, realistic hydraulic suspension hop or directional lowrider tilt!
   */
  public triggerHydraulicHop(v: Vehicle, dir: 'up' | 'front' | 'back' | 'left' | 'right'): void {
    if (!v.hydraulics) return;
    if (dir === 'up') {
      v.hydroVelY = 1.65;
      v.hydroPitch = -0.055;
    } else if (dir === 'front') {
      v.hydroVelY = 0.95;
      v.hydroPitch = -0.085;
    } else if (dir === 'back') {
      v.hydroVelY = 0.95;
      v.hydroPitch = 0.085;
    } else if (dir === 'left') {
      v.hydroVelY = 0.85;
      v.hydroRoll = 0.09;
    } else if (dir === 'right') {
      v.hydroVelY = 0.85;
      v.hydroRoll = -0.09;
    }
  }

  /**
   * Fires K.I.T.T.'s iconic vertical Turbo-Boost jump over roadblocks & traffic!
   */
  public triggerKittTurboBoost(v: Vehicle): boolean {
    if (!v.isKitt || v.destroyed || v.airborne || v.turboBoostCooldown > 0) return false;
    v.vy = 11.4;
    v.airborne = true;
    v.jumpStartX = v.position.x;
    v.jumpStartZ = v.position.z;
    const maxCap = (v.tuned ? 32 : 25) * 1.18;
    v.speed = Math.min(maxCap, Math.max(v.speed + 7.5, 18.5));
    v.turboBoostCooldown = 3.2;
    v.turboBoostFlashTimer = 0.65;

    // Fiery red/cyan turbine exhaust burst behind K.I.T.T.
    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);
    for (let i = 0; i < 14; i++) {
      const col = i % 3 === 0 ? '#ff2a4a' : i % 3 === 1 ? '#ff9f43' : '#36f1e6';
      const puff = this.acquireSmokeMesh(col, 0.92, 0.55 + Math.random() * 0.45);
      const side = (Math.random() - 0.5) * 1.3;
      puff.position.set(
        v.position.x - fwdX * 2.1 + rightX * side,
        v.position.y + 0.35 + Math.random() * 0.3,
        v.position.z - fwdZ * 2.1 + rightZ * side,
      );
      this.smokeParticles.push({
        mesh: puff,
        vel: new THREE.Vector3(
          -fwdX * (6 + Math.random() * 4) + (Math.random() - 0.5) * 2.5,
          1.2 + Math.random() * 2.2,
          -fwdZ * (6 + Math.random() * 4) + (Math.random() - 0.5) * 2.5,
        ),
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65,
      });
    }

    this.onKittTurboBoost?.(v);
    return true;
  }

  /**
   * Fires the DeLorean DMC-12 "88 MPH" Time Jump when charged to >= 88% top speed!
   * Leaves twin burning tire trails, bursts electric lightning arcs, and teleports across Palm City '86.
   */
  public triggerDeloreanTimeJump(v: Vehicle): boolean {
    if (!v.isDelorean || v.destroyed || !v.timeJumpReady || (v.timeJumpCooldown ?? 0) > 0) return false;

    const fromPos = v.position.clone();
    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);

    // Stamp twin blazing fire trails & skidmarks behind the departure spot
    for (let step = 0; step < 6; step++) {
      const distBack = step * 1.15;
      for (const side of [-0.92, 0.92]) {
        const fx = fromPos.x - fwdX * distBack + rightX * side;
        const fz = fromPos.z - fwdZ * distBack + rightZ * side;
        this.spawnDeloreanFireTrail(fx, fromPos.y, fz, v.yaw);
        this.onDriftMark?.(fx, fz, v.yaw);
      }
    }
    for (let b = 0; b < 8; b++) {
      this.spawnDeloreanLightningBolt(v);
    }

    // Pick a dramatic straight-road destination far across the map (> 75m away)
    const warpSpots = [
      { x: 60, z: -48, yaw: 0, label: 'OCEAN DRIVE NORD' },
      { x: 60, z: 46, yaw: Math.PI, label: 'OCEAN DRIVE SÜD' },
      { x: -112, z: -40, yaw: 0, label: 'WEST HAVANA BLVD' },
      { x: -12, z: -81, yaw: Math.PI / 2, label: 'NORTH POINT COASTAL HWY' },
      { x: -20, z: 58, yaw: Math.PI, label: 'VICE PORT AVENUE' },
    ];
    const farSpots = warpSpots.filter((s) => Math.hypot(s.x - fromPos.x, s.z - fromPos.z) > 75);
    const dest = (farSpots.length > 0 ? farSpots : warpSpots)[Math.floor(Math.random() * (farSpots.length > 0 ? farSpots.length : warpSpots.length))];

    v.position.set(dest.x, 0.05, dest.z);
    v.yaw = dest.yaw;
    v.speed = 16.5;
    v.vy = 0;
    v.airborne = false;
    v.mesh.position.copy(v.position);
    v.mesh.rotation.set(0, v.yaw, 0);
    v.timeJumpReady = false;
    v.timeJumpCooldown = 16.0;
    this.camInitialized = false;

    // Arrival twin fire trails & lightning discharge!
    const aFwdX = Math.sin(v.yaw);
    const aFwdZ = Math.cos(v.yaw);
    const aRightX = Math.cos(v.yaw);
    const aRightZ = -Math.sin(v.yaw);
    for (let step = 0; step < 5; step++) {
      const distBack = step * 1.15;
      for (const side of [-0.92, 0.92]) {
        const fx = v.position.x - aFwdX * distBack + aRightX * side;
        const fz = v.position.z - aFwdZ * distBack + aRightZ * side;
        this.spawnDeloreanFireTrail(fx, 0, fz, v.yaw);
        this.onDriftMark?.(fx, fz, v.yaw);
      }
    }
    for (let b = 0; b < 6; b++) {
      this.spawnDeloreanLightningBolt(v);
    }

    this.onDeloreanTimeJump?.(v, fromPos, v.position, dest.label);
    return true;
  }

  public findNearestVehicle(pos: THREE.Vector3, maxDist = 4.4): Vehicle | null {
    let best: Vehicle | null = null;
    let bestDistSq = maxDist * maxDist;
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const dSq = v.position.distanceToSquared(pos);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = v;
      }
    }
    return best;
  }

  public enterVehicle(v: Vehicle): void {
    if (v.destroyed) return;
    this.activeVehicle = v;
    v.isAiControlled = false;
    if (v.riderMesh) v.riderMesh.visible = true;
    if (v.kickstand) v.kickstand.visible = false;
    if (v.isBike) v.mesh.rotation.z = 0;
    this.camInitialized = false;
  }

  public exitVehicle(
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number } = {
      minX: -122,
      maxX: 204,
      minZ: -136,
      maxZ: 141,
    },
  ): { x: number; y: number; z: number; yaw: number } | null {
    if (!this.activeVehicle) return null;
    const v = this.activeVehicle;
    if (v.riderMesh) v.riderMesh.visible = false;
    if (v.kickstand) v.kickstand.visible = true;
    v.mesh.rotation.z = v.isBike ? 0.09 : 0;
    const exitDist = v.isBike ? 1.15 : 2.05;
    const sideX = Math.cos(v.yaw) * -exitDist;
    const sideZ = -Math.sin(v.yaw) * -exitDist;
    const out = {
      x: THREE.MathUtils.clamp(v.position.x + sideX, bounds.minX + 1, bounds.maxX - 1),
      y: v.position.y + 0.15,
      z: THREE.MathUtils.clamp(v.position.z + sideZ, bounds.minZ + 1, bounds.maxZ - 1),
      yaw: v.yaw + Math.PI,
    };
    this.activeVehicle = null;
    this.keys.clear();
    return out;
  }

  public appendShootableHitboxes(out: THREE.Object3D[]): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v !== this.activeVehicle && !v.destroyed) {
        out.push(v.hitbox);
      }
    }
  }

  public getShootableTargets(): ShootableTarget[] {
    const out: ShootableTarget[] = [];
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v !== this.activeVehicle && !v.destroyed && v.hitbox.userData.shootableTarget) {
        out.push(v.hitbox.userData.shootableTarget as ShootableTarget);
      }
    }
    return out;
  }

  /**
   * Updates in-place AABB colliders for all non-driven vehicles and appends them into `out`.
   */
  public appendVehicleColliders(out: AABB[]): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v === this.activeVehicle) continue;
      const cos = Math.abs(Math.cos(v.yaw));
      const sin = Math.abs(Math.sin(v.yaw));
      const wHalf = v.isBike ? 0.52 : v.isRv ? 1.18 : 1.05;
      const lHalf = v.isBike ? 1.25 : v.isRv ? 3.05 : 2.25;
      const halfX = wHalf * cos + lHalf * sin;
      const halfZ = wHalf * sin + lHalf * cos;
      const c = v.collider;
      c.minX = v.position.x - halfX;
      c.maxX = v.position.x + halfX;
      c.minY = v.position.y;
      c.maxY = v.position.y + (v.isRv ? 2.75 : 1.5);
      c.minZ = v.position.z - halfZ;
      c.maxZ = v.position.z + halfZ;
      out.push(c);
    }
  }

  public getVehicleColliders(): AABB[] {
    this.vehicleColliderScratch.length = 0;
    this.appendVehicleColliders(this.vehicleColliderScratch);
    return this.vehicleColliderScratch;
  }

  public damageVehicle(v: Vehicle, damage: number): void {
    if (v.destroyed) return;
    v.hp = Math.max(0, v.hp - damage);
    v.mesh.position.y = 0.08;
    if (v.hp <= 0) {
      this.explodeVehicle(v);
    }
  }

  public applyBlastDamage(origin: THREE.Vector3, radius: number, maxDamage: number): void {
    const rSq = radius * radius;
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const dSq = v.position.distanceToSquared(origin);
      if (dSq < rSq && dSq > 0.01) {
        const dist = Math.sqrt(dSq);
        const dmg = maxDamage * (1 - dist / radius);
        this.damageVehicle(v, dmg);
      }
    }
  }

  public spawnExplosionVfx(origin: THREE.Vector3): void {
    let sphere = this.explosionSpherePool.pop();
    if (sphere) {
      const mat = sphere.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.92;
      sphere.scale.setScalar(1);
      sphere.visible = true;
    } else {
      const sphereMat = new THREE.MeshBasicMaterial({
        color: '#ff8833',
        transparent: true,
        opacity: 0.92,
      });
      sphere = new THREE.Mesh(this.explosionSphereGeo, sphereMat);
      this.scene.add(sphere);
    }
    sphere.position.set(origin.x, origin.y + 0.9, origin.z);

    this.explosionLight.position.copy(sphere.position);
    this.explosionLight.intensity = 60;

    this.explosions.push({ sphere, life: 0.48, maxLife: 0.48 });

    // Burst of fiery + smoke particles (pooled meshes -> zero material allocations!)
    for (let i = 0; i < 20; i++) {
      const isFire = i < 12;
      const col = isFire ? (i % 2 === 0 ? '#ffaa33' : '#ff4422') : '#2a222b';
      const mesh = this.acquireSmokeMesh(col, 0.95, isFire ? 1.1 : 1.5);
      mesh.position.set(origin.x, origin.y + 0.8, origin.z);

      const angle = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 7;
      this.smokeParticles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 4 + Math.random() * 6, Math.sin(angle) * spd),
        life: 0.65 + Math.random() * 0.55,
        maxLife: 1.2,
      });
    }
  }

  private explodeVehicle(v: Vehicle): void {
    if (v.destroyed) return;
    v.destroyed = true;
    v.speed = 0;
    v.respawnTimer = 18.0;
    v.bodyMat.color.set('#1b171d');
    v.bodyMat.roughness = 0.95;

    if (v === this.activeVehicle) {
      this.onActiveVehicleDestroyed?.();
    }

    const blastPos = v.position.clone();
    this.spawnExplosionVfx(blastPos);
    this.onVehicleExploded?.(blastPos, 10.5, 110);
  }

  private spawnCrashSparks(origin: THREE.Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const mesh = this.acquireSmokeMesh(i % 2 === 0 ? '#ffd27d' : '#ff7b33', 0.95, 0.32);
      mesh.position.set(origin.x, 0.72, origin.z);

      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 5.5;
      this.smokeParticles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 2.2 + Math.random() * 3.5, Math.sin(angle) * spd),
        life: 0.32 + Math.random() * 0.2,
        maxLife: 0.52,
      });
    }
  }

  /**
   * Resolves pairwise car-to-car collisions using a 2-sphere bumper capsule per car.
   * Applies separation, momentum knockback, sparks, crash audio, and speed-scaled damage.
   */
  private resolveCarToCarCollisions(
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    vehicleGrid?: SpatialGrid,
  ): void {
    const sphereRadius = 1.08;
    const minDist = sphereRadius * 2;
    const minDistSq = minDist * minDist;
    const offsets = [-1.05, 1.05];

    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      const aFwdX = Math.sin(a.yaw);
      const aFwdZ = Math.cos(a.yaw);

      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        // Quick broad-phase skip
        const roughDx = b.position.x - a.position.x;
        const roughDz = b.position.z - a.position.z;
        if (roughDx * roughDx + roughDz * roughDz > 25) continue;

        const bFwdX = Math.sin(b.yaw);
        const bFwdZ = Math.cos(b.yaw);

        let deepestOverlap = 0;
        let hitNx = 0;
        let hitNz = 0;
        let hitPointX = 0;
        let hitPointZ = 0;

        for (const oa of offsets) {
          const ax = a.position.x + aFwdX * oa;
          const az = a.position.z + aFwdZ * oa;
          for (const ob of offsets) {
            const bx = b.position.x + bFwdX * ob;
            const bz = b.position.z + bFwdZ * ob;

            const dx = bx - ax;
            const dz = bz - az;
            const dSq = dx * dx + dz * dz;
            if (dSq < minDistSq && dSq > 0.0001) {
              const dist = Math.sqrt(dSq);
              const overlap = minDist - dist;
              if (overlap > deepestOverlap) {
                deepestOverlap = overlap;
                hitNx = dx / dist;
                hitNz = dz / dist;
                hitPointX = (ax + bx) * 0.5;
                hitPointZ = (az + bz) * 0.5;
              }
            }
          }
        }

        if (deepestOverlap <= 0) continue;

        // Separate the two vehicles cleanly
        const pushA = a.destroyed ? 0.2 : 0.5;
        const pushB = b.destroyed ? 0.2 : 0.5;
        a.position.x = THREE.MathUtils.clamp(a.position.x - hitNx * deepestOverlap * pushA, bounds.minX + 1.5, bounds.maxX - 4.0);
        a.position.z = THREE.MathUtils.clamp(a.position.z - hitNz * deepestOverlap * pushA, bounds.minZ + 1.5, bounds.maxZ - 1.5);
        b.position.x = THREE.MathUtils.clamp(b.position.x + hitNx * deepestOverlap * pushB, bounds.minX + 1.5, bounds.maxX - 4.0);
        b.position.z = THREE.MathUtils.clamp(b.position.z + hitNz * deepestOverlap * pushB, bounds.minZ + 1.5, bounds.maxZ - 1.5);

        // Keep separated cars out of buildings
        this.clampCarAgainstBuildings(a, solidColliders, vehicleGrid);
        this.clampCarAgainstBuildings(b, solidColliders, vehicleGrid);

        a.mesh.position.x = a.position.x;
        a.mesh.position.z = a.position.z;
        b.mesh.position.x = b.position.x;
        b.mesh.position.z = b.position.z;

        // Relative velocity along impact normal (a -> b)
        const vAx = aFwdX * a.speed;
        const vAz = aFwdZ * a.speed;
        const vBx = bFwdX * b.speed;
        const vBz = bFwdZ * b.speed;
        const closingSpeed = (vAx - vBx) * hitNx + (vAz - vBz) * hitNz;

        if (closingSpeed > 0.6) {
          // Momentum exchange & bounce
          const impulse = closingSpeed * 0.65;
          a.speed -= impulse * (aFwdX * hitNx + aFwdZ * hitNz);
          b.speed += impulse * (bFwdX * hitNx + bFwdZ * hitNz);

          // Slight lateral spin on hard off-center impacts
          if (closingSpeed > 5.0) {
            const spin = Math.min(0.32, closingSpeed * 0.014);
            if (!a.destroyed) a.yaw += (Math.random() - 0.5) * spin;
            if (!b.destroyed) b.yaw += (Math.random() - 0.5) * spin;
          }

          // Severity-based crash damage
          if (closingSpeed > 3.2) {
            const baseDmg = (closingSpeed - 2.8) * 5.2;
            const playerInvolved = a === this.activeVehicle || b === this.activeVehicle;
            const dmgA = a === this.activeVehicle ? baseDmg * 0.55 : baseDmg;
            const dmgB = b === this.activeVehicle ? baseDmg * 0.55 : baseDmg;

            this.damageVehicle(a, dmgA);
            this.damageVehicle(b, dmgB);

            const contact = this.tmpImpactPos.set(hitPointX, 0.7, hitPointZ);
            this.spawnCrashSparks(contact, Math.min(14, Math.round(closingSpeed * 0.8)));

            if (this.crashSoundCooldown <= 0) {
              this.crashSoundCooldown = 0.22;
              this.onCarCrash?.(Math.min(1, closingSpeed / 18), playerInvolved);
            }
          }
        }
      }
    }
  }

  private clampCarAgainstBuildings(v: Vehicle, solidColliders: AABB[], vehicleGrid?: SpatialGrid): void {
    const carRadius = v.isBike ? 0.72 : 1.45;
    const vehTop = v.position.y + (v.isRv ? 2.75 : 1.55);
    const boxes = vehicleGrid
      ? vehicleGrid.queryBox(
          v.position.x - carRadius - 0.3,
          v.position.x + carRadius + 0.3,
          v.position.z - carRadius - 0.3,
          v.position.z + carRadius + 0.3,
          solidColliders,
          this.localColliders,
        )
      : solidColliders;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (v.position.y >= box.maxY || vehTop <= box.minY) continue;
      if (
        v.position.x + carRadius > box.minX &&
        v.position.x - carRadius < box.maxX &&
        v.position.z + carRadius > box.minZ &&
        v.position.z - carRadius < box.maxZ
      ) {
        const pLeft = box.minX - (v.position.x + carRadius);
        const pRight = box.maxX - (v.position.x - carRadius);
        const pBack = box.minZ - (v.position.z + carRadius);
        const pFront = box.maxZ - (v.position.z - carRadius);
        const minAbs = Math.min(Math.abs(pLeft), Math.abs(pRight), Math.abs(pBack), Math.abs(pFront));
        if (minAbs === Math.abs(pLeft)) v.position.x += pLeft;
        else if (minAbs === Math.abs(pRight)) v.position.x += pRight;
        else if (minAbs === Math.abs(pBack)) v.position.z += pBack;
        else v.position.z += pFront;
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    isActive: boolean,
    playerPos: THREE.Vector3,
    wantedStars: number,
    camera: THREE.PerspectiveCamera,
    worldColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    pad?: GamepadSnapshot,
    stuntRamps?: StuntRamp[],
    shouldTrafficStop?: (x: number, z: number, yaw: number) => boolean,
    drunkLevel = 0,
    getGroundHeight?: (x: number, z: number) => number,
    vehicleGrid?: SpatialGrid,
    radioBeatPulse = 0,
    lockDriving = false,
  ): DrivingHudState {
    const clampedDt = Math.min(dt, 0.05);
    this.ramCooldown = Math.max(0, this.ramCooldown - clampedDt);
    this.crashSoundCooldown = Math.max(0, this.crashSoundCooldown - clampedDt);

    if (this.activeVehicle && pad?.connected && pad.camTogglePressed) {
      this.firstPersonCam = !this.firstPersonCam;
    }

    // solidColliders passed from main.ts is already pre-filtered to maxY > 0.45
    const solidColliders = worldColliders;

    for (const v of this.vehicles) {
      if (!v.airborne && v.position.y <= 0.05) {
        v.mesh.position.y += (v.position.y - v.mesh.position.y) * (1 - Math.exp(-12 * clampedDt));
      }

      // Respawn destroyed cars cleanly after cooldown
      if (v.destroyed) {
        v.respawnTimer -= clampedDt;
        this.emitDamageSmoke(v, clampedDt, false);
        if (v.respawnTimer <= 0) {
          const spawnY = !v.isAiControlled ? 0.08 : 0;
          v.destroyed = false;
          v.hp = v.maxHp;
          v.position.set(v.spawnX, spawnY, v.spawnZ);
          v.yaw = v.spawnYaw;
          v.speed = 0;
          v.aiStuckTimer = 0;
          v.aiReverseTimer = 0;
          v.bodyMat.color.set(v.originalColor);
          v.bodyMat.roughness = 0.24;
          v.mesh.position.set(v.spawnX, spawnY, v.spawnZ);
          v.mesh.rotation.y = v.spawnYaw;
          if (v.isAiControlled) {
            v.aiDirX = Math.round(Math.sin(v.spawnYaw));
            v.aiDirZ = Math.round(Math.cos(v.spawnYaw));
            this.pickNextAiWaypoint(v);
          }
        }
        continue;
      }

      // Damaged smoke / fire warning
      if (v.hp < 65) {
        this.emitDamageSmoke(v, clampedDt, v.hp < 32);
      }

      // Emergency lightbar flash (Police, Ambulance & Firetruck)
      const isEmergencyLightbar = v.isPolice || v.specialRole === 'ambulance' || v.specialRole === 'firetruck';
      if (isEmergencyLightbar && v.lightbarRed && v.lightbarBlue) {
        const activeFlash = (v.isPolice && wantedStars > 0) || v === this.activeVehicle;
        const phase = Math.sin(elapsed * 15) > 0;
        (v.lightbarRed.material as THREE.MeshStandardMaterial).emissiveIntensity = activeFlash
          ? phase
            ? 4.4
            : 0.2
          : 0.6;
        (v.lightbarBlue.material as THREE.MeshStandardMaterial).emissiveIntensity = activeFlash
          ? phase
            ? 0.2
            : 4.4
          : 0.6;
      }

      // Iconic K.I.T.T. sweeping red scanner LED animation on the 1982 Pontiac Firebird Trans Am!
      if (v.turboBoostCooldown > 0) {
        v.turboBoostCooldown = Math.max(0, v.turboBoostCooldown - clampedDt);
      }
      if (v.timeJumpCooldown && v.timeJumpCooldown > 0) {
        v.timeJumpCooldown = Math.max(0, v.timeJumpCooldown - clampedDt);
      }
      if (v.turboBoostFlashTimer > 0) {
        v.turboBoostFlashTimer = Math.max(0, v.turboBoostFlashTimer - clampedDt);
      }
      if (v.scannerLeds && v.scannerLeds.length > 0) {
        const sweepRate = v.turboBoostFlashTimer > 0 ? 15.0 : 3.8;
        const boostGlow = v.turboBoostFlashTimer > 0 ? 7.5 : 4.4;
        const sweepPos = ((Math.sin(elapsed * sweepRate) + 1) * 0.5) * (v.scannerLeds.length - 1);
        for (let s = 0; s < v.scannerLeds.length; s++) {
          const dist = Math.abs(s - sweepPos);
          const glow = Math.max(0.15, boostGlow - dist * 2.2);
          (v.scannerLeds[s].material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
        }
      }

      if (v === this.activeVehicle) {
        this.updatePlayerDrivenCar(
          v,
          clampedDt,
          elapsed,
          isActive && !lockDriving,
          solidColliders,
          bounds,
          pad,
          stuntRamps,
          drunkLevel,
          getGroundHeight,
          vehicleGrid,
          radioBeatPulse,
          lockDriving,
        );
      } else if (v.isPursuitUnit && wantedStars >= 2) {
        // Active Vice PD Cruiser chase!
        this.updatePolicePursuitCar(v, clampedDt, playerPos, solidColliders, bounds, vehicleGrid);
      } else if (v.isAiControlled) {
        this.updateAiCar(v, clampedDt, playerPos, solidColliders, bounds, shouldTrafficStop, vehicleGrid);
      } else {
        v.speed *= Math.exp(-3.2 * clampedDt);
        if (Math.abs(v.speed) > 0.05) {
          this.moveVehicleWithCollision(v, clampedDt, solidColliders, bounds, vehicleGrid);
        }
      }

      const wheelRot = v.speed * clampedDt * 2.4;
      for (const w of v.wheels) {
        w.rotation.x += wheelRot;
      }

      // Animate Giant Pink Flamingo Police Car hallucination!
      if (this.policeFlamingoMode && v.isPolice && v.flamingoDisguise) {
        const speedBob = Math.min(1, Math.abs(v.speed) / 8);
        const flap = Math.sin(elapsed * (6.5 + speedBob * 8.0)) * (0.28 + speedBob * 0.45);
        v.flamingoDisguise.wingL.rotation.z = -0.2 - Math.abs(flap);
        v.flamingoDisguise.wingR.rotation.z = 0.2 + Math.abs(flap);
        v.flamingoDisguise.neckPivot.rotation.x = Math.sin(elapsed * 4.2) * 0.16;
      }
    }

    // Resolve solid car-to-car collisions & severity-based crash damage
    this.resolveCarToCarCollisions(solidColliders, bounds, vehicleGrid);

    this.updateExplosionVfx(clampedDt, elapsed);

    // Update camera & headlight SpotLight if player is driving
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const forwardX = Math.sin(v.yaw);
      const forwardZ = Math.cos(v.yaw);

      this.headlightSpot.intensity = 42;
      this.headlightSpot.position.set(
        v.position.x + forwardX * 2.1,
        v.position.y + 0.95,
        v.position.z + forwardZ * 2.1,
      );
      this.headlightTarget.position.set(
        v.position.x + forwardX * 18,
        0.1,
        v.position.z + forwardZ * 18,
      );
      this.headlightTarget.updateMatrixWorld();

      if (this.firstPersonCam) {
        const eyeY = v.isRv ? 2.15 : 1.32;
        const eyeFwd = v.isRv ? 2.1 : 0.35;
        camera.position.set(
          v.position.x + forwardX * eyeFwd,
          v.position.y + eyeY,
          v.position.z + forwardZ * eyeFwd,
        );
        camera.lookAt(
          v.position.x + forwardX * 18,
          v.position.y + (v.isRv ? 1.9 : 1.15),
          v.position.z + forwardZ * 18,
        );
      } else {
        const chaseBack = v.isRv ? 9.4 : 7.2;
        const chaseUp = v.isRv ? 4.2 : 3.2;
        const desiredPos = this.tmpDesiredPos.set(
          v.position.x - forwardX * chaseBack,
          v.position.y + chaseUp,
          v.position.z - forwardZ * chaseBack,
        );
        const desiredLook = this.tmpDesiredLook.set(
          v.position.x + forwardX * 6.0,
          v.position.y + 1.1,
          v.position.z + forwardZ * 6.0,
        );
        if (!this.camInitialized) {
          this.camPosSmooth.copy(desiredPos);
          this.camLookSmooth.copy(desiredLook);
          this.camInitialized = true;
        } else {
          const blend = 1 - Math.exp(-8.5 * clampedDt);
          this.camPosSmooth.lerp(desiredPos, blend);
          this.camLookSmooth.lerp(desiredLook, blend);
        }
        camera.position.copy(this.camPosSmooth);
        camera.lookAt(this.camLookSmooth);
      }

      return {
        inVehicle: true,
        vehicleName: v.name,
        speedKmh: Math.round(Math.abs(v.speed) * 3.6),
        hpPct: Math.round((v.hp / v.maxHp) * 100),
        drifting: this.isDrifting,
        firstPersonCam: this.firstPersonCam,
        nearbyVehicleName: null,
      };
    }

    this.headlightSpot.intensity = 0;
    this.isDrifting = false;
    const nearby = this.findNearestVehicle(playerPos);
    return {
      inVehicle: false,
      vehicleName: '',
      speedKmh: 0,
      hpPct: 100,
      drifting: false,
      firstPersonCam: this.firstPersonCam,
      nearbyVehicleName: nearby ? nearby.name : null,
    };
  }

  private emitDamageSmoke(v: Vehicle, dt: number, fiery: boolean): void {
    v.smokeTimer -= dt;
    if (v.smokeTimer > 0) return;
    v.smokeTimer = fiery ? 0.08 : 0.16;

    const col = fiery && Math.random() > 0.45 ? '#ff7722' : '#2e2633';
    const mesh = this.acquireSmokeMesh(col, 0.78, 1.0);
    const hoodX = v.position.x + Math.sin(v.yaw) * 1.3;
    const hoodZ = v.position.z + Math.cos(v.yaw) * 1.3;
    mesh.position.set(hoodX + (Math.random() - 0.5) * 0.4, 0.95, hoodZ + (Math.random() - 0.5) * 0.4);

    this.smokeParticles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8),
      life: 0.85,
      maxLife: 0.85,
    });
  }

  private spawnDeloreanFireTrail(x: number, y: number, z: number, yaw: number): void {
    let mesh = this.fireTrailPool.pop();
    if (mesh) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set('#ffae33');
      mat.opacity = 0.92;
      mesh.scale.set(1, 1, 1);
      mesh.visible = true;
    } else {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffae33',
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      mesh = new THREE.Mesh(this.fireTrailGeo, mat);
      this.scene.add(mesh);
    }
    mesh.position.set(x, y + 0.035, z);
    mesh.rotation.set(0, yaw, 0);
    this.fireTrails.push({
      mesh,
      life: 2.5,
      maxLife: 2.5,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private spawnDeloreanLightningBolt(v: Vehicle): void {
    let bolt = this.boltPool.pop();
    if (!bolt) {
      const positions = new Float32Array(6 * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: '#8cf8ff',
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.scene.add(line);
      bolt = { line, positions, life: 0.09, maxLife: 0.09 };
    } else {
      bolt.line.visible = true;
      (bolt.line.material as THREE.LineBasicMaterial).opacity = 0.95;
      bolt.life = 0.08 + Math.random() * 0.04;
      bolt.maxLife = bolt.life;
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);

    // Random start & end points wrapping around the DeLorean's stainless chassis & flux bands
    const sLat = (Math.random() - 0.5) * 2.4;
    const sFwd = (Math.random() - 0.5) * 4.4;
    const sY = 0.35 + Math.random() * 1.05;
    const eLat = sLat + (Math.random() - 0.5) * 1.9;
    const eFwd = sFwd + (Math.random() - 0.5) * 2.4;
    const eY = 0.25 + Math.random() * 1.2;

    const p = bolt.positions;
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      const jitter = k === 0 || k === 5 ? 0 : 0.36;
      const lLat = THREE.MathUtils.lerp(sLat, eLat, t) + (Math.random() - 0.5) * jitter;
      const lFwd = THREE.MathUtils.lerp(sFwd, eFwd, t) + (Math.random() - 0.5) * jitter;
      const lY = THREE.MathUtils.lerp(sY, eY, t) + (Math.random() - 0.5) * jitter;
      p[k * 3] = v.position.x + rightX * lLat + fwdX * lFwd;
      p[k * 3 + 1] = v.position.y + lY;
      p[k * 3 + 2] = v.position.z + rightZ * lLat + fwdZ * lFwd;
    }
    (bolt.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.activeBolts.push(bolt);
  }

  private updateExplosionVfx(dt: number, elapsed = 0): void {
    let maxBlastGlow = 0;
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      if (ex.life <= 0) {
        ex.sphere.visible = false;
        this.explosionSpherePool.push(ex.sphere);
        const last = this.explosions.length - 1;
        if (i !== last) this.explosions[i] = this.explosions[last];
        this.explosions.pop();
      } else {
        const t = 1 - ex.life / ex.maxLife;
        const scale = 1 + t * 5.2;
        ex.sphere.scale.setScalar(scale);
        (ex.sphere.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.88;
        maxBlastGlow = Math.max(maxBlastGlow, (1 - t) * 65);
      }
    }
    this.explosionLight.intensity = maxBlastGlow;

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.smokePool.push(p.mesh);
        const last = this.smokeParticles.length - 1;
        if (i !== last) this.smokeParticles[i] = this.smokeParticles[last];
        this.smokeParticles.pop();
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 3.2 * dt;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.life / p.maxLife) * 0.85);
      }
    }

    // Update burning DeLorean tire fire trails on the asphalt
    for (let i = this.fireTrails.length - 1; i >= 0; i--) {
      const ft = this.fireTrails[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        ft.mesh.visible = false;
        this.fireTrailPool.push(ft.mesh);
        const last = this.fireTrails.length - 1;
        if (i !== last) this.fireTrails[i] = this.fireTrails[last];
        this.fireTrails.pop();
      } else {
        const frac = ft.life / ft.maxLife;
        const flicker = 0.78 + Math.sin(elapsed * 26 + ft.phase) * 0.22;
        const mat = ft.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = frac * flicker * 0.92;
        // Shift from bright yellow-orange flames to deep ember red as it burns out
        mat.color.setRGB(1.0, 0.2 + frac * 0.58, frac * frac * 0.16);
        ft.mesh.scale.set(0.65 + frac * 0.45, 0.8 + flicker * 0.9, 1.0);
      }
    }

    // Update crackling DeLorean 100%-speed mini lightning arcs
    for (let i = this.activeBolts.length - 1; i >= 0; i--) {
      const b = this.activeBolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        b.line.visible = false;
        this.boltPool.push(b);
        const last = this.activeBolts.length - 1;
        if (i !== last) this.activeBolts[i] = this.activeBolts[last];
        this.activeBolts.pop();
      } else {
        (b.line.material as THREE.LineBasicMaterial).opacity = (b.life / b.maxLife) * 0.95;
      }
    }
  }

  private nearestRoadCoord(coord: number): number {
    let best = ROAD_COORDS[0];
    let bestDist = Math.abs(coord - best);
    for (let i = 1; i < ROAD_COORDS.length; i++) {
      const d = Math.abs(coord - ROAD_COORDS[i]);
      if (d < bestDist) {
        bestDist = d;
        best = ROAD_COORDS[i];
      }
    }
    return best;
  }

  /**
   * Probes whether a world point (px, pz) is blocked by a static building/roadblock collider.
   */
  private isPointBlockedByWorld(
    px: number,
    pz: number,
    radius: number,
    solidColliders: AABB[],
    vehicleGrid?: SpatialGrid,
  ): boolean {
    const boxes = vehicleGrid
      ? vehicleGrid.queryBox(px - radius, px + radius, pz - radius, pz + radius, solidColliders, this.localColliders)
      : solidColliders;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.maxY <= 0.45 || box.minY >= 1.8) continue;
      if (px + radius > box.minX && px - radius < box.maxX && pz + radius > box.minZ && pz - radius < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  private updatePolicePursuitCar(
    v: Vehicle,
    dt: number,
    playerPos: THREE.Vector3,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    vehicleGrid?: SpatialGrid,
  ): void {
    const toX = playerPos.x - v.position.x;
    const toZ = playerPos.z - v.position.z;
    const dist = Math.hypot(toX, toZ);

    // Handle brief reverse maneuver if cruiser got wedged on a building corner
    if (v.aiReverseTimer > 0) {
      v.aiReverseTimer -= dt;
      v.speed += (-5.5 - v.speed) * (1 - Math.exp(-5.0 * dt));
      v.yaw += v.aiReverseSteer * 1.9 * dt;
      this.moveVehicleWithCollision(v, dt, solidColliders, bounds, vehicleGrid);
      return;
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    const rightX = Math.cos(v.yaw);
    const rightZ = -Math.sin(v.yaw);

    // 3-whisker obstacle avoidance so Vice PD steers smoothly around buildings & traffic!
    let avoidSteer = 0;
    const probeDist = Math.min(8.5, Math.max(4.5, Math.abs(v.speed) * 0.65));
    const centerBlocked = this.isPointBlockedByWorld(
      v.position.x + fwdX * probeDist,
      v.position.z + fwdZ * probeDist,
      1.65,
      solidColliders,
      vehicleGrid,
    );
    const leftBlocked = this.isPointBlockedByWorld(
      v.position.x + (fwdX * 0.85 + rightX * 0.52) * (probeDist * 0.85),
      v.position.z + (fwdZ * 0.85 + rightZ * 0.52) * (probeDist * 0.85),
      1.55,
      solidColliders,
      vehicleGrid,
    );
    const rightBlocked = this.isPointBlockedByWorld(
      v.position.x + (fwdX * 0.85 - rightX * 0.52) * (probeDist * 0.85),
      v.position.z + (fwdZ * 0.85 - rightZ * 0.52) * (probeDist * 0.85),
      1.55,
      solidColliders,
      vehicleGrid,
    );

    if (centerBlocked) {
      avoidSteer = leftBlocked && !rightBlocked ? -1.1 : !leftBlocked && rightBlocked ? 1.1 : 1.0;
    } else if (leftBlocked && !rightBlocked) {
      avoidSteer = -0.65;
    } else if (rightBlocked && !leftBlocked) {
      avoidSteer = 0.65;
    }

    // Also steer around non-player vehicles in the pursuit path
    for (let i = 0; i < this.vehicles.length; i++) {
      const other = this.vehicles[i];
      if (other === v || other === this.activeVehicle || other.destroyed) continue;
      const dx = other.position.x - v.position.x;
      const dz = other.position.z - v.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 100) continue;
      const fwdProj = dx * fwdX + dz * fwdZ;
      if (fwdProj > 0.5 && fwdProj < 9.5) {
        const lat = dx * rightX + dz * rightZ;
        if (Math.abs(lat) < 2.4) {
          avoidSteer += lat >= 0 ? -0.9 : 0.9;
        }
      }
    }

    const desiredYaw = Math.atan2(toX, toZ) + avoidSteer * 0.85;
    let diff = desiredYaw - v.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    v.yaw += THREE.MathUtils.clamp(diff, -2.75 * dt, 2.75 * dt);

    const turnSlowdown = Math.max(0.45, 1 - Math.abs(diff) * 0.35);
    const targetSpeed = (dist > 7.5 ? 14.2 : 4.5) * (centerBlocked ? 0.55 : turnSlowdown);
    v.speed += (targetSpeed - v.speed) * (1 - Math.exp(-3.8 * dt));

    const prevX = v.position.x;
    const prevZ = v.position.z;
    this.moveVehicleWithCollision(v, dt, solidColliders, bounds, vehicleGrid);

    const moved = Math.hypot(v.position.x - prevX, v.position.z - prevZ);
    if (dist > 6.5 && moved < 0.7 * dt) {
      v.aiStuckTimer += dt;
      if (v.aiStuckTimer > 1.2) {
        v.aiStuckTimer = 0;
        v.aiReverseTimer = 0.95;
        v.aiReverseSteer = Math.random() > 0.5 ? 1 : -1;
      }
    } else {
      v.aiStuckTimer = Math.max(0, v.aiStuckTimer - dt * 2.0);
    }

    // Ram damage if police cruiser clips player
    if (dist < 3.2 && v.speed > 5.5 && this.ramCooldown <= 0) {
      this.ramCooldown = 1.4;
      this.onPoliceRamPlayer?.(14);
    }
  }

  private updatePlayerDrivenCar(
    v: Vehicle,
    dt: number,
    elapsed: number,
    isActive: boolean,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    pad?: GamepadSnapshot,
    stuntRamps?: StuntRamp[],
    drunkLevel = 0,
    getGroundHeight?: (x: number, z: number) => number,
    vehicleGrid?: SpatialGrid,
    radioBeatPulse = 0,
    lockDriving = false,
  ): void {
    // K.I.T.T. Turbo-Boost & DeLorean 88 MPH Time Jump on [SHIFT] while driving!
    if (isActive && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) {
      if (v.isKitt) {
        this.triggerKittTurboBoost(v);
      } else if (v.isDelorean && v.timeJumpReady) {
        this.triggerDeloreanTimeJump(v);
      }
    }

    const kbAccel = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const kbSteer = (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0);
    const padAccel = pad?.connected ? pad.rt - pad.lt : 0;
    const padSteer = pad?.connected ? -pad.moveX : 0;

    const accelInput = isActive ? THREE.MathUtils.clamp(kbAccel + padAccel, -1, 1) : 0;
    const drunkSteerDrift =
      drunkLevel > 0.005
        ? (Math.sin(elapsed * 1.65) * 0.44 + Math.sin(elapsed * 3.1) * 0.18) * drunkLevel
        : 0;
    const steerInput = isActive ? THREE.MathUtils.clamp(kbSteer + padSteer + drunkSteerDrift, -1.15, 1.15) : 0;
    const handbrake = isActive && (this.keys.has('Space') || Boolean(pad?.connected && pad.handbrake));

    const turboMult = v.tuned ? 1.28 : 1.0;
    const maxForward = (v.isBike ? 29.5 : v.isRv ? 18.0 : 25.0) * turboMult;
    const maxReverse = v.isBike ? -6.5 : v.isRv ? -6.5 : -9.0;

    if (accelInput > 0.05) {
      v.speed += (v.isBike ? 23.0 : v.isRv ? 11.5 : 18.5) * (v.tuned ? 1.32 : 1.0) * accelInput * dt;
    } else if (accelInput < -0.05) {
      v.speed += (v.speed > 0.5 ? 28.0 : 12.0) * accelInput * dt;
    } else {
      v.speed *= Math.exp(-2.2 * dt);
    }

    if (handbrake) {
      v.speed *= Math.exp(-4.6 * dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, maxReverse, maxForward);

    // Dynamic brake lights (bright red on S / Space) & white reverse lights (when reversing)
    if (v.tailMat) {
      const braking = handbrake || (accelInput < -0.1 && v.speed > 0.3);
      v.tailMat.emissiveIntensity = braking ? 6.8 : 2.4;
    }
    if (v.reverseMat) {
      const reversing = v.speed < -0.4;
      v.reverseMat.emissiveIntensity = reversing ? 4.5 : 0.05;
    }

    // Realistic banking lean into turns for the PCJ-86 Neon Bike!
    if (v.isBike) {
      const targetLean = -steerInput * 0.42 * Math.min(1, Math.abs(v.speed) / 14);
      v.mesh.rotation.z += (targetLean - v.mesh.rotation.z) * (1 - Math.exp(-10 * dt));
    }

    // Emit white-cyan tire drift smoke when handbraking at speed
    this.isDrifting = handbrake && Math.abs(v.speed) > 5.5;
    if (this.isDrifting) {
      this.driftSmokeTimer -= dt;
      if (this.driftSmokeTimer <= 0) {
        this.driftSmokeTimer = 0.045;
        const fwdX = Math.sin(v.yaw);
        const fwdZ = Math.cos(v.yaw);
        const rightX = Math.cos(v.yaw);
        const rightZ = -Math.sin(v.yaw);
        const driftSides = v.isBike ? [0] : [-0.95, 0.95];
        const rearOffset = v.isBike ? 0.82 : 1.35;
        for (const side of driftSides) {
          const wx = v.position.x - fwdX * rearOffset + rightX * side;
          const wz = v.position.z - fwdZ * rearOffset + rightZ * side;
          this.onDriftMark?.(wx, wz, v.yaw);
          const puff = this.acquireSmokeMesh('#d8e8f2', 0.52, 1.2);
          puff.position.set(wx, 0.24, wz);
          this.smokeParticles.push({
            mesh: puff,
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.9 + Math.random() * 0.7, (Math.random() - 0.5) * 1.2),
            life: 0.48,
            maxLife: 0.48,
          });
        }
      }
    }

    const speedFactor = Math.min(1, Math.abs(v.speed) / 4.5);
    const dirSign = v.speed >= 0 ? 1 : -1;
    const turnRate = (handbrake ? 2.75 : v.isBike ? 2.65 : 2.15) * speedFactor * dirSign;
    v.yaw += steerInput * turnRate * dt;

    this.moveVehicleWithCollision(v, dt, solidColliders, bounds, vehicleGrid);

    // Stunt Ramp elevation & airborne jump physics!
    let onRampHeight = 0;
    let rampLaunchVy = 0;
    if (stuntRamps) {
      for (const r of stuntRamps) {
        const relX = v.position.x - r.x;
        const relZ = v.position.z - r.z;
        // Project into ramp local space (along = forward up ramp, side = lateral)
        const along = relX * r.dirX + relZ * r.dirZ;
        const side = Math.abs(relX * r.dirZ - relZ * r.dirX);
        if (side < r.width * 0.55 && along > -r.length * 0.5 && along < r.length * 0.52) {
          const frac = (along + r.length * 0.5) / r.length;
          onRampHeight = Math.max(onRampHeight, frac * r.height);
          // Launching off the upper lip at speed!
          const alignedSpeed = v.speed * (Math.sin(v.yaw) * r.dirX + Math.cos(v.yaw) * r.dirZ);
          if (frac > 0.72 && alignedSpeed > 7.5) {
            rampLaunchVy = Math.min(11.5, alignedSpeed * 0.42);
          }
        }
      }
    }

    const baseGroundY = getGroundHeight ? Math.max(0, getGroundHeight(v.position.x, v.position.z)) : 0;

    let slopePitch = 0;
    if (onRampHeight > 0.05 && !v.airborne) {
      v.position.y = baseGroundY + onRampHeight;
      v.mesh.rotation.x = -0.24;
      if (rampLaunchVy > 0) {
        v.vy = rampLaunchVy;
        v.airborne = true;
        v.jumpStartX = v.position.x;
        v.jumpStartZ = v.position.z;
      }
    } else if (v.airborne) {
      v.vy -= 17.5 * dt;
      v.position.y += v.vy * dt;
      v.mesh.rotation.x = THREE.MathUtils.clamp(-v.vy * 0.035, -0.35, 0.28);
      if (v.position.y <= baseGroundY) {
        v.position.y = baseGroundY;
        v.vy = 0;
        v.mesh.rotation.x = 0;
        v.airborne = false;
        const jumpDist = Math.hypot(v.position.x - v.jumpStartX, v.position.z - v.jumpStartZ);
        if (jumpDist >= 10) {
          const reward = jumpDist >= 22 ? 600 : 400;
          this.onStuntLanded?.(Math.round(jumpDist), reward);
        }
      }
    } else if (v.position.y - baseGroundY > 0.9 && !v.airborne) {
      // Driving off a high cliff ledge -> launch into realistic airborne drop!
      v.airborne = true;
      v.vy = 0;
      v.jumpStartX = v.position.x;
      v.jumpStartZ = v.position.z;
    } else {
      v.position.y = baseGroundY;
      // Subtle natural pitch on the arched Miami Causeway Bridge!
      if (getGroundHeight) {
        const aheadY = Math.max(
          0,
          getGroundHeight(v.position.x + Math.sin(v.yaw) * 1.6, v.position.z + Math.cos(v.yaw) * 1.6),
        );
        slopePitch = -Math.atan2(aheadY - baseGroundY, 1.6);
        if (!v.hydraulics) {
          v.mesh.rotation.x += (slopePitch - v.mesh.rotation.x) * (1 - Math.exp(-12 * dt));
        }
      } else if (!v.hydraulics) {
        v.mesh.rotation.x *= 0.82;
      }
    }

    // Vice Customs Lowrider Hydraulics: crisp spring-bounce, subtle radio-beat groove & asphalt-safe lift!
    if (v.hydraulics && !v.airborne && onRampHeight <= 0.05) {
      let hy = v.hydroOffsetY ?? 0;
      let hvy = v.hydroVelY ?? 0;
      let hp = v.hydroPitch ?? 0;
      let hr = v.hydroRoll ?? 0;

      // Crisp hydraulic cylinder spring-damper back to neutral
      hvy += (-hy * 78.0 - hvy * 12.5) * dt;
      hy = Math.max(0, Math.min(0.24, hy + hvy * dt));
      if (hy <= 0.001 && hvy < 0) {
        hy = 0;
        hvy = 0;
      }
      hp *= Math.exp(-10.5 * dt);
      hr *= Math.exp(-10.5 * dt);

      v.hydroOffsetY = hy;
      v.hydroVelY = hvy;
      v.hydroPitch = hp;
      v.hydroRoll = hr;

      // Subtle, groovy auto-bounce on the live radio beat (never over-the-top!)
      const beatLift = !lockDriving && v.hydraulicsAutoBounce ? radioBeatPulse * 0.065 : 0;
      const beatPitch = !lockDriving && v.hydraulicsAutoBounce ? -radioBeatPulse * 0.025 : 0;
      const beatRoll = !lockDriving && v.hydraulicsAutoBounce ? Math.sin(elapsed * 3.2) * radioBeatPulse * 0.02 : 0;

      const totalPitch = slopePitch + hp + beatPitch;
      const totalRoll = hr + beatRoll;

      // Compensate Y-height for pitch/roll so wheels & bumpers NEVER sink into the asphalt!
      const halfLen = v.isRv ? 2.5 : 1.95;
      const halfWid = v.isRv ? 1.15 : 1.0;
      const clearanceLift = Math.abs(Math.sin(totalPitch)) * halfLen + Math.abs(Math.sin(totalRoll)) * halfWid;

      v.mesh.position.y = v.position.y + Math.max(hy + beatLift, clearanceLift);
      v.mesh.rotation.x = totalPitch;
      v.mesh.rotation.z = totalRoll;
    } else {
      v.mesh.position.y = v.position.y;
      if (!v.isBike) {
        v.mesh.rotation.z *= Math.exp(-10 * dt);
      }
    }

    // Back to the Future DeLorean DMC-12 VFX:
    // - >= 80% top speed: twin burning tire fire trails on the asphalt!
    // - ~100% top speed: crackling electric mini lightning bolts & sparks around the chassis!
    if (v.isDelorean) {
      const speedRatio = Math.max(0, v.speed) / maxForward;
      v.timeJumpReady = !v.airborne && (v.timeJumpCooldown ?? 0) <= 0 && speedRatio >= 0.985;
      const fwdX = Math.sin(v.yaw);
      const fwdZ = Math.cos(v.yaw);
      const rightX = Math.cos(v.yaw);
      const rightZ = -Math.sin(v.yaw);

      if (!v.airborne && speedRatio >= 0.8) {
        this.deloreanFireTimer -= dt;
        if (this.deloreanFireTimer <= 0) {
          this.deloreanFireTimer = 0.032;
          for (const side of [-0.92, 0.92]) {
            const fx = v.position.x - fwdX * 1.45 + rightX * side;
            const fz = v.position.z - fwdZ * 1.45 + rightZ * side;
            this.spawnDeloreanFireTrail(fx, baseGroundY, fz, v.yaw);

            // Occasional rising flame ember right off the burning tire track
            if (Math.random() < 0.45) {
              const ember = this.acquireSmokeMesh(Math.random() > 0.4 ? '#ff9922' : '#ff4411', 0.9, 0.48);
              ember.position.set(fx + (Math.random() - 0.5) * 0.25, baseGroundY + 0.14, fz + (Math.random() - 0.5) * 0.25);
              this.smokeParticles.push({
                mesh: ember,
                vel: new THREE.Vector3((Math.random() - 0.5) * 0.9, 1.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.9),
                life: 0.35 + Math.random() * 0.2,
                maxLife: 0.55,
              });
            }
          }
        }
      }

      if (speedRatio >= 0.985) {
        this.deloreanSparkTimer -= dt;
        if (this.deloreanSparkTimer <= 0) {
          this.deloreanSparkTimer = 0.045;
          // 1–2 crackling cyan-white electric lightning arcs jumping around the car
          this.spawnDeloreanLightningBolt(v);
          if (Math.random() < 0.55) {
            this.spawnDeloreanLightningBolt(v);
          }
          // Flying electric blue/white & golden sparks bursting off the DeLorean
          for (let s = 0; s < 3; s++) {
            const col = s === 0 ? '#7ef9ff' : s === 1 ? '#ffffff' : '#ffe082';
            const spark = this.acquireSmokeMesh(col, 0.95, 0.24);
            const sx = v.position.x + rightX * ((Math.random() - 0.5) * 2.2) + fwdX * ((Math.random() - 0.5) * 4.0);
            const sy = v.position.y + 0.3 + Math.random() * 1.05;
            const sz = v.position.z + rightZ * ((Math.random() - 0.5) * 2.2) + fwdZ * ((Math.random() - 0.5) * 4.0);
            spark.position.set(sx, sy, sz);
            this.smokeParticles.push({
              mesh: spark,
              vel: new THREE.Vector3(
                (Math.random() - 0.5) * 5.0 - fwdX * 3.5,
                1.6 + Math.random() * 3.2,
                (Math.random() - 0.5) * 5.0 - fwdZ * 3.5,
              ),
              life: 0.24 + Math.random() * 0.16,
              maxLife: 0.4,
            });
          }
        }
      }
    }

    if (Math.abs(v.speed) > 4.0) {
      this.onVehicleHitNpc?.(v.position, Math.abs(v.speed));
    }
  }

  private moveVehicleWithCollision(
    v: Vehicle,
    dt: number,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    vehicleGrid?: SpatialGrid,
  ): void {
    const dx = Math.sin(v.yaw) * v.speed * dt;
    const dz = Math.cos(v.yaw) * v.speed * dt;

    let nextX = THREE.MathUtils.clamp(v.position.x + dx, bounds.minX + 1.5, bounds.maxX - 4.0);
    let nextZ = THREE.MathUtils.clamp(v.position.z + dz, bounds.minZ + 1.5, bounds.maxZ - 1.5);

    // Prevent driving into deep ocean off Miami Beach or off the South Port Quay (z > 124.2)
    if (nextX > 103 && nextX < 147 && Math.abs(nextZ - -60) > 6.2) {
      nextX = 103;
    }
    if (nextZ > 68 && nextX > 76) {
      nextX = 76;
    }
    if (nextZ > 124.2) {
      nextZ = 124.2;
    }
    if (nextX >= 147 && (nextZ < -83 || nextZ > -21)) {
      nextZ = THREE.MathUtils.clamp(nextZ, -83, -21);
    }

    const carRadius = v.isBike ? 0.72 : 1.45;
    const vehTop = v.position.y + (v.isRv ? 2.75 : 1.55);
    let collided = false;

    const boxes = vehicleGrid
      ? vehicleGrid.queryBox(
          nextX - carRadius - 0.4,
          nextX + carRadius + 0.4,
          nextZ - carRadius - 0.4,
          nextZ + carRadius + 0.4,
          solidColliders,
          this.localColliders,
        )
      : solidColliders;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (v.position.y >= box.maxY || vehTop <= box.minY) continue;
      if (
        nextX + carRadius > box.minX &&
        nextX - carRadius < box.maxX &&
        nextZ + carRadius > box.minZ &&
        nextZ - carRadius < box.maxZ
      ) {
        const pLeft = box.minX - (nextX + carRadius);
        const pRight = box.maxX - (nextX - carRadius);
        const pBack = box.minZ - (nextZ + carRadius);
        const pFront = box.maxZ - (nextZ - carRadius);
        const minAbs = Math.min(Math.abs(pLeft), Math.abs(pRight), Math.abs(pBack), Math.abs(pFront));
        if (minAbs === Math.abs(pLeft)) nextX += pLeft;
        else if (minAbs === Math.abs(pRight)) nextX += pRight;
        else if (minAbs === Math.abs(pBack)) nextZ += pBack;
        else nextZ += pFront;
        collided = true;
      }
    }

    if (collided) {
      const impactSpeed = Math.abs(v.speed);
      if (impactSpeed > 8.5) {
        const wallDmg = (impactSpeed - 7.5) * 3.4;
        this.damageVehicle(v, wallDmg);
        this.spawnCrashSparks(this.tmpImpactPos.set(nextX, 0.7, nextZ), 6);
        if (this.crashSoundCooldown <= 0) {
          this.crashSoundCooldown = 0.25;
          this.onCarCrash?.(Math.min(1, impactSpeed / 20), v === this.activeVehicle);
        }
      }
      v.speed *= -0.22;
    }

    v.position.x = nextX;
    v.position.z = nextZ;
    v.mesh.position.x = v.position.x;
    v.mesh.position.z = v.position.z;
    v.mesh.rotation.y = v.yaw;
  }

  private updateAiCar(
    v: Vehicle,
    dt: number,
    playerPos: THREE.Vector3,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    shouldTrafficStop?: (x: number, z: number, yaw: number) => boolean,
    vehicleGrid?: SpatialGrid,
  ): void {
    // Brief smooth reverse maneuver if blocked / stuck
    if (v.aiReverseTimer > 0) {
      v.aiReverseTimer -= dt;
      v.speed += (-3.8 - v.speed) * (1 - Math.exp(-4.5 * dt));
      v.yaw += v.aiReverseSteer * 1.45 * dt;
      if (v.reverseMat) v.reverseMat.emissiveIntensity = 4.2;
      if (v.tailMat) v.tailMat.emissiveIntensity = 2.4;
      this.moveVehicleWithCollision(v, dt, solidColliders, bounds, vehicleGrid);
      return;
    }
    if (v.reverseMat) v.reverseMat.emissiveIntensity = 0.05;

    const toX = v.aiTargetX - v.position.x;
    const toZ = v.aiTargetZ - v.position.z;
    const distToWaypoint = Math.hypot(toX, toZ);

    if (distToWaypoint < 3.4) {
      this.pickNextAiWaypoint(v);
    }

    const fwdX = Math.sin(v.yaw);
    const fwdZ = Math.cos(v.yaw);
    // In Three.js (+Z forward, +Y up), left is (+cos, -sin) and right is (-cos, +sin)
    const leftX = Math.cos(v.yaw);
    const leftZ = -Math.sin(v.yaw);

    // 1) Red traffic light check
    const redLight = shouldTrafficStop ? shouldTrafficStop(v.position.x, v.position.z, v.yaw) : false;
    let targetSpeed = redLight ? 0 : v.aiSpeed;
    let avoidLateral = 0;

    // 2) Pedestrian / Player-on-foot forward cone braking (only brake if player is AHEAD, not behind!)
    if (!this.activeVehicle) {
      const pdx = playerPos.x - v.position.x;
      const pdz = playerPos.z - v.position.z;
      const pFwd = pdx * fwdX + pdz * fwdZ;
      const pLat = pdx * leftX + pdz * leftZ;
      if (pFwd > 0.5 && pFwd < 10.5 && Math.abs(pLat) < 2.4) {
        targetSpeed = 0;
      }
    }

    // 3) Predictive vehicle-ahead radar: follow smoothly, yield at intersections, or steer around parked/stopped obstacles!
    for (let i = 0; i < this.vehicles.length; i++) {
      const other = this.vehicles[i];
      if (other === v || other.destroyed) continue;

      const dx = other.position.x - v.position.x;
      const dz = other.position.z - v.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 16 * 16) continue;

      const fwdProj = dx * fwdX + dz * fwdZ;
      if (fwdProj < 0.2 || fwdProj > 14.5) continue;

      const latProj = dx * leftX + dz * leftZ; // positive = other is to our left, negative = to our right
      const halfClearance = (v.isRv || other.isRv ? 2.55 : 2.25);

      if (Math.abs(latProj) < halfClearance) {
        const otherFwdDot = Math.sin(other.yaw) * fwdX + Math.cos(other.yaw) * fwdZ;
        const otherSpeedAlong = other.speed * otherFwdDot;

        if (fwdProj < 6.4) {
          // Very close obstacle -> stop cleanly!
          targetSpeed = 0;
        } else if (Math.abs(other.speed) < 1.2 && fwdProj < 11.5) {
          // Stationary car partially blocking lane -> gently nudge around it toward road center & slow down
          const nudgeDir = latProj >= 0 ? -1 : 1; // steer away from the obstacle
          avoidLateral += nudgeDir * 0.55;
          targetSpeed = Math.min(targetSpeed, 3.8);
        } else if (otherFwdDot > 0.5) {
          // Moving car in same lane -> match its speed with safe following distance!
          const followFactor = THREE.MathUtils.clamp((fwdProj - 6.0) / 7.5, 0, 1);
          const safeSpeed = Math.max(0, Math.min(v.aiSpeed, otherSpeedAlong + 0.5)) * followFactor;
          targetSpeed = Math.min(targetSpeed, safeSpeed);
        } else {
          // Crossing or oncoming vehicle in our path (e.g. at an intersection) -> yield!
          if (fwdProj < 10.5) {
            targetSpeed = Math.min(targetSpeed, fwdProj < 7.8 ? 0 : 2.2);
          }
        }
      }
    }

    // 4) Static world / roadblock ahead check
    const staticAheadDist = Math.max(4.8, Math.abs(v.speed) * 0.65);
    const staticBlocked = this.isPointBlockedByWorld(
      v.position.x + fwdX * staticAheadDist,
      v.position.z + fwdZ * staticAheadDist,
      1.55,
      solidColliders,
      vehicleGrid,
    );
    if (staticBlocked) {
      targetSpeed = 0;
    }

    // 5) Smooth cornering speed modulation & steering toward lane waypoint
    const steerTargetX = v.aiTargetX + leftX * avoidLateral * 2.2;
    const steerTargetZ = v.aiTargetZ + leftZ * avoidLateral * 2.2;
    const desiredYaw = Math.atan2(steerTargetX - v.position.x, steerTargetZ - v.position.z);
    let diff = desiredYaw - v.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) > 0.35) {
      targetSpeed = Math.min(targetSpeed, v.aiSpeed * Math.max(0.42, 1 - Math.abs(diff) * 0.38));
    }

    const brakeRate = targetSpeed < v.speed ? 6.2 : 3.2;
    v.speed += (targetSpeed - v.speed) * (1 - Math.exp(-brakeRate * dt));
    if (targetSpeed === 0 && Math.abs(v.speed) < 0.15) v.speed = 0;

    // Realistic brake lights when AI slows or stops!
    if (v.tailMat) {
      v.tailMat.emissiveIntensity = targetSpeed < 0.8 || targetSpeed < v.speed - 1.2 ? 6.2 : 2.4;
    }

    const turnRate = (Math.abs(v.speed) > 0.4 ? 2.65 : 1.2) * dt;
    v.yaw += THREE.MathUtils.clamp(diff, -turnRate, turnRate);

    const prevX = v.position.x;
    const prevZ = v.position.z;
    if (Math.abs(v.speed) > 0.02) {
      this.moveVehicleWithCollision(v, dt, solidColliders, bounds, vehicleGrid);
    } else {
      v.mesh.rotation.y = v.yaw;
    }

    // 6) Stuck detection (only when AI *wants* to drive, not when waiting at a red light or behind traffic!)
    const moved = Math.hypot(v.position.x - prevX, v.position.z - prevZ);
    if (targetSpeed > 2.5 && !redLight && moved < 0.35 * dt) {
      v.aiStuckTimer += dt;
      if (v.aiStuckTimer > 1.8) {
        v.aiStuckTimer = 0;
        v.aiReverseTimer = 1.05;
        v.aiReverseSteer = Math.random() > 0.5 ? 1 : -1;
      }
    } else {
      v.aiStuckTimer = Math.max(0, v.aiStuckTimer - dt * 2.0);
    }
  }

  private pickNextAiWaypoint(v: Vehicle): void {
    const curX = this.nearestRoadCoord(v.position.x);
    const curZ = this.nearestRoadCoord(v.position.z);
    v.aiNodeX = curX;
    v.aiNodeZ = curZ;

    const ix = ROAD_COORDS.indexOf(curX);
    const iz = ROAD_COORDS.indexOf(curZ);

    const allDirs: { nx: number; nz: number; dx: number; dz: number }[] = [];
    if (ix > 0) allDirs.push({ nx: ROAD_COORDS[ix - 1], nz: curZ, dx: -1, dz: 0 });
    if (ix < ROAD_COORDS.length - 1) allDirs.push({ nx: ROAD_COORDS[ix + 1], nz: curZ, dx: 1, dz: 0 });
    if (iz > 0) allDirs.push({ nx: curX, nz: ROAD_COORDS[iz - 1], dx: 0, dz: -1 });
    if (iz < ROAD_COORDS.length - 1) allDirs.push({ nx: curX, nz: ROAD_COORDS[iz + 1], dx: 0, dz: 1 });

    // Never make an immediate 180° U-turn if forward/left/right routes exist!
    const nonReverse = allDirs.filter((c) => !(c.dx === -v.aiDirX && c.dz === -v.aiDirZ));
    const pool = nonReverse.length > 0 ? nonReverse : allDirs;

    // Prefer continuing straight (~50%) for natural boulevard cruising, otherwise turn cleanly
    const straight = pool.find((c) => c.dx === v.aiDirX && c.dz === v.aiDirZ);
    const pick =
      straight && Math.random() < 0.52
        ? straight
        : pool[Math.floor(Math.random() * pool.length)] ?? { nx: 20, nz: 20, dx: 0, dz: 1 };

    v.aiDirX = pick.dx;
    v.aiDirZ = pick.dz;

    // Right-hand lane offset perpendicular to travel direction (dx, dz):
    // In Three.js (+Z south, +X east), right of (dx, dz) is (-dz, dx)!
    const rightLaneX = -pick.dz * LANE_OFFSET;
    const rightLaneZ = pick.dx * LANE_OFFSET;

    v.aiTargetX = pick.nx + rightLaneX;
    v.aiTargetZ = pick.nz + rightLaneZ;
  }
}
