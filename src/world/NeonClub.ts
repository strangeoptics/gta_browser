import * as THREE from 'three';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';
import { buildLowPolyCharacter, type CharacterHairStyle } from '../entities/CharacterBuilder';

export interface NeonClubHandle {
  isInside: (pos: THREE.Vector3) => boolean;
  isNearBar: (pos: THREE.Vector3) => boolean;
  getProximity: (pos: THREE.Vector3) => number; // 0 = far, 0.35 = outside door, 1.0 = inside club
  update: (elapsed: number, playerPos?: THREE.Vector3) => void;
}

/**
 * Builds the elaborate walk-in 80s Miami NEON CLUB at Ocean Drive (x = 40, z = 0):
 * - Rotating mirror Disco Ball + 4 sweeping volumetric Effect-Spotlights (additive cones)
 * - Full Neon Bar with animated Bartender, backlit bottle shelves, cocktail glasses & barstools
 * - DJ Booth with animated DJ (glowing headphones), spinning turntables & bass-pulsing Speaker Towers
 * - VIP Velvet Lounge sofas, 5 animated dancers on a pulsing 6x5 LED dancefloor & velvet rope entrance
 */
export function buildNeonClub(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
): NeonClubHandle {
  const clubX = 54;
  const clubZ = 0;
  const clubW = 18; // x: 31 .. 49
  const clubD = 16; // z: -8 .. +8
  const clubH = 6.4;
  const wallT = 0.6;

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    tag = 'club',
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    worldMeshes.push(mesh);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y - h / 2,
      maxY: y + h / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag,
    });
    return mesh;
  };

  const wallMat = new THREE.MeshStandardMaterial({ color: '#1b0f2a', roughness: 0.5, metalness: 0.28 });
  const darkFloorMat = new THREE.MeshStandardMaterial({ color: '#120a1c', roughness: 0.18, metalness: 0.35 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.6 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.6 });
  const violetNeon = new THREE.MeshStandardMaterial({ color: '#a86bff', emissive: '#a86bff', emissiveIntensity: 2.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.85, roughness: 0.2 });

  // ---------------------------------------------------------------------------
  // 1) Hollow Structure + Open Ocean Drive Entrance (+X)
  // ---------------------------------------------------------------------------
  // Glossy dark club floor
  const clubFloor = new THREE.Mesh(new THREE.PlaneGeometry(clubW, clubD), darkFloorMat);
  clubFloor.rotation.x = -Math.PI / 2;
  clubFloor.position.set(clubX, 0.2, clubZ);
  clubFloor.receiveShadow = true;
  scene.add(clubFloor);

  // Back (-X), North (-Z), South (+Z) walls
  addBox(wallT, clubH, clubD, clubX - clubW / 2, 0.18 + clubH / 2, clubZ, wallMat, true, 'club-wall');
  addBox(clubW, clubH, wallT, clubX, 0.18 + clubH / 2, clubZ - clubD / 2, wallMat, true, 'club-wall');
  addBox(clubW, clubH, wallT, clubX, 0.18 + clubH / 2, clubZ + clubD / 2, wallMat, true, 'club-wall');

  // Front (+X) wall with 4.8m wide open entrance
  const sideSpan = (clubD - 4.8) / 2;
  addBox(wallT, clubH, sideSpan, clubX + clubW / 2, 0.18 + clubH / 2, clubZ - (2.4 + sideSpan / 2), wallMat, true, 'club-wall');
  addBox(wallT, clubH, sideSpan, clubX + clubW / 2, 0.18 + clubH / 2, clubZ + (2.4 + sideSpan / 2), wallMat, true, 'club-wall');
  addBox(wallT, clubH - 3.5, 4.8, clubX + clubW / 2, 0.18 + 3.5 + (clubH - 3.5) / 2, clubZ, wallMat, true, 'club-wall');

  // Roof slab (provides cover from Police Chopper)
  addBox(clubW + 0.6, 0.5, clubD + 0.6, clubX, 0.18 + clubH + 0.25, clubZ, wallMat, true, 'club-roof');

  // Exterior NEON CLUB Marquee + Velvet Rope Entrance Stanchions
  const signTex = createNeonSignTexture('NEON CLUB', '#ff4fa3');
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: '#ffffff',
    emissiveMap: signTex,
    emissiveIntensity: 2.1,
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.55, 0.25), signMat);
  sign.rotation.y = Math.PI / 2;
  sign.position.set(clubX + clubW / 2 + 0.45, 0.18 + 4.9, clubZ);
  scene.add(sign);

  const extRoofTrim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, clubD + 0.2), cyanNeon);
  extRoofTrim.position.set(clubX + clubW / 2 + 0.35, 0.18 + clubH + 0.1, clubZ);
  scene.add(extRoofTrim);

  // Velvet carpet & gold stanchions flanking the entrance
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.6),
    new THREE.MeshStandardMaterial({ color: '#a8194b', roughness: 0.85 }),
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(clubX + clubW / 2 + 1.2, 0.205, clubZ);
  scene.add(carpet);

  for (const side of [-2.0, 2.0]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.0, 8), goldMat);
    post.position.set(clubX + clubW / 2 + 1.8, 0.7, clubZ + side);
    scene.add(post);
  }

  // Interior horizontal neon wall strips
  const wallStripN = new THREE.Mesh(new THREE.BoxGeometry(clubW - 1, 0.1, 0.08), violetNeon);
  wallStripN.position.set(clubX, 3.6, clubZ - clubD / 2 + 0.35);
  scene.add(wallStripN);
  const wallStripS = new THREE.Mesh(new THREE.BoxGeometry(clubW - 1, 0.1, 0.08), pinkNeon);
  wallStripS.position.set(clubX, 3.6, clubZ + clubD / 2 - 0.35);
  scene.add(wallStripS);

  // ---------------------------------------------------------------------------
  // 2) Rotating Mirror Disco Ball & 4 Volumetric Sweeping Effect Spotlights
  // ---------------------------------------------------------------------------
  const discoGroup = new THREE.Group();
  discoGroup.userData.dynamic = true;
  discoGroup.position.set(clubX + 1.0, 5.15, clubZ + 0.2);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.9, roughness: 0.2 }),
  );
  rod.position.y = 0.65;
  discoGroup.add(rod);

  const discoCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.68, 2),
    new THREE.MeshStandardMaterial({
      color: '#e8f4ff',
      emissive: '#4d3a75',
      emissiveIntensity: 0.6,
      metalness: 0.96,
      roughness: 0.06,
      flatShading: true,
    }),
  );
  discoGroup.add(discoCore);

  // Sparkling mirror tiles around the disco ball (single InstancedMesh -> 1 draw call!)
  const sparkleColors = ['#ffffff', '#36f1e6', '#ff4fa3', '#ffd15c'];
  const tileGeo = new THREE.BoxGeometry(0.11, 0.11, 0.04);
  const discoTileInst = new THREE.InstancedMesh(
    tileGeo,
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    28,
  );
  const tileDummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  for (let i = 0; i < 28; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 28);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    tileDummy.position.set(
      Math.sin(phi) * Math.cos(theta) * 0.7,
      Math.cos(phi) * 0.7,
      Math.sin(phi) * Math.sin(theta) * 0.7,
    );
    tileDummy.lookAt(0, 0, 0);
    tileDummy.updateMatrix();
    discoTileInst.setMatrixAt(i, tileDummy.matrix);
    discoTileInst.setColorAt(i, tmpColor.set(sparkleColors[i % sparkleColors.length]));
  }
  discoTileInst.instanceMatrix.needsUpdate = true;
  if (discoTileInst.instanceColor) discoTileInst.instanceColor.needsUpdate = true;
  discoGroup.add(discoTileInst);
  scene.add(discoGroup);

  // 4 Sweeping Volumetric Effect-Spotlight Cones aimed inward onto the dancefloor
  // Pivots sit well inside the ceiling; cone length (6.6m) reaches cleanly down onto the floor (y = 0.22)
  // while inward tilt keeps every beam far away from outer walls!
  const beamConfigs: { x: number; z: number; baseRx: number; baseRz: number; color: string; phase: number }[] = [
    { x: clubX - 2.4, z: clubZ - 3.4, baseRx: 0.28, baseRz: 0.26, color: '#ff4fa3', phase: 0 },
    { x: clubX + 4.2, z: clubZ - 3.4, baseRx: 0.28, baseRz: -0.26, color: '#36f1e6', phase: 1.5 },
    { x: clubX - 2.4, z: clubZ + 3.4, baseRx: -0.28, baseRz: 0.26, color: '#a86bff', phase: 3.1 },
    { x: clubX + 4.2, z: clubZ + 3.4, baseRx: -0.28, baseRz: -0.26, color: '#ffd15c', phase: 4.7 },
  ];
  const effectBeams: {
    pivot: THREE.Group;
    floorPool: THREE.Mesh;
    baseRx: number;
    baseRz: number;
    phase: number;
  }[] = [];
  const beamConeGeo = new THREE.ConeGeometry(1.1, 6.6, 16, 1, true);
  beamConeGeo.translate(0, -3.3, 0); // apex at pivot -> reaches all the way to the dancefloor!
  const poolGeo = new THREE.CircleGeometry(1.15, 16);

  for (const cfg of beamConfigs) {
    const pivot = new THREE.Group();
    pivot.userData.dynamic = true;
    pivot.position.set(cfg.x, 5.95, cfg.z);

    // Lamp housing fixture
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.32, 8),
      new THREE.MeshStandardMaterial({ color: '#1b1824', metalness: 0.7, roughness: 0.3 }),
    );
    pivot.add(lamp);

    const beamMat = new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(beamConeGeo, beamMat);
    pivot.add(cone);

    // Matching glowing light pool on the dancefloor where the cone lands
    const floorPool = new THREE.Mesh(
      poolGeo,
      new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    floorPool.rotation.x = -Math.PI / 2;
    floorPool.position.set(cfg.x, 0.255, cfg.z);
    floorPool.userData.dynamic = true;
    scene.add(floorPool);

    scene.add(pivot);
    effectBeams.push({ pivot, floorPool, baseRx: cfg.baseRx, baseRz: cfg.baseRz, phase: cfg.phase });
  }

  // Orbiting dynamic club point lights
  const clubLightPink = new THREE.PointLight('#ff4fa3', 38, 24, 1.5);
  clubLightPink.userData.dynamic = true;
  scene.add(clubLightPink);
  const clubLightCyan = new THREE.PointLight('#36f1e6', 38, 24, 1.5);
  clubLightCyan.userData.dynamic = true;
  scene.add(clubLightCyan);

  // ---------------------------------------------------------------------------
  // 3) Pulsing 6x5 LED Dancefloor (2 InstancedMeshes -> 2 draw calls instead of 30!)
  // ---------------------------------------------------------------------------
  const floorTileGeo = new THREE.BoxGeometry(1.52, 0.05, 1.52);
  const pinkTileMat = new THREE.MeshStandardMaterial({
    color: '#ff4fa3',
    emissive: '#ff4fa3',
    emissiveIntensity: 1.1,
    roughness: 0.12,
  });
  const cyanTileMat = new THREE.MeshStandardMaterial({
    color: '#36f1e6',
    emissive: '#36f1e6',
    emissiveIntensity: 1.1,
    roughness: 0.12,
  });
  const pinkTileInst = new THREE.InstancedMesh(floorTileGeo, pinkTileMat, 15);
  const cyanTileInst = new THREE.InstancedMesh(floorTileGeo, cyanTileMat, 15);
  let pinkIdx = 0;
  let cyanIdx = 0;
  tileDummy.rotation.set(0, 0, 0);
  tileDummy.scale.set(1, 1, 1);
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      const isPink = (gx + gz) % 2 === 0;
      tileDummy.position.set(clubX - 1.5 + gx * 1.6, 0.22, clubZ - 2.6 + gz * 1.6);
      tileDummy.updateMatrix();
      if (isPink) pinkTileInst.setMatrixAt(pinkIdx++, tileDummy.matrix);
      else cyanTileInst.setMatrixAt(cyanIdx++, tileDummy.matrix);
    }
  }
  pinkTileInst.instanceMatrix.needsUpdate = true;
  cyanTileInst.instanceMatrix.needsUpdate = true;
  pinkTileInst.matrixAutoUpdate = false;
  cyanTileInst.matrixAutoUpdate = false;
  scene.add(pinkTileInst, cyanTileInst);

  // ---------------------------------------------------------------------------
  // 4) Elaborate Bar Counter, Backlit Bottle Wall, Barstools & Animated Bartender
  // ---------------------------------------------------------------------------
  const barX = clubX - 5.8;
  const barMat = new THREE.MeshStandardMaterial({ color: '#1b1029', roughness: 0.22, metalness: 0.5 });
  addBox(1.2, 1.16, 9.2, barX, 0.18 + 0.58, clubZ, barMat, true, 'prop');
  const barTrimMat = new THREE.MeshStandardMaterial({
    color: '#ff4fa3',
    emissive: '#ff3d96',
    emissiveIntensity: 0.55,
    roughness: 0.25,
  });
  const barTrim = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.08, 9.3), barTrimMat);
  barTrim.position.set(barX, 0.18 + 1.18, clubZ);
  scene.add(barTrim);

  // 3 Glowing Miami Vice Cocktail Glasses sitting on the bar counter
  const cocktailColors = ['#ff4fa3', '#36f1e6', '#ff9f43'];
  cocktailColors.forEach((col, i) => {
    const cz = clubZ - 1.6 + i * 1.6;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.05, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.14 }),
    );
    glass.position.set(barX + 0.15, 0.18 + 1.32, cz);
    scene.add(glass);
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
    );
    straw.position.set(barX + 0.18, 0.18 + 1.46, cz);
    straw.rotation.z = -0.25;
    scene.add(straw);
  });

  // 5 Chrome Barstools in front of the bar
  const stoolTopMat = new THREE.MeshStandardMaterial({ color: '#ff4fa3', roughness: 0.4 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#d8e0eb', metalness: 0.9, roughness: 0.15 });
  for (let sz = -3.6; sz <= 3.6; sz += 1.8) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 0.72, 8), chromeMat);
    leg.position.set(barX + 1.1, 0.56, clubZ + sz);
    scene.add(leg);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.1, 12), stoolTopMat);
    seat.position.set(barX + 1.1, 0.96, clubZ + sz);
    scene.add(seat);
  }

  // Backlit neon bottle wall along the back wall (single InstancedMesh -> 1 draw call instead of 36!)
  const shelfBacklitMat = new THREE.MeshStandardMaterial({
    color: '#2ad4cc',
    emissive: '#1ea8a2',
    emissiveIntensity: 0.42,
    roughness: 0.25,
  });
  const bottleColors = ['#36f1e6', '#ff4fa3', '#ffd15c', '#52f29c', '#a86bff'];
  const bottleGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.34, 6);
  const bottlePlacements: { y: number; z: number; col: string }[] = [];
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = 1.35 + shelf * 0.72;
    const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 8.0), shelfBacklitMat);
    shelfBoard.position.set(clubX - 8.35, sy, clubZ);
    scene.add(shelfBoard);
    for (let bz = -3.4; bz <= 3.4; bz += 0.62) {
      const col = bottleColors[Math.abs(Math.round(bz * 10) + shelf) % bottleColors.length];
      bottlePlacements.push({ y: sy + 0.2, z: clubZ + bz, col });
    }
  }
  const bottleInst = new THREE.InstancedMesh(
    bottleGeo,
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18, metalness: 0.15 }),
    bottlePlacements.length,
  );
  bottlePlacements.forEach((bp, idx) => {
    tileDummy.position.set(clubX - 8.32, bp.y, bp.z);
    tileDummy.rotation.set(0, 0, 0);
    tileDummy.updateMatrix();
    bottleInst.setMatrixAt(idx, tileDummy.matrix);
    bottleInst.setColorAt(idx, tmpColor.set(bp.col));
  });
  bottleInst.instanceMatrix.needsUpdate = true;
  if (bottleInst.instanceColor) bottleInst.instanceColor.needsUpdate = true;
  scene.add(bottleInst);

  // Animated Bartender behind the bar (black vest, white shirt, bow tie, sunglasses!)
  const bartender = createClubCharacter('#ffffff', '#191522', true);
  bartender.group.userData.dynamic = true;
  bartender.group.position.set(barX - 1.15, 0.2, clubZ + 0.4);
  bartender.group.rotation.y = Math.PI / 2; // faces east toward customers
  scene.add(bartender.group);

  // ---------------------------------------------------------------------------
  // 5) DJ Booth, Animated DJ with Glowing Headphones & Bass-Pulsing Speaker Towers
  // ---------------------------------------------------------------------------
  const djZ = clubZ - 6.3;
  addBox(4.8, 1.32, 1.7, clubX + 1.0, 0.18 + 0.66, djZ, barMat, true, 'prop');
  const djTrim = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.1, 1.8), cyanNeon);
  djTrim.position.set(clubX + 1.0, 0.18 + 1.34, djZ);
  scene.add(djTrim);

  // Spinning glowing turntables on the DJ deck
  const turntables: THREE.Mesh[] = [];
  for (const dx of [-0.9, 0.9]) {
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: '#111118', emissive: '#36f1e6', emissiveIntensity: 0.5 }),
    );
    deck.position.set(clubX + 1.0 + dx, 0.18 + 1.4, djZ);
    deck.userData.dynamic = true;
    scene.add(deck);
    turntables.push(deck);
  }

  // Animated DJ behind the booth
  const dj = createClubCharacter('#ff4fa3', '#1d182b', true);
  dj.group.userData.dynamic = true;
  dj.group.position.set(clubX + 1.0, 0.2, djZ - 0.85);
  dj.group.rotation.y = 0; // faces south toward dancefloor
  // Glowing cyan DJ headphones
  const hpBand = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 12, Math.PI), cyanNeon);
  hpBand.position.set(0, 1.72, 0);
  dj.group.add(hpBand);
  scene.add(dj.group);

  // Flanking Subwoofer Speaker Towers (woofer cones physically pulse to the bass!)
  const woofers: THREE.Mesh[] = [];
  for (const side of [-3.5, 3.5]) {
    addBox(1.5, 3.2, 1.4, clubX + 1.0 + side, 0.18 + 1.6, djZ, wallMat, true, 'prop');
    for (const wy of [1.1, 2.3]) {
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.34, 0.14, 14),
        new THREE.MeshStandardMaterial({ color: '#2b2436', emissive: '#ff4fa3', emissiveIntensity: 0.45 }),
      );
      cone.rotation.x = Math.PI / 2;
      cone.position.set(clubX + 1.0 + side, wy, djZ + 0.72);
      cone.userData.dynamic = true;
      scene.add(cone);
      woofers.push(cone);
    }
  }

  // VIP Velvet Lounge Sofas along the south wall (+Z)
  const velvetMat = new THREE.MeshStandardMaterial({ color: '#5c1854', roughness: 0.8 });
  addBox(6.2, 0.85, 1.3, clubX + 1.5, 0.18 + 0.425, clubZ + 6.7, velvetMat, true, 'prop');
  const vipTable = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.0), violetNeon);
  vipTable.position.set(clubX + 1.5, 0.72, clubZ + 5.1);
  scene.add(vipTable);

  // ---------------------------------------------------------------------------
  // 6) 5 Animated Club Dancers on the LED Dancefloor
  // ---------------------------------------------------------------------------
  const dancers: { char: ClubCharacter; baseY: number; phase: number }[] = [];
  const dancerDefs: [number, number, string][] = [
    [clubX + 0.2, clubZ - 1.2, '#ff7eb3'],
    [clubX + 2.8, clubZ + 1.2, '#36f1e6'],
    [clubX - 1.2, clubZ + 1.6, '#ffd15c'],
    [clubX + 3.6, clubZ - 1.6, '#8de4d3'],
    [clubX + 1.2, clubZ + 2.4, '#b388ff'],
  ];
  dancerDefs.forEach(([dx, dz, col], idx) => {
    const ch = createClubCharacter(col, '#211930', idx % 2 === 0);
    ch.group.userData.dynamic = true;
    ch.group.position.set(dx, 0.24, dz);
    scene.add(ch.group);
    dancers.push({ char: ch, baseY: 0.24, phase: idx * 1.4 });
    colliders.push({
      minX: dx - 0.34,
      maxX: dx + 0.34,
      minY: 0.2,
      maxY: 2.0,
      minZ: dz - 0.34,
      maxZ: dz + 0.34,
      tag: 'club-dancer',
    });
  });

  // 126 BPM = 2.1 beats per second -> beat angular speed = 2.1 * 2 * PI
  const beatRadPerSec = 2.1 * Math.PI * 2;

  return {
    isInside: (pos: THREE.Vector3) =>
      pos.x > clubX - clubW / 2 &&
      pos.x < clubX + clubW / 2 &&
      pos.z > clubZ - clubD / 2 &&
      pos.z < clubZ + clubD / 2 &&
      pos.y < clubH,
    isNearBar: (pos: THREE.Vector3) =>
      pos.x > barX - 0.5 &&
      pos.x < barX + 4.2 &&
      Math.abs(pos.z - clubZ) < 5.2 &&
      pos.y < 2.4,
    getProximity: (pos: THREE.Vector3) => {
      if (
        pos.x > clubX - clubW / 2 &&
        pos.x < clubX + clubW / 2 &&
        pos.z > clubZ - clubD / 2 &&
        pos.z < clubZ + clubD / 2 &&
        pos.y < clubH
      ) {
        return 1.0;
      }
      // Smooth falloff outside the Ocean Drive entrance (x = 49, z = 0)
      const distDoor = Math.hypot(pos.x - (clubX + clubW / 2), pos.z - clubZ);
      return THREE.MathUtils.clamp(1 - distDoor / 22, 0, 0.45);
    },
    update: (elapsed: number, playerPos?: THREE.Vector3) => {
      // Modulate intensity (NEVER light.visible!) to avoid WebGL shader recompilation stalls
      const distSq = playerPos ? (playerPos.x - clubX) ** 2 + (playerPos.z - clubZ) ** 2 : 0;
      const nearClub = distSq < 42 * 42;
      if (!nearClub) {
        clubLightPink.intensity = 0;
        clubLightCyan.intensity = 0;
        return;
      }
      const beatPulse = Math.pow(0.5 + 0.5 * Math.sin(elapsed * beatRadPerSec), 3);

      // Rotate mirror Disco Ball
      discoGroup.rotation.y = elapsed * 0.95;

      // Sweep the 4 volumetric Effect-Spotlights inward across the dancefloor + track floor pools
      const dropH = 5.7;
      for (const b of effectBeams) {
        const rx = b.baseRx + Math.sin(elapsed * 1.15 + b.phase) * 0.18;
        const rz = b.baseRz + Math.cos(elapsed * 0.9 + b.phase) * 0.18;
        b.pivot.rotation.x = rx;
        b.pivot.rotation.z = rz;
        // Project cone axis (0, -1, 0) onto the dancefloor plane (y = 0.255)
        b.floorPool.position.x = b.pivot.position.x + Math.sin(rz) * dropH;
        b.floorPool.position.z = b.pivot.position.z - Math.sin(rx) * dropH;
      }

      // Orbiting disco lights
      clubLightPink.position.set(clubX + Math.cos(elapsed * 2.4) * 5.5, 5.0, clubZ + Math.sin(elapsed * 2.4) * 4.5);
      clubLightCyan.position.set(clubX - Math.cos(elapsed * 2.0) * 5.5, 5.0, clubZ - Math.sin(elapsed * 2.0) * 4.5);
      clubLightPink.intensity = 30 + beatPulse * 18;
      clubLightCyan.intensity = 30 + beatPulse * 18;

      // Pulsing LED dancefloor tiles (2 shared materials instead of 30)
      pinkTileMat.emissiveIntensity = 0.55 + 1.15 * (0.5 + 0.5 * Math.sin(elapsed * 5.2)) + beatPulse * 0.35;
      cyanTileMat.emissiveIntensity = 0.55 + 1.15 * (0.5 + 0.5 * Math.sin(elapsed * 5.2 + 2.1)) + beatPulse * 0.35;

      // Subwoofer cones thumping to the 126 BPM bass!
      for (const w of woofers) {
        const s = 1 + beatPulse * 0.16;
        w.scale.set(s, 1, s);
      }

      // Spinning turntables
      for (const tt of turntables) {
        tt.rotation.y = elapsed * 4.0;
      }

      // Bartender mixing drinks & nodding to the beat
      bartender.group.position.z = clubZ + Math.sin(elapsed * 0.7) * 1.6;
      bartender.leftArm.rotation.x = -0.8 + Math.sin(elapsed * 6.5) * 0.35;
      bartender.rightArm.rotation.x = -0.8 - Math.sin(elapsed * 6.5) * 0.35;

      // DJ bobbing & scratching
      dj.group.position.y = 0.2 + beatPulse * 0.08;
      dj.leftArm.rotation.x = -1.1 + Math.sin(elapsed * 8.0) * 0.25;
      dj.rightArm.rotation.x = -1.1 - Math.cos(elapsed * 7.2) * 0.25;

      // Dancers grooving to the beat
      for (const d of dancers) {
        d.char.group.position.y = d.baseY + beatPulse * 0.16;
        d.char.group.rotation.y = Math.sin(elapsed * 2.2 + d.phase) * 0.85;
        d.char.leftArm.rotation.x = -2.1 + Math.sin(elapsed * 6.2 + d.phase) * 0.45;
        d.char.rightArm.rotation.x = -2.1 - Math.sin(elapsed * 6.2 + d.phase) * 0.45;
      }
    },
  };
}

interface ClubCharacter {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
}

let clubCharSeed = 0;

function createClubCharacter(shirtColor: string, pantsColor: string, sunglasses: boolean): ClubCharacter {
  const seed = clubCharSeed++;
  const isFemale = seed % 2 === 1;
  const styles: CharacterHairStyle[] = isFemale ? ['ponytail', 'bob', 'feathered'] : ['pompadour', 'feathered'];
  const rig = buildLowPolyCharacter({
    role: 'civilian',
    bodyType: isFemale ? 'female' : 'male',
    skinColor: seed % 3 === 0 ? '#e6b89c' : seed % 3 === 1 ? '#d49a76' : '#b87a56',
    hairColor: seed % 4 === 0 ? '#d9b06a' : '#1f1620',
    primaryColor: shirtColor,
    accentColor: '#36f1e6',
    pantsColor,
    shoeColor: '#f4eee8',
    outfitVariant: seed,
    hairStyle: styles[seed % styles.length],
    wearsSunglasses: sunglasses,
    hasMustache: false,
    shortSleeves: true,
    scale: isFemale ? 0.96 : 1.0,
  });

  // Subtle neon club bounce glow on club outfits (safe under 0.86 bloom threshold)
  rig.materials.torsoFront.emissive.set(shirtColor);
  rig.materials.torsoFront.emissiveIntensity = 0.2;
  rig.materials.torsoBack.emissive.set(shirtColor);
  rig.materials.torsoBack.emissiveIntensity = 0.2;
  rig.materials.sleeve.emissive.set(shirtColor);
  rig.materials.sleeve.emissiveIntensity = 0.18;

  // Natural slight elbow bend for dancing/DJ/bartending
  rig.leftElbowPivot.rotation.x = -0.45;
  rig.rightElbowPivot.rotation.x = -0.45;

  const group = new THREE.Group();
  group.add(rig.bodyRoot);
  return { group, leftArm: rig.leftArmPivot, rightArm: rig.rightArmPivot };
}
