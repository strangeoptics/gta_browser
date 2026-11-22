import * as THREE from 'three';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import { TracerPool } from './TracerPool';

export interface ShootableTarget {
  id: string;
  mesh: THREE.Object3D;
  onHit: (damage: number, hitPoint: THREE.Vector3, hitNormal: THREE.Vector3) => boolean; // returns true if destroyed/killed
}

export interface WeaponHudState {
  slotIndex: number;
  name: string;
  ammo: number;
  magSize: number;
  isMelee: boolean;
  reloading: boolean;
  reloadProgress: number;
  ads: boolean;
  spreadPx: number;
  hitmarkerAlpha: number;
  hitmarkerKill: boolean;
}

interface WeaponDef {
  id: string;
  name: string;
  auto: boolean;
  fireRate: number; // shots per second
  damage: number;
  pellets: number;
  spreadHip: number;
  spreadAds: number;
  magSize: number;
  reloadTime: number;
  recoilKick: number;
  recoilPitch: number;
  range: number;
  hipPos: THREE.Vector3;
  adsPos: THREE.Vector3;
  tracerColor: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const WEAPONS: WeaponDef[] = [
  {
    id: 'katana',
    name: 'NEON KATANA',
    auto: false,
    fireRate: 2.6,
    damage: 65,
    pellets: 1,
    spreadHip: 0,
    spreadAds: 0,
    magSize: 1,
    reloadTime: 0.1,
    recoilKick: 0.04,
    recoilPitch: 0.04,
    range: 3.4,
    hipPos: new THREE.Vector3(0.32, -0.26, -0.44),
    adsPos: new THREE.Vector3(0.24, -0.22, -0.42),
    tracerColor: 0x36f1e6,
  },
  {
    id: 'pistol',
    name: 'VICE 9MM',
    auto: false,
    fireRate: 5.5,
    damage: 28,
    pellets: 1,
    spreadHip: 0.012,
    spreadAds: 0.003,
    magSize: 12,
    reloadTime: 1.15,
    recoilKick: 0.075,
    recoilPitch: 0.08,
    range: 120,
    hipPos: new THREE.Vector3(0.24, -0.22, -0.44),
    adsPos: new THREE.Vector3(0.0, -0.145, -0.36),
    tracerColor: 0xffd27d,
  },
  {
    id: 'smg',
    name: 'NEON MAC-10',
    auto: true,
    fireRate: 12.5,
    damage: 16,
    pellets: 1,
    spreadHip: 0.032,
    spreadAds: 0.014,
    magSize: 30,
    reloadTime: 1.55,
    recoilKick: 0.055,
    recoilPitch: 0.055,
    range: 95,
    hipPos: new THREE.Vector3(0.26, -0.24, -0.46),
    adsPos: new THREE.Vector3(0.0, -0.16, -0.36),
    tracerColor: 0x36f1e6,
  },
  {
    id: 'shotgun',
    name: 'PALM 12G',
    auto: false,
    fireRate: 1.25,
    damage: 18,
    pellets: 6,
    spreadHip: 0.068,
    spreadAds: 0.042,
    magSize: 6,
    reloadTime: 1.9,
    recoilKick: 0.14,
    recoilPitch: 0.16,
    range: 65,
    hipPos: new THREE.Vector3(0.27, -0.25, -0.48),
    adsPos: new THREE.Vector3(0.0, -0.165, -0.4),
    tracerColor: 0xff7b54,
  },
  {
    id: 'launcher',
    name: 'NEON LAUNCHER',
    auto: false,
    fireRate: 0.75,
    damage: 120,
    pellets: 1,
    spreadHip: 0.008,
    spreadAds: 0.002,
    magSize: 4,
    reloadTime: 2.1,
    recoilKick: 0.18,
    recoilPitch: 0.18,
    range: 130,
    hipPos: new THREE.Vector3(0.3, -0.26, -0.46),
    adsPos: new THREE.Vector3(0.06, -0.18, -0.38),
    tracerColor: 0xff4fa3,
  },
];

export class WeaponSystem {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig = new THREE.Group();
  private readonly weaponModels: THREE.Group[] = [];
  private readonly handModel: THREE.Group;
  private readonly muzzleTips: THREE.Vector3[] = [];
  private readonly muzzleFlash: THREE.Mesh;
  private readonly muzzleLight: THREE.PointLight;

  private slotIndex = 1; // start with Vice 9mm (slot 0 = Katana, 1 = 9mm, 2 = SMG, 3 = 12G, 4 = RPG)
  private ammo: number[] = WEAPONS.map((w) => w.magSize);
  private fireCooldown = 0;
  private slashAnimTimer = 0;
  private handMode = false;
  private eatAnimTimer = 0;
  private reloading = false;
  private reloadTimer = 0;
  private triggerDown = false;
  private semiConsumed = false;
  private ads = false;
  private enabled = true;
  private launcherUnlocked = false;

  // Viewmodel animation state
  private recoilZ = 0;
  private recoilRotX = 0;
  private swayX = 0;
  private swayY = 0;
  private bobPhase = 0;
  private drunkLevel = 0;
  private drunkTime = 0;
  private flashTimer = 0;
  private hitmarkerAlpha = 0;
  private hitmarkerKill = false;
  private baseFov = 75;

  // Effects pools & reusable raycast scratch buffers
  private readonly tracerPool: TracerPool;
  private readonly sparks: SparkParticle[] = [];
  private readonly sparkPool: THREE.Mesh[] = [];
  private readonly sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private readonly raycaster = new THREE.Raycaster();
  private readonly raycastScratch: THREE.Object3D[] = [];
  private readonly tmpOrigin = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpEnd = new THREE.Vector3();
  private readonly tmpNormal = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpNegForward = new THREE.Vector3();
  private readonly tmpTargetPos = new THREE.Vector3();
  private readonly tmpToTarget = new THREE.Vector3();
  private readonly tmpMuzzleWorld = new THREE.Vector3();

  // Optional callbacks for audio, wanted, decals & explosion hooks
  public onShotFired?: (weaponId: string, origin: THREE.Vector3) => void;
  public onExplosion?: (origin: THREE.Vector3, radius: number, damage: number) => void;
  public onWorldImpact?: (point: THREE.Vector3, normal: THREE.Vector3) => void;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.baseFov = camera.fov;
    this.tracerPool = new TracerPool(scene);

    this.camera.add(this.rig);
    this.scene.add(this.camera);

    // Build procedural 3D weapon viewmodels
    const katana = this.buildKatanaModel();
    const pistol = this.buildPistolModel();
    const smg = this.buildSmgModel();
    const shotgun = this.buildShotgunModel();
    const launcher = this.buildLauncherModel();

    this.weaponModels.push(katana.group, pistol.group, smg.group, shotgun.group, launcher.group);
    this.muzzleTips.push(katana.muzzleLocal, pistol.muzzleLocal, smg.muzzleLocal, shotgun.muzzleLocal, launcher.muzzleLocal);
    this.weaponModels.forEach((m, i) => {
      m.visible = i === this.slotIndex;
      this.rig.add(m);
    });

    // Procedural 3D open Hand viewmodel (shown instead of weapon when aiming at food!)
    this.handModel = this.buildHandModel();
    this.handModel.visible = false;
    this.rig.add(this.handModel);

    // Muzzle flash sprite-like star mesh + point light
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.95,
    });
    this.muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), flashMat);
    this.muzzleFlash.visible = false;
    this.rig.add(this.muzzleFlash);

    // Attach muzzleLight directly to always-visible camera (NOT rig!) so hiding rig never alters WebGL light count
    this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 10, 2);
    this.muzzleLight.position.set(0.22, -0.18, -0.65);
    this.camera.add(this.muzzleLight);

    this.bindInputs();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.rig.visible = enabled;
    if (!enabled) {
      this.triggerDown = false;
      this.ads = false;
    }
  }

  public setViewmodelVisible(visible: boolean): void {
    this.rig.visible = this.enabled && visible;
  }

  public setHandMode(active: boolean): void {
    if (this.handMode === active) return;
    this.handMode = active;
    this.handModel.visible = active;
    this.weaponModels.forEach((m, i) => {
      m.visible = !active && i === this.slotIndex;
    });
  }

  public triggerEatAnimation(): void {
    this.eatAnimTimer = 0.42;
  }

  public isHandMode(): boolean {
    return this.handMode;
  }

  public isAdsActive(): boolean {
    return this.ads;
  }

  public unlockLauncher(): void {
    this.launcherUnlocked = true;
    this.ammo[4] = WEAPONS[4].magSize;
    this.switchWeapon(4);
  }

  public isLauncherUnlocked(): boolean {
    return this.launcherUnlocked;
  }

  public refillAllAmmo(): void {
    WEAPONS.forEach((w, i) => {
      this.ammo[i] = w.magSize;
    });
  }

  /**
   * Fires a Drive-By Neon Mac-10 SMG burst from the player's car window along the camera look ray.
   */
  public updateDriveBy(
    dt: number,
    isPlaying: boolean,
    carPos: THREE.Vector3,
    worldMeshes: readonly THREE.Object3D[],
    targetHitboxes: readonly THREE.Object3D[],
    pad?: GamepadSnapshot,
  ): void {
    const clampedDt = Math.min(dt, 0.05);
    this.fireCooldown = Math.max(0, this.fireCooldown - clampedDt);
    this.hitmarkerAlpha = Math.max(0, this.hitmarkerAlpha - clampedDt * 4.5);
    this.updateEffects(clampedDt);

    const wantsDriveBy = this.triggerDown || Boolean(pad?.connected && pad.rbHeld);
    if (!isPlaying || !wantsDriveBy || this.fireCooldown > 0) return;

    const smg = WEAPONS[2];
    this.fireCooldown = 1 / smg.fireRate;
    const origin = this.tmpOrigin.set(carPos.x, carPos.y + 1.18, carPos.z);
    this.onShotFired?.('smg', origin);

    const dir = this.tmpDir
      .set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.04, -1)
      .normalize()
      .applyQuaternion(this.camera.quaternion);

    const raycastables = this.raycastScratch;
    raycastables.length = 0;
    for (let i = 0; i < targetHitboxes.length; i++) raycastables.push(targetHitboxes[i]);
    for (let i = 0; i < worldMeshes.length; i++) raycastables.push(worldMeshes[i]);

    this.raycaster.set(origin, dir);
    this.raycaster.far = 90;

    // Non-recursive flat hitbox + world mesh raycast (zero hierarchy traversal & zero allocations!)
    const hits = this.raycaster.intersectObjects(raycastables, false);
    const endPoint = this.tmpEnd.copy(origin).addScaledVector(dir, 90);
    if (hits.length > 0) {
      const hit = hits[0];
      endPoint.copy(hit.point);
      const normal = hit.face ? this.tmpNormal.copy(hit.face.normal) : this.tmpNormal.set(0, 1, 0);
      if (hit.object instanceof THREE.Mesh) normal.transformDirection(hit.object.matrixWorld);
      const matched = hit.object.userData.shootableTarget as ShootableTarget | undefined;
      if (matched) {
        const killed = matched.onHit(smg.damage, endPoint, normal);
        this.hitmarkerAlpha = 1.0;
        this.hitmarkerKill = killed;
        this.spawnSparks(endPoint, normal, killed ? 0xff4fa3 : 0x36f1e6, killed ? 10 : 5);
      } else {
        this.spawnSparks(endPoint, normal, 0xffc066, 4);
      }
    }
    this.spawnTracer(origin, endPoint, smg.tracerColor);
  }

  private bindInputs(): void {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.triggerDown = true;
        this.semiConsumed = false;
      } else if (e.button === 2 && this.enabled) {
        this.ads = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.triggerDown = false;
        this.semiConsumed = false;
      } else if (e.button === 2) {
        this.ads = false;
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (this.enabled) e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      this.swayX = THREE.MathUtils.clamp(this.swayX - e.movementX * 0.00018, -0.035, 0.035);
      this.swayY = THREE.MathUtils.clamp(this.swayY + e.movementY * 0.00018, -0.035, 0.035);
    });

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Digit0') this.switchWeapon(0);
      else if (e.code === 'Digit1') this.switchWeapon(1);
      else if (e.code === 'Digit2') this.switchWeapon(2);
      else if (e.code === 'Digit3') this.switchWeapon(3);
      else if (e.code === 'Digit4' && this.launcherUnlocked) this.switchWeapon(4);
      else if (e.code === 'KeyR') this.startReload();
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        const count = this.launcherUnlocked ? WEAPONS.length : 4;
        const dir = e.deltaY > 0 ? 1 : -1;
        const next = (this.slotIndex + dir + count) % count;
        this.switchWeapon(next);
      },
      { passive: true },
    );
  }

  public switchWeapon(index: number): void {
    if (index === this.slotIndex || index < 0 || index >= WEAPONS.length) return;
    if (index === 4 && !this.launcherUnlocked) return;
    this.slotIndex = index;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0.18;
    this.recoilZ = 0.08;
    this.weaponModels.forEach((m, i) => {
      m.visible = i === this.slotIndex;
    });
  }

  private startReload(): void {
    const def = WEAPONS[this.slotIndex];
    if (this.reloading || this.ammo[this.slotIndex] >= def.magSize) return;
    this.reloading = true;
    this.reloadTimer = def.reloadTime;
  }

  public update(
    dt: number,
    isActive: boolean,
    playerSpeed: number,
    worldMeshes: readonly THREE.Object3D[],
    targetHitboxes: readonly THREE.Object3D[],
    pad?: GamepadSnapshot,
    drunkLevel = 0,
  ): WeaponHudState {
    const clampedDt = Math.min(dt, 0.05);
    this.drunkLevel = drunkLevel;
    this.drunkTime += clampedDt;

    // Gamepad weapon switch & reload
    if (this.enabled && isActive && pad?.connected) {
      const count = this.launcherUnlocked ? WEAPONS.length : 4;
      if (pad.nextWeaponPressed) this.switchWeapon((this.slotIndex + 1) % count);
      else if (pad.prevWeaponPressed) this.switchWeapon((this.slotIndex - 1 + count) % count);
      if (pad.reloadOrSprayPressed) this.startReload();
    }

    const def = WEAPONS[this.slotIndex];
    const isMelee = def.id === 'katana';
    const padTrigger = Boolean(pad?.connected && pad.rt > 0.35);
    const padAds = Boolean(pad?.connected && pad.lt > 0.35);
    const effectiveAds = !isMelee && (this.ads || padAds);
    const effectiveTrigger = this.triggerDown || padTrigger;
    if (!effectiveTrigger) this.semiConsumed = false;

    this.fireCooldown = Math.max(0, this.fireCooldown - clampedDt);
    this.slashAnimTimer = Math.max(0, this.slashAnimTimer - clampedDt);
    this.eatAnimTimer = Math.max(0, this.eatAnimTimer - clampedDt);
    this.hitmarkerAlpha = Math.max(0, this.hitmarkerAlpha - clampedDt * 4.5);

    // Reload timer
    if (this.reloading) {
      this.reloadTimer -= clampedDt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo[this.slotIndex] = def.magSize;
      }
    }

    // Firing / Melee Slash logic (suppressed while Hand Mode is active so LMB eats instead of shooting!)
    if (!this.handMode && this.enabled && isActive && effectiveTrigger && !this.reloading && this.fireCooldown <= 0) {
      if (def.auto || !this.semiConsumed) {
        if (isMelee) {
          this.performKatanaSlash(def, targetHitboxes);
          this.semiConsumed = true;
        } else if (this.ammo[this.slotIndex] > 0) {
          this.fireWeapon(def, worldMeshes, targetHitboxes);
          this.semiConsumed = true;
        } else {
          this.startReload();
          this.semiConsumed = true;
        }
      }
    }

    // Muzzle flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= clampedDt;
      if (this.flashTimer <= 0) {
        this.muzzleFlash.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    // Smooth ADS FOV
    const targetFov = this.enabled && isActive && effectiveAds ? this.baseFov - 14 : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-14 * clampedDt));
      this.camera.updateProjectionMatrix();
    }

    // Smooth viewmodel position, sway, bob & recoil recovery
    const targetPos = this.ads && !this.reloading ? def.adsPos : def.hipPos;
    const posBlend = 1 - Math.exp(-14 * clampedDt);
    this.rig.position.lerp(targetPos, posBlend);

    this.recoilZ += (0 - this.recoilZ) * (1 - Math.exp(-18 * clampedDt));
    this.recoilRotX += (0 - this.recoilRotX) * (1 - Math.exp(-16 * clampedDt));
    this.swayX += (0 - this.swayX) * (1 - Math.exp(-10 * clampedDt));
    this.swayY += (0 - this.swayY) * (1 - Math.exp(-10 * clampedDt));

    let bobX = 0;
    let bobY = 0;
    if (playerSpeed > 0.6) {
      this.bobPhase += clampedDt * (playerSpeed > 8 ? 13 : 9);
      const bobScale = this.ads ? 0.003 : 0.011;
      bobX = Math.cos(this.bobPhase * 0.5) * bobScale;
      bobY = Math.sin(this.bobPhase) * bobScale;
    }

    const reloadDip = this.reloading
      ? Math.sin((1 - this.reloadTimer / def.reloadTime) * Math.PI) * 0.14
      : 0;

    const drunkWobbleX = Math.sin(this.drunkTime * 2.2) * 0.042 * this.drunkLevel;
    const drunkWobbleY = Math.cos(this.drunkTime * 1.75) * 0.028 * this.drunkLevel;

    this.rig.position.x += this.swayX + bobX + drunkWobbleX;
    this.rig.position.y += this.swayY + bobY + drunkWobbleY - reloadDip;
    this.rig.position.z += this.recoilZ;
    this.rig.rotation.x = this.recoilRotX - reloadDip * 2.2 + drunkWobbleY * 1.4;
    this.rig.rotation.z = (this.reloading ? -reloadDip * 2.6 : -this.swayX * 2.2) - drunkWobbleX * 3.8;

    // Diagonal neon katana slash swing
    if (!this.handMode && isMelee && this.slashAnimTimer > 0) {
      const p = 1 - this.slashAnimTimer / 0.24;
      const swing = Math.sin(p * Math.PI);
      this.rig.position.x -= swing * 0.42;
      this.rig.position.y -= swing * 0.14;
      this.rig.rotation.z += swing * 1.45;
      this.rig.rotation.x -= swing * 0.85;
    }

    // Grab-and-eat hand animation (reaches forward then brings bite up toward camera!)
    if (this.handMode && this.eatAnimTimer > 0) {
      const p = 1 - this.eatAnimTimer / 0.42;
      const arc = Math.sin(p * Math.PI);
      this.rig.position.x -= arc * 0.18;
      this.rig.position.y += arc * 0.14;
      this.rig.position.z += arc * 0.16;
      this.rig.rotation.x += arc * 0.65;
    }

    // Update tracers & sparks
    this.updateEffects(clampedDt);

    const spreadRad = (effectiveAds ? def.spreadAds : def.spreadHip) + this.recoilRotX * 0.18 + this.drunkLevel * 0.075;
    const spreadPx = isMelee ? 12 : Math.round(10 + spreadRad * 420 + (playerSpeed > 1 ? 4 : 0));

    return {
      slotIndex: this.slotIndex,
      name: def.name,
      ammo: this.ammo[this.slotIndex],
      magSize: def.magSize,
      isMelee,
      reloading: this.reloading,
      reloadProgress: this.reloading ? 1 - this.reloadTimer / def.reloadTime : 0,
      ads: effectiveAds,
      spreadPx,
      hitmarkerAlpha: this.hitmarkerAlpha,
      hitmarkerKill: this.hitmarkerKill,
    };
  }

  private performKatanaSlash(def: WeaponDef, targetHitboxes: readonly THREE.Object3D[]): void {
    this.fireCooldown = 1 / def.fireRate;
    this.slashAnimTimer = 0.24;

    const camOrigin = this.tmpOrigin;
    this.camera.getWorldPosition(camOrigin);
    this.onShotFired?.('katana', camOrigin);

    const forward = this.tmpForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const negForward = this.tmpNegForward.copy(forward).negate();
    const targetPos = this.tmpTargetPos;

    for (let i = 0; i < targetHitboxes.length; i++) {
      const hb = targetHitboxes[i];
      const t = hb.userData.shootableTarget as ShootableTarget | undefined;
      if (!t) continue;
      hb.getWorldPosition(targetPos);
      const toTarget = this.tmpToTarget.copy(targetPos).sub(camOrigin);
      const dist = toTarget.length();
      if (dist <= def.range && dist > 0.0001) {
        toTarget.multiplyScalar(1 / dist);
        if (toTarget.dot(forward) > 0.35) {
          const killed = t.onHit(def.damage, targetPos, negForward);
          this.hitmarkerAlpha = 1.0;
          this.hitmarkerKill = this.hitmarkerKill || killed;
          this.spawnSparks(targetPos, negForward, killed ? 0xff4fa3 : 0x36f1e6, 10);
        }
      }
    }
  }

  private fireWeapon(
    def: WeaponDef,
    worldMeshes: readonly THREE.Object3D[],
    targetHitboxes: readonly THREE.Object3D[],
  ): void {
    this.ammo[this.slotIndex]--;
    this.fireCooldown = 1 / def.fireRate;
    this.recoilZ = Math.min(0.16, this.recoilZ + def.recoilKick);
    this.recoilRotX = Math.min(0.28, this.recoilRotX + def.recoilPitch);

    // Position muzzle flash at active barrel tip
    const tipLocal = this.muzzleTips[this.slotIndex];
    this.muzzleFlash.position.copy(tipLocal);
    this.muzzleFlash.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    this.muzzleFlash.scale.setScalar(0.85 + Math.random() * 0.55);
    this.muzzleFlash.visible = true;
    this.muzzleLight.intensity = 6.5;
    this.flashTimer = 0.045;

    const muzzleWorld = this.tmpMuzzleWorld.copy(tipLocal);
    this.rig.localToWorld(muzzleWorld);

    const camOrigin = this.tmpOrigin;
    this.camera.getWorldPosition(camOrigin);
    this.onShotFired?.(def.id, camOrigin);

    const spread = (this.ads ? def.spreadAds : def.spreadHip) + this.drunkLevel * 0.095;

    // Build flat raycast list in reusable scratch buffer (zero allocations!)
    const raycastables = this.raycastScratch;
    raycastables.length = 0;
    for (let i = 0; i < targetHitboxes.length; i++) raycastables.push(targetHitboxes[i]);
    for (let i = 0; i < worldMeshes.length; i++) raycastables.push(worldMeshes[i]);

    for (let p = 0; p < def.pellets; p++) {
      const dir = this.tmpDir
        .set((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2, -1)
        .normalize()
        .applyQuaternion(this.camera.quaternion);

      this.raycaster.set(camOrigin, dir);
      this.raycaster.far = def.range;

      const hits = this.raycaster.intersectObjects(raycastables, false);
      const endPoint = this.tmpEnd.copy(camOrigin).addScaledVector(dir, def.range);

      if (hits.length > 0) {
        const hit = hits[0];
        endPoint.copy(hit.point);
        const normal = hit.face ? this.tmpNormal.copy(hit.face.normal) : this.tmpNormal.set(0, 1, 0);
        if (hit.object instanceof THREE.Mesh) {
          normal.transformDirection(hit.object.matrixWorld);
        }

        if (def.id === 'launcher') {
          this.onExplosion?.(endPoint.clone(), 9.5, def.damage);
          this.hitmarkerAlpha = 1.0;
          this.hitmarkerKill = true;
          this.spawnSparks(endPoint, normal, 0xff7b33, 18);
        } else {
          const matchedTarget = hit.object.userData.shootableTarget as ShootableTarget | undefined;
          if (matchedTarget) {
            const killed = matchedTarget.onHit(def.damage, endPoint, normal);
            this.hitmarkerAlpha = 1.0;
            this.hitmarkerKill = this.hitmarkerKill || killed;
            this.spawnSparks(endPoint, normal, killed ? 0xff4fa3 : 0x36f1e6, killed ? 12 : 6);
          } else {
            this.spawnSparks(endPoint, normal, 0xffc066, 5);
            this.onWorldImpact?.(endPoint, normal);
          }
        }
      }

      this.spawnTracer(muzzleWorld, endPoint, def.tracerColor);
    }

    if (this.ammo[this.slotIndex] === 0) {
      this.startReload();
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, color: number): void {
    this.tracerPool.spawn(start, end, color, 0.065, 0.78);
  }

  private spawnSparks(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    color: number,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      let mesh = this.sparkPool.pop();
      if (mesh) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(color);
        mat.opacity = 1;
        mesh.visible = true;
      } else {
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        mesh = new THREE.Mesh(this.sparkGeo, mat);
        this.scene.add(mesh);
      }
      mesh.position.copy(origin);

      const vel = normal
        .clone()
        .multiplyScalar(2.2 + Math.random() * 3.5)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 3.2,
            Math.random() * 2.5,
            (Math.random() - 0.5) * 3.2,
          ),
        );
      this.sparks.push({ mesh, vel, life: 0.28 + Math.random() * 0.16, maxLife: 0.44 });
    }
  }

  private updateEffects(dt: number): void {
    this.tracerPool.update(dt);

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        this.sparkPool.push(s.mesh);
        const last = this.sparks.length - 1;
        if (i !== last) this.sparks[i] = this.sparks[last];
        this.sparks.pop();
      } else {
        s.vel.y -= 14 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / s.maxLife);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Procedural 3D Weapon & Hand Viewmodels
  // ---------------------------------------------------------------------------
  private buildHandModel(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: '#e2b192', roughness: 0.72 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: '#f2e8e1', roughness: 0.6 });

    // Forearm + pastel Miami blazer cuff
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.075, 0.22), cuffMat);
    sleeve.position.set(0, -0.02, 0.14);
    group.add(sleeve);

    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.06, 0.09), skinMat);
    wrist.position.set(0, -0.01, 0.01);
    group.add(wrist);

    // Open palm reaching forward
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.036, 0.1), skinMat);
    palm.position.set(0, 0.0, -0.07);
    group.add(palm);

    // 4 Fingers slightly curved for grabbing
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.075), skinMat);
      finger.position.set(-0.03 + f * 0.02, 0.004, -0.145);
      finger.rotation.x = -0.22;
      group.add(finger);
    }

    // Thumb on the inner left side
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.065), skinMat);
    thumb.position.set(-0.052, 0.0, -0.085);
    thumb.rotation.y = 0.55;
    group.add(thumb);

    group.rotation.set(0.18, 0.14, 0.12);
    return group;
  }

  private buildKatanaModel(): { group: THREE.Group; muzzleLocal: THREE.Vector3 } {
    const group = new THREE.Group();
    const gripMat = new THREE.MeshStandardMaterial({ color: '#1b1624', roughness: 0.85 });
    const guardMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.85, roughness: 0.2 });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: '#e6ffff',
      emissive: '#36f1e6',
      emissiveIntensity: 2.2,
      metalness: 0.9,
      roughness: 0.15,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 2.4,
    });

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.22, 8), gripMat);
    grip.position.set(0, -0.08, 0.04);
    grip.rotation.x = 0.25;
    group.add(grip);

    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 10), guardMat);
    tsuba.position.set(0, 0.03, 0.01);
    tsuba.rotation.x = 0.25;
    group.add(tsuba);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.62, 0.038), bladeMat);
    blade.position.set(0, 0.34, -0.07);
    blade.rotation.x = 0.25;
    group.add(blade);

    const neonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.6, 0.01), edgeMat);
    neonEdge.position.set(0, 0.34, -0.09);
    neonEdge.rotation.x = 0.25;
    group.add(neonEdge);

    group.rotation.z = 0.22;
    return { group, muzzleLocal: new THREE.Vector3(0, 0.5, -0.15) };
  }

  private buildPistolModel(): { group: THREE.Group; muzzleLocal: THREE.Vector3 } {
    const group = new THREE.Group();
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#d8dde6', roughness: 0.25, metalness: 0.88 });
    const gripMat = new THREE.MeshStandardMaterial({ color: '#221c29', roughness: 0.8 });
    const sightMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 2.5,
    });

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.068, 0.28), chromeMat);
    slide.position.set(0, 0.02, -0.02);
    group.add(slide);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.036, 0.25), gripMat);
    frame.position.set(0, -0.025, -0.01);
    group.add(frame);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.072), gripMat);
    grip.position.set(0, -0.09, 0.07);
    grip.rotation.x = 0.24;
    group.add(grip);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.012), sightMat);
    sight.position.set(0, 0.06, -0.14);
    group.add(sight);

    return { group, muzzleLocal: new THREE.Vector3(0, 0.025, -0.2) };
  }

  private buildSmgModel(): { group: THREE.Group; muzzleLocal: THREE.Vector3 } {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#2b2434', roughness: 0.45, metalness: 0.65 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 1.8,
    });
    const barrelMat = new THREE.MeshStandardMaterial({ color: '#4d4859', roughness: 0.3, metalness: 0.85 });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.11, 0.34), bodyMat);
    receiver.position.set(0, 0.01, -0.03);
    group.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 8), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.24);
    group.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.21, 0.055), bodyMat);
    mag.position.set(0, -0.13, 0.03);
    mag.rotation.x = 0.12;
    group.add(mag);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.014, 0.24), accentMat);
    strip.position.set(0, 0.04, -0.04);
    group.add(strip);

    return { group, muzzleLocal: new THREE.Vector3(0, 0.02, -0.34) };
  }

  private buildShotgunModel(): { group: THREE.Group; muzzleLocal: THREE.Vector3 } {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: '#383440', roughness: 0.35, metalness: 0.82 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8f5538', roughness: 0.72 });
    const sightMat = new THREE.MeshStandardMaterial({
      color: '#ff9f43',
      emissive: '#ff9f43',
      emissiveIntensity: 2.2,
    });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.095, 0.28), metalMat);
    receiver.position.set(0, 0, 0.02);
    group.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.026, -0.3);
    group.add(barrel);

    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), metalMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.015, -0.26);
    group.add(tube);

    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.055, 0.17), woodMat);
    pump.position.set(0, -0.02, -0.22);
    group.add(pump);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.09, 0.22), woodMat);
    stock.position.set(0, -0.045, 0.2);
    stock.rotation.x = -0.18;
    group.add(stock);

    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), sightMat);
    bead.position.set(0, 0.054, -0.5);
    group.add(bead);

    return { group, muzzleLocal: new THREE.Vector3(0, 0.026, -0.55) };
  }

  private buildLauncherModel(): { group: THREE.Group; muzzleLocal: THREE.Vector3 } {
    const group = new THREE.Group();
    const tubeMat = new THREE.MeshStandardMaterial({ color: '#262033', roughness: 0.4, metalness: 0.7 });
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 2.2,
    });
    const cyanMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 2.2,
    });

    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.68, 12), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.02, -0.18);
    group.add(tube);

    const frontRing = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.01, 8, 16), ringMat);
    frontRing.position.set(0, 0.02, -0.51);
    group.add(frontRing);

    const sightBox = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.08), cyanMat);
    sightBox.position.set(-0.075, 0.055, -0.22);
    group.add(sightBox);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.065), tubeMat);
    grip.position.set(0, -0.09, -0.05);
    group.add(grip);

    return { group, muzzleLocal: new THREE.Vector3(0, 0.02, -0.55) };
  }
}
