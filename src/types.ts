export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  tag?: string;
}

export interface PlayerStatus {
  x: number;
  y: number;
  z: number;
  speed: number;
  grounded: boolean;
  sprinting: boolean;
  crouching: boolean;
  swimming: boolean;
  inCover: boolean;
  coverPeeking: boolean;
  coverLow: boolean;
  coverNormalX: number;
  coverNormalZ: number;
  canTakeCover: boolean;
  waterClimbLabel: string | null;
}
