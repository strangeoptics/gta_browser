import * as THREE from 'three';

interface PooledTracer {
  line: THREE.Line;
  posAttr: THREE.BufferAttribute;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
  baseOpacity: number;
}

/**
 * Reusable pool of world-space `THREE.Line` bullet tracers.
 * Eliminates per-shot `BufferGeometry` + `LineBasicMaterial` allocations and `.dispose()` stalls.
 */
export class TracerPool {
  private readonly scene: THREE.Scene;
  private readonly active: PooledTracer[] = [];
  private readonly free: PooledTracer[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawn(
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number | string,
    duration: number,
    opacity = 0.82,
    fade = true,
  ): void {
    let item = this.free.pop();
    if (!item) {
      const positions = new Float32Array(6);
      const posAttr = new THREE.BufferAttribute(positions, 3);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', posAttr);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.matrixAutoUpdate = false;
      this.scene.add(line);
      item = { line, posAttr, mat, life: duration, maxLife: duration, baseOpacity: fade ? opacity : -opacity };
    }

    const arr = item.posAttr.array as Float32Array;
    arr[0] = start.x;
    arr[1] = start.y;
    arr[2] = start.z;
    arr[3] = end.x;
    arr[4] = end.y;
    arr[5] = end.z;
    item.posAttr.needsUpdate = true;

    item.mat.color.set(color);
    item.mat.opacity = opacity;
    item.life = duration;
    item.maxLife = duration;
    item.baseOpacity = fade ? opacity : -opacity;
    item.line.visible = true;

    this.active.push(item);
  }

  public update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.line.visible = false;
        this.free.push(t);
        const last = this.active.length - 1;
        if (i !== last) {
          this.active[i] = this.active[last];
        }
        this.active.pop();
      } else if (t.baseOpacity > 0) {
        t.mat.opacity = (t.life / t.maxLife) * t.baseOpacity;
      }
    }
  }
}
