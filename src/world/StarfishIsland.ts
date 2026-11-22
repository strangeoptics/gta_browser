import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';

export interface SuperyachtHandle {
  group: THREE.Group;
  initialPos: THREE.Vector3;
  upperDeckY: number;
  syncColliders: (x: number, y: number, z: number, yaw: number) => void;
  getWorldPos: (localOffset: THREE.Vector3, out?: THREE.Vector3) => THREE.Vector3;
  isPlayerOnOrNearYacht: (pos: THREE.Vector3) => boolean;
}

export interface StarfishIslandHandle {
  getGroundHeight: (x: number, z: number) => number | null;
  isNearIslandVault: (pos: THREE.Vector3) => boolean;
  isNearYachtLoot: (pos: THREE.Vector3) => boolean;
  takeIslandVault: () => void;
  takeYachtLoot: () => void;
  helipadSpawn: THREE.Vector3;
  yacht: SuperyachtHandle;
  update: (elapsed: number, dt: number, playerPos?: THREE.Vector3) => void;
}

/**
 * Builds the East Ocean Expansion:
 * 1) Illuminated Arched Miami Causeway Bridge (x = 66..148, z = -60) — drivable & walkable, boat clearance underneath!
 * 2) Starfish Island (cx = 172, cz = -52) — sandy shores, palm roundabout, walk-in Cartel Mansion (+$2,500 vault) & Helipad
 * 3) 42-Meter 80s Superyacht "LADY VICE" (cx = 172, cz = 15) — multi-deck walkable yacht, spinning radar, upper helipad & Captain's Stash (+$1,800)
 */
export function buildStarfishIsland(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  palmPositions: { x: number; z: number; rot: number; scale: number }[],
): StarfishIslandHandle {
  const roadMat = new THREE.MeshStandardMaterial({ color: '#221f2b', roughness: 0.42, metalness: 0.18 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#e6ddd2', roughness: 0.62 });
  const sandMat = new THREE.MeshStandardMaterial({ color: '#e5ca9f', roughness: 0.85 });
  const grassMat = new THREE.MeshStandardMaterial({ color: '#2f6e4e', roughness: 0.82 });
  const stuccoMat = new THREE.MeshStandardMaterial({ color: '#f6eee6', roughness: 0.55 });
  const coralMat = new THREE.MeshStandardMaterial({ color: '#f09c8c', roughness: 0.58 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: '#dcd6e2', roughness: 0.2, metalness: 0.15 });
  const teakMat = new THREE.MeshStandardMaterial({ color: '#8f6242', roughness: 0.65 });
  const yachtHullMat = new THREE.MeshStandardMaterial({ color: '#f7f8fc', roughness: 0.16, metalness: 0.28 });
  const yachtGlassMat = new THREE.MeshStandardMaterial({ color: '#0d192b', roughness: 0.08, metalness: 0.88 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#e8b948', roughness: 0.22, metalness: 0.88 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.2 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.2 });
  const yellowPaintMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', roughness: 0.5 });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    tag = 'island',
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
  // 1) ARCHED MIAMI CAUSEWAY BRIDGE (x = 66 .. 148, centered at z = -60)
  // ===========================================================================
  const bridgeStartX = 66;
  const bridgeEndX = 148;
  const bridgeLen = bridgeEndX - bridgeStartX; // 82m
  const bridgeZ = -60;
  const bridgeW = 11.4;
  const islandY = 0.68;

  const getCausewayY = (x: number): number => {
    const t = THREE.MathUtils.clamp((x - bridgeStartX) / bridgeLen, 0, 1);
    return Math.sin(t * Math.PI) * 2.85 + t * islandY;
  };

  // Build smooth subdivided arched bridge deck & neon side stripes (merged by material -> 5 draw calls instead of 99!)
  const segCount = 22;
  const segLen = bridgeLen / segCount;
  const deckGeos: THREE.BufferGeometry[] = [];
  const dashGeos: THREE.BufferGeometry[] = [];
  const railGeos: THREE.BufferGeometry[] = [];
  const cyanNeonGeos: THREE.BufferGeometry[] = [];
  const pinkNeonGeos: THREE.BufferGeometry[] = [];

  for (let i = 0; i < segCount; i++) {
    const x0 = bridgeStartX + i * segLen;
    const x1 = x0 + segLen;
    const xm = (x0 + x1) * 0.5;
    const y0 = getCausewayY(x0);
    const y1 = getCausewayY(x1);
    const ym = (y0 + y1) * 0.5;
    const slope = Math.atan2(y1 - y0, segLen);
    const actualLen = Math.hypot(segLen, y1 - y0) + 0.08;

    const deckGeo = new THREE.BoxGeometry(actualLen, 0.36, bridgeW);
    deckGeo.rotateZ(slope);
    deckGeo.translate(xm, ym - 0.18, bridgeZ);
    deckGeos.push(deckGeo);

    // Center yellow road dash every 2nd segment
    if (i % 2 === 0) {
      const dashGeo = new THREE.BoxGeometry(actualLen * 0.55, 0.03, 0.24);
      dashGeo.rotateZ(slope);
      dashGeo.translate(xm, ym + 0.015, bridgeZ);
      dashGeos.push(dashGeo);
    }

    // Concrete bridge side parapets + thin neon edge tubes
    for (const sz of [-1, 1]) {
      const railZ = bridgeZ + sz * (bridgeW / 2 + 0.25);
      const railGeo = new THREE.BoxGeometry(actualLen, 0.85, 0.45);
      railGeo.rotateZ(slope);
      railGeo.translate(xm, ym + 0.32, railZ);
      railGeos.push(railGeo);

      if (i % 2 === 1) {
        const neonGeo = new THREE.BoxGeometry(actualLen * 0.85, 0.09, 0.12);
        neonGeo.rotateZ(slope);
        neonGeo.translate(xm, ym + 0.78, railZ);
        if (sz < 0) cyanNeonGeos.push(neonGeo);
        else pinkNeonGeos.push(neonGeo);
      }
    }
  }

  const mergedDeck = new THREE.Mesh(mergeGeometries(deckGeos), roadMat);
  mergedDeck.castShadow = true;
  mergedDeck.receiveShadow = true;
  scene.add(mergedDeck);
  worldMeshes.push(mergedDeck);

  const mergedDash = new THREE.Mesh(mergeGeometries(dashGeos), yellowPaintMat);
  scene.add(mergedDash);

  const mergedRail = new THREE.Mesh(mergeGeometries(railGeos), concreteMat);
  mergedRail.castShadow = true;
  mergedRail.receiveShadow = true;
  scene.add(mergedRail);
  worldMeshes.push(mergedRail);

  scene.add(new THREE.Mesh(mergeGeometries(cyanNeonGeos), cyanNeon));
  scene.add(new THREE.Mesh(mergeGeometries(pinkNeonGeos), pinkNeon));

  for (const g of [...deckGeos, ...dashGeos, ...railGeos, ...cyanNeonGeos, ...pinkNeonGeos]) {
    g.dispose();
  }

  // Solid side guardrail colliders along the entire Causeway so cars & players stay safely on the bridge
  colliders.push(
    {
      minX: bridgeStartX,
      maxX: bridgeEndX,
      minY: -0.5,
      maxY: 5.2,
      minZ: bridgeZ - bridgeW / 2 - 0.55,
      maxZ: bridgeZ - bridgeW / 2,
      tag: 'bridge-rail',
    },
    {
      minX: bridgeStartX,
      maxX: bridgeEndX,
      minY: -0.5,
      maxY: 5.2,
      minZ: bridgeZ + bridgeW / 2,
      maxZ: bridgeZ + bridgeW / 2 + 0.55,
      tag: 'bridge-rail',
    },
  );

  // Concrete bridge support pilings in the water (spaced wide at x=107 so Speedboat passes cleanly underneath!)
  for (const px of [82, 96, 118, 134]) {
    const topY = getCausewayY(px) - 0.25;
    for (const sz of [-4.4, 4.4]) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, topY + 1.4, 10), concreteMat);
      pier.position.set(px, (topY - 1.4) / 2, bridgeZ + sz);
      pier.castShadow = true;
      scene.add(pier);
    }
  }

  // Twin Illuminated Miami Arch Portals over the Causeway crest (x = 107)
  for (const ax of [101, 113]) {
    const baseH = getCausewayY(ax);
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(6.1, 0.22, 8, 24, Math.PI),
      ax === 101 ? cyanNeon : pinkNeon,
    );
    arch.rotation.y = Math.PI / 2;
    arch.position.set(ax, baseH + 0.2, bridgeZ);
    scene.add(arch);
  }

  // ===========================================================================
  // 2) STARFISH ISLAND (cx = 172, cz = -52, x = 148..198, z = -84..-20)
  // ===========================================================================
  const islCX = 173;
  const islCZ = -52;
  const islW = 50; // x: 148 .. 198
  const islD = 64; // z: -84 .. -20

  // Outer golden sand beach shelf dipping into the ocean
  const sandBase = new THREE.Mesh(new THREE.BoxGeometry(islW + 7, 1.05, islD + 7), sandMat);
  sandBase.position.set(islCX, 0.02, islCZ);
  sandBase.receiveShadow = true;
  scene.add(sandBase);

  // Raised stone-rimmed lush green tropical island platform (top at y = islandY = 0.68)
  addBox(islW, 0.9, islD, islCX, islandY - 0.45, islCZ, concreteMat, true, 'island-ground');
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(islW - 2.2, islD - 2.2), grassMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(islCX, islandY + 0.01, islCZ);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // Paved asphalt entry road & circular palm roundabout from the bridge (z = -60 -> center)
  const entryRoad = new THREE.Mesh(new THREE.PlaneGeometry(18, 11.2), roadMat);
  entryRoad.rotation.x = -Math.PI / 2;
  entryRoad.position.set(157, islandY + 0.02, -60);
  entryRoad.receiveShadow = true;
  scene.add(entryRoad);

  const roundabout = new THREE.Mesh(new THREE.RingGeometry(4.2, 10.2, 28), roadMat);
  roundabout.rotation.x = -Math.PI / 2;
  roundabout.position.set(166, islandY + 0.022, -55);
  roundabout.receiveShadow = true;
  scene.add(roundabout);

  // Add lush tropical palms around Starfish Island (merged into CityBuilder's 2-draw-call InstancedMesh!)
  const islandPalms: [number, number, number][] = [
    [166, -55, 1.08], // center of roundabout!
    [152, -72, 0.95],
    [152, -44, 0.92],
    [155, -26, 1.0],
    [192, -76, 1.02],
    [194, -52, 0.96],
    [192, -26, 0.94],
    [176, -80, 0.9],
    [184, -30, 1.04],
  ];
  for (const [px, pz, sc] of islandPalms) {
    palmPositions.push({ x: px, z: pz, rot: px * 0.5 + pz, scale: sc });
  }

  // --- Starfish Helipad ("H") on the NW Lawn (162, -74) ---
  const helipadPos = new THREE.Vector3(162, islandY + 0.08, -74);
  addBox(12.0, 0.12, 12.0, helipadPos.x, islandY + 0.04, helipadPos.z, roadMat, false, 'helipad');
  const hRing = new THREE.Mesh(
    new THREE.RingGeometry(4.3, 4.8, 28),
    new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 1.5, side: THREE.DoubleSide }),
  );
  hRing.rotation.x = -Math.PI / 2;
  hRing.position.set(helipadPos.x, islandY + 0.12, helipadPos.z);
  scene.add(hRing);

  const hBarL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 3.8), yellowPaintMat);
  hBarL.position.set(helipadPos.x - 1.2, islandY + 0.12, helipadPos.z);
  scene.add(hBarL);
  const hBarR = hBarL.clone();
  hBarR.position.x = helipadPos.x + 1.2;
  scene.add(hBarR);
  const hBarC = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.03, 0.5), yellowPaintMat);
  hBarC.position.set(helipadPos.x, islandY + 0.12, helipadPos.z);
  scene.add(hBarC);

  // --- Walk-In Cartel Mansion ("STARFISH ESTATE") on East Side of Island (cx = 185, cz = -55) ---
  const mX = 185;
  const mZ = -55;
  const mH = 5.4;
  // Marble foyer floor
  const mFloor = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 19.6), marbleMat);
  mFloor.rotation.x = -Math.PI / 2;
  mFloor.position.set(mX, islandY + 0.03, mZ);
  mFloor.receiveShadow = true;
  scene.add(mFloor);

  // Hollow Mansion Walls (open grand colonnade entrance facing West -X at z = -59..-51)
  addBox(0.55, mH, 20.0, mX + 7.8, islandY + mH / 2, mZ, stuccoMat); // east ocean-view back wall
  addBox(16.0, mH, 0.55, mX, islandY + mH / 2, mZ - 9.8, stuccoMat); // north wall
  addBox(16.0, mH, 0.55, mX, islandY + mH / 2, mZ + 9.8, stuccoMat); // south wall
  addBox(0.55, mH, 5.8, mX - 7.8, islandY + mH / 2, mZ - 7.0, stuccoMat); // west front N
  addBox(0.55, mH, 5.8, mX - 7.8, islandY + mH / 2, mZ + 7.0, stuccoMat); // west front S
  addBox(0.55, 1.5, 8.4, mX - 7.8, islandY + mH - 0.75, mZ, coralMat); // grand portico header
  addBox(16.6, 0.45, 20.6, mX, islandY + mH + 0.22, mZ, coralMat); // roof slab

  // 4 Grand White Columns flanking the mansion entrance
  for (const czOff of [-5.2, -2.4, 2.4, 5.2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, mH, 12), stuccoMat);
    col.position.set(mX - 8.6, islandY + mH / 2, mZ + czOff);
    col.castShadow = true;
    scene.add(col);
  }

  const estateTex = createNeonSignTexture('STARFISH ESTATE', '#ff4fa3');
  const estateSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.35, 6.8),
    new THREE.MeshStandardMaterial({
      map: estateTex,
      emissive: '#ffffff',
      emissiveMap: estateTex,
      emissiveIntensity: 1.75,
    }),
  );
  estateSign.position.set(mX - 8.2, islandY + mH - 0.65, mZ);
  scene.add(estateSign);

  // Mansion Interior: Gold Scarface Desk + Rotating Cartel Gold Vault Case (+$2,500!)
  const vaultPos = new THREE.Vector3(mX + 4.5, islandY, mZ);
  addBox(1.4, 0.95, 3.2, vaultPos.x, islandY + 0.48, vaultPos.z, coralMat);
  const vaultMesh = new THREE.Group();
  for (const oz of [-0.35, 0, 0.35]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), goldMat);
    bar.position.set(0, 0, oz);
    vaultMesh.add(bar);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), goldMat);
  topBar.position.set(0, 0.16, 0);
  vaultMesh.add(topBar);
  vaultMesh.position.set(vaultPos.x, islandY + 1.25, vaultPos.z);
  vaultMesh.userData.dynamic = true;
  scene.add(vaultMesh);
  let islandVaultAvailable = true;
  let islandVaultRespawn = 0;

  // ===========================================================================
  // 3) WOODEN MARINA GANGWAY + 44-METER LUXURY SUPERYACHT "LADY VICE" (z = -20 .. +38)
  // ===========================================================================
  const yachtX = 172;
  const yachtZ = 15; // spans roughly z: -7 .. +38 (45m overall length!)
  const mainDeckY = 1.4;
  const upperDeckY = 4.28;

  // Procedural Planked Honey-Teak Deck Texture
  const teakCanvas = document.createElement('canvas');
  teakCanvas.width = 128;
  teakCanvas.height = 128;
  const tCtx = teakCanvas.getContext('2d')!;
  tCtx.fillStyle = '#a8754c';
  tCtx.fillRect(0, 0, 128, 128);
  tCtx.fillStyle = '#52341e';
  for (let x = 0; x < 128; x += 16) {
    tCtx.fillRect(x, 0, 2, 128);
    tCtx.fillStyle = (x / 16) % 2 === 0 ? '#b37e54' : '#9c6b43';
    tCtx.fillRect(x + 2, 0, 14, 128);
    tCtx.fillStyle = '#52341e';
  }
  const teakTex = new THREE.CanvasTexture(teakCanvas);
  teakTex.colorSpace = THREE.SRGBColorSpace;
  teakTex.wrapS = THREE.RepeatWrapping;
  teakTex.wrapT = THREE.RepeatWrapping;
  teakTex.repeat.set(6, 18);
  const plankedTeakMat = new THREE.MeshStandardMaterial({ map: teakTex, roughness: 0.58 });

  const chromeRailMat = new THREE.MeshStandardMaterial({ color: '#dce4ee', roughness: 0.14, metalness: 0.92 });
  const navyBootMat = new THREE.MeshStandardMaterial({ color: '#142442', roughness: 0.35, metalness: 0.3 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: '#f7f2eb', roughness: 0.65 });
  const portholeMat = new THREE.MeshStandardMaterial({
    color: '#ffe8b8',
    emissive: '#ffbe66',
    emissiveIntensity: 1.35,
  });

  // Marina Pier & Gently Stepped Boarding Gangway connecting Island South Shore (z=-20, y=0.68) to Yacht Stern (z=-6.5, y=1.40)
  for (let s = 0; s < 4; s++) {
    const sy = islandY + (s + 1) * 0.18;
    addBox(3.6, sy + 0.4, 3.5, yachtX, (sy - 0.4) / 2, -18.2 + s * 3.4, teakMat, true, 'yacht-pier');
  }
  // Marina gangway chrome handrails
  for (const sx of [-1.72, 1.72]) {
    const gRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 13.5), chromeRailMat);
    gRail.position.set(yachtX + sx, 1.95, -13.0);
    gRail.rotation.x = -0.055;
    scene.add(gRail);
  }

  // --- Movable 44-Meter Superyacht Root Group ("LADY VICE") ---
  const yachtRoot = new THREE.Group();
  yachtRoot.position.set(yachtX, 0, yachtZ);
  yachtRoot.userData.dynamic = true;
  scene.add(yachtRoot);

  const yachtColliderEntries: { box: AABB; lx: number; ly: number; lz: number; w: number; h: number; d: number }[] = [];
  const addYachtBox = (
    w: number,
    h: number,
    d: number,
    lx: number,
    ly: number,
    lz: number,
    mat: THREE.Material,
    castShadow = true,
    tag = 'yacht',
    visible = true,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(lx, ly, lz);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    m.visible = visible;
    yachtRoot.add(m);
    const box: AABB = {
      minX: yachtX + lx - w / 2,
      maxX: yachtX + lx + w / 2,
      minY: ly - h / 2,
      maxY: ly + h / 2,
      minZ: yachtZ + lz - d / 2,
      maxZ: yachtZ + lz + d / 2,
      tag,
    };
    colliders.push(box);
    yachtColliderEntries.push({ box, lx, ly, lz, w, h, d });
    return m;
  };

  // --- Sculpted Multi-Part Marine Hull (Extruded Clipper Bow Profile!) ---
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-21.5, -0.45); // underwater stern keel
  hullShape.lineTo(15.5, -0.45);  // underwater forefoot
  hullShape.lineTo(22.8, 1.52);   // steeply raked luxury clipper bow stem!
  hullShape.lineTo(13.0, 1.44);   // sheer line mid-bow
  hullShape.lineTo(-20.8, 1.4);   // main deck stern sheer
  hullShape.lineTo(-22.2, 0.48);  // sloped transom down to swim platform
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 12.2,
    bevelEnabled: true,
    bevelThickness: 0.22,
    bevelSize: 0.18,
    bevelSegments: 3,
  });
  hullGeo.translate(0, 0, -6.1);
  hullGeo.rotateY(-Math.PI / 2);
  hullGeo.computeVertexNormals();
  const sculptedHull = new THREE.Mesh(hullGeo, yachtHullMat);
  sculptedHull.castShadow = true;
  sculptedHull.receiveShadow = true;
  yachtRoot.add(sculptedHull);

  // Solid walkable hull deck & bow colliders matching the sculpted hull
  addYachtBox(12.4, 1.85, 35.5, 0, 0.475, -2.5, yachtHullMat, false, 'yacht-hull', false);
  addYachtBox(8.6, 1.85, 9.5, 0, 0.475, 17.5, yachtHullMat, false, 'yacht-bow', false);

  // Aft Teak Swim Platform right at water level (local z = -22.2)
  addYachtBox(11.4, 0.26, 2.6, 0, 0.42, -22.2, plankedTeakMat, true, 'yacht-swim');

  // Deep Navy Waterline Bootstripe + Neon Cyan Chine Accent + Illuminated Hull Portholes!
  for (const sx of [-6.32, 6.32]) {
    const bootStripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 34.5), navyBootMat);
    bootStripe.position.set(sx, 0.28, -2.5);
    yachtRoot.add(bootStripe);

    const hullNeon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 35.2), cyanNeon);
    hullNeon.position.set(sx, 1.24, -2.0);
    yachtRoot.add(hullNeon);

    // 7 Warm Illuminated Circular Portholes per side
    for (let p = 0; p < 7; p++) {
      const pz = -14 + p * 4.2;
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), chromeRailMat);
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(sx, 0.82, pz);
      yachtRoot.add(bezel);
      const portGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), portholeMat);
      portGlass.rotation.z = Math.PI / 2;
      portGlass.position.set(sx, 0.82, pz);
      yachtRoot.add(portGlass);
    }

    // Chrome Bow Anchor mounted near the stem
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.36), chromeRailMat);
    anchor.position.set(sx * 0.72, 1.05, 18.2);
    anchor.rotation.x = 0.45;
    yachtRoot.add(anchor);
  }

  // Planked Honey-Teak Main Deck surface (y = 1.40m)
  const teakDeck = new THREE.Mesh(new THREE.BoxGeometry(12.1, 0.06, 37.5), plankedTeakMat);
  teakDeck.position.set(0, mainDeckY + 0.02, -1.5);
  teakDeck.receiveShadow = true;
  yachtRoot.add(teakDeck);

  // Stainless Steel Perimeter Deck Railings & Stanchions along Port, Starboard & Foredeck
  for (const sx of [-6.05, 6.05]) {
    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 35.0, 8), chromeRailMat);
    topRail.rotation.x = Math.PI / 2;
    topRail.position.set(sx, mainDeckY + 0.92, -1.5);
    yachtRoot.add(topRail);

    const midRail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 35.0, 6), chromeRailMat);
    midRail.rotation.x = Math.PI / 2;
    midRail.position.set(sx, mainDeckY + 0.5, -1.5);
    yachtRoot.add(midRail);

    for (let rz = -18.5; rz <= 15.5; rz += 3.4) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.92, 6), chromeRailMat);
      post.position.set(sx, mainDeckY + 0.46, rz);
      yachtRoot.add(post);
    }
  }

  // Aft Main Deck Lounge: U-Shaped Cream Leather Sofa & Teak Cocktail Table
  addYachtBox(4.8, 0.55, 0.95, 0, mainDeckY + 0.28, -18.4, cushionMat, true, 'yacht-sofa');
  addYachtBox(0.9, 0.55, 2.2, -2.1, mainDeckY + 0.28, -17.2, cushionMat, true, 'yacht-sofa');
  addYachtBox(0.9, 0.55, 2.2, 2.1, mainDeckY + 0.28, -17.2, cushionMat, true, 'yacht-sofa');
  addYachtBox(2.0, 0.48, 1.1, 0, mainDeckY + 0.24, -16.9, plankedTeakMat, true, 'yacht-table');

  // --- Sculpted Aerodynamic Main Salon Superstructure (Raked Front + Swept Mullions!) ---
  const salonShape = new THREE.Shape();
  salonShape.moveTo(-11.2, mainDeckY);
  salonShape.lineTo(7.4, mainDeckY);
  salonShape.lineTo(4.2, upperDeckY);   // sleek swept aerodynamic front salon slope!
  salonShape.lineTo(-10.6, upperDeckY); // upper deck overhang
  salonShape.closePath();

  const salonGeo = new THREE.ExtrudeGeometry(salonShape, {
    depth: 8.2,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  salonGeo.translate(0, 0, -4.1);
  salonGeo.rotateY(-Math.PI / 2);
  salonGeo.computeVertexNormals();
  const salonMesh = new THREE.Mesh(salonGeo, yachtHullMat);
  salonMesh.castShadow = true;
  salonMesh.receiveShadow = true;
  yachtRoot.add(salonMesh);

  // Solid collider for the main salon cabin (leaves 2.0m walkable side decks on Port & Starboard!)
  addYachtBox(8.2, 2.88, 16.8, 0, mainDeckY + 1.44, -2.4, yachtHullMat, false, 'yacht-cabin', false);

  // Wraparound Dark-Tinted Salon Windows + Raked Front Panoramic Glass + Diagonal White Superyacht Pillars
  for (const sx of [-4.18, 4.18]) {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.22, 13.8), yachtGlassMat);
    sideGlass.position.set(sx, mainDeckY + 1.58, -3.2);
    yachtRoot.add(sideGlass);

    // Swept 80s diagonal superstructure mullions
    for (const mz of [-7.5, -2.5, 2.2]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.36), yachtHullMat);
      mullion.position.set(sx * 1.01, mainDeckY + 1.58, mz);
      mullion.rotation.x = -0.45;
      yachtRoot.add(mullion);
    }
  }
  const frontSalonGlass = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.08, 3.6), yachtGlassMat);
  frontSalonGlass.position.set(0, mainDeckY + 1.56, 5.75);
  frontSalonGlass.rotation.x = 0.72;
  yachtRoot.add(frontSalonGlass);

  // Walkable Aft Staircase from Main Deck (y = 1.40) up to Upper Bridge & Helipad Deck (y = 4.28)
  const yachtStairGeos: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 12; s++) {
    const topY = mainDeckY + (s + 1) * 0.24;
    const sz = -15.0 + s * 0.36;
    const sh = topY - mainDeckY;
    const sy = (topY + mainDeckY) / 2;
    const sg = new THREE.BoxGeometry(2.4, sh, 0.4);
    sg.translate(0, sy, sz);
    yachtStairGeos.push(sg);
    const box: AABB = {
      minX: yachtX - 1.2,
      maxX: yachtX + 1.2,
      minY: sy - sh / 2,
      maxY: sy + sh / 2,
      minZ: yachtZ + sz - 0.2,
      maxZ: yachtZ + sz + 0.2,
      tag: 'yacht-stairs',
    };
    colliders.push(box);
    yachtColliderEntries.push({ box, lx: 0, ly: sy, lz: sz, w: 2.4, h: sh, d: 0.4 });
  }
  const yachtStairsMesh = new THREE.Mesh(mergeGeometries(yachtStairGeos), plankedTeakMat);
  yachtStairsMesh.castShadow = true;
  yachtStairsMesh.receiveShadow = true;
  yachtRoot.add(yachtStairsMesh);
  for (const sg of yachtStairGeos) sg.dispose();

  // --- Upper Flybridge, Raked Captain's Wheelhouse, Satcom Domes, Life Rafts & Helipad (y = 4.28m) ---
  addYachtBox(8.8, 0.24, 19.6, 0, upperDeckY - 0.12, -1.5, yachtHullMat, true, 'yacht-upper');
  const upperTeak = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 19.0), plankedTeakMat);
  upperTeak.rotation.x = -Math.PI / 2;
  upperTeak.position.set(0, upperDeckY + 0.01, -1.5);
  yachtRoot.add(upperTeak);

  // Upper deck perimeter safety rails
  for (const sx of [-4.3, 4.3]) {
    const uRail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 18.8, 6), chromeRailMat);
    uRail.rotation.x = Math.PI / 2;
    uRail.position.set(sx, upperDeckY + 0.85, -1.5);
    yachtRoot.add(uRail);

    // Cylindrical Emergency Life Raft Canisters mounted on upper deck sides
    const raft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.15, 12), yachtHullMat);
    raft.rotation.x = Math.PI / 2;
    raft.position.set(sx * 1.05, upperDeckY + 0.35, 1.5);
    yachtRoot.add(raft);
  }

  // Sculpted Raked Captain's Wheelhouse / Flybridge (local z = +3.2 .. +8.0)
  const bridgeShape = new THREE.Shape();
  bridgeShape.moveTo(2.8, upperDeckY);
  bridgeShape.lineTo(8.0, upperDeckY);
  bridgeShape.lineTo(5.8, upperDeckY + 2.15);
  bridgeShape.lineTo(2.4, upperDeckY + 2.15);
  bridgeShape.closePath();
  const bridgeGeo = new THREE.ExtrudeGeometry(bridgeShape, { depth: 6.8, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  bridgeGeo.translate(0, 0, -3.4);
  bridgeGeo.rotateY(-Math.PI / 2);
  bridgeGeo.computeVertexNormals();
  const bridgeMesh = new THREE.Mesh(bridgeGeo, yachtHullMat);
  bridgeMesh.castShadow = true;
  yachtRoot.add(bridgeMesh);
  addYachtBox(6.8, 2.15, 4.8, 0, upperDeckY + 1.07, 5.2, yachtHullMat, false, 'yacht-bridge', false);

  const bridgeWindshield = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.08, 2.5), yachtGlassMat);
  bridgeWindshield.position.set(0, upperDeckY + 1.25, 6.95);
  bridgeWindshield.rotation.x = 0.78;
  yachtRoot.add(bridgeWindshield);

  // Exterior Captain's Helm Console & Ship's Wheel on Upper Bridge Deck (press [E] to pilot!)
  const helmConsole = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.05, 0.65), navyBootMat);
  helmConsole.position.set(0, upperDeckY + 0.525, 2.35);
  yachtRoot.add(helmConsole);
  const helmWheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 8, 18), goldMat);
  helmWheel.position.set(0, upperDeckY + 1.06, 2.02);
  helmWheel.rotation.x = -0.35;
  yachtRoot.add(helmWheel);
  const helmTrim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 0.08), cyanNeon);
  helmTrim.position.set(0, upperDeckY + 1.04, 2.05);
  yachtRoot.add(helmTrim);

  // Port (Red) & Starboard (Green) Marine Navigation Lights
  const portLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff1a3a', emissiveIntensity: 2.6 }),
  );
  portLight.position.set(3.55, upperDeckY + 1.9, 5.2);
  yachtRoot.add(portLight);
  const stbdLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#22ff66', emissive: '#18ee55', emissiveIntensity: 2.6 }),
  );
  stbdLight.position.set(-3.55, upperDeckY + 1.9, 5.2);
  yachtRoot.add(stbdLight);

  // Swept 80s Radar Arch + Twin Satcom Radomes + Communications Mast + Spinning Radar Bar!
  for (const sx of [-3.3, 3.3]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 0.85), yachtHullMat);
    pylon.position.set(sx, upperDeckY + 2.1, 3.2);
    pylon.rotation.x = -0.22;
    yachtRoot.add(pylon);
  }
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.32, 1.1), yachtHullMat);
  archTop.position.set(0, upperDeckY + 3.38, 2.9);
  yachtRoot.add(archTop);

  // Twin Spherical Satcom Domes flanking the radar scanner
  for (const sx of [-2.1, 2.1]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), yachtHullMat);
    dome.position.set(sx, upperDeckY + 3.82, 2.9);
    yachtRoot.add(dome);
  }

  // Tall Tapered Marine Mast + Spinning Open-Array Radar Scanner
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 2.4, 8), chromeRailMat);
  mast.position.set(0, upperDeckY + 4.6, 2.7);
  yachtRoot.add(mast);

  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.15, 0.22), yachtHullMat);
  radarBar.position.set(0, upperDeckY + 3.85, 3.15);
  yachtRoot.add(radarBar);

  // Glowing "LADY VICE" Neon Nameplates on both Port & Starboard Superstructure!
  const yachtSignTex = createNeonSignTexture('LADY VICE', '#36f1e6');
  const yachtSignMat = new THREE.MeshStandardMaterial({
    map: yachtSignTex,
    emissive: '#ffffff',
    emissiveMap: yachtSignTex,
    emissiveIntensity: 1.65,
  });
  for (const sx of [-4.48, 4.48]) {
    const yachtSign = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.82, 4.6), yachtSignMat);
    yachtSign.position.set(sx, upperDeckY + 0.08, -2.0);
    if (sx > 0) yachtSign.rotation.y = Math.PI;
    yachtRoot.add(yachtSign);
  }

  // Upper Deck Aft Helipad Ring + "H" Marking
  const yachtHeliRing = new THREE.Mesh(
    new THREE.RingGeometry(2.9, 3.3, 28),
    new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 1.4, side: THREE.DoubleSide }),
  );
  yachtHeliRing.rotation.x = -Math.PI / 2;
  yachtHeliRing.position.set(0, upperDeckY + 0.03, -5.8);
  yachtRoot.add(yachtHeliRing);

  const yhL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 2.2), yellowPaintMat);
  yhL.position.set(-0.75, upperDeckY + 0.03, -5.8);
  yachtRoot.add(yhL);
  const yhR = yhL.clone();
  yhR.position.x = 0.75;
  yachtRoot.add(yhR);
  const yhC = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.32), yellowPaintMat);
  yhC.position.set(0, upperDeckY + 0.03, -5.8);
  yachtRoot.add(yhC);

  // Foredeck Turquoise Jacuzzi Pool & Twin Luxury Sunbeds
  addYachtBox(3.6, 0.65, 3.6, 0, mainDeckY + 0.32, 11.2, yachtHullMat, false, 'yacht-jacuzzi');
  const jacuzziWater = new THREE.Mesh(
    new THREE.PlaneGeometry(3.05, 3.05),
    new THREE.MeshStandardMaterial({ color: '#24d2e6', emissive: '#0c5c6b', emissiveIntensity: 0.28, roughness: 0.08 }),
  );
  jacuzziWater.rotation.x = -Math.PI / 2;
  jacuzziWater.position.set(0, mainDeckY + 0.66, 11.2);
  yachtRoot.add(jacuzziWater);

  for (const sx of [-1.45, 1.45]) {
    const sunbed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 2.8), cushionMat);
    sunbed.position.set(sx, mainDeckY + 0.18, 15.2);
    sunbed.castShadow = true;
    yachtRoot.add(sunbed);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.45), coralMat);
    pillow.position.set(sx, mainDeckY + 0.36, 14.05);
    yachtRoot.add(pillow);
  }

  // Captain's Gold Stash on the Upper Bridge Deck (+$1,800!)
  const yachtLootLocal = new THREE.Vector3(0, upperDeckY, 0.6);
  addYachtBox(1.1, 0.85, 0.9, yachtLootLocal.x, upperDeckY + 0.42, yachtLootLocal.z, plankedTeakMat);
  const yachtLootMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), goldMat);
  yachtLootMesh.position.set(yachtLootLocal.x, upperDeckY + 1.18, yachtLootLocal.z);
  yachtRoot.add(yachtLootMesh);
  let yachtLootAvailable = true;
  let yachtLootRespawn = 0;

  let curYachtX = yachtX;
  let curYachtY = 0;
  let curYachtZ = yachtZ;
  let curYachtYaw = 0;

  const syncYachtColliders = (x: number, y: number, z: number, yaw: number): void => {
    curYachtX = x;
    curYachtY = y;
    curYachtZ = z;
    curYachtYaw = yaw;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const absC = Math.abs(cos);
    const absS = Math.abs(sin);
    for (const e of yachtColliderEntries) {
      const wx = x + e.lx * cos + e.lz * sin;
      const wz = z - e.lx * sin + e.lz * cos;
      const halfX = (e.w * 0.5) * absC + (e.d * 0.5) * absS;
      const halfZ = (e.w * 0.5) * absS + (e.d * 0.5) * absC;
      e.box.minX = wx - halfX;
      e.box.maxX = wx + halfX;
      e.box.minY = y + e.ly - e.h * 0.5;
      e.box.maxY = y + e.ly + e.h * 0.5;
      e.box.minZ = wz - halfZ;
      e.box.maxZ = wz + halfZ;
    }
  };

  const getYachtWorldPos = (localOffset: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 => {
    const cos = Math.cos(curYachtYaw);
    const sin = Math.sin(curYachtYaw);
    return out.set(
      curYachtX + localOffset.x * cos + localOffset.z * sin,
      curYachtY + localOffset.y,
      curYachtZ - localOffset.x * sin + localOffset.z * cos,
    );
  };

  const yachtLootScratch = new THREE.Vector3();

  const yachtHandle: SuperyachtHandle = {
    group: yachtRoot,
    initialPos: new THREE.Vector3(yachtX, 0, yachtZ),
    upperDeckY,
    syncColliders: syncYachtColliders,
    getWorldPos: getYachtWorldPos,
    isPlayerOnOrNearYacht: (pos: THREE.Vector3) => {
      // Transform player position into yacht local coordinates
      const dx = pos.x - curYachtX;
      const dz = pos.z - curYachtZ;
      const cos = Math.cos(-curYachtYaw);
      const sin = Math.sin(-curYachtYaw);
      const lx = dx * cos + dz * sin;
      const lz = -dx * sin + dz * cos;
      return Math.abs(lx) < 8.5 && lz > -24.5 && lz < 24.5 && pos.y > -2.0 && pos.y < upperDeckY + 4.5;
    },
  };

  return {
    helipadSpawn: new THREE.Vector3(helipadPos.x, islandY + 0.12, helipadPos.z),
    yacht: yachtHandle,
    getGroundHeight: (x: number, z: number) => {
      // On Causeway Bridge roadway
      if (x >= bridgeStartX && x <= bridgeEndX && Math.abs(z - bridgeZ) <= bridgeW / 2 + 0.2) {
        return getCausewayY(x);
      }
      // On Starfish Island main platform
      if (
        x >= islCX - islW / 2 - 1.5 &&
        x <= islCX + islW / 2 + 1.5 &&
        z >= islCZ - islD / 2 - 1.5 &&
        z <= islCZ + islD / 2 + 1.5
      ) {
        return islandY;
      }
      return null;
    },
    isNearIslandVault: (pos: THREE.Vector3) =>
      islandVaultAvailable && Math.hypot(pos.x - vaultPos.x, pos.z - vaultPos.z) < 2.5 && Math.abs(pos.y - islandY) < 2.4,
    isNearYachtLoot: (pos: THREE.Vector3) => {
      if (!yachtLootAvailable) return false;
      getYachtWorldPos(yachtLootLocal, yachtLootScratch);
      return (
        Math.hypot(pos.x - yachtLootScratch.x, pos.z - yachtLootScratch.z) < 2.4 &&
        Math.abs(pos.y - yachtLootScratch.y) < 2.4
      );
    },
    takeIslandVault: () => {
      islandVaultAvailable = false;
      vaultMesh.visible = false;
      islandVaultRespawn = 60.0;
    },
    takeYachtLoot: () => {
      yachtLootAvailable = false;
      yachtLootMesh.visible = false;
      yachtLootRespawn = 60.0;
    },
    update: (elapsed: number, dt: number, playerPos?: THREE.Vector3) => {
      const clampedDt = Math.min(dt, 0.05);
      const nearYacht =
        !playerPos || (playerPos.x - curYachtX) ** 2 + (playerPos.z - curYachtZ) ** 2 < 160 * 160;
      const nearIsland =
        !playerPos || (playerPos.x - vaultPos.x) ** 2 + (playerPos.z - vaultPos.z) ** 2 < 140 * 140;

      if (nearYacht) {
        radarBar.rotation.y = elapsed * 2.4;
      }

      if (!islandVaultAvailable) {
        islandVaultRespawn -= clampedDt;
        if (islandVaultRespawn <= 0) {
          islandVaultAvailable = true;
          vaultMesh.visible = true;
        }
      } else if (nearIsland) {
        vaultMesh.rotation.y = elapsed * 1.6;
        vaultMesh.position.y = islandY + 1.25 + Math.sin(elapsed * 2.8) * 0.06;
      }

      if (!yachtLootAvailable) {
        yachtLootRespawn -= clampedDt;
        if (yachtLootRespawn <= 0) {
          yachtLootAvailable = true;
          yachtLootMesh.visible = true;
        }
      } else if (nearYacht) {
        yachtLootMesh.rotation.y = -elapsed * 1.8;
        yachtLootMesh.position.y = upperDeckY + 1.18 + Math.sin(elapsed * 3.1) * 0.07;
      }
    },
  };
}
