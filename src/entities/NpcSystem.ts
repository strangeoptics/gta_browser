import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import { TracerPool } from '../combat/TracerPool';
import type { SpatialGrid } from '../engine/SpatialGrid';
import { BLOCK_CENTERS } from '../world/CityLayout';
import {
  buildLowPolyCharacter,
  disposeCharacter,
  type CharacterBodyType,
  type CharacterHairStyle,
  type LowPolyCharacterOptions,
} from './CharacterBuilder';

export type NpcRole = 'civilian' | 'police' | 'bounty' | 'guard';

export interface NpcEntity {
  id: string;
  role: NpcRole;
  group: THREE.Group;
  hitbox: THREE.Mesh;
  bodyRoot: THREE.Group;
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
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  muzzleFlash?: THREE.Mesh;
  deathTimer: number;
  collider: AABB;
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
  private readonly tracerPool: TracerPool;
  private readonly hitboxGeo = new THREE.BoxGeometry(0.68, 1.88, 0.54);
  private readonly hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  private readonly sharedGunGeoNormal = new THREE.BoxGeometry(0.055, 0.08, 0.25);
  private readonly sharedGunGeoBounty = new THREE.BoxGeometry(0.055, 0.08, 0.34);
  private readonly sharedGunMat = new THREE.MeshStandardMaterial({
    color: '#24202b',
    metalness: 0.75,
    roughness: 0.3,
    flatShading: true,
  });
  private readonly sharedMuzzleGeo = new THREE.OctahedronGeometry(0.09, 0);
  private readonly sharedMuzzleMatNormal = new THREE.MeshBasicMaterial({ color: '#ffcf66' });
  private readonly sharedMuzzleMatBounty = new THREE.MeshBasicMaterial({ color: '#ff4fa3' });
  private readonly blockerScratch: AABB[] = [];
  private readonly gridQueryScratch: AABB[] = [];
  private readonly npcColliderScratch: AABB[] = [];
  private readonly tmpStart = new THREE.Vector3();
  private readonly tmpEnd = new THREE.Vector3();
  private nextId = 1;
  private guardAlertTimer = 0;
  private guardRespawnTimer = 0;

  public onPlayerDamaged?: (amount: number) => void;
  public onNpcKilled?: (npc: NpcEntity) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tracerPool = new TracerPool(scene);
    this.hitboxGeo.userData.shared = true;
    this.hitboxMat.userData.shared = true;
    this.sharedGunGeoNormal.userData.shared = true;
    this.sharedGunGeoBounty.userData.shared = true;
    this.sharedGunMat.userData.shared = true;
    this.sharedMuzzleGeo.userData.shared = true;
    this.sharedMuzzleMatNormal.userData.shared = true;
    this.sharedMuzzleMatBounty.userData.shared = true;
    for (let i = 0; i < 12; i++) {
      this.spawnCivilian();
    }
    this.spawnEstateGuards();
    this.spawnActionLegends();
  }

  /**
   * Spawns two iconic 80s action-movie legends patrolling Palm City '86:
   * - Sylvester Stallone (Rambo/Cobra look: red headband, sleeveless black tank top, dog tags, muscular) along Ocean Drive
   * - Arnold Schwarzenegger (T-800 look: massive 1.98m frame, black biker leather jacket, flat-top, Terminator shades) at Central Plaza
   */
  public spawnActionLegends(): void {
    // 1. Sylvester Stallone — Ocean Drive Boardwalk strip
    const slyStart = new THREE.Vector3(64.5, 0.18, -14);
    const slyEnd = new THREE.Vector3(64.5, 0.18, 16);
    const sly = this.createCustomNpc(
      'npc-stallone',
      'civilian',
      slyStart.x,
      slyStart.z,
      160,
      slyStart.y,
      {
        role: 'civilian',
        bodyType: 'muscular',
        skinColor: '#d99e78',
        hairColor: '#171316',
        primaryColor: '#1d201c',
        accentColor: '#2a3028',
        pantsColor: '#262b22',
        shoeColor: '#141418',
        outfitVariant: 1,
        hairStyle: 'rambo',
        wearsSunglasses: true,
        hasMustache: false,
        sleeveless: true,
        dogTags: true,
        scale: 1.03,
      },
    );
    sly.patrolPoints = [slyStart, slyEnd];
    sly.patrolIdx = 1;
    sly.targetPos.copy(slyEnd);

    // 2. Arnold Schwarzenegger — Central Plaza near AMMU-NEON ("I'll be back")
    const arnieStart = new THREE.Vector3(11.5, 0.18, -12);
    const arnieEnd = new THREE.Vector3(11.5, 0.18, 14);
    const arnie = this.createCustomNpc(
      'npc-arnold',
      'civilian',
      arnieStart.x,
      arnieStart.z,
      180,
      arnieStart.y,
      {
        role: 'civilian',
        bodyType: 'muscular',
        skinColor: '#e2b294',
        hairColor: '#3b2a1e',
        primaryColor: '#15141a',
        accentColor: '#2c2c34',
        pantsColor: '#121216',
        shoeColor: '#101014',
        outfitVariant: 0,
        hairStyle: 'flattop',
        wearsSunglasses: false,
        terminatorShades: true,
        hasMustache: false,
        bikerJacket: true,
        scale: 1.09,
      },
    );
    arnie.patrolPoints = [arnieStart, arnieEnd];
    arnie.patrolIdx = 1;
    arnie.targetPos.copy(arnieEnd);
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

  public spawnPoliceNear(playerPos: THREE.Vector3, blockers: AABB[] = [], npcGrid?: SpatialGrid): NpcEntity {
    // Dispatch reinforcements directly from Vice PD Precinct 06 (-40, 0) when within range!
    const distToPrecinct = Math.hypot(playerPos.x - -40, playerPos.z - 0);
    if (distToPrecinct < 65 && distToPrecinct > 14) {
      const px = -27.2 + (Math.random() - 0.5) * 1.4;
      const pz = (Math.random() - 0.5) * 5.0;
      const local = npcGrid
        ? npcGrid.queryBox(px - 1.2, px + 1.2, pz - 1.2, pz + 1.2, blockers, this.gridQueryScratch)
        : blockers;
      if (!this.overlapsAny(px, pz, NPC_RADIUS + 0.25, local)) {
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
      const local = npcGrid
        ? npcGrid.queryBox(cx - 1.2, cx + 1.2, cz - 1.2, cz + 1.2, blockers, this.gridQueryScratch)
        : blockers;
      if (!this.overlapsAny(cx, cz, NPC_RADIUS + 0.25, local)) {
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
    npcGrid?: SpatialGrid,
  ): { civiliansHit: number; policeHit: number } {
    const rSq = radius * radius;
    const blockers = this.blockerScratch;
    blockers.length = 0;
    blockers.push(SAFEHOUSE_NO_ENTRY);
    for (let i = 0; i < worldColliders.length; i++) blockers.push(worldColliders[i]);
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
        npcGrid,
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

  public appendShootableHitboxes(out: THREE.Object3D[]): void {
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.alive) out.push(npc.hitbox);
    }
  }

  public getShootableTargets(): ShootableTarget[] {
    const out: ShootableTarget[] = [];
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.alive && npc.hitbox.userData.shootableTarget) {
        out.push(npc.hitbox.userData.shootableTarget as ShootableTarget);
      }
    }
    return out;
  }

  /**
   * Appends solid in-place AABB colliders for all living NPCs into `out` with zero allocations.
   */
  public appendNpcColliders(out: AABB[]): void {
    const halfW = 0.34;
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (!npc.alive) continue;
      const c = npc.collider;
      c.minX = npc.position.x - halfW;
      c.maxX = npc.position.x + halfW;
      c.minY = npc.position.y;
      c.maxY = npc.position.y + 1.85;
      c.minZ = npc.position.z - halfW;
      c.maxZ = npc.position.z + halfW;
      out.push(c);
    }
  }

  public getNpcColliders(): AABB[] {
    this.npcColliderScratch.length = 0;
    this.appendNpcColliders(this.npcColliderScratch);
    return this.npcColliderScratch;
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
      disposeCharacter(target.group);
      this.npcs.splice(idx, 1);
    }
  }

  public clearPolice(): void {
    this.guardAlertTimer = 0;
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (n.role === 'police') {
        this.scene.remove(n.group);
        disposeCharacter(n.group);
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
    npcGrid?: SpatialGrid,
  ): void {
    const clampedDt = Math.min(dt, 0.05);

    // Build extra dynamic blocker list in-place (zero allocations!)
    const blockers = this.blockerScratch;
    blockers.length = 0;
    blockers.push(SAFEHOUSE_NO_ENTRY);
    for (let i = 0; i < worldColliders.length; i++) {
      blockers.push(worldColliders[i]);
    }

    let alivePolice = 0;
    let aliveCivs = 0;
    let aliveGuards = 0;
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (!n.alive) continue;
      if (n.role === 'police') alivePolice++;
      else if (n.role === 'civilian') aliveCivs++;
      else if (n.role === 'guard') aliveGuards++;
    }

    const desiredPolice = wantedStars === 0 ? 0 : Math.min(7, wantedStars + 1);
    if (alivePolice < desiredPolice && Math.random() < clampedDt * 0.9) {
      this.spawnPoliceNear(playerPos, blockers, npcGrid);
    }

    if (aliveCivs < 10 && Math.random() < clampedDt * 0.6) {
      this.spawnCivilian();
    }

    if (this.guardAlertTimer > 0) {
      this.guardAlertTimer = Math.max(0, this.guardAlertTimer - clampedDt);
    }
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
        // Smooth ragdoll-style fall onto the pavement with relaxed bent limbs
        npc.fallProgress = Math.min(1, npc.fallProgress + clampedDt * 3.4);
        const eased = 1 - Math.pow(1 - npc.fallProgress, 2);
        npc.bodyRoot.rotation.x = -eased * (Math.PI / 2);
        npc.bodyRoot.rotation.z = eased * npc.fallDir * 0.24;
        npc.bodyRoot.position.y = eased * 0.16;
        npc.leftKneePivot.rotation.x = eased * 0.45;
        npc.rightKneePivot.rotation.x = eased * 0.25;
        npc.leftElbowPivot.rotation.x = -eased * 0.5;
        npc.rightElbowPivot.rotation.x = -eased * 0.35;

        npc.deathTimer -= clampedDt;
        if (npc.deathTimer <= 0) {
          this.scene.remove(npc.group);
          disposeCharacter(npc.group);
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
              disposeCharacter(npc.group);
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
        const resolved = this.moveWithWallSlide(prevX, prevZ, stepX, stepZ, NPC_RADIUS, blockers, npc.position.y, npcGrid);
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
        const isRunning = moveSpeed > 3.5;
        const swing = Math.sin(npc.walkPhase) * (isRunning ? 0.72 : 0.48);
        npc.leftLegPivot.rotation.x = swing;
        npc.rightLegPivot.rotation.x = -swing;
        npc.leftKneePivot.rotation.x = Math.max(0, Math.sin(npc.walkPhase + 0.85)) * (isRunning ? 0.92 : 0.5);
        npc.rightKneePivot.rotation.x = Math.max(0, Math.sin(npc.walkPhase + Math.PI + 0.85)) * (isRunning ? 0.92 : 0.5);
        npc.bodyRoot.position.y = Math.abs(Math.sin(npc.walkPhase)) * 0.045;

        if (npc.role === 'civilian' && npc.state === 'flee') {
          // Panic arms raised while fleeing
          const panicWave = Math.sin(npc.walkPhase * 1.4) * 0.22;
          npc.leftArmPivot.rotation.x += (-2.35 + panicWave - npc.leftArmPivot.rotation.x) * animBlend;
          npc.rightArmPivot.rotation.x += (-2.35 - panicWave - npc.rightArmPivot.rotation.x) * animBlend;
          npc.leftElbowPivot.rotation.x += (-0.55 - npc.leftElbowPivot.rotation.x) * animBlend;
          npc.rightElbowPivot.rotation.x += (-0.55 - npc.rightElbowPivot.rotation.x) * animBlend;
        } else if (aiming) {
          // Aim weapon straight ahead while moving
          npc.rightArmPivot.rotation.x += (-1.38 - npc.rightArmPivot.rotation.x) * animBlend;
          npc.rightElbowPivot.rotation.x += (-0.18 - npc.rightElbowPivot.rotation.x) * animBlend;
          npc.leftArmPivot.rotation.x += (-1.05 - npc.leftArmPivot.rotation.x) * animBlend;
          npc.leftElbowPivot.rotation.x += (-0.42 - npc.leftElbowPivot.rotation.x) * animBlend;
        } else {
          // Natural opposite arm swing with elbow bend
          npc.leftArmPivot.rotation.x += (-swing * 0.7 - npc.leftArmPivot.rotation.x) * animBlend;
          npc.rightArmPivot.rotation.x += (swing * 0.7 - npc.rightArmPivot.rotation.x) * animBlend;
          npc.leftElbowPivot.rotation.x += ((-0.22 - Math.max(0, -swing) * 0.5) - npc.leftElbowPivot.rotation.x) * animBlend;
          npc.rightElbowPivot.rotation.x += ((-0.22 - Math.max(0, swing) * 0.5) - npc.rightElbowPivot.rotation.x) * animBlend;
        }
      } else {
        npc.leftLegPivot.rotation.x *= 0.84;
        npc.rightLegPivot.rotation.x *= 0.84;
        npc.leftKneePivot.rotation.x *= 0.84;
        npc.rightKneePivot.rotation.x *= 0.84;
        npc.bodyRoot.position.y *= 0.84;
        if (aiming) {
          const recoilLift = npc.muzzleTimer > 0 ? -0.25 : 0;
          npc.rightArmPivot.rotation.x += (-1.42 + recoilLift - npc.rightArmPivot.rotation.x) * animBlend;
          npc.rightElbowPivot.rotation.x += (-0.16 - npc.rightElbowPivot.rotation.x) * animBlend;
          npc.leftArmPivot.rotation.x += (-1.15 - npc.leftArmPivot.rotation.x) * animBlend;
          npc.leftElbowPivot.rotation.x += (-0.42 - npc.leftElbowPivot.rotation.x) * animBlend;
        } else {
          npc.leftArmPivot.rotation.x *= 0.85;
          npc.rightArmPivot.rotation.x *= 0.85;
          npc.leftElbowPivot.rotation.x += (-0.15 - npc.leftElbowPivot.rotation.x) * animBlend;
          npc.rightElbowPivot.rotation.x += (-0.15 - npc.rightElbowPivot.rotation.x) * animBlend;
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
          const resA = this.moveWithWallSlide(a.position.x, a.position.z, -nx * push, -nz * push, NPC_RADIUS, blockers, a.position.y, npcGrid);
          const resB = this.moveWithWallSlide(b.position.x, b.position.z, nx * push, nz * push, NPC_RADIUS, blockers, b.position.y, npcGrid);
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

    // Update pooled enemy tracers
    this.tracerPool.update(clampedDt);
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
    const start = this.tmpStart.set(
      npc.position.x + fwdX * 0.55,
      npc.position.y + 1.32,
      npc.position.z + fwdZ * 0.55,
    );
    const end = this.tmpEnd.set(
      playerPos.x + (Math.random() - 0.5) * 1.4,
      playerPos.y + (Math.random() - 0.5) * 0.8 + 1.1,
      playerPos.z + (Math.random() - 0.5) * 1.4,
    );

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

    this.tracerPool.spawn(start, end, npc.role === 'police' ? 0x5ec8ff : 0xff4fa3, 0.1, 0.85, false);

    if (coverBlocksShot) return;

    const dist = npc.position.distanceTo(playerPos);
    const baseHitChance = THREE.MathUtils.clamp(0.52 - dist * 0.012, 0.12, 0.48);
    const hitChance = coverPartial ? baseHitChance * 0.5 : baseHitChance;
    if (Math.random() < hitChance) {
      this.onPlayerDamaged?.(npc.role === 'bounty' ? 11 : 7);
    }
  }

  /**
   * Builds a stylized Low-Poly 80s Miami character via CharacterBuilder with:
   * - Tapered male & female silhouettes, faceted head, 3D sunglasses/facial features & hairstyles
   * - Procedural front/back outfit textures, 3D lapels/badges/chains
   * - 2-segment articulated arms (shoulder + elbow) & legs (hip + knee), plus 3D weapons & muzzle flash
   */
  private createNpc(role: NpcRole, x: number, z: number, shirtColor: string, maxHp: number, baseY = 0.18): NpcEntity {
    const seed = this.nextId++;
    const group = new THREE.Group();
    group.position.set(x, baseY, z);

    const skinColor = SKIN_TONES[seed % SKIN_TONES.length];
    const hairColor = HAIR_COLORS[(seed * 3) % HAIR_COLORS.length];
    const accentColor = role === 'guard' ? '#ff3d7f' : CIV_ACCENTS[seed % CIV_ACCENTS.length];
    const wearsSunglasses = role === 'bounty' || role === 'guard' || role === 'police' || seed % 2 === 0;
    const bodyType: CharacterBodyType = role === 'civilian' && seed % 2 === 0 ? 'female' : 'male';
    const hasMustache = bodyType === 'male' && (role === 'police' ? seed % 2 === 0 : seed % 4 === 1);

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

    let hairStyle: CharacterHairStyle;
    if (role === 'police') {
      hairStyle = 'police';
    } else if (role === 'bounty' || role === 'guard') {
      hairStyle = 'pompadour';
    } else if (bodyType === 'female') {
      const femaleStyles: CharacterHairStyle[] = ['ponytail', 'bob', 'feathered'];
      hairStyle = femaleStyles[seed % femaleStyles.length];
    } else {
      const maleStyles: CharacterHairStyle[] = ['pompadour', 'feathered', 'cap'];
      hairStyle = maleStyles[seed % maleStyles.length];
    }

    const scale =
      role === 'bounty'
        ? 1.05
        : bodyType === 'female'
          ? 0.94 + (seed % 3) * 0.02
          : 0.98 + (seed % 4) * 0.02;

    const rig = buildLowPolyCharacter({
      role,
      bodyType,
      skinColor,
      hairColor,
      primaryColor: shirtColor,
      accentColor,
      pantsColor,
      shoeColor,
      outfitVariant: seed,
      hairStyle,
      wearsSunglasses,
      hasMustache,
      isShorts: role === 'civilian' && seed % 2 === 1,
      shortSleeves: role === 'civilian' || role === 'police',
      withHalo: role === 'bounty',
      scale,
    });

    const { bodyRoot } = rig;
    group.add(bodyRoot);

    // Attach shared 3D weapon + muzzle flash to right hand anchor for armed roles
    let muzzleFlash: THREE.Mesh | undefined;
    if (role === 'police' || role === 'bounty' || role === 'guard') {
      const barrelLen = role === 'bounty' ? 0.34 : 0.25;
      const gun = new THREE.Mesh(
        role === 'bounty' ? this.sharedGunGeoBounty : this.sharedGunGeoNormal,
        this.sharedGunMat,
      );
      gun.position.set(0, -0.05, barrelLen * 0.38);
      gun.rotation.x = Math.PI / 2;
      rig.rightHandAnchor.add(gun);

      muzzleFlash = new THREE.Mesh(
        this.sharedMuzzleGeo,
        role === 'bounty' ? this.sharedMuzzleMatBounty : this.sharedMuzzleMatNormal,
      );
      muzzleFlash.position.set(0, -0.05 - barrelLen * 0.45, 0.08);
      muzzleFlash.visible = false;
      rig.rightHandAnchor.add(muzzleFlash);
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
      leftLegPivot: rig.leftLegPivot,
      rightLegPivot: rig.rightLegPivot,
      leftKneePivot: rig.leftKneePivot,
      rightKneePivot: rig.rightKneePivot,
      leftArmPivot: rig.leftArmPivot,
      rightArmPivot: rig.rightArmPivot,
      leftElbowPivot: rig.leftElbowPivot,
      rightElbowPivot: rig.rightElbowPivot,
      muzzleFlash,
      deathTimer: 0,
      collider: {
        minX: x - 0.34,
        maxX: x + 0.34,
        minY: baseY,
        maxY: baseY + 1.85,
        minZ: z - 0.34,
        maxZ: z + 0.34,
        tag: 'npc',
      },
    };
    this.attachShootableTarget(npc);
    this.npcs.push(npc);
    return npc;
  }

  private attachShootableTarget(npc: NpcEntity): void {
    const target: ShootableTarget = {
      id: npc.id,
      mesh: npc.hitbox,
      onHit: (damage: number) => {
        if (!npc.alive) return false;
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
    };
    npc.hitbox.userData.shootableTarget = target;
  }

  private createCustomNpc(
    id: string,
    role: NpcRole,
    x: number,
    z: number,
    maxHp: number,
    baseY: number,
    charOpts: LowPolyCharacterOptions,
  ): NpcEntity {
    const group = new THREE.Group();
    group.position.set(x, baseY, z);

    const rig = buildLowPolyCharacter(charOpts);
    group.add(rig.bodyRoot);

    const hitbox = new THREE.Mesh(this.hitboxGeo, this.hitboxMat);
    hitbox.position.y = 0.94;
    group.add(hitbox);

    this.scene.add(group);

    const npc: NpcEntity = {
      id,
      role,
      group,
      hitbox,
      bodyRoot: rig.bodyRoot,
      position: new THREE.Vector3(x, baseY, z),
      yaw: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      state: 'walk',
      walkPhase: Math.random() * 6,
      fireCooldown: 0.8,
      flinchTimer: 0,
      muzzleTimer: 0,
      fallProgress: 0,
      fallDir: 1,
      targetPos: this.randomSidewalkPoint(),
      leftLegPivot: rig.leftLegPivot,
      rightLegPivot: rig.rightLegPivot,
      leftKneePivot: rig.leftKneePivot,
      rightKneePivot: rig.rightKneePivot,
      leftArmPivot: rig.leftArmPivot,
      rightArmPivot: rig.rightArmPivot,
      leftElbowPivot: rig.leftElbowPivot,
      rightElbowPivot: rig.rightElbowPivot,
      deathTimer: 0,
      collider: {
        minX: x - 0.34,
        maxX: x + 0.34,
        minY: baseY,
        maxY: baseY + 1.85,
        minZ: z - 0.34,
        maxZ: z + 0.34,
        tag: 'npc',
      },
    };
    this.attachShootableTarget(npc);
    this.npcs.push(npc);
    return npc;
  }

  private overlapsAny(x: number, z: number, radius: number, blockers: AABB[]): boolean {
    for (let i = 0; i < blockers.length; i++) {
      const box = blockers[i];
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
    npcGrid?: SpatialGrid,
  ): { x: number; z: number } {
    const onIslandZone = startX > 135;
    const minX = onIslandZone ? 149 : -65;
    const maxX = onIslandZone ? 196 : 72;
    const minZ = onIslandZone ? -83 : -65;
    const maxZ = onIslandZone ? 35 : 65;

    let x = THREE.MathUtils.clamp(startX + dx, minX, maxX);
    let z = startZ;

    const candidates = npcGrid
      ? npcGrid.queryBox(
          Math.min(startX, x) - radius - 0.2,
          Math.max(startX, x) + radius + 0.2,
          Math.min(startZ, startZ + dz) - radius - 0.2,
          Math.max(startZ, startZ + dz) + radius + 0.2,
          blockers,
          this.gridQueryScratch,
        )
      : blockers;

    // Resolve X axis first (only against obstacles taller than current floor + 0.35m!)
    for (let i = 0; i < candidates.length; i++) {
      const box = candidates[i];
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
    for (let i = 0; i < candidates.length; i++) {
      const box = candidates[i];
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
