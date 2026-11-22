import * as THREE from 'three';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { SuperyachtHandle } from '../world/StarfishIsland';

interface YachtWakePuff {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface SuperyachtHudState {
  inYacht: boolean;
  yachtName: string;
  speedKmh: number;
  nearbyYacht: boolean;
  firstPersonCam: boolean;
}

/**
 * Pilotable 44-Meter Luxury Superyacht "LADY VICE":
 * - Board from the Upper Bridge Helm or decks with [E]
 * - Heavy twin-diesel inertia, smooth rudder turns, realistic roll & bow pitch
 * - Twin giant foaming stern wake trails & wide cinematic chase / captain's bridge POV ([V])
 * - Dynamically syncs all walkable deck & stair colliders so you can drop anchor anywhere!
 */
export class SuperyachtSystem {
  public readonly position = new THREE.Vector3();
  public yaw = 0;
  public speed = 0;

  private readonly scene: THREE.Scene;
  private readonly handle: SuperyachtHandle;
  private readonly keys = new Set<string>();
  private readonly wakes: YachtWakePuff[] = [];
  private readonly wakePool: THREE.Mesh[] = [];
  private readonly wakeGeo = new THREE.BoxGeometry(1.4, 0.22, 1.4);

  private active = false;
  private firstPersonCam = false;
  private wakeTimer = 0;
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private readonly tmpDesiredPos = new THREE.Vector3();
  private readonly tmpDesiredLook = new THREE.Vector3();
  private readonly tmpBridgeEyeLocal = new THREE.Vector3();
  private readonly tmpBridgeLookLocal = new THREE.Vector3();
  private readonly tmpBridgeEye = new THREE.Vector3();
  private readonly tmpBridgeLook = new THREE.Vector3();
  private camInit = false;

  constructor(scene: THREE.Scene, handle: SuperyachtHandle) {
    this.scene = scene;
    this.handle = handle;
    this.position.copy(handle.initialPos);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyV' && this.active) {
        this.firstPersonCam = !this.firstPersonCam;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  public isInYacht(): boolean {
    return this.active;
  }

  public isPlayerNear(playerPos: THREE.Vector3): boolean {
    return !this.active && this.handle.isPlayerOnOrNearYacht(playerPos);
  }

  public board(): void {
    this.active = true;
    this.camInit = false;
  }

  public disembark(): { x: number; y: number; z: number; yaw: number } {
    this.active = false;
    this.keys.clear();
    this.speed = 0;
    this.handle.syncColliders(this.position.x, this.position.y, this.position.z, this.yaw);
    // Step safely onto the Upper Bridge Deck right behind the Captain's Helm
    const deckPos = this.handle.getWorldPos(new THREE.Vector3(0, this.handle.upperDeckY + 0.14, -1.6));
    return {
      x: deckPos.x,
      y: deckPos.y,
      z: deckPos.z,
      yaw: this.yaw + Math.PI,
    };
  }

  public update(
    dt: number,
    elapsed: number,
    isPlaying: boolean,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    pad?: GamepadSnapshot,
  ): SuperyachtHudState {
    const clampedDt = Math.min(dt, 0.05);

    if (this.active && pad?.connected && pad.camTogglePressed) {
      this.firstPersonCam = !this.firstPersonCam;
    }

    if (this.active && isPlaying) {
      const kbThrottle = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
      const kbSteer = (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0);
      const padThrottle = pad?.connected ? pad.rt - pad.lt : 0;
      const padSteer = pad?.connected ? -pad.moveX : 0;
      const throttle = THREE.MathUtils.clamp(kbThrottle + padThrottle, -1, 1);
      const steer = THREE.MathUtils.clamp(kbSteer + padSteer, -1, 1);

      if (throttle > 0.05) this.speed += 7.5 * throttle * clampedDt;
      else if (throttle < -0.05) this.speed += 8.2 * throttle * clampedDt;
      else this.speed *= Math.exp(-0.95 * clampedDt);

      this.speed = THREE.MathUtils.clamp(this.speed, -6.5, 19.5);
      const steerFactor = Math.min(1, Math.abs(this.speed) / 4.0 + 0.22);
      this.yaw += steer * 0.72 * steerFactor * (this.speed >= -0.2 ? 1 : -1) * clampedDt;

      // Majestic heavy superyacht heel & bow rise
      const targetRoll = -steer * 0.08 * Math.min(1, Math.abs(this.speed) / 12);
      const targetPitch = -Math.max(0, this.speed) * 0.0045;
      this.handle.group.rotation.z += (targetRoll - this.handle.group.rotation.z) * (1 - Math.exp(-3.5 * clampedDt));
      this.handle.group.rotation.x += (targetPitch - this.handle.group.rotation.x) * (1 - Math.exp(-3.5 * clampedDt));
    } else {
      this.speed *= Math.exp(-1.5 * clampedDt);
      this.handle.group.rotation.z +=
        (Math.sin(elapsed * 0.9) * 0.014 - this.handle.group.rotation.z) * (1 - Math.exp(-3 * clampedDt));
      this.handle.group.rotation.x +=
        (Math.cos(elapsed * 0.75) * 0.01 - this.handle.group.rotation.x) * (1 - Math.exp(-3 * clampedDt));
    }

    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);

    if (Math.abs(this.speed) > 0.03) {
      let nextX = THREE.MathUtils.clamp(this.position.x + fwdX * this.speed * clampedDt, 118.0, 310.0);
      let nextZ = THREE.MathUtils.clamp(this.position.z + fwdZ * this.speed * clampedDt, -172.0, 172.0);

      // Keep the 44m hull safely clear of Starfish Island & the arched Causeway Bridge!
      const obstacles = [
        { minX: 136.0, maxX: 208.0, minZ: -94.0, maxZ: -11.0 }, // Starfish Island + Marina Gangway
        { minX: 60.0, maxX: 156.0, minZ: -74.0, maxZ: -46.0 },  // Arched Causeway Bridge corridor
      ];
      for (const ob of obstacles) {
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
          this.speed *= 0.35;
        }
      }

      this.position.x = nextX;
      this.position.z = nextZ;
      this.handle.syncColliders(this.position.x, this.position.y, this.position.z, this.yaw);
    }

    const waveY = Math.sin(this.position.x * 0.1 + elapsed * 1.05) * 0.1;
    this.position.y = waveY;
    this.handle.group.position.copy(this.position);
    this.handle.group.rotation.y = this.yaw;

    // Twin foaming superyacht stern wake trails (pooled!)
    if (Math.abs(this.speed) > 2.2) {
      this.wakeTimer -= clampedDt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.08;
        const rightX = Math.cos(this.yaw);
        const rightZ = -Math.sin(this.yaw);
        for (const side of [-3.4, 3.4]) {
          let puff = this.wakePool.pop();
          if (puff) {
            (puff.material as THREE.MeshBasicMaterial).opacity = 0.68;
            puff.scale.set(1, 1, 1);
            puff.visible = true;
          } else {
            const mat = new THREE.MeshBasicMaterial({
              color: '#dffeff',
              transparent: true,
              opacity: 0.68,
            });
            puff = new THREE.Mesh(this.wakeGeo, mat);
            this.scene.add(puff);
          }
          puff.position.set(
            this.position.x - fwdX * 21.5 + rightX * side + (Math.random() - 0.5) * 1.4,
            0.05,
            this.position.z - fwdZ * 21.5 + rightZ * side + (Math.random() - 0.5) * 1.4,
          );
          this.wakes.push({ mesh: puff, life: 1.5, maxLife: 1.5 });
        }
      }
    }

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
        const s = 1 + (1 - w.life / w.maxLife) * 2.8;
        w.mesh.scale.set(s, 1, s);
        (w.mesh.material as THREE.MeshBasicMaterial).opacity = (w.life / w.maxLife) * 0.65;
      }
    }

    // Update Camera when piloting "LADY VICE"
    if (this.active) {
      if (this.firstPersonCam) {
        const bridgeEye = this.handle.getWorldPos(
          this.tmpBridgeEyeLocal.set(0, this.handle.upperDeckY + 2.2, 6.2),
          this.tmpBridgeEye,
        );
        const bridgeLook = this.handle.getWorldPos(
          this.tmpBridgeLookLocal.set(0, this.handle.upperDeckY + 0.8, 36.0),
          this.tmpBridgeLook,
        );
        camera.position.copy(bridgeEye);
        camera.lookAt(bridgeLook);
      } else {
        const desiredPos = this.tmpDesiredPos.set(
          this.position.x - fwdX * 36.0,
          this.position.y + 13.5,
          this.position.z - fwdZ * 36.0,
        );
        const desiredLook = this.tmpDesiredLook.set(
          this.position.x + fwdX * 14.0,
          this.position.y + 3.2,
          this.position.z + fwdZ * 14.0,
        );
        if (!this.camInit) {
          this.camPosSmooth.copy(desiredPos);
          this.camLookSmooth.copy(desiredLook);
          this.camInit = true;
        } else {
          const blend = 1 - Math.exp(-5.5 * clampedDt);
          this.camPosSmooth.lerp(desiredPos, blend);
          this.camLookSmooth.lerp(desiredLook, blend);
        }
        camera.position.copy(this.camPosSmooth);
        camera.lookAt(this.camLookSmooth);
      }
    }

    return {
      inYacht: this.active,
      yachtName: 'SUPERYACHT „LADY VICE“',
      speedKmh: Math.round(Math.abs(this.speed) * 3.6),
      nearbyYacht: this.isPlayerNear(playerPos),
      firstPersonCam: this.firstPersonCam,
    };
  }
}
