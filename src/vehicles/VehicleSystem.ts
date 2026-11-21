import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import { ROAD_COORDS } from '../world/CityLayout';

export interface Vehicle {
  id: string;
  name: string;
  isPolice: boolean;
  mesh: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  steerAngle: number;
  hp: number;
  maxHp: number;
  wheels: THREE.Mesh[];
  lightbarRed?: THREE.Mesh;
  lightbarBlue?: THREE.Mesh;
  // AI traffic state
  isAiControlled: boolean;
  aiSpeed: number;
  aiTargetX: number;
  aiTargetZ: number;
  halfW: number;
  halfL: number;
}

export interface DrivingHudState {
  inVehicle: boolean;
  vehicleName: string;
  speedKmh: number;
  firstPersonCam: boolean;
  nearbyVehicleName: string | null;
}

const CAR_SPECS = [
  { name: 'CHEETAH GT', color: '#ff4fa3', neon: '#ff4fa3', x: 56.8, z: 16, yaw: Math.PI, ai: false, police: false },
  { name: 'INFERNUS 86', color: '#36f1e6', neon: '#36f1e6', x: 63.2, z: -12, yaw: 0, ai: false, police: false },
  { name: 'SOLARIS CABRIO', color: '#ff9f43', neon: '#ff9f43', x: 16.8, z: 6, yaw: Math.PI, ai: false, police: false },
  { name: 'PALM COUPE', color: '#f5e6d3', neon: '#36f1e6', x: -23.2, z: -14, yaw: 0, ai: false, police: false },
  { name: 'VICE PD CRUISER', color: '#1b1b26', neon: '#36f1e6', x: -16.8, z: 24, yaw: Math.PI, ai: false, police: true },
  // Cruising traffic cars on the road grid
  { name: 'BANSHEE TURBO', color: '#ff5e7e', neon: '#ff4fa3', x: 20, z: -48, yaw: 0, ai: true, police: false },
  { name: 'OCEAN CRUISER', color: '#bce0d8', neon: '#36f1e6', x: -60, z: 20, yaw: Math.PI / 2, ai: true, police: false },
];

export class VehicleSystem {
  public readonly vehicles: Vehicle[] = [];
  private activeVehicle: Vehicle | null = null;
  private firstPersonCam = false;

  private readonly keys = new Set<string>();
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private camInitialized = false;

  public onVehicleHitNpc?: (vehiclePos: THREE.Vector3, speed: number) => void;

  constructor(scene: THREE.Scene) {
    CAR_SPECS.forEach((spec, idx) => {
      const built = this.createCarMesh(spec.color, spec.neon, spec.police);
      built.group.position.set(spec.x, 0, spec.z);
      built.group.rotation.y = spec.yaw;
      scene.add(built.group);

      const v: Vehicle = {
        id: `car-${idx}`,
        name: spec.name,
        isPolice: spec.police,
        mesh: built.group,
        position: new THREE.Vector3(spec.x, 0, spec.z),
        yaw: spec.yaw,
        speed: 0,
        steerAngle: 0,
        hp: 140,
        maxHp: 140,
        wheels: built.wheels,
        lightbarRed: built.lightbarRed,
        lightbarBlue: built.lightbarBlue,
        isAiControlled: spec.ai,
        aiSpeed: spec.ai ? 7.5 : 0,
        aiTargetX: spec.x,
        aiTargetZ: spec.z,
        halfW: 1.05,
        halfL: 2.15,
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
      const dSq = v.position.distanceToSquared(pos);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = v;
      }
    }
    return best;
  }

  public enterVehicle(v: Vehicle): void {
    this.activeVehicle = v;
    v.isAiControlled = false;
    this.camInitialized = false;
  }

  public exitVehicle(): { x: number; y: number; z: number; yaw: number } | null {
    if (!this.activeVehicle) return null;
    const v = this.activeVehicle;
    // Place player on the left (driver) side of the car
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
      .filter((v) => v !== this.activeVehicle)
      .map((v) => ({
        id: v.id,
        mesh: v.mesh,
        onHit: (damage: number) => {
          v.hp = Math.max(0, v.hp - damage);
          // Visual jolt
          v.mesh.position.y = 0.08;
          return v.hp <= 0;
        },
      }));
  }

  public update(
    dt: number,
    elapsed: number,
    isActive: boolean,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    worldColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  ): DrivingHudState {
    const clampedDt = Math.min(dt, 0.05);

    // Filter only building/prop colliders (cars can drive over 0.18m sidewalks)
    const solidColliders = worldColliders.filter((c) => c.maxY > 0.45);

    for (const v of this.vehicles) {
      // Recover vertical jolt
      v.mesh.position.y += (0 - v.mesh.position.y) * (1 - Math.exp(-12 * clampedDt));

      // Police lightbar flash
      if (v.isPolice && v.lightbarRed && v.lightbarBlue) {
        const phase = Math.sin(elapsed * 14) > 0;
        (v.lightbarRed.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 4.0 : 0.3;
        (v.lightbarBlue.material as THREE.MeshStandardMaterial).emissiveIntensity = phase ? 0.3 : 4.0;
      }

      if (v === this.activeVehicle) {
        this.updatePlayerDrivenCar(v, clampedDt, isActive, solidColliders, bounds);
      } else if (v.isAiControlled) {
        this.updateAiCar(v, clampedDt, playerPos);
      } else {
        // Coasting friction if player jumped out while moving
        v.speed *= Math.exp(-3.2 * clampedDt);
        if (Math.abs(v.speed) > 0.05) {
          this.moveVehicleWithCollision(v, clampedDt, solidColliders, bounds);
        }
      }

      // Spin wheels
      const wheelRot = v.speed * clampedDt * 2.4;
      for (const w of v.wheels) {
        w.rotation.x += wheelRot;
      }
    }

    // Update camera if player is driving
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const forwardX = Math.sin(v.yaw);
      const forwardZ = Math.cos(v.yaw);

      if (this.firstPersonCam) {
        // Hood / cockpit first-person driving view
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
        // Smooth GTA-style chase camera
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

    const maxForward = 24.0; // ~86 km/h feels super fast in a 3x3 district
    const maxReverse = -9.0;

    if (accelInput > 0) {
      v.speed += 18.0 * dt;
    } else if (accelInput < 0) {
      v.speed -= (v.speed > 0.5 ? 28.0 : 12.0) * dt;
    } else {
      v.speed *= Math.exp(-2.2 * dt);
    }

    if (handbrake) {
      v.speed *= Math.exp(-5.5 * dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, maxReverse, maxForward);

    // Steering scales with velocity so car can't spin in place
    const speedFactor = Math.min(1, Math.abs(v.speed) / 4.5);
    const dirSign = v.speed >= 0 ? 1 : -1;
    const turnRate = (handbrake ? 2.7 : 2.15) * speedFactor * dirSign;
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
        // Resolve along minimum axis
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
    // Yield if player is directly in front
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
    // Snap to nearest road intersection and pick an adjacent road intersection
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

    // Lower chassis (80s wedge silhouette)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 4.35), bodyMat);
    chassis.position.set(0, 0.56, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    // Police white doors accent
    if (isPolice) {
      const doors = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.56, 1.9), trimMat);
      doors.position.set(0, 0.56, -0.05);
      group.add(doors);
    }

    // Cabin / greenhouse
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.52, 2.05), glassMat);
    cabin.position.set(0, 1.08, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.08, 1.6), isPolice ? trimMat : bodyMat);
    roof.position.set(0, 1.36, -0.22);
    group.add(roof);

    // Headlights (front = +Z)
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

    // Taillight bar (rear = -Z)
    const tailMat = new THREE.MeshStandardMaterial({
      color: '#ff2b55',
      emissive: '#ff1f4a',
      emissiveIntensity: 3.2,
    });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.15, 0.08), tailMat);
    tailBar.position.set(0, 0.66, -2.18);
    group.add(tailBar);

    // Subtle Miami underglow strip
    const glowMat = new THREE.MeshStandardMaterial({
      color: neonColor,
      emissive: neonColor,
      emissiveIntensity: 2.2,
    });
    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 3.2), glowMat);
    underglow.position.set(0, 0.24, 0);
    group.add(underglow);

    // Police lightbar
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

    // 4 Wheels
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

    return { group, wheels, lightbarRed, lightbarBlue };
  }
}
