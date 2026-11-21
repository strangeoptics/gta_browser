import * as THREE from 'three';
import type { AABB } from '../types';
import { createNeonSignTexture } from './Textures';
import type { FoodItem } from './Safehouse';

export interface PoliceStationHandle {
  position: THREE.Vector3;
  isInside: (pos: THREE.Vector3) => boolean;
  isNearDesk: (pos: THREE.Vector3) => boolean;
  isNearKevlar: (pos: THREE.Vector3) => boolean;
  isNearArmory: (pos: THREE.Vector3) => boolean;
  isNearUniform: (pos: THREE.Vector3) => boolean;
  isNearEvidenceCash: (pos: THREE.Vector3) => boolean;
  canTakeKevlar: () => boolean;
  takeKevlar: () => void;
  takeEvidenceCash: () => void;
  getDonuts: () => FoodItem[];
  consumeDonut: (item: FoodItem) => void;
  triggerAlarm: () => void;
  lockCellBriefly: () => void;
  update: (elapsed: number, dt: number, playerPos?: THREE.Vector3, cash?: number, wantedStars?: number) => void;
}

/**
 * Builds the walk-in Art-Deco "VICE PD · PRECINCT 06" Police Station at West Downtown (-40, 0).
 * - Main entrance (+X) facing Central Plaza with blue globe lamps & automatic glass sliding doors
 * - Lobby with Reception Desk, Desk Sergeant, dynamic Wanted Bulletin Board & Donut Coffee Bar
 * - 2 Holding Cells with steel bars & benches (NW wing)
 * - Restricted Evidence & Armory Room (SW wing) with free Kevlar Vest, Shotgun Ammo Rack & Vice PD Uniform Locker
 * - Walkable exterior stairs (South) up to the rooftop Police Helipad ("H")
 */
export function buildPoliceStation(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
): PoliceStationHandle {
  const cx = -40;
  const cz = 0;
  const floorY = 0.18;
  const floorH = 5.0;
  const roofY = floorY + floorH;

  const stuccoMat = new THREE.MeshStandardMaterial({ color: '#eceef4', roughness: 0.65 });
  const navyMat = new THREE.MeshStandardMaterial({ color: '#162544', roughness: 0.45, metalness: 0.25 });
  const trimGoldMat = new THREE.MeshStandardMaterial({ color: '#d8b04c', roughness: 0.3, metalness: 0.78 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#c8d2de', roughness: 0.24, metalness: 0.12 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: '#dde3ec', roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#384052', roughness: 0.88 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#707b8c', roughness: 0.35, metalness: 0.82 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#4d3527', roughness: 0.52 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#9ad8ff',
    roughness: 0.08,
    metalness: 0.65,
    transparent: true,
    opacity: 0.42,
  });
  const pdBlueNeonMat = new THREE.MeshStandardMaterial({
    color: '#33aaff',
    emissive: '#1e88ff',
    emissiveIntensity: 2.3,
  });
  const alarmRedMat = new THREE.MeshStandardMaterial({
    color: '#ff2244',
    emissive: '#ff1a3a',
    emissiveIntensity: 0.2,
  });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    tag = 'police-station',
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

  // --- Floor & Roof Slab ---
  addBox(20.0, 0.16, 20.0, cx, floorY + 0.08, cz, floorMat, false, 'pd-floor');
  addBox(20.4, 0.34, 20.4, cx, roofY + 0.17, cz, roofMat, true, 'pd-roof');

  // Ceiling panel (non-colliding visual underside)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(19.4, 19.4), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, roofY - 0.02, cz);
  scene.add(ceiling);

  // --- Exterior Walls (20m x 20m, entrance opening on +X at z: -2.2..2.2) ---
  // West back wall
  addBox(0.55, floorH, 20.0, cx - 9.75, floorY + floorH / 2, cz, stuccoMat);
  // North wall
  addBox(20.0, floorH, 0.55, cx, floorY + floorH / 2, cz - 9.75, stuccoMat);
  // South wall
  addBox(20.0, floorH, 0.55, cx, floorY + floorH / 2, cz + 9.75, stuccoMat);
  // East front wall (split around 4.4m wide glass entrance + transom lintel)
  addBox(0.55, floorH, 7.8, cx + 9.75, floorY + floorH / 2, cz - 6.1, stuccoMat);
  addBox(0.55, floorH, 7.8, cx + 9.75, floorY + floorH / 2, cz + 6.1, stuccoMat);
  addBox(0.55, 1.5, 4.6, cx + 9.75, floorY + 4.25, cz, stuccoMat);

  // Navy Art-Deco base trim & pilasters on front facade
  for (const pz of [-9.4, -2.5, 2.5, 9.4]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.45, floorH + 0.4, 0.65), navyMat);
    pilaster.position.set(cx + 10.05, floorY + floorH / 2 + 0.2, cz + pz);
    pilaster.castShadow = true;
    scene.add(pilaster);
  }
  const facadeBandN = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 7.2), navyMat);
  facadeBandN.position.set(cx + 10.06, floorY + 0.6, cz - 6.0);
  scene.add(facadeBandN);
  const facadeBandS = facadeBandN.clone();
  facadeBandS.position.z = cz + 6.0;
  scene.add(facadeBandS);

  // Rooftop Parapet Walls (low knee wall with opening at South stairs)
  const paraY = roofY + 0.72;
  addBox(0.35, 0.85, 20.2, cx - 10.0, paraY, cz, stuccoMat, false, 'pd-parapet');
  addBox(0.35, 0.85, 20.2, cx + 10.0, paraY, cz, stuccoMat, false, 'pd-parapet');
  addBox(20.2, 0.85, 0.35, cx, paraY, cz - 10.0, stuccoMat, false, 'pd-parapet');
  // South parapet leaves 2.4m entry gap at x: -33.5..-31.1 for the exterior roof stairs
  addBox(16.0, 0.85, 0.35, cx - 2.1, paraY, cz + 10.0, stuccoMat, false, 'pd-parapet');
  addBox(1.8, 0.85, 0.35, cx + 9.2, paraY, cz + 10.0, stuccoMat, false, 'pd-parapet');

  // Neon blue crown trim along front roofline
  const frontNeon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 20.2), pdBlueNeonMat);
  frontNeon.position.set(cx + 10.18, roofY + 1.1, cz);
  scene.add(frontNeon);

  // Main "VICE PD" Glowing Neon Sign above entrance
  const signTex = createNeonSignTexture('VICE PD · 06', '#33aaff');
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: new THREE.Color('#33aaff'),
    emissiveMap: signTex,
    emissiveIntensity: 1.7,
    roughness: 0.25,
  });
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.55, 6.8), signMat);
  signMesh.position.set(cx + 10.25, floorY + 4.45, cz);
  scene.add(signMesh);

  // Iconic Blue Police Globe Lamps flanking the entrance
  const globeMat = new THREE.MeshStandardMaterial({
    color: '#66ccff',
    emissive: '#1e90ff',
    emissiveIntensity: 2.8,
  });
  for (const lz of [-2.85, 2.85]) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.7, 10), navyMat);
    ped.position.set(cx + 10.75, floorY + 0.85, cz + lz);
    scene.add(ped);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), globeMat);
    globe.position.set(cx + 10.75, floorY + 1.92, cz + lz);
    scene.add(globe);
  }

  // --- Automatic Front Glass Sliding Doors ---
  const frontDoorN = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.35, 2.15), glassMat);
  frontDoorN.position.set(cx + 9.75, floorY + 1.75, cz - 1.08);
  scene.add(frontDoorN);
  const frontDoorS = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.35, 2.15), glassMat);
  frontDoorS.position.set(cx + 9.75, floorY + 1.75, cz + 1.08);
  scene.add(frontDoorS);

  // --- Exterior Walkable Rooftop Stairs (South side -> leads up to Police Helipad!) ---
  const stepH = 0.24; // <= 0.28m maxStepHeight
  const stepRun = 0.38;
  const numSteps = Math.ceil((floorH + 0.16) / stepH);
  for (let s = 0; s < numSteps; s++) {
    const topY = floorY + (s + 1) * stepH;
    const sx = cx - 0.6 + s * stepRun;
    addBox(stepRun + 0.04, topY - floorY, 1.8, sx, (topY + floorY) / 2, cz + 11.1, navyMat, true, 'pd-stairs');
  }
  // Upper landing connecting top step to the South parapet gap
  addBox(2.4, 0.34, 2.2, cx + 7.7, roofY + 0.17, cz + 11.0, roofMat, true, 'pd-stairs');

  // --- Rooftop Police Helipad ("H") ---
  const padCircle = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 4.9, 32),
    new THREE.MeshStandardMaterial({ color: '#ffd15c', roughness: 0.6, side: THREE.DoubleSide }),
  );
  padCircle.rotation.x = -Math.PI / 2;
  padCircle.position.set(cx - 1.0, roofY + 0.36, cz - 0.5);
  scene.add(padCircle);

  const hBarMat = new THREE.MeshStandardMaterial({ color: '#f5f2e8', roughness: 0.55 });
  const hLeft = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 4.2), hBarMat);
  hLeft.position.set(cx - 2.3, roofY + 0.36, cz - 0.5);
  scene.add(hLeft);
  const hRight = hLeft.clone();
  hRight.position.x = cx + 0.3;
  scene.add(hRight);
  const hCross = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.55), hBarMat);
  hCross.position.set(cx - 1.0, roofY + 0.36, cz - 0.5);
  scene.add(hCross);

  // 4 Corner Helipad Landing Beacons
  const beaconMat = new THREE.MeshStandardMaterial({
    color: '#33aaff',
    emissive: '#33aaff',
    emissiveIntensity: 2.5,
  });
  for (const [bx, bz] of [
    [-5.8, -5.3],
    [3.8, -5.3],
    [-5.8, 4.3],
    [3.8, 4.3],
  ]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 8), beaconMat);
    b.position.set(cx + bx, roofY + 0.45, cz + bz);
    scene.add(b);
  }

  // --- Interior Partition Walls ---
  // Divide Lobby (East) from Cell Block (NW) & Evidence Armory (SW) along x = cx + 0.5 (-39.5)
  // Opening into Cell Block corridor at z: -4.2..-1.8, opening into Evidence Room at z: 4.3..6.7
  addBox(0.35, floorH, 5.2, cx + 0.5, floorY + floorH / 2, cz - 6.9, stuccoMat);
  addBox(0.35, floorH, 6.0, cx + 0.5, floorY + floorH / 2, cz + 1.2, stuccoMat);
  addBox(0.35, floorH, 2.8, cx + 0.5, floorY + floorH / 2, cz + 8.1, stuccoMat);
  // Divider between Cell Block (North) and Evidence Armory (South) at z = cz + 1.2
  addBox(9.8, floorH, 0.35, cx - 4.6, floorY + floorH / 2, cz + 1.2, stuccoMat);

  // Automatic Security Glass Door into Evidence Room (x = -39.5, z = 5.5)
  const evidenceDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.2, 2.3), glassMat);
  evidenceDoor.position.set(cx + 0.5, floorY + 1.65, cz + 5.5);
  scene.add(evidenceDoor);

  const restrictedTex = createNeonSignTexture('EVIDENCE · ARMORY', '#ff4455');
  const restrictedSign = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.6, 2.5),
    new THREE.MeshStandardMaterial({
      map: restrictedTex,
      emissive: new THREE.Color('#ff4455'),
      emissiveMap: restrictedTex,
      emissiveIntensity: 1.5,
    }),
  );
  restrictedSign.position.set(cx + 0.72, floorY + 3.65, cz + 5.5);
  scene.add(restrictedSign);

  // --- 1) Lobby Reception Desk & Desk Sergeant ---
  addBox(1.1, 1.15, 5.0, cx + 3.6, floorY + 0.58, cz, woodMat);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 5.2), navyMat);
  counterTop.position.set(cx + 3.6, floorY + 1.18, cz);
  scene.add(counterTop);

  // Brass badge emblem on front of desk
  const deskEmblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), trimGoldMat);
  deskEmblem.scale.set(0.2, 1.0, 1.0);
  deskEmblem.position.set(cx + 4.22, floorY + 0.65, cz);
  scene.add(deskEmblem);

  // Retro CRT monitor on reception desk
  const crt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), steelMat);
  crt.position.set(cx + 3.55, floorY + 1.4, cz - 1.3);
  scene.add(crt);
  const crtScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.24, 0.3),
    new THREE.MeshStandardMaterial({ color: '#22ffaa', emissive: '#18cc88', emissiveIntensity: 1.1 }),
  );
  crtScreen.position.set(cx + 3.33, floorY + 1.42, cz - 1.3);
  scene.add(crtScreen);

  // Desk Sergeant (friendly Vice PD officer behind the counter)
  const sergeant = new THREE.Group();
  sergeant.position.set(cx + 2.5, floorY, cz + 0.2);
  const sUniformMat = new THREE.MeshStandardMaterial({ color: '#1b305c', roughness: 0.65 });
  const sSkinMat = new THREE.MeshStandardMaterial({ color: '#dfb190', roughness: 0.72 });
  const sTorso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.28), sUniformMat);
  sTorso.position.y = 1.18;
  sergeant.add(sTorso);
  const sBadge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.09), trimGoldMat);
  sBadge.position.set(0.24, 1.3, -0.09);
  sergeant.add(sBadge);
  const sHead = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.29, 0.27), sSkinMat);
  sHead.position.y = 1.66;
  sergeant.add(sHead);
  const sCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), navyMat);
  sCap.position.y = 1.84;
  sergeant.add(sCap);
  const sBrim = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.26), new THREE.MeshStandardMaterial({ color: '#0d1018' }));
  sBrim.position.set(0.16, 1.8, 0);
  sergeant.add(sBrim);
  scene.add(sergeant);

  // --- 2) Dynamic "MOST WANTED" Bulletin Board (South Lobby Wall) ---
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 256;
  boardCanvas.height = 128;
  const boardCtx = boardCanvas.getContext('2d')!;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  let lastBoardKey = '';

  const redrawWantedBoard = (cash: number, stars: number) => {
    const key = `${stars}:${Math.floor(cash / 100)}`;
    if (key === lastBoardKey) return;
    lastBoardKey = key;
    boardCtx.fillStyle = '#5c4028';
    boardCtx.fillRect(0, 0, 256, 128);
    boardCtx.strokeStyle = '#2d1c10';
    boardCtx.lineWidth = 6;
    boardCtx.strokeRect(3, 3, 250, 122);

    boardCtx.fillStyle = '#f5ecd9';
    boardCtx.fillRect(14, 14, 228, 100);
    boardCtx.fillStyle = stars > 0 ? '#cc1833' : '#18345e';
    boardCtx.fillRect(14, 14, 228, 24);
    boardCtx.fillStyle = '#ffffff';
    boardCtx.font = 'bold 14px monospace';
    boardCtx.fillText('VICE PD · MOST WANTED', 26, 31);

    boardCtx.fillStyle = '#1b1d26';
    boardCtx.font = 'bold 13px monospace';
    boardCtx.fillText(`WANTED LEVEL: ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`, 24, 60);
    boardCtx.fillText(`STATUS: ${stars > 0 ? 'ARMED & DANGEROUS' : 'NO ACTIVE WARRANT'}`, 24, 80);
    boardCtx.fillStyle = '#265c3a';
    boardCtx.fillText(`SUSPECT CASH: $${cash.toLocaleString('en-US')}`, 24, 100);
    boardTex.needsUpdate = true;
  };
  redrawWantedBoard(0, 0);

  const wantedBoard = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.6, 0.1),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.65 }),
  );
  wantedBoard.position.set(cx + 5.2, floorY + 2.35, cz + 9.4);
  scene.add(wantedBoard);

  // --- 3) Coffee & Edible Donut Bar (North Lobby Wall) ---
  addBox(3.4, 0.95, 0.9, cx + 5.5, floorY + 0.48, cz - 8.95, woodMat);
  const coffeePot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.44, 10), steelMat);
  coffeePot.position.set(cx + 4.3, floorY + 1.18, cz - 8.95);
  scene.add(coffeePot);

  // 3 Edible Glazed Donuts (interacts via crosshair -> 3D Hand!)
  const donuts: FoodItem[] = [];
  const donutColors = [
    { name: 'PINK DONUT', glaze: '#ff66b2', heal: 18 },
    { name: 'CHOCO DONUT', glaze: '#4e2c1c', heal: 18 },
    { name: 'MIAMI GLAZED DONUT', glaze: '#36f1e6', heal: 22 },
  ];
  const doughMat = new THREE.MeshStandardMaterial({ color: '#dca360', roughness: 0.72 });
  donutColors.forEach((d, idx) => {
    const dg = new THREE.Group();
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 10, 18), doughMat);
    base.rotation.x = Math.PI / 2;
    dg.add(base);
    const glaze = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.036, 8, 16),
      new THREE.MeshStandardMaterial({ color: d.glaze, roughness: 0.25 }),
    );
    glaze.rotation.x = Math.PI / 2;
    glaze.position.y = 0.018;
    dg.add(glaze);
    dg.position.set(cx + 5.4 + idx * 0.48, floorY + 1.0, cz - 8.85);
    scene.add(dg);
    donuts.push({ id: `pd-donut-${idx}`, name: d.name, heal: d.heal, mesh: dg, available: true, respawnTimer: 0 });
  });

  // --- 4) Holding Cell Block (NW Wing: x: -49.5..-39.5, z: -9.5..1.0) ---
  // Divider between Cell 1 (West) and Cell 2 (East) at x = cx - 4.8
  addBox(0.3, floorH, 4.6, cx - 4.8, floorY + floorH / 2, cz - 7.1, stuccoMat);

  // Steel Cell Bars along z = cz - 4.8 (single InstancedMesh -> 1 draw call instead of 22!)
  const barXList: number[] = [];
  for (let bx = cx - 9.2; bx <= cx - 0.4; bx += 0.38) {
    if (bx > cx - 2.6 && bx < cx - 1.1) continue; // open cell doorway
    barXList.push(bx);
  }
  const barGeo = new THREE.CylinderGeometry(0.025, 0.025, floorH - 0.3, 6);
  const barInst = new THREE.InstancedMesh(barGeo, steelMat, barXList.length);
  const barDummy = new THREE.Object3D();
  barXList.forEach((bx, idx) => {
    barDummy.position.set(bx, floorY + floorH / 2, cz - 4.8);
    barDummy.updateMatrix();
    barInst.setMatrixAt(idx, barDummy.matrix);
  });
  barInst.instanceMatrix.needsUpdate = true;
  scene.add(barInst);
  // Colliders for the barred cell fronts (leaving the open doorway walkable)
  colliders.push({
    minX: cx - 9.5,
    maxX: cx - 2.6,
    minY: floorY,
    maxY: roofY,
    minZ: cz - 4.95,
    maxZ: cz - 4.65,
    tag: 'pd-bars',
  });
  colliders.push({
    minX: cx - 1.1,
    maxX: cx + 0.3,
    minY: floorY,
    maxY: roofY,
    minZ: cz - 4.95,
    maxZ: cz - 4.65,
    tag: 'pd-bars',
  });

  // Metal cell benches inside both cells
  addBox(2.2, 0.5, 0.7, cx - 7.2, floorY + 0.25, cz - 8.8, steelMat);
  addBox(2.2, 0.5, 0.7, cx - 2.5, floorY + 0.25, cz - 8.8, steelMat);

  // Sliding steel gate for Holding Cell 2 (closes briefly on BUSTED respawn, then slides open!)
  const cellGate = new THREE.Group();
  for (let gx = -0.58; gx <= 0.58; gx += 0.29) {
    const gBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, floorH - 0.3, 6), steelMat);
    gBar.position.set(gx, floorY + floorH / 2, 0);
    cellGate.add(gBar);
  }
  const gateCross = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.06), steelMat);
  gateCross.position.set(0, floorY + 1.4, 0);
  cellGate.add(gateCross);
  cellGate.position.set(cx - 1.85, 0, cz - 4.8);
  scene.add(cellGate);
  let cellLockTimer = 0;
  let cellGateOpenT = 1;

  // --- 5) Evidence & Armory Room (SW Wing: x: -49.5..-39.5, z: 1.5..9.5) ---
  const kevlarPos = new THREE.Vector3(cx - 6.8, floorY, cz + 3.4);
  const evidenceCashPos = new THREE.Vector3(cx - 6.8, floorY, cz + 5.4);
  const armoryPos = new THREE.Vector3(cx - 6.8, floorY, cz + 7.5);
  const uniformPos = new THREE.Vector3(cx - 2.6, floorY, cz + 8.6);

  // Kevlar Vest Pedestal + Floating Tactical Vest
  addBox(1.1, 0.9, 1.1, kevlarPos.x, floorY + 0.45, kevlarPos.z, navyMat);
  const kevlarMesh = new THREE.Group();
  const vestBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.62, 0.28),
    new THREE.MeshStandardMaterial({ color: '#2874f0', emissive: '#1448aa', emissiveIntensity: 0.45, roughness: 0.4 }),
  );
  const vestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.32), navyMat);
  kevlarMesh.add(vestBody, vestPlate);
  kevlarMesh.position.set(kevlarPos.x, floorY + 1.48, kevlarPos.z);
  scene.add(kevlarMesh);
  let kevlarAvailable = true;
  let kevlarRespawn = 0;

  // Confiscated Syndicate Cash Briefcase (+$1,500 Evidence Heist!)
  addBox(0.95, 0.9, 0.95, evidenceCashPos.x, floorY + 0.45, evidenceCashPos.z, navyMat);
  const cashCaseMesh = new THREE.Group();
  const caseBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.36, 0.16),
    new THREE.MeshStandardMaterial({ color: '#1b1d24', roughness: 0.3, metalness: 0.78 }),
  );
  const caseTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.06, 0.18),
    new THREE.MeshStandardMaterial({ color: '#ffd15c', emissive: '#ffaa22', emissiveIntensity: 1.4, metalness: 0.85, roughness: 0.2 }),
  );
  const caseHandle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.05), trimGoldMat);
  caseHandle.position.y = 0.21;
  cashCaseMesh.add(caseBody, caseTrim, caseHandle);
  cashCaseMesh.position.set(evidenceCashPos.x, floorY + 1.35, evidenceCashPos.z);
  scene.add(cashCaseMesh);
  let evidenceCashAvailable = true;
  let evidenceCashRespawn = 0;

  // Police Shotgun & Ammo Rack
  addBox(0.9, 1.9, 2.2, armoryPos.x - 1.6, floorY + 0.95, armoryPos.z, steelMat);
  const ammoCrate = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.42, 0.52),
    new THREE.MeshStandardMaterial({ color: '#2b4d32', roughness: 0.7 }),
  );
  ammoCrate.position.set(armoryPos.x - 0.5, floorY + 0.24, armoryPos.z);
  scene.add(ammoCrate);
  const rackShotgun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.15), new THREE.MeshStandardMaterial({ color: '#1b1d24', metalness: 0.85, roughness: 0.25 }));
  rackShotgun.position.set(armoryPos.x - 1.1, floorY + 1.25, armoryPos.z);
  scene.add(rackShotgun);

  // Vice PD Uniform Locker
  addBox(1.4, 2.4, 0.75, uniformPos.x, floorY + 1.2, uniformPos.z + 0.4, navyMat);
  const lockerBadge = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), trimGoldMat);
  lockerBadge.position.set(uniformPos.x, floorY + 1.75, uniformPos.z - 0.02);
  scene.add(lockerBadge);

  // Interior Lighting + Red Alarm Beacon (always visible, modulated via intensity -> zero shader recompiles!)
  const lobbyLight = new THREE.PointLight('#d8eeff', 16, 26, 1.5);
  lobbyLight.position.set(cx + 1.0, roofY - 0.6, cz);
  scene.add(lobbyLight);

  const alarmBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.24, 10), alarmRedMat);
  alarmBeacon.position.set(cx - 3.0, roofY - 0.18, cz + 5.5);
  scene.add(alarmBeacon);
  const alarmLight = new THREE.PointLight('#ff1a3a', 0, 18, 1.6);
  alarmLight.position.set(cx - 3.0, roofY - 0.5, cz + 5.5);
  scene.add(alarmLight);

  let frontOpenT = 0;
  let evidenceOpenT = 0;
  let alarmTimer = 0;

  return {
    position: new THREE.Vector3(cx, floorY, cz),
    isInside: (pos: THREE.Vector3) =>
      pos.x > cx - 10 &&
      pos.x < cx + 10 &&
      pos.z > cz - 10 &&
      pos.z < cz + 10 &&
      pos.y < roofY + 0.2,
    isNearDesk: (pos: THREE.Vector3) =>
      pos.x > cx + 3.8 && pos.x < cx + 7.2 && Math.abs(pos.z - cz) < 2.8 && pos.y < 2.5,
    isNearKevlar: (pos: THREE.Vector3) =>
      kevlarAvailable && Math.hypot(pos.x - kevlarPos.x, pos.z - kevlarPos.z) < 2.2 && pos.y < 2.5,
    isNearArmory: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - armoryPos.x, pos.z - armoryPos.z) < 2.4 && pos.y < 2.5,
    isNearUniform: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - uniformPos.x, pos.z - uniformPos.z) < 2.2 && pos.y < 2.5,
    isNearEvidenceCash: (pos: THREE.Vector3) =>
      evidenceCashAvailable && Math.hypot(pos.x - evidenceCashPos.x, pos.z - evidenceCashPos.z) < 2.2 && pos.y < 2.5,
    canTakeKevlar: () => kevlarAvailable,
    takeKevlar: () => {
      kevlarAvailable = false;
      kevlarMesh.visible = false;
      kevlarRespawn = 45.0;
    },
    takeEvidenceCash: () => {
      evidenceCashAvailable = false;
      cashCaseMesh.visible = false;
      evidenceCashRespawn = 60.0;
    },
    getDonuts: () => donuts.filter((d) => d.available),
    consumeDonut: (item: FoodItem) => {
      if (!item.available) return;
      item.available = false;
      item.mesh.visible = false;
      item.respawnTimer = 25.0;
    },
    triggerAlarm: () => {
      alarmTimer = 20.0;
    },
    lockCellBriefly: () => {
      cellLockTimer = 1.8;
      cellGateOpenT = 0;
    },
    update: (elapsed: number, dt: number, playerPos?: THREE.Vector3, cash = 0, wantedStars = 0) => {
      const clampedDt = Math.min(dt, 0.05);
      const blend = 1 - Math.exp(-7.0 * clampedDt);
      const pdDistSq = playerPos ? (playerPos.x - cx) ** 2 + (playerPos.z - cz) ** 2 : 0;
      lobbyLight.intensity = pdDistSq < 40 * 40 ? 16 : 0;

      redrawWantedBoard(cash, wantedStars);

      // Restock donuts & Kevlar vest
      for (const d of donuts) {
        if (!d.available) {
          d.respawnTimer -= clampedDt;
          if (d.respawnTimer <= 0) {
            d.available = true;
            d.mesh.visible = true;
          }
        }
      }
      if (!kevlarAvailable) {
        kevlarRespawn -= clampedDt;
        if (kevlarRespawn <= 0) {
          kevlarAvailable = true;
          kevlarMesh.visible = true;
        }
      } else {
        kevlarMesh.rotation.y = elapsed * 1.4;
        kevlarMesh.position.y = floorY + 1.48 + Math.sin(elapsed * 2.6) * 0.06;
      }
      if (!evidenceCashAvailable) {
        evidenceCashRespawn -= clampedDt;
        if (evidenceCashRespawn <= 0) {
          evidenceCashAvailable = true;
          cashCaseMesh.visible = true;
        }
      } else {
        cashCaseMesh.rotation.y = -elapsed * 1.6;
        cashCaseMesh.position.y = floorY + 1.35 + Math.sin(elapsed * 3.0 + 1.0) * 0.07;
      }

      // Automatic front & evidence room glass sliding doors
      const distFront = playerPos ? Math.hypot(playerPos.x - (cx + 9.75), playerPos.z - cz) : 99;
      const distEvid = playerPos ? Math.hypot(playerPos.x - (cx + 0.5), playerPos.z - (cz + 5.5)) : 99;

      const wantFront = distFront < 4.4 && (playerPos?.y ?? 0) < 4.0 ? 1 : 0;
      const wantEvid = distEvid < 3.4 && (playerPos?.y ?? 0) < 4.0 ? 1 : 0;

      frontOpenT += (wantFront - frontOpenT) * blend;
      evidenceOpenT += (wantEvid - evidenceOpenT) * blend;

      frontDoorN.position.z = cz - 1.08 - frontOpenT * 1.95;
      frontDoorS.position.z = cz + 1.08 + frontOpenT * 1.95;
      evidenceDoor.position.z = cz + 5.5 + evidenceOpenT * 2.15;

      // Animate Holding Cell 2 sliding gate (closed during brief post-busted release, then slides open)
      if (cellLockTimer > 0) cellLockTimer = Math.max(0, cellLockTimer - clampedDt);
      const wantCellOpen = cellLockTimer <= 0 ? 1 : 0;
      cellGateOpenT += (wantCellOpen - cellGateOpenT) * (1 - Math.exp(-4.5 * clampedDt));
      cellGate.position.x = cx - 1.85 - cellGateOpenT * 1.45;

      // Red flashing alarm beacon when Evidence Room is raided or player has Wanted stars inside
      if (alarmTimer > 0) alarmTimer = Math.max(0, alarmTimer - clampedDt);
      const inside = playerPos
        ? playerPos.x > cx - 10 && playerPos.x < cx + 10 && playerPos.z > cz - 10 && playerPos.z < cz + 10
        : false;
      const alarmActive = alarmTimer > 0 || (inside && wantedStars > 0);
      if (alarmActive) {
        const pulse = Math.sin(elapsed * 14) > 0 ? 1 : 0.1;
        alarmRedMat.emissiveIntensity = 0.4 + pulse * 3.8;
        alarmLight.intensity = pulse * 26;
      } else {
        alarmRedMat.emissiveIntensity = 0.2;
        alarmLight.intensity = 0;
      }
    },
  };
}
