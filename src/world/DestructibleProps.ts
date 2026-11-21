import * as THREE from 'three';
import type { ShootableTarget } from '../combat/WeaponSystem';

type PropKind = 'hydrant' | 'cafe' | 'bin';

interface DestructibleProp {
  id: string;
  kind: PropKind;
  group: THREE.Group;
  hitbox: THREE.Mesh;
  spawnPos: THREE.Vector3;
  broken: boolean;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  geyserTimer: number;
  respawnTimer: number;
}

interface WaterDrop {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

/**
 * Interactive destructible Miami street props:
 * - Fire hydrants along Ocean Drive & avenues (erupt into a pressurized water geyser when broken!)
 * - Sidewalk café tables with pastel umbrellas
 * - Neon coastal trash bins
 */
export class DestructibleProps {
  private readonly scene: THREE.Scene;
  private readonly props: DestructibleProp[] = [];
  private readonly drops: WaterDrop[] = [];
  private readonly dropGeo = new THREE.BoxGeometry(0.14, 0.24, 0.14);
  private readonly hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  private sprayTick = 0;

  public onPropSmashed?: (kind: PropKind) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Fire Hydrants along Ocean Drive & inner corners
    const hydrants: [number, number][] = [
      [54.2, 22],
      [54.2, -6],
      [54.2, -34],
      [14.2, 14],
      [-14.2, -14],
      [25.8, -26],
    ];
    hydrants.forEach(([x, z], i) => this.createHydrant(`hydrant-${i}`, x, z));

    // Sidewalk Café Tables with Pastel Umbrellas along Ocean Drive & Plaza
    const cafes: [number, number, string][] = [
      [68.4, 24, '#ff4fa3'],
      [68.4, 16, '#36f1e6'],
      [68.4, 2, '#ff9f43'],
      [68.4, -28, '#ff4fa3'],
      [6.2, -5.8, '#36f1e6'],
      [-6.5, -5.8, '#ff9f43'],
    ];
    cafes.forEach(([x, z, col], i) => this.createCafeTable(`cafe-${i}`, x, z, col));

    // Coastal Neon Bins
    const bins: [number, number][] = [
      [66.2, 10],
      [66.2, -18],
      [14.0, -4],
      [-14.0, 12],
      [53.8, 34],
    ];
    bins.forEach(([x, z], i) => this.createTrashBin(`bin-${i}`, x, z));
  }

  public getShootableTargets(): ShootableTarget[] {
    const out: ShootableTarget[] = [];
    for (const p of this.props) {
      if (p.broken) continue;
      out.push({
        id: p.id,
        mesh: p.hitbox,
        onHit: (_dmg: number, hitPoint: THREE.Vector3, hitNormal: THREE.Vector3) => {
          const impulse = hitNormal.clone().multiplyScalar(-5.5);
          impulse.y = 4.5;
          this.breakProp(p, impulse, hitPoint);
          return true;
        },
      });
    }
    return out;
  }

  public handleVehicleImpact(vehiclePos: THREE.Vector3, vehicleYaw: number, speed: number): void {
    if (Math.abs(speed) < 2.2) return;
    const fwdX = Math.sin(vehicleYaw);
    const fwdZ = Math.cos(vehicleYaw);

    for (const p of this.props) {
      if (p.broken) continue;
      const dx = p.group.position.x - vehiclePos.x;
      const dz = p.group.position.z - vehiclePos.z;
      if (dx * dx + dz * dz < 4.6) {
        const launch = new THREE.Vector3(
          fwdX * Math.abs(speed) * 0.65 + (Math.random() - 0.5) * 3,
          3.8 + Math.min(4.5, Math.abs(speed) * 0.25),
          fwdZ * Math.abs(speed) * 0.65 + (Math.random() - 0.5) * 3,
        );
        this.breakProp(p, launch, p.group.position);
      }
    }
  }

  private breakProp(p: DestructibleProp, impulse: THREE.Vector3, _origin: THREE.Vector3): void {
    if (p.broken) return;
    p.broken = true;
    p.vel.copy(impulse);
    p.angVel.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    p.respawnTimer = 26.0;
    if (p.kind === 'hydrant') {
      p.geyserTimer = 11.0;
    }
    this.onPropSmashed?.(p.kind);
  }

  public update(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);
    this.sprayTick += clampedDt;

    for (const p of this.props) {
      if (!p.broken) continue;

      // Tumbling broken prop physics
      if (p.group.position.y > 0.22 || p.vel.y > 0) {
        p.vel.y -= 16 * clampedDt;
        p.group.position.addScaledVector(p.vel, clampedDt);
        p.group.rotation.x += p.angVel.x * clampedDt;
        p.group.rotation.y += p.angVel.y * clampedDt;
        p.group.rotation.z += p.angVel.z * clampedDt;
        if (p.group.position.y <= 0.22) {
          p.group.position.y = 0.22;
          p.vel.multiplyScalar(0.35);
          p.vel.y = 0;
          p.angVel.multiplyScalar(0.35);
        }
      }

      // Pressurized hydrant water geyser fountain!
      if (p.kind === 'hydrant' && p.geyserTimer > 0) {
        p.geyserTimer -= clampedDt;
        if (this.sprayTick > 0.03) {
          for (let k = 0; k < 2; k++) {
            const mat = new THREE.MeshBasicMaterial({
              color: k === 0 ? '#7ff6ff' : '#e6ffff',
              transparent: true,
              opacity: 0.85,
            });
            const drop = new THREE.Mesh(this.dropGeo, mat);
            drop.position.set(
              p.spawnPos.x + (Math.random() - 0.5) * 0.2,
              0.35,
              p.spawnPos.z + (Math.random() - 0.5) * 0.2,
            );
            this.scene.add(drop);
            this.drops.push({
              mesh: drop,
              vel: new THREE.Vector3(
                (Math.random() - 0.5) * 1.9,
                7.2 + Math.random() * 2.8,
                (Math.random() - 0.5) * 1.9,
              ),
              life: 0.95,
              maxLife: 0.95,
            });
          }
        }
      }

      // Respawn cleanly
      p.respawnTimer -= clampedDt;
      if (p.respawnTimer <= 0) {
        p.broken = false;
        p.geyserTimer = 0;
        p.vel.set(0, 0, 0);
        p.angVel.set(0, 0, 0);
        p.group.position.copy(p.spawnPos);
        p.group.rotation.set(0, 0, 0);
      }
    }

    if (this.sprayTick > 0.03) this.sprayTick = 0;

    // Update geyser water particles
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= clampedDt;
      if (d.life <= 0 || d.mesh.position.y < 0.05) {
        this.scene.remove(d.mesh);
        (d.mesh.material as THREE.Material).dispose();
        this.drops.splice(i, 1);
      } else {
        d.vel.y -= 15.5 * clampedDt;
        d.mesh.position.addScaledVector(d.vel, clampedDt);
        (d.mesh.material as THREE.MeshBasicMaterial).opacity = (d.life / d.maxLife) * 0.85;
      }
    }
  }

  private createHydrant(id: string, x: number, z: number): void {
    const group = new THREE.Group();
    const spawnPos = new THREE.Vector3(x, 0.18, z);
    group.position.copy(spawnPos);

    const redMat = new THREE.MeshStandardMaterial({ color: '#e63956', roughness: 0.35, metalness: 0.55 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#f2e8df', roughness: 0.3, metalness: 0.6 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.72, 10), redMat);
    body.position.y = 0.36;
    body.castShadow = true;
    group.add(body);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), capMat);
    dome.position.y = 0.72;
    group.add(dome);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.44, 8), capMat);
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.y = 0.52;
    group.add(nozzle);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.7), this.hitboxMat);
    hitbox.position.y = 0.45;
    group.add(hitbox);

    this.scene.add(group);
    this.props.push({
      id,
      kind: 'hydrant',
      group,
      hitbox,
      spawnPos,
      broken: false,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      geyserTimer: 0,
      respawnTimer: 0,
    });
  }

  private createCafeTable(id: string, x: number, z: number, umbrellaColor: string): void {
    const group = new THREE.Group();
    const spawnPos = new THREE.Vector3(x, 0.22, z);
    group.position.copy(spawnPos);

    const metalMat = new THREE.MeshStandardMaterial({ color: '#ece3dc', roughness: 0.4, metalness: 0.5 });
    const umbMat = new THREE.MeshStandardMaterial({
      color: umbrellaColor,
      emissive: umbrellaColor,
      emissiveIntensity: 0.25,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 8), metalMat);
    pole.position.y = 1.15;
    group.add(pole);

    const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.07, 12), metalMat);
    tableTop.position.y = 0.78;
    tableTop.castShadow = true;
    group.add(tableTop);

    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.48, 8), umbMat);
    canopy.position.y = 2.32;
    canopy.castShadow = true;
    group.add(canopy);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 1.5), this.hitboxMat);
    hitbox.position.y = 1.25;
    group.add(hitbox);

    this.scene.add(group);
    this.props.push({
      id,
      kind: 'cafe',
      group,
      hitbox,
      spawnPos,
      broken: false,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      geyserTimer: 0,
      respawnTimer: 0,
    });
  }

  private createTrashBin(id: string, x: number, z: number): void {
    const group = new THREE.Group();
    const spawnPos = new THREE.Vector3(x, 0.2, z);
    group.position.copy(spawnPos);

    const bodyMat = new THREE.MeshStandardMaterial({ color: '#2b2238', roughness: 0.5, metalness: 0.5 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#36f1e6',
      emissive: '#36f1e6',
      emissiveIntensity: 1.4,
    });

    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.88, 10), bodyMat);
    bin.position.y = 0.44;
    bin.castShadow = true;
    group.add(bin);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.88;
    group.add(rim);

    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.0, 0.75), this.hitboxMat);
    hitbox.position.y = 0.5;
    group.add(hitbox);

    this.scene.add(group);
    this.props.push({
      id,
      kind: 'bin',
      group,
      hitbox,
      spawnPos,
      broken: false,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      geyserTimer: 0,
      respawnTimer: 0,
    });
  }
}
