import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type CarModelType =
  | 'cybertruck'
  | 'delorean'
  | 'challenger'
  | 'bounder'
  | 'transam'
  | 'monaco'
  | 'police'
  | 'taxi'
  | 'ambulance'
  | 'firetruck'
  | 'supercar';

export interface BuiltCar {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  wheels: THREE.Object3D[];
  tailMat: THREE.MeshStandardMaterial;
  reverseMat: THREE.MeshStandardMaterial;
  lightbarRed?: THREE.Mesh;
  lightbarBlue?: THREE.Mesh;
  scannerLeds?: THREE.Mesh[];
  waterTurret?: THREE.Group;
  riderMesh?: THREE.Group;
}

let cachedTaxiCheckerTex: THREE.CanvasTexture | null = null;
function getTaxiCheckerTexture(): THREE.CanvasTexture {
  if (cachedTaxiCheckerTex) return cachedTaxiCheckerTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const cell = 16;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#111116' : '#f7f7f2';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  cachedTaxiCheckerTex = new THREE.CanvasTexture(c);
  cachedTaxiCheckerTex.colorSpace = THREE.SRGBColorSpace;
  return cachedTaxiCheckerTex;
}

let cachedTaxiSignTex: THREE.CanvasTexture | null = null;
function getTaxiSignTexture(): THREE.CanvasTexture {
  if (cachedTaxiSignTex) return cachedTaxiSignTex;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffe052';
  ctx.fillRect(0, 0, 192, 64);
  ctx.strokeStyle = '#181410';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 184, 56);
  ctx.fillStyle = '#141114';
  ctx.font = '900 38px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VICE CAB', 96, 34);
  cachedTaxiSignTex = new THREE.CanvasTexture(c);
  cachedTaxiSignTex.colorSpace = THREE.SRGBColorSpace;
  return cachedTaxiSignTex;
}

type WheelStyle = 'alloy' | 'aero' | 'turbine' | 'steel';

let sharedWheelMats: {
  tire: THREE.MeshStandardMaterial;
  rims: Record<WheelStyle, THREE.MeshStandardMaterial>;
} | null = null;

function getSharedWheelMats() {
  if (sharedWheelMats) return sharedWheelMats;
  sharedWheelMats = {
    tire: new THREE.MeshStandardMaterial({ color: '#141219', roughness: 0.88, metalness: 0.05 }),
    rims: {
      alloy: new THREE.MeshStandardMaterial({ color: '#d8e0ea', roughness: 0.16, metalness: 0.9 }),
      turbine: new THREE.MeshStandardMaterial({ color: '#d8e0ea', roughness: 0.16, metalness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: '#b8c0c8', roughness: 0.16, metalness: 0.9 }),
      aero: new THREE.MeshStandardMaterial({ color: '#242730', roughness: 0.42, metalness: 0.55 }),
    },
  };
  return sharedWheelMats;
}

const cachedWheelGeos = new Map<string, { tireGeo: THREE.BufferGeometry; rimGeo: THREE.BufferGeometry }>();

/**
 * Helper: builds a detailed, rotating 3D car wheel with rounded torus tire,
 * deep alloy barrel, 5-spoke rim (or Cybertruck aero cap), brake rotor & hub.
 * Merges static sub-parts into 2 cached geometries (tire + rim) -> 2 meshes instead of 11-12!
 */
function buildCarWheel(radius: number, width: number, style: WheelStyle): THREE.Group {
  const wg = new THREE.Group();
  const mats = getSharedWheelMats();
  const key = `${radius.toFixed(3)}:${width.toFixed(3)}:${style}`;

  let geos = cachedWheelGeos.get(key);
  if (!geos) {
    const tube = width * 0.46;
    const major = Math.max(0.14, radius - tube * 0.72);

    // 1) Tire tread + inner sidewall core merged into 1 geometry
    const tireTorus = new THREE.TorusGeometry(major, tube, 12, 22);
    tireTorus.rotateY(Math.PI / 2);

    const coreCyl = new THREE.CylinderGeometry(major * 0.86, major * 0.86, width * 0.78, 16);
    coreCyl.rotateZ(Math.PI / 2);

    const tireGeo = mergeGeometries([tireTorus, coreCyl], false)!;
    tireTorus.dispose();
    coreCyl.dispose();

    // 2) Rim lips + spokes/aero cover + center hubcap merged into 1 geometry
    const rimParts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      const lip = new THREE.TorusGeometry(major * 0.74, 0.018, 6, 20);
      lip.rotateY(Math.PI / 2);
      lip.translate(sx * (width * 0.4), 0, 0);
      rimParts.push(lip);
    }

    if (style === 'aero') {
      const cap = new THREE.CylinderGeometry(major * 0.72, major * 0.72, width * 0.84, 7);
      cap.rotateZ(Math.PI / 2);
      rimParts.push(cap);
    } else {
      const spokeCount = style === 'turbine' ? 8 : 5;
      const spokeW = style === 'turbine' ? 0.022 : 0.036;
      for (let i = 0; i < spokeCount; i++) {
        const sp = new THREE.BoxGeometry(width * 0.86, major * 1.35, spokeW);
        sp.rotateX((i / spokeCount) * Math.PI);
        rimParts.push(sp);
      }
    }

    const hub = new THREE.CylinderGeometry(0.06, 0.06, width * 0.9, 10);
    hub.rotateZ(Math.PI / 2);
    rimParts.push(hub);

    const rimGeo = mergeGeometries(rimParts, false)!;
    for (const g of rimParts) g.dispose();

    geos = { tireGeo, rimGeo };
    cachedWheelGeos.set(key, geos);
  }

  const tire = new THREE.Mesh(geos.tireGeo, mats.tire);
  tire.castShadow = true;
  wg.add(tire);

  const rim = new THREE.Mesh(geos.rimGeo, mats.rims[style]);
  wg.add(rim);

  return wg;
}

/**
 * Helper: builds an extruded side-profile body centered on X (width `w`),
 * where 2D shape coords are (z, y) in car local space (+Z = front, +Y = up).
 */
function buildProfileExtrusion(
  points: [number, number][],
  width: number,
  mat: THREE.Material,
  bevel = 0.03,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  // ExtrudeGeometry extrudes along +Z from XY plane.
  // Rotate -90 deg around Y so shape X becomes local +Z (front) and extrusion depth becomes local X (width).
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createCarModel(
  model: CarModelType,
  bodyColor: string,
  neonColor: string,
): BuiltCar {
  const group = new THREE.Group();

  const isStainless = model === 'cybertruck' || model === 'delorean';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: isStainless ? 0.24 : model === 'bounder' ? 0.42 : 0.18,
    metalness: isStainless ? 0.88 : model === 'bounder' ? 0.15 : 0.65,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({ color: '#181620', roughness: 0.52, metalness: 0.35 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#dce4ee', roughness: 0.12, metalness: 0.94 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#111828',
    roughness: 0.08,
    metalness: 0.88,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: '#fff6dc',
    emissive: '#ffe4a8',
    emissiveIntensity: 3.1,
  });
  const cyberLedMat = new THREE.MeshStandardMaterial({
    color: '#eef8ff',
    emissive: '#d8f4ff',
    emissiveIntensity: 3.4,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: '#ff244e',
    emissive: '#ff1a44',
    emissiveIntensity: 2.4,
  });
  const reverseMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#e8f6ff',
    emissiveIntensity: 0.05,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 2.0,
  });

  const wheels: THREE.Object3D[] = [];
  let lightbarRed: THREE.Mesh | undefined;
  let lightbarBlue: THREE.Mesh | undefined;
  let scannerLeds: THREE.Mesh[] | undefined;
  let waterTurret: THREE.Group | undefined;

  const addWheels = (
    coords: [number, number][],
    radius: number,
    width: number,
    style: 'alloy' | 'aero' | 'turbine' | 'steel',
  ) => {
    for (const [wx, wz] of coords) {
      const w = buildCarWheel(radius, width, style);
      w.position.set(wx, radius, wz);
      group.add(w);
      wheels.push(w);
    }
  };

  // ===========================================================================
  // 1) TESLA CYBERTRUCK — Iconic Faceted Stainless Steel Wedge Pickup
  // ===========================================================================
  if (model === 'cybertruck') {
    // Signature single-triangle stainless steel silhouette!
    const hull = buildProfileExtrusion(
      [
        [-2.42, 0.42], // rear bumper bottom
        [2.42, 0.44],  // front bumper bottom
        [2.52, 0.94],  // blunt front nose
        [1.48, 1.18],  // short steeply raked frunk hood
        [0.18, 1.82],  // sharp triangular roof apex!
        [-2.38, 1.24], // straight sloping tonneau vault all the way to tailgate
        [-2.48, 0.92], // vertical tailgate
      ],
      2.06,
      bodyMat,
      0.015,
    );
    group.add(hull);

    // Dark lower rocker cladding & rugged bumpers
    const lowerClad = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.24, 4.92), darkTrimMat);
    lowerClad.position.set(0, 0.42, 0.02);
    group.add(lowerClad);

    // Trapezoidal black fender flares over all 4 wheels
    for (const [fx, fz] of [
      [-1.06, 1.52],
      [1.06, 1.52],
      [-1.06, -1.48],
      [1.06, -1.48],
    ]) {
      const flare = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 1.08), darkTrimMat);
      flare.position.set(fx, 0.68, fz);
      group.add(flare);
    }

    // Sloped dark armored glass windshield + glass roof panel
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.06, 1.48), glassMat);
    windshield.position.set(0, 1.5, 0.84);
    windshield.rotation.x = 0.45;
    group.add(windshield);

    // Side triangular cabin windows
    for (const sx of [-1.05, 1.05]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 1.72), glassMat);
      win.position.set(sx, 1.38, 0.08);
      win.rotation.x = -0.1;
      group.add(win);
    }

    // Dark ribbed tonneau vault cover on rear slope
    const tonneau = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.05, 1.85), darkTrimMat);
    tonneau.position.set(0, 1.48, -1.24);
    tonneau.rotation.x = -0.22;
    group.add(tonneau);

    // Iconic razor-thin full-width front white LED lightbar
    const frontLed = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.065, 0.07), cyberLedMat);
    frontLed.position.set(0, 0.96, 2.53);
    group.add(frontLed);

    // Iconic full-width red rear LED taillight bar
    const rearLed = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.075, 0.07), tailMat);
    rearLed.position.set(0, 1.18, -2.44);
    group.add(rearLed);

    for (const sx of [-0.62, 0.62]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.07), reverseMat);
      rev.position.set(sx, 0.72, -2.48);
      group.add(rev);
    }

    // Triangular wing mirrors
    for (const sx of [-1.14, 1.14]) {
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.14), darkTrimMat);
      mir.position.set(sx, 1.22, 1.02);
      group.add(mir);
    }

    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.035, 3.6), glowMat);
    underglow.position.set(0, 0.28, 0);
    group.add(underglow);

    addWheels(
      [
        [-1.08, 1.52],
        [1.08, 1.52],
        [-1.08, -1.48],
        [1.08, -1.48],
      ],
      0.42,
      0.32,
      'aero',
    );
  }

  // ===========================================================================
  // 2) DELOREAN DMC-12 — Brushed Stainless 80s Gullwing Icon + Rear Louvers
  // ===========================================================================
  else if (model === 'delorean') {
    // Low Italian Giugiaro stainless steel wedge profile
    const hull = buildProfileExtrusion(
      [
        [-2.14, 0.3],
        [2.16, 0.28],
        [2.24, 0.56],
        [2.14, 0.72], // sharp low front nose
        [1.02, 0.86], // long flat wedge hood
        [0.24, 1.24], // steeply raked windshield
        [-0.78, 1.24], // flat gullwing roof
        [-2.06, 0.84], // fastback louver deck
        [-2.18, 0.56],
      ],
      1.92,
      bodyMat,
      0.02,
    );
    group.add(hull);

    // Iconic matte-black urethane front & rear bumpers + side rub strips
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.22, 0.22), darkTrimMat);
    frontBumper.position.set(0, 0.44, 2.2);
    group.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.24, 0.22), darkTrimMat);
    rearBumper.position.set(0, 0.46, -2.14);
    group.add(rearBumper);

    for (const sx of [-0.99, 0.99]) {
      const rubStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 3.6), darkTrimMat);
      rubStrip.position.set(sx, 0.58, 0.0);
      group.add(rubStrip);
      // Side windows with gullwing split bar
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 1.32), glassMat);
      win.position.set(sx, 1.04, -0.2);
      group.add(win);
      // Wing mirrors
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), darkTrimMat);
      mir.position.set(sx * 1.06, 0.94, 0.65);
      group.add(mir);
    }

    // Raked front windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 0.96), glassMat);
    windshield.position.set(0, 1.06, 0.64);
    windshield.rotation.x = 0.44;
    group.add(windshield);

    // Signature Black Rear Window Louvers (6 horizontal slats)
    for (let l = 0; l < 6; l++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.04, 0.14), darkTrimMat);
      slat.position.set(0, 1.19 - l * 0.06, -0.92 - l * 0.18);
      slat.rotation.x = 0.12;
      group.add(slat);
    }

    // Subtle Back-to-the-Future inspired rear twin exhaust thruster vents + cyan flux accent!
    const fluxMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 2.2,
    });
    for (const sx of [-0.46, 0.46]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.44), darkTrimMat);
      vent.position.set(sx, 1.06, -1.72);
      vent.rotation.x = -0.28;
      group.add(vent);
      const ventGlow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), fluxMat);
      ventGlow.position.set(sx, 1.04, -1.94);
      group.add(ventGlow);
    }

    // Quad rectangular 80s headlights in recessed black grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.2, 0.08), darkTrimMat);
    grille.position.set(0, 0.62, 2.22);
    group.add(grille);
    for (const hx of [-0.72, -0.46, 0.46, 0.72]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), headMat);
      hl.position.set(hx, 0.62, 2.25);
      group.add(hl);
    }

    // Grid-style iconic DeLorean taillights + reverse lights
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 0.07), tailMat);
    tailBar.position.set(0, 0.68, -2.18);
    group.add(tailBar);
    for (const sx of [-0.52, 0.52]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.08), reverseMat);
      rev.position.set(sx, 0.68, -2.19);
      group.add(rev);
    }

    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.035, 3.2), glowMat);
    underglow.position.set(0, 0.22, 0);
    group.add(underglow);

    addWheels(
      [
        [-0.98, 1.32],
        [0.98, 1.32],
        [-0.98, -1.32],
        [0.98, -1.32],
      ],
      0.34,
      0.26,
      'turbine',
    );
  }

  // ===========================================================================
  // 3) DODGE CHALLENGER — Wide American Muscle Car with Shaker Hood & Quad Rounds
  // ===========================================================================
  else if (model === 'challenger') {
    // Classic long-hood, short-deck muscular profile
    const hull = buildProfileExtrusion(
      [
        [-2.32, 0.3],
        [2.32, 0.3],
        [2.38, 0.84], // bold aggressive vertical nose
        [0.72, 0.94], // long muscular hood
        [0.12, 1.38], // raked windshield
        [-1.08, 1.38], // coupe roofline
        [-1.78, 0.98], // fastback C-pillar
        [-2.36, 0.92], // high rear deck
      ],
      2.06,
      bodyMat,
      0.03,
    );
    group.add(hull);

    // Dual Matte-Black Racing Stripes down the center!
    for (const sx of [-0.24, 0.24]) {
      const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 1.62), darkTrimMat);
      hoodStripe.position.set(sx, 0.94, 1.54);
      hoodStripe.rotation.x = 0.06;
      group.add(hoodStripe);

      const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 1.18), darkTrimMat);
      roofStripe.position.set(sx, 1.42, -0.48);
      group.add(roofStripe);

      const trunkStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.62), darkTrimMat);
      trunkStripe.position.set(sx, 0.98, -2.04);
      group.add(trunkStripe);
    }

    // Raised Shaker Hood Scoop / Air Intake
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.72), darkTrimMat);
    scoop.position.set(0, 1.0, 1.36);
    group.add(scoop);
    const scoopInlet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.04), chromeMat);
    scoopInlet.position.set(0, 1.01, 1.72);
    group.add(scoopInlet);

    // Deep recessed black front grille + Chrome Surround + 4 Iconic Round Headlights!
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 0.1), darkTrimMat);
    grille.position.set(0, 0.64, 2.38);
    group.add(grille);

    const hlGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14);
    hlGeo.rotateX(Math.PI / 2);
    for (const hx of [-0.74, -0.48, 0.48, 0.74]) {
      const hl = new THREE.Mesh(hlGeo, headMat);
      hl.position.set(hx, 0.64, 2.42);
      group.add(hl);
    }

    // Front Chin Splitter & Rear Matte-Black Trunk Lip Spoiler
    const chin = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.08, 0.24), darkTrimMat);
    chin.position.set(0, 0.29, 2.36);
    group.add(chin);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.1, 0.24), darkTrimMat);
    spoiler.position.set(0, 1.04, -2.28);
    spoiler.rotation.x = 0.22;
    group.add(spoiler);

    // Windshield, rear glass & side windows
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.05, 0.78), glassMat);
    windshield.position.set(0, 1.18, 0.42);
    windshield.rotation.x = 0.62;
    group.add(windshield);

    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 0.84), glassMat);
    rearWin.position.set(0, 1.2, -1.42);
    rearWin.rotation.x = -0.52;
    group.add(rearWin);

    for (const sx of [-1.05, 1.05]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 1.38), glassMat);
      win.position.set(sx, 1.16, -0.45);
      group.add(win);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), bodyMat);
      mir.position.set(sx * 1.06, 0.98, 0.42);
      group.add(mir);
    }

    // Iconic Full-Width Challenger Rear Taillight Panel + Dual Chrome Exhausts
    const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.26, 0.08), darkTrimMat);
    rearPanel.position.set(0, 0.72, -2.35);
    group.add(rearPanel);

    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.14, 0.06), tailMat);
    tailBar.position.set(0, 0.72, -2.38);
    group.add(tailBar);

    for (const sx of [-0.55, 0.55]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.07), reverseMat);
      rev.position.set(sx, 0.54, -2.37);
      group.add(rev);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx * 1.15, 0.34, -2.38);
      group.add(pipe);
    }

    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.035, 3.4), glowMat);
    underglow.position.set(0, 0.22, 0);
    group.add(underglow);

    addWheels(
      [
        [-1.06, 1.44],
        [1.06, 1.44],
        [-1.06, -1.42],
        [1.06, -1.42],
      ],
      0.37,
      0.3,
      'alloy',
    );
  }

  // ===========================================================================
  // 4) 1986 FLEETWOOD BOUNDER — Iconic Breaking Bad Retro Motorhome RV!
  // ===========================================================================
  else if (model === 'bounder') {
    // Tall, boxy classic 1986 Class-A Motorhome shell
    const hull = buildProfileExtrusion(
      [
        [-3.05, 0.42], // rear overhang
        [2.95, 0.42],  // front bumper line
        [3.02, 1.45],  // flat vertical bus nose
        [2.82, 2.62],  // slightly sloped upper windshield header
        [-2.98, 2.62], // long flat RV roof
        [-3.08, 2.48], // rear roof corner
      ],
      2.24,
      bodyMat,
      0.04,
    );
    group.add(hull);

    // Signature 1986 Fleetwood Bounder 3-Tone Retro Side Stripes (Dark Brown, Burnt Orange, Ochre Yellow)
    const stripeSpecs = [
      { color: '#4d2b1a', y: 1.18, h: 0.22 },
      { color: '#cc5c22', y: 1.4, h: 0.16 },
      { color: '#e6a236', y: 1.54, h: 0.1 },
    ];
    for (const st of stripeSpecs) {
      const mat = new THREE.MeshStandardMaterial({ color: st.color, roughness: 0.5 });
      for (const sx of [-1.17, 1.17]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, st.h, 5.95), mat);
        bar.position.set(sx, st.y, -0.02);
        group.add(bar);
      }
      // Wrap stripe across front nose & rear wall
      const frontWrap = new THREE.Mesh(new THREE.BoxGeometry(2.28, st.h, 0.04), mat);
      frontWrap.position.set(0, st.y, 3.04);
      group.add(frontWrap);
      const rearWrap = new THREE.Mesh(new THREE.BoxGeometry(2.28, st.h, 0.04), mat);
      rearWrap.position.set(0, st.y, -3.09);
      group.add(rearWrap);
    }

    // Huge Panoramic Split Bus Windshield + Side RV Cabin Windows + Entry Door
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.88, 0.08), glassMat);
    windshield.position.set(0, 2.02, 2.94);
    windshield.rotation.x = -0.14;
    group.add(windshield);
    const centerPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.1), darkTrimMat);
    centerPillar.position.set(0, 2.02, 2.96);
    centerPillar.rotation.x = -0.14;
    group.add(centerPillar);

    // Side windows along both flanks
    for (const sx of [-1.16, 1.16]) {
      for (const wz of [2.1, 0.75, -0.85, -2.15]) {
        const wLen = wz === 2.1 ? 0.95 : 1.05;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, wLen), glassMat);
        win.position.set(sx, 2.0, wz);
        group.add(win);
      }
      // Big Chrome Truck Mirrors on brackets
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), chromeMat);
      arm.position.set(sx * 1.08, 2.05, 2.72);
      group.add(arm);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.14), chromeMat);
      mir.position.set(sx * 1.18, 1.98, 2.74);
      group.add(mir);
    }

    // Rolled-up Side Awning Tube on passenger side (+X)
    const awning = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.8, 10), chromeMat);
    awning.rotation.x = Math.PI / 2;
    awning.position.set(1.22, 2.52, -0.2);
    group.add(awning);

    // Rooftop Air Conditioner Unit (white fiberglass housing) + Roof Vents
    const acUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.32, 1.15),
      new THREE.MeshStandardMaterial({ color: '#ece8df', roughness: 0.5 }),
    );
    acUnit.position.set(0, 2.82, 0.25);
    acUnit.castShadow = true;
    group.add(acUnit);

    const roofVent = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.55),
      new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.6 }),
    );
    roofVent.position.set(0, 2.74, -1.65);
    group.add(roofVent);

    // Chrome Rear Roof Ladder on the back (-Z)
    for (const lx of [0.45, 0.85]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.15, 6), chromeMat);
      rail.position.set(lx, 1.65, -3.14);
      group.add(rail);
    }
    for (let r = 0; r < 6; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6), chromeMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0.65, 0.78 + r * 0.34, -3.14);
      group.add(rung);
    }

    // Front Chrome Bumper, Black Grille & Quad 80s Square Headlights + Roof Clearance Lights
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.24, 0.22), chromeMat);
    frontBumper.position.set(0, 0.48, 3.08);
    group.add(frontBumper);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.22, 0.22), chromeMat);
    rearBumper.position.set(0, 0.48, -3.12);
    group.add(rearBumper);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.42, 0.08), darkTrimMat);
    grille.position.set(0, 0.88, 3.04);
    group.add(grille);

    for (const hx of [-0.88, 0.88]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.06), headMat);
      hl.position.set(hx, 0.88, 3.06);
      group.add(hl);
    }

    // Amber roof clearance markers
    const amberMat = new THREE.MeshStandardMaterial({ color: '#ffaa22', emissive: '#ff8811', emissiveIntensity: 2.0 });
    for (const ax of [-0.8, -0.3, 0, 0.3, 0.8]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), amberMat);
      m.position.set(ax, 2.58, 2.86);
      group.add(m);
    }

    // Rear Taillights & Reverse Lights
    for (const tx of [-0.88, 0.88]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.06), tailMat);
      tl.position.set(tx, 0.84, -3.1);
      group.add(tl);
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.06), reverseMat);
      rev.position.set(tx * 0.68, 0.84, -3.1);
      group.add(rev);
    }

    addWheels(
      [
        [-1.12, 1.82],
        [1.12, 1.82],
        [-1.12, -1.65],
        [1.12, -1.65],
      ],
      0.42,
      0.34,
      'steel',
    );
  }

  // ===========================================================================
  // 5) 1982 PONTIAC FIREBIRD TRANS AM — Gloss Black 80s Aero Wedge + K.I.T.T. Scanner!
  // ===========================================================================
  else if (model === 'transam') {
    bodyMat.roughness = 0.12;
    bodyMat.metalness = 0.78;

    // Sleek, ultra-low 3rd-gen Firebird aero wedge with long nose & glass fastback hatch
    const hull = buildProfileExtrusion(
      [
        [-2.32, 0.28],
        [2.36, 0.26],
        [2.44, 0.56],  // razor-sharp pointed nose cone
        [1.1, 0.84],   // long sloping hood
        [0.18, 1.24],  // steeply raked windshield
        [-0.78, 1.24], // T-top roof panel
        [-2.2, 0.88],  // sweeping fastback glass hatch
        [-2.34, 0.62],
      ],
      1.96,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Asymmetric 1982 Trans Am Turbo Power-Bulge Hood Scoop
    const bulge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 1.05), bodyMat);
    bulge.position.set(-0.22, 0.84, 1.48);
    bulge.rotation.x = 0.16;
    group.add(bulge);

    // T-Top Tinted Glass Roof Panels + Steep Windshield + Huge Wraparound Rear Hatch Glass
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 1.04), glassMat);
    windshield.position.set(0, 1.06, 0.64);
    windshield.rotation.x = 0.42;
    group.add(windshield);

    const rearHatch = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.05, 1.38), glassMat);
    rearHatch.position.set(0, 1.08, -1.42);
    rearHatch.rotation.x = -0.26;
    group.add(rearHatch);

    for (const sx of [-0.46, 0.46]) {
      const tTop = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 0.84), glassMat);
      tTop.position.set(sx, 1.26, -0.3);
      group.add(tTop);
    }
    for (const sx of [-1.0, 1.0]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 1.28), glassMat);
      win.position.set(sx, 1.04, -0.25);
      group.add(win);
      // Iconic Trans Am front fender side air extractor vents
      const fenderVent = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.34), darkTrimMat);
      fenderVent.position.set(sx * 1.005, 0.56, 0.92);
      group.add(fenderVent);
      // Aero mirrors
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), bodyMat);
      mir.position.set(sx * 1.05, 0.94, 0.56);
      group.add(mir);
    }

    // Wraparound Black Aero Rear Spoiler
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.09, 0.28), darkTrimMat);
    spoiler.position.set(0, 0.96, -2.24);
    spoiler.rotation.x = 0.16;
    group.add(spoiler);

    // ICONIC K.I.T.T. ANIMATED RED FRONT SCANNER BAR (6 LED segments!)
    const scannerHousing = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.11, 0.08), darkTrimMat);
    scannerHousing.position.set(0, 0.58, 2.43);
    group.add(scannerHousing);

    scannerLeds = [];
    for (let i = 0; i < 6; i++) {
      const ledMat = new THREE.MeshStandardMaterial({
        color: '#ff1a2a',
        emissive: '#ff0e22',
        emissiveIntensity: i === 2 ? 4.2 : 0.25,
      });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.065, 0.05), ledMat);
      led.position.set(-0.35 + i * 0.14, 0.58, 2.46);
      group.add(led);
      scannerLeds.push(led);
    }

    // Recessed lower driving fog lamps beside scanner
    for (const fx of [-0.72, 0.72]) {
      const fog = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.06), headMat);
      fog.position.set(fx, 0.44, 2.42);
      group.add(fog);
    }

    // Blackout Full-Width 1982 Trans Am Taillight Panel
    const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.24, 0.07), darkTrimMat);
    rearPanel.position.set(0, 0.72, -2.35);
    group.add(rearPanel);
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.11, 0.05), tailMat);
    tailBar.position.set(0, 0.72, -2.38);
    group.add(tailBar);
    for (const sx of [-0.54, 0.54]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.06), reverseMat);
      rev.position.set(sx, 0.58, -2.37);
      group.add(rev);
    }

    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.03, 3.4), glowMat);
    underglow.position.set(0, 0.2, 0);
    group.add(underglow);

    addWheels(
      [
        [-1.0, 1.44],
        [1.0, 1.44],
        [-1.0, -1.38],
        [1.0, -1.38],
      ],
      0.35,
      0.28,
      'aero',
    );
  }

  // ===========================================================================
  // 6) 1974 DODGE MONACO — Full-Size 70s Land Yacht ("Bluesmobile"!)
  // ===========================================================================
  else if (model === 'monaco') {
    const creamWhiteMat = new THREE.MeshStandardMaterial({ color: '#ece8dc', roughness: 0.45, metalness: 0.2 });

    // Massive, long 1974 full-size American sedan slab profile (5.2m!)
    const hull = buildProfileExtrusion(
      [
        [-2.58, 0.3],
        [2.56, 0.3],
        [2.62, 0.82],  // bold upright 70s front fender line
        [0.92, 0.92],  // huge flat hood
        [0.42, 1.44],  // upright 70s windshield
        [-1.02, 1.44], // long formal sedan roof
        [-1.48, 0.92], // steep C-pillar
        [-2.6, 0.84],  // enormous classic 70s trunk deck
      ],
      2.06,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Classic Black & White Decommissioned Police Sedan Doors & Roof (Bluesmobile look!)
    const doors = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.56, 2.02), creamWhiteMat);
    doors.position.set(0, 0.62, -0.18);
    group.add(doors);

    const roofWhite = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.06, 1.42), creamWhiteMat);
    roofWhite.position.set(0, 1.46, -0.3);
    group.add(roofWhite);

    // Windshield, rear glass & wide 4-door side windows
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.05, 0.72), glassMat);
    windshield.position.set(0, 1.18, 0.67);
    windshield.rotation.x = 0.8;
    group.add(windshield);
    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.05, 0.68), glassMat);
    rearWin.position.set(0, 1.18, -1.25);
    rearWin.rotation.x = -0.8;
    group.add(rearWin);
    for (const sx of [-1.05, 1.05]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 1.62), glassMat);
      win.position.set(sx, 1.2, -0.3);
      group.add(win);
      // Chrome body side molding strip
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 5.05), chromeMat);
      trim.position.set(sx * 1.01, 0.66, 0);
      group.add(trim);
    }

    // Iconic A-Pillar Police Spotlight (driver's side)
    const spotArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6), chromeMat);
    spotArm.rotation.z = Math.PI / 2;
    spotArm.position.set(-1.08, 1.18, 0.54);
    group.add(spotArm);
    const spotLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.14, 10), chromeMat);
    spotLamp.rotation.x = Math.PI / 2;
    spotLamp.position.set(-1.18, 1.18, 0.56);
    group.add(spotLamp);

    // Iconic Bluesmobile Roof-Mounted Giant PA Megaphone Speaker!
    const megaMount = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), darkTrimMat);
    megaMount.position.set(0, 1.54, -0.25);
    group.add(megaMount);
    const megaHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.1, 0.72, 14), creamWhiteMat);
    megaHorn.rotation.x = Math.PI / 2;
    megaHorn.position.set(0, 1.72, -0.1);
    group.add(megaHorn);

    // Massive 1974 Chrome Bumpers, Chrome Split Grille & Quad Round 70s Headlights
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.2, 0.24), chromeMat);
    fBump.position.set(0, 0.4, 2.66);
    group.add(fBump);
    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.2, 0.24), chromeMat);
    rBump.position.set(0, 0.4, -2.64);
    group.add(rBump);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.28, 0.08), chromeMat);
    grille.position.set(0, 0.66, 2.62);
    group.add(grille);

    const hlGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12);
    hlGeo.rotateX(Math.PI / 2);
    for (const hx of [-0.78, -0.52, 0.52, 0.78]) {
      const hl = new THREE.Mesh(hlGeo, headMat);
      hl.position.set(hx, 0.66, 2.66);
      group.add(hl);
    }

    // Wide 70s Rear Taillight Clusters + Dual Exhausts
    for (const tx of [-0.72, 0.72]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.15, 0.06), tailMat);
      tl.position.set(tx, 0.68, -2.62);
      group.add(tl);
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.07), reverseMat);
      rev.position.set(tx * 0.48, 0.68, -2.62);
      group.add(rev);
    }

    addWheels(
      [
        [-1.06, 1.62],
        [1.06, 1.62],
        [-1.06, -1.52],
        [1.06, -1.52],
      ],
      0.36,
      0.27,
      'steel',
    );
  }

  // ===========================================================================
  // 7) VICE PD CRUISER / INTERCEPTOR — 80s American Police Sedan + Bullbar
  // ===========================================================================
  else if (model === 'police') {
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.28, metalness: 0.35 });

    const hull = buildProfileExtrusion(
      [
        [-2.24, 0.3],
        [2.24, 0.3],
        [2.3, 0.78],
        [0.85, 0.88],
        [0.32, 1.38],
        [-0.96, 1.38],
        [-1.46, 0.9],
        [-2.28, 0.84],
      ],
      1.98,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Classic Black & White Police Doors & Roof Panel
    const doors = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.54, 1.88), whiteMat);
    doors.position.set(0, 0.62, -0.12);
    group.add(doors);

    const roofWhite = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.06, 1.24), whiteMat);
    roofWhite.position.set(0, 1.4, -0.32);
    group.add(roofWhite);

    // Heavy-Duty Front Push Bumper (Bullbar)
    for (const bx of [-0.46, 0.46]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.12), darkTrimMat);
      upright.position.set(bx, 0.56, 2.38);
      group.add(upright);
    }
    const bullCross = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 0.1), darkTrimMat);
    bullCross.position.set(0, 0.64, 2.42);
    group.add(bullCross);

    // Windshield, rear window & side glass
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.05, 0.72), glassMat);
    windshield.position.set(0, 1.15, 0.58);
    windshield.rotation.x = 0.74;
    group.add(windshield);
    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 0.68), glassMat);
    rearWin.position.set(0, 1.15, -1.22);
    rearWin.rotation.x = -0.74;
    group.add(rearWin);
    for (const sx of [-1.01, 1.01]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 1.48), glassMat);
      win.position.set(sx, 1.16, -0.32);
      group.add(win);
    }

    // Detailed Red / White / Blue Rooftop Police Lightbar
    const barMount = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.06, 0.26), darkTrimMat);
    barMount.position.set(0, 1.46, -0.22);
    group.add(barMount);
    const sirenSpeaker = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.15, 0.24), chromeMat);
    sirenSpeaker.position.set(0, 1.54, -0.22);
    group.add(sirenSpeaker);

    lightbarRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.24),
      new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.0 }),
    );
    lightbarRed.position.set(-0.4, 1.54, -0.22);
    group.add(lightbarRed);

    lightbarBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.24),
      new THREE.MeshStandardMaterial({ color: '#22aaff', emissive: '#22aaff', emissiveIntensity: 3.0 }),
    );
    lightbarBlue.position.set(0.4, 1.54, -0.22);
    group.add(lightbarBlue);

    // Chrome bumpers, headlights & taillights
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.16, 0.16), chromeMat);
    fBump.position.set(0, 0.38, 2.3);
    group.add(fBump);
    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.16, 0.16), chromeMat);
    rBump.position.set(0, 0.38, -2.28);
    group.add(rBump);

    for (const hx of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.15, 0.06), headMat);
      hl.position.set(hx, 0.64, 2.32);
      group.add(hl);
    }
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.15, 0.06), tailMat);
    tailBar.position.set(0, 0.68, -2.3);
    group.add(tailBar);
    for (const sx of [-0.52, 0.52]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.07), reverseMat);
      rev.position.set(sx, 0.54, -2.3);
      group.add(rev);
    }

    addWheels(
      [
        [-1.02, 1.38],
        [1.02, 1.38],
        [-1.02, -1.36],
        [1.02, -1.36],
      ],
      0.35,
      0.26,
      'steel',
    );
  }

  // ===========================================================================
  // 8) 80s CHECKER TAXI („VICE CAB“) — Iconic Yellow Cab + Checker Stripe + Roof Sign
  // ===========================================================================
  else if (model === 'taxi') {
    const hull = buildProfileExtrusion(
      [
        [-2.34, 0.3],
        [2.32, 0.3],
        [2.38, 0.8],
        [0.88, 0.9],
        [0.36, 1.44],
        [-0.98, 1.44],
        [-1.46, 0.92],
        [-2.38, 0.84],
      ],
      2.02,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Classic Black & White Checkered Taxi Side Stripes
    const checkerMat = new THREE.MeshStandardMaterial({
      map: getTaxiCheckerTexture(),
      roughness: 0.35,
      metalness: 0.15,
    });
    for (const sx of [-1.045, 1.045]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 4.42), checkerMat);
      stripe.position.set(sx, 0.64, -0.02);
      group.add(stripe);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 1.54), glassMat);
      win.position.set(sx * 0.985, 1.19, -0.32);
      group.add(win);
    }

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.72), glassMat);
    windshield.position.set(0, 1.18, 0.62);
    windshield.rotation.x = 0.76;
    group.add(windshield);
    const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 0.68), glassMat);
    rearWin.position.set(0, 1.18, -1.22);
    rearWin.rotation.x = -0.76;
    group.add(rearWin);

    // Glowing Rooftop "VICE CAB" Taxi Light Sign
    const taxiSignTex = getTaxiSignTexture();
    const taxiSignMat = new THREE.MeshStandardMaterial({
      map: taxiSignTex,
      emissive: '#ffcf38',
      emissiveMap: taxiSignTex,
      emissiveIntensity: 1.9,
      roughness: 0.25,
    });
    const signBase = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.26), darkTrimMat);
    signBase.position.set(0, 1.48, -0.22);
    group.add(signBase);
    const signBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.22), taxiSignMat);
    signBox.position.set(0, 1.61, -0.22);
    group.add(signBox);

    // Chrome Bumpers, Grille & Quad Round 80s Headlights
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.2), chromeMat);
    fBump.position.set(0, 0.39, 2.42);
    group.add(fBump);
    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.2), chromeMat);
    rBump.position.set(0, 0.39, -2.4);
    group.add(rBump);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, 0.08), chromeMat);
    grille.position.set(0, 0.64, 2.38);
    group.add(grille);

    const hlGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.06, 12);
    hlGeo.rotateX(Math.PI / 2);
    for (const hx of [-0.74, -0.48, 0.48, 0.74]) {
      const hl = new THREE.Mesh(hlGeo, headMat);
      hl.position.set(hx, 0.64, 2.42);
      group.add(hl);
    }

    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.15, 0.06), tailMat);
    tailBar.position.set(0, 0.68, -2.4);
    group.add(tailBar);
    for (const sx of [-0.52, 0.52]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.07), reverseMat);
      rev.position.set(sx, 0.54, -2.4);
      group.add(rev);
    }

    addWheels(
      [
        [-1.04, 1.44],
        [1.04, 1.44],
        [-1.04, -1.4],
        [1.04, -1.4],
      ],
      0.35,
      0.26,
      'steel',
    );
  }

  // ===========================================================================
  // 9) VICE EMS AMBULANCE — Boxy 80s Rescue Van + Red Crosses + Flashing Lightbar
  // ===========================================================================
  else if (model === 'ambulance') {
    const redStripeMat = new THREE.MeshStandardMaterial({ color: '#e62238', roughness: 0.28, metalness: 0.2 });

    // Front cab + tall square rear medical box
    const hull = buildProfileExtrusion(
      [
        [-2.75, 0.36],
        [2.68, 0.36],
        [2.72, 1.08], // blunt 80s van nose
        [1.76, 1.18], // short hood
        [1.26, 1.96], // upright van windshield
        [0.52, 2.02], // cab roof
        [0.44, 2.48], // tall raised medical box!
        [-2.78, 2.48],
        [-2.82, 0.44],
      ],
      2.18,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Bold Red EMS Rescue Stripe wrapping sides & rear
    for (const sx of [-1.12, 1.12]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 5.2), redStripeMat);
      stripe.position.set(sx, 1.05, -0.1);
      group.add(stripe);

      // Iconic Red Medical Cross (+) on both sides of the ambulance box
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.22), redStripeMat);
      crossV.position.set(sx, 1.78, -1.15);
      group.add(crossV);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.72), redStripeMat);
      crossH.position.set(sx, 1.78, -1.15);
      group.add(crossH);

      // Cab side window + mirror
      const cabWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.92), glassMat);
      cabWin.position.set(sx * 0.99, 1.56, 1.08);
      group.add(cabWin);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.08), chromeMat);
      mir.position.set(sx * 1.12, 1.48, 1.54);
      group.add(mir);
    }

    // Rear stripe + medical cross + twin rear ambulance windows
    const rearStripe = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.24, 0.05), redStripeMat);
    rearStripe.position.set(0, 1.05, -2.84);
    group.add(rearStripe);
    for (const rx of [-0.52, 0.52]) {
      const rWin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.05), glassMat);
      rWin.position.set(rx, 1.76, -2.84);
      group.add(rWin);
    }
    const rCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.05), redStripeMat);
    rCrossV.position.set(0, 2.24, -2.84);
    group.add(rCrossV);
    const rCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.05), redStripeMat);
    rCrossH.position.set(0, 2.24, -2.84);
    group.add(rCrossH);

    // Front Windshield & Grille
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.06, 0.88), glassMat);
    windshield.position.set(0, 1.58, 1.54);
    windshield.rotation.x = 0.98;
    group.add(windshield);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.36, 0.08), chromeMat);
    grille.position.set(0, 0.78, 2.74);
    group.add(grille);

    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.22, 0.24), chromeMat);
    fBump.position.set(0, 0.44, 2.78);
    group.add(fBump);
    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.2, 0.3), chromeMat);
    rBump.position.set(0, 0.44, -2.92);
    group.add(rBump);

    // Flashing Rooftop Emergency Lightbar (Red / White-Cyan)
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 0.3), darkTrimMat);
    barBase.position.set(0, 2.54, 0.22);
    group.add(barBase);
    lightbarRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.2, 0.26),
      new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.2 }),
    );
    lightbarRed.position.set(-0.5, 2.66, 0.22);
    group.add(lightbarRed);
    lightbarBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.2, 0.26),
      new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e6f6ff', emissiveIntensity: 3.0 }),
    );
    lightbarBlue.position.set(0.5, 2.66, 0.22);
    group.add(lightbarBlue);

    for (const hx of [-0.82, 0.82]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.06), headMat);
      hl.position.set(hx, 0.82, 2.76);
      group.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.06), tailMat);
      tl.position.set(hx * 1.12, 0.82, -2.84);
      group.add(tl);
    }
    for (const sx of [-0.52, 0.52]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.07), reverseMat);
      rev.position.set(sx, 0.64, -2.84);
      group.add(rev);
    }

    addWheels(
      [
        [-1.12, 1.72],
        [1.12, 1.72],
        [-1.12, -1.62],
        [1.12, -1.62],
      ],
      0.42,
      0.32,
      'steel',
    );
  }

  // ===========================================================================
  // 10) VICE FIRE ENGINE 06 — Heavy 80s Firetruck + Ladder + Swiveling Water Cannon!
  // ===========================================================================
  else if (model === 'firetruck') {
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.25, metalness: 0.25 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#e6b84c', roughness: 0.22, metalness: 0.88 });

    // Massive 6.2m flat-nose American Fire Engine silhouette
    const hull = buildProfileExtrusion(
      [
        [-3.05, 0.44],
        [3.02, 0.44],
        [3.08, 2.28], // classic flat-nose fire cab
        [1.18, 2.38], // cab roof
        [1.08, 2.22], // hose bed step
        [-3.08, 2.22],
        [-3.12, 0.52],
      ],
      2.32,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Classic White Cab Roof & Gold/White Side Stripe
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.18, 1.94), whiteMat);
    cabRoof.position.set(0, 2.36, 2.12);
    group.add(cabRoof);

    for (const sx of [-1.19, 1.19]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 5.95), whiteMat);
      stripe.position.set(sx, 1.12, -0.02);
      group.add(stripe);

      // Chrome Equipment Locker Roll-Up Doors along the body
      for (const lz of [-0.1, -1.25, -2.35]) {
        const locker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.92, 0.88), chromeMat);
        locker.position.set(sx, 1.24, lz);
        group.add(locker);
      }

      // Cab side window
      const cabWin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.64, 1.15), glassMat);
      cabWin.position.set(sx * 0.99, 1.76, 2.22);
      group.add(cabWin);
    }

    // Extendable Aluminum Fire Ladder mounted on right-top deck
    for (const lx of [0.64, 1.02]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 4.3), chromeMat);
      rail.position.set(lx, 2.36, -0.92);
      group.add(rail);
    }
    for (let r = 0; r < 11; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.06), chromeMat);
      rung.position.set(0.83, 2.36, 0.96 - r * 0.38);
      group.add(rung);
    }

    // Flat Panoramic Front Windshield & Massive Chrome Grille
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.72, 0.06), glassMat);
    windshield.position.set(0, 1.78, 3.09);
    group.add(windshield);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.68, 0.1), chromeMat);
    grille.position.set(0, 0.96, 3.11);
    group.add(grille);

    // Heavy Chrome Front & Rear Step Bumpers
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.28, 0.32), chromeMat);
    fBump.position.set(0, 0.48, 3.22);
    group.add(fBump);
    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.24, 0.38), chromeMat);
    rBump.position.set(0, 0.48, -3.26);
    group.add(rBump);

    // Flashing Red & White Rooftop Fire Lightbar
    const barMount = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.08, 0.3), darkTrimMat);
    barMount.position.set(0, 2.48, 2.68);
    group.add(barMount);
    lightbarRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.2, 0.26),
      new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.4 }),
    );
    lightbarRed.position.set(-0.54, 2.6, 2.68);
    group.add(lightbarRed);
    lightbarBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.2, 0.26),
      new THREE.MeshStandardMaterial({ color: '#ffbb33', emissive: '#ffaa22', emissiveIntensity: 3.2 }),
    );
    lightbarBlue.position.set(0.54, 2.6, 2.68);
    group.add(lightbarBlue);

    // SWIVELING HIGH-PRESSURE WATER CANNON TURRET (rotates yaw & pitches!)
    const turretPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.34, 12), chromeMat);
    turretPedestal.position.set(-0.22, 2.52, 1.38);
    group.add(turretPedestal);

    waterTurret = new THREE.Group();
    waterTurret.position.set(-0.22, 2.74, 1.38);
    const turretYoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.32), bodyMat);
    waterTurret.add(turretYoke);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 1.05, 12), chromeMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, 0.46);
    waterTurret.add(barrel);

    const nozzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.095, 0.24, 12), brassMat);
    nozzleTip.rotation.x = Math.PI / 2;
    nozzleTip.position.set(0, 0.06, 1.05);
    waterTurret.add(nozzleTip);
    group.add(waterTurret);

    // Quad Headlights & Taillights
    for (const hx of [-0.94, -0.78, 0.78, 0.94]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), headMat);
      hl.position.set(hx, 0.92, 3.12);
      group.add(hl);
    }
    for (const tx of [-0.92, 0.92]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.06), tailMat);
      tl.position.set(tx, 0.92, -3.14);
      group.add(tl);
    }
    for (const sx of [-0.48, 0.48]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.07), reverseMat);
      rev.position.set(sx, 0.72, -3.14);
      group.add(rev);
    }

    addWheels(
      [
        [-1.18, 2.04],
        [1.18, 2.04],
        [-1.18, -1.78],
        [1.18, -1.78],
      ],
      0.48,
      0.38,
      'steel',
    );
  }

  // ===========================================================================
  // 6) 80s MIAMI WEDGE SUPERCAR (Testarossa / Cheetah GT Style)
  // ===========================================================================
  else {
    const hull = buildProfileExtrusion(
      [
        [-2.2, 0.26],
        [2.22, 0.24],
        [2.28, 0.52],
        [1.92, 0.7],  // razor-low exotic front hood
        [0.86, 0.8],
        [0.18, 1.18], // super-low cockpit
        [-0.86, 1.18],
        [-2.14, 0.86], // wide rear engine deck
        [-2.24, 0.54],
      ],
      2.08,
      bodyMat,
      0.025,
    );
    group.add(hull);

    // Signature Testarossa Side Air-Intake Strakes
    for (const sx of [-1.07, 1.07]) {
      for (let s = 0; s < 3; s++) {
        const strake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 1.35), darkTrimMat);
        strake.position.set(sx, 0.5 + s * 0.1, -0.35);
        group.add(strake);
      }
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 1.18), glassMat);
      win.position.set(sx, 0.98, -0.22);
      group.add(win);
    }

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.05, 0.86), glassMat);
    windshield.position.set(0, 1.0, 0.52);
    windshield.rotation.x = 0.45;
    group.add(windshield);

    // Sleek Rear Wing Spoiler
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.06, 0.28), bodyMat);
    wing.position.set(0, 1.14, -2.06);
    group.add(wing);
    for (const px of [-0.76, 0.76]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.18), darkTrimMat);
      pylon.position.set(px, 0.98, -2.04);
      group.add(pylon);
    }

    for (const hx of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.07), headMat);
      hl.position.set(hx, 0.56, 2.26);
      group.add(hl);
    }
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.15, 0.07), tailMat);
    tailBar.position.set(0, 0.68, -2.24);
    group.add(tailBar);
    for (const sx of [-0.55, 0.55]) {
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.08), reverseMat);
      rev.position.set(sx, 0.52, -2.24);
      group.add(rev);
    }

    const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.035, 3.3), glowMat);
    underglow.position.set(0, 0.2, 0);
    group.add(underglow);

    addWheels(
      [
        [-1.06, 1.38],
        [1.06, 1.38],
        [-1.06, -1.36],
        [1.06, -1.36],
      ],
      0.35,
      0.29,
      'alloy',
    );
  }

  return { group, bodyMat, wheels, tailMat, reverseMat, lightbarRed, lightbarBlue, scannerLeds, waterTurret };
}
