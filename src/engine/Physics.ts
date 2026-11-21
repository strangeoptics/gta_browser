import type { AABB } from '../types';

export interface ColliderResolution {
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  hitCeiling: boolean;
  vy: number;
}

/**
 * Resolves a vertical cylinder/box-approximated player against static world AABBs.
 * Supports smooth step-up (e.g., sidewalk curbs up to `maxStepHeight`) and wall sliding.
 */
export function resolvePlayerCollisions(
  x: number,
  y: number,
  z: number,
  vy: number,
  radius: number,
  height: number,
  colliders: AABB[],
  maxStepHeight = 0.28,
  baseGroundY = 0,
): ColliderResolution {
  let outX = x;
  let outY = y;
  let outZ = z;
  let outVy = vy;
  let grounded = false;
  let hitCeiling = false;

  // Base terrain/ground height (flat y = 0 in city, gently sloping on the beach)
  if (outY <= baseGroundY) {
    outY = baseGroundY;
    if (outVy < 0) outVy = 0;
    grounded = true;
  }

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];

    // Check horizontal overlap first
    const overlapX = outX + radius > box.minX && outX - radius < box.maxX;
    const overlapZ = outZ + radius > box.minZ && outZ - radius < box.maxZ;
    if (!overlapX || !overlapZ) continue;

    const playerBottom = outY;
    const playerTop = outY + height;

    // Check vertical overlap
    if (playerTop <= box.minY || playerBottom >= box.maxY) continue;

    // 1) Step-up or landing on top of box (e.g. sidewalk curb, low ledge)
    const penetrationFromTop = box.maxY - playerBottom;
    if (penetrationFromTop <= maxStepHeight && outVy <= 0.1) {
      outY = box.maxY;
      outVy = 0;
      grounded = true;
      continue;
    }

    // 2) Hitting head on underside of box
    const penetrationFromBottom = playerTop - box.minY;
    if (penetrationFromBottom < 0.35 && outVy > 0) {
      outY = box.minY - height;
      outVy = 0;
      hitCeiling = true;
      continue;
    }

    // 3) Horizontal push-out along minimum penetration axis (enables smooth wall sliding)
    const pushLeft = box.minX - (outX + radius); // negative
    const pushRight = box.maxX - (outX - radius); // positive
    const pushBack = box.minZ - (outZ + radius); // negative
    const pushFront = box.maxZ - (outZ - radius); // positive

    const absLeft = Math.abs(pushLeft);
    const absRight = Math.abs(pushRight);
    const absBack = Math.abs(pushBack);
    const absFront = Math.abs(pushFront);

    const minPush = Math.min(absLeft, absRight, absBack, absFront);
    if (minPush === absLeft) {
      outX += pushLeft;
    } else if (minPush === absRight) {
      outX += pushRight;
    } else if (minPush === absBack) {
      outZ += pushBack;
    } else {
      outZ += pushFront;
    }
  }

  return {
    x: outX,
    y: outY,
    z: outZ,
    grounded,
    hitCeiling,
    vy: outVy,
  };
}
