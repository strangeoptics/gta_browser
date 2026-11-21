import * as THREE from 'three';
import type { AABB } from '../types';
import type { StuntRamp } from './StuntRamps';
import { createNeonSignTexture } from './Textures';

export interface NorthPointHandle {
  stuntRamps: StuntRamp[];
  serpentinePoints: { x: number; z: number }[];
  getGroundHeight: (x: number, z: number) => number | null;
  isNearMarinaLoot: (pos: THREE.Vector3) => boolean;
  takeMarinaLoot: () => void;
  isNearLighthouseSpot: (pos: THREE.Vector3) => boolean;
  claimLighthouseBonus: () => boolean;
  update: (elapsed: number) => void;
}

// -----------------------------------------------------------------------------
// Procedural Canvas Textures (Zero External Assets!)
// -----------------------------------------------------------------------------

function createLighthouseStripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const bands = 6;
  const bandH = c.height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d6323a' : '#f5efe6';
    ctx.fillRect(0, i * bandH, c.width, bandH);
  }

  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect((i * 73) % 256, (i * 137) % 512, 3, 5);
  }

  for (let row = 1; row < 5; row++) {
    const wy = row * bandH + bandH * 0.35;
    for (const wx of [58, 182]) {
      ctx.fillStyle = '#23202c';
      ctx.fillRect(wx - 3, wy - 3, 22, 32);
      ctx.fillStyle = row % 2 === 0 ? '#ffd88a' : '#2f384d';
      ctx.fillRect(wx, wy, 16, 26);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCliffRockTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Layered warm coastal limestone / sandstone cliff strata
  const strata = ['#8c7b6b', '#76675a', '#9c8974', '#685b51', '#857363', '#5c524b', '#93806c', '#6e6055'];
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = strata[(y / 16) % strata.length];
    ctx.fillRect(0, y, 256, 16);
    // Horizontal strata shadow seam
    ctx.fillStyle = 'rgba(22, 16, 14, 0.32)';
    ctx.fillRect(0, y + 14, 256, 2);
  }

  // Vertical rock fissures & weathered coastal speckles
  for (let i = 0; i < 420; i++) {
    const x = (i * 67) % 256;
    const y = (i * 113) % 256;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 240, 215, 0.08)' : 'rgba(20, 14, 12, 0.14)';
    ctx.fillRect(x, y, 2 + (i % 5), 6 + (i % 12));
  }

  // Subtle coastal greenery / moss tint along top cliff edge
  const moss = ctx.createLinearGradient(0, 0, 0, 44);
  moss.addColorStop(0, 'rgba(64, 110, 72, 0.62)');
  moss.addColorStop(1, 'rgba(64, 110, 72, 0)');
  ctx.fillStyle = moss;
  ctx.fillRect(0, 0, 256, 44);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  return tex;
}

function createChevronSignTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f5b82e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#18181f';
  ctx.beginPath();
  ctx.moveTo(86, 16);
  ctx.lineTo(112, 16);
  ctx.lineTo(64, 64);
  ctx.lineTo(112, 112);
  ctx.lineTo(86, 112);
  ctx.lineTo(38, 64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#18181f';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 122);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDockPlankTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8b6548';
  ctx.fillRect(0, 0, 256, 256);

  const shades = ['#946d4f', '#825d42', '#9d7556', '#79563c', '#8c6649'];
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = shades[(y / 16) % shades.length];
    ctx.fillRect(0, y + 1, 256, 14);
    ctx.fillStyle = 'rgba(28, 16, 10, 0.45)';
    ctx.fillRect(0, y, 256, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function createMarinaAwningTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? '#1b6ca8' : '#f7f3eb';
    ctx.fillRect(x, 0, 16, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

/**
 * Builds a sleek, sculpted 80s Marina Sport Yacht / Sailboat moored at a pier.
 */
function buildMooredYacht(
  hullHex: string,
  stripeHex: string,
  hasSailMast: boolean,
): THREE.Group {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: hullHex, roughness: 0.24, metalness: 0.28 });
  const trimMat = new THREE.MeshStandardMaterial({ color: stripeHex, roughness: 0.3, metalness: 0.35 });
  const deckMat = new THREE.MeshStandardMaterial({ color: '#c89b6d', roughness: 0.65 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#102236', roughness: 0.08, metalness: 0.88 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e6eef7', roughness: 0.16, metalness: 0.9 });

  const shape = new THREE.Shape();
  shape.moveTo(-1.35, -4.4);
  shape.lineTo(1.35, -4.4);
  shape.lineTo(1.55, 1.4);
  shape.quadraticCurveTo(1.2, 3.8, 0, 5.2);
  shape.quadraticCurveTo(-1.2, 3.8, -1.55, 1.4);
  shape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.05,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 0.88;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.16, 6.4), trimMat);
  stripe.position.set(0, 0.56, -0.8);
  g.add(stripe);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.08, 7.6), deckMat);
  deck.position.set(0, 0.96, -0.3);
  g.add(deck);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.82, 3.3), hullMat);
  cabin.position.set(0, 1.38, -0.6);
  cabin.castShadow = true;
  g.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.45, 1.5), glassMat);
  windshield.position.set(0, 1.56, 0.72);
  windshield.rotation.x = 0.35;
  g.add(windshield);

  const bowRail = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.03, 6, 12, Math.PI), chromeMat);
  bowRail.rotation.x = Math.PI / 2;
  bowRail.position.set(0, 1.28, 3.6);
  g.add(bowRail);

  if (hasSailMast) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 9.2, 8), chromeMat);
    mast.position.set(0, 5.4, 0.2);
    mast.castShadow = true;
    g.add(mast);

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.8, 6), chromeMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 2.35, -1.6);
    g.add(boom);

    const sailMat = new THREE.MeshStandardMaterial({ color: '#f7f1e6', roughness: 0.8 });
    const furledSail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 3.5, 8), sailMat);
    furledSail.rotation.x = Math.PI / 2;
    furledSail.position.set(0, 2.52, -1.55);
    g.add(furledSail);
  } else {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.09, 6, 14, Math.PI), hullMat);
    arch.position.set(0, 1.8, -1.6);
    g.add(arch);
  }

  return g;
}

/**
 * Generates a dramatic, craggy procedural 3D coastal limestone cliff geometry
 * rising from sea level (-1.6m) up to the flat lighthouse summit plateau (y = plateauY).
 */
function buildCliffWallGeometry(
  cx: number,
  cz: number,
  topRadius: number,
  baseRadius: number,
  plateauY: number,
): THREE.BufferGeometry {
  const radialSegs = 48;
  const heightSegs = 10;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let h = 0; h <= heightSegs; h++) {
    const v = h / heightSegs; // 0 = summit edge, 1 = sea floor
    const y = THREE.MathUtils.lerp(plateauY - 0.02, -1.8, v);
    // Steep near top, flaring slightly outward near surf base
    const baseR = THREE.MathUtils.lerp(topRadius, baseRadius, Math.pow(v, 0.82));

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const angle = u * Math.PI * 2;
      // Deterministic craggy coastal cliff modulation (0 at very top edge so plateau stays crisp)
      const cragAmp = Math.sin(v * Math.PI) * 2.1 + v * 1.4;
      const crag =
        (Math.sin(angle * 5 + v * 2.2) * 0.55 +
          Math.cos(angle * 9 - v * 3.1) * 0.35 +
          Math.sin(angle * 13 + v * 1.5) * 0.2) *
        cragAmp;
      const r = baseR + crag;
      const px = cx + Math.cos(angle) * r;
      const pz = cz + Math.sin(angle) * r;

      positions.push(px, y, pz);
      uvs.push(u, v);
    }
  }

  const ringStride = radialSegs + 1;
  for (let h = 0; h < heightSegs; h++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = h * ringStride + s;
      const b = a + 1;
      const c = (h + 1) * ringStride + s;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds "NORTH POINT" — High-Detail Coastal Highway, Vice Marina & Cape Vice Cliff Lighthouse (z = -66..-136):
 * - North Point Coastal Highway (z = -74..-88, x = -124..+54) with wet asphalt, highway gantry & stunt ramps
 * - Vice Marina (x = -50..+36, z = -90..-126) with Yacht Club, boardwalk, 3 piers, 4 bobbing yachts & $2,000 Smuggler Stash
 * - Cape Vice 11m Limestone Sea Cliff & Winding Serpentine Coastal Road climbing smoothly up to the
 *   26m Red/White Striped Lighthouse (total summit height ~39m!), Keeper's Cottage, Scenic Overlook Deck & Cliff-Jump Ramp!
 * - Zero extra PointLights -> 100% constant WebGL shader pipeline!
 */
export function buildNorthPoint(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  roadMat: THREE.Material,
  sidewalkMat: THREE.Material,
  oceanMat: THREE.ShaderMaterial,
  palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[],
): NorthPointHandle {
  const stuntRamps: StuntRamp[] = [];

  const concreteMat = new THREE.MeshStandardMaterial({ color: '#50525c', roughness: 0.72 });
  const cliffRockMat = new THREE.MeshStandardMaterial({
    map: createCliffRockTexture(),
    roughness: 0.86,
    metalness: 0.05,
    flatShading: true,
  });
  const retainingWallMat = new THREE.MeshStandardMaterial({ color: '#6b676d', roughness: 0.82 });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#6b676e', roughness: 0.86, flatShading: true });
  const steelDarkMat = new THREE.MeshStandardMaterial({ color: '#242730', roughness: 0.42, metalness: 0.72 });
  const whiteTrimMat = new THREE.MeshStandardMaterial({ color: '#f3eee6', roughness: 0.45 });
  const clubWallMat = new THREE.MeshStandardMaterial({ color: '#f2e4d2', roughness: 0.52 });
  const roofTerracottaMat = new THREE.MeshStandardMaterial({ color: '#b64b35', roughness: 0.68 });
  const dockPlankMat = new THREE.MeshStandardMaterial({
    map: createDockPlankTexture(4, 10),
    roughness: 0.74,
  });
  const boardwalkMat = new THREE.MeshStandardMaterial({
    map: createDockPlankTexture(18, 2),
    roughness: 0.7,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1b3b54',
    roughness: 0.1,
    metalness: 0.8,
  });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.2 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.2 });
  const amberNeon = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff9f43', emissiveIntensity: 2.2 });
  const warmWindowMat = new THREE.MeshStandardMaterial({ color: '#ffe6b3', emissive: '#ffba5a', emissiveIntensity: 1.5 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.22, metalness: 0.88 });
  const yellowLineMat = new THREE.MeshStandardMaterial({ color: '#e6b85c', roughness: 0.35, metalness: 0.1 });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material | THREE.Material[],
    castShadow = true,
    tag = 'north-point',
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
  // 1) NORTHERN OCEAN EXTENSION & COASTAL HIGHWAY (z = -66..-92)
  // ===========================================================================
  const northOcean = new THREE.Mesh(new THREE.PlaneGeometry(380, 170, 44, 24), oceanMat);
  northOcean.rotation.x = -Math.PI / 2;
  northOcean.position.set(0, -0.22, -180); // spans x = -190..+190, z = -265..-95
  scene.add(northOcean);

  // Main North Point Coastal Highway slab (x = -124..+56, z = -92..-66)
  const highwayBase = new THREE.Mesh(new THREE.PlaneGeometry(182, 28), roadMat);
  highwayBase.rotation.x = -Math.PI / 2;
  highwayBase.position.set(-33, 0.0, -79);
  highwayBase.receiveShadow = true;
  scene.add(highwayBase);
  worldMeshes.push(highwayBase);

  // Coastal seawall & boardwalk embankment along Marina waterfront (x = -124..+46, z = -92..-98)
  addBox(170, 1.4, 8.0, -39, -0.52, -95.0, concreteMat, false, 'marina-quay');
  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(168, 6.2), boardwalkMat);
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(-39, 0.2, -95.0);
  promenade.receiveShadow = true;
  scene.add(promenade);

  // Highway Double-Yellow Centerlines & Connectors (InstancedMesh -> 1 draw call!)
  const dashMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (let x = -114; x <= 42; x += 5.5) {
    dummy.position.set(x, 0.014, -81.0);
    dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    dummy.scale.set(0.24, 3.0, 1);
    dummy.updateMatrix();
    dashMatrices.push(dummy.matrix.clone());
  }
  for (const ax of [-112, -60, -20, 20, 60]) {
    for (const az of [-68.5, -74.0]) {
      dummy.position.set(ax, 0.014, az);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(0.22, 2.6, 1);
      dummy.updateMatrix();
      dashMatrices.push(dummy.matrix.clone());
    }
  }
  const hwyDashInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), yellowLineMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => hwyDashInst.setMatrixAt(i, m));
  hwyDashInst.instanceMatrix.needsUpdate = true;
  hwyDashInst.matrixAutoUpdate = false;
  scene.add(hwyDashInst);

  // Illuminated "NORTH POINT · MARINA · LIGHTHOUSE" Highway Gantry at x = 0, z = -81
  for (const gz of [-88.5, -73.5]) {
    addBox(0.75, 6.0, 0.75, 0, 3.0, gz, steelDarkMat, true, 'hwy-gantry');
  }
  addVisual(new THREE.BoxGeometry(0.8, 1.15, 16.0), steelDarkMat, 0, 6.0, -81.0, true);
  const hwySignTex = createNeonSignTexture('NORTH POINT · MARINA', '#36f1e6');
  const hwySignMat = new THREE.MeshStandardMaterial({
    map: hwySignTex,
    emissive: '#ffffff',
    emissiveMap: hwySignTex,
    emissiveIntensity: 1.7,
  });
  addVisual(new THREE.BoxGeometry(0.18, 1.35, 10.6), hwySignMat, -0.45, 6.05, -81.0);
  addVisual(new THREE.BoxGeometry(0.18, 1.35, 10.6), hwySignMat, 0.45, 6.05, -81.0);

  // Raised Coastal Median Planters between z = -66 and Highway (-73)
  for (const [mx, mw] of [
    [-86, 36],
    [-40, 26],
    [0, 26],
    [40, 24],
  ]) {
    addBox(mw, 0.22, 5.2, mx, 0.11, -70.0, sidewalkMat, false, 'median');
  }

  // ===========================================================================
  // 2) VICE MARINA — YACHT CLUB, 3 PIERS, 4 BOBBING YACHTS & SMUGGLER STASH
  // ===========================================================================
  addBox(14.0, 4.6, 6.2, -30, 2.5, -93.8, clubWallMat, true, 'yacht-club');
  addVisual(new THREE.BoxGeometry(14.8, 0.45, 6.8), roofTerracottaMat, -30, 5.0, -93.8, true);
  addVisual(new THREE.BoxGeometry(11.0, 1.9, 0.16), glassMat, -30, 2.4, -90.65);
  addVisual(new THREE.BoxGeometry(11.0, 1.9, 0.16), warmWindowMat, -30, 2.4, -96.95);
  const marinaAwningMat = new THREE.MeshStandardMaterial({
    map: createMarinaAwningTexture(),
    roughness: 0.65,
  });
  const clubAwning = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.14, 2.2), marinaAwningMat);
  clubAwning.position.set(-30, 3.6, -98.0);
  clubAwning.rotation.x = -0.25;
  scene.add(clubAwning);

  const marinaSignTex = createNeonSignTexture('VICE MARINA · YACHT CLUB', '#36f1e6');
  const marinaSignMat = new THREE.MeshStandardMaterial({
    map: marinaSignTex,
    emissive: '#ffffff',
    emissiveMap: marinaSignTex,
    emissiveIntensity: 1.7,
  });
  addVisual(new THREE.BoxGeometry(8.8, 1.15, 0.2), marinaSignMat, -30, 5.85, -90.5);
  addVisual(new THREE.BoxGeometry(8.8, 1.15, 0.2), marinaSignMat, -30, 5.85, -97.1);

  const pierXs = [-36, -8, 20];
  const pilingPositions: [number, number][] = [];
  for (const px of pierXs) {
    addBox(3.4, 0.36, 26.0, px, 0.04, -111.0, dockPlankMat, true, 'marina-pier');
    addVisual(new THREE.BoxGeometry(0.08, 0.08, 25.4), cyanNeon, px - 1.68, 0.24, -111.0);
    addVisual(new THREE.BoxGeometry(0.08, 0.08, 25.4), cyanNeon, px + 1.68, 0.24, -111.0);
    for (let pz = -101; pz >= -123; pz -= 5.5) {
      pilingPositions.push([px - 1.75, pz]);
      pilingPositions.push([px + 1.75, pz]);
    }
  }

  const pilingGeo = new THREE.CylinderGeometry(0.16, 0.18, 2.2, 8);
  const pilingMat = new THREE.MeshStandardMaterial({ color: '#4b3729', roughness: 0.9 });
  const pilingInst = new THREE.InstancedMesh(pilingGeo, pilingMat, pilingPositions.length);
  pilingPositions.forEach(([x, z], i) => {
    dummy.position.set(x, 0.28, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    pilingInst.setMatrixAt(i, dummy.matrix);
  });
  pilingInst.instanceMatrix.needsUpdate = true;
  pilingInst.matrixAutoUpdate = false;
  scene.add(pilingInst);

  const mooredYachts: { group: THREE.Group; baseY: number; phase: number }[] = [];
  const yachtSpecs: [number, number, number, string, string, boolean][] = [
    [-40.2, -108, 0.06, '#f6f4ef', '#1d6fa5', true],
    [-12.2, -114, -0.04, '#f8f5f0', '#ff4fa3', false],
    [-3.8, -107, Math.PI + 0.05, '#203048', '#36f1e6', true],
    [15.8, -112, -0.05, '#f5efe6', '#d9483b', false],
  ];
  yachtSpecs.forEach(([yx, yz, yYaw, hull, stripe, sail], idx) => {
    const yg = buildMooredYacht(hull, stripe, sail);
    yg.position.set(yx, -0.25, yz);
    yg.rotation.y = yYaw;
    scene.add(yg);
    mooredYachts.push({ group: yg, baseY: -0.25, phase: idx * 1.45 });
  });

  const marinaLootGroup = new THREE.Group();
  marinaLootGroup.position.set(-8, 0.26, -122.2);
  const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.24, 0.52), steelDarkMat);
  caseMesh.position.y = 0.12;
  const goldClip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.38), goldMat);
  goldClip.position.y = 0.25;
  marinaLootGroup.add(caseMesh, goldClip);
  scene.add(marinaLootGroup);

  const marinaLootRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.15, 24),
    new THREE.MeshBasicMaterial({ color: '#36f1e6', side: THREE.DoubleSide }),
  );
  marinaLootRing.rotation.x = -Math.PI / 2;
  marinaLootRing.position.set(-8, 0.25, -122.2);
  scene.add(marinaLootRing);
  let marinaLootTaken = false;

  // ===========================================================================
  // 3) CAPE VICE 11m SEA CLIFF & WINDING SERPENTINE COASTAL ROAD
  // ===========================================================================
  const CLIFF_CX = 78;
  const CLIFF_CZ = -114;
  const PLATEAU_R = 16.5;
  const PLATEAU_Y = 11.0;

  // Dramatic craggy 3D limestone sea cliff rising from the ocean up to y = 11.0m
  const cliffMesh = new THREE.Mesh(
    buildCliffWallGeometry(CLIFF_CX, CLIFF_CZ, PLATEAU_R, 27.5, PLATEAU_Y),
    cliffRockMat,
  );
  cliffMesh.castShadow = true;
  cliffMesh.receiveShadow = true;
  scene.add(cliffMesh);
  worldMeshes.push(cliffMesh);

  // Flat Summit Plateau Crown (paved coastal sandstone / plaza surface at y = 11.0m)
  const summitCap = new THREE.Mesh(new THREE.CylinderGeometry(PLATEAU_R, PLATEAU_R + 0.3, 0.4, 36), sidewalkMat);
  summitCap.position.set(CLIFF_CX, PLATEAU_Y - 0.2, CLIFF_CZ);
  summitCap.receiveShadow = true;
  scene.add(summitCap);
  worldMeshes.push(summitCap);

  // Winding Serpentine Spline climbing smoothly from Highway (44, 0, -82) around the East Sea Cliff up to Summit (78, 11, -120)
  const serpentineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(44, 0.0, -82),
    new THREE.Vector3(56, 0.7, -83),
    new THREE.Vector3(70, 2.2, -86),
    new THREE.Vector3(86, 4.1, -90),
    new THREE.Vector3(98, 6.0, -98),
    new THREE.Vector3(99, 7.9, -111),
    new THREE.Vector3(94, 9.6, -123),
    new THREE.Vector3(84, 10.75, -127.5),
    new THREE.Vector3(78, PLATEAU_Y, -121.5),
  ]);

  const ROAD_SEGS = 64;
  const HALF_W = 3.7; // 7.4m wide coastal serpentine for comfortable high-speed drifting!
  const samples: {
    pos: THREE.Vector3;
    tan: THREE.Vector3;
    right: THREE.Vector3;
  }[] = [];

  for (let i = 0; i <= ROAD_SEGS; i++) {
    const t = i / ROAD_SEGS;
    const pos = serpentineCurve.getPoint(t);
    const tan = serpentineCurve.getTangent(t).normalize();
    // Horizontal right vector (perpendicular to tangent in XZ plane -> points outward toward sea edge!)
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    samples.push({ pos, tan, right });
  }

  // Build Serpentine Asphalt Ribbon, Yellow Centerline & Solid Retaining Wall Underneath
  const roadPos: number[] = [];
  const roadUv: number[] = [];
  const roadIdx: number[] = [];

  const linePos: number[] = [];
  const lineIdx: number[] = [];

  const wallPos: number[] = [];
  const wallIdx: number[] = [];

  const railPos: number[] = [];
  const railIdx: number[] = [];

  for (let i = 0; i <= ROAD_SEGS; i++) {
    const { pos, right } = samples[i];
    const vUv = (i / ROAD_SEGS) * 14;

    // Left (cliff-side) & Right (ocean-side) road edge vertices
    const lx = pos.x - right.x * HALF_W;
    const lz = pos.z - right.z * HALF_W;
    const rx = pos.x + right.x * HALF_W;
    const rz = pos.z + right.z * HALF_W;

    roadPos.push(lx, pos.y + 0.02, lz, rx, pos.y + 0.02, rz);
    roadUv.push(0, vUv, 1, vUv);

    // Centerline ribbon
    const clx = pos.x - right.x * 0.14;
    const clz = pos.z - right.z * 0.14;
    const crx = pos.x + right.x * 0.14;
    const crz = pos.z + right.z * 0.14;
    linePos.push(clx, pos.y + 0.045, clz, crx, pos.y + 0.045, crz);

    // Solid retaining wall skirt dropping straight from both road edges down to sea level (-1.6m)
    wallPos.push(
      rx, pos.y + 0.01, rz,
      rx + right.x * 0.9, -1.6, rz + right.z * 0.9,
      lx, pos.y + 0.01, lz,
      lx - right.x * 0.9, -1.6, lz - right.z * 0.9,
    );

    // Outer coastal guardrail ribbon (ocean-side edge, y+0.45 to y+0.88)
    const gx = pos.x + right.x * (HALF_W - 0.15);
    const gz = pos.z + right.z * (HALF_W - 0.15);
    railPos.push(gx, pos.y + 0.48, gz, gx, pos.y + 0.88, gz);

    if (i < ROAD_SEGS) {
      const bi = i * 2;
      roadIdx.push(bi, bi + 1, bi + 3, bi, bi + 3, bi + 2);
      lineIdx.push(bi, bi + 1, bi + 3, bi, bi + 3, bi + 2);

      const wi = i * 4;
      // Outer ocean-facing retaining wall
      wallIdx.push(wi, wi + 1, wi + 5, wi, wi + 5, wi + 4);
      // Inner cliff-facing retaining wall
      wallIdx.push(wi + 2, wi + 6, wi + 7, wi + 2, wi + 7, wi + 3);

      // Guardrail strip (skip very last 4 segments where road merges into summit plateau)
      if (i < ROAD_SEGS - 4 && i > 1) {
        railIdx.push(bi, bi + 1, bi + 3, bi, bi + 3, bi + 2);
      }
    }
  }

  const serpRoadGeo = new THREE.BufferGeometry();
  serpRoadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  serpRoadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
  serpRoadGeo.setIndex(roadIdx);
  serpRoadGeo.computeVertexNormals();
  const serpRoadMesh = new THREE.Mesh(serpRoadGeo, roadMat);
  serpRoadMesh.receiveShadow = true;
  scene.add(serpRoadMesh);
  worldMeshes.push(serpRoadMesh);

  const serpLineGeo = new THREE.BufferGeometry();
  serpLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  serpLineGeo.setIndex(lineIdx);
  serpLineGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(serpLineGeo, yellowLineMat));

  const serpWallGeo = new THREE.BufferGeometry();
  serpWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  serpWallGeo.setIndex(wallIdx);
  serpWallGeo.computeVertexNormals();
  const serpWallMesh = new THREE.Mesh(serpWallGeo, retainingWallMat);
  serpWallMesh.castShadow = true;
  serpWallMesh.receiveShadow = true;
  scene.add(serpWallMesh);
  worldMeshes.push(serpWallMesh);

  const serpRailGeo = new THREE.BufferGeometry();
  serpRailGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
  serpRailGeo.setIndex(railIdx);
  serpRailGeo.computeVertexNormals();
  const railMat = new THREE.MeshStandardMaterial({ color: '#eef2f7', roughness: 0.35, metalness: 0.45, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(serpRailGeo, railMat));

  // Guardrail posts, reflective cyan/amber roadside reflectors & safety colliders along the outer ocean edge!
  const postGeo = new THREE.BoxGeometry(0.16, 0.95, 0.16);
  const reflGeo = new THREE.BoxGeometry(0.18, 0.14, 0.18);
  const postIndices: number[] = [];
  for (let i = 3; i <= ROAD_SEGS - 5; i += 2) {
    postIndices.push(i);
  }
  const postInst = new THREE.InstancedMesh(postGeo, steelDarkMat, postIndices.length);
  const reflInst = new THREE.InstancedMesh(reflGeo, amberNeon, postIndices.length);
  postIndices.forEach((si, idx) => {
    const { pos, right } = samples[si];
    const gx = pos.x + right.x * (HALF_W - 0.15);
    const gz = pos.z + right.z * (HALF_W - 0.15);

    dummy.position.set(gx, pos.y + 0.48, gz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    postInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(gx, pos.y + 0.96, gz);
    dummy.updateMatrix();
    reflInst.setMatrixAt(idx, dummy.matrix);

    // Compact guardrail collider so cars can safely drift the hairpin without falling off
    colliders.push({
      minX: gx - 0.55,
      maxX: gx + 0.55,
      minY: pos.y,
      maxY: pos.y + 1.15,
      minZ: gz - 0.55,
      maxZ: gz + 0.55,
      tag: 'cliff-guardrail',
    });
  });
  postInst.instanceMatrix.needsUpdate = true;
  reflInst.instanceMatrix.needsUpdate = true;
  postInst.matrixAutoUpdate = false;
  reflInst.matrixAutoUpdate = false;
  scene.add(postInst, reflInst);

  // 80s Yellow/Black Chevron Curve Warning Signs ("<<<") around the Hairpin Cliff Turn!
  const chevronTex = createChevronSignTexture();
  const chevronMat = new THREE.MeshStandardMaterial({
    map: chevronTex,
    emissive: '#ffbb33',
    emissiveMap: chevronTex,
    emissiveIntensity: 0.45,
    roughness: 0.4,
  });
  for (const si of [24, 29, 34, 39, 45]) {
    const { pos, tan, right } = samples[si];
    const sx = pos.x + right.x * (HALF_W + 0.35);
    const sz = pos.z + right.z * (HALF_W + 0.35);
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), steelDarkMat);
    signPole.position.set(sx, pos.y + 1.1, sz);
    scene.add(signPole);

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.08), chevronMat);
    signBoard.position.set(sx, pos.y + 2.15, sz);
    signBoard.rotation.y = Math.atan2(-tan.x, -tan.z);
    scene.add(signBoard);
  }

  // Stylized Coastal Surf Boulders around the base of the Sea Cliff
  const rockGeo = new THREE.DodecahedronGeometry(2.6, 0);
  const boulderSpots: [number, number, number, number][] = [
    [52, -106, 1.3, 0.4],
    [54, -122, 1.5, 1.2],
    [64, -135, 1.8, 2.1],
    [82, -138, 1.9, 0.8],
    [102, -128, 1.7, 1.7],
    [107, -108, 1.6, 2.6],
    [103, -91, 1.4, 0.3],
  ];
  for (const [rx, rz, sc, ry] of boulderSpots) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(rx, 0.1, rz);
    rock.scale.set(sc * 1.25, sc * 0.78, sc);
    rock.rotation.set(ry * 0.3, ry, 0.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  // ===========================================================================
  // 4) SUMMIT LANDMARKS ON THE 11m CLIFF PLATEAU (Lighthouse, Cottage, Deck & Cliff Jump!)
  // ===========================================================================
  const lhX = 81;
  const lhZ = -114;

  // Octagonal stone base pedestal sitting on the 11m cliff plateau
  addBox(6.4, 2.4, 6.4, lhX, PLATEAU_Y + 1.2, lhZ, concreteMat, true, 'lighthouse-base');
  // Tall tapered 26m red/white striped cylindrical tower (base y = 11m -> lantern at y = 36m!)
  const lhTex = createLighthouseStripeTexture();
  const lhMat = new THREE.MeshStandardMaterial({ map: lhTex, roughness: 0.56, metalness: 0.08 });
  const lhTower = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.55, 22.0, 20), lhMat);
  lhTower.position.set(lhX, PLATEAU_Y + 13.0, lhZ);
  lhTower.castShadow = true;
  lhTower.receiveShadow = true;
  scene.add(lhTower);
  worldMeshes.push(lhTower);

  // Black Wrought-Iron Gallery Deck & Railing at y = PLATEAU_Y + 24.1
  addVisual(new THREE.CylinderGeometry(2.45, 2.0, 0.55, 18), steelDarkMat, lhX, PLATEAU_Y + 24.1, lhZ, true);
  addVisual(new THREE.TorusGeometry(2.38, 0.07, 6, 20), steelDarkMat, lhX, PLATEAU_Y + 24.95, lhZ);

  // Glass Lantern Room, Glowing Fresnel Lens Core & Copper Cupola Roof
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#ffeec2',
    emissive: '#ffcf70',
    emissiveIntensity: 1.45,
    transparent: true,
    opacity: 0.74,
    roughness: 0.1,
  });
  addVisual(new THREE.CylinderGeometry(1.42, 1.42, 2.4, 14), lanternGlassMat, lhX, PLATEAU_Y + 25.5, lhZ);
  addVisual(new THREE.ConeGeometry(1.72, 1.9, 14), roofTerracottaMat, lhX, PLATEAU_Y + 27.6, lhZ, true);
  addVisual(new THREE.CylinderGeometry(0.05, 0.08, 1.5, 6), goldMat, lhX, PLATEAU_Y + 29.1, lhZ);

  // Rotating Dual Volumetric Lighthouse Light Beams sweeping from 36.6m altitude!
  const beamPivot = new THREE.Group();
  beamPivot.position.set(lhX, PLATEAU_Y + 25.6, lhZ);
  const beamGeo = new THREE.ConeGeometry(8.5, 92, 16, 1, true);
  beamGeo.translate(0, -46, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fff1b8',
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamA = new THREE.Mesh(beamGeo, beamMat);
  beamA.rotation.z = Math.PI / 2 - 0.18;
  const beamB = new THREE.Mesh(beamGeo, beamMat);
  beamB.rotation.z = -Math.PI / 2 + 0.18;
  beamPivot.add(beamA, beamB);
  scene.add(beamPivot);

  // Keeper's Cottage beside the Lighthouse on the 11m Plateau (x = 70, z = -115)
  addBox(6.8, 3.6, 5.4, 70, PLATEAU_Y + 1.8, -115, clubWallMat, true, 'keepers-cottage');
  addVisual(new THREE.ConeGeometry(5.2, 2.1, 4), roofTerracottaMat, 70, PLATEAU_Y + 4.65, -115, true);
  addVisual(new THREE.BoxGeometry(1.8, 1.2, 0.14), warmWindowMat, 70, PLATEAU_Y + 2.0, -112.26);
  addVisual(new THREE.BoxGeometry(1.8, 1.2, 0.14), warmWindowMat, 70, PLATEAU_Y + 2.0, -117.74);

  // Wooden Scenic Overlook Deck perched on the South Cliff Rim (x = 79, z = -101)
  addBox(7.2, 0.24, 4.2, 79, PLATEAU_Y + 0.12, -100.5, dockPlankMat, true, 'scenic-deck');
  addVisual(new THREE.BoxGeometry(7.2, 0.12, 0.12), whiteTrimMat, 79, PLATEAU_Y + 1.15, -98.5);
  for (const bx of [75.5, 79.0, 82.5]) {
    addVisual(new THREE.BoxGeometry(0.14, 1.1, 0.14), whiteTrimMat, bx, PLATEAU_Y + 0.65, -98.5);
  }
  const scenicRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.32, 24),
    new THREE.MeshBasicMaterial({ color: '#ff9f43', side: THREE.DoubleSide }),
  );
  scenicRing.rotation.x = -Math.PI / 2;
  scenicRing.position.set(79, PLATEAU_Y + 0.28, -100.8);
  scene.add(scenicRing);
  let lighthouseBonusClaimed = false;

  // ===========================================================================
  // 5) NORTH POINT STUNT RAMPS (2 Highway Ramps + 1 Epic 11m Cliff-Jump Ramp!)
  // ===========================================================================
  const buildStuntRamp = (rx: number, ry: number, rz: number, yaw: number, neonMat: THREE.Material) => {
    const rampW = 5.2;
    const rampL = 9.5;
    const rampH = 2.4;
    const g = new THREE.Group();
    g.position.set(rx, ry, rz);
    g.rotation.y = yaw;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(rampL, 0);
    shape.lineTo(rampL, rampH);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: rampW, bevelEnabled: false });
    geo.translate(-rampL / 2, 0, -rampW / 2);
    geo.rotateY(-Math.PI / 2);

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#2b2438', roughness: 0.48, metalness: 0.4 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);

    for (const sx of [-rampW / 2 + 0.14, rampW / 2 - 0.14]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, Math.hypot(rampL, rampH)), neonMat);
      strip.position.set(sx, rampH * 0.5 + 0.08, 0);
      strip.rotation.x = -Math.atan2(rampH, rampL);
      g.add(strip);
    }
    scene.add(g);

    stuntRamps.push({
      x: rx,
      z: rz,
      width: rampW,
      length: rampL,
      height: rampH,
      dirX: Math.sin(yaw),
      dirZ: Math.cos(yaw),
    });
  };
  buildStuntRamp(26, 0, -83, Math.PI / 2, pinkNeon);
  buildStuntRamp(-84, 0, -83, -Math.PI / 2, amberNeon);
  // Epic Cliff-Jump Stunt Ramp perched on the 11m Lighthouse Plateau launching southwest over the bay!
  buildStuntRamp(68, PLATEAU_Y, -104, -2.55, cyanNeon);

  // ===========================================================================
  // 6) COASTAL PALMS (INCLUDING 11m CLIFF SUMMIT PALMS!) & PROMENADE LAMPS
  // ===========================================================================
  const northPalms: [number, number, number][] = [
    [-108, 0.18, -93.5],
    [-92, 0.18, -93.5],
    [-74, 0.18, -93.5],
    [-54, 0.18, -93.5],
    [-16, 0.18, -93.5],
    [4, 0.18, -93.5],
    [28, 0.18, -93.5],
    [-40, 0.18, -70],
    [0, 0.18, -70],
    [40, 0.18, -70],
    // Summit palms framing the 11m Cape Vice Lighthouse Plateau!
    [88, PLATEAU_Y, -107],
    [90, PLATEAU_Y, -118],
    [71, PLATEAU_Y, -124],
    [64, PLATEAU_Y, -113],
  ];
  northPalms.forEach(([px, py, pz], idx) => {
    palmPositions.push({ x: px, y: py, z: pz, rot: idx * 1.23, scale: 0.94 + (idx % 3) * 0.06 });
  });

  const bulbLampMat = new THREE.MeshStandardMaterial({ color: '#ffdf9e', emissive: '#ffaa44', emissiveIntensity: 3.0 });
  const hazeConeMat = new THREE.MeshBasicMaterial({
    color: '#ffb05c',
    transparent: true,
    opacity: 0.058,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const lx of [-98, -62, -20, 12, 42]) {
    addVisual(new THREE.CylinderGeometry(0.08, 0.11, 6.2, 6), steelDarkMat, lx, 3.25, -92.5);
    addVisual(new THREE.SphereGeometry(0.22, 8, 8), bulbLampMat, lx, 6.4, -92.5);
    addVisual(new THREE.ConeGeometry(2.3, 5.8, 10, 1, true), hazeConeMat, lx, 3.45, -92.5);
  }

  // Coastal Overlook Welcome Sign on West Promontory (-92, -96)
  const overlookSignTex = createNeonSignTexture('NORTH POINT OVERLOOK', '#ff9f43');
  const overlookSignMat = new THREE.MeshStandardMaterial({
    map: overlookSignTex,
    emissive: '#ffffff',
    emissiveMap: overlookSignTex,
    emissiveIntensity: 1.6,
  });
  addVisual(new THREE.BoxGeometry(0.25, 3.6, 0.25), steelDarkMat, -95.2, 2.0, -96.2);
  addVisual(new THREE.BoxGeometry(0.25, 3.6, 0.25), steelDarkMat, -88.8, 2.0, -96.2);
  addVisual(new THREE.BoxGeometry(6.8, 1.15, 0.2), overlookSignMat, -92.0, 3.4, -96.2);
  addVisual(new THREE.BoxGeometry(10.0, 0.14, 0.14), whiteTrimMat, -92.0, 1.1, -98.4);

  // ===========================================================================
  // 7) FAST GROUND HEIGHT QUERY FOR SERPENTINE ROAD & 11m CLIFF PLATEAU
  // ===========================================================================
  const serpentinePoints = samples.map((s) => ({ x: s.pos.x, z: s.pos.z }));

  const getGroundHeight = (x: number, z: number): number | null => {
    // Fast broad-phase reject outside Cape Vice Cliff & Serpentine bounding box
    if (x < 39 || x > 106 || z < -134 || z > -76) return null;

    // 1) Find the CLOSEST point on the Serpentine Road spline (NOT the highest!)
    // Using closest projection guarantees a 100% smooth, continuous ramp with zero stair-stepping!
    const roadHitDistSq = (HALF_W + 0.55) * (HALF_W + 0.55);
    let bestRoadDistSq = roadHitDistSq;
    let roadY: number | null = null;

    for (let i = 0; i < ROAD_SEGS; i++) {
      const a = samples[i].pos;
      const b = samples[i + 1].pos;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      if (lenSq < 0.0001) continue;
      let t = ((x - a.x) * abx + (z - a.z) * abz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (dSq < bestRoadDistSq) {
        bestRoadDistSq = dSq;
        roadY = a.y + (b.y - a.y) * t;
      }
    }

    // 2) Check flat 11m Lighthouse Summit Plateau
    const dxC = x - CLIFF_CX;
    const dzC = z - CLIFF_CZ;
    const onPlateau = dxC * dxC + dzC * dzC <= (PLATEAU_R + 0.4) * (PLATEAU_R + 0.4);

    if (roadY !== null) {
      // Smooth merge into the 11m summit plateau at the top of the serpentine
      return onPlateau && roadY > PLATEAU_Y - 1.2 ? Math.max(roadY, PLATEAU_Y) : roadY;
    }

    return onPlateau ? PLATEAU_Y : null;
  };

  // ===========================================================================
  // 8) HANDLE & ANIMATIONS
  // ===========================================================================
  return {
    stuntRamps,
    serpentinePoints,
    getGroundHeight,

    isNearMarinaLoot: (pos: THREE.Vector3) =>
      !marinaLootTaken && pos.distanceToSquared(new THREE.Vector3(-8, 0.4, -122.2)) < 9.0,

    takeMarinaLoot: () => {
      marinaLootTaken = true;
      marinaLootGroup.visible = false;
      marinaLootRing.visible = false;
    },

    isNearLighthouseSpot: (pos: THREE.Vector3) =>
      pos.distanceToSquared(new THREE.Vector3(79, PLATEAU_Y + 0.6, -100.8)) < 14.0,

    claimLighthouseBonus: () => {
      if (lighthouseBonusClaimed) return false;
      lighthouseBonusClaimed = true;
      return true;
    },

    update: (elapsed: number) => {
      beamPivot.rotation.y = elapsed * 0.52;

      for (const y of mooredYachts) {
        y.group.position.y = y.baseY + Math.sin(elapsed * 1.45 + y.phase) * 0.09;
        y.group.rotation.z = Math.sin(elapsed * 1.15 + y.phase) * 0.032;
        y.group.rotation.x = Math.cos(elapsed * 0.9 + y.phase) * 0.018;
      }

      const s = 1 + Math.sin(elapsed * 4.0) * 0.06;
      if (!marinaLootTaken) {
        marinaLootRing.scale.set(s, s, 1);
      }
      scenicRing.scale.set(s, s, 1);
    },
  };
}
