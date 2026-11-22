export interface GamepadSnapshot {
  connected: boolean;
  name: string;
  diagnostic: string;
  // Analog axes (-1..1, radial deadzone)
  moveX: number;
  moveY: number; // +1 = forward, -1 = backward
  lookX: number;
  lookY: number;
  // Analog triggers (0..1, deadzoned)
  rt: number;
  lt: number;
  // Held buttons
  jump: boolean; // A
  handbrake: boolean; // A
  sprint: boolean; // L3 held
  crouch: boolean; // B held
  rbHeld: boolean; // RB held (full-auto Drive-By in vehicles)
  // Edge-triggered (just pressed this frame)
  aPressed: boolean; // A (Start from title / confirm)
  bPressed: boolean; // B (Close modals / back)
  sprintPressed: boolean; // L3 click (Toggle sprint)
  coverPressed: boolean; // R3 click (Toggle GTA cover)
  interactPressed: boolean; // Y (Enter/exit vehicle, doors, shops)
  reloadOrSprayPressed: boolean; // X (Reload / Pay 'n' Spray)
  prevWeaponPressed: boolean; // LB (Prev weapon / Radio)
  nextWeaponPressed: boolean; // RB (Next weapon)
  phonePressed: boolean; // D-Pad Left (Mission Phone)
  camTogglePressed: boolean; // View/Back OR D-Pad Right (1st/3rd person)
  timeCyclePressed: boolean; // D-Pad Up
  rainTogglePressed: boolean; // D-Pad Down
  startPressed: boolean; // Menu/Start (Pause / Resume)
}

function radialStick(x: number, y: number, dz = 0.15, exponent = 1.0): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const mag = Math.hypot(x, y);
  if (mag < dz) return [0, 0];
  const norm = Math.min(1, (mag - dz) / (1 - dz));
  const curved = exponent === 1.0 ? norm : Math.pow(norm, exponent);
  const scale = curved / mag;
  return [x * scale, y * scale];
}

function triggerDeadzone(val: number, dz = 0.06): number {
  if (!Number.isFinite(val) || val < dz) return 0;
  return Math.min(1, (val - dz) / (1 - dz));
}

function emptySnapshot(diagnostic: string): GamepadSnapshot {
  return {
    connected: false,
    name: '',
    diagnostic,
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
    rbHeld: false,
    aPressed: false,
    bPressed: false,
    sprintPressed: false,
    coverPressed: false,
    interactPressed: false,
    reloadOrSprayPressed: false,
    prevWeaponPressed: false,
    nextWeaponPressed: false,
    phonePressed: false,
    camTogglePressed: false,
    timeCyclePressed: false,
    rainTogglePressed: false,
    startPressed: false,
  };
}

/**
 * Browser Gamepad API poller (Xbox Series/One/360 & PlayStation DualSense/DualShock).
 * - Polls and merges ALL connected gamepads simultaneously so virtual HID devices at slot 0
 *   (vJoy, Steam Virtual Pad, Razer keypad, pedals) can NEVER block a real Xbox controller at slot 1..3!
 * - Surfaces clear German diagnostics if blocked by iframe Permissions-Policy or non-secure origin.
 */
export class GamepadInput {
  private readonly prevButtonsBySlot = new Map<number, boolean[]>();
  private readonly eventPads = new Map<number, Gamepad>();

  constructor() {
    window.addEventListener('gamepadconnected', (e) => {
      this.eventPads.set(e.gamepad.index, e.gamepad);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      this.prevButtonsBySlot.delete(e.gamepad.index);
      this.eventPads.delete(e.gamepad.index);
    });
  }

  public poll(): GamepadSnapshot {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      return emptySnapshot(
        'Controller vom Browser blockiert (unsichere URL) — bitte über http://localhost:5173 öffnen!',
      );
    }

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return emptySnapshot('Gamepad-API in diesem Browser nicht verfügbar.');
    }

    let rawPads: (Gamepad | null)[];
    try {
      rawPads = Array.from(navigator.getGamepads());
    } catch {
      return emptySnapshot(
        'Controller durch Vorschau-Iframe blockiert — bitte http://localhost:5173 direkt in Chrome/Edge öffnen!',
      );
    }

    const connectedPads = rawPads.filter((p): p is Gamepad => Boolean(p && p.connected));
    if (connectedPads.length === 0 && this.eventPads.size > 0) {
      for (const ep of this.eventPads.values()) {
        if (ep.connected) connectedPads.push(ep);
      }
    }
    if (connectedPads.length === 0) {
      this.prevButtonsBySlot.clear();
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      return emptySnapshot(
        inIframe
          ? 'Kein Controller erkannt (Vorschau-Iframe blockiert evtl. Gamepads — bitte in Chrome/Edge öffnen & [A] drücken)'
          : 'Controller: noch nicht aktiv — einmal ins Spiel klicken & am Controller [A] drücken',
      );
    }

    let primaryName = connectedPads[0].id;
    let bestMoveX = 0;
    let bestMoveY = 0;
    let bestMoveMag = 0;
    let bestLookX = 0;
    let bestLookY = 0;
    let bestLookMag = 0;
    let maxRt = 0;
    let maxLt = 0;

    let jump = false;
    let handbrake = false;
    let sprint = false;
    let crouch = false;
    let rbHeld = false;

    let aPressed = false;
    let bPressed = false;
    let sprintPressed = false;
    let coverPressed = false;
    let interactPressed = false;
    let reloadOrSprayPressed = false;
    let prevWeaponPressed = false;
    let nextWeaponPressed = false;
    let phonePressed = false;
    let camTogglePressed = false;
    let timeCyclePressed = false;
    let rainTogglePressed = false;
    let startPressed = false;

    const pressedDebug: string[] = [];

    for (const pad of connectedPads) {
      const slot = pad.index;
      const prev = this.prevButtonsBySlot.get(slot) ?? [];

      const btn = (idx: number): boolean => Boolean(pad.buttons[idx]?.pressed);
      const val = (idx: number): number => pad.buttons[idx]?.value ?? 0;
      const justPressed = (idx: number): boolean => btn(idx) && !prev[idx];

      if (/xbox|xinput|045e|wireless controller/i.test(pad.id) || pad.mapping === 'standard') {
        primaryName = pad.id;
      }

      // Left movement stick (axes 0, 1) + D-Pad Left/Right/Up/Down fallback for movement if desired?
      // Keep D-Pad reserved for actions, read analog left stick on pads with >= 2 axes
      if (pad.axes.length >= 2) {
        const [mx, my] = radialStick(pad.axes[0] ?? 0, -(pad.axes[1] ?? 0), 0.15, 1.0);
        const mMag = Math.hypot(mx, my);
        if (mMag > bestMoveMag) {
          bestMoveMag = mMag;
          bestMoveX = mx;
          bestMoveY = my;
        }
      }

      // Right camera look stick:
      // - Standard mapping (Xbox in Chrome/Edge): axes[2] (X), axes[3] (Y)
      // - DirectInput / Bluetooth non-standard fallback when axes.length >= 6 and mapping !== 'standard':
      //   some drivers put right stick on axes[2]/axes[5] while axes[3]/axes[4] rest at -1!
      if (pad.axes.length >= 4) {
        let rawRx = pad.axes[2] ?? 0;
        let rawRy = pad.axes[3] ?? 0;
        if (pad.mapping !== 'standard' && pad.axes.length >= 6 && Math.abs(rawRy + 1) < 0.02) {
          rawRy = pad.axes[5] ?? 0;
        }
        // Ignore stuck resting +/-1 axes on non-standard virtual HID devices
        const looksLikeStuckVirtualAxis =
          pad.mapping !== 'standard' &&
          (Math.abs(Math.abs(rawRx) - 1) < 0.005 || Math.abs(Math.abs(rawRy) - 1) < 0.005);
        if (!looksLikeStuckVirtualAxis) {
          const [lx, ly] = radialStick(rawRx, rawRy, 0.15, 1.65);
          const lMag = Math.hypot(lx, ly);
          if (lMag > bestLookMag) {
            bestLookMag = lMag;
            bestLookX = lx;
            bestLookY = ly;
          }
        }
      }

      // Analog triggers LT (6) & RT (7)
      let padLt = triggerDeadzone(val(6));
      let padRt = triggerDeadzone(val(7));
      if (padLt === 0 && btn(6)) padLt = 1;
      if (padRt === 0 && btn(7)) padRt = 1;
      maxLt = Math.max(maxLt, padLt);
      maxRt = Math.max(maxRt, padRt);

      jump = jump || btn(0);
      handbrake = handbrake || btn(0);
      sprint = sprint || btn(10);
      crouch = crouch || btn(1);
      rbHeld = rbHeld || btn(5);

      aPressed = aPressed || justPressed(0);
      bPressed = bPressed || justPressed(1);
      sprintPressed = sprintPressed || justPressed(10);
      coverPressed = coverPressed || justPressed(11);
      interactPressed = interactPressed || justPressed(3);
      reloadOrSprayPressed = reloadOrSprayPressed || justPressed(2);
      prevWeaponPressed = prevWeaponPressed || justPressed(4);
      nextWeaponPressed = nextWeaponPressed || justPressed(5);
      phonePressed = phonePressed || justPressed(14);
      camTogglePressed = camTogglePressed || justPressed(8) || justPressed(15);
      timeCyclePressed = timeCyclePressed || justPressed(12);
      rainTogglePressed = rainTogglePressed || justPressed(13);
      startPressed = startPressed || justPressed(9);

      for (let bi = 0; bi < pad.buttons.length; bi++) {
        if (pad.buttons[bi]?.pressed) pressedDebug.push(`B${bi}`);
      }

      this.prevButtonsBySlot.set(
        slot,
        pad.buttons.map((b) => b.pressed),
      );
    }

    const shortName = primaryName.replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 34) || 'Gamepad';
    const liveSuffix =
      pressedDebug.length > 0
        ? ` · Taste: ${pressedDebug.slice(0, 3).join('+')}`
        : bestMoveMag > 0.05 || bestLookMag > 0.05
          ? ' · Stick aktiv'
          : '';

    return {
      connected: true,
      name: primaryName,
      diagnostic: `Controller aktiv (${connectedPads.length}): ${shortName}${liveSuffix}`,
      moveX: bestMoveX,
      moveY: bestMoveY,
      lookX: bestLookX,
      lookY: bestLookY,
      rt: maxRt,
      lt: maxLt,
      jump,
      handbrake,
      sprint,
      crouch,
      rbHeld,
      aPressed,
      bPressed,
      sprintPressed,
      coverPressed,
      interactPressed,
      reloadOrSprayPressed,
      prevWeaponPressed,
      nextWeaponPressed,
      phonePressed,
      camTogglePressed,
      timeCyclePressed,
      rainTogglePressed,
      startPressed,
    };
  }
}
