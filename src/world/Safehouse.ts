import * as THREE from 'three';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';

export interface SafehouseHandle {
  position: THREE.Vector3;
  isInside: (pos: THREE.Vector3) => boolean;
  isInGarage: (pos: THREE.Vector3) => boolean;
  isNearLounge: (pos: THREE.Vector3) => boolean;
  isNearWardrobe: (pos: THREE.Vector3) => boolean;
  update: (elapsed: number) => void;
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
  const cx = 40;
  const cz = -40;
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
  // - Open 5.6m Garage bay (z: -37 .. -31.4)
  // - Open 3.0m Lounge doorway (z: -44.5 .. -41.5)
  addBox(wallT, floorH, 4.5, cx + 10, 0.18 + floorH / 2, cz - 6.75, stuccoMat); // north corner
  addBox(wallT, floorH, 4.0, cx + 10, 0.18 + floorH / 2, cz + 0.5, stuccoMat); // between lounge door & garage
  addBox(wallT, floorH - 3.2, 3.0, cx + 10, 0.18 + 3.2 + (floorH - 3.2) / 2, cz - 3.0, stuccoMat); // lounge door lintel
  addBox(wallT, floorH - 3.5, 6.2, cx + 10, 0.18 + 3.5 + (floorH - 3.5) / 2, cz + 5.7, stuccoMat); // garage lintel

  // Rooftop Deck Slab split around the recessed Pool Basin (pool spans x: 38.5..46.5, z: -41.3..-36.3)
  const slabY = 0.18 + floorH + 0.18;
  const slabH = 0.36;
  // West deck strip (x: 29.7 .. 38.5 -> w=8.8, center=34.1)
  addBox(8.8, slabH, 18.6, 34.1, slabY, cz, stuccoMat);
  // East deck strip (x: 46.5 .. 50.3 -> w=3.8, center=48.4)
  addBox(3.8, slabH, 18.6, 48.4, slabY, cz, stuccoMat);
  // North deck strip between x=38.5..46.5 (z: -49.3 .. -41.3 -> d=8.0, center=-45.3)
  addBox(8.0, slabH, 8.0, 42.5, slabY, -45.3, stuccoMat);
  // South deck strip between x=38.5..46.5 (z: -36.3 .. -30.7 -> d=5.6, center=-33.5)
  addBox(8.0, slabH, 5.6, 42.5, slabY, -33.5, stuccoMat);

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

  // Exterior Art-Deco neon trim band around the rooftop edge (subtle glow so terrace isn't blinding)
  const softTrimMat = new THREE.MeshStandardMaterial({
    color: '#36f1e6',
    emissive: '#36f1e6',
    emissiveIntensity: 0.95,
    roughness: 0.3,
  });
  const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(20.75, 0.12, 18.75), softTrimMat);
  roofTrim.position.set(cx, 0.18 + floorH + 0.32, cz);
  scene.add(roofTrim);

  // Garage floor neon guide strips
  for (const gz of [cz + 4.2, cz + 7.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.03, 0.12), cyanNeon);
    strip.position.set(cx + 1.2, 0.22, gz);
    scene.add(strip);
  }
  const garageLight = new THREE.PointLight('#fff0d4', 22, 20, 1.6);
  garageLight.position.set(cx + 1, 4.4, cz + 5.7);
  scene.add(garageLight);

  // ---------------------------------------------------------------------------
  // Safehouse Lounge Furnishings (z: -49 .. -37.5)
  // ---------------------------------------------------------------------------
  const loungeLight = new THREE.PointLight('#ffb8d9', 26, 22, 1.5);
  loungeLight.position.set(cx, 4.5, cz - 3.2);
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

  // 80s Retro CRT TV on Credenza
  const tvBody = new THREE.MeshStandardMaterial({ color: '#241d2e', roughness: 0.5 });
  addBox(2.2, 0.75, 0.75, cx - 1.5, 0.2 + 0.375, cz - 2.4, tvBody);
  const crt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.65), tvBody);
  crt.position.set(cx - 1.5, 1.38, cz - 2.4);
  scene.add(crt);
  const tvScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.68),
    new THREE.MeshBasicMaterial({ color: '#36f1e6' }),
  );
  tvScreen.rotation.y = Math.PI;
  tvScreen.position.set(cx - 1.5, 1.4, cz - 2.74);
  scene.add(tvScreen);

  // Personal Weapon Wall along West Wall (x = 30.5, z = -44)
  const rackMat = new THREE.MeshStandardMaterial({ color: '#1a1224', roughness: 0.4, metalness: 0.6 });
  addBox(0.35, 2.4, 3.8, cx - 9.4, 0.2 + 1.4, cz - 4.2, rackMat);
  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.5, 3.9), pinkNeon);
  rackFrame.position.set(cx - 9.45, 0.2 + 1.4, cz - 4.2);
  scene.add(rackFrame);
  // Mounted weapon silhouettes
  const gunSilMat = new THREE.MeshStandardMaterial({ color: '#d8e4f0', metalness: 0.85, roughness: 0.2 });
  for (let i = 0; i < 3; i++) {
    const gunSil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 1.15 - i * 0.18), gunSilMat);
    gunSil.position.set(cx - 9.18, 1.2 + i * 0.52, cz - 4.2);
    scene.add(gunSil);
  }

  // Wardrobe Closet (x = 34.5, z = -48.1)
  const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a44', roughness: 0.65 });
  addBox(2.2, 2.5, 0.9, cx - 5.5, 0.2 + 1.25, cz - 8.1, woodMat);

  // Cash Vault / Safe with glowing gold bars & cash stacks (x = 45.5, z = -48.0)
  const vaultMat = new THREE.MeshStandardMaterial({ color: '#2b2d3c', metalness: 0.85, roughness: 0.25 });
  addBox(1.8, 1.8, 1.3, cx + 5.5, 0.2 + 0.9, cz - 7.9, vaultMat);
  const vaultDial = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 16), goldNeon);
  vaultDial.position.set(cx + 5.5, 1.25, cz - 7.22);
  scene.add(vaultDial);

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
  for (let s = 0; s < steps; s++) {
    const topY = 0.18 + (s + 1) * stepH;
    const sx = stairStartX + s * stepRun;
    addBox(stepRun + 0.06, topY, 2.0, sx, topY / 2, stairZ, stairMat, true, 'stairs');
  }
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

  // Recessed Pool Basin (x: 38.5..46.5, z: -41.3..-36.3, depth = 1.25m below deck!)
  const poolCX = 42.5;
  const poolCZ = -38.8;
  const poolFloorY = roofY - 1.25;
  const poolTileMat = new THREE.MeshStandardMaterial({ color: '#1b7a8c', roughness: 0.35, metalness: 0.1 });

  // Solid recessed pool bottom (player can drop right in and wade/swim chest-deep!)
  addBox(8.4, 0.25, 5.4, poolCX, poolFloorY - 0.125, poolCZ, poolTileMat, false, 'pool-floor');
  // Recessed pool inner walls
  addBox(0.24, 1.25, 5.2, 38.5, poolFloorY + 0.625, poolCZ, poolTileMat, false, 'pool-wall');
  addBox(0.24, 1.25, 5.2, 46.5, poolFloorY + 0.625, poolCZ, poolTileMat, false, 'pool-wall');
  addBox(8.2, 1.25, 0.24, poolCX, poolFloorY + 0.625, -41.3, poolTileMat, false, 'pool-wall');
  addBox(8.2, 1.25, 0.24, poolCX, poolFloorY + 0.625, -36.3, poolTileMat, false, 'pool-wall');

  // Underwater walk-out steps along the west edge of the pool (0.24m risers -> smooth walk right out!)
  for (let s = 0; s < 5; s++) {
    const stepTop = poolFloorY + (s + 1) * 0.24;
    addBox(0.42, stepTop - poolFloorY, 2.2, 38.85 + (4 - s) * 0.38, (stepTop + poolFloorY) / 2, poolCZ, poolTileMat, false, 'pool-stairs');
  }

  // Translucent turquoise water surface (NO collider -> player splashes right through it!)
  const poolMat = new THREE.MeshStandardMaterial({
    color: '#22c7d4',
    emissive: '#0c5c6b',
    emissiveIntensity: 0.28, // stays well below bloom threshold (0.86) -> calm luxury glow, never blinding!
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
  });
  const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(7.9, 4.9), poolMat);
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set(poolCX, roofY - 0.14, poolCZ);
  scene.add(poolWater);

  // Soft underwater accent light (gentle turquoise tint, no blinding glare)
  const poolLight = new THREE.PointLight('#28c8d8', 7, 14, 1.8);
  poolLight.position.set(poolCX, roofY + 0.9, poolCZ);
  scene.add(poolLight);

  // 2 Rooftop Sun Loungers beside the pool (non-emissive matte coral pads)
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f2eae2', roughness: 0.65 });
  const padCoralMat = new THREE.MeshStandardMaterial({ color: '#e66e8e', roughness: 0.8 });
  for (const lz of [cz - 3.6, cz - 5.4]) {
    const lounger = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.85), whiteMat);
    lounger.position.set(cx + 4.5, roofY + 0.15, lz);
    lounger.castShadow = true;
    scene.add(lounger);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.72), padCoralMat);
    pad.position.set(cx + 4.5, roofY + 0.28, lz);
    scene.add(pad);
  }

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
      Math.hypot(pos.x - (cx - 5.5), pos.z - (cz - 7.0)) < 2.4 && pos.y < 2.2,
    update: (elapsed: number) => {
      // Gentle water shimmer (calm, never blinding) & TV screen flicker
      poolMat.emissiveIntensity = 0.22 + Math.sin(elapsed * 2.2) * 0.06;
      poolWater.position.y = roofY - 0.14 + Math.sin(elapsed * 1.9) * 0.025;
      (tvScreen.material as THREE.MeshBasicMaterial).color.setHSL(
        0.5 + Math.sin(elapsed * 1.4) * 0.16,
        0.85,
        0.62,
      );
    },
  };
}
