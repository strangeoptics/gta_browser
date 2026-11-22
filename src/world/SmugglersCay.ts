import * as THREE from 'three';
import type { AABB } from '../types';
import { createWorldHelpers } from './BuildHelpers';
import { createNeonSignTexture } from './Textures';

export interface SmugglersCayHandle {
  getGroundHeight: (x: number, z: number) => number | null;
  isInsideShack: (pos: THREE.Vector3) => boolean;
  isNearLoot: (pos: THREE.Vector3) => boolean;
  takeLoot: () => void;
  isNearTikiBar: (pos: THREE.Vector3) => boolean;
  update: (elapsed: number, playerPos?: THREE.Vector3) => void;
}

// Island center & smooth sculpted elevation profile (x: 126..198, z: 62..132)
const CAY_X = 162.0;
const CAY_Z = 96.0;
const CAY_RX = 25.5;
const CAY_RZ = 23.5;

/**
 * Continuous procedural elevation function for Smuggler's Cay:
 * - Smoothly rises from -6.0m ocean seabed through a swimmable/walkable West sandy cove
 * - Flat central compound plateau at y = 1.40m (for Boathouse, Tiki Bar & Campfire)
 * - Dramatic 4.4m limestone cliff ridge on the East side (x = 173..184, z = 88..104)
 */
export function getSmugglersCayHeight(x: number, z: number): number | null {
  const dx = (x - CAY_X) / CAY_RX;
  const dz = (z - CAY_Z) / CAY_RZ;
  const r2 = dx * dx + dz * dz;
  if (r2 > 1.55) return null;

  const angle = Math.atan2(dz, dx);
  // Subtle organic coastline cove indentation on the West side (facing Miami)
  const coveIndent = Math.exp(-Math.pow((angle - Math.PI) * 1.4, 2)) * 0.16;
  const ripple = Math.sin(angle * 3.0 + 0.6) * 0.06 + Math.cos(angle * 5.0 - 0.4) * 0.035;
  const effR = Math.sqrt(r2) + coveIndent + ripple;

  if (effR >= 1.18) return null;

  // Base island profile: -6.0m seabed -> +1.40m flat central plateau
  const shoreT = THREE.MathUtils.clamp((1.15 - effR) / 0.55, 0, 1);
  const smoothShore = shoreT * shoreT * (3 - 2 * shoreT);
  let h = THREE.MathUtils.lerp(-6.0, 1.4, smoothShore);

  // Gently sculpted East limestone cliff ridge (center 177.5, 95.5) rising to y = 4.4m
  const cdx = (x - 177.5) / 8.8;
  const cdz = (z - 95.5) / 9.5;
  const cliffR = Math.hypot(cdx, cdz);
  if (cliffR < 1.0) {
    const ct = 1 - cliffR;
    const cliffSmooth = ct * ct * (3 - 2 * ct);
    h += cliffSmooth * 3.05;
  }

  return h;
}

// -----------------------------------------------------------------------------
// Procedural Tropical & Offshore Rig Textures (Zero External Assets!)
// -----------------------------------------------------------------------------

function createWeatheredWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#75563d';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 32) {
    const shade = (y / 32) % 2 === 0 ? '#7e5d42' : '#6b4d36';
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, 256, 30);
    ctx.fillStyle = 'rgba(20,12,8,0.45)';
    ctx.fillRect(0, y + 30, 256, 2);
    // Grain streaks
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,235,210,0.06)' : 'rgba(20,12,8,0.09)';
      ctx.fillRect((i * 43 + y) % 256, y + (i % 26), 34, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function createRustedTinTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5c5856';
  ctx.fillRect(0, 0, 256, 256);

  // Corrugated ribs
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(x + 3, 0, 2, 256);
  }
  // Salt-air rust patches
  for (let i = 0; i < 42; i++) {
    const rx = (i * 61) % 256;
    const ry = (i * 97) % 256;
    const rw = 14 + (i % 28);
    const rh = 18 + ((i * 3) % 34);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(138, 62, 34, 0.34)' : 'rgba(105, 48, 24, 0.28)';
    ctx.fillRect(rx, ry, rw, rh);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createOffshoreHelipadTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2d333b';
  ctx.fillRect(0, 0, 256, 256);

  // Steel grate grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 256; p += 16) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }

  // Yellow offshore aiming circle + crisp white H
  ctx.strokeStyle = '#f2b830';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 98, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f0ebe2';
  ctx.fillRect(84, 66, 20, 124);
  ctx.fillRect(152, 66, 20, 124);
  ctx.fillRect(84, 118, 88, 22);

  // Stenciled "RIG 86"
  ctx.fillStyle = '#f2b830';
  ctx.font = '900 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RIG 86 · CAY', 128, 244);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSeaChartScreenTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#071a16';
  ctx.fillRect(0, 0, 256, 160);

  // Radar rings & grid
  ctx.strokeStyle = 'rgba(54, 241, 180, 0.32)';
  ctx.lineWidth = 1.5;
  for (const r of [24, 48, 70]) {
    ctx.beginPath();
    ctx.arc(128, 84, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(128, 12);
  ctx.lineTo(128, 152);
  ctx.moveTo(20, 84);
  ctx.lineTo(236, 84);
  ctx.stroke();

  // Radar blips & tactical labels
  ctx.fillStyle = '#36f1e6';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('SMUGGLER RADAR · CH-06', 14, 20);
  ctx.fillStyle = '#ff4fa3';
  ctx.beginPath();
  ctx.arc(158, 66, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd15c';
  ctx.beginPath();
  ctx.arc(96, 98, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#52f29c';
  ctx.fillText('CARGO DROP: ACTIVE', 14, 148);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHazardStripeTexture(repeatX = 12): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8ad26';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#18181f';
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 4, 32);
    ctx.lineTo(x - 12, 32);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, 1);
  return tex;
}

/**
 * Builds "SMUGGLER'S CAY & OFFSHORE RIG 86" in the Southeast Ocean (x: 120..200, z: 55..135):
 * - Sculpted multi-tiered tropical island with swimmable West sandy cove, central compound plateau & 4.4m limestone cliff
 * - Weathered wooden boat jetty with mooring bollards, green/amber beacons & walkable beach ramp
 * - Walk-in "CAYO CONTRABANDO" Stilt Boathouse & Radio Shack (radar console, rum barrels, $3,500 Contraband Vault!)
 * - Offshore Rusted-Steel Rig Platform with 13x13m Helipad (H), animated rotating cargo crane & flickering flare stack
 * - Cliffside Cartel Watchtower with walkable stairs & sweeping volumetric coastal searchlight
 * - Cove Tiki Rum Bar ([F] Coconut Rum $45 -> 100% HP), crackling campfire, beached smuggler speedboat wreck & bobbing sea buoys
 * Zero extra PointLights added -> constant shader count & silky-smooth FPS!
 */
export function buildSmugglersCay(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[],
): SmugglersCayHandle {
  const { addBox, addVisual } = createWorldHelpers(scene, colliders, worldMeshes, 'smugglers-cay');

  // Shared PBR materials
  const woodMat = new THREE.MeshStandardMaterial({ map: createWeatheredWoodTexture(), roughness: 0.78 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#4d3524', roughness: 0.85 });
  const rustTinMat = new THREE.MeshStandardMaterial({ map: createRustedTinTexture(), roughness: 0.58, metalness: 0.45 });
  const rigSteelMat = new THREE.MeshStandardMaterial({ color: '#39404a', roughness: 0.54, metalness: 0.7 });
  const rustBeamMat = new THREE.MeshStandardMaterial({ color: '#783b28', roughness: 0.72, metalness: 0.35 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: createHazardStripeTexture(10), roughness: 0.48 });
  const crateMat = new THREE.MeshStandardMaterial({ color: '#8a6239', roughness: 0.74 });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#7a7066', roughness: 0.88 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#275c3e', roughness: 0.72 });
  const thatchMat = new THREE.MeshStandardMaterial({ color: '#b59254', roughness: 0.92 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: '#c4a464', roughness: 0.72 });
  const boatWhiteMat = new THREE.MeshStandardMaterial({ color: '#d8d5ce', roughness: 0.62 });
  const boatPinkMat = new THREE.MeshStandardMaterial({ color: '#c94c82', roughness: 0.55 });
  const boatCyanMat = new THREE.MeshStandardMaterial({ color: '#2fa39e', roughness: 0.55 });
  const sandbagMat = new THREE.MeshStandardMaterial({ color: '#a89674', roughness: 0.92 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.88 });
  const lifeboatOrangeMat = new THREE.MeshStandardMaterial({ color: '#e85a24', roughness: 0.36, metalness: 0.15 });
  const pipeYellowMat = new THREE.MeshStandardMaterial({ color: '#e8b63a', roughness: 0.38, metalness: 0.3 });
  const pipeBlueMat = new THREE.MeshStandardMaterial({ color: '#2c7ec4', roughness: 0.38, metalness: 0.35 });
  const fernMat = new THREE.MeshStandardMaterial({ color: '#2e7d4b', roughness: 0.68, side: THREE.DoubleSide });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#dde5ef', roughness: 0.2, metalness: 0.88 });
  const birdWhiteMat = new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.65 });
  const crabMats = [
    new THREE.MeshStandardMaterial({ color: '#e04832', roughness: 0.42, metalness: 0.12 }),
    new THREE.MeshStandardMaterial({ color: '#eb7426', roughness: 0.44, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: '#b8292f', roughness: 0.4, metalness: 0.14 }),
    new THREE.MeshStandardMaterial({ color: '#d48a3c', roughness: 0.48, metalness: 0.08 }),
  ];
  const crabEyeMat = new THREE.MeshStandardMaterial({ color: '#0d0e12', roughness: 0.12, metalness: 0.6 });

  // Thin emissive accents (> 1.0 bloom strictly on small bulbs/flames/neon tubes!)
  const greenBulbMat = new THREE.MeshStandardMaterial({ color: '#52f29c', emissive: '#32e880', emissiveIntensity: 3.0 });
  const redBulbMat = new THREE.MeshStandardMaterial({ color: '#ff334b', emissive: '#ff1f3a', emissiveIntensity: 3.1 });
  const amberBulbMat = new THREE.MeshStandardMaterial({ color: '#ffd17a', emissive: '#ff9f43', emissiveIntensity: 2.8 });
  const pinkBulbMat = new THREE.MeshStandardMaterial({ color: '#ff70b8', emissive: '#ff4fa3', emissiveIntensity: 2.6 });
  const goldGlowMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', emissive: '#ffaa22', emissiveIntensity: 1.9 });
  const emeraldGlowMat = new THREE.MeshStandardMaterial({ color: '#42f59b', emissive: '#22d67c', emissiveIntensity: 1.6 });
  const flameMat = new THREE.MeshStandardMaterial({ color: '#ffbb44', emissive: '#ff6611', emissiveIntensity: 3.2 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.1 });
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 8);

  // ===========================================================================
  // 1) SCULPTED VERTEX-COLORED TROPICAL ISLAND TERRAIN (x: 132..192, z: 68..124)
  // ===========================================================================
  const segX = 56;
  const segZ = 56;
  const terrW = 68;
  const terrD = 64;
  const terrGeo = new THREE.PlaneGeometry(terrW, terrD, segX, segZ);
  terrGeo.rotateX(-Math.PI / 2);

  const posAttr = terrGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cSeabed = new THREE.Color('#21363c');
  const cWetSand = new THREE.Color('#b6926c');
  const cDrySand = new THREE.Color('#e2c799');
  const cJungle = new THREE.Color('#356a46');
  const cCliff = new THREE.Color('#807468');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i) + CAY_X;
    const wz = posAttr.getZ(i) + CAY_Z;
    const h = getSmugglersCayHeight(wx, wz) ?? -6.0;
    posAttr.setY(i, h);

    if (h < -0.5) {
      tmpCol.copy(cSeabed).lerp(cWetSand, THREE.MathUtils.clamp((h + 3.0) / 2.5, 0, 1));
    } else if (h < 0.35) {
      tmpCol.copy(cWetSand).lerp(cDrySand, (h + 0.5) / 0.85);
    } else if (h < 1.28) {
      tmpCol.copy(cDrySand).lerp(cJungle, THREE.MathUtils.clamp((h - 0.55) / 0.73, 0, 1));
    } else if (h < 2.2) {
      // Blend sand & lush grass on the compound plateau
      const grassMix = 0.55 + 0.35 * Math.sin(wx * 0.25) * Math.cos(wz * 0.25);
      tmpCol.copy(cDrySand).lerp(cJungle, THREE.MathUtils.clamp(grassMix, 0, 1));
    } else {
      tmpCol.copy(cJungle).lerp(cCliff, THREE.MathUtils.clamp((h - 2.0) / 1.4, 0, 1));
    }
    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }
  terrGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrGeo.computeVertexNormals();

  const islandMesh = new THREE.Mesh(
    terrGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 }),
  );
  islandMesh.position.set(CAY_X, 0, CAY_Z);
  islandMesh.receiveShadow = true;
  scene.add(islandMesh);
  worldMeshes.push(islandMesh);

  // 18 Leaning Tropical Palms across Smuggler's Cay (batched into CityBuilder's InstancedMesh!)
  const cayPalms: [number, number, number][] = [
    [146, 84, 1.05],
    [150, 79, 0.94],
    [164, 78, 1.02],
    [172, 82, 0.96],
    [176, 86, 1.08],
    [181, 91, 0.9],
    [182, 100, 0.98],
    [176, 106, 1.04],
    [169, 105, 0.92],
    [152, 108, 1.05],
    [145, 105, 0.96],
    [144, 92, 0.9],
    [155, 76, 1.0],
    [168, 79, 0.95],
    [174, 99, 0.88],
    [160, 107, 0.94],
    [148, 88, 0.86],
    [169, 92, 1.02],
  ];
  for (const [px, pz, sc] of cayPalms) {
    const py = getSmugglersCayHeight(px, pz) ?? 1.2;
    if (py > 0.25) {
      palmPositions.push({ x: px, y: py - 0.08, z: pz, rot: px * 0.8 + pz * 0.4, scale: sc });
    }
  }

  // Coastal Limestone Boulders & Tropical Jungle Bushes
  const boulderSpecs: [number, number, number][] = [
    [141, 86, 1.35],
    [144, 79, 1.15],
    [169, 77, 1.45],
    [184, 94, 1.8],
    [182, 103, 1.55],
    [173, 106, 1.25],
    [143, 106, 1.4],
    [154, 111, 1.15],
  ];
  const boulderGeo = new THREE.DodecahedronGeometry(1.0, 0);
  for (const [bx, bz, br] of boulderSpecs) {
    const by = getSmugglersCayHeight(bx, bz) ?? 0.5;
    const m = new THREE.Mesh(boulderGeo, rockMat);
    m.position.set(bx, by + br * 0.35, bz);
    m.scale.set(br * 1.15, br * 0.72, br);
    m.rotation.set(bx * 0.3, bz * 0.5, 0.2);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  const bushGeo = new THREE.DodecahedronGeometry(0.85, 1);
  for (const [bx, bz] of [
    [149, 82],
    [153, 80],
    [167, 81],
    [170, 86],
    [171, 98],
    [166, 104],
    [147, 104],
    [152, 106],
    [179, 89],
    [179, 101],
  ]) {
    const by = getSmugglersCayHeight(bx, bz) ?? 1.2;
    const bush = new THREE.Mesh(bushGeo, foliageMat);
    bush.position.set(bx, by + 0.45, bz);
    bush.scale.set(1.25, 0.75, 1.15);
    scene.add(bush);
  }

  // Instanced Lush Tropical Fern Fronds scattered across the island (48 ferns, 1 draw call!)
  const fernGeo = new THREE.ConeGeometry(0.45, 1.35, 4);
  fernGeo.scale(1.0, 1.0, 0.14);
  fernGeo.rotateX(Math.PI / 2.6);
  fernGeo.translate(0, 0.25, 0.52);
  const fernCount = 48;
  const fernInst = new THREE.InstancedMesh(fernGeo, fernMat, fernCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < fernCount; i++) {
    const ang = i * 2.39996; // golden angle spiral
    const rad = 5.5 + (i % 12) * 1.45;
    const fx = CAY_X + Math.cos(ang) * rad;
    const fz = CAY_Z + Math.sin(ang) * rad * 0.9;
    const fy = getSmugglersCayHeight(fx, fz);
    if (fy !== null && fy > 0.75 && !(fx > 152 && fx < 167 && fz > 82 && fz < 94)) {
      dummy.position.set(fx, fy - 0.04, fz);
      dummy.rotation.set(0, ang * 2.1, 0);
      dummy.scale.setScalar(0.8 + (i % 4) * 0.18);
    } else {
      dummy.position.set(0, -50, 0);
      dummy.scale.setScalar(0.01);
    }
    dummy.updateMatrix();
    fernInst.setMatrixAt(i, dummy.matrix);
  }
  fernInst.instanceMatrix.needsUpdate = true;
  scene.add(fernInst);

  // 8 Bamboo Tiki Torches lining the island trails (animated flickering flames!)
  const tikiFlames: { mesh: THREE.Mesh; phase: number }[] = [];
  for (const [tx, tz, ph] of [
    [149.2, 93.8, 0.0],
    [149.2, 98.2, 1.1],
    [155.5, 95.8, 2.2],
    [163.5, 95.8, 3.3],
    [168.5, 93.6, 4.4],
    [168.5, 97.6, 5.5],
    [158.0, 104.5, 1.7],
    [164.0, 104.5, 2.9],
  ] as [number, number, number][]) {
    const ty = getSmugglersCayHeight(tx, tz) ?? 1.4;
    addVisual(new THREE.CylinderGeometry(0.05, 0.06, 1.85, 6), bambooMat, tx, ty + 0.92, tz);
    addVisual(new THREE.CylinderGeometry(0.13, 0.07, 0.28, 8), darkWoodMat, tx, ty + 1.88, tz);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), flameMat);
    fl.position.set(tx, ty + 2.14, tz);
    fl.userData.dynamic = true;
    scene.add(fl);
    tikiFlames.push({ mesh: fl, phase: ph });
  }

  // Warm Tropical Festoon String Lights strung between Boathouse Porch, Tiki Bar & Palms
  const addStringLightSpan = (
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    bulbs: number,
    sag = 0.65,
  ) => {
    const mats = [amberBulbMat, pinkBulbMat, cyanNeon];
    for (let i = 1; i <= bulbs; i++) {
      const t = i / (bulbs + 1);
      const bx = THREE.MathUtils.lerp(p1.x, p2.x, t);
      const bz = THREE.MathUtils.lerp(p1.z, p2.z, t);
      const by = THREE.MathUtils.lerp(p1.y, p2.y, t) - Math.sin(t * Math.PI) * sag;
      addVisual(new THREE.SphereGeometry(0.09, 6, 6), mats[i % mats.length], bx, by, bz);
    }
  };
  addStringLightSpan(new THREE.Vector3(153.6, 4.9, 93.8), new THREE.Vector3(152.5, 4.1, 103.5), 7, 0.75);
  addStringLightSpan(new THREE.Vector3(165.4, 4.9, 93.8), new THREE.Vector3(169.0, 4.4, 92.0), 5, 0.45);
  addStringLightSpan(new THREE.Vector3(153.6, 4.9, 93.8), new THREE.Vector3(148.0, 4.2, 88.0), 6, 0.6);

  // Beach Hammock slung between two West-Cove Palms (x ~ 146..148, z ~ 84..88)
  const hamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.2, 8, 1, true, 0, Math.PI), boatPinkMat);
  hamMesh.position.set(147.0, 2.35, 86.0);
  hamMesh.rotation.set(Math.PI / 2, 0.46, Math.PI);
  scene.add(hamMesh);

  // Circling Tropical Sea Birds high above Smuggler's Cay
  const skyBirds: { group: THREE.Group; wingL: THREE.Mesh; wingR: THREE.Mesh; radius: number; height: number; speed: number; phase: number }[] = [];
  for (let b = 0; b < 4; b++) {
    const bg = new THREE.Group();
    bg.userData.dynamic = true;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.72, 6), birdWhiteMat);
    body.rotation.x = Math.PI / 2;
    bg.add(body);
    const wingGeo = new THREE.BoxGeometry(0.95, 0.04, 0.24);
    const wingL = new THREE.Mesh(wingGeo, birdWhiteMat);
    wingL.position.set(-0.48, 0.04, 0);
    bg.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, birdWhiteMat);
    wingR.position.set(0.48, 0.04, 0);
    bg.add(wingR);
    scene.add(bg);
    skyBirds.push({
      group: bg,
      wingL,
      wingR,
      radius: 18 + b * 4.5,
      height: 15.5 + b * 2.4,
      speed: 0.34 + b * 0.05,
      phase: b * 1.57,
    });
  }

  // ===========================================================================
  // 2) WEATHERED WOODEN SMUGGLER BOAT JETTY & FUEL DOCK (x = 127..145, z = 96)
  // ===========================================================================
  const pierY = 0.68;
  // Main wooden jetty deck extending into deep West ocean for Speedboat/Yacht docking
  addBox(18.0, 0.24, 4.2, 136.0, pierY - 0.12, 96.0, woodMat, true, 'smugglers-pier');
  // T-head docking cross-pier at outer end (x = 127.5, z = 90..102)
  addBox(3.4, 0.24, 12.0, 127.5, pierY - 0.12, 96.0, woodMat, true, 'smugglers-pier');

  // Timber pilings driven into the seabed + glowing green/amber dock lanterns
  for (const px of [126.2, 129.0, 133.0, 137.0, 141.0, 144.5]) {
    for (const pz of [94.1, 97.9]) {
      addVisual(new THREE.CylinderGeometry(0.18, 0.2, 7.2, 8), darkWoodMat, px, pierY - 3.3, pz);
    }
  }
  for (const pz of [90.4, 101.6]) {
    addVisual(new THREE.CylinderGeometry(0.18, 0.2, 7.4, 8), darkWoodMat, 126.2, pierY - 3.1, pz);
    addVisual(new THREE.CylinderGeometry(0.18, 0.2, 7.4, 8), darkWoodMat, 128.8, pierY - 3.1, pz);
    // Green navigation beacon at outer pier tips
    addVisual(bulbGeo, greenBulbMat, 126.2, pierY + 0.75, pz);
  }
  // Wooden lantern posts along main jetty
  for (const px of [133.0, 141.0]) {
    addVisual(new THREE.BoxGeometry(0.14, 1.7, 0.14), darkWoodMat, px, pierY + 0.85, 94.1);
    addVisual(bulbGeo, amberBulbMat, px, pierY + 1.76, 94.1);
  }
  // Walkable wooden beach steps connecting jetty (x=145, y=0.68) up to sandy cove (x=147.5, y=1.35)
  for (let s = 0; s < 4; s++) {
    const sy = pierY + (s + 1) * 0.18;
    addBox(0.65, 0.18, 3.6, 145.3 + s * 0.62, sy - 0.09, 96.0, woodMat, false, 'smugglers-pier');
  }
  // Contraband crates, fuel dispenser, hanging rubber boat fenders & Pier Archway ("DOCK 01")
  addBox(1.1, 0.9, 1.1, 127.8, pierY + 0.45, 91.8, crateMat, true, 'smugglers-prop');
  addVisual(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10), rustBeamMat, 127.8, pierY + 0.48, 100.2);
  // Marine Fuel Pump Dispenser on jetty
  addBox(0.55, 1.35, 0.45, 128.4, pierY + 0.68, 99.1, lifeboatOrangeMat, true, 'smugglers-prop');
  addVisual(new THREE.BoxGeometry(0.42, 0.35, 0.48), chromeMat, 128.4, pierY + 1.05, 99.1);
  // Rubber tire fenders bolted along outer dock face
  const fenderGeo = new THREE.TorusGeometry(0.28, 0.1, 8, 14);
  for (const fz of [91.5, 94.0, 98.0, 100.5]) {
    const fend = new THREE.Mesh(fenderGeo, rubberMat);
    fend.position.set(125.8, pierY - 0.12, fz);
    fend.rotation.y = Math.PI / 2;
    scene.add(fend);
  }
  // Wooden Pier Welcome Archway at landward end (x = 143.8, z = 96)
  for (const az of [94.05, 97.95]) {
    addVisual(new THREE.BoxGeometry(0.22, 3.6, 0.22), darkWoodMat, 143.8, pierY + 1.8, az);
  }
  addVisual(new THREE.BoxGeometry(0.26, 0.28, 4.3), darkWoodMat, 143.8, pierY + 3.55, 96.0);
  const dockSignTex = createNeonSignTexture("SMUGGLER'S CAY · DOCK 01", '#36f1e6');
  const dockSignMat = new THREE.MeshStandardMaterial({
    map: dockSignTex,
    emissive: '#ffffff',
    emissiveMap: dockSignTex,
    emissiveIntensity: 1.55,
  });
  const dockSign = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 3.6), dockSignMat);
  dockSign.position.set(143.8, pierY + 3.65, 96.0);
  scene.add(dockSign);

  // Gently bobbing Moored Wooden Rowboat / Dinghy tied beside the North side of the Jetty (x = 134, z = 92.2)
  const dinghyGroup = new THREE.Group();
  dinghyGroup.position.set(134.5, -0.08, 92.2);
  dinghyGroup.rotation.y = 0.12;
  dinghyGroup.userData.dynamic = true;
  const dHull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.46, 1.45), woodMat);
  dinghyGroup.add(dHull);
  const dSeatA = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 1.38), darkWoodMat);
  dSeatA.position.set(-0.55, 0.2, 0);
  dinghyGroup.add(dSeatA);
  const dSeatB = dSeatA.clone();
  dSeatB.position.x = 0.55;
  dinghyGroup.add(dSeatB);
  const dCrate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), crateMat);
  dCrate.position.set(0, 0.36, 0);
  dinghyGroup.add(dCrate);
  scene.add(dinghyGroup);

  // ===========================================================================
  // 3) WALK-IN "CAYO CONTRABANDO" STILT BOATHOUSE & RADIO SHACK (x=153..166, z=83..92)
  // ===========================================================================
  const sX = 159.5;
  const sZ = 87.5;
  const sW = 13.0;
  const sD = 9.0;
  const sFloorY = 1.62;
  const sH = 3.8;

  // Raised timber stilt deck + front porch (extends South to z = 94.0)
  addBox(sW + 0.6, 0.24, sD + 2.6, sX, sFloorY - 0.12, sZ + 1.0, woodMat, true, 'smugglers-shack');
  // Porch entry steps on South edge (z = 93.3 .. 94.6, riser = 0.18m!)
  addBox(3.4, 0.18, 0.55, sX, 1.48, 93.65, woodMat, false, 'smugglers-shack');
  // Stilts underneath
  for (const sx of [sX - 6.2, sX, sX + 6.2]) {
    for (const sz of [sZ - 4.2, sZ + 4.2, sZ + 6.2]) {
      addVisual(new THREE.CylinderGeometry(0.16, 0.18, 1.6, 8), darkWoodMat, sx, sFloorY - 0.9, sz);
    }
  }

  // Hollow Timber Walls with wide 3.2m South doorway (facing compound & sea!)
  // South wall (z = 92.0): gap at x = 157.9 .. 161.1
  addBox(4.9, sH, 0.32, 155.45, sFloorY + sH / 2, 92.0, woodMat, true, 'smugglers-shack');
  addBox(4.9, sH, 0.32, 163.55, sFloorY + sH / 2, 92.0, woodMat, true, 'smugglers-shack');
  addBox(3.2, 1.15, 0.32, 159.5, sFloorY + sH - 0.57, 92.0, woodMat, false, 'smugglers-lintel');
  // North, West & East walls
  addBox(sW, sH, 0.32, sX, sFloorY + sH / 2, 83.0, woodMat, true, 'smugglers-shack');
  addBox(0.32, sH, sD, 153.0, sFloorY + sH / 2, sZ, woodMat, true, 'smugglers-shack');
  addBox(0.32, sH, sD, 166.0, sFloorY + sH / 2, sZ, woodMat, true, 'smugglers-shack');

  // Corrugated Rusted-Tin Pitched Roof extending over the South Porch
  const roofSlopeL = new THREE.Mesh(new THREE.BoxGeometry(sW + 1.4, 0.18, 6.8), rustTinMat);
  roofSlopeL.position.set(sX, sFloorY + sH + 0.55, sZ - 1.6);
  roofSlopeL.rotation.x = -0.22;
  roofSlopeL.castShadow = true;
  scene.add(roofSlopeL);
  const roofSlopeR = new THREE.Mesh(new THREE.BoxGeometry(sW + 1.4, 0.18, 7.6), rustTinMat);
  roofSlopeR.position.set(sX, sFloorY + sH + 0.45, sZ + 2.8);
  roofSlopeR.rotation.x = 0.22;
  roofSlopeR.castShadow = true;
  scene.add(roofSlopeR);

  // Porch Roof Columns, Wooden Porch Railings, Shortwave Radio Mast & Neon Sign "CAYO CONTRABANDO '86"
  for (const px of [153.6, 157.5, 161.5, 165.4]) {
    addVisual(new THREE.BoxGeometry(0.16, sH - 0.3, 0.16), darkWoodMat, px, sFloorY + (sH - 0.3) / 2, 93.8);
  }
  // Porch railing on left & right of steps (leaves center doorway x=157.5..161.5 open!)
  for (const rx of [155.55, 163.45]) {
    addVisual(new THREE.BoxGeometry(3.9, 0.1, 0.1), darkWoodMat, rx, sFloorY + 0.92, 93.8);
    addVisual(new THREE.BoxGeometry(3.9, 0.08, 0.08), darkWoodMat, rx, sFloorY + 0.48, 93.8);
  }
  // Tall Guy-Wired Shortwave Radio Mast next to Boathouse (x = 152.2, z = 83.2)
  addVisual(new THREE.CylinderGeometry(0.06, 0.12, 11.5, 8), rigSteelMat, 152.2, sFloorY + 5.75, 83.2);
  addVisual(new THREE.BoxGeometry(2.4, 0.06, 0.06), chromeMat, 152.2, sFloorY + 10.6, 83.2);
  addVisual(new THREE.BoxGeometry(0.06, 0.06, 2.4), chromeMat, 152.2, sFloorY + 9.8, 83.2);
  addVisual(bulbGeo, redBulbMat, 152.2, sFloorY + 11.65, 83.2);

  // Hanging Vintage Ceiling Fan inside Boathouse (slowly spinning!)
  const ceilingFan = new THREE.Group();
  ceilingFan.position.set(sX, sFloorY + sH - 0.25, sZ);
  ceilingFan.userData.dynamic = true;
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10), darkWoodMat);
  ceilingFan.add(fanHub);
  for (let fb = 0; fb < 4; fb++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.22), darkWoodMat);
    const ang = (fb * Math.PI) / 2;
    blade.position.set(Math.cos(ang) * 0.62, 0, Math.sin(ang) * 0.62);
    blade.rotation.y = -ang;
    ceilingFan.add(blade);
  }
  const fanLight = new THREE.Mesh(bulbGeo, amberBulbMat);
  fanLight.position.y = -0.22;
  ceilingFan.add(fanLight);
  scene.add(ceilingFan);

  // Contraband Weapons Rack on North Interior Wall + Reel-to-Reel Tape Deck
  addVisual(new THREE.BoxGeometry(2.6, 1.35, 0.14), darkWoodMat, 156.2, sFloorY + 1.85, 83.24);
  for (let w = 0; w < 4; w++) {
    addVisual(new THREE.BoxGeometry(0.08, 0.95, 0.08), rigSteelMat, 155.3 + w * 0.58, sFloorY + 1.85, 83.34);
  }
  const shackSignTex = createNeonSignTexture("CAYO CONTRABANDO '86", '#ff4fa3');
  const shackSignMat = new THREE.MeshStandardMaterial({
    map: shackSignTex,
    emissive: '#ffffff',
    emissiveMap: shackSignTex,
    emissiveIntensity: 1.7,
  });
  const shackSign = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.05, 0.16), shackSignMat);
  shackSign.position.set(sX, sFloorY + sH - 0.1, 94.0);
  scene.add(shackSign);

  // Interior Radio & Tactical Sea-Chart Console (West side of shack)
  addBox(1.2, 0.95, 3.8, 154.1, sFloorY + 0.48, 86.8, darkWoodMat, true, 'smugglers-prop');
  const radarScreenTex = createSeaChartScreenTexture();
  const radarScreenMat = new THREE.MeshStandardMaterial({
    map: radarScreenTex,
    emissive: '#ffffff',
    emissiveMap: radarScreenTex,
    emissiveIntensity: 0.9,
  });
  addVisual(new THREE.BoxGeometry(0.45, 0.72, 1.15), rigSteelMat, 154.0, sFloorY + 1.32, 86.2);
  addVisual(new THREE.BoxGeometry(0.06, 0.56, 0.96), radarScreenMat, 154.24, sFloorY + 1.32, 86.2);
  // Shortwave radio box + warm desk lantern
  addVisual(new THREE.BoxGeometry(0.42, 0.36, 0.85), rigSteelMat, 154.0, sFloorY + 1.14, 87.8);
  addVisual(bulbGeo, amberBulbMat, 154.1, sFloorY + 1.52, 88.2);

  // Stacked Contraband Crates & Rum Barrels (East side of shack)
  addBox(1.4, 1.1, 1.4, 164.4, sFloorY + 0.55, 84.5, crateMat, true, 'smugglers-prop');
  addBox(1.2, 1.0, 1.2, 164.4, sFloorY + 0.5, 89.8, crateMat, true, 'smugglers-prop');
  addVisual(new THREE.CylinderGeometry(0.36, 0.4, 0.98, 10), darkWoodMat, 164.4, sFloorY + 0.49, 86.6);
  addVisual(new THREE.CylinderGeometry(0.36, 0.4, 0.98, 10), darkWoodMat, 164.4, sFloorY + 0.49, 87.7);

  // Interactive Master Contraband Vault inside Shack (x = 159.5, z = 85.4 -> +$3,500!)
  const lootPos = new THREE.Vector3(159.5, sFloorY, 85.4);
  let lootTaken = false;
  const lootGroup = new THREE.Group();
  lootGroup.position.copy(lootPos);
  lootGroup.userData.dynamic = true;
  const lootTable = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.2), crateMat);
  lootTable.position.y = 0.4;
  lootGroup.add(lootTable);
  const goldStackA = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.55), goldGlowMat);
  goldStackA.position.set(-0.42, 1.01, -0.05);
  lootGroup.add(goldStackA);
  const goldStackB = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.38, 0.52), goldGlowMat);
  goldStackB.position.set(0.4, 0.99, 0.08);
  goldStackB.rotation.y = 0.25;
  lootGroup.add(goldStackB);
  const emeraldPack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.34), emeraldGlowMat);
  emeraldPack.position.set(0.0, 1.32, 0.02);
  emeraldPack.rotation.y = -0.18;
  lootGroup.add(emeraldPack);
  const lootRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.42, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd15c', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  lootRing.rotation.x = -Math.PI / 2;
  lootRing.position.y = 0.04;
  lootGroup.add(lootRing);
  scene.add(lootGroup);

  // ===========================================================================
  // 4) OFFSHORE RUSTED-STEEL RIG PLATFORM & HELIPAD (x = 156..170, z = 111..125)
  // ===========================================================================
  const rigX = 163.0;
  const rigZ = 118.0;
  const rigY = 2.65;

  // 4 Massive Offshore Steel Caisson Legs plunged into -6m seabed + X-bracing
  for (const lx of [rigX - 6.0, rigX + 6.0]) {
    for (const lz of [rigZ - 6.0, rigZ + 6.0]) {
      addVisual(new THREE.CylinderGeometry(0.55, 0.65, 9.2, 12), rustBeamMat, lx, rigY - 4.4, lz, true);
    }
  }
  // Horizontal subsea/splash-zone cross beams + diagonal X-bracing
  addVisual(new THREE.BoxGeometry(12.2, 0.45, 0.45), rigSteelMat, rigX, 0.85, rigZ - 6.0);
  addVisual(new THREE.BoxGeometry(12.2, 0.45, 0.45), rigSteelMat, rigX, 0.85, rigZ + 6.0);
  addVisual(new THREE.BoxGeometry(0.45, 0.45, 12.2), rigSteelMat, rigX - 6.0, 0.85, rigZ);
  addVisual(new THREE.BoxGeometry(0.45, 0.45, 12.2), rigSteelMat, rigX + 6.0, 0.85, rigZ);
  for (const diagSign of [-1, 1]) {
    const diagF = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.24, 0.24), rustBeamMat);
    diagF.position.set(rigX, 1.75, rigZ + 6.0);
    diagF.rotation.z = diagSign * 0.26;
    scene.add(diagF);
    const diagW = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 12.8), rustBeamMat);
    diagW.position.set(rigX - 6.0, 1.75, rigZ);
    diagW.rotation.x = diagSign * 0.26;
    scene.add(diagW);
  }

  // Heavy Offshore Rig Main Deck + 13x13m Steel Grate Helipad (H)
  addBox(14.0, 0.42, 14.0, rigX, rigY - 0.21, rigZ, rigSteelMat, true, 'smugglers-rig');
  const rigPad = new THREE.Mesh(
    new THREE.PlaneGeometry(12.4, 12.4),
    new THREE.MeshStandardMaterial({ map: createOffshoreHelipadTexture(), roughness: 0.48, metalness: 0.45 }),
  );
  rigPad.rotation.x = -Math.PI / 2;
  rigPad.position.set(rigX, rigY + 0.02, rigZ);
  rigPad.receiveShadow = true;
  scene.add(rigPad);

  // Offshore Rig Industrial Details: NW Control Cabin, Color-Coded Pipeline Manifold & Suspended Orange Lifeboat
  addBox(3.4, 2.4, 2.8, rigX - 4.8, rigY + 1.2, rigZ - 5.2, rustTinMat, true, 'smugglers-rig');
  addVisual(new THREE.BoxGeometry(1.4, 0.72, 0.1), cyanNeon, rigX - 4.8, rigY + 1.5, rigZ - 3.76);
  // Color-coded high-pressure offshore pipelines + valve wheels along South rig edge
  const pipeY = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 9.6, 10), pipeYellowMat);
  pipeY.rotation.z = Math.PI / 2;
  pipeY.position.set(rigX - 0.8, rigY + 0.3, rigZ + 6.55);
  scene.add(pipeY);
  const pipeB = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9.6, 10), pipeBlueMat);
  pipeB.rotation.z = Math.PI / 2;
  pipeB.position.set(rigX - 0.8, rigY + 0.58, rigZ + 6.55);
  scene.add(pipeB);
  for (const vx of [rigX - 3.5, rigX - 0.5, rigX + 2.5]) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12), lifeboatOrangeMat);
    valve.position.set(vx, rigY + 0.82, rigZ + 6.55);
    scene.add(valve);
  }
  // Suspended Orange Offshore Lifeboat Capsule on Steel Davit Arms (West side of Rig!)
  for (const dz of [rigZ + 1.2, rigZ + 4.4]) {
    addVisual(new THREE.BoxGeometry(1.8, 0.18, 0.18), rigSteelMat, rigX - 7.5, rigY + 1.85, dz);
    addVisual(new THREE.BoxGeometry(0.18, 2.0, 0.18), rigSteelMat, rigX - 6.75, rigY + 0.95, dz);
  }
  const lifeboat = new THREE.Mesh(new THREE.CapsuleGeometry(0.78, 2.4, 8, 12), lifeboatOrangeMat);
  lifeboat.rotation.x = Math.PI / 2;
  lifeboat.position.set(rigX - 7.9, rigY + 0.65, rigZ + 2.8);
  lifeboat.castShadow = true;
  scene.add(lifeboat);

  // Fluttering Rig Windsock on SW Rig Corner
  addVisual(new THREE.CylinderGeometry(0.06, 0.09, 3.8, 8), rigSteelMat, rigX - 6.4, rigY + 1.9, rigZ + 6.4);
  const rigWindsock = new THREE.Group();
  rigWindsock.position.set(rigX - 6.4, rigY + 3.65, rigZ + 6.4);
  rigWindsock.userData.dynamic = true;
  for (let ws = 0; ws < 4; ws++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24 - ws * 0.04, 0.28 - ws * 0.04, 0.36, 8, 1, true),
      ws % 2 === 0 ? lifeboatOrangeMat : boatWhiteMat,
    );
    seg.rotation.z = -Math.PI / 2;
    seg.position.set(0.28 + ws * 0.34, -ws * 0.04, 0);
    rigWindsock.add(seg);
  }
  scene.add(rigWindsock);

  // Hazard border trims & perimeter green helipad LEDs + red corner beacons
  addVisual(new THREE.BoxGeometry(14.1, 0.36, 0.2), hazardMat, rigX, rigY - 0.18, rigZ + 7.05);
  addVisual(new THREE.BoxGeometry(0.2, 0.36, 14.1), hazardMat, rigX - 7.05, rigY - 0.18, rigZ);
  addVisual(new THREE.BoxGeometry(0.2, 0.36, 14.1), hazardMat, rigX + 7.05, rigY - 0.18, rigZ);
  for (const [hx, hz] of [
    [rigX - 6.3, rigZ - 6.3],
    [rigX + 6.3, rigZ - 6.3],
    [rigX - 6.3, rigZ + 6.3],
    [rigX + 6.3, rigZ + 6.3],
  ]) {
    addVisual(bulbGeo, greenBulbMat, hx, rigY + 0.18, hz);
  }

  // Walkable Steel Catwalk & Staircase connecting Island Compound (z=105, y=1.35) -> Offshore Rig (z=111, y=2.65)
  const rigSteps = 7; // 7 * 0.19m = 1.33m climb!
  for (let i = 0; i < rigSteps; i++) {
    const sy = 1.32 + (i + 1) * 0.19;
    addBox(2.4, 0.19, 0.52, rigX - 2.0, sy - 0.095, 107.2 + i * 0.52, rigSteelMat, false, 'smugglers-rig');
  }
  addBox(2.4, 0.2, 2.2, rigX - 2.0, 1.32, 106.0, rigSteelMat, true, 'smugglers-rig');
  // Handrails along rig bridge
  for (const rx of [rigX - 3.15, rigX - 0.85]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.4), cyanNeon);
    rail.position.set(rx, 2.85, 108.8);
    rail.rotation.x = -0.32;
    scene.add(rail);
  }

  // Animated Rotating Offshore Cargo Crane on NE Rig Corner (x = 169.2, z = 112.2)
  const cranePivot = new THREE.Group();
  cranePivot.position.set(rigX + 6.0, rigY, rigZ - 5.6);
  cranePivot.userData.dynamic = true;
  const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 2.4, 10), rustBeamMat);
  craneBase.position.y = 1.2;
  cranePivot.add(craneBase);
  const craneCab = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.5, 1.8), hazardMat);
  craneCab.position.set(0, 2.95, 0);
  cranePivot.add(craneCab);
  const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 10.5), rustBeamMat);
  craneBoom.position.set(0, 5.4, 4.4);
  craneBoom.rotation.x = -0.42;
  cranePivot.add(craneBoom);
  const craneCable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 6), rigSteelMat);
  craneCable.position.set(0, 5.1, 8.8);
  cranePivot.add(craneCable);
  const craneCrate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.5), crateMat);
  craneCrate.position.set(0, 2.6, 8.8);
  cranePivot.add(craneCrate);
  scene.add(cranePivot);

  // Offshore Gas Flare Stack on SE Rig Corner (animated flickering flame!)
  const flareX = rigX + 6.2;
  const flareZ = rigZ + 6.2;
  addVisual(new THREE.CylinderGeometry(0.18, 0.28, 7.2, 8), rigSteelMat, flareX, rigY + 3.6, flareZ);
  const flareFlame = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.75, 8), flameMat);
  flareFlame.position.set(flareX, rigY + 7.9, flareZ);
  flareFlame.userData.dynamic = true;
  scene.add(flareFlame);

  // ===========================================================================
  // 5) CLIFFSIDE CARTEL WATCHTOWER & SWEEPING COASTAL SEARCHLIGHT (x=177.5, z=95.5)
  // ===========================================================================
  const wtX = 177.5;
  const wtZ = 95.5;
  const wtBaseY = getSmugglersCayHeight(wtX, wtZ) ?? 4.35;

  // Walkable wooden cliff stairs climbing from central plateau (x=169.5, y=1.45) up East ridge to watchtower (x=175.0, y=4.3)
  for (let i = 0; i < 14; i++) {
    const sy = 1.45 + (i + 1) * 0.21;
    addBox(0.46, 0.21, 2.0, 169.4 + i * 0.44, sy - 0.105, 95.5, woodMat, false, 'smugglers-stairs');
  }

  // Timber Watchtower stilts & elevated lookout platform (y = wtBaseY + 4.4m)
  for (const sx of [-1.5, 1.5]) {
    for (const sz of [-1.5, 1.5]) {
      addVisual(new THREE.BoxGeometry(0.24, 4.6, 0.24), darkWoodMat, wtX + sx, wtBaseY + 2.2, wtZ + sz, true);
    }
  }
  // Walkable 2-Flight Wooden Switchback Staircase climbing right UP into the Watchtower Platform! (riser = 0.22m!)
  for (let i = 0; i < 10; i++) {
    const sy = wtBaseY + (i + 1) * 0.22;
    addBox(0.36, 0.22, 1.35, wtX - 1.55 + i * 0.34, sy - 0.11, wtZ + 2.45, woodMat, false, 'smugglers-stairs');
  }
  addBox(1.5, 0.22, 1.5, wtX + 2.45, wtBaseY + 2.09, wtZ + 2.45, woodMat, true, 'smugglers-stairs');
  for (let i = 0; i < 10; i++) {
    const sy = wtBaseY + 2.2 + (i + 1) * 0.22;
    addBox(1.35, 0.22, 0.36, wtX + 2.45, sy - 0.11, wtZ + 1.55 - i * 0.34, woodMat, false, 'smugglers-stairs');
  }
  // Top landing bridging Flight 2 cleanly onto the Watchtower Deck
  addBox(1.4, 0.26, 1.6, wtX + 2.45, wtBaseY + 4.4, wtZ - 1.55, woodMat, true, 'smugglers-tower');

  addBox(3.8, 0.26, 3.8, wtX, wtBaseY + 4.4, wtZ, woodMat, true, 'smugglers-tower');
  // Sandbagged parapet walls (leaves East entry gap at z=wtZ-1.55 open for staircase!)
  for (const [bx, bz, bw, bd] of [
    [wtX, wtZ - 1.75, 3.8, 0.35],
    [wtX, wtZ + 1.75, 3.8, 0.35],
    [wtX - 1.75, wtZ, 0.35, 3.4],
    [wtX + 1.75, wtZ + 0.7, 0.35, 1.8],
  ]) {
    addVisual(new THREE.BoxGeometry(bw, 0.85, bd), sandbagMat, bx, wtBaseY + 4.95, bz);
  }
  // Ammo crate & mounted spotting binoculars inside Watchtower
  addVisual(new THREE.BoxGeometry(0.9, 0.55, 0.55), crateMat, wtX - 0.9, wtBaseY + 4.8, wtZ + 1.1);
  addVisual(new THREE.CylinderGeometry(0.05, 0.08, 1.25, 6), rigSteelMat, wtX - 1.2, wtBaseY + 5.15, wtZ - 0.9);
  addVisual(new THREE.BoxGeometry(0.32, 0.18, 0.42), rigSteelMat, wtX - 1.2, wtBaseY + 5.82, wtZ - 0.9);

  for (const sx of [-1.6, 1.6]) {
    for (const sz of [-1.6, 1.6]) {
      addVisual(new THREE.BoxGeometry(0.14, 2.5, 0.14), darkWoodMat, wtX + sx, wtBaseY + 5.75, wtZ + sz);
    }
  }
  addVisual(new THREE.BoxGeometry(4.4, 0.18, 4.4), rustTinMat, wtX, wtBaseY + 7.05, wtZ, true);
  // Rotating Vintage Radar Dish on Watchtower Roof
  const wtRadar = new THREE.Group();
  wtRadar.position.set(wtX + 0.8, wtBaseY + 7.85, wtZ);
  wtRadar.userData.dynamic = true;
  const wtRadarBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 0.14), boatWhiteMat);
  wtRadar.add(wtRadarBar);
  scene.add(wtRadar);
  addVisual(bulbGeo, redBulbMat, wtX - 1.4, wtBaseY + 7.45, wtZ);

  // Animated Sweeping Coastal Searchlight mounted on Watchtower (0 extra PointLights!)
  const searchlightPivot = new THREE.Group();
  searchlightPivot.position.set(wtX - 1.75, wtBaseY + 5.65, wtZ);
  searchlightPivot.userData.dynamic = true;
  const slHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.55, 10), rigSteelMat);
  slHousing.rotation.x = Math.PI / 2;
  searchlightPivot.add(slHousing);
  const slLens = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), amberBulbMat);
  slLens.position.z = 0.28;
  searchlightPivot.add(slLens);
  const slConeGeo = new THREE.ConeGeometry(4.8, 28.0, 14, 1, true);
  slConeGeo.translate(0, -14.0, 0);
  slConeGeo.rotateX(Math.PI / 2);
  const slCone = new THREE.Mesh(
    slConeGeo,
    new THREE.MeshBasicMaterial({
      color: '#ffe0a3',
      transparent: true,
      opacity: 0.085,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  slCone.rotation.x = 0.18;
  searchlightPivot.add(slCone);
  scene.add(searchlightPivot);

  // ===========================================================================
  // 6) COVE TIKI RUM BAR, CAMPFIRE, BEACHED CIGARETTE-BOAT WRECK & SEA BUOYS
  // ===========================================================================
  // Tropical Tiki Rum Bar Hut (x = 152.5, z = 103.5) -> [F] Coconut Rum ($45 -> 100% HP!)
  const barX = 152.5;
  const barZ = 103.5;
  const barY = getSmugglersCayHeight(barX, barZ) ?? 1.4;
  addBox(3.4, 1.05, 1.2, barX, barY + 0.52, barZ, bambooMat, true, 'smugglers-bar');
  addVisual(new THREE.BoxGeometry(3.6, 0.12, 1.4), darkWoodMat, barX, barY + 1.08, barZ);
  for (const sx of [-1.6, 1.6]) {
    for (const sz of [-0.6, 0.6]) {
      addVisual(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8), bambooMat, barX + sx, barY + 1.4, barZ + sz);
    }
  }
  const tikiRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.35, 6), thatchMat);
  tikiRoof.position.set(barX, barY + 3.35, barZ);
  tikiRoof.castShadow = true;
  scene.add(tikiRoof);
  // Warm tropical bulbs under Tiki eaves + 4 Bamboo Bar Stools + Bottle Shelf + Surfboard Sign + Tiki Totem
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addVisual(bulbGeo, amberBulbMat, barX + Math.cos(a) * 2.1, barY + 2.65, barZ + Math.sin(a) * 2.1);
  }
  for (const sx of [-1.2, -0.4, 0.4, 1.2]) {
    addVisual(new THREE.CylinderGeometry(0.06, 0.08, 0.68, 6), bambooMat, barX + sx, barY + 0.34, barZ - 0.95);
    addVisual(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 10), darkWoodMat, barX + sx, barY + 0.7, barZ - 0.95);
  }
  // Colorful Rum & Cocktail Bottles on the Tiki Counter
  const bottleMats = [greenBulbMat, amberBulbMat, pinkBulbMat, cyanNeon];
  for (let bi = 0; bi < 6; bi++) {
    addVisual(
      new THREE.CylinderGeometry(0.05, 0.06, 0.32, 6),
      bottleMats[bi % bottleMats.length],
      barX - 1.15 + bi * 0.45,
      barY + 1.28,
      barZ + 0.35,
    );
  }
  // Painted Surfboard Bar Sign & Carved Tiki Totem beside the Hut
  const surfBoard = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.85, 6, 8), boatCyanMat);
  surfBoard.rotation.z = Math.PI / 2;
  surfBoard.position.set(barX, barY + 2.55, barZ - 1.05);
  scene.add(surfBoard);
  addVisual(new THREE.CylinderGeometry(0.26, 0.3, 2.2, 8), darkWoodMat, barX + 2.35, barY + 1.1, barZ - 0.4);
  addVisual(bulbGeo, amberBulbMat, barX + 2.35, barY + 1.85, barZ - 0.66);

  const barRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 24),
    new THREE.MeshBasicMaterial({ color: '#ff9f43', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  );
  barRing.rotation.x = -Math.PI / 2;
  barRing.position.set(barX, barY + 0.06, barZ - 1.55);
  scene.add(barRing);

  // Crackling Cove Campfire with Cooking Tripod, Iron Pot, Driftwood Benches & 80s Boombox (x = 148.5, z = 100.0)
  const fireX = 148.5;
  const fireZ = 100.0;
  const fireY = getSmugglersCayHeight(fireX, fireZ) ?? 1.35;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    addVisual(new THREE.DodecahedronGeometry(0.22, 0), rockMat, fireX + Math.cos(a) * 0.55, fireY + 0.12, fireZ + Math.sin(a) * 0.55);
  }
  const campFlame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.88, 7), flameMat);
  campFlame.position.set(fireX, fireY + 0.45, fireZ);
  campFlame.userData.dynamic = true;
  scene.add(campFlame);
  // Wooden cooking tripod & hanging iron kettle
  for (let tp = 0; tp < 3; tp++) {
    const a = (tp / 3) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.75, 6), darkWoodMat);
    pole.position.set(fireX + Math.cos(a) * 0.38, fireY + 0.75, fireZ + Math.sin(a) * 0.38);
    pole.rotation.set(Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36);
    scene.add(pole);
  }
  addVisual(new THREE.SphereGeometry(0.22, 8, 8), rubberMat, fireX, fireY + 0.92, fireZ);
  // Driftwood bench logs & 80s Boombox on a crate
  const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.2, 8), darkWoodMat);
  logA.rotation.z = Math.PI / 2;
  logA.rotation.y = 0.4;
  logA.position.set(fireX - 1.5, fireY + 0.2, fireZ - 1.2);
  scene.add(logA);
  addVisual(new THREE.BoxGeometry(0.65, 0.55, 0.65), crateMat, fireX + 1.5, fireY + 0.28, fireZ - 1.1);
  addVisual(new THREE.BoxGeometry(0.58, 0.3, 0.2), rigSteelMat, fireX + 1.5, fireY + 0.72, fireZ - 1.1);
  addVisual(new THREE.BoxGeometry(0.26, 0.06, 0.22), cyanNeon, fireX + 1.5, fireY + 0.76, fireZ - 1.1);

  // Beached 80s Smuggler Cigarette-Boat Wreck on North Cove Sand (x = 152, z = 75)
  const wreckY = getSmugglersCayHeight(152, 75) ?? 0.2;
  const wreckGroup = new THREE.Group();
  wreckGroup.position.set(152.0, wreckY + 0.22, 75.0);
  wreckGroup.rotation.set(0.14, 0.65, 0.26);
  const wHull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 6.2), boatWhiteMat);
  wreckGroup.add(wHull);
  const wBow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.6, 4), boatWhiteMat);
  wBow.rotation.x = Math.PI / 2;
  wBow.rotation.y = Math.PI / 4;
  wBow.position.set(0, 0.05, 4.3);
  wreckGroup.add(wBow);
  const wStripeA = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.16, 5.8), boatPinkMat);
  wStripeA.position.y = 0.22;
  wreckGroup.add(wStripeA);
  const wStripeB = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.12, 5.5), boatCyanMat);
  wStripeB.position.y = 0.06;
  wreckGroup.add(wStripeB);
  // Cockpit windshield frame, seats & twin tilted outboard motors
  const wWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.45, 0.12), rigSteelMat);
  wWindshield.position.set(0, 0.65, 1.2);
  wWindshield.rotation.x = -0.45;
  wreckGroup.add(wWindshield);
  for (const sx of [-0.55, 0.55]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.52, 0.55), boatPinkMat);
    seat.position.set(sx, 0.52, -0.35);
    wreckGroup.add(seat);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.85, 0.48), rubberMat);
    motor.position.set(sx, 0.35, -3.25);
    motor.rotation.x = 0.42;
    wreckGroup.add(motor);
  }
  scene.add(wreckGroup);

  // Floating Channel Navigation Buoys bobbing in the West Ocean Channel (x = 121, z = 88 & 104)
  const buoys: { group: THREE.Group; phase: number }[] = [];
  for (const [bx, bz, isGreen, ph] of [
    [121.0, 88.5, true, 0.0],
    [121.0, 103.5, false, 1.9],
  ] as [number, number, boolean, number][]) {
    const bg = new THREE.Group();
    bg.position.set(bx, -0.15, bz);
    bg.userData.dynamic = true;
    const floatBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.72, 0.7, 10),
      isGreen ? foliageMat : rustBeamMat,
    );
    bg.add(floatBase);
    const tower = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6), isGreen ? foliageMat : rustBeamMat);
    tower.position.y = 1.1;
    bg.add(tower);
    const light = new THREE.Mesh(bulbGeo, isGreen ? greenBulbMat : redBulbMat);
    light.position.y = 1.95;
    bg.add(light);
    scene.add(bg);
    buoys.push({ group: bg, phase: ph });
  }

  // ===========================================================================
  // 7) TROPICAL ISLAND CRABS (14 Crabs in Varied Sizes Scuttling Sideways!)
  // ===========================================================================
  interface IslandCrab {
    group: THREE.Group;
    legsA: THREE.Group;
    legsB: THREE.Group;
    clawL: THREE.Group;
    clawR: THREE.Group;
    x: number;
    z: number;
    scale: number;
    moveAngle: number;
    speed: number;
    stateTimer: number;
    paused: boolean;
    phase: number;
  }

  const crabShellGeo = new THREE.SphereGeometry(0.24, 10, 8);
  crabShellGeo.scale(1.35, 0.48, 0.95);
  const crabEyeStalkGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.1, 6);
  const crabEyeGeo = new THREE.SphereGeometry(0.032, 6, 6);
  const crabLegGeo = new THREE.BoxGeometry(0.26, 0.035, 0.04);
  const crabClawGeo = new THREE.BoxGeometry(0.16, 0.08, 0.1);
  const crabArmGeo = new THREE.BoxGeometry(0.14, 0.045, 0.055);

  const crabSpawns: [number, number, number][] = [
    // Tiny baby beach crabs near the West sandy cove
    [144.5, 91.5, 0.55],
    [146.2, 98.5, 0.62],
    [145.0, 94.0, 0.58],
    [148.5, 84.5, 0.68],
    // Medium coral/orange crabs around the cove, campfire, Tiki Bar & trails
    [149.5, 95.8, 0.92],
    [151.8, 99.2, 1.05],
    [155.5, 98.0, 0.88],
    [158.2, 101.5, 1.12],
    [164.0, 99.5, 0.96],
    [167.2, 93.0, 1.08],
    [154.0, 79.5, 0.95],
    // Chunky Giant Coconut / King Crabs patrolling the beaches & rocky ridge!
    [147.0, 103.5, 1.58],
    [162.5, 104.2, 1.75],
    [171.5, 89.5, 1.92],
  ];

  const crabs: IslandCrab[] = [];
  crabSpawns.forEach(([cx, cz, sc], idx) => {
    const mat = crabMats[idx % crabMats.length];
    const g = new THREE.Group();
    g.userData.dynamic = true;
    g.scale.setScalar(sc);

    const shell = new THREE.Mesh(crabShellGeo, mat);
    shell.position.y = 0.12;
    shell.castShadow = true;
    g.add(shell);

    // Two protruding eye stalks on the front (+Z)
    for (const ex of [-0.11, 0.11]) {
      const stalk = new THREE.Mesh(crabEyeStalkGeo, mat);
      stalk.position.set(ex, 0.21, 0.16);
      stalk.rotation.x = 0.25;
      g.add(stalk);
      const eye = new THREE.Mesh(crabEyeGeo, crabEyeMat);
      eye.position.set(ex, 0.26, 0.18);
      g.add(eye);
    }

    // Articulated front pincer claws (left & right)
    const buildClaw = (side: -1 | 1): THREE.Group => {
      const cg = new THREE.Group();
      cg.position.set(side * 0.22, 0.13, 0.16);
      const arm = new THREE.Mesh(crabArmGeo, mat);
      arm.position.set(side * 0.06, 0, 0.08);
      arm.rotation.y = side * -0.45;
      cg.add(arm);
      const pincer = new THREE.Mesh(crabClawGeo, mat);
      pincer.position.set(side * 0.08, 0.02, 0.18);
      pincer.rotation.y = side * 0.35;
      cg.add(pincer);
      return cg;
    };
    const clawL = buildClaw(-1);
    const clawR = buildClaw(1);
    g.add(clawL, clawR);

    // 6 jointed walking legs split into 2 alternating tripod groups (legsA / legsB)
    const legsA = new THREE.Group();
    const legsB = new THREE.Group();
    const legZOffsets = [0.09, -0.02, -0.13];
    for (let li = 0; li < 3; li++) {
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(crabLegGeo, mat);
        leg.position.set(side * 0.34, 0.08, legZOffsets[li]);
        leg.rotation.z = side * -0.35;
        leg.rotation.y = (li - 1) * side * -0.22;
        const target = (li + (side > 0 ? 1 : 0)) % 2 === 0 ? legsA : legsB;
        target.add(leg);
      }
    }
    g.add(legsA, legsB);

    const cy = getSmugglersCayHeight(cx, cz) ?? 1.2;
    g.position.set(cx, cy + 0.02, cz);
    scene.add(g);

    crabs.push({
      group: g,
      legsA,
      legsB,
      clawL,
      clawR,
      x: cx,
      z: cz,
      scale: sc,
      moveAngle: (idx * 1.9) % (Math.PI * 2),
      speed: (0.85 + (idx % 4) * 0.25) / Math.pow(sc, 0.25),
      stateTimer: 1.5 + (idx % 5) * 0.9,
      paused: idx % 3 === 0,
      phase: idx * 1.37,
    });
  });

  let lastUpdateElapsed = -1;

  return {
    getGroundHeight: (x: number, z: number) => getSmugglersCayHeight(x, z),

    isInsideShack: (pos: THREE.Vector3) =>
      pos.x > 153.2 && pos.x < 165.8 && pos.z > 83.2 && pos.z < 91.8 && pos.y < sFloorY + sH + 0.5,

    isNearLoot: (pos: THREE.Vector3) =>
      !lootTaken &&
      Math.hypot(pos.x - lootPos.x, pos.z - lootPos.z) < 2.5 &&
      Math.abs(pos.y - lootPos.y) < 2.2,

    takeLoot: () => {
      lootTaken = true;
      lootGroup.visible = false;
    },

    isNearTikiBar: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - barX, pos.z - (barZ - 1.55)) < 2.3 && Math.abs(pos.y - barY) < 2.2,

    update: (elapsed: number, playerPos?: THREE.Vector3) => {
      const dt = lastUpdateElapsed < 0 ? 0.016 : Math.min(0.05, Math.max(0.001, elapsed - lastUpdateElapsed));
      lastUpdateElapsed = elapsed;

      if (playerPos && (playerPos.x < 55 || playerPos.z < 5)) return;

      // Update 14 tropical crabs scuttling sideways across the island!
      for (let i = 0; i < crabs.length; i++) {
        const c = crabs[i];
        let fleeing = false;
        if (playerPos) {
          const dxP = c.x - playerPos.x;
          const dzP = c.z - playerPos.z;
          const distP = Math.hypot(dxP, dzP);
          if (distP < 3.6 && distP > 0.01) {
            c.moveAngle = Math.atan2(dzP, dxP);
            c.paused = false;
            c.stateTimer = 1.4;
            fleeing = true;
          }
        }

        c.stateTimer -= dt;
        if (c.stateTimer <= 0) {
          c.paused = !c.paused;
          c.stateTimer = c.paused ? 0.9 + ((i * 7 + elapsed) % 1.8) : 2.2 + ((i * 5 + elapsed) % 2.8);
          if (!c.paused) {
            c.moveAngle += ((i % 2 === 0 ? 1 : -1) * (0.9 + ((elapsed * 1.7 + i) % 1.8)));
          }
        }

        if (!c.paused) {
          const spd = c.speed * (fleeing ? 2.1 : 1.0);
          const nx = c.x + Math.cos(c.moveAngle) * spd * dt;
          const nz = c.z + Math.sin(c.moveAngle) * spd * dt;
          const nh = getSmugglersCayHeight(nx, nz);
          const inShack = nx > 152.2 && nx < 166.8 && nz > 82.2 && nz < 94.5;
          const inBar = Math.hypot(nx - barX, nz - barZ) < 2.2;
          const inFire = Math.hypot(nx - fireX, nz - fireZ) < 1.25;
          if (nh !== null && nh > 0.12 && nh < 3.4 && !inShack && !inBar && !inFire) {
            c.x = nx;
            c.z = nz;
            c.group.position.set(nx, nh + 0.02, nz);
          } else {
            // Bounce off water edge, steep cliff or buildings
            c.moveAngle += Math.PI * 0.72 + (i % 3) * 0.35;
          }

          // Real sideways crab orientation (body faces perpendicular to travel direction!)
          c.group.rotation.y = -c.moveAngle;
          const legSwing = Math.sin(elapsed * (fleeing ? 24 : 15) + c.phase) * 0.24;
          c.legsA.rotation.z = legSwing;
          c.legsB.rotation.z = -legSwing;
        } else {
          c.legsA.rotation.z = 0;
          c.legsB.rotation.z = 0;
        }

        // Claws gently wave / snap defensively when paused or fleeing
        const snap = Math.sin(elapsed * (fleeing ? 16 : 4.5) + c.phase) * (fleeing ? 0.32 : 0.14);
        c.clawL.rotation.x = -0.18 - Math.abs(snap);
        c.clawR.rotation.x = -0.18 - Math.abs(snap * 0.85);
      }

      // Sweep Cliffside Watchtower Searchlight & Roof Radar
      searchlightPivot.rotation.y = -Math.PI / 2 + Math.sin(elapsed * 0.55) * 0.85;
      wtRadar.rotation.y = elapsed * 1.4;

      // Slowly slew Offshore Cargo Crane boom & flutter Rig Windsock
      cranePivot.rotation.y = -0.75 + Math.sin(elapsed * 0.28) * 0.42;
      rigWindsock.rotation.y = 0.35 + Math.sin(elapsed * 1.6) * 0.22;
      rigWindsock.rotation.z = Math.sin(elapsed * 4.0) * 0.08;

      // Spin Boathouse vintage ceiling fan & gently bob moored wooden dinghy
      ceilingFan.rotation.y = elapsed * 2.4;
      dinghyGroup.position.y = -0.08 + Math.sin(elapsed * 1.9) * 0.09;
      dinghyGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.07;

      // Flicker Offshore Flare Stack, Campfire & 8 Bamboo Tiki Torches
      const fScale = 0.88 + Math.sin(elapsed * 14.0) * 0.16 + Math.cos(elapsed * 23.0) * 0.08;
      flareFlame.scale.set(1, fScale, 1);
      campFlame.scale.set(1, 0.85 + Math.sin(elapsed * 11.5) * 0.2, 1);
      for (let i = 0; i < tikiFlames.length; i++) {
        const tf = tikiFlames[i];
        tf.mesh.scale.set(1, 0.82 + Math.sin(elapsed * 12.0 + tf.phase) * 0.24, 1);
      }

      // Glide circling tropical sea birds high above the island
      for (let i = 0; i < skyBirds.length; i++) {
        const sb = skyBirds[i];
        const a = elapsed * sb.speed + sb.phase;
        sb.group.position.set(
          CAY_X + Math.cos(a) * sb.radius,
          sb.height + Math.sin(elapsed * 1.2 + sb.phase) * 0.8,
          CAY_Z + Math.sin(a) * sb.radius,
        );
        sb.group.rotation.y = -a;
        const flap = Math.sin(elapsed * 5.2 + sb.phase) * 0.28;
        sb.wingL.rotation.z = flap;
        sb.wingR.rotation.z = -flap;
      }

      // Gently bob floating channel navigation buoys in the waves
      for (let i = 0; i < buoys.length; i++) {
        const b = buoys[i];
        b.group.position.y = -0.15 + Math.sin(elapsed * 1.8 + b.phase) * 0.14;
        b.group.rotation.z = Math.sin(elapsed * 1.4 + b.phase) * 0.12;
      }

      // Pulse Contraband Vault ring
      if (!lootTaken) {
        const s = 1 + Math.sin(elapsed * 4.2) * 0.08;
        lootRing.scale.set(s, s, 1);
      }
    },
  };
}
