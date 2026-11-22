import * as THREE from 'three';
import type { AABB } from '../types';
import { createWorldHelpers } from './BuildHelpers';
import { createNeonSignTexture } from './Textures';

export interface ViceAirfieldHandle {
  getGroundHeight: (x: number, z: number) => number | null;
  isInsideInterior: (pos: THREE.Vector3) => boolean;
  isNearAirfieldLoot: (pos: THREE.Vector3) => boolean;
  takeAirfieldLoot: () => void;
  isNearAirfieldCafe: (pos: THREE.Vector3) => boolean;
  update: (elapsed: number, playerPos?: THREE.Vector3) => void;
}

// -----------------------------------------------------------------------------
// Procedural Aviation & 80s Airport Canvas Textures (Zero External Assets!)
// -----------------------------------------------------------------------------

function createTarmacTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#33353e';
  ctx.fillRect(0, 0, 256, 256);

  // Fine asphalt / aggregate grain
  for (let i = 0; i < 650; i++) {
    const x = (i * 67) % 256;
    const y = (i * 131) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y, 2 + (i % 4), 2 + (i % 4));
  }

  // Concrete apron expansion joints
  ctx.strokeStyle = 'rgba(14, 15, 22, 0.42)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 256; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 11);
  return tex;
}

function createRunwayTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const ctx = c.getContext('2d')!;

  // Dark grooved runway asphalt
  ctx.fillStyle = '#20222a';
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle asphalt grain & rain grooves
  for (let i = 0; i < 1200; i++) {
    const x = (i * 89) % 512;
    const y = (i * 193) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 3, 5);
  }

  // Outer runway side stripes (white) + yellow shoulder chevrons
  ctx.fillStyle = '#ebe6dc';
  ctx.fillRect(22, 16, 10, 992);
  ctx.fillRect(480, 16, 10, 992);

  // Piano-key threshold bars (both ends)
  const drawThreshold = (yStart: number) => {
    ctx.fillStyle = '#f2ede4';
    for (let i = 0; i < 8; i++) {
      const x = 56 + i * 52;
      if (i === 3 || i === 4) {
        ctx.fillRect(x + (i === 3 ? -6 : 6), yStart, 28, 72);
      } else {
        ctx.fillRect(x, yStart, 28, 72);
      }
    }
  };
  drawThreshold(24);
  drawThreshold(1024 - 96);

  // Runway designator numbers: "18" at North end (top), "36" at South end (bottom, flipped)
  ctx.fillStyle = '#f2ede4';
  ctx.font = '900 84px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('18', 256, 152);

  ctx.save();
  ctx.translate(256, 1024 - 152);
  ctx.rotate(Math.PI);
  ctx.fillText('36', 0, 0);
  ctx.restore();

  // Aiming point solid white blocks
  ctx.fillStyle = '#ece7de';
  for (const ay of [235, 1024 - 305]) {
    ctx.fillRect(102, ay, 48, 70);
    ctx.fillRect(362, ay, 48, 70);
  }

  // Dashed runway centerline
  ctx.fillStyle = '#f0ebe2';
  for (let y = 215; y < 810; y += 72) {
    ctx.fillRect(249, y, 14, 42);
  }

  // Realistic dark rubber touchdown skid streaks in both touchdown zones
  for (const ty of [220, 740]) {
    const grad = ctx.createLinearGradient(0, ty - 45, 0, ty + 110);
    grad.addColorStop(0, 'rgba(8, 8, 12, 0)');
    grad.addColorStop(0.45, 'rgba(8, 8, 12, 0.52)');
    grad.addColorStop(1, 'rgba(8, 8, 12, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(178, ty - 45, 42, 155);
    ctx.fillRect(292, ty - 45, 42, 155);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createFlightBoardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0e1118';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#36f1e6';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 248);

  // Header bar
  ctx.fillStyle = '#182032';
  ctx.fillRect(8, 8, 496, 38);
  ctx.fillStyle = '#ff9f43';
  ctx.font = '900 18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('VICE INT\'L · DEPARTURES', 18, 33);
  ctx.fillStyle = '#36f1e6';
  ctx.textAlign = 'right';
  ctx.fillText('GATE 01-04', 492, 33);

  const rows: [string, string, string, string][] = [
    ['VC 804', 'NASSAU', '19:45', 'BOARDING'],
    ['VC 812', 'KEY WEST', '20:10', 'ON TIME'],
    ['VC 826', 'HAVANA', '20:35', 'ON TIME'],
    ['VC 840', 'MEDELLIN', '21:00', 'DELAYED'],
    ['VC 855', 'BOGOTA', '21:25', 'CARGO'],
    ['VC 886', 'LOS SANTOS', '22:00', 'ON TIME'],
  ];

  ctx.font = '700 16px monospace';
  rows.forEach(([flt, dest, time, status], idx) => {
    const y = 76 + idx * 30;
    // Split-flap tile backdrop
    ctx.fillStyle = '#161b26';
    ctx.fillRect(14, y - 18, 484, 24);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd15c';
    ctx.fillText(flt, 22, y);
    ctx.fillStyle = '#f2ede4';
    ctx.fillText(dest, 118, y);
    ctx.fillStyle = '#36f1e6';
    ctx.fillText(time, 294, y);
    ctx.textAlign = 'right';
    ctx.fillStyle =
      status === 'BOARDING'
        ? '#52f29c'
        : status === 'DELAYED'
          ? '#ff4fa3'
          : status === 'CARGO'
            ? '#ff9f43'
            : '#bfe8ff';
    ctx.fillText(status, 490, y);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCorrugatedHangarTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#6c7380';
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 3, 0, 2, 256);
  }
  // Subtle coastal weathering gradient near base
  const g = ctx.createLinearGradient(0, 180, 0, 256);
  g.addColorStop(0, 'rgba(35,28,24,0)');
  g.addColorStop(1, 'rgba(35,28,24,0.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 180, 256, 76);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function createTerrazzoFloorTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8dfd1';
  ctx.fillRect(0, 0, 256, 256);

  const flecks = ['#47b8b0', '#e07a9a', '#c9b292', '#ffffff', '#6d788c'];
  for (let i = 0; i < 480; i++) {
    ctx.fillStyle = flecks[i % flecks.length];
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 2 + (i % 3), 2 + ((i * 3) % 3));
  }
  ctx.strokeStyle = 'rgba(90,80,70,0.18)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 256; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  return tex;
}

function createHelipadTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#272a33';
  ctx.fillRect(0, 0, 256, 256);

  // Yellow landing ring
  ctx.strokeStyle = '#ffd15c';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();

  // Crisp "H"
  ctx.fillStyle = '#f5efe6';
  ctx.fillRect(82, 64, 22, 128);
  ctx.fillRect(152, 64, 22, 128);
  ctx.fillRect(82, 116, 92, 24);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHazardStripeTexture(repeatX = 16): THREE.CanvasTexture {
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

function createAvgasTankTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8e4dc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#d9323a';
  ctx.fillRect(0, 44, 256, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AVGAS 100LL · JET-A1', 128, 64);
  ctx.fillStyle = '#1d1e24';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('FLAMMABLE · NO SMOKING', 128, 102);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFenceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(185, 198, 212, 0.72)';
  ctx.lineWidth = 2;
  for (let i = -64; i <= 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 64, 0);
    ctx.lineTo(i, 64);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 2);
  return tex;
}

function createTaxiSignTexture(text: string, bgHex: string, fgHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 84);
  ctx.fillStyle = fgHex;
  ctx.font = '900 44px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSteelGrateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4f5764';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#7b8594';
  ctx.lineWidth = 3;
  for (let i = -128; i <= 256; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 128, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(18, 22, 28, 0.55)';
  ctx.lineWidth = 2;
  for (let p = 0; p < 128; p += 32) {
    ctx.strokeRect(p, 0, 32, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// -----------------------------------------------------------------------------
// Detailed Procedural 80s Aircraft Builders
// -----------------------------------------------------------------------------

function buildKingAirPropPlane(
  whiteMat: THREE.Material,
  pinkMat: THREE.Material,
  tealMat: THREE.Material,
  darkSteelMat: THREE.Material,
  glassMat: THREE.Material,
  redBulbMat: THREE.Material,
  greenBulbMat: THREE.Material,
): { group: THREE.Group; propellers: THREE.Group[] } {
  const g = new THREE.Group();
  const propellers: THREE.Group[] = [];

  // Fuselage main tube (runs along Z, nose at +Z)
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.78, 7.6, 16), whiteMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 1.55, 0.1);
  fuselage.castShadow = true;
  g.add(fuselage);

  // Aerodynamic nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.86, 2.2, 16), whiteMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.5, 5.0);
  nose.castShadow = true;
  g.add(nose);

  // Tapered tail cone
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.78, 2.8, 16), whiteMat);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 1.62, -5.1);
  tailCone.castShadow = true;
  g.add(tailCone);

  // 80s Miami Vice dual cheatline stripes along fuselage sides
  for (const sx of [-0.85, 0.85]) {
    const stripePink = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 7.2), pinkMat);
    stripePink.position.set(sx, 1.48, 0.2);
    g.add(stripePink);
    const stripeTeal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 7.0), tealMat);
    stripeTeal.position.set(sx, 1.32, 0.2);
    g.add(stripeTeal);
  }

  // Cockpit windshield & cabin oval windows
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.56, 1.35), glassMat);
  cockpit.position.set(0, 2.02, 3.15);
  cockpit.rotation.x = 0.28;
  g.add(cockpit);
  for (const wz of [1.5, 0.4, -0.7, -1.8]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.34, 0.48), glassMat);
    win.position.set(0, 1.78, wz);
    g.add(win);
  }

  // Main wings (13.4m span)
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.22, 2.1), whiteMat);
  wing.position.set(0, 1.22, 0.5);
  wing.castShadow = true;
  g.add(wing);

  // Wingtip stripes + red (port) / green (starboard) nav lights
  for (const side of [-1, 1]) {
    const tipStripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 2.12), tealMat);
    tipStripe.position.set(side * 6.35, 1.22, 0.5);
    g.add(tipStripe);
    const navBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      side === -1 ? greenBulbMat : redBulbMat,
    );
    navBulb.position.set(side * 6.72, 1.24, 0.7);
    g.add(navBulb);
  }

  // Swept vertical tailfin & T-tail horizontal stabilizer
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 1.85), whiteMat);
  tailFin.position.set(0, 3.0, -5.0);
  tailFin.rotation.x = -0.24;
  tailFin.castShadow = true;
  g.add(tailFin);

  const tailAccent = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 1.7), pinkMat);
  tailAccent.position.set(0, 3.7, -5.18);
  tailAccent.rotation.x = -0.24;
  g.add(tailAccent);

  const hStab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.95), whiteMat);
  hStab.position.set(0, 4.18, -5.45);
  hStab.castShadow = true;
  g.add(hStab);

  // Twin wing-mounted turboprop engine nacelles + spinning 3-blade propellers
  for (const side of [-1, 1]) {
    const nx = side * 2.75;
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 2.5, 12), whiteMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(nx, 1.32, 1.1);
    nacelle.castShadow = true;
    g.add(nacelle);

    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 10), darkSteelMat);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.set(nx, 1.32, 2.55);
    g.add(spinner);

    const propGroup = new THREE.Group();
    propGroup.position.set(nx, 1.32, 2.48);
    propGroup.userData.dynamic = true;
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.04), darkSteelMat);
      const ang = (b * Math.PI * 2) / 3;
      blade.position.set(Math.cos(ang) * 0.52, Math.sin(ang) * 0.52, 0);
      blade.rotation.z = ang + Math.PI / 2;
      propGroup.add(blade);
    }
    g.add(propGroup);
    propellers.push(propGroup);
  }

  // Tricycle landing gear struts & rubber tires
  const gearCoords: [number, number][] = [
    [0, 3.8],
    [-2.5, 0.2],
    [2.5, 0.2],
  ];
  for (const [gx, gz] of gearCoords) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), darkSteelMat);
    strut.position.set(gx, 0.65, gz);
    g.add(strut);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), darkSteelMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(gx, 0.32, gz);
    g.add(tire);
  }

  return { group: g, propellers };
}

function buildLearjetExecutive(
  whiteMat: THREE.Material,
  pinkMat: THREE.Material,
  tealMat: THREE.Material,
  darkSteelMat: THREE.Material,
  chromeMat: THREE.Material,
  glassMat: THREE.Material,
  redCarpetMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();

  // Sleek jet fuselage (nose at +Z)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.72, 8.8, 16), whiteMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 1.48, 0);
  body.castShadow = true;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.78, 2.7, 16), whiteMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.42, 5.75);
  nose.castShadow = true;
  g.add(nose);

  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.6, 16), whiteMat);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 1.56, -5.7);
  g.add(tailCone);

  // Cockpit wrap glass & jet windows
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 1.45), glassMat);
  cockpit.position.set(0, 1.9, 3.85);
  cockpit.rotation.x = 0.32;
  g.add(cockpit);
  for (const wz of [2.1, 1.0, -0.1, -1.2, -2.3]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.28, 0.44), glassMat);
    w.position.set(0, 1.66, wz);
    g.add(w);
  }

  // Swept-back jet wings + upturned winglets
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 1.75), whiteMat);
    wing.position.set(side * 3.1, 1.1, -0.35);
    wing.rotation.y = side * -0.28;
    wing.castShadow = true;
    g.add(wing);

    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.95), pinkMat);
    winglet.position.set(side * 5.75, 1.52, -1.15);
    winglet.rotation.z = side * -0.22;
    g.add(winglet);
  }

  // Twin rear-mounted turbofan nacelles
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 2.2, 12), chromeMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 1.18, 1.92, -3.55);
    pod.castShadow = true;
    g.add(pod);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), darkSteelMat);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(side * 1.18, 1.92, -2.45);
    g.add(intake);
  }

  // Swept T-tail
  const vFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.55, 1.8), whiteMat);
  vFin.position.set(0, 2.85, -5.1);
  vFin.rotation.x = -0.36;
  vFin.castShadow = true;
  g.add(vFin);

  const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 1.6), tealMat);
  finStripe.position.set(0, 3.55, -5.38);
  finStripe.rotation.x = -0.36;
  g.add(finStripe);

  const hTail = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.85), whiteMat);
  hTail.position.set(0, 3.92, -5.62);
  g.add(hTail);

  // Landing gear
  for (const [gx, gz] of [
    [0, 4.3],
    [-1.7, -0.6],
    [1.7, -0.6],
  ]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.05, 8), darkSteelMat);
    strut.position.set(gx, 0.62, gz);
    g.add(strut);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10), darkSteelMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(gx, 0.28, gz);
    g.add(tire);
  }

  // VIP Boarding Airstairs + Red Carpet rolled up to starboard cabin door
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 1.6), chromeMat);
  stairs.position.set(1.38, 0.58, 2.75);
  stairs.rotation.z = 0.42;
  g.add(stairs);

  const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.03, 1.1), redCarpetMat);
  carpet.position.set(2.9, 0.02, 2.75);
  g.add(carpet);

  return g;
}

/**
 * Builds "VICE INTERNATIONAL AIRFIELD" — High-Detail 80s Miami Mini-Airport in the Southwest (x = -124..-68, z = 66..138):
 * - Reclaimed coastal tarmac peninsula with seawall, chain-link perimeter fence & illuminated entrance gantry
 * - Grooved Runway 18/36 (66m long) with skidmarks, threshold piano-keys, instanced edge lights, PAPI & sequenced approach strobes
 * - Yellow Taxiway & secondary Airport Helipad (H)
 * - Walk-in 80s Art-Deco Terminal 1 (terrazzo floor, check-in desk, split-flap Departures board, lounge & Airport Café)
 * - Towering 22m ATC Control Tower with walkable spiral/switchback observation deck (riser <= 0.22m), rotating radar dish & green/white beacon
 * - Massive hollow drive-in/walk-in "HANGAR 06" with parked twin-engine King Air '86 (spinning props!) & $2,800 Smuggler Cargo Stash
 * - Parked Executive Business Jet ("MIAMI LEAR '86") with VIP red carpet, AVGAS 100LL Fuel Depot, Tanker Truck & Windsock
 * - 2 Airfield Stunt Ramps
 * Zero extra PointLights added -> constant shader count & silky-smooth FPS!
 */
export function buildViceAirfield(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  palmPositions: { x: number; y?: number; z: number; rot: number; scale: number }[],
): ViceAirfieldHandle {
  const { addBox, addVisual } = createWorldHelpers(scene, colliders, worldMeshes, 'airfield');

  // Shared PBR materials (large flat surfaces strictly emissiveIntensity <= 0.35!)
  const tarmacMat = new THREE.MeshStandardMaterial({ map: createTarmacTexture(), roughness: 0.62, metalness: 0.12 });
  const runwayMat = new THREE.MeshStandardMaterial({ map: createRunwayTexture(), roughness: 0.52, metalness: 0.14 });
  const seawallMat = new THREE.MeshStandardMaterial({ color: '#4c4e58', roughness: 0.78 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: createHazardStripeTexture(16), roughness: 0.45 });
  const taxiYellowMat = new THREE.MeshStandardMaterial({ color: '#e8b63a', roughness: 0.42 });
  const steelDarkMat = new THREE.MeshStandardMaterial({ color: '#222630', roughness: 0.42, metalness: 0.72 });
  const steelGalvMat = new THREE.MeshStandardMaterial({ color: '#8f98a6', roughness: 0.34, metalness: 0.78 });
  const steelGrateMat = new THREE.MeshStandardMaterial({
    map: createSteelGrateTexture(),
    roughness: 0.46,
    metalness: 0.68,
  });
  const safetyRailYellowMat = new THREE.MeshStandardMaterial({ color: '#e8b63a', roughness: 0.36, metalness: 0.25 });
  const floodBulbMat = new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: '#ffbe66', emissiveIntensity: 3.1 });
  const floodHazeMat = new THREE.MeshBasicMaterial({
    color: '#ffb45c',
    transparent: true,
    opacity: 0.055,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const radarScopeMat = new THREE.MeshStandardMaterial({ color: '#1b3d32', emissive: '#32e880', emissiveIntensity: 1.45 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e4ecf5', roughness: 0.16, metalness: 0.9 });
  const hangarWallMat = new THREE.MeshStandardMaterial({
    map: createCorrugatedHangarTexture(),
    roughness: 0.52,
    metalness: 0.48,
  });
  const stuccoCreamMat = new THREE.MeshStandardMaterial({ color: '#f3e7d6', roughness: 0.52 });
  const stuccoMintMat = new THREE.MeshStandardMaterial({ color: '#9cd8ce', roughness: 0.48 });
  const terrazzoMat = new THREE.MeshStandardMaterial({ map: createTerrazzoFloorTexture(), roughness: 0.24, metalness: 0.08 });
  const roofDarkMat = new THREE.MeshStandardMaterial({ color: '#343340', roughness: 0.74 });
  const glassTintMat = new THREE.MeshStandardMaterial({
    color: '#6ec4d8',
    roughness: 0.08,
    metalness: 0.35,
    transparent: true,
    opacity: 0.36,
  });
  const atcGlassMat = new THREE.MeshStandardMaterial({
    color: '#2c7e74',
    roughness: 0.08,
    metalness: 0.68,
    transparent: true,
    opacity: 0.65,
  });
  const aircraftWhiteMat = new THREE.MeshStandardMaterial({ color: '#f4f6fa', roughness: 0.24, metalness: 0.32 });
  const aircraftPinkMat = new THREE.MeshStandardMaterial({ color: '#ff4fa3', roughness: 0.28, metalness: 0.25 });
  const aircraftTealMat = new THREE.MeshStandardMaterial({ color: '#28c7bf', roughness: 0.28, metalness: 0.25 });
  const aircraftGlassMat = new THREE.MeshStandardMaterial({ color: '#111a2c', roughness: 0.08, metalness: 0.85 });
  const aviationRedMat = new THREE.MeshStandardMaterial({ color: '#d6323a', roughness: 0.42 });
  const aviationWhiteMat = new THREE.MeshStandardMaterial({ color: '#f5efe6', roughness: 0.46 });
  const redCarpetMat = new THREE.MeshStandardMaterial({ color: '#9e1b32', roughness: 0.82 });
  const crateWoodMat = new THREE.MeshStandardMaterial({ color: '#7d5634', roughness: 0.72 });
  const avgasTankMat = new THREE.MeshStandardMaterial({ map: createAvgasTankTexture(), roughness: 0.34, metalness: 0.35 });
  const fenceMat = new THREE.MeshStandardMaterial({
    map: createFenceTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.5,
    metalness: 0.6,
  });

  // Thin neon & aviation beacon materials (> 1.0 bloom strictly on thin bulbs/tubes!)
  const cyanNeon = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.2 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.2 });
  const rwyWhiteBulbMat = new THREE.MeshStandardMaterial({ color: '#fff8e2', emissive: '#ffe099', emissiveIntensity: 3.0 });
  const rwyGreenBulbMat = new THREE.MeshStandardMaterial({ color: '#52f29c', emissive: '#32e880', emissiveIntensity: 3.1 });
  const rwyRedBulbMat = new THREE.MeshStandardMaterial({ color: '#ff334b', emissive: '#ff1f3a', emissiveIntensity: 3.2 });
  const taxiBlueBulbMat = new THREE.MeshStandardMaterial({ color: '#38a6ff', emissive: '#2490ff', emissiveIntensity: 2.8 });
  const goldGlowMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', emissive: '#ffaa22', emissiveIntensity: 1.9 });

  // ===========================================================================
  // 1) RECLAIMED COASTAL AIRFIELD TARMAC PENINSULA (x = -125..-68, z = 66..138)
  // ===========================================================================
  const tarmacSlab = new THREE.Mesh(new THREE.BoxGeometry(57.5, 1.5, 72.5), tarmacMat);
  tarmacSlab.position.set(-96.25, -0.75, 102.25);
  tarmacSlab.receiveShadow = true;
  scene.add(tarmacSlab);
  worldMeshes.push(tarmacSlab);

  // Heavy coastal seawalls along South (z=138), West (x=-125), and Southeast jetty lip (x=-68, z=126..138)
  addVisual(new THREE.BoxGeometry(58, 1.6, 1.0), seawallMat, -96.25, -0.72, 138.2);
  addVisual(new THREE.BoxGeometry(1.0, 1.6, 72.5), seawallMat, -124.8, -0.72, 102.25);
  addVisual(new THREE.BoxGeometry(1.0, 1.6, 13.0), seawallMat, -67.8, -0.72, 132.0);

  // Yellow/Black hazard edge along South seawall
  const southHazard = new THREE.Mesh(new THREE.PlaneGeometry(56.5, 0.85), hazardMat);
  southHazard.rotation.x = -Math.PI / 2;
  southHazard.position.set(-96.25, 0.015, 137.4);
  scene.add(southHazard);

  // ===========================================================================
  // 2) RUNWAY 18 / 36 (x = -119..-105, z = 70..136) + TAXIWAY + PAPI + LIGHTS
  // ===========================================================================
  const rwyX = -112.0;
  const rwyZ = 103.0;
  const runwayMesh = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 66.0), runwayMat);
  runwayMesh.rotation.x = -Math.PI / 2;
  runwayMesh.position.set(rwyX, 0.018, rwyZ);
  runwayMesh.receiveShadow = true;
  scene.add(runwayMesh);
  worldMeshes.push(runwayMesh);

  // Yellow Taxiway centerline (parallel to runway at x = -100, with 3 cross-connectors to runway)
  const drawTaxiLine = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), taxiYellowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.016, z);
    scene.add(m);
  };
  drawTaxiLine(0.32, 58, -100.0, 102.0);
  drawTaxiLine(6.2, 0.32, -102.9, 76.0);
  drawTaxiLine(6.2, 0.32, -102.9, 103.0);
  drawTaxiLine(6.2, 0.32, -102.9, 129.0);
  // Connector into Hangar 06
  drawTaxiLine(12.5, 0.32, -93.8, 112.5);
  // Hold-short double dashed bars at x = -104.2
  for (const hz of [76.0, 103.0, 129.0]) {
    drawTaxiLine(0.24, 3.6, -104.1, hz);
    drawTaxiLine(0.24, 3.6, -103.6, hz);
  }

  // Instanced Runway Edge Lights (white), Threshold Lights (green/red) & Taxiway Lights (blue)
  const dummy = new THREE.Object3D();
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const stalkGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6);

  const whiteEdgeCoords: [number, number][] = [];
  for (let z = 74; z <= 132; z += 5.8) {
    whiteEdgeCoords.push([-119.4, z], [-104.6, z]);
  }
  const whiteBulbInst = new THREE.InstancedMesh(bulbGeo, rwyWhiteBulbMat, whiteEdgeCoords.length);
  const stalkInst = new THREE.InstancedMesh(stalkGeo, steelDarkMat, whiteEdgeCoords.length + 14);
  whiteEdgeCoords.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 0.36, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    whiteBulbInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(lx, 0.17, lz);
    dummy.updateMatrix();
    stalkInst.setMatrixAt(i, dummy.matrix);
  });
  whiteBulbInst.instanceMatrix.needsUpdate = true;
  scene.add(whiteBulbInst);

  // Taxiway Blue Edge Lights
  const blueCoords: [number, number][] = [];
  for (let z = 78; z <= 126; z += 8) {
    blueCoords.push([-96.2, z]);
  }
  for (const bx of [-103.2, -101.0]) {
    blueCoords.push([bx, 73.8], [bx, 100.8], [bx, 126.8]);
  }
  const blueBulbInst = new THREE.InstancedMesh(bulbGeo, taxiBlueBulbMat, blueCoords.length);
  blueCoords.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 0.32, lz);
    dummy.scale.set(0.85, 0.85, 0.85);
    dummy.updateMatrix();
    blueBulbInst.setMatrixAt(i, dummy.matrix);
    if (i < 14) {
      dummy.position.set(lx, 0.15, lz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stalkInst.setMatrixAt(whiteEdgeCoords.length + i, dummy.matrix);
    }
  });
  blueBulbInst.instanceMatrix.needsUpdate = true;
  stalkInst.instanceMatrix.needsUpdate = true;
  scene.add(blueBulbInst);
  scene.add(stalkInst);

  // Green North Threshold Bar (z=70.1) & Red South End Bar (z=135.9)
  for (let i = 0; i < 6; i++) {
    const tx = -117.5 + i * 2.2;
    addVisual(bulbGeo, rwyGreenBulbMat, tx, 0.22, 70.1);
    addVisual(bulbGeo, rwyRedBulbMat, tx, 0.22, 135.9);
  }

  // PAPI (Precision Approach Path Indicator) 4-light unit beside Touchdown Zone (x = -121.5, z = 82)
  for (let i = 0; i < 4; i++) {
    const px = -122.6 + i * 0.65;
    addVisual(new THREE.BoxGeometry(0.45, 0.36, 0.55), steelDarkMat, px, 0.28, 82.0);
    addVisual(
      new THREE.SphereGeometry(0.14, 8, 8),
      i < 2 ? rwyRedBulbMat : rwyWhiteBulbMat,
      px,
      0.34,
      81.72,
    );
  }

  // Sequenced Approach "Rabbit" Strobe Lights along South Seawall & North Approach
  const rabbitStrobes: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; idx: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const smat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#36f1e6',
      emissiveIntensity: 0.4,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.22), smat);
    m.position.set(rwyX, 0.16, 136.6 - i * 2.1);
    m.userData.dynamic = true;
    scene.add(m);
    rabbitStrobes.push({ mesh: m, mat: smat, idx: i });
  }

  // ===========================================================================
  // 3) ENTRANCE GANTRY, GUARD BOOTH & PERIMETER CHAIN-LINK FENCE
  // ===========================================================================
  const gantryX = -94.0;
  const gantryZ = 67.2;
  for (const sx of [-6.8, 6.8]) {
    addBox(0.75, 5.8, 0.75, gantryX + sx, 2.9, gantryZ, steelDarkMat, true, 'airfield-gantry');
  }
  const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(14.6, 1.1, 0.8), steelDarkMat);
  gantryBeam.position.set(gantryX, 5.75, gantryZ);
  gantryBeam.castShadow = true;
  scene.add(gantryBeam);

  const gateSignTex = createNeonSignTexture("VICE INT'L · AIRFIELD", '#36f1e6');
  const gateSignMat = new THREE.MeshStandardMaterial({
    map: gateSignTex,
    emissive: '#ffffff',
    emissiveMap: gateSignTex,
    emissiveIntensity: 1.75,
  });
  const gateSignF = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.25, 0.16), gateSignMat);
  gateSignF.position.set(gantryX, 5.8, gantryZ - 0.46);
  gateSignF.rotation.y = Math.PI;
  scene.add(gateSignF);
  const gateSignB = gateSignF.clone();
  gateSignB.position.z = gantryZ + 0.46;
  gateSignB.rotation.y = 0;
  scene.add(gateSignB);

  // Small Security Guard Booth beside entrance (x = -102.6, z = 67.4)
  addBox(2.4, 2.6, 2.4, -102.6, 1.3, 67.4, stuccoCreamMat, true, 'airfield');
  addVisual(new THREE.BoxGeometry(2.7, 0.22, 2.7), stuccoMintMat, -102.6, 2.7, 67.4);
  addVisual(new THREE.BoxGeometry(2.46, 0.9, 1.8), glassTintMat, -102.6, 1.65, 67.4);
  // Raised red/white barrier arm (open for traffic!)
  const barrierArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, 0.12), aviationRedMat);
  barrierArm.position.set(-100.8, 2.55, 67.4);
  barrierArm.rotation.z = -0.18;
  scene.add(barrierArm);

  // Perimeter Chain-Link Fences (West edge x=-124.2, East divider x=-68.2 with wide vehicle gate z=82..94)
  const addFenceSegment = (x1: number, z1: number, x2: number, z2: number) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const isZ = Math.abs(dz) > Math.abs(dx);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), fenceMat);
    mesh.position.set(cx, 1.35, cz);
    if (isZ) mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);
    // Top rail + collider
    addBox(isZ ? 0.22 : len, 2.6, isZ ? len : 0.22, cx, 1.3, cz, new THREE.MeshBasicMaterial({ visible: false }), false, 'airfield-fence');
    addVisual(
      new THREE.BoxGeometry(isZ ? 0.08 : len, 0.08, isZ ? len : 0.08),
      steelGalvMat,
      cx,
      2.62,
      cz,
    );
  };
  // West perimeter fence
  addFenceSegment(-124.0, 67.0, -124.0, 137.0);
  // East divider between Airfield & Vice Port (open drive-through gap at z = 82..94!)
  addFenceSegment(-68.2, 67.0, -68.2, 82.0);
  addFenceSegment(-68.2, 94.0, -68.2, 126.0);

  // Airport entrance tropical palms (batched into CityBuilder's single InstancedMesh!)
  for (const [px, pz] of [
    [-86.5, 68.4],
    [-70.5, 68.4],
    [-86.5, 84.8],
    [-70.2, 84.8],
    [-103.5, 68.8],
  ]) {
    palmPositions.push({ x: px, y: 0.02, z: pz, rot: px * 0.7 + pz, scale: 0.94 });
  }

  // ===========================================================================
  // 4) WALK-IN 80s ART-DECO TERMINAL 1 (x = -86..-70, z = 71..83)
  // ===========================================================================
  const tX = -78.0;
  const tZ = 77.0;
  const tW = 16.0;
  const tD = 12.0;
  const tH = 5.2;

  // Terrazzo interior floor (step-up 0.12m)
  const termFloor = new THREE.Mesh(new THREE.BoxGeometry(tW, 0.14, tD), terrazzoMat);
  termFloor.position.set(tX, 0.06, tZ);
  termFloor.receiveShadow = true;
  scene.add(termFloor);
  worldMeshes.push(termFloor);

  // Roof slab + Art-Deco neon trim
  addBox(tW + 0.8, 0.45, tD + 0.8, tX, tH + 0.22, tZ, stuccoCreamMat, true, 'airfield-roof');
  addVisual(new THREE.BoxGeometry(tW + 1.0, 0.14, 0.14), pinkNeon, tX, tH + 0.48, tZ - tD / 2 - 0.35);
  addVisual(new THREE.BoxGeometry(tW + 1.0, 0.14, 0.14), cyanNeon, tX, tH + 0.48, tZ + tD / 2 + 0.35);
  addVisual(new THREE.BoxGeometry(0.14, 0.14, tD + 1.0), pinkNeon, tX - tW / 2 - 0.35, tH + 0.48, tZ);

  // Curbside arrival awning canopy on North facade (z = 69.4)
  addVisual(new THREE.BoxGeometry(9.5, 0.22, 3.2), stuccoMintMat, tX, 3.65, tZ - tD / 2 - 1.5);
  addVisual(new THREE.BoxGeometry(9.6, 0.1, 0.12), cyanNeon, tX, 3.65, tZ - tD / 2 - 3.1);
  for (const cx of [-4.2, 4.2]) {
    addBox(0.26, 3.6, 0.26, tX + cx, 1.8, tZ - tD / 2 - 2.8, chromeMat, true, 'airfield');
  }

  // Hollow Terminal Walls with wide North curbside entrance (4.4m) & West airside gate doorway (3.6m)
  // North wall (z = 71.0): gap at x = -80.2 .. -75.8
  addBox(5.8, tH, 0.4, -83.1, tH / 2, 71.0, stuccoCreamMat, true, 'airfield');
  addBox(5.8, tH, 0.4, -72.9, tH / 2, 71.0, stuccoCreamMat, true, 'airfield');
  addBox(4.4, 1.7, 0.4, -78.0, 4.35, 71.0, stuccoMintMat, false, 'airfield-lintel');
  // South wall (z = 83.0): solid with tinted panoramic window band
  addBox(tW, 1.2, 0.4, tX, 0.6, 83.0, stuccoCreamMat, true, 'airfield');
  addBox(tW, 1.1, 0.4, tX, 4.65, 83.0, stuccoCreamMat, true, 'airfield');
  addVisual(new THREE.BoxGeometry(tW - 0.6, 2.9, 0.12), glassTintMat, tX, 2.65, 83.0);
  // East wall (z = 71..83, x = -70.0)
  addBox(0.4, tH, tD, -70.0, tH / 2, tZ, stuccoCreamMat, true, 'airfield');
  // West airside wall (x = -86.0): gap at z = 75.2 .. 78.8 (3.6m wide walkout to tarmac!)
  addBox(0.4, tH, 4.2, -86.0, tH / 2, 73.1, stuccoCreamMat, true, 'airfield');
  addBox(0.4, tH, 4.2, -86.0, tH / 2, 80.9, stuccoCreamMat, true, 'airfield');
  addBox(0.4, 1.7, 3.6, -86.0, 4.35, 77.0, stuccoMintMat, false, 'airfield-lintel');

  // Roofline Neon Sign "TERMINAL 1 · VICE AIR"
  const termSignTex = createNeonSignTexture('TERMINAL 1 · VICE AIR', '#ff4fa3');
  const termSignMat = new THREE.MeshStandardMaterial({
    map: termSignTex,
    emissive: '#ffffff',
    emissiveMap: termSignTex,
    emissiveIntensity: 1.75,
  });
  const termSign = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.35, 0.2), termSignMat);
  termSign.position.set(tX, tH + 1.25, 71.2);
  termSign.rotation.y = Math.PI;
  scene.add(termSign);

  // Interior Details: Split-Flap Departures Board on East Wall
  const flightBoardTex = createFlightBoardTexture();
  const flightBoardMat = new THREE.MeshStandardMaterial({
    map: flightBoardTex,
    emissive: '#ffffff',
    emissiveMap: flightBoardTex,
    emissiveIntensity: 0.72,
    roughness: 0.35,
  });
  const flightBoard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.1, 4.4), flightBoardMat);
  flightBoard.position.set(-70.35, 3.45, 77.0);
  scene.add(flightBoard);

  // Check-In & Espresso / Duty-Free Counter along East Interior Wall (x = -72.6, z = 74.0..80.0)
  addBox(1.2, 1.05, 6.2, -72.6, 0.62, 77.0, stuccoMintMat, true, 'airfield-counter');
  addVisual(new THREE.BoxGeometry(1.36, 0.1, 6.4), chromeMat, -72.6, 1.18, 77.0);
  // Retro CRT Check-in Monitor + Espresso Machine
  addVisual(new THREE.BoxGeometry(0.42, 0.42, 0.44), steelDarkMat, -72.5, 1.44, 78.6);
  addVisual(new THREE.BoxGeometry(0.06, 0.28, 0.32), cyanNeon, -72.72, 1.44, 78.6);
  addVisual(new THREE.BoxGeometry(0.55, 0.52, 0.68), chromeMat, -72.5, 1.48, 75.3);
  // Glowing Café Floor Marker
  const cafeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 24),
    new THREE.MeshBasicMaterial({ color: '#36f1e6', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  );
  cafeRing.rotation.x = -Math.PI / 2;
  cafeRing.position.set(-74.2, 0.15, 75.5);
  scene.add(cafeRing);

  // 80s Turquoise Waiting Lounge Benches inside Terminal
  for (const bz of [73.2, 80.8]) {
    addBox(3.6, 0.48, 0.85, -80.4, 0.36, bz, aircraftTealMat, true, 'airfield-bench');
    addVisual(new THREE.BoxGeometry(3.6, 0.55, 0.14), aircraftTealMat, -80.4, 0.78, bz + (bz < 77 ? -0.35 : 0.35));
  }

  // Animated Baggage Claim Carousel inside Terminal 1 (x = -78.2, z = 77.0)
  const carouselX = -78.2;
  const carouselZ = 77.0;
  addBox(3.0, 0.58, 1.7, carouselX, 0.41, carouselZ, steelDarkMat, true, 'airfield-prop');
  addVisual(new THREE.BoxGeometry(2.6, 0.08, 1.3), chromeMat, carouselX, 0.74, carouselZ);
  addVisual(new THREE.BoxGeometry(1.6, 0.52, 0.65), stuccoMintMat, carouselX, 0.98, carouselZ);
  const suitcaseColors = ['#ff4fa3', '#28c7bf', '#f2c14e', '#2d4675', '#d9483b'];
  const carouselBags: { mesh: THREE.Mesh; phase: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const bagMat = new THREE.MeshStandardMaterial({ color: suitcaseColors[i], roughness: 0.45 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.24), bagMat);
    bag.userData.dynamic = true;
    scene.add(bag);
    carouselBags.push({ mesh: bag, phase: (i / 5) * Math.PI * 2 });
  }

  // Airside Gate Security Metal Detector Archway + X-Ray Belt (x = -84.6, z = 77.0)
  for (const sz of [75.8, 78.2]) {
    addVisual(new THREE.BoxGeometry(0.45, 2.35, 0.22), steelGalvMat, -84.6, 1.3, sz);
  }
  addVisual(new THREE.BoxGeometry(0.5, 0.28, 2.62), steelGalvMat, -84.6, 2.52, 77.0);
  addVisual(new THREE.BoxGeometry(0.52, 0.08, 0.42), rwyGreenBulbMat, -84.6, 2.68, 77.0);
  // X-ray scanner box beside security arch
  addBox(1.2, 1.15, 0.9, -84.6, 0.7, 79.35, steelDarkMat, true, 'airfield-prop');

  // Terminal Curbside Luggage Trolleys + Rooftop HVAC Units & Satellite Dish
  for (const lx of [-82.5, -73.5]) {
    addVisual(new THREE.BoxGeometry(0.85, 0.08, 1.15), chromeMat, lx, 0.22, 69.4);
    addVisual(new THREE.BoxGeometry(0.06, 0.95, 0.85), chromeMat, lx - 0.38, 0.68, 69.4);
    addVisual(new THREE.BoxGeometry(0.54, 0.34, 0.44), aircraftPinkMat, lx + 0.08, 0.44, 69.35);
    addVisual(new THREE.BoxGeometry(0.42, 0.26, 0.36), aircraftTealMat, lx + 0.06, 0.74, 69.42);
  }
  // Rooftop HVAC & Uplink Dish on Terminal 1
  for (const hx of [-82.5, -74.0]) {
    addVisual(new THREE.BoxGeometry(2.2, 0.85, 1.8), steelGalvMat, hx, tH + 0.85, 79.2);
    addVisual(new THREE.CylinderGeometry(0.65, 0.65, 0.14, 12), steelDarkMat, hx, tH + 1.32, 79.2);
  }
  addVisual(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8), steelGalvMat, -72.2, tH + 1.0, 73.5);
  const satDish = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), aviationWhiteMat);
  satDish.position.set(-72.2, tH + 1.65, 73.5);
  satDish.rotation.set(0.7, 0.4, 0);
  scene.add(satDish);

  // ===========================================================================
  // 5) 22m ATC CONTROL TOWER + 4-FLIGHT WRAP-AROUND STAIRCASE TO y=13.2m + RADAR
  // ===========================================================================
  const atcX = -75.5;
  const atcZ = 92.5;

  // Lower concrete tower shaft (0 .. 14.2m) with vertical pilasters, aviation bands & maintenance door
  addBox(4.0, 14.2, 4.0, atcX, 7.1, atcZ, stuccoCreamMat, true, 'airfield-tower');
  for (const rx of [-2.02, 2.02]) {
    for (const rz of [-2.02, 2.02]) {
      addVisual(new THREE.BoxGeometry(0.28, 14.2, 0.28), stuccoMintMat, atcX + rx, 7.1, atcZ + rz);
    }
  }
  addVisual(new THREE.BoxGeometry(4.14, 0.7, 4.14), aviationRedMat, atcX, 11.4, atcZ);
  addVisual(new THREE.BoxGeometry(4.14, 0.7, 4.14), aviationRedMat, atcX, 13.0, atcZ);
  // Ground steel access door on South face of shaft
  addVisual(new THREE.BoxGeometry(1.15, 2.15, 0.12), steelDarkMat, atcX, 1.08, atcZ + 2.02);

  // Engineered 4-Flight Wrap-Around Steel Staircase (0.0m -> 13.20m Upper ATC Catwalk!)
  // Every flight: 15 steps, riser = 0.22m (<= 0.24m maxStepHeight!), tread = 0.32m (15*0.32 = 4.80m exact span!)
  const stairsOffset = 3.35; // corridor center from tower center -> spans [2.40 .. 4.30]
  const stairsWidth = 1.9;
  const landingSize = 1.9;
  const stepRiser = 0.22;
  const stepTread = 0.32;
  const stepsPerFlight = 15; // 3.30m vertical climb per flight

  // 4 Heavy Steel I-Beam Corner Support Columns (y = 0 .. 13.2m) + Wall Tie Brackets
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addVisual(
        new THREE.BoxGeometry(0.24, 13.25, 0.24),
        steelDarkMat,
        atcX + sx * 4.24,
        6.625,
        atcZ + sz * 4.24,
        true,
      );
    }
  }
  for (const bracketY of [3.2, 6.5, 9.8, 13.1]) {
    addVisual(new THREE.BoxGeometry(8.5, 0.16, 0.16), steelDarkMat, atcX, bracketY, atcZ - 2.38);
    addVisual(new THREE.BoxGeometry(8.5, 0.16, 0.16), steelDarkMat, atcX, bracketY, atcZ + 2.38);
    addVisual(new THREE.BoxGeometry(0.16, 0.16, 8.5), steelDarkMat, atcX - 2.38, bracketY, atcZ);
    addVisual(new THREE.BoxGeometry(0.16, 0.16, 8.5), steelDarkMat, atcX + 2.38, bracketY, atcZ);
  }

  // Helper to build a precision steel flight with solid tread steps, twin sloped stringers & outer handrails
  const buildTowerFlight = (
    startX: number,
    startZ: number,
    dirX: number,
    dirZ: number,
    outX: number,
    outZ: number,
    baseY: number,
  ) => {
    const isAlongZ = Math.abs(dirZ) > 0.5;
    const totalRun = stepsPerFlight * stepTread; // 4.80m
    const totalRise = stepsPerFlight * stepRiser; // 3.30m
    const hyp = Math.hypot(totalRun, totalRise);
    const slopeAngle = Math.atan2(totalRise, totalRun);

    for (let i = 0; i < stepsPerFlight; i++) {
      const dist = (i + 0.5) * stepTread;
      const sx = startX + dirX * dist;
      const sz = startZ + dirZ * dist;
      const topY = baseY + (i + 1) * stepRiser;
      const w = isAlongZ ? stairsWidth : stepTread + 0.04;
      const d = isAlongZ ? stepTread + 0.04 : stairsWidth;
      addBox(w, stepRiser, d, sx, topY - stepRiser / 2, sz, steelGrateMat, false, 'airfield-stairs');
    }

    // Twin sloped steel stringer beams under each flight
    const midX = startX + dirX * (totalRun / 2);
    const midZ = startZ + dirZ * (totalRun / 2);
    const midY = baseY + totalRise / 2 - 0.12;
    const yaw = Math.atan2(dirX, dirZ);

    for (const side of [-0.78, 0.78]) {
      const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, hyp), steelDarkMat);
      stringer.position.set(
        midX + (isAlongZ ? side : 0),
        midY,
        midZ + (isAlongZ ? 0 : side),
      );
      stringer.rotation.set(-slopeAngle, yaw, 0, 'YXZ');
      scene.add(stringer);
    }

    // Sloped outer safety handrail (top rail + mid rail + vertical stanchions)
    const railEdgeOffset = stairsWidth / 2 - 0.06;
    const railMidX = midX + outX * railEdgeOffset;
    const railMidZ = midZ + outZ * railEdgeOffset;
    for (const hOff of [0.55, 1.02]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, hyp),
        hOff > 0.9 ? safetyRailYellowMat : steelGalvMat,
      );
      rail.position.set(railMidX, baseY + totalRise / 2 + hOff, railMidZ);
      rail.rotation.set(-slopeAngle, yaw, 0, 'YXZ');
      scene.add(rail);
    }
    for (const pIdx of [2, 7, 12]) {
      const dist = (pIdx + 0.5) * stepTread;
      const px = startX + dirX * dist + outX * railEdgeOffset;
      const pz = startZ + dirZ * dist + outZ * railEdgeOffset;
      const py = baseY + (pIdx + 1) * stepRiser;
      addVisual(new THREE.BoxGeometry(0.06, 1.04, 0.06), steelDarkMat, px, py + 0.52, pz);
    }
  };

  // Helper for corner landings with outer safety railings on the two exposed outer sides
  const buildCornerLanding = (lx: number, lz: number, topY: number, railNorth: boolean, railSouth: boolean, railEast: boolean, railWest: boolean) => {
    addBox(landingSize, 0.22, landingSize, lx, topY - 0.11, lz, steelGrateMat, true, 'airfield-stairs');
    const half = landingSize / 2 - 0.05;
    const addEdgeRail = (x: number, z: number, lenX: number, lenZ: number) => {
      addVisual(new THREE.BoxGeometry(lenX, 0.06, lenZ), safetyRailYellowMat, x, topY + 1.02, z);
      addVisual(new THREE.BoxGeometry(lenX, 0.05, lenZ), steelGalvMat, x, topY + 0.55, z);
    };
    if (railNorth) addEdgeRail(lx, lz - half, landingSize, 0.06);
    if (railSouth) addEdgeRail(lx, lz + half, landingSize, 0.06);
    if (railEast) addEdgeRail(lx + half, lz, 0.06, landingSize);
    if (railWest) addEdgeRail(lx - half, lz, 0.06, landingSize);
  };

  // Ground Entry Pad at SE Corner (atcX + 3.35, atcZ + 3.35)
  addVisual(new THREE.BoxGeometry(2.1, 0.06, 2.1), hazardMat, atcX + stairsOffset, 0.03, atcZ + stairsOffset);

  // Flight 1 (East side, climbing North -Z: 0.0m -> 3.30m)
  buildTowerFlight(atcX + stairsOffset, atcZ + 2.4, 0, -1, 1, 0, 0.0);
  buildCornerLanding(atcX + stairsOffset, atcZ - stairsOffset, 3.3, true, false, true, false);

  // Flight 2 (North side, climbing West -X: 3.30m -> 6.60m)
  buildTowerFlight(atcX + 2.4, atcZ - stairsOffset, -1, 0, 0, -1, 3.3);
  buildCornerLanding(atcX - stairsOffset, atcZ - stairsOffset, 6.6, true, false, false, true);

  // Flight 3 (West side, climbing South +Z: 6.60m -> 9.90m)
  buildTowerFlight(atcX - stairsOffset, atcZ - 2.4, 0, 1, -1, 0, 6.6);
  buildCornerLanding(atcX - stairsOffset, atcZ + stairsOffset, 9.9, false, true, false, true);

  // Flight 4 (South side, climbing East +X: 9.90m -> 13.20m into the 360° Upper ATC Catwalk!)
  buildTowerFlight(atcX - 2.4, atcZ + stairsOffset, 1, 0, 0, 1, 9.9);

  // 360° Upper ATC Observation Catwalk Deck at y = 13.20m (wraps all 4 sides around shaft!)
  const upperDeckY = 13.2;
  // North, West, East full catwalk strips + South-East arrival landing (leaves South flight opening clean!)
  addBox(8.6, 0.26, 2.3, atcX, upperDeckY - 0.13, atcZ - 3.15, steelGrateMat, true, 'airfield-deck');
  addBox(2.3, 0.26, 8.6, atcX - 3.15, upperDeckY - 0.13, atcZ, steelGrateMat, true, 'airfield-deck');
  addBox(2.3, 0.26, 8.6, atcX + 3.15, upperDeckY - 0.13, atcZ, steelGrateMat, true, 'airfield-deck');
  // Outer safety railings + cyan neon trim around the 360° Upper Catwalk (with open entry on South where Flight 4 arrives!)
  const catOuter = 4.26;
  const addCatwalkRail = (x: number, z: number, lx: number, lz: number) => {
    addVisual(new THREE.BoxGeometry(lx, 0.07, lz), safetyRailYellowMat, x, upperDeckY + 1.04, z);
    addVisual(new THREE.BoxGeometry(lx, 0.05, lz), steelGalvMat, x, upperDeckY + 0.54, z);
    addVisual(new THREE.BoxGeometry(lx, 0.06, lz), cyanNeon, x, upperDeckY + 0.1, z);
  };
  addCatwalkRail(atcX, atcZ - catOuter, 8.6, 0.07);
  addCatwalkRail(atcX - catOuter, atcZ, 0.07, 8.6);
  addCatwalkRail(atcX + catOuter, atcZ, 0.07, 8.6);
  // South rail only on the SE arrival platform & SW corner (leaves x = atcX-2.0..atcX+2.4 open for Flight 4!)
  addCatwalkRail(atcX + 3.3, atcZ + catOuter, 2.0, 0.07);
  addCatwalkRail(atcX - 3.3, atcZ + catOuter, 2.0, 0.07);
  // Vertical railing stanchions + corner red aviation obstruction lights on upper catwalk
  for (const sx of [-catOuter, 0, catOuter]) {
    addVisual(new THREE.BoxGeometry(0.07, 1.06, 0.07), steelDarkMat, atcX + sx, upperDeckY + 0.53, atcZ - catOuter);
  }
  for (const sz of [-catOuter, 0, catOuter]) {
    addVisual(new THREE.BoxGeometry(0.07, 1.06, 0.07), steelDarkMat, atcX - catOuter, upperDeckY + 0.53, atcZ + sz);
    addVisual(new THREE.BoxGeometry(0.07, 1.06, 0.07), steelDarkMat, atcX + catOuter, upperDeckY + 0.53, atcZ + sz);
  }
  for (const sx of [-catOuter, catOuter]) {
    for (const sz of [-catOuter, catOuter]) {
      addVisual(bulbGeo, rwyRedBulbMat, atcX + sx, upperDeckY + 1.18, atcZ + sz);
    }
  }

  // Upper ATC Control Cab (y = 14.2 .. 18.2m) — flared octagonal control room with mullions & radar scopes
  const cabFloor = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 2.7, 1.1, 8), stuccoCreamMat);
  cabFloor.position.set(atcX, 14.75, atcZ);
  cabFloor.castShadow = true;
  scene.add(cabFloor);

  const cabGlass = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 3.85, 2.4, 8), atcGlassMat);
  cabGlass.position.set(atcX, 16.5, atcZ);
  scene.add(cabGlass);

  // 8 Angled Structural Window Mullions around the octagonal ATC Cab
  for (let m = 0; m < 8; m++) {
    const ang = (m / 8) * Math.PI * 2 + Math.PI / 8;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.52, 0.14), steelDarkMat);
    mullion.position.set(atcX + Math.cos(ang) * 4.05, 16.5, atcZ + Math.sin(ang) * 4.05);
    mullion.rotation.set(0, -ang, -0.22);
    scene.add(mullion);
  }

  // Glowing Green Radar Scope Consoles inside ATC Cab
  const cabConsole = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.9, 8), steelDarkMat);
  cabConsole.position.set(atcX, 15.8, atcZ);
  scene.add(cabConsole);
  for (let sc = 0; sc < 4; sc++) {
    const ang = (sc / 4) * Math.PI * 2;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.08), radarScopeMat);
    screen.position.set(atcX + Math.cos(ang) * 2.4, 16.45, atcZ + Math.sin(ang) * 2.4);
    screen.rotation.y = -ang + Math.PI / 2;
    scene.add(screen);
  }

  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.5, 0.65, 8), roofDarkMat);
  cabRoof.position.set(atcX, 18.0, atcZ);
  cabRoof.castShadow = true;
  scene.add(cabRoof);

  // VHF Communication Whip Antennas on ATC Cab Roof
  for (const [ax, az, ah] of [
    [-2.4, 1.8, 3.2],
    [-1.8, 2.4, 2.4],
    [2.5, 2.1, 2.8],
  ]) {
    addVisual(new THREE.CylinderGeometry(0.03, 0.05, ah, 6), chromeMat, atcX + ax, 18.3 + ah / 2, atcZ + az);
    addVisual(bulbGeo, rwyRedBulbMat, atcX + ax, 18.35 + ah, atcZ + az);
  }

  // Thin pink neon crown around ATC cab roof
  const cabNeonRing = new THREE.Mesh(new THREE.TorusGeometry(4.65, 0.08, 8, 24), pinkNeon);
  cabNeonRing.rotation.x = Math.PI / 2;
  cabNeonRing.position.set(atcX, 18.05, atcZ);
  scene.add(cabNeonRing);

  // Continuously Rotating 3D Airport Lattice Radar Dish on ATC Roof (y = 19.6m)
  const radarGroup = new THREE.Group();
  radarGroup.position.set(atcX, 19.55, atcZ);
  radarGroup.userData.dynamic = true;
  const radarPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.4, 8), steelGalvMat);
  radarPedestal.position.y = -0.5;
  radarGroup.add(radarPedestal);
  const radarBar = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.72, 0.22), aviationWhiteMat);
  radarBar.position.y = 0.45;
  radarGroup.add(radarBar);
  const radarStripe = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.16, 0.26), aviationRedMat);
  radarStripe.position.y = 0.45;
  radarGroup.add(radarStripe);
  scene.add(radarGroup);

  // Rotating Green/White Dual-Lens Airport Beacon on top mast (y = 21.6m)
  addVisual(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 8), steelGalvMat, atcX + 1.8, 19.4, atcZ - 1.5);
  const beaconHead = new THREE.Group();
  beaconHead.position.set(atcX + 1.8, 20.65, atcZ - 1.5);
  beaconHead.userData.dynamic = true;
  const beaconBody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.44, 10), steelDarkMat);
  beaconHead.add(beaconBody);
  const lensGreen = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), rwyGreenBulbMat);
  lensGreen.position.z = 0.24;
  beaconHead.add(lensGreen);
  const lensWhite = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), rwyWhiteBulbMat);
  lensWhite.position.z = -0.24;
  beaconHead.add(lensWhite);
  // Subtle volumetric sweeping light cones (0 extra PointLights!)
  const beaconConeGeo = new THREE.ConeGeometry(2.8, 16, 12, 1, true);
  beaconConeGeo.translate(0, -8, 0);
  beaconConeGeo.rotateX(Math.PI / 2);
  const beaconConeGreen = new THREE.Mesh(
    beaconConeGeo,
    new THREE.MeshBasicMaterial({
      color: '#32e880',
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beaconHead.add(beaconConeGreen);
  const beaconConeWhite = new THREE.Mesh(
    beaconConeGeo,
    new THREE.MeshBasicMaterial({
      color: '#fff2cc',
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beaconConeWhite.rotation.y = Math.PI;
  beaconHead.add(beaconConeWhite);
  scene.add(beaconHead);

  // Animated Orange/White Aviation Windsock Mast (x = -102.5, z = 86.0)
  addVisual(new THREE.CylinderGeometry(0.08, 0.12, 5.4, 8), aviationWhiteMat, -102.5, 2.7, 86.0);
  const windsockPivot = new THREE.Group();
  windsockPivot.position.set(-102.5, 5.25, 86.0);
  windsockPivot.userData.dynamic = true;
  for (let s = 0; s < 5; s++) {
    const r1 = 0.34 - s * 0.045;
    const r2 = 0.30 - s * 0.045;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r2, r1, 0.44, 10, 1, true),
      s % 2 === 0 ? aviationRedMat : aviationWhiteMat,
    );
    seg.rotation.z = -Math.PI / 2;
    seg.position.set(0.35 + s * 0.42, -s * 0.05, 0);
    windsockPivot.add(seg);
  }
  scene.add(windsockPivot);

  // ===========================================================================
  // 6) MASSIVE WALK-IN / DRIVE-IN "HANGAR 06" (x = -88..-71, z = 104..121)
  // ===========================================================================
  const hX = -79.5;
  const hZ = 112.5;
  const hW = 17.0;
  const hD = 17.0;
  const hWallH = 6.2;

  // Hangar side & back walls (West side x = -88 is WIDE OPEN 12.6m for aircraft & cars!)
  addBox(hW, hWallH, 0.45, hX, hWallH / 2, hZ - hD / 2, hangarWallMat, true, 'airfield-hangar');
  addBox(hW, hWallH, 0.45, hX, hWallH / 2, hZ + hD / 2, hangarWallMat, true, 'airfield-hangar');
  addBox(0.45, hWallH, hD, hX + hW / 2, hWallH / 2, hZ, hangarWallMat, true, 'airfield-hangar');
  // Open sliding hangar door leaves parked on the left & right jambs of the West opening
  addBox(0.45, hWallH, 2.3, hX - hW / 2, hWallH / 2, hZ - hD / 2 + 1.15, steelDarkMat, true, 'airfield-hangar');
  addBox(0.45, hWallH, 2.3, hX - hW / 2, hWallH / 2, hZ + hD / 2 - 1.15, steelDarkMat, true, 'airfield-hangar');
  // Overhead steel door header beam (high enough at y=6.0 for all cars/trucks!)
  addVisual(new THREE.BoxGeometry(0.6, 1.1, hD), steelDarkMat, hX - hW / 2, hWallH + 0.3, hZ);

  // Segmented Arched Quonset Roof (truly hollow inside!)
  const archSegments = 6;
  for (let i = 0; i < archSegments; i++) {
    const a0 = (i / archSegments) * Math.PI;
    const a1 = ((i + 1) / archSegments) * Math.PI;
    const midA = (a0 + a1) / 2;
    const radiusZ = hD / 2;
    const archH = 2.8;
    const segZ = hZ - Math.cos(midA) * radiusZ;
    const segY = hWallH + Math.sin(midA) * archH;
    const segLen = Math.hypot(
      (Math.cos(a1) - Math.cos(a0)) * radiusZ,
      (Math.sin(a1) - Math.sin(a0)) * archH,
    );
    const tilt = Math.atan2(
      (Math.sin(a1) - Math.sin(a0)) * archH,
      (Math.cos(a0) - Math.cos(a1)) * radiusZ,
    );
    const panel = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.6, 0.24, segLen + 0.18), hangarWallMat);
    panel.position.set(hX, segY, segZ);
    panel.rotation.x = tilt;
    panel.castShadow = true;
    panel.receiveShadow = true;
    scene.add(panel);
    worldMeshes.push(panel);
  }

  // Hangar 06 Neon Header Sign facing the runway/taxiway (-X)
  const hangarSignTex = createNeonSignTexture('HANGAR 06 · VICE AIRWAYS', '#ff9f43');
  const hangarSignMat = new THREE.MeshStandardMaterial({
    map: hangarSignTex,
    emissive: '#ffffff',
    emissiveMap: hangarSignTex,
    emissiveIntensity: 1.7,
  });
  const hangarSign = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 9.2), hangarSignMat);
  hangarSign.position.set(hX - hW / 2 - 0.35, hWallH + 0.55, hZ);
  scene.add(hangarSign);

  // Interior Hangar Steel Roof Trusses & Hanging High-Bay Industrial Lamps (0 extra PointLights!)
  for (const tx of [-85.0, -81.0, -77.0, -73.0]) {
    addVisual(new THREE.BoxGeometry(0.24, 0.24, hD - 0.6), steelDarkMat, tx, hWallH + 0.1, hZ);
    for (const lz of [hZ - 4.2, hZ + 4.2]) {
      addVisual(new THREE.CylinderGeometry(0.32, 0.45, 0.28, 10), steelDarkMat, tx, hWallH - 0.15, lz);
      addVisual(new THREE.SphereGeometry(0.18, 8, 8), floodBulbMat, tx, hWallH - 0.3, lz);
    }
  }
  // Yellow safety parking box painted on Hangar 06 floor
  drawTaxiLine(13.5, 0.22, hX - 0.8, hZ - 6.6);
  drawTaxiLine(13.5, 0.22, hX - 0.8, hZ + 6.6);
  drawTaxiLine(0.22, 13.4, hX + 6.0, hZ);

  // Interior Hangar Props: Tool Chests, Oil Drums, Cargo Pallets, Mobile GPU & Fire Cart
  addBox(1.8, 1.1, 0.9, -73.0, 0.55, 106.2, aviationRedMat, true, 'airfield-prop');
  addBox(2.2, 1.2, 1.4, -73.2, 0.6, 118.4, crateWoodMat, true, 'airfield-prop');
  addBox(1.3, 1.1, 1.3, -75.4, 0.55, 118.6, crateWoodMat, true, 'airfield-prop');
  for (const dz of [105.8, 106.7, 107.6]) {
    addVisual(new THREE.CylinderGeometry(0.32, 0.32, 0.96, 10), aircraftTealMat, -76.2, 0.48, dz);
  }
  // Yellow Mobile Ground Power Unit (GPU) Cart inside Hangar 06
  addBox(1.5, 0.92, 0.95, -83.5, 0.56, 106.5, safetyRailYellowMat, true, 'airfield-prop');
  addVisual(new THREE.BoxGeometry(0.45, 0.35, 0.12), steelDarkMat, -83.5, 0.72, 107.02);
  // Red Wheeled Aviation Fire Extinguisher Cart
  addVisual(new THREE.CylinderGeometry(0.24, 0.24, 1.05, 10), aviationRedMat, -85.8, 0.68, 118.4);
  addVisual(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10), steelDarkMat, -85.8, 0.18, 118.68);

  // Interactive Smuggler Cargo Stash inside Hangar 06 (x = -73.8, z = 112.5)
  const lootPos = new THREE.Vector3(-73.8, 0.0, 112.5);
  let lootTaken = false;
  const lootGroup = new THREE.Group();
  lootGroup.position.copy(lootPos);
  lootGroup.userData.dynamic = true;
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 1.9), crateWoodMat);
  pallet.position.y = 0.08;
  lootGroup.add(pallet);
  const goldCaseA = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.65), goldGlowMat);
  goldCaseA.position.set(-0.32, 0.44, -0.22);
  lootGroup.add(goldCaseA);
  const goldCaseB = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.62), goldGlowMat);
  goldCaseB.position.set(0.35, 0.4, 0.25);
  goldCaseB.rotation.y = 0.35;
  lootGroup.add(goldCaseB);
  const lootBeaconRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.42, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd15c', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  lootBeaconRing.rotation.x = -Math.PI / 2;
  lootBeaconRing.position.y = 0.05;
  lootGroup.add(lootBeaconRing);
  scene.add(lootGroup);

  // ===========================================================================
  // 7) PARKED 80s AIRCRAFT: KING AIR '86 (HANGAR) & MIAMI LEAR '86 (APRON)
  // ===========================================================================
  const kingAir = buildKingAirPropPlane(
    aircraftWhiteMat,
    aircraftPinkMat,
    aircraftTealMat,
    steelDarkMat,
    aircraftGlassMat,
    rwyRedBulbMat,
    rwyGreenBulbMat,
  );
  // Parked nose-out of Hangar 06 facing West (-X) toward the runway!
  kingAir.group.position.set(-83.2, 0, 112.5);
  kingAir.group.rotation.y = -Math.PI / 2;
  scene.add(kingAir.group);
  // Simple fuselage collider so player/cars don't clip through the King Air
  colliders.push({
    minX: -88.2,
    maxX: -78.2,
    minY: 0,
    maxY: 3.4,
    minZ: 111.2,
    maxZ: 113.8,
    tag: 'airfield-aircraft',
  });

  const learjet = buildLearjetExecutive(
    aircraftWhiteMat,
    aircraftPinkMat,
    aircraftTealMat,
    steelDarkMat,
    chromeMat,
    aircraftGlassMat,
    redCarpetMat,
  );
  learjet.position.set(-91.5, 0, 91.2);
  learjet.rotation.y = -2.42; // angled nose NW toward taxiway, boarding stairs facing Terminal 1!
  scene.add(learjet);
  colliders.push({
    minX: -95.2,
    maxX: -87.8,
    minY: 0,
    maxY: 3.4,
    minZ: 87.6,
    maxZ: 94.8,
    tag: 'airfield-aircraft',
  });

  // ===========================================================================
  // 8) AVGAS 100LL FUEL DEPOT, FUEL TANKER TRUCK & SECONDARY HELIPAD (H)
  // ===========================================================================
  // Concrete containment bund at SE airfield corner (x = -76..-70, z = 125..134)
  addBox(6.8, 0.55, 9.2, -73.4, 0.28, 129.5, seawallMat, true, 'airfield-fuel');
  for (const tz of [127.4, 131.6]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 5.4, 16), avgasTankMat);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(-73.4, 1.95, tz);
    tank.castShadow = true;
    scene.add(tank);
    worldMeshes.push(tank);
    // Steel tank cradle legs
    for (const lx of [-75.2, -71.6]) {
      addVisual(new THREE.BoxGeometry(0.35, 1.2, 2.2), steelDarkMat, lx, 0.9, tz);
    }
  }
  colliders.push({
    minX: -76.8,
    maxX: -70.0,
    minY: 0,
    maxY: 3.6,
    minZ: 124.8,
    maxZ: 134.2,
    tag: 'airfield-fuel',
  });

  // Parked AVGAS Fuel Tanker Truck at x = -81.8, z = 129.5
  const truckGroup = new THREE.Group();
  truckGroup.position.set(-81.8, 0, 129.5);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.85, 2.0), aviationRedMat);
  cab.position.set(0, 1.25, -2.35);
  cab.castShadow = true;
  truckGroup.add(cab);
  const cabWin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.72, 0.12), aircraftGlassMat);
  cabWin.position.set(0, 1.55, -3.36);
  truckGroup.add(cabWin);
  const truckTank = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 4.4, 14), chromeMat);
  truckTank.rotation.x = Math.PI / 2;
  truckTank.position.set(0, 1.62, 1.05);
  truckTank.castShadow = true;
  truckGroup.add(truckTank);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 6.4), steelDarkMat);
  chassis.position.set(0, 0.55, 0);
  truckGroup.add(chassis);
  for (const wz of [-2.4, 0.8, 2.4]) {
    for (const wx of [-1.05, 1.05]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), steelDarkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      truckGroup.add(wheel);
    }
  }
  scene.add(truckGroup);
  colliders.push({
    minX: -83.1,
    maxX: -80.5,
    minY: 0,
    maxY: 2.7,
    minZ: 126.0,
    maxZ: 133.0,
    tag: 'airfield-prop',
  });

  // Secondary Airport Helipad (H) at x = -93.0, z = 129.5 (ideal landing spot for Vice Maverick!)
  const heliPadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(10.5, 10.5),
    new THREE.MeshStandardMaterial({ map: createHelipadTexture(), roughness: 0.48 }),
  );
  heliPadMesh.rotation.x = -Math.PI / 2;
  heliPadMesh.position.set(-93.0, 0.02, 129.5);
  heliPadMesh.receiveShadow = true;
  scene.add(heliPadMesh);
  for (const [hx, hz] of [
    [-98.2, 124.3],
    [-87.8, 124.3],
    [-98.2, 134.7],
    [-87.8, 134.7],
  ]) {
    addVisual(bulbGeo, rwyGreenBulbMat, hx, 0.2, hz);
  }

  // ===========================================================================
  // 9) GROUND SUPPORT EQUIPMENT (BAGGAGE TUG + CARTS), TAXIWAY SIGNS & FLOODLIGHTS
  // ===========================================================================
  // Baggage Tractor (Tug) + 2 Towed Luggage Carts near Terminal & Learjet (x = -87.2, z = 85.4)
  const tugGroup = new THREE.Group();
  tugGroup.position.set(-87.2, 0, 85.4);
  tugGroup.rotation.y = 0.25;
  const tugBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.92, 2.35), safetyRailYellowMat);
  tugBody.position.set(0, 0.64, 0);
  tugBody.castShadow = true;
  tugGroup.add(tugBody);
  const tugHood = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.48, 0.95), aviationWhiteMat);
  tugHood.position.set(0, 1.32, -0.35);
  tugGroup.add(tugHood);
  const tugBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), goldGlowMat);
  tugBeacon.position.set(0, 1.66, -0.35);
  tugGroup.add(tugBeacon);
  for (const [wx, wz] of [
    [-0.72, -0.75],
    [0.72, -0.75],
    [-0.72, 0.75],
    [0.72, 0.75],
  ]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.18, 10), steelDarkMat);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, 0.26, wz);
    tugGroup.add(wh);
  }
  // 2 Towed Baggage Carts behind the tug
  for (let cIdx = 0; cIdx < 2; cIdx++) {
    const cz = 2.65 + cIdx * 2.45;
    const towBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.75), steelDarkMat);
    towBar.position.set(0, 0.34, cz - 1.25);
    tugGroup.add(towBar);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 1.75), steelGalvMat);
    deck.position.set(0, 0.42, cz);
    tugGroup.add(deck);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.08, 1.78), aviationWhiteMat);
    canopy.position.set(0, 1.52, cz);
    tugGroup.add(canopy);
    for (const px of [-0.62, 0.62]) {
      for (const pz of [-0.8, 0.8]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), steelDarkMat);
        post.position.set(px, 0.96, cz + pz);
        tugGroup.add(post);
      }
    }
    // Stacked colorful 80s suitcases on each cart
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.38, 0.45), aircraftPinkMat);
    s1.position.set(-0.22, 0.68, cz - 0.25);
    tugGroup.add(s1);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.48), aircraftTealMat);
    s2.position.set(0.24, 0.66, cz + 0.3);
    tugGroup.add(s2);
    const s3 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.42), aviationRedMat);
    s3.position.set(0.0, 1.02, cz - 0.1);
    tugGroup.add(s3);
  }
  scene.add(tugGroup);
  colliders.push({
    minX: -88.2,
    maxX: -85.2,
    minY: 0,
    maxY: 1.7,
    minZ: 84.2,
    maxZ: 91.2,
    tag: 'airfield-prop',
  });

  // Illuminated Airport Taxiway & Runway Guidance Signs + Distance-Remaining Markers
  const addAirportSign = (
    text: string,
    bgHex: string,
    fgHex: string,
    x: number,
    z: number,
    rotY: number,
    w = 2.1,
    h = 0.72,
  ) => {
    const tex = createTaxiSignTexture(text, bgHex, fgHex);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: 0.72,
      roughness: 0.35,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.24), mat);
    box.position.set(x, h / 2 + 0.22, z);
    box.rotation.y = rotY;
    scene.add(box);
    addVisual(new THREE.BoxGeometry(0.08, 0.25, 0.08), steelDarkMat, x, 0.12, z);
  };
  addAirportSign('18-36', '#d62828', '#ffffff', -103.4, 78.2, Math.PI / 2);
  addAirportSign('A · TERM 1', '#f2be32', '#14151a', -97.6, 78.2, Math.PI / 2);
  addAirportSign('HANGAR 06', '#f2be32', '#14151a', -97.6, 108.5, Math.PI / 2);
  addAirportSign('18-36', '#d62828', '#ffffff', -103.4, 126.5, Math.PI / 2);
  // Runway Distance-Remaining Signs along West side of Runway 18/36
  addAirportSign('3', '#14151a', '#ffffff', -121.2, 88.0, Math.PI / 2, 0.9, 0.9);
  addAirportSign('2', '#14151a', '#ffffff', -121.2, 103.0, Math.PI / 2, 0.9, 0.9);
  addAirportSign('1', '#14151a', '#ffffff', -121.2, 118.0, Math.PI / 2, 0.9, 0.9);

  // 4 High-Mast Apron Floodlight Towers (sodium bulbs + soft volumetric haze cones, 0 extra PointLights!)
  const floodConeGeo = new THREE.ConeGeometry(5.5, 11.5, 12, 1, true);
  for (const [fx, fz, aimYaw] of [
    [-69.6, 70.2, -2.35],
    [-69.6, 101.8, -1.65],
    [-69.6, 123.5, -1.85],
    [-101.2, 136.2, 0.35],
  ]) {
    addVisual(new THREE.CylinderGeometry(0.14, 0.24, 12.2, 8), steelGalvMat, fx, 6.1, fz, true);
    const head = new THREE.Group();
    head.position.set(fx, 12.2, fz);
    head.rotation.y = aimYaw;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.35), steelDarkMat);
    head.add(bar);
    for (const bx of [-0.72, 0, 0.72]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.14), floodBulbMat);
      lamp.position.set(bx, 0, 0.2);
      head.add(lamp);
    }
    const haze = new THREE.Mesh(floodConeGeo, floodHazeMat);
    haze.position.set(0, -5.6, 1.8);
    haze.rotation.x = 0.28;
    head.add(haze);
    scene.add(head);
    addVisual(bulbGeo, rwyRedBulbMat, fx, 12.6, fz);
  }

  return {
    // Keep entire reclaimed airfield peninsula at y = 0.0 (overrides southern ocean -6.0m depth for z = 126..138!)
    getGroundHeight: (x: number, z: number) => {
      if (x >= -125.5 && x <= -67.5 && z >= 65.5 && z <= 138.5) {
        return 0;
      }
      return null;
    },

    isInsideInterior: (pos: THREE.Vector3) => {
      const inTerminal =
        pos.x > -85.8 && pos.x < -70.2 && pos.z > 71.2 && pos.z < 82.8 && pos.y < 5.2;
      const inHangar =
        pos.x > -87.8 && pos.x < -71.2 && pos.z > 104.2 && pos.z < 120.8 && pos.y < 8.5;
      return inTerminal || inHangar;
    },

    isNearAirfieldLoot: (pos: THREE.Vector3) =>
      !lootTaken &&
      Math.hypot(pos.x - lootPos.x, pos.z - lootPos.z) < 2.6 &&
      pos.y < 2.5,

    takeAirfieldLoot: () => {
      lootTaken = true;
      lootGroup.visible = false;
    },

    isNearAirfieldCafe: (pos: THREE.Vector3) =>
      Math.hypot(pos.x - -74.2, pos.z - 75.5) < 2.3 && pos.y < 2.5,

    update: (elapsed: number, playerPos?: THREE.Vector3) => {
      // Skip distant animations when player is far north/east
      if (playerPos && (playerPos.z < 15 || playerPos.x > 10)) return;

      // Rotate ATC Lattice Radar Dish & Dual-Lens Airport Beacon
      radarGroup.rotation.y = elapsed * 1.15;
      beaconHead.rotation.y = elapsed * 2.1;

      // Gently flutter aviation windsock in coastal breeze
      windsockPivot.rotation.y = 0.45 + Math.sin(elapsed * 1.4) * 0.18;
      windsockPivot.rotation.z = Math.sin(elapsed * 3.8) * 0.08;

      // Idling King Air '86 twin propellers
      for (let i = 0; i < kingAir.propellers.length; i++) {
        kingAir.propellers[i].rotation.z = elapsed * (11.5 + i * 0.4);
      }

      // Sequenced runway approach "rabbit" strobes firing northward toward touchdown
      const activeIdx = Math.floor(elapsed * 7.5) % rabbitStrobes.length;
      for (let i = 0; i < rabbitStrobes.length; i++) {
        rabbitStrobes[i].mat.emissiveIntensity = i === activeIdx ? 3.5 : 0.35;
      }

      // Pulse Hangar 06 Smuggler Stash ring
      if (!lootTaken) {
        const s = 1 + Math.sin(elapsed * 4.2) * 0.08;
        lootBeaconRing.scale.set(s, s, 1);
      }

      // Orbit 5 colorful 80s suitcases around Terminal 1 Baggage Claim Carousel
      for (let i = 0; i < carouselBags.length; i++) {
        const b = carouselBags[i];
        const a = elapsed * 0.75 + b.phase;
        b.mesh.position.set(
          carouselX + Math.cos(a) * 1.15,
          0.92,
          carouselZ + Math.sin(a) * 0.56,
        );
        b.mesh.rotation.y = -a;
      }
    },
  };
}
