import * as THREE from 'three';
import './style.css';
import { PlayerController } from './player/PlayerController';
import { buildPhase1TestWorld } from './world/TestBlock';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const coordsEl = document.getElementById('coords') as HTMLDivElement;
const stateLineEl = document.getElementById('state-line') as HTMLDivElement;

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

// Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 350);

// World (Phase 1 Test Street)
const world = buildPhase1TestWorld(scene);

// Player Controller
const player = new PlayerController(camera, canvas);
player.setSpawn(0, 0.2, 22, 0);

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

// Clicking the canvas in fallback mode retries pointer lock
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
});

// Main Loop
let lastTime = performance.now();

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  const status = player.update(dt, world.colliders);

  coordsEl.textContent = `POS: ${status.x.toFixed(1)}, ${status.y.toFixed(1)}, ${status.z.toFixed(1)} | ${status.speed.toFixed(1)} m/s`;
  const flags: string[] = [];
  if (status.grounded) flags.push('GROUND');
  else flags.push('AIR');
  if (status.sprinting) flags.push('SPRINT');
  if (status.crouching) flags.push('CROUCH');
  if (player.getIsActive() && !player.getIsLocked()) {
    flags.push('DRAG/ARROWS LOOK');
  }
  stateLineEl.textContent = flags.join(' · ');

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
