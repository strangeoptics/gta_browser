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

    // Ocean & beach on East (+X)
    const beachX = (74 - playerX) * scale;
    const oceanX = (108 - playerX) * scale;
    ctx.fillStyle = 'rgba(201, 166, 132, 0.25)';
    ctx.fillRect(beachX, -240, 36 * scale, 480);
    ctx.fillStyle = 'rgba(34, 110, 145, 0.45)';
    ctx.fillRect(oceanX, -240, 180, 480);

    // Road grid highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = layout.roadWidth * scale;
    for (const r of layout.roadCoords) {
      const rx = (r - playerX) * scale;
      const rz = (r - playerZ) * scale;
      ctx.beginPath();
      ctx.moveTo(rx, (-68 - playerZ) * scale);
      ctx.lineTo(rx, (68 - playerZ) * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo((-68 - playerX) * scale, rz);
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
