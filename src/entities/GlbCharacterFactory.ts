import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { NpcRole } from './NpcSystem';
import { getPlayerGlbOutfitTexture, type PlayerGlbOutfitStyle } from './CharacterTextures';

export type CharacterBuildType = 'average' | 'slim' | 'tall-lean' | 'muscular' | 'heavy' | 'stocky';

export type GlbAnimKey = 'idle' | 'walk' | 'run' | 'jump' | 'runJump' | 'slash' | 'death' | 'clap' | 'sit';

export interface GlbCharacterMaterials {
  shirt: THREE.MeshStandardMaterial | null;
  pants: THREE.MeshStandardMaterial | null;
  socks: THREE.MeshStandardMaterial | null;
  skin: THREE.MeshStandardMaterial | null;
  hair: THREE.MeshStandardMaterial | null;
}

export interface GlbCharacterInstance {
  model: THREE.Object3D;
  uniformScale: number;
  mixer: THREE.AnimationMixer;
  actions: Map<GlbAnimKey, THREE.AnimationAction>;
  materials: GlbCharacterMaterials;
  headBone: THREE.Object3D | null;
  neckBone: THREE.Object3D | null;
  torsoBone: THREE.Object3D | null;
  upperArmR: THREE.Object3D | null;
  lowerArmR: THREE.Object3D | null;
  upperArmL: THREE.Object3D | null;
  lowerArmL: THREE.Object3D | null;
  upperLegL: THREE.Object3D | null;
  upperLegR: THREE.Object3D | null;
  lowerLegL: THREE.Object3D | null;
  lowerLegR: THREE.Object3D | null;
  rightHandBone: THREE.Object3D | null;
  meshes: THREE.Mesh[];
  playAnim: (key: GlbAnimKey, fadeDuration?: number) => void;
  getCurrentAnim: () => GlbAnimKey | null;
  attachToBone: (bone: THREE.Object3D, worldPos: THREE.Vector3, accessory: THREE.Object3D) => void;
}

export interface GlbNpcStyleOptions {
  role: NpcRole;
  build: CharacterBuildType;
  skinColor: string;
  hairColor: string;
  outfitStyle: PlayerGlbOutfitStyle;
  primaryColor: string;
  accentColor: string;
  pantsColor: string;
  shoeColor: string;
  wearsSunglasses: boolean;
  policeCap?: boolean;
  goldChain?: boolean;
  coastalCap?: boolean;
  withHalo?: boolean;
}

interface CachedGlbTemplate {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  uniformScale: number;
  groundOffsetY: number;
}

let cachedTemplate: CachedGlbTemplate | null = null;
let loadStarted = false;
const readyQueue: Array<(tpl: CachedGlbTemplate) => void> = [];

/**
 * Generates seamless per-triangle UVs on the Quaternius Shirt SkinnedMesh ONCE on the
 * cached template so every cloned character shares the exact same UV-mapped BufferGeometry.
 */
function assignShirtOutfitUVs(mesh: THREE.Mesh): void {
  const nonIndexed = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = nonIndexed.getAttribute('position');
  if (!pos) return;

  const uvs = new Float32Array(pos.count * 2);
  const torsoHalfX = 0.0041;
  const zMin = 0.0248;
  const zSpan = 0.0405 - zMin;

  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;

    const isSleeve = Math.abs(cx) > torsoHalfX;
    const isFront = cy <= 0.0002;

    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      const vNorm = THREE.MathUtils.clamp((z - zMin) / zSpan, 0, 1);

      let u: number;
      let v: number;
      if (isSleeve) {
        const sleeveFrac = THREE.MathUtils.clamp((Math.abs(x) - torsoHalfX) / 0.0046, 0, 1);
        u = THREE.MathUtils.clamp((y + 0.0035) / 0.0075, 0.02, 0.98);
        v = 0.46 - sleeveFrac * 0.44;
      } else if (isFront) {
        const xNorm = THREE.MathUtils.clamp((x + torsoHalfX) / (torsoHalfX * 2), 0, 1);
        u = 0.02 + xNorm * 0.46;
        v = 0.52 + vNorm * 0.46;
      } else {
        const xNorm = THREE.MathUtils.clamp((torsoHalfX - x) / (torsoHalfX * 2), 0, 1);
        u = 0.52 + xNorm * 0.46;
        v = 0.52 + vNorm * 0.46;
      }

      uvs[vi * 2] = u;
      uvs[vi * 2 + 1] = v;
    }
  }

  nonIndexed.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  mesh.geometry = nonIndexed;
}

/**
 * Loads `public/models/player_man.glb` once and invokes `cb` immediately when ready.
 */
export function whenGlbCharacterReady(cb: (tpl: CachedGlbTemplate) => void): void {
  if (cachedTemplate) {
    cb(cachedTemplate);
    return;
  }
  readyQueue.push(cb);
  if (loadStarted) return;
  loadStarted = true;

  const loader = new GLTFLoader();
  loader.load(
    './models/player_man.glb',
    (gltf) => {
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(scene);
      const rawSize = new THREE.Vector3();
      rawBox.getSize(rawSize);

      const targetHeight = 1.82;
      const uniformScale = rawSize.y > 0.01 ? targetHeight / rawSize.y : 0.376;
      scene.scale.setScalar(uniformScale);
      scene.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(scene);
      const groundOffsetY = -scaledBox.min.y;
      scene.position.y = groundOffsetY;

      // Generate procedural Shirt UVs ONCE on the template geometry
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          if (mats.some((m) => m instanceof THREE.MeshStandardMaterial && m.name === 'Shirt')) {
            assignShirtOutfitUVs(obj);
          }
        }
      });

      cachedTemplate = {
        scene,
        animations: gltf.animations,
        uniformScale,
        groundOffsetY,
      };

      while (readyQueue.length > 0) {
        const fn = readyQueue.shift()!;
        fn(cachedTemplate);
      }
    },
    undefined,
    (err) => {
      console.warn('[GlbCharacterFactory] Failed to load ./models/player_man.glb:', err);
    },
  );
}

/**
 * Applies anatomically balanced body-build proportions (slim, tall-lean, muscular,
 * heavy, stocky, average) using root + non-animated bone scales while counter-scaling
 * the neck/head so head proportions always stay natural!
 */
export function applyCharacterBodyBuild(model: THREE.Object3D, uniformScale: number, build: CharacterBuildType): void {
  const hips = model.getObjectByName('Hips');
  const abdomen = model.getObjectByName('Abdomen');
  const torso = model.getObjectByName('Torso');
  const neck = model.getObjectByName('Neck');
  const upperArmL = model.getObjectByName('UpperArm.L');
  const upperArmR = model.getObjectByName('UpperArm.R');
  const upperLegL = model.getObjectByName('UpperLeg.L');
  const upperLegR = model.getObjectByName('UpperLeg.R');

  let sx = 1.0;
  let sy = 1.0;
  let sz = 1.0;
  let hipsS: [number, number, number] = [1, 1, 1];
  let abdS: [number, number, number] = [1, 1, 1];
  let torsoS: [number, number, number] = [1, 1, 1];
  let armS: [number, number, number] = [1, 1, 1];
  let legS: [number, number, number] = [1, 1, 1];

  switch (build) {
    case 'slim':
      sx = 0.87;
      sy = 1.01;
      sz = 0.88;
      abdS = [0.93, 1.0, 0.92];
      torsoS = [0.95, 1.0, 0.94];
      break;
    case 'tall-lean':
      sx = 0.89;
      sy = 1.08;
      sz = 0.89;
      abdS = [0.94, 1.0, 0.93];
      break;
    case 'muscular':
      sx = 1.04;
      sy = 1.03;
      sz = 1.04;
      abdS = [0.92, 1.0, 0.95];
      torsoS = [1.22, 1.0, 1.18];
      armS = [1.2, 1.0, 1.2];
      legS = [1.08, 1.0, 1.08];
      break;
    case 'heavy':
      sx = 1.08;
      sy = 0.97;
      sz = 1.12;
      hipsS = [1.14, 1.0, 1.18];
      abdS = [1.2, 1.0, 1.32];
      torsoS = [1.06, 1.0, 1.12];
      armS = [1.12, 1.0, 1.12];
      legS = [1.12, 1.0, 1.14];
      break;
    case 'stocky':
      sx = 1.11;
      sy = 0.92;
      sz = 1.10;
      hipsS = [1.08, 1.0, 1.08];
      torsoS = [1.12, 1.0, 1.1];
      armS = [1.14, 1.0, 1.14];
      legS = [1.1, 1.0, 1.1];
      break;
    case 'average':
    default:
      break;
  }

  model.scale.set(uniformScale * sx, uniformScale * sy, uniformScale * sz);
  if (hips) hips.scale.set(hipsS[0], hipsS[1], hipsS[2]);
  if (abdomen) abdomen.scale.set(abdS[0], abdS[1], abdS[2]);
  if (torso) torso.scale.set(torsoS[0], torsoS[1], torsoS[2]);
  if (upperArmL) upperArmL.scale.set(armS[0], armS[1], armS[2]);
  if (upperArmR) upperArmR.scale.set(armS[0], armS[1], armS[2]);
  if (upperLegL) upperLegL.scale.set(legS[0], legS[1], legS[2]);
  if (upperLegR) upperLegR.scale.set(legS[0], legS[1], legS[2]);

  // Counter-scale Neck so the head never looks overly wide, thin, or ballooned
  if (neck) {
    const cumX = sx * hipsS[0] * abdS[0] * torsoS[0];
    const cumY = sy * hipsS[1] * abdS[1] * torsoS[1];
    const cumZ = sz * hipsS[2] * abdS[2] * torsoS[2];
    // Blend 80% toward neutral 1.0 so heavy/slim builds still have subtly fitting head mass
    const targetX = THREE.MathUtils.lerp(1.0, 1.0 / cumX, 0.82);
    const targetY = THREE.MathUtils.lerp(1.0, 1.0 / cumY, 0.7);
    const targetZ = THREE.MathUtils.lerp(1.0, 1.0 / cumZ, 0.82);
    neck.scale.set(targetX, targetY, targetZ);
  }
}

/**
 * Instantiates a rigged clone of the cached Quaternius GLB with independent materials,
 * AnimationMixer, and helper methods for bone-mounted accessories & animations.
 */
export function instantiateGlbCharacter(
  tpl: CachedGlbTemplate,
  build: CharacterBuildType = 'average',
): GlbCharacterInstance {
  const model = SkeletonUtils.clone(tpl.scene);
  model.position.y = tpl.groundOffsetY;
  applyCharacterBodyBuild(model, tpl.uniformScale, build);

  const materials: GlbCharacterMaterials = {
    shirt: null,
    pants: null,
    socks: null,
    skin: null,
    hair: null,
  };
  const meshes: THREE.Mesh[] = [];

  model.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj instanceof THREE.SkinnedMesh) {
        obj.frustumCulled = false;
      }
      meshes.push(obj);

      // Clone materials per character so each NPC/Player has independent outfit & skin colors
      const cloneMat = (m: THREE.Material): THREE.Material => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return m;
        const cloned = m.clone();
        cloned.flatShading = true;
        cloned.roughness = Math.max(cloned.roughness, 0.58);
        cloned.needsUpdate = true;
        if (cloned.name === 'Shirt') materials.shirt = cloned;
        else if (cloned.name === 'Pants') materials.pants = cloned;
        else if (cloned.name === 'Socks') materials.socks = cloned;
        else if (cloned.name === 'Skin') materials.skin = cloned;
        else if (cloned.name === 'Hair') materials.hair = cloned;
        return cloned;
      };

      obj.material = Array.isArray(obj.material) ? obj.material.map(cloneMat) : cloneMat(obj.material);
    }
  });

  // Setup AnimationMixer & map built-in Quaternius clips
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<GlbAnimKey, THREE.AnimationAction>();
  const clipLookup: Record<GlbAnimKey, string> = {
    idle: 'HumanArmature|Man_Idle',
    walk: 'HumanArmature|Man_Walk',
    run: 'HumanArmature|Man_Run',
    jump: 'HumanArmature|Man_Jump',
    runJump: 'HumanArmature|Man_RunningJump',
    slash: 'HumanArmature|Man_SwordSlash',
    death: 'HumanArmature|Man_Death',
    clap: 'HumanArmature|Man_Clapping',
    sit: 'HumanArmature|Man_Sitting',
  };

  for (const [key, clipName] of Object.entries(clipLookup) as [GlbAnimKey, string][]) {
    const clip = tpl.animations.find((c) => c.name === clipName);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    if (key === 'jump' || key === 'runJump' || key === 'death') {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions.set(key, action);
  }

  let currentAnim: GlbAnimKey | null = null;
  const playAnim = (key: GlbAnimKey, fadeDuration = 0.16) => {
    if (currentAnim === key) return;
    const next = actions.get(key);
    if (!next) return;
    const prev = currentAnim ? actions.get(currentAnim) : undefined;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fadeDuration > 0) {
      prev.crossFadeTo(next, fadeDuration, false);
    } else if (prev) {
      prev.stop();
    }
    currentAnim = key;
  };

  const headBone = model.getObjectByName('Head') ?? null;
  const neckBone = model.getObjectByName('Neck') ?? null;
  const torsoBone = model.getObjectByName('Torso') ?? null;
  const upperArmR = model.getObjectByName('UpperArm.R') ?? null;
  const lowerArmR = model.getObjectByName('LowerArm.R') ?? null;
  const upperArmL = model.getObjectByName('UpperArm.L') ?? null;
  const lowerArmL = model.getObjectByName('LowerArm.L') ?? null;
  const upperLegL = model.getObjectByName('UpperLeg.L') ?? null;
  const upperLegR = model.getObjectByName('UpperLeg.R') ?? null;
  const lowerLegL = model.getObjectByName('LowerLeg.L') ?? null;
  const lowerLegR = model.getObjectByName('LowerLeg.R') ?? null;
  const rightHandBone =
    model.getObjectByName('MiddleHand.R') ??
    model.getObjectByName('Palm.R') ??
    model.getObjectByName('LowerArm.R') ??
    null;

  const attachToBone = (bone: THREE.Object3D, worldPos: THREE.Vector3, accessory: THREE.Object3D) => {
    model.updateMatrixWorld(true);
    const localPos = worldPos.clone();
    bone.worldToLocal(localPos);

    const boneWorldQuat = new THREE.Quaternion();
    bone.getWorldQuaternion(boneWorldQuat);

    const boneWorldScale = new THREE.Vector3();
    bone.getWorldScale(boneWorldScale);

    const wrapper = new THREE.Group();
    wrapper.position.copy(localPos);
    wrapper.quaternion.copy(boneWorldQuat).invert();
    wrapper.scale.set(
      1 / Math.max(boneWorldScale.x, 0.0001),
      1 / Math.max(boneWorldScale.y, 0.0001),
      1 / Math.max(boneWorldScale.z, 0.0001),
    );
    wrapper.add(accessory);
    bone.add(wrapper);
  };

  return {
    model,
    uniformScale: tpl.uniformScale,
    mixer,
    actions,
    materials,
    headBone,
    neckBone,
    torsoBone,
    upperArmR,
    lowerArmR,
    upperArmL,
    lowerArmL,
    upperLegL,
    upperLegR,
    lowerLegL,
    lowerLegR,
    rightHandBone,
    meshes,
    playAnim,
    getCurrentAnim: () => currentAnim,
    attachToBone,
  };
}

// ---------------------------------------------------------------------------
// Shared Accessory Builders (80s Sunglasses, Vice PD Cap, Coastal Cap, Gold Chain)
// ---------------------------------------------------------------------------

let sharedAccMats: {
  frame: THREE.MeshStandardMaterial;
  lens: THREE.MeshStandardMaterial;
  capDark: THREE.MeshStandardMaterial;
  capBrim: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
} | null = null;

function getAccMats() {
  if (sharedAccMats) return sharedAccMats;
  sharedAccMats = {
    frame: new THREE.MeshStandardMaterial({ color: '#14101c', roughness: 0.3, flatShading: true }),
    lens: new THREE.MeshStandardMaterial({
      color: '#20183a',
      emissive: '#2998b8',
      emissiveIntensity: 0.34,
      metalness: 0.85,
      roughness: 0.12,
      flatShading: true,
    }),
    capDark: new THREE.MeshStandardMaterial({ color: '#142447', roughness: 0.55, flatShading: true }),
    capBrim: new THREE.MeshStandardMaterial({ color: '#0d1018', roughness: 0.28, flatShading: true }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.88, roughness: 0.2, flatShading: true }),
  };
  return sharedAccMats;
}

export function createSunglassesMesh(): THREE.Group {
  const m = getAccMats();
  const shades = new THREE.Group();
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.014, 0.014), m.frame);
  bridge.position.set(0, 0.005, 0.004);
  shades.add(bridge);
  for (const side of [-1, 1] as const) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.044, 0.016), m.frame);
    frame.position.set(side * 0.048, 0, 0);
    frame.rotation.y = side * -0.14;
    shades.add(frame);

    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.033, 0.018), m.lens);
    lens.position.set(side * 0.048, 0, 0.002);
    lens.rotation.y = side * -0.14;
    shades.add(lens);

    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.12), m.frame);
    temple.position.set(side * 0.092, 0.008, -0.06);
    shades.add(temple);
  }
  return shades;
}

export function createPoliceCapMesh(): THREE.Group {
  const m = getAccMats();
  const cap = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.09, 8), m.capDark);
  crown.position.set(0, 0.045, 0);
  cap.add(crown);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.026, 8), m.capBrim);
  band.position.set(0, 0.01, 0);
  cap.add(band);

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.128, 0.016, 8, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
    m.capBrim,
  );
  brim.position.set(0, 0.003, 0.052);
  brim.rotation.x = 0.16;
  cap.add(brim);

  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), m.gold);
  emblem.scale.set(1, 1.1, 0.4);
  emblem.position.set(0, 0.042, 0.128);
  cap.add(emblem);
  return cap;
}

export function createCoastalCapMesh(color: string): THREE.Group {
  const capMat = new THREE.MeshStandardMaterial({ color, roughness: 0.58, flatShading: true });
  const cap = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.126, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
  dome.scale.set(1.0, 0.88, 1.08);
  cap.add(dome);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.015, 0.11), capMat);
  visor.position.set(0, 0.008, 0.12);
  visor.rotation.x = 0.14;
  cap.add(visor);
  return cap;
}

export function createGoldChainMesh(): THREE.Group {
  const m = getAccMats();
  const group = new THREE.Group();
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.01, 5, 12, Math.PI), m.gold);
  chain.rotation.z = Math.PI;
  group.add(chain);
  return group;
}

/**
 * Applies full Vice Dusk 80s styling (skin, hair, UV-mapped outfit texture, pants, shoes,
 * sunglasses, caps, gold chain, bounty halo) to a cloned GLB character instance.
 */
export function styleGlbNpcInstance(inst: GlbCharacterInstance, opts: GlbNpcStyleOptions): void {
  if (inst.materials.skin) inst.materials.skin.color.set(opts.skinColor);
  if (inst.materials.hair) inst.materials.hair.color.set(opts.hairColor);
  if (inst.materials.pants) inst.materials.pants.color.set(opts.pantsColor);
  if (inst.materials.socks) inst.materials.socks.color.set(opts.shoeColor);
  if (inst.materials.shirt) {
    inst.materials.shirt.color.set('#ffffff');
    inst.materials.shirt.map = getPlayerGlbOutfitTexture(opts.outfitStyle, opts.primaryColor, opts.accentColor);
    inst.materials.shirt.needsUpdate = true;
  }

  // Height multiplier from body build so head/chest accessories land accurately
  const heightMult = inst.model.scale.y / inst.uniformScale;
  const depthMult = inst.model.scale.z / inst.uniformScale;

  if (inst.headBone) {
    if (opts.wearsSunglasses) {
      inst.attachToBone(
        inst.headBone,
        new THREE.Vector3(0, 1.655 * heightMult, 0.118 * depthMult),
        createSunglassesMesh(),
      );
    }
    if (opts.policeCap) {
      inst.attachToBone(
        inst.headBone,
        new THREE.Vector3(0, 1.755 * heightMult, -0.008 * depthMult),
        createPoliceCapMesh(),
      );
    } else if (opts.coastalCap) {
      inst.attachToBone(
        inst.headBone,
        new THREE.Vector3(0, 1.74 * heightMult, -0.004 * depthMult),
        createCoastalCapMesh(opts.accentColor),
      );
    }
    if (opts.withHalo) {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.032, 6, 14),
        new THREE.MeshBasicMaterial({ color: '#ff4fa3' }),
      );
      halo.rotation.x = Math.PI / 2;
      inst.attachToBone(inst.headBone, new THREE.Vector3(0, 2.08 * heightMult, 0), halo);
    }
  }

  if (inst.torsoBone && opts.goldChain) {
    inst.attachToBone(
      inst.torsoBone,
      new THREE.Vector3(0, 1.44 * heightMult, 0.125 * depthMult),
      createGoldChainMesh(),
    );
  }
}
