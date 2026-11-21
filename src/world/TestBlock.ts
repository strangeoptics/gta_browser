import * as THREE from 'three';
import type { AABB } from '../types';

export interface TestBlockWorld {
  colliders: AABB[];
}

/**
 * Phase 1 Test Playground:
 * A compact Miami-dusk test street with wet-sheen asphalt, sidewalk curbs (step-up test),
 * sun-bleached pastel Art-Deco test buildings, and neon accents.
 * Will be replaced/expanded into the full 3x3 coastal district in Phase 2.
 */
export function buildPhase1TestWorld(scene: THREE.Scene): TestBlockWorld {
  const colliders: AABB[] = [];

  // 1) Golden Hour / Dusk Gradient Sky Dome
  const skyGeo = new THREE.SphereGeometry(260, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#1d1138') },
      midColor: { value: new THREE.Color('#8d3b72') },
      horizonColor: { value: new THREE.Color('#ff8e53') },
      sunDir: { value: new THREE.Vector3(-0.7, 0.14, -0.7).normalize() },
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
      uniform vec3 sunDir;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
        col = mix(col, topColor, smoothstep(0.22, 0.78, h));
        float sunAmt = max(dot(dir, sunDir), 0.0);
        col += vec3(1.0, 0.65, 0.35) * pow(sunAmt, 36.0) * 0.9;
        col += vec3(1.0, 0.9, 0.7) * pow(sunAmt, 240.0) * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.FogExp2('#4b244a', 0.011);

  // 2) Lighting — low warm dusk sun + cool violet hemisphere fill
  const hemiLight = new THREE.HemisphereLight('#a678d4', '#2a1c36', 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight('#ff9a5a', 2.2);
  sunLight.position.set(-45, 16, -45);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.camera.left = -55;
  sunLight.shadow.camera.right = 55;
  sunLight.shadow.camera.top = 55;
  sunLight.shadow.camera.bottom = -55;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  // 3) Wet-look asphalt road surface
  const roadGeo = new THREE.PlaneGeometry(120, 120);
  const roadMat = new THREE.MeshStandardMaterial({
    color: '#25212b',
    roughness: 0.28,
    metalness: 0.2,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // Dashed street center line
  const dashMat = new THREE.MeshStandardMaterial({ color: '#f2c166', roughness: 0.5 });
  for (let z = -48; z <= 48; z += 6) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 3.0), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.01, z);
    scene.add(dash);
  }

  // Helper to add a solid box + AABB collider
  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    roughness = 0.72,
    tag = 'solid',
  ): THREE.Mesh => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = h > 0.4;
    mesh.receiveShadow = true;
    scene.add(mesh);

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

  // Sidewalks (step-up test: 0.18m high curbs)
  addBox(18, 0.18, 90, -16, 0.09, 0, '#9c9290', 0.65, 'sidewalk');
  addBox(18, 0.18, 90, 16, 0.09, 0, '#9c9290', 0.65, 'sidewalk');

  // Placeholder sun-bleached Art-Deco buildings on both sides of the test avenue
  const pastelPalette = ['#f2c9b8', '#b8dfd8', '#f5e1c8', '#e8b4c8', '#e6d8b5'];
  const neonPalette = ['#ff4fa3', '#36f1e6', '#ffaa44', '#ff5e8e'];

  const placements = [
    { x: -18, z: -22, w: 12, h: 12, d: 14 },
    { x: -18, z: 0, w: 12, h: 16, d: 16 },
    { x: -18, z: 22, w: 12, h: 10, d: 14 },
    { x: 18, z: -20, w: 12, h: 14, d: 16 },
    { x: 18, z: 4, w: 12, h: 11, d: 14 },
    { x: 18, z: 24, w: 12, h: 15, d: 14 },
  ];

  placements.forEach((b, idx) => {
    const color = pastelPalette[idx % pastelPalette.length];
    addBox(b.w, b.h, b.d, b.x, 0.18 + b.h / 2, b.z, color, 0.82, 'building');

    // Neon trim strip facing the street
    const neonColor = neonPalette[idx % neonPalette.length];
    const stripGeo = new THREE.BoxGeometry(0.16, 0.22, b.d * 0.72);
    const stripMat = new THREE.MeshStandardMaterial({
      color: neonColor,
      emissive: new THREE.Color(neonColor),
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    const faceOffset = b.x < 0 ? b.w / 2 + 0.09 : -(b.w / 2 + 0.09);
    strip.position.set(b.x + faceOffset, 4.4, b.z);
    scene.add(strip);

    // Subtle colored point light on a few buildings for wet-street glow
    if (idx % 2 === 0) {
      const neonLight = new THREE.PointLight(neonColor, 14, 18, 1.8);
      neonLight.position.set(b.x + faceOffset * 1.15, 4.2, b.z);
      scene.add(neonLight);
    }
  });

  // Low test obstacles (crates / jump test blocks) on the sidewalk
  addBox(1.4, 0.8, 1.4, -9.5, 0.18 + 0.4, 6, '#d98a6c', 0.7, 'prop');
  addBox(1.4, 1.4, 1.4, -9.5, 0.18 + 0.7, 4.2, '#c97b63', 0.7, 'prop');

  return { colliders };
}
