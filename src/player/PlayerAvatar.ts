import * as THREE from 'three';
import { getFaceTexture, getOutfitBackTexture, getOutfitTexture } from '../entities/CharacterTextures';

const PLAYER_OUTFITS = [
  { name: 'MIAMI WHITE SUIT', primary: '#f2e8e1', accent: '#36f1e6', pants: '#272c42', variant: 2, role: 'civilian' as const },
  { name: 'HAWAIIAN TOURIST', primary: '#ff7b7b', accent: '#36f1e6', pants: '#f0e2ce', variant: 1, role: 'civilian' as const },
  { name: 'MIDNIGHT NEON', primary: '#1e172b', accent: '#ff4fa3', pants: '#171522', variant: 2, role: 'civilian' as const },
  { name: 'VICE DETECTIVE', primary: '#9fe6d8', accent: '#ffd15c', pants: '#f4eee8', variant: 2, role: 'civilian' as const },
  { name: 'VICE PD UNIFORM', primary: '#1e325c', accent: '#ffd15c', pants: '#141d33', variant: 0, role: 'police' as const },
];

/**
 * Stylized 80s Miami protagonist avatar displayed when playing in 3rd-Person View on foot.
 * Supports live outfit switching at the Safehouse Wardrobe!
 */
export class PlayerAvatar {
  public readonly group = new THREE.Group();
  private readonly bodyRoot = new THREE.Group();
  private readonly torsoMat: THREE.MeshStandardMaterial;
  private readonly torsoBackMat: THREE.MeshStandardMaterial;
  private readonly sleeveMat: THREE.MeshStandardMaterial;
  private readonly pantsMat: THREE.MeshStandardMaterial;
  private readonly leftLegPivot: THREE.Group;
  private readonly rightLegPivot: THREE.Group;
  private readonly leftArmPivot: THREE.Group;
  private readonly rightArmPivot: THREE.Group;
  private readonly gunMesh: THREE.Mesh;
  private readonly katanaMesh: THREE.Mesh;

  private outfitIndex = 0;
  private walkPhase = 0;

  constructor(scene: THREE.Scene) {
    this.group.add(this.bodyRoot);

    const skinColor = '#e2b192';
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#2b1e1b', roughness: 0.8 });
    const def = PLAYER_OUTFITS[0];
    this.torsoMat = new THREE.MeshStandardMaterial({
      map: getOutfitTexture('civilian', def.primary, def.accent, def.variant),
      roughness: 0.6,
    });
    this.torsoBackMat = new THREE.MeshStandardMaterial({
      map: getOutfitBackTexture('civilian', def.primary, def.accent, def.variant),
      roughness: 0.6,
    });
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: def.primary, roughness: 0.6 });
    this.pantsMat = new THREE.MeshStandardMaterial({ color: def.pants, roughness: 0.78 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#f7f4f0', roughness: 0.5 });

    // Pelvis & belt
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.26), this.pantsMat);
    pelvis.position.y = 0.78;
    this.bodyRoot.add(pelvis);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.06, 0.28),
      new THREE.MeshStandardMaterial({ color: '#1b1520', roughness: 0.4 }),
    );
    belt.position.y = 0.86;
    this.bodyRoot.add(belt);

    // Torso (+Z = front outfit, -Z = tailored back outfit, sides/top/bottom = solid jacket/shirt color)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.27), [
      this.sleeveMat,
      this.sleeveMat,
      this.sleeveMat,
      this.sleeveMat,
      this.torsoMat,
      this.torsoBackMat,
    ]);
    torso.position.y = 1.16;
    torso.castShadow = true;
    this.bodyRoot.add(torso);

    // Neck & Head with 80s sunset sunglasses
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 8), skinMat);
    neck.position.y = 1.48;
    this.bodyRoot.add(neck);

    const faceTex = getFaceTexture(skinColor, true, false);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.65 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), [
      skinMat,
      skinMat,
      hairMat,
      skinMat,
      faceMat,
      hairMat,
    ]);
    head.position.y = 1.65;
    head.castShadow = true;
    this.bodyRoot.add(head);

    // 80s styled hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.32), hairMat);
    hair.position.set(0, 1.81, -0.02);
    this.bodyRoot.add(hair);

    // Arms
    const buildArm = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.32, 1.38, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), this.sleeveMat);
      upper.position.y = -0.12;
      upper.castShadow = true;
      pivot.add(upper);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.12), this.sleeveMat);
      lower.position.y = -0.36;
      pivot.add(lower);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skinMat);
      hand.position.y = -0.52;
      pivot.add(hand);
      this.bodyRoot.add(pivot);
      return pivot;
    };

    this.leftArmPivot = buildArm(-1);
    this.rightArmPivot = buildArm(1);

    // Held firearm mesh on right hand
    this.gunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.09, 0.34),
      new THREE.MeshStandardMaterial({ color: '#2b2636', metalness: 0.8, roughness: 0.28 }),
    );
    this.gunMesh.position.set(0, -0.56, 0.14);
    this.gunMesh.rotation.x = Math.PI / 2;
    this.rightArmPivot.add(this.gunMesh);

    // Held Neon Katana mesh on right hand (shown for slot 0)
    this.katanaMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.85, 0.05),
      new THREE.MeshStandardMaterial({
        color: '#e6ffff',
        emissive: '#36f1e6',
        emissiveIntensity: 2.2,
      }),
    );
    this.katanaMesh.position.set(0, -0.58, 0.42);
    this.katanaMesh.rotation.x = Math.PI / 2;
    this.katanaMesh.visible = false;
    this.rightArmPivot.add(this.katanaMesh);

    // Legs + white sneakers
    const buildLeg = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.13, 0.74, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.18), this.pantsMat);
      leg.position.y = -0.34;
      leg.castShadow = true;
      pivot.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.27), shoeMat);
      shoe.position.set(0, -0.69, 0.04);
      pivot.add(shoe);
      this.bodyRoot.add(pivot);
      return pivot;
    };

    this.leftLegPivot = buildLeg(-1);
    this.rightLegPivot = buildLeg(1);

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
        this.leftArmPivot.rotation.z += ((0.28 + Math.sin(this.walkPhase) * 0.22) - this.leftArmPivot.rotation.z) * blend;
        this.rightArmPivot.rotation.z += ((-0.28 + Math.sin(this.walkPhase) * 0.22) - this.rightArmPivot.rotation.z) * blend;

        const kick = Math.sin(this.walkPhase * 2.2) * 0.48;
        this.leftLegPivot.rotation.x = kick;
        this.rightLegPivot.rotation.x = -kick;
      } else {
        // Treading water: gentle breaststroke arm sweeps & slow alternating leg kicks
        const sweep = Math.sin(this.walkPhase);
        this.leftArmPivot.rotation.x += ((-0.65 + sweep * 0.35) - this.leftArmPivot.rotation.x) * blend;
        this.rightArmPivot.rotation.x += ((-0.65 + sweep * 0.35) - this.rightArmPivot.rotation.x) * blend;
        this.leftArmPivot.rotation.z += ((0.45 + Math.cos(this.walkPhase) * 0.35) - this.leftArmPivot.rotation.z) * blend;
        this.rightArmPivot.rotation.z += ((-0.45 - Math.cos(this.walkPhase) * 0.35) - this.rightArmPivot.rotation.z) * blend;

        const tread = Math.sin(this.walkPhase * 1.5) * 0.34;
        this.leftLegPivot.rotation.x = tread;
        this.rightLegPivot.rotation.x = -tread;
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
      const swing = Math.sin(this.walkPhase) * (speed > 7.5 ? 0.75 : 0.48);
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.bodyRoot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.045;

      if (aiming && !isKatana) {
        this.rightArmPivot.rotation.x += (-1.52 - this.rightArmPivot.rotation.x) * blend;
        this.leftArmPivot.rotation.x += (-1.2 - this.leftArmPivot.rotation.x) * blend;
      } else {
        this.leftArmPivot.rotation.x += (-swing * 0.65 - this.leftArmPivot.rotation.x) * blend;
        this.rightArmPivot.rotation.x += ((isKatana ? -0.55 : -1.15) + swing * 0.25 - this.rightArmPivot.rotation.x) * blend;
      }
    } else {
      this.leftLegPivot.rotation.x *= 0.82;
      this.rightLegPivot.rotation.x *= 0.82;
      this.bodyRoot.position.y *= 0.82;
      const aimX = isKatana ? -0.45 : aiming ? -1.55 : -1.2;
      this.rightArmPivot.rotation.x += (aimX - this.rightArmPivot.rotation.x) * blend;
      this.leftArmPivot.rotation.x += ((aiming && !isKatana ? -1.3 : 0) - this.leftArmPivot.rotation.x) * blend;
    }
  }
}
