import * as THREE from 'three';
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
  createNeonSignTexture,
  createSidewalkTexture,
  createWetAsphaltTextures,
} from './Textures';
import { buildBeachHighlights } from './BeachProps';

export interface MiamiWorld {
  colliders: AABB[];
  worldMeshes: THREE.Object3D[];
  layout: CityLayout;
  cycleTimeOfDay: () => string;
  toggleRain: () => boolean;
  isInsideClub: (pos: THREE.Vector3) => boolean;
  getGroundHeight: (x: number, z: number) => number;
  onThunder?: () => void;
  update: (elapsed: number, dt: number, playerPos?: THREE.Vector3) => void;
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

  const sunLight = new THREE.DirectionalLight('#ff9854', 2.4);
  sunLight.position.copy(sunDir).multiplyScalar(110);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.camera.left = -95;
  sunLight.shadow.camera.right = 95;
  sunLight.shadow.camera.top = 95;
  sunLight.shadow.camera.bottom = -95;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // ---------------------------------------------------------------------------
  // 3) Wet Post-Rain Asphalt Base & Street Markings
  // ---------------------------------------------------------------------------
  const asphalt = createWetAsphaltTextures();
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphalt.map,
    roughnessMap: asphalt.roughnessMap,
    roughness: 1.0, // modulated by roughnessMap (puddles ~0.05, damp asphalt ~0.5)
    metalness: 0.22,
    envMapIntensity: 1.5,
  });

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

    const materials = [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];
    addStaticBox(b.w, b.h, b.d, b.x, 0.18 + b.h / 2, b.z, materials, true, 'building');

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
  // 4b) Walk-In Interior: NEON CLUB at Ocean Drive Block (cx = 40, cz = 0)
  // ---------------------------------------------------------------------------
  const clubX = 40;
  const clubZ = 0;
  const clubW = 18; // x: 31 .. 49
  const clubD = 16; // z: -8 .. +8
  const clubH = 6.2;
  const wallT = 0.6;

  const clubExtMat = new THREE.MeshStandardMaterial({ color: '#241436', roughness: 0.55, metalness: 0.25 });
  const clubTrimPink = new THREE.MeshStandardMaterial({
    color: '#ff4fa3',
    emissive: '#ff4fa3',
    emissiveIntensity: 2.5,
  });
  const clubTrimCyan = new THREE.MeshStandardMaterial({
    color: '#36f1e6',
    emissive: '#36f1e6',
    emissiveIntensity: 2.5,
  });

  // Back wall (-X), North wall (-Z), South wall (+Z)
  addStaticBox(wallT, clubH, clubD, clubX - clubW / 2, 0.18 + clubH / 2, clubZ, clubExtMat, true, 'club-wall');
  addStaticBox(clubW, clubH, wallT, clubX, 0.18 + clubH / 2, clubZ - clubD / 2, clubExtMat, true, 'club-wall');
  addStaticBox(clubW, clubH, wallT, clubX, 0.18 + clubH / 2, clubZ + clubD / 2, clubExtMat, true, 'club-wall');

  // Front wall (+X, facing Ocean Drive) with wide 4.8m open entrance doorway in the center!
  const sideSpan = (clubD - 4.8) / 2; // 5.6m on each side
  addStaticBox(wallT, clubH, sideSpan, clubX + clubW / 2, 0.18 + clubH / 2, clubZ - (2.4 + sideSpan / 2), clubExtMat, true, 'club-wall');
  addStaticBox(wallT, clubH, sideSpan, clubX + clubW / 2, 0.18 + clubH / 2, clubZ + (2.4 + sideSpan / 2), clubExtMat, true, 'club-wall');
  // Header above doorway (clearance 3.4m)
  addStaticBox(wallT, clubH - 3.4, 4.8, clubX + clubW / 2, 0.18 + 3.4 + (clubH - 3.4) / 2, clubZ, clubExtMat, true, 'club-wall');

  // Roof slab (provides real cover from the Police Helicopter!)
  addStaticBox(clubW + 0.6, 0.5, clubD + 0.6, clubX, 0.18 + clubH + 0.25, clubZ, clubExtMat, true, 'club-roof');

  // Glowing NEON CLUB Marquee Sign above Ocean Drive entrance
  const clubSignTex = createNeonSignTexture('NEON CLUB', '#ff4fa3');
  const clubSignMat = new THREE.MeshStandardMaterial({
    map: clubSignTex,
    emissive: '#ffffff',
    emissiveMap: clubSignTex,
    emissiveIntensity: 2.0,
  });
  const clubSign = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.5, 0.25), clubSignMat);
  clubSign.rotation.y = Math.PI / 2;
  clubSign.position.set(clubX + clubW / 2 + 0.45, 0.18 + 4.8, clubZ);
  scene.add(clubSign);

  // Exterior neon trim strips
  const extTrim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, clubD + 0.2), clubTrimCyan);
  extTrim.position.set(clubX + clubW / 2 + 0.35, 0.18 + clubH + 0.1, clubZ);
  scene.add(extTrim);

  // Interior glowing checkerboard dancefloor (6x5 tiles)
  const danceTiles: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; phase: number }[] = [];
  const tileGeo = new THREE.BoxGeometry(1.52, 0.06, 1.52);
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      const isPink = (gx + gz) % 2 === 0;
      const mat = new THREE.MeshStandardMaterial({
        color: isPink ? '#ff4fa3' : '#36f1e6',
        emissive: isPink ? '#ff4fa3' : '#36f1e6',
        emissiveIntensity: 1.2,
        roughness: 0.15,
      });
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(clubX - 1.5 + gx * 1.6, 0.22, clubZ - 3.2 + gz * 1.6);
      scene.add(tile);
      danceTiles.push({ mesh: tile, mat, phase: gx * 0.7 + gz * 0.9 });
    }
  }

  // Bar Counter along back wall (-X) & DJ Booth along north wall (-Z)
  const barMat = new THREE.MeshStandardMaterial({ color: '#1b1029', roughness: 0.25, metalness: 0.5 });
  addStaticBox(1.2, 1.15, 8.5, clubX - 6.8, 0.18 + 0.575, clubZ, barMat, true, 'prop');
  const barGlow = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.08, 8.6), clubTrimPink);
  barGlow.position.set(clubX - 6.8, 0.18 + 1.16, clubZ);
  scene.add(barGlow);

  // DJ Booth
  addStaticBox(4.2, 1.3, 1.8, clubX + 1.0, 0.18 + 0.65, clubZ - 6.2, barMat, true, 'prop');
  const djGlow = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.1, 1.9), clubTrimCyan);
  djGlow.position.set(clubX + 1.0, 0.18 + 1.32, clubZ - 6.2);
  scene.add(djGlow);

  // Rotating interior club lights (pink + cyan)
  const clubLightPink = new THREE.PointLight('#ff4fa3', 32, 22, 1.6);
  clubLightPink.position.set(clubX, 5.2, clubZ);
  scene.add(clubLightPink);
  const clubLightCyan = new THREE.PointLight('#36f1e6', 32, 22, 1.6);
  clubLightCyan.position.set(clubX, 5.2, clubZ);
  scene.add(clubLightCyan);

  // 3 Stylized Dancing Club Guests on the neon dancefloor
  const dancers: { group: THREE.Group; baseY: number; phase: number }[] = [];
  const dancerSpots: [number, number, string][] = [
    [clubX + 0.5, clubZ - 1.2, '#ff7eb3'],
    [clubX + 2.4, clubZ + 1.5, '#36f1e6'],
    [clubX - 1.4, clubZ + 1.8, '#ffd15c'],
  ];
  dancerSpots.forEach(([dx, dz, col], idx) => {
    const dg = new THREE.Group();
    dg.position.set(dx, 0.24, dz);
    const shirt = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1b1426', roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: '#dba486', roughness: 0.7 });

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.74, 0.22), dark);
    legs.position.y = 0.37;
    dg.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.24), shirt);
    torso.position.y = 1.05;
    dg.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skin);
    head.position.y = 1.52;
    dg.add(head);
    // Raised dancing arms
    for (const side of [-0.32, 0.32]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), shirt);
      arm.position.set(side, 1.44, 0);
      arm.rotation.z = side > 0 ? -0.45 : 0.45;
      dg.add(arm);
    }
    scene.add(dg);
    dancers.push({ group: dg, baseY: 0.24, phase: idx * 2.1 });
  });

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
    for (let s = 0; s < steps; s++) {
      const topY = 0.18 + (s + 1) * stepH;
      const sx = startX + dirX * s * stepRun;
      const sz = startZ + dirZ * s * stepRun;
      const w = dirX !== 0 ? stepRun + 0.06 : width;
      const d = dirZ !== 0 ? stepRun + 0.06 : width;
      addStaticBox(w, topY, d, sx, topY / 2, sz, stairMat, true, 'stairs');
    }
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
  // Shared continuous beach elevation function:
  // Flush with boardwalk at x = 74 (+0.20m), gently sloping with subtle coastal dunes
  // down into the shallow surf (-0.65m at x = 114).
  const getBeachHeight = (x: number, z: number): number => {
    if (x <= 74) return 0;
    const t = THREE.MathUtils.clamp((x - 74) / 40, 0, 1);
    const smoothSlope = t * t * (3 - 2 * t);
    const baseY = THREE.MathUtils.lerp(0.2, -0.68, smoothSlope);
    // Gentle natural dunes on the upper dry beach, flattening smoothly at the surf line
    const dune =
      (Math.sin(z * 0.085) * 0.12 + Math.cos(x * 0.16 + z * 0.04) * 0.05) * (1 - smoothSlope) * Math.min(1, (x - 74) / 5);
    return baseY + dune;
  };

  // Boardwalk east of x = 66
  addStaticBox(8, 0.22, 144, 70, 0.11, 0, sidewalkMat, false, 'sidewalk');

  // Low Art-Deco coastal seawall along the boardwalk with walkable openings
  const seawallMat = new THREE.MeshStandardMaterial({ color: '#eedccf', roughness: 0.65 });
  for (const segZ of [-48, -16, 16, 48]) {
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

        // Dynamic tide swash line oscillating across x ~ 96..103
        float swashOffset = sin(uTime * 1.35 + sin(vWorldPos.z * 0.07) * 2.2) * 2.1;
        float shoreX = vWorldPos.x + swashOffset;

        float shoreBlend = smoothstep(98.0, 142.0, vWorldPos.x);
        vec3 waterCol = mix(uShallowColor, uDeepColor, shoreBlend);
        waterCol = mix(waterCol, uHorizonGlow, fresnel * 0.72);

        // Soft animated foam ribbon hugging the wet sloping sand
        float foamBand = smoothstep(106.0, 99.5, shoreX) * smoothstep(95.5, 99.0, shoreX);
        float foamPattern = 0.55 + 0.45 * sin(vWorldPos.z * 0.45 + uTime * 2.4) * cos(shoreX * 1.4 - uTime * 1.8);
        float foam = clamp(foamBand * foamPattern, 0.0, 1.0);
        waterCol = mix(waterCol, vec3(1.0, 0.92, 0.93), foam * 0.65);

        // Subtle golden wave crest shimmer
        waterCol += vec3(1.0, 0.72, 0.55) * max(vWave, 0.0) * 0.35;

        // Translucent shallow edge so wet sand glows underneath the surf
        float alpha = smoothstep(96.0, 102.5, shoreX) * 0.92 + foam * 0.35;
        gl_FragColor = vec4(waterCol, clamp(alpha, 0.0, 0.96));
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(240, 420, 48, 48), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(214, -0.18, 0); // spans x = 94 .. 334, intersecting the sloping beach around x ~ 99!
  scene.add(ocean);

  // ---------------------------------------------------------------------------
  // 6) Palm Trees along Ocean Drive & Avenues
  // ---------------------------------------------------------------------------
  const palmPositions: { x: number; z: number; rot: number; scale: number }[] = [];

  // Ocean Drive beachfront palms
  for (let z = -60; z <= 60; z += 12) {
    palmPositions.push({ x: 67.4, z, rot: z * 0.7, scale: 0.95 + ((Math.abs(z) % 5) * 0.05) });
    palmPositions.push({ x: 76.5, z: z + 5, rot: z * 1.1, scale: 0.9 + ((Math.abs(z) % 4) * 0.06) });
  }
  // Boulevard corner palms on city sidewalks
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      palmPositions.push({ x: bx + 12.2, z: bz + 12.2, rot: bx + bz, scale: 0.92 });
      palmPositions.push({ x: bx - 12.2, z: bz - 12.2, rot: bx - bz, scale: 0.88 });
    }
  }

  const palmGroup = buildPalmTrees(palmPositions);
  scene.add(palmGroup);

  // ---------------------------------------------------------------------------
  // 7) Coastal Streetlights (Warm Amber Glow + Selective PointLights)
  // ---------------------------------------------------------------------------
  buildStreetlights(scene);

  // ---------------------------------------------------------------------------
  // 8) Subtle Post-Rain Mist / Lingering Drizzle Motes
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
  const mistMat = new THREE.PointsMaterial({
    color: '#ffd6e8',
    size: 0.14,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  scene.add(mistPoints);

  // ---------------------------------------------------------------------------
  // 9) Optional Tropical Rain Shower (3D rain streaks + distant lightning flash)
  // ---------------------------------------------------------------------------
  const rainCount = 420;
  const rainPositions = new Float32Array(rainCount * 6); // 2 vertices per streak
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 90;
    const ry = Math.random() * 24;
    const rz = (Math.random() - 0.5) * 90;
    rainPositions[i * 6] = rx;
    rainPositions[i * 6 + 1] = ry;
    rainPositions[i * 6 + 2] = rz;
    rainPositions[i * 6 + 3] = rx - 0.18;
    rainPositions[i * 6 + 4] = ry - 0.95;
    rainPositions[i * 6 + 5] = rz;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: '#bde9ff',
    transparent: true,
    opacity: 0.42,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
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

  const worldHandle: MiamiWorld = {
    colliders,
    worldMeshes,
    layout,
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
    isInsideClub: (pos: THREE.Vector3) =>
      pos.x > clubX - clubW / 2 &&
      pos.x < clubX + clubW / 2 &&
      pos.z > clubZ - clubD / 2 &&
      pos.z < clubZ + clubD / 2 &&
      pos.y < clubH,
    getGroundHeight: (x: number, z: number) => getBeachHeight(x, z),
    update: (elapsed: number, dt: number, playerPos?: THREE.Vector3) => {
      oceanUniforms.uTime.value = elapsed;
      beachHighlights.update(elapsed);

      // Animate NEON CLUB pulsing dancefloor, sweeping spotlights & dancers
      for (const dtile of danceTiles) {
        dtile.mat.emissiveIntensity = 0.65 + 0.95 * (0.5 + 0.5 * Math.sin(elapsed * 5.2 + dtile.phase));
      }
      clubLightPink.position.set(clubX + Math.cos(elapsed * 2.2) * 5.0, 5.2, clubZ + Math.sin(elapsed * 2.2) * 4.5);
      clubLightCyan.position.set(clubX - Math.cos(elapsed * 1.9) * 5.0, 5.2, clubZ - Math.sin(elapsed * 1.9) * 4.5);
      for (const d of dancers) {
        d.group.position.y = d.baseY + Math.abs(Math.sin(elapsed * 5.6 + d.phase)) * 0.14;
        d.group.rotation.y = Math.sin(elapsed * 2.4 + d.phase) * 0.65;
      }
      palmGroup.children.forEach((palm, idx) => {
        const crown = palm.userData.crown as THREE.Object3D | undefined;
        if (crown) {
          const breeze = rainActive ? 2.1 : 1.0;
          crown.rotation.z = Math.sin(elapsed * 1.4 * breeze + idx * 0.9) * 0.045 * breeze;
          crown.rotation.x = Math.cos(elapsed * 1.1 * breeze + idx * 0.7) * 0.03 * breeze;
        }
      });

      const posAttr = mistGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < mistCount; i++) {
        let y = posAttr.getY(i) - dt * 0.35;
        if (y < 0.2) y = 14;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;

      // Tropical rain shower streaks + occasional distant lightning
      if (rainActive) {
        if (playerPos) {
          rainLines.position.set(playerPos.x, 0, playerPos.z);
        }
        const rAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < rainCount; i++) {
          let y0 = rAttr.getY(i * 2) - dt * 26;
          if (y0 < 0.2) y0 = 24;
          rAttr.setY(i * 2, y0);
          rAttr.setY(i * 2 + 1, y0 - 0.95);
        }
        rAttr.needsUpdate = true;

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
  placements: { x: number; z: number; rot: number; scale: number }[],
): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5346', roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: '#2d6a4f',
    roughness: 0.62,
    side: THREE.DoubleSide,
  });

  const trunkSegGeo = new THREE.CylinderGeometry(0.16, 0.23, 1.9, 6);
  const frondGeo = new THREE.ConeGeometry(0.55, 3.2, 4);
  frondGeo.scale(1.0, 1.0, 0.16);
  frondGeo.rotateX(Math.PI / 2);
  frondGeo.translate(0, 0, 1.55);

  for (const p of placements) {
    const palm = new THREE.Group();
    palm.position.set(p.x, 0.18, p.z);
    palm.rotation.y = p.rot;
    palm.scale.setScalar(p.scale);

    // 4 slightly curved trunk segments
    let curY = 0;
    let curX = 0;
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(trunkSegGeo, trunkMat);
      const lean = s * 0.065;
      seg.position.set(curX + lean * 0.6, curY + 0.9, 0);
      seg.rotation.z = -lean;
      seg.scale.setScalar(1 - s * 0.08);
      seg.castShadow = true;
      palm.add(seg);
      curY += 1.72;
      curX += Math.sin(lean) * 1.4;
    }

    // Palm crown with 7 drooping fronds
    const crown = new THREE.Group();
    crown.position.set(curX + 0.12, curY + 0.1, 0);
    for (let f = 0; f < 7; f++) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const angle = (f / 7) * Math.PI * 2;
      frond.rotation.y = angle;
      frond.rotation.x = 0.35 + (f % 2) * 0.18;
      frond.castShadow = true;
      crown.add(frond);
    }
    palm.add(crown);
    palm.userData.crown = crown;
    group.add(palm);
  }

  return group;
}

function buildStreetlights(scene: THREE.Scene): void {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#2b2433', roughness: 0.4, metalness: 0.7 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#ffdf9e',
    emissive: new THREE.Color('#ffaa44'),
    emissiveIntensity: 3.0,
  });

  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 6.2, 6);
  const armGeo = new THREE.BoxGeometry(1.3, 0.08, 0.08);
  const globeGeo = new THREE.SphereGeometry(0.22, 8, 8);

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

  for (const spot of lampSpots) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(spot.x, 3.25, spot.z);
    scene.add(pole);

    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(spot.x + spot.dirX * 0.55, 6.25, spot.z);
    scene.add(arm);

    const globe = new THREE.Mesh(globeGeo, bulbMat);
    globe.position.set(spot.x + spot.dirX * 1.15, 6.1, spot.z);
    scene.add(globe);

    if (spot.withLight) {
      const pt = new THREE.PointLight('#ff9e4a', 24, 26, 1.7);
      pt.position.set(spot.x + spot.dirX * 1.15, 5.7, spot.z);
      scene.add(pt);
    }
  }
}
