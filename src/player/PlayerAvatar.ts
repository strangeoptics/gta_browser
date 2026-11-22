import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getPlayerGlbOutfitTexture, type PlayerGlbOutfitStyle } from '../entities/CharacterTextures';

interface PlayerOutfitDef {
  name: string;
  style: PlayerGlbOutfitStyle;
  primary: string;
  accent: string;
  pants: string;
  shoes: string;
  variant: number;
  role: 'civilian' | 'police';
  policeCap: boolean;
  goldChain: boolean;
}

const PLAYER_OUTFITS: PlayerOutfitDef[] = [
  {
    name: 'MIAMI WHITE SUIT',
    style: 'white-suit',
    primary: '#f2e8e1',
    accent: '#36f1e6',
    pants: '#272c42',
    shoes: '#f5f2ee',
    variant: 2,
    role: 'civilian',
    policeCap: false,
    goldChain: false,
  },
  {
    name: 'HAWAIIAN TOURIST',
    style: 'hawaiian',
    primary: '#ff7b7b',
    accent: '#36f1e6',
    pants: '#f0e2ce',
    shoes: '#ffffff',
    variant: 1,
    role: 'civilian',
    policeCap: false,
    goldChain: false,
  },
  {
    name: 'MIDNIGHT NEON',
    style: 'midnight-neon',
    primary: '#1e172b',
    accent: '#ff4fa3',
    pants: '#171522',
    shoes: '#ff4fa3',
    variant: 2,
    role: 'civilian',
    policeCap: false,
    goldChain: true,
  },
  {
    name: 'VICE DETECTIVE',
    style: 'detective',
    primary: '#9fe6d8',
    accent: '#ffd15c',
    pants: '#f4eee8',
    shoes: '#2c2520',
    variant: 2,
    role: 'civilian',
    policeCap: false,
    goldChain: true,
  },
  {
    name: 'VICE PD UNIFORM',
    style: 'police',
    primary: '#1e325c',
    accent: '#ffd15c',
    pants: '#141d33',
    shoes: '#141418',
    variant: 0,
    role: 'police',
    policeCap: true,
    goldChain: false,
  },
];

type AnimKey = 'idle' | 'walk' | 'run' | 'jump' | 'runJump' | 'slash';

/**
 * Generates seamless per-triangle UVs on the Quaternius Shirt SkinnedMesh so our
 * 256x256 procedural 80s Miami outfit textures (front, back & sleeves) map crisply!
 */
function assignShirtOutfitUVs(mesh: THREE.Mesh): void {
  const nonIndexed = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = nonIndexed.getAttribute('position');
  if (!pos) return;

  const uvs = new Float32Array(pos.count * 2);
  // Raw Blender bind-pose bounds for Quaternius Shirt:
  // X: -0.0086..0.0086 (torso core: -0.0041..+0.0041), Y: -0.0035 (front)..+0.0040 (back), Z: 0.0248..0.0405 (up)
  const torsoHalfX = 0.0041;
  const zMin = 0.0248;
  const zSpan = 0.0405 - zMin;

  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;

    const isSleeve = Math.abs(cx) > torsoHalfX;
    const isFront = cy <= 0.0002;

    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      const vNorm = THREE.MathUtils.clamp((z - zMin) / zSpan, 0, 1);

      let u: number;
      let v: number;
      if (isSleeve) {
        // Bottom half of 256x256 atlas: sleeves (u: 0..1, v: 0..0.48)
        const sleeveFrac = THREE.MathUtils.clamp((Math.abs(x) - torsoHalfX) / 0.0046, 0, 1);
        u = THREE.MathUtils.clamp((y + 0.0035) / 0.0075, 0.02, 0.98);
        v = 0.46 - sleeveFrac * 0.44;
      } else if (isFront) {
        // Top-Left quadrant: Front torso (u: 0.02..0.48, v: 0.52..0.98)
        const xNorm = THREE.MathUtils.clamp((x + torsoHalfX) / (torsoHalfX * 2), 0, 1);
        u = 0.02 + xNorm * 0.46;
        v = 0.52 + vNorm * 0.46;
      } else {
        // Top-Right quadrant: Back torso (u: 0.52..0.98, v: 0.52..0.98)
        const xNorm = THREE.MathUtils.clamp((torsoHalfX - x) / (torsoHalfX * 2), 0, 1);
        u = 0.52 + xNorm * 0.46;
        v = 0.52 + vNorm * 0.46;
      }

      uvs[vi * 2] = u;
      uvs[vi * 2 + 1] = v;
    }
  }

  nonIndexed.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  mesh.geometry = nonIndexed;
}

/**
 * Helper: attaches a world-scale accessory Group to a bone at an exact model-space position
 * while preserving upright (+Y up, +Z forward) alignment regardless of Blender bone roll.
 */
function attachAccessoryToBone(
  bone: THREE.Object3D,
  modelRoot: THREE.Object3D,
  worldPos: THREE.Vector3,
  uniformScale: number,
  accessory: THREE.Object3D,
): void {
  modelRoot.updateMatrixWorld(true);

  const localPos = worldPos.clone();
  bone.worldToLocal(localPos);

  const boneWorldQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(boneWorldQuat);

  const wrapper = new THREE.Group();
  wrapper.position.copy(localPos);
  wrapper.quaternion.copy(boneWorldQuat).invert();
  wrapper.scale.setScalar(1 / (100 * uniformScale));
  wrapper.add(accessory);
  bone.add(wrapper);
}

/**
 * Stylized 3D Low-Poly protagonist avatar powered by the rigged Quaternius Man GLB
 * (`public/models/player_man.glb`) with AnimationMixer crossfades, procedural UV-mapped
 * 80s Miami outfits (suits, Hawaiian print, Midnight Neon, Vice PD uniform + cap),
 * 3D 80s sunglasses, gold chain, Safehouse mirror Layer-1 support, and hand-bone weapons.
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

  private policeCapGroup: THREE.Group | null = null;
  private goldChainGroup: THREE.Group | null = null;
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

        // Configure shadows, frustum culling, procedural Shirt UVs & collect named materials
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
              mat.roughness = Math.max(mat.roughness, 0.58);
              mat.needsUpdate = true;
              if (mat.name === 'Shirt') {
                this.shirtMat = mat;
                assignShirtOutfitUVs(obj);
              } else if (mat.name === 'Pants') {
                this.pantsMat = mat;
              } else if (mat.name === 'Socks') {
                this.socksMat = mat;
              }
            }
          }
        });

        this.bodyRoot.add(model);

        // Attach bone-mounted 80s accessories (Sunglasses, Vice PD Cap, Gold Chain)
        const headBone = model.getObjectByName('Head');
        if (headBone) {
          // 1. Iconic 80s Sunset Wayfarer Sunglasses
          const shades = new THREE.Group();
          const frameMat = new THREE.MeshStandardMaterial({ color: '#14101c', roughness: 0.3, flatShading: true });
          const lensMat = new THREE.MeshStandardMaterial({
            color: '#20183a',
            emissive: '#2998b8',
            emissiveIntensity: 0.34,
            metalness: 0.85,
            roughness: 0.12,
            flatShading: true,
          });
          const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.014, 0.014), frameMat);
          bridge.position.set(0, 0.005, 0.004);
          shades.add(bridge);
          for (const side of [-1, 1] as const) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.044, 0.016), frameMat);
            frame.position.set(side * 0.048, 0, 0);
            frame.rotation.y = side * -0.14;
            shades.add(frame);

            const lens = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.033, 0.018), lensMat);
            lens.position.set(side * 0.048, 0, 0.002);
            lens.rotation.y = side * -0.14;
            shades.add(lens);

            const temple = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.12), frameMat);
            temple.position.set(side * 0.092, 0.008, -0.06);
            shades.add(temple);
          }
          attachAccessoryToBone(headBone, model, new THREE.Vector3(0, 1.655, 0.118), uniformScale, shades);

          // 2. 3D Vice PD Peaked Officer Cap (shown when wearing VICE PD UNIFORM)
          const cap = new THREE.Group();
          const capDark = new THREE.MeshStandardMaterial({ color: '#142447', roughness: 0.55, flatShading: true });
          const capBrim = new THREE.MeshStandardMaterial({ color: '#0d1018', roughness: 0.28, flatShading: true });
          const goldMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.85, roughness: 0.22, flatShading: true });

          const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.09, 8), capDark);
          crown.position.set(0, 0.045, 0);
          cap.add(crown);

          const band = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.026, 8), capBrim);
          band.position.set(0, 0.01, 0);
          cap.add(band);

          const brim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.118, 0.128, 0.016, 8, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
            capBrim,
          );
          brim.position.set(0, 0.003, 0.052);
          brim.rotation.x = 0.16;
          cap.add(brim);

          const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), goldMat);
          emblem.scale.set(1, 1.1, 0.4);
          emblem.position.set(0, 0.042, 0.128);
          cap.add(emblem);

          cap.visible = false;
          this.policeCapGroup = cap;
          attachAccessoryToBone(headBone, model, new THREE.Vector3(0, 1.755, -0.008), uniformScale, cap);
        }

        // 3. 3D 80s Gold Chain on Torso (shown on Midnight Neon & Vice Detective)
        const torsoBone = model.getObjectByName('Torso');
        if (torsoBone) {
          const chainGroup = new THREE.Group();
          const goldMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.88, roughness: 0.2, flatShading: true });
          const chain = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.01, 5, 12, Math.PI), goldMat);
          chain.rotation.z = Math.PI;
          chainGroup.add(chain);
          chainGroup.visible = false;
          this.goldChainGroup = chainGroup;
          attachAccessoryToBone(torsoBone, model, new THREE.Vector3(0, 1.44, 0.125), uniformScale, chainGroup);
        }

        // Locate right arm & hand bones for weapon attachments
        const invBoneScale = 1 / (100 * uniformScale);
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
        this.applyOutfitAppearance();
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

  private applyOutfitAppearance(): void {
    const o = PLAYER_OUTFITS[this.outfitIndex];
    if (this.shirtMat) {
      this.shirtMat.color.set('#ffffff');
      this.shirtMat.map = getPlayerGlbOutfitTexture(o.style, o.primary, o.accent);
      this.shirtMat.needsUpdate = true;
    }
    if (this.pantsMat) {
      this.pantsMat.color.set(o.pants);
    }
    if (this.socksMat) {
      this.socksMat.color.set(o.shoes);
    }
    if (this.policeCapGroup) {
      this.policeCapGroup.visible = o.policeCap;
    }
    if (this.goldChainGroup) {
      this.goldChainGroup.visible = o.goldChain;
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
    this.applyOutfitAppearance();
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
