import * as THREE from 'three';
import type { AABB } from '../types';

export interface BeachPropsHandle {
  update: (elapsed: number) => void;
}

/**
 * Builds iconic South Beach / Miami Beach landmarks on the sloping beach:
 * 1) Walkable pastel Art-Deco Lifeguard Tower on stilts with life preserver & stairs
 * 2) Illuminated coastal wooden Pier leading directly out to the Stinger Speedboat
 * 3) Beach loungers with pastel towels, a beach volleyball net, swaying dune grass & tiki torches
 */
export function buildBeachHighlights(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  getBeachHeight: (x: number, z: number) => number,
): BeachPropsHandle {
  const addSolid = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
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
      tag: 'beach-prop',
    });
    return mesh;
  };

  const woodMat = new THREE.MeshStandardMaterial({ color: '#9c7b60', roughness: 0.85 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#5c4638', roughness: 0.9 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f7f1ea', roughness: 0.55 });
  const mintMat = new THREE.MeshStandardMaterial({ color: '#8de4d3', roughness: 0.5 });
  const coralMat = new THREE.MeshStandardMaterial({ color: '#ff6f91', roughness: 0.5 });
  const flameMat = new THREE.MeshStandardMaterial({
    color: '#ffcf70',
    emissive: '#ff8c2b',
    emissiveIntensity: 3.2,
  });

  // ---------------------------------------------------------------------------
  // 1) Iconic South Beach Pastel Art-Deco Lifeguard Tower (x = 86, z = -14)
  // ---------------------------------------------------------------------------
  const lgX = 86;
  const lgZ = -14;
  const lgBaseY = getBeachHeight(lgX, lgZ);
  const deckY = lgBaseY + 2.35;

  // 4 Timber stilts sunk into the sloping sand
  for (const sx of [-1.6, 1.6]) {
    for (const sz of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, 0.24), darkWoodMat);
      post.position.set(lgX + sx, lgBaseY + 1.0, lgZ + sz);
      post.castShadow = true;
      scene.add(post);
    }
  }

  // Walkable viewing deck platform
  addSolid(4.0, 0.22, 4.0, lgX, deckY, lgZ, woodMat, true);

  // Pastel Art-Deco cabin (mint base + coral racing stripe + open ocean-facing window)
  addSolid(2.5, 2.2, 2.5, lgX - 0.3, deckY + 1.2, lgZ, mintMat, true);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.36, 2.58), coralMat);
  stripe.position.set(lgX - 0.3, deckY + 1.15, lgZ);
  scene.add(stripe);

  // Pitched Art-Deco roof overhang
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.05, 4), whiteMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(lgX - 0.3, deckY + 2.82, lgZ);
  roof.castShadow = true;
  scene.add(roof);

  // Glowing coral-orange life preserver ring mounted on the west wall
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.1, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#ff4d4d', emissive: '#ff3333', emissiveIntensity: 0.5 }),
  );
  ring.rotation.y = Math.PI / 2;
  ring.position.set(lgX - 1.58, deckY + 1.25, lgZ);
  scene.add(ring);

  // Walkable wooden stairs climbing up the south side of the Lifeguard Tower (step height 0.24m)
  const lgSteps = 10;
  for (let s = 0; s < lgSteps; s++) {
    const stepTop = lgBaseY + (s + 1) * 0.235;
    const stepZ = lgZ + 2.0 + (lgSteps - s) * 0.34;
    addSolid(1.4, stepTop - lgBaseY + 0.3, 0.38, lgX + 0.6, (stepTop + lgBaseY - 0.3) / 2, stepZ, woodMat, true);
  }

  // ---------------------------------------------------------------------------
  // 2) Illuminated Wooden Pier leading directly out to the Stinger Speedboat (z = 8)
  // ---------------------------------------------------------------------------
  const pierZ = 8;
  const pierY = 0.42;
  // Main walkable pier deck (x = 87 .. 108)
  addSolid(21.0, 0.24, 3.2, 97.5, pierY, pierZ, woodMat, true);

  // Gentle 3-step entrance ramp from the sloping sand at x = 84..87
  for (let s = 0; s < 3; s++) {
    const sx = 85.2 + s * 0.7;
    const sy = THREE.MathUtils.lerp(getBeachHeight(84.8, pierZ), pierY, (s + 1) / 3);
    addSolid(0.76, 0.36, 3.1, sx, sy - 0.1, pierZ, woodMat, false);
  }

  // Pier pilings & glowing warm bollard lanterns
  const torchFlames: THREE.Mesh[] = [];
  for (let px = 88; px <= 107; px += 4.75) {
    for (const side of [-1.45, 1.45]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 8), darkWoodMat);
      piling.position.set(px, pierY - 0.45, pierZ + side);
      piling.castShadow = true;
      scene.add(piling);

      // Warm lantern bulb on alternating pilings
      if (px === 88 || px === 97.5 || px === 107) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), flameMat);
        bulb.position.set(px, pierY + 0.72, pierZ + side);
        scene.add(bulb);
        torchFlames.push(bulb);
      }
    }
  }
  const pierLight = new THREE.PointLight('#ff9d47', 22, 22, 1.6);
  pierLight.position.set(106, pierY + 1.8, pierZ);
  scene.add(pierLight);

  // ---------------------------------------------------------------------------
  // 3) Beach Loungers, Pastel Towels & Beach Volleyball Net
  // ---------------------------------------------------------------------------
  const towelColors = ['#ff4fa3', '#36f1e6', '#ffd15c', '#8de4d3', '#ff8b7b'];
  const loungerSpots: [number, number][] = [
    [82, -26],
    [82, -23.4],
    [83, -4],
    [83, -1.4],
    [84, 17],
    [84, 19.6],
  ];
  loungerSpots.forEach(([lx, lz], i) => {
    const ly = getBeachHeight(lx, lz);
    const lounger = new THREE.Group();
    lounger.position.set(lx, ly + 0.08, lz);
    lounger.rotation.z = -0.025; // subtle match to downward beach slope

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.78), whiteMat);
    frame.castShadow = true;
    lounger.add(frame);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.76), whiteMat);
    backrest.position.set(-0.78, 0.24, 0);
    backrest.rotation.z = -0.58;
    lounger.add(backrest);

    const towelMat = new THREE.MeshStandardMaterial({ color: towelColors[i % towelColors.length], roughness: 0.85 });
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.04, 0.68), towelMat);
    towel.position.set(0.1, 0.09, 0);
    lounger.add(towel);

    scene.add(lounger);
  });

  // Beach Volleyball Net (x = 85, z = 28)
  const vbX = 85;
  const vbZ = 28;
  const vbY = getBeachHeight(vbX, vbZ);
  const netPostMat = new THREE.MeshStandardMaterial({ color: '#f5efe8', roughness: 0.4 });
  for (const side of [-3.6, 3.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), netPostMat);
    post.position.set(vbX, vbY + 1.25, vbZ + side);
    post.castShadow = true;
    scene.add(post);
  }
  const netMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 0.95),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      wireframe: true,
      side: THREE.DoubleSide,
    }),
  );
  netMesh.rotation.y = Math.PI / 2;
  netMesh.position.set(vbX, vbY + 1.95, vbZ);
  scene.add(netMesh);

  // Volleyball resting on the sand
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#fff4e6', emissive: '#ff9f43', emissiveIntensity: 0.15 }),
  );
  ball.position.set(vbX + 1.8, getBeachHeight(vbX + 1.8, vbZ + 1.2) + 0.16, vbZ + 1.2);
  scene.add(ball);

  // ---------------------------------------------------------------------------
  // 4) Swaying Coastal Dune Grass Tufts along the Seawall Edge (x = 75..78)
  // ---------------------------------------------------------------------------
  const grassTufts: { mesh: THREE.Object3D; phase: number }[] = [];
  const grassMat = new THREE.MeshStandardMaterial({
    color: '#4f7d58',
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const bladeGeo = new THREE.ConeGeometry(0.28, 0.85, 5);
  for (let gz = -58; gz <= 58; gz += 7.5) {
    if (Math.abs(gz - pierZ) < 5) continue;
    const gx = 75.3 + ((Math.abs(gz * 13) % 10) * 0.22);
    const gy = getBeachHeight(gx, gz);
    const tuft = new THREE.Mesh(bladeGeo, grassMat);
    tuft.position.set(gx, gy + 0.36, gz);
    tuft.scale.set(1.1, 0.8 + (Math.abs(gz) % 3) * 0.2, 1.1);
    scene.add(tuft);
    grassTufts.push({ mesh: tuft, phase: gz * 0.4 });
  }

  // ---------------------------------------------------------------------------
  // 5) Circling Coastal Seagulls high over the Beach & Golden-Hour Surf
  // ---------------------------------------------------------------------------
  interface Seagull {
    group: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    centerX: number;
    centerZ: number;
    radius: number;
    altitude: number;
    speed: number;
    phase: number;
  }
  const gulls: Seagull[] = [];
  const gullMat = new THREE.MeshStandardMaterial({ color: '#f7f4f0', roughness: 0.6 });
  const wingGeo = new THREE.BoxGeometry(0.65, 0.04, 0.24);

  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.55), gullMat);
    g.add(body);

    const leftWing = new THREE.Mesh(wingGeo, gullMat);
    leftWing.position.set(-0.36, 0.02, 0);
    g.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, gullMat);
    rightWing.position.set(0.36, 0.02, 0);
    g.add(rightWing);

    scene.add(g);
    gulls.push({
      group: g,
      leftWing,
      rightWing,
      centerX: 96 + (i % 3) * 14,
      centerZ: -38 + i * 20,
      radius: 14 + (i % 3) * 6,
      altitude: 14 + (i % 4) * 2.4,
      speed: 0.26 + (i % 3) * 0.06,
      phase: i * 1.4,
    });
  }

  return {
    update: (elapsed: number) => {
      for (const g of grassTufts) {
        g.mesh.rotation.z = Math.sin(elapsed * 2.1 + g.phase) * 0.12;
      }
      for (let i = 0; i < torchFlames.length; i++) {
        const s = 0.92 + Math.sin(elapsed * 8.5 + i * 1.7) * 0.14;
        torchFlames[i].scale.setScalar(s);
      }
      for (const gull of gulls) {
        const a = elapsed * gull.speed + gull.phase;
        const gx = gull.centerX + Math.cos(a) * gull.radius;
        const gz = gull.centerZ + Math.sin(a) * gull.radius;
        const gy = gull.altitude + Math.sin(elapsed * 0.9 + gull.phase) * 0.9;
        gull.group.position.set(gx, gy, gz);
        // Face tangent direction of the orbit
        gull.group.rotation.y = -a;
        const flap = Math.sin(elapsed * 6.5 + gull.phase * 2.0) * 0.42;
        gull.leftWing.rotation.z = flap;
        gull.rightWing.rotation.z = -flap;
      }
    },
  };
}
