import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Procedural High-Detail Animal Coat, Plumage & Shell Textures (Zero Assets!)
// -----------------------------------------------------------------------------

function createPlumageTexture(baseHex: string, accentHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.36;
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

function createTurtleCarapaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3d4f2f';
  ctx.fillRect(0, 0, 256, 256);

  // Hexagonal scute plates with warm amber sunburst centers
  const centers: [number, number, number][] = [
    [128, 64, 34],
    [128, 128, 38],
    [128, 192, 34],
    [74, 88, 30],
    [182, 88, 30],
    [68, 152, 30],
    [188, 152, 30],
  ];
  for (const [cx, cy, r] of centers) {
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    grad.addColorStop(0, '#c8963e');
    grad.addColorStop(0.65, '#6b532b');
    grad.addColorStop(1, '#2b3622');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1d2417';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface FlamingoAgent {
  group: THREE.Group;
  neckPivot: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  baseX: number;
  baseZ: number;
  groundY: number;
  offsetX: number;
  offsetZ: number;
  yaw: number;
  phase: number;
  oneLeg: boolean;
}

interface DolphinAgent {
  group: THREE.Group;
  tailPivot: THREE.Group;
  splashRing: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radius: number;
  speed: number;
  phase: number;
}

interface SharkAgent {
  group: THREE.Group;
  tailPivot: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  speed: number;
  phase: number;
}

interface PelicanAgent {
  group: THREE.Group;
  headPivot: THREE.Group;
  pouchMesh: THREE.Mesh;
  wingL: THREE.Group;
  wingR: THREE.Group;
  pos: THREE.Vector3;
  baseYaw: number;
  phase: number;
}

interface SeaTurtleAgent {
  group: THREE.Group;
  flipperFL: THREE.Group;
  flipperFR: THREE.Group;
  headGroup: THREE.Group;
  centerX: number;
  centerZ: number;
  radius: number;
  phase: number;
}

interface RoosterAgent {
  group: THREE.Group;
  headPivot: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  pos: THREE.Vector3;
  homeX: number;
  homeZ: number;
  targetX: number;
  targetZ: number;
  yaw: number;
  waitTimer: number;
  spookTimer: number;
  walkPhase: number;
  phase: number;
}

/**
 * Populates Vice Dusk's districts & oceans with high-detail procedural 3D wildlife:
 * 1) Pink Miami Flamingos (Shallow Beach Lagoon & Starfish Island Lawn)
 * 2) Leaping Bottlenose Dolphins (East Ocean & North Marina Bay)
 * 3) Circling Reef Sharks (Deep Outer Ocean — dorsal fin cutting the waves!)
 * 4) Brown Coastal Pelicans (Marina Pilings, Beach Pier & Vice Port)
 * 5) Sea Turtles (Gliding through clear coastal shallows)
 * 6) Colorful "Calle Ocho" Roosters (Strutting & pecking on Little Havana Plaza!)
 * Zero extra PointLights + distance-culled joint updates -> < 0.15ms CPU budget!
 */
export class WildlifeSystem {
  private readonly scene: THREE.Scene;
  private readonly flamingos: FlamingoAgent[] = [];
  private readonly dolphins: DolphinAgent[] = [];
  private readonly sharks: SharkAgent[] = [];
  private readonly pelicans: PelicanAgent[] = [];
  private readonly turtles: SeaTurtleAgent[] = [];
  private readonly roosters: RoosterAgent[] = [];

  private sharkBiteCooldown = 0;
  private roosterCluckCooldown = 0;

  public onSharkNipPlayer?: () => void;
  public onRoosterSpooked?: () => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.spawnFlamingos();
    this.spawnDolphins();
    this.spawnSharks();
    this.spawnPelicans();
    this.spawnSeaTurtles();
    this.spawnHavanaRoosters();
  }

  // ===========================================================================
  // 1) PINK MIAMI FLAMINGOS (S-Curve Tube Neck, Hooked Two-Tone Bill, Coral Plumage)
  // ===========================================================================
  private spawnFlamingos(): void {
    const coralFeatherMat = new THREE.MeshStandardMaterial({
      map: createPlumageTexture('#ff7096', '#e04872'),
      roughness: 0.55,
    });
    const wingTipBlack = new THREE.MeshStandardMaterial({ color: '#1b1822', roughness: 0.55 });
    const legPinkMat = new THREE.MeshStandardMaterial({ color: '#f28da8', roughness: 0.5 });
    const beakBaseMat = new THREE.MeshStandardMaterial({ color: '#ffdbe5', roughness: 0.35 });
    const beakTipMat = new THREE.MeshStandardMaterial({ color: '#17151e', roughness: 0.3 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffe066' });

    const spots: [number, number, number, number][] = [
      // Shallow Beach Lagoon (standing in ankle-deep surf!)
      [96.2, -0.14, -32.5, 0.8],
      [97.4, -0.16, -30.2, 2.1],
      [95.8, -0.12, -28.4, -0.5],
      [96.8, -0.15, 38.0, 1.4],
      [95.6, -0.12, 40.2, -1.2],
      // Starfish Island Tropical Estate Lawn (y = 0.68)
      [155.5, 0.68, -38.5, 0.4],
      [157.2, 0.68, -36.8, 2.5],
      [154.4, 0.68, -35.6, -0.9],
    ];

    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.16, 0.12),
      new THREE.Vector3(0, 0.36, 0.02),
      new THREE.Vector3(0, 0.52, 0.08),
    ]);
    const neckGeo = new THREE.TubeGeometry(neckCurve, 16, 0.032, 10, false);

    spots.forEach(([bx, gy, bz, yaw], idx) => {
      const g = new THREE.Group();
      g.position.set(bx, gy, bz);
      g.rotation.y = yaw;

      // Slender stilts legs (every second flamingo stands on one leg with the other tucked!)
      const oneLeg = idx % 2 === 1;
      const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.68, 8), legPinkMat);
      legL.position.set(-0.045, 0.34, 0);
      const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), legPinkMat);
      kneeL.position.set(-0.045, 0.36, -0.01);
      g.add(legL, kneeL);

      if (oneLeg) {
        const tuckedUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.34, 8), legPinkMat);
        tuckedUpper.position.set(0.045, 0.52, -0.06);
        tuckedUpper.rotation.x = 0.65;
        const tuckedLower = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.32, 8), legPinkMat);
        tuckedLower.position.set(0.045, 0.42, -0.04);
        tuckedLower.rotation.x = -1.2;
        g.add(tuckedUpper, tuckedLower);
      } else {
        const legR = legL.clone();
        legR.position.x = 0.045;
        g.add(legR);
      }

      // Sculpted oval body + drooping coral/black tail coverts
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), coralFeatherMat);
      body.scale.set(0.82, 0.88, 1.38);
      body.position.set(0, 0.72, -0.02);
      body.castShadow = true;
      const tailDroop = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), wingTipBlack);
      tailDroop.scale.set(0.8, 1.0, 0.45);
      tailDroop.rotation.x = -Math.PI * 0.68;
      tailDroop.position.set(0, 0.66, -0.24);
      g.add(body, tailDroop);

      // Folded Flamingo Wings with black flight-feather tips
      const buildWing = (side: -1 | 1): THREE.Group => {
        const wp = new THREE.Group();
        wp.position.set(side * 0.12, 0.74, 0.02);
        const wCovert = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), coralFeatherMat);
        wCovert.scale.set(0.32, 0.72, 1.35);
        wCovert.position.set(side * 0.02, -0.02, -0.04);
        const wBlack = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), wingTipBlack);
        wBlack.scale.set(0.35, 1.0, 0.8);
        wBlack.rotation.x = -Math.PI * 0.62;
        wBlack.position.set(side * 0.025, -0.06, -0.18);
        wp.add(wCovert, wBlack);
        return wp;
      };
      const wingL = buildWing(-1);
      const wingR = buildWing(1);
      g.add(wingL, wingR);

      // Graceful S-Curve Neck Pivot + Head + Bent Roman Flamingo Beak
      const neckPivot = new THREE.Group();
      neckPivot.position.set(0, 0.78, 0.14);
      const neckMesh = new THREE.Mesh(neckGeo, coralFeatherMat);
      neckMesh.castShadow = true;

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), coralFeatherMat);
      head.scale.set(0.88, 0.92, 1.15);
      head.position.set(0, 0.54, 0.09);

      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), eyeMat);
        eye.position.set(sx * 0.048, 0.55, 0.11);
        neckPivot.add(eye);
      }

      // Characteristic downward-bent two-tone Flamingo bill!
      const beakUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.09, 8), beakBaseMat);
      beakUpper.rotation.x = Math.PI / 2 + 0.25;
      beakUpper.position.set(0, 0.525, 0.18);
      const beakHook = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 8), beakTipMat);
      beakHook.rotation.x = Math.PI * 0.78;
      beakHook.position.set(0, 0.475, 0.235);

      neckPivot.add(neckMesh, head, beakUpper, beakHook);
      g.add(neckPivot);

      this.scene.add(g);
      this.flamingos.push({
        group: g,
        neckPivot,
        wingL,
        wingR,
        baseX: bx,
        baseZ: bz,
        groundY: gy,
        offsetX: 0,
        offsetZ: 0,
        yaw,
        phase: idx * 1.35,
        oneLeg,
      });
    });
  }

  // ===========================================================================
  // 2) LEAPING BOTTLENOSE DOLPHINS (Sleek Glossy Body, Dorsal Fin, Fluke & Splash Rings!)
  // ===========================================================================
  private spawnDolphins(): void {
    const dolphinBackMat = new THREE.MeshStandardMaterial({ color: '#4d6b88', roughness: 0.14, metalness: 0.18 });
    const dolphinBellyMat = new THREE.MeshStandardMaterial({ color: '#dce6f0', roughness: 0.18, metalness: 0.1 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#0d131c' });

    // Curved falcate dorsal fin geometry
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.quadraticCurveTo(0.08, 0.28, -0.18, 0.34);
    finShape.quadraticCurveTo(-0.08, 0.14, -0.22, 0);
    finShape.closePath();
    const dorsalGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008 });
    dorsalGeo.translate(0, 0, -0.014);
    dorsalGeo.rotateY(Math.PI / 2);

    const pods: [number, number, number, number, number][] = [
      // Pod 1: East Ocean between Beach Pier, Superyacht & Starfish Island
      [138, 12, 16, 0.48, 0.0],
      [138, 12, 13.5, 0.48, 0.55],
      // Pod 2: North Marina Bay off Cape Vice Cliff
      [28, -128, 15, 0.45, 2.1],
      [28, -128, 12.5, 0.45, 2.65],
    ];

    pods.forEach(([cx, cz, radius, speed, phase]) => {
      const g = new THREE.Group();

      // Torpedo spindle body + pale belly + tapered peduncle
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.15, 12, 18), dolphinBackMat);
      body.rotation.x = Math.PI / 2;
      body.scale.set(0.92, 1.0, 1.05);
      const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 1.05, 10, 14), dolphinBellyMat);
      belly.rotation.x = Math.PI / 2;
      belly.position.set(0, -0.06, 0.04);
      const melon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), dolphinBackMat);
      melon.scale.set(0.88, 0.92, 1.25);
      melon.position.set(0, 0.03, 0.58);

      // Characteristic Bottlenose Rostrum ("smile" beak)
      const rostrum = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 8, 12), dolphinBackMat);
      rostrum.rotation.x = Math.PI / 2;
      rostrum.scale.set(1.05, 1.0, 0.68);
      rostrum.position.set(0, -0.04, 0.84);

      const dorsal = new THREE.Mesh(dorsalGeo, dolphinBackMat);
      dorsal.position.set(0, 0.21, -0.04);

      // Pectoral flippers
      for (const sx of [-1, 1]) {
        const flipper = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 8), dolphinBackMat);
        flipper.scale.set(1.0, 1.0, 0.25);
        flipper.rotation.z = sx * (Math.PI / 2 + 0.45);
        flipper.rotation.y = sx * -0.35;
        flipper.position.set(sx * 0.26, -0.1, 0.28);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
        eye.position.set(sx * 0.185, 0.03, 0.62);
        g.add(flipper, eye);
      }

      // Articulated Tail Stock + Horizontal Whale/Dolphin Flukes!
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.68);
      const stock = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 12), dolphinBackMat);
      stock.rotation.x = -Math.PI / 2;
      stock.position.z = -0.24;
      for (const sx of [-1, 1]) {
        const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 8), dolphinBackMat);
        fluke.scale.set(1.0, 1.0, 0.22);
        fluke.rotation.z = sx * (Math.PI / 2 + 0.25);
        fluke.rotation.y = sx * 0.35;
        fluke.position.set(sx * 0.16, 0, -0.5);
        tailPivot.add(fluke);
      }
      tailPivot.add(stock);

      g.add(body, belly, melon, rostrum, dorsal, tailPivot);
      this.scene.add(g);

      const splashRing = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.65, 20),
        new THREE.MeshBasicMaterial({ color: '#f0fbff', transparent: true, opacity: 0, side: THREE.DoubleSide }),
      );
      splashRing.rotation.x = -Math.PI / 2;
      this.scene.add(splashRing);

      this.dolphins.push({ group: g, tailPivot, splashRing, centerX: cx, centerZ: cz, radius, speed, phase });
    });
  }

  // ===========================================================================
  // 3) CIRCLING DEEP-SEA REEF SHARKS (Dorsal Fin Cutting Waves, Gill Slits & Vertical Caudal Fin)
  // ===========================================================================
  private spawnSharks(): void {
    const sharkGreyMat = new THREE.MeshStandardMaterial({ color: '#3b4959', roughness: 0.26, metalness: 0.12 });
    const sharkWhiteMat = new THREE.MeshStandardMaterial({ color: '#e6ecf2', roughness: 0.35 });
    const gillMat = new THREE.MeshBasicMaterial({ color: '#1b222b' });

    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(0.08, 0.52);
    dorsalShape.quadraticCurveTo(-0.12, 0.32, -0.34, 0);
    dorsalShape.closePath();
    const sharkDorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008 });
    sharkDorsalGeo.translate(0, 0, -0.0175);
    sharkDorsalGeo.rotateY(Math.PI / 2);

    const spots: [number, number, number, number, number][] = [
      [138, 44, 15, 0.32, 0.0], // Outer East Deep Ocean
      [-24, -138, 13, 0.35, 1.9], // Outer North Bay beyond Marina Piers
    ];

    spots.forEach(([cx, cz, radius, speed, phase]) => {
      const g = new THREE.Group();

      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.45, 12, 18), sharkGreyMat);
      torso.rotation.x = Math.PI / 2;
      torso.scale.set(0.95, 1.0, 0.88);
      const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.32, 10, 14), sharkWhiteMat);
      belly.rotation.x = Math.PI / 2;
      belly.position.set(0, -0.08, 0.02);

      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.62, 14), sharkGreyMat);
      snout.rotation.x = Math.PI / 2;
      snout.scale.set(1.02, 1.0, 0.72);
      snout.position.set(0, 0.01, 0.96);

      // Towering dorsal fin that slices cleanly above the water surface!
      const dorsal = new THREE.Mesh(sharkDorsalGeo, sharkGreyMat);
      dorsal.position.set(0, 0.22, 0.12);

      // Pectoral fins + 4 gill slits per side
      for (const sx of [-1, 1]) {
        const pec = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.58, 8), sharkGreyMat);
        pec.scale.set(1.0, 1.0, 0.2);
        pec.rotation.z = sx * (Math.PI / 2 + 0.3);
        pec.rotation.y = sx * -0.28;
        pec.position.set(sx * 0.34, -0.1, 0.32);
        g.add(pec);

        for (let gl = 0; gl < 4; gl++) {
          const gill = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.11, 0.014), gillMat);
          gill.position.set(sx * 0.265, 0.02, 0.48 - gl * 0.045);
          g.add(gill);
        }
      }

      // Sweeping Vertical Heterocercal Shark Tail!
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.82);
      const peduncle = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.65, 12), sharkGreyMat);
      peduncle.rotation.x = -Math.PI / 2;
      peduncle.position.z = -0.28;
      const upperLobe = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.62, 8), sharkGreyMat);
      upperLobe.scale.set(0.25, 1.0, 1.0);
      upperLobe.rotation.x = -0.58;
      upperLobe.position.set(0, 0.22, -0.68);
      const lowerLobe = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.34, 8), sharkGreyMat);
      lowerLobe.scale.set(0.25, 1.0, 1.0);
      lowerLobe.rotation.x = -2.45;
      lowerLobe.position.set(0, -0.12, -0.62);
      tailPivot.add(peduncle, upperLobe, lowerLobe);

      g.add(torso, belly, snout, dorsal, tailPivot);
      this.scene.add(g);
      this.sharks.push({ group: g, tailPivot, centerX: cx, centerZ: cz, radius, speed, phase });
    });
  }

  // ===========================================================================
  // 4) BROWN COASTAL PELICANS (Gular Throat Pouch, White Neck & Pier Perching)
  // ===========================================================================
  private spawnPelicans(): void {
    const bodyBrownMat = new THREE.MeshStandardMaterial({
      map: createPlumageTexture('#6e6259', '#4a413b'),
      roughness: 0.65,
    });
    const headWhiteMat = new THREE.MeshStandardMaterial({ color: '#f5efe4', roughness: 0.6 });
    const beakGreyMat = new THREE.MeshStandardMaterial({ color: '#d4b483', roughness: 0.4 });
    const pouchAmberMat = new THREE.MeshStandardMaterial({ color: '#e08a3c', roughness: 0.55 });
    const footMat = new THREE.MeshStandardMaterial({ color: '#38353b', roughness: 0.6 });

    // Perched atop Marina Pier pilings, Beach Pier & Vice Port quay!
    const spots: [number, number, number, number][] = [
      [-37.75, 1.38, -112.0, 0.5], // West Marina Pier piling
      [-6.25, 1.38, -117.5, -0.8], // Center Marina Pier piling
      [21.75, 1.38, -106.5, -1.2], // East Marina Pier piling
      [105.0, 1.42, 6.2, 1.8], // Ocean Drive Wooden Beach Pier
      [12.0, 0.65, 125.2, 0.2], // Vice Port South Quay Bollard!
    ];

    spots.forEach(([px, py, pz, yaw], idx) => {
      const g = new THREE.Group();
      g.position.set(px, py, pz);
      g.rotation.y = yaw;

      // Webbed feet
      for (const sx of [-0.055, 0.055]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.14, 6), footMat);
        leg.position.set(sx, 0.07, 0);
        const web = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.02, 4), footMat);
        web.position.set(sx, 0.01, 0.025);
        g.add(leg, web);
      }

      // Plump coastal Pelican body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), bodyBrownMat);
      body.scale.set(0.88, 0.92, 1.35);
      body.position.set(0, 0.24, -0.02);
      body.rotation.x = -0.18;
      body.castShadow = true;
      g.add(body);

      const buildWing = (side: -1 | 1): THREE.Group => {
        const wp = new THREE.Group();
        wp.position.set(side * 0.15, 0.27, 0.02);
        const wMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), bodyBrownMat);
        wMesh.scale.set(0.28, 0.72, 1.45);
        wMesh.position.set(side * 0.02, -0.02, -0.06);
        wp.add(wMesh);
        return wp;
      };
      const wingL = buildWing(-1);
      const wingR = buildWing(1);
      g.add(wingL, wingR);

      // White S-Neck + Head + Long Flat Bill + Expandable Gular Throat Pouch!
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.34, 0.14);
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 8, 12), headWhiteMat);
      neck.position.set(0, 0.09, 0.01);
      neck.rotation.x = -0.15;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), headWhiteMat);
      skull.position.set(0, 0.21, 0.02);

      const upperBill = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.028, 0.34), beakGreyMat);
      upperBill.position.set(0, 0.2, 0.21);
      upperBill.rotation.x = 0.08;

      const pouchMesh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), pouchAmberMat);
      pouchMesh.scale.set(0.55, 0.85, 2.2);
      pouchMesh.position.set(0, 0.145, 0.19);
      pouchMesh.rotation.x = 0.12;

      headPivot.add(neck, skull, upperBill, pouchMesh);
      g.add(headPivot);

      this.scene.add(g);
      this.pelicans.push({
        group: g,
        headPivot,
        pouchMesh,
        wingL,
        wingR,
        pos: new THREE.Vector3(px, py, pz),
        baseYaw: yaw,
        phase: idx * 1.6,
      });
    });
  }

  // ===========================================================================
  // 5) SEA TURTLES (Hex-Scute Domed Carapace & Rowing Flippers in Clear Shallows)
  // ===========================================================================
  private spawnSeaTurtles(): void {
    const carapaceMat = new THREE.MeshStandardMaterial({
      map: createTurtleCarapaceTexture(),
      roughness: 0.34,
      metalness: 0.08,
    });
    const skinOliveMat = new THREE.MeshStandardMaterial({ color: '#5c6e46', roughness: 0.52 });

    const spots: [number, number, number, number][] = [
      [106, -4, 4.5, 0.0],
      [109, 15, 5.2, 2.1],
      [145, -34, 4.8, 4.0],
    ];

    spots.forEach(([cx, cz, radius, phase]) => {
      const g = new THREE.Group();

      // Domed oval carapace shell
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), carapaceMat);
      shell.scale.set(0.88, 0.58, 1.18);
      shell.position.y = -0.04;
      g.add(shell);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, -0.02, 0.36);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), skinOliveMat);
      head.scale.set(0.85, 0.82, 1.25);
      head.position.z = 0.06;
      headGroup.add(head);
      g.add(headGroup);

      // Long wing-like rowing front flippers
      const buildFlipper = (side: -1 | 1): THREE.Group => {
        const fp = new THREE.Group();
        fp.position.set(side * 0.24, -0.04, 0.16);
        const blade = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skinOliveMat);
        blade.scale.set(1.45, 0.16, 0.48);
        blade.position.set(side * 0.18, 0, -0.02);
        blade.rotation.y = side * -0.28;
        fp.add(blade);
        return fp;
      };
      const flipperFL = buildFlipper(-1);
      const flipperFR = buildFlipper(1);
      g.add(flipperFL, flipperFR);

      // Small rear steering flippers
      for (const sx of [-1, 1]) {
        const rear = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), skinOliveMat);
        rear.scale.set(0.9, 0.18, 1.3);
        rear.position.set(sx * 0.18, -0.05, -0.34);
        rear.rotation.y = sx * 0.35;
        g.add(rear);
      }

      this.scene.add(g);
      this.turtles.push({ group: g, flipperFL, flipperFR, headGroup, centerX: cx, centerZ: cz, radius, phase });
    });
  }

  // ===========================================================================
  // 6) COLORFUL "CALLE OCHO" ROOSTERS IN LITTLE HAVANA (Comb, Wattles & Sickle Tail!)
  // ===========================================================================
  private spawnHavanaRoosters(): void {
    const hackleGoldMat = new THREE.MeshStandardMaterial({
      map: createPlumageTexture('#e87a24', '#ffd047'),
      roughness: 0.52,
    });
    const bodyRustMat = new THREE.MeshStandardMaterial({
      map: createPlumageTexture('#9e2b25', '#5e1612'),
      roughness: 0.58,
    });
    const tailEmeraldMat = new THREE.MeshStandardMaterial({
      color: '#103b2e',
      roughness: 0.28,
      metalness: 0.42, // iridescent green-black rooster tail sheen!
    });
    const combRedMat = new THREE.MeshStandardMaterial({ color: '#e61e32', roughness: 0.42 });
    const beakYellowMat = new THREE.MeshStandardMaterial({ color: '#f5be2e', roughness: 0.38 });

    const spots: [number, number][] = [
      [-98.5, 2.4],
      [-91.5, 5.6],
      [-83.5, 2.6],
      [-79.0, 5.8],
    ];

    spots.forEach(([rx, rz], idx) => {
      const g = new THREE.Group();
      g.position.set(rx, 0.21, rz);

      // Yellow legs
      const buildLeg = (sx: number): THREE.Group => {
        const lp = new THREE.Group();
        lp.position.set(sx, 0.16, 0);
        const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.16, 6), beakYellowMat);
        shank.position.y = -0.08;
        const toes = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.065), beakYellowMat);
        toes.position.set(0, -0.155, 0.015);
        lp.add(shank, toes);
        return lp;
      };
      const legL = buildLeg(-0.042);
      const legR = buildLeg(0.042);
      g.add(legL, legR);

      // Plump rust-red breast & body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), bodyRustMat);
      body.scale.set(0.86, 0.96, 1.28);
      body.position.set(0, 0.24, 0);
      body.castShadow = true;
      g.add(body);

      // Arched Iridescent Emerald-Black Sickle Tail Plumes!
      for (let t = 0; t < 4; t++) {
        const plumeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.26, -0.14),
          new THREE.Vector3((t - 1.5) * 0.018, 0.42 + (t % 2) * 0.04, -0.24),
          new THREE.Vector3((t - 1.5) * 0.028, 0.34 - t * 0.02, -0.38),
        ]);
        const plume = new THREE.Mesh(new THREE.TubeGeometry(plumeCurve, 10, 0.018, 6, false), tailEmeraldMat);
        plume.castShadow = true;
        g.add(plume);
      }

      // Wings
      const buildWing = (side: -1 | 1): THREE.Group => {
        const wp = new THREE.Group();
        wp.position.set(side * 0.11, 0.26, 0.01);
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), bodyRustMat);
        w.scale.set(0.28, 0.78, 1.25);
        w.position.set(side * 0.015, -0.02, -0.02);
        wp.add(w);
        return wp;
      };
      const wingL = buildWing(-1);
      const wingR = buildWing(1);
      g.add(wingL, wingR);

      // Golden Hackle Neck + Head + Serrated Red Comb + Wattles + Yellow Beak!
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.31, 0.11);
      const hackle = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.18, 12), hackleGoldMat);
      hackle.position.set(0, 0.05, 0.01);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 10), hackleGoldMat);
      head.position.set(0, 0.14, 0.03);

      // 3-peak serrated red rooster comb!
      for (let c = 0; c < 3; c++) {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.052, 6), combRedMat);
        peak.scale.set(0.45, 1.0, 1.0);
        peak.position.set(0, 0.195, 0.055 - c * 0.026);
        peak.rotation.x = -c * 0.18;
        headPivot.add(peak);
      }
      const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), combRedMat);
      wattle.scale.set(0.6, 1.35, 0.8);
      wattle.position.set(0, 0.1, 0.072);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.055, 6), beakYellowMat);
      beak.rotation.x = Math.PI / 2 + 0.15;
      beak.position.set(0, 0.135, 0.092);

      headPivot.add(hackle, head, wattle, beak);
      g.add(headPivot);

      this.scene.add(g);
      this.roosters.push({
        group: g,
        headPivot,
        wingL,
        wingR,
        legL,
        legR,
        pos: new THREE.Vector3(rx, 0.21, rz),
        homeX: rx,
        homeZ: rz,
        targetX: rx + 1.2,
        targetZ: rz + 0.8,
        yaw: idx * 1.5,
        waitTimer: 1.0 + idx * 0.7,
        spookTimer: 0,
        walkPhase: 0,
        phase: idx * 1.9,
      });
    });
  }

  // ===========================================================================
  // UPDATE LOOP (Distance-LOD Optimized!)
  // ===========================================================================
  public update(dt: number, elapsed: number, playerPos: THREE.Vector3, playerSwimming = false): void {
    const clampedDt = Math.min(dt, 0.05);
    if (this.sharkBiteCooldown > 0) this.sharkBiteCooldown -= clampedDt;
    if (this.roosterCluckCooldown > 0) this.roosterCluckCooldown -= clampedDt;

    const lodDistSq = 105 * 105;

    // 1) Flamingos (foraging dip + scatter slightly when player sprints close)
    for (const f of this.flamingos) {
      const dxP = f.baseX + f.offsetX - playerPos.x;
      const dzP = f.baseZ + f.offsetZ - playerPos.z;
      const dSq = dxP * dxP + dzP * dzP;
      if (dSq > lodDistSq) continue;

      if (dSq < 32 && dSq > 0.05) {
        const dist = Math.sqrt(dSq);
        f.offsetX = THREE.MathUtils.clamp(f.offsetX + (dxP / dist) * 2.2 * clampedDt, -2.5, 2.5);
        f.offsetZ = THREE.MathUtils.clamp(f.offsetZ + (dzP / dist) * 2.2 * clampedDt, -2.5, 2.5);
        f.yaw = Math.atan2(dxP, dzP);
        const flap = Math.sin(elapsed * 20 + f.phase) * 0.55;
        f.wingL.rotation.z = -0.35 - Math.abs(flap);
        f.wingR.rotation.z = 0.35 + Math.abs(flap);
        f.neckPivot.rotation.x = 0.1;
      } else {
        f.offsetX *= 1 - clampedDt * 0.5;
        f.offsetZ *= 1 - clampedDt * 0.5;
        f.wingL.rotation.z *= 0.85;
        f.wingR.rotation.z *= 0.85;
        // Graceful rhythmic foraging dip into the shallow water
        const dipWave = Math.sin(elapsed * 0.85 + f.phase);
        f.neckPivot.rotation.x = dipWave > 0.35 ? (dipWave - 0.35) * 1.65 : Math.sin(elapsed * 1.4 + f.phase) * 0.08;
      }
      f.group.position.set(f.baseX + f.offsetX, f.groundY, f.baseZ + f.offsetZ);
      f.group.rotation.y = f.yaw;
    }

    // 2) Dolphins (cruising & parabolic leaps above ocean waves!)
    for (const d of this.dolphins) {
      const ang = elapsed * d.speed + d.phase;
      const dx = d.centerX + Math.cos(ang) * d.radius;
      const dz = d.centerZ + Math.sin(ang) * d.radius;
      if ((dx - playerPos.x) ** 2 + (dz - playerPos.z) ** 2 > 145 * 145) continue;

      // Leap cycle: jumps cleanly out of the water once per ~5.2s interval!
      const leapCycle = (elapsed * 0.95 + d.phase * 2.1) % (Math.PI * 2);
      const jumpWave = Math.sin(leapCycle);
      const y = jumpWave > 0 ? -0.35 + jumpWave * 2.35 : -0.55 + jumpWave * 0.25;
      const pitch = jumpWave > -0.1 ? -Math.cos(leapCycle) * 0.68 : 0;

      d.group.position.set(dx, y, dz);
      d.group.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
      d.group.rotation.x = pitch;
      d.tailPivot.rotation.x = Math.sin(elapsed * 9.5 + d.phase) * 0.38;

      // Splash ring right as dolphin breaches or re-enters surface (-0.2m)
      const nearSurface = Math.abs(y - -0.2) < 0.35 && jumpWave > -0.05;
      const ringMat = d.splashRing.material as THREE.MeshBasicMaterial;
      if (nearSurface) {
        d.splashRing.position.set(dx, -0.15, dz);
        const sc = 1.0 + (0.35 - Math.abs(y - -0.2)) * 3.2;
        d.splashRing.scale.setScalar(sc);
        ringMat.opacity = 0.65;
      } else {
        ringMat.opacity = Math.max(0, ringMat.opacity - clampedDt * 2.2);
      }
    }

    // 3) Circling Deep-Sea Reef Sharks
    for (const s of this.sharks) {
      const ang = elapsed * s.speed + s.phase;
      const sx = s.centerX + Math.cos(ang) * s.radius;
      const sz = s.centerZ + Math.sin(ang) * s.radius;
      // Cruises at y = -0.44 so its 0.52m dorsal fin slices cleanly above y = -0.18 ocean surface!
      s.group.position.set(sx, -0.44 + Math.sin(elapsed * 1.8 + s.phase) * 0.04, sz);
      s.group.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
      s.tailPivot.rotation.y = Math.sin(elapsed * 5.2 + s.phase) * 0.34;

      if (playerSwimming && this.sharkBiteCooldown <= 0) {
        const dSq = (sx - playerPos.x) ** 2 + (sz - playerPos.z) ** 2;
        if (dSq < 6.2) {
          this.sharkBiteCooldown = 6.0;
          this.onSharkNipPlayer?.();
        }
      }
    }

    // 4) Coastal Pelicans
    for (const p of this.pelicans) {
      const dSq = (p.pos.x - playerPos.x) ** 2 + (p.pos.z - playerPos.z) ** 2;
      if (dSq > lodDistSq) continue;
      p.headPivot.rotation.y = Math.sin(elapsed * 0.9 + p.phase) * 0.45;
      const gulp = Math.max(0, Math.sin(elapsed * 1.7 + p.phase));
      p.pouchMesh.scale.y = 0.85 + gulp * 0.45;
      if (dSq < 18) {
        const flap = Math.abs(Math.sin(elapsed * 16 + p.phase)) * 0.65;
        p.wingL.rotation.z = -flap;
        p.wingR.rotation.z = flap;
      } else {
        p.wingL.rotation.z *= 0.85;
        p.wingR.rotation.z *= 0.85;
      }
    }

    // 5) Sea Turtles (graceful underwater breaststroke flipper sweeps!)
    for (const t of this.turtles) {
      const ang = elapsed * 0.24 + t.phase;
      const tx = t.centerX + Math.cos(ang) * t.radius;
      const tz = t.centerZ + Math.sin(ang) * t.radius;
      if ((tx - playerPos.x) ** 2 + (tz - playerPos.z) ** 2 > lodDistSq) continue;

      const surfaceBob = Math.sin(elapsed * 0.65 + t.phase) * 0.09;
      t.group.position.set(tx, -0.32 + surfaceBob, tz);
      t.group.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
      const stroke = Math.sin(elapsed * 2.4 + t.phase);
      t.flipperFL.rotation.z = stroke * 0.42;
      t.flipperFR.rotation.z = -stroke * 0.42;
      t.flipperFL.rotation.y = -0.25 + Math.cos(elapsed * 2.4 + t.phase) * 0.28;
      t.flipperFR.rotation.y = 0.25 - Math.cos(elapsed * 2.4 + t.phase) * 0.28;
      t.headGroup.rotation.x = surfaceBob > 0.04 ? -0.25 : 0;
    }

    // 6) Little Havana Calle Ocho Roosters (strutting, ground pecking & fluttering away!)
    for (const r of this.roosters) {
      const dxP = r.pos.x - playerPos.x;
      const dzP = r.pos.z - playerPos.z;
      const dSqP = dxP * dxP + dzP * dzP;
      if (dSqP > lodDistSq) continue;

      if (dSqP < 12.5 && dSqP > 0.04) {
        // Spooked by player -> flutter & scurry away across the plaza!
        if (r.spookTimer <= 0 && this.roosterCluckCooldown <= 0) {
          this.roosterCluckCooldown = 2.5;
          this.onRoosterSpooked?.();
        }
        r.spookTimer = 0.9;
        const dist = Math.sqrt(dSqP);
        r.targetX = THREE.MathUtils.clamp(r.pos.x + (dxP / dist) * 3.5, -101, -73);
        r.targetZ = THREE.MathUtils.clamp(r.pos.z + (dzP / dist) * 3.5, 1.2, 6.8);
      }

      if (r.spookTimer > 0) r.spookTimer -= clampedDt;

      const dx = r.targetX - r.pos.x;
      const dz = r.targetZ - r.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.2) {
        r.yaw = Math.atan2(dx, dz);
        const spd = r.spookTimer > 0 ? 3.4 : 0.95;
        r.pos.x += (dx / dist) * spd * clampedDt;
        r.pos.z += (dz / dist) * spd * clampedDt;

        r.walkPhase += clampedDt * spd * 9.5;
        const step = Math.sin(r.walkPhase) * 0.55;
        r.legL.rotation.x = step;
        r.legR.rotation.x = -step;
        // Classic chicken head-bob while walking!
        r.headPivot.rotation.x = Math.sin(r.walkPhase * 2) * 0.18;
      } else {
        r.legL.rotation.x *= 0.8;
        r.legR.rotation.x *= 0.8;
        // Pecking grain on the terracotta tiles
        const peck = Math.sin(elapsed * 5.5 + r.phase);
        r.headPivot.rotation.x = peck > 0.45 ? (peck - 0.45) * 1.9 : 0;

        r.waitTimer -= clampedDt;
        if (r.waitTimer <= 0) {
          r.targetX = THREE.MathUtils.clamp(r.homeX + (Math.random() - 0.5) * 6.5, -101, -73);
          r.targetZ = THREE.MathUtils.clamp(r.homeZ + (Math.random() - 0.5) * 4.2, 1.2, 6.8);
          r.waitTimer = 2.5 + Math.random() * 3.5;
        }
      }

      const flutterHop = r.spookTimer > 0 ? Math.abs(Math.sin(elapsed * 18)) * 0.24 : 0;
      if (r.spookTimer > 0) {
        const flap = Math.abs(Math.sin(elapsed * 24)) * 0.95;
        r.wingL.rotation.z = -flap;
        r.wingR.rotation.z = flap;
      } else {
        r.wingL.rotation.z *= 0.82;
        r.wingR.rotation.z *= 0.82;
      }

      r.group.position.set(r.pos.x, 0.21 + flutterHop, r.pos.z);
      r.group.rotation.y = r.yaw;
    }
  }
}
