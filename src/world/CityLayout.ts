export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  trimColor: string;
  neonColor: string;
  signText?: string;
  signFace?: 'N' | 'S' | 'E' | 'W';
  hasCrown?: boolean;
}

export interface CityLayout {
  roadCoords: number[];
  blockCenters: number[];
  roadWidth: number;
  blockSize: number;
  sidewalkWidth: number;
  playableBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  buildings: BuildingSpec[];
}

export const ROAD_COORDS = [-81, -27, 27, 81];
export const BLOCK_CENTERS = [-54, 0, 54];
export const ROAD_WIDTH = 12;
export const BLOCK_SIZE = 42;
export const SIDEWALK_WIDTH = 3.2;

export const DEFAULT_PLAYABLE_BOUNDS = {
  minX: -146,
  maxX: 250,
  minZ: -190,
  maxZ: 180,
} as const;

/**
 * Centralized spatial coordinates for major Palm City '86 landmarks & zones
 * (single source of truth shared by NpcSystem, VehicleSystem, InteractionRouter & main.ts).
 */
export const WORLD_LANDMARKS = {
  VICE_PD_PRECINCT: { x: -54, z: 0 },
  SAFEHOUSE: { x: 54, z: -54 },
  SAFEHOUSE_LOT: { minX: 43.0, maxX: 65.0, minZ: -64.0, maxZ: -44.0 },
  NEON_CLUB: { x: 54, z: 0 },
  AMMU_NEON: { x: -4.5, z: 4.5 },
  PAY_N_SPRAY: { x: -77, z: -52 },
  VICE_CUSTOMS: { x: -106, z: -37.5 },
  LOWRIDER_ARENA: { x: -108, z: 1.6 },
  VICE_AIRFIELD: { x: -117, z: 123 },
  SMUGGLERS_CAY: { x: 183, z: 117 },
  PALM_PARKING: { x: 0, z: 54 },
  VICE_PORT_GOAL_Z: 89,
  OCEAN_DEEP_X: 128,
} as const;

const PASTEL_PALETTE = [
  '#f2c6b4', // sun-bleached coral
  '#bce0d8', // faded mint
  '#f4e2c8', // warm cream stucco
  '#e7b5c9', // dusty flamingo pink
  '#ead7a8', // coastal ochre
  '#c6dce6', // bleached aqua
  '#efe7dc', // art-deco off-white
];

const NEON_PALETTE = [
  '#ff4fa3', // hot pink
  '#36f1e6', // vice cyan
  '#ff9f43', // warm amber
  '#ff5e7e', // coral neon
  '#9d6bff', // twilight violet
];

const SIGN_NAMES = [
  'HOTEL PALMA',
  'OCEAN CLUB',
  'CAFE SOL',
  'MOTEL VICE',
  'DEL MAR',
  'SUNSET LOUNGE',
  'TROPICANA',
  'BAYSIDE INN',
  'NEON PALMS',
];

/**
 * Deterministic pseudo-random generator so the 3x3 city layout is identical every reload.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCityLayout(): CityLayout {
  const rand = mulberry32(3052026);
  const buildings: BuildingSpec[] = [];
  let signIndex = 0;

  for (let row = 0; row < BLOCK_CENTERS.length; row++) {
    for (let col = 0; col < BLOCK_CENTERS.length; col++) {
      const cx = BLOCK_CENTERS[col];
      const cz = BLOCK_CENTERS[row];
      const isOceanFront = col === 2;
      const isCenterPlaza = row === 1 && col === 1;
      const isNeonClubBlock = row === 1 && col === 2;
      const isSafehouseBlock = row === 0 && col === 2;
      const isPoliceStationBlock = row === 1 && col === 0;
      const isPalmParkingBlock = row === 2 && col === 1;

      if (isNeonClubBlock || isSafehouseBlock || isPoliceStationBlock || isPalmParkingBlock) {
        // Reserved for hollow walk-in/drive-in landmarks (NEON CLUB, VICE SAFEHOUSE, VICE PD & PALM PARKING)
        continue;
      }

      if (isCenterPlaza) {
        // Spacious 42x42m Central Plaza with two grand corner Art-Deco buildings + wide open courtyard
        buildings.push({
          x: cx - 10.5,
          z: cz - 10.5,
          w: 13.5,
          h: 17.5,
          d: 13.5,
          color: '#f2c6b4',
          trimColor: '#fff4e6',
          neonColor: '#ff4fa3',
          signText: SIGN_NAMES[signIndex++ % SIGN_NAMES.length],
          signFace: 'E',
          hasCrown: true,
        });
        buildings.push({
          x: cx + 10.5,
          z: cz + 10.2,
          w: 13.2,
          h: 14.0,
          d: 13.8,
          color: '#bce0d8',
          trimColor: '#fff6ec',
          neonColor: '#36f1e6',
          signText: SIGN_NAMES[signIndex++ % SIGN_NAMES.length],
          signFace: 'S',
          hasCrown: true,
        });
        continue;
      }

      // Split each 34.4 x 34.4 buildable 1.5x block interior into 2 grand Art-Deco buildings separated by a walkable alley
      const splitHorizontal = (row + col) % 2 === 0;
      const alleyGap = 3.6;

      if (splitHorizontal) {
        const d1 = 14.2 + rand() * 2.2;
        const d2 = 33.6 - alleyGap - d1;
        const z1 = cz - 16.8 + d1 / 2;
        const z2 = cz + 16.8 - d2 / 2;

        const h1 = (isOceanFront ? 12 : 14) + rand() * 12;
        const h2 = (isOceanFront ? 11 : 13) + rand() * 14;

        buildings.push({
          x: cx,
          z: z1,
          w: 33.0,
          h: h1,
          d: d1,
          color: PASTEL_PALETTE[Math.floor(rand() * PASTEL_PALETTE.length)],
          trimColor: '#fff3e4',
          neonColor: NEON_PALETTE[Math.floor(rand() * NEON_PALETTE.length)],
          signText: isOceanFront ? SIGN_NAMES[signIndex++ % SIGN_NAMES.length] : undefined,
          signFace: isOceanFront ? 'E' : 'N',
          hasCrown: rand() > 0.35,
        });

        buildings.push({
          x: cx,
          z: z2,
          w: 33.0,
          h: h2,
          d: d2,
          color: PASTEL_PALETTE[Math.floor(rand() * PASTEL_PALETTE.length)],
          trimColor: '#fff3e4',
          neonColor: NEON_PALETTE[Math.floor(rand() * NEON_PALETTE.length)],
          signText: SIGN_NAMES[signIndex++ % SIGN_NAMES.length],
          signFace: isOceanFront ? 'E' : 'S',
          hasCrown: rand() > 0.35,
        });
      } else {
        const w1 = 14.2 + rand() * 2.2;
        const w2 = 33.6 - alleyGap - w1;
        const x1 = cx - 16.8 + w1 / 2;
        const x2 = cx + 16.8 - w2 / 2;

        const h1 = (isOceanFront ? 13 : 14) + rand() * 13;
        const h2 = (isOceanFront ? 11 : 12) + rand() * 12;

        buildings.push({
          x: x1,
          z: cz,
          w: w1,
          h: h1,
          d: 33.0,
          color: PASTEL_PALETTE[Math.floor(rand() * PASTEL_PALETTE.length)],
          trimColor: '#fff3e4',
          neonColor: NEON_PALETTE[Math.floor(rand() * NEON_PALETTE.length)],
          signText: SIGN_NAMES[signIndex++ % SIGN_NAMES.length],
          signFace: 'W',
          hasCrown: rand() > 0.35,
        });

        buildings.push({
          x: x2,
          z: cz,
          w: w2,
          h: h2,
          d: 33.0,
          color: PASTEL_PALETTE[Math.floor(rand() * PASTEL_PALETTE.length)],
          trimColor: '#fff3e4',
          neonColor: NEON_PALETTE[Math.floor(rand() * NEON_PALETTE.length)],
          signText: isOceanFront ? SIGN_NAMES[signIndex++ % SIGN_NAMES.length] : undefined,
          signFace: 'E',
          hasCrown: rand() > 0.35,
        });
      }
    }
  }

  return {
    roadCoords: ROAD_COORDS,
    blockCenters: BLOCK_CENTERS,
    roadWidth: ROAD_WIDTH,
    blockSize: BLOCK_SIZE,
    sidewalkWidth: SIDEWALK_WIDTH,
    playableBounds: {
      minX: -146, // extends west through Little Havana, Vice Airfield Runway 18/36 & West Havana Blvd
      maxX: 250, // extends across Causeway Bridge, Starfish Island, Smuggler's Cay & open east ocean
      minZ: -190, // extends north through North Point, Vice Marina Bay & Cape Vice Cliff
      maxZ: 180, // extends south through Vice Port Docks, Vice Airfield & south bay
    },
    buildings,
  };
}
