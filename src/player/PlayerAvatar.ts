import * as THREE from 'three';
import { getPlayerGlbOutfitTexture, type PlayerGlbOutfitStyle } from '../entities/CharacterTextures';
import {
  createGoldChainMesh,
  createPoliceCapMesh,
  createSunglassesMesh,
  instantiateGlbCharacter,
  whenGlbCharacterReady,
  type GlbCharacterInstance,
} from '../entities/GlbCharacterFactory';

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

/**
 * Stylized 3D Low-Poly protagonist avatar powered by the shared rigged Quaternius Man GLB
 * (`GlbCharacterFactory`) with AnimationMixer crossfades, procedural UV-mapped 80s Miami
 * outfits, 3D accessories (sunglasses, Vice PD cap, gold chain), Safehouse mirror Layer-1
 * support, and hand-bone weapons.
 */
export class PlayerAvatar {
  public readonly group = new THREE.Group();
  private readonly bodyRoot = new THREE.Group();

  private glb: GlbCharacterInstance | null = null;
  private policeCapGroup: THREE.Group | null = null;
  private goldChainGroup: THREE.Group | null = null;
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

    whenGlbCharacterReady((tpl) => {
      const inst = instantiateGlbCharacter(tpl, 'average');
      this.glb = inst;
      this.bodyRoot.add(inst.model);

      // Attach bone-mounted 80s accessories
      if (inst.headBone) {
        inst.attachToBone(inst.headBone, new THREE.Vector3(0, 1.655, 0.118), createSunglassesMesh());

        const cap = createPoliceCapMesh();
        cap.visible = false;
        this.policeCapGroup = cap;
        inst.attachToBone(inst.headBone, new THREE.Vector3(0, 1.755, -0.008), cap);
      }

      if (inst.torsoBone) {
        const chain = createGoldChainMesh();
        chain.visible = false;
        this.goldChainGroup = chain;
        inst.attachToBone(inst.torsoBone, new THREE.Vector3(0, 1.44, 0.125), chain);
      }

      // Attach weapons to right hand bone
      if (inst.rightHandBone) {
        const weaponAnchor = new THREE.Group();
        const invBoneScale = 1 / (100 * inst.uniformScale);
        weaponAnchor.scale.setScalar(invBoneScale);
        weaponAnchor.position.set(0, 0.0012, 0);
        inst.rightHandBone.add(weaponAnchor);

        this.gunMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.085, 0.34),
          new THREE.MeshStandardMaterial({ color: '#2b2636', metalness: 0.8, roughness: 0.28, flatShading: true }),
        );
        this.gunMesh.position.set(0, 0.04, 0.14);
        weaponAnchor.add(this.gunMesh);

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

      inst.playAnim('idle', 0);
      this.applyOutfitAppearance();
      this.applyLayerState();
    });
  }

  private applyOutfitAppearance(): void {
    const o = PLAYER_OUTFITS[this.outfitIndex];
    if (this.glb) {
      if (this.glb.materials.shirt) {
        this.glb.materials.shirt.color.set('#ffffff');
        this.glb.materials.shirt.map = getPlayerGlbOutfitTexture(o.style, o.primary, o.accent);
        this.glb.materials.shirt.needsUpdate = true;
      }
      if (this.glb.materials.pants) {
        this.glb.materials.pants.color.set(o.pants);
      }
      if (this.glb.materials.socks) {
        this.glb.materials.socks.color.set(o.shoes);
      }
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

    if (coverState?.inCover && !coverState.peeking) {
      const targetRot = Math.atan2(coverState.normalX, coverState.normalZ);
      let diff = targetRot - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * (1 - Math.exp(-14 * clampedDt));
    } else {
      this.group.rotation.y = yaw + Math.PI;
    }

    if (this.gunMesh) this.gunMesh.visible = !isKatana && !swimming;
    if (this.katanaMesh) this.katanaMesh.visible = isKatana && !swimming;

    const targetScaleY = crouching && !swimming ? 0.75 : 1.0;
    this.bodyRoot.scale.y += (targetScaleY - this.bodyRoot.scale.y) * (1 - Math.exp(-12 * clampedDt));

    if (!this.glb) return;

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

      this.glb.playAnim(moving ? 'run' : 'idle', 0.2);
      const cur = this.glb.getCurrentAnim();
      const active = cur ? this.glb.actions.get(cur) : undefined;
      if (active) active.setEffectiveTimeScale(moving ? 1.25 : 0.75);
      this.glb.mixer.update(clampedDt);
      return;
    }

    this.bodyRoot.rotation.x += (0 - this.bodyRoot.rotation.x) * blend;
    this.bodyRoot.rotation.z += (0 - this.bodyRoot.rotation.z) * blend;
    this.bodyRoot.position.y += (0 - this.bodyRoot.position.y) * blend;

    if (!grounded) {
      this.glb.playAnim(speed > 3.0 ? 'runJump' : 'jump', 0.12);
    } else if (speed > 6.2) {
      this.glb.playAnim('run', 0.15);
      const runAct = this.glb.actions.get('run');
      if (runAct) runAct.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 7.2, 0.85, 1.5));
    } else if (speed > 0.45) {
      this.glb.playAnim('walk', 0.16);
      const walkAct = this.glb.actions.get('walk');
      if (walkAct) walkAct.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4.2, 0.7, 1.45));
    } else {
      this.glb.playAnim('idle', 0.18);
      const idleAct = this.glb.actions.get('idle');
      if (idleAct) idleAct.setEffectiveTimeScale(1.0);
    }

    this.glb.mixer.update(clampedDt);

    const targetAim = aiming && !isKatana ? 1 : 0;
    this.aimBlend += (targetAim - this.aimBlend) * blend;
    if (this.aimBlend > 0.01 && this.glb.upperArmR) {
      this.glb.upperArmR.rotation.x -= 0.85 * this.aimBlend;
      if (this.glb.lowerArmR) {
        this.glb.lowerArmR.rotation.x -= 0.25 * this.aimBlend;
      }
    }
  }
}
