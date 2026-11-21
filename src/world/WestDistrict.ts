import * as THREE from 'three';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';

export interface WestDistrictHandle {
  isCarInTuningBay: (pos: THREE.Vector3) => boolean;
  isNearDinerCounter: (pos: THREE.Vector3) => boolean;
  isNearBankVault: (pos: THREE.Vector3) => boolean;
  takeBankVault: () => void;
  isInsideInterior: (pos: THREE.Vector3) => boolean;
  update: (elapsed: number) => void;
}

// -----------------------------------------------------------------------------
// Procedural High-Detail Canvas Textures (Zero External Assets!)
// -----------------------------------------------------------------------------

function createCheckerFloorTexture(colorA: string, colorB: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const half = 64;
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = colorB;
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  // Subtle grout line
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, half, half);
  ctx.strokeRect(half, half, half, half);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function createMarbleTexture(baseHex: string, veinHex: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal stone veins
  ctx.strokeStyle = veinHex;
  for (let i = 0; i < 16; i++) {
    ctx.lineWidth = 0.8 + (i % 3) * 0.7;
    ctx.globalAlpha = 0.14 + (i % 4) * 0.05;
    ctx.beginPath();
    let x = (i * 37) % 256;
    let y = 0;
    ctx.moveTo(x, y);
    for (let step = 1; step <= 8; step++) {
      x += Math.sin(i * 1.7 + step * 1.1) * 18 + 10;
      y = step * 32;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Tile seams
  ctx.strokeStyle = 'rgba(80, 68, 56, 0.22)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 256; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function createTerracottaPlazaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b97856';
  ctx.fillRect(0, 0, 256, 256);

  const shades = ['#c4815c', '#ae6c4c', '#cf8f69', '#a56244', '#bf7a55'];
  const tile = 32;
  for (let y = 0; y < 256; y += tile) {
    for (let x = 0; x < 256; x += tile) {
      const idx = ((x / tile) * 7 + (y / tile) * 13) % shades.length;
      ctx.fillStyle = shades[idx];
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 4);
  return tex;
}

function createHavanaFacadeTexture(wallHex: string, shutterHex: string, seed: number): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const ec = document.createElement('canvas');
  ec.width = 256;
  ec.height = 256;
  const ectx = ec.getContext('2d')!;
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 256, 256);

  // Sun-baked stucco base
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle stucco grain & horizontal cornice bands
  for (let i = 0; i < 360; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(60,30,15,0.06)';
    ctx.fillRect((i * 53 + seed * 19) % 256, (i * 97 + seed * 7) % 256, 4, 4);
  }
  ctx.fillStyle = '#fff3e2';
  ctx.fillRect(0, 0, 256, 12);
  ctx.fillRect(0, 124, 256, 8);
  ctx.fillRect(0, 246, 256, 10);

  // Arched colonial windows with painted wooden shutters
  const rows = [26, 144];
  const cols = [24, 92, 160, 212];
  rows.forEach((wy, rIdx) => {
    cols.forEach((wx, cIdx) => {
      if (wx + 32 > 250) return;
      const lit = ((seed + rIdx * 5 + cIdx * 3) % 3) !== 0;
      // Shutters
      ctx.fillStyle = shutterHex;
      ctx.fillRect(wx - 8, wy, 8, 66);
      ctx.fillRect(wx + 32, wy, 8, 66);
      // Window glass
      ctx.fillStyle = lit ? '#ffda98' : '#262133';
      ctx.fillRect(wx, wy, 32, 66);
      // White muntin bars
      ctx.fillStyle = '#fff5e6';
      ctx.fillRect(wx + 15, wy, 2, 66);
      ctx.fillRect(wx, wy + 22, 32, 2);
      ctx.fillRect(wx, wy + 44, 32, 2);

      if (lit) {
        ectx.fillStyle = '#ffb866';
        ectx.fillRect(wx + 1, wy + 1, 30, 64);
      }
    });
  });

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(ec);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function createAwningStripeTexture(colorA: string, colorB: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? colorA : colorB;
    ctx.fillRect(x, 0, 16, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

function createDinerMenuTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#181022';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#ff4fa3';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 120);

  ctx.fillStyle = '#36f1e6';
  ctx.font = '900 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STARLIGHT DINER · 24H', 128, 28);

  ctx.fillStyle = '#fff1dc';
  ctx.font = '700 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CUBAN BURGER ......... $20', 18, 56);
  ctx.fillText('MIAMI MILKSHAKE ...... $15', 18, 78);
  ctx.fillText('CAFE CUBANO .......... $ 8', 18, 100);
  ctx.fillStyle = '#ff9f43';
  ctx.fillText('COMBO SPECIAL (100% HP) $40', 18, 118);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the High-Detail WEST DISTRICT (x = -66..-124, z = -66..+66):
 * - North Block (-87, -40): "VICE CUSTOMS" Drive-In Tuning Garage (Turbo, Armor & Neon Underglow!)
 * - Center Block (-87, 0):  Walk-in "STARLIGHT 80s DINER" (Chrome Art-Deco, Jukebox, Booths, Counter)
 *                           + "LITTLE HAVANA PLAZA" (Cuban colonial facades, balconies, string lights, domino tables)
 * - South Block (-87, +40): Walk-in "BANCO DE VICE" (Marble columns, teller hall, open steel Vault & $3,000 Heist!)
 * - West Havana Blvd (x = -114) & colorful Little Havana backdrop facades along x = -124.
 * Zero extra PointLights added -> constant WebGL shader count & silky-smooth FPS!
 */
export function buildWestDistrict(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  roadMat: THREE.Material,
  sidewalkMat: THREE.Material,
  palmPositions: { x: number; z: number; rot: number; scale: number }[],
): WestDistrictHandle {
  // Shared high-detail materials (keep large flat surfaces emissiveIntensity <= 0.35!)
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e6edf5', roughness: 0.14, metalness: 0.92 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: '#222530', roughness: 0.42, metalness: 0.72 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.22, metalness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d4a348', roughness: 0.28, metalness: 0.82 });
  const dinerRedMat = new THREE.MeshStandardMaterial({ color: '#d92b4b', roughness: 0.32, metalness: 0.18 });
  const dinerCreamMat = new THREE.MeshStandardMaterial({ color: '#f7ece0', roughness: 0.46, metalness: 0.08 });
  const dinerTealMat = new THREE.MeshStandardMaterial({ color: '#27b8b0', roughness: 0.36, metalness: 0.18 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#6ec4d8',
    roughness: 0.08,
    metalness: 0.25,
    transparent: true,
    opacity: 0.32,
  });
  const marbleWallMat = new THREE.MeshStandardMaterial({
    map: createMarbleTexture('#efe6d8', '#b8a894', 2, 2),
    roughness: 0.34,
    metalness: 0.08,
  });
  const marbleFloorMat = new THREE.MeshStandardMaterial({
    map: createMarbleTexture('#f4ede1', '#9c8d7a', 4, 4),
    roughness: 0.18,
    metalness: 0.12,
  });
  const vaultSteelMat = new THREE.MeshStandardMaterial({ color: '#555d6b', roughness: 0.3, metalness: 0.86 });
  const velvetRedMat = new THREE.MeshStandardMaterial({ color: '#8f192d', roughness: 0.78 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b3f28', roughness: 0.62 });
  const terracottaMat = new THREE.MeshStandardMaterial({
    map: createTerracottaPlazaTexture(),
    roughness: 0.58,
    metalness: 0.06,
  });
  const garageWallMat = new THREE.MeshStandardMaterial({ color: '#2b2a36', roughness: 0.55, metalness: 0.22 });
  const garageFloorMat = new THREE.MeshStandardMaterial({
    map: createCheckerFloorTexture('#2b2c34', '#d8d4cc', 6, 4),
    roughness: 0.36,
    metalness: 0.14,
  });
  const dinerFloorMat = new THREE.MeshStandardMaterial({
    map: createCheckerFloorTexture('#1a1824', '#f2ece4', 6, 4),
    roughness: 0.24,
    metalness: 0.1,
  });
  const roofDarkMat = new THREE.MeshStandardMaterial({ color: '#39333f', roughness: 0.75 });
  const tileRoofMat = new THREE.MeshStandardMaterial({ color: '#b45136', roughness: 0.68 });

  // Neon tube materials (thin accents only!)
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.3 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.3 });
  const amberNeon = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff9f43', emissiveIntensity: 2.2 });
  const warmGlowMat = new THREE.MeshStandardMaterial({ color: '#ffe8bd', emissive: '#ffbe66', emissiveIntensity: 1.8 });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material | THREE.Material[],
    castShadow = true,
    tag = 'west',
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    scene.add(m);
    worldMeshes.push(m);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag,
    });
    return m;
  };

  const addVisual = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number,
    castShadow = false,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // ===========================================================================
  // 1) WET ASPHALT EXTENSION, ROAD MARKINGS & SIDEWALK ISLANDS (x = -66..-124)
  // ===========================================================================
  const westRoad = new THREE.Mesh(new THREE.PlaneGeometry(60, 144), roadMat);
  westRoad.rotation.x = -Math.PI / 2;
  westRoad.position.set(-96, 0, 0); // spans x = -126..-66, z = -72..+72
  westRoad.receiveShadow = true;
  scene.add(westRoad);
  worldMeshes.push(westRoad);

  // Dashed yellow centerlines along West Havana Blvd (x = -112) & extended E-W avenues (z = -60,-20,20,60)
  const yellowLineMat = new THREE.MeshStandardMaterial({ color: '#e6b85c', roughness: 0.35, metalness: 0.1 });
  const dashMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (const bz of [-40, 0, 40]) {
    for (let off = -11; off <= 11; off += 5.5) {
      dummy.position.set(-112, 0.012, bz + off);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(0.22, 2.8, 1);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());
    }
  }
  for (const rz of [-60, -20, 20, 60]) {
    for (let x = -104; x <= -70; x += 5.5) {
      dummy.position.set(x, 0.012, rz);
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      dummy.scale.set(0.22, 2.8, 1);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());
    }
  }
  const westDashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), yellowLineMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => westDashes.setMatrixAt(i, m));
  westDashes.instanceMatrix.needsUpdate = true;
  westDashes.matrixAutoUpdate = false;
  scene.add(westDashes);

  // 3 Raised Sidewalk Islands at x = -87 (34m wide: x = -104..-70, 28m deep)
  // Note: North block leaves East driveway ramp flush at y=0 for Drive-In Tuning Garage!
  addBox(34, 0.18, 28, -87, 0.09, 0, sidewalkMat, false, 'sidewalk');
  addBox(34, 0.18, 28, -87, 0.09, 40, sidewalkMat, false, 'sidewalk');
  // North block sidewalk split around the drive-in garage apron (x = -76..-70 is flush driveway!)
  addBox(24, 0.18, 28, -92, 0.09, -40, sidewalkMat, false, 'sidewalk');
  addBox(10, 0.18, 7, -75, 0.09, -50.5, sidewalkMat, false, 'sidewalk');
  addBox(10, 0.18, 7, -75, 0.09, -29.5, sidewalkMat, false, 'sidewalk');

  // West Boulevard Sidewalk along x = -121 (west of Havana Blvd)
  addBox(8, 0.18, 132, -121, 0.09, 0, sidewalkMat, false, 'sidewalk');

  // ===========================================================================
  // 2) NORTH BLOCK (-87, -40): "VICE CUSTOMS" DRIVE-IN TUNING GARAGE
  // ===========================================================================
  // Garage shell: x = -101..-77 (24m deep), z = -51..-29 (22m wide), open East facade (x = -77)
  // Drive-in bay sits in south-center half (z = -43..-35), show-lift bay in north half (z = -50..-44)
  const gFloor = new THREE.Mesh(new THREE.PlaneGeometry(24, 21.2), garageFloorMat);
  gFloor.rotation.x = -Math.PI / 2;
  gFloor.position.set(-89, 0.2, -40);
  gFloor.receiveShadow = true;
  scene.add(gFloor);

  // Back wall (West, x = -101), North wall (z = -50.8), South wall (z = -29.2)
  addBox(0.8, 5.4, 22.0, -101, 2.7, -40, garageWallMat, true, 'tuning-wall');
  addBox(24.0, 5.4, 0.8, -89, 2.7, -50.8, garageWallMat, true, 'tuning-wall');
  addBox(24.0, 5.4, 0.8, -89, 2.7, -29.2, garageWallMat, true, 'tuning-wall');

  // Front pillars framing the wide 14m open drive-in entrance (cars & bikes enter cleanly!)
  addBox(0.9, 5.4, 3.6, -77.2, 2.7, -49.0, garageWallMat, true, 'tuning-wall');
  addBox(0.9, 5.4, 3.6, -77.2, 2.7, -31.0, garageWallMat, true, 'tuning-wall');
  // Overhead lintel & roof slab (minY >= 4.2m -> solidVehicleColliders ignores it!)
  addBox(0.9, 1.3, 22.0, -77.2, 4.95, -40, garageWallMat, true, 'tuning-lintel');
  addBox(25.2, 0.55, 22.8, -89, 5.65, -40, roofDarkMat, true, 'tuning-roof');

  // High-contrast Cyan & Pink Neon Trim around the garage fascia
  addVisual(new THREE.BoxGeometry(0.16, 0.16, 22.2), cyanNeon, -76.68, 4.28, -40);
  addVisual(new THREE.BoxGeometry(0.16, 0.16, 22.2), pinkNeon, -76.68, 5.56, -40);

  // Illuminated "VICE CUSTOMS · TURBO & NEON" Rooftop Fascia Sign
  const customsSignTex = createNeonSignTexture('VICE CUSTOMS · TURBO', '#36f1e6');
  const customsSignMat = new THREE.MeshStandardMaterial({
    map: customsSignTex,
    emissive: '#ffffff',
    emissiveMap: customsSignTex,
    emissiveIntensity: 1.7,
  });
  addVisual(new THREE.BoxGeometry(0.24, 1.45, 11.5), customsSignMat, -76.6, 6.65, -40);

  // Rotating 3D Neon Turbo Wheel Sculpture on the Garage Roof!
  const roofWheelGroup = new THREE.Group();
  roofWheelGroup.position.set(-79, 8.2, -40);
  const wheelTire = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.34, 12, 24),
    new THREE.MeshStandardMaterial({ color: '#18181f', roughness: 0.72 }),
  );
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.08, 8, 18), cyanNeon);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.45, 12), chromeMat);
  wheelHub.rotation.x = Math.PI / 2;
  roofWheelGroup.add(wheelTire, wheelRim, wheelHub);
  for (let s = 0; s < 5; s++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.55, 0.14), chromeMat);
    spoke.rotation.z = (s / 5) * Math.PI;
    roofWheelGroup.add(spoke);
  }
  scene.add(roofWheelGroup);

  // Active Drive-In Tuning Bay Neon Floor Frame (center at x = -85, z = -37.5)
  const tuningBayRing = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 3.55, 32),
    new THREE.MeshBasicMaterial({ color: '#36f1e6', side: THREE.DoubleSide }),
  );
  tuningBayRing.rotation.x = -Math.PI / 2;
  tuningBayRing.position.set(-85, 0.23, -37.5);
  scene.add(tuningBayRing);

  // Adjacent Hydraulic 2-Post Car Lift in North Bay (z = -46.5) with Show Chassis!
  for (const lz of [-48.2, -44.8]) {
    addBox(0.35, 3.4, 0.35, -88, 1.9, lz, dinerRedMat, true, 'lift-post');
  }
  addVisual(new THREE.BoxGeometry(0.28, 0.22, 3.8), darkSteelMat, -88, 3.65, -46.5);
  // Lift arms + raised retro sports chassis
  addVisual(new THREE.BoxGeometry(3.8, 0.12, 1.8), darkSteelMat, -88, 1.65, -46.5);
  const showCarMat = new THREE.MeshStandardMaterial({ color: '#ff4fa3', roughness: 0.18, metalness: 0.78 });
  addVisual(new THREE.BoxGeometry(4.1, 0.58, 1.85), showCarMat, -88, 2.05, -46.5, true);
  addVisual(new THREE.BoxGeometry(1.9, 0.44, 1.55), glassMat, -88.2, 2.52, -46.5);
  addVisual(new THREE.BoxGeometry(3.5, 0.08, 1.6), cyanNeon, -88, 1.72, -46.5); // underglow preview!

  // Red Tool Cabinets, Nitrous Bottles & Tire Stacks along Back Wall
  for (let i = 0; i < 3; i++) {
    addBox(1.1, 1.35, 2.2, -99.8, 0.88, -46.5 + i * 3.4, dinerRedMat, true, 'toolbox');
    addVisual(new THREE.BoxGeometry(1.15, 0.1, 2.24), chromeMat, -99.8, 1.58, -46.5 + i * 3.4);
  }
  // Neon-blue Nitrous Oxide tanks
  const nosMat = new THREE.MeshStandardMaterial({ color: '#1b7cff', roughness: 0.22, metalness: 0.65 });
  for (let n = 0; n < 4; n++) {
    addVisual(new THREE.CylinderGeometry(0.18, 0.18, 1.15, 10), nosMat, -99.4, 0.78, -34.8 + n * 0.52, true);
    addVisual(new THREE.CylinderGeometry(0.06, 0.16, 0.16, 8), chromeMat, -99.4, 1.42, -34.8 + n * 0.52);
  }
  // Stacked Tires near south wall
  const tireMat = new THREE.MeshStandardMaterial({ color: '#17171d', roughness: 0.82 });
  for (let t = 0; t < 3; t++) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.16, 8, 14), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.set(-96.5, 0.36 + t * 0.31, -31.2);
    scene.add(tire);
  }

  // Overhead Shop Light Strips + Additive Haze Cones (0 extra PointLights!)
  const shopHazeMat = new THREE.MeshBasicMaterial({
    color: '#bdeeff',
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const lx of [-93, -84]) {
    for (const lz of [-45, -36]) {
      addVisual(new THREE.BoxGeometry(3.2, 0.12, 0.35), warmGlowMat, lx, 5.28, lz);
      addVisual(new THREE.ConeGeometry(2.8, 4.6, 12, 1, true), shopHazeMat, lx, 2.95, lz);
    }
  }

  // ===========================================================================
  // 3) CENTER BLOCK (-87, 0): "STARLIGHT 80s DINER" (North Half) + "LITTLE HAVANA PLAZA" (South Half)
  // ===========================================================================
  // --- A) WALK-IN STARLIGHT 80s CHROME DINER (x = -101..-76, z = -12.5..-2.2) ---
  const dFloor = new THREE.Mesh(new THREE.PlaneGeometry(24.2, 10.0), dinerFloorMat);
  dFloor.rotation.x = -Math.PI / 2;
  dFloor.position.set(-88.5, 0.21, -7.3);
  dFloor.receiveShadow = true;
  scene.add(dFloor);

  // Back wall (North z = -12.4) & West wall (x = -100.8)
  addBox(25.0, 4.4, 0.55, -88.5, 2.38, -12.4, dinerCreamMat, true, 'diner-wall');
  addBox(0.55, 4.4, 10.6, -100.8, 2.38, -7.3, chromeMat, true, 'diner-wall');

  // South Panoramic Chrome & Glass Wall (facing Little Havana Plaza, open entrance doorway x = -85..-81!)
  addBox(15.2, 1.05, 0.42, -93.1, 0.7, -2.2, chromeMat, true, 'diner-wall');
  addBox(4.8, 1.05, 0.42, -78.6, 0.7, -2.2, chromeMat, true, 'diner-wall');
  // Window mullions & glass panes above knee wall
  addVisual(new THREE.BoxGeometry(14.8, 2.25, 0.08), glassMat, -93.1, 2.35, -2.2);
  addVisual(new THREE.BoxGeometry(4.4, 2.25, 0.08), glassMat, -78.6, 2.35, -2.2);
  // East Panoramic Wall (facing West Avenue, x = -76.2)
  addBox(0.42, 1.05, 10.2, -76.2, 0.7, -7.3, chromeMat, true, 'diner-wall');
  addVisual(new THREE.BoxGeometry(0.08, 2.25, 9.8), glassMat, -76.2, 2.35, -7.3);

  // Rounded Art-Deco Chrome Corner Columns
  for (const [cx, cz] of [
    [-76.2, -2.2],
    [-76.2, -12.4],
    [-100.8, -2.2],
  ]) {
    addVisual(new THREE.CylinderGeometry(0.42, 0.42, 4.45, 14), chromeMat, cx, 2.4, cz, true);
  }

  // Stepped Chrome Diner Roof + Overhanging Canopy (minY = 3.85m)
  addBox(25.6, 0.65, 11.4, -88.5, 4.35, -7.3, chromeMat, true, 'diner-roof');
  addVisual(new THREE.BoxGeometry(26.4, 0.32, 12.2), dinerTealMat, -88.5, 3.88, -7.3);
  // Iconic Double Pink & Cyan Neon Wraparound Ribbons
  addVisual(new THREE.BoxGeometry(26.6, 0.12, 12.4), pinkNeon, -88.5, 4.08, -7.3);
  addVisual(new THREE.BoxGeometry(26.6, 0.12, 12.4), cyanNeon, -88.5, 4.62, -7.3);

  // Red & White Striped Awning over Diner Entrance
  const redWhiteAwningMat = new THREE.MeshStandardMaterial({
    map: createAwningStripeTexture('#d92b4b', '#f9f4ee'),
    roughness: 0.65,
  });
  const dinerAwning = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.14, 2.1), redWhiteAwningMat);
  dinerAwning.position.set(-83, 3.35, -1.2);
  dinerAwning.rotation.x = 0.28;
  dinerAwning.castShadow = true;
  scene.add(dinerAwning);

  // Rooftop "STARLIGHT DINER · 24H" Neon Sign (facing East & South)
  const dinerSignTex = createNeonSignTexture('STARLIGHT DINER', '#ff4fa3');
  const dinerSignMat = new THREE.MeshStandardMaterial({
    map: dinerSignTex,
    emissive: '#ffffff',
    emissiveMap: dinerSignTex,
    emissiveIntensity: 1.8,
  });
  addVisual(new THREE.BoxGeometry(0.24, 1.5, 9.2), dinerSignMat, -76.0, 5.5, -7.3);
  addVisual(new THREE.BoxGeometry(9.6, 1.5, 0.24), dinerSignMat, -88.5, 5.5, -1.9);

  // Tall 1980s Roadside Diner Pylon Sign on East Sidewalk (-71.8, -11.5)
  addBox(0.45, 7.2, 0.45, -71.8, 3.7, -11.5, chromeMat, true, 'diner-pylon');
  addVisual(new THREE.BoxGeometry(0.32, 1.2, 4.4), dinerSignMat, -71.8, 6.7, -11.5);
  addVisual(new THREE.BoxGeometry(0.14, 0.14, 4.6), cyanNeon, -71.8, 6.02, -11.5);
  addVisual(new THREE.BoxGeometry(0.14, 0.14, 4.6), amberNeon, -71.8, 7.38, -11.5);

  // Diner Interior: Chrome Counter, Barstools, Red Vinyl Booths, Menu Board & Animated Jukebox!
  addBox(12.0, 1.05, 1.05, -88.5, 0.72, -9.8, chromeMat, true, 'diner-counter');
  addVisual(new THREE.BoxGeometry(12.2, 0.1, 1.25), dinerRedMat, -88.5, 1.26, -9.8);
  // Illuminated Menu Board on Back Wall
  const menuMat = new THREE.MeshStandardMaterial({
    map: createDinerMenuTexture(),
    emissive: '#ffffff',
    emissiveMap: createDinerMenuTexture(),
    emissiveIntensity: 0.72,
  });
  addVisual(new THREE.BoxGeometry(5.2, 2.2, 0.14), menuMat, -88.5, 2.65, -12.05);

  // 7 Chrome & Red Vinyl Barstools
  for (let s = 0; s < 7; s++) {
    const sx = -93.6 + s * 1.7;
    addVisual(new THREE.CylinderGeometry(0.06, 0.18, 0.72, 8), chromeMat, sx, 0.56, -8.55);
    addVisual(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 12), dinerRedMat, sx, 0.94, -8.55, true);
  }

  // 3 Red Vinyl Booths along South Window
  for (let b = 0; b < 3; b++) {
    const bx = -97.6 + b * 4.2;
    addBox(1.5, 0.78, 1.1, bx, 0.58, -3.55, dinerCreamMat, true, 'diner-table');
    addVisual(new THREE.BoxGeometry(0.55, 1.15, 1.25), dinerRedMat, bx - 1.15, 0.78, -3.55, true);
    addVisual(new THREE.BoxGeometry(0.55, 1.15, 1.25), dinerRedMat, bx + 1.15, 0.78, -3.55, true);
  }

  // Animated 80s Wurlitzer-Style Neon Jukebox (-78.0, -10.8)
  addBox(1.15, 1.95, 0.85, -78.0, 1.18, -11.2, woodMat, true, 'jukebox');
  const jukeboxArchMat = new THREE.MeshStandardMaterial({
    color: '#ff4fa3',
    emissive: '#ff4fa3',
    emissiveIntensity: 2.2,
  });
  addVisual(new THREE.TorusGeometry(0.48, 0.08, 8, 16, Math.PI), jukeboxArchMat, -78.0, 1.55, -10.72);
  addVisual(new THREE.BoxGeometry(0.72, 0.78, 0.08), cyanNeon, -78.0, 1.15, -10.74);

  // --- B) LITTLE HAVANA PLAZA (South Half of Center Block: x = -104..-70, z = +0.5..+13.5) ---
  const plazaFloor = new THREE.Mesh(new THREE.PlaneGeometry(33.2, 12.8), terracottaMat);
  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.position.set(-87, 0.2, 6.8);
  plazaFloor.receiveShadow = true;
  scene.add(plazaFloor);

  // 3 Colorful Cuban Colonial Shopfronts along South Edge of Plaza (z = 10.6)
  const havanaSpecs = [
    { x: -97.5, w: 9.2, h: 8.6, wall: '#f2b880', shutter: '#1d7a74', awning: '#d9483b', sign: 'CAFE HABANA', neon: '#ff9f43' },
    { x: -87.0, w: 9.6, h: 10.2, wall: '#e89cb0', shutter: '#265c8a', awning: '#2a8f7c', sign: 'CIGAR LOUNGE', neon: '#36f1e6' },
    { x: -76.5, w: 9.2, h: 8.2, wall: '#f4dc94', shutter: '#8f3138', awning: '#d4822a', sign: 'MERCADO LATINO', neon: '#ff4fa3' },
  ];
  havanaSpecs.forEach((hs, idx) => {
    const fac = createHavanaFacadeTexture(hs.wall, hs.shutter, idx + 11);
    const fMat = new THREE.MeshStandardMaterial({
      map: fac.map,
      emissive: '#ffffff',
      emissiveMap: fac.emissiveMap,
      emissiveIntensity: 0.7,
      roughness: 0.68,
    });
    addBox(hs.w, hs.h, 5.2, hs.x, 0.18 + hs.h / 2, 10.8, [fMat, fMat, tileRoofMat, roofDarkMat, fMat, fMat], true, 'havana');
    // Spanish terracotta eaves overhang
    addVisual(new THREE.BoxGeometry(hs.w + 0.5, 0.35, 5.8), tileRoofMat, hs.x, 0.18 + hs.h + 0.15, 10.8, true);
    // Wrought-iron balcony overlooking the plaza (North face, z = 8.0)
    addVisual(new THREE.BoxGeometry(hs.w * 0.72, 0.16, 1.15), darkSteelMat, hs.x, 4.4, 7.85);
    addVisual(new THREE.BoxGeometry(hs.w * 0.72, 0.92, 0.08), darkSteelMat, hs.x, 4.92, 7.32);
    // Striped ground-floor awning
    const awnMat = new THREE.MeshStandardMaterial({
      map: createAwningStripeTexture(hs.awning, '#fff5e4'),
      roughness: 0.7,
    });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(hs.w * 0.8, 0.12, 1.8), awnMat);
    awn.position.set(hs.x, 3.1, 7.5);
    awn.rotation.x = -0.28;
    awn.castShadow = true;
    scene.add(awn);
    // Glowing Neon Shop Sign
    const sTex = createNeonSignTexture(hs.sign, hs.neon);
    const sMat = new THREE.MeshStandardMaterial({
      map: sTex,
      emissive: '#ffffff',
      emissiveMap: sTex,
      emissiveIntensity: 1.65,
    });
    addVisual(new THREE.BoxGeometry(5.2, 0.92, 0.16), sMat, hs.x, 6.4, 8.12);
  });

  // Festive Cuban Plaza String Lights crisscrossing between Diner & Little Havana facades (1 InstancedMesh!)
  const bulbGeo = new THREE.SphereGeometry(0.14, 6, 6);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, warmGlowMat, 36);
  let bIdx = 0;
  for (let strand = 0; strand < 3; strand++) {
    const xStart = -98 + strand * 10;
    const xEnd = -90 + strand * 10;
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      const sag = Math.sin(t * Math.PI) * 0.85;
      dummy.position.set(THREE.MathUtils.lerp(xStart, xEnd, t), 4.65 - sag, THREE.MathUtils.lerp(-1.8, 7.6, t));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bulbInst.setMatrixAt(bIdx++, dummy.matrix);
    }
  }
  bulbInst.instanceMatrix.needsUpdate = true;
  bulbInst.matrixAutoUpdate = false;
  scene.add(bulbInst);

  // Classic Little Havana Domino Tables & Chairs on the Plaza
  for (const dx of [-96, -88, -80]) {
    addBox(1.25, 0.76, 1.25, dx, 0.58, 3.8, woodMat, true, 'domino-table');
    addVisual(new THREE.BoxGeometry(0.95, 0.04, 0.95), dinerCreamMat, dx, 0.98, 3.8);
    // Warm market umbrella
    addVisual(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), darkSteelMat, dx, 1.4, 3.8);
    addVisual(new THREE.ConeGeometry(1.45, 0.55, 8), dinerTealMat, dx, 2.65, 3.8, true);
  }

  // ===========================================================================
  // 4) SOUTH BLOCK (-87, +40): WALK-IN "BANCO DE VICE" WITH BANK VAULT HEIST!
  // ===========================================================================
  // Monumental Neoclassical Art-Deco Bank: x = -101..-74, z = 29..51, grand East entrance facing x = -74
  // Raised marble floor at y = 0.62 (2 wide walkable steps: 0.22m each!)
  addBox(1.4, 0.22, 10.0, -72.8, 0.29, 40, marbleWallMat, false, 'bank-step');
  addBox(1.4, 0.44, 10.0, -74.0, 0.4, 40, marbleWallMat, false, 'bank-step');
  addBox(26.2, 0.62, 22.0, -87.8, 0.31, 40, marbleFloorMat, false, 'bank-floor');

  // Solid Outer Marble Walls (West x=-100.8, North z=29.2, South z=50.8)
  addBox(0.9, 9.2, 22.4, -100.8, 5.2, 40, marbleWallMat, true, 'bank-wall');
  addBox(26.6, 9.2, 0.9, -87.8, 5.2, 29.2, marbleWallMat, true, 'bank-wall');
  addBox(26.6, 9.2, 0.9, -87.8, 5.2, 50.8, marbleWallMat, true, 'bank-wall');
  // East Front Wall with Wide Grand Portal (open z = 36.2..43.8!)
  addBox(0.9, 9.2, 7.2, -75.0, 5.2, 32.8, marbleWallMat, true, 'bank-wall');
  addBox(0.9, 9.2, 7.2, -75.0, 5.2, 47.2, marbleWallMat, true, 'bank-wall');
  addBox(0.9, 4.4, 8.2, -75.0, 7.6, 40.0, marbleWallMat, true, 'bank-lintel');

  // Grand Neoclassical Pediment Roof & 6 Fluted Marble Columns along East Portico
  addBox(28.0, 1.1, 23.4, -87.4, 10.1, 40, marbleWallMat, true, 'bank-roof');
  addVisual(new THREE.BoxGeometry(28.6, 0.36, 24.0), goldMat, -87.4, 9.52, 40);
  addVisual(new THREE.BoxGeometry(0.18, 0.14, 23.2), amberNeon, -73.05, 9.3, 40);

  for (const cz of [30.8, 34.0, 36.4, 43.6, 46.0, 49.2]) {
    addBox(0.95, 8.8, 0.95, -73.4, 5.0, cz, marbleWallMat, true, 'bank-column');
    addVisual(new THREE.CylinderGeometry(0.54, 0.58, 8.6, 12), marbleWallMat, -73.4, 5.0, cz, true);
    addVisual(new THREE.BoxGeometry(1.25, 0.35, 1.25), goldMat, -73.4, 9.35, cz);
    addVisual(new THREE.BoxGeometry(1.25, 0.35, 1.25), goldMat, -73.4, 0.8, cz);
  }

  // Golden "BANCO DE VICE" Facade Sign
  const bankSignTex = createNeonSignTexture('BANCO DE VICE', '#ffd15c');
  const bankSignMat = new THREE.MeshStandardMaterial({
    map: bankSignTex,
    emissive: '#ffffff',
    emissiveMap: bankSignTex,
    emissiveIntensity: 1.65,
  });
  addVisual(new THREE.BoxGeometry(0.24, 1.5, 11.4), bankSignMat, -72.9, 10.15, 40);

  // Lobby Interior: Gold Chandelier Rings (0 PointLights!), Velvet Rope Queue & 3 Teller Windows
  for (const lx of [-80, -87]) {
    addVisual(new THREE.TorusGeometry(1.65, 0.1, 8, 24), goldMat, lx, 8.8, 40);
    addVisual(new THREE.TorusGeometry(1.55, 0.06, 6, 24), warmGlowMat, lx, 8.72, 40);
  }
  // Teller counter along North wall (z = 32.5)
  addBox(12.0, 1.15, 1.1, -83.5, 1.2, 32.5, marbleWallMat, true, 'teller-desk');
  addVisual(new THREE.BoxGeometry(12.2, 0.1, 1.25), goldMat, -83.5, 1.8, 32.5);
  addVisual(new THREE.BoxGeometry(11.6, 1.5, 0.08), glassMat, -83.5, 2.55, 32.5);
  for (let b = 0; b < 5; b++) {
    addVisual(new THREE.CylinderGeometry(0.04, 0.04, 1.55, 6), brassMat, -89.0 + b * 2.75, 2.55, 32.5);
  }
  // Red velvet rope stanchions
  for (let r = 0; r < 4; r++) {
    addVisual(new THREE.CylinderGeometry(0.05, 0.16, 0.95, 8), goldMat, -86 + r * 2.4, 1.1, 35.6);
  }
  addVisual(new THREE.BoxGeometry(7.2, 0.08, 0.08), velvetRedMat, -82.4, 1.42, 35.6);

  // Armored Steel Bank Vault Room at West End (x = -100..-92, z = 35..45)
  addBox(0.7, 5.2, 3.6, -92.0, 3.2, 35.2, vaultSteelMat, true, 'vault-wall');
  addBox(0.7, 5.2, 3.6, -92.0, 3.2, 44.8, vaultSteelMat, true, 'vault-wall');
  addBox(0.7, 2.0, 6.2, -92.0, 4.8, 40.0, vaultSteelMat, true, 'vault-lintel');
  addBox(8.6, 0.6, 12.6, -96.2, 5.8, 40.0, vaultSteelMat, true, 'vault-roof');

  // Iconic Massive Round Open Bank Vault Door with Locking Spoke Wheel!
  const vaultDoorGroup = new THREE.Group();
  vaultDoorGroup.position.set(-91.4, 2.25, 37.3);
  vaultDoorGroup.rotation.y = -0.85; // Swung invitingly open into the lobby!
  const doorDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.42, 24), vaultSteelMat);
  doorDisc.rotation.z = Math.PI / 2;
  const doorRim = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.09, 8, 24), chromeMat);
  doorRim.rotation.y = Math.PI / 2;
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 16), goldMat);
  wheelRing.rotation.y = Math.PI / 2;
  wheelRing.position.x = 0.28;
  vaultDoorGroup.add(doorDisc, doorRim, wheelRing);
  for (let sp = 0; sp < 4; sp++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), goldMat);
    bar.position.x = 0.28;
    bar.rotation.x = (sp / 4) * Math.PI;
    vaultDoorGroup.add(bar);
  }
  scene.add(vaultDoorGroup);

  // Steel Loot Table + Stacked Gold Bullion & Cash Bundles inside Vault (center -96.8, 40.0)
  addBox(2.2, 0.9, 3.6, -96.8, 1.05, 40.0, darkSteelMat, true, 'vault-table');
  const bankLootGroup = new THREE.Group();
  bankLootGroup.position.set(-96.8, 1.55, 40.0);
  const cashGreenMat = new THREE.MeshStandardMaterial({ color: '#38b86d', roughness: 0.55 });
  for (let gx = -0.55; gx <= 0.55; gx += 0.36) {
    for (let gz = -1.1; gz <= 0.2; gz += 0.42) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.14), goldMat);
      bar.position.set(gx, 0.07, gz);
      bankLootGroup.add(bar);
      const bar2 = bar.clone();
      bar2.position.y = 0.21;
      bankLootGroup.add(bar2);
    }
  }
  for (let cz = 0.6; cz <= 1.35; cz += 0.35) {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.24), cashGreenMat);
    stack.position.set(0, 0.11, cz);
    bankLootGroup.add(stack);
  }
  scene.add(bankLootGroup);

  const bankLootRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.25, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd15c', side: THREE.DoubleSide }),
  );
  bankLootRing.rotation.x = -Math.PI / 2;
  bankLootRing.position.set(-95.0, 0.66, 40.0);
  scene.add(bankLootRing);

  // Red Alarm Strobe Beacon inside Bank Lobby (flashes when Vault is robbed!)
  const alarmBeaconMat = new THREE.MeshStandardMaterial({
    color: '#ff1a3a',
    emissive: '#ff1a3a',
    emissiveIntensity: 0.2,
  });
  addVisual(new THREE.SphereGeometry(0.26, 10, 10), alarmBeaconMat, -91.5, 5.2, 40.0);

  let bankVaultTaken = false;
  let alarmTimer = 0;

  // ===========================================================================
  // 5) WEST HAVANA BOULEVARD BACKDROP FACADES (x = -124) & PALMS
  // ===========================================================================
  const backdropSpecs = [
    { z: -46, d: 18, h: 11, wall: '#f0c4a8', shutter: '#226c78', sign: 'BODEGA 86', neon: '#ff9f43' },
    { z: -24, d: 16, h: 13, wall: '#bce0d8', shutter: '#8f3138', sign: 'LA TROPICAL', neon: '#36f1e6' },
    { z: 0, d: 20, h: 12, wall: '#f2d694', shutter: '#1d7a74', sign: 'SALSA CLUB', neon: '#ff4fa3' },
    { z: 24, d: 16, h: 14, wall: '#e8b0c4', shutter: '#265c8a', sign: 'HOTEL CUBA', neon: '#ff9f43' },
    { z: 48, d: 18, h: 11, wall: '#ead7a8', shutter: '#8f3138', sign: 'HAVANA AUTO', neon: '#36f1e6' },
  ];
  backdropSpecs.forEach((bs, idx) => {
    const fac = createHavanaFacadeTexture(bs.wall, bs.shutter, idx + 41);
    const fMat = new THREE.MeshStandardMaterial({
      map: fac.map,
      emissive: '#ffffff',
      emissiveMap: fac.emissiveMap,
      emissiveIntensity: 0.65,
      roughness: 0.7,
    });
    addBox(6.0, bs.h, bs.d, -125.0, 0.18 + bs.h / 2, bs.z, [fMat, fMat, tileRoofMat, roofDarkMat, fMat, fMat], true, 'west-backdrop');
    const sTex = createNeonSignTexture(bs.sign, bs.neon);
    const sMat = new THREE.MeshStandardMaterial({
      map: sTex,
      emissive: '#ffffff',
      emissiveMap: sTex,
      emissiveIntensity: 1.5,
    });
    addVisual(new THREE.BoxGeometry(0.18, 1.05, 5.6), sMat, -121.9, 6.2, bs.z);
  });

  // Register West-District Palm Trees into the main InstancedMesh (0 extra draw calls!)
  const westPalms: [number, number][] = [
    [-71.2, -52.5],
    [-71.2, -27.5],
    [-71.2, 2.0],
    [-71.2, 12.2],
    [-71.2, 27.5],
    [-71.2, 52.5],
    [-103.0, -52.5],
    [-103.0, -13.0],
    [-103.0, 12.2],
    [-103.0, 27.5],
    [-103.0, 52.5],
    [-118.8, -36],
    [-118.8, -8],
    [-118.8, 16],
    [-118.8, 38],
  ];
  westPalms.forEach(([px, pz], idx) => {
    palmPositions.push({ x: px, z: pz, rot: idx * 1.15, scale: 0.9 + (idx % 3) * 0.06 });
  });

  // Visual-only Streetlamps along West Havana Blvd (additive haze cones, 0 extra PointLights!)
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2b2433', roughness: 0.4, metalness: 0.7 });
  const bulbLampMat = new THREE.MeshStandardMaterial({ color: '#ffdf9e', emissive: '#ffaa44', emissiveIntensity: 3.0 });
  const coneMat = new THREE.MeshBasicMaterial({
    color: '#ffb05c',
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const lz of [-48, -16, 16, 48]) {
    addVisual(new THREE.CylinderGeometry(0.08, 0.11, 6.2, 6), poleMat, -105.5, 3.25, lz);
    addVisual(new THREE.BoxGeometry(1.3, 0.08, 0.08), poleMat, -106.05, 6.25, lz);
    addVisual(new THREE.SphereGeometry(0.22, 8, 8), bulbLampMat, -106.65, 6.1, lz);
    addVisual(new THREE.ConeGeometry(2.3, 5.8, 10, 1, true), coneMat, -106.65, 3.15, lz);
  }

  // ===========================================================================
  // 6) HANDLE & ANIMATIONS
  // ===========================================================================
  return {
    isCarInTuningBay: (pos: THREE.Vector3) =>
      pos.x > -96 && pos.x < -76 && pos.z > -44 && pos.z < -31,

    isNearDinerCounter: (pos: THREE.Vector3) =>
      pos.x > -95.5 && pos.x < -81.5 && pos.z > -10.5 && pos.z < -6.5,

    isNearBankVault: (pos: THREE.Vector3) =>
      !bankVaultTaken && pos.x > -99.8 && pos.x < -91.5 && pos.z > 36.2 && pos.z < 43.8,

    takeBankVault: () => {
      bankVaultTaken = true;
      bankLootGroup.visible = false;
      bankLootRing.visible = false;
      alarmTimer = 28.0;
    },

    isInsideInterior: (pos: THREE.Vector3) => {
      const inDiner = pos.x > -101 && pos.x < -76 && pos.z > -12.5 && pos.z < -2.2;
      const inBank = pos.x > -101 && pos.x < -74.5 && pos.z > 29.2 && pos.z < 50.8;
      const inGarage = pos.x > -101 && pos.x < -77 && pos.z > -51 && pos.z < -29;
      return inDiner || inBank || inGarage;
    },

    update: (elapsed: number) => {
      // Spin 3D rooftop neon wheel on Vice Customs
      roofWheelGroup.rotation.y = elapsed * 0.9;

      // Pulse Tuning Bay & Bank Vault rings
      const s = 1 + Math.sin(elapsed * 4.2) * 0.05;
      tuningBayRing.scale.set(s, s, 1);
      if (!bankVaultTaken) {
        bankLootRing.scale.set(s, s, 1);
      }

      // Cycle Diner Jukebox neon arch color smoothly
      const hue = (elapsed * 0.18) % 1;
      jukeboxArchMat.color.setHSL(hue, 0.95, 0.6);
      jukeboxArchMat.emissive.setHSL(hue, 0.95, 0.55);

      // Flash red bank alarm strobe after heist
      if (alarmTimer > 0) {
        alarmTimer -= 0.016;
        alarmBeaconMat.emissiveIntensity = Math.sin(elapsed * 18) > 0 ? 5.2 : 0.25;
      } else {
        alarmBeaconMat.emissiveIntensity = 0.2;
      }
    },
  };
}
