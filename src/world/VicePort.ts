import * as THREE from 'three';
import type { AABB } from '../types';
import type { StuntRamp } from './StuntRamps';
import { createNeonSignTexture } from './Textures';

export interface ImportExportSpec {
  vehicleName: string;
  reward: number;
}

export const IMPORT_EXPORT_LIST: ImportExportSpec[] = [
  { vehicleName: 'DELOREAN DMC-12', reward: 2000 },
  { vehicleName: '1982 PONTIAC TRANS AM', reward: 2000 },
  { vehicleName: 'TESLA CYBERTRUCK', reward: 1800 },
  { vehicleName: 'DODGE CHALLENGER', reward: 1500 },
  { vehicleName: '1986 FLEETWOOD BOUNDER', reward: 2200 },
  { vehicleName: '1974 DODGE MONACO', reward: 1500 },
];

export interface VicePortHandle {
  isCarInExportBay: (pos: THREE.Vector3) => boolean;
  canDeliverVehicle: (vehicleName: string) => ImportExportSpec | null;
  markDelivered: (vehicleName: string) => { reward: number; allDoneBonus: number };
  getDeliveredCount: () => number;
  stuntRamps: StuntRamp[];
  update: (elapsed: number, playerPos?: THREE.Vector3) => void;
}

/**
 * Procedural weathered corrugated steel shipping container texture (256x128)
 * with vertical ribs, corner castings, weathering streaks & 80s maritime branding.
 */
function createContainerTexture(baseHex: string, brandText: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 128);

  // Vertical corrugated steel rib shading
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(x, 8, 3, 112);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.fillRect(x + 3, 8, 2, 112);
  }

  // Top & bottom structural frame rails + corner castings
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillRect(0, 118, 256, 10);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(0, 10, 256, 2);
  ctx.fillRect(0, 116, 256, 2);

  // Subtle salt-air grime / rust streaks near bottom
  const grime = ctx.createLinearGradient(0, 88, 0, 128);
  grime.addColorStop(0, 'rgba(35, 22, 16, 0)');
  grime.addColorStop(1, 'rgba(35, 22, 16, 0.36)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 88, 256, 40);

  // Crisp stenciled 80s shipping line branding
  ctx.fillStyle = 'rgba(255, 250, 240, 0.88)';
  ctx.font = '900 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(brandText, 128, 58);

  // Tiny container serial code in top-right
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 250, 240, 0.72)';
  ctx.fillText('VCU 864209', 246, 24);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural industrial port concrete slab texture with expansion joints, oil stains & tire tracks.
 */
function createPortConcreteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3a3b42';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle concrete grain & damp patches
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const sz = 2 + (i % 6);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, sz, sz);
  }

  // Expansion joint grid lines
  ctx.strokeStyle = 'rgba(18, 18, 24, 0.45)';
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
  tex.repeat.set(14, 7);
  return tex;
}

/**
 * Yellow/black diagonal industrial hazard stripe texture for quay edges.
 */
function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e5a922';
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
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 1);
  return tex;
}

/**
 * Builds "VICE PORT" — High-Detail Industrial Container Docks South of the City (z = +66..+138):
 * - Concrete quay apron with hazard borders, instanced mooring bollards & southern ocean extension
 * - Illuminated "VICE PORT · DOCKS" entrance gantry
 * - Stacked multi-color corrugated shipping container canyons with 80s maritime branding
 * - 2 towering 26m red/white STS Gantry Cranes with animated moving trolleys & suspended containers
 * - 58m sculpted Cargo Freighter "MV VICE TRADER" moored along the south quay
 * - 4 industrial floodlight lattice towers with warm sodium volumetric haze cones (0 extra PointLights!)
 * - Walk/Drive-in "IMPORT / EXPORT" Warehouse with live Wanted Vehicles chalkboard & cash payouts!
 * - 2 Port Stunt Ramps for container & dock jumps
 */
export function buildVicePort(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  oceanMat: THREE.ShaderMaterial,
): VicePortHandle {
  const concreteTex = createPortConcreteTexture();
  const concreteMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    roughness: 0.56,
    metalness: 0.14,
  });
  const quayWallMat = new THREE.MeshStandardMaterial({ color: '#4c4d55', roughness: 0.78 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: createHazardStripeTexture(), roughness: 0.45 });
  const steelDarkMat = new THREE.MeshStandardMaterial({ color: '#242730', roughness: 0.42, metalness: 0.72 });
  const steelGalvMat = new THREE.MeshStandardMaterial({ color: '#8a929e', roughness: 0.35, metalness: 0.78 });
  const craneRedMat = new THREE.MeshStandardMaterial({ color: '#c8342e', roughness: 0.34, metalness: 0.45 });
  const craneWhiteMat = new THREE.MeshStandardMaterial({ color: '#eae6de', roughness: 0.42, metalness: 0.25 });
  const rustHullMat = new THREE.MeshStandardMaterial({ color: '#7a2c24', roughness: 0.74, metalness: 0.18 });
  const shipNavyMat = new THREE.MeshStandardMaterial({ color: '#1b283a', roughness: 0.48, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0d192b', roughness: 0.08, metalness: 0.88 });
  const amberNeon = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff8c24', emissiveIntensity: 2.2 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.0 });
  const beaconRedMat = new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff1a3a', emissiveIntensity: 3.2 });
  const floodBulbMat = new THREE.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffbe66', emissiveIntensity: 3.4 });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material | THREE.Material[],
    castShadow = true,
    tag = 'port',
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

  // ===========================================================================
  // 1) PORT CONCRETE QUAY APRON, SOUTHERN OCEAN & HAZARD WATERFRONT
  // ===========================================================================
  // Main Concrete Port Yard: x = -68 .. +78 (146m wide), z = +66 .. +126 (60m deep), top at y = 0.0
  const portSlab = new THREE.Mesh(new THREE.BoxGeometry(146, 1.4, 60), concreteMat);
  portSlab.position.set(5, -0.7, 96);
  portSlab.receiveShadow = true;
  scene.add(portSlab);
  worldMeshes.push(portSlab);

  // Heavy Concrete Seawall Lip along South (z = 126) & East (x = 78) water edges
  const southQuay = new THREE.Mesh(new THREE.BoxGeometry(146, 1.5, 1.0), quayWallMat);
  southQuay.position.set(5, -0.68, 125.7);
  scene.add(southQuay);

  // Yellow/Black Industrial Hazard Edge Strip along South Waterfront
  const hazardStrip = new THREE.Mesh(new THREE.PlaneGeometry(145, 0.9), hazardMat);
  hazardStrip.rotation.x = -Math.PI / 2;
  hazardStrip.position.set(5, 0.015, 125.1);
  scene.add(hazardStrip);

  // Extended Southern Ocean Plane (so the Cargo Freighter sits in real animated dusk water!)
  const southOcean = new THREE.Mesh(new THREE.PlaneGeometry(360, 160, 40, 24), oceanMat);
  southOcean.rotation.x = -Math.PI / 2;
  southOcean.position.set(60, -0.22, 204); // spans z = 124 .. 284
  scene.add(southOcean);

  // Steel Crane Rail Tracks embedded in the concrete along z = 114 and z = 122
  for (const rz of [113.5, 122.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(118, 0.05, 0.22), steelDarkMat);
    rail.position.set(4, 0.025, rz);
    scene.add(rail);
  }

  // Instanced Heavy Cast-Iron Mooring Bollards along South Quay (1 draw call!)
  const bollardGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.65, 10);
  const bollardCount = 14;
  const bollardInst = new THREE.InstancedMesh(bollardGeo, steelDarkMat, bollardCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bollardCount; i++) {
    dummy.position.set(-58 + i * 10, 0.32, 125.2);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bollardInst.setMatrixAt(i, dummy.matrix);
  }
  bollardInst.instanceMatrix.needsUpdate = true;
  bollardInst.matrixAutoUpdate = false;
  scene.add(bollardInst);

  // ===========================================================================
  // 2) ILLUMINATED "VICE PORT · DOCKS" ENTRANCE GANTRY (z = 70, x = 20)
  // ===========================================================================
  const gantryX = 20;
  const gantryZ = 70;
  for (const sx of [-7.2, 7.2]) {
    addBox(0.85, 6.2, 0.85, gantryX + sx, 3.1, gantryZ, steelDarkMat, true, 'port-gantry');
  }
  const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(15.6, 1.15, 0.85), steelDarkMat);
  gantryBeam.position.set(gantryX, 6.1, gantryZ);
  gantryBeam.castShadow = true;
  scene.add(gantryBeam);

  const portSignTex = createNeonSignTexture('VICE PORT · DOCKS', '#ff9f43');
  const portSignMat = new THREE.MeshStandardMaterial({
    map: portSignTex,
    emissive: '#ffffff',
    emissiveMap: portSignTex,
    emissiveIntensity: 1.75,
  });
  const portSignF = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.3, 0.16), portSignMat);
  portSignF.position.set(gantryX, 6.15, gantryZ - 0.48);
  portSignF.rotation.y = Math.PI;
  scene.add(portSignF);
  const portSignB = portSignF.clone();
  portSignB.position.z = gantryZ + 0.48;
  portSignB.rotation.y = 0;
  scene.add(portSignB);

  // ===========================================================================
  // 3) CORRUGATED SHIPPING CONTAINER CANYONS (Multi-Color Branded Stacks!)
  // ===========================================================================
  const containerDefs = [
    { color: '#b8322c', brand: 'VICE LINE' },
    { color: '#235284', brand: 'OCEAN FREIGHT' },
    { color: '#1e7a72', brand: 'MIAMI EXPRESS' },
    { color: '#d47a28', brand: 'SUNSHINE CARGO' },
    { color: '#c49628', brand: 'CARIBBEAN TRANS' },
    { color: '#455162', brand: 'ATLANTIC CORP' },
  ];
  const containerMats = containerDefs.map(
    (d) =>
      new THREE.MeshStandardMaterial({
        map: createContainerTexture(d.color, d.brand),
        roughness: 0.52,
        metalness: 0.38,
      }),
  );

  // Place rich multi-tier container stacks forming drivable industrial canyons
  // Format: [x, z, tier (0,1,2), rot90 (boolean), colorIdx]
  const containerStacks: [number, number, number, boolean, number][] = [
    // West Yard Canyon (x = -56..-30, z = 78..108)
    [-54, 82, 0, false, 0],
    [-54, 82, 1, false, 2],
    [-54, 89, 0, false, 1],
    [-54, 89, 1, false, 3],
    [-54, 89, 2, false, 0],
    [-54, 99, 0, false, 4],
    [-54, 99, 1, false, 5],
    [-44, 82, 0, false, 3],
    [-44, 82, 1, false, 1],
    [-44, 92, 0, false, 2],
    [-44, 102, 0, false, 0],
    [-44, 102, 1, false, 4],
    [-34, 85, 0, true, 1],
    [-34, 85, 1, true, 3],
    [-34, 96, 0, true, 5],
    [-34, 96, 1, true, 0],
    // Central Yard Stacks (x = -12..+12, z = 82..106)
    [-10, 84, 0, false, 2],
    [-10, 84, 1, false, 0],
    [-10, 94, 0, false, 4],
    [-10, 94, 1, false, 1],
    [-10, 94, 2, false, 3],
    [2, 84, 0, false, 1],
    [2, 84, 1, false, 5],
    [2, 96, 0, false, 3],
    [2, 96, 1, false, 2],
    [12, 90, 0, true, 0],
    [12, 90, 1, true, 4],
    // Quay Staging Containers near Cranes
    [-34, 117, 0, false, 2],
    [42, 116, 0, false, 3],
    [42, 116, 1, false, 1],
  ];

  const cLen = 6.2;
  const cW = 2.5;
  const cH = 2.65;
  const containerBuckets: { x: number; y: number; z: number; rotY: number; scaleY: number }[][] =
    containerMats.map(() => []);

  for (const [cx, cz, tier, rot90, matIdx] of containerStacks) {
    const w = rot90 ? cW : cLen;
    const d = rot90 ? cLen : cW;
    const y = tier * cH + cH / 2;
    colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: y - cH / 2,
      maxY: y + cH / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      tag: 'container',
    });
    containerBuckets[matIdx % containerMats.length].push({
      x: cx,
      y,
      z: cz,
      rotY: rot90 ? Math.PI / 2 : 0,
      scaleY: 1,
    });
  }

  // ===========================================================================
  // 4) TWO TOWERING 26-METER STS CONTAINER GANTRY CRANES (Animated Trolleys!)
  // ===========================================================================
  const craneTrolleys: { group: THREE.Group; baseZ: number; phase: number }[] = [];

  const buildGantryCrane = (craneX: number, phase: number): void => {
    const craneZ = 118;
    const legSpanX = 7.4;
    const legSpanZ = 9.0;
    const portalH = 15.5;
    const topH = 25.5;

    // 4 Massive Portal Legs resting on rail bogies
    for (const sx of [-legSpanX / 2, legSpanX / 2]) {
      for (const sz of [-legSpanZ / 2, legSpanZ / 2]) {
        // Rail bogie base
        addBox(1.8, 1.1, 1.4, craneX + sx, 0.55, craneZ + sz, steelDarkMat, true, 'crane-leg');
        // Main vertical red steel column
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.72, portalH, 0.72), craneRedMat);
        col.position.set(craneX + sx, 1.1 + portalH / 2, craneZ + sz);
        col.castShadow = true;
        scene.add(col);
      }
      // Upper A-frame tower rising above the boom to 25.5m
      const aFront = new THREE.Mesh(new THREE.BoxGeometry(0.55, 11.2, 0.55), craneWhiteMat);
      aFront.position.set(craneX + sx, portalH + 5.2, craneZ + 1.8);
      aFront.rotation.x = -0.26;
      scene.add(aFront);
      const aBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 11.2, 0.55), craneWhiteMat);
      aBack.position.set(craneX + sx, portalH + 5.2, craneZ - 1.8);
      aBack.rotation.x = 0.26;
      scene.add(aBack);
    }

    // Horizontal cross-girders connecting the 4 legs + top apex beam + red aviation beacons
    for (const sz of [-legSpanZ / 2, legSpanZ / 2]) {
      const xBeam = new THREE.Mesh(new THREE.BoxGeometry(legSpanX + 0.8, 0.85, 0.72), craneWhiteMat);
      xBeam.position.set(craneX, portalH + 0.6, craneZ + sz);
      scene.add(xBeam);
    }
    const apexBeam = new THREE.Mesh(new THREE.BoxGeometry(legSpanX + 1.2, 0.9, 1.1), craneRedMat);
    apexBeam.position.set(craneX, topH, craneZ);
    scene.add(apexBeam);

    for (const sx of [-legSpanX / 2, legSpanX / 2]) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), beaconRedMat);
      beacon.position.set(craneX + sx, topH + 0.65, craneZ);
      scene.add(beacon);
    }

    // Twin Cantilevered Horizontal Booms extending 24m out South over the Cargo Freighter!
    for (const sx of [-2.4, 2.4]) {
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 38.0), craneRedMat);
      boom.position.set(craneX + sx, portalH + 1.2, craneZ + 8.0);
      boom.castShadow = true;
      scene.add(boom);

      // Diagonal steel suspension stay cables from apex down to boom tip & rear counterweight
      const stayFront = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 24.5, 6), steelGalvMat);
      stayFront.position.set(craneX + sx, portalH + 5.4, craneZ + 11.5);
      stayFront.rotation.x = 1.22;
      scene.add(stayFront);

      const stayBack = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 14.5, 6), steelGalvMat);
      stayBack.position.set(craneX + sx, portalH + 5.4, craneZ - 5.5);
      stayBack.rotation.x = -0.95;
      scene.add(stayBack);
    }

    // Elevated Machinery House on the crane deck
    const machHouse = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.6, 6.2), craneWhiteMat);
    machHouse.position.set(craneX, portalH + 3.0, craneZ - 2.0);
    scene.add(machHouse);

    // Animated Moving Trolley + Glass Operator Cab + Suspended Shipping Container!
    const trolley = new THREE.Group();
    trolley.userData.dynamic = true;
    trolley.position.set(craneX, portalH + 0.5, craneZ + 10.0);

    const carriage = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.65, 3.2), steelDarkMat);
    trolley.add(carriage);
    const opCab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.8), glassMat);
    opCab.position.set(2.2, -1.1, 0);
    trolley.add(opCab);

    // 4 Steel hoist cables + spreader frame + suspended container
    for (const cxOff of [-2.6, 2.6]) {
      for (const czOff of [-1.0, 1.0]) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 5.2, 6), steelGalvMat);
        cable.position.set(cxOff, -2.8, czOff);
        trolley.add(cable);
      }
    }
    const spreader = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.28, 2.55), hazardMat);
    spreader.position.y = -5.4;
    trolley.add(spreader);

    const hangingBox = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 2.6, 2.5),
      containerMats[phase === 0 ? 3 : 0],
    );
    hangingBox.position.y = -6.85;
    hangingBox.castShadow = true;
    trolley.add(hangingBox);

    scene.add(trolley);
    craneTrolleys.push({ group: trolley, baseZ: craneZ + 8.5, phase });
  };

  buildGantryCrane(-14, 0);
  buildGantryCrane(26, 2.2);

  // ===========================================================================
  // 5) 58-METER SCULPTED CARGO FREIGHTER "MV VICE TRADER" (z = +134)
  // ===========================================================================
  const shipX = 8;
  const shipZ = 135; // moored right alongside South Quay (z = 126)!

  // Extruded Freighter Hull Profile along X (+X = Bow, -X = Stern)
  const shipShape = new THREE.Shape();
  shipShape.moveTo(-29, -0.5);
  shipShape.lineTo(24, -0.5);
  shipShape.lineTo(31, 3.8);  // flared freighter bow stem
  shipShape.lineTo(22, 3.3);  // foredeck sheer
  shipShape.lineTo(-28, 3.1); // main cargo deck
  shipShape.lineTo(-30, 1.4); // transom stern
  shipShape.closePath();

  const shipGeo = new THREE.ExtrudeGeometry(shipShape, {
    depth: 13.4,
    bevelEnabled: true,
    bevelThickness: 0.25,
    bevelSize: 0.2,
    bevelSegments: 2,
  });
  shipGeo.translate(0, 0, -6.7);
  shipGeo.computeVertexNormals();
  const freighterHull = new THREE.Mesh(shipGeo, shipNavyMat);
  freighterHull.position.set(shipX, 0, shipZ);
  freighterHull.castShadow = true;
  freighterHull.receiveShadow = true;
  scene.add(freighterHull);

  // Rust-red lower antifouling waterline band
  const rustBand = new THREE.Mesh(new THREE.BoxGeometry(56.5, 1.45, 13.9), rustHullMat);
  rustBand.position.set(shipX - 0.5, 0.35, shipZ);
  scene.add(rustBand);

  // Solid ship deck collider so you can even walk or jump onto the cargo ship!
  addBox(56.0, 3.1, 13.6, shipX - 0.5, 1.55, shipZ, shipNavyMat, false, 'ship-hull').visible = false;

  // 5-Story White Aft Bridge Superstructure + Bridge Wings + Vice Smokestack Funnel!
  const bridgeX = shipX - 21;
  addBox(9.5, 11.5, 12.2, bridgeX, 3.1 + 5.75, shipZ, craneWhiteMat, true, 'ship-bridge');
  // Wide overhanging navigation bridge wings
  const bridgeWings = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 16.5), craneWhiteMat);
  bridgeWings.position.set(bridgeX + 1.5, 13.2, shipZ);
  bridgeWings.castShadow = true;
  scene.add(bridgeWings);
  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.95, 15.8), glassMat);
  bridgeGlass.position.set(bridgeX + 1.55, 13.35, shipZ);
  scene.add(bridgeGlass);

  // Iconic Red/Navy Smokestack Funnel behind bridge + Radar Mast
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 2.6), craneRedMat);
  funnel.position.set(bridgeX - 2.6, 16.6, shipZ);
  funnel.rotation.z = 0.14;
  scene.add(funnel);
  const funnelTop = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.9, 2.7), steelDarkMat);
  funnelTop.position.set(bridgeX - 2.9, 18.8, shipZ);
  scene.add(funnelTop);

  // Stacked Shipping Containers loaded onto the Freighter's cargo deck! (batched into 6 InstancedMeshes!)
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      const tiers = (col + row) % 2 === 0 ? 2 : 1;
      for (let t = 0; t < tiers; t++) {
        const idx = (col * 3 + row + t) % containerMats.length;
        containerBuckets[idx].push({
          x: shipX - 11 + col * 6.8,
          y: 4.4 + t * 2.65,
          z: shipZ - 3.2 + row * 3.1,
          rotY: 0,
          scaleY: 2.6 / cH,
        });
      }
    }
  }

  const sharedContainerGeo = new THREE.BoxGeometry(cLen, cH, cW);
  containerBuckets.forEach((items, matIdx) => {
    if (items.length === 0) return;
    const inst = new THREE.InstancedMesh(sharedContainerGeo, containerMats[matIdx], items.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(0, it.rotY, 0);
      dummy.scale.set(1, it.scaleY, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.matrixAutoUpdate = false;
    inst.computeBoundingSphere();
    scene.add(inst);
    worldMeshes.push(inst);
  });

  // ===========================================================================
  // 6) FOUR 18-METER INDUSTRIAL FLOODLIGHT MASTS (Additive Haze Cones -> 0 PointLights!)
  // ===========================================================================
  const hazeConeGeo = new THREE.ConeGeometry(7.2, 17.5, 14, 1, true);
  const hazeConeMat = new THREE.MeshBasicMaterial({
    color: '#ffbe66',
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const [fx, fz] of [
    [-60, 74],
    [-60, 118],
    [66, 74],
    [66, 118],
  ]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 18.0, 6), steelGalvMat);
    mast.position.set(fx, 9.0, fz);
    mast.castShadow = true;
    scene.add(mast);

    const headBar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.65, 0.45), steelDarkMat);
    headBar.position.set(fx, 18.0, fz);
    scene.add(headBar);

    const bulbs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.38, 0.52), floodBulbMat);
    bulbs.position.set(fx, 17.95, fz);
    scene.add(bulbs);

    const cone = new THREE.Mesh(hazeConeGeo, hazeConeMat);
    cone.position.set(fx, 9.0, fz);
    scene.add(cone);
  }

  // ===========================================================================
  // 7) "IMPORT / EXPORT" GARAGE WAREHOUSE + LIVE WANTED VEHICLES CHALKBOARD! (x = 56, z = 92)
  // ===========================================================================
  const whX = 58;
  const whZ = 92;
  const whW = 16; // x: 50 .. 66
  const whD = 18; // z: 83 .. 101
  const whH = 6.2;
  const whMat = new THREE.MeshStandardMaterial({ color: '#39404d', roughness: 0.62, metalness: 0.38 });

  // Hollow Drive-In Warehouse (wide 9m open bay facing West -X toward the port yard!)
  addBox(0.55, whH, whD, whX + whW / 2, whH / 2, whZ, whMat); // East back wall
  addBox(whW, whH, 0.55, whX, whH / 2, whZ - whD / 2, whMat); // North wall
  addBox(whW, whH, 0.55, whX, whH / 2, whZ + whD / 2, whMat); // South wall
  addBox(0.55, whH, 4.5, whX - whW / 2, whH / 2, whZ - 6.75, whMat); // West front N
  addBox(0.55, whH, 4.5, whX - whW / 2, whH / 2, whZ + 6.75, whMat); // West front S
  addBox(0.55, 1.8, 9.2, whX - whW / 2, whH - 0.9, whZ, whMat); // Bay header lintel
  addBox(whW + 0.6, 0.45, whD + 0.6, whX, whH + 0.22, whZ, steelDarkMat); // Roof

  // Glowing "IMPORT / EXPORT" Neon Sign above the drive-in bay
  const ieSignTex = createNeonSignTexture('IMPORT / EXPORT', '#36f1e6');
  const ieSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.45, 7.8),
    new THREE.MeshStandardMaterial({
      map: ieSignTex,
      emissive: '#ffffff',
      emissiveMap: ieSignTex,
      emissiveIntensity: 1.85,
    }),
  );
  ieSign.position.set(whX - whW / 2 - 0.2, whH - 0.85, whZ);
  scene.add(ieSign);

  // Glowing Drive-In Delivery Ring inside the Export Bay
  const exportRing = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 3.65, 32),
    new THREE.MeshBasicMaterial({ color: '#36f1e6', side: THREE.DoubleSide }),
  );
  exportRing.rotation.x = -Math.PI / 2;
  exportRing.position.set(whX - 1.5, 0.04, whZ);
  exportRing.userData.dynamic = true;
  scene.add(exportRing);

  // Dynamic 3D "WANTED VEHICLES" Chalkboard mounted beside the bay door (x = 49.6, z = 85.2)
  const delivered = new Set<string>();
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 256;
  boardCanvas.height = 256;
  const bCtx = boardCanvas.getContext('2d')!;
  const boardTex = new THREE.CanvasTexture(boardCanvas);

  const redrawExportBoard = () => {
    bCtx.fillStyle = '#141a18';
    bCtx.fillRect(0, 0, 256, 256);
    bCtx.strokeStyle = '#ff9f43';
    bCtx.lineWidth = 6;
    bCtx.strokeRect(4, 4, 248, 248);

    bCtx.fillStyle = '#ff9f43';
    bCtx.font = 'bold 17px monospace';
    bCtx.fillText('VICE PORT · EXPORT', 22, 30);
    bCtx.fillStyle = '#36f1e6';
    bCtx.font = 'bold 12px monospace';
    bCtx.fillText(`GELIEFERT: ${delivered.size}/${IMPORT_EXPORT_LIST.length} (+$5.000 BONUS)`, 16, 52);

    IMPORT_EXPORT_LIST.forEach((item, idx) => {
      const y = 84 + idx * 27;
      const done = delivered.has(item.vehicleName);
      bCtx.fillStyle = done ? '#52f29c' : '#f2ede4';
      bCtx.font = 'bold 12px monospace';
      const label = item.vehicleName.replace('1982 PONTIAC ', '82 ').replace('1986 FLEETWOOD ', '86 ').replace('1974 DODGE ', '74 ');
      bCtx.fillText(done ? `✓ ${label}` : `• ${label}`, 16, y);
      bCtx.fillStyle = done ? '#52f29c' : '#ffd15c';
      bCtx.fillText(done ? 'OK' : `$${item.reward}`, 196, y);
    });
    boardTex.needsUpdate = true;
  };
  redrawExportBoard();

  const exportBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.8, 2.8),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.65 }),
  );
  exportBoard.position.set(whX - whW / 2 - 0.35, 2.4, whZ - 6.6);
  scene.add(exportBoard);

  // ===========================================================================
  // 8) PORT STUNT RAMP (Quay Jump)
  // ===========================================================================
  const portStuntRamps: StuntRamp[] = [
    { x: -24, z: 108, dirX: 0, dirZ: 1, width: 4.8, length: 9.0, height: 2.8 },
  ];
  for (const r of portStuntRamps) {
    const g = new THREE.Group();
    g.position.set(r.x, 0, r.z);
    g.rotation.y = Math.atan2(r.dirX, r.dirZ);
    const slopeAngle = Math.atan2(r.height, r.length);
    const hyp = Math.hypot(r.length, r.height);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(r.width, 0.2, hyp), steelDarkMat);
    deck.position.set(0, r.height / 2, 0);
    deck.rotation.x = -slopeAngle;
    deck.castShadow = true;
    g.add(deck);
    for (const sx of [-r.width / 2, r.width / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, hyp), amberNeon);
      rail.position.set(sx, r.height / 2 + 0.14, 0);
      rail.rotation.x = -slopeAngle;
      g.add(rail);
    }
    const backSupport = new THREE.Mesh(new THREE.BoxGeometry(r.width, r.height, 0.35), cyanNeon);
    backSupport.position.set(0, r.height / 2, r.length / 2 - 0.2);
    g.add(backSupport);
    scene.add(g);
  }

  return {
    stuntRamps: portStuntRamps,
    isCarInExportBay: (pos: THREE.Vector3) =>
      pos.x > whX - whW / 2 - 1.5 &&
      pos.x < whX + whW / 2 - 1.0 &&
      Math.abs(pos.z - whZ) < 5.5 &&
      pos.y < 3.0,
    canDeliverVehicle: (vehicleName: string) => {
      const spec = IMPORT_EXPORT_LIST.find((s) => s.vehicleName === vehicleName);
      if (!spec || delivered.has(spec.vehicleName)) return null;
      return spec;
    },
    markDelivered: (vehicleName: string) => {
      const spec = IMPORT_EXPORT_LIST.find((s) => s.vehicleName === vehicleName);
      if (!spec) return { reward: 0, allDoneBonus: 0 };
      delivered.add(spec.vehicleName);
      let allDoneBonus = 0;
      if (delivered.size >= IMPORT_EXPORT_LIST.length) {
        allDoneBonus = 5000;
        delivered.clear();
      }
      redrawExportBoard();
      return { reward: spec.reward, allDoneBonus };
    },
    getDeliveredCount: () => delivered.size,
    update: (elapsed: number, playerPos?: THREE.Vector3) => {
      if (playerPos && playerPos.z < 10) return;
      // Animate both towering Gantry Crane trolleys sliding back & forth over the cargo freighter!
      for (const ct of craneTrolleys) {
        ct.group.position.z = ct.baseZ + Math.sin(elapsed * 0.38 + ct.phase) * 9.5;
      }
      const s = 1 + Math.sin(elapsed * 4.0) * 0.06;
      exportRing.scale.set(s, s, 1);
    },
  };
}
