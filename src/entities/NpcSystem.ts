import * as THREE from 'three';
import type { ShootableTarget } from '../combat/WeaponSystem';
import { BLOCK_CENTERS } from '../world/CityLayout';

export type NpcRole = 'civilian' | 'police' | 'bounty';

export interface NpcEntity {
  id: string;
  role: NpcRole;
  group: THREE.Group;
  position: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  state: 'walk' | 'flee' | 'pursue' | 'attack';
  walkPhase: number;
  fireCooldown: number;
  targetPos: THREE.Vector3;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  deathTimer: number;
}

interface EnemyTracer {
  line: THREE.Line;
  life: number;
}

const CIV_SHIRTS = ['#ff7eb3', '#36f1e6', '#ffbe6b', '#d9b8ff', '#fff0d9', '#7ef2c8'];

export class NpcSystem {
  public readonly npcs: NpcEntity[] = [];
  private readonly scene: THREE.Scene;
  private readonly enemyTracers: EnemyTracer[] = [];
  private nextId = 1;

  public onPlayerDamaged?: (amount: number) => void;
  public onNpcKilled?: (npc: NpcEntity) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Spawn initial coastal pedestrians around the blocks
    for (let i = 0; i < 12; i++) {
      this.spawnCivilian();
    }
  }

  public spawnCivilian(): NpcEntity {
    const spot = this.randomSidewalkPoint();
    const shirt = CIV_SHIRTS[this.nextId % CIV_SHIRTS.length];
    return this.createNpc('civilian', spot.x, spot.z, shirt, 45);
  }

  public spawnPoliceNear(playerPos: THREE.Vector3): NpcEntity {
    // Pick a street corner ~28-44m away from the player
    const angle = Math.random() * Math.PI * 2;
    const dist = 28 + Math.random() * 14;
    const x = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -62, 66);
    const z = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -62, 62);
    const officer = this.createNpc('police', x, z, '#1e325c', 75);
    officer.state = 'pursue';
    return officer;
  }

  public spawnBountyTarget(x: number, z: number): NpcEntity {
    const boss = this.createNpc('bounty', x, z, '#ff2e88', 110);
    boss.state = 'walk';
    return boss;
  }

  public alertNearbyCivilians(origin: THREE.Vector3, radius = 26): void {
    const rSq = radius * radius;
    for (const npc of this.npcs) {
      if (!npc.alive || npc.role !== 'civilian') continue;
      if (npc.position.distanceToSquared(origin) < rSq) {
        npc.state = 'flee';
      }
    }
  }

  public handleVehicleImpact(vehiclePos: THREE.Vector3, speed: number): void {
    if (speed < 5) return;
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      if (npc.position.distanceToSquared(vehiclePos) < 4.4) {
        this.killNpc(npc);
      }
    }
  }

  public applyBlastDamage(origin: THREE.Vector3, radius: number, maxDamage: number): void {
    const rSq = radius * radius;
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const dSq = npc.position.distanceToSquared(origin);
      if (dSq < rSq) {
        const dist = Math.sqrt(dSq);
        const dmg = maxDamage * (1 - dist / radius);
        npc.hp -= dmg;
        if (npc.hp <= 0) {
          this.killNpc(npc);
        } else if (npc.role === 'civilian') {
          npc.state = 'flee';
        }
      }
    }
  }

  public getShootableTargets(): ShootableTarget[] {
    const out: ShootableTarget[] = [];
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      out.push({
        id: npc.id,
        mesh: npc.group,
        onHit: (damage: number) => {
          npc.hp -= damage;
          if (npc.role === 'civilian') npc.state = 'flee';
          else npc.state = 'pursue';

          if (npc.hp <= 0) {
            this.killNpc(npc);
            return true;
          }
          return false;
        },
      });
    }
    return out;
  }

  public getAlivePoliceCount(): number {
    let count = 0;
    for (const n of this.npcs) {
      if (n.alive && n.role === 'police') count++;
    }
    return count;
  }

  public clearPolice(): void {
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (n.role === 'police') {
        this.scene.remove(n.group);
        this.npcs.splice(i, 1);
      }
    }
  }

  private killNpc(npc: NpcEntity): void {
    if (!npc.alive) return;
    npc.alive = false;
    npc.deathTimer = 5.0;
    npc.group.rotation.x = -Math.PI / 2;
    npc.group.position.y = 0.25;
    this.onNpcKilled?.(npc);
  }

  public update(dt: number, playerPos: THREE.Vector3, wantedStars: number): void {
    const clampedDt = Math.min(dt, 0.05);

    // Maintain police presence matching Wanted Level
    const desiredPolice = wantedStars === 0 ? 0 : Math.min(7, wantedStars + 1);
    if (this.getAlivePoliceCount() < desiredPolice && Math.random() < clampedDt * 0.9) {
      this.spawnPoliceNear(playerPos);
    }

    // Keep at least 10 civilians alive in the district
    const aliveCivs = this.npcs.filter((n) => n.alive && n.role === 'civilian').length;
    if (aliveCivs < 10 && Math.random() < clampedDt * 0.6) {
      this.spawnCivilian();
    }

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];

      if (!npc.alive) {
        npc.deathTimer -= clampedDt;
        if (npc.deathTimer <= 0) {
          this.scene.remove(npc.group);
          this.npcs.splice(i, 1);
        }
        continue;
      }

      const toPlayerX = playerPos.x - npc.position.x;
      const toPlayerZ = playerPos.z - npc.position.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      let moveX = 0;
      let moveZ = 0;
      let moveSpeed = 0;

      if (npc.role === 'civilian') {
        if (npc.state === 'flee') {
          if (distToPlayer > 36) {
            npc.state = 'walk';
          } else {
            moveX = -toPlayerX / Math.max(distToPlayer, 0.1);
            moveZ = -toPlayerZ / Math.max(distToPlayer, 0.1);
            moveSpeed = 5.2;
          }
        } else {
          const dx = npc.targetPos.x - npc.position.x;
          const dz = npc.targetPos.z - npc.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.5) {
            npc.targetPos.copy(this.randomSidewalkPoint());
          } else {
            moveX = dx / d;
            moveZ = dz / d;
            moveSpeed = 1.9;
          }
        }
      } else {
        // Police or Bounty Enforcer AI
        const shouldEngage = npc.role === 'police' ? wantedStars > 0 : distToPlayer < 34 || npc.hp < npc.maxHp;

        if (!shouldEngage) {
          if (npc.role === 'police' && wantedStars === 0 && distToPlayer > 35) {
            // Despawn distant idle cops when heat clears
            this.scene.remove(npc.group);
            this.npcs.splice(i, 1);
            continue;
          }
          const dx = npc.targetPos.x - npc.position.x;
          const dz = npc.targetPos.z - npc.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.5) {
            npc.targetPos.copy(this.randomSidewalkPoint());
          } else {
            moveX = dx / d;
            moveZ = dz / d;
            moveSpeed = 2.2;
          }
        } else {
          const preferredRange = npc.role === 'bounty' ? 14 : 17;
          if (distToPlayer > preferredRange) {
            npc.state = 'pursue';
            moveX = toPlayerX / Math.max(distToPlayer, 0.1);
            moveZ = toPlayerZ / Math.max(distToPlayer, 0.1);
            moveSpeed = npc.role === 'bounty' ? 4.8 : 4.4;
          } else {
            npc.state = 'attack';
            npc.yaw = Math.atan2(toPlayerX, toPlayerZ);
          }

          // Shoot at player when in range
          npc.fireCooldown -= clampedDt;
          if (distToPlayer < 28 && npc.fireCooldown <= 0) {
            npc.fireCooldown = npc.role === 'bounty' ? 0.95 : 1.35;
            this.fireNpcShot(npc, playerPos);
          }
        }
      }

      if (moveSpeed > 0.05) {
        npc.position.x = THREE.MathUtils.clamp(npc.position.x + moveX * moveSpeed * clampedDt, -65, 72);
        npc.position.z = THREE.MathUtils.clamp(npc.position.z + moveZ * moveSpeed * clampedDt, -65, 65);
        npc.yaw = Math.atan2(moveX, moveZ);

        npc.walkPhase += clampedDt * moveSpeed * 2.8;
        const swing = Math.sin(npc.walkPhase) * 0.55;
        npc.leftLeg.rotation.x = swing;
        npc.rightLeg.rotation.x = -swing;
      } else {
        npc.leftLeg.rotation.x *= 0.85;
        npc.rightLeg.rotation.x *= 0.85;
      }

      npc.group.position.x = npc.position.x;
      npc.group.position.z = npc.position.z;
      npc.group.rotation.y = npc.yaw;
    }

    // Update enemy tracers
    for (let i = this.enemyTracers.length - 1; i >= 0; i--) {
      const t = this.enemyTracers[i];
      t.life -= clampedDt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.enemyTracers.splice(i, 1);
      }
    }
  }

  private fireNpcShot(npc: NpcEntity, playerPos: THREE.Vector3): void {
    const start = new THREE.Vector3(npc.position.x, npc.position.y + 1.35, npc.position.z);
    const jitter = new THREE.Vector3(
      (Math.random() - 0.5) * 1.4,
      (Math.random() - 0.5) * 0.8 + 1.1,
      (Math.random() - 0.5) * 1.4,
    );
    const end = playerPos.clone().add(jitter);

    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: npc.role === 'police' ? 0x5ec8ff : 0xff4fa3,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.enemyTracers.push({ line, life: 0.1 });

    // Fair hit probability based on distance
    const dist = npc.position.distanceTo(playerPos);
    const hitChance = THREE.MathUtils.clamp(0.52 - dist * 0.012, 0.12, 0.48);
    if (Math.random() < hitChance) {
      this.onPlayerDamaged?.(npc.role === 'bounty' ? 11 : 7);
    }
  }

  private createNpc(role: NpcRole, x: number, z: number, shirtColor: string, maxHp: number): NpcEntity {
    const group = new THREE.Group();
    group.position.set(x, 0.18, z);

    const skinMat = new THREE.MeshStandardMaterial({ color: '#d9a484', roughness: 0.75 });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      emissive: role === 'bounty' ? '#ff2e88' : '#000000',
      emissiveIntensity: role === 'bounty' ? 0.5 : 0,
      roughness: 0.65,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: role === 'police' ? '#141a2b' : '#352b42',
      roughness: 0.8,
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.28), shirtMat);
    torso.position.y = 1.08;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);

    if (role === 'police') {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.12, 0.38),
        new THREE.MeshStandardMaterial({ color: '#132245', roughness: 0.6 }),
      );
      cap.position.set(0, 1.82, 0.03);
      group.add(cap);
    } else if (role === 'bounty') {
      // Glowing marker halo above bounty target
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.04, 8, 16),
        new THREE.MeshBasicMaterial({ color: '#ff4fa3' }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 2.05;
      group.add(halo);
    }

    const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.2);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.14, 0.36, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.14, 0.36, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    this.scene.add(group);

    const npc: NpcEntity = {
      id: `npc-${this.nextId++}`,
      role,
      group,
      position: new THREE.Vector3(x, 0.18, z),
      yaw: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      alive: true,
      state: 'walk',
      walkPhase: Math.random() * 6,
      fireCooldown: 0.6 + Math.random() * 0.8,
      targetPos: this.randomSidewalkPoint(),
      leftLeg,
      rightLeg,
      deathTimer: 0,
    };
    this.npcs.push(npc);
    return npc;
  }

  private randomSidewalkPoint(): THREE.Vector3 {
    const bx = BLOCK_CENTERS[Math.floor(Math.random() * BLOCK_CENTERS.length)];
    const bz = BLOCK_CENTERS[Math.floor(Math.random() * BLOCK_CENTERS.length)];
    const edge = 12.6;
    const side = Math.floor(Math.random() * 4);
    const along = (Math.random() - 0.5) * 22;
    if (side === 0) return new THREE.Vector3(bx + edge, 0.18, bz + along);
    if (side === 1) return new THREE.Vector3(bx - edge, 0.18, bz + along);
    if (side === 2) return new THREE.Vector3(bx + along, 0.18, bz + edge);
    return new THREE.Vector3(bx + along, 0.18, bz - edge);
  }
}
