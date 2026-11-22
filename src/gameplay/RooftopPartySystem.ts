import * as THREE from 'three';
import { TracerPool } from '../combat/TracerPool';
import { buildLowPolyCharacter, type LowPolyCharacterRig } from '../entities/CharacterBuilder';
import type { NpcEntity, NpcSystem } from '../entities/NpcSystem';

const ROOF_Y = 6.02;
const ROOF_CX = 40.0;
const ROOF_CZ = -40.0;
const BAR_X = 33.8;
const BAR_Z = -35.2;

export type PartyGuestRole = 'bartender' | 'dj' | 'dancer' | 'drinker';

interface PartyGuest {
  id: string;
  name: string;
  role: PartyGuestRole;
  canDefend: boolean;
  rig: LowPolyCharacterRig;
  root: THREE.Group;
  baseX: number;
  baseZ: number;
  baseYaw: number;
  phase: number;
  gunMesh?: THREE.Mesh;
  muzzleMesh?: THREE.Mesh;
  muzzleTimer: number;
  fireCooldown: number;
  quipIndex: number;
  quips: string[];
}

interface FireworkSpark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface RooftopPartyHud {
  active: boolean;
  defending: boolean;
  nearbyGuestName: string | null;
  nearTributeCash: boolean;
  fireworkPopped: boolean;
  crewShotFired: boolean;
  toastText: string | null;
}

/**
 * Rooftop Gangster Pool Party at the Vice Safehouse Penthouse (requires owned SUNSET BAR):
 * - 6 animated 80s crew members (Bartender, DJ, Dancers, Bar VIP & Horse-Mask regular)
 * - 126-BPM pulsing string lights, rooftop DJ booth with EQ bars, 2 additive sweeping spotlight cones
 * - Celebratory neon fireworks over Ocean Drive when the party starts
 * - Interactive [F] crew toasts, +$400 Crew Tribute envelope on the bar, and active roof defense vs. Vice PD!
 */
export class RooftopPartySystem {
  private readonly scene: THREE.Scene;
  private readonly tracerPool: TracerPool;
  private readonly partyRoot = new THREE.Group();
  private readonly guests: PartyGuest[] = [];
  private readonly stringBulbs: { mat: THREE.MeshStandardMaterial; phase: number }[] = [];
  private readonly eqBars: THREE.Mesh[] = [];
  private readonly spotPivots: THREE.Group[] = [];
  private readonly tributeGroup = new THREE.Group();

  // Pooled firework / confetti sparks (zero allocations after warm-up!)
  private readonly sparkGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  private readonly sparks: FireworkSpark[] = [];
  private readonly sparkPool: THREE.Mesh[] = [];

  private active = false;
  private partyElapsed = 0;
  private fireworkQueue: number[] = [];
  private tributeAvailable = false;
  private tributeClaimedThisParty = false;
  private defenseNotified = false;
  private pendingToast: string | null = null;
  private readonly tmpStart = new THREE.Vector3();
  private readonly tmpEnd = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tracerPool = new TracerPool(scene);
    this.partyRoot.visible = false;
    this.partyRoot.userData.dynamic = true;
    this.scene.add(this.partyRoot);

    this.buildDecorAndLighting();
    this.buildDjBooth();
    this.buildTributeEnvelope();
    this.buildCrewGuests();
  }

  public isActive(): boolean {
    return this.active;
  }

  public isPlayerOnSafehouseRoof(pos: THREE.Vector3): boolean {
    return (
      pos.x >= 29.0 &&
      pos.x <= 51.0 &&
      pos.z >= -50.0 &&
      pos.z <= -30.0 &&
      pos.y >= ROOF_Y - 1.4
    );
  }

  public start(): void {
    if (this.active) return;
    this.active = true;
    this.partyElapsed = 0;
    this.tributeAvailable = false;
    this.tributeClaimedThisParty = false;
    this.tributeGroup.visible = false;
    this.defenseNotified = false;
    this.partyRoot.visible = true;
    // Schedule 3 neon firework bursts over Ocean Drive right at party start!
    this.fireworkQueue = [0.25, 1.05, 1.9];
    this.pendingToast = 'ROOFTOP-PARTY GESTARTET! · DEINE CREW IST AM POOL — PROST!';
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;
    this.partyRoot.visible = false;
    this.tributeAvailable = false;
    this.tributeGroup.visible = false;
    this.fireworkQueue.length = 0;
    this.defenseNotified = false;
  }

  public toggle(): boolean {
    if (this.active) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  /**
   * Returns 0..1 proximity for spatial 126-BPM synthwave music over the Safehouse rooftop.
   */
  public getMusicProximity(playerPos: THREE.Vector3): number {
    if (!this.active) return 0;
    const dx = playerPos.x - ROOF_CX;
    const dy = (playerPos.y - ROOF_Y) * 1.4;
    const dz = playerPos.z - ROOF_CZ;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 30) return 0;
    return THREE.MathUtils.clamp(1 - (dist - 8) / 22, 0, 1);
  }

  public isNearTributeCash(playerPos: THREE.Vector3): boolean {
    if (!this.active || !this.tributeAvailable) return false;
    return Math.hypot(playerPos.x - (BAR_X + 0.8), playerPos.z - (BAR_Z - 1.15)) < 2.6 && playerPos.y > ROOF_Y - 0.8;
  }

  public claimTributeCash(): number {
    if (!this.active || !this.tributeAvailable) return 0;
    this.tributeAvailable = false;
    this.tributeClaimedThisParty = true;
    this.tributeGroup.visible = false;
    return 400;
  }

  public getNearbyGuest(playerPos: THREE.Vector3): PartyGuest | null {
    if (!this.active || playerPos.y < ROOF_Y - 1.2) return null;
    let best: PartyGuest | null = null;
    let bestSq = 2.65 * 2.65;
    for (let i = 0; i < this.guests.length; i++) {
      const g = this.guests[i];
      const dx = playerPos.x - g.baseX;
      const dz = playerPos.z - g.baseZ;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestSq) {
        bestSq = dSq;
        best = g;
      }
    }
    return best;
  }

  public talkToNearbyGuest(playerPos: THREE.Vector3, hasElvis: boolean): string | null {
    const g = this.getNearbyGuest(playerPos);
    if (!g) return null;
    if (hasElvis && g.id === 'party-horse' && g.quipIndex % 2 === 1) {
      g.quipIndex++;
      return `${g.name}: „ELVIS HAT SCHON WIEDER MEINEN COCKTAIL GEKLAUT!“`;
    }
    const line = g.quips[g.quipIndex % g.quips.length];
    g.quipIndex++;
    return `${g.name}: „${line}“`;
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    wantedStars: number,
    npcs: NpcSystem,
  ): RooftopPartyHud {
    const clampedDt = Math.min(dt, 0.05);
    const toastOut = this.pendingToast;
    this.pendingToast = null;

    this.updateFireworkSparks(clampedDt);
    this.tracerPool.update(clampedDt);

    if (!this.active) {
      return {
        active: false,
        defending: false,
        nearbyGuestName: null,
        nearTributeCash: false,
        fireworkPopped: false,
        crewShotFired: false,
        toastText: toastOut,
      };
    }

    this.partyElapsed += clampedDt;
    let fireworkPopped = false;
    let crewShotFired = false;

    // Trigger scheduled celebratory fireworks over Ocean Drive
    while (this.fireworkQueue.length > 0 && this.partyElapsed >= this.fireworkQueue[0]) {
      this.fireworkQueue.shift();
      this.launchNeonFirework();
      fireworkPopped = true;
    }

    // Unlock Crew Tribute envelope (+$400) on the bar after 25s of partying!
    if (!this.tributeAvailable && !this.tributeClaimedThisParty && this.partyElapsed >= 25.0) {
      this.tributeAvailable = true;
      this.tributeGroup.visible = true;
      this.pendingToast = 'CREW-GESCHENK · DEINE FREUNDE HABEN $400 AUF DIE BAR GELEGT!';
    }
    if (this.tributeAvailable) {
      this.tributeGroup.rotation.y = elapsed * 2.1;
      this.tributeGroup.position.y = ROOF_Y + 1.24 + Math.sin(elapsed * 3.5) * 0.05;
    }

    // 126 BPM pulse = 2.1 beats/sec
    const beatPhase = elapsed * 2.1 * Math.PI * 2;
    const beatPulse = 0.5 + 0.5 * Math.sin(beatPhase);

    // Pulse string light bulbs & EQ bars
    for (let i = 0; i < this.stringBulbs.length; i++) {
      const b = this.stringBulbs[i];
      const wave = 0.5 + 0.5 * Math.sin(beatPhase * 0.5 + b.phase);
      b.mat.emissiveIntensity = 1.2 + wave * 2.0;
    }
    for (let i = 0; i < this.eqBars.length; i++) {
      const h = 0.25 + 0.75 * Math.abs(Math.sin(beatPhase * 0.7 + i * 0.95));
      this.eqBars[i].scale.y = h;
    }

    // Sweep additive neon spotlight cones across the pool & deck
    for (let i = 0; i < this.spotPivots.length; i++) {
      const dir = i === 0 ? 1 : -1;
      this.spotPivots[i].rotation.y = Math.sin(elapsed * 0.85 * dir + i * 1.4) * 0.65;
      this.spotPivots[i].rotation.z = 0.48 + Math.cos(elapsed * 1.15 + i) * 0.16;
    }

    // Check for pursuing Vice PD officers if player has Wanted stars -> Crew defends the roof!
    let targetCop: NpcEntity | null = null;
    if (wantedStars > 0) {
      let bestDistSq = 46 * 46;
      for (let i = 0; i < npcs.npcs.length; i++) {
        const n = npcs.npcs[i];
        if (!n.alive || n.role !== 'police') continue;
        const dx = n.position.x - ROOF_CX;
        const dz = n.position.z - ROOF_CZ;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          targetCop = n;
        }
      }
    }

    const defending = targetCop !== null;
    if (defending && !this.defenseNotified) {
      this.defenseNotified = true;
      this.pendingToast = 'CREW-VERTEIDIGUNG · DEINE FREUNDE HALTEN DIE POLIZEI VOM DACH FERN!';
    } else if (!defending) {
      this.defenseNotified = false;
    }

    // Animate all 6 gangster crew guests
    for (let i = 0; i < this.guests.length; i++) {
      const g = this.guests[i];
      if (g.muzzleTimer > 0) {
        g.muzzleTimer -= clampedDt;
        if (g.muzzleMesh) g.muzzleMesh.visible = g.muzzleTimer > 0;
      }

      if (defending && g.canDefend && targetCop) {
        if (g.gunMesh) g.gunMesh.visible = true;
        const dx = targetCop.position.x - g.baseX;
        const dz = targetCop.position.z - g.baseZ;
        g.root.rotation.y = Math.atan2(dx, dz);
        g.rig.bodyRoot.position.y = 0;
        // Aiming combat stance
        g.rig.rightArmPivot.rotation.x = -1.45;
        g.rig.rightArmPivot.rotation.z = 0;
        g.rig.rightElbowPivot.rotation.x = -0.15;
        g.rig.leftArmPivot.rotation.x = -0.9;
        g.rig.leftArmPivot.rotation.z = 0.25;
        g.rig.leftLegPivot.rotation.x = 0.12;
        g.rig.rightLegPivot.rotation.x = -0.12;

        g.fireCooldown -= clampedDt;
        if (g.fireCooldown <= 0) {
          g.fireCooldown = 0.85 + Math.random() * 0.55;
          this.tmpStart.set(g.baseX, ROOF_Y + 1.38, g.baseZ);
          this.tmpEnd.set(
            targetCop.position.x + (Math.random() - 0.5) * 0.6,
            targetCop.position.y + 1.25,
            targetCop.position.z + (Math.random() - 0.5) * 0.6,
          );
          this.tracerPool.spawn(this.tmpStart, this.tmpEnd, 0x36f1e6, 0.08);
          g.muzzleTimer = 0.06;
          if (g.muzzleMesh) g.muzzleMesh.visible = true;
          npcs.damageNpc(targetCop, 24);
          crewShotFired = true;
        }
        continue;
      }

      if (g.gunMesh) g.gunMesh.visible = false;
      if (g.muzzleMesh) g.muzzleMesh.visible = false;
      g.root.rotation.y = g.baseYaw;

      if (g.role === 'bartender') {
        // Shake cocktail shaker rhythmically behind SUNSET BAR
        const shake = Math.sin(elapsed * 14 + g.phase);
        g.rig.bodyRoot.position.y = Math.abs(Math.sin(beatPhase * 0.5)) * 0.03;
        g.rig.rightArmPivot.rotation.x = -1.15 + shake * 0.35;
        g.rig.rightArmPivot.rotation.z = -0.15;
        g.rig.rightElbowPivot.rotation.x = -0.85 + shake * 0.25;
        g.rig.leftArmPivot.rotation.x = -0.65;
        g.rig.leftArmPivot.rotation.z = 0.1;
        g.rig.headGroup.rotation.y = Math.sin(elapsed * 1.6) * 0.22;
      } else if (g.role === 'dj') {
        // DJ bobbing head & scratching turntables
        g.rig.bodyRoot.position.y = beatPulse * 0.05;
        g.rig.headGroup.rotation.x = beatPulse * 0.22 - 0.05;
        g.rig.leftArmPivot.rotation.x = -0.95 + Math.sin(beatPhase) * 0.14;
        g.rig.rightArmPivot.rotation.x = -1.35 + Math.cos(beatPhase * 0.5) * 0.45;
        g.rig.rightArmPivot.rotation.z = -0.35;
        g.rig.rightElbowPivot.rotation.x = -0.45;
      } else if (g.role === 'drinker') {
        // Chilling at the bar raising neon cocktail glass
        const sip = Math.max(0, Math.sin(elapsed * 1.4 + g.phase));
        g.rig.bodyRoot.position.y = beatPulse * 0.025;
        g.rig.rightArmPivot.rotation.x = -0.75 - sip * 0.55;
        g.rig.rightArmPivot.rotation.z = -0.1;
        g.rig.rightElbowPivot.rotation.x = -0.7 - sip * 0.35;
        g.rig.leftArmPivot.rotation.x = -0.15;
        g.rig.leftArmPivot.rotation.z = 0.12;
        g.rig.headGroup.rotation.y = Math.sin(elapsed * 0.9 + g.phase) * 0.28;
      } else {
        // Energetic 80s rooftop pool dancers!
        const t = beatPhase * 0.5 + g.phase;
        g.rig.bodyRoot.position.y = Math.abs(Math.sin(t)) * 0.09;
        g.root.rotation.y = g.baseYaw + Math.sin(t * 0.5) * 0.32;
        g.rig.leftArmPivot.rotation.x = -1.35 + Math.sin(t) * 0.65;
        g.rig.leftArmPivot.rotation.z = 0.42 + Math.cos(t) * 0.24;
        g.rig.leftElbowPivot.rotation.x = -0.55;
        g.rig.rightArmPivot.rotation.x = -1.35 - Math.sin(t) * 0.65;
        g.rig.rightArmPivot.rotation.z = -0.42 - Math.cos(t) * 0.24;
        g.rig.rightElbowPivot.rotation.x = -0.55;
        g.rig.leftLegPivot.rotation.x = Math.sin(t) * 0.22;
        g.rig.rightLegPivot.rotation.x = -Math.sin(t) * 0.22;
        g.rig.headGroup.rotation.z = Math.sin(t) * 0.12;
      }
    }

    const nearbyGuest = this.getNearbyGuest(playerPos);
    return {
      active: true,
      defending,
      nearbyGuestName: nearbyGuest ? nearbyGuest.name : null,
      nearTributeCash: this.isNearTributeCash(playerPos),
      fireworkPopped,
      crewShotFired,
      toastText: toastOut,
    };
  }

  private buildDecorAndLighting(): void {
    const wireMat = new THREE.MeshBasicMaterial({ color: '#1b1426' });
    const palette = ['#ff4fa3', '#36f1e6', '#ffd15c', '#52f29c', '#b388ff'];
    const bulbGeo = new THREE.SphereGeometry(0.11, 8, 6);

    // 2 festive neon string-light garlands spanning from the SUNSET BAR pergola over the dance terrace!
    const strings: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(35.0, ROOF_Y + 2.9, -33.3), new THREE.Vector3(46.2, ROOF_Y + 2.7, -38.5)],
      [new THREE.Vector3(35.0, ROOF_Y + 2.9, -37.1), new THREE.Vector3(45.5, ROOF_Y + 2.7, -47.2)],
    ];

    strings.forEach(([a, b], sIdx) => {
      const dist = a.distanceTo(b);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const wire = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, dist), wireMat);
      wire.position.copy(mid);
      wire.lookAt(b);
      this.partyRoot.add(wire);

      const count = 9;
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const pos = a.clone().lerp(b, t);
        pos.y -= Math.sin(t * Math.PI) * 0.45; // natural gentle garland sag
        const col = palette[(i + sIdx * 2) % palette.length];
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 2.2,
          roughness: 0.25,
        });
        const bulb = new THREE.Mesh(bulbGeo, mat);
        bulb.position.copy(pos);
        this.partyRoot.add(bulb);
        this.stringBulbs.push({ mat, phase: i * 0.75 + sIdx * 2.1 });
      }
    });

    // 2 Sweeping Additive Spotlight Cones (zero extra THREE.Lights -> zero WebGL shader stalls!)
    const coneGeo = new THREE.ConeGeometry(2.6, 8.8, 14, 1, true);
    coneGeo.translate(0, -4.4, 0);
    const spotSpecs: [number, number, string][] = [
      [35.1, -33.4, '#ff4fa3'],
      [35.1, -37.1, '#36f1e6'],
    ];
    for (const [sx, sz, col] of spotSpecs) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, ROOF_Y + 2.9, sz);
      const coneMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      pivot.add(cone);
      this.partyRoot.add(pivot);
      this.spotPivots.push(pivot);
    }
  }

  private buildDjBooth(): void {
    const djGroup = new THREE.Group();
    djGroup.position.set(34.3, ROOF_Y, -41.5);

    const bodyMat = new THREE.MeshStandardMaterial({ color: '#1b1428', roughness: 0.35, metalness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#dce4ef', metalness: 0.9, roughness: 0.15 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 2.3), bodyMat);
    desk.position.y = 0.525;
    desk.castShadow = true;
    djGroup.add(desk);

    // Dual spinning vinyl turntables on top
    for (const tz of [-0.55, 0.55]) {
      const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 14), chromeMat);
      platter.position.set(0.05, 1.07, tz);
      djGroup.add(platter);
    }

    // 6 Glowing Neon Equalizer Bars on the front (+X) of the DJ booth!
    const eqColors = ['#36f1e6', '#52f29c', '#ffd15c', '#ff9f43', '#ff4fa3', '#b388ff'];
    for (let i = 0; i < 6; i++) {
      const col = eqColors[i];
      const barGeo = new THREE.BoxGeometry(0.06, 0.68, 0.18);
      barGeo.translate(0, 0.34, 0);
      const bar = new THREE.Mesh(
        barGeo,
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.0 }),
      );
      bar.position.set(0.5, 0.18, -0.78 + i * 0.31);
      djGroup.add(bar);
      this.eqBars.push(bar);
    }

    // Twin 80s floor speakers flanking the DJ booth
    for (const sz of [-1.55, 1.55]) {
      const spk = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.35, 0.65), bodyMat);
      spk.position.set(-0.05, 0.675, sz);
      spk.castShadow = true;
      djGroup.add(spk);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.03, 6, 14),
        new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 1.8 }),
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(0.34, 0.88, sz);
      djGroup.add(ring);
    }

    this.partyRoot.add(djGroup);
  }

  private buildTributeEnvelope(): void {
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#ffd15c',
      emissive: '#ffaa22',
      emissiveIntensity: 1.4,
      metalness: 0.65,
      roughness: 0.25,
    });
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.26), goldMat);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.13, 0.27),
      new THREE.MeshStandardMaterial({ color: '#52f29c', emissive: '#52f29c', emissiveIntensity: 1.8 }),
    );
    this.tributeGroup.add(env, band);
    this.tributeGroup.position.set(BAR_X + 0.8, ROOF_Y + 1.24, BAR_Z - 1.15);
    this.tributeGroup.visible = false;
    this.partyRoot.add(this.tributeGroup);
  }

  private buildCrewGuests(): void {
    const gunGeo = new THREE.BoxGeometry(0.055, 0.08, 0.28);
    const gunMat = new THREE.MeshStandardMaterial({ color: '#221e2b', metalness: 0.8, roughness: 0.25 });
    const muzzleGeo = new THREE.OctahedronGeometry(0.09, 0);
    const muzzleMat = new THREE.MeshBasicMaterial({ color: '#36f1e6' });
    const shakerMat = new THREE.MeshStandardMaterial({ color: '#e4ecf5', metalness: 0.9, roughness: 0.14 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#ff4fa3',
      emissive: '#ff4fa3',
      emissiveIntensity: 1.2,
    });

    const specs: {
      id: string;
      name: string;
      role: PartyGuestRole;
      canDefend: boolean;
      x: number;
      z: number;
      yaw: number;
      opts: Parameters<typeof buildLowPolyCharacter>[0];
      quips: string[];
    }[] = [
      {
        id: 'party-bartender',
        name: 'TONY (BARKEEPER)',
        role: 'bartender',
        canDefend: false,
        x: 33.6,
        z: -35.2,
        yaw: Math.PI / 2,
        opts: {
          role: 'civilian',
          bodyType: 'male',
          skinColor: '#d99e78',
          hairColor: '#1b1620',
          primaryColor: '#f5efe6',
          accentColor: '#ff4fa3',
          pantsColor: '#1a1824',
          shoeColor: '#141218',
          outfitVariant: 0,
          hairStyle: 'pompadour',
          wearsSunglasses: false,
          hasMustache: true,
        },
        quips: [
          'Die Drinks gehen heute aufs Haus, Boss!',
          'Ein Miami Vice Spezial — frisch geschüttelt!',
          'Bester Ausblick über ganz Ocean Drive!',
        ],
      },
      {
        id: 'party-dj',
        name: 'DJ RICO',
        role: 'dj',
        canDefend: false,
        x: 33.3,
        z: -41.5,
        yaw: Math.PI / 2,
        opts: {
          role: 'civilian',
          bodyType: 'male',
          skinColor: '#b87a56',
          hairColor: '#151218',
          primaryColor: '#ff4fa3',
          accentColor: '#36f1e6',
          pantsColor: '#1f1a2c',
          shoeColor: '#f4efe6',
          outfitVariant: 1,
          hairStyle: 'cap',
          wearsSunglasses: true,
          hasMustache: false,
        },
        quips: [
          '126 BPM direkt über den Dächern von Palm City!',
          'Die Nachbarn hören den Bass bis nach Starfish Island!',
          'Sag Bescheid, wenn die Cops kommen — ich dreh noch lauter!',
        ],
      },
      {
        id: 'party-marco',
        name: 'MARCO',
        role: 'dancer',
        canDefend: true,
        x: 37.3,
        z: -39.4,
        yaw: 0.4,
        opts: {
          role: 'guard',
          bodyType: 'male',
          skinColor: '#e2b294',
          hairColor: '#2a1d18',
          primaryColor: '#ff7eb3',
          accentColor: '#36f1e6',
          pantsColor: '#f4efe6',
          shoeColor: '#f4efe6',
          outfitVariant: 0,
          hairStyle: 'pompadour',
          wearsSunglasses: true,
          hasMustache: true,
        },
        quips: [
          'Auf den nächsten großen Coup, Boss!',
          'Wenn Vice PD stresst, halten wir dir den Rücken frei!',
          'Geilste Dachterrasse in ganz Miami!',
        ],
      },
      {
        id: 'party-elena',
        name: 'ELENA',
        role: 'dancer',
        canDefend: true,
        x: 39.4,
        z: -39.1,
        yaw: -0.5,
        opts: {
          role: 'civilian',
          bodyType: 'female',
          skinColor: '#d69c77',
          hairColor: '#3b2418',
          primaryColor: '#36f1e6',
          accentColor: '#ff4fa3',
          pantsColor: '#fff4e6',
          shoeColor: '#ff4fa3',
          outfitVariant: 2,
          hairStyle: 'ponytail',
          wearsSunglasses: true,
          hasMustache: false,
        },
        quips: [
          'Der Sonnenuntergang hier oben ist unschlagbar!',
          'Prost auf die beste Crew in Palm City!',
          'Falls die Bullen die Party crashen — ich hab meine 9mm dabei!',
        ],
      },
      {
        id: 'party-vince',
        name: 'VINCE',
        role: 'drinker',
        canDefend: true,
        x: 36.1,
        z: -34.0,
        yaw: -Math.PI / 2,
        opts: {
          role: 'bounty',
          bodyType: 'muscular',
          skinColor: '#e8ba9b',
          hairColor: '#4a2e1f',
          primaryColor: '#f5efe6',
          accentColor: '#ff9f43',
          pantsColor: '#242030',
          shoeColor: '#141218',
          outfitVariant: 0,
          hairStyle: 'feathered',
          wearsSunglasses: true,
          hasMustache: true,
        },
        quips: [
          'Der Laden läuft wie geschmiert, Boss!',
          'Ich hab unseren Anteil schon für dich auf den Tresen gelegt.',
          'Noch ein Drink und ich spring vom Dach in den Pool!',
        ],
      },
      {
        id: 'party-horse',
        name: 'DER PFERDEMANN',
        role: 'dancer',
        canDefend: true,
        x: 45.4,
        z: -39.3,
        yaw: -1.1,
        opts: {
          role: 'civilian',
          bodyType: 'male',
          skinColor: '#e2b294',
          hairColor: '#24150d',
          primaryColor: '#ffd15c',
          accentColor: '#ff4fa3',
          pantsColor: '#36f1e6',
          shoeColor: '#1b1622',
          outfitVariant: 0,
          hairStyle: 'pompadour',
          wearsSunglasses: false,
          hasMustache: false,
          horseMask: true,
        },
        quips: [
          '*Wiehern* … Äh, ich meine: Starke Party, Boss!',
          'Unter der Maske ist es heiß — gib mir noch nen Cocktail!',
          'Niemand legt sich mit der Pferdemasken-Gang an!',
        ],
      },
    ];

    specs.forEach((s, idx) => {
      const rig = buildLowPolyCharacter(s.opts);
      const root = new THREE.Group();
      root.position.set(s.x, ROOF_Y, s.z);
      root.rotation.y = s.yaw;
      root.add(rig.bodyRoot);

      let gunMesh: THREE.Mesh | undefined;
      let muzzleMesh: THREE.Mesh | undefined;
      if (s.canDefend) {
        gunMesh = new THREE.Mesh(gunGeo, gunMat);
        gunMesh.position.set(0, -0.02, 0.14);
        gunMesh.visible = false;
        rig.rightHandAnchor.add(gunMesh);

        muzzleMesh = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzleMesh.position.set(0, -0.02, 0.3);
        muzzleMesh.visible = false;
        rig.rightHandAnchor.add(muzzleMesh);
      } else if (s.role === 'bartender') {
        const shaker = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.22, 8), shakerMat);
        shaker.position.set(0, -0.02, 0.08);
        rig.rightHandAnchor.add(shaker);
      }

      if (s.role === 'drinker') {
        const glass = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.13, 8), glassMat);
        glass.rotation.x = Math.PI;
        glass.position.set(0, 0.02, 0.09);
        rig.rightHandAnchor.add(glass);
      }

      this.partyRoot.add(root);
      this.guests.push({
        id: s.id,
        name: s.name,
        role: s.role,
        canDefend: s.canDefend,
        rig,
        root,
        baseX: s.x,
        baseZ: s.z,
        baseYaw: s.yaw,
        phase: idx * 1.15,
        gunMesh,
        muzzleMesh,
        muzzleTimer: 0,
        fireCooldown: 0.4 + idx * 0.2,
        quipIndex: 0,
        quips: s.quips,
      });
    });
  }

  private launchNeonFirework(): void {
    const colors = ['#ff4fa3', '#36f1e6', '#ffd15c', '#52f29c', '#b388ff'];
    const burstColor = colors[Math.floor(Math.random() * colors.length)];
    const bx = 46 + (Math.random() - 0.5) * 14;
    const by = 20 + Math.random() * 6;
    const bz = -40 + (Math.random() - 0.5) * 12;

    for (let i = 0; i < 24; i++) {
      let mesh = this.sparkPool.pop();
      const col = i % 3 === 0 ? '#ffffff' : burstColor;
      if (mesh) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.set(col);
        mat.opacity = 1.0;
        mesh.scale.setScalar(1.2);
        mesh.visible = true;
      } else {
        const mat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 1.0,
        });
        mesh = new THREE.Mesh(this.sparkGeo, mat);
        mesh.scale.setScalar(1.2);
        this.scene.add(mesh);
      }
      mesh.position.set(bx, by, bz);

      // Spherical starburst velocity
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = 4.5 + Math.random() * 6.5;
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.cos(phi) * spd + 1.8,
          Math.sin(phi) * Math.sin(theta) * spd,
        ),
        life: 1.1 + Math.random() * 0.55,
        maxLife: 1.65,
      });
    }
  }

  private updateFireworkSparks(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        this.sparkPool.push(s.mesh);
        const last = this.sparks.length - 1;
        if (i !== last) this.sparks[i] = this.sparks[last];
        this.sparks.pop();
      } else {
        s.mesh.position.addScaledVector(s.vel, dt);
        s.vel.y -= 5.2 * dt;
        s.vel.multiplyScalar(Math.exp(-1.2 * dt));
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / s.maxLife);
      }
    }
  }
}
