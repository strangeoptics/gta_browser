import * as THREE from 'three';
import { resolvePlayerCollisions } from '../engine/Physics';
import { getPlayerGlbOutfitTexture, type PlayerGlbOutfitStyle } from '../entities/CharacterTextures';
import {
  createGoldChainMesh,
  createPoliceCapMesh,
  createSunglassesMesh,
  instantiateGlbCharacter,
  whenGlbCharacterReady,
  type GlbCharacterInstance,
} from '../entities/GlbCharacterFactory';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { AABB } from '../types';
import type { StuntRamp } from '../world/StuntRamps';

export type GarageRideId = 'skateboard' | 'roadbike';
export type GarageRideState = 'wall' | 'ground' | 'riding';

export interface PlayerOutfitSpec {
  primary: string;
  accent: string;
  pants: string;
  variant: number;
  role: 'civilian' | 'police';
}

export interface GarageWallInteractable {
  id: GarageRideId;
  action: 'detach' | 'rehang';
  name: string;
  promptLabel: string;
  hitbox: THREE.Mesh;
}

export interface GarageRideHudState {
  inRide: boolean;
  rideId: GarageRideId | null;
  rideName: string;
  speedKmh: number;
  grounded: boolean;
  firstPersonCam: boolean;
  nearbyMountPrompt: string | null;
  nearbyMountId: GarageRideId | null;
  canRehangInGarage: boolean;
}

interface GarageRideEntity {
  id: GarageRideId;
  name: string;
  shortTag: string;
  radarColor: string;
  state: GarageRideState;
  root: THREE.Group;
  deckOrFramePivot: THREE.Group;
  steerPivot?: THREE.Group;
  crankPivot?: THREE.Group;
  pedalLeft?: THREE.Object3D;
  pedalRight?: THREE.Object3D;
  truckFront?: THREE.Object3D;
  truckRear?: THREE.Object3D;
  kickstand?: THREE.Object3D;
  wheels: THREE.Object3D[];
  rider: ArticulatedRider;
  wallHitbox: THREE.Mesh;
  wallPos: THREE.Vector3;
  wallEuler: THREE.Euler;
  detachFloorPos: THREE.Vector3;
  detachYaw: number;
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  vy: number;
  grounded: boolean;
  airborneFromRamp: boolean;
  jumpStartX: number;
  jumpStartZ: number;
  animPhase: number;
  ollieTimer: number;
}

interface BoneAxisBinding {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  axisX: THREE.Vector3; // Model-space +X (pitch: + tilts torso forward, - lifts leg/arm forward)
  axisY: THREE.Vector3; // Model-space +Y (yaw: + turns left)
  axisZ: THREE.Vector3; // Model-space +Z (roll: + abducts left arm out, - abducts right arm out)
}

interface RiderBoneRig {
  abdomen: BoneAxisBinding | null;
  torso: BoneAxisBinding | null;
  head: BoneAxisBinding | null;
  upperArmL: BoneAxisBinding | null;
  lowerArmL: BoneAxisBinding | null;
  upperArmR: BoneAxisBinding | null;
  lowerArmR: BoneAxisBinding | null;
  upperLegL: BoneAxisBinding | null;
  lowerLegL: BoneAxisBinding | null;
  upperLegR: BoneAxisBinding | null;
  lowerLegR: BoneAxisBinding | null;
}

interface ArticulatedRider {
  group: THREE.Group;
  bodyRoot: THREE.Group;
  glb: GlbCharacterInstance | null;
  bones: RiderBoneRig | null;
  policeCapGroup: THREE.Group | null;
  goldChainGroup: THREE.Group | null;
  pendingOutfit: PlayerOutfitSpec | null;
  // Smoothed pose state so transitions (cruise <-> push <-> ollie) are silky smooth
  poseT: number;
  legLX: number;
  legRX: number;
  kneeLX: number;
  kneeRX: number;
  armLX: number;
  armRX: number;
  armLZ: number;
  armRZ: number;
}

const _tmpQ1 = new THREE.Quaternion();
const _tmpQ2 = new THREE.Quaternion();
const _tmpQ3 = new THREE.Quaternion();

function bindBoneAxes(model: THREE.Object3D, bone: THREE.Object3D | null): BoneAxisBinding | null {
  if (!bone) return null;
  model.updateMatrixWorld(true);
  const worldQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(worldQuat);
  const invWorld = worldQuat.clone().invert();
  return {
    bone,
    restQuat: bone.quaternion.clone(),
    axisX: new THREE.Vector3(1, 0, 0).applyQuaternion(invWorld).normalize(),
    axisY: new THREE.Vector3(0, 1, 0).applyQuaternion(invWorld).normalize(),
    axisZ: new THREE.Vector3(0, 0, 1).applyQuaternion(invWorld).normalize(),
  };
}

/**
 * Sets a bone's quaternion directly from its clean standing rest pose + exact model-space
 * Euler angles (rx = pitch, ry = yaw, rz = roll). Never accumulates drift or spins!
 */
function setBonePose(binding: BoneAxisBinding | null, rx = 0, ry = 0, rz = 0): void {
  if (!binding) return;
  binding.bone.quaternion.copy(binding.restQuat);
  if (rx !== 0) {
    _tmpQ1.setFromAxisAngle(binding.axisX, rx);
    binding.bone.quaternion.multiply(_tmpQ1);
  }
  if (ry !== 0) {
    _tmpQ2.setFromAxisAngle(binding.axisY, ry);
    binding.bone.quaternion.multiply(_tmpQ2);
  }
  if (rz !== 0) {
    _tmpQ3.setFromAxisAngle(binding.axisZ, rz);
    binding.bone.quaternion.multiply(_tmpQ3);
  }
}

let cachedSkateDeckTex: THREE.CanvasTexture | null = null;
const cachedPlateTextures = new Map<string, THREE.CanvasTexture>();

function getSkateDeckGraphicTexture(): THREE.CanvasTexture {
  if (cachedSkateDeckTex) return cachedSkateDeckTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Vibrant 80s Miami Vice sunset gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#190e36');
  grad.addColorStop(0.35, '#9c2776');
  grad.addColorStop(0.68, '#ff5c77');
  grad.addColorStop(1.0, '#ffbe4f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  // Retro segmented synthwave sun disc
  ctx.fillStyle = '#fff099';
  ctx.beginPath();
  ctx.arc(64, 132, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9c2776';
  for (let s = 0; s < 5; s++) {
    ctx.fillRect(20, 134 + s * 7, 88, 2.5 + s * 0.6);
  }

  // Diagonal turquoise & hot-pink racing chevrons
  ctx.strokeStyle = '#36f1e6';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(64, 28);
  ctx.lineTo(128, 56);
  ctx.stroke();

  ctx.strokeStyle = '#ff4fa3';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 206);
  ctx.lineTo(64, 232);
  ctx.lineTo(128, 206);
  ctx.stroke();

  // Dark palm silhouette in center
  ctx.strokeStyle = '#120a24';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(62, 195);
  ctx.quadraticCurveTo(56, 150, 68, 112);
  ctx.stroke();
  for (const ang of [-2.3, -1.7, -1.1, -0.4, 0.2]) {
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(68, 112);
    ctx.quadraticCurveTo(68 + Math.cos(ang) * 24, 112 + Math.sin(ang) * 18, 68 + Math.cos(ang) * 38, 122 + Math.sin(ang) * 14);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedSkateDeckTex = tex;
  return tex;
}

function getWallPlateTexture(label: string, accentHex: string): THREE.CanvasTexture {
  const key = `${label}|${accentHex}`;
  const existing = cachedPlateTextures.get(key);
  if (existing) return existing;

  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#161224';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = accentHex;
  ctx.font = '900 26px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedPlateTextures.set(key, tex);
  return tex;
}

/**
 * Manages the wall-mounted Skateboard ("NEON SKATEBOARD") and 80s Aero Road Bike ("80s RENNRAD")
 * on the West interior wall of the VICE SAFEHOUSE Garage (x = 30.3, z = -35.75 & -33.15).
 * Both can be detached from their wall brackets, ridden anywhere across Miami (with Ollies, Bunny-Hops,
 * kick-pushing & 360° pedaling animations), parked anywhere, and hung back onto the garage wall!
 */
export class GarageRidesSystem {
  private readonly scene: THREE.Scene;
  private readonly rides: Record<GarageRideId, GarageRideEntity>;
  private activeRide: GarageRideEntity | null = null;
  private firstPersonCam = false;

  private readonly keys = new Set<string>();
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private camInitialized = false;
  private jumpQueued = false;

  private readonly hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  private emptySkateInd!: THREE.MeshStandardMaterial;
  private emptyBikeInd!: THREE.MeshStandardMaterial;

  public onMountStateChanged?: (detachingFromWall: boolean, rideName: string) => void;
  public onJumpTriggered?: (id: GarageRideId) => void;
  public onLanded?: (id: GarageRideId) => void;
  public onStuntLanded?: (distanceM: number, reward: number) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.buildGarageWallRack();
    const skateboard = this.buildSkateboardEntity();
    const roadbike = this.buildRoadBikeEntity();
    this.rides = { skateboard, roadbike };

    this.snapToWall(skateboard);
    this.snapToWall(roadbike);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' && this.activeRide) {
        e.preventDefault();
        this.jumpQueued = true;
      }
      if (e.code === 'KeyV' && this.activeRide) {
        this.firstPersonCam = !this.firstPersonCam;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  public isRiding(): boolean {
    return this.activeRide !== null;
  }

  public getActiveRide(): GarageRideEntity | null {
    return this.activeRide;
  }

  public getActiveRideId(): GarageRideId | null {
    return this.activeRide ? this.activeRide.id : null;
  }

  public getParkedMarkers(): { x: number; z: number; label: string; color: string }[] {
    const out: { x: number; z: number; label: string; color: string }[] = [];
    for (const id of ['skateboard', 'roadbike'] as GarageRideId[]) {
      const r = this.rides[id];
      if (r.state === 'ground') {
        out.push({
          x: r.position.x,
          z: r.position.z,
          label: r.shortTag,
          color: r.radarColor,
        });
      }
    }
    return out;
  }

  /**
   * Raycast interactables on the Safehouse Garage West Wall so aiming at the mounted
   * Skateboard or Rennrad switches the player's FPS weapon to the 3D open Hand!
   */
  public getWallInteractables(): GarageWallInteractable[] {
    if (this.activeRide) return [];
    const list: GarageWallInteractable[] = [];
    for (const id of ['skateboard', 'roadbike'] as GarageRideId[]) {
      const r = this.rides[id];
      if (r.state === 'wall') {
        list.push({
          id,
          action: 'detach',
          name: r.name,
          promptLabel: `${r.name} ABNEHMEN & FAHREN`,
          hitbox: r.wallHitbox,
        });
      } else if (r.state === 'ground') {
        list.push({
          id,
          action: 'rehang',
          name: r.name,
          promptLabel: `${r.name} WIEDER AN GARAGENWAND BEFESTIGEN`,
          hitbox: r.wallHitbox,
        });
      }
    }
    return list;
  }

  /**
   * Finds the closest rideable Skateboard or Rennrad (either hanging on the garage wall
   * within 2.7m OR parked on the ground within 2.8m).
   */
  public findNearestMountable(playerPos: THREE.Vector3): { id: GarageRideId; fromWall: boolean; name: string } | null {
    if (this.activeRide) return null;
    let best: { id: GarageRideId; fromWall: boolean; name: string } | null = null;
    let bestDistSq = 999;

    for (const id of ['skateboard', 'roadbike'] as GarageRideId[]) {
      const r = this.rides[id];
      if (r.state === 'wall' && playerPos.y < 3.2) {
        const dx = playerPos.x - (r.wallPos.x + 0.55);
        const dz = playerPos.z - r.wallPos.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < 2.65 * 2.65 && dSq < bestDistSq) {
          bestDistSq = dSq;
          best = { id, fromWall: true, name: r.name };
        }
      } else if (r.state === 'ground') {
        const dSq = playerPos.distanceToSquared(r.position);
        if (dSq < 2.85 * 2.85 && dSq < bestDistSq) {
          bestDistSq = dSq;
          best = { id, fromWall: false, name: r.name };
        }
      }
    }
    return best;
  }

  /**
   * Checks whether the player (while riding inside the garage) is close enough to the West
   * garage wall rack to hang the active Skateboard or Rennrad directly back on the wall.
   */
  public canRehangActiveRide(pos: THREE.Vector3): boolean {
    if (!this.activeRide) return false;
    return pos.x > 30.0 && pos.x < 36.8 && pos.z > -37.3 && pos.z < -31.2 && pos.y < 3.5;
  }

  /**
   * Detaches the Skateboard or Rennrad from the garage wall (or picks it up from the ground)
   * and immediately begins riding it!
   */
  public mountRide(id: GarageRideId, outfit?: PlayerOutfitSpec): void {
    const r = this.rides[id];
    const fromWall = r.state === 'wall';
    if (fromWall) {
      r.position.copy(r.detachFloorPos);
      r.yaw = r.detachYaw;
    }

    r.state = 'riding';
    r.speed = fromWall ? 2.2 : 0; // gentle roll-off boost when detaching in garage!
    r.vy = 0;
    r.grounded = true;
    r.airborneFromRamp = false;
    r.ollieTimer = 0;

    if (outfit) {
      this.applyOutfitToRider(r.rider, outfit);
    }

    if (r.kickstand) r.kickstand.visible = false;
    r.root.rotation.set(0, r.yaw, 0);
    r.root.position.copy(r.position);
    r.deckOrFramePivot.rotation.set(0, 0, 0);

    this.activeRide = r;
    this.camInitialized = false;
    this.jumpQueued = false;
    this.syncWallIndicators();
    this.onMountStateChanged?.(fromWall, r.name);
  }

  /**
   * Steps off the currently ridden Skateboard or Rennrad, leaving it parked cleanly on the ground.
   */
  public dismountRide(
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number } = {
      minX: -122,
      maxX: 204,
      minZ: -136,
      maxZ: 141,
    },
  ): { x: number; y: number; z: number; yaw: number } | null {
    if (!this.activeRide) return null;
    const r = this.activeRide;
    r.state = 'ground';
    r.speed = 0;
    r.vy = 0;
    r.rider.group.visible = false;
    r.deckOrFramePivot.rotation.set(0, 0, 0);
    if (r.steerPivot) r.steerPivot.rotation.y = 0.16;
    if (r.kickstand) r.kickstand.visible = true;
    r.root.rotation.set(0, r.yaw, r.id === 'roadbike' ? 0.08 : 0);

    const exitDist = 0.88;
    const sideX = Math.cos(r.yaw) * -exitDist;
    const sideZ = -Math.sin(r.yaw) * -exitDist;
    const out = {
      x: THREE.MathUtils.clamp(r.position.x + sideX, bounds.minX + 1, bounds.maxX - 1),
      y: r.position.y + 0.08,
      z: THREE.MathUtils.clamp(r.position.z + sideZ, bounds.minZ + 1, bounds.maxZ - 1),
      yaw: r.yaw + Math.PI,
    };

    this.activeRide = null;
    this.keys.clear();
    this.jumpQueued = false;
    this.syncWallIndicators();
    return out;
  }

  /**
   * Hangs a ground-parked or currently ridden Skateboard / Rennrad cleanly back onto its
   * dedicated wall mount in the Safehouse Garage.
   */
  public hangRideOnWall(
    id: GarageRideId,
  ): { dismountedPlayerPos: { x: number; y: number; z: number; yaw: number } | null; name: string } {
    const r = this.rides[id];
    let dismountedPlayerPos: { x: number; y: number; z: number; yaw: number } | null = null;
    if (this.activeRide === r) {
      dismountedPlayerPos = {
        x: 32.1,
        y: 0.22,
        z: r.wallPos.z,
        yaw: Math.PI / 2, // face the garage wall where you just hung it!
      };
      this.activeRide = null;
      this.keys.clear();
    }
    this.snapToWall(r);
    this.syncWallIndicators();
    this.onMountStateChanged?.(false, r.name);
    return { dismountedPlayerPos, name: r.name };
  }

  private snapToWall(r: GarageRideEntity): void {
    r.state = 'wall';
    r.speed = 0;
    r.vy = 0;
    r.rider.group.visible = false;
    if (r.kickstand) r.kickstand.visible = false;
    if (r.steerPivot) r.steerPivot.rotation.y = 0;
    r.deckOrFramePivot.rotation.set(0, 0, 0);
    r.root.position.copy(r.wallPos);
    r.root.rotation.copy(r.wallEuler);
    r.position.copy(r.wallPos);
  }

  private syncWallIndicators(): void {
    if (this.emptySkateInd) {
      this.emptySkateInd.emissiveIntensity = this.rides.skateboard.state === 'wall' ? 2.1 : 0.45;
    }
    if (this.emptyBikeInd) {
      this.emptyBikeInd.emissiveIntensity = this.rides.roadbike.state === 'wall' ? 2.1 : 0.45;
    }
  }

  public update(
    dt: number,
    elapsed: number,
    isPlaying: boolean,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    allRideColliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    pad?: GamepadSnapshot,
    stuntRamps?: StuntRamp[],
    drunkLevel = 0,
    getGroundHeight?: (x: number, z: number) => number,
  ): GarageRideHudState {
    const clampedDt = Math.min(dt, 0.05);

    if (this.activeRide && pad?.connected && pad.camTogglePressed) {
      this.firstPersonCam = !this.firstPersonCam;
    }

    if (this.activeRide) {
      const r = this.activeRide;
      this.updateActiveRidePhysics(
        r,
        clampedDt,
        elapsed,
        isPlaying,
        allRideColliders,
        bounds,
        pad,
        stuntRamps,
        drunkLevel,
        getGroundHeight,
      );

      // Show 3rd-person rider only in chase cam; hide in 1st-person POV
      r.rider.group.visible = !this.firstPersonCam;
      this.updateCamera(r, clampedDt, camera);

      return {
        inRide: true,
        rideId: r.id,
        rideName: r.name,
        speedKmh: Math.round(Math.abs(r.speed) * 3.6),
        grounded: r.grounded,
        firstPersonCam: this.firstPersonCam,
        nearbyMountPrompt: null,
        nearbyMountId: null,
        canRehangInGarage: this.canRehangActiveRide(r.position),
      };
    }

    // When on foot, check nearby Skateboard / Rennrad (on garage wall or parked on ground)
    const near = this.findNearestMountable(playerPos);
    const prompt = near
      ? near.fromWall
        ? `[E] ${near.name} VON DER GARAGENWAND NEHMEN & FAHREN`
        : `[E] AUFSTEIGEN · ${near.name}`
      : null;

    return {
      inRide: false,
      rideId: null,
      rideName: '',
      speedKmh: 0,
      grounded: true,
      firstPersonCam: this.firstPersonCam,
      nearbyMountPrompt: prompt,
      nearbyMountId: near ? near.id : null,
      canRehangInGarage: false,
    };
  }

  private updateActiveRidePhysics(
    r: GarageRideEntity,
    dt: number,
    elapsed: number,
    isPlaying: boolean,
    colliders: AABB[],
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    pad?: GamepadSnapshot,
    stuntRamps?: StuntRamp[],
    drunkLevel = 0,
    getGroundHeight?: (x: number, z: number) => number,
  ): void {
    const isSkate = r.id === 'skateboard';
    const kbThrottle = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const kbSteer = (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0);
    const padThrottle = pad?.connected ? (Math.abs(pad.rt - pad.lt) > 0.08 ? pad.rt - pad.lt : pad.moveY) : 0;
    const padSteer = pad?.connected ? -pad.moveX : 0;

    const throttle = isPlaying ? THREE.MathUtils.clamp(kbThrottle + padThrottle, -1, 1) : 0;
    const sprinting =
      isPlaying &&
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Boolean(pad?.connected && pad.sprint));
    const drunkSway =
      drunkLevel > 0.005 ? (Math.sin(elapsed * 2.1) * 0.42 + Math.cos(elapsed * 3.3) * 0.2) * drunkLevel : 0;
    const steer = isPlaying ? THREE.MathUtils.clamp(kbSteer + padSteer + drunkSway, -1.15, 1.15) : 0;

    const maxFwd = isSkate ? (sprinting ? 15.8 : 12.2) : sprinting ? 19.2 : 14.6;
    const maxRev = isSkate ? -3.6 : -3.8;
    const accelRate = isSkate ? (sprinting ? 13.5 : 10.2) : sprinting ? 14.8 : 11.2;

    if (throttle > 0.05) {
      r.speed += accelRate * throttle * dt;
    } else if (throttle < -0.05) {
      r.speed += (r.speed > 0.4 ? 19.5 : 8.5) * throttle * dt;
    } else {
      // Smooth low rolling-resistance coasting!
      r.speed *= Math.exp((isSkate ? -1.15 : -0.92) * dt);
    }
    r.speed = THREE.MathUtils.clamp(r.speed, maxRev, maxFwd);

    // Turning & carving agility
    const speedTurnFactor = isSkate
      ? Math.min(1, Math.abs(r.speed) / 2.2 + 0.32)
      : Math.min(1, Math.abs(r.speed) / 2.8 + 0.2);
    const dirSign = r.speed >= -0.15 ? 1 : -1;
    const turnRate = (isSkate ? 3.05 : 2.65) * speedTurnFactor * dirSign;
    r.yaw += steer * turnRate * dt;

    // Ollie (Skateboard) or Bunny-Hop (Rennrad) on [Space] / Gamepad Jump!
    const wantsJump = this.jumpQueued || Boolean(isPlaying && pad?.connected && pad.jump);
    this.jumpQueued = false;
    if (isPlaying && wantsJump && r.grounded) {
      r.vy = isSkate ? 6.9 : 5.7;
      r.grounded = false;
      r.ollieTimer = isSkate ? 0.56 : 0.42;
      r.jumpStartX = r.position.x;
      r.jumpStartZ = r.position.z;
      this.onJumpTriggered?.(r.id);
    }

    // Gravity
    r.vy -= 19.0 * dt;

    // Integrate horizontal & vertical tentative position
    const fwdX = Math.sin(r.yaw);
    const fwdZ = Math.cos(r.yaw);
    let nextX = THREE.MathUtils.clamp(r.position.x + fwdX * r.speed * dt, bounds.minX + 0.8, bounds.maxX - 1.5);
    let nextZ = THREE.MathUtils.clamp(r.position.z + fwdZ * r.speed * dt, bounds.minZ + 0.8, bounds.maxZ - 0.8);
    const nextY = r.position.y + r.vy * dt;

    // Keep out of deep ocean water (stop gently at the surf line)
    const rawTerrainY = getGroundHeight ? getGroundHeight(nextX, nextZ) : 0;
    if (rawTerrainY < -0.32) {
      nextX = r.position.x;
      nextZ = r.position.z;
      r.speed *= -0.25;
    }

    // Safehouse interior slab sits visually at y = 0.20 (sidewalk block collider is 0.18)
    const inSafehouseSlab = nextX > 30.1 && nextX < 49.9 && nextZ > -48.9 && nextZ < -31.1;
    const baseGroundY = Math.max(inSafehouseSlab ? 0.2 : 0, rawTerrainY);

    const prevGrounded = r.grounded;
    const preCollisionX = nextX;
    const preCollisionZ = nextZ;

    const resolved = resolvePlayerCollisions(
      nextX,
      nextY,
      nextZ,
      r.vy,
      0.44,
      1.72,
      colliders,
      0.28,
      baseGroundY,
    );

    // Dampen speed if scraping hard into a wall
    if (Math.hypot(resolved.x - preCollisionX, resolved.z - preCollisionZ) > 0.025 && Math.abs(r.speed) > 3.5) {
      r.speed *= 0.72;
    }

    r.position.set(resolved.x, resolved.y, resolved.z);
    r.vy = resolved.vy;
    r.grounded = resolved.grounded;

    // Stunt Ramp launch support (you can hit Neon Stunt Ramps on both Skateboard & Rennrad!)
    if (stuntRamps) {
      for (const ramp of stuntRamps) {
        const relX = r.position.x - ramp.x;
        const relZ = r.position.z - ramp.z;
        const along = relX * ramp.dirX + relZ * ramp.dirZ;
        const side = Math.abs(relX * ramp.dirZ - relZ * ramp.dirX);
        if (side < ramp.width * 0.55 && along > -ramp.length * 0.5 && along < ramp.length * 0.52) {
          const frac = (along + ramp.length * 0.5) / ramp.length;
          const rampTopY = baseGroundY + frac * ramp.height;
          if (r.position.y <= rampTopY + 0.18 && r.vy <= 1.5) {
            r.position.y = rampTopY;
            r.grounded = true;
            const alignedSpd = r.speed * (fwdX * ramp.dirX + fwdZ * ramp.dirZ);
            if (frac > 0.74 && alignedSpd > 7.0) {
              r.vy = Math.min(11.2, alignedSpd * 0.48);
              r.grounded = false;
              r.airborneFromRamp = true;
              r.ollieTimer = 0.5;
              r.jumpStartX = r.position.x;
              r.jumpStartZ = r.position.z;
              this.onJumpTriggered?.(r.id);
            }
          }
        }
      }
    }

    // Landing feedback & Stunt Bonus check
    if (!prevGrounded && r.grounded) {
      this.onLanded?.(r.id);
      if (r.airborneFromRamp) {
        r.airborneFromRamp = false;
        const jumpDist = Math.hypot(r.position.x - r.jumpStartX, r.position.z - r.jumpStartZ);
        if (jumpDist >= 9) {
          const reward = jumpDist >= 18 ? 550 : 350;
          this.onStuntLanded?.(Math.round(jumpDist), reward);
        }
      }
    }

    // Sync root transform & animate wheels, trucks/forks, cranks, and 3rd-person rider!
    r.root.position.copy(r.position);
    r.root.rotation.y = r.yaw;

    if (r.ollieTimer > 0) {
      r.ollieTimer = Math.max(0, r.ollieTimer - dt);
    }

    if (isSkate) {
      this.animateSkateboard(r, dt, steer, throttle > 0.05, sprinting);
    } else {
      this.animateRoadBike(r, dt, steer, throttle > 0.05, sprinting);
    }
  }

  private animateSkateboard(
    r: GarageRideEntity,
    dt: number,
    steer: number,
    pushing: boolean,
    sprinting: boolean,
  ): void {
    // Spin small 60mm urethane wheels fast
    const wheelSpin = r.speed * dt * 15.5;
    for (const w of r.wheels) {
      w.rotation.x += wheelSpin;
    }

    // Carve deck roll & counter-turn trucks
    const carveRoll = -steer * 0.24 * Math.min(1, Math.abs(r.speed) / 6 + 0.25);
    r.root.rotation.z += (carveRoll - r.root.rotation.z) * (1 - Math.exp(-12 * dt));
    if (r.truckFront) r.truckFront.rotation.y = steer * 0.22;
    if (r.truckRear) r.truckRear.rotation.y = -steer * 0.22;

    // Ollie pop pitch curve in mid-air (nose pops up steeply, levels out at apex, lands flat!)
    let targetPitch = 0;
    if (!r.grounded) {
      targetPitch = THREE.MathUtils.clamp(-r.vy * 0.065, -0.46, 0.22);
    }
    r.deckOrFramePivot.rotation.x += (targetPitch - r.deckOrFramePivot.rotation.x) * (1 - Math.exp(-15 * dt));

    // Rigged GLB Skater Rider animation (exact model-space bone poses: sideways stance, kick-push & Ollie!)
    const rider = r.rider;
    const blend = 1 - Math.exp(-12 * dt);
    const b = rider.bones;
    if (!b) return;

    let tgtLegLX: number;
    let tgtLegRX: number;
    let tgtKneeLX: number;
    let tgtKneeRX: number;
    let tgtArmLX: number;
    let tgtArmRX: number;
    let tgtArmLZ: number;
    let tgtArmRZ: number;
    let tgtBodyY: number;
    let torsoPitch = 0.14;
    let rightLegOutZ = 0;

    if (!r.grounded) {
      // Mid-air Ollie tuck: both knees pulled up over the deck & arms spread wide for style!
      tgtBodyY = 0.12;
      torsoPitch = 0.24;
      tgtLegLX = -0.78;
      tgtLegRX = -0.72;
      tgtKneeLX = 1.05;
      tgtKneeRX = 0.98;
      tgtArmLX = -0.2;
      tgtArmRX = -0.2;
      tgtArmLZ = 0.85;
      tgtArmRZ = -0.85;
    } else if (pushing && r.speed >= -0.1) {
      // Rhythmic kick-push: front leg planted on deck bolts, rear leg swings back & forth!
      r.animPhase += dt * (sprinting ? 6.4 : 4.8);
      const pushWave = Math.sin(r.animPhase);
      tgtBodyY = -0.02 - Math.max(0, pushWave) * 0.04;
      torsoPitch = 0.22;
      tgtLegLX = -0.26;
      tgtKneeLX = 0.36;
      tgtLegRX = pushWave * 0.65;
      tgtKneeRX = Math.max(0.1, -pushWave * 0.55 + 0.28);
      rightLegOutZ = -0.22;
      tgtArmLX = -0.35 - pushWave * 0.45;
      tgtArmRX = -0.35 + pushWave * 0.45;
      tgtArmLZ = 0.38;
      tgtArmRZ = -0.38;
    } else {
      // Poised cruising carve stance: both feet planted sideways, knees gently bent, arms out for balance
      tgtBodyY = -0.03;
      torsoPitch = 0.14;
      tgtLegLX = -0.2;
      tgtLegRX = 0.16;
      tgtKneeLX = 0.26;
      tgtKneeRX = 0.24;
      tgtArmLX = -0.22;
      tgtArmRX = -0.22;
      tgtArmLZ = 0.44 + steer * 0.22;
      tgtArmRZ = -0.44 + steer * 0.22;
    }

    rider.bodyRoot.position.y += (tgtBodyY - rider.bodyRoot.position.y) * blend;
    rider.legLX += (tgtLegLX - rider.legLX) * blend;
    rider.legRX += (tgtLegRX - rider.legRX) * blend;
    rider.kneeLX += (tgtKneeLX - rider.kneeLX) * blend;
    rider.kneeRX += (tgtKneeRX - rider.kneeRX) * blend;
    rider.armLX += (tgtArmLX - rider.armLX) * blend;
    rider.armRX += (tgtArmRX - rider.armRX) * blend;
    rider.armLZ += (tgtArmLZ - rider.armLZ) * blend;
    rider.armRZ += (tgtArmRZ - rider.armRZ) * blend;

    setBonePose(b.abdomen, torsoPitch * 0.45, 0, 0);
    setBonePose(b.torso, torsoPitch * 0.55, 0.18, 0);
    // Counter-rotate head toward +Z nose of the board (set fresh from rest pose — never spins!)
    setBonePose(b.head, -torsoPitch * 0.6, 0.88, 0);

    setBonePose(b.upperLegL, rider.legLX, 0, 0.08);
    setBonePose(b.lowerLegL, rider.kneeLX, 0, 0);
    setBonePose(b.upperLegR, rider.legRX, 0, -0.08 + rightLegOutZ);
    setBonePose(b.lowerLegR, rider.kneeRX, 0, 0);

    setBonePose(b.upperArmL, rider.armLX, 0, rider.armLZ);
    setBonePose(b.lowerArmL, -0.35, 0, 0);
    setBonePose(b.upperArmR, rider.armRX, 0, rider.armRZ);
    setBonePose(b.lowerArmR, -0.35, 0, 0);
  }

  private animateRoadBike(
    r: GarageRideEntity,
    dt: number,
    steer: number,
    pedaling: boolean,
    sprinting: boolean,
  ): void {
    // Spin 700c road racing wheels (radius ~0.34m)
    const wheelSpin = (r.speed / 0.34) * dt;
    for (const w of r.wheels) {
      w.rotation.x += wheelSpin;
    }

    // Dynamic corner banking lean + steerable drop-bar / fork turn
    const targetLean = -steer * 0.36 * Math.min(1, Math.abs(r.speed) / 10);
    r.root.rotation.z += (targetLean - r.root.rotation.z) * (1 - Math.exp(-10 * dt));
    if (r.steerPivot) {
      const targetSteer = steer * 0.38 * (1 - Math.min(0.55, Math.abs(r.speed) / 24));
      r.steerPivot.rotation.y += (targetSteer - r.steerPivot.rotation.y) * (1 - Math.exp(-12 * dt));
    }

    // Bunny-hop pitch in air
    const targetPitch = !r.grounded ? THREE.MathUtils.clamp(-r.vy * 0.045, -0.28, 0.18) : 0;
    r.deckOrFramePivot.rotation.x += (targetPitch - r.deckOrFramePivot.rotation.x) * (1 - Math.exp(-14 * dt));

    // Rotate crankset & counter-rotate flat pedals when pedaling forward (freewheels when coasting!)
    if ((pedaling && r.speed > 0.15) || r.speed < -0.15) {
      const cadence = sprinting ? 10.5 : 7.8;
      r.animPhase += dt * cadence * (r.speed >= 0 ? 1 : -1);
    }
    if (r.crankPivot) {
      r.crankPivot.rotation.x = r.animPhase;
      if (r.pedalLeft) r.pedalLeft.rotation.x = -r.animPhase;
      if (r.pedalRight) r.pedalRight.rotation.x = -r.animPhase;
    }

    // Rigged GLB Road-Cyclist: exact saddle seat + aero forward tuck + 360° synchronized pedaling!
    const rider = r.rider;
    const b = rider.bones;
    const sprintLift = pedaling && sprinting ? 0.055 + Math.abs(Math.sin(r.animPhase)) * 0.035 : 0;
    rider.bodyRoot.position.y += (0.31 + sprintLift - rider.bodyRoot.position.y) * (1 - Math.exp(-10 * dt));
    if (!b) return;

    // Aero road-racing forward lean from the hips up, head tilted up to watch the road
    setBonePose(b.abdomen, 0.38, 0, 0);
    setBonePose(b.torso, 0.44, 0, 0);
    setBonePose(b.head, -0.68, steer * 0.18, 0);

    // Arms reaching forward onto the drop-bar brake hoods (tracking steering subtly!)
    setBonePose(b.upperArmL, -1.18 - steer * 0.06, 0, -0.06);
    setBonePose(b.lowerArmL, -0.24, 0, 0);
    setBonePose(b.upperArmR, -1.18 + steer * 0.06, 0, 0.06);
    setBonePose(b.lowerArmR, -0.24, 0, 0);

    // Synchronized 360° pedaling kinematics tracking the left & right crank arms!
    const leftLift = Math.sin(r.animPhase);
    const leftFwd = Math.cos(r.animPhase);
    const rightLift = Math.sin(r.animPhase + Math.PI);
    const rightFwd = Math.cos(r.animPhase + Math.PI);

    setBonePose(b.upperLegL, -0.78 - leftLift * 0.42 - leftFwd * 0.14, 0, 0.06);
    setBonePose(b.lowerLegL, 0.92 + leftLift * 0.46 - leftFwd * 0.12, 0, 0);
    setBonePose(b.upperLegR, -0.78 - rightLift * 0.42 - rightFwd * 0.14, 0, -0.06);
    setBonePose(b.lowerLegR, 0.92 + rightLift * 0.46 - rightFwd * 0.12, 0, 0);
  }

  private updateCamera(r: GarageRideEntity, dt: number, camera: THREE.PerspectiveCamera): void {
    const fwdX = Math.sin(r.yaw);
    const fwdZ = Math.cos(r.yaw);
    const isSkate = r.id === 'skateboard';

    if (this.firstPersonCam) {
      const eyeY = isSkate ? 1.62 : 1.46;
      const eyeFwd = isSkate ? 0.08 : 0.24;
      camera.position.set(
        r.position.x + fwdX * eyeFwd,
        r.position.y + eyeY,
        r.position.z + fwdZ * eyeFwd,
      );
      camera.lookAt(
        r.position.x + fwdX * 16,
        r.position.y + (isSkate ? 1.42 : 1.18),
        r.position.z + fwdZ * 16,
      );
      return;
    }

    const chaseBack = isSkate ? 4.35 : 4.85;
    const chaseUp = isSkate ? 2.05 : 2.25;
    const desiredPos = new THREE.Vector3(
      r.position.x - fwdX * chaseBack,
      r.position.y + chaseUp,
      r.position.z - fwdZ * chaseBack,
    );
    const desiredLook = new THREE.Vector3(
      r.position.x + fwdX * 4.5,
      r.position.y + 1.15,
      r.position.z + fwdZ * 4.5,
    );

    if (!this.camInitialized) {
      this.camPosSmooth.copy(desiredPos);
      this.camLookSmooth.copy(desiredLook);
      this.camInitialized = true;
    } else {
      const blend = 1 - Math.exp(-9.5 * dt);
      this.camPosSmooth.lerp(desiredPos, blend);
      this.camLookSmooth.lerp(desiredLook, blend);
    }
    camera.position.copy(this.camPosSmooth);
    camera.lookAt(this.camLookSmooth);
  }

  // ===========================================================================
  // Garage West-Wall Pegboard & Padded Mounting Brackets (x = 30.31, z = -34.4)
  // ===========================================================================
  private buildGarageWallRack(): void {
    const rackGroup = new THREE.Group();
    const wallX = 30.31; // Flush on the east inner face of the Safehouse Garage West Wall (30.275)

    const boardMat = new THREE.MeshStandardMaterial({
      color: '#1b1728',
      roughness: 0.45,
      metalness: 0.65,
    });
    const bracketMat = new THREE.MeshStandardMaterial({
      color: '#cfd8e6',
      roughness: 0.22,
      metalness: 0.88,
    });
    const rubberPadMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      roughness: 0.7,
    });
    const cyanPadMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      roughness: 0.7,
    });
    this.emptySkateInd = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 2.1,
    });
    this.emptyBikeInd = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 2.1,
    });

    // Sleek dark-steel wall display backing board spanning both mounts
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.85, 4.55), boardMat);
    backPanel.position.set(wallX, 1.48, -34.35);
    backPanel.receiveShadow = true;
    rackGroup.add(backPanel);

    // Thin top & bottom neon accent trim strips
    const topNeon = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 2.05), this.emptySkateInd);
    topNeon.position.set(wallX + 0.015, 2.36, -35.6);
    rackGroup.add(topNeon);

    const topNeonBike = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 2.35), this.emptyBikeInd);
    topNeonBike.position.set(wallX + 0.015, 2.36, -33.2);
    rackGroup.add(topNeonBike);

    // Label plaques above each mount
    const skatePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.24),
      new THREE.MeshStandardMaterial({
        map: getWallPlateTexture('VICE SKATE', '#ff4fa3'),
        emissive: '#ffffff',
        emissiveMap: getWallPlateTexture('VICE SKATE', '#ff4fa3'),
        emissiveIntensity: 0.8,
      }),
    );
    skatePlate.rotation.y = Math.PI / 2;
    skatePlate.position.set(wallX + 0.032, 2.16, -35.75);
    rackGroup.add(skatePlate);

    const bikePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.24),
      new THREE.MeshStandardMaterial({
        map: getWallPlateTexture('CORSA RENNRAD', '#36f1e6'),
        emissive: '#ffffff',
        emissiveMap: getWallPlateTexture('CORSA RENNRAD', '#36f1e6'),
        emissiveIntensity: 0.8,
      }),
    );
    bikePlate.rotation.y = Math.PI / 2;
    bikePlate.position.set(wallX + 0.032, 2.16, -33.15);
    rackGroup.add(bikePlate);

    // 1) Skateboard Wall Rack Arms (at z = -35.75, cradling the upper truck horizontally!)
    for (const sz of [-0.11, 0.11]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.035), bracketMat);
      arm.position.set(wallX + 0.12, 1.66, -35.75 + sz);
      rackGroup.add(arm);

      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8), rubberPadMat);
      tip.position.set(wallX + 0.22, 1.69, -35.75 + sz);
      rackGroup.add(tip);
    }

    // 2) Rennrad Dual Horizontal Top-Tube Wall Hooks (cradling the horizontal top tube at y = 1.66)
    for (const sz of [-0.18, 0.24]) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.35, 10), bracketMat);
      stem.rotation.z = Math.PI / 2;
      stem.position.set(wallX + 0.18, 1.66, -33.15 + sz);
      rackGroup.add(stem);

      const hookCradle = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.015, 8, 14, Math.PI),
        cyanPadMat,
      );
      hookCradle.rotation.y = Math.PI / 2;
      hookCradle.rotation.x = Math.PI;
      hookCradle.position.set(wallX + 0.34, 1.67, -33.15 + sz);
      rackGroup.add(hookCradle);
    }

    this.scene.add(rackGroup);
  }

  // ===========================================================================
  // 1) Procedural 80s Miami Neon Skateboard + Articulated Skater Rider
  // ===========================================================================
  private buildSkateboardEntity(): GarageRideEntity {
    const root = new THREE.Group();
    const deckOrFramePivot = new THREE.Group();
    root.add(deckOrFramePivot);

    const gripMat = new THREE.MeshStandardMaterial({ color: '#171520', roughness: 0.94 });
    const mapleEdgeMat = new THREE.MeshStandardMaterial({ color: '#dfbe92', roughness: 0.65 });
    const graphicMat = new THREE.MeshStandardMaterial({
      map: getSkateDeckGraphicTexture(),
      roughness: 0.28,
      metalness: 0.12,
    });
    const alloyMat = new THREE.MeshStandardMaterial({ color: '#d8e0ec', roughness: 0.22, metalness: 0.9 });
    const pinkNeonMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 1.85,
    });
    const wheelCyanMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#189e96',
      emissiveIntensity: 0.95,
      roughness: 0.22,
    });

    const deckY = 0.088;

    // 7-ply Maple Center Deck (top = dark grip, sides = natural maple ply, bottom = 80s sunset graphic!)
    const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.016, 0.56), [
      mapleEdgeMat,
      mapleEdgeMat,
      gripMat,
      graphicMat,
      mapleEdgeMat,
      mapleEdgeMat,
    ]);
    centerDeck.position.set(0, deckY, 0);
    centerDeck.castShadow = true;
    deckOrFramePivot.add(centerDeck);

    // Neon pink grip-tape cutout stripe on top of the deck
    const gripStripe = new THREE.Mesh(new THREE.BoxGeometry(0.232, 0.003, 0.028), pinkNeonMat);
    gripStripe.position.set(0, deckY + 0.009, -0.12);
    deckOrFramePivot.add(gripStripe);

    // Upturned Rounded Nose (+Z) & Kicktail (-Z)
    for (const [zSign, angle] of [
      [1, -0.32],
      [-1, 0.35],
    ] as [number, number][]) {
      const kick = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.15), [
        mapleEdgeMat,
        mapleEdgeMat,
        gripMat,
        mapleEdgeMat,
        mapleEdgeMat,
        mapleEdgeMat,
      ]);
      kick.position.set(0, deckY + 0.024, zSign * 0.34);
      kick.rotation.x = angle;
      kick.castShadow = true;
      deckOrFramePivot.add(kick);

      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.015, 14, 1, false, 0, Math.PI), gripMat);
      tip.rotation.y = zSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      tip.rotation.x = angle;
      tip.position.set(0, deckY + 0.044, zSign * 0.395);
      deckOrFramePivot.add(tip);
    }

    // Thin neon slide-rails along underside edges
    for (const sx of [-0.098, 0.098]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.42), pinkNeonMat);
      rail.position.set(sx, deckY - 0.012, 0);
      deckOrFramePivot.add(rail);
    }

    // Front & Rear Die-Cast Skateboard Trucks + 4 Spinning Urethane Wheels
    const wheels: THREE.Object3D[] = [];
    const buildTruck = (zPos: number): THREE.Group => {
      const truck = new THREE.Group();
      truck.position.set(0, deckY - 0.01, zPos);

      const baseplate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.095), alloyMat);
      truck.add(baseplate);

      const kingpin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.045, 8), alloyMat);
      kingpin.position.y = -0.024;
      truck.add(kingpin);

      const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 8), pinkNeonMat);
      bushing.position.y = -0.022;
      truck.add(bushing);

      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.235, 8), alloyMat);
      axle.rotation.z = Math.PI / 2;
      axle.position.y = -0.044;
      truck.add(axle);

      for (const sx of [-0.108, 0.108]) {
        const wPivot = new THREE.Group();
        wPivot.position.set(sx, -0.044, 0);

        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.042, 14), wheelCyanMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wPivot.add(wheel);

        const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.045, 10), alloyMat);
        bearing.rotation.z = Math.PI / 2;
        wPivot.add(bearing);

        truck.add(wPivot);
        wheels.push(wPivot);
      }

      deckOrFramePivot.add(truck);
      return truck;
    };

    const truckFront = buildTruck(0.21);
    const truckRear = buildTruck(-0.21);

    // Articulated Skater Rider (sideways stance on deck)
    const rider = this.buildArticulatedRider('skateboard');
    deckOrFramePivot.add(rider.group);

    this.scene.add(root);

    // Dedicated static wall-mount raycast hitbox right at the Skateboard's garage wall cradle
    const wallPos = new THREE.Vector3(30.45, 1.45, -35.75);
    // Hang vertically on the wall with nose up (+Y) and 80s sunset graphic & glowing wheels facing into the garage (+X)!
    const wallEuler = new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, 'YXZ');

    const wallHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.55), this.hitboxMat);
    wallHitbox.position.copy(wallPos);
    this.scene.add(wallHitbox);

    return {
      id: 'skateboard',
      name: 'NEON SKATEBOARD',
      shortTag: 'SB',
      radarColor: '#ff4fa3',
      state: 'wall',
      root,
      deckOrFramePivot,
      truckFront,
      truckRear,
      wheels,
      rider,
      wallHitbox,
      wallPos,
      wallEuler,
      detachFloorPos: new THREE.Vector3(32.2, 0.2, -35.4),
      detachYaw: Math.PI / 2,
      position: wallPos.clone(),
      yaw: Math.PI / 2,
      speed: 0,
      vy: 0,
      grounded: true,
      airborneFromRamp: false,
      jumpStartX: 32.2,
      jumpStartZ: -35.4,
      animPhase: 0,
      ollieTimer: 0,
    };
  }

  // ===========================================================================
  // 2) Procedural 80s Aero Rennrad ("VICE CORSA RENNRAD") + Pedaling Cyclist
  // ===========================================================================
  private buildRoadBikeEntity(): GarageRideEntity {
    const root = new THREE.Group();
    const deckOrFramePivot = new THREE.Group();
    root.add(deckOrFramePivot);

    const frameMat = new THREE.MeshStandardMaterial({
      color: '#2de2d6', // Iconic 80s Bianchi Celeste / Miami Cyan metallic!
      roughness: 0.18,
      metalness: 0.65,
    });
    const lugPinkMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: '#e6eef7',
      roughness: 0.12,
      metalness: 0.94,
    });
    const spokeMat = new THREE.MeshStandardMaterial({
      color: '#cfd8e3',
      roughness: 0.2,
      metalness: 0.88,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: '#17151f',
      roughness: 0.85,
    });
    const gumwallMat = new THREE.MeshStandardMaterial({
      color: '#d9a468',
      roughness: 0.68,
    });
    const tapeWhiteMat = new THREE.MeshStandardMaterial({
      color: '#f7f4f0',
      roughness: 0.62,
    });
    const saddleMat = new THREE.MeshStandardMaterial({
      color: '#1e1929',
      roughness: 0.72,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#e5b546',
      roughness: 0.24,
      metalness: 0.85,
    });

    // Helper: Connect two 3D points with a sleek steel racing frame tube
    const addTube = (
      parent: THREE.Object3D,
      a: THREE.Vector3,
      b: THREE.Vector3,
      radius: number,
      mat: THREE.Material,
    ): THREE.Mesh => {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
      mesh.position.copy(a).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Helper: Build authentic 700c narrow road-racing wheel with tan gumwalls & 12 wire spokes
    const wheelY = 0.345;
    const frontZ = 0.54;
    const rearZ = -0.52;

    const build700cWheel = (isRear: boolean): THREE.Group => {
      const wg = new THREE.Group();

      // Narrow 25mm high-pressure slick tire
      const tireGeo = new THREE.TorusGeometry(0.322, 0.022, 12, 32);
      tireGeo.rotateY(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wg.add(tire);

      // Classic 80s tan/gumwall sidewall rings
      const gumGeo = new THREE.TorusGeometry(0.308, 0.008, 8, 32);
      gumGeo.rotateY(Math.PI / 2);
      for (const sx of [-0.015, 0.015]) {
        const gum = new THREE.Mesh(gumGeo, gumwallMat);
        gum.position.x = sx;
        wg.add(gum);
      }

      // Polished deep-section alloy rim
      const rimGeo = new THREE.TorusGeometry(0.294, 0.012, 8, 32);
      rimGeo.rotateY(Math.PI / 2);
      wg.add(new THREE.Mesh(rimGeo, chromeMat));

      // Hub + quick-release skewer
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 12), chromeMat);
      hub.rotation.z = Math.PI / 2;
      wg.add(hub);

      // 12 radial/crossed stainless-steel spokes
      const spokeGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.57, 5);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI;
        const sp = new THREE.Mesh(spokeGeo, spokeMat);
        sp.rotation.x = ang;
        sp.position.x = (i % 2 === 0 ? 1 : -1) * 0.012;
        wg.add(sp);
      }

      if (isRear) {
        const cassette = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.042, 0.024, 14), goldMat);
        cassette.rotation.z = Math.PI / 2;
        cassette.position.x = -0.036;
        wg.add(cassette);
      }

      return wg;
    };

    const rearWheel = build700cWheel(true);
    rearWheel.position.set(0, wheelY, rearZ);
    deckOrFramePivot.add(rearWheel);

    // Key 80s Diamond Racing Frame joints
    const bbPos = new THREE.Vector3(0, 0.285, -0.07); // Bottom bracket
    const seatCluster = new THREE.Vector3(0, 0.82, -0.24); // Top of seat tube
    const headTop = new THREE.Vector3(0, 0.83, 0.36); // Top of head tube
    const headBot = new THREE.Vector3(0, 0.67, 0.42); // Bottom of head tube

    // Main Diamond Frame Triangles
    addTube(deckOrFramePivot, bbPos, seatCluster, 0.018, frameMat); // Seat tube
    addTube(deckOrFramePivot, seatCluster, headTop, 0.017, frameMat); // Horizontal 80s top tube!
    addTube(deckOrFramePivot, bbPos, headBot, 0.02, frameMat); // Down tube
    addTube(deckOrFramePivot, headBot, headTop, 0.021, lugPinkMat); // Head tube with pink racing lug!

    // Twin Rear Seatstays & Chainstays
    for (const sx of [-0.046, 0.046]) {
      const dropout = new THREE.Vector3(sx, wheelY, rearZ);
      addTube(deckOrFramePivot, new THREE.Vector3(sx * 0.3, seatCluster.y - 0.02, seatCluster.z), dropout, 0.01, frameMat);
      addTube(deckOrFramePivot, new THREE.Vector3(sx * 0.45, bbPos.y, bbPos.z), dropout, 0.012, chromeMat);
    }

    // Fluted Chrome Seatpost & Sculpted Suede Racing Saddle
    addTube(deckOrFramePivot, seatCluster, new THREE.Vector3(0, 0.96, -0.285), 0.014, chromeMat);
    const saddleRear = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.042, 0.14), saddleMat);
    saddleRear.position.set(0, 0.975, -0.33);
    deckOrFramePivot.add(saddleRear);
    const saddleNose = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.036, 0.16), saddleMat);
    saddleNose.position.set(0, 0.975, -0.22);
    deckOrFramePivot.add(saddleNose);

    // Rear Red Tail Micro-LED on Seatpost
    const tailLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.055, 0.024),
      new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff1a44', emissiveIntensity: 2.2 }),
    );
    tailLed.position.set(0, 0.89, -0.29);
    deckOrFramePivot.add(tailLed);

    // Downtube Bottle Cage + 80s Hot-Pink Bidon Water Bottle
    const bidon = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.19, 12), lugPinkMat);
    bidon.position.set(0, 0.49, 0.17);
    bidon.rotation.x = -0.88;
    deckOrFramePivot.add(bidon);

    // Steerable Front Fork, Front 700c Wheel, Quill Stem & Wrapped Drop-Bar Handlebars!
    const steerPivot = new THREE.Group();
    steerPivot.position.set(0, 0.75, 0.39);
    deckOrFramePivot.add(steerPivot);

    const frontWheel = build700cWheel(false);
    frontWheel.position.set(0, wheelY - 0.75, frontZ - 0.39);
    steerPivot.add(frontWheel);

    // Twin Chrome Fork Blades
    for (const sx of [-0.045, 0.045]) {
      addTube(
        steerPivot,
        new THREE.Vector3(sx * 0.55, -0.08, 0.03),
        new THREE.Vector3(sx, wheelY - 0.75, frontZ - 0.39),
        0.013,
        chromeMat,
      );
    }

    // Polished Quill Stem
    addTube(steerPivot, new THREE.Vector3(0, 0.08, -0.03), new THREE.Vector3(0, 0.22, -0.06), 0.013, chromeMat);
    addTube(steerPivot, new THREE.Vector3(0, 0.22, -0.06), new THREE.Vector3(0, 0.22, 0.05), 0.013, chromeMat);

    // Classic Curved Drop-Bar Handlebars wrapped in crisp white tape + Brake Hoods!
    const barTop = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 10), tapeWhiteMat);
    barTop.rotation.z = Math.PI / 2;
    barTop.position.set(0, 0.22, 0.05);
    steerPivot.add(barTop);

    for (const sx of [-0.205, 0.205]) {
      // Curved drop hooks curling forward and down!
      const dropHook = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.013, 8, 16, Math.PI * 1.15),
        tapeWhiteMat,
      );
      dropHook.rotation.y = Math.PI / 2;
      dropHook.rotation.x = -Math.PI * 0.5;
      dropHook.position.set(sx, 0.145, 0.055);
      steerPivot.add(dropHook);

      // Rubber aero brake hood + chrome brake lever
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.055, 0.065), saddleMat);
      hood.position.set(sx, 0.21, 0.125);
      hood.rotation.x = 0.35;
      steerPivot.add(hood);

      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.095, 0.016), chromeMat);
      lever.position.set(sx, 0.15, 0.145);
      lever.rotation.x = -0.18;
      steerPivot.add(lever);
    }

    // Small Brass Rennrad Bell ([G]) + White Safety Lamp on Handlebars
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), goldMat);
    bellDome.position.set(0.075, 0.242, 0.05);
    steerPivot.add(bellDome);

    const headLed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.045, 10),
      new THREE.MeshStandardMaterial({ color: '#fff8e0', emissive: '#ffe4a0', emissiveIntensity: 2.4 }),
    );
    headLed.rotation.x = Math.PI / 2;
    headLed.position.set(-0.05, 0.22, 0.075);
    steerPivot.add(headLed);

    // Rotating Drivetrain: 5-Arm Chainring, Crank Arms & Counter-Rotating Flat Pedals!
    const crankPivot = new THREE.Group();
    crankPivot.position.copy(bbPos);
    deckOrFramePivot.add(crankPivot);

    const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.009, 6, 22), chromeMat);
    chainring.rotation.y = Math.PI / 2;
    chainring.position.x = -0.045;
    crankPivot.add(chainring);

    // Upper & Lower Drive Chain Runs
    addTube(
      deckOrFramePivot,
      new THREE.Vector3(-0.042, bbPos.y + 0.085, bbPos.z),
      new THREE.Vector3(-0.038, wheelY + 0.055, rearZ),
      0.005,
      saddleMat,
    );
    addTube(
      deckOrFramePivot,
      new THREE.Vector3(-0.042, bbPos.y - 0.085, bbPos.z),
      new THREE.Vector3(-0.038, wheelY - 0.055, rearZ),
      0.005,
      saddleMat,
    );

    const buildCrankArmAndPedal = (side: -1 | 1, upSign: 1 | -1): THREE.Object3D => {
      const armX = side * 0.068;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.17, 0.024), chromeMat);
      arm.position.set(armX, upSign * 0.08, 0);
      crankPivot.add(arm);

      const pedalPivot = new THREE.Group();
      pedalPivot.position.set(side * 0.115, upSign * 0.16, 0);
      const pedalBody = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.018, 0.068), saddleMat);
      pedalPivot.add(pedalBody);
      crankPivot.add(pedalPivot);
      return pedalPivot;
    };

    const pedalLeft = buildCrankArmAndPedal(1, 1);
    const pedalRight = buildCrankArmAndPedal(-1, -1);

    // Retractable Alloy Kickstand (shown when parked on ground, hidden on wall & while riding)
    const kickstand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6), chromeMat);
    kickstand.position.set(-0.08, 0.16, -0.12);
    kickstand.rotation.z = 0.42;
    kickstand.rotation.x = -0.15;
    deckOrFramePivot.add(kickstand);

    // Articulated Road Cyclist Rider
    const rider = this.buildArticulatedRider('roadbike');
    deckOrFramePivot.add(rider.group);

    this.scene.add(root);

    // Wall mount position on the Safehouse Garage West Wall (top tube resting at y = 1.66 in the cyan padded hooks!)
    const wallPos = new THREE.Vector3(30.65, 0.84, -33.15);
    const wallEuler = new THREE.Euler(0, 0, 0, 'YXZ'); // Parallel to West wall, facing +Z, right profile facing garage!

    const wallHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.25, 1.85), this.hitboxMat);
    wallHitbox.position.set(30.58, 1.42, -33.15);
    this.scene.add(wallHitbox);

    return {
      id: 'roadbike',
      name: '80s RENNRAD',
      shortTag: 'RR',
      radarColor: '#36f1e6',
      state: 'wall',
      root,
      deckOrFramePivot,
      steerPivot,
      crankPivot,
      pedalLeft,
      pedalRight,
      kickstand,
      wheels: [frontWheel, rearWheel],
      rider,
      wallHitbox,
      wallPos,
      wallEuler,
      detachFloorPos: new THREE.Vector3(32.2, 0.2, -33.3),
      detachYaw: Math.PI / 2,
      position: wallPos.clone(),
      yaw: Math.PI / 2,
      speed: 0,
      vy: 0,
      grounded: true,
      airborneFromRamp: false,
      jumpStartX: 32.2,
      jumpStartZ: -33.3,
      animPhase: 0,
      ollieTimer: 0,
    };
  }

  // ===========================================================================
  // Rigged GLB 3rd-Person Rider (syncs live with PlayerAvatar's 80s Outfit!)
  // ===========================================================================
  private buildArticulatedRider(kind: GarageRideId): ArticulatedRider {
    const group = new THREE.Group();
    const bodyRoot = new THREE.Group();
    group.add(bodyRoot);

    if (kind === 'skateboard') {
      // Sideways skate stance standing on the deck
      group.position.set(0, 0.1, -0.02);
      bodyRoot.rotation.y = -1.05;
    } else {
      // Seated aero road-cyclist position on the Rennrad saddle (saddle at y = 0.975, z = -0.28)
      bodyRoot.position.set(0, 0.31, -0.27);
    }

    group.visible = false;

    const rider: ArticulatedRider = {
      group,
      bodyRoot,
      glb: null,
      bones: null,
      policeCapGroup: null,
      goldChainGroup: null,
      pendingOutfit: null,
      poseT: 0,
      legLX: -0.2,
      legRX: 0.16,
      kneeLX: 0.26,
      kneeRX: 0.24,
      armLX: -0.22,
      armRX: -0.22,
      armLZ: 0.44,
      armRZ: -0.44,
    };

    whenGlbCharacterReady((tpl) => {
      const inst = instantiateGlbCharacter(tpl, 'average');
      rider.glb = inst;

      // Capture clean standing rest quaternions & model-space axes BEFORE parenting under rotated bodyRoot!
      const m = inst.model;
      m.updateMatrixWorld(true);
      rider.bones = {
        abdomen: bindBoneAxes(m, m.getObjectByName('Abdomen') ?? null),
        torso: bindBoneAxes(m, inst.torsoBone),
        head: bindBoneAxes(m, inst.headBone),
        upperArmL: bindBoneAxes(m, inst.upperArmL),
        lowerArmL: bindBoneAxes(m, inst.lowerArmL),
        upperArmR: bindBoneAxes(m, inst.upperArmR),
        lowerArmR: bindBoneAxes(m, inst.lowerArmR),
        upperLegL: bindBoneAxes(m, inst.upperLegL),
        lowerLegL: bindBoneAxes(m, inst.lowerLegL),
        upperLegR: bindBoneAxes(m, inst.upperLegR),
        lowerLegR: bindBoneAxes(m, inst.lowerLegR),
      };

      // Attach bone-mounted 80s accessories BEFORE parenting under rotated bodyRoot so alignment is exact!
      if (inst.headBone) {
        inst.attachToBone(inst.headBone, new THREE.Vector3(0, 1.655, 0.118), createSunglassesMesh());

        const cap = createPoliceCapMesh();
        cap.visible = false;
        rider.policeCapGroup = cap;
        inst.attachToBone(inst.headBone, new THREE.Vector3(0, 1.755, -0.008), cap);
      }

      if (inst.torsoBone) {
        const chain = createGoldChainMesh();
        chain.visible = false;
        rider.goldChainGroup = chain;
        inst.attachToBone(inst.torsoBone, new THREE.Vector3(0, 1.44, 0.125), chain);
      }

      bodyRoot.add(inst.model);

      if (rider.pendingOutfit) {
        this.applyOutfitToRider(rider, rider.pendingOutfit);
      } else {
        this.applyOutfitToRider(rider, {
          primary: '#f2e8e1',
          accent: '#36f1e6',
          pants: '#272c42',
          variant: 2,
          role: 'civilian',
        });
      }
    });

    return rider;
  }

  private resolveGlbOutfitStyle(outfit: PlayerOutfitSpec): {
    style: PlayerGlbOutfitStyle;
    shoes: string;
    policeCap: boolean;
    goldChain: boolean;
  } {
    if (outfit.role === 'police') {
      return { style: 'police', shoes: '#141418', policeCap: true, goldChain: false };
    }
    if (outfit.variant === 1) {
      return { style: 'hawaiian', shoes: '#ffffff', policeCap: false, goldChain: false };
    }
    if (outfit.primary === '#1e172b') {
      return { style: 'midnight-neon', shoes: '#ff4fa3', policeCap: false, goldChain: true };
    }
    if (outfit.primary === '#9fe6d8') {
      return { style: 'detective', shoes: '#2c2520', policeCap: false, goldChain: true };
    }
    return { style: 'white-suit', shoes: '#f5f2ee', policeCap: false, goldChain: false };
  }

  private applyOutfitToRider(rider: ArticulatedRider, outfit: PlayerOutfitSpec): void {
    rider.pendingOutfit = outfit;
    const resolved = this.resolveGlbOutfitStyle(outfit);
    if (rider.glb) {
      if (rider.glb.materials.shirt) {
        rider.glb.materials.shirt.color.set('#ffffff');
        rider.glb.materials.shirt.map = getPlayerGlbOutfitTexture(resolved.style, outfit.primary, outfit.accent);
        rider.glb.materials.shirt.needsUpdate = true;
      }
      if (rider.glb.materials.pants) {
        rider.glb.materials.pants.color.set(outfit.pants);
      }
      if (rider.glb.materials.socks) {
        rider.glb.materials.socks.color.set(resolved.shoes);
      }
    }
    if (rider.policeCapGroup) {
      rider.policeCapGroup.visible = resolved.policeCap;
    }
    if (rider.goldChainGroup) {
      rider.goldChainGroup.visible = resolved.goldChain;
    }
  }
}
