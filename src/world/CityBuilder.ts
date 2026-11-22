import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AABB } from '../types';
import {
  BLOCK_CENTERS,
  BLOCK_SIZE,
  generateCityLayout,
  ROAD_COORDS,
  ROAD_WIDTH,
  type CityLayout,
} from './CityLayout';
import {
  createArtDecoFacadeTexture,
  createBeachSandTextures,
  createBuildingBoxGeometry,
  createNeonSignTexture,
  createSidewalkTexture,
  createWetAsphaltTextures,
} from './Textures';
import { SpatialGrid } from '../engine/SpatialGrid';
import { buildBeachHighlights } from './BeachProps';
import { buildNeonClub } from './NeonClub';
import { buildPoliceStation } from './PoliceStation';
import { buildSafehouse, type CabinetWeapon, type FoodItem } from './Safehouse';
import { buildStarfishIsland, type SuperyachtHandle } from './StarfishIsland';
import { buildStuntRamps, type StuntRamp } from './StuntRamps';
import { buildTrafficLights } from './TrafficLights';
import { buildVicePort, type ImportExportSpec } from './VicePort';
import { buildWestDistrict } from './WestDistrict';
import { buildNorthPoint, type MarinaBoatInit } from './NorthPoint';

export interface MiamiWorld {
  colliders: AABB[];
  solidVehicleColliders: AABB[];
  solidNpcColliders: AABB[];
  playerGrid: SpatialGrid;
  vehicleGrid: SpatialGrid;
  npcGrid: SpatialGrid;
  worldMeshes: THREE.Object3D[];
  cameraMeshes: THREE.Object3D[];
  stuntRamps: StuntRamp[];
  layout: CityLayout;
  maverickSpawn: THREE.Vector3;
  yacht: SuperyachtHandle;
  marinaBoats: MarinaBoatInit[];
  isNearIslandVault: (pos: THREE.Vector3) => boolean;
  isNearYachtLoot: (pos: THREE.Vector3) => boolean;
  takeIslandVault: () => void;
  takeYachtLoot: () => void;
  isCarInExportBay: (pos: THREE.Vector3) => boolean;
  canDeliverExportVehicle: (vehicleName: string) => ImportExportSpec | null;
  deliverExportVehicle: (vehicleName: string) => { reward: number; allDoneBonus: number };
  isCarInTuningBay: (pos: THREE.Vector3) => boolean;
  isCarInLowriderArena: (pos: THREE.Vector3) => boolean;
  isNearDinerCounter: (pos: THREE.Vector3) => boolean;
  isNearPetShop: (pos: THREE.Vector3) => boolean;
  isNearBankVault: (pos: THREE.Vector3) => boolean;
  takeBankVault: () => void;
  isInsideWestInterior: (pos: THREE.Vector3) => boolean;
  isNearMarinaLoot: (pos: THREE.Vector3) => boolean;
  takeMarinaLoot: () => void;
  isNearLighthouseSpot: (pos: THREE.Vector3) => boolean;
  claimLighthouseBonus: () => boolean;
  cycleTimeOfDay: () => string;
  toggleRain: () => boolean;
  isInsideClub: (pos: THREE.Vector3) => boolean;
  isInsideSafehouse: (pos: THREE.Vector3) => boolean;
  isInsidePoliceStation: (pos: THREE.Vector3) => boolean;
  isNearPdDesk: (pos: THREE.Vector3) => boolean;
  isNearPdKevlar: (pos: THREE.Vector3) => boolean;
  isNearPdArmory: (pos: THREE.Vector3) => boolean;
  isNearPdUniform: (pos: THREE.Vector3) => boolean;
  isNearPdEvidenceCash: (pos: THREE.Vector3) => boolean;
  takePdKevlar: () => void;
  takePdEvidenceCash: () => void;
  triggerPdAlarm: () => void;
  clearPdAlarm: () => void;
  lockPdCellBriefly: () => void;
  isInSafehouseGarage: (pos: THREE.Vector3) => boolean;
  isNearSafehouseLounge: (pos: THREE.Vector3) => boolean;
  isNearSafehouseWardrobe: (pos: THREE.Vector3) => boolean;
  isNearSafehouseFridge: (pos: THREE.Vector3) => boolean;
  isNearSafehouseRooftopBar: (pos: THREE.Vector3) => boolean;
  isSafehouseRooftopBarOwned: () => boolean;
  setSafehouseRooftopBarOwned: (owned: boolean) => void;
  getFoodItems: () => FoodItem[];
  consumeFood: (item: FoodItem) => void;
  getCabinetWeapons: () => CabinetWeapon[];
  getTvMesh: () => THREE.Object3D;
  toggleTv: (cash: number, wantedStars: number) => boolean;
  isTvOn: () => boolean;
  isNearClubBar: (pos: THREE.Vector3) => boolean;
  getClubProximity: (pos: THREE.Vector3) => number;
  getGroundHeight: (x: number, z: number) => number;
  shouldTrafficStop: (x: number, z: number, yaw: number) => boolean;
  onThunder?: () => void;
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
 * Builds the Phase 2 Miami Golden-Hour / Dusk Post-Rain Coastal District:
 * - 3x3 Art-Deco city blocks with alleys & neon hotel signs
 * - Wet post-rain asphalt with organic specular puddles + PMREM sunset reflections
 * - Ocean Drive palm-lined promenade, golden sand beach & animated dusk ocean
 * - Streetlights, crosswalks, curbs, and warm sunset lighting
 */
export function buildMiamiCity(scene: THREE.Scene, renderer: THREE.WebGLRenderer): MiamiWorld {
  const colliders: AABB[] = [];
  const worldMeshes: THREE.Object3D[] = [];
  const layout = generateCityLayout();

  // ---------------------------------------------------------------------------
  // 1) Golden-Hour / Dusk Sky Dome + PMREM Environment Map (for wet reflections)
  // ---------------------------------------------------------------------------
  const sunDir = new THREE.Vector3(-0.78, 0.13, -0.61).normalize();

  const createSkyMat = () =>
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#1a1036') },
        midColor: { value: new THREE.Color('#8e3a73') },
        horizonColor: { value: new THREE.Color('#ff8c52') },
        lowerColor: { value: new THREE.Color('#34193d') },
        sunDir: { value: sunDir },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 lowerColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.24, max(h, 0.0)));
          col = mix(col, topColor, smoothstep(0.18, 0.72, max(h, 0.0)));
          col = mix(lowerColor, col, smoothstep(-0.15, 0.02, h));

          float sunAmt = max(dot(dir, sunDir), 0.0);
          col += vec3(1.0, 0.58, 0.30) * pow(sunAmt, 24.0) * 0.95;
          col += vec3(1.0, 0.90, 0.68) * pow(sunAmt, 220.0) * 1.8;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

  const skyMat = createSkyMat();
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), skyMat);
  scene.add(skyMesh);

  // Build PMREM reflections from the dusk sky + subtle neon accents so wet puddles gleam
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), createSkyMat()));
  const envPink = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 1),
    new THREE.MeshBasicMaterial({ color: '#ff4fa3' }),
  );
  envPink.position.set(16, 4, 12);
  envScene.add(envPink);
  const envCyan = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 1),
    new THREE.MeshBasicMaterial({ color: '#36f1e6' }),
  );
  envCyan.position.set(-16, 4, 12);
  envScene.add(envCyan);
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.15;
  pmrem.dispose();

  // Warm rose-violet coastal haze
  scene.fog = new THREE.FogExp2('#4d254d', 0.0068);

  // ---------------------------------------------------------------------------
  // 2) Lighting
  // ---------------------------------------------------------------------------
  const hemiLight = new THREE.HemisphereLight('#b582db', '#2c1b3b', 0.9);
  scene.add(hemiLight);

  const sunOffset = sunDir.clone().multiplyScalar(110);
  const shadowHalf = 75;
  const shadowTexel = (shadowHalf * 2) / 2048;
  const sunLight = new THREE.DirectionalLight('#ff9854', 2.4);
  sunLight.position.copy(sunOffset);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.camera.left = -shadowHalf;
  sunLight.shadow.camera.right = shadowHalf;
  sunLight.shadow.camera.top = shadowHalf;
  sunLight.shadow.camera.bottom = -shadowHalf;
  sunLight.shadow.bias = -0.0005;
  sunLight.userData.dynamic = true;
  sunLight.target.userData.dynamic = true;
  scene.add(sunLight);
  scene.add(sunLight.target);
  let lastSunX = 0;
  let lastSunZ = 0;

  // ---------------------------------------------------------------------------
  // 3) Wet Post-Rain Asphalt Base & Street Markings
  // ---------------------------------------------------------------------------
  const asphalt = createWetAsphaltTextures();
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    roughnessMap: asphalt.roughnessMap,
    roughness: 1.0, // modulated by roughnessMap + world-space macro puddle variation
    metalness: 0.22,
    envMapIntensity: 1.55,
  });
  // Zero-cost world-space macro wetness modulation breaks up any visible tile repetition across the whole city!
  roadMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoadWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoadWorldPos;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          vec2 wp = vRoadWorldPos.xz;
          float macro =
            sin(wp.x * 0.047 + wp.y * 0.031) * 0.42 +
            cos(wp.x * 0.023 - wp.y * 0.061) * 0.36 +
            sin(wp.x * 0.113 + wp.y * 0.089) * 0.22;
          float dryPatch = smoothstep(-0.15, 0.55, macro);
          roughnessFactor = clamp(mix(roughnessFactor * 0.85, max(roughnessFactor, 0.58), dryPatch * 0.82), 0.03, 0.88);
        }`,
      );
  };

  const roadBase = new THREE.Mesh(new THREE.PlaneGeometry(144, 144), roadMat);
  roadBase.rotation.x = -Math.PI / 2;
  roadBase.position.set(0, 0, 0);
  roadBase.receiveShadow = true;
  scene.add(roadBase);
  worldMeshes.push(roadBase);

  // Dashed yellow centerlines & crosswalk stripes (merged via InstancedMesh for speed)
  const yellowLineMat = new THREE.MeshStandardMaterial({
    color: '#e6b85c',
    roughness: 0.35,
    metalness: 0.1,
  });
  const whiteLineMat = new THREE.MeshStandardMaterial({
    color: '#efe6dc',
    roughness: 0.4,
    metalness: 0.05,
  });

  const dashMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  // Horizontal & vertical road dashes between intersections
  for (const rCoord of ROAD_COORDS) {
    for (const bCenter of BLOCK_CENTERS) {
      for (let offset = -11; offset <= 11; offset += 5.5) {
        // Vertical roads (running along Z)
        dummy.position.set(rCoord, 0.012, bCenter + offset);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.set(0.22, 2.8, 1);
        dummy.updateMatrix();
        dashMatrices.push(dummy.matrix.clone());

        // Horizontal roads (running along X)
        dummy.position.set(bCenter + offset, 0.012, rCoord);
        dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        dummy.scale.set(0.22, 2.8, 1);
        dummy.updateMatrix();
        dashMatrices.push(dummy.matrix.clone());
      }
    }
  }

  const dashInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), yellowLineMat, dashMatrices.length);
  dashMatrices.forEach((m, i) => dashInst.setMatrixAt(i, m));
  dashInst.instanceMatrix.needsUpdate = true;
  scene.add(dashInst);

  // Crosswalks at inner intersections
  const cwMatrices: THREE.Matrix4[] = [];
  for (const rx of [-20, 20, 60]) {
    for (const rz of [-20, 20]) {
      for (let s = -4.0; s <= 4.0; s += 1.6) {
        // North/South crosswalks
        for (const side of [-1, 1]) {
          dummy.position.set(rx + s, 0.014, rz + side * (ROAD_WIDTH / 2 + 1.1));
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.set(0.65, 2.1, 1);
          dummy.updateMatrix();
          cwMatrices.push(dummy.matrix.clone());
        }
        // East/West crosswalks
        for (const side of [-1, 1]) {
          dummy.position.set(rx + side * (ROAD_WIDTH / 2 + 1.1), 0.014, rz + s);
          dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
          dummy.scale.set(0.65, 2.1, 1);
          dummy.updateMatrix();
          cwMatrices.push(dummy.matrix.clone());
        }
      }
    }
  }
  const cwInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), whiteLineMat, cwMatrices.length);
  cwMatrices.forEach((m, i) => cwInst.setMatrixAt(i, m));
  cwInst.instanceMatrix.needsUpdate = true;
  scene.add(cwInst);

  // ---------------------------------------------------------------------------
  // 4) Sidewalk Blocks (0.18m step-up curbs) & Art-Deco Buildings
  // ---------------------------------------------------------------------------
  const sidewalkTex = createSidewalkTexture();
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.42,
    metalness: 0.08,
  });

  const addStaticBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material | THREE.Material[],
    castShadow = true,
    tag = 'solid',
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
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

  // 3x3 raised sidewalk islands
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      addStaticBox(BLOCK_SIZE, 0.18, BLOCK_SIZE, bx, 0.09, bz, sidewalkMat, false, 'sidewalk');
    }
  }

  // Central Plaza decorative fountain / planter in block (0, 0)
  const plazaPlanterMat = new THREE.MeshStandardMaterial({ color: '#e9d7c5', roughness: 0.6 });
  addStaticBox(3.4, 0.75, 3.4, 2.2, 0.18 + 0.375, -2.2, plazaPlanterMat, true, 'prop');
  const poolMat = new THREE.MeshStandardMaterial({
    color: '#25d6d6',
    emissive: '#107a85',
    emissiveIntensity: 0.8,
    roughness: 0.08,
    metalness: 0.1,
  });
  const pool = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.6), poolMat);
  pool.position.set(2.2, 0.18 + 0.72, -2.2);
  scene.add(pool);

  // Art-Deco Buildings
  const roofMat = new THREE.MeshStandardMaterial({ color: '#4d414a', roughness: 0.7 });

  layout.buildings.forEach((b, idx) => {
    const facade = createArtDecoFacadeTexture(b.color, b.trimColor, idx * 17 + 3);
    const wallMat = new THREE.MeshStandardMaterial({
      map: facade.map,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: facade.emissiveMap,
      emissiveIntensity: 0.75,
      roughness: 0.65,
      metalness: 0.08,
    });

    const bMesh = new THREE.Mesh(createBuildingBoxGeometry(b.w, b.h, b.d), [wallMat, roofMat]);
    bMesh.position.set(b.x, 0.18 + b.h / 2, b.z);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    scene.add(bMesh);
    worldMeshes.push(bMesh);
    colliders.push({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minY: 0.18,
      maxY: 0.18 + b.h,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
      tag: 'building',
    });

    // Art-Deco stepped crown & parapet trim
    if (b.hasCrown) {
      const crownMat = new THREE.MeshStandardMaterial({ color: b.trimColor, roughness: 0.55 });
      const crown = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.72, 1.4, b.d * 0.72), crownMat);
      crown.position.set(b.x, 0.18 + b.h + 0.7, b.z);
      crown.castShadow = true;
      scene.add(crown);
    }

    // Glowing horizontal neon tube along the awning level
    const neonMat = new THREE.MeshStandardMaterial({
      color: b.neonColor,
      emissive: new THREE.Color(b.neonColor),
      emissiveIntensity: 2.6,
      roughness: 0.2,
    });
    const neonBand = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.14, 0.16, b.d + 0.14), neonMat);
    neonBand.position.set(b.x, 0.18 + 3.4, b.z);
    scene.add(neonBand);

    // Optional retro neon hotel/club sign facing the street
    if (b.signText && b.signFace) {
      const signTex = createNeonSignTexture(b.signText, b.neonColor);
      const signMat = new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: new THREE.Color('#ffffff'),
        emissiveMap: signTex,
        emissiveIntensity: 1.65,
        roughness: 0.25,
      });
      const signW = Math.min(6.4, (b.signFace === 'E' || b.signFace === 'W' ? b.d : b.w) * 0.65);
      const signH = 1.6;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.24), signMat);
      const signY = 0.18 + Math.min(b.h - 1.5, 5.4);

      if (b.signFace === 'E') {
        sign.rotation.y = Math.PI / 2;
        sign.position.set(b.x + b.w / 2 + 0.16, signY, b.z);
      } else if (b.signFace === 'W') {
        sign.rotation.y = -Math.PI / 2;
        sign.position.set(b.x - b.w / 2 - 0.16, signY, b.z);
      } else if (b.signFace === 'N') {
        sign.rotation.y = Math.PI;
        sign.position.set(b.x, signY, b.z - b.d / 2 - 0.16);
      } else {
        sign.position.set(b.x, signY, b.z + b.d / 2 + 0.16);
      }
      scene.add(sign);
    }
  });

  // ---------------------------------------------------------------------------
  // 4b) Walk-In Interiors: NEON CLUB (40, 0), VICE SAFEHOUSE (40, -40) & VICE PD PRECINCT (-40, 0)
  // ---------------------------------------------------------------------------
  const neonClub = buildNeonClub(scene, colliders, worldMeshes);
  const safehouse = buildSafehouse(scene, colliders, worldMeshes);
  const policeStation = buildPoliceStation(scene, colliders, worldMeshes);

  // ---------------------------------------------------------------------------
  // 5) Verticality: Walkable Exterior Art-Deco Rooftop Stairs & Neon Terraces
  // ---------------------------------------------------------------------------
  // 1) Central Plaza corner building terrace (stairs rise along west side of building at x=5.2, z=5.0 -> rooftop y=12.18)
  const stairMat = new THREE.MeshStandardMaterial({ color: '#e7d5c5', roughness: 0.58 });
  const railNeonMat = new THREE.MeshStandardMaterial({
    color: '#36f1e6',
    emissive: '#36f1e6',
    emissiveIntensity: 2.2,
  });

  const buildStaircase = (
    startX: number,
    startZ: number,
    dirX: number,
    dirZ: number,
    targetHeight: number,
    width: number,
  ): void => {
    const stepH = 0.24; // cleanly below PlayerController maxStepHeight (0.28m)
    const stepRun = 0.36;
    const steps = Math.ceil(targetHeight / stepH);
    const stairGeos: THREE.BufferGeometry[] = [];
    for (let s = 0; s < steps; s++) {
      const topY = 0.18 + (s + 1) * stepH;
      const sx = startX + dirX * s * stepRun;
      const sz = startZ + dirZ * s * stepRun;
      const w = dirX !== 0 ? stepRun + 0.06 : width;
      const d = dirZ !== 0 ? stepRun + 0.06 : width;
      const sg = new THREE.BoxGeometry(w, topY, d);
      sg.translate(sx, topY / 2, sz);
      stairGeos.push(sg);
      colliders.push({
        minX: sx - w / 2,
        maxX: sx + w / 2,
        minY: 0,
        maxY: topY,
        minZ: sz - d / 2,
        maxZ: sz + d / 2,
        tag: 'stairs',
      });
    }
    const mergedStairs = new THREE.Mesh(mergeGeometries(stairGeos), stairMat);
    mergedStairs.castShadow = true;
    mergedStairs.receiveShadow = true;
    scene.add(mergedStairs);
    worldMeshes.push(mergedStairs);
    for (const sg of stairGeos) sg.dispose();
    // Glowing neon handrail along the outer edge of the stairway
    const totalLen = steps * stepRun;
    const midX = startX + dirX * (totalLen * 0.5);
    const midZ = startZ + dirZ * (totalLen * 0.5);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(dirX !== 0 ? Math.hypot(totalLen, targetHeight) : 0.1, 0.1, dirZ !== 0 ? Math.hypot(totalLen, targetHeight) : 0.1),
      railNeonMat,
    );
    rail.position.set(
      midX + (dirZ !== 0 ? width * 0.48 : 0),
      0.18 + targetHeight * 0.5 + 0.9,
      midZ + (dirX !== 0 ? width * 0.48 : 0),
    );
    const slope = Math.atan2(targetHeight, totalLen);
    if (dirZ < 0) rail.rotation.x = slope;
    else if (dirZ > 0) rail.rotation.x = -slope;
    else if (dirX > 0) rail.rotation.z = slope;
    else if (dirX < 0) rail.rotation.z = -slope;
    scene.add(rail);
  };

  // Central Plaza Rooftop Lookout (climbs south along the west edge of the mint plaza building up to y=12.18)
  buildStaircase(-0.85, -0.5, 0, 1, 5.2, 2.0);
  // Mid-level Art-Deco observation deck overlooking the Central Plaza & AMMU-NEON kiosk
  addStaticBox(6.4, 0.35, 5.2, -2.6, 0.18 + 5.2, 9.6, stairMat, true, 'deck');
  const deckGlow = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.12, 5.3), railNeonMat);
  deckGlow.position.set(-2.6, 0.18 + 5.45, 9.6);
  scene.add(deckGlow);

  // Ocean Drive Sunset Overlook Deck (stairs rising from the boardwalk at x=67.5 up to a coastal sunset terrace)
  buildStaircase(68.2, -10, 0, -1, 4.8, 2.2);
  addStaticBox(5.6, 0.35, 7.0, 69.2, 0.18 + 4.8, -20.5, stairMat, true, 'deck');
  const oceanDeckNeon = new THREE.Mesh(
    new THREE.BoxGeometry(5.7, 0.14, 7.1),
    new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.3 }),
  );
  oceanDeckNeon.position.set(69.2, 0.18 + 5.05, -20.5);
  scene.add(oceanDeckNeon);

  // ---------------------------------------------------------------------------
  // 5b) Sloping Coastal Beach (Dry Dunes -> Mirror-Wet Shoreline) & Dusk Ocean
  // ---------------------------------------------------------------------------
  // Shared continuous beach & deep-ocean seabed elevation function:
  // Flush with boardwalk at x = 74 (+0.20m), sloping gently to the surf line (-0.22m at x = 98),
  // then dropping steeply into deep 6m ocean water (-6.0m)!
  // Also returns deep -6.0m seabed everywhere in the North Marina Bay (z < -98.5) and South Port Sea (z > 126.2).
  const getBeachHeight = (x: number, z: number): number => {
    if (z < -98.5 || z > 126.2) return -6.0;
    if (x <= 74) return 0;
    if (x <= 98) {
      const t = (x - 74) / 24;
      const smoothSlope = t * t * (3 - 2 * t);
      const baseY = THREE.MathUtils.lerp(0.2, -0.22, smoothSlope);
      const dune =
        (Math.sin(z * 0.085) * 0.12 + Math.cos(x * 0.16 + z * 0.04) * 0.05) *
        (1 - smoothSlope) *
        Math.min(1, (x - 74) / 5);
      return baseY + dune;
    }
    const deepT = THREE.MathUtils.clamp((x - 98) / 14, 0, 1);
    const deepSmooth = deepT * deepT * (3 - 2 * deepT);
    return THREE.MathUtils.lerp(-0.22, -6.0, deepSmooth);
  };

  // Boardwalk east of x = 66
  addStaticBox(8, 0.22, 144, 70, 0.11, 0, sidewalkMat, false, 'sidewalk');

  // Low Art-Deco coastal seawall along the boardwalk with walkable openings (leaves z = -66..-54 wide open for Causeway Bridge!)
  const seawallMat = new THREE.MeshStandardMaterial({ color: '#eedccf', roughness: 0.65 });
  addStaticBox(0.55, 0.85, 16, 73.7, 0.22 + 0.425, -45.0, seawallMat, true, 'prop');
  for (const segZ of [-16, 16, 48]) {
    addStaticBox(0.55, 0.85, 22, 73.7, 0.22 + 0.425, segZ, seawallMat, true, 'prop');
  }

  // Subdivided sloping beach mesh (x = 74 to 120) with dry-to-wet sand PBR roughness map
  const beachTex = createBeachSandTextures();
  const sandMat = new THREE.MeshStandardMaterial({
    map: beachTex.map,
    roughnessMap: beachTex.roughnessMap,
    roughness: 1.0, // modulated by roughnessMap (dry ~0.92, wet shoreline ~0.10)
    metalness: 0.14,
    envMapIntensity: 1.45,
  });

  const beachWidth = 46; // x: 74 .. 120
  const beachLength = 260;
  const beachGeo = new THREE.PlaneGeometry(beachWidth, beachLength, 44, 64);
  beachGeo.rotateX(-Math.PI / 2);
  const bPos = beachGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bPos.count; i++) {
    const worldX = bPos.getX(i) + 97; // centered at x = 97 -> spans 74..120
    const worldZ = bPos.getZ(i);
    bPos.setY(i, getBeachHeight(worldX, worldZ));
  }
  beachGeo.computeVertexNormals();

  const beach = new THREE.Mesh(beachGeo, sandMat);
  beach.position.set(97, 0, 0);
  beach.receiveShadow = true;
  scene.add(beach);
  worldMeshes.push(beach);

  // Iconic South Beach Highlights (Lifeguard Tower, Illuminated Pier to Speedboat, Loungers, Volleyball, Dune Grass)
  const beachHighlights = buildBeachHighlights(scene, colliders, worldMeshes, getBeachHeight);

  // Animated Dusk Ocean Shader with translucent shallow wash & receding shoreline foam
  const oceanUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir },
    uDeepColor: { value: new THREE.Color('#181938') },
    uShallowColor: { value: new THREE.Color('#276882') },
    uHorizonGlow: { value: new THREE.Color('#ff8e5c') },
  };
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 pos = position;
        float distFromShore = clamp((pos.x + 120.0) / 40.0, 0.0, 1.0);
        float w1 = sin(pos.x * 0.18 - uTime * 1.65) * 0.15 * distFromShore;
        float w2 = cos(pos.y * 0.14 - uTime * 1.15) * 0.11 * distFromShore;
        // Gentle rhythmic shoreline swash lifting the shallow edge
        float swash = sin(uTime * 1.35 + pos.y * 0.05) * 0.045 * (1.0 - distFromShore);
        pos.z += w1 + w2 + swash;
        vWave = w1 + w2 + swash;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uHorizonGlow;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);

        // Dynamic tide swash line oscillating across East beach x ~ 95..101
        float swashOffset = sin(uTime * 1.35 + sin(vWorldPos.z * 0.07) * 2.2) * 1.8;
        float shoreX = vWorldPos.x + swashOffset;

        // Deep-water factors for East Ocean, North Marina Bay (z < -95) & South Vice Port Sea (z > 125)
        float eastDeep = smoothstep(97.0, 122.0, vWorldPos.x);
        float northDeep = smoothstep(-95.0, -104.0, vWorldPos.z);
        float southDeep = smoothstep(124.5, 133.0, vWorldPos.z);
        float deepBlend = max(eastDeep, max(northDeep, southDeep));

        vec3 waterCol = mix(uShallowColor, uDeepColor, deepBlend);
        waterCol = mix(waterCol, uHorizonGlow, fresnel * 0.72);

        // Soft animated foam ribbon hugging the East sloping sand beach
        float onEastBeach = step(-96.0, vWorldPos.z) * step(vWorldPos.z, 126.0);
        float foamBand = smoothstep(104.0, 98.5, shoreX) * smoothstep(94.5, 98.0, shoreX) * onEastBeach;
        float foamPattern = 0.55 + 0.45 * sin(vWorldPos.z * 0.45 + uTime * 2.4) * cos(shoreX * 1.4 - uTime * 1.8);
        float foam = clamp(foamBand * foamPattern, 0.0, 1.0);
        waterCol = mix(waterCol, vec3(1.0, 0.92, 0.93), foam * 0.65);

        // Subtle golden wave crest shimmer
        waterCol += vec3(1.0, 0.72, 0.55) * max(vWave, 0.0) * 0.35;

        // Opaque deep water in North Marina, South Port & East Ocean; translucent shallow wash only at East shoreline
        float eastAlpha = smoothstep(94.5, 100.5, shoreX) * 0.94 + foam * 0.35;
        float bayAlpha = max(smoothstep(-94.0, -96.5, vWorldPos.z), smoothstep(123.5, 126.0, vWorldPos.z)) * 0.94;
        float alpha = max(eastAlpha, bayAlpha);
        gl_FragColor = vec4(waterCol, clamp(alpha, 0.0, 0.97));
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(240, 420, 48, 48), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(214, -0.18, 0); // spans x = 94 .. 334, intersecting the sloping beach around x ~ 98!
  scene.add(ocean);

  // Deep ocean seabed plane at y = -6.0m so water always looks genuinely deep everywhere
  const seabed = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshBasicMaterial({ color: '#081829' }),
  );
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.set(60, -6.0, 0);
  scene.add(seabed);

  // ---------------------------------------------------------------------------
  // 6) Palm Trees along Ocean Drive & Avenues
  // ---------------------------------------------------------------------------
  const palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[] = [];

  // Ocean Drive beachfront palms (keep Causeway Bridge corridor z = -67.5..-52.5 clear & frame the bridge entrance!)
  palmPositions.push({ x: 67.4, z: -68.2, rot: -1.1, scale: 1.0 });
  palmPositions.push({ x: 67.4, z: -51.8, rot: 0.9, scale: 1.0 });
  for (let z = -48; z <= 60; z += 12) {
    palmPositions.push({ x: 67.4, z, rot: z * 0.7, scale: 0.95 + ((Math.abs(z) % 5) * 0.05) });
    if (z + 5 > -52) {
      palmPositions.push({ x: 76.5, z: z + 5, rot: z * 1.1, scale: 0.9 + ((Math.abs(z) % 4) * 0.06) });
    }
  }
  // Boulevard corner palms on city sidewalks
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      palmPositions.push({ x: bx + 12.2, z: bz + 12.2, rot: bx + bz, scale: 0.92 });
      palmPositions.push({ x: bx - 12.2, z: bz - 12.2, rot: bx - bz, scale: 0.88 });
    }
  }

  // 6b) Starfish Island, Arched Causeway Bridge & 42m Superyacht (adds island palms before InstancedMesh build!)
  const starfish = buildStarfishIsland(scene, colliders, worldMeshes, palmPositions);

  // 6c) West District: Little Havana, Starlight 80s Diner, Banco de Vice & Vice Customs Tuning Garage (x = -66..-124)
  const westDistrict = buildWestDistrict(scene, colliders, worldMeshes, roadMat, sidewalkMat, palmPositions);

  // 6d) North Point: Coastal Highway, Vice Marina & Cape Vice 26m Lighthouse (z = -66..-128)
  const northPoint = buildNorthPoint(scene, colliders, worldMeshes, roadMat, sidewalkMat, oceanMat, palmPositions);

  const palms = buildPalmTrees(scene, palmPositions);

  // 6e) Vice Port Industrial Container Docks, 26m Gantry Cranes, Cargo Freighter & Import/Export (z = 66..140)
  const vicePort = buildVicePort(scene, colliders, worldMeshes, oceanMat);

  // ---------------------------------------------------------------------------
  // 7) Coastal Streetlights (Fixed 4-Light Nearest Pool -> Zero Shader Recompiles!), Traffic Lights & Stunt Ramps
  // ---------------------------------------------------------------------------
  const streetLights = buildStreetlights(scene);
  const trafficLights = buildTrafficLights(scene);
  const stuntRamps = [...buildStuntRamps(scene), ...vicePort.stuntRamps, ...northPoint.stuntRamps];

  // ---------------------------------------------------------------------------
  // 8) Subtle Post-Rain Mist / Lingering Drizzle Motes (GPU Vertex Animation -> 0 CPU/Upload!)
  // ---------------------------------------------------------------------------
  const mistCount = 240;
  const mistPositions = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    mistPositions[i * 3] = (Math.random() - 0.45) * 140;
    mistPositions[i * 3 + 1] = 0.5 + Math.random() * 14;
    mistPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
  const mistUniforms = { uTime: { value: 0 } };
  const mistMat = new THREE.PointsMaterial({
    color: '#ffd6e8',
    size: 0.14,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  mistMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mistUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y = 0.2 + mod(transformed.y - 0.2 - uTime * 0.35, 13.8);`,
      );
  };
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  mistPoints.frustumCulled = false;
  scene.add(mistPoints);

  // ---------------------------------------------------------------------------
  // 9) Optional Tropical Rain Shower (GPU Vertex Streak Animation -> 0 CPU/Upload!)
  // ---------------------------------------------------------------------------
  const rainCount = 420;
  const rainPositions = new Float32Array(rainCount * 6); // 2 vertices per streak (relative Y: 0 and -0.95)
  const rainSeedY = new Float32Array(rainCount * 2);
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 90;
    const ry = Math.random() * 24;
    const rz = (Math.random() - 0.5) * 90;
    rainPositions[i * 6] = rx;
    rainPositions[i * 6 + 1] = 0;
    rainPositions[i * 6 + 2] = rz;
    rainPositions[i * 6 + 3] = rx - 0.18;
    rainPositions[i * 6 + 4] = -0.95;
    rainPositions[i * 6 + 5] = rz;
    rainSeedY[i * 2] = ry;
    rainSeedY[i * 2 + 1] = ry;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeo.setAttribute('aSeedY', new THREE.BufferAttribute(rainSeedY, 1));
  const rainUniforms = { uTime: { value: 0 } };
  const rainMat = new THREE.LineBasicMaterial({
    color: '#bde9ff',
    transparent: true,
    opacity: 0.42,
  });
  rainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = rainUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSeedY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float dropY = 0.2 + mod(aSeedY - uTime * 26.0, 23.8);
        transformed.y = dropY + position.y;`,
      );
  };
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  rainLines.userData.dynamic = true;
  rainLines.visible = false;
  scene.add(rainLines);

  // Time-of-Day Presets (cycle with [T])
  const timePresets = [
    {
      name: 'GOLDEN HOUR',
      top: '#1a1036',
      mid: '#8e3a73',
      horizon: '#ff8c52',
      fog: '#4d254d',
      sunColor: '#ff9854',
      sunIntensity: 2.4,
      hemiIntensity: 0.9,
      oceanGlow: '#ff8e5c',
    },
    {
      name: 'MIAMI SUNSET',
      top: '#240b38',
      mid: '#b82e6f',
      horizon: '#ff5252',
      fog: '#5e1d44',
      sunColor: '#ff6454',
      sunIntensity: 2.1,
      hemiIntensity: 0.78,
      oceanGlow: '#ff5a7a',
    },
    {
      name: 'NEON NIGHT',
      top: '#070614',
      mid: '#19133a',
      horizon: '#3c2159',
      fog: '#140d26',
      sunColor: '#8ba4ff',
      sunIntensity: 0.65,
      hemiIntensity: 0.45,
      oceanGlow: '#36f1e6',
    },
  ];
  let timeIndex = 0;
  let rainActive = false;
  let lightningTimer = 8.0;
  let lightningFlash = 0;

  const applyTimePreset = (idx: number): string => {
    const p = timePresets[idx];
    skyMat.uniforms.topColor.value.set(p.top);
    skyMat.uniforms.midColor.value.set(p.mid);
    skyMat.uniforms.horizonColor.value.set(p.horizon);
    (scene.fog as THREE.FogExp2).color.set(p.fog);
    sunLight.color.set(p.sunColor);
    sunLight.intensity = p.sunIntensity;
    hemiLight.intensity = p.hemiIntensity;
    oceanUniforms.uHorizonGlow.value.set(p.oceanGlow);
    return p.name;
  };

  // Pre-filter large structural meshes (>= 2.2m) for 3rd-person camera wall-clip raycasts (skips tiny stairs, props & InstancedMeshes)
  const cameraMeshes = worldMeshes.filter((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj instanceof THREE.InstancedMesh) return false;
    obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox;
    if (!bb) return true;
    const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    return maxDim >= 2.2;
  });

  // Freeze matrices on ALL static world objects in the scene (skipping any dynamic subtree!)
  const freezeStaticSubtree = (obj: THREE.Object3D): void => {
    if (obj.userData.dynamic) return;
    obj.updateMatrix();
    obj.matrixAutoUpdate = false;
    for (let i = 0; i < obj.children.length; i++) {
      freezeStaticSubtree(obj.children[i]);
    }
  };
  scene.updateMatrixWorld(true);
  for (let i = 0; i < scene.children.length; i++) {
    freezeStaticSubtree(scene.children[i]);
  }

  // Pre-filter static world colliders once at startup (exclude ground-level overhead lintels & roofs, but keep elevated Cape Vice Cliff structures!)
  const elevatedTags = new Set(['cliff-guardrail', 'lighthouse-base', 'keepers-cottage']);
  const solidVehicleColliders = colliders.filter(
    (c) => c.maxY > 0.45 && (c.minY < 2.9 || (c.tag !== undefined && elevatedTags.has(c.tag))),
  );
  const solidNpcColliders = colliders.filter((c) => c.maxY > 0.45 && c.minY < 1.85);

  // Uniform 2D Spatial Hash Grids (CELL_SIZE = 16m) for O(1) player, vehicle & NPC collision queries
  const playerGrid = new SpatialGrid(colliders);
  const vehicleGrid = new SpatialGrid(solidVehicleColliders);
  const npcGrid = new SpatialGrid(solidNpcColliders);

  const combinedFoodItems: FoodItem[] = [];

  const worldHandle: MiamiWorld = {
    colliders,
    solidVehicleColliders,
    solidNpcColliders,
    playerGrid,
    vehicleGrid,
    npcGrid,
    worldMeshes,
    cameraMeshes,
    stuntRamps,
    layout,
    maverickSpawn: starfish.helipadSpawn,
    yacht: starfish.yacht,
    marinaBoats: northPoint.marinaBoats,
    isNearIslandVault: (pos: THREE.Vector3) => starfish.isNearIslandVault(pos),
    isNearYachtLoot: (pos: THREE.Vector3) => starfish.isNearYachtLoot(pos),
    takeIslandVault: () => starfish.takeIslandVault(),
    takeYachtLoot: () => starfish.takeYachtLoot(),
    isCarInExportBay: (pos: THREE.Vector3) => vicePort.isCarInExportBay(pos),
    canDeliverExportVehicle: (name: string) => vicePort.canDeliverVehicle(name),
    deliverExportVehicle: (name: string) => vicePort.markDelivered(name),
    isCarInTuningBay: (pos: THREE.Vector3) => westDistrict.isCarInTuningBay(pos),
    isCarInLowriderArena: (pos: THREE.Vector3) => westDistrict.isCarInLowriderArena(pos),
    isNearDinerCounter: (pos: THREE.Vector3) => westDistrict.isNearDinerCounter(pos),
    isNearPetShop: (pos: THREE.Vector3) => westDistrict.isNearPetShop(pos),
    isNearBankVault: (pos: THREE.Vector3) => westDistrict.isNearBankVault(pos),
    takeBankVault: () => westDistrict.takeBankVault(),
    isInsideWestInterior: (pos: THREE.Vector3) => westDistrict.isInsideInterior(pos),
    isNearMarinaLoot: (pos: THREE.Vector3) => northPoint.isNearMarinaLoot(pos),
    takeMarinaLoot: () => northPoint.takeMarinaLoot(),
    isNearLighthouseSpot: (pos: THREE.Vector3) => northPoint.isNearLighthouseSpot(pos),
    claimLighthouseBonus: () => northPoint.claimLighthouseBonus(),
    cycleTimeOfDay: () => {
      timeIndex = (timeIndex + 1) % timePresets.length;
      return applyTimePreset(timeIndex);
    },
    toggleRain: () => {
      rainActive = !rainActive;
      rainLines.visible = rainActive;
      (scene.fog as THREE.FogExp2).density = rainActive ? 0.0095 : 0.0068;
      return rainActive;
    },
    isInsideClub: (pos: THREE.Vector3) => neonClub.isInside(pos),
    isInsideSafehouse: (pos: THREE.Vector3) => safehouse.isInside(pos),
    isInsidePoliceStation: (pos: THREE.Vector3) => policeStation.isInside(pos),
    isNearPdDesk: (pos: THREE.Vector3) => policeStation.isNearDesk(pos),
    isNearPdKevlar: (pos: THREE.Vector3) => policeStation.isNearKevlar(pos),
    isNearPdArmory: (pos: THREE.Vector3) => policeStation.isNearArmory(pos),
    isNearPdUniform: (pos: THREE.Vector3) => policeStation.isNearUniform(pos),
    isNearPdEvidenceCash: (pos: THREE.Vector3) => policeStation.isNearEvidenceCash(pos),
    takePdKevlar: () => policeStation.takeKevlar(),
    takePdEvidenceCash: () => policeStation.takeEvidenceCash(),
    triggerPdAlarm: () => policeStation.triggerAlarm(),
    clearPdAlarm: () => policeStation.clearAlarm(),
    lockPdCellBriefly: () => policeStation.lockCellBriefly(),
    isInSafehouseGarage: (pos: THREE.Vector3) => safehouse.isInGarage(pos),
    isNearSafehouseLounge: (pos: THREE.Vector3) => safehouse.isNearLounge(pos),
    isNearSafehouseWardrobe: (pos: THREE.Vector3) => safehouse.isNearWardrobe(pos),
    isNearSafehouseFridge: (pos: THREE.Vector3) => safehouse.isNearFridge(pos),
    isNearSafehouseRooftopBar: (pos: THREE.Vector3) => safehouse.isNearRooftopBar(pos),
    isSafehouseRooftopBarOwned: () => safehouse.isRooftopBarOwned(),
    setSafehouseRooftopBarOwned: (owned: boolean) => safehouse.setRooftopBarOwned(owned),
    getFoodItems: () => {
      combinedFoodItems.length = 0;
      const sf = safehouse.getFoodItems();
      for (let i = 0; i < sf.length; i++) combinedFoodItems.push(sf[i]);
      const dn = policeStation.getDonuts();
      for (let i = 0; i < dn.length; i++) combinedFoodItems.push(dn[i]);
      return combinedFoodItems;
    },
    consumeFood: (item: FoodItem) => {
      safehouse.consumeFood(item);
      policeStation.consumeDonut(item);
    },
    getCabinetWeapons: () => safehouse.getCabinetWeapons(),
    getTvMesh: () => safehouse.getTvMesh(),
    toggleTv: (cash: number, wantedStars: number) => safehouse.toggleTv(cash, wantedStars),
    isTvOn: () => safehouse.isTvOn(),
    isNearClubBar: (pos: THREE.Vector3) => neonClub.isNearBar(pos),
    getClubProximity: (pos: THREE.Vector3) => neonClub.getProximity(pos),
    getGroundHeight: (x: number, z: number) =>
      northPoint.getGroundHeight(x, z) ?? starfish.getGroundHeight(x, z) ?? getBeachHeight(x, z),
    shouldTrafficStop: (x: number, z: number, yaw: number) => trafficLights.shouldAiStop(x, z, yaw),
    update: (
      elapsed: number,
      dt: number,
      playerPos?: THREE.Vector3,
      cash = 0,
      wantedStars = 0,
      cameraYaw?: number,
      performanceMode = false,
    ) => {
      oceanUniforms.uTime.value = elapsed;
      mistUniforms.uTime.value = elapsed;
      beachHighlights.update(elapsed, playerPos);
      starfish.update(elapsed, dt, playerPos);
      westDistrict.update(elapsed, playerPos);
      northPoint.update(elapsed, playerPos);
      vicePort.update(elapsed, playerPos);
      neonClub.update(elapsed, playerPos);
      safehouse.update(elapsed, dt, playerPos, cash, wantedStars, cameraYaw, performanceMode);
      policeStation.update(elapsed, dt, playerPos, cash, wantedStars);
      trafficLights.update(elapsed);
      palms.update(elapsed, rainActive ? 2.1 : 1.0);

      if (playerPos) {
        streetLights.updateNearest(playerPos.x, playerPos.z);

        // Follow player with texel-snapped DirectionalLight shadow frustum (covers all expansion districts!)
        const sx = Math.round(playerPos.x / shadowTexel) * shadowTexel;
        const sz = Math.round(playerPos.z / shadowTexel) * shadowTexel;
        if (sx !== lastSunX || sz !== lastSunZ) {
          lastSunX = sx;
          lastSunZ = sz;
          sunLight.target.position.set(sx, 0, sz);
          sunLight.position.set(sx + sunOffset.x, sunOffset.y, sz + sunOffset.z);
        }
      }

      // Tropical rain shower streaks + occasional distant lightning
      if (rainActive) {
        rainUniforms.uTime.value = elapsed;
        if (playerPos) {
          rainLines.position.set(playerPos.x, 0, playerPos.z);
        }

        lightningTimer -= dt;
        if (lightningTimer <= 0) {
          lightningTimer = 7 + Math.random() * 10;
          lightningFlash = 1.0;
          worldHandle.onThunder?.();
        }
      }

      if (lightningFlash > 0) {
        lightningFlash = Math.max(0, lightningFlash - dt * 4.5);
        hemiLight.intensity = timePresets[timeIndex].hemiIntensity + lightningFlash * 2.2;
      }
    },
  };

  return worldHandle;
}

function buildPalmTrees(
  scene: THREE.Scene,
  placements: { x: number; y?: number; z: number; rot: number; scale: number }[],
): { update: (elapsed: number, breeze: number) => void } {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5346', roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: '#2d6a4f',
    roughness: 0.62,
    side: THREE.DoubleSide,
  });

  // Merge the 4 curved trunk segments into 1 single BufferGeometry -> 1 InstancedMesh draw call for ALL palms!
  const trunkSegBase = new THREE.CylinderGeometry(0.16, 0.23, 1.9, 6);
  const trunkParts: THREE.BufferGeometry[] = [];
  let curY = 0;
  let curX = 0;
  const partMat = new THREE.Matrix4();
  const partQuat = new THREE.Quaternion();
  const partEuler = new THREE.Euler();
  const partPos = new THREE.Vector3();
  const partScale = new THREE.Vector3();

  for (let s = 0; s < 4; s++) {
    const lean = s * 0.065;
    const g = trunkSegBase.clone();
    partPos.set(curX + lean * 0.6, curY + 0.9, 0);
    partEuler.set(0, 0, -lean);
    partQuat.setFromEuler(partEuler);
    partScale.setScalar(1 - s * 0.08);
    partMat.compose(partPos, partQuat, partScale);
    g.applyMatrix4(partMat);
    trunkParts.push(g);
    curY += 1.72;
    curX += Math.sin(lean) * 1.4;
  }
  const mergedTrunkGeo = mergeGeometries(trunkParts);
  trunkSegBase.dispose();
  trunkParts.forEach((g) => g.dispose());

  // Merge the 7 drooping fronds into 1 single BufferGeometry -> 1 InstancedMesh draw call for ALL crowns!
  const frondBase = new THREE.ConeGeometry(0.55, 3.2, 4);
  frondBase.scale(1.0, 1.0, 0.16);
  frondBase.rotateX(Math.PI / 2);
  frondBase.translate(0, 0, 1.55);
  const frondParts: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 7; f++) {
    const g = frondBase.clone();
    const angle = (f / 7) * Math.PI * 2;
    partEuler.set(0.35 + (f % 2) * 0.18, angle, 0, 'YXZ');
    partQuat.setFromEuler(partEuler);
    partMat.compose(new THREE.Vector3(0, 0, 0), partQuat, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(partMat);
    frondParts.push(g);
  }
  const mergedCrownGeo = mergeGeometries(frondParts);
  frondBase.dispose();
  frondParts.forEach((g) => g.dispose());

  const palmUniforms = {
    uTime: { value: 0 },
    uBreeze: { value: 1.0 },
  };
  frondMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = palmUniforms.uTime;
    shader.uniforms.uBreeze = palmUniforms.uBreeze;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform float uBreeze;\nattribute float aPalmPhase;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float palmRxN = cos(uTime * 1.1 * uBreeze + aPalmPhase * 0.7) * 0.03 * uBreeze;
        float palmRzN = sin(uTime * 1.4 * uBreeze + aPalmPhase * 0.9) * 0.045 * uBreeze;
        objectNormal = normalize(vec3(
          objectNormal.x - objectNormal.y * palmRzN,
          objectNormal.y + objectNormal.x * palmRzN - objectNormal.z * palmRxN,
          objectNormal.z + objectNormal.y * palmRxN
        ));`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float palmRx = cos(uTime * 1.1 * uBreeze + aPalmPhase * 0.7) * 0.03 * uBreeze;
        float palmRz = sin(uTime * 1.4 * uBreeze + aPalmPhase * 0.9) * 0.045 * uBreeze;
        vec3 swayed = vec3(
          transformed.x - transformed.y * palmRz,
          transformed.y + transformed.x * palmRz - transformed.z * palmRx,
          transformed.z + transformed.y * palmRx
        );
        transformed = swayed;`,
      );
  };

  const count = placements.length;
  const palmPhases = new Float32Array(count);
  for (let i = 0; i < count; i++) palmPhases[i] = i;
  mergedCrownGeo.setAttribute('aPalmPhase', new THREE.InstancedBufferAttribute(palmPhases, 1));

  const trunkInst = new THREE.InstancedMesh(mergedTrunkGeo, trunkMat, count);
  trunkInst.castShadow = true;
  trunkInst.receiveShadow = true;

  const crownInst = new THREE.InstancedMesh(mergedCrownGeo, frondMat, count);
  crownInst.castShadow = true;

  const crownOffsetLocal = new THREE.Vector3(curX + 0.12, curY + 0.1, 0);
  const dummy = new THREE.Object3D();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const cw = new THREE.Vector3();

  placements.forEach((p, idx) => {
    const baseY = p.y ?? 0.18;
    dummy.position.set(p.x, baseY, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    cw.copy(crownOffsetLocal).multiplyScalar(p.scale).applyAxisAngle(yAxis, p.rot);
    cw.x += p.x;
    cw.y += baseY;
    cw.z += p.z;

    dummy.position.copy(cw);
    dummy.updateMatrix();
    crownInst.setMatrixAt(idx, dummy.matrix);
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  trunkInst.matrixAutoUpdate = false;
  crownInst.matrixAutoUpdate = false;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst);
  scene.add(crownInst);

  return {
    update: (elapsed: number, breeze: number) => {
      palmUniforms.uTime.value = elapsed;
      palmUniforms.uBreeze.value = breeze;
    },
  };
}

function buildStreetlights(scene: THREE.Scene): { updateNearest: (px: number, pz: number) => void } {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2b2433', roughness: 0.4, metalness: 0.7 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#ffdf9e',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 3.0,
  });

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 6.2, 6);
  const armGeo = new THREE.BoxGeometry(1.3, 0.08, 0.08);
  const globeGeo = new THREE.SphereGeometry(0.22, 8, 8);
  // Subtle post-rain warm amber haze cone hanging beneath each streetlamp
  const hazeConeGeo = new THREE.ConeGeometry(2.35, 5.8, 12, 1, true);
  const hazeConeMat = new THREE.MeshBasicMaterial({
    color: '#ffb05c',
    transparent: true,
    opacity: 0.065,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const lampSpots: { x: number; z: number; dirX: number; withLight: boolean }[] = [
    // Ocean Drive promenade lamps
    { x: 66.5, z: -42, dirX: -1, withLight: true },
    { x: 66.5, z: -14, dirX: -1, withLight: true },
    { x: 66.5, z: 14, dirX: -1, withLight: true },
    { x: 66.5, z: 42, dirX: -1, withLight: true },
    // Central avenues
    { x: 26.4, z: -26.4, dirX: -1, withLight: true },
    { x: 26.4, z: 26.4, dirX: -1, withLight: true },
    { x: -26.4, z: -26.4, dirX: 1, withLight: true },
    { x: -26.4, z: 26.4, dirX: 1, withLight: true },
    // Extra visual-only lamps (no extra PointLight for GPU budget)
    { x: 13.6, z: 0, dirX: 1, withLight: false },
    { x: -13.6, z: 0, dirX: -1, withLight: false },
    { x: 53.6, z: 0, dirX: 1, withLight: false },
    { x: -53.6, z: 0, dirX: -1, withLight: false },
  ];

  const litCoords: { x: number; y: number; z: number; dSq: number }[] = [];

  for (const spot of lampSpots) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(spot.x, 3.25, spot.z);
    pole.updateMatrix();
    pole.matrixAutoUpdate = false;
    scene.add(pole);

    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(spot.x + spot.dirX * 0.55, 6.25, spot.z);
    arm.updateMatrix();
    arm.matrixAutoUpdate = false;
    scene.add(arm);

    const globe = new THREE.Mesh(globeGeo, bulbMat);
    globe.position.set(spot.x + spot.dirX * 1.15, 6.1, spot.z);
    globe.updateMatrix();
    globe.matrixAutoUpdate = false;
    scene.add(globe);

    const hazeCone = new THREE.Mesh(hazeConeGeo, hazeConeMat);
    hazeCone.position.set(spot.x + spot.dirX * 1.15, 3.15, spot.z);
    hazeCone.updateMatrix();
    hazeCone.matrixAutoUpdate = false;
    scene.add(hazeCone);

    if (spot.withLight) {
      litCoords.push({ x: spot.x + spot.dirX * 1.15, y: 5.7, z: spot.z, dSq: 0 });
    }
  }

  // Fixed pool of 3 always-visible PointLights repositioned to the 3 closest streetlamps
  const poolSize = 3;
  const lightPool: THREE.PointLight[] = [];
  for (let i = 0; i < poolSize; i++) {
    const pt = new THREE.PointLight('#ff9e4a', 24, 26, 1.7);
    pt.position.set(litCoords[i].x, litCoords[i].y, litCoords[i].z);
    pt.userData.dynamic = true;
    scene.add(pt);
    lightPool.push(pt);
  }

  return {
    updateNearest: (px: number, pz: number) => {
      for (let i = 0; i < litCoords.length; i++) {
        const c = litCoords[i];
        const dx = c.x - px;
        const dz = c.z - pz;
        c.dSq = dx * dx + dz * dz;
      }
      litCoords.sort((a, b) => a.dSq - b.dSq);
      for (let i = 0; i < poolSize; i++) {
        const c = litCoords[i];
        lightPool[i].position.set(c.x, c.y, c.z);
      }
    },
  };
}
