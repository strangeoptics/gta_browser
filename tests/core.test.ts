import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialGrid } from '../src/engine/SpatialGrid.ts';
import { WantedSystem } from '../src/gameplay/WantedSystem.ts';
import { LowriderBattleSystem } from '../src/gameplay/LowriderBattleSystem.ts';
import {
  DEFAULT_PLAYABLE_BOUNDS,
  WORLD_LANDMARKS,
  generateCityLayout,
} from '../src/world/CityLayout.ts';
import type { AABB } from '../src/types.ts';

describe('SpatialGrid', () => {
  it('queries overlapping static boxes and deduplicates boxes spanning multiple cells', () => {
    const boxes: AABB[] = [
      // Spans across 16m cell boundary (x = 12..24)
      { minX: 12, maxX: 24, minY: 0, maxY: 4, minZ: 12, maxZ: 24, tag: 'wide-building' },
      // Far away box
      { minX: -80, maxX: -70, minY: 0, maxY: 4, minZ: -80, maxZ: -70, tag: 'distant' },
    ];
    const grid = new SpatialGrid(boxes);
    const out: AABB[] = [];
    const hits = grid.queryBox(10, 26, 10, 26, undefined, out);

    assert.equal(hits, out);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].tag, 'wide-building');
  });

  it('keeps movable yacht colliders dynamic and merges extraDynamic boxes', () => {
    const yachtBox: AABB = { minX: 165, maxX: 179, minY: 0, maxY: 3, minZ: -5, maxZ: 35, tag: 'yacht-hull' };
    const grid = new SpatialGrid([yachtBox]);

    // Move the yacht across the ocean after grid construction
    yachtBox.minX = 110;
    yachtBox.maxX = 124;

    const extraCar: AABB = { minX: 112, maxX: 116, minY: 0, maxY: 1.5, minZ: 0, maxZ: 4, tag: 'vehicle' };
    const hits = grid.queryBox(108, 126, -6, 36, [extraCar]);
    assert.equal(hits.length, 2);
  });
});

describe('WantedSystem', () => {
  it('escalates stars from 0 to 5, caps heat at 500, and decays after cooldown', () => {
    const wanted = new WantedSystem();
    assert.equal(wanted.stars, 0);

    wanted.addHeat(35);
    assert.equal(wanted.stars, 1);
    assert.equal(wanted.isCoolingDown(), false);

    wanted.addHeat(1000);
    assert.equal(wanted.heat, 500);
    assert.equal(wanted.stars, 5);

    // Advance past 18s cooldown + decay
    wanted.update(16.0);
    assert.equal(wanted.isCoolingDown(), true);
    wanted.update(25.0);
    assert.equal(wanted.stars, 0);
    assert.equal(wanted.heat, 0);
  });

  it('clamps setStars cleanly and resets to 0', () => {
    const wanted = new WantedSystem();
    wanted.setStars(99);
    assert.equal(wanted.stars, 5);
    wanted.reset();
    assert.equal(wanted.stars, 0);
    assert.equal(wanted.heat, 0);
  });
});

describe('LowriderBattleSystem', () => {
  it('starts a 16-beat session, scores hits, and finishes cleanly', () => {
    const battle = new LowriderBattleSystem();
    assert.equal(battle.isActive(), false);

    battle.start();
    assert.equal(battle.isActive(), true);

    // Advance to the first beat (t = 1.45s) and inspect upcoming note
    const snap = battle.update(1.45);
    assert.equal(snap.active, true);
    assert.ok(snap.notes.length > 0);

    const firstDir = snap.notes[0].dir;
    const keyMap = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', hop: 'Space' } as const;
    const hit = battle.handleKey(keyMap[firstDir]);
    assert.equal(hit.matched, true);
    assert.equal(hit.quality, 'perfect');

    // Fast-forward to end of battle
    const endSnap = battle.update(20.0);
    assert.equal(endSnap.active, false);
    assert.ok(endSnap.finishedToast !== null);
  });
});

describe('CityLayout', () => {
  it('generates a deterministic 3x3 layout and keeps reserved walk-in blocks clear', () => {
    const a = generateCityLayout();
    const b = generateCityLayout();
    assert.equal(a.buildings.length, b.buildings.length);
    assert.ok(a.buildings.length > 0);

    // Reserved walk-in blocks: Vice PD (-40, 0), Neon Club (40, 0), Safehouse (40, -40)
    const reserved = [
      WORLD_LANDMARKS.VICE_PD_PRECINCT,
      WORLD_LANDMARKS.NEON_CLUB,
      WORLD_LANDMARKS.SAFEHOUSE,
    ];
    for (const r of reserved) {
      const overlaps = a.buildings.some((bld) => Math.abs(bld.x - r.x) < 10 && Math.abs(bld.z - r.z) < 10);
      assert.equal(overlaps, false, `Reserved block (${r.x}, ${r.z}) must stay clear`);
    }

    assert.equal(DEFAULT_PLAYABLE_BOUNDS.minX < DEFAULT_PLAYABLE_BOUNDS.maxX, true);
    assert.equal(DEFAULT_PLAYABLE_BOUNDS.minZ < DEFAULT_PLAYABLE_BOUNDS.maxZ, true);
  });
});
