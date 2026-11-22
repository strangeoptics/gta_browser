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

// 1.5x Block (0, 54) giant 39.6 x 39.6m garage footprint -> wide 7.8m lanes, 8.8m U-turn aprons & gentle 22m ramps!
const GX = 0.0;
const GZ = 54.0;
const HALF_W = 19.8; // x: -19.8 .. +19.8
const HALF_D = 19.8; // z: 34.2 .. 73.8
const FLOOR_H = 3.6; // 4 decks: EG=0.0, P1=3.6, P2=7.2, P3 Rooftop=10.8
const RAMP_Z0 = 43.0;
const RAMP_Z1 = 65.0;
const RAMP_LEN = RAMP_Z1 - RAMP_Z0; // 22.0m gentle 9.3-degree ramps!
const EAST_RAMP_MIN_X = 12.0; // East lane: x = +12.0 .. +19.8 (7.8m wide!)
const WEST_RAMP_MAX_X = -12.0; // West lane: x = -19.8 .. -12.0 (7.8m wide!)
const LANE_W = HALF_W - EAST_RAMP_MIN_X; // 7.8m
const LANE_CENTER_X = EAST_RAMP_MIN_X + LANE_W / 2; // 15.9m
const TURN_DEPTH = RAMP_Z0 - (GZ - HALF_D); // 8.8m wide U-turn aprons!

// -----------------------------------------------------------------------------
// Procedural Parking Garage Canvas Textures (Zero External Assets!)
// -----------------------------------------------------------------------------

function createParkingDeckTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#383a44';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 900; i++) {
    const x = (i * 73) % 512;
    const y = (i * 157) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.065)';
    ctx.fillRect(x, y, 3 + (i % 5), 3 + (i % 5));
  }

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
  for (let s = 136; s <= 376; s += 48) {
    ctx.fillRect(156, s, 200, 4);
  }
  ctx.fillRect(254, 136, 5, 244);

  // Yellow driving lane guide stripes around perimeter loop
  ctx.strokeStyle = 'rgba(242, 190, 52, 0.72)';
  ctx.lineWidth = 5;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(52, 52, 408, 408);
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

  for (let y = 0; y < 512; y += 12) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(16, y, 224, 3);
  }
  ctx.fillStyle = '#f2be34';
  ctx.fillRect(10, 0, 10, 512);
  ctx.fillRect(236, 0, 10, 512);

  ctx.strokeStyle = 'rgba(54, 241, 230, 0.78)';
  ctx.lineWidth = 10;
  for (const cy of [100, 220, 340, 440]) {
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

function sampleParkingVehicleHeight(x: number, z: number, currentY: number): number | null {
  if (x < GX - HALF_W || x > GX + HALF_W || z < GZ - HALF_D || z > GZ + HALF_D) {
    return null;
  }

  const inEastRamp = x >= EAST_RAMP_MIN_X && z >= RAMP_Z0 && z <= RAMP_Z1;
  const inWestRamp = x <= WEST_RAMP_MAX_X && z >= RAMP_Z0 && z <= RAMP_Z1;

  const candidates: number[] = [0.0];

  if (inEastRamp) {
    const t = THREE.MathUtils.clamp((z - RAMP_Z0) / RAMP_LEN, 0, 1);
    candidates.push(t * FLOOR_H);
  }
  if (!inEastRamp) candidates.push(FLOOR_H);

  if (inWestRamp) {
    const t = THREE.MathUtils.clamp((RAMP_Z1 - z) / RAMP_LEN, 0, 1);
    candidates.push(FLOOR_H + t * FLOOR_H);
  }
  if (!inWestRamp) candidates.push(FLOOR_H * 2);

  if (inEastRamp) {
    const t = THREE.MathUtils.clamp((z - RAMP_Z0) / RAMP_LEN, 0, 1);
    candidates.push(FLOOR_H * 2 + t * FLOOR_H);
  }
  if (!inEastRamp) candidates.push(FLOOR_H * 3);

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
 * Builds "PALM PARKING '86" — Grand 39.6x39.6m 4-Story Art-Deco Neon Parking Garage on 1.5x Block (0, 54)
 * with wide 7.8m driving lanes, 8.8m U-turn aprons, gentle 22m ramps & "NEON DRIFT RUSH" Rooftop Mission!
 */
export function buildPalmParking(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[],
): PalmParkingHandle {
  const { addBox, addVisual } = createWorldHelpers(scene, colliders, worldMeshes, 'parking-wall');

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

  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.2 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.2 });
  const amberNeon = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff9f43', emissiveIntensity: 2.1 });
  const violetNeon = new THREE.MeshStandardMaterial({ color: '#b06bff', emissive: '#9d52ff', emissiveIntensity: 2.2 });
  const tubeLightMat = new THREE.MeshStandardMaterial({ color: '#fff6e8', emissive: '#e8f6ff', emissiveIntensity: 2.4 });
  const floorNeons = [cyanNeon, pinkNeon, amberNeon, violetNeon];
  const floorAccentHex = ['#36f1e6', '#ff4fa3', '#ff9f43', '#b06bff'];

  const minZ = GZ - HALF_D; // 34.2
  const maxZ = GZ + HALF_D; // 73.8
  const northTurnZ = minZ + TURN_DEPTH / 2; // 38.6
  const southTurnZ = maxZ - TURN_DEPTH / 2; // 69.4

  // ===========================================================================
  // 1) GROUND FLOOR APRON (EG, y = 0.0m), TICKET BOOTH & ENTRANCE GANTRIES
  // ===========================================================================
  const egSlab = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2), deckMat);
  egSlab.rotation.x = -Math.PI / 2;
  egSlab.position.set(GX, 0.02, GZ);
  egSlab.receiveShadow = true;
  scene.add(egSlab);
  worldMeshes.push(egSlab);

  // Ticket Booth beside North 10m Entrance (x = -7.2, z = 35.6)
  addBox(2.0, 2.5, 2.4, -7.2, 1.25, minZ + 1.4, concreteCreamMat, true, 'parking-wall');
  addVisual(new THREE.BoxGeometry(2.08, 0.9, 1.7), glassMat, -7.2, 1.55, minZ + 1.4);
  addVisual(new THREE.BoxGeometry(2.2, 0.2, 2.6), mintTrimMat, -7.2, 2.58, minZ + 1.4);
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 0.1), hazardMat);
  barrier.position.set(-5.6, 2.45, minZ + 1.4);
  barrier.rotation.z = -0.15;
  scene.add(barrier);

  // Hanging Clearance Bars at North & South 10m Drive-in Entrances
  for (const ez of [minZ, maxZ]) {
    addVisual(new THREE.BoxGeometry(9.6, 0.24, 0.14), hazardMat, 0.0, 3.18, ez);
  }

  // ===========================================================================
  // 2) UPPER DECK FLOOR SLABS (P1 = 3.6m, P2 = 7.2m, P3 ROOFTOP = 10.8m)
  // ===========================================================================
  const addDeckSlab = (w: number, d: number, x: number, topY: number, z: number) => {
    const thick = 0.34;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d), deckMat);
    m.position.set(x, topY - thick / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    worldMeshes.push(m);
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
    const eastOpen = lvl === 1 || lvl === 3;
    const westOpen = lvl === 2;

    // Wide 8.8m North & South turnaround aprons
    addDeckSlab(HALF_W * 2, TURN_DEPTH, GX, topY, northTurnZ);
    addDeckSlab(HALF_W * 2, TURN_DEPTH, GX, topY, southTurnZ);
    // Grand 24m x 22m Center Parking Island
    addDeckSlab(EAST_RAMP_MIN_X * 2, RAMP_LEN, GX, topY, GZ);
    if (!westOpen) addDeckSlab(LANE_W, RAMP_LEN, -LANE_CENTER_X, topY, GZ);
    if (!eastOpen) addDeckSlab(LANE_W, RAMP_LEN, LANE_CENTER_X, topY, GZ);

    // Overhead fluorescent tube lights illuminating the deck below
    for (const lz of [northTurnZ, 48.0, 60.0, southTurnZ]) {
      for (const lx of [-8.0, 0.0, 8.0]) {
        addVisual(new THREE.BoxGeometry(3.2, 0.08, 0.14), tubeLightMat, lx, topY - 0.39, lz);
      }
    }
  }

  // ===========================================================================
  // 3) THREE WIDE (7.8m) GENTLE (22m) ZIGZAG RAMPS (0->1, 1->2, 2->3)
  // ===========================================================================
  const buildGarageRamp = (laneX: number, baseY: number, climbSouth: boolean) => {
    const hyp = Math.hypot(RAMP_LEN, FLOOR_H);
    const angle = Math.atan2(FLOOR_H, RAMP_LEN);
    const visualRamp = new THREE.Mesh(new THREE.BoxGeometry(LANE_W - 0.1, 0.24, hyp), rampMat);
    visualRamp.position.set(laneX, baseY + FLOOR_H / 2 - 0.12, GZ);
    visualRamp.rotation.x = climbSouth ? -angle : angle;
    visualRamp.castShadow = true;
    visualRamp.receiveShadow = true;
    scene.add(visualRamp);
    worldMeshes.push(visualRamp);

    const innerX = laneX > 0 ? laneX - LANE_W / 2 + 0.12 : laneX + LANE_W / 2 - 0.12;
    const rampRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, hyp), floorNeons[Math.round(baseY / FLOOR_H)]);
    rampRail.position.set(innerX, baseY + FLOOR_H / 2 + 0.14, GZ);
    rampRail.rotation.x = climbSouth ? -angle : angle;
    scene.add(rampRail);

    // 18 stepped player-walkable AABB treads (riser = 0.20m <= 0.28m)
    const steps = 18;
    const riser = FLOOR_H / steps;
    const tread = RAMP_LEN / steps;
    for (let s = 0; s < steps; s++) {
      const sz = climbSouth ? RAMP_Z0 + (s + 0.5) * tread : RAMP_Z1 - (s + 0.5) * tread;
      const topY = baseY + (s + 1) * riser;
      colliders.push({
        minX: laneX - LANE_W / 2,
        maxX: laneX + LANE_W / 2,
        minY: topY - riser,
        maxY: topY,
        minZ: sz - tread / 2,
        maxZ: sz + tread / 2,
        tag: 'parking-floor',
      });
    }
  };

  buildGarageRamp(LANE_CENTER_X, 0.0, true); // EG -> P1 (East lane, climbs South)
  buildGarageRamp(-LANE_CENTER_X, FLOOR_H, false); // P1 -> P2 (West lane, climbs North)
  buildGarageRamp(LANE_CENTER_X, FLOOR_H * 2, true); // P2 -> P3 Skydeck (East lane, climbs South)

  // ===========================================================================
  // 4) ART-DECO FACADE PARAPETS, STRUCTURAL COLUMNS & COLOR-CODED NEON BANDS
  // ===========================================================================
  const totalH = FLOOR_H * 3 + 1.25;

  // 4 Corner Art-Deco Towers
  for (const cx of [-HALF_W, HALF_W]) {
    for (const cz of [minZ, maxZ]) {
      addBox(1.2, totalH, 1.2, cx, totalH / 2, cz, concreteCreamMat, true, 'parking-wall');
      addVisual(new THREE.BoxGeometry(1.34, totalH, 0.28), coralTrimMat, cx, totalH / 2, cz);
    }
  }
  // Interior columns flanking the spacious center island (x = ±11.6, z = 43.4 & 64.6)
  for (const px of [-11.6, 11.6]) {
    for (const pz of [RAMP_Z0 + 0.4, RAMP_Z1 - 0.4]) {
      addBox(0.75, FLOOR_H * 3, 0.75, px, (FLOOR_H * 3) / 2, pz, concreteCreamMat, true, 'parking-wall');
      for (let lvl = 0; lvl < 3; lvl++) {
        addVisual(new THREE.BoxGeometry(0.82, 0.95, 0.82), hazardMat, px, lvl * FLOOR_H + 0.48, pz);
      }
    }
  }

  for (let lvl = 0; lvl <= 3; lvl++) {
    const baseY = lvl * FLOOR_H;
    const wallH = 1.15;
    const wy = baseY + wallH / 2;
    const neonMat = floorNeons[lvl];

    // West & East perimeter walls
    addBox(0.5, wallH, HALF_D * 2 - 1.2, -HALF_W - 0.05, wy, GZ, concreteCreamMat, true, 'parking-wall');
    addBox(0.5, wallH, HALF_D * 2 - 1.2, HALF_W + 0.05, wy, GZ, concreteCreamMat, true, 'parking-wall');
    addVisual(new THREE.BoxGeometry(0.1, 0.16, HALF_D * 2), neonMat, -HALF_W - 0.34, baseY + wallH + 0.04, GZ);
    addVisual(new THREE.BoxGeometry(0.1, 0.16, HALF_D * 2), neonMat, HALF_W + 0.34, baseY + wallH + 0.04, GZ);

    if (lvl === 0) {
      // Ground floor: wide 10.4m central driveways open on North & South (x = -5.2 .. +5.2)
      for (const ez of [minZ, maxZ]) {
        addBox(14.0, wallH, 0.5, -12.4, wy, ez, concreteCreamMat, true, 'parking-wall');
        addBox(14.0, wallH, 0.5, 12.4, wy, ez, concreteCreamMat, true, 'parking-wall');
      }
    } else if (lvl === 3) {
      // Rooftop P3: open NW Stunt Ramp launch gap (x = -13.0 .. -6.2)
      addBox(6.2, wallH, 0.5, -16.3, wy, minZ, concreteCreamMat, true, 'parking-wall');
      addBox(25.4, wallH, 0.5, 6.6, wy, minZ, concreteCreamMat, true, 'parking-wall');
      addBox(HALF_W * 2 - 1.2, wallH, 0.5, GX, wy, maxZ, concreteCreamMat, true, 'parking-wall');
    } else {
      addBox(HALF_W * 2 - 1.2, wallH, 0.5, GX, wy, minZ, concreteCreamMat, true, 'parking-wall');
      addBox(HALF_W * 2 - 1.2, wallH, 0.5, GX, wy, maxZ, concreteCreamMat, true, 'parking-wall');
    }

    addVisual(new THREE.BoxGeometry(HALF_W * 2, 0.16, 0.1), neonMat, GX, baseY + wallH + 0.04, minZ - 0.3);
    addVisual(new THREE.BoxGeometry(HALF_W * 2, 0.16, 0.1), neonMat, GX, baseY + wallH + 0.04, maxZ + 0.3);

    const badgeTex = createLevelBadgeTexture(lvl === 0 ? 'EG' : `P${lvl}`, floorAccentHex[lvl]);
    const badgeMat = new THREE.MeshStandardMaterial({
      map: badgeTex,
      emissive: '#ffffff',
      emissiveMap: badgeTex,
      emissiveIntensity: 1.05,
    });
    addVisual(new THREE.BoxGeometry(1.7, 0.85, 0.1), badgeMat, -11.6, baseY + 2.35, RAMP_Z0);
    addVisual(new THREE.BoxGeometry(1.7, 0.85, 0.1), badgeMat, 11.6, baseY + 2.35, RAMP_Z1);
  }

  // Vertical Art-Deco Concrete Louver Fins on West & East Facades
  for (const fz of [39.5, 45.0, 50.5, 57.5, 63.0, 68.5]) {
    addVisual(new THREE.BoxGeometry(0.45, totalH - 0.6, 0.42), coralTrimMat, -HALF_W - 0.3, totalH / 2, fz);
    addVisual(new THREE.BoxGeometry(0.45, totalH - 0.6, 0.42), coralTrimMat, HALF_W + 0.3, totalH / 2, fz);
  }

  // Iconic Neon Entrance & Rooftop Marquee Signs
  const mainSignTex = createNeonSignTexture("PALM PARKING · 24H", '#ff4fa3');
  const mainSignMat = new THREE.MeshStandardMaterial({
    map: mainSignTex,
    emissive: '#ffffff',
    emissiveMap: mainSignTex,
    emissiveIntensity: 1.85,
  });
  const northSign = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 0.24), mainSignMat);
  northSign.position.set(0, 3.9, minZ - 0.42);
  northSign.rotation.y = Math.PI;
  scene.add(northSign);
  const southSign = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.5, 0.24), mainSignMat);
  southSign.position.set(0, 3.9, maxZ + 0.42);
  scene.add(southSign);

  const skySignTex = createNeonSignTexture('PALM PARKING · SKYDECK', '#36f1e6');
  const skySignMat = new THREE.MeshStandardMaterial({
    map: skySignTex,
    emissive: '#ffffff',
    emissiveMap: skySignTex,
    emissiveIntensity: 1.8,
  });
  const skySignN = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.85, 0.26), skySignMat);
  skySignN.position.set(5.0, FLOOR_H * 3 + 2.45, minZ);
  skySignN.rotation.y = Math.PI;
  scene.add(skySignN);
  const skySignS = skySignN.clone();
  skySignS.position.set(0, FLOOR_H * 3 + 2.45, maxZ);
  skySignS.rotation.y = 0;
  scene.add(skySignS);

  // Glass Art-Deco Elevator Shaft on NE Corner
  addVisual(new THREE.BoxGeometry(2.4, totalH + 1.6, 2.4), glassMat, HALF_W - 0.4, (totalH + 1.6) / 2, minZ + 0.4);
  addVisual(new THREE.BoxGeometry(0.16, totalH + 1.4, 0.16), cyanNeon, HALF_W + 0.82, (totalH + 1.4) / 2, minZ - 0.8);

  // Rooftop Skydeck Details: 4 Corner Palm Planters, Pay Kiosk & Floodlights
  const roofY = FLOOR_H * 3;
  for (const [px, pz] of [
    [-18.0, 72.0],
    [18.0, 72.0],
    [18.0, 36.2],
    [-18.0, 42.5],
  ]) {
    addVisual(new THREE.BoxGeometry(1.8, 0.78, 1.8), concreteCreamMat, px, roofY + 0.39, pz);
    palmPositions.push({ x: px, y: roofY + 0.72, z: pz, rot: px * 0.4 + pz, scale: 0.84 });
  }
  addBox(2.2, 2.2, 1.0, 2.0, roofY + 1.1, maxZ - 0.9, mintTrimMat, true, 'parking-wall');
  addVisual(new THREE.BoxGeometry(1.3, 0.9, 0.08), cyanNeon, 2.0, roofY + 1.4, maxZ - 1.42);

  for (const [lx, lz] of [
    [-19.0, GZ],
    [19.0, GZ],
    [0.0, maxZ - 0.4],
  ]) {
    addVisual(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 8), steelDarkMat, lx, roofY + 2.3, lz);
    addVisual(new THREE.SphereGeometry(0.26, 8, 8), tubeLightMat, lx, roofY + 4.7, lz);
  }

  // ===========================================================================
  // 5) ROOFTOP SKYDECK STUNT RAMP (Launches North off P3 over the Boulevard!)
  // ===========================================================================
  const roofRamp: StuntRamp = {
    x: -9.6,
    z: minZ + 4.4,
    dirX: 0,
    dirZ: -1,
    width: 5.4,
    length: 8.5,
    height: 2.3,
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
  const rushStartPos = new THREE.Vector3(0.0, 0.0, northTurnZ - 1.2);

  const startRing = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 2.9, 32),
    new THREE.MeshBasicMaterial({ color: '#ff4fa3', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  startRing.rotation.x = -Math.PI / 2;
  startRing.position.set(rushStartPos.x, 0.06, rushStartPos.z);
  startRing.userData.dynamic = true;
  scene.add(startRing);

  const rushCheckpoints: { x: number; y: number; z: number; label: string }[] = [
    { x: LANE_CENTER_X, y: 1.8, z: GZ, label: 'RAMPE EG → P1' },
    { x: 0.0, y: FLOOR_H, z: southTurnZ, label: 'DECK P1 · SÜD-KEHRE' },
    { x: -LANE_CENTER_X, y: FLOOR_H * 1.5, z: GZ, label: 'RAMPE P1 → P2' },
    { x: 0.0, y: FLOOR_H * 2, z: northTurnZ, label: 'DECK P2 · NORD-KEHRE' },
    { x: LANE_CENTER_X, y: FLOOR_H * 2.5, z: GZ, label: 'RAMPE P2 → SKYDECK' },
    { x: -6.5, y: FLOOR_H * 3, z: GZ, label: 'P3 SKYDECK · ZIEL!' },
  ];

  const cpGroup = new THREE.Group();
  cpGroup.visible = false;
  cpGroup.userData.dynamic = true;
  const cpRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.15, 10, 28),
    new THREE.MeshBasicMaterial({ color: '#36f1e6' }),
  );
  cpRing.rotation.x = Math.PI / 2;
  cpRing.position.y = 0.25;
  cpGroup.add(cpRing);
  const cpBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3.4, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ff4fa3',
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cpBeam.position.y = 1.7;
  cpGroup.add(cpBeam);
  scene.add(cpGroup);

  const RUSH_TIME_LIMIT = 65.0;
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
      !rushActive && Math.hypot(pos.x - rushStartPos.x, pos.z - rushStartPos.z) < 5.0 && pos.y < 1.5,

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
      startRing.visible = !rushActive;
      if (!rushActive) {
        const s = 1 + Math.sin(elapsed * 4.0) * 0.06;
        startRing.scale.set(s, s, 1);
        return null;
      }

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
        if (horizDist < 4.8 && vertDist < 2.2) {
          rushCpIdx++;
          if (rushCpIdx >= rushCheckpoints.length) {
            rushActive = false;
            cpGroup.visible = false;
            const timeBonus = rushElapsed < 35.0 ? 600 : 0;
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
