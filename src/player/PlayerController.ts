import * as THREE from 'three';
import { resolvePlayerCollisions } from '../engine/Physics';
import type { GamepadSnapshot } from '../engine/GamepadInput';
import type { AABB, PlayerStatus } from '../types';

export class PlayerController {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly position = new THREE.Vector3(0, 0.18, 12);
  public readonly velocity = new THREE.Vector3();

  private yaw = 0;
  private pitch = 0;
  private sensitivityMult = 1.0;

  private readonly keys = new Set<string>();
  private isLocked = false;
  private isActive = false;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private grounded = false;
  private crouching = false;
  private thirdPerson = false;
  private readonly camRaycaster = new THREE.Raycaster();

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

    if (this.isLocked) {
      this.yaw -= e.movementX * sensitivity;
      this.pitch -= e.movementY * sensitivity;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      return;
    }

    if (this.isActive && this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.yaw -= dx * sensitivity * 1.4;
      this.pitch -= dy * sensitivity * 1.4;
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
  ): PlayerStatus {
    const clampedDt = Math.min(dt, 0.05);
    const active = this.getIsActive();
    const maxPitch = Math.PI / 2 - 0.04;

    // Analog right-stick camera look (Gamepad)
    if (active && pad && pad.connected) {
      const lookSpeed = 2.6 * this.sensitivityMult * clampedDt;
      this.yaw -= pad.lookX * lookSpeed;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch - pad.lookY * lookSpeed * 0.8));
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
    const padSprint = Boolean(pad?.connected && pad.sprint && pad.moveY > 0.25);

    this.crouching = active && (this.keys.has('KeyC') || this.keys.has('ControlLeft') || padCrouch);
    const wantsSprint =
      active &&
      !this.crouching &&
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

    const targetSpeed = this.crouching
      ? this.crouchSpeed
      : wantsSprint
        ? this.sprintSpeed
        : this.walkSpeed;

    const targetVx = this.wishDir.x * targetSpeed;
    const targetVz = this.wishDir.z * targetSpeed;
    const accel = this.grounded ? this.accelGround : this.accelAir;
    const blend = 1 - Math.exp(-accel * clampedDt);

    this.velocity.x += (targetVx - this.velocity.x) * blend;
    this.velocity.z += (targetVz - this.velocity.z) * blend;

    // Jump (Space or Gamepad A)
    const wantsJump = this.keys.has('Space') || Boolean(pad?.connected && pad.jump);
    if (active && this.grounded && wantsJump && !this.crouching) {
      this.velocity.y = this.jumpSpeed;
      this.grounded = false;
    }

    // Gravity
    this.velocity.y -= this.gravity * clampedDt;

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
      colliders,
      0.28,
      baseGroundY,
    );

    this.position.set(resolved.x, resolved.y, resolved.z);
    this.velocity.y = resolved.vy;
    this.grounded = resolved.grounded;

    // Smooth eye height & subtle head-bob
    const targetEye = this.crouching ? this.crouchEye : this.standEye;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * (1 - Math.exp(-12 * clampedDt));

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let bobOffsetY = 0;
    let bobOffsetX = 0;
    if (this.grounded && horizSpeed > 0.6) {
      const bobFreq = wantsSprint ? 13.5 : 9.2;
      const bobAmp = wantsSprint ? 0.065 : 0.038;
      this.bobTimer += clampedDt * bobFreq;
      bobOffsetY = Math.sin(this.bobTimer) * bobAmp;
      bobOffsetX = Math.cos(this.bobTimer * 0.5) * bobAmp * 0.45;
    } else {
      this.bobTimer = 0;
    }

    if (this.thirdPerson) {
      // GTA Over-the-Shoulder 3rd-Person Camera with wall-clip avoidance
      const pivot = new THREE.Vector3(
        this.position.x + this.rightVec.x * 0.52,
        this.position.y + this.currentEyeHeight + 0.08,
        this.position.z + this.rightVec.z * 0.52,
      );
      const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const desiredDist = isAds ? 2.15 : 3.55;
      const backDir = lookDir.clone().negate();

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
    } else {
      this.camera.position.set(
        this.position.x + this.rightVec.x * bobOffsetX,
        this.position.y + this.currentEyeHeight + bobOffsetY,
        this.position.z + this.rightVec.z * bobOffsetX,
      );
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    }

    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      speed: horizSpeed,
      grounded: this.grounded,
      sprinting: wantsSprint && horizSpeed > 1.0,
      crouching: this.crouching,
    };
  }
}
