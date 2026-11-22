import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';
import { ViceNewsTv } from './ViceNewsTv';

export interface FoodItem {
  id: string;
  name: string;
  heal: number;
  alcohol?: number;
  mesh: THREE.Object3D;
  available: boolean;
  respawnTimer: number;
}

export interface CabinetWeapon {
  slotIndex: number;
  name: string;
  mesh: THREE.Object3D;
}

export interface SafehouseHandle {
  position: THREE.Vector3;
  isInside: (pos: THREE.Vector3) => boolean;
  isInGarage: (pos: THREE.Vector3) => boolean;
  isNearLounge: (pos: THREE.Vector3) => boolean;
  isNearWardrobe: (pos: THREE.Vector3) => boolean;
  isNearFridge: (pos: THREE.Vector3) => boolean;
  isNearRooftopBar: (pos: THREE.Vector3) => boolean;
  isRooftopBarOwned: () => boolean;
  setRooftopBarOwned: (owned: boolean) => void;
  getFoodItems: () => FoodItem[];
  consumeFood: (item: FoodItem) => void;
  getCabinetWeapons: () => CabinetWeapon[];
  getTvMesh: () => THREE.Object3D;
  toggleTv: (cash: number, wantedStars: number) => boolean;
  isTvOn: () => boolean;
  update: (
    elapsed: number,
    dt: number,
    playerPos?: THREE.Vector3,
    cash?: number,
    wantedStars?: number,
    cameraYaw?: number,
    performanceMode?: boolean,
  ) => void;
}

/**
 * Builds the 2-level walkable "VICE SAFEHOUSE" Oceanfront Villa at block (cx = 40, cz = -40):
 * - Ground Floor South Wing: Drive-in Private Neon Garage (open toward Ocean Drive +X)
 * - Ground Floor North Wing: Walk-in Art-Deco Safehouse Lounge (sofa, 80s CRT TV, weapon wall,
 *   wardrobe, cash vault with gold/cash stacks, neon palm wall art)
 * - Rooftop Penthouse Terrace (reachable via walkable 0.24m stairs): Glowing cyan rooftop pool,
 *   sun loungers & panoramic Ocean Drive / beach overlook!
 */
export function buildSafehouse(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
): SafehouseHandle {
  const cx = 54;
  const cz = -54;
  const wallT = 0.55;
  const floorH = 5.6; // tall ground floor so the recessed rooftop pool basin fits cleanly above the ceiling!

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    tag = 'safehouse',
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

  const stuccoMat = new THREE.MeshStandardMaterial({ color: '#f4e6d8', roughness: 0.62 });
  const coralMat = new THREE.MeshStandardMaterial({ color: '#f2b8a8', roughness: 0.65 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#261c33', roughness: 0.3, metalness: 0.2 });
  const garageFloorMat = new THREE.MeshStandardMaterial({ color: '#1d1924', roughness: 0.35, metalness: 0.25 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.4 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.3 });
  const goldNeon = new THREE.MeshStandardMaterial({ color: '#ffd15c', emissive: '#ffaa22', emissiveIntensity: 2.0 });

  // Footprint: x = 30 .. 50 (20m wide), z = -49 .. -31 (18m deep)
  // South Wing = Private Garage (z: -37.5 .. -31), North Wing = Lounge (z: -49 .. -37.5)

  // Interior floor slabs
  const loungeFloor = new THREE.Mesh(new THREE.PlaneGeometry(19.6, 11.5), floorMat);
  loungeFloor.rotation.x = -Math.PI / 2;
  loungeFloor.position.set(cx, 0.21, cz - 3.2);
  loungeFloor.receiveShadow = true;
  scene.add(loungeFloor);

  const garageFloor = new THREE.Mesh(new THREE.PlaneGeometry(19.6, 6.5), garageFloorMat);
  garageFloor.rotation.x = -Math.PI / 2;
  garageFloor.position.set(cx, 0.2, cz + 5.75);
  garageFloor.receiveShadow = true;
  scene.add(garageFloor);

  // Outer Walls:
  // West back wall (x = 30)
  addBox(wallT, floorH, 18, cx - 10, 0.18 + floorH / 2, cz, stuccoMat);
  // North wall (z = -49)
  addBox(20, floorH, wallT, cx, 0.18 + floorH / 2, cz - 9, stuccoMat);
  // South wall (z = -31)
  addBox(20, floorH, wallT, cx, 0.18 + floorH / 2, cz + 9, stuccoMat);

  // Partition wall between Garage and Lounge (z = -37.5) with 2.4m connecting doorway at x = 35
  addBox(3.8, floorH, wallT, cx - 8.1, 0.18 + floorH / 2, cz + 2.5, coralMat);
  addBox(13.8, floorH, wallT, cx + 3.1, 0.18 + floorH / 2, cz + 2.5, coralMat);
  addBox(2.4, floorH - 3.0, wallT, cx - 5.0, 0.18 + 3.0 + (floorH - 3.0) / 2, cz + 2.5, coralMat);

  // East Front Wall facing Ocean Drive (x = 50):
  // - Open 5.6m Garage bay (z: -37.1 .. -31.5, center = -34.3)
  // - Open 3.0m Lounge doorway (z: -44.5 .. -41.5, center = -43.0)
  addBox(wallT, floorH, 4.5, cx + 10, 0.18 + floorH / 2, cz - 6.75, stuccoMat); // north corner
  addBox(wallT, floorH, 4.0, cx + 10, 0.18 + floorH / 2, cz + 0.5, stuccoMat); // between lounge door & garage
  addBox(wallT, floorH - 3.2, 3.0, cx + 10, 0.18 + 3.2 + (floorH - 3.2) / 2, cz - 3.0, stuccoMat); // lounge door lintel
  addBox(wallT, floorH - 3.5, 6.2, cx + 10, 0.18 + 3.5 + (floorH - 3.5) / 2, cz + 5.7, stuccoMat); // garage lintel

  // ---------------------------------------------------------------------------
  // Animated Roll-Up Garage Door + Automatic Sliding Doors (Front & Inner)
  // ---------------------------------------------------------------------------
  // 1) Sectional Roll-Up Garage Door at x = 50, z = -34.3 (w = 5.6, h = 3.5)
  const garageDoorGroup = new THREE.Group();
  garageDoorGroup.userData.dynamic = true;
  const garageDoorTopY = 0.18 + 3.5; // pivots/compresses upward into the lintel!
  garageDoorGroup.position.set(cx + 10.0, garageDoorTopY, cz + 5.7);

  const gDoorMat = new THREE.MeshStandardMaterial({ color: '#e5ddd5', roughness: 0.42, metalness: 0.35 });
  const gStripeMat = new THREE.MeshStandardMaterial({ color: '#d49a8e', roughness: 0.45 });
  const garagePanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.5, 5.8), gDoorMat);
  garagePanel.position.y = -1.75;
  garagePanel.castShadow = true;
  garageDoorGroup.add(garagePanel);

  // Horizontal sectional panel ribs
  for (let r = 0; r < 5; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 5.75), r === 4 ? cyanNeon : gStripeMat);
    rib.position.y = -0.35 - r * 0.72;
    garageDoorGroup.add(rib);
  }
  scene.add(garageDoorGroup);

  // 2) Automatic Double Art-Deco Glass Sliding Doors at Main Lounge Entrance (x = 50, z = -43.0)
  const frameMat = new THREE.MeshStandardMaterial({ color: '#c8d2de', metalness: 0.88, roughness: 0.18 });
  const glassDoorMat = new THREE.MeshStandardMaterial({
    color: '#284a5e',
    roughness: 0.08,
    metalness: 0.65,
    transparent: true,
    opacity: 0.68,
  });

  const buildGlassLeaf = (zCenter: number): THREE.Group => {
    const leaf = new THREE.Group();
    leaf.position.set(cx + 10.0, 0.18 + 1.6, zCenter);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.05, 1.44), glassDoorMat);
    leaf.add(glass);
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 1.5), frameMat);
    frameTop.position.y = 1.54;
    leaf.add(frameTop);
    const frameBot = frameTop.clone();
    frameBot.position.y = -1.54;
    leaf.add(frameBot);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.06), goldNeon);
    handle.position.set(0, -0.1, zCenter < cz - 3.0 ? 0.55 : -0.55);
    leaf.add(handle);
    scene.add(leaf);
    return leaf;
  };
  const frontDoorN = buildGlassLeaf(cz - 3.75);
  const frontDoorS = buildGlassLeaf(cz - 2.25);
  frontDoorN.userData.dynamic = true;
  frontDoorS.userData.dynamic = true;

  // 3) Automatic Interior Sliding Door between Garage & Lounge (x = 35.0, z = -37.5, width = 2.4m)
  const innerDoorMat = new THREE.MeshStandardMaterial({ color: '#6b4738', roughness: 0.55 });
  const innerDoor = new THREE.Group();
  innerDoor.userData.dynamic = true;
  innerDoor.position.set(cx - 5.0, 0.18 + 1.5, cz + 2.5);
  const innerPanel = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.98, 0.14), innerDoorMat);
  innerDoor.add(innerPanel);
  const innerTrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.18), goldNeon);
  innerTrim.position.y = 0.0;
  innerDoor.add(innerTrim);
  scene.add(innerDoor);

  let garageOpenT = 0;
  let frontOpenT = 0;
  let innerOpenT = 0;

  // Rooftop Deck Slab split cleanly around the recessed Pool Basin
  // Pool opening spans x: 38.5 .. 46.5 (w=8.0, cx=42.5), z: -46.5 .. -41.5 (d=5.0, cz=-44.0)
  // Completely north of the z = -37.5 interior partition wall so zero walls poke into the pool!
  const slabY = 0.18 + floorH + 0.18;
  const slabH = 0.36;
  // West deck strip (x: 29.7 .. 38.5 -> w=8.8, center=34.1)
  addBox(8.8, slabH, 18.6, 34.1, slabY, cz, stuccoMat);
  // East deck strip (x: 46.5 .. 50.3 -> w=3.8, center=48.4)
  addBox(3.8, slabH, 18.6, 48.4, slabY, cz, stuccoMat);
  // North deck strip between x=38.5..46.5 (z: -49.3 .. -46.5 -> d=2.8, center=-47.9)
  addBox(8.0, slabH, 2.8, 42.5, slabY, -47.9, stuccoMat);
  // South deck strip between x=38.5..46.5 (z: -41.5 .. -30.7 -> d=10.8, center=-36.1)
  addBox(8.0, slabH, 10.8, 42.5, slabY, -36.1, stuccoMat);

  // Glowing VICE SAFEHOUSE Marquee Sign facing Ocean Drive
  const signTex = createNeonSignTexture('VICE SAFEHOUSE', '#36f1e6');
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: '#ffffff',
    emissiveMap: signTex,
    emissiveIntensity: 1.95,
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.4, 0.24), signMat);
  sign.rotation.y = Math.PI / 2;
  sign.position.set(cx + 10.42, 0.18 + 4.4, cz + 5.6);
  scene.add(sign);

  // Exterior Art-Deco neon perimeter edge strips (4 thin rim strips — NEVER covering the terrace!)
  const softTrimMat = new THREE.MeshStandardMaterial({
    color: '#36f1e6',
    emissive: '#36f1e6',
    emissiveIntensity: 1.25,
    roughness: 0.3,
  });
  const trimY = 0.18 + floorH + 0.18;
  const trimE = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 18.8), softTrimMat);
  trimE.position.set(cx + 10.35, trimY, cz);
  scene.add(trimE);
  const trimW = trimE.clone();
  trimW.position.x = cx - 10.35;
  scene.add(trimW);
  const trimN = new THREE.Mesh(new THREE.BoxGeometry(20.8, 0.14, 0.12), softTrimMat);
  trimN.position.set(cx, trimY, cz - 9.35);
  scene.add(trimN);
  const trimS = trimN.clone();
  trimS.position.z = cz + 9.35;
  scene.add(trimS);

  // Garage floor neon guide strips
  for (const gz of [cz + 4.2, cz + 7.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.03, 0.12), cyanNeon);
    strip.position.set(cx + 1.2, 0.22, gz);
    scene.add(strip);
  }

  // ---------------------------------------------------------------------------
  // Safehouse Lounge Furnishings (z: -49 .. -37.5)
  // ---------------------------------------------------------------------------
  const loungeLight = new THREE.PointLight('#ffd8ec', 26, 26, 1.5);
  loungeLight.position.set(cx, 4.5, cz - 1.0);
  scene.add(loungeLight);

  // Pastel Art-Deco Sofa & Coffee Table (center-north)
  const sofaMat = new THREE.MeshStandardMaterial({ color: '#e87ca8', roughness: 0.78 });
  addBox(3.8, 0.85, 1.2, cx - 1.5, 0.2 + 0.425, cz - 6.8, sofaMat);
  const tableGlass = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.08, 1.0),
    new THREE.MeshStandardMaterial({ color: '#36f1e6', transparent: true, opacity: 0.55, roughness: 0.1 }),
  );
  tableGlass.position.set(cx - 1.5, 0.68, cz - 4.8);
  scene.add(tableGlass);

  // 80s Retro CRT TV on Credenza (toggleable VICE CHANNEL 6 Live News!)
  const viceTv = new ViceNewsTv();
  const tvBody = new THREE.MeshStandardMaterial({ color: '#241d2e', roughness: 0.5 });
  addBox(2.2, 0.75, 0.75, cx - 1.5, 0.2 + 0.375, cz - 2.4, tvBody);
  const tvGroup = new THREE.Group();
  tvGroup.position.set(cx - 1.5, 1.42, cz - 2.4);
  const crt = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.0, 0.68), tvBody);
  tvGroup.add(crt);
  const tvScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 0.84),
    new THREE.MeshBasicMaterial({ map: viceTv.texture }),
  );
  tvScreen.rotation.y = Math.PI;
  tvScreen.position.set(0, 0.02, -0.35);
  tvGroup.add(tvScreen);
  const tvLedMat = new THREE.MeshBasicMaterial({ color: '#ff2244' });
  const tvLed = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), tvLedMat);
  tvLed.position.set(-0.54, -0.42, -0.35);
  tvGroup.add(tvLed);
  scene.add(tvGroup);

  // ---------------------------------------------------------------------------
  // Openable 80s Neon Gun Cabinet (Waffenschrank) along West Wall (x = 30.8, z = -44.2)
  // Hollow steel shell, backlit pegboard, 5 detailed 3D weapons & hinged double doors!
  // ---------------------------------------------------------------------------
  const cabX = cx - 9.2; // 30.8
  const cabZ = cz - 4.2; // -44.2
  const cabW = 0.88; // depth along X (30.36 .. 31.24)
  const cabH = 2.45;
  const cabD = 3.2; // width along Z (-45.8 .. -42.6)

  const steelMat = new THREE.MeshStandardMaterial({ color: '#1b1726', roughness: 0.38, metalness: 0.72 });
  const pegboardMat = new THREE.MeshStandardMaterial({
    color: '#281a38',
    emissive: '#3a1a52',
    emissiveIntensity: 0.4,
    roughness: 0.65,
  });

  // Hollow cabinet shell (back, north, south, top, bottom — open toward +X into the lounge)
  addBox(0.14, cabH, cabD, cabX - cabW / 2 + 0.07, 0.2 + cabH / 2, cabZ, steelMat); // back
  addBox(cabW, cabH, 0.14, cabX, 0.2 + cabH / 2, cabZ - cabD / 2 + 0.07, steelMat); // north side
  addBox(cabW, cabH, 0.14, cabX, 0.2 + cabH / 2, cabZ + cabD / 2 - 0.07, steelMat); // south side
  addBox(cabW, 0.14, cabD, cabX, 0.2 + cabH - 0.07, cabZ, steelMat); // top
  addBox(cabW, 0.14, cabD, cabX, 0.2 + 0.07, cabZ, steelMat); // bottom

  // Backlit interior pegboard + subtle top LED strip
  const pegboard = new THREE.Mesh(new THREE.PlaneGeometry(cabD - 0.3, cabH - 0.3), pegboardMat);
  pegboard.rotation.y = Math.PI / 2;
  pegboard.position.set(cabX - cabW / 2 + 0.16, 0.2 + cabH / 2, cabZ);
  scene.add(pegboard);

  const cabLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, cabD - 0.36), cyanNeon);
  cabLed.position.set(cabX + 0.12, 0.2 + cabH - 0.18, cabZ);
  scene.add(cabLed);

  // 5 Detailed 3D Weapons mounted inside the Gun Cabinet!
  const cabinetWeapons: CabinetWeapon[] = [];
  const wChrome = new THREE.MeshStandardMaterial({ color: '#dce4f0', metalness: 0.9, roughness: 0.2 });
  const wDark = new THREE.MeshStandardMaterial({ color: '#241f2e', metalness: 0.7, roughness: 0.4 });
  const wWood = new THREE.MeshStandardMaterial({ color: '#8f5538', roughness: 0.7 });

  // 0) NEON KATANA (mounted horizontally at top)
  const kGroup = new THREE.Group();
  kGroup.position.set(cabX - 0.18, 2.22, cabZ);
  const kBlade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 1.35), cyanNeon);
  kBlade.position.z = 0.16;
  kGroup.add(kBlade);
  const kGuard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.03), goldNeon);
  kGuard.position.z = -0.52;
  kGroup.add(kGuard);
  const kGrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.36), wDark);
  kGrip.position.z = -0.7;
  kGroup.add(kGrip);
  scene.add(kGroup);
  cabinetWeapons.push({ slotIndex: 0, name: 'NEON KATANA', mesh: kGroup });

  // 1) VICE 9MM Pistol (middle-north)
  const pGroup = new THREE.Group();
  pGroup.position.set(cabX - 0.18, 1.65, cabZ - 0.85);
  const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.44), wChrome);
  pGroup.add(pSlide);
  const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), wDark);
  pGrip.position.set(0, -0.14, -0.12);
  pGrip.rotation.x = 0.2;
  pGroup.add(pGrip);
  scene.add(pGroup);
  cabinetWeapons.push({ slotIndex: 1, name: 'VICE 9MM', mesh: pGroup });

  // 2) NEON MAC-10 SMG (middle-south)
  const sGroup = new THREE.Group();
  sGroup.position.set(cabX - 0.18, 1.65, cabZ + 0.55);
  const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.56), wDark);
  sGroup.add(sBody);
  const sStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.42), pinkNeon);
  sStrip.position.y = 0.04;
  sGroup.add(sStrip);
  const sMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.09), wDark);
  sMag.position.set(0, -0.22, -0.06);
  sGroup.add(sMag);
  scene.add(sGroup);
  cabinetWeapons.push({ slotIndex: 2, name: 'NEON MAC-10', mesh: sGroup });

  // 3) PALM 12G Shotgun (lower-middle)
  const shGroup = new THREE.Group();
  shGroup.position.set(cabX - 0.18, 1.1, cabZ - 0.05);
  const shBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 1.25), wDark);
  shGroup.add(shBarrel);
  const shPump = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.36), wWood);
  shPump.position.set(0, -0.06, 0.22);
  shGroup.add(shPump);
  const shStock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.15, 0.42), wWood);
  shStock.position.set(0, -0.08, -0.72);
  shStock.rotation.x = -0.16;
  shGroup.add(shStock);
  scene.add(shGroup);
  cabinetWeapons.push({ slotIndex: 3, name: 'PALM 12G', mesh: shGroup });

  // 4) NEON LAUNCHER RPG (bottom shelf)
  const lGroup = new THREE.Group();
  lGroup.position.set(cabX - 0.16, 0.62, cabZ);
  const lTube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.38, 10), wDark);
  lTube.rotation.x = Math.PI / 2;
  lGroup.add(lTube);
  const lRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 14), pinkNeon);
  lRing.position.z = 0.68;
  lGroup.add(lRing);
  const lSight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.16), cyanNeon);
  lSight.position.set(0.1, 0.1, 0.1);
  lGroup.add(lSight);
  scene.add(lGroup);
  cabinetWeapons.push({ slotIndex: 4, name: 'NEON LAUNCHER', mesh: lGroup });

  // Hinged Double Steel & Tinted-Glass Cabinet Doors (swing smoothly outward when approaching!)
  const cabGlassMat = new THREE.MeshStandardMaterial({
    color: '#1b384a',
    roughness: 0.08,
    metalness: 0.7,
    transparent: true,
    opacity: 0.52,
  });
  const cabDoorX = cabX + cabW / 2; // east face (31.24)

  const buildCabDoor = (hingeZ: number, dirSign: 1 | -1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(cabDoorX, 0.2 + cabH / 2, hingeZ);
    const leafW = (cabD - 0.3) / 2;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.06, cabH - 0.34, leafW - 0.06), cabGlassMat);
    glass.position.z = dirSign * (leafW / 2);
    pivot.add(glass);

    const borderTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, leafW), steelMat);
    borderTop.position.set(0, (cabH - 0.3) / 2, dirSign * (leafW / 2));
    pivot.add(borderTop);
    const borderBot = borderTop.clone();
    borderBot.position.y = -(cabH - 0.3) / 2;
    pivot.add(borderBot);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.05), pinkNeon);
    handle.position.set(0.05, 0, dirSign * (leafW - 0.14));
    pivot.add(handle);

    scene.add(pivot);
    return pivot;
  };
  const cabDoorNorth = buildCabDoor(cabZ - cabD / 2 + 0.15, 1);
  const cabDoorSouth = buildCabDoor(cabZ + cabD / 2 - 0.15, -1);
  cabDoorNorth.userData.dynamic = true;
  cabDoorSouth.userData.dynamic = true;
  let cabOpenT = 0;

  // Wardrobe Closet (x = 34.5, z = -48.1)
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a44', roughness: 0.65 });
  addBox(2.2, 2.5, 0.9, cx - 5.5, 0.2 + 1.25, cz - 8.1, woodMat);

  // Full-Length Art-Deco Dressing Mirror right next to the Wardrobe (x = 32.35, z = -48.55)
  const mirrorX = cx - 7.65; // 32.35
  const mirrorZ = cz - 8.55; // -48.55
  const mirrorGoldMat = new THREE.MeshStandardMaterial({ color: '#e8c166', roughness: 0.22, metalness: 0.9 });
  const mirrorFrame = new THREE.Group();
  mirrorFrame.position.set(mirrorX, 1.48, mirrorZ);
  // Backing & decorative brass frame
  const mirrorBack = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.38, 0.08), woodMat);
  mirrorFrame.add(mirrorBack);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.09, 0.12), mirrorGoldMat);
  frameTop.position.y = 1.19;
  const frameBot = frameTop.clone();
  frameBot.position.y = -1.19;
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.38, 0.12), mirrorGoldMat);
  frameL.position.x = -0.69;
  const frameR = frameL.clone();
  frameR.position.x = 0.69;
  // Subtle vanity accent strips along sides
  const vanityMat = new THREE.MeshStandardMaterial({
    color: '#fff4e0',
    emissive: '#ffe0b2',
    emissiveIntensity: 1.45,
  });
  const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 2.1, 0.025), vanityMat);
  stripL.position.set(-0.62, 0, 0.06);
  const stripR = stripL.clone();
  stripR.position.x = 0.62;
  mirrorFrame.add(frameTop, frameBot, frameL, frameR, stripL, stripR);
  scene.add(mirrorFrame);

  // Real live Reflector mirror surface (enables Layer 1 so you see yourself even in 1st-person!)
  const mirrorReflector = new Reflector(new THREE.PlaneGeometry(1.22, 2.18), {
    clipBias: 0.004,
    textureWidth: 512,
    textureHeight: 1024,
    color: 0xdcebf2,
    multisample: 2,
  });
  mirrorReflector.position.set(mirrorX, 1.48, mirrorZ + 0.055);
  mirrorReflector.camera.layers.enable(1);
  mirrorReflector.camera.far = 22;
  mirrorReflector.userData.dynamic = true;
  mirrorReflector.visible = false; // toggled automatically only while near mirror in Lounge -> 0 FPS cost elsewhere!
  scene.add(mirrorReflector);

  // Cash Vault / Safe with glowing gold bars & cash stacks (x = 45.5, z = -48.0)
  const vaultMat = new THREE.MeshStandardMaterial({ color: '#2b2d3c', metalness: 0.85, roughness: 0.25 });
  addBox(1.8, 1.8, 1.3, cx + 5.5, 0.2 + 0.9, cz - 7.9, vaultMat);
  const vaultDial = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 16), goldNeon);
  vaultDial.position.set(cx + 5.5, 1.25, cz - 7.22);
  scene.add(vaultDial);

  // ---------------------------------------------------------------------------
  // 80s Pastel Kitchenette & Openable Retro Fridge Stocked with Food (SE Lounge)
  // ---------------------------------------------------------------------------
  const kitchenZ = cz + 1.65; // right along the south partition wall (z = -38.35)
  const mintCabMat = new THREE.MeshStandardMaterial({ color: '#9de0d2', roughness: 0.5 });
  const counterTopMat = new THREE.MeshStandardMaterial({ color: '#faf3eb', roughness: 0.3 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#dce4ef', metalness: 0.9, roughness: 0.15 });

  // Kitchen Counter (x: 42.6 .. 46.8)
  addBox(4.2, 0.96, 1.05, 44.7, 0.2 + 0.48, kitchenZ, mintCabMat);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.08, 1.12), counterTopMat);
  counterTop.position.set(44.7, 0.2 + 1.0, kitchenZ);
  scene.add(counterTop);

  // Sink basin & chrome faucet
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.62), chromeMat);
  sink.position.set(43.7, 1.23, kitchenZ);
  scene.add(sink);
  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), chromeMat);
  faucet.position.set(43.7, 1.4, kitchenZ + 0.26);
  scene.add(faucet);

  const foodItems: FoodItem[] = [];
  const registerFood = (id: string, name: string, heal: number, mesh: THREE.Object3D, alcohol = 0): void => {
    foodItems.push({ id, name, heal, alcohol, mesh, available: true, respawnTimer: 0 });
  };

  // Retro 2-burner stovetop & Miami Pizza Box on the counter
  const burnerMat = new THREE.MeshStandardMaterial({ color: '#1b1622', roughness: 0.4 });
  for (const bx of [45.2, 45.8]) {
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), burnerMat);
    burner.position.set(bx, 1.25, kitchenZ);
    scene.add(burner);
  }
  const pizzaBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.09, 0.62),
    new THREE.MeshStandardMaterial({ color: '#f5d2a4', roughness: 0.8 }),
  );
  pizzaBox.position.set(46.3, 1.28, kitchenZ - 0.05);
  pizzaBox.rotation.y = 0.2;
  scene.add(pizzaBox);
  registerFood('food-pizza-box', 'MIAMI PIZZA', 30, pizzaBox);

  // Retro Pastel-Mint Refrigerator with Hollow Lit Interior & Stocked Food (x = 48.0, z = -38.4)
  const fridgeX = 48.0;
  const fridgeZ = kitchenZ;
  const fridgeOuterMat = new THREE.MeshStandardMaterial({ color: '#bce8de', roughness: 0.28, metalness: 0.2 });
  const fridgeInnerMat = new THREE.MeshStandardMaterial({
    color: '#f2f9fc',
    emissive: '#cceeff',
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });

  // Hollow fridge shell (back, left, right, top, bottom — open toward -Z into the lounge!)
  addBox(1.24, 2.25, 0.14, fridgeX, 0.2 + 1.125, fridgeZ + 0.5, fridgeOuterMat); // back
  addBox(0.12, 2.25, 1.1, fridgeX - 0.56, 0.2 + 1.125, fridgeZ, fridgeOuterMat); // west side
  addBox(0.12, 2.25, 1.1, fridgeX + 0.56, 0.2 + 1.125, fridgeZ, fridgeOuterMat); // east side
  addBox(1.24, 0.14, 1.12, fridgeX, 0.2 + 2.2, fridgeZ, fridgeOuterMat); // top
  addBox(1.24, 0.14, 1.12, fridgeX, 0.2 + 0.07, fridgeZ, fridgeOuterMat); // bottom

  // Lit white interior back panel
  const innerBack = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.02), fridgeInnerMat);
  innerBack.rotation.y = Math.PI;
  innerBack.position.set(fridgeX, 0.2 + 1.12, fridgeZ + 0.41);
  scene.add(innerBack);

  // 3 Glass shelves inside the fridge + visible 3D food & drinks!
  const shelfMat = new THREE.MeshStandardMaterial({
    color: '#d8f4ff',
    transparent: true,
    opacity: 0.55,
    roughness: 0.1,
  });
  for (const sy of [0.85, 1.4, 1.9]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.04, 0.84), shelfMat);
    shelf.position.set(fridgeX, sy, fridgeZ + 0.02);
    scene.add(shelf);
  }

  // Top Shelf (y = 1.92): Golden Pizza Slice & Takeout Container
  const pizzaSlice = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.36, 3),
    new THREE.MeshStandardMaterial({ color: '#ffbe4f', roughness: 0.65 }),
  );
  pizzaSlice.rotation.x = Math.PI / 2;
  pizzaSlice.position.set(fridgeX - 0.22, 1.98, fridgeZ);
  scene.add(pizzaSlice);
  registerFood('food-pizza-slice', 'PIZZA-STÜCK', 25, pizzaSlice);

  const takeout = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.16, 0.32),
    new THREE.MeshStandardMaterial({ color: '#ff6f91', roughness: 0.6 }),
  );
  takeout.position.set(fridgeX + 0.22, 2.0, fridgeZ + 0.04);
  scene.add(takeout);
  registerFood('food-takeout', 'NOODLE TAKEOUT', 25, takeout);

  // Middle Shelf (y = 1.42): 4 Neon Soda Cans & Milk Carton
  const canColors = ['#36f1e6', '#ff4fa3', '#ffd15c', '#52f29c'];
  canColors.forEach((col, i) => {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.25 }),
    );
    can.position.set(fridgeX - 0.34 + i * 0.16, 1.54, fridgeZ - 0.04);
    scene.add(can);
    registerFood(`food-soda-${i}`, 'NEON SODA', 15, can);
  });
  const milk = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.34, 0.16),
    new THREE.MeshStandardMaterial({ color: '#f7f4f0', roughness: 0.5 }),
  );
  milk.position.set(fridgeX + 0.32, 1.6, fridgeZ + 0.06);
  scene.add(milk);
  registerFood('food-milk', 'FRISCHE MILCH', 15, milk);

  // Bottom Shelf (y = 0.87): 4 Chilled 80s Vice Lager Beer Bottles (with Alcohol Effect!) + Tropical Watermelon
  const beerGlassMat = new THREE.MeshStandardMaterial({
    color: '#1b6b3a',
    roughness: 0.14,
    metalness: 0.18,
    transparent: true,
    opacity: 0.88,
  });
  const beerAmberMat = new THREE.MeshStandardMaterial({
    color: '#8f4a14',
    roughness: 0.16,
    metalness: 0.18,
    transparent: true,
    opacity: 0.88,
  });
  const beerLabelMat = new THREE.MeshStandardMaterial({
    color: '#ffd15c',
    emissive: '#ff9f43',
    emissiveIntensity: 0.22,
    roughness: 0.5,
  });
  const beerCapMat = new THREE.MeshStandardMaterial({ color: '#e0c052', metalness: 0.85, roughness: 0.2 });

  for (let b = 0; b < 4; b++) {
    const beerGroup = new THREE.Group();
    const glassMat = b % 2 === 0 ? beerGlassMat : beerAmberMat;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.19, 10), glassMat);
    body.position.y = 0.095;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.042, 0.055, 10), glassMat);
    shoulder.position.y = 0.215;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.075, 10), glassMat);
    neck.position.y = 0.28;
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.075, 10), beerLabelMat);
    label.position.y = 0.1;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.014, 10), beerCapMat);
    cap.position.y = 0.322;
    beerGroup.add(body, shoulder, neck, label, cap);
    const bx = fridgeX + 0.04 + (b % 2) * 0.14 + (b >= 2 ? 0.05 : 0);
    const bz = fridgeZ - 0.14 + Math.floor(b / 2) * 0.16;
    beerGroup.position.set(bx, 0.87, bz);
    scene.add(beerGroup);
    registerFood(`food-beer-${b}`, b % 2 === 0 ? 'VICE LAGER BIER' : 'MIAMI GOLD BIER', 15, beerGroup, 1.35);
  }

  const melon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#2d8a56', roughness: 0.55 }),
  );
  melon.position.set(fridgeX - 0.26, 1.05, fridgeZ + 0.06);
  scene.add(melon);
  registerFood('food-melon', 'WASSERMELONE', 30, melon);

  // Hinged Fridge Door (swings open smoothly toward east when player approaches!)
  const fridgeDoorPivot = new THREE.Group();
  fridgeDoorPivot.userData.dynamic = true;
  fridgeDoorPivot.position.set(fridgeX + 0.56, 0.2 + 1.125, fridgeZ - 0.54);
  const fridgeDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.18, 2.22, 0.1), fridgeOuterMat);
  fridgeDoorMesh.position.set(-0.56, 0, 0);
  fridgeDoorMesh.castShadow = true;
  fridgeDoorPivot.add(fridgeDoorMesh);
  const fridgeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.12), chromeMat);
  fridgeHandle.position.set(-1.02, 0.18, -0.08);
  fridgeDoorPivot.add(fridgeHandle);
  scene.add(fridgeDoorPivot);

  let fridgeOpenT = 0;

  // ---------------------------------------------------------------------------
  // Walkable Exterior Staircase up to the Rooftop Penthouse Pool Terrace
  // ---------------------------------------------------------------------------
  const stairMat = new THREE.MeshStandardMaterial({ color: '#eedccf', roughness: 0.6 });
  const stepH = 0.24;
  const stepRun = 0.35;
  const totalRise = floorH + 0.36;
  const steps = Math.ceil(totalRise / stepH);
  const stairStartX = cx - 8.5;
  const stairZ = cz - 10.2; // climbs east along the north exterior wall!
  const extStairGeos: THREE.BufferGeometry[] = [];
  for (let s = 0; s < steps; s++) {
    const topY = 0.18 + (s + 1) * stepH;
    const sx = stairStartX + s * stepRun;
    const sw = stepRun + 0.06;
    const sg = new THREE.BoxGeometry(sw, topY, 2.0);
    sg.translate(sx, topY / 2, stairZ);
    extStairGeos.push(sg);
    colliders.push({
      minX: sx - sw / 2,
      maxX: sx + sw / 2,
      minY: 0,
      maxY: topY,
      minZ: stairZ - 1.0,
      maxZ: stairZ + 1.0,
      tag: 'stairs',
    });
  }
  const extStairsMesh = new THREE.Mesh(mergeGeometries(extStairGeos), stairMat);
  extStairsMesh.castShadow = true;
  extStairsMesh.receiveShadow = true;
  scene.add(extStairsMesh);
  worldMeshes.push(extStairsMesh);
  for (const sg of extStairGeos) sg.dispose();
  // Top landing bridge onto the rooftop terrace
  addBox(3.4, 0.36, 2.2, stairStartX + steps * stepRun + 1.4, 0.18 + floorH + 0.18, stairZ, stairMat);

  // ---------------------------------------------------------------------------
  // Rooftop Penthouse Terrace: Recessed Swimmable Pool Basin, Underwater Steps & Calm Lighting
  // ---------------------------------------------------------------------------
  const roofY = 0.18 + floorH + 0.36;

  // Low Art-Deco rooftop safety parapet walls (leave opening at north stair landing)
  addBox(0.4, 0.9, 18.2, cx - 10.0, roofY + 0.45, cz, stuccoMat);
  addBox(0.4, 0.9, 18.2, cx + 10.0, roofY + 0.45, cz, stuccoMat);
  addBox(20.0, 0.9, 0.4, cx, roofY + 0.45, cz + 9.0, stuccoMat);

  // Recessed Pool Basin (x: 38.5..46.5, z: -46.5..-41.5, depth = 1.25m below deck!)
  const poolCX = 42.5;
  const poolCZ = -44.0;
  const poolFloorY = roofY - 1.25;
  const poolTileTex = createPoolTileTexture();
  const poolTileMat = new THREE.MeshStandardMaterial({
    map: poolTileTex,
    roughness: 0.32,
    metalness: 0.08,
  });

  // Solid recessed pool bottom (player drops cleanly into waist/chest-deep water!)
  addBox(8.4, 0.24, 5.4, poolCX, poolFloorY - 0.12, poolCZ, poolTileMat, false, 'pool-floor');
  // Recessed pool inner tiled walls
  addBox(0.24, 1.25, 5.2, 38.5, poolFloorY + 0.625, poolCZ, poolTileMat, false, 'pool-wall');
  addBox(0.24, 1.25, 5.2, 46.5, poolFloorY + 0.625, poolCZ, poolTileMat, false, 'pool-wall');
  addBox(8.2, 1.25, 0.24, poolCX, poolFloorY + 0.625, -46.5, poolTileMat, false, 'pool-wall');
  addBox(8.2, 1.25, 0.24, poolCX, poolFloorY + 0.625, -41.5, poolTileMat, false, 'pool-wall');

  // Crisp white stone pool coping rim around the 4 edges
  const copingMat = new THREE.MeshStandardMaterial({ color: '#faf3eb', roughness: 0.55 });
  const cTop = roofY + 0.03;
  const rimN = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.08, 0.36), copingMat);
  rimN.position.set(poolCX, cTop, -46.6);
  scene.add(rimN);
  const rimS = rimN.clone();
  rimS.position.z = -41.4;
  scene.add(rimS);
  const rimW = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 5.5), copingMat);
  rimW.position.set(38.4, cTop, poolCZ);
  scene.add(rimW);
  const rimE = rimW.clone();
  rimE.position.x = 46.6;
  scene.add(rimE);

  // Underwater walk-out steps along the west edge of the pool (0.24m risers -> smooth walk right out!)
  const poolStepGeos: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 5; s++) {
    const stepTop = poolFloorY + (s + 1) * 0.24;
    const sh = stepTop - poolFloorY;
    const sx = 38.85 + (4 - s) * 0.38;
    const sy = (stepTop + poolFloorY) / 2;
    const sg = new THREE.BoxGeometry(0.42, sh, 2.2);
    sg.translate(sx, sy, poolCZ);
    poolStepGeos.push(sg);
    colliders.push({
      minX: sx - 0.21,
      maxX: sx + 0.21,
      minY: sy - sh / 2,
      maxY: sy + sh / 2,
      minZ: poolCZ - 1.1,
      maxZ: poolCZ + 1.1,
      tag: 'pool-stairs',
    });
  }
  const poolStepsMesh = new THREE.Mesh(mergeGeometries(poolStepGeos), poolTileMat);
  poolStepsMesh.receiveShadow = true;
  scene.add(poolStepsMesh);
  worldMeshes.push(poolStepsMesh);
  for (const sg of poolStepGeos) sg.dispose();

  // Translucent turquoise water surface (NO collider -> player splashes right through it!)
  const poolMat = new THREE.MeshStandardMaterial({
    color: '#22b8cf',
    emissive: '#0a4a59',
    emissiveIntensity: 0.24,
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
  });
  const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(7.9, 4.9), poolMat);
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set(poolCX, roofY - 0.16, poolCZ);
  poolWater.userData.dynamic = true;
  scene.add(poolWater);

  // --- Inflatable Unicorn Swim Ring floating in the Rooftop Pool ---
  const unicornFloat = new THREE.Group();
  unicornFloat.userData.dynamic = true;
  const floatBaseX = poolCX + 1.1;
  const floatBaseZ = poolCZ - 0.25;
  const floatWaterY = roofY - 0.14;
  unicornFloat.position.set(floatBaseX, floatWaterY, floatBaseZ);

  const vinylWhiteMat = new THREE.MeshStandardMaterial({ color: '#fdfaff', roughness: 0.18, metalness: 0.08 });
  const vinylPinkMat = new THREE.MeshStandardMaterial({ color: '#ff6eb4', roughness: 0.22, metalness: 0.08 });
  const vinylCyanMat = new THREE.MeshStandardMaterial({ color: '#36f1e6', roughness: 0.22, metalness: 0.08 });
  const vinylYellowMat = new THREE.MeshStandardMaterial({ color: '#ffd166', roughness: 0.22, metalness: 0.08 });
  const vinylPurpleMat = new THREE.MeshStandardMaterial({ color: '#c084fc', roughness: 0.22, metalness: 0.08 });
  const goldHornMat = new THREE.MeshStandardMaterial({ color: '#f5c542', roughness: 0.18, metalness: 0.85 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#15121d', roughness: 0.12, metalness: 0.3 });

  // Main inflatable torus ring
  const floatRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.19, 16, 32), vinylWhiteMat);
  floatRing.rotation.x = Math.PI / 2;
  floatRing.position.y = 0.08;
  floatRing.castShadow = true;
  unicornFloat.add(floatRing);

  // Cute inflatable side wings
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.34), vinylWhiteMat);
    wing.position.set(sx * 0.72, 0.2, -0.04);
    wing.rotation.z = sx * 0.32;
    wing.rotation.y = sx * -0.2;
    unicornFloat.add(wing);

    const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.22), vinylPinkMat);
    wingTip.position.set(sx * 0.8, 0.25, -0.08);
    wingTip.rotation.z = sx * 0.42;
    unicornFloat.add(wingTip);
  }

  // Curved unicorn neck rising from front of the ring (+Z)
  const neckLower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.36, 14), vinylWhiteMat);
  neckLower.position.set(0, 0.32, 0.56);
  neckLower.rotation.x = 0.14;
  neckLower.castShadow = true;
  unicornFloat.add(neckLower);

  const neckUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.145, 0.32, 14), vinylWhiteMat);
  neckUpper.position.set(0, 0.58, 0.6);
  neckUpper.rotation.x = -0.08;
  neckUpper.castShadow = true;
  unicornFloat.add(neckUpper);

  // Sculpted unicorn head & rounded snout
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), vinylWhiteMat);
  headMesh.position.set(0, 0.76, 0.62);
  headMesh.scale.set(0.92, 0.96, 1.15);
  headMesh.castShadow = true;
  unicornFloat.add(headMesh);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.125, 0.24, 12), vinylWhiteMat);
  snout.rotation.x = Math.PI / 2 + 0.18;
  snout.position.set(0, 0.71, 0.82);
  unicornFloat.add(snout);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), vinylPinkMat);
  noseTip.position.set(0, 0.69, 0.93);
  noseTip.scale.set(1.0, 0.85, 0.65);
  unicornFloat.add(noseTip);

  // Glossy cartoon eyes & pointed ears
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), eyeMat);
    eye.position.set(sx * 0.135, 0.78, 0.7);
    unicornFloat.add(eye);

    const earOuter = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 8), vinylWhiteMat);
    earOuter.position.set(sx * 0.1, 0.93, 0.57);
    earOuter.rotation.z = sx * -0.28;
    earOuter.rotation.x = -0.15;
    unicornFloat.add(earOuter);

    const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.11, 8), vinylPinkMat);
    earInner.position.set(sx * 0.1, 0.92, 0.59);
    earInner.rotation.z = sx * -0.28;
    earInner.rotation.x = -0.15;
    unicornFloat.add(earInner);
  }

  // Golden unicorn horn
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.3, 12), goldHornMat);
  horn.position.set(0, 0.97, 0.73);
  horn.rotation.x = 0.42;
  horn.castShadow = true;
  unicornFloat.add(horn);

  // Pastel 80s rainbow mane tufts along back of neck
  const maneMats = [vinylPinkMat, vinylCyanMat, vinylYellowMat, vinylPurpleMat];
  for (let m = 0; m < 4; m++) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.095 - m * 0.008, 10, 8), maneMats[m]);
    tuft.position.set(0, 0.8 - m * 0.13, 0.46 - m * 0.02);
    tuft.scale.set(0.65, 1.0, 1.25);
    unicornFloat.add(tuft);
  }

  // Matching pastel rainbow tail at the rear (-Z) of the ring
  for (let t = 0; t < 3; t++) {
    const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), maneMats[t]);
    tailTuft.position.set((t - 1) * 0.07, 0.24 + (t === 1 ? 0.05 : 0), -0.74);
    tailTuft.scale.set(0.8, 1.1, 1.4);
    unicornFloat.add(tailTuft);
  }

  scene.add(unicornFloat);
  let floatOffsetX = 0;
  let floatOffsetZ = 0;

  // 2 Rooftop Sun Loungers on the sunny south terrace beside the pool
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f2eae2', roughness: 0.65 });
  const padCoralMat = new THREE.MeshStandardMaterial({ color: '#e66e8e', roughness: 0.8 });
  for (const lx of [40.2, 43.4]) {
    const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 2.0), whiteMat);
    lounger.position.set(lx, roofY + 0.15, -36.5);
    lounger.castShadow = true;
    scene.add(lounger);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 1.6), padCoralMat);
    pad.position.set(lx, roofY + 0.28, -36.5);
    scene.add(pad);
  }

  // ---------------------------------------------------------------------------
  // Purchasable Rooftop Penthouse Cocktailbar ($1,800) on the West Terrace (33.8, -35.2)
  // ---------------------------------------------------------------------------
  const barX = 33.8;
  const barZ = -35.2;
  let rooftopBarOwned = false;

  // 1) Pre-purchase Holographic Neon Marker ("DACH-BAR KAUFEN · $1.800")
  const barBuyMarkerGroup = new THREE.Group();
  barBuyMarkerGroup.position.set(barX, roofY, barZ);
  const buyRing = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.55, 28),
    new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 2.0,
      side: THREE.DoubleSide,
    }),
  );
  buyRing.rotation.x = -Math.PI / 2;
  buyRing.position.y = 0.04;
  barBuyMarkerGroup.add(buyRing);

  const buySignTex = createNeonSignTexture('COCKTAILBAR $1800', '#ff4fa3');
  const buySign = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.65, 0.1),
    new THREE.MeshStandardMaterial({
      map: buySignTex,
      emissive: '#ffffff',
      emissiveMap: buySignTex,
      emissiveIntensity: 1.7,
    }),
  );
  buySign.position.set(0, 1.35, 0);
  buySign.userData.dynamic = true;
  barBuyMarkerGroup.add(buySign);
  scene.add(barBuyMarkerGroup);

  // 2) Full 3D 80s Rooftop Penthouse Cocktailbar (hidden until purchased!)
  const rooftopBarGroup = new THREE.Group();
  rooftopBarGroup.position.set(barX, roofY, barZ);

  const barBaseMat = new THREE.MeshStandardMaterial({ color: '#f4e6d8', roughness: 0.45 });
  const barTopMat = new THREE.MeshStandardMaterial({ color: '#1d1828', roughness: 0.16, metalness: 0.35 });
  const barWoodMat = new THREE.MeshStandardMaterial({ color: '#7a4b32', roughness: 0.62 });

  // Main L-shaped bar counter facing East (+X toward the pool & Ocean Drive)
  const mainCounter = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 4.2), barBaseMat);
  mainCounter.position.set(0.7, 0.525, 0);
  mainCounter.castShadow = true;
  mainCounter.receiveShadow = true;
  rooftopBarGroup.add(mainCounter);

  const counterTopSlab = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 4.45), barTopMat);
  counterTopSlab.position.set(0.75, 1.08, 0);
  rooftopBarGroup.add(counterTopSlab);

  const counterNeon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 4.25), pinkNeon);
  counterNeon.position.set(1.2, 0.99, 0);
  rooftopBarGroup.add(counterNeon);

  const kickNeon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 4.15), cyanNeon);
  kickNeon.position.set(1.18, 0.06, 0);
  rooftopBarGroup.add(kickNeon);

  // Back bar credenza & backlit liquor bottle rack
  const backCredenza = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 3.8), barWoodMat);
  backCredenza.position.set(-1.35, 0.475, 0);
  backCredenza.castShadow = true;
  rooftopBarGroup.add(backCredenza);

  const bottleRack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 3.4), barTopMat);
  bottleRack.position.set(-1.52, 1.42, 0);
  rooftopBarGroup.add(bottleRack);

  const bottleColors = ['#36f1e6', '#ff4fa3', '#ffd15c', '#52f29c', '#ff7b54', '#b388ff'];
  for (let i = 0; i < 12; i++) {
    const col = bottleColors[i % bottleColors.length];
    const btl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.048, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.75, roughness: 0.2 }),
    );
    const row = i < 6 ? 0 : 1;
    btl.position.set(-1.38, 1.18 + row * 0.44, -1.25 + (i % 6) * 0.5);
    rooftopBarGroup.add(btl);
  }

  // Chrome Cocktail Shaker & 2 Neon Miami Vice Cocktails on the Bar Top!
  const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.036, 0.24, 10), chromeMat);
  shaker.position.set(0.62, 1.25, -0.55);
  rooftopBarGroup.add(shaker);

  for (const czOff of [0.35, 0.85]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.038, 0.14, 8), chromeMat);
    stem.position.set(0.95, 1.2, czOff);
    const glass = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.12, 10),
      new THREE.MeshStandardMaterial({
        color: czOff > 0.5 ? '#ff4fa3' : '#36f1e6',
        emissive: czOff > 0.5 ? '#ff4fa3' : '#36f1e6',
        emissiveIntensity: 0.95,
      }),
    );
    glass.rotation.x = Math.PI;
    glass.position.set(0.95, 1.31, czOff);
    rooftopBarGroup.add(stem, glass);
  }

  // 3 Chrome & Pastel-Pink Bar Stools along the East side
  for (const sz of [-1.25, 0, 1.25]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.76, 8), chromeMat);
    leg.position.set(1.68, 0.38, sz);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 12), chromeMat);
    base.position.set(1.68, 0.02, sz);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.1, 14), padCoralMat);
    seat.position.set(1.68, 0.78, sz);
    rooftopBarGroup.add(leg, base, seat);
  }

  // 4 Teak Pergola Posts + Overhead Slatted Canopy + Glowing "SUNSET BAR" Neon Sign!
  for (const [px, pz] of [
    [-1.6, -2.0],
    [-1.6, 2.0],
    [1.2, -2.0],
    [1.2, 2.0],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.95, 0.16), barWoodMat);
    post.position.set(px, 1.475, pz);
    post.castShadow = true;
    rooftopBarGroup.add(post);
  }
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 4.4), barWoodMat);
  canopyRoof.position.set(-0.2, 2.98, 0);
  canopyRoof.castShadow = true;
  rooftopBarGroup.add(canopyRoof);

  const roofBarSignTex = createNeonSignTexture('SUNSET BAR', '#36f1e6');
  const roofBarSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.72, 3.1),
    new THREE.MeshStandardMaterial({
      map: roofBarSignTex,
      emissive: '#ffffff',
      emissiveMap: roofBarSignTex,
      emissiveIntensity: 1.85,
    }),
  );
  roofBarSign.position.set(1.42, 2.92, 0);
  rooftopBarGroup.add(roofBarSign);

  rooftopBarGroup.visible = false;
  scene.add(rooftopBarGroup);

  const syncRooftopBarVisuals = (): void => {
    barBuyMarkerGroup.visible = !rooftopBarOwned;
    rooftopBarGroup.visible = rooftopBarOwned;
  };

  const availableFood: FoodItem[] = [];
  const syncAvailableFood = (): FoodItem[] => {
    availableFood.length = 0;
    for (let i = 0; i < foodItems.length; i++) {
      if (foodItems[i].available) availableFood.push(foodItems[i]);
    }
    return availableFood;
  };

  return {
    position: new THREE.Vector3(cx, 0.2, cz),
    isInside: (pos: THREE.Vector3) =>
      pos.x > cx - 10 &&
      pos.x < cx + 10 &&
      pos.z > cz - 9 &&
      pos.z < cz + 9 &&
      pos.y < floorH + 0.3,
    isInGarage: (pos: THREE.Vector3) =>
      pos.x > cx - 9.5 &&
      pos.x < cx + 9.5 &&
      pos.z > cz + 2.6 &&
      pos.z < cz + 8.8 &&
      pos.y < floorH,
    isNearLounge: (pos: THREE.Vector3) =>
      pos.x > cx - 9 &&
      pos.x < cx + 3 &&
      pos.z > cz - 8.5 &&
      pos.z < cz - 1.5 &&
      pos.y < 2.2,
    isNearWardrobe: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - (cx - 5.5), pos.z - (cz - 7.0)) < 2.6 && pos.y < 2.2,
    isNearFridge: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - fridgeX, pos.z - (fridgeZ - 1.3)) < 2.2 && pos.y < 2.2,
    isNearRooftopBar: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - (barX + 1.0), pos.z - barZ) < 3.4 && pos.y > roofY - 0.8,
    isRooftopBarOwned: () => rooftopBarOwned,
    setRooftopBarOwned: (owned: boolean) => {
      rooftopBarOwned = owned;
      syncRooftopBarVisuals();
    },
    getFoodItems: syncAvailableFood,
    consumeFood: (item: FoodItem) => {
      if (!item.available) return;
      item.available = false;
      item.mesh.visible = false;
      item.respawnTimer = 20.0;
    },
    getCabinetWeapons: () => cabinetWeapons,
    getTvMesh: () => tvGroup,
    toggleTv: (cash: number, wantedStars: number) => {
      const on = viceTv.toggle(cash, wantedStars);
      tvLedMat.color.set(on ? '#38f28a' : '#ff2244');
      return on;
    },
    isTvOn: () => viceTv.isOn,
    update: (
      elapsed: number,
      dt: number,
      playerPos?: THREE.Vector3,
      cash = 0,
      wantedStars = 0,
      cameraYaw?: number,
      performanceMode = false,
    ) => {
      const clampedDt = Math.min(dt, 0.05);
      const blend = 1 - Math.exp(-6.5 * clampedDt);
      const shDistSq = playerPos ? (playerPos.x - cx) ** 2 + (playerPos.z - cz) ** 2 : 0;
      // Modulate intensity (NEVER light.visible!) so NUM_POINT_LIGHTS stays constant
      loungeLight.intensity = shDistSq < 38 * 38 ? 26 : 0;
      const inside = playerPos
        ? playerPos.x > cx - 10 &&
          playerPos.x < cx + 10 &&
          playerPos.z > cz - 9 &&
          playerPos.z < cz + 9 &&
          playerPos.y < floorH + 0.3
        : false;
      // Enable live Reflector mirror ONLY when in Lounge, within 10.5m of mirror, not facing away, & not in perf mode
      const inLounge = inside && !!playerPos && playerPos.z < cz + 2.5 && playerPos.y < 3.5;
      const nearMirror =
        inLounge && !!playerPos && (playerPos.x - mirrorX) ** 2 + (playerPos.z - mirrorZ) ** 2 < 10.5 * 10.5;
      const facingMirrorWall = cameraYaw === undefined ? true : Math.cos(cameraYaw) > -0.35;
      mirrorReflector.visible = !performanceMode && nearMirror && facingMirrorWall;
      if (!rooftopBarOwned) {
        buySign.rotation.y = elapsed * 0.9;
        buySign.position.y = 1.35 + Math.sin(elapsed * 2.4) * 0.08;
      }
      viceTv.update(clampedDt, elapsed, inside, cash, wantedStars);

      // Restock consumed food items after 20s
      for (const f of foodItems) {
        if (!f.available) {
          f.respawnTimer -= clampedDt;
          if (f.respawnTimer <= 0) {
            f.available = true;
            f.mesh.visible = true;
          }
        }
      }

      // Automatic Garage Door, Sliding Doors, Fridge Door & Gun Cabinet Doors proximity sensors
      const inGarageDoorZone = playerPos
        ? playerPos.x > cx - 9.5 &&
          playerPos.x < cx + 14.5 &&
          Math.abs(playerPos.z - (cz + 5.7)) < 3.6 &&
          playerPos.y < 4.5
        : false;
      const distFront = playerPos ? Math.hypot(playerPos.x - (cx + 10.0), playerPos.z - (cz - 3.0)) : 99;
      const distInner = playerPos ? Math.hypot(playerPos.x - (cx - 5.0), playerPos.z - (cz + 2.5)) : 99;
      const distFridge = playerPos ? Math.hypot(playerPos.x - fridgeX, playerPos.z - (fridgeZ - 1.3)) : 99;
      const distCabinet = playerPos ? Math.hypot(playerPos.x - (cabDoorX + 1.1), playerPos.z - cabZ) : 99;

      const wantGarage = inGarageDoorZone ? 1 : 0;
      const wantFront = distFront < 4.5 && (playerPos?.y ?? 0) < 4.5 ? 1 : 0;
      const wantInner = distInner < 4.0 && (playerPos?.y ?? 0) < 4.5 ? 1 : 0;
      const wantFridge = distFridge < 2.6 && (playerPos?.y ?? 0) < 2.2 ? 1 : 0;
      const wantCabinet = distCabinet < 2.8 && (playerPos?.y ?? 0) < 2.2 ? 1 : 0;

      const garageBlend = 1 - Math.exp(-8.5 * clampedDt);
      garageOpenT += (wantGarage - garageOpenT) * garageBlend;
      frontOpenT += (wantFront - frontOpenT) * blend;
      innerOpenT += (wantInner - innerOpenT) * blend;
      fridgeOpenT += (wantFridge - fridgeOpenT) * blend;
      cabOpenT += (wantCabinet - cabOpenT) * blend;

      // Swing fridge door smoothly open to reveal the lit food shelves!
      fridgeDoorPivot.rotation.y = -fridgeOpenT * 1.85;

      // Swing double gun cabinet doors outward to showcase the 5 mounted weapons!
      cabDoorNorth.rotation.y = -cabOpenT * 1.95;
      cabDoorSouth.rotation.y = cabOpenT * 1.95;

      // Roll garage door cleanly upward into lintel
      garageDoorGroup.scale.y = Math.max(0.06, 1 - garageOpenT * 0.94);

      // Slide double glass front doors open
      frontDoorN.position.z = cz - 3.75 - frontOpenT * 1.42;
      frontDoorS.position.z = cz - 2.25 + frontOpenT * 1.42;

      // Slide interior garage-to-lounge door into the right partition wall
      innerDoor.position.x = cx - 5.0 + innerOpenT * 2.25;

      // Gentle water shimmer (calm, never blinding)
      poolMat.emissiveIntensity = 0.2 + Math.sin(elapsed * 2.2) * 0.05;
      poolWater.position.y = roofY - 0.16 + Math.sin(elapsed * 1.9) * 0.025;

      // Bobbing & gently drifting inflatable unicorn swim ring (nudges away if player swims into it!)
      if (playerPos && playerPos.y > roofY - 1.4) {
        const dx = unicornFloat.position.x - playerPos.x;
        const dz = unicornFloat.position.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.15 && dist > 0.001) {
          const push = (1.15 - dist) * 2.6 * clampedDt;
          floatOffsetX = THREE.MathUtils.clamp(floatOffsetX + (dx / dist) * push, -2.0, 1.8);
          floatOffsetZ = THREE.MathUtils.clamp(floatOffsetZ + (dz / dist) * push, -1.3, 1.5);
        }
      }
      floatOffsetX *= Math.exp(-0.25 * clampedDt);
      floatOffsetZ *= Math.exp(-0.25 * clampedDt);

      unicornFloat.position.x = floatBaseX + floatOffsetX + Math.sin(elapsed * 0.42) * 0.55;
      unicornFloat.position.z = floatBaseZ + floatOffsetZ + Math.cos(elapsed * 0.33) * 0.42;
      unicornFloat.position.y = floatWaterY + Math.sin(elapsed * 1.9 + 0.6) * 0.035;
      unicornFloat.rotation.y = elapsed * 0.22 + Math.sin(elapsed * 0.5) * 0.35;
      unicornFloat.rotation.x = Math.sin(elapsed * 1.6) * 0.055;
      unicornFloat.rotation.z = Math.cos(elapsed * 1.35) * 0.055;
    },
  };
}

function createPoolTileTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b889c';
  ctx.fillRect(0, 0, size, size);

  const step = 16;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const shade = ((x + y) / step) % 2 === 0 ? '#2296ab' : '#197d91';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  return tex;
}
