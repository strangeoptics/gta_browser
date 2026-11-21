import * as THREE from 'three';
import type { ShootableTarget } from './WeaponSystem';

interface TargetEntity {
  id: string;
  group: THREE.Group;
  hp: number;
  maxHp: number;
  respawnTimer: number;
  baseY: number;
  mat: THREE.MeshStandardMaterial;
}

export interface RangePropsManager {
  getActiveTargets: () => ShootableTarget[];
  update: (dt: number, elapsed: number) => void;
}

/**
 * Phase 3 shootable street targets (neon barrels & Art-Deco range buoys) placed around
 * Ocean Drive and Central Plaza so gunplay, hitmarkers, and weapon switching can be tested immediately.
 */
export function createRangeProps(scene: THREE.Scene): RangePropsManager {
  const entities: TargetEntity[] = [];

  const spots = [
    { x: 56, z: 12, color: '#ff4fa3' },
    { x: 64, z: 4, color: '#36f1e6' },
    { x: 56, z: -8, color: '#ff9f43' },
    { x: 64, z: -18, color: '#ff4fa3' },
    { x: 14, z: 4, color: '#36f1e6' },
    { x: -14, z: 8, color: '#ff9f43' },
    { x: 6, z: -14, color: '#ff4fa3' },
    { x: -6, z: 14, color: '#36f1e6' },
  ];

  const baseMat = new THREE.MeshStandardMaterial({ color: '#2b2236', roughness: 0.6, metalness: 0.5 });

  spots.forEach((spot, i) => {
    const group = new THREE.Group();
    group.position.set(spot.x, 0.18, spot.z);

    const mat = new THREE.MeshStandardMaterial({
      color: spot.color,
      emissive: new THREE.Color(spot.color),
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.25,
    });

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.2, 10), baseMat);
    stand.position.y = 0.1;
    group.add(stand);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.15, 12), mat);
    body.position.y = 0.78;
    body.castShadow = true;
    group.add(body);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat);
    cap.position.y = 1.52;
    cap.castShadow = true;
    group.add(cap);

    scene.add(group);
    entities.push({
      id: `target-${i}`,
      group,
      hp: 60,
      maxHp: 60,
      respawnTimer: 0,
      baseY: 0.18,
      mat,
    });
  });

  return {
    getActiveTargets: () => {
      const list: ShootableTarget[] = [];
      for (const e of entities) {
        if (e.hp <= 0) continue;
        list.push({
          id: e.id,
          mesh: e.group,
          onHit: (damage: number) => {
            e.hp -= damage;
            e.mat.emissiveIntensity = 3.2;
            e.group.scale.set(1.12, 0.9, 1.12);
            if (e.hp <= 0) {
              e.group.visible = false;
              e.respawnTimer = 6.0;
              return true;
            }
            return false;
          },
        });
      }
      return list;
    },
    update: (dt: number, elapsed: number) => {
      for (const e of entities) {
        if (e.hp <= 0) {
          e.respawnTimer -= dt;
          if (e.respawnTimer <= 0) {
            e.hp = e.maxHp;
            e.group.visible = true;
            e.group.scale.set(1, 1, 1);
            e.mat.emissiveIntensity = 0.85;
          }
          continue;
        }
        // Smooth hit recovery
        e.group.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-12 * dt));
        e.mat.emissiveIntensity += (0.85 - e.mat.emissiveIntensity) * (1 - Math.exp(-10 * dt));
        e.group.position.y = e.baseY + Math.sin(elapsed * 2.2 + e.group.position.x) * 0.03;
      }
    },
  };
}
