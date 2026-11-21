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
  createNeonSignTexture,
  createSidewalkTexture,
  createWetAsphaltTextures,
} from './Textures';

export interface MiamiWorld {
  colliders: AABB[];
  worldMeshes: THREE.Object3D[];
  layout: CityLayout;
  update: (elapsed: number, dt: number) => void;
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

  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), createSkyMat());
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
  // 5b) Ocean Drive Boardwalk, Beach & Animated Golden-Hour Ocean (East Edge)
  // ---------------------------------------------------------------------------
  // Boardwalk east of x = 66
  addStaticBox(8, 0.22, 144, 70, 0.11, 0, sidewalkMat, false, 'sidewalk');

  // Low Art-Deco coastal seawall along the boardwalk with walkable openings
  const seawallMat = new THREE.MeshStandardMaterial({ color: '#eedccf', roughness: 0.65 });
  for (const segZ of [-48, -16, 16, 48]) {
    addStaticBox(0.55, 0.85, 22, 73.7, 0.22 + 0.425, segZ, seawallMat, true, 'prop');
  }

  // Golden-hour sand beach (x = 74 to 118)
  const sandMat = new THREE.MeshStandardMaterial({ color: '#c9a684', roughness: 0.92 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, 260), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.rotation.y = 0;
  beach.position.set(96, -0.04, 0);
  beach.receiveShadow = true;
  scene.add(beach);

  // Animated Dusk Ocean Shader (x > 110 out to horizon)
  const oceanUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir },
    uDeepColor: { value: new THREE.Color('#181938') },
    uShallowColor: { value: new THREE.Color('#275b75') },
    uHorizonGlow: { value: new THREE.Color('#ff8e5c') },
  };
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vWave;
      void main() {
        vec3 pos = position;
        float w1 = sin(pos.x * 0.18 + uTime * 1.4) * 0.16;
        float w2 = cos(pos.y * 0.14 - uTime * 1.1) * 0.12;
        pos.z += w1 + w2;
        vWave = w1 + w2;
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
        float shoreBlend = smoothstep(106.0, 145.0, vWorldPos.x);
        vec3 waterCol = mix(uShallowColor, uDeepColor, shoreBlend);
        waterCol = mix(waterCol, uHorizonGlow, fresnel * 0.72);
        // Subtle foam shimmer near shore
        float foam = smoothstep(112.0, 106.5, vWorldPos.x) * (0.45 + 0.55 * sin(vWorldPos.z * 0.35 + uTime * 2.2));
        waterCol += vec3(0.95, 0.85, 0.88) * max(foam, 0.0) * 0.35;
        waterCol += vec3(1.0, 0.72, 0.55) * max(vWave, 0.0) * 0.3;
        gl_FragColor = vec4(waterCol, 1.0);
      }
    `,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(240, 420, 40, 40), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(226, -0.12, 0);
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

  return {
    colliders,
    worldMeshes,
    layout,
    update: (elapsed: number, dt: number) => {
      oceanUniforms.uTime.value = elapsed;
      // Gentle coastal breeze on palm canopies
      palmGroup.children.forEach((palm, idx) => {
        const crown = palm.userData.crown as THREE.Object3D | undefined;
        if (crown) {
          crown.rotation.z = Math.sin(elapsed * 1.4 + idx * 0.9) * 0.045;
          crown.rotation.x = Math.cos(elapsed * 1.1 + idx * 0.7) * 0.03;
        }
      });
      // Slow drift of lingering post-rain mist motes
      const posAttr = mistGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < mistCount; i++) {
        let y = posAttr.getY(i) - dt * 0.35;
        if (y < 0.2) y = 14;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    },
  };
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
