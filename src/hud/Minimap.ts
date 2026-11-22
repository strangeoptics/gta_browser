import type { CityLayout } from '../world/CityLayout';
import type { Vehicle } from '../vehicles/VehicleSystem';
import type { NpcEntity } from '../entities/NpcSystem';
import type { ActiveObjective } from '../gameplay/ObjectiveSystem';

const STATIC_MIN_X = -200;
const STATIC_MAX_X = 340;
const STATIC_MIN_Z = -260;
const STATIC_MAX_Z = 240;

export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;
  private readonly half: number;
  private readonly scale = 1.05; // pixels per world meter
  private lastRenderElapsed = -1;
  private staticCanvas: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.size = canvas.width;
    this.half = this.size / 2;
  }

  private ensureStaticMap(layout: CityLayout): HTMLCanvasElement {
    if (this.staticCanvas) return this.staticCanvas;
    const scale = this.scale;
    const c = document.createElement('canvas');
    c.width = Math.ceil((STATIC_MAX_X - STATIC_MIN_X) * scale);
    c.height = Math.ceil((STATIC_MAX_Z - STATIC_MIN_Z) * scale);
    const sctx = c.getContext('2d')!;

    const wx = (x: number) => (x - STATIC_MIN_X) * scale;
    const wz = (z: number) => (z - STATIC_MIN_Z) * scale;

    // Ocean & beach on East (+X) + Northern Bay (z < -96) + Causeway Bridge & Starfish Island
    sctx.fillStyle = 'rgba(201, 166, 132, 0.25)';
    sctx.fillRect(wx(74), wz(STATIC_MIN_Z), 36 * scale, (STATIC_MAX_Z - STATIC_MIN_Z) * scale);
    sctx.fillStyle = 'rgba(34, 110, 145, 0.45)';
    sctx.fillRect(wx(108), wz(STATIC_MIN_Z), (STATIC_MAX_X - 108) * scale, (STATIC_MAX_Z - STATIC_MIN_Z) * scale);
    // Northern Bay Ocean (z = -240..-96)
    sctx.fillRect(wx(-180), wz(-240), 288 * scale, 144 * scale);

    // North Point Coastal Highway (z = -88..-74, x = -124..+74) & Cape Vice Lighthouse Peninsula
    sctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    sctx.fillRect(wx(-124), wz(-89), 198 * scale, 15 * scale);
    // Vice Marina Wooden Piers (x = -36, -8, +20; z = -124..-98)
    sctx.fillStyle = 'rgba(180, 142, 102, 0.65)';
    for (const px of [-36, -8, 20]) {
      sctx.fillRect(wx(px - 1.8), wz(-124), 3.6 * scale, 26 * scale);
    }
    // Cape Vice 11m Sea Cliff Plateau (center 78, -114, r = 16.5) & Winding Serpentine Road
    sctx.fillStyle = 'rgba(156, 137, 116, 0.55)';
    sctx.strokeStyle = 'rgba(235, 208, 162, 0.5)';
    sctx.lineWidth = 1.5;
    sctx.beginPath();
    sctx.arc(wx(78), wz(-114), 16.5 * scale, 0, Math.PI * 2);
    sctx.fill();
    sctx.stroke();

    // Winding Serpentine Coastal Road climbing around the East Cliff
    sctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    sctx.lineWidth = 7.4 * scale;
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    const serpPts: [number, number][] = [
      [44, -82],
      [56, -83],
      [70, -86],
      [86, -90],
      [98, -98],
      [99, -111],
      [94, -123],
      [84, -127.5],
      [78, -121.5],
    ];
    sctx.beginPath();
    serpPts.forEach(([sx, sz], idx) => {
      if (idx === 0) sctx.moveTo(wx(sx), wz(sz));
      else sctx.lineTo(wx(sx), wz(sz));
    });
    sctx.stroke();

    // Causeway Bridge (x = 66..148, z = -60)
    sctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    sctx.fillRect(wx(66), wz(-65.7), 82 * scale, 11.4 * scale);

    // Starfish Island (x = 148..198, z = -84..-20)
    sctx.fillStyle = 'rgba(72, 168, 118, 0.45)';
    sctx.strokeStyle = 'rgba(235, 208, 162, 0.55)';
    sctx.lineWidth = 1.5;
    sctx.fillRect(wx(148), wz(-84), 50 * scale, 64 * scale);
    sctx.strokeRect(wx(148), wz(-84), 50 * scale, 64 * scale);

    // Smuggler's Cay & Offshore Rig 86 (SE Ocean: center 162, 96)
    sctx.fillStyle = 'rgba(78, 158, 108, 0.52)';
    sctx.strokeStyle = 'rgba(235, 208, 162, 0.65)';
    sctx.lineWidth = 1.6;
    sctx.beginPath();
    sctx.ellipse(wx(162), wz(96), 23 * scale, 21 * scale, 0, 0, Math.PI * 2);
    sctx.fill();
    sctx.stroke();
    // Wooden Boat Jetty (x = 126..145, z = 96)
    sctx.fillStyle = 'rgba(184, 142, 98, 0.8)';
    sctx.fillRect(wx(126), wz(94), 19 * scale, 4 * scale);
    sctx.fillRect(wx(126), wz(90), 3.4 * scale, 12 * scale);
    // Offshore Steel Rig Helipad (163, 118)
    sctx.fillStyle = 'rgba(84, 92, 106, 0.78)';
    sctx.fillRect(wx(156), wz(111), 14 * scale, 14 * scale);
    sctx.strokeStyle = 'rgba(255, 209, 92, 0.85)';
    sctx.lineWidth = 1.3;
    sctx.beginPath();
    sctx.arc(wx(163), wz(118), 5 * scale, 0, Math.PI * 2);
    sctx.stroke();

    // Vice Port Industrial Docks (x = -68..78, z = 66..126) & Cargo Freighter (x = -21..37, z = 128..142)
    sctx.fillStyle = 'rgba(92, 96, 110, 0.45)';
    sctx.fillRect(wx(-68), wz(66), 146 * scale, 60 * scale);
    sctx.fillStyle = 'rgba(184, 58, 48, 0.65)';
    sctx.fillRect(wx(-21), wz(128), 58 * scale, 14 * scale);

    // Vice International Airfield (SW Peninsula: x = -125..-68, z = 66..138)
    sctx.fillStyle = 'rgba(74, 80, 96, 0.52)';
    sctx.strokeStyle = 'rgba(54, 241, 230, 0.35)';
    sctx.lineWidth = 1;
    sctx.fillRect(wx(-125), wz(66), 57 * scale, 72 * scale);
    sctx.strokeRect(wx(-125), wz(66), 57 * scale, 72 * scale);
    // Runway 18/36 dark strip + white dashed centerline
    sctx.fillStyle = 'rgba(24, 26, 34, 0.85)';
    sctx.fillRect(wx(-119), wz(70), 14 * scale, 66 * scale);
    sctx.strokeStyle = 'rgba(242, 237, 228, 0.75)';
    sctx.lineWidth = 1.4;
    sctx.setLineDash([4, 4]);
    sctx.beginPath();
    sctx.moveTo(wx(-112), wz(73));
    sctx.lineTo(wx(-112), wz(133));
    sctx.stroke();
    sctx.setLineDash([]);
    // Terminal 1 & Hangar 06 footprints
    sctx.fillStyle = 'rgba(242, 214, 194, 0.45)';
    sctx.fillRect(wx(-86), wz(71), 16 * scale, 12 * scale);
    sctx.fillStyle = 'rgba(148, 160, 178, 0.5)';
    sctx.fillRect(wx(-88), wz(104), 17 * scale, 17 * scale);
    // Secondary Helipad ring
    sctx.strokeStyle = 'rgba(255, 209, 92, 0.7)';
    sctx.lineWidth = 1.2;
    sctx.beginPath();
    sctx.arc(wx(-93), wz(129.5), 4.5 * scale, 0, Math.PI * 2);
    sctx.stroke();

    // West District (Little Havana, Starlight Diner, Banco de Vice & Vice Customs: x = -124..-66)
    sctx.fillStyle = 'rgba(232, 168, 132, 0.22)';
    sctx.strokeStyle = 'rgba(255, 160, 110, 0.35)';
    sctx.lineWidth = 1;
    for (const zBlock of [-40, 0, 40]) {
      const bx = wx(-104);
      const bz = wz(zBlock - 14);
      sctx.fillRect(bx, bz, 34 * scale, 28 * scale);
      sctx.strokeRect(bx, bz, 34 * scale, 28 * scale);
    }

    // Road grid highlights (including West Havana Blvd at x = -112)
    sctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    sctx.lineWidth = layout.roadWidth * scale;
    sctx.lineCap = 'butt';
    for (const r of [...layout.roadCoords, -112]) {
      const rx = wx(r);
      sctx.beginPath();
      sctx.moveTo(rx, wz(-68));
      sctx.lineTo(rx, wz(68));
      sctx.stroke();
    }
    for (const r of layout.roadCoords) {
      const rz = wz(r);
      sctx.beginPath();
      sctx.moveTo(wx(-120), rz);
      sctx.lineTo(wx(68), rz);
      sctx.stroke();
    }

    // Art-Deco building footprints
    sctx.fillStyle = 'rgba(242, 198, 180, 0.28)';
    sctx.strokeStyle = 'rgba(255, 130, 190, 0.35)';
    sctx.lineWidth = 1;
    for (const b of layout.buildings) {
      const bx = wx(b.x - b.w / 2);
      const bz = wz(b.z - b.d / 2);
      const bw = b.w * scale;
      const bd = b.d * scale;
      sctx.fillRect(bx, bz, bw, bd);
      sctx.strokeRect(bx, bz, bw, bd);
    }

    // Palm Parking '86 4-Story Neon Parking Garage on Block (0, 40)
    sctx.fillStyle = 'rgba(64, 72, 92, 0.65)';
    sctx.strokeStyle = '#ff4fa3';
    sctx.lineWidth = 1.6;
    sctx.fillRect(wx(-12.6), wz(27.4), 25.2 * scale, 25.2 * scale);
    sctx.strokeRect(wx(-12.6), wz(27.4), 25.2 * scale, 25.2 * scale);

    // Static district & landmark labels
    sctx.font = '900 11px "Segoe UI", sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';

    sctx.fillStyle = '#52f29c';
    sctx.fillText('$', wx(-4.5), wz(4.5));
    sctx.fillStyle = '#ff9f43';
    sctx.fillText('P', wx(-56), wz(-38));
    sctx.fillStyle = '#ff4fa3';
    sctx.fillText('C', wx(40), wz(0));
    sctx.fillStyle = '#36f1e6';
    sctx.fillText('⌂', wx(40), wz(-40));
    sctx.fillStyle = '#33aaff';
    sctx.fillText('PD', wx(-40), wz(0));
    sctx.fillStyle = '#ff9f43';
    sctx.fillText('IE', wx(58), wz(92));
    sctx.fillStyle = '#36f1e6';
    sctx.fillText('T', wx(-85), wz(-37.5));
    sctx.fillStyle = '#ff4fa3';
    sctx.fillText('D', wx(-88), wz(-7));
    sctx.fillStyle = '#52f29c';
    sctx.fillText('🐾', wx(-76.5), wz(9.5));
    sctx.fillStyle = '#ffd15c';
    sctx.fillText('B', wx(-88), wz(40));
    sctx.fillStyle = '#36f1e6';
    sctx.fillText('⚓', wx(-8), wz(-104));
    sctx.fillStyle = '#ff9f43';
    sctx.fillText('L', wx(81), wz(-114));
    sctx.fillStyle = '#36f1e6';
    sctx.fillText('✈', wx(-96), wz(102));
    sctx.fillStyle = '#ffd15c';
    sctx.fillText('☠', wx(162), wz(96));
    sctx.fillStyle = '#36f1e6';
    sctx.fillText('P3', wx(0), wz(40));

    this.staticCanvas = c;
    return c;
  }

  public render(
    playerX: number,
    playerZ: number,
    headingYaw: number,
    layout: CityLayout,
    vehicles: Vehicle[],
    npcs: NpcEntity[],
    objective: ActiveObjective | null,
    elapsed: number,
    heliPos?: { x: number; z: number } | null,
    heistTarget?: { x: number; z: number } | null,
    maverickPos?: { x: number; z: number } | null,
    parkedRides?: { x: number; z: number; label: string; color: string }[],
    yachtState?: { x: number; z: number; yaw: number } | null,
    boatMarkers?: { x: number; z: number; yaw: number }[],
  ): void {
    // Throttle 2D radar redraws to ~30 Hz (saves ~50% 2D canvas CPU work on 60-144Hz monitors!)
    if (elapsed - this.lastRenderElapsed < 0.032) return;
    this.lastRenderElapsed = elapsed;

    const staticLayer = this.ensureStaticMap(layout);
    const ctx = this.ctx;
    const half = this.half;
    const scale = this.scale;

    ctx.clearRect(0, 0, this.size, this.size);

    ctx.save();
    // Circular radar clip
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    // Base road/asphalt radar background
    ctx.fillStyle = '#181026';
    ctx.fillRect(0, 0, this.size, this.size);

    // Rotate map so "up" on radar is player's forward direction
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(headingYaw);

    // Single cached offscreen blit for all static districts, roads, buildings & landmark icons!
    ctx.drawImage(staticLayer, (STATIC_MIN_X - playerX) * scale, (STATIC_MIN_Z - playerZ) * scale);

    // 44m Drivable Superyacht "LADY VICE" (live position & heading!)
    const yx = yachtState ? yachtState.x : 172;
    const yz = yachtState ? yachtState.z : 15;
    const yYaw = yachtState ? yachtState.yaw : 0;
    ctx.save();
    ctx.translate((yx - playerX) * scale, (yz - playerZ) * scale);
    ctx.rotate(-yYaw);
    ctx.fillStyle = 'rgba(245, 248, 255, 0.78)';
    ctx.fillRect(-6 * scale, -21 * scale, 12 * scale, 42 * scale);
    ctx.strokeStyle = '#36f1e6';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-6 * scale, -21 * scale, 12 * scale, 42 * scale);
    ctx.restore();

    // Drivable Boats (Stinger Speedboat + 4 Vice Marina Yachts/Sailboats)
    if (boatMarkers) {
      for (let i = 0; i < boatMarkers.length; i++) {
        const bm = boatMarkers[i];
        ctx.save();
        ctx.translate((bm.x - playerX) * scale, (bm.z - playerZ) * scale);
        ctx.rotate(-bm.yaw);
        ctx.fillStyle = '#36f1e6';
        ctx.beginPath();
        ctx.moveTo(0, 4.5);
        ctx.lineTo(2.4, -3.5);
        ctx.lineTo(-2.4, -3.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Vehicles
    for (const v of vehicles) {
      if (v.destroyed) continue;
      const vx = (v.position.x - playerX) * scale;
      const vz = (v.position.z - playerZ) * scale;
      if (v.isPolice) {
        ctx.fillStyle = Math.sin(elapsed * 12) > 0 ? '#ff3355' : '#33aaff';
      } else if (v.specialRole === 'taxi') {
        ctx.fillStyle = '#ffd15c';
      } else if (v.specialRole === 'ambulance') {
        ctx.fillStyle = Math.sin(elapsed * 10) > 0 ? '#ffffff' : '#ff3355';
      } else if (v.specialRole === 'firetruck') {
        ctx.fillStyle = Math.sin(elapsed * 10) > 0 ? '#ff2a3c' : '#ffaa22';
      } else {
        ctx.fillStyle = '#ff9f43';
      }
      ctx.fillRect(vx - 2.5, vz - 2.5, 5, 5);
    }

    ctx.font = '900 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Flyable Vice Maverick Helicopter marker (M)
    if (maverickPos) {
      const mx = (maverickPos.x - playerX) * scale;
      const mz = (maverickPos.z - playerZ) * scale;
      ctx.fillStyle = '#52f29c';
      ctx.fillText('M', mx, mz);
    }

    // Parked Personal Skateboard (SB) / Rennrad (RR) markers when left out in the city
    if (parkedRides) {
      ctx.font = '900 9px "Segoe UI", sans-serif';
      for (const pr of parkedRides) {
        const rx = (pr.x - playerX) * scale;
        const rz = (pr.z - playerZ) * scale;
        ctx.fillStyle = pr.color;
        ctx.fillText(pr.label, rx, rz);
      }
      ctx.font = '900 11px "Segoe UI", sans-serif';
    }

    // Ocean Club Heist Start marker (★) at (60, -26) when idle
    if (!heistTarget) {
      const hstX = (60 - playerX) * scale;
      const hstZ = (-26 - playerZ) * scale;
      ctx.fillStyle = '#ffd15c';
      ctx.fillText('★', hstX, hstZ);
    }

    // Vice PD Chopper marker (H) when deployed
    if (heliPos) {
      const hx = (heliPos.x - playerX) * scale;
      const hz = (heliPos.z - playerZ) * scale;
      ctx.fillStyle = Math.sin(elapsed * 16) > 0 ? '#ff3355' : '#36f1e6';
      ctx.fillText('H', hx, hz);
    }

    // Police & Bounty NPCs
    for (const n of npcs) {
      if (!n.alive || n.role === 'civilian') continue;
      const nx = (n.position.x - playerX) * scale;
      const nz = (n.position.z - playerZ) * scale;
      ctx.beginPath();
      if (n.role === 'police') {
        ctx.fillStyle = Math.sin(elapsed * 14 + nx) > 0 ? '#ff3355' : '#33b5ff';
        ctx.arc(nx, nz, 3.2, 0, Math.PI * 2);
      } else if (n.role === 'guard') {
        ctx.fillStyle = '#ff9f43';
        ctx.arc(nx, nz, 3.4, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = '#ff4fa3';
        ctx.arc(nx, nz, 4.2, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    ctx.restore(); // end rotated map layer

    // Objective or Active Heist marker (clamped to radar edge if outside radius)
    const activeTargetPos = heistTarget ?? (objective && objective.kind !== 'survive' ? objective.targetPos : null);
    if (activeTargetPos) {
      const dx = activeTargetPos.x - playerX;
      const dz = activeTargetPos.z - playerZ;
      const cos = Math.cos(headingYaw);
      const sin = Math.sin(headingYaw);
      let rx = (dx * cos - dz * sin) * scale;
      let rz = (dx * sin + dz * cos) * scale;

      const maxR = half - 12;
      const dist = Math.hypot(rx, rz);
      if (dist > maxR) {
        rx = (rx / dist) * maxR;
        rz = (rz / dist) * maxR;
      }

      const color = heistTarget
        ? '#ffd15c'
        : objective?.kind === 'stash'
          ? '#36f1e6'
          : objective?.kind === 'race'
            ? '#ffbe3b'
            : objective?.kind === 'dropoff'
              ? '#ff9f43'
              : '#ff4fa3';

      const pulse = 4.5 + Math.sin(elapsed * 6) * 1.4;
      ctx.save();
      ctx.translate(half + rx, half + rz);
      // Fast concentric glow circle instead of expensive 2D-canvas shadowBlur!
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, pulse + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, -pulse);
      ctx.lineTo(pulse, 0);
      ctx.lineTo(0, pulse);
      ctx.lineTo(-pulse, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // North compass indicator on radar rim
    const nAngle = headingYaw - Math.PI / 2;
    const nx = half + Math.cos(nAngle) * (half - 11);
    const ny = half + Math.sin(nAngle) * (half - 11);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);

    // Player center chevron (zero shadowBlur!)
    ctx.save();
    ctx.translate(half, half);
    ctx.fillStyle = 'rgba(54, 241, 230, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end clip

    // Outer neon bezel ring
    ctx.strokeStyle = 'rgba(54, 241, 230, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
