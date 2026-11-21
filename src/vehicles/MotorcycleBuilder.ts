import * as THREE from 'three';

export interface BuiltMotorcycle {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  wheels: THREE.Object3D[];
  tailMat: THREE.MeshStandardMaterial;
  riderMesh: THREE.Group;
  kickstand: THREE.Object3D;
}

/**
 * Builds a high-detail 1986 Miami Vice superbike ("PCJ-86 NEON BIKE"):
 * - Rounded torus sport tires, 5-spoke alloy rims, neon rim pinstripes & drilled brake discs
 * - Raked gold/chrome telescopic front forks, triple clamps, clip-on bars, levers & wing mirrors
 * - Illuminated 80s digital cockpit cluster + tinted aerodynamic bubble windscreen
 * - Sculpted fairing nose, side vents, belly pan, contoured fuel tank & race tail cowl
 * - Visible inline-4 engine block, clutch cover, twin chrome headers & dual upswept mufflers
 * - Rear swingarm, gold monoshock coil, sprocket, hugger, plate bracket & dynamic brake tail light
 * - Articulated 80s rider with full-face visor helmet tucked onto the clip-ons & footpegs
 */
export function createMotorcycleMesh(bodyColor: string, neonColor: string): BuiltMotorcycle {
  const group = new THREE.Group();

  // --- Materials ---
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.16,
    metalness: 0.72,
  });
  const accentDarkMat = new THREE.MeshStandardMaterial({
    color: '#191624',
    roughness: 0.44,
    metalness: 0.5,
  });
  const engineMat = new THREE.MeshStandardMaterial({
    color: '#2c2c38',
    roughness: 0.38,
    metalness: 0.78,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#dce4ee',
    roughness: 0.12,
    metalness: 0.94,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#d8a538',
    roughness: 0.22,
    metalness: 0.88,
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: '#141219',
    roughness: 0.88,
    metalness: 0.06,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: '#1d1824',
    roughness: 0.82,
    metalness: 0.08,
  });
  const windscreenMat = new THREE.MeshStandardMaterial({
    color: '#121c30',
    roughness: 0.06,
    metalness: 0.85,
    transparent: true,
    opacity: 0.68,
  });
  const neonMat = new THREE.MeshStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 2.2,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: '#fff6dc',
    emissive: '#ffe09c',
    emissiveIntensity: 3.4,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: '#ff244e',
    emissive: '#ff1a44',
    emissiveIntensity: 2.4,
  });
  const amberMat = new THREE.MeshStandardMaterial({
    color: '#ffaa22',
    emissive: '#ff8811',
    emissiveIntensity: 1.4,
  });

  // --- Helper: Build Detailed Sportbike Wheel ---
  const buildWheel = (isRear: boolean): THREE.Group => {
    const wheelGroup = new THREE.Group();
    const tireMajor = isRear ? 0.265 : 0.26;
    const tireTube = isRear ? 0.098 : 0.078;

    // Rounded sport tire
    const tireGeo = new THREE.TorusGeometry(tireMajor, tireTube, 14, 28);
    tireGeo.rotateY(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, rubberMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Inner alloy rim barrel
    const rimGeo = new THREE.TorusGeometry(0.195, 0.022, 8, 24);
    rimGeo.rotateY(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, accentDarkMat);
    wheelGroup.add(rim);

    // Glowing neon rim pinstripe (both sides)
    const stripeGeo = new THREE.TorusGeometry(0.205, 0.006, 6, 24);
    stripeGeo.rotateY(Math.PI / 2);
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(stripeGeo, neonMat);
      stripe.position.x = sx * (tireTube * 0.58);
      wheelGroup.add(stripe);
    }

    // Central axle hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, tireTube * 1.9, 12),
      chromeMat,
    );
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    // 5-spoke sportbike alloy spokes
    const spokeGeo = new THREE.BoxGeometry(0.032, 0.185, 0.028);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, chromeMat);
      spoke.position.set(0, Math.cos(angle) * 0.105, Math.sin(angle) * 0.105);
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    // Stainless steel brake rotor(s)
    const discGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.01, 18);
    discGeo.rotateZ(Math.PI / 2);
    const discSides = isRear ? [1] : [-1, 1];
    for (const sx of discSides) {
      const disc = new THREE.Mesh(discGeo, chromeMat);
      disc.position.x = sx * (tireTube * 0.85);
      wheelGroup.add(disc);
    }

    // Rear drive sprocket on left side
    if (isRear) {
      const sprocket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.014, 14),
        goldMat,
      );
      sprocket.rotation.z = Math.PI / 2;
      sprocket.position.x = -tireTube * 0.92;
      wheelGroup.add(sprocket);
    }

    return wheelGroup;
  };

  const frontZ = 0.84;
  const rearZ = -0.82;
  const wheelY = 0.355;

  const frontWheel = buildWheel(false);
  frontWheel.position.set(0, wheelY, frontZ);
  group.add(frontWheel);

  const rearWheel = buildWheel(true);
  rearWheel.position.set(0, wheelY, rearZ);
  group.add(rearWheel);

  const wheels: THREE.Object3D[] = [frontWheel, rearWheel];

  // --- Front Suspension: Raked Telescopic Forks, Triple Clamps & Fender ---
  const forkGroup = new THREE.Group();
  forkGroup.position.set(0, 0.36, frontZ);
  // Tilt forks back ~24 degrees toward the steering head
  forkGroup.rotation.x = -0.42;

  for (const sx of [-0.115, 0.115]) {
    // Lower chrome stanchion
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 10), chromeMat);
    lower.position.set(sx, 0.24, 0);
    forkGroup.add(lower);

    // Upper anodized gold fork leg
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.026, 0.34, 10), goldMat);
    upper.position.set(sx, 0.58, 0);
    forkGroup.add(upper);

    // Gold front brake caliper gripping the disc
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.095, 0.065), goldMat);
    caliper.position.set(sx * 0.88, 0.06, -0.11);
    forkGroup.add(caliper);
  }

  // Lower & upper triple clamps
  for (const ty of [0.46, 0.72]) {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.075), accentDarkMat);
    clamp.position.set(0, ty, 0);
    forkGroup.add(clamp);
  }
  group.add(forkGroup);

  // Curved aerodynamic front fender hugging the front tire
  const frontFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.37, 0.37, 0.17, 14, 1, true, -Math.PI * 0.26, Math.PI * 0.56),
    bodyMat,
  );
  frontFender.rotation.z = Math.PI / 2;
  frontFender.position.set(0, wheelY + 0.01, frontZ);
  frontFender.castShadow = true;
  group.add(frontFender);

  // --- Perimeter Frame, Inline-4 Engine, Swingarm & Monoshock ---
  // Engine block & finned cylinder head
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.44), engineMat);
  engineBlock.position.set(0, 0.46, 0.04);
  engineBlock.castShadow = true;
  group.add(engineBlock);

  const cylHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.28), chromeMat);
  cylHead.position.set(0, 0.62, 0.14);
  cylHead.rotation.x = 0.28;
  group.add(cylHead);

  // Side clutch & stator covers
  for (const sx of [-0.18, 0.18]) {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.045, 14), chromeMat);
    cover.rotation.z = Math.PI / 2;
    cover.position.set(sx, 0.42, 0.0);
    group.add(cover);
  }

  // Twin perimeter frame spars
  for (const sx of [-0.175, 0.175]) {
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.075, 0.82), accentDarkMat);
    spar.position.set(sx, 0.72, 0.02);
    spar.rotation.x = -0.22;
    group.add(spar);

    // Rear swingarm arms
    const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.66), accentDarkMat);
    swingarm.position.set(sx * 0.9, 0.38, -0.5);
    swingarm.rotation.x = 0.08;
    group.add(swingarm);

    // Rider rearset footpegs
    const pegBracket = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.12), chromeMat);
    pegBracket.position.set(sx * 1.12, 0.44, -0.26);
    group.add(pegBracket);

    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), chromeMat);
    peg.rotation.z = Math.PI / 2;
    peg.position.set(sx * 1.45, 0.42, -0.26);
    group.add(peg);
  }

  // Drive chain on left side
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.66), accentDarkMat);
  chain.position.set(-0.11, 0.42, -0.5);
  chain.rotation.x = 0.06;
  group.add(chain);

  // Rear central monoshock with gold spring
  const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.32, 10), goldMat);
  shock.position.set(0, 0.56, -0.34);
  shock.rotation.x = 0.55;
  group.add(shock);

  // 4 Exhaust Headers sweeping down + Dual Upswept Chrome Silencers
  for (const hx of [-0.11, -0.04, 0.04, 0.11]) {
    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), chromeMat);
    header.position.set(hx, 0.42, 0.29);
    header.rotation.x = 0.25;
    group.add(header);
  }
  for (const sx of [-0.19, 0.19]) {
    const midPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.55, 8), chromeMat);
    midPipe.rotation.x = Math.PI / 2 - 0.12;
    midPipe.position.set(sx * 0.9, 0.34, -0.18);
    group.add(midPipe);

    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.56, 12), chromeMat);
    muffler.rotation.x = Math.PI / 2 - 0.34;
    muffler.position.set(sx * 1.15, 0.49, -0.68);
    muffler.castShadow = true;
    group.add(muffler);

    const exhaustTip = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 10), accentDarkMat);
    exhaustTip.rotation.x = Math.PI / 2 - 0.34;
    exhaustTip.position.set(sx * 1.16, 0.58, -0.95);
    group.add(exhaustTip);
  }

  // --- Sculpted 80s Superbike Bodywork: Tank, Full Fairing, Belly Pan & Tail ---
  // Contoured Fuel Tank (layered profile + knee grip bevels + Monza cap)
  const tankMain = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.58), bodyMat);
  tankMain.position.set(0, 0.87, 0.16);
  tankMain.rotation.x = -0.1;
  tankMain.castShadow = true;
  group.add(tankMain);

  const tankTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.48), bodyMat);
  tankTop.position.set(0, 0.98, 0.2);
  tankTop.rotation.x = -0.18;
  group.add(tankTop);

  const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.022, 12), chromeMat);
  fuelCap.position.set(0, 1.035, 0.25);
  group.add(fuelCap);

  // Aggressive Raked Front Nose Fairing
  const noseUpper = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.52), bodyMat);
  noseUpper.position.set(0, 0.89, 0.7);
  noseUpper.rotation.x = 0.34;
  noseUpper.castShadow = true;
  group.add(noseUpper);

  const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.28), bodyMat);
  noseTip.position.set(0, 0.84, 0.96);
  noseTip.rotation.x = 0.48;
  group.add(noseTip);

  // Tinted Aerodynamic Bubble Windscreen
  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.045), windscreenMat);
  windscreen.position.set(0, 1.1, 0.67);
  windscreen.rotation.x = -0.82;
  group.add(windscreen);

  // Side Fairing Panels with Dark Louver Vents & Neon Racing Stripes
  for (const sx of [-1, 1]) {
    const sideFairing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.72), bodyMat);
    sideFairing.position.set(sx * 0.23, 0.66, 0.38);
    sideFairing.rotation.y = sx * -0.08;
    sideFairing.castShadow = true;
    group.add(sideFairing);

    // Dark side air-intake vent cutout
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.12, 0.24), accentDarkMat);
    vent.position.set(sx * 0.235, 0.63, 0.32);
    vent.rotation.y = sx * -0.08;
    vent.rotation.x = -0.18;
    group.add(vent);

    // Razor-thin Neon Accent Stripe along fairing & tail
    const frontStripe = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.76), neonMat);
    frontStripe.position.set(sx * 0.264, 0.72, 0.4);
    frontStripe.rotation.y = sx * -0.08;
    frontStripe.rotation.x = -0.12;
    group.add(frontStripe);

    const tailStripe = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.64), neonMat);
    tailStripe.position.set(sx * 0.182, 0.84, -0.68);
    tailStripe.rotation.x = -0.18;
    group.add(tailStripe);
  }

  // Lower Chin / Belly Pan under the engine
  const bellyPan = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.68), bodyMat);
  bellyPan.position.set(0, 0.31, 0.12);
  bellyPan.rotation.x = -0.06;
  bellyPan.castShadow = true;
  group.add(bellyPan);

  // Subtle underglow tube beneath belly pan
  const underglow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.56), neonMat);
  underglow.position.set(0, 0.235, 0.08);
  group.add(underglow);

  // Twin Iconic 80s Superbike Headlights + Chrome Bezels
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.06), accentDarkMat);
  bezel.position.set(0, 0.84, 1.04);
  bezel.rotation.x = 0.28;
  group.add(bezel);

  for (const hx of [-0.085, 0.085]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.04), headMat);
    lamp.position.set(hx, 0.84, 1.06);
    lamp.rotation.x = 0.28;
    group.add(lamp);
  }

  // Front Amber Turn Signals protruding from fairing sides
  for (const sx of [-0.28, 0.28]) {
    const blinker = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.036, 0.045), amberMat);
    blinker.position.set(sx, 0.82, 0.78);
    group.add(blinker);
  }

  // --- Cockpit: Digital 80s Dash, Clip-On Handlebars, Levers & Wing Mirrors ---
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.12), accentDarkMat);
  dash.position.set(0, 1.01, 0.64);
  dash.rotation.x = -0.45;
  group.add(dash);

  const gaugeMat = new THREE.MeshStandardMaterial({
    color: '#22ffee',
    emissive: '#36f1e6',
    emissiveIntensity: 1.6,
  });
  const gaugeScreen = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.02), gaugeMat);
  gaugeScreen.position.set(0, 1.02, 0.59);
  gaugeScreen.rotation.x = -0.45;
  group.add(gaugeScreen);

  // Clip-on handlebars + rubber grips + chrome brake/clutch levers
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 8), chromeMat);
    bar.rotation.z = Math.PI / 2 + sx * 0.14;
    bar.rotation.y = sx * -0.22;
    bar.position.set(sx * 0.24, 0.99, 0.5);
    group.add(bar);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8), rubberMat);
    grip.rotation.z = Math.PI / 2 + sx * 0.14;
    grip.rotation.y = sx * -0.22;
    grip.position.set(sx * 0.34, 0.975, 0.475);
    group.add(grip);

    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.018), chromeMat);
    lever.position.set(sx * 0.31, 0.97, 0.53);
    lever.rotation.y = sx * -0.22;
    group.add(lever);

    // Aerodynamic wing mirrors on stalks
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), accentDarkMat);
    stalk.position.set(sx * 0.24, 1.09, 0.72);
    stalk.rotation.z = sx * -0.58;
    group.add(stalk);

    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.045), bodyMat);
    mirrorHousing.position.set(sx * 0.33, 1.15, 0.72);
    group.add(mirrorHousing);

    const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.048, 0.01), chromeMat);
    mirrorGlass.position.set(sx * 0.33, 1.15, 0.695);
    group.add(mirrorGlass);
  }

  // --- Stepped Sport Seat, Sculpted Tail Cowl, Rear Hugger & Dynamic Brake Light ---
  const riderSeat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.46), seatMat);
  riderSeat.position.set(0, 0.79, -0.28);
  riderSeat.rotation.x = 0.08;
  group.add(riderSeat);

  const tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.68), bodyMat);
  tailCowl.position.set(0, 0.85, -0.74);
  tailCowl.rotation.x = -0.18;
  tailCowl.castShadow = true;
  group.add(tailCowl);

  const pillionPad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.065, 0.3), seatMat);
  pillionPad.position.set(0, 0.96, -0.68);
  pillionPad.rotation.x = -0.16;
  group.add(pillionPad);

  // Twin recessed red brake/tail light bar (wired to Vehicle.tailMat!)
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.05), tailMat);
  tailLight.position.set(0, 0.89, -1.07);
  tailLight.rotation.x = -0.18;
  group.add(tailLight);

  // Rear license plate holder + tiny white plate + rear amber turn signals
  const plateBracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.03), accentDarkMat);
  plateBracket.position.set(0, 0.73, -1.04);
  plateBracket.rotation.x = 0.42;
  group.add(plateBracket);

  const plateMat = new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.4 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.015), plateMat);
  plate.position.set(0, 0.72, -1.06);
  plate.rotation.x = 0.42;
  group.add(plate);

  for (const sx of [-0.14, 0.14]) {
    const rBlink = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, 0.035), amberMat);
    rBlink.position.set(sx, 0.77, -1.03);
    group.add(rBlink);
  }

  // Rear Tire Hugger
  const rearHugger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.21, 12, 1, true, -Math.PI * 0.12, Math.PI * 0.42),
    accentDarkMat,
  );
  rearHugger.rotation.z = Math.PI / 2;
  rearHugger.position.set(0, wheelY, rearZ);
  group.add(rearHugger);

  // Side Kickstand (visible when parked, retracts when riding)
  const kickstand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 6), chromeMat);
  kickstand.position.set(-0.22, 0.19, -0.14);
  kickstand.rotation.z = 0.45;
  kickstand.rotation.x = -0.22;
  group.add(kickstand);

  // --- Articulated 80s Miami Sportbike Rider (visible while riding) ---
  const riderMesh = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: '#f2e8e1', roughness: 0.58 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: '#36f1e6', roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#24293d', roughness: 0.76 });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#141218', roughness: 0.55, metalness: 0.2 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: '#181520', roughness: 0.65 });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: '#1b1628',
    roughness: 0.14,
    metalness: 0.78,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: '#0c1828',
    emissive: '#36f1e6',
    emissiveIntensity: 0.45,
    roughness: 0.08,
    metalness: 0.92,
  });

  // Tucked forward torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.24), jacketMat);
  torso.position.set(0, 1.15, -0.12);
  torso.rotation.x = 0.56;
  torso.castShadow = true;
  riderMesh.add(torso);

  const innerShirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.25), shirtMat);
  innerShirt.position.set(0, 1.16, -0.11);
  innerShirt.rotation.x = 0.56;
  riderMesh.add(innerShirt);

  // Full-face sportbike helmet with reflective visor & neon racing stripe
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), helmetMat);
  helmet.position.set(0, 1.46, 0.14);
  helmet.scale.set(0.94, 1.0, 1.12);
  helmet.castShadow = true;
  riderMesh.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.095, 0.12), visorMat);
  visor.position.set(0, 1.45, 0.27);
  visor.rotation.x = 0.12;
  riderMesh.add(visor);

  const helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.03, 0.28), neonMat);
  helmetStripe.position.set(0, 1.62, 0.13);
  riderMesh.add(helmetStripe);

  // Arms reaching forward to the clip-on grips + Legs tucked onto the footpegs
  for (const sx of [-1, 1]) {
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.11), jacketMat);
    upperArm.position.set(sx * 0.25, 1.2, 0.08);
    upperArm.rotation.x = 0.95;
    upperArm.rotation.z = sx * -0.15;
    riderMesh.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.28, 0.095), jacketMat);
    forearm.position.set(sx * 0.31, 1.05, 0.32);
    forearm.rotation.x = 1.32;
    forearm.rotation.z = sx * -0.08;
    riderMesh.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), gloveMat);
    glove.position.set(sx * 0.34, 0.98, 0.47);
    riderMesh.add(glove);

    // Thigh hugging the fuel tank
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.34, 0.15), pantsMat);
    thigh.position.set(sx * 0.21, 0.82, -0.18);
    thigh.rotation.x = 0.72;
    riderMesh.add(thigh);

    // Lower leg bent back to rearset footpeg
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.12), pantsMat);
    shin.position.set(sx * 0.23, 0.6, -0.17);
    shin.rotation.x = -0.58;
    riderMesh.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.2), bootMat);
    boot.position.set(sx * 0.24, 0.44, -0.22);
    riderMesh.add(boot);
  }

  riderMesh.visible = false;
  group.add(riderMesh);

  return { group, bodyMat, wheels, tailMat, riderMesh, kickstand };
}
