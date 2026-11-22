import * as THREE from 'three';

export interface TrafficLightSystem {
  update: (elapsed: number) => void;
  shouldAiStop: (x: number, z: number, yaw: number) => boolean;
}

interface SignalBulbSet {
  nsRed: THREE.MeshStandardMaterial;
  nsYellow: THREE.MeshStandardMaterial;
  nsGreen: THREE.MeshStandardMaterial;
  ewRed: THREE.MeshStandardMaterial;
  ewYellow: THREE.MeshStandardMaterial;
  ewGreen: THREE.MeshStandardMaterial;
}

const INTERSECTIONS: [number, number][] = [
  [27, 27],
  [27, -27],
  [-27, 27],
  [-27, -27],
];

/**
 * Working 3-phase traffic lights at the 4 central intersections (Green -> Yellow -> Red).
 * AI traffic cars automatically yield at red lights and resume on green!
 */
export function buildTrafficLights(scene: THREE.Scene): TrafficLightSystem {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#24202e', roughness: 0.45, metalness: 0.7 });
  const boxMat = new THREE.MeshStandardMaterial({ color: '#18141f', roughness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.8, 6);
  const armGeo = new THREE.BoxGeometry(3.4, 0.1, 0.1);
  const housingGeo = new THREE.BoxGeometry(0.38, 1.05, 0.38);
  const bulbGeo = new THREE.SphereGeometry(0.11, 8, 8);

  // Shared emissive materials for N-S vs E-W phase
  const mats: SignalBulbSet = {
    nsRed: new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 0.1 }),
    nsYellow: new THREE.MeshStandardMaterial({ color: '#ffbe3b', emissive: '#ffbe3b', emissiveIntensity: 0.1 }),
    nsGreen: new THREE.MeshStandardMaterial({ color: '#38f28a', emissive: '#38f28a', emissiveIntensity: 3.0 }),
    ewRed: new THREE.MeshStandardMaterial({ color: '#ff2244', emissive: '#ff2244', emissiveIntensity: 3.0 }),
    ewYellow: new THREE.MeshStandardMaterial({ color: '#ffbe3b', emissive: '#ffbe3b', emissiveIntensity: 0.1 }),
    ewGreen: new THREE.MeshStandardMaterial({ color: '#38f28a', emissive: '#38f28a', emissiveIntensity: 0.1 }),
  };

  for (const [ix, iz] of INTERSECTIONS) {
    // Two diagonal corner poles per intersection: one controls N-S, one controls E-W
    const setups: { px: number; pz: number; armX: number; armZ: number; isNS: boolean }[] = [
      { px: ix + 6.4, pz: iz + 6.4, armX: -1.6, armZ: 0, isNS: true },
      { px: ix - 6.4, pz: iz - 6.4, armX: 0, armZ: 1.6, isNS: false },
    ];

    for (const s of setups) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(s.px, 2.9, s.pz);
      scene.add(pole);

      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(s.px + s.armX, 5.65, s.pz + s.armZ);
      if (!s.isNS) arm.rotation.y = Math.PI / 2;
      scene.add(arm);

      const hx = s.px + s.armX * 1.9;
      const hz = s.pz + s.armZ * 1.9;
      const housing = new THREE.Mesh(housingGeo, boxMat);
      housing.position.set(hx, 5.2, hz);
      scene.add(housing);

      const rMat = s.isNS ? mats.nsRed : mats.ewRed;
      const yMat = s.isNS ? mats.nsYellow : mats.ewYellow;
      const gMat = s.isNS ? mats.nsGreen : mats.ewGreen;

      const offsets: [number, THREE.MeshStandardMaterial][] = [
        [0.3, rMat],
        [0, yMat],
        [-0.3, gMat],
      ];
      for (const [dy, m] of offsets) {
        const bulb = new THREE.Mesh(bulbGeo, m);
        bulb.position.set(hx, 5.2 + dy, hz);
        scene.add(bulb);
      }
    }
  }

  // 16s full cycle: 0..6.5 NS Green, 6.5..8 NS Yellow, 8..14.5 EW Green, 14.5..16 EW Yellow
  let nsCanGo = true;
  let ewCanGo = false;

  return {
    update: (elapsed: number) => {
      const t = elapsed % 16;
      const nsGreen = t < 6.5;
      const nsYellow = t >= 6.5 && t < 8.0;
      const ewGreen = t >= 8.0 && t < 14.5;
      const ewYellow = t >= 14.5;

      nsCanGo = nsGreen;
      ewCanGo = ewGreen;

      mats.nsGreen.emissiveIntensity = nsGreen ? 3.2 : 0.08;
      mats.nsYellow.emissiveIntensity = nsYellow ? 3.2 : 0.08;
      mats.nsRed.emissiveIntensity = !nsGreen && !nsYellow ? 3.2 : 0.08;

      mats.ewGreen.emissiveIntensity = ewGreen ? 3.2 : 0.08;
      mats.ewYellow.emissiveIntensity = ewYellow ? 3.2 : 0.08;
      mats.ewRed.emissiveIntensity = !ewGreen && !ewYellow ? 3.2 : 0.08;
    },
    shouldAiStop: (x: number, z: number, yaw: number) => {
      const fwdX = Math.sin(yaw);
      const fwdZ = Math.cos(yaw);
      const movingNS = Math.abs(fwdZ) > Math.abs(fwdX);

      if (movingNS && nsCanGo) return false;
      if (!movingNS && ewCanGo) return false;

      // Stop right before entering any of the 4 central intersections
      for (const [ix, iz] of INTERSECTIONS) {
        const dx = ix - x;
        const dz = iz - z;
        const dist = Math.hypot(dx, dz);
        if (dist > 6.8 && dist < 11.5) {
          const approaching = dx * fwdX + dz * fwdZ > 0;
          if (approaching) return true;
        }
      }
      return false;
    },
  };
}
