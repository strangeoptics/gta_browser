import * as THREE from 'three';
import type { GamepadSnapshot } from '../engine/GamepadInput';

interface WakePuff {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface BoatHudState {
  inBoat: boolean;
  boatName: string;
  speedKmh: number;
  nearbyBoat: boolean;
}

/**
 * Drivable 80s Miami retro speedboat moored off the golden sand beach (x ~ 110).
 * Allows cruising out across the dusk ocean with wave bobbing, banking turns, and foam wake spray.
 */
export class BoatSystem {
  public readonly position = new THREE.Vector3(111, 0.05, 8);
  public yaw = Math.PI;
  public speed = 0;

  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly keys = new Set<string>();
  private readonly wakes: WakePuff[] = [];
  private readonly wakeGeo = new THREE.BoxGeometry(0.38, 0.14, 0.38);

  private active = false;
  private wakeTimer = 0;
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private camInit = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = this.createBoatMesh();
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.scene.add(this.group);

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  public isInBoat(): boolean {
    return this.active;
  }

  public isPlayerNear(playerPos: THREE.Vector3): boolean {
    return playerPos.distanceToSquared(this.position) < 42.0; // within ~6.5m from beach edge
  }

  public board(): void {
    this.active = true;
    this.camInit = false;
  }

  public disembark(): { x: number; y: number; z: number; yaw: number } {
    this.active = false;
    this.keys.clear();
    // If moored near Starfish Island or the Superyacht, step right onto the Marina / Yacht gangway!
    if (this.position.x > 140) {
      return {
        x: 172,
        y: 1.5,
        z: -9.5,
        yaw: 0,
      };
    }
    // Otherwise place player safely on the dry golden sand beach facing the city
    return {
      x: Math.min(103, this.position.x - 4.5),
      y: 0.15,
      z: THREE.MathUtils.clamp(this.position.z, -62, 62),
      yaw: Math.PI / 2,
    };
  }

  public update(
    dt: number,
    elapsed: number,
    isPlaying: boolean,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    pad?: GamepadSnapshot,
  ): BoatHudState {
    const clampedDt = Math.min(dt, 0.05);

    if (this.active && isPlaying) {
      const kbThrottle = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
      const kbSteer = (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0);
      const padThrottle = pad?.connected ? pad.rt - pad.lt : 0;
      const padSteer = pad?.connected ? -pad.moveX : 0;
      const throttle = THREE.MathUtils.clamp(kbThrottle + padThrottle, -1, 1);
      const steer = THREE.MathUtils.clamp(kbSteer + padSteer, -1, 1);

      if (throttle > 0.05) this.speed += 15.5 * throttle * clampedDt;
      else if (throttle < -0.05) this.speed += 14.0 * throttle * clampedDt;
      else this.speed *= Math.exp(-1.6 * clampedDt);

      this.speed = THREE.MathUtils.clamp(this.speed, -6.5, 22.0);
      const steerFactor = Math.min(1, Math.abs(this.speed) / 3.5 + 0.25);
      this.yaw += steer * 1.65 * steerFactor * (this.speed >= -0.2 ? 1 : -1) * clampedDt;

      // Bank & pitch dynamically with turns and throttle
      const targetRoll = -steer * 0.22 * Math.min(1, Math.abs(this.speed) / 14);
      const targetPitch = -Math.max(0, this.speed) * 0.008;
      this.group.rotation.z += (targetRoll - this.group.rotation.z) * (1 - Math.exp(-6 * clampedDt));
      this.group.rotation.x += (targetPitch - this.group.rotation.x) * (1 - Math.exp(-6 * clampedDt));
    } else {
      this.speed *= Math.exp(-2.2 * clampedDt);
      this.group.rotation.z += (Math.sin(elapsed * 1.5) * 0.04 - this.group.rotation.z) * (1 - Math.exp(-5 * clampedDt));
      this.group.rotation.x += (Math.cos(elapsed * 1.2) * 0.03 - this.group.rotation.x) * (1 - Math.exp(-5 * clampedDt));
    }

    // Move across the ocean (keep off the dry beach x < 107.5, and push cleanly around Starfish Island & Superyacht!)
    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    let nextX = THREE.MathUtils.clamp(this.position.x + fwdX * this.speed * clampedDt, 108.0, 232.0);
    let nextZ = THREE.MathUtils.clamp(this.position.z + fwdZ * this.speed * clampedDt, -130.0, 130.0);

    const boatObstacles = [
      { minX: 145.5, maxX: 200.5, minZ: -86.5, maxZ: -18.0 }, // Starfish Island
      { minX: 163.5, maxX: 180.5, minZ: -19.0, maxZ: 38.0 },  // Marina gangway & 42m Superyacht hull
    ];
    for (const ob of boatObstacles) {
      if (nextX > ob.minX && nextX < ob.maxX && nextZ > ob.minZ && nextZ < ob.maxZ) {
        const dL = Math.abs(nextX - ob.minX);
        const dR = Math.abs(ob.maxX - nextX);
        const dB = Math.abs(nextZ - ob.minZ);
        const dF = Math.abs(ob.maxZ - nextZ);
        const m = Math.min(dL, dR, dB, dF);
        if (m === dL) nextX = ob.minX;
        else if (m === dR) nextX = ob.maxX;
        else if (m === dB) nextZ = ob.minZ;
        else nextZ = ob.maxZ;
        this.speed *= 0.4;
      }
    }
    this.position.x = nextX;
    this.position.z = nextZ;
    const waveY = Math.sin(this.position.x * 0.18 + elapsed * 1.5) * 0.14;
    this.position.y = 0.06 + waveY;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Emit foaming white-cyan wake spray behind the stern when moving
    if (Math.abs(this.speed) > 3.5) {
      this.wakeTimer -= clampedDt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.045;
        const mat = new THREE.MeshBasicMaterial({
          color: '#d8ffff',
          transparent: true,
          opacity: 0.75,
        });
        const puff = new THREE.Mesh(this.wakeGeo, mat);
        puff.position.set(
          this.position.x - fwdX * 3.1 + (Math.random() - 0.5) * 0.9,
          0.02,
          this.position.z - fwdZ * 3.1 + (Math.random() - 0.5) * 0.9,
        );
        this.scene.add(puff);
        this.wakes.push({ mesh: puff, life: 0.9, maxLife: 0.9 });
      }
    }

    for (let i = this.wakes.length - 1; i >= 0; i--) {
      const w = this.wakes[i];
      w.life -= clampedDt;
      if (w.life <= 0) {
        this.scene.remove(w.mesh);
        (w.mesh.material as THREE.Material).dispose();
        this.wakes.splice(i, 1);
      } else {
        const s = 1 + (1 - w.life / w.maxLife) * 2.2;
        w.mesh.scale.set(s, 1, s);
        (w.mesh.material as THREE.MeshBasicMaterial).opacity = (w.life / w.maxLife) * 0.72;
      }
    }

    if (this.active) {
      const desiredPos = new THREE.Vector3(
        this.position.x - fwdX * 10.5,
        this.position.y + 4.2,
        this.position.z - fwdZ * 10.5,
      );
      const desiredLook = new THREE.Vector3(
        this.position.x + fwdX * 9.0,
        this.position.y + 1.0,
        this.position.z + fwdZ * 9.0,
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
    }

    return {
      inBoat: this.active,
      boatName: 'STINGER SPEEDBOAT',
      speedKmh: Math.round(Math.abs(this.speed) * 3.6),
      nearbyBoat: !this.active && this.isPlayerNear(playerPos),
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
