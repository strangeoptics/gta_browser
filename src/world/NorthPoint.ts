import * as THREE from 'three';
import type { AABB } from '../types';
import type { StuntRamp } from './StuntRamps';
import { createNeonSignTexture } from './Textures';

export interface NorthPointHandle {
  stuntRamps: StuntRamp[];
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

  // Crisp classic alternating red & sun-bleached white bands
  const bands = 6;
  const bandH = c.height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d6323a' : '#f5efe6';
    ctx.fillRect(0, i * bandH, c.width, bandH);
  }

  // Subtle coastal plaster grain & salt weathering
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect((i * 73) % 256, (i * 137) % 512, 3, 5);
  }

  // Small recessed dark-framed tower porthole windows
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

  // Sculpted extruded V-shaped hull
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

  // Accent stripe along hull side
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.16, 6.4), trimMat);
  stripe.position.set(0, 0.56, -0.8);
  g.add(stripe);

  // Teak deck inlay
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.08, 7.6), deckMat);
  deck.position.set(0, 0.96, -0.3);
  g.add(deck);

  // Sleek raked cabin & wraparound windshield
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.82, 3.3), hullMat);
  cabin.position.set(0, 1.38, -0.6);
  cabin.castShadow = true;
  g.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.45, 1.5), glassMat);
  windshield.position.set(0, 1.56, 0.72);
  windshield.rotation.x = 0.35;
  g.add(windshield);

  // Bow chrome pulpit rail
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

    // Furled white canvas sail along boom
    const sailMat = new THREE.MeshStandardMaterial({ color: '#f7f1e6', roughness: 0.8 });
    const furledSail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 3.5, 8), sailMat);
    furledSail.rotation.x = Math.PI / 2;
    furledSail.position.set(0, 2.52, -1.55);
    g.add(furledSail);
  } else {
    // Sport radar arch on motor yachts
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.09, 6, 14, Math.PI), hullMat);
    arch.position.set(0, 1.8, -1.6);
    g.add(arch);
  }

  return g;
}

/**
 * Builds "NORTH POINT" — High-Detail Coastal Highway, Vice Marina & Cape Vice Lighthouse (z = -66..-128):
 * - North Point Coastal Highway (z = -74..-88, x = -118..+72) with wet asphalt, highway gantry & 2 stunt ramps
 * - Vice Marina (x = -50..+36, z = -90..-126) with Yacht Club, boardwalk, 3 piers, 4 bobbing yachts & $2,000 Smuggler Stash
 * - Cape Vice Peninsula & 26m Red/White Striped Lighthouse (x = 76, z = -114) with rotating dual volumetric light beams,
 *   Keeper's Cottage, coastal rocks & Scenic Overlook bonus (+$1,000 & 100% HP)
 * - Zero extra PointLights -> 100% constant WebGL shader pipeline!
 */
export function buildNorthPoint(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  roadMat: THREE.Material,
  sidewalkMat: THREE.Material,
  oceanMat: THREE.ShaderMaterial,
  palmPositions: { x: number; z: number; rot: number; scale: number }[],
): NorthPointHandle {
  const stuntRamps: StuntRamp[] = [];

  const concreteMat = new THREE.MeshStandardMaterial({ color: '#50525c', roughness: 0.72 });
  const sandPeninsulaMat = new THREE.MeshStandardMaterial({ color: '#d8ba93', roughness: 0.88 });
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
  // Northern animated ocean covering the entire Marina & Lighthouse bay (z = -96..-256)
  const northOcean = new THREE.Mesh(new THREE.PlaneGeometry(360, 160, 44, 24), oceanMat);
  northOcean.rotation.x = -Math.PI / 2;
  northOcean.position.set(-10, -0.22, -176); // spans x = -190..+170, z = -256..-96
  scene.add(northOcean);

  // Main North Point Coastal Highway slab (wet reflective asphalt: x = -124..+74, z = -92..-66)
  const highwayBase = new THREE.Mesh(new THREE.PlaneGeometry(198, 28), roadMat);
  highwayBase.rotation.x = -Math.PI / 2;
  highwayBase.position.set(-25, 0.0, -79);
  highwayBase.receiveShadow = true;
  scene.add(highwayBase);
  worldMeshes.push(highwayBase);

  // Coastal seawall & boardwalk embankment separating Highway from the Northern Bay (z = -92..-98)
  addBox(198, 1.4, 8.0, -25, -0.52, -95.0, concreteMat, false, 'marina-quay');
  const promenade = new THREE.Mesh(new THREE.PlaneGeometry(196, 6.2), boardwalkMat);
  promenade.rotation.x = -Math.PI / 2;
  promenade.position.set(-25, 0.2, -95.0);
  promenade.receiveShadow = true;
  scene.add(promenade);

  // Highway Double-Yellow Centerlines & Connectors (InstancedMesh -> 1 draw call!)
  const yellowLineMat = new THREE.MeshStandardMaterial({ color: '#e6b85c', roughness: 0.35, metalness: 0.1 });
  const dashMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (let x = -114; x <= 64; x += 5.5) {
    dummy.position.set(x, 0.014, -81.0);
    dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    dummy.scale.set(0.24, 3.0, 1);
    dummy.updateMatrix();
    dashMatrices.push(dummy.matrix.clone());
  }
  // Northbound connector dashes from the 5 Avenues (x = -112, -60, -20, 20, 60)
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

  // Raised Coastal Median Planters between z = -66 and Highway (-73) leaving all 5 avenues clear!
  for (const [mx, mw] of [
    [-86, 36],
    [-40, 26],
    [0, 26],
    [40, 26],
  ]) {
    addBox(mw, 0.22, 5.2, mx, 0.11, -70.0, sidewalkMat, false, 'median');
  }

  // ===========================================================================
  // 2) VICE MARINA — YACHT CLUB, 3 PIERS, 4 BOBBING YACHTS & SMUGGLER STASH
  // ===========================================================================
  // Marina Yacht Club Building on the Promenade (-30, -93.8)
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

  // 3 Walkable Wooden Marina Piers extending into the North Bay (z = -98..-124)
  const pierXs = [-36, -8, 20];
  const pilingPositions: [number, number][] = [];
  for (const px of pierXs) {
    // Walkable pier deck at y = 0.22
    addBox(3.4, 0.36, 26.0, px, 0.04, -111.0, dockPlankMat, true, 'marina-pier');
    // Subtle cyan pier-edge neon guide strip
    addVisual(new THREE.BoxGeometry(0.08, 0.08, 25.4), cyanNeon, px - 1.68, 0.24, -111.0);
    addVisual(new THREE.BoxGeometry(0.08, 0.08, 25.4), cyanNeon, px + 1.68, 0.24, -111.0);

    // Timber pilings along both sides of each pier
    for (let pz = -101; pz >= -123; pz -= 5.5) {
      pilingPositions.push([px - 1.75, pz]);
      pilingPositions.push([px + 1.75, pz]);
    }
  }

  // Instanced Wooden Pier Pilings (1 draw call for all 30 pilings!)
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

  // 4 Sculpted Bobbing Luxury Yachts & Sailboats moored along the Marina Piers!
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

  // Smuggler Cash Briefcase Loot at the tip of the Center Marina Pier (-8, -122.2) -> +$2,000!
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
  // 3) CAPE VICE PENINSULA & 26m RED/WHITE STRIPED LIGHTHOUSE (x = 46..98, z = -92..-128)
  // ===========================================================================
  // Peninsula Landmass & Concrete Promenade Deck extending northeast into the bay
  addBox(46, 1.4, 28, 72, -0.5, -110, sandPeninsulaMat, false, 'cape-ground');
  // Paved Lighthouse Courtyard & Viewing Deck at y = 0.22
  addBox(24, 0.22, 20, 74, 0.21, -112, sidewalkMat, false, 'lighthouse-plaza');

  // Stylized Coastal Limestone Boulders framing the rocky Cape Vice shoreline
  const rockGeo = new THREE.DodecahedronGeometry(2.2, 0);
  const boulderSpots: [number, number, number, number][] = [
    [51, -104, 1.1, 0.4],
    [53, -118, 1.4, 1.2],
    [62, -124, 1.5, 2.1],
    [76, -125, 1.8, 0.8],
    [90, -121, 1.6, 1.7],
    [95, -108, 1.4, 2.6],
    [92, -98, 1.2, 0.3],
  ];
  for (const [rx, rz, sc, ry] of boulderSpots) {
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(rx, 0.15, rz);
    rock.scale.set(sc * 1.2, sc * 0.72, sc);
    rock.rotation.set(ry * 0.3, ry, 0.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }

  // --- THE 26m CAPE VICE LIGHTHOUSE TOWER (center x = 76, z = -114) ---
  const lhX = 76;
  const lhZ = -114;
  // Octagonal stone base pedestal
  addBox(6.4, 2.4, 6.4, lhX, 1.4, lhZ, concreteMat, true, 'lighthouse-base');
  // Tall tapered red/white striped cylindrical tower (height 21m, radius 2.55 -> 1.55)
  const lhTex = createLighthouseStripeTexture();
  const lhMat = new THREE.MeshStandardMaterial({ map: lhTex, roughness: 0.56, metalness: 0.08 });
  const lhTower = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.55, 21.0, 20), lhMat);
  lhTower.position.set(lhX, 13.0, lhZ);
  lhTower.castShadow = true;
  lhTower.receiveShadow = true;
  scene.add(lhTower);
  worldMeshes.push(lhTower);

  // Black Wrought-Iron Gallery Deck & Railing at y = 23.6
  addVisual(new THREE.CylinderGeometry(2.45, 2.0, 0.55, 18), steelDarkMat, lhX, 23.6, lhZ, true);
  addVisual(new THREE.TorusGeometry(2.38, 0.07, 6, 20), steelDarkMat, lhX, 24.45, lhZ);

  // Glass Lantern Room, Glowing Fresnel Lens Core & Copper Cupola Roof
  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#ffeec2',
    emissive: '#ffcf70',
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.72,
    roughness: 0.1,
  });
  addVisual(new THREE.CylinderGeometry(1.42, 1.42, 2.4, 14), lanternGlassMat, lhX, 25.0, lhZ);
  addVisual(new THREE.ConeGeometry(1.72, 1.9, 14), roofTerracottaMat, lhX, 27.1, lhZ, true);
  addVisual(new THREE.CylinderGeometry(0.05, 0.08, 1.5, 6), goldMat, lhX, 28.6, lhZ);

  // Rotating Dual Volumetric Lighthouse Light Beams (sweeping over the bay & city! 0 extra PointLights!)
  const beamPivot = new THREE.Group();
  beamPivot.position.set(lhX, 25.1, lhZ);
  const beamGeo = new THREE.ConeGeometry(7.5, 78, 16, 1, true);
  beamGeo.translate(0, -39, 0); // apex at origin
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fff1b8',
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamA = new THREE.Mesh(beamGeo, beamMat);
  beamA.rotation.z = Math.PI / 2 - 0.14; // slight downward tilt toward ocean & city
  const beamB = new THREE.Mesh(beamGeo, beamMat);
  beamB.rotation.z = -Math.PI / 2 + 0.14;
  beamPivot.add(beamA, beamB);
  scene.add(beamPivot);

  // Keeper's Cottage beside the Lighthouse (x = 66, z = -112)
  addBox(6.8, 3.6, 5.4, 66, 2.1, -112, clubWallMat, true, 'keepers-cottage');
  addVisual(new THREE.ConeGeometry(5.2, 2.1, 4), roofTerracottaMat, 66, 4.95, -112, true);
  addVisual(new THREE.BoxGeometry(1.8, 1.2, 0.14), warmWindowMat, 66, 2.3, -109.26);
  addVisual(new THREE.BoxGeometry(1.8, 1.2, 0.14), warmWindowMat, 66, 2.3, -114.74);

  // Cape Vice Scenic Overlook Bonus Spot (x = 76, z = -105.5)
  const scenicRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.32, 24),
    new THREE.MeshBasicMaterial({ color: '#ff9f43', side: THREE.DoubleSide }),
  );
  scenicRing.rotation.x = -Math.PI / 2;
  scenicRing.position.set(76, 0.35, -105.5);
  scene.add(scenicRing);
  let lighthouseBonusClaimed = false;

  // ===========================================================================
  // 4) NORTH POINT STUNT RAMPS (x = 42, z = -83 & x = -84, z = -83)
  // ===========================================================================
  const buildPortRamp = (rx: number, rz: number, yaw: number, neonMat: THREE.Material) => {
    const rampW = 5.4;
    const rampL = 10.5;
    const rampH = 2.6;
    const g = new THREE.Group();
    g.position.set(rx, 0, rz);
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
  buildPortRamp(40, -83, Math.PI / 2, pinkNeon);
  buildPortRamp(-84, -83, -Math.PI / 2, amberNeon);

  // ===========================================================================
  // 5) COASTAL PALMS & NORTH POINT STREETLAMPS (0 Extra PointLights!)
  // ===========================================================================
  const northPalms: [number, number][] = [
    [-108, -93.5],
    [-92, -93.5],
    [-74, -93.5],
    [-54, -93.5],
    [-16, -93.5],
    [4, -93.5],
    [28, -93.5],
    [48, -93.5],
    [60, -104],
    [86, -104],
    [84, -120],
    [60, -118],
    [-40, -70],
    [0, -70],
    [40, -70],
  ];
  northPalms.forEach(([px, pz], idx) => {
    palmPositions.push({ x: px, z: pz, rot: idx * 1.23, scale: 0.94 + (idx % 3) * 0.06 });
  });

  // Visual-only Promenade Streetlamps with warm additive haze cones (0 extra PointLights!)
  const bulbLampMat = new THREE.MeshStandardMaterial({ color: '#ffdf9e', emissive: '#ffaa44', emissiveIntensity: 3.0 });
  const hazeConeMat = new THREE.MeshBasicMaterial({
    color: '#ffb05c',
    transparent: true,
    opacity: 0.058,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const lx of [-98, -62, -20, 12, 46, 68]) {
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
  // 6) HANDLE & ANIMATIONS
  // ===========================================================================
  return {
    stuntRamps,

    isNearMarinaLoot: (pos: THREE.Vector3) =>
      !marinaLootTaken && pos.distanceToSquared(new THREE.Vector3(-8, 0.4, -122.2)) < 9.0,

    takeMarinaLoot: () => {
      marinaLootTaken = true;
      marinaLootGroup.visible = false;
      marinaLootRing.visible = false;
    },

    isNearLighthouseSpot: (pos: THREE.Vector3) =>
      pos.distanceToSquared(new THREE.Vector3(76, 0.5, -105.5)) < 12.0,

    claimLighthouseBonus: () => {
      if (lighthouseBonusClaimed) return false;
      lighthouseBonusClaimed = true;
      return true;
    },

    update: (elapsed: number) => {
      // Majestic rotating Cape Vice Lighthouse beams
      beamPivot.rotation.y = elapsed * 0.52;

      // Gentle ocean swell bobbing for all 4 moored Marina yachts
      for (const y of mooredYachts) {
        y.group.position.y = y.baseY + Math.sin(elapsed * 1.45 + y.phase) * 0.09;
        y.group.rotation.z = Math.sin(elapsed * 1.15 + y.phase) * 0.032;
        y.group.rotation.x = Math.cos(elapsed * 0.9 + y.phase) * 0.018;
      }

      // Pulse interactive rings
      const s = 1 + Math.sin(elapsed * 4.0) * 0.06;
      if (!marinaLootTaken) {
        marinaLootRing.scale.set(s, s, 1);
      }
      scenicRing.scale.set(s, s, 1);
    },
  };
}
