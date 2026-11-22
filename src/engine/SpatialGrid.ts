import type { AABB } from '../types';

const CELL_SIZE = 16;
const INV_CELL_SIZE = 1 / CELL_SIZE;

function packCellKey(cx: number, cz: number): number {
  return ((cx + 16384) << 15) | ((cz + 16384) & 0x7fff);
}

/**
 * Lightweight zero-allocation 2D spatial hash grid for static world AABB colliders.
 * Automatically separates movable Superyacht colliders (`tag` starting with `'yacht'`)
 * so piloting "LADY VICE" across the ocean retains exact deck/rail collisions everywhere.
 */
export class SpatialGrid {
  private readonly staticBoxes: AABB[] = [];
  private readonly dynamicBoxes: AABB[] = [];
  private readonly cells = new Map<number, number[]>();
  private readonly seenStamp: Int32Array;
  private stamp = 1;
  private readonly scratch: AABB[] = [];

  constructor(boxes: readonly AABB[]) {
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.tag && box.tag.startsWith('yacht')) {
        this.dynamicBoxes.push(box);
      } else {
        const idx = this.staticBoxes.length;
        this.staticBoxes.push(box);

        const minCx = Math.floor(box.minX * INV_CELL_SIZE);
        const maxCx = Math.floor(box.maxX * INV_CELL_SIZE);
        const minCz = Math.floor(box.minZ * INV_CELL_SIZE);
        const maxCz = Math.floor(box.maxZ * INV_CELL_SIZE);

        for (let cx = minCx; cx <= maxCx; cx++) {
          for (let cz = minCz; cz <= maxCz; cz++) {
            const key = packCellKey(cx, cz);
            let bucket = this.cells.get(key);
            if (!bucket) {
              bucket = [];
              this.cells.set(key, bucket);
            }
            bucket.push(idx);
          }
        }
      }
    }

    this.seenStamp = new Int32Array(this.staticBoxes.length);
  }

  /**
   * Queries all static AABBs (plus movable Superyacht AABBs and optional `extraDynamic` AABBs)
   * overlapping the horizontal `[minX..maxX, minZ..maxZ]` region without allocating arrays.
   */
  public queryBox(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    extraDynamic?: readonly AABB[],
    out: AABB[] = this.scratch,
  ): AABB[] {
    out.length = 0;

    let curStamp = ++this.stamp;
    if (curStamp >= 0x7ffffff0) {
      this.seenStamp.fill(0);
      this.stamp = 1;
      curStamp = 1;
    }

    const minCx = Math.floor(minX * INV_CELL_SIZE);
    const maxCx = Math.floor(maxX * INV_CELL_SIZE);
    const minCz = Math.floor(minZ * INV_CELL_SIZE);
    const maxCz = Math.floor(maxZ * INV_CELL_SIZE);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(packCellKey(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const idx = bucket[i];
          if (this.seenStamp[idx] === curStamp) continue;
          this.seenStamp[idx] = curStamp;
          const box = this.staticBoxes[idx];
          if (box.maxX >= minX && box.minX <= maxX && box.maxZ >= minZ && box.minZ <= maxZ) {
            out.push(box);
          }
        }
      }
    }

    for (let i = 0; i < this.dynamicBoxes.length; i++) {
      const box = this.dynamicBoxes[i];
      if (box.maxX >= minX && box.minX <= maxX && box.maxZ >= minZ && box.minZ <= maxZ) {
        out.push(box);
      }
    }

    if (extraDynamic) {
      for (let i = 0; i < extraDynamic.length; i++) {
        const box = extraDynamic[i];
        if (box.maxX >= minX && box.minX <= maxX && box.maxZ >= minZ && box.minZ <= maxZ) {
          out.push(box);
        }
      }
    }

    return out;
  }
}
