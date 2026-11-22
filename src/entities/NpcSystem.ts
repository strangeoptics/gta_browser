import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import { BLOCK_CENTERS } from '../world/CityLayout';
import type { PlayerGlbOutfitStyle } from './CharacterTextures';
import {
  instantiateGlbCharacter,
  styleGlbNpcInstance,
  whenGlbCharacterReady,
  type CharacterBuildType,
  type GlbCharacterInstance,
} from './GlbCharacterFactory';

export type NpcRole = 'civilian' | 'police' | 'bounty' | 'guard';

export interface NpcEntity {
  id: string;
  role: NpcRole;
  group: THREE.Group;
  hitbox: THREE.Mesh;
  bodyRoot: THREE.Group;
  glb: GlbCharacterInstance | null;
  position: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  state: 'walk' | 'flee' | 'pursue' | 'attack';
  walkPhase: number;
  fireCooldown: number;
  flinchTimer: number;
  muzzleTimer: number;
  fallProgress: number;
  fallDir: number;
  targetPos: THREE.Vector3;
  patrolPoints?: THREE.Vector3[];
  patrolIdx?: number;
  aimBlend: number;
  lodTick: number;
  muzzleFlash?: THREE.Mesh;
  deathTimer: number;
}

interface EnemyTracer {
  line: THREE.Line;
  life: number;
}

const CIV_SHIRTS = ['#ff7eb3', '#36f1e6', '#ffbe6b', '#d9b8ff', '#fff0d9', '#7ef2c8', '#ff8b7b'];
const CIV_ACCENTS = ['#36f1e6', '#ff4fa3', '#fff4e6', '#ff9f43', '#2d6a4f'];
const SKIN_TONES = ['#e8ba9b', '#d69c77', '#b87a56', '#8c563c', '#f2cbb0'];
const HAIR_COLORS = ['#22181c', '#4a2e1f', '#8c5a32', '#d9b06a', '#1b1620'];

// Private Safehouse footprint (40, -40) — NPCs may never enter the player's safe space
const SAFEHOUSE_NO_ENTRY: AABB = {
  minX: 29.0,
  maxX: 51.0,
  minY: 0,
  maxY: 5.0,
  minZ: -50.0,
  maxZ: -30.0,
  tag: 'safehouse-no-entry',
};

const NPC_RADIUS = 0.42;

export class NpcSystem {
  public readonly npcs: NpcEntity[] = [];
  private readonly scene: THREE.Scene;
  private readonly enemyTracers: EnemyTracer[] = [];
  private readonly hitboxGeo = new THREE.BoxGeometry(0.68, 1.88, 0.54);
  private readonly hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  private nextId = 1;
  private guardAlertTimer = 0;
  private guardRespawnTimer = 0;

  public onPlayerDamaged?: (amount: number) => void;
  public onNpcKilled?: (npc: NpcEntity) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let i = 0; i < 12; i++) {
      this.spawnCivilian();
    }
    this.spawnEstateGuards();
  }

  public alertEstateGuards(): void {
    this.guardAlertTimer = 30.0;
  }

  public spawnEstateGuards(): void {
    const guardRoutes: [THREE.Vector3, THREE.Vector3][] = [
      // 2 Front Colonnade Guards outside STARFISH ESTATE
      [new THREE.Vector3(174.6, 0.68, -61.5), new THREE.Vector3(174.6, 0.68, -56.2)],
      [new THREE.Vector3(174.6, 0.68, -53.8), new THREE.Vector3(174.6, 0.68, -48.5)],
      // 2 Foyer Bodyguards inside STARFISH ESTATE guarding the $2,500 Gold Vault
      [new THREE.Vector3(182.8, 0.71, -60.5), new THREE.Vector3(182.8, 0.71, -56.5)],
      [new THREE.Vector3(182.8, 0.71, -53.5), new THREE.Vector3(182.8, 0.71, -49.5)],
      // 1 Helipad / Roundabout Perimeter Guard
      [new THREE.Vector3(166.5, 0.68, -67.0), new THREE.Vector3(171.5, 0.68, -60.0)],
      // 1 Superyacht "LADY VICE" Aft Deck Guard
      [new THREE.Vector3(169.2, 1.42, -2.5), new THREE.Vector3(174.8, 1.42, -2.5)],
    ];

    for (const [pA, pB] of guardRoutes) {
      const g = this.createNpc('guard', pA.x, pA.z, '#1c1828', 85, pA.y);
      g.patrolPoints = [pA, pB];
      g.patrolIdx = 1;
      g.targetPos.copy(pB);
    }
  }

  public spawnCivilian(): NpcEntity {
    const spot = this.randomSidewalkPoint();
    const shirt = CIV_SHIRTS[this.nextId % CIV_SHIRTS.length];
    return this.createNpc('civilian', spot.x, spot.z, shirt, 45);
  }

  public spawnPoliceNear(playerPos: THREE.Vector3, blockers: AABB[] = []): NpcEntity {
    // Dispatch reinforcements directly from Vice PD Precinct 06 (-40, 0) when within range!
    const distToPrecinct = Math.hypot(playerPos.x - -40, playerPos.z - 0);
    if (distToPrecinct < 65 && distToPrecinct > 14) {
      const px = -27.2 + (Math.random() - 0.5) * 1.4;
      const pz = (Math.random() - 0.5) * 5.0;
      if (!this.overlapsAny(px, pz, NPC_RADIUS + 0.25, blockers)) {
        const officer = this.createNpc('police', px, pz, '#1e325c', 75);
        officer.state = 'pursue';
        return officer;
      }
    }

    let x = THREE.MathUtils.clamp(playerPos.x + 28, -62, 66);
    let z = THREE.MathUtils.clamp(playerPos.z, -62, 62);
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 14;
      const cx = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -62, 66);
      const cz = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -62, 62);
      if (!this.overlapsAny(cx, cz, NPC_RADIUS + 0.25, blockers)) {
        x = cx;
        z = cz;
        break;
      }
    }
    const officer = this.createNpc('police', x, z, '#1e325c', 75);
    officer.state = 'pursue';
    return officer;
  }

  public isPoliceBustingPlayer(playerPos: THREE.Vector3, maxDist: number): boolean {
    const maxSq = maxDist * maxDist;
    for (const n of this.npcs) {
      if (!n.alive || n.role !== 'police') continue;
      if (Math.abs(n.position.y - playerPos.y) > 2.4) continue;
      if (n.position.distanceToSquared(playerPos) < maxSq) {
        return true;
      }
    }
    return false;
  }

  public spawnBountyTarget(x: number, z: number, y = 0.2): NpcEntity {
    const boss = this.createNpc('bounty', x, z, '#f5f0eb', 110, y);
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
        npc.flinchTimer = 0.22;
        if (npc.hp <= 0) {
          this.killNpc(npc);
        } else if (npc.role === 'civilian') {
          npc.state = 'flee';
        }
      }
    }
  }

  /**
   * Blasts nearby pedestrians & police officers backward with the firetruck's high-pressure water cannon!
   * Returns counts of civilians and police pushed so callers can trigger SFX or mild Wanted heat.
   */
  public applyWaterCannonPush(
    impactPos: THREE.Vector3,
    pushDirX: number,
    pushDirZ: number,
    radius: number,
    dt: number,
    worldColliders: AABB[],
  ): { civiliansHit: number; policeHit: number } {
    const rSq = radius * radius;
    const blockers: AABB[] = [SAFEHOUSE_NO_ENTRY, ...worldColliders];
    let civiliansHit = 0;
    let policeHit = 0;
    const pushSpeed = 12.5;

    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const dx = npc.position.x - impactPos.x;
      const dz = npc.position.z - impactPos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > rSq) continue;

      const resolved = this.moveWithWallSlide(
        npc.position.x,
        npc.position.z,
        pushDirX * pushSpeed * dt,
        pushDirZ * pushSpeed * dt,
        NPC_RADIUS,
        blockers,
        npc.position.y,
      );
      npc.position.x = resolved.x;
      npc.position.z = resolved.z;
      npc.group.position.set(npc.position.x, npc.position.y, npc.position.z);
      npc.flinchTimer = 0.34;
      npc.fireCooldown = Math.max(npc.fireCooldown, 0.7);
      if (npc.role === 'civilian') {
        npc.state = 'flee';
        civiliansHit++;
      } else if (npc.role === 'police') {
        policeHit++;
      }
    }
    return { civiliansHit, policeHit };
  }

  public getShootableTargets(): ShootableTarget[] {
    const out: ShootableTarget[] = [];
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      out.push({
        id: npc.id,
        mesh: npc.hitbox,
        onHit: (damage: number) => {
          npc.hp -= damage;
          npc.flinchTimer = 0.18;
          if (npc.role === 'civilian') npc.state = 'flee';
          else {
            npc.state = 'pursue';
            if (npc.role === 'guard') this.guardAlertTimer = 28.0;
          }

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

  /**
   * Returns solid AABB colliders for all living NPCs so the player cannot walk through people.
   */
  public getNpcColliders(): AABB[] {
    const out: AABB[] = [];
    const halfW = 0.34;
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      out.push({
        minX: npc.position.x - halfW,
        maxX: npc.position.x + halfW,
        minY: npc.position.y,
        maxY: npc.position.y + 1.85,
        minZ: npc.position.z - halfW,
        maxZ: npc.position.z + halfW,
        tag: 'npc',
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

  public removeNpc(target: NpcEntity | null | undefined): void {
    if (!target) return;
    const idx = this.npcs.indexOf(target);
    if (idx !== -1) {
      this.scene.remove(target.group);
      this.npcs.splice(idx, 1);
    }
  }

  public clearPolice(): void {
    this.guardAlertTimer = 0;
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
    npc.deathTimer = 5.5;
    npc.fallProgress = 0;
    npc.fallDir = Math.random() > 0.5 ? 1 : -1;
    if (npc.muzzleFlash) npc.muzzleFlash.visible = false;
    this.onNpcKilled?.(npc);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    wantedStars: number,
    worldColliders: AABB[] = [],
    playerCover?: { inCover: boolean; peeking: boolean; normalX: number; normalZ: number },
  ): void {
    const clampedDt = Math.min(dt, 0.05);

    // worldColliders passed from main.ts are already pre-filtered to solid NPC blockers
    const blockers: AABB[] = [SAFEHOUSE_NO_ENTRY, ...worldColliders];

    const desiredPolice = wantedStars === 0 ? 0 : Math.min(7, wantedStars + 1);
    if (this.getAlivePoliceCount() < desiredPolice && Math.random() < clampedDt * 0.9) {
      this.spawnPoliceNear(playerPos, blockers);
    }

    const aliveCivs = this.npcs.filter((n) => n.alive && n.role === 'civilian').length;
    if (aliveCivs < 10 && Math.random() < clampedDt * 0.6) {
      this.spawnCivilian();
    }

    if (this.guardAlertTimer > 0) {
      this.guardAlertTimer = Math.max(0, this.guardAlertTimer - clampedDt);
    }
    const aliveGuards = this.npcs.filter((n) => n.alive && n.role === 'guard').length;
    if (aliveGuards === 0) {
      this.guardRespawnTimer += clampedDt;
      if (this.guardRespawnTimer > 45.0 && playerPos.x < 135) {
        this.guardRespawnTimer = 0;
        this.spawnEstateGuards();
      }
    } else {
      this.guardRespawnTimer = 0;
    }

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];

      if (!npc.alive) {
        // Play skeletal Man_Death animation (with smooth fallback fall if GLB still loading)
        if (npc.glb) {
          npc.glb.playAnim('death', 0.12);
          npc.glb.mixer.update(clampedDt);
        } else {
          npc.fallProgress = Math.min(1, npc.fallProgress + clampedDt * 3.4);
          const eased = 1 - Math.pow(1 - npc.fallProgress, 2);
          npc.bodyRoot.rotation.x = -eased * (Math.PI / 2);
          npc.bodyRoot.rotation.z = eased * npc.fallDir * 0.24;
          npc.bodyRoot.position.y = eased * 0.16;
        }

        npc.deathTimer -= clampedDt;
        if (npc.deathTimer <= 0) {
          this.scene.remove(npc.group);
          this.npcs.splice(i, 1);
        }
        continue;
      }

      // Muzzle flash decay
      if (npc.muzzleTimer > 0) {
        npc.muzzleTimer -= clampedDt;
        if (npc.muzzleTimer <= 0 && npc.muzzleFlash) {
          npc.muzzleFlash.visible = false;
        }
      }

      // Hit flinch tilt recovery
      if (npc.flinchTimer > 0) {
        npc.flinchTimer = Math.max(0, npc.flinchTimer - clampedDt);
      }
      const targetFlinch = npc.flinchTimer > 0 ? -0.28 : 0;
      npc.bodyRoot.rotation.x += (targetFlinch - npc.bodyRoot.rotation.x) * (1 - Math.exp(-16 * clampedDt));

      const toPlayerX = playerPos.x - npc.position.x;
      const toPlayerZ = playerPos.z - npc.position.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      let moveX = 0;
      let moveZ = 0;
      let moveSpeed = 0;
      let aiming = false;

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
        const playerTrespassing = playerPos.x > 147 && distToPlayer < 21;
        const shouldEngage =
          npc.role === 'police'
            ? wantedStars > 0
            : npc.role === 'guard'
              ? playerTrespassing || this.guardAlertTimer > 0 || npc.hp < npc.maxHp
              : distToPlayer < 34 || npc.hp < npc.maxHp;

        if (!shouldEngage) {
          if (npc.role === 'police' && wantedStars === 0) {
            npc.state = 'walk';
            if (distToPlayer > 18) {
              this.scene.remove(npc.group);
              this.npcs.splice(i, 1);
              continue;
            }
          }
          const dx = npc.targetPos.x - npc.position.x;
          const dz = npc.targetPos.z - npc.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.85) {
            if (npc.patrolPoints && npc.patrolPoints.length > 0) {
              npc.patrolIdx = ((npc.patrolIdx ?? 0) + 1) % npc.patrolPoints.length;
              npc.targetPos.copy(npc.patrolPoints[npc.patrolIdx]);
            } else {
              npc.targetPos.copy(this.randomSidewalkPoint());
            }
          } else {
            moveX = dx / d;
            moveZ = dz / d;
            moveSpeed = npc.role === 'guard' ? 1.65 : 2.2;
          }
        } else {
          if (npc.role === 'guard' && playerTrespassing) {
            this.guardAlertTimer = Math.max(this.guardAlertTimer, 12.0);
          }
          aiming = distToPlayer < 28;
          const preferredRange = npc.role === 'bounty' || npc.role === 'guard' ? 13 : 17;
          if (distToPlayer > preferredRange) {
            npc.state = 'pursue';
            moveX = toPlayerX / Math.max(distToPlayer, 0.1);
            moveZ = toPlayerZ / Math.max(distToPlayer, 0.1);
            moveSpeed = npc.role === 'bounty' ? 4.8 : 4.4;
          } else {
            npc.state = 'attack';
            npc.yaw = Math.atan2(toPlayerX, toPlayerZ);
          }

          npc.fireCooldown -= clampedDt;
          if (aiming && npc.fireCooldown <= 0) {
            npc.fireCooldown = npc.role === 'bounty' ? 0.95 : 1.35;
            this.fireNpcShot(npc, playerPos, playerCover);
          }
        }
      }

      // Limb & Body Animation + Solid World/Building Wall-Sliding Collision
      const animBlend = 1 - Math.exp(-12 * clampedDt);
      if (moveSpeed > 0.05) {
        const prevX = npc.position.x;
        const prevZ = npc.position.z;
        const stepX = moveX * moveSpeed * clampedDt;
        const stepZ = moveZ * moveSpeed * clampedDt;

        // Axis-separated wall sliding so NPCs never clip through buildings, vehicles, or the Safehouse
        const resolved = this.moveWithWallSlide(prevX, prevZ, stepX, stepZ, NPC_RADIUS, blockers, npc.position.y);
        npc.position.x = resolved.x;
        npc.position.z = resolved.z;

        const actualDist = Math.hypot(npc.position.x - prevX, npc.position.z - prevZ);
        const wantedDist = moveSpeed * clampedDt;

        // If blocked head-on by a building wall while patrolling, pick next patrol or sidewalk waypoint
        if (actualDist < wantedDist * 0.28 && npc.state === 'walk') {
          if (npc.patrolPoints && npc.patrolPoints.length > 0) {
            npc.patrolIdx = ((npc.patrolIdx ?? 0) + 1) % npc.patrolPoints.length;
            npc.targetPos.copy(npc.patrolPoints[npc.patrolIdx]);
          } else {
            npc.targetPos.copy(this.randomSidewalkPoint());
          }
        }

        npc.yaw = Math.atan2(moveX, moveZ);
        npc.walkPhase += clampedDt * moveSpeed * 2.9;

        if (npc.glb) {
          const isRunning = moveSpeed > 3.5;
          npc.glb.playAnim(isRunning ? 'run' : 'walk', 0.16);
          const act = npc.glb.actions.get(isRunning ? 'run' : 'walk');
          if (act) {
            act.setEffectiveTimeScale(
              isRunning
                ? THREE.MathUtils.clamp(moveSpeed / 5.2, 0.8, 1.45)
                : THREE.MathUtils.clamp(moveSpeed / 2.2, 0.75, 1.4),
            );
          }
        }
      } else {
        if (npc.glb) {
          npc.glb.playAnim('idle', 0.2);
        }
      }

      // Distance-based LOD for AnimationMixer & castShadow so 20+ rigged GLB NPCs stay silky-smooth
      if (npc.glb) {
        const wantsShadow = distToPlayer < 52;
        if (npc.glb.meshes.length > 0 && npc.glb.meshes[0].castShadow !== wantsShadow) {
          for (const m of npc.glb.meshes) m.castShadow = wantsShadow;
        }

        npc.lodTick++;
        if (distToPlayer < 44) {
          npc.glb.mixer.update(clampedDt);
        } else if (distToPlayer < 85 && npc.lodTick % 2 === 0) {
          npc.glb.mixer.update(clampedDt * 2);
        }

        // Post-mixer procedural aim raise for armed NPCs & panic arm lift for fleeing civilians
        const targetAim = aiming ? 1 : 0;
        npc.aimBlend += (targetAim - npc.aimBlend) * animBlend;
        if (npc.aimBlend > 0.01 && npc.glb.upperArmR) {
          const recoilLift = npc.muzzleTimer > 0 ? 0.24 : 0;
          npc.glb.upperArmR.rotation.x -= (0.9 + recoilLift) * npc.aimBlend;
          if (npc.glb.lowerArmR) {
            npc.glb.lowerArmR.rotation.x -= 0.25 * npc.aimBlend;
          }
        } else if (npc.role === 'civilian' && npc.state === 'flee') {
          const panicWave = Math.sin(npc.walkPhase * 1.4) * 0.22;
          if (npc.glb.upperArmL) npc.glb.upperArmL.rotation.x -= 1.6 + panicWave;
          if (npc.glb.upperArmR) npc.glb.upperArmR.rotation.x -= 1.6 - panicWave;
        }
      }

      npc.group.position.x = npc.position.x;
      npc.group.position.z = npc.position.z;
      npc.group.rotation.y = npc.yaw;
    }

    // Soft NPC-to-NPC separation so pedestrians & police don't overlap each other
    const minSep = 0.82;
    const minSepSq = minSep * minSep;
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.npcs.length; j++) {
        const b = this.npcs[j];
        if (!b.alive) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minSepSq && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = (minSep - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          const resA = this.moveWithWallSlide(a.position.x, a.position.z, -nx * push, -nz * push, NPC_RADIUS, blockers, a.position.y);
          const resB = this.moveWithWallSlide(b.position.x, b.position.z, nx * push, nz * push, NPC_RADIUS, blockers, b.position.y);
          a.position.x = resA.x;
          a.position.z = resA.z;
          b.position.x = resB.x;
          b.position.z = resB.z;
          a.group.position.x = a.position.x;
          a.group.position.z = a.position.z;
          b.group.position.x = b.position.x;
          b.group.position.z = b.position.z;
        }
      }
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

  private fireNpcShot(
    npc: NpcEntity,
    playerPos: THREE.Vector3,
    playerCover?: { inCover: boolean; peeking: boolean; normalX: number; normalZ: number },
  ): void {
    if (npc.muzzleFlash) {
      npc.muzzleFlash.visible = true;
      npc.muzzleTimer = 0.07;
    }

    const fwdX = Math.sin(npc.yaw);
    const fwdZ = Math.cos(npc.yaw);
    const start = new THREE.Vector3(npc.position.x + fwdX * 0.55, npc.position.y + 1.32, npc.position.z + fwdZ * 0.55);
    const jitter = new THREE.Vector3(
      (Math.random() - 0.5) * 1.4,
      (Math.random() - 0.5) * 0.8 + 1.1,
      (Math.random() - 0.5) * 1.4,
    );
    const end = playerPos.clone().add(jitter);

    // Check if the player's cover wall blocks the incoming line of fire!
    let coverBlocksShot = false;
    let coverPartial = false;
    if (playerCover?.inCover) {
      const toShooterX = npc.position.x - playerPos.x;
      const toShooterZ = npc.position.z - playerPos.z;
      const shooterLen = Math.hypot(toShooterX, toShooterZ) || 1;
      // Cover normal points FROM wall TOWARD player; if shooter is on the wall side, dot < 0.25
      const dot = (toShooterX / shooterLen) * playerCover.normalX + (toShooterZ / shooterLen) * playerCover.normalZ;
      if (dot < 0.25) {
        if (!playerCover.peeking) {
          coverBlocksShot = true;
          // Impact point stops against the cover obstacle!
          end.set(
            playerPos.x - playerCover.normalX * 0.55,
            playerPos.y + 0.9 + Math.random() * 0.4,
            playerPos.z - playerCover.normalZ * 0.55,
          );
        } else {
          coverPartial = true;
        }
      }
    }

    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: npc.role === 'police' ? 0x5ec8ff : 0xff4fa3,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.enemyTracers.push({ line, life: 0.1 });

    if (coverBlocksShot) return;

    const dist = npc.position.distanceTo(playerPos);
    const baseHitChance = THREE.MathUtils.clamp(0.52 - dist * 0.012, 0.12, 0.48);
    const hitChance = coverPartial ? baseHitChance * 0.5 : baseHitChance;
    if (Math.random() < hitChance) {
      this.onPlayerDamaged?.(npc.role === 'bounty' ? 11 : 7);
    }
  }

  /**
   * Spawns a rigged Quaternius GLB NPC with varied body builds (slim, tall-lean, average,
   * muscular, heavy, stocky), UV-mapped 80s outfits, bone-mounted accessories & weapons.
   */
  private createNpc(role: NpcRole, x: number, z: number, shirtColor: string, maxHp: number, baseY = 0.18): NpcEntity {
    const seed = this.nextId++;
    const group = new THREE.Group();
    group.position.set(x, baseY, z);

    const bodyRoot = new THREE.Group();
    group.add(bodyRoot);

    const skinColor = SKIN_TONES[seed % SKIN_TONES.length];
    const hairColor = HAIR_COLORS[(seed * 3) % HAIR_COLORS.length];
    const accentColor = role === 'guard' ? '#ff3d7f' : CIV_ACCENTS[seed % CIV_ACCENTS.length];
    const wearsSunglasses = role === 'bounty' || role === 'guard' || role === 'police' || seed % 2 === 0;

    const pantsColor =
      role === 'police'
        ? '#141d33'
        : role === 'guard'
          ? '#161420'
          : role === 'bounty'
            ? '#efeae4'
            : seed % 3 === 0
              ? '#f0e2ce'
              : '#2c3047';
    const shoeColor = role === 'police' || role === 'guard' ? '#141418' : '#f4eee8';

    // Varied body builds per role (dünner, größer, muskulöser, stämmig, dicker!)
    let build: CharacterBuildType;
    if (role === 'guard') {
      const guardBuilds: CharacterBuildType[] = ['muscular', 'stocky', 'muscular', 'heavy'];
      build = guardBuilds[seed % guardBuilds.length];
    } else if (role === 'bounty') {
      build = seed % 2 === 0 ? 'muscular' : 'tall-lean';
    } else if (role === 'police') {
      const pdBuilds: CharacterBuildType[] = ['average', 'muscular', 'stocky', 'heavy'];
      build = pdBuilds[seed % pdBuilds.length];
    } else {
      const civBuilds: CharacterBuildType[] = ['slim', 'heavy', 'muscular', 'tall-lean', 'stocky', 'average'];
      build = civBuilds[seed % civBuilds.length];
    }

    let outfitStyle: PlayerGlbOutfitStyle;
    if (role === 'police') {
      outfitStyle = 'police';
    } else if (role === 'guard') {
      outfitStyle = 'midnight-neon';
    } else if (role === 'bounty') {
      outfitStyle = 'white-suit';
    } else {
      const civStyles: PlayerGlbOutfitStyle[] = ['hawaiian', 'white-suit', 'detective', 'midnight-neon'];
      outfitStyle = civStyles[seed % civStyles.length];
    }

    const hitbox = new THREE.Mesh(this.hitboxGeo, this.hitboxMat);
    hitbox.position.y = 0.94;
    group.add(hitbox);

    this.scene.add(group);

    const npc: NpcEntity = {
      id: `npc-${seed}`,
      role,
      group,
      hitbox,
      bodyRoot,
      glb: null,
      position: new THREE.Vector3(x, baseY, z),
      yaw: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      alive: true,
      state: 'walk',
      walkPhase: Math.random() * 6,
      fireCooldown: 0.6 + Math.random() * 0.8,
      flinchTimer: 0,
      muzzleTimer: 0,
      fallProgress: 0,
      fallDir: 1,
      targetPos: this.randomSidewalkPoint(),
      aimBlend: 0,
      lodTick: seed % 2,
      deathTimer: 0,
    };

    whenGlbCharacterReady((tpl) => {
      // Skip attaching if this NPC already despawned before GLB finished loading
      if (!this.npcs.includes(npc)) return;

      const inst = instantiateGlbCharacter(tpl, build);
      styleGlbNpcInstance(inst, {
        role,
        build,
        skinColor,
        hairColor,
        outfitStyle,
        primaryColor: role === 'bounty' ? '#f5f0eb' : shirtColor,
        accentColor,
        pantsColor,
        shoeColor,
        wearsSunglasses,
        policeCap: role === 'police',
        goldChain: role === 'bounty' || role === 'guard' || (role === 'civilian' && seed % 5 === 0),
        coastalCap: role === 'civilian' && seed % 3 === 2,
        withHalo: role === 'bounty',
      });

      // Attach 3D firearm + muzzle flash to right hand bone for armed roles
      if ((role === 'police' || role === 'bounty' || role === 'guard') && inst.rightHandBone) {
        const weaponAnchor = new THREE.Group();
        const boneWorldScale = new THREE.Vector3();
        inst.model.updateMatrixWorld(true);
        inst.rightHandBone.getWorldScale(boneWorldScale);
        weaponAnchor.scale.set(
          1 / Math.max(boneWorldScale.x, 0.0001),
          1 / Math.max(boneWorldScale.y, 0.0001),
          1 / Math.max(boneWorldScale.z, 0.0001),
        );
        weaponAnchor.position.set(0, 0.0012, 0);
        inst.rightHandBone.add(weaponAnchor);

        const gunMat = new THREE.MeshStandardMaterial({
          color: '#24202b',
          metalness: 0.75,
          roughness: 0.3,
          flatShading: true,
        });
        const barrelLen = role === 'bounty' ? 0.34 : 0.25;
        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, barrelLen), gunMat);
        gun.position.set(0, 0.04, barrelLen * 0.42);
        weaponAnchor.add(gun);

        const flash = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.09, 0),
          new THREE.MeshBasicMaterial({ color: role === 'bounty' ? '#ff4fa3' : '#ffcf66' }),
        );
        flash.position.set(0, 0.04, barrelLen * 0.92);
        flash.visible = false;
        weaponAnchor.add(flash);
        npc.muzzleFlash = flash;
      }

      inst.playAnim(npc.alive ? 'walk' : 'death', 0);
      bodyRoot.add(inst.model);
      npc.glb = inst;
    });

    this.npcs.push(npc);
    return npc;
  }

  private overlapsAny(x: number, z: number, radius: number, blockers: AABB[]): boolean {
    for (const box of blockers) {
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        return true;
      }
    }
    return false;
  }

  private moveWithWallSlide(
    startX: number,
    startZ: number,
    dx: number,
    dz: number,
    radius: number,
    blockers: AABB[],
    npcY = 0.18,
  ): { x: number; z: number } {
    const onIslandZone = startX > 135;
    const minX = onIslandZone ? 149 : -65;
    const maxX = onIslandZone ? 196 : 72;
    const minZ = onIslandZone ? -83 : -65;
    const maxZ = onIslandZone ? 35 : 65;

    // Resolve X axis first (only against obstacles taller than current floor + 0.35m!)
    let x = THREE.MathUtils.clamp(startX + dx, minX, maxX);
    let z = startZ;
    for (const box of blockers) {
      if (box.maxY <= npcY + 0.35 || box.minY >= npcY + 1.8) continue;
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        if (dx > 0) x = box.minX - radius;
        else if (dx < 0) x = box.maxX + radius;
        else {
          const pLeft = box.minX - (x + radius);
          const pRight = box.maxX - (x - radius);
          x += Math.abs(pLeft) < Math.abs(pRight) ? pLeft : pRight;
        }
      }
    }

    // Resolve Z axis second
    z = THREE.MathUtils.clamp(startZ + dz, minZ, maxZ);
    for (const box of blockers) {
      if (box.maxY <= npcY + 0.35 || box.minY >= npcY + 1.8) continue;
      if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
        if (dz > 0) z = box.minZ - radius;
        else if (dz < 0) z = box.maxZ + radius;
        else {
          const pBack = box.minZ - (z + radius);
          const pFront = box.maxZ - (z - radius);
          z += Math.abs(pBack) < Math.abs(pFront) ? pBack : pFront;
        }
      }
    }

    return { x, z };
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
