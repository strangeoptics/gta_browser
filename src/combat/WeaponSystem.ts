import * as THREE from 'three';

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

interface TracerEffect {
  line: THREE.Line;
  life: number;
  maxLife: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const WEAPONS: WeaponDef[] = [
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
  private readonly muzzleTips: THREE.Vector3[] = [];
  private readonly muzzleFlash: THREE.Mesh;
  private readonly muzzleLight: THREE.PointLight;

  private slotIndex = 0;
  private ammo: number[] = WEAPONS.map((w) => w.magSize);
  private fireCooldown = 0;
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
  private flashTimer = 0;
  private hitmarkerAlpha = 0;
  private hitmarkerKill = false;
  private baseFov = 75;

  // Effects pools
  private readonly tracers: TracerEffect[] = [];
  private readonly sparks: SparkParticle[] = [];
  private readonly sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  private readonly raycaster = new THREE.Raycaster();

  // Optional callbacks for audio, wanted & explosion hooks
  public onShotFired?: (weaponId: string, origin: THREE.Vector3) => void;
  public onExplosion?: (origin: THREE.Vector3, radius: number, damage: number) => void;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.baseFov = camera.fov;

    this.camera.add(this.rig);
    this.scene.add(this.camera);

    // Build procedural 3D weapon viewmodels
    const pistol = this.buildPistolModel();
    const smg = this.buildSmgModel();
    const shotgun = this.buildShotgunModel();
    const launcher = this.buildLauncherModel();

    this.weaponModels.push(pistol.group, smg.group, shotgun.group, launcher.group);
    this.muzzleTips.push(pistol.muzzleLocal, smg.muzzleLocal, shotgun.muzzleLocal, launcher.muzzleLocal);
    this.weaponModels.forEach((m, i) => {
      m.visible = i === this.slotIndex;
      this.rig.add(m);
    });

    // Muzzle flash sprite-like star mesh + point light
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.95,
    });
    this.muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), flashMat);
    this.muzzleFlash.visible = false;
    this.rig.add(this.muzzleFlash);

    this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 10, 2);
    this.rig.add(this.muzzleLight);

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

  public unlockLauncher(): void {
    this.launcherUnlocked = true;
    this.ammo[3] = WEAPONS[3].magSize;
    this.switchWeapon(3);
  }

  public isLauncherUnlocked(): boolean {
    return this.launcherUnlocked;
  }

  public refillAllAmmo(): void {
    WEAPONS.forEach((w, i) => {
      this.ammo[i] = w.magSize;
    });
  }

  private bindInputs(): void {
    window.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) {
        this.triggerDown = true;
        this.semiConsumed = false;
      } else if (e.button === 2) {
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
      if (e.code === 'Digit1') this.switchWeapon(0);
      else if (e.code === 'Digit2') this.switchWeapon(1);
      else if (e.code === 'Digit3') this.switchWeapon(2);
      else if (e.code === 'Digit4' && this.launcherUnlocked) this.switchWeapon(3);
      else if (e.code === 'KeyR') this.startReload();
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        const count = this.launcherUnlocked ? WEAPONS.length : 3;
        const dir = e.deltaY > 0 ? 1 : -1;
        const next = (this.slotIndex + dir + count) % count;
        this.switchWeapon(next);
      },
      { passive: true },
    );
  }

  public switchWeapon(index: number): void {
    if (index === this.slotIndex || index < 0 || index >= WEAPONS.length) return;
    if (index === 3 && !this.launcherUnlocked) return;
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
    worldMeshes: THREE.Object3D[],
    targets: ShootableTarget[],
  ): WeaponHudState {
    const clampedDt = Math.min(dt, 0.05);
    const def = WEAPONS[this.slotIndex];

    this.fireCooldown = Math.max(0, this.fireCooldown - clampedDt);
    this.hitmarkerAlpha = Math.max(0, this.hitmarkerAlpha - clampedDt * 4.5);

    // Reload timer
    if (this.reloading) {
      this.reloadTimer -= clampedDt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo[this.slotIndex] = def.magSize;
      }
    }

    // Firing logic
    if (this.enabled && isActive && this.triggerDown && !this.reloading && this.fireCooldown <= 0) {
      if (def.auto || !this.semiConsumed) {
        if (this.ammo[this.slotIndex] > 0) {
          this.fireWeapon(def, worldMeshes, targets);
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
    const targetFov = this.enabled && isActive && this.ads ? this.baseFov - 14 : this.baseFov;
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

    this.rig.position.x += this.swayX + bobX;
    this.rig.position.y += this.swayY + bobY - reloadDip;
    this.rig.position.z += this.recoilZ;
    this.rig.rotation.x = this.recoilRotX - reloadDip * 2.2;
    this.rig.rotation.z = this.reloading ? -reloadDip * 2.6 : -this.swayX * 2.2;

    // Update tracers & sparks
    this.updateEffects(clampedDt);

    const spreadRad = (this.ads ? def.spreadAds : def.spreadHip) + this.recoilRotX * 0.18;
    const spreadPx = Math.round(10 + spreadRad * 420 + (playerSpeed > 1 ? 4 : 0));

    return {
      slotIndex: this.slotIndex,
      name: def.name,
      ammo: this.ammo[this.slotIndex],
      magSize: def.magSize,
      reloading: this.reloading,
      reloadProgress: this.reloading ? 1 - this.reloadTimer / def.reloadTime : 0,
      ads: this.ads,
      spreadPx,
      hitmarkerAlpha: this.hitmarkerAlpha,
      hitmarkerKill: this.hitmarkerKill,
    };
  }

  private fireWeapon(
    def: WeaponDef,
    worldMeshes: THREE.Object3D[],
    targets: ShootableTarget[],
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
    this.muzzleLight.position.copy(tipLocal);
    this.muzzleLight.intensity = 6.5;
    this.flashTimer = 0.045;

    const muzzleWorld = tipLocal.clone();
    this.rig.localToWorld(muzzleWorld);

    const camOrigin = new THREE.Vector3();
    this.camera.getWorldPosition(camOrigin);
    this.onShotFired?.(def.id, camOrigin);

    const spread = this.ads ? def.spreadAds : def.spreadHip;

    // Build combined raycast list + map mesh -> ShootableTarget
    const targetMap = new Map<THREE.Object3D, ShootableTarget>();
    const targetRoots: THREE.Object3D[] = [];
    for (const t of targets) {
      targetRoots.push(t.mesh);
      t.mesh.traverse((child) => {
        targetMap.set(child, t);
      });
    }
    const raycastables = [...targetRoots, ...worldMeshes];

    for (let p = 0; p < def.pellets; p++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
        -1,
      )
        .normalize()
        .applyQuaternion(this.camera.quaternion);

      this.raycaster.set(camOrigin, dir);
      this.raycaster.far = def.range;

      const hits = this.raycaster.intersectObjects(raycastables, true);
      let endPoint = camOrigin.clone().addScaledVector(dir, def.range);

      if (hits.length > 0) {
        const hit = hits[0];
        endPoint = hit.point.clone();
        const normal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        if (hit.object instanceof THREE.Mesh) {
          normal.transformDirection(hit.object.matrixWorld);
        }

        if (def.id === 'launcher') {
          this.onExplosion?.(endPoint, 9.5, def.damage);
          this.hitmarkerAlpha = 1.0;
          this.hitmarkerKill = true;
          this.spawnSparks(endPoint, normal, 0xff7b33, 18);
        } else {
          const matchedTarget = targetMap.get(hit.object);
          if (matchedTarget) {
            const killed = matchedTarget.onHit(def.damage, endPoint, normal);
            this.hitmarkerAlpha = 1.0;
            this.hitmarkerKill = this.hitmarkerKill || killed;
            this.spawnSparks(endPoint, normal, killed ? 0xff4fa3 : 0x36f1e6, killed ? 12 : 6);
          } else {
            this.spawnSparks(endPoint, normal, 0xffc066, 5);
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
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.78,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.065, maxLife: 0.065 });
  }

  private spawnSparks(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    color: number,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(origin);
      this.scene.add(mesh);

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
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      } else {
        (t.line.material as THREE.LineBasicMaterial).opacity = (t.life / t.maxLife) * 0.75;
      }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      } else {
        s.vel.y -= 14 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / s.maxLife);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Procedural 3D Weapon Viewmodels
  // ---------------------------------------------------------------------------
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
