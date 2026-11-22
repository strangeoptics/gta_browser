import * as THREE from 'three';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { AABB } from '../types';
import type { MarinaBoatInit } from '../world/NorthPoint';

interface WakePuff {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface DrivableBoat {
  id: string;
  name: string;
  group: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  baseY: number;
  deckHeight: number;
  halfWidth: number;
  halfLength: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  camDist: number;
  camHeight: number;
  wakeOffset: number;
  phase: number;
}

export interface BoatHudState {
  inBoat: boolean;
  boatName: string;
  speedKmh: number;
  nearbyBoat: boolean;
  nearbyBoatName: string | null;
}

const STATIC_BOAT_OBSTACLES = [
  // Main City + West District + North Promenade + East Beach + Vice Port Landmass
  { minX: -180.0, maxX: 105.5, minZ: -99.5, maxZ: 127.0 },
  // Vice Marina 3 Wooden Piers (x = -36, -8, +20; z = -124..-98)
  { minX: -38.9, maxX: -33.1, minZ: -125.2, maxZ: -98.0 },
  { minX: -10.9, maxX: -5.1, minZ: -125.2, maxZ: -98.0 },
  { minX: 17.1, maxX: 22.9, minZ: -125.2, maxZ: -98.0 },
  // East Beach Wooden Pier (x = 87..108, z = 6.4..9.6)
  { minX: 86.0, maxX: 109.2, minZ: 5.2, maxZ: 10.8 },
  // Starfish Island
  { minX: 145.5, maxX: 200.5, minZ: -86.5, maxZ: -18.0 },
  // Starfish Marina Gangway
  { minX: 169.0, maxX: 175.0, minZ: -20.0, maxZ: -5.5 },
  // Vice Port Cargo Freighter (x = -21..37, z = 128..142)
  { minX: -23.0, maxX: 39.0, minZ: 126.5, maxZ: 144.0 },
];

const MARINA_PIER_XS = [-36, -8, 20];

/**
 * Drivable 80s Miami fleet:
 * - Stinger Speedboat moored off the golden sand beach (x ~ 111, z = 8)
 * - 4 Vice Marina Sport Yachts & Sailboats moored along the Northern Marina piers
 * Supports full ocean navigation (North Bay, around Cape Vice Cliff, East Ocean, Starfish Island & South Bay),
 * walkable deck colliders (so you can climb onto boats from the water or stand on deck), and smart pier/shore disembark.
 */
export class BoatSystem {
  public readonly position = new THREE.Vector3(132, 0.05, 8);
  public yaw = Math.PI;
  public speed = 0;
  public readonly boats: DrivableBoat[] = [];

  private readonly scene: THREE.Scene;
  private readonly keys = new Set<string>();
  private readonly wakes: WakePuff[] = [];
  private readonly wakePool: THREE.Mesh[] = [];
  private readonly wakeGeo = new THREE.BoxGeometry(0.42, 0.14, 0.42);
  private readonly markersScratch: { x: number; z: number; yaw: number }[] = [];

  private activeBoat: DrivableBoat | null = null;
  private lastNearbyBoat: DrivableBoat | null = null;
  private wakeTimer = 0;
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private readonly tmpDesiredPos = new THREE.Vector3();
  private readonly tmpDesiredLook = new THREE.Vector3();
  private camInit = false;

  constructor(scene: THREE.Scene, marinaBoats: MarinaBoatInit[] = []) {
    this.scene = scene;

    // 1) Original Stinger Speedboat off East Beach Pier
    const stingerGroup = this.createBoatMesh();
    stingerGroup.userData.dynamic = true;
    const stingerPos = new THREE.Vector3(132, 0.06, 8);
    stingerGroup.position.copy(stingerPos);
    stingerGroup.rotation.y = Math.PI;
    this.scene.add(stingerGroup);
    this.boats.push({
      id: 'stinger-beach',
      name: 'STINGER SPEEDBOAT',
      group: stingerGroup,
      position: stingerPos,
      yaw: Math.PI,
      speed: 0,
      baseY: 0.06,
      deckHeight: 0.68,
      halfWidth: 1.2,
      halfLength: 3.3,
      maxSpeed: 22.0,
      accel: 15.5,
      turnRate: 1.65,
      camDist: 10.5,
      camHeight: 4.2,
      wakeOffset: 3.1,
      phase: 0,
    });

    // 2) Register the 4 Vice Marina Yachts & Sailboats as fully drivable!
    marinaBoats.forEach((mb, idx) => {
      const pos = new THREE.Vector3(mb.x, mb.baseY, mb.z);
      mb.group.position.copy(pos);
      mb.group.rotation.y = mb.yaw;
      this.boats.push({
        id: `marina-${idx}`,
        name: mb.name,
        group: mb.group,
        position: pos,
        yaw: mb.yaw,
        speed: 0,
        baseY: mb.baseY,
        deckHeight: 0.96,
        halfWidth: 1.55,
        halfLength: 4.5,
        maxSpeed: mb.isSailboat ? 15.5 : 19.5,
        accel: mb.isSailboat ? 9.5 : 12.8,
        turnRate: mb.isSailboat ? 1.15 : 1.3,
        camDist: mb.isSailboat ? 16.0 : 14.2,
        camHeight: mb.isSailboat ? 6.4 : 5.4,
        wakeOffset: 4.6,
        phase: (idx + 1) * 1.45,
      });
    });

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  public isInBoat(): boolean {
    return this.activeBoat !== null;
  }

  public findNearestBoat(playerPos: THREE.Vector3): DrivableBoat | null {
    let best: DrivableBoat | null = null;
    let bestDistSq = Infinity;

    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      if (playerPos.y > b.baseY + b.deckHeight + 3.0) continue;

      // Distance to boat's oriented hull footprint (so you can board from bow, stern, pier, or water!)
      const dx = playerPos.x - b.position.x;
      const dz = playerPos.z - b.position.z;
      const cos = Math.cos(-b.yaw);
      const sin = Math.sin(-b.yaw);
      const lx = dx * cos + dz * sin;
      const lz = -dx * sin + dz * cos;

      const cx = THREE.MathUtils.clamp(lx, -b.halfWidth, b.halfWidth);
      const cz = THREE.MathUtils.clamp(lz, -b.halfLength, b.halfLength);
      const ex = lx - cx;
      const ez = lz - cz;
      const edgeDistSq = ex * ex + ez * ez;

      // Within 3.8m of hull edge (works comfortably from pier walkways and while swimming alongside!)
      if (edgeDistSq < 3.8 * 3.8 && edgeDistSq < bestDistSq) {
        bestDistSq = edgeDistSq;
        best = b;
      }
    }
    return best;
  }

  public isPlayerNear(playerPos: THREE.Vector3): boolean {
    return this.findNearestBoat(playerPos) !== null;
  }

  public board(playerPos?: THREE.Vector3): boolean {
    const target = playerPos ? this.findNearestBoat(playerPos) : this.lastNearbyBoat ?? this.boats[0];
    if (!target) return false;
    this.activeBoat = target;
    this.camInit = false;
    this.position.copy(target.position);
    this.yaw = target.yaw;
    this.speed = target.speed;
    return true;
  }

  public disembark(): { x: number; y: number; z: number; yaw: number } {
    const b = this.activeBoat ?? this.boats[0];
    this.activeBoat = null;
    this.keys.clear();

    const bx = b.position.x;
    const bz = b.position.z;

    // 1) Near Vice Marina Wooden Piers -> step directly onto the closest pier!
    if (bz >= -126.5 && bz <= -96.5 && bx >= -46 && bx <= 28) {
      let nearestPierX = MARINA_PIER_XS[0];
      let minDist = Math.abs(bx - nearestPierX);
      for (let i = 1; i < MARINA_PIER_XS.length; i++) {
        const d = Math.abs(bx - MARINA_PIER_XS[i]);
        if (d < minDist) {
          minDist = d;
          nearestPierX = MARINA_PIER_XS[i];
        }
      }
      if (minDist < 7.2) {
        return {
          x: nearestPierX,
          y: 0.28,
          z: THREE.MathUtils.clamp(bz, -123.0, -99.0),
          yaw: 0,
        };
      }
    }

    // 2) Near Vice Marina Promenade Seawall -> step onto the boardwalk!
    if (bz > -105.0 && bz < -94.0 && bx > -120 && bx < 44) {
      return {
        x: THREE.MathUtils.clamp(bx, -118, 42),
        y: 0.26,
        z: -96.2,
        yaw: Math.PI,
      };
    }

    // 3) Near East Beach Wooden Pier -> step onto the beach pier!
    if (bx >= 86 && bx <= 116 && bz >= 2.5 && bz <= 13.5) {
      return {
        x: THREE.MathUtils.clamp(bx - 2.6, 88, 106.5),
        y: 0.6,
        z: 8.0,
        yaw: Math.PI / 2,
      };
    }

    // 4) Near Starfish Island / Superyacht Marina Gangway
    if (bx > 140 && bz > -90 && bz < 6) {
      return {
        x: 172,
        y: 1.5,
        z: -9.5,
        yaw: 0,
      };
    }

    // 5) Near East Golden Sand Beach
    if (bx <= 114 && bz >= -66 && bz <= 66) {
      return {
        x: Math.min(103, bx - 4.5),
        y: 0.15,
        z: THREE.MathUtils.clamp(bz, -62, 62),
        yaw: Math.PI / 2,
      };
    }

    // 6) Open water -> step safely onto the boat's own walkable deck!
    return {
      x: bx,
      y: b.baseY + b.deckHeight + 0.08,
      z: bz,
      yaw: b.yaw + Math.PI,
    };
  }

  /**
   * Appends walkable deck AABBs for all non-driven boats so the player can stand on them
   * and climb onto them from the water with [SPACE].
   */
  public appendBoatColliders(out: AABB[]): void {
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      if (b === this.activeBoat) continue;
      const cos = Math.abs(Math.cos(b.yaw));
      const sin = Math.abs(Math.sin(b.yaw));
      const hx = b.halfWidth * cos + b.halfLength * sin;
      const hz = b.halfWidth * sin + b.halfLength * cos;
      out.push({
        minX: b.position.x - hx,
        maxX: b.position.x + hx,
        minY: b.baseY - 0.5,
        maxY: b.baseY + b.deckHeight,
        minZ: b.position.z - hz,
        maxZ: b.position.z + hz,
        tag: 'boat',
      });
    }
  }

  public getBoatMarkers(): { x: number; z: number; yaw: number }[] {
    this.markersScratch.length = 0;
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      this.markersScratch.push({ x: b.position.x, z: b.position.z, yaw: b.yaw });
    }
    return this.markersScratch;
  }

  private resolveBoatObstacles(
    boat: DrivableBoat,
    nextX: number,
    nextZ: number,
    yachtPos?: { x: number; z: number },
  ): { x: number; z: number; hit: boolean } {
    let x = THREE.MathUtils.clamp(nextX, -168.0, 248.0);
    let z = THREE.MathUtils.clamp(nextZ, -166.0, 156.0);
    let hit = false;

    for (let i = 0; i < STATIC_BOAT_OBSTACLES.length; i++) {
      const ob = STATIC_BOAT_OBSTACLES[i];
      if (x > ob.minX && x < ob.maxX && z > ob.minZ && z < ob.maxZ) {
        const dL = Math.abs(x - ob.minX);
        const dR = Math.abs(ob.maxX - x);
        const dB = Math.abs(z - ob.minZ);
        const dF = Math.abs(ob.maxZ - z);
        const m = Math.min(dL, dR, dB, dF);
        if (m === dL) x = ob.minX;
        else if (m === dR) x = ob.maxX;
        else if (m === dB) z = ob.minZ;
        else z = ob.maxZ;
        hit = true;
      }
    }

    // Cape Vice Sea Cliff & Surf Boulders (center 78, -114, radius 30.5m)
    const cliffDx = x - 78.0;
    const cliffDz = z - -114.0;
    const cliffDistSq = cliffDx * cliffDx + cliffDz * cliffDz;
    const cliffMinR = 30.5;
    if (cliffDistSq < cliffMinR * cliffMinR && cliffDistSq > 0.001) {
      const dist = Math.sqrt(cliffDistSq);
      x = 78.0 + (cliffDx / dist) * cliffMinR;
      z = -114.0 + (cliffDz / dist) * cliffMinR;
      hit = true;
    }

    // Avoid clipping into the movable 44m Superyacht "LADY VICE"
    if (yachtPos) {
      const yMinX = yachtPos.x - 8.5;
      const yMaxX = yachtPos.x + 8.5;
      const yMinZ = yachtPos.z - 23.0;
      const yMaxZ = yachtPos.z + 23.0;
      if (x > yMinX && x < yMaxX && z > yMinZ && z < yMaxZ) {
        const dL = Math.abs(x - yMinX);
        const dR = Math.abs(yMaxX - x);
        const dB = Math.abs(z - yMinZ);
        const dF = Math.abs(yMaxZ - z);
        const m = Math.min(dL, dR, dB, dF);
        if (m === dL) x = yMinX;
        else if (m === dR) x = yMaxX;
        else if (m === dB) z = yMinZ;
        else z = yMaxZ;
        hit = true;
      }
    }

    // Soft separation from other drivable boats
    for (let i = 0; i < this.boats.length; i++) {
      const other = this.boats[i];
      if (other === boat) continue;
      const dx = x - other.position.x;
      const dz = z - other.position.z;
      const minSep = boat.halfWidth + other.halfWidth + 0.8;
      const dSq = dx * dx + dz * dz;
      if (dSq < minSep * minSep && dSq > 0.0001) {
        const d = Math.sqrt(dSq);
        x = other.position.x + (dx / d) * minSep;
        z = other.position.z + (dz / d) * minSep;
        hit = true;
      }
    }

    return { x, z, hit };
  }

  public update(
    dt: number,
    elapsed: number,
    isPlaying: boolean,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    pad?: GamepadSnapshot,
    yachtPos?: { x: number; z: number },
  ): BoatHudState {
    const clampedDt = Math.min(dt, 0.05);

    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      const isDriven = b === this.activeBoat;

      if (isDriven && isPlaying) {
        const kbThrottle = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
        const kbSteer = (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0);
        const padThrottle = pad?.connected ? pad.rt - pad.lt : 0;
        const padSteer = pad?.connected ? -pad.moveX : 0;
        const throttle = THREE.MathUtils.clamp(kbThrottle + padThrottle, -1, 1);
        const steer = THREE.MathUtils.clamp(kbSteer + padSteer, -1, 1);

        if (throttle > 0.05) b.speed += b.accel * throttle * clampedDt;
        else if (throttle < -0.05) b.speed += (b.accel * 0.9) * throttle * clampedDt;
        else b.speed *= Math.exp(-1.55 * clampedDt);

        b.speed = THREE.MathUtils.clamp(b.speed, -6.5, b.maxSpeed);
        const steerFactor = Math.min(1, Math.abs(b.speed) / 3.5 + 0.25);
        b.yaw += steer * b.turnRate * steerFactor * (b.speed >= -0.2 ? 1 : -1) * clampedDt;

        // Bank & pitch dynamically with turns and throttle
        const targetRoll = -steer * 0.18 * Math.min(1, Math.abs(b.speed) / 14);
        const targetPitch = -Math.max(0, b.speed) * 0.007;
        b.group.rotation.z += (targetRoll - b.group.rotation.z) * (1 - Math.exp(-6 * clampedDt));
        b.group.rotation.x += (targetPitch - b.group.rotation.x) * (1 - Math.exp(-6 * clampedDt));
      } else {
        b.speed *= Math.exp(-2.2 * clampedDt);
        const idleRoll = Math.sin(elapsed * 1.25 + b.phase) * 0.034;
        const idlePitch = Math.cos(elapsed * 0.95 + b.phase) * 0.022;
        b.group.rotation.z += (idleRoll - b.group.rotation.z) * (1 - Math.exp(-5 * clampedDt));
        b.group.rotation.x += (idlePitch - b.group.rotation.x) * (1 - Math.exp(-5 * clampedDt));
      }

      const fwdX = Math.sin(b.yaw);
      const fwdZ = Math.cos(b.yaw);

      if (Math.abs(b.speed) > 0.04) {
        const res = this.resolveBoatObstacles(
          b,
          b.position.x + fwdX * b.speed * clampedDt,
          b.position.z + fwdZ * b.speed * clampedDt,
          yachtPos,
        );
        b.position.x = res.x;
        b.position.z = res.z;
        if (res.hit) b.speed *= 0.4;
      }

      const waveAmp = b.id === 'stinger-beach' ? 0.12 : 0.09;
      const waveY = Math.sin(b.position.x * 0.16 + elapsed * 1.45 + b.phase) * waveAmp;
      b.position.y = b.baseY + waveY;

      b.group.position.copy(b.position);
      b.group.rotation.y = b.yaw;

      // Emit foaming white-cyan wake spray behind stern when moving (pooled!)
      if (isDriven && Math.abs(b.speed) > 3.2) {
        this.wakeTimer -= clampedDt;
        if (this.wakeTimer <= 0) {
          this.wakeTimer = 0.045;
          let puff = this.wakePool.pop();
          if (puff) {
            (puff.material as THREE.MeshBasicMaterial).opacity = 0.75;
            puff.scale.set(1, 1, 1);
            puff.visible = true;
          } else {
            const mat = new THREE.MeshBasicMaterial({
              color: '#d8ffff',
              transparent: true,
              opacity: 0.75,
            });
            puff = new THREE.Mesh(this.wakeGeo, mat);
            this.scene.add(puff);
          }
          puff.position.set(
            b.position.x - fwdX * b.wakeOffset + (Math.random() - 0.5) * 1.1,
            0.02,
            b.position.z - fwdZ * b.wakeOffset + (Math.random() - 0.5) * 1.1,
          );
          this.wakes.push({ mesh: puff, life: 0.95, maxLife: 0.95 });
        }
      }
    }

    // Update wake spray particles
    for (let i = this.wakes.length - 1; i >= 0; i--) {
      const w = this.wakes[i];
      w.life -= clampedDt;
      if (w.life <= 0) {
        w.mesh.visible = false;
        this.wakePool.push(w.mesh);
        const last = this.wakes.length - 1;
        if (i !== last) this.wakes[i] = this.wakes[last];
        this.wakes.pop();
      } else {
        const s = 1 + (1 - w.life / w.maxLife) * 2.2;
        w.mesh.scale.set(s, 1, s);
        (w.mesh.material as THREE.MeshBasicMaterial).opacity = (w.life / w.maxLife) * 0.72;
      }
    }

    // Sync public position/yaw/speed & chase camera for the active boat
    const active = this.activeBoat;
    if (active) {
      this.position.copy(active.position);
      this.yaw = active.yaw;
      this.speed = active.speed;

      const fwdX = Math.sin(active.yaw);
      const fwdZ = Math.cos(active.yaw);
      const desiredPos = this.tmpDesiredPos.set(
        active.position.x - fwdX * active.camDist,
        active.position.y + active.camHeight,
        active.position.z - fwdZ * active.camDist,
      );
      const desiredLook = this.tmpDesiredLook.set(
        active.position.x + fwdX * 9.0,
        active.position.y + 1.2,
        active.position.z + fwdZ * 9.0,
      );
      if (!this.camInit) {
        this.camPosSmooth.copy(desiredPos);
        this.camLookSmooth.copy(desiredLook);
        this.camInit = true;
      } else {
        const blend = 1 - Math.exp(-7 * clampedDt);
        this.camPosSmooth.lerp(desiredPos, blend);
        this.camLookSmooth.lerp(desiredLook, blend);
      }
      camera.position.copy(this.camPosSmooth);
      camera.lookAt(this.camLookSmooth);
    } else {
      this.position.copy(this.boats[0].position);
      this.yaw = this.boats[0].yaw;
      this.speed = this.boats[0].speed;
    }

    this.lastNearbyBoat = active ? null : this.findNearestBoat(playerPos);

    return {
      inBoat: active !== null,
      boatName: active ? active.name : 'STINGER SPEEDBOAT',
      speedKmh: active ? Math.round(Math.abs(active.speed) * 3.6) : 0,
      nearbyBoat: this.lastNearbyBoat !== null,
      nearbyBoatName: this.lastNearbyBoat ? this.lastNearbyBoat.name : null,
    };
  }

  private createBoatMesh(): THREE.Group {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: '#f7f2ec', roughness: 0.2, metalness: 0.2 });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#182436', roughness: 0.1, metalness: 0.85 });
    const deckMat = new THREE.MeshStandardMaterial({ color: '#36f1e6', roughness: 0.45 });

    // Sleek 80s cigarette boat hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 5.4), hullMat);
    hull.position.set(0, 0.3, -0.2);
    hull.castShadow = true;
    g.add(hull);

    // Pointed bow nose (+Z)
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.2, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1.0, 1.0, 0.45);
    bow.position.set(0, 0.32, 3.4);
    g.add(bow);

    // Neon pink racing stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.14, 5.1), stripeMat);
    stripe.position.set(0, 0.48, -0.1);
    g.add(stripe);

    // Cockpit interior + tinted windshield
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 2.2), deckMat);
    deck.position.set(0, 0.68, -0.9);
    g.add(deck);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 0.65), glassMat);
    windshield.position.set(0, 0.88, 0.45);
    windshield.rotation.x = -0.5;
    g.add(windshield);

    // Warm bow navigation light
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#36f1e6' }),
    );
    navLight.position.set(0, 0.74, 3.5);
    g.add(navLight);

    return g;
  }
}
