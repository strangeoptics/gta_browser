import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import { ROAD_COORDS } from '../world/CityLayout';

export interface Vehicle {
  id: string;
  name: string;
  isPolice: boolean;
  isPursuitUnit: boolean;
  mesh: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  originalColor: string;
  position: THREE.Vector3;
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  yaw: number;
  speed: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  respawnTimer: number;
  smokeTimer: number;
  wheels: THREE.Mesh[];
  lightbarRed?: THREE.Mesh;
  lightbarBlue?: THREE.Mesh;
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

const CAR_SPECS = [
  { name: 'CHEETAH GT', color: '#ff4fa3', neon: '#ff4fa3', x: 56.8, z: 16, yaw: Math.PI, ai: false, police: false, pursuit: false },
  { name: 'INFERNUS 86', color: '#36f1e6', neon: '#36f1e6', x: 63.2, z: -12, yaw: 0, ai: false, police: false, pursuit: false },
  { name: 'SOLARIS CABRIO', color: '#ff9f43', neon: '#ff9f43', x: 16.8, z: 6, yaw: Math.PI, ai: false, police: false, pursuit: false },
  { name: 'PALM COUPE', color: '#f5e6d3', neon: '#36f1e6', x: -23.2, z: -14, yaw: 0, ai: false, police: false, pursuit: false },
  { name: 'VICE PD CRUISER', color: '#1b1b26', neon: '#36f1e6', x: -16.8, z: 24, yaw: Math.PI, ai: false, police: true, pursuit: true },
  { name: 'VICE PD INTERCEPTOR', color: '#1b1b26', neon: '#ff3355', x: 20, z: 58, yaw: Math.PI, ai: true, police: true, pursuit: true },
  // Cruising traffic cars on the road grid
  { name: 'BANSHEE TURBO', color: '#ff5e7e', neon: '#ff4fa3', x: 20, z: -48, yaw: 0, ai: true, police: false, pursuit: false },
  { name: 'OCEAN CRUISER', color: '#bce0d8', neon: '#36f1e6', x: -60, z: 20, yaw: Math.PI / 2, ai: true, police: false, pursuit: false },
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

  public onVehicleHitNpc?: (vehiclePos: THREE.Vector3, speed: number) => void;
  public onVehicleExploded?: (pos: THREE.Vector3, radius: number, maxDamage: number) => void;
  public onPoliceRamPlayer?: (damage: number) => void;
  private ramCooldown = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    CAR_SPECS.forEach((spec, idx) => {
      const built = this.createCarMesh(spec.color, spec.neon, spec.police);
      built.group.position.set(spec.x, 0, spec.z);
      built.group.rotation.y = spec.yaw;
      scene.add(built.group);

      const v: Vehicle = {
        id: `car-${idx}`,
        name: spec.name,
        isPolice: spec.police,
        isPursuitUnit: spec.pursuit,
        mesh: built.group,
        bodyMat: built.bodyMat,
        originalColor: spec.color,
        position: new THREE.Vector3(spec.x, 0, spec.z),
        spawnX: spec.x,
        spawnZ: spec.z,
        spawnYaw: spec.yaw,
        yaw: spec.yaw,
        speed: 0,
        hp: 140,
        maxHp: 140,
        destroyed: false,
        respawnTimer: 0,
        smokeTimer: 0,
        wheels: built.wheels,
        lightbarRed: built.lightbarRed,
        lightbarBlue: built.lightbarBlue,
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
    this.camInitialized = false;
  }

  public exitVehicle(): { x: number; y: number; z: number; yaw: number } | null {
    if (!this.activeVehicle) return null;
    const v = this.activeVehicle;
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

    const blastPos = v.position.clone();
    this.spawnExplosionVfx(blastPos);
    this.onVehicleExploded?.(blastPos, 10.5, 110);
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
  ): DrivingHudState {
    const clampedDt = Math.min(dt, 0.05);
    this.ramCooldown = Math.max(0, this.ramCooldown - clampedDt);

    const solidColliders = worldColliders.filter((c) => c.maxY > 0.45);

    for (const v of this.vehicles) {
      v.mesh.position.y += (0 - v.mesh.position.y) * (1 - Math.exp(-12 * clampedDt));

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

      if (v === this.activeVehicle) {
        this.updatePlayerDrivenCar(v, clampedDt, isActive, solidColliders, bounds);
      } else if (v.isPursuitUnit && wantedStars >= 2) {
        // Active Vice PD Cruiser chase!
        this.updatePolicePursuitCar(v, clampedDt, playerPos, solidColliders, bounds);
      } else if (v.isAiControlled) {
        this.updateAiCar(v, clampedDt, playerPos);
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

    this.updateExplosionVfx(clampedDt);

    // Update camera if player is driving
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const forwardX = Math.sin(v.yaw);
      const forwardZ = Math.cos(v.yaw);

      if (this.firstPersonCam) {
        camera.position.set(
          v.position.x + forwardX * 0.35,
          v.position.y + 1.32,
          v.position.z + forwardZ * 0.35,
        );
        camera.lookAt(
          v.position.x + forwardX * 18,
          v.position.y + 1.15,
          v.position.z + forwardZ * 18,
        );
      } else {
        const desiredPos = new THREE.Vector3(
          v.position.x - forwardX * 7.2,
          v.position.y + 3.2,
          v.position.z - forwardZ * 7.2,
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
        firstPersonCam: this.firstPersonCam,
        nearbyVehicleName: null,
      };
    }

    const nearby = this.findNearestVehicle(playerPos);
    return {
      inVehicle: false,
      vehicleName: '',
      speedKmh: 0,
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
    isActive: boolean,
    solidColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ): void {
    const accelInput = isActive ? (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) : 0;
    const steerInput = isActive ? (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0) : 0;
    const handbrake = isActive && this.keys.has('Space');

    const maxForward = 24.5;
    const maxReverse = -9.0;

    if (accelInput > 0) {
      v.speed += 18.5 * dt;
    } else if (accelInput < 0) {
      v.speed -= (v.speed > 0.5 ? 28.0 : 12.0) * dt;
    } else {
      v.speed *= Math.exp(-2.2 * dt);
    }

    if (handbrake) {
      v.speed *= Math.exp(-5.5 * dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, maxReverse, maxForward);

    const speedFactor = Math.min(1, Math.abs(v.speed) / 4.5);
    const dirSign = v.speed >= 0 ? 1 : -1;
    const turnRate = (handbrake ? 2.75 : 2.15) * speedFactor * dirSign;
    v.yaw += steerInput * turnRate * dt;

    this.moveVehicleWithCollision(v, dt, solidColliders, bounds);

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

    const carRadius = 1.45;
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
      v.speed *= -0.22;
    }

    v.position.x = nextX;
    v.position.z = nextZ;
    v.mesh.position.x = v.position.x;
    v.mesh.position.z = v.position.z;
    v.mesh.rotation.y = v.yaw;
  }

  private updateAiCar(v: Vehicle, dt: number, playerPos: THREE.Vector3): void {
    const distToPlayer = v.position.distanceTo(playerPos);
    const targetSpeed = distToPlayer < 8.0 ? 0 : v.aiSpeed;
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

  private createCarMesh(
    bodyColor: string,
    neonColor: string,
    isPolice: boolean,
  ): {
    group: THREE.Group;
    bodyMat: THREE.MeshStandardMaterial;
    wheels: THREE.Mesh[];
    lightbarRed?: THREE.Mesh;
    lightbarBlue?: THREE.Mesh;
  } {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.24,
      metalness: 0.55,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: isPolice ? '#f2f2f2' : '#241c2c',
      roughness: 0.4,
      metalness: 0.4,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#181426',
      roughness: 0.1,
      metalness: 0.85,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 4.35), bodyMat);
    chassis.position.set(0, 0.56, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    if (isPolice) {
      const doors = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.56, 1.9), trimMat);
      doors.position.set(0, 0.56, -0.05);
      group.add(doors);
    }

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.52, 2.05), glassMat);
    cabin.position.set(0, 1.08, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.08, 1.6), isPolice ? trimMat : bodyMat);
    roof.position.set(0, 1.36, -0.22);
    group.add(roof);

    const headMat = new THREE.MeshStandardMaterial({
      color: '#fff4d4',
      emissive: '#ffdf9e',
      emissiveIntensity: 3.2,
    });
    for (const side of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
      hl.position.set(side, 0.62, 2.18);
      group.add(hl);
    }

    const tailMat = new THREE.MeshStandardMaterial({
      color: '#ff2b55',
      emissive: '#ff1f4a',
      emissiveIntensity: 3.2,
    });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.15, 0.08), tailMat);
    tailBar.position.set(0, 0.66, -2.18);
    group.add(tailBar);

    const glowMat = new THREE.MeshStandardMaterial({
      color: neonColor,
      emissive: neonColor,
      emissiveIntensity: 2.2,
    });
    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 3.2), glowMat);
    underglow.position.set(0, 0.24, 0);
    group.add(underglow);

    let lightbarRed: THREE.Mesh | undefined;
    let lightbarBlue: THREE.Mesh | undefined;
    if (isPolice) {
      lightbarRed = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.16, 0.24),
        new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.0 }),
      );
      lightbarRed.position.set(-0.34, 1.48, -0.1);
      group.add(lightbarRed);

      lightbarBlue = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.16, 0.24),
        new THREE.MeshStandardMaterial({ color: '#22aaff', emissive: '#22aaff', emissiveIntensity: 3.0 }),
      );
      lightbarBlue.position.set(0.34, 1.48, -0.1);
      group.add(lightbarBlue);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1b1822', roughness: 0.85 });
    const wheels: THREE.Mesh[] = [];

    const wheelCoords: [number, number][] = [
      [-1.02, 1.32],
      [1.02, 1.32],
      [-1.02, -1.32],
      [1.02, -1.32],
    ];
    for (const [wx, wz] of wheelCoords) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, 0.34, wz);
      wheel.castShadow = true;
      group.add(wheel);
      wheels.push(wheel);
    }

    return { group, bodyMat, wheels, lightbarRed, lightbarBlue };
  }
}
