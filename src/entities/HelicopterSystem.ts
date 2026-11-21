import * as THREE from 'three';
import type { ShootableTarget } from '../combat/WeaponSystem';

interface HeliTracer {
  line: THREE.Line;
  life: number;
}

/**
 * Vice PD Police Helicopter that deploys at 3+ Wanted Stars.
 * Circles overhead at y = 23m with spinning rotors, a sweeping SpotLight searchlight
 * tracking the player on the wet streets, aerial tracer bursts, and can be shot down!
 */
export class HelicopterSystem {
  public active = false;
  public readonly position = new THREE.Vector3(0, 24, -95);
  public hp = 220;
  public readonly maxHp = 220;

  private readonly scene: THREE.Scene;
  private readonly group: THREE.Group;
  private readonly hitbox: THREE.Mesh;
  private readonly mainRotor: THREE.Group;
  private readonly tailRotor: THREE.Mesh;
  private readonly searchlight: THREE.SpotLight;
  private readonly searchTarget = new THREE.Object3D();
  private readonly tracers: HeliTracer[] = [];

  private orbitAngle = 0;
  private fireCooldown = 1.6;
  private respawnCooldown = 0;
  private crashing = false;
  private crashVelY = 0;

  public onPlayerDamaged?: (amount: number) => void;
  public onHelicopterDestroyed?: (pos: THREE.Vector3) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const built = this.createChopperMesh();
    this.group = built.group;
    this.mainRotor = built.mainRotor;
    this.tailRotor = built.tailRotor;
    this.hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.4, 7.2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.group.add(this.hitbox);
    this.group.visible = false;
    this.scene.add(this.group);

    // Sweeping aerial searchlight cone illuminating the wet post-rain streets
    this.searchlight = new THREE.SpotLight('#d8f0ff', 0, 75, Math.PI / 7.5, 0.45, 1.1);
    this.searchlight.target = this.searchTarget;
    this.scene.add(this.searchlight);
    this.scene.add(this.searchTarget);
  }

  public getShootableTargets(): ShootableTarget[] {
    if (!this.active || this.crashing) return [];
    return [
      {
        id: 'vice-pd-heli',
        mesh: this.hitbox,
        onHit: (damage: number) => {
          this.hp = Math.max(0, this.hp - damage);
          if (this.hp <= 0) {
            this.startCrash();
            return true;
          }
          return false;
        },
      },
    ];
  }

  public applyBlastDamage(origin: THREE.Vector3, radius: number, maxDamage: number): void {
    if (!this.active || this.crashing) return;
    const dist = this.position.distanceTo(origin);
    if (dist < radius + 4) {
      this.hp -= maxDamage;
      if (this.hp <= 0) this.startCrash();
    }
  }

  public clear(): void {
    this.active = false;
    this.crashing = false;
    this.group.visible = false;
    this.searchlight.intensity = 0;
  }

  private startCrash(): void {
    if (this.crashing) return;
    this.crashing = true;
    this.crashVelY = -4.5;
    this.searchlight.intensity = 0;
  }

  public update(dt: number, elapsed: number, playerPos: THREE.Vector3, wantedStars: number): void {
    const clampedDt = Math.min(dt, 0.05);

    if (this.respawnCooldown > 0) {
      this.respawnCooldown -= clampedDt;
    }

    // Deploy at 3+ Wanted Stars
    if (!this.active && !this.crashing && wantedStars >= 3 && this.respawnCooldown <= 0) {
      this.active = true;
      this.hp = this.maxHp;
      this.position.set(playerPos.x + 48, 25, playerPos.z - 48);
      this.group.rotation.set(0, 0, 0);
      this.group.visible = true;
    }

    // Retreat smoothly when Wanted clears
    if (this.active && !this.crashing && wantedStars < 2) {
      this.position.y += 12 * clampedDt;
      this.searchlight.intensity = Math.max(0, this.searchlight.intensity - 60 * clampedDt);
      if (this.position.y > 65) {
        this.clear();
      }
      this.group.position.copy(this.position);
      this.mainRotor.rotation.y += clampedDt * 26;
      this.tailRotor.rotation.x += clampedDt * 34;
      return;
    }

    if (this.active) {
      this.mainRotor.rotation.y += clampedDt * 28;
      this.tailRotor.rotation.x += clampedDt * 36;

      if (this.crashing) {
        // Spiraling fiery descent
        this.crashVelY -= 12 * clampedDt;
        this.position.y += this.crashVelY * clampedDt;
        this.group.position.copy(this.position);
        this.group.rotation.y += clampedDt * 6.5;
        this.group.rotation.z += clampedDt * 1.4;
        if (this.position.y <= 1.2) {
          const impact = this.position.clone();
          this.clear();
          this.respawnCooldown = 22.0;
          this.onHelicopterDestroyed?.(impact);
        }
      } else {
        // Orbit around the player at rooftop height
        this.orbitAngle += clampedDt * 0.48;
        const radius = 24;
        const desiredX = playerPos.x + Math.cos(this.orbitAngle) * radius;
        const desiredZ = playerPos.z + Math.sin(this.orbitAngle) * radius;
        const desiredY = 22.5 + Math.sin(elapsed * 1.3) * 1.6;

        const blend = 1 - Math.exp(-2.2 * clampedDt);
        this.position.x += (desiredX - this.position.x) * blend;
        this.position.y += (desiredY - this.position.y) * blend;
        this.position.z += (desiredZ - this.position.z) * blend;

        this.group.position.copy(this.position);
        const lookYaw = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
        this.group.rotation.y = lookYaw;
        this.group.rotation.x = 0.12; // subtle forward pitch

        // Sweeping searchlight tracking player
        this.searchlight.intensity = 95;
        this.searchlight.position.set(this.position.x, this.position.y - 1.0, this.position.z);
        this.searchTarget.position.set(
          playerPos.x + Math.sin(elapsed * 2.1) * 2.2,
          0.2,
          playerPos.z + Math.cos(elapsed * 1.8) * 2.2,
        );
        this.searchTarget.updateMatrixWorld();

        // Periodic aerial burst fire
        this.fireCooldown -= clampedDt;
        if (this.fireCooldown <= 0) {
          this.fireCooldown = 1.65;
          this.fireAtPlayer(playerPos);
        }
      }
    }

    // Update aerial tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= clampedDt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  private fireAtPlayer(playerPos: THREE.Vector3): void {
    const start = new THREE.Vector3(this.position.x, this.position.y - 1.1, this.position.z);
    const end = playerPos.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 2.4, 0.6, (Math.random() - 0.5) * 2.4),
    );
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: '#36f1e6', transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.14 });

    if (Math.random() < 0.34) {
      this.onPlayerDamaged?.(9);
    }
  }

  private createChopperMesh(): { group: THREE.Group; mainRotor: THREE.Group; tailRotor: THREE.Mesh } {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: '#171c2e', roughness: 0.35, metalness: 0.65 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#f2f6fa', roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#1b3852', roughness: 0.1, metalness: 0.85 });
    const rotorMat = new THREE.MeshStandardMaterial({ color: '#2b2b36', roughness: 0.5 });

    // Fuselage
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.55, 4.4), hullMat);
    group.add(body);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.28, 3.6), stripeMat);
    stripe.position.y = -0.1;
    group.add(stripe);

    // Cockpit canopy (+Z nose)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.15, 1.6), glassMat);
    nose.position.set(0, -0.05, 2.3);
    group.add(nose);

    // Tail boom (-Z)
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 4.6), hullMat);
    boom.position.set(0, 0.25, -4.1);
    group.add(boom);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.8), hullMat);
    fin.position.set(0, 0.65, -6.2);
    group.add(fin);

    // Landing skids
    for (const side of [-1.05, 1.05]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 3.6), rotorMat);
      skid.position.set(side, -1.15, 0.2);
      group.add(skid);
    }

    // Flashing red/blue belly beacons
    const redBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ff2244' }),
    );
    redBeacon.position.set(-0.9, -0.8, 1.2);
    group.add(redBeacon);

    const blueBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#33aaff' }),
    );
    blueBeacon.position.set(0.9, -0.8, 1.2);
    group.add(blueBeacon);

    // Main rotor
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 1.15, 0);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.06, 0.28), rotorMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 9.6), rotorMat);
    mainRotor.add(blade1, blade2);
    group.add(mainRotor);

    // Tail rotor
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.18), rotorMat);
    tailRotor.position.set(0.22, 0.65, -6.2);
    group.add(tailRotor);

    return { group, mainRotor, tailRotor };
  }
}
