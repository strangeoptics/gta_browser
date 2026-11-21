import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import './style.css';
import { PlayerController } from './player/PlayerController';
import { buildMiamiCity } from './world/CityBuilder';
import { WeaponSystem } from './combat/WeaponSystem';
import { createRangeProps } from './combat/RangeProps';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const coordsEl = document.getElementById('coords') as HTMLDivElement;
const stateLineEl = document.getElementById('state-line') as HTMLDivElement;

// Weapon HUD elements
const crosshairEl = document.getElementById('crosshair') as HTMLDivElement;
const hitmarkerEl = document.getElementById('hitmarker') as HTMLDivElement;
const weaponNameEl = document.getElementById('weapon-name') as HTMLDivElement;
const ammoCurrentEl = document.getElementById('ammo-current') as HTMLSpanElement;
const ammoMaxEl = document.getElementById('ammo-max') as HTMLSpanElement;
const reloadBarEl = document.getElementById('reload-bar') as HTMLDivElement;
const reloadFillEl = document.getElementById('reload-fill') as HTMLDivElement;
const slotEls = [
  document.getElementById('slot-1') as HTMLSpanElement,
  document.getElementById('slot-2') as HTMLSpanElement,
  document.getElementById('slot-3') as HTMLSpanElement,
];

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

// Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 420);

// Post-Processing (Neon & Sunset Bloom)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,
  0.48,
  0.86,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// World (Phase 2: 3x3 Miami Coastal District + Ocean Drive)
const world = buildMiamiCity(scene, renderer);

// Combat (Phase 3: Weapons & Shootable Range Targets)
const weapons = new WeaponSystem(scene, camera);
const rangeProps = createRangeProps(scene);

// Player Controller — spawn on Ocean Drive
const player = new PlayerController(camera, canvas);
const b = world.layout.playableBounds;
player.setWorldBounds(b.minX, b.maxX, b.minZ, b.maxZ);
player.setSpawn(60, 0.2, 26, 0.15);

let pointerLockFallback = false;

function requestLockSafely(): void {
  try {
    const maybePromise = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {
        pointerLockFallback = true;
      });
    }
  } catch {
    pointerLockFallback = true;
  }
}

function startGame(): void {
  overlay.classList.add('hidden');
  player.setActive(true);
  requestLockSafely();
}

function pauseGame(): void {
  player.setActive(false);
  overlay.classList.remove('hidden');
}

playBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

canvas.addEventListener('click', () => {
  if (player.getIsActive() && !player.getIsLocked()) {
    requestLockSafely();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    pointerLockFallback = false;
    overlay.classList.add('hidden');
    player.setActive(true);
  } else if (!pointerLockFallback) {
    pauseGame();
  }
});

document.addEventListener('pointerlockerror', () => {
  pointerLockFallback = true;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && player.getIsActive() && !player.getIsLocked()) {
    pauseGame();
  }
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
});

// Main Loop
let lastTime = performance.now();
const startTime = lastTime;

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = (now - lastTime) / 1000;
  const elapsed = (now - startTime) / 1000;
  lastTime = now;

  const status = player.update(dt, world.colliders);
  world.update(elapsed, dt);
  rangeProps.update(dt, elapsed);

  const wHud = weapons.update(
    dt,
    player.getIsActive(),
    status.speed,
    world.worldMeshes,
    rangeProps.getActiveTargets(),
  );

  // Update Weapon HUD
  weaponNameEl.textContent = wHud.name;
  ammoCurrentEl.textContent = wHud.reloading ? 'RLD' : String(wHud.ammo);
  ammoMaxEl.textContent = `/ ${wHud.magSize}`;
  reloadBarEl.classList.toggle('visible', wHud.reloading);
  reloadFillEl.style.width = `${Math.round(wHud.reloadProgress * 100)}%`;

  slotEls.forEach((el, idx) => {
    el.classList.toggle('active', idx === wHud.slotIndex);
  });

  crosshairEl.style.width = `${wHud.spreadPx}px`;
  crosshairEl.style.height = `${wHud.spreadPx}px`;
  crosshairEl.style.opacity = wHud.ads ? '0.45' : '0.88';

  hitmarkerEl.style.opacity = String(wHud.hitmarkerAlpha);
  hitmarkerEl.classList.toggle('kill', wHud.hitmarkerKill && wHud.hitmarkerAlpha > 0.05);

  // Update debug HUD
  coordsEl.textContent = `POS: ${status.x.toFixed(1)}, ${status.y.toFixed(1)}, ${status.z.toFixed(1)} | ${status.speed.toFixed(1)} m/s`;
  const flags: string[] = [];
  if (status.grounded) flags.push('GROUND');
  else flags.push('AIR');
  if (status.sprinting) flags.push('SPRINT');
  if (status.crouching) flags.push('CROUCH');
  if (wHud.ads) flags.push('ADS');
  if (player.getIsActive() && !player.getIsLocked()) {
    flags.push('DRAG/ARROWS LOOK');
  }
  stateLineEl.textContent = flags.join(' · ');

  composer.render();
}

requestAnimationFrame(animate);
