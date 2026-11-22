import * as THREE from 'three';
import type { NpcRole } from './NpcSystem';
import { getCombinedTorsoTexture } from './CharacterTextures';

export type CharacterBodyType = 'male' | 'female' | 'muscular';
export type CharacterHairStyle =
  | 'pompadour'
  | 'feathered'
  | 'ponytail'
  | 'bob'
  | 'cap'
  | 'police'
  | 'rambo'
  | 'flattop'
  | 'mohawk';

export interface LowPolyCharacterOptions {
  role: NpcRole;
  bodyType: CharacterBodyType;
  skinColor: string;
  hairColor: string;
  primaryColor: string;
  accentColor: string;
  pantsColor: string;
  shoeColor: string;
  outfitVariant: number;
  hairStyle: CharacterHairStyle;
  wearsSunglasses: boolean;
  hasMustache: boolean;
  isShorts?: boolean;
  shortSleeves?: boolean;
  sleeveless?: boolean;
  dogTags?: boolean;
  mrTGoldChains?: boolean;
  fullBeard?: boolean;
  bikerJacket?: boolean;
  terminatorShades?: boolean;
  horseMask?: boolean;
  withHalo?: boolean;
  scale?: number;
}

export interface LowPolyCharacterRig {
  bodyRoot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftHandAnchor: THREE.Group;
  rightHandAnchor: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  materials: {
    torsoFront: THREE.MeshStandardMaterial;
    torsoBack: THREE.MeshStandardMaterial;
    sleeve: THREE.MeshStandardMaterial;
    pants: THREE.MeshStandardMaterial;
    skin: THREE.MeshStandardMaterial;
    hair: THREE.MeshStandardMaterial;
  };
}

// ---------------------------------------------------------------------------
// Cached Low-Poly Shared Geometries (built once, reused across all characters)
// ---------------------------------------------------------------------------

interface RingSpec {
  y: number;
  fx: number; // front half-width
  fz: number; // front Z
  sx: number; // side half-width
  sz: number; // side half-depth
  bx: number; // back half-width
  bz: number; // back Z (positive magnitude, negated for -Z)
}

function ringPoints(r: RingSpec): [number, number, number][] {
  return [
    [-r.fx, r.y, r.fz],   // 0: Front-Left
    [r.fx, r.y, r.fz],    // 1: Front-Right
    [r.sx, r.y, r.sz],    // 2: Right-Front
    [r.sx, r.y, -r.sz],   // 3: Right-Back
    [r.bx, r.y, -r.bz],   // 4: Back-Right
    [-r.bx, r.y, -r.bz],  // 5: Back-Left
    [-r.sx, r.y, -r.sz],  // 6: Left-Back
    [-r.sx, r.y, r.sz],   // 7: Left-Front
  ];
}

/**
 * Builds a faceted 8-sided sculpted torso BufferGeometry mapped onto a single 256x256 UV atlas
 * (top-left: front outfit, top-right: back outfit, bottom: solid side/sleeve color) -> 1 draw call!
 */
function createSculptedTorsoGeometry(bodyType: CharacterBodyType): THREE.BufferGeometry {
  const rings: RingSpec[] =
    bodyType === 'female'
      ? [
          { y: 0.0, fx: 0.11, fz: 0.095, sx: 0.145, sz: 0.055, bx: 0.11, bz: 0.095 },   // waist
          { y: 0.22, fx: 0.115, fz: 0.105, sx: 0.155, sz: 0.06, bx: 0.115, bz: 0.095 }, // lower rib
          { y: 0.38, fx: 0.145, fz: 0.135, sx: 0.195, sz: 0.072, bx: 0.135, bz: 0.105 }, // bust/chest
          { y: 0.52, fx: 0.155, fz: 0.105, sx: 0.205, sz: 0.065, bx: 0.15, bz: 0.10 },  // shoulders
        ]
      : [
          { y: 0.0, fx: 0.135, fz: 0.105, sx: 0.178, sz: 0.062, bx: 0.135, bz: 0.102 }, // waist
          { y: 0.22, fx: 0.155, fz: 0.12, sx: 0.205, sz: 0.072, bx: 0.15, bz: 0.112 },  // mid torso
          { y: 0.40, fx: 0.18, fz: 0.138, sx: 0.242, sz: 0.082, bx: 0.175, bz: 0.122 }, // broad chest
          { y: 0.53, fx: 0.185, fz: 0.118, sx: 0.248, sz: 0.075, bx: 0.18, bz: 0.112 }, // shoulders
        ];

  const totalH = rings[rings.length - 1].y;
  const pts = rings.map(ringPoints);

  const pos: number[] = [];
  const uv: number[] = [];

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    ua: [number, number],
    ub: [number, number],
    uc: [number, number],
  ) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };

  for (let r = 0; r < rings.length - 1; r++) {
    const t0 = rings[r].y / totalH;
    const t1 = rings[r + 1].y / totalH;
    const atlasV0 = 0.504 + t0 * 0.492;
    const atlasV1 = 0.504 + t1 * 0.492;
    const sideV0 = 0.08 + t0 * 0.34;
    const sideV1 = 0.08 + t1 * 0.34;

    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      const a = pts[r][i];
      const b = pts[r][next];
      const c = pts[r + 1][next];
      const d = pts[r + 1][i];

      if (i === 0) {
        // Front panel (+Z): top-left quadrant of 256x256 atlas
        pushTri(a, b, c, [0.004, atlasV0], [0.496, atlasV0], [0.496, atlasV1]);
        pushTri(a, c, d, [0.004, atlasV0], [0.496, atlasV1], [0.004, atlasV1]);
      } else if (i === 4) {
        // Back panel (-Z): top-right quadrant of 256x256 atlas
        pushTri(a, b, c, [0.504, atlasV0], [0.996, atlasV0], [0.996, atlasV1]);
        pushTri(a, c, d, [0.504, atlasV0], [0.996, atlasV1], [0.504, atlasV1]);
      } else {
        // Side bevels: bottom solid-color half of 256x256 atlas
        pushTri(a, b, c, [0.2, sideV0], [0.8, sideV0], [0.8, sideV1]);
        pushTri(a, c, d, [0.2, sideV0], [0.8, sideV1], [0.2, sideV1]);
      }
    }
  }

  // Top shoulder cap (+Y) and bottom waist cap (-Y) sample solid side color
  const topRing = pts[rings.length - 1];
  const topCenter: [number, number, number] = [0, totalH + 0.025, 0];
  const botRing = pts[0];
  const botCenter: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    pushTri(topCenter, topRing[i], topRing[next], [0.5, 0.25], [0.2, 0.4], [0.8, 0.4]);
    pushTri(botCenter, botRing[next], botRing[i], [0.5, 0.25], [0.8, 0.1], [0.2, 0.1]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a faceted 8-sided sculpted pelvis/hip mesh.
 */
function createPelvisGeometry(bodyType: CharacterBodyType): THREE.BufferGeometry {
  const rings: RingSpec[] =
    bodyType === 'female'
      ? [
          { y: 0.0, fx: 0.125, fz: 0.10, sx: 0.175, sz: 0.06, bx: 0.135, bz: 0.115 },
          { y: 0.09, fx: 0.135, fz: 0.108, sx: 0.19, sz: 0.066, bx: 0.145, bz: 0.12 },
          { y: 0.18, fx: 0.112, fz: 0.098, sx: 0.148, sz: 0.056, bx: 0.112, bz: 0.098 },
        ]
      : [
          { y: 0.0, fx: 0.135, fz: 0.10, sx: 0.178, sz: 0.06, bx: 0.135, bz: 0.102 },
          { y: 0.09, fx: 0.142, fz: 0.108, sx: 0.186, sz: 0.064, bx: 0.142, bz: 0.108 },
          { y: 0.18, fx: 0.138, fz: 0.105, sx: 0.18, sz: 0.062, bx: 0.138, bz: 0.104 },
        ];

  return buildLoftedOctagonGeometry(rings);
}

/**
 * Builds a faceted low-poly human head with distinct chin, jawline, cheekbones & cranium.
 */
function createSculptedHeadGeometry(bodyType: CharacterBodyType): THREE.BufferGeometry {
  const s = bodyType === 'female' ? 0.94 : 1.0;
  const rings: RingSpec[] = [
    { y: -0.13, fx: 0.042 * s, fz: 0.095 * s, sx: 0.065 * s, sz: 0.04 * s, bx: 0.05 * s, bz: 0.06 * s },    // chin
    { y: -0.075, fx: 0.068 * s, fz: 0.115 * s, sx: 0.098 * s, sz: 0.055 * s, bx: 0.078 * s, bz: 0.095 * s }, // jaw
    { y: 0.0, fx: 0.08 * s, fz: 0.122 * s, sx: 0.112 * s, sz: 0.062 * s, bx: 0.088 * s, bz: 0.115 * s },     // cheeks
    { y: 0.075, fx: 0.078 * s, fz: 0.118 * s, sx: 0.112 * s, sz: 0.065 * s, bx: 0.09 * s, bz: 0.12 * s },    // brow
    { y: 0.135, fx: 0.055 * s, fz: 0.082 * s, sx: 0.085 * s, sz: 0.048 * s, bx: 0.065 * s, bz: 0.095 * s },  // crown
  ];
  return buildLoftedOctagonGeometry(rings, 0.02);
}

function buildLoftedOctagonGeometry(rings: RingSpec[], topCapLift = 0): THREE.BufferGeometry {
  const pts = rings.map(ringPoints);
  const pos: number[] = [];

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };

  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      const a = pts[r][i];
      const b = pts[r][next];
      const c = pts[r + 1][next];
      const d = pts[r + 1][i];
      pushTri(a, b, c);
      pushTri(a, c, d);
    }
  }

  const topRing = pts[rings.length - 1];
  const topCenter: [number, number, number] = [0, rings[rings.length - 1].y + topCapLift, 0];
  const botRing = pts[0];
  const botCenter: [number, number, number] = [0, rings[0].y - topCapLift * 0.5, 0];
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    pushTri(topCenter, topRing[i], topRing[next]);
    pushTri(botCenter, botRing[next], botRing[i]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a low-poly sculpted shoe/sneaker with tapered toe box.
 */
function createShoeGeometry(): THREE.BufferGeometry {
  const rings: RingSpec[] = [
    { y: 0.0, fx: 0.048, fz: 0.145, sx: 0.068, sz: 0.065, bx: 0.052, bz: 0.088 },
    { y: 0.032, fx: 0.046, fz: 0.14, sx: 0.066, sz: 0.062, bx: 0.05, bz: 0.085 },
    { y: 0.072, fx: 0.04, fz: 0.095, sx: 0.058, sz: 0.045, bx: 0.048, bz: 0.078 },
    { y: 0.10, fx: 0.036, fz: 0.048, sx: 0.05, sz: 0.03, bx: 0.044, bz: 0.068 },
  ];
  return buildLoftedOctagonGeometry(rings);
}

interface SharedCharacterGeos {
  torsoMale: THREE.BufferGeometry;
  torsoFemale: THREE.BufferGeometry;
  pelvisMale: THREE.BufferGeometry;
  pelvisFemale: THREE.BufferGeometry;
  headMale: THREE.BufferGeometry;
  headFemale: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  nose: THREE.BufferGeometry;
  ear: THREE.BufferGeometry;
  upperArmMale: THREE.BufferGeometry;
  upperArmFemale: THREE.BufferGeometry;
  forearmMale: THREE.BufferGeometry;
  forearmFemale: THREE.BufferGeometry;
  shoulderJoint: THREE.BufferGeometry;
  elbowJoint: THREE.BufferGeometry;
  hand: THREE.BufferGeometry;
  thumb: THREE.BufferGeometry;
  thighMale: THREE.BufferGeometry;
  thighFemale: THREE.BufferGeometry;
  shinMale: THREE.BufferGeometry;
  shinFemale: THREE.BufferGeometry;
  kneeJoint: THREE.BufferGeometry;
  shoe: THREE.BufferGeometry;
  beltMale: THREE.BufferGeometry;
  beltFemale: THREE.BufferGeometry;
  beltBuckle: THREE.BufferGeometry;
  lapel: THREE.BufferGeometry;
  badge: THREE.BufferGeometry;
  chainGold: THREE.BufferGeometry;
  shadesBridge: THREE.BufferGeometry;
  shadesFrame: THREE.BufferGeometry;
  shadesLens: THREE.BufferGeometry;
  shadesTemple: THREE.BufferGeometry;
  eyeBox: THREE.BufferGeometry;
  pupilBox: THREE.BufferGeometry;
  browBox: THREE.BufferGeometry;
  mustacheBox: THREE.BufferGeometry;
  mouthBox: THREE.BufferGeometry;
  haloTorus: THREE.BufferGeometry;
  policeCrown: THREE.BufferGeometry;
  policeBand: THREE.BufferGeometry;
  policeBrim: THREE.BufferGeometry;
  policeEmblem: THREE.BufferGeometry;
  capDome: THREE.BufferGeometry;
  capVisor: THREE.BufferGeometry;
  hairCrown: THREE.BufferGeometry;
  hairBack: THREE.BufferGeometry;
  pompadourCrest: THREE.BufferGeometry;
  featheredWing: THREE.BufferGeometry;
  scrunchie: THREE.BufferGeometry;
  ponytailCone: THREE.BufferGeometry;
  bobLock: THREE.BufferGeometry;
  bobBack: THREE.BufferGeometry;
}

let cachedGeos: SharedCharacterGeos | null = null;

function getSharedGeos(): SharedCharacterGeos {
  if (cachedGeos) return cachedGeos;

  const makeBelt = (sx: number, fz: number) =>
    buildLoftedOctagonGeometry([
      { y: 0.0, fx: sx * 0.78, fz, sx, sz: fz * 0.6, bx: sx * 0.78, bz: fz },
      { y: 0.052, fx: sx * 0.78, fz, sx, sz: fz * 0.6, bx: sx * 0.78, bz: fz },
    ]);

  const shared: SharedCharacterGeos = {
    torsoMale: createSculptedTorsoGeometry('male'),
    torsoFemale: createSculptedTorsoGeometry('female'),
    pelvisMale: createPelvisGeometry('male'),
    pelvisFemale: createPelvisGeometry('female'),
    headMale: createSculptedHeadGeometry('male'),
    headFemale: createSculptedHeadGeometry('female'),
    neck: new THREE.CylinderGeometry(0.062, 0.076, 0.11, 6),
    nose: new THREE.ConeGeometry(0.022, 0.052, 4),
    ear: new THREE.DodecahedronGeometry(0.028, 0),
    upperArmMale: new THREE.CylinderGeometry(0.066, 0.054, 0.27, 6),
    upperArmFemale: new THREE.CylinderGeometry(0.054, 0.044, 0.25, 6),
    forearmMale: new THREE.CylinderGeometry(0.052, 0.04, 0.25, 6),
    forearmFemale: new THREE.CylinderGeometry(0.043, 0.033, 0.235, 6),
    shoulderJoint: new THREE.IcosahedronGeometry(0.066, 0),
    elbowJoint: new THREE.IcosahedronGeometry(0.048, 0),
    hand: new THREE.CylinderGeometry(0.038, 0.034, 0.088, 6),
    thumb: new THREE.BoxGeometry(0.024, 0.045, 0.028),
    thighMale: new THREE.CylinderGeometry(0.088, 0.066, 0.39, 6),
    thighFemale: new THREE.CylinderGeometry(0.084, 0.058, 0.38, 6),
    shinMale: new THREE.CylinderGeometry(0.064, 0.046, 0.37, 6),
    shinFemale: new THREE.CylinderGeometry(0.056, 0.039, 0.37, 6),
    kneeJoint: new THREE.IcosahedronGeometry(0.058, 0),
    shoe: createShoeGeometry(),
    beltMale: makeBelt(0.188, 0.114),
    beltFemale: makeBelt(0.156, 0.104),
    beltBuckle: new THREE.BoxGeometry(0.075, 0.055, 0.024),
    lapel: new THREE.BoxGeometry(0.055, 0.22, 0.025),
    badge: new THREE.OctahedronGeometry(0.028, 0),
    chainGold: new THREE.TorusGeometry(0.055, 0.009, 5, 10, Math.PI),
    shadesBridge: new THREE.BoxGeometry(0.036, 0.014, 0.016),
    shadesFrame: new THREE.BoxGeometry(0.072, 0.044, 0.016),
    shadesLens: new THREE.BoxGeometry(0.06, 0.033, 0.018),
    shadesTemple: new THREE.BoxGeometry(0.01, 0.012, 0.115),
    eyeBox: new THREE.BoxGeometry(0.036, 0.02, 0.012),
    pupilBox: new THREE.BoxGeometry(0.016, 0.016, 0.014),
    browBox: new THREE.BoxGeometry(0.044, 0.012, 0.014),
    mustacheBox: new THREE.BoxGeometry(0.068, 0.018, 0.022),
    mouthBox: new THREE.BoxGeometry(0.046, 0.012, 0.012),
    haloTorus: new THREE.TorusGeometry(0.25, 0.032, 6, 14),
    policeCrown: new THREE.CylinderGeometry(0.135, 0.118, 0.09, 8),
    policeBand: new THREE.CylinderGeometry(0.12, 0.12, 0.028, 8),
    policeBrim: new THREE.CylinderGeometry(0.115, 0.125, 0.018, 8, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
    policeEmblem: new THREE.OctahedronGeometry(0.024, 0),
    capDome: new THREE.SphereGeometry(0.125, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capVisor: new THREE.BoxGeometry(0.17, 0.016, 0.11),
    hairCrown: new THREE.DodecahedronGeometry(0.128, 0),
    hairBack: new THREE.CylinderGeometry(0.105, 0.095, 0.14, 6),
    pompadourCrest: new THREE.BoxGeometry(0.165, 0.075, 0.16),
    featheredWing: new THREE.ConeGeometry(0.065, 0.16, 5),
    scrunchie: new THREE.TorusGeometry(0.036, 0.014, 5, 8),
    ponytailCone: new THREE.ConeGeometry(0.056, 0.26, 6),
    bobLock: new THREE.CylinderGeometry(0.048, 0.036, 0.21, 5),
    bobBack: new THREE.CylinderGeometry(0.11, 0.095, 0.19, 6),
  };
  for (const geo of Object.values(shared)) {
    geo.userData.shared = true;
  }
  cachedGeos = shared;
  return cachedGeos;
}

// Shared reusable dark/metallic materials for facial details & accessories
let sharedAccessories: {
  sunglassFrame: THREE.MeshStandardMaterial;
  sunglassLens: THREE.MeshStandardMaterial;
  eyeWhite: THREE.MeshStandardMaterial;
  eyePupil: THREE.MeshStandardMaterial;
  mouth: THREE.MeshStandardMaterial;
  belt: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  capDark: THREE.MeshStandardMaterial;
  capBrim: THREE.MeshStandardMaterial;
  bountyHalo: THREE.MeshBasicMaterial;
} | null = null;

function getSharedAccessories() {
  if (sharedAccessories) return sharedAccessories;
  const acc = {
    sunglassFrame: new THREE.MeshStandardMaterial({ color: '#14101c', roughness: 0.3, flatShading: true }),
    sunglassLens: new THREE.MeshStandardMaterial({
      color: '#20183a',
      emissive: '#2998b8',
      emissiveIntensity: 0.32,
      metalness: 0.85,
      roughness: 0.12,
      flatShading: true,
    }),
    eyeWhite: new THREE.MeshStandardMaterial({ color: '#f4f0eb', roughness: 0.4 }),
    eyePupil: new THREE.MeshStandardMaterial({ color: '#1b1420', roughness: 0.3 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#8c424b', roughness: 0.7 }),
    belt: new THREE.MeshStandardMaterial({ color: '#1c1622', roughness: 0.45, flatShading: true }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.85, roughness: 0.22, flatShading: true }),
    capDark: new THREE.MeshStandardMaterial({ color: '#142447', roughness: 0.55, flatShading: true }),
    capBrim: new THREE.MeshStandardMaterial({ color: '#0d1018', roughness: 0.28, flatShading: true }),
    bountyHalo: new THREE.MeshBasicMaterial({ color: '#ff4fa3' }),
  };
  for (const mat of Object.values(acc)) {
    mat.userData.shared = true;
  }
  sharedAccessories = acc;
  return sharedAccessories;
}

/**
 * Disposes per-instance materials and non-shared geometries on a despawned character
 * without touching shared geometries, shared accessory materials, or cached CanvasTextures.
 */
export function disposeCharacter(root: THREE.Object3D): void {
  const disposedMats = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.geometry && !obj.geometry.userData.shared) {
      obj.geometry.dispose();
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m && !m.userData.shared && !disposedMats.has(m)) {
        disposedMats.add(m);
        m.dispose();
      }
    }
  });
}

/**
 * Builds a stylized, anatomically tapered Low-Poly 80s Miami character
 * with 2-segment arms (shoulder + elbow) and 2-segment legs (hip + knee).
 */
export function buildLowPolyCharacter(opts: LowPolyCharacterOptions): LowPolyCharacterRig {
  const g = getSharedGeos();
  const acc = getSharedAccessories();
  const isFemale = opts.bodyType === 'female';
  const isMuscular = opts.bodyType === 'muscular';

  const bodyRoot = new THREE.Group();
  if (opts.scale && opts.scale !== 1) {
    bodyRoot.scale.setScalar(opts.scale);
  }

  const skinMat = new THREE.MeshStandardMaterial({ color: opts.skinColor, roughness: 0.7, flatShading: true });
  const hairMat = new THREE.MeshStandardMaterial({ color: opts.hairColor, roughness: 0.8, flatShading: true });

  const torsoMat = new THREE.MeshStandardMaterial({
    map: getCombinedTorsoTexture(opts.role, opts.primaryColor, opts.accentColor, opts.outfitVariant),
    roughness: 0.62,
    flatShading: true,
  });
  const torsoFront = torsoMat;
  const torsoBack = torsoMat;
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: opts.role === 'bounty' ? '#f5f0eb' : opts.primaryColor,
    roughness: 0.62,
    flatShading: true,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: opts.pantsColor,
    roughness: 0.78,
    flatShading: true,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: opts.shoeColor,
    roughness: 0.5,
    flatShading: true,
  });

  // 1. Sculpted Pelvis & Belt
  const pelvis = new THREE.Mesh(isFemale ? g.pelvisFemale : g.pelvisMale, pantsMat);
  pelvis.position.y = 0.76;
  pelvis.castShadow = true;
  bodyRoot.add(pelvis);

  const belt = new THREE.Mesh(isFemale ? g.beltFemale : g.beltMale, acc.belt);
  belt.position.y = 0.91;
  bodyRoot.add(belt);

  const buckle = new THREE.Mesh(g.beltBuckle, acc.gold);
  buckle.position.set(0, 0.936, isFemale ? 0.106 : 0.116);
  bodyRoot.add(buckle);

  // 2. Sculpted Tapered Torso (single combined UV atlas material -> 1 draw call!)
  const torso = new THREE.Mesh(isFemale ? g.torsoFemale : g.torsoMale, torsoMat);
  torso.position.y = 0.94;
  if (isMuscular) {
    // Broad V-taper 80s action-hero chest & shoulders
    torso.scale.set(1.22, 1.03, 1.18);
  }
  torso.castShadow = true;
  bodyRoot.add(torso);

  // 3D Outfit Details (Biker leather jacket / Dog tags / Blazer lapels / Vice PD badge / Gold chain)
  if (opts.bikerJacket) {
    const leatherMat = new THREE.MeshStandardMaterial({ color: '#17161c', roughness: 0.34, metalness: 0.2, flatShading: true });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#d8e0ea', metalness: 0.9, roughness: 0.2, flatShading: true });
    const lapelZ = isMuscular ? 0.16 : 0.136;
    const lapelX = isMuscular ? 0.092 : 0.074;
    for (const side of [-1, 1] as const) {
      const lapel = new THREE.Mesh(g.lapel, leatherMat);
      lapel.scale.set(1.25, 1.05, 1.2);
      lapel.position.set(side * lapelX, 1.32, lapelZ);
      lapel.rotation.z = side * 0.24;
      lapel.rotation.y = side * -0.15;
      bodyRoot.add(lapel);

      const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), chromeMat);
      stud.position.set(side * (lapelX + 0.025), 1.35, lapelZ + 0.018);
      bodyRoot.add(stud);
    }
    // Diagonal silver biker zipper across the chest
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.36, 0.014), chromeMat);
    zip.position.set(0.045, 1.16, lapelZ + 0.005);
    zip.rotation.z = -0.1;
    bodyRoot.add(zip);
  } else if (opts.mrTGoldChains) {
    // Iconic Mr. T / B.A. Baracus stack of 6 heavy gleaming gold chains cascading down the chest!
    const chainZ = isMuscular ? 0.164 : 0.138;
    for (let c = 0; c < 6; c++) {
      const r = 0.056 + c * 0.015;
      const thick = 0.008 + (c % 2) * 0.0035;
      const chain = new THREE.Mesh(new THREE.TorusGeometry(r, thick, 6, 14, Math.PI), acc.gold);
      chain.position.set(0, 1.445 - c * 0.012, chainZ + c * 0.0025);
      chain.rotation.z = Math.PI;
      bodyRoot.add(chain);
    }
    // Chunky gold medallion hanging at the bottom of the stack
    const medallion = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), acc.gold);
    medallion.scale.set(1.0, 1.15, 0.35);
    medallion.position.set(0, 1.255, chainZ + 0.016);
    bodyRoot.add(medallion);
  } else if (opts.dogTags) {
    const silverMat = new THREE.MeshStandardMaterial({ color: '#d6dee8', metalness: 0.88, roughness: 0.22, flatShading: true });
    const tagZ = isMuscular ? 0.162 : 0.136;
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.006, 5, 10, Math.PI), silverMat);
    chain.position.set(0, 1.43, tagZ);
    chain.rotation.z = Math.PI;
    bodyRoot.add(chain);
    const tag1 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.04, 0.008), silverMat);
    tag1.position.set(-0.008, 1.35, tagZ + 0.006);
    tag1.rotation.z = 0.08;
    const tag2 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.04, 0.008), silverMat);
    tag2.position.set(0.012, 1.335, tagZ + 0.01);
    tag2.rotation.z = -0.12;
    bodyRoot.add(tag1, tag2);
  } else if (opts.role === 'police') {
    const badge = new THREE.Mesh(g.badge, acc.gold);
    badge.scale.set(1, 1.15, 0.35);
    badge.position.set(0.09, 1.33, 0.136);
    bodyRoot.add(badge);
  } else if (opts.role === 'bounty' || opts.role === 'guard' || opts.outfitVariant % 2 === 0) {
    // Stylized 3D 80s blazer lapels
    const lapelZ = isFemale ? 0.128 : 0.136;
    const lapelX = isFemale ? 0.062 : 0.074;
    for (const side of [-1, 1] as const) {
      const lapel = new THREE.Mesh(g.lapel, sleeveMat);
      lapel.position.set(side * lapelX, 1.32, lapelZ);
      lapel.rotation.z = side * 0.22;
      lapel.rotation.y = side * -0.15;
      bodyRoot.add(lapel);
    }
    if (opts.role === 'bounty' || opts.role === 'guard') {
      const chain = new THREE.Mesh(g.chainGold, acc.gold);
      chain.position.set(0, 1.41, isFemale ? 0.12 : 0.132);
      chain.rotation.z = Math.PI;
      bodyRoot.add(chain);
    }
  }

  // 3. Neck & Sculpted Low-Poly Head
  const neck = new THREE.Mesh(g.neck, skinMat);
  neck.position.y = 1.50;
  bodyRoot.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.65, 0);
  bodyRoot.add(headGroup);

  if (opts.horseMask) {
    addHorseMaskHead(headGroup, acc);
  } else {
    const headMesh = new THREE.Mesh(isFemale ? g.headFemale : g.headMale, skinMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // 3D Nose
    const nose = new THREE.Mesh(g.nose, skinMat);
    nose.position.set(0, -0.005, 0.125);
    nose.rotation.x = Math.PI * 0.38;
    headGroup.add(nose);

    // 3D Ears
    const earX = isFemale ? 0.106 : 0.114;
    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(g.ear, skinMat);
      ear.scale.set(0.5, 1.15, 0.8);
      ear.position.set(side * earX, 0.005, 0.0);
      headGroup.add(ear);
    }

    // 3D Terminator Wraparound Shades OR 80s Sunglasses OR Stylized Low-Poly Eyes & Brows
    if (opts.terminatorShades) {
      const shades = new THREE.Group();
      shades.position.set(0, 0.026, 0.12);
      const darkLens = new THREE.MeshStandardMaterial({
        color: '#09090d',
        metalness: 0.9,
        roughness: 0.08,
        flatShading: true,
      });
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.044, 0.022), darkLens);
      shades.add(visor);
      for (const side of [-1, 1] as const) {
        const temple = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.12), acc.sunglassFrame);
        temple.position.set(side * 0.098, 0.006, -0.055);
        shades.add(temple);
      }
      // Subtle iconic T-800 red cyber-eye glint on right lens
      const cyberEye = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.011, 0),
        new THREE.MeshStandardMaterial({
          color: '#ff2233',
          emissive: '#ff1a2a',
          emissiveIntensity: 0.85,
        }),
      );
      cyberEye.position.set(0.046, 0.0, 0.014);
      shades.add(cyberEye);
      headGroup.add(shades);
    } else if (opts.wearsSunglasses) {
      const shades = new THREE.Group();
      shades.position.set(0, 0.025, 0.118);

      const bridge = new THREE.Mesh(g.shadesBridge, acc.sunglassFrame);
      bridge.position.set(0, 0.006, 0.004);
      shades.add(bridge);

      for (const side of [-1, 1] as const) {
        const frame = new THREE.Mesh(g.shadesFrame, acc.sunglassFrame);
        frame.position.set(side * 0.048, 0, 0);
        frame.rotation.y = side * -0.14;
        shades.add(frame);

        const lens = new THREE.Mesh(g.shadesLens, acc.sunglassLens);
        lens.position.set(side * 0.048, 0, 0.002);
        lens.rotation.y = side * -0.14;
        shades.add(lens);

        // Temple arm back to ear
        const temple = new THREE.Mesh(g.shadesTemple, acc.sunglassFrame);
        temple.position.set(side * 0.095, 0.008, -0.058);
        shades.add(temple);
      }
      headGroup.add(shades);
    } else {
      for (const side of [-1, 1] as const) {
        const eye = new THREE.Mesh(g.eyeBox, acc.eyeWhite);
        eye.position.set(side * 0.042, 0.022, 0.115);
        eye.rotation.y = side * -0.15;
        headGroup.add(eye);

        const pupil = new THREE.Mesh(g.pupilBox, acc.eyePupil);
        pupil.position.set(side * 0.042, 0.022, 0.118);
        headGroup.add(pupil);

        const brow = new THREE.Mesh(g.browBox, hairMat);
        brow.position.set(side * 0.043, 0.048, 0.116);
        brow.rotation.z = side * -0.06;
        headGroup.add(brow);
      }
    }

    // Optional 3D 80s Mustache, Full Beard & Mouth
    if (opts.fullBeard) {
      const jawBeard = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.088, 0.125), hairMat);
      jawBeard.position.set(0, -0.095, 0.068);
      headGroup.add(jawBeard);
      const chinBeard = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.048, 0.085), hairMat);
      chinBeard.position.set(0, -0.135, 0.085);
      headGroup.add(chinBeard);
      const stache = new THREE.Mesh(g.mustacheBox, hairMat);
      stache.scale.set(1.15, 1.15, 1.1);
      stache.position.set(0, -0.045, 0.12);
      headGroup.add(stache);
    } else if (opts.hasMustache && !isFemale) {
      const stache = new THREE.Mesh(g.mustacheBox, hairMat);
      stache.position.set(0, -0.046, 0.116);
      headGroup.add(stache);
    }
    const mouth = new THREE.Mesh(g.mouthBox, acc.mouth);
    mouth.position.set(0, -0.072, 0.109);
    headGroup.add(mouth);

    // 4. Sculpted 3D 80s Hairstyles & Headgear
    addLowPolyHairOrHat(headGroup, opts.hairStyle, hairMat, opts.accentColor, acc, g);
  }

  // Bounty Target Neon Halo
  if (opts.withHalo) {
    const halo = new THREE.Mesh(g.haloTorus, acc.bountyHalo);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.42;
    headGroup.add(halo);
  }

  // 5. 2-Segment Articulated Arms (Shoulder -> Elbow -> Forearm -> Hand)
  const shoulderX = isFemale ? 0.225 : isMuscular ? 0.325 : 0.268;
  const shoulderY = isFemale ? 1.40 : isMuscular ? 1.44 : 1.42;
  const upperArmLen = isFemale ? 0.25 : 0.27;
  const forearmLen = isFemale ? 0.235 : 0.25;
  const upperArmGeo = isFemale ? g.upperArmFemale : g.upperArmMale;
  const forearmGeo = isFemale ? g.forearmFemale : g.forearmMale;
  const upperArmMat = opts.sleeveless ? skinMat : sleeveMat;
  const forearmMat = opts.sleeveless || opts.shortSleeves ? skinMat : sleeveMat;
  const armGirth = isMuscular ? 1.28 : 1.0;

  const buildArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * shoulderX, shoulderY, 0);

    const shoulderCap = new THREE.Mesh(g.shoulderJoint, upperArmMat);
    if (isFemale) shoulderCap.scale.setScalar(0.84);
    else if (isMuscular) shoulderCap.scale.setScalar(1.32);
    armPivot.add(shoulderCap);

    const upper = new THREE.Mesh(upperArmGeo, upperArmMat);
    upper.position.y = -upperArmLen * 0.5;
    if (isMuscular) upper.scale.set(armGirth, 1.0, armGirth);
    upper.castShadow = true;
    armPivot.add(upper);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.y = -upperArmLen;
    armPivot.add(elbowPivot);

    const elbowCap = new THREE.Mesh(g.elbowJoint, forearmMat);
    if (isFemale) elbowCap.scale.setScalar(0.84);
    else if (isMuscular) elbowCap.scale.setScalar(1.22);
    elbowPivot.add(elbowCap);

    const lower = new THREE.Mesh(forearmGeo, forearmMat);
    lower.position.y = -forearmLen * 0.5;
    if (isMuscular) lower.scale.set(1.2, 1.0, 1.2);
    elbowPivot.add(lower);

    if (opts.mrTGoldChains) {
      // Heavy gold wrist bracelets on both arms
      for (const wy of [-forearmLen + 0.04, -forearmLen + 0.072]) {
        const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 6, 12), acc.gold);
        bangle.rotation.x = Math.PI / 2;
        bangle.position.y = wy;
        elbowPivot.add(bangle);
      }
    }

    const handAnchor = new THREE.Group();
    handAnchor.position.set(0, -forearmLen - 0.035, 0.01);
    elbowPivot.add(handAnchor);

    const hand = new THREE.Mesh(g.hand, skinMat);
    if (isFemale) hand.scale.setScalar(0.86);
    handAnchor.add(hand);

    const thumb = new THREE.Mesh(g.thumb, skinMat);
    thumb.position.set(-side * 0.032, 0.005, 0.025);
    thumb.rotation.z = side * 0.35;
    handAnchor.add(thumb);

    bodyRoot.add(armPivot);
    return { armPivot, elbowPivot, handAnchor };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // 6. 2-Segment Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Sculpted Shoe)
  const hipX = isFemale ? 0.102 : 0.114;
  const hipY = 0.84;
  const thighLen = isFemale ? 0.38 : 0.39;
  const shinLen = 0.37;
  const thighGeo = isFemale ? g.thighFemale : g.thighMale;
  const shinGeo = isFemale ? g.shinFemale : g.shinMale;
  const shinMat = opts.isShorts ? skinMat : pantsMat;

  const buildLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * hipX, hipY, 0);

    const thigh = new THREE.Mesh(thighGeo, pantsMat);
    thigh.position.y = -thighLen * 0.5;
    thigh.scale.set(isMuscular ? 1.16 : 1, 1, isMuscular ? 1.22 : 1.06);
    thigh.castShadow = true;
    legPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -thighLen;
    legPivot.add(kneePivot);

    const kneeCap = new THREE.Mesh(g.kneeJoint, shinMat);
    if (isFemale) kneeCap.scale.setScalar(0.88);
    kneePivot.add(kneeCap);

    const shin = new THREE.Mesh(shinGeo, shinMat);
    shin.position.y = -shinLen * 0.5;
    kneePivot.add(shin);

    const shoe = new THREE.Mesh(g.shoe, shoeMat);
    shoe.position.set(0, -shinLen - 0.085, 0.015);
    if (isFemale) shoe.scale.set(0.88, 0.9, 0.92);
    kneePivot.add(shoe);

    bodyRoot.add(legPivot);
    return { legPivot, kneePivot };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  return {
    bodyRoot,
    headGroup,
    leftArmPivot: leftArm.armPivot,
    rightArmPivot: rightArm.armPivot,
    leftElbowPivot: leftArm.elbowPivot,
    rightElbowPivot: rightArm.elbowPivot,
    leftHandAnchor: leftArm.handAnchor,
    rightHandAnchor: rightArm.handAnchor,
    leftLegPivot: leftLeg.legPivot,
    rightLegPivot: rightLeg.legPivot,
    leftKneePivot: leftLeg.kneePivot,
    rightKneePivot: rightLeg.kneePivot,
    materials: {
      torsoFront,
      torsoBack,
      sleeve: sleeveMat,
      pants: pantsMat,
      skin: skinMat,
      hair: hairMat,
    },
  };
}

function addLowPolyHairOrHat(
  headGroup: THREE.Group,
  style: CharacterHairStyle,
  hairMat: THREE.MeshStandardMaterial,
  accentColor: string,
  acc: ReturnType<typeof getSharedAccessories>,
  g: SharedCharacterGeos,
): void {
  if (style === 'police') {
    // Peaked Vice PD officer cap
    const crown = new THREE.Mesh(g.policeCrown, acc.capDark);
    crown.position.set(0, 0.13, -0.005);
    headGroup.add(crown);

    const band = new THREE.Mesh(g.policeBand, acc.capBrim);
    band.position.set(0, 0.095, -0.005);
    headGroup.add(band);

    const brim = new THREE.Mesh(g.policeBrim, acc.capBrim);
    brim.position.set(0, 0.088, 0.05);
    brim.rotation.x = 0.15;
    headGroup.add(brim);

    const emblem = new THREE.Mesh(g.policeEmblem, acc.gold);
    emblem.scale.set(1, 1.1, 0.4);
    emblem.position.set(0, 0.125, 0.122);
    headGroup.add(emblem);
    return;
  }

  if (style === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6, flatShading: true });
    const dome = new THREE.Mesh(g.capDome, capMat);
    dome.position.set(0, 0.065, -0.005);
    dome.scale.set(1.0, 0.92, 1.08);
    headGroup.add(dome);

    const visor = new THREE.Mesh(g.capVisor, capMat);
    visor.position.set(0, 0.072, 0.12);
    visor.rotation.x = 0.12;
    headGroup.add(visor);
    return;
  }

  if (style === 'mohawk') {
    // Iconic Mr. T / B.A. Baracus central mohawk crest (clean shaved sides + gold feather earrings!)
    const crestMain = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.095, 0.245), hairMat);
    crestMain.position.set(0, 0.145, -0.008);
    headGroup.add(crestMain);
    const crestBack = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.115, 0.055), hairMat);
    crestBack.position.set(0, 0.075, -0.118);
    headGroup.add(crestBack);
    for (const side of [-1, 1] as const) {
      const earring = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.046, 5), acc.gold);
      earring.rotation.x = Math.PI;
      earring.position.set(side * 0.122, -0.025, 0.005);
      headGroup.add(earring);
    }
    return;
  }

  // Base hair cap wrapping upper & back cranium
  const crown = new THREE.Mesh(g.hairCrown, hairMat);
  crown.position.set(0, 0.085, -0.022);
  crown.scale.set(1.0, 0.72, 1.08);
  headGroup.add(crown);

  const backHair = new THREE.Mesh(g.hairBack, hairMat);
  backHair.position.set(0, 0.01, -0.062);
  headGroup.add(backHair);

  if (style === 'pompadour') {
    // Swept 80s Miami Vice pompadour wave
    const crest = new THREE.Mesh(g.pompadourCrest, hairMat);
    crest.position.set(0, 0.135, 0.032);
    crest.rotation.x = -0.22;
    headGroup.add(crest);
  } else if (style === 'feathered') {
    // Voluminous 80s feathered cut with layered side wings
    for (const side of [-1, 1] as const) {
      const wing = new THREE.Mesh(g.featheredWing, hairMat);
      wing.position.set(side * 0.105, 0.03, -0.025);
      wing.rotation.z = side * 0.25;
      headGroup.add(wing);
    }
  } else if (style === 'ponytail') {
    // High 80s ponytail with neon scrunchie
    const tieMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.45, flatShading: true });
    const scrunchie = new THREE.Mesh(g.scrunchie, tieMat);
    scrunchie.position.set(0, 0.06, -0.135);
    scrunchie.rotation.x = 0.35;
    headGroup.add(scrunchie);

    const tail = new THREE.Mesh(g.ponytailCone, hairMat);
    tail.position.set(0, -0.055, -0.175);
    tail.rotation.x = -0.32;
    headGroup.add(tail);
  } else if (style === 'rambo') {
    // 80s Sylvester Stallone / Rambo: voluminous dark hair + iconic crimson headband & trailing ribbons!
    for (const side of [-1, 1] as const) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.18, 5), hairMat);
      wing.position.set(side * 0.11, 0.025, -0.025);
      wing.rotation.z = side * 0.22;
      headGroup.add(wing);
    }
    const bandMat = new THREE.MeshStandardMaterial({ color: '#d91e2a', roughness: 0.65, flatShading: true });
    const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.038, 8), bandMat);
    headband.position.set(0, 0.078, 0.002);
    headGroup.add(headband);
    for (const side of [-1, 1] as const) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.16, 0.01), bandMat);
      ribbon.position.set(side * 0.024, 0.01, -0.145);
      ribbon.rotation.x = 0.28;
      ribbon.rotation.z = side * 0.18;
      headGroup.add(ribbon);
    }
  } else if (style === 'flattop') {
    // 80s Arnold Schwarzenegger / T-800 iconic flat-top brush cut!
    const flattop = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.088, 0.215), hairMat);
    flattop.position.set(0, 0.132, -0.004);
    headGroup.add(flattop);
  } else if (style === 'bob') {
    // Stylish 80s angled bob framing the face
    for (const side of [-1, 1] as const) {
      const lock = new THREE.Mesh(g.bobLock, hairMat);
      lock.position.set(side * 0.105, -0.015, -0.015);
      lock.rotation.z = side * -0.08;
      headGroup.add(lock);
    }
    const backBob = new THREE.Mesh(g.bobBack, hairMat);
    backBob.position.set(0, -0.02, -0.068);
    headGroup.add(backBob);
  }
}

/**
 * Builds a stylized procedural 3D rubber horse mask (Hotline Miami / 80s surreal vibe)
 * complete with tapered snout, flared nostrils, white forehead blaze, wide side-set eyes,
 * perked ears, and a spiky dark mane running down the back of the neck.
 */
function addHorseMaskHead(
  headGroup: THREE.Group,
  acc: ReturnType<typeof getSharedAccessories>,
): void {
  const horseBrownMat = new THREE.MeshStandardMaterial({ color: '#8d522c', roughness: 0.56, flatShading: true });
  const muzzleDarkMat = new THREE.MeshStandardMaterial({ color: '#4c2d1b', roughness: 0.64, flatShading: true });
  const maneMat = new THREE.MeshStandardMaterial({ color: '#24150d', roughness: 0.85, flatShading: true });
  const blazeMat = new THREE.MeshStandardMaterial({ color: '#f2e7d5', roughness: 0.65, flatShading: true });
  const innerEarMat = new THREE.MeshStandardMaterial({ color: '#c78279', roughness: 0.72, flatShading: true });

  // Mask neck collar wrapping cleanly over the shoulders/neck
  const neckCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.132, 0.16, 8), horseBrownMat);
  neckCollar.position.set(0, -0.095, -0.01);
  neckCollar.castShadow = true;
  headGroup.add(neckCollar);

  // Sculpted equine cranium & broad cheekbones
  const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.138, 0), horseBrownMat);
  cranium.scale.set(0.88, 1.04, 1.08);
  cranium.position.set(0, 0.045, -0.005);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Elongated horse nose bridge angling forward-downward (+Z)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.145, 0.24), horseBrownMat);
  bridge.position.set(0, -0.005, 0.165);
  bridge.rotation.x = 0.28;
  bridge.castShadow = true;
  headGroup.add(bridge);

  // Dark velvety snout tip
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.125, 0.11), muzzleDarkMat);
  snout.position.set(0, -0.048, 0.29);
  snout.rotation.x = 0.22;
  snout.castShadow = true;
  headGroup.add(snout);

  // Lower jaw & slightly open rubber mask mouth with white horse teeth
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.046, 0.175), horseBrownMat);
  jaw.position.set(0, -0.098, 0.195);
  jaw.rotation.x = 0.34;
  headGroup.add(jaw);

  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.022, 0.036), blazeMat);
  teeth.position.set(0, -0.088, 0.282);
  headGroup.add(teeth);

  // Flared dark nostrils
  const nostrilGeo = new THREE.SphereGeometry(0.021, 6, 5);
  for (const side of [-1, 1] as const) {
    const nostril = new THREE.Mesh(nostrilGeo, maneMat);
    nostril.scale.set(0.75, 1.0, 1.25);
    nostril.position.set(side * 0.052, -0.034, 0.328);
    headGroup.add(nostril);
  }

  // White stripe / forehead blaze down the nose bridge
  const blaze = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.016, 0.23), blazeMat);
  blaze.position.set(0, 0.082, 0.145);
  blaze.rotation.x = 0.42;
  headGroup.add(blaze);

  // Wide expressive side-set rubber horse mask eyes
  const eyeGeo = new THREE.SphereGeometry(0.034, 7, 6);
  const pupilGeo = new THREE.SphereGeometry(0.019, 6, 5);
  for (const side of [-1, 1] as const) {
    const eye = new THREE.Mesh(eyeGeo, acc.eyeWhite);
    eye.position.set(side * 0.102, 0.068, 0.072);
    headGroup.add(eye);

    const pupil = new THREE.Mesh(pupilGeo, acc.eyePupil);
    pupil.position.set(side * 0.121, 0.068, 0.086);
    headGroup.add(pupil);
  }

  // Perked pointed horse ears with dusty-pink inner lining
  const earGeo = new THREE.ConeGeometry(0.042, 0.145, 5);
  const innerEarGeo = new THREE.ConeGeometry(0.024, 0.095, 4);
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(earGeo, horseBrownMat);
    ear.position.set(side * 0.072, 0.215, -0.032);
    ear.rotation.z = side * -0.18;
    ear.rotation.x = 0.16;
    ear.castShadow = true;
    headGroup.add(ear);

    const inner = new THREE.Mesh(innerEarGeo, innerEarMat);
    inner.position.set(side * 0.072, 0.208, -0.015);
    inner.rotation.z = side * -0.18;
    inner.rotation.x = 0.18;
    headGroup.add(inner);
  }

  // Dark spiky mane tufts running from the crown down the back of the neck
  const maneTufts: [number, number, number, number][] = [
    [0.195, -0.055, 0.075, -0.35],
    [0.135, -0.115, 0.095, -0.55],
    [0.055, -0.145, 0.105, -0.4],
    [-0.025, -0.15, 0.095, -0.25],
    [-0.10, -0.14, 0.08, -0.1],
  ];
  for (const [my, mz, mh, rx] of maneTufts) {
    const tuft = new THREE.Mesh(new THREE.BoxGeometry(0.048, mh, 0.075), maneMat);
    tuft.position.set(0, my, mz);
    tuft.rotation.x = rx;
    headGroup.add(tuft);
  }
}
