import * as THREE from 'three';

const facadeTextureCache = new Map<string, { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture }>();
const neonSignTextureCache = new Map<string, THREE.CanvasTexture>();

function hash2D(x: number, y: number): number {
  let h = Math.imul((x * 4096) | 0, 374761393) + Math.imul((y * 4096) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Builds a `BoxGeometry(w, h, d)` whose index buffer is grouped into 2 draw calls instead of 6:
 * - Material group 0: all 4 vertical wall faces (+X, -X, +Z, -Z)
 * - Material group 1: top roof (+Y) and bottom (-Y) caps
 */
export function createBuildingBoxGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  const index = geo.getIndex();
  if (index) {
    const src = index.array;
    const reordered = new Uint16Array(36);
    // +X (0..5) and -X (6..11) walls
    for (let i = 0; i < 12; i++) reordered[i] = src[i];
    // +Z (24..29) and -Z (30..35) walls
    for (let i = 0; i < 12; i++) reordered[12 + i] = src[24 + i];
    // +Y (12..17) and -Y (18..23) roof/floor caps
    for (let i = 0; i < 12; i++) reordered[24 + i] = src[12 + i];
    geo.setIndex(new THREE.BufferAttribute(reordered, 1));
    geo.clearGroups();
    geo.addGroup(0, 24, 0);
    geo.addGroup(24, 12, 1);
  }
  return geo;
}

function smoothNoisePeriodic(x: number, y: number, period: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const y0 = ((iy % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash2D(x0, y0);
  const b = hash2D(x1, y0);
  const c = hash2D(x0, y1);
  const d = hash2D(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmPeriodic(x: number, y: number, basePeriod: number): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * smoothNoisePeriodic(x * freq, y * freq, basePeriod * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return v;
}

/**
 * Generates paired seamless wet-asphalt albedo and domain-warped organic puddle roughness maps.
 * Puddles have very low roughness (~0.04) with soft damp rims so they organically mirror sunset & neon.
 */
export function createWetAsphaltTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const aImg = aCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  const period = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;

      // Domain-warping bends blobs into irregular, organic post-rain puddle pools
      const warpX = (fbmPeriodic(u + 1.7, v + 3.1, period) - 0.5) * 1.85;
      const warpY = (fbmPeriodic(u + 4.3, v + 0.9, period) - 0.5) * 1.85;
      const puddleNoise = fbmPeriodic(u + warpX, v + warpY, period);

      // Fine mineral asphalt aggregate grain + subtle tire-track variation
      const grain = hash2D(x * 0.85, y * 0.85) * 18;
      const micro = smoothNoisePeriodic((x / size) * 24, (y / size) * 24, 24) * 10;

      // Organic soft-edged puddle mask with wet halo rim
      const dampRim = THREE.MathUtils.smoothstep(puddleNoise, 0.44, 0.56);
      const puddleCore = THREE.MathUtils.smoothstep(puddleNoise, 0.54, 0.62);

      // Darker wet tone inside puddles, damp charcoal rim, weathered asphalt outside
      const base = THREE.MathUtils.lerp(42, 18, dampRim * 0.55 + puddleCore * 0.45);
      const grainScale = 1 - puddleCore * 0.82;
      const r = Math.min(255, base + (grain + micro * 0.5) * grainScale + 3);
      const g = Math.min(255, base + (grain + micro * 0.5) * grainScale);
      const b = Math.min(255, base + (grain + micro * 0.5) * grainScale + 7);

      // Roughness: ~0.04 in mirror-like puddle core (~10/255), ~0.35 damp rim, ~0.62 dry-damp asphalt
      const dryRough = 148 + grain * 1.5;
      const rimRough = THREE.MathUtils.lerp(dryRough, 82, dampRim);
      const roughVal = Math.round(THREE.MathUtils.lerp(rimRough, 10, puddleCore));

      const idx = (y * size + x) * 4;
      aImg.data[idx] = r;
      aImg.data[idx + 1] = g;
      aImg.data[idx + 2] = b;
      aImg.data[idx + 3] = 255;

      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(7, 7);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(7, 7);

  return { map, roughnessMap };
}

/**
 * Generates sun-bleached concrete sidewalk tile texture with subtle post-rain sheen.
 */
export function createSidewalkTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c4b8ad';
  ctx.fillRect(0, 0, size, size);

  // Subtle noise & sun-bleaching
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 175 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgba(${v}, ${v - 8}, ${v - 14}, 0.25)`;
    ctx.fillRect(x, y, 3, 3);
  }

  // Paver grid lines
  ctx.strokeStyle = 'rgba(72, 58, 66, 0.35)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

/**
 * Generates an Art-Deco Miami pastel facade with warm dusk lit windows,
 * horizontal stucco banding, and ground-floor storefronts.
 */
export function createArtDecoFacadeTexture(
  baseColor: string,
  trimColor: string,
  seed: number,
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const normSeed = ((seed % 10) + 10) % 10;
  const cacheKey = `${baseColor}|${trimColor}|${normSeed}`;
  const cached = facadeTextureCache.get(cacheKey);
  if (cached) return cached;
  seed = normSeed;
  const w = 256;
  const h = 512;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = w;
  emCanvas.height = h;
  const emCtx = emCanvas.getContext('2d')!;
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, w, h);

  // Base sun-bleached stucco gradient (slightly darker damp bottom, sun-bleached upper)
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, baseColor);
  grad.addColorStop(0.85, baseColor);
  grad.addColorStop(1, '#7a6c72');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle stucco grain
  for (let i = 0; i < 1200; i++) {
    const gx = hash2D(i + seed, 1.3) * w;
    const gy = hash2D(i + seed, 7.9) * h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(60,30,50,0.05)';
    ctx.fillRect(gx, gy, 3, 2);
  }

  // Horizontal Art-Deco trim bands
  ctx.fillStyle = trimColor;
  ctx.fillRect(0, 12, w, 10);
  ctx.fillRect(0, 28, w, 4);
  ctx.fillRect(0, h - 98, w, 8);

  // Upper floor windows
  const cols = 4;
  const rows = 5;
  const padX = 20;
  const gapX = 14;
  const winW = (w - padX * 2 - gapX * (cols - 1)) / cols;
  const winH = 44;

  for (let r = 0; r < rows; r++) {
    const wy = 56 + r * 68;
    // Art-Deco eyebrow ledge above each row
    ctx.fillStyle = trimColor;
    ctx.fillRect(14, wy - 6, w - 28, 4);

    for (let c = 0; c < cols; c++) {
      const wx = padX + c * (winW + gapX);
      const roll = hash2D(c * 13 + seed, r * 29 + seed);

      // Window frame
      ctx.fillStyle = '#382a3d';
      ctx.fillRect(wx - 2, wy - 2, winW + 4, winH + 4);

      if (roll > 0.56) {
        // Warm amber or soft cyan interior dusk glow
        const warm = roll > 0.72;
        const glowColor = warm ? '#ffb86b' : '#7ae8e8';
        ctx.fillStyle = glowColor;
        ctx.fillRect(wx, wy, winW, winH);

        emCtx.fillStyle = warm ? '#ff9d47' : '#3adbd4';
        emCtx.fillRect(wx, wy, winW, winH);
      } else {
        // Dark dusk sky reflection glass
        const glassGrad = ctx.createLinearGradient(wx, wy, wx, wy + winH);
        glassGrad.addColorStop(0, '#3a294d');
        glassGrad.addColorStop(1, '#7a4566');
        ctx.fillStyle = glassGrad;
        ctx.fillRect(wx, wy, winW, winH);
      }

      // Mullion cross
      ctx.fillStyle = 'rgba(40, 26, 48, 0.55)';
      ctx.fillRect(wx + winW / 2 - 1, wy, 2, winH);
      ctx.fillRect(wx, wy + winH * 0.55, winW, 2);
    }
  }

  // Ground-floor storefronts (warm lit interior)
  for (let c = 0; c < 3; c++) {
    const sx = 18 + c * 78;
    const sy = h - 78;
    ctx.fillStyle = '#2d1f35';
    ctx.fillRect(sx - 2, sy - 2, 64, 66);
    ctx.fillStyle = '#ffd08a';
    ctx.fillRect(sx, sy, 60, 62);
    emCtx.fillStyle = '#ffaa55';
    emCtx.fillRect(sx + 2, sy + 2, 56, 54);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  const pair = { map, emissiveMap };
  facadeTextureCache.set(cacheKey, pair);
  return pair;
}

/**
 * Generates a glowing retro Miami neon hotel/club sign texture.
 */
export function createNeonSignTexture(text: string, neonColor: string): THREE.CanvasTexture {
  const cacheKey = `${text}|${neonColor}`;
  const cached = neonSignTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Dark retro backing board
  ctx.fillStyle = '#170d24';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Neon border
  ctx.strokeStyle = neonColor;
  ctx.lineWidth = 6;
  ctx.shadowColor = neonColor;
  ctx.shadowBlur = 18;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Neon lettering
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  neonSignTextureCache.set(cacheKey, tex);
  return tex;
}

/**
 * Generates paired beach sand albedo & roughness maps transitioning across U (west -> east):
 * - Upper dry Miami sand (warm light golden, rough ~0.92, subtle wind ripples)
 * - Wavy organic damp tide-line
 * - Wet reflective shoreline sand (darker rich tone, smooth ~0.10 so it mirrors the sunset!)
 */
export function createBeachSandTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 256;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = w;
  albedoCanvas.height = h;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rCtx = roughCanvas.getContext('2d')!;

  const aImg = aCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    // Periodic wavy tide-line along the shore
    const tideWave =
      Math.sin(v * Math.PI * 2 * 2) * 0.028 +
      Math.sin(v * Math.PI * 2 * 5 + 1.3) * 0.014;

    for (let x = 0; x < w; x++) {
      const u = x / w; // 0 = promenade edge (dry), 1 = underwater (wet)
      const grain = (hash2D(x * 1.1, y * 1.1) - 0.5) * 18;
      const ripple = Math.sin(u * 95 + Math.sin(v * Math.PI * 2 * 4) * 2.5) * 5;

      // Smooth transition from dry sand (u < 0.48) to wet reflective surf sand (u > 0.62)
      const wetFactor = THREE.MathUtils.smoothstep(u + tideWave, 0.46, 0.64);

      // Dry warm Miami sand (#d8b994) -> Wet darker reflective sand (#6b4f41)
      const dryR = 216 + grain + ripple;
      const dryG = 184 + grain * 0.9 + ripple * 0.8;
      const dryB = 148 + grain * 0.8 + ripple * 0.6;

      const wetR = 104 + grain * 0.45;
      const wetG = 78 + grain * 0.4;
      const wetB = 66 + grain * 0.4;

      const r = THREE.MathUtils.clamp(THREE.MathUtils.lerp(dryR, wetR, wetFactor), 0, 255);
      const g = THREE.MathUtils.clamp(THREE.MathUtils.lerp(dryG, wetG, wetFactor), 0, 255);
      const b = THREE.MathUtils.clamp(THREE.MathUtils.lerp(dryB, wetB, wetFactor), 0, 255);

      // Roughness: ~0.92 (235) on dry sand -> ~0.10 (26) on mirror-wet shoreline sand
      const roughVal = Math.round(
        THREE.MathUtils.clamp(THREE.MathUtils.lerp(236 + grain * 0.5, 24, wetFactor), 18, 250),
      );

      const idx = (y * w + x) * 4;
      aImg.data[idx] = r;
      aImg.data[idx + 1] = g;
      aImg.data[idx + 2] = b;
      aImg.data[idx + 3] = 255;

      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 6);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.ClampToEdgeWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1, 6);

  return { map, roughnessMap };
}
