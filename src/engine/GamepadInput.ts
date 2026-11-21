export interface GamepadSnapshot {
  connected: boolean;
  name: string;
  // Analog axes (-1..1)
  moveX: number;
  moveY: number; // +1 = forward, -1 = backward
  lookX: number;
  lookY: number;
  // Analog triggers (0..1)
  rt: number;
  lt: number;
  // Held buttons
  jump: boolean;
  handbrake: boolean;
  sprint: boolean;
  crouch: boolean;
  // Edge-triggered (just pressed this frame)
  interactPressed: boolean; // Y / Triangle
  reloadOrSprayPressed: boolean; // X / Square
  prevWeaponPressed: boolean; // LB
  nextWeaponPressed: boolean; // RB
  camTogglePressed: boolean; // D-Pad Right
  timeCyclePressed: boolean; // D-Pad Up
  rainTogglePressed: boolean; // D-Pad Down
  startPressed: boolean; // Start / Options
}

function deadzone(val: number, dz = 0.16): number {
  if (Math.abs(val) < dz) return 0;
  return (val - Math.sign(val) * dz) / (1 - dz);
}

/**
 * Standard Browser Gamepad API poller (Xbox / PlayStation DualSense & DualShock).
 */
export class GamepadInput {
  private prevButtons: boolean[] = [];

  public poll(): GamepadSnapshot {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i]!.connected) {
        pad = pads[i];
        break;
      }
    }

    if (!pad) {
      this.prevButtons = [];
      return {
        connected: false,
        name: '',
        moveX: 0,
        moveY: 0,
        lookX: 0,
        lookY: 0,
        rt: 0,
        lt: 0,
        jump: false,
        handbrake: false,
        sprint: false,
        crouch: false,
        interactPressed: false,
        reloadOrSprayPressed: false,
        prevWeaponPressed: false,
        nextWeaponPressed: false,
        camTogglePressed: false,
        timeCyclePressed: false,
        rainTogglePressed: false,
        startPressed: false,
      };
    }

    const btn = (idx: number): boolean => Boolean(pad!.buttons[idx]?.pressed);
    const val = (idx: number): number => pad!.buttons[idx]?.value ?? 0;
    const justPressed = (idx: number): boolean => btn(idx) && !this.prevButtons[idx];

    const snap: GamepadSnapshot = {
      connected: true,
      name: pad.id,
      moveX: deadzone(pad.axes[0] ?? 0),
      moveY: deadzone(-(pad.axes[1] ?? 0)), // up on stick = +1 forward
      lookX: deadzone(pad.axes[2] ?? 0),
      lookY: deadzone(pad.axes[3] ?? 0),
      rt: val(7),
      lt: val(6),
      jump: btn(0),
      handbrake: btn(0),
      sprint: btn(10),
      crouch: btn(1),
      interactPressed: justPressed(3),
      reloadOrSprayPressed: justPressed(2),
      prevWeaponPressed: justPressed(4),
      nextWeaponPressed: justPressed(5),
      camTogglePressed: justPressed(15),
      timeCyclePressed: justPressed(12),
      rainTogglePressed: justPressed(13),
      startPressed: justPressed(9),
    };

    this.prevButtons = pad.buttons.map((b) => b.pressed);
    return snap;
  }
}
