import * as THREE from 'three';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';
import { getFaceTexture } from '../entities/CharacterTextures';

export interface NeonClubHandle {
  isInside: (pos: THREE.Vector3) => boolean;
  getProximity: (pos: THREE.Vector3) => number; // 0 = far, 0.35 = outside door, 1.0 = inside club
  update: (elapsed: number) => void;
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
  const clubX = 40;
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

  // Sparkling mirror tiles around the disco ball
  const sparkleColors = ['#ffffff', '#36f1e6', '#ff4fa3', '#ffd15c'];
  const tileGeo = new THREE.BoxGeometry(0.11, 0.11, 0.04);
  for (let i = 0; i < 28; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 28);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const col = sparkleColors[i % sparkleColors.length];
    const tile = new THREE.Mesh(
      tileGeo,
      new THREE.MeshBasicMaterial({ color: col }),
    );
    tile.position.set(
      Math.sin(phi) * Math.cos(theta) * 0.7,
      Math.cos(phi) * 0.7,
      Math.sin(phi) * Math.sin(theta) * 0.7,
    );
    tile.lookAt(0, 0, 0);
    discoGroup.add(tile);
  }
  scene.add(discoGroup);

  // 4 Sweeping Volumetric Effect-Spotlight Cones mounted in ceiling corners
  const beamConfigs: { x: number; z: number; color: string; phase: number }[] = [
    { x: clubX - 5.5, z: clubZ - 5.5, color: '#ff4fa3', phase: 0 },
    { x: clubX + 6.5, z: clubZ - 5.5, color: '#36f1e6', phase: 1.5 },
    { x: clubX - 5.5, z: clubZ + 5.5, color: '#a86bff', phase: 3.1 },
    { x: clubX + 6.5, z: clubZ + 5.5, color: '#ffd15c', phase: 4.7 },
  ];
  const effectBeams: { pivot: THREE.Group; phase: number }[] = [];
  const beamConeGeo = new THREE.ConeGeometry(1.75, 6.8, 16, 1, true);
  beamConeGeo.translate(0, -3.4, 0); // apex at pivot!

  for (const cfg of beamConfigs) {
    const pivot = new THREE.Group();
    pivot.position.set(cfg.x, 6.05, cfg.z);

    // Lamp housing fixture
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: '#1b1824', metalness: 0.7, roughness: 0.3 }),
    );
    pivot.add(lamp);

    const beamMat = new THREE.MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(beamConeGeo, beamMat);
    pivot.add(cone);

    scene.add(pivot);
    effectBeams.push({ pivot, phase: cfg.phase });
  }

  // Orbiting dynamic club point lights
  const clubLightPink = new THREE.PointLight('#ff4fa3', 38, 24, 1.5);
  scene.add(clubLightPink);
  const clubLightCyan = new THREE.PointLight('#36f1e6', 38, 24, 1.5);
  scene.add(clubLightCyan);

  // ---------------------------------------------------------------------------
  // 3) Pulsing 6x5 LED Dancefloor
  // ---------------------------------------------------------------------------
  const danceTiles: { mat: THREE.MeshStandardMaterial; phase: number }[] = [];
  const floorTileGeo = new THREE.BoxGeometry(1.52, 0.05, 1.52);
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      const isPink = (gx + gz) % 2 === 0;
      const mat = new THREE.MeshStandardMaterial({
        color: isPink ? '#ff4fa3' : '#36f1e6',
        emissive: isPink ? '#ff4fa3' : '#36f1e6',
        emissiveIntensity: 1.1,
        roughness: 0.12,
      });
      const tile = new THREE.Mesh(floorTileGeo, mat);
      tile.position.set(clubX - 1.5 + gx * 1.6, 0.22, clubZ - 2.6 + gz * 1.6);
      scene.add(tile);
      danceTiles.push({ mat, phase: gx * 0.65 + gz * 0.85 });
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Elaborate Bar Counter, Backlit Bottle Wall, Barstools & Animated Bartender
  // ---------------------------------------------------------------------------
  const barX = clubX - 5.8;
  const barMat = new THREE.MeshStandardMaterial({ color: '#1b1029', roughness: 0.22, metalness: 0.5 });
  addBox(1.2, 1.16, 9.2, barX, 0.18 + 0.58, clubZ, barMat, true, 'prop');
  const barTrim = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.08, 9.3), pinkNeon);
  barTrim.position.set(barX, 0.18 + 1.18, clubZ);
  scene.add(barTrim);

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

  // Backlit neon bottle wall along the back wall (x = clubX - 8.3)
  const bottleColors = ['#36f1e6', '#ff4fa3', '#ffd15c', '#52f29c', '#a86bff'];
  const bottleGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.34, 6);
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = 1.35 + shelf * 0.72;
    const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 8.0), cyanNeon);
    shelfBoard.position.set(clubX - 8.35, sy, clubZ);
    scene.add(shelfBoard);
    for (let bz = -3.4; bz <= 3.4; bz += 0.62) {
      const col = bottleColors[Math.abs(Math.round(bz * 10) + shelf) % bottleColors.length];
      const bottle = new THREE.Mesh(
        bottleGeo,
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.75, roughness: 0.15 }),
      );
      bottle.position.set(clubX - 8.32, sy + 0.2, clubZ + bz);
      scene.add(bottle);
    }
  }

  // Animated Bartender behind the bar (black vest, white shirt, bow tie, sunglasses!)
  const bartender = createClubCharacter('#ffffff', '#191522', true);
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
    scene.add(deck);
    turntables.push(deck);
  }

  // Animated DJ behind the booth
  const dj = createClubCharacter('#ff4fa3', '#1d182b', true);
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
    ch.group.position.set(dx, 0.24, dz);
    scene.add(ch.group);
    dancers.push({ char: ch, baseY: 0.24, phase: idx * 1.4 });
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
    update: (elapsed: number) => {
      const beatPulse = Math.pow(0.5 + 0.5 * Math.sin(elapsed * beatRadPerSec), 3);

      // Rotate mirror Disco Ball
      discoGroup.rotation.y = elapsed * 0.95;

      // Sweep the 4 volumetric Effect-Spotlights across the dancefloor
      for (const b of effectBeams) {
        b.pivot.rotation.x = Math.sin(elapsed * 1.15 + b.phase) * 0.52;
        b.pivot.rotation.z = Math.cos(elapsed * 0.9 + b.phase) * 0.52;
      }

      // Orbiting disco lights
      clubLightPink.position.set(clubX + Math.cos(elapsed * 2.4) * 5.5, 5.0, clubZ + Math.sin(elapsed * 2.4) * 4.5);
      clubLightCyan.position.set(clubX - Math.cos(elapsed * 2.0) * 5.5, 5.0, clubZ - Math.sin(elapsed * 2.0) * 4.5);
      clubLightPink.intensity = 30 + beatPulse * 18;
      clubLightCyan.intensity = 30 + beatPulse * 18;

      // Pulsing LED dancefloor tiles
      for (const t of danceTiles) {
        t.mat.emissiveIntensity = 0.55 + 1.15 * (0.5 + 0.5 * Math.sin(elapsed * 5.2 + t.phase)) + beatPulse * 0.35;
      }

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

function createClubCharacter(shirtColor: string, pantsColor: string, sunglasses: boolean): ClubCharacter {
  const group = new THREE.Group();
  const skinColor = '#dda687';
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    emissive: shirtColor,
    emissiveIntensity: 0.22,
    roughness: 0.55,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#1f1620', roughness: 0.8 });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.74, 0.22), pantsMat);
  legs.position.y = 0.37;
  group.add(legs);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.24), shirtMat);
  torso.position.y = 1.05;
  group.add(torso);

  const faceTex = getFaceTexture(skinColor, sunglasses, false);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), [
    skinMat,
    skinMat,
    hairMat,
    skinMat,
    new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.6 }),
    hairMat,
  ]);
  head.position.y = 1.54;
  group.add(head);

  const buildArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.3, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 0.12), shirtMat);
    arm.position.y = -0.24;
    pivot.add(arm);
    group.add(pivot);
    return pivot;
  };

  return { group, leftArm: buildArm(-1), rightArm: buildArm(1) };
}
