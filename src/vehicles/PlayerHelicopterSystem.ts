import * as THREE from 'three';
import type { AABB } from '../types';
import type { GamepadSnapshot } from '../engine/GamepadInput';

export interface PlayerHeliHudState {
  inHeli: boolean;
  heliName: string;
  speedKmh: number;
  altitudeM: number;
  nearbyHeli: boolean;
}

/**
 * Flyable 80s Executive Helicopter ("VICE MAVERICK") stationed on Starfish Island Helipad!
 * Controls:
 * - [E] Board / Land & Exit (when near ground/helipad)
 * - [Space] / Gamepad RT: Climb  |  [C] or [Shift] / Gamepad LT: Descend
 * - [W]/[S]: Pitch & fly forward/backward  |  [A]/[D]: Yaw turn left/right
 * - [V]: Toggle Panoramic Chase Cam / Cockpit Pilot Cam
 */
export class PlayerHelicopterSystem {
  public readonly position = new THREE.Vector3();
  public yaw = Math.PI / 2; // faces West toward Miami skyline!
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private rotorSpeed = 0;

  private readonly group: THREE.Group;
  private readonly mainRotor: THREE.Group;
  private readonly tailRotor: THREE.Group;
  private readonly rotorDiscMat: THREE.MeshBasicMaterial;
  private readonly strobeMat: THREE.MeshStandardMaterial;
  private strobeClock = 0;
  private readonly keys = new Set<string>();

  private active = false;
  private cockpitCam = false;
  private readonly camPosSmooth = new THREE.Vector3();
  private readonly camLookSmooth = new THREE.Vector3();
  private camInit = false;

  constructor(scene: THREE.Scene, spawnPos: THREE.Vector3) {
    this.position.copy(spawnPos);
    const built = this.createMaverickMesh();
    this.group = built.group;
    this.mainRotor = built.mainRotor;
    this.tailRotor = built.tailRotor;
    this.rotorDiscMat = built.rotorDiscMat;
    this.strobeMat = built.strobeMat;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    scene.add(this.group);

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyV' && this.active) {
        this.cockpitCam = !this.cockpitCam;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  public isInHeli(): boolean {
    return this.active;
  }

  public isPlayerNear(playerPos: THREE.Vector3): boolean {
    return playerPos.distanceToSquared(this.position) < 25.0; // within 5m
  }

  public board(): void {
    this.active = true;
    this.camInit = false;
  }

  public canExit(colliders: AABB[], getGroundHeight: (x: number, z: number) => number): boolean {
    const surfaceY = this.findSurfaceHeight(this.position.x, this.position.z, this.position.y, colliders, getGroundHeight);
    return this.position.y - surfaceY < 3.2;
  }

  public exit(colliders: AABB[], getGroundHeight: (x: number, z: number) => number): { x: number; y: number; z: number; yaw: number } {
    this.active = false;
    this.keys.clear();
    const surfaceY = this.findSurfaceHeight(this.position.x, this.position.z, this.position.y, colliders, getGroundHeight);
    this.position.y = surfaceY;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.group.rotation.x = 0;
    this.group.rotation.z = 0;
    this.group.position.copy(this.position);

    const sideX = Math.cos(this.yaw) * -2.6;
    const sideZ = -Math.sin(this.yaw) * -2.6;
    return {
      x: this.position.x + sideX,
      y: surfaceY + 0.15,
      z: this.position.z + sideZ,
      yaw: this.yaw + Math.PI,
    };
  }

  private findSurfaceHeight(
    x: number,
    z: number,
    currentY: number,
    colliders: AABB[],
    getGroundHeight: (x: number, z: number) => number,
  ): number {
    let bestY = Math.max(0, getGroundHeight(x, z));
    for (const box of colliders) {
      if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
        if (box.maxY <= currentY + 1.2 && box.maxY > bestY) {
          bestY = box.maxY;
        }
      }
    }
    return bestY;
  }

  public update(
    dt: number,
    isPlaying: boolean,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    colliders: AABB[],
    getGroundHeight: (x: number, z: number) => number,
    pad?: GamepadSnapshot,
  ): PlayerHeliHudState {
    const clampedDt = Math.min(dt, 0.05);

    if (this.active && pad?.connected && pad.camTogglePressed) {
      this.cockpitCam = !this.cockpitCam;
    }

    const targetRotor = this.active ? 34 : 0;
    this.rotorSpeed += (targetRotor - this.rotorSpeed) * (1 - Math.exp(-3.5 * clampedDt));
    this.mainRotor.rotation.y += this.rotorSpeed * clampedDt;
    this.tailRotor.rotation.x += this.rotorSpeed * 1.4 * clampedDt;
    this.rotorDiscMat.opacity = THREE.MathUtils.clamp((this.rotorSpeed - 10) / 24, 0, 1) * 0.22;

    this.strobeClock += clampedDt;
    const strobeOn = Math.sin(this.strobeClock * 9.5) > 0.72;
    this.strobeMat.emissiveIntensity = strobeOn ? 4.2 : 0.35;

    const surfaceY = this.findSurfaceHeight(this.position.x, this.position.z, this.position.y, colliders, getGroundHeight);

    if (this.active && isPlaying) {
      const kbFwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
      const kbTurn = (this.keys.has('KeyA') ? 1 : 0) - (this.keys.has('KeyD') ? 1 : 0);
      const kbClimb =
        (this.keys.has('Space') ? 1 : 0) -
        (this.keys.has('KeyC') || this.keys.has('ShiftLeft') || this.keys.has('ControlLeft') ? 1 : 0);

      const padFwd = pad?.connected ? pad.moveY : 0;
      const padTurn = pad?.connected ? -pad.moveX : 0;
      const padClimb = pad?.connected ? pad.rt - pad.lt : 0;

      const fwdInput = THREE.MathUtils.clamp(kbFwd + padFwd, -1, 1);
      const turnInput = THREE.MathUtils.clamp(kbTurn + padTurn, -1, 1);
      const climbInput = THREE.MathUtils.clamp(kbClimb + padClimb, -1, 1);

      this.yaw += turnInput * 1.65 * clampedDt;

      const fwdX = Math.sin(this.yaw);
      const fwdZ = Math.cos(this.yaw);
      const airborne = this.position.y > surfaceY + 0.35 || climbInput > 0.05;

      if (airborne) {
        const targetVx = fwdX * fwdInput * 30.0;
        const targetVz = fwdZ * fwdInput * 30.0;
        const targetVy = climbInput * 13.5;

        const hBlend = 1 - Math.exp(-2.6 * clampedDt);
        const vBlend = 1 - Math.exp(-4.2 * clampedDt);
        this.vx += (targetVx - this.vx) * hBlend;
        this.vz += (targetVz - this.vz) * hBlend;
        this.vy += (targetVy - this.vy) * vBlend;
      } else {
        this.vx *= Math.exp(-6 * clampedDt);
        this.vz *= Math.exp(-6 * clampedDt);
        this.vy = 0;
      }

      this.position.x = THREE.MathUtils.clamp(this.position.x + this.vx * clampedDt, -110, 230);
      this.position.z = THREE.MathUtils.clamp(this.position.z + this.vz * clampedDt, -120, 120);
      this.position.y = THREE.MathUtils.clamp(this.position.y + this.vy * clampedDt, surfaceY, 72);
      if (this.position.y <= surfaceY + 0.02 && this.vy < 0) {
        this.position.y = surfaceY;
        this.vy = 0;
      }

      // Realistic cyclic pitch & roll tilt while flying!
      const airFactor = this.position.y > surfaceY + 0.4 ? 1 : 0;
      const targetPitch = fwdInput * 0.24 * airFactor;
      const targetRoll = -turnInput * 0.28 * airFactor;
      const tiltBlend = 1 - Math.exp(-6.5 * clampedDt);
      this.group.rotation.x += (targetPitch - this.group.rotation.x) * tiltBlend;
      this.group.rotation.z += (targetRoll - this.group.rotation.z) * tiltBlend;
    } else {
      // Gently settle onto surface if left slightly above ground
      if (this.position.y > surfaceY) {
        this.vy -= 9.8 * clampedDt;
        this.position.y = Math.max(surfaceY, this.position.y + this.vy * clampedDt);
      } else {
        this.vy = 0;
      }
      this.vx *= Math.exp(-4 * clampedDt);
      this.vz *= Math.exp(-4 * clampedDt);
      this.group.rotation.x *= 0.88;
      this.group.rotation.z *= 0.88;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    if (this.active) {
      const fwdX = Math.sin(this.yaw);
      const fwdZ = Math.cos(this.yaw);
      if (this.cockpitCam) {
        camera.position.set(
          this.position.x + fwdX * 0.85,
          this.position.y + 1.55,
          this.position.z + fwdZ * 0.85,
        );
        camera.lookAt(
          this.position.x + fwdX * 24,
          this.position.y + 1.1,
          this.position.z + fwdZ * 24,
        );
      } else {
        const desiredPos = new THREE.Vector3(
          this.position.x - fwdX * 10.5,
          this.position.y + 4.6,
          this.position.z - fwdZ * 10.5,
        );
        const desiredLook = new THREE.Vector3(
          this.position.x + fwdX * 8.5,
          this.position.y + 1.2,
          this.position.z + fwdZ * 8.5,
        );
        if (!this.camInit) {
          this.camPosSmooth.copy(desiredPos);
          this.camLookSmooth.copy(desiredLook);
          this.camInit = true;
        } else {
          const cBlend = 1 - Math.exp(-7.5 * clampedDt);
          this.camPosSmooth.lerp(desiredPos, cBlend);
          this.camLookSmooth.lerp(desiredLook, cBlend);
        }
        camera.position.copy(this.camPosSmooth);
        camera.lookAt(this.camLookSmooth);
      }
    }

    const horizSpd = Math.hypot(this.vx, this.vz);
    return {
      inHeli: this.active,
      heliName: 'VICE MAVERICK',
      speedKmh: Math.round(horizSpd * 3.6),
      altitudeM: Math.max(0, Math.round(this.position.y)),
      nearbyHeli: !this.active && this.isPlayerNear(playerPos),
    };
  }

  private createMaverickMesh(): {
    group: THREE.Group;
    mainRotor: THREE.Group;
    tailRotor: THREE.Group;
    rotorDiscMat: THREE.MeshBasicMaterial;
    strobeMat: THREE.MeshStandardMaterial;
  } {
    const group = new THREE.Group();

    const pearlWhiteMat = new THREE.MeshStandardMaterial({ color: '#f4f6fb', roughness: 0.15, metalness: 0.42 });
    const navyBellyMat = new THREE.MeshStandardMaterial({ color: '#141c30', roughness: 0.28, metalness: 0.55 });
    const cyanStripeMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    const pinkStripeMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#dce4ee', roughness: 0.14, metalness: 0.92 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: '#1c1e28', roughness: 0.42, metalness: 0.72 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: '#e8dcd0', roughness: 0.68 });
    const yellowTipMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#0d1d34',
      roughness: 0.06,
      metalness: 0.9,
      transparent: true,
      opacity: 0.62,
    });
    const strobeMat = new THREE.MeshStandardMaterial({
      color: '#ff2244',
      emissive: '#ff1a3a',
      emissiveIntensity: 2.0,
    });

    // --- 1) Detailed Tubular Landing Skids, Curved Toe-Ups, Cross-Struts & Boarding Steps ---
    for (const sx of [-1.02, 1.02]) {
      // Main horizontal runner
      const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 3.35, 10), chromeMat);
      runner.rotation.x = Math.PI / 2;
      runner.position.set(sx, 0.05, 0.25);
      runner.castShadow = true;
      group.add(runner);

      // Curved upturned front skid tip (+Z)
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.48, 8), chromeMat);
      toe.rotation.x = Math.PI / 2 - 0.55;
      toe.position.set(sx, 0.16, 2.08);
      group.add(toe);

      // Passenger boarding footstep bar
      const stepBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.95), darkMetalMat);
      stepBar.position.set(sx * 0.88, 0.38, 0.45);
      group.add(stepBar);

      // Angled aerodynamic cross-tube legs
      for (const sz of [-0.68, 0.92]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.72, 8), darkMetalMat);
        leg.position.set(sx * 0.78, 0.36, sz);
        leg.rotation.z = sx > 0 ? 0.46 : -0.46;
        group.add(leg);
      }
    }

    // --- 2) Sculpted Bell-206 / Executive Helicopter Fuselage (Extruded Aerodynamic Profile!) ---
    const fuseShape = new THREE.Shape();
    fuseShape.moveTo(-1.55, 0.72); // rear cabin belly
    fuseShape.lineTo(1.65, 0.66);  // forward belly
    fuseShape.lineTo(2.42, 0.96);  // sleek pointed lower nose chin!
    fuseShape.lineTo(2.18, 1.34);  // windshield sill
    fuseShape.lineTo(1.08, 1.98);  // steeply raked panoramic windshield top
    fuseShape.lineTo(-0.92, 1.98); // cabin roof
    fuseShape.lineTo(-1.72, 1.56); // tapered rear bulkhead into tail boom
    fuseShape.lineTo(-1.72, 1.08);
    fuseShape.closePath();

    const fuseGeo = new THREE.ExtrudeGeometry(fuseShape, {
      depth: 1.56,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.14,
      bevelSegments: 3,
    });
    fuseGeo.translate(0, 0, -0.78);
    fuseGeo.rotateY(-Math.PI / 2);
    fuseGeo.computeVertexNormals();
    const fuselage = new THREE.Mesh(fuseGeo, pearlWhiteMat);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    group.add(fuselage);

    // Midnight-Navy Lower Belly Bellypan
    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.24, 3.1), navyBellyMat);
    belly.position.set(0, 0.74, 0.2);
    group.add(belly);

    // Sweeping 80s Vice-Cyan & Hot-Pink Executive Livery Stripes
    for (const sx of [-0.93, 0.93]) {
      const cStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 3.25), cyanStripeMat);
      cStripe.position.set(sx, 1.18, 0.18);
      cStripe.rotation.x = 0.04;
      group.add(cStripe);

      const pStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 3.15), pinkStripeMat);
      pStripe.position.set(sx, 1.05, 0.15);
      pStripe.rotation.x = 0.04;
      group.add(pStripe);

      // Tinted side cabin & passenger windows
      for (const [wz, wl] of [
        [0.95, 0.92],
        [-0.25, 0.98],
      ]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, wl), glassMat);
        win.position.set(sx * 0.99, 1.56, wz);
        group.add(win);
      }
    }

    // Sloped Panoramic Tinted Front Windscreen + Center Mullion + Chin Windows!
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.06, 1.24), glassMat);
    windshield.position.set(0, 1.66, 1.64);
    windshield.rotation.x = 0.56;
    group.add(windshield);

    const centerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 1.28), pearlWhiteMat);
    centerFrame.position.set(0, 1.67, 1.65);
    centerFrame.rotation.x = 0.56;
    group.add(centerFrame);

    // Visible Cockpit Interior: 2 Cream Leather Pilot Seats + Glowing 80s Avionics Dash!
    for (const sx of [-0.38, 0.38]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.42), leatherMat);
      seat.position.set(sx, 1.15, 0.88);
      group.add(seat);
    }
    const avionics = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.2, 0.24),
      new THREE.MeshStandardMaterial({ color: '#142234', emissive: '#36f1e6', emissiveIntensity: 1.1 }),
    );
    avionics.position.set(0, 1.28, 1.62);
    avionics.rotation.x = -0.35;
    group.add(avionics);

    // Nose Weather Radar Cone + Wire-Strike Cutter
    const noseCone = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), navyBellyMat);
    noseCone.scale.set(1.2, 0.8, 1.3);
    noseCone.position.set(0, 0.98, 2.38);
    group.add(noseCone);

    // --- 3) Sculpted Rooftop Turbine Cowling, Air Intakes & Twin Chrome Exhaust Stacks ---
    const cowling = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.46, 2.15), pearlWhiteMat);
    cowling.position.set(0, 2.2, -0.22);
    cowling.castShadow = true;
    group.add(cowling);

    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.12), darkMetalMat);
    intake.position.set(0, 2.22, 0.86);
    group.add(intake);

    for (const sx of [-0.34, 0.34]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.52, 12), chromeMat);
      exhaust.rotation.x = Math.PI / 2 - 0.24;
      exhaust.rotation.z = sx * -0.25;
      exhaust.position.set(sx, 2.24, -1.35);
      group.add(exhaust);
    }

    // --- 4) Slender Tapered Tail Boom, Stabilizers with Endplates, Swept Fin & Strobe ---
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.36, 3.85, 12), pearlWhiteMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 1.48, -3.35);
    boom.castShadow = true;
    group.add(boom);

    for (const sx of [-0.24, 0.24]) {
      const boomStripe = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 3.4), cyanStripeMat);
      boomStripe.position.set(sx, 1.48, -3.2);
      boomStripe.rotation.y = sx * 0.055;
      group.add(boomStripe);
    }

    // Horizontal Mid-Boom Stabilizer Wings + Vertical Endplates
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.05, 0.38), pearlWhiteMat);
    hStab.position.set(0, 1.48, -3.85);
    group.add(hStab);
    for (const sx of [-0.92, 0.92]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.42), cyanStripeMat);
      endplate.position.set(sx, 1.5, -3.85);
      group.add(endplate);
    }

    // Tall Swept Vertical Tail Fin + Lower Ventral Fin + Red Anti-Collision Strobe Beacon!
    const upperFin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.28, 0.74), pearlWhiteMat);
    upperFin.position.set(0, 1.98, -5.05);
    upperFin.rotation.x = 0.34;
    upperFin.castShadow = true;
    group.add(upperFin);

    const finAccent = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.15, 0.22), pinkStripeMat);
    finAccent.position.set(0, 1.96, -4.85);
    finAccent.rotation.x = 0.34;
    group.add(finAccent);

    const ventralFin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.65, 0.52), navyBellyMat);
    ventralFin.position.set(0, 1.12, -4.95);
    ventralFin.rotation.x = -0.32;
    group.add(ventralFin);

    const strobeBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), strobeMat);
    strobeBeacon.position.set(0, 2.62, -5.22);
    group.add(strobeBeacon);

    // Port (Red) & Starboard (Green) Navigation Lights on Cabin Flanks
    const navRed = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff1a3a', emissiveIntensity: 2.5 }),
    );
    navRed.position.set(0.95, 0.88, 0.9);
    group.add(navRed);
    const navGreen = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#22ff66', emissive: '#18ee55', emissiveIntensity: 2.5 }),
    );
    navGreen.position.set(-0.95, 0.88, 0.9);
    group.add(navGreen);

    // --- 5) Detailed 4-Blade Main Rotor Hub, Swashplate, Yellow Blade Tips & Motion-Blur Disc ---
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.45, 12), chromeMat);
    mast.position.set(0, 2.58, 0.0);
    group.add(mast);

    const swashplate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), darkMetalMat);
    swashplate.position.set(0, 2.52, 0.0);
    group.add(swashplate);

    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.8, 0.0);

    const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), chromeMat);
    hubCap.scale.set(1, 0.55, 1);
    mainRotor.add(hubCap);

    for (let b = 0; b < 4; b++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.y = (b / 4) * Math.PI * 2;

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.055, 0.14), chromeMat);
      grip.position.set(0.35, 0, 0);
      bladePivot.add(grip);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.028, 0.24), darkMetalMat);
      blade.position.set(2.25, 0, 0);
      blade.castShadow = true;
      bladePivot.add(blade);

      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.032, 0.245), yellowTipMat);
      tip.position.set(3.95, 0, 0);
      bladePivot.add(tip);

      mainRotor.add(bladePivot);
    }

    const rotorDiscMat = new THREE.MeshBasicMaterial({
      color: '#cfe8f8',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rotorDisc = new THREE.Mesh(new THREE.RingGeometry(0.65, 4.1, 32), rotorDiscMat);
    rotorDisc.rotation.x = -Math.PI / 2;
    rotorDisc.position.y = 0.01;
    mainRotor.add(rotorDisc);

    group.add(mainRotor);

    // --- 6) Tail Rotor Assembly + Safety Ring ---
    const tailGuard = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.022, 6, 20), chromeMat);
    tailGuard.rotation.y = Math.PI / 2;
    tailGuard.position.set(0.16, 1.88, -5.18);
    group.add(tailGuard);

    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.16, 1.88, -5.18);
    const tHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), chromeMat);
    tHub.rotation.z = Math.PI / 2;
    tailRotor.add(tHub);
    const tBlade1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.22, 0.11), darkMetalMat);
    const tBlade2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 1.22), darkMetalMat);
    tailRotor.add(tBlade1, tBlade2);
    group.add(tailRotor);

    return { group, mainRotor, tailRotor, rotorDiscMat, strobeMat };
  }
}
