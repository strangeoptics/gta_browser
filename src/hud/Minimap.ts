import type { CityLayout } from '../world/CityLayout';
import type { Vehicle } from '../vehicles/VehicleSystem';
import type { NpcEntity } from '../entities/NpcSystem';
import type { ActiveObjective } from '../gameplay/ObjectiveSystem';

export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;
  private readonly half: number;
  private readonly scale = 1.05; // pixels per world meter
  private lastRenderElapsed = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.size = canvas.width;
    this.half = this.size / 2;
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
  ): void {
    // Throttle 2D radar redraws to ~30 Hz (saves ~50% 2D canvas CPU work on 60-144Hz monitors!)
    if (elapsed - this.lastRenderElapsed < 0.032) return;
    this.lastRenderElapsed = elapsed;

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
    // In Three.js: forward for yaw is (-sin(yaw), -cos(yaw))
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(headingYaw);

    // Ocean & beach on East (+X) + Northern Bay (z < -96) + Causeway Bridge, Starfish Island & Superyacht
    const beachX = (74 - playerX) * scale;
    const oceanX = (108 - playerX) * scale;
    ctx.fillStyle = 'rgba(201, 166, 132, 0.25)';
    ctx.fillRect(beachX, -240, 36 * scale, 480);
    ctx.fillStyle = 'rgba(34, 110, 145, 0.45)';
    ctx.fillRect(oceanX, -240, 220, 480);
    // Northern Bay Ocean (z = -240..-96)
    ctx.fillRect((-180 - playerX) * scale, (-240 - playerZ) * scale, 320 * scale, 144 * scale);

    // North Point Coastal Highway (z = -88..-74, x = -124..+74) & Cape Vice Lighthouse Peninsula
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect((-124 - playerX) * scale, (-89 - playerZ) * scale, 198 * scale, 15 * scale);
    // Vice Marina Wooden Piers (x = -36, -8, +20; z = -124..-98)
    ctx.fillStyle = 'rgba(180, 142, 102, 0.65)';
    for (const px of [-36, -8, 20]) {
      ctx.fillRect((px - 1.8 - playerX) * scale, (-124 - playerZ) * scale, 3.6 * scale, 26 * scale);
    }
    // Cape Vice 11m Sea Cliff Plateau (center 78, -114, r = 16.5) & Winding Serpentine Road
    ctx.fillStyle = 'rgba(156, 137, 116, 0.55)';
    ctx.strokeStyle = 'rgba(235, 208, 162, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc((78 - playerX) * scale, (-114 - playerZ) * scale, 16.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Winding Serpentine Coastal Road climbing around the East Cliff
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 7.4 * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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
    ctx.beginPath();
    serpPts.forEach(([sx, sz], idx) => {
      const mx = (sx - playerX) * scale;
      const mz = (sz - playerZ) * scale;
      if (idx === 0) ctx.moveTo(mx, mz);
      else ctx.lineTo(mx, mz);
    });
    ctx.stroke();

    // Causeway Bridge (x = 66..148, z = -60)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect((66 - playerX) * scale, (-65.7 - playerZ) * scale, 82 * scale, 11.4 * scale);

    // Starfish Island (x = 148..198, z = -84..-20)
    ctx.fillStyle = 'rgba(72, 168, 118, 0.45)';
    ctx.strokeStyle = 'rgba(235, 208, 162, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.fillRect((148 - playerX) * scale, (-84 - playerZ) * scale, 50 * scale, 64 * scale);
    ctx.strokeRect((148 - playerX) * scale, (-84 - playerZ) * scale, 50 * scale, 64 * scale);

    // 42m Superyacht "LADY VICE" (x = 166..178, z = -6..36)
    ctx.fillStyle = 'rgba(245, 248, 255, 0.65)';
    ctx.fillRect((166 - playerX) * scale, (-6 - playerZ) * scale, 12 * scale, 42 * scale);

    // Vice Port Industrial Docks (x = -68..78, z = 66..126) & Cargo Freighter (x = -21..37, z = 128..142)
    ctx.fillStyle = 'rgba(92, 96, 110, 0.45)';
    ctx.fillRect((-68 - playerX) * scale, (66 - playerZ) * scale, 146 * scale, 60 * scale);
    ctx.fillStyle = 'rgba(184, 58, 48, 0.65)';
    ctx.fillRect((-21 - playerX) * scale, (128 - playerZ) * scale, 58 * scale, 14 * scale);

    // West District (Little Havana, Starlight Diner, Banco de Vice & Vice Customs: x = -124..-66)
    ctx.fillStyle = 'rgba(232, 168, 132, 0.22)';
    ctx.strokeStyle = 'rgba(255, 160, 110, 0.35)';
    ctx.lineWidth = 1;
    for (const wz of [-40, 0, 40]) {
      const bx = (-104 - playerX) * scale;
      const bz = (wz - 14 - playerZ) * scale;
      ctx.fillRect(bx, bz, 34 * scale, 28 * scale);
      ctx.strokeRect(bx, bz, 34 * scale, 28 * scale);
    }

    // Road grid highlights (including West Havana Blvd at x = -112)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = layout.roadWidth * scale;
    for (const r of [...layout.roadCoords, -112]) {
      const rx = (r - playerX) * scale;
      ctx.beginPath();
      ctx.moveTo(rx, (-68 - playerZ) * scale);
      ctx.lineTo(rx, (68 - playerZ) * scale);
      ctx.stroke();
    }
    for (const r of layout.roadCoords) {
      const rz = (r - playerZ) * scale;
      ctx.beginPath();
      ctx.moveTo((-120 - playerX) * scale, rz);
      ctx.lineTo((68 - playerX) * scale, rz);
      ctx.stroke();
    }

    // Art-Deco building footprints
    ctx.fillStyle = 'rgba(242, 198, 180, 0.28)';
    ctx.strokeStyle = 'rgba(255, 130, 190, 0.35)';
    ctx.lineWidth = 1;
    for (const b of layout.buildings) {
      const bx = (b.x - b.w / 2 - playerX) * scale;
      const bz = (b.z - b.d / 2 - playerZ) * scale;
      const bw = b.w * scale;
      const bd = b.d * scale;
      ctx.fillRect(bx, bz, bw, bd);
      ctx.strokeRect(bx, bz, bw, bd);
    }

    // Vehicles
    for (const v of vehicles) {
      if (v.destroyed) continue;
      const vx = (v.position.x - playerX) * scale;
      const vz = (v.position.z - playerZ) * scale;
      ctx.fillStyle = v.isPolice ? (Math.sin(elapsed * 12) > 0 ? '#ff3355' : '#33aaff') : '#ff9f43';
      ctx.fillRect(vx - 2.5, vz - 2.5, 5, 5);
    }

    // AMMU-NEON Shop marker ($) at Central Plaza (-4.5, 4.5)
    const sx = (-4.5 - playerX) * scale;
    const sz = (4.5 - playerZ) * scale;
    ctx.fillStyle = '#52f29c';
    ctx.font = '900 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', sx, sz);

    // Pay 'n' Spray marker (P) at West Avenue (-56, -38)
    const px = (-56 - playerX) * scale;
    const pz = (-38 - playerZ) * scale;
    ctx.fillStyle = '#ff9f43';
    ctx.fillText('P', px, pz);

    // Walk-in NEON CLUB marker (C) on Ocean Drive (40, 0)
    const cx = (40 - playerX) * scale;
    const cz = (0 - playerZ) * scale;
    ctx.fillStyle = '#ff4fa3';
    ctx.fillText('C', cx, cz);

    // VICE SAFEHOUSE Villa marker (⌂) on North Ocean Drive (40, -40)
    const shX = (40 - playerX) * scale;
    const shZ = (-40 - playerZ) * scale;
    ctx.fillStyle = '#36f1e6';
    ctx.fillText('⌂', shX, shZ);

    // VICE PD Police Station marker (PD) at West Downtown (-40, 0)
    const pdX = (-40 - playerX) * scale;
    const pdZ = (0 - playerZ) * scale;
    ctx.fillStyle = '#33aaff';
    ctx.fillText('PD', pdX, pdZ);

    // Vice Port Import / Export Garage marker (IE) at (58, 92)
    const ieX = (58 - playerX) * scale;
    const ieZ = (92 - playerZ) * scale;
    ctx.fillStyle = '#ff9f43';
    ctx.fillText('IE', ieX, ieZ);

    // West District markers: Vice Customs Tuning (T), Starlight 80s Diner (D), Havana Pets (🐾), Banco de Vice (B)
    ctx.fillStyle = '#36f1e6';
    ctx.fillText('T', (-85 - playerX) * scale, (-37.5 - playerZ) * scale);
    ctx.fillStyle = '#ff4fa3';
    ctx.fillText('D', (-88 - playerX) * scale, (-7 - playerZ) * scale);
    ctx.fillStyle = '#52f29c';
    ctx.fillText('🐾', (-76.5 - playerX) * scale, (9.5 - playerZ) * scale);
    ctx.fillStyle = '#ffd15c';
    ctx.fillText('B', (-88 - playerX) * scale, (40 - playerZ) * scale);

    // North Point markers: Vice Marina (⚓) & Cape Vice Cliff Lighthouse (L)
    ctx.fillStyle = '#36f1e6';
    ctx.fillText('⚓', (-8 - playerX) * scale, (-104 - playerZ) * scale);
    ctx.fillStyle = '#ff9f43';
    ctx.fillText('L', (81 - playerX) * scale, (-114 - playerZ) * scale);

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
