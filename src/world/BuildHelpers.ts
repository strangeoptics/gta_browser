import * as THREE from 'three';
import type { AABB } from '../types';

export interface WorldBuildHelpers {
  addBox: (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material | THREE.Material[],
    castShadow?: boolean,
    tag?: string,
  ) => THREE.Mesh;
  addVisual: (
    geo: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number,
    castShadow?: boolean,
  ) => THREE.Mesh;
}

/**
 * Shared procedural world-building helpers to avoid duplicating addBox/addVisual across district builders.
 */
export function createWorldHelpers(
  scene: THREE.Scene,
  colliders: AABB[],
  worldMeshes: THREE.Object3D[],
  defaultTag = 'world',
): WorldBuildHelpers {
  return {
    addBox: (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material | THREE.Material[],
      castShadow = true,
      tag = defaultTag,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = castShadow;
      m.receiveShadow = true;
      scene.add(m);
      worldMeshes.push(m);
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        tag,
      });
      return m;
    },

    addVisual: (
      geo: THREE.BufferGeometry,
      mat: THREE.Material | THREE.Material[],
      x: number,
      y: number,
      z: number,
      castShadow = false,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = castShadow;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    },
  };
}
