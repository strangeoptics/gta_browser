import * as THREE from 'three';
import { resolvePlayerCollisions } from '../engine/Physics';
import type { SpatialGrid } from '../engine/SpatialGrid';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { AABB, PlayerStatus } from '../types';

export class PlayerController {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly position = new THREE.Vector3(0, 0.18, 12);
  public readonly velocity = new THREE.Vector3();

  private yaw = 0;
  private pitch = 0;
  private sensitivityMult = 1.0;
  private invertY = false;

  private readonly keys = new Set<string>();
  private isLocked = false;
  private isActive = false;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private grounded = false;
  private crouching = false;
  private padSprintToggle = false;
  private swimming = false;
  private swimTimer = 0;
  private waterClimbing = false;
  private waterClimbTimer = 0;
  private readonly waterClimbDuration = 0.36;
  private readonly climbStart = new THREE.Vector3();
  private readonly climbEnd = new THREE.Vector3();
  private cachedWaterClimb: {
    targetX: number;
    targetY: number;
    targetZ: number;
    label: string;
  } | null = null;
  private thirdPerson = false;
  private readonly camRaycaster = new THREE.Raycaster();

  // GTA-style Cover System state
  private inCover = false;
  private coverPeeking = false;
  private coverLow = false;
  private coverNormalX = 0;
  private coverNormalZ = 1;
  private coverWallCoord = 0; // X or Z coordinate of the cover surface
  private coverAxis: 'x' | 'z' = 'z'; // 'z' means normal is along Z (wall runs along X)
  private coverSpanMin = -10;
  private coverSpanMax = 10;
  private coverBoxMaxY = 2.0;
  private coverPeekOffset = 0; // smoothed lateral corner peek
  private coverPeekDir = 1;
  private coverPullAwayTimer = 0;
  private cachedCoverCandidate: {
    axis: 'x' | 'z';
    normalX: number;
    normalZ: number;
    wallCoord: number;
    snapX: number;
    snapZ: number;
    spanMin: number;
    spanMax: number;
    boxMaxY: number;
    isLow: boolean;
  } | null = null;

  // Tuning constants
  private readonly walkSpeed = 6.2;
  private readonly sprintSpeed = 10.2;
  private readonly crouchSpeed = 3.2;
  private readonly jumpSpeed = 7.2;
  private readonly gravity = 20.0;
  private readonly accelGround = 14.0;
  private readonly accelAir = 4.0;
  private readonly radius = 0.42;
  private readonly standHeight = 1.75;
  private readonly crouchHeight = 1.1;
  private readonly standEye = 1.6;
  private readonly crouchEye = 0.95;
  private currentEyeHeight = 1.6;
  private bobTimer = 0;

  // World bounds (updated when full city loads in Phase 2)
  private worldBounds = { minX: -55, maxX: 55, minZ: -55, maxZ: 55 };

  private readonly forwardVec = new THREE.Vector3();
  private readonly rightVec = new THREE.Vector3();
  private readonly wishDir = new THREE.Vector3();
  private readonly localColliders: AABB[] = [];
  private readonly tmpPivot = new THREE.Vector3();
  private readonly tmpLookDir = new THREE.Vector3();
  private readonly tmpBackDir = new THREE.Vector3();
  private readonly tmpCamEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === domElement;
      if (this.isLocked) {
        this.isActive = true;
      } else {
        this.keys.clear();
        this.isDragging = false;
      }
    });
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (!active) {
      this.keys.clear();
      this.isDragging = false;
    }
  }

  public getIsLocked(): boolean {
    return this.isLocked;
  }

  public getIsActive(): boolean {
    return this.isActive || this.isLocked;
  }

  public getYaw(): number {
    return this.yaw;
  }

  public setYaw(yaw: number): void {
    this.yaw = yaw;
    this.pitch = 0;
  }

  public setSensitivityMultiplier(mult: number): void {
    this.sensitivityMult = THREE.MathUtils.clamp(mult, 0.4, 2.5);
  }

  public setInvertY(invert: boolean): void {
    this.invertY = invert;
  }

  public toggleThirdPerson(): boolean {
    this.thirdPerson = !this.thirdPerson;
    return this.thirdPerson;
  }

  public isThirdPerson(): boolean {
    return this.thirdPerson;
  }

  public setWorldBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.worldBounds = { minX, maxX, minZ, maxZ };
  }

  public setSpawn(x: number, y: number, z: number, yaw = 0): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.waterClimbing = false;
    this.waterClimbTimer = 0;
    this.cachedWaterClimb = null;
    this.exitCover();
  }

  public isInCover(): boolean {
    return this.inCover;
  }

  public canTakeCover(): boolean {
    return !this.inCover && !this.swimming && this.grounded && this.cachedCoverCandidate !== null;
  }

  public exitCover(): void {
    this.inCover = false;
    this.coverPeeking = false;
    this.coverPeekOffset = 0;
    this.coverPullAwayTimer = 0;
  }

  /**
   * Toggles GTA-style cover against the nearest wall, car, barricade, or low ledge.
   * Returns true if cover state changed (entered or exited), false if no cover nearby.
   */
  public toggleCover(): boolean {
    if (this.inCover) {
      this.exitCover();
      return true;
    }
    if (this.swimming || !this.grounded || !this.cachedCoverCandidate) {
      return false;
    }
    const c = this.cachedCoverCandidate;
    this.inCover = true;
    this.coverPeeking = false;
    this.coverLow = c.isLow;
    this.coverAxis = c.axis;
    this.coverNormalX = c.normalX;
    this.coverNormalZ = c.normalZ;
    this.coverWallCoord = c.wallCoord;
    this.coverSpanMin = c.spanMin;
    this.coverSpanMax = c.spanMax;
    this.coverBoxMaxY = c.boxMaxY;
    this.coverPullAwayTimer = 0;
    this.velocity.set(0, 0, 0);
    // Snap cleanly onto the cover wall surface
    this.position.x = c.snapX;
    this.position.z = c.snapZ;
    return true;
  }

  private findCoverCandidate(colliders: AABB[]): typeof this.cachedCoverCandidate {
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;
    const maxDist = 1.65;
    const snapPad = this.radius + 0.08;
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);

    let best: typeof this.cachedCoverCandidate = null;
    let bestScore = Infinity;

    for (const box of colliders) {
      if (box.tag === 'npc') continue;
      // Cover must rise at least 0.72m above feet and start below chest height
      if (box.maxY < py + 0.72 || box.minY > py + 1.15) continue;
      // Quick broad-phase rejection
      if (
        px < box.minX - maxDist ||
        px > box.maxX + maxDist ||
        pz < box.minZ - maxDist ||
        pz > box.maxZ + maxDist
      ) {
        continue;
      }

      const cx = THREE.MathUtils.clamp(px, box.minX, box.maxX);
      const cz = THREE.MathUtils.clamp(pz, box.minZ, box.maxZ);
      const dx = px - cx;
      const dz = pz - cz;
      const dist = Math.hypot(dx, dz);
      if (dist > maxDist || dist < 0.001) continue;

      let axis: 'x' | 'z';
      let nx = 0;
      let nz = 0;
      let wallCoord = 0;
      let snapX = px;
      let snapZ = pz;
      let spanMin = 0;
      let spanMax = 0;

      if (Math.abs(dx) >= Math.abs(dz)) {
        axis = 'x';
        nx = dx >= 0 ? 1 : -1;
        wallCoord = nx > 0 ? box.maxX : box.minX;
        snapX = wallCoord + nx * snapPad;
        snapZ = THREE.MathUtils.clamp(pz, box.minZ + 0.2, box.maxZ - 0.2);
        spanMin = box.minZ;
        spanMax = box.maxZ;
      } else {
        axis = 'z';
        nz = dz >= 0 ? 1 : -1;
        wallCoord = nz > 0 ? box.maxZ : box.minZ;
        snapZ = wallCoord + nz * snapPad;
        snapX = THREE.MathUtils.clamp(px, box.minX + 0.2, box.maxX - 0.2);
        spanMin = box.minX;
        spanMax = box.maxX;
      }

      // Slightly prefer walls the player is facing toward (look dot -normal > 0)
      const facingWall = -(lookX * nx + lookZ * nz);
      const score = dist - facingWall * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = {
          axis,
          normalX: nx,
          normalZ: nz,
          wallCoord,
          snapX,
          snapZ,
          spanMin,
          spanMax,
          boxMaxY: box.maxY,
          isLow: box.maxY - py <= 1.68,
        };
      }
    }
    return best;
  }

  /**
   * Finds a nearby pier, quay, swim platform, or boat deck that the swimming player
   * can pull themselves up onto with [SPACE] / Gamepad A.
   */
  private findWaterClimbCandidate(colliders: AABB[]): typeof this.cachedWaterClimb {
    const px = this.position.x;
    const pz = this.position.z;
    const maxDist = 1.45;
    const lookX = -Math.sin(this.yaw);
    const lookZ = -Math.cos(this.yaw);

    let best: typeof this.cachedWaterClimb = null;
    let bestScore = Infinity;

    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (
        box.tag === 'npc' ||
        box.tag === 'bridge-rail' ||
        box.tag === 'cliff-guardrail'
      ) {
        continue;
      }
      // Reachable ledge height above ocean surface (-0.20m)
      if (box.maxY < -0.05 || box.maxY > 1.65) continue;
      // Ignore thin posts/railings
      const bw = box.maxX - box.minX;
      const bd = box.maxZ - box.minZ;
      if (bw < 0.6 || bd < 0.6) continue;

      if (
        px < box.minX - maxDist ||
        px > box.maxX + maxDist ||
        pz < box.minZ - maxDist ||
        pz > box.maxZ + maxDist
      ) {
        continue;
      }

      const cx = THREE.MathUtils.clamp(px, box.minX, box.maxX);
      const cz = THREE.MathUtils.clamp(pz, box.minZ, box.maxZ);
      const dx = cx - px;
      const dz = cz - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > maxDist) continue;

      // Compute landing point safely inside the pier/boat deck edge
      const padX = Math.min(0.42, bw * 0.4);
      const padZ = Math.min(0.42, bd * 0.4);
      let landX = cx;
      let landZ = cz;
      if (dist > 0.01) {
        landX = cx + (dx / dist) * 0.52;
        landZ = cz + (dz / dist) * 0.52;
      }
      landX = THREE.MathUtils.clamp(landX, box.minX + padX, box.maxX - padX);
      landZ = THREE.MathUtils.clamp(landZ, box.minZ + padZ, box.maxZ - padZ);

      // Ensure clear standing headroom on top of the ledge
      let blocked = false;
      for (let j = 0; j < colliders.length; j++) {
        const ob = colliders[j];
        if (ob === box || ob.tag === 'npc') continue;
        if (
          landX + 0.28 > ob.minX &&
          landX - 0.28 < ob.maxX &&
          landZ + 0.28 > ob.minZ &&
          landZ - 0.28 < ob.maxZ &&
          box.maxY + 1.55 > ob.minY &&
          box.maxY + 0.25 < ob.maxY
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      let facingDot = 0;
      if (dist > 0.01) {
        facingDot = (lookX * dx + lookZ * dz) / dist;
      }
      const isBoat = box.tag === 'boat' || (box.tag !== undefined && box.tag.startsWith('yacht') && box.tag !== 'yacht-pier');
      const score = dist - facingDot * 0.45 - (isBoat ? 0.08 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = {
          targetX: landX,
          targetY: box.maxY + 0.04,
          targetZ: landZ,
          label: isBoat ? 'BOOT' : 'STEG',
        };
      }
    }
    return best;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space' && this.getIsActive()) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.isActive || this.isLocked) return;
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    const sensitivity = 0.0022 * this.sensitivityMult;
    const maxPitch = Math.PI / 2 - 0.04;

    const ySign = this.invertY ? -1 : 1;

    if (this.isLocked) {
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity * ySign;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      return;
    }

    if (this.isActive && this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.yaw -= dx * sensitivity * 1.4;
      this.pitch -= dy * sensitivity * 1.4 * ySign;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    }
  };

  public update(
    dt: number,
    colliders: AABB[],
    pad?: GamepadSnapshot,
    getGroundHeight?: (x: number, z: number) => number,
    worldMeshes?: THREE.Object3D[],
    isAds = false,
    drunkLevel = 0,
    playerGrid?: SpatialGrid,
  ): PlayerStatus {
    const clampedDt = Math.min(dt, 0.05);
    const active = this.getIsActive();
    const maxPitch = Math.PI / 2 - 0.04;

    // Analog right-stick camera look (Gamepad)
    if (active && pad && pad.connected) {
      const lookSpeed = 3.1 * this.sensitivityMult * clampedDt;
      const ySign = this.invertY ? -1 : 1;
      this.yaw -= pad.lookX * lookSpeed;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - pad.lookY * lookSpeed * 0.82 * ySign));
    }

    // Arrow-key look fallback when not pointer-locked
    if (active && !this.isLocked) {
      const turnSpeed = 2.0 * clampedDt;
      if (this.keys.has('ArrowLeft')) this.yaw += turnSpeed;
      if (this.keys.has('ArrowRight')) this.yaw -= turnSpeed;
      if (this.keys.has('ArrowUp')) this.pitch = Math.min(maxPitch, this.pitch + turnSpeed * 0.7);
      if (this.keys.has('ArrowDown')) this.pitch = Math.max(-maxPitch, this.pitch - turnSpeed * 0.7);
    }

    const padCrouch = Boolean(pad?.connected && pad.crouch);
    // Comfortable Xbox L3 Toggle-Sprint (click L3 once while moving forward; resets when stick released)
    if (pad?.connected) {
      if (pad.sprintPressed && pad.moveY > 0.25) {
        this.padSprintToggle = !this.padSprintToggle;
      }
      if (pad.moveY <= 0.2 || padCrouch || this.inCover) {
        this.padSprintToggle = false;
      }
    } else {
      this.padSprintToggle = false;
    }
    const padSprint = Boolean(pad?.connected && (pad.sprint || this.padSprintToggle) && pad.moveY > 0.25);

    const localBoxes = playerGrid
      ? playerGrid.queryBox(
          this.position.x - 2.4,
          this.position.x + 2.4,
          this.position.z - 2.4,
          this.position.z + 2.4,
          colliders,
          this.localColliders,
        )
      : colliders;

    this.cachedCoverCandidate = !this.inCover && !this.swimming && !this.waterClimbing && this.grounded ? this.findCoverCandidate(localBoxes) : null;
    this.cachedWaterClimb = this.swimming && !this.waterClimbing ? this.findWaterClimbCandidate(localBoxes) : null;

    this.crouching = active && (this.keys.has('KeyC') || this.keys.has('ControlLeft') || padCrouch);
    const wantsSprint =
      active &&
      !this.crouching &&
      !this.inCover &&
      (((this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && this.keys.has('KeyW')) || padSprint);

    // Compute horizontal wish direction from yaw
    this.forwardVec.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.wishDir.set(0, 0, 0);

    if (active) {
      if (this.keys.has('KeyW')) this.wishDir.add(this.forwardVec);
      if (this.keys.has('KeyS')) this.wishDir.sub(this.forwardVec);
      if (this.keys.has('KeyD')) this.wishDir.add(this.rightVec);
      if (this.keys.has('KeyA')) this.wishDir.sub(this.rightVec);

      if (pad && pad.connected && (Math.abs(pad.moveX) > 0 || Math.abs(pad.moveY) > 0)) {
        this.wishDir.addScaledVector(this.forwardVec, pad.moveY);
        this.wishDir.addScaledVector(this.rightVec, pad.moveX);
      }
    }

    if (this.wishDir.lengthSq() > 1) {
      this.wishDir.normalize();
    }

    // --- GTA-Style Cover Movement, Peeking & Auto-Exit ---
    const wantsJump = this.keys.has('Space') || Boolean(pad?.connected && pad.jump);
    if (this.inCover) {
      if (!active || this.swimming || wantsJump) {
        this.exitCover();
      } else {
        // Tangent vector along cover wall
        const tanX = -this.coverNormalZ;
        const tanZ = this.coverNormalX;
        const alongInput = this.wishDir.x * tanX + this.wishDir.z * tanZ;
        const awayInput = this.wishDir.x * this.coverNormalX + this.wishDir.z * this.coverNormalZ;

        // Pulling strongly away from the cover wall exits cover smoothly
        if (awayInput > 0.65 && !isAds) {
          this.coverPullAwayTimer += clampedDt;
          if (this.coverPullAwayTimer > 0.24) {
            this.exitCover();
          }
        } else {
          this.coverPullAwayTimer = 0;
        }

        if (this.inCover) {
          this.coverLow = this.coverBoxMaxY - this.position.y <= 1.68;
          this.coverPeeking = isAds;
          // Duck behind low cover when not peeking
          this.crouching = this.coverLow && !this.coverPeeking;

          // Slide smoothly along the cover edge (zero slide while peeking so aim stays rock-steady!)
          const slideSpeed = this.coverPeeking ? 0 : 3.4;
          this.velocity.x = tanX * alongInput * slideSpeed;
          this.velocity.z = tanZ * alongInput * slideSpeed;

          // Keep hugged to the cover surface & clamped within cover span
          const snapPad = this.radius + 0.08;
          if (this.coverAxis === 'x') {
            this.position.x += (this.coverWallCoord + this.coverNormalX * snapPad - this.position.x) * (1 - Math.exp(-16 * clampedDt));
            const nextSpan = THREE.MathUtils.clamp(
              this.position.z + this.velocity.z * clampedDt,
              this.coverSpanMin + 0.25,
              this.coverSpanMax - 0.25,
            );
            this.velocity.z = (nextSpan - this.position.z) / Math.max(clampedDt, 0.001);
          } else {
            this.position.z += (this.coverWallCoord + this.coverNormalZ * snapPad - this.position.z) * (1 - Math.exp(-16 * clampedDt));
            const nextSpan = THREE.MathUtils.clamp(
              this.position.x + this.velocity.x * clampedDt,
              this.coverSpanMin + 0.25,
              this.coverSpanMax - 0.25,
            );
            this.velocity.x = (nextSpan - this.position.x) / Math.max(clampedDt, 0.001);
          }

          // Determine corner-peek lean direction for high cover (towards nearer edge or camera right)
          const curSpan = this.coverAxis === 'x' ? this.position.z : this.position.x;
          const distToMin = Math.abs(curSpan - this.coverSpanMin);
          const distToMax = Math.abs(this.coverSpanMax - curSpan);
          if (Math.min(distToMin, distToMax) < 1.35) {
            this.coverPeekDir = distToMax < distToMin ? 1 : -1;
          } else {
            const rightDotTan = this.rightVec.x * tanX + this.rightVec.z * tanZ;
            this.coverPeekDir = rightDotTan >= 0 ? 1 : -1;
          }
          const targetPeek = this.coverPeeking && !this.coverLow ? this.coverPeekDir * 0.58 : 0;
          this.coverPeekOffset += (targetPeek - this.coverPeekOffset) * (1 - Math.exp(-12 * clampedDt));
        }
      }
    } else {
      this.coverPeekOffset += (0 - this.coverPeekOffset) * (1 - Math.exp(-12 * clampedDt));
    }

    // Drunken lateral stagger only while walking (keeps standing still steady & controllable)
    if (!this.inCover && drunkLevel > 0.005 && active && this.wishDir.lengthSq() > 0.05) {
      const t = performance.now() * 0.001;
      const stagger = (Math.sin(t * 2.15) * 0.65 + Math.cos(t * 3.45) * 0.35) * drunkLevel;
      this.wishDir.addScaledVector(this.rightVec, stagger * 0.42);
      this.yaw += Math.sin(t * 1.45) * drunkLevel * 0.14 * clampedDt;
    }

    if (!this.inCover) {
      const targetSpeed = this.swimming
        ? wantsSprint
          ? 6.6
          : 4.5
        : this.crouching
          ? this.crouchSpeed
          : wantsSprint
            ? this.sprintSpeed
            : this.walkSpeed;

      const targetVx = this.wishDir.x * targetSpeed;
      const targetVz = this.wishDir.z * targetSpeed;
      const accel = this.swimming ? 5.2 : this.grounded ? this.accelGround : this.accelAir;
      const blend = 1 - Math.exp(-accel * clampedDt);

      this.velocity.x += (targetVx - this.velocity.x) * blend;
      this.velocity.z += (targetVz - this.velocity.z) * blend;
    }

    // Jump (Space or Gamepad A) — or pull up onto a nearby pier/boat when swimming!
    if (active && this.swimming && !this.waterClimbing && wantsJump && this.cachedWaterClimb) {
      this.waterClimbing = true;
      this.waterClimbTimer = 0;
      this.climbStart.copy(this.position);
      this.climbEnd.set(
        this.cachedWaterClimb.targetX,
        this.cachedWaterClimb.targetY,
        this.cachedWaterClimb.targetZ,
      );
      this.velocity.set(0, 0, 0);
      this.cachedWaterClimb = null;
    } else if (active && this.grounded && wantsJump && !this.crouching && !this.swimming && !this.inCover && !this.waterClimbing) {
      this.velocity.y = this.jumpSpeed;
      this.grounded = false;
    }

    // Smooth mantle / pull-up from ocean onto pier or boat deck
    if (this.waterClimbing) {
      this.waterClimbTimer += clampedDt;
      const t = Math.min(1, this.waterClimbTimer / this.waterClimbDuration);
      const hT = t * t * (3 - 2 * t);
      const vT = Math.min(1, t / 0.65);
      const vEase = 1 - (1 - vT) * (1 - vT);
      const vaultArc = Math.sin(t * Math.PI) * 0.16;

      this.position.set(
        THREE.MathUtils.lerp(this.climbStart.x, this.climbEnd.x, hT),
        THREE.MathUtils.lerp(this.climbStart.y, this.climbEnd.y, vEase) + vaultArc,
        THREE.MathUtils.lerp(this.climbStart.z, this.climbEnd.z, hT),
      );
      this.velocity.set(0, 0, 0);

      if (t >= 1) {
        this.waterClimbing = false;
        this.swimming = false;
        this.grounded = true;
        this.position.copy(this.climbEnd);
      }
    } else {
      // Gravity vs. realistic ocean buoyancy when swimming in deep water
      const WATER_SURFACE_Y = -0.2;
      const SWIM_FLOAT_Y = WATER_SURFACE_Y - 1.28; // -1.48m -> shoulders & head float right at the ocean surface!
      if (this.swimming) {
        // Spring-damped buoyancy pulls the player smoothly to the water surface (even after diving off a pier or cliff!)
        const depthBelowFloat = SWIM_FLOAT_Y - this.position.y;
        this.velocity.y += depthBelowFloat * 14.0 * clampedDt;
        this.velocity.y *= Math.exp(-5.5 * clampedDt);
      } else {
        this.velocity.y -= this.gravity * clampedDt;
      }

      // Integrate tentative position
      const nextX = THREE.MathUtils.clamp(
        this.position.x + this.velocity.x * clampedDt,
        this.worldBounds.minX,
        this.worldBounds.maxX,
      );
      const nextY = this.position.y + this.velocity.y * clampedDt;
      const nextZ = THREE.MathUtils.clamp(
        this.position.z + this.velocity.z * clampedDt,
        this.worldBounds.minZ,
        this.worldBounds.maxZ,
      );

      const activeHeight = this.crouching ? this.crouchHeight : this.standHeight;
      const baseGroundY = getGroundHeight ? getGroundHeight(nextX, nextZ) : 0;
      const resolved = resolvePlayerCollisions(
        nextX,
        nextY,
        nextZ,
        this.velocity.y,
        this.radius,
        activeHeight,
        localBoxes,
        0.28,
        baseGroundY,
      );

      this.position.set(resolved.x, resolved.y, resolved.z);
      this.velocity.y = resolved.vy;
      this.grounded = resolved.grounded;

      // Enter swimming mode whenever seabed is deep enough (chest-deep / open ocean) and player is in the water
      const inDeepWater = baseGroundY < WATER_SURFACE_Y - 0.85 && this.position.y < WATER_SURFACE_Y - 0.2;
      if (inDeepWater) {
        this.swimming = true;
        this.grounded = false;
        // Gently clamp max submerge depth so diving off the 11m cliff feels great without hitting the floor
        if (this.position.y < baseGroundY + 0.1) {
          this.position.y = baseGroundY + 0.1;
          this.velocity.y = Math.max(0, this.velocity.y);
        }
      } else {
        this.swimming = false;
      }
    }

    // Smooth eye height & subtle head-bob (or rhythmic freestyle swim bobbing at water surface!)
    const targetEye = this.swimming ? 1.52 : this.crouching ? this.crouchEye : this.standEye;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * (1 - Math.exp(-10 * clampedDt));

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let bobOffsetY = 0;
    let bobOffsetX = 0;
    let swimRoll = 0;
    if (this.swimming) {
      const strokeRate = horizSpeed > 0.6 ? (wantsSprint ? 6.8 : 4.8) : 2.2;
      this.swimTimer += clampedDt * strokeRate;
      bobOffsetY = Math.sin(this.swimTimer) * (horizSpeed > 0.6 ? 0.085 : 0.045);
      bobOffsetX = Math.cos(this.swimTimer * 0.5) * (horizSpeed > 0.6 ? 0.06 : 0.02);
      swimRoll = horizSpeed > 0.6 ? Math.sin(this.swimTimer * 0.5) * 0.045 : 0;
    } else if (this.grounded && horizSpeed > 0.6) {
      const bobFreq = wantsSprint ? 13.5 : 9.2;
      const bobAmp = wantsSprint ? 0.065 : 0.038;
      this.bobTimer += clampedDt * bobFreq;
      bobOffsetY = Math.sin(this.bobTimer) * bobAmp;
      bobOffsetX = Math.cos(this.bobTimer * 0.5) * bobAmp * 0.45;
    } else {
      this.bobTimer = 0;
    }

    // Corner-peek world offset along the cover wall tangent
    const peekTanX = -this.coverNormalZ * this.coverPeekOffset;
    const peekTanZ = this.coverNormalX * this.coverPeekOffset;

    if (this.thirdPerson) {
      // GTA Over-the-Shoulder 3rd-Person Camera with wall-clip avoidance
      const shoulderShift = this.inCover ? 0.65 : 0.52;
      const pivot = this.tmpPivot.set(
        this.position.x + this.rightVec.x * shoulderShift + peekTanX,
        this.position.y + this.currentEyeHeight + 0.08,
        this.position.z + this.rightVec.z * shoulderShift + peekTanZ,
      );
      this.tmpCamEuler.set(this.pitch, this.yaw, 0, 'YXZ');
      const lookDir = this.tmpLookDir.set(0, 0, -1).applyEuler(this.tmpCamEuler);
      const desiredDist = isAds ? 2.15 : this.inCover ? 3.05 : 3.55;
      const backDir = this.tmpBackDir.copy(lookDir).negate();

      let actualDist = desiredDist;
      if (worldMeshes && worldMeshes.length > 0) {
        this.camRaycaster.set(pivot, backDir);
        this.camRaycaster.far = desiredDist + 0.3;
        const hits = this.camRaycaster.intersectObjects(worldMeshes, false);
        if (hits.length > 0) {
          actualDist = Math.max(0.75, hits[0].distance - 0.28);
        }
      }

      this.camera.position.copy(pivot).addScaledVector(backDir, actualDist);
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = 0;
    } else {
      this.camera.position.set(
        this.position.x + this.rightVec.x * bobOffsetX + peekTanX,
        this.position.y + this.currentEyeHeight + bobOffsetY,
        this.position.z + this.rightVec.z * bobOffsetX + peekTanZ,
      );
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.z = swimRoll;
    }

    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      speed: horizSpeed,
      grounded: this.grounded,
      sprinting: wantsSprint && horizSpeed > 1.0,
      crouching: this.crouching,
      swimming: this.swimming,
      inCover: this.inCover,
      coverPeeking: this.coverPeeking,
      coverLow: this.coverLow,
      coverNormalX: this.coverNormalX,
      coverNormalZ: this.coverNormalZ,
      canTakeCover: this.canTakeCover(),
      waterClimbLabel: this.cachedWaterClimb ? this.cachedWaterClimb.label : null,
    };
  }
}
