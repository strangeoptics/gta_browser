import type { GamepadSnapshot } from './GamepadInput';

/**
 * Mobile / Tablet Touch Controls that emit the same `GamepadSnapshot` interface
 * as hardware controllers so PlayerController, WeaponSystem, VehicleSystem & BoatSystem
 * work seamlessly on phones/tablets without affecting desktop users.
 */
export class TouchControls {
  public readonly isTouchDevice: boolean;
  private moveX = 0;
  private moveY = 0;
  private lookX = 0;
  private lookY = 0;
  private fireHeld = false;
  private brakeHeld = false;
  private jumpHeld = false;
  private interactQueued = false;
  private nextWeaponQueued = false;

  private stickTouchId: number | null = null;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private lookTouchId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement) {
    this.isTouchDevice =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    if (!this.isTouchDevice) {
      container.style.display = 'none';
      return;
    }

    container.classList.add('touch-enabled');

    const stickZone = document.getElementById('touch-stick-zone') as HTMLDivElement;
    const stickKnob = document.getElementById('touch-stick-knob') as HTMLDivElement;
    const btnFire = document.getElementById('touch-fire') as HTMLButtonElement;
    const btnBrake = document.getElementById('touch-brake') as HTMLButtonElement;
    const btnJump = document.getElementById('touch-jump') as HTMLButtonElement;
    const btnEnter = document.getElementById('touch-enter') as HTMLButtonElement;
    const btnWpn = document.getElementById('touch-wpn') as HTMLButtonElement;

    const maxR = 42;

    stickZone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this.stickTouchId = t.identifier;
        const rect = stickZone.getBoundingClientRect();
        this.stickOriginX = rect.left + rect.width / 2;
        this.stickOriginY = rect.top + rect.height / 2;
        this.updateStick(t.clientX, t.clientY, maxR, stickKnob);
      },
      { passive: false },
    );

    stickZone.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.stickTouchId) {
            this.updateStick(t.clientX, t.clientY, maxR, stickKnob);
          }
        }
      },
      { passive: false },
    );

    const endStick = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.stickTouchId) {
          this.stickTouchId = null;
          this.moveX = 0;
          this.moveY = 0;
          stickKnob.style.transform = 'translate(-50%, -50%)';
        }
      }
    };
    stickZone.addEventListener('touchend', endStick);
    stickZone.addEventListener('touchcancel', endStick);

    // Right-half canvas drag to look around
    canvas.addEventListener(
      'touchstart',
      (e) => {
        const t = e.changedTouches[0];
        if (this.lookTouchId === null && t.clientX > window.innerWidth * 0.4) {
          this.lookTouchId = t.identifier;
          this.lastLookX = t.clientX;
          this.lastLookY = t.clientY;
        }
      },
      { passive: true },
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.lookTouchId) {
            this.lookX = Math.max(-1, Math.min(1, (t.clientX - this.lastLookX) * 0.08));
            this.lookY = Math.max(-1, Math.min(1, (t.clientY - this.lastLookY) * 0.08));
            this.lastLookX = t.clientX;
            this.lastLookY = t.clientY;
          }
        }
      },
      { passive: true },
    );

    const endLook = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.lookTouchId) {
          this.lookTouchId = null;
          this.lookX = 0;
          this.lookY = 0;
        }
      }
    };
    canvas.addEventListener('touchend', endLook);
    canvas.addEventListener('touchcancel', endLook);

    const bindHold = (el: HTMLElement, setter: (v: boolean) => void) => {
      el.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          setter(true);
        },
        { passive: false },
      );
      el.addEventListener('touchend', () => setter(false));
      el.addEventListener('touchcancel', () => setter(false));
    };

    bindHold(btnFire, (v) => (this.fireHeld = v));
    bindHold(btnBrake, (v) => (this.brakeHeld = v));
    bindHold(btnJump, (v) => (this.jumpHeld = v));

    btnEnter.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.interactQueued = true;
      },
      { passive: false },
    );
    btnWpn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.nextWeaponQueued = true;
      },
      { passive: false },
    );
  }

  private updateStick(cx: number, cy: number, maxR: number, knob: HTMLDivElement): void {
    let dx = cx - this.stickOriginX;
    let dy = cy - this.stickOriginY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    this.moveX = dx / maxR;
    this.moveY = -dy / maxR;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  public mergeInto(pad: GamepadSnapshot): GamepadSnapshot {
    if (!this.isTouchDevice) return pad;

    const interact = pad.interactPressed || this.interactQueued;
    const nextWpn = pad.nextWeaponPressed || this.nextWeaponQueued;
    const lx = this.lookX;
    const ly = this.lookY;

    this.interactQueued = false;
    this.nextWeaponQueued = false;
    this.lookX = 0;
    this.lookY = 0;

    return {
      ...pad,
      connected: true,
      moveX: pad.connected && Math.abs(pad.moveX) > 0 ? pad.moveX : this.moveX,
      moveY: pad.connected && Math.abs(pad.moveY) > 0 ? pad.moveY : this.moveY,
      lookX: pad.connected && Math.abs(pad.lookX) > 0 ? pad.lookX : lx,
      lookY: pad.connected && Math.abs(pad.lookY) > 0 ? pad.lookY : ly,
      rt: Math.max(pad.rt, this.fireHeld ? 1 : 0),
      lt: Math.max(pad.lt, this.brakeHeld ? 1 : 0),
      jump: pad.jump || this.jumpHeld,
      handbrake: pad.handbrake || this.jumpHeld,
      interactPressed: interact,
      nextWeaponPressed: nextWpn,
    };
  }
}
