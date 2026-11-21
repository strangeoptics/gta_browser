import * as THREE from 'three';
import { getFaceTexture, getOutfitTexture } from '../entities/CharacterTextures';

/**
 * Stylized 80s Miami protagonist avatar displayed when playing in 3rd-Person View on foot.
 * Features articulated limbs, sunglasses, pastel blazer over cyan tee, and a visible right-hand weapon.
 */
export class PlayerAvatar {
  public readonly group = new THREE.Group();
  private readonly bodyRoot = new THREE.Group();
  private readonly leftLegPivot: THREE.Group;
  private readonly rightLegPivot: THREE.Group;
  private readonly leftArmPivot: THREE.Group;
  private readonly rightArmPivot: THREE.Group;
  private readonly gunMesh: THREE.Mesh;
  private readonly katanaMesh: THREE.Mesh;

  private walkPhase = 0;

  constructor(scene: THREE.Scene) {
    this.group.add(this.bodyRoot);

    const skinColor = '#e2b192';
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#2b1e1b', roughness: 0.8 });
    const outfitTex = getOutfitTexture('civilian', '#f2e8e1', '#36f1e6', 2); // crisp Miami blazer + cyan stripe tee
    const torsoMat = new THREE.MeshStandardMaterial({ map: outfitTex, roughness: 0.6 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: '#f2e8e1', roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: '#272c42', roughness: 0.78 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#f7f4f0', roughness: 0.5 });

    // Pelvis & belt
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.26), pantsMat);
    pelvis.position.y = 0.78;
    this.bodyRoot.add(pelvis);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.06, 0.28),
      new THREE.MeshStandardMaterial({ color: '#1b1520', roughness: 0.4 }),
    );
    belt.position.y = 0.86;
    this.bodyRoot.add(belt);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.27), torsoMat);
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
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), sleeveMat);
      upper.position.y = -0.12;
      upper.castShadow = true;
      pivot.add(upper);
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.12), sleeveMat);
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
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.18), pantsMat);
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

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
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
  ): void {
    if (!this.group.visible) return;
    const clampedDt = Math.min(dt, 0.05);

    this.group.position.copy(position);
    // Player camera looks along (-sin(yaw), -cos(yaw)); avatar faces +Z locally -> yaw + PI
    this.group.rotation.y = yaw + Math.PI;

    this.gunMesh.visible = !isKatana;
    this.katanaMesh.visible = isKatana;

    // Crouch squash
    const targetScaleY = crouching ? 0.72 : 1.0;
    this.bodyRoot.scale.y += (targetScaleY - this.bodyRoot.scale.y) * (1 - Math.exp(-12 * clampedDt));

    const blend = 1 - Math.exp(-12 * clampedDt);
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
