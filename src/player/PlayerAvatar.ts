import * as THREE from 'three';
import { buildLowPolyCharacter } from '../entities/CharacterBuilder';
import { getOutfitBackTexture, getOutfitTexture } from '../entities/CharacterTextures';

const PLAYER_OUTFITS = [
  { name: 'MIAMI WHITE SUIT', primary: '#f2e8e1', accent: '#36f1e6', pants: '#272c42', variant: 2, role: 'civilian' as const },
  { name: 'HAWAIIAN TOURIST', primary: '#ff7b7b', accent: '#36f1e6', pants: '#f0e2ce', variant: 1, role: 'civilian' as const },
  { name: 'MIDNIGHT NEON', primary: '#1e172b', accent: '#ff4fa3', pants: '#171522', variant: 2, role: 'civilian' as const },
  { name: 'VICE DETECTIVE', primary: '#9fe6d8', accent: '#ffd15c', pants: '#f4eee8', variant: 2, role: 'civilian' as const },
  { name: 'VICE PD UNIFORM', primary: '#1e325c', accent: '#ffd15c', pants: '#141d33', variant: 0, role: 'police' as const },
];

/**
 * Stylized low-poly 80s Miami protagonist avatar displayed when playing in 3rd-Person View on foot.
 * Supports live outfit switching at the Safehouse Wardrobe & 2-segment limb articulation!
 */
export class PlayerAvatar {
  public readonly group = new THREE.Group();
  private readonly bodyRoot: THREE.Group;
  private readonly torsoMat: THREE.MeshStandardMaterial;
  private readonly torsoBackMat: THREE.MeshStandardMaterial;
  private readonly sleeveMat: THREE.MeshStandardMaterial;
  private readonly pantsMat: THREE.MeshStandardMaterial;
  private readonly leftLegPivot: THREE.Group;
  private readonly rightLegPivot: THREE.Group;
  private readonly leftKneePivot: THREE.Group;
  private readonly rightKneePivot: THREE.Group;
  private readonly leftArmPivot: THREE.Group;
  private readonly rightArmPivot: THREE.Group;
  private readonly leftElbowPivot: THREE.Group;
  private readonly rightElbowPivot: THREE.Group;
  private readonly gunMesh: THREE.Mesh;
  private readonly katanaMesh: THREE.Mesh;

  private outfitIndex = 0;
  private walkPhase = 0;

  constructor(scene: THREE.Scene) {
    const def = PLAYER_OUTFITS[0];
    const rig = buildLowPolyCharacter({
      role: def.role,
      bodyType: 'male',
      skinColor: '#e2b192',
      hairColor: '#2b1e1b',
      primaryColor: def.primary,
      accentColor: def.accent,
      pantsColor: def.pants,
      shoeColor: '#f7f4f0',
      outfitVariant: def.variant,
      hairStyle: 'pompadour',
      wearsSunglasses: true,
      hasMustache: false,
      shortSleeves: false,
    });

    this.bodyRoot = rig.bodyRoot;
    this.group.add(this.bodyRoot);

    this.torsoMat = rig.materials.torsoFront;
    this.torsoBackMat = rig.materials.torsoBack;
    this.sleeveMat = rig.materials.sleeve;
    this.pantsMat = rig.materials.pants;
    this.leftArmPivot = rig.leftArmPivot;
    this.rightArmPivot = rig.rightArmPivot;
    this.leftElbowPivot = rig.leftElbowPivot;
    this.rightElbowPivot = rig.rightElbowPivot;
    this.leftLegPivot = rig.leftLegPivot;
    this.rightLegPivot = rig.rightLegPivot;
    this.leftKneePivot = rig.leftKneePivot;
    this.rightKneePivot = rig.rightKneePivot;

    // Held firearm mesh attached to right hand anchor
    this.gunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.085, 0.34),
      new THREE.MeshStandardMaterial({ color: '#2b2636', metalness: 0.8, roughness: 0.28, flatShading: true }),
    );
    this.gunMesh.position.set(0, -0.05, 0.14);
    this.gunMesh.rotation.x = Math.PI / 2;
    rig.rightHandAnchor.add(this.gunMesh);

    // Held Neon Katana mesh attached to right hand anchor (shown for slot 0)
    this.katanaMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.85, 0.05),
      new THREE.MeshStandardMaterial({
        color: '#e6ffff',
        emissive: '#36f1e6',
        emissiveIntensity: 2.2,
      }),
    );
    this.katanaMesh.position.set(0, -0.06, 0.42);
    this.katanaMesh.rotation.x = Math.PI / 2;
    this.katanaMesh.visible = false;
    rig.rightHandAnchor.add(this.katanaMesh);

    this.group.visible = false;
    scene.add(this.group);
  }

  public setOutfit(index: number): string {
    this.outfitIndex = ((index % PLAYER_OUTFITS.length) + PLAYER_OUTFITS.length) % PLAYER_OUTFITS.length;
    const o = PLAYER_OUTFITS[this.outfitIndex];
    this.torsoMat.map = getOutfitTexture(o.role, o.primary, o.accent, o.variant);
    this.torsoMat.needsUpdate = true;
    this.torsoBackMat.map = getOutfitBackTexture(o.role, o.primary, o.accent, o.variant);
    this.torsoBackMat.needsUpdate = true;
    this.sleeveMat.color.set(o.primary);
    this.pantsMat.color.set(o.pants);
    return o.name;
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

  private mirrorOnlyMode = false;

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
    const targetLayer = mirrorOnly ? 1 : 0;
    this.group.traverse((obj) => {
      obj.layers.set(targetLayer);
    });
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

    this.gunMesh.visible = !isKatana && !swimming;
    this.katanaMesh.visible = isKatana && !swimming;

    // Crouch squash (upright while swimming)
    const targetScaleY = crouching && !swimming ? 0.72 : 1.0;
    this.bodyRoot.scale.y += (targetScaleY - this.bodyRoot.scale.y) * (1 - Math.exp(-12 * clampedDt));

    const blend = 1 - Math.exp(-10 * clampedDt);
    if (swimming) {
      const moving = speed > 0.55;
      const strokeRate = moving ? (speed > 5.2 ? 7.8 : 5.6) : 2.6;
      this.walkPhase += clampedDt * strokeRate;

      // Smoothly pitch torso prone for freestyle crawl when moving, or upright treading water when idle
      // With player floating at y = -1.48 (ocean surface at -0.20), these offsets keep head & shoulders right at the surface!
      const targetPitch = moving ? 1.32 : 0.16;
      const targetRoll = moving ? Math.sin(this.walkPhase) * 0.22 : 0;
      const targetLiftY = (moving ? 0.94 : 0.04) + Math.sin(this.walkPhase * (moving ? 1.0 : 1.5)) * 0.055;
      this.bodyRoot.rotation.x += (targetPitch - this.bodyRoot.rotation.x) * blend;
      this.bodyRoot.rotation.z += (targetRoll - this.bodyRoot.rotation.z) * blend;
      this.bodyRoot.position.y += (targetLiftY - this.bodyRoot.position.y) * blend;

      if (moving) {
        // Freestyle crawl: alternating overhead arm strokes + fast flutter kick!
        const leftStroke = -Math.PI * 0.5 - Math.cos(this.walkPhase) * 1.45;
        const rightStroke = -Math.PI * 0.5 + Math.cos(this.walkPhase) * 1.45;
        this.leftArmPivot.rotation.x += (leftStroke - this.leftArmPivot.rotation.x) * blend;
        this.rightArmPivot.rotation.x += (rightStroke - this.rightArmPivot.rotation.x) * blend;
        this.leftElbowPivot.rotation.x += (-0.38 - this.leftElbowPivot.rotation.x) * blend;
        this.rightElbowPivot.rotation.x += (-0.38 - this.rightElbowPivot.rotation.x) * blend;
        this.leftArmPivot.rotation.z += ((0.28 + Math.sin(this.walkPhase) * 0.22) - this.leftArmPivot.rotation.z) * blend;
        this.rightArmPivot.rotation.z += ((-0.28 + Math.sin(this.walkPhase) * 0.22) - this.rightArmPivot.rotation.z) * blend;

        const kick = Math.sin(this.walkPhase * 2.2) * 0.42;
        this.leftLegPivot.rotation.x = kick;
        this.rightLegPivot.rotation.x = -kick;
        this.leftKneePivot.rotation.x = Math.max(0.08, kick * 0.65);
        this.rightKneePivot.rotation.x = Math.max(0.08, -kick * 0.65);
      } else {
        // Treading water: gentle breaststroke arm sweeps & slow alternating leg kicks
        const sweep = Math.sin(this.walkPhase);
        this.leftArmPivot.rotation.x += ((-0.65 + sweep * 0.35) - this.leftArmPivot.rotation.x) * blend;
        this.rightArmPivot.rotation.x += ((-0.65 + sweep * 0.35) - this.rightArmPivot.rotation.x) * blend;
        this.leftElbowPivot.rotation.x += (-0.55 - this.leftElbowPivot.rotation.x) * blend;
        this.rightElbowPivot.rotation.x += (-0.55 - this.rightElbowPivot.rotation.x) * blend;
        this.leftArmPivot.rotation.z += ((0.45 + Math.cos(this.walkPhase) * 0.35) - this.leftArmPivot.rotation.z) * blend;
        this.rightArmPivot.rotation.z += ((-0.45 - Math.cos(this.walkPhase) * 0.35) - this.rightArmPivot.rotation.z) * blend;

        const tread = Math.sin(this.walkPhase * 1.5) * 0.34;
        this.leftLegPivot.rotation.x = tread;
        this.rightLegPivot.rotation.x = -tread;
        this.leftKneePivot.rotation.x = Math.max(0.15, 0.32 - tread * 0.6);
        this.rightKneePivot.rotation.x = Math.max(0.15, 0.32 + tread * 0.6);
      }
      return;
    }

    // Smoothly reset swim posture back to standing
    this.bodyRoot.rotation.x += (0 - this.bodyRoot.rotation.x) * blend;
    this.bodyRoot.rotation.z += (0 - this.bodyRoot.rotation.z) * blend;
    this.leftArmPivot.rotation.z += (0 - this.leftArmPivot.rotation.z) * blend;
    this.rightArmPivot.rotation.z += (0 - this.rightArmPivot.rotation.z) * blend;

    if (grounded && speed > 0.5) {
      this.walkPhase += clampedDt * speed * 2.1;
      const isSprinting = speed > 7.5;
      const swing = Math.sin(this.walkPhase) * (isSprinting ? 0.72 : 0.46);
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      // Natural knee bend during leg swing (positive X bends shin backward)
      this.leftKneePivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + 0.85)) * (isSprinting ? 0.95 : 0.52);
      this.rightKneePivot.rotation.x = Math.max(0, Math.sin(this.walkPhase + Math.PI + 0.85)) * (isSprinting ? 0.95 : 0.52);
      this.bodyRoot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.045;

      if (aiming && !isKatana) {
        this.rightArmPivot.rotation.x += (-1.38 - this.rightArmPivot.rotation.x) * blend;
        this.rightElbowPivot.rotation.x += (-0.18 - this.rightElbowPivot.rotation.x) * blend;
        this.leftArmPivot.rotation.x += (-1.05 - this.leftArmPivot.rotation.x) * blend;
        this.leftElbowPivot.rotation.x += (-0.42 - this.leftElbowPivot.rotation.x) * blend;
      } else {
        this.leftArmPivot.rotation.x += (-swing * 0.65 - this.leftArmPivot.rotation.x) * blend;
        this.leftElbowPivot.rotation.x += ((-0.28 - Math.max(0, -swing) * 0.55) - this.leftElbowPivot.rotation.x) * blend;
        this.rightArmPivot.rotation.x += ((isKatana ? -0.45 : -0.95) + swing * 0.22 - this.rightArmPivot.rotation.x) * blend;
        this.rightElbowPivot.rotation.x += ((isKatana ? -0.35 : -0.32) - this.rightElbowPivot.rotation.x) * blend;
      }
    } else {
      this.leftLegPivot.rotation.x *= 0.82;
      this.rightLegPivot.rotation.x *= 0.82;
      this.leftKneePivot.rotation.x *= 0.82;
      this.rightKneePivot.rotation.x *= 0.82;
      this.bodyRoot.position.y *= 0.82;
      const aimX = isKatana ? -0.35 : aiming ? -1.42 : -0.95;
      this.rightArmPivot.rotation.x += (aimX - this.rightArmPivot.rotation.x) * blend;
      this.rightElbowPivot.rotation.x += ((aiming && !isKatana ? -0.15 : -0.35) - this.rightElbowPivot.rotation.x) * blend;
      this.leftArmPivot.rotation.x += ((aiming && !isKatana ? -1.1 : -0.05) - this.leftArmPivot.rotation.x) * blend;
      this.leftElbowPivot.rotation.x += ((aiming && !isKatana ? -0.42 : -0.18) - this.leftElbowPivot.rotation.x) * blend;
    }
  }
}
