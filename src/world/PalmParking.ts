import * as THREE from 'three';
import type { AABB } from '../types';
import { createWorldHelpers } from './BuildHelpers';
import type { StuntRamp } from './StuntRamps';
import { createNeonSignTexture } from './Textures';

export interface ParkingRushHudState {
  active: boolean;
  title: string;
  description: string;
  timerText: string;
  distanceM: number;
  targetPos: { x: number; z: number } | null;
}

export interface ParkingRushEvent {
  type: 'checkpoint' | 'completed' | 'failed';
  checkpointIndex?: number;
  totalCheckpoints?: number;
  reward?: number;
  timeBonus?: number;
  elapsedSec?: number;
  isNewBest?: boolean;
}

export interface PalmParkingHandle {
  stuntRamps: StuntRamp[];
  getGroundHeight: (x: number, z: number, currentY?: number) => number | null;
  isInsideGarage: (pos: THREE.Vector3) => boolean;
  isCarAtRushStart: (pos: THREE.Vector3) => boolean;
  isRushActive: () => boolean;
  startRush: () => void;
  cancelRush: () => void;
  getRushHud: (playerPos: THREE.Vector3) => ParkingRushHudState;
  update: (
    elapsed: number,
    dt: number,
    playerPos?: THREE.Vector3,
    activeCarPos?: THREE.Vector3 | null,
  ) => ParkingRushEvent | null;
}

// Block (0, 40) constants
const GX = 0.0;
const GZ = 40.0;
const HALF_W = 12.6; // x: -12.6 .. +12.6
const HALF_D = 12.6; // z: 27.4 .. 52.6
const FLOOR_H = 3.6; // 4 decks: EG=0.0, P1=3.6, P2=7.2, P3 Rooftop=10.8
const RAMP_Z0 = 33.0;
const RAMP_Z1 = 47.0;
const RAMP_LEN = RAMP_Z1 - RAMP_Z0; // 14.0m
const EAST_RAMP_MIN_X = 7.0;
const WEST_RAMP_MAX_X = -7.0;

// -----------------------------------------------------------------------------
// Procedural Parking Garage Canvas Textures (Zero External Assets!)
// -----------------------------------------------------------------------------

function createParkingDeckTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Smooth troweled concrete deck
  ctx.fillStyle = '#383a44';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tire wear & oil stains
  for (let i = 0; i < 900; i++) {
    const x = (i * 73) % 512;
    const y = (i * 157) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.065)';
    ctx.fillRect(x, y, 3 + (i % 5), 3 + (i % 5));
  }

  // Concrete expansion seams
  ctx.strokeStyle = 'rgba(15, 16, 22, 0.42)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 512; p += 128) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  // Painted white parking bay stall dividers in center island
  ctx.fillStyle = 'rgba(235, 232, 222, 0.78)';
  for (let s = 148; s <= 364; s += 54) {
    ctx.fillRect(160, s, 192, 5);
  }
  ctx.fillRect(254, 148, 5, 218);

  // Yellow driving lane guide stripes around perimeter loop
  ctx.strokeStyle = 'rgba(242, 190, 52, 0.72)';
  ctx.lineWidth = 5;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(58, 58, 396, 396);
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createRampSurfaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2d303a';
  ctx.fillRect(0, 0, 256, 512);

  // Anti-slip traction grooves
  for (let y = 0; y < 512; y += 12) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(16, y, 224, 3);
  }
  // Yellow edge stripes & painted chevron arrows
  ctx.fillStyle = '#f2be34';
  ctx.fillRect(10, 0, 10, 512);
  ctx.fillRect(236, 0, 10, 512);

  ctx.strokeStyle = 'rgba(54, 241, 230, 0.75)';
  ctx.lineWidth = 10;
  for (const cy of [120, 256, 392]) {
    ctx.beginPath();
    ctx.moveTo(86, cy + 24);
    ctx.lineTo(128, cy - 22);
    ctx.lineTo(170, cy + 24);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLevelBadgeTexture(label: string, accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#151320';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = accentHex;
  ctx.font = '900 54px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHazardStripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2be34';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#181820';
  for (let x = -64; x < 192; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x - 16, 64);
    ctx.lineTo(x - 32, 64);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Computes all drivable surface heights at (x, z) inside Palm Parking and picks the highest
 * valid surface <= currentY + 1.15m so cars can smoothly drive on ALL 4 levels AND up/down all 3 ramps!
 */
function sampleParkingVehicleHeight(x: number, z: number, currentY: number): number | null {
  if (x < GX - HALF_W || x > GX + HALF_W || z < GZ - HALF_D || z > GZ + HALF_D) {
    return null;
  }

  const inEastRamp = x >= EAST_RAMP_MIN_X && z >= RAMP_Z0 && z <= RAMP_Z1;
  const inWestRamp = x <= WEST_RAMP_MAX_X && z >= RAMP_Z0 && z <= RAMP_Z1;

  const candidates: number[] = [0.0]; // Ground floor always exists

  // Ramp 0 -> 1 (East lane, rising South +Z: z = 33..47 -> y = 0.0..3.6)
  if (inEastRamp) {
    const t = THREE.MathUtils.clamp((z - RAMP_Z0) / RAMP_LEN, 0, 1);
    candidates.push(t * FLOOR_H);
  }
  // Deck P1 (y = 3.6) everywhere except East Ramp cutout
  if (!inEastRamp) {
    candidates.push(FLOOR_H);
  }

  // Ramp 1 -> 2 (West lane, rising North -Z: z = 47..33 -> y = 3.6..7.2)
  if (inWestRamp) {
    const t = THREE.MathUtils.clamp((RAMP_Z1 - z) / RAMP_LEN, 0, 1);
    candidates.push(FLOOR_H + t * FLOOR_H);
  }
  // Deck P2 (y = 7.2) everywhere except West Ramp cutout
  if (!inWestRamp) {
    candidates.push(FLOOR_H * 2);
  }

  // Ramp 2 -> 3 (East lane, rising South +Z: z = 33..47 -> y = 7.2..10.8)
  if (inEastRamp) {
    const t = THREE.MathUtils.clamp((z - RAMP_Z0) / RAMP_LEN, 0, 1);
    candidates.push(FLOOR_H * 2 + t * FLOOR_H);
  }
  // Deck P3 Rooftop Skydeck (y = 10.8) everywhere except East Ramp cutout
  if (!inEastRamp) {
    candidates.push(FLOOR_H * 3);
  }

  let best = 0.0;
  for (let i = 0; i < candidates.length; i++) {
    const h = candidates[i];
    if (h <= currentY + 1.15 && h > best) {
      best = h;
    }
  }
  return best;
}

/**
 * Builds "PALM PARKING '86" — High-Detail 4-Story Art-Deco Neon Parking Garage on Block (0, 40)
 * + Built-in "PALM PARKING · NEON DRIFT RUSH" Rooftop Time-Trial Mission (+$1,800..$2,400)!
 * - 4 fully drivable & walkable decks (EG 0m, P1 3.6m, P2 7.2m, P3 Rooftop Skydeck 10.8m)
 * - 3 wide (5.6m) non-overlapping zigzag ramps with smooth vehicle pitch & stepped player-walkable colliders
 * - Art-Deco cream/coral concrete facade, color-coded neon bands per floor, giant vertical marquee signs
 * - Ground-floor ticket booth, clearance bars, fluorescent tube lights, pay kiosks, rooftop palms & Rooftop Stunt Ramp!
 * Zero extra PointLights added -> constant shader count & silky-smooth FPS!
 */
export function buildPalmParking(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[],
): PalmParkingHandle {
  const { addBox, addVisual } = createWorldHelpers(scene, colliders, worldMeshes, 'parking-wall');

  // Shared PBR materials
  const deckMat = new THREE.MeshStandardMaterial({ map: createParkingDeckTexture(), roughness: 0.56, metalness: 0.14 });
  const rampMat = new THREE.MeshStandardMaterial({ map: createRampSurfaceTexture(), roughness: 0.54, metalness: 0.16 });
  const concreteCreamMat = new THREE.MeshStandardMaterial({ color: '#efe3d2', roughness: 0.55 });
  const coralTrimMat = new THREE.MeshStandardMaterial({ color: '#ec9f8e', roughness: 0.5 });
  const mintTrimMat = new THREE.MeshStandardMaterial({ color: '#9cd8ce', roughness: 0.48 });
  const steelDarkMat = new THREE.MeshStandardMaterial({ color: '#242733', roughness: 0.42, metalness: 0.72 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: createHazardStripeTexture(), roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#6ec4d8',
    roughness: 0.08,
    metalness: 0.35,
    transparent: true,
    opacity: 0.36,
  });

  // Thin neon accents per floor (> 1.0 bloom strictly on thin neon tubes & bulbs!)
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.2 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.2 });
  const amberNeon = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff9f43', emissiveIntensity: 2.1 });
  const violetNeon = new THREE.MeshStandardMaterial({ color: '#b06bff', emissive: '#9d52ff', emissiveIntensity: 2.2 });
  const tubeLightMat = new THREE.MeshStandardMaterial({ color: '#fff6e8', emissive: '#e8f6ff', emissiveIntensity: 2.4 });
  const floorNeons = [cyanNeon, pinkNeon, amberNeon, violetNeon];
  const floorAccentHex = ['#36f1e6', '#ff4fa3', '#ff9f43', '#b06bff'];

  // ===========================================================================
  // 1) GROUND FLOOR APRON (EG, y = 0.0m), TICKET BOOTH & ENTRANCE GANTRIES
  // ===========================================================================
  const egSlab = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2), deckMat);
  egSlab.rotation.x = -Math.PI / 2;
  egSlab.position.set(GX, 0.02, GZ);
  egSlab.receiveShadow = true;
  scene.add(egSlab);
  worldMeshes.push(egSlab);

  // Ground-floor ticket booth at North entrance (x = -5.6, z = 28.4)
  addBox(1.8, 2.5, 2.2, -5.6, 1.25, 28.4, concreteCreamMat, true, 'parking-wall');
  addVisual(new THREE.BoxGeometry(1.88, 0.9, 1.6), glassMat, -5.6, 1.55, 28.4);
  addVisual(new THREE.BoxGeometry(2.0, 0.2, 2.4), mintTrimMat, -5.6, 2.58, 28.4);
  // Raised yellow/black barrier arm (open for driving straight in!)
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 0.1), hazardMat);
  barrier.position.set(-4.1, 2.35, 28.4);
  barrier.rotation.z = -0.15;
  scene.add(barrier);

  // Clearance bar hanging at North & South entrances (y = 3.15m)
  for (const ez of [27.35, 52.65]) {
    addVisual(new THREE.BoxGeometry(7.2, 0.24, 0.14), hazardMat, 0.0, 3.15, ez);
  }

  // ===========================================================================
  // 2) UPPER DECK FLOOR SLABS (P1 = 3.6m, P2 = 7.2m, P3 ROOFTOP = 10.8m)
  //    Each slab leaves its incoming ramp cutout completely open!
  // ===========================================================================
  const addDeckSlab = (w: number, d: number, x: number, topY: number, z: number) => {
    const thick = 0.34;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d), deckMat);
    m.position.set(x, topY - thick / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    worldMeshes.push(m);
    // Tag 'parking-floor' -> player walks on it, vehicles use sampleParkingVehicleHeight (NOT blocked from below!)
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: topY - thick,
      maxY: topY,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag: 'parking-floor',
    });
  };

  for (let lvl = 1; lvl <= 3; lvl++) {
    const topY = lvl * FLOOR_H;
    const eastOpen = lvl === 1 || lvl === 3; // Ramp 0->1 and Ramp 2->3 arrive on East
    const westOpen = lvl === 2; // Ramp 1->2 arrives on West

    // North turnaround slab (z = 27.4..33.0, full width 25.2)
    addDeckSlab(HALF_W * 2, 5.6, GX, topY, 30.2);
    // South turnaround slab (z = 47.0..52.6, full width 25.2)
    addDeckSlab(HALF_W * 2, 5.6, GX, topY, 49.8);
    // Center island slab (x = -7.0..+7.0, z = 33.0..47.0)
    addDeckSlab(14.0, 14.0, GX, topY, GZ);
    // West lane slab if not open
    if (!westOpen) {
      addDeckSlab(5.6, 14.0, -9.8, topY, GZ);
    }
    // East lane slab if not open
    if (!eastOpen) {
      addDeckSlab(5.6, 14.0, 9.8, topY, GZ);
    }

    // Overhead fluorescent light tubes on underside of P1, P2, P3 (illuminating the deck below!)
    for (const lz of [30.2, 37.0, 43.0, 49.8]) {
      for (const lx of [-4.2, 4.2]) {
        addVisual(new THREE.BoxGeometry(2.6, 0.08, 0.14), tubeLightMat, lx, topY - 0.39, lz);
      }
    }
  }

  // ===========================================================================
  // 3) THREE WIDE DRIVABLE & WALKABLE ZIGZAG RAMPS (0->1, 1->2, 2->3)
  // ===========================================================================
  const buildGarageRamp = (laneX: number, baseY: number, climbSouth: boolean) => {
    const hyp = Math.hypot(RAMP_LEN, FLOOR_H);
    const angle = Math.atan2(FLOOR_H, RAMP_LEN);
    const visualRamp = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.24, hyp), rampMat);
    visualRamp.position.set(laneX, baseY + FLOOR_H / 2 - 0.12, GZ);
    visualRamp.rotation.x = climbSouth ? -angle : angle;
    visualRamp.castShadow = true;
    visualRamp.receiveShadow = true;
    scene.add(visualRamp);
    worldMeshes.push(visualRamp);

    // Side safety curbs along ramp inner edge (neon strip)
    const innerX = laneX > 0 ? laneX - 2.75 : laneX + 2.75;
    const rampRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, hyp), floorNeons[Math.round(baseY / FLOOR_H)]);
    rampRail.position.set(innerX, baseY + FLOOR_H / 2 + 0.12, GZ);
    rampRail.rotation.x = climbSouth ? -angle : angle;
    scene.add(rampRail);

    // 16 invisible stepped AABB treads (riser = 0.225m <= 0.28m) so players on foot walk smoothly up/down!
    // Tagged 'parking-floor' so vehicles use continuous sampleParkingVehicleHeight smoothly without bumpiness!
    const steps = 16;
    const riser = FLOOR_H / steps; // 0.225m
    const tread = RAMP_LEN / steps; // 0.875m
    for (let s = 0; s < steps; s++) {
      const sz = climbSouth ? RAMP_Z0 + (s + 0.5) * tread : RAMP_Z1 - (s + 0.5) * tread;
      const topY = baseY + (s + 1) * riser;
      colliders.push({
        minX: laneX - 2.75,
        maxX: laneX + 2.75,
        minY: topY - riser,
        maxY: topY,
        minZ: sz - tread / 2,
        maxZ: sz + tread / 2,
        tag: 'parking-floor',
      });
    }
  };

  buildGarageRamp(9.8, 0.0, true); // EG -> P1 (East lane, climbs South)
  buildGarageRamp(-9.8, FLOOR_H, false); // P1 -> P2 (West lane, climbs North)
  buildGarageRamp(9.8, FLOOR_H * 2, true); // P2 -> P3 Rooftop (East lane, climbs South)

  // ===========================================================================
  // 4) ART-DECO FACADE PARAPETS, STRUCTURAL COLUMNS & COLOR-CODED NEON BANDS
  // ===========================================================================
  const totalH = FLOOR_H * 3 + 1.25; // 12.05m

  // 4 Solid Art-Deco Corner Towers & Interior Structural Columns (with hazard wraps!)
  for (const cx of [-12.6, 12.6]) {
    for (const cz of [27.4, 52.6]) {
      addBox(1.1, totalH, 1.1, cx, totalH / 2, cz, concreteCreamMat, true, 'parking-wall');
      addVisual(new THREE.BoxGeometry(1.22, totalH, 0.24), coralTrimMat, cx, totalH / 2, cz);
    }
  }
  // Interior support pillars flanking the center island (x = ±6.7, z = 33.4 & 46.6)
  for (const px of [-6.7, 6.7]) {
    for (const pz of [33.4, 46.6]) {
      addBox(0.7, FLOOR_H * 3, 0.7, px, (FLOOR_H * 3) / 2, pz, concreteCreamMat, true, 'parking-wall');
      for (let lvl = 0; lvl < 3; lvl++) {
        addVisual(new THREE.BoxGeometry(0.76, 0.9, 0.76), hazardMat, px, lvl * FLOOR_H + 0.45, pz);
      }
    }
  }

  // Perimeter Parapet Walls on all 4 levels (leaving North & South ground-floor 8m driveways WIDE OPEN!)
  for (let lvl = 0; lvl <= 3; lvl++) {
    const baseY = lvl * FLOOR_H;
    const wallH = 1.15;
    const wy = baseY + wallH / 2;
    const neonMat = floorNeons[lvl];

    // West & East perimeter walls (full length z = 27.4..52.6)
    addBox(0.45, wallH, 24.4, -12.65, wy, GZ, concreteCreamMat, true, 'parking-wall');
    addBox(0.45, wallH, 24.4, 12.65, wy, GZ, concreteCreamMat, true, 'parking-wall');
    // Outer neon horizontal ribbons along West & East
    addVisual(new THREE.BoxGeometry(0.1, 0.14, 24.8), neonMat, -12.92, baseY + wallH + 0.04, GZ);
    addVisual(new THREE.BoxGeometry(0.1, 0.14, 24.8), neonMat, 12.92, baseY + wallH + 0.04, GZ);

    // North & South perimeter walls
    if (lvl === 0) {
      // Ground floor: leave wide 8.4m central driveway open (x = -4.2 .. +4.2) on both North & South!
      for (const ez of [27.35, 52.65]) {
        addBox(7.8, wallH, 0.45, -8.3, wy, ez, concreteCreamMat, true, 'parking-wall');
        addBox(7.8, wallH, 0.45, 8.3, wy, ez, concreteCreamMat, true, 'parking-wall');
      }
    } else if (lvl === 3) {
      // Rooftop P3: leave NW Stunt Ramp launch gap open on North edge (x = -9.6 .. -3.4)!
      addBox(2.8, wallH, 0.45, -11.0, wy, 27.35, concreteCreamMat, true, 'parking-wall');
      addBox(15.6, wallH, 0.45, 4.4, wy, 27.35, concreteCreamMat, true, 'parking-wall');
      addBox(24.4, wallH, 0.45, GX, wy, 52.65, concreteCreamMat, true, 'parking-wall');
    } else {
      addBox(24.4, wallH, 0.45, GX, wy, 27.35, concreteCreamMat, true, 'parking-wall');
      addBox(24.4, wallH, 0.45, GX, wy, 52.65, concreteCreamMat, true, 'parking-wall');
    }

    // Outer neon horizontal ribbons along North & South
    addVisual(new THREE.BoxGeometry(24.8, 0.14, 0.1), neonMat, GX, baseY + wallH + 0.04, 27.1);
    addVisual(new THREE.BoxGeometry(24.8, 0.14, 0.1), neonMat, GX, baseY + wallH + 0.04, 52.9);

    // Illuminated Floor Level Badge ("EG", "P1", "P2", "P3") inside each deck
    const badgeTex = createLevelBadgeTexture(lvl === 0 ? 'EG' : `P${lvl}`, floorAccentHex[lvl]);
    const badgeMat = new THREE.MeshStandardMaterial({
      map: badgeTex,
      emissive: '#ffffff',
      emissiveMap: badgeTex,
      emissiveIntensity: 1.05,
    });
    addVisual(new THREE.BoxGeometry(1.5, 0.75, 0.1), badgeMat, -6.7, baseY + 2.35, 33.0);
    addVisual(new THREE.BoxGeometry(1.5, 0.75, 0.1), badgeMat, 6.7, baseY + 2.35, 47.0);
  }

  // Decorative Vertical Art-Deco Concrete Louver Fins on West & East Facades
  for (const fz of [31.5, 35.8, 40.0, 44.2, 48.5]) {
    addVisual(new THREE.BoxGeometry(0.42, totalH - 0.6, 0.36), coralTrimMat, -12.9, totalH / 2, fz);
    addVisual(new THREE.BoxGeometry(0.42, totalH - 0.6, 0.36), coralTrimMat, 12.9, totalH / 2, fz);
  }

  // Iconic Neon Entrance & Rooftop Marquee Signs ("PALM PARKING '86")
  const mainSignTex = createNeonSignTexture("PALM PARKING · 24H", '#ff4fa3');
  const mainSignMat = new THREE.MeshStandardMaterial({
    map: mainSignTex,
    emissive: '#ffffff',
    emissiveMap: mainSignTex,
    emissiveIntensity: 1.85,
  });
  // North Entrance Header Sign (above EG driveway)
  const northSign = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.35, 0.22), mainSignMat);
  northSign.position.set(0, 3.85, 26.95);
  northSign.rotation.y = Math.PI;
  scene.add(northSign);
  // South Entrance Header Sign
  const southSign = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.35, 0.22), mainSignMat);
  southSign.position.set(0, 3.85, 53.05);
  scene.add(southSign);

  // Rooftop Skydeck Giant Neon Crown Sign ("PALM PARKING · SKYDECK")
  const skySignTex = createNeonSignTexture('PALM PARKING · SKYDECK', '#36f1e6');
  const skySignMat = new THREE.MeshStandardMaterial({
    map: skySignTex,
    emissive: '#ffffff',
    emissiveMap: skySignTex,
    emissiveIntensity: 1.8,
  });
  const skySignN = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.65, 0.24), skySignMat);
  skySignN.position.set(3.2, FLOOR_H * 3 + 2.35, 27.35);
  skySignN.rotation.y = Math.PI;
  scene.add(skySignN);
  const skySignS = skySignN.clone();
  skySignS.position.set(0, FLOOR_H * 3 + 2.35, 52.65);
  skySignS.rotation.y = 0;
  scene.add(skySignS);

  // Glass Art-Deco Elevator Shaft on NE Corner (x = 12.0, z = 28.0)
  addVisual(new THREE.BoxGeometry(2.0, totalH + 1.4, 2.0), glassMat, 12.0, (totalH + 1.4) / 2, 28.0);
  addVisual(new THREE.BoxGeometry(0.14, totalH + 1.2, 0.14), cyanNeon, 13.02, (totalH + 1.2) / 2, 27.0);

  // Rooftop Skydeck Details: 4 Corner Palm Planters (batched into CityBuilder's InstancedMesh!), Pay Kiosk & Floodlights
  const roofY = FLOOR_H * 3; // 10.8m
  for (const [px, pz] of [
    [-11.2, 51.2],
    [11.2, 51.2],
    [11.2, 29.2],
    [-11.2, 34.0],
  ]) {
    addVisual(new THREE.BoxGeometry(1.5, 0.72, 1.5), concreteCreamMat, px, roofY + 0.36, pz);
    palmPositions.push({ x: px, y: roofY + 0.68, z: pz, rot: px * 0.4 + pz, scale: 0.78 });
  }
  // Rooftop Payment & Vending Kiosk
  addBox(1.8, 2.1, 0.9, 1.5, roofY + 1.05, 51.8, mintTrimMat, true, 'parking-wall');
  addVisual(new THREE.BoxGeometry(1.1, 0.85, 0.08), cyanNeon, 1.5, roofY + 1.35, 51.32);

  // Rooftop Corner Lamp Posts (emissive globes, 0 extra PointLights!)
  for (const [lx, lz] of [
    [-11.8, 40.0],
    [11.8, 40.0],
    [0.0, 52.2],
  ]) {
    addVisual(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), steelDarkMat, lx, roofY + 2.1, lz);
    addVisual(new THREE.SphereGeometry(0.24, 8, 8), tubeLightMat, lx, roofY + 4.3, lz);
  }

  // ===========================================================================
  // 5) ROOFTOP SKYDECK STUNT RAMP (Launches North off P3 over the Boulevard!)
  // ===========================================================================
  const roofRamp: StuntRamp = {
    x: -6.5,
    z: 31.8,
    dirX: 0,
    dirZ: -1,
    width: 4.8,
    length: 7.5,
    height: 2.2,
  };
  {
    const g = new THREE.Group();
    g.position.set(roofRamp.x, roofY, roofRamp.z);
    g.rotation.y = Math.atan2(roofRamp.dirX, roofRamp.dirZ);
    const slopeAngle = Math.atan2(roofRamp.height, roofRamp.length);
    const hyp = Math.hypot(roofRamp.length, roofRamp.height);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(roofRamp.width, 0.2, hyp), steelDarkMat);
    deck.position.set(0, roofRamp.height / 2, 0);
    deck.rotation.x = -slopeAngle;
    deck.castShadow = true;
    g.add(deck);
    for (const sx of [-roofRamp.width / 2, roofRamp.width / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, hyp), pinkNeon);
      rail.position.set(sx, roofRamp.height / 2 + 0.14, 0);
      rail.rotation.x = -slopeAngle;
      g.add(rail);
    }
    const backSupport = new THREE.Mesh(new THREE.BoxGeometry(roofRamp.width, roofRamp.height, 0.3), cyanNeon);
    backSupport.position.set(0, roofRamp.height / 2, roofRamp.length / 2 - 0.15);
    g.add(backSupport);
    scene.add(g);
  }

  // ===========================================================================
  // 6) MISSION: "PALM PARKING · NEON DRIFT RUSH" (6-Checkpoint Rooftop Time Trial!)
  // ===========================================================================
  const rushStartPos = new THREE.Vector3(0.0, 0.0, 29.5);

  // Glowing Start Ring at Ground-Floor North Entrance
  const startRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.55, 32),
    new THREE.MeshBasicMaterial({ color: '#ff4fa3', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  startRing.rotation.x = -Math.PI / 2;
  startRing.position.set(rushStartPos.x, 0.06, rushStartPos.z);
  startRing.userData.dynamic = true;
  scene.add(startRing);

  const rushCheckpoints: { x: number; y: number; z: number; label: string }[] = [
    { x: 9.8, y: 1.8, z: 40.0, label: 'RAMPE EG → P1' },
    { x: 0.0, y: 3.6, z: 49.8, label: 'DECK P1 · SÜD-KEHRE' },
    { x: -9.8, y: 5.4, z: 40.0, label: 'RAMPE P1 → P2' },
    { x: 0.0, y: 7.2, z: 30.2, label: 'DECK P2 · NORD-KEHRE' },
    { x: 9.8, y: 9.0, z: 40.0, label: 'RAMPE P2 → SKYDECK' },
    { x: -5.5, y: 10.8, z: 41.5, label: 'P3 SKYDECK · ZIEL!' },
  ];

  // Live 3D Neon Checkpoint Beacon Group (repositioned per checkpoint, zero runtime allocations!)
  const cpGroup = new THREE.Group();
  cpGroup.visible = false;
  cpGroup.userData.dynamic = true;
  const cpRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.3, 0.14, 10, 28),
    new THREE.MeshBasicMaterial({ color: '#36f1e6' }),
  );
  cpRing.rotation.x = Math.PI / 2;
  cpRing.position.y = 0.25;
  cpGroup.add(cpRing);
  const cpBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 3.2, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ff4fa3',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cpBeam.position.y = 1.65;
  cpGroup.add(cpBeam);
  scene.add(cpGroup);

  const RUSH_TIME_LIMIT = 55.0;
  let rushActive = false;
  let rushCpIdx = 0;
  let rushTimeLeft = RUSH_TIME_LIMIT;
  let rushElapsed = 0;
  let bestRushTime = Infinity;

  const placeCurrentCheckpoint = () => {
    const cp = rushCheckpoints[rushCpIdx];
    if (!cp) return;
    cpGroup.position.set(cp.x, cp.y, cp.z);
    cpGroup.visible = true;
  };

  return {
    stuntRamps: [roofRamp],

    getGroundHeight: (x: number, z: number, currentY?: number) => {
      if (currentY === undefined) return null;
      return sampleParkingVehicleHeight(x, z, currentY);
    },

    isInsideGarage: (pos: THREE.Vector3) =>
      pos.x > GX - HALF_W &&
      pos.x < GX + HALF_W &&
      pos.z > GZ - HALF_D &&
      pos.z < GZ + HALF_D &&
      pos.y < FLOOR_H * 3 - 0.4,

    isCarAtRushStart: (pos: THREE.Vector3) =>
      !rushActive && Math.hypot(pos.x - rushStartPos.x, pos.z - rushStartPos.z) < 4.5 && pos.y < 1.5,

    isRushActive: () => rushActive,

    startRush: () => {
      rushActive = true;
      rushCpIdx = 0;
      rushTimeLeft = RUSH_TIME_LIMIT;
      rushElapsed = 0;
      placeCurrentCheckpoint();
    },

    cancelRush: () => {
      rushActive = false;
      cpGroup.visible = false;
    },

    getRushHud: (playerPos: THREE.Vector3): ParkingRushHudState => {
      if (!rushActive) {
        return {
          active: false,
          title: '',
          description: '',
          timerText: '',
          distanceM: 0,
          targetPos: null,
        };
      }
      const cp = rushCheckpoints[rushCpIdx];
      const dist = cp ? Math.round(Math.hypot(cp.x - playerPos.x, cp.z - playerPos.z)) : 0;
      return {
        active: true,
        title: `NEON DRIFT RUSH (${rushCpIdx + 1}/${rushCheckpoints.length})`,
        description: cp ? `${cp.label} — VOLLGAS AUFS DACH!` : 'SKYDECK ERREICHT!',
        timerText: `${Math.max(0, rushTimeLeft).toFixed(1)}s`,
        distanceM: dist,
        targetPos: cp ? { x: cp.x, z: cp.z } : null,
      };
    },

    update: (
      elapsed: number,
      dt: number,
      playerPos?: THREE.Vector3,
      activeCarPos?: THREE.Vector3 | null,
    ): ParkingRushEvent | null => {
      // Pulse start ring when idle
      startRing.visible = !rushActive;
      if (!rushActive) {
        const s = 1 + Math.sin(elapsed * 4.0) * 0.06;
        startRing.scale.set(s, s, 1);
        return null;
      }

      // Active Neon Drift Rush countdown & checkpoint check
      rushTimeLeft -= dt;
      rushElapsed += dt;
      cpGroup.rotation.y = elapsed * 2.4;
      const pulse = 1 + Math.sin(elapsed * 7.0) * 0.07;
      cpRing.scale.set(pulse, pulse, 1);

      if (rushTimeLeft <= 0) {
        rushActive = false;
        cpGroup.visible = false;
        return { type: 'failed' };
      }

      const probePos = activeCarPos ?? playerPos;
      if (probePos) {
        const cp = rushCheckpoints[rushCpIdx];
        const horizDist = Math.hypot(probePos.x - cp.x, probePos.z - cp.z);
        const vertDist = Math.abs(probePos.y - cp.y);
        if (horizDist < 4.2 && vertDist < 2.2) {
          rushCpIdx++;
          if (rushCpIdx >= rushCheckpoints.length) {
            rushActive = false;
            cpGroup.visible = false;
            const timeBonus = rushElapsed < 30.0 ? 600 : 0;
            const isNewBest = rushElapsed < bestRushTime;
            if (isNewBest) bestRushTime = rushElapsed;
            return {
              type: 'completed',
              reward: 1800,
              timeBonus,
              elapsedSec: rushElapsed,
              isNewBest,
            };
          }
          placeCurrentCheckpoint();
          return {
            type: 'checkpoint',
            checkpointIndex: rushCpIdx,
            totalCheckpoints: rushCheckpoints.length,
          };
        }
      }

      return null;
    },
  };
}
