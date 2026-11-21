import * as THREE from 'three';
import type { AABB } from '../types';

interface BarricadeProp {
  mesh: THREE.Group;
  spawnPos: THREE.Vector3;
  broken: boolean;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
}

interface RoadblockSite {
  group: THREE.Group;
  cruiserBox: AABB;
  lightRed: THREE.MeshStandardMaterial;
  lightBlue: THREE.MeshStandardMaterial;
  barricades: BarricadeProp[];
}

/**
 * Vice PD Roadblocks that deploy across main avenues at 3+ Wanted Stars.
 * Each roadblock places a crosswise Vice PD Cruiser (solid obstacle) flanked by
 * smashable neon barricades & traffic cones you can plow through at full speed!
 */
export class RoadblockSystem {
  private readonly sites: RoadblockSite[] = [];
  private active = false;

  public onBarricadeSmashed?: () => void;

  constructor(scene: THREE.Scene) {
    // 2 strategic roadblock locations: Ocean Drive (-30) & Central Avenue (20, 0)
    this.createSite(scene, 60, -30);
    this.createSite(scene, 20, 0);
  }

  public getActiveColliders(): AABB[] {
    if (!this.active) return [];
    return this.sites.map((s) => s.cruiserBox);
  }

  public handleVehicleImpact(vPos: THREE.Vector3, vYaw: number, speed: number): void {
    if (!this.active || Math.abs(speed) < 3.0) return;
    const fwdX = Math.sin(vYaw);
    const fwdZ = Math.cos(vYaw);

    for (const s of this.sites) {
      for (const b of s.barricades) {
        if (b.broken) continue;
        const dx = b.mesh.position.x - vPos.x;
        const dz = b.mesh.position.z - vPos.z;
        if (dx * dx + dz * dz < 4.5) {
          b.broken = true;
          b.vel.set(
            fwdX * Math.abs(speed) * 0.75 + (Math.random() - 0.5) * 4,
            4.5 + Math.min(4, Math.abs(speed) * 0.2),
            fwdZ * Math.abs(speed) * 0.75 + (Math.random() - 0.5) * 4,
          );
          b.angVel.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
          this.onBarricadeSmashed?.();
        }
      }
    }
  }

  public update(dt: number, elapsed: number, wantedStars: number): void {
    const clampedDt = Math.min(dt, 0.05);
    const shouldBeActive = wantedStars >= 3;

    if (shouldBeActive !== this.active) {
      this.active = shouldBeActive;
      for (const s of this.sites) {
        s.group.visible = this.active;
        if (this.active) {
          // Reset smashable barricades when roadblock deploys
          for (const b of s.barricades) {
            b.broken = false;
            b.vel.set(0, 0, 0);
            b.angVel.set(0, 0, 0);
            b.mesh.position.copy(b.spawnPos);
            b.mesh.rotation.set(0, 0, 0);
          }
        }
      }
    }

    if (!this.active) return;

    const flash = Math.sin(elapsed * 16) > 0;
    for (const s of this.sites) {
      s.lightRed.emissiveIntensity = flash ? 4.4 : 0.25;
      s.lightBlue.emissiveIntensity = flash ? 0.25 : 4.4;

      for (const b of s.barricades) {
        if (!b.broken) continue;
        if (b.mesh.position.y > 0.2 || b.vel.y > 0) {
          b.vel.y -= 16 * clampedDt;
          b.mesh.position.addScaledVector(b.vel, clampedDt);
          b.mesh.rotation.x += b.angVel.x * clampedDt;
          b.mesh.rotation.y += b.angVel.y * clampedDt;
          b.mesh.rotation.z += b.angVel.z * clampedDt;
          if (b.mesh.position.y <= 0.2) {
            b.mesh.position.y = 0.2;
            b.vel.multiplyScalar(0.3);
            b.vel.y = 0;
            b.angVel.multiplyScalar(0.3);
          }
        }
      }
    }
  }

  private createSite(scene: THREE.Scene, x: number, z: number): void {
    const group = new THREE.Group();
    group.visible = false;

    // Crosswise parked Vice PD Cruiser on the left half of the avenue (x - 2.0)
    const cx = x - 2.0;
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#171824', roughness: 0.3, metalness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#141c2e', roughness: 0.1, metalness: 0.85 });

    const cruiser = new THREE.Group();
    cruiser.position.set(cx, 0, z);
    cruiser.rotation.y = Math.PI / 2;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), bodyMat);
    chassis.position.y = 0.56;
    chassis.castShadow = true;
    cruiser.add(chassis);

    const doors = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.56, 1.85), whiteMat);
    doors.position.y = 0.56;
    cruiser.add(doors);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.5, 2.0), glassMat);
    cabin.position.set(0, 1.06, -0.15);
    cruiser.add(cabin);

    const lightRed = new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.5 });
    const lightBlue = new THREE.MeshStandardMaterial({ color: '#22aaff', emissive: '#22aaff', emissiveIntensity: 3.5 });

    const lbR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), lightRed);
    lbR.position.set(-0.34, 1.4, -0.1);
    cruiser.add(lbR);
    const lbB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.24), lightBlue);
    lbB.position.set(0.34, 1.4, -0.1);
    cruiser.add(lbB);

    group.add(cruiser);

    // 3 Smashable glowing orange-white saw-horse barricades blocking the right half of the road!
    const barricades: BarricadeProp[] = [];
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#ff7b29',
      emissive: '#ff5511',
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });
    const legMat = new THREE.MeshStandardMaterial({ color: '#ece6df', roughness: 0.6 });

    for (const offset of [1.4, 3.0, 4.5]) {
      const bg = new THREE.Group();
      const spawnPos = new THREE.Vector3(x + offset, 0, z);
      bg.position.copy(spawnPos);

      const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.14), stripeMat);
      board.position.y = 0.82;
      board.castShadow = true;
      bg.add(board);

      for (const side of [-0.5, 0.5]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), legMat);
        leg.position.set(side, 0.45, 0);
        bg.add(leg);
      }

      group.add(bg);
      barricades.push({
        mesh: bg,
        spawnPos,
        broken: false,
        vel: new THREE.Vector3(),
        angVel: new THREE.Vector3(),
      });
    }

    scene.add(group);

    this.sites.push({
      group,
      cruiserBox: {
        minX: cx - 2.2,
        maxX: cx + 2.2,
        minY: 0,
        maxY: 1.6,
        minZ: z - 1.15,
        maxZ: z + 1.15,
        tag: 'roadblock-cruiser',
      },
      lightRed,
      lightBlue,
      barricades,
    });
  }
}
