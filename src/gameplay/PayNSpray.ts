import * as THREE from 'three';
import { createNeonSignTexture } from '../world/Textures';
import type { Vehicle } from '../vehicles/VehicleSystem';

interface PaintPuff {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const RESLPRAY_COLORS = [
  '#ff4fa3', // hot vice pink
  '#36f1e6', // electric cyan
  '#ff9f43', // sunset tangerine
  '#b388ff', // twilight violet
  '#52f29c', // miami mint
  '#fff0d9', // pearl white
  '#ff5252', // coral red
];

/**
 * Classic GTA Pay 'n' Spray drive-in respray bay on the West Avenue (-56, -38).
 * Costs $300: repairs vehicle to 100% HP, resprays in a fresh 80s neon color,
 * and clears all Wanted stars.
 */
export class PayNSpray {
  public readonly position = new THREE.Vector3(-56, 0.05, -38);
  public readonly cost = 300;

  private readonly scene: THREE.Scene;
  private readonly ring: THREE.Mesh;
  private readonly puffs: PaintPuff[] = [];
  private readonly puffGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const g = new THREE.Group();
    g.position.copy(this.position);

    const frameMat = new THREE.MeshStandardMaterial({ color: '#241b30', roughness: 0.5, metalness: 0.55 });
    const neonMat = new THREE.MeshStandardMaterial({
      color: '#ff9f43',
      emissive: '#ff9f43',
      emissiveIntensity: 2.3,
    });

    // Open drive-through neon gantry arch
    for (const side of [-3.2, 3.2]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.2, 0.45), frameMat);
      pillar.position.set(side, 2.1, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.0, 0.65), frameMat);
    header.position.set(0, 4.4, 0);
    g.add(header);

    const neonBar = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.14, 0.72), neonMat);
    neonBar.position.set(0, 3.88, 0);
    g.add(neonBar);

    const signTex = createNeonSignTexture("PAY 'N' SPRAY", '#ff9f43');
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: '#ffffff',
      emissiveMap: signTex,
      emissiveIntensity: 1.7,
    });
    const signFront = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.9, 0.12), signMat);
    signFront.position.set(0, 4.42, 0.36);
    g.add(signFront);
    const signBack = signFront.clone();
    signBack.position.z = -0.36;
    signBack.rotation.y = Math.PI;
    g.add(signBack);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(2.8, 3.2, 28),
      new THREE.MeshBasicMaterial({ color: '#ff9f43', side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    g.add(this.ring);

    this.scene.add(g);
  }

  public isCarInBay(carPos: THREE.Vector3): boolean {
    const dx = carPos.x - this.position.x;
    const dz = carPos.z - this.position.z;
    return dx * dx + dz * dz < 22.0; // within ~4.7m
  }

  public resprayVehicle(v: Vehicle): string {
    // Pick a fresh color different from current
    const choices = RESLPRAY_COLORS.filter((c) => c !== v.originalColor);
    const newColor = choices[Math.floor(Math.random() * choices.length)] ?? '#36f1e6';

    v.hp = v.maxHp;
    v.destroyed = false;
    v.originalColor = newColor;
    v.bodyMat.color.set(newColor);
    v.bodyMat.roughness = 0.2;

    // Colorful paint mist burst around the car
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? '#ffffff' : newColor,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(this.puffGeo, mat);
      const angle = (i / 24) * Math.PI * 2;
      mesh.position.set(
        v.position.x + Math.cos(angle) * 1.4,
        0.7 + Math.random() * 0.7,
        v.position.z + Math.sin(angle) * 2.1,
      );
      this.scene.add(mesh);
      this.puffs.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * 2.6, 1.4 + Math.random() * 1.8, Math.sin(angle) * 2.6),
        life: 0.85,
        maxLife: 0.85,
      });
    }

    return newColor;
  }

  public update(dt: number, elapsed: number): void {
    const s = 1 + Math.sin(elapsed * 4.0) * 0.06;
    this.ring.scale.set(s, s, 1);

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.vel, dt);
        const sc = 1 + (1 - p.life / p.maxLife) * 1.8;
        p.mesh.scale.setScalar(sc);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = (p.life / p.maxLife) * 0.82;
      }
    }
  }
}
