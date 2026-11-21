import * as THREE from 'three';

export interface StuntRamp {
  x: number;
  z: number;
  width: number;
  length: number;
  height: number;
  dirX: number; // launch direction unit X
  dirZ: number; // launch direction unit Z
}

/**
 * Builds 3 glowing neon-striped Miami Stunt Ramps around Ocean Drive, the Beach & Downtown.
 * Vehicles driving up a ramp at speed launch airborne for INSANE STUNT BONUSES!
 */
export function buildStuntRamps(scene: THREE.Scene): StuntRamp[] {
  const specs: { x: number; z: number; yaw: number; width: number; length: number; height: number; color: string }[] = [
    // 1) Ocean Drive Northbound Jump (right ahead of spawn!)
    { x: 60, z: -2, yaw: Math.PI, width: 4.8, length: 7.2, height: 1.85, color: '#ff4fa3' },
    // 2) Beach Launch Ramp (jumps from boardwalk edge toward the sloping surf!)
    { x: 78, z: 22, yaw: Math.PI / 2, width: 4.8, length: 6.8, height: 1.75, color: '#36f1e6' },
    // 3) Downtown Avenue Southbound Jump
    { x: -20, z: 6, yaw: 0, width: 4.8, length: 7.2, height: 1.85, color: '#ffd15c' },
  ];

  const baseMat = new THREE.MeshStandardMaterial({ color: '#2b2038', roughness: 0.45, metalness: 0.45 });
  const ramps: StuntRamp[] = [];

  for (const s of specs) {
    const group = new THREE.Group();
    group.position.set(s.x, 0, s.z);
    group.rotation.y = s.yaw;

    // Build a clean wedge ramp using ExtrudeGeometry (slopes up toward +Z in local space)
    const shape = new THREE.Shape();
    shape.moveTo(-s.length / 2, 0);
    shape.lineTo(s.length / 2, 0);
    shape.lineTo(s.length / 2, s.height);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: s.width, bevelEnabled: false });
    // Orient so +Z is forward up the ramp, centered in X
    geo.translate(0, 0, -s.width / 2);
    geo.rotateY(-Math.PI / 2);

    const mesh = new THREE.Mesh(geo, baseMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Glowing neon side rails along the ramp slope
    const neonMat = new THREE.MeshStandardMaterial({
      color: s.color,
      emissive: s.color,
      emissiveIntensity: 2.6,
    });
    const slopeLen = Math.hypot(s.length, s.height);
    const slopeAngle = Math.atan2(s.height, s.length);
    for (const side of [-s.width / 2 + 0.08, s.width / 2 - 0.08]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, slopeLen), neonMat);
      strip.position.set(side, s.height / 2 + 0.06, 0);
      strip.rotation.x = -slopeAngle;
      group.add(strip);
    }

    scene.add(group);
    ramps.push({
      x: s.x,
      z: s.z,
      width: s.width,
      length: s.length,
      height: s.height,
      dirX: Math.sin(s.yaw),
      dirZ: Math.cos(s.yaw),
    });
  }

  return ramps;
}
