import * as THREE from 'three';

/**
 * Lightweight fixed-cap decal ring buffer for:
 * - Tire drift skidmarks on the wet asphalt
 * - Charred blast scorch marks after vehicle/launcher explosions
 * - Bullet impact marks on walls and roads
 */
export class DecalSystem {
  private readonly scene: THREE.Scene;
  private readonly decals: THREE.Mesh[] = [];
  private readonly maxDecals = 150;

  private readonly skidGeo = new THREE.PlaneGeometry(0.32, 0.95);
  private readonly skidMat = new THREE.MeshBasicMaterial({
    color: '#0e0b14',
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });

  private readonly scorchGeo = new THREE.CircleGeometry(3.2, 16);
  private readonly scorchMat = new THREE.MeshBasicMaterial({
    color: '#0b080e',
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });

  private readonly bulletGeo = new THREE.CircleGeometry(0.09, 8);
  private readonly bulletMat = new THREE.MeshBasicMaterial({
    color: '#16111c',
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });

  private readonly up = new THREE.Vector3(0, 0, 1);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public addSkidmark(x: number, z: number, yaw: number): void {
    const mesh = new THREE.Mesh(this.skidGeo, this.skidMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -yaw;
    mesh.position.set(x, 0.018, z);
    this.pushDecal(mesh);
  }

  public addScorchMark(x: number, z: number): void {
    const mesh = new THREE.Mesh(this.scorchGeo, this.scorchMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.022, z);
    this.pushDecal(mesh);
  }

  public addBulletHole(point: THREE.Vector3, normal: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    mesh.position.copy(point).addScaledVector(normal, 0.018);
    mesh.quaternion.setFromUnitVectors(this.up, normal.clone().normalize());
    this.pushDecal(mesh);
  }

  private pushDecal(mesh: THREE.Mesh): void {
    this.scene.add(mesh);
    this.decals.push(mesh);
    if (this.decals.length > this.maxDecals) {
      const oldest = this.decals.shift();
      if (oldest) this.scene.remove(oldest);
    }
  }
}
