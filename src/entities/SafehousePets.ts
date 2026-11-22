import * as THREE from 'three';
import type { ShootableTarget } from '../combat/WeaponSystem';

export type PetId = 'cleo' | 'rico' | 'zeus' | 'elvis';

export interface PetCatalogItem {
  id: PetId;
  name: string;
  title: string;
  price: number;
  promptLabel: string;
}

export const PET_CATALOG: PetCatalogItem[] = [
  {
    id: 'cleo',
    name: 'CLEO',
    title: 'CLEO · HAUSKATZE (TV & LOUNGE)',
    price: 500,
    promptLabel: 'KATZE „CLEO“ KRAULEN (+15 HP)',
  },
  {
    id: 'rico',
    name: 'RICO',
    title: 'RICO · SPRECHENDER ARA-PAPAGEI',
    price: 650,
    promptLabel: 'PAPAGEI „RICO“ ANSPRECHEN & FÜTTERN',
  },
  {
    id: 'zeus',
    name: 'ZEUS',
    title: 'ZEUS · 80s DOBERMANN-WACHHUND',
    price: 900,
    promptLabel: 'DOBERMANN „ZEUS“ KRAULEN (+25 ARMOR)',
  },
  {
    id: 'elvis',
    name: 'ELVIS',
    title: 'ELVIS · MIAMI-VICE POOL-ALLIGATOR',
    price: 1200,
    promptLabel: 'ALLIGATOR „ELVIS“ MIT STEAK FÜTTERN (+25 HP)',
  },
];

export interface PetInteractable {
  id: PetId;
  name: string;
  promptLabel: string;
  hitbox: THREE.Mesh;
}

interface HeartParticle {
  mesh: THREE.Mesh;
  velY: number;
  life: number;
  maxLife: number;
}

// -----------------------------------------------------------------------------
// Procedural High-Resolution Coat, Scale & Feather Canvas Textures (Zero Assets!)
// -----------------------------------------------------------------------------

function createFurTexture(baseHex: string, streakHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = streakHex;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.24;
  for (let i = 0; i < 480; i++) {
    const x = (i * 37) % 128;
    const y = (i * 73) % 128;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 3) - 1) * 2, y + 6 + (i % 5));
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createGatorScaleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#255c39';
  ctx.fillRect(0, 0, 256, 256);

  // Armored crocodilian osteoderm scale grid with crevices & wet highlights
  const rowH = 16;
  const colW = 22;
  for (let y = 0; y < 256; y += rowH) {
    const offset = ((y / rowH) % 2) * (colW * 0.5);
    for (let x = -colW; x < 256 + colW; x += colW) {
      const shade = ((x + y) % 3 === 0) ? '#2f6f46' : ((x + y) % 2 === 0) ? '#225334' : '#35784d';
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.roundRect(x + offset + 1.5, y + 1.5, colW - 3, rowH - 3, 4);
      ctx.fill();

      // Subtle wet ridge highlight
      ctx.fillStyle = 'rgba(205, 245, 195, 0.16)';
      ctx.fillRect(x + offset + 5, y + 3, colW - 10, 2.5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
}

function createFeatherTexture(baseHex: string, edgeHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  // Scalloped imbricated plumage arcs
  ctx.strokeStyle = edgeHex;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.35;
  for (let y = 8; y < 136; y += 12) {
    const shift = ((y / 12) % 2) * 8;
    for (let x = 0; x < 136; x += 16) {
      ctx.beginPath();
      ctx.arc(x + shift, y, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Builds a cute 3D heart shape mesh for floating pet affection particles!
 */
function createHeartGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.08);
  s.bezierCurveTo(0.09, -0.01, 0.12, 0.08, 0.06, 0.12);
  s.bezierCurveTo(0.02, 0.14, 0, 0.1, 0, 0.07);
  s.bezierCurveTo(0, 0.1, -0.02, 0.14, -0.06, 0.12);
  s.bezierCurveTo(-0.12, 0.08, -0.09, -0.01, 0, -0.08);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/**
 * Manages the player's high-detail, sculpted 3D pets inside the VICE SAFEHOUSE (cx = 40, cz = -40).
 * Pets stay safely at home forever, have dedicated home props, organic anatomy & animations,
 * greet the player, and react to 3D-hand petting & feeding!
 */
export class SafehousePets {
  private readonly scene: THREE.Scene;
  private readonly owned = new Set<PetId>();
  private readonly hitboxMat = new THREE.MeshBasicMaterial({ visible: false });

  // 1) CLEO (Tuxedo Cat)
  private readonly cleoGroup = new THREE.Group();
  private readonly cleoProps = new THREE.Group();
  private cleoSpineGroup!: THREE.Group;
  private cleoTailPivot!: THREE.Group;
  private cleoHead!: THREE.Group;
  private cleoToyBall!: THREE.Group;
  private cleoHitbox!: THREE.Mesh;
  private cleoReactTimer = 0;

  // 2) RICO (Scarlet Macaw Parrot)
  private readonly ricoGroup = new THREE.Group();
  private readonly ricoProps = new THREE.Group();
  private ricoWingL!: THREE.Group;
  private ricoWingR!: THREE.Group;
  private ricoHead!: THREE.Group;
  private ricoLowerBeak!: THREE.Mesh;
  private ricoHitbox!: THREE.Mesh;
  private ricoReactTimer = 0;

  // 3) ZEUS (80s Doberman Pinscher)
  private readonly zeusGroup = new THREE.Group();
  private readonly zeusProps = new THREE.Group();
  private zeusHead!: THREE.Group;
  private zeusJawLower!: THREE.Group;
  private zeusTail!: THREE.Group;
  private zeusLegs: THREE.Group[] = [];
  private zeusHitbox!: THREE.Mesh;
  private zeusPos = new THREE.Vector3(41.8, 0.21, -45.2);
  private zeusYaw = 0;
  private zeusWalkPhase = 0;
  private zeusReactTimer = 0;
  private zeusWanderTarget = new THREE.Vector3(43.2, 0.21, -43.5);
  private zeusWanderWait = 1.5;

  // 4) ELVIS (Miami-Vice Rooftop Pool Alligator)
  private readonly elvisGroup = new THREE.Group();
  private readonly elvisProps = new THREE.Group();
  private elvisJawUpper!: THREE.Group;
  private elvisTailSegs: THREE.Group[] = [];
  private elvisSteakGroup!: THREE.Group;
  private elvisHitbox!: THREE.Mesh;
  private elvisReactTimer = 0;

  // Pooled 3D extruded heart particles
  private readonly hearts: HeartParticle[] = [];
  private readonly heartPool: THREE.Mesh[] = [];
  private readonly heartGeo = createHeartGeometry();
  private readonly heartMat = new THREE.MeshStandardMaterial({
    color: '#ff5ca8',
    emissive: '#ff3d96',
    emissiveIntensity: 2.0,
    roughness: 0.25,
  });

  public onPetKilled?: (petName: string) => void;
  private readonly petCombat: Record<
    PetId,
    { hp: number; maxHp: number; dead: boolean; deathTimer: number; respawnTimer: number }
  > = {
    cleo: { hp: 40, maxHp: 40, dead: false, deathTimer: 0, respawnTimer: 0 },
    rico: { hp: 30, maxHp: 30, dead: false, deathTimer: 0, respawnTimer: 0 },
    zeus: { hp: 70, maxHp: 70, dead: false, deathTimer: 0, respawnTimer: 0 },
    elvis: { hp: 120, maxHp: 120, dead: false, deathTimer: 0, respawnTimer: 0 },
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildCleoCat();
    this.buildRicoParrot();
    this.buildZeusDoberman();
    this.buildElvisAlligator();
    this.registerPetShootables();
    this.syncVisibility();
  }

  private registerPetShootables(): void {
    const entries: [PetId, string, THREE.Mesh][] = [
      ['cleo', 'CLEO', this.cleoHitbox],
      ['rico', 'RICO', this.ricoHitbox],
      ['zeus', 'ZEUS', this.zeusHitbox],
      ['elvis', 'ELVIS', this.elvisHitbox],
    ];
    for (const [id, name, hitbox] of entries) {
      const target: ShootableTarget = {
        id: `pet-${id}`,
        mesh: hitbox,
        onHit: (damage: number) => {
          const st = this.petCombat[id];
          if (!this.owned.has(id) || st.dead) return false;
          st.hp -= damage;
          if (st.hp <= 0) {
            st.dead = true;
            st.deathTimer = 0;
            st.respawnTimer = 30.0;
            this.onPetKilled?.(name);
            return true;
          }
          return false;
        },
      };
      hitbox.userData.shootableTarget = target;
    }
  }

  public appendShootableHitboxes(out: THREE.Object3D[]): void {
    if (this.owned.has('cleo') && !this.petCombat.cleo.dead) out.push(this.cleoHitbox);
    if (this.owned.has('rico') && !this.petCombat.rico.dead) out.push(this.ricoHitbox);
    if (this.owned.has('zeus') && !this.petCombat.zeus.dead) out.push(this.zeusHitbox);
    if (this.owned.has('elvis') && !this.petCombat.elvis.dead) out.push(this.elvisHitbox);
  }

  public setOwnedPets(ids: PetId[]): void {
    this.owned.clear();
    for (const id of ids) {
      if (id === 'cleo' || id === 'rico' || id === 'zeus' || id === 'elvis') {
        this.owned.add(id);
      }
    }
    this.syncVisibility();
  }

  public getOwnedPets(): PetId[] {
    return Array.from(this.owned);
  }

  public ownsPet(id: PetId): boolean {
    return this.owned.has(id);
  }

  public adoptPet(id: PetId): void {
    this.owned.add(id);
    this.syncVisibility();
    this.triggerReaction(id);
  }

  private syncVisibility(): void {
    const hasCleo = this.owned.has('cleo');
    this.cleoGroup.visible = hasCleo;
    this.cleoProps.visible = hasCleo;

    const hasRico = this.owned.has('rico');
    this.ricoGroup.visible = hasRico;
    this.ricoProps.visible = hasRico;

    const hasZeus = this.owned.has('zeus');
    this.zeusGroup.visible = hasZeus;
    this.zeusProps.visible = hasZeus;

    const hasElvis = this.owned.has('elvis');
    this.elvisGroup.visible = hasElvis;
    this.elvisProps.visible = hasElvis;
  }

  public getInteractables(): PetInteractable[] {
    const list: PetInteractable[] = [];
    for (const item of PET_CATALOG) {
      if (!this.owned.has(item.id)) continue;
      const hitbox =
        item.id === 'cleo'
          ? this.cleoHitbox
          : item.id === 'rico'
            ? this.ricoHitbox
            : item.id === 'zeus'
              ? this.zeusHitbox
              : this.elvisHitbox;
      list.push({
        id: item.id,
        name: item.name,
        promptLabel: item.promptLabel,
        hitbox,
      });
    }
    return list;
  }

  public triggerReaction(id: PetId): void {
    if (id === 'cleo') {
      this.cleoReactTimer = 2.4;
      this.spawnHearts(this.cleoGroup.position.x, this.cleoGroup.position.y + 0.48, this.cleoGroup.position.z, 4);
    } else if (id === 'rico') {
      this.ricoReactTimer = 2.8;
      this.spawnHearts(this.ricoGroup.position.x, this.ricoGroup.position.y + 0.52, this.ricoGroup.position.z, 4);
    } else if (id === 'zeus') {
      this.zeusReactTimer = 2.6;
      this.spawnHearts(this.zeusPos.x, this.zeusPos.y + 0.98, this.zeusPos.z, 5);
    } else if (id === 'elvis') {
      this.elvisReactTimer = 2.8;
      this.spawnHearts(this.elvisGroup.position.x, this.elvisGroup.position.y + 0.62, this.elvisGroup.position.z, 5);
    }
  }

  private spawnHearts(x: number, y: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const m = this.heartPool.pop() ?? new THREE.Mesh(this.heartGeo, this.heartMat);
      if (!m.parent) this.scene.add(m);
      m.visible = true;
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      m.position.set(x + Math.cos(ang) * 0.26, y + (i % 2) * 0.12, z + Math.sin(ang) * 0.26);
      m.scale.setScalar(1);
      this.hearts.push({
        mesh: m,
        velY: 0.72 + Math.random() * 0.35,
        life: 1.25,
        maxLife: 1.25,
      });
    }
  }

  // ===========================================================================
  // 1) CLEO — High-Detail Sculpted Tuxedo Cat (Velvet Fur, Slit Pupils, Whiskers, S-Tail & Scratching Post)
  // ===========================================================================
  private buildCleoCat(): void {
    const blackFur = new THREE.MeshStandardMaterial({
      map: createFurTexture('#171520', '#2e2a3d'),
      roughness: 0.72,
    });
    const whiteFur = new THREE.MeshStandardMaterial({
      map: createFurTexture('#f7f4f0', '#dfd8cf'),
      roughness: 0.68,
    });
    const nosePink = new THREE.MeshStandardMaterial({ color: '#ff8da8', roughness: 0.4 });
    const innerEarPink = new THREE.MeshStandardMaterial({ color: '#eba0b5', roughness: 0.65 });
    const pinkCollar = new THREE.MeshStandardMaterial({ color: '#ff4fa3', emissive: '#ff4fa3', emissiveIntensity: 2.1 });
    const irisGreen = new THREE.MeshStandardMaterial({ color: '#52f29c', emissive: '#2bbf70', emissiveIntensity: 0.85, roughness: 0.15 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#08070d' });
    const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const whiskerMat = new THREE.MeshBasicMaterial({ color: '#f5f2ed' });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.2, metalness: 0.88 });
    const velvetMat = new THREE.MeshStandardMaterial({ color: '#c44d86', roughness: 0.82 });
    const sisalMat = new THREE.MeshStandardMaterial({ color: '#c9aa7c', roughness: 0.92 });

    // --- Home Props beside the TV Stand (x = 36.8, z = -42.4): Plush Cushion, Sisal Scratching Post & Milk Bowl ---
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.1, 24), velvetMat);
    cushion.position.set(36.9, 0.26, -42.4);
    const cushionRim = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.065, 12, 28), velvetMat);
    cushionRim.rotation.x = Math.PI / 2;
    cushionRim.position.set(36.9, 0.31, -42.4);

    // Scratching post with hanging neon-cyan Pom-Pom toy!
    const postBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.05, 18), velvetMat);
    postBase.position.set(36.2, 0.235, -42.9);
    const sisalPole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.72, 14), sisalMat);
    sisalPole.position.set(36.2, 0.6, -42.9);
    for (let r = 0; r < 10; r++) {
      const ropeRing = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.01, 6, 14), sisalMat);
      ropeRing.rotation.x = Math.PI / 2;
      ropeRing.position.set(36.2, 0.3 + r * 0.06, -42.9);
      this.cleoProps.add(ropeRing);
    }
    const postPlatform = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 18), velvetMat);
    postPlatform.position.set(36.2, 0.97, -42.9);

    this.cleoToyBall = new THREE.Group();
    this.cleoToyBall.position.set(36.36, 0.95, -42.9);
    const stringMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 6), whiskerMat);
    stringMesh.position.y = -0.09;
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#1ca8a0', emissiveIntensity: 0.6 }),
    );
    ballMesh.position.y = -0.19;
    this.cleoToyBall.add(stringMesh, ballMesh);

    // Porcelain & gold milk saucer
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.055, 18), goldMat);
    saucer.position.set(36.4, 0.238, -41.9);
    const milk = new THREE.Mesh(new THREE.CircleGeometry(0.125, 18), whiteFur);
    milk.rotation.x = -Math.PI / 2;
    milk.position.set(36.4, 0.268, -41.9);

    this.cleoProps.add(cushion, cushionRim, postBase, sisalPole, postPlatform, this.cleoToyBall, saucer, milk);
    this.scene.add(this.cleoProps);

    // --- Sculpted Cat Body perched atop the warm 80s CRT TV (38.5, 1.92, -42.4) ---
    this.cleoGroup.position.set(38.5, 1.92, -42.4);
    this.cleoGroup.rotation.y = Math.PI;

    this.cleoSpineGroup = new THREE.Group();
    this.cleoGroup.add(this.cleoSpineGroup);

    // Sleek organic capsule ribcage + rounded haunches
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.24, 12, 18), blackFur);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(0.95, 1.0, 1.08);
    torso.position.set(0, 0.19, 0.01);
    torso.castShadow = true;
    this.cleoSpineGroup.add(torso);

    // Muscular feline hind haunches
    for (const sx of [-1, 1]) {
      const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 10), blackFur);
      haunch.scale.set(0.72, 1.05, 1.15);
      haunch.position.set(sx * 0.058, 0.16, -0.11);
      this.cleoSpineGroup.add(haunch);
    }

    // Fluffy white tuxedo chest bib
    const chestBib = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), whiteFur);
    chestBib.scale.set(0.88, 1.12, 0.72);
    chestBib.position.set(0, 0.175, 0.175);
    this.cleoSpineGroup.add(chestBib);

    // 4 sculpted legs with white tuxedo socks & dainty rounded paws
    for (const [lx, lz, isFront] of [
      [-0.068, 0.145, true],
      [0.068, 0.145, true],
      [-0.072, -0.135, false],
      [0.072, -0.135, false],
    ] as [number, number, boolean][]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, isFront ? 0.12 : 0.11, 8, 12), blackFur);
      leg.position.set(lx, 0.095, lz);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.035, 0.055, 12), whiteFur);
      sock.position.set(lx, 0.035, lz);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), whiteFur);
      paw.scale.set(0.92, 0.55, 1.25);
      paw.position.set(lx, 0.018, lz + 0.018);
      this.cleoGroup.add(leg, sock, paw);
    }

    // Glowing hot-pink collar + golden jingle bell
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.016, 8, 20), pinkCollar);
    collar.rotation.x = Math.PI / 2 - 0.35;
    collar.position.set(0, 0.245, 0.165);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), goldMat);
    bell.position.set(0, 0.205, 0.25);
    this.cleoSpineGroup.add(collar, bell);

    // --- Detailed Feline Head, Almond Slit Eyes, Pink Nose, Whisker Pads & 6 Whiskers ---
    this.cleoHead = new THREE.Group();
    this.cleoHead.position.set(0, 0.31, 0.205);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 14), blackFur);
    cranium.scale.set(1.08, 0.96, 0.98);
    cranium.castShadow = true;
    this.cleoHead.add(cranium);

    // Puffy white whisker cheeks + chin
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), whiteFur);
      cheek.scale.set(1.1, 0.85, 0.9);
      cheek.position.set(sx * 0.032, -0.032, 0.082);
      this.cleoHead.add(cheek);

      // 3 fine whiskers per cheek!
      for (let w = -1; w <= 1; w++) {
        const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.001, 0.11, 4), whiskerMat);
        whisker.rotation.z = sx * (Math.PI / 2 + w * 0.16);
        whisker.rotation.y = sx * -0.22;
        whisker.position.set(sx * 0.082, -0.03 + w * 0.012, 0.09);
        this.cleoHead.add(whisker);
      }
    }

    // Dainty pink triangle cat nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.02, 3), nosePink);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI;
    nose.position.set(0, -0.014, 0.112);
    this.cleoHead.add(nose);

    // Layered pointed ears (black outer shell + soft pink inner concha) & emerald slit-pupil eyes!
    for (const sx of [-1, 1]) {
      const earOuter = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.105, 12), blackFur);
      earOuter.scale.set(0.85, 1.0, 0.55);
      earOuter.position.set(sx * 0.068, 0.105, -0.005);
      earOuter.rotation.z = sx * -0.24;
      earOuter.rotation.x = 0.12;

      const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.075, 10), innerEarPink);
      earInner.scale.set(0.8, 1.0, 0.35);
      earInner.position.set(sx * 0.068, 0.1, 0.008);
      earInner.rotation.z = sx * -0.24;
      earInner.rotation.x = 0.12;

      const eyeIris = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), irisGreen);
      eyeIris.scale.set(1.05, 0.92, 0.55);
      eyeIris.position.set(sx * 0.046, 0.016, 0.088);
      eyeIris.rotation.z = sx * -0.14;

      const slitPupil = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.032, 0.01), pupilMat);
      slitPupil.position.set(sx * 0.047, 0.016, 0.1);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), glintMat);
      glint.position.set(sx * 0.053, 0.024, 0.103);

      this.cleoHead.add(earOuter, earInner, eyeIris, slitPupil, glint);
    }
    this.cleoSpineGroup.add(this.cleoHead);

    // --- Smooth Curved S-Shape TubeGeometry Cat Tail with White Tip! ---
    this.cleoTailPivot = new THREE.Group();
    this.cleoTailPivot.position.set(0, 0.21, -0.175);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.07, -0.09),
      new THREE.Vector3(0, 0.19, -0.12),
      new THREE.Vector3(0, 0.28, -0.06),
    ]);
    const tailTube = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 18, 0.022, 10, false), blackFur);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), whiteFur);
    tailTip.position.set(0, 0.285, -0.058);
    this.cleoTailPivot.add(tailTube, tailTip);
    this.cleoSpineGroup.add(this.cleoTailPivot);

    this.cleoHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.75), this.hitboxMat);
    this.cleoHitbox.position.y = 0.24;
    this.cleoGroup.add(this.cleoHitbox);

    this.scene.add(this.cleoGroup);
  }

  // ===========================================================================
  // 2) RICO — Sculpted Scarlet Macaw (Imbricated Plumage, Hooked Beak, Fanned 8-Feather Wings!)
  // ===========================================================================
  private buildRicoParrot(): void {
    const scarletMat = new THREE.MeshStandardMaterial({
      map: createFeatherTexture('#e62234', '#9e111f'),
      roughness: 0.48,
    });
    const sunGoldMat = new THREE.MeshStandardMaterial({
      map: createFeatherTexture('#ffd026', '#c99708'),
      roughness: 0.46,
    });
    const cobaltMat = new THREE.MeshStandardMaterial({
      map: createFeatherTexture('#1685e8', '#0c4d96'),
      roughness: 0.46,
    });
    const cheekWhite = new THREE.MeshStandardMaterial({ color: '#faf6ef', roughness: 0.55 });
    const upperBeakMat = new THREE.MeshStandardMaterial({ color: '#f5ead4', roughness: 0.25, metalness: 0.1 });
    const lowerBeakMat = new THREE.MeshStandardMaterial({ color: '#1e1c24', roughness: 0.28 });
    const tongueMat = new THREE.MeshStandardMaterial({ color: '#ff6b8b', roughness: 0.5 });
    const eyeRingMat = new THREE.MeshStandardMaterial({ color: '#ffd859', roughness: 0.3 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#09080e' });
    const clawMat = new THREE.MeshStandardMaterial({ color: '#38343f', roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.2, metalness: 0.9 });
    const woodPerchMat = new THREE.MeshStandardMaterial({ color: '#784b2c', roughness: 0.75 });

    // --- Ornate Golden Stand + Natural Hardwood Perch Branch + Hanging Brass Ring Toy (42.0, -39.1) ---
    const trayBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.05, 24), goldMat);
    trayBase.position.set(42.0, 0.235, -39.1);
    const trayRim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 8, 24), goldMat);
    trayRim.rotation.x = Math.PI / 2;
    trayRim.position.set(42.0, 0.26, -39.1);
    const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 1.34, 12), goldMat);
    standPole.position.set(42.0, 0.9, -39.1);
    const perchBranch = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.66, 12), woodPerchMat);
    perchBranch.rotation.z = Math.PI / 2;
    perchBranch.position.set(42.0, 1.56, -39.1);
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.085, 14), goldMat);
    cupL.position.set(41.7, 1.6, -39.1);
    const cupR = cupL.clone();
    cupR.position.x = 42.3;
    const playRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 20), goldMat);
    playRing.position.set(42.18, 1.41, -39.1);
    this.ricoProps.add(trayBase, trayRim, standPole, perchBranch, cupL, cupR, playRing);
    this.scene.add(this.ricoProps);

    // --- Sculpted Teardrop Macaw Body ---
    this.ricoGroup.position.set(42.0, 1.58, -39.1);
    this.ricoGroup.rotation.y = Math.PI * 0.85;

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), scarletMat);
    torso.scale.set(0.92, 1.58, 0.98);
    torso.position.set(0, 0.16, 0.01);
    torso.rotation.x = 0.24;
    torso.castShadow = true;
    this.ricoGroup.add(torso);

    // Zygodactyl claws gripping the perch
    for (const sx of [-0.048, 0.048]) {
      const foot = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 12, Math.PI * 1.35), clawMat);
      foot.rotation.y = Math.PI / 2;
      foot.position.set(sx, 0.005, 0.01);
      this.ricoGroup.add(foot);
    }

    // Layered Long Graduated Macaw Tail Feathers (3 staggered scarlet & cobalt plumes!)
    for (const [tx, len, col, zOff] of [
      [0, 0.46, scarletMat, -0.09],
      [-0.025, 0.38, cobaltMat, -0.105],
      [0.025, 0.38, cobaltMat, -0.105],
    ] as [number, number, THREE.Material, number][]) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.032, len, 8), col);
      plume.scale.set(1.0, 1.0, 0.24);
      plume.rotation.x = Math.PI + 0.32;
      plume.position.set(tx, -0.12, zOff);
      this.ricoGroup.add(plume);
    }

    // --- Sculpted Macaw Head, Bare Facial Patch, Hooked Extruded Beak & Crest ---
    this.ricoHead = new THREE.Group();
    this.ricoHead.position.set(0, 0.33, 0.05);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 14), scarletMat);
    skull.scale.set(0.94, 1.04, 1.06);
    this.ricoHead.add(skull);

    // Feathered crown tuft
    for (let c = 0; c < 3; c++) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.065, 6), scarletMat);
      crest.position.set(0, 0.095, -0.01 - c * 0.02);
      crest.rotation.x = -0.55 - c * 0.2;
      this.ricoHead.add(crest);
    }

    // Bare white Macaw facial patches + bright golden-ringed eyes
    for (const sx of [-1, 1]) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), cheekWhite);
      patch.scale.set(0.55, 0.85, 1.05);
      patch.position.set(sx * 0.056, 0.005, 0.036);
      const eyeRing = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 10), eyeRingMat);
      eyeRing.position.set(sx * 0.075, 0.022, 0.048);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), pupilMat);
      pupil.position.set(sx * 0.082, 0.022, 0.052);
      this.ricoHead.add(patch, eyeRing, pupil);
    }

    // Authentic Curved Hooked Upper Macaw Beak (ExtrudeGeometry) + Articulated Black Lower Mandible!
    const beakShape = new THREE.Shape();
    beakShape.moveTo(0, 0.045);
    beakShape.quadraticCurveTo(0.095, 0.042, 0.115, -0.045);
    beakShape.quadraticCurveTo(0.075, -0.02, 0, -0.01);
    beakShape.closePath();
    const beakGeo = new THREE.ExtrudeGeometry(beakShape, {
      depth: 0.052,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    beakGeo.translate(0, 0, -0.026);
    beakGeo.rotateY(-Math.PI / 2);
    const upperBeak = new THREE.Mesh(beakGeo, upperBeakMat);
    upperBeak.position.set(0, 0.008, 0.072);
    this.ricoHead.add(upperBeak);

    this.ricoLowerBeak = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), lowerBeakMat);
    this.ricoLowerBeak.scale.set(0.78, 0.72, 1.25);
    this.ricoLowerBeak.position.set(0, -0.024, 0.092);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), tongueMat);
    tongue.position.set(0, -0.015, 0.095);
    this.ricoHead.add(this.ricoLowerBeak, tongue);

    this.ricoGroup.add(this.ricoHead);

    // --- Multi-Feather Fanned Macaw Wings (8 individually angled primaries in Scarlet -> Gold -> Cobalt!) ---
    const buildDetailedWing = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.085, 0.22, 0.015);

      // Shoulder covert cap (Scarlet)
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), scarletMat);
      shoulder.scale.set(1.2, 0.45, 1.15);
      shoulder.position.set(side * 0.05, 0.01, 0);
      pivot.add(shoulder);

      // Median coverts (Sun-Gold)
      for (let m = 0; m < 4; m++) {
        const med = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.042), sunGoldMat);
        med.position.set(side * (0.1 + m * 0.022), -0.008, 0.02 - m * 0.032);
        med.rotation.y = side * (-0.12 - m * 0.08);
        pivot.add(med);
      }

      // Long primary flight feathers (Cobalt Blue)
      for (let f = 0; f < 5; f++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.24 + f * 0.018, 6), cobaltMat);
        feather.scale.set(1.0, 1.0, 0.22);
        feather.rotation.z = side * (-Math.PI / 2 + 0.18 + f * 0.11);
        feather.rotation.y = side * (-0.18 - f * 0.09);
        feather.position.set(side * (0.16 + f * 0.028), -0.02, 0.01 - f * 0.036);
        pivot.add(feather);
      }
      return pivot;
    };

    this.ricoWingL = buildDetailedWing(-1);
    this.ricoWingR = buildDetailedWing(1);
    this.ricoWingL.rotation.z = 1.22;
    this.ricoWingR.rotation.z = -1.22;
    this.ricoGroup.add(this.ricoWingL, this.ricoWingR);

    this.ricoHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.75), this.hitboxMat);
    this.ricoHitbox.position.y = 0.12;
    this.ricoGroup.add(this.ricoHitbox);

    this.scene.add(this.ricoGroup);
  }

  // ===========================================================================
  // 3) ZEUS — Sculpted 80s Doberman Pinscher (Deep Chest, Tuck-Up Waist, Panting Tongue, Studded Neon Collar!)
  // ===========================================================================
  private buildZeusDoberman(): void {
    const blackCoat = new THREE.MeshStandardMaterial({
      map: createFurTexture('#16141d', '#2b2738'),
      roughness: 0.44, // sleek glossy Doberman coat!
      metalness: 0.08,
    });
    const rustTan = new THREE.MeshStandardMaterial({
      map: createFurTexture('#c26b32', '#e0894a'),
      roughness: 0.5,
    });
    const wetNoseMat = new THREE.MeshStandardMaterial({ color: '#0d0c12', roughness: 0.12, metalness: 0.25 });
    const tongueMat = new THREE.MeshStandardMaterial({ color: '#f26b8a', roughness: 0.38 });
    const toothMat = new THREE.MeshStandardMaterial({ color: '#faf8f2', roughness: 0.25 });
    const amberEyeMat = new THREE.MeshStandardMaterial({ color: '#d98a2b', roughness: 0.12 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#07060b' });
    const cyanCollar = new THREE.MeshStandardMaterial({ color: '#36f1e6', emissive: '#36f1e6', emissiveIntensity: 2.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.2, metalness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#e6edf5', roughness: 0.18, metalness: 0.9 });
    const bedMat = new THREE.MeshStandardMaterial({ color: '#263850', roughness: 0.85 });
    const bedInnerMat = new THREE.MeshStandardMaterial({ color: '#395273', roughness: 0.88 });

    // --- Deluxe Bolster Dog Bed, Chew Bone & Filled Food/Water Bowls (42.2, -47.2) ---
    const bedPad = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.1, 24), bedInnerMat);
    bedPad.scale.set(1.15, 1.0, 0.88);
    bedPad.position.set(42.2, 0.26, -47.2);
    const bedBolster = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.095, 12, 28), bedMat);
    bedBolster.scale.set(1.15, 0.88, 1.0);
    bedBolster.rotation.x = Math.PI / 2;
    bedBolster.position.set(42.2, 0.31, -47.2);

    // Classic white chew bone beside the bed
    const boneMat = new THREE.MeshStandardMaterial({ color: '#f5eedc', roughness: 0.6 });
    const boneShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), boneMat);
    boneShaft.rotation.z = Math.PI / 2;
    boneShaft.rotation.y = 0.4;
    boneShaft.position.set(41.5, 0.24, -46.8);
    this.zeusProps.add(bedPad, bedBolster, boneShaft);

    // Golden Food Bowl (with kibble) & Water Bowl (with glossy water)
    const bowlF = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.11, 18), goldMat);
    bowlF.position.set(43.25, 0.265, -47.3);
    const kibble = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#6e3f24', roughness: 0.9 }),
    );
    kibble.scale.set(1, 0.35, 1);
    kibble.position.set(43.25, 0.3, -47.3);

    const bowlW = bowlF.clone();
    bowlW.position.x = 43.72;
    const waterDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 18),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.05, metalness: 0.2 }),
    );
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.set(43.72, 0.312, -47.3);
    this.zeusProps.add(bowlF, kibble, bowlW, waterDisc);
    this.scene.add(this.zeusProps);

    // --- Sculpted Athletic Doberman Silhouette ---
    this.zeusGroup.position.copy(this.zeusPos);

    // Deep muscular chest + sleek tucked-up waist + rounded croup
    const deepChest = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 14), blackCoat);
    deepChest.scale.set(0.82, 1.08, 1.28);
    deepChest.position.set(0, 0.56, 0.16);
    deepChest.castShadow = true;

    const waist = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.28, 12, 16), blackCoat);
    waist.rotation.x = Math.PI / 2 - 0.12;
    waist.scale.set(0.86, 1.0, 0.92);
    waist.position.set(0, 0.585, -0.1);
    waist.castShadow = true;

    const croup = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), blackCoat);
    croup.scale.set(0.84, 0.98, 1.05);
    croup.position.set(0, 0.58, -0.26);
    this.zeusGroup.add(deepChest, waist, croup);

    // Signature Doberman rust-tan chest shield patches!
    for (const sx of [-0.068, 0.068]) {
      const shield = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 10), rustTan);
      shield.scale.set(0.75, 0.95, 0.55);
      shield.position.set(sx, 0.52, 0.365);
      this.zeusGroup.add(shield);
    }

    // Proud arched muscular neck + Studded Cyan-Neon Collar + Golden Medallion
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.145, 0.32, 14), blackCoat);
    neck.position.set(0, 0.74, 0.27);
    neck.rotation.x = -0.34;
    neck.castShadow = true;

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.022, 10, 22), cyanCollar);
    collar.rotation.x = Math.PI / 2 - 0.34;
    collar.position.set(0, 0.72, 0.27);
    for (let st = 0; st < 8; st++) {
      const ang = (st / 8) * Math.PI * 2;
      const stud = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.024, 4), chromeMat);
      stud.position.set(Math.sin(ang) * 0.138, 0.72 - Math.cos(ang) * 0.04, 0.27 + Math.cos(ang) * 0.132);
      stud.rotation.z = -ang;
      this.zeusGroup.add(stud);
    }
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.01, 12), goldMat);
    tag.rotation.x = Math.PI / 2;
    tag.position.set(0, 0.65, 0.4);
    this.zeusGroup.add(neck, collar, tag);

    // --- Noble Wedge-Shaped Doberman Head, Cropped Ears, Amber Eyes & Articulated Panting Jaw ---
    this.zeusHead = new THREE.Group();
    this.zeusHead.position.set(0, 0.89, 0.34);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 14), blackCoat);
    cranium.scale.set(0.88, 0.92, 1.15);
    const upperMuzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.082, 0.24, 14), blackCoat);
    upperMuzzle.rotation.x = Math.PI / 2 + 0.08;
    upperMuzzle.scale.set(0.92, 1.0, 0.85);
    upperMuzzle.position.set(0, -0.018, 0.175);

    const tanCheek = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 10), rustTan);
    tanCheek.scale.set(1.22, 0.65, 1.55);
    tanCheek.position.set(0, -0.042, 0.155);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), wetNoseMat);
    nose.scale.set(1.1, 0.85, 0.9);
    nose.position.set(0, -0.012, 0.295);
    this.zeusHead.add(cranium, upperMuzzle, tanCheek, nose);

    // Articulated Lower Jaw + Canines + Happy Pink Tongue!
    this.zeusJawLower = new THREE.Group();
    this.zeusJawLower.position.set(0, -0.055, 0.08);
    const lowerJawMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.058, 0.19, 12), rustTan);
    lowerJawMesh.rotation.x = Math.PI / 2;
    lowerJawMesh.scale.set(0.95, 1.0, 0.55);
    lowerJawMesh.position.set(0, 0, 0.095);
    const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.075, 6, 10), tongueMat);
    tongue.rotation.x = Math.PI / 2 + 0.35;
    tongue.scale.set(1.1, 1.0, 0.35);
    tongue.position.set(0, 0.008, 0.155);
    for (const sx of [-0.032, 0.032]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.024, 6), toothMat);
      fang.position.set(sx, 0.02, 0.155);
      this.zeusJawLower.add(fang);
    }
    this.zeusJawLower.add(lowerJawMesh, tongue);
    this.zeusJawLower.rotation.x = 0.18;
    this.zeusHead.add(this.zeusJawLower);

    // Tall alert cropped Doberman ears + Tan eyebrow pips + Amber eyes
    for (const sx of [-1, 1]) {
      const earOuter = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.185, 10), blackCoat);
      earOuter.scale.set(0.65, 1.0, 0.85);
      earOuter.position.set(sx * 0.072, 0.155, -0.035);
      earOuter.rotation.z = sx * -0.1;
      earOuter.rotation.x = 0.08;

      const earHollow = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.13, 8), rustTan);
      earHollow.scale.set(0.45, 1.0, 0.5);
      earHollow.position.set(sx * 0.072, 0.145, -0.022);
      earHollow.rotation.z = sx * -0.1;
      earHollow.rotation.x = 0.08;

      const browPip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), rustTan);
      browPip.position.set(sx * 0.048, 0.052, 0.095);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 10), amberEyeMat);
      eye.position.set(sx * 0.058, 0.024, 0.095);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), pupilMat);
      pupil.position.set(sx * 0.064, 0.024, 0.106);

      this.zeusHead.add(earOuter, earHollow, browPip, eye, pupil);
    }
    this.zeusGroup.add(this.zeusHead);

    // --- 4 Multi-Jointed Sculpted Legs (Thigh/Shoulder + Tan Lower Foreleg + Sculpted Toe Paws) ---
    this.zeusLegs = [];
    for (const [lx, lz, isFront] of [
      [-0.105, 0.22, true],
      [0.105, 0.22, true],
      [-0.105, -0.25, false],
      [0.105, -0.25, false],
    ] as [number, number, boolean][]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, 0.46, lz);

      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(isFront ? 0.046 : 0.058, 0.18, 8, 12),
        blackCoat,
      );
      thigh.position.set(0, -0.11, isFront ? 0 : -0.015);
      thigh.rotation.x = isFront ? 0.04 : -0.16;
      thigh.castShadow = true;

      const lowerLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.19, 8, 12), rustTan);
      lowerLeg.position.set(0, -0.31, isFront ? 0.01 : 0.015);
      lowerLeg.rotation.x = isFront ? -0.04 : 0.14;

      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), rustTan);
      paw.scale.set(0.92, 0.58, 1.32);
      paw.position.set(0, -0.435, 0.032);

      legPivot.add(thigh, lowerLeg, paw);
      this.zeusLegs.push(legPivot);
      this.zeusGroup.add(legPivot);
    }

    // Docked / Sleek Curved Wagging Doberman Tail
    this.zeusTail = new THREE.Group();
    this.zeusTail.position.set(0, 0.63, -0.35);
    const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.16, 8, 10), blackCoat);
    tailMesh.position.set(0, 0.08, -0.05);
    tailMesh.rotation.x = -0.52;
    this.zeusTail.add(tailMesh);
    this.zeusGroup.add(this.zeusTail);

    this.zeusHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 1.15), this.hitboxMat);
    this.zeusHitbox.position.y = 0.52;
    this.zeusGroup.add(this.zeusHitbox);

    this.scene.add(this.zeusGroup);
  }

  // ===========================================================================
  // 4) ELVIS — High-Detail Sculpted Miami-Vice Alligator (Osteoderm Scales, S-Wave Tail, 24 Teeth & Aviators!)
  // ===========================================================================
  private buildElvisAlligator(): void {
    const gatorScaleMat = new THREE.MeshStandardMaterial({
      map: createGatorScaleTexture(),
      roughness: 0.42, // wet poolside sheen!
      metalness: 0.08,
    });
    const bellyCreamMat = new THREE.MeshStandardMaterial({ color: '#c4d199', roughness: 0.68 });
    const scuteDarkMat = new THREE.MeshStandardMaterial({ color: '#1b452a', roughness: 0.55 });
    const mouthPinkMat = new THREE.MeshStandardMaterial({ color: '#e07a8c', roughness: 0.45 });
    const toothMat = new THREE.MeshStandardMaterial({ color: '#fcfaf2', roughness: 0.22 });
    const clawMat = new THREE.MeshStandardMaterial({ color: '#1d1c1a', roughness: 0.4 });
    const reptileEyeMat = new THREE.MeshStandardMaterial({ color: '#d8e84d', emissive: '#5d6b12', emissiveIntensity: 0.4, roughness: 0.12 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#070805' });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c542', roughness: 0.16, metalness: 0.92 });
    const mirrorLensMat = new THREE.MeshStandardMaterial({ color: '#101828', roughness: 0.05, metalness: 0.96 });

    const roofY = 6.14;

    // --- Helper to build a juicy Marbled T-Bone Steak ---
    const buildTBoneSteak = (scale = 1): THREE.Group => {
      const g = new THREE.Group();
      const meatMat = new THREE.MeshStandardMaterial({ color: '#b5282f', roughness: 0.48 });
      const fatRimMat = new THREE.MeshStandardMaterial({ color: '#f5ebd6', roughness: 0.55 });
      const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.055, 16), meatMat);
      slab.scale.set(1.25, 1.0, 0.92);
      const fatRim = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.016, 8, 20), fatRimMat);
      fatRim.scale.set(1.25, 0.92, 1.0);
      fatRim.rotation.x = Math.PI / 2;
      const tBone1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.022), fatRimMat);
      const tBone2 = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.06, 0.14), fatRimMat);
      tBone2.position.z = 0.03;
      g.add(slab, fatRim, tBone1, tBone2);
      g.scale.setScalar(scale);
      return g;
    };

    // Golden Poolside Serving Platter with a ready T-Bone Steak (46.2, 6.18, -38.4)
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.05, 24), goldMat);
    platter.position.set(46.2, roofY + 0.03, -38.4);
    const platterRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.02, 8, 24), goldMat);
    platterRim.rotation.x = Math.PI / 2;
    platterRim.position.set(46.2, roofY + 0.055, -38.4);
    const platterSteak = buildTBoneSteak(0.95);
    platterSteak.position.set(46.2, roofY + 0.08, -38.4);
    this.elvisProps.add(platter, platterRim, platterSteak);
    this.scene.add(this.elvisProps);

    // --- Sculpted Alligator Body beside the Rooftop Pool (45.0, 6.14, -39.6) ---
    this.elvisGroup.position.set(45.0, roofY, -39.6);
    this.elvisGroup.rotation.y = -0.55;

    // Broad organic barrel ribcage + neck + pale underbelly
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.78, 14, 22), gatorScaleMat);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(1.26, 1.0, 0.64);
    torso.position.set(0, 0.19, 0.02);
    torso.castShadow = true;

    const underBelly = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.76, 10, 16), bellyCreamMat);
    underBelly.rotation.x = Math.PI / 2;
    underBelly.scale.set(1.18, 1.0, 0.32);
    underBelly.position.set(0, 0.085, 0.02);

    // Chunky 80s Cuban-Link Gold Chain around Elvis's neck!
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.028, 10, 24), goldMat);
    chain.scale.set(1.12, 0.75, 1.0);
    chain.rotation.x = Math.PI / 2 - 0.35;
    chain.position.set(0, 0.21, 0.52);
    this.elvisGroup.add(torso, underBelly, chain);

    // 3 Rows of 3D Keeled Osteoderm Scutes along Elvis's back!
    for (let row = 0; row < 6; row++) {
      for (const sx of [-0.12, 0, 0.12]) {
        const scute = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.085, 4), scuteDarkMat);
        scute.scale.set(0.85, 1.0, 1.45);
        scute.rotation.y = Math.PI / 4;
        scute.position.set(sx, 0.34 - Math.abs(sx) * 0.22, 0.42 - row * 0.17);
        this.elvisGroup.add(scute);
      }
    }

    // 4 Muscular Splayed Reptilian Limbs (Upper Limb + Forearm + Webbed Foot + 4 Curved Claws each!)
    for (const [sx, lz] of [
      [-1, 0.36],
      [1, 0.36],
      [-1, -0.34],
      [1, -0.34],
    ]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.27, 0.16, lz);

      const upperLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.14, 8, 12), gatorScaleMat);
      upperLimb.rotation.z = sx * -1.05;
      upperLimb.position.set(sx * 0.08, -0.02, 0);
      upperLimb.castShadow = true;

      const lowerLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 8, 12), gatorScaleMat);
      lowerLimb.rotation.z = sx * -0.32;
      lowerLimb.position.set(sx * 0.16, -0.09, 0.03);

      const footPad = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), gatorScaleMat);
      footPad.scale.set(1.15, 0.38, 1.35);
      footPad.position.set(sx * 0.19, -0.14, 0.08);
      hip.add(upperLimb, lowerLimb, footPad);

      // 4 splayed claws per foot
      for (let c = 0; c < 4; c++) {
        const ang = (c - 1.5) * 0.28;
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.048, 6), clawMat);
        claw.rotation.x = Math.PI / 2 + 0.18;
        claw.rotation.z = -ang;
        claw.position.set(sx * 0.19 + Math.sin(ang) * 0.06, -0.145, 0.155 + Math.cos(ang) * 0.02);
        hip.add(claw);
      }
      this.elvisGroup.add(hip);
    }

    // --- Sculpted Rounded U-Shaped Alligator Jaws, Pink Palate, 24 Teeth & 80s Gold Aviator Sunglasses! ---
    const snoutShape = new THREE.Shape();
    snoutShape.moveTo(-0.21, 0);
    snoutShape.lineTo(-0.18, 0.56);
    snoutShape.quadraticCurveTo(-0.15, 0.76, 0, 0.78);
    snoutShape.quadraticCurveTo(0.15, 0.76, 0.18, 0.56);
    snoutShape.lineTo(0.21, 0);
    snoutShape.closePath();

    const lowerJawGeo = new THREE.ExtrudeGeometry(snoutShape, {
      depth: 0.068,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    lowerJawGeo.rotateX(Math.PI / 2);
    const lowerJaw = new THREE.Mesh(lowerJawGeo, bellyCreamMat);
    lowerJaw.position.set(0, 0.145, 0.55);

    // Fleshy pink tongue inside lower jaw + lower teeth
    const gatorTongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 8, 12), mouthPinkMat);
    gatorTongue.rotation.x = Math.PI / 2;
    gatorTongue.scale.set(1.0, 1.0, 0.28);
    gatorTongue.position.set(0, 0.16, 0.88);
    this.elvisGroup.add(lowerJaw, gatorTongue);

    for (let t = 0; t < 6; t++) {
      const zOff = 0.68 + t * 0.095;
      const halfW = THREE.MathUtils.lerp(0.17, 0.11, t / 5);
      for (const sx of [-1, 1]) {
        const toothL = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.046, 6), toothMat);
        toothL.position.set(sx * halfW, 0.175, zOff);
        this.elvisGroup.add(toothL);
      }
    }

    // Articulated Upper Snout + Raised Nostrils + Reptilian Eyes + Aviator Sunglasses!
    this.elvisJawUpper = new THREE.Group();
    this.elvisJawUpper.position.set(0, 0.21, 0.54);

    const upperJawGeo = new THREE.ExtrudeGeometry(snoutShape, {
      depth: 0.095,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.018,
      bevelSegments: 2,
    });
    upperJawGeo.rotateX(Math.PI / 2);
    const upperSnout = new THREE.Mesh(upperJawGeo, gatorScaleMat);
    upperSnout.position.set(0, 0.095, 0);
    upperSnout.castShadow = true;
    this.elvisJawUpper.add(upperSnout);

    // Raised nostrils at snout tip + Brow ridges + Slit reptile eyes
    for (const sx of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), scuteDarkMat);
      nostril.position.set(sx * 0.065, 0.115, 0.69);

      const eyeTurret = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), gatorScaleMat);
      eyeTurret.scale.set(0.95, 0.9, 1.25);
      eyeTurret.position.set(sx * 0.125, 0.145, 0.11);

      const eyeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), reptileEyeMat);
      eyeOrb.position.set(sx * 0.15, 0.155, 0.12);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.042, 0.012), pupilMat);
      slit.position.set(sx * 0.175, 0.155, 0.125);

      this.elvisJawUpper.add(nostril, eyeTurret, eyeOrb, slit);
    }

    // Interlocking upper conical teeth
    for (let t = 0; t < 6; t++) {
      const zOff = 0.15 + t * 0.095;
      const halfW = THREE.MathUtils.lerp(0.18, 0.115, t / 5);
      for (const sx of [-1, 1]) {
        const toothU = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.052, 6), toothMat);
        toothU.rotation.x = Math.PI;
        toothU.position.set(sx * halfW, -0.015, zOff);
        this.elvisJawUpper.add(toothU);
      }
    }

    // Iconic 80s Gold-Rim Mirrored Aviator Sunglasses!
    const bridgeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), goldMat);
    bridgeTop.rotation.z = Math.PI / 2;
    bridgeTop.position.set(0, 0.215, 0.19);
    const bridgeMid = bridgeTop.clone();
    bridgeMid.position.y = 0.195;
    this.elvisJawUpper.add(bridgeTop, bridgeMid);

    for (const sx of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.009, 8, 18), goldMat);
      rim.scale.set(1.15, 0.92, 1.0);
      rim.position.set(sx * 0.115, 0.175, 0.195);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.066, 18), mirrorLensMat);
      lens.scale.set(1.15, 0.92, 1.0);
      lens.position.set(sx * 0.115, 0.175, 0.198);
      const templeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), goldMat);
      templeArm.rotation.x = Math.PI / 2;
      templeArm.position.set(sx * 0.19, 0.185, 0.11);
      this.elvisJawUpper.add(rim, lens, templeArm);
    }
    this.elvisGroup.add(this.elvisJawUpper);

    // T-Bone Steak inside jaws during feeding animation!
    this.elvisSteakGroup = buildTBoneSteak(0.9);
    this.elvisSteakGroup.position.set(0, 0.19, 0.98);
    this.elvisSteakGroup.visible = false;
    this.elvisGroup.add(this.elvisSteakGroup);

    // --- 6-Segment Articulated S-Wave Crocodilian Tail with Dorsal Crest! ---
    this.elvisTailSegs = [];
    let parentNode: THREE.Group = this.elvisGroup;
    for (let s = 0; s < 6; s++) {
      const segGroup = new THREE.Group();
      segGroup.position.set(0, s === 0 ? 0.18 : 0, s === 0 ? -0.52 : -0.22);
      const rad = THREE.MathUtils.lerp(0.18, 0.035, s / 5);
      const segMesh = new THREE.Mesh(new THREE.CapsuleGeometry(rad, 0.16, 8, 12), gatorScaleMat);
      segMesh.rotation.x = Math.PI / 2;
      segMesh.scale.set(1.1, 1.0, 0.72);
      segMesh.position.z = -0.11;
      segMesh.castShadow = true;

      const fin = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.45, 0.085, 4), scuteDarkMat);
      fin.scale.set(0.55, 1.0, 1.7);
      fin.position.set(0, rad * 0.72 + 0.02, -0.11);
      segGroup.add(segMesh, fin);

      parentNode.add(segGroup);
      this.elvisTailSegs.push(segGroup);
      parentNode = segGroup;
    }

    this.elvisHitbox = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 2.3), this.hitboxMat);
    this.elvisHitbox.position.set(0, 0.35, 0.1);
    this.elvisGroup.add(this.elvisHitbox);

    this.scene.add(this.elvisGroup);
  }

  public getRicoQuip(cash: number, wantedStars: number, drunkLevel: number): string {
    if (wantedStars >= 3) {
      return 'KRÄCHZ! „Helikopter draußen, Boss! Kopf einziehen!“';
    }
    if (wantedStars >= 1) {
      return 'KRÄCHZ! „Vice PD schnüffelt vor der Tür! Bleib cool, Amigo!“';
    }
    if (drunkLevel > 0.2) {
      return 'KRÄCHZ! „Schon wieder zu viele Miami-Vice-Cocktails im Neon Club?!“';
    }
    if (cash >= 5000) {
      return `KRÄCHZ! „$${cash.toLocaleString('en-US')} auf Tasche! Rico will goldene Sonnenblumenkerne!“`;
    }
    const quips = [
      'KRÄCHZ! „Willkommen zuhause im Vice Safehouse, Boss!“',
      'KRÄCHZ! „Vergiss die Sonnenbrille nicht — Ocean Drive gehört uns!“',
      'KRÄCHZ! „Elvis oben am Pool hat schon wieder Hunger!“',
    ];
    return quips[Math.floor(Math.random() * quips.length)];
  }

  public update(dt: number, elapsed: number, playerPos?: THREE.Vector3, insideLounge = false): void {
    const clampedDt = Math.min(dt, 0.05);

    // Update floating 3D heart particles
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.life -= clampedDt;
      if (h.life <= 0) {
        h.mesh.visible = false;
        this.heartPool.push(h.mesh);
        this.hearts.splice(i, 1);
      } else {
        h.mesh.position.y += h.velY * clampedDt;
        h.mesh.rotation.y += clampedDt * 3.2;
        const s = Math.sin((h.life / h.maxLife) * Math.PI) * 1.15;
        h.mesh.scale.setScalar(Math.max(0.01, s));
      }
    }

    // 1) Animate Cleo the Tuxedo Cat
    if (this.owned.has('cleo')) {
      if (this.cleoReactTimer > 0) this.cleoReactTimer = Math.max(0, this.cleoReactTimer - clampedDt);
      const purring = this.cleoReactTimer > 0;
      this.cleoTailPivot.rotation.z = Math.sin(elapsed * (purring ? 8.5 : 2.1)) * (purring ? 0.52 : 0.28);
      this.cleoTailPivot.rotation.x = Math.cos(elapsed * 1.6) * 0.1;
      this.cleoHead.rotation.z = purring ? Math.sin(elapsed * 7.5) * 0.2 : Math.sin(elapsed * 1.1) * 0.07;
      this.cleoHead.rotation.y = Math.sin(elapsed * 0.7) * 0.18;
      this.cleoSpineGroup.scale.y = purring ? 1.14 : 1.0 + Math.sin(elapsed * 2.2) * 0.025;
      this.cleoToyBall.rotation.z = Math.sin(elapsed * 2.8) * 0.22;
    }

    // 2) Animate Rico the Scarlet Macaw (perch idle, beak chatter & graceful 4s flight loop every 18s!)
    if (this.owned.has('rico')) {
      if (this.ricoReactTimer > 0) this.ricoReactTimer = Math.max(0, this.ricoReactTimer - clampedDt);
      const cycle = elapsed % 18.0;
      const flying = cycle > 13.5 && cycle < 17.5;

      if (flying) {
        const ft = (cycle - 13.5) / 4.0;
        const ang = ft * Math.PI * 2;
        const fx = 41.2 + Math.sin(ang) * 2.6;
        const fz = -41.5 + Math.cos(ang) * 2.4;
        const fy = 1.58 + Math.sin(ft * Math.PI) * 1.35;
        this.ricoGroup.position.set(fx, fy, fz);
        this.ricoGroup.rotation.y = Math.atan2(Math.cos(ang) * 2.6, -Math.sin(ang) * 2.4);
        const flap = Math.sin(elapsed * 22.0) * 0.85;
        this.ricoWingL.rotation.z = flap;
        this.ricoWingR.rotation.z = -flap;
      } else {
        this.ricoGroup.position.set(42.0, 1.58 + Math.sin(elapsed * 2.2) * 0.008, -39.1);
        this.ricoGroup.rotation.y = Math.PI * 0.85 + Math.sin(elapsed * 1.3) * 0.14;
        if (this.ricoReactTimer > 0) {
          const flap = Math.sin(elapsed * 19.0) * 0.72;
          this.ricoWingL.rotation.z = 0.25 + flap;
          this.ricoWingR.rotation.z = -0.25 - flap;
          this.ricoHead.rotation.z = Math.sin(elapsed * 12) * 0.24;
          this.ricoLowerBeak.position.y = -0.024 - Math.abs(Math.sin(elapsed * 18)) * 0.016;
        } else {
          this.ricoWingL.rotation.z = 1.22;
          this.ricoWingR.rotation.z = -1.22;
          this.ricoHead.rotation.z = Math.sin(elapsed * 1.7) * 0.12;
          this.ricoHead.rotation.y = Math.cos(elapsed * 0.9) * 0.22;
          this.ricoLowerBeak.position.y = -0.024;
        }
      }
    }

    // Tick dead pet tip-over & 30s respawn
    const petGroups: [PetId, THREE.Group][] = [
      ['cleo', this.cleoGroup],
      ['rico', this.ricoGroup],
      ['zeus', this.zeusGroup],
      ['elvis', this.elvisGroup],
    ];
    for (const [id, grp] of petGroups) {
      const st = this.petCombat[id];
      if (!st.dead) continue;
      st.deathTimer += clampedDt;
      st.respawnTimer -= clampedDt;
      grp.rotation.z = THREE.MathUtils.lerp(grp.rotation.z, Math.PI / 2, Math.min(1, clampedDt * 8));
      if (st.deathTimer > 3.5) grp.visible = false;
      if (st.respawnTimer <= 0) {
        st.dead = false;
        st.hp = st.maxHp;
        grp.rotation.z = 0;
        grp.visible = this.owned.has(id);
      }
    }

    // 3) Animate Zeus the Doberman (greets player happily, pants softly & patrols lounge)
    if (this.owned.has('zeus') && !this.petCombat.zeus.dead) {
      if (this.zeusReactTimer > 0) this.zeusReactTimer = Math.max(0, this.zeusReactTimer - clampedDt);

      let targetX = this.zeusWanderTarget.x;
      let targetZ = this.zeusWanderTarget.z;
      let stopDist = 0.35;

      if (insideLounge && playerPos && playerPos.y < 3.0) {
        targetX = THREE.MathUtils.clamp(playerPos.x, 33.5, 46.5);
        targetZ = THREE.MathUtils.clamp(playerPos.z, -46.8, -39.6);
        stopDist = 1.75;
      } else {
        this.zeusWanderWait -= clampedDt;
        if (this.zeusWanderWait <= 0) {
          const spots: [number, number][] = [
            [42.2, -46.6],
            [43.4, -46.6],
            [40.2, -44.2],
            [45.5, -43.0],
          ];
          const pick = spots[Math.floor(Math.random() * spots.length)];
          this.zeusWanderTarget.set(pick[0], 0.21, pick[1]);
          this.zeusWanderWait = 4.0 + Math.random() * 4.0;
        }
      }

      const dx = targetX - this.zeusPos.x;
      const dz = targetZ - this.zeusPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > stopDist) {
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - this.zeusYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.zeusYaw += diff * Math.min(1, clampedDt * 7.5);

        const moveSpd = insideLounge ? 2.6 : 1.35;
        this.zeusPos.x += Math.sin(this.zeusYaw) * moveSpd * clampedDt;
        this.zeusPos.z += Math.cos(this.zeusYaw) * moveSpd * clampedDt;

        this.zeusWalkPhase += clampedDt * moveSpd * 4.2;
        const swing = Math.sin(this.zeusWalkPhase) * 0.46;
        this.zeusLegs[0].rotation.x = swing;
        this.zeusLegs[3].rotation.x = swing;
        this.zeusLegs[1].rotation.x = -swing;
        this.zeusLegs[2].rotation.x = -swing;
      } else {
        for (const leg of this.zeusLegs) leg.rotation.x *= 0.82;
        if (insideLounge && playerPos) {
          const lookYaw = Math.atan2(playerPos.x - this.zeusPos.x, playerPos.z - this.zeusPos.z);
          let diff = lookYaw - this.zeusYaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.zeusYaw += diff * Math.min(1, clampedDt * 6.0);
        }
      }

      const jumpHop = this.zeusReactTimer > 0 ? Math.abs(Math.sin(elapsed * 11.0)) * 0.16 : 0;
      this.zeusGroup.position.set(this.zeusPos.x, this.zeusPos.y + jumpHop, this.zeusPos.z);
      this.zeusGroup.rotation.y = this.zeusYaw;
      const wagSpeed = this.zeusReactTimer > 0 || insideLounge ? 14.5 : 4.5;
      this.zeusTail.rotation.z = Math.sin(elapsed * wagSpeed) * 0.48;
      this.zeusHead.rotation.x = insideLounge ? -0.16 : Math.sin(elapsed * 1.5) * 0.05;
      // Happy panting jaw motion
      this.zeusJawLower.rotation.x = 0.16 + Math.abs(Math.sin(elapsed * (insideLounge ? 7.5 : 3.2))) * 0.14;
    }

    // 4) Animate Elvis the Rooftop Pool Alligator (traveling S-wave tail + T-bone chomp!)
    if (this.owned.has('elvis')) {
      const excited = this.elvisReactTimer > 0;
      if (excited) {
        this.elvisReactTimer = Math.max(0, this.elvisReactTimer - clampedDt);
        const chomp = Math.abs(Math.sin(elapsed * 13.0)) * 0.45;
        this.elvisJawUpper.rotation.x = -chomp;
        this.elvisSteakGroup.visible = this.elvisReactTimer > 0.7;
      } else {
        this.elvisSteakGroup.visible = false;
        const baskOpen = Math.max(0, Math.sin(elapsed * 0.85)) * 0.15;
        this.elvisJawUpper.rotation.x = -baskOpen;
      }

      // Organic sinusoidal S-wave propagating down all 6 crocodilian tail segments!
      const waveFreq = excited ? 9.5 : 1.7;
      const waveAmp = excited ? 0.18 : 0.065;
      for (let s = 0; s < this.elvisTailSegs.length; s++) {
        this.elvisTailSegs[s].rotation.y = Math.sin(elapsed * waveFreq - s * 0.65) * waveAmp;
      }
    }
  }
}
