import * as THREE from 'three';
import { createNeonSignTexture } from '../world/Textures';

/**
 * AMMU-NEON street upgrade kiosk located at Central Plaza.
 * Players can spend earned mission Cash ($) on Medkits, Kevlar Armor, and the Neon Launcher.
 */
export class ShopSystem {
  public readonly position = new THREE.Vector3(-4.5, 0.18, 4.5);
  private readonly ring: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const group = new THREE.Group();
    group.position.copy(this.position);

    const boothMat = new THREE.MeshStandardMaterial({ color: '#221a2e', roughness: 0.45, metalness: 0.5 });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#52f29c',
      emissive: '#52f29c',
      emissiveIntensity: 2.2,
    });

    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 2.0), boothMat);
    kiosk.position.y = 1.4;
    kiosk.castShadow = true;
    kiosk.receiveShadow = true;
    group.add(kiosk);

    const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.14, 2.14), trimMat);
    roofTrim.position.y = 2.82;
    group.add(roofTrim);

    const signTex = createNeonSignTexture('AMMU-NEON $', '#52f29c');
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: '#ffffff',
      emissiveMap: signTex,
      emissiveIntensity: 1.8,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 0.16), signMat);
    sign.position.set(0, 3.25, 0.96);
    group.add(sign);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.75, 2.05, 24),
      new THREE.MeshBasicMaterial({ color: '#52f29c', side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(0, 0.06, 1.6);
    group.add(this.ring);

    scene.add(group);
  }

  public isPlayerNear(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - (this.position.z + 1.6);
    return dx * dx + dz * dz < 16.0; // within 4m
  }

  public update(elapsed: number): void {
    const s = 1 + Math.sin(elapsed * 4.5) * 0.08;
    this.ring.scale.set(s, s, 1);
  }
}
