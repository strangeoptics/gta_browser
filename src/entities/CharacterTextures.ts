import * as THREE from 'three';
import type { NpcRole } from './NpcSystem';

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Generates a stylized 128x128 Vice-City-style face texture (eyes or 80s sunglasses,
 * eyebrows, nose shading, mouth, optional mustache).
 */
export function getFaceTexture(
  skinColor: string,
  sunglasses: boolean,
  mustache: boolean,
): THREE.CanvasTexture {
  const key = `face:${skinColor}:${sunglasses}:${mustache}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base skin with subtle warm dusk shading
  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, size, size);

  const cheekGrad = ctx.createLinearGradient(0, 0, 0, size);
  cheekGrad.addColorStop(0, 'rgba(255, 220, 190, 0.14)');
  cheekGrad.addColorStop(1, 'rgba(40, 16, 30, 0.2)');
  ctx.fillStyle = cheekGrad;
  ctx.fillRect(0, 0, size, size);

  // Eyebrows
  ctx.fillStyle = '#2a1d1f';
  ctx.fillRect(22, 34, 28, 6);
  ctx.fillRect(78, 34, 28, 6);

  if (sunglasses) {
    // 80s Aviator / Wayfarer dark frames
    ctx.fillStyle = '#140f1c';
    ctx.fillRect(14, 42, 44, 26);
    ctx.fillRect(70, 42, 44, 26);
    ctx.fillRect(56, 48, 16, 6);

    // Pink-cyan sunset reflection lenses
    const lensGrad = ctx.createLinearGradient(0, 44, 0, 66);
    lensGrad.addColorStop(0, '#36f1e6');
    lensGrad.addColorStop(0.5, '#2b1b42');
    lensGrad.addColorStop(1, '#ff4fa3');
    ctx.fillStyle = lensGrad;
    ctx.fillRect(18, 46, 36, 18);
    ctx.fillRect(74, 46, 36, 18);

    // Specular glint stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(22, 48, 12, 4);
    ctx.fillRect(78, 48, 12, 4);
  } else {
    // Stylized eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 46, 22, 12);
    ctx.fillRect(82, 46, 22, 12);
    ctx.fillStyle = '#1e1624';
    ctx.fillRect(32, 48, 9, 9);
    ctx.fillRect(88, 48, 9, 9);
  }

  // Nose bridge shadow
  ctx.fillStyle = 'rgba(80, 38, 34, 0.28)';
  ctx.fillRect(59, 58, 10, 20);

  // Optional 80s mustache
  if (mustache) {
    ctx.fillStyle = '#2d1c1b';
    ctx.fillRect(42, 82, 44, 9);
  }

  // Mouth
  ctx.fillStyle = '#8b3e46';
  ctx.fillRect(46, 94, 36, 7);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a stylized 128x128 torso outfit texture:
 * - Civilian: Hawaiian tropical print OR open pastel blazer over white tee
 * - Police: Vice PD uniform with collar, button placket, pockets & gold badge
 * - Bounty: Crisp white Miami Vice suit with hot-pink open shirt & gold chain
 */
export function getOutfitTexture(
  role: NpcRole,
  primaryColor: string,
  accentColor: string,
  variant: number,
): THREE.CanvasTexture {
  const key = `outfit:${role}:${primaryColor}:${accentColor}:${variant}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, size, size);

  if (role === 'police') {
    // Center button placket & dark tie
    ctx.fillStyle = '#131d36';
    ctx.fillRect(58, 12, 12, size - 12);
    ctx.fillStyle = '#243b6b';
    ctx.fillRect(14, 34, 34, 30);
    ctx.fillRect(80, 34, 34, 30);
    ctx.strokeStyle = '#0e1629';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 34, 34, 30);
    ctx.strokeRect(80, 34, 34, 30);

    // Gold Vice PD badge on left chest
    ctx.fillStyle = '#ffd15c';
    ctx.beginPath();
    ctx.arc(96, 26, 9, 0, Math.PI * 2);
    ctx.fill();

    // Collar V
    ctx.fillStyle = '#e8edf5';
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.lineTo(64, 22);
    ctx.lineTo(82, 0);
    ctx.closePath();
    ctx.fill();
  } else if (role === 'bounty') {
    // White Miami Vice suit jacket with open hot-pink V-shirt
    ctx.fillStyle = '#f5f0eb';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.moveTo(36, 0);
    ctx.lineTo(92, 0);
    ctx.lineTo(74, size);
    ctx.lineTo(54, size);
    ctx.closePath();
    ctx.fill();

    // Jacket lapels
    ctx.strokeStyle = '#d4c8c0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(54, size);
    ctx.moveTo(94, 0);
    ctx.lineTo(74, size);
    ctx.stroke();

    // Gold chain
    ctx.strokeStyle = '#ffd15c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 14, 16, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (variant % 2 === 0) {
    // Open pastel blazer over crisp white Miami tee
    ctx.fillStyle = '#fff7f0';
    ctx.fillRect(42, 0, 44, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(42, size);
    ctx.moveTo(86, 0);
    ctx.lineTo(86, size);
    ctx.stroke();
    // Subtle retro chest stripe on tee
    ctx.fillStyle = accentColor;
    ctx.fillRect(44, 38, 40, 10);
  } else {
    // Tropical Hawaiian palm-leaf print shirt
    ctx.fillStyle = accentColor;
    for (let y = 14; y < size; y += 28) {
      for (let x = 14; x < size; x += 30) {
        const ox = y % 56 === 14 ? 0 : 14;
        ctx.beginPath();
        ctx.ellipse(x + ox, y, 10, 4, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + ox, y, 10, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Shirt buttons
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let y = 18; y < size; y += 22) {
      ctx.fillRect(62, y, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generates a matching 128x128 back-of-torso outfit texture so backs never show
 * front buttons, ties, lapels, or chest badges!
 */
export function getOutfitBackTexture(
  role: NpcRole,
  primaryColor: string,
  accentColor: string,
  variant: number,
): THREE.CanvasTexture {
  const key = `outfit-back:${role}:${primaryColor}:${accentColor}:${variant}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = role === 'bounty' ? '#f5f0eb' : primaryColor;
  ctx.fillRect(0, 0, size, size);

  if (role === 'police') {
    // Subtle yoke seam + bold gold "VICE PD" across the upper back
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 20, size, 3);
    ctx.fillRect(62, 22, 4, size - 22);
    ctx.fillStyle = '#ffd15c';
    ctx.font = '900 22px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VICE PD', 64, 52);
  } else if (role === 'bounty' || variant % 2 === 0) {
    // Tailored 80s blazer back: subtle shoulder yoke, center back seam & lower vent
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, size, 16);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 14);
    ctx.lineTo(64, size);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(62, size - 26, 4, 26);
  } else {
    // Tropical Hawaiian palm-leaf print continuing across the back (no front buttons!)
    ctx.fillStyle = accentColor;
    for (let y = 14; y < size; y += 28) {
      for (let x = 14; x < size; x += 30) {
        const ox = y % 56 === 14 ? 0 : 14;
        ctx.beginPath();
        ctx.ellipse(x + ox, y, 10, 4, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + ox, y, 10, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 16, size, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Combines front outfit (top-left 128x128), back outfit (top-right 128x128),
 * and solid side/sleeve color (bottom 256x128) into a single cached 256x256 CanvasTexture
 * so character torsos render in 1 draw call instead of 3!
 */
export function getCombinedTorsoTexture(
  role: NpcRole,
  primaryColor: string,
  accentColor: string,
  variant: number,
): THREE.CanvasTexture {
  const frontRole: NpcRole = role === 'guard' ? 'bounty' : role;
  const key = `torso-atlas:${role}:${primaryColor}:${accentColor}:${variant}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const frontTex = getOutfitTexture(frontRole, primaryColor, accentColor, variant);
  const backTex = getOutfitBackTexture(role, primaryColor, accentColor, variant);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = role === 'bounty' ? '#f5f0eb' : primaryColor;
  ctx.fillRect(0, 0, 256, 256);

  ctx.drawImage(frontTex.image as HTMLCanvasElement, 0, 0, 128, 128);
  ctx.drawImage(backTex.image as HTMLCanvasElement, 128, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}
