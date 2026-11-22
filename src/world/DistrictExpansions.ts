import * as THREE from 'three';
import type { AABB } from '../types';
import { createWorldHelpers } from './BuildHelpers';
import { createNeonSignTexture } from './Textures';

export interface DistrictExpansionsHandle {
  update: (elapsed: number, playerPos?: THREE.Vector3) => void;
}

// -----------------------------------------------------------------------------
// Shared Procedural Textures for All 3 High-Detail District Expansions
// -----------------------------------------------------------------------------

function createHazardTexture(repeatX = 8): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8ad26';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#18181f';
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 4, 32);
    ctx.lineTo(x - 12, 32);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, 1);
  return tex;
}

function createCorrugatedContainerTex(baseHex: string, label: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 8, 3, 112);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 3, 8, 2, 112);
  }
  ctx.fillStyle = 'rgba(255,250,240,0.9)';
  ctx.font = '900 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGasPriceTotemTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#151026';
  ctx.fillRect(0, 0, 160, 256);
  ctx.strokeStyle = '#ff4fa3';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 152, 248);

  ctx.fillStyle = '#36f1e6';
  ctx.font = '900 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VICE GAS', 80, 38);
  ctx.fillStyle = '#ff9f43';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('24H SELF SERVE', 80, 62);

  const fuels: [string, string, string][] = [
    ['REGULAR', '0.89', '#52f29c'],
    ['UNLEADED', '0.96', '#ffd15c'],
    ['SUPER 98', '1.08', '#ff4fa3'],
    ['DIESEL', '0.84', '#36f1e6'],
  ];
  fuels.forEach(([name, price, col], i) => {
    const y = 104 + i * 38;
    ctx.fillStyle = '#201836';
    ctx.fillRect(12, y - 16, 136, 28);
    ctx.fillStyle = '#f2ede4';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(name, 18, y + 3);
    ctx.fillStyle = col;
    ctx.font = '900 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${price}`, 142, y + 4);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStripedAwningTex(colA: string, colB: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? colA : colB;
    ctx.fillRect(x, 0, 16, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/**
 * Builds high-detail world-space expansions for the 3 enlarged 1.5x cardinal districts:
 * 1) VICE PORT WEST & EAST APRONS (x: -89..-68 & +78..+99, z: 87..147)
 *    - Customs Gatehouse, Weighbridge, Corrugated Container Stacks, 18-Wheeler Trailer, Forklift & Floodlight
 *    - "VICE COAST GUARD STATION 06" Outpost, Bobbing Patrol Cutter & Fishery Ice-House
 * 2) WEST DISTRICT NORTH & SOUTH STRIPS (x: -145..-87, z: -87..-66 & +66..+87)
 *    - "VICE GAS '86" 80s Retro Gas Station (cantilevered neon canopy, 4 pumps, price totem, 24H Mini-Mart)
 *    - "PLAZA CALLE OCHO" North Cuban Corner Building, Striped Night-Market Stalls & String Lights
 * 3) NORTH POINT & NORTHWEST COAST (x: -145..-42, z: -157..-105)
 *    - "SUNSET DRIVE-IN '86" 80s Open-Air Cinema (24m animated Synthwave movie screen, speaker posts, parked cars, projector booth + light beam)
 *    - "VICE YACHT CLUB" Waterfront Pavilion & 2 Extra Illuminated Wooden Marina Piers with bobbing Cabin Cruisers
 * Zero extra PointLights added -> constant shader count & silky-smooth FPS!
 */
export function buildDistrictExpansions(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  roadMat: THREE.Material,
  sidewalkMat: THREE.Material,
  palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[],
): DistrictExpansionsHandle {
  const { addBox, addVisual } = createWorldHelpers(scene, colliders, worldMeshes, 'expansion');

  // Shared PBR materials
  const steelDarkMat = new THREE.MeshStandardMaterial({ color: '#242732', roughness: 0.44, metalness: 0.72 });
  const steelGalvMat = new THREE.MeshStandardMaterial({ color: '#8f98a6', roughness: 0.35, metalness: 0.78 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e6eef6', roughness: 0.16, metalness: 0.9 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#4c4f5a', roughness: 0.75 });
  const stuccoCreamMat = new THREE.MeshStandardMaterial({ color: '#f3e5d2', roughness: 0.54 });
  const stuccoOchreMat = new THREE.MeshStandardMaterial({ color: '#e6b87a', roughness: 0.56 });
  const stuccoMintMat = new THREE.MeshStandardMaterial({ color: '#9cd8ce', roughness: 0.48 });
  const cgOrangeMat = new THREE.MeshStandardMaterial({ color: '#e85224', roughness: 0.36, metalness: 0.2 });
  const cgWhiteMat = new THREE.MeshStandardMaterial({ color: '#f4f6fa', roughness: 0.38 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#7a5638', roughness: 0.78 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#4d3523', roughness: 0.85 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: createHazardTexture(6), roughness: 0.46 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#6ec4d8',
    roughness: 0.08,
    metalness: 0.35,
    transparent: true,
    opacity: 0.38,
  });
  const yellowMat = new THREE.MeshStandardMaterial({ color: '#f2be34', roughness: 0.4 });
  const redMat = new THREE.MeshStandardMaterial({ color: '#d9323a', roughness: 0.38 });
  const tealMat = new THREE.MeshStandardMaterial({ color: '#27b8b0', roughness: 0.38 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: '#ff4fa3', roughness: 0.34 });

  // Thin neon & bulb accents (> 1.0 bloom strictly on small bulbs/tubes!)
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.2 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.2 });
  const amberNeon = new THREE.MeshStandardMaterial({ color: '#ff9f43', emissive: '#ff9f43', emissiveIntensity: 2.2 });
  const floodBulbMat = new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffbe66', emissiveIntensity: 3.1 });
  const redBulbMat = new THREE.MeshStandardMaterial({ color: '#ff334b', emissive: '#ff1f3a', emissiveIntensity: 3.1 });
  const blueBulbMat = new THREE.MeshStandardMaterial({ color: '#38a6ff', emissive: '#2490ff', emissiveIntensity: 3.0 });
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 8);

  // ===========================================================================
  // 1) VICE PORT WEST & EAST EXPANSIONS (x: -89..-68 & +78..+99, z: 87..147)
  // ===========================================================================
  // Waterfront hazard strips & mooring bollards along both new 21m quay edges (z = 146.1)
  for (const hx of [-78.5, 88.5]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(21.0, 0.9), hazardMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(hx, 0.015, 146.1);
    scene.add(strip);
    for (const bx of [hx - 7.5, hx, hx + 7.5]) {
      addVisual(new THREE.CylinderGeometry(0.18, 0.24, 0.65, 8), steelDarkMat, bx, 0.32, 146.2);
    }
  }

  // 1A) WEST PORT CUSTOMS GATEHOUSE, CONTAINER STACKS, 18-WHEELER TRAILER & FORKLIFT (x = -89..-68)
  addBox(4.8, 3.2, 4.2, -83.5, 1.6, 94.5, stuccoCreamMat, true, 'port-exp');
  addVisual(new THREE.BoxGeometry(5.2, 0.25, 4.6), steelDarkMat, -83.5, 3.3, 94.5);
  addVisual(new THREE.BoxGeometry(4.88, 1.1, 2.8), glassMat, -83.5, 1.9, 94.5);
  const custSignTex = createNeonSignTexture('VICE PORT · CUSTOMS', '#ff9f43');
  const custSignMat = new THREE.MeshStandardMaterial({
    map: custSignTex,
    emissive: '#ffffff',
    emissiveMap: custSignTex,
    emissiveIntensity: 1.5,
  });
  const custSign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.82, 0.14), custSignMat);
  custSign.position.set(-83.5, 3.9, 92.3);
  custSign.rotation.y = Math.PI;
  scene.add(custSign);
  // Weighbridge pad beside customs
  const weighPad = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 11.0), hazardMat);
  weighPad.rotation.x = -Math.PI / 2;
  weighPad.position.set(-76.5, 0.016, 96.5);
  scene.add(weighPad);

  // Stacked Corrugated Shipping Containers in West Port Yard
  const cMats = [
    new THREE.MeshStandardMaterial({ map: createCorrugatedContainerTex('#b8342e', 'VICE CARGO'), roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: createCorrugatedContainerTex('#26648e', 'MIAMI LINE'), roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: createCorrugatedContainerTex('#2b7a5c', 'CARIBE SEA'), roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: createCorrugatedContainerTex('#c8822a', 'PALM FREIGHT'), roughness: 0.6 }),
  ];
  const containerStacks: [number, number, number, number][] = [
    [-84.5, 1.3, 114.0, 0],
    [-84.5, 3.9, 114.0, 1],
    [-80.8, 1.3, 114.0, 2],
    [-84.5, 1.3, 128.0, 3],
    [-84.5, 3.9, 128.0, 0],
    [-84.5, 6.5, 128.0, 1],
    [-74.5, 1.3, 124.0, 2],
    [-74.5, 3.9, 124.0, 3],
  ];
  for (const [cx, cy, cz, mIdx] of containerStacks) {
    addBox(2.8, 2.6, 8.6, cx, cy, cz, cMats[mIdx], true, 'port-exp');
  }

  // Parked 18-Wheeler Semi-Trailer & Yellow Port Forklift
  addBox(2.5, 2.8, 10.5, -74.5, 2.25, 108.0, cgWhiteMat, true, 'port-exp');
  addVisual(new THREE.BoxGeometry(2.3, 0.5, 10.2), steelDarkMat, -74.5, 0.7, 108.0);
  for (const wz of [104.0, 111.5, 112.8]) {
    for (const wx of [-75.7, -73.3]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.28, 10), steelDarkMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.45, wz);
      scene.add(wh);
    }
  }
  // Yellow Forklift at (-79.0, 136.5)
  addBox(1.5, 1.4, 2.3, -79.0, 0.9, 136.5, yellowMat, true, 'port-exp');
  addVisual(new THREE.BoxGeometry(0.14, 2.8, 0.14), steelDarkMat, -79.5, 1.5, 135.1);
  addVisual(new THREE.BoxGeometry(0.14, 2.8, 0.14), steelDarkMat, -78.5, 1.5, 135.1);

  // West Port High-Mast Floodlight Tower (-86.5, 143.5)
  addVisual(new THREE.CylinderGeometry(0.16, 0.26, 13.5, 8), steelGalvMat, -86.5, 6.75, 143.5, true);
  addVisual(new THREE.BoxGeometry(2.4, 0.5, 0.4), steelDarkMat, -86.5, 13.6, 143.5);
  addVisual(new THREE.BoxGeometry(2.0, 0.34, 0.16), floodBulbMat, -86.5, 13.6, 143.25);

  // 1B) EAST PORT "VICE COAST GUARD · STATION 06", BOBBING PATROL CUTTER & FISHERY SHED (x = +78..+99)
  addBox(10.5, 4.6, 12.0, 89.5, 2.3, 104.0, cgWhiteMat, true, 'port-exp');
  addVisual(new THREE.BoxGeometry(10.7, 0.65, 12.2), cgOrangeMat, 89.5, 3.8, 104.0);
  addVisual(new THREE.BoxGeometry(10.9, 0.3, 12.4), steelDarkMat, 89.5, 4.75, 104.0);
  addVisual(new THREE.BoxGeometry(0.14, 1.4, 7.2), glassMat, 84.2, 2.4, 104.0);
  // Roof Radar Mast & Coast Guard Neon Sign
  addVisual(new THREE.CylinderGeometry(0.12, 0.18, 4.2, 8), steelGalvMat, 89.5, 6.9, 104.0);
  addVisual(bulbGeo, redBulbMat, 89.5, 9.1, 104.0);
  const cgSignTex = createNeonSignTexture('VICE COAST GUARD · 06', '#ff9f43');
  const cgSignMat = new THREE.MeshStandardMaterial({
    map: cgSignTex,
    emissive: '#ffffff',
    emissiveMap: cgSignTex,
    emissiveIntensity: 1.6,
  });
  const cgSign = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 7.6), cgSignMat);
  cgSign.position.set(84.1, 5.4, 104.0);
  scene.add(cgSign);

  // Fishery Ice-House Shed at (89.0, 132.0)
  addBox(8.5, 3.6, 9.0, 89.0, 1.8, 132.0, stuccoMintMat, true, 'port-exp');
  addVisual(new THREE.BoxGeometry(9.2, 0.25, 9.6), cgOrangeMat, 89.0, 3.7, 132.0);
  for (const cz of [125.5, 126.8, 138.2]) {
    addBox(1.2, 0.85, 1.2, 83.2, 0.42, cz, woodMat, true, 'port-exp');
  }
  palmPositions.push({ x: 96.5, y: 0.02, z: 93.0, rot: 0.4, scale: 0.96 });
  palmPositions.push({ x: 96.5, y: 0.02, z: 118.0, rot: 1.9, scale: 1.02 });

  // Bobbing White/Orange Coast Guard Patrol Cutter moored off the East Quay (x = 103.5, z = 124.0)
  const cutterGroup = new THREE.Group();
  cutterGroup.position.set(103.5, -0.05, 124.0);
  cutterGroup.userData.dynamic = true;
  const cHull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.45, 15.0), cgWhiteMat);
  cHull.position.y = 0.55;
  cHull.castShadow = true;
  cutterGroup.add(cHull);
  const cBow = new THREE.Mesh(new THREE.ConeGeometry(2.15, 4.4, 4), cgWhiteMat);
  cBow.rotation.x = Math.PI / 2;
  cBow.rotation.y = Math.PI / 4;
  cBow.position.set(0, 0.58, 9.6);
  cutterGroup.add(cBow);
  const cStripe = new THREE.Mesh(new THREE.BoxGeometry(4.28, 0.42, 4.2), cgOrangeMat);
  cStripe.position.set(0, 0.72, 4.5);
  cStripe.rotation.x = -0.22;
  cutterGroup.add(cStripe);
  const cCabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 5.4), cgWhiteMat);
  cCabin.position.set(0, 2.25, -0.5);
  cutterGroup.add(cCabin);
  const cWin = new THREE.Mesh(new THREE.BoxGeometry(3.28, 0.75, 2.2), glassMat);
  cWin.position.set(0, 2.65, 1.2);
  cutterGroup.add(cWin);
  const cMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8), steelGalvMat);
  cMast.position.set(0, 4.8, -0.8);
  cutterGroup.add(cMast);
  const cStrobe = new THREE.Mesh(bulbGeo, blueBulbMat);
  cStrobe.position.set(0, 6.45, -0.8);
  cutterGroup.add(cStrobe);
  scene.add(cutterGroup);

  // ===========================================================================
  // 2) WEST DISTRICT SOUTH & NORTH STRIPS (x: -145..-87, z: +66..+87 & -87..-66)
  // ===========================================================================
  // 2A) SOUTH STRIP: "VICE GAS '86" 80s RETRO GAS STATION & 24H MINI-MART (z = +74.5)
  const gasX = -114.5;
  const gasZ = 75.0;
  // Wide cantilevered 80s neon canopy (16m x 9m, clearance 4.6m -> all trucks/cars drive right through!)
  addVisual(new THREE.BoxGeometry(16.5, 0.85, 9.2), stuccoCreamMat, gasX, 4.85, gasZ, true);
  addVisual(new THREE.BoxGeometry(16.7, 0.16, 9.4), pinkNeon, gasX, 5.2, gasZ);
  addVisual(new THREE.BoxGeometry(16.7, 0.14, 9.4), cyanNeon, gasX, 4.5, gasZ);
  // 2 Canopy Support Columns + 2 Fuel Pump Islands (x = -118.5 & -110.5)
  for (const ix of [-118.5, -110.5]) {
    addBox(0.55, 4.6, 0.55, ix, 2.3, gasZ, chromeMat, true, 'west-exp');
    addBox(1.2, 0.22, 6.2, ix, 0.11, gasZ, concreteMat, false, 'west-exp');
    for (const pz of [gasZ - 1.8, gasZ + 1.8]) {
      addBox(0.68, 1.55, 0.58, ix, 0.98, pz, redMat, true, 'west-exp');
      addVisual(new THREE.BoxGeometry(0.72, 0.42, 0.44), cyanNeon, ix, 1.38, pz);
    }
  }
  // Glowing Canopy Header Sign "VICE GAS '86"
  const gasSignTex = createNeonSignTexture("VICE GAS '86 · 24H", '#36f1e6');
  const gasSignMat = new THREE.MeshStandardMaterial({
    map: gasSignTex,
    emissive: '#ffffff',
    emissiveMap: gasSignTex,
    emissiveIntensity: 1.75,
  });
  const gasSignN = new THREE.Mesh(new THREE.BoxGeometry(9.2, 1.15, 0.18), gasSignMat);
  gasSignN.position.set(gasX, 4.95, gasZ - 4.72);
  gasSignN.rotation.y = Math.PI;
  scene.add(gasSignN);
  const gasSignS = gasSignN.clone();
  gasSignS.position.z = gasZ + 4.72;
  gasSignS.rotation.y = 0;
  scene.add(gasSignS);

  // Tall Retro Illuminated Gas Price Totem Sign at (-126.0, 79.0)
  addBox(0.32, 6.8, 0.32, -126.0, 3.4, 79.0, steelDarkMat, true, 'west-exp');
  const totemTex = createGasPriceTotemTexture();
  const totemMat = new THREE.MeshStandardMaterial({
    map: totemTex,
    emissive: '#ffffff',
    emissiveMap: totemTex,
    emissiveIntensity: 0.95,
  });
  addVisual(new THREE.BoxGeometry(2.1, 3.4, 0.36), totemMat, -126.0, 5.2, 79.0);

  // 24H Convenience Mini-Mart right beside the pumps (x = -96.5, z = 75.5)
  addBox(10.5, 4.2, 8.6, -96.5, 2.1, 75.5, stuccoCreamMat, true, 'west-exp');
  addVisual(new THREE.BoxGeometry(10.9, 0.28, 9.0), tealMat, -96.5, 4.3, 75.5);
  addVisual(new THREE.BoxGeometry(11.0, 0.12, 9.1), amberNeon, -96.5, 4.5, 75.5);
  addVisual(new THREE.BoxGeometry(0.14, 2.1, 5.4), glassMat, -101.8, 1.45, 75.5);
  const martSignTex = createNeonSignTexture('24H MART · ICE · COFFEE', '#ff9f43');
  const martSignMat = new THREE.MeshStandardMaterial({
    map: martSignTex,
    emissive: '#ffffff',
    emissiveMap: martSignTex,
    emissiveIntensity: 1.5,
  });
  const martSign = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 6.8), martSignMat);
  martSign.position.set(-101.85, 3.45, 75.5);
  scene.add(martSign);
  // Ice chest & vintage soda vending machine outside Mini-Mart
  addBox(0.95, 1.05, 1.8, -102.3, 0.52, 72.2, cgWhiteMat, true, 'west-exp');
  addBox(0.85, 1.9, 1.0, -102.3, 0.95, 78.6, redMat, true, 'west-exp');
  addVisual(new THREE.BoxGeometry(0.08, 1.1, 0.78), pinkNeon, -102.75, 1.25, 78.6);

  // 2B) NORTH STRIP: "PLAZA CALLE OCHO" CUBAN CORNER & NIGHT MARKET (z = -75.5)
  addBox(12.0, 7.2, 9.4, -97.0, 3.6, -75.5, stuccoOchreMat, true, 'west-exp');
  addVisual(new THREE.BoxGeometry(12.4, 0.35, 9.8), stuccoCreamMat, -97.0, 7.3, -75.5);
  addVisual(new THREE.BoxGeometry(12.5, 0.14, 0.14), pinkNeon, -97.0, 4.2, -70.75);
  const havSignTex = createNeonSignTexture('CAFÉ HAVANA · CIGARS', '#ff4fa3');
  const havSignMat = new THREE.MeshStandardMaterial({
    map: havSignTex,
    emissive: '#ffffff',
    emissiveMap: havSignTex,
    emissiveIntensity: 1.6,
  });
  const havSign = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.05, 0.18), havSignMat);
  havSign.position.set(-97.0, 5.4, -70.72);
  scene.add(havSign);

  // 3 Striped Cuban Night-Market Stalls along (-118 .. -108, z = -75.5)
  const awningA = new THREE.MeshStandardMaterial({ map: createStripedAwningTex('#ff4fa3', '#fff5e6'), roughness: 0.65 });
  const awningB = new THREE.MeshStandardMaterial({ map: createStripedAwningTex('#27b8b0', '#fff5e6'), roughness: 0.65 });
  for (let i = 0; i < 3; i++) {
    const sx = -121.0 + i * 5.2;
    addBox(3.4, 0.95, 1.6, sx, 0.65, -75.5, woodMat, true, 'west-exp');
    for (const px of [-1.6, 1.6]) {
      for (const pz of [-0.7, 0.7]) {
        addVisual(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), darkWoodMat, sx + px, 1.45, -75.5 + pz);
      }
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 2.3), i % 2 === 0 ? awningA : awningB);
    roof.position.set(sx, 2.75, -75.5);
    roof.rotation.x = 0.18;
    scene.add(roof);
    addVisual(bulbGeo, amberNeon, sx, 2.55, -74.6);
  }

  // ===========================================================================
  // 3) NORTH POINT & NORTHWEST EXPANSIONS: "SUNSET DRIVE-IN '86" & "VICE YACHT CLUB"
  // ===========================================================================
  // 3A) "SUNSET DRIVE-IN '86" OPEN-AIR 80s CINEMA (x = -144..-74, z = -152..-106)
  // Reclaimed asphalt lot over the NW coastal strip
  const driveInSlab = new THREE.Mesh(new THREE.BoxGeometry(70.0, 1.4, 46.0), roadMat);
  driveInSlab.position.set(-109.0, -0.7, -129.0);
  driveInSlab.receiveShadow = true;
  scene.add(driveInSlab);
  worldMeshes.push(driveInSlab);

  // Giant 24m x 12m Drive-In Cinema Screen Tower at (-109, -147) facing South (+Z)
  const scrX = -109.0;
  const scrZ = -147.0;
  for (const px of [-10.2, -3.4, 3.4, 10.2]) {
    addBox(0.65, 15.5, 0.65, scrX + px, 7.75, scrZ - 0.8, steelDarkMat, true, 'north-exp');
  }
  addBox(24.6, 12.6, 0.7, scrX, 9.8, scrZ, steelDarkMat, true, 'north-exp');
  // Art-Deco neon frame around screen
  addVisual(new THREE.BoxGeometry(25.0, 0.22, 0.22), pinkNeon, scrX, 16.2, scrZ + 0.4);
  addVisual(new THREE.BoxGeometry(25.0, 0.22, 0.22), cyanNeon, scrX, 3.4, scrZ + 0.4);
  const diSignTex = createNeonSignTexture("SUNSET DRIVE-IN · '86", '#ff4fa3');
  const diSignMat = new THREE.MeshStandardMaterial({
    map: diSignTex,
    emissive: '#ffffff',
    emissiveMap: diSignTex,
    emissiveIntensity: 1.85,
  });
  const diSign = new THREE.Mesh(new THREE.BoxGeometry(14.5, 1.8, 0.25), diSignMat);
  diSign.position.set(scrX, 17.4, scrZ + 0.35);
  scene.add(diSign);

  // Live Animated 80s Synthwave Action Movie Canvas Screen (256x128 updated at ~12 Hz!)
  const movieCanvas = document.createElement('canvas');
  movieCanvas.width = 256;
  movieCanvas.height = 128;
  const movieCtx = movieCanvas.getContext('2d')!;
  const movieTex = new THREE.CanvasTexture(movieCanvas);
  movieTex.colorSpace = THREE.SRGBColorSpace;
  const movieMat = new THREE.MeshStandardMaterial({
    map: movieTex,
    emissive: '#ffffff',
    emissiveMap: movieTex,
    emissiveIntensity: 0.92,
    roughness: 0.4,
  });
  const movieScreen = new THREE.Mesh(new THREE.PlaneGeometry(23.2, 11.4), movieMat);
  movieScreen.position.set(scrX, 9.8, scrZ + 0.4);
  scene.add(movieScreen);

  // 12 Retro Chrome Drive-In Speaker Posts arranged in 2 rows
  for (const rz of [-133.0, -124.0]) {
    for (let i = 0; i < 6; i++) {
      const sx = -126.5 + i * 7.0;
      addVisual(new THREE.CylinderGeometry(0.05, 0.06, 1.35, 6), chromeMat, sx, 0.68, rz);
      addVisual(new THREE.BoxGeometry(0.28, 0.24, 0.14), steelGalvMat, sx, 1.32, rz);
    }
  }

  // Projection & Popcorn Concession Booth at (-109, -112) + Volumetric Projector Light Cone!
  addBox(10.0, 4.2, 6.2, scrX, 2.1, -112.0, stuccoCreamMat, true, 'north-exp');
  addVisual(new THREE.BoxGeometry(10.4, 0.24, 6.6), pinkMat, scrX, 4.3, -112.0);
  const snackSignTex = createNeonSignTexture('SNACKS · POPCORN · SODA', '#36f1e6');
  const snackSignMat = new THREE.MeshStandardMaterial({
    map: snackSignTex,
    emissive: '#ffffff',
    emissiveMap: snackSignTex,
    emissiveIntensity: 1.5,
  });
  const snackSign = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.95, 0.16), snackSignMat);
  snackSign.position.set(scrX, 3.6, -108.85);
  scene.add(snackSign);

  // Volumetric blue-white movie projector beam cone from booth (-109, 3.8, -115) -> screen (-109, 9.8, -146.5)
  const projBeamGeo = new THREE.ConeGeometry(7.5, 32.0, 14, 1, true);
  projBeamGeo.translate(0, -16.0, 0);
  projBeamGeo.rotateX(-Math.PI / 2);
  const projBeam = new THREE.Mesh(
    projBeamGeo,
    new THREE.MeshBasicMaterial({
      color: '#bde9ff',
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  projBeam.position.set(scrX, 3.9, -115.2);
  projBeam.rotation.x = 0.18;
  scene.add(projBeam);

  // 3B) "VICE YACHT CLUB" PAVILION & 2 EXTRA ILLUMINATED MARINA PIERS (x = -70..-44, z = -145..-110)
  // Waterfront Yacht Club Pavilion at (-57, -113)
  addBox(14.0, 0.35, 9.5, -57.0, 0.18, -113.0, sidewalkMat, false, 'north-exp');
  addBox(11.0, 4.4, 6.8, -57.0, 2.4, -112.5, cgWhiteMat, true, 'north-exp');
  addVisual(new THREE.BoxGeometry(12.2, 0.28, 8.2), tealMat, -57.0, 4.75, -112.5);
  addVisual(new THREE.BoxGeometry(12.4, 0.12, 8.4), cyanNeon, -57.0, 4.92, -112.5);
  const ycSignTex = createNeonSignTexture("VICE YACHT CLUB · '86", '#36f1e6');
  const ycSignMat = new THREE.MeshStandardMaterial({
    map: ycSignTex,
    emissive: '#ffffff',
    emissiveMap: ycSignTex,
    emissiveIntensity: 1.65,
  });
  const ycSign = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.1, 0.18), ycSignMat);
  ycSign.position.set(-57.0, 5.55, -108.9);
  scene.add(ycSign);
  palmPositions.push({ x: -65.5, y: 0.18, z: -112.0, rot: 0.6, scale: 1.0 });
  palmPositions.push({ x: -48.5, y: 0.18, z: -112.0, rot: 2.2, scale: 0.96 });

  // 2 Extra Illuminated Wooden Marina Piers (x = -64 and x = -50, z = -145..-119) + 2 Bobbing Cabin Cruisers
  const extraYachts: { group: THREE.Group; phase: number }[] = [];
  for (const [pierX, yachtX, ph] of [
    [-64.0, -68.0, 0.4],
    [-50.0, -54.0, 2.1],
  ]) {
    addBox(3.4, 0.24, 26.0, pierX, 0.45, -132.0, woodMat, true, 'north-exp');
    for (let pz = -144; pz <= -120; pz += 6) {
      addVisual(new THREE.CylinderGeometry(0.16, 0.18, 6.8, 8), darkWoodMat, pierX - 1.5, -2.8, pz);
      addVisual(new THREE.CylinderGeometry(0.16, 0.18, 6.8, 8), darkWoodMat, pierX + 1.5, -2.8, pz);
      if (pz % 12 === 0) {
        addVisual(new THREE.BoxGeometry(0.14, 1.4, 0.14), darkWoodMat, pierX, 1.25, pz);
        addVisual(bulbGeo, amberNeon, pierX, 2.02, pz);
      }
    }
    // Moored 11m 80s Luxury Cabin Cruiser bobbing gently beside the pier
    const yg = new THREE.Group();
    yg.position.set(yachtX, -0.05, -134.0);
    yg.userData.dynamic = true;
    const yHull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 10.2), cgWhiteMat);
    yHull.position.y = 0.42;
    yHull.castShadow = true;
    yg.add(yHull);
    const yTrim = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.18, 9.6), ph < 1 ? pinkMat : tealMat);
    yTrim.position.y = 0.65;
    yg.add(yTrim);
    const yCab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 4.2), cgWhiteMat);
    yCab.position.set(0, 1.5, -0.6);
    yg.add(yCab);
    const yGlass = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.52, 1.6), glassMat);
    yGlass.position.set(0, 1.65, 1.1);
    yg.add(yGlass);
    scene.add(yg);
    extraYachts.push({ group: yg, phase: ph });
  }

  let lastMovieDraw = -1;
  const drawSynthwaveMovieFrame = (t: number) => {
    // 80s Sunset gradient sky
    const g = movieCtx.createLinearGradient(0, 0, 0, 74);
    g.addColorStop(0, '#14082e');
    g.addColorStop(0.55, '#8c226b');
    g.addColorStop(1, '#ff7b47');
    movieCtx.fillStyle = g;
    movieCtx.fillRect(0, 0, 256, 74);

    // Striped synthwave sun
    movieCtx.fillStyle = '#ffd15c';
    movieCtx.beginPath();
    movieCtx.arc(128, 56, 26, 0, Math.PI * 2);
    movieCtx.fill();
    movieCtx.fillStyle = '#8c226b';
    for (let sy = 50; sy < 80; sy += 6) {
      movieCtx.fillRect(98, sy, 60, 2);
    }

    // Dark neon grid floor scrolling forward
    movieCtx.fillStyle = '#0c081c';
    movieCtx.fillRect(0, 74, 256, 54);
    movieCtx.strokeStyle = '#ff4fa3';
    movieCtx.lineWidth = 1.5;
    const scroll = (t * 28) % 14;
    for (let y = 76; y < 128; y += 10) {
      const yy = 74 + ((y - 74 + scroll) % 54);
      movieCtx.beginPath();
      movieCtx.moveTo(0, yy);
      movieCtx.lineTo(256, yy);
      movieCtx.stroke();
    }
    movieCtx.strokeStyle = '#36f1e6';
    for (let x = -120; x <= 380; x += 36) {
      movieCtx.beginPath();
      movieCtx.moveTo(128, 74);
      movieCtx.lineTo(x, 128);
      movieCtx.stroke();
    }

    // Silhouette 80s sports car weaving gently on the neon highway
    const carX = 128 + Math.sin(t * 1.4) * 32;
    movieCtx.fillStyle = '#181428';
    movieCtx.fillRect(carX - 24, 94, 48, 16);
    movieCtx.fillRect(carX - 16, 85, 32, 10);
    // Glowing red taillights
    movieCtx.fillStyle = '#ff2a4b';
    movieCtx.fillRect(carX - 22, 99, 12, 4);
    movieCtx.fillRect(carX + 10, 99, 12, 4);
    movieTex.needsUpdate = true;
  };
  drawSynthwaveMovieFrame(0);

  return {
    update: (elapsed: number, playerPos?: THREE.Vector3) => {
      // Gently bob East Port Coast Guard Patrol Cutter
      if (!playerPos || playerPos.z > 40) {
        cutterGroup.position.y = -0.05 + Math.sin(elapsed * 1.5) * 0.12;
        cutterGroup.rotation.z = Math.sin(elapsed * 1.1) * 0.04;
      }

      // Gently bob extra Vice Marina Luxury Cabin Cruisers
      if (!playerPos || playerPos.z < -40) {
        for (let i = 0; i < extraYachts.length; i++) {
          const ey = extraYachts[i];
          ey.group.position.y = -0.05 + Math.sin(elapsed * 1.6 + ey.phase) * 0.1;
          ey.group.rotation.z = Math.sin(elapsed * 1.2 + ey.phase) * 0.045;
        }
      }

      // Update Sunset Drive-In Cinema Screen (~10 Hz when player is in North/West half)
      if ((!playerPos || (playerPos.z < -40 && playerPos.x < 10)) && elapsed - lastMovieDraw > 0.1) {
        lastMovieDraw = elapsed;
        drawSynthwaveMovieFrame(elapsed);
      }
    },
  };
}
