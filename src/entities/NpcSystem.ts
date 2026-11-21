import * as THREE from 'three';
import type { AABB } from '../types';
import type { ShootableTarget } from '../combat/WeaponSystem';
import { BLOCK_CENTERS } from '../world/CityLayout';
import { getFaceTexture, getOutfitTexture } from './CharacterTextures';

export type NpcRole = 'civilian' | 'police' | 'bounty';

export interface NpcEntity {
  id: string;
  role: NpcRole;
  group: THREE.Group;
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
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
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
  private nextId = 1;

  public onPlayerDamaged?: (amount: number) => void;
  public onNpcKilled?: (npc: NpcEntity) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let i = 0; i < 12; i++) {
      this.spawnCivilian();
    }
  }

  public spawnCivilian(): NpcEntity {
    const spot = this.randomSidewalkPoint();
    const shirt = CIV_SHIRTS[this.nextId % CIV_SHIRTS.length];
    return this.createNpc('civilian', spot.x, spot.z, shirt, 45);
  }

  public spawnPoliceNear(playerPos: THREE.Vector3, blockers: AABB[] = []): NpcEntity {
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

  public spawnBountyTarget(x: number, z: number): NpcEntity {
    const boss = this.createNpc('bounty', x, z, '#f5f0eb', 110);
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

  public getShootableTargets(): ShootableTarget[] {
    const out: ShootableTarget[] = [];
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      out.push({
        id: npc.id,
        mesh: npc.group,
        onHit: (damage: number) => {
          npc.hp -= damage;
          npc.flinchTimer = 0.18;
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
    npc.deathTimer = 5.5;
    npc.fallProgress = 0;
    npc.fallDir = Math.random() > 0.5 ? 1 : -1;
    if (npc.muzzleFlash) npc.muzzleFlash.visible = false;
    this.onNpcKilled?.(npc);
  }

  public update(dt: number, playerPos: THREE.Vector3, wantedStars: number, worldColliders: AABB[] = []): void {
    const clampedDt = Math.min(dt, 0.05);

    // Filter to solid vertical obstacles at NPC torso height + private Safehouse exclusion box
    const blockers: AABB[] = [SAFEHOUSE_NO_ENTRY];
    for (const c of worldColliders) {
      if (c.maxY > 0.45 && c.minY < 1.85) {
        blockers.push(c);
      }
    }

    const desiredPolice = wantedStars === 0 ? 0 : Math.min(7, wantedStars + 1);
    if (this.getAlivePoliceCount() < desiredPolice && Math.random() < clampedDt * 0.9) {
      this.spawnPoliceNear(playerPos, blockers);
    }

    const aliveCivs = this.npcs.filter((n) => n.alive && n.role === 'civilian').length;
    if (aliveCivs < 10 && Math.random() < clampedDt * 0.6) {
      this.spawnCivilian();
    }

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i];

      if (!npc.alive) {
        // Smooth ragdoll-style fall onto the pavement
        npc.fallProgress = Math.min(1, npc.fallProgress + clampedDt * 3.4);
        const eased = 1 - Math.pow(1 - npc.fallProgress, 2);
        npc.bodyRoot.rotation.x = -eased * (Math.PI / 2);
        npc.bodyRoot.rotation.z = eased * npc.fallDir * 0.24;
        npc.bodyRoot.position.y = eased * 0.16;

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
        const shouldEngage = npc.role === 'police' ? wantedStars > 0 : distToPlayer < 34 || npc.hp < npc.maxHp;

        if (!shouldEngage) {
          if (npc.role === 'police' && wantedStars === 0 && distToPlayer > 35) {
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
          aiming = distToPlayer < 28;
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

          npc.fireCooldown -= clampedDt;
          if (aiming && npc.fireCooldown <= 0) {
            npc.fireCooldown = npc.role === 'bounty' ? 0.95 : 1.35;
            this.fireNpcShot(npc, playerPos);
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
        const resolved = this.moveWithWallSlide(prevX, prevZ, stepX, stepZ, NPC_RADIUS, blockers);
        npc.position.x = resolved.x;
        npc.position.z = resolved.z;

        const actualDist = Math.hypot(npc.position.x - prevX, npc.position.z - prevZ);
        const wantedDist = moveSpeed * clampedDt;

        // If blocked head-on by a building wall while patrolling, pick a fresh sidewalk waypoint
        if (actualDist < wantedDist * 0.28 && npc.state === 'walk') {
          npc.targetPos.copy(this.randomSidewalkPoint());
        }

        npc.yaw = Math.atan2(moveX, moveZ);

        npc.walkPhase += clampedDt * moveSpeed * 2.9;
        const swing = Math.sin(npc.walkPhase) * (moveSpeed > 3.5 ? 0.72 : 0.48);
        npc.leftLegPivot.rotation.x = swing;
        npc.rightLegPivot.rotation.x = -swing;
        npc.bodyRoot.position.y = Math.abs(Math.sin(npc.walkPhase)) * 0.045;

        if (npc.role === 'civilian' && npc.state === 'flee') {
          // Panic arms raised while fleeing
          const panicWave = Math.sin(npc.walkPhase * 1.4) * 0.22;
          npc.leftArmPivot.rotation.x += (-2.5 + panicWave - npc.leftArmPivot.rotation.x) * animBlend;
          npc.rightArmPivot.rotation.x += (-2.5 - panicWave - npc.rightArmPivot.rotation.x) * animBlend;
        } else if (aiming) {
          // Aim weapon straight ahead while moving
          npc.rightArmPivot.rotation.x += (-1.52 - npc.rightArmPivot.rotation.x) * animBlend;
          npc.leftArmPivot.rotation.x += (-1.25 - npc.leftArmPivot.rotation.x) * animBlend;
        } else {
          // Natural opposite arm swing
          npc.leftArmPivot.rotation.x += (-swing * 0.7 - npc.leftArmPivot.rotation.x) * animBlend;
          npc.rightArmPivot.rotation.x += (swing * 0.7 - npc.rightArmPivot.rotation.x) * animBlend;
        }
      } else {
        npc.leftLegPivot.rotation.x *= 0.84;
        npc.rightLegPivot.rotation.x *= 0.84;
        npc.bodyRoot.position.y *= 0.84;
        if (aiming) {
          const recoilLift = npc.muzzleTimer > 0 ? -0.25 : 0;
          npc.rightArmPivot.rotation.x += (-1.55 + recoilLift - npc.rightArmPivot.rotation.x) * animBlend;
          npc.leftArmPivot.rotation.x += (-1.35 - npc.leftArmPivot.rotation.x) * animBlend;
        } else {
          npc.leftArmPivot.rotation.x *= 0.85;
          npc.rightArmPivot.rotation.x *= 0.85;
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
          const resA = this.moveWithWallSlide(a.position.x, a.position.z, -nx * push, -nz * push, NPC_RADIUS, blockers);
          const resB = this.moveWithWallSlide(b.position.x, b.position.z, nx * push, nz * push, NPC_RADIUS, blockers);
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

  private fireNpcShot(npc: NpcEntity, playerPos: THREE.Vector3): void {
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

    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: npc.role === 'police' ? 0x5ec8ff : 0xff4fa3,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.enemyTracers.push({ line, life: 0.1 });

    const dist = npc.position.distanceTo(playerPos);
    const hitChance = THREE.MathUtils.clamp(0.52 - dist * 0.012, 0.12, 0.48);
    if (Math.random() < hitChance) {
      this.onPlayerDamaged?.(npc.role === 'bounty' ? 11 : 7);
    }
  }

  /**
   * Builds a detailed Vice-City-style articulated character with:
   * - Procedural face texture (eyes / 80s sunglasses / mustache)
   * - Procedural outfit texture (Miami Hawaiian / pastel blazer / Vice PD uniform / white suit)
   * - Hairstyles / caps, belt, shoes, pivoted arms & legs, and 3D weapons + muzzle flash
   */
  private createNpc(role: NpcRole, x: number, z: number, shirtColor: string, maxHp: number): NpcEntity {
    const seed = this.nextId++;
    const group = new THREE.Group();
    group.position.set(x, 0.18, z);

    const bodyRoot = new THREE.Group();
    group.add(bodyRoot);

    const skinColor = SKIN_TONES[seed % SKIN_TONES.length];
    const hairColor = HAIR_COLORS[(seed * 3) % HAIR_COLORS.length];
    const accentColor = CIV_ACCENTS[seed % CIV_ACCENTS.length];
    const wearsSunglasses = role === 'bounty' || role === 'police' || seed % 2 === 0;
    const hasMustache = role === 'police' ? seed % 2 === 0 : seed % 4 === 1;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.72 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.82 });
    const outfitTex = getOutfitTexture(role, shirtColor, accentColor, seed);
    const torsoMat = new THREE.MeshStandardMaterial({
      map: outfitTex,
      roughness: 0.65,
    });
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: role === 'bounty' ? '#f5f0eb' : shirtColor,
      roughness: 0.65,
    });
    const pantsColor =
      role === 'police'
        ? '#141d33'
        : role === 'bounty'
          ? '#efeae4'
          : seed % 3 === 0
            ? '#f0e2ce'
            : '#2c3047';
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.78 });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: role === 'police' ? '#141418' : '#f4eee8',
      roughness: 0.55,
    });

    // Pelvis & Belt
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.26), pantsMat);
    pelvis.position.y = 0.78;
    bodyRoot.add(pelvis);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.06, 0.28),
      new THREE.MeshStandardMaterial({ color: '#1b151e', roughness: 0.4 }),
    );
    belt.position.y = 0.86;
    bodyRoot.add(belt);

    // Torso (broad shoulders, textured front/back)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.26), torsoMat);
    torso.position.y = 1.16;
    torso.castShadow = true;
    bodyRoot.add(torso);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 8), skinMat);
    neck.position.y = 1.48;
    bodyRoot.add(neck);

    // Head with procedural face texture on front (+Z)
    const faceTex = getFaceTexture(skinColor, wearsSunglasses, hasMustache);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.65 });
    const headMats = [skinMat, skinMat, hairMat, skinMat, faceMat, hairMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), headMats);
    head.position.y = 1.65;
    head.castShadow = true;
    bodyRoot.add(head);

    // Hairstyles / Headgear
    if (role === 'police') {
      const capMat = new THREE.MeshStandardMaterial({ color: '#132245', roughness: 0.5 });
      const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), capMat);
      capTop.position.set(0, 1.83, 0);
      bodyRoot.add(capTop);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: '#0c1018', roughness: 0.25 }));
      brim.position.set(0, 1.79, 0.18);
      bodyRoot.add(brim);
      const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: '#ffd15c', metalness: 0.8, roughness: 0.2 }));
      emblem.position.set(0, 1.83, 0.17);
      bodyRoot.add(emblem);
    } else if (role === 'bounty') {
      // Slicked 80s hair + glowing target halo
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.09, 0.31), hairMat);
      hair.position.set(0, 1.82, -0.02);
      bodyRoot.add(hair);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.035, 8, 16),
        new THREE.MeshBasicMaterial({ color: '#ff4fa3' }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 2.08;
      bodyRoot.add(halo);
    } else {
      // Civilian hair variety: feathered 80s cut, ponytail, or coastal cap
      const style = seed % 3;
      if (style === 0) {
        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), hairMat);
        hair.position.set(0, 1.81, -0.02);
        bodyRoot.add(hair);
      } else if (style === 1) {
        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.11, 0.3), hairMat);
        hair.position.set(0, 1.81, -0.02);
        bodyRoot.add(hair);
        const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.11), hairMat);
        ponytail.position.set(0, 1.66, -0.18);
        bodyRoot.add(ponytail);
      } else {
        const capMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.3), capMat);
        cap.position.set(0, 1.82, 0);
        bodyRoot.add(cap);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.13), capMat);
        visor.position.set(0, 1.78, 0.18);
        bodyRoot.add(visor);
      }
    }

    // Articulated Arms (pivoted at shoulders)
    const buildArm = (side: -1 | 1, withWeapon: boolean): { pivot: THREE.Group; flash?: THREE.Mesh } => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.31, 1.38, 0);

      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), sleeveMat);
      upper.position.y = -0.12;
      upper.castShadow = true;
      pivot.add(upper);

      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.26, 0.12),
        role === 'bounty' ? sleeveMat : skinMat,
      );
      lower.position.y = -0.36;
      pivot.add(lower);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skinMat);
      hand.position.y = -0.52;
      pivot.add(hand);

      let flash: THREE.Mesh | undefined;
      if (withWeapon) {
        const gunMat = new THREE.MeshStandardMaterial({ color: '#24202b', metalness: 0.75, roughness: 0.3 });
        const barrelLen = role === 'bounty' ? 0.34 : 0.24;
        const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, barrelLen), gunMat);
        gun.position.set(0, -0.56, barrelLen * 0.35);
        gun.rotation.x = Math.PI / 2;
        pivot.add(gun);

        flash = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.09, 0),
          new THREE.MeshBasicMaterial({ color: role === 'bounty' ? '#ff4fa3' : '#ffcf66' }),
        );
        flash.position.set(0, -0.56 - barrelLen * 0.4, 0.08);
        flash.visible = false;
        pivot.add(flash);
      }

      bodyRoot.add(pivot);
      return { pivot, flash };
    };

    const leftArm = buildArm(-1, false);
    const rightArm = buildArm(1, role === 'police' || role === 'bounty');

    // Articulated Legs + Shoes (pivoted at hips)
    const buildLeg = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.13, 0.74, 0);

      const isShorts = role === 'civilian' && seed % 2 === 1;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.36, 0.18), pantsMat);
      upper.position.y = -0.18;
      upper.castShadow = true;
      pivot.add(upper);

      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.16), isShorts ? skinMat : pantsMat);
      lower.position.y = -0.5;
      lower.castShadow = true;
      pivot.add(lower);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), shoeMat);
      shoe.position.set(0, -0.69, 0.04);
      pivot.add(shoe);

      bodyRoot.add(pivot);
      return pivot;
    };

    const leftLegPivot = buildLeg(-1);
    const rightLegPivot = buildLeg(1);

    this.scene.add(group);

    const npc: NpcEntity = {
      id: `npc-${seed}`,
      role,
      group,
      bodyRoot,
      position: new THREE.Vector3(x, 0.18, z),
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
      leftLegPivot,
      rightLegPivot,
      leftArmPivot: leftArm.pivot,
      rightArmPivot: rightArm.pivot,
      muzzleFlash: rightArm.flash,
      deathTimer: 0,
    };
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
  ): { x: number; z: number } {
    // Resolve X axis first
    let x = THREE.MathUtils.clamp(startX + dx, -65, 72);
    let z = startZ;
    for (const box of blockers) {
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
    z = THREE.MathUtils.clamp(startZ + dz, -65, 65);
    for (const box of blockers) {
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
