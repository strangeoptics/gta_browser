import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { StuntRamp } from '../world/StuntRamps';
import { ROAD_COORDS } from '../world/CityLayout';
import { createCarModel, type CarModelType } from './CarBuilder';
import { createMotorcycleMesh } from './MotorcycleBuilder';

export interface Vehicle {
  id: string;
  name: string;
  isPolice: boolean;
  isPursuitUnit: boolean;
  isBike: boolean;
  isRv: boolean;
  mesh: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  riderMesh?: THREE.Group;
  kickstand?: THREE.Object3D;
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
  // AI traffic state
  isAiControlled: boolean;
  aiSpeed: number;
  aiTargetX: number;
  aiTargetZ: number;
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
  light: THREE.PointLight;
  life: number;
  maxLife: number;
}

interface SmokeParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

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
}[] = [
  { name: 'DELOREAN DMC-12', model: 'delorean', color: '#c8d0d8', neon: '#36f1e6', x: 56.8, z: 16, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false },
  { name: 'PCJ-86 NEON BIKE', model: 'supercar', color: '#36f1e6', neon: '#ff4fa3', x: 63.2, z: 20, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: true },
  { name: 'TESLA CYBERTRUCK', model: 'cybertruck', color: '#c2c9d2', neon: '#5ee8ff', x: 63.2, z: -12, yaw: 0, ai: false, police: false, pursuit: false, bike: false },
  { name: '1982 PONTIAC TRANS AM', model: 'transam', color: '#101118', neon: '#ff1e38', x: 56.8, z: -26, yaw: 0, ai: false, police: false, pursuit: false, bike: false },
  { name: 'DODGE CHALLENGER', model: 'challenger', color: '#e64928', neon: '#ff9f43', x: 16.8, z: 6, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false },
  { name: '1986 FLEETWOOD BOUNDER', model: 'bounder', color: '#e8dec5', neon: '#ffbe55', x: -23.2, z: -14, yaw: 0, ai: false, police: false, pursuit: false, bike: false },
  { name: '1974 DODGE MONACO', model: 'monaco', color: '#14151c', neon: '#36f1e6', x: -16.8, z: 24, yaw: Math.PI, ai: false, police: false, pursuit: false, bike: false },
  { name: 'VICE PD CRUISER', model: 'police', color: '#1b1b26', neon: '#36f1e6', x: -26.8, z: 6.8, yaw: 0, ai: false, police: true, pursuit: true, bike: false },
  { name: 'VICE PD INTERCEPTOR', model: 'police', color: '#1b1b26', neon: '#ff3355', x: 20, z: 58, yaw: Math.PI, ai: true, police: true, pursuit: true, bike: false },
  // Cruising traffic cars on the road grid
  { name: 'CHEETAH GT', model: 'supercar', color: '#ff4fa3', neon: '#ff4fa3', x: 20, z: -48, yaw: 0, ai: true, police: false, pursuit: false, bike: false },
  { name: 'DODGE CHALLENGER RT', model: 'challenger', color: '#36c9c6', neon: '#36f1e6', x: -60, z: 20, yaw: Math.PI / 2, ai: true, police: false, pursuit: false, bike: false },
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
  private readonly smokeParticles: SmokeParticle[] = [];
  private readonly smokeGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);

  // Dynamic headlight SpotLight for the player-driven car (illuminates wet asphalt & facades!)
  private readonly headlightSpot: THREE.SpotLight;
  private readonly headlightTarget = new THREE.Object3D();
  private isDrifting = false;
  private driftSmokeTimer = 0;

  public onVehicleHitNpc?: (vehiclePos: THREE.Vector3, speed: number) => void;
  public onVehicleExploded?: (pos: THREE.Vector3, radius: number, maxDamage: number) => void;
  public onPoliceRamPlayer?: (damage: number) => void;
  public onCarCrash?: (intensity: number, playerInvolved: boolean) => void;
  public onActiveVehicleDestroyed?: () => void;
  public onDriftMark?: (x: number, z: number, yaw: number) => void;
  public onStuntLanded?: (distanceM: number, reward: number) => void;
  private ramCooldown = 0;
  private crashSoundCooldown = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Warm halogen headlight cone for the active player vehicle
    this.headlightSpot = new THREE.SpotLight('#ffe4b5', 0, 44, Math.PI / 5.2, 0.55, 1.4);
    this.headlightSpot.target = this.headlightTarget;
    this.scene.add(this.headlightSpot);
    this.scene.add(this.headlightTarget);

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

      const isRv = spec.model === 'bounder';
      const maxHp = isRv ? 240 : spec.model === 'cybertruck' ? 210 : 140;
      const v: Vehicle = {
        id: `car-${idx}`,
        name: spec.name,
        isPolice: spec.police,
        isPursuitUnit: spec.pursuit,
        isBike: spec.bike,
        isRv,
        mesh: built.group,
        bodyMat: built.bodyMat,
        riderMesh: built.riderMesh,
        kickstand: 'kickstand' in built ? built.kickstand : undefined,
        originalColor: spec.color,
        position: new THREE.Vector3(spec.x, 0, spec.z),
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
        aiSpeed: spec.ai ? 7.5 : 0,
        aiTargetX: spec.x,
        aiTargetZ: spec.z,
      };
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

  public exitVehicle(): { x: number; y: number; z: number; yaw: number } | null {
    if (!this.activeVehicle) return null;
    const v = this.activeVehicle;
    if (v.riderMesh) v.riderMesh.visible = false;
    if (v.kickstand) v.kickstand.visible = true;
    v.mesh.rotation.z = v.isBike ? 0.09 : 0;
    const sideX = Math.cos(v.yaw) * -2.2;
    const sideZ = -Math.sin(v.yaw) * -2.2;
    const out = {
      x: THREE.MathUtils.clamp(v.position.x + sideX, -65, 76),
      y: 0.25,
      z: THREE.MathUtils.clamp(v.position.z + sideZ, -65, 65),
      yaw: v.yaw + Math.PI,
    };
    this.activeVehicle = null;
    this.keys.clear();
    return out;
  }

  public getShootableTargets(): ShootableTarget[] {
    return this.vehicles
      .filter((v) => v !== this.activeVehicle && !v.destroyed)
      .map((v) => ({
        id: v.id,
        mesh: v.mesh,
        onHit: (damage: number) => {
          this.damageVehicle(v, damage);
          return v.destroyed;
        },
      }));
  }

  /**
   * Returns AABB colliders for all non-driven vehicles so the player on foot
   * cannot walk through cars (and can jump onto their hoods/roofs).
   */
  public getVehicleColliders(): AABB[] {
    const out: AABB[] = [];
    for (const v of this.vehicles) {
      if (v === this.activeVehicle) continue;
      const cos = Math.abs(Math.cos(v.yaw));
      const sin = Math.abs(Math.sin(v.yaw));
      const wHalf = v.isBike ? 0.52 : v.isRv ? 1.18 : 1.05;
      const lHalf = v.isBike ? 1.25 : v.isRv ? 3.05 : 2.25;
      const halfX = wHalf * cos + lHalf * sin;
      const halfZ = wHalf * sin + lHalf * cos;
      out.push({
        minX: v.position.x - halfX,
        maxX: v.position.x + halfX,
        minY: 0,
        maxY: v.isRv ? 2.75 : 1.5,
        minZ: v.position.z - halfZ,
        maxZ: v.position.z + halfZ,
        tag: 'vehicle',
      });
    }
    return out;
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
    const sphereMat = new THREE.MeshBasicMaterial({
      color: '#ff8833',
      transparent: true,
      opacity: 0.92,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), sphereMat);
    sphere.position.set(origin.x, origin.y + 0.9, origin.z);
    this.scene.add(sphere);

    const light = new THREE.PointLight('#ff6a22', 60, 32, 1.5);
    light.position.copy(sphere.position);
    this.scene.add(light);

    this.explosions.push({ sphere, light, life: 0.48, maxLife: 0.48 });

    // Burst of fiery + smoke particles
    for (let i = 0; i < 20; i++) {
      const isFire = i < 12;
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? (i % 2 === 0 ? '#ffaa33' : '#ff4422') : '#2a222b',
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(this.smokeGeo, mat);
      mesh.position.set(origin.x, origin.y + 0.8, origin.z);
      mesh.scale.setScalar(isFire ? 1.1 : 1.5);
      this.scene.add(mesh);

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
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? '#ffd27d' : '#ff7b33',
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(this.smokeGeo, mat);
      mesh.scale.setScalar(0.32);
      mesh.position.set(origin.x, 0.72, origin.z);
      this.scene.add(mesh);

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
        this.clampCarAgainstBuildings(a, solidColliders);
        this.clampCarAgainstBuildings(b, solidColliders);

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

            const contact = new THREE.Vector3(hitPointX, 0.7, hitPointZ);
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

  private clampCarAgainstBuildings(v: Vehicle, solidColliders: AABB[]): void {
    const carRadius = v.isBike ? 0.78 : 1.45;
    for (const box of solidColliders) {
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
  ): DrivingHudState {
    const clampedDt = Math.min(dt, 0.05);
    this.ramCooldown = Math.max(0, this.ramCooldown - clampedDt);
    this.crashSoundCooldown = Math.max(0, this.crashSoundCooldown - clampedDt);

    if (this.activeVehicle && pad?.connected && pad.camTogglePressed) {
      this.firstPersonCam = !this.firstPersonCam;
    }

    const solidColliders = worldColliders.filter((c) => c.maxY > 0.45);

    for (const v of this.vehicles) {
      if (!v.airborne && v.position.y <= 0.05) {
        v.mesh.position.y += (v.position.y - v.mesh.position.y) * (1 - Math.exp(-12 * clampedDt));
      }

      // Respawn destroyed cars cleanly after cooldown
      if (v.destroyed) {
        v.respawnTimer -= clampedDt;
        this.emitDamageSmoke(v, clampedDt, false);
        if (v.respawnTimer <= 0) {
          v.destroyed = false;
          v.hp = v.maxHp;
          v.position.set(v.spawnX, 0, v.spawnZ);
          v.yaw = v.spawnYaw;
          v.speed = 0;
          v.bodyMat.color.set(v.originalColor);
          v.bodyMat.roughness = 0.24;
          v.mesh.position.set(v.spawnX, 0, v.spawnZ);
          v.mesh.rotation.y = v.spawnYaw;
        }
        continue;
      }

      // Damaged smoke / fire warning
      if (v.hp < 65) {
        this.emitDamageSmoke(v, clampedDt, v.hp < 32);
      }

      // Police lightbar flash
      if (v.isPolice && v.lightbarRed && v.lightbarBlue) {
        const activeFlash = wantedStars > 0 || v === this.activeVehicle;
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
      if (v.scannerLeds && v.scannerLeds.length > 0) {
        const sweepPos = ((Math.sin(elapsed * 3.8) + 1) * 0.5) * (v.scannerLeds.length - 1);
        for (let s = 0; s < v.scannerLeds.length; s++) {
          const dist = Math.abs(s - sweepPos);
          const glow = Math.max(0.15, 4.4 - dist * 2.2);
          (v.scannerLeds[s].material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
        }
      }

      if (v === this.activeVehicle) {
        this.updatePlayerDrivenCar(v, clampedDt, elapsed, isActive, solidColliders, bounds, pad, stuntRamps, drunkLevel);
      } else if (v.isPursuitUnit && wantedStars >= 2) {
        // Active Vice PD Cruiser chase!
        this.updatePolicePursuitCar(v, clampedDt, playerPos, solidColliders, bounds);
      } else if (v.isAiControlled) {
        this.updateAiCar(v, clampedDt, playerPos, shouldTrafficStop);
      } else {
        v.speed *= Math.exp(-3.2 * clampedDt);
        if (Math.abs(v.speed) > 0.05) {
          this.moveVehicleWithCollision(v, clampedDt, solidColliders, bounds);
        }
      }

      const wheelRot = v.speed * clampedDt * 2.4;
      for (const w of v.wheels) {
        w.rotation.x += wheelRot;
      }
    }

    // Resolve solid car-to-car collisions & severity-based crash damage
    this.resolveCarToCarCollisions(solidColliders, bounds);

    this.updateExplosionVfx(clampedDt);

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
        const desiredPos = new THREE.Vector3(
          v.position.x - forwardX * chaseBack,
          v.position.y + chaseUp,
          v.position.z - forwardZ * chaseBack,
        );
        const desiredLook = new THREE.Vector3(
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

    const mat = new THREE.MeshBasicMaterial({
      color: fiery && Math.random() > 0.45 ? '#ff7722' : '#2e2633',
      transparent: true,
      opacity: 0.78,
    });
    const mesh = new THREE.Mesh(this.smokeGeo, mat);
    const hoodX = v.position.x + Math.sin(v.yaw) * 1.3;
    const hoodZ = v.position.z + Math.cos(v.yaw) * 1.3;
    mesh.position.set(hoodX + (Math.random() - 0.5) * 0.4, 0.95, hoodZ + (Math.random() - 0.5) * 0.4);
    this.scene.add(mesh);

    this.smokeParticles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.8 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8),
      life: 0.85,
      maxLife: 0.85,
    });
  }

  private updateExplosionVfx(dt: number): void {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      if (ex.life <= 0) {
        this.scene.remove(ex.sphere);
        this.scene.remove(ex.light);
        ex.sphere.geometry.dispose();
        (ex.sphere.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      } else {
        const t = 1 - ex.life / ex.maxLife;
        const scale = 1 + t * 5.2;
        ex.sphere.scale.setScalar(scale);
        (ex.sphere.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.88;
        ex.light.intensity = (1 - t) * 65;
      }
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.smokeParticles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        p.vel.y -= 3.2 * dt;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.life / p.maxLife) * 0.85);
      }
    }
  }

  private updatePolicePursuitCar(
    v: Vehicle,
    dt: number,
    playerPos: THREE.Vector3,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ): void {
    const toX = playerPos.x - v.position.x;
    const toZ = playerPos.z - v.position.z;
    const dist = Math.hypot(toX, toZ);

    const desiredYaw = Math.atan2(toX, toZ);
    let diff = desiredYaw - v.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    v.yaw += THREE.MathUtils.clamp(diff, -2.6 * dt, 2.6 * dt);

    const targetSpeed = dist > 7.5 ? 14.5 : 4.5;
    v.speed += (targetSpeed - v.speed) * (1 - Math.exp(-3.5 * dt));

    this.moveVehicleWithCollision(v, dt, solidColliders, bounds);

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
  ): void {
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

    const maxForward = v.isBike ? 29.5 : v.isRv ? 18.0 : 25.0;
    const maxReverse = v.isBike ? -6.5 : v.isRv ? -6.5 : -9.0;

    if (accelInput > 0.05) {
      v.speed += (v.isBike ? 23.0 : v.isRv ? 11.5 : 18.5) * accelInput * dt;
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
          const mat = new THREE.MeshBasicMaterial({
            color: '#d8e8f2',
            transparent: true,
            opacity: 0.52,
          });
          const puff = new THREE.Mesh(this.smokeGeo, mat);
          puff.scale.setScalar(1.2);
          puff.position.set(wx, 0.24, wz);
          this.scene.add(puff);
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

    this.moveVehicleWithCollision(v, dt, solidColliders, bounds);

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

    if (onRampHeight > 0.05 && !v.airborne) {
      v.position.y = onRampHeight;
      v.mesh.rotation.x = -0.24;
      if (rampLaunchVy > 0) {
        v.vy = rampLaunchVy;
        v.airborne = true;
        v.jumpStartX = v.position.x;
        v.jumpStartZ = v.position.z;
      }
    } else if (v.airborne || v.position.y > 0.02) {
      v.vy -= 17.5 * dt;
      v.position.y += v.vy * dt;
      v.mesh.rotation.x = THREE.MathUtils.clamp(-v.vy * 0.035, -0.35, 0.28);
      if (v.position.y <= 0) {
        v.position.y = 0;
        v.vy = 0;
        v.mesh.rotation.x = 0;
        if (v.airborne) {
          v.airborne = false;
          const jumpDist = Math.hypot(v.position.x - v.jumpStartX, v.position.z - v.jumpStartZ);
          if (jumpDist >= 10) {
            const reward = jumpDist >= 22 ? 600 : 400;
            this.onStuntLanded?.(Math.round(jumpDist), reward);
          }
        }
      }
    } else {
      v.mesh.rotation.x *= 0.82;
    }
    v.mesh.position.y = v.position.y;

    if (Math.abs(v.speed) > 4.0) {
      this.onVehicleHitNpc?.(v.position, Math.abs(v.speed));
    }
  }

  private moveVehicleWithCollision(
    v: Vehicle,
    dt: number,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ): void {
    const dx = Math.sin(v.yaw) * v.speed * dt;
    const dz = Math.cos(v.yaw) * v.speed * dt;

    let nextX = THREE.MathUtils.clamp(v.position.x + dx, bounds.minX + 1.5, bounds.maxX - 4.0);
    let nextZ = THREE.MathUtils.clamp(v.position.z + dz, bounds.minZ + 1.5, bounds.maxZ - 1.5);

    const carRadius = v.isBike ? 0.78 : 1.45;
    let collided = false;

    for (const box of solidColliders) {
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
        this.spawnCrashSparks(new THREE.Vector3(nextX, 0.7, nextZ), 6);
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
    shouldTrafficStop?: (x: number, z: number, yaw: number) => boolean,
  ): void {
    const distToPlayer = v.position.distanceTo(playerPos);
    const redLight = shouldTrafficStop ? shouldTrafficStop(v.position.x, v.position.z, v.yaw) : false;
    const targetSpeed = distToPlayer < 8.0 || redLight ? 0 : v.aiSpeed;
    v.speed += (targetSpeed - v.speed) * (1 - Math.exp(-3.5 * dt));

    const toX = v.aiTargetX - v.position.x;
    const toZ = v.aiTargetZ - v.position.z;
    const dist = Math.hypot(toX, toZ);

    if (dist < 2.2) {
      this.pickNextAiWaypoint(v);
      return;
    }

    const desiredYaw = Math.atan2(toX, toZ);
    let diff = desiredYaw - v.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.yaw += THREE.MathUtils.clamp(diff, -2.5 * dt, 2.5 * dt);

    v.position.x += Math.sin(v.yaw) * v.speed * dt;
    v.position.z += Math.cos(v.yaw) * v.speed * dt;
    v.mesh.position.x = v.position.x;
    v.mesh.position.z = v.position.z;
    v.mesh.rotation.y = v.yaw;
  }

  private pickNextAiWaypoint(v: Vehicle): void {
    let nearestX = ROAD_COORDS[0];
    let nearestZ = ROAD_COORDS[0];
    for (const r of ROAD_COORDS) {
      if (Math.abs(r - v.position.x) < Math.abs(nearestX - v.position.x)) nearestX = r;
      if (Math.abs(r - v.position.z) < Math.abs(nearestZ - v.position.z)) nearestZ = r;
    }

    const candidates: { x: number; z: number }[] = [];
    const ix = ROAD_COORDS.indexOf(nearestX);
    const iz = ROAD_COORDS.indexOf(nearestZ);
    if (ix > 0) candidates.push({ x: ROAD_COORDS[ix - 1], z: nearestZ });
    if (ix < ROAD_COORDS.length - 1) candidates.push({ x: ROAD_COORDS[ix + 1], z: nearestZ });
    if (iz > 0) candidates.push({ x: nearestX, z: ROAD_COORDS[iz - 1] });
    if (iz < ROAD_COORDS.length - 1) candidates.push({ x: nearestX, z: ROAD_COORDS[iz + 1] });

    const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? { x: 20, z: 20 };
    v.aiTargetX = pick.x;
    v.aiTargetZ = pick.z;
  }
}
