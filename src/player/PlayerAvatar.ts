import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PLAYER_OUTFITS = [
  { name: 'MIAMI WHITE SUIT', primary: '#f2e8e1', accent: '#36f1e6', pants: '#272c42', shoes: '#f5f2ee', variant: 2, role: 'civilian' as const },
  { name: 'HAWAIIAN TOURIST', primary: '#ff7b7b', accent: '#36f1e6', pants: '#f0e2ce', shoes: '#ffffff', variant: 1, role: 'civilian' as const },
  { name: 'MIDNIGHT NEON', primary: '#1e172b', accent: '#ff4fa3', pants: '#171522', shoes: '#ff4fa3', variant: 2, role: 'civilian' as const },
  { name: 'VICE DETECTIVE', primary: '#9fe6d8', accent: '#ffd15c', pants: '#f4eee8', shoes: '#2c2520', variant: 2, role: 'civilian' as const },
  { name: 'VICE PD UNIFORM', primary: '#1e325c', accent: '#ffd15c', pants: '#141d33', shoes: '#141418', variant: 0, role: 'police' as const },
];

type AnimKey = 'idle' | 'walk' | 'run' | 'jump' | 'runJump' | 'slash';

/**
 * Stylized 3D Low-Poly protagonist avatar powered by the rigged Quaternius Man GLB
 * (`public/models/player_man.glb`) with AnimationMixer crossfades, live Safehouse
 * outfit recoloring, Safehouse mirror Layer-1 support, and hand-bone weapon attachments.
 */
export class PlayerAvatar {
  public readonly group = new THREE.Group();
  private readonly bodyRoot = new THREE.Group();

  private mixer: THREE.AnimationMixer | null = null;
  private readonly actions = new Map<AnimKey, THREE.AnimationAction>();
  private currentAnim: AnimKey | null = null;

  private shirtMat: THREE.MeshStandardMaterial | null = null;
  private pantsMat: THREE.MeshStandardMaterial | null = null;
  private socksMat: THREE.MeshStandardMaterial | null = null;

  private upperArmR: THREE.Object3D | null = null;
  private lowerArmR: THREE.Object3D | null = null;
  private gunMesh: THREE.Mesh | null = null;
  private katanaMesh: THREE.Mesh | null = null;

  private outfitIndex = 0;
  private swimPhase = 0;
  private mirrorOnlyMode = false;
  private aimBlend = 0;

  constructor(scene: THREE.Scene) {
    this.group.add(this.bodyRoot);
    this.group.visible = false;
    scene.add(this.group);

    this.loadModel();
  }

  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      './models/player_man.glb',
      (gltf) => {
        const model = gltf.scene;

        // Normalize height to 1.82m and ground feet cleanly at y = 0
        model.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(model);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        const targetHeight = 1.82;
        const uniformScale = rawSize.y > 0.01 ? targetHeight / rawSize.y : 0.376;
        model.scale.setScalar(uniformScale);

        model.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y = -scaledBox.min.y;

        // Configure shadows, frustum culling (important for SkinnedMesh + mirror) & collect named materials
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            if (obj instanceof THREE.SkinnedMesh) {
              obj.frustumCulled = false;
            }
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const mat of mats) {
              if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
              mat.flatShading = true;
              mat.roughness = Math.max(mat.roughness, 0.55);
              mat.needsUpdate = true;
              if (mat.name === 'Shirt') this.shirtMat = mat;
              else if (mat.name === 'Pants') this.pantsMat = mat;
              else if (mat.name === 'Socks') this.socksMat = mat;
            }
          }
        });

        this.bodyRoot.add(model);

        // Locate key bones for weapon & 80s shades attachments
        // Note: HumanArmature inside this GLB has scale 100, so bone-attached meshes use invScale
        const boneWorldScale = 100 * uniformScale;
        const invBoneScale = 1 / boneWorldScale;

        this.upperArmR = model.getObjectByName('UpperArm.R') ?? null;
        this.lowerArmR = model.getObjectByName('LowerArm.R') ?? null;

        const rightHandBone =
          model.getObjectByName('MiddleHand.R') ??
          model.getObjectByName('Palm.R') ??
          model.getObjectByName('LowerArm.R');

        if (rightHandBone) {
          const weaponAnchor = new THREE.Group();
          weaponAnchor.scale.setScalar(invBoneScale);
          weaponAnchor.position.set(0, 0.0012, 0);
          rightHandBone.add(weaponAnchor);

          // Held firearm
          this.gunMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.085, 0.34),
            new THREE.MeshStandardMaterial({ color: '#2b2636', metalness: 0.8, roughness: 0.28, flatShading: true }),
          );
          this.gunMesh.position.set(0, 0.04, 0.14);
          weaponAnchor.add(this.gunMesh);

          // Held Neon Katana (shown for weapon slot 0)
          this.katanaMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, 0.85, 0.05),
            new THREE.MeshStandardMaterial({
              color: '#e6ffff',
              emissive: '#36f1e6',
              emissiveIntensity: 2.2,
            }),
          );
          this.katanaMesh.position.set(0, 0.42, 0.03);
          this.katanaMesh.visible = false;
          weaponAnchor.add(this.katanaMesh);
        }

        // Setup AnimationMixer & map built-in Quaternius clips
        this.mixer = new THREE.AnimationMixer(model);
        const clipLookup: Record<AnimKey, string> = {
          idle: 'HumanArmature|Man_Idle',
          walk: 'HumanArmature|Man_Walk',
          run: 'HumanArmature|Man_Run',
          jump: 'HumanArmature|Man_Jump',
          runJump: 'HumanArmature|Man_RunningJump',
          slash: 'HumanArmature|Man_SwordSlash',
        };

        for (const [key, clipName] of Object.entries(clipLookup) as [AnimKey, string][]) {
          const clip = gltf.animations.find((c) => c.name === clipName);
          if (!clip) continue;
          const action = this.mixer.clipAction(clip);
          if (key === 'jump' || key === 'runJump') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          this.actions.set(key, action);
        }

        // Start in Idle
        this.playAnim('idle', 0);

        // Apply currently selected Safehouse outfit & mirror layer state
        this.applyOutfitColors();
        this.applyLayerState();
      },
      undefined,
      (err) => {
        console.warn('[PlayerAvatar] Failed to load ./models/player_man.glb:', err);
      },
    );
  }

  private playAnim(key: AnimKey, fadeDuration = 0.16): void {
    if (this.currentAnim === key) return;
    const next = this.actions.get(key);
    if (!next) return;

    const prev = this.currentAnim ? this.actions.get(this.currentAnim) : undefined;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fadeDuration > 0) {
      prev.crossFadeTo(next, fadeDuration, false);
    } else if (prev) {
      prev.stop();
    }
    this.currentAnim = key;
  }

  private applyOutfitColors(): void {
    const o = PLAYER_OUTFITS[this.outfitIndex];
    if (this.shirtMat) {
      this.shirtMat.color.set(o.primary);
    }
    if (this.pantsMat) {
      this.pantsMat.color.set(o.pants);
    }
    if (this.socksMat) {
      this.socksMat.color.set(o.shoes);
    }
  }

  private applyLayerState(): void {
    const targetLayer = this.mirrorOnlyMode ? 1 : 0;
    this.group.traverse((obj) => {
      obj.layers.set(targetLayer);
    });
  }

  public setOutfit(index: number): string {
    this.outfitIndex = ((index % PLAYER_OUTFITS.length) + PLAYER_OUTFITS.length) % PLAYER_OUTFITS.length;
    this.applyOutfitColors();
    return PLAYER_OUTFITS[this.outfitIndex].name;
  }

  public nextOutfit(): string {
    return this.setOutfit(this.outfitIndex + 1);
  }

  public getOutfitIndex(): number {
    return this.outfitIndex;
  }

  public getCurrentOutfit(): {
    primary: string;
    accent: string;
    pants: string;
    variant: number;
    role: 'civilian' | 'police';
  } {
    const o = PLAYER_OUTFITS[this.outfitIndex];
    return {
      primary: o.primary,
      accent: o.accent,
      pants: o.pants,
      variant: o.variant,
      role: o.role,
    };
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /**
   * Moves avatar meshes to Layer 1 so the 1st-person main camera hides them while
   * the Safehouse dressing mirror Reflector (which enables Layer 1) still renders you live!
   */
  public setMirrorOnlyMode(mirrorOnly: boolean): void {
    if (this.mirrorOnlyMode === mirrorOnly) return;
    this.mirrorOnlyMode = mirrorOnly;
    this.applyLayerState();
  }

  public update(
    dt: number,
    position: THREE.Vector3,
    yaw: number,
    speed: number,
    grounded: boolean,
    crouching: boolean,
    aiming: boolean,
    isKatana: boolean,
    swimming = false,
    coverState?: { inCover: boolean; peeking: boolean; normalX: number; normalZ: number },
  ): void {
    if (!this.group.visible) return;
    const clampedDt = Math.min(dt, 0.05);
    const blend = 1 - Math.exp(-10 * clampedDt);

    this.group.position.copy(position);

    // In cover (not peeking), press back flat against the cover wall (face along outward normal)!
    if (coverState?.inCover && !coverState.peeking) {
      const targetRot = Math.atan2(coverState.normalX, coverState.normalZ);
      let diff = targetRot - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * (1 - Math.exp(-14 * clampedDt));
    } else {
      // Player camera looks along (-sin(yaw), -cos(yaw)); avatar faces +Z locally -> yaw + PI
      this.group.rotation.y = yaw + Math.PI;
    }

    if (this.gunMesh) this.gunMesh.visible = !isKatana && !swimming;
    if (this.katanaMesh) this.katanaMesh.visible = isKatana && !swimming;

    // Crouch squash (upright while swimming)
    const targetScaleY = crouching && !swimming ? 0.75 : 1.0;
    this.bodyRoot.scale.y += (targetScaleY - this.bodyRoot.scale.y) * (1 - Math.exp(-12 * clampedDt));

    if (swimming) {
      const moving = speed > 0.55;
      const strokeRate = moving ? (speed > 5.2 ? 7.8 : 5.6) : 2.6;
      this.swimPhase += clampedDt * strokeRate;

      const targetPitch = moving ? 1.28 : 0.14;
      const targetRoll = moving ? Math.sin(this.swimPhase) * 0.2 : 0;
      const targetLiftY = (moving ? 0.94 : 0.04) + Math.sin(this.swimPhase * (moving ? 1.0 : 1.5)) * 0.055;
      this.bodyRoot.rotation.x += (targetPitch - this.bodyRoot.rotation.x) * blend;
      this.bodyRoot.rotation.z += (targetRoll - this.bodyRoot.rotation.z) * blend;
      this.bodyRoot.position.y += (targetLiftY - this.bodyRoot.position.y) * blend;

      this.playAnim(moving ? 'run' : 'idle', 0.2);
      if (this.mixer) {
        const active = this.currentAnim ? this.actions.get(this.currentAnim) : undefined;
        if (active) active.setEffectiveTimeScale(moving ? 1.25 : 0.75);
        this.mixer.update(clampedDt);
      }
      return;
    }

    // Smoothly reset swim posture back to standing
    this.bodyRoot.rotation.x += (0 - this.bodyRoot.rotation.x) * blend;
    this.bodyRoot.rotation.z += (0 - this.bodyRoot.rotation.z) * blend;
    this.bodyRoot.position.y += (0 - this.bodyRoot.position.y) * blend;

    // Select skeletal animation clip based on movement state
    if (!grounded) {
      this.playAnim(speed > 3.0 ? 'runJump' : 'jump', 0.12);
    } else if (speed > 6.2) {
      this.playAnim('run', 0.15);
      const runAct = this.actions.get('run');
      if (runAct) runAct.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 7.2, 0.85, 1.5));
    } else if (speed > 0.45) {
      this.playAnim('walk', 0.16);
      const walkAct = this.actions.get('walk');
      if (walkAct) walkAct.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4.2, 0.7, 1.45));
    } else {
      this.playAnim('idle', 0.18);
      const idleAct = this.actions.get('idle');
      if (idleAct) idleAct.setEffectiveTimeScale(1.0);
    }

    if (this.mixer) {
      this.mixer.update(clampedDt);
    }

    // Subtle procedural upper-arm raise while aiming a firearm (applied post-mixer)
    const targetAim = aiming && !isKatana ? 1 : 0;
    this.aimBlend += (targetAim - this.aimBlend) * blend;
    if (this.aimBlend > 0.01 && this.upperArmR) {
      this.upperArmR.rotation.x -= 0.85 * this.aimBlend;
      if (this.lowerArmR) {
        this.lowerArmR.rotation.x -= 0.25 * this.aimBlend;
      }
    }
  }
}
