import * as THREE from 'three';

/**
 * High-performance InstancedMesh ring-buffer decal system (constant 3 draw calls total!):
 * - Tire drift skidmarks on wet asphalt (cap 80)
 * - Charred blast scorch marks after vehicle/launcher explosions (cap 24)
 * - Bullet impact marks on walls and roads (cap 80)
 */
export class DecalSystem {
  private readonly skidMax = 80;
  private readonly scorchMax = 24;
  private readonly bulletMax = 80;

  private skidCursor = 0;
  private scorchCursor = 0;
  private bulletCursor = 0;

  private readonly skidInst: THREE.InstancedMesh;
  private readonly scorchInst: THREE.InstancedMesh;
  private readonly bulletInst: THREE.InstancedMesh;

  private readonly dummy = new THREE.Object3D();
  private readonly up = new THREE.Vector3(0, 0, 1);
  private readonly normScratch = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);

    this.skidInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.32, 0.95),
      new THREE.MeshBasicMaterial({
        color: '#0e0b14',
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
      this.skidMax,
    );
    this.scorchInst = new THREE.InstancedMesh(
      new THREE.CircleGeometry(3.2, 16),
      new THREE.MeshBasicMaterial({
        color: '#0b080e',
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      }),
      this.scorchMax,
    );
    this.bulletInst = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.09, 8),
      new THREE.MeshBasicMaterial({
        color: '#16111c',
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
      this.bulletMax,
    );

    for (const inst of [this.skidInst, this.scorchInst, this.bulletInst]) {
      for (let i = 0; i < inst.count; i++) {
        inst.setMatrixAt(i, zeroMat);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      inst.matrixAutoUpdate = false;
      scene.add(inst);
    }
  }

  public addSkidmark(x: number, z: number, yaw: number): void {
    this.dummy.position.set(x, 0.018, z);
    this.dummy.rotation.set(-Math.PI / 2, 0, -yaw);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.skidInst.setMatrixAt(this.skidCursor, this.dummy.matrix);
    this.skidInst.instanceMatrix.needsUpdate = true;
    this.skidCursor = (this.skidCursor + 1) % this.skidMax;
  }

  public addScorchMark(x: number, z: number): void {
    this.dummy.position.set(x, 0.022, z);
    this.dummy.rotation.set(-Math.PI / 2, 0, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.scorchInst.setMatrixAt(this.scorchCursor, this.dummy.matrix);
    this.scorchInst.instanceMatrix.needsUpdate = true;
    this.scorchCursor = (this.scorchCursor + 1) % this.scorchMax;
  }

  public addBulletHole(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.normScratch.copy(normal).normalize();
    this.dummy.position.copy(point).addScaledVector(this.normScratch, 0.018);
    this.dummy.quaternion.setFromUnitVectors(this.up, this.normScratch);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.bulletInst.setMatrixAt(this.bulletCursor, this.dummy.matrix);
    this.bulletInst.instanceMatrix.needsUpdate = true;
    this.bulletCursor = (this.bulletCursor + 1) % this.bulletMax;
  }
}
